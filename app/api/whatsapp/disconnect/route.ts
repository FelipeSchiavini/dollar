import { whatsappManager } from '@/lib/whatsappManager';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { userId } = await request.json();
        if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

        await whatsappManager.disconnectSession(userId);

        return NextResponse.json({ success: true, message: 'Disconnected' });
    } catch (e) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
