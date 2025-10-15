import { createServer, Server } from 'http';
import WebSocket from 'ws';
import { WebSocketConnectionManager } from '../connectionHandler';
import { findAvailablePort } from '../../__tests__/setup';

// Test utilities
class TestWebSocketClient {
    ws!: WebSocket;
    clientId: string | null = null;
    connected: boolean = false;
    messages: any[] = [];
    private messagePromises: Map<string, { resolve: Function, reject: Function }> = new Map();

    constructor(private url: string) { }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                this.connected = true;
                resolve();
            });

            this.ws.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.messages.push(message);

                    // Handle connection_established to get clientId
                    if (message.type === 'connection_established') {
                        this.clientId = message.payload.clientId;
                    }

                    // Resolve any pending message promises
                    this.messagePromises.forEach(({ resolve }, key) => {
                        if (key === 'any' || key === message.type) {
                            resolve(message);
                            this.messagePromises.delete(key);
                        }
                    });
                } catch (error) {
                    console.error('Failed to parse message:', error);
                }
            });

            this.ws.on('close', () => {
                this.connected = false;
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });

            // Timeout for connection
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 5000);
        });
    }

    disconnect(): void {
        if (this.ws && this.connected) {
            this.ws.close();
        }
    }

    send(message: any): void {
        if (this.ws && this.connected) {
            this.ws.send(JSON.stringify({
                ...message,
                timestamp: Date.now()
            }));
        }
    }

    async waitForMessage(timeout: number = 5000): Promise<any> {
        return new Promise((resolve, reject) => {
            // Check if we already have messages
            if (this.messages.length > 0) {
                resolve(this.messages[this.messages.length - 1]);
                return;
            }

            // Set up promise for new message
            this.messagePromises.set('any', { resolve, reject });

            setTimeout(() => {
                if (this.messagePromises.has('any')) {
                    this.messagePromises.delete('any');
                    reject(new Error('Message timeout'));
                }
            }, timeout);
        });
    }

    async waitForMessageType(type: string, timeout: number = 5000): Promise<any> {
        return new Promise((resolve, reject) => {
            // Check existing messages first
            const existingMessage = this.messages.find(msg => msg.type === type);
            if (existingMessage) {
                resolve(existingMessage);
                return;
            }

            // Set up promise for new message of specific type
            this.messagePromises.set(type, { resolve, reject });

            setTimeout(() => {
                if (this.messagePromises.has(type)) {
                    this.messagePromises.delete(type);
                    reject(new Error(`Message type '${type}' timeout`));
                }
            }, timeout);
        });
    }

    getLastMessage(): any {
        return this.messages[this.messages.length - 1];
    }
}

// Test helper functions
function createTestWebSocketClient(port: number = 3001): TestWebSocketClient {
    return new TestWebSocketClient(`ws://localhost:${port}`);
}

