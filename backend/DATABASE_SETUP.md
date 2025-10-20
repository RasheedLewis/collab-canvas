# CollabCanvas Database Setup Guide

This guide covers setting up the multi-canvas Firestore database schema and migrating from the single-canvas system.

## Overview

The CollabCanvas application uses Firebase Firestore for data persistence with a multi-canvas architecture. Each canvas is isolated with its own objects, permissions, and activity logs.

## Database Schema

### Collections Structure

```
/users/{userId}                           - User profiles and preferences
/canvases/{canvasId}                      - Canvas metadata and settings
/canvases/{canvasId}/objects/{objectId}   - Canvas objects (rectangles, circles, text)
/canvases/{canvasId}/permissions/{userId} - User permissions for the canvas
/canvases/{canvasId}/presence/{userId}    - Real-time user presence
/canvases/{canvasId}/activity/{activityId} - Canvas activity log
/invitations/{invitationId}               - Canvas collaboration invitations
/shareable_links/{linkId}                 - Public/shareable canvas links
/audit_logs/{logId}                       - Security and compliance audit logs
```

### Permission Roles

- **Owner**: Full access including sharing and permission management
- **Editor**: Can view, edit objects, and add/delete content  
- **Viewer**: Can view canvas and add comments

## Setup Instructions

### 1. Prerequisites

- Node.js 16+ installed
- Firebase project created
- Firebase Admin SDK configured
- Firestore enabled in Firebase project

### 2. Environment Configuration

Create `.env` file in the backend directory:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### 3. Initialize Fresh Database

For new installations:

```bash
# Initialize database schema
npm run db:init

# Deploy security rules (requires Firebase CLI)
firebase deploy --only firestore:rules

# Deploy indexes (requires Firebase CLI)  
firebase deploy --only firestore:indexes
```

### 4. Migrate Existing Data

For existing single-canvas installations:

```bash
# Run migration (replace USER_ID with actual Firebase Auth user ID)
npm run migrate -- --owner-id=USER_ID

# Or run as dry-run first to test
npm run migrate -- --owner-id=USER_ID --dry-run
```

### 5. Validation

Validate your database setup:

```bash
# Check database configuration
npm run db:validate

# View required indexes
npm run db:indexes
```

## Database Operations

### CLI Commands

```bash
# Database setup and migration
npm run setup:database -- --help    # Show all available commands
npm run db:init                      # Initialize fresh database
npm run migrate                      # Migrate from single-canvas
npm run db:validate                  # Validate configuration
npm run db:indexes                   # Show required indexes

# Advanced options
npm run migrate -- --owner-id=user123 --dry-run  # Test migration
npm run setup:database -- migrate --owner-id=user123  # Full migration
```

### Required Indexes

The application requires composite indexes for optimal performance. These are automatically configured via `firestore.indexes.json`:

**Key Indexes:**
- Canvas queries: `ownerId + isArchived + createdAt`
- Permission queries: `userId + isActive + grantedAt`  
- Object queries: `isDeleted + updatedAt`
- Activity queries: `timestamp (desc)`
- Search queries: `searchTerms (array) + privacy + updatedAt`

### Security Rules

Firestore security rules enforce canvas-level permissions:

- Users can only access canvases they have permissions for
- Public canvases are readable by anyone
- Object operations require appropriate role (Editor+ for editing)
- Permission management requires Owner role
- Audit logs are system-only

## Data Migration

### Migration Process

1. **Creates default canvas** with specified owner
2. **Migrates canvas objects** from old persistence system  
3. **Sets up owner permissions** for the canvas
4. **Creates user document** with profile information
5. **Backs up old data** to `./data/migration-backup/`

### Migration Options

```typescript
interface MigrationOptions {
    dryRun?: boolean;           // Test without writing data
    batchSize?: number;         // Objects per batch (default: 50)
    preserveTimestamps?: boolean; // Keep original dates (default: true)
    defaultCanvasName?: string; // Name for migrated canvas
    defaultCanvasPrivacy?: 'private' | 'public'; // Canvas privacy
}
```

## Troubleshooting

### Common Issues

**Firebase Authentication Error**
```bash
Error: Firebase configuration error
```
- Check environment variables are set correctly
- Ensure service account has proper permissions
- Verify Firebase project ID is correct

**Permission Denied**
```bash
Error: Missing or insufficient permissions
```
- Check Firestore security rules are deployed
- Verify user has proper authentication
- Ensure user exists in Firebase Auth

**Index Missing**
```bash
Error: The query requires an index
```
- Deploy indexes: `firebase deploy --only firestore:indexes`
- Wait for index creation (can take several minutes)
- Check Firebase Console > Firestore > Indexes

### Debugging

Enable debug logging:

```bash
# Set debug environment variable
export DEBUG=collab-canvas:*

# Run commands with verbose logging
npm run db:validate
```

## Production Deployment

### Checklist

- [ ] Environment variables configured
- [ ] Security rules deployed
- [ ] Database indexes created  
- [ ] User authentication working
- [ ] Canvas permissions tested
- [ ] Backup strategy implemented

### Monitoring

Monitor your database:

- **Firestore Usage**: Check document reads/writes in Firebase Console
- **Security Rules**: Monitor rule evaluations and denials
- **Performance**: Track query performance and index usage
- **Audit Logs**: Review security events and access patterns

### Backup Strategy

- **Automatic**: Firestore automatically backs up data
- **Manual**: Use `gcloud firestore export` for manual backups
- **Migration**: Old data is backed up to `./data/migration-backup/`

## API Integration

Update your application code to use the new multi-canvas API:

```typescript
// Import the database service
import { firestoreService } from './src/database/firestoreService';

// Canvas operations
const canvas = await firestoreService.getCanvas(canvasId);
const objects = await firestoreService.getCanvasObjects(canvasId);

// Permission checking (handled by middleware)
app.get('/api/canvas/:canvasId', 
    requireCanvasPermission('view'),
    getCanvasHandler
);
```

## Support

For issues or questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review Firebase Console for errors
3. Check application logs for detailed error messages
4. Verify security rules and indexes are properly deployed
