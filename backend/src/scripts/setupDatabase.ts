#!/usr/bin/env ts-node

/**
 * Database Setup and Migration CLI Script
 * 
 * Provides commands to set up the multi-canvas database schema and migrate data.
 * 
 * Usage:
 *   npm run setup:database -- --help
 *   npm run setup:database -- init
 *   npm run setup:database -- migrate --owner-id=<userId>
 *   npm run setup:database -- indexes
 */

import { Command } from 'commander';
import { migrationService } from '../database/migrationService';
import { firestoreService } from '../database/firestoreService';
import { adminDb } from '../config/firebase';
import { COLLECTIONS, REQUIRED_INDEXES } from '../database/firestoreSchema';
import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();

// CLI Interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question: string): Promise<string> {
    return new Promise(resolve => {
        rl.question(question, resolve);
    });
}

// ========================================
// Command Implementations
// ========================================

/**
 * Initialize fresh database schema
 */
async function initializeDatabase(): Promise<void> {
    console.log('🏗️ Initializing CollabCanvas Multi-Canvas Database Schema');
    console.log('='.repeat(60));

    try {
        // Check if Firebase is configured
        await checkFirebaseConfiguration();

        console.log('📋 This will set up the database schema for multi-canvas support.');
        console.log('📋 Collections that will be created:');

        Object.entries(COLLECTIONS).forEach(([key, value]) => {
            if (typeof value === 'string') {
                console.log(`   - ${value}`);
            }
        });

        const proceed = await askQuestion('\n❓ Do you want to proceed? (y/N): ');
        if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
            console.log('❌ Database initialization cancelled');
            process.exit(0);
        }

        // Initialize database
        const result = await migrationService.initializeFreshDatabase();

        if (result.success) {
            console.log('\n🎉 Database initialization completed successfully!');
            console.log('\n📝 Next steps:');
            console.log('   1. Deploy Firestore security rules: firebase deploy --only firestore:rules');
            console.log('   2. Create Firestore indexes: firebase deploy --only firestore:indexes');
            console.log('   3. Run migration if you have existing data: npm run setup:database -- migrate');
        } else {
            console.log('\n❌ Database initialization failed:');
            result.errors.forEach(error => console.log(`   - ${error}`));
            process.exit(1);
        }

    } catch (error) {
        console.error('\n💥 Initialization failed:', error);
        process.exit(1);
    } finally {
        rl.close();
    }
}

/**
 * Migrate from single-canvas to multi-canvas
 */
async function migrateDatabase(options: { ownerId?: string; dryRun?: boolean }): Promise<void> {
    console.log('🚀 CollabCanvas Single-Canvas to Multi-Canvas Migration');
    console.log('='.repeat(60));

    try {
        // Get owner ID if not provided
        let ownerId = options.ownerId;
        if (!ownerId) {
            console.log('📋 You need to specify the user ID who will own the migrated canvas.');
            console.log('📋 This should be a valid Firebase Auth user ID.');
            ownerId = await askQuestion('👤 Enter the canvas owner user ID: ');

            if (!ownerId.trim()) {
                console.log('❌ Owner ID is required for migration');
                process.exit(1);
            }
        }

        // Validate owner ID exists in Firebase Auth
        await validateUserId(ownerId);

        // Show migration overview
        console.log('\n📋 Migration Overview:');
        console.log('   ✅ Create default canvas with owner permissions');
        console.log('   ✅ Migrate existing canvas objects to new schema');
        console.log('   ✅ Set up user profile document');
        console.log('   ✅ Backup existing data');

        if (options.dryRun) {
            console.log('\n🧪 DRY RUN MODE: No data will be written to the database');
        }

        const proceed = await askQuestion('\n❓ Do you want to proceed with migration? (y/N): ');
        if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
            console.log('❌ Migration cancelled');
            process.exit(0);
        }

        // Get migration options
        const canvasName = await askQuestion('📋 Enter name for the default canvas (My First Canvas): ') || 'My First Canvas';
        const privacyInput = await askQuestion('🔒 Canvas privacy (private/public) [private]: ') || 'private';
        const privacy = privacyInput.toLowerCase() === 'public' ? 'public' : 'private';

        console.log('\n🚀 Starting migration...');

        // Run migration
        const result = await migrationService.migrateSingleCanvasToMultiCanvas(ownerId, {
            dryRun: options.dryRun,
            defaultCanvasName: canvasName,
            defaultCanvasPrivacy: privacy,
            preserveTimestamps: true,
            batchSize: 50
        });

        // Show results
        if (result.success) {
            console.log('\n🎉 Migration completed successfully!');
            console.log(`📊 Migration Summary:`);
            console.log(`   - Canvases: ${result.summary.canvases}`);
            console.log(`   - Objects: ${result.summary.objects}`);
            console.log(`   - Permissions: ${result.summary.permissions}`);
            console.log(`   - Users: ${result.summary.users}`);
            console.log(`   - Total items: ${result.migratedItems}`);

            if (!options.dryRun) {
                console.log('\n📝 Next steps:');
                console.log('   1. Test the new multi-canvas system');
                console.log('   2. Update your frontend to use the new API endpoints');
                console.log('   3. Remove old single-canvas code when ready');
            }
        } else {
            console.log('\n❌ Migration failed:');
            result.errors.forEach(error => console.log(`   - ${error}`));

            if (result.warnings.length > 0) {
                console.log('\n⚠️  Warnings:');
                result.warnings.forEach(warning => console.log(`   - ${warning}`));
            }

            process.exit(1);
        }

    } catch (error) {
        console.error('\n💥 Migration failed:', error);
        process.exit(1);
    } finally {
        rl.close();
    }
}

/**
 * Generate and display required database indexes
 */
