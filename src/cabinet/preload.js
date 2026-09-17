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

  // reprendre un cabinet venu d'un autre ordinateur, avant toute création de clé
  pickRecover: (mode) => ipcRenderer.invoke('cab:pickRecover', mode),
  adopt: (source, password) => ipcRenderer.invoke('cab:adopt', { path: source, password }),

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
  // Arrêter un import en cours. Le message part tout de suite ; l'arrêt, lui, attend la fin du
  // paquet en cours : on n'interrompt jamais une écriture au milieu.
  cancelImport: () => ipcRenderer.send('cab:importCancel'),
  listPack: (packPath, password) => ipcRenderer.invoke('cab:listPack', { packPath, password }),
  openInPack: (packPath, name, password) => ipcRenderer.invoke('cab:openInPack', { packPath, name, password }),
  extractPack: (packPath, password, label) => ipcRenderer.invoke('cab:extractPack', { packPath, password, label }),
  inbox: () => ipcRenderer.invoke('cab:inbox'),
  pickInbox: () => ipcRenderer.invoke('cab:pickInbox'),
  clearInbox: () => ipcRenderer.invoke('cab:clearInbox'),
  inboxIgnore: (paths) => ipcRenderer.invoke('cab:inboxIgnore', paths),
  ecrituresPlan: (opts) => ipcRenderer.invoke('cab:ecrituresPlan', opts),
  // Les écritures d'un dossier, lues dans ses paquets (9.1.0). Le processus principal déchiffre et
  // rend le CSV brut ; c'est le renderer qui l'analyse, par `compta.js` — le même moteur que
  // l'application du client, c'est ce qui fait que les deux balances tombent pareil.
  livres: (dossierId, du, au) => ipcRenderer.invoke('cab:livres', { dossierId, du, au }),
  // Le livre du dossier (9.2.0). Rien ici n'écrit chez le CLIENT : tout ce qui suit touche le
  // livre que le CABINET tient pour lui, dans ses propres fichiers. C'est la différence qui
  // justifie que ces portes existent alors que `data:save` et `pack:build` restent interdits.
  livre: (dossierId, annee) => ipcRenderer.invoke('cab:livre', { dossierId, annee }),
  livreIndex: (dossierId) => ipcRenderer.invoke('cab:livreIndex', { dossierId }),
  reprendre: (o) => ipcRenderer.invoke('cab:reprendre', o || {}),
  importerPlan: (o) => ipcRenderer.invoke('cab:importerPlan', o || {}),
  importerBalance: (o) => ipcRenderer.invoke('cab:importerBalance', o || {}),
  valider: (dossierId, annee, id) => ipcRenderer.invoke('cab:valider', { dossierId, annee, id }),
  contrepasser: (dossierId, annee, id, date) => ipcRenderer.invoke('cab:contrepasser', { dossierId, annee, id, date }),
  saisir: (dossierId, annee, ecriture) => ipcRenderer.invoke('cab:saisir', { dossierId, annee, ecriture }),
  lettrer: (o) => ipcRenderer.invoke('cab:lettrer', o || {}),
  // La saisie (9.3.0). Même remarque que ci-dessus : tout cela touche le livre que le CABINET
  // tient, jamais les données du client. `modifierEcriture` et `supprimerEcriture` ne peuvent
  // atteindre qu'un brouillard — le garde-fou vit dans `compta.js`, pas ici.
  modifierEcriture: (dossierId, annee, id, patch) => ipcRenderer.invoke('cab:modifierEcriture', { dossierId, annee, id, patch }),
  supprimerEcriture: (dossierId, annee, id) => ipcRenderer.invoke('cab:supprimerEcriture', { dossierId, annee, id }),
  extourner: (dossierId, annee, id) => ipcRenderer.invoke('cab:extourner', { dossierId, annee, id }),
  validerLot: (o) => ipcRenderer.invoke('cab:validerLot', o || {}),
  joindreEcriture: (o) => ipcRenderer.invoke('cab:joindreEcriture', o || {}),
  ouvrirJustificatif: (dossierId, relatif) => ipcRenderer.invoke('cab:ouvrirJustificatif', { dossierId, relatif }),
  saveGuides: (guides, dossierId) => ipcRenderer.invoke('cab:saveGuides', { guides, dossierId }),
  saveCorrespondance: (table, dossierId) => ipcRenderer.invoke('cab:saveCorrespondance', { table, dossierId }),
  saveAbonnements: (dossierId, abonnements) => ipcRenderer.invoke('cab:saveAbonnements', { dossierId, abonnements }),
  genererAbonnements: (o) => ipcRenderer.invoke('cab:genererAbonnements', o || {}),
  dernierJournal: (dossierId, journal) => ipcRenderer.invoke('cab:dernierJournal', { dossierId, journal }),
  // La licence du cabinet (9.4.0). Elle ne concerne QUE ce cabinet : rien ici ne touche aux
  // données d'un client, et la porte qu'elle ferme est celle de la validation d'une écriture —
  // jamais la lecture, jamais l'import, jamais l'export.
  licenceStatus: () => ipcRenderer.invoke('licence:status'),
  licenceSet: (key) => ipcRenderer.invoke('licence:set', key),
  licenceRequestMail: () => ipcRenderer.invoke('licence:requestMail'),
  relireLesPaquets: (dossierId, annee) => ipcRenderer.invoke('cab:relireLesPaquets', { dossierId, annee }),
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
  exportRecovery: (password, current) => ipcRenderer.invoke('cab:exportRecovery', { password, current }),
  importRecovery: (password) => ipcRenderer.invoke('cab:importRecovery', password),
  recoveryStatus: () => ipcRenderer.invoke('cab:recoveryStatus'),
  exportCsv: (rows, name) => ipcRenderer.invoke('cab:exportCsv', { rows, name }),

  // contacter un client
  mail: (opts) => ipcRenderer.invoke('cab:mail', opts),
  tel: (opts) => ipcRenderer.invoke('cab:tel', opts),
  reveal: (p) => ipcRenderer.invoke('cab:reveal', p),

  // dépannage
  support: () => ipcRenderer.invoke('cab:support'),
  // Une exception de l'interface part au journal (9.1.0), comme dans l'app entreprise.
  supportErreur: (info) => ipcRenderer.invoke('support:erreur', info),
  openLog: () => ipcRenderer.invoke('cab:openLog'),
  openDataDir: () => ipcRenderer.invoke('cab:openDataDir'),

  // mises à jour (6.6.0)
  updVersion: () => ipcRenderer.invoke('upd:version'),
  updCheck: () => ipcRenderer.invoke('upd:check'),
  updDownload: () => ipcRenderer.invoke('upd:download'),
  updInstall: () => ipcRenderer.invoke('upd:install'),
  updSetToken: (t) => ipcRenderer.invoke('upd:setToken', t),
  updSetBeta: (on) => ipcRenderer.invoke('upd:setBeta', on),
  updOpenReleases: () => ipcRenderer.invoke('upd:openReleases'),

  // Depuis Electron 32, `File.path` n'existe plus : sans ce pont, un fichier glissé sur la fenêtre
  // arrive sans son chemin et le glisser-déposer ne peut rien importer.
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },
  takePending: () => ipcRenderer.invoke('cab:takePending'),

  onUpdateEvent: (cb) => { ipcRenderer.on('update:event', (_e, d) => cb(d)); },
  onMenuAction: (cb) => { ipcRenderer.on('menu:action', (_e, name) => cb(name)); },
  onImportProgress: (cb) => { ipcRenderer.on('import:progress', (_e, d) => cb(d)); },
  // Le chien de garde : la réponse part du fil principal du renderer — c'est exactement lui qu'une
  // boucle infinie bloquerait, et c'est pour ça que son silence vaut diagnostic.
  onAlivePing: (cb) => { ipcRenderer.on('alive:ping', () => { ipcRenderer.send('alive:pong'); if (cb) cb(); }); },
  onFreezeNotice: (cb) => { ipcRenderer.on('freeze:notice', (_e, d) => cb(d)); },
  onFileOpen: (cb) => { ipcRenderer.on('file:open', (_e, f) => cb(f)); }
});
