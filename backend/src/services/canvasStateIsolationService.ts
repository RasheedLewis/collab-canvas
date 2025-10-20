/**
 * Canvas State Isolation Service
 * 
 * Provides comprehensive canvas state isolation with per-canvas object management,
 * cursor tracking, presence data, and seamless canvas switching capabilities.
 */

import { CanvasNamespaceManager } from '../websocket/canvasNamespaceManager';
import { canvasStateService } from './canvasStateService';
import { AuditLogService } from './auditLogService';
import {
    CanvasObject,
    CanvasState,
    PermissionRole,
    User
} from '../../../shared/types';

export interface CanvasCursorState {
    userId: string;
    clientId: string;
    x: number;
    y: number;
    visible: boolean;
    tool?: string;
    color?: string;
    displayName: string;
    avatarColor?: string;
    lastUpdated: number;
}

export interface CanvasPresenceState {
    userId: string;
    clientId: string;
    displayName: string;
    avatarColor?: string;
    role: PermissionRole;
    status: 'active' | 'idle' | 'away';
    joinedAt: number;
    lastActivity: number;
    cursor?: CanvasCursorState;
}

export interface CanvasActivityEvent {
    id: string;
    canvasId: string;
    userId: string;
    clientId: string;
    type: 'join' | 'leave' | 'object_create' | 'object_update' | 'object_delete' | 'cursor_move' | 'idle' | 'away' | 'active';
    timestamp: number;
    data?: any;
}

export interface CanvasStateSnapshot {
    canvasId: string;
    objects: CanvasObject[];
    cursors: Map<string, CanvasCursorState>;
    presence: Map<string, CanvasPresenceState>;
    activity: CanvasActivityEvent[];
    metadata: {
        memberCount: number;
        lastActivity: number;
        version: number;
    };
}

/**
 * Canvas State Isolation Service - Singleton
 */
export class CanvasStateIsolationService {
    private static instance: CanvasStateIsolationService;

    // State isolation maps - each canvas has completely isolated data
    private canvasObjects: Map<string, Map<string, CanvasObject>> = new Map();
    private canvasCursors: Map<string, Map<string, CanvasCursorState>> = new Map();
    private canvasPresence: Map<string, Map<string, CanvasPresenceState>> = new Map();
    private canvasActivity: Map<string, CanvasActivityEvent[]> = new Map();

    // Client to canvas mapping for efficient lookups
    private clientToCanvas: Map<string, string> = new Map();
    private userToCanvases: Map<string, Set<string>> = new Map();

    // Activity tracking
    private activityTimers: Map<string, NodeJS.Timeout> = new Map();
    private idleThreshold = 2 * 60 * 1000; // 2 minutes
    private awayThreshold = 5 * 60 * 1000; // 5 minutes

    // State cleanup
    private cleanupInterval: NodeJS.Timeout | null = null;
    private cleanupIntervalMs = 10 * 60 * 1000; // 10 minutes

    // Services
    private namespaceManager: CanvasNamespaceManager;
    private auditService: AuditLogService;

    private constructor() {
        this.namespaceManager = CanvasNamespaceManager.getInstance();
        this.auditService = AuditLogService.getInstance();
        this.initializeCleanupTasks();
    }

    public static getInstance(): CanvasStateIsolationService {
        if (!CanvasStateIsolationService.instance) {
            CanvasStateIsolationService.instance = new CanvasStateIsolationService();
        }
        return CanvasStateIsolationService.instance;
    }

    // ========================================
    // Canvas Object State Isolation
    // ========================================

    /**
     * Get all objects for a specific canvas (completely isolated)
     */
    public getCanvasObjects(canvasId: string): CanvasObject[] {
        const objectMap = this.canvasObjects.get(canvasId);
        return objectMap ? Array.from(objectMap.values()) : [];
    }

    /**
     * Add object to specific canvas only
     */
    public async addObjectToCanvas(
        canvasId: string,
        object: CanvasObject,
        userId: string,
        clientId: string
    ): Promise<void> {
        // Ensure canvas object map exists
        if (!this.canvasObjects.has(canvasId)) {
            this.canvasObjects.set(canvasId, new Map());
        }

        const objectMap = this.canvasObjects.get(canvasId)!;
        objectMap.set(object.id, object);

        // Update persistent state
        await canvasStateService.addObjectToCanvas(canvasId, object);

        // Log activity
        await this.logActivity(canvasId, userId, clientId, 'object_create', {
            objectId: object.id,
            objectType: object.type
        });

        console.log(`🎨 Added object ${object.id} to canvas ${canvasId}`);
    }

