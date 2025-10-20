/**
 * Thumbnail Service
 * 
 * Generates thumbnails and previews for canvases using server-side rendering.
 * Creates small image representations of canvas contents for discovery and listing.
 */

import { createCanvas, Canvas as NodeCanvas, CanvasRenderingContext2D } from 'canvas';
import { firestoreService } from '../database/firestoreService';
import {
    CanvasObject,
    RectangleObject,
    CircleObject,
    TextObject
} from '../../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

export interface ThumbnailOptions {
    width?: number;
    height?: number;
    backgroundColor?: string;
    quality?: number; // 0-1 for JPEG quality
    format?: 'png' | 'jpeg';
}

export interface ThumbnailResult {
    success: boolean;
    thumbnailUrl?: string;
    previewUrl?: string;
    buffer?: Buffer;
    error?: string;
    code?: string;
}

export interface CanvasBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
}

/**
 * Thumbnail Service - Singleton
 */
export class ThumbnailService {
    private static instance: ThumbnailService;

    // Default thumbnail settings
    private readonly defaultOptions: Required<ThumbnailOptions> = {
        width: 400,
        height: 300,
        backgroundColor: '#ffffff',
        quality: 0.8,
        format: 'jpeg'
    };

    // Storage paths (in production, would use cloud storage)
    private readonly thumbnailDir = path.join(process.cwd(), 'data', 'thumbnails');
    private readonly previewDir = path.join(process.cwd(), 'data', 'previews');

    private constructor() {
        this.ensureDirectories();
    }

    public static getInstance(): ThumbnailService {
        if (!ThumbnailService.instance) {
            ThumbnailService.instance = new ThumbnailService();
        }
        return ThumbnailService.instance;
    }

