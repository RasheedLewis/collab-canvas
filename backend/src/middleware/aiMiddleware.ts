import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../handlers/authHandler';

// Rate limiting store - in production, use Redis or similar
interface RateLimitEntry {
    count: number;
    resetTime: number;
    requests: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_CONFIG = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // requests per window per user
    maxConcurrent: 3, // max concurrent requests per user
    globalMaxPerMinute: 100 // global max requests per minute
};

// Request queue for managing concurrent operations
interface QueuedRequest {
    id: string;
    userId: string;
    timestamp: number;
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

const requestQueue = new Map<string, QueuedRequest[]>();
const activeRequests = new Map<string, Set<string>>();
let globalRequestCount = 0;
let globalResetTime = Date.now() + RATE_LIMIT_CONFIG.windowMs;

/**
 * AI Authentication Middleware
 * Verifies user authentication for AI endpoints
 */
export async function aiAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // Use existing auth verification with proper callback handling
        await new Promise<void>((resolve, reject) => {
            verifyAuthToken(req as any, res, (error?: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        // Check if response was already sent by verifyAuthToken
        if (res.headersSent) {
            return;
        }

        // Ensure user ID is available
        if (!req.user?.uid) {
            res.status(401).json({
                error: 'User authentication required for AI endpoints'
            });
            return;
        }

        next();
    } catch (error) {
        console.error('AI Auth Middleware Error:', error);
        // Only send response if headers haven't been sent yet
        if (!res.headersSent) {
            res.status(401).json({
                error: 'Authentication failed',
                message: error instanceof Error ? error.message : 'Unknown auth error'
            });
        }
    }
}

/**
 * AI Rate Limiting Middleware
 * Implements both per-user and global rate limiting
 */
export async function aiRateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'User ID required for rate limiting' });
            return;
        }

        // Check global rate limit
        const now = Date.now();
        if (now > globalResetTime) {
            globalRequestCount = 0;
            globalResetTime = now + RATE_LIMIT_CONFIG.windowMs;
        }

        if (globalRequestCount >= RATE_LIMIT_CONFIG.globalMaxPerMinute) {
            res.status(429).json({
                error: 'Global rate limit exceeded',
                retryAfter: Math.ceil((globalResetTime - now) / 1000)
            });
            return;
        }

        // Check user rate limit
        const userKey = `user:${userId}`;
        let userEntry = rateLimitStore.get(userKey);

        if (!userEntry || now > userEntry.resetTime) {
            userEntry = {
                count: 0,
                resetTime: now + RATE_LIMIT_CONFIG.windowMs,
                requests: []
            };
            rateLimitStore.set(userKey, userEntry);
        }

        // Clean old requests from the sliding window
        userEntry.requests = userEntry.requests.filter(
            timestamp => timestamp > now - RATE_LIMIT_CONFIG.windowMs
        );

        if (userEntry.requests.length >= RATE_LIMIT_CONFIG.maxRequests) {
            res.status(429).json({
                error: 'User rate limit exceeded',
                retryAfter: Math.ceil((userEntry.resetTime - now) / 1000),
                limit: RATE_LIMIT_CONFIG.maxRequests,
                windowMs: RATE_LIMIT_CONFIG.windowMs
            });
            return;
        }

        // Check concurrent requests
        const activeUserRequests = activeRequests.get(userId) || new Set();
        if (activeUserRequests.size >= RATE_LIMIT_CONFIG.maxConcurrent) {
            res.status(429).json({
                error: 'Too many concurrent requests',
                maxConcurrent: RATE_LIMIT_CONFIG.maxConcurrent
            });
            return;
        }

        // Record the request
        const requestId = generateRequestId();
        userEntry.requests.push(now);
        userEntry.count++;
        globalRequestCount++;

        // Track active request
        if (!activeRequests.has(userId)) {
            activeRequests.set(userId, new Set());
        }
        activeRequests.get(userId)!.add(requestId);

        // Add cleanup on response finish
        res.on('finish', () => {
            const userActiveRequests = activeRequests.get(userId);
            if (userActiveRequests) {
                userActiveRequests.delete(requestId);
                if (userActiveRequests.size === 0) {
                    activeRequests.delete(userId);
                }
            }
        });

        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': RATE_LIMIT_CONFIG.maxRequests.toString(),
            'X-RateLimit-Remaining': Math.max(0, RATE_LIMIT_CONFIG.maxRequests - userEntry.requests.length).toString(),
            'X-RateLimit-Reset': Math.ceil(userEntry.resetTime / 1000).toString(),
            'X-RateLimit-Window': RATE_LIMIT_CONFIG.windowMs.toString()
        });

        next();
    } catch (error) {
        console.error('AI Rate Limit Middleware Error:', error);
        res.status(500).json({
            error: 'Rate limiting error',
            message: error instanceof Error ? error.message : 'Unknown rate limit error'
        });
    }
}

