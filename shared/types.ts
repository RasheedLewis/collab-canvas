/**
 * Shared TypeScript type definitions for CollabCanvas
 * 
 * This file contains type definitions used across both frontend and backend
 * for consistent data modeling and API contracts.
 */

// ========================================
// User Types
// ========================================

export interface User {
    uid: string;
    email: string | null;
    name: string | null;
    picture: string | null;
    displayName?: string;
    avatarColor?: string;
    createdAt: number;
    lastLoginAt: number;
}

export interface UserProfile {
    uid: string;
    displayName: string;
    avatarColor: string;
    preferences?: {
        notifications?: boolean;
        theme?: 'light' | 'dark';
        defaultCanvasPrivacy?: 'private' | 'public';
    };
}

// ========================================
// Canvas Object Types
// ========================================

export interface BaseCanvasObject {
    id: string;
    x: number;
    y: number;
    type: 'rectangle' | 'circle' | 'text';
    color: string;
    rotation?: number;
    createdAt: number;
    updatedAt: number;
    userId?: string;
    canvasId: string; // Reference to parent canvas
}

export interface RectangleObject extends BaseCanvasObject {
    type: 'rectangle';
    width: number;
    height: number;
}

export interface CircleObject extends BaseCanvasObject {
    type: 'circle';
    radius: number;
}

export interface TextObject extends BaseCanvasObject {
    type: 'text';
    text: string;
    fontSize: number;
    fontFamily?: string;
    fontStyle?: string;
}

export type CanvasObject = RectangleObject | CircleObject | TextObject;

// ========================================
// Canvas Types
// ========================================

export type CanvasPrivacy = 'private' | 'public' | 'unlisted';
export type PermissionRole = 'owner' | 'editor' | 'viewer';

export interface Canvas {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    privacy: CanvasPrivacy;
    createdAt: number;
    updatedAt: number;
    lastAccessedAt: number;
    objectCount: number;
    collaboratorCount: number;

    // Thumbnail and preview
    thumbnailUrl?: string;
    previewUrl?: string;

    // Canvas settings
    settings?: {
        allowPublicEdit?: boolean;
        allowComments?: boolean;
        backgroundColor?: string;
        gridEnabled?: boolean;
    };

    // Metadata for organization
    tags?: string[];
    folder?: string;
    isFavorite?: boolean;
    isArchived?: boolean;
}

export interface CanvasPermission {
    id: string;
    canvasId: string;
    userId: string;
    role: PermissionRole;
    grantedBy: string; // userId who granted this permission
    grantedAt: number;

    // Optional expiration and restrictions
    expiresAt?: number;
    permissions?: {
        canEdit?: boolean;
        canComment?: boolean;
        canShare?: boolean;
        canDelete?: boolean;
        canManagePermissions?: boolean;
    };
}

export interface CanvasInvitation {
    id: string;
    canvasId: string;
    inviterUserId: string;
    inviteeEmail: string;
    role: PermissionRole;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    createdAt: number;
    expiresAt?: number;
    message?: string;
}

export interface ShareableLink {
    id: string;
    canvasId: string;
    createdBy: string;
    role: PermissionRole;
    isActive: boolean;
    expiresAt?: number;
    createdAt: number;
    accessCount: number;
    maxAccess?: number;
}

// ========================================
// Canvas State & Sync Types
// ========================================

export interface CanvasState {
    canvasId: string;
    objects: CanvasObject[];
    lastSyncAt: number;
    version: number; // For optimistic updates and conflict resolution
}

export interface CanvasMetrics {
    canvasId: string;
    activeUsers: number;
    totalObjects: number;
    lastActivity: number;
    collaborators: {
        userId: string;
        displayName: string;
        avatarColor: string;
        lastSeen: number;
        isActive: boolean;
    }[];
}

// ========================================
// API Response Types
// ========================================

export interface CanvasListResponse {
    canvases: Canvas[];
    permissions: CanvasPermission[];
    totalCount: number;
    hasMore: boolean;
    cursor?: string;
}

export interface CanvasDetailResponse {
    canvas: Canvas;
    permissions: CanvasPermission[];
    invitations: CanvasInvitation[];
    shareableLinks: ShareableLink[];
    userPermission: CanvasPermission;
}

// ========================================
// Request Types
// ========================================

export interface CreateCanvasRequest {
    name: string;
    description?: string;
    privacy?: CanvasPrivacy;
    settings?: Canvas['settings'];
    tags?: string[];
    folder?: string;
}

export interface UpdateCanvasRequest {
    name?: string;
    description?: string;
    privacy?: CanvasPrivacy;
    settings?: Canvas['settings'];
    tags?: string[];
    folder?: string;
    isFavorite?: boolean;
    isArchived?: boolean;
}

export interface InviteCollaboratorRequest {
    canvasId: string;
    email: string;
    role: PermissionRole;
    message?: string;
    expiresAt?: number;
}

export interface UpdatePermissionRequest {
    permissionId: string;
    role?: PermissionRole;
    permissions?: CanvasPermission['permissions'];
    expiresAt?: number;
}

export interface CreateShareableLinkRequest {
    canvasId: string;
    role: PermissionRole;
    expiresAt?: number;
    maxAccess?: number;
}

// ========================================
// Filter and Search Types
// ========================================

export interface CanvasFilters {
    ownedByMe?: boolean;
    sharedWithMe?: boolean;
    privacy?: CanvasPrivacy;
    folder?: string;
    tags?: string[];
    isFavorite?: boolean;
    isArchived?: boolean;
    hasCollaborators?: boolean;
}

export interface CanvasSortOptions {
    field: 'name' | 'createdAt' | 'updatedAt' | 'lastAccessedAt' | 'objectCount';
    direction: 'asc' | 'desc';
}

export interface CanvasSearchOptions {
    query?: string;
    filters?: CanvasFilters;
    sort?: CanvasSortOptions;
    limit?: number;
    cursor?: string;
}

// ========================================
// Error Types
// ========================================

export interface APIError {
    code: string;
    message: string;
    details?: any;
}

export interface ValidationError extends APIError {
    code: 'VALIDATION_ERROR';
    field?: string;
}

export interface PermissionError extends APIError {
    code: 'PERMISSION_DENIED';
    requiredRole?: PermissionRole;
    currentRole?: PermissionRole;
}

// ========================================
// Utility Types
// ========================================

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type Timestamps = {
    createdAt: number;
    updatedAt: number;
};

// Role hierarchy utilities
export const ROLE_HIERARCHY: Record<PermissionRole, number> = {
    viewer: 1,
    editor: 2,
    owner: 3,
} as const;

export function hasPermission(userRole: PermissionRole, requiredRole: PermissionRole): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canPerformAction(
    userRole: PermissionRole,
    action: 'view' | 'edit' | 'share' | 'delete' | 'manage'
): boolean {
    switch (action) {
        case 'view':
            return hasPermission(userRole, 'viewer');
        case 'edit':
            return hasPermission(userRole, 'editor');
        case 'share':
        case 'delete':
        case 'manage':
            return hasPermission(userRole, 'owner');
        default:
            return false;
    }
}
