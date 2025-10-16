import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'http';
import {
    MessageRouter,
    MessageProtocolValidator,
    RateLimiter,
    ERROR_CODES,
    PROTOCOL_VERSION,
    SUPPORTED_MESSAGE_TYPES
} from './messageProtocol';
import SessionManager, { type ClientSession } from './sessionManager';
import { canvasPersistence } from '../services/persistenceService';

export interface Client {
    id: string;
    ws: WebSocket;
    isAlive: boolean;
    joinedAt: Date;
    roomId?: string;
    session?: ClientSession;
    user?: {
        uid: string;
        email: string | null;
        name: string | null;
        picture: string | null;
        displayName?: string;
        avatarColor?: string;
    };
}

export interface Message {
    type: string;
    payload?: any;
    timestamp?: number;
    clientId?: string;
}

export class WebSocketConnectionManager {
    private wss: WebSocketServer;
    private clients: Map<string, Client> = new Map();
    private rooms: Map<string, Set<string>> = new Map();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private messageRouter: MessageRouter;
    private rateLimiter: RateLimiter;
    private sessionManager: SessionManager;

    constructor(server: Server) {
        this.wss = new WebSocketServer({ server });
        this.messageRouter = new MessageRouter();
        this.rateLimiter = new RateLimiter(300, 60000); // 300 messages per minute (5 per second) for cursor updates
        this.sessionManager = new SessionManager();
        this.initialize();
        this.setupMessageHandlers();
        this.startHeartbeat();
    }