    /**
     * Ensure thumbnail directories exist
     */
    private ensureDirectories(): void {
        try {
            if (!fs.existsSync(this.thumbnailDir)) {
                fs.mkdirSync(this.thumbnailDir, { recursive: true });
            }
            if (!fs.existsSync(this.previewDir)) {
                fs.mkdirSync(this.previewDir, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create thumbnail directories:', error);
        }
    }

    /**
     * Generate thumbnail for a canvas
     */
    public async generateCanvasThumbnail(
        canvasId: string,
        options: ThumbnailOptions = {}
    ): Promise<ThumbnailResult> {
        try {
            const opts = { ...this.defaultOptions, ...options };

            // Get canvas objects
            const objectsResult = await firestoreService.getCanvasObjects(canvasId);
            if (!objectsResult.success) {
                return {
                    success: false,
                    error: objectsResult.error,
                    code: objectsResult.code
                };
            }

            const objects = objectsResult.data!;

            if (objects.length === 0) {
                // Generate empty canvas thumbnail
                return await this.generateEmptyCanvasThumbnail(canvasId, opts);
            }

            // Calculate canvas bounds from objects
            const bounds = this.calculateCanvasBounds(objects);

            // Create canvas and render objects
            const canvas = createCanvas(opts.width, opts.height);
            const ctx = canvas.getContext('2d');

            // Set background
            ctx.fillStyle = opts.backgroundColor;
            ctx.fillRect(0, 0, opts.width, opts.height);

            // Calculate scale to fit all objects
            const scale = this.calculateOptimalScale(bounds, opts.width, opts.height);
            const offsetX = (opts.width - bounds.width * scale) / 2 - bounds.minX * scale;
            const offsetY = (opts.height - bounds.height * scale) / 2 - bounds.minY * scale;

            // Render each object
            for (const obj of objects) {
                await this.renderObject(ctx, obj, scale, offsetX, offsetY);
            }

            // Save thumbnail
            const buffer = this.canvasToBuffer(canvas, opts);
            const thumbnailPath = await this.saveThumbnail(canvasId, buffer, 'thumbnail', opts.format);

            // Generate smaller preview
            const previewCanvas = createCanvas(200, 150);
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.drawImage(canvas, 0, 0, 200, 150);
            const previewBuffer = this.canvasToBuffer(previewCanvas, { ...opts, width: 200, height: 150 });
            const previewPath = await this.saveThumbnail(canvasId, previewBuffer, 'preview', opts.format);

            return {
                success: true,
                thumbnailUrl: `/api/thumbnails/${canvasId}/thumbnail.${opts.format}`,
                previewUrl: `/api/thumbnails/${canvasId}/preview.${opts.format}`,
                buffer
            };

        } catch (error) {
            console.error('Error generating canvas thumbnail:', error);
            return {
                success: false,
                error: 'Failed to generate thumbnail',
                code: 'THUMBNAIL_GENERATION_ERROR'
            };
        }
    }

    /**
     * Generate thumbnail for empty canvas
     */
    private async generateEmptyCanvasThumbnail(
        canvasId: string,
        options: Required<ThumbnailOptions>
    ): Promise<ThumbnailResult> {
        const canvas = createCanvas(options.width, options.height);
        const ctx = canvas.getContext('2d');

        // Set background
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, options.width, options.height);

        // Draw empty state indicator
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.strokeRect(20, 20, options.width - 40, options.height - 40);

        // Add "Empty Canvas" text
        ctx.fillStyle = '#888888';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Empty Canvas', options.width / 2, options.height / 2);

        const buffer = this.canvasToBuffer(canvas, options);
        await this.saveThumbnail(canvasId, buffer, 'thumbnail', options.format);

        // Create preview
        const previewCanvas = createCanvas(200, 150);
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.drawImage(canvas, 0, 0, 200, 150);
        const previewBuffer = this.canvasToBuffer(previewCanvas, { ...options, width: 200, height: 150 });
        await this.saveThumbnail(canvasId, previewBuffer, 'preview', options.format);

        return {
            success: true,
            thumbnailUrl: `/api/thumbnails/${canvasId}/thumbnail.${options.format}`,
            previewUrl: `/api/thumbnails/${canvasId}/preview.${options.format}`,
            buffer
        };
    }

    /**
     * Calculate bounds of all objects in canvas
     */
    private calculateCanvasBounds(objects: CanvasObject[]): CanvasBounds {
        if (objects.length === 0) {
            return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
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
                    const rect = obj as RectangleObject;
                    objMaxX += rect.width;
                    objMaxY += rect.height;
                    break;

                case 'circle':
                    const circle = obj as CircleObject;
                    objMinX -= circle.radius;
                    objMinY -= circle.radius;
                    objMaxX += circle.radius;
                    objMaxY += circle.radius;
                    break;

                case 'text':
                    const text = obj as TextObject;
                    // Estimate text bounds (rough approximation)
                    const textWidth = text.text.length * (text.fontSize * 0.6);
                    const textHeight = text.fontSize * 1.2;
                    objMaxX += textWidth;
                    objMaxY += textHeight;
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
     * Calculate optimal scale to fit canvas bounds in thumbnail
     */
    private calculateOptimalScale(bounds: CanvasBounds, targetWidth: number, targetHeight: number): number {
        const scaleX = targetWidth / bounds.width;
        const scaleY = targetHeight / bounds.height;
        return Math.min(scaleX, scaleY, 1); // Don't scale up
    }

    /**
     * Render a canvas object on the thumbnail
     */
    private async renderObject(
        ctx: CanvasRenderingContext2D,
        obj: CanvasObject,
        scale: number,
        offsetX: number,
        offsetY: number
    ): Promise<void> {
        const x = obj.x * scale + offsetX;
        const y = obj.y * scale + offsetY;

        ctx.save();

        // Apply rotation if present
        if (obj.rotation && obj.rotation !== 0) {
            ctx.translate(x, y);
            ctx.rotate((obj.rotation * Math.PI) / 180);
            ctx.translate(-x, -y);
        }

        ctx.fillStyle = obj.color;
        ctx.strokeStyle = obj.color;

        switch (obj.type) {
            case 'rectangle':
                const rect = obj as RectangleObject;
                const width = rect.width * scale;
                const height = rect.height * scale;
                ctx.fillRect(x, y, width, height);

                // Add border for better visibility
                ctx.strokeStyle = this.darkenColor(obj.color);
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, width, height);
                break;

            case 'circle':
                const circle = obj as CircleObject;
                const radius = circle.radius * scale;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fill();

                // Add border
                ctx.strokeStyle = this.darkenColor(obj.color);
                ctx.lineWidth = 1;
                ctx.stroke();
                break;

            case 'text':
                const text = obj as TextObject;
                const fontSize = Math.max(8, (text.fontSize * scale)); // Minimum readable size
                ctx.font = `${text.fontStyle || 'normal'} ${fontSize}px ${text.fontFamily || 'Arial'}`;
                ctx.textBaseline = 'top';

                // Add text background for better readability
                const textMetrics = ctx.measureText(text.text);
                const textHeight = fontSize * 1.2;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillRect(x - 2, y - 2, textMetrics.width + 4, textHeight + 4);

                ctx.fillStyle = obj.color;
                ctx.fillText(text.text, x, y);
                break;
        }

        ctx.restore();
    }

    /**
     * Darken a color for borders/outlines
     */
    private darkenColor(color: string): string {
        // Simple darkening by reducing brightness
        if (color.startsWith('#') && color.length === 7) {
            const r = parseInt(color.substr(1, 2), 16);
            const g = parseInt(color.substr(3, 2), 16);
            const b = parseInt(color.substr(5, 2), 16);

            const factor = 0.8;
            const newR = Math.round(r * factor);
            const newG = Math.round(g * factor);
            const newB = Math.round(b * factor);

            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        }
        return color;
    }

    /**
     * Convert canvas to buffer
     */
    private canvasToBuffer(canvas: NodeCanvas, options: Required<ThumbnailOptions>): Buffer {
        if (options.format === 'png') {
            return canvas.toBuffer('image/png');
        } else {
            return canvas.toBuffer('image/jpeg', { quality: options.quality });
        }
    }

    /**
     * Save thumbnail to disk
     */
    private async saveThumbnail(
        canvasId: string,
        buffer: Buffer,
        type: 'thumbnail' | 'preview',
        format: string
    ): Promise<string> {
        const dir = type === 'thumbnail' ? this.thumbnailDir : this.previewDir;
        const canvasDir = path.join(dir, canvasId);

        // Ensure canvas directory exists
        if (!fs.existsSync(canvasDir)) {
            fs.mkdirSync(canvasDir, { recursive: true });
        }

        const filename = `${type}.${format}`;
        const filepath = path.join(canvasDir, filename);

        await fs.promises.writeFile(filepath, buffer);
        return filepath;
    }

    /**
     * Get thumbnail buffer if it exists
     */
    public async getThumbnailBuffer(
        canvasId: string,
        type: 'thumbnail' | 'preview' = 'thumbnail',
        format: string = 'jpeg'
    ): Promise<Buffer | null> {
        try {
            const dir = type === 'thumbnail' ? this.thumbnailDir : this.previewDir;
            const filepath = path.join(dir, canvasId, `${type}.${format}`);

            if (fs.existsSync(filepath)) {
                return await fs.promises.readFile(filepath);
            }
            return null;
        } catch (error) {
            console.error('Error reading thumbnail:', error);
            return null;
        }
    }

    /**
     * Delete thumbnails for a canvas
     */
    public async deleteThumbnails(canvasId: string): Promise<void> {
        try {
            const thumbnailDir = path.join(this.thumbnailDir, canvasId);
            const previewDir = path.join(this.previewDir, canvasId);

            if (fs.existsSync(thumbnailDir)) {
                await fs.promises.rmdir(thumbnailDir, { recursive: true });
            }

            if (fs.existsSync(previewDir)) {
                await fs.promises.rmdir(previewDir, { recursive: true });
            }
        } catch (error) {
            console.error('Error deleting thumbnails:', error);
        }
    }

    /**
     * Regenerate thumbnail when canvas changes
     */
    public async updateCanvasThumbnail(canvasId: string): Promise<ThumbnailResult> {
        // Delete existing thumbnails
        await this.deleteThumbnails(canvasId);

        // Generate new thumbnails
        return await this.generateCanvasThumbnail(canvasId);
    }

    /**
     * Batch generate thumbnails for multiple canvases
     */
    public async batchGenerateThumbnails(
        canvasIds: string[],
        options: ThumbnailOptions = {}
    ): Promise<Array<{ canvasId: string; result: ThumbnailResult }>> {
        const results: Array<{ canvasId: string; result: ThumbnailResult }> = [];

        // Process in small batches to avoid memory issues
        const batchSize = 5;
        for (let i = 0; i < canvasIds.length; i += batchSize) {
            const batch = canvasIds.slice(i, i + batchSize);

            const batchPromises = batch.map(async (canvasId) => {
                const result = await this.generateCanvasThumbnail(canvasId, options);
                return { canvasId, result };
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Small delay between batches
            if (i + batchSize < canvasIds.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return results;
    }
}
