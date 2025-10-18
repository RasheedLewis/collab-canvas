import { CanvasPersistenceService } from '../services/persistenceService';
import { WebSocketConnectionManager } from '../websocket/connectionHandler';

// Get singleton instances - these should be injected in a real app
let persistenceService: CanvasPersistenceService;
let wsManager: WebSocketConnectionManager;

// Initialize services (to be called from main app)
export function initializeCanvasToolServices(
    persistence: CanvasPersistenceService,
    websocket: WebSocketConnectionManager
) {
    persistenceService = persistence;
    wsManager = websocket;
}

// Tool execution context
interface ToolContext {
    roomId: string;
    userId: string;
    canvasState: any;
    [key: string]: any;
}

// Utility function to generate unique IDs
function generateObjectId(): string {
    return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Utility function to broadcast object updates
function broadcastObjectUpdate(roomId: string, userId: string, messageType: string, object: any) {
    if (wsManager) {
        wsManager.broadcastToRoom(roomId, {
            type: messageType,
            payload: { ...object, userId }
        });
    }
}

/**
 * CREATION TOOLS
 */

export async function createRectangle(context: ToolContext): Promise<any> {
    const {
        x, y, width, height,
        color = '#3B82F6',
        strokeColor = '#1E40AF',
        strokeWidth = 2,
        roomId, userId
    } = context;

    // Input validation
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error('Position coordinates (x, y) must be numbers');
    }
    if (typeof width !== 'number' || width <= 0) {
        throw new Error('Width must be a positive number');
    }
    if (typeof height !== 'number' || height <= 0) {
        throw new Error('Height must be a positive number');
    }
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error('Color must be a valid hex color (e.g., #3B82F6)');
    }
    if (strokeColor && !/^#[0-9A-Fa-f]{6}$/.test(strokeColor)) {
        throw new Error('Stroke color must be a valid hex color (e.g., #1E40AF)');
    }

    const rectangle = {
        id: generateObjectId(),
        type: 'rectangle' as const,
        x: Number(x),
        y: Number(y),
        width: Number(width),
        height: Number(height),
        color: color, // Use color field as expected by interface
        fill: color,
        stroke: strokeColor,
        strokeWidth: Number(strokeWidth),
        rotation: 0,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    // Save to persistence
    await persistenceService.createOrUpdateObject(roomId, rectangle);

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_created', rectangle);

    return {
        success: true,
        objectId: rectangle.id,
        object: rectangle,
        message: `Created rectangle (${width}×${height}) at position (${x}, ${y})`
    };
}

export async function createCircle(context: ToolContext): Promise<any> {
    const {
        x, y, radius,
        color = '#10B981',
        strokeColor = '#047857',
        strokeWidth = 2,
        roomId, userId
    } = context;

    // Input validation
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error('Position coordinates (x, y) must be numbers');
    }
    if (typeof radius !== 'number' || radius <= 0) {
        throw new Error('Radius must be a positive number');
    }
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error('Color must be a valid hex color (e.g., #10B981)');
    }
    if (strokeColor && !/^#[0-9A-Fa-f]{6}$/.test(strokeColor)) {
        throw new Error('Stroke color must be a valid hex color (e.g., #047857)');
    }

    const circle = {
        id: generateObjectId(),
        type: 'circle' as const,
        x: Number(x),
        y: Number(y),
        radius: Number(radius),
        color: color, // Use color field as expected by interface
        fill: color,
        stroke: strokeColor,
        strokeWidth: Number(strokeWidth),
        rotation: 0,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    // Save to persistence
    await persistenceService.createOrUpdateObject(roomId, circle);

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_created', circle);

    return {
        success: true,
        objectId: circle.id,
        object: circle,
        message: `Created circle (radius ${radius}) at position (${x}, ${y})`
    };
}

