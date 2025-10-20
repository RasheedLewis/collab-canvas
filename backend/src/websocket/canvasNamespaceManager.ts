/**
 * Canvas Namespace Manager
 * 
 * Manages canvas-specific WebSocket namespaces/rooms for multi-canvas support.
 * Handles permission-based room access, presence tracking, and cross-canvas notifications.
 */

import { PermissionService } from '../services/permissionService';
import { firestoreService } from '../database/firestoreService';
import { AuditLogService } from '../services/auditLogService';
import { PermissionRole } from '../../../shared/types';

export interface CanvasRoomMember {
    clientId: string;
    userId: string;
    displayName: string;
    avatarColor?: string;
    role: PermissionRole;
    joinedAt: number;
    lastActivity: number;
    cursor?: {
        x: number;
        y: number;
        visible: boolean;
    };
    status: 'active' | 'idle' | 'away';
}

export interface CanvasRoom {
    canvasId: string;
    members: Map<string, CanvasRoomMember>;
    createdAt: number;
    lastActivity: number;
    isActive: boolean;
    canvasInfo?: {
        name: string;
        ownerId: string;
        privacy: 'private' | 'public' | 'unlisted';
    };
}

export interface PermissionChangeNotification {
    type: 'permission_granted' | 'permission_updated' | 'permission_revoked' | 'ownership_transferred';
    canvasId: string;
    targetUserId: string;
    changedBy: string;
    oldRole?: PermissionRole;
    newRole?: PermissionRole;
    timestamp: number;
}

export interface CrossCanvasNotification {
    type: 'canvas_shared' | 'canvas_invitation' | 'canvas_deleted' | 'canvas_privacy_changed';
    sourceCanvasId: string;
    targetCanvasIds?: string[];
    userId: string;
    data: any;
    timestamp: number;
}

/**
 * Canvas Namespace Manager - Singleton
 */
export class CanvasNamespaceManager {
    private static instance: CanvasNamespaceManager;

    // Canvas room management
    private canvasRooms: Map<string, CanvasRoom> = new Map();
    private clientToCanvas: Map<string, Set<string>> = new Map(); // clientId -> Set of canvasIds
    private userToClient: Map<string, string> = new Map(); // userId -> clientId
    
    // Permission and presence tracking
    private presenceUpdateInterval: NodeJS.Timeout | null = null;
    private roomCleanupInterval: NodeJS.Timeout | null = null;

    // External dependencies
    private permissionService: PermissionService;
    private auditService: AuditLogService;

    // Callbacks for WebSocket communication
    private sendToClient?: (clientId: string, message: any) => void;
    private broadcastToRoom?: (roomId: string, message: any, excludeClientId?: string) => void;

    private constructor() {
        this.permissionService = PermissionService.getInstance();
        this.auditService = AuditLogService.getInstance();
        this.initializeCleanupTasks();
    }

    public static getInstance(): CanvasNamespaceManager {
        if (!CanvasNamespaceManager.instance) {
            CanvasNamespaceManager.instance = new CanvasNamespaceManager();
        }
        return CanvasNamespaceManager.instance;
    }

    /**
     * Initialize communication callbacks
     */
    public initializeCallbacks(
        sendToClient: (clientId: string, message: any) => void,
        broadcastToRoom: (roomId: string, message: any, excludeClientId?: string) => void
    ): void {
        this.sendToClient = sendToClient;
        this.broadcastToRoom = broadcastToRoom;
    }

