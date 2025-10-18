import React, { useRef, useEffect } from 'react';
import { Text } from 'react-konva';
import Konva from 'konva';
import type { TextObject } from '../../types/canvas';
import { useCanvasStore } from '../../store/canvasStore';

interface CanvasTextProps {
  textObject: TextObject;
  onMove: (objectId: string, x: number, y: number) => void;
  onTextChanged: (
    objectId: string, 
    text: string, 
    fontSize?: number, 
    fontFamily?: string, 
    fontStyle?: string
  ) => void;
}

const CanvasText: React.FC<CanvasTextProps> = ({ textObject, onMove, onTextChanged }) => {
  const { selectObject, selectedObjectId, editingTextId, setEditingTextId } = useCanvasStore();
  const textRef = useRef<Konva.Text>(null);
  
  const isSelected = selectedObjectId === textObject.id;
  const isEditing = editingTextId === textObject.id;
  
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true; // Prevent event from bubbling to Stage
    const node = e.target;
    onMove(textObject.id, node.x(), node.y());
  };
  
  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    selectObject(textObject.id);
  };
  
  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true; // Prevent event from bubbling to Stage
    selectObject(textObject.id);
  };

  const handleDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    e.evt.preventDefault(); // Prevent default behavior that might cause scrolling
    
    // Start editing
    setEditingTextId(textObject.id);
    
    // Create HTML input element for text editing
    const textNode = textRef.current;
    if (!textNode) return;

    // Hide the konva text
    textNode.hide();

    // Create textarea for editing
    const stage = textNode.getStage();
    if (!stage) return;

    const stageBox = stage.container().getBoundingClientRect();
    const absolutePosition = textNode.absolutePosition();

    const textarea = document.createElement('textarea');
    
    // Create container to prevent layout shifts
    const textEditContainer = document.createElement('div');
    textEditContainer.style.position = 'fixed';
    textEditContainer.style.top = '0';
    textEditContainer.style.left = '0';
    textEditContainer.style.width = '100%';
    textEditContainer.style.height = '100%';
    textEditContainer.style.pointerEvents = 'none';
    textEditContainer.style.zIndex = '1000';
    
    textarea.style.pointerEvents = 'auto';
    textEditContainer.appendChild(textarea);
    document.body.appendChild(textEditContainer);

    // Position the textarea over the text
    const scale = stage.scaleX();
    textarea.value = textObject.text;
    textarea.style.position = 'absolute';
    textarea.style.top = (stageBox.top + absolutePosition.y * scale) + 'px';
    textarea.style.left = (stageBox.left + absolutePosition.x * scale) + 'px';
    textarea.style.width = Math.max(textNode.width() * scale, 100) + 'px';
    textarea.style.height = (textNode.height() * scale) + 'px';
    textarea.style.fontSize = (textObject.fontSize * scale) + 'px';
    textarea.style.fontFamily = textObject.fontFamily || 'Arial, sans-serif';
    textarea.style.color = textObject.color;
    textarea.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    textarea.style.border = '2px solid #3b82f6';
    textarea.style.borderRadius = '4px';
    textarea.style.padding = '4px';
    textarea.style.resize = 'none';
    textarea.style.outline = 'none';
    textarea.style.zIndex = '1001';
    textarea.style.overflow = 'hidden';
    
    // Auto-resize textarea
    const adjustHeight = () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(textarea.scrollHeight, textObject.fontSize * scale) + 'px';
    };
    
    textarea.addEventListener('input', adjustHeight);
    adjustHeight();

    // Focus and select text without scrolling
    textarea.focus({ preventScroll: true });
    textarea.select();

    let isFinished = false; // Prevent double cleanup
    
    const finishEdit = () => {
      if (isFinished) return; // Already finished editing
      isFinished = true;
      
      const newText = textarea.value || 'Text';
      
      // Send text change event (includes optimistic update and WebSocket broadcast)
      onTextChanged(
        textObject.id, 
        newText, 
        textObject.fontSize, 
        textObject.fontFamily, 
        textObject.fontStyle
      );
      
      // Clean up
      setEditingTextId(null);
      textNode.show();
      
      // Safe DOM cleanup - check if container still exists and has parent
      if (textEditContainer && textEditContainer.parentNode === document.body) {
        document.body.removeChild(textEditContainer);
      }
    };

    // Handle keyboard events
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isFinished) return; // Already finished editing
        isFinished = true;
        
        setEditingTextId(null);
        textNode.show();
        
        // Safe DOM cleanup - check if container still exists and has parent
        if (textEditContainer && textEditContainer.parentNode === document.body) {
          document.body.removeChild(textEditContainer);
        }
      }
    });

    // Handle blur (clicking outside)
    textarea.addEventListener('blur', finishEdit);
  };

  // Show/hide text based on editing state
  useEffect(() => {
    const textNode = textRef.current;
    if (textNode) {
      if (isEditing) {
        textNode.hide();
      } else {
        textNode.show();
      }
    }
  }, [isEditing]);

  return (
    <Text
      ref={textRef}
      id={textObject.id}
      x={textObject.x}
      y={textObject.y}
      text={textObject.text}
      fontSize={textObject.fontSize}
      fontFamily={textObject.fontFamily}
      fill={textObject.color}
      stroke={isSelected ? '#3b82f6' : 'transparent'}
      strokeWidth={isSelected ? 1 : 0}
      shadowBlur={isSelected ? 4 : 2}
      shadowColor="rgba(0,0,0,0.2)"
      shadowOffset={{ x: 1, y: 1 }}
      draggable
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
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

export default CanvasText;