    /**
     * Update object in specific canvas only
     */
    public async updateObjectInCanvas(
        canvasId: string,
        objectId: string,
        updates: Partial<CanvasObject>,
        userId: string,
        clientId: string
    ): Promise<void> {
        const objectMap = this.canvasObjects.get(canvasId);
        if (!objectMap || !objectMap.has(objectId)) {
            throw new Error(`Object ${objectId} not found in canvas ${canvasId}`);
        }

        const existingObject = objectMap.get(objectId)!;
        const updatedObject = { ...existingObject, ...updates, updatedAt: Date.now() };
        objectMap.set(objectId, updatedObject);

        // Update persistent state
        await canvasStateService.updateObjectInCanvas(canvasId, objectId, updates);

        // Log activity
        await this.logActivity(canvasId, userId, clientId, 'object_update', {
            objectId,
            updates: Object.keys(updates)
        });

        console.log(`🎨 Updated object ${objectId} in canvas ${canvasId}`);
    }

    /**
     * Remove object from specific canvas only
     */
    public async removeObjectFromCanvas(
        canvasId: string,
        objectId: string,
        userId: string,
        clientId: string
    ): Promise<void> {
        const objectMap = this.canvasObjects.get(canvasId);
        if (!objectMap) {
            return; // Canvas doesn't exist
        }

        objectMap.delete(objectId);

        // Update persistent state
        await canvasStateService.removeObjectFromCanvas(canvasId, objectId);

        // Log activity
        await this.logActivity(canvasId, userId, clientId, 'object_delete', {
            objectId
        });

        console.log(`🗑️ Removed object ${objectId} from canvas ${canvasId}`);
    }

    /**
     * Clear all objects from specific canvas only
     */
    public async clearCanvas(
        canvasId: string,
        userId: string,
        clientId: string
    ): Promise<void> {
        const objectMap = this.canvasObjects.get(canvasId);
        if (objectMap) {
            const objectCount = objectMap.size;
            objectMap.clear();

            // Update persistent state
            await canvasStateService.clearCanvas(canvasId);

            // Log activity
            await this.logActivity(canvasId, userId, clientId, 'object_delete', {
                action: 'clear_canvas',
                objectCount
            });

            console.log(`🧹 Cleared ${objectCount} objects from canvas ${canvasId}`);
        }
    }

    // ========================================
    // Canvas-Specific Cursor Management
    // ========================================

    /**
     * Update cursor position for user in specific canvas
     */
    public updateCanvasCursor(
        canvasId: string,
        userId: string,
        clientId: string,
        cursor: {
            x: number;
            y: number;
            visible: boolean;
            tool?: string;
            color?: string;
        },
        userInfo: {
            displayName: string;
            avatarColor?: string;
        }
    ): void {
        // Ensure canvas cursor map exists
        if (!this.canvasCursors.has(canvasId)) {
            this.canvasCursors.set(canvasId, new Map());
        }

        const cursorMap = this.canvasCursors.get(canvasId)!;
        const cursorState: CanvasCursorState = {
            userId,
            clientId,
            x: cursor.x,
            y: cursor.y,
            visible: cursor.visible,
            tool: cursor.tool,
            color: cursor.color,
            displayName: userInfo.displayName,
            avatarColor: userInfo.avatarColor,
            lastUpdated: Date.now()
        };

        cursorMap.set(userId, cursorState);

        // Update user activity
        this.updateUserActivity(canvasId, userId, clientId);

        // Log cursor activity (throttled)
        this.throttledCursorActivity(canvasId, userId, clientId);
    }

    /**
     * Remove cursor from specific canvas
     */
    public removeCanvasCursor(canvasId: string, userId: string): void {
        const cursorMap = this.canvasCursors.get(canvasId);
        if (cursorMap) {
            cursorMap.delete(userId);
        }
    }

