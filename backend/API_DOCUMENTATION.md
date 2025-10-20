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
