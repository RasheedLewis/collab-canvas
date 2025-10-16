# Canvas Persistence Testing Guide

## Overview

This guide helps you test the canvas persistence functionality across page refreshes. The system now automatically saves and restores canvas objects when users leave and rejoin rooms.

## Testing Steps

### 1. Basic Persistence Test

1. **Start the application**:
   - Backend: `cd backend && npm start`
   - Frontend: `cd frontend && npm run dev`
   - Open http://localhost:5173 in your browser

2. **Create some objects**:
   - Select the Rectangle tool and draw a few rectangles
   - Select the Circle tool and draw some circles
   - Select the Text tool and add text objects
   - Move objects around to different positions

3. **Test persistence**:
   - **Refresh the page (F5 or Ctrl+R)**
   - **Expected result**: All objects should reappear in their exact positions with correct colors and properties

### 2. Multi-User Persistence Test

1. **Open multiple tabs**:
   - Open 2-3 browser tabs to the same URL
   - Each tab represents a different user

2. **Create objects from different users**:
   - In Tab 1: Create a red rectangle and blue circle
   - In Tab 2: Create a green rectangle and yellow text
   - In Tab 3: Move some objects around

3. **Test cross-user persistence**:
   - **Refresh any tab**
   - **Expected result**: All objects created by all users should be visible

### 3. Different Object Types Test

1. **Test all shape types**:
   - Create rectangles with different colors
   - Create circles with various sizes
   - Create text objects with different content and font sizes

2. **Verify properties persist**:
   - **Refresh the page**
   - **Expected result**: All properties are maintained:
     - Rectangle: width, height, color, position
     - Circle: radius, color, position  
     - Text: content, font size, color, position

### 4. Large Canvas Test

1. **Create many objects**:
   - Create 20+ objects of different types
   - Spread them across the canvas
   - Use pan and zoom to navigate

2. **Test performance**:
   - **Refresh the page**
   - **Expected result**: All objects load quickly and canvas performance remains smooth

## Expected Behaviors

### ✅ What Should Work

- **Object Persistence**: All objects persist across page refreshes
- **Property Preservation**: Colors, positions, sizes, and text content are maintained
- **Multi-User Sync**: Objects created by different users are all persisted
- **Real-Time + Persistence**: New objects appear immediately to other users AND persist after refresh
- **Canvas State Request**: When joining a room, the app automatically requests and loads existing objects

### 🔍 What to Look For in Console

**Backend Console:**
```
📁 Canvas persistence initialized at: ./data/canvas-states
💾 Persisted object [object-id] in room canvas-room-1
📤 Sending canvas state for room canvas-room-1: 5 objects
💾 Saved canvas state for room: canvas-room-1 (5 objects)
```

**Frontend Console:**
```
🏠 Successfully joined room, requesting canvas state...
📥 Requesting canvas state for room: canvas-room-1
📥 Received canvas state: 5 objects
```

## File System Verification

The persistence service saves data to the file system:

1. **Check data directory**:
   ```bash
   ls -la backend/data/canvas-states/
   ```

2. **View saved state**:
   ```bash
   cat backend/data/canvas-states/canvas-room-1.json
   ```

   Should show JSON with objects array and metadata:
   ```json
   {
     "roomId": "canvas-room-1",
     "objects": [
       {
         "id": "rect-123",
         "type": "rectangle",
         "x": 100,
         "y": 150,
         "width": 200,
         "height": 100,
         "color": "#3b82f6",
         "createdAt": 1697123456789,
         "updatedAt": 1697123456789,
         "userId": "client-abc"
       }
     ],
     "lastUpdated": 1697123456789,
     "version": 3
   }
   ```

## Troubleshooting

### Objects Don't Persist

1. **Check backend logs** for persistence errors
2. **Verify data directory** exists and is writable
3. **Check WebSocket connection** is stable
4. **Confirm room joining** is working properly

### Objects Duplicate on Refresh

- This indicates the canvas isn't being cleared before loading saved state
- Check the `clearCanvas()` call in the Canvas component

### Performance Issues

1. **Check object count** - large numbers of objects may slow things down
2. **Verify debounced saving** is working (should see grouped save operations)
3. **Check console** for any error messages

## Manual Verification

You can manually verify the persistence by:

1. **Creating objects**
2. **Stopping the backend** (`Ctrl+C`)
3. **Restarting the backend** (`npm start`)
4. **Refreshing the frontend**
5. **Confirming objects are restored**

This tests that data survives server restarts as well as page refreshes.

## Success Criteria ✅

The canvas persistence feature is working correctly when:

- ✅ Objects persist across page refreshes
- ✅ Object properties (position, color, size, text) are preserved
- ✅ Multi-user objects all persist correctly  
- ✅ Canvas automatically requests state when joining rooms
- ✅ State loads within 200-500ms of room join
- ✅ No duplicate objects appear on refresh
- ✅ Performance remains smooth with 20+ objects
- ✅ Data files are created in `backend/data/canvas-states/`

**The feature successfully implements the requirement: "Whenever the user refreshes the page, the canvas should appear with the same objects that it had previously."**
