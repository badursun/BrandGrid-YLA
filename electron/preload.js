const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openProgress: () => ipcRenderer.send('open-progress'),
  closeProgress: () => ipcRenderer.send('close-progress'),
});