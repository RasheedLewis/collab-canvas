import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import API from '../lib/api';

/**
 * Example component demonstrating WebSocket hook usage
 * This component shows how to connect, join rooms, and handle real-time communication
 */
export default function WebSocketExample() {
    const [roomId, setRoomId] = useState('');
    const [messageLog, setMessageLog] = useState<string[]>([]);
    const [customMessage, setCustomMessage] = useState('');
    
    // Initialize WebSocket connection
    const ws = useWebSocket({
        url: API.config.WS_URL,
        ...API.config.WS_CONFIG
    });

    // Add message to log
    const addToLog = (message: string) => {
        setMessageLog(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    // Set up event listeners
    useEffect(() => {
        // Listen for connection state changes
        const unsubscribeConnection = ws.onConnectionChange((state) => {
            addToLog(`Connection state: ${state}`);
        });

        // Listen for all messages
        const unsubscribeMessages = ws.onMessage((message) => {
            addToLog(`Message: ${message.type} ${message.payload ? '(with payload)' : ''}`);
        });

        // Listen for user events
        const unsubscribeUserJoined = ws.onUserJoined((payload) => {
            addToLog(`User joined: ${payload.userInfo?.name || payload.userId}`);
        });

        const unsubscribeUserLeft = ws.onUserLeft((payload) => {
            addToLog(`User left: ${payload.userInfo?.name || payload.userId}`);
        });

        // Listen for errors
        const unsubscribeError = ws.onError((error) => {
            addToLog(`Error: ${error.error}`);
        });

        return () => {
            unsubscribeConnection();
            unsubscribeMessages();
            unsubscribeUserJoined();
            unsubscribeUserLeft();
            unsubscribeError();
        };
    }, [ws]);

    const handleConnect = () => {
        ws.connect();
        addToLog('Connecting...');
    };

    const handleDisconnect = () => {
        ws.disconnect();
        addToLog('Disconnecting...');
    };

    const handleJoinRoom = () => {
        if (!roomId.trim()) {
            addToLog('Please enter a room ID');
            return;
        }
        
        ws.joinRoom(roomId.trim(), {
            uid: 'example-user-id',
            email: 'example@test.com',
            name: 'Example User',
            picture: null,
            displayName: 'Example User'
        });
        addToLog(`Joining room: ${roomId.trim()}`);
    };

    const handleLeaveRoom = () => {
        ws.leaveRoom();
        addToLog('Leaving current room');
    };

    const handleSendCustomMessage = () => {
        if (!customMessage.trim()) {
            addToLog('Please enter a message');
            return;
        }
        
        ws.sendMessage({
            type: 'custom_message',
            payload: { text: customMessage.trim() }
        });
        addToLog(`Sent: ${customMessage.trim()}`);
        setCustomMessage('');
    };

    const handlePing = () => {
        ws.sendPing();
        addToLog('Ping sent');
    };

    const handleAuthenticate = () => {
        ws.authenticate('example-token', {
            uid: 'example-user-id',
            email: 'example@test.com',
            name: 'Example User',
            picture: null,
            displayName: 'Example User',
            avatarColor: '#3b82f6'
        });
        addToLog('Authentication sent');
    };

    const getStatusColor = (state: string) => {
        switch (state) {
            case 'connected': return 'text-green-600';
            case 'connecting': 
            case 'reconnecting': return 'text-yellow-600';
            case 'disconnected': return 'text-gray-600';
            case 'error': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const clearLog = () => {
        setMessageLog([]);
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold mb-6">WebSocket Connection Test</h1>
            
            {/* Connection Status */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h2 className="text-lg font-semibold mb-2">Connection Status</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <span className="text-sm text-gray-600">State:</span>
                        <div className={`font-semibold ${getStatusColor(ws.connectionState)}`}>
                            {API.connection.getConnectionStatusMessage(ws.connectionState, ws.reconnectAttempts)}
                        </div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600">Client ID:</span>
                        <div className="font-mono text-sm">{ws.clientId || 'None'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600">Room ID:</span>
                        <div className="font-mono text-sm">{ws.roomId || 'None'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600">Reconnect Attempts:</span>
                        <div>{ws.reconnectAttempts}</div>
                    </div>
                </div>
                
                {ws.lastError && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                        <strong>Error:</strong> {API.errors.createUserFriendlyError(ws.lastError)}
                    </div>
                )}
            </div>

            {/* Connection Controls */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Connection Controls</h2>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleConnect}
                        disabled={ws.connectionState === 'connected' || ws.connectionState === 'connecting'}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Connect
                    </button>
                    <button
                        onClick={handleDisconnect}
                        disabled={!API.connection.isActiveConnection(ws.connectionState)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Disconnect
                    </button>
                    <button
                        onClick={handlePing}
                        disabled={!ws.isConnected}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Ping
                    </button>
                    <button
                        onClick={handleAuthenticate}
                        disabled={!ws.isConnected}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Authenticate
                    </button>
                </div>
            </div>

            {/* Room Controls */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Room Controls</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="Enter room ID"
                        className="px-3 py-2 border border-gray-300 rounded"
                    />
                    <button
                        onClick={() => setRoomId(API.room.generateRoomId())}
                        className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Generate ID
                    </button>
                    <button
                        onClick={handleJoinRoom}
                        disabled={!ws.isConnected || !roomId.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Join Room
                    </button>
                    <button
                        onClick={handleLeaveRoom}
                        disabled={!ws.isConnected}
                        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Leave Room
                    </button>
                </div>
            </div>

            {/* Custom Message */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Send Custom Message</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Enter custom message"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded"
                        onKeyPress={(e) => e.key === 'Enter' && handleSendCustomMessage()}
                    />
                    <button
                        onClick={handleSendCustomMessage}
                        disabled={!ws.isConnected || !customMessage.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Send
                    </button>
                </div>
            </div>

            {/* Message Log */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-semibold">Message Log</h2>
                    <button
                        onClick={clearLog}
                        className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Clear
                    </button>
                </div>
                <div className="h-64 overflow-y-auto bg-gray-50 border border-gray-200 rounded p-3">
                    {messageLog.length === 0 ? (
                        <div className="text-gray-500 italic">No messages yet...</div>
                    ) : (
                        messageLog.map((message, index) => (
                            <div key={index} className="font-mono text-sm mb-1">
                                {message}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
