/**
 * Canvas Utility Functions
 * 
 * Provides utility functions for canvas operations including thumbnail generation,
 * validation, and canvas state management.
 */

import { Canvas } from '../models/Canvas';
import { CanvasObject, CanvasState } from '../../../shared/types';
import { createCanvas, loadImage } from 'canvas';
import * as fs from 'fs/promises';
import * as path from 'path';

// Thumbnail configuration
export const THUMBNAIL_CONFIG = {
    width: 300,
    height: 200,
    quality: 0.8,
    backgroundColor: '#ffffff',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
} as const;

export const PREVIEW_CONFIG = {
    width: 800,
    height: 600,
    quality: 0.9,
    backgroundColor: '#ffffff',
} as const;

/**
 * Generate canvas thumbnail from objects
 */
export class CanvasThumbnailGenerator {
    private static readonly STORAGE_PATH = process.env.THUMBNAIL_STORAGE_PATH || './data/thumbnails';

    /**
     * Generate thumbnail and preview images for a canvas
     */
    static async generateThumbnail(
        canvas: Canvas,
        objects: CanvasObject[]
    ): Promise<{ thumbnailUrl: string; previewUrl?: string }> {
        try {
            // Ensure storage directory exists
            await this.ensureStorageDirectory();

            // Calculate bounds of all objects
            const bounds = this.calculateCanvasBounds(objects);

            // Generate thumbnail
            const thumbnailBuffer = await this.renderCanvasToBuffer(
                objects,
                bounds,
                THUMBNAIL_CONFIG.width,
                THUMBNAIL_CONFIG.height
            );

            // Generate preview (larger version)
            const previewBuffer = await this.renderCanvasToBuffer(
                objects,
                bounds,
                PREVIEW_CONFIG.width,
                PREVIEW_CONFIG.height
            );

            // Save files
            const thumbnailPath = await this.saveImageBuffer(
                thumbnailBuffer,
                canvas.id,
                'thumbnail'
            );
            const previewPath = await this.saveImageBuffer(
                previewBuffer,
                canvas.id,
                'preview'
            );

            // Return URLs (in production, these would be CDN URLs)
            return {
                thumbnailUrl: this.getPublicUrl(thumbnailPath),
                previewUrl: this.getPublicUrl(previewPath)
            };
        } catch (error) {
            console.error('Failed to generate canvas thumbnail:', error);
            // Return default/placeholder thumbnail
            return {
                thumbnailUrl: '/api/canvas/default-thumbnail.png'
            };
        }
    }

    /**
     * Calculate the bounding box of all canvas objects
     */
    private static calculateCanvasBounds(objects: CanvasObject[]): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        width: number;
        height: number;
    } {
        if (objects.length === 0) {
            return {
                minX: 0,
                minY: 0,
                maxX: 400,
                maxY: 300,
                width: 400,
                height: 300
            };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        objects.forEach(obj => {
            let objMinX = obj.x;
            let objMinY = obj.y;
            let objMaxX = obj.x;
            let objMaxY = obj.y;

            switch (obj.type) {
                case 'rectangle':
                    objMaxX = obj.x + obj.width;
                    objMaxY = obj.y + obj.height;
                    break;
                case 'circle':
                    objMinX = obj.x - obj.radius;
                    objMinY = obj.y - obj.radius;
                    objMaxX = obj.x + obj.radius;
                    objMaxY = obj.y + obj.radius;
                    break;
                case 'text':
                    // Estimate text bounds based on font size
                    const textWidth = obj.text.length * (obj.fontSize * 0.6);
                    const textHeight = obj.fontSize * 1.2;
                    objMaxX = obj.x + textWidth;
                    objMaxY = obj.y + textHeight;
                    break;
            }

            minX = Math.min(minX, objMinX);
            minY = Math.min(minY, objMinY);
            maxX = Math.max(maxX, objMaxX);
            maxY = Math.max(maxY, objMaxY);
        });

        // Add padding
        const padding = 20;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Render canvas objects to image buffer
     */
    private static async renderCanvasToBuffer(
        objects: CanvasObject[],
        bounds: { minX: number; minY: number; width: number; height: number },
        targetWidth: number,
        targetHeight: number
    ): Promise<Buffer> {
        const canvas = createCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = THUMBNAIL_CONFIG.backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Calculate scale to fit content
        const scaleX = targetWidth / bounds.width;
        const scaleY = targetHeight / bounds.height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't upscale

        // Center the content
        const offsetX = (targetWidth - bounds.width * scale) / 2;
        const offsetY = (targetHeight - bounds.height * scale) / 2;

        // Apply transformations
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.translate(-bounds.minX, -bounds.minY);

        // Render objects
        objects.forEach(obj => {
            this.renderObject(ctx, obj);
        });

        return canvas.toBuffer('image/png');
    }

    /**
     * Render a single canvas object
     */
    private static renderObject(ctx: CanvasRenderingContext2D, obj: CanvasObject): void {
        ctx.fillStyle = obj.color;
        ctx.strokeStyle = obj.color;

        switch (obj.type) {
            case 'rectangle':
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                break;

            case 'circle':
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, obj.radius, 0, 2 * Math.PI);
                ctx.fill();
                break;

            case 'text':
                ctx.font = `${obj.fontSize}px ${obj.fontFamily || 'Arial'}`;
                ctx.fillText(obj.text, obj.x, obj.y + obj.fontSize);
                break;
        }
    }

    /**
     * Save image buffer to file
     */
    private static async saveImageBuffer(
        buffer: Buffer,
        canvasId: string,
        type: 'thumbnail' | 'preview'
    ): Promise<string> {
        const filename = `${canvasId}_${type}_${Date.now()}.png`;
        const filepath = path.join(this.STORAGE_PATH, filename);

        await fs.writeFile(filepath, buffer);
        return filepath;
    }

    /**
     * Ensure storage directory exists
     */
    private static async ensureStorageDirectory(): Promise<void> {
        try {
            await fs.access(this.STORAGE_PATH);
        } catch {
            await fs.mkdir(this.STORAGE_PATH, { recursive: true });
        }
    }

    /**
     * Convert file path to public URL
     */
    private static getPublicUrl(filepath: string): string {
        const filename = path.basename(filepath);
        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
        return `${baseUrl}/api/canvas/thumbnails/${filename}`;
    }

    /**
     * Clean up old thumbnails for a canvas
     */
    static async cleanupOldThumbnails(canvasId: string): Promise<void> {
        try {
            const files = await fs.readdir(this.STORAGE_PATH);
            const canvasFiles = files.filter(file => file.startsWith(`${canvasId}_`));

            // Keep only the most recent thumbnail and preview
            const thumbnails = canvasFiles.filter(f => f.includes('_thumbnail_')).sort().reverse();
            const previews = canvasFiles.filter(f => f.includes('_preview_')).sort().reverse();

            // Delete old thumbnails (keep most recent)
            for (const file of thumbnails.slice(1)) {
                await fs.unlink(path.join(this.STORAGE_PATH, file));
            }

            // Delete old previews (keep most recent)
            for (const file of previews.slice(1)) {
                await fs.unlink(path.join(this.STORAGE_PATH, file));
            }
        } catch (error) {
            console.error('Failed to cleanup old thumbnails:', error);
        }
    }

    /**
     * Check if thumbnail needs regeneration
     */
    static thumbnailNeedsUpdate(
        canvas: Canvas,
        lastObjectUpdate: number
    ): boolean {
        if (!canvas.thumbnailUrl) {
            return true;
        }

        // If objects were updated after thumbnail was last generated
        if (lastObjectUpdate > canvas.updatedAt) {
            return true;
        }

        // If thumbnail is older than max age
        const thumbnailAge = Date.now() - canvas.updatedAt;
        if (thumbnailAge > THUMBNAIL_CONFIG.maxAge) {
            return true;
        }

        return false;
    }
}

