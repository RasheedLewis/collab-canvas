# AI Canvas Tools - Schema Implementation

## Overview

This directory contains the comprehensive AI tool schema implementation for the Canvas Agent, providing dynamic tool loading, validation, versioning, and execution capabilities.

## Architecture

```
src/tools/
├── toolValidator.ts      # Schema validation and linting
├── toolRegistry.ts       # Dynamic tool loading and execution
├── toolVersionManager.ts # Version management and migrations
└── README.md            # Documentation (this file)
```

## Core Components

### 1. Tool Validator (`toolValidator.ts`)

Comprehensive validation system for AI tool schemas with:

- **Schema Validation**: Zod-based validation for OpenAI function calling format
- **Parameter Validation**: Type checking, range validation, required fields
- **Naming Conventions**: Tool name format validation and reserved name checking
- **Category Analysis**: Automatic tool categorization and balance checking
- **Quality Assurance**: Description quality, parameter completeness validation

```typescript
import { toolValidator } from './toolValidator';

// Validate tools from file
const result = await toolValidator.validateFile('./ai-tools.json');

if (result.isValid) {
  console.log(`✅ ${result.tools.length} tools validated successfully`);
} else {
  console.log(`❌ Validation failed: ${result.errors.join(', ')}`);
}
```

### 2. Tool Registry (`toolRegistry.ts`)

Dynamic tool loading and execution system providing:

- **Dynamic Loading**: Load tools from JSON files with hot reload support
- **Handler Registration**: Map tools to execution functions
- **Parameter Validation**: Runtime parameter validation against schemas
- **Execution Context**: User, room, and session context for tool execution
- **Statistics & Monitoring**: Tool usage statistics and handler coverage

```typescript
import { toolRegistry } from './toolRegistry';

// Load tools from file
await toolRegistry.loadToolsFromFile('./ai-tools.json');

// Register a tool handler
toolRegistry.registerHandler('createRectangle', async (parameters, context) => {
  // Implementation for creating rectangle
  return {
    success: true,
    result: { id: 'rect-123', ...parameters },
    toolName: 'createRectangle',
  };
});

// Execute a tool
const result = await toolRegistry.executeTool('createRectangle', {
  x: 100,
  y: 200,
  width: 50,
  height: 75,
  color: 'blue'
}, {
  userId: 'user-123',
  roomId: 'room-456',
  timestamp: Date.now(),
});
```

### 3. Version Manager (`toolVersionManager.ts`)

Semantic versioning and migration system featuring:

- **Version Compatibility**: Check compatibility between schema versions
- **Migration Planning**: Automatic migration path generation
- **Change Tracking**: Detailed changelog and impact analysis
- **Upgrade Automation**: Automatic schema upgrades for compatible changes
- **Backwards Compatibility**: Support for multiple schema versions

```typescript
import { toolVersionManager } from './toolVersionManager';

// Check version compatibility
const compatibility = toolVersionManager.checkCompatibility('1.1.0');

if (compatibility.compatible) {
  console.log('✅ Version is compatible');
  
  if (compatibility.migration) {
    console.log(`📦 Migration available: ${compatibility.migration.changes.length} changes`);
  }
}

// Upgrade tools file
const upgrade = await toolVersionManager.upgradeToolsFile(
  './ai-tools-old.json',
  './ai-tools-new.json',
  '1.2.0'
);
```

## Usage Patterns

### Basic Tool Integration

1. **Load and Validate Tools**:
```typescript
import { toolRegistry, toolValidator } from './tools';

// Load tools with validation
const validation = await toolRegistry.loadToolsFromFile('./ai-tools.json');

if (!validation.isValid) {
  console.error('Tool validation failed:', validation.errors);
  process.exit(1);
}

console.log(`Loaded ${toolRegistry.getAllTools().length} tools`);
```

2. **Register Tool Handlers**:
```typescript
// Register handlers for each tool
toolRegistry.registerHandler('createRectangle', async (params, context) => {
  // Create rectangle on canvas
  const rectangle = await canvasService.createRectangle(params);
  
  // Broadcast to other users via WebSocket
  await websocketService.broadcast(context.roomId, {
    type: 'object_created',
    payload: rectangle,
  });
  
  return { success: true, result: rectangle, toolName: 'createRectangle' };
});

toolRegistry.registerHandler('moveObject', async (params, context) => {
  // Move object on canvas
  const updated = await canvasService.moveObject(params.objectId, params.x, params.y);
  
  // Sync with other users
  await websocketService.broadcast(context.roomId, {
    type: 'object_moved',
    payload: updated,
  });
  
  return { success: true, result: updated, toolName: 'moveObject' };
});
```

3. **OpenAI Integration**:
```typescript
import { openaiService } from '../services/openaiService';

// Get tools for OpenAI API
const aiTools = toolRegistry.getToolsForOpenAI();

// Send request to OpenAI with tools
const response = await openaiService.chatCompletion([
  { role: 'user', content: 'Create a blue rectangle at position 100, 200' }
], aiTools);

// Execute tool calls
if (response.success && response.response?.choices[0]?.message.tool_calls) {
  for (const toolCall of response.response.choices[0].message.tool_calls) {
    if (toolCall.type === 'function') {
      const result = await toolRegistry.executeTool(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments),
        { userId: 'user-123', roomId: 'room-456', timestamp: Date.now() }
      );
      
      console.log('Tool execution result:', result);
    }
  }
}
```

