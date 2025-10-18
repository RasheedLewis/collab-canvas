/**
 * WebSocket Message Protocol Definition and Validation
 * 
 * This module defines the comprehensive message protocol for CollabCanvas
 * real-time communication, including validation, routing, and error handling.
 */

import { z } from 'zod';

// Base message schema
const BaseMessageSchema = z.object({
    type: z.string().min(1),
    payload: z.record(z.string(), z.any()).optional(),
    timestamp: z.number().optional(),
    clientId: z.string().optional(),
});

// User information schema
const UserInfoSchema = z.object({
    uid: z.string(),
    email: z.string().email().nullable(),
    name: z.string().nullable(),
    picture: z.string().url().nullable().optional(),
    displayName: z.string().optional(),
    avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Canvas object schemas
const BaseCanvasObjectSchema = z.object({
    id: z.string().min(1, 'Object ID is required'),
    x: z.number(),
    y: z.number(),
    type: z.enum(['rectangle', 'circle', 'text']),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
    createdAt: z.number(),
    updatedAt: z.number(),
    userId: z.string().optional(),
});

const RectangleObjectSchema = BaseCanvasObjectSchema.extend({
    type: z.literal('rectangle'),
    width: z.number().positive('Width must be positive'),
    height: z.number().positive('Height must be positive'),
});

const CircleObjectSchema = BaseCanvasObjectSchema.extend({
    type: z.literal('circle'),
    radius: z.number().positive('Radius must be positive'),
});

const TextObjectSchema = BaseCanvasObjectSchema.extend({
    type: z.literal('text'),
    text: z.string(),
    fontSize: z.number().positive('Font size must be positive'),
    fontFamily: z.string().optional(),
    fontStyle: z.string().optional(),
});

const CanvasObjectSchema = z.discriminatedUnion('type', [
    RectangleObjectSchema,
    CircleObjectSchema,
    TextObjectSchema,
]);

// Protocol version and capabilities
export const PROTOCOL_VERSION = '1.0.0';
export const SUPPORTED_MESSAGE_TYPES = [
    'ping',
    'pong',
    'join_room',
    'leave_room',
    'auth',
    'heartbeat',
    'reconnect',
    'connection_established',
    'room_joined',
    'room_left',
    'user_joined',
    'user_left',
    'auth_success',
    'reconnect_success',
    'error',
    'server_shutdown',
    'heartbeat_ack',
    // Cursor synchronization messages
    'cursor_moved',
    'cursor_update',
    'cursor_left',
    // Object synchronization messages
    'object_created',
    'object_updated',
    'object_moved',
    'object_deleted',
    'object_resized',
    'object_rotated',
    'text_changed',
    'canvas_state_requested',
    'canvas_state_sync'
] as const;

export type MessageType = typeof SUPPORTED_MESSAGE_TYPES[number];

// Client-to-server message schemas
export const ClientMessageSchemas = {
    ping: BaseMessageSchema.extend({
        type: z.literal('ping'),
    }),

    join_room: BaseMessageSchema.extend({
        type: z.literal('join_room'),
        payload: z.object({
            roomId: z.string()
                .min(1, 'Room ID is required')
                .max(50, 'Room ID too long')
                .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid room ID format'),
            userInfo: UserInfoSchema.optional(),
        }),
    }),

    leave_room: BaseMessageSchema.extend({
        type: z.literal('leave_room'),
        payload: z.object({
            roomId: z.string().optional(),
        }).optional(),
    }),

    auth: BaseMessageSchema.extend({
        type: z.literal('auth'),
        payload: z.object({
            token: z.string().min(1, 'Authentication token is required'),
            userInfo: UserInfoSchema.optional(),
        }),
    }),

    heartbeat: BaseMessageSchema.extend({
        type: z.literal('heartbeat'),
    }),

    reconnect: BaseMessageSchema.extend({
        type: z.literal('reconnect'),
        payload: z.object({
            reconnectToken: z.string().min(1, 'Reconnect token is required'),
            lastSessionId: z.string().optional(),
        }),
    }),

    // Cursor synchronization messages
    cursor_moved: BaseMessageSchema.extend({
        type: z.literal('cursor_moved'),
        payload: z.object({
            x: z.number(),
            y: z.number(),
            roomId: z.string(),
            userId: z.string().optional(), // Will be set by server
        }),
    }),

    cursor_update: BaseMessageSchema.extend({
        type: z.literal('cursor_update'),
        payload: z.object({
            x: z.number(),
            y: z.number(),
            roomId: z.string(),
            userId: z.string().optional(), // Will be set by server
            userInfo: UserInfoSchema.optional(), // Updated user info (name, color, etc.)
            activeTool: z.string().optional(), // Current tool being used
        }),
    }),

    cursor_left: BaseMessageSchema.extend({
        type: z.literal('cursor_left'),
        payload: z.object({
            roomId: z.string(),
            userId: z.string().optional(), // Will be set by server
        }),
    }),

    // Object synchronization messages
    object_created: BaseMessageSchema.extend({
        type: z.literal('object_created'),
        payload: z.object({
            roomId: z.string(),
            object: CanvasObjectSchema,
        }),
    }),

    object_updated: BaseMessageSchema.extend({
        type: z.literal('object_updated'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string().min(1, 'Object ID is required'),
            updates: z.record(z.string(), z.any()).refine(
                (updates) => Object.keys(updates).length > 0,
                'Updates object cannot be empty'
            ),
        }),
    }),

    object_moved: BaseMessageSchema.extend({
        type: z.literal('object_moved'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string().min(1, 'Object ID is required'),
            x: z.number(),
            y: z.number(),
        }),
    }),

    object_deleted: BaseMessageSchema.extend({
        type: z.literal('object_deleted'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string().min(1, 'Object ID is required'),
        }),
    }),

    object_resized: BaseMessageSchema.extend({
        type: z.literal('object_resized'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string().min(1, 'Object ID is required'),
            updates: z.object({
                x: z.number().optional(),
                y: z.number().optional(),
                width: z.number().positive().optional(),
                height: z.number().positive().optional(),
                radius: z.number().positive().optional(),
                fontSize: z.number().positive().optional(),
            }),
        }),
    }),

    object_rotated: BaseMessageSchema.extend({
        type: z.literal('object_rotated'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string().min(1, 'Object ID is required'),
            rotation: z.number(), // Rotation in degrees
            x: z.number(), // Updated x position after rotation
            y: z.number(), // Updated y position after rotation
        }),
    }),

    text_changed: BaseMessageSchema.extend({
        type: z.literal('text_changed'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string().min(1, 'Object ID is required'),
            text: z.string(),
            fontSize: z.number().positive('Font size must be positive').optional(),
            fontFamily: z.string().optional(),
            fontStyle: z.string().optional(),
        }),
    }),

    canvas_state_requested: BaseMessageSchema.extend({
        type: z.literal('canvas_state_requested'),
        payload: z.object({
            roomId: z.string(),
        }),
    }),

    // Custom message for extensibility
    custom: BaseMessageSchema.extend({
        type: z.string().min(1),
        payload: z.record(z.string(), z.any()).optional(),
    }),
};

