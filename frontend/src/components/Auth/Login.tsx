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
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <div className="bg-white shadow-lg rounded-lg p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-600">
            {authMode === 'signin' 
              ? 'Sign in to your CollabCanvas account' 
              : 'Join CollabCanvas to start collaborating'
            }
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Google OAuth */}
        <div className="mb-6">
          <GoogleAuth
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
            className="w-full"
          />
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with email</span>
          </div>
        </div>

        {/* Email/Password Auth */}
        <EmailAuth
          mode={authMode}
          onSuccess={handleAuthSuccess}
          onError={handleAuthError}
          onToggleMode={toggleAuthMode}
          className="w-full"
        />

        {/* Clear Messages */}
        {(error || success) && (
          <button
            onClick={clearMessages}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear messages
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="text-center mt-6 text-sm text-gray-600">
        <p>
          By signing {authMode === 'signin' ? 'in' : 'up'}, you agree to our{' '}
          <a href="#" className="text-blue-600 hover:text-blue-500 underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-blue-600 hover:text-blue-500 underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
