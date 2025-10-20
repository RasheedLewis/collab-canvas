/**
 * Permission Cache Service
 * 
 * Provides high-performance caching for canvas permissions to reduce database queries
 * and improve response times for permission checks.
 */

import { CanvasPermission as CanvasPermissionType, PermissionRole } from '../../../shared/types';

// Cache configuration
const CACHE_CONFIG = {
    defaultTTL: 15 * 60 * 1000, // 15 minutes
    maxCacheSize: 10000, // Maximum number of cached entries
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    hitRatioWindow: 100, // Track hit ratio over last 100 requests
} as const;

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
    createdAt: number;
    accessCount: number;
    lastAccessed: number;
}

interface CacheStats {
    size: number;
    hits: number;
    misses: number;
    hitRatio: number;
    evictions: number;
    oldestEntry?: number;
    newestEntry?: number;
}

/**
 * High-performance permission caching service
 */
export class PermissionCacheService {
    private static instance: PermissionCacheService;

    // Permission cache: "userId:canvasId" -> CanvasPermissionType
    private permissionCache = new Map<string, CacheEntry<CanvasPermissionType>>();

    // Canvas permissions cache: canvasId -> userId[]
    private canvasUsersCache = new Map<string, CacheEntry<string[]>>();

    // User canvases cache: userId -> canvasId[]
    private userCanvasesCache = new Map<string, CacheEntry<string[]>>();

