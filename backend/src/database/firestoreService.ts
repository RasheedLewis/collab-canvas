/**
 * Firestore Database Service
 * 
 * Provides database operations for the multi-canvas CollabCanvas application.
 * Implements all CRUD operations with proper error handling and caching integration.
 */

import {
    DocumentReference,
    CollectionReference,
    Query,
    DocumentSnapshot,
    QuerySnapshot,
    WriteBatch,
    FieldValue,
    Timestamp
} from 'firebase-admin/firestore';
import { adminDb } from '../config/firebase';
import {
    Canvas,
    CanvasPermission,
    CanvasObject,
    User,
    CanvasFilters,
    CanvasSortOptions,
    PermissionRole,
    CanvasPrivacy
} from '../../../shared/types';
import {
    COLLECTIONS,
    CanvasDocument,
    CanvasObjectDocument,
    CanvasPermissionDocument,
    CanvasPresenceDocument,
    CanvasActivityDocument,
    UserDocument,
    InvitationDocument,
    ShareableLinkDocument,
    AuditLogDocument,
    FirestoreQueryHelpers,
    VALIDATION_RULES
} from './firestoreSchema';

// Database operation result types
export interface DatabaseResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}

export interface PaginatedResult<T> {
    items: T[];
    hasMore: boolean;
    nextCursor?: string;
    totalCount?: number;
}

/**
 * Main Firestore database service
 */
export class FirestoreService {
    private static instance: FirestoreService;

    private constructor() {
        // Private constructor for singleton
    }

    static getInstance(): FirestoreService {
        if (!FirestoreService.instance) {
            FirestoreService.instance = new FirestoreService();
        }
        return FirestoreService.instance;
    }

    // ========================================
    // Canvas Operations
    // ========================================

    /**
     * Create a new canvas
     */
    async createCanvas(canvas: Canvas): Promise<DatabaseResult<Canvas>> {
        try {
            const canvasDoc: CanvasDocument = {
                ...canvas,
                version: 1,
                isDeleted: false,
                searchTerms: this.generateSearchTerms(canvas.name, canvas.description),
                featured: false,
                stats: {
                    totalObjects: 0,
                    totalCollaborators: 1,
                    lastActivityAt: Date.now(),
                    averageSessionDuration: 0
                }
            };

            await adminDb.collection(COLLECTIONS.CANVASES).doc(canvas.id).set(canvasDoc);

            return { success: true, data: canvas };
        } catch (error) {
            console.error('Error creating canvas:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create canvas',
                code: 'CREATE_CANVAS_FAILED'
            };
        }
    }

    /**
     * Get canvas by ID
     */
    async getCanvas(canvasId: string): Promise<DatabaseResult<Canvas>> {
        try {
            const doc = await adminDb.collection(COLLECTIONS.CANVASES).doc(canvasId).get();

            if (!doc.exists) {
                return {
                    success: false,
                    error: 'Canvas not found',
                    code: 'CANVAS_NOT_FOUND'
                };
            }

            const canvasData = doc.data() as CanvasDocument;

            if (canvasData.isDeleted) {
                return {
                    success: false,
                    error: 'Canvas has been deleted',
                    code: 'CANVAS_DELETED'
                };
            }

            return { success: true, data: canvasData };
        } catch (error) {
            console.error('Error getting canvas:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get canvas',
                code: 'GET_CANVAS_FAILED'
            };
        }
    }

    /**
     * Update canvas metadata
     */
    async updateCanvas(
        canvasId: string,
        updates: Partial<Canvas>,
        userId: string
    ): Promise<DatabaseResult<Canvas>> {
        try {
            const updateData: Partial<CanvasDocument> = {
                ...updates,
                updatedAt: Date.now(),
                version: FieldValue.increment(1) as any
            };

            // Update search terms if name or description changed
            if (updates.name || updates.description) {
                const currentCanvas = await this.getCanvas(canvasId);
                if (currentCanvas.success) {
                    const name = updates.name || currentCanvas.data!.name;
                    const description = updates.description || currentCanvas.data!.description;
                    updateData.searchTerms = this.generateSearchTerms(name, description);
                }
            }

            await adminDb.collection(COLLECTIONS.CANVASES).doc(canvasId).update(updateData);

            // Log activity
            await this.logCanvasActivity(canvasId, {
                userId,
                type: 'canvas_updated',
                details: {
                    description: 'Canvas metadata updated',
                    previousValue: null, // Could fetch previous values if needed
                    newValue: updates
                },
                isImportant: false
            });

            const updatedCanvas = await this.getCanvas(canvasId);
            return updatedCanvas;
        } catch (error) {
            console.error('Error updating canvas:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update canvas',
                code: 'UPDATE_CANVAS_FAILED'
            };
        }
    }

