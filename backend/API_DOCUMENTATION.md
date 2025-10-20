# CollabCanvas API Documentation

This document describes the REST API endpoints for the CollabCanvas multi-canvas system.

## Authentication

All API endpoints require authentication via Firebase ID token in the `Authorization` header:

```http
Authorization: Bearer <firebase-id-token>
```

## Base URL

```
http://localhost:3000/api
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `AUTH_REQUIRED` - Authentication token missing or invalid
- `PERMISSION_DENIED` - Insufficient permissions for the operation
- `VALIDATION_ERROR` - Request data validation failed
- `CANVAS_NOT_FOUND` - Canvas does not exist
- `OBJECT_NOT_FOUND` - Canvas object does not exist
- `INTERNAL_ERROR` - Server-side error

---

## Canvas Management

### Create Canvas

Create a new canvas with the authenticated user as owner.

```http
POST /api/canvas
```

**Request Body:**
```json
{
  "name": "My Canvas",
  "description": "Optional description",
  "privacy": "private",
  "settings": {
    "allowPublicEdit": false,
    "allowComments": true,
    "backgroundColor": "#ffffff",
    "gridEnabled": false
  },
  "tags": ["design", "mockup"],
  "folder": "Projects"
}
```

**Response:**
```json
{
  "success": true,
  "canvas": {
    "id": "canvas-uuid",
    "name": "My Canvas",
    "description": "Optional description",
    "ownerId": "user-id",
    "privacy": "private",
    "createdAt": 1640995200000,
    "updatedAt": 1640995200000,
    "lastAccessedAt": 1640995200000,
    "objectCount": 0,
    "collaboratorCount": 1,
    "settings": { ... },
    "tags": ["design", "mockup"],
    "folder": "Projects",
    "isFavorite": false,
    "isArchived": false
  }
}
```

### Get Canvas

Get canvas details with user permission context.

```http
GET /api/canvas/{canvasId}
```

**Requires:** View permission or public canvas

**Response:**
```json
{
  "success": true,
  "canvas": { ... },
  "userPermission": {
    "role": "owner",
    "canEdit": true,
    "canShare": true,
    "canManage": true,
    "isExpired": false,
    "expiresAt": null
  },
  "collaborators": [
    {
      "userId": "user-id",
      "role": "editor", 
      "grantedAt": 1640995200000
    }
  ]
}
```

### Update Canvas

Update canvas metadata.

```http
PATCH /api/canvas/{canvasId}
```

**Requires:** Owner permission

**Request Body:**
```json
{
  "name": "Updated Canvas Name",
  "description": "New description",
  "privacy": "public",
  "tags": ["updated", "tags"]
}
```

**Response:**
```json
{
  "success": true,
  "canvas": { ... }
}
```

### Delete Canvas

Delete a canvas (soft delete).

```http
DELETE /api/canvas/{canvasId}
```

**Requires:** Owner permission

**Response:**
```json
{
  "success": true,
  "message": "Canvas deleted successfully"
}
```

### Archive Canvas

Archive a canvas to hide it from normal listings.

```http
POST /api/canvas/{canvasId}/archive
```

**Requires:** Owner permission

**Response:**
```json
{
  "success": true,
  "canvas": { ... }
}
```

### Restore Canvas

Restore a canvas from archive.

```http
POST /api/canvas/{canvasId}/restore
```

**Requires:** Owner permission

**Response:**
```json
{
  "success": true,
  "canvas": { ... }
}
```

### Duplicate Canvas

Create a copy of an existing canvas.

```http
POST /api/canvas/{canvasId}/duplicate
```

**Requires:** View permission

**Request Body:**
```json
{
  "name": "Canvas Copy",
  "copyObjects": true
}
```

**Response:**
```json
{
  "success": true,
  "canvas": { ... }
}
```

### Toggle Favorite

Toggle favorite status for a canvas.

```http
POST /api/canvas/{canvasId}/favorite
```

**Requires:** View permission

**Response:**
```json
{
  "success": true,
  "canvas": { ... }
}
```

### Get User Canvases

Get list of canvases for the authenticated user with filtering and pagination.

```http
GET /api/canvas
```

**Query Parameters:**
- `ownedByMe` (boolean, default: true) - Include canvases owned by user
- `sharedWithMe` (boolean, default: false) - Include canvases shared with user
- `privacy` (string) - Filter by privacy: private, public, unlisted
- `isArchived` (boolean, default: false) - Include archived canvases
- `isFavorite` (boolean) - Filter by favorite status
- `folder` (string) - Filter by folder name
- `tags` (string) - Comma-separated tags to filter by
- `sortBy` (string, default: updatedAt) - Sort field: name, createdAt, updatedAt, lastAccessedAt
- `sortDirection` (string, default: desc) - Sort direction: asc, desc
- `limit` (number, default: 20, max: 100) - Number of results
- `cursor` (string) - Pagination cursor

**Response:**
```json
{
  "success": true,
  "canvases": [ ... ],
  "hasMore": true,
  "nextCursor": "cursor-string",
  "totalCount": 150
}
```

### Search Public Canvases

Search publicly available canvases.

```http
GET /api/canvas/search/public
```

**Query Parameters:**
- `q` (string, required, min: 2 chars) - Search term
- `limit` (number, default: 20, max: 50) - Number of results
- `cursor` (string) - Pagination cursor

**Response:**
```json
{
  "success": true,
  "canvases": [ ... ],
  "hasMore": false,
  "nextCursor": null
}
```

---

## Canvas Discovery and Search

### Discover Public Canvases

Discover public canvases with advanced filtering and categorization.

```http
GET /api/discover/canvases
```

**Query Parameters:**
- `q` (string) - Search term for name, description, tags
- `tags` (string) - Comma-separated tags to filter by
- `category` (string) - Discovery category: featured, trending, recent, popular
- `collaboratorName` (string) - Filter by collaborator name
- `excludeUserId` (string) - Exclude canvases from specific user
- `minCollaborators` (number) - Minimum number of collaborators
- `maxCollaborators` (number) - Maximum number of collaborators
- `createdAfter` (number) - Only canvases created after timestamp
- `createdBefore` (number) - Only canvases created before timestamp
- `limit` (number, max: 50, default: 20) - Number of results
- `cursor` (string) - Pagination cursor

**Response:**
```json
{
  "success": true,
  "canvases": [ ... ],
  "hasMore": true,
  "nextCursor": "cursor-string"
}
```

### Get Personalized Recommendations

Get canvas recommendations based on user activity and preferences.

```http
GET /api/discover/recommendations
```

**Requires:** Authentication

**Query Parameters:**
- `limit` (number, default: 10) - Number of recommendations

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "canvas": { ... },
      "score": 85,
      "reason": "similar_tags",
      "metadata": {
        "commonTags": ["design", "ui"],
        "activityScore": 0.8
      }
    }
  ]
}
```

