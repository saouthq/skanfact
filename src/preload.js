// Pont sécurisé entre le renderer et le process principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skanfact', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  dataPath: () => ipcRenderer.invoke('data:path'),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  pickLogo: () => ipcRenderer.invoke('logo:pick'),
  exportPdf: (html, suggestedName) => ipcRenderer.invoke('pdf:export', { html, suggestedName }),
  openPath: (p) => ipcRenderer.invoke('shell:open', p),
  showInFolder: (p) => ipcRenderer.invoke('shell:showInFolder', p),
  // mises à jour
  updateVersion: () => ipcRenderer.invoke('update:version'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  updateSetToken: (t) => ipcRenderer.invoke('update:setToken', t),
  onUpdateEvent: (cb) => { ipcRenderer.on('update:event', (_e, data) => cb(data)); }
});
