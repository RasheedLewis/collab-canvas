import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './components/Auth/Login';
import UserProfile from './components/Auth/UserProfile';
import Canvas from './components/Canvas/Canvas';
import Toolbar from './components/Canvas/Toolbar';
import './App.css';

// Main application component (inside AuthProvider)
function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Login />
      </div>
    );
  }

  // User is authenticated - show main app with proper workspace container
  return (
    <div className="workspace-container">
      {/* Canvas fills the container */}
      <Canvas />

      {/* Toolbar positioned absolutely within container */}
      <Toolbar />

      {/* User Profile positioned absolutely within container */}
      <div className="user-profile-button">
        <div className="flex items-center space-x-3 bg-white rounded-full shadow-lg border border-gray-200 px-4 py-2">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt="Profile"
              className="h-8 w-8 rounded-full"
            />
          )}
          <div className="text-sm">
            <p className="text-gray-900 font-medium">
              {user.displayName || 'Anonymous User'}
            </p>
          </div>
          
          <button
            onClick={() => setShowProfile(true)}
            className="inline-flex items-center p-2 text-gray-600 hover:text-gray-800 
                     hover:bg-gray-100 rounded-full transition-colors duration-200"
            title="Edit Profile"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          <button
            onClick={() => signOut()}
            className="inline-flex items-center p-2 text-gray-600 hover:text-red-600 
                     hover:bg-red-50 rounded-full transition-colors duration-200"
            title="Sign Out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="max-w-md w-full max-h-[90vh] overflow-y-auto">
            <UserProfile 
              onClose={() => setShowProfile(false)}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Root App component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
