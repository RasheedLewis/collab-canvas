import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';

interface UserProfileProps {
  onClose?: () => void;
  className?: string;
}

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#A569BD'
];

export default function UserProfile({ onClose, className = '' }: UserProfileProps) {
  const { user, updateUserProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    avatarColor: '#FF6B6B' // Default color
  });

  // Load user profile data
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const profile = await authService.getUserProfile(user.uid);
        if (profile) {
          setFormData({
            displayName: profile.displayName || '',
            avatarColor: profile.avatarColor || '#FF6B6B'
          });
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
        setError('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear messages when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handleColorSelect = (color: string) => {
    setFormData(prev => ({ ...prev, avatarColor: color }));
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || isSaving) return;

    // Validation
    if (!formData.displayName.trim()) {
      setError('Display name is required');
      return;
    }

    if (formData.displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters');
      return;
    }

    if (formData.displayName.trim().length > 50) {
      setError('Display name must be less than 50 characters');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateUserProfile({
        displayName: formData.displayName.trim(),
        avatarColor: formData.avatarColor
      });
      
      setSuccess('Profile updated successfully!');
      
      // Auto-close after success (optional)
      setTimeout(() => {
        setSuccess(null);
        onClose?.();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to update profile:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setFormData({
      displayName: user?.displayName || '',
      avatarColor: formData.avatarColor // Keep current color from loaded profile
    });
    setError(null);
    setSuccess(null);
    onClose?.();
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-20 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
        {onClose && (
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 text-xl font-semibold"
          >
            ×
          </button>
        )}
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* Current Avatar Preview */}
        <div className="flex items-center space-x-4">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
            style={{ backgroundColor: formData.avatarColor }}
          >
            {formData.displayName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm text-gray-600">Current Avatar</p>
            <p className="text-lg font-medium text-gray-800">
              {formData.displayName || 'No display name'}
            </p>
          </div>
        </div>

        {/* Display Name Input */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={formData.displayName}
            onChange={handleInputChange}
            placeholder="Enter your display name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSaving}
            maxLength={50}
          />
          <p className="mt-1 text-xs text-gray-500">
            {formData.displayName.length}/50 characters
          </p>
        </div>

        {/* Avatar Color Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Avatar Color
          </label>
          <div className="grid grid-cols-5 gap-3">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorSelect(color)}
                className={`w-12 h-12 rounded-full border-4 transition-all duration-200 hover:scale-110 ${
                  formData.avatarColor === color 
                    ? 'border-gray-800 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color }}
                disabled={isSaving}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Choose a color for your avatar background
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            disabled={isSaving || !formData.displayName.trim()}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          
          {onClose && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* User Info */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Email: {user?.email}</span>
          <span>Account: {user?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email'}</span>
        </div>
      </div>
    </div>
  );
}
