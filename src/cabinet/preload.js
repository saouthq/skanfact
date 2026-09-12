// Pont sécurisé de l'application Cabinet. Surface volontairement minuscule : on reçoit, on lit,
// on relance. Aucun appel ne permet d'écrire dans les données d'un client.
//
// Un test relit ce fichier et refuse qu'y apparaissent les deux appels de l'app entreprise qui
// écrivent une comptabilité (l'enregistrement des données et la fabrication d'un paquet). Le jour où
// quelqu'un les ajouterait ici « pour dépanner un client », l'application cesserait d'être celle
// qu'on a promise au comptable : celle qui lit et ne touche à rien.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('cabinet', {
  // ouverture
  status: () => ipcRenderer.invoke('cab:status'),
  unlock: (password) => ipcRenderer.invoke('cab:unlock', password),
  lock: () => ipcRenderer.invoke('cab:lock'),
  state: () => ipcRenderer.invoke('cab:state'),

  // le cabinet et ses dossiers
  saveCabinet: (patch) => ipcRenderer.invoke('cab:saveCabinet', patch),
  saveDossier: (id, patch) => ipcRenderer.invoke('cab:saveDossier', { id, patch }),
  newDossier: (fields) => ipcRenderer.invoke('cab:newDossier', fields),
  importDossiers: (text) => ipcRenderer.invoke('cab:importDossiers', text),
  deleteDossier: (id) => ipcRenderer.invoke('cab:deleteDossier', id),
  deletePack: (id, month) => ipcRenderer.invoke('cab:deletePack', { id, month }),
  noteRelance: (id, months, via, note) => ipcRenderer.invoke('cab:noteRelance', { id, months, via, note }),
  demo: (on) => ipcRenderer.invoke('cab:demo', !!on),
  exportPairing: () => ipcRenderer.invoke('cab:exportPairing'),

  // paquets
  importPack: (opts) => ipcRenderer.invoke('cab:importPack', opts || {}),
  listPack: (packPath, password) => ipcRenderer.invoke('cab:listPack', { packPath, password }),
  openInPack: (packPath, name, password) => ipcRenderer.invoke('cab:openInPack', { packPath, name, password }),
  extractPack: (packPath, password, label) => ipcRenderer.invoke('cab:extractPack', { packPath, password, label }),
  ecrituresPlan: (opts) => ipcRenderer.invoke('cab:ecrituresPlan', opts),
  exportEcritures: (opts) => ipcRenderer.invoke('cab:exportEcritures', opts),

  // filets : sauvegardes, copie externe, clé de secours
  backups: () => ipcRenderer.invoke('cab:backups'),
  backupNow: (label) => ipcRenderer.invoke('cab:backupNow', label),
  peekBackup: (path, password) => ipcRenderer.invoke('cab:peekBackup', { path, password }),
  restore: (path, password) => ipcRenderer.invoke('cab:restore', { path, password }),
  pickExternal: () => ipcRenderer.invoke('cab:pickExternal'),
  clearExternal: () => ipcRenderer.invoke('cab:clearExternal'),
  mirrorNow: () => ipcRenderer.invoke('cab:mirrorNow'),
  changePassword: (current, next) => ipcRenderer.invoke('cab:changePassword', { current, next }),
  exportRecovery: (password) => ipcRenderer.invoke('cab:exportRecovery', password),
  importRecovery: (password) => ipcRenderer.invoke('cab:importRecovery', password),
  recoveryStatus: () => ipcRenderer.invoke('cab:recoveryStatus'),
  exportCsv: (rows, name) => ipcRenderer.invoke('cab:exportCsv', { rows, name }),

  // contacter un client
  mail: (opts) => ipcRenderer.invoke('cab:mail', opts),
  tel: (opts) => ipcRenderer.invoke('cab:tel', opts),
  reveal: (p) => ipcRenderer.invoke('cab:reveal', p),

  // dépannage
  support: () => ipcRenderer.invoke('cab:support'),
  openLog: () => ipcRenderer.invoke('cab:openLog'),
  openDataDir: () => ipcRenderer.invoke('cab:openDataDir'),

  // mises à jour (6.6.0)
  updVersion: () => ipcRenderer.invoke('upd:version'),
  updCheck: () => ipcRenderer.invoke('upd:check'),
  updDownload: () => ipcRenderer.invoke('upd:download'),
  updInstall: () => ipcRenderer.invoke('upd:install'),
  updSetToken: (t) => ipcRenderer.invoke('upd:setToken', t),
  updOpenReleases: () => ipcRenderer.invoke('upd:openReleases'),

  // Depuis Electron 32, `File.path` n'existe plus : sans ce pont, un fichier glissé sur la fenêtre
  // arrive sans son chemin et le glisser-déposer ne peut rien importer.
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },
  takePending: () => ipcRenderer.invoke('cab:takePending'),

  onUpdateEvent: (cb) => { ipcRenderer.on('update:event', (_e, d) => cb(d)); },
  onMenuAction: (cb) => { ipcRenderer.on('menu:action', (_e, name) => cb(name)); },
  onFileOpen: (cb) => { ipcRenderer.on('file:open', (_e, f) => cb(f)); }
});