### Advanced Patterns

#### Tool Categories and Search
```typescript
// Get tools by category
const creationTools = toolRegistry.getToolsByCategory('creation');
const layoutTools = toolRegistry.getToolsByCategory('layout');

// Search tools
const textTools = toolRegistry.searchTools('text');
const rectangleTools = toolRegistry.searchTools('rectangle');
```

#### Handler Coverage Monitoring
```typescript
// Check handler coverage
const coverage = toolRegistry.checkHandlerCoverage();

console.log(`Handler coverage: ${coverage.coverage.toFixed(1)}%`);
console.log(`Missing handlers: ${coverage.missingHandlers.join(', ')}`);

// Register missing handlers
for (const toolName of coverage.missingHandlers) {
  toolRegistry.registerHandler(toolName, async (params, context) => {
    console.warn(`Handler not implemented for ${toolName}`);
    return { 
      success: false, 
      error: `Handler not implemented for ${toolName}`,
      toolName 
    };
  });
}
```

#### Hot Reload for Development
```typescript
// Watch for file changes and reload tools
import chokidar from 'chokidar';

chokidar.watch('./ai-tools.json').on('change', async () => {
  console.log('🔄 Tools file changed, reloading...');
  
  const result = await toolRegistry.reloadTools('./ai-tools.json');
  
  if (result.isValid) {
    console.log('✅ Tools reloaded successfully');
  } else {
    console.error('❌ Tool reload failed:', result.errors);
  }
});
```

## Tool Schema Format

Tools are defined in `ai-tools.json` following OpenAI's function calling format:

```json
{
  "ai_canvas_tools": [
    {
      "type": "function",
      "function": {
        "name": "createRectangle",
        "description": "Create a rectangle on the canvas",
        "parameters": {
          "type": "object",
          "properties": {
            "x": {
              "type": "number",
              "description": "X position in pixels"
            },
            "y": {
              "type": "number",
              "description": "Y position in pixels"
            },
            "width": {
              "type": "number",
              "description": "Width in pixels"
            },
            "height": {
              "type": "number",
              "description": "Height in pixels"
            },
            "color": {
              "type": "string",
              "description": "Fill color (hex, rgb, or color name)"
            }
          },
          "required": ["x", "y", "width", "height", "color"]
        }
      }
    }
  ],
  "version": "1.2.0",
  "metadata": {
    "created": "2024-10-18T00:00:00Z",
    "updated": "2024-10-18T20:00:00Z",
    "description": "AI Canvas Agent tool definitions",
    "totalTools": 21
  }
}
```

## Version Management

### Supported Versions
- **1.0.0**: Initial release with basic tools
- **1.1.0**: Added layout and arrangement tools
- **1.2.0**: Added complex creation tools and pattern support

### Migration Process
1. **Automatic Migration**: For non-breaking changes
2. **Manual Migration**: For breaking changes requiring user intervention
3. **Version Validation**: Ensures compatibility before loading
4. **Rollback Support**: Maintains backup of previous versions

### Changelog

#### Version 1.2.0
- ➕ Added `createShapePattern` tool
- ➕ Added `copyObjects` tool  
- 🔄 Enhanced parameter validation
- ⚠️ Deprecated `strokeWidth` parameter (use `borderWidth`)

#### Version 1.1.0
- ➕ Added `arrangeObjectsInGrid` tool
- ➕ Added `spacing` parameter to layout tools
- 🔄 Enhanced color parameter support

## Error Handling

### Validation Errors
- **Schema Errors**: Invalid JSON structure or missing required fields
- **Type Errors**: Parameter type mismatches
- **Range Errors**: Numeric parameters outside valid ranges
- **Naming Errors**: Invalid tool names or reserved word conflicts

### Runtime Errors
- **Missing Handler**: Tool defined but no execution handler registered
- **Parameter Validation**: Runtime parameter validation failures
- **Execution Errors**: Tool handler execution failures
- **Context Errors**: Invalid execution context (missing user/room)

### Best Practices

1. **Comprehensive Validation**: Always validate tools before loading
2. **Handler Coverage**: Ensure all tools have registered handlers
3. **Error Monitoring**: Log and monitor tool execution failures
4. **Version Compatibility**: Check version compatibility before updates
5. **Parameter Documentation**: Provide clear parameter descriptions
6. **Testing**: Test all tools with various parameter combinations

## Development Tools

### Validation Script
```bash
# Validate tools file
npx ts-node -e "
import { toolValidator } from './src/tools/toolValidator';
toolValidator.validateFile('./ai-tools.json').then(result => {
  console.log(toolValidator.getValidationSummary(result));
});
"
```

### Registry Testing
```bash
# Test tool registry
npx ts-node -e "
import { toolRegistry } from './src/tools/toolRegistry';
toolRegistry.loadToolsFromFile('./ai-tools.json').then(() => {
  const stats = toolRegistry.getStats();
  console.log('Registry Stats:', stats);
});
"
```

### Version Check
```bash
# Check version compatibility
npx ts-node -e "
import { toolVersionManager } from './src/tools/toolVersionManager';
const info = toolVersionManager.getVersionInfo();
console.log('Version Info:', info);
"
```

This comprehensive tool schema implementation provides a robust foundation for the AI Canvas Agent, ensuring reliable tool validation, execution, and version management.