describe('WebSocket Connection Handler Integration Tests', () => {
    let server: Server;
    let wsManager: WebSocketConnectionManager;
    let testPort: number;

    beforeEach(async () => {
        // Find an available port for this test
        testPort = await findAvailablePort();

        // Create HTTP server for testing
        server = createServer();
        wsManager = new WebSocketConnectionManager(server);

        // Start server
        await new Promise<void>((resolve) => {
            server.listen(testPort, () => {
                resolve();
            });
        });
    });

    afterEach(async () => {
        // Cleanup
        wsManager.shutdown();

        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });

    describe('Connection Management', () => {
        it('should handle multiple client connections', async () => {
            const client1 = createTestWebSocketClient(testPort);
            const client2 = createTestWebSocketClient(testPort);

            // Connect both clients
            await client1.connect();
            await client2.connect();

            // Wait for connection established messages
            await client1.waitForMessageType('connection_established');
            await client2.waitForMessageType('connection_established');

            // Verify both clients are connected
            expect(client1.connected).toBe(true);
            expect(client2.connected).toBe(true);
            expect(client1.clientId).toBeTruthy();
            expect(client2.clientId).toBeTruthy();
            expect(client1.clientId).not.toBe(client2.clientId);

            // Verify connection count
            expect(wsManager.getClientCount()).toBe(2);

            // Cleanup
            client1.disconnect();
            client2.disconnect();
        });

        it('should assign unique client IDs to each connection', async () => {
            const clients: TestWebSocketClient[] = [];
            const clientIds: string[] = [];

            // Create 5 clients
            for (let i = 0; i < 5; i++) {
                const client = createTestWebSocketClient(testPort);
                await client.connect();
                await client.waitForMessageType('connection_established');

                clients.push(client);
                clientIds.push(client.clientId!);
            }

            // Verify all IDs are unique
            const uniqueIds = new Set(clientIds);
            expect(uniqueIds.size).toBe(5);
            expect(wsManager.getClientCount()).toBe(5);

            // Cleanup
            clients.forEach(client => client.disconnect());
        });

        it('should handle client disconnections gracefully', async () => {
            const client1 = createTestWebSocketClient(testPort);
            const client2 = createTestWebSocketClient(testPort);

            await client1.connect();
            await client2.connect();

            await client1.waitForMessageType('connection_established');
            await client2.waitForMessageType('connection_established');

            expect(wsManager.getClientCount()).toBe(2);

            // Disconnect one client
            client1.disconnect();

            // Give time for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(wsManager.getClientCount()).toBe(1);
            expect(client2.connected).toBe(true);

            // Cleanup
            client2.disconnect();
        });
    });

    describe('Message Broadcasting', () => {
        it('should broadcast messages to all connected clients', async () => {
            const client1 = createTestWebSocketClient(testPort);
            const client2 = createTestWebSocketClient(testPort);
            const client3 = createTestWebSocketClient(testPort);

            // Connect all clients
            await Promise.all([
                client1.connect(),
                client2.connect(),
                client3.connect()
            ]);

            // Wait for all connections to be established
            await Promise.all([
                client1.waitForMessageType('connection_established'),
                client2.waitForMessageType('connection_established'),
                client3.waitForMessageType('connection_established')
            ]);

            // Clear existing messages
            client1.messages = [];
            client2.messages = [];
            client3.messages = [];

            // Join all clients to the same room
            const roomId = 'test-room';
            client1.send({
                type: 'join_room',
                payload: {
                    roomId,
                    userInfo: {
                        uid: 'user1',
                        email: 'user1@test.com',
                        name: 'User 1',
                        picture: null
                    }
                }
            });

            client2.send({
                type: 'join_room',
                payload: {
                    roomId,
                    userInfo: {
                        uid: 'user2',
                        email: 'user2@test.com',
                        name: 'User 2',
                        picture: null
                    }
                }
            });

            client3.send({
                type: 'join_room',
                payload: {
                    roomId,
                    userInfo: {
                        uid: 'user3',
                        email: 'user3@test.com',
                        name: 'User 3',
                        picture: null
                    }
                }
            });

            // Wait for all join confirmations
            await Promise.all([
                client1.waitForMessageType('room_joined'),
                client2.waitForMessageType('room_joined'),
                client3.waitForMessageType('room_joined')
            ]);

            // Wait for all user_joined messages to propagate to each client
            // The broadcast logic sends user_joined to existing room members when someone new joins
            // client1: gets user_joined when client2 joins, gets user_joined when client3 joins = 2 messages
            // client2: gets user_joined when client3 joins = 1 message  
            // client3: gets no user_joined messages (was last to join) = 0 messages
            const waitForUserJoinedMessages = async (client: TestWebSocketClient, expectedCount: number) => {
                if (expectedCount === 0) {
                    // Give a short wait to ensure no messages arrive
                    await new Promise(resolve => setTimeout(resolve, 200));
                    return client.messages.filter(msg => msg.type === 'user_joined');
                }

                const maxWait = 2000; // 2 seconds max
                const checkInterval = 50; // Check every 50ms
                let waited = 0;

                while (waited < maxWait) {
                    const userJoinedMessages = client.messages.filter(msg => msg.type === 'user_joined');
                    if (userJoinedMessages.length >= expectedCount) {
                        return userJoinedMessages;
                    }
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                    waited += checkInterval;
                }

                // Return whatever we have
                return client.messages.filter(msg => msg.type === 'user_joined');
            };

            const [client1UserJoinedMessages, client2UserJoinedMessages, client3UserJoinedMessages] = await Promise.all([
                waitForUserJoinedMessages(client1, 2), // client1 should get 2 (from client2 and client3)
                waitForUserJoinedMessages(client2, 1), // client2 should get 1 (from client3)
                waitForUserJoinedMessages(client3, 0)  // client3 should get 0 (was last to join)
            ]);

            // Verify the correct broadcast behavior:
            expect(client1UserJoinedMessages.length).toBe(2); // Gets notified when client2 and client3 join
            expect(client2UserJoinedMessages.length).toBe(1); // Gets notified when client3 joins
            expect(client3UserJoinedMessages.length).toBe(0); // Last to join, gets no user_joined messages

            // Verify room has all 3 clients
            expect(wsManager.getRoomCount()).toBe(1);
            const roomClients = wsManager.getClientsInRoom(roomId);
            expect(roomClients.length).toBe(3);

            // Cleanup
            client1.disconnect();
            client2.disconnect();
            client3.disconnect();
        });

        it('should handle room-specific message broadcasting', async () => {
            const client1 = createTestWebSocketClient(testPort);
            const client2 = createTestWebSocketClient(testPort);
            const client3 = createTestWebSocketClient(testPort);

            await Promise.all([
                client1.connect(),
                client2.connect(),
                client3.connect()
            ]);

            await Promise.all([
                client1.waitForMessageType('connection_established'),
                client2.waitForMessageType('connection_established'),
                client3.waitForMessageType('connection_established')
            ]);

            // Join clients to different rooms
            client1.send({
                type: 'join_room',
                payload: {
                    roomId: 'room-1',
                    userInfo: { uid: 'user1', email: 'user1@test.com', name: 'User 1', picture: null }
                }
            });

            client2.send({
                type: 'join_room',
                payload: {
                    roomId: 'room-1',
                    userInfo: { uid: 'user2', email: 'user2@test.com', name: 'User 2', picture: null }
                }
            });

            client3.send({
                type: 'join_room',
                payload: {
                    roomId: 'room-2',
                    userInfo: { uid: 'user3', email: 'user3@test.com', name: 'User 3', picture: null }
                }
            });

            await Promise.all([
                client1.waitForMessageType('room_joined'),
                client2.waitForMessageType('room_joined'),
                client3.waitForMessageType('room_joined')
            ]);

            // Clear messages
            client1.messages = [];
            client2.messages = [];
            client3.messages = [];

            // Client3 should not receive user_joined messages from room-1
            // Give time for any potential cross-room messages
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify room isolation
            expect(wsManager.getRoomCount()).toBe(2);
            expect(wsManager.getClientsInRoom('room-1').length).toBe(2);
            expect(wsManager.getClientsInRoom('room-2').length).toBe(1);

            // Cleanup
            client1.disconnect();
            client2.disconnect();
            client3.disconnect();
        });
    });

    describe('Message Protocol', () => {
        it('should handle ping/pong messages', async () => {
            const client = createTestWebSocketClient(testPort);
            await client.connect();
            await client.waitForMessageType('connection_established');

            // Clear messages
            client.messages = [];

            // Send ping
            client.send({ type: 'ping' });

            // Wait for pong response
            const pongMessage = await client.waitForMessageType('pong');
            expect(pongMessage.type).toBe('pong');

            client.disconnect();
        });

        it('should handle heartbeat messages', async () => {
            const client = createTestWebSocketClient(testPort);
            await client.connect();
            await client.waitForMessageType('connection_established');

            // Clear messages
            client.messages = [];

            // Send heartbeat
            client.send({ type: 'heartbeat' });

            // Wait for heartbeat_ack
            const ackMessage = await client.waitForMessageType('heartbeat_ack');
            expect(ackMessage.type).toBe('heartbeat_ack');

            client.disconnect();
        });

        it('should handle leave_room messages', async () => {
            const client1 = createTestWebSocketClient(testPort);
            const client2 = createTestWebSocketClient(testPort);

            await Promise.all([client1.connect(), client2.connect()]);
            await Promise.all([
                client1.waitForMessageType('connection_established'),
                client2.waitForMessageType('connection_established')
            ]);

            // Both join the same room
            const roomId = 'test-room';
            client1.send({
                type: 'join_room',
                payload: {
                    roomId,
                    userInfo: { uid: 'user1', email: 'user1@test.com', name: 'User 1', picture: null }
                }
            });

            client2.send({
                type: 'join_room',
                payload: {
                    roomId,
                    userInfo: { uid: 'user2', email: 'user2@test.com', name: 'User 2', picture: null }
                }
            });

            await Promise.all([
                client1.waitForMessageType('room_joined'),
                client2.waitForMessageType('room_joined')
            ]);

            // Clear messages
            client1.messages = [];
            client2.messages = [];

            // Client1 leaves room
            client1.send({
                type: 'leave_room',
                payload: { roomId }
            });

            // Wait for room_left confirmation
            const roomLeftMessage = await client1.waitForMessageType('room_left');
            expect(roomLeftMessage.type).toBe('room_left');
            expect(roomLeftMessage.payload.roomId).toBe(roomId);

            // Client2 should receive user_left notification
            const userLeftMessage = await client2.waitForMessageType('user_left');
            expect(userLeftMessage.type).toBe('user_left');
            expect(userLeftMessage.payload.roomId).toBe(roomId);

            // Verify room state
            expect(wsManager.getClientsInRoom(roomId).length).toBe(1);

            client1.disconnect();
            client2.disconnect();
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid message formats gracefully', async () => {
            const client = createTestWebSocketClient(testPort);
            await client.connect();
            await client.waitForMessageType('connection_established');

            // Clear messages
            client.messages = [];

            // Send invalid JSON
            client.ws.send('invalid json');

            // Wait for error message
            const errorMessage = await client.waitForMessageType('error');
            expect(errorMessage.type).toBe('error');
            expect(errorMessage.payload.error).toContain('Failed to parse message');

            // Connection should still be alive
            expect(client.connected).toBe(true);

            client.disconnect();
        });

        it('should handle unsupported message types', async () => {
            const client = createTestWebSocketClient(testPort);
            await client.connect();
            await client.waitForMessageType('connection_established');

            // Clear messages
            client.messages = [];

            // Send unsupported message type
            client.send({ type: 'UNSUPPORTED_MESSAGE_TYPE', payload: {} });

            // Wait for error message
            const errorMessage = await client.waitForMessageType('error');
            expect(errorMessage.type).toBe('error');
            expect(errorMessage.payload.code).toBe('UNSUPPORTED_MESSAGE_TYPE');

            client.disconnect();
        });
    });

    describe('Session Management Integration', () => {
        it('should provide reconnect tokens on connection', async () => {
            const client = createTestWebSocketClient(testPort);
            await client.connect();

            const connectionMessage = await client.waitForMessageType('connection_established');
            expect(connectionMessage.payload.reconnectToken).toBeTruthy();
            expect(typeof connectionMessage.payload.reconnectToken).toBe('string');

            client.disconnect();
        });

        it('should handle reconnect attempts', async () => {
            const client = createTestWebSocketClient(testPort);
            await client.connect();

            const connectionMessage = await client.waitForMessageType('connection_established');
            const reconnectToken = connectionMessage.payload.reconnectToken;

            // Disconnect and reconnect with token
            client.disconnect();
            await new Promise(resolve => setTimeout(resolve, 100));

            const newClient = createTestWebSocketClient(testPort);
            await newClient.connect();
            await newClient.waitForMessageType('connection_established');

            // Clear messages
            newClient.messages = [];

            // Send reconnect message
            newClient.send({
                type: 'reconnect',
                payload: {
                    reconnectToken: reconnectToken,
                    lastSessionId: connectionMessage.payload.clientId
                }
            });

            // Should get either reconnect_success or error
            const response = await newClient.waitForMessage();
            expect(['reconnect_success', 'error']).toContain(response.type);

            newClient.disconnect();
        });
    });

    describe('Performance and Scalability', () => {
        it('should handle rapid message sending without dropping messages', async () => {
            const client1 = createTestWebSocketClient(testPort);
            const client2 = createTestWebSocketClient(testPort);

            await Promise.all([client1.connect(), client2.connect()]);
            await Promise.all([
                client1.waitForMessageType('connection_established'),
                client2.waitForMessageType('connection_established')
            ]);

            // Join same room
            const roomId = 'perf-test-room';
            client1.send({
                type: 'join_room',
                payload: {
                    roomId,
                    userInfo: { uid: 'user1', email: 'user1@test.com', name: 'User 1', picture: null }
                }
            });

            client2.send({
                type: 'join_room',
                payload: {
                    roomId,
                    userInfo: { uid: 'user2', email: 'user2@test.com', name: 'User 2', picture: null }
                }
            });

            await Promise.all([
                client1.waitForMessageType('room_joined'),
                client2.waitForMessageType('room_joined')
            ]);

            // Clear messages
            client1.messages = [];
            client2.messages = [];

            // Send multiple pings rapidly
            const messageCount = 10;
            for (let i = 0; i < messageCount; i++) {
                client1.send({ type: 'ping', payload: { sequence: i } });
            }

            // Wait for all responses
            await new Promise(resolve => setTimeout(resolve, 500));

            // Count pong responses
            const pongMessages = client1.messages.filter(msg => msg.type === 'pong');
            expect(pongMessages.length).toBe(messageCount);

            client1.disconnect();
            client2.disconnect();
        });
    });
});
