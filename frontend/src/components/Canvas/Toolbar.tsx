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
    <div className="toolbar fixed left-4 top-4 bottom-4 z-20 w-24">
      <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl border border-gray-200 p-3">
        {/* Tool Selection */}
        <div className="flex flex-col space-y-2 flex-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center mb-1">
            Tools
          </div>
          {tools.map((toolOption) => (
            <button
              key={toolOption.id}
              className={`
                p-3 rounded-xl transition-all duration-200 group relative
                flex flex-col items-center justify-center min-h-[56px]
                ${tool === toolOption.id
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }
                ${toolOption.id !== 'select' && toolOption.id !== 'rectangle' && toolOption.id !== 'circle' && toolOption.id !== 'text'
                  ? 'opacity-40 cursor-not-allowed' 
                  : 'hover:scale-110 active:scale-95'
                }
              `}
              onClick={() => {
                if (toolOption.id === 'select' || toolOption.id === 'rectangle' || toolOption.id === 'circle' || toolOption.id === 'text') {
                  setTool(toolOption.id as any);
                }
              }}
              title={toolOption.description}
              disabled={toolOption.id !== 'select' && toolOption.id !== 'rectangle' && toolOption.id !== 'circle' && toolOption.id !== 'text'}
            >
              <span className="text-xl mb-1">{toolOption.icon}</span>
              <span className="text-xs font-medium">{toolOption.name}</span>
              
              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-30">
                {toolOption.description}
              </div>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-3"></div>

        {/* Color Picker */}
        <div className="mb-3">
          <ColorPicker />
        </div>

        {/* Font Size Selector (only show when text tool is active) */}
        {tool === 'text' && (
          <>
            <div className="border-t border-gray-200 my-3"></div>
            <div className="mb-3">
              <FontSizeSelector />
            </div>
          </>
        )}

        {/* Canvas Actions */}
        <div className="border-t border-gray-200 pt-3 mt-auto">
          <button
            onClick={clearCanvas}
            className="w-full p-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 border border-red-200 hover:border-red-300 flex flex-col items-center"
            title="Clear canvas"
          >
            <span className="text-lg mb-1">🗑️</span>
            <span className="text-xs">Clear</span>
          </button>
          
          <div className="text-xs text-gray-400 text-center mt-2">
            {objects.length} object{objects.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Toolbar;
