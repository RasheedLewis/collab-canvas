// Set up environment variables before importing
process.env.OPENAI_API_KEY = 'test-api-key';

import { OpenAIService } from '../openaiService';

// Mock OpenAI to avoid real API calls in tests
jest.mock('openai', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: jest.fn()
                }
            }
        }))
    };
});

describe('OpenAIService', () => {
    let openaiService: OpenAIService;

    beforeEach(() => {
        // Mock environment variables
        process.env.OPENAI_API_KEY = 'test-api-key';
        process.env.OPENAI_MODEL = 'gpt-4';
        process.env.OPENAI_MAX_TOKENS = '500';
        process.env.OPENAI_TEMPERATURE = '0.1';
        process.env.OPENAI_RATE_LIMIT_PER_MINUTE = '10';
        process.env.OPENAI_RATE_LIMIT_PER_HOUR = '100';
        process.env.OPENAI_COST_LIMIT_PER_DAY = '5.00';

        openaiService = new OpenAIService();
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Clean up environment variables
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_MODEL;
        delete process.env.OPENAI_MAX_TOKENS;
        delete process.env.OPENAI_TEMPERATURE;
        delete process.env.OPENAI_RATE_LIMIT_PER_MINUTE;
        delete process.env.OPENAI_RATE_LIMIT_PER_HOUR;
        delete process.env.OPENAI_COST_LIMIT_PER_DAY;
    });

    describe('Configuration', () => {
        test('should initialize with environment variables', () => {
            const stats = openaiService.getUsageStats();
            expect(stats.rateLimits.minute.limit).toBe(10);
            expect(stats.rateLimits.hour.limit).toBe(100);
            expect(stats.costs.limit).toBe(5.00);
        });

        test('should throw error with invalid API key', () => {
            process.env.OPENAI_API_KEY = '';
            expect(() => new OpenAIService()).toThrow();
        });
    });

    describe('Rate Limiting', () => {
        test('should track usage statistics', () => {
            const stats = openaiService.getUsageStats();

            expect(stats).toHaveProperty('rateLimits');
            expect(stats).toHaveProperty('costs');
            expect(stats).toHaveProperty('history');

            expect(stats.rateLimits.minute.used).toBe(0);
            expect(stats.rateLimits.hour.used).toBe(0);
            expect(stats.costs.today).toBe(0);
        });

        test('should enforce rate limits', async () => {
            // Create service with very low limits for testing
            const limitedService = new OpenAIService({
                apiKey: 'test-key',
                rateLimitPerMinute: 1,
                rateLimitPerHour: 1
            });

            // Mock successful API response
            const mockResponse = {
                choices: [{ message: { content: 'Test response' } }],
                usage: { total_tokens: 10 }
            };

            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            (limitedService as any).client.chat.completions.create = mockCreate;

            // First request should succeed
            const result1 = await limitedService.chatCompletion([
                { role: 'user', content: 'Test message' }
            ]);
            expect(result1.success).toBe(true);

            // Second request should be rate limited
            const result2 = await limitedService.chatCompletion([
                { role: 'user', content: 'Another test message' }
            ]);
            expect(result2.success).toBe(false);
            expect(result2.error).toContain('Rate limit exceeded');
        });
    });

    describe('Error Handling', () => {
        test('should handle API errors gracefully', async () => {
            const mockError = new Error('API Error');
            const mockCreate = jest.fn().mockRejectedValue(mockError);
            (openaiService as any).client.chat.completions.create = mockCreate;

            const result = await openaiService.chatCompletion([
                { role: 'user', content: 'Test message' }
            ]);

            expect(result.success).toBe(false);
            expect(result.error).toBe('API Error');
            expect(result.latency).toBeGreaterThan(0);
        });

        test('should handle timeout errors', async () => {
            const mockCreate = jest.fn().mockImplementation(() =>
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), 100)
                )
            );
            (openaiService as any).client.chat.completions.create = mockCreate;

            const result = await openaiService.chatCompletion([
                { role: 'user', content: 'Test message' }
            ]);

            expect(result.success).toBe(false);
            expect(result.error).toContain('timeout');
        });
    });

    describe('Cost Tracking', () => {
        test('should calculate costs correctly', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Test response' } }],
                usage: { total_tokens: 100 }
            };

            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            (openaiService as any).client.chat.completions.create = mockCreate;

            const result = await openaiService.chatCompletion([
                { role: 'user', content: 'Test message' }
            ]);

            expect(result.success).toBe(true);
            expect(result.cost).toBeGreaterThan(0);
            expect(result.tokensUsed).toBe(100);

            const stats = openaiService.getUsageStats();
            expect(stats.costs.today).toBeGreaterThan(0);
            expect(stats.costs.requests).toBe(1);
        });

        test('should enforce daily cost limits', async () => {
            const limitedService = new OpenAIService({
                apiKey: 'test-key',
                costLimitPerDay: 0.001 // Very low limit
            });

            const mockResponse = {
                choices: [{ message: { content: 'Expensive response' } }],
                usage: { total_tokens: 10000 } // High token count
            };

            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            (limitedService as any).client.chat.completions.create = mockCreate;

            // First request should succeed but use up the daily budget
            const result1 = await limitedService.chatCompletion([
                { role: 'user', content: 'Test message' }
            ]);
            expect(result1.success).toBe(true);

            // Second request should be blocked by cost limit
            const result2 = await limitedService.chatCompletion([
                { role: 'user', content: 'Another test message' }
            ]);
            expect(result2.success).toBe(false);
            expect(result2.error).toContain('cost limit exceeded');
        });
    });

    describe('Health Check', () => {
        test('should report healthy status when functioning', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'OK' } }],
                usage: { total_tokens: 3 }
            };

            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            (openaiService as any).client.chat.completions.create = mockCreate;

            const health = await openaiService.healthCheck();

            expect(health.status).toBe('healthy');
            expect(health.details.testLatency).toBeGreaterThan(0);
            expect(health.details.usage).toBeDefined();
        });

        test('should report unhealthy status on API failure', async () => {
            const mockCreate = jest.fn().mockRejectedValue(new Error('Service unavailable'));
            (openaiService as any).client.chat.completions.create = mockCreate;

            const health = await openaiService.healthCheck();

            expect(health.status).toBe('unhealthy');
            expect(health.details.error).toContain('Service unavailable');
        });

        test('should report degraded status when rate limited', async () => {
            const limitedService = new OpenAIService({
                apiKey: 'test-key',
                rateLimitPerMinute: 1 // Very low limit
            });

            // Use up the rate limit
            const mockResponse = {
                choices: [{ message: { content: 'Test response' } }],
                usage: { total_tokens: 10 }
            };
            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            (limitedService as any).client.chat.completions.create = mockCreate;

            await limitedService.chatCompletion([
                { role: 'user', content: 'Test message' }
            ]);

            const health = await limitedService.healthCheck();

            expect(health.status).toBe('degraded');
            expect(health.details.reason).toContain('Rate limit exceeded');
        });
    });

    describe('Request Logging', () => {
        test('should log requests in development mode', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const mockResponse = {
                choices: [{ message: { content: 'Test response' } }],
                usage: { total_tokens: 10 }
            };

            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            (openaiService as any).client.chat.completions.create = mockCreate;

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await openaiService.chatCompletion([
                { role: 'user', content: 'Test message' }
            ], undefined, 'test-user-123');

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('📝 AI Request logged:'),
                expect.objectContaining({
                    userId: 'test-user-123'
                })
            );

            consoleSpy.mockRestore();
            process.env.NODE_ENV = originalEnv;
        });

        test('should maintain request history', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Test response' } }],
                usage: { total_tokens: 10 }
            };

            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            (openaiService as any).client.chat.completions.create = mockCreate;

            await openaiService.chatCompletion([
                { role: 'user', content: 'First message' }
            ]);

            await openaiService.chatCompletion([
                { role: 'user', content: 'Second message' }
            ]);

            const stats = openaiService.getUsageStats();
            expect(stats.history.totalRequests).toBe(2);
            expect(stats.history.avgLatency).toBeGreaterThan(0);
        });
    });
});
