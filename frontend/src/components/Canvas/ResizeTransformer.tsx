import React, { useRef, useEffect } from 'react';
import { Transformer } from 'react-konva';
import Konva from 'konva';
import type { CanvasObject } from '../../types/canvas';

interface ResizeTransformerProps {
  selectedObject: CanvasObject | null;
  stageRef: React.RefObject<Konva.Stage> | React.RefObject<Konva.Stage | null>;
  onResize: (objectId: string, updates: Partial<CanvasObject>) => void;
  onRotate: (objectId: string, rotation: number, x: number, y: number) => void;
}

const ResizeTransformer: React.FC<ResizeTransformerProps> = ({
  selectedObject,
  stageRef,
  onResize,
  onRotate,
}) => {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;

    if (!transformer || !stage) return;

    if (selectedObject) {
      // Find the selected node in the stage
      const selectedNode = stage.findOne(`#${selectedObject.id}`);
      
      if (selectedNode) {
        // Attach transformer to the selected node
        transformer.nodes([selectedNode]);
        
        // Configure transformer based on object type
        if (selectedObject.type === 'circle') {
          // For circles, only allow proportional scaling
          transformer.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
          transformer.keepRatio(true);
        } else if (selectedObject.type === 'text') {
          // For text, use corner handles for proportional font size scaling
          transformer.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
          transformer.keepRatio(true);
        } else {
          // For rectangles, allow free scaling
          transformer.enabledAnchors([
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right'
          ]);
          transformer.keepRatio(false);
        }
      }
    } else {
      // Clear selection
      transformer.nodes([]);
    }
  }, [selectedObject, stageRef]);

  const handleTransformEnd = () => {
    const transformer = transformerRef.current;
    if (!transformer || !selectedObject) return;

    const node = transformer.nodes()[0];
    if (!node) return;

    // Get the transform values before resetting
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const nodeX = node.x();
    const nodeY = node.y();
    const nodeRotation = node.rotation(); // Get rotation in degrees

    // Check if rotation changed
    const currentRotation = selectedObject.rotation || 0;
    const rotationChanged = Math.abs(nodeRotation - currentRotation) > 0.01; // Very small threshold for rotation detection

    // Check if scale changed (indicating resize)
    const scaleChanged = Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001;

    // Handle rotation separately from resize for cleaner events
    if (rotationChanged) {
      console.log(`🔄 Transformer detected rotation change: ${currentRotation}° → ${nodeRotation}°`);
      // When rotation changes, we need to send both rotation and position since the pivot affects position
      onRotate(selectedObject.id, nodeRotation, nodeX, nodeY);
    }

    // Handle resize only if scale actually changed
    if (scaleChanged) {
      let updates: Partial<CanvasObject> = {};

      if (selectedObject.type === 'rectangle') {
        // For rectangles, calculate new width/height and position
        const newWidth = Math.max(5, node.width() * scaleX);
        const newHeight = Math.max(5, node.height() * scaleY);
        
        updates = {
          x: nodeX,
          y: nodeY,
          width: newWidth,
          height: newHeight,
        };

        // Apply the new dimensions immediately to prevent flicker
        node.width(newWidth);
        node.height(newHeight);
        node.scaleX(1);
        node.scaleY(1);
        
      } else if (selectedObject.type === 'circle') {
        // For circles, use the larger scale to maintain proportions
        const scale = Math.max(scaleX, scaleY);
        const newRadius = Math.max(5, (selectedObject as any).radius * scale);
        
        updates = {
          x: nodeX,
          y: nodeY,
          radius: newRadius,
        };

        // Apply the new radius immediately and reset scale
        node.width(newRadius * 2);
        node.height(newRadius * 2);
        node.scaleX(1);
        node.scaleY(1);
        
      } else if (selectedObject.type === 'text') {
        // For text, use the average of scaleX and scaleY for more intuitive corner-based scaling
        const averageScale = (scaleX + scaleY) / 2;
        const newFontSize = Math.max(8, Math.round((selectedObject as any).fontSize * averageScale));
        
        updates = {
          x: nodeX,
          y: nodeY,
          fontSize: newFontSize,
        };

        // Reset scale immediately
        node.scaleX(1);
        node.scaleY(1);
      }

      // Call the resize handler if there were size changes
      if (Object.keys(updates).length > 0) {
        onResize(selectedObject.id, updates);
      }
    }
  };

  return (
    <Transformer
      ref={transformerRef}
      borderEnabled={true}
      borderStroke="#3b82f6"
      borderStrokeWidth={1}
      anchorFill="#3b82f6"
      anchorStroke="#ffffff"
      anchorStrokeWidth={1}
      anchorSize={8}
      anchorCornerRadius={2}
      rotateEnabled={true} // Enable rotation
      onTransformEnd={handleTransformEnd}
      // Prevent transformer from moving the object while transforming
      centeredScaling={false}
      // Ensure consistent anchor behavior
      ignoreStroke={true}
    />
  );
};

export default ResizeTransformer;
