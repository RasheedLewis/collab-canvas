/**
 * Canvas Model
 * 
 * Represents a canvas workspace with metadata, permissions, and state management.
 * Each canvas is an independent collaborative space with its own objects and user access.
 */

import {
    Canvas as CanvasType,
    CanvasPrivacy,
    CreateCanvasRequest,
    UpdateCanvasRequest,
    Timestamps
} from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class Canvas implements CanvasType {
    public readonly id: string;
    public name: string;
    public description?: string;
    public readonly ownerId: string;
    public privacy: CanvasPrivacy;
    public readonly createdAt: number;
    public updatedAt: number;
    public lastAccessedAt: number;
    public objectCount: number;
    public collaboratorCount: number;

    // Thumbnail and preview
    public thumbnailUrl?: string;
    public previewUrl?: string;

    // Canvas settings
    public settings?: {
        allowPublicEdit?: boolean;
        allowComments?: boolean;
        backgroundColor?: string;
        gridEnabled?: boolean;
    };

    // Metadata for organization
    public tags?: string[];
    public folder?: string;
    public isFavorite?: boolean;
    public isArchived?: boolean;

    constructor(data: {
        id?: string;
        name: string;
        description?: string;
        ownerId: string;
        privacy?: CanvasPrivacy;
        settings?: CanvasType['settings'];
        tags?: string[];
        folder?: string;
    }) {
        const now = Date.now();

        this.id = data.id || uuidv4();
        this.name = data.name;
        this.description = data.description;
        this.ownerId = data.ownerId;
        this.privacy = data.privacy || 'private';
        this.createdAt = now;
        this.updatedAt = now;
        this.lastAccessedAt = now;
        this.objectCount = 0;
        this.collaboratorCount = 1; // Owner counts as collaborator

        this.settings = {
            allowPublicEdit: false,
            allowComments: true,
            backgroundColor: '#ffffff',
            gridEnabled: false,
            ...data.settings
        };

        this.tags = data.tags || [];
        this.folder = data.folder;
        this.isFavorite = false;
        this.isArchived = false;
    }

    /**
     * Create a new canvas from a creation request
     */
    static fromCreateRequest(request: CreateCanvasRequest, ownerId: string): Canvas {
        return new Canvas({
            name: request.name,
            description: request.description,
            ownerId,
            privacy: request.privacy,
            settings: request.settings,
            tags: request.tags,
            folder: request.folder
        });
    }

    /**
     * Create a canvas instance from raw data (e.g., from database)
     */
    static fromData(data: CanvasType): Canvas {
        const canvas = new Canvas({
            id: data.id,
            name: data.name,
            description: data.description,
            ownerId: data.ownerId,
            privacy: data.privacy,
            settings: data.settings,
            tags: data.tags,
            folder: data.folder
        });

        // Override computed values with stored values
        canvas.updatedAt = data.updatedAt;
        canvas.lastAccessedAt = data.lastAccessedAt;
        canvas.objectCount = data.objectCount;
        canvas.collaboratorCount = data.collaboratorCount;
        canvas.thumbnailUrl = data.thumbnailUrl;
        canvas.previewUrl = data.previewUrl;
        canvas.isFavorite = data.isFavorite;
        canvas.isArchived = data.isArchived;

        return canvas;
    }

    /**
     * Update canvas metadata
     */
    update(request: UpdateCanvasRequest): void {
        if (request.name !== undefined) {
            this.name = request.name;
        }
        if (request.description !== undefined) {
            this.description = request.description;
        }
        if (request.privacy !== undefined) {
            this.privacy = request.privacy;
        }
        if (request.settings !== undefined) {
            this.settings = { ...this.settings, ...request.settings };
        }
        if (request.tags !== undefined) {
            this.tags = request.tags;
        }
        if (request.folder !== undefined) {
            this.folder = request.folder;
        }
        if (request.isFavorite !== undefined) {
            this.isFavorite = request.isFavorite;
        }
        if (request.isArchived !== undefined) {
            this.isArchived = request.isArchived;
        }

        this.updatedAt = Date.now();
    }

    /**
     * Touch the canvas to update last accessed time
     */
    touch(): void {
        this.lastAccessedAt = Date.now();
    }

    /**
     * Update object count when objects are added/removed
     */
    updateObjectCount(count: number): void {
        this.objectCount = Math.max(0, count);
        this.updatedAt = Date.now();
    }

    /**
     * Update collaborator count when users are added/removed
     */
    updateCollaboratorCount(count: number): void {
        this.collaboratorCount = Math.max(1, count); // Always at least owner
        this.updatedAt = Date.now();
    }

    /**
     * Set thumbnail URL after generation
     */
    setThumbnail(thumbnailUrl: string, previewUrl?: string): void {
        this.thumbnailUrl = thumbnailUrl;
        if (previewUrl) {
            this.previewUrl = previewUrl;
        }
        this.updatedAt = Date.now();
    }

    /**
     * Archive the canvas
     */
    archive(): void {
        this.isArchived = true;
        this.updatedAt = Date.now();
    }

    /**
     * Restore the canvas from archive
     */
    restore(): void {
        this.isArchived = false;
        this.updatedAt = Date.now();
    }

    /**
     * Toggle favorite status
     */
    toggleFavorite(): void {
        this.isFavorite = !this.isFavorite;
        this.updatedAt = Date.now();
    }

    /**
     * Check if canvas is publicly accessible
     */
    isPublic(): boolean {
        return this.privacy === 'public' || this.privacy === 'unlisted';
    }

    /**
     * Check if canvas allows public editing
     */
    allowsPublicEdit(): boolean {
        return this.isPublic() && (this.settings?.allowPublicEdit === true);
    }

    /**
     * Check if canvas allows comments
     */
    allowsComments(): boolean {
        return this.settings?.allowComments !== false;
    }

    /**
     * Get canvas data for API response
     */
    toJSON(): CanvasType {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            ownerId: this.ownerId,
            privacy: this.privacy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastAccessedAt: this.lastAccessedAt,
            objectCount: this.objectCount,
            collaboratorCount: this.collaboratorCount,
            thumbnailUrl: this.thumbnailUrl,
            previewUrl: this.previewUrl,
            settings: this.settings,
            tags: this.tags,
            folder: this.folder,
            isFavorite: this.isFavorite,
            isArchived: this.isArchived
        };
    }

    /**
     * Get canvas summary for list views (lightweight data)
     */
    toSummary(): Omit<CanvasType, 'settings'> {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            ownerId: this.ownerId,
            privacy: this.privacy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastAccessedAt: this.lastAccessedAt,
            objectCount: this.objectCount,
            collaboratorCount: this.collaboratorCount,
            thumbnailUrl: this.thumbnailUrl,
            previewUrl: this.previewUrl,
            tags: this.tags,
            folder: this.folder,
            isFavorite: this.isFavorite,
            isArchived: this.isArchived
        };
    }

    /**
     * Validate canvas data
     */
    static validate(data: Partial<CanvasType>): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!data.name || data.name.trim().length === 0) {
            errors.push('Canvas name is required');
        }
        if (data.name && data.name.length > 255) {
            errors.push('Canvas name must be less than 255 characters');
        }
        if (data.description && data.description.length > 1000) {
            errors.push('Canvas description must be less than 1000 characters');
        }
        if (data.privacy && !['private', 'public', 'unlisted'].includes(data.privacy)) {
            errors.push('Invalid privacy setting');
        }
        if (!data.ownerId || data.ownerId.trim().length === 0) {
            errors.push('Canvas owner is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate a collection name for Firestore based on canvas ID
     * This ensures each canvas has its own isolated object collection
     */
    getObjectCollectionName(): string {
        return `canvas_objects_${this.id}`;
    }

    /**
     * Generate a collection name for canvas-specific user presence
     */
    getPresenceCollectionName(): string {
        return `canvas_presence_${this.id}`;
    }
}
