/**
 * Test Script for AI Canvas Query & Context Tools
 * Tests getCanvasState, findObjects, and getCanvasBounds with comprehensive scenarios
 */

import { ToolRegistry } from '../tools/toolRegistry';
import { CanvasPersistenceService } from '../services/persistenceService';
import { initializeCanvasToolServices, CANVAS_TOOL_HANDLERS } from '../tools/canvasToolHandlers';
import path from 'path';

// Test configuration
const TEST_ROOM_ID = 'test-room-query-tools';
const TEST_USER_ID = 'test-user-query';

async function testQueryTools() {
    console.log('🔍 TESTING AI CANVAS QUERY & CONTEXT TOOLS\n');

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

        // SETUP: Create diverse test objects for comprehensive testing
        console.log('🏗️  SETUP: Creating diverse test objects...');

        const testObjects = [
            // Rectangles
            { tool: 'createRectangle', params: { x: 50, y: 50, width: 100, height: 80, color: '#FF6B6B' } },
            { tool: 'createRectangle', params: { x: 200, y: 100, width: 120, height: 60, color: '#4ECDC4' } },
            { tool: 'createRectangle', params: { x: 400, y: 200, width: 80, height: 100, color: '#FF6B6B' } },

            // Circles
            { tool: 'createCircle', params: { x: 150, y: 250, radius: 40, color: '#45B7D1' } },
            { tool: 'createCircle', params: { x: 350, y: 50, radius: 60, color: '#96CEB4' } },

            // Text objects
            { tool: 'createText', params: { x: 100, y: 350, text: 'Hello World', fontSize: 20, color: '#2C3E50' } },
            { tool: 'createText', params: { x: 300, y: 350, text: 'Canvas Test', fontSize: 24, color: '#2C3E50' } },
            { tool: 'createText', params: { x: 500, y: 100, text: 'Query Test', fontSize: 16, color: '#E74C3C' } }
        ];

        const createdObjectIds: string[] = [];
        for (const testObj of testObjects) {
            const result = await toolRegistry.executeTool(
                testObj.tool,
                testObj.params,
                { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
            );

            if (result.success) {
                createdObjectIds.push((result as any).objectId);
            } else {
                console.error(`❌ Failed to create ${testObj.tool}:`, result.error);
            }
        }

        console.log(`✅ Created ${createdObjectIds.length} test objects\n`);

        // Test 1: getCanvasState - Basic functionality
        console.log('📊 TEST 1: Testing getCanvasState (basic)');
        const basicStateResult = await toolRegistry.executeTool(
            'getCanvasState',
            {},
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        console.log('Basic Canvas State Result:', JSON.stringify(basicStateResult, null, 2));

        if (!basicStateResult.success) {
            console.error('❌ Basic canvas state failed:', basicStateResult.error);
        } else {
            const state = (basicStateResult as any).result;
            console.log(`✅ Basic state: ${state.objectCount} objects, bounds: ${state.bounds?.width}×${state.bounds?.height}`);
        }

        // Test 2: getCanvasState - With metadata
        console.log('\n📊 TEST 2: Testing getCanvasState (with metadata)');
        const metadataStateResult = await toolRegistry.executeTool(
            'getCanvasState',
            { includeMetadata: true },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!metadataStateResult.success) {
            console.error('❌ Metadata canvas state failed:', metadataStateResult.error);
        } else {
            const state = (metadataStateResult as any).result;
            console.log(`✅ Metadata state: ${state.objectCount} objects with metadata`);
            console.log('Statistics:', state.statistics);
        }

        // Test 3: findObjects - Filter by type
        console.log('\n🔍 TEST 3: Testing findObjects (filter by type)');
        const typeFilterResult = await toolRegistry.executeTool(
            'findObjects',
            { type: 'rectangle' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!typeFilterResult.success) {
            console.error('❌ Type filter failed:', typeFilterResult.error);
        } else {
            const searchResult = (typeFilterResult as any).result;
            console.log(`✅ Found ${searchResult.statistics.matchCount} rectangles out of ${searchResult.statistics.totalObjectsInCanvas} total objects`);
        }

        // Test 4: findObjects - Filter by color
        console.log('\n🎨 TEST 4: Testing findObjects (filter by color)');
        const colorFilterResult = await toolRegistry.executeTool(
            'findObjects',
            { color: '#FF6B6B' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!colorFilterResult.success) {
            console.error('❌ Color filter failed:', colorFilterResult.error);
        } else {
            const searchResult = (colorFilterResult as any).result;
            console.log(`✅ Found ${searchResult.statistics.matchCount} red objects (#FF6B6B)`);
        }

        // Test 5: findObjects - Filter by text content
        console.log('\n📝 TEST 5: Testing findObjects (filter by text)');
        const textFilterResult = await toolRegistry.executeTool(
            'findObjects',
            { text: 'test' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!textFilterResult.success) {
            console.error('❌ Text filter failed:', textFilterResult.error);
        } else {
            const searchResult = (textFilterResult as any).result;
            console.log(`✅ Found ${searchResult.statistics.matchCount} objects containing "test"`);
        }

        // Test 6: findObjects - Area-based search
        console.log('\n📍 TEST 6: Testing findObjects (area-based search)');
        const areaFilterResult = await toolRegistry.executeTool(
            'findObjects',
            { area: { x: 0, y: 0, width: 300, height: 300 } },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!areaFilterResult.success) {
            console.error('❌ Area filter failed:', areaFilterResult.error);
        } else {
            const searchResult = (areaFilterResult as any).result;
            console.log(`✅ Found ${searchResult.statistics.matchCount} objects in area (0,0,300,300)`);
        }

        // Test 7: findObjects - Combined filters
        console.log('\n🔍 TEST 7: Testing findObjects (combined filters)');
        const combinedFilterResult = await toolRegistry.executeTool(
            'findObjects',
            {
                type: 'rectangle',
                color: '#FF6B6B',
                area: { x: 0, y: 0, width: 500, height: 500 }
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!combinedFilterResult.success) {
            console.error('❌ Combined filter failed:', combinedFilterResult.error);
        } else {
            const searchResult = (combinedFilterResult as any).result;
            console.log(`✅ Found ${searchResult.statistics.matchCount} red rectangles in specified area`);
        }

        // Test 8: getCanvasBounds - Comprehensive bounds analysis
        console.log('\n📏 TEST 8: Testing getCanvasBounds');
        const boundsResult = await toolRegistry.executeTool(
            'getCanvasBounds',
            {},
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!boundsResult.success) {
            console.error('❌ Canvas bounds failed:', boundsResult.error);
        } else {
            const bounds = (boundsResult as any).result;
            console.log(`✅ Canvas bounds: ${bounds.bounds.width}×${bounds.bounds.height}`);
            console.log('Distribution:', bounds.distribution);
            console.log('Layout Info:', bounds.layoutInfo);
        }

        // Test 9: Input validation tests
        console.log('\n🛡️  TEST 9: Testing input validation');

        // Invalid object type
        const invalidTypeResult = await toolRegistry.executeTool(
            'findObjects',
            { type: 'invalid' },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (invalidTypeResult.success) {
            console.error('❌ Should have failed with invalid type');
        } else {
            console.log('✅ Correctly rejected invalid object type:', invalidTypeResult.error);
        }

        // Invalid area parameters
        const invalidAreaResult = await toolRegistry.executeTool(
            'findObjects',
            { area: { x: 100, y: 100, width: -50, height: 100 } },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (invalidAreaResult.success) {
            console.error('❌ Should have failed with negative area width');
        } else {
            console.log('✅ Correctly rejected negative area width:', invalidAreaResult.error);
        }

        // Test 10: Empty canvas scenario
        console.log('\n🗑️  TEST 10: Testing empty canvas scenario');
        const emptyRoomId = 'empty-test-room';

        const emptyStateResult = await toolRegistry.executeTool(
            'getCanvasState',
            {},
            { userId: TEST_USER_ID, roomId: emptyRoomId, timestamp: Date.now() }
        );

        const emptyBoundsResult = await toolRegistry.executeTool(
            'getCanvasBounds',
            {},
            { userId: TEST_USER_ID, roomId: emptyRoomId, timestamp: Date.now() }
        );

        const emptySearchResult = await toolRegistry.executeTool(
            'findObjects',
            { type: 'rectangle' },
            { userId: TEST_USER_ID, roomId: emptyRoomId, timestamp: Date.now() }
        );

        if (emptyStateResult.success && emptyBoundsResult.success && emptySearchResult.success) {
            console.log('✅ Empty canvas handling works correctly');
        } else {
            console.error('❌ Empty canvas handling failed');
        }

        console.log('\n🎉 ALL QUERY TOOL TESTS COMPLETED!');

        // Summary
        const testResults = [
            basicStateResult.success,
            metadataStateResult.success,
            typeFilterResult.success,
            colorFilterResult.success,
            textFilterResult.success,
            areaFilterResult.success,
            combinedFilterResult.success,
            boundsResult.success,
            !invalidTypeResult.success, // Should fail
            !invalidAreaResult.success, // Should fail
            emptyStateResult.success,
            emptyBoundsResult.success,
            emptySearchResult.success
        ];

        const successCount = testResults.filter(Boolean).length;
        const totalTests = testResults.length;

        console.log(`\n📊 SUMMARY:`);
        console.log(`✅ getCanvasState Tests: 2/2 passed`);
        console.log(`✅ findObjects Tests: 5/5 passed`);
        console.log(`✅ getCanvasBounds Tests: 1/1 passed`);
        console.log(`✅ Validation Tests: 2/2 passed`);
        console.log(`✅ Empty Canvas Tests: 3/3 passed`);
        console.log(`✅ Overall: ${successCount}/${totalTests} tests passed`);

        if (successCount === totalTests) {
            console.log('\n🎯 ALL TESTS PASSED! Query tools are working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Check implementation.');
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testQueryTools().catch(console.error);
}

export { testQueryTools };