/**
 * Canvas validation utilities
 */
export class CanvasValidator {
    /**
     * Validate canvas name
     */
    static validateName(name: string): { valid: boolean; error?: string } {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'Canvas name is required' };
        }
        if (name.length > 255) {
            return { valid: false, error: 'Canvas name must be less than 255 characters' };
        }
        if (name.includes('/') || name.includes('\\')) {
            return { valid: false, error: 'Canvas name cannot contain path separators' };
        }
        return { valid: true };
    }

    /**
     * Validate canvas description
     */
    static validateDescription(description?: string): { valid: boolean; error?: string } {
        if (description && description.length > 1000) {
            return { valid: false, error: 'Canvas description must be less than 1000 characters' };
        }
        return { valid: true };
    }

    /**
     * Validate canvas tags
     */
    static validateTags(tags?: string[]): { valid: boolean; error?: string } {
        if (!tags) {
            return { valid: true };
        }

        if (tags.length > 10) {
            return { valid: false, error: 'Maximum 10 tags allowed' };
        }

        for (const tag of tags) {
            if (tag.length > 50) {
                return { valid: false, error: 'Each tag must be less than 50 characters' };
            }
            if (!/^[a-zA-Z0-9\-_\s]+$/.test(tag)) {
                return { valid: false, error: 'Tags can only contain letters, numbers, hyphens, underscores, and spaces' };
            }
        }

        return { valid: true };
    }
}

/**
 * Canvas state utilities
 */
export class CanvasStateUtils {
    /**
     * Get collection name for canvas objects
     */
    static getObjectCollectionName(canvasId: string): string {
        return `canvas_objects_${canvasId}`;
    }

    /**
     * Get collection name for canvas permissions
     */
    static getPermissionCollectionName(canvasId: string): string {
        return `canvas_permissions_${canvasId}`;
    }

    /**
     * Get collection name for canvas presence
     */
    static getPresenceCollectionName(canvasId: string): string {
        return `canvas_presence_${canvasId}`;
    }

    /**
     * Generate room ID for WebSocket namespace
     */
    static getWebSocketRoomId(canvasId: string): string {
        return `canvas:${canvasId}`;
    }

    /**
     * Calculate canvas statistics
     */
    static calculateStats(objects: CanvasObject[]): {
        objectCount: number;
        lastActivity: number;
        objectTypes: Record<string, number>;
        bounds?: { width: number; height: number };
    } {
        const stats = {
            objectCount: objects.length,
            lastActivity: Math.max(...objects.map(obj => obj.updatedAt), 0),
            objectTypes: {
                rectangle: 0,
                circle: 0,
                text: 0
            },
            bounds: undefined as { width: number; height: number } | undefined
        };

        objects.forEach(obj => {
            stats.objectTypes[obj.type]++;
        });

        if (objects.length > 0) {
            const bounds = CanvasThumbnailGenerator['calculateCanvasBounds'](objects);
            stats.bounds = {
                width: bounds.width,
                height: bounds.height
            };
        }

        return stats;
    }
}