export async function createText(context: ToolContext): Promise<any> {
    const {
        x, y, text,
        fontSize = 16,
        color = '#1F2937',
        fontFamily = 'Arial',
        roomId, userId
    } = context;

    // Input validation
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error('Position coordinates (x, y) must be numbers');
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Text content must be a non-empty string');
    }
    if (typeof fontSize !== 'number' || fontSize <= 0 || fontSize > 200) {
        throw new Error('Font size must be a positive number between 1 and 200');
    }
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error('Color must be a valid hex color (e.g., #1F2937)');
    }
    if (fontFamily && typeof fontFamily !== 'string') {
        throw new Error('Font family must be a string');
    }

    const textObject = {
        id: generateObjectId(),
        type: 'text' as const,
        x: Number(x),
        y: Number(y),
        text: String(text),
        fontSize: Number(fontSize),
        fontFamily,
        color: color, // Use color field as expected by interface
        fill: color,
        rotation: 0,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    // Save to persistence
    await persistenceService.createOrUpdateObject(roomId, textObject);

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_created', textObject);

    return {
        success: true,
        objectId: textObject.id,
        object: textObject,
        message: `Created text "${text}" at position (${x}, ${y})`
    };
}

/**
 * MANIPULATION TOOLS
 */

export async function moveObject(context: ToolContext): Promise<any> {
    const { objectId, x, y, roomId, userId } = context;

    // Input validation
    if (!objectId || typeof objectId !== 'string') {
        throw new Error('Object ID must be a valid string');
    }
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error('Position coordinates (x, y) must be numbers');
    }
    if (isNaN(x) || isNaN(y)) {
        throw new Error('Position coordinates must be valid numbers');
    }
    if (x < 0 || y < 0) {
        throw new Error('Position coordinates must be non-negative');
    }
    if (x > 10000 || y > 10000) {
        throw new Error('Position coordinates must be within canvas bounds (max 10000)');
    }

    // Get current canvas state
    const canvasState = await persistenceService.getCanvasState(roomId);
    if (!canvasState) {
        throw new Error(`Room "${roomId}" not found`);
    }

    const objectIndex = canvasState.objects.findIndex((obj: any) => obj.id === objectId);

    if (objectIndex === -1) {
        throw new Error(`Object with ID "${objectId}" not found`);
    }

    const currentObject = canvasState.objects[objectIndex];
    const updatedObject = {
        ...currentObject,
        x: Number(x),
        y: Number(y),
        updatedBy: userId,
        updatedAt: Date.now()
    };

    // Update in persistence
    await persistenceService.updateObject(roomId, objectId, { x: Number(x), y: Number(y) });

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_moved', updatedObject);

    return {
        success: true,
        objectId,
        objectType: currentObject.type,
        previousPosition: { x: currentObject.x, y: currentObject.y },
        newPosition: { x: Number(x), y: Number(y) },
        message: `Moved ${currentObject.type} object from (${currentObject.x}, ${currentObject.y}) to (${x}, ${y})`
    };
}

