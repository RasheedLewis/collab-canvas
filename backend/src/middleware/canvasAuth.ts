/**
 * Canvas Permission Middleware
 * 
 * Provides middleware for validating canvas permissions and access control.
 * Built on top of the existing Firebase authentication system.
 */

import { Request, Response, NextFunction } from 'express';
import { CanvasPermission } from '../models/CanvasPermission';
import { PermissionRole, canPerformAction } from '../../../shared/types';
import { PermissionCacheService } from '../services/permissionCacheService';
import { AuditLogService } from '../services/auditLogService';
import { AuthenticatedRequest } from '../handlers/authHandler';

// Extended request interface with canvas permission info
export interface CanvasAuthenticatedRequest extends AuthenticatedRequest {
    canvasPermission?: CanvasPermission;
    canvasId?: string;
}

// Permission action types for different endpoints
export type PermissionAction = 'view' | 'edit' | 'share' | 'delete' | 'manage';

/**
 * Middleware to validate canvas access permissions
 */
export function requireCanvasPermission(
    action: PermissionAction,
    options: {
        canvasIdParam?: string; // Parameter name for canvas ID (default: 'canvasId')
        allowOwnerOverride?: boolean; // Allow canvas owner to override any permission
        requireExplicitPermission?: boolean; // Don't allow public canvas access
        logAccess?: boolean; // Log access attempts for audit
    } = {}
) {
    const {
        canvasIdParam = 'canvasId',
        allowOwnerOverride = true,
        requireExplicitPermission = false,
        logAccess = true
    } = options;

    return async (
        req: CanvasAuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // Ensure user is authenticated
            if (!req.user?.uid) {
                res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                return;
            }

            // Extract canvas ID from request
            const canvasId = req.params[canvasIdParam] || req.body?.canvasId || req.query?.canvasId;
            if (!canvasId) {
                res.status(400).json({
                    error: 'Canvas ID is required',
                    code: 'CANVAS_ID_MISSING'
                });
                return;
            }

            req.canvasId = canvasId;

            // Check permission cache first
            const cachedPermission = await PermissionCacheService.getInstance()
                .getUserCanvasPermission(req.user.uid, canvasId);

            let permission: CanvasPermission | null = null;

            if (cachedPermission) {
                permission = CanvasPermission.fromData(cachedPermission);
            } else {
                // Load permission from database (mocked for now)
                // In production: permission = await PermissionService.getUserPermission(req.user.uid, canvasId);

                // For now, simulate permission lookup
                permission = await simulatePermissionLookup(req.user.uid, canvasId);

                // Cache the permission
                if (permission) {
                    await PermissionCacheService.getInstance()
                        .cacheUserCanvasPermission(req.user.uid, canvasId, permission.toJSON());
                }
            }

            // Check if permission exists and is valid
            if (!permission) {
                if (!requireExplicitPermission) {
                    // Check if canvas is public and allows the requested action
                    const canvasIsPublic = await checkPublicCanvasAccess(canvasId, action);
                    if (!canvasIsPublic) {
                        res.status(403).json({
                            error: 'Access denied - no permission for this canvas',
                            code: 'PERMISSION_DENIED'
                        });
                        return;
                    }
                } else {
                    res.status(403).json({
                        error: 'Access denied - explicit permission required',
                        code: 'EXPLICIT_PERMISSION_REQUIRED'
                    });
                    return;
                }
            }

            // Check if permission has expired
            if (permission && permission.isExpired()) {
                res.status(403).json({
                    error: 'Access denied - permission has expired',
                    code: 'PERMISSION_EXPIRED'
                });
                return;
            }

            // Validate the specific action
            if (permission && !permission.canPerformAction(action)) {
                // Check owner override if enabled
                if (allowOwnerOverride && permission.isOwner()) {
                    // Owners can always perform any action
                } else {
                    res.status(403).json({
                        error: `Access denied - insufficient permissions for action: ${action}`,
                        code: 'INSUFFICIENT_PERMISSIONS',
                        requiredAction: action,
                        userRole: permission.role
                    });
                    return;
                }
            }

            // Add permission to request for use in route handlers
            if (permission) {
                req.canvasPermission = permission;
            }

            // Log access attempt if enabled
            if (logAccess) {
                await AuditLogService.getInstance().logCanvasAccess({
                    userId: req.user.uid,
                    canvasId,
                    action,
                    granted: true,
                    role: permission?.role || 'public',
                    timestamp: Date.now(),
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });
            }

            next();
        } catch (error) {
            console.error('Canvas permission middleware error:', error);

            // Log failed access attempt
            if (options.logAccess) {
                await AuditLogService.getInstance().logCanvasAccess({
                    userId: req.user?.uid || 'unknown',
                    canvasId: req.canvasId || 'unknown',
                    action,
                    granted: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now(),
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });
            }

            res.status(500).json({
                error: 'Internal server error during permission check',
                code: 'PERMISSION_CHECK_ERROR'
            });
        }
    };
}

/**
 * Middleware to require specific role
 */
