/**
 * Canvas Controller
 * 
 * Handles all canvas CRUD operations including creation, updates, deletion,
 * duplication, and archiving. Integrates with permission system and audit logging.
 */

import { Response } from 'express';
import {
    CanvasAuthenticatedRequest,
    PermissionValidator
} from '../middleware/canvasAuth';
import { firestoreService } from '../database/firestoreService';
import { Canvas } from '../models/Canvas';
import { CanvasPermission } from '../models/CanvasPermission';
import { PermissionService } from '../services/permissionService';
import { AuditLogService } from '../services/auditLogService';
import {
    CreateCanvasRequest,
    UpdateCanvasRequest,
    CanvasFilters,
    CanvasSortOptions,
    CanvasPrivacy
} from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

// Response types for API
interface CanvasResponse {
    success: boolean;
    canvas?: Canvas;
    error?: string;
    code?: string;
}

interface CanvasListResponse {
    success: boolean;
    canvases?: Canvas[];
    hasMore?: boolean;
    nextCursor?: string;
    totalCount?: number;
    error?: string;
    code?: string;
}

interface CanvasDetailResponse {
    success: boolean;
    canvas?: Canvas;
    userPermission?: {
        role: string;
        canEdit: boolean;
        canShare: boolean;
        canManage: boolean;
    };
    collaborators?: Array<{
        userId: string;
        role: string;
        grantedAt: number;
    }>;
    error?: string;
    code?: string;
}

/**
 * Create a new canvas
 */
