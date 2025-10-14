import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import GoogleAuth from '../GoogleAuth';
import EmailAuth from '../EmailAuth';
import UserProfile from '../UserProfile';
import authService from '../../../services/authService';

// Mock the auth service
vi.mock('../../../services/authService', () => ({
  default: {
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signOutUser: vi.fn(),
    updateUserProfile: vi.fn(),
    getUserProfile: vi.fn(),
    onAuthStateChange: vi.fn(() => vi.fn()), // Return unsubscribe function
    createUserProfile: vi.fn(),
  },
}));

// Mock the useAuth hook
const mockUseAuth = {
  user: null,
  userProfile: null,
  loading: false,
  error: null,
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signOut: vi.fn(),
  updateUserProfile: vi.fn(),
};

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock user object
const mockUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  emailVerified: true,
  providerData: [],
};

const mockProfile = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  avatarColor: '#FF6B6B',
  createdAt: new Date(),
  lastLogin: new Date(),
};

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock auth state
    mockUseAuth.user = null;
    mockUseAuth.userProfile = null;
    mockUseAuth.loading = false;
    mockUseAuth.error = null;
  });

  describe('Google OAuth Authentication', () => {
    test('should authenticate with Google OAuth successfully', async () => {
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      // Mock successful Google sign-in
      mockUseAuth.signInWithGoogle.mockResolvedValueOnce({
        success: true,
      });

      render(
        <GoogleAuth 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      const signInButton = screen.getByRole('button', { name: /sign in with google/i });
      expect(signInButton).toBeInTheDocument();

      await userEvent.click(signInButton);

      await waitFor(() => {
        expect(mockUseAuth.signInWithGoogle).toHaveBeenCalledTimes(1);
      });

      // Wait for success callback
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });

      expect(mockOnError).not.toHaveBeenCalled();
    });

    test('should handle Google OAuth authentication error', async () => {
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      // Mock Google sign-in error
      mockUseAuth.signInWithGoogle.mockResolvedValueOnce({
        success: false,
        error: 'Google sign-in failed',
      });

      render(
        <GoogleAuth 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      const signInButton = screen.getByRole('button', { name: /sign in with google/i });
      await userEvent.click(signInButton);

      await waitFor(() => {
        expect(mockUseAuth.signInWithGoogle).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Google sign-in failed');
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    test('should show loading state during Google authentication', async () => {
      const mockOnSuccess = vi.fn();
      
      // Mock loading state
      mockUseAuth.loading = true;

      render(
        <GoogleAuth 
          onSuccess={mockOnSuccess}
          onError={vi.fn()}
        />
      );

      const signInButton = screen.getByRole('button', { name: /signing in/i });
      expect(signInButton).toBeDisabled();
    });
  });

  describe('Email/Password Authentication', () => {
    test('should authenticate with email/password successfully', async () => {
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      // Mock successful email sign-in
      mockUseAuth.signInWithEmail.mockResolvedValueOnce({
        success: true,
      });

      render(
        <EmailAuth 
          mode="signin"
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      // Find form inputs
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const signInButton = screen.getByRole('button', { name: /sign in/i });

      // Fill in form
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');

      // Submit form
      await userEvent.click(signInButton);

      await waitFor(() => {
        expect(mockUseAuth.signInWithEmail).toHaveBeenCalledWith(
          'test@example.com',
          'password123'
        );
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });

      expect(mockOnError).not.toHaveBeenCalled();
    });

    test('should handle email signup successfully', async () => {
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      // Mock successful email signup
      mockUseAuth.signUpWithEmail.mockResolvedValueOnce({
        success: true,
      });

      render(
        <EmailAuth 
          mode="signup"
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      // Find form inputs
      const displayNameInput = screen.getByLabelText(/display name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const signUpButton = screen.getByRole('button', { name: /create account/i });

      // Fill in form
      await userEvent.type(displayNameInput, 'New User');
      await userEvent.type(emailInput, 'newuser@example.com');
      await userEvent.type(passwordInput, 'password123');

      expect(displayNameInput).toHaveValue('New User');
      expect(emailInput).toHaveValue('newuser@example.com');
      expect(passwordInput).toHaveValue('password123');

      // Submit form
      await userEvent.click(signUpButton);

      await waitFor(() => {
        expect(mockUseAuth.signUpWithEmail).toHaveBeenCalledWith(
          'newuser@example.com',
          'password123',
          'New User'
        );
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });

      expect(mockOnError).not.toHaveBeenCalled();
    });

    test('should validate required fields', async () => {
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      render(
        <EmailAuth 
          mode="signin"
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      // Try to submit without filling fields
      const signInButton = screen.getByRole('button', { name: /sign in/i });
      await userEvent.click(signInButton);

      // Should show validation error
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          'Please fill in all required fields'
        );
      });

      expect(mockUseAuth.signInWithEmail).not.toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    test('should toggle between signin and signup modes', async () => {
      let mode = 'signin';
      const mockToggleMode = vi.fn(() => {
        mode = mode === 'signin' ? 'signup' : 'signin';
      });

      const { rerender } = render(
        <EmailAuth 
          mode={mode as 'signin' | 'signup'}
          onSuccess={vi.fn()}
          onError={vi.fn()}
          onToggleMode={mockToggleMode}
        />
      );

      // Should start in signin mode
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();

      // Find and click the toggle link
      const toggleLink = screen.getByText(/don't have an account/i);
      await userEvent.click(toggleLink);

      expect(mockToggleMode).toHaveBeenCalledTimes(1);

      // Rerender with signup mode
      rerender(
        <EmailAuth 
          mode="signup"
          onSuccess={vi.fn()}
          onError={vi.fn()}
          onToggleMode={mockToggleMode}
        />
      );

      // Should now show signup mode
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });
  });

  describe('User Profile Management', () => {
    test('should create user profile with custom avatar color', async () => {
      // Set up authenticated user state
      mockUseAuth.user = mockUser as any;
      mockUseAuth.userProfile = mockProfile as any;
      mockUseAuth.updateUserProfile.mockResolvedValue(undefined);

      // Mock the getUserProfile service call
      vi.mocked(authService.getUserProfile).mockResolvedValue(mockProfile);

      render(<UserProfile onClose={vi.fn()} />);

      // Wait for profile to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      // Check if profile form is rendered
      const displayNameInput = screen.getByLabelText(/display name/i);
      expect(displayNameInput).toBeInTheDocument();

      // Change display name
      await userEvent.clear(displayNameInput);
      await userEvent.type(displayNameInput, 'CustomName');
      expect(displayNameInput).toHaveValue('CustomName');

      // Check if avatar colors are present
      const colorButtons = screen.getAllByRole('button');
      const colorButton = colorButtons.find(button => 
        button.getAttribute('aria-label')?.includes('Select color')
      );
      
      expect(colorButton).toBeInTheDocument();
      
      if (colorButton) {
        await userEvent.click(colorButton);
        
        // Color should be selected (visual feedback)
        expect(colorButton).toHaveClass('border-gray-800');
      }

      // Check if display name is updated in the preview
      expect(screen.getByText('CustomName')).toBeInTheDocument();
    });

    test('should validate display name requirements', async () => {
      // Set up authenticated user state
      mockUseAuth.user = mockUser as any;
      mockUseAuth.userProfile = mockProfile as any;

      // Mock the getUserProfile service call
      vi.mocked(authService.getUserProfile).mockResolvedValue(mockProfile);

      render(<UserProfile onClose={vi.fn()} />);

      // Wait for profile to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const displayNameInput = screen.getByLabelText(/display name/i);
      const saveButton = screen.getByRole('button', { name: /save changes/i });

      // Try to save with empty display name
      await userEvent.clear(displayNameInput);
      await userEvent.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/display name is required/i)).toBeInTheDocument();
      });

      // Try to save with too short display name
      await userEvent.type(displayNameInput, 'A');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/must be at least 2 characters/i)).toBeInTheDocument();
      });
    });

    test('should show character count for display name', async () => {
      // Set up authenticated user state
      mockUseAuth.user = mockUser as any;
      mockUseAuth.userProfile = mockProfile as any;

      // Mock the getUserProfile service call
      vi.mocked(authService.getUserProfile).mockResolvedValue(mockProfile);

      render(<UserProfile onClose={vi.fn()} />);

      // Wait for profile to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const displayNameInput = screen.getByLabelText(/display name/i);
      
      // Clear and type a name
      await userEvent.clear(displayNameInput);
      await userEvent.type(displayNameInput, 'TestName');

      // Should show character count
      expect(screen.getByText('8/50 characters')).toBeInTheDocument();
    });

    test('should handle profile update success', async () => {
      // Set up authenticated user state
      mockUseAuth.user = mockUser as any;
      mockUseAuth.userProfile = mockProfile as any;
      mockUseAuth.updateUserProfile.mockResolvedValue(undefined);

      // Mock the getUserProfile service call
      vi.mocked(authService.getUserProfile).mockResolvedValue(mockProfile);

      render(<UserProfile onClose={vi.fn()} />);

      // Wait for profile to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const displayNameInput = screen.getByLabelText(/display name/i);
      const saveButton = screen.getByRole('button', { name: /save changes/i });

      // Update display name
      await userEvent.clear(displayNameInput);
      await userEvent.type(displayNameInput, 'Updated Name');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUseAuth.updateUserProfile).toHaveBeenCalledWith({
          displayName: 'Updated Name',
          avatarColor: mockProfile.avatarColor,
        });
      });

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Component Integration', () => {
    test('should handle loading states correctly', () => {
      mockUseAuth.loading = true;

      render(
        <GoogleAuth 
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/signing in/i);
    });

    test('should handle error states correctly', () => {
      const mockOnError = vi.fn();
      mockUseAuth.signInWithGoogle.mockResolvedValueOnce({
        success: false,
        error: 'Authentication failed',
      });

      render(
        <GoogleAuth 
          onSuccess={vi.fn()}
          onError={mockOnError}
        />
      );

      const button = screen.getByRole('button', { name: /sign in with google/i });
      fireEvent.click(button);

      // The component should call onError when authentication fails
      waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Authentication failed');
      });
    });

    test('should disable components when disabled prop is passed', () => {
      render(
        <GoogleAuth 
          onSuccess={vi.fn()}
          onError={vi.fn()}
          disabled={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });
});