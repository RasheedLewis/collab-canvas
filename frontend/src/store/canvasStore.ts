import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CanvasObject, RectangleObject, CircleObject, TextObject, CanvasState } from '../types/canvas';
import { COLOR_PALETTE } from '../types/canvas';
import { useAuthStore } from './authStore';

interface CanvasStore extends CanvasState {
    // Actions
    addObject: (object: CanvasObject) => void;
    updateObject: (id: string, updates: Partial<CanvasObject>) => void;
    deleteObject: (id: string) => void;
    selectObject: (id: string | null) => void;
    setTool: (tool: CanvasState['tool']) => void;
    setActiveColor: (color: string) => void;

    // Shape-specific actions
    createRectangle: (x: number, y: number, width?: number, height?: number) => RectangleObject;
    createCircle: (x: number, y: number, radius?: number) => CircleObject;
    createText: (x: number, y: number, text?: string) => TextObject;

    // Text-specific actions
    activeFontSize: number;
    setActiveFontSize: (size: number) => void;
    editingTextId: string | null;
    setEditingTextId: (id: string | null) => void;

    // Utility functions
    getObjectById: (id: string) => CanvasObject | undefined;
    clearCanvas: () => void;
}

const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to get current user ID
const getCurrentUserId = (): string | undefined => {
    const authState = useAuthStore.getState();
    return authState.user?.uid;
};

export const useCanvasStore = create<CanvasStore>()(
    devtools(
        (set, get) => ({
            // Initial state
            objects: [],
            selectedObjectId: null,
            tool: 'select',
            activeColor: COLOR_PALETTE[0], // Default to blue
            activeFontSize: 16, // Default font size
            editingTextId: null,

            // Actions
            addObject: (object) =>
                set((state) => ({
                    objects: [...state.objects, object],
                }), false, 'addObject'),

            updateObject: (id, updates) =>
                set((state) => ({
                    ...state,
                    objects: state.objects.map((obj) =>
                        obj.id === id
                            ? { ...obj, ...updates, updatedAt: Date.now() } as CanvasObject
                            : obj
                    ),
                }), false, 'updateObject'),

            deleteObject: (id) =>
                set((state) => ({
                    objects: state.objects.filter((obj) => obj.id !== id),
                    selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
                }), false, 'deleteObject'),

            selectObject: (id) =>
                set({ selectedObjectId: id }, false, 'selectObject'),

            setTool: (tool) =>
                set({ tool, selectedObjectId: null }, false, 'setTool'),

            setActiveColor: (color) =>
                set({ activeColor: color }, false, 'setActiveColor'),

            createRectangle: (x, y, width = 100, height = 80) => {
                const rectangle: RectangleObject = {
                    id: generateId(),
                    type: 'rectangle',
                    x,
                    y,
                    width,
                    height,
                    color: get().activeColor,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    userId: getCurrentUserId(),
                };

                get().addObject(rectangle);
                return rectangle;
            },

            createCircle: (x, y, radius = 50) => {
                const circle: CircleObject = {
                    id: generateId(),
                    type: 'circle',
                    x,
                    y,
                    radius,
                    color: get().activeColor,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    userId: getCurrentUserId(),
                };

                get().addObject(circle);
                return circle;
            },

            createText: (x, y, text = 'New Text') => {
                const textObject: TextObject = {
                    id: generateId(),
                    type: 'text',
                    x,
                    y,
                    text,
                    fontSize: get().activeFontSize,
                    fontFamily: 'Arial, sans-serif',
                    color: get().activeColor,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    userId: getCurrentUserId(),
                };

                get().addObject(textObject);
                return textObject;
            },

            setActiveFontSize: (size) =>
                set({ activeFontSize: size }, false, 'setActiveFontSize'),

            setEditingTextId: (id) =>
                set({ editingTextId: id }, false, 'setEditingTextId'),

            getObjectById: (id) => {
                return get().objects.find((obj) => obj.id === id);
            },

            clearCanvas: () =>
                set({
                    objects: [],
                    selectedObjectId: null,
                }, false, 'clearCanvas'),
        }),
        {
            name: 'canvas-store',
        }
    )
);
