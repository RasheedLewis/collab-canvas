/**
 * Canvas State Service
 * 
 * Manages canvas state isolation and provides methods for handling
 * canvas-specific data collections in Firestore.
 */

import {
    Canvas,
    CanvasObject,
    CanvasState,
    CanvasMetrics,
    CanvasPermission as CanvasPermissionType
} from '../../../shared/types';
import { Canvas as CanvasModel } from '../models/Canvas';
import { CanvasPermission } from '../models/CanvasPermission';
import { CanvasStateUtils } from '../utils/canvasUtils';

/**
 * Service for managing canvas state isolation and data operations
 */
export class CanvasStateService {
    private static instance: CanvasStateService;

    // In-memory cache for active canvas states
    private canvasStates: Map<string, CanvasState> = new Map();
    private canvasMetrics: Map<string, CanvasMetrics> = new Map();

    // Cache for canvas instances
    private canvasCache: Map<string, CanvasModel> = new Map();
    private permissionCache: Map<string, Map<string, CanvasPermission>> = new Map();

    private constructor() {
        // Private constructor for singleton
    }

    static getInstance(): CanvasStateService {
        if (!CanvasStateService.instance) {
            CanvasStateService.instance = new CanvasStateService();
        }
        return CanvasStateService.instance;
    }

    // ========================================
    // Canvas State Management
    // ========================================

    /**
     * Get canvas state with automatic initialization if needed
     */
    async getCanvasState(canvasId: string): Promise<CanvasState> {
        // Check in-memory cache first
        let state = this.canvasStates.get(canvasId);

        if (!state) {
            // Initialize empty state for new canvas
            state = {
                canvasId,
                objects: [],
                lastSyncAt: Date.now(),
                version: 1
            };

            // In production, this would load from Firestore
            // For now, we'll use in-memory state
            this.canvasStates.set(canvasId, state);
        }

        return state;
    }

    /**
     * Update canvas state with new objects
     */
    async updateCanvasState(canvasId: string, objects: CanvasObject[]): Promise<CanvasState> {
        const state: CanvasState = {
            canvasId,
            objects,
            lastSyncAt: Date.now(),
            version: (this.canvasStates.get(canvasId)?.version || 0) + 1
        };

        this.canvasStates.set(canvasId, state);

        // Update canvas object count in metadata
        await this.updateCanvasObjectCount(canvasId, objects.length);

        // In production, this would save to Firestore collection for this canvas
        // await this.saveStateToFirestore(canvasId, state);

        return state;
    }

    /**
     * Add object to canvas state
     */
    async addObjectToCanvas(canvasId: string, object: CanvasObject): Promise<CanvasState> {
        const state = await this.getCanvasState(canvasId);

        // Check if object already exists (prevent duplicates)
        const existingIndex = state.objects.findIndex(obj => obj.id === object.id);
        if (existingIndex >= 0) {
            // Update existing object
            state.objects[existingIndex] = object;
        } else {
            // Add new object
            state.objects.push(object);
        }

        return await this.updateCanvasState(canvasId, state.objects);
    }

    /**
     * Update object in canvas state
     */
    async updateObjectInCanvas(canvasId: string, objectId: string, updates: Partial<CanvasObject>): Promise<CanvasState> {
        const state = await this.getCanvasState(canvasId);

        const objectIndex = state.objects.findIndex(obj => obj.id === objectId);
        if (objectIndex >= 0) {
            state.objects[objectIndex] = {
                ...state.objects[objectIndex],
                ...updates,
                updatedAt: Date.now()
            };
        }

        return await this.updateCanvasState(canvasId, state.objects);
    }

    /**
     * Remove object from canvas state
     */
    async removeObjectFromCanvas(canvasId: string, objectId: string): Promise<CanvasState> {
        const state = await this.getCanvasState(canvasId);
        state.objects = state.objects.filter(obj => obj.id !== objectId);

        return await this.updateCanvasState(canvasId, state.objects);
    }

    /**
     * Clear all objects from canvas
     */
    async clearCanvas(canvasId: string): Promise<CanvasState> {
        return await this.updateCanvasState(canvasId, []);
    }

    // ========================================
    // Canvas Metadata Management
    // ========================================

    /**
     * Update canvas object count
     */
    private async updateCanvasObjectCount(canvasId: string, count: number): Promise<void> {
        const canvas = this.canvasCache.get(canvasId);
        if (canvas) {
            canvas.updateObjectCount(count);
            // In production, save to database
        }
    }

    /**
     * Get canvas metrics (active users, objects, etc.)
     */
    async getCanvasMetrics(canvasId: string): Promise<CanvasMetrics> {
        let metrics = this.canvasMetrics.get(canvasId);

        if (!metrics) {
            const state = await this.getCanvasState(canvasId);
            metrics = {
                canvasId,
                activeUsers: 0,
                totalObjects: state.objects.length,
                lastActivity: state.lastSyncAt,
                collaborators: []
            };

            this.canvasMetrics.set(canvasId, metrics);
        }

        return metrics;
    }

