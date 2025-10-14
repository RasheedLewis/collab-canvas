import { describe, test, expect } from 'vitest';
import {
    calculateViewport,
    createShape,
    createTextObject,
    updateTextObject,
    getBoundingBox,
    isPointInside,
    screenToCanvas,
    canvasToScreen,
    generateId
} from '../canvasUtils';
import type { RectangleObject, CircleObject, TextObject } from '../../types/canvas';

describe('canvasUtils', () => {
    describe('calculateViewport', () => {
        test('should handle infinite canvas bounds', () => {
            const viewport = calculateViewport({ x: 5000, y: 3000 }, 0.5, 800, 600);
            expect(viewport.x).toBe(5000);
            expect(viewport.y).toBe(3000);
            expect(viewport.scale).toBe(0.5);
            expect(viewport.width).toBe(1600); // 800 / 0.5
            expect(viewport.height).toBe(1200); // 600 / 0.5
        });

        test('should calculate viewport with different scales', () => {
            const viewport1 = calculateViewport({ x: 100, y: 200 }, 1.0, 1000, 800);
            expect(viewport1.width).toBe(1000);
            expect(viewport1.height).toBe(800);

            const viewport2 = calculateViewport({ x: 100, y: 200 }, 2.0, 1000, 800);
            expect(viewport2.width).toBe(500);
            expect(viewport2.height).toBe(400);
        });

        test('should handle negative positions', () => {
            const viewport = calculateViewport({ x: -1000, y: -500 }, 1.5, 600, 400);
            expect(viewport.x).toBe(-1000);
            expect(viewport.y).toBe(-500);
            expect(viewport.width).toBe(400); // 600 / 1.5
            expect(viewport.height).toBeCloseTo(266.67, 2); // 400 / 1.5 (rounded)
        });
    });

    describe('createShape', () => {
        test('should generate valid objects for all shape types', () => {
            const rectangle = createShape('rectangle', 100, 200, 300, 400, '#ff0000');
            expect(rectangle.type).toBe('rectangle');
            expect(rectangle.x).toBe(100);
            expect(rectangle.y).toBe(200);
            expect(rectangle.width).toBe(300);
            expect(rectangle.height).toBe(400);
            expect(rectangle.color).toBe('#ff0000');
            expect(rectangle.id).toBeDefined();
            expect(rectangle.createdAt).toBeDefined();
            expect(rectangle.updatedAt).toBeDefined();

            const circle = createShape('circle', 150, 150, 50, undefined, '#00ff00');
            expect(circle.type).toBe('circle');
            expect(circle.x).toBe(150);
            expect(circle.y).toBe(150);
            expect(circle.radius).toBe(50);
            expect(circle.color).toBe('#00ff00');
            expect(circle.id).toBeDefined();
        });

        test('should create rectangles with proper dimensions', () => {
            const rect = createShape('rectangle', 0, 0, 100, 50, '#blue');
            expect(rect.width).toBe(100);
            expect(rect.height).toBe(50);
        });

        test('should create circles with default color when not provided', () => {
            const circle = createShape('circle', 100, 100, 25);
            expect(circle.color).toBe('#3b82f6');
            expect(circle.radius).toBe(25);
        });
    });

    describe('createTextObject', () => {
        test('should create text objects with all properties', () => {
            const textObj = createTextObject(200, 100, 'Hello World', 16, '#0000ff');
            expect(textObj.type).toBe('text');
            expect(textObj.x).toBe(200);
            expect(textObj.y).toBe(100);
            expect(textObj.text).toBe('Hello World');
            expect(textObj.fontSize).toBe(16);
            expect(textObj.color).toBe('#0000ff');
            expect(textObj.fontFamily).toBe('Arial, sans-serif');
            expect(textObj.id).toBeDefined();
            expect(textObj.createdAt).toBeDefined();
            expect(textObj.updatedAt).toBeDefined();
        });

        test('should handle empty text', () => {
            const textObj = createTextObject(0, 0, '', 12, '#000');
            expect(textObj.text).toBe('');
            expect(textObj.fontSize).toBe(12);
        });

        test('should handle multiline text', () => {
            const multilineText = 'Line 1\nLine 2\nLine 3';
            const textObj = createTextObject(50, 50, multilineText, 14, '#333');
            expect(textObj.text).toBe(multilineText);
            expect(textObj.fontSize).toBe(14);
        });
    });

    describe('updateTextObject', () => {
        test('should validate input and formatting', () => {
            const originalTime = Date.now() - 1; // Make sure updated time is later
            const textObj = {
                id: 'test-id',
                type: 'text' as const,
                x: 0,
                y: 0,
                text: 'Original',
                fontSize: 14,
                color: '#000000',
                fontFamily: 'Arial',
                createdAt: originalTime,
                updatedAt: originalTime
            };

            const updatedText = updateTextObject(textObj, 'New Text', 18, '#ff0000');

            expect(updatedText.text).toBe('New Text');
            expect(updatedText.fontSize).toBe(18);
            expect(updatedText.color).toBe('#ff0000');
            expect(updatedText.updatedAt).toBeGreaterThan(originalTime);
        });

        test('should handle partial updates', () => {
            const originalObj = {
                text: 'Original',
                fontSize: 14,
                color: '#000000'
            };

            // Update only text
            const updated1 = updateTextObject(originalObj, 'New Text');
            expect(updated1.text).toBe('New Text');
            expect(updated1.fontSize).toBe(14);
            expect(updated1.color).toBe('#000000');

            // Update only font size
            const updated2 = updateTextObject(originalObj, undefined, 20);
            expect(updated2.text).toBe('Original');
            expect(updated2.fontSize).toBe(20);
            expect(updated2.color).toBe('#000000');

            // Update only color
            const updated3 = updateTextObject(originalObj, undefined, undefined, '#ff0000');
            expect(updated3.text).toBe('Original');
            expect(updated3.fontSize).toBe(14);
            expect(updated3.color).toBe('#ff0000');
        });

        test('should use defaults for missing properties', () => {
            const emptyObj = {};
            const updated = updateTextObject(emptyObj);

            expect(updated.text).toBe('Text');
            expect(updated.fontSize).toBe(16);
            expect(updated.color).toBe('#000000');
        });
    });

    describe('getBoundingBox', () => {
        test('should calculate correct bounding box for rectangles', () => {
            const rect: RectangleObject = {
                id: 'test',
                type: 'rectangle',
                x: 100,
                y: 200,
                width: 150,
                height: 100,
                color: '#ff0000',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const bbox = getBoundingBox(rect);
            expect(bbox.x).toBe(100);
            expect(bbox.y).toBe(200);
            expect(bbox.width).toBe(150);
            expect(bbox.height).toBe(100);
        });

        test('should calculate correct bounding box for circles', () => {
            const circle: CircleObject = {
                id: 'test',
                type: 'circle',
                x: 150,
                y: 150,
                radius: 50,
                color: '#00ff00',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const bbox = getBoundingBox(circle);
            expect(bbox.x).toBe(100); // 150 - 50
            expect(bbox.y).toBe(100); // 150 - 50
            expect(bbox.width).toBe(100); // 50 * 2
            expect(bbox.height).toBe(100); // 50 * 2
        });

        test('should calculate bounding box for text objects', () => {
            const textObj: TextObject = {
                id: 'test',
                type: 'text',
                x: 200,
                y: 100,
                text: 'Hello',
                fontSize: 16,
                fontFamily: 'Arial',
                color: '#0000ff',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const bbox = getBoundingBox(textObj);
            expect(bbox.x).toBe(200);
            expect(bbox.y).toBe(100);
            expect(bbox.width).toBeGreaterThan(0);
            expect(bbox.height).toBeGreaterThan(0);
        });

        test('should handle multiline text bounding box', () => {
            const multilineText: TextObject = {
                id: 'test',
                type: 'text',
                x: 0,
                y: 0,
                text: 'Line 1\nLine 2\nLine 3',
                fontSize: 14,
                fontFamily: 'Arial',
                color: '#000',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const bbox = getBoundingBox(multilineText);
            expect(bbox.height).toBe(14 * 1.2 * 3); // 3 lines
        });
    });

    describe('isPointInside', () => {
        test('should detect points inside rectangles', () => {
            const rect: RectangleObject = {
                id: 'test',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                color: '#ff0000',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            expect(isPointInside(rect, 150, 150)).toBe(true);
            expect(isPointInside(rect, 200, 200)).toBe(true);
            expect(isPointInside(rect, 100, 100)).toBe(true); // corner
            expect(isPointInside(rect, 50, 50)).toBe(false); // outside
            expect(isPointInside(rect, 350, 150)).toBe(false); // outside
        });

        test('should detect points inside circles', () => {
            const circle: CircleObject = {
                id: 'test',
                type: 'circle',
                x: 150,
                y: 150,
                radius: 50,
                color: '#00ff00',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            expect(isPointInside(circle, 150, 150)).toBe(true); // center
            expect(isPointInside(circle, 150, 130)).toBe(true); // inside
            expect(isPointInside(circle, 150, 200)).toBe(true); // edge
            expect(isPointInside(circle, 150, 220)).toBe(false); // outside
            expect(isPointInside(circle, 100, 100)).toBe(false); // outside
        });

        test('should detect points inside text objects', () => {
            const textObj: TextObject = {
                id: 'test',
                type: 'text',
                x: 200,
                y: 100,
                text: 'Hello',
                fontSize: 16,
                fontFamily: 'Arial',
                color: '#0000ff',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            expect(isPointInside(textObj, 210, 110)).toBe(true); // inside estimated bounds
            expect(isPointInside(textObj, 50, 50)).toBe(false); // outside
        });
    });

    describe('coordinate conversion', () => {
        test('should convert screen to canvas coordinates', () => {
            const canvasCoords = screenToCanvas(400, 300, 100, 50, 2.0);
            expect(canvasCoords.x).toBe(150); // (400 - 100) / 2
            expect(canvasCoords.y).toBe(125); // (300 - 50) / 2
        });

        test('should convert canvas to screen coordinates', () => {
            const screenCoords = canvasToScreen(150, 125, 100, 50, 2.0);
            expect(screenCoords.x).toBe(400); // 150 * 2 + 100
            expect(screenCoords.y).toBe(300); // 125 * 2 + 50
        });

        test('should handle negative coordinates', () => {
            const canvasCoords = screenToCanvas(50, 25, 200, 150, 0.5);
            expect(canvasCoords.x).toBe(-300); // (50 - 200) / 0.5
            expect(canvasCoords.y).toBe(-250); // (25 - 150) / 0.5
        });

        test('should be reversible transformations', () => {
            const originalCanvas = { x: 123, y: 456 };
            const stageX = 50;
            const stageY = 75;
            const scale = 1.5;

            const screen = canvasToScreen(originalCanvas.x, originalCanvas.y, stageX, stageY, scale);
            const backToCanvas = screenToCanvas(screen.x, screen.y, stageX, stageY, scale);

            expect(Math.round(backToCanvas.x)).toBe(originalCanvas.x);
            expect(Math.round(backToCanvas.y)).toBe(originalCanvas.y);
        });
    });

    describe('generateId', () => {
        test('should generate unique IDs', () => {
            const id1 = generateId();
            const id2 = generateId();
            const id3 = generateId();

            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id3).toBeDefined();
            expect(id1).not.toBe(id2);
            expect(id2).not.toBe(id3);
            expect(id1).not.toBe(id3);
        });

        test('should generate string IDs', () => {
            const id = generateId();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });

        test('should include timestamp component', () => {
            const beforeTime = Date.now();
            const id = generateId();
            const afterTime = Date.now();

            const timestampPart = parseInt(id.split('-')[0]);
            expect(timestampPart).toBeGreaterThanOrEqual(beforeTime);
            expect(timestampPart).toBeLessThanOrEqual(afterTime);
        });
    });
});
