import OpenAI from 'openai';
import { z } from 'zod';

// Configuration validation schema
const OpenAIConfigSchema = z.object({
    apiKey: z.string().min(1, 'OpenAI API key is required'),
    model: z.string().default('gpt-4'),
    maxTokens: z.number().positive().default(1000),
    temperature: z.number().min(0).max(1).default(0.1),
    requestTimeout: z.number().positive().default(30000),
    rateLimitPerMinute: z.number().positive().default(60),
    rateLimitPerHour: z.number().positive().default(1000),
    costLimitPerDay: z.number().positive().default(10.00)
});

type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;

// Rate limiting and cost tracking interfaces
interface RateLimit {
    requests: number;
    resetTime: number;
}

interface CostTracker {
    totalCost: number;
    requestCount: number;
    resetTime: number; // Daily reset
}

interface AIRequest {
    timestamp: number;
    prompt: string;
    response: string;
    tokensUsed: number;
    cost: number;
    latency: number;
    userId?: string;
}

// OpenAI service class with comprehensive error handling and monitoring
export class OpenAIService {
    private client: OpenAI;
    private config: OpenAIConfig;
    private rateLimitMinute: RateLimit;
    private rateLimitHour: RateLimit;
    private costTracker: CostTracker;
    private requestHistory: AIRequest[] = [];
    private readonly maxHistorySize = 1000;

    // Cost per token estimates (updated as of 2024)
    private readonly costPerToken = {
        'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
        'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
        'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 }
    };

    constructor(config: Partial<OpenAIConfig> = {}) {
        // Load configuration from environment variables
        const envConfig = {
            apiKey: process.env.OPENAI_API_KEY || '',
            model: process.env.OPENAI_MODEL || 'gpt-4',
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
            requestTimeout: parseInt(process.env.OPENAI_REQUEST_TIMEOUT || '30000'),
            rateLimitPerMinute: parseInt(process.env.OPENAI_RATE_LIMIT_PER_MINUTE || '60'),
            rateLimitPerHour: parseInt(process.env.OPENAI_RATE_LIMIT_PER_HOUR || '1000'),
            costLimitPerDay: parseFloat(process.env.OPENAI_COST_LIMIT_PER_DAY || '10.00')
        };

        // Merge with provided config and validate
        this.config = OpenAIConfigSchema.parse({ ...envConfig, ...config });

        // Initialize OpenAI client
        this.client = new OpenAI({
            apiKey: this.config.apiKey,
            timeout: this.config.requestTimeout
        });

        // Initialize rate limiting and cost tracking
        this.rateLimitMinute = { requests: 0, resetTime: Date.now() + 60000 };
        this.rateLimitHour = { requests: 0, resetTime: Date.now() + 3600000 };
        this.costTracker = {
            totalCost: 0,
            requestCount: 0,
            resetTime: this.getNextDayReset()
        };

        console.log('🤖 OpenAI Service initialized:', {
            model: this.config.model,
            maxTokens: this.config.maxTokens,
            rateLimits: {
                perMinute: this.config.rateLimitPerMinute,
                perHour: this.config.rateLimitPerHour
            },
            costLimit: this.config.costLimitPerDay
        });
    }

    /**
     * Main method to send chat completion requests to OpenAI
     */
    async chatCompletion(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
        userId?: string
    ): Promise<{
        success: boolean;
        response?: OpenAI.Chat.Completions.ChatCompletion;
        error?: string;
        cost?: number;
        tokensUsed?: number;
        latency?: number;
    }> {
        const startTime = Date.now();

        try {
            // Check rate limits and cost limits
            const limitCheck = this.checkLimits();
            if (!limitCheck.allowed) {
                return {
                    success: false,
                    error: limitCheck.reason
                };
            }

            console.log('🤖 Sending OpenAI chat completion request:', {
                model: this.config.model,
                messageCount: messages.length,
                hasTools: !!tools,
                userId
            });

            // Make the API request
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages,
                tools,
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
                tool_choice: tools ? 'auto' : undefined
            });

            const latency = Date.now() - startTime;
            const tokensUsed = response.usage?.total_tokens || 0;
            const cost = this.calculateCost(this.config.model, tokensUsed);

            // Update tracking
            this.updateRateLimits();
            this.updateCostTracker(cost, tokensUsed);
            this.logRequest(messages, response, tokensUsed, cost, latency, userId);

            console.log('✅ OpenAI request completed:', {
                tokensUsed,
                cost: `$${cost.toFixed(4)}`,
                latency: `${latency}ms`,
                choices: response.choices.length
            });

