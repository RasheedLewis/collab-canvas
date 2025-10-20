# Canvas State Isolation Guide

This guide explains the comprehensive canvas state isolation system that ensures complete separation of canvas data, seamless multi-canvas collaboration, and advanced presence management.

## 🏗️ Architecture Overview

The Canvas State Isolation system provides complete state separation between canvases while enabling seamless switching and real-time collaboration. It consists of several key components:

### Core Components

1. **CanvasStateIsolationService** - Main service providing complete state isolation
2. **Enhanced WebSocket Handlers** - Canvas-aware object and cursor handlers
3. **Canvas Presence Management** - Per-canvas user presence and activity tracking
4. **Seamless Canvas Switching** - Switch between canvases without reconnection
5. **Activity Detection** - Automatic idle and away status management

### Key Features

- **Complete Object Isolation** - Each canvas has completely isolated object state
- **Canvas-Specific Cursors** - Cursor positions tracked separately per canvas
- **Advanced Presence Tracking** - User status, activity, and cursor management per canvas
- **Seamless Canvas Switching** - Instant switching without WebSocket reconnection
- **Activity Detection** - Automatic user status transitions (active → idle → away)
- **State Cleanup** - Automatic cleanup on user disconnect and empty canvas cleanup

## 🎯 Canvas Object State Isolation

### Complete Object Separation

Each canvas maintains completely isolated object state:

```typescript
// Canvas objects are stored separately per canvas
private canvasObjects: Map<string, Map<string, CanvasObject>> = new Map();

// Example: Canvas A objects never interfere with Canvas B objects
const canvasAObjects = isolationService.getCanvasObjects('canvas-a');
const canvasBObjects = isolationService.getCanvasObjects('canvas-b');
// These are completely independent
```

### Object Operations

**Create Object:**
```typescript
await isolationService.addObjectToCanvas(
  'canvas-id',
  {
    id: 'object-1',
    type: 'rectangle',
    x: 100,
    y: 200,
    width: 150,
    height: 100,
    color: '#FF6B6B'
  },
  'user-id',
  'client-id'
);
```

**Update Object:**
```typescript
await isolationService.updateObjectInCanvas(
  'canvas-id',
  'object-1',
  { x: 120, y: 220 },
  'user-id',
  'client-id'
);
```

**Remove Object:**
```typescript
await isolationService.removeObjectFromCanvas(
  'canvas-id',
  'object-1',
  'user-id',
  'client-id'
);
```

**Clear Canvas:**
```typescript
await isolationService.clearCanvas(
  'canvas-id',
  'user-id',
  'client-id'
);
```

## 🖱️ Canvas-Specific Cursor Management

### Independent Cursor Tracking

Each canvas tracks cursors independently with enhanced information:

```typescript
interface CanvasCursorState {
  userId: string;
  clientId: string;
  x: number;
  y: number;
  visible: boolean;
  tool?: string;         // Current tool (pen, eraser, etc.)
  color?: string;        // Current color selection
  displayName: string;
  avatarColor?: string;
  lastUpdated: number;
}
```

### Cursor Operations

**Update Cursor:**
```typescript
isolationService.updateCanvasCursor(
  'canvas-id',
  'user-id',
  'client-id',
  {
    x: 300,
    y: 400,
    visible: true,
    tool: 'pen',
    color: '#4ECDC4'
  },
  {
    displayName: 'John Doe',
    avatarColor: '#FF6B6B'
  }
);
```

**Get All Canvas Cursors:**
```typescript
const cursors = isolationService.getCanvasCursors('canvas-id');
// Returns array of CanvasCursorState for this canvas only
```

**Remove Cursor:**
```typescript
isolationService.removeCanvasCursor('canvas-id', 'user-id');
```

## 👥 Advanced Presence Management

### Canvas-Specific Presence

Each user's presence is tracked separately for each canvas they join:

```typescript
interface CanvasPresenceState {
  userId: string;
  clientId: string;
  displayName: string;
  avatarColor?: string;
  role: PermissionRole;           // owner, editor, viewer
  status: 'active' | 'idle' | 'away';
  joinedAt: number;
  lastActivity: number;
  cursor?: CanvasCursorState;
}
```

### Presence Operations

**Add User Presence:**
```typescript
isolationService.addCanvasPresence(
  'canvas-id',
  'user-id',
  'client-id',
  {
    displayName: 'Jane Smith',
    avatarColor: '#95E1D3',
    role: 'editor'
  }
);
```

**Get Canvas Presence:**
```typescript
const presence = isolationService.getCanvasPresence('canvas-id');
// Returns array of all users currently in this canvas
```

**Remove User Presence:**
```typescript
isolationService.removeCanvasPresence('canvas-id', 'user-id', 'client-id');
```

## 🔄 Seamless Canvas Switching

### Instant Canvas Switching

Users can switch between canvases without WebSocket reconnection:

