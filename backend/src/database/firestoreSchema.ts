/**
 * Firestore Database Schema Definition
 * 
 * Defines the complete database schema for multi-canvas CollabCanvas application.
 * This includes collections structure, document formats, and indexing requirements.
 */

import {
    Canvas,
    CanvasPermission,
    CanvasObject,
    PermissionRole,
    CanvasPrivacy,
    User
} from '../../../shared/types';

// ========================================
// Collection Names and Paths
// ========================================

export const COLLECTIONS = {
    // Top-level collections
    USERS: 'users',
    CANVASES: 'canvases',
    INVITATIONS: 'invitations',
    SHAREABLE_LINKS: 'shareable_links',
    AUDIT_LOGS: 'audit_logs',

    // Canvas subcollections (dynamic based on canvasId)
    CANVAS_OBJECTS: (canvasId: string) => `canvases/${canvasId}/objects`,
    CANVAS_PERMISSIONS: (canvasId: string) => `canvases/${canvasId}/permissions`,
    CANVAS_PRESENCE: (canvasId: string) => `canvases/${canvasId}/presence`,
    CANVAS_ACTIVITY: (canvasId: string) => `canvases/${canvasId}/activity`,
    CANVAS_COMMENTS: (canvasId: string) => `canvases/${canvasId}/comments`, // Future feature
} as const;

// ========================================
// Document Schemas
// ========================================

/**
 * Users collection: /users/{userId}
 * Stores user profile and preferences
 */
export interface UserDocument extends User {
    // Additional fields for Firestore
    lastActiveAt: number;
    preferences: {
        theme: 'light' | 'dark';
        notifications: boolean;
        defaultCanvasPrivacy: CanvasPrivacy;
        language: string;
    };
    stats: {
        canvasesOwned: number;
        canvasesShared: number;
        totalObjects: number;
        joinedAt: number;
    };
}

/**
 * Canvases collection: /canvases/{canvasId}
 * Main canvas document with metadata
 */
export interface CanvasDocument extends Canvas {
    // Additional Firestore fields
    version: number; // For optimistic locking
    isDeleted: boolean; // Soft delete flag
    deletedAt?: number;
    deletedBy?: string;

    // Computed fields (updated by Cloud Functions)
    stats: {
        totalObjects: number;
        totalCollaborators: number;
        lastActivityAt: number;
        averageSessionDuration: number;
    };

    // Search and discovery fields
    searchTerms: string[]; // Tokenized name/description for search
    featured: boolean; // For featured public canvases
}

/**
 * Canvas Objects subcollection: /canvases/{canvasId}/objects/{objectId}
 * Stores individual canvas objects
 */
export interface CanvasObjectDocument extends CanvasObject {
    // Additional Firestore fields
    version: number; // For conflict resolution
    isDeleted: boolean; // Soft delete flag
    deletedAt?: number;
    deletedBy?: string;

    // Collaboration fields
    lastEditedBy: string;
    editHistory: Array<{
        userId: string;
        timestamp: number;
        action: 'created' | 'updated' | 'deleted';
        changes?: Record<string, any>;
    }>;

    // Performance fields
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
}

/**
 * Canvas Permissions subcollection: /canvases/{canvasId}/permissions/{userId}
 * Stores user permissions for the canvas
 */
export interface CanvasPermissionDocument extends CanvasPermission {
    // Additional Firestore fields
    isActive: boolean; // Quick active/inactive toggle
    lastUsedAt?: number; // Last time user accessed canvas
    invitationId?: string; // Reference to invitation that created this permission

    // Audit fields
    history: Array<{
        action: 'granted' | 'updated' | 'revoked';
        previousRole?: PermissionRole;
        newRole?: PermissionRole;
        changedBy: string;
        timestamp: number;
        reason?: string;
    }>;
}

/**
 * Canvas Presence subcollection: /canvases/{canvasId}/presence/{userId}
 * Tracks real-time user presence
 */
export interface CanvasPresenceDocument {
    userId: string;
    canvasId: string;
    displayName: string;
    avatarColor: string;

    // Connection info
    isOnline: boolean;
    lastSeenAt: number;
    joinedAt: number;
    connectionId: string; // WebSocket connection ID

    // Activity info
    currentTool: 'select' | 'rectangle' | 'circle' | 'text';
    cursor: {
        x: number;
        y: number;
        visible: boolean;
    };

    // Session info
    sessionStartedAt: number;
    activeTimeMs: number; // Total active time in this session
    actionsCount: number; // Number of actions in this session
}

/**
 * Canvas Activity subcollection: /canvases/{canvasId}/activity/{activityId}
 * Stores canvas activity log for dashboard
 */
