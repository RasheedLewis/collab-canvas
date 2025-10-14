import React from 'react';
import { COLOR_PALETTE } from '../../types/canvas';
import { useCanvasStore } from '../../store/canvasStore';

interface ColorPickerProps {
  className?: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ className = '' }) => {
  const { activeColor, setActiveColor } = useCanvasStore();

  return (
    <div className={`color-picker ${className}`}>
      <div className="flex items-center space-x-1 p-2 bg-white rounded-lg shadow-lg border">
        <span className="text-sm font-medium text-gray-700 mr-2">Color:</span>
        <div className="flex space-x-1">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              className={`
                w-8 h-8 rounded-md border-2 transition-all duration-200 hover:scale-110
                ${activeColor === color 
                  ? 'border-gray-800 shadow-md scale-110' 
                  : 'border-gray-300 hover:border-gray-500'
                }
              `}
              style={{ backgroundColor: color }}
              onClick={() => setActiveColor(color)}
              title={`Select ${color}`}
              aria-label={`Select color ${color}`}
            >
              {activeColor === color && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full shadow-sm" />
                </div>
              )}
            </button>
          ))}
        </div>
        
        {/* Current color indicator */}
        <div className="ml-3 flex items-center space-x-2">
          <div
            className="w-6 h-6 rounded border-2 border-gray-300"
            style={{ backgroundColor: activeColor }}
          />
          <span className="text-xs font-mono text-gray-600">
            {activeColor}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;