// Server-to-client message schemas  
export const ServerMessageSchemas = {
    pong: BaseMessageSchema.extend({
        type: z.literal('pong'),
    }),

    connection_established: BaseMessageSchema.extend({
        type: z.literal('connection_established'),
        payload: z.object({
            clientId: z.string(),
            serverTime: z.number(),
            connectedClients: z.number(),
            protocolVersion: z.string().optional(),
        }),
    }),

    room_joined: BaseMessageSchema.extend({
        type: z.literal('room_joined'),
        payload: z.object({
            roomId: z.string(),
            userId: z.string(),
            roomMembers: z.array(z.object({
                clientId: z.string(),
                user: UserInfoSchema.optional(),
            })).optional(),
        }),
    }),

    room_left: BaseMessageSchema.extend({
        type: z.literal('room_left'),
        payload: z.object({
            roomId: z.string(),
        }),
    }),

    user_joined: BaseMessageSchema.extend({
        type: z.literal('user_joined'),
        payload: z.object({
            userId: z.string(),
            roomId: z.string(),
            userInfo: UserInfoSchema.optional(),
            roomMembers: z.number().optional(),
        }),
    }),

    user_left: BaseMessageSchema.extend({
        type: z.literal('user_left'),
        payload: z.object({
            userId: z.string(),
            roomId: z.string(),
            userInfo: UserInfoSchema.optional(),
            remainingUsers: z.number().optional(),
        }),
    }),

    auth_success: BaseMessageSchema.extend({
        type: z.literal('auth_success'),
        payload: z.object({
            userId: z.string(),
            user: UserInfoSchema.optional(),
        }),
    }),

    reconnect_success: BaseMessageSchema.extend({
        type: z.literal('reconnect_success'),
        payload: z.object({
            sessionRecovered: z.boolean(),
            roomId: z.string().optional(),
            userInfo: UserInfoSchema.optional(),
            sessionId: z.string(),
            reconnectAttempts: z.number(),
            newReconnectToken: z.string(),
        }),
    }),

    error: BaseMessageSchema.extend({
        type: z.literal('error'),
        payload: z.object({
            error: z.string(),
            code: z.string().optional(),
            details: z.record(z.string(), z.any()).optional(),
        }),
    }),

    server_shutdown: BaseMessageSchema.extend({
        type: z.literal('server_shutdown'),
        payload: z.object({
            message: z.string(),
            gracePeriod: z.number().optional(),
        }),
    }),

    heartbeat_ack: BaseMessageSchema.extend({
        type: z.literal('heartbeat_ack'),
    }),

    // Cursor synchronization response messages
    cursor_moved: BaseMessageSchema.extend({
        type: z.literal('cursor_moved'),
        payload: z.object({
            x: z.number(),
            y: z.number(),
            userId: z.string(),
            roomId: z.string(),
            userInfo: UserInfoSchema.optional(),
        }),
    }),

    cursor_update: BaseMessageSchema.extend({
        type: z.literal('cursor_update'),
        payload: z.object({
            x: z.number(),
            y: z.number(),
            userId: z.string(),
            roomId: z.string(),
            userInfo: UserInfoSchema.optional(),
            activeTool: z.string().optional(),
        }),
    }),

    cursor_left: BaseMessageSchema.extend({
        type: z.literal('cursor_left'),
        payload: z.object({
            userId: z.string(),
            roomId: z.string(),
        }),
    }),

    // Object synchronization response messages
    object_created: BaseMessageSchema.extend({
        type: z.literal('object_created'),
        payload: z.object({
            roomId: z.string(),
            object: CanvasObjectSchema,
            userId: z.string(), // User who created the object
        }),
    }),

    object_updated: BaseMessageSchema.extend({
        type: z.literal('object_updated'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string(),
            updates: z.record(z.string(), z.any()),
            userId: z.string(), // User who updated the object
        }),
    }),

    object_moved: BaseMessageSchema.extend({
        type: z.literal('object_moved'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string(),
            x: z.number(),
            y: z.number(),
            userId: z.string(), // User who moved the object
        }),
    }),

    object_deleted: BaseMessageSchema.extend({
        type: z.literal('object_deleted'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string(),
            userId: z.string(), // User who deleted the object
        }),
    }),

    object_resized: BaseMessageSchema.extend({
        type: z.literal('object_resized'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string(),
            updates: z.object({
                x: z.number().optional(),
                y: z.number().optional(),
                width: z.number().positive().optional(),
                height: z.number().positive().optional(),
                radius: z.number().positive().optional(),
                fontSize: z.number().positive().optional(),
            }),
            userId: z.string(), // User who resized the object
        }),
    }),

    object_rotated: BaseMessageSchema.extend({
        type: z.literal('object_rotated'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string(),
            rotation: z.number(), // Rotation in degrees
            x: z.number(), // Updated x position after rotation
            y: z.number(), // Updated y position after rotation
            userId: z.string(), // User who rotated the object
        }),
    }),

    text_changed: BaseMessageSchema.extend({
        type: z.literal('text_changed'),
        payload: z.object({
            roomId: z.string(),
            objectId: z.string(),
            text: z.string(),
            fontSize: z.number().positive().optional(),
            fontFamily: z.string().optional(),
            fontStyle: z.string().optional(),
            userId: z.string(), // User who changed the text
        }),
    }),

    canvas_state_sync: BaseMessageSchema.extend({
        type: z.literal('canvas_state_sync'),
        payload: z.object({
            roomId: z.string(),
            objects: z.array(CanvasObjectSchema),
            timestamp: z.number(),
        }),
    }),
};

