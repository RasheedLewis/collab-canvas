/**
 * Canvas Discovery Routes
 * 
 * Defines REST API endpoints for canvas discovery, search, recommendations,
 * and thumbnail generation.
 */

import { Router } from 'express';
import {
    requireCanvasPermission,
    verifyAuthToken,
    optionalAuth
} from '../middleware';
import {
    discoverCanvases,
    getRecommendations,
    getPopularTags,
    generateThumbnail,
    serveThumbnail,
    updateThumbnail,
    batchGenerateThumbnails,
    trackCanvasAccess,
    getCanvasAnalytics
} from '../controllers/canvasDiscoveryController';

const router = Router();

// ========================================
// Public Canvas Discovery (No Auth Required)
// ========================================

/**
 * GET /api/discover/canvases
 * Discover public canvases with advanced filtering
 * 
 * Query parameters:
 * - q?: string (search term)
 * - tags?: string (comma-separated tags)
 * - category?: 'featured' | 'trending' | 'recent' | 'popular' (default: 'recent')
 * - collaboratorName?: string
 * - excludeUserId?: string
 * - minCollaborators?: number
 * - maxCollaborators?: number
 * - createdAfter?: number (timestamp)
 * - createdBefore?: number (timestamp)
 * - limit?: number (max: 50, default: 20)
 * - cursor?: string (pagination cursor)
 */
router.get('/canvases', discoverCanvases);

/**
 * GET /api/discover/tags
 * Get popular tags for browse interface
 * 
 * Query parameters:
 * - limit?: number (default: 20)
 */
router.get('/tags', getPopularTags);

// ========================================
// Authenticated Discovery Features
// ========================================

// Apply authentication to remaining routes
router.use(verifyAuthToken);

/**
 * GET /api/discover/recommendations
 * Get personalized canvas recommendations for authenticated user
 * 
 * Query parameters:
 * - limit?: number (default: 10)
 */
router.get('/recommendations', getRecommendations);

// ========================================
// Thumbnail Generation and Serving
// ========================================

/**
 * POST /api/discover/thumbnails/:canvasId/generate
 * Generate thumbnail for a canvas
 * 
 * Requires: view permission
 * 
 * Query parameters:
 * - width?: number (default: 400)
 * - height?: number (default: 300)
 * - backgroundColor?: string (default: '#ffffff')
 * - quality?: number (0-1, default: 0.8)
 * - format?: 'png' | 'jpeg' (default: 'jpeg')
 */
router.post(
    '/thumbnails/:canvasId/generate',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId'
    }),
    generateThumbnail
);

/**
 * PUT /api/discover/thumbnails/:canvasId/update
 * Update/regenerate thumbnail for a canvas
 * 
 * Requires: edit permission
 */
router.put(
    '/thumbnails/:canvasId/update',
    requireCanvasPermission('edit', {
        canvasIdParam: 'canvasId'
    }),
    updateThumbnail
);

/**
 * POST /api/discover/thumbnails/batch
 * Batch generate thumbnails for multiple canvases
 * 
 * Body:
 * - canvasIds: string[] (max 50)
 */
router.post('/thumbnails/batch', batchGenerateThumbnails);

// ========================================
// Thumbnail Serving (Public, with caching)
// ========================================

/**
 * GET /api/thumbnails/:canvasId/:type/:filename
 * Serve canvas thumbnail image
 * 
 * No authentication required for public canvases
 * Private canvas thumbnails require view permission
 * 
 * Parameters:
 * - canvasId: string
 * - type: 'thumbnail' | 'preview'
 * - filename: string (e.g., 'thumbnail.jpeg', 'preview.png')
 */
router.get(
    '/thumbnails/:canvasId/:type/:filename',
    optionalAuth, // Check auth but don't require it
    serveThumbnail
);

// ========================================
// Analytics and Tracking
// ========================================

/**
 * POST /api/discover/track/:canvasId
 * Track canvas access for analytics
 * 
 * Body:
 * - accessType?: 'view' | 'edit' | 'share' (default: 'view')
 */
router.post(
    '/track/:canvasId',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId'
    }),
    trackCanvasAccess
);

/**
 * GET /api/discover/analytics/:canvasId
 * Get canvas analytics and stats
 * 
 * Requires: view permission (owner gets more detailed stats)
 * 
 * Query parameters:
 * - period?: string (default: '7d')
 */
router.get(
    '/analytics/:canvasId',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId'
    }),
    getCanvasAnalytics
);

// ========================================
// Search and Filter Helpers
// ========================================

/**
 * GET /api/discover/search/suggestions
 * Get search suggestions based on popular terms
 * 
 * Query parameters:
 * - q?: string (partial search term)
 * - limit?: number (default: 10)
 */
router.get('/search/suggestions', async (req, res) => {
    try {
        const { q, limit = '10' } = req.query;

        if (!q || (q as string).length < 2) {
            res.json({
                success: true,
                suggestions: []
            });
            return;
        }

        // In production, this would use a proper search index with autocomplete
        // For now, return some mock suggestions based on popular tags
        const mockSuggestions = [
            'design system',
            'wireframe',
            'mockup',
            'prototype',
            'ui design',
            'dashboard',
            'mobile app',
            'web design',
            'user flow',
            'landing page'
        ].filter(suggestion =>
            suggestion.toLowerCase().includes((q as string).toLowerCase())
        ).slice(0, parseInt(limit as string) || 10);

        res.json({
            success: true,
            suggestions: mockSuggestions.map(suggestion => ({
                text: suggestion,
                type: 'tag',
                popularity: Math.floor(Math.random() * 100)
            }))
        });
    } catch (error) {
        console.error('Error getting search suggestions:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/discover/categories
 * Get available discovery categories with counts
 */
router.get('/categories', async (req, res) => {
    try {
        // In production, these counts would come from cached analytics
        const categories = [
            {
                id: 'featured',
                name: 'Featured',
                description: 'Hand-picked high-quality canvases',
                count: 25,
                icon: '⭐'
            },
            {
                id: 'trending',
                name: 'Trending',
                description: 'Popular canvases with recent activity',
                count: 42,
                icon: '🔥'
            },
            {
                id: 'recent',
                name: 'Recent',
                description: 'Recently created public canvases',
                count: 156,
                icon: '🆕'
            },
            {
                id: 'popular',
                name: 'Popular',
                description: 'Most collaborated canvases',
                count: 89,
                icon: '👥'
            }
        ];

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Error getting categories:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ========================================
// Error Handling
// ========================================

// Discovery-specific error handler
router.use((error: any, req: any, res: any, next: any) => {
    if (error.code === 'DISCOVERY_ERROR') {
        res.status(500).json({
            success: false,
            error: 'Canvas discovery failed',
            code: 'DISCOVERY_ERROR'
        });
        return;
    }

    if (error.code === 'THUMBNAIL_NOT_FOUND') {
        res.status(404).json({
            success: false,
            error: 'Thumbnail not found',
            code: 'THUMBNAIL_NOT_FOUND'
        });
        return;
    }

    if (error.code === 'THUMBNAIL_GENERATION_ERROR') {
        res.status(500).json({
            success: false,
            error: 'Failed to generate thumbnail',
            code: 'THUMBNAIL_GENERATION_ERROR'
        });
        return;
    }

    if (error.code === 'BATCH_SIZE_EXCEEDED') {
        res.status(400).json({
            success: false,
            error: 'Batch size limit exceeded',
            code: 'BATCH_SIZE_EXCEEDED',
            maxBatchSize: 50
        });
        return;
    }

    // Pass to general error handler
    next(error);
});

export { router as canvasDiscoveryRoutes };
