/**
 * Canvas Object Routes
 * 
 * Defines REST API endpoints for canvas object operations.
 * Handles rectangles, circles, and text objects with real-time sync.
 */

import { Router } from 'express';
import {
    requireCanvasPermission,
    verifyAuthToken
} from '../middleware';
import {
    getCanvasObjects,
    createCanvasObject,
    updateCanvasObject,
    deleteCanvasObject,
    batchCreateObjects,
    batchUpdateObjects,
    clearCanvas
} from '../controllers/canvasObjectController';

const router = Router();

// Apply authentication to all object routes
router.use(verifyAuthToken);

// ========================================
// Canvas Object CRUD Operations
// ========================================

/**
 * GET /api/canvas/:canvasId/objects
 * Get all objects for a canvas
 * 
 * Requires: view permission
 * 
 * Returns:
 * - objects: Array of canvas objects
 * - count: Total number of objects
 */
router.get(
    '/:canvasId/objects',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId'
    }),
    getCanvasObjects
);

/**
 * POST /api/canvas/:canvasId/objects
 * Create a new canvas object
 * 
 * Requires: edit permission
 * 
 * Body:
 * - type: 'rectangle' | 'circle' | 'text'
 * - x: number
 * - y: number
 * - color: string (hex format)
 * - rotation?: number (default: 0)
 * 
 * For rectangles:
 * - width: number
 * - height: number
 * 
 * For circles:
 * - radius: number
 * 
 * For text:
 * - text: string
 * - fontSize: number
 * - fontFamily?: string
 * - fontStyle?: string
 */
router.post(
    '/:canvasId/objects',
    requireCanvasPermission('edit', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    createCanvasObject
);

/**
 * PATCH /api/canvas/:canvasId/objects/:objectId
 * Update a canvas object
 * 
 * Requires: edit permission
 * 
 * Body: Partial object data (any updatable fields)
 */
router.patch(
    '/:canvasId/objects/:objectId',
    requireCanvasPermission('edit', {
        canvasIdParam: 'canvasId'
    }),
    updateCanvasObject
);

/**
 * DELETE /api/canvas/:canvasId/objects/:objectId
 * Delete a canvas object
 * 
 * Requires: edit permission or delete permission
 */
router.delete(
    '/:canvasId/objects/:objectId',
    requireCanvasPermission('delete', {
        canvasIdParam: 'canvasId'
    }),
    deleteCanvasObject
);

// ========================================
// Batch Operations
// ========================================

/**
 * POST /api/canvas/:canvasId/objects/batch
 * Create multiple objects in a single request
 * 
 * Requires: edit permission
 * 
 * Body:
 * - objects: Array of object data (max 100)
 * 
 * Returns:
 * - results: Array of creation results
 * - summary: { total, successful, failed }
 */
router.post(
    '/:canvasId/objects/batch',
    requireCanvasPermission('edit', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    batchCreateObjects
);

/**
 * PATCH /api/canvas/:canvasId/objects/batch
 * Update multiple objects in a single request
 * 
 * Requires: edit permission
 * 
 * Body:
 * - updates: Array of { id, ...updateData } (max 100)
 * 
 * Returns:
 * - results: Array of update results  
 * - summary: { total, successful, failed }
 */
router.patch(
    '/:canvasId/objects/batch',
    requireCanvasPermission('edit', {
        canvasIdParam: 'canvasId'
    }),
    batchUpdateObjects
);

// ========================================
// Canvas Management
// ========================================

/**
 * DELETE /api/canvas/:canvasId/objects
 * Clear all objects from canvas
 * 
 * Requires: delete permission
 */
router.delete(
    '/:canvasId/objects',
    requireCanvasPermission('delete', {
        canvasIdParam: 'canvasId',
        logAccess: true
    }),
    clearCanvas
);

// ========================================
// Object Search and Filtering (Future)
// ========================================

/**
 * GET /api/canvas/:canvasId/objects/search
 * Search objects by type, properties, or spatial location
 * 
 * Query parameters:
 * - type?: 'rectangle' | 'circle' | 'text'
 * - color?: string (hex color)
 * - bounds?: string (x1,y1,x2,y2 - objects within bounds)
 * - text?: string (search text content)
 */
router.get(
    '/:canvasId/objects/search',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId'
    }),
    async (req, res) => {
        // Placeholder for object search endpoint
        res.json({
            success: false,
            error: 'Object search endpoint not yet implemented',
            code: 'NOT_IMPLEMENTED'
        });
    }
);

/**
 * GET /api/canvas/:canvasId/objects/by-user/:userId
 * Get objects created by a specific user
 * 
 * Requires: view permission
 */
router.get(
    '/:canvasId/objects/by-user/:userId',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId'
    }),
    async (req, res) => {
        // Placeholder for user objects endpoint
        res.json({
            success: false,
            error: 'User objects endpoint not yet implemented',
            code: 'NOT_IMPLEMENTED'
        });
    }
);

// ========================================
// Object History and Versioning (Future)
// ========================================

/**
 * GET /api/canvas/:canvasId/objects/:objectId/history
 * Get edit history for an object
 * 
 * Requires: view permission
 */
router.get(
    '/:canvasId/objects/:objectId/history',
    requireCanvasPermission('view', {
        canvasIdParam: 'canvasId'
    }),
    async (req, res) => {
        // Placeholder for object history endpoint
        res.json({
            success: false,
            error: 'Object history endpoint not yet implemented',
            code: 'NOT_IMPLEMENTED'
        });
    }
);

// ========================================
// Error Handling
// ========================================

// Object-specific error handler
router.use((error: any, req: any, res: any, next: any) => {
    if (error.code === 'OBJECT_NOT_FOUND') {
        res.status(404).json({
            success: false,
            error: 'Canvas object not found',
            code: 'OBJECT_NOT_FOUND'
        });
        return;
    }

    if (error.code === 'VALIDATION_ERROR') {
        res.status(400).json({
            success: false,
            error: 'Object validation failed',
            code: 'VALIDATION_ERROR',
            details: error.details
        });
        return;
    }

    if (error.code === 'BATCH_SIZE_EXCEEDED') {
        res.status(400).json({
            success: false,
            error: 'Batch size limit exceeded',
            code: 'BATCH_SIZE_EXCEEDED',
            maxBatchSize: 100
        });
        return;
    }

    // Pass to general error handler
    next(error);
});

export { router as canvasObjectRoutes };
