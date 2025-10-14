import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './components/Auth/Login';
import UserProfile from './components/Auth/UserProfile';
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

  // User is authenticated - show main app
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                CollabCanvas
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
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
                  <p className="text-gray-500">{user.email}</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowProfile(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 
                         text-sm leading-4 font-medium rounded-md text-gray-700 
                         bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 
                         focus:ring-offset-2 focus:ring-blue-500"
              >
                Edit Profile
              </button>
              
              <button
                onClick={() => signOut()}
                className="inline-flex items-center px-3 py-2 border border-transparent 
                         text-sm leading-4 font-medium rounded-md text-gray-500 
                         hover:text-gray-700 focus:outline-none focus:ring-2 
                         focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to CollabCanvas! 🎨
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              You're successfully authenticated. The canvas will be implemented next!
            </p>
            
            <div className="bg-white overflow-hidden shadow rounded-lg max-w-md mx-auto">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Authentication Status
                </h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">Status:</dt>
                    <dd className="text-sm text-green-600 font-semibold">✅ Authenticated</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">User ID:</dt>
                    <dd className="text-sm text-gray-900">{user.uid.substring(0, 8)}...</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">Email Verified:</dt>
                    <dd className="text-sm text-gray-900">
                      {user.emailVerified ? '✅ Yes' : '❌ No'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">Provider:</dt>
                    <dd className="text-sm text-gray-900">
                      {user.providerData[0]?.providerId || 'Unknown'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