            return {
                success: true,
                response,
                cost,
                tokensUsed,
                latency
            };

        } catch (error) {
            const latency = Date.now() - startTime;
            console.error('❌ OpenAI request failed:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                latency: `${latency}ms`,
                userId
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown OpenAI error',
                latency
            };
        }
    }

    /**
     * Check if request is allowed based on rate limits and cost limits
     */
    private checkLimits(): { allowed: boolean; reason?: string } {
        const now = Date.now();

        // Reset rate limits if needed
        if (now > this.rateLimitMinute.resetTime) {
            this.rateLimitMinute = { requests: 0, resetTime: now + 60000 };
        }
        if (now > this.rateLimitHour.resetTime) {
            this.rateLimitHour = { requests: 0, resetTime: now + 3600000 };
        }
        if (now > this.costTracker.resetTime) {
            this.costTracker = {
                totalCost: 0,
                requestCount: 0,
                resetTime: this.getNextDayReset()
            };
        }

        // Check rate limits
        if (this.rateLimitMinute.requests >= this.config.rateLimitPerMinute) {
            return {
                allowed: false,
                reason: `Rate limit exceeded: ${this.config.rateLimitPerMinute} requests per minute`
            };
        }

        if (this.rateLimitHour.requests >= this.config.rateLimitPerHour) {
            return {
                allowed: false,
                reason: `Rate limit exceeded: ${this.config.rateLimitPerHour} requests per hour`
            };
        }

        // Check daily cost limit
        if (this.costTracker.totalCost >= this.config.costLimitPerDay) {
            return {
                allowed: false,
                reason: `Daily cost limit exceeded: $${this.config.costLimitPerDay}`
            };
        }

        return { allowed: true };
    }

    /**
     * Update rate limit counters
     */
    private updateRateLimits(): void {
        this.rateLimitMinute.requests++;
        this.rateLimitHour.requests++;
    }

    /**
     * Update cost tracker
     */
    private updateCostTracker(cost: number, _tokens: number): void {
        this.costTracker.totalCost += cost;
        this.costTracker.requestCount++;
    }

    /**
     * Calculate estimated cost for a request
     */
    private calculateCost(model: string, tokens: number): number {
        const modelKey = model as keyof typeof this.costPerToken;
        const rates = this.costPerToken[modelKey] || this.costPerToken['gpt-4'];

        // Simplified calculation - in reality, input and output tokens have different costs
        // For now, use average cost
        const avgCostPerToken = (rates.input + rates.output) / 2;
        return tokens * avgCostPerToken;
    }

    /**
     * Log request for debugging and monitoring
     */
    private logRequest(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        response: OpenAI.Chat.Completions.ChatCompletion,
        tokensUsed: number,
        cost: number,
        latency: number,
        userId?: string
    ): void {
        const request: AIRequest = {
            timestamp: Date.now(),
            prompt: this.extractPrompt(messages),
            response: this.extractResponse(response),
            tokensUsed,
            cost,
            latency,
            userId
        };

        this.requestHistory.push(request);

        // Keep history size manageable
        if (this.requestHistory.length > this.maxHistorySize) {
            this.requestHistory = this.requestHistory.slice(-this.maxHistorySize);
        }

        // Log detailed request info in development
        if (process.env.NODE_ENV === 'development') {
            console.log('📝 AI Request logged:', {
                timestamp: new Date(request.timestamp).toISOString(),
                promptLength: request.prompt.length,
                responseLength: request.response.length,
                tokensUsed,
                cost: `$${cost.toFixed(4)}`,
                latency: `${latency}ms`,
                userId
            });
        }
    }

    /**
     * Extract prompt text from messages
     */
    private extractPrompt(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): string {
        return messages
            .map(msg => `${msg.role}: ${JSON.stringify(msg.content)}`)
            .join('\n');
    }

    /**
     * Extract response text from OpenAI response
     */
    private extractResponse(response: OpenAI.Chat.Completions.ChatCompletion): string {
        return response.choices
            .map(choice => choice.message.content || JSON.stringify(choice.message.tool_calls))
            .join('\n');
    }

    /**
     * Get next day reset timestamp
     */
    private getNextDayReset(): number {
        const tomorrow = new Date();
        tomorrow.setUTCHours(0, 0, 0, 0);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        return tomorrow.getTime();
    }

    /**
     * Get current usage statistics
     */
    getUsageStats() {
        const now = Date.now();
        return {
            rateLimits: {
                minute: {
                    used: this.rateLimitMinute.requests,
                    limit: this.config.rateLimitPerMinute,
                    resetIn: Math.max(0, this.rateLimitMinute.resetTime - now)
                },
                hour: {
                    used: this.rateLimitHour.requests,
                    limit: this.config.rateLimitPerHour,
                    resetIn: Math.max(0, this.rateLimitHour.resetTime - now)
                }
            },
            costs: {
                today: this.costTracker.totalCost,
                limit: this.config.costLimitPerDay,
                requests: this.costTracker.requestCount,
                resetIn: Math.max(0, this.costTracker.resetTime - now)
            },
            history: {
                totalRequests: this.requestHistory.length,
                avgLatency: this.requestHistory.length > 0
                    ? this.requestHistory.reduce((sum, req) => sum + req.latency, 0) / this.requestHistory.length
                    : 0
            }
        };
    }

    /**
     * Health check for the OpenAI service
     */
    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    }> {
        try {
            const usageStats = this.getUsageStats();
            const limitCheck = this.checkLimits();

            if (!limitCheck.allowed) {
                return {
                    status: 'degraded',
                    details: {
                        reason: limitCheck.reason,
                        usage: usageStats
                    }
                };
            }

            // Test with a minimal request
            const testResult = await this.chatCompletion([
                { role: 'user', content: 'Respond with "OK" if you can receive this message.' }
            ]);

            return {
                status: testResult.success ? 'healthy' : 'unhealthy',
                details: {
                    testLatency: testResult.latency,
                    usage: usageStats,
                    error: testResult.error
                }
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    usage: this.getUsageStats()
                }
            };
        }
    }
}

// Export singleton instance - only create if API key is available
export const openaiService = process.env.OPENAI_API_KEY
    ? new OpenAIService()
    : null;
export default openaiService;