    /**
     * Get all cursors for specific canvas
     */
    public getCanvasCursors(canvasId: string): CanvasCursorState[] {
        const cursorMap = this.canvasCursors.get(canvasId);
        return cursorMap ? Array.from(cursorMap.values()) : [];
    }

    /**
     * Get cursor for specific user in canvas
     */
    public getUserCursorInCanvas(canvasId: string, userId: string): CanvasCursorState | null {
        const cursorMap = this.canvasCursors.get(canvasId);
        return cursorMap?.get(userId) || null;
    }

    // ========================================
    // Canvas-Specific Presence Management
    // ========================================

    /**
     * Add user presence to specific canvas
     */
    public addCanvasPresence(
        canvasId: string,
        userId: string,
        clientId: string,
        userInfo: {
            displayName: string;
            avatarColor?: string;
            role: PermissionRole;
        }
    ): void {
        // Ensure canvas presence map exists
        if (!this.canvasPresence.has(canvasId)) {
            this.canvasPresence.set(canvasId, new Map());
        }

        const presenceMap = this.canvasPresence.get(canvasId)!;
        const presence: CanvasPresenceState = {
            userId,
            clientId,
            displayName: userInfo.displayName,
            avatarColor: userInfo.avatarColor,
            role: userInfo.role,
            status: 'active',
            joinedAt: Date.now(),
            lastActivity: Date.now()
        };

        presenceMap.set(userId, presence);

        // Update client mapping
        this.clientToCanvas.set(clientId, canvasId);

        // Update user to canvas mapping
        if (!this.userToCanvases.has(userId)) {
            this.userToCanvases.set(userId, new Set());
        }
        this.userToCanvases.get(userId)!.add(canvasId);

        // Log activity
        this.logActivity(canvasId, userId, clientId, 'join');

        console.log(`👤 User ${userId} joined canvas ${canvasId} as ${userInfo.role}`);
    }

    /**
     * Remove user presence from specific canvas
     */
    public removeCanvasPresence(canvasId: string, userId: string, clientId: string): void {
        const presenceMap = this.canvasPresence.get(canvasId);
        if (presenceMap) {
            presenceMap.delete(userId);

            // Update mappings
            this.clientToCanvas.delete(clientId);
            const userCanvases = this.userToCanvases.get(userId);
            if (userCanvases) {
                userCanvases.delete(canvasId);
                if (userCanvases.size === 0) {
                    this.userToCanvases.delete(userId);
                }
            }

            // Remove cursor
            this.removeCanvasCursor(canvasId, userId);

            // Clear activity timer
            const timerKey = `${canvasId}:${userId}`;
            const timer = this.activityTimers.get(timerKey);
            if (timer) {
                clearTimeout(timer);
                this.activityTimers.delete(timerKey);
            }

            // Log activity
            this.logActivity(canvasId, userId, clientId, 'leave');

            console.log(`👤 User ${userId} left canvas ${canvasId}`);
        }
    }

    /**
     * Get all presence data for specific canvas
     */
    public getCanvasPresence(canvasId: string): CanvasPresenceState[] {
        const presenceMap = this.canvasPresence.get(canvasId);
        return presenceMap ? Array.from(presenceMap.values()) : [];
    }

    /**
     * Update user activity and status
     */
    public updateUserActivity(canvasId: string, userId: string, clientId: string): void {
        const presenceMap = this.canvasPresence.get(canvasId);
        const presence = presenceMap?.get(userId);

        if (presence) {
            presence.lastActivity = Date.now();

            // Update status to active if it wasn't
            if (presence.status !== 'active') {
                presence.status = 'active';
                this.logActivity(canvasId, userId, clientId, 'active');
            }

            // Reset activity timer
            const timerKey = `${canvasId}:${userId}`;
            const existingTimer = this.activityTimers.get(timerKey);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            // Set new timer for idle detection
            const timer = setTimeout(() => {
                this.handleUserInactivity(canvasId, userId, clientId);
            }, this.idleThreshold);

            this.activityTimers.set(timerKey, timer);
        }
    }

