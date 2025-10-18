/**
 * Canvas State Persistence Service
 * 
 * Provides in-memory and file-based persistence for canvas state per room.
 * This will be migrated to Firebase/Firestore in PR #8.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Canvas object type definitions matching frontend
interface BaseCanvasObject {
    id: string;
    x: number;
    y: number;
    type: 'rectangle' | 'circle' | 'text';
    color: string;
    rotation?: number;
    createdAt: number;
    updatedAt: number;
    userId?: string;
}

interface RectangleObject extends BaseCanvasObject {
    type: 'rectangle';
    width: number;
    height: number;
}

interface CircleObject extends BaseCanvasObject {
    type: 'circle';
    radius: number;
}

interface TextObject extends BaseCanvasObject {
    type: 'text';
    text: string;
    fontSize: number;
    fontFamily?: string;
    fontStyle?: string;
}

type CanvasObject = RectangleObject | CircleObject | TextObject;

interface CanvasState {
    roomId: string;
    objects: CanvasObject[];
    lastUpdated: number;
    version: number;
}

interface PersistenceStats {
    totalRooms: number;
    totalObjects: number;
    totalSaves: number;
    totalLoads: number;
    lastActivity: number;
}

export class CanvasPersistenceService {
    private roomStates: Map<string, CanvasState> = new Map();
    private persistenceDir: string;
    private saveTimeout: Map<string, NodeJS.Timeout> = new Map();
    private readonly SAVE_DEBOUNCE_MS = 1000; // Debounce saves by 1 second
    private readonly MAX_OBJECTS_PER_ROOM = 1000; // Prevent memory issues
    private stats: PersistenceStats = {
        totalRooms: 0,
        totalObjects: 0,
        totalSaves: 0,
        totalLoads: 0,
        lastActivity: Date.now()
    };

    constructor(persistenceDir = './data/canvas-states') {
        this.persistenceDir = persistenceDir;
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            await fs.mkdir(this.persistenceDir, { recursive: true });
            console.log(`📁 Canvas persistence initialized at: ${this.persistenceDir}`);

            // Load existing room states from disk
            await this.loadAllRoomStates();
        } catch (error) {
            console.error('❌ Failed to initialize persistence service:', error);
        }
    }

    private async loadAllRoomStates(): Promise<void> {
        try {
            const files = await fs.readdir(this.persistenceDir);
            const roomFiles = files.filter(file => file.endsWith('.json'));

            let loadedRooms = 0;
            let totalObjects = 0;

            for (const file of roomFiles) {
                const roomId = path.basename(file, '.json');
                try {
                    const state = await this.loadRoomStateFromDisk(roomId);
                    if (state) {
                        this.roomStates.set(roomId, state);
                        loadedRooms++;
                        totalObjects += state.objects.length;
                    }
                } catch (error) {
                    console.error(`⚠️ Failed to load room state ${roomId}:`, error);
                }
            }

            this.stats.totalRooms = loadedRooms;
            this.stats.totalObjects = totalObjects;

            console.log(`📂 Loaded ${loadedRooms} room states with ${totalObjects} objects`);
        } catch (error) {
            console.error('❌ Failed to load room states:', error);
        }
    }

    private async loadRoomStateFromDisk(roomId: string): Promise<CanvasState | undefined> {
        try {
            const filePath = this.getRoomFilePath(roomId);
            const data = await fs.readFile(filePath, 'utf8');
            const state = JSON.parse(data) as CanvasState;

            // Validate the loaded state
            if (!this.validateCanvasState(state)) {
                console.warn(`⚠️ Invalid canvas state loaded for room ${roomId}`);
                return undefined;
            }

            this.stats.totalLoads++;
            return state;
        } catch (error) {
            if ((error as any).code !== 'ENOENT') {
                console.error(`❌ Error loading room state ${roomId}:`, error);
            }
            return undefined;
        }
    }

    private async saveRoomStateToDisk(roomId: string, state: CanvasState): Promise<void> {
        try {
            const filePath = this.getRoomFilePath(roomId);
            const data = JSON.stringify(state, null, 2);
            await fs.writeFile(filePath, data, 'utf8');
            this.stats.totalSaves++;
        } catch (error) {
            console.error(`❌ Error saving room state ${roomId}:`, error);
            throw error;
        }
    }

    private getRoomFilePath(roomId: string): string {
        // Sanitize room ID for filename
        const sanitizedRoomId = roomId.replace(/[^a-zA-Z0-9-_]/g, '_');
        return path.join(this.persistenceDir, `${sanitizedRoomId}.json`);
    }

    private validateCanvasState(state: any): state is CanvasState {
        return (
            state &&
            typeof state.roomId === 'string' &&
            Array.isArray(state.objects) &&
            typeof state.lastUpdated === 'number' &&
            typeof state.version === 'number' &&
            state.objects.every(this.validateCanvasObject)
        );
    }

    private validateCanvasObject(obj: any): obj is CanvasObject {
        if (!obj || typeof obj !== 'object') return false;

        const baseValid = (
            typeof obj.id === 'string' &&
            typeof obj.x === 'number' &&
            typeof obj.y === 'number' &&
            ['rectangle', 'circle', 'text'].includes(obj.type) &&
            typeof obj.color === 'string' &&
            typeof obj.createdAt === 'number' &&
            typeof obj.updatedAt === 'number'
        );

        if (!baseValid) return false;

        switch (obj.type) {
            case 'rectangle':
                return typeof obj.width === 'number' && typeof obj.height === 'number';
            case 'circle':
                return typeof obj.radius === 'number';
            case 'text':
                return typeof obj.text === 'string' && typeof obj.fontSize === 'number';
            default:
                return false;
        }
    }

    private debouncedSave(roomId: string, state: CanvasState): void {
        // Clear existing timeout
        const existingTimeout = this.saveTimeout.get(roomId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new timeout
        const timeout = setTimeout(async () => {
            try {
                await this.saveRoomStateToDisk(roomId, state);
                console.log(`💾 Saved canvas state for room: ${roomId} (${state.objects.length} objects)`);
            } catch (error) {
                console.error(`❌ Failed to save room state ${roomId}:`, error);
            } finally {
                this.saveTimeout.delete(roomId);
            }
        }, this.SAVE_DEBOUNCE_MS);

        this.saveTimeout.set(roomId, timeout);
    }

    /**
     * Get canvas state for a room
     */
    public async getCanvasState(roomId: string): Promise<CanvasState | undefined> {
        // First check memory cache
        let state = this.roomStates.get(roomId);

        // If not in memory, try to load from disk
        if (!state) {
            state = await this.loadRoomStateFromDisk(roomId);
            if (state) {
                this.roomStates.set(roomId, state);
            }
        }

        this.stats.lastActivity = Date.now();
        return state;
    }

    /**
     * Create or update a canvas object in a room
     */
    public async createOrUpdateObject(roomId: string, object: CanvasObject): Promise<void> {
        let state = this.roomStates.get(roomId);

        if (!state) {
            // Create new room state
            state = {
                roomId,
                objects: [],
                lastUpdated: Date.now(),
                version: 1
            };
            this.roomStates.set(roomId, state);
            this.stats.totalRooms++;
        }

        // Check object limit
        const existingIndex = state.objects.findIndex(obj => obj.id === object.id);
        if (existingIndex === -1 && state.objects.length >= this.MAX_OBJECTS_PER_ROOM) {
            throw new Error(`Room ${roomId} has reached maximum object limit of ${this.MAX_OBJECTS_PER_ROOM}`);
        }

        // Add or update object
        if (existingIndex >= 0) {
            state.objects[existingIndex] = object;
        } else {
            state.objects.push(object);
            this.stats.totalObjects++;
        }

        // Update metadata
        state.lastUpdated = Date.now();
        state.version++;

        // Debounced save to disk
        this.debouncedSave(roomId, state);
        this.stats.lastActivity = Date.now();
    }

    /**
     * Update specific properties of an object
     */
    public async updateObject(roomId: string, objectId: string, updates: Partial<CanvasObject>): Promise<boolean> {
        const state = this.roomStates.get(roomId);
        if (!state) return false;

        const objectIndex = state.objects.findIndex(obj => obj.id === objectId);
        if (objectIndex === -1) return false;

        // Apply updates carefully to maintain type safety
        const currentObject = state.objects[objectIndex];
        state.objects[objectIndex] = {
            ...currentObject,
            ...updates,
            updatedAt: Date.now()
        } as CanvasObject;

        // Update metadata
        state.lastUpdated = Date.now();
        state.version++;

        // Debounced save to disk
        this.debouncedSave(roomId, state);
        this.stats.lastActivity = Date.now();

        return true;
    }

    /**
     * Delete an object from a room
     */
    public async deleteObject(roomId: string, objectId: string): Promise<boolean> {
        const state = this.roomStates.get(roomId);
        if (!state) return false;

        const initialLength = state.objects.length;
        state.objects = state.objects.filter(obj => obj.id !== objectId);

        if (state.objects.length === initialLength) {
            return false; // Object not found
        }

        // Update metadata
        state.lastUpdated = Date.now();
        state.version++;
        this.stats.totalObjects--;

        // Debounced save to disk
        this.debouncedSave(roomId, state);
        this.stats.lastActivity = Date.now();

        return true;
    }

    /**
     * Clear all objects in a room
     */
    public async clearRoom(roomId: string): Promise<void> {
        const state = this.roomStates.get(roomId);
        if (!state) return;

        const objectCount = state.objects.length;
        state.objects = [];
        state.lastUpdated = Date.now();
        state.version++;
        this.stats.totalObjects -= objectCount;

        // Immediate save for clear operation
        await this.saveRoomStateToDisk(roomId, state);
        this.stats.lastActivity = Date.now();
    }

    /**
     * Delete a room entirely
     */
    public async deleteRoom(roomId: string): Promise<void> {
        const state = this.roomStates.get(roomId);
        if (state) {
            this.stats.totalObjects -= state.objects.length;
            this.stats.totalRooms--;
        }

        this.roomStates.delete(roomId);

        // Clear any pending save
        const timeout = this.saveTimeout.get(roomId);
        if (timeout) {
            clearTimeout(timeout);
            this.saveTimeout.delete(roomId);
        }

        // Delete file
        try {
            await fs.unlink(this.getRoomFilePath(roomId));
        } catch (error) {
            if ((error as any).code !== 'ENOENT') {
                console.error(`❌ Error deleting room file ${roomId}:`, error);
            }
        }

        this.stats.lastActivity = Date.now();
    }

    /**
     * Get persistence statistics
     */
    public getStats(): PersistenceStats {
        return { ...this.stats };
    }

    /**
     * Get list of rooms with their basic info
     */
    public getRoomList(): Array<{ roomId: string; objectCount: number; lastUpdated: number; version: number }> {
        return Array.from(this.roomStates.entries()).map(([roomId, state]) => ({
            roomId,
            objectCount: state.objects.length,
            lastUpdated: state.lastUpdated,
            version: state.version
        }));
    }

    /**
     * Force save all pending changes
     */
    public async forceSaveAll(): Promise<void> {
        const pendingSaves: Promise<void>[] = [];

        for (const [roomId, state] of this.roomStates) {
            // Clear timeout and save immediately
            const timeout = this.saveTimeout.get(roomId);
            if (timeout) {
                clearTimeout(timeout);
                this.saveTimeout.delete(roomId);
            }

            pendingSaves.push(this.saveRoomStateToDisk(roomId, state));
        }

        try {
            await Promise.all(pendingSaves);
            console.log(`💾 Force saved ${pendingSaves.length} room states`);
        } catch (error) {
            console.error('❌ Error during force save:', error);
            throw error;
        }
    }

    /**
     * Cleanup resources
     */
    public async shutdown(): Promise<void> {
        console.log('🛑 Shutting down Canvas Persistence Service...');

        // Clear all pending timeouts
        for (const timeout of this.saveTimeout.values()) {
            clearTimeout(timeout);
        }
        this.saveTimeout.clear();

        // Force save all pending changes
        await this.forceSaveAll();

        // Clear memory
        this.roomStates.clear();

        console.log('✅ Canvas Persistence Service shut down');
    }
}

// Export singleton instance
export const canvasPersistence = new CanvasPersistenceService();
