import React from 'react';
import { COLOR_PALETTE, COLOR_NAMES } from '../../types/canvas';
import { useCanvasStore } from '../../store/canvasStore';

interface ColorPickerProps {
  className?: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ className = '' }) => {
  const { activeColor, setActiveColor } = useCanvasStore();

  return (
    <div className={`color-picker ${className}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Header */}
        <div 
          className="text-center"
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#374151',
            letterSpacing: '0.025em',
            textTransform: 'uppercase'
          }}
        >
          Colors
        </div>
        
        
        {/* Color grid - 2 columns */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            padding: '8px',
            backgroundColor: 'rgba(249, 250, 251, 0.5)',
            borderRadius: '12px'
          }}
        >
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              className="group relative transition-all duration-200"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: color,
                border: activeColor === color 
                  ? '3px solid rgba(59, 130, 246, 0.8)' 
                  : '2px solid rgba(255, 255, 255, 0.8)',
                boxShadow: activeColor === color 
                  ? '0 4px 12px rgba(59, 130, 246, 0.25), 0 0 0 2px rgba(59, 130, 246, 0.1)' 
                  : '0 2px 6px rgba(0, 0, 0, 0.1)',
                transform: activeColor === color ? 'scale(1.1)' : 'scale(1)',
                cursor: 'pointer',
                justifySelf: 'center'
              }}
              onMouseEnter={(e) => {
                if (activeColor !== color) {
                  e.currentTarget.style.transform = 'scale(1.15)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeColor !== color) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
                }
              }}
              onClick={() => setActiveColor(color)}
              title={`Select ${COLOR_NAMES[color]}`}
              aria-label={`Select ${COLOR_NAMES[color]} color`}
            >
              {/* No content inside - clean circles only */}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;
