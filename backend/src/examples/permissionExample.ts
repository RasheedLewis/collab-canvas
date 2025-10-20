/**
 * Permission System Usage Examples
 * 
 * Demonstrates how to use the permission system in route handlers and services.
 * These examples show best practices for canvas permission management.
 */

import { Request, Response, NextFunction } from 'express';
import {
    requireCanvasPermission,
    requireCanvasRole,
    requireCanvasOwner,
    CanvasAuthenticatedRequest
} from '../middleware/canvasAuth';
import { PermissionService } from '../services/permissionService';

// ========================================
// Example Route Handlers with Permission Middleware
// ========================================

/**
 * Example: Get canvas objects (requires view permission)
 */
export const getCanvasObjects = [
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    async (req: CanvasAuthenticatedRequest, res: Response) => {
        try {
            const { canvasId } = req.params;

            // At this point, we know the user has view permission
            // req.canvasPermission contains the user's permission object

            // Get objects for the canvas
            // const objects = await CanvasObjectService.getObjects(canvasId);

            res.json({
                success: true,
                canvasId,
                userRole: req.canvasPermission?.role,
                objects: [] // Would contain actual objects
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get canvas objects' });
        }
    }
];

/**
 * Example: Create canvas object (requires edit permission)
 */
export const createCanvasObject = [
    requireCanvasPermission('edit', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    async (req: CanvasAuthenticatedRequest, res: Response) => {
        try {
            const { canvasId } = req.params;
            const { type, x, y, color } = req.body;

            // User has edit permission, can create objects
            // const newObject = await CanvasObjectService.createObject({
            //     canvasId,
            //     type,
            //     x,
            //     y,
            //     color,
            //     userId: req.user!.uid
            // });

            res.json({
                success: true,
                message: 'Object created successfully',
                canvasId,
                userRole: req.canvasPermission?.role
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create object' });
        }
    }
];

/**
 * Example: Share canvas (requires owner role)
 */
export const shareCanvas = [
    requireCanvasOwner({
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    async (req: CanvasAuthenticatedRequest, res: Response) => {
        try {
            const { canvasId } = req.params;
            const { email, role, expiresAt } = req.body;

            const permissionService = PermissionService.getInstance();

            // Grant permission to the user
            const permission = await permissionService.grantPermission(
                canvasId,
                email, // In practice, you'd resolve email to userId
                role,
                req.user!.uid,
                {
                    expiresAt,
                    reason: 'Canvas shared via API',
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            );

            res.json({
                success: true,
                message: 'Canvas shared successfully',
                permission: {
                    userId: permission.userId,
                    role: permission.role,
                    expiresAt: permission.expiresAt
                }
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to share canvas'
            });
        }
    }
];

/**
 * Example: Update canvas settings (requires owner role)
 */
export const updateCanvasSettings = [
    requireCanvasRole('owner'),
    async (req: CanvasAuthenticatedRequest, res: Response) => {
        try {
            const { canvasId } = req.params;
            const { name, description, privacy } = req.body;

            // Owner can update canvas settings
            // await CanvasService.updateCanvas(canvasId, { name, description, privacy });

            res.json({
                success: true,
                message: 'Canvas updated successfully',
                canvasId
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update canvas' });
        }
    }
];

// ========================================
// Example Service Methods Using Permission System
// ========================================

export class ExampleCanvasService {
    private permissionService = PermissionService.getInstance();

    /**
     * Example: Get canvas with permission context
     */
    async getCanvasWithPermissions(canvasId: string, userId: string) {
        // Get user's permission for the canvas
        const permission = await this.permissionService.getUserPermission(userId, canvasId);

        if (!permission) {
            throw new Error('No access to this canvas');
        }

        if (permission.isExpired()) {
            throw new Error('Access has expired');
        }

        // Get canvas data based on permission level
        const canShowPrivateData = permission.canPerformAction('manage');

        return {
            // canvas: await CanvasService.getCanvas(canvasId, canShowPrivateData),
            userPermission: {
                role: permission.role,
                canEdit: permission.canEdit(),
                canShare: permission.canShare(),
                canManage: permission.canManagePermissions()
            }
        };
    }

    /**
     * Example: Bulk permission management
     */
    async addMultipleCollaborators(
        canvasId: string,
        collaborators: Array<{ email: string; role: 'viewer' | 'editor' }>,
        ownerId: string
    ) {
        const grants = collaborators.map(collab => ({
            userId: collab.email, // In practice, resolve email to userId
            role: collab.role as 'viewer' | 'editor'
        }));

        const result = await this.permissionService.grantBatchPermissions(
            canvasId,
            grants,
            ownerId,
            {
                reason: 'Bulk collaborator addition'
            }
        );

        return {
            successful: result.successful.length,
            failed: result.failed.length,
            details: result
        };
    }

    /**
     * Example: Permission validation with detailed feedback
     */
    async validateUserAction(
        userId: string,
        canvasId: string,
        action: 'view' | 'edit' | 'share' | 'delete' | 'manage'
    ) {
        const validation = await this.permissionService.validatePermission(
            userId,
            canvasId,
            action
        );

        if (!validation.valid) {
            return {
                allowed: false,
                error: validation.error,
                code: validation.code
            };
        }

        return {
            allowed: true,
            permission: validation.permission,
            capabilities: {
                canView: validation.permission!.canPerformAction('view'),
                canEdit: validation.permission!.canPerformAction('edit'),
                canShare: validation.permission!.canPerformAction('share'),
                canDelete: validation.permission!.canPerformAction('delete'),
                canManage: validation.permission!.canPerformAction('manage')
            }
        };
    }

    /**
     * Example: Get user's accessible canvases
     */
    async getUserAccessibleCanvases(userId: string) {
        const canvases = await this.permissionService.getUserCanvases(userId);

        // Sort by role (owners first, then editors, then viewers)
        const roleOrder = { owner: 0, editor: 1, viewer: 2 };

        return canvases.sort((a, b) => {
            const roleCompare = roleOrder[a.role] - roleOrder[b.role];
            if (roleCompare !== 0) return roleCompare;

            // If same role, sort by granted date (newest first)
            return b.grantedAt - a.grantedAt;
        });
    }
}

// ========================================
// Example Error Handling with Permissions
// ========================================

/**
 * Example middleware for handling permission errors
 */
export const permissionErrorHandler = (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (error.code === 'PERMISSION_DENIED') {
        res.status(403).json({
            error: 'Access denied',
            message: error.message,
            code: error.code,
            canvasId: error.canvasId,
            requiredRole: error.requiredRole
        });
        return;
    }

    if (error.code === 'PERMISSION_EXPIRED') {
        res.status(403).json({
            error: 'Access expired',
            message: 'Your access to this canvas has expired',
            code: error.code,
            canvasId: error.canvasId
        });
        return;
    }

    next(error);
};

// ========================================
// Example Usage in Express Router
// ========================================

/*
import { Router } from 'express';

const canvasRouter = Router();

// Apply authentication to all routes
canvasRouter.use(verifyAuthToken);

// Canvas operations
canvasRouter.get('/:canvasId/objects', getCanvasObjects);
canvasRouter.post('/:canvasId/objects', createCanvasObject);
canvasRouter.post('/:canvasId/share', shareCanvas);
canvasRouter.patch('/:canvasId', updateCanvasSettings);

// Permission-specific routes
canvasRouter.get('/:canvasId/permissions', [
    requireCanvasRole('viewer'),
    async (req: CanvasAuthenticatedRequest, res: Response) => {
        // Get all permissions for canvas (viewers can see who has access)
        const permissions = await PermissionService.getInstance()
            .getCanvasPermissions(req.params.canvasId);
        
        res.json({ permissions });
    }
]);

canvasRouter.post('/:canvasId/permissions', [
    requireCanvasOwner(),
    async (req: CanvasAuthenticatedRequest, res: Response) => {
        // Grant new permission (only owners can do this)
        // Implementation here...
    }
]);

// Error handling
canvasRouter.use(permissionErrorHandler);

export { canvasRouter };
*/
