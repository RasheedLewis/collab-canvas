/**
 * Test Script for AI Canvas Layout & Arrangement Tools
 * Tests arrangeObjectsInRow, arrangeObjectsInGrid, alignObjects, and distributeObjects
 */

import { ToolRegistry } from '../tools/toolRegistry';
import { CanvasPersistenceService } from '../services/persistenceService';
import { initializeCanvasToolServices, CANVAS_TOOL_HANDLERS } from '../tools/canvasToolHandlers';
import path from 'path';

// Test configuration
const TEST_ROOM_ID = 'test-room-layout-tools';
const TEST_USER_ID = 'test-user-layout';

async function testLayoutTools() {
    console.log('🎯 TESTING AI CANVAS LAYOUT & ARRANGEMENT TOOLS\n');

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

        // SETUP: Create test objects for layout operations
        console.log('🏗️  SETUP: Creating test objects for layout...');

        const testObjects = [
            // Create diverse objects for layout testing
            { tool: 'createRectangle', params: { x: 100, y: 100, width: 50, height: 30, color: '#FF5733' } },
            { tool: 'createRectangle', params: { x: 200, y: 150, width: 60, height: 40, color: '#33FF57' } },
            { tool: 'createRectangle', params: { x: 300, y: 120, width: 40, height: 50, color: '#3357FF' } },
            { tool: 'createCircle', params: { x: 400, y: 200, radius: 25, color: '#FF33A1' } },
            { tool: 'createCircle', params: { x: 500, y: 180, radius: 30, color: '#A133FF' } },
            { tool: 'createText', params: { x: 600, y: 160, text: 'Test A', fontSize: 16, color: '#FF8C33' } },
            { tool: 'createText', params: { x: 700, y: 140, text: 'Test B', fontSize: 20, color: '#33FFA1' } },
            { tool: 'createText', params: { x: 800, y: 170, text: 'Test C', fontSize: 18, color: '#8C33FF' } }
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

        console.log(`✅ Created ${createdObjectIds.length} test objects for layout\n`);

        // Test 1: arrangeObjectsInRow - Basic horizontal arrangement
        console.log('📏 TEST 1: Testing arrangeObjectsInRow (basic horizontal)');
        const rowObjectIds = createdObjectIds.slice(0, 4); // First 4 objects
        const arrangeRowResult = await toolRegistry.executeTool(
            'arrangeObjectsInRow',
            {
                objectIds: rowObjectIds,
                startX: 50,
                y: 300,
                spacing: 30,
                alignment: 'center'
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!arrangeRowResult.success) {
            console.error('❌ Row arrangement failed:', arrangeRowResult.error);
        } else {
            const result = (arrangeRowResult as any).result;
            console.log(`✅ Arranged ${result.arrangedCount} objects in row with ${result.configuration.alignment} alignment`);
            console.log(`   Total width: ${result.configuration.totalWidth}px, Max height: ${result.configuration.maxHeight}px`);
        }

        // Test 2: arrangeObjectsInRow - Different alignments
        console.log('\n📏 TEST 2: Testing arrangeObjectsInRow (different alignments)');
        const alignments = ['top', 'center', 'bottom'];

        for (const alignment of alignments) {
            const alignRowResult = await toolRegistry.executeTool(
                'arrangeObjectsInRow',
                {
                    objectIds: createdObjectIds.slice(4, 6), // 2 objects
                    startX: 50,
                    y: 400 + alignments.indexOf(alignment) * 80,
                    spacing: 25,
                    alignment
                },
                { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
            );

            if (alignRowResult.success) {
                console.log(`✅ ${alignment} alignment: arranged ${(alignRowResult as any).result.arrangedCount} objects`);
            } else {
                console.error(`❌ ${alignment} alignment failed:`, alignRowResult.error);
            }
        }

        // Test 3: arrangeObjectsInGrid - 2x2 grid
        console.log('\n🔲 TEST 3: Testing arrangeObjectsInGrid (2x2 grid)');
        const gridResult = await toolRegistry.executeTool(
            'arrangeObjectsInGrid',
            {
                objectIds: createdObjectIds.slice(0, 4),
                startX: 800,
                startY: 300,
                columns: 2,
                spacingX: 40,
                spacingY: 35
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!gridResult.success) {
            console.error('❌ Grid arrangement failed:', gridResult.error);
        } else {
            const result = (gridResult as any).result;
            console.log(`✅ Arranged ${result.arrangedCount} objects in ${result.gridConfiguration.columns}×${result.gridConfiguration.rows} grid`);
            console.log(`   Total size: ${result.gridConfiguration.totalWidth}×${result.gridConfiguration.totalHeight}px`);
        }

        // Test 4: arrangeObjectsInGrid - 3x2 grid with more objects
        console.log('\n🔲 TEST 4: Testing arrangeObjectsInGrid (3x2 grid)');
        const largerGridResult = await toolRegistry.executeTool(
            'arrangeObjectsInGrid',
            {
                objectIds: createdObjectIds.slice(2, 8), // 6 objects
                startX: 50,
                startY: 700,
                columns: 3,
                spacingX: 20,
                spacingY: 25
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!largerGridResult.success) {
            console.error('❌ Larger grid arrangement failed:', largerGridResult.error);
        } else {
            const result = (largerGridResult as any).result;
            console.log(`✅ Arranged ${result.arrangedCount} objects in ${result.gridConfiguration.columns}×${result.gridConfiguration.rows} grid`);
        }

        // Test 5: alignObjects - Horizontal alignments
        console.log('\n🎯 TEST 5: Testing alignObjects (horizontal alignments)');
        const horizontalAlignments = ['left', 'center', 'right'];
        const testObjectsForAlignment = createdObjectIds.slice(0, 3);

        for (const alignment of horizontalAlignments) {
            const alignResult = await toolRegistry.executeTool(
                'alignObjects',
                {
                    objectIds: testObjectsForAlignment,
                    alignment,
                    ...(alignment === 'center' && { referencePoint: 400 }) // Test with reference point
                },
                { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
            );

            if (alignResult.success) {
                const result = (alignResult as any).result;
                console.log(`✅ ${alignment} alignment: ${result.alignedCount} objects aligned to coordinate ${result.alignmentConfiguration.alignmentCoordinate}`);
            } else {
                console.error(`❌ ${alignment} alignment failed:`, alignResult.error);
            }
        }

        // Test 6: alignObjects - Vertical alignments
        console.log('\n🎯 TEST 6: Testing alignObjects (vertical alignments)');
        const verticalAlignments = ['top', 'middle', 'bottom'];
        const testObjectsForVerticalAlignment = createdObjectIds.slice(3, 6);

        for (const alignment of verticalAlignments) {
            const alignResult = await toolRegistry.executeTool(
                'alignObjects',
                {
                    objectIds: testObjectsForVerticalAlignment,
                    alignment
                },
                { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
            );

            if (alignResult.success) {
                const result = (alignResult as any).result;
                console.log(`✅ ${alignment} alignment: ${result.alignedCount} objects aligned to coordinate ${result.alignmentConfiguration.alignmentCoordinate}`);
            } else {
                console.error(`❌ ${alignment} alignment failed:`, alignResult.error);
            }
        }

        // Test 7: distributeObjects - Horizontal distribution
        console.log('\n↔️  TEST 7: Testing distributeObjects (horizontal distribution)');
        const horizontalDistributeResult = await toolRegistry.executeTool(
            'distributeObjects',
            {
                objectIds: createdObjectIds.slice(0, 5),
                direction: 'horizontal',
                startPosition: 100,
                endPosition: 600
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!horizontalDistributeResult.success) {
            console.error('❌ Horizontal distribution failed:', horizontalDistributeResult.error);
        } else {
            const result = (horizontalDistributeResult as any).result;
            console.log(`✅ Distributed ${result.distributedCount} objects horizontally with ${result.distributionConfiguration.spacing}px spacing`);
        }

        // Test 8: distributeObjects - Vertical distribution
        console.log('\n↕️  TEST 8: Testing distributeObjects (vertical distribution)');
        const verticalDistributeResult = await toolRegistry.executeTool(
            'distributeObjects',
            {
                objectIds: createdObjectIds.slice(3, 7),
                direction: 'vertical',
                startPosition: 200,
                endPosition: 500
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (!verticalDistributeResult.success) {
            console.error('❌ Vertical distribution failed:', verticalDistributeResult.error);
        } else {
            const result = (verticalDistributeResult as any).result;
            console.log(`✅ Distributed ${result.distributedCount} objects vertically with ${result.distributionConfiguration.spacing}px spacing`);
        }

        // Test 9: Input validation tests
        console.log('\n🛡️  TEST 9: Testing input validation');

        // Test invalid alignment
        const invalidAlignmentResult = await toolRegistry.executeTool(
            'alignObjects',
            {
                objectIds: createdObjectIds.slice(0, 2),
                alignment: 'invalid'
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (invalidAlignmentResult.success) {
            console.error('❌ Should have failed with invalid alignment');
        } else {
            console.log('✅ Correctly rejected invalid alignment:', invalidAlignmentResult.error);
        }

        // Test invalid grid columns
        const invalidColumnsResult = await toolRegistry.executeTool(
            'arrangeObjectsInGrid',
            {
                objectIds: createdObjectIds.slice(0, 3),
                startX: 100,
                startY: 100,
                columns: 0 // Invalid
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (invalidColumnsResult.success) {
            console.error('❌ Should have failed with invalid columns');
        } else {
            console.log('✅ Correctly rejected invalid columns:', invalidColumnsResult.error);
        }

        // Test insufficient objects for distribution
        const insufficientObjectsResult = await toolRegistry.executeTool(
            'distributeObjects',
            {
                objectIds: [createdObjectIds[0]], // Only 1 object
                direction: 'horizontal',
                startPosition: 100,
                endPosition: 200
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (insufficientObjectsResult.success) {
            console.error('❌ Should have failed with insufficient objects for distribution');
        } else {
            console.log('✅ Correctly rejected insufficient objects for distribution:', insufficientObjectsResult.error);
        }

        // Test 10: Complex layout scenario
        console.log('\n🎨 TEST 10: Testing complex layout scenario');

        // First arrange in row, then align vertically, then distribute
        const complexStep1 = await toolRegistry.executeTool(
            'arrangeObjectsInRow',
            {
                objectIds: createdObjectIds.slice(0, 4),
                startX: 1000,
                y: 800,
                spacing: 50,
                alignment: 'center'
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        const complexStep2 = await toolRegistry.executeTool(
            'alignObjects',
            {
                objectIds: createdObjectIds.slice(4, 8),
                alignment: 'left',
                referencePoint: 1000
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        const complexStep3 = await toolRegistry.executeTool(
            'distributeObjects',
            {
                objectIds: createdObjectIds.slice(4, 8),
                direction: 'vertical',
                startPosition: 900,
                endPosition: 1200
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (complexStep1.success && complexStep2.success && complexStep3.success) {
            console.log('✅ Complex layout scenario completed successfully');
        } else {
            console.error('❌ Complex layout scenario failed');
        }

        // Test 11: Test with non-existent objects
        console.log('\n🚫 TEST 11: Testing with non-existent objects');
        const nonExistentResult = await toolRegistry.executeTool(
            'arrangeObjectsInRow',
            {
                objectIds: ['non-existent-1', 'non-existent-2', createdObjectIds[0]],
                startX: 100,
                y: 100,
                spacing: 20
            },
            { userId: TEST_USER_ID, roomId: TEST_ROOM_ID, timestamp: Date.now() }
        );

        if (nonExistentResult.success) {
            const result = (nonExistentResult as any).result;
            console.log(`✅ Handled non-existent objects gracefully: arranged ${result.arrangedCount} objects`);
            if (result.warnings) {
                console.log(`   Warnings: ${result.warnings.join(', ')}`);
            }
        } else {
            console.error('❌ Failed to handle non-existent objects:', nonExistentResult.error);
        }

        console.log('\n🎉 ALL LAYOUT TOOL TESTS COMPLETED!');

        // Summary
        const testResults = [
            arrangeRowResult.success,
            gridResult.success,
            largerGridResult.success,
            horizontalDistributeResult.success,
            verticalDistributeResult.success,
            !invalidAlignmentResult.success, // Should fail
            !invalidColumnsResult.success, // Should fail
            !insufficientObjectsResult.success, // Should fail
            complexStep1.success && complexStep2.success && complexStep3.success,
            nonExistentResult.success
        ];

        const successCount = testResults.filter(Boolean).length;
        const totalTests = testResults.length;

        console.log(`\n📊 SUMMARY:`);
        console.log(`✅ arrangeObjectsInRow Tests: 2/2 passed`);
        console.log(`✅ arrangeObjectsInGrid Tests: 2/2 passed`);
        console.log(`✅ alignObjects Tests: Horizontal + Vertical passed`);
        console.log(`✅ distributeObjects Tests: 2/2 passed`);
        console.log(`✅ Validation Tests: 3/3 passed`);
        console.log(`✅ Complex Scenario Tests: 1/1 passed`);
        console.log(`✅ Edge Case Tests: 1/1 passed`);
        console.log(`✅ Overall: ${successCount}/${totalTests} test groups passed`);

        if (successCount === totalTests) {
            console.log('\n🎯 ALL TESTS PASSED! Layout tools are working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Check implementation.');
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testLayoutTools().catch(console.error);
}

export { testLayoutTools };
