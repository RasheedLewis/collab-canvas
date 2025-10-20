/**
 * Permission System Configuration
 * 
 * Defines all permission roles, capabilities, and system-wide permission settings.
 */

import { PermissionRole } from '../../../shared/types';

// Permission capabilities for each role
export const ROLE_CAPABILITIES: Record<PermissionRole, {
    canView: boolean;
    canEdit: boolean;
    canComment: boolean;
    canShare: boolean;
    canDelete: boolean;
    canManagePermissions: boolean;
    canTransferOwnership: boolean;
    canDeleteCanvas: boolean;
    description: string;
}> = {
    viewer: {
        canView: true,
        canEdit: false,
        canComment: true,
        canShare: false,
        canDelete: false,
        canManagePermissions: false,
        canTransferOwnership: false,
        canDeleteCanvas: false,
        description: 'Can view canvas and add comments'
    },
    editor: {
        canView: true,
        canEdit: true,
        canComment: true,
        canShare: false,
        canDelete: true,
        canManagePermissions: false,
        canTransferOwnership: false,
        canDeleteCanvas: false,
        description: 'Can view, edit objects, and add/delete content'
    },
    owner: {
        canView: true,
        canEdit: true,
        canComment: true,
        canShare: true,
        canDelete: true,
        canManagePermissions: true,
        canTransferOwnership: true,
        canDeleteCanvas: true,
        description: 'Full access including sharing and permission management'
    }
} as const;

// Role hierarchy levels (higher number = more permissions)
export const ROLE_HIERARCHY: Record<PermissionRole, number> = {
    viewer: 1,
    editor: 2,
    owner: 3
} as const;

// Permission system settings
export const PERMISSION_CONFIG = {
    // Cache settings
    cache: {
        defaultTTL: 15 * 60 * 1000, // 15 minutes
        maxCacheSize: 10000,
        cleanupInterval: 5 * 60 * 1000 // 5 minutes
    },

    // Permission expiration settings
    expiration: {
        defaultExpiration: null, // No expiration by default
        maxExpiration: 365 * 24 * 60 * 60 * 1000, // 1 year max
        warningPeriod: 7 * 24 * 60 * 60 * 1000, // Warn 7 days before expiration
    },

    // Security settings
    security: {
        maxFailedAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        auditRetentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
        requireReasonForRoleChanges: true,
        enablePermissionInheritance: true
    },

    // Canvas limits
    limits: {
        maxCollaboratorsPerCanvas: 50,
        maxOwnedCanvasesPerUser: 100,
        maxSharedCanvasesPerUser: 500
    },

    // Invitation settings
    invitations: {
        defaultExpirationHours: 168, // 7 days
        maxPendingInvitations: 20,
        allowGuestAccess: false,
        requireEmailVerification: true
    }
} as const;

// Permission validation rules
export const PERMISSION_RULES = {
    // Role transition rules (what roles can be granted by each role)
    roleTransitions: {
        viewer: [], // Viewers cannot grant any roles
        editor: ['viewer'], // Editors can only grant viewer access
        owner: ['viewer', 'editor', 'owner'] // Owners can grant any role
    } as Record<PermissionRole, PermissionRole[]>,

    // Actions that require specific roles
    requiredRoles: {
        // Canvas management
        'canvas:create': null, // Any authenticated user
        'canvas:view': 'viewer',
        'canvas:edit_metadata': 'owner',
        'canvas:delete': 'owner',
        'canvas:archive': 'owner',

        // Object operations
        'object:create': 'editor',
        'object:update': 'editor',
        'object:delete': 'editor',
        'object:view': 'viewer',

        // Collaboration
        'permission:view': 'viewer',
        'permission:grant': 'owner',
        'permission:revoke': 'owner',
        'permission:update': 'owner',

        // Sharing
        'share:create_link': 'owner',
        'share:send_invitation': 'owner',
        'share:manage_links': 'owner',

        // Comments (future feature)
        'comment:create': 'viewer',
        'comment:update_own': 'viewer',
        'comment:delete_own': 'viewer',
        'comment:delete_any': 'editor'
    } as Record<string, PermissionRole | null>
} as const;

// Public canvas access rules
export const PUBLIC_ACCESS_RULES = {
    allowPublicViewing: true,
    allowPublicEditing: false, // Must be explicitly enabled per canvas
    allowPublicCommenting: false,
    requireAuthForPublicAccess: false,
    publicRateLimits: {
        viewsPerHour: 1000,
        editsPerHour: 100
    }
} as const;

