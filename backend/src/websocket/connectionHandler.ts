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

export interface Client {
    id: string;
    ws: WebSocket;
    isAlive: boolean;
    joinedAt: Date;
    roomId?: string;
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

    constructor(server: Server) {
        this.wss = new WebSocketServer({ server });
        this.messageRouter = new MessageRouter();
        this.rateLimiter = new RateLimiter(100, 60000); // 100 messages per minute
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

        this.clients.set(clientId, client);
        console.log(`✅ Client connected: ${clientId}. Total clients: ${this.clients.size}`);

        // Send welcome message to new client with protocol version
        this.sendToClient(clientId, {
            type: 'connection_established',
            payload: {
                clientId,
                serverTime: Date.now(),
                connectedClients: this.clients.size,
                protocolVersion: PROTOCOL_VERSION
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
            console.log(`🔌 Client disconnected: ${clientId} (Code: ${code}, Reason: ${reason.toString()}). Total clients: ${this.clients.size - 1}`);
            this.handleDisconnect(clientId);
        });

        // Handle WebSocket errors
        ws.on('error', (error: Error) => {
            console.error(`❌ WebSocket error for client ${clientId}:`, error);
            this.handleDisconnect(clientId);
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

    private handleDisconnect(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Leave room if in one
        if (client.roomId) {
            this.leaveRoom(clientId, client.roomId);
        }

        // Remove client and cleanup rate limit
        this.clients.delete(clientId);
        this.rateLimiter.resetLimit(clientId);

        console.log(`👋 Client cleanup completed for: ${clientId}`);
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
        };
    } {
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
                }
            }
        };
    }

    // Cleanup method
    public shutdown(): void {
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

        // Clear data structures
        this.clients.clear();
        this.rooms.clear();

        this.wss.close(() => {
            console.log('✅ WebSocket server closed');
        });
    }
}
