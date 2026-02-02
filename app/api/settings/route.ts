import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, alerts, phoneNumbers, active, whatsappSessions } = body;

        if (!id) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const db = await getDb();
        const existingIndex = db.data.users.findIndex(u => u.id === id);

        const newUserConfig = {
            id,
            alerts: alerts || [],
            phoneNumbers: phoneNumbers || [], 
            active: active ?? true,
            whatsappSessions: whatsappSessions || []
        };

        if (existingIndex >= 0) {
            db.data.users[existingIndex] = newUserConfig;
        } else {
            db.data.users.push(newUserConfig);
        }

        await db.write();
        
        return NextResponse.json({ success: true, config: newUserConfig });
    } catch (e) {
        console.error("Settings Error:", e);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    // Helper to get config by ID (passed via query param)
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const db = await getDb();
    const user = db.data.users.find(u => u.id === id);

    return NextResponse.json({ user: user || null });
}