export async function resizeObject(context: ToolContext): Promise<any> {
    const { objectId, width, height, radius, fontSize, roomId, userId } = context;

    // Input validation
    if (!objectId || typeof objectId !== 'string') {
        throw new Error('Object ID must be a valid string');
    }

    // Get current canvas state
    const canvasState = await persistenceService.getCanvasState(roomId);
    if (!canvasState) {
        throw new Error(`Room "${roomId}" not found`);
    }

    const objectIndex = canvasState.objects.findIndex((obj: any) => obj.id === objectId);

    if (objectIndex === -1) {
        throw new Error(`Object with ID "${objectId}" not found`);
    }

    const currentObject = canvasState.objects[objectIndex];
    let updateData: any = {};
    let resizeDescription = '';

    // Handle different object types with validation
    if (currentObject.type === 'rectangle') {
        if (width !== undefined) {
            if (typeof width !== 'number' || width <= 0) {
                throw new Error('Width must be a positive number');
            }
            if (width > 5000) {
                throw new Error('Width must be within reasonable bounds (max 5000)');
            }
            updateData.width = Number(width);
        }
        if (height !== undefined) {
            if (typeof height !== 'number' || height <= 0) {
                throw new Error('Height must be a positive number');
            }
            if (height > 5000) {
                throw new Error('Height must be within reasonable bounds (max 5000)');
            }
            updateData.height = Number(height);
        }

        if (Object.keys(updateData).length === 0) {
            throw new Error('At least width or height must be specified for rectangle resize');
        }

        resizeDescription = `width: ${updateData.width || currentObject.width}, height: ${updateData.height || currentObject.height}`;

    } else if (currentObject.type === 'circle') {
        if (radius !== undefined) {
            if (typeof radius !== 'number' || radius <= 0) {
                throw new Error('Radius must be a positive number');
            }
            if (radius > 2500) {
                throw new Error('Radius must be within reasonable bounds (max 2500)');
            }
            updateData.radius = Number(radius);
            resizeDescription = `radius: ${radius}`;
        } else {
            throw new Error('Radius must be specified for circle resize');
        }

    } else if (currentObject.type === 'text') {
        if (fontSize !== undefined) {
            if (typeof fontSize !== 'number' || fontSize <= 0) {
                throw new Error('Font size must be a positive number');
            }
            if (fontSize > 200 || fontSize < 8) {
                throw new Error('Font size must be between 8 and 200 pixels');
            }
            updateData.fontSize = Number(fontSize);
            resizeDescription = `fontSize: ${fontSize}px`;
        }

        // Text can also have width/height for bounding box
        if (width !== undefined) {
            if (typeof width !== 'number' || width <= 0) {
                throw new Error('Width must be a positive number');
            }
            updateData.width = Number(width);
        }
        if (height !== undefined) {
            if (typeof height !== 'number' || height <= 0) {
                throw new Error('Height must be a positive number');
            }
            updateData.height = Number(height);
        }

        if (Object.keys(updateData).length === 0) {
            throw new Error('At least fontSize, width, or height must be specified for text resize');
        }

        if (!resizeDescription) {
            resizeDescription = `width: ${updateData.width || 'auto'}, height: ${updateData.height || 'auto'}`;
        }

    } else {
        throw new Error(`Resize not supported for object type: ${(currentObject as any).type}`);
    }

    const updatedObject = {
        ...currentObject,
        ...updateData,
        updatedBy: userId,
        updatedAt: Date.now()
    };

    // Update in persistence
    await persistenceService.updateObject(roomId, objectId, updateData);

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_resized', updatedObject);

    return {
        success: true,
        objectId,
        objectType: currentObject.type,
        previousSize: {
            ...((currentObject as any).width && { width: (currentObject as any).width }),
            ...((currentObject as any).height && { height: (currentObject as any).height }),
            ...((currentObject as any).radius && { radius: (currentObject as any).radius }),
            ...((currentObject as any).fontSize && { fontSize: (currentObject as any).fontSize })
        },
        newSize: updateData,
        message: `Resized ${currentObject.type} object: ${resizeDescription}`
    };
}

export async function rotateObject(context: ToolContext): Promise<any> {
    const { objectId, rotation, roomId, userId } = context;

    // Input validation
    if (!objectId || typeof objectId !== 'string') {
        throw new Error('Object ID must be a valid string');
    }
    if (typeof rotation !== 'number') {
        throw new Error('Rotation must be a number');
    }
    if (isNaN(rotation)) {
        throw new Error('Rotation must be a valid number');
    }

    // Normalize rotation to 0-360 degrees
    let normalizedRotation = rotation % 360;
    if (normalizedRotation < 0) {
        normalizedRotation += 360;
    }

    // Get current canvas state
    const canvasState = await persistenceService.getCanvasState(roomId);
    if (!canvasState) {
        throw new Error(`Room "${roomId}" not found`);
    }

    const objectIndex = canvasState.objects.findIndex((obj: any) => obj.id === objectId);

    if (objectIndex === -1) {
        throw new Error(`Object with ID "${objectId}" not found`);
    }

    const currentObject = canvasState.objects[objectIndex];
    const previousRotation = currentObject.rotation || 0;

    const updatedObject = {
        ...currentObject,
        rotation: normalizedRotation,
        updatedBy: userId,
        updatedAt: Date.now()
    };

    // Update in persistence
    await persistenceService.updateObject(roomId, objectId, { rotation: normalizedRotation });

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_rotated', updatedObject);

    return {
        success: true,
        objectId,
        objectType: currentObject.type,
        previousRotation: previousRotation,
        newRotation: normalizedRotation,
        rotationDelta: normalizedRotation - previousRotation,
        message: `Rotated ${currentObject.type} object from ${previousRotation}° to ${normalizedRotation}°`
    };
}

