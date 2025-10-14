# CollabCanvas WebSocket Message Protocol v1.0.0

## Overview

This document defines the comprehensive WebSocket message protocol for CollabCanvas real-time collaboration. The protocol includes message validation, routing, error handling, and rate limiting to ensure reliable and secure real-time communication.

## Protocol Features

- **Schema Validation**: All messages are validated using Zod schemas
- **Rate Limiting**: Configurable message rate limits to prevent abuse
- **Error Handling**: Standardized error codes and user-friendly error messages
- **Type Safety**: Complete TypeScript definitions for all message types
- **Extensibility**: Support for custom message types and future extensions

## Message Structure

### Base Message Format

All WebSocket messages follow this base structure:

```typescript
interface BaseMessage {
    type: string;           // Message type identifier
    payload?: object;       // Optional message data
    timestamp?: number;     // Optional Unix timestamp
    clientId?: string;      // Auto-assigned by server
}
```

### Message Flow

```
Client                          Server
  │                              │
  │ ──── Message with Schema ──→ │ 1. Rate Limit Check
  │                              │ 2. Schema Validation
  │                              │ 3. Route to Handler
  │                              │ 4. Process Message
  │ ←──── Response/Error ────── │ 5. Send Response
  │                              │
```

## Supported Message Types

### Client-to-Server Messages

#### 1. Ping Message
```typescript
{
    type: 'ping'
}
```
**Response**: `pong` message
**Purpose**: Connection health check

#### 2. Join Room Message
```typescript
{
    type: 'join_room',
    payload: {
        roomId: string,           // Valid room ID (1-50 chars, alphanumeric + "-_")
        userInfo?: {              // Optional user information
            uid: string,
            email: string | null,
            name: string | null,
            picture?: string | null,
            displayName?: string,
            avatarColor?: string    // Hex color format: #RRGGBB
        }
    }
}
```
**Response**: `room_joined` message
**Purpose**: Join a collaboration room

#### 3. Leave Room Message
```typescript
{
    type: 'leave_room',
    payload?: {
        roomId?: string           // Optional specific room ID
    }
}
```
**Response**: `room_left` message
**Purpose**: Leave current or specific room

#### 4. Authentication Message
```typescript
{
    type: 'auth',
    payload: {
        token: string,            // Authentication token (required)
        userInfo?: UserInfo       // Optional user information
    }
}
```
**Response**: `auth_success` or `error` message
**Purpose**: Authenticate with the server

#### 5. Heartbeat Message
```typescript
{
    type: 'heartbeat'
}
```
**Response**: `heartbeat_ack` message
**Purpose**: Keep connection alive

### Server-to-Client Messages

#### 1. Connection Established
```typescript
{
    type: 'connection_established',
    payload: {
        clientId: string,
        serverTime: number,
        connectedClients: number,
        protocolVersion?: string
    }
}
```
**Sent**: Immediately after WebSocket connection

#### 2. Room Joined
```typescript
{
    type: 'room_joined',
    payload: {
        roomId: string,
        userId: string,
        roomMembers?: Array<{
            clientId: string,
            user?: UserInfo
        }>
    }
}
```
**Sent**: After successful room join

#### 3. User Joined
```typescript
{
    type: 'user_joined',
    payload: {
        userId: string,
        roomId: string,
        userInfo?: UserInfo,
        roomMembers?: number
    }
}
```
**Sent**: To all room members when a user joins

#### 4. User Left
```typescript
{
    type: 'user_left',
    payload: {
        userId: string,
        roomId: string,
        userInfo?: UserInfo,
        remainingUsers?: number
    }
}
```
**Sent**: To all room members when a user leaves

#### 5. Error Message
```typescript
{
    type: 'error',
    payload: {
        error: string,            // Human-readable error message
        code: string,             // Machine-readable error code
        details?: object          // Additional error context
    }
}
```
**Sent**: When validation fails or errors occur

## Error Codes

### Authentication Errors
- `AUTH_REQUIRED`: Authentication token required
- `AUTH_INVALID`: Invalid authentication token
- `AUTH_EXPIRED`: Authentication token has expired

### Room Errors
- `ROOM_NOT_FOUND`: Specified room does not exist
- `ROOM_FULL`: Room has reached maximum capacity
- `ROOM_ACCESS_DENIED`: User lacks permission to join room
- `INVALID_ROOM_ID`: Room ID format is invalid

### Protocol Errors
- `INVALID_MESSAGE`: Message structure is invalid
- `UNSUPPORTED_MESSAGE_TYPE`: Message type not supported
- `MALFORMED_PAYLOAD`: Message payload is malformed

### Connection Errors
- `CONNECTION_ERROR`: Generic connection error
- `RATE_LIMIT_EXCEEDED`: Too many messages sent

### Server Errors
- `INTERNAL_ERROR`: Server encountered an internal error
- `SERVICE_UNAVAILABLE`: Service is temporarily unavailable

## Rate Limiting

### Default Limits
- **100 messages per minute** per client
- **Rate limit window**: 60,000ms (1 minute)
- **Cleanup interval**: 30 seconds

### Rate Limit Response
When rate limit is exceeded:
```typescript
{
    type: 'error',
    payload: {
        error: 'Too many messages. Please slow down.',
        code: 'RATE_LIMIT_EXCEEDED'
    }
}
```

### Rate Limit Headers
Rate limit information is tracked per client and cleaned up automatically.

## Validation Rules

### Room ID Validation
- **Length**: 1-50 characters
- **Format**: Alphanumeric characters, hyphens, and underscores only
- **Regex**: `/^[a-zA-Z0-9-_]+$/`

