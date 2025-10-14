import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle } from 'react-konva';
import Konva from 'konva';
import GridBackground from './GridBackground';
import CanvasRectangle from './CanvasRectangle';
import CanvasCircle from './CanvasCircle';
import CanvasText from './CanvasText';
import Toolbar from './Toolbar';
import { useCanvasStore } from '../../store/canvasStore';
import type { RectangleObject, CircleObject, TextObject } from '../../types/canvas';

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
  const getCanvasCoordinates = (screenX: number, screenY: number) => {
    return {
      x: (screenX - stagePos.x) / stageScale,
      y: (screenY - stagePos.y) / stageScale,
    };
  };

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

  // Handle mouse move - update preview shape
  const handleMouseMove = () => {
    if (!isCreating || !creationStart) return;

    const stage = stageRef.current;
    if (stage) {
      const pointer = stage.getPointerPosition();
      if (pointer) {
        const canvasCoords = getCanvasCoordinates(pointer.x, pointer.y);
        
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
    }
  };

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
