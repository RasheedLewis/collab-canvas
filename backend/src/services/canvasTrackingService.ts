/**
 * Canvas Tracking Service
 * 
 * Tracks user interactions with canvases including recent access,
 * favorite status, and usage analytics for personalized experiences.
 */

import { firestoreService } from '../database/firestoreService';

export interface RecentCanvasAccess {
    canvasId: string;
    userId: string;
    accessType: 'view' | 'edit' | 'share';
    timestamp: number;
    duration?: number; // Time spent on canvas in seconds
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    ipAddress?: string;
}

export interface UserCanvasPreferences {
    userId: string;
    favoriteCanvases: string[];
    recentCanvases: Array<{
        canvasId: string;
        lastAccessed: number;
        accessCount: number;
    }>;
    frequentTags: Array<{
        tag: string;
        count: number;
    }>;
    collaboratedWith: string[]; // User IDs of frequent collaborators
    preferences: {
        defaultPrivacy?: 'private' | 'public' | 'unlisted';
        theme?: 'light' | 'dark';
        notifications?: boolean;
    };
}

export interface CanvasUsageStats {
    canvasId: string;
    totalViews: number;
    uniqueViewers: number;
    totalEdits: number;
    uniqueEditors: number;
    averageSessionDuration: number;
    lastActivity: number;
    topCollaborators: Array<{
        userId: string;
        editCount: number;
        lastEdit: number;
    }>;
}

/**
 * Canvas Tracking Service - Singleton
 */
export class CanvasTrackingService {
    private static instance: CanvasTrackingService;

    // In-memory caches for frequently accessed data
    private recentAccessCache: Map<string, RecentCanvasAccess[]> = new Map();
    private userPreferencesCache: Map<string, UserCanvasPreferences> = new Map();
    private cacheTimeout = 5 * 60 * 1000; // 5 minutes

    private constructor() { }

    public static getInstance(): CanvasTrackingService {
        if (!CanvasTrackingService.instance) {
            CanvasTrackingService.instance = new CanvasTrackingService();
        }
        return CanvasTrackingService.instance;
    }

    /**
     * Track canvas access by a user
     */
    public async trackCanvasAccess(access: RecentCanvasAccess): Promise<void> {
        try {
            // Store in Firestore (in production, might use a separate analytics DB)
            await firestoreService.addAuditLog({
                id: `access_${access.canvasId}_${access.userId}_${Date.now()}`,
                eventType: 'canvas_accessed',
                canvasId: access.canvasId,
                userId: access.userId,
                details: {
                    description: `Canvas accessed: ${access.accessType}`,
                    metadata: {
                        accessType: access.accessType,
                        duration: access.duration,
                        deviceType: access.deviceType
                    },
                    riskLevel: 'low'
                },
                timestamp: access.timestamp,
                ipAddress: access.ipAddress
            });

            // Update user's recent canvas list
            await this.updateUserRecentCanvases(access.userId, access.canvasId);

            // Update canvas last accessed time
            await firestoreService.updateCanvas(access.canvasId, {
                lastAccessedAt: access.timestamp
            }, access.userId);

            // Clear relevant caches
            this.clearUserCache(access.userId);

        } catch (error) {
            console.error('Error tracking canvas access:', error);
            // Don't throw - tracking shouldn't break main functionality
        }
    }

    /**
     * Add canvas to user's favorites
     */
    public async addToFavorites(userId: string, canvasId: string): Promise<boolean> {
        try {
            const preferences = await this.getUserPreferences(userId);

            if (!preferences.favoriteCanvases.includes(canvasId)) {
                preferences.favoriteCanvases.push(canvasId);
                await this.saveUserPreferences(preferences);

                // Update canvas favorite flag
                await firestoreService.updateCanvas(canvasId, {
                    isFavorite: true
                }, userId);

                return true;
            }

            return false; // Already in favorites
        } catch (error) {
            console.error('Error adding to favorites:', error);
            return false;
        }
    }

    /**
     * Remove canvas from user's favorites
     */
    public async removeFromFavorites(userId: string, canvasId: string): Promise<boolean> {
        try {
            const preferences = await this.getUserPreferences(userId);

            const index = preferences.favoriteCanvases.indexOf(canvasId);
            if (index > -1) {
                preferences.favoriteCanvases.splice(index, 1);
                await this.saveUserPreferences(preferences);

                // Update canvas favorite flag
                await firestoreService.updateCanvas(canvasId, {
                    isFavorite: false
                }, userId);

                return true;
            }

            return false; // Not in favorites
        } catch (error) {
            console.error('Error removing from favorites:', error);
            return false;
        }
    }

    /**
     * Get user's recent canvases
     */
    public async getUserRecentCanvases(
        userId: string,
        limit: number = 20
    ): Promise<Array<{ canvasId: string; lastAccessed: number; accessCount: number }>> {
        try {
            const preferences = await this.getUserPreferences(userId);

            return preferences.recentCanvases
                .sort((a, b) => b.lastAccessed - a.lastAccessed)
                .slice(0, limit);

        } catch (error) {
            console.error('Error getting recent canvases:', error);
            return [];
        }
    }

    /**
     * Get user's favorite canvases
     */
    public async getUserFavoriteCanvases(userId: string): Promise<string[]> {
        try {
            const preferences = await this.getUserPreferences(userId);
            return preferences.favoriteCanvases;
        } catch (error) {
            console.error('Error getting favorite canvases:', error);
            return [];
        }
    }