    private initialize(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            this.handleConnection(ws);
        });

        console.log('📡 WebSocket Connection Manager initialized');
    }

    private setupMessageHandlers(): void {
        console.log('🔧 Setting up message protocol handlers...');

        // Register message handlers with the router
        this.messageRouter.registerHandler('ping', this.handlePing.bind(this));
        this.messageRouter.registerHandler('join_room', this.handleJoinRoom.bind(this));
        this.messageRouter.registerHandler('leave_room', this.handleLeaveRoom.bind(this));
        this.messageRouter.registerHandler('auth', this.handleAuthentication.bind(this));
        this.messageRouter.registerHandler('heartbeat', this.handleHeartbeat.bind(this));
        this.messageRouter.registerHandler('reconnect', this.handleReconnect.bind(this));
        // Cursor synchronization handlers
        this.messageRouter.registerHandler('cursor_moved', this.handleCursorMoved.bind(this));
        this.messageRouter.registerHandler('cursor_update', this.handleCursorUpdate.bind(this));
        this.messageRouter.registerHandler('cursor_left', this.handleCursorLeft.bind(this));

        // Object synchronization handlers
        this.messageRouter.registerHandler('object_created', this.handleObjectCreated.bind(this));
        this.messageRouter.registerHandler('object_updated', this.handleObjectUpdated.bind(this));
        this.messageRouter.registerHandler('object_moved', this.handleObjectMoved.bind(this));
        this.messageRouter.registerHandler('object_deleted', this.handleObjectDeleted.bind(this));
        this.messageRouter.registerHandler('canvas_state_requested', this.handleCanvasStateRequested.bind(this));

        console.log(`✅ Registered handlers for: ${this.messageRouter.getRegisteredTypes().join(', ')}`);
    }

    private handleConnection(ws: WebSocket): void {
        const clientId = uuidv4();
        const client: Client = {
            id: clientId,
            ws,
            isAlive: true,
            joinedAt: new Date()
        };

        // Create session for disconnect/reconnect management
        const session = this.sessionManager.createSession(clientId);
        client.session = session;

        this.clients.set(clientId, client);
        console.log(`✅ Client connected: ${clientId}. Total clients: ${this.clients.size}`);

        // Send welcome message to new client with protocol version and reconnect token
        this.sendToClient(clientId, {
            type: 'connection_established',
            payload: {
                clientId,
                serverTime: Date.now(),
                connectedClients: this.clients.size,
                protocolVersion: PROTOCOL_VERSION,
                reconnectToken: session.reconnectToken
            },
            timestamp: Date.now()
        });

        // Set up event handlers for this connection
        this.setupClientEventHandlers(clientId);
    }

    private setupClientEventHandlers(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { ws } = client;

        // Handle incoming messages with protocol validation and rate limiting
        ws.on('message', (data: Buffer) => {
            // Check rate limit
            if (!this.rateLimiter.checkLimit(clientId)) {
                console.warn(`🚫 Rate limit exceeded for client ${clientId}`);
                this.sendErrorMessage(clientId, ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Too many messages. Please slow down.');
                return;
            }

            try {
                const rawMessage = JSON.parse(data.toString());

                // Use message router for validation and handling
                const success = this.messageRouter.route(clientId, rawMessage, {
                    sendToClient: this.sendToClient.bind(this),
                    manager: this
                });

                if (success) {
                    console.log(`📨 Processed message from ${clientId}: ${rawMessage.type}`);
                } else {
                    console.warn(`⚠️ Failed to process message from ${clientId}: ${rawMessage.type}`);
                }
            } catch (error) {
                console.error(`❌ Error parsing message from client ${clientId}:`, error);
                this.sendErrorMessage(clientId, ERROR_CODES.INVALID_MESSAGE, 'Failed to parse message');
            }
        });

        // Handle client disconnect
        ws.on('close', (code: number, reason: Buffer) => {
            console.log(`🔌 Client disconnected: ${clientId} (Code: ${code}, Reason: ${reason.toString()})`);
            this.handleDisconnect(clientId, code, reason.toString());
            console.log(`📊 Total clients after disconnect: ${this.clients.size}`);
        });

        // Handle WebSocket errors
        ws.on('error', (error: Error) => {
            console.error(`❌ WebSocket error for client ${clientId}:`, error);
            this.handleDisconnect(clientId, 1002, error.message);
            console.log(`📊 Total clients after error cleanup: ${this.clients.size}`);
        });

        // Handle heartbeat pong responses
        ws.on('pong', () => {
            const client = this.clients.get(clientId);
            if (client) {
                client.isAlive = true;
            }
        });
    }

    // Message handlers (called by message router)
    private handlePing(clientId: string, _message: any, _context: any): void {
        this.sendToClient(clientId, {
            type: 'pong',
            timestamp: Date.now()
        });
    }

    private handleJoinRoom(clientId: string, message: any, _context: any): void {
        const { roomId, userInfo } = message.payload || {};

        // Validate room ID using protocol validator
        const roomValidation = MessageProtocolValidator.validateRoomId(roomId);
        if (!roomValidation.valid) {
            this.sendErrorMessage(clientId, roomValidation.error!.code, roomValidation.error!.message);
            return;
        }

        // Validate user info if provided
        if (userInfo) {
            const userValidation = MessageProtocolValidator.validateUserInfo(userInfo);
            if (!userValidation.valid) {
                this.sendErrorMessage(clientId, userValidation.error!.code, userValidation.error!.message);
                return;
            }
        }

        const client = this.clients.get(clientId);
        if (!client) return;

        // Leave current room if in one
        if (client.roomId) {
            this.leaveRoom(clientId, client.roomId);
        }

        // Join new room
        client.roomId = roomId;
        if (userInfo) {
            client.user = { ...client.user, ...userInfo };
        }

        // Update session with room and user info
        this.sessionManager.updateSession(clientId, {
            roomId,
            userInfo: client.user
        });

        // Add to room tracking
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId)!.add(clientId);

        console.log(`🏠 Client ${clientId} joined room: ${roomId} (${this.rooms.get(roomId)!.size} users in room)`);

        // Get current room members
        const roomMembers = this.getRoomMembers(roomId);

        // Send room state to joining client
        this.sendToClient(clientId, {
            type: 'room_joined',
            payload: {
                roomId,
                userId: clientId,
                roomMembers: roomMembers.filter(member => member.clientId !== clientId) // Exclude self
            },
            timestamp: Date.now()
        });

        // Notify other room members about new user
        this.broadcastToRoom(roomId, {
            type: 'user_joined',
            payload: {
                userId: clientId,
                roomId,
                userInfo: client.user,
                roomMembers: roomMembers.length
            },
            timestamp: Date.now()
        }, clientId);
    }

    private handleLeaveRoom(clientId: string, message: any, _context: any): void {
        const { roomId: requestedRoomId } = message.payload || {};
        const client = this.clients.get(clientId);
        if (!client || !client.roomId) return;

        const roomId = requestedRoomId || client.roomId;
        this.leaveRoom(clientId, roomId);

        // Confirm to client
        this.sendToClient(clientId, {
            type: 'room_left',
            payload: { roomId },
            timestamp: Date.now()
        });
    }

    private handleAuthentication(clientId: string, message: any, _context: any): void {
        const { token, userInfo } = message.payload || {};

        if (!token) {
            this.sendErrorMessage(clientId, ERROR_CODES.AUTH_REQUIRED, 'Authentication token required');
            return;
        }

        const client = this.clients.get(clientId);
        if (!client) return;

        // Validate user info if provided
        if (userInfo) {
            const userValidation = MessageProtocolValidator.validateUserInfo(userInfo);
            if (!userValidation.valid) {
                this.sendErrorMessage(clientId, userValidation.error!.code, userValidation.error!.message);
                return;
            }
        }

        // TODO: Verify token with Firebase (will be implemented in PR #8)
        // For now, accept any token and store user info
        if (userInfo) {
            client.user = userInfo;
        }

        console.log(`🔐 Client ${clientId} authenticated as: ${userInfo?.email || 'unknown'}`);

        this.sendToClient(clientId, {
            type: 'auth_success',
            payload: {
                userId: clientId,
                user: client.user
            },
            timestamp: Date.now()
        });
    }

    private handleHeartbeat(clientId: string, _message: any, _context: any): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.isAlive = true;
        }

        this.sendToClient(clientId, {
            type: 'heartbeat_ack',
            timestamp: Date.now()
        });
    }

    private handleReconnect(clientId: string, message: any, _context: any): void {
        const { reconnectToken } = message.payload || {};

        console.log(`🔄 Reconnection attempt from client ${clientId} with token ${reconnectToken}`);

        // Try to reconnect using session manager
        const reconnectResult = this.sessionManager.attemptReconnect(clientId, reconnectToken);

        if (reconnectResult.success && reconnectResult.session) {
            const session = reconnectResult.session;
            const client = this.clients.get(clientId);

            if (client) {
                // Update client with session data
                client.session = session;
                client.user = session.userInfo;

                // Restore room membership if client was in a room
                if (session.roomId) {
                    client.roomId = session.roomId;

                    // Add back to room tracking
                    if (!this.rooms.has(session.roomId)) {
                        this.rooms.set(session.roomId, new Set());
                    }
                    this.rooms.get(session.roomId)!.add(clientId);

                    console.log(`🏠 Restored client ${clientId} to room: ${session.roomId}`);
                }

                // Send successful reconnection response
                this.sendToClient(clientId, {
                    type: 'reconnect_success',
                    payload: {
                        sessionRecovered: true,
                        roomId: session.roomId,
                        userInfo: session.userInfo,
                        sessionId: session.sessionId,
                        reconnectAttempts: session.reconnectAttempts,
                        newReconnectToken: session.reconnectToken
                    },
                    timestamp: Date.now()
                });

                // Notify room members if back in a room
                if (session.roomId) {
                    this.broadcastToRoom(session.roomId, {
                        type: 'user_joined',
                        payload: {
                            userId: clientId,
                            roomId: session.roomId,
                            userInfo: session.userInfo,
                            roomMembers: this.rooms.get(session.roomId)?.size || 1
                        },
                        timestamp: Date.now()
                    }, clientId);
                }

                console.log(`✅ Client ${clientId} successfully reconnected to session ${session.sessionId}`);
            }
        } else {
            // Reconnection failed
            this.sendErrorMessage(
                clientId,
                ERROR_CODES.RECONNECT_FAILED,
                reconnectResult.error || 'Session recovery failed',
                {
                    reconnectAttempts: 0,
                    canRetry: false
                }
            );

            console.log(`❌ Reconnection failed for client ${clientId}: ${reconnectResult.error}`);
        }
    }

    // Cursor synchronization message handlers
    private handleCursorMoved(clientId: string, message: any, _context: any): void {
        const { x, y, roomId } = message.payload || {};
        const client = this.clients.get(clientId);

        if (!client || !client.roomId || client.roomId !== roomId) {
            this.sendErrorMessage(clientId, ERROR_CODES.INVALID_ROOM_ID, 'Not in the specified room');
            return;
        }

        // Broadcast cursor position to other users in the room
        this.broadcastToRoom(roomId, {
            type: 'cursor_moved',
            payload: {
                x,
                y,
                userId: clientId,
                roomId,
                userInfo: client.user
            },
            timestamp: Date.now()
        }, clientId);
    }

    private handleCursorUpdate(clientId: string, message: any, _context: any): void {
        const { x, y, roomId, userInfo, activeTool } = message.payload || {};
        const client = this.clients.get(clientId);

        if (!client || !client.roomId || client.roomId !== roomId) {
            this.sendErrorMessage(clientId, ERROR_CODES.INVALID_ROOM_ID, 'Not in the specified room');
            return;
        }

        // Update client user info if provided
        if (userInfo) {
            client.user = { ...client.user, ...userInfo };
        }

        // Broadcast cursor update to other users in the room
        this.broadcastToRoom(roomId, {
            type: 'cursor_update',
            payload: {
                x,
                y,
                userId: clientId,
                roomId,
                userInfo: client.user,
                activeTool
            },
            timestamp: Date.now()
        }, clientId);
    }

    private handleCursorLeft(clientId: string, message: any, _context: any): void {
        const { roomId } = message.payload || {};
        const client = this.clients.get(clientId);

        if (!client || !client.roomId || client.roomId !== roomId) {
            this.sendErrorMessage(clientId, ERROR_CODES.INVALID_ROOM_ID, 'Not in the specified room');
            return;
        }

        // Broadcast cursor left to other users in the room
        this.broadcastToRoom(roomId, {
            type: 'cursor_left',
            payload: {
                userId: clientId,
                roomId
            },
            timestamp: Date.now()
        }, clientId);
    }

    // Object synchronization message handlers
    private async handleObjectCreated(clientId: string, message: any, _context: any): Promise<void> {
        const { roomId, object } = message.payload || {};
        const client = this.clients.get(clientId);

        if (!client || !client.roomId || client.roomId !== roomId) {
            this.sendErrorMessage(clientId, ERROR_CODES.INVALID_ROOM_ID, 'Not in the specified room');
            return;
        }

        // Add user ID to the object if not present
        const objectWithUser = {
            ...object,
            userId: object.userId || clientId,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        try {
            // Persist the object to storage
            await canvasPersistence.createOrUpdateObject(roomId, objectWithUser);
            console.log(`💾 Persisted object ${objectWithUser.id} in room ${roomId}`);
        } catch (error) {
            console.error(`❌ Failed to persist object ${objectWithUser.id}:`, error);
            this.sendErrorMessage(clientId, ERROR_CODES.INTERNAL_ERROR, 'Failed to save object');
            return;
        }

        // Broadcast object creation to all users in the room (including sender)
        this.broadcastToRoom(roomId, {
            type: 'object_created',
            payload: {
                roomId,
                object: objectWithUser,
                userId: clientId
            },
            timestamp: Date.now()
        });
    }

    private async handleObjectUpdated(clientId: string, message: any, _context: any): Promise<void> {
        const { roomId, objectId, updates } = message.payload || {};
        const client = this.clients.get(clientId);

        if (!client || !client.roomId || client.roomId !== roomId) {
            this.sendErrorMessage(clientId, ERROR_CODES.INVALID_ROOM_ID, 'Not in the specified room');
            return;
        }

        // Add timestamp to updates
        const updatesWithTimestamp = {
            ...updates,
            updatedAt: Date.now()
        };

        try {
            // Persist the object update
            const success = await canvasPersistence.updateObject(roomId, objectId, updatesWithTimestamp);
            if (!success) {
                this.sendErrorMessage(clientId, ERROR_CODES.INVALID_MESSAGE, `Object ${objectId} not found`);
                return;
            }
            console.log(`💾 Updated object ${objectId} in room ${roomId}`);
        } catch (error) {
            console.error(`❌ Failed to update object ${objectId}:`, error);
            this.sendErrorMessage(clientId, ERROR_CODES.INTERNAL_ERROR, 'Failed to update object');
            return;
        }

        // Broadcast object update to all users in the room (including sender for confirmation)
        this.broadcastToRoom(roomId, {
            type: 'object_updated',
            payload: {
                roomId,
                objectId,
                updates: updatesWithTimestamp,
                userId: clientId
            },
            timestamp: Date.now()
        });
    }

    private async handleObjectMoved(clientId: string, message: any, _context: any): Promise<void> {
        const { roomId, objectId, x, y } = message.payload || {};
        const client = this.clients.get(clientId);

        if (!client || !client.roomId || client.roomId !== roomId) {
            this.sendErrorMessage(clientId, ERROR_CODES.INVALID_ROOM_ID, 'Not in the specified room');
            return;
        }

        try {
            // Persist the object position update
            const success = await canvasPersistence.updateObject(roomId, objectId, {
                x,
                y,
                updatedAt: Date.now()
            });
            if (!success) {
                this.sendErrorMessage(clientId, ERROR_CODES.INVALID_MESSAGE, `Object ${objectId} not found`);
                return;
            }
            console.log(`💾 Moved object ${objectId} to (${x}, ${y}) in room ${roomId}`);
        } catch (error) {
            console.error(`❌ Failed to move object ${objectId}:`, error);
            this.sendErrorMessage(clientId, ERROR_CODES.INTERNAL_ERROR, 'Failed to move object');
            return;
        }

        // Broadcast object movement to all users in the room (including sender)
        this.broadcastToRoom(roomId, {
            type: 'object_moved',
            payload: {
                roomId,
                objectId,
                x,
                y,
                userId: clientId
            },
            timestamp: Date.now()
        });
    }

    private async handleObjectDeleted(clientId: string, message: any, _context: any): Promise<void> {
        const { roomId, objectId } = message.payload || {};
        const client = this.clients.get(clientId);

        if (!client || !client.roomId || client.roomId !== roomId) {
            this.sendErrorMessage(clientId, ERROR_CODES.INVALID_ROOM_ID, 'Not in the specified room');
            return;
        }

        try {
            // Persist the object deletion
            const success = await canvasPersistence.deleteObject(roomId, objectId);
            if (!success) {
                this.sendErrorMessage(clientId, ERROR_CODES.INVALID_MESSAGE, `Object ${objectId} not found`);
                return;
            }
            console.log(`💾 Deleted object ${objectId} from room ${roomId}`);
        } catch (error) {
            console.error(`❌ Failed to delete object ${objectId}:`, error);
            this.sendErrorMessage(clientId, ERROR_CODES.INTERNAL_ERROR, 'Failed to delete object');
            return;
        }

        // Broadcast object deletion to all users in the room (including sender for confirmation)
        this.broadcastToRoom(roomId, {
            type: 'object_deleted',
            payload: {
                roomId,
                objectId,
                userId: clientId
            },
            timestamp: Date.now()
        });
    }

    private async handleCanvasStateRequested(clientId: string, message: any, _context: any): Promise<void> {
        const { roomId } = message.payload || {};
        const client = this.clients.get(clientId);

        if (!client || !client.roomId || client.roomId !== roomId) {
            this.sendErrorMessage(clientId, ERROR_CODES.INVALID_ROOM_ID, 'Not in the specified room');
            return;
        }

        try {
            // Load canvas state from persistence layer
            const canvasState = await canvasPersistence.getCanvasState(roomId);
            const objects = canvasState ? canvasState.objects : [];

            console.log(`📤 Sending canvas state for room ${roomId}: ${objects.length} objects`);

            this.sendToClient(clientId, {
                type: 'canvas_state_sync',
                payload: {
                    roomId,
                    objects,
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(`❌ Failed to load canvas state for room ${roomId}:`, error);
            this.sendErrorMessage(clientId, ERROR_CODES.INTERNAL_ERROR, 'Failed to load canvas state');
        }
    }

    private handleDisconnect(clientId: string, disconnectCode?: number, disconnectReason?: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Inform session manager about disconnect
        this.sessionManager.handleDisconnect(clientId, disconnectCode, disconnectReason);

        // Determine if this is a graceful disconnect or if we should allow reconnection
        const isGracefulDisconnect = disconnectCode === 1000 || disconnectCode === 1001;
        const shouldNotifyRoom = isGracefulDisconnect ||
            !this.sessionManager.shouldAllowReconnect(clientId);

        // Leave room if in one (only notify room members if it's a permanent disconnect)
        if (client.roomId) {
            if (shouldNotifyRoom) {
                this.leaveRoom(clientId, client.roomId);
            } else {
                // For temporary disconnects, just remove from room tracking but keep session
                const room = this.rooms.get(client.roomId);
                if (room) {
                    room.delete(clientId);
                    if (room.size === 0) {
                        this.rooms.delete(client.roomId);
                    }
                }
                console.log(`🔄 Client ${clientId} temporarily disconnected from room ${client.roomId} (reconnection possible)`);
            }
        }

        // Remove client and cleanup rate limit
        this.clients.delete(clientId);
        this.rateLimiter.resetLimit(clientId);

        console.log(`👋 Client cleanup completed for: ${clientId} (Graceful: ${isGracefulDisconnect})`);
    }

    private leaveRoom(clientId: string, roomId: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Remove from room tracking
        const room = this.rooms.get(roomId);
        if (room) {
            room.delete(clientId);
            if (room.size === 0) {
                this.rooms.delete(roomId);
                console.log(`🏠 Room ${roomId} deleted (empty)`);
            }
        }

        // Clear room from client
        client.roomId = undefined;

        console.log(`🚪 Client ${clientId} left room: ${roomId}`);

        // Notify remaining room members
        this.broadcastToRoom(roomId, {
            type: 'user_left',
            payload: {
                userId: clientId,
                roomId,
                userInfo: client.user,
                remainingUsers: room?.size || 0
            },
            timestamp: Date.now()
        });
    }

    private getRoomMembers(roomId: string): Array<{ clientId: string; user?: Client['user'] }> {
        const room = this.rooms.get(roomId);
        if (!room) return [];

        return Array.from(room).map(clientId => {
            const client = this.clients.get(clientId);
            return {
                clientId,
                user: client?.user
            };
        }).filter(member => member !== undefined);
    }

    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            console.log(`💓 Heartbeat check - ${this.clients.size} clients`);

            this.clients.forEach((client, clientId) => {
                if (!client.isAlive) {
                    console.log(`☠️ Terminating dead connection: ${clientId}`);
                    client.ws.terminate();
                    this.handleDisconnect(clientId);
                    return;
                }

                client.isAlive = false;
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.ping();
                }
            });

            // Cleanup expired rate limits
            this.rateLimiter.cleanup();
        }, 30000); // Check every 30 seconds
    }

    // Public utility methods
    public sendToClient(clientId: string, message: Message): boolean {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            client.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error(`❌ Error sending message to client ${clientId}:`, error);
            this.handleDisconnect(clientId);
            return false;
        }
    }

    public broadcastToAll(message: Message, excludeClientId?: string): number {
        let sentCount = 0;
        this.clients.forEach((client, clientId) => {
            if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
                if (this.sendToClient(clientId, message)) {
                    sentCount++;
                }
            }
        });
        return sentCount;
    }

    public broadcastToRoom(roomId: string | undefined, message: Message, excludeClientId?: string): number {
        if (!roomId) return 0;

        const room = this.rooms.get(roomId);
        if (!room) return 0;

        let sentCount = 0;
        room.forEach(clientId => {
            if (clientId !== excludeClientId) {
                if (this.sendToClient(clientId, message)) {
                    sentCount++;
                }
            }
        });

        return sentCount;
    }

    public sendErrorMessage(clientId: string, code: string, message: string, details?: any): void {
        const errorMessage = MessageProtocolValidator.createErrorMessage(code as any, message, details);
        this.sendToClient(clientId, errorMessage);
    }

    // Getters for monitoring
    public getClientCount(): number {
        return this.clients.size;
    }

    public getRoomCount(): number {
        return this.rooms.size;
    }

    public getClient(clientId: string): Client | undefined {
        return this.clients.get(clientId);
    }

    public getRooms(): string[] {
        return Array.from(this.rooms.keys());
    }

    public getClientsInRoom(roomId: string): string[] {
        const room = this.rooms.get(roomId);
        return room ? Array.from(room) : [];
    }

    public getProtocolInfo(): {
        version: string;
        supportedMessageTypes: readonly string[];
        registeredHandlers: string[];
        stats: {
            totalClients: number;
            totalRooms: number;
            rateLimitSettings: {
                maxMessages: number;
                windowMs: number;
            };
            sessionStats: {
                activeSessions: number;
                totalSessions: number;
                averageSessionDuration: number;
                totalReconnects: number;
                disconnectReasons: Record<string, number>;
            };
        };
    } {
        const sessionStats = this.sessionManager.getStatistics();

        return {
            version: PROTOCOL_VERSION,
            supportedMessageTypes: SUPPORTED_MESSAGE_TYPES,
            registeredHandlers: this.messageRouter.getRegisteredTypes(),
            stats: {
                totalClients: this.clients.size,
                totalRooms: this.rooms.size,
                rateLimitSettings: {
                    maxMessages: 100, // From constructor
                    windowMs: 60000
                },
                sessionStats: {
                    activeSessions: sessionStats.activeSessions,
                    totalSessions: sessionStats.totalSessions,
                    averageSessionDuration: Math.round(sessionStats.averageSessionDuration / 1000), // In seconds
                    totalReconnects: sessionStats.totalReconnects,
                    disconnectReasons: sessionStats.disconnectReasons
                }
            }
        };
    }

    // Cleanup method
    public async shutdown(): Promise<void> {
        console.log('🛑 Shutting down WebSocket Connection Manager...');

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // Close all connections
        this.clients.forEach((client, clientId) => {
            this.sendToClient(clientId, {
                type: 'server_shutdown',
                payload: { message: 'Server is shutting down' },
                timestamp: Date.now()
            });
            client.ws.close(1001, 'Server shutdown');
        });

        // Shutdown session manager
        this.sessionManager.shutdown();

        // Shutdown persistence service (save all pending changes)
        try {
            await canvasPersistence.shutdown();
        } catch (error) {
            console.error('❌ Error shutting down persistence service:', error);
        }

        // Clear data structures
        this.clients.clear();
        this.rooms.clear();

        this.wss.close(() => {
            console.log('✅ WebSocket server closed');
        });
    }
}