export async function deleteObject(context: ToolContext): Promise<any> {
    const { objectId, roomId, userId } = context;

    // Input validation
    if (!objectId || typeof objectId !== 'string') {
        throw new Error('Object ID must be a valid string');
    }
    if (objectId.trim().length === 0) {
        throw new Error('Object ID cannot be empty');
    }

    // Get current canvas state to verify object exists
    const canvasState = await persistenceService.getCanvasState(roomId);
    if (!canvasState) {
        throw new Error(`Room "${roomId}" not found`);
    }

    const objectIndex = canvasState.objects.findIndex((obj: any) => obj.id === objectId);

    if (objectIndex === -1) {
        throw new Error(`Object with ID "${objectId}" not found`);
    }

    const deletedObject = canvasState.objects[objectIndex];

    // Store object details for confirmation
    const objectDetails = {
        id: deletedObject.id,
        type: deletedObject.type,
        position: { x: deletedObject.x, y: deletedObject.y },
        ...((deletedObject as any).width && { width: (deletedObject as any).width }),
        ...((deletedObject as any).height && { height: (deletedObject as any).height }),
        ...((deletedObject as any).radius && { radius: (deletedObject as any).radius }),
        ...((deletedObject as any).text && { text: (deletedObject as any).text }),
        ...((deletedObject as any).fontSize && { fontSize: (deletedObject as any).fontSize }),
        createdBy: (deletedObject as any).createdBy,
        createdAt: deletedObject.createdAt
    };

    // Remove from persistence
    const deleteSuccess = await persistenceService.deleteObject(roomId, objectId);

    if (!deleteSuccess) {
        throw new Error(`Failed to delete object "${objectId}" from persistence`);
    }

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_deleted', {
        id: objectId,
        deletedBy: userId,
        deletedAt: Date.now()
    });

    return {
        success: true,
        objectId,
        objectType: deletedObject.type,
        deletedObject: objectDetails,
        deletedBy: userId,
        deletedAt: Date.now(),
        message: `Deleted ${deletedObject.type} object "${objectId}" at position (${deletedObject.x}, ${deletedObject.y})`
    };
}

/**
 * QUERY TOOLS
 */

export async function getCanvasState(context: ToolContext): Promise<any> {
    const { roomId } = context;

    const canvasState = await persistenceService.getCanvasState(roomId) || { roomId, objects: [], lastUpdated: Date.now(), version: 1 };

    return {
        success: true,
        roomId,
        objectCount: canvasState.objects.length,
        objects: canvasState.objects,
        message: `Retrieved canvas state with ${canvasState.objects.length} objects`
    };
}

export async function findObjects(context: ToolContext): Promise<any> {
    const { roomId, type, color, text } = context;

    const canvasState = await persistenceService.getCanvasState(roomId) || { roomId, objects: [], lastUpdated: Date.now(), version: 1 };
    let filteredObjects = canvasState.objects;

    // Filter by type
    if (type) {
        filteredObjects = filteredObjects.filter((obj: any) => obj.type === type);
    }

    // Filter by color (fill or stroke)
    if (color) {
        filteredObjects = filteredObjects.filter((obj: any) =>
            obj.fill === color || obj.stroke === color
        );
    }

    // Filter by text content
    if (text) {
        filteredObjects = filteredObjects.filter((obj: any) =>
            obj.type === 'text' && obj.text && obj.text.toLowerCase().includes(text.toLowerCase())
        );
    }

    return {
        success: true,
        matchCount: filteredObjects.length,
        objects: filteredObjects,
        filters: { type, color, text },
        message: `Found ${filteredObjects.length} objects matching criteria`
    };
}

