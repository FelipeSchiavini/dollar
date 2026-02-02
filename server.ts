import { createServer } from 'http';
import next from 'next';
import { Server } from "socket.io";
import { parse } from 'url';
import { getDb } from './lib/db';
import { startMonitor } from './lib/monitor';
import { waEvents, whatsappManager } from './lib/whatsappManager';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Bind to all interfaces for Render
const port = parseInt(process.env.PORT || '3001', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Socket.IO Setup
  const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected to Socket.IO');

    socket.on('join-session', (userId) => {
        console.log(`Socket joined session room: ${userId}`);
        socket.join(userId);
        // Send initial status
        const status = whatsappManager.getSessionStatus(userId);
        socket.emit('wa-status', status);
    });

    socket.on('start-session', (userId) => {
        console.log(`Socket requested start-session for ${userId}`);
        whatsappManager.startSession(userId);
    });

    socket.on('stop-session', (userId) => {
        console.log(`Socket requested stop-session for ${userId}`);
        whatsappManager.disconnectSession(userId);
    });

    socket.on('test-message', async ({ sessionId, target, rule }) => {
        console.log(`Socket requested test message from ${sessionId} to ${target}`);
        try {
            let msg = "🔔 *Teste de Conexão Monitor Dólar* \n\n";
            
            if (rule) {
                const typeMap: any = { 'RISE': 'Subir', 'FALL': 'Cair', 'ABOVE': 'Acima de', 'BELOW': 'Abaixo de' };
                const desc = typeMap[rule.type] || rule.type;
                const val = parseFloat(rule.value).toFixed(4);
                
                msg += `Verificando regra: *${desc} R$ ${val}*\n`;
                msg += "Se você recebeu isso, o alerta está configurado corretamente! ✅";
            } else {
                msg +=  "Sua conexão está funcionando! 🚀";
            }

            // Debug log
            const status = whatsappManager.getSessionStatus(sessionId);
            console.log(`[Test] Attempting send. Current Status of ${sessionId}: ${status.status}`);

            await whatsappManager.sendMessage(sessionId, target, msg);
        } catch (e: any) {
            console.error("Error sending test message:", e.message || e);
            // Optionally emit back to UI to show error toast
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
  });

  // Forward WhatsApp Events to Socket.IO
  waEvents.on('update', (info) => {
      // Broadcast to specific user room
      io.to(info.userId).emit('wa-status', info);
      // Also broadcast to a "public dashboard" room if needed, but for now specific user
  });

  // Start the USD Monitor Loop
  startMonitor(io);

  // Restore WhatsApp Sessions
(async () => {
    console.log('Restoring sessions...');
    try {
        const db = await getDb();
        if (db.data && db.data.users) {
            for (const user of db.data.users) {
                if (user.whatsappSessions) {
                    for (const sessionId of user.whatsappSessions) {
                        console.log(`Restoring session: ${sessionId}`);
                        // We use a slight delay or just fire and forget, 
                        // as startSession handles its own async initialization
                        whatsappManager.startSession(sessionId);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to restore sessions:", e);
    }
})();

server.listen(port, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
});
