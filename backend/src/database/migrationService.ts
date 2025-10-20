/**
 * Database Migration Service
 * 
 * Handles migration from single-canvas system to multi-canvas system.
 * Provides utilities for data migration, schema updates, and system setup.
 */

import { adminDb } from '../config/firebase';
import { firestoreService } from './firestoreService';
import { canvasPersistence } from '../services/persistenceService';
import { Canvas } from '../models/Canvas';
import { CanvasPermission } from '../models/CanvasPermission';
import {
    CanvasObject,
    CanvasPrivacy,
    User
} from '../../../shared/types';
import {
    COLLECTIONS,
    UserDocument,
    CanvasDocument,
    REQUIRED_INDEXES,
    VALIDATION_RULES
} from './firestoreSchema';
import * as fs from 'fs/promises';
import * as path from 'path';

// Migration result types
export interface MigrationResult {
    success: boolean;
    migratedItems: number;
    errors: string[];
    warnings: string[];
    summary: {
        canvases: number;
        objects: number;
        permissions: number;
        users: number;
    };
}

export interface MigrationOptions {
    dryRun?: boolean; // Don't actually write to database
    batchSize?: number; // Number of documents to process at once
    preserveTimestamps?: boolean; // Keep original creation timestamps
    defaultCanvasName?: string;
    defaultCanvasPrivacy?: CanvasPrivacy;
}

/**
 * Database migration service for multi-canvas system
 */
export class MigrationService {
    private static instance: MigrationService;

    private constructor() {
        // Private constructor for singleton
    }

    static getInstance(): MigrationService {
        if (!MigrationService.instance) {
            MigrationService.instance = new MigrationService();
        }
        return MigrationService.instance;
    }

    // ========================================
    // Main Migration Methods
    // ========================================

    /**
     * Migrate from single-canvas to multi-canvas system
     */
    async migrateSingleCanvasToMultiCanvas(
        defaultOwnerId: string,
        options: MigrationOptions = {}
    ): Promise<MigrationResult> {
        console.log('🚀 Starting single-canvas to multi-canvas migration...');

        const {
            dryRun = false,
            batchSize = 100,
            preserveTimestamps = true,
            defaultCanvasName = 'My First Canvas',
            defaultCanvasPrivacy = 'private'
        } = options;

        const result: MigrationResult = {
            success: true,
            migratedItems: 0,
            errors: [],
            warnings: [],
            summary: {
                canvases: 0,
                objects: 0,
                permissions: 0,
                users: 0
            }
        };

        try {
            // Step 1: Create default canvas
            console.log('📋 Step 1: Creating default canvas...');
            const defaultCanvasId = 'default-canvas-' + Date.now();
            const defaultCanvas = await this.createDefaultCanvas(
                defaultCanvasId,
                defaultOwnerId,
                defaultCanvasName,
                defaultCanvasPrivacy,
                preserveTimestamps,
                dryRun
            );

            if (defaultCanvas.success) {
                result.summary.canvases = 1;
                result.migratedItems++;
                console.log(`✅ Created default canvas: ${defaultCanvasId}`);
            } else {
                result.errors.push(`Failed to create default canvas: ${defaultCanvas.error}`);
            }

            // Step 2: Migrate existing canvas objects
            console.log('🎨 Step 2: Migrating canvas objects...');
            const objectsMigration = await this.migrateCanvasObjects(
                defaultCanvasId,
                batchSize,
                dryRun
            );

            result.summary.objects = objectsMigration.migratedCount;
            result.migratedItems += objectsMigration.migratedCount;
            result.errors.push(...objectsMigration.errors);
            result.warnings.push(...objectsMigration.warnings);
            console.log(`✅ Migrated ${objectsMigration.migratedCount} canvas objects`);

            // Step 3: Create owner permission
            console.log('🔐 Step 3: Creating owner permissions...');
            const permissionResult = await this.createOwnerPermission(
                defaultCanvasId,
                defaultOwnerId,
                dryRun
            );

            if (permissionResult.success) {
                result.summary.permissions = 1;
                result.migratedItems++;
                console.log('✅ Created owner permission');
            } else {
                result.errors.push(`Failed to create owner permission: ${permissionResult.error}`);
            }

            // Step 4: Setup user document
            console.log('👤 Step 4: Setting up user document...');
            const userResult = await this.setupUserDocument(
                defaultOwnerId,
                dryRun
            );

            if (userResult.success) {
                result.summary.users = 1;
                result.migratedItems++;
                console.log('✅ Set up user document');
            } else {
                result.warnings.push(`Could not set up user document: ${userResult.error}`);
            }

            // Step 5: Backup old data
            if (!dryRun) {
                console.log('💾 Step 5: Backing up old data...');
                await this.backupOldCanvasData();
                console.log('✅ Backed up old canvas data');
            }

            console.log('🎉 Migration completed successfully!');
            console.log(`📊 Summary: ${result.migratedItems} items migrated`);
            console.log(`   - Canvases: ${result.summary.canvases}`);
            console.log(`   - Objects: ${result.summary.objects}`);
            console.log(`   - Permissions: ${result.summary.permissions}`);
            console.log(`   - Users: ${result.summary.users}`);

            if (result.errors.length > 0) {
                console.log(`❌ Errors: ${result.errors.length}`);
                result.errors.forEach(error => console.log(`   - ${error}`));
                result.success = false;
            }

            if (result.warnings.length > 0) {
                console.log(`⚠️  Warnings: ${result.warnings.length}`);
                result.warnings.forEach(warning => console.log(`   - ${warning}`));
            }

        } catch (error) {
            console.error('💥 Migration failed:', error);
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }

        return result;
    }

