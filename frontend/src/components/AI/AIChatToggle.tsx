import React from 'react';

interface AIChatToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnreadMessages?: boolean;
  isProcessing?: boolean;
}

const AIChatToggle: React.FC<AIChatToggleProps> = ({ 
  isOpen, 
  onToggle, 
  hasUnreadMessages = false,
  isProcessing = false 
}) => {
  return (
    <button
      onClick={onToggle}
      className="group relative flex flex-col items-center justify-center transition-all duration-300"
      style={{
        padding: '12px',
        borderRadius: '12px',
        minHeight: '56px',
        width: '56px',
        backgroundColor: isOpen 
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
          : 'rgba(249, 250, 251, 0.9)',
        color: isOpen ? 'white' : '#374151',
        border: isOpen 
          ? '2px solid rgba(102, 126, 234, 0.4)' 
          : '1px solid rgba(209, 213, 219, 0.3)',
        boxShadow: isOpen 
          ? '0 8px 25px rgba(102, 126, 234, 0.4), 0 4px 12px rgba(118, 75, 162, 0.3)' 
          : '0 4px 12px rgba(0, 0, 0, 0.1)',
        transform: isOpen ? 'scale(1.05)' : 'scale(1)',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        if (!isOpen) {
          e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 1)';
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isOpen) {
          e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.9)';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }
      }}
      title="AI Canvas Assistant - Create and manage objects with natural language"
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
            borderRadius: '10px',
            zIndex: -1
          }}
        />
      )}

      {/* Sparkle effect for AI */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '8px',
            height: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }}
        />
      )}

      {/* Main AI icon */}
      <div
        style={{
          fontSize: isOpen ? '26px' : '24px',
          marginBottom: '2px',
          transition: 'all 0.2s ease',
          position: 'relative',
          zIndex: 1
        }}
      >
        🤖
      </div>

      {/* Label */}
      <span 
        style={{ 
          fontSize: '9px', 
          fontWeight: '600',
          textAlign: 'center',
          letterSpacing: '0.025em',
          textTransform: 'uppercase',
          opacity: 0.9,
          position: 'relative',
          zIndex: 1
        }}
      >
        AI
      </span>

      {/* Processing indicator */}
      {isProcessing && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '16px',
            height: '2px',
            backgroundColor: isOpen ? 'rgba(255, 255, 255, 0.5)' : 'rgba(102, 126, 234, 0.5)',
            borderRadius: '1px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              background: isOpen ? 'rgba(255, 255, 255, 0.9)' : '#667eea',
              borderRadius: '1px',
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
            top: '4px',
            right: '4px',
            width: '12px',
            height: '12px',
            backgroundColor: '#EF4444',
            borderRadius: '50%',
            border: '2px solid white',
            animation: 'pulse 1s infinite'
          }}
        />
      )}

      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300"
        style={{
          background: isOpen 
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          pointerEvents: 'none'
        }}
      />
    </button>
  );
};

// Add shimmer animation keyframes to the component's style
const shimmerStyle = document.createElement('style');
shimmerStyle.textContent = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;
document.head.appendChild(shimmerStyle);

export default AIChatToggle;
