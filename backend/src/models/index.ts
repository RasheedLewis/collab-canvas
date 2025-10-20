/**
 * Models Index
 * 
 * Exports all data models for the CollabCanvas application.
 */

// Canvas Models
export { Canvas } from './Canvas';
export { CanvasPermission } from './CanvasPermission';

// Re-export shared types for convenience
export type {
    Canvas as ICanvas,
    CanvasPermission as ICanvasPermission,
    CanvasObject,
    BaseCanvasObject,
    RectangleObject,
    CircleObject,
    TextObject,
    User,
    PermissionRole,
    CanvasPrivacy,
    CanvasState,
    CanvasMetrics,
    CreateCanvasRequest,
    UpdateCanvasRequest,
    InviteCollaboratorRequest,
    UpdatePermissionRequest,
    CanvasFilters,
    CanvasSortOptions,
    CanvasSearchOptions
} from '../../../shared/types';
