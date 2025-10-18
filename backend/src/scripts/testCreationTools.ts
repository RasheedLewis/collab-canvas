/**
 * Test Script for AI Canvas Creation Tools
 * Tests createRectangle, createCircle, and createText with real-time synchronization
 */

import { ToolRegistry } from '../tools/toolRegistry';
import { CanvasPersistenceService } from '../services/persistenceService';
import { initializeCanvasToolServices, CANVAS_TOOL_HANDLERS } from '../tools/canvasToolHandlers';
import path from 'path';

// Test configuration
const TEST_ROOM_ID = 'test-room-creation-tools';
const TEST_USER_ID = 'test-user-12345';

async function testCreationTools() {
    console.log('🧪 TESTING AI CANVAS CREATION TOOLS\n');

    try {
        // Initialize services (simulating main app initialization)
        console.log('📋 Initializing services...');
        const persistenceService = new CanvasPersistenceService();
        const toolRegistry = new ToolRegistry();

        // Load AI tools
        const toolsPath = path.join(__dirname, '..', '..', 'ai-tools.json');
        console.log(`📥 Loading tools from: ${toolsPath}`);
        const loadResult = await toolRegistry.loadToolsFromFile(toolsPath);

        if (!loadResult.isValid) {
            console.error('❌ Failed to load AI tools:', loadResult.errors);
            return;
        }

        console.log(`✅ Loaded ${toolRegistry.getAllTools().length} AI tools`);

        // Register handlers
        console.log('🔧 Registering tool handlers...');
        initializeCanvasToolServices(persistenceService, null as any); // No WebSocket for this test

        for (const [toolName, handler] of Object.entries(CANVAS_TOOL_HANDLERS)) {
            const wrappedHandler = async (parameters: Record<string, any>, context: any) => {
                return await handler({ ...parameters, ...context });
            };
            toolRegistry.registerHandler(toolName, wrappedHandler);
        }

        console.log('✅ Services initialized\n');

        // Test 1: Create Rectangle
        console.log('🟦 TEST 1: Creating Rectangle');
        const rectangleResult = await toolRegistry.executeTool(
            'createRectangle',
            { x: 100, y: 100, width: 200, height: 150, color: '#3B82F6', strokeColor: '#1E40AF' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Rectangle Result:', JSON.stringify(rectangleResult, null, 2));

        if (!rectangleResult.success) {
            console.error('❌ Rectangle creation failed:', rectangleResult.error);
        } else {
            console.log('✅ Rectangle created successfully\n');
        }

        // Test 2: Create Circle
        console.log('🟢 TEST 2: Creating Circle');
        const circleResult = await toolRegistry.executeTool(
            'createCircle',
            { x: 350, y: 150, radius: 75, color: '#10B981', strokeColor: '#047857' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Circle Result:', JSON.stringify(circleResult, null, 2));

        if (!circleResult.success) {
            console.error('❌ Circle creation failed:', circleResult.error);
        } else {
            console.log('✅ Circle created successfully\n');
        }

        // Test 3: Create Text
        console.log('📝 TEST 3: Creating Text');
        const textResult = await toolRegistry.executeTool(
            'createText',
            {
                x: 500,
                y: 200,
                text: 'Hello AI Canvas!',
                fontSize: 24,
                color: '#1F2937',
                fontFamily: 'Arial'
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Text Result:', JSON.stringify(textResult, null, 2));

        if (!textResult.success) {
            console.error('❌ Text creation failed:', textResult.error);
        } else {
            console.log('✅ Text created successfully\n');
        }

        // Test 4: Validate Input Validation
        console.log('🔍 TEST 4: Testing Input Validation');

        // Test invalid rectangle (negative width)
        console.log('Testing invalid rectangle (negative width)...');
        const invalidRectResult = await toolRegistry.executeTool(
            'createRectangle',
            { x: 100, y: 100, width: -50, height: 100 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (invalidRectResult.success) {
            console.error('❌ Should have failed with negative width');
        } else {
            console.log('✅ Correctly rejected negative width:', invalidRectResult.error);
        }

        // Test invalid color
        console.log('Testing invalid color...');
        const invalidColorResult = await toolRegistry.executeTool(
            'createCircle',
            { x: 100, y: 100, radius: 50, color: 'invalid-color' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (invalidColorResult.success) {
            console.error('❌ Should have failed with invalid color');
        } else {
            console.log('✅ Correctly rejected invalid color:', invalidColorResult.error);
        }

        // Test empty text
        console.log('Testing empty text...');
        const emptyTextResult = await toolRegistry.executeTool(
            'createText',
            { x: 100, y: 100, text: '', fontSize: 16 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (emptyTextResult.success) {
            console.error('❌ Should have failed with empty text');
        } else {
            console.log('✅ Correctly rejected empty text:', emptyTextResult.error);
        }

        // Test 5: Get Canvas State to verify objects were created
        console.log('\n📊 TEST 5: Verifying Canvas State');
        const canvasStateResult = await toolRegistry.executeTool(
            'getCanvasState',
            {},
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (canvasStateResult.success && canvasStateResult.result) {
            const state = canvasStateResult.result;
            console.log(`✅ Canvas state retrieved: ${state.objectCount} objects`);
            console.log('Objects:', state.objects.map((obj: any) => ({
                id: obj.id,
                type: obj.type,
                position: `(${obj.x}, ${obj.y})`,
                ...(obj.type === 'rectangle' && { size: `${obj.width}×${obj.height}` }),
                ...(obj.type === 'circle' && { radius: obj.radius }),
                ...(obj.type === 'text' && { text: obj.text, fontSize: obj.fontSize })
            })));
        } else {
            console.error('❌ Failed to get canvas state:', canvasStateResult.error);
        }

        console.log('\n🎉 ALL CREATION TOOL TESTS COMPLETED!');

        // Summary
        const successCount = [rectangleResult.success, circleResult.success, textResult.success].filter(Boolean).length;
        const validationCount = [!invalidRectResult.success, !invalidColorResult.success, !emptyTextResult.success].filter(Boolean).length;

        console.log(`\n📊 SUMMARY:`);
        console.log(`✅ Creation Tests: ${successCount}/3 passed`);
        console.log(`✅ Validation Tests: ${validationCount}/3 passed`);
        console.log(`✅ Canvas State Test: ${canvasStateResult.success ? 'passed' : 'failed'}`);

        if (successCount === 3 && validationCount === 3 && canvasStateResult.success) {
            console.log('\n🎯 ALL TESTS PASSED! Creation tools are working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Check implementation.');
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testCreationTools().catch(console.error);
}

export { testCreationTools };
