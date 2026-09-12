// Pont sécurisé de l'application Cabinet. Surface volontairement minuscule : on reçoit, on lit,
// on relance. Aucun appel ne permet d'écrire dans les données d'un client.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cabinet', {
  status: () => ipcRenderer.invoke('cab:status'),
  unlock: (password) => ipcRenderer.invoke('cab:unlock', password),
  state: () => ipcRenderer.invoke('cab:state'),
  saveCabinet: (patch) => ipcRenderer.invoke('cab:saveCabinet', patch),
  saveDossier: (id, patch) => ipcRenderer.invoke('cab:saveDossier', { id, patch }),
  demo: (on) => ipcRenderer.invoke('cab:demo', !!on),
  exportPairing: () => ipcRenderer.invoke('cab:exportPairing'),
  importPack: (opts) => ipcRenderer.invoke('cab:importPack', opts || {}),
  listPack: (packPath, password) => ipcRenderer.invoke('cab:listPack', { packPath, password }),
  openInPack: (packPath, name, password) => ipcRenderer.invoke('cab:openInPack', { packPath, name, password }),
  mail: (opts) => ipcRenderer.invoke('cab:mail', opts),
  reveal: (p) => ipcRenderer.invoke('cab:reveal', p),
  onMenuAction: (cb) => { ipcRenderer.on('menu:action', (_e, name) => cb(name)); }
});
