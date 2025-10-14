import React, { useState, useEffect } from 'react';
import { useConnection } from '../hooks/useConnection';
import API from '../lib/api';

/**
 * Example component demonstrating the new connection state management
 * This component shows how to use the connection hook and service integration
 */
export default function ConnectionExample() {
    const [roomId, setRoomId] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [messageLog, setMessageLog] = useState<string[]>([]);
    
    // Use the new connection hook
    const connection = useConnection();

    // Add message to log
    const addToLog = (message: string) => {
        setMessageLog(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    // Log connection state changes
    useEffect(() => {
        addToLog(`Connection state: ${connection.connectionState}`);
    }, [connection.connectionState]);

    // Log room changes
    useEffect(() => {
        if (connection.room) {
            addToLog(`Joined room: ${connection.room.id} (${connection.memberCount} members)`);
        } else {
            addToLog('Left room');
        }
    }, [connection.room, connection.memberCount]);

    // Log user changes
    useEffect(() => {
        addToLog(`Connected users: ${connection.users.length}`);
    }, [connection.users.length]);

    // Log errors
    useEffect(() => {
        if (connection.error) {
            addToLog(`Error: ${connection.error}`);
        }
    }, [connection.error]);

    const handleConnect = () => {
        connection.connect();
        addToLog('Connecting...');
    };

    const handleDisconnect = () => {
        connection.disconnect();
        addToLog('Disconnecting...');
    };

    const handleReconnect = () => {
        connection.reconnect();
        addToLog('Reconnecting...');
    };

    const handleJoinRoom = () => {
        if (!roomId.trim()) {
            addToLog('Please enter a room ID');
            return;
        }
        
        connection.joinRoom(roomId.trim(), {
            uid: 'example-user-id',
            email: 'example@test.com',
            name: 'Example User',
            picture: null,
            displayName: 'Example User',
            avatarColor: '#3b82f6'
        });
        addToLog(`Joining room: ${roomId.trim()}`);
    };

    const handleLeaveRoom = () => {
        connection.leaveRoom();
        addToLog('Leaving current room');
    };

    const handleSendCustomMessage = () => {
        if (!customMessage.trim()) {
            addToLog('Please enter a message');
            return;
        }
        
        const success = connection.sendMessage('custom_message', { text: customMessage.trim() });
        if (success) {
            addToLog(`Sent: ${customMessage.trim()}`);
            setCustomMessage('');
        } else {
            addToLog('Failed to send message');
        }
    };

    const handlePing = () => {
        connection.ping();
        addToLog('Ping sent');
    };

    const handleAuthenticate = () => {
        connection.authenticate('example-token', {
            uid: 'example-user-id',
            email: 'example@test.com',
            name: 'Example User',
            picture: null,
            displayName: 'Example User',
            avatarColor: '#3b82f6'
        });
        addToLog('Authentication sent');
    };

    const handleGenerateRoomId = () => {
        const newRoomId = API.room.generateRoomId();
        setRoomId(newRoomId);
        addToLog(`Generated room ID: ${newRoomId}`);
    };

    const handleClearError = () => {
        connection.clearError();
        addToLog('Error cleared');
    };

    const clearLog = () => {
        setMessageLog([]);
    };

    const getStatusColor = (state: string) => {
        switch (state) {
            case 'connected': return 'text-green-600 bg-green-50';
            case 'connecting': 
            case 'reconnecting': return 'text-yellow-600 bg-yellow-50';
            case 'disconnected': return 'text-gray-600 bg-gray-50';
            case 'error': return 'text-red-600 bg-red-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <h1 className="text-3xl font-bold mb-6">Connection State Management Test</h1>
            
            {/* Connection Status */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h2 className="text-xl font-semibold mb-3">Connection Status</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={`p-3 rounded-lg ${getStatusColor(connection.connectionState)}`}>
                        <div className="text-sm font-medium">Status</div>
                        <div className="text-lg font-bold">{connection.status}</div>
                        <div className="text-xs">{connection.connectionState}</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-600 font-medium">Client ID</div>
                        <div className="font-mono text-sm text-blue-800">
                            {connection.clientId || 'None'}
                        </div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="text-sm text-purple-600 font-medium">Room</div>
                        <div className="font-mono text-sm text-purple-800">
                            {connection.room?.id || 'None'}
                        </div>
                        {connection.room && (
                            <div className="text-xs text-purple-600">
                                {connection.memberCount} members
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                        <div className="text-sm text-indigo-600 font-medium">Statistics</div>
                        <div className="text-xs text-indigo-800">
                            <div>Sent: {connection.stats.messagesSent}</div>
                            <div>Received: {connection.stats.messagesReceived}</div>
                            <div>Reconnects: {connection.stats.reconnectionAttempts}</div>
                        </div>
                    </div>
                </div>
                
                {connection.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-red-700 font-medium">Error</div>
                                <div className="text-red-600">{connection.error}</div>
                            </div>
                            <button
                                onClick={handleClearError}
                                className="px-2 py-1 text-xs bg-red-200 text-red-700 rounded hover:bg-red-300"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Connected Users */}
            {connection.users.length > 0 && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-800 mb-2">Connected Users</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {connection.users.map((user) => (
                            <div key={user.clientId} className="p-2 bg-white rounded border">
                                <div className="flex items-center space-x-2">
                                    <div 
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: user.user?.avatarColor || '#6b7280' }}
                                    />
                                    <div>
                                        <div className="font-medium text-sm">
                                            {user.user?.displayName || user.user?.name || 'Anonymous'}
                                            {user.isCurrentUser && ' (You)'}
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono">
                                            {user.clientId.slice(0, 8)}...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Connection Controls */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Connection Controls</h3>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleConnect}
                        disabled={connection.isConnected}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Connect
                    </button>
                    <button
                        onClick={handleDisconnect}
                        disabled={!connection.isConnected}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Disconnect
                    </button>
                    <button
                        onClick={handleReconnect}
                        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                        Reconnect
                    </button>
                    <button
                        onClick={handlePing}
                        disabled={!connection.isConnected}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Ping
                    </button>
                    <button
                        onClick={handleAuthenticate}
                        disabled={!connection.isConnected}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Authenticate
                    </button>
                </div>
            </div>

            {/* Room Controls */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Room Controls</h3>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <input
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="Enter room ID"
                        className="px-3 py-2 border border-gray-300 rounded"
                    />
                    <button
                        onClick={handleGenerateRoomId}
                        className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Generate
                    </button>
                    <button
                        onClick={handleJoinRoom}
                        disabled={!connection.isConnected || !roomId.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Join Room
                    </button>
                    <button
                        onClick={handleLeaveRoom}
                        disabled={!connection.isInRoom}
                        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Leave Room
                    </button>
                </div>
            </div>

            {/* Custom Message */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Send Custom Message</h3>
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
                        disabled={!connection.isConnected || !customMessage.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Send
                    </button>
                </div>
            </div>

            {/* Message Log */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Activity Log</h3>
                    <button
                        onClick={clearLog}
                        className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Clear Log
                    </button>
                </div>
                <div className="h-80 overflow-y-auto bg-gray-900 text-green-400 p-4 rounded font-mono text-sm">
                    {messageLog.length === 0 ? (
                        <div className="text-gray-500 italic">No activity yet...</div>
                    ) : (
                        messageLog.map((message, index) => (
                            <div key={index} className="mb-1">
                                {message}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