// Permission inheritance rules
export const INHERITANCE_RULES = {
    // Workspace-level permissions (future feature)
    inheritFromWorkspace: false,

    // Template-based permissions
    templates: {
        'public_readonly': {
            defaultRole: 'viewer' as PermissionRole,
            allowSelfUpgrade: false,
            maxRole: 'viewer' as PermissionRole
        },
        'collaborative': {
            defaultRole: 'editor' as PermissionRole,
            allowSelfUpgrade: true,
            maxRole: 'editor' as PermissionRole
        },
        'open': {
            defaultRole: 'editor' as PermissionRole,
            allowSelfUpgrade: true,
            maxRole: 'owner' as PermissionRole
        }
    }
} as const;

// Audit logging configuration
export const AUDIT_CONFIG = {
    // Events to always log
    alwaysLog: [
        'permission_granted',
        'permission_revoked',
        'permission_updated',
        'canvas_deleted',
        'ownership_transferred',
        'security_violation'
    ] as const,

    // Events to log only for high-risk operations
    conditionalLog: [
        'canvas_access',
        'object_created',
        'object_updated',
        'object_deleted'
    ] as const,

    // Retention periods by event type
    retentionPeriods: {
        security_violation: 365 * 24 * 60 * 60 * 1000, // 1 year
        permission_changes: 90 * 24 * 60 * 60 * 1000, // 90 days
        canvas_access: 30 * 24 * 60 * 60 * 1000, // 30 days
        default: 90 * 24 * 60 * 60 * 1000 // 90 days
    },

    // Alert thresholds
    alertThresholds: {
        failedAccessAttempts: 5,
        rapidPermissionChanges: 10,
        massObjectDeletion: 50,
        timeWindow: 15 * 60 * 1000 // 15 minutes
    }
} as const;

// Error codes for permission-related errors
export const PERMISSION_ERROR_CODES = {
    // Authentication errors
    AUTH_REQUIRED: 'Authentication required',
    INVALID_TOKEN: 'Invalid authentication token',
    TOKEN_EXPIRED: 'Authentication token expired',

    // Permission errors
    PERMISSION_DENIED: 'Permission denied',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this action',
    PERMISSION_NOT_FOUND: 'No permission found for this canvas',
    PERMISSION_EXPIRED: 'Permission has expired',

    // Role errors
    INVALID_ROLE: 'Invalid role specified',
    ROLE_DOWNGRADE_DENIED: 'Cannot downgrade from current role',
    OWNER_REQUIRED: 'Canvas owner privileges required',

    // Canvas errors
    CANVAS_NOT_FOUND: 'Canvas not found',
    CANVAS_ACCESS_DENIED: 'Access denied to this canvas',
    CANVAS_DELETED: 'Canvas has been deleted',

    // Validation errors
    INVALID_REQUEST: 'Invalid request parameters',
    MISSING_CANVAS_ID: 'Canvas ID is required',
    MISSING_USER_ID: 'User ID is required',

    // System errors
    PERMISSION_CHECK_ERROR: 'Error checking permissions',
    CACHE_ERROR: 'Permission cache error',
    DATABASE_ERROR: 'Database error during permission operation'
} as const;

/**
 * Utility functions for permission configuration
 */
export class PermissionConfig {
    /**
     * Check if a role can perform a specific action
     */
    static canRolePerformAction(role: PermissionRole, action: string): boolean {
        const requiredRole = PERMISSION_RULES.requiredRoles[action];
        if (!requiredRole) {
            return true; // No role requirement
        }

        return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
    }

    /**
     * Check if a role can grant another role
     */
    static canRoleGrantRole(granterRole: PermissionRole, targetRole: PermissionRole): boolean {
        return PERMISSION_RULES.roleTransitions[granterRole].includes(targetRole);
    }

    /**
     * Get all capabilities for a role
     */
    static getRoleCapabilities(role: PermissionRole) {
        return ROLE_CAPABILITIES[role];
    }

    /**
     * Get role hierarchy level
     */
    static getRoleLevel(role: PermissionRole): number {
        return ROLE_HIERARCHY[role];
    }

    /**
     * Check if role A has higher privileges than role B
     */
    static isHigherRole(roleA: PermissionRole, roleB: PermissionRole): boolean {
        return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
    }
}