async function showIndexes(): Promise<void> {
    console.log('📑 Required Firestore Database Indexes');
    console.log('='.repeat(60));

    try {
        console.log('📋 The following indexes are required for optimal query performance:');
        console.log();

        REQUIRED_INDEXES.forEach((index, i) => {
            console.log(`${i + 1}. Collection: ${index.collection}`);
            console.log(`   Fields: [${index.fields.join(', ')}]`);
            console.log(`   Order: ${index.order || 'asc'}`);
            console.log();
        });

        console.log('📝 To create these indexes:');
        console.log();
        console.log('   Method 1 - Firebase CLI (Recommended):');
        console.log('     firebase deploy --only firestore:indexes');
        console.log();
        console.log('   Method 2 - Firebase Console:');
        console.log('     1. Go to Firebase Console > Firestore > Indexes');
        console.log('     2. Create composite indexes using the fields above');
        console.log();
        console.log('   Method 3 - Auto-create via queries:');
        console.log('     Run your application and make queries - Firestore will suggest indexes');

        // Check if indexes file exists
        const indexesFile = path.join(__dirname, '../../firestore.indexes.json');
        try {
            await fs.access(indexesFile);
            console.log(`\n📄 Index configuration file: ${indexesFile}`);
        } catch {
            console.log('\n⚠️  Index configuration file not found');
        }

    } catch (error) {
        console.error('💥 Error showing indexes:', error);
        process.exit(1);
    }
}

/**
 * Validate database connection and status
 */
async function validateDatabase(): Promise<void> {
    console.log('🔍 Validating Database Configuration');
    console.log('='.repeat(60));

    try {
        // Check Firebase configuration
        await checkFirebaseConfiguration();

        // Check collections
        console.log('\n📁 Checking collection structure...');

        const collections = await adminDb.listCollections();
        const collectionIds = collections.map(col => col.id);

        console.log(`   Found ${collectionIds.length} collections:`);
        collectionIds.forEach(id => console.log(`   - ${id}`));

        // Check for multi-canvas collections
        const hasCanvases = collectionIds.includes('canvases');
        const hasUsers = collectionIds.includes('users');

        console.log('\n🏗️ Multi-canvas schema status:');
        console.log(`   Canvases collection: ${hasCanvases ? '✅' : '❌'}`);
        console.log(`   Users collection: ${hasUsers ? '✅' : '❌'}`);

        if (hasCanvases) {
            const canvasCount = await adminDb.collection('canvases').count().get();
            console.log(`   Total canvases: ${canvasCount.data().count}`);
        }

        if (hasUsers) {
            const userCount = await adminDb.collection('users').count().get();
            console.log(`   Total users: ${userCount.data().count}`);
        }

        console.log('\n✅ Database validation completed');

    } catch (error) {
        console.error('\n💥 Database validation failed:', error);
        process.exit(1);
    }
}

// ========================================
// Helper Functions
// ========================================

async function checkFirebaseConfiguration(): Promise<void> {
    try {
        // Try to access Firestore
        await adminDb.collection('_test').limit(1).get();
        console.log('✅ Firebase configuration is valid');
    } catch (error) {
        console.error('❌ Firebase configuration error:', error);
        console.log('\n📋 Please ensure:');
        console.log('   1. Firebase project is set up');
        console.log('   2. Service account credentials are configured');
        console.log('   3. Firestore is enabled in your Firebase project');
        throw error;
    }
}

async function validateUserId(userId: string): Promise<void> {
    try {
        const { getUserData } = await import('../config/firebase');
        const result = await getUserData(userId);

        if (!result.success) {
            throw new Error(`User ID ${userId} not found in Firebase Auth`);
        }

        console.log(`✅ User found: ${result.user.email || result.user.uid}`);
    } catch (error) {
        console.error(`❌ User validation failed: ${error}`);
        throw error;
    }
}

// ========================================
// CLI Setup
// ========================================

program
    .name('setup-database')
    .description('CollabCanvas Database Setup and Migration Tool')
    .version('1.0.0');

program
    .command('init')
    .description('Initialize fresh multi-canvas database schema')
    .action(initializeDatabase);

program
    .command('migrate')
    .description('Migrate from single-canvas to multi-canvas system')
    .option('--owner-id <userId>', 'Firebase Auth user ID who will own the migrated canvas')
    .option('--dry-run', 'Run migration without writing to database')
    .action(migrateDatabase);

program
    .command('indexes')
    .description('Show required Firestore database indexes')
    .action(showIndexes);

program
    .command('validate')
    .description('Validate database configuration and status')
    .action(validateDatabase);

program
    .command('help')
    .description('Show detailed help')
    .action(() => {
        console.log('🛠️ CollabCanvas Database Setup Tool');
        console.log('='.repeat(40));
        console.log();
        console.log('Available Commands:');
        console.log();
        console.log('  init              Initialize fresh database schema');
        console.log('  migrate           Migrate from single to multi-canvas');
        console.log('  indexes           Show required database indexes');
        console.log('  validate          Validate database configuration');
        console.log();
        console.log('Examples:');
        console.log();
        console.log('  # Initialize fresh database');
        console.log('  npm run setup:database -- init');
        console.log();
        console.log('  # Migrate existing data');
        console.log('  npm run setup:database -- migrate --owner-id=user123');
        console.log();
        console.log('  # Test migration without writing data');
        console.log('  npm run setup:database -- migrate --owner-id=user123 --dry-run');
        console.log();
        console.log('  # Show required indexes');
        console.log('  npm run setup:database -- indexes');
    });

// Handle no command
if (process.argv.length <= 2) {
    program.help();
}

// Parse CLI arguments
program.parse(process.argv);
