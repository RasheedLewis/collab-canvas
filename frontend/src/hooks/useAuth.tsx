import { useState, useEffect, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import authService from '../services/authService';

// Authentication context type
interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
    signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<{ success: boolean; error?: string }>;
    updateUserProfile: (updates: { displayName?: string; avatarColor?: string }) => Promise<void>;
}

// Create authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Authentication provider component
interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen for authentication state changes
        const unsubscribe = authService.onAuthStateChange((user) => {
            setUser(user);
            setLoading(false);

            if (user) {
                console.log('User signed in:', user.email);
            } else {
                console.log('User signed out');
            }
        });

        return () => unsubscribe();
    }, []);

    // Google OAuth sign in
    const signInWithGoogle = async () => {
        try {
            setLoading(true);
            const result = await authService.signInWithGoogle();

            if (result.success && result.user) {
                console.log('Google sign-in successful:', result.user.email);
                return { success: true };
            } else {
                console.error('Google sign-in failed:', result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Google sign-in error:', error);
            return { success: false, error: 'Google sign-in failed' };
        } finally {
            setLoading(false);
        }
    };

    // Email/password sign in
    const signInWithEmail = async (email: string, password: string) => {
        try {
            setLoading(true);
            const result = await authService.signInWithEmail(email, password);

            if (result.success && result.user) {
                console.log('Email sign-in successful:', result.user.email);
                return { success: true };
            } else {
                console.error('Email sign-in failed:', result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Email sign-in error:', error);
            return { success: false, error: 'Email sign-in failed' };
        } finally {
            setLoading(false);
        }
    };

    // Email/password sign up
    const signUpWithEmail = async (email: string, password: string, displayName: string) => {
        try {
            setLoading(true);
            const result = await authService.signUpWithEmail(email, password, displayName);

            if (result.success && result.user) {
                console.log('Email sign-up successful:', result.user.email);
                return { success: true };
            } else {
                console.error('Email sign-up failed:', result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Email sign-up error:', error);
            return { success: false, error: 'Email sign-up failed' };
        } finally {
            setLoading(false);
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            setLoading(true);
            const result = await authService.signOutUser();

            if (result.success) {
                console.log('Sign-out successful');
                return { success: true };
            } else {
                console.error('Sign-out failed:', result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Sign-out error:', error);
            return { success: false, error: 'Sign-out failed' };
        } finally {
            setLoading(false);
        }
    };

    // Update user profile
    const updateUserProfile = async (updates: { displayName?: string; avatarColor?: string }) => {
        if (!user) return;

        try {
            await authService.updateUserProfile(user.uid, updates);
            console.log('Profile updated successfully');
        } catch (error) {
            console.error('Profile update error:', error);
            throw error;
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateUserProfile,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// Custom hook to use authentication context
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