    /**
     * Handle user inactivity progression
     */
    private handleUserInactivity(canvasId: string, userId: string, clientId: string): void {
        const presenceMap = this.canvasPresence.get(canvasId);
        const presence = presenceMap?.get(userId);

        if (!presence) return;

        const inactiveTime = Date.now() - presence.lastActivity;

        if (inactiveTime >= this.awayThreshold) {
            // Mark as away
            presence.status = 'away';
            this.logActivity(canvasId, userId, clientId, 'away');
        } else if (inactiveTime >= this.idleThreshold) {
            // Mark as idle
            presence.status = 'idle';
            this.logActivity(canvasId, userId, clientId, 'idle');

            // Set timer for away status
            const timerKey = `${canvasId}:${userId}`;
            const timer = setTimeout(() => {
                this.handleUserInactivity(canvasId, userId, clientId);
            }, this.awayThreshold - inactiveTime);

            this.activityTimers.set(timerKey, timer);
        }
    }

    // ========================================
    // Canvas Switching Support
    // ========================================

    /**
     * Switch user from one canvas to another seamlessly
     */
    public async switchUserCanvas(
        userId: string,
        clientId: string,
        fromCanvasId: string | null,
        toCanvasId: string,
        userInfo: {
            displayName: string;
            avatarColor?: string;
            role: PermissionRole;
        }
    ): Promise<void> {
        // Remove from previous canvas if specified
        if (fromCanvasId) {
            this.removeCanvasPresence(fromCanvasId, userId, clientId);
        } else {
            // Remove from all canvases for this client
            const currentCanvasId = this.clientToCanvas.get(clientId);
            if (currentCanvasId) {
                this.removeCanvasPresence(currentCanvasId, userId, clientId);
            }
        }

        // Add to new canvas
        this.addCanvasPresence(toCanvasId, userId, clientId, userInfo);

        console.log(`🔄 User ${userId} switched from ${fromCanvasId || 'any'} to canvas ${toCanvasId}`);
    }

    /**
     * Get canvas state snapshot for seamless switching
     */
    public getCanvasStateSnapshot(canvasId: string): CanvasStateSnapshot {
        const objects = this.getCanvasObjects(canvasId);
        const cursors = this.canvasCursors.get(canvasId) || new Map();
        const presence = this.canvasPresence.get(canvasId) || new Map();
        const activity = this.canvasActivity.get(canvasId) || [];

        return {
            canvasId,
            objects,
            cursors: new Map(cursors),
            presence: new Map(presence),
            activity: [...activity],
            metadata: {
                memberCount: presence.size,
                lastActivity: Math.max(
                    ...Array.from(presence.values()).map(p => p.lastActivity),
                    0
                ),
                version: Date.now()
            }
        };
    }

    // ========================================
    // Activity Tracking and Logging
    // ========================================

    /**
     * Log activity event for canvas
     */
    private async logActivity(
        canvasId: string,
        userId: string,
        clientId: string,
        type: CanvasActivityEvent['type'],
        data?: any
    ): Promise<void> {
        // Ensure activity array exists
        if (!this.canvasActivity.has(canvasId)) {
            this.canvasActivity.set(canvasId, []);
        }

        const activity = this.canvasActivity.get(canvasId)!;
        const event: CanvasActivityEvent = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            canvasId,
            userId,
            clientId,
            type,
            timestamp: Date.now(),
            data
        };

        activity.push(event);

        // Keep only recent activities (last 100 events per canvas)
        if (activity.length > 100) {
            activity.splice(0, activity.length - 100);
        }

