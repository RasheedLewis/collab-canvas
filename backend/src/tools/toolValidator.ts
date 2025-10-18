import { z } from 'zod';
import fs from 'fs/promises';

// Schema for OpenAI function tool parameters
const ParameterPropertySchema = z.object({
    type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
    items: z.any().optional(), // For array types
    properties: z.record(z.string(), z.any()).optional(), // For object types
    default: z.any().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minItems: z.number().optional(),
    maxItems: z.number().optional(),
});

const ParametersSchema = z.object({
    type: z.literal('object'),
    properties: z.record(z.string(), ParameterPropertySchema),
    required: z.array(z.string()).optional(),
    additionalProperties: z.boolean().optional(),
});

const FunctionSchema = z.object({
    name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, {
        message: "Function name must contain only alphanumeric characters, hyphens, and underscores"
    }),
    description: z.string().min(1).max(1024),
    parameters: ParametersSchema,
});

const ToolSchema = z.object({
    type: z.literal('function'),
    function: FunctionSchema,
});

const ToolsFileSchema = z.object({
    ai_canvas_tools: z.array(ToolSchema).min(1),
    version: z.string().optional().default('1.0.0'),
    metadata: z.object({
        created: z.string().optional(),
        updated: z.string().optional(),
        description: z.string().optional(),
        author: z.string().optional(),
        totalTools: z.number().optional(),
        version: z.string().optional(),
    }).optional(),
});

// Types
export type ToolParameter = z.infer<typeof ParameterPropertySchema>;
export type ToolParameters = z.infer<typeof ParametersSchema>;
export type ToolFunction = z.infer<typeof FunctionSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type ToolsFile = z.infer<typeof ToolsFileSchema>;

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    tools?: Tool[];
    metadata?: ToolsFile['metadata'];
}

export interface ToolValidationOptions {
    strictMode?: boolean;
    allowDuplicateNames?: boolean;
    maxDescriptionLength?: number;
    requiredCategories?: string[];
}

/**
 * Tool Validator class for validating AI tools schema
 */
export class ToolValidator {
    private defaultOptions: Required<ToolValidationOptions> = {
        strictMode: true,
        allowDuplicateNames: false,
        maxDescriptionLength: 1024,
        requiredCategories: [],
    };

    constructor(private options: ToolValidationOptions = {}) {
        this.options = { ...this.defaultOptions, ...options };
    }

    /**
     * Validate tools from a file path
     */
    async validateFile(filePath: string): Promise<ValidationResult> {
        try {
            console.log(`🔍 Validating tools file: ${filePath}`);

            const fileContent = await fs.readFile(filePath, 'utf-8');
            const jsonData = JSON.parse(fileContent);

            return this.validateTools(jsonData);
        } catch (error) {
            console.error(`❌ Failed to read or parse tools file: ${filePath}`, error);
            return {
                isValid: false,
                errors: [
                    `Failed to read or parse file: ${error instanceof Error ? error.message : 'Unknown error'}`
                ],
                warnings: [],
            };
        }
    }

