'use client';

import { DollarChart } from '@/components/DollarChart';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export default function PublicPage() {
    const [data, setData] = useState<any[]>([]);
    const [current, setCurrent] = useState<number>(0);
    const [diff, setDiff] = useState<number>(0);

    useEffect(() => {
        const socketInstance = io();

        socketInstance.on('usd-update', (payload: any) => {
            setCurrent(payload.current);
            setDiff(payload.diff);
            setData(payload.history);
        });

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="max-w-4xl w-full bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-green-600 p-6 text-white text-center">
                    <h1 className="text-3xl font-bold">Monitor Dólar Público 🇺🇸</h1>
                    <p className="opacity-90">Atualizações em tempo real</p>
                </div>
                
                <div className="p-8 text-center border-b">
                    <p className="text-gray-500 uppercase tracking-widest text-sm font-semibold">Cotação Atual</p>
                    <div className="text-6xl font-bold text-gray-800 my-4">R$ {current.toFixed(4)}</div>
                    <div className={`text-xl font-medium inline-block px-4 py-1 rounded-full ${diff >= 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(4)}
                    </div>
                </div>

                <div className="p-8 bg-gray-50">
                    <DollarChart data={data} />
                </div>
            </div>
        </div>
    );
}