    // Cache statistics
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        recentHits: [] as boolean[] // Track recent hit/miss for hit ratio
    };

    private cleanupTimer?: NodeJS.Timeout;

    private constructor() {
        this.startCleanupTimer();
    }

    static getInstance(): PermissionCacheService {
        if (!PermissionCacheService.instance) {
            PermissionCacheService.instance = new PermissionCacheService();
        }
        return PermissionCacheService.instance;
    }

    // ========================================
    // Permission Caching
    // ========================================

    /**
     * Cache a user's permission for a canvas
     */
    async cacheUserCanvasPermission(
        userId: string,
        canvasId: string,
        permission: CanvasPermissionType,
        ttl: number = CACHE_CONFIG.defaultTTL
    ): Promise<void> {
        const key = this.getUserCanvasKey(userId, canvasId);

        const entry: CacheEntry<CanvasPermissionType> = {
            data: permission,
            expiresAt: Date.now() + ttl,
            createdAt: Date.now(),
            accessCount: 0,
            lastAccessed: Date.now()
        };

        this.permissionCache.set(key, entry);

        // Update related caches
        await this.updateCanvasUsersCache(canvasId, userId);
        await this.updateUserCanvasesCache(userId, canvasId);

        // Enforce cache size limits
        this.enforeCacheSizeLimit();
    }

    /**
     * Get cached permission for user and canvas
     */
    async getUserCanvasPermission(
        userId: string,
        canvasId: string
    ): Promise<CanvasPermissionType | null> {
        const key = this.getUserCanvasKey(userId, canvasId);
        const entry = this.permissionCache.get(key);

        if (!entry) {
            this.recordCacheMiss();
            return null;
        }

        // Check expiration
        if (entry.expiresAt < Date.now()) {
            this.permissionCache.delete(key);
            this.recordCacheMiss();
            return null;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = Date.now();

        this.recordCacheHit();
        return entry.data;
    }

    /**
     * Check if user has cached permission for canvas
     */
    async hasUserCanvasPermission(userId: string, canvasId: string): Promise<boolean> {
        const permission = await this.getUserCanvasPermission(userId, canvasId);
        return permission !== null;
    }

    /**
     * Get user's role for canvas from cache
     */
    async getUserCanvasRole(userId: string, canvasId: string): Promise<PermissionRole | null> {
        const permission = await this.getUserCanvasPermission(userId, canvasId);
        return permission?.role || null;
    }

    /**
     * Remove cached permission
     */
    async removeUserCanvasPermission(userId: string, canvasId: string): Promise<void> {
        const key = this.getUserCanvasKey(userId, canvasId);
        this.permissionCache.delete(key);
    }

    // ========================================
    // Bulk Operations
    // ========================================

    /**
     * Cache multiple permissions at once
     */
    async cacheMultiplePermissions(
        permissions: Array<{
            userId: string;
            canvasId: string;
            permission: CanvasPermissionType;
            ttl?: number;
        }>
    ): Promise<void> {
        for (const { userId, canvasId, permission, ttl } of permissions) {
            await this.cacheUserCanvasPermission(userId, canvasId, permission, ttl);
        }
    }

    /**
     * Get all cached permissions for a canvas
     */
    async getCanvasPermissions(canvasId: string): Promise<Array<{
        userId: string;
        permission: CanvasPermissionType;
    }>> {
        const users = await this.getCanvasUsers(canvasId);
        const permissions: Array<{ userId: string; permission: CanvasPermissionType }> = [];

        for (const userId of users) {
            const permission = await this.getUserCanvasPermission(userId, canvasId);
            if (permission) {
                permissions.push({ userId, permission });
            }
        }

        return permissions;
    }

    /**
     * Get all cached canvases for a user
     */
    async getUserCanvases(userId: string): Promise<string[]> {
        const key = `user_canvases:${userId}`;
        const entry = this.userCanvasesCache.get(key);

        if (!entry || entry.expiresAt < Date.now()) {
            return [];
        }

        entry.accessCount++;
        entry.lastAccessed = Date.now();

        return entry.data;
    }

    // ========================================
    // Cache Invalidation
    // ========================================

    /**
     * Invalidate all permissions for a canvas
     */
    async invalidateCanvasPermissions(canvasId: string): Promise<void> {
        const users = await this.getCanvasUsers(canvasId);

        for (const userId of users) {
            const key = this.getUserCanvasKey(userId, canvasId);
            this.permissionCache.delete(key);
        }

        // Remove from canvas users cache
        this.canvasUsersCache.delete(`canvas_users:${canvasId}`);

        // Remove from user canvases caches
        for (const userId of users) {
            this.userCanvasesCache.delete(`user_canvases:${userId}`);
        }
    }

    /**
     * Invalidate all permissions for a user
     */
    async invalidateUserPermissions(userId: string): Promise<void> {
        const canvases = await this.getUserCanvases(userId);

        for (const canvasId of canvases) {
            const key = this.getUserCanvasKey(userId, canvasId);
            this.permissionCache.delete(key);
        }

        // Remove from user canvases cache
        this.userCanvasesCache.delete(`user_canvases:${userId}`);
    }

    /**
     * Clear all cached data
     */
    async clearAllCaches(): Promise<void> {
        this.permissionCache.clear();
        this.canvasUsersCache.clear();
        this.userCanvasesCache.clear();
        this.resetStats();
    }

    // ========================================
    // Cache Statistics and Monitoring
    // ========================================

    /**
     * Get cache statistics
     */
    getCacheStats(): CacheStats {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRatio = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

        const entries = Array.from(this.permissionCache.values());
        const timestamps = entries.map(e => e.createdAt);

        return {
            size: this.permissionCache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRatio: Math.round(hitRatio * 100) / 100,
            evictions: this.stats.evictions,
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined
        };
    }

    /**
     * Get detailed cache performance metrics
     */
    getPerformanceMetrics(): {
        stats: CacheStats;
        recentHitRatio: number;
        averageAccessCount: number;
        cacheEfficiency: number;
        memoryUsage: number;
    } {
        const stats = this.getCacheStats();

        // Calculate recent hit ratio from last N requests
        const recentHits = this.stats.recentHits.filter(hit => hit).length;
        const recentTotal = this.stats.recentHits.length;
        const recentHitRatio = recentTotal > 0 ? recentHits / recentTotal : 0;

        // Calculate average access count
        const entries = Array.from(this.permissionCache.values());
        const totalAccessCount = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
        const averageAccessCount = entries.length > 0 ? totalAccessCount / entries.length : 0;

        // Calculate cache efficiency (hit ratio weighted by access count)
        const cacheEfficiency = averageAccessCount * stats.hitRatio;

        // Estimate memory usage (rough calculation)
        const memoryUsage = this.permissionCache.size * 1000 + // ~1KB per permission entry
            this.canvasUsersCache.size * 500 + // ~500B per canvas users entry
            this.userCanvasesCache.size * 500; // ~500B per user canvases entry

        return {
            stats,
            recentHitRatio: Math.round(recentHitRatio * 100) / 100,
            averageAccessCount: Math.round(averageAccessCount * 100) / 100,
            cacheEfficiency: Math.round(cacheEfficiency * 100) / 100,
            memoryUsage
        };
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    private getUserCanvasKey(userId: string, canvasId: string): string {
        return `${userId}:${canvasId}`;
    }

    private async getCanvasUsers(canvasId: string): Promise<string[]> {
        const key = `canvas_users:${canvasId}`;
        const entry = this.canvasUsersCache.get(key);

        if (!entry || entry.expiresAt < Date.now()) {
            return [];
        }

        return entry.data;
    }

    private async updateCanvasUsersCache(canvasId: string, userId: string): Promise<void> {
        const key = `canvas_users:${canvasId}`;
        const entry = this.canvasUsersCache.get(key);

        let users: string[];
        if (entry && entry.expiresAt > Date.now()) {
            users = entry.data;
            if (!users.includes(userId)) {
                users.push(userId);
            }
        } else {
            users = [userId];
        }

        this.canvasUsersCache.set(key, {
            data: users,
            expiresAt: Date.now() + CACHE_CONFIG.defaultTTL,
            createdAt: Date.now(),
            accessCount: 0,
            lastAccessed: Date.now()
        });
    }

    private async updateUserCanvasesCache(userId: string, canvasId: string): Promise<void> {
        const key = `user_canvases:${userId}`;
        const entry = this.userCanvasesCache.get(key);

        let canvases: string[];
        if (entry && entry.expiresAt > Date.now()) {
            canvases = entry.data;
            if (!canvases.includes(canvasId)) {
                canvases.push(canvasId);
            }
        } else {
            canvases = [canvasId];
        }

        this.userCanvasesCache.set(key, {
            data: canvases,
            expiresAt: Date.now() + CACHE_CONFIG.defaultTTL,
            createdAt: Date.now(),
            accessCount: 0,
            lastAccessed: Date.now()
        });
    }

    private recordCacheHit(): void {
        this.stats.hits++;
        this.updateRecentHits(true);
    }

    private recordCacheMiss(): void {
        this.stats.misses++;
        this.updateRecentHits(false);
    }

    private updateRecentHits(hit: boolean): void {
        this.stats.recentHits.push(hit);
        if (this.stats.recentHits.length > CACHE_CONFIG.hitRatioWindow) {
            this.stats.recentHits.shift();
        }
    }

    private enforeCacheSizeLimit(): void {
        if (this.permissionCache.size <= CACHE_CONFIG.maxCacheSize) {
            return;
        }

        // Remove oldest entries (LRU eviction)
        const entries = Array.from(this.permissionCache.entries());
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

        const toRemove = entries.slice(0, this.permissionCache.size - CACHE_CONFIG.maxCacheSize);

        for (const [key] of toRemove) {
            this.permissionCache.delete(key);
            this.stats.evictions++;
        }
    }

    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredEntries();
        }, CACHE_CONFIG.cleanupInterval);
    }

    private cleanupExpiredEntries(): void {
        const now = Date.now();

        // Clean up permission cache
        for (const [key, entry] of this.permissionCache.entries()) {
            if (entry.expiresAt < now) {
                this.permissionCache.delete(key);
            }
        }

        // Clean up canvas users cache
        for (const [key, entry] of this.canvasUsersCache.entries()) {
            if (entry.expiresAt < now) {
                this.canvasUsersCache.delete(key);
            }
        }

        // Clean up user canvases cache
        for (const [key, entry] of this.userCanvasesCache.entries()) {
            if (entry.expiresAt < now) {
                this.userCanvasesCache.delete(key);
            }
        }
    }

    private resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            recentHits: []
        };
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.clearAllCaches();
    }
}
