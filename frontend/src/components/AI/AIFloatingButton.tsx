import React from 'react';

interface AIFloatingButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnreadMessages?: boolean;
  isProcessing?: boolean;
}

const AIFloatingButton: React.FC<AIFloatingButtonProps> = ({ 
  isOpen, 
  onToggle, 
  hasUnreadMessages = false,
  isProcessing = false 
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 999, // Just below the AI chat (which is 1000)
        cursor: 'pointer'
      }}
      onClick={onToggle}
    >
      <button
        className="group relative flex items-center justify-center transition-all duration-300"
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '24px',
          background: isOpen 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
            : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(16px)',
          color: isOpen ? 'white' : '#374151',
          border: isOpen 
            ? '2px solid rgba(102, 126, 234, 0.4)' 
            : '1px solid rgba(209, 213, 219, 0.3)',
          boxShadow: isOpen 
            ? '0 20px 40px rgba(102, 126, 234, 0.4), 0 8px 20px rgba(118, 75, 162, 0.3)' 
            : '0 12px 28px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1)',
          transform: isOpen ? 'scale(1.05)' : 'scale(1)',
          overflow: 'hidden',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 16px 36px rgba(0, 0, 0, 0.2), 0 6px 12px rgba(0, 0, 0, 0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1)';
          }
        }}
        title="AI Canvas Assistant - Transform your ideas with natural language"
      >
        {/* Background gradient effect when active */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '22px',
              zIndex: -1
            }}
          />
        )}

        {/* Animated background effect */}
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            right: '-30%',
            width: '120px',
            height: '120px',
            background: isOpen 
              ? 'linear-gradient(45deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)'
              : 'linear-gradient(45deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.05) 100%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            animation: isOpen ? 'float 3s ease-in-out infinite' : 'none'
          }}
        />

        {/* Sparkle effects for AI magic */}
        {isOpen && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '16px',
                width: '6px',
                height: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '50%',
                animation: 'sparkle 2s ease-in-out infinite'
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '12px',
                width: '4px',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderRadius: '50%',
                animation: 'sparkle 2s ease-in-out infinite 0.5s'
              }}
            />
          </>
        )}

        {/* Main AI icon with enhanced styling */}
        <div
          style={{
            fontSize: '32px',
            position: 'relative',
            zIndex: 1,
            textShadow: isOpen ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none',
            animation: isProcessing ? 'pulse 1.5s ease-in-out infinite' : 'none'
          }}
        >
          🤖
        </div>

        {/* Processing indicator */}
        {isProcessing && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '24px',
              height: '3px',
              backgroundColor: isOpen ? 'rgba(255, 255, 255, 0.3)' : 'rgba(102, 126, 234, 0.3)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: isOpen ? 'rgba(255, 255, 255, 0.9)' : '#667eea',
                borderRadius: '2px',
                animation: 'shimmer 1.5s infinite'
              }}
            />
          </div>
        )}

        {/* Notification badge for unread messages */}
        {hasUnreadMessages && !isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '16px',
              height: '16px',
              backgroundColor: '#EF4444',
              borderRadius: '50%',
              border: '3px solid white',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
              animation: 'pulse 1s infinite'
            }}
          />
        )}

        {/* Marketing text for enhanced visibility */}
        <div
          style={{
            position: 'absolute',
            bottom: '-32px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '12px',
            fontWeight: '600',
            color: isOpen ? 'rgba(255, 255, 255, 0.9)' : '#6B7280',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            transition: 'all 0.3s ease'
          }}
        >
          AI Assistant
        </div>

        {/* Glow effect on hover */}
        <div
          className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-300"
          style={{
            background: isOpen 
              ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            pointerEvents: 'none'
          }}
        />
      </button>
    </div>
  );
};

// Add CSS animations via style injection
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-6px) rotate(2deg); }
  }
  
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
`;

if (!document.head.querySelector('[data-ai-button-styles]')) {
  styleSheet.setAttribute('data-ai-button-styles', 'true');
  document.head.appendChild(styleSheet);
}

export default AIFloatingButton;
