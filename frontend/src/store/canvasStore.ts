import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CanvasObject, RectangleObject, CanvasState } from '../types/canvas';
import { COLOR_PALETTE } from '../types/canvas';

interface CanvasStore extends CanvasState {
    // Actions
    addObject: (object: CanvasObject) => void;
    updateObject: (id: string, updates: Partial<CanvasObject>) => void;
    deleteObject: (id: string) => void;
    selectObject: (id: string | null) => void;
    setTool: (tool: CanvasState['tool']) => void;
    setActiveColor: (color: string) => void;

    // Rectangle-specific actions
    createRectangle: (x: number, y: number, width?: number, height?: number) => RectangleObject;

    // Utility functions
    getObjectById: (id: string) => CanvasObject | undefined;
    clearCanvas: () => void;
}

const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useCanvasStore = create<CanvasStore>()(
    devtools(
        (set, get) => ({
            // Initial state
            objects: [],
            selectedObjectId: null,
            tool: 'rectangle',
            activeColor: COLOR_PALETTE[0], // Default to blue

            // Actions
            addObject: (object) =>
                set((state) => ({
                    objects: [...state.objects, object],
                }), false, 'addObject'),

            updateObject: (id, updates) =>
                set((state) => ({
                    objects: state.objects.map((obj) =>
                        obj.id === id
                            ? { ...obj, ...updates, updatedAt: Date.now() }
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
                };

                get().addObject(rectangle);
                return rectangle;
            },

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
