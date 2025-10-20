// Re-export types from shared types for backward compatibility
export type {
    BaseCanvasObject,
    RectangleObject,
    CircleObject,
    TextObject,
    CanvasObject,
    Canvas,
    CanvasPermission,
    PermissionRole,
    CanvasPrivacy,
    User
} from '../../../shared/types';

// Frontend-specific canvas UI state
export interface CanvasUIState {
    currentCanvasId: string | null;
    objects: CanvasObject[];
    selectedObjectId: string | null;
    tool: 'select' | 'rectangle' | 'circle' | 'text';
    activeColor: string;
    isLoading: boolean;
    error: string | null;
}

export interface ViewportState {
    x: number;
    y: number;
    scale: number;
}

// Multi-canvas management state
export interface MultiCanvasState {
    canvases: Canvas[];
    currentCanvas: Canvas | null;
    permissions: Record<string, CanvasPermission>; // canvasId -> permission
    loading: boolean;
    error: string | null;
}

// Dashboard state for canvas management
export interface DashboardState {
    canvases: Canvas[];
    filteredCanvases: Canvas[];
    searchQuery: string;
    filters: {
        privacy?: CanvasPrivacy;
        ownedByMe?: boolean;
        sharedWithMe?: boolean;
        folder?: string;
        tags?: string[];
        isFavorite?: boolean;
        isArchived?: boolean;
    };
    sortBy: 'name' | 'createdAt' | 'updatedAt' | 'lastAccessedAt';
    sortDirection: 'asc' | 'desc';
    view: 'grid' | 'list';
    loading: boolean;
    error: string | null;
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
