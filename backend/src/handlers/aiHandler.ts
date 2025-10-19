import { Request, Response } from 'express';
import { OpenAIService } from '../services/openaiService';
import { ToolRegistry } from '../tools/toolRegistry';
import { CanvasPersistenceService } from '../services/persistenceService';
import { z } from 'zod';

// Services will be injected or imported as singletons
let openaiService: OpenAIService;
let toolRegistry: ToolRegistry;
let persistenceService: CanvasPersistenceService;

// Initialize services function (to be called from main app)
export function initializeAIServices(
    openai: OpenAIService,
    registry: ToolRegistry,
    persistence: CanvasPersistenceService
) {
    openaiService = openai;
    toolRegistry = registry;
    persistenceService = persistence;
}

// Request schemas
const ChatRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string()
    })).min(1, 'At least one message is required'),
    roomId: z.string().min(1, 'Room ID is required')
});

const ExecuteToolRequestSchema = z.object({
    toolName: z.string().min(1, 'Tool name is required'),
    parameters: z.record(z.string(), z.any()),
    roomId: z.string().min(1, 'Room ID is required'),
    userId: z.string().min(1, 'User ID is required')
});

/**
 * Handle AI chat conversations with OpenAI
 */
export async function aiChatHandler(req: Request, res: Response): Promise<void> {
    try {
        // Validate request body
        const validationResult = ChatRequestSchema.safeParse(req.body);
        if (!validationResult.success) {
            res.status(400).json({
                error: 'Invalid request',
                details: validationResult.error.issues
            });
            return;
        }

        const { messages, roomId } = validationResult.data;

        // Extract userId from authenticated request
        const userId = (req as any).user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'User authentication required' });
            return;
        }

        // Get current canvas state for context
        const canvasState = await persistenceService.getCanvasState(roomId) || { roomId, objects: [], lastUpdated: Date.now(), version: 1 };

        // Get available tools for function calling
        const toolSchemas = toolRegistry.getToolsForOpenAI();

        // Build conversation context
        const systemPrompt = `You are an AI assistant for CollabCanvas, a real-time collaborative drawing application. 
You can help users create, modify, and organize objects on their canvas.

Current Canvas State:
- Room ID: ${roomId}
- Object Count: ${canvasState.objects.length}
- Canvas Objects: ${JSON.stringify(canvasState.objects, null, 2)}

You have access to the following tools to manipulate the canvas:
${toolSchemas.map(tool => `- ${tool.function.name}: ${tool.function.description}`).join('\n')}

Guidelines:
1. Use the available tools to perform canvas operations when requested
2. Always confirm actions with clear descriptions
3. Ask for clarification if requests are ambiguous
4. Respect canvas boundaries and object relationships
5. Provide helpful suggestions for canvas improvements`;

        const conversationMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...messages
        ];

        // Make OpenAI API call
        const apiResult = await openaiService.chatCompletion(
            conversationMessages,
            toolSchemas.length > 0 ? toolSchemas : undefined,
            userId
        );

        if (!apiResult.success || !apiResult.response) {
            throw new Error(apiResult.error || 'OpenAI API request failed');
        }

        const response = apiResult.response;

        // Handle tool calls if present
        let toolResults: any[] = [];
        let finalResponse = response;

        if (response.choices[0]?.message?.tool_calls) {
            for (const toolCall of response.choices[0].message.tool_calls) {
                if (toolCall.type === 'function') {
                    try {
                        console.log(`🔧 Parsing arguments for ${toolCall.function.name}:`);
                        console.log(`📝 Raw arguments:`, toolCall.function.arguments);

                        let parsedArgs;
                        try {
                            // Try to parse as-is first
                            parsedArgs = JSON.parse(toolCall.function.arguments);
                            console.log(`✅ Parsed arguments successfully:`, parsedArgs);
                        } catch (parseError) {
                            console.log(`🔧 Attempting to fix AI-generated JSON with math expressions...`);

                            try {
                                // Sanitize AI-generated math expressions in JSON
                                let sanitizedJson = toolCall.function.arguments;
                                let maxIterations = 10; // Prevent infinite loops
                                let iteration = 0;

                                // Keep processing until no more math expressions found
                                while (iteration < maxIterations) {
                                    const originalJson = sanitizedJson;

                                    // Fix unquoted math expressions: "key": a + b + c -> "key": result  
                                    sanitizedJson = sanitizedJson
                                        .replace(/:\s*(\d+\.?\d*)\s*\+\s*(\d+\.?\d*)/g, (match, a, b) => {
                                            const result = parseFloat(a) + parseFloat(b);
                                            console.log(`   Fixed unquoted add: ${match} → : ${result}`);
                                            return `: ${result}`;
                                        })
                                        .replace(/:\s*(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/g, (match, a, b) => {
                                            const result = parseFloat(a) - parseFloat(b);
                                            console.log(`   Fixed unquoted subtract: ${match} → : ${result}`);
                                            return `: ${result}`;
                                        })
                                        .replace(/:\s*(\d+\.?\d*)\s*\*\s*(\d+\.?\d*)/g, (match, a, b) => {
                                            const result = parseFloat(a) * parseFloat(b);
                                            console.log(`   Fixed unquoted multiply: ${match} → : ${result}`);
                                            return `: ${result}`;
                                        })
                                        .replace(/:\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/g, (match, a, b) => {
                                            const result = parseFloat(a) / parseFloat(b);
                                            console.log(`   Fixed unquoted divide: ${match} → : ${result}`);
                                            return `: ${result}`;
                                        })
                                        // Fix quoted math expressions
                                        .replace(/"(\d+\.?\d*)\s*\+\s*(\d+\.?\d*)"/g, (match, a, b) => {
                                            const result = parseFloat(a) + parseFloat(b);
                                            console.log(`   Fixed quoted add: ${match} → "${result}"`);
                                            return `"${result}"`;
                                        })
                                        .replace(/"(\d+\.?\d*)\s*-\s*(\d+\.?\d*)"/g, (match, a, b) => {
                                            const result = parseFloat(a) - parseFloat(b);
                                            console.log(`   Fixed quoted subtract: ${match} → "${result}"`);
                                            return `"${result}"`;
                                        });

                                    // If no changes made, we're done
                                    if (sanitizedJson === originalJson) {
                                        break;
                                    }

                                    iteration++;
                                    console.log(`   Iteration ${iteration}: Applied math fixes`);
                                }

                                console.log(`🔧 Sanitized JSON (${iteration} iterations):`, sanitizedJson);
                                parsedArgs = JSON.parse(sanitizedJson);
                                console.log(`✅ Successfully parsed sanitized JSON:`, parsedArgs);
                            } catch (sanitizeError) {
                                console.error(`❌ JSON Parse Error for ${toolCall.function.name}:`);
                                console.error(`   Raw JSON: ${toolCall.function.arguments}`);
                                console.error(`   Parse Error: ${parseError instanceof Error ? parseError.message : parseError}`);
                                console.error(`   Sanitize Error: ${sanitizeError instanceof Error ? sanitizeError.message : sanitizeError}`);
                                throw new Error(`Invalid JSON arguments: ${parseError instanceof Error ? parseError.message : parseError}`);
                            }
                        }

                        const result = await toolRegistry.executeTool(
                            toolCall.function.name,
                            parsedArgs,
                            { userId, roomId, timestamp: Date.now() }
                        );
                        toolResults.push({
                            tool_call_id: toolCall.id,
                            name: toolCall.function.name,
                            result
                        });
                    } catch (error) {
                        console.error(`❌ Tool execution error for ${toolCall.function.name}:`, error);
                        toolResults.push({
                            tool_call_id: toolCall.id,
                            name: toolCall.function.name,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }
            }

            // Continue conversation if tools were executed
            if (toolResults.length > 0) {
                console.log('🔄 Continuing conversation with tool results...');

                // Build follow-up conversation with tool results
                const followUpMessages = [
                    ...conversationMessages,
                    {
                        role: 'assistant' as const,
                        content: response.choices[0]?.message?.content || '',
                        tool_calls: response.choices[0]?.message?.tool_calls
                    },
                    ...toolResults.map(result => ({
                        role: 'tool' as const,
                        content: JSON.stringify(result.result),
                        tool_call_id: result.tool_call_id
                    }))
                ];

                // Make follow-up API call to complete the task
                const followUpResult = await openaiService.chatCompletion(
                    followUpMessages,
                    toolSchemas.length > 0 ? toolSchemas : undefined,
                    userId
                );

                if (followUpResult.success && followUpResult.response) {
                    finalResponse = followUpResult.response;

                    // Execute any additional tool calls from the follow-up
                    if (finalResponse.choices[0]?.message?.tool_calls) {
                        for (const toolCall of finalResponse.choices[0].message.tool_calls) {
                            if (toolCall.type === 'function') {
                                try {
                                    console.log(`🔧 Follow-up: Parsing arguments for ${toolCall.function.name}:`);
                                    console.log(`📝 Follow-up Raw arguments:`, toolCall.function.arguments);

                                    let parsedArgs;
                                    try {
                                        parsedArgs = JSON.parse(toolCall.function.arguments);
                                        console.log(`✅ Follow-up: Parsed arguments successfully:`, parsedArgs);
                                    } catch (parseError) {
                                        console.error(`❌ Follow-up JSON Parse Error for ${toolCall.function.name}:`);
                                        console.error(`   Raw JSON: ${toolCall.function.arguments}`);
                                        console.error(`   Error: ${parseError instanceof Error ? parseError.message : parseError}`);
                                        throw new Error(`Invalid JSON arguments: ${parseError instanceof Error ? parseError.message : parseError}`);
                                    }

                                    const result = await toolRegistry.executeTool(
                                        toolCall.function.name,
                                        parsedArgs,
                                        { userId, roomId, timestamp: Date.now() }
                                    );
                                    toolResults.push({
                                        tool_call_id: toolCall.id,
                                        name: toolCall.function.name,
                                        result
                                    });
                                } catch (error) {
                                    console.error(`❌ Follow-up tool execution error for ${toolCall.function.name}:`, error);
                                    toolResults.push({
                                        tool_call_id: toolCall.id,
                                        name: toolCall.function.name,
                                        error: error instanceof Error ? error.message : 'Unknown error'
                                    });
                                }
                            }
                        }
                    }

                    console.log('✅ Follow-up conversation completed');
                }
            }
        }

        // Log the final AI response for debugging
        console.log('🤖 Final AI Response Details:');
        console.log('   Message content:', finalResponse.choices[0]?.message?.content);
        console.log('   Tool calls made:', toolResults.length);
        console.log('   Total tools executed:', toolResults.map(r => r.name).join(', '));

        res.json({
            message: finalResponse.choices[0]?.message?.content || '',
            toolCalls: finalResponse.choices[0]?.message?.tool_calls || [],
            toolResults,
            usage: {
                promptTokens: finalResponse.usage?.prompt_tokens,
                completionTokens: finalResponse.usage?.completion_tokens,
                totalTokens: finalResponse.usage?.total_tokens
            },
            cost: apiResult.cost,
            latency: apiResult.latency
        });

    } catch (error) {
        console.error('AI Chat Handler Error:', error);
        res.status(500).json({
            error: 'Failed to process AI chat request',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Execute specific AI tool calls
 */
export async function executeToolHandler(req: Request, res: Response): Promise<void> {
    try {
        // Validate request body
        const validationResult = ExecuteToolRequestSchema.safeParse(req.body);
        if (!validationResult.success) {
            res.status(400).json({
                error: 'Invalid request',
                details: validationResult.error.issues
            });
            return;
        }

        const { toolName, parameters, roomId, userId } = validationResult.data;

        // Execute the tool
        const result = await toolRegistry.executeTool(
            toolName,
            parameters,
            { userId, roomId, timestamp: Date.now() }
        );

        res.json({
            success: result.success,
            toolName,
            result: result.result,
            error: result.error,
            executionTime: result.executionTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Tool Execution Handler Error:', error);
        res.status(500).json({
            error: 'Failed to execute tool',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get current canvas context for AI understanding
 */
export async function getCanvasContextHandler(req: Request, res: Response): Promise<void> {
    try {
        const { roomId, includeMetadata } = req.query;

        if (!roomId || typeof roomId !== 'string') {
            res.status(400).json({
                error: 'Room ID is required as a query parameter'
            });
            return;
        }

        // Get canvas state
        const canvasState = await persistenceService.getCanvasState(roomId) || { roomId, objects: [], lastUpdated: Date.now(), version: 1 };

        // Build response object
        const response: any = {
            roomId,
            timestamp: new Date().toISOString(),
            canvasState
        };

        // Include analysis and metadata if requested
        if (includeMetadata === 'true') {
            const analysis = analyzeCanvasContent(canvasState.objects);
            response.analysis = analysis;
            response.availableTools = toolRegistry.getAllTools().map(t => t.function.name);
        }

        res.json(response);

    } catch (error) {
        console.error('Canvas Context Handler Error:', error);
        res.status(500).json({
            error: 'Failed to get canvas context',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}


/**
 * Analyze canvas content for AI context
 */
function analyzeCanvasContent(objects: any[]): any {
    const analysis = {
        totalObjects: objects.length,
        objectTypes: {} as Record<string, number>,
        boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        colors: new Set<string>(),
        isEmpty: objects.length === 0
    };

    if (objects.length === 0) {
        return analysis;
    }

    // Count object types and analyze properties
    objects.forEach(obj => {
        // Count by type
        analysis.objectTypes[obj.type] = (analysis.objectTypes[obj.type] || 0) + 1;

        // Track colors
        if (obj.fill) analysis.colors.add(obj.fill);
        if (obj.stroke) analysis.colors.add(obj.stroke);

        // Update bounding box
        const objRight = obj.x + (obj.width || 0);
        const objBottom = obj.y + (obj.height || 0);

        analysis.boundingBox.minX = Math.min(analysis.boundingBox.minX, obj.x);
        analysis.boundingBox.minY = Math.min(analysis.boundingBox.minY, obj.y);
        analysis.boundingBox.maxX = Math.max(analysis.boundingBox.maxX, objRight);
        analysis.boundingBox.maxY = Math.max(analysis.boundingBox.maxY, objBottom);
    });

    return {
        ...analysis,
        colors: Array.from(analysis.colors),
        canvasSize: {
            width: analysis.boundingBox.maxX - analysis.boundingBox.minX,
            height: analysis.boundingBox.maxY - analysis.boundingBox.minY
        }
    };
}
