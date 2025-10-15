import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import type {
    WebSocketConnectionState,
    WebSocketUser
} from '../types/websocket';
import API from '../lib/api';

// Connected user information
export interface ConnectedUser {
    clientId: string;
    user?: WebSocketUser;
    joinedAt: number;
    isCurrentUser?: boolean;
}

// Room information
export interface RoomInfo {
    id: string;
    name?: string;
    memberCount: number;
    members: ConnectedUser[];
    joinedAt: number;
}

// Connection statistics
export interface ConnectionStats {
    connectionAttempts: number;
    reconnectionAttempts: number;
    messagesReceived: number;
    messagesSent: number;
    uptime: number;
    lastActivity: number;
}

// Connection store state interface
interface ConnectionState {
    // WebSocket connection state
    connectionState: WebSocketConnectionState;
    isConnected: boolean;
    clientId: string | null;
    serverTime: number | null;
    lastError: string | null;

    // Current room state
    currentRoom: RoomInfo | null;

    // Connected users tracking
    connectedUsers: Map<string, ConnectedUser>;

    // Connection statistics
    stats: ConnectionStats;

    // Connection configuration
    config: {
        url: string;
        autoConnect: boolean;
        maxReconnectAttempts: number;
        reconnectInterval: number;
    };

    // External connection management (handled by service)
    isInitialized: boolean;

    // User management
    updateUserInfo: (userInfo: WebSocketUser) => void;

    // Internal state management
    setConnectionState: (state: WebSocketConnectionState) => void;
    setClientId: (clientId: string | null) => void;
    setCurrentRoom: (room: RoomInfo | null) => void;
    addUser: (user: ConnectedUser) => void;
    removeUser: (clientId: string) => void;
    updateUser: (clientId: string, updates: Partial<ConnectedUser>) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
    updateStats: (updates: Partial<ConnectionStats>) => void;

    // Configuration actions
    setConfig: (config: Partial<ConnectionState['config']>) => void;

    // Utility actions
    setInitialized: (initialized: boolean) => void;
    reset: () => void;

    // Getters
    getUserById: (clientId: string) => ConnectedUser | undefined;
    getCurrentUserInfo: () => ConnectedUser | undefined;
    getRoomMemberCount: () => number;
    getConnectionStatus: () => string;
}

// Initial state
const initialStats: ConnectionStats = {
    connectionAttempts: 0,
    reconnectionAttempts: 0,
    messagesReceived: 0,
    messagesSent: 0,
    uptime: 0,
    lastActivity: Date.now()
};

