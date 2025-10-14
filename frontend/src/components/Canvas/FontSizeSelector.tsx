import React from 'react';
import { useCanvasStore } from '../../store/canvasStore';

interface FontSizeSelectorProps {
  className?: string;
}

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64] as const;

const FontSizeSelector: React.FC<FontSizeSelectorProps> = ({ className = '' }) => {
  const { activeFontSize, setActiveFontSize } = useCanvasStore();

  return (
    <div className={`font-size-selector ${className}`}>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
          Font Size
        </div>
        
        {/* Current font size display */}
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">
            {activeFontSize}px
          </div>
        </div>
        
        {/* Font size selector */}
        <select
          value={activeFontSize}
          onChange={(e) => setActiveFontSize(Number(e.target.value))}
          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
        
        {/* Custom size input */}
        <input
          type="number"
          value={activeFontSize}
          onChange={(e) => {
            const size = Math.max(6, Math.min(200, Number(e.target.value) || 16));
            setActiveFontSize(size);
          }}
          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          min="6"
          max="200"
          step="1"
          placeholder="Custom size"
        />
      </div>
    </div>
  );
};

export default FontSizeSelector;
