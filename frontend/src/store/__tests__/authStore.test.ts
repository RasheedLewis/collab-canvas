import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';
import authService from '../../services/authService';

// Mock the auth service
vi.mock('../../services/authService', () => ({
    default: {
        signInWithGoogle: vi.fn(),
        signInWithEmail: vi.fn(),
        signUpWithEmail: vi.fn(),
        signOutUser: vi.fn(),
        updateUserProfile: vi.fn(),
        getUserProfile: vi.fn(),
        onAuthStateChange: vi.fn(() => vi.fn()), // Return unsubscribe function
    },
}));

describe('Auth Store Tests', () => {
    beforeEach(() => {
        // Reset store state before each test
        useAuthStore.setState({
            user: null,
            userProfile: null,
            loading: false,
            error: null,
            isInitialized: false,
        });

        vi.clearAllMocks();
    });

    describe('Store State Management', () => {
        test('should have initial state', () => {
            const state = useAuthStore.getState();

            expect(state.user).toBeNull();
            expect(state.userProfile).toBeNull();
            expect(state.loading).toBe(false);
            expect(state.error).toBeNull();
            expect(state.isInitialized).toBe(false);
        });

        test('should update user state', () => {
            const mockUser = {
                uid: 'test-uid',
                email: 'test@example.com',
                displayName: 'Test User',
            } as any;

            const { setUser } = useAuthStore.getState();
            setUser(mockUser);

            const state = useAuthStore.getState();
            expect(state.user).toEqual(mockUser);
        });

        test('should update loading state', () => {
            const { setLoading } = useAuthStore.getState();
            setLoading(true);

            const state = useAuthStore.getState();
            expect(state.loading).toBe(true);
        });

        test('should update error state', () => {
            const errorMessage = 'Test error';
            const { setError } = useAuthStore.getState();
            setError(errorMessage);

            const state = useAuthStore.getState();
            expect(state.error).toBe(errorMessage);
        });

        test('should clear error', () => {
            const { setError, clearError } = useAuthStore.getState();

            // Set error first
            setError('Test error');
            expect(useAuthStore.getState().error).toBe('Test error');

            // Clear error
            clearError();
            expect(useAuthStore.getState().error).toBeNull();
        });
    });

    describe('Authentication Actions', () => {
        test('should handle successful Google sign-in', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: 'test@example.com',
                displayName: 'Test User',
            };

            const mockProfile = {
                uid: 'test-uid',
                email: 'test@example.com',
                displayName: 'Test User',
                avatarColor: '#FF6B6B',
                createdAt: new Date(),
                lastLogin: new Date(),
            };

            // Mock successful auth service calls
            vi.mocked(authService).signInWithGoogle.mockResolvedValueOnce({
                success: true,
                user: mockUser,
            });
            vi.mocked(authService).getUserProfile.mockResolvedValueOnce(mockProfile);

            const { signInWithGoogle } = useAuthStore.getState();
            const result = await signInWithGoogle();

            expect(result.success).toBe(true);
            expect(useAuthStore.getState().user).toEqual(mockUser);
            expect(useAuthStore.getState().userProfile).toEqual(mockProfile);
            expect(useAuthStore.getState().error).toBeNull();
        });

        test('should handle failed Google sign-in', async () => {
            const errorMessage = 'Google sign-in failed';

            // Mock failed auth service call
            vi.mocked(authService).signInWithGoogle.mockResolvedValueOnce({
                success: false,
                error: errorMessage,
            });

            const { signInWithGoogle } = useAuthStore.getState();
            const result = await signInWithGoogle();

            expect(result.success).toBe(false);
            expect(result.error).toBe(errorMessage);
            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().error).toBe(errorMessage);
        });

        test('should handle successful email sign-in', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: 'test@example.com',
                displayName: 'Test User',
            };

            const mockProfile = {
                uid: 'test-uid',
                email: 'test@example.com',
                displayName: 'Test User',
                avatarColor: '#FF6B6B',
                createdAt: new Date(),
                lastLogin: new Date(),
            };

            // Mock successful auth service calls
            vi.mocked(authService).signInWithEmail.mockResolvedValueOnce({
                success: true,
                user: mockUser,
            });
            vi.mocked(authService).getUserProfile.mockResolvedValueOnce(mockProfile);

            const { signInWithEmail } = useAuthStore.getState();
            const result = await signInWithEmail('test@example.com', 'password123');

            expect(result.success).toBe(true);
            expect(useAuthStore.getState().user).toEqual(mockUser);
            expect(useAuthStore.getState().userProfile).toEqual(mockProfile);
            expect(useAuthStore.getState().error).toBeNull();
        });

        test('should handle successful email sign-up', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: 'test@example.com',
                displayName: 'New User',
            };

            const mockProfile = {
                uid: 'test-uid',
                email: 'test@example.com',
                displayName: 'New User',
                avatarColor: '#FF6B6B',
                createdAt: new Date(),
                lastLogin: new Date(),
            };

            // Mock successful auth service calls
            vi.mocked(authService).signUpWithEmail.mockResolvedValueOnce({
                success: true,
                user: mockUser,
            });
            vi.mocked(authService).getUserProfile.mockResolvedValueOnce(mockProfile);

            const { signUpWithEmail } = useAuthStore.getState();
            const result = await signUpWithEmail('test@example.com', 'password123', 'New User');

            expect(result.success).toBe(true);
            expect(useAuthStore.getState().user).toEqual(mockUser);
            expect(useAuthStore.getState().userProfile).toEqual(mockProfile);
            expect(useAuthStore.getState().error).toBeNull();
        });

        test('should handle successful sign-out', async () => {
            // Set initial user state
            const mockUser = { uid: 'test-uid', email: 'test@example.com' };
            const { setUser, setUserProfile } = useAuthStore.getState();

            setUser(mockUser as any);
            setUserProfile({} as any);

            // Mock successful sign-out
            vi.mocked(authService).signOutUser.mockResolvedValueOnce({
                success: true,
            });

            const { signOut } = useAuthStore.getState();
            const result = await signOut();

            expect(result.success).toBe(true);
            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().userProfile).toBeNull();
            expect(useAuthStore.getState().error).toBeNull();
        });

        test('should handle profile update', async () => {
            const mockUser = { uid: 'test-uid', email: 'test@example.com' };
            const updatedProfile = {
                uid: 'test-uid',
                email: 'test@example.com',
                displayName: 'Updated Name',
                avatarColor: '#00FF00',
                createdAt: new Date(),
                lastLogin: new Date(),
            };

            // Set initial user
            const { setUser } = useAuthStore.getState();
            setUser(mockUser as any);

            // Mock successful profile update
            vi.mocked(authService).updateUserProfile.mockResolvedValueOnce(undefined);
            vi.mocked(authService).getUserProfile.mockResolvedValueOnce(updatedProfile);

            const { updateUserProfile } = useAuthStore.getState();
            await updateUserProfile({
                displayName: 'Updated Name',
                avatarColor: '#00FF00',
            });

            expect(useAuthStore.getState().userProfile).toEqual(updatedProfile);
            expect(useAuthStore.getState().error).toBeNull();
        });

        test('should handle authentication errors gracefully', async () => {
            // Mock auth service to throw an error
            vi.mocked(authService).signInWithGoogle.mockRejectedValueOnce(
                new Error('Network error')
            );

            const { signInWithGoogle } = useAuthStore.getState();
            const result = await signInWithGoogle();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Google sign-in failed');
            expect(useAuthStore.getState().error).toBe('Google sign-in failed');
            expect(useAuthStore.getState().user).toBeNull();
        });

        test('should handle profile update errors', async () => {
            const mockUser = { uid: 'test-uid', email: 'test@example.com' };

            // Set initial user
            const { setUser } = useAuthStore.getState();
            setUser(mockUser as any);

            // Mock profile update to throw an error
            vi.mocked(authService).updateUserProfile.mockRejectedValueOnce(
                new Error('Update failed')
            );

            const { updateUserProfile } = useAuthStore.getState();

            await expect(updateUserProfile({
                displayName: 'New Name',
            })).rejects.toThrow();

            expect(useAuthStore.getState().error).toBe('Failed to update profile');
        });
    });

    describe('Store Persistence and Initialization', () => {
        test('should handle initialization', async () => {
            const mockUnsubscribe = vi.fn();
            vi.mocked(authService).onAuthStateChange.mockReturnValueOnce(mockUnsubscribe);

            const { initialize } = useAuthStore.getState();
            await initialize();

            expect(vi.mocked(authService).onAuthStateChange).toHaveBeenCalledTimes(1);
        });

        test('should refresh user profile', async () => {
            const mockUser = { uid: 'test-uid', email: 'test@example.com' };
            const mockProfile = {
                uid: 'test-uid',
                displayName: 'Refreshed User',
                avatarColor: '#BLUE',
            };

            // Set initial user
            const { setUser } = useAuthStore.getState();
            setUser(mockUser as any);

            // Mock profile refresh
            vi.mocked(authService).getUserProfile.mockResolvedValueOnce(mockProfile);

            const { refreshUserProfile } = useAuthStore.getState();
            await refreshUserProfile();

            expect(useAuthStore.getState().userProfile).toEqual(mockProfile);
        });

        test('should handle profile refresh without user', async () => {
            // No user set
            const { refreshUserProfile } = useAuthStore.getState();
            await refreshUserProfile();

            // Should not call getUserProfile
            expect(vi.mocked(authService).getUserProfile).not.toHaveBeenCalled();
        });
    });

    describe('Loading States', () => {
        test('should set loading during authentication', async () => {
            let loadingState = false;

            // Mock auth service with delay to check loading state
            vi.mocked(authService).signInWithGoogle.mockImplementationOnce(async () => {
                // Check loading state during async operation
                loadingState = useAuthStore.getState().loading;
                return { success: true, user: {} };
            });

            const { signInWithGoogle } = useAuthStore.getState();
            await signInWithGoogle();

            // Loading should have been true during the operation
            expect(loadingState).toBe(true);
            // And should be false after completion
            expect(useAuthStore.getState().loading).toBe(false);
        });

        test('should set loading during profile update', async () => {
            const mockUser = { uid: 'test-uid', email: 'test@example.com' };
            const { setUser } = useAuthStore.getState();
            setUser(mockUser as any);

            let loadingState = false;

            // Mock auth service with delay to check loading state
            vi.mocked(authService).updateUserProfile.mockImplementationOnce(async () => {
                loadingState = useAuthStore.getState().loading;
                return;
            });

            vi.mocked(authService).getUserProfile.mockResolvedValueOnce({});

            const { updateUserProfile } = useAuthStore.getState();
            await updateUserProfile({ displayName: 'New Name' });

            expect(loadingState).toBe(true);
            expect(useAuthStore.getState().loading).toBe(false);
        });
    });
});