/**
 * WebSocket Connection Service
 * 
 * This service manages the WebSocket connection and integrates with the connection store.
 * It provides a centralized way to manage real-time communication across the application.
 */

import { useWebSocket } from '../hooks/useWebSocket';
import { useConnectionStore } from '../store/connectionStore';
import type {
    WebSocketUser,
    UserJoinedPayload,
    UserLeftPayload,
    ErrorPayload,
    RoomJoinedPayload,
    ConnectionEstablishedPayload
} from '../types/websocket';
import API from '../lib/api';

// Service state
interface ConnectionServiceState {
    wsHook: ReturnType<typeof useWebSocket> | null;
    isInitialized: boolean;
    unsubscribeFunctions: Array<() => void>;
}

class ConnectionService {
    private state: ConnectionServiceState = {
        wsHook: null,
        isInitialized: false,
        unsubscribeFunctions: []
    };

    /**
     * Initialize the connection service
     */
    initialize(): void {
        if (this.state.isInitialized) {
            console.log('🔌 Connection service already initialized');
            return;
        }

        console.log('🔌 Initializing WebSocket connection service...');

        // Get store config
        const store = useConnectionStore.getState();

        // Initialize WebSocket hook
        this.state.wsHook = useWebSocket({
            url: store.config.url,
            reconnectInterval: store.config.reconnectInterval,
            maxReconnectAttempts: store.config.maxReconnectAttempts,
            heartbeatInterval: API.config.WS_CONFIG.heartbeatInterval
        });

        // Set up store integration
        this.setupStoreIntegration();

        this.state.isInitialized = true;
        store.setInitialized(true);

        // Auto-connect if enabled
        if (store.config.autoConnect) {
            setTimeout(() => {
                this.connect();
            }, 500);
        }
    }

    /**
     * Set up integration between WebSocket hook and connection store
     */
    private setupStoreIntegration(): void {
        if (!this.state.wsHook) return;

        const store = useConnectionStore.getState();
        const { wsHook } = this.state;

        // Connection state changes
        this.state.unsubscribeFunctions.push(
            wsHook.onConnectionChange((connectionState) => {
                store.setConnectionState(connectionState);
                console.log(`🔗 Connection state: ${connectionState}`);

                // Update stats
                if (connectionState === 'connecting') {
                    store.updateStats({
                        connectionAttempts: store.stats.connectionAttempts + 1
                    });
                } else if (connectionState === 'reconnecting') {
                    store.updateStats({
                        reconnectionAttempts: store.stats.reconnectionAttempts + 1
                    });
                }
            })
        );

        // Message handling
        this.state.unsubscribeFunctions.push(
            wsHook.onMessage((message) => {
                // Update message stats
                store.updateStats({
                    messagesReceived: store.stats.messagesReceived + 1,
                    lastActivity: Date.now()
                });

                // Handle specific message types
                switch (message.type) {
                    case 'connection_established': {
                        const payload = message.payload as ConnectionEstablishedPayload;
                        store.setClientId(payload.clientId);
                        useConnectionStore.setState({ serverTime: payload.serverTime });
                        console.log(`✅ Connected with client ID: ${payload.clientId}`);
                        break;
                    }

                    case 'room_joined': {
                        const payload = message.payload as RoomJoinedPayload;
                        store.setCurrentRoom({
                            id: payload.roomId,
                            memberCount: payload.roomMembers?.length || 1,
                            members: payload.roomMembers?.map(member => ({
                                clientId: member.clientId,
                                user: member.user,
                                joinedAt: Date.now(),
                                isCurrentUser: member.clientId === store.clientId
                            })) || [],
                            joinedAt: Date.now()
                        });
                        console.log(`🏠 Joined room: ${payload.roomId}`);
                        break;
                    }

                    case 'room_left': {
                        store.setCurrentRoom(null);
                        useConnectionStore.setState({ connectedUsers: new Map() });
                        console.log('🚪 Left room');
                        break;
                    }
                }
            })
        );

        // User joined events
        this.state.unsubscribeFunctions.push(
            wsHook.onUserJoined((payload: UserJoinedPayload) => {
                store.addUser({
                    clientId: payload.userId,
                    user: payload.userInfo,
                    joinedAt: Date.now()
                });

                // Update room member count
                const currentRoom = store.currentRoom;
                if (currentRoom) {
                    store.setCurrentRoom({
                        ...currentRoom,
                        memberCount: payload.roomMembers || currentRoom.memberCount + 1
                    });
                }

                console.log(`👋 User joined: ${payload.userInfo?.name || payload.userId}`);
            })
        );

        // User left events
        this.state.unsubscribeFunctions.push(
            wsHook.onUserLeft((payload: UserLeftPayload) => {
                store.removeUser(payload.userId);

                // Update room member count
                const currentRoom = store.currentRoom;
                if (currentRoom) {
                    store.setCurrentRoom({
                        ...currentRoom,
                        memberCount: Math.max(0, currentRoom.memberCount - 1)
                    });
                }

                console.log(`👋 User left: ${payload.userInfo?.name || payload.userId}`);
            })
        );

        // Error events
        this.state.unsubscribeFunctions.push(
            wsHook.onError((payload: ErrorPayload) => {
                const friendlyError = API.errors.createUserFriendlyError(payload.error);
                store.setError(friendlyError);
                console.error('❌ WebSocket error:', friendlyError);
            })
        );
    }