```typescript
// Switch from one canvas to another
await isolationService.switchUserCanvas(
  'user-id',
  'client-id',
  'from-canvas-id',    // or null to leave all
  'to-canvas-id',
  {
    displayName: 'User Name',
    avatarColor: '#4ECDC4',
    role: 'editor'
  }
);
```

### Canvas State Snapshots

Get complete canvas state for seamless switching:

```typescript
const snapshot = isolationService.getCanvasStateSnapshot('canvas-id');
/*
Returns:
{
  canvasId: string;
  objects: CanvasObject[];
  cursors: Map<string, CanvasCursorState>;
  presence: Map<string, CanvasPresenceState>;
  activity: CanvasActivityEvent[];
  metadata: {
    memberCount: number;
    lastActivity: number;
    version: number;
  };
}
*/
```

## 📊 Activity Tracking and Idle Detection

### Automatic Status Management

The system automatically manages user activity status:

- **Active**: User is actively interacting (cursor movement, object manipulation)
- **Idle**: No activity for 2 minutes
- **Away**: No activity for 5 minutes

```typescript
// Activity is automatically updated on:
// - Object creation/update/deletion
// - Cursor movement
// - Canvas operations

isolationService.updateUserActivity('canvas-id', 'user-id', 'client-id');
```

### Activity Events

All canvas activities are logged for analytics and audit:

```typescript
interface CanvasActivityEvent {
  id: string;
  canvasId: string;
  userId: string;
  clientId: string;
  type: 'join' | 'leave' | 'object_create' | 'object_update' | 
        'object_delete' | 'cursor_move' | 'idle' | 'away' | 'active';
  timestamp: number;
  data?: any;
}
```

**Get Recent Activity:**
```typescript
const recentActivity = isolationService.getCanvasActivity('canvas-id', 20);
// Returns last 20 activity events for this canvas
```

## 🧹 State Cleanup and Management

### User Disconnect Cleanup

Automatic cleanup when users disconnect:

```typescript
// Called automatically on disconnect
await isolationService.cleanupUserState('user-id', 'client-id');
```

### Empty Canvas Cleanup

Automatic cleanup of empty canvases:

```typescript
// Runs periodically to clean up empty canvases
isolationService.cleanupEmptyCanvases();
```

### Service Statistics

Monitor service health and resource usage:

```typescript
const stats = isolationService.getServiceStats();
/*
Returns:
{
  activeCanvases: number;
  totalObjects: number;
  totalUsers: number;
  totalClients: number;
  memoryUsage: {
    objects: number;
    cursors: number;
    presence: number;
    activity: number;
  };
}
*/
```

## 🌐 WebSocket Integration

### Enhanced Object Handlers

The WebSocket connection manager now includes canvas-aware object handlers:

```typescript
// Automatic detection of canvas vs traditional rooms
private isCanvasRoom(roomId: string): boolean {
  // UUID format detection or canvas prefix
  return roomId.length > 10 && (
    roomId.includes('-') ||
    roomId.startsWith('canvas-') ||
    /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(roomId)
  );
}
```

### Message Flow

**Object Creation Flow:**
1. Client sends `object_created` message
2. Handler detects canvas room
3. Object added to canvas state isolation
4. User activity updated
5. Message broadcast to canvas room only

**Cursor Movement Flow:**
1. Client sends `cursor_moved` message
2. Handler detects canvas room
3. Cursor position updated in canvas state isolation
4. User activity updated (with throttling)
5. Cursor position broadcast to canvas room only

### Canvas State Synchronization

**Request Canvas State:**
```javascript
// Client requests full canvas state
websocket.send(JSON.stringify({
  type: 'canvas_state_requested',
  payload: { roomId: 'canvas-id' }
}));
```

**Receive Canvas State:**
```javascript
// Server responds with complete state
{
  type: 'canvas_state_sync',
  payload: {
    roomId: 'canvas-id',
    objects: [...],      // All objects in canvas
    cursors: [...],      // All cursor positions
    presence: [...],     // All users in canvas
    timestamp: 1640995200000
  }
}
```

## 💻 Frontend Integration Guide

### Canvas Component Setup

```typescript
class CanvasComponent {
  private currentCanvasId: string | null = null;
  
  // Join a canvas
  async joinCanvas(canvasId: string) {
    this.websocket.send(JSON.stringify({
      type: 'join_canvas_room',
      payload: {
        canvasId,
        userInfo: {
          displayName: this.user.displayName,
          avatarColor: this.user.avatarColor
        }
      }
    }));
  }
  
  // Switch to different canvas
  async switchCanvas(newCanvasId: string) {
    this.websocket.send(JSON.stringify({
      type: 'switch_canvas',
      payload: {
        fromCanvasId: this.currentCanvasId,
        toCanvasId: newCanvasId,
        userInfo: {
          displayName: this.user.displayName,
          avatarColor: this.user.avatarColor
        }
      }
    }));
    
    this.currentCanvasId = newCanvasId;
  }
  
  // Update cursor position
  updateCursor(x: number, y: number, tool: string) {
    this.websocket.send(JSON.stringify({
      type: 'cursor_moved',
      payload: {
        roomId: this.currentCanvasId,
        x, y, tool,
        color: this.currentColor
      }
    }));
  }
}
```

