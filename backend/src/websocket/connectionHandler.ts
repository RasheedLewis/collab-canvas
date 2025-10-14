import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'http';

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

    constructor(server: Server) {
        this.wss = new WebSocketServer({ server });
        this.initialize();
        this.startHeartbeat();
    }

    private initialize(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            this.handleConnection(ws);
        });

        console.log('📡 WebSocket Connection Manager initialized');
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

        // Send welcome message to new client
        this.sendToClient(clientId, {
            type: 'connection_established',
            payload: {
                clientId,
                serverTime: Date.now(),
                connectedClients: this.clients.size
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

        // Handle incoming messages
        ws.on('message', (data: Buffer) => {
            try {
                const message: Message = JSON.parse(data.toString());
                message.clientId = clientId; // Add client ID to message
                this.handleMessage(clientId, message);
            } catch (error) {
                console.error(`❌ Error parsing message from client ${clientId}:`, error);
                this.sendErrorMessage(clientId, 'Invalid message format');
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

    private handleMessage(clientId: string, message: Message): void {
        const client = this.clients.get(clientId);
        if (!client) {
            console.warn(`⚠️ Received message from unknown client: ${clientId}`);
            return;
        }

        console.log(`📨 Message from ${clientId} (${message.type}):`, message.payload ? Object.keys(message.payload) : 'no payload');

        // Add timestamp if not present
        if (!message.timestamp) {
            message.timestamp = Date.now();
        }

        switch (message.type) {
            case 'ping':
                this.handlePing(clientId);
                break;

            case 'join_room':
                this.handleJoinRoom(clientId, message);
                break;

            case 'leave_room':
                this.handleLeaveRoom(clientId, message);
                break;

            case 'auth':
                this.handleAuthentication(clientId, message);
                break;

            case 'heartbeat':
                this.handleHeartbeat(clientId);
                break;

            default:
                // Forward unhandled messages to other clients in the same room
                this.broadcastToRoom(client.roomId, message, clientId);
                break;
        }
    }

    private handlePing(clientId: string): void {
        this.sendToClient(clientId, {
            type: 'pong',
            timestamp: Date.now()
        });
    }

    private handleJoinRoom(clientId: string, message: Message): void {
        const { roomId, userInfo } = message.payload || {};

        if (!roomId || typeof roomId !== 'string') {
            this.sendErrorMessage(clientId, 'Valid room ID is required');
            return;
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

    private handleLeaveRoom(clientId: string, message: Message): void {
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

    private handleAuthentication(clientId: string, message: Message): void {
        const { token, userInfo } = message.payload || {};

        if (!token) {
            this.sendErrorMessage(clientId, 'Authentication token required');
            return;
        }

        const client = this.clients.get(clientId);
        if (!client) return;

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

    private handleHeartbeat(clientId: string): void {
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

        // Remove client
        this.clients.delete(clientId);

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

    public sendErrorMessage(clientId: string, error: string): void {
        this.sendToClient(clientId, {
            type: 'error',
            payload: { error, code: 'WEBSOCKET_ERROR' },
            timestamp: Date.now()
        });
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
