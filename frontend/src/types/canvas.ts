export interface BaseCanvasObject {
    id: string;
    x: number;
    y: number;
    type: 'rectangle' | 'circle' | 'text';
    color: string;
    createdAt: number;
    updatedAt: number;
    userId?: string;
}

export interface RectangleObject extends BaseCanvasObject {
    type: 'rectangle';
    width: number;
    height: number;
}

export interface CircleObject extends BaseCanvasObject {
    type: 'circle';
    radius: number;
}

export interface TextObject extends BaseCanvasObject {
    type: 'text';
    text: string;
    fontSize: number;
    fontFamily?: string;
    fontStyle?: string;
}

export type CanvasObject = RectangleObject | CircleObject | TextObject;

export interface CanvasState {
    objects: CanvasObject[];
    selectedObjectId: string | null;
    tool: 'select' | 'rectangle' | 'circle' | 'text';
    activeColor: string;
}

export interface ViewportState {
    x: number;
    y: number;
    scale: number;
}

// Predefined color palette
export const COLOR_PALETTE = [
    '#3b82f6', // Blue
    '#ef4444', // Red  
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#8b5cf6', // Purple
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#ec4899', // Pink
    '#6b7280', // Gray
    '#1f2937', // Dark Gray
    '#ffffff', // White
] as const;

export type PaletteColor = typeof COLOR_PALETTE[number];

// Color names mapping for better UX
export const COLOR_NAMES: Record<PaletteColor, string> = {
    '#3b82f6': 'Blue',
    '#ef4444': 'Red',
    '#10b981': 'Green',
    '#f59e0b': 'Yellow',
    '#8b5cf6': 'Purple',
    '#f97316': 'Orange',
    '#06b6d4': 'Cyan',
    '#84cc16': 'Lime',
    '#ec4899': 'Pink',
    '#6b7280': 'Gray',
    '#1f2937': 'Dark Gray',
    '#ffffff': 'White'
};
