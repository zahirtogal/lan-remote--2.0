const { app, BrowserWindow, desktopCapturer, session, ipcMain } = require('electron');
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

    // YENİ: Electron için Ekran Paylaşım İzni
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            // Sistemdeki ilk (ana) ekranı otomatik olarak onayla ve paylaş
            callback({ video: sources[0] });
        }).catch(err => {
            console.error('Ekran kaynakları alınamadı:', err);
        });
    });

    // Geliştirme aşamasında React (Vite) sunucusunun ekranını yükleyeceğiz
    mainWindow.loadURL('http://localhost:5173');
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
