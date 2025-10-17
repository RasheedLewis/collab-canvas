import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';

interface EditProfileProps {
  onClose: () => void;
  className?: string;
}

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#A569BD'
];

const EditProfile: React.FC<EditProfileProps> = ({ onClose, className = '' }) => {
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
      
      // Auto-close after success
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
      
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
    onClose();
  };

  if (isLoading) {
    return (
      <div 
        className={className}
        style={{
          width: '400px',
          maxWidth: '90vw',
          minHeight: '680px', // Fixed height to match loaded state
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center', // Center content vertically
          gap: '16px',
          transition: 'all 0.3s ease' // Smooth transition
        }}
      >
        <div 
          style={{
            opacity: 1,
            animation: 'fadeIn 0.3s ease'
          }}
        >
          <div 
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(59, 130, 246, 0.3)',
              borderTop: '3px solid #3B82F6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}
          />
          <div 
            style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#6B7280',
              textAlign: 'center'
            }}
          >
            Loading profile...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={className}
      style={{
        width: '400px',
        maxWidth: '90vw',
        minHeight: '680px', // Fixed height for consistency
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)',
        padding: '24px',
        transition: 'all 0.3s ease' // Smooth transition
      }}
    >
      <div 
        style={{
          opacity: 1,
          animation: 'fadeIn 0.3s ease',
          width: '100%'
        }}
      >
        {/* Header */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}
        >
        <h2 
          style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#374151',
            margin: 0
          }}
        >
          Edit Profile
        </h2>
        <button
          onClick={handleCancel}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            color: '#9CA3AF',
            cursor: 'pointer',
            padding: '4px',
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
          ×
        </button>
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
            borderRadius: '8px',
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
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Current Avatar Preview */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            backgroundColor: 'rgba(249, 250, 251, 0.5)',
            borderRadius: '12px'
          }}
        >
          {user?.photoURL ? (
            /* User has profile picture */
            <img
              src={user.photoURL}
              alt="Profile picture"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: `3px solid ${formData.avatarColor}`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}
              onError={(e) => {
                // If image fails to load, hide it and show fallback
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}
          
          {/* Fallback avatar with colored background and initials */}
          <div 
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: formData.avatarColor,
              display: user?.photoURL ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: '700',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            {formData.displayName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
          </div>
          
          <div>
            <div 
              style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '4px'
              }}
            >
              Current Avatar
            </div>
            <div 
              style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151'
              }}
            >
              {formData.displayName || 'No display name'}
            </div>
            {user?.photoURL && (
              <div 
                style={{
                  fontSize: '11px',
                  color: '#9CA3AF',
                  marginTop: '2px'
                }}
              >
                Profile picture from {user?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'account'}
              </div>
            )}
          </div>
        </div>

        {/* Display Name Input */}
        <div>
          <label 
            htmlFor="displayName" 
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}
          >
            Display Name <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={formData.displayName}
            onChange={handleInputChange}
            placeholder="Enter your display name"
            disabled={isSaving}
            maxLength={50}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              backgroundColor: 'rgba(249, 250, 251, 0.8)',
              border: '1px solid rgba(209, 213, 219, 0.3)',
              borderRadius: '8px',
              outline: 'none',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.3)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
            }}
          />
          <div 
            style={{
              marginTop: '4px',
              fontSize: '11px',
              color: '#9CA3AF',
              textAlign: 'right'
            }}
          >
            {formData.displayName.length}/50 characters
          </div>
        </div>

        {/* Avatar Color Selection */}
        <div>
          <label 
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '12px'
            }}
          >
            Avatar Color
          </label>
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '12px',
              padding: '16px',
              backgroundColor: 'rgba(249, 250, 251, 0.5)',
              borderRadius: '12px'
            }}
          >
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorSelect(color)}
                disabled={isSaving}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: formData.avatarColor === color 
                    ? '3px solid rgba(59, 130, 246, 0.8)' 
                    : '2px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: formData.avatarColor === color 
                    ? '0 4px 16px rgba(59, 130, 246, 0.25), 0 0 0 2px rgba(59, 130, 246, 0.1)' 
                    : '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transform: formData.avatarColor === color ? 'scale(1.1)' : 'scale(1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  justifySelf: 'center'
                }}
                onMouseEnter={(e) => {
                  if (formData.avatarColor !== color) {
                    e.currentTarget.style.transform = 'scale(1.15)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (formData.avatarColor !== color) {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                  }
                }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <div 
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#9CA3AF',
              textAlign: 'center'
            }}
          >
            {user?.photoURL 
              ? 'Choose a color for your profile picture border' 
              : 'Choose a color for your avatar background'
            }
          </div>
        </div>

        {/* Action Buttons */}
        <div 
          style={{
            display: 'flex',
            gap: '12px',
            paddingTop: '8px'
          }}
        >
          <button
            type="submit"
            disabled={isSaving || !formData.displayName.trim()}
            style={{
              flex: 1,
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: isSaving || !formData.displayName.trim() 
                ? 'rgba(156, 163, 175, 0.6)' 
                : 'rgba(59, 130, 246, 0.9)',
              border: 'none',
              borderRadius: '8px',
              cursor: isSaving || !formData.displayName.trim() ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSaving && formData.displayName.trim()) {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving && formData.displayName.trim()) {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            style={{
              flex: 1,
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              backgroundColor: 'rgba(249, 250, 251, 0.8)',
              border: '1px solid rgba(209, 213, 219, 0.3)',
              borderRadius: '8px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.9)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* User Info */}
      <div 
        style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(209, 213, 219, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#9CA3AF'
        }}
      >
        <span>Email: {user?.email}</span>
        <span>Account: {user?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email'}</span>
      </div>
      </div>
    </div>
  );
};

export default EditProfile;