### Message Handlers

```typescript
websocket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'canvas_room_joined':
      handleCanvasJoined(message.payload);
      break;
      
    case 'canvas_user_joined':
      addUserPresence(message.payload.member);
      break;
      
    case 'canvas_user_left':
      removeUserPresence(message.payload.userId);
      break;
      
    case 'canvas_presence_updated':
      updateUserPresence(message.payload);
      break;
      
    case 'object_created':
      if (message.payload.roomId === currentCanvasId) {
        addObjectToCanvas(message.payload.object);
      }
      break;
      
    case 'cursor_moved':
      if (message.payload.roomId === currentCanvasId) {
        updateCursorPosition(message.payload);
      }
      break;
  }
};
```

## 🔧 Configuration and Tuning

### Activity Thresholds

```typescript
// Configurable in CanvasStateIsolationService
private idleThreshold = 2 * 60 * 1000;  // 2 minutes
private awayThreshold = 5 * 60 * 1000;  // 5 minutes
```

### Cleanup Intervals

```typescript
// Periodic cleanup settings
private cleanupIntervalMs = 10 * 60 * 1000; // 10 minutes
private emptyCanvasThreshold = 30 * 60 * 1000; // 30 minutes
```

### Activity Logging

```typescript
// Cursor activity throttling (prevent spam)
private throttledCursorActivity(canvasId: string, userId: string, clientId: string): void {
  // Log maximum once per 5 seconds per user
  const throttleInterval = 5000;
}
```

## 📊 Monitoring and Analytics

### Service Health Monitoring

```typescript
// Get real-time service statistics
const stats = isolationService.getServiceStats();
console.log(`Active canvases: ${stats.activeCanvases}`);
console.log(`Total objects: ${stats.totalObjects}`);
console.log(`Active users: ${stats.totalUsers}`);
```

### Canvas Analytics

```typescript
// Track canvas activity
const activity = isolationService.getCanvasActivity('canvas-id');
const joins = activity.filter(a => a.type === 'join').length;
const objectCreations = activity.filter(a => a.type === 'object_create').length;
```

### Performance Monitoring

```typescript
// Monitor memory usage per canvas
const memoryStats = isolationService.getServiceStats().memoryUsage;
console.log('Memory usage by component:', memoryStats);
```

## 🐛 Debugging and Troubleshooting

### Common Issues

**1. Objects Not Appearing in Canvas**
- Verify canvas room joined successfully
- Check object creation messages are being sent to correct canvas ID
- Ensure canvas state isolation is properly initialized

**2. Cursor Positions Not Syncing**
- Check cursor update throttling settings
- Verify user is properly joined to canvas room
- Ensure cursor messages include correct canvas ID

**3. Presence Status Not Updating**
- Check activity update calls are being made
- Verify activity thresholds are appropriate
- Ensure presence cleanup is not running too frequently

### Debug Logging

```typescript
// Enable debug logging
process.env.DEBUG_CANVAS_STATE = 'true';
process.env.DEBUG_ACTIVITY_TRACKING = 'true';

// Monitor canvas state changes
isolationService.on('stateChange', (canvasId, changeType, details) => {
  console.log(`Canvas ${canvasId}: ${changeType}`, details);
});
```

### Health Check Endpoints

```typescript
// Add health check endpoints for monitoring
GET /api/canvas/state/stats     // Service statistics
GET /api/canvas/state/:id       // Specific canvas state
GET /api/canvas/activity/:id    // Canvas activity log
```

## 🚀 Performance Optimization

### Memory Management

- **Object Limits**: Configurable limits per canvas to prevent memory issues
- **Activity Pruning**: Keep only recent activity events (last 100 per canvas)
- **Cursor Throttling**: Limit cursor update frequency to prevent spam
- **Presence Cleanup**: Automatic cleanup of inactive users and empty canvases

### Network Optimization

- **State Snapshots**: Send complete state only when necessary
- **Incremental Updates**: Send only changed data for efficiency  
- **Message Batching**: Batch multiple updates when possible
- **Selective Broadcasting**: Send messages only to relevant canvas rooms

### Scalability Considerations

- **Horizontal Scaling**: Service designed to work with multiple server instances
- **Data Persistence**: Integration with persistent storage for state recovery
- **Load Balancing**: Canvas rooms can be distributed across servers
- **Caching Strategy**: In-memory caching with configurable cleanup intervals

This Canvas State Isolation system provides a robust foundation for multi-canvas real-time collaboration with complete state separation, advanced presence management, and seamless user experience.
