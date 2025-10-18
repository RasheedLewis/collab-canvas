import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface GoogleAuthProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function GoogleAuth({ 
  onSuccess, 
  onError, 
  disabled = false
}: GoogleAuthProps) {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    
    try {
      const result = await signInWithGoogle();
      
      if (result.success) {
        onSuccess?.();
      } else {
        onError?.(result.error || 'Google sign-in failed');
      }
    } catch (error) {
      onError?.('An unexpected error occurred during Google sign-in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      disabled={disabled || isLoading}
      type="button"
      data-testid="google-auth-button"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '14px 20px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        border: '1px solid rgba(209, 213, 219, 0.4)',
        borderRadius: '12px',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.6 : 1,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        outline: 'none'
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)';
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }
      }}
      onFocus={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
        }
      }}
      onBlur={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.4)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }
      }}
    >
      {/* Google Logo SVG */}
      <svg
        style={{ width: '20px', height: '20px' }}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      
      {isLoading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg 
            style={{ 
              width: '16px', 
              height: '16px', 
              color: '#374151',
              animation: 'spin 1s linear infinite'
            }} 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              style={{ opacity: 0.25 }} 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              style={{ opacity: 0.75 }} 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Signing in with Google...
        </span>
      ) : (
        'Sign in with Google'
      )}
    </button>
  );
}
