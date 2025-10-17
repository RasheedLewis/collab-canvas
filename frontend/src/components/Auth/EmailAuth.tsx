import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface EmailAuthProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  mode?: 'signin' | 'signup';
  onToggleMode?: () => void;
  className?: string;
}

export default function EmailAuth({ 
  onSuccess, 
  onError, 
  disabled = false,
  mode = 'signin',
  onToggleMode,
  className = '' 
}: EmailAuthProps) {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (disabled || isLoading) return;

    // Basic validation
    if (!formData.email || !formData.password) {
      onError?.('Please fill in all required fields');
      return;
    }

    if (mode === 'signup' && !formData.displayName) {
      onError?.('Please enter a display name');
      return;
    }

    setIsLoading(true);
    
    try {
      let result;
      
      if (mode === 'signin') {
        result = await signInWithEmail(formData.email, formData.password);
      } else {
        result = await signUpWithEmail(formData.email, formData.password, formData.displayName);
      }
      
      if (result.success) {
        onSuccess?.();
        // Clear form on success
        setFormData({ email: '', password: '', displayName: '' });
      } else {
        onError?.(result.error || `${mode === 'signin' ? 'Sign in' : 'Sign up'} failed`);
      }
    } catch (error) {
      onError?.(`An unexpected error occurred during ${mode === 'signin' ? 'sign in' : 'sign up'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {mode === 'signup' && (
          <div>
            <label 
              htmlFor="displayName" 
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '6px'
              }}
            >
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleInputChange}
              disabled={disabled || isLoading}
              placeholder="Enter your display name"
              data-testid="displayname-input"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                backgroundColor: 'rgba(249, 250, 251, 0.8)',
                border: '1px solid rgba(209, 213, 219, 0.4)',
                borderRadius: '10px',
                outline: 'none',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease',
                opacity: disabled || isLoading ? 0.6 : 1,
                cursor: disabled || isLoading ? 'not-allowed' : 'text',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                if (!disabled && !isLoading) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
                e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.4)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
              }}
            />
          </div>
        )}
        
        <div>
          <label 
            htmlFor="email" 
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}
          >
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            disabled={disabled || isLoading}
            placeholder="Enter your email"
            data-testid="email-input"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              backgroundColor: 'rgba(249, 250, 251, 0.8)',
              border: '1px solid rgba(209, 213, 219, 0.4)',
              borderRadius: '10px',
              outline: 'none',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease',
              opacity: disabled || isLoading ? 0.6 : 1,
              cursor: disabled || isLoading ? 'not-allowed' : 'text',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              if (!disabled && !isLoading) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.4)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
            }}
          />
        </div>
        
        <div>
          <label 
            htmlFor="password" 
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            disabled={disabled || isLoading}
            placeholder="Enter your password"
            minLength={6}
            data-testid="password-input"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              backgroundColor: 'rgba(249, 250, 251, 0.8)',
              border: '1px solid rgba(209, 213, 219, 0.4)',
              borderRadius: '10px',
              outline: 'none',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease',
              opacity: disabled || isLoading ? 0.6 : 1,
              cursor: disabled || isLoading ? 'not-allowed' : 'text',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              if (!disabled && !isLoading) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.4)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
            }}
          />
        </div>
        
        <button
          type="submit"
          disabled={disabled || isLoading}
          data-testid="login-button"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 20px',
            fontSize: '14px',
            fontWeight: '600',
            color: 'white',
            backgroundColor: disabled || isLoading ? 'rgba(156, 163, 175, 0.6)' : 'rgba(59, 130, 246, 0.9)',
            border: 'none',
            borderRadius: '10px',
            cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
            transition: 'all 0.2s ease',
            outline: 'none',
            marginTop: '8px'
          }}
          onMouseEnter={(e) => {
            if (!disabled && !isLoading) {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !isLoading) {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
            }
          }}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg 
                style={{ 
                  width: '16px', 
                  height: '16px', 
                  color: 'white',
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
              {mode === 'signin' ? 'Signing In...' : 'Creating Account...'}
            </span>
          ) : (
            mode === 'signin' ? 'Sign In' : 'Create Account'
          )}
        </button>
      </form>
      
      {onToggleMode && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onToggleMode}
            disabled={disabled || isLoading}
            style={{
              fontSize: '13px',
              color: '#3B82F6',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
              opacity: disabled || isLoading ? 0.5 : 1,
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!disabled && !isLoading) {
                e.currentTarget.style.color = '#2563EB';
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && !isLoading) {
                e.currentTarget.style.color = '#3B82F6';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {mode === 'signin' 
              ? "Don't have an account? Create one" 
              : 'Already have an account? Sign in'
            }
          </button>
        </div>
      )}
    </div>
  );
}
