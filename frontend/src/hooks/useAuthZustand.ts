import { useEffect } from 'react';
import { useAuthStore, useAuthUser, useAuthUserProfile, useAuthLoading, useAuthError, useAuthActions } from '../store/authStore';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../services/authService';

/**
 * Alternative authentication hook using Zustand store
 * 
 * This hook provides the same interface as the React Context useAuth hook
 * but uses Zustand for state management instead.
 * 
 * Benefits of Zustand approach:
 * - State persistence across page refreshes
 * - Better performance (no re-renders unless subscribed state changes)
 * - DevTools support
 * - Simpler state management (no providers needed)
 * - Middleware support (persist, devtools, subscriptions)
 */

interface UseAuthZustandReturn {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    error: string | null;
    isInitialized: boolean;
    signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
    signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<{ success: boolean; error?: string }>;
    updateUserProfile: (updates: { displayName?: string; avatarColor?: string }) => Promise<void>;
    clearError: () => void;
    refreshUserProfile: () => Promise<void>;
}

export function useAuthZustand(): UseAuthZustandReturn {
    // Subscribe to specific pieces of state
    const user = useAuthUser();
    const userProfile = useAuthUserProfile();
    const loading = useAuthLoading();
    const error = useAuthError();
    const isInitialized = useAuthStore((state) => state.isInitialized);

    // Get actions
    const actions = useAuthActions();
    const refreshUserProfile = useAuthStore((state) => state.refreshUserProfile);

    // Initialize store on mount (redundant but ensures initialization)
    useEffect(() => {
        const initialize = useAuthStore.getState().initialize;
        initialize();
    }, []);

    return {
        user,
        userProfile,
        loading,
        error,
        isInitialized,
        ...actions,
        refreshUserProfile,
    };
}

// Individual selector hooks for fine-grained subscriptions
// These prevent unnecessary re-renders by only subscribing to specific state slices

export const useAuthenticationState = () => ({
    user: useAuthUser(),
    loading: useAuthLoading(),
    error: useAuthError(),
    isInitialized: useAuthStore((state) => state.isInitialized),
});

export const useUserProfile = () => ({
    userProfile: useAuthUserProfile(),
    refreshUserProfile: useAuthStore((state) => state.refreshUserProfile),
    updateUserProfile: useAuthStore((state) => state.updateUserProfile),
});

export const useAuthenticationActions = () => useAuthActions();

// Utility hooks for common use cases
export const useIsAuthenticated = () => {
    const user = useAuthUser();
    const isInitialized = useAuthStore((state) => state.isInitialized);
    return { isAuthenticated: !!user, isInitialized };
};

export const useAuthStatus = () => {
    const user = useAuthUser();
    const loading = useAuthLoading();
    const error = useAuthError();
    const isInitialized = useAuthStore((state) => state.isInitialized);

    return {
        isAuthenticated: !!user,
        isLoading: loading,
        hasError: !!error,
        isInitialized,
        error,
    };
};

export default useAuthZustand;
