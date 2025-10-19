import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './components/Auth/Login';
import Canvas from './components/Canvas/Canvas';
import Toolbar from './components/Canvas/Toolbar';
import { useCanvasStore } from './store/canvasStore';
import { AIChat, AIFloatingButton } from './components/AI';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuthUser, useAuthUserProfile } from './store/authStore';
import API from './lib/api';
import { useState, useEffect } from 'react';
import './App.css';

// Main application component (inside AuthProvider)
function AppContent() {
  const { user, loading } = useAuth();
  
  // Shared WebSocket connection for both Canvas and AI Chat
  const authUser = useAuthUser();
  const userProfile = useAuthUserProfile();
  
  const sharedWs = useWebSocket({
    url: API.config.WS_URL,
    ...API.config.WS_CONFIG
  });

  const {
    isConnected,
    clientId,
    roomId,
    sendMessage,
    joinRoom
  } = sharedWs;

  // Connect and join room when authenticated
  useEffect(() => {
    if (!isConnected) {
      sharedWs.connect();
    }
  }, [isConnected, sharedWs]);

  // Color palette for user cursors (same as Canvas)
  const cursorColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3',
    '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43', '#10AC84', '#EE5A24',
    '#0984e3', '#6c5ce7', '#fd79a8', '#fdcb6e'
  ];

  const getColorForUser = (userId: string): string => {
    if (!userId) return cursorColors[0];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const colorIndex = Math.abs(hash) % cursorColors.length;
    return cursorColors[colorIndex];
  };

  // Join room when connected
  useEffect(() => {
    if (isConnected && !roomId && authUser) {
      const testRoomId = 'canvas-room-1';
      const randomId = Math.random().toString(36).substring(2, 8);
      
      const userInfo = {
        uid: authUser?.uid || clientId || 'anonymous',
        email: authUser?.email || null,
        name: authUser?.displayName || userProfile?.displayName || `User_${randomId}`,
        picture: authUser?.photoURL || null,
        displayName: userProfile?.displayName || authUser?.displayName || `User_${randomId}`,
        avatarColor: userProfile?.avatarColor || getColorForUser(authUser?.uid || clientId || randomId)
      };
      
      joinRoom(testRoomId, userInfo);
    }
  }, [isConnected, roomId, clientId, joinRoom, authUser, userProfile]);

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
      {/* Canvas fills the container with shared WebSocket */}
      <Canvas webSocket={sharedWs} />

      {/* Toolbar positioned absolutely within container */}
      <ToolbarWithDeleteHandler />
      
      {/* AI Components positioned absolutely with shared WebSocket */}
      <AIComponents canvasWebSocket={{
        sendMessage,
        isConnected,
        roomId
      }} />
    </div>
  );
}

// Separate component to handle delete functionality with access to WebSocket
function ToolbarWithDeleteHandler() {
  const { selectedObjectId } = useCanvasStore();

  // We'll pass a simple handler that just calls the Canvas component's delete function
  return (
    <Toolbar 
      onDeleteSelected={selectedObjectId ? () => {
        // Trigger keyboard delete event to use the Canvas component's delete logic
        const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' });
        window.dispatchEvent(deleteEvent);
      } : undefined}
    />
  );
}

// Separate component to handle AI functionality  
function AIComponents({ canvasWebSocket }: {
  canvasWebSocket: {
    sendMessage: (message: any) => void;
    isConnected: boolean;
    roomId: string | null;
  };
}) {
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isAIChatMinimized, setIsAIChatMinimized] = useState(false);

  const handleAIChatToggle = () => {
    if (isAIChatOpen) {
      setIsAIChatOpen(false);
      setIsAIChatMinimized(false);
    } else {
      setIsAIChatOpen(true);
      setIsAIChatMinimized(false);
    }
  };

  const handleAIChatMinimize = () => {
    setIsAIChatMinimized(!isAIChatMinimized);
  };

  const handleAIChatClose = () => {
    setIsAIChatOpen(false);
    setIsAIChatMinimized(false);
  };

  return (
    <>
      {/* AI Floating Button positioned in bottom right */}
      <AIFloatingButton
        isOpen={isAIChatOpen}
        onToggle={handleAIChatToggle}
      />
      
      {/* AI Chat Component */}
      <AIChat
        isOpen={isAIChatOpen}
        onClose={handleAIChatClose}
        onMinimize={handleAIChatMinimize}
        isMinimized={isAIChatMinimized}
        canvasWebSocket={canvasWebSocket}
      />
    </>
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
