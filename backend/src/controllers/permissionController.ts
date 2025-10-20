/**
 * Permission Controller
 * 
 * Handles canvas permission management including invitations, role changes,
 * permission removal, shareable links, and public canvas management.
 */

import { Response } from 'express';
import { CanvasAuthenticatedRequest } from '../middleware/canvasAuth';
import { firestoreService } from '../database/firestoreService';
import { PermissionService } from '../services/permissionService';
import { AuditLogService } from '../services/auditLogService';
import { EmailNotificationService } from '../services/emailNotificationService';
import { ShareableLinkService } from '../services/shareableLinkService';
import {
    CanvasPermission,
    PermissionRole,
    InviteCollaboratorRequest,
    UpdatePermissionRequest,
    CreateShareableLinkRequest,
    ShareableLink,
    CanvasInvitation
} from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

// Response types
interface PermissionResponse {
    success: boolean;
    permission?: CanvasPermission;
    error?: string;
    code?: string;
}

interface PermissionListResponse {
    success: boolean;
    permissions?: CanvasPermission[];
    totalCount?: number;
    error?: string;
    code?: string;
}

interface InvitationResponse {
    success: boolean;
    invitation?: CanvasInvitation;
    message?: string;
    error?: string;
    code?: string;
}

interface ShareableLinkResponse {
    success: boolean;
    link?: ShareableLink;
    url?: string;
    error?: string;
    code?: string;
}

interface ShareableLinkListResponse {
    success: boolean;
    links?: ShareableLink[];
    totalCount?: number;
    error?: string;
    code?: string;
}

/**
 * Get all permissions for a canvas
 */
