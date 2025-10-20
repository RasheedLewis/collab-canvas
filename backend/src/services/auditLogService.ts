/**
 * Audit Log Service
 * 
 * Provides comprehensive audit logging for canvas permissions and access control.
 * Tracks all permission changes, access attempts, and security events.
 */

import { PermissionRole } from '../../../shared/types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Audit event types
export type AuditEventType =
    | 'canvas_access'           // User accessing a canvas
    | 'permission_granted'      // Permission granted to user
    | 'permission_revoked'      // Permission revoked from user
    | 'permission_updated'      // Permission role/settings updated
    | 'permission_expired'      // Permission expired
    | 'canvas_created'          // New canvas created
    | 'canvas_deleted'          // Canvas deleted
    | 'canvas_updated'          // Canvas metadata updated
    | 'invitation_sent'         // Collaboration invitation sent
    | 'invitation_accepted'     // Invitation accepted
    | 'invitation_declined'     // Invitation declined
    | 'shareable_link_created'  // Shareable link created
    | 'shareable_link_accessed' // Shareable link used
    | 'security_violation'      // Security policy violation
    | 'auth_failure'           // Authentication failure
    | 'permission_check_failed'; // Permission check failed

// Audit log entry interface
export interface AuditLogEntry {
    id: string;
    timestamp: number;
    eventType: AuditEventType;
    userId: string;
    canvasId?: string;
    targetUserId?: string; // For permission changes affecting other users

    // Event details
    details: {
        action?: string;
        role?: PermissionRole;
        previousRole?: PermissionRole;
        granted?: boolean;
        error?: string;
        reason?: string;

        // Request context
        ipAddress?: string;
        userAgent?: string;
        sessionId?: string;

        // Additional metadata
        metadata?: Record<string, any>;
    };

    // Risk level for security monitoring
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Canvas access log entry
export interface CanvasAccessLog {
    userId: string;
    canvasId: string;
    action: string;
    granted: boolean;
    role?: PermissionRole;
    error?: string;
    timestamp: number;
    ipAddress?: string;
    userAgent?: string;
}

// Permission change log entry
export interface PermissionChangeLog {
    canvasId: string;
    targetUserId: string;
    changedBy: string;
    changeType: 'granted' | 'revoked' | 'updated';
    previousRole?: PermissionRole;
    newRole?: PermissionRole;
    reason?: string;
    timestamp: number;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Audit logging service with security monitoring capabilities
 */
export class AuditLogService {
    private static instance: AuditLogService;

    // In-memory buffer for recent entries (before persistent storage)
    private logBuffer: AuditLogEntry[] = [];
    private maxBufferSize = 1000;

    // Log storage configuration
    private logConfig = {
        enableFileLogging: process.env.ENABLE_AUDIT_FILE_LOGGING === 'true',
        logDirectory: process.env.AUDIT_LOG_DIRECTORY || './logs/audit',
        enableDatabaseLogging: true, // Would integrate with Firestore
        bufferFlushInterval: 30000, // 30 seconds
    };

    // Security monitoring thresholds
    private securityThresholds = {
        maxFailedAccessAttempts: 5,
        timeWindowMs: 15 * 60 * 1000, // 15 minutes
        suspiciousActivityPatterns: [
            'rapid_permission_changes',
            'mass_access_attempts',
            'privilege_escalation_attempts'
        ]
    };

    private flushTimer?: NodeJS.Timeout;

    private constructor() {
        this.initializeLogging();
    }

    static getInstance(): AuditLogService {
        if (!AuditLogService.instance) {
            AuditLogService.instance = new AuditLogService();
        }
        return AuditLogService.instance;
    }

    // ========================================
    // Canvas Access Logging
    // ========================================

    /**
     * Log canvas access attempt
     */
    async logCanvasAccess(accessLog: CanvasAccessLog): Promise<void> {
        const entry: AuditLogEntry = {
            id: this.generateLogId(),
            timestamp: accessLog.timestamp,
            eventType: 'canvas_access',
            userId: accessLog.userId,
            canvasId: accessLog.canvasId,
            details: {
                action: accessLog.action,
                role: accessLog.role,
                granted: accessLog.granted,
                error: accessLog.error,
                ipAddress: accessLog.ipAddress,
                userAgent: accessLog.userAgent,
            },
            riskLevel: this.calculateRiskLevel(accessLog)
        };

        await this.writeLogEntry(entry);
        await this.checkSecurityViolations(entry);
    }

