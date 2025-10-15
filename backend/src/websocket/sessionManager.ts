/**
 * Session Manager for WebSocket Disconnect/Reconnect Handling
 * 
 * Manages client sessions to enable seamless reconnection and state restoration
 * after temporary disconnections.
 */

import { v4 as uuidv4 } from 'uuid';

export interface ClientSession {
    sessionId: string;
    clientId: string;
    created: number;
    lastSeen: number;
    reconnectToken: string;

    // Client state to restore on reconnect
    roomId?: string;
    userInfo?: {
        uid: string;
        email: string | null;
        name: string | null;
        picture: string | null;
        displayName?: string;
        avatarColor?: string;
    };

    // Connection tracking
    disconnectCount: number;
    reconnectAttempts: number;
    totalConnectedTime: number;

    // Disconnect info
    lastDisconnectReason?: string;
    lastDisconnectCode?: number;
    wasGraceful?: boolean;
}

export interface ReconnectResult {
    success: boolean;
    session?: ClientSession;
    error?: string;
}

export class SessionManager {
    private sessions: Map<string, ClientSession> = new Map(); // sessionId -> session
    private clientSessions: Map<string, string> = new Map(); // clientId -> sessionId
    private reconnectTokens: Map<string, string> = new Map(); // token -> sessionId
    private cleanupInterval: NodeJS.Timeout | null = null;

    // Configuration
    private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_RECONNECT_ATTEMPTS = 10;
    private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute

    constructor() {
        this.startCleanupTimer();
        console.log('📋 Session Manager initialized');
    }

    /**
     * Create a new session for a client
     */
    createSession(clientId: string): ClientSession {
        const sessionId = uuidv4();
        const reconnectToken = this.generateReconnectToken();

        const session: ClientSession = {
            sessionId,
            clientId,
            created: Date.now(),
            lastSeen: Date.now(),
            reconnectToken,
            disconnectCount: 0,
            reconnectAttempts: 0,
            totalConnectedTime: 0
        };

        // Clean up any existing session for this client
        this.removeClientSession(clientId);

        // Store session
        this.sessions.set(sessionId, session);
        this.clientSessions.set(clientId, sessionId);
        this.reconnectTokens.set(reconnectToken, sessionId);

        console.log(`📋 Created session ${sessionId} for client ${clientId}`);
        return session;
    }

    /**
     * Update session with client state
     */
    updateSession(clientId: string, updates: {
        roomId?: string;
        userInfo?: ClientSession['userInfo'];
    }): boolean {
        const sessionId = this.clientSessions.get(clientId);
        if (!sessionId) return false;

        const session = this.sessions.get(sessionId);
        if (!session) return false;

        // Update session data
        if (updates.roomId !== undefined) {
            session.roomId = updates.roomId;
        }
        if (updates.userInfo) {
            session.userInfo = updates.userInfo;
        }

        session.lastSeen = Date.now();
        return true;
    }

    /**
     * Handle client disconnect
     */
    handleDisconnect(clientId: string, disconnectCode?: number, disconnectReason?: string): void {
        const sessionId = this.clientSessions.get(clientId);
        if (!sessionId) return;

        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Update disconnect information
        session.lastDisconnectCode = disconnectCode;
        session.lastDisconnectReason = disconnectReason;
        session.wasGraceful = disconnectCode === 1000 || disconnectCode === 1001;
        session.disconnectCount++;
        session.lastSeen = Date.now();

        // Calculate connected time for this session
        const connectedTime = Date.now() - session.created;
        session.totalConnectedTime += connectedTime;

        console.log(`📋 Client ${clientId} disconnected (Code: ${disconnectCode}, Graceful: ${session.wasGraceful})`);

        // Remove from active client mapping but keep session for potential reconnect
        this.clientSessions.delete(clientId);
    }

