import axios from 'axios';
import { Server } from 'socket.io'; // Type check
import { getDb, HistoricalData } from './db';
import { whatsappManager } from './whatsappManager';

const CHECK_INTERVAL = 60 * 1000; // 1 minute

export const startMonitor = (io: Server) => {
    console.log("Starting USD Monitor...");
    
    // Initial Run
    checkAndAlert(io);

    setInterval(() => checkAndAlert(io), CHECK_INTERVAL);
};

async function checkAndAlert(io: Server) {
    try {
const response = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL', {
            headers: { 'User-Agent': 'DollarMonitor/1.0' }
        });
        const data = response.data.USDBRL;
        const currentBid = parseFloat(data.bid);
        const now = new Date();
        const timestamp = now.toLocaleString('pt-BR');

        const db = await getDb();

        const lastBid = db.data.lastBid || currentBid;
        const diff = currentBid - lastBid;

        // Log history
        const historyItem: HistoricalData = {
            timestamp,
            bid: currentBid
        };
        db.data.history.push(historyItem);
        // Limit history to last 1000 entries to save space
        if(db.data.history.length > 1000) db.data.history.shift();

        // Update Last Bid
        db.data.lastBid = currentBid;
        await db.write();

        // Emit to Frontend via Socket.IO
        io.emit('usd-update', { 
            current: currentBid, 
            last: lastBid, 
            diff, 
            timestamp, 
            history: db.data.history 
        });

        console.log(`[${timestamp}] USD: ${currentBid} | Diff: ${diff.toFixed(4)}`);

        // Check Alerts for each user
        let dbChanged = false;
        
        for (const user of db.data.users) {
            if (!user.active || !user.alerts) continue;

            for (const alert of user.alerts) {
                // Initialize baseline if missing (first run for this rule)
                if (alert.lastTriggeredValue === undefined) {
                    alert.lastTriggeredValue = currentBid;
                    dbChanged = true;
                    continue; // Skip check on initialization
                }

                const baseValue = alert.lastTriggeredValue;
                const ruleDiff = currentBid - baseValue;
                
                let triggered = false;
                let conditionStr = '';

                if (alert.type === 'RISE' && ruleDiff > 0 && ruleDiff >= alert.value) {
                    triggered = true;
                    conditionStr = 'Subiu';
                }
                
                if (alert.type === 'FALL' && ruleDiff < 0 && Math.abs(ruleDiff) >= alert.value) {
                    triggered = true;
                    conditionStr = 'Caiu';
                }

                // Absolute Target Logic
                if (alert.type === 'ABOVE' && currentBid >= alert.value) {
                    triggered = true;
                    conditionStr = 'Atingiu ALVO (Alta)';
                }

                if (alert.type === 'BELOW' && currentBid <= alert.value) {
                    triggered = true;
                    conditionStr = 'Atingiu ALVO (Baixa)';
                }

                if (triggered) {
                    // Check if target session is active
                    const status = whatsappManager.getSessionStatus(alert.targetSession);
                    console.log(`[Monitor] Rule ${alert.id} triggered. Target: ${alert.targetSession}, Status: ${status.status}`);
                    
                    // Strict check: Must be READY to send.
                    if (status.status === 'READY') {
                        const isTargetAlert = alert.type === 'ABOVE' || alert.type === 'BELOW';
                        
                        const msg = `📢 *ALERT DÓLAR* 🇺🇸\n\n` +
                                    (isTargetAlert 
                                        ? `${conditionStr}: R$ ${currentBid.toFixed(4)}\n` 
                                        : `${conditionStr}: R$ ${Math.abs(ruleDiff).toFixed(4)}\n`) +
                                    `Atual: R$ ${currentBid.toFixed(4)}\n` +
                                    (isTargetAlert 
                                        ? `Meta: R$ ${alert.value.toFixed(4)}\n`
                                        : `Base Anterior: R$ ${baseValue.toFixed(4)}\n`) +
                                    `Hora: ${timestamp}`;
                        
                        try {
                             await whatsappManager.sendMessage(alert.targetSession, alert.targetSession, msg);
                             console.log(`[Monitor] Alert sent for rule ${alert.id} to ${alert.targetSession}`);
                             
                             // If it's a TARGET alert, remove it from list ONLY if sent successfully
                             if (isTargetAlert) {
                                 console.log(`[Monitor] Removing satisfied target rule ${alert.id}`);
                                 user.alerts = user.alerts.filter(a => a.id !== alert.id);
                                 dbChanged = true;
                                 continue; // Skip updating lastTriggeredValue for this deleted rule
                             }

                            // Update baseline for persistent rules (RISE/FALL) if sent
                            if (!isTargetAlert) {
                                alert.lastTriggeredValue = currentBid;
                                dbChanged = true;
                            }

                        } catch (e) {
                            console.error(`[Monitor] Failed to send alert for rule ${alert.id}. Will retry next cycle.`, e);
                        }
                    } else {
                        console.log(`[Monitor] Skipping alert for rule ${alert.id}: Session not READY.`);
                    }
                }
            }
        }

        if (dbChanged) {
            await db.write();
        }

    } catch (err) {
        console.error("Monitor Error:", err);
    }
}
