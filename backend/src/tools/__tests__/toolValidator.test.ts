import { ToolValidator } from '../toolValidator';
import fs from 'fs/promises';

// Mock fs for testing
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ToolValidator', () => {
    let validator: ToolValidator;

    beforeEach(() => {
        validator = new ToolValidator();
        jest.clearAllMocks();
    });

    describe('Schema Validation', () => {
        test('should validate valid tools file', () => {
            const validToolsFile = {
                ai_canvas_tools: [
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
                                    width: { type: 'number', description: 'Width' },
                                    height: { type: 'number', description: 'Height' },
                                    color: { type: 'string', description: 'Fill color' }
                                },
                                required: ['x', 'y', 'width', 'height', 'color']
                            }
                        }
                    }
                ],
                version: '1.0.0'
            };

            const result = validator.validateTools(validToolsFile);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.tools).toHaveLength(1);
            expect(result.tools![0].function.name).toBe('createRectangle');
        });

        test('should reject invalid tool structure', () => {
            const invalidToolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: '', // Invalid: empty name
                            description: 'Test description',
                            parameters: {
                                type: 'object',
                                properties: {}
                            }
                        }
                    }
                ]
            };

            const result = validator.validateTools(invalidToolsFile);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(error => error.includes('name'))).toBe(true);
        });

        test('should validate parameter types correctly', () => {
            const toolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'testTool',
                            description: 'Test tool with various parameter types',
                            parameters: {
                                type: 'object',
                                properties: {
                                    stringParam: { type: 'string', description: 'A string parameter' },
                                    numberParam: { type: 'number', description: 'A number parameter', minimum: 0 },
                                    booleanParam: { type: 'boolean', description: 'A boolean parameter' },
                                    arrayParam: {
                                        type: 'array',
                                        description: 'An array parameter',
                                        items: { type: 'string' }
                                    },
                                    objectParam: {
                                        type: 'object',
                                        description: 'An object parameter',
                                        properties: {
                                            nestedProp: { type: 'string' }
                                        }
                                    }
                                },
                                required: ['stringParam', 'numberParam']
                            }
                        }
                    }
                ]
            };

            const result = validator.validateTools(toolsFile);

            expect(result.isValid).toBe(true);
            expect(result.tools![0].function.parameters.properties).toHaveProperty('stringParam');
            expect(result.tools![0].function.parameters.properties).toHaveProperty('numberParam');
            expect(result.tools![0].function.parameters.required).toContain('stringParam');
        });
    });

    describe('Tool Name Validation', () => {
        test('should detect duplicate tool names', () => {
            const toolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'duplicateTool',
                            description: 'First tool',
                            parameters: { type: 'object', properties: {} }
                        }
                    },
                    {
                        type: 'function',
                        function: {
                            name: 'duplicateTool',
                            description: 'Second tool with same name',
                            parameters: { type: 'object', properties: {} }
                        }
                    }
                ]
            };

            const result = validator.validateTools(toolsFile);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Duplicate tool name'))).toBe(true);
        });

        test('should warn about reserved names', () => {
            const toolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'help',
                            description: 'Tool with reserved name',
                            parameters: { type: 'object', properties: {} }
                        }
                    }
                ]
            };

            const result = validator.validateTools(toolsFile);

            expect(result.warnings.some(warning => warning.includes('reserved name'))).toBe(true);
        });

        test('should validate tool name format', () => {
            const toolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'invalid name with spaces',
                            description: 'Tool with invalid name format',
                            parameters: { type: 'object', properties: {} }
                        }
                    }
                ]
            };

            const result = validator.validateTools(toolsFile);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('alphanumeric'))).toBe(true);
        });
    });

    describe('Description Validation', () => {
        test('should require non-empty descriptions', () => {
            const toolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'testTool',
                            description: '',
                            parameters: { type: 'object', properties: {} }
                        }
                    }
                ]
            };

            const result = validator.validateTools(toolsFile);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('empty description'))).toBe(true);
        });

        test('should warn about very short descriptions', () => {
            const toolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'testTool',
                            description: 'Short',
                            parameters: { type: 'object', properties: {} }
                        }
                    }
                ]
            };

            const result = validator.validateTools(toolsFile);

            expect(result.warnings.some(warning => warning.includes('very short description'))).toBe(true);
        });
    });

    describe('Parameter Validation', () => {
        test('should validate required parameters exist in properties', () => {
            const toolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'testTool',
                            description: 'Test tool',
                            parameters: {
                                type: 'object',
                                properties: {
                                    existingParam: { type: 'string', description: 'Exists' }
                                },
                                required: ['existingParam', 'missingParam']
                            }
                        }
                    }
                ]
            };

            const result = validator.validateTools(toolsFile);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error =>
                error.includes('requires parameter \'missingParam\'')
            )).toBe(true);
        });

        test('should warn about parameters without descriptions', () => {
            const toolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'testTool',
                            description: 'Test tool',
                            parameters: {
                                type: 'object',
                                properties: {
                                    undocumentedParam: { type: 'string' }
                                }
                            }
                        }
                    }
                ]
            };

            const result = validator.validateTools(toolsFile);

            expect(result.warnings.some(warning =>
                warning.includes('lacks description')
            )).toBe(true);
        });

        test('should validate number parameter ranges', () => {
            const toolsFile = {
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'testTool',
                            description: 'Test tool',
                            parameters: {
                                type: 'object',
                                properties: {
                                    invalidRange: {
                                        type: 'number',
                                        description: 'Invalid range',
                                        minimum: 10,
                                        maximum: 5
                                    }
                                }
                            }
                        }
                    }
                ]
            };

            const result = validator.validateTools(toolsFile);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error =>
                error.includes('invalid range')
            )).toBe(true);
        });
    });

    describe('File Operations', () => {
        test('should handle file read errors', async () => {
            mockFs.readFile.mockRejectedValue(new Error('File not found'));

            const result = await validator.validateFile('/nonexistent/file.json');

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error =>
                error.includes('Failed to read or parse file')
            )).toBe(true);
        });

        test('should handle JSON parse errors', async () => {
            mockFs.readFile.mockResolvedValue('invalid json{');

            const result = await validator.validateFile('/invalid/file.json');

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error =>
                error.includes('Failed to read or parse file')
            )).toBe(true);
        });

        test('should successfully validate file', async () => {
            const validJson = JSON.stringify({
                ai_canvas_tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'testTool',
                            description: 'A test tool for validation',
                            parameters: {
                                type: 'object',
                                properties: {
                                    param1: { type: 'string', description: 'First parameter' }
                                },
                                required: ['param1']
                            }
                        }
                    }
                ]
            });

            mockFs.readFile.mockResolvedValue(validJson);

            const result = await validator.validateFile('/valid/file.json');

            expect(result.isValid).toBe(true);
            expect(result.tools).toHaveLength(1);
            expect(result.tools![0].function.name).toBe('testTool');
        });
    });

    describe('Validation Summary', () => {
        test('should generate proper validation summary', () => {
            const result = {
                isValid: false,
                errors: ['Error 1', 'Error 2'],
                warnings: ['Warning 1'],
                tools: [
                    {
                        type: 'function' as const,
                        function: {
                            name: 'testTool',
                            description: 'Test',
                            parameters: { type: 'object' as const, properties: {} }
                        }
                    }
                ],
                metadata: { version: '1.0.0' }
            };

            const summary = validator.getValidationSummary(result);

            expect(summary).toContain('❌ Status: INVALID');
            expect(summary).toContain('📊 Total Tools: 1');
            expect(summary).toContain('📦 Version: 1.0.0');
            expect(summary).toContain('❌ Errors: 2');
            expect(summary).toContain('⚠️  Warnings: 1');
            expect(summary).toContain('Error 1');
            expect(summary).toContain('Warning 1');
        });
    });
});