    /**
     * Validate tools from JSON data
     */
    validateTools(data: any): ValidationResult {
        const result: ValidationResult = {
            isValid: false,
            errors: [],
            warnings: [],
        };

        try {
            // Basic schema validation
            const validatedData = ToolsFileSchema.parse(data);
            result.tools = validatedData.ai_canvas_tools;
            result.metadata = validatedData.metadata;

            console.log(`✅ Basic schema validation passed for ${result.tools.length} tools`);

            // Additional validation checks
            this.validateToolNames(result.tools, result);
            this.validateToolDescriptions(result.tools, result);
            this.validateToolParameters(result.tools, result);
            this.validateToolCategories(result.tools, result);

            // Check if validation passed
            result.isValid = result.errors.length === 0;

            if (result.isValid) {
                console.log(`✅ All validation checks passed for ${result.tools.length} tools`);
            } else {
                console.log(`❌ Validation failed with ${result.errors.length} errors`);
            }

            return result;

        } catch (error) {
            if (error instanceof z.ZodError) {
                result.errors = error.issues.map((err: any) =>
                    `${err.path.join('.')}: ${err.message}`
                );
            } else {
                result.errors = [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`];
            }

            console.error(`❌ Schema validation failed:`, result.errors);
            return result;
        }
    }

    /**
     * Validate tool names for uniqueness and format
     */
    private validateToolNames(tools: Tool[], result: ValidationResult): void {
        const names = new Set<string>();
        const duplicates = new Set<string>();

        for (const tool of tools) {
            const name = tool.function.name;

            // Check for duplicates
            if (names.has(name)) {
                duplicates.add(name);
            } else {
                names.add(name);
            }

            // Check naming conventions
            if (name.length < 2) {
                result.errors.push(`Tool name '${name}' is too short (minimum 2 characters)`);
            }

            if (name.length > 64) {
                result.errors.push(`Tool name '${name}' is too long (maximum 64 characters)`);
            }

            // Check for reserved names
            const reservedNames = ['help', 'list', 'version', 'status', 'config'];
            if (reservedNames.includes(name.toLowerCase())) {
                result.warnings.push(`Tool name '${name}' is a reserved name and may cause conflicts`);
            }

            // Suggest improvements
            if (name.includes('_') && name.includes('-')) {
                result.warnings.push(`Tool name '${name}' mixes underscores and hyphens, consider using one consistently`);
            }
        }

        // Report duplicates
        if (!this.options.allowDuplicateNames && duplicates.size > 0) {
            for (const duplicate of duplicates) {
                result.errors.push(`Duplicate tool name found: '${duplicate}'`);
            }
        }
    }

    /**
     * Validate tool descriptions
     */
    private validateToolDescriptions(tools: Tool[], result: ValidationResult): void {
        for (const tool of tools) {
            const { name, description } = tool.function;

            if (!description || description.trim().length === 0) {
                result.errors.push(`Tool '${name}' has empty description`);
                continue;
            }

            if (description.length > (this.options?.maxDescriptionLength || 1024)) {
                result.errors.push(
                    `Tool '${name}' description is too long (${description.length}/${this.options?.maxDescriptionLength || 1024} characters)`
                );
            }

            if (description.length < 10) {
                result.warnings.push(`Tool '${name}' has a very short description (${description.length} characters)`);
            }

            // Check for helpful description patterns
            const descLower = description.toLowerCase();
            if (!descLower.includes('create') &&
                !descLower.includes('get') &&
                !descLower.includes('update') &&
                !descLower.includes('delete') &&
                !descLower.includes('arrange') &&
                !descLower.includes('find')) {
                result.warnings.push(`Tool '${name}' description should start with an action verb (create, get, update, etc.)`);
            }
        }
    }

    /**
     * Validate tool parameters
     */
    private validateToolParameters(tools: Tool[], result: ValidationResult): void {
        for (const tool of tools) {
            const { name, parameters } = tool.function;

            if (!parameters.properties || Object.keys(parameters.properties).length === 0) {
                result.warnings.push(`Tool '${name}' has no parameters defined`);
                continue;
            }

            // Validate required parameters
            const requiredParams = parameters.required || [];
            const availableParams = Object.keys(parameters.properties);

            for (const requiredParam of requiredParams) {
                if (!availableParams.includes(requiredParam)) {
                    result.errors.push(`Tool '${name}' requires parameter '${requiredParam}' but it's not defined in properties`);
                }
            }

            // Validate parameter definitions
            for (const [paramName, paramDef] of Object.entries(parameters.properties)) {
                if (!paramDef.description) {
                    result.warnings.push(`Tool '${name}' parameter '${paramName}' lacks description`);
                }

                if (paramDef.description && paramDef.description.length < 5) {
                    result.warnings.push(`Tool '${name}' parameter '${paramName}' has very short description`);
                }

                // Validate parameter types
                if (paramDef.type === 'number') {
                    if (paramDef.minimum !== undefined && paramDef.maximum !== undefined) {
                        if (paramDef.minimum >= paramDef.maximum) {
                            result.errors.push(`Tool '${name}' parameter '${paramName}' has invalid range (min >= max)`);
                        }
                    }
                }

                if (paramDef.type === 'array') {
                    if (!paramDef.items) {
                        result.warnings.push(`Tool '${name}' parameter '${paramName}' is array type but lacks items definition`);
                    }
                }

                if (paramDef.type === 'object') {
                    if (!paramDef.properties) {
                        result.warnings.push(`Tool '${name}' parameter '${paramName}' is object type but lacks properties definition`);
                    }
                }
            }

            // Check for common canvas parameters
            const canvasTools = ['createRectangle', 'createCircle', 'createText', 'moveObject'];
            if (canvasTools.includes(name)) {
                if (!availableParams.includes('x') || !availableParams.includes('y')) {
                    result.warnings.push(`Canvas tool '${name}' should typically have x and y parameters`);
                }
            }
        }
    }

