import React from 'react';
import { COLOR_PALETTE, COLOR_NAMES, type PaletteColor } from '../../types/canvas';
import { useCanvasStore } from '../../store/canvasStore';

interface ColorPickerProps {
  className?: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ className = '' }) => {
  const { activeColor, setActiveColor } = useCanvasStore();

  return (
    <div className={`color-picker ${className}`}>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
          Colors
        </div>
        
        {/* Current color display */}
        <div className="flex flex-col items-center space-y-2">
          <div
            className="w-12 h-12 rounded-xl border-2 border-gray-300 shadow-sm"
            style={{ backgroundColor: activeColor }}
          />
          <span className="text-xs font-medium text-gray-600 text-center">
            {COLOR_NAMES[activeColor as PaletteColor] || activeColor}
          </span>
        </div>
        
        {/* Color grid */}
        <div className="grid grid-cols-3 gap-1">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              className={`
                w-full h-8 rounded-lg border-2 transition-all duration-200 hover:scale-110 hover:shadow-md group relative
                ${activeColor === color 
                  ? 'border-gray-700 shadow-lg scale-110 ring-2 ring-blue-200' 
                  : 'border-gray-300 hover:border-gray-600'
                }
              `}
              style={{ backgroundColor: color }}
              onClick={() => setActiveColor(color)}
              title={`Select ${COLOR_NAMES[color]}`}
              aria-label={`Select ${COLOR_NAMES[color]} color`}
            >
              {activeColor === color && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className={`w-2 h-2 rounded-full shadow-sm ${
                    color === '#ffffff' || color === '#f59e0b' ? 'bg-gray-800' : 'bg-white'
                  }`} />
                </div>
              )}
              
              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-30">
                {COLOR_NAMES[color]}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;
