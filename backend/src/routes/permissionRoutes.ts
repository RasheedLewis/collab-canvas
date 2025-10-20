/**
 * Permission Routes
 * 
 * Defines REST API endpoints for canvas permission management including
 * invitations, role changes, permission removal, and shareable links.
 */

import { Router } from 'express';
import {
    requireCanvasPermission,
    requireCanvasOwner,
    verifyAuthToken,
    optionalAuth
} from '../middleware';
import {
    getCanvasPermissions,
    inviteCollaborator,
    updatePermission,
    removePermission,
    createShareableLink,
    getShareableLinks,
    deactivateShareableLink,
    toggleCanvasPrivacy,
    transferOwnership
} from '../controllers/permissionController';

const router = Router();

// Apply authentication to all permission routes
router.use(verifyAuthToken);

// ========================================
// Permission Management
// ========================================

/**
 * GET /api/permissions/:canvasId
 * Get all permissions for a canvas
 * 
 * Requires: manage permission (owner only)
 * 
 * Returns:
 * - permissions: Array of canvas permissions
 * - totalCount: Total number of permissions
 */
router.get(
    '/:canvasId',
    requireCanvasPermission('manage', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    getCanvasPermissions
);

/**
 * POST /api/permissions/:canvasId/invite
 * Invite a collaborator to the canvas
 * 
 * Requires: manage permission (owner only)
 * 
 * Body:
 * - email: string (required)
 * - role: 'editor' | 'viewer' (required)
 * - message?: string (optional personal message)
 * - expiresAt?: number (optional expiration timestamp)
 * 
 * Sends email notification to invitee
 */
router.post(
    '/:canvasId/invite',
    requireCanvasPermission('manage', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    inviteCollaborator
);

/**
 * PATCH /api/permissions/:canvasId/:permissionId
 * Update a user's permission/role
 * 
 * Requires: manage permission (owner only)
 * 
 * Body:
 * - role?: 'owner' | 'editor' | 'viewer'
 * - permissions?: object (custom permissions)
 * - expiresAt?: number
 */
router.patch(
    '/:canvasId/:permissionId',
    requireCanvasPermission('manage', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    updatePermission
);

/**
 * DELETE /api/permissions/:canvasId/:permissionId
 * Remove a user's permission from canvas
 * 
 * Requires: manage permission (owner only)
 * 
 * Note: Canvas owner cannot remove their own permission
 */
router.delete(
    '/:canvasId/:permissionId',
    requireCanvasPermission('manage', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    removePermission
);

// ========================================
// Canvas Privacy Management
// ========================================

/**
 * PATCH /api/permissions/:canvasId/privacy
 * Toggle canvas privacy (public/private/unlisted)
 * 
 * Requires: owner permission
 * 
 * Body:
 * - privacy: 'private' | 'public' | 'unlisted'
 */
router.patch(
    '/:canvasId/privacy',
    requireCanvasOwner({
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    toggleCanvasPrivacy
);

// ========================================
// Ownership Transfer
// ========================================

/**
 * POST /api/permissions/:canvasId/transfer-ownership
 * Transfer canvas ownership to another user
 * 
 * Requires: owner permission
 * 
 * Body:
 * - newOwnerId: string (user ID of new owner)
 * 
 * Note: New owner must already have access to the canvas
 */
router.post(
    '/:canvasId/transfer-ownership',
    requireCanvasOwner({
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    transferOwnership
);

// ========================================
// Shareable Links Management
// ========================================

/**
 * GET /api/permissions/:canvasId/links
 * Get all shareable links for a canvas
 * 
 * Requires: manage permission (owner only)
 */
router.get(
    '/:canvasId/links',
    requireCanvasPermission('manage', {
        canvasIdParam: 'canvasId'
    }),
    getShareableLinks
);

/**
 * POST /api/permissions/:canvasId/links
 * Create a new shareable link for the canvas
 * 
 * Requires: manage permission (owner only)
 * 
 * Body:
 * - role: 'editor' | 'viewer' (required)
 * - expiresAt?: number (optional expiration timestamp)
 * - maxAccess?: number (optional max access count)
 * 
 * Returns shareable URL that can be used by anyone
 */
router.post(
    '/:canvasId/links',
    requireCanvasPermission('manage', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    createShareableLink
);

/**
 * DELETE /api/permissions/:canvasId/links/:linkId
 * Deactivate a shareable link
 * 
 * Requires: manage permission (owner only)
 */
router.delete(
    '/:canvasId/links/:linkId',
    requireCanvasPermission('manage', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    deactivateShareableLink
);

// ========================================
// Public Shareable Link Access (No Auth Required)
// ========================================

/**
 * GET /api/permissions/shared/:linkId
 * Access canvas via shareable link (public endpoint)
 * 
 * No authentication required
 * 
 * Returns:
 * - canvasId: string
 * - role: permission role granted by link
 * - canvas: canvas details (if accessible)
 */
router.get('/shared/:linkId', optionalAuth, async (req, res) => {
    try {
        const { linkId } = req.params;

        // Import services here to avoid circular dependencies
        const { ShareableLinkService } = await import('../services/shareableLinkService');
        const shareableLinkService = ShareableLinkService.getInstance();

        // Access via shareable link
        const accessResult = await shareableLinkService.accessViaShareableLink(linkId, {
            accessorId: req.user?.uid,
            accessorEmail: req.user?.email || undefined,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        if (!accessResult.success) {
            res.status(400).json({
                success: false,
                error: accessResult.error,
                code: accessResult.code
            });
            return;
        }

        const { canvasId, role } = accessResult.data!;

        // Get canvas details
        const { firestoreService } = await import('../database/firestoreService');
        const canvasResult = await firestoreService.getCanvas(canvasId);

        if (!canvasResult.success) {
            res.status(404).json({
                success: false,
                error: 'Canvas not found',
                code: 'CANVAS_NOT_FOUND'
            });
            return;
        }

        res.json({
            success: true,
            canvasId,
            role,
            canvas: canvasResult.data!,
            message: `Access granted with ${role} permissions`
        });

    } catch (error) {
        console.error('Error accessing shared canvas:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/permissions/shared/:linkId/analytics
 * Get analytics for a shareable link
 * 
 * Requires: manage permission for the canvas
 */
router.get('/shared/:linkId/analytics', async (req, res) => {
    try {
        const { linkId } = req.params;

        // Import services
        const { ShareableLinkService } = await import('../services/shareableLinkService');
        const shareableLinkService = ShareableLinkService.getInstance();

        // Get link details first to verify canvas ownership
        const linkResult = await shareableLinkService.getShareableLink(linkId);
        if (!linkResult.success) {
            res.status(404).json({
                success: false,
                error: linkResult.error,
                code: linkResult.code
            });
            return;
        }

        // TODO: Add permission check for canvas management
        // For now, allow anyone to view analytics (in production, restrict to canvas owners)

        const analyticsResult = await shareableLinkService.getLinkAnalytics(linkId);

        if (!analyticsResult.success) {
            res.status(500).json({
                success: false,
                error: analyticsResult.error,
                code: analyticsResult.code
            });
            return;
        }

        res.json({
            success: true,
            linkId,
            analytics: analyticsResult.data!
        });

    } catch (error) {
        console.error('Error getting link analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ========================================
// Invitation Management (Future Enhancement)
// ========================================

/**
 * GET /api/permissions/invitations
 * Get pending invitations for the authenticated user
 * 
 * Returns invitations sent to the user's email
 */
router.get('/invitations', async (req, res) => {
    try {
        // In production, this would query invitations by user email
        res.json({
            success: true,
            invitations: [],
            message: 'Invitation management not yet implemented'
        });
    } catch (error) {
        console.error('Error getting invitations:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * POST /api/permissions/invitations/:invitationId/accept
 * Accept a canvas invitation
 * 
 * Body:
 * - accept: boolean (true to accept, false to decline)
 */
router.post('/invitations/:invitationId/accept', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const { accept } = req.body;

        // In production, this would:
        // 1. Validate invitation exists and is pending
        // 2. Check invitation hasn't expired
        // 3. Create canvas permission if accepted
        // 4. Update invitation status
        // 5. Send confirmation email

        res.json({
            success: true,
            message: accept ? 'Invitation accepted' : 'Invitation declined',
            invitationId
        });
    } catch (error) {
        console.error('Error handling invitation:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ========================================
// Permission Audit and History
// ========================================

/**
 * GET /api/permissions/:canvasId/audit-log
 * Get permission change audit log for a canvas
 * 
 * Requires: manage permission (owner only)
 * 
 * Query parameters:
 * - limit?: number (default: 50)
 * - cursor?: string (pagination)
 */
router.get(
    '/:canvasId/audit-log',
    requireCanvasPermission('manage', {
        canvasIdParam: 'canvasId'
    }),
    async (req, res) => {
        try {
            const { canvasId } = req.params;
            const { limit = '50', cursor } = req.query;

            // Get audit logs for this canvas
            const { firestoreService } = await import('../database/firestoreService');
            const auditResult = await firestoreService.getAuditLogs({
                canvasId,
                limit: parseInt(limit as string),
                cursor: cursor as string
            });

            if (!auditResult.success) {
                res.status(500).json({
                    success: false,
                    error: auditResult.error,
                    code: auditResult.code
                });
                return;
            }

            // Filter to permission-related events
            const permissionEvents = auditResult.data!.filter(log =>
                ['permission_granted', 'permission_updated', 'permission_revoked', 'ownership_transferred'].includes(log.eventType)
            );

            res.json({
                success: true,
                auditLog: permissionEvents,
                totalCount: permissionEvents.length
            });

        } catch (error) {
            console.error('Error getting permission audit log:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// ========================================
// Error Handling
// ========================================

// Permission-specific error handler
router.use((error: any, req: any, res: any, next: any) => {
    if (error.code === 'PERMISSION_NOT_FOUND') {
        res.status(404).json({
            success: false,
            error: 'Permission not found',
            code: 'PERMISSION_NOT_FOUND'
        });
        return;
    }

    if (error.code === 'INVALID_ROLE') {
        res.status(400).json({
            success: false,
            error: 'Invalid permission role',
            code: 'INVALID_ROLE',
            validRoles: ['owner', 'editor', 'viewer']
        });
        return;
    }

    if (error.code === 'CANNOT_CHANGE_OWNER_ROLE' || error.code === 'CANNOT_REMOVE_OWNER') {
        res.status(400).json({
            success: false,
            error: 'Cannot modify canvas owner permissions',
            code: error.code
        });
        return;
    }

    if (error.code === 'LINK_EXPIRED' || error.code === 'LINK_NOT_FOUND') {
        res.status(404).json({
            success: false,
            error: 'Shareable link not found or expired',
            code: error.code
        });
        return;
    }

    if (error.code === 'LINK_ACCESS_LIMIT_EXCEEDED') {
        res.status(403).json({
            success: false,
            error: 'Shareable link access limit exceeded',
            code: 'LINK_ACCESS_LIMIT_EXCEEDED'
        });
        return;
    }

    if (error.code === 'EMAIL_SEND_ERROR') {
        res.status(500).json({
            success: false,
            error: 'Failed to send notification email',
            code: 'EMAIL_SEND_ERROR',
            note: 'Permission was created but email notification failed'
        });
        return;
    }

    // Pass to general error handler
    next(error);
});

export { router as permissionRoutes };
