import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCanvasStore } from '../../store/canvasStore';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isCommand?: boolean;
  commandResult?: any;
  loading?: boolean;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
  // Share WebSocket connection from Canvas component
  canvasWebSocket: {
    sendMessage: (message: any) => void;
    isConnected: boolean;
    roomId: string | null;
  };
}

const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, onMinimize, isMinimized, canvasWebSocket }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'system',
      content: '🎨 **AI Canvas Assistant Ready!**\n\nI can help you create objects on your canvas using natural language. I use the same reliable frontend methods as the toolbar for perfect synchronization!\n\n• "Create a rectangle"\n• "Add a circle"\n• "Make a text that says Hello World"\n• "Create a square"',
      timestamp: Date.now()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  // Use shared WebSocket connection from Canvas component (properly authenticated & joined to room)
  const { roomId } = canvasWebSocket;
  
  // Get canvas store methods (same as toolbar uses)
  const { 
    createRectangle, 
    createCircle, 
    createText,
    setActiveColor
  } = useCanvasStore();

  // Canvas operations with WebSocket sync (same as toolbar uses)
  const sendObjectCreated = (object: any) => {
    if (!canvasWebSocket.isConnected || !roomId) return;
    
    canvasWebSocket.sendMessage({
      type: 'object_created',
      payload: {
        roomId,
        object,
        userId: user?.uid
      },
      timestamp: Date.now()
    });
  };

  const createRectangleWithSync = (x: number, y: number, width?: number, height?: number) => {
    const rectangle = createRectangle(x, y, width, height);
    sendObjectCreated(rectangle);
    return rectangle;
  };

  const createCircleWithSync = (x: number, y: number, radius?: number) => {
    const circle = createCircle(x, y, radius);
    sendObjectCreated(circle);
    return circle;
  };

  const createTextWithSync = (x: number, y: number, text?: string) => {
    const textObject = createText(x, y, text);
    sendObjectCreated(textObject);
    return textObject;
  };

  // Color name to hex conversion
  const parseColorFromCommand = (command: string): string | null => {
    const colorMap: Record<string, string> = {
      'black': '#000000',
      'white': '#ffffff',
      'red': '#ef4444',
      'blue': '#3b82f6', 
      'green': '#10b981',
      'yellow': '#f59e0b',
      'purple': '#8b5cf6',
      'pink': '#ec4899',
      'orange': '#f97316',
      'gray': '#6b7280',
      'grey': '#6b7280',
      'brown': '#92400e',
      'lime': '#84cc16',
      'cyan': '#06b6d4',
      'indigo': '#6366f1'
    };

    const cmd = command.toLowerCase();
    for (const [name, hex] of Object.entries(colorMap)) {
      if (cmd.includes(name)) {
        return hex;
      }
    }
    return null;
  };

  // Parse natural language commands and execute using frontend methods
  const executeCanvasCommand = async (command: string) => {
    const cmd = command.toLowerCase().trim();
    
    try {
      // Parse color from command
      const requestedColor = parseColorFromCommand(command);
      
      // Set color if specified
      if (requestedColor) {
        setActiveColor(requestedColor);
      }
      
      let result = '';
      
      // Rectangle creation
      if (cmd.includes('rectangle') || cmd.includes('square')) {
        const x = 100 + Math.random() * 300;
        const y = 100 + Math.random() * 200;
        const width = cmd.includes('square') ? 100 : 120;
        const height = cmd.includes('square') ? 100 : 80;
        
        createRectangleWithSync(x, y, width, height);
        const colorName = requestedColor ? Object.entries({
          '#000000': 'black', '#ffffff': 'white', '#ef4444': 'red', 
          '#3b82f6': 'blue', '#10b981': 'green', '#f59e0b': 'yellow',
          '#8b5cf6': 'purple', '#ec4899': 'pink', '#f97316': 'orange'
        }).find(([hex]) => hex === requestedColor)?.[1] || 'colored' : '';
        
        result = `✅ Created ${colorName ? colorName + ' ' : ''}rectangle at (${Math.round(x)}, ${Math.round(y)})`;
      }
      
      // Circle creation
      else if (cmd.includes('circle')) {
        const x = 100 + Math.random() * 300;
        const y = 100 + Math.random() * 200;
        const radius = 50;
        
        createCircleWithSync(x, y, radius);
        const colorName = requestedColor ? Object.entries({
          '#000000': 'black', '#ffffff': 'white', '#ef4444': 'red', 
          '#3b82f6': 'blue', '#10b981': 'green', '#f59e0b': 'yellow',
          '#8b5cf6': 'purple', '#ec4899': 'pink', '#f97316': 'orange'
        }).find(([hex]) => hex === requestedColor)?.[1] || 'colored' : '';
        
        result = `✅ Created ${colorName ? colorName + ' ' : ''}circle at (${Math.round(x)}, ${Math.round(y)})`;
      }
      
      // Text creation
      else if (cmd.includes('text') || cmd.includes('label')) {
        const x = 100 + Math.random() * 300;
        const y = 100 + Math.random() * 200;
        const text = cmd.includes('"') ? cmd.split('"')[1] : 'Sample Text';
        
        createTextWithSync(x, y, text);
        const colorName = requestedColor ? Object.entries({
          '#000000': 'black', '#ffffff': 'white', '#ef4444': 'red', 
          '#3b82f6': 'blue', '#10b981': 'green', '#f59e0b': 'yellow',
          '#8b5cf6': 'purple', '#ec4899': 'pink', '#f97316': 'orange'
        }).find(([hex]) => hex === requestedColor)?.[1] || 'colored' : '';
        
        result = `✅ Created ${colorName ? colorName + ' ' : ''}text "${text}" at (${Math.round(x)}, ${Math.round(y)})`;
      }
      
      else {
        result = '❓ I can help you create rectangles, circles, and text. Try: "Create a red rectangle" or "Add a blue circle"';
      }
      
      // Reset color back to original (optional, or keep the new color for next creation)
      // setActiveColor(originalColor);
      
      return result;
      
    } catch (error) {
      console.error('Command execution error:', error);
      return '❌ Sorry, there was an error executing that command.';
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Backend AI service handles all command execution with proper OpenAI tools

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading || !roomId) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Add loading message
    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      type: 'assistant',
      content: '',
      timestamp: Date.now(),
      loading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    // Show typing indicator
    setIsTyping(true);
    
    try {
      // Use local command execution with frontend methods (same as toolbar)
      const result = await executeCanvasCommand(message.trim());
      
      // Remove loading message
      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id));
      
      const aiResponse: Message = {
        id: `ai-${Date.now()}`,
        type: 'assistant',
        content: result,
        timestamp: Date.now(),
        isCommand: true
      };

      setMessages(prev => [...prev, aiResponse]);
      
    } catch (error) {
      console.error('AI Chat Error:', error);
      
      // Remove loading message and add error
      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id));
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: `❌ **Error Processing Command**\n\n${error instanceof Error ? error.message : String(error)}\n\n💡 **Tip:** Try commands like "create a rectangle" or "add a circle"`,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  // Backend AI service handles all command parsing and execution with OpenAI tools

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const formatContent = (content: string) => {
    // Basic markdown-like formatting
    const formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/•/g, '&bull;')
      .replace(/\n/g, '<br/>');

    return { __html: formatted };
  };

  const getMessageIcon = (type: Message['type']) => {
    switch (type) {
      case 'user':
        return user?.photoURL ? (
          <img 
            src={user.photoURL} 
            alt="User" 
            style={{ 
              width: '24px', 
              height: '24px', 
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.8)'
            }} 
          />
        ) : '👤';
      case 'assistant':
        return '🤖';
      case 'system':
        return '⚡';
      default:
        return '💬';
    }
  };

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '110px', // Position above the AI button
          right: '24px',
          zIndex: 1000,
          cursor: 'pointer'
        }}
        onClick={onMinimize}
      >
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '200px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)'
          }}
        >
          <div
            style={{
              fontSize: '24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255, 255, 255, 0.5)'
            }}
          >
            🤖
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              AI Assistant
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              {isTyping ? 'Thinking...' : 'Click to expand'}
            </div>
          </div>
          {isTyping && (
            <div style={{ marginLeft: 'auto' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#667eea',
                  borderRadius: '50%',
                  animation: 'pulse 1s infinite'
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '110px', // Position above the AI button
        right: '24px',
        width: '400px',
        height: '600px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Chat Container with Glass Effect */}
      <div
        style={{
          flex: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(16px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.2), 0 12px 24px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid rgba(209, 213, 219, 0.3)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Header Background Decoration */}
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              right: '-20%',
              width: '200px',
              height: '200px',
              background: 'linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  fontSize: '28px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid rgba(255, 255, 255, 0.3)'
                }}
              >
                🤖
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.025em' }}>
                  AI Canvas Assistant
                </h3>
                <p style={{ margin: 0, fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>
                  {isTyping ? '✨ Thinking...' : '💡 Ready to help'}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onMinimize}
                style={{
                  padding: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                −
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
          className="scrollbar-hide"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                alignSelf: message.type === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              {message.type !== 'user' && (
                <div
                  style={{
                    fontSize: '20px',
                    minWidth: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: message.type === 'system' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '50%',
                    border: `1px solid ${message.type === 'system' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`
                  }}
                >
                  {getMessageIcon(message.type)}
                </div>
              )}
              
              <div
                style={{
                  backgroundColor: message.type === 'user' 
                    ? 'rgba(59, 130, 246, 0.9)' 
                    : message.type === 'system' 
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(249, 250, 251, 0.9)',
                  color: message.type === 'user' 
                    ? 'white' 
                    : message.type === 'system'
                      ? '#065F46'
                      : '#374151',
                  padding: '12px 16px',
                  borderRadius: message.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  border: message.type === 'user' 
                    ? '1px solid rgba(59, 130, 246, 0.3)'
                    : message.type === 'system'
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(209, 213, 219, 0.3)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  position: 'relative'
                }}
              >
                {message.loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(99, 102, 241, 0.3)',
                        borderTop: '2px solid #6366F1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}
                    />
                    <span style={{ color: '#6B7280' }}>AI is thinking...</span>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={formatContent(message.content)} />
                )}

                <div
                  style={{
                    fontSize: '11px',
                    opacity: 0.7,
                    marginTop: '6px',
                    textAlign: 'right'
                  }}
                >
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>

              {message.type === 'user' && (
                <div
                  style={{
                    fontSize: '20px',
                    minWidth: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '50%',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                >
                  {getMessageIcon(message.type)}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid rgba(209, 213, 219, 0.3)',
            backgroundColor: 'rgba(249, 250, 251, 0.5)'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me to create, arrange, or modify objects..."
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid rgba(209, 213, 219, 0.4)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(4px)',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.4)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              style={{
                padding: '12px',
                backgroundColor: inputValue.trim() ? '#3B82F6' : 'rgba(209, 213, 219, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                minWidth: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: inputValue.trim() ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (inputValue.trim() && !isLoading) {
                  e.currentTarget.style.backgroundColor = '#2563EB';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (inputValue.trim()) {
                  e.currentTarget.style.backgroundColor = '#3B82F6';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {isLoading ? '⏳' : '🚀'}
            </button>
          </div>
          
          <div
            style={{
              fontSize: '11px',
              color: '#9CA3AF',
              marginTop: '8px',
              textAlign: 'center'
            }}
          >
            Press Enter to send • Using same methods as toolbar for perfect sync
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
