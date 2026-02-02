'use client';

import { DollarChart } from '@/components/DollarChart';
import { WhatsAppPanel } from '@/components/WhatsAppPanel';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type AlertRule = {
    id: string;
    type: 'RISE' | 'FALL' | 'ABOVE' | 'BELOW';
    value: number;
    targetSession: string;
    lastTriggeredValue?: number;
}

export default function Dashboard() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [userId, setUserId] = useState<string>('');
    const [data, setData] = useState<any[]>([]);
    const [current, setCurrent] = useState<number>(0);
    const [diff, setDiff] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Settings State
    const [alerts, setAlerts] = useState<AlertRule[]>([]);
    const [waSessions, setWaSessions] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);

    // New Alert Form State
    const [newAlertType, setNewAlertType] = useState<'RISE' | 'FALL' | 'TARGET'>('RISE');
    const [newAlertValue, setNewAlertValue] = useState<number>(0.03);
    const [newAlertTarget, setNewAlertTarget] = useState<string>('');

    useEffect(() => {
        // Initialize User ID
        let storedId = localStorage.getItem('dollar_user_id');
        if (!storedId) {
            storedId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('dollar_user_id', storedId);
        }
        setUserId(storedId);

        // Connect Socket
        const socketInstance = io(); // Connects to same host
        setSocket(socketInstance);

        socketInstance.on('connect', () => {
            console.log('Socket Connected');
            setLoading(false);
        });

        socketInstance.on('usd-update', (payload: any) => {
            // console.log('USD Update:', payload);
            setCurrent(payload.current);
            setDiff(payload.diff);
            setData(payload.history);
        });

        // Load existing settings
        fetch(`/api/settings?id=${storedId}`)
            .then(res => res.json())
            .then(res => {
                if(res.user) {
                    // Load alerts if exist
                    setAlerts(res.user.alerts || []);
                    setWaSessions(res.user.whatsappSessions || []);
                }
            });

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    // Wrapper to update sessions state AND save immediately
    const handleUpdateSessions = async (newSessions: string[]) => {
        setWaSessions(newSessions);
        // We preserve current alerts when updating sessions
        await saveSettingsInternal(alerts, newSessions);
    };



    const handleRemoveAlert = (id: string) => {
        const updated = alerts.filter(a => a.id !== id);
        setAlerts(updated);
        saveSettingsInternal(updated, waSessions);
    };

    const newAlertTarggetCheck = () => {
        if (!newAlertTarget) {
            if (waSessions.length > 0) {
                setNewAlertTarget(waSessions[0]); // Default to first
                return true;
            } else {
                alert("Conecte um WhatsApp primeiro.");
                return false;
            }
        }
        return true;
    }

    const saveSettingsInternal = async (currAlerts: AlertRule[], sessions: string[]) => {
        await fetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify({
                id: userId,
                alerts: currAlerts,
                whatsappSessions: sessions,
                phoneNumbers: [], // Deprecated
                active: true
            })
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    const handleTestMessage = (target: string) => {
        if (!target) return alert("Selecione um número.");
        socket?.emit('test-message', { sessionId: target, target: target });
        alert(` Enviando teste para ${target}...`);
    }

    if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Monitor Dólar 🇺🇸</h1>
                        <p className="text-gray-500">Acompanhamento em tempo real</p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold text-green-600">R$ {current.toFixed(4)}</div>
                        <div className={`text-sm font-medium ${diff >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {diff >= 0 ? 'Subiu' : 'Caiu'} {Math.abs(diff).toFixed(4)} (vs Anterior)
                        </div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Col: Chart & Settings */}
                    <div className="lg:col-span-2 space-y-8">
                        <DollarChart data={data} />
                        
                        {waSessions.length > 0 ? (
                            <div className="bg-white p-6 rounded-lg shadow border">
                                <h2 className="text-xl font-bold mb-4">Regras de Alerta</h2>
                                
                                {/* List of Active Alerts */}
                                <div className="space-y-2 mb-6">
                                    {alerts.length === 0 && <p className="text-gray-400 italic">Nenhuma regra configurada.</p>}
                                    {alerts.map(alert => (
                                        <div key={alert.id} className="flex items-center justify-between bg-gray-50 p-3 rounded border">
                                            <div>
                                                <span className={`font-bold ${
                                                    alert.type === 'RISE' ? 'text-red-600' : 
                                                    alert.type === 'FALL' ? 'text-blue-600' : 
                                                    'text-purple-600'
                                                }`}>
                                                    {alert.type === 'RISE' ? 'SUBIR' : 
                                                     alert.type === 'FALL' ? 'CAIR' :
                                                     alert.type === 'ABOVE' ? 'ALVO (ALTA)' : 'ALVO (BAIXA)'}
                                                </span>
                                                <span className="mx-2">{alert.type === 'ABOVE' || alert.type === 'BELOW' ? 'em' : 'pelo menos'}</span>
                                                <span className="font-mono bg-gray-200 px-1 rounded">R$ {alert.value}</span>
                                                <span className="mx-2 text-gray-500">via {alert.targetSession}</span>
                                                {alert.lastTriggeredValue !== undefined && (alert.type === 'RISE' || alert.type === 'FALL') && (
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        Base Atual: R$ {alert.lastTriggeredValue.toFixed(4)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleTestMessage(alert.targetSession)}
                                                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                                >
                                                    Testar
                                                </button>
                                                <button 
                                                    onClick={() => handleRemoveAlert(alert.id)}
                                                    className="text-red-400 hover:text-red-600 px-2"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Add New Alert Form */}
                                <div className="border-t pt-4">
                                    <h3 className="font-semibold text-gray-700 mb-3">Adicionar Nova Regra</h3>
                                    <div className="flex flex-wrap gap-3 items-end">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                                            <select 
                                                value={newAlertType}
                                                onChange={(e) => {
                                                    const val = e.target.value as any;
                                                    setNewAlertType(val);
                                                    // Set default value appropriately based on type
                                                    if (val === 'TARGET') {
                                                        setNewAlertValue(current); // Default to current price for ease
                                                    } else {
                                                        setNewAlertValue(0.03);
                                                    }
                                                }}
                                                className="border rounded p-2 text-sm bg-white"
                                            >
                                                <option value="RISE">Variação: Subir</option>
                                                <option value="FALL">Variação: Cair</option>
                                                <option value="TARGET">Preço Alvo</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                {newAlertType === 'TARGET' ? 'Valor Alvo (R$)' : 'Diferença (R$)'}
                                            </label>
                                            <input 
                                                type="number" 
                                                step="0.0001"
                                                className="border rounded p-2 text-sm w-24"
                                                value={newAlertValue}
                                                onChange={(e) => setNewAlertValue(e.target.valueAsNumber)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Enviar Por</label>
                                            <select 
                                                value={newAlertTarget}
                                                onChange={(e) => setNewAlertTarget(e.target.value)}
                                                className="border rounded p-2 text-sm bg-white w-40"
                                            >
                                                <option value="" disabled>Escolha...</option>
                                                {waSessions.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if (!newAlertTarggetCheck()) return;

                                                let finalType: any = newAlertType;
                                                // If TARGET, decide ABOVE or BELOW based on current price
                                                if (newAlertType === 'TARGET') {
                                                    if (newAlertValue > current) finalType = 'ABOVE';
                                                    else finalType = 'BELOW';
                                                }

                                                const newAlert: AlertRule = {
                                                    id: Math.random().toString(36).substr(2, 9),
                                                    type: finalType,
                                                    value: newAlertValue,
                                                    targetSession: newAlertTarget
                                                };

                                                const updated = [...alerts, newAlert];
                                                setAlerts(updated);
                                                saveSettingsInternal(updated, waSessions);
                                                
                                                // Reset defaults
                                                setNewAlertType('RISE');
                                                setNewAlertValue(0.03);
                                            }}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 mb-[1px]"
                                        >
                                            + Adicionar
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        {newAlertType === 'TARGET' 
                                            ? `Alerta único: Será enviado quando o dólar ${newAlertValue > current ? 'subir até' : 'cair até'} R$ ${newAlertValue}`
                                            : 'Alerta recorrente: Monitora variações a partir da base atual.'}
                                    </p>
                                    {saved && <span className="text-xs text-green-600 mt-2 block">Atualizado automaticamente!</span>}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-yellow-50 p-6 rounded-lg shadow border border-yellow-200">
                                <h2 className="text-lg font-bold text-yellow-800 mb-2">Configure seu Alerta</h2>
                                <p className="text-yellow-700">Conecte pelo menos um WhatsApp no painel ao lado para habilitar as configurações de alerta.</p>
                            </div>
                        )}
                    </div>

                    {/* Right Col: WhatsApp Panel */}
                    <div>
                        <WhatsAppPanel 
                            socket={socket} 
                            ownerId={userId} 
                            sessions={waSessions}
                            onUpdateSessions={handleUpdateSessions}
                        />
                        
                        <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="font-semibold text-blue-800">Link Público</h3>
                            <p className="text-sm text-blue-600 mt-1">Compartilhe este painel (versão somente leitura):</p>
                            <a 
                                href="/public" 
                                target="_blank"
                                className="text-blue-500 underline text-sm break-all mt-2 block"
                            >
                                {typeof window !== 'undefined' ? `${window.location.origin}/public` : '/public'}
                            </a>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
