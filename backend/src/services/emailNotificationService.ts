/**
 * Email Notification Service
 * 
 * Handles sending email notifications for canvas invitations, 
 * permission changes, and other collaboration events.
 */

import { PermissionRole } from '../../../shared/types';

export interface CollaboratorInviteEmail {
    inviteeEmail: string;
    inviterName: string;
    canvasName: string;
    canvasId: string;
    role: PermissionRole;
    message?: string;
    invitationId: string;
    expiresAt?: number;
}

export interface PermissionChangeEmail {
    userEmail: string;
    canvasName: string;
    canvasId: string;
    oldRole: PermissionRole;
    newRole: PermissionRole;
    changedBy: string;
}

export interface CanvasSharedEmail {
    userEmail: string;
    canvasName: string;
    canvasId: string;
    shareUrl: string;
    sharedBy: string;
    role: PermissionRole;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
    code?: string;
}

/**
 * Email Notification Service - Singleton
 * 
 * In production, this would integrate with services like:
 * - SendGrid
 * - AWS SES
 * - Mailgun
 * - Nodemailer with SMTP
 */
export class EmailNotificationService {
    private static instance: EmailNotificationService;

    private constructor() { }

    public static getInstance(): EmailNotificationService {
        if (!EmailNotificationService.instance) {
            EmailNotificationService.instance = new EmailNotificationService();
        }
        return EmailNotificationService.instance;
    }

    /**
     * Send collaborator invitation email
     */
    public async sendCollaboratorInvite(invite: CollaboratorInviteEmail): Promise<EmailResult> {
        try {
            // In production, this would use a real email service
            console.log('📧 Sending collaborator invite email:', {
                to: invite.inviteeEmail,
                from: 'noreply@collabcanvas.com',
                subject: `${invite.inviterName} invited you to collaborate on "${invite.canvasName}"`,
                template: 'collaborator-invite',
                data: invite
            });

            // Generate invitation URL
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const inviteUrl = `${baseUrl}/invite/${invite.invitationId}`;

            // Mock email content
            const emailContent = this.generateCollaboratorInviteHTML(invite, inviteUrl);

            // Log the email for development
            console.log('Email Content:', emailContent);

            // In production, send actual email here
            // const result = await emailProvider.send({
            //     to: invite.inviteeEmail,
            //     from: 'noreply@collabcanvas.com',
            //     subject: `${invite.inviterName} invited you to collaborate on "${invite.canvasName}"`,
            //     html: emailContent
            // });

            return {
                success: true,
                messageId: `mock-${Date.now()}`,
            };

        } catch (error) {
            console.error('Error sending collaborator invite email:', error);
            return {
                success: false,
                error: 'Failed to send invitation email',
                code: 'EMAIL_SEND_ERROR'
            };
        }
    }

    /**
     * Send permission change notification
     */
    public async sendPermissionChangeNotification(change: PermissionChangeEmail): Promise<EmailResult> {
        try {
            console.log('📧 Sending permission change email:', {
                to: change.userEmail,
                from: 'noreply@collabcanvas.com',
                subject: `Your role on "${change.canvasName}" has been updated`,
                template: 'permission-change',
                data: change
            });

            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const canvasUrl = `${baseUrl}/canvas/${change.canvasId}`;

            const emailContent = this.generatePermissionChangeHTML(change, canvasUrl);

            console.log('Email Content:', emailContent);

            return {
                success: true,
                messageId: `mock-${Date.now()}`,
            };

        } catch (error) {
            console.error('Error sending permission change email:', error);
            return {
                success: false,
                error: 'Failed to send permission change email',
                code: 'EMAIL_SEND_ERROR'
            };
        }
    }

    /**
     * Send canvas shared notification
     */
    public async sendCanvasSharedNotification(share: CanvasSharedEmail): Promise<EmailResult> {
        try {
            console.log('📧 Sending canvas shared email:', {
                to: share.userEmail,
                from: 'noreply@collabcanvas.com',
                subject: `${share.sharedBy} shared "${share.canvasName}" with you`,
                template: 'canvas-shared',
                data: share
            });

            const emailContent = this.generateCanvasSharedHTML(share);

            console.log('Email Content:', emailContent);

            return {
                success: true,
                messageId: `mock-${Date.now()}`,
            };

        } catch (error) {
            console.error('Error sending canvas shared email:', error);
            return {
                success: false,
                error: 'Failed to send canvas shared email',
                code: 'EMAIL_SEND_ERROR'
            };
        }
    }

