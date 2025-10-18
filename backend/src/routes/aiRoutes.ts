import express from 'express';
import { aiChatHandler, executeToolHandler, getCanvasContextHandler } from '../handlers/aiHandler';
import { aiAuthMiddleware, aiRateLimitMiddleware } from '../middleware/aiMiddleware';

const router = express.Router();

// Apply AI-specific middleware to all routes
router.use(aiAuthMiddleware);
router.use(aiRateLimitMiddleware);

// AI Chat endpoint for conversations with OpenAI
router.post('/chat', aiChatHandler);

// Execute AI tool calls
router.post('/execute-tool', executeToolHandler);

// Get current canvas context for AI
router.get('/canvas-context/:roomId', getCanvasContextHandler);

export { router as aiRoutes };