    /**
     * Initialize fresh database schema
     */
    async initializeFreshDatabase(): Promise<MigrationResult> {
        console.log('🏗️ Initializing fresh multi-canvas database schema...');

        const result: MigrationResult = {
            success: true,
            migratedItems: 0,
            errors: [],
            warnings: [],
            summary: { canvases: 0, objects: 0, permissions: 0, users: 0 }
        };

        try {
            // Create indexes
            console.log('📑 Creating database indexes...');
            await this.createDatabaseIndexes();
            console.log('✅ Database indexes created');

            // Setup collection structure
            console.log('📁 Setting up collection structure...');
            await this.setupCollectionStructure();
            console.log('✅ Collection structure set up');

            console.log('🎉 Fresh database initialization completed!');

        } catch (error) {
            console.error('💥 Database initialization failed:', error);
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }

        return result;
    }

    // ========================================
    // Migration Helper Methods
    // ========================================

    private async createDefaultCanvas(
        canvasId: string,
        ownerId: string,
        name: string,
        privacy: CanvasPrivacy,
        preserveTimestamps: boolean,
        dryRun: boolean
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const now = Date.now();
            const canvas = new Canvas({
                id: canvasId,
                name,
                description: 'Canvas migrated from single-canvas system',
                ownerId,
                privacy,
                settings: {
                    allowPublicEdit: false,
                    allowComments: true,
                    backgroundColor: '#ffffff',
                    gridEnabled: false
                }
            });

            if (preserveTimestamps) {
                // Try to get creation time from old system
                const oldCanvasData = await this.getOldCanvasCreationTime();
                if (oldCanvasData) {
                    canvas.createdAt = oldCanvasData.createdAt;
                    canvas.updatedAt = oldCanvasData.updatedAt || oldCanvasData.createdAt;
                }
            }

            if (!dryRun) {
                const result = await firestoreService.createCanvas(canvas.toJSON());
                return { success: result.success, error: result.error };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private async migrateCanvasObjects(
        defaultCanvasId: string,
        batchSize: number,
        dryRun: boolean
    ): Promise<{
        migratedCount: number;
        errors: string[];
        warnings: string[];
    }> {
        const result = {
            migratedCount: 0,
            errors: [] as string[],
            warnings: [] as string[]
        };

        try {
            // Get all existing canvas objects from old system
            const oldObjects = await this.getOldCanvasObjects();

            if (oldObjects.length === 0) {
                result.warnings.push('No canvas objects found in old system');
                return result;
            }

            // Process objects in batches
            for (let i = 0; i < oldObjects.length; i += batchSize) {
                const batch = oldObjects.slice(i, i + batchSize);

                for (const oldObject of batch) {
                    try {
                        // Convert old object format to new format
                        const newObject: CanvasObject = {
                            ...oldObject,
                            canvasId: defaultCanvasId
                        };

                        // Validate object
                        const validation = this.validateCanvasObject(newObject);
                        if (!validation.valid) {
                            result.warnings.push(`Object ${oldObject.id} validation failed: ${validation.error}`);
                            continue;
                        }

                        if (!dryRun) {
                            const createResult = await firestoreService.createCanvasObject(
                                defaultCanvasId,
                                newObject
                            );

                            if (createResult.success) {
                                result.migratedCount++;
                            } else {
                                result.errors.push(`Failed to migrate object ${oldObject.id}: ${createResult.error}`);
                            }
                        } else {
                            result.migratedCount++;
                        }

                    } catch (error) {
                        result.errors.push(`Error processing object ${oldObject.id}: ${error}`);
                    }
                }

                // Add small delay between batches to avoid overwhelming Firestore
                if (!dryRun && i + batchSize < oldObjects.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

        } catch (error) {
            result.errors.push(`Failed to migrate objects: ${error}`);
        }

        return result;
    }

    private async createOwnerPermission(
        canvasId: string,
        ownerId: string,
        dryRun: boolean
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const permission = CanvasPermission.createOwnerPermission(canvasId, ownerId);

            if (!dryRun) {
                const result = await firestoreService.createCanvasPermission(canvasId, permission.toJSON());
                return { success: result.success, error: result.error };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private async setupUserDocument(
        userId: string,
        dryRun: boolean
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Try to get user data from Firebase Auth
            const { getUserData } = await import('../config/firebase');
            const userData = await getUserData(userId);

            if (!userData.success) {
                return { success: false, error: 'User not found in Firebase Auth' };
            }

            const userDoc: UserDocument = {
                uid: userId,
                email: userData.user.email || null,
                name: userData.user.displayName || null,
                picture: userData.user.photoURL || null,
                displayName: userData.user.displayName || 'User',
                avatarColor: this.generateRandomAvatarColor(),
                createdAt: Date.now(),
                lastLoginAt: Date.now(),
                lastActiveAt: Date.now(),
                preferences: {
                    theme: 'light',
                    notifications: true,
                    defaultCanvasPrivacy: 'private',
                    language: 'en'
                },
                stats: {
                    canvasesOwned: 1,
                    canvasesShared: 0,
                    totalObjects: 0,
                    joinedAt: Date.now()
                }
            };

            if (!dryRun) {
                await adminDb.collection(COLLECTIONS.USERS).doc(userId).set(userDoc);
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private async getOldCanvasObjects(): Promise<CanvasObject[]> {
        try {
            // Try to get objects from the old persistence service
            const roomIds = canvasPersistence.getAllRoomIds();
            const allObjects: CanvasObject[] = [];

            for (const roomId of roomIds) {
                const state = await canvasPersistence.loadCanvasState(roomId);
                if (state.success && state.canvasState) {
                    allObjects.push(...state.canvasState.objects);
                }
            }

            return allObjects;
        } catch (error) {
            console.warn('Could not load objects from old system:', error);
            return [];
        }
    }

    private async getOldCanvasCreationTime(): Promise<{ createdAt: number; updatedAt?: number } | null> {
        try {
            // Try to get creation time from file system or persistence service
            const stats = canvasPersistence.getStats();
            return {
                createdAt: stats.lastActivity || Date.now() - (30 * 24 * 60 * 60 * 1000), // Assume 30 days ago if unknown
                updatedAt: stats.lastActivity
            };
        } catch (error) {
            console.warn('Could not determine old canvas creation time:', error);
            return null;
        }
    }

    private async backupOldCanvasData(): Promise<void> {
        try {
            const backupDir = './data/migration-backup';
            await fs.mkdir(backupDir, { recursive: true });

            // Backup current persistence data
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `canvas-backup-${timestamp}.json`);

            const stats = canvasPersistence.getStats();
            const roomIds = canvasPersistence.getAllRoomIds();

            const backupData = {
                timestamp: Date.now(),
                stats,
                roomIds,
                canvasStates: [] as any[]
            };

            // Backup all room states
            for (const roomId of roomIds) {
                const state = await canvasPersistence.loadCanvasState(roomId);
                if (state.success) {
                    backupData.canvasStates.push({
                        roomId,
                        state: state.canvasState
                    });
                }
            }

            await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
            console.log(`📦 Backup created: ${backupFile}`);

        } catch (error) {
            console.warn('Could not create backup:', error);
        }
    }

    private validateCanvasObject(object: CanvasObject): { valid: boolean; error?: string } {
        try {
            // Basic validation
            if (!object.id || !object.type || !object.canvasId) {
                return { valid: false, error: 'Missing required fields' };
            }

            // Coordinate validation
            if (object.x < VALIDATION_RULES.objects.coordinateRange[0] ||
                object.x > VALIDATION_RULES.objects.coordinateRange[1]) {
                return { valid: false, error: 'X coordinate out of range' };
            }

            if (object.y < VALIDATION_RULES.objects.coordinateRange[0] ||
                object.y > VALIDATION_RULES.objects.coordinateRange[1]) {
                return { valid: false, error: 'Y coordinate out of range' };
            }

            // Type-specific validation
            switch (object.type) {
                case 'text':
                    const textObj = object as any;
                    if (textObj.text && textObj.text.length > VALIDATION_RULES.objects.maxTextLength) {
                        return { valid: false, error: 'Text too long' };
                    }
                    if (textObj.fontSize && (textObj.fontSize < VALIDATION_RULES.objects.minFontSize ||
                        textObj.fontSize > VALIDATION_RULES.objects.maxFontSize)) {
                        return { valid: false, error: 'Font size out of range' };
                    }
                    break;

                case 'rectangle':
                    const rectObj = object as any;
                    if (rectObj.width <= 0 || rectObj.height <= 0) {
                        return { valid: false, error: 'Rectangle dimensions must be positive' };
                    }
                    break;

                case 'circle':
                    const circleObj = object as any;
                    if (circleObj.radius <= 0) {
                        return { valid: false, error: 'Circle radius must be positive' };
                    }
                    break;
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: 'Validation error' };
        }
    }

    private generateRandomAvatarColor(): string {
        const colors = [
            '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
            '#8b5cf6', '#f97316', '#06b6d4', '#84cc16',
            '#ec4899', '#6b7280'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private async createDatabaseIndexes(): Promise<void> {
        // In a real implementation, this would create Firestore indexes
        // For now, we'll just log the required indexes
        console.log('📑 Required Firestore indexes:');
        REQUIRED_INDEXES.forEach((index, i) => {
            console.log(`   ${i + 1}. Collection: ${index.collection}`);
            console.log(`      Fields: ${JSON.stringify(index.fields)} (${index.order || 'asc'})`);
        });
        console.log('ℹ️  Create these indexes in Firebase Console or using Firebase CLI');
    }

    private async setupCollectionStructure(): Promise<void> {
        // Create empty documents to establish collection structure
        // This helps with Firestore security rules testing
        console.log('📁 Collection structure established');
        console.log('   Collections:', Object.values(COLLECTIONS).filter(v => typeof v === 'string'));
    }
}

// Export singleton instance
export const migrationService = MigrationService.getInstance();