export const createCanvas = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!.uid;
        const createRequest = req.body as CreateCanvasRequest;

        // Validate request
        const validation = Canvas.validate({
            name: createRequest.name,
            description: createRequest.description,
            ownerId: userId,
            privacy: createRequest.privacy
        });

        if (!validation.valid) {
            res.status(400).json({
                success: false,
                error: validation.errors.join(', '),
                code: 'VALIDATION_ERROR'
            });
            return;
        }

        // Create canvas instance
        const canvas = Canvas.fromCreateRequest(createRequest, userId);

        // Save to database
        const dbResult = await firestoreService.createCanvas(canvas.toJSON());
        if (!dbResult.success) {
            res.status(500).json({
                success: false,
                error: dbResult.error,
                code: dbResult.code
            });
            return;
        }

        // Create owner permission
        const permissionService = PermissionService.getInstance();
        const ownerPermission = await permissionService.createOwnerPermission(
            canvas.id,
            userId,
            {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        );

        // Log audit event
        const auditService = AuditLogService.getInstance();
        await auditService.logCanvasCreated(
            canvas.id,
            userId,
            canvas.name,
            canvas.privacy,
            req.ip,
            req.get('User-Agent')
        );

        const response: CanvasResponse = {
            success: true,
            canvas: canvas.toJSON()
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating canvas:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Get canvas by ID with user permission context
 */
export const getCanvas = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;

        // Get canvas from database (permission middleware already validated access)
        const canvasResult = await firestoreService.getCanvas(canvasId);
        if (!canvasResult.success) {
            res.status(404).json({
                success: false,
                error: canvasResult.error,
                code: canvasResult.code
            });
            return;
        }

        // Get user permission details
        const permission = req.canvasPermission;
        let userPermissionSummary = undefined;
        let collaborators = undefined;

        if (permission) {
            userPermissionSummary = PermissionValidator.getPermissionSummary(permission);

            // If user has manage permissions, include collaborator list
            if (permission.canManagePermissions()) {
                const permissionsResult = await firestoreService.getCanvasPermissions(canvasId);
                if (permissionsResult.success) {
                    collaborators = permissionsResult.data!.map(perm => ({
                        userId: perm.userId,
                        role: perm.role,
                        grantedAt: perm.grantedAt
                    }));
                }
            }
        }

        const response: CanvasDetailResponse = {
            success: true,
            canvas: canvasResult.data!,
            userPermission: userPermissionSummary,
            collaborators
        };

        res.json(response);
    } catch (error) {
        console.error('Error getting canvas:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Update canvas metadata
 */
export const updateCanvas = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;
        const updateRequest = req.body as UpdateCanvasRequest;

        // Validate update request
        if (updateRequest.name !== undefined) {
            const nameValidation = Canvas.validate({ name: updateRequest.name, ownerId: userId });
            if (!nameValidation.valid) {
                res.status(400).json({
                    success: false,
                    error: nameValidation.errors.join(', '),
                    code: 'VALIDATION_ERROR'
                });
                return;
            }
        }

        // Update canvas in database
        const updateResult = await firestoreService.updateCanvas(
            canvasId,
            updateRequest,
            userId
        );

        if (!updateResult.success) {
            res.status(500).json({
                success: false,
                error: updateResult.error,
                code: updateResult.code
            });
            return;
        }

        const response: CanvasResponse = {
            success: true,
            canvas: updateResult.data!
        };

        res.json(response);
    } catch (error) {
        console.error('Error updating canvas:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Delete canvas (soft delete)
 */
export const deleteCanvas = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;

        // Get canvas details for audit log
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

        // Delete canvas
        const deleteResult = await firestoreService.deleteCanvas(canvasId, userId);
        if (!deleteResult.success) {
            res.status(500).json({
                success: false,
                error: deleteResult.error,
                code: deleteResult.code
            });
            return;
        }

        // Log audit event
        const auditService = AuditLogService.getInstance();
        await auditService.logCanvasDeleted(
            canvasId,
            userId,
            'Canvas deleted by owner',
            req.ip,
            req.get('User-Agent')
        );

        res.json({
            success: true,
            message: 'Canvas deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting canvas:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Archive canvas
 */
export const archiveCanvas = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;

        // Archive canvas (update isArchived flag)
        const updateResult = await firestoreService.updateCanvas(
            canvasId,
            { isArchived: true },
            userId
        );

        if (!updateResult.success) {
            res.status(500).json({
                success: false,
                error: updateResult.error,
                code: updateResult.code
            });
            return;
        }

        const response: CanvasResponse = {
            success: true,
            canvas: updateResult.data!
        };

        res.json(response);
    } catch (error) {
        console.error('Error archiving canvas:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Restore canvas from archive
 */
export const restoreCanvas = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;

        // Restore canvas (update isArchived flag)
        const updateResult = await firestoreService.updateCanvas(
            canvasId,
            { isArchived: false },
            userId
        );

        if (!updateResult.success) {
            res.status(500).json({
                success: false,
                error: updateResult.error,
                code: updateResult.code
            });
            return;
        }

        const response: CanvasResponse = {
            success: true,
            canvas: updateResult.data!
        };

        res.json(response);
    } catch (error) {
        console.error('Error restoring canvas:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Duplicate/Clone canvas
 */
export const duplicateCanvas = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;
        const { name, copyObjects = true } = req.body;

        // Get original canvas
        const originalCanvasResult = await firestoreService.getCanvas(canvasId);
        if (!originalCanvasResult.success) {
            res.status(404).json({
                success: false,
                error: originalCanvasResult.error,
                code: originalCanvasResult.code
            });
            return;
        }

        const originalCanvas = originalCanvasResult.data!;

        // Create new canvas with duplicated data
        const duplicatedCanvas = new Canvas({
            name: name || `${originalCanvas.name} (Copy)`,
            description: originalCanvas.description,
            ownerId: userId,
            privacy: 'private', // Always make copies private initially
            settings: originalCanvas.settings,
            tags: originalCanvas.tags ? [...originalCanvas.tags] : undefined,
            folder: originalCanvas.folder
        });

        // Save new canvas
        const createResult = await firestoreService.createCanvas(duplicatedCanvas.toJSON());
        if (!createResult.success) {
            res.status(500).json({
                success: false,
                error: createResult.error,
                code: createResult.code
            });
            return;
        }

        // Create owner permission for new canvas
        const permissionService = PermissionService.getInstance();
        await permissionService.createOwnerPermission(
            duplicatedCanvas.id,
            userId,
            {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        );

        // Copy objects if requested
        if (copyObjects) {
            const objectsResult = await firestoreService.getCanvasObjects(canvasId);
            if (objectsResult.success && objectsResult.data!.length > 0) {
                // Clone each object with new IDs
                for (const originalObject of objectsResult.data!) {
                    const clonedObject = {
                        ...originalObject,
                        id: uuidv4(),
                        canvasId: duplicatedCanvas.id,
                        userId: userId, // New objects belong to the duplicating user
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    };

                    await firestoreService.createCanvasObject(duplicatedCanvas.id, clonedObject);
                }
            }
        }

        const response: CanvasResponse = {
            success: true,
            canvas: duplicatedCanvas.toJSON()
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error duplicating canvas:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Get user's canvases with filtering and pagination
 */
export const getUserCanvases = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!.uid;
        const {
            // Filters
            ownedByMe = 'true',
            sharedWithMe = 'false',
            privacy,
            isArchived = 'false',
            isFavorite,
            folder,
            tags,
            // Sorting
            sortBy = 'updatedAt',
            sortDirection = 'desc',
            // Pagination
            limit = '20',
            cursor
        } = req.query;

        // Parse query parameters
        const filters: CanvasFilters = {
            ownedByMe: ownedByMe === 'true',
            sharedWithMe: sharedWithMe === 'true',
            privacy: privacy as CanvasPrivacy,
            isArchived: isArchived === 'true',
            isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
            folder: folder as string,
            tags: tags ? (tags as string).split(',') : undefined
        };

        const sort: CanvasSortOptions = {
            field: sortBy as 'name' | 'createdAt' | 'updatedAt' | 'lastAccessedAt',
            direction: sortDirection as 'asc' | 'desc'
        };

        const limitNum = Math.min(parseInt(limit as string) || 20, 100); // Max 100 per request

        // Get canvases from database
        const canvasesResult = await firestoreService.getUserCanvases(userId, {
            filters,
            sort,
            limit: limitNum,
            cursor: cursor as string
        });

        if (!canvasesResult.success) {
            res.status(500).json({
                success: false,
                error: canvasesResult.error,
                code: canvasesResult.code
            });
            return;
        }

        const response: CanvasListResponse = {
            success: true,
            canvases: canvasesResult.data!.items,
            hasMore: canvasesResult.data!.hasMore,
            nextCursor: canvasesResult.data!.nextCursor,
            totalCount: canvasesResult.data!.totalCount
        };

        res.json(response);
    } catch (error) {
        console.error('Error getting user canvases:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Search public canvases
 */
export const searchPublicCanvases = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { q: searchTerm, limit = '20', cursor } = req.query;

        if (!searchTerm || (searchTerm as string).trim().length < 2) {
            res.status(400).json({
                success: false,
                error: 'Search term must be at least 2 characters',
                code: 'INVALID_SEARCH_TERM'
            });
            return;
        }

        const limitNum = Math.min(parseInt(limit as string) || 20, 50); // Max 50 for search

        // Search public canvases
        const searchResult = await firestoreService.searchPublicCanvases(
            searchTerm as string,
            {
                limit: limitNum,
                cursor: cursor as string
            }
        );

        if (!searchResult.success) {
            res.status(500).json({
                success: false,
                error: searchResult.error,
                code: searchResult.code
            });
            return;
        }

        const response: CanvasListResponse = {
            success: true,
            canvases: searchResult.data!.items,
            hasMore: searchResult.data!.hasMore,
            nextCursor: searchResult.data!.nextCursor
        };

        res.json(response);
    } catch (error) {
        console.error('Error searching canvases:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Toggle favorite status
 */
export const toggleCanvasFavorite = async (
    req: CanvasAuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { canvasId } = req.params;
        const userId = req.user!.uid;

        // Get current canvas state
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
        const newFavoriteStatus = !canvas.isFavorite;

        // Update favorite status
        const updateResult = await firestoreService.updateCanvas(
            canvasId,
            { isFavorite: newFavoriteStatus },
            userId
        );

        if (!updateResult.success) {
            res.status(500).json({
                success: false,
                error: updateResult.error,
                code: updateResult.code
            });
            return;
        }

        const response: CanvasResponse = {
            success: true,
            canvas: updateResult.data!
        };

        res.json(response);
    } catch (error) {
        console.error('Error toggling canvas favorite:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
