import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { verifyAuthToken, getCurrentUser } from './handlers/authHandler';
import { WebSocketConnectionManager } from './websocket/connectionHandler';

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

// Initialize WebSocket Connection Manager
const wsManager = new WebSocketConnectionManager(server);

// Basic HTTP routes
app.get('/', (_req, res) => {
    res.json({
        message: 'CollabCanvas Backend Server',
        status: 'running',
        connectedClients: wsManager.getClientCount(),
        rooms: wsManager.getRoomCount(),
        uptime: process.uptime()
    });
});

app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        clients: wsManager.getClientCount(),
        rooms: wsManager.getRoomCount()
    });
});

// Auth routes
app.get('/api/auth/me', verifyAuthToken, getCurrentUser);

// Additional WebSocket status routes
app.get('/api/websocket/status', (_req, res) => {
    res.json({
        connectedClients: wsManager.getClientCount(),
        activeRooms: wsManager.getRoomCount(),
        rooms: wsManager.getRooms(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/websocket/room/:roomId', (_req, res) => {
    const roomId = _req.params.roomId;
    const clientsInRoom = wsManager.getClientsInRoom(roomId);

    res.json({
        roomId,
        clientCount: clientsInRoom.length,
        clients: clientsInRoom
    });
});

app.get('/api/websocket/protocol', (_req, res) => {
    const protocolInfo = wsManager.getProtocolInfo();
    res.json(protocolInfo);
});

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
    wsManager.shutdown();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    wsManager.shutdown();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
