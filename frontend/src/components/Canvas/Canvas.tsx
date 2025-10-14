import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import GridBackground from './GridBackground';
import CanvasRectangle from './CanvasRectangle';
import Toolbar from './Toolbar';
import { useCanvasStore } from '../../store/canvasStore';
import type { RectangleObject } from '../../types/canvas';

interface CanvasProps {
  width?: number;
  height?: number;
}

const Canvas: React.FC<CanvasProps> = ({ 
  width = window.innerWidth, 
  height = window.innerHeight - 80 // Account for header height
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  
  const { objects, tool, createRectangle, selectObject } = useCanvasStore();

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (stageRef.current) {
        stageRef.current.width(window.innerWidth);
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
    setStagePos({
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  // Handle stage click for creating rectangles
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only create rectangles if we clicked on the stage itself (not on an object)
    if (e.target === stageRef.current) {
      // Deselect any selected objects when clicking on empty canvas
      selectObject(null);
      
      if (tool === 'rectangle') {
        const stage = stageRef.current;
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            // Convert screen coordinates to canvas coordinates
            const canvasX = (pointer.x - stagePos.x) / stageScale;
            const canvasY = (pointer.y - stagePos.y) / stageScale;
            
            createRectangle(canvasX, canvasY);
          }
        }
      }
    }
  };

  return (
    <div 
      className="canvas-container relative overflow-hidden"
      style={{ 
        width: '100vw', 
        height: 'calc(100vh - 80px)', // Account for header
        backgroundColor: '#f8f9fa',
        cursor: 'grab'
      }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onWheel={handleWheel}
        draggable={tool === 'select'}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick}
        onTap={handleStageClick}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        style={{ 
          cursor: tool === 'rectangle' ? 'crosshair' : tool === 'select' ? 'grab' : 'default'
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
            }
            // Add other object types here later (circle, text)
            return null;
          })}
        </Layer>
      </Stage>
      
      {/* Toolbar */}
      <Toolbar />
      
      {/* Debug info */}
      <div className="absolute top-4 left-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg text-sm font-mono">
        <div>Scale: {stageScale.toFixed(2)}x</div>
        <div>Position: ({stagePos.x.toFixed(0)}, {stagePos.y.toFixed(0)})</div>
        <div>Objects: {objects.length}</div>
        <div>Tool: {tool}</div>
      </div>
      
      {/* Controls info */}
      <div className="absolute bottom-4 right-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg text-sm">
        <div className="font-semibold mb-2">Controls:</div>
        <div>• Mouse wheel to zoom (0.1x - 5x)</div>
        <div>• {tool === 'select' ? 'Drag canvas to pan' : 'Select tool to drag canvas'}</div>
        <div>• Click rectangles to select</div>
        <div>• Drag rectangles to move</div>
      </div>
    </div>
  );
};

export default Canvas;