export interface CanvasActivityDocument {
    id: string;
    canvasId: string;
    userId: string;
    timestamp: number;

    type: 'object_created' | 'object_updated' | 'object_deleted' |
    'user_joined' | 'user_left' | 'permission_changed' |
    'canvas_updated' | 'comment_added';

    details: {
        objectId?: string;
        objectType?: string;
        targetUserId?: string; // For permission changes
        previousValue?: any;
        newValue?: any;
        description: string; // Human readable description
    };

    // Aggregation fields
    batchId?: string; // For grouping related activities
    isImportant: boolean; // For highlighting in activity feed
}

/**
 * Invitations collection: /invitations/{invitationId}
 * Canvas collaboration invitations
 */
export interface InvitationDocument {
    id: string;
    canvasId: string;
    inviterUserId: string;
    inviteeEmail: string;
    role: PermissionRole;

    status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

    createdAt: number;
    expiresAt: number;
    respondedAt?: number;

    message?: string; // Personal message from inviter

    // Response tracking
    acceptedBy?: string; // userId if accepted
    declineReason?: string;

    // Email tracking
    emailSentAt?: number;
    remindersSent: number;
    lastReminderAt?: number;
}

/**
 * Shareable Links collection: /shareable_links/{linkId}
 * Public/shareable canvas links
 */
export interface ShareableLinkDocument {
    id: string;
    canvasId: string;
    createdBy: string;
    role: PermissionRole;

    isActive: boolean;
    createdAt: number;
    expiresAt?: number;

    // Access tracking
    accessCount: number;
    maxAccess?: number;
    lastAccessedAt?: number;

    // Settings
    requiresApproval: boolean; // Owner must approve access
    password?: string; // Optional password protection

    // Usage statistics
    uniqueUsers: string[]; // List of userIds who used this link
    accessHistory: Array<{
        userId?: string;
        timestamp: number;
        ipAddress: string;
        userAgent: string;
        granted: boolean;
    }>;
}

/**
 * Audit Logs collection: /audit_logs/{logId}
 * Security and compliance audit trail
 */
export interface AuditLogDocument {
    id: string;
    timestamp: number;

    // Event classification
    eventType: 'canvas_access' | 'permission_granted' | 'permission_revoked' |
    'permission_updated' | 'canvas_created' | 'canvas_deleted' |
    'canvas_updated' | 'invitation_sent' | 'invitation_accepted' |
    'shareable_link_created' | 'shareable_link_accessed' |
    'security_violation' | 'auth_failure';

    // Entities involved
    userId: string;
    canvasId?: string;
    targetUserId?: string; // For permission changes

    // Event details
    details: {
        action: string;
        role?: PermissionRole;
        previousRole?: PermissionRole;
        granted: boolean;
        error?: string;
        reason?: string;

        // Request context
        ipAddress: string;
        userAgent: string;
        sessionId?: string;

        // Additional metadata
        metadata?: Record<string, any>;
    };

    // Risk and compliance
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    complianceFlags: string[]; // GDPR, SOX, etc.

    // Retention
    retentionCategory: 'security' | 'compliance' | 'operational';
    deleteAfter: number; // Timestamp when this log should be deleted
}

// ========================================
// Composite Index Requirements
// ========================================

export const REQUIRED_INDEXES = [
    // Canvas queries
    {
        collection: 'canvases',
        fields: ['ownerId', 'isArchived', 'createdAt'],
        order: 'desc'
    },
    {
        collection: 'canvases',
        fields: ['privacy', 'featured', 'updatedAt'],
        order: 'desc'
    },
    {
        collection: 'canvases',
        fields: ['searchTerms', 'privacy', 'updatedAt'],
        order: 'desc'
    },

    // Permission queries
    {
        collection: 'canvases/{canvasId}/permissions',
        fields: ['userId', 'isActive', 'grantedAt'],
        order: 'desc'
    },
    {
        collection: 'canvases/{canvasId}/permissions',
        fields: ['role', 'isActive', 'grantedAt'],
        order: 'desc'
    },

    // Object queries
    {
        collection: 'canvases/{canvasId}/objects',
        fields: ['isDeleted', 'updatedAt'],
        order: 'desc'
    },
    {
        collection: 'canvases/{canvasId}/objects',
        fields: ['userId', 'isDeleted', 'createdAt'],
        order: 'desc'
    },
    {
        collection: 'canvases/{canvasId}/objects',
        fields: ['type', 'isDeleted', 'createdAt'],
        order: 'desc'
    },

    // Activity queries
    {
        collection: 'canvases/{canvasId}/activity',
        fields: ['timestamp'],
        order: 'desc'
    },
    {
        collection: 'canvases/{canvasId}/activity',
        fields: ['userId', 'timestamp'],
        order: 'desc'
    },
    {
        collection: 'canvases/{canvasId}/activity',
        fields: ['type', 'timestamp'],
        order: 'desc'
    },

    // Presence queries
    {
        collection: 'canvases/{canvasId}/presence',
        fields: ['isOnline', 'lastSeenAt'],
        order: 'desc'
    },

    // Invitation queries
    {
        collection: 'invitations',
        fields: ['inviteeEmail', 'status', 'createdAt'],
        order: 'desc'
    },
    {
        collection: 'invitations',
        fields: ['canvasId', 'status', 'createdAt'],
        order: 'desc'
    },
    {
        collection: 'invitations',
        fields: ['inviterUserId', 'status', 'createdAt'],
        order: 'desc'
    },

    // Audit log queries
    {
        collection: 'audit_logs',
        fields: ['userId', 'timestamp'],
        order: 'desc'
    },
    {
        collection: 'audit_logs',
        fields: ['canvasId', 'timestamp'],
        order: 'desc'
    },
    {
        collection: 'audit_logs',
        fields: ['eventType', 'timestamp'],
        order: 'desc'
    },
    {
        collection: 'audit_logs',
        fields: ['riskLevel', 'timestamp'],
        order: 'desc'
    }
] as const;