    /**
     * Attempt to reconnect a client using reconnect token
     */
    attemptReconnect(newClientId: string, reconnectToken: string): ReconnectResult {
        if (!reconnectToken) {
            return {
                success: false,
                error: 'Reconnect token is required'
            };
        }

        const sessionId = this.reconnectTokens.get(reconnectToken);
        if (!sessionId) {
            return {
                success: false,
                error: 'Invalid or expired reconnect token'
            };
        }

        const session = this.sessions.get(sessionId);
        if (!session) {
            return {
                success: false,
                error: 'Session not found'
            };
        }

        // Check if session has expired
        const timeSinceDisconnect = Date.now() - session.lastSeen;
        if (timeSinceDisconnect > this.SESSION_TIMEOUT) {
            this.removeSession(sessionId);
            return {
                success: false,
                error: 'Session has expired'
            };
        }

        // Check reconnect attempts
        if (session.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            this.removeSession(sessionId);
            return {
                success: false,
                error: 'Maximum reconnection attempts exceeded'
            };
        }

        // Update session for reconnection
        session.clientId = newClientId;
        session.reconnectAttempts++;
        session.lastSeen = Date.now();

        // Generate new reconnect token
        const newToken = this.generateReconnectToken();
        this.reconnectTokens.delete(reconnectToken);
        this.reconnectTokens.set(newToken, sessionId);
        session.reconnectToken = newToken;

        // Update client mapping
        this.clientSessions.set(newClientId, sessionId);

        console.log(`🔄 Client ${newClientId} reconnected to session ${sessionId} (Attempt ${session.reconnectAttempts})`);

        return {
            success: true,
            session
        };
    }

    /**
     * Get session for a client
     */
    getSession(clientId: string): ClientSession | null {
        const sessionId = this.clientSessions.get(clientId);
        if (!sessionId) return null;

        return this.sessions.get(sessionId) || null;
    }

    /**
     * Check if a disconnect should trigger reconnect opportunity
     */
    shouldAllowReconnect(clientId: string): boolean {
        const session = this.getSession(clientId);
        if (!session) return false;

        return session.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS &&
            !session.wasGraceful;
    }

    /**
     * Generate a secure reconnect token
     */
    private generateReconnectToken(): string {
        return uuidv4() + '-' + Date.now().toString(36);
    }

    /**
     * Remove a client's session
     */
    private removeClientSession(clientId: string): void {
        const sessionId = this.clientSessions.get(clientId);
        if (sessionId) {
            this.removeSession(sessionId);
        }
    }

    /**
     * Remove a session completely
     */
    private removeSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.clientSessions.delete(session.clientId);
            this.reconnectTokens.delete(session.reconnectToken);
        }
        this.sessions.delete(sessionId);
    }

    /**
     * Start cleanup timer for expired sessions
     */
    private startCleanupTimer(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.CLEANUP_INTERVAL);
    }

    /**
     * Clean up expired sessions
     */
    private cleanupExpiredSessions(): void {
        const now = Date.now();
        const expiredSessions: string[] = [];

        this.sessions.forEach((session, sessionId) => {
            const timeSinceLastSeen = now - session.lastSeen;

            if (timeSinceLastSeen > this.SESSION_TIMEOUT) {
                expiredSessions.push(sessionId);
            }
        });

        if (expiredSessions.length > 0) {
            console.log(`🧹 Cleaning up ${expiredSessions.length} expired sessions`);
            expiredSessions.forEach(sessionId => {
                this.removeSession(sessionId);
            });
        }
    }

    /**
     * Get statistics about sessions
     */
    getStatistics(): {
        activeSessions: number;
        totalSessions: number;
        averageSessionDuration: number;
        totalReconnects: number;
        disconnectReasons: Record<string, number>;
    } {
        let totalDuration = 0;
        let totalReconnects = 0;
        const disconnectReasons: Record<string, number> = {};

        this.sessions.forEach(session => {
            totalDuration += session.totalConnectedTime;
            totalReconnects += session.reconnectAttempts;

            if (session.lastDisconnectReason) {
                disconnectReasons[session.lastDisconnectReason] =
                    (disconnectReasons[session.lastDisconnectReason] || 0) + 1;
            }
        });

        return {
            activeSessions: this.clientSessions.size,
            totalSessions: this.sessions.size,
            averageSessionDuration: this.sessions.size > 0 ? totalDuration / this.sessions.size : 0,
            totalReconnects,
            disconnectReasons
        };
    }

    /**
     * Force expire a session
     */
    expireSession(clientId: string): boolean {
        const sessionId = this.clientSessions.get(clientId);
        if (sessionId) {
            this.removeSession(sessionId);
            return true;
        }
        return false;
    }

    /**
     * Shutdown session manager
     */
    shutdown(): void {
        console.log('🛑 Shutting down Session Manager...');

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Clear all data
        this.sessions.clear();
        this.clientSessions.clear();
        this.reconnectTokens.clear();

        console.log('✅ Session Manager shutdown complete');
    }
}

export default SessionManager;