    /**
     * Log authentication failure
     */
    async logAuthFailure(
        userId: string,
        canvasId: string,
        reason: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        const entry: AuditLogEntry = {
            id: this.generateLogId(),
            timestamp: Date.now(),
            eventType: 'auth_failure',
            userId,
            canvasId,
            details: {
                error: reason,
                ipAddress,
                userAgent,
            },
            riskLevel: 'high'
        };

        await this.writeLogEntry(entry);
        await this.checkSecurityViolations(entry);
    }

    // ========================================
    // Permission Change Logging
    // ========================================

    /**
     * Log permission granted
     */
    async logPermissionGranted(changeLog: PermissionChangeLog): Promise<void> {
        const entry: AuditLogEntry = {
            id: this.generateLogId(),
            timestamp: changeLog.timestamp,
            eventType: 'permission_granted',
            userId: changeLog.changedBy,
            canvasId: changeLog.canvasId,
            targetUserId: changeLog.targetUserId,
            details: {
                action: 'grant_permission',
                role: changeLog.newRole,
                reason: changeLog.reason,
                ipAddress: changeLog.ipAddress,
                userAgent: changeLog.userAgent,
            },
            riskLevel: this.calculatePermissionChangeRiskLevel(changeLog)
        };

        await this.writeLogEntry(entry);
        await this.checkPermissionChangePatterns(entry);
    }

    /**
     * Log permission revoked
     */
    async logPermissionRevoked(changeLog: PermissionChangeLog): Promise<void> {
        const entry: AuditLogEntry = {
            id: this.generateLogId(),
            timestamp: changeLog.timestamp,
            eventType: 'permission_revoked',
            userId: changeLog.changedBy,
            canvasId: changeLog.canvasId,
            targetUserId: changeLog.targetUserId,
            details: {
                action: 'revoke_permission',
                previousRole: changeLog.previousRole,
                reason: changeLog.reason,
                ipAddress: changeLog.ipAddress,
                userAgent: changeLog.userAgent,
            },
            riskLevel: 'medium'
        };

        await this.writeLogEntry(entry);
        await this.checkPermissionChangePatterns(entry);
    }

    /**
     * Log permission updated
     */
    async logPermissionUpdated(changeLog: PermissionChangeLog): Promise<void> {
        const entry: AuditLogEntry = {
            id: this.generateLogId(),
            timestamp: changeLog.timestamp,
            eventType: 'permission_updated',
            userId: changeLog.changedBy,
            canvasId: changeLog.canvasId,
            targetUserId: changeLog.targetUserId,
            details: {
                action: 'update_permission',
                previousRole: changeLog.previousRole,
                role: changeLog.newRole,
                reason: changeLog.reason,
                ipAddress: changeLog.ipAddress,
                userAgent: changeLog.userAgent,
            },
            riskLevel: this.calculatePermissionChangeRiskLevel(changeLog)
        };

        await this.writeLogEntry(entry);
        await this.checkPermissionChangePatterns(entry);
    }

    // ========================================
    // Canvas Lifecycle Logging
    // ========================================

    /**
     * Log canvas creation
     */
    async logCanvasCreated(
        canvasId: string,
        userId: string,
        canvasName: string,
        privacy: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        const entry: AuditLogEntry = {
            id: this.generateLogId(),
            timestamp: Date.now(),
            eventType: 'canvas_created',
            userId,
            canvasId,
            details: {
                action: 'create_canvas',
                metadata: {
                    canvasName,
                    privacy
                },
                ipAddress,
                userAgent,
            },
            riskLevel: 'low'
        };

        await this.writeLogEntry(entry);
    }

    /**
     * Log canvas deletion
     */
    async logCanvasDeleted(
        canvasId: string,
        userId: string,
        reason?: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        const entry: AuditLogEntry = {
            id: this.generateLogId(),
            timestamp: Date.now(),
            eventType: 'canvas_deleted',
            userId,
            canvasId,
            details: {
                action: 'delete_canvas',
                reason,
                ipAddress,
                userAgent,
            },
            riskLevel: 'high' // Deletion is irreversible
        };

        await this.writeLogEntry(entry);
    }