    /**
     * Validate tool categories and organization
     */
    private validateToolCategories(tools: Tool[], result: ValidationResult): void {
        // Categorize tools by function type
        const categories = {
            creation: ['create', 'add', 'make', 'build'],
            manipulation: ['move', 'resize', 'rotate', 'update', 'modify'],
            query: ['get', 'find', 'search', 'list'],
            layout: ['arrange', 'align', 'distribute', 'grid'],
            management: ['clear', 'delete', 'remove', 'copy', 'group'],
        };

        const toolsByCategory: Record<string, string[]> = {
            creation: [],
            manipulation: [],
            query: [],
            layout: [],
            management: [],
            uncategorized: [],
        };

        // Categorize each tool
        for (const tool of tools) {
            const name = tool.function.name.toLowerCase();
            let categorized = false;

            for (const [category, keywords] of Object.entries(categories)) {
                if (keywords.some(keyword => name.includes(keyword))) {
                    toolsByCategory[category].push(tool.function.name);
                    categorized = true;
                    break;
                }
            }

            if (!categorized) {
                toolsByCategory.uncategorized.push(tool.function.name);
            }
        }

        // Report category distribution
        console.log('📊 Tool category distribution:');
        for (const [category, toolNames] of Object.entries(toolsByCategory)) {
            if (toolNames.length > 0) {
                console.log(`   ${category}: ${toolNames.length} tools (${toolNames.join(', ')})`);
            }
        }

        // Check for required categories
        const requiredCategories = this.options?.requiredCategories || [];
        for (const requiredCategory of requiredCategories) {
            if (toolsByCategory[requiredCategory]?.length === 0) {
                result.warnings.push(`Missing tools in required category: ${requiredCategory}`);
            }
        }

        // Warn about uncategorized tools
        if (toolsByCategory.uncategorized.length > 0) {
            result.warnings.push(
                `Uncategorized tools found: ${toolsByCategory.uncategorized.join(', ')}`
            );
        }
    }

    /**
     * Get validation summary
     */
    getValidationSummary(result: ValidationResult): string {
        const lines = [];

        lines.push('🔍 Tool Validation Summary');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (result.isValid) {
            lines.push('✅ Status: VALID');
        } else {
            lines.push('❌ Status: INVALID');
        }

        if (result.tools) {
            lines.push(`📊 Total Tools: ${result.tools.length}`);
        }

        if (result.metadata) {
            lines.push(`📦 Version: ${result.metadata.version || 'Unknown'}`);
        }

        if (result.errors.length > 0) {
            lines.push(`❌ Errors: ${result.errors.length}`);
            result.errors.forEach(error => lines.push(`   • ${error}`));
        }

        if (result.warnings.length > 0) {
            lines.push(`⚠️  Warnings: ${result.warnings.length}`);
            result.warnings.forEach(warning => lines.push(`   • ${warning}`));
        }

        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return lines.join('\n');
    }
}

// Export singleton instance
export const toolValidator = new ToolValidator({
    strictMode: true,
    allowDuplicateNames: false,
    maxDescriptionLength: 1024,
    requiredCategories: ['creation', 'manipulation', 'query'],
});

export default toolValidator;
