/**
 * Canvas Discovery Service
 * 
 * Handles advanced canvas discovery features including search, recommendations,
 * trending canvases, and public canvas browsing.
 */

import { firestoreService } from '../database/firestoreService';
import {
    Canvas,
    CanvasFilters,
    CanvasSortOptions,
    User,
    CanvasSearchOptions
} from '../../../shared/types';

export interface DiscoveryResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}

export interface CanvasDiscoveryOptions {
    searchTerm?: string;
    tags?: string[];
    category?: 'featured' | 'trending' | 'recent' | 'popular';
    collaboratorName?: string;
    excludeUserId?: string; // Exclude canvases from specific user
    minCollaborators?: number;
    maxCollaborators?: number;
    createdAfter?: number;
    createdBefore?: number;
    limit?: number;
    cursor?: string;
}

export interface TrendingCanvasMetrics {
    canvasId: string;
    viewCount: number;
    collaboratorCount: number;
    recentActivity: number;
    sharesCount: number;
    duplicatesCount: number;
    score: number; // Calculated trending score
}

export interface RecommendationContext {
    userId: string;
    userTags?: string[];
    recentCanvases?: string[];
    collaboratedWith?: string[];
    interests?: string[];
}

export interface CanvasRecommendation {
    canvas: Canvas;
    score: number;
    reason: 'similar_tags' | 'collaborative_filtering' | 'trending' | 'popular_with_connections';
    metadata?: {
        commonTags?: string[];
        mutualCollaborators?: string[];
        activityScore?: number;
    };
}

/**
 * Canvas Discovery Service - Singleton
 */
export class CanvasDiscoveryService {
    private static instance: CanvasDiscoveryService;

    // In-memory caches for performance
    private trendingCache: Map<string, TrendingCanvasMetrics[]> = new Map();
    private featuredCache: Map<string, Canvas[]> = new Map();
    private searchCache: Map<string, Canvas[]> = new Map();
    private cacheTimeout = 5 * 60 * 1000; // 5 minutes

    private constructor() { }

    public static getInstance(): CanvasDiscoveryService {
        if (!CanvasDiscoveryService.instance) {
            CanvasDiscoveryService.instance = new CanvasDiscoveryService();
        }
        return CanvasDiscoveryService.instance;
    }

    /**
     * Discover public canvases with advanced filtering
     */
    public async discoverCanvases(
        options: CanvasDiscoveryOptions
    ): Promise<DiscoveryResult<{ canvases: Canvas[]; hasMore: boolean; nextCursor?: string }>> {
        try {
            let canvases: Canvas[] = [];

            // Handle different discovery categories
            switch (options.category) {
                case 'featured':
                    canvases = await this.getFeaturedCanvases(options);
                    break;
                case 'trending':
                    canvases = await this.getTrendingCanvases(options);
                    break;
                case 'recent':
                    canvases = await this.getRecentPublicCanvases(options);
                    break;
                case 'popular':
                    canvases = await this.getPopularCanvases(options);
                    break;
                default:
                    canvases = await this.searchCanvases(options);
            }

            // Apply additional filters
            if (options.excludeUserId) {
                canvases = canvases.filter(c => c.ownerId !== options.excludeUserId);
            }

            if (options.minCollaborators !== undefined) {
                canvases = canvases.filter(c => c.collaboratorCount >= options.minCollaborators!);
            }

            if (options.maxCollaborators !== undefined) {
                canvases = canvases.filter(c => c.collaboratorCount <= options.maxCollaborators!);
            }

            if (options.createdAfter) {
                canvases = canvases.filter(c => c.createdAt >= options.createdAfter!);
            }

            if (options.createdBefore) {
                canvases = canvases.filter(c => c.createdAt <= options.createdBefore!);
            }

            // Apply pagination
            const limit = Math.min(options.limit || 20, 50);
            let startIndex = 0;

            if (options.cursor) {
                try {
                    const cursorData = JSON.parse(Buffer.from(options.cursor, 'base64').toString());
                    startIndex = cursorData.offset || 0;
                } catch (error) {
                    console.warn('Invalid cursor provided:', error);
                }
            }

            const paginatedResults = canvases.slice(startIndex, startIndex + limit + 1);
            const hasMore = paginatedResults.length > limit;
            const resultCanvases = hasMore ? paginatedResults.slice(0, -1) : paginatedResults;

            let nextCursor: string | undefined;
            if (hasMore) {
                const cursorData = { offset: startIndex + limit };
                nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
            }

            return {
                success: true,
                data: {
                    canvases: resultCanvases,
                    hasMore,
                    nextCursor
                }
            };

        } catch (error) {
            console.error('Error discovering canvases:', error);
            return {
                success: false,
                error: 'Failed to discover canvases',
                code: 'DISCOVERY_ERROR'
            };
        }
    }

