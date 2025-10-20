# WebSocket Namespace Management Guide

This guide explains the multi-canvas WebSocket namespace management system that enables real-time collaboration across multiple canvases with permission-based access control.

## 🏗️ Architecture Overview

The WebSocket namespace management system consists of several key components:

### Core Components

1. **CanvasNamespaceManager** - Manages canvas-specific rooms and user presence
2. **WebSocketConnectionManager** - Extended to support canvas rooms alongside traditional rooms
3. **CanvasWebSocketService** - Bridge between permission system and WebSocket notifications
4. **MessageProtocol** - Extended with canvas-specific message types

### Key Features

- **Canvas-Specific Rooms** - Each canvas has its own isolated WebSocket room
- **Permission-Based Access** - Users can only join canvas rooms they have permission to access
- **Real-time Permission Changes** - Permission updates are pushed to users in real-time
- **Cross-Canvas Notifications** - Notifications can be sent across multiple canvases
- **Presence Tracking** - Track user status and cursor position per canvas
- **Dynamic Room Management** - Automatic cleanup of empty rooms

## 📨 Message Types

### Client to Server Messages

#### Join Canvas Room
```javascript
{
  "type": "join_canvas_room",
  "payload": {
    "canvasId": "canvas-uuid",
    "userInfo": {
      "displayName": "John Doe",
      "avatarColor": "#FF6B6B"
    }
  }
}
```

#### Leave Canvas Room
```javascript
{
  "type": "leave_canvas_room",
  "payload": {
    "canvasId": "canvas-uuid"
  }
}
```

#### Update Presence
```javascript
{
  "type": "canvas_presence_update",
  "payload": {
    "canvasId": "canvas-uuid",
    "cursor": {
      "x": 100,
      "y": 200,
      "visible": true
    },
    "status": "active" // 'active', 'idle', 'away'
  }
}
```

#### Switch Canvas
```javascript
{
  "type": "switch_canvas",
  "payload": {
    "fromCanvasId": "canvas-1-uuid",
    "toCanvasId": "canvas-2-uuid",
    "userInfo": {
      "displayName": "John Doe",
      "avatarColor": "#FF6B6B"
    }
  }
}
```

### Server to Client Messages

#### Canvas Room Joined
```javascript
{
  "type": "canvas_room_joined",
  "payload": {
    "canvasId": "canvas-uuid",
    "role": "editor",
    "canvasInfo": {
      "name": "Design Sprint Board",
      "ownerId": "owner-uuid",
      "privacy": "private"
    },
    "members": [
      {
        "userId": "user-uuid",
        "displayName": "Jane Smith",
        "avatarColor": "#4ECDC4",
        "role": "owner",
        "status": "active",
        "cursor": { "x": 150, "y": 300, "visible": true },
        "joinedAt": 1640995200000
      }
    ],
    "memberCount": 3
  }
}
```

#### User Joined Canvas
```javascript
{
  "type": "canvas_user_joined",
  "payload": {
    "canvasId": "canvas-uuid",
    "member": {
      "clientId": "client-uuid",
      "userId": "user-uuid",
      "displayName": "New User",
      "avatarColor": "#95E1D3",
      "role": "viewer",
      "joinedAt": 1640995200000
    },
    "memberCount": 4
  }
}
```

#### Permission Updated
```javascript
{
  "type": "canvas_permission_updated",
  "payload": {
    "canvasId": "canvas-uuid",
    "oldRole": "viewer",
    "newRole": "editor",
    "message": "Your role has been updated to editor"
  }
}
```

#### Permission Revoked
```javascript
{
  "type": "canvas_permission_revoked",
  "payload": {
    "canvasId": "canvas-uuid",
    "reason": "Your permissions have been revoked",
    "redirectTo": "/dashboard"
  }
}
```

## 🔐 Permission Integration

### Room Access Control

When a user attempts to join a canvas room:

1. **Authentication Check** - User must be authenticated
2. **Permission Validation** - Check if user has at least 'view' permission for the canvas
3. **Role Assignment** - User's WebSocket session is tagged with their canvas role
4. **Room Joining** - User is added to the canvas-specific room

### Real-time Permission Updates

When permissions change:

1. **Permission Change Detected** - PermissionController triggers notification
2. **WebSocket Notification** - CanvasWebSocketService sends real-time update
3. **Room Updates** - Affected users receive permission change messages
4. **Role Updates** - User roles in WebSocket rooms are updated
5. **Access Control** - Users with revoked permissions are removed from rooms

## 📡 Usage Examples

### Backend Integration

#### Initialize Canvas WebSocket Service
```typescript
import { CanvasWebSocketService } from '../services/canvasWebSocketService';

const canvasWsService = CanvasWebSocketService.getInstance();

// Set up permission change callbacks
canvasWsService.setupPermissionChangeCallbacks();
```

#### Send Permission Change Notification
```typescript
// In PermissionController after updating permissions
const canvasWsService = CanvasWebSocketService.getInstance();

await canvasWsService.notifyPermissionChange({
  type: 'permission_updated',
  canvasId: 'canvas-uuid',
  targetUserId: 'user-uuid',
  changedBy: 'owner-uuid',
  oldRole: 'viewer',
  newRole: 'editor',
  timestamp: Date.now(),
  reason: 'Role upgraded by canvas owner'
});
```

#### Send Cross-Canvas Notification
```typescript
await canvasWsService.sendCrossCanvasNotification({
  type: 'canvas_shared',
  sourceCanvasId: 'canvas-1-uuid',
  userId: 'user-uuid',
  data: {
    sharedWith: 'collaborator@example.com',
    role: 'editor',
    message: 'Check out this design!'
  },
  timestamp: Date.now()
});
```

