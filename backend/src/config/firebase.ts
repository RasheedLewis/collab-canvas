import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Firebase Admin configuration
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'collab-canvas-demo',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || undefined,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || undefined,
};

// Initialize Firebase Admin SDK (only if not already initialized)
let app;
if (!getApps().length) {
    if (firebaseConfig.privateKey && firebaseConfig.clientEmail) {
        // Production: Use service account credentials
        app = initializeApp({
            credential: cert({
                projectId: firebaseConfig.projectId,
                privateKey: firebaseConfig.privateKey,
                clientEmail: firebaseConfig.clientEmail,
            }),
            projectId: firebaseConfig.projectId,
        });
        console.log('🔥 Firebase Admin initialized with service account credentials');
    } else {
        // Development: Use default credentials (requires Firebase CLI login)
        app = initializeApp({
            projectId: firebaseConfig.projectId,
        });
        console.log('🔥 Firebase Admin initialized with default credentials (development)');
    }
} else {
    app = getApps()[0];
}

// Get Firebase services
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

// Helper function to verify Firebase ID tokens
export async function verifyIdToken(idToken: string) {
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        return {
            success: true,
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name,
            picture: decodedToken.picture,
        };
    } catch (error) {
        console.error('Error verifying ID token:', error);
        return {
            success: false,
            error: 'Invalid token',
        };
    }
}

// Helper function to get user data
export async function getUserData(uid: string) {
    try {
        const userRecord = await adminAuth.getUser(uid);
        return {
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                photoURL: userRecord.photoURL,
                emailVerified: userRecord.emailVerified,
            },
        };
    } catch (error) {
        console.error('Error getting user data:', error);
        return {
            success: false,
            error: 'User not found',
        };
    }
}

export default app;
