/**
 * API utilities for WebSocket communication and HTTP requests
 * This module provides helper functions and configurations for the CollabCanvas API
 */

// Environment configuration
export const API_CONFIG = {
    // WebSocket URL - falls back to localhost for development
    WS_URL: import.meta.env.VITE_WS_URL ||
        (import.meta.env.PROD
            ? `wss://${window.location.host}`
            : 'ws://localhost:3000'),

    // HTTP API base URL
    BASE_URL: import.meta.env.VITE_API_URL ||
        (import.meta.env.PROD
            ? `https://${window.location.host}/api`
            : 'http://localhost:3000/api'),

    // WebSocket configuration
    WS_CONFIG: {
        reconnectInterval: 3000, // 3 seconds
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000, // 30 seconds
    },

    // Cursor synchronization configuration
    CURSOR_CONFIG: {
        throttleInterval: 100, // ~10fps for cursor movement (balanced performance/bandwidth)
        batchSize: 5, // Batch cursor updates for efficiency
        maxDistance: 5, // Minimum pixel distance to trigger update (reduce noise)
        inactivityTimeout: 3000, // Hide cursor after 3 seconds of inactivity
    }
};

// Room ID utilities
export const ROOM_UTILS = {
    /**
     * Generate a random room ID
     */
    generateRoomId: (): string => {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    },

    /**
     * Validate room ID format
     */
    isValidRoomId: (roomId: string): boolean => {
        return typeof roomId === 'string' &&
            roomId.length >= 3 &&
            roomId.length <= 50 &&
            /^[a-zA-Z0-9-_]+$/.test(roomId);
    },

    /**
     * Extract room ID from URL
     */
    extractRoomIdFromUrl: (url = window.location.pathname): string | null => {
        const match = url.match(/\/room\/([^\/]+)/);
        return match ? match[1] : null;
    },

    /**
     * Generate room URL
     */
    generateRoomUrl: (roomId: string): string => {
        return `/room/${roomId}`;
    }
};