    /**
     * Join a canvas room with permission validation
     */
    public async joinCanvasRoom(
        clientId: string,
        userId: string,
        canvasId: string,
        userInfo: {
            displayName: string;
            avatarColor?: string;
        }
    ): Promise<{ success: boolean; error?: string; role?: PermissionRole }> {
        try {
            // Validate canvas permission
            const permissionResult = await this.permissionService.validatePermission(
                canvasId,
                userId,
                'view'
            );

            if (!permissionResult.success || !permissionResult.data?.hasPermission) {
                // Log unauthorized access attempt
                await this.auditService.logCanvasAccess({
                    userId,
                    canvasId,
                    action: 'Attempted to join canvas room without permission',
                    granted: false,
                    timestamp: Date.now()
                });

                return {
                    success: false,
                    error: 'Permission denied. You do not have access to this canvas.'
                };
            }

            const userPermission = permissionResult.data!;
            const role = userPermission.role!;

            // Get canvas information
            const canvasResult = await firestoreService.getCanvas(canvasId);
            let canvasInfo = undefined;
            if (canvasResult.success) {
                const canvas = canvasResult.data!;
                canvasInfo = {
                    name: canvas.name,
                    ownerId: canvas.ownerId,
                    privacy: canvas.privacy
                };
            }

            // Create or get canvas room
            if (!this.canvasRooms.has(canvasId)) {
                this.canvasRooms.set(canvasId, {
                    canvasId,
                    members: new Map(),
                    createdAt: Date.now(),
                    lastActivity: Date.now(),
                    isActive: true,
                    canvasInfo
                });
            }

            const room = this.canvasRooms.get(canvasId)!;
            room.lastActivity = Date.now();
            room.canvasInfo = canvasInfo; // Update canvas info

            // Remove user from previous canvas rooms
            await this.leaveAllCanvasRooms(clientId);

            // Add member to room
            const member: CanvasRoomMember = {
                clientId,
                userId,
                displayName: userInfo.displayName,
                avatarColor: userInfo.avatarColor,
                role,
                joinedAt: Date.now(),
                lastActivity: Date.now(),
                status: 'active'
            };

            room.members.set(clientId, member);

            // Update client to canvas mapping
            if (!this.clientToCanvas.has(clientId)) {
                this.clientToCanvas.set(clientId, new Set());
            }
            this.clientToCanvas.get(clientId)!.add(canvasId);
            this.userToClient.set(userId, clientId);

            // Send room joined confirmation to client
            if (this.sendToClient) {
                this.sendToClient(clientId, {
                    type: 'canvas_room_joined',
                    payload: {
                        canvasId,
                        role,
                        canvasInfo,
                        members: this.getRoomMembersForClient(canvasId, clientId),
                        memberCount: room.members.size
                    },
                    timestamp: Date.now()
                });
            }

            // Notify other room members
            if (this.broadcastToRoom) {
                this.broadcastToRoom(canvasId, {
                    type: 'canvas_user_joined',
                    payload: {
                        canvasId,
                        member: {
                            clientId,
                            userId,
                            displayName: userInfo.displayName,
                            avatarColor: userInfo.avatarColor,
                            role,
                            joinedAt: member.joinedAt
                        },
                        memberCount: room.members.size
                    },
                    timestamp: Date.now()
                }, clientId);
            }

            // Log successful canvas access
            await this.auditService.logCanvasAccess({
                userId,
                canvasId,
                action: 'Joined canvas room',
                role,
                granted: true,
                timestamp: Date.now()
            });

            console.log(`🎨 User ${userId} (${clientId}) joined canvas room ${canvasId} as ${role}`);

            return { success: true, role };

        } catch (error) {
            console.error('Error joining canvas room:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    }

    /**
     * Leave a canvas room
     */
    public async leaveCanvasRoom(clientId: string, canvasId: string): Promise<void> {
        const room = this.canvasRooms.get(canvasId);
        if (!room || !room.members.has(clientId)) {
            return;
        }

        const member = room.members.get(clientId)!;
        room.members.delete(clientId);

        // Update client mappings
        const clientCanvases = this.clientToCanvas.get(clientId);
        if (clientCanvases) {
            clientCanvases.delete(canvasId);
            if (clientCanvases.size === 0) {
                this.clientToCanvas.delete(clientId);
            }
        }

        if (this.userToClient.get(member.userId) === clientId) {
            this.userToClient.delete(member.userId);
        }

        // Notify remaining room members
        if (this.broadcastToRoom && room.members.size > 0) {
            this.broadcastToRoom(canvasId, {
                type: 'canvas_user_left',
                payload: {
                    canvasId,
                    userId: member.userId,
                    clientId,
                    memberCount: room.members.size
                },
                timestamp: Date.now()
            }, clientId);
        }

        // Clean up empty room after delay
        if (room.members.size === 0) {
            setTimeout(() => {
                const currentRoom = this.canvasRooms.get(canvasId);
                if (currentRoom && currentRoom.members.size === 0) {
                    this.canvasRooms.delete(canvasId);
                    console.log(`🧹 Cleaned up empty canvas room: ${canvasId}`);
                }
            }, 30000); // 30 second delay
        }

        console.log(`🚪 User ${member.userId} (${clientId}) left canvas room ${canvasId}`);
    }

    /**
     * Leave all canvas rooms for a client
     */
    public async leaveAllCanvasRooms(clientId: string): Promise<void> {
        const clientCanvases = this.clientToCanvas.get(clientId);
        if (!clientCanvases) return;

        const canvasIds = Array.from(clientCanvases);
        for (const canvasId of canvasIds) {
            await this.leaveCanvasRoom(clientId, canvasId);
        }
    }

    /**
     * Handle real-time permission changes
     */
    public async handlePermissionChange(notification: PermissionChangeNotification): Promise<void> {
        const { canvasId, targetUserId, type, oldRole, newRole } = notification;

        // Find the affected user's client
        const clientId = this.userToClient.get(targetUserId);
        
        if (clientId) {
            // Update member role in room
            const room = this.canvasRooms.get(canvasId);
            if (room && room.members.has(clientId)) {
                const member = room.members.get(clientId)!;
                
                if (type === 'permission_revoked') {
                    // Force user to leave the room
                    await this.leaveCanvasRoom(clientId, canvasId);
                    
                    if (this.sendToClient) {
                        this.sendToClient(clientId, {
                            type: 'canvas_permission_revoked',
                            payload: {
                                canvasId,
                                reason: 'Your permissions have been revoked',
                                redirectTo: '/dashboard'
                            },
                            timestamp: Date.now()
                        });
                    }
                } else if (newRole) {
                    // Update role
                    member.role = newRole;
                    
                    if (this.sendToClient) {
                        this.sendToClient(clientId, {
                            type: 'canvas_permission_updated',
                            payload: {
                                canvasId,
                                oldRole,
                                newRole,
                                message: `Your role has been updated to ${newRole}`
                            },
                            timestamp: Date.now()
                        });
                    }

                    // Notify other room members of role change
                    if (this.broadcastToRoom) {
                        this.broadcastToRoom(canvasId, {
                            type: 'canvas_member_role_updated',
                            payload: {
                                canvasId,
                                userId: targetUserId,
                                oldRole,
                                newRole
                            },
                            timestamp: Date.now()
                        }, clientId);
                    }
                }
            }
        }

        // Broadcast to all room members (for awareness)
        if (this.broadcastToRoom) {
            this.broadcastToRoom(canvasId, {
                type: 'canvas_permission_changed',
                payload: notification,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Send cross-canvas notifications
     */
    public async sendCrossCanvasNotification(notification: CrossCanvasNotification): Promise<void> {
        const { type, sourceCanvasId, targetCanvasIds, userId, data } = notification;

        // If no specific target canvases, broadcast to all user's active canvases
        let canvasesToNotify: string[] = [];
        
        if (targetCanvasIds && targetCanvasIds.length > 0) {
            canvasesToNotify = targetCanvasIds;
        } else {
            // Find all canvases where the user has active presence
            const clientId = this.userToClient.get(userId);
            if (clientId) {
                const clientCanvases = this.clientToCanvas.get(clientId);
                if (clientCanvases) {
                    canvasesToNotify = Array.from(clientCanvases);
                }
            }
        }

        // Send notification to each target canvas
        for (const canvasId of canvasesToNotify) {
            if (canvasId === sourceCanvasId) continue; // Skip source canvas

            if (this.broadcastToRoom) {
                this.broadcastToRoom(canvasId, {
                    type: 'cross_canvas_notification',
                    payload: {
                        notificationType: type,
                        sourceCanvasId,
                        userId,
                        data,
                        timestamp: notification.timestamp
                    },
                    timestamp: Date.now()
                });
            }
        }
    }

    /**
     * Update user presence/cursor in canvas room
     */
    public updateUserPresence(
        clientId: string,
        canvasId: string,
        presence: {
            cursor?: { x: number; y: number; visible: boolean };
            status?: 'active' | 'idle' | 'away';
        }
    ): void {
        const room = this.canvasRooms.get(canvasId);
        if (!room || !room.members.has(clientId)) {
            return;
        }

        const member = room.members.get(clientId)!;
        member.lastActivity = Date.now();
        
        if (presence.cursor) {
            member.cursor = presence.cursor;
        }
        
        if (presence.status) {
            member.status = presence.status;
        }

        // Broadcast presence update to other room members
        if (this.broadcastToRoom) {
            this.broadcastToRoom(canvasId, {
                type: 'canvas_presence_updated',
                payload: {
                    canvasId,
                    userId: member.userId,
                    clientId,
                    cursor: member.cursor,
                    status: member.status
                },
                timestamp: Date.now()
            }, clientId);
        }
    }

    /**
     * Get room members for a client (excluding sensitive info)
     */
    private getRoomMembersForClient(canvasId: string, excludeClientId?: string): any[] {
        const room = this.canvasRooms.get(canvasId);
        if (!room) return [];

        return Array.from(room.members.values())
            .filter(member => member.clientId !== excludeClientId)
            .map(member => ({
                userId: member.userId,
                displayName: member.displayName,
                avatarColor: member.avatarColor,
                role: member.role,
                status: member.status,
                cursor: member.cursor,
                joinedAt: member.joinedAt
            }));
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
        const room = this.canvasRooms.get(canvasId);
        if (!room) return null;

        const roles: Record<PermissionRole, number> = {
            owner: 0,
            editor: 0,
            viewer: 0
        };

        let activeMembers = 0;
        const now = Date.now();

        for (const member of room.members.values()) {
            roles[member.role]++;
            if (member.status === 'active' && (now - member.lastActivity) < 60000) {
                activeMembers++;
            }
        }

        return {
            memberCount: room.members.size,
            activeMembers,
            roles,
            lastActivity: room.lastActivity
        };
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
        return Array.from(this.canvasRooms.values()).map(room => ({
            canvasId: room.canvasId,
            memberCount: room.members.size,
            canvasName: room.canvasInfo?.name,
            lastActivity: room.lastActivity
        }));
    }

    /**
     * Initialize cleanup tasks
     */
    private initializeCleanupTasks(): void {
        // Update presence status based on activity
        this.presenceUpdateInterval = setInterval(() => {
            const now = Date.now();
            
            for (const room of this.canvasRooms.values()) {
                for (const member of room.members.values()) {
                    const inactiveTime = now - member.lastActivity;
                    
                    let newStatus: 'active' | 'idle' | 'away' = 'active';
                    if (inactiveTime > 5 * 60 * 1000) { // 5 minutes
                        newStatus = 'away';
                    } else if (inactiveTime > 2 * 60 * 1000) { // 2 minutes
                        newStatus = 'idle';
                    }

                    if (member.status !== newStatus) {
                        member.status = newStatus;
                        
                        // Broadcast status change
                        if (this.broadcastToRoom) {
                            this.broadcastToRoom(room.canvasId, {
                                type: 'canvas_presence_updated',
                                payload: {
                                    canvasId: room.canvasId,
                                    userId: member.userId,
                                    clientId: member.clientId,
                                    status: newStatus
                                },
                                timestamp: Date.now()
                            }, member.clientId);
                        }
                    }
                }
            }
        }, 30000); // Check every 30 seconds

        // Clean up inactive rooms
        this.roomCleanupInterval = setInterval(() => {
            const now = Date.now();
            const roomsToDelete: string[] = [];

            for (const [canvasId, room] of this.canvasRooms.entries()) {
                // Remove rooms with no members that have been inactive for 10 minutes
                if (room.members.size === 0 && (now - room.lastActivity) > 10 * 60 * 1000) {
                    roomsToDelete.push(canvasId);
                }
            }

            for (const canvasId of roomsToDelete) {
                this.canvasRooms.delete(canvasId);
                console.log(`🧹 Cleaned up inactive canvas room: ${canvasId}`);
            }
        }, 5 * 60 * 1000); // Check every 5 minutes
    }

    /**
     * Shutdown cleanup
     */
    public shutdown(): void {
        if (this.presenceUpdateInterval) {
            clearInterval(this.presenceUpdateInterval);
        }
        if (this.roomCleanupInterval) {
            clearInterval(this.roomCleanupInterval);
        }
        
        this.canvasRooms.clear();
        this.clientToCanvas.clear();
        this.userToClient.clear();
    }
}
