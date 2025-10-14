import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist } from 'zustand/middleware';
import type { User } from 'firebase/auth';
import authService, { UserProfile } from '../services/authService';

// Auth store state interface
interface AuthState {
    // Current state
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    error: string | null;
    isInitialized: boolean;

    // Auth actions
    signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
    signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<{ success: boolean; error?: string }>;
    updateUserProfile: (updates: { displayName?: string; avatarColor?: string }) => Promise<void>;

    // Internal actions
    setUser: (user: User | null) => void;
    setUserProfile: (profile: UserProfile | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setInitialized: (initialized: boolean) => void;

    // Utility actions
    clearError: () => void;
    initialize: () => Promise<void>;
    refreshUserProfile: () => Promise<void>;
}

// Create the auth store
export const useAuthStore = create<AuthState>()(
    subscribeWithSelector(
        persist(
            (set, get) => ({
                // Initial state
                user: null,
                userProfile: null,
                loading: true,
                error: null,
                isInitialized: false,

                // Auth actions
                signInWithGoogle: async () => {
                    set({ loading: true, error: null });

                    try {
                        const result = await authService.signInWithGoogle();

                        if (result.success && result.user) {
                            set({ user: result.user });
                            // Load user profile
                            const profile = await authService.getUserProfile(result.user.uid);
                            set({ userProfile: profile });

                            console.log('Google sign-in successful:', result.user.email);
                            return { success: true };
                        } else {
                            set({ error: result.error || 'Google sign-in failed' });
                            console.error('Google sign-in failed:', result.error);
                            return { success: false, error: result.error };
                        }
                    } catch (error) {
                        const errorMessage = 'Google sign-in failed';
                        set({ error: errorMessage });
                        console.error('Google sign-in error:', error);
                        return { success: false, error: errorMessage };
                    } finally {
                        set({ loading: false });
                    }
                },

                signInWithEmail: async (email: string, password: string) => {
                    set({ loading: true, error: null });

                    try {
                        const result = await authService.signInWithEmail(email, password);

                        if (result.success && result.user) {
                            set({ user: result.user });
                            // Load user profile
                            const profile = await authService.getUserProfile(result.user.uid);
                            set({ userProfile: profile });

                            console.log('Email sign-in successful:', result.user.email);
                            return { success: true };
                        } else {
                            set({ error: result.error || 'Email sign-in failed' });
                            console.error('Email sign-in failed:', result.error);
                            return { success: false, error: result.error };
                        }
                    } catch (error) {
                        const errorMessage = 'Email sign-in failed';
                        set({ error: errorMessage });
                        console.error('Email sign-in error:', error);
                        return { success: false, error: errorMessage };
                    } finally {
                        set({ loading: false });
                    }
                },

                signUpWithEmail: async (email: string, password: string, displayName: string) => {
                    set({ loading: true, error: null });

                    try {
                        const result = await authService.signUpWithEmail(email, password, displayName);

                        if (result.success && result.user) {
                            set({ user: result.user });
                            // Load user profile (should be created by authService)
                            const profile = await authService.getUserProfile(result.user.uid);
                            set({ userProfile: profile });

                            console.log('Email sign-up successful:', result.user.email);
                            return { success: true };
                        } else {
                            set({ error: result.error || 'Email sign-up failed' });
                            console.error('Email sign-up failed:', result.error);
                            return { success: false, error: result.error };
                        }
                    } catch (error) {
                        const errorMessage = 'Email sign-up failed';
                        set({ error: errorMessage });
                        console.error('Email sign-up error:', error);
                        return { success: false, error: errorMessage };
                    } finally {
                        set({ loading: false });
                    }
                },

                signOut: async () => {
                    set({ loading: true, error: null });

                    try {
                        const result = await authService.signOutUser();

                        if (result.success) {
                            set({
                                user: null,
                                userProfile: null,
                                error: null
                            });
                            console.log('Sign-out successful');
                            return { success: true };
                        } else {
                            set({ error: result.error || 'Sign-out failed' });
                            console.error('Sign-out failed:', result.error);
                            return { success: false, error: result.error };
                        }
                    } catch (error) {
                        const errorMessage = 'Sign-out failed';
                        set({ error: errorMessage });
                        console.error('Sign-out error:', error);
                        return { success: false, error: errorMessage };
                    } finally {
                        set({ loading: false });
                    }
                },

                updateUserProfile: async (updates: { displayName?: string; avatarColor?: string }) => {
                    const { user } = get();
                    if (!user) {
                        throw new Error('No user logged in');
                    }

                    set({ loading: true, error: null });

                    try {
                        await authService.updateUserProfile(user.uid, updates);

                        // Refresh user profile
                        const updatedProfile = await authService.getUserProfile(user.uid);
                        set({ userProfile: updatedProfile });

                        console.log('Profile updated successfully');
                    } catch (error) {
                        const errorMessage = 'Failed to update profile';
                        set({ error: errorMessage });
                        console.error('Profile update error:', error);
                        throw error;
                    } finally {
                        set({ loading: false });
                    }
                },

                // Internal actions
                setUser: (user) => set({ user }),
                setUserProfile: (profile) => set({ userProfile: profile }),
                setLoading: (loading) => set({ loading }),
                setError: (error) => set({ error }),
                setInitialized: (initialized) => set({ isInitialized: initialized }),

                // Utility actions
                clearError: () => set({ error: null }),

                initialize: async () => {
                    if (get().isInitialized) return;

                    set({ loading: true });

                    try {
                        // Set up auth state listener
                        const unsubscribe = authService.onAuthStateChange(async (user) => {
                            set({ user });

                            if (user) {
                                try {
                                    // Load user profile when user signs in
                                    const profile = await authService.getUserProfile(user.uid);
                                    set({ userProfile: profile });
                                    console.log('User signed in:', user.email);
                                } catch (error) {
                                    console.error('Failed to load user profile:', error);
                                    set({ error: 'Failed to load user profile' });
                                }
                            } else {
                                set({ userProfile: null });
                                console.log('User signed out');
                            }

                            set({ loading: false, isInitialized: true });
                        });

                        // Store unsubscribe function for cleanup (you may want to handle this differently)
                        return unsubscribe;
                    } catch (error) {
                        console.error('Auth initialization error:', error);
                        set({ error: 'Authentication initialization failed', loading: false, isInitialized: true });
                    }
                },

                refreshUserProfile: async () => {
                    const { user } = get();
                    if (!user) return;

                    try {
                        const profile = await authService.getUserProfile(user.uid);
                        set({ userProfile: profile });
                    } catch (error) {
                        console.error('Failed to refresh user profile:', error);
                        set({ error: 'Failed to refresh profile' });
                    }
                },
            }),
            {
                name: 'auth-store', // Storage key
                partialize: (state) => ({
                    // Only persist specific parts of the state
                    user: state.user,
                    userProfile: state.userProfile,
                }),
                onRehydrateStorage: () => (state) => {
                    if (state) {
                        // Re-initialize after rehydration
                        state.initialize();
                    }
                },
            }
        )
    )
);

// Selector hooks for easier access to specific parts of the state
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthUserProfile = () => useAuthStore((state) => state.userProfile);
export const useAuthLoading = () => useAuthStore((state) => state.loading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthActions = () => useAuthStore((state) => ({
    signInWithGoogle: state.signInWithGoogle,
    signInWithEmail: state.signInWithEmail,
    signUpWithEmail: state.signUpWithEmail,
    signOut: state.signOut,
    updateUserProfile: state.updateUserProfile,
    clearError: state.clearError,
}));

// Initialize the store when module loads
useAuthStore.getState().initialize();

export default useAuthStore;
