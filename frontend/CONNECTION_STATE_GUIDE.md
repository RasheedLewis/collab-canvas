# Connection State Management Guide

This guide explains the **Connection State Management** system implemented for the CollabCanvas WebSocket real-time communication.

## 🏗️ Architecture Overview

The connection state management follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Components    │────│ useConnection()  │────│ ConnectionStore │
│                 │    │     Hook         │    │   (Zustand)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        │
                        ┌──────────────────┐    ┌─────────────────┐
                        │ ConnectionService│────│ useWebSocket()  │
                        │                  │    │     Hook        │
                        └──────────────────┘    └─────────────────┘
```

### Layer Responsibilities

1. **Connection Store** (`connectionStore.ts`): Pure state management with Zustand
2. **Connection Service** (`connectionService.ts`): WebSocket management and store integration
3. **useConnection Hook** (`useConnection.ts`): React integration and component interface
4. **useWebSocket Hook** (`useWebSocket.ts`): Low-level WebSocket communication

## 📁 File Structure

```
src/
├── store/
│   └── connectionStore.ts          # Zustand store for connection state
├── services/
│   └── connectionService.ts        # WebSocket service integration
├── hooks/
│   ├── useWebSocket.ts            # Low-level WebSocket hook
│   └── useConnection.ts           # High-level connection hook
├── types/
│   └── websocket.ts               # TypeScript definitions
├── examples/
│   ├── WebSocketExample.tsx       # Low-level WebSocket demo
│   └── ConnectionExample.tsx      # High-level connection demo
└── public/
    ├── websocket-test.html        # Pure JS WebSocket test
    └── connection-test.html       # Integration test page
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { useConnection } from '@/hooks/useConnection';

function MyComponent() {
    const connection = useConnection();

    const handleJoinRoom = () => {
        connection.joinRoom('my-room', {
            uid: 'user-123',
            name: 'John Doe',
            email: 'john@example.com',
            displayName: 'John',
            avatarColor: '#3b82f6'
        });
    };

    return (
        <div>
            <div>Status: {connection.status}</div>
            <div>Connected Users: {connection.users.length}</div>
            
            <button 
                onClick={connection.connect}
                disabled={connection.isConnected}
            >
                Connect
            </button>
            
            <button 
                onClick={handleJoinRoom}
                disabled={!connection.isConnected}
            >
                Join Room
            </button>
        </div>
    );
}
```

### Lightweight Hooks

For components that only need specific data:

```typescript
import { 
    useConnectionStatusOnly,
    useRoomInfoOnly,
    useConnectionActionsOnly 
} from '@/hooks/useConnection';

// Only connection status (no re-renders on user changes)
const { state, isConnected, status } = useConnectionStatusOnly();

// Only room information
const { room, users, memberCount } = useRoomInfoOnly();

// Only connection actions
const { connect, disconnect, reconnect } = useConnectionActionsOnly();
```

## 📊 State Management

### Connection Store State

```typescript
interface ConnectionState {
    // Connection status
    connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
    isConnected: boolean;
    clientId: string | null;
    serverTime: number | null;
    lastError: string | null;
    
    // Room state
    currentRoom: RoomInfo | null;
    
    // Users tracking
    connectedUsers: Map<string, ConnectedUser>;
    
    // Statistics
    stats: ConnectionStats;
    
    // Configuration
    config: {
        url: string;
        autoConnect: boolean;
        maxReconnectAttempts: number;
        reconnectInterval: number;
    };
}
```

### Reactive Selectors

```typescript
import { 
    useConnectionState,
    useIsConnected,
    useClientId,
    useCurrentRoom,
    useConnectedUsers,
    useConnectionError,
    useConnectionStats 
} from '@/store/connectionStore';

// Each selector only triggers re-renders when its specific data changes
const connectionState = useConnectionState(); // Only when connection state changes
const users = useConnectedUsers();           // Only when users list changes
const room = useCurrentRoom();               // Only when room changes
```

## 🔧 Configuration

### Environment Variables

```bash
# .env
VITE_WS_URL=ws://localhost:3000          # WebSocket server URL
VITE_API_URL=http://localhost:3000/api   # HTTP API URL
```

### Connection Configuration

```typescript
import connectionService from '@/services/connectionService';

// Update configuration
connectionService.updateConfig({
    url: 'wss://production-server.com',
    maxReconnectAttempts: 5,
    reconnectInterval: 2000
});
```

## 🔄 Real-Time Events

### Automatic Event Handling

The system automatically handles these WebSocket events:

- **`connection_established`**: Sets client ID and server time
- **`room_joined`**: Updates current room and member list
- **`room_left`**: Clears room state
- **`user_joined`**: Adds user to connected users list
- **`user_left`**: Removes user from connected users list
- **`error`**: Updates error state with user-friendly messages

### Custom Message Handling

```typescript
const connection = useConnection();

