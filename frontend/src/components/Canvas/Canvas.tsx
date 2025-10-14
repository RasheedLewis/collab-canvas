import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Circle } from 'react-konva';
import Konva from 'konva';
import GridBackground from './GridBackground';

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
        draggable
        onDragEnd={handleDragEnd}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        style={{ cursor: 'grab' }}
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
          
          {/* Demo shapes to test Konva integration */}
          <Rect
            x={200}
            y={150}
            width={150}
            height={100}
            fill="#3b82f6"
            stroke="#1d4ed8"
            strokeWidth={2}
            cornerRadius={8}
            shadowBlur={10}
            shadowColor="rgba(0,0,0,0.3)"
            shadowOffset={{ x: 2, y: 2 }}
          />
          
          <Circle
            x={450}
            y={200}
            radius={60}
            fill="#ef4444"
            stroke="#dc2626"
            strokeWidth={2}
            shadowBlur={10}
            shadowColor="rgba(0,0,0,0.3)"
            shadowOffset={{ x: 2, y: 2 }}
          />
          
          <Text
            x={200}
            y={300}
            text="Konva.js Canvas 🎨"
            fontSize={24}
            fontFamily="Arial, sans-serif"
            fill="#1f2937"
            fontStyle="bold"
            shadowBlur={5}
            shadowColor="rgba(0,0,0,0.2)"
            shadowOffset={{ x: 1, y: 1 }}
          />
          
          <Text
            x={200}
            y={340}
            text="✅ Pan, zoom, and grid background working!"
            fontSize={16}
            fontFamily="Arial, sans-serif"
            fill="#059669"
          />
        </Layer>
      </Stage>
      
      {/* Debug info */}
      <div className="absolute top-4 left-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg text-sm font-mono">
        <div>Scale: {stageScale.toFixed(2)}x</div>
        <div>Position: ({stagePos.x.toFixed(0)}, {stagePos.y.toFixed(0)})</div>
        <div>Canvas Size: {width} x {height}</div>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg text-sm">
        <div className="font-semibold mb-2">Controls:</div>
        <div>• Drag to pan</div>
        <div>• Mouse wheel to zoom</div>
        <div>• Zoom: 0.1x - 5x</div>
      </div>
    </div>
  );
};

export default Canvas;
