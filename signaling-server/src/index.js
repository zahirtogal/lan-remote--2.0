const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(cors()); // CORS ayarlarının dış isteklere tamamen açık olması
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Bağlı cihazları hafızada tutacağımız liste
const clients = new Map();

wss.on('connection', (ws) => {
    console.log('Yeni bir cihaz bağlandı!');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 1. Cihaz kendini kayıt ediyorsa (ID alıyorsa)
            if (data.type === 'register') {
                clients.set(data.id, ws);
                ws.id = data.id;
                console.log(`Cihaz kayıt oldu: ${data.id}`);
            }
            // 2. Cihaz başka bir cihaza sinyal (arama/cevap/veri) gönderiyorsa
            else if (data.targetId) {
                const targetWs = clients.get(data.targetId);

                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify(data));
                    console.log(`Sinyal iletildi: ${data.id} -> ${data.targetId} (Tip: ${data.type})`);
                } else {
                    console.log(`Hedef cihaz bulunamadı veya çevrimdışı: ${data.targetId}`);
                }
            }
        } catch (error) {
            console.error('Mesaj işlenirken hata oluştu:', error);
        }
    });

    // Cihaz koptuğunda onu listeden sil
    ws.on('close', () => {
        if (ws.id) {
            clients.delete(ws.id);
            console.log(`Cihaz ayrıldı: ${ws.id}`);
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Sinyalizasyon Sunucusu çalışıyor. Port: ${PORT}`);
});