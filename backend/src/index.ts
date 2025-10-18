import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { verifyAuthToken, getCurrentUser } from './handlers/authHandler';
import { WebSocketConnectionManager } from './websocket/connectionHandler';
import { aiRoutes } from './routes/aiRoutes';
import { ToolRegistry } from './tools/toolRegistry';
import { CanvasPersistenceService } from './services/persistenceService';
import { initializeCanvasToolServices, CANVAS_TOOL_HANDLERS } from './tools/canvasToolHandlers';
import { initializeAIServices } from './handlers/aiHandler';
import { OpenAIService } from './services/openaiService';
import { getRateLimitStatus } from './middleware/aiMiddleware';
import path from 'path';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = createServer(app);

// Configure CORS for cross-origin requests
// Configure allowed origins for CORS
const allowedOrigins: string[] = ['http://localhost:5173']; // Development
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL); // Production
}

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json());

// Initialize WebSocket Connection Manager
const wsManager = new WebSocketConnectionManager(server);

// Initialize Canvas Persistence Service
const persistenceService = new CanvasPersistenceService();

// Initialize OpenAI Service
const openaiService = new OpenAIService();

// Initialize AI Tool Registry
const toolRegistry = new ToolRegistry();

// Initialize canvas tool services with dependencies
initializeCanvasToolServices(persistenceService, wsManager);

// Initialize AI handler services
initializeAIServices(openaiService, toolRegistry, persistenceService);

// Load and register AI tools
async function initializeAITools() {
    try {
        const toolsPath = path.join(__dirname, '..', 'ai-tools.json');
        console.log('📋 Loading AI tools from:', toolsPath);

        await toolRegistry.loadToolsFromFile(toolsPath);
        console.log(`✅ Loaded ${toolRegistry.getAllTools().length} AI tools successfully`);

        // Register canvas tool handlers
        for (const [toolName, handler] of Object.entries(CANVAS_TOOL_HANDLERS)) {
            // Convert handler to match ToolHandler interface
            const wrappedHandler = async (parameters: Record<string, any>, context: any) => {
                return await handler({ ...parameters, ...context });
            };
            toolRegistry.registerHandler(toolName, wrappedHandler);
            console.log(`🔧 Registered handler for: ${toolName}`);
        }

        console.log('🎯 AI Tool Registry initialization complete');
    } catch (error) {
        console.error('❌ Failed to initialize AI tools:', error);
        // Continue without AI tools - graceful degradation
    }
}

// Initialize AI tools (async)
initializeAITools();

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

// AI routes
app.use('/api/ai', aiRoutes);

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

// AI system status routes
app.get('/api/ai/status', (_req, res) => {
    try {
        const rateLimitStatus = getRateLimitStatus();
        const toolNames = toolRegistry.getAllTools().map(t => t.function.name);

        res.json({
            status: 'operational',
            timestamp: new Date().toISOString(),
            tools: {
                loaded: toolNames.length,
                available: toolNames
            },
            rateLimiting: rateLimitStatus
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
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
