// Pont sécurisé entre le renderer et le process principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skanfact', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  dataPath: () => ipcRenderer.invoke('data:path'),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: (opts) => ipcRenderer.invoke('data:import', opts),
  unlock: (password) => ipcRenderer.invoke('data:unlock', password),
  lock: () => ipcRenderer.invoke('data:lock'),
  securityInfo: () => ipcRenderer.invoke('data:security'),
  setPassword: (opts) => ipcRenderer.invoke('data:setPassword', opts),
  externalBackupInfo: () => ipcRenderer.invoke('backups:externalInfo'),
  setExternalBackup: (dir) => ipcRenderer.invoke('backups:setExternal', dir),
  chooseExternalBackup: () => ipcRenderer.invoke('backups:chooseExternal'),
  openBackups: () => ipcRenderer.invoke('backups:open'),
  createBackup: () => ipcRenderer.invoke('backups:create'),
  listBackups: () => ipcRenderer.invoke('backups:list'),
  pickLogo: (title) => ipcRenderer.invoke('logo:pick', title),
  exportPdf: (html, suggestedName) => ipcRenderer.invoke('pdf:export', { html, suggestedName }),
  exportPdfMany: (files, folderName) => ipcRenderer.invoke('pdf:exportMany', { files, folderName }),
  saveText: (suggestedName, content) => ipcRenderer.invoke('file:saveText', { suggestedName, content }),
  exportPdfSilent: (html, name) => ipcRenderer.invoke('pdf:exportSilent', { html, name }),
  composeMail: (opts) => ipcRenderer.invoke('mail:compose', opts),
  openPath: (p) => ipcRenderer.invoke('shell:open', p),
  showInFolder: (p) => ipcRenderer.invoke('shell:showInFolder', p),
  changelog: () => ipcRenderer.invoke('app:changelog'),
  onMenuAction: (cb) => { ipcRenderer.on('menu:action', (_e, name) => cb(name)); },
  // mises à jour
  updateVersion: () => ipcRenderer.invoke('update:version'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  updateSetToken: (t) => ipcRenderer.invoke('update:setToken', t),
  updateOpenReleases: () => ipcRenderer.invoke('update:openReleases'),
  onUpdateEvent: (cb) => { ipcRenderer.on('update:event', (_e, data) => cb(data)); }
});
