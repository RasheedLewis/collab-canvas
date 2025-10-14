import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { verifyAuthToken, getCurrentUser } from './handlers/authHandler';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = createServer(app);

// Configure CORS for cross-origin requests
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

// Basic HTTP routes
app.get('/', (_req, res) => {
    res.json({
        message: 'CollabCanvas Backend Server',
        status: 'running',
        connectedClients: clients.size,
        uptime: process.uptime()
    });
});

app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        clients: clients.size
    });
});

// Auth routes
app.get('/api/auth/me', verifyAuthToken, getCurrentUser);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

interface Client {
    id: string;
    ws: WebSocket;
    isAlive: boolean;
    joinedAt: Date;
    user?: {
        uid: string;
        email: string | null;
        name: string | null;
        picture: string | null;
    };
}

interface Message {
    type: string;
    payload?: any;
    timestamp?: number;
}

const clients = new Map<string, Client>();

// WebSocket connection handler
wss.on('connection', (ws) => {
    const clientId = uuidv4();
    const client: Client = {
        id: clientId,
        ws,
        isAlive: true,
        joinedAt: new Date()
    };

    clients.set(clientId, client);
    console.log(`Client connected: ${clientId}. Total clients: ${clients.size}`);

    // Send welcome message to new client
    const welcomeMessage: Message = {
        type: 'connection_established',
        payload: { clientId },
        timestamp: Date.now()
    };
    ws.send(JSON.stringify(welcomeMessage));

    // Handle incoming messages
    ws.on('message', (data) => {
        try {
            const message: Message = JSON.parse(data.toString());
            handleMessage(clientId, message);
        } catch (error) {
            console.error(`Error parsing message from client ${clientId}:`, error);
            sendErrorMessage(ws, 'Invalid message format');
        }
    });

    // Handle client disconnect
    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`Client disconnected: ${clientId}. Total clients: ${clients.size}`);

        // Broadcast user disconnect to remaining clients
        broadcastToOthers(clientId, {
            type: 'user_disconnected',
            payload: { userId: clientId },
            timestamp: Date.now()
        });
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        clients.delete(clientId);
    });

    // Heartbeat mechanism to detect dead connections
    ws.on('pong', () => {
        const client = clients.get(clientId);
        if (client) {
            client.isAlive = true;
        }
    });
});

// Message handler
function handleMessage(clientId: string, message: Message): void {
    const client = clients.get(clientId);
    if (!client) return;

    console.log(`Message from ${clientId}:`, message.type);

    switch (message.type) {
        case 'ping':
            // Respond to ping with pong
            sendToClient(clientId, {
                type: 'pong',
                timestamp: Date.now()
            });
            break;

        case 'join_room':
            handleJoinRoom(clientId, message);
            break;

        case 'leave_room':
            handleLeaveRoom(clientId, message);
            break;

        case 'auth':
            handleAuthentication(clientId, message);
            break;

        default:
            // For now, just broadcast unhandled messages to other clients
            broadcastToOthers(clientId, message);
            break;
    }
}

// Handle room joining (basic implementation)
function handleJoinRoom(clientId: string, message: Message): void {
    const { roomId, userInfo } = message.payload || {};

    if (!roomId) {
        sendErrorMessage(clients.get(clientId)?.ws, 'Room ID is required');
        return;
    }

    console.log(`Client ${clientId} joining room: ${roomId}`);

    // Broadcast user joined to other clients in room
    broadcastToOthers(clientId, {
        type: 'user_joined',
        payload: { userId: clientId, roomId, userInfo },
        timestamp: Date.now()
    });

    // Send confirmation to joining client
    sendToClient(clientId, {
        type: 'room_joined',
        payload: { roomId, userId: clientId },
        timestamp: Date.now()
    });
}

// Handle room leaving
function handleLeaveRoom(clientId: string, message: Message): void {
    const { roomId } = message.payload || {};

    console.log(`Client ${clientId} leaving room: ${roomId}`);

    broadcastToOthers(clientId, {
        type: 'user_left',
        payload: { userId: clientId, roomId },
        timestamp: Date.now()
    });
}

// Handle authentication over WebSocket
function handleAuthentication(clientId: string, message: Message): void {
    const { token } = message.payload || {};

    if (!token) {
        sendErrorMessage(clients.get(clientId)?.ws, 'Authentication token required');
        return;
    }

    // TODO: Verify token with Firebase
    // For now, just acknowledge
    sendToClient(clientId, {
        type: 'auth_success',
        payload: { userId: clientId },
        timestamp: Date.now()
    });
}

// Utility functions
function sendToClient(clientId: string, message: Message): void {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
    }
}

// Utility function for broadcasting to all clients (available if needed)
// function broadcastToAll(message: Message): void {
//     clients.forEach((client) => {
//         if (client.ws.readyState === WebSocket.OPEN) {
//             client.ws.send(JSON.stringify(message));
//         }
//     });
// }

function broadcastToOthers(excludeClientId: string, message: Message): void {
    clients.forEach((client, clientId) => {
        if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

function sendErrorMessage(ws: WebSocket | undefined, error: string): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'error',
            payload: { error },
            timestamp: Date.now()
        }));
    }
}

// Heartbeat interval to detect dead connections
setInterval(() => {
    clients.forEach((client, clientId) => {
        if (!client.isAlive) {
            console.log(`Terminating dead connection: ${clientId}`);
            client.ws.terminate();
            clients.delete(clientId);
            return;
        }

        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
        }
    });
}, 30000); // Check every 30 seconds

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 CollabCanvas Backend Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready for connections`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
