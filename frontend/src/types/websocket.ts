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

// Cursor synchronization messages
export interface CursorMovedMessage extends WebSocketMessage {
    type: 'cursor_moved';
    payload: {
        x: number;
        y: number;
        roomId: string;
        userId?: string;
    };
}

export interface CursorUpdateMessage extends WebSocketMessage {
    type: 'cursor_update';
    payload: {
        x: number;
        y: number;
        roomId: string;
        userId?: string;
        userInfo?: WebSocketUser;
        activeTool?: string;
    };
}

export interface CursorLeftMessage extends WebSocketMessage {
    type: 'cursor_left';
    payload: {
        roomId: string;
        userId?: string;
    };
}

// Cursor event payloads for callbacks
export interface CursorMovedPayload {
    x: number;
    y: number;
    userId: string;
    roomId: string;
    userInfo?: WebSocketUser;
}

export interface CursorUpdatePayload {
    x: number;
    y: number;
    userId: string;
    roomId: string;
    userInfo?: WebSocketUser;
    activeTool?: string;
}

export interface CursorLeftPayload {
    userId: string;
    roomId: string;
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
    // Cursor event listeners
    onCursorMoved: (callback: (payload: CursorMovedPayload) => void) => () => void;
    onCursorUpdate: (callback: (payload: CursorUpdatePayload) => void) => () => void;
    onCursorLeft: (callback: (payload: CursorLeftPayload) => void) => () => void;

    // Object synchronization event listeners
    onObjectCreated: (callback: ObjectCreatedCallback) => () => void;
    onObjectUpdated: (callback: ObjectUpdatedCallback) => () => void;
    onObjectMoved: (callback: ObjectMovedCallback) => () => void;
    onObjectDeleted: (callback: ObjectDeletedCallback) => () => void;
    onCanvasStateSync: (callback: CanvasStateSyncCallback) => () => void;

    // Connection info
    lastError: string | null;
    reconnectAttempts: number;
    serverTime: number | null;
    reconnectToken: string | null;
    sessionId: string | null;
}

// Event callback types
export type MessageCallback = (message: WebSocketMessage) => void;

// Object synchronization message types (matching backend protocol)
export interface ObjectCreatedMessage extends WebSocketMessage {
    type: 'object_created';
    payload: {
        roomId: string;
        object: {
            id: string;
            x: number;
            y: number;
            type: 'rectangle' | 'circle' | 'text';
            color: string;
            createdAt: number;
            updatedAt: number;
            userId?: string;
            // Type-specific properties
            width?: number;  // rectangle
            height?: number; // rectangle
            radius?: number; // circle
            text?: string;   // text
            fontSize?: number; // text
            fontFamily?: string; // text
            fontStyle?: string;  // text
        };
        userId: string;
    };
}

export interface ObjectUpdatedMessage extends WebSocketMessage {
    type: 'object_updated';
    payload: {
        roomId: string;
        objectId: string;
        updates: Record<string, any>;
        userId: string;
    };
}

export interface ObjectMovedMessage extends WebSocketMessage {
    type: 'object_moved';
    payload: {
        roomId: string;
        objectId: string;
        x: number;
        y: number;
        userId: string;
    };
}

export interface ObjectDeletedMessage extends WebSocketMessage {
    type: 'object_deleted';
    payload: {
        roomId: string;
        objectId: string;
        userId: string;
    };
}

export interface CanvasStateSyncMessage extends WebSocketMessage {
    type: 'canvas_state_sync';
    payload: {
        roomId: string;
        objects: Array<{
            id: string;
            x: number;
            y: number;
            type: 'rectangle' | 'circle' | 'text';
            color: string;
            createdAt: number;
            updatedAt: number;
            userId?: string;
            // Type-specific properties
            width?: number;
            height?: number;
            radius?: number;
            text?: string;
            fontSize?: number;
            fontFamily?: string;
            fontStyle?: string;
        }>;
        timestamp: number;
    };
}

export interface CanvasStateRequestedMessage extends WebSocketMessage {
    type: 'canvas_state_requested';
    payload: {
        roomId: string;
    };
}

// Union type for all object synchronization messages
export type ObjectSyncMessage =
    | ObjectCreatedMessage
    | ObjectUpdatedMessage
    | ObjectMovedMessage
    | ObjectDeletedMessage
    | CanvasStateSyncMessage
    | CanvasStateRequestedMessage;

// Object synchronization callback types
export type ObjectCreatedCallback = (payload: ObjectCreatedMessage['payload']) => void;
export type ObjectUpdatedCallback = (payload: ObjectUpdatedMessage['payload']) => void;
export type ObjectMovedCallback = (payload: ObjectMovedMessage['payload']) => void;
export type ObjectDeletedCallback = (payload: ObjectDeletedMessage['payload']) => void;
export type CanvasStateSyncCallback = (payload: CanvasStateSyncMessage['payload']) => void;
export type ConnectionStateCallback = (state: WebSocketConnectionState) => void;
export type UserJoinedCallback = (payload: UserJoinedPayload) => void;
export type UserLeftCallback = (payload: UserLeftPayload) => void;
export type ErrorCallback = (payload: ErrorPayload) => void;
// Cursor callback types
export type CursorMovedCallback = (payload: CursorMovedPayload) => void;
export type CursorUpdateCallback = (payload: CursorUpdatePayload) => void;
export type CursorLeftCallback = (payload: CursorLeftPayload) => void;
