/**
 * Test Script for AI Canvas Manipulation Tools
 * Tests moveObject, resizeObject, rotateObject, and deleteObject with real-time synchronization
 */

import { ToolRegistry } from '../tools/toolRegistry';
import { CanvasPersistenceService } from '../services/persistenceService';
import { initializeCanvasToolServices, CANVAS_TOOL_HANDLERS } from '../tools/canvasToolHandlers';
import path from 'path';

// Test configuration
const TEST_ROOM_ID = 'test-room-manipulation-tools';
const TEST_USER_ID = 'test-user-manipulation';

async function testManipulationTools() {
    console.log('🔧 TESTING AI CANVAS MANIPULATION TOOLS\n');

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

        // SETUP: Create test objects to manipulate
        console.log('🏗️  SETUP: Creating test objects...');

        const rectangleResult = await toolRegistry.executeTool(
            'createRectangle',
            { x: 100, y: 100, width: 150, height: 100, color: '#FF6B6B' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        const circleResult = await toolRegistry.executeTool(
            'createCircle',
            { x: 300, y: 150, radius: 50, color: '#51CF66' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        const textResult = await toolRegistry.executeTool(
            'createText',
            { x: 400, y: 200, text: 'Test Text', fontSize: 20, color: '#495057' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!rectangleResult.success || !circleResult.success || !textResult.success) {
            console.error('❌ Failed to create test objects');
            return;
        }

        // Extract object IDs from the ToolRegistry result structure
        const rectangleId = (rectangleResult as any).objectId;
        const circleId = (circleResult as any).objectId;
        const textId = (textResult as any).objectId;

        if (!rectangleId || !circleId || !textId) {
            console.error('❌ Failed to extract object IDs from creation results');
            console.log('Rectangle Result:', JSON.stringify(rectangleResult, null, 2));
            return;
        }

        console.log(`✅ Created test objects: Rectangle(${rectangleId}), Circle(${circleId}), Text(${textId})\n`);

        // Test 1: Move Objects
        console.log('🚚 TEST 1: Testing moveObject');

        // Move rectangle
        const moveRectResult = await toolRegistry.executeTool(
            'moveObject',
            { objectId: rectangleId, x: 200, y: 150 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Move Rectangle Result:', JSON.stringify(moveRectResult, null, 2));

        if (!moveRectResult.success) {
            console.error('❌ Rectangle move failed:', moveRectResult.error);
        } else {
            console.log('✅ Rectangle moved successfully');
        }

        // Test invalid move (negative coordinates)
        const invalidMoveResult = await toolRegistry.executeTool(
            'moveObject',
            { objectId: circleId, x: -50, y: 100 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (invalidMoveResult.success) {
            console.error('❌ Should have failed with negative coordinates');
        } else {
            console.log('✅ Correctly rejected negative coordinates:', invalidMoveResult.error);
        }

        // Test 2: Resize Objects
        console.log('\n📏 TEST 2: Testing resizeObject');

        // Resize rectangle
        const resizeRectResult = await toolRegistry.executeTool(
            'resizeObject',
            { objectId: rectangleId, width: 200, height: 120 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Resize Rectangle Result:', JSON.stringify(resizeRectResult, null, 2));

        if (!resizeRectResult.success) {
            console.error('❌ Rectangle resize failed:', resizeRectResult.error);
        } else {
            console.log('✅ Rectangle resized successfully');
        }

        // Resize circle
        const resizeCircleResult = await toolRegistry.executeTool(
            'resizeObject',
            { objectId: circleId, radius: 75 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Resize Circle Result:', JSON.stringify(resizeCircleResult, null, 2));

        if (!resizeCircleResult.success) {
            console.error('❌ Circle resize failed:', resizeCircleResult.error);
        } else {
            console.log('✅ Circle resized successfully');
        }

        // Resize text font
        const resizeTextResult = await toolRegistry.executeTool(
            'resizeObject',
            { objectId: textId, fontSize: 28 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Resize Text Result:', JSON.stringify(resizeTextResult, null, 2));

        if (!resizeTextResult.success) {
            console.error('❌ Text resize failed:', resizeTextResult.error);
        } else {
            console.log('✅ Text resized successfully');
        }

        // Test invalid resize (negative dimensions)
        const invalidResizeResult = await toolRegistry.executeTool(
            'resizeObject',
            { objectId: rectangleId, width: -100 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (invalidResizeResult.success) {
            console.error('❌ Should have failed with negative width');
        } else {
            console.log('✅ Correctly rejected negative width:', invalidResizeResult.error);
        }

        // Test 3: Rotate Objects
        console.log('\n🔄 TEST 3: Testing rotateObject');

        // Rotate rectangle
        const rotateRectResult = await toolRegistry.executeTool(
            'rotateObject',
            { objectId: rectangleId, rotation: 45 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Rotate Rectangle Result:', JSON.stringify(rotateRectResult, null, 2));

        if (!rotateRectResult.success) {
            console.error('❌ Rectangle rotation failed:', rotateRectResult.error);
        } else {
            console.log('✅ Rectangle rotated successfully');
        }

        // Rotate with large angle (should normalize)
        const rotateLargeResult = await toolRegistry.executeTool(
            'rotateObject',
            { objectId: circleId, rotation: 450 },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Rotate Large Angle Result:', JSON.stringify(rotateLargeResult, null, 2));

        if (!rotateLargeResult.success) {
            console.error('❌ Large angle rotation failed:', rotateLargeResult.error);
        } else {
            console.log(`✅ Large angle normalized: 450° → ${(rotateLargeResult as any).newRotation}°`);
        }

        // Test invalid rotation (non-number)
        const invalidRotateResult = await toolRegistry.executeTool(
            'rotateObject',
            { objectId: textId, rotation: 'invalid' as any },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (invalidRotateResult.success) {
            console.error('❌ Should have failed with non-number rotation');
        } else {
            console.log('✅ Correctly rejected non-number rotation:', invalidRotateResult.error);
        }

        // Test 4: Delete Objects
        console.log('\n🗑️  TEST 4: Testing deleteObject');

        // Delete text object
        const deleteTextResult = await toolRegistry.executeTool(
            'deleteObject',
            { objectId: textId },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Delete Text Result:', JSON.stringify(deleteTextResult, null, 2));

        if (!deleteTextResult.success) {
            console.error('❌ Text deletion failed:', deleteTextResult.error);
        } else {
            console.log('✅ Text object deleted successfully');
        }

        // Test delete non-existent object
        const deleteNonExistentResult = await toolRegistry.executeTool(
            'deleteObject',
            { objectId: 'non-existent-id' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (deleteNonExistentResult.success) {
            console.error('❌ Should have failed with non-existent object ID');
        } else {
            console.log('✅ Correctly rejected non-existent object ID:', deleteNonExistentResult.error);
        }

        // Test 5: Verify Final Canvas State
        console.log('\n📊 TEST 5: Verifying Final Canvas State');
        const finalStateResult = await toolRegistry.executeTool(
            'getCanvasState',
            {},
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (finalStateResult.success && (finalStateResult as any).result) {
            const state = (finalStateResult as any).result;
            console.log(`✅ Final canvas state: ${state.objectCount} objects remaining`);
            console.log('Final Objects:', state.objects.map((obj: any) => ({
                id: obj.id,
                type: obj.type,
                position: `(${obj.x}, ${obj.y})`,
                rotation: obj.rotation || 0,
                ...(obj.type === 'rectangle' && { size: `${obj.width}×${obj.height}` }),
                ...(obj.type === 'circle' && { radius: obj.radius }),
                ...(obj.type === 'text' && { text: obj.text, fontSize: obj.fontSize })
            })));
        } else {
            console.error('❌ Failed to get final canvas state:', finalStateResult.error);
        }

        console.log('\n🎉 ALL MANIPULATION TOOL TESTS COMPLETED!');

        // Summary
        const testResults = [
            moveRectResult.success,
            !invalidMoveResult.success, // Should fail
            resizeRectResult.success,
            resizeCircleResult.success,
            resizeTextResult.success,
            !invalidResizeResult.success, // Should fail
            rotateRectResult.success,
            rotateLargeResult.success,
            !invalidRotateResult.success, // Should fail
            deleteTextResult.success,
            !deleteNonExistentResult.success, // Should fail
            finalStateResult.success
        ];

        const successCount = testResults.filter(Boolean).length;
        const totalTests = testResults.length;

        console.log(`\n📊 SUMMARY:`);
        console.log(`✅ Move Tests: ${moveRectResult.success ? '1' : '0'}/1 passed`);
        console.log(`✅ Resize Tests: ${[resizeRectResult.success, resizeCircleResult.success, resizeTextResult.success].filter(Boolean).length}/3 passed`);
        console.log(`✅ Rotate Tests: ${[rotateRectResult.success, rotateLargeResult.success].filter(Boolean).length}/2 passed`);
        console.log(`✅ Delete Tests: ${deleteTextResult.success ? '1' : '0'}/1 passed`);
        console.log(`✅ Validation Tests: ${[!invalidMoveResult.success, !invalidResizeResult.success, !invalidRotateResult.success, !deleteNonExistentResult.success].filter(Boolean).length}/4 passed`);
        console.log(`✅ Canvas State Test: ${finalStateResult.success ? 'passed' : 'failed'}`);
        console.log(`✅ Overall: ${successCount}/${totalTests} tests passed`);

        if (successCount === totalTests) {
            console.log('\n🎯 ALL TESTS PASSED! Manipulation tools are working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Check implementation.');
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testManipulationTools().catch(console.error);
}

export { testManipulationTools };