### User Information Validation
- **uid**: Required string
- **email**: Valid email format or null
- **name**: String or null
- **picture**: Valid URL or null
- **displayName**: Optional string
- **avatarColor**: Optional hex color (#RRGGBB format)

### Message Validation
All messages are validated against Zod schemas before processing:

1. **Structure Validation**: Base message format
2. **Type Validation**: Message type is supported
3. **Payload Validation**: Payload matches message type schema
4. **Content Validation**: Field formats and constraints

## Usage Examples

### Basic Connection Flow

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
    console.log('Connected');
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
        case 'connection_established':
            console.log('Client ID:', message.payload.clientId);
            break;
        case 'error':
            console.error('Error:', message.payload.error);
            break;
    }
};

// Join a room
ws.send(JSON.stringify({
    type: 'join_room',
    payload: {
        roomId: 'my-collaboration-room',
        userInfo: {
            uid: 'user123',
            email: 'user@example.com',
            name: 'John Doe',
            displayName: 'John',
            avatarColor: '#3b82f6',
            picture: null
        }
    }
}));
```

### Error Handling

```javascript
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'error') {
        const { error, code, details } = message.payload;
        
        switch (code) {
            case 'INVALID_ROOM_ID':
                showUserError('Please enter a valid room ID');
                break;
            case 'RATE_LIMIT_EXCEEDED':
                showUserError('You are sending messages too quickly');
                break;
            default:
                showUserError(error);
        }
    }
};
```

### Room Management

```javascript
// Join room with user info
function joinRoom(roomId, userInfo) {
    ws.send(JSON.stringify({
        type: 'join_room',
        payload: { roomId, userInfo }
    }));
}

// Leave current room
function leaveRoom() {
    ws.send(JSON.stringify({
        type: 'leave_room'
    }));
}

// Handle room events
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
        case 'room_joined':
            console.log('Joined room:', message.payload.roomId);
            updateRoomMembers(message.payload.roomMembers);
            break;
            
        case 'user_joined':
            console.log('User joined:', message.payload.userInfo.name);
            addUserToRoom(message.payload);
            break;
            
        case 'user_left':
            console.log('User left:', message.payload.userInfo.name);
            removeUserFromRoom(message.payload.userId);
            break;
    }
};
```

## Protocol Information Endpoint

Get protocol information via HTTP:

```bash
GET /api/websocket/protocol
```

**Response**:
```json
{
    "version": "1.0.0",
    "supportedMessageTypes": [
        "ping", "pong", "join_room", "leave_room", 
        "auth", "heartbeat", "connection_established",
        "room_joined", "room_left", "user_joined", 
        "user_left", "auth_success", "error", 
        "server_shutdown", "heartbeat_ack"
    ],
    "registeredHandlers": [
        "ping", "join_room", "leave_room", "auth", "heartbeat"
    ],
    "stats": {
        "totalClients": 0,
        "totalRooms": 0,
        "rateLimitSettings": {
            "maxMessages": 100,
            "windowMs": 60000
        }
    }
}
```

## Testing

### Protocol Test Page
Access the comprehensive test suite at:
```
http://localhost:5173/protocol-test.html
```

Features:
- Protocol information display
- Manual message testing
- Automated test suite
- Rate limit testing
- Error handling validation
- Real-time activity logging

### Test Categories

1. **Basic Connectivity**: Connection establishment and ping/pong
2. **Room Management**: Join/leave rooms with validation
3. **Authentication**: Token-based authentication flow
4. **Error Handling**: Invalid message and validation error testing
5. **Rate Limiting**: High-frequency message testing
6. **Edge Cases**: Malformed messages and boundary conditions

## Security Considerations

### Input Validation
- All messages validated against strict schemas
- Room ID format restrictions prevent injection attacks
- Email validation prevents malformed email addresses
- URL validation for profile pictures

### Rate Limiting
- Prevents message flooding attacks
- Per-client rate limit tracking
- Automatic cleanup of expired limits
- Configurable rate limit settings

### Error Handling
- Detailed error logging for debugging
- User-friendly error messages
- No sensitive information in error responses
- Structured error codes for programmatic handling

### Authentication
- Token-based authentication support
- Prepared for Firebase integration
- Secure user information handling
- Optional user information validation

## Future Extensions

### Planned Features
1. **Message Acknowledgments**: Delivery confirmation for critical messages
2. **Message Persistence**: Optional message history and replay
3. **Advanced Room Features**: Room permissions and moderation
4. **Custom Message Types**: Extensible message protocol for app-specific messages
5. **Compression**: Message compression for large payloads
6. **Encryption**: End-to-end encryption for sensitive data

### Extension Points
- Custom message type registration
- Pluggable validation schemas
- Configurable rate limiting policies
- Custom error code definitions
- Event middleware system

## Troubleshooting

### Common Issues

**Connection Fails**
- Verify WebSocket server is running on correct port
- Check firewall and network connectivity
- Ensure WebSocket protocol (ws://) not HTTP

**Message Validation Errors**
- Verify message structure matches schema
- Check required fields are present
- Validate data types and formats

**Rate Limit Exceeded**
- Reduce message sending frequency
- Implement client-side rate limiting
- Check for message loops

**Room Join Failures**
- Verify room ID format (alphanumeric + hyphens/underscores)
- Check room ID length (1-50 characters)
- Ensure user information is valid

### Debug Information

Enable debug logging to troubleshoot issues:
- Server logs show detailed validation errors
- Protocol endpoint provides current server state
- Test suite validates protocol compliance
- Activity logs show real-time message flow

---

*This protocol documentation is maintained as part of the CollabCanvas project and is updated with each protocol version.*
