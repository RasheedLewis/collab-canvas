/**
 * Permission Service
 * 
 * Core service for managing canvas permissions, roles, and access control.
 * Integrates caching, audit logging, and permission inheritance.
 */

import {
    CanvasPermission as CanvasPermissionType,
    PermissionRole,
    InviteCollaboratorRequest,
    UpdatePermissionRequest,
    hasPermission
} from '../../../shared/types';
import { CanvasPermission } from '../models/CanvasPermission';
import { Canvas } from '../models/Canvas';
import { PermissionCacheService } from './permissionCacheService';
import { AuditLogService } from './auditLogService';

// Permission validation result
export interface PermissionValidationResult {
    valid: boolean;
    permission?: CanvasPermission;
    error?: string;
    code?: string;
}

// Permission summary for a user on a canvas
export interface UserCanvasPermissionSummary {
    canvasId: string;
    userId: string;
    role: PermissionRole;
    canView: boolean;
    canEdit: boolean;
    canShare: boolean;
    canDelete: boolean;
    canManage: boolean;
    isExpired: boolean;
    expiresAt?: number;
    grantedBy: string;
    grantedAt: number;
}

// Batch permission operation result
export interface BatchPermissionResult {
    successful: Array<{ userId: string; permission: CanvasPermission }>;
    failed: Array<{ userId: string; error: string; code: string }>;
    summary: {
        total: number;
        successful: number;
        failed: number;
    };
}

/**
 * Core permission management service
 */
export class PermissionService {
    private static instance: PermissionService;

    private cacheService: PermissionCacheService;
    private auditService: AuditLogService;

    // In-memory store (would be replaced with Firestore in production)
    private permissions: Map<string, CanvasPermission> = new Map();

    private constructor() {
        this.cacheService = PermissionCacheService.getInstance();
        this.auditService = AuditLogService.getInstance();
    }

    static getInstance(): PermissionService {
        if (!PermissionService.instance) {
            PermissionService.instance = new PermissionService();
        }
        return PermissionService.instance;
    }

    // ========================================
    // Permission Creation and Management
    // ========================================

    /**
     * Create owner permission for new canvas
     */
    async createOwnerPermission(
        canvasId: string,
        userId: string,
        context?: {
            ipAddress?: string;
            userAgent?: string;
        }
    ): Promise<CanvasPermission> {
        const permission = CanvasPermission.createOwnerPermission(canvasId, userId);

        // Store permission
        const key = this.getPermissionKey(userId, canvasId);
        this.permissions.set(key, permission);

        // Cache permission
        await this.cacheService.cacheUserCanvasPermission(
            userId,
            canvasId,
            permission.toJSON()
        );

        // Audit log
        await this.auditService.logPermissionGranted({
            canvasId,
            targetUserId: userId,
            changedBy: userId,
            changeType: 'granted',
            newRole: 'owner',
            reason: 'Canvas creation',
            timestamp: Date.now(),
            ipAddress: context?.ipAddress,
            userAgent: context?.userAgent
        });

        return permission;
    }

    /**
     * Grant permission to a user
     */
    async grantPermission(
        canvasId: string,
        targetUserId: string,
        role: PermissionRole,
        grantedBy: string,
        options: {
            expiresAt?: number;
            reason?: string;
            ipAddress?: string;
            userAgent?: string;
        } = {}
    ): Promise<CanvasPermission> {
        // Validate that the granter has permission to grant this role
        const granterPermission = await this.getUserPermission(grantedBy, canvasId);
        if (!granterPermission || !granterPermission.canManagePermissions()) {
            throw new Error('Insufficient permissions to grant access');
        }

        // Check if granter can grant this specific role
        if (!hasPermission(granterPermission.role, role)) {
            throw new Error(`Cannot grant ${role} role - insufficient privileges`);
        }

        // Create the permission
        const permission = CanvasPermission.fromInvitation(
            canvasId,
            targetUserId,
            role,
            grantedBy,
            options.expiresAt
        );

        // Store permission
        const key = this.getPermissionKey(targetUserId, canvasId);
        this.permissions.set(key, permission);

        // Cache permission
        await this.cacheService.cacheUserCanvasPermission(
            targetUserId,
            canvasId,
            permission.toJSON()
        );

        // Audit log
        await this.auditService.logPermissionGranted({
            canvasId,
            targetUserId,
            changedBy: grantedBy,
            changeType: 'granted',
            newRole: role,
            reason: options.reason,
            timestamp: Date.now(),
            ipAddress: options.ipAddress,
            userAgent: options.userAgent
        });

        return permission;
    }

