// WebSocket connection states
export type WebSocketConnectionState =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'reconnecting'
    | 'error';

// WebSocket message types
export interface WebSocketMessage {
    type: string;
    payload?: any;
    timestamp?: number;
    clientId?: string;
}

// User information for WebSocket communication
export interface WebSocketUser {
    uid: string;
    email: string | null;
    name: string | null;
    picture: string | null;
    displayName?: string;
    avatarColor?: string;
}

// Connection events
export interface ConnectionEstablishedPayload {
    clientId: string;
    serverTime: number;
    connectedClients: number;
    protocolVersion: string;
    reconnectToken?: string;
}

export interface RoomJoinedPayload {
    roomId: string;
    userId: string;
    roomMembers: Array<{
        clientId: string;
        user?: WebSocketUser;
    }>;
}

export interface UserJoinedPayload {
    userId: string;
    roomId: string;
    userInfo?: WebSocketUser;
    roomMembers: number;
}

export interface UserLeftPayload {
    userId: string;
    roomId: string;
    userInfo?: WebSocketUser;
    remainingUsers: number;
}

export interface AuthSuccessPayload {
    userId: string;
    user?: WebSocketUser;
}

export interface ErrorPayload {
    error: string;
    code?: string;
    details?: Record<string, any>;
}

export interface ReconnectSuccessPayload {
    sessionRecovered: boolean;
    roomId?: string;
    userInfo?: WebSocketUser;
    sessionId: string;
    reconnectAttempts: number;
    newReconnectToken: string;
}

// Message type definitions with their payloads
export interface PingMessage extends WebSocketMessage {
    type: 'ping';
}

export interface PongMessage extends WebSocketMessage {
    type: 'pong';
}

export interface JoinRoomMessage extends WebSocketMessage {
    type: 'join_room';
    payload: {
        roomId: string;
        userInfo?: WebSocketUser;
    };
}

export interface LeaveRoomMessage extends WebSocketMessage {
    type: 'leave_room';
    payload: {
        roomId?: string;
    };
}

export interface AuthMessage extends WebSocketMessage {
    type: 'auth';
    payload: {
        token: string;
        userInfo?: WebSocketUser;
    };
}

export interface HeartbeatMessage extends WebSocketMessage {
    type: 'heartbeat';
}

export interface ReconnectMessage extends WebSocketMessage {
    type: 'reconnect';
    payload: {
        reconnectToken: string;
        lastSessionId?: string;
    };
}

export interface ConnectionEstablishedMessage extends WebSocketMessage {
    type: 'connection_established';
    payload: ConnectionEstablishedPayload;
}

export interface RoomJoinedMessage extends WebSocketMessage {
    type: 'room_joined';
    payload: RoomJoinedPayload;
}

export interface UserJoinedMessage extends WebSocketMessage {
    type: 'user_joined';
    payload: UserJoinedPayload;
}

export interface UserLeftMessage extends WebSocketMessage {
    type: 'user_left';
    payload: UserLeftPayload;
}

export interface AuthSuccessMessage extends WebSocketMessage {
    type: 'auth_success';
    payload: AuthSuccessPayload;
}

export interface ErrorMessage extends WebSocketMessage {
    type: 'error';
    payload: ErrorPayload;
}

export interface ReconnectSuccessMessage extends WebSocketMessage {
    type: 'reconnect_success';
    payload: ReconnectSuccessPayload;
}

export interface ServerShutdownMessage extends WebSocketMessage {
    type: 'server_shutdown';
    payload: {
        message: string;
    };
}

// WebSocket hook configuration
export interface WebSocketConfig {
    url: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
    protocols?: string[];
}

// WebSocket hook return type
export interface WebSocketHookReturn {
    // Connection state
    connectionState: WebSocketConnectionState;
    isConnected: boolean;
    clientId: string | null;
    roomId: string | null;

    // Connection methods
    connect: () => void;
    disconnect: () => void;
    reconnect: (reconnectToken?: string) => void;

    // Room management
    joinRoom: (roomId: string, userInfo?: WebSocketUser) => void;
    leaveRoom: (roomId?: string) => void;

    // Authentication
    authenticate: (token: string, userInfo?: WebSocketUser) => void;

    // Message sending
    sendMessage: (message: WebSocketMessage) => boolean;
    sendPing: () => void;

    // Event listeners
    onMessage: (callback: (message: WebSocketMessage) => void) => () => void;
    onConnectionChange: (callback: (state: WebSocketConnectionState) => void) => () => void;
    onUserJoined: (callback: (payload: UserJoinedPayload) => void) => () => void;
    onUserLeft: (callback: (payload: UserLeftPayload) => void) => () => void;
    onError: (callback: (error: ErrorPayload) => void) => () => void;

    // Connection info
    lastError: string | null;
    reconnectAttempts: number;
    serverTime: number | null;
    reconnectToken: string | null;
    sessionId: string | null;
}

// Event callback types
export type MessageCallback = (message: WebSocketMessage) => void;
export type ConnectionStateCallback = (state: WebSocketConnectionState) => void;
export type UserJoinedCallback = (payload: UserJoinedPayload) => void;
export type UserLeftCallback = (payload: UserLeftPayload) => void;
export type ErrorCallback = (payload: ErrorPayload) => void;
