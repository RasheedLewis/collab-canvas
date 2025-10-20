/**
 * Database Index
 * 
 * Exports all database-related services, schemas, and utilities.
 */

// Core Database Services
export { firestoreService, FirestoreService } from './firestoreService';
export { migrationService, MigrationService } from './migrationService';

// Database Schema and Types
export * from './firestoreSchema';

// Re-export types for convenience
export type {
    DatabaseResult,
    PaginatedResult
} from './firestoreService';

export type {
    MigrationResult,
    MigrationOptions
} from './migrationService';