    /**
     * Advanced canvas search with full-text search capabilities
     */
    public async searchCanvases(options: CanvasDiscoveryOptions): Promise<Canvas[]> {
        const cacheKey = JSON.stringify(options);

        // Check cache first
        if (this.searchCache.has(cacheKey)) {
            const cached = this.searchCache.get(cacheKey)!;
            // Simple cache expiry check (in production, use proper cache with TTL)
            return cached;
        }

        try {
            // Get all public canvases (in production, this would be optimized with proper search indexing)
            const publicCanvasesResult = await firestoreService.searchPublicCanvases('', { limit: 1000 });

            if (!publicCanvasesResult.success) {
                return [];
            }

            let canvases = publicCanvasesResult.data!.items;

            // Apply search term filtering
            if (options.searchTerm && options.searchTerm.length >= 2) {
                const searchLower = options.searchTerm.toLowerCase();
                canvases = canvases.filter(canvas => {
                    const nameMatch = canvas.name.toLowerCase().includes(searchLower);
                    const descMatch = canvas.description?.toLowerCase().includes(searchLower) || false;
                    const tagMatch = canvas.tags?.some(tag =>
                        tag.toLowerCase().includes(searchLower)
                    ) || false;

                    return nameMatch || descMatch || tagMatch;
                });
            }

            // Apply tag filtering
            if (options.tags && options.tags.length > 0) {
                canvases = canvases.filter(canvas => {
                    if (!canvas.tags) return false;
                    return options.tags!.some(tag =>
                        canvas.tags!.some(canvasTag =>
                            canvasTag.toLowerCase().includes(tag.toLowerCase())
                        )
                    );
                });
            }

            // Search by collaborator name (this would require a separate user lookup in production)
            if (options.collaboratorName) {
                // For now, we'll skip this complex query - would need user service integration
                console.log('Collaborator search not implemented yet:', options.collaboratorName);
            }

            // Cache results
            this.searchCache.set(cacheKey, canvases);

            // Set cache expiry
            setTimeout(() => {
                this.searchCache.delete(cacheKey);
            }, this.cacheTimeout);

            return canvases;

        } catch (error) {
            console.error('Error searching canvases:', error);
            return [];
        }
    }

    /**
     * Get featured canvases (manually curated)
     */
    private async getFeaturedCanvases(options: CanvasDiscoveryOptions): Promise<Canvas[]> {
        const cacheKey = 'featured_canvases';

        if (this.featuredCache.has(cacheKey)) {
            return this.featuredCache.get(cacheKey)!;
        }

        try {
            // In production, this would query a separate 'featured' collection or flag
            const result = await firestoreService.searchPublicCanvases('', { limit: 100 });

            if (!result.success) {
                return [];
            }

            // For now, select high-quality canvases (many collaborators, recent activity)
            const featured = result.data!.items
                .filter(canvas =>
                    canvas.collaboratorCount >= 2 &&
                    canvas.objectCount >= 5 &&
                    canvas.lastAccessedAt > Date.now() - (30 * 24 * 60 * 60 * 1000) // Active in last 30 days
                )
                .sort((a, b) => {
                    // Score based on activity and collaboration
                    const scoreA = a.collaboratorCount * 2 + Math.min(a.objectCount, 50);
                    const scoreB = b.collaboratorCount * 2 + Math.min(b.objectCount, 50);
                    return scoreB - scoreA;
                })
                .slice(0, 20);

            this.featuredCache.set(cacheKey, featured);

            setTimeout(() => {
                this.featuredCache.delete(cacheKey);
            }, this.cacheTimeout);

            return featured;

        } catch (error) {
            console.error('Error getting featured canvases:', error);
            return [];
        }
    }

    /**
     * Get trending canvases based on recent activity
     */
    private async getTrendingCanvases(options: CanvasDiscoveryOptions): Promise<Canvas[]> {
        const cacheKey = 'trending_canvases';

        try {
            // Get recent public canvases with activity
            const result = await firestoreService.searchPublicCanvases('', { limit: 200 });

            if (!result.success) {
                return [];
            }

            const now = Date.now();
            const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

            // Calculate trending scores
            const trending = result.data!.items
                .filter(canvas => canvas.lastAccessedAt > weekAgo)
                .map(canvas => {
                    // Simple trending algorithm
                    const recency = Math.max(0, canvas.lastAccessedAt - weekAgo) / (7 * 24 * 60 * 60 * 1000);
                    const collaboration = Math.min(canvas.collaboratorCount, 10) / 10;
                    const content = Math.min(canvas.objectCount, 100) / 100;

                    const score = (recency * 0.4) + (collaboration * 0.4) + (content * 0.2);

                    return { canvas, score };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 20)
                .map(item => item.canvas);

            return trending;

        } catch (error) {
            console.error('Error getting trending canvases:', error);
            return [];
        }
    }

    /**
     * Get recently created public canvases
     */
    private async getRecentPublicCanvases(options: CanvasDiscoveryOptions): Promise<Canvas[]> {
        try {
            const result = await firestoreService.searchPublicCanvases('', { limit: 100 });

            if (!result.success) {
                return [];
            }

            return result.data!.items
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 50);

        } catch (error) {
            console.error('Error getting recent canvases:', error);
            return [];
        }
    }

