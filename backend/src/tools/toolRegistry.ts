import { ToolValidator, Tool, ToolsFile, ValidationResult } from './toolValidator';

// Tool execution result
export interface ToolExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    executionTime?: number;
    toolName: string;
    parameters?: Record<string, any>;
}

// Tool execution context
export interface ToolExecutionContext {
    userId: string;
    roomId?: string;
    sessionId?: string;
    timestamp: number;
    metadata?: Record<string, any>;
}

// Tool handler function type
export type ToolHandler = (
    parameters: Record<string, any>,
    context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

// Registry statistics
export interface RegistryStats {
    totalTools: number;
    loadedTools: number;
    registeredHandlers: number;
    toolsByCategory: Record<string, number>;
    lastLoaded?: Date;
    version?: string;
}

/**
 * Dynamic tool registry for AI Canvas Agent
 */
export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();
    private handlers: Map<string, ToolHandler> = new Map();
    private validator: ToolValidator;
    private toolsFile?: ToolsFile;
    private loadTime?: Date;

    constructor(validator?: ToolValidator) {
        this.validator = validator || new ToolValidator();
        console.log('🔧 Tool Registry initialized');
    }

    /**
     * Load tools from ai-tools.json file
     */
    async loadToolsFromFile(filePath: string): Promise<ValidationResult> {
        console.log(`📥 Loading tools from: ${filePath}`);

        try {
            const validationResult = await this.validator.validateFile(filePath);

            if (!validationResult.isValid || !validationResult.tools) {
                console.error('❌ Tool validation failed, not loading tools');
                return validationResult;
            }

            // Clear existing tools
            this.tools.clear();

            // Load validated tools
            for (const tool of validationResult.tools) {
                this.tools.set(tool.function.name, tool);
            }

            this.toolsFile = {
                ai_canvas_tools: validationResult.tools,
                version: validationResult.metadata?.version || '1.0.0',
                metadata: validationResult.metadata,
            };

            this.loadTime = new Date();

            console.log(`✅ Successfully loaded ${this.tools.size} tools`);
            console.log(`📊 Registry Statistics:`);
            console.log(`   Version: ${this.toolsFile.version}`);
            console.log(`   Tools: ${this.tools.size}`);
            console.log(`   Handlers: ${this.handlers.size}`);

            return validationResult;

        } catch (error) {
            const errorMessage = `Failed to load tools: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('❌', errorMessage);
            return {
                isValid: false,
                errors: [errorMessage],
                warnings: [],
            };
        }
    }

    /**
     * Register a tool handler for execution
     */
    registerHandler(toolName: string, handler: ToolHandler): void {
        if (!this.tools.has(toolName)) {
            console.warn(`⚠️  Registering handler for unknown tool: ${toolName}`);
        }

        this.handlers.set(toolName, handler);
        console.log(`🔌 Registered handler for tool: ${toolName}`);
    }

    /**
     * Unregister a tool handler
     */
    unregisterHandler(toolName: string): boolean {
        const removed = this.handlers.delete(toolName);
        if (removed) {
            console.log(`🔌 Unregistered handler for tool: ${toolName}`);
        }
        return removed;
    }

    /**
     * Execute a tool with given parameters
     */
    async executeTool(
        toolName: string,
        parameters: Record<string, any>,
        context: ToolExecutionContext
    ): Promise<ToolExecutionResult> {
        const startTime = Date.now();

        console.log(`🚀 Executing tool: ${toolName}`, {
            parameters: Object.keys(parameters),
            userId: context.userId,
            roomId: context.roomId,
        });

        // Check if tool exists
        const tool = this.tools.get(toolName);
        if (!tool) {
            const result: ToolExecutionResult = {
                success: false,
                error: `Tool '${toolName}' not found in registry`,
                toolName,
                parameters,
                executionTime: Date.now() - startTime,
            };
            console.error(`❌ Tool execution failed:`, result.error);
            return result;
        }

        // Check if handler is registered
        const handler = this.handlers.get(toolName);
        if (!handler) {
            const result: ToolExecutionResult = {
                success: false,
                error: `No handler registered for tool '${toolName}'`,
                toolName,
                parameters,
                executionTime: Date.now() - startTime,
            };
            console.error(`❌ Tool execution failed:`, result.error);
            return result;
        }

        // Validate parameters against tool schema
        const paramValidation = this.validateParameters(tool, parameters);
        if (!paramValidation.isValid) {
            const result: ToolExecutionResult = {
                success: false,
                error: `Parameter validation failed: ${paramValidation.errors.join(', ')}`,
                toolName,
                parameters,
                executionTime: Date.now() - startTime,
            };
            console.error(`❌ Tool execution failed:`, result.error);
            return result;
        }

        // Execute the tool
        try {
            const result = await handler(parameters, context);
            result.executionTime = Date.now() - startTime;

            if (result.success) {
                console.log(`✅ Tool executed successfully: ${toolName} (${result.executionTime}ms)`);
            } else {
                console.error(`❌ Tool execution failed: ${toolName} - ${result.error}`);
            }

            return result;

        } catch (error) {
            const result: ToolExecutionResult = {
                success: false,
                error: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                toolName,
                parameters,
                executionTime: Date.now() - startTime,
            };
            console.error(`❌ Tool execution exception:`, error);
            return result;
        }
    }

    /**
     * Validate parameters against tool schema
     */
    private validateParameters(tool: Tool, parameters: Record<string, any>): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];
        const { properties, required = [] } = tool.function.parameters;

        // Check required parameters
        for (const requiredParam of required) {
            if (!(requiredParam in parameters)) {
                errors.push(`Missing required parameter: ${requiredParam}`);
            }
        }

        // Validate parameter types and constraints
        for (const [paramName, paramValue] of Object.entries(parameters)) {
            const paramSchema = properties[paramName];
            if (!paramSchema) {
                errors.push(`Unknown parameter: ${paramName}`);
                continue;
            }

            // Type validation
            const actualType = typeof paramValue;
            const expectedType = paramSchema.type;

            if (expectedType === 'number' && actualType !== 'number') {
                errors.push(`Parameter '${paramName}' must be a number, got ${actualType}`);
            } else if (expectedType === 'string' && actualType !== 'string') {
                errors.push(`Parameter '${paramName}' must be a string, got ${actualType}`);
            } else if (expectedType === 'boolean' && actualType !== 'boolean') {
                errors.push(`Parameter '${paramName}' must be a boolean, got ${actualType}`);
            } else if (expectedType === 'array' && !Array.isArray(paramValue)) {
                errors.push(`Parameter '${paramName}' must be an array, got ${actualType}`);
            } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(paramValue))) {
                errors.push(`Parameter '${paramName}' must be an object, got ${actualType}`);
            }

            // Range validation for numbers
            if (expectedType === 'number' && actualType === 'number') {
                if (paramSchema.minimum !== undefined && paramValue < paramSchema.minimum) {
                    errors.push(`Parameter '${paramName}' must be >= ${paramSchema.minimum}, got ${paramValue}`);
                }
                if (paramSchema.maximum !== undefined && paramValue > paramSchema.maximum) {
                    errors.push(`Parameter '${paramName}' must be <= ${paramSchema.maximum}, got ${paramValue}`);
                }
            }

            // Enum validation
            if (paramSchema.enum && !paramSchema.enum.includes(paramValue)) {
                errors.push(`Parameter '${paramName}' must be one of: ${paramSchema.enum.join(', ')}, got ${paramValue}`);
            }

            // Array length validation
            if (expectedType === 'array' && Array.isArray(paramValue)) {
                if (paramSchema.minItems !== undefined && paramValue.length < paramSchema.minItems) {
                    errors.push(`Parameter '${paramName}' must have at least ${paramSchema.minItems} items, got ${paramValue.length}`);
                }
                if (paramSchema.maxItems !== undefined && paramValue.length > paramSchema.maxItems) {
                    errors.push(`Parameter '${paramName}' must have at most ${paramSchema.maxItems} items, got ${paramValue.length}`);
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Get tool by name
     */
    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * Get all tools
     */
    getAllTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get tools by category
     */
    getToolsByCategory(category: string): Tool[] {
        const categoryKeywords = {
            creation: ['create', 'add', 'make', 'build'],
            manipulation: ['move', 'resize', 'rotate', 'update', 'modify'],
            query: ['get', 'find', 'search', 'list'],
            layout: ['arrange', 'align', 'distribute', 'grid'],
            management: ['clear', 'delete', 'remove', 'copy', 'group'],
        };

        const keywords = categoryKeywords[category as keyof typeof categoryKeywords] || [];

        return this.getAllTools().filter(tool => {
            const name = tool.function.name.toLowerCase();
            return keywords.some(keyword => name.includes(keyword));
        });
    }

    /**
     * Search tools by name or description
     */
    searchTools(query: string): Tool[] {
        const searchTerm = query.toLowerCase();

        return this.getAllTools().filter(tool => {
            const name = tool.function.name.toLowerCase();
            const description = tool.function.description.toLowerCase();

            return name.includes(searchTerm) || description.includes(searchTerm);
        });
    }

    /**
     * Get registry statistics
     */
    getStats(): RegistryStats {
        const toolsByCategory: Record<string, number> = {};
        const categories = ['creation', 'manipulation', 'query', 'layout', 'management'];

        for (const category of categories) {
            toolsByCategory[category] = this.getToolsByCategory(category).length;
        }

        return {
            totalTools: this.tools.size,
            loadedTools: this.tools.size,
            registeredHandlers: this.handlers.size,
            toolsByCategory,
            lastLoaded: this.loadTime,
            version: this.toolsFile?.version,
        };
    }

    /**
     * Get tools formatted for OpenAI API
     */
    getToolsForOpenAI(): Array<{
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: any;
        };
    }> {
        return this.getAllTools().map(tool => ({
            type: 'function' as const,
            function: {
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters,
            },
        }));
    }

    /**
     * Check if all required handlers are registered
     */
    checkHandlerCoverage(): {
        coverage: number;
        missingHandlers: string[];
        totalTools: number;
        registeredHandlers: number;
    } {
        const allToolNames = Array.from(this.tools.keys());
        const registeredHandlerNames = Array.from(this.handlers.keys());

        const missingHandlers = allToolNames.filter(name => !registeredHandlerNames.includes(name));

        return {
            coverage: this.tools.size > 0 ? (this.handlers.size / this.tools.size) * 100 : 0,
            missingHandlers,
            totalTools: this.tools.size,
            registeredHandlers: this.handlers.size,
        };
    }

    /**
     * Hot reload tools from file (useful for development)
     */
    async reloadTools(filePath: string): Promise<ValidationResult> {
        console.log('🔄 Hot reloading tools...');

        const result = await this.loadToolsFromFile(filePath);

        if (result.isValid) {
            // Check if any handlers need to be updated
            const coverage = this.checkHandlerCoverage();
            if (coverage.missingHandlers.length > 0) {
                console.warn(`⚠️  Missing handlers after reload: ${coverage.missingHandlers.join(', ')}`);
            }
        }

        return result;
    }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
export default toolRegistry;
