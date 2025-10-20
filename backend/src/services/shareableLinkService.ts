/**
 * Shareable Link Service
 * 
 * Manages shareable links for canvases, allowing temporary or permanent
 * access through public URLs with configurable permissions and expiration.
 */

import { firestoreService } from '../database/firestoreService';
import { AuditLogService } from './auditLogService';
import {
    ShareableLink,
    PermissionRole,
    CreateShareableLinkRequest
} from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export interface ShareableLinkResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}

export interface CreateShareableLinkData {
    canvasId: string;
    createdBy: string;
    role: PermissionRole;
    expiresAt?: number;
    maxAccess?: number;
}

export interface ShareableLinkAccess {
    linkId: string;
    accessorId?: string; // User ID if authenticated
    accessorEmail?: string; // Email if provided
    ipAddress?: string;
    userAgent?: string;
    timestamp: number;
}

/**
 * Shareable Link Service - Singleton
 */
export class ShareableLinkService {
    private static instance: ShareableLinkService;

    // In-memory cache for active links (in production, use Redis)
    private linkCache: Map<string, ShareableLink> = new Map();
    private accessCache: Map<string, ShareableLinkAccess[]> = new Map();
    private cacheTimeout = 15 * 60 * 1000; // 15 minutes

    private constructor() { }

    public static getInstance(): ShareableLinkService {
        if (!ShareableLinkService.instance) {
            ShareableLinkService.instance = new ShareableLinkService();
        }
        return ShareableLinkService.instance;
    }

    /**
     * Create a new shareable link
     */
    public async createShareableLink(
        data: CreateShareableLinkData
    ): Promise<ShareableLinkResult<ShareableLink>> {
        try {
            const shareableLink: ShareableLink = {
                id: uuidv4(),
                canvasId: data.canvasId,
                createdBy: data.createdBy,
                role: data.role,
                isActive: true,
                expiresAt: data.expiresAt,
                createdAt: Date.now(),
                accessCount: 0,
                maxAccess: data.maxAccess
            };

            // Save to database (in production, this would be a separate collection)
            // For now, we'll use a mock storage approach
            console.log('Creating shareable link:', shareableLink);

            // Cache the link
            this.linkCache.set(shareableLink.id, shareableLink);

            // Set cache expiry
            setTimeout(() => {
                this.linkCache.delete(shareableLink.id);
                this.accessCache.delete(shareableLink.id);
            }, this.cacheTimeout);

            // Log creation
            const auditService = AuditLogService.getInstance();
            await auditService.logCanvasAccess({
                userId: data.createdBy,
                canvasId: data.canvasId,
                action: 'Shareable link created',
                role: data.role,
                granted: true,
                timestamp: Date.now()
            });

            return {
                success: true,
                data: shareableLink
            };

        } catch (error) {
            console.error('Error creating shareable link:', error);
            return {
                success: false,
                error: 'Failed to create shareable link',
                code: 'LINK_CREATION_ERROR'
            };
        }
    }

    /**
     * Get shareable link by ID
     */
    public async getShareableLink(linkId: string): Promise<ShareableLinkResult<ShareableLink>> {
        try {
            // Check cache first
            if (this.linkCache.has(linkId)) {
                const link = this.linkCache.get(linkId)!;

                // Check if link is still valid
                if (!this.isLinkValid(link)) {
                    return {
                        success: false,
                        error: 'Shareable link has expired or is inactive',
                        code: 'LINK_EXPIRED'
                    };
                }

                return {
                    success: true,
                    data: link
                };
            }

            // In production, fetch from database
            // For now, return not found
            return {
                success: false,
                error: 'Shareable link not found',
                code: 'LINK_NOT_FOUND'
            };

        } catch (error) {
            console.error('Error getting shareable link:', error);
            return {
                success: false,
                error: 'Failed to get shareable link',
                code: 'LINK_FETCH_ERROR'
            };
        }
    }