export async function getCanvasBounds(context: ToolContext): Promise<any> {
    const { roomId } = context;

    const canvasState = await persistenceService.getCanvasState(roomId) || { roomId, objects: [], lastUpdated: Date.now(), version: 1 };

    if (canvasState.objects.length === 0) {
        return {
            success: true,
            bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
            message: 'Canvas is empty'
        };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    canvasState.objects.forEach((obj: any) => {
        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);

        if (obj.type === 'rectangle') {
            maxX = Math.max(maxX, obj.x + obj.width);
            maxY = Math.max(maxY, obj.y + obj.height);
        } else if (obj.type === 'circle') {
            maxX = Math.max(maxX, obj.x + obj.radius * 2);
            maxY = Math.max(maxY, obj.y + obj.radius * 2);
        } else if (obj.type === 'text') {
            // Approximate text bounds
            const estimatedWidth = obj.text.length * (obj.fontSize * 0.6);
            const estimatedHeight = obj.fontSize * 1.2;
            maxX = Math.max(maxX, obj.x + estimatedWidth);
            maxY = Math.max(maxY, obj.y + estimatedHeight);
        }
    });

    const bounds = {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY
    };

    return {
        success: true,
        bounds,
        objectCount: canvasState.objects.length,
        message: `Canvas bounds: ${bounds.width}×${bounds.height}`
    };
}

/**
 * LAYOUT TOOLS
 */

export async function arrangeObjectsInRow(context: ToolContext): Promise<any> {
    const { objectIds, startX, startY, spacing = 50, roomId, userId } = context;

    if (!Array.isArray(objectIds) || objectIds.length === 0) {
        throw new Error('At least one object ID is required');
    }

    const canvasState = await persistenceService.getCanvasState(roomId);
    if (!canvasState) {
        throw new Error(`Room "${roomId}" not found`);
    }

    const updatedObjects = [];
    let currentX = Number(startX);

    for (let i = 0; i < objectIds.length; i++) {
        const objectId = objectIds[i];
        const objectIndex = canvasState.objects.findIndex((obj: any) => obj.id === objectId);

        if (objectIndex !== -1) {
            const updatedObject = {
                ...canvasState.objects[objectIndex],
                x: currentX,
                y: Number(startY),
                updatedBy: userId,
                updatedAt: Date.now()
            };

            await persistenceService.updateObject(roomId, objectId, { x: currentX, y: Number(startY) });
            broadcastObjectUpdate(roomId, userId, 'object_updated', updatedObject);

            updatedObjects.push(updatedObject);
            currentX += Number(spacing);
        }
    }

    return {
        success: true,
        arrangedCount: updatedObjects.length,
        objects: updatedObjects,
        message: `Arranged ${updatedObjects.length} objects in a row`
    };
}

export async function clearCanvas(context: ToolContext): Promise<any> {
    const { roomId, userId } = context;

    // Clear from persistence
    await persistenceService.clearRoom(roomId);

    // Broadcast to other clients
    if (wsManager) {
        wsManager.broadcastToRoom(roomId, {
            type: 'canvas_cleared',
            payload: { roomId, userId }
        });
    }

    return {
        success: true,
        message: 'Canvas cleared successfully'
    };
}

// Export all tool handlers
export const CANVAS_TOOL_HANDLERS = {
    createRectangle,
    createCircle,
    createText,
    moveObject,
    resizeObject,
    rotateObject,
    deleteObject,
    getCanvasState,
    findObjects,
    getCanvasBounds,
    arrangeObjectsInRow,
    clearCanvas
};
