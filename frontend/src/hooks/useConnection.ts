/**
 * useConnection Hook
 * 
 * React hook that provides a clean interface to the WebSocket connection service
 * and integrates with the connection store for reactive state updates.
 */

import { useEffect, useCallback, useMemo } from 'react';
import connectionService from '../services/connectionService';
import {
    useConnectionState,
    useIsConnected,
    useClientId,
    useCurrentRoom,
    useConnectedUsers,
    useConnectionError,
    useConnectionStats,
    useConnectionStatus,
    useRoomInfo
} from '../store/connectionStore';
import type { WebSocketUser } from '../types/websocket';

export interface UseConnectionReturn {
    // Connection state (reactive)
    connectionState: string;
    isConnected: boolean;
    clientId: string | null;
    error: string | null;
    status: string;
    canRetry: boolean;

    // Room information (reactive)
    room: ReturnType<typeof useCurrentRoom>;
    users: ReturnType<typeof useConnectedUsers>;
    memberCount: number;
    isInRoom: boolean;

    // Statistics (reactive)
    stats: ReturnType<typeof useConnectionStats>;

    // Connection actions
    connect: () => void;
    disconnect: () => void;
    reconnect: () => void;

    // Room actions
    joinRoom: (roomId: string, userInfo?: WebSocketUser) => void;
    leaveRoom: () => void;

    // Authentication
    authenticate: (token: string, userInfo?: WebSocketUser) => void;

    // Messaging
    sendMessage: (type: string, payload?: any) => boolean;
    ping: () => void;

    // Utilities
    clearError: () => void;
    getConnectionInfo: () => ReturnType<typeof connectionService.getConnectionInfo>;
}

/**
 * Main connection hook
 */
export function useConnection(): UseConnectionReturn {
    // Reactive state from store
    const connectionState = useConnectionState();
    const isConnected = useIsConnected();
    const clientId = useClientId();
    const error = useConnectionError();
    const stats = useConnectionStats();
    const { status, canRetry } = useConnectionStatus();
    const { room, users, memberCount, isInRoom } = useRoomInfo();

    // Initialize service on first use
    useEffect(() => {
        if (!connectionService.isInitialized()) {
            connectionService.initialize();
        }

        // Cleanup on unmount (for the last component using the service)
        return () => {
            // Note: We don't cleanup here because other components might still be using it
            // Cleanup should be handled at the app level or when explicitly requested
        };
    }, []);

    // Connection actions
    const connect = useCallback(() => {
        connectionService.connect();
    }, []);

    const disconnect = useCallback(() => {
        connectionService.disconnect();
    }, []);

    const reconnect = useCallback(() => {
        connectionService.reconnect();
    }, []);

    // Room actions
    const joinRoom = useCallback((roomId: string, userInfo?: WebSocketUser) => {
        connectionService.joinRoom(roomId, userInfo);
    }, []);

    const leaveRoom = useCallback(() => {
        connectionService.leaveRoom();
    }, []);

    // Authentication
    const authenticate = useCallback((token: string, userInfo?: WebSocketUser) => {
        connectionService.authenticate(token, userInfo);
    }, []);

    // Messaging
    const sendMessage = useCallback((type: string, payload?: any) => {
        return connectionService.sendMessage(type, payload);
    }, []);

    const ping = useCallback(() => {
        connectionService.ping();
    }, []);

    // Utilities
    const clearError = useCallback(() => {
        // Clear error from store
        import('../store/connectionStore').then(({ useConnectionStore }) => {
            useConnectionStore.getState().clearError();
        });
    }, []);

    const getConnectionInfo = useCallback(() => {
        return connectionService.getConnectionInfo();
    }, []);

    // Return memoized object to prevent unnecessary re-renders
    return useMemo(() => ({
        // Connection state
        connectionState,
        isConnected,
        clientId,
        error,
        status,
        canRetry,

        // Room information
        room,
        users,
        memberCount,
        isInRoom,

        // Statistics
        stats,

        // Connection actions
        connect,
        disconnect,
        reconnect,

        // Room actions
        joinRoom,
        leaveRoom,

        // Authentication
        authenticate,

        // Messaging
        sendMessage,
        ping,

        // Utilities
        clearError,
        getConnectionInfo
    }), [
        connectionState,
        isConnected,
        clientId,
        error,
        status,
        canRetry,
        room,
        users,
        memberCount,
        isInRoom,
        stats,
        connect,
        disconnect,
        reconnect,
        joinRoom,
        leaveRoom,
        authenticate,
        sendMessage,
        ping,
        clearError,
        getConnectionInfo
    ]);
}

/**
 * Hook for connection status only (lightweight)
 */
export function useConnectionStatusOnly() {
    const { state, isConnected, error, status, canRetry } = useConnectionStatus();

    return {
        state,
        isConnected,
        error,
        status,
        canRetry
    };
}

/**
 * Hook for room information only
 */
export function useRoomInfoOnly() {
    return useRoomInfo();
}

/**
 * Hook for connection actions only
 */
export function useConnectionActionsOnly() {
    const connect = useCallback(() => connectionService.connect(), []);
    const disconnect = useCallback(() => connectionService.disconnect(), []);
    const reconnect = useCallback(() => connectionService.reconnect(), []);

    return { connect, disconnect, reconnect };
}

/**
 * Hook for room actions only
 */
export function useRoomActionsOnly() {
    const joinRoom = useCallback((roomId: string, userInfo?: WebSocketUser) => {
        connectionService.joinRoom(roomId, userInfo);
    }, []);

    const leaveRoom = useCallback(() => {
        connectionService.leaveRoom();
    }, []);

    return { joinRoom, leaveRoom };
}

/**
 * Hook for messaging only
 */
export function useMessagingOnly() {
    const sendMessage = useCallback((type: string, payload?: any) => {
        return connectionService.sendMessage(type, payload);
    }, []);

    const ping = useCallback(() => {
        connectionService.ping();
    }, []);

    return { sendMessage, ping };
}

/**
 * Hook that provides connection service access for advanced usage
 */
export function useConnectionService() {
    return connectionService;
}

export default useConnection;