    /**
     * Generate HTML content for collaborator invitation
     */
    private generateCollaboratorInviteHTML(invite: CollaboratorInviteEmail, inviteUrl: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Canvas Collaboration Invitation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { background: #6B7280; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; }
        .role-badge { background: #10B981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎨 CollabCanvas Invitation</h1>
    </div>
    
    <div class="content">
        <h2>You've been invited to collaborate!</h2>
        
        <p><strong>${invite.inviterName}</strong> has invited you to collaborate on the canvas <strong>"${invite.canvasName}"</strong> with <span class="role-badge">${invite.role.toUpperCase()}</span> access.</p>
        
        ${invite.message ? `<div style="background: #EBF4FF; border-left: 4px solid #3B82F6; padding: 16px; margin: 20px 0;">
            <p><em>"${invite.message}"</em></p>
        </div>` : ''}
        
        <p>Click the button below to accept the invitation and start collaborating:</p>
        
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
        
        <p><strong>Role Permissions:</strong></p>
        <ul>
            ${invite.role === 'editor' ? `
                <li>✅ View the canvas</li>
                <li>✅ Create and edit objects</li>
                <li>✅ Delete objects</li>
                <li>❌ Manage permissions</li>
                <li>❌ Delete canvas</li>
            ` : `
                <li>✅ View the canvas</li>
                <li>❌ Edit objects</li>
                <li>❌ Manage permissions</li>
                <li>❌ Delete canvas</li>
            `}
        </ul>
        
        ${invite.expiresAt ? `<p><small>⏰ This invitation expires on ${new Date(invite.expiresAt).toLocaleDateString()}.</small></p>` : ''}
        
        <p>If you don't have a CollabCanvas account, you'll be prompted to create one.</p>
    </div>
    
    <div class="footer">
        <p>This invitation was sent by ${invite.inviterName} through CollabCanvas.</p>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
</body>
</html>`;
    }

    /**
     * Generate HTML content for permission change notification
     */
    private generatePermissionChangeHTML(change: PermissionChangeEmail, canvasUrl: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Canvas Permission Updated</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { background: #6B7280; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; }
        .role-change { background: #FEF3C7; border: 1px solid #F59E0B; padding: 16px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔄 Permission Updated</h1>
    </div>
    
    <div class="content">
        <h2>Your canvas access has been updated</h2>
        
        <p>Your role on the canvas <strong>"${change.canvasName}"</strong> has been changed by <strong>${change.changedBy}</strong>.</p>
        
        <div class="role-change">
            <p><strong>Role Change:</strong></p>
            <p>From: <code>${change.oldRole.toUpperCase()}</code> → To: <code>${change.newRole.toUpperCase()}</code></p>
        </div>
        
        <a href="${canvasUrl}" class="button">View Canvas</a>
        
        <p><strong>Your new permissions:</strong></p>
        <ul>
            ${change.newRole === 'owner' ? `
                <li>✅ Full canvas control</li>
                <li>✅ Manage permissions</li>
                <li>✅ Delete canvas</li>
            ` : change.newRole === 'editor' ? `
                <li>✅ View the canvas</li>
                <li>✅ Create and edit objects</li>
                <li>✅ Delete objects</li>
                <li>❌ Manage permissions</li>
            ` : `
                <li>✅ View the canvas</li>
                <li>❌ Edit objects</li>
                <li>❌ Manage permissions</li>
            `}
        </ul>
    </div>
    
    <div class="footer">
        <p>This notification was sent automatically by CollabCanvas.</p>
    </div>
</body>
</html>`;
    }

    /**
     * Generate HTML content for canvas shared notification
     */
    private generateCanvasSharedHTML(share: CanvasSharedEmail): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Canvas Shared With You</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7C3AED; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .button { display: inline-block; background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { background: #6B7280; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔗 Canvas Shared</h1>
    </div>
    
    <div class="content">
        <h2>A canvas has been shared with you</h2>
        
        <p><strong>${share.sharedBy}</strong> has shared the canvas <strong>"${share.canvasName}"</strong> with you.</p>
        
        <p>You have been granted <strong>${share.role}</strong> access to this canvas.</p>
        
        <a href="${share.shareUrl}" class="button">Open Canvas</a>
        
        <p>Start collaborating and bring your ideas to life together!</p>
    </div>
    
    <div class="footer">
        <p>This canvas was shared through CollabCanvas.</p>
    </div>
</body>
</html>`;
    }

    /**
     * Send batch notifications
     */
    public async sendBatchNotifications(
        notifications: Array<{
            type: 'invite' | 'permission_change' | 'canvas_shared';
            data: CollaboratorInviteEmail | PermissionChangeEmail | CanvasSharedEmail;
        }>
    ): Promise<Array<{ success: boolean; error?: string }>> {
        const results: Array<{ success: boolean; error?: string }> = [];

        for (const notification of notifications) {
            try {
                let result: EmailResult;

                switch (notification.type) {
                    case 'invite':
                        result = await this.sendCollaboratorInvite(notification.data as CollaboratorInviteEmail);
                        break;
                    case 'permission_change':
                        result = await this.sendPermissionChangeNotification(notification.data as PermissionChangeEmail);
                        break;
                    case 'canvas_shared':
                        result = await this.sendCanvasSharedNotification(notification.data as CanvasSharedEmail);
                        break;
                    default:
                        result = { success: false, error: 'Unknown notification type' };
                }

                results.push({ success: result.success, error: result.error });

                // Small delay between emails to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return results;
    }
}