export function requireCanvasRole(
    minRole: PermissionRole,
    options: {
        canvasIdParam?: string;
        logAccess?: boolean;
    } = {}
) {
    const { canvasIdParam = 'canvasId', logAccess = true } = options;

    return async (
        req: CanvasAuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // Ensure user is authenticated
            if (!req.user?.uid) {
                res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                return;
            }

            // Extract canvas ID
            const canvasId = req.params[canvasIdParam] || req.body?.canvasId || req.query?.canvasId;
            if (!canvasId) {
                res.status(400).json({
                    error: 'Canvas ID is required',
                    code: 'CANVAS_ID_MISSING'
                });
                return;
            }

            req.canvasId = canvasId;

            // Get user permission
            const permission = await getUserPermissionWithCache(req.user.uid, canvasId);

            if (!permission) {
                res.status(403).json({
                    error: 'Access denied - no permission for this canvas',
                    code: 'PERMISSION_DENIED'
                });
                return;
            }

            // Check if permission has expired
            if (permission.isExpired()) {
                res.status(403).json({
                    error: 'Access denied - permission has expired',
                    code: 'PERMISSION_EXPIRED'
                });
                return;
            }

            // Check role hierarchy
            const roleHierarchy = { viewer: 1, editor: 2, owner: 3 };
            const userRoleLevel = roleHierarchy[permission.role];
            const requiredRoleLevel = roleHierarchy[minRole];

            if (userRoleLevel < requiredRoleLevel) {
                res.status(403).json({
                    error: `Access denied - ${minRole} role required`,
                    code: 'INSUFFICIENT_ROLE',
                    userRole: permission.role,
                    requiredRole: minRole
                });
                return;
            }

            req.canvasPermission = permission;

            // Log access attempt
            if (logAccess) {
                await AuditLogService.getInstance().logCanvasAccess({
                    userId: req.user.uid,
                    canvasId,
                    action: `require_role_${minRole}`,
                    granted: true,
                    role: permission.role,
                    timestamp: Date.now(),
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });
            }

            next();
        } catch (error) {
            console.error('Canvas role middleware error:', error);
            res.status(500).json({
                error: 'Internal server error during role check',
                code: 'ROLE_CHECK_ERROR'
            });
        }
    };
}

/**
 * Middleware to check canvas ownership
 */
export function requireCanvasOwner(
    options: {
        canvasIdParam?: string;
        logAccess?: boolean;
    } = {}
) {
    return requireCanvasRole('owner', options);
}

/**
 * Middleware for optional canvas permission (doesn't fail if no permission)
 */
export function optionalCanvasPermission(
    canvasIdParam: string = 'canvasId'
) {
    return async (
        req: CanvasAuthenticatedRequest,
        _res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.user?.uid) {
                next();
                return;
            }

            const canvasId = req.params[canvasIdParam] || req.body?.canvasId || req.query?.canvasId;
            if (!canvasId) {
                next();
                return;
            }

            req.canvasId = canvasId;

            // Try to get permission but don't fail if not found
            const permission = await getUserPermissionWithCache(req.user.uid, canvasId);

            if (permission && !permission.isExpired()) {
                req.canvasPermission = permission;
            }

            next();
        } catch (error) {
            console.error('Optional canvas permission middleware error:', error);
            next(); // Continue even if permission check fails
        }
    };
}

// ========================================
// Helper Functions
// ========================================

/**
 * Get user permission with caching
 */
async function getUserPermissionWithCache(
    userId: string,
    canvasId: string
): Promise<CanvasPermission | null> {
    // Check cache first
    const cachedPermission = await PermissionCacheService.getInstance()
        .getUserCanvasPermission(userId, canvasId);

    if (cachedPermission) {
        return CanvasPermission.fromData(cachedPermission);
    }

    // Load from database (mocked for now)
    const permission = await simulatePermissionLookup(userId, canvasId);

    // Cache the result
    if (permission) {
        await PermissionCacheService.getInstance()
            .cacheUserCanvasPermission(userId, canvasId, permission.toJSON());
    }

    return permission;
}

/**
 * Simulate permission lookup (replace with actual database query)
 */
async function simulatePermissionLookup(
    userId: string,
    canvasId: string
): Promise<CanvasPermission | null> {
    // This would be replaced with actual database query in production
    // For now, return a mock permission for demo purposes

    // Simulate canvas owner having full permissions
    if (canvasId === 'demo-canvas-1' && userId === 'demo-user-1') {
        return CanvasPermission.createOwnerPermission(canvasId, userId);
    }

    // Simulate editor permission for another user
    if (canvasId === 'demo-canvas-1' && userId === 'demo-user-2') {
        return new CanvasPermission({
            canvasId,
            userId,
            role: 'editor',
            grantedBy: 'demo-user-1'
        });
    }

    return null;
}

/**
 * Check if canvas allows public access for the given action
 */
async function checkPublicCanvasAccess(
    canvasId: string,
    action: PermissionAction
): Promise<boolean> {
    // This would check canvas privacy settings in production
    // For now, return false (no public access)
    return false;
}

/**
 * Permission validation utilities
 */
export class PermissionValidator {
    /**
     * Check if user can perform multiple actions
     */
    static canPerformActions(
        permission: CanvasPermission,
        actions: PermissionAction[]
    ): { [key in PermissionAction]?: boolean } {
        const result: { [key in PermissionAction]?: boolean } = {};

        for (const action of actions) {
            result[action] = permission.canPerformAction(action);
        }

        return result;
    }

    /**
     * Get user's effective permissions summary
     */
    static getPermissionSummary(permission: CanvasPermission): {
        role: PermissionRole;
        canView: boolean;
        canEdit: boolean;
        canShare: boolean;
        canDelete: boolean;
        canManage: boolean;
        isExpired: boolean;
        expiresAt?: number;
    } {
        return {
            role: permission.role,
            canView: permission.canPerformAction('view'),
            canEdit: permission.canPerformAction('edit'),
            canShare: permission.canPerformAction('share'),
            canDelete: permission.canPerformAction('delete'),
            canManage: permission.canPerformAction('manage'),
            isExpired: permission.isExpired(),
            expiresAt: permission.expiresAt
        };
    }
}