/**
 * Request Queue Middleware
 * Queues AI requests to prevent overwhelming the system
 */
export async function aiRequestQueueMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    if (!userId) {
        res.status(401).json({ error: 'User ID required for request queuing' });
        return;
    }

    try {
        await enqueueRequest(userId);
        next();
    } catch (error) {
        console.error('AI Request Queue Middleware Error:', error);
        res.status(503).json({
            error: 'Request queue error',
            message: error instanceof Error ? error.message : 'Service temporarily unavailable'
        });
    }
}

/**
 * Enqueue a request and wait for processing slot
 */
async function enqueueRequest(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const requestId = generateRequestId();
        const queuedRequest: QueuedRequest = {
            id: requestId,
            userId,
            timestamp: Date.now(),
            resolve,
            reject
        };

        // Add to user queue
        if (!requestQueue.has(userId)) {
            requestQueue.set(userId, []);
        }
        requestQueue.get(userId)!.push(queuedRequest);

        // Process queue
        processQueue();

        // Set timeout for request
        setTimeout(() => {
            reject(new Error('Request timeout'));
            removeFromQueue(userId, requestId);
        }, 30000); // 30 second timeout
    });
}

/**
 * Process the request queue
 */
function processQueue(): void {
    // Simple FIFO processing - in production, implement priority queuing
    for (const [userId, userQueue] of requestQueue.entries()) {
        const activeUserRequests = activeRequests.get(userId) || new Set();

        while (userQueue.length > 0 && activeUserRequests.size < RATE_LIMIT_CONFIG.maxConcurrent) {
            const request = userQueue.shift()!;
            request.resolve(undefined);

            // Track as active
            if (!activeRequests.has(userId)) {
                activeRequests.set(userId, new Set());
            }
            activeRequests.get(userId)!.add(request.id);
        }

        // Clean up empty queues
        if (userQueue.length === 0) {
            requestQueue.delete(userId);
        }
    }
}

/**
 * Remove request from queue
 */
function removeFromQueue(userId: string, requestId: string): void {
    const userQueue = requestQueue.get(userId);
    if (userQueue) {
        const index = userQueue.findIndex(req => req.id === requestId);
        if (index !== -1) {
            userQueue.splice(index, 1);
        }

        if (userQueue.length === 0) {
            requestQueue.delete(userId);
        }
    }
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get rate limit status for monitoring
 */
export function getRateLimitStatus(): {
    global: { count: number; limit: number; resetTime: number };
    users: { userId: string; count: number; limit: number; resetTime: number }[];
    activeRequests: { userId: string; count: number }[];
    queuedRequests: { userId: string; count: number }[];
} {
    const now = Date.now();

    return {
        global: {
            count: globalRequestCount,
            limit: RATE_LIMIT_CONFIG.globalMaxPerMinute,
            resetTime: globalResetTime
        },
        users: Array.from(rateLimitStore.entries()).map(([key, entry]) => ({
            userId: key.replace('user:', ''),
            count: entry.requests.filter(timestamp => timestamp > now - RATE_LIMIT_CONFIG.windowMs).length,
            limit: RATE_LIMIT_CONFIG.maxRequests,
            resetTime: entry.resetTime
        })),
        activeRequests: Array.from(activeRequests.entries()).map(([userId, requests]) => ({
            userId,
            count: requests.size
        })),
        queuedRequests: Array.from(requestQueue.entries()).map(([userId, queue]) => ({
            userId,
            count: queue.length
        }))
    };
}
