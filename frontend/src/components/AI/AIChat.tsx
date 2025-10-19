import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCanvasStore } from '../../store/canvasStore';
import { aiService } from '../../services/aiService';

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
}

const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, onMinimize, isMinimized }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'system',
      content: '🎨 **AI Canvas Assistant Ready!**\n\nI can help you create, arrange, and manipulate objects on your canvas using natural language. Try commands like:\n\n• "Create a blue rectangle at position 100, 200"\n• "Arrange all objects in a row"\n• "Make all circles red"\n• "Align the text objects to the center"',
      timestamp: Date.now()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  // Get current room ID from canvas store or URL
  // For now, we'll use a default room ID - this should be improved to get the actual room
  const roomId = 'default-room'; // TODO: Get actual room ID from routing/store

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

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

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
      // Use the real AI service to process the command
      const response = await aiService.processCommand(message.trim(), roomId);
      
      // Remove loading message
      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id));
      
      if (response.success && response.data) {
        // Handle successful AI response
        let responseContent = '';
        
        if (response.data.choices && response.data.choices.length > 0) {
          const choice = response.data.choices[0];
          
          if (choice.message) {
            responseContent = choice.message.content || '';
            
            // If there are tool calls, add them to the response
            if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
              responseContent += '\n\n🛠️ **Actions Executed:**\n';
              for (const toolCall of choice.message.tool_calls) {
                if (toolCall.type === 'function') {
                  responseContent += `• ${toolCall.function.name}\n`;
                }
              }
            }
          }
        }
        
        if (!responseContent) {
          responseContent = 'I processed your request successfully! The changes should be visible on your canvas.';
        }

        const aiResponse: Message = {
          id: `ai-${Date.now()}`,
          type: 'assistant',
          content: responseContent,
          timestamp: Date.now(),
          isCommand: true,
          commandResult: response.data
        };

        setMessages(prev => [...prev, aiResponse]);
        
      } else {
        // Handle error response
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          type: 'assistant',
          content: `❌ **Error Processing Command**\n\n${response.error || 'I encountered an issue processing your request. Please try rephrasing your command or check if all required parameters are provided.'}\n\n💡 **Tip:** Try commands like "create a red circle" or "arrange objects in a row"`,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, errorMessage]);
      }
      
    } catch (error) {
      console.error('AI Chat Error:', error);
      
      // Remove loading message and add error
      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id));
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: '❌ **Connection Error**\n\nI\'m having trouble connecting to the AI service. This could be because:\n\n• The backend server is not running\n• You\'re not authenticated\n• Network connectivity issues\n\nPlease check your connection and try again.',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const formatContent = (content: string, type: Message['type']) => {
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
                  <div dangerouslySetInnerHTML={formatContent(message.content, message.type)} />
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
            Press Enter to send • AI powered by 21 canvas tools
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
