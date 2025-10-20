/**
 * CanvasPermission Model
 * 
 * Handles role-based access control for canvas workspaces.
 * Manages user permissions, roles, and access restrictions.
 */

import {
    CanvasPermission as CanvasPermissionType,
    PermissionRole,
    hasPermission,
    canPerformAction
} from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class CanvasPermission implements CanvasPermissionType {
    public readonly id: string;
    public readonly canvasId: string;
    public readonly userId: string;
    public role: PermissionRole;
    public readonly grantedBy: string;
    public readonly grantedAt: number;

    // Optional expiration and restrictions
    public expiresAt?: number;
    public permissions?: {
        canEdit?: boolean;
        canComment?: boolean;
        canShare?: boolean;
        canDelete?: boolean;
        canManagePermissions?: boolean;
    };

    constructor(data: {
        id?: string;
        canvasId: string;
        userId: string;
        role: PermissionRole;
        grantedBy: string;
        grantedAt?: number;
        expiresAt?: number;
        permissions?: CanvasPermissionType['permissions'];
    }) {
        this.id = data.id || uuidv4();
        this.canvasId = data.canvasId;
        this.userId = data.userId;
        this.role = data.role;
        this.grantedBy = data.grantedBy;
        this.grantedAt = data.grantedAt || Date.now();
        this.expiresAt = data.expiresAt;
        this.permissions = this.generateDefaultPermissions(data.role, data.permissions);
    }

    /**
     * Create owner permission for canvas creator
     */
    static createOwnerPermission(canvasId: string, userId: string): CanvasPermission {
        return new CanvasPermission({
            canvasId,
            userId,
            role: 'owner',
            grantedBy: userId, // Owner grants themselves
            permissions: {
                canEdit: true,
                canComment: true,
                canShare: true,
                canDelete: true,
                canManagePermissions: true
            }
        });
    }

    /**
     * Create permission from invitation
     */
    static fromInvitation(
        canvasId: string,
        userId: string,
        role: PermissionRole,
        grantedBy: string,
        expiresAt?: number
    ): CanvasPermission {
        return new CanvasPermission({
            canvasId,
            userId,
            role,
            grantedBy,
            expiresAt
        });
    }

    /**
     * Create permission instance from raw data (e.g., from database)
     */
    static fromData(data: CanvasPermissionType): CanvasPermission {
        return new CanvasPermission({
            id: data.id,
            canvasId: data.canvasId,
            userId: data.userId,
            role: data.role,
            grantedBy: data.grantedBy,
            grantedAt: data.grantedAt,
            expiresAt: data.expiresAt,
            permissions: data.permissions
        });
    }

    /**
     * Generate default permissions based on role
     */
    private generateDefaultPermissions(
        role: PermissionRole,
        customPermissions?: CanvasPermissionType['permissions']
    ): CanvasPermissionType['permissions'] {
        const defaultPermissions = this.getDefaultPermissionsForRole(role);

        if (!customPermissions) {
            return defaultPermissions;
        }

        // Merge custom permissions but don't allow escalation beyond role limits
        return {
            canEdit: customPermissions.canEdit && defaultPermissions.canEdit,
            canComment: customPermissions.canComment && defaultPermissions.canComment,
            canShare: customPermissions.canShare && defaultPermissions.canShare,
            canDelete: customPermissions.canDelete && defaultPermissions.canDelete,
            canManagePermissions: customPermissions.canManagePermissions && defaultPermissions.canManagePermissions
        };
    }

    /**
     * Get default permissions for a role
     */
    private getDefaultPermissionsForRole(role: PermissionRole): NonNullable<CanvasPermissionType['permissions']> {
        switch (role) {
            case 'owner':
                return {
                    canEdit: true,
                    canComment: true,
                    canShare: true,
                    canDelete: true,
                    canManagePermissions: true
                };
            case 'editor':
                return {
                    canEdit: true,
                    canComment: true,
                    canShare: false,
                    canDelete: false,
                    canManagePermissions: false
                };
            case 'viewer':
                return {
                    canEdit: false,
                    canComment: true,
                    canShare: false,
                    canDelete: false,
                    canManagePermissions: false
                };
            default:
                return {
                    canEdit: false,
                    canComment: false,
                    canShare: false,
                    canDelete: false,
                    canManagePermissions: false
                };
        }
    }

    /**
     * Update the role and regenerate permissions
     */
    updateRole(newRole: PermissionRole): void {
        this.role = newRole;
        this.permissions = this.generateDefaultPermissions(newRole, this.permissions);
    }

    /**
     * Update specific permissions (within role limits)
     */
    updatePermissions(newPermissions: Partial<NonNullable<CanvasPermissionType['permissions']>>): void {
        const roleDefaults = this.getDefaultPermissionsForRole(this.role);

        this.permissions = {
            ...this.permissions,
            canEdit: newPermissions.canEdit !== undefined
                ? (newPermissions.canEdit && roleDefaults.canEdit)
                : this.permissions?.canEdit,
            canComment: newPermissions.canComment !== undefined
                ? (newPermissions.canComment && roleDefaults.canComment)
                : this.permissions?.canComment,
            canShare: newPermissions.canShare !== undefined
                ? (newPermissions.canShare && roleDefaults.canShare)
                : this.permissions?.canShare,
            canDelete: newPermissions.canDelete !== undefined
                ? (newPermissions.canDelete && roleDefaults.canDelete)
                : this.permissions?.canDelete,
            canManagePermissions: newPermissions.canManagePermissions !== undefined
                ? (newPermissions.canManagePermissions && roleDefaults.canManagePermissions)
                : this.permissions?.canManagePermissions
        };
    }

    /**
     * Set expiration date
     */
    setExpiration(expiresAt: number): void {
        this.expiresAt = expiresAt;
    }

    /**
     * Remove expiration
     */
    removeExpiration(): void {
        this.expiresAt = undefined;
    }

    /**
     * Check if permission has expired
     */
    isExpired(): boolean {
        return this.expiresAt !== undefined && this.expiresAt < Date.now();
    }

    /**
     * Check if user is owner
     */
    isOwner(): boolean {
        return this.role === 'owner';
    }

    /**
     * Check if user can edit
     */
    canEdit(): boolean {
        return !this.isExpired() && (this.permissions?.canEdit === true);
    }

    /**
     * Check if user can comment
     */
    canComment(): boolean {
        return !this.isExpired() && (this.permissions?.canComment === true);
    }

    /**
     * Check if user can share
     */
    canShare(): boolean {
        return !this.isExpired() && (this.permissions?.canShare === true);
    }

    /**
     * Check if user can delete objects
     */
    canDelete(): boolean {
        return !this.isExpired() && (this.permissions?.canDelete === true);
    }

    /**
     * Check if user can manage permissions
     */
    canManagePermissions(): boolean {
        return !this.isExpired() && (this.permissions?.canManagePermissions === true);
    }

    /**
     * Check if user can perform a specific action
     */
    canPerformAction(action: 'view' | 'edit' | 'share' | 'delete' | 'manage'): boolean {
        if (this.isExpired()) {
            return false;
        }

        switch (action) {
            case 'view':
                return true; // If they have any permission, they can view
            case 'edit':
                return this.canEdit();
            case 'share':
                return this.canShare();
            case 'delete':
                return this.canDelete();
            case 'manage':
                return this.canManagePermissions();
            default:
                return false;
        }
    }

    /**
     * Check if this permission has higher role than another
     */
    hasHigherRoleThan(otherPermission: CanvasPermission): boolean {
        return hasPermission(this.role, otherPermission.role) && this.role !== otherPermission.role;
    }

    /**
     * Check if this permission can modify another permission
     */
    canModify(targetPermission: CanvasPermission): boolean {
        // Can't modify if expired
        if (this.isExpired()) {
            return false;
        }

        // Can't modify owner permissions
        if (targetPermission.isOwner()) {
            return false;
        }

        // Must be able to manage permissions
        if (!this.canManagePermissions()) {
            return false;
        }

        // Must have equal or higher role
        return hasPermission(this.role, targetPermission.role);
    }

    /**
     * Get time until expiration in milliseconds
     */
    getTimeUntilExpiration(): number | null {
        if (!this.expiresAt) {
            return null;
        }
        return Math.max(0, this.expiresAt - Date.now());
    }

    /**
     * Check if permission expires within a given timeframe
     */
    expiresWithin(milliseconds: number): boolean {
        if (!this.expiresAt) {
            return false;
        }
        return (this.expiresAt - Date.now()) <= milliseconds;
    }

    /**
     * Get permission data for API response
     */
    toJSON(): CanvasPermissionType {
        return {
            id: this.id,
            canvasId: this.canvasId,
            userId: this.userId,
            role: this.role,
            grantedBy: this.grantedBy,
            grantedAt: this.grantedAt,
            expiresAt: this.expiresAt,
            permissions: this.permissions
        };
    }

    /**
     * Validate permission data
     */
    static validate(data: Partial<CanvasPermissionType>): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!data.canvasId || data.canvasId.trim().length === 0) {
            errors.push('Canvas ID is required');
        }
        if (!data.userId || data.userId.trim().length === 0) {
            errors.push('User ID is required');
        }
        if (!data.role || !['owner', 'editor', 'viewer'].includes(data.role)) {
            errors.push('Valid role is required');
        }
        if (!data.grantedBy || data.grantedBy.trim().length === 0) {
            errors.push('Granted by user ID is required');
        }
        if (data.expiresAt && data.expiresAt <= Date.now()) {
            errors.push('Expiration date must be in the future');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
