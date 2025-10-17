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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Header */}
        <div 
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#374151',
            letterSpacing: '0.025em',
            textTransform: 'uppercase',
            textAlign: 'center'
          }}
        >
          Font Size
        </div>
        
        {/* Font size selector */}
        <select
          value={activeFontSize}
          onChange={(e) => setActiveFontSize(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#374151',
            backgroundColor: 'rgba(249, 250, 251, 0.8)',
            border: '1px solid rgba(209, 213, 219, 0.3)',
            borderRadius: '8px',
            outline: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s ease'
          }}
          onFocus={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
            e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.3)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
          }}
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default FontSizeSelector;
