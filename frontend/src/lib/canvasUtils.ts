import type { RectangleObject, CircleObject, TextObject, CanvasObject } from '../types/canvas';

export interface ViewportInfo {
    x: number;
    y: number;
    scale: number;
    width: number;
    height: number;
}

/**
 * Calculate viewport information for infinite canvas bounds
 */
export function calculateViewport(
    position: { x: number; y: number },
    scale: number,
    canvasWidth: number,
    canvasHeight: number
): ViewportInfo {
    return {
        x: position.x,
        y: position.y,
        scale,
        width: canvasWidth / scale,
        height: canvasHeight / scale,
    };
}

/**
 * Generate a unique ID for canvas objects
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a shape object with the specified parameters
 */
export function createShape(
    type: 'rectangle',
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
): RectangleObject;
export function createShape(
    type: 'circle',
    x: number,
    y: number,
    radius: number,
    _unused?: undefined,
    color?: string
): CircleObject;
export function createShape(
    type: 'rectangle' | 'circle',
    x: number,
    y: number,
    widthOrRadius: number,
    heightOrUndefined?: number,
    color?: string
): RectangleObject | CircleObject {
    const now = Date.now();

    if (type === 'rectangle') {
        return {
            id: generateId(),
            type: 'rectangle',
            x,
            y,
            width: widthOrRadius,
            height: heightOrUndefined!,
            color: color!,
            createdAt: now,
            updatedAt: now,
        };
    } else {
        return {
            id: generateId(),
            type: 'circle',
            x,
            y,
            radius: widthOrRadius,
            color: color || '#3b82f6',
            createdAt: now,
            updatedAt: now,
        };
    }
}

/**
 * Create a text object with the specified parameters
 */
export function createTextObject(
    x: number,
    y: number,
    text: string,
    fontSize: number,
    color: string
): TextObject {
    const now = Date.now();

    return {
        id: generateId(),
        type: 'text',
        x,
        y,
        text,
        fontSize,
        fontFamily: 'Arial, sans-serif',
        color,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Update a text object with new properties
 */
export function updateTextObject(
    textObj: Partial<TextObject>,
    newText?: string,
    newFontSize?: number,
    newColor?: string
): TextObject {
    return {
        ...textObj,
        text: newText ?? textObj.text ?? 'Text',
        fontSize: newFontSize ?? textObj.fontSize ?? 16,
        color: newColor ?? textObj.color ?? '#000000',
        updatedAt: Date.now(),
    } as TextObject;
}

/**
 * Calculate the bounding box for a canvas object
 */
export function getBoundingBox(obj: CanvasObject): { x: number; y: number; width: number; height: number } {
    switch (obj.type) {
        case 'rectangle':
            return {
                x: obj.x,
                y: obj.y,
                width: obj.width,
                height: obj.height,
            };
        case 'circle':
            return {
                x: obj.x - obj.radius,
                y: obj.y - obj.radius,
                width: obj.radius * 2,
                height: obj.radius * 2,
            };
        case 'text':
            // Approximate text dimensions based on font size
            const charWidth = obj.fontSize * 0.6;
            const lineHeight = obj.fontSize * 1.2;
            const lines = obj.text.split('\n');
            const maxLineLength = Math.max(...lines.map(line => line.length));

            return {
                x: obj.x,
                y: obj.y,
                width: maxLineLength * charWidth,
                height: lines.length * lineHeight,
            };
        default:
            return { x: 0, y: 0, width: 0, height: 0 };
    }
}

/**
 * Check if a point is inside a canvas object
 */
export function isPointInside(obj: CanvasObject, x: number, y: number): boolean {
    const bbox = getBoundingBox(obj);

    if (obj.type === 'circle') {
        // For circles, use proper distance calculation
        const dx = x - obj.x;
        const dy = y - obj.y;
        return Math.sqrt(dx * dx + dy * dy) <= (obj as CircleObject).radius;
    }

    // For rectangles and text, use bounding box
    return (
        x >= bbox.x &&
        x <= bbox.x + bbox.width &&
        y >= bbox.y &&
        y <= bbox.y + bbox.height
    );
}

/**
 * Convert screen coordinates to canvas coordinates
 */
export function screenToCanvas(
    screenX: number,
    screenY: number,
    stageX: number,
    stageY: number,
    scale: number
): { x: number; y: number } {
    return {
        x: (screenX - stageX) / scale,
        y: (screenY - stageY) / scale,
    };
}

/**
 * Convert canvas coordinates to screen coordinates
 */
export function canvasToScreen(
    canvasX: number,
    canvasY: number,
    stageX: number,
    stageY: number,
    scale: number
): { x: number; y: number } {
    return {
        x: canvasX * scale + stageX,
        y: canvasY * scale + stageY,
    };
}