    /**
     * Update existing permission
     */
    async updatePermission(
        canvasId: string,
        targetUserId: string,
        updates: {
            role?: PermissionRole;
            expiresAt?: number;
            permissions?: Partial<NonNullable<CanvasPermissionType['permissions']>>;
        },
        updatedBy: string,
        options: {
            reason?: string;
            ipAddress?: string;
            userAgent?: string;
        } = {}
    ): Promise<CanvasPermission> {
        // Get existing permission
        const existingPermission = await this.getUserPermission(targetUserId, canvasId);
        if (!existingPermission) {
            throw new Error('Permission not found');
        }

        // Validate updater permissions
        const updaterPermission = await this.getUserPermission(updatedBy, canvasId);
        if (!updaterPermission || !updaterPermission.canManagePermissions()) {
            throw new Error('Insufficient permissions to update access');
        }

        // Validate role update if specified
        if (updates.role && !hasPermission(updaterPermission.role, updates.role)) {
            throw new Error(`Cannot update to ${updates.role} role - insufficient privileges`);
        }

        // Can't modify owner permissions unless you're also an owner
        if (existingPermission.isOwner() && !updaterPermission.isOwner()) {
            throw new Error('Cannot modify owner permissions');
        }

        const previousRole = existingPermission.role;

        // Apply updates
        if (updates.role) {
            existingPermission.updateRole(updates.role);
        }
        if (updates.expiresAt !== undefined) {
            if (updates.expiresAt) {
                existingPermission.setExpiration(updates.expiresAt);
            } else {
                existingPermission.removeExpiration();
            }
        }
        if (updates.permissions) {
            existingPermission.updatePermissions(updates.permissions);
        }

        // Store updated permission
        const key = this.getPermissionKey(targetUserId, canvasId);
        this.permissions.set(key, existingPermission);

        // Update cache
        await this.cacheService.cacheUserCanvasPermission(
            targetUserId,
            canvasId,
            existingPermission.toJSON()
        );

        // Audit log
        await this.auditService.logPermissionUpdated({
            canvasId,
            targetUserId,
            changedBy: updatedBy,
            changeType: 'updated',
            previousRole,
            newRole: existingPermission.role,
            reason: options.reason,
            timestamp: Date.now(),
            ipAddress: options.ipAddress,
            userAgent: options.userAgent
        });

        return existingPermission;
    }

    /**
     * Revoke permission
     */
    async revokePermission(
        canvasId: string,
        targetUserId: string,
        revokedBy: string,
        options: {
            reason?: string;
            ipAddress?: string;
            userAgent?: string;
        } = {}
    ): Promise<void> {
        // Get existing permission
        const existingPermission = await this.getUserPermission(targetUserId, canvasId);
        if (!existingPermission) {
            throw new Error('Permission not found');
        }

        // Validate revoker permissions
        const revokerPermission = await this.getUserPermission(revokedBy, canvasId);
        if (!revokerPermission || !revokerPermission.canManagePermissions()) {
            throw new Error('Insufficient permissions to revoke access');
        }

        // Can't revoke owner permissions (must transfer ownership first)
        if (existingPermission.isOwner()) {
            throw new Error('Cannot revoke owner permissions - transfer ownership first');
        }

        const previousRole = existingPermission.role;

        // Remove permission
        const key = this.getPermissionKey(targetUserId, canvasId);
        this.permissions.delete(key);

        // Remove from cache
        await this.cacheService.removeUserCanvasPermission(targetUserId, canvasId);

        // Audit log
        await this.auditService.logPermissionRevoked({
            canvasId,
            targetUserId,
            changedBy: revokedBy,
            changeType: 'revoked',
            previousRole,
            reason: options.reason,
            timestamp: Date.now(),
            ipAddress: options.ipAddress,
            userAgent: options.userAgent
        });
    }