    /**
     * Update canvas metrics with user activity
     */
    async updateUserActivity(
        canvasId: string,
        userId: string,
        displayName: string,
        avatarColor: string
    ): Promise<void> {
        const metrics = await this.getCanvasMetrics(canvasId);

        // Update or add collaborator
        const existingIndex = metrics.collaborators.findIndex(c => c.userId === userId);
        const collaborator = {
            userId,
            displayName,
            avatarColor,
            lastSeen: Date.now(),
            isActive: true
        };

        if (existingIndex >= 0) {
            metrics.collaborators[existingIndex] = collaborator;
        } else {
            metrics.collaborators.push(collaborator);
        }

        metrics.lastActivity = Date.now();
        metrics.activeUsers = metrics.collaborators.filter(c => c.isActive).length;

        this.canvasMetrics.set(canvasId, metrics);
    }

    /**
     * Mark user as inactive in canvas
     */
    async markUserInactive(canvasId: string, userId: string): Promise<void> {
        const metrics = await this.getCanvasMetrics(canvasId);

        const collaborator = metrics.collaborators.find(c => c.userId === userId);
        if (collaborator) {
            collaborator.isActive = false;
            collaborator.lastSeen = Date.now();
        }

        metrics.activeUsers = metrics.collaborators.filter(c => c.isActive).length;
        this.canvasMetrics.set(canvasId, metrics);
    }

    // ========================================
    // Collection Name Generators
    // ========================================

    /**
     * Get Firestore collection path for canvas objects
     */
    getObjectsCollectionPath(canvasId: string): string {
        return `canvases/${canvasId}/objects`;
    }

    /**
     * Get Firestore collection path for canvas permissions  
     */
    getPermissionsCollectionPath(canvasId: string): string {
        return `canvases/${canvasId}/permissions`;
    }

    /**
     * Get Firestore collection path for canvas presence
     */
    getPresenceCollectionPath(canvasId: string): string {
        return `canvases/${canvasId}/presence`;
    }

    /**
     * Get Firestore collection path for canvas activity log
     */
    getActivityLogCollectionPath(canvasId: string): string {
        return `canvases/${canvasId}/activity`;
    }

    /**
     * Get WebSocket room identifier for canvas
     */
    getWebSocketRoomId(canvasId: string): string {
        return CanvasStateUtils.getWebSocketRoomId(canvasId);
    }

    // ========================================
    // Canvas Cleanup and Deletion
    // ========================================

    /**
     * Clean up canvas data when canvas is deleted
     */
    async cleanupCanvasData(canvasId: string): Promise<void> {
        // Remove from in-memory caches
        this.canvasStates.delete(canvasId);
        this.canvasMetrics.delete(canvasId);
        this.canvasCache.delete(canvasId);
        this.permissionCache.delete(canvasId);

        // In production, this would:
        // 1. Delete all objects in canvas objects collection
        // 2. Delete all permissions in canvas permissions collection  
        // 3. Delete all presence data in canvas presence collection
        // 4. Delete all activity logs in canvas activity collection
        // 5. Clean up any associated thumbnails and files

        console.log(`Canvas ${canvasId} data cleaned up`);
    }

    /**
     * Get all active canvas IDs for monitoring
     */
    getActiveCanvasIds(): string[] {
        return Array.from(this.canvasStates.keys());
    }

    /**
     * Get memory usage statistics
     */
    getMemoryStats(): {
        activeCanvases: number;
        totalObjects: number;
        cacheSize: number;
    } {
        const totalObjects = Array.from(this.canvasStates.values())
            .reduce((sum, state) => sum + state.objects.length, 0);

        return {
            activeCanvases: this.canvasStates.size,
            totalObjects,
            cacheSize: this.canvasCache.size
        };
    }

    // ========================================
    // Migration Utilities
    // ========================================

    /**
     * Migrate single canvas data to multi-canvas structure
     * This is used when migrating from the current single-canvas system
     */
    async migrateSingleCanvasData(
        existingObjects: CanvasObject[],
        defaultCanvasId: string,
        ownerId: string
    ): Promise<void> {
        // Create default canvas if it doesn't exist
        if (!this.canvasCache.has(defaultCanvasId)) {
            const defaultCanvas = new CanvasModel({
                id: defaultCanvasId,
                name: 'My First Canvas',
                description: 'Migrated from single canvas system',
                ownerId,
                privacy: 'private'
            });

            this.canvasCache.set(defaultCanvasId, defaultCanvas);
        }

        // Migrate objects to new structure
        const migratedObjects = existingObjects.map(obj => ({
            ...obj,
            canvasId: defaultCanvasId
        }));

        await this.updateCanvasState(defaultCanvasId, migratedObjects);

        console.log(`Migrated ${migratedObjects.length} objects to canvas ${defaultCanvasId}`);
    }
}

// Export singleton instance
export const canvasStateService = CanvasStateService.getInstance();
