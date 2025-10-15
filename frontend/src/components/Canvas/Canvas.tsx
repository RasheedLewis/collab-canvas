import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';
import Konva from 'konva';
import GridBackground from './GridBackground';
import CanvasRectangle from './CanvasRectangle';
import CanvasCircle from './CanvasCircle';
import CanvasText from './CanvasText';
import Toolbar from './Toolbar';
import { useCanvasStore } from '../../store/canvasStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import API from '../../lib/api';
import type { RectangleObject, CircleObject, TextObject } from '../../types/canvas';
import type { CursorMovedPayload, CursorUpdatePayload, CursorLeftPayload } from '../../types/websocket';

interface CanvasProps {
  width?: number;
  height?: number;
}

const Canvas: React.FC<CanvasProps> = ({ 
  width = window.innerWidth - 112, // Account for left toolbar (80px width + 32px margins)
  height = window.innerHeight - 80 // Account for header height
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
  
  const { objects, tool, createRectangle, createCircle, createText, selectObject } = useCanvasStore();

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
    onCursorMoved,
    onCursorUpdate,
    onCursorLeft,
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

  // Cursor throttling state
  const lastCursorUpdateRef = useRef<number>(0);
  const lastCursorPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cursorThrottleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Animation frame state for smooth cursor interpolation
  const animationFrameRef = useRef<number | null>(null);
  const [, forceRerender] = useState({});

  // Auto-connect to WebSocket and join a test room
  useEffect(() => {
    if (!isConnected) {
      ws.connect();
    }
  }, [isConnected, ws]);

  // Join a test room when connected
  useEffect(() => {
    if (isConnected && !roomId) {
      // Join a test room with user info
      const testRoomId = 'canvas-room-1';
      const userInfo = {
        uid: clientId || 'anonymous',
        email: null,
        name: `User_${Math.random().toString(36).substring(2, 8)}`,
        picture: null,
        displayName: `User_${Math.random().toString(36).substring(2, 8)}`,
        avatarColor: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
      };
      
      joinRoom(testRoomId, userInfo);
    }
  }, [isConnected, roomId, clientId, joinRoom]);

  // Smooth interpolation functions
  const easeOutQuad = (t: number): number => t * (2 - t);
  
  const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
  };

  // Animation loop for smooth cursor interpolation
  const animateCursors = useCallback(() => {
    const now = Date.now();
    let needsUpdate = false;

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
            needsUpdate = true;
          }
        } else if (cursor.x !== cursor.targetX || cursor.y !== cursor.targetY) {
          // Snap to final position
          cursor.x = cursor.targetX;
          cursor.y = cursor.targetY;
          needsUpdate = true;
        }
      }
      
      return needsUpdate ? updated : prev;
    });

    // Continue animation if any cursors are still moving
    if (otherCursors.size > 0) {
      animationFrameRef.current = requestAnimationFrame(animateCursors);
    }
  }, [otherCursors.size]);

  // Start animation loop when cursors are present
  useEffect(() => {
    if (otherCursors.size > 0 && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(animateCursors);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [otherCursors.size, animateCursors]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (stageRef.current) {
        stageRef.current.width(window.innerWidth - 112); // Account for toolbar
        stageRef.current.height(window.innerHeight - 80);
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
      const message = API.messages.cursorMoved(x, y, roomId);
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
            const message = API.messages.cursorMoved(x, y, roomId);
            sendMessage(message);
            lastCursorUpdateRef.current = Date.now();
            lastCursorPositionRef.current = { x, y };
          }
        }, remainingTime);
      }
    }
  }, [isConnected, roomId, sendMessage]);

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
              createText(canvasCoords.x, canvasCoords.y);
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
        createRectangle(previewShape.x, previewShape.y, previewShape.width, previewShape.height);
      }
    } else if (previewShape.type === 'circle' && previewShape.radius) {
      // Only create if the shape has meaningful size
      if (previewShape.radius > 5) {
        createCircle(previewShape.x, previewShape.y, previewShape.radius);
      }
    }

    // Reset creation state
    setIsCreating(false);
    setCreationStart(null);
    setPreviewShape(null);
  };

  return (
    <div 
      className="canvas-container relative overflow-hidden"
      style={{ 
        width: 'calc(100vw - 112px)', // Account for left toolbar
        height: 'calc(100vh - 80px)', // Account for header
        backgroundColor: '#f8f9fa',
        cursor: 'grab',
        marginLeft: '112px' // Push canvas right of toolbar
      }}
    >
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
            if (obj.type === 'rectangle') {
              return (
                <CanvasRectangle 
                  key={obj.id} 
                  rectangle={obj as RectangleObject} 
                />
              );
            } else if (obj.type === 'circle') {
              return (
                <CanvasCircle 
                  key={obj.id} 
                  circle={obj as CircleObject} 
                />
              );
            } else if (obj.type === 'text') {
              return (
                <CanvasText 
                  key={obj.id} 
                  textObject={obj as TextObject} 
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
            const userColor = cursor.userInfo?.avatarColor || '#3b82f6';
            const userName = cursor.userInfo?.displayName || 
                           (cursor.userInfo?.name ?? 'Anonymous');
            
            return (
              <React.Fragment key={cursor.userId}>
                {/* Cursor pointer */}
                <Circle
                  x={cursor.x}
                  y={cursor.y}
                  radius={8}
                  fill={userColor}
                  stroke="white"
                  strokeWidth={2}
                  listening={false}
                />
                
                {/* Cursor arrow/triangle */}
                <Circle
                  x={cursor.x}
                  y={cursor.y}
                  radius={3}
                  fill="white"
                  listening={false}
                />

                {/* User name label background */}
                <Rect
                  x={cursor.x + 12}
                  y={cursor.y - 10}
                  width={userName.length * 8 + 16} // Approximate width based on text length
                  height={20}
                  fill={userColor}
                  cornerRadius={4}
                  opacity={0.9}
                  listening={false}
                />
                
                {/* User name text */}
                <Text
                  x={cursor.x + 20}
                  y={cursor.y - 5}
                  text={userName}
                  fontSize={12}
                  fontFamily="Arial, sans-serif"
                  fill="white"
                  listening={false}
                />
              </React.Fragment>
            );
          })}
        </Layer>
      </Stage>
      
      {/* Toolbar */}
      <Toolbar />
      
      {/* Debug info */}
      <div className="absolute top-4 right-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg text-sm font-mono">
        <div>Scale: {stageScale.toFixed(2)}x</div>
        <div>Position: ({stagePos.x.toFixed(0)}, {stagePos.y.toFixed(0)})</div>
        <div>Objects: {objects.length}</div>
        <div>Tool: {tool}</div>
        {isCreating && <div className="text-blue-600">Creating...</div>}
      </div>
      
      {/* Instructions panel */}
      <div className="absolute bottom-4 right-4 bg-white bg-opacity-95 rounded-xl p-4 shadow-xl border border-gray-200 max-w-xs">
        <div className="font-semibold mb-3 text-gray-800 flex items-center">
          <span className="text-lg mr-2">💡</span>
          Quick Guide
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-medium">•</span>
            <span>Mouse wheel to zoom (0.1x - 5x)</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-medium">•</span>
            <span>{tool === 'select' ? 'Drag canvas to pan' : 'Select tool to drag canvas'}</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-medium">•</span>
            <span>
              {(tool === 'rectangle' || tool === 'circle') 
                ? 'Drag to create shapes' 
                : tool === 'text' 
                ? 'Click to create text, double-click to edit' 
                : 'Click objects to select and move'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Canvas;