    /**
     * Get user preferences (with caching)
     */
    public async getUserPreferences(userId: string): Promise<UserCanvasPreferences> {
        // Check cache first
        if (this.userPreferencesCache.has(userId)) {
            return this.userPreferencesCache.get(userId)!;
        }

        try {
            // Try to load from Firestore
            // In production, this would be a separate user preferences collection
            const defaultPreferences: UserCanvasPreferences = {
                userId,
                favoriteCanvases: [],
                recentCanvases: [],
                frequentTags: [],
                collaboratedWith: [],
                preferences: {
                    defaultPrivacy: 'private',
                    theme: 'light',
                    notifications: true
                }
            };

            // Cache the preferences
            this.userPreferencesCache.set(userId, defaultPreferences);

            // Set cache expiry
            setTimeout(() => {
                this.userPreferencesCache.delete(userId);
            }, this.cacheTimeout);

            return defaultPreferences;

        } catch (error) {
            console.error('Error getting user preferences:', error);
            // Return default preferences
            return {
                userId,
                favoriteCanvases: [],
                recentCanvases: [],
                frequentTags: [],
                collaboratedWith: [],
                preferences: {}
            };
        }
    }

    /**
     * Save user preferences
     */
    private async saveUserPreferences(preferences: UserCanvasPreferences): Promise<void> {
        try {
            // In production, save to a user preferences collection in Firestore
            // For now, just update the cache
            this.userPreferencesCache.set(preferences.userId, preferences);

            console.log('User preferences updated:', preferences.userId);
        } catch (error) {
            console.error('Error saving user preferences:', error);
        }
    }

    /**
     * Update user's recent canvas list
     */
    private async updateUserRecentCanvases(userId: string, canvasId: string): Promise<void> {
        try {
            const preferences = await this.getUserPreferences(userId);

            // Find existing entry
            const existingIndex = preferences.recentCanvases.findIndex(
                item => item.canvasId === canvasId
            );

            if (existingIndex > -1) {
                // Update existing entry
                preferences.recentCanvases[existingIndex].lastAccessed = Date.now();
                preferences.recentCanvases[existingIndex].accessCount += 1;
            } else {
                // Add new entry
                preferences.recentCanvases.push({
                    canvasId,
                    lastAccessed: Date.now(),
                    accessCount: 1
                });
            }

            // Keep only last 50 recent canvases
            preferences.recentCanvases = preferences.recentCanvases
                .sort((a, b) => b.lastAccessed - a.lastAccessed)
                .slice(0, 50);

            await this.saveUserPreferences(preferences);

        } catch (error) {
            console.error('Error updating recent canvases:', error);
        }
    }

    /**
     * Get canvas usage statistics
     */
    public async getCanvasUsageStats(canvasId: string): Promise<CanvasUsageStats | null> {
        try {
            // In production, this would aggregate from analytics/audit logs
            // For now, return mock data based on canvas info
            const canvasResult = await firestoreService.getCanvas(canvasId);

            if (!canvasResult.success) {
                return null;
            }

            const canvas = canvasResult.data!;

            // Get audit logs for this canvas (simplified version)
            const auditResult = await firestoreService.getAuditLogs({
                canvasId,
                limit: 100
            });

            let totalViews = 0;
            let totalEdits = 0;
            const uniqueViewers = new Set<string>();
            const uniqueEditors = new Set<string>();
            const collaboratorEdits = new Map<string, { count: number; lastEdit: number }>();

            if (auditResult.success) {
                auditResult.data!.forEach(log => {
                    if (log.eventType === 'canvas_accessed') {
                        totalViews++;
                        uniqueViewers.add(log.userId);
                    }

                    if (log.eventType === 'object_created' || log.eventType === 'object_updated') {
                        totalEdits++;
                        uniqueEditors.add(log.userId);

                        const existing = collaboratorEdits.get(log.userId) || { count: 0, lastEdit: 0 };
                        existing.count++;
                        existing.lastEdit = Math.max(existing.lastEdit, log.timestamp);
                        collaboratorEdits.set(log.userId, existing);
                    }
                });
            }

            const topCollaborators = Array.from(collaboratorEdits.entries())
                .map(([userId, stats]) => ({
                    userId,
                    editCount: stats.count,
                    lastEdit: stats.lastEdit
                }))
                .sort((a, b) => b.editCount - a.editCount)
                .slice(0, 10);

            return {
                canvasId,
                totalViews,
                uniqueViewers: uniqueViewers.size,
                totalEdits,
                uniqueEditors: uniqueEditors.size,
                averageSessionDuration: 5 * 60, // Mock: 5 minutes average
                lastActivity: canvas.lastAccessedAt,
                topCollaborators
            };

        } catch (error) {
            console.error('Error getting canvas usage stats:', error);
            return null;
        }
    }

    /**
     * Get trending tags for a user based on their activity
     */
    public async getUserTrendingTags(userId: string, limit: number = 10): Promise<Array<{ tag: string; count: number }>> {
        try {
            const preferences = await this.getUserPreferences(userId);

            // Get user's recent canvases
            const recentCanvasIds = preferences.recentCanvases
                .slice(0, 20)
                .map(item => item.canvasId);

            // Count tags from recent canvases
            const tagCounts = new Map<string, number>();

            for (const canvasId of recentCanvasIds) {
                const canvasResult = await firestoreService.getCanvas(canvasId);
                if (canvasResult.success && canvasResult.data!.tags) {
                    canvasResult.data!.tags.forEach(tag => {
                        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                    });
                }
            }

            return Array.from(tagCounts.entries())
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, limit);

        } catch (error) {
            console.error('Error getting user trending tags:', error);
            return [];
        }
    }

    /**
     * Clear user-specific caches
     */
    private clearUserCache(userId: string): void {
        this.userPreferencesCache.delete(userId);
        this.recentAccessCache.delete(userId);
    }

    /**
     * Clear all caches
     */
    public clearAllCaches(): void {
        this.recentAccessCache.clear();
        this.userPreferencesCache.clear();
    }
}