// ========================================
// Collection Security Levels
// ========================================

export const COLLECTION_SECURITY = {
    users: 'private', // Only the user can read/write their own document
    canvases: 'permission_based', // Based on canvas permissions
    invitations: 'restricted', // Only inviter and invitee can access
    shareable_links: 'creator_only', // Only creator can manage
    audit_logs: 'admin_only', // Only system/admin access

    // Subcollections inherit parent canvas permissions
    canvas_objects: 'canvas_permission_based',
    canvas_permissions: 'canvas_owner_only',
    canvas_presence: 'canvas_permission_based',
    canvas_activity: 'canvas_permission_based',
    canvas_comments: 'canvas_permission_based'
} as const;

// ========================================
// Schema Validation Rules
// ========================================

export const VALIDATION_RULES = {
    canvas: {
        maxNameLength: 255,
        maxDescriptionLength: 1000,
        maxTagsCount: 10,
        maxTagLength: 50,
        maxCollaborators: 50
    },

    objects: {
        maxObjectsPerCanvas: 10000,
        maxTextLength: 5000,
        maxFontSize: 200,
        minFontSize: 6,
        coordinateRange: [-100000, 100000]
    },

    permissions: {
        maxInvitationsPerCanvas: 100,
        maxShareableLinksPerCanvas: 10,
        maxPermissionHistoryEntries: 50
    },

    activity: {
        maxActivitiesPerCanvas: 10000,
        activityRetentionDays: 90,
        maxBatchSize: 100
    }
} as const;

// ========================================
// Query Helpers
// ========================================

/**
 * Helper functions for common Firestore queries
 */
export class FirestoreQueryHelpers {
    /**
     * Get collection reference for canvas objects
     */
    static getCanvasObjectsRef(canvasId: string) {
        return COLLECTIONS.CANVAS_OBJECTS(canvasId);
    }

    /**
     * Get collection reference for canvas permissions
     */
    static getCanvasPermissionsRef(canvasId: string) {
        return COLLECTIONS.CANVAS_PERMISSIONS(canvasId);
    }

    /**
     * Get collection reference for canvas presence
     */
    static getCanvasPresenceRef(canvasId: string) {
        return COLLECTIONS.CANVAS_PRESENCE(canvasId);
    }

    /**
     * Get collection reference for canvas activity
     */
    static getCanvasActivityRef(canvasId: string) {
        return COLLECTIONS.CANVAS_ACTIVITY(canvasId);
    }

    /**
     * Build user canvases query filters
     */
    static buildUserCanvasesFilters(userId: string, filters?: {
        ownedByMe?: boolean;
        sharedWithMe?: boolean;
        privacy?: CanvasPrivacy;
        isArchived?: boolean;
        isFavorite?: boolean;
    }) {
        const queries = [];

        if (filters?.ownedByMe) {
            queries.push(['ownerId', '==', userId]);
        }

        if (filters?.privacy) {
            queries.push(['privacy', '==', filters.privacy]);
        }

        if (filters?.isArchived !== undefined) {
            queries.push(['isArchived', '==', filters.isArchived]);
        }

        if (filters?.isFavorite !== undefined) {
            queries.push(['isFavorite', '==', filters.isFavorite]);
        }

        return queries;
    }
}

export default {
    COLLECTIONS,
    REQUIRED_INDEXES,
    COLLECTION_SECURITY,
    VALIDATION_RULES,
    FirestoreQueryHelpers
};