        // Log to audit service for important events
        if (['join', 'leave', 'object_create', 'object_delete'].includes(type)) {
            await this.auditService.logCanvasAccess({
                userId,
                canvasId,
                action: `Canvas activity: ${type}`,
                granted: true,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Throttled cursor activity logging
     */
    private cursorActivityThrottles: Map<string, number> = new Map();
    private throttledCursorActivity(canvasId: string, userId: string, clientId: string): void {
        const key = `${canvasId}:${userId}`;
        const now = Date.now();
        const lastLog = this.cursorActivityThrottles.get(key) || 0;

        // Log cursor activity maximum once per 5 seconds per user
        if (now - lastLog > 5000) {
            this.logActivity(canvasId, userId, clientId, 'cursor_move');
            this.cursorActivityThrottles.set(key, now);
        }
    }

    /**
     * Get recent activity for canvas
     */
    public getCanvasActivity(canvasId: string, limit: number = 20): CanvasActivityEvent[] {
        const activity = this.canvasActivity.get(canvasId) || [];
        return activity.slice(-limit);
    }

    // ========================================
    // Canvas State Cleanup
    // ========================================

    /**
     * Clean up state when user disconnects completely
     */
    public async cleanupUserState(userId: string, clientId: string): Promise<void> {
        // Get all canvases this user is in
        const userCanvases = this.userToCanvases.get(userId);

        if (userCanvases) {
            // Remove from all canvases
            for (const canvasId of userCanvases) {
                this.removeCanvasPresence(canvasId, userId, clientId);
            }
        }

        // Also check client mapping in case user mapping is inconsistent
        const canvasId = this.clientToCanvas.get(clientId);
        if (canvasId) {
            this.removeCanvasPresence(canvasId, userId, clientId);
        }

        console.log(`🧹 Cleaned up state for user ${userId} (${clientId})`);
    }

    /**
     * Clean up empty canvas states
     */
    public cleanupEmptyCanvases(): void {
        const now = Date.now();
        const emptyThreshold = 30 * 60 * 1000; // 30 minutes

        for (const [canvasId, presenceMap] of this.canvasPresence.entries()) {
            if (presenceMap.size === 0) {
                // Check if canvas has been empty for a while
                const activity = this.canvasActivity.get(canvasId);
                const lastActivity = activity && activity.length > 0
                    ? activity[activity.length - 1].timestamp
                    : 0;

                if (now - lastActivity > emptyThreshold) {
                    // Clean up canvas state
                    this.canvasObjects.delete(canvasId);
                    this.canvasCursors.delete(canvasId);
                    this.canvasPresence.delete(canvasId);
                    this.canvasActivity.delete(canvasId);

                    console.log(`🧹 Cleaned up empty canvas: ${canvasId}`);
                }
            }
        }
    }

    // ========================================
    // Initialization and Cleanup
    // ========================================

    /**
     * Initialize cleanup tasks
     */
    private initializeCleanupTasks(): void {
        // Regular cleanup of empty canvases and old activity
        this.cleanupInterval = setInterval(() => {
            this.cleanupEmptyCanvases();
            this.cleanupOldCursorActivity();
        }, this.cleanupIntervalMs);
    }

    /**
     * Clean up old cursor activity throttles
     */
    private cleanupOldCursorActivity(): void {
        const now = Date.now();
        const cleanupThreshold = 10 * 60 * 1000; // 10 minutes

        for (const [key, timestamp] of this.cursorActivityThrottles.entries()) {
            if (now - timestamp > cleanupThreshold) {
                this.cursorActivityThrottles.delete(key);
            }
        }
    }

    /**
     * Get service statistics
     */
    public getServiceStats(): {
        activeCanvases: number;
        totalObjects: number;
        totalUsers: number;
        totalClients: number;
        memoryUsage: {
            objects: number;
            cursors: number;
            presence: number;
            activity: number;
        };
    } {
        let totalObjects = 0;
        let totalUsers = 0;
        let totalClients = 0;

        for (const objectMap of this.canvasObjects.values()) {
            totalObjects += objectMap.size;
        }

        for (const presenceMap of this.canvasPresence.values()) {
            totalUsers += presenceMap.size;
        }

        totalClients = this.clientToCanvas.size;

        return {
            activeCanvases: this.canvasObjects.size,
            totalObjects,
            totalUsers,
            totalClients,
            memoryUsage: {
                objects: this.canvasObjects.size,
                cursors: this.canvasCursors.size,
                presence: this.canvasPresence.size,
                activity: this.canvasActivity.size
            }
        };
    }

    /**
     * Shutdown cleanup
     */
    public shutdown(): void {
        // Clear all timers
        for (const timer of this.activityTimers.values()) {
            clearTimeout(timer);
        }
        this.activityTimers.clear();

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Clear all state
        this.canvasObjects.clear();
        this.canvasCursors.clear();
        this.canvasPresence.clear();
        this.canvasActivity.clear();
        this.clientToCanvas.clear();
        this.userToCanvases.clear();
        this.cursorActivityThrottles.clear();

        console.log('🛑 Canvas State Isolation Service shut down');
    }
}
