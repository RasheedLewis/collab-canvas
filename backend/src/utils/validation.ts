/**
 * Validation Utilities
 * 
 * Common validation functions for API requests and data.
 */

import {
    CreateCanvasRequest,
    UpdateCanvasRequest,
    CanvasObject,
    CanvasPrivacy,
    PermissionRole
} from '../../../shared/types';

// Validation result interface
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// Regex patterns
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate canvas creation request
 */
export function validateCreateCanvasRequest(request: CreateCanvasRequest): ValidationResult {
    const errors: string[] = [];

    // Name validation
    if (!request.name || typeof request.name !== 'string') {
        errors.push('Canvas name is required');
    } else {
        if (request.name.trim().length === 0) {
            errors.push('Canvas name cannot be empty');
        }
        if (request.name.length > 255) {
            errors.push('Canvas name must be less than 255 characters');
        }
        if (request.name.includes('/') || request.name.includes('\\')) {
            errors.push('Canvas name cannot contain path separators');
        }
    }

    // Description validation
    if (request.description !== undefined) {
        if (typeof request.description !== 'string') {
            errors.push('Canvas description must be a string');
        } else if (request.description.length > 1000) {
            errors.push('Canvas description must be less than 1000 characters');
        }
    }

    // Privacy validation
    if (request.privacy !== undefined) {
        if (!['private', 'public', 'unlisted'].includes(request.privacy)) {
            errors.push('Canvas privacy must be private, public, or unlisted');
        }
    }

    // Tags validation
    if (request.tags !== undefined) {
        if (!Array.isArray(request.tags)) {
            errors.push('Canvas tags must be an array');
        } else {
            if (request.tags.length > 10) {
                errors.push('Maximum 10 tags allowed');
            }
            request.tags.forEach((tag, index) => {
                if (typeof tag !== 'string') {
                    errors.push(`Tag at index ${index} must be a string`);
                } else {
                    if (tag.length > 50) {
                        errors.push(`Tag at index ${index} must be less than 50 characters`);
                    }
                    if (!/^[a-zA-Z0-9\-_\s]+$/.test(tag)) {
                        errors.push(`Tag at index ${index} contains invalid characters`);
                    }
                }
            });
        }
    }

    // Folder validation
    if (request.folder !== undefined) {
        if (typeof request.folder !== 'string') {
            errors.push('Canvas folder must be a string');
        } else if (request.folder.length > 100) {
            errors.push('Canvas folder name must be less than 100 characters');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate canvas update request
 */
export function validateUpdateCanvasRequest(request: UpdateCanvasRequest): ValidationResult {
    const errors: string[] = [];

    // Only validate fields that are present
    if (request.name !== undefined) {
        const nameValidation = validateCreateCanvasRequest({ name: request.name });
        if (!nameValidation.valid) {
            errors.push(...nameValidation.errors);
        }
    }

    if (request.description !== undefined) {
        if (typeof request.description !== 'string') {
            errors.push('Canvas description must be a string');
        } else if (request.description.length > 1000) {
            errors.push('Canvas description must be less than 1000 characters');
        }
    }

    if (request.privacy !== undefined) {
        if (!['private', 'public', 'unlisted'].includes(request.privacy)) {
            errors.push('Canvas privacy must be private, public, or unlisted');
        }
    }

    if (request.tags !== undefined) {
        if (!Array.isArray(request.tags)) {
            errors.push('Canvas tags must be an array');
        } else {
            if (request.tags.length > 10) {
                errors.push('Maximum 10 tags allowed');
            }
            request.tags.forEach((tag, index) => {
                if (typeof tag !== 'string') {
                    errors.push(`Tag at index ${index} must be a string`);
                } else {
                    if (tag.length > 50) {
                        errors.push(`Tag at index ${index} must be less than 50 characters`);
                    }
                    if (!/^[a-zA-Z0-9\-_\s]+$/.test(tag)) {
                        errors.push(`Tag at index ${index} contains invalid characters`);
                    }
                }
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate canvas object data
 */
export function validateCanvasObject(obj: Partial<CanvasObject>): ValidationResult {
    const errors: string[] = [];

    // Type validation
    if (!obj.type || !['rectangle', 'circle', 'text'].includes(obj.type)) {
        errors.push('Object type must be rectangle, circle, or text');
    }

    // Position validation
    if (typeof obj.x !== 'number') {
        errors.push('Object x coordinate must be a number');
    } else if (obj.x < -100000 || obj.x > 100000) {
        errors.push('Object x coordinate must be between -100000 and 100000');
    }

    if (typeof obj.y !== 'number') {
        errors.push('Object y coordinate must be a number');
    } else if (obj.y < -100000 || obj.y > 100000) {
        errors.push('Object y coordinate must be between -100000 and 100000');
    }

    // Color validation
    if (!obj.color || typeof obj.color !== 'string') {
        errors.push('Object color is required');
    } else if (!HEX_COLOR_PATTERN.test(obj.color)) {
        errors.push('Object color must be in hex format (e.g., #FF0000)');
    }

    // Rotation validation
    if (obj.rotation !== undefined) {
        if (typeof obj.rotation !== 'number') {
            errors.push('Object rotation must be a number');
        } else if (obj.rotation < 0 || obj.rotation >= 360) {
            errors.push('Object rotation must be between 0 and 359 degrees');
        }
    }

    // Type-specific validation
    if (obj.type) {
        switch (obj.type) {
            case 'rectangle':
                const rectObj = obj as any;
                if (typeof rectObj.width !== 'number' || rectObj.width <= 0) {
                    errors.push('Rectangle width must be a positive number');
                } else if (rectObj.width > 10000) {
                    errors.push('Rectangle width must be less than 10000');
                }

                if (typeof rectObj.height !== 'number' || rectObj.height <= 0) {
                    errors.push('Rectangle height must be a positive number');
                } else if (rectObj.height > 10000) {
                    errors.push('Rectangle height must be less than 10000');
                }
                break;

            case 'circle':
                const circleObj = obj as any;
                if (typeof circleObj.radius !== 'number' || circleObj.radius <= 0) {
                    errors.push('Circle radius must be a positive number');
                } else if (circleObj.radius > 5000) {
                    errors.push('Circle radius must be less than 5000');
                }
                break;

            case 'text':
                const textObj = obj as any;
                if (!textObj.text || typeof textObj.text !== 'string') {
                    errors.push('Text object must have text content');
                } else {
                    if (textObj.text.trim().length === 0) {
                        errors.push('Text content cannot be empty');
                    }
                    if (textObj.text.length > 5000) {
                        errors.push('Text content must be less than 5000 characters');
                    }
                }

                if (typeof textObj.fontSize !== 'number') {
                    errors.push('Text fontSize must be a number');
                } else if (textObj.fontSize < 6 || textObj.fontSize > 200) {
                    errors.push('Text fontSize must be between 6 and 200');
                }

                if (textObj.fontFamily !== undefined) {
                    if (typeof textObj.fontFamily !== 'string') {
                        errors.push('Text fontFamily must be a string');
                    } else if (textObj.fontFamily.length > 50) {
                        errors.push('Text fontFamily must be less than 50 characters');
                    }
                }

                if (textObj.fontStyle !== undefined) {
                    if (typeof textObj.fontStyle !== 'string') {
                        errors.push('Text fontStyle must be a string');
                    } else if (!['normal', 'italic', 'bold', 'bold italic'].includes(textObj.fontStyle)) {
                        errors.push('Text fontStyle must be normal, italic, bold, or bold italic');
                    }
                }
                break;
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: {
    limit?: string | number;
    cursor?: string;
}): ValidationResult {
    const errors: string[] = [];

    if (params.limit !== undefined) {
        const limit = typeof params.limit === 'string' ? parseInt(params.limit) : params.limit;
        if (isNaN(limit) || limit < 1) {
            errors.push('Limit must be a positive number');
        } else if (limit > 100) {
            errors.push('Limit cannot exceed 100');
        }
    }

    if (params.cursor !== undefined) {
        if (typeof params.cursor !== 'string' || params.cursor.trim().length === 0) {
            errors.push('Cursor must be a non-empty string');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate permission role
 */
export function validatePermissionRole(role: string): ValidationResult {
    const validRoles: PermissionRole[] = ['owner', 'editor', 'viewer'];

    return {
        valid: validRoles.includes(role as PermissionRole),
        errors: validRoles.includes(role as PermissionRole) ? [] : [`Role must be one of: ${validRoles.join(', ')}`]
    };
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
    return {
        valid: EMAIL_PATTERN.test(email),
        errors: EMAIL_PATTERN.test(email) ? [] : ['Invalid email address format']
    };
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): ValidationResult {
    return {
        valid: UUID_PATTERN.test(uuid),
        errors: UUID_PATTERN.test(uuid) ? [] : ['Invalid UUID format']
    };
}

/**
 * Validate hex color
 */
export function validateHexColor(color: string): ValidationResult {
    return {
        valid: HEX_COLOR_PATTERN.test(color),
        errors: HEX_COLOR_PATTERN.test(color) ? [] : ['Color must be in hex format (e.g., #FF0000)']
    };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
    return input
        .trim()
        .substring(0, maxLength)
        .replace(/[<>]/g, ''); // Basic XSS prevention
}

/**
 * Validate array of objects
 */
export function validateObjectArray<T>(
    array: any[],
    validator: (item: T) => ValidationResult,
    maxLength: number = 100
): ValidationResult {
    const errors: string[] = [];

    if (!Array.isArray(array)) {
        return { valid: false, errors: ['Input must be an array'] };
    }

    if (array.length === 0) {
        return { valid: false, errors: ['Array cannot be empty'] };
    }

    if (array.length > maxLength) {
        return { valid: false, errors: [`Array cannot contain more than ${maxLength} items`] };
    }

    array.forEach((item, index) => {
        const validation = validator(item);
        if (!validation.valid) {
            errors.push(`Item at index ${index}: ${validation.errors.join(', ')}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}
