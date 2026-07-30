const { app, BrowserWindow, desktopCapturer, session, ipcMain, clipboard } = require('electron');
const path = require('path');
const { mouse, Point, keyboard, Key, screen } = require('@nut-tree/nut-js');

// nut.js için hızlandırmalar (gecikmeleri azaltmak)
mouse.config.autoDelayMs = 0;
keyboard.config.autoDelayMs = 0;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.cjs'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    let selectedScreenId = null;

    let lastReadClipboard = clipboard.readText();
    let lastWrittenClipboard = '';

    setInterval(() => {
        const currentText = clipboard.readText();
        if (currentText && currentText !== lastReadClipboard && currentText !== lastWrittenClipboard) {
            lastReadClipboard = currentText;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('clipboard-changed', currentText);
            }
        }
    }, 1000);

    ipcMain.on('write-clipboard', (event, text) => {
        lastWrittenClipboard = text;
        clipboard.writeText(text);
    });

    ipcMain.handle('get-screens', async () => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen'] });
            return sources.map(s => ({
                id: s.id,
                name: s.name
            }));
        } catch (e) {
            console.error("Ekranlar alınamadı:", e);
            return [];
        }
    });

    ipcMain.on('set-screen', (event, screenId) => {
        selectedScreenId = screenId;
    });

    // YENİ: Electron için Ekran Paylaşım İzni
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            let selectedSource = sources[0]; // Varsayılan olarak ilk ekranı paylaş
            if (selectedScreenId) {
                const found = sources.find(s => s.id === selectedScreenId);
                if (found) selectedSource = found;
            }
            callback({ video: selectedSource });
        }).catch(err => {
            console.error('Ekran kaynakları alınamadı:', err);
        });
    });

    // Üretim (Packaged) veya Geliştirme (Dev) ortamı kontrolü
    if (app.isPackaged) {
        // Build edildiyse, paketlenmiş statik dosyaları (dist) yükle
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    } else {
        // Geliştirme aşamasında React (Vite) sunucusunu yükle
        mainWindow.loadURL('http://localhost:5173');
    }
}

// IPC komutlarını dinle
ipcMain.on('remote-control', async (event, data) => {
    try {
        switch (data.type) {
            case 'mousemove':
                // x ve y 0 ile 1 aralığında görecelidir
                const w = await screen.width();
                const h = await screen.height();
                await mouse.setPosition(new Point(data.x * w, data.y * h));
                break;
            case 'click':
                await mouse.leftClick();
                break;
            case 'keydown':
                // Basit tuş dönüştürücü eklenebilir, şimdilik deneme
                // Sadece geçerli Key enum desteklenir, örn robotjs'e göre değişebilir.
                // try {
                //      await keyboard.type(data.key);
                // } catch (e) {}
                break;
        }
    } catch (error) {
        console.error("Control error:", error);
    }
});

// WebRTC mDNS kısıtlamalarını devre dışı bırak (Yerel ağ bağlantılarının p2p çalışabilmesi için)
app.commandLine.appendSwitch('enable-webrtc-hide-local-ips-with-mdns', 'false');
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