// Send custom messages
connection.sendMessage('canvas_update', {
    objectId: 'rect-123',
    x: 100,
    y: 200
});

// Listen for custom messages (use raw WebSocket hook)
import { useWebSocket } from '@/hooks/useWebSocket';

const ws = useWebSocket({ url: 'ws://localhost:3000' });
ws.onMessage((message) => {
    if (message.type === 'canvas_update') {
        // Handle canvas updates
        console.log('Canvas updated:', message.payload);
    }
});
```

## 🧪 Testing

### Integration Test Page

Open `http://localhost:5173/connection-test.html` (when frontend dev server is running) to test:

- Connection establishment
- Room joining/leaving  
- User presence tracking
- Message sending/receiving
- Error handling
- Statistics tracking

### Component Testing

```typescript
import { render, screen } from '@testing-library/react';
import { useConnection } from '@/hooks/useConnection';

// Mock the connection service for testing
jest.mock('@/services/connectionService', () => ({
    default: {
        initialize: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
        // ... other methods
    }
}));

function TestComponent() {
    const connection = useConnection();
    return (
        <div>
            <span data-testid="status">{connection.status}</span>
            <button onClick={connection.connect}>Connect</button>
        </div>
    );
}

test('should display connection status', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('status')).toHaveTextContent('Disconnected');
});
```

## 🔍 Monitoring & Debugging

### Connection Statistics

```typescript
const { stats } = useConnection();

console.log({
    messagesSent: stats.messagesSent,
    messagesReceived: stats.messagesReceived,
    connectionAttempts: stats.connectionAttempts,
    reconnectionAttempts: stats.reconnectionAttempts,
    uptime: stats.uptime,
    lastActivity: stats.lastActivity
});
```

### Debug Information

```typescript
import { useConnectionService } from '@/hooks/useConnection';

const service = useConnectionService();
const info = service.getConnectionInfo();

console.log('Debug Info:', {
    isConnected: info.isConnected,
    connectionState: info.connectionState,
    clientId: info.clientId,
    roomId: info.roomId,
    reconnectAttempts: info.reconnectAttempts,
    lastError: info.lastError
});
```

### Development Tools

When `NODE_ENV=development`, additional debug utilities are available:

```typescript
import API from '@/lib/api';

// Log WebSocket messages
API.dev?.logMessage('sent', { type: 'ping' });

// Simulate connection issues
API.dev?.simulateConnectionIssue(websocket);

// Get connection debug info
const debugInfo = API.dev?.getDebugInfo(websocket);
```

## 🚀 Performance Optimizations

### Selective Re-rendering

Use specific hooks to prevent unnecessary re-renders:

```typescript
// ❌ Bad: Re-renders on ANY connection state change
const connection = useConnection();

// ✅ Good: Only re-renders when connection status changes
const { isConnected } = useConnectionStatusOnly();

// ✅ Good: Only re-renders when users list changes
const { users } = useRoomInfoOnly();
```

### Memory Management

```typescript
// Cleanup when component unmounts or user leaves app
import connectionService from '@/services/connectionService';

useEffect(() => {
    return () => {
        // Only cleanup if this is the last component using the service
        if (shouldCleanup) {
            connectionService.cleanup();
        }
    };
}, []);
```

## 🔧 Integration with Existing Systems

### Auth Store Integration

```typescript
import { useAuthUser } from '@/store/authStore';
import { useConnection } from '@/hooks/useConnection';

function AuthenticatedComponent() {
    const user = useAuthUser();
    const connection = useConnection();
    
    useEffect(() => {
        if (user && connection.isConnected) {
            // Authenticate WebSocket with user token
            connection.authenticate(user.accessToken, {
                uid: user.uid,
                email: user.email,
                name: user.displayName || user.email?.split('@')[0],
                displayName: user.displayName,
                picture: user.photoURL
            });
        }
    }, [user, connection.isConnected]);
}
```

### Canvas Store Integration

```typescript
import { useCanvasStore } from '@/store/canvasStore';
import { useConnection } from '@/hooks/useConnection';

function CanvasComponent() {
    const { objects, addObject } = useCanvasStore();
    const connection = useConnection();
    
    // Send canvas updates to other users
    const handleObjectCreate = (object) => {
        addObject(object); // Update local state
        connection.sendMessage('canvas_object_created', { object }); // Sync with others
    };
}
```

## 🎯 Next Steps

This connection state management system is ready for:

1. **Canvas Real-time Sync** (PR #5): Object creation/movement synchronization
2. **Cursor Tracking** (PR #4): Real-time cursor position sharing
3. **User Presence** (PR #4): Rich presence indicators and notifications
4. **Firebase Integration** (PR #8): Replace WebSocket auth with Firebase tokens

The foundation provides bulletproof connection management with automatic reconnection, comprehensive error handling, and reactive state updates for building advanced collaborative features.
