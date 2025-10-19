const { ToolRegistry } = require('./dist/tools/toolRegistry.js');
const { CanvasPersistenceService } = require('./dist/services/persistenceService.js');
const { WebSocketConnectionManager } = require('./dist/websocket/connectionHandler.js');
const { initializeCanvasToolServices, CANVAS_TOOL_HANDLERS } = require('./dist/tools/canvasToolHandlers.js');
const http = require('http');

async function testAITool() {
    try {
        console.log('🧪 Testing AI Tool Execution...');

        // Create minimal services for testing
        const persistenceService = new CanvasPersistenceService();
        const server = http.createServer();
        const wsManager = new WebSocketConnectionManager(server);

        console.log('🔧 Initializing services...');
        initializeCanvasToolServices(persistenceService, wsManager);

        // Initialize tool registry
        const toolRegistry = new ToolRegistry();
        await toolRegistry.loadToolsFromFile('./ai-tools.json');

        console.log('📝 Registering tool handlers...');
        for (const [toolName, handler] of Object.entries(CANVAS_TOOL_HANDLERS)) {
            const wrappedHandler = async (parameters, context) => {
                return await handler({ ...parameters, ...context });
            };
            toolRegistry.registerHandler(toolName, wrappedHandler);
            console.log(`🔧 Registered handler for: ${toolName}`);
        }

        console.log('🎯 Testing createRectangle tool...');
        const result = await toolRegistry.executeTool('createRectangle', {
            x: 100,
            y: 100,
            width: 50,
            height: 30,
            color: '#FF0000'
        }, {
            userId: 'test-user',
            roomId: 'test-room',
            timestamp: Date.now()
        });

        console.log('🎉 Tool execution result:', result);

    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

testAITool();