    /**
     * Get popular canvases (most collaborators and objects)
     */
    private async getPopularCanvases(options: CanvasDiscoveryOptions): Promise<Canvas[]> {
        try {
            const result = await firestoreService.searchPublicCanvases('', { limit: 200 });

            if (!result.success) {
                return [];
            }

            return result.data!.items
                .sort((a, b) => {
                    const popularityA = a.collaboratorCount * 3 + Math.min(a.objectCount, 50);
                    const popularityB = b.collaboratorCount * 3 + Math.min(b.objectCount, 50);
                    return popularityB - popularityA;
                })
                .slice(0, 30);

        } catch (error) {
            console.error('Error getting popular canvases:', error);
            return [];
        }
    }

    /**
     * Get personalized canvas recommendations for a user
     */
    public async getRecommendations(
        context: RecommendationContext,
        limit: number = 10
    ): Promise<DiscoveryResult<CanvasRecommendation[]>> {
        try {
            const recommendations: CanvasRecommendation[] = [];

            // Get user's recent canvases for analysis
            const userCanvasesResult = await firestoreService.getUserCanvases(context.userId, {
                filters: { ownedByMe: true },
                sort: { field: 'updatedAt', direction: 'desc' },
                limit: 20
            });

            if (!userCanvasesResult.success) {
                return {
                    success: false,
                    error: 'Failed to get user context for recommendations',
                    code: 'USER_CONTEXT_ERROR'
                };
            }

            const userCanvases = userCanvasesResult.data!.items;
            const userTags = new Set<string>();

            // Collect user's common tags
            userCanvases.forEach(canvas => {
                canvas.tags?.forEach(tag => userTags.add(tag.toLowerCase()));
            });

            // Get public canvases for recommendations
            const publicCanvasesResult = await firestoreService.searchPublicCanvases('', { limit: 200 });

            if (!publicCanvasesResult.success) {
                return {
                    success: false,
                    error: 'Failed to get public canvases for recommendations',
                    code: 'PUBLIC_CANVASES_ERROR'
                };
            }

            const publicCanvases = publicCanvasesResult.data!.items;

            // Generate recommendations based on similar tags
            publicCanvases.forEach(canvas => {
                if (canvas.ownerId === context.userId) return; // Skip user's own canvases

                const canvasTags = new Set(canvas.tags?.map(tag => tag.toLowerCase()) || []);
                const commonTags = Array.from(userTags).filter(tag => canvasTags.has(tag));

                if (commonTags.length > 0) {
                    const score = (commonTags.length / Math.max(userTags.size, canvasTags.size)) * 100;

                    recommendations.push({
                        canvas,
                        score,
                        reason: 'similar_tags',
                        metadata: {
                            commonTags
                        }
                    });
                }
            });

            // Add trending canvases with lower scores
            const trending = await this.getTrendingCanvases({});
            trending.forEach(canvas => {
                if (canvas.ownerId === context.userId) return;

                // Only add if not already recommended
                if (!recommendations.find(r => r.canvas.id === canvas.id)) {
                    recommendations.push({
                        canvas,
                        score: 30, // Lower score for trending
                        reason: 'trending'
                    });
                }
            });

            // Sort by score and limit results
            const sortedRecommendations = recommendations
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

            return {
                success: true,
                data: sortedRecommendations
            };

        } catch (error) {
            console.error('Error generating recommendations:', error);
            return {
                success: false,
                error: 'Failed to generate recommendations',
                code: 'RECOMMENDATION_ERROR'
            };
        }
    }

    /**
     * Track canvas view/access for analytics
     */
    public async trackCanvasAccess(
        canvasId: string,
        userId: string,
        accessType: 'view' | 'edit' | 'share'
    ): Promise<void> {
        try {
            // In production, this would write to an analytics collection
            console.log(`Tracking canvas access: ${canvasId} by ${userId} (${accessType})`);

            // Update canvas lastAccessedAt
            await firestoreService.updateCanvas(canvasId, {
                lastAccessedAt: Date.now()
            }, userId);

        } catch (error) {
            console.error('Error tracking canvas access:', error);
            // Don't throw - analytics shouldn't block main functionality
        }
    }

    /**
     * Get canvas categories/tags for browse interface
     */
    public async getPopularTags(limit: number = 20): Promise<DiscoveryResult<Array<{ tag: string; count: number }>>> {
        try {
            const result = await firestoreService.searchPublicCanvases('', { limit: 500 });

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to get public canvases for tag analysis',
                    code: 'TAG_ANALYSIS_ERROR'
                };
            }

            const tagCounts = new Map<string, number>();

            result.data!.items.forEach(canvas => {
                canvas.tags?.forEach(tag => {
                    const normalizedTag = tag.toLowerCase().trim();
                    tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
                });
            });

            const popularTags = Array.from(tagCounts.entries())
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, limit);

            return {
                success: true,
                data: popularTags
            };

        } catch (error) {
            console.error('Error getting popular tags:', error);
            return {
                success: false,
                error: 'Failed to get popular tags',
                code: 'TAG_ERROR'
            };
        }
    }

    /**
     * Clear all caches (useful for testing or manual cache refresh)
     */
    public clearCaches(): void {
        this.trendingCache.clear();
        this.featuredCache.clear();
        this.searchCache.clear();
    }
}