### Get Popular Tags

Get popular tags for browse interface.

```http
GET /api/discover/tags
```

**Query Parameters:**
- `limit` (number, default: 20) - Number of tags

**Response:**
```json
{
  "success": true,
  "tags": [
    {
      "tag": "design",
      "count": 42
    },
    {
      "tag": "wireframe", 
      "count": 28
    }
  ]
}
```

### Generate Canvas Thumbnail

Generate or regenerate a thumbnail for a canvas.

```http
POST /api/discover/thumbnails/{canvasId}/generate
```

**Requires:** View permission

**Query Parameters:**
- `width` (number, default: 400) - Thumbnail width
- `height` (number, default: 300) - Thumbnail height
- `backgroundColor` (string, default: '#ffffff') - Background color
- `quality` (number, 0-1, default: 0.8) - JPEG quality
- `format` (string, default: 'jpeg') - Image format: png, jpeg

**Response:**
```json
{
  "success": true,
  "thumbnailUrl": "/api/thumbnails/canvas-id/thumbnail.jpeg",
  "previewUrl": "/api/thumbnails/canvas-id/preview.jpeg"
}
```

### Update Canvas Thumbnail

Regenerate thumbnail when canvas changes.

```http
PUT /api/discover/thumbnails/{canvasId}/update
```

