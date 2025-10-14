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
    <div className={`w-full ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleInputChange}
              disabled={disabled || isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your display name"
              data-testid="displayname-input"
            />
          </div>
        )}
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            disabled={disabled || isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Enter your email"
            data-testid="email-input"
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            disabled={disabled || isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Enter your password"
            minLength={6}
            data-testid="password-input"
          />
        </div>
        
        <button
          type="submit"
          disabled={disabled || isLoading}
          className="w-full flex items-center justify-center px-4 py-3 
                   bg-blue-600 hover:bg-blue-700 text-white font-medium 
                   rounded-lg shadow-sm focus:outline-none focus:ring-2 
                   focus:ring-blue-500 focus:ring-offset-2
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors duration-200"
          data-testid="login-button"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {mode === 'signin' ? 'Signing In...' : 'Creating Account...'}
            </span>
          ) : (
            mode === 'signin' ? 'Sign In' : 'Create Account'
          )}
        </button>
      </form>
      
      {onToggleMode && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onToggleMode}
            disabled={disabled || isLoading}
            className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
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
