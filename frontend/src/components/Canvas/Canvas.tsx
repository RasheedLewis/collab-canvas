import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Text, Line } from 'react-konva';
import Konva from 'konva';
import GridBackground from './GridBackground';
import CanvasRectangle from './CanvasRectangle';
import CanvasCircle from './CanvasCircle';
import CanvasText from './CanvasText';
import ActiveUsers from './ActiveUsers';
import SettingsButton from './SettingsButton';
import { useCanvasStore } from '../../store/canvasStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuthUser, useAuthUserProfile } from '../../store/authStore';
import API from '../../lib/api';
import type { RectangleObject, CircleObject, TextObject, CanvasObject } from '../../types/canvas';
import type { 
  CursorMovedPayload, 
  CursorUpdatePayload, 
  CursorLeftPayload
} from '../../types/websocket';

interface CanvasProps {
  width?: number;
  height?: number;
}

const Canvas: React.FC<CanvasProps> = ({ 
  width = window.innerWidth, // Full viewport width
  height = window.innerHeight // Full viewport height
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  
  // Shape creation state
  const [isCreating, setIsCreating] = useState(false);
  const [creationStart, setCreationStart] = useState<{ x: number; y: number } | null>(null);
  const [previewShape, setPreviewShape] = useState<{
    type: 'rectangle' | 'circle';
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
  } | null>(null);
  
  const { 
    objects, 
    tool, 
    createRectangle, 
    createCircle, 
    createText, 
    selectObject,
    addObject,
    updateObject,
    deleteObject,
    clearCanvas
  } = useCanvasStore();

  // Get authenticated user and profile data
  const user = useAuthUser();
  const userProfile = useAuthUserProfile();

  // WebSocket connection for real-time collaboration
  const ws = useWebSocket({
    url: API.config.WS_URL,
    ...API.config.WS_CONFIG
  });

  const {
    isConnected,
    clientId,
    roomId,
    sendMessage,
    joinRoom,
    onMessage,
    onCursorMoved,
    onCursorUpdate,
    onCursorLeft,
    onObjectCreated,
    onObjectUpdated,
    onObjectMoved,
    onObjectDeleted,
    onTextChanged,
    onCanvasStateSync,
  } = ws;

  // State for tracking other users' cursors with interpolation
  const [otherCursors, setOtherCursors] = useState<Map<string, {
    // Current interpolated position (for smooth rendering)
    x: number;
    y: number;
    // Target position (from network updates)
    targetX: number;
    targetY: number;
    // Previous position (for velocity calculation)
    prevX: number;
    prevY: number;
    // Interpolation tracking
    startTime: number;
    duration: number;
    userId: string;
    userInfo?: {
      uid: string;
      email: string | null;
      name: string | null;
      picture: string | null;
      displayName?: string;
      avatarColor?: string;
    };
    activeTool?: string;
    lastUpdate: number;
  }>>(new Map());

  // State for tracking interpolating object movements
  const [interpolatingObjects, setInterpolatingObjects] = useState<Map<string, {
    // Current interpolated position (for smooth rendering)
    x: number;
    y: number;
    // Target position (from network updates)
    targetX: number;
    targetY: number;
    // Previous position (for velocity calculation)
    prevX: number;
    prevY: number;
    // Interpolation tracking
    startTime: number;
    duration: number;
    objectId: string;
    userId: string; // User who moved the object
  }>>(new Map());

  // Cursor throttling state
  const lastCursorUpdateRef = useRef<number>(0);
  const lastCursorPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cursorThrottleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Animation frame state for smooth cursor and object interpolation
  const animationFrameRef = useRef<number | null>(null);
  const [, forceRerender] = useState({});

  // Auto-connect to WebSocket and join a test room
  useEffect(() => {
    if (!isConnected) {
      ws.connect();
    }
  }, [isConnected, ws]);

  // Color palette for user cursors (vibrant, distinct colors)
  const cursorColors = [
    '#FF6B6B', // Coral Red
    '#4ECDC4', // Teal
    '#45B7D1', // Sky Blue  
    '#96CEB4', // Mint Green
    '#FECA57', // Golden Yellow
    '#FF9FF3', // Pink
    '#54A0FF', // Royal Blue
    '#5F27CD', // Purple
    '#00D2D3', // Cyan
    '#FF9F43', // Orange
    '#10AC84', // Green
    '#EE5A24', // Red Orange
    '#0984e3', // Blue
    '#6c5ce7', // Lavender
    '#fd79a8', // Rose
    '#fdcb6e', // Peach
  ];

  // Generate consistent color based on client ID
  const getColorForUser = (userId: string): string => {
    if (!userId) return cursorColors[0];
    
    // Create a simple hash from the user ID
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Use the hash to pick a color from our palette
    const colorIndex = Math.abs(hash) % cursorColors.length;
    return cursorColors[colorIndex];
  };

  // Join a test room when connected
  useEffect(() => {
    if (isConnected && !roomId) {
      // Join a test room with user info
      const testRoomId = 'canvas-room-1';
      const randomId = Math.random().toString(36).substring(2, 8);
      
      // Use actual user profile data if available, otherwise fallback to generated data
      const userInfo = {
        uid: user?.uid || clientId || 'anonymous',
        email: user?.email || null,
        name: user?.displayName || userProfile?.displayName || `User_${randomId}`,
        picture: user?.photoURL || null,
        displayName: userProfile?.displayName || user?.displayName || `User_${randomId}`,
        avatarColor: userProfile?.avatarColor || getColorForUser(user?.uid || clientId || randomId)
      };
      
      joinRoom(testRoomId, userInfo);
    }
  }, [isConnected, roomId, clientId, joinRoom, user, userProfile]);

  // Smooth interpolation functions
  const easeOutQuad = (t: number): number => t * (2 - t);
  
  const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
  };

  // Helper function to get interpolated position for an object
  const getObjectRenderPosition = useCallback((objectId: string, defaultX: number, defaultY: number) => {
    const interpolation = interpolatingObjects.get(objectId);
    if (interpolation) {
      return { x: interpolation.x, y: interpolation.y };
    }
    return { x: defaultX, y: defaultY };
  }, [interpolatingObjects]);

  // Animation loop for smooth cursor and object interpolation
  const animateInterpolations = useCallback(() => {
    const now = Date.now();
    let needsCursorUpdate = false;
    let needsObjectUpdate = false;

    // Animate cursors
    setOtherCursors(prev => {
      const updated = new Map(prev);
      
      for (const [, cursor] of updated.entries()) {
        const timePassed = now - cursor.startTime;
        const progress = Math.min(timePassed / cursor.duration, 1);
        
        if (progress < 1) {
          // Apply easing for smooth movement
          const easedProgress = easeOutQuad(progress);
          
          const newX = lerp(cursor.prevX, cursor.targetX, easedProgress);
          const newY = lerp(cursor.prevY, cursor.targetY, easedProgress);
          
          if (Math.abs(newX - cursor.x) > 0.1 || Math.abs(newY - cursor.y) > 0.1) {
            cursor.x = newX;
            cursor.y = newY;
            needsCursorUpdate = true;
          }
        } else if (cursor.x !== cursor.targetX || cursor.y !== cursor.targetY) {
          // Snap to final position
          cursor.x = cursor.targetX;
          cursor.y = cursor.targetY;
          needsCursorUpdate = true;
        }
      }
      
      return needsCursorUpdate ? updated : prev;
    });

    // Animate objects
    setInterpolatingObjects(prev => {
      const updated = new Map(prev);
      const toRemove = new Set<string>();
      
      for (const [objectId, interpolation] of updated.entries()) {
        const timePassed = now - interpolation.startTime;
        const progress = Math.min(timePassed / interpolation.duration, 1);
        
        if (progress < 1) {
          // Apply easing for smooth movement
          const easedProgress = easeOutQuad(progress);
          
          const newX = lerp(interpolation.prevX, interpolation.targetX, easedProgress);
          const newY = lerp(interpolation.prevY, interpolation.targetY, easedProgress);
          
          if (Math.abs(newX - interpolation.x) > 0.1 || Math.abs(newY - interpolation.y) > 0.1) {
            interpolation.x = newX;
            interpolation.y = newY;
            needsObjectUpdate = true;
          }
        } else {
          // Snap to final position and update the actual object
          interpolation.x = interpolation.targetX;
          interpolation.y = interpolation.targetY;
          
          // Update the actual object in the store
          updateObject(objectId, { 
            x: interpolation.targetX, 
            y: interpolation.targetY 
          });
          
          // Mark for removal from interpolation
          toRemove.add(objectId);
          needsObjectUpdate = true;
        }
      }
      
      // Remove completed interpolations
      if (toRemove.size > 0) {
        for (const objectId of toRemove) {
          updated.delete(objectId);
        }
      }
      
      return needsObjectUpdate ? updated : prev;
    });

    // Continue animation if any cursors or objects are still moving
    if (otherCursors.size > 0 || interpolatingObjects.size > 0) {
      animationFrameRef.current = requestAnimationFrame(animateInterpolations);
    }
  }, [otherCursors.size, interpolatingObjects.size, updateObject]);

  // Start animation loop when cursors or objects are present
  useEffect(() => {
    if ((otherCursors.size > 0 || interpolatingObjects.size > 0) && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(animateInterpolations);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [otherCursors.size, interpolatingObjects.size, animateInterpolations]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (stageRef.current) {
        stageRef.current.width(window.innerWidth); // Full viewport width
        stageRef.current.height(window.innerHeight); // Full viewport height
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Throttled cursor update function for performance
  const throttledCursorUpdate = useCallback((x: number, y: number) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastCursorUpdateRef.current;
    const lastPosition = lastCursorPositionRef.current;
    
    // Calculate distance from last sent position
    const distance = Math.sqrt(
      Math.pow(x - lastPosition.x, 2) + Math.pow(y - lastPosition.y, 2)
    );

    // Only send if enough time has passed AND cursor moved enough distance
    const shouldSend = timeSinceLastUpdate >= API.config.CURSOR_CONFIG.throttleInterval &&
                      distance >= API.config.CURSOR_CONFIG.maxDistance;

    if (shouldSend && isConnected && roomId) {
      // Use cursorUpdate to include tool information
      const message = API.messages.cursorUpdate(x, y, roomId, undefined, tool);
      sendMessage(message);
      lastCursorUpdateRef.current = now;
      lastCursorPositionRef.current = { x, y };
    } else if (distance >= API.config.CURSOR_CONFIG.maxDistance) {
      // Schedule a delayed update if we're throttling but cursor moved significantly
      if (cursorThrottleTimeoutRef.current) {
        clearTimeout(cursorThrottleTimeoutRef.current);
      }

      const remainingTime = API.config.CURSOR_CONFIG.throttleInterval - timeSinceLastUpdate;
      if (remainingTime > 0) {
        cursorThrottleTimeoutRef.current = setTimeout(() => {
          if (isConnected && roomId) {
            // Use cursorUpdate to include tool information
            const message = API.messages.cursorUpdate(x, y, roomId, undefined, tool);
            sendMessage(message);
            lastCursorUpdateRef.current = Date.now();
            lastCursorPositionRef.current = { x, y };
          }
        }, remainingTime);
      }
    }
  }, [isConnected, roomId, sendMessage, tool]);

  // WebSocket event listeners for cursor synchronization
  useEffect(() => {
    const unsubscribeCursorMoved = onCursorMoved((payload: CursorMovedPayload) => {
      // Don't show our own cursor
      if (payload.userId === clientId) return;

      const now = Date.now();
      setOtherCursors(prev => {
        const updated = new Map(prev);
        const existingCursor = updated.get(payload.userId);
        
        if (existingCursor) {
          // Calculate distance to determine animation duration
          const distance = Math.sqrt(
            Math.pow(payload.x - existingCursor.x, 2) + 
            Math.pow(payload.y - existingCursor.y, 2)
          );
          
          // Adaptive duration based on distance (min 50ms, max 200ms)
          const duration = Math.max(50, Math.min(200, distance * 2));
          
          // Update with interpolation setup
          updated.set(payload.userId, {
            ...existingCursor,
            prevX: existingCursor.x, // Current position becomes previous
            prevY: existingCursor.y,
            targetX: payload.x, // New target position
            targetY: payload.y,
            startTime: now,
            duration,
            userInfo: payload.userInfo,
            lastUpdate: now,
          });
        } else {
          // First time seeing this cursor - no interpolation needed
          updated.set(payload.userId, {
            x: payload.x,
            y: payload.y,
            targetX: payload.x,
            targetY: payload.y,
            prevX: payload.x,
            prevY: payload.y,
            startTime: now,
            duration: 0,
            userId: payload.userId,
            userInfo: payload.userInfo,
            lastUpdate: now,
          });
        }
        return updated;
      });
    });

    const unsubscribeCursorUpdate = onCursorUpdate((payload: CursorUpdatePayload) => {
      // Don't show our own cursor
      if (payload.userId === clientId) return;

      const now = Date.now();
      setOtherCursors(prev => {
        const updated = new Map(prev);
        const existingCursor = updated.get(payload.userId);
        
        if (existingCursor) {
          // Calculate distance to determine animation duration
          const distance = Math.sqrt(
            Math.pow(payload.x - existingCursor.x, 2) + 
            Math.pow(payload.y - existingCursor.y, 2)
          );
          
          // Adaptive duration based on distance (min 50ms, max 200ms)
          const duration = Math.max(50, Math.min(200, distance * 2));
          
          // Update with interpolation setup
          updated.set(payload.userId, {
            ...existingCursor,
            prevX: existingCursor.x, // Current position becomes previous
            prevY: existingCursor.y,
            targetX: payload.x, // New target position
            targetY: payload.y,
            startTime: now,
            duration,
            userInfo: payload.userInfo,
            activeTool: payload.activeTool,
            lastUpdate: now,
          });
        } else {
          // First time seeing this cursor - no interpolation needed
          updated.set(payload.userId, {
            x: payload.x,
            y: payload.y,
            targetX: payload.x,
            targetY: payload.y,
            prevX: payload.x,
            prevY: payload.y,
            startTime: now,
            duration: 0,
            userId: payload.userId,
            userInfo: payload.userInfo,
            activeTool: payload.activeTool,
            lastUpdate: now,
          });
        }
        return updated;
      });
    });

    const unsubscribeCursorLeft = onCursorLeft((payload: CursorLeftPayload) => {
      setOtherCursors(prev => {
        const updated = new Map(prev);
        updated.delete(payload.userId);
        return updated;
      });
    });

    // Cleanup function
    return () => {
      unsubscribeCursorMoved();
      unsubscribeCursorUpdate();
      unsubscribeCursorLeft();
      if (cursorThrottleTimeoutRef.current) {
        clearTimeout(cursorThrottleTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [onCursorMoved, onCursorUpdate, onCursorLeft, clientId]);

  // Cursor inactivity cleanup (hide cursors that haven't updated recently)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setOtherCursors(prev => {
        const updated = new Map(prev);
        let hasChanges = false;

        for (const [userId, cursor] of updated.entries()) {
          if (now - cursor.lastUpdate > API.config.CURSOR_CONFIG.inactivityTimeout) {
            updated.delete(userId);
            hasChanges = true;
          }
        }

        return hasChanges ? updated : prev;
      });
    }, 1000); // Check every second

    return () => clearInterval(cleanupInterval);
  }, []);

  // Object synchronization functions
  const sendObjectCreated = useCallback((object: CanvasObject) => {
    if (!isConnected || !roomId) return;
    
    sendMessage({
      type: 'object_created',
      payload: {
        roomId,
        object
      },
      timestamp: Date.now()
    });
  }, [isConnected, roomId, sendMessage]);

  const sendObjectMoved = useCallback((objectId: string, x: number, y: number) => {
    if (!isConnected || !roomId) return;
    
    sendMessage({
      type: 'object_moved',
      payload: {
        roomId,
        objectId,
        x,
        y
      },
      timestamp: Date.now()
    });
  }, [isConnected, roomId, sendMessage]);

  const sendTextChanged = useCallback((
    objectId: string, 
    text: string, 
    fontSize?: number, 
    fontFamily?: string, 
    fontStyle?: string
  ) => {
    if (!isConnected || !roomId) return;
    
    sendMessage({
      type: 'text_changed',
      payload: {
        roomId,
        objectId,
        text,
        fontSize,
        fontFamily,
        fontStyle
      },
      timestamp: Date.now()
    });
  }, [isConnected, roomId, sendMessage]);

  // Request canvas state function
  const requestCanvasState = useCallback(() => {
    if (!isConnected || !roomId) {
      console.log('⚠️ Cannot request canvas state: not connected or no room');
      return;
    }
    
    console.log(`📥 Requesting canvas state for room: ${roomId}`);
    sendMessage({
      type: 'canvas_state_requested',
      payload: { roomId },
      timestamp: Date.now()
    });
  }, [isConnected, roomId, sendMessage]);

  // TODO: Implement these functions when adding object updates/deletions
  // const sendObjectUpdated = useCallback((objectId: string, updates: Partial<CanvasObject>) => { ... };
  // const sendObjectDeleted = useCallback((objectId: string) => { ... };

  // Object synchronization event handlers
  useEffect(() => {
    const unsubscribeObjectCreated = onObjectCreated((payload) => {
      // Don't add our own objects (they're already in the store)
      if (payload.userId === clientId) return;
      
      addObject(payload.object as CanvasObject);
    });

    const unsubscribeObjectMoved = onObjectMoved((payload) => {
      // Don't update our own moves (they're already in the store)  
      if (payload.userId === clientId) return;
      
      const now = Date.now();
      const currentObject = objects.find(obj => obj.id === payload.objectId);
      
      if (!currentObject) {
        // Object not found, just update directly
        updateObject(payload.objectId, { x: payload.x, y: payload.y });
        return;
      }

      // Check if this object is already interpolating
      const existingInterpolation = interpolatingObjects.get(payload.objectId);
      
      // Calculate distance to determine animation duration
      const fromX = existingInterpolation ? existingInterpolation.x : currentObject.x;
      const fromY = existingInterpolation ? existingInterpolation.y : currentObject.y;
      const distance = Math.sqrt(
        Math.pow(payload.x - fromX, 2) + 
        Math.pow(payload.y - fromY, 2)
      );
      
      // Adaptive duration based on distance (min 100ms, max 400ms for objects)
      // Objects are typically larger movements than cursors, so slightly longer duration
      const duration = Math.max(100, Math.min(400, distance * 3));

      // Set up interpolation
      setInterpolatingObjects(prev => {
        const updated = new Map(prev);
        updated.set(payload.objectId, {
          x: fromX, // Current interpolated position
          y: fromY,
          prevX: fromX, // Current position becomes previous
          prevY: fromY,
          targetX: payload.x, // New target position
          targetY: payload.y,
          startTime: now,
          duration,
          objectId: payload.objectId,
          userId: payload.userId
        });
        return updated;
      });
    });

    const unsubscribeObjectUpdated = onObjectUpdated((payload) => {
      // Don't update our own changes (they're already in the store)
      if (payload.userId === clientId) return;
      
      updateObject(payload.objectId, payload.updates);
    });

    const unsubscribeObjectDeleted = onObjectDeleted((payload) => {
      // Don't delete our own objects (they're already removed from the store)
      if (payload.userId === clientId) return;
      
      deleteObject(payload.objectId);
    });

    const unsubscribeTextChanged = onTextChanged((payload) => {
      // Don't update our own text changes (they're already in the store)
      if (payload.userId === clientId) return;
      
      updateObject(payload.objectId, {
        text: payload.text,
        fontSize: payload.fontSize,
        fontFamily: payload.fontFamily,
        fontStyle: payload.fontStyle
      });
    });

    const unsubscribeCanvasStateSync = onCanvasStateSync((payload) => {
      console.log(`📥 Received canvas state: ${payload.objects.length} objects`);
      
      // Clear existing objects first (important for page refreshes)
      clearCanvas();
      
      // Add all objects from synced state
      payload.objects.forEach(object => {
        addObject(object as CanvasObject);
      });
    });

    return () => {
      unsubscribeObjectCreated();
      unsubscribeObjectMoved();
      unsubscribeObjectUpdated();  
      unsubscribeObjectDeleted();
      unsubscribeTextChanged();
      unsubscribeCanvasStateSync();
    };
  }, [onObjectCreated, onObjectMoved, onObjectUpdated, onObjectDeleted, onTextChanged, onCanvasStateSync, clientId, addObject, updateObject, deleteObject, clearCanvas]);

  // Listen for room join events and request canvas state
  useEffect(() => {
    const unsubscribeMessage = onMessage((message) => {
      if (message.type === 'room_joined') {
        console.log(`🏠 Successfully joined room, requesting canvas state...`);
        // Small delay to ensure the server is ready
        setTimeout(() => {
          requestCanvasState();
        }, 100);
      }
    });

    return () => {
      unsubscribeMessage();
    };
  }, [onMessage, requestCanvasState]);

  // Backup mechanism: Request canvas state when room ID changes and we're connected
  // This handles cases where room_joined message might be missed or on reconnection
  useEffect(() => {
    if (isConnected && roomId) {
      console.log(`🔄 Room ID changed to ${roomId}, requesting canvas state...`);
      // Small delay to ensure the server has processed the room join
      setTimeout(() => {
        requestCanvasState();
      }, 200);
    }
  }, [roomId, isConnected, requestCanvasState]);

  // Wrapper functions for object creation with broadcasting
  const createRectangleWithSync = useCallback((x: number, y: number, width?: number, height?: number) => {
    const rectangle = createRectangle(x, y, width, height);
    sendObjectCreated(rectangle);
    return rectangle;
  }, [createRectangle, sendObjectCreated]);

  const createCircleWithSync = useCallback((x: number, y: number, radius?: number) => {
    const circle = createCircle(x, y, radius);
    sendObjectCreated(circle);
    return circle;
  }, [createCircle, sendObjectCreated]);

  const createTextWithSync = useCallback((x: number, y: number, text?: string) => {
    const textObject = createText(x, y, text);
    sendObjectCreated(textObject);
    return textObject;
  }, [createText, sendObjectCreated]);

  // Wrapper function for object movement with broadcasting
  const moveObjectWithSync = useCallback((objectId: string, x: number, y: number) => {
    // Update local store first (optimistic update)
    updateObject(objectId, { x, y });
    // Then broadcast to other users
    sendObjectMoved(objectId, x, y);
  }, [updateObject, sendObjectMoved]);

  // Wrapper function for text changes with broadcasting
  const changeTextWithSync = useCallback((
    objectId: string, 
    text: string, 
    fontSize?: number, 
    fontFamily?: string, 
    fontStyle?: string
  ) => {
    // Update local store first (optimistic update)
    const updates: any = { text };
    if (fontSize !== undefined) updates.fontSize = fontSize;
    if (fontFamily !== undefined) updates.fontFamily = fontFamily;
    if (fontStyle !== undefined) updates.fontStyle = fontStyle;
    
    updateObject(objectId, updates);
    // Then broadcast to other users
    sendTextChanged(objectId, text, fontSize, fontFamily, fontStyle);
  }, [updateObject, sendTextChanged]);

  // Force re-render when cursors are animating
  useEffect(() => {
    if (otherCursors.size > 0) {
      forceRerender({});
    }
  }, [otherCursors]);

  // Handle wheel events for zooming
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // Determine new scale
    const direction = e.evt.deltaY > 0 ? 1 : -1;
    const scaleBy = 1.05;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // Limit zoom levels
    const minScale = 0.1;
    const maxScale = 5;
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));

    stage.scale({ x: clampedScale, y: clampedScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };
    stage.position(newPos);
    
    setStageScale(clampedScale);
    setStagePos(newPos);
  };

  // Handle drag events for panning
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Only update stage position if we're actually dragging the stage itself
    if (e.target === stageRef.current) {
      setStagePos({
        x: e.target.x(),
        y: e.target.y(),
      });
    }
  };

  // Convert screen coordinates to canvas coordinates
  const getCanvasCoordinates = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - stagePos.x) / stageScale,
      y: (screenY - stagePos.y) / stageScale,
    };
  }, [stagePos.x, stagePos.y, stageScale]);

  // Handle mouse down - start shape creation
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only start creation if we clicked on the stage itself (not on an object)
    if (e.target === stageRef.current) {
      // Deselect any selected objects when clicking on empty canvas
      selectObject(null);
      
      if (tool === 'rectangle' || tool === 'circle' || tool === 'text') {
        const stage = stageRef.current;
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const canvasCoords = getCanvasCoordinates(pointer.x, pointer.y);
            
            // Text objects are created immediately on click
            if (tool === 'text') {
              createTextWithSync(canvasCoords.x, canvasCoords.y);
              return;
            }
            
            // Rectangle and circle use drag-to-create
            setIsCreating(true);
            setCreationStart(canvasCoords);
            
            // Initialize preview shape
            if (tool === 'rectangle') {
              setPreviewShape({
                type: 'rectangle',
                x: canvasCoords.x,
                y: canvasCoords.y,
                width: 1,
                height: 1,
              });
            } else if (tool === 'circle') {
              setPreviewShape({
                type: 'circle',
                x: canvasCoords.x,
                y: canvasCoords.y,
                radius: 1,
              });
            }
          }
        }
      }
    }
  };

  // Handle mouse move - update preview shape and broadcast cursor position
  const handleMouseMove = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const canvasCoords = getCanvasCoordinates(pointer.x, pointer.y);

    // Broadcast cursor position to other users (throttled for performance)
    throttledCursorUpdate(canvasCoords.x, canvasCoords.y);

    // Handle shape creation preview (existing functionality)
    if (isCreating && creationStart) {
      if (tool === 'rectangle') {
        const width = Math.abs(canvasCoords.x - creationStart.x);
        const height = Math.abs(canvasCoords.y - creationStart.y);
        const x = Math.min(creationStart.x, canvasCoords.x);
        const y = Math.min(creationStart.y, canvasCoords.y);
        
        setPreviewShape({
          type: 'rectangle',
          x,
          y,
          width: Math.max(width, 5), // Minimum size
          height: Math.max(height, 5),
        });
      } else if (tool === 'circle') {
        const deltaX = canvasCoords.x - creationStart.x;
        const deltaY = canvasCoords.y - creationStart.y;
        const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        setPreviewShape({
          type: 'circle',
          x: creationStart.x,
          y: creationStart.y,
          radius: Math.max(radius, 5), // Minimum size
        });
      }
    }
  }, [isCreating, creationStart, tool, throttledCursorUpdate, getCanvasCoordinates]);

  // Handle mouse up - create final shape
  const handleMouseUp = () => {
    if (!isCreating || !previewShape) return;

    // Create the actual shape with the preview dimensions
    if (previewShape.type === 'rectangle' && previewShape.width && previewShape.height) {
      // Only create if the shape has meaningful size
      if (previewShape.width > 5 && previewShape.height > 5) {
        createRectangleWithSync(previewShape.x, previewShape.y, previewShape.width, previewShape.height);
      }
    } else if (previewShape.type === 'circle' && previewShape.radius) {
      // Only create if the shape has meaningful size
      if (previewShape.radius > 5) {
        createCircleWithSync(previewShape.x, previewShape.y, previewShape.radius);
      }
    }

    // Reset creation state
    setIsCreating(false);
    setCreationStart(null);
    setPreviewShape(null);
  };

  // Prepare current user info for ActiveUsers component
  const currentUserInfo = user && userProfile ? {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    picture: user.photoURL,
    displayName: userProfile.displayName || undefined,
    avatarColor: userProfile.avatarColor
  } : undefined;

  // Map other cursors to ActiveUsers format
  const otherActiveUsers = Array.from(otherCursors.values()).map(cursor => ({
    userId: cursor.userId,
    userInfo: cursor.userInfo,
    isCurrentUser: false
  }));

  return (
    <div className="canvas relative">
      {/* Active Users Display */}
      <div 
        style={{ 
          position: 'absolute',
          top: '20px',
          right: '20px', // Positioned at the top right with consistent spacing
          zIndex: 50,
          width: '320px', // Exact component width
          height: '112px', // Exact component height
          pointerEvents: 'auto'
        }}
      >
        <ActiveUsers
          currentUser={currentUserInfo}
          otherUsers={otherActiveUsers}
        />
      </div>

      {/* Settings Button */}
      <div 
        style={{ 
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 50,
          pointerEvents: 'auto'
        }}
      >
        <SettingsButton />
      </div>

      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onWheel={handleWheel}
        draggable={tool === 'select' && !isCreating}
        onDragEnd={handleDragEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        style={{ 
          cursor: (tool === 'rectangle' || tool === 'circle' || tool === 'text') ? 'crosshair' : tool === 'select' ? 'grab' : 'default'
        }}
      >
        <Layer>
          {/* Grid background */}
          <GridBackground
            width={width}
            height={height}
            stageX={stagePos.x}
            stageY={stagePos.y}
            scale={stageScale}
            gridSize={50}
          />
          
          {/* Render canvas objects */}
          {objects.map((obj) => {
            // Get interpolated position for smooth movement
            const renderPos = getObjectRenderPosition(obj.id, obj.x, obj.y);
            
            if (obj.type === 'rectangle') {
              const rectangleWithInterpolation = {
                ...obj,
                x: renderPos.x,
                y: renderPos.y
              } as RectangleObject;
              
              return (
                <CanvasRectangle 
                  key={obj.id} 
                  rectangle={rectangleWithInterpolation}
                  onMove={moveObjectWithSync}
                />
              );
            } else if (obj.type === 'circle') {
              const circleWithInterpolation = {
                ...obj,
                x: renderPos.x,
                y: renderPos.y
              } as CircleObject;
              
              return (
                <CanvasCircle 
                  key={obj.id} 
                  circle={circleWithInterpolation}
                  onMove={moveObjectWithSync}
                />
              );
            } else if (obj.type === 'text') {
              const textWithInterpolation = {
                ...obj,
                x: renderPos.x,
                y: renderPos.y
              } as TextObject;
              
              return (
                <CanvasText 
                  key={obj.id} 
                  textObject={textWithInterpolation}
                  onMove={moveObjectWithSync}
                  onTextChanged={changeTextWithSync}
                />
              );
            }
            return null;
          })}
          
          {/* Preview shape while creating */}
          {previewShape && (
            <>
              {previewShape.type === 'rectangle' && (
                <Rect
                  x={previewShape.x}
                  y={previewShape.y}
                  width={previewShape.width}
                  height={previewShape.height}
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dash={[5, 5]}
                  listening={false}
                />
              )}
              {previewShape.type === 'circle' && (
                <Circle
                  x={previewShape.x}
                  y={previewShape.y}
                  radius={previewShape.radius}
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dash={[5, 5]}
                  listening={false}
                />
              )}
            </>
          )}

          {/* Other users' cursors */}
          {Array.from(otherCursors.values()).map((cursor) => {
            const userColor = cursor.userInfo?.avatarColor || getColorForUser(cursor.userId);
            const userName = cursor.userInfo?.displayName || 
                           (cursor.userInfo?.name ?? 'Anonymous');
            const activeTool = cursor.activeTool || 'select';
            
            // Add tool emoji for better UX
            const toolEmoji = {
              'select': '👆',
              'rectangle': '▭',
              'circle': '⭕',
              'text': 'T'
            }[activeTool] || '👆';
            
            const displayText = `${toolEmoji} ${userName}`;
            
            // Calculate label dimensions
            const labelPadding = 8;
            const labelHeight = 28;
            const estimatedTextWidth = displayText.length * 7 + labelPadding * 2;
            
            return (
              <React.Fragment key={cursor.userId}>
                {/* Cursor shadow (for depth) */}
                <Line
                  points={[
                    cursor.x + 2, cursor.y + 2,      // Top point (shadow)
                    cursor.x + 2, cursor.y + 18,     // Bottom left (shadow)
                    cursor.x + 7, cursor.y + 14,     // Bottom indent (shadow)
                    cursor.x + 12, cursor.y + 20,    // Bottom right tip (shadow)
                    cursor.x + 8, cursor.y + 12,     // Right indent (shadow)
                    cursor.x + 16, cursor.y + 10,    // Right point (shadow)
                    cursor.x + 2, cursor.y + 2       // Back to top (shadow)
                  ]}
                  fill="rgba(0,0,0,0.3)"
                  closed={true}
                  listening={false}
                />
                
                {/* Main cursor arrow */}
                <Line
                  points={[
                    cursor.x, cursor.y,          // Top point
                    cursor.x, cursor.y + 16,     // Bottom left
                    cursor.x + 5, cursor.y + 12, // Bottom indent
                    cursor.x + 10, cursor.y + 18, // Bottom right tip
                    cursor.x + 6, cursor.y + 10,  // Right indent
                    cursor.x + 14, cursor.y + 8,  // Right point
                    cursor.x, cursor.y           // Back to top
                  ]}
                  fill={userColor}
                  stroke="white"
                  strokeWidth={1}
                  closed={true}
                  listening={false}
                />

                {/* Inner arrow detail */}
                <Line
                  points={[
                    cursor.x + 2, cursor.y + 2,      // Inner top
                    cursor.x + 2, cursor.y + 12,     // Inner left
                    cursor.x + 6, cursor.y + 10,     // Inner indent
                    cursor.x + 10, cursor.y + 6,     // Inner right
                    cursor.x + 2, cursor.y + 2       // Back to inner top
                  ]}
                  fill="rgba(255,255,255,0.3)"
                  closed={true}
                  listening={false}
                />

                {/* Name label drop shadow */}
                <Rect
                  x={cursor.x + 20 + 2}
                  y={cursor.y + 2 + 2}
                  width={estimatedTextWidth}
                  height={labelHeight}
                  fill="rgba(0,0,0,0.2)"
                  cornerRadius={6}
                  listening={false}
                />
                
                {/* Name label background */}
                <Rect
                  x={cursor.x + 20}
                  y={cursor.y + 2}
                  width={estimatedTextWidth}
                  height={labelHeight}
                  fill={userColor}
                  cornerRadius={6}
                  listening={false}
                />

                {/* Name label border/highlight */}
                <Rect
                  x={cursor.x + 20}
                  y={cursor.y + 2}
                  width={estimatedTextWidth}
                  height={labelHeight}
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth={1}
                  cornerRadius={6}
                  listening={false}
                />
                
                {/* User name text */}
                <Text
                  x={cursor.x + 20 + labelPadding}
                  y={cursor.y + 2 + (labelHeight - 12) / 2} // Vertically center the text
                  text={displayText}
                  fontSize={12}
                  fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  fontStyle="500" // Medium weight
                  fill="white"
                  listening={false}
                />

                {/* User status indicator (small dot) */}
                <Circle
                  x={cursor.x + 24}
                  y={cursor.y + 8}
                  radius={3}
                  fill="#00ff88"
                  stroke="white"
                  strokeWidth={1}
                  listening={false}
                />
              </React.Fragment>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
};

export default Canvas;
