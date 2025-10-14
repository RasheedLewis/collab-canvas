import React from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import ColorPicker from './ColorPicker';

const Toolbar: React.FC = () => {
  const { tool, setTool, objects, clearCanvas } = useCanvasStore();

  const tools = [
    { id: 'select', name: 'Select', icon: '↖️', description: 'Select and move objects' },
    { id: 'rectangle', name: 'Rectangle', icon: '⬛', description: 'Create rectangles' },
    { id: 'circle', name: 'Circle', icon: '⭕', description: 'Create circles' },
    { id: 'text', name: 'Text', icon: '📝', description: 'Create text (coming soon)' },
  ] as const;

  return (
    <div className="toolbar absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
      <div className="flex items-center space-x-4 bg-white rounded-xl shadow-lg border p-2">
        {/* Tool Selection */}
        <div className="flex items-center space-x-1">
          <span className="text-sm font-medium text-gray-700 mr-2">Tools:</span>
          {tools.map((toolOption) => (
            <button
              key={toolOption.id}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                flex items-center space-x-2 min-w-[80px] justify-center
                ${tool === toolOption.id
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                }
                ${toolOption.id !== 'select' && toolOption.id !== 'rectangle' && toolOption.id !== 'circle'
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:scale-105'
                }
              `}
              onClick={() => {
                if (toolOption.id === 'select' || toolOption.id === 'rectangle' || toolOption.id === 'circle') {
                  setTool(toolOption.id as any);
                }
              }}
              title={toolOption.description}
              disabled={toolOption.id !== 'select' && toolOption.id !== 'rectangle' && toolOption.id !== 'circle'}
            >
              <span className="text-lg">{toolOption.icon}</span>
              <span>{toolOption.name}</span>
            </button>
          ))}
        </div>

        {/* Color Picker */}
        <div className="border-l border-gray-200 pl-4">
          <ColorPicker />
        </div>

        {/* Canvas Actions */}
        <div className="border-l border-gray-200 pl-4 flex items-center space-x-2">
          <button
            onClick={clearCanvas}
            className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 border border-red-200 hover:border-red-300"
            title="Clear canvas"
          >
            🗑️ Clear
          </button>
          
          <div className="text-xs text-gray-500 ml-2">
            Objects: {objects.length}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-2 text-center">
        <div className="inline-block bg-gray-800 text-white text-xs px-3 py-1 rounded-full">
          {tool === 'rectangle' 
            ? 'Click and drag on canvas to create rectangles'
            : tool === 'circle'
            ? 'Click and drag on canvas to create circles'
            : tool === 'select'
            ? 'Click and drag objects to move them'
            : 'Select a tool to get started'
          }
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
