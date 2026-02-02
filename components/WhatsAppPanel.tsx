'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Props {
    socket: Socket | null;
    ownerId: string; // The browser user ID
    sessions: string[]; // List of session IDs (phone numbers)
    onUpdateSessions: (sessions: string[]) => void;
}

export function WhatsAppPanel({ socket, ownerId, sessions, onUpdateSessions }: Props) {
    const [newNumber, setNewNumber] = useState('');

    const addSession = () => {
        if (!newNumber) return;
        // avoid duplicates
        if (sessions.includes(newNumber)) {
            alert('Number already added');
            return;
        }
        const updated = [...sessions, newNumber];
        onUpdateSessions(updated);
        setNewNumber('');
    };

    const removeSession = (sessionId: string) => {
        const updated = sessions.filter(s => s !== sessionId);
        onUpdateSessions(updated);
        // Also trigger disconnect if active?
        if (socket) socket.emit('stop-session', sessionId);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow border relative">
            <h2 className="text-xl font-bold mb-4">WhatsApp Accounts</h2>
            
            {/* Add New Session */}
            <div className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    placeholder="Enter phone (e.g. 55119999999)" 
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    className="flex-1 rounded-md border-gray-300 shadow-sm p-2 border"
                />
                <button 
                    onClick={addSession}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                >
                    Add
                </button>
            </div>

            {/* List Sessions */}
            <div className="space-y-4">
                {sessions.length === 0 && <p className="text-gray-500 text-sm">No accounts added. Add a number to connect.</p>}
                
                {sessions.map(sessionId => (
                    <SessionRow 
                        key={sessionId} 
                        sessionId={sessionId} 
                        socket={socket} 
                        onRemove={() => removeSession(sessionId)} 
                    />
                ))}
            </div>
        </div>
    );
}

function SessionRow({ sessionId, socket, onRemove }: { sessionId: string, socket: Socket | null, onRemove: () => void }) {
    const [status, setStatus] = useState<string>('DISCONNECTED');
    const [qr, setQr] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!socket) return;
        
        console.log(`[Row ${sessionId}] Joining room`);
        socket.emit('join-session', sessionId); 

        const handleStatus = (info: any) => {
            if (info.userId === sessionId) {
                console.log(`[Row ${sessionId}] Update:`, info.status);
                setStatus(info.status);
                setQr(info.qr || null);
                setIsLoading(false);
            }
        };

        socket.on('wa-status', handleStatus);

        return () => {
            socket.off('wa-status', handleStatus);
        };
    }, [socket, sessionId]);

    const handleConnect = () => {
        if (!socket) return;
        setIsLoading(true);
        socket.emit('start-session', sessionId);
        setTimeout(() => setIsLoading(false), 30000); // 30s timeout
    };

    const handleDisconnect = () => {
        if (!socket) return;
        setIsLoading(true);
        socket.emit('stop-session', sessionId);
    };

    return (
        <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
                <div className="font-bold text-gray-700">{sessionId}</div>
                <div className="flex items-center gap-2">
                     <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        status === 'READY' || status === 'AUTHENTICATED' ? 'bg-green-100 text-green-700' : 
                        status === 'QR' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {status}
                    </span>
                    <button onClick={onRemove} className="text-gray-400 hover:text-red-500">
                        ×
                    </button>
                </div>
            </div>

            {/* Action Area */}
            <div className="mt-2">
                 {status === 'QR' && qr && (
                    <div className="bg-white p-2 rounded inline-block border mb-2">
                        <QRCodeSVG value={qr} size={150} />
                    </div>
                )}

                <div className="flex gap-2">
                    {['DISCONNECTED', 'DISCONNECTED (AUTH FAILURE)'].includes(status) && (
                         <button 
                            onClick={handleConnect}
                            disabled={isLoading}
                            className={`text-sm px-3 py-1 rounded text-white ${isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {isLoading ? 'Connecting...' : 'Connect'}
                        </button>
                    )}
                    
                    {['READY', 'AUTHENTICATED', 'QR'].includes(status) && (
                        <button 
                            onClick={handleDisconnect}
                            disabled={isLoading}
                            className={`text-sm px-3 py-1 rounded text-white ${isLoading ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'}`}
                        >
                             {isLoading ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