    /**
     * Connect to the WebSocket server
     */
    connect(): void {
        if (!this.state.wsHook) {
            console.error('❌ Cannot connect: WebSocket hook not initialized');
            return;
        }

        console.log('🔄 Connecting to WebSocket server...');
        this.state.wsHook.connect();
    }

    /**
     * Disconnect from the WebSocket server
     */
    disconnect(): void {
        if (!this.state.wsHook) return;

        console.log('🔌 Disconnecting from WebSocket server...');
        this.state.wsHook.disconnect();

        // Reset store state
        const store = useConnectionStore.getState();
        store.setConnectionState('disconnected');
        store.setClientId(null);
        store.setCurrentRoom(null);
        useConnectionStore.setState({
            connectedUsers: new Map(),
            serverTime: null
        });
    }

    /**
     * Reconnect to the WebSocket server
     */
    reconnect(): void {
        console.log('🔄 Reconnecting to WebSocket server...');
        this.disconnect();
        setTimeout(() => this.connect(), 1000);
    }

    /**
     * Join a room
     */
    joinRoom(roomId: string, userInfo?: WebSocketUser): void {
        if (!this.state.wsHook?.isConnected) {
            const store = useConnectionStore.getState();
            store.setError('Cannot join room: not connected to server');
            return;
        }

        console.log(`🏠 Joining room: ${roomId}`);
        this.state.wsHook.joinRoom(roomId, userInfo);
    }

    /**
     * Leave the current room
     */
    leaveRoom(): void {
        if (!this.state.wsHook) return;

        console.log('🚪 Leaving current room...');
        this.state.wsHook.leaveRoom();
    }

    /**
     * Authenticate with the server
     */
    authenticate(token: string, userInfo?: WebSocketUser): void {
        if (!this.state.wsHook?.isConnected) {
            const store = useConnectionStore.getState();
            store.setError('Cannot authenticate: not connected to server');
            return;
        }

        console.log('🔐 Authenticating with server...');
        this.state.wsHook.authenticate(token, userInfo);
    }

    /**
     * Send a custom message
     */
    sendMessage(type: string, payload?: any): boolean {
        if (!this.state.wsHook?.isConnected) {
            console.warn('❌ Cannot send message: not connected to server');
            return false;
        }

        const success = this.state.wsHook.sendMessage({ type, payload });

        if (success) {
            // Update stats
            const store = useConnectionStore.getState();
            store.updateStats({
                messagesSent: store.stats.messagesSent + 1,
                lastActivity: Date.now()
            });
        }

        return success;
    }

    /**
     * Send a ping to the server
     */
    ping(): void {
        if (this.state.wsHook) {
            this.state.wsHook.sendPing();
        }
    }

    /**
     * Get connection information
     */
    getConnectionInfo(): {
        isConnected: boolean;
        connectionState: string;
        clientId: string | null;
        roomId: string | null;
        reconnectAttempts: number;
        lastError: string | null;
    } {
        const store = useConnectionStore.getState();
        return {
            isConnected: store.isConnected,
            connectionState: store.connectionState,
            clientId: store.clientId,
            roomId: store.currentRoom?.id || null,
            reconnectAttempts: this.state.wsHook?.reconnectAttempts || 0,
            lastError: store.lastError
        };
    }

    /**
     * Update connection configuration
     */
    updateConfig(config: Partial<Parameters<typeof useWebSocket>[0]>): void {
        const store = useConnectionStore.getState();
        store.setConfig({
            url: config.url || store.config.url,
            autoConnect: store.config.autoConnect,
            maxReconnectAttempts: config.maxReconnectAttempts || store.config.maxReconnectAttempts,
            reconnectInterval: config.reconnectInterval || store.config.reconnectInterval
        });
    }

    /**
     * Cleanup the service
     */
    cleanup(): void {
        console.log('🧹 Cleaning up connection service...');

        // Cleanup event listeners
        this.state.unsubscribeFunctions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                console.warn('Error during cleanup:', error);
            }
        });
        this.state.unsubscribeFunctions = [];

        // Disconnect WebSocket
        this.disconnect();

        // Reset state
        this.state = {
            wsHook: null,
            isInitialized: false,
            unsubscribeFunctions: []
        };

        // Reset store
        const store = useConnectionStore.getState();
        store.reset();
        store.setInitialized(false);
    }

    /**
     * Get initialization status
     */
    isInitialized(): boolean {
        return this.state.isInitialized;
    }
}

// Create singleton instance
const connectionService = new ConnectionService();

// Export service instance and interface
export default connectionService;
export type { ConnectionService };
export { ConnectionService };
