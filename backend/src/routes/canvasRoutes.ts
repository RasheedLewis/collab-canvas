/**
 * Canvas Routes
 * 
 * Defines REST API endpoints for canvas CRUD operations.
 * Integrates with permission middleware and canvas controller.
 */

import { Router } from 'express';
import {
    requireCanvasPermission,
    requireCanvasRole,
    requireCanvasOwner,
    optionalCanvasPermission,
    verifyAuthToken
} from '../middleware';
import {
    createCanvas,
    getCanvas,
    updateCanvas,
    deleteCanvas,
    archiveCanvas,
    restoreCanvas,
    duplicateCanvas,
    getUserCanvases,
    searchPublicCanvases,
    toggleCanvasFavorite
} from '../controllers/canvasController';

const router = Router();

// Apply authentication to all canvas routes
router.use(verifyAuthToken);

// ========================================
// Canvas CRUD Operations
// ========================================

/**
 * POST /api/canvas
 * Create a new canvas
 * 
 * Body:
 * - name: string (required)
 * - description?: string
 * - privacy?: 'private' | 'public' | 'unlisted'
 * - settings?: object
 * - tags?: string[]
 * - folder?: string
 */
router.post('/', createCanvas);

/**
 * GET /api/canvas/:canvasId
 * Get canvas by ID with user permission context
 * 
 * Requires: view permission or public canvas
 * 
 * Returns:
 * - canvas: Canvas object
 * - userPermission: User's permission summary
 * - collaborators?: Array of collaborators (if user can manage)
 */
router.get(
    '/:canvasId',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    getCanvas
);

/**
 * PATCH /api/canvas/:canvasId
 * Update canvas metadata
 * 
 * Requires: owner permission
 * 
 * Body:
 * - name?: string
 * - description?: string
 * - privacy?: 'private' | 'public' | 'unlisted'
 * - settings?: object
 * - tags?: string[]
 * - folder?: string
 */
router.patch(
    '/:canvasId',
    requireCanvasOwner({
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    updateCanvas
);

/**
 * DELETE /api/canvas/:canvasId
 * Delete canvas (soft delete)
 * 
 * Requires: owner permission
 */
router.delete(
    '/:canvasId',
    requireCanvasOwner({
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    deleteCanvas
);

// ========================================
// Canvas Management Operations
// ========================================

/**
 * POST /api/canvas/:canvasId/archive
 * Archive a canvas
 * 
 * Requires: owner permission
 */
router.post(
    '/:canvasId/archive',
    requireCanvasOwner({
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    archiveCanvas
);

/**
 * POST /api/canvas/:canvasId/restore
 * Restore canvas from archive
 * 
 * Requires: owner permission
 */
router.post(
    '/:canvasId/restore',
    requireCanvasOwner({
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    restoreCanvas
);

/**
 * POST /api/canvas/:canvasId/duplicate
 * Duplicate/clone a canvas
 * 
 * Requires: view permission (can duplicate any canvas you can view)
 * 
 * Body:
 * - name?: string (name for the new canvas)
 * - copyObjects?: boolean (default: true)
 */
router.post(
    '/:canvasId/duplicate',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    duplicateCanvas
);

/**
 * POST /api/canvas/:canvasId/favorite
 * Toggle favorite status for a canvas
 * 
 * Requires: view permission
 */
router.post(
    '/:canvasId/favorite',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId'
    }),
    toggleCanvasFavorite
);

// ========================================
// Canvas Discovery and Listing
// ========================================

/**
 * GET /api/canvas
 * Get user's canvases with filtering and pagination
 * 
 * Query parameters:
 * - ownedByMe?: boolean (default: true)
 * - sharedWithMe?: boolean (default: false)
 * - privacy?: 'private' | 'public' | 'unlisted'
 * - isArchived?: boolean (default: false)
 * - isFavorite?: boolean
 * - folder?: string
 * - tags?: string (comma-separated)
 * - sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastAccessedAt' (default: 'updatedAt')
 * - sortDirection?: 'asc' | 'desc' (default: 'desc')
 * - limit?: number (max: 100, default: 20)
 * - cursor?: string (pagination cursor)
 */
router.get('/', getUserCanvases);

/**
 * GET /api/canvas/search/public
 * Search public canvases
 * 
 * Query parameters:
 * - q: string (search term, min 2 characters)
 * - limit?: number (max: 50, default: 20)
 * - cursor?: string (pagination cursor)
 */
router.get('/search/public', searchPublicCanvases);

// ========================================
// Canvas Analytics and Stats (Future)
// ========================================

/**
 * GET /api/canvas/:canvasId/stats
 * Get canvas statistics and analytics
 * 
 * Requires: owner permission
 * 
 * Returns:
 * - objectCount: number
 * - collaboratorCount: number
 * - viewCount: number
 * - editCount: number
 * - lastActivity: timestamp
 */
router.get(
    '/:canvasId/stats',
    requireCanvasOwner({
        canvasIdParam: 'canvasId'
    }),
    async (req, res) => {
        // Placeholder for analytics endpoint
        res.json({
            success: false,
            error: 'Analytics endpoint not yet implemented',
            code: 'NOT_IMPLEMENTED'
        });
    }
);

/**
 * GET /api/canvas/:canvasId/activity
 * Get canvas activity log
 * 
 * Requires: view permission
 * 
 * Query parameters:
 * - limit?: number (default: 50)
 * - cursor?: string
 */
router.get(
    '/:canvasId/activity',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId'
    }),
    async (req, res) => {
        // Placeholder for activity log endpoint
        res.json({
            success: false,
            error: 'Activity log endpoint not yet implemented',
            code: 'NOT_IMPLEMENTED'
        });
    }
);

// ========================================
// Error Handling
// ========================================

// Canvas-specific error handler
router.use((error: any, req: any, res: any, next: any) => {
    if (error.code === 'CANVAS_NOT_FOUND') {
        res.status(404).json({
            success: false,
            error: 'Canvas not found',
            code: 'CANVAS_NOT_FOUND'
        });
        return;
    }

    if (error.code === 'PERMISSION_DENIED') {
        res.status(403).json({
            success: false,
            error: 'Permission denied for canvas operation',
            code: 'PERMISSION_DENIED',
            requiredPermission: error.requiredPermission
        });
        return;
    }

    if (error.code === 'VALIDATION_ERROR') {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.details
        });
        return;
    }

    // Pass to general error handler
    next(error);
});

export { router as canvasRoutes };
