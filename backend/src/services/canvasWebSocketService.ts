/**
 * Canvas WebSocket Service
 * 
 * Bridge service that connects the permission system with the WebSocket namespace manager
 * to provide real-time permission change notifications and cross-canvas communication.
 */

import { CanvasNamespaceManager } from '../websocket/canvasNamespaceManager';
import { PermissionService } from './permissionService';
import { ShareableLinkService } from './shareableLinkService';
import { 
    PermissionRole,
    PermissionChangeLog,
    AuditEventType 
} from '../../../shared/types';

export interface WebSocketPermissionNotification {
    type: 'permission_granted' | 'permission_updated' | 'permission_revoked' | 'ownership_transferred';
    canvasId: string;
    targetUserId: string;
    changedBy: string;
    oldRole?: PermissionRole;
    newRole?: PermissionRole;
    timestamp: number;
    reason?: string;
}

export interface WebSocketCanvasNotification {
    type: 'canvas_shared' | 'canvas_invitation' | 'canvas_deleted' | 'canvas_privacy_changed';
    sourceCanvasId: string;
    targetCanvasIds?: string[];
    userId: string;
    data: any;
    timestamp: number;
}

/**
 * Canvas WebSocket Service - Singleton
 */
export class CanvasWebSocketService {
    private static instance: CanvasWebSocketService;

    private canvasNamespaceManager: CanvasNamespaceManager;
    private permissionService: PermissionService;
    private shareableLinkService: ShareableLinkService;

    private constructor() {
        this.canvasNamespaceManager = CanvasNamespaceManager.getInstance();
        this.permissionService = PermissionService.getInstance();
        this.shareableLinkService = ShareableLinkService.getInstance();
    }

    public static getInstance(): CanvasWebSocketService {
        if (!CanvasWebSocketService.instance) {
            CanvasWebSocketService.instance = new CanvasWebSocketService();
        }
        return CanvasWebSocketService.instance;
    }

    /**
     * Notify about permission changes in real-time
     */
    public async notifyPermissionChange(notification: WebSocketPermissionNotification): Promise<void> {
        try {
            await this.canvasNamespaceManager.handlePermissionChange({
                type: notification.type,
                canvasId: notification.canvasId,
                targetUserId: notification.targetUserId,
                changedBy: notification.changedBy,
                oldRole: notification.oldRole,
                newRole: notification.newRole,
                timestamp: notification.timestamp
            });

            console.log(`📡 Sent real-time permission change notification: ${notification.type} for canvas ${notification.canvasId}`);

        } catch (error) {
            console.error('Error sending permission change notification:', error);
        }
    }

    /**
     * Send cross-canvas notifications
     */
    public async sendCrossCanvasNotification(notification: WebSocketCanvasNotification): Promise<void> {
        try {
            await this.canvasNamespaceManager.sendCrossCanvasNotification({
                type: notification.type,
                sourceCanvasId: notification.sourceCanvasId,
                targetCanvasIds: notification.targetCanvasIds,
                userId: notification.userId,
                data: notification.data,
                timestamp: notification.timestamp
            });

            console.log(`📡 Sent cross-canvas notification: ${notification.type} from canvas ${notification.sourceCanvasId}`);

        } catch (error) {
            console.error('Error sending cross-canvas notification:', error);
        }
    }

    /**
     * Notify about canvas sharing via email invitation
     */
    public async notifyCanvasShared(
        canvasId: string,
        inviterUserId: string,
        inviteeEmail: string,
        role: PermissionRole,
        message?: string
    ): Promise<void> {
        const notification: WebSocketCanvasNotification = {
            type: 'canvas_invitation',
            sourceCanvasId: canvasId,
            userId: inviterUserId,
            data: {
                inviteeEmail,
                role,
                message,
                invitedAt: Date.now()
            },
            timestamp: Date.now()
        };

        await this.sendCrossCanvasNotification(notification);
    }

    /**
     * Notify about canvas privacy changes
     */
    public async notifyCanvasPrivacyChanged(
        canvasId: string,
        userId: string,
        oldPrivacy: string,
        newPrivacy: string
    ): Promise<void> {
        const notification: WebSocketCanvasNotification = {
            type: 'canvas_privacy_changed',
            sourceCanvasId: canvasId,
            userId,
            data: {
                oldPrivacy,
                newPrivacy,
                changedAt: Date.now()
            },
            timestamp: Date.now()
        };

        await this.sendCrossCanvasNotification(notification);
    }

    /**
     * Notify about canvas deletion
     */
    public async notifyCanvasDeleted(
        canvasId: string,
        userId: string,
        canvasName: string
    ): Promise<void> {
        const notification: WebSocketCanvasNotification = {
            type: 'canvas_deleted',
            sourceCanvasId: canvasId,
            userId,
            data: {
                canvasName,
                deletedAt: Date.now()
            },
            timestamp: Date.now()
        };

        await this.sendCrossCanvasNotification(notification);
    }

    /**
     * Get canvas room statistics
     */
    public getCanvasRoomStats(canvasId: string): {
        memberCount: number;
        activeMembers: number;
        roles: Record<PermissionRole, number>;
        lastActivity: number;
    } | null {
        return this.canvasNamespaceManager.getCanvasRoomStats(canvasId);
    }

    /**
     * Get all active canvas rooms
     */
    public getActiveCanvasRooms(): Array<{
        canvasId: string;
        memberCount: number;
        canvasName?: string;
        lastActivity: number;
    }> {
        return this.canvasNamespaceManager.getActiveCanvasRooms();
    }

    /**
     * Force user to leave canvas room (for permission revocation)
     */
    public async forceLeaveCanvasRoom(userId: string, canvasId: string): Promise<void> {
        // This would need a user-to-client mapping to work properly
        // For now, we rely on the permission change notification to handle this
        console.log(`Force leave requested for user ${userId} from canvas ${canvasId}`);
    }

    /**
     * Update canvas list for all users when canvas is created/updated/deleted
     */
    public async updateCanvasListForUsers(
        canvasId: string,
        type: 'canvas_added' | 'canvas_removed' | 'canvas_updated' | 'permission_changed',
        canvasInfo?: {
            name: string;
            privacy: 'private' | 'public' | 'unlisted';
            role?: PermissionRole;
        }
    ): Promise<void> {
        // This would broadcast to all users who have permission to see the canvas
        // Implementation would depend on having user presence tracking across all canvases
        console.log(`Canvas list update: ${type} for canvas ${canvasId}`);
    }

    /**
     * Integration method for permission service callbacks
     */
    public setupPermissionChangeCallbacks(): void {
        // These would be called by the permission service when permissions change
        // For now, we'll implement direct calls from the permission API endpoints
        console.log('🔗 Canvas WebSocket Service permission callbacks ready');
    }

    /**
     * Integration method for shareable link access
     */
    public async notifyShareableLinkAccess(
        linkId: string,
        canvasId: string,
        accessorInfo: {
            userId?: string;
            email?: string;
            ipAddress?: string;
        }
    ): Promise<void> {
        // Notify canvas room members about new access via shareable link
        const notification: WebSocketCanvasNotification = {
            type: 'canvas_shared',
            sourceCanvasId: canvasId,
            userId: 'system',
            data: {
                linkId,
                accessorInfo,
                accessedAt: Date.now()
            },
            timestamp: Date.now()
        };

        await this.sendCrossCanvasNotification(notification);
    }

    /**
     * Shutdown cleanup
     */
    public shutdown(): void {
        console.log('🛑 Canvas WebSocket Service shutting down');
        // Clean up any resources if needed
    }
}