**Requires:** Edit permission

**Response:**
```json
{
  "success": true,
  "thumbnailUrl": "/api/thumbnails/canvas-id/thumbnail.jpeg",
  "previewUrl": "/api/thumbnails/canvas-id/preview.jpeg",
  "message": "Thumbnail updated successfully"
}
```

### Serve Canvas Thumbnail

Get the actual thumbnail image file.

```http
GET /api/thumbnails/{canvasId}/{type}/{filename}
```

**Parameters:**
- `canvasId` (string) - Canvas ID
- `type` (string) - thumbnail or preview
- `filename` (string) - e.g., thumbnail.jpeg

**Response:** Image file with appropriate content-type headers

### Batch Generate Thumbnails

Generate thumbnails for multiple canvases.

```http
POST /api/discover/thumbnails/batch
```

**Requires:** Authentication

**Request Body:**
```json
{
  "canvasIds": ["canvas-1", "canvas-2", "canvas-3"]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "canvasId": "canvas-1",
      "result": {
        "success": true,
        "thumbnailUrl": "/api/thumbnails/canvas-1/thumbnail.jpeg"
      }
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  }
}
```

### Track Canvas Access

Track user access to canvases for analytics.

```http
POST /api/discover/track/{canvasId}
```

**Requires:** View permission

**Request Body:**
```json
{
  "accessType": "view"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Access tracked successfully"
}
```

### Get Canvas Analytics

Get analytics and usage statistics for a canvas.

```http
GET /api/discover/analytics/{canvasId}
```

**Requires:** View permission

**Query Parameters:**
- `period` (string, default: '7d') - Analytics period

**Response:**
```json
{
  "success": true,
  "analytics": {
    "canvas": {
      "id": "canvas-id",
      "name": "My Canvas",
      "privacy": "public",
      "createdAt": 1640995200000,
      "lastAccessedAt": 1640995200000
    },
    "content": {
      "totalObjects": 25,
      "objectTypes": {
        "rectangle": 10,
        "circle": 8,
        "text": 7
      },
      "lastObjectCreated": 1640995200000
    },
    "collaboration": {
      "totalCollaborators": 3,
      "roles": {
        "owner": 1,
        "editor": 2,
        "viewer": 0
      }
    },
    "activity": {
      "viewCount": 42,
      "editCount": 18,
      "shareCount": 3
    }
  },
  "period": "7d"
}
```

### Get Search Suggestions

Get search term suggestions for autocomplete.

```http
GET /api/discover/search/suggestions
```

**Query Parameters:**
- `q` (string) - Partial search term (min 2 chars)
- `limit` (number, default: 10) - Number of suggestions

**Response:**
```json
{
  "success": true,
  "suggestions": [
    {
      "text": "design system",
      "type": "tag",
      "popularity": 85
    }
  ]
}
```

### Get Discovery Categories

Get available discovery categories with metadata.