    /**
     * Access a canvas via shareable link
     */
    public async accessViaShareableLink(
        linkId: string,
        accessData: Partial<ShareableLinkAccess>
    ): Promise<ShareableLinkResult<{ canvasId: string; role: PermissionRole }>> {
        try {
            const linkResult = await this.getShareableLink(linkId);
            if (!linkResult.success) {
                return {
                    success: false,
                    error: linkResult.error,
                    code: linkResult.code
                };
            }

            const link = linkResult.data!;

            // Check access limits
            if (link.maxAccess && link.accessCount >= link.maxAccess) {
                return {
                    success: false,
                    error: 'Shareable link has reached maximum access limit',
                    code: 'LINK_ACCESS_LIMIT_EXCEEDED'
                };
            }

            // Record access
            const access: ShareableLinkAccess = {
                linkId,
                accessorId: accessData.accessorId,
                accessorEmail: accessData.accessorEmail,
                ipAddress: accessData.ipAddress,
                userAgent: accessData.userAgent,
                timestamp: Date.now()
            };

            // Store access record
            const accesses = this.accessCache.get(linkId) || [];
            accesses.push(access);
            this.accessCache.set(linkId, accesses);

            // Update access count
            link.accessCount++;
            this.linkCache.set(linkId, link);

            // In production, update database
            console.log('Canvas accessed via shareable link:', {
                linkId,
                canvasId: link.canvasId,
                role: link.role,
                accessor: accessData.accessorId || accessData.accessorEmail || 'anonymous'
            });

            // Log access
            const auditService = AuditLogService.getInstance();
            await auditService.logCanvasAccess({
                userId: accessData.accessorId || 'anonymous',
                canvasId: link.canvasId,
                action: 'Canvas accessed via shareable link',
                role: link.role,
                granted: true,
                timestamp: Date.now(),
                ipAddress: accessData.ipAddress,
                userAgent: accessData.userAgent
            });

            return {
                success: true,
                data: {
                    canvasId: link.canvasId,
                    role: link.role
                }
            };

        } catch (error) {
            console.error('Error accessing canvas via shareable link:', error);
            return {
                success: false,
                error: 'Failed to access canvas via shareable link',
                code: 'LINK_ACCESS_ERROR'
            };
        }
    }

    /**
     * Get all shareable links for a canvas
     */
    public async getCanvasLinks(canvasId: string): Promise<ShareableLinkResult<ShareableLink[]>> {
        try {
            // In production, query database by canvasId
            // For now, filter cached links
            const canvasLinks: ShareableLink[] = [];

            for (const link of this.linkCache.values()) {
                if (link.canvasId === canvasId) {
                    canvasLinks.push(link);
                }
            }

            return {
                success: true,
                data: canvasLinks
            };

        } catch (error) {
            console.error('Error getting canvas links:', error);
            return {
                success: false,
                error: 'Failed to get canvas links',
                code: 'CANVAS_LINKS_ERROR'
            };
        }
    }

    /**
     * Deactivate a shareable link
     */
    public async deactivateLink(
        linkId: string,
        deactivatedBy: string
    ): Promise<ShareableLinkResult<void>> {
        try {
            const linkResult = await this.getShareableLink(linkId);
            if (!linkResult.success) {
                return {
                    success: false,
                    error: linkResult.error,
                    code: linkResult.code
                };
            }

            const link = linkResult.data!;

            // Deactivate link
            link.isActive = false;
            this.linkCache.set(linkId, link);

            // In production, update database
            console.log('Shareable link deactivated:', linkId);

            // Log deactivation
            const auditService = AuditLogService.getInstance();
            await auditService.logCanvasAccess({
                userId: deactivatedBy,
                canvasId: link.canvasId,
                action: 'Shareable link deactivated',
                granted: true,
                timestamp: Date.now()
            });

            return {
                success: true
            };

        } catch (error) {
            console.error('Error deactivating link:', error);
            return {
                success: false,
                error: 'Failed to deactivate link',
                code: 'LINK_DEACTIVATION_ERROR'
            };
        }
    }

