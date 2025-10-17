import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './components/Auth/Login';
import Canvas from './components/Canvas/Canvas';
import Toolbar from './components/Canvas/Toolbar';
import './App.css';

// Main application component (inside AuthProvider)
function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div 
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          {/* App Header */}
          <div 
            style={{
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
            <div 
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(59, 130, 246, 0.3)',
                borderTop: '3px solid #3B82F6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}
            />
            <p 
              style={{
                margin: 0,
                fontSize: '14px',
                color: '#6B7280',
                fontWeight: '500'
              }}
            >
              Loading...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div 
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px'
        }}
      >
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
