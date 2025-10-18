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
    const { x, y, width, height, fill = '#3B82F6', stroke = '#1E40AF', roomId, userId } = context;

    const rectangle = {
        id: generateObjectId(),
        type: 'rectangle' as const,
        x: Number(x),
        y: Number(y),
        width: Number(width),
        height: Number(height),
        color: fill, // Use color field as expected by interface
        fill,
        stroke,
        strokeWidth: 2,
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
    const { x, y, radius, fill = '#10B981', stroke = '#047857', roomId, userId } = context;

    const circle = {
        id: generateObjectId(),
        type: 'circle' as const,
        x: Number(x),
        y: Number(y),
        radius: Number(radius),
        color: fill, // Use color field as expected by interface
        fill,
        stroke,
        strokeWidth: 2,
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
    const { x, y, text, fontSize = 16, fill = '#1F2937', fontFamily = 'Arial', roomId, userId } = context;

    const textObject = {
        id: generateObjectId(),
        type: 'text' as const,
        x: Number(x),
        y: Number(y),
        text: String(text),
        fontSize: Number(fontSize),
        fontFamily,
        color: fill, // Use color field as expected by interface
        fill,
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

    // Get current canvas state
    const canvasState = await persistenceService.getCanvasState(roomId);
    if (!canvasState) {
        throw new Error(`Room "${roomId}" not found`);
    }

    const objectIndex = canvasState.objects.findIndex((obj: any) => obj.id === objectId);

    if (objectIndex === -1) {
        throw new Error(`Object with ID "${objectId}" not found`);
    }

    const updatedObject = {
        ...canvasState.objects[objectIndex],
        x: Number(x),
        y: Number(y),
        updatedBy: userId,
        updatedAt: new Date().toISOString()
    };

    // Update in persistence
    await persistenceService.updateObject(roomId, objectId, { x: Number(x), y: Number(y) });

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_updated', updatedObject);

    return {
        success: true,
        objectId,
        newPosition: { x: Number(x), y: Number(y) },
        message: `Moved object to position (${x}, ${y})`
    };
}

export async function resizeObject(context: ToolContext): Promise<any> {
    const { objectId, width, height, roomId, userId } = context;

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

    // Handle different object types
    if (currentObject.type === 'rectangle' || currentObject.type === 'text') {
        updateData = {
            width: Number(width),
            height: Number(height)
        };
    } else if (currentObject.type === 'circle') {
        // For circles, use width as diameter (radius = width/2)
        updateData = {
            radius: Number(width) / 2
        };
    }

    const updatedObject = {
        ...currentObject,
        ...updateData,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
    };

    // Update in persistence
    await persistenceService.updateObject(roomId, objectId, updateData);

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_updated', updatedObject);

    return {
        success: true,
        objectId,
        newSize: updateData,
        message: `Resized ${currentObject.type} object`
    };
}

export async function rotateObject(context: ToolContext): Promise<any> {
    const { objectId, rotation, roomId, userId } = context;

    // Get current canvas state
    const canvasState = await persistenceService.getCanvasState(roomId);
    if (!canvasState) {
        throw new Error(`Room "${roomId}" not found`);
    }

    const objectIndex = canvasState.objects.findIndex((obj: any) => obj.id === objectId);

    if (objectIndex === -1) {
        throw new Error(`Object with ID "${objectId}" not found`);
    }

    const updatedObject = {
        ...canvasState.objects[objectIndex],
        rotation: Number(rotation),
        updatedBy: userId,
        updatedAt: new Date().toISOString()
    };

    // Update in persistence
    await persistenceService.updateObject(roomId, objectId, { rotation: Number(rotation) });

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_rotated', updatedObject);

    return {
        success: true,
        objectId,
        newRotation: Number(rotation),
        message: `Rotated object to ${rotation} degrees`
    };
}

export async function deleteObject(context: ToolContext): Promise<any> {
    const { objectId, roomId, userId } = context;

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

    // Remove from persistence
    await persistenceService.deleteObject(roomId, objectId);

    // Broadcast to other clients
    broadcastObjectUpdate(roomId, userId, 'object_deleted', { id: objectId });

    return {
        success: true,
        objectId,
        deletedObject,
        message: `Deleted ${deletedObject.type} object`
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
