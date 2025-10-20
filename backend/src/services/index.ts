/**
 * Services Index
 * 
 * Exports all services for the CollabCanvas application.
 */

// Permission and Security Services
export { PermissionService } from './permissionService';
export { PermissionCacheService } from './permissionCacheService';
export { AuditLogService } from './auditLogService';

// Canvas Management Services
export { canvasStateService, CanvasStateService } from './canvasStateService';
export { CanvasDiscoveryService } from './canvasDiscoveryService';
export { ThumbnailService } from './thumbnailService';
export { CanvasTrackingService } from './canvasTrackingService';

// WebSocket and Real-time Services
export { CanvasWebSocketService } from './canvasWebSocketService';

// Communication Services
export { EmailNotificationService } from './emailNotificationService';
export { ShareableLinkService } from './shareableLinkService';

// Database Services
export * from '../database';

// AI Services (existing)
export { openaiService, OpenAIService } from './openaiService';

// Persistence Services (existing)
export { canvasPersistence, CanvasPersistenceService } from './persistenceService';

// Re-export types for convenience
export type {
    PermissionValidationResult,
    UserCanvasPermissionSummary,
    BatchPermissionResult
} from './permissionService';

export type {
    AuditEventType,
    AuditLogEntry,
    CanvasAccessLog,
    PermissionChangeLog
} from './auditLogService';
