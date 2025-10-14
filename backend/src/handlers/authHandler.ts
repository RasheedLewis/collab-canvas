import { Request, Response, NextFunction } from 'express';
import { verifyIdToken, getUserData, adminAuth } from '../config/firebase';

// Interface for authenticated request
export interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email: string | null;
        name: string | null;
        picture: string | null;
    };
}

// Middleware to verify Firebase ID token
export const verifyAuthToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No valid authorization token provided' });
            return;
        }

        const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        const verificationResult = await verifyIdToken(idToken);

        if (!verificationResult.success) {
            res.status(401).json({ error: verificationResult.error });
            return;
        }

        // Add user info to request
        req.user = {
            uid: verificationResult.uid!,
            email: verificationResult.email || null,
            name: verificationResult.name || null,
            picture: verificationResult.picture || null,
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
};

// Optional auth middleware (doesn't fail if no token)
export const optionalAuth = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.substring(7);
            const verificationResult = await verifyIdToken(idToken);

            if (verificationResult.success) {
                req.user = {
                    uid: verificationResult.uid!,
                    email: verificationResult.email || null,
                    name: verificationResult.name || null,
                    picture: verificationResult.picture || null,
                };
            }
        }

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next(); // Continue even if auth fails
    }
};

// Route handlers for authentication
export const getCurrentUser = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const userData = await getUserData(req.user.uid);

        if (!userData.success) {
            res.status(404).json({ error: userData.error });
            return;
        }

        res.json({
            success: true,
            user: userData.user,
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Refresh user token (mainly for debugging)
export const refreshToken = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        // Create custom token (if needed for special cases)
        const customToken = await adminAuth.createCustomToken(req.user.uid);

        res.json({
            success: true,
            customToken,
            message: 'Token refreshed successfully',
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete user account
export const deleteUser = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        // Delete user from Firebase Auth
        await adminAuth.deleteUser(req.user.uid);

        res.json({
            success: true,
            message: 'User account deleted successfully',
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Generate user session info for WebSocket connections
export const generateSessionInfo = (user: AuthenticatedRequest['user']) => {
    if (!user) return null;

    return {
        uid: user.uid,
        email: user.email,
        name: user.name || 'Anonymous User',
        picture: user.picture,
        joinedAt: new Date().toISOString(),
    };
};

export default {
    verifyAuthToken,
    optionalAuth,
    getCurrentUser,
    refreshToken,
    deleteUser,
    generateSessionInfo,
};
