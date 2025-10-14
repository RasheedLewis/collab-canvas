import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    onAuthStateChanged,
} from 'firebase/auth';
import type { User, NextOrObserver, AuthError } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';

// User profile interface
export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    avatarColor: string;
    createdAt: Date;
    lastLogin: Date;
}

// Authentication result interface
export interface AuthResult {
    success: boolean;
    user?: User;
    error?: string;
}

// Email/Password Authentication
export const signInWithEmail = async (
    email: string,
    password: string
): Promise<AuthResult> => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await updateLastLogin(result.user.uid);
        return { success: true, user: result.user };
    } catch (error) {
        const authError = error as AuthError;
        return { success: false, error: getAuthErrorMessage(authError.code) };
    }
};

export const signUpWithEmail = async (
    email: string,
    password: string,
    displayName: string
): Promise<AuthResult> => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);

        // Update user profile
        await updateProfile(result.user, { displayName });

        // Create user profile in Firestore
        await createUserProfile(result.user, displayName);

        return { success: true, user: result.user };
    } catch (error) {
        const authError = error as AuthError;
        return { success: false, error: getAuthErrorMessage(authError.code) };
    }
};

// Google OAuth Authentication
export const signInWithGoogle = async (): Promise<AuthResult> => {
    try {
        const result = await signInWithPopup(auth, googleProvider);

        // Check if user profile exists, create if not
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (!userDoc.exists()) {
            await createUserProfile(result.user, result.user.displayName || 'Anonymous User');
        } else {
            await updateLastLogin(result.user.uid);
        }

        return { success: true, user: result.user };
    } catch (error) {
        const authError = error as AuthError;
        return { success: false, error: getAuthErrorMessage(authError.code) };
    }
};

// Sign out
export const signOutUser = async (): Promise<AuthResult> => {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        const authError = error as AuthError;
        return { success: false, error: authError.message };
    }
};

// User profile management
export const createUserProfile = async (
    user: User,
    displayName: string,
    avatarColor?: string
): Promise<void> => {
    const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName,
        photoURL: user.photoURL,
        avatarColor: avatarColor || generateRandomAvatarColor(),
        createdAt: new Date(),
        lastLogin: new Date(),
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
};

export const updateUserProfile = async (
    uid: string,
    updates: Partial<Pick<UserProfile, 'displayName' | 'avatarColor'>>
): Promise<void> => {
    await updateDoc(doc(db, 'users', uid), updates);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return userDoc.data() as UserProfile;
        }
        return null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
};

// Update last login time
const updateLastLogin = async (uid: string): Promise<void> => {
    try {
        await updateDoc(doc(db, 'users', uid), {
            lastLogin: new Date(),
        });
    } catch (error) {
        console.error('Error updating last login:', error);
    }
};

// Generate random avatar color
const generateRandomAvatarColor = (): string => {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#A569BD'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
};

// Auth state observer
export const onAuthStateChange = (callback: NextOrObserver<User>) => {
    return onAuthStateChanged(auth, callback);
};

// Error message mapping
const getAuthErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'No account found with this email address.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/operation-not-allowed':
            return 'This sign-in method is not enabled.';
        case 'auth/popup-closed-by-user':
            return 'Sign-in popup was closed before completion.';
        case 'auth/popup-blocked':
            return 'Sign-in popup was blocked by the browser.';
        default:
            return 'An error occurred during authentication.';
    }
};

export default {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOutUser,
    createUserProfile,
    updateUserProfile,
    getUserProfile,
    onAuthStateChange,
};