    /**
     * Get access history for a shareable link
     */
    public async getLinkAccessHistory(linkId: string): Promise<ShareableLinkResult<ShareableLinkAccess[]>> {
        try {
            const accesses = this.accessCache.get(linkId) || [];

            return {
                success: true,
                data: accesses
            };

        } catch (error) {
            console.error('Error getting link access history:', error);
            return {
                success: false,
                error: 'Failed to get access history',
                code: 'ACCESS_HISTORY_ERROR'
            };
        }
    }

    /**
     * Generate a public URL for a shareable link
     */
    public generateShareableUrl(linkId: string): string {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return `${baseUrl}/canvas/shared/${linkId}`;
    }

    /**
     * Clean up expired links
     */
    public async cleanupExpiredLinks(): Promise<number> {
        let cleanedCount = 0;

        try {
            const now = Date.now();

            for (const [linkId, link] of this.linkCache.entries()) {
                if (!this.isLinkValid(link)) {
                    this.linkCache.delete(linkId);
                    this.accessCache.delete(linkId);
                    cleanedCount++;
                }
            }

            console.log(`Cleaned up ${cleanedCount} expired shareable links`);

        } catch (error) {
            console.error('Error cleaning up expired links:', error);
        }

        return cleanedCount;
    }

    /**
     * Get link analytics
     */
    public async getLinkAnalytics(linkId: string): Promise<ShareableLinkResult<{
        totalAccesses: number;
        uniqueAccessors: number;
        recentAccesses: ShareableLinkAccess[];
        topReferrers: Array<{ userAgent: string; count: number }>;
    }>> {
        try {
            const accesses = this.accessCache.get(linkId) || [];
            const uniqueAccessors = new Set();
            const userAgentCounts = new Map<string, number>();

            accesses.forEach(access => {
                if (access.accessorId) {
                    uniqueAccessors.add(access.accessorId);
                } else if (access.accessorEmail) {
                    uniqueAccessors.add(access.accessorEmail);
                } else {
                    uniqueAccessors.add(access.ipAddress || 'unknown');
                }

                if (access.userAgent) {
                    userAgentCounts.set(access.userAgent, (userAgentCounts.get(access.userAgent) || 0) + 1);
                }
            });

            const topReferrers = Array.from(userAgentCounts.entries())
                .map(([userAgent, count]) => ({ userAgent, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            const recentAccesses = accesses
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 20);

            return {
                success: true,
                data: {
                    totalAccesses: accesses.length,
                    uniqueAccessors: uniqueAccessors.size,
                    recentAccesses,
                    topReferrers
                }
            };

        } catch (error) {
            console.error('Error getting link analytics:', error);
            return {
                success: false,
                error: 'Failed to get link analytics',
                code: 'ANALYTICS_ERROR'
            };
        }
    }

    /**
     * Check if a link is valid (not expired, still active)
     */
    private isLinkValid(link: ShareableLink): boolean {
        if (!link.isActive) {
            return false;
        }

        if (link.expiresAt && link.expiresAt < Date.now()) {
            return false;
        }

        if (link.maxAccess && link.accessCount >= link.maxAccess) {
            return false;
        }

        return true;
    }

    /**
     * Clear all caches (useful for testing)
     */
    public clearCaches(): void {
        this.linkCache.clear();
        this.accessCache.clear();
    }

    /**
     * Get service statistics
     */
    public getServiceStats(): {
        activeLinks: number;
        totalAccesses: number;
        cacheSize: number;
    } {
        let totalAccesses = 0;
        for (const accesses of this.accessCache.values()) {
            totalAccesses += accesses.length;
        }

        return {
            activeLinks: this.linkCache.size,
            totalAccesses,
            cacheSize: this.linkCache.size + this.accessCache.size
        };
    }
}
