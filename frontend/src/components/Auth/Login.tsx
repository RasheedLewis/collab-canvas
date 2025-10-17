import { useState } from 'react';
import GoogleAuth from './GoogleAuth';
import EmailAuth from './EmailAuth';

interface LoginProps {
  onLogin?: () => void;
  className?: string;
}

export default function Login({ onLogin, className = '' }: LoginProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleAuthSuccess = () => {
    setError('');
    setSuccess(authMode === 'signin' ? 'Successfully signed in!' : 'Account created successfully!');
    onLogin?.();
  };

  const handleAuthError = (errorMessage: string) => {
    setError(errorMessage);
    setSuccess('');
  };

  const toggleAuthMode = () => {
    setAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
    setError('');
    setSuccess('');
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div 
      className={className}
      style={{
        width: '100%',
        maxWidth: '400px',
        margin: '0 auto'
      }}
    >
      {/* App Header */}
      <div 
        style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}
      >
        <h1 
          style={{
            fontSize: '42px',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: '0 0 8px 0',
            letterSpacing: '-0.05em'
          }}
        >
          Collab Canvas
        </h1>
        <p 
          style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: 0,
            fontWeight: '500',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}
        >
          Real-time collaborative design platform
        </p>
      </div>

      <div 
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)',
          padding: '32px'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#374151',
              marginBottom: '8px',
              letterSpacing: '-0.025em'
            }}
          >
            {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p 
            style={{
              fontSize: '14px',
              color: '#6B7280',
              margin: 0
            }}
          >
            {authMode === 'signin' 
              ? 'Sign in to your CollabCanvas account' 
              : 'Join CollabCanvas to start collaborating'
            }
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div 
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#065F46',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div 
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#991B1B',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {error}
          </div>
        )}

        {/* Google OAuth */}
        <div style={{ marginBottom: '24px' }}>
          <GoogleAuth
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
          />
        </div>

        {/* Divider */}
        <div 
          style={{
            position: 'relative',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <div 
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'rgba(209, 213, 219, 0.4)'
            }}
          />
          <span 
            style={{
              padding: '0 16px',
              fontSize: '13px',
              color: '#9CA3AF',
              fontWeight: '500',
              backgroundColor: 'rgba(255, 255, 255, 0.8)'
            }}
          >
            Or continue with email
          </span>
          <div 
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'rgba(209, 213, 219, 0.4)'
            }}
          />
        </div>

        {/* Email/Password Auth */}
        <EmailAuth
          mode={authMode}
          onSuccess={handleAuthSuccess}
          onError={handleAuthError}
          onToggleMode={toggleAuthMode}
        />

        {/* Clear Messages */}
        {(error || success) && (
          <button
            onClick={clearMessages}
            style={{
              marginTop: '16px',
              fontSize: '13px',
              color: '#9CA3AF',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#6B7280';
              e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9CA3AF';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Clear messages
          </button>
        )}
      </div>

      {/* Footer */}
      <div 
        style={{
          textAlign: 'center',
          marginTop: '24px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.8)'
        }}
      >
        <p style={{ margin: 0 }}>
          By signing {authMode === 'signin' ? 'in' : 'up'}, you agree to our{' '}
          <a 
            href="#" 
            style={{
              color: 'rgba(255, 255, 255, 0.95)',
              textDecoration: 'underline',
              transition: 'color 0.2s ease',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
            }}
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a 
            href="#" 
            style={{
              color: 'rgba(255, 255, 255, 0.95)',
              textDecoration: 'underline',
              transition: 'color 0.2s ease',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
            }}
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