// Error codes for standardized error handling
export const ERROR_CODES = {
    // Authentication errors
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    AUTH_INVALID: 'AUTH_INVALID',
    AUTH_EXPIRED: 'AUTH_EXPIRED',

    // Room errors
    ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
    ROOM_FULL: 'ROOM_FULL',
    ROOM_ACCESS_DENIED: 'ROOM_ACCESS_DENIED',
    INVALID_ROOM_ID: 'INVALID_ROOM_ID',

    // Protocol errors
    INVALID_MESSAGE: 'INVALID_MESSAGE',
    UNSUPPORTED_MESSAGE_TYPE: 'UNSUPPORTED_MESSAGE_TYPE',
    MALFORMED_PAYLOAD: 'MALFORMED_PAYLOAD',

    // Connection errors
    CONNECTION_ERROR: 'CONNECTION_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    RECONNECT_FAILED: 'RECONNECT_FAILED',

    // Server errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

    // Object synchronization errors
    OBJECT_NOT_FOUND: 'OBJECT_NOT_FOUND',
    OBJECT_ACCESS_DENIED: 'OBJECT_ACCESS_DENIED',
    INVALID_OBJECT_DATA: 'INVALID_OBJECT_DATA',
    OBJECT_CONFLICT: 'OBJECT_CONFLICT',
    CANVAS_STATE_ERROR: 'CANVAS_STATE_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Message validation class
export class MessageProtocolValidator {
    /**
     * Validate incoming client message
     */
    static validateClientMessage(rawMessage: any): {
        success: boolean;
        message?: any;
        error?: {
            code: ErrorCode;
            message: string;
            details?: any
        };
    } {
        try {
            // Parse base message structure
            const baseMessage = BaseMessageSchema.parse(rawMessage);

            // Check if message type is supported
            if (!SUPPORTED_MESSAGE_TYPES.includes(baseMessage.type as MessageType)) {
                return {
                    success: false,
                    error: {
                        code: ERROR_CODES.UNSUPPORTED_MESSAGE_TYPE,
                        message: `Unsupported message type: ${baseMessage.type}`,
                        details: {
                            supportedTypes: SUPPORTED_MESSAGE_TYPES,
                            receivedType: baseMessage.type
                        }
                    }
                };
            }

            // Validate specific message schema
            const messageType = baseMessage.type as keyof typeof ClientMessageSchemas;
            const schema = ClientMessageSchemas[messageType] || ClientMessageSchemas.custom;

            const validatedMessage = schema.parse(rawMessage);

            return {
                success: true,
                message: validatedMessage
            };

        } catch (error) {
            if (error instanceof z.ZodError) {
                return {
                    success: false,
                    error: {
                        code: ERROR_CODES.MALFORMED_PAYLOAD,
                        message: 'Invalid message format',
                        details: {
                            validationErrors: error.issues,
                            receivedMessage: rawMessage
                        }
                    }
                };
            }

            return {
                success: false,
                error: {
                    code: ERROR_CODES.INVALID_MESSAGE,
                    message: 'Failed to parse message',
                    details: { error: error instanceof Error ? error.message : 'Unknown error' }
                }
            };
        }
    }

    /**
     * Create standardized error message
     */
    static createErrorMessage(
        code: ErrorCode,
        message: string,
        details?: any
    ): z.infer<typeof ServerMessageSchemas.error> {
        return {
            type: 'error',
            payload: {
                error: message,
                code,
                details
            },
            timestamp: Date.now()
        };
    }

    /**
     * Validate room ID format
     */
    static validateRoomId(roomId: string): {
        valid: boolean;
        error?: { code: ErrorCode; message: string };
    } {
        if (!roomId || typeof roomId !== 'string') {
            return {
                valid: false,
                error: {
                    code: ERROR_CODES.INVALID_ROOM_ID,
                    message: 'Room ID is required'
                }
            };
        }

        if (roomId.length < 1 || roomId.length > 50) {
            return {
                valid: false,
                error: {
                    code: ERROR_CODES.INVALID_ROOM_ID,
                    message: 'Room ID must be between 1 and 50 characters'
                }
            };
        }

        if (!/^[a-zA-Z0-9-_]+$/.test(roomId)) {
            return {
                valid: false,
                error: {
                    code: ERROR_CODES.INVALID_ROOM_ID,
                    message: 'Room ID can only contain letters, numbers, hyphens, and underscores'
                }
            };
        }

        return { valid: true };
    }

    /**
     * Validate user info format
     */
    static validateUserInfo(userInfo: any): {
        valid: boolean;
        user?: any;
        error?: { code: ErrorCode; message: string };
    } {
        try {
            const validatedUser = UserInfoSchema.parse(userInfo);
            return {
                valid: true,
                user: validatedUser
            };
        } catch (error) {
            if (error instanceof z.ZodError) {
                return {
                    valid: false,
                    error: {
                        code: ERROR_CODES.MALFORMED_PAYLOAD,
                        message: 'Invalid user information format'
                    }
                };
            }
            return {
                valid: false,
                error: {
                    code: ERROR_CODES.INVALID_MESSAGE,
                    message: 'Failed to validate user information'
                }
            };
        }
    }
}

// Message router for handling different message types
export class MessageRouter {
    private handlers: Map<MessageType, (clientId: string, message: any, context: any) => void> = new Map();

    /**
     * Register message handler
     */
    registerHandler(
        messageType: MessageType,
        handler: (clientId: string, message: any, context: any) => void
    ): void {
        this.handlers.set(messageType, handler);
    }

    /**
     * Route message to appropriate handler
     */
    route(clientId: string, rawMessage: any, context: any): boolean {
        const validation = MessageProtocolValidator.validateClientMessage(rawMessage);

        if (!validation.success) {
            // Send validation error back to client
            const errorMessage = MessageProtocolValidator.createErrorMessage(
                validation.error!.code,
                validation.error!.message,
                validation.error!.details
            );

            if (context.sendToClient) {
                context.sendToClient(clientId, errorMessage);
            }

            console.error(`Message validation failed for client ${clientId}:`, validation.error);
            return false;
        }

        const message = validation.message!;
        const handler = this.handlers.get(message.type as MessageType);

        if (handler) {
            try {
                handler(clientId, message, context);
                return true;
            } catch (error) {
                console.error(`Error handling message type ${message.type} for client ${clientId}:`, error);

                // Send internal error to client
                const errorMessage = MessageProtocolValidator.createErrorMessage(
                    ERROR_CODES.INTERNAL_ERROR,
                    'Internal server error while processing message',
                    { messageType: message.type }
                );

                if (context.sendToClient) {
                    context.sendToClient(clientId, errorMessage);
                }

                return false;
            }
        } else {
            console.warn(`No handler registered for message type: ${message.type}`);

            // Send unsupported message type error
            const errorMessage = MessageProtocolValidator.createErrorMessage(
                ERROR_CODES.UNSUPPORTED_MESSAGE_TYPE,
                `No handler available for message type: ${message.type}`,
                { messageType: message.type }
            );

            if (context.sendToClient) {
                context.sendToClient(clientId, errorMessage);
            }

            return false;
        }
    }

    /**
     * Get all registered message types
     */
    getRegisteredTypes(): MessageType[] {
        return Array.from(this.handlers.keys());
    }
}

// Rate limiting for message handling
export class RateLimiter {
    private clientLimits: Map<string, { count: number; resetTime: number }> = new Map();
    private readonly maxMessages: number;
    private readonly windowMs: number;

    constructor(maxMessages = 100, windowMs = 60000) { // 100 messages per minute by default
        this.maxMessages = maxMessages;
        this.windowMs = windowMs;
    }

    /**
     * Check if client has exceeded rate limit
     */
    checkLimit(clientId: string): boolean {
        const now = Date.now();
        const limit = this.clientLimits.get(clientId);

        if (!limit || now > limit.resetTime) {
            // Reset or initialize limit
            this.clientLimits.set(clientId, {
                count: 1,
                resetTime: now + this.windowMs
            });
            return true;
        }

        if (limit.count >= this.maxMessages) {
            return false; // Rate limit exceeded
        }

        limit.count++;
        return true;
    }

    /**
     * Get remaining messages for client
     */
    getRemaining(clientId: string): number {
        const limit = this.clientLimits.get(clientId);
        if (!limit) return this.maxMessages;
        return Math.max(0, this.maxMessages - limit.count);
    }

    /**
     * Reset limit for client
     */
    resetLimit(clientId: string): void {
        this.clientLimits.delete(clientId);
    }

    /**
     * Cleanup expired limits
     */
    cleanup(): void {
        const now = Date.now();
        for (const [clientId, limit] of this.clientLimits.entries()) {
            if (now > limit.resetTime) {
                this.clientLimits.delete(clientId);
            }
        }
    }
}

// Export canvas object schemas for use in other modules
export {
    BaseCanvasObjectSchema,
    RectangleObjectSchema,
    CircleObjectSchema,
    TextObjectSchema,
    CanvasObjectSchema,
};

export default {
    PROTOCOL_VERSION,
    SUPPORTED_MESSAGE_TYPES,
    ERROR_CODES,
    MessageProtocolValidator,
    MessageRouter,
    RateLimiter,
    ClientMessageSchemas,
    ServerMessageSchemas,
};
