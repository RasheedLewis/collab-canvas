import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
    WebSocketConnectionState,
    WebSocketMessage,
    WebSocketUser,
    WebSocketConfig,
    WebSocketHookReturn,
    MessageCallback,
    ConnectionStateCallback,
    UserJoinedCallback,
    UserLeftCallback,
    ErrorCallback,
    UserJoinedPayload,
    UserLeftPayload,
    ErrorPayload,
    ConnectionEstablishedPayload,
    RoomJoinedPayload,
    AuthSuccessPayload,
    ReconnectSuccessPayload
} from '../types/websocket';

// Default configuration
const DEFAULT_CONFIG: Required<WebSocketConfig> = {
    url: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
    reconnectInterval: 3000, // 3 seconds
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000, // 30 seconds
    protocols: []
};

export function useWebSocket(config: WebSocketConfig): WebSocketHookReturn {
    // Merge config with defaults
    const fullConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

    // Connection state
    const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('disconnected');
    const [clientId, setClientId] = useState<string | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [serverTime, setServerTime] = useState<number | null>(null);
    const [reconnectToken, setReconnectToken] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // WebSocket instance and references
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isIntentionalClose = useRef(false);

    // Event listeners storage
    const messageListenersRef = useRef<Set<MessageCallback>>(new Set());
    const connectionListenersRef = useRef<Set<ConnectionStateCallback>>(new Set());
    const userJoinedListenersRef = useRef<Set<UserJoinedCallback>>(new Set());
    const userLeftListenersRef = useRef<Set<UserLeftCallback>>(new Set());
    const errorListenersRef = useRef<Set<ErrorCallback>>(new Set());

    // Utility function to emit to all listeners
    const emitToListeners = useCallback(<T>(listeners: Set<(payload: T) => void>, payload: T) => {
        listeners.forEach(callback => {
            try {
                callback(payload);
            } catch (error) {
                console.error('Error in WebSocket event listener:', error);
            }
        });
    }, []);

    // Update connection state and notify listeners
    const updateConnectionState = useCallback((newState: WebSocketConnectionState) => {
        setConnectionState(newState);
        emitToListeners(connectionListenersRef.current, newState);

        if (newState === 'connected') {
            setReconnectAttempts(0);
            setLastError(null);
        }
    }, [emitToListeners]);

    // Clear all timeouts
    const clearTimeouts = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = null;
        }
    }, []);

    // Start heartbeat
    const startHeartbeat = useCallback(() => {
        clearTimeout(heartbeatTimeoutRef.current!);
        heartbeatTimeoutRef.current = setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                sendMessage({
                    type: 'heartbeat',
                    timestamp: Date.now()
                });
                startHeartbeat(); // Schedule next heartbeat
            }
        }, fullConfig.heartbeatInterval);
    }, [fullConfig.heartbeatInterval]);

    // Handle incoming messages
    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const message: WebSocketMessage = JSON.parse(event.data);

            // Emit to message listeners
            emitToListeners(messageListenersRef.current, message);

            // Handle specific message types
            switch (message.type) {
                case 'connection_established': {
                    const payload = message.payload as ConnectionEstablishedPayload;
                    setClientId(payload.clientId);
                    setServerTime(payload.serverTime);
                    if (payload.reconnectToken) {
                        setReconnectToken(payload.reconnectToken);
                    }
                    updateConnectionState('connected');
                    startHeartbeat();
                    console.log(`🔗 WebSocket connected. Client ID: ${payload.clientId}`);
                    break;
                }

                case 'room_joined': {
                    const payload = message.payload as RoomJoinedPayload;
                    setRoomId(payload.roomId);
                    console.log(`🏠 Joined room: ${payload.roomId}`);
                    break;
                }

                case 'room_left': {
                    setRoomId(null);
                    console.log('🚪 Left room');
                    break;
                }

                case 'user_joined': {
                    const payload = message.payload as UserJoinedPayload;
                    emitToListeners(userJoinedListenersRef.current, payload);
                    console.log(`👋 User joined: ${payload.userInfo?.name || payload.userId}`);
                    break;
                }

                case 'user_left': {
                    const payload = message.payload as UserLeftPayload;
                    emitToListeners(userLeftListenersRef.current, payload);
                    console.log(`👋 User left: ${payload.userInfo?.name || payload.userId}`);
                    break;
                }

                case 'auth_success': {
                    const payload = message.payload as AuthSuccessPayload;
                    console.log(`🔐 Authentication successful for: ${payload.user?.email || 'unknown'}`);
                    break;
                }

                case 'reconnect_success': {
                    const payload = message.payload as ReconnectSuccessPayload;
                    setSessionId(payload.sessionId);
                    setReconnectToken(payload.newReconnectToken);
                    if (payload.roomId) {
                        setRoomId(payload.roomId);
                    }
                    setReconnectAttempts(payload.reconnectAttempts);
                    console.log(`🔄 Reconnection successful. Session: ${payload.sessionId}`);
                    break;
                }

                case 'error': {
                    const payload = message.payload as ErrorPayload;
                    setLastError(payload.error);
                    emitToListeners(errorListenersRef.current, payload);
                    console.error('❌ WebSocket error:', payload.error);
                    break;
                }

                case 'server_shutdown': {
                    console.warn('🛑 Server is shutting down');
                    break;
                }

                case 'pong':
                case 'heartbeat_ack': {
                    // Handle server responses to keep connection alive
                    break;
                }

                default:
                    // Handle custom messages or forward to listeners
                    break;
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            setLastError('Failed to parse server message');
        }
    }, [emitToListeners, updateConnectionState, startHeartbeat]);

    // Handle connection open
    const handleOpen = useCallback(() => {
        console.log('🔗 WebSocket connection opened');
        updateConnectionState('connected');
    }, [updateConnectionState]);

    // Handle connection close
    const handleClose = useCallback((event: CloseEvent) => {
        console.log(`🔌 WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        clearTimeouts();
        setClientId(null);

        if (!isIntentionalClose.current) {
            updateConnectionState('disconnected');

            // Attempt reconnection if within retry limits
            if (reconnectAttempts < fullConfig.maxReconnectAttempts) {
                updateConnectionState('reconnecting');
                setReconnectAttempts(prev => prev + 1);

                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log(`🔄 Reconnection attempt ${reconnectAttempts + 1}/${fullConfig.maxReconnectAttempts}`);
                    // Use reconnect method if we have a token, otherwise regular connect
                    if (reconnectToken) {
                        reconnect(reconnectToken);
                    } else {
                        connect();
                    }
                }, fullConfig.reconnectInterval);
            } else {
                setLastError('Maximum reconnection attempts reached');
                updateConnectionState('error');
            }
        } else {
            updateConnectionState('disconnected');
            isIntentionalClose.current = false; // Reset for next connection
        }
    }, [reconnectAttempts, fullConfig.maxReconnectAttempts, fullConfig.reconnectInterval, updateConnectionState, clearTimeouts]);

    // Handle connection error
    const handleError = useCallback((event: Event) => {
        console.error('❌ WebSocket connection error:', event);
        setLastError('WebSocket connection error');
        updateConnectionState('error');
    }, [updateConnectionState]);

    // Send message function
    const sendMessage = useCallback((message: WebSocketMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
                const messageWithTimestamp = {
                    ...message,
                    timestamp: message.timestamp || Date.now()
                };
                wsRef.current.send(JSON.stringify(messageWithTimestamp));
                return true;
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                setLastError('Failed to send message');
                return false;
            }
        } else {
            console.warn('Cannot send message: WebSocket not connected');
            setLastError('Cannot send message: not connected');
            return false;
        }
    }, []);

    // Connect function
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        if (wsRef.current?.readyState === WebSocket.CONNECTING) {
            console.log('WebSocket connection in progress');
            return;
        }

        try {
            console.log(`🔄 Connecting to WebSocket: ${fullConfig.url}`);
            updateConnectionState('connecting');

            wsRef.current = new WebSocket(fullConfig.url, fullConfig.protocols);
            wsRef.current.onopen = handleOpen;
            wsRef.current.onmessage = handleMessage;
            wsRef.current.onclose = handleClose;
            wsRef.current.onerror = handleError;
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            setLastError('Failed to create WebSocket connection');
            updateConnectionState('error');
        }
    }, [fullConfig.url, fullConfig.protocols, updateConnectionState, handleOpen, handleMessage, handleClose, handleError]);

    // Disconnect function
    const disconnect = useCallback(() => {
        console.log('🔌 Disconnecting WebSocket...');
        isIntentionalClose.current = true;
        clearTimeouts();

        if (wsRef.current) {
            wsRef.current.close(1000, 'Client disconnect');
            wsRef.current = null;
        }

        setClientId(null);
        setRoomId(null);
        setReconnectAttempts(0);
        setReconnectToken(null);
        setSessionId(null);
        updateConnectionState('disconnected');
    }, [clearTimeouts, updateConnectionState]);

    // Reconnect with optional token
    const reconnect = useCallback((providedToken?: string) => {
        const tokenToUse = providedToken || reconnectToken;

        if (!tokenToUse) {
            console.log('🔄 No reconnect token available, performing regular connection...');
            connect();
            return;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        if (wsRef.current?.readyState === WebSocket.CONNECTING) {
            console.log('WebSocket connection in progress');
            return;
        }

        try {
            console.log(`🔄 Reconnecting to WebSocket with token: ${tokenToUse.substring(0, 8)}...`);
            updateConnectionState('reconnecting');

            wsRef.current = new WebSocket(fullConfig.url, fullConfig.protocols);

            // Set up event handlers
            wsRef.current.onopen = () => {
                console.log('🔄 WebSocket reconnection established, sending reconnect message...');

                // Send reconnect message with token
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'reconnect',
                        payload: {
                            reconnectToken: tokenToUse,
                            lastSessionId: sessionId
                        },
                        timestamp: Date.now()
                    }));
                }
            };

            wsRef.current.onmessage = (event) => {
                handleMessage(event);
            };

            wsRef.current.onclose = (event) => {
                handleClose(event);
            };

            wsRef.current.onerror = (error) => {
                console.error('❌ WebSocket reconnection error:', error);
                setLastError('Reconnection failed');
                updateConnectionState('error');
            };

        } catch (error) {
            console.error('❌ Failed to create WebSocket reconnection:', error);
            setLastError('Failed to reconnect');
            updateConnectionState('error');
        }
    }, [reconnectToken, sessionId, fullConfig.url, fullConfig.protocols, connect, updateConnectionState, handleMessage, handleClose]);

    // Room management functions
    const joinRoom = useCallback((roomId: string, userInfo?: WebSocketUser) => {
        sendMessage({
            type: 'join_room',
            payload: { roomId, userInfo }
        });
    }, [sendMessage]);

    const leaveRoom = useCallback((roomId?: string) => {
        sendMessage({
            type: 'leave_room',
            payload: { roomId }
        });
    }, [sendMessage]);

    // Authentication function
    const authenticate = useCallback((token: string, userInfo?: WebSocketUser) => {
        sendMessage({
            type: 'auth',
            payload: { token, userInfo }
        });
    }, [sendMessage]);

    // Send ping function
    const sendPing = useCallback(() => {
        sendMessage({ type: 'ping' });
    }, [sendMessage]);

    // Event listener registration functions
    const onMessage = useCallback((callback: MessageCallback) => {
        messageListenersRef.current.add(callback);
        return () => messageListenersRef.current.delete(callback);
    }, []);

    const onConnectionChange = useCallback((callback: ConnectionStateCallback) => {
        connectionListenersRef.current.add(callback);
        return () => connectionListenersRef.current.delete(callback);
    }, []);

    const onUserJoined = useCallback((callback: UserJoinedCallback) => {
        userJoinedListenersRef.current.add(callback);
        return () => userJoinedListenersRef.current.delete(callback);
    }, []);

    const onUserLeft = useCallback((callback: UserLeftCallback) => {
        userLeftListenersRef.current.add(callback);
        return () => userLeftListenersRef.current.delete(callback);
    }, []);

    const onError = useCallback((callback: ErrorCallback) => {
        errorListenersRef.current.add(callback);
        return () => errorListenersRef.current.delete(callback);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    // Computed values
    const isConnected = connectionState === 'connected';

    return {
        // Connection state
        connectionState,
        isConnected,
        clientId,
        roomId,

        // Connection methods
        connect,
        disconnect,
        reconnect,

        // Room management
        joinRoom,
        leaveRoom,

        // Authentication
        authenticate,

        // Message sending
        sendMessage,
        sendPing,

        // Event listeners
        onMessage,
        onConnectionChange,
        onUserJoined,
        onUserLeft,
        onError,

        // Connection info
        lastError,
        reconnectAttempts,
        serverTime,
        reconnectToken,
        sessionId
    };
}