    // ========================================
    // Security Monitoring
    // ========================================

    /**
     * Log security violation
     */
    async logSecurityViolation(
        userId: string,
        violationType: string,
        details: Record<string, any>,
        canvasId?: string
    ): Promise<void> {
        const entry: AuditLogEntry = {
            id: this.generateLogId(),
            timestamp: Date.now(),
            eventType: 'security_violation',
            userId,
            canvasId,
            details: {
                action: violationType,
                metadata: details,
            },
            riskLevel: 'critical'
        };

        await this.writeLogEntry(entry);

        // Immediate alert for critical violations
        await this.handleCriticalSecurityEvent(entry);
    }

    // ========================================
    // Query and Analysis
    // ========================================

    /**
     * Get audit logs for a canvas
     */
    async getCanvasAuditLogs(
        canvasId: string,
        options: {
            startTime?: number;
            endTime?: number;
            eventTypes?: AuditEventType[];
            limit?: number;
        } = {}
    ): Promise<AuditLogEntry[]> {
        const { startTime = 0, endTime = Date.now(), eventTypes, limit = 100 } = options;

        return this.logBuffer
            .filter(entry => {
                if (entry.canvasId !== canvasId) return false;
                if (entry.timestamp < startTime || entry.timestamp > endTime) return false;
                if (eventTypes && !eventTypes.includes(entry.eventType)) return false;
                return true;
            })
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get audit logs for a user
     */
    async getUserAuditLogs(
        userId: string,
        options: {
            startTime?: number;
            endTime?: number;
            eventTypes?: AuditEventType[];
            limit?: number;
        } = {}
    ): Promise<AuditLogEntry[]> {
        const { startTime = 0, endTime = Date.now(), eventTypes, limit = 100 } = options;

        return this.logBuffer
            .filter(entry => {
                if (entry.userId !== userId && entry.targetUserId !== userId) return false;
                if (entry.timestamp < startTime || entry.timestamp > endTime) return false;
                if (eventTypes && !eventTypes.includes(entry.eventType)) return false;
                return true;
            })
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get security alerts
     */
    async getSecurityAlerts(timeWindow: number = 24 * 60 * 60 * 1000): Promise<AuditLogEntry[]> {
        const cutoff = Date.now() - timeWindow;

        return this.logBuffer
            .filter(entry =>
                entry.timestamp >= cutoff &&
                (entry.riskLevel === 'high' || entry.riskLevel === 'critical')
            )
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Generate audit report
     */
    async generateAuditReport(
        canvasId: string,
        timeRange: { start: number; end: number }
    ): Promise<{
        summary: {
            totalEvents: number;
            accessAttempts: number;
            permissionChanges: number;
            securityViolations: number;
            uniqueUsers: Set<string>;
        };
        events: AuditLogEntry[];
        timeline: Array<{ date: string; count: number; riskLevel: string }>;
    }> {
        const events = await this.getCanvasAuditLogs(canvasId, {
            startTime: timeRange.start,
            endTime: timeRange.end,
            limit: 1000
        });

        const summary = {
            totalEvents: events.length,
            accessAttempts: events.filter(e => e.eventType === 'canvas_access').length,
            permissionChanges: events.filter(e =>
                ['permission_granted', 'permission_revoked', 'permission_updated'].includes(e.eventType)
            ).length,
            securityViolations: events.filter(e => e.eventType === 'security_violation').length,
            uniqueUsers: new Set(events.map(e => e.userId))
        };

        // Generate daily timeline
        const timeline = this.generateTimeline(events, timeRange);

        return { summary, events, timeline };
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    private async initializeLogging(): Promise<void> {
        if (this.logConfig.enableFileLogging) {
            try {
                await fs.mkdir(this.logConfig.logDirectory, { recursive: true });
            } catch (error) {
                console.error('Failed to create audit log directory:', error);
            }
        }

        // Start buffer flush timer
        this.flushTimer = setInterval(() => {
            this.flushLogBuffer();
        }, this.logConfig.bufferFlushInterval);
    }

    private async writeLogEntry(entry: AuditLogEntry): Promise<void> {
        // Add to in-memory buffer
        this.logBuffer.push(entry);

        // Maintain buffer size
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }

        // Write to file if enabled
        if (this.logConfig.enableFileLogging) {
            await this.writeToFile(entry);
        }

        // In production: write to database/Firestore
        // await this.writeToDatabase(entry);
    }

    private async writeToFile(entry: AuditLogEntry): Promise<void> {
        try {
            const date = new Date().toISOString().split('T')[0];
            const filename = path.join(this.logConfig.logDirectory, `audit-${date}.jsonl`);
            const logLine = JSON.stringify(entry) + '\n';

            await fs.appendFile(filename, logLine, 'utf8');
        } catch (error) {
            console.error('Failed to write audit log to file:', error);
        }
    }

    private calculateRiskLevel(accessLog: CanvasAccessLog): AuditLogEntry['riskLevel'] {
        if (!accessLog.granted && accessLog.error) {
            return 'medium';
        }
        return 'low';
    }

    private calculatePermissionChangeRiskLevel(changeLog: PermissionChangeLog): AuditLogEntry['riskLevel'] {
        // Owner role changes are high risk
        if (changeLog.newRole === 'owner' || changeLog.previousRole === 'owner') {
            return 'high';
        }

        // Editor role changes are medium risk
        if (changeLog.newRole === 'editor' || changeLog.previousRole === 'editor') {
            return 'medium';
        }

        return 'low';
    }

    private async checkSecurityViolations(entry: AuditLogEntry): Promise<void> {
        // Check for failed access patterns
        if (!entry.details.granted && entry.eventType === 'canvas_access') {
            const recentFailures = this.logBuffer.filter(log =>
                log.userId === entry.userId &&
                log.eventType === 'canvas_access' &&
                !log.details.granted &&
                (entry.timestamp - log.timestamp) < this.securityThresholds.timeWindowMs
            );

            if (recentFailures.length >= this.securityThresholds.maxFailedAccessAttempts) {
                await this.logSecurityViolation(
                    entry.userId,
                    'excessive_failed_access_attempts',
                    {
                        canvasId: entry.canvasId,
                        attemptCount: recentFailures.length,
                        timeWindow: this.securityThresholds.timeWindowMs
                    },
                    entry.canvasId
                );
            }
        }
    }

    private async checkPermissionChangePatterns(entry: AuditLogEntry): Promise<void> {
        // Check for rapid permission changes
        const recentPermissionChanges = this.logBuffer.filter(log =>
            log.userId === entry.userId &&
            ['permission_granted', 'permission_revoked', 'permission_updated'].includes(log.eventType) &&
            (entry.timestamp - log.timestamp) < (5 * 60 * 1000) // 5 minutes
        );

        if (recentPermissionChanges.length >= 5) {
            await this.logSecurityViolation(
                entry.userId,
                'rapid_permission_changes',
                {
                    changeCount: recentPermissionChanges.length,
                    timeWindow: 5 * 60 * 1000
                },
                entry.canvasId
            );
        }
    }

    private async handleCriticalSecurityEvent(entry: AuditLogEntry): Promise<void> {
        // In production, this would:
        // 1. Send immediate alerts to security team
        // 2. Potentially trigger account lockouts
        // 3. Update security monitoring systems

        console.error('CRITICAL SECURITY EVENT:', entry);
    }

    private generateLogId(): string {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateTimeline(
        events: AuditLogEntry[],
        timeRange: { start: number; end: number }
    ): Array<{ date: string; count: number; riskLevel: string }> {
        const timeline: Array<{ date: string; count: number; riskLevel: string }> = [];
        const msPerDay = 24 * 60 * 60 * 1000;

        for (let time = timeRange.start; time <= timeRange.end; time += msPerDay) {
            const date = new Date(time).toISOString().split('T')[0];
            const dayEvents = events.filter(e =>
                e.timestamp >= time && e.timestamp < time + msPerDay
            );

            const highRiskEvents = dayEvents.filter(e =>
                e.riskLevel === 'high' || e.riskLevel === 'critical'
            ).length;

            timeline.push({
                date,
                count: dayEvents.length,
                riskLevel: highRiskEvents > 0 ? 'high' : 'low'
            });
        }

        return timeline;
    }

    private async flushLogBuffer(): Promise<void> {
        // In production, this would flush buffered entries to database
        console.log(`Audit log buffer: ${this.logBuffer.length} entries`);
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.flushLogBuffer();
    }
}