export const getCanvasPermissions = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;

        const permissionsResult = await firestoreService.getCanvasPermissions(canvasId);
        if (!permissionsResult.success) {
            res.status(500).json({
                success: false,
                error: permissionsResult.error,
                code: permissionsResult.code
            });
            return;
        }

        const response: PermissionListResponse = {
            success: true,
            permissions: permissionsResult.data!,
            totalCount: permissionsResult.data!.length
        };

        res.json(response);
    } catch (error) {
        console.error('Error getting canvas permissions:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Invite a collaborator to the canvas
 */
export const inviteCollaborator = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;
        const inviteRequest = req.body as InviteCollaboratorRequest;

        // Validate request
        if (!inviteRequest.email || !inviteRequest.role) {
            res.status(400).json({
                success: false,
                error: 'Email and role are required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }

        if (!['editor', 'viewer'].includes(inviteRequest.role)) {
            res.status(400).json({
                success: false,
                error: 'Role must be editor or viewer',
                code: 'INVALID_ROLE'
            });
            return;
        }

        // Get canvas details
        const canvasResult = await firestoreService.getCanvas(canvasId);
        if (!canvasResult.success) {
            res.status(404).json({
                success: false,
                error: canvasResult.error,
                code: canvasResult.code
            });
            return;
        }

        const canvas = canvasResult.data!;

        // Check if user is already invited or has access
        const existingPermissions = await firestoreService.getCanvasPermissions(canvasId);
        if (existingPermissions.success) {
            // Check if email corresponds to existing user with permission
            // In production, you'd lookup user by email first
            const hasExistingPermission = existingPermissions.data!.some(perm => {
                // This would need user email lookup in production
                return false; // Placeholder
            });

            if (hasExistingPermission) {
                res.status(400).json({
                    success: false,
                    error: 'User already has access to this canvas',
                    code: 'ALREADY_HAS_ACCESS'
                });
                return;
            }
        }

        // Create invitation
        const invitation: CanvasInvitation = {
            id: uuidv4(),
            canvasId,
            inviterUserId: userId,
            inviteeEmail: inviteRequest.email,
            role: inviteRequest.role,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: inviteRequest.expiresAt || (Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7 days
            message: inviteRequest.message
        };

        // Save invitation (in production, this would be a separate collection)
        console.log('Creating invitation:', invitation);

        // Send email notification
        const emailService = EmailNotificationService.getInstance();
        const emailResult = await emailService.sendCollaboratorInvite({
            inviteeEmail: inviteRequest.email,
            inviterName: req.user!.displayName || req.user!.email || 'Someone',
            canvasName: canvas.name,
            canvasId: canvas.id,
            role: inviteRequest.role,
            message: inviteRequest.message,
            invitationId: invitation.id,
            expiresAt: invitation.expiresAt
        });

        if (!emailResult.success) {
            console.warn('Failed to send invitation email:', emailResult.error);
            // Continue anyway - invitation is created
        }

        // Log audit event
        const auditService = AuditLogService.getInstance();
        await auditService.logPermissionGranted({
            permissionId: invitation.id,
            canvasId,
            targetUserId: inviteRequest.email, // Using email as target for invitation
            changedBy: userId,
            action: 'granted',
            newRole: inviteRequest.role,
            reason: `Invited ${inviteRequest.email} as ${inviteRequest.role}`,
            timestamp: Date.now(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        const response: InvitationResponse = {
            success: true,
            invitation,
            message: `Invitation sent to ${inviteRequest.email}`
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error inviting collaborator:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Update a user's permission/role
 */
export const updatePermission = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId, permissionId } = req.params;
        const userId = req.user!.uid;
        const updateRequest = req.body as UpdatePermissionRequest;

        // Get current permission
        const permissionsResult = await firestoreService.getCanvasPermissions(canvasId);
        if (!permissionsResult.success) {
            res.status(500).json({
                success: false,
                error: permissionsResult.error,
                code: permissionsResult.code
            });
            return;
        }

        const currentPermission = permissionsResult.data!.find(p => p.id === permissionId);
        if (!currentPermission) {
            res.status(404).json({
                success: false,
                error: 'Permission not found',
                code: 'PERMISSION_NOT_FOUND'
            });
            return;
        }

        // Validate role change
        if (updateRequest.role && !['owner', 'editor', 'viewer'].includes(updateRequest.role)) {
            res.status(400).json({
                success: false,
                error: 'Invalid role',
                code: 'INVALID_ROLE'
            });
            return;
        }

        // Prevent owner from changing their own role
        if (currentPermission.role === 'owner' && currentPermission.userId === userId) {
            res.status(400).json({
                success: false,
                error: 'Canvas owner cannot change their own role',
                code: 'CANNOT_CHANGE_OWNER_ROLE'
            });
            return;
        }

        // Update permission
        const permissionService = PermissionService.getInstance();
        const updateResult = await permissionService.updatePermissionRole(
            canvasId,
            currentPermission.userId,
            updateRequest.role || currentPermission.role,
            {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                updatedBy: userId
            }
        );

        if (!updateResult.success) {
            res.status(500).json({
                success: false,
                error: updateResult.error,
                code: updateResult.code
            });
            return;
        }

        // Log audit event
        const auditService = AuditLogService.getInstance();
        await auditService.logPermissionUpdated({
            permissionId,
            canvasId,
            targetUserId: currentPermission.userId,
            changedBy: userId,
            action: 'updated',
            previousRole: currentPermission.role,
            newRole: updateRequest.role || currentPermission.role,
            reason: 'Role updated by canvas owner',
            timestamp: Date.now(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        const response: PermissionResponse = {
            success: true,
            permission: updateResult.data!
        };

        res.json(response);
    } catch (error) {
        console.error('Error updating permission:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Remove a user's permission from canvas
 */
export const removePermission = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId, permissionId } = req.params;
        const userId = req.user!.uid;

        // Get current permission
        const permissionsResult = await firestoreService.getCanvasPermissions(canvasId);
        if (!permissionsResult.success) {
            res.status(500).json({
                success: false,
                error: permissionsResult.error,
                code: permissionsResult.code
            });
            return;
        }

        const currentPermission = permissionsResult.data!.find(p => p.id === permissionId);
        if (!currentPermission) {
            res.status(404).json({
                success: false,
                error: 'Permission not found',
                code: 'PERMISSION_NOT_FOUND'
            });
            return;
        }

        // Prevent owner from removing their own permission
        if (currentPermission.role === 'owner' && currentPermission.userId === userId) {
            res.status(400).json({
                success: false,
                error: 'Canvas owner cannot remove their own permission',
                code: 'CANNOT_REMOVE_OWNER'
            });
            return;
        }

        // Remove permission
        const permissionService = PermissionService.getInstance();
        const removeResult = await permissionService.deletePermission(
            canvasId,
            currentPermission.userId,
            {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                removedBy: userId
            }
        );

        if (!removeResult.success) {
            res.status(500).json({
                success: false,
                error: removeResult.error,
                code: removeResult.code
            });
            return;
        }

        // Log audit event
        const auditService = AuditLogService.getInstance();
        await auditService.logPermissionRevoked({
            permissionId,
            canvasId,
            targetUserId: currentPermission.userId,
            changedBy: userId,
            action: 'revoked',
            previousRole: currentPermission.role,
            reason: 'Permission removed by canvas owner',
            timestamp: Date.now(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Permission removed successfully'
        });
    } catch (error) {
        console.error('Error removing permission:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Create a shareable link for the canvas
 */
export const createShareableLink = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;
        const linkRequest = req.body as CreateShareableLinkRequest;

        // Validate request
        if (!linkRequest.role || !['editor', 'viewer'].includes(linkRequest.role)) {
            res.status(400).json({
                success: false,
                error: 'Role must be editor or viewer',
                code: 'INVALID_ROLE'
            });
            return;
        }

        const shareableLinkService = ShareableLinkService.getInstance();
        const result = await shareableLinkService.createShareableLink({
            canvasId,
            createdBy: userId,
            role: linkRequest.role,
            expiresAt: linkRequest.expiresAt,
            maxAccess: linkRequest.maxAccess
        });

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
                code: result.code
            });
            return;
        }

        const shareableLink = result.data!;

        // Generate public URL
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const shareUrl = `${baseUrl}/canvas/shared/${shareableLink.id}`;

        // Log audit event
        const auditService = AuditLogService.getInstance();
        await auditService.logCanvasAccess({
            userId,
            canvasId,
            action: `Created shareable link with ${linkRequest.role} access`,
            role: linkRequest.role,
            granted: true,
            timestamp: Date.now(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        const response: ShareableLinkResponse = {
            success: true,
            link: shareableLink,
            url: shareUrl
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating shareable link:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Get all shareable links for a canvas
 */
export const getShareableLinks = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;

        const shareableLinkService = ShareableLinkService.getInstance();
        const result = await shareableLinkService.getCanvasLinks(canvasId);

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
                code: result.code
            });
            return;
        }

        const response: ShareableLinkListResponse = {
            success: true,
            links: result.data!,
            totalCount: result.data!.length
        };

        res.json(response);
    } catch (error) {
        console.error('Error getting shareable links:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Deactivate a shareable link
 */
export const deactivateShareableLink = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId, linkId } = req.params;
        const userId = req.user!.uid;

        const shareableLinkService = ShareableLinkService.getInstance();
        const result = await shareableLinkService.deactivateLink(linkId, userId);

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
                code: result.code
            });
            return;
        }

        // Log audit event
        const auditService = AuditLogService.getInstance();
        await auditService.logCanvasAccess({
            userId,
            canvasId,
            action: 'Deactivated shareable link',
            granted: true,
            timestamp: Date.now(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Shareable link deactivated successfully'
        });
    } catch (error) {
        console.error('Error deactivating shareable link:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Toggle canvas privacy (public/private)
 */
export const toggleCanvasPrivacy = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;
        const { privacy } = req.body;

        // Validate privacy value
        if (!privacy || !['private', 'public', 'unlisted'].includes(privacy)) {
            res.status(400).json({
                success: false,
                error: 'Privacy must be private, public, or unlisted',
                code: 'INVALID_PRIVACY'
            });
            return;
        }

        // Update canvas privacy
        const updateResult = await firestoreService.updateCanvas(canvasId, { privacy }, userId);

        if (!updateResult.success) {
            res.status(500).json({
                success: false,
                error: updateResult.error,
                code: updateResult.code
            });
            return;
        }

        // Log audit event
        const auditService = AuditLogService.getInstance();
        await auditService.logCanvasAccess({
            userId,
            canvasId,
            action: `Canvas privacy changed to ${privacy}`,
            granted: true,
            timestamp: Date.now(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            canvas: updateResult.data!,
            message: `Canvas privacy updated to ${privacy}`
        });
    } catch (error) {
        console.error('Error toggling canvas privacy:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Transfer canvas ownership
 */
export const transferOwnership = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;
        const { newOwnerId } = req.body;

        if (!newOwnerId) {
            res.status(400).json({
                success: false,
                error: 'New owner ID is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }

        // Ensure new owner has existing permission
        const permissionsResult = await firestoreService.getCanvasPermissions(canvasId);
        if (!permissionsResult.success) {
            res.status(500).json({
                success: false,
                error: permissionsResult.error,
                code: permissionsResult.code
            });
            return;
        }

        const newOwnerPermission = permissionsResult.data!.find(p => p.userId === newOwnerId);
        if (!newOwnerPermission) {
            res.status(400).json({
                success: false,
                error: 'New owner must already have access to the canvas',
                code: 'NEW_OWNER_NO_ACCESS'
            });
            return;
        }

        // Transfer ownership using permission service
        const permissionService = PermissionService.getInstance();
        const transferResult = await permissionService.transferOwnership(
            canvasId,
            userId,
            newOwnerId,
            {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        );

        if (!transferResult.success) {
            res.status(500).json({
                success: false,
                error: transferResult.error,
                code: transferResult.code
            });
            return;
        }

        // Log audit event
        const auditService = AuditLogService.getInstance();
        await auditService.logCanvasAccess({
            userId,
            canvasId,
            action: `Canvas ownership transferred to ${newOwnerId}`,
            granted: true,
            timestamp: Date.now(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Canvas ownership transferred successfully'
        });
    } catch (error) {
        console.error('Error transferring ownership:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
