'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function DollarChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return <div className="p-4 text-center text-gray-500">Aguardando dados...</div>;
    }

    // Format data locally if needed or assume it matches Recharts expectation
    // timestamp string might be long, so maybe tickFormatter
    return (
        <div className="h-[300px] w-full bg-white p-4 rounded-lg shadow border">
            <h3 className="mb-4 text-lg font-semibold text-gray-700">Histórico USD/BRL</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="timestamp" 
                        tick={{fontSize: 10}} 
                        tickFormatter={(val) => val.split(' ')[1] || val} // Show time only 
                    />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="bid" stroke="#8884d8" activeDot={{ r: 8 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
