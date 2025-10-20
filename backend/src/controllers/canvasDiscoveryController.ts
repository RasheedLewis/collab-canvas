/**
 * Canvas Discovery Controller
 * 
 * Handles advanced canvas discovery, search, recommendations,
 * and thumbnail generation endpoints.
 */

import { Request, Response } from 'express';
import { CanvasAuthenticatedRequest } from '../middleware/canvasAuth';
import { CanvasDiscoveryService } from '../services/canvasDiscoveryService';
import { ThumbnailService } from '../services/thumbnailService';
import { firestoreService } from '../database/firestoreService';

// Response types
interface DiscoveryResponse {
    success: boolean;
    canvases?: any[];
    hasMore?: boolean;
    nextCursor?: string;
    totalCount?: number;
    error?: string;
    code?: string;
}

interface RecommendationResponse {
    success: boolean;
    recommendations?: any[];
    error?: string;
    code?: string;
}

interface TagsResponse {
    success: boolean;
    tags?: Array<{ tag: string; count: number }>;
    error?: string;
    code?: string;
}

/**
 * Discover public canvases with advanced filtering
 */
export const discoverCanvases = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const {
            q: searchTerm,
            tags,
            category = 'recent',
            collaboratorName,
            excludeUserId,
            minCollaborators,
            maxCollaborators,
            createdAfter,
            createdBefore,
            limit = '20',
            cursor
        } = req.query;

        const discoveryService = CanvasDiscoveryService.getInstance();

        const options = {
            searchTerm: searchTerm as string,
            tags: tags ? (tags as string).split(',') : undefined,
            category: category as 'featured' | 'trending' | 'recent' | 'popular',
            collaboratorName: collaboratorName as string,
            excludeUserId: excludeUserId as string,
            minCollaborators: minCollaborators ? parseInt(minCollaborators as string) : undefined,
            maxCollaborators: maxCollaborators ? parseInt(maxCollaborators as string) : undefined,
            createdAfter: createdAfter ? parseInt(createdAfter as string) : undefined,
            createdBefore: createdBefore ? parseInt(createdBefore as string) : undefined,
            limit: Math.min(parseInt(limit as string) || 20, 50),
            cursor: cursor as string
        };

        const result = await discoveryService.discoverCanvases(options);

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
                code: result.code
            });
            return;
        }

        // Track discovery searches for analytics
        if (searchTerm) {
            console.log(`Discovery search: "${searchTerm}" category: ${category}`);
        }

        const response: DiscoveryResponse = {
            success: true,
            canvases: result.data!.canvases,
            hasMore: result.data!.hasMore,
            nextCursor: result.data!.nextCursor
        };

        res.json(response);
    } catch (error) {
        console.error('Error in canvas discovery:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Get personalized canvas recommendations
 */
export const getRecommendations = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!.uid;
        const { limit = '10' } = req.query;

        const discoveryService = CanvasDiscoveryService.getInstance();

        // Get user's recent canvases to build context
        const userCanvasesResult = await firestoreService.getUserCanvases(userId, {
            filters: { ownedByMe: true },
            sort: { field: 'updatedAt', direction: 'desc' },
            limit: 10
        });

        let userTags: string[] = [];
        if (userCanvasesResult.success) {
            const allTags = userCanvasesResult.data!.items.flatMap(canvas => canvas.tags || []);
            userTags = [...new Set(allTags)]; // Remove duplicates
        }

        const context = {
            userId,
            userTags
        };

        const result = await discoveryService.getRecommendations(
            context,
            parseInt(limit as string) || 10
        );

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
                code: result.code
            });
            return;
        }

        const response: RecommendationResponse = {
            success: true,
            recommendations: result.data!
        };

        res.json(response);
    } catch (error) {
        console.error('Error getting recommendations:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Get popular tags for browse interface
 */
export const getPopularTags = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { limit = '20' } = req.query;

        const discoveryService = CanvasDiscoveryService.getInstance();
        const result = await discoveryService.getPopularTags(
            parseInt(limit as string) || 20
        );

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
                code: result.code
            });
            return;
        }

        const response: TagsResponse = {
            success: true,
            tags: result.data!
        };

        res.json(response);
    } catch (error) {
        console.error('Error getting popular tags:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Generate canvas thumbnail
 */
export const generateThumbnail = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const {
            width = '400',
            height = '300',
            backgroundColor = '#ffffff',
            quality = '0.8',
            format = 'jpeg'
        } = req.query;

        const thumbnailService = ThumbnailService.getInstance();

        const options = {
            width: parseInt(width as string),
            height: parseInt(height as string),
            backgroundColor: backgroundColor as string,
            quality: parseFloat(quality as string),
            format: format as 'png' | 'jpeg'
        };

        const result = await thumbnailService.generateCanvasThumbnail(canvasId, options);

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
                code: result.code
            });
            return;
        }

        res.json({
            success: true,
            thumbnailUrl: result.thumbnailUrl,
            previewUrl: result.previewUrl
        });
    } catch (error) {
        console.error('Error generating thumbnail:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Serve canvas thumbnail image
 */
export const serveThumbnail = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { canvasId, type, filename } = req.params;

        // Parse filename to get format
        const [name, format] = filename.split('.');
        const thumbnailType = type as 'thumbnail' | 'preview';

        const thumbnailService = ThumbnailService.getInstance();
        const buffer = await thumbnailService.getThumbnailBuffer(canvasId, thumbnailType, format);

        if (!buffer) {
            // Try to generate thumbnail if it doesn't exist
            const generateResult = await thumbnailService.generateCanvasThumbnail(canvasId);

            if (!generateResult.success) {
                res.status(404).json({
                    success: false,
                    error: 'Thumbnail not found and could not be generated',
                    code: 'THUMBNAIL_NOT_FOUND'
                });
                return;
            }

            // Try to get the buffer again
            const newBuffer = await thumbnailService.getThumbnailBuffer(canvasId, thumbnailType, format);
            if (!newBuffer) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to generate thumbnail',
                    code: 'THUMBNAIL_GENERATION_FAILED'
                });
                return;
            }

            // Set appropriate headers and send the image
            res.set({
                'Content-Type': format === 'png' ? 'image/png' : 'image/jpeg',
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
                'ETag': `"${canvasId}-${thumbnailType}-${Date.now()}"`
            });
            res.send(newBuffer);
            return;
        }

        // Set appropriate headers and send the image
        res.set({
            'Content-Type': format === 'png' ? 'image/png' : 'image/jpeg',
            'Cache-Control': 'public, max-age=3600',
            'ETag': `"${canvasId}-${thumbnailType}"`
        });
        res.send(buffer);

    } catch (error) {
        console.error('Error serving thumbnail:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Update canvas thumbnail (when canvas changes)
 */
export const updateThumbnail = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;

        const thumbnailService = ThumbnailService.getInstance();
        const result = await thumbnailService.updateCanvasThumbnail(canvasId);

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
                code: result.code
            });
            return;
        }

        res.json({
            success: true,
            thumbnailUrl: result.thumbnailUrl,
            previewUrl: result.previewUrl,
            message: 'Thumbnail updated successfully'
        });
    } catch (error) {
        console.error('Error updating thumbnail:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Batch generate thumbnails
 */
export const batchGenerateThumbnails = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasIds } = req.body;

        if (!Array.isArray(canvasIds) || canvasIds.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Canvas IDs array is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }

        if (canvasIds.length > 50) {
            res.status(400).json({
                success: false,
                error: 'Maximum 50 canvases per batch request',
                code: 'BATCH_SIZE_EXCEEDED'
            });
            return;
        }

        const thumbnailService = ThumbnailService.getInstance();
        const results = await thumbnailService.batchGenerateThumbnails(canvasIds);

        const successful = results.filter(r => r.result.success).length;
        const failed = results.length - successful;

        res.json({
            success: true,
            results,
            summary: {
                total: canvasIds.length,
                successful,
                failed
            }
        });
    } catch (error) {
        console.error('Error batch generating thumbnails:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Track canvas access for analytics
 */
export const trackCanvasAccess = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const { accessType = 'view' } = req.body;
        const userId = req.user!.uid;

        const discoveryService = CanvasDiscoveryService.getInstance();
        await discoveryService.trackCanvasAccess(canvasId, userId, accessType);

        res.json({
            success: true,
            message: 'Access tracked successfully'
        });
    } catch (error) {
        console.error('Error tracking canvas access:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Get canvas analytics/stats
 */
export const getCanvasAnalytics = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const { period = '7d' } = req.query;

        // Get basic canvas info
        const canvasResult = await firestoreService.getCanvas(canvasId);
        if (!canvasResult.success) {
            res.status(404).json({
                success: false,
                error: canvasResult.error,
                code: canvasResult.code
            });
            return;
        }

        const canvas = canvasResult.data!;

        // Get canvas objects for content analysis
        const objectsResult = await firestoreService.getCanvasObjects(canvasId);
        const objects = objectsResult.success ? objectsResult.data! : [];

        // Calculate object type distribution
        const objectTypes = objects.reduce((acc, obj) => {
            acc[obj.type] = (acc[obj.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Get collaborators
        const permissionsResult = await firestoreService.getCanvasPermissions(canvasId);
        const collaborators = permissionsResult.success ? permissionsResult.data! : [];

        const analytics = {
            canvas: {
                id: canvas.id,
                name: canvas.name,
                privacy: canvas.privacy,
                createdAt: canvas.createdAt,
                lastAccessedAt: canvas.lastAccessedAt
            },
            content: {
                totalObjects: objects.length,
                objectTypes,
                lastObjectCreated: objects.length > 0 ? Math.max(...objects.map(o => o.createdAt)) : null
            },
            collaboration: {
                totalCollaborators: collaborators.length,
                roles: collaborators.reduce((acc, perm) => {
                    acc[perm.role] = (acc[perm.role] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            },
            activity: {
                // In production, these would come from activity logs
                viewCount: Math.floor(Math.random() * 100), // Placeholder
                editCount: Math.floor(Math.random() * 50),   // Placeholder
                shareCount: Math.floor(Math.random() * 10)   // Placeholder
            }
        };

        res.json({
            success: true,
            analytics,
            period
        });
    } catch (error) {
        console.error('Error getting canvas analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
