const { contextBridge, ipcRenderer } = require('electron');

// React arayüzünün (Frontend) sadece bizim izin verdiğimiz fonksiyonlara erişmesini sağlıyoruz
contextBridge.exposeInMainWorld('api', {
    ping: () => 'pong', // Şimdilik test amaçlı basit bir fonksiyon
    sendRemoteControl: (data) => ipcRenderer.send('remote-control', data)
});
