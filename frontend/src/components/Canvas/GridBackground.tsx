import React from 'react';
import { Line } from 'react-konva';

interface GridBackgroundProps {
  width: number;
  height: number;
  gridSize?: number;
  stageX?: number;
  stageY?: number;
  scale?: number;
}

const GridBackground: React.FC<GridBackgroundProps> = ({
  width,
  height,
  gridSize = 50,
  stageX = 0,
  stageY = 0,
  scale = 1
}) => {
  const lines: React.ReactElement[] = [];

  // Calculate visible area considering stage position and scale
  const startX = Math.floor((-stageX) / scale / gridSize) * gridSize;
  const endX = startX + Math.ceil((width / scale)) + gridSize;
  const startY = Math.floor((-stageY) / scale / gridSize) * gridSize;
  const endY = startY + Math.ceil((height / scale)) + gridSize;

  // Generate vertical lines
  for (let x = startX; x <= endX; x += gridSize) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, startY, x, endY]}
        stroke="#e0e0e0"
        strokeWidth={0.5 / scale}
        listening={false}
      />
    );
  }

  // Generate horizontal lines
  for (let y = startY; y <= endY; y += gridSize) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[startX, y, endX, y]}
        stroke="#e0e0e0"
        strokeWidth={0.5 / scale}
        listening={false}
      />
    );
  }

  return <React.Fragment>{lines}</React.Fragment>;
};

export default GridBackground;