### Frontend Integration

#### Join Canvas Room
```typescript
// When user opens a canvas
websocket.send(JSON.stringify({
  type: 'join_canvas_room',
  payload: {
    canvasId: currentCanvas.id,
    userInfo: {
      displayName: user.displayName,
      avatarColor: user.avatarColor
    }
  }
}));
```

#### Handle Permission Changes
```typescript
websocket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'canvas_permission_updated':
      handleRoleUpdate(message.payload);
      break;
      
    case 'canvas_permission_revoked':
      handlePermissionRevoked(message.payload);
      break;
      
    case 'canvas_user_joined':
      addUserToCanvas(message.payload.member);
      break;
  }
};
```

#### Update Presence
```typescript
// When user moves cursor
const throttledPresenceUpdate = throttle((x, y) => {
  websocket.send(JSON.stringify({
    type: 'canvas_presence_update',
    payload: {
      canvasId: currentCanvas.id,
      cursor: { x, y, visible: true },
      status: 'active'
    }
  }));
}, 100);
```

## 🎯 Canvas Room Lifecycle

### Room Creation
- Rooms are created automatically when the first user joins a canvas
- Canvas metadata is cached in the room for quick access
- Room settings include canvas privacy and ownership information

### Member Management
- Users are validated against canvas permissions before joining
- Member list includes role, status, cursor position, and join time
- Real-time updates when members join, leave, or change status

### Presence Tracking
- Automatic status updates based on activity (active → idle → away)
- Cursor position tracking with throttling for performance
- Status changes are broadcast to all room members

### Room Cleanup
- Empty rooms are automatically cleaned up after 30 seconds
- Inactive rooms (no activity for 10 minutes) are periodically cleaned
- Forced cleanup on server shutdown with proper notifications

## 🔧 Configuration

### Room Settings
```typescript
// In CanvasNamespaceManager
private presenceUpdateInterval = 30000; // 30 seconds
private roomCleanupInterval = 5 * 60 * 1000; // 5 minutes
private emptyRoomCleanupDelay = 30000; // 30 seconds
```

### Message Rate Limiting
```typescript
// In WebSocketConnectionManager
this.rateLimiter = new RateLimiter(300, 60000); // 300 messages per minute
```

## 📊 Monitoring and Statistics

### Canvas Room Statistics
```typescript
const stats = canvasNamespaceManager.getCanvasRoomStats('canvas-uuid');
// Returns: { memberCount, activeMembers, roles, lastActivity }
```

### Active Rooms Overview
```typescript
const activeRooms = canvasNamespaceManager.getActiveCanvasRooms();
// Returns array of { canvasId, memberCount, canvasName, lastActivity }
```

### WebSocket Protocol Info
```typescript
const protocolInfo = wsManager.getProtocolInfo();
// Includes canvas namespace message types and statistics
```

## 🔒 Security Considerations

### Permission Validation
- All canvas room operations require valid authentication
- Permissions are re-validated for sensitive operations
- Failed permission checks are logged for security monitoring

### Rate Limiting
- Message rate limiting prevents spam and DoS attacks
- Separate limits for different message types if needed
- Graceful degradation under high load

### Data Isolation
- Canvas rooms are completely isolated from each other
- User data is only shared within permitted canvas rooms
- Cross-canvas notifications respect privacy settings

## 🚀 Performance Optimizations

### Caching
- Canvas metadata cached in room objects
- Permission results cached for frequently accessed canvases
- In-memory presence data with periodic cleanup

### Throttling
- Cursor updates throttled to prevent overwhelming the server
- Presence status updates debounced for efficiency
- Batch presence updates when possible

### Resource Management
- Automatic cleanup of inactive rooms and sessions
- Graceful handling of large numbers of concurrent users
- Memory-efficient data structures for room management

## 🐛 Debugging and Troubleshooting

### Common Issues

1. **User Can't Join Canvas Room**
   - Check authentication status
   - Verify canvas permissions
   - Check canvas exists and is accessible

2. **Permission Changes Not Reflected**
   - Verify WebSocket connection is active
   - Check permission change notifications are being sent
   - Ensure user is in the correct canvas room

3. **Presence Updates Not Working**
   - Check message rate limiting
   - Verify canvas room membership
   - Check for WebSocket connection issues

### Logging
```typescript
// Enable debug logging
process.env.DEBUG_WEBSOCKET = 'true';
process.env.DEBUG_CANVAS_ROOMS = 'true';
```

### Health Checks
```typescript
// Check WebSocket system health
GET /api/websocket/status
GET /api/websocket/protocol-info
GET /api/canvas/rooms/active
```

## 📝 Migration Guide

### From Single Canvas to Multi-Canvas

1. **Update Client Code**
   - Replace `join_room` with `join_canvas_room`
   - Add canvas ID to all canvas-related messages
   - Handle new permission change message types

2. **Update Server Integration**
   - Initialize CanvasWebSocketService in your application
   - Add permission change notifications to permission endpoints
   - Update canvas CRUD operations to send WebSocket notifications

3. **Database Considerations**
   - Ensure canvas permissions are properly configured
   - Test permission validation with WebSocket access
   - Verify canvas metadata is accessible for room creation

This WebSocket namespace management system provides a robust foundation for real-time multi-canvas collaboration with fine-grained permission control and excellent performance characteristics.