```http
GET /api/discover/categories
```

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "id": "featured",
      "name": "Featured",
      "description": "Hand-picked high-quality canvases",
      "count": 25,
      "icon": "⭐"
    },
    {
      "id": "trending",
      "name": "Trending", 
      "description": "Popular canvases with recent activity",
      "count": 42,
      "icon": "🔥"
    }
  ]
}
```

---

## Permission Management

### Get Canvas Permissions

Get all permissions for a canvas.

```http
GET /api/permissions/{canvasId}
```

**Requires:** Manage permission (owner only)

**Response:**
```json
{
  "success": true,
  "permissions": [
    {
      "id": "permission-uuid",
      "canvasId": "canvas-id",
      "userId": "user-id",
      "role": "editor",
      "grantedBy": "owner-id",
      "grantedAt": 1640995200000,
      "expiresAt": null
    }
  ],
  "totalCount": 3
}
```

### Invite Collaborator

Invite a user to collaborate on the canvas via email.

```http
POST /api/permissions/{canvasId}/invite
```

**Requires:** Manage permission (owner only)

**Request Body:**
```json
{
  "email": "collaborator@example.com",
  "role": "editor",
  "message": "Let's work on this design together!",
  "expiresAt": 1640995200000
}
```

**Response:**
```json
{
  "success": true,
  "invitation": {
    "id": "invitation-uuid",
    "canvasId": "canvas-id",
    "inviterUserId": "owner-id",
    "inviteeEmail": "collaborator@example.com",
    "role": "editor",
    "status": "pending",
    "createdAt": 1640995200000,
    "expiresAt": 1640995200000,
    "message": "Let's work on this design together!"
  },
  "message": "Invitation sent to collaborator@example.com"
}
```

### Update Permission

Update a user's role or permissions on a canvas.

```http
PATCH /api/permissions/{canvasId}/{permissionId}
```

**Requires:** Manage permission (owner only)

**Request Body:**
```json
{
  "role": "viewer",
  "expiresAt": 1640995200000
}
```

**Response:**
```json
{
  "success": true,
  "permission": {
    "id": "permission-uuid",
    "canvasId": "canvas-id",
    "userId": "user-id",
    "role": "viewer",
    "grantedBy": "owner-id",
    "grantedAt": 1640995200000,
    "expiresAt": 1640995200000
  }
}
```

### Remove Permission

Remove a user's access from a canvas.

```http
DELETE /api/permissions/{canvasId}/{permissionId}
```

**Requires:** Manage permission (owner only)

**Response:**
```json
{
  "success": true,
  "message": "Permission removed successfully"
}
```

### Toggle Canvas Privacy

Change canvas privacy settings.

```http
PATCH /api/permissions/{canvasId}/privacy
```

**Requires:** Owner permission

**Request Body:**
```json
{
  "privacy": "public"
}
```

**Response:**
```json
{
  "success": true,
  "canvas": { ... },
  "message": "Canvas privacy updated to public"
}
```

### Transfer Ownership

Transfer canvas ownership to another user.

```http
POST /api/permissions/{canvasId}/transfer-ownership
```

**Requires:** Owner permission

**Request Body:**
```json
{
  "newOwnerId": "new-owner-user-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Canvas ownership transferred successfully"
}
```

### Create Shareable Link

Create a shareable link for the canvas.

```http
POST /api/permissions/{canvasId}/links
```

**Requires:** Manage permission (owner only)

**Request Body:**
```json
{
  "role": "viewer",
  "expiresAt": 1640995200000,
  "maxAccess": 100
}
```

**Response:**
```json
{
  "success": true,
  "link": {
    "id": "link-uuid",
    "canvasId": "canvas-id",
    "createdBy": "owner-id",
    "role": "viewer",
    "isActive": true,
    "expiresAt": 1640995200000,
    "createdAt": 1640995200000,
    "accessCount": 0,
    "maxAccess": 100
  },
  "url": "https://collabcanvas.com/canvas/shared/link-uuid"
}
```

### Get Shareable Links

Get all shareable links for a canvas.

```http
GET /api/permissions/{canvasId}/links
```

**Requires:** Manage permission (owner only)

**Response:**
```json
{
  "success": true,
  "links": [
    {
      "id": "link-uuid",
      "canvasId": "canvas-id",
      "createdBy": "owner-id",
      "role": "viewer",
      "isActive": true,
      "expiresAt": 1640995200000,
      "createdAt": 1640995200000,
      "accessCount": 15,
      "maxAccess": 100
    }
  ],
  "totalCount": 1
}
```

### Deactivate Shareable Link

Deactivate a shareable link to prevent further access.

```http
DELETE /api/permissions/{canvasId}/links/{linkId}
```

**Requires:** Manage permission (owner only)

**Response:**
```json
{
  "success": true,
  "message": "Shareable link deactivated successfully"
}
```

### Access Canvas via Shareable Link

Access a canvas using a shareable link (public endpoint).

```http
GET /api/permissions/shared/{linkId}
```

**No authentication required**

**Response:**
```json
{
  "success": true,
  "canvasId": "canvas-id",
  "role": "viewer",
  "canvas": {
    "id": "canvas-id",
    "name": "Shared Design",
    "description": "A publicly shared canvas",
    "privacy": "public"
  },
  "message": "Access granted with viewer permissions"
}
```

### Get Shareable Link Analytics

Get usage analytics for a shareable link.

```http
GET /api/permissions/shared/{linkId}/analytics
```

**Requires:** Manage permission for the canvas

**Response:**
```json
{
  "success": true,
  "linkId": "link-uuid",
  "analytics": {
    "totalAccesses": 45,
    "uniqueAccessors": 23,
    "recentAccesses": [
      {
        "linkId": "link-uuid",
        "accessorId": "user-id",
        "accessorEmail": "user@example.com",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "timestamp": 1640995200000
      }
    ],
    "topReferrers": [
      {
        "userAgent": "Chrome",
        "count": 15
      }
    ]
  }
}
```

### Get Permission Audit Log

Get audit log of permission changes for a canvas.

```http
GET /api/permissions/{canvasId}/audit-log
```

**Requires:** Manage permission (owner only)

**Query Parameters:**
- `limit` (number, default: 50) - Number of entries
- `cursor` (string) - Pagination cursor

**Response:**
```json
{
  "success": true,
  "auditLog": [
    {
      "id": "audit-uuid",
      "eventType": "permission_granted",
      "canvasId": "canvas-id",
      "userId": "owner-id",
      "targetUserId": "collaborator-id",
      "details": {
        "description": "Invited user@example.com as editor",
        "metadata": {
          "inviteeEmail": "user@example.com",
          "role": "editor"
        },
        "riskLevel": "low"
      },
      "timestamp": 1640995200000,
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "totalCount": 5
}
```

### Get User Invitations

Get pending invitations for the authenticated user.

```http
GET /api/permissions/invitations
```

**Requires:** Authentication

**Response:**
```json
{
  "success": true,
  "invitations": [
    {
      "id": "invitation-uuid",
      "canvasId": "canvas-id",
      "inviterUserId": "owner-id",
      "inviteeEmail": "user@example.com",
      "role": "editor",
      "status": "pending",
      "createdAt": 1640995200000,
      "expiresAt": 1640995200000,
      "message": "Join my project!"
    }
  ]
}
```

### Accept/Decline Invitation

Accept or decline a canvas invitation.

```http
POST /api/permissions/invitations/{invitationId}/accept
```

**Requires:** Authentication

**Request Body:**
```json
{
  "accept": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invitation accepted",
  "invitationId": "invitation-uuid"
}
```

---

## Canvas Objects

### Get Canvas Objects

Get all objects in a canvas.

```http
GET /api/canvas/{canvasId}/objects
```

**Requires:** View permission

**Response:**
```json
{
  "success": true,
  "objects": [
    {
      "id": "object-uuid",
      "x": 100,
      "y": 200,
      "type": "rectangle",
      "color": "#ff0000",
      "rotation": 0,
      "createdAt": 1640995200000,
      "updatedAt": 1640995200000,
      "userId": "user-id",
      "canvasId": "canvas-id",
      "width": 150,
      "height": 100
    },
    {
      "id": "object-uuid-2",
      "x": 300,
      "y": 300,
      "type": "circle",
      "color": "#00ff00",
      "rotation": 0,
      "createdAt": 1640995200000,
      "updatedAt": 1640995200000,
      "userId": "user-id",
      "canvasId": "canvas-id",
      "radius": 50
    },
    {
      "id": "object-uuid-3",
      "x": 500,
      "y": 400,
      "type": "text",
      "color": "#0000ff",
      "rotation": 0,
      "createdAt": 1640995200000,
      "updatedAt": 1640995200000,
      "userId": "user-id",
      "canvasId": "canvas-id",
      "text": "Hello World",
      "fontSize": 16,
      "fontFamily": "Arial",
      "fontStyle": "normal"
    }
  ],
  "count": 3
}
```

### Create Canvas Object

Create a new object in the canvas.

```http
POST /api/canvas/{canvasId}/objects
```

**Requires:** Edit permission

**Request Body (Rectangle):**
```json
{
  "type": "rectangle",
  "x": 100,
  "y": 200,
  "color": "#ff0000",
  "rotation": 0,
  "width": 150,
  "height": 100
}
```

**Request Body (Circle):**
```json
{
  "type": "circle",
  "x": 300,
  "y": 300,
  "color": "#00ff00",
  "rotation": 0,
  "radius": 50
}
```

**Request Body (Text):**
```json
{
  "type": "text",
  "x": 500,
  "y": 400,
  "color": "#0000ff",
  "rotation": 0,
  "text": "Hello World",
  "fontSize": 16,
  "fontFamily": "Arial",
  "fontStyle": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "object": { ... }
}
```

### Update Canvas Object

Update an existing canvas object.

```http
PATCH /api/canvas/{canvasId}/objects/{objectId}
```

**Requires:** Edit permission

**Request Body:**
```json
{
  "x": 150,
  "y": 250,
  "color": "#ff00ff",
  "rotation": 45
}
```

**Response:**
```json
{
  "success": true,
  "object": { ... }
}
```

### Delete Canvas Object

Delete a canvas object.

```http
DELETE /api/canvas/{canvasId}/objects/{objectId}
```

**Requires:** Delete permission

**Response:**
```json
{
  "success": true,
  "message": "Object deleted successfully"
}
```

### Batch Create Objects

Create multiple objects in a single request.

```http
POST /api/canvas/{canvasId}/objects/batch
```

**Requires:** Edit permission

**Request Body:**
```json
{
  "objects": [
    {
      "type": "rectangle",
      "x": 100,
      "y": 100,
      "color": "#ff0000",
      "width": 50,
      "height": 50
    },
    {
      "type": "circle", 
      "x": 200,
      "y": 200,
      "color": "#00ff00",
      "radius": 25
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "object-id-1",
      "success": true,
      "object": { ... }
    },
    {
      "id": "object-id-2", 
      "success": true,
      "object": { ... }
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

### Batch Update Objects

Update multiple objects in a single request.

```http
PATCH /api/canvas/{canvasId}/objects/batch
```

**Requires:** Edit permission

**Request Body:**
```json
{
  "updates": [
    {
      "id": "object-id-1",
      "x": 150,
      "color": "#ff00ff"
    },
    {
      "id": "object-id-2",
      "y": 250
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [ ... ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

### Clear Canvas

Delete all objects from a canvas.

```http
DELETE /api/canvas/{canvasId}/objects
```

**Requires:** Delete permission

**Response:**
```json
{
  "success": true,
  "message": "Cleared 25 objects from canvas",
  "deletedCount": 25
}
```

---

## Permission Roles

The API supports three permission roles:

### Owner
- Full access to canvas including deletion
- Can manage permissions and share canvas
- Can edit all aspects of canvas and objects
- Can archive/restore canvas

### Editor  
- Can view and edit canvas objects
- Can create, update, and delete objects
- Cannot share canvas or manage permissions
- Cannot delete or archive canvas

### Viewer
- Can view canvas and objects (read-only)
- Can add comments (if enabled)
- Cannot edit objects or canvas
- Cannot share canvas

## Rate Limits

- Canvas operations: 100 requests per minute per user
- Object operations: 500 requests per minute per user  
- Batch operations: 10 requests per minute per user
- Search operations: 30 requests per minute per user

## Webhooks (Future)

The API will support webhooks for real-time notifications:

- `canvas.created` - New canvas created
- `canvas.updated` - Canvas metadata updated
- `canvas.deleted` - Canvas deleted
- `object.created` - New object added
- `object.updated` - Object modified
- `object.deleted` - Object removed
- `permission.granted` - User given canvas access
- `permission.revoked` - User access removed

## SDK and Libraries

- **JavaScript/TypeScript**: Official SDK available
- **React**: Hooks library for real-time canvas sync
- **Python**: Community SDK
- **REST clients**: Works with any HTTP client

## Examples

See the `/examples` directory for complete integration examples:
- Basic canvas operations
- Real-time collaboration setup  
- Permission management
- Batch operations
- Error handling
