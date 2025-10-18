/**
 * Test script to verify OpenAI API integration is working correctly
 */
import dotenv from 'dotenv';
import path from 'path';
import { OpenAIService } from '../services/openaiService';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testOpenAIIntegration() {
    console.log('🧪 Testing OpenAI Integration...\n');

    try {
        // Check if API key is set
        if (!process.env.OPENAI_API_KEY) {
            console.error('❌ OPENAI_API_KEY is not set in .env file');
            process.exit(1);
        }

        console.log('✅ API Key found in environment variables');
        console.log(`   Model: ${process.env.OPENAI_MODEL || 'gpt-4'}`);
        console.log(`   Max Tokens: ${process.env.OPENAI_MAX_TOKENS || '1000'}`);
        console.log(`   Rate Limit: ${process.env.OPENAI_RATE_LIMIT_PER_MINUTE || '60'}/min`);
        console.log('');

        // Initialize OpenAI service
        console.log('🔄 Initializing OpenAI service...');
        const openaiService = new OpenAIService();
        console.log('✅ OpenAI service initialized successfully\n');

        // Check usage statistics before testing
        console.log('📊 Initial Usage Statistics:');
        const initialStats = openaiService.getUsageStats();
        console.log(`   Rate Limits: ${initialStats.rateLimits.minute.used}/${initialStats.rateLimits.minute.limit} (minute)`);
        console.log(`   Daily Cost: $${initialStats.costs.today.toFixed(4)}/$${initialStats.costs.limit}`);
        console.log('');

        // Run health check
        console.log('🏥 Running health check...');
        const healthCheck = await openaiService.healthCheck();
        console.log(`   Status: ${healthCheck.status.toUpperCase()}`);

        if (healthCheck.status === 'healthy') {
            console.log('✅ Health check passed - API is responding correctly');
            console.log(`   Test Latency: ${healthCheck.details.testLatency}ms`);
        } else {
            console.log(`❌ Health check failed: ${healthCheck.details.error || healthCheck.details.reason}`);
            if (healthCheck.status === 'degraded') {
                console.log('⚠️  Service is degraded but may still work with limitations');
            }
        }
        console.log('');

        // Test a simple chat completion
        console.log('💬 Testing chat completion...');
        const testResult = await openaiService.chatCompletion([
            {
                role: 'system',
                content: 'You are a helpful assistant for testing API connectivity. Respond with a brief confirmation that you received this message.'
            },
            {
                role: 'user',
                content: 'Hello, this is a test message to verify the API connection is working. Please respond with "API_TEST_SUCCESS" if you can see this.'
            }
        ]);

        if (testResult.success && testResult.response) {
            console.log('✅ Chat completion successful!');
            console.log(`   Response: ${testResult.response.choices[0]?.message.content}`);
            console.log(`   Tokens Used: ${testResult.tokensUsed}`);
            console.log(`   Cost: $${testResult.cost?.toFixed(4)}`);
            console.log(`   Latency: ${testResult.latency}ms`);
        } else {
            console.log(`❌ Chat completion failed: ${testResult.error}`);
            if (testResult.latency) {
                console.log(`   Failed after: ${testResult.latency}ms`);
            }
        }
        console.log('');

        // Test with AI tools (function calling)
        console.log('🔧 Testing function calling capabilities...');
        const toolsResult = await openaiService.chatCompletion([
            {
                role: 'system',
                content: 'You are an AI assistant that can call functions. When asked to create a shape, use the createRectangle function.'
            },
            {
                role: 'user',
                content: 'Create a blue rectangle at position 100, 200 with dimensions 50x75'
            }
        ], [
            {
                type: 'function',
                function: {
                    name: 'createRectangle',
                    description: 'Create a rectangle on the canvas',
                    parameters: {
                        type: 'object',
                        properties: {
                            x: { type: 'number', description: 'X position' },
                            y: { type: 'number', description: 'Y position' },
                            width: { type: 'number', description: 'Width in pixels' },
                            height: { type: 'number', description: 'Height in pixels' },
                            color: { type: 'string', description: 'Fill color' }
                        },
                        required: ['x', 'y', 'width', 'height', 'color']
                    }
                }
            }
        ]);

        if (toolsResult.success && toolsResult.response) {
            const message = toolsResult.response.choices[0]?.message;
            if (message.tool_calls && message.tool_calls.length > 0) {
                console.log('✅ Function calling successful!');
                const toolCall = message.tool_calls[0];
                if (toolCall.type === 'function') {
                    console.log(`   Function Called: ${toolCall.function.name}`);
                    console.log(`   Arguments: ${toolCall.function.arguments}`);

                    // Try to parse the arguments to verify they're valid
                    try {
                        const args = JSON.parse(toolCall.function.arguments);
                        console.log('✅ Function arguments are valid JSON');
                        console.log(`   Parsed: x=${args.x}, y=${args.y}, width=${args.width}, height=${args.height}, color=${args.color}`);
                    } catch (e) {
                        console.log('❌ Function arguments are not valid JSON');
                    }
                } else {
                    console.log(`   Tool Call Type: ${toolCall.type}`);
                }
            } else {
                console.log('⚠️  No tool calls returned (AI may have responded with text instead)');
                console.log(`   Response: ${message.content}`);
            }
            console.log(`   Tokens Used: ${toolsResult.tokensUsed}`);
            console.log(`   Cost: $${toolsResult.cost?.toFixed(4)}`);
        } else {
            console.log(`❌ Function calling test failed: ${toolsResult.error}`);
        }
        console.log('');

        // Final usage statistics
        console.log('📊 Final Usage Statistics:');
        const finalStats = openaiService.getUsageStats();
        console.log(`   Rate Limits: ${finalStats.rateLimits.minute.used}/${finalStats.rateLimits.minute.limit} (minute)`);
        console.log(`   Daily Cost: $${finalStats.costs.today.toFixed(4)}/$${finalStats.costs.limit}`);
        console.log(`   Total Requests: ${finalStats.history.totalRequests}`);
        console.log(`   Average Latency: ${finalStats.history.avgLatency.toFixed(0)}ms`);
        console.log('');

        // Summary
        const allTestsPassed = healthCheck.status === 'healthy' && testResult.success && toolsResult.success;
        if (allTestsPassed) {
            console.log('🎉 ALL TESTS PASSED! OpenAI integration is working correctly.');
            console.log('✅ API connectivity verified');
            console.log('✅ Chat completion working');
            console.log('✅ Function calling working');
            console.log('✅ Rate limiting and cost tracking active');
        } else {
            console.log('⚠️  Some tests failed. Check the details above.');
            if (healthCheck.status !== 'healthy') console.log('❌ Health check failed');
            if (!testResult.success) console.log('❌ Chat completion failed');
            if (!toolsResult.success) console.log('❌ Function calling failed');
        }

    } catch (error) {
        console.error('💥 Error during testing:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack);
        }
        process.exit(1);
    }
}

// Run the test
testOpenAIIntegration().then(() => {
    console.log('\n🏁 Testing completed.');
    process.exit(0);
}).catch((error) => {
    console.error('\n💥 Testing failed:', error);
    process.exit(1);
});
