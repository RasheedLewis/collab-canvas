/**
 * Canvas Object Controller
 * 
 * Handles CRUD operations for canvas objects (rectangles, circles, text).
 * Integrates with canvas permissions and real-time synchronization.
 */

import { Response } from 'express';
import { CanvasAuthenticatedRequest } from '../middleware/canvasAuth';
import { firestoreService } from '../database/firestoreService';
import {
    CanvasObject,
    RectangleObject,
    CircleObject,
    TextObject
} from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

// Response types
interface ObjectResponse {
    success: boolean;
    object?: CanvasObject;
    error?: string;
    code?: string;
}

interface ObjectListResponse {
    success: boolean;
    objects?: CanvasObject[];
    count?: number;
    error?: string;
    code?: string;
}

interface BatchObjectResponse {
    success: boolean;
    results?: Array<{
        id: string;
        success: boolean;
        object?: CanvasObject;
        error?: string;
    }>;
    summary?: {
        total: number;
        successful: number;
        failed: number;
    };
    error?: string;
    code?: string;
}

/**
 * Get all objects for a canvas
 */
export const getCanvasObjects = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;

        // Get objects from database
        const objectsResult = await firestoreService.getCanvasObjects(canvasId);
        if (!objectsResult.success) {
            res.status(500).json({
                success: false,
                error: objectsResult.error,
                code: objectsResult.code
            });
            return;
        }

        const response: ObjectListResponse = {
            success: true,
            objects: objectsResult.data!,
            count: objectsResult.data!.length
        };

        res.json(response);
    } catch (error) {
        console.error('Error getting canvas objects:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Create a new canvas object
 */
export const createCanvasObject = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;
        const objectData = req.body;

        // Validate and create object
        const validation = validateObjectData(objectData);
        if (!validation.valid) {
            res.status(400).json({
                success: false,
                error: validation.error,
                code: 'VALIDATION_ERROR'
            });
            return;
        }

        // Create object with generated ID and metadata
        const canvasObject: CanvasObject = {
            id: objectData.id || uuidv4(),
            x: objectData.x,
            y: objectData.y,
            type: objectData.type,
            color: objectData.color,
            rotation: objectData.rotation || 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            userId,
            canvasId,
            // Type-specific properties
            ...(objectData.type === 'rectangle' ? {
                width: objectData.width,
                height: objectData.height
            } : {}),
            ...(objectData.type === 'circle' ? {
                radius: objectData.radius
            } : {}),
            ...(objectData.type === 'text' ? {
                text: objectData.text,
                fontSize: objectData.fontSize,
                fontFamily: objectData.fontFamily,
                fontStyle: objectData.fontStyle
            } : {})
        };

        // Save to database
        const createResult = await firestoreService.createCanvasObject(canvasId, canvasObject);
        if (!createResult.success) {
            res.status(500).json({
                success: false,
                error: createResult.error,
                code: createResult.code
            });
            return;
        }

        const response: ObjectResponse = {
            success: true,
            object: createResult.data!
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating canvas object:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Update a canvas object
 */
export const updateCanvasObject = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId, objectId } = req.params;
        const userId = req.user!.uid;
        const updates = req.body;

        // Remove read-only fields from updates
        delete updates.id;
        delete updates.canvasId;
        delete updates.createdAt;

        // Validate updates
        if (Object.keys(updates).length === 0) {
            res.status(400).json({
                success: false,
                error: 'No valid fields to update',
                code: 'VALIDATION_ERROR'
            });
            return;
        }

        // Update object in database
        const updateResult = await firestoreService.updateCanvasObject(
            canvasId,
            objectId,
            updates,
            userId
        );

        if (!updateResult.success) {
            if (updateResult.code === 'OBJECT_NOT_FOUND') {
                res.status(404).json({
                    success: false,
                    error: updateResult.error,
                    code: updateResult.code
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: updateResult.error,
                code: updateResult.code
            });
            return;
        }

        const response: ObjectResponse = {
            success: true,
            object: updateResult.data!
        };

        res.json(response);
    } catch (error) {
        console.error('Error updating canvas object:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Delete a canvas object
 */
export const deleteCanvasObject = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId, objectId } = req.params;
        const userId = req.user!.uid;

        // Delete object from database
        const deleteResult = await firestoreService.deleteCanvasObject(
            canvasId,
            objectId,
            userId
        );

        if (!deleteResult.success) {
            if (deleteResult.code === 'OBJECT_NOT_FOUND') {
                res.status(404).json({
                    success: false,
                    error: deleteResult.error,
                    code: deleteResult.code
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: deleteResult.error,
                code: deleteResult.code
            });
            return;
        }

        res.json({
            success: true,
            message: 'Object deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting canvas object:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Batch create multiple objects
 */
export const batchCreateObjects = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;
        const { objects } = req.body;

        if (!Array.isArray(objects) || objects.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Objects array is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }

        if (objects.length > 100) {
            res.status(400).json({
                success: false,
                error: 'Maximum 100 objects per batch request',
                code: 'BATCH_SIZE_EXCEEDED'
            });
            return;
        }

        const results: Array<{
            id: string;
            success: boolean;
            object?: CanvasObject;
            error?: string;
        }> = [];

        // Process each object
        for (const objectData of objects) {
            try {
                // Validate object
                const validation = validateObjectData(objectData);
                if (!validation.valid) {
                    results.push({
                        id: objectData.id || 'unknown',
                        success: false,
                        error: validation.error
                    });
                    continue;
                }

                // Create object
                const canvasObject: CanvasObject = {
                    id: objectData.id || uuidv4(),
                    x: objectData.x,
                    y: objectData.y,
                    type: objectData.type,
                    color: objectData.color,
                    rotation: objectData.rotation || 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    userId,
                    canvasId,
                    // Type-specific properties
                    ...(objectData.type === 'rectangle' ? {
                        width: objectData.width,
                        height: objectData.height
                    } : {}),
                    ...(objectData.type === 'circle' ? {
                        radius: objectData.radius
                    } : {}),
                    ...(objectData.type === 'text' ? {
                        text: objectData.text,
                        fontSize: objectData.fontSize,
                        fontFamily: objectData.fontFamily,
                        fontStyle: objectData.fontStyle
                    } : {})
                };

                // Save to database
                const createResult = await firestoreService.createCanvasObject(canvasId, canvasObject);

                if (createResult.success) {
                    results.push({
                        id: canvasObject.id,
                        success: true,
                        object: createResult.data!
                    });
                } else {
                    results.push({
                        id: canvasObject.id,
                        success: false,
                        error: createResult.error
                    });
                }

            } catch (error) {
                results.push({
                    id: objectData.id || 'unknown',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // Calculate summary
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;

        const response: BatchObjectResponse = {
            success: true,
            results,
            summary: {
                total: objects.length,
                successful,
                failed
            }
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error batch creating objects:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Batch update multiple objects
 */
export const batchUpdateObjects = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;
        const { updates } = req.body;

        if (!Array.isArray(updates) || updates.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Updates array is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }

        if (updates.length > 100) {
            res.status(400).json({
                success: false,
                error: 'Maximum 100 updates per batch request',
                code: 'BATCH_SIZE_EXCEEDED'
            });
            return;
        }

        const results: Array<{
            id: string;
            success: boolean;
            object?: CanvasObject;
            error?: string;
        }> = [];

        // Process each update
        for (const update of updates) {
            try {
                const { id: objectId, ...updateData } = update;

                if (!objectId) {
                    results.push({
                        id: 'unknown',
                        success: false,
                        error: 'Object ID is required'
                    });
                    continue;
                }

                // Remove read-only fields
                delete updateData.canvasId;
                delete updateData.createdAt;

                if (Object.keys(updateData).length === 0) {
                    results.push({
                        id: objectId,
                        success: false,
                        error: 'No valid fields to update'
                    });
                    continue;
                }

                // Update object
                const updateResult = await firestoreService.updateCanvasObject(
                    canvasId,
                    objectId,
                    updateData,
                    userId
                );

                if (updateResult.success) {
                    results.push({
                        id: objectId,
                        success: true,
                        object: updateResult.data!
                    });
                } else {
                    results.push({
                        id: objectId,
                        success: false,
                        error: updateResult.error
                    });
                }

            } catch (error) {
                results.push({
                    id: update.id || 'unknown',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // Calculate summary
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;

        const response: BatchObjectResponse = {
            success: true,
            results,
            summary: {
                total: updates.length,
                successful,
                failed
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error batch updating objects:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Clear all objects from canvas
 */
export const clearCanvas = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;

        // Get all objects first
        const objectsResult = await firestoreService.getCanvasObjects(canvasId);
        if (!objectsResult.success) {
            res.status(500).json({
                success: false,
                error: objectsResult.error,
                code: objectsResult.code
            });
            return;
        }

        const objects = objectsResult.data!;
        const deletedCount = objects.length;

        // Delete all objects
        for (const object of objects) {
            await firestoreService.deleteCanvasObject(canvasId, object.id, userId);
        }

        res.json({
            success: true,
            message: `Cleared ${deletedCount} objects from canvas`,
            deletedCount
        });
    } catch (error) {
        console.error('Error clearing canvas:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

// ========================================
// Helper Functions
// ========================================

/**
 * Validate object data based on type
 */
function validateObjectData(data: any): { valid: boolean; error?: string } {
    // Basic validation
    if (!data.type || !['rectangle', 'circle', 'text'].includes(data.type)) {
        return { valid: false, error: 'Invalid object type' };
    }

    if (typeof data.x !== 'number' || typeof data.y !== 'number') {
        return { valid: false, error: 'X and Y coordinates must be numbers' };
    }

    if (!data.color || typeof data.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
        return { valid: false, error: 'Invalid color format (must be hex)' };
    }

    // Type-specific validation
    switch (data.type) {
        case 'rectangle':
            if (typeof data.width !== 'number' || data.width <= 0) {
                return { valid: false, error: 'Rectangle width must be a positive number' };
            }
            if (typeof data.height !== 'number' || data.height <= 0) {
                return { valid: false, error: 'Rectangle height must be a positive number' };
            }
            break;

        case 'circle':
            if (typeof data.radius !== 'number' || data.radius <= 0) {
                return { valid: false, error: 'Circle radius must be a positive number' };
            }
            break;

        case 'text':
            if (!data.text || typeof data.text !== 'string' || data.text.trim().length === 0) {
                return { valid: false, error: 'Text content is required' };
            }
            if (typeof data.fontSize !== 'number' || data.fontSize < 6 || data.fontSize > 200) {
                return { valid: false, error: 'Font size must be between 6 and 200' };
            }
            if (data.text.length > 5000) {
                return { valid: false, error: 'Text content too long (max 5000 characters)' };
            }
            break;
    }

    return { valid: true };
}
