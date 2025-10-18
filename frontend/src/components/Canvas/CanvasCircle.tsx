import React from 'react';
import { Circle } from 'react-konva';
import Konva from 'konva';
import type { CircleObject } from '../../types/canvas';
import { useCanvasStore } from '../../store/canvasStore';

interface CanvasCircleProps {
  circle: CircleObject;
  onMove: (objectId: string, x: number, y: number) => void;
  onDrag?: (stageX: number, stageY: number) => void;
}

const CanvasCircle: React.FC<CanvasCircleProps> = ({ circle, onMove, onDrag }) => {
  const { selectObject, selectedObjectId } = useCanvasStore();
  
  const isSelected = selectedObjectId === circle.id;
  
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true; // Prevent event from bubbling to Stage
    const node = e.target;
    onMove(circle.id, node.x(), node.y());
  };
  
  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    selectObject(circle.id);
  };
  
  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true; // Prevent event from bubbling to Stage
    selectObject(circle.id);
  };

  const handleDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true; // Prevent event from bubbling to Stage
    
    // Update cursor position during drag to maintain cursor visibility for other users
    if (onDrag) {
      const stage = e.target.getStage();
      if (stage) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          onDrag(pointer.x, pointer.y);
        }
      }
    }
  };

  return (
    <Circle
      id={circle.id}
      x={circle.x}
      y={circle.y}
      radius={circle.radius}
      rotation={circle.rotation || 0}
      fill={circle.color}
      stroke={isSelected ? '#3b82f6' : 'transparent'}
      strokeWidth={isSelected ? 2 : 0}
      shadowBlur={isSelected ? 8 : 4}
      shadowColor="rgba(0,0,0,0.2)"
      shadowOffset={{ x: 1, y: 1 }}
      draggable
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
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

export default CanvasCircle;
