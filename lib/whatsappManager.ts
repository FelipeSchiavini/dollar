import { EventEmitter } from 'events';
import { Client, LocalAuth } from 'whatsapp-web.js';

// Event emitter for QR updates, status changes, etc.
export const waEvents = new EventEmitter();

export interface SessionInfo {
    userId: string;
    status: 'DISCONNECTED' | 'QR' | 'READY' | 'AUTHENTICATED';
    qr?: string;
}

interface Session {
    client: Client;
    info: SessionInfo;
}

const sessions: Map<string, Session> = new Map();

export const whatsappManager = {
    startSession: async (userId: string) => {
        console.log(`[Manager] Request to start session for ${userId}`);
        
        if (sessions.has(userId)) {
            const s = sessions.get(userId)!;
            console.log(`[Manager] Session exists. Status: ${s.info.status}`);
            
            if(s.info.status === 'READY' || s.info.status === 'AUTHENTICATED') {
                console.log(`[Manager] Session already READY. Emitting update.`);
                waEvents.emit('update', s.info);
                return;
            }
            
            // If exists but not ready, we MUST clean everything to ensure a fresh QR is generated
            console.log(`[Manager] Session exists but not ready. Performing full cleanup to force new QR...`);
            await whatsappManager._doCleanup(userId);
        }

        // Double check auth folder existence and nuke it if we want to ensure QR
        // If we want "Connect" to ALWAYS show QR (unless ready), we should probably delete the auth folder here 
        // regardless, just to be sure we are not restoring a broken session.
        // The user requirement "Connect deve sempre mostrar o QR" implies we shouldn't try to restore saved sessions
        // if we are explicitly starting a new open. But maybe they just mean "if I click connect, give me a QR".
        // The _doCleanup call above handles the map and client. Let's also ensure the file path is gone if we are here.
        whatsappManager._removeAuthFolder(userId);

        console.log(`[Manager] Initializing new Client for ${userId}...`);
        
        const client = new Client({
            authStrategy: new LocalAuth({ clientId: userId }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', // Critical for container memory
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process' // May help reduced memory usage
                ],
            }
        });

        // Initialize status
        const info: SessionInfo = { userId, status: 'DISCONNECTED' };
        sessions.set(userId, { client, info });

        client.on('qr', (qr) => {
            console.log(`[Manager] QR Code RECEIVED for ${userId}`);
            info.status = 'QR';
            info.qr = qr;
            waEvents.emit('update', info);
        });

        client.on('ready', async () => {
            console.log(`[Manager] Client ${userId} is READY!`);
            info.status = 'READY';
            info.qr = undefined;
            waEvents.emit('update', info);

            // Send confirmation message
            try {
                // Get the user's own ID (the connected phone number)
                const myId = client.info.wid._serialized;
                await client.sendMessage(myId, "✅ Monitor Dólar: Sincronização realizada com sucesso! Você receberá alertas aqui.");
                console.log(`[Manager] Sent confirmation to ${myId}`);
            } catch (err) {
                console.error("[Manager] Failed to send confirmation message:", err);
            }
        });

        client.on('authenticated', () => {
            console.log(`Client ${userId} authenticated!`);
            info.status = 'AUTHENTICATED';
            info.qr = undefined;
            waEvents.emit('update', info);
        });

        client.on('disconnected', async (reason) => {
            console.log(`Client ${userId} disconnected: ${reason}`);
            // Auto cleanup on disconnect
            await whatsappManager._doCleanup(userId);
        });

        client.on('auth_failure', async (msg) => {
            console.error(`[Manager] AUTH FAILURE for ${userId}:`, msg);
            await whatsappManager._doCleanup(userId);
        });

        console.log(`[Manager] Invoking client.initialize() for ${userId}...`);
        try {
            await client.initialize();
            console.log(`[Manager] client.initialize() called for ${userId}`);
        } catch (e) {
            console.error(`[Manager] Failed to initialize client ${userId}`, e);
            await whatsappManager._doCleanup(userId);
        }
    },

    disconnectSession: async (userId: string) => {
        console.log(`[Manager] Manual disconnect requested for ${userId}...`);
        await whatsappManager._doCleanup(userId);
    },

    // Helper to completely remove a session
    _doCleanup: async (userId: string) => {
        const session = sessions.get(userId);
        if (session) {
            try {
                 // Try to logout to unlink device
                if (session.info.status === 'READY') {
                    console.log(`[Manager Cleanup] Logging out client ${userId}...`);
                     // Timeout the logout in case it hangs
                    const logoutPromise = session.client.logout();
                    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
                    await Promise.race([logoutPromise, timeoutPromise]);
                }
            } catch(e) { console.error(`[Manager Cleanup] Logout failed/skipped for ${userId}`, e); }

            try {
                console.log(`[Manager Cleanup] Destroying client ${userId}...`);
                await session.client.destroy();
            } catch(e) { console.error(`[Manager Cleanup] Destroy failed for ${userId}`, e); }

            sessions.delete(userId);
        }

        // Force file cleanup
        whatsappManager._removeAuthFolder(userId);
        
        // Notify frontend
        waEvents.emit('update', { userId, status: 'DISCONNECTED' });
        console.log(`[Manager Cleanup] Cleanup finished for ${userId}`);
    },

    _removeAuthFolder: (userId: string) => {
        const fs = require('fs');
        const path = require('path');
        const authPath = path.join(process.cwd(), '.wwebjs_auth', `session-${userId}`);
        
        if (fs.existsSync(authPath)) {
             try {
                console.log(`[Manager] Deleting auth folder for ${userId}: ${authPath}`);
                fs.rmSync(authPath, { recursive: true, force: true });
             } catch (e) {
                console.error(`[Manager] Error deleting auth folder ${userId}:`, e);
             }
        }
    },

    getSessionStatus: (userId: string): SessionInfo => {
        const session = sessions.get(userId);
        return session ? session.info : { userId, status: 'DISCONNECTED' };
    },

    sendMessage: async (userId: string, to: string, message: string) => {
        const session = sessions.get(userId);
        if (session && session.info.status === 'READY') {
            // Ensure chatId is properly formatted
            let chatId = to;
            if (!chatId.includes('@')) {
                chatId = `${chatId}@c.us`;
            }
            console.log(`[Manager] Sending message to ${chatId}`);
            await session.client.sendMessage(chatId, message);
        } else {
            // Throwing error so caller knows it failed
            throw new Error(`Cannot send message for ${userId}: Client not ready (Status: ${session?.info.status ?? 'Unknown'}).`);
        }
    }
};