// HTTP API helper functions
export const HTTP_API = {
    /**
     * Get WebSocket server status
     */
    getWebSocketStatus: async (): Promise<{
        connectedClients: number;
        activeRooms: number;
        rooms: string[];
        timestamp: string;
    }> => {
        const response = await fetch(`${API_CONFIG.BASE_URL}/websocket/status`);
        if (!response.ok) {
            throw new Error(`Failed to get WebSocket status: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * Get room information
     */
    getRoomInfo: async (roomId: string): Promise<{
        roomId: string;
        clientCount: number;
        clients: string[];
    }> => {
        const response = await fetch(`${API_CONFIG.BASE_URL}/websocket/room/${encodeURIComponent(roomId)}`);
        if (!response.ok) {
            throw new Error(`Failed to get room info: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * Health check
     */
    healthCheck: async (): Promise<{
        status: string;
        timestamp: string;
        clients: number;
        rooms: number;
    }> => {
        const response = await fetch(`${API_CONFIG.BASE_URL.replace('/api', '')}/health`);
        if (!response.ok) {
            throw new Error(`Health check failed: ${response.statusText}`);
        }
        return response.json();
    }
};

// WebSocket message builders
export const MESSAGE_BUILDERS = {
    /**
     * Create a ping message
     */
    ping: () => ({
        type: 'ping' as const,
        timestamp: Date.now()
    }),

    /**
     * Create a join room message
     */
    joinRoom: (roomId: string, userInfo?: any) => ({
        type: 'join_room' as const,
        payload: { roomId, userInfo },
        timestamp: Date.now()
    }),

    /**
     * Create a leave room message
     */
    leaveRoom: (roomId?: string) => ({
        type: 'leave_room' as const,
        payload: { roomId },
        timestamp: Date.now()
    }),

    /**
     * Create an auth message
     */
    auth: (token: string, userInfo?: any) => ({
        type: 'auth' as const,
        payload: { token, userInfo },
        timestamp: Date.now()
    }),

    /**
     * Create a heartbeat message
     */
    heartbeat: () => ({
        type: 'heartbeat' as const,
        timestamp: Date.now()
    }),

    /**
     * Create cursor movement message
     */
    cursorMoved: (x: number, y: number, roomId: string) => ({
        type: 'cursor_moved' as const,
        payload: { x, y, roomId },
        timestamp: Date.now()
    }),

    /**
     * Create cursor update message (with user info and tool)
     */
    cursorUpdate: (x: number, y: number, roomId: string, userInfo?: any, activeTool?: string) => ({
        type: 'cursor_update' as const,
        payload: { x, y, roomId, userInfo, activeTool },
        timestamp: Date.now()
    }),

    /**
     * Create cursor left message
     */
    cursorLeft: (roomId: string) => ({
        type: 'cursor_left' as const,
        payload: { roomId },
        timestamp: Date.now()
    }),

    /**
     * Create a custom message
     */
    custom: (type: string, payload?: any) => ({
        type,
        payload,
        timestamp: Date.now()
    })
};

// Connection state utilities
export const CONNECTION_UTILS = {
    /**
     * Check if connection state is active
     */
    isActiveConnection: (state: string): boolean => {
        return state === 'connected' || state === 'connecting' || state === 'reconnecting';
    },

    /**
     * Check if connection can be retried
     */
    canRetryConnection: (state: string): boolean => {
        return state === 'disconnected' || state === 'error';
    },

    /**
     * Get user-friendly connection status message
     */
    getConnectionStatusMessage: (state: string, reconnectAttempts: number = 0): string => {
        switch (state) {
            case 'connecting':
                return 'Connecting to server...';
            case 'connected':
                return 'Connected';
            case 'disconnected':
                return 'Disconnected from server';
            case 'reconnecting':
                return `Reconnecting... (Attempt ${reconnectAttempts})`;
            case 'error':
                return 'Connection error';
            default:
                return 'Unknown connection state';
        }
    }
};

// Error handling utilities
export const ERROR_UTILS = {
    /**
     * Parse WebSocket close codes
     */
    parseCloseCode: (code: number): string => {
        switch (code) {
            case 1000:
                return 'Normal closure';
            case 1001:
                return 'Server shutdown';
            case 1002:
                return 'Protocol error';
            case 1003:
                return 'Unsupported data type';
            case 1006:
                return 'Connection lost';
            case 1011:
                return 'Server error';
            case 1012:
                return 'Server restart';
            case 1013:
                return 'Server overloaded';
            case 1014:
                return 'Bad gateway';
            case 1015:
                return 'TLS handshake failure';
            default:
                return `Unknown close code: ${code}`;
        }
    },

    /**
     * Create user-friendly error messages
     */
    createUserFriendlyError: (error: string): string => {
        const errorMap: Record<string, string> = {
            'WebSocket connection error': 'Unable to connect to the collaboration server. Please check your internet connection.',
            'Invalid message format': 'Received invalid data from server. Please refresh the page.',
            'Authentication token required': 'Please sign in to join the collaboration session.',
            'Room ID is required': 'Please specify a room to join.',
            'Valid room ID is required': 'The room ID format is invalid.',
            'Maximum reconnection attempts reached': 'Lost connection to server. Please refresh the page to reconnect.',
            'Failed to parse server message': 'Received corrupted data from server. Please refresh the page.',
            'Cannot send message: not connected': 'Not connected to server. Attempting to reconnect...'
        };

        return errorMap[error] || error;
    }
};

// Development utilities (only available in dev mode)
export const DEV_UTILS = import.meta.env.DEV ? {
    /**
     * Log WebSocket message for debugging
     */
    logMessage: (direction: 'sent' | 'received', message: any): void => {
        const emoji = direction === 'sent' ? '📤' : '📥';
        console.log(`${emoji} WebSocket ${direction}:`, message);
    },

    /**
     * Simulate connection issues for testing
     */
    simulateConnectionIssue: (ws: WebSocket | null): void => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.warn('🧪 Simulating connection issue for testing...');
            ws.close(1006, 'Simulated connection loss');
        }
    },

    /**
     * Get connection debug info
     */
    getDebugInfo: (ws: WebSocket | null): object => {
        return {
            readyState: ws?.readyState,
            url: ws?.url,
            protocol: ws?.protocol,
            extensions: ws?.extensions,
            bufferedAmount: ws?.bufferedAmount
        };
    }
} : {};

// Export everything as a default API object for convenience
export default {
    config: API_CONFIG,
    room: ROOM_UTILS,
    http: HTTP_API,
    messages: MESSAGE_BUILDERS,
    connection: CONNECTION_UTILS,
    errors: ERROR_UTILS,
    dev: DEV_UTILS
};