// Create the connection store
export const useConnectionStore = create<ConnectionState>()(
    subscribeWithSelector(
        devtools(
            (set, get) => ({
                // Initial state
                connectionState: 'disconnected',
                isConnected: false,
                clientId: null,
                serverTime: null,
                lastError: null,
                currentRoom: null,
                connectedUsers: new Map(),
                stats: { ...initialStats },
                config: {
                    url: API.config.WS_URL,
                    autoConnect: true,
                    maxReconnectAttempts: 10,
                    reconnectInterval: 3000
                },
                isInitialized: false,

                // User management actions

                // User management
                updateUserInfo: (userInfo: WebSocketUser) => {
                    const { clientId, connectedUsers } = get();
                    if (clientId) {
                        const updatedUsers = new Map(connectedUsers);
                        const currentUser = updatedUsers.get(clientId);
                        if (currentUser) {
                            updatedUsers.set(clientId, {
                                ...currentUser,
                                user: userInfo
                            });
                            set({ connectedUsers: updatedUsers });
                        }
                    }
                },

                // Internal state management
                setConnectionState: (connectionState: WebSocketConnectionState) => {
                    set({
                        connectionState,
                        isConnected: connectionState === 'connected'
                    });
                },

                setClientId: (clientId: string | null) => {
                    set({ clientId });

                    // Add current user to connected users if we have a client ID
                    if (clientId) {
                        const { connectedUsers } = get();
                        const updatedUsers = new Map(connectedUsers);
                        updatedUsers.set(clientId, {
                            clientId,
                            joinedAt: Date.now(),
                            isCurrentUser: true
                        });
                        set({ connectedUsers: updatedUsers });
                    }
                },

                setCurrentRoom: (room: RoomInfo | null) => {
                    set({ currentRoom: room });
                },

                addUser: (user: ConnectedUser) => {
                    const { connectedUsers } = get();
                    const updatedUsers = new Map(connectedUsers);
                    updatedUsers.set(user.clientId, user);
                    set({ connectedUsers: updatedUsers });
                },

                removeUser: (clientId: string) => {
                    const { connectedUsers } = get();
                    const updatedUsers = new Map(connectedUsers);
                    updatedUsers.delete(clientId);
                    set({ connectedUsers: updatedUsers });
                },

                updateUser: (clientId: string, updates: Partial<ConnectedUser>) => {
                    const { connectedUsers } = get();
                    const user = connectedUsers.get(clientId);
                    if (user) {
                        const updatedUsers = new Map(connectedUsers);
                        updatedUsers.set(clientId, { ...user, ...updates });
                        set({ connectedUsers: updatedUsers });
                    }
                },

                setError: (error: string | null) => {
                    set({ lastError: error });
                },

                clearError: () => {
                    set({ lastError: null });
                },

                updateStats: (updates: Partial<ConnectionStats>) => {
                    set((state) => ({
                        stats: { ...state.stats, ...updates }
                    }));
                },

                // Configuration actions
                setConfig: (configUpdates: Partial<ConnectionState['config']>) => {
                    set((state) => ({
                        config: { ...state.config, ...configUpdates }
                    }));
                },

                // Utility actions
                setInitialized: (initialized: boolean) => {
                    set({ isInitialized: initialized });
                },

                reset: () => {
                    set({
                        connectionState: 'disconnected',
                        isConnected: false,
                        clientId: null,
                        serverTime: null,
                        lastError: null,
                        currentRoom: null,
                        connectedUsers: new Map(),
                        stats: { ...initialStats }
                    });
                },

                // Getters
                getUserById: (clientId: string) => {
                    return get().connectedUsers.get(clientId);
                },

                getCurrentUserInfo: () => {
                    const { clientId, connectedUsers } = get();
                    return clientId ? connectedUsers.get(clientId) : undefined;
                },

                getRoomMemberCount: () => {
                    return get().connectedUsers.size;
                },

                getConnectionStatus: () => {
                    const { connectionState, stats } = get();
                    return API.connection.getConnectionStatusMessage(connectionState, stats.reconnectionAttempts);
                }
            }),
            {
                name: 'connection-store'
            }
        )
    )
);

// Selector hooks for easier access to specific parts of the state
export const useConnectionState = () => useConnectionStore((state) => state.connectionState);
export const useIsConnected = () => useConnectionStore((state) => state.isConnected);
export const useClientId = () => useConnectionStore((state) => state.clientId);
export const useCurrentRoom = () => useConnectionStore((state) => state.currentRoom);
export const useConnectedUsers = () => useConnectionStore((state) => Array.from(state.connectedUsers.values()));
export const useConnectionError = () => useConnectionStore((state) => state.lastError);
export const useConnectionStats = () => useConnectionStore((state) => state.stats);

// Action hooks for internal state management
export const useConnectionActions = () => useConnectionStore((state) => ({
    setConnectionState: state.setConnectionState,
    setClientId: state.setClientId,
    setCurrentRoom: state.setCurrentRoom,
    addUser: state.addUser,
    removeUser: state.removeUser,
    updateUser: state.updateUser,
    setError: state.setError,
    clearError: state.clearError,
    updateStats: state.updateStats,
    setConfig: state.setConfig,
    reset: state.reset
}));

// Combined hooks for common use cases
export const useConnectionStatus = () => {
    const connectionState = useConnectionState();
    const isConnected = useIsConnected();
    const error = useConnectionError();
    const stats = useConnectionStats();

    return {
        state: connectionState,
        isConnected,
        error,
        status: API.connection.getConnectionStatusMessage(connectionState, stats.reconnectionAttempts),
        canRetry: API.connection.canRetryConnection(connectionState)
    };
};

export const useRoomInfo = () => {
    const currentRoom = useCurrentRoom();
    const connectedUsers = useConnectedUsers();
    const memberCount = useConnectionStore((state) => state.getRoomMemberCount());

    return {
        room: currentRoom,
        users: connectedUsers,
        memberCount,
        isInRoom: !!currentRoom
    };
};

// Store is already exported above
export default useConnectionStore;
