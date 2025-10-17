import React from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import ColorPicker from './ColorPicker';
import FontSizeSelector from './FontSizeSelector';

const Toolbar: React.FC = () => {
  const { tool, setTool, objects, clearCanvas } = useCanvasStore();

  const tools = [
    { id: 'select', name: 'Select', icon: '↖️', description: 'Select and move objects' },
    { id: 'rectangle', name: 'Rectangle', icon: '⬛', description: 'Create rectangles' },
    { id: 'circle', name: 'Circle', icon: '⭕', description: 'Create circles' },
    { id: 'text', name: 'Text', icon: '📝', description: 'Create and edit text' },
  ] as const;

  return (
    <div className="toolbar">
      <div 
        className="flex flex-col overflow-y-auto"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '16px',
          maxHeight: 'calc(100vh - 8rem)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
          alignItems: 'center',
          width: '96px'
        }}
      >
        {/* Tool Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '100%' }}>
          <div 
            className="text-center mb-2"
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              letterSpacing: '0.025em',
              textTransform: 'uppercase',
              width: '100%'
            }}
          >
            Tools
          </div>
          {tools.map((toolOption) => (
            <button
              key={toolOption.id}
              className="group relative flex flex-col items-center justify-center transition-all duration-200"
              style={{
                padding: '12px',
                borderRadius: '12px',
                minHeight: '48px',
                width: '48px',
                backgroundColor: tool === toolOption.id 
                  ? 'rgba(59, 130, 246, 0.9)' 
                  : 'rgba(249, 250, 251, 0.5)',
                color: tool === toolOption.id ? 'white' : '#374151',
                border: tool === toolOption.id 
                  ? '1px solid rgba(59, 130, 246, 0.3)' 
                  : '1px solid rgba(209, 213, 219, 0.3)',
                boxShadow: tool === toolOption.id 
                  ? '0 4px 12px rgba(59, 130, 246, 0.25)' 
                  : '0 2px 4px rgba(0, 0, 0, 0.05)',
                transform: tool === toolOption.id ? 'scale(1.05)' : 'scale(1)',
                opacity: (toolOption.id !== 'select' && toolOption.id !== 'rectangle' && toolOption.id !== 'circle' && toolOption.id !== 'text') ? 0.4 : 1,
                cursor: (toolOption.id !== 'select' && toolOption.id !== 'rectangle' && toolOption.id !== 'circle' && toolOption.id !== 'text') ? 'not-allowed' : 'pointer'
              }}
              onMouseEnter={(e) => {
                if (toolOption.id === 'select' || toolOption.id === 'rectangle' || toolOption.id === 'circle' || toolOption.id === 'text') {
                  if (tool !== toolOption.id) {
                    e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.8)';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }
                }
              }}
              onMouseLeave={(e) => {
                if (tool !== toolOption.id) {
                  e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.5)';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
              onClick={() => {
                if (toolOption.id === 'select' || toolOption.id === 'rectangle' || toolOption.id === 'circle' || toolOption.id === 'text') {
                  setTool(toolOption.id as any);
                }
              }}
              title={toolOption.description}
              disabled={toolOption.id !== 'select' && toolOption.id !== 'rectangle' && toolOption.id !== 'circle' && toolOption.id !== 'text'}
            >
              <span style={{ fontSize: '24px' }}>{toolOption.icon}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div 
          style={{
            borderTop: '1px solid rgba(209, 213, 219, 0.3)',
            margin: '12px 0'
          }}
        ></div>

        {/* Color Picker */}
        <div style={{ marginBottom: '12px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <ColorPicker />
        </div>

        {/* Font Size Selector (only show when text tool is active) */}
        {tool === 'text' && (
          <>
            <div 
              style={{
                borderTop: '1px solid rgba(209, 213, 219, 0.3)',
                margin: '12px 0'
              }}
            ></div>
            <div style={{ marginBottom: '12px', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <FontSizeSelector />
            </div>
          </>
        )}

        {/* Canvas Actions */}
        <div 
          style={{
            borderTop: '1px solid rgba(209, 213, 219, 0.3)',
            paddingTop: '12px',
            marginTop: '12px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <button
            onClick={clearCanvas}
            className="transition-all duration-200"
            style={{
              padding: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#dc2626',
              backgroundColor: 'rgba(254, 242, 242, 0.8)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              width: '64px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(254, 226, 226, 0.9)';
              e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(254, 242, 242, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.3)';
            }}
            title="Clear canvas"
          >
            <span style={{ fontSize: '18px', marginBottom: '2px' }}>🗑️</span>
            <span style={{ fontSize: '11px' }}>Clear</span>
          </button>
          
          <div 
            style={{
              fontSize: '11px',
              color: '#9ca3af',
              marginTop: '8px',
              textAlign: 'center',
              width: '100%'
            }}
          >
            {objects.length} object{objects.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Toolbar;
