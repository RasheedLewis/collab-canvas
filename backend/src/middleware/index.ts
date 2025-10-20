/**
 * Middleware Index
 * 
 * Exports all middleware functions for the CollabCanvas application.
 */

// Authentication middleware (existing)
export {
    verifyAuthToken,
    optionalAuth,
    getCurrentUser,
    refreshToken,
    type AuthenticatedRequest
} from '../handlers/authHandler';

// AI middleware (existing)
export { aiAuthMiddleware, aiRateLimitMiddleware } from './aiMiddleware';

// Canvas permission middleware (new)
export {
    requireCanvasPermission,
    requireCanvasRole,
    requireCanvasOwner,
    optionalCanvasPermission,
    PermissionValidator,
    type CanvasAuthenticatedRequest,
    type PermissionAction
} from './canvasAuth';

// Re-export permission utilities
export { PermissionConfig } from '../config/permissions';
