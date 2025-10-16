import React from 'react';
import { Rect } from 'react-konva';
import Konva from 'konva';
import type { RectangleObject } from '../../types/canvas';
import { useCanvasStore } from '../../store/canvasStore';

interface CanvasRectangleProps {
  rectangle: RectangleObject;
  onMove: (objectId: string, x: number, y: number) => void;
}

const CanvasRectangle: React.FC<CanvasRectangleProps> = ({ rectangle, onMove }) => {
  const { selectObject, selectedObjectId } = useCanvasStore();
  
  const isSelected = selectedObjectId === rectangle.id;
  
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true; // Prevent event from bubbling to Stage
    const node = e.target;
    onMove(rectangle.id, node.x(), node.y());
  };
  
  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    selectObject(rectangle.id);
  };
  
  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true; // Prevent event from bubbling to Stage
    selectObject(rectangle.id);
  };

  return (
    <Rect
      id={rectangle.id}
      x={rectangle.x}
      y={rectangle.y}
      width={rectangle.width}
      height={rectangle.height}
      fill={rectangle.color}
      stroke={isSelected ? '#3b82f6' : 'transparent'}
      strokeWidth={isSelected ? 2 : 0}
      cornerRadius={4}
      shadowBlur={isSelected ? 8 : 4}
      shadowColor="rgba(0,0,0,0.2)"
      shadowOffset={{ x: 1, y: 1 }}
      draggable
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onClick={handleClick}
      onTap={handleClick}
      // Visual feedback
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage) {
          stage.container().style.cursor = 'pointer';
        }
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) {
          stage.container().style.cursor = 'default';
        }
      }}
    />
  );
};

export default CanvasRectangle;
