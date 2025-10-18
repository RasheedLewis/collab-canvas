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
    const { roomId, includeMetadata = false } = context;

    // Input validation
    if (!roomId || typeof roomId !== 'string') {
        throw new Error('Room ID must be a valid string');
    }

    const canvasState = await persistenceService.getCanvasState(roomId) || {
        roomId,
        objects: [],
        lastUpdated: Date.now(),
        version: 1
    };

    // Calculate comprehensive canvas statistics
    const statistics = {
        objectCount: canvasState.objects.length,
        objectTypes: {} as Record<string, number>,
        colors: new Set<string>(),
        totalArea: 0,
        averageSize: 0,
        textObjects: 0,
        totalTextLength: 0
    };

    let totalObjectArea = 0;
    const objectDetails = canvasState.objects.map((obj: any) => {
        // Count object types
        statistics.objectTypes[obj.type] = (statistics.objectTypes[obj.type] || 0) + 1;

        // Collect colors
        if (obj.color) statistics.colors.add(obj.color);
        if (obj.fill) statistics.colors.add(obj.fill);
        if (obj.stroke) statistics.colors.add(obj.stroke);

        // Calculate object area and collect text stats
        let objectArea = 0;
        if (obj.type === 'rectangle') {
            objectArea = obj.width * obj.height;
        } else if (obj.type === 'circle') {
            objectArea = Math.PI * obj.radius * obj.radius;
        } else if (obj.type === 'text') {
            statistics.textObjects++;
            if (obj.text) {
                statistics.totalTextLength += obj.text.length;
            }
            // Estimate text area
            const estimatedWidth = (obj.text?.length || 0) * (obj.fontSize * 0.6);
            const estimatedHeight = obj.fontSize * 1.2;
            objectArea = estimatedWidth * estimatedHeight;
        }

        totalObjectArea += objectArea;

        // Return object with optional metadata
        const result: any = {
            id: obj.id,
            type: obj.type,
            position: { x: obj.x, y: obj.y },
            ...(obj.type === 'rectangle' && {
                dimensions: { width: obj.width, height: obj.height },
                area: obj.width * obj.height
            }),
            ...(obj.type === 'circle' && {
                radius: obj.radius,
                area: Math.PI * obj.radius * obj.radius
            }),
            ...(obj.type === 'text' && {
                text: obj.text,
                fontSize: obj.fontSize,
                fontFamily: obj.fontFamily || 'Arial'
            }),
            color: obj.color || obj.fill,
            ...(obj.stroke && { stroke: obj.stroke }),
            ...(obj.rotation && { rotation: obj.rotation })
        };

        if (includeMetadata) {
            result.metadata = {
                createdAt: obj.createdAt,
                updatedAt: obj.updatedAt,
                createdBy: (obj as any).createdBy,
                ...(obj.updatedBy && { updatedBy: obj.updatedBy })
            };
        }

        return result;
    });

    statistics.totalArea = totalObjectArea;
    statistics.averageSize = statistics.objectCount > 0 ? totalObjectArea / statistics.objectCount : 0;

    // Calculate canvas bounds
    let bounds = null;
    if (canvasState.objects.length > 0) {
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
                const estimatedWidth = (obj.text?.length || 0) * (obj.fontSize * 0.6);
                const estimatedHeight = obj.fontSize * 1.2;
                maxX = Math.max(maxX, obj.x + estimatedWidth);
                maxY = Math.max(maxY, obj.y + estimatedHeight);
            }
        });

        bounds = {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY,
            center: {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
            }
        };
    }

    return {
        success: true,
        result: {
            roomId,
            objectCount: statistics.objectCount,
            objects: objectDetails,
            statistics: {
                ...statistics,
                colors: Array.from(statistics.colors),
                averageTextLength: statistics.textObjects > 0 ?
                    Math.round(statistics.totalTextLength / statistics.textObjects) : 0
            },
            bounds,
            ...(includeMetadata && {
                canvasMetadata: {
                    lastUpdated: canvasState.lastUpdated,
                    version: canvasState.version
                }
            })
        },
        message: `Retrieved canvas state: ${statistics.objectCount} objects (${Object.entries(statistics.objectTypes).map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`).join(', ') || 'empty canvas'})`
    };
}

export async function findObjects(context: ToolContext): Promise<any> {
    const { roomId, type, color, text, area } = context;

    // Input validation
    if (!roomId || typeof roomId !== 'string') {
        throw new Error('Room ID must be a valid string');
    }

    const canvasState = await persistenceService.getCanvasState(roomId) || {
        roomId,
        objects: [],
        lastUpdated: Date.now(),
        version: 1
    };

    let filteredObjects = canvasState.objects;
    const appliedFilters: any = {};

    // Filter by type
    if (type) {
        if (!['rectangle', 'circle', 'text'].includes(type)) {
            throw new Error('Invalid object type. Must be "rectangle", "circle", or "text"');
        }
        filteredObjects = filteredObjects.filter((obj: any) => obj.type === type);
        appliedFilters.type = type;
    }

    // Filter by color (check color, fill, and stroke)
    if (color) {
        if (typeof color !== 'string') {
            throw new Error('Color must be a string');
        }
        filteredObjects = filteredObjects.filter((obj: any) =>
            obj.color === color || obj.fill === color || obj.stroke === color
        );
        appliedFilters.color = color;
    }

    // Filter by text content (case-insensitive partial match)
    if (text) {
        if (typeof text !== 'string') {
            throw new Error('Text search must be a string');
        }
        const searchText = text.toLowerCase();
        filteredObjects = filteredObjects.filter((obj: any) =>
            obj.type === 'text' && obj.text &&
            obj.text.toLowerCase().includes(searchText)
        );
        appliedFilters.text = text;
    }

    // Filter by area (bounding box search)
    if (area) {
        const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = area;

        // Validate area parameters
        if (typeof areaX !== 'number' || typeof areaY !== 'number' ||
            typeof areaWidth !== 'number' || typeof areaHeight !== 'number') {
            throw new Error('Area parameters (x, y, width, height) must be numbers');
        }
        if (areaWidth <= 0 || areaHeight <= 0) {
            throw new Error('Area width and height must be positive numbers');
        }

        const areaRight = areaX + areaWidth;
        const areaBottom = areaY + areaHeight;

        filteredObjects = filteredObjects.filter((obj: any) => {
            // Check if object intersects with the search area
            let objRight: number, objBottom: number;

            if (obj.type === 'rectangle') {
                objRight = obj.x + obj.width;
                objBottom = obj.y + obj.height;
            } else if (obj.type === 'circle') {
                objRight = obj.x + obj.radius * 2;
                objBottom = obj.y + obj.radius * 2;
            } else if (obj.type === 'text') {
                const estimatedWidth = (obj.text?.length || 0) * (obj.fontSize * 0.6);
                const estimatedHeight = obj.fontSize * 1.2;
                objRight = obj.x + estimatedWidth;
                objBottom = obj.y + estimatedHeight;
            } else {
                return false;
            }

            // Check for intersection
            return !(obj.x >= areaRight || objRight <= areaX ||
                obj.y >= areaBottom || objBottom <= areaY);
        });

        appliedFilters.area = { x: areaX, y: areaY, width: areaWidth, height: areaHeight };
    }

    // Enhance result objects with additional computed properties
    const enhancedObjects = filteredObjects.map((obj: any) => {
        const result: any = {
            id: obj.id,
            type: obj.type,
            position: { x: obj.x, y: obj.y },
            color: obj.color || obj.fill
        };

        // Add type-specific properties and calculated area
        if (obj.type === 'rectangle') {
            result.dimensions = { width: obj.width, height: obj.height };
            result.area = obj.width * obj.height;
        } else if (obj.type === 'circle') {
            result.radius = obj.radius;
            result.area = Math.PI * obj.radius * obj.radius;
        } else if (obj.type === 'text') {
            result.text = obj.text;
            result.fontSize = obj.fontSize;
            result.fontFamily = obj.fontFamily || 'Arial';
            const estimatedWidth = (obj.text?.length || 0) * (obj.fontSize * 0.6);
            const estimatedHeight = obj.fontSize * 1.2;
            result.estimatedArea = estimatedWidth * estimatedHeight;
        }

        // Add optional properties
        if (obj.stroke) result.stroke = obj.stroke;
        if (obj.rotation) result.rotation = obj.rotation;

        return result;
    });

    // Calculate search statistics
    const searchStats = {
        totalObjectsInCanvas: canvasState.objects.length,
        matchCount: filteredObjects.length,
        matchPercentage: canvasState.objects.length > 0 ?
            Math.round((filteredObjects.length / canvasState.objects.length) * 100) : 0,
        objectTypes: {} as Record<string, number>
    };

    // Count object types in results
    enhancedObjects.forEach(obj => {
        searchStats.objectTypes[obj.type] = (searchStats.objectTypes[obj.type] || 0) + 1;
    });

    return {
        success: true,
        result: {
            searchCriteria: appliedFilters,
            statistics: searchStats,
            objects: enhancedObjects
        },
        message: `Found ${filteredObjects.length} objects matching criteria${Object.keys(appliedFilters).length > 0 ?
            ` (${Object.entries(appliedFilters).map(([key, value]) =>
                typeof value === 'object' ? `${key}: ${JSON.stringify(value)}` : `${key}: ${value}`
            ).join(', ')})` : ''}`
    };
}

export async function getCanvasBounds(context: ToolContext): Promise<any> {
    const { roomId } = context;

    // Input validation
    if (!roomId || typeof roomId !== 'string') {
        throw new Error('Room ID must be a valid string');
    }

    const canvasState = await persistenceService.getCanvasState(roomId) || {
        roomId,
        objects: [],
        lastUpdated: Date.now(),
        version: 1
    };

    if (canvasState.objects.length === 0) {
        return {
            success: true,
            result: {
                roomId,
                objectCount: 0,
                bounds: {
                    minX: 0, minY: 0, maxX: 0, maxY: 0,
                    width: 0, height: 0,
                    center: { x: 0, y: 0 },
                    aspectRatio: 0
                },
                distribution: {
                    objectsByQuadrant: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
                    density: 0,
                    averageDistanceFromCenter: 0
                }
            },
            message: 'Canvas is empty - no bounds to calculate'
        };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const objectPositions: Array<{ x: number, y: number, centerX: number, centerY: number, area: number }> = [];

    // Calculate bounds and collect object data
    canvasState.objects.forEach((obj: any) => {
        let objCenterX: number, objCenterY: number, objArea: number;
        let objMaxX: number, objMaxY: number;

        if (obj.type === 'rectangle') {
            objMaxX = obj.x + obj.width;
            objMaxY = obj.y + obj.height;
            objCenterX = obj.x + obj.width / 2;
            objCenterY = obj.y + obj.height / 2;
            objArea = obj.width * obj.height;
        } else if (obj.type === 'circle') {
            objMaxX = obj.x + obj.radius * 2;
            objMaxY = obj.y + obj.radius * 2;
            objCenterX = obj.x + obj.radius;
            objCenterY = obj.y + obj.radius;
            objArea = Math.PI * obj.radius * obj.radius;
        } else if (obj.type === 'text') {
            // Approximate text bounds
            const estimatedWidth = (obj.text?.length || 0) * (obj.fontSize * 0.6);
            const estimatedHeight = obj.fontSize * 1.2;
            objMaxX = obj.x + estimatedWidth;
            objMaxY = obj.y + estimatedHeight;
            objCenterX = obj.x + estimatedWidth / 2;
            objCenterY = obj.y + estimatedHeight / 2;
            objArea = estimatedWidth * estimatedHeight;
        } else {
            return; // Skip unknown object types
        }

        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);
        maxX = Math.max(maxX, objMaxX);
        maxY = Math.max(maxY, objMaxY);

        objectPositions.push({
            x: obj.x,
            y: obj.y,
            centerX: objCenterX,
            centerY: objCenterY,
            area: objArea
        });
    });

    const bounds = {
        minX: Math.round(minX * 100) / 100,
        minY: Math.round(minY * 100) / 100,
        maxX: Math.round(maxX * 100) / 100,
        maxY: Math.round(maxY * 100) / 100,
        width: Math.round((maxX - minX) * 100) / 100,
        height: Math.round((maxY - minY) * 100) / 100,
        center: {
            x: Math.round(((minX + maxX) / 2) * 100) / 100,
            y: Math.round(((minY + maxY) / 2) * 100) / 100
        },
        aspectRatio: Math.round(((maxX - minX) / (maxY - minY)) * 100) / 100
    };

    // Calculate distribution statistics
    const canvasCenterX = bounds.center.x;
    const canvasCenterY = bounds.center.y;

    let totalDistanceFromCenter = 0;
    const objectsByQuadrant = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };

    objectPositions.forEach(obj => {
        // Calculate distance from canvas center
        const distance = Math.sqrt(
            Math.pow(obj.centerX - canvasCenterX, 2) +
            Math.pow(obj.centerY - canvasCenterY, 2)
        );
        totalDistanceFromCenter += distance;

        // Determine quadrant
        if (obj.centerX < canvasCenterX && obj.centerY < canvasCenterY) {
            objectsByQuadrant.topLeft++;
        } else if (obj.centerX >= canvasCenterX && obj.centerY < canvasCenterY) {
            objectsByQuadrant.topRight++;
        } else if (obj.centerX < canvasCenterX && obj.centerY >= canvasCenterY) {
            objectsByQuadrant.bottomLeft++;
        } else {
            objectsByQuadrant.bottomRight++;
        }
    });

    const distribution = {
        objectsByQuadrant,
        density: bounds.width > 0 && bounds.height > 0 ?
            Math.round((canvasState.objects.length / (bounds.width * bounds.height)) * 10000) / 10000 : 0,
        averageDistanceFromCenter: objectPositions.length > 0 ?
            Math.round((totalDistanceFromCenter / objectPositions.length) * 100) / 100 : 0,
        spreadX: Math.round((maxX - minX) * 100) / 100,
        spreadY: Math.round((maxY - minY) * 100) / 100
    };

    // Calculate padding suggestions for layout operations
    const paddingSuggestions = {
        minimal: Math.round(Math.min(bounds.width, bounds.height) * 0.05),
        comfortable: Math.round(Math.min(bounds.width, bounds.height) * 0.1),
        generous: Math.round(Math.min(bounds.width, bounds.height) * 0.2)
    };

    return {
        success: true,
        result: {
            roomId,
            objectCount: canvasState.objects.length,
            bounds,
            distribution,
            layoutInfo: {
                usableArea: bounds.width * bounds.height,
                perimeterLength: 2 * (bounds.width + bounds.height),
                paddingSuggestions,
                isSquareish: Math.abs(bounds.aspectRatio - 1) < 0.2,
                isLandscape: bounds.aspectRatio > 1.2,
                isPortrait: bounds.aspectRatio < 0.8
            }
        },
        message: `Canvas bounds: ${bounds.width}×${bounds.height} (${canvasState.objects.length} objects, density: ${distribution.density.toFixed(4)} objects/px²)`
    };
}

/**
 * LAYOUT TOOLS
 */

export async function arrangeObjectsInRow(context: ToolContext): Promise<any> {
    const { objectIds, startX, y, spacing = 20, alignment = 'center', roomId, userId } = context;

    // Input validation
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
        throw new Error('At least one object ID is required');
    }
    if (typeof startX !== 'number' || typeof y !== 'number') {
        throw new Error('startX and y must be numbers');
    }
    if (typeof spacing !== 'number' || spacing < 0) {
        throw new Error('Spacing must be a non-negative number');
    }
    if (!['top', 'center', 'bottom'].includes(alignment)) {
        throw new Error('Alignment must be "top", "center", or "bottom"');
    }
    if (!roomId || typeof roomId !== 'string') {
        throw new Error('Room ID must be a valid string');
    }

    const canvasState = await persistenceService.getCanvasState(roomId) || {
        roomId, objects: [], lastUpdated: Date.now(), version: 1
    };

    // Find all objects and validate they exist
    const objectsToArrange = [];
    const missingObjects = [];

    for (const objectId of objectIds) {
        const obj = canvasState.objects.find((obj: any) => obj.id === objectId);
        if (obj) {
            objectsToArrange.push(obj);
        } else {
            missingObjects.push(objectId);
        }
    }

    if (objectsToArrange.length === 0) {
        throw new Error(`No valid objects found. Missing objects: ${missingObjects.join(', ')}`);
    }

    // Calculate object dimensions for proper positioning
    const objectsWithDimensions = objectsToArrange.map((obj: any) => {
        let width = 0, height = 0;

        if (obj.type === 'rectangle') {
            width = obj.width;
            height = obj.height;
        } else if (obj.type === 'circle') {
            width = height = obj.radius * 2;
        } else if (obj.type === 'text') {
            // Estimate text dimensions
            width = (obj.text?.length || 0) * (obj.fontSize * 0.6);
            height = obj.fontSize * 1.2;
        }

        return { ...obj, width, height };
    });

    // Calculate Y positions based on alignment
    const maxHeight = Math.max(...objectsWithDimensions.map(obj => obj.height));

    const updatedObjects = [];
    let currentX = startX;

    for (let i = 0; i < objectsWithDimensions.length; i++) {
        const obj = objectsWithDimensions[i];

        // Calculate Y position based on alignment
        let alignedY = y;
        if (alignment === 'top') {
            alignedY = y;
        } else if (alignment === 'center') {
            alignedY = y - obj.height / 2 + maxHeight / 2;
        } else if (alignment === 'bottom') {
            alignedY = y - obj.height + maxHeight;
        }

        // Update object position
        const updatedObject = {
            ...obj,
            x: currentX,
            y: alignedY,
            updatedBy: userId,
            updatedAt: Date.now()
        };

        // Persist the change
        await persistenceService.createOrUpdateObject(roomId, updatedObject);

        // Broadcast the update
        if (wsManager) {
            wsManager.broadcastToRoom(roomId, {
                type: 'object_moved',
                payload: {
                    objectId: obj.id,
                    x: currentX,
                    y: alignedY,
                    previousX: obj.x,
                    previousY: obj.y,
                    userId
                }
            });
        }

        updatedObjects.push({
            id: obj.id,
            type: obj.type,
            position: { x: currentX, y: alignedY },
            previousPosition: { x: obj.x, y: obj.y }
        });

        // Move to next position (current object width + spacing)
        currentX += obj.width + spacing;
    }

    return {
        success: true,
        result: {
            arrangedCount: updatedObjects.length,
            objects: updatedObjects,
            configuration: {
                startX,
                y,
                spacing,
                alignment,
                totalWidth: currentX - startX - spacing,
                maxHeight
            },
            ...(missingObjects.length > 0 && {
                warnings: [`${missingObjects.length} objects not found: ${missingObjects.join(', ')}`]
            })
        },
        message: `Arranged ${updatedObjects.length} objects in a row with ${alignment} alignment (${missingObjects.length > 0 ? `${missingObjects.length} objects not found` : 'all objects arranged'})`
    };
}

export async function arrangeObjectsInGrid(context: ToolContext): Promise<any> {
    const { objectIds, startX, startY, columns, spacingX = 20, spacingY = 20, roomId, userId } = context;

    // Input validation
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
        throw new Error('At least one object ID is required');
    }
    if (typeof startX !== 'number' || typeof startY !== 'number') {
        throw new Error('startX and startY must be numbers');
    }
    if (typeof columns !== 'number' || columns < 1) {
        throw new Error('Columns must be a positive number');
    }
    if (typeof spacingX !== 'number' || spacingX < 0) {
        throw new Error('spacingX must be a non-negative number');
    }
    if (typeof spacingY !== 'number' || spacingY < 0) {
        throw new Error('spacingY must be a non-negative number');
    }
    if (!roomId || typeof roomId !== 'string') {
        throw new Error('Room ID must be a valid string');
    }

    const canvasState = await persistenceService.getCanvasState(roomId) || {
        roomId, objects: [], lastUpdated: Date.now(), version: 1
    };

    // Find all objects and validate they exist
    const objectsToArrange = [];
    const missingObjects = [];

    for (const objectId of objectIds) {
        const obj = canvasState.objects.find((obj: any) => obj.id === objectId);
        if (obj) {
            objectsToArrange.push(obj);
        } else {
            missingObjects.push(objectId);
        }
    }

    if (objectsToArrange.length === 0) {
        throw new Error(`No valid objects found. Missing objects: ${missingObjects.join(', ')}`);
    }

    // Calculate object dimensions for proper positioning
    const objectsWithDimensions = objectsToArrange.map((obj: any) => {
        let width = 0, height = 0;

        if (obj.type === 'rectangle') {
            width = obj.width;
            height = obj.height;
        } else if (obj.type === 'circle') {
            width = height = obj.radius * 2;
        } else if (obj.type === 'text') {
            width = (obj.text?.length || 0) * (obj.fontSize * 0.6);
            height = obj.fontSize * 1.2;
        }

        return { ...obj, width, height };
    });

    // Calculate grid layout
    const rows = Math.ceil(objectsToArrange.length / columns);
    const updatedObjects = [];

    for (let i = 0; i < objectsWithDimensions.length; i++) {
        const obj = objectsWithDimensions[i];
        const row = Math.floor(i / columns);
        const col = i % columns;

        // Calculate position in grid
        const x = startX + col * (Math.max(...objectsWithDimensions.map(o => o.width)) + spacingX);
        const y = startY + row * (Math.max(...objectsWithDimensions.map(o => o.height)) + spacingY);

        // Update object position
        const updatedObject = {
            ...obj,
            x,
            y,
            updatedBy: userId,
            updatedAt: Date.now()
        };

        // Persist the change
        await persistenceService.createOrUpdateObject(roomId, updatedObject);

        // Broadcast the update
        if (wsManager) {
            wsManager.broadcastToRoom(roomId, {
                type: 'object_moved',
                payload: {
                    objectId: obj.id,
                    x,
                    y,
                    previousX: obj.x,
                    previousY: obj.y,
                    userId
                }
            });
        }

        updatedObjects.push({
            id: obj.id,
            type: obj.type,
            position: { x, y },
            previousPosition: { x: obj.x, y: obj.y },
            gridPosition: { row, column: col }
        });
    }

    const maxObjectWidth = Math.max(...objectsWithDimensions.map(o => o.width));
    const maxObjectHeight = Math.max(...objectsWithDimensions.map(o => o.height));

    return {
        success: true,
        result: {
            arrangedCount: updatedObjects.length,
            objects: updatedObjects,
            gridConfiguration: {
                startX,
                startY,
                columns,
                rows,
                spacingX,
                spacingY,
                totalWidth: columns * maxObjectWidth + (columns - 1) * spacingX,
                totalHeight: rows * maxObjectHeight + (rows - 1) * spacingY,
                cellSize: { width: maxObjectWidth, height: maxObjectHeight }
            },
            ...(missingObjects.length > 0 && {
                warnings: [`${missingObjects.length} objects not found: ${missingObjects.join(', ')}`]
            })
        },
        message: `Arranged ${updatedObjects.length} objects in a ${columns}×${rows} grid (${missingObjects.length > 0 ? `${missingObjects.length} objects not found` : 'all objects arranged'})`
    };
}

export async function alignObjects(context: ToolContext): Promise<any> {
    const { objectIds, alignment, referencePoint, roomId, userId } = context;

    // Input validation
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
        throw new Error('At least one object ID is required');
    }
    if (!['left', 'center', 'right', 'top', 'middle', 'bottom'].includes(alignment)) {
        throw new Error('Alignment must be one of: left, center, right, top, middle, bottom');
    }
    if (referencePoint !== undefined && typeof referencePoint !== 'number') {
        throw new Error('Reference point must be a number if provided');
    }
    if (!roomId || typeof roomId !== 'string') {
        throw new Error('Room ID must be a valid string');
    }

    const canvasState = await persistenceService.getCanvasState(roomId) || {
        roomId, objects: [], lastUpdated: Date.now(), version: 1
    };

    // Find all objects and validate they exist
    const objectsToAlign = [];
    const missingObjects = [];

    for (const objectId of objectIds) {
        const obj = canvasState.objects.find((obj: any) => obj.id === objectId);
        if (obj) {
            objectsToAlign.push(obj);
        } else {
            missingObjects.push(objectId);
        }
    }

    if (objectsToAlign.length === 0) {
        throw new Error(`No valid objects found. Missing objects: ${missingObjects.join(', ')}`);
    }

    // Calculate object dimensions and bounds
    const objectsWithDimensions = objectsToAlign.map((obj: any) => {
        let width = 0, height = 0, centerX = obj.x, centerY = obj.y;

        if (obj.type === 'rectangle') {
            width = obj.width;
            height = obj.height;
            centerX = obj.x + width / 2;
            centerY = obj.y + height / 2;
        } else if (obj.type === 'circle') {
            width = height = obj.radius * 2;
            centerX = obj.x + obj.radius;
            centerY = obj.y + obj.radius;
        } else if (obj.type === 'text') {
            width = (obj.text?.length || 0) * (obj.fontSize * 0.6);
            height = obj.fontSize * 1.2;
            centerX = obj.x + width / 2;
            centerY = obj.y + height / 2;
        }

        return {
            ...obj,
            width,
            height,
            centerX,
            centerY,
            right: obj.x + width,
            bottom: obj.y + height
        };
    });

    // Calculate alignment coordinate
    let alignmentCoordinate: number;

    if (referencePoint !== undefined) {
        alignmentCoordinate = referencePoint;
    } else {
        // Auto-calculate based on existing objects
        switch (alignment) {
            case 'left':
                alignmentCoordinate = Math.min(...objectsWithDimensions.map(obj => obj.x));
                break;
            case 'center':
                alignmentCoordinate = objectsWithDimensions.reduce((sum, obj) => sum + obj.centerX, 0) / objectsWithDimensions.length;
                break;
            case 'right':
                alignmentCoordinate = Math.max(...objectsWithDimensions.map(obj => obj.right));
                break;
            case 'top':
                alignmentCoordinate = Math.min(...objectsWithDimensions.map(obj => obj.y));
                break;
            case 'middle':
                alignmentCoordinate = objectsWithDimensions.reduce((sum, obj) => sum + obj.centerY, 0) / objectsWithDimensions.length;
                break;
            case 'bottom':
                alignmentCoordinate = Math.max(...objectsWithDimensions.map(obj => obj.bottom));
                break;
            default:
                throw new Error('Invalid alignment type');
        }
    }

    const updatedObjects = [];

    for (const obj of objectsWithDimensions) {
        let newX = obj.x;
        let newY = obj.y;

        // Calculate new position based on alignment
        switch (alignment) {
            case 'left':
                newX = alignmentCoordinate;
                break;
            case 'center':
                newX = alignmentCoordinate - obj.width / 2;
                break;
            case 'right':
                newX = alignmentCoordinate - obj.width;
                break;
            case 'top':
                newY = alignmentCoordinate;
                break;
            case 'middle':
                newY = alignmentCoordinate - obj.height / 2;
                break;
            case 'bottom':
                newY = alignmentCoordinate - obj.height;
                break;
        }

        // Update object position
        const updatedObject = {
            ...obj,
            x: newX,
            y: newY,
            updatedBy: userId,
            updatedAt: Date.now()
        };

        // Persist the change
        await persistenceService.createOrUpdateObject(roomId, updatedObject);

        // Broadcast the update
        if (wsManager) {
            wsManager.broadcastToRoom(roomId, {
                type: 'object_moved',
                payload: {
                    objectId: obj.id,
                    x: newX,
                    y: newY,
                    previousX: obj.x,
                    previousY: obj.y,
                    userId
                }
            });
        }

        updatedObjects.push({
            id: obj.id,
            type: obj.type,
            position: { x: newX, y: newY },
            previousPosition: { x: obj.x, y: obj.y },
            alignmentShift: {
                x: newX - obj.x,
                y: newY - obj.y
            }
        });
    }

    return {
        success: true,
        result: {
            alignedCount: updatedObjects.length,
            objects: updatedObjects,
            alignmentConfiguration: {
                alignment,
                alignmentCoordinate: Math.round(alignmentCoordinate * 100) / 100,
                axis: ['left', 'center', 'right'].includes(alignment) ? 'horizontal' : 'vertical'
            },
            ...(missingObjects.length > 0 && {
                warnings: [`${missingObjects.length} objects not found: ${missingObjects.join(', ')}`]
            })
        },
        message: `Aligned ${updatedObjects.length} objects to ${alignment} at coordinate ${Math.round(alignmentCoordinate * 100) / 100} (${missingObjects.length > 0 ? `${missingObjects.length} objects not found` : 'all objects aligned'})`
    };
}

export async function distributeObjects(context: ToolContext): Promise<any> {
    const { objectIds, direction, startPosition, endPosition, roomId, userId } = context;

    // Input validation
    if (!Array.isArray(objectIds) || objectIds.length < 2) {
        throw new Error('At least two object IDs are required for distribution');
    }
    if (!['horizontal', 'vertical'].includes(direction)) {
        throw new Error('Direction must be "horizontal" or "vertical"');
    }
    if (typeof startPosition !== 'number' || typeof endPosition !== 'number') {
        throw new Error('Start and end positions must be numbers');
    }
    if (startPosition >= endPosition) {
        throw new Error('End position must be greater than start position');
    }
    if (!roomId || typeof roomId !== 'string') {
        throw new Error('Room ID must be a valid string');
    }

    const canvasState = await persistenceService.getCanvasState(roomId) || {
        roomId, objects: [], lastUpdated: Date.now(), version: 1
    };

    // Find all objects and validate they exist
    const objectsToDistribute = [];
    const missingObjects = [];

    for (const objectId of objectIds) {
        const obj = canvasState.objects.find((obj: any) => obj.id === objectId);
        if (obj) {
            objectsToDistribute.push(obj);
        } else {
            missingObjects.push(objectId);
        }
    }

    if (objectsToDistribute.length < 2) {
        throw new Error(`At least 2 valid objects required for distribution. Found: ${objectsToDistribute.length}, Missing: ${missingObjects.join(', ')}`);
    }

    // Calculate object dimensions
    const objectsWithDimensions = objectsToDistribute.map((obj: any) => {
        let width = 0, height = 0;

        if (obj.type === 'rectangle') {
            width = obj.width;
            height = obj.height;
        } else if (obj.type === 'circle') {
            width = height = obj.radius * 2;
        } else if (obj.type === 'text') {
            width = (obj.text?.length || 0) * (obj.fontSize * 0.6);
            height = obj.fontSize * 1.2;
        }

        return { ...obj, width, height };
    });

    // Sort objects by their current position along the distribution axis
    const isHorizontal = direction === 'horizontal';
    objectsWithDimensions.sort((a, b) => {
        const aPos = isHorizontal ? a.x : a.y;
        const bPos = isHorizontal ? b.x : b.y;
        return aPos - bPos;
    });

    // Calculate the total space available and divide it evenly
    const totalDistance = endPosition - startPosition;
    const spacing = totalDistance / (objectsWithDimensions.length - 1);

    const updatedObjects = [];

    for (let i = 0; i < objectsWithDimensions.length; i++) {
        const obj = objectsWithDimensions[i];
        let newX = obj.x;
        let newY = obj.y;

        // Calculate new position based on even distribution
        const distributedPosition = startPosition + (i * spacing);

        if (isHorizontal) {
            newX = distributedPosition;
        } else {
            newY = distributedPosition;
        }

        // Update object position
        const updatedObject = {
            ...obj,
            x: newX,
            y: newY,
            updatedBy: userId,
            updatedAt: Date.now()
        };

        // Persist the change
        await persistenceService.createOrUpdateObject(roomId, updatedObject);

        // Broadcast the update
        if (wsManager) {
            wsManager.broadcastToRoom(roomId, {
                type: 'object_moved',
                payload: {
                    objectId: obj.id,
                    x: newX,
                    y: newY,
                    previousX: obj.x,
                    previousY: obj.y,
                    userId
                }
            });
        }

        updatedObjects.push({
            id: obj.id,
            type: obj.type,
            position: { x: newX, y: newY },
            previousPosition: { x: obj.x, y: obj.y },
            distributionIndex: i,
            distributedCoordinate: distributedPosition
        });
    }

    return {
        success: true,
        result: {
            distributedCount: updatedObjects.length,
            objects: updatedObjects,
            distributionConfiguration: {
                direction,
                startPosition,
                endPosition,
                totalDistance,
                spacing: Math.round(spacing * 100) / 100,
                axis: isHorizontal ? 'x' : 'y'
            },
            ...(missingObjects.length > 0 && {
                warnings: [`${missingObjects.length} objects not found: ${missingObjects.join(', ')}`]
            })
        },
        message: `Distributed ${updatedObjects.length} objects ${direction}ly from ${startPosition} to ${endPosition} with ${Math.round(spacing * 100) / 100}px spacing (${missingObjects.length > 0 ? `${missingObjects.length} objects not found` : 'all objects distributed'})`
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
    arrangeObjectsInGrid,
    alignObjects,
    distributeObjects,
    clearCanvas
};
