const { contextBridge, ipcRenderer } = require('electron');

// React arayüzünün (Frontend) sadece bizim izin verdiğimiz fonksiyonlara erişmesini sağlıyoruz
contextBridge.exposeInMainWorld('api', {
    ping: () => 'pong', // Şimdilik test amaçlı basit bir fonksiyon
    sendRemoteControl: (data) => ipcRenderer.send('remote-control', data),
    getScreens: () => ipcRenderer.invoke('get-screens'),
    setScreen: (id) => ipcRenderer.send('set-screen', id)
});