    /**
     * Delete canvas (soft delete)
     */
    async deleteCanvas(canvasId: string, userId: string): Promise<DatabaseResult<void>> {
        try {
            const batch = adminDb.batch();

            // Soft delete the canvas
            const canvasRef = adminDb.collection(COLLECTIONS.CANVASES).doc(canvasId);
            batch.update(canvasRef, {
                isDeleted: true,
                deletedAt: Date.now(),
                deletedBy: userId,
                version: FieldValue.increment(1)
            });

            // TODO: In production, also mark all subcollection documents as deleted
            // This would be done by a Cloud Function to handle the scale

            await batch.commit();

            return { success: true };
        } catch (error) {
            console.error('Error deleting canvas:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete canvas',
                code: 'DELETE_CANVAS_FAILED'
            };
        }
    }

    /**
     * Get user's canvases with filtering and pagination
     */
    async getUserCanvases(
        userId: string,
        options: {
            filters?: CanvasFilters;
            sort?: CanvasSortOptions;
            limit?: number;
            cursor?: string;
        } = {}
    ): Promise<DatabaseResult<PaginatedResult<Canvas>>> {
        try {
            const { filters = {}, sort = { field: 'updatedAt', direction: 'desc' }, limit = 20 } = options;

            let query: Query = adminDb.collection(COLLECTIONS.CANVASES);

            // Apply filters
            if (filters.ownedByMe) {
                query = query.where('ownerId', '==', userId);
            }

            if (filters.privacy) {
                query = query.where('privacy', '==', filters.privacy);
            }

            if (filters.isArchived !== undefined) {
                query = query.where('isArchived', '==', filters.isArchived);
            }

            if (filters.isFavorite !== undefined) {
                query = query.where('isFavorite', '==', filters.isFavorite);
            }

            // Always filter out deleted canvases
            query = query.where('isDeleted', '==', false);

            // Apply sorting
            query = query.orderBy(sort.field, sort.direction);

            // Apply pagination
            if (options.cursor) {
                const cursorDoc = await adminDb.collection(COLLECTIONS.CANVASES).doc(options.cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            }

            query = query.limit(limit + 1); // Get one extra to check if there are more

            const snapshot = await query.get();
            const canvases: Canvas[] = [];
            let hasMore = false;

            snapshot.docs.forEach((doc, index) => {
                if (index < limit) {
                    canvases.push(doc.data() as Canvas);
                } else {
                    hasMore = true;
                }
            });

            const result: PaginatedResult<Canvas> = {
                items: canvases,
                hasMore,
                nextCursor: hasMore ? canvases[canvases.length - 1]?.id : undefined
            };

            return { success: true, data: result };
        } catch (error) {
            console.error('Error getting user canvases:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get canvases',
                code: 'GET_CANVASES_FAILED'
            };
        }
    }

    /**
     * Search public canvases
     */
    async searchPublicCanvases(
        searchTerm: string,
        options: {
            limit?: number;
            cursor?: string;
        } = {}
    ): Promise<DatabaseResult<PaginatedResult<Canvas>>> {
        try {
            const { limit = 20 } = options;

            let query: Query = adminDb.collection(COLLECTIONS.CANVASES)
                .where('privacy', '==', 'public')
                .where('isDeleted', '==', false)
                .where('searchTerms', 'array-contains-any', this.tokenizeSearchTerm(searchTerm))
                .orderBy('updatedAt', 'desc');

            if (options.cursor) {
                const cursorDoc = await adminDb.collection(COLLECTIONS.CANVASES).doc(options.cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            }

            query = query.limit(limit + 1);

            const snapshot = await query.get();
            const canvases: Canvas[] = [];
            let hasMore = false;

            snapshot.docs.forEach((doc, index) => {
                if (index < limit) {
                    canvases.push(doc.data() as Canvas);
                } else {
                    hasMore = true;
                }
            });

            const result: PaginatedResult<Canvas> = {
                items: canvases,
                hasMore,
                nextCursor: hasMore ? canvases[canvases.length - 1]?.id : undefined
            };

            return { success: true, data: result };
        } catch (error) {
            console.error('Error searching canvases:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to search canvases',
                code: 'SEARCH_CANVASES_FAILED'
            };
        }
    }

    // ========================================
    // Canvas Objects Operations
    // ========================================

    /**
     * Get all objects for a canvas
     */
    async getCanvasObjects(canvasId: string): Promise<DatabaseResult<CanvasObject[]>> {
        try {
            const snapshot = await adminDb
                .collection(FirestoreQueryHelpers.getCanvasObjectsRef(canvasId))
                .where('isDeleted', '==', false)
                .orderBy('createdAt', 'asc')
                .get();

            const objects: CanvasObject[] = snapshot.docs.map(doc => {
                const data = doc.data() as CanvasObjectDocument;
                // Return only the CanvasObject fields, not the extra Firestore fields
                return {
                    id: data.id,
                    x: data.x,
                    y: data.y,
                    type: data.type,
                    color: data.color,
                    rotation: data.rotation,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    userId: data.userId,
                    canvasId: data.canvasId,
                    // Type-specific fields
                    ...('width' in data ? { width: data.width } : {}),
                    ...('height' in data ? { height: data.height } : {}),
                    ...('radius' in data ? { radius: data.radius } : {}),
                    ...('text' in data ? {
                        text: data.text,
                        fontSize: data.fontSize,
                        fontFamily: data.fontFamily,
                        fontStyle: data.fontStyle
                    } : {})
                };
            });

            return { success: true, data: objects };
        } catch (error) {
            console.error('Error getting canvas objects:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get canvas objects',
                code: 'GET_OBJECTS_FAILED'
            };
        }
    }

    /**
     * Create canvas object
     */
    async createCanvasObject(
        canvasId: string,
        object: CanvasObject
    ): Promise<DatabaseResult<CanvasObject>> {
        try {
            const objectDoc: CanvasObjectDocument = {
                ...object,
                version: 1,
                isDeleted: false,
                lastEditedBy: object.userId || '',
                editHistory: [{
                    userId: object.userId || '',
                    timestamp: Date.now(),
                    action: 'created'
                }],
                bounds: this.calculateObjectBounds(object)
            };

            await adminDb
                .collection(FirestoreQueryHelpers.getCanvasObjectsRef(canvasId))
                .doc(object.id)
                .set(objectDoc);

            // Update canvas stats
            await this.updateCanvasStats(canvasId, {
                totalObjects: FieldValue.increment(1) as any,
                lastActivityAt: Date.now()
            });

            // Log activity
            await this.logCanvasActivity(canvasId, {
                userId: object.userId || '',
                type: 'object_created',
                details: {
                    objectId: object.id,
                    objectType: object.type,
                    description: `${object.type} object created`
                },
                isImportant: false
            });

            return { success: true, data: object };
        } catch (error) {
            console.error('Error creating canvas object:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create object',
                code: 'CREATE_OBJECT_FAILED'
            };
        }
    }

    /**
     * Update canvas object
     */
    async updateCanvasObject(
        canvasId: string,
        objectId: string,
        updates: Partial<CanvasObject>,
        userId: string
    ): Promise<DatabaseResult<CanvasObject>> {
        try {
            const updateData: Partial<CanvasObjectDocument> = {
                ...updates,
                updatedAt: Date.now(),
                version: FieldValue.increment(1) as any,
                lastEditedBy: userId
            };

            // Recalculate bounds if position or size changed
            if (updates.x !== undefined || updates.y !== undefined ||
                'width' in updates || 'height' in updates || 'radius' in updates) {
                const currentObject = await adminDb
                    .collection(FirestoreQueryHelpers.getCanvasObjectsRef(canvasId))
                    .doc(objectId)
                    .get();

                if (currentObject.exists) {
                    const currentData = currentObject.data() as CanvasObjectDocument;
                    const updatedObject = { ...currentData, ...updates } as CanvasObject;
                    updateData.bounds = this.calculateObjectBounds(updatedObject);
                }
            }

            await adminDb
                .collection(FirestoreQueryHelpers.getCanvasObjectsRef(canvasId))
                .doc(objectId)
                .update(updateData);

            // Update canvas activity time
            await this.updateCanvasStats(canvasId, {
                lastActivityAt: Date.now()
            });

            // Log activity
            await this.logCanvasActivity(canvasId, {
                userId,
                type: 'object_updated',
                details: {
                    objectId,
                    description: 'Object updated'
                },
                isImportant: false
            });

            // Return updated object
            const updatedDoc = await adminDb
                .collection(FirestoreQueryHelpers.getCanvasObjectsRef(canvasId))
                .doc(objectId)
                .get();

            if (updatedDoc.exists) {
                const updatedData = updatedDoc.data() as CanvasObjectDocument;
                const updatedObject: CanvasObject = {
                    id: updatedData.id,
                    x: updatedData.x,
                    y: updatedData.y,
                    type: updatedData.type,
                    color: updatedData.color,
                    rotation: updatedData.rotation,
                    createdAt: updatedData.createdAt,
                    updatedAt: updatedData.updatedAt,
                    userId: updatedData.userId,
                    canvasId: updatedData.canvasId,
                    ...('width' in updatedData ? { width: updatedData.width } : {}),
                    ...('height' in updatedData ? { height: updatedData.height } : {}),
                    ...('radius' in updatedData ? { radius: updatedData.radius } : {}),
                    ...('text' in updatedData ? {
                        text: updatedData.text,
                        fontSize: updatedData.fontSize,
                        fontFamily: updatedData.fontFamily,
                        fontStyle: updatedData.fontStyle
                    } : {})
                };
                return { success: true, data: updatedObject };
            }

            return {
                success: false,
                error: 'Failed to retrieve updated object',
                code: 'UPDATE_OBJECT_FAILED'
            };
        } catch (error) {
            console.error('Error updating canvas object:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update object',
                code: 'UPDATE_OBJECT_FAILED'
            };
        }
    }

    /**
     * Delete canvas object (soft delete)
     */
    async deleteCanvasObject(
        canvasId: string,
        objectId: string,
        userId: string
    ): Promise<DatabaseResult<void>> {
        try {
            await adminDb
                .collection(FirestoreQueryHelpers.getCanvasObjectsRef(canvasId))
                .doc(objectId)
                .update({
                    isDeleted: true,
                    deletedAt: Date.now(),
                    deletedBy: userId,
                    version: FieldValue.increment(1)
                });

            // Update canvas stats
            await this.updateCanvasStats(canvasId, {
                totalObjects: FieldValue.increment(-1) as any,
                lastActivityAt: Date.now()
            });

            // Log activity
            await this.logCanvasActivity(canvasId, {
                userId,
                type: 'object_deleted',
                details: {
                    objectId,
                    description: 'Object deleted'
                },
                isImportant: false
            });

            return { success: true };
        } catch (error) {
            console.error('Error deleting canvas object:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete object',
                code: 'DELETE_OBJECT_FAILED'
            };
        }
    }

    // ========================================
    // Canvas Permissions Operations
    // ========================================

    /**
     * Create canvas permission
     */
    async createCanvasPermission(
        canvasId: string,
        permission: CanvasPermission
    ): Promise<DatabaseResult<CanvasPermission>> {
        try {
            const permissionDoc: CanvasPermissionDocument = {
                ...permission,
                isActive: true,
                history: [{
                    action: 'granted',
                    newRole: permission.role,
                    changedBy: permission.grantedBy,
                    timestamp: permission.grantedAt,
                    reason: 'Permission granted'
                }]
            };

            await adminDb
                .collection(FirestoreQueryHelpers.getCanvasPermissionsRef(canvasId))
                .doc(permission.userId)
                .set(permissionDoc);

            return { success: true, data: permission };
        } catch (error) {
            console.error('Error creating canvas permission:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create permission',
                code: 'CREATE_PERMISSION_FAILED'
            };
        }
    }

    /**
     * Get canvas permission for user
     */
    async getCanvasPermission(
        canvasId: string,
        userId: string
    ): Promise<DatabaseResult<CanvasPermission>> {
        try {
            const doc = await adminDb
                .collection(FirestoreQueryHelpers.getCanvasPermissionsRef(canvasId))
                .doc(userId)
                .get();

            if (!doc.exists) {
                return {
                    success: false,
                    error: 'Permission not found',
                    code: 'PERMISSION_NOT_FOUND'
                };
            }

            const permissionData = doc.data() as CanvasPermissionDocument;

            if (!permissionData.isActive) {
                return {
                    success: false,
                    error: 'Permission is inactive',
                    code: 'PERMISSION_INACTIVE'
                };
            }

            return { success: true, data: permissionData };
        } catch (error) {
            console.error('Error getting canvas permission:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get permission',
                code: 'GET_PERMISSION_FAILED'
            };
        }
    }

    /**
     * Get all permissions for a canvas
     */
    async getCanvasPermissions(canvasId: string): Promise<DatabaseResult<CanvasPermission[]>> {
        try {
            const snapshot = await adminDb
                .collection(FirestoreQueryHelpers.getCanvasPermissionsRef(canvasId))
                .where('isActive', '==', true)
                .orderBy('grantedAt', 'desc')
                .get();

            const permissions: CanvasPermission[] = snapshot.docs.map(doc => doc.data() as CanvasPermission);

            return { success: true, data: permissions };
        } catch (error) {
            console.error('Error getting canvas permissions:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get permissions',
                code: 'GET_PERMISSIONS_FAILED'
            };
        }
    }

    // ========================================
    // Canvas Presence Operations
    // ========================================

    /**
     * Update user presence
     */
    async updateUserPresence(
        canvasId: string,
        userId: string,
        presence: Partial<CanvasPresenceDocument>
    ): Promise<DatabaseResult<void>> {
        try {
            const presenceData = {
                ...presence,
                userId,
                canvasId,
                lastSeenAt: Date.now()
            };

            await adminDb
                .collection(FirestoreQueryHelpers.getCanvasPresenceRef(canvasId))
                .doc(userId)
                .set(presenceData, { merge: true });

            return { success: true };
        } catch (error) {
            console.error('Error updating user presence:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update presence',
                code: 'UPDATE_PRESENCE_FAILED'
            };
        }
    }

    /**
     * Get active users for canvas
     */
    async getCanvasActiveUsers(canvasId: string): Promise<DatabaseResult<CanvasPresenceDocument[]>> {
        try {
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

            const snapshot = await adminDb
                .collection(FirestoreQueryHelpers.getCanvasPresenceRef(canvasId))
                .where('isOnline', '==', true)
                .where('lastSeenAt', '>', fiveMinutesAgo)
                .get();

            const activeUsers: CanvasPresenceDocument[] = snapshot.docs.map(doc =>
                doc.data() as CanvasPresenceDocument
            );

            return { success: true, data: activeUsers };
        } catch (error) {
            console.error('Error getting active users:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get active users',
                code: 'GET_ACTIVE_USERS_FAILED'
            };
        }
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    private generateSearchTerms(name?: string, description?: string): string[] {
        const terms: string[] = [];

        if (name) {
            terms.push(...this.tokenizeSearchTerm(name));
        }

        if (description) {
            terms.push(...this.tokenizeSearchTerm(description));
        }

        return [...new Set(terms)]; // Remove duplicates
    }

    private tokenizeSearchTerm(term: string): string[] {
        return term
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 2);
    }

    private calculateObjectBounds(object: CanvasObject): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } {
        let minX = object.x;
        let minY = object.y;
        let maxX = object.x;
        let maxY = object.y;

        switch (object.type) {
            case 'rectangle':
                maxX = object.x + (object as any).width;
                maxY = object.y + (object as any).height;
                break;
            case 'circle':
                const radius = (object as any).radius;
                minX = object.x - radius;
                minY = object.y - radius;
                maxX = object.x + radius;
                maxY = object.y + radius;
                break;
            case 'text':
                const fontSize = (object as any).fontSize;
                const text = (object as any).text;
                // Estimate text bounds
                const textWidth = text.length * (fontSize * 0.6);
                const textHeight = fontSize * 1.2;
                maxX = object.x + textWidth;
                maxY = object.y + textHeight;
                break;
        }

        return { minX, minY, maxX, maxY };
    }

    private async updateCanvasStats(
        canvasId: string,
        stats: Partial<CanvasDocument['stats']>
    ): Promise<void> {
        try {
            const updateData: any = {};
            Object.keys(stats).forEach(key => {
                updateData[`stats.${key}`] = (stats as any)[key];
            });

            await adminDb.collection(COLLECTIONS.CANVASES).doc(canvasId).update(updateData);
        } catch (error) {
            console.error('Error updating canvas stats:', error);
        }
    }

    private async logCanvasActivity(
        canvasId: string,
        activity: {
            userId: string;
            type: CanvasActivityDocument['type'];
            details: CanvasActivityDocument['details'];
            isImportant: boolean;
        }
    ): Promise<void> {
        try {
            const activityDoc: CanvasActivityDocument = {
                id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                canvasId,
                userId: activity.userId,
                timestamp: Date.now(),
                type: activity.type,
                details: activity.details,
                isImportant: activity.isImportant
            };

            await adminDb
                .collection(FirestoreQueryHelpers.getCanvasActivityRef(canvasId))
                .add(activityDoc);
        } catch (error) {
            console.error('Error logging canvas activity:', error);
        }
    }
}

// Export singleton instance
export const firestoreService = FirestoreService.getInstance();