    // ========================================
    // Permission Queries
    // ========================================

    /**
     * Get user's permission for a canvas
     */
    async getUserPermission(
        userId: string,
        canvasId: string
    ): Promise<CanvasPermission | null> {
        // Check cache first
        const cached = await this.cacheService.getUserCanvasPermission(userId, canvasId);
        if (cached) {
            return CanvasPermission.fromData(cached);
        }

        // Load from storage
        const key = this.getPermissionKey(userId, canvasId);
        const permission = this.permissions.get(key);

        if (permission) {
            // Cache for future requests
            await this.cacheService.cacheUserCanvasPermission(
                userId,
                canvasId,
                permission.toJSON()
            );
        }

        return permission || null;
    }

    /**
     * Validate user's permission for a specific action
     */
    async validatePermission(
        userId: string,
        canvasId: string,
        action: 'view' | 'edit' | 'share' | 'delete' | 'manage'
    ): Promise<PermissionValidationResult> {
        try {
            const permission = await this.getUserPermission(userId, canvasId);

            if (!permission) {
                return {
                    valid: false,
                    error: 'No permission found for this canvas',
                    code: 'PERMISSION_NOT_FOUND'
                };
            }

            if (permission.isExpired()) {
                return {
                    valid: false,
                    error: 'Permission has expired',
                    code: 'PERMISSION_EXPIRED'
                };
            }

            if (!permission.canPerformAction(action)) {
                return {
                    valid: false,
                    error: `Insufficient permissions for action: ${action}`,
                    code: 'INSUFFICIENT_PERMISSIONS'
                };
            }

            return {
                valid: true,
                permission
            };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Permission check failed',
                code: 'PERMISSION_CHECK_ERROR'
            };
        }
    }

    /**
     * Get all permissions for a canvas
     */
    async getCanvasPermissions(canvasId: string): Promise<CanvasPermission[]> {
        // In production, this would query Firestore collection for the canvas
        const permissions: CanvasPermission[] = [];

        for (const [key, permission] of this.permissions.entries()) {
            if (permission.canvasId === canvasId) {
                permissions.push(permission);
            }
        }

        return permissions;
    }

    /**
     * Get user's permission summary for a canvas
     */
    async getUserPermissionSummary(
        userId: string,
        canvasId: string
    ): Promise<UserCanvasPermissionSummary | null> {
        const permission = await this.getUserPermission(userId, canvasId);

        if (!permission) {
            return null;
        }

        return {
            canvasId,
            userId,
            role: permission.role,
            canView: permission.canPerformAction('view'),
            canEdit: permission.canPerformAction('edit'),
            canShare: permission.canPerformAction('share'),
            canDelete: permission.canPerformAction('delete'),
            canManage: permission.canPerformAction('manage'),
            isExpired: permission.isExpired(),
            expiresAt: permission.expiresAt,
            grantedBy: permission.grantedBy,
            grantedAt: permission.grantedAt
        };
    }

    /**
     * Get all canvases a user has access to
     */
    async getUserCanvases(userId: string): Promise<Array<{
        canvasId: string;
        role: PermissionRole;
        grantedAt: number;
    }>> {
        const userCanvases: Array<{
            canvasId: string;
            role: PermissionRole;
            grantedAt: number;
        }> = [];

        for (const [key, permission] of this.permissions.entries()) {
            if (permission.userId === userId && !permission.isExpired()) {
                userCanvases.push({
                    canvasId: permission.canvasId,
                    role: permission.role,
                    grantedAt: permission.grantedAt
                });
            }
        }

        return userCanvases;
    }

    // ========================================
    // Batch Operations
    // ========================================

    /**
     * Grant permissions to multiple users
     */
    async grantBatchPermissions(
        canvasId: string,
        grants: Array<{
            userId: string;
            role: PermissionRole;
            expiresAt?: number;
        }>,
        grantedBy: string,
        options: {
            reason?: string;
            ipAddress?: string;
            userAgent?: string;
        } = {}
    ): Promise<BatchPermissionResult> {
        const result: BatchPermissionResult = {
            successful: [],
            failed: [],
            summary: {
                total: grants.length,
                successful: 0,
                failed: 0
            }
        };

        // Validate granter permissions once
        const granterPermission = await this.getUserPermission(grantedBy, canvasId);
        if (!granterPermission || !granterPermission.canManagePermissions()) {
            // All operations fail
            for (const grant of grants) {
                result.failed.push({
                    userId: grant.userId,
                    error: 'Insufficient permissions to grant access',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }
            result.summary.failed = grants.length;
            return result;
        }

        // Process each grant
        for (const grant of grants) {
            try {
                const permission = await this.grantPermission(
                    canvasId,
                    grant.userId,
                    grant.role,
                    grantedBy,
                    {
                        expiresAt: grant.expiresAt,
                        reason: options.reason,
                        ipAddress: options.ipAddress,
                        userAgent: options.userAgent
                    }
                );

                result.successful.push({
                    userId: grant.userId,
                    permission
                });
                result.summary.successful++;
            } catch (error) {
                result.failed.push({
                    userId: grant.userId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    code: 'GRANT_FAILED'
                });
                result.summary.failed++;
            }
        }

        return result;
    }

    // ========================================
    // Permission Inheritance and Cleanup
    // ========================================

    /**
     * Clean up expired permissions
     */
    async cleanupExpiredPermissions(): Promise<{
        cleaned: number;
        canvases: string[];
    }> {
        const now = Date.now();
        let cleaned = 0;
        const affectedCanvases = new Set<string>();

        for (const [key, permission] of this.permissions.entries()) {
            if (permission.isExpired()) {
                // Remove permission
                this.permissions.delete(key);

                // Remove from cache
                await this.cacheService.removeUserCanvasPermission(
                    permission.userId,
                    permission.canvasId
                );

                affectedCanvases.add(permission.canvasId);
                cleaned++;

                // Audit log
                await this.auditService.logPermissionRevoked({
                    canvasId: permission.canvasId,
                    targetUserId: permission.userId,
                    changedBy: 'system',
                    changeType: 'revoked',
                    previousRole: permission.role,
                    reason: 'Permission expired',
                    timestamp: now
                });
            }
        }

        return {
            cleaned,
            canvases: Array.from(affectedCanvases)
        };
    }

    /**
     * Transfer canvas ownership
     */
    async transferOwnership(
        canvasId: string,
        currentOwner: string,
        newOwner: string,
        options: {
            reason?: string;
            ipAddress?: string;
            userAgent?: string;
        } = {}
    ): Promise<void> {
        // Validate current owner
        const currentOwnerPermission = await this.getUserPermission(currentOwner, canvasId);
        if (!currentOwnerPermission || !currentOwnerPermission.isOwner()) {
            throw new Error('Only canvas owner can transfer ownership');
        }

        // Check if new owner already has permission
        const newOwnerPermission = await this.getUserPermission(newOwner, canvasId);

        if (newOwnerPermission) {
            // Update existing permission to owner
            await this.updatePermission(
                canvasId,
                newOwner,
                { role: 'owner' },
                currentOwner,
                options
            );
        } else {
            // Grant owner permission
            await this.grantPermission(
                canvasId,
                newOwner,
                'owner',
                currentOwner,
                options
            );
        }

        // Downgrade current owner to editor
        await this.updatePermission(
            canvasId,
            currentOwner,
            { role: 'editor' },
            newOwner,
            { ...options, reason: 'Ownership transfer' }
        );
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    private getPermissionKey(userId: string, canvasId: string): string {
        return `${userId}:${canvasId}`;
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.permissions.clear();
    }
}
