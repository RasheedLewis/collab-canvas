interface UserInfo {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  displayName?: string;
  avatarColor?: string;
}

interface ActiveUser {
  userId: string;
  userInfo?: UserInfo;
  isCurrentUser?: boolean;
}

interface ActiveUsersProps {
  currentUser?: UserInfo;
  otherUsers: ActiveUser[];
  className?: string;
}

export default function ActiveUsers({ currentUser, otherUsers, className = '' }: ActiveUsersProps) {
  // Create a list of all users including current user
  const allUsers: ActiveUser[] = [
    ...(currentUser ? [{
      userId: currentUser.uid,
      userInfo: currentUser,
      isCurrentUser: true
    }] : []),
    ...otherUsers
  ];

  if (allUsers.length === 0) {
    return null;
  }

  return (
    <div 
      className={className}
      style={{ 
        width: '320px',
        height: '112px',
        minWidth: '320px',
        maxWidth: '320px',
        minHeight: '112px',
        maxHeight: '112px',
        padding: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(8px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px',
        height: '20px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ 
              width: '8px', 
              height: '8px', 
              backgroundColor: '#10B981',
              borderRadius: '50%',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', letterSpacing: '0.025em' }}>
            Active Users
          </span>
        </div>
        <div 
          style={{ 
            fontSize: '11px', 
            fontWeight: '600',
            padding: '4px 8px',
            minWidth: '20px',
            textAlign: 'center',
            color: '#4B5563',
            backgroundColor: 'rgba(243, 244, 246, 0.8)',
            border: '1px solid rgba(209, 213, 219, 0.3)',
            borderRadius: '50px'
          }}
        >
          {allUsers.length}
        </div>
      </div>
      
      {/* Users Container - Horizontal Scrolling */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          overflowY: 'hidden',
          height: '40px',
          flexShrink: 0,
          padding: '4px 8px',
          borderRadius: '12px',
          backgroundColor: 'rgba(249, 250, 251, 0.5)'
        }}
      >
        {allUsers.map((user) => {
          const userInfo = user.userInfo;
          const displayName = userInfo?.displayName || userInfo?.name || 'Anonymous';
          const avatarColor = userInfo?.avatarColor || '#6B7280';
          const profilePicture = userInfo?.picture;
          
          return (
                    <div 
                      key={user.userId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        width: '36px',
                        height: '36px',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                        if (tooltip) tooltip.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                        if (tooltip) tooltip.style.opacity = '0';
                      }}
                    >
              {/* Avatar */}
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={`${displayName}'s profile`}
                  style={{ 
                    width: '32px', 
                    height: '32px',
                    borderRadius: '50%',
                    border: `3px solid ${avatarColor}`,
                    backgroundColor: 'white',
                    objectFit: 'cover',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    transition: 'transform 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.remove();
                  }}
                />
              ) : (
                <div
                  style={{ 
                    width: '32px', 
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#f3f4f6',
                    border: `3px solid ${avatarColor}`,
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    transition: 'transform 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <svg 
                    style={{ width: '16px', height: '16px' }}
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
              
              {/* Online indicator */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: '0px',
                  right: '0px',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#10B981',
                  border: '2px solid white',
                  borderRadius: '50%',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }}
              />
              
              {/* Current user indicator */}
              {user.isCurrentUser && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '0px',
                    right: '0px',
                    width: '10px',
                    height: '10px',
                    backgroundColor: '#3B82F6',
                    border: '2px solid white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  <div 
                    style={{ 
                      width: '3px', 
                      height: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%'
                    }}
                  />
                </div>
              )}
              
              {/* Tooltip */}
              <div 
                className="tooltip"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '8px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                  backgroundColor: '#111827',
                  color: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  opacity: 0,
                  transition: 'opacity 0.2s ease',
                  pointerEvents: 'none'
                }}
              >
                {displayName}{user.isCurrentUser ? ' (You)' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}