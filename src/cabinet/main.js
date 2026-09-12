// SkanFact Cabinet — processus principal.
//
// Une seconde application, dans le même dépôt, qui partage tout ce qui peut l'être : core.js pour
// les calculs, zip.js pour les paquets, style.css pour l'apparence. Ce qui change, c'est le métier :
// ici on REÇOIT et on LIT. Aucune donnée de client n'est jamais modifiée ni renvoyée.
//
// Depuis la 2.0.0, le stockage et les filets vivent dans cabstore.js (sauvegardes, copie externe,
// clé de secours, rangement des paquets) : ce fichier ne fait plus que l'orchestration et l'IPC.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Z = require('../zip');
const K = require('./cabcore');
const CS = require('./cabstore');

const APP_ID = 'tn.skancyber.skanfact.cabinet';
// Depuis la 6.6.0, les deux applications portent le MÊME numéro de version. C'est ce qui permet de
// les publier dans la même release GitHub — et donc de donner au cabinet des mises à jour
// automatiques. Un comptable et son client peuvent aussi comparer leurs versions d'un coup d'œil.
// (On lit package.json plutôt qu'app.getVersion(), qui renvoie la version d'Electron en dev.)
const PKG = require('../../package.json');
const VERSION = PKG.version;
// Adresse du relais de mise à jour, posée à la construction. Vide → l'application demande un jeton,
// comme avant. C'est le relais qui détient l'accès au dépôt, pas le comptable.
// Nettoyé avant usage : l'adresse et le secret sont collés à la main dans des formulaires web, où
// une espace ou un retour à la ligne invisible se glisse facilement.
const relayBase = () => String(PKG.updateBase || '').trim().replace(/\/+$/, '');
const relaySecret = () => String(PKG.updateSecret || '').trim();

let mainWindow = null;
let store = null;          // le magasin (cabstore) : fichier chiffré, sauvegardes, paquets
let state = null;          // l'état déchiffré, en mémoire pour la session
let pendingOpen = [];      // paquets ouverts depuis le Finder avant que la fenêtre soit prête

const APP_CFG = () => path.join(app.getPath('userData'), 'app-config.json');
const readAppCfg = () => { try { return JSON.parse(fs.readFileSync(APP_CFG(), 'utf8')); } catch { return {}; } };
function writeAppCfg(patch) {
  const cfg = { ...readAppCfg(), ...patch };
  try {
    fs.mkdirSync(path.dirname(APP_CFG()), { recursive: true });
    fs.writeFileSync(APP_CFG(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) { logError('réglages du poste', e); }
  return cfg;
}

function logError(where, err) {
  const msg = `${new Date().toISOString()} [${where}] ${err && err.stack || err}\n`;
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'main.log'), msg); } catch {}
  try { dialog.showErrorBox('SkanFact Cabinet — erreur', `${where}\n\n${err && err.message || err}`); } catch {}
}

function getStore() {
  if (!store) {
    store = CS.createCabStore(app.getPath('userData'), {
      log: (w, e) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'main.log'), `${new Date().toISOString()} [${w}] ${e && e.stack || e}\n`); } catch {} },
      externalDir: readAppCfg().externalBackupDir || null
    });
  }
  return store;
}

function requireOpen() {
  if (!state || !getStore().unlocked()) throw new Error('Aucun cabinet ouvert.');
  return state;
}

function save() { getStore().write(state); return safeState(); }

// La clé privée ne sort JAMAIS vers l'interface : elle n'y servirait à rien et un jour elle finirait
// dans un journal ou une capture d'écran.
function safeState() {
  const s = JSON.parse(JSON.stringify({ ...state }));
  delete s.__salt;
  if (s.cabinet) {
    delete s.cabinet.privateKey;
    s.cabinet.fingerprint = state.cabinet.publicKey ? Z.keyFingerprint(state.cabinet.publicKey) : '';
  }
  return s;
}

// ---------- fenêtre ----------
// La taille et la position sont mémorisées : une application qu'on rouvre douze fois par jour et qui
// revient chaque fois au milieu de l'écran donne l'impression de ne pas être finie.
function savedBounds() {
  const w = readAppCfg().window;
  if (!w || !w.width || !w.height) return {};
  const { screen } = require('electron');
  const visible = screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return w.x != null && w.y != null && w.x < a.x + a.width && w.x + w.width > a.x && w.y < a.y + a.height && w.y + w.height > a.y;
  });
  return visible ? { width: w.width, height: w.height, x: w.x, y: w.y } : { width: w.width, height: w.height };
}

function rememberBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
  try { writeAppCfg({ window: { ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() } }); } catch {}
}

function createWindow() {
  const saved = savedBounds();
  mainWindow = new BrowserWindow({
    width: 1240, height: 820, minWidth: 960, minHeight: 620, ...saved,
    title: 'SkanFact Cabinet', show: false, backgroundColor: '#f5f7fa',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  if (readAppCfg().window && readAppCfg().window.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) mainWindow.show(); }, 1500);
  mainWindow.webContents.on('render-process-gone', (_e, d) => logError('interface arrêtée', new Error(d.reason)));
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch(e => logError('chargement', e));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  // Un fichier lâché à côté de la zone prévue ne doit JAMAIS remplacer l'application par lui-même :
  // sans ça, un .skanpack déposé au mauvais endroit fait naviguer la fenêtre vers le fichier et
  // l'application disparaît, sans erreur et sans retour possible.
  mainWindow.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://') || !url.includes('renderer/index.html')) e.preventDefault(); });
  ['resize', 'move'].forEach(ev => mainWindow.on(ev, () => { clearTimeout(mainWindow.__t); mainWindow.__t = setTimeout(rememberBounds, 400); }));
  mainWindow.on('close', rememberBounds);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const act = name => () => { if (mainWindow) mainWindow.webContents.send('menu:action', name); };
  return Menu.buildFromTemplate([
    ...(mac ? [{ label: 'SkanFact Cabinet', submenu: [{ role: 'about', label: 'À propos' }, { type: 'separator' }, { label: 'Réglages…', accelerator: 'Cmd+,', click: act('go:reglages') }, { type: 'separator' }, { role: 'hide', label: 'Masquer' }, { role: 'quit', label: 'Quitter' }] }] : []),
    { label: 'Fichier', submenu: [
      { label: 'Importer un paquet…', accelerator: 'CmdOrCtrl+O', click: act('import') },
      { label: 'Nouveau dossier client…', accelerator: 'CmdOrCtrl+N', click: act('new-dossier') },
      { type: 'separator' },
      { label: 'Sauvegarder maintenant', accelerator: 'CmdOrCtrl+S', click: act('backup') },
      { type: 'separator' },
      mac ? { role: 'close', label: 'Fermer' } : { role: 'quit', label: 'Quitter' }
    ] },
    { label: 'Édition', submenu: [{ role: 'undo', label: 'Annuler' }, { role: 'redo', label: 'Rétablir' }, { type: 'separator' }, { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' }, { role: 'paste', label: 'Coller' }, { role: 'selectAll', label: 'Tout sélectionner' }, { type: 'separator' }, { label: 'Rechercher…', accelerator: 'CmdOrCtrl+K', click: act('palette') }] },
    { label: 'Affichage', submenu: [
      { label: 'Dossiers', accelerator: 'CmdOrCtrl+1', click: act('go:dossiers') },
      { label: 'Relances', accelerator: 'CmdOrCtrl+2', click: act('go:relances') },
      { label: 'Réglages', accelerator: 'CmdOrCtrl+3', click: act('go:reglages') },
      { type: 'separator' }, { role: 'reload', label: 'Recharger' }, { role: 'toggleDevTools', label: 'Outils de développement' },
      { type: 'separator' }, { role: 'resetZoom', label: 'Taille réelle' }, { role: 'zoomIn', label: 'Agrandir' }, { role: 'zoomOut', label: 'Réduire' }
    ] },
    { label: 'Fenêtre', submenu: [{ role: 'minimize', label: 'Réduire' }, { role: 'zoom', label: 'Zoom' }] },
    { label: 'Aide', submenu: [
      { label: 'Comment ça marche', click: act('go:aide') },
      { label: 'Signaler un problème…', click: act('support') },
      { type: 'separator' },
      { label: 'Ouvrir le journal technique', click: () => { try { shell.openPath(path.join(app.getPath('userData'), 'main.log')); } catch {} } },
      { label: 'Ouvrir le dossier de l\'application', click: () => { try { shell.openPath(app.getPath('userData')); } catch {} } }
    ] }
  ]);
}

// ---------- IPC : ouverture ----------
ipcMain.handle('cab:status', () => ({
  exists: getStore().exists(), unlocked: !!state, version: VERSION,
  corruptFile: getStore().state.corruptFile || '',
  backups: getStore().listBackups().length
}));

ipcMain.handle('cab:unlock', (_e, password) => {
  const s = getStore();
  if (!s.exists()) {
    // Première ouverture : on crée le cabinet avec sa paire de clés.
    const keys = Z.generateCabinetKeys();
    state = s.create(password, K.migrate({ cabinet: { name: '', email: '', phone: '', publicKey: keys.publicKey, privateKey: keys.privateKey } }));
    return { created: true, state: safeState() };
  }
  const r = s.unlock(password);
  if (r.missing) {
    // Le fichier existait et n'était pas lisible : cabstore l'a mis de côté SANS l'écraser.
    const e = new Error('Le fichier du cabinet est illisible. Il a été mis de côté, rien n\'a été effacé : restaure une sauvegarde depuis l\'écran suivant.');
    e.corrupt = s.state.corruptFile || '';
    throw e;
  }
  if (!r.ok) throw new Error(r.error);
  state = K.migrate(r.state);
  // Reprise du rangement à plat des versions précédentes : les paquets passent en
  // paquets/<client>/<année>/<mois>.skanpack. Silencieux, une seule fois.
  const moved = s.reorganize(state);
  if (moved.moved) s.write(state);
  return { created: false, state: safeState(), reorganized: moved };
});

ipcMain.handle('cab:state', () => (state ? safeState() : null));

ipcMain.handle('cab:lock', () => {
  // Verrouiller à la demande : un comptable qui quitte son bureau doit pouvoir fermer le coffre sans
  // quitter l'application. Jusqu'ici, une fois ouvert, tout restait lisible pour qui passait devant.
  getStore().lock();
  state = null;
  return true;
});

// ---------- IPC : le cabinet et ses dossiers ----------
ipcMain.handle('cab:saveCabinet', (_e, patch) => {
  requireOpen();
  const p = patch || {};
  state.cabinet = {
    ...state.cabinet,
    name: String(p.name || ''), email: String(p.email || ''), phone: String(p.phone || '')
  };
  if (p.settings) {
    const day = Number(p.settings.relanceDay);
    state.settings = { ...state.settings, relanceDay: day >= 1 && day <= 28 ? Math.round(day) : state.settings.relanceDay };
  }
  return save();
});

const DOSSIER_TEXT = ['name', 'email', 'phone', 'contact', 'note', 'regime', 'tvaPeriod', 'from'];

ipcMain.handle('cab:saveDossier', (_e, { id, patch } = {}) => {
  requireOpen();
  const d = state.dossiers.find(x => x.id === id);
  if (!d) throw new Error('Dossier introuvable.');
  DOSSIER_TEXT.forEach(k => { if (patch && patch[k] != null) d[k] = String(patch[k]); });
  if (patch && patch.fees != null) d.fees = Number(patch.fees) || 0;
  if (patch && patch.archived != null) d.archived = !!patch.archived;
  if (d.from && !/^\d{4}-\d{2}$/.test(d.from)) d.from = '';
  // Le nom sert au rangement des paquets sur le disque : s'il change, les fichiers suivent.
  const moved = getStore().reorganize(state);
  save();
  return { state: safeState(), moved: moved.moved };
});

// Créer un dossier à la main. C'est ce qui transforme l'application en tableau de bord du
// portefeuille au lieu d'une liste des deux clients déjà passés à SkanFact.
ipcMain.handle('cab:newDossier', (_e, fields) => {
  requireOpen();
  const f = fields || {};
  if (!String(f.name || '').trim()) throw new Error('Donne au moins un nom à ce client.');
  const d = K.newDossier({ ...f, name: String(f.name).trim(), createdAt: Date.now() });
  if (!d.id || d.id === 'NOM:') throw new Error('Nom de client inutilisable.');
  if (state.dossiers.some(x => x.id === d.id)) throw new Error('Un dossier existe déjà pour ce client (même matricule ou même nom).');
  state.dossiers.push(d);
  save();
  return { state: safeState(), id: d.id };
});

// Ajouter une liste de clients d'un coup, collée depuis un tableur. Un cabinet a soixante clients :
// les saisir un par un, personne ne le fera, et l'application resterait vide le jour de la
// démonstration — c'est-à-dire inutile au moment précis où elle doit convaincre.
ipcMain.handle('cab:importDossiers', (_e, text) => {
  requireOpen();
  const r = K.parseDossierLines(text, state.dossiers);
  if (!r.dossiers.length) return { added: 0, ignorés: r.ignorés, state: safeState() };
  r.dossiers.forEach(d => { d.createdAt = Date.now(); state.dossiers.push(d); });
  save();
  return { added: r.dossiers.length, ignorés: r.ignorés, state: safeState() };
});

// Supprimer un dossier, ses paquets compris. Jusqu'ici seul l'archivage existait : un client entré
// par erreur, ou un client parti qui demande l'effacement de ses pièces, restait là pour toujours.
ipcMain.handle('cab:deleteDossier', (_e, id) => {
  requireOpen();
  const i = state.dossiers.findIndex(x => x.id === id);
  if (i < 0) throw new Error('Dossier introuvable.');
  const d = state.dossiers[i];
  getStore().backupNow('avant-suppression-dossier');
  getStore().removeDossierFiles(d, state.dossiers);
  state.dossiers.splice(i, 1);
  return save();
});

// Supprimer un paquet reçu par erreur (mauvais client, essai pendant une démonstration).
ipcMain.handle('cab:deletePack', (_e, { id, month } = {}) => {
  requireOpen();
  const d = state.dossiers.find(x => x.id === id);
  if (!d) throw new Error('Dossier introuvable.');
  const p = (d.packs || []).find(x => x.month === month);
  if (!p) throw new Error('Paquet introuvable.');
  getStore().backupNow('avant-suppression-paquet');
  if (p.path) getStore().removePack(p.path);
  d.packs = d.packs.filter(x => x.month !== month);
  return save();
});

ipcMain.handle('cab:noteRelance', (_e, { id, months, via, note } = {}) => {
  requireOpen();
  const d = state.dossiers.find(x => x.id === id);
  if (!d) throw new Error('Dossier introuvable.');
  K.noteRelance(d, months, via, Date.now(), note);
  return save();
});

// Un jeu d'exemple, pour qu'un comptable qui découvre l'application voie à quoi elle ressemble
// pleine. Il disparaît au premier vrai paquet importé (voir `cab:importPack`) : on ne mélange jamais
// des dossiers fictifs avec les comptabilités réelles de ses clients.
ipcMain.handle('cab:demo', (_e, on) => {
  requireOpen();
  state.dossiers = on
    ? state.dossiers.filter(d => !d.demo).concat(K.demoDossiers().map(K.migrateDossier))
    : state.dossiers.filter(d => !d.demo);
  return save();
});

// Le fichier d'appairage à remettre aux clients : uniquement la clé publique.
ipcMain.handle('cab:exportPairing', async () => {
  requireOpen();
  const fp = Z.keyFingerprint(state.cabinet.publicKey);
  const safe = CS.slug(state.cabinet.name || 'cabinet');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Fichier d\'appairage à remettre à tes clients',
    defaultPath: path.join(app.getPath('documents'), `${safe}.skanpair`),
    filters: [{ name: 'Appairage SkanFact', extensions: ['skanpair'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(K.pairingFile(state.cabinet, fp), null, 2), 'utf8');
  return { path: filePath, fingerprint: fp };
});

// ---------- IPC : import d'un paquet ----------
ipcMain.handle('cab:importPack', async (_e, opts) => {
  requireOpen();
  opts = opts || {};
  let files = opts.paths;
  if (!files || !files.length) {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Paquets reçus de tes clients',
      filters: [{ name: 'Paquet SkanFact', extensions: ['skanpack', 'zip'] }],
      properties: ['openFile', 'multiSelections']
    });
    if (r.canceled || !r.filePaths.length) return null;
    files = r.filePaths;
  }
  // Une sauvegarde AVANT d'ingérer : un import qui range mal (ou un paquet inattendu) doit pouvoir
  // être défait. Même règle que l'app entreprise avant un import.
  getStore().backupNow('avant-import');
  const results = [];
  for (const f of files) {
    try { results.push({ file: f, ...ingest(f, opts.password) }); }
    catch (err) { results.push({ file: f, error: err.message || String(err) }); }
  }
  // Un vrai paquet est arrivé : les dossiers d'exemple s'effacent d'eux-mêmes. Les laisser
  // reviendrait à afficher des retards imaginaires à côté des vrais.
  const demoOut = results.some(r => !r.error) && state.dossiers.some(d => d.demo);
  if (demoOut) state.dossiers = state.dossiers.filter(d => !d.demo);
  save();
  return { results, demoRemoved: demoOut, state: safeState() };
});

function ingest(file, password) {
  let buf = fs.readFileSync(file);
  let sealed = false;
  if (Z.isSealedForCabinet(buf)) {
    const head = Z.cabinetHeader(buf);
    const mine = Z.keyFingerprint(state.cabinet.publicKey);
    if (head.destinataire && head.destinataire !== mine) {
      throw new Error(`Ce paquet est adressé à un autre cabinet (${head.destinataire}).`);
    }
    buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
    sealed = true;
  } else if (Z.isSealed(buf)) {
    if (!password) { const e = new Error('Ce paquet est protégé par un mot de passe.'); e.needPassword = true; throw e; }
    buf = Z.openBuffer(buf, password);
    sealed = true;
  }
  const entries = Z.zipRead(buf);
  const mEntry = entries.find(e => e.name === 'manifeste.json');
  if (!mEntry) throw new Error('Ce fichier n\'est pas un paquet SkanFact : le manifeste est absent.');
  let manifest;
  try { manifest = JSON.parse(mEntry.data().toString('utf8')); }
  catch { throw new Error('Le manifeste de ce paquet est illisible : le fichier a été abîmé pendant l\'envoi.'); }
  if (!manifest || typeof manifest !== 'object' || !manifest.entreprise || !manifest.periode) {
    throw new Error('Le manifeste de ce paquet ne ressemble pas à un envoi SkanFact.');
  }

  // Vérification : chaque fichier annoncé est là, et avec l'empreinte annoncée. C'est ce qui permet
  // de dire « ce que j'ai reçu est exactement ce qui a été envoyé ».
  // On calcule l'empreinte de ce qu'on a reçu ; cabcore compare et compte. La règle du comptage
  // vit dans la partie testable : c'est la seule affirmation rigoureuse de cette application
  // (« ce que j'ai reçu est exactement ce qui a été envoyé »), elle doit compter juste.
  const hashes = {};
  entries.forEach(e => { try { hashes[e.name] = Z.sha256(e.data()); } catch { hashes[e.name] = '(illisible)'; } });
  const { checked, bad } = K.checkIntegrity(manifest, hashes);

  // On range le paquet tel quel : c'est la pièce justificative, on ne la réécrit pas. Le classement
  // (client / année / mois) permet au comptable de retrouver les pièces sans ouvrir l'application —
  // et de les rendre à un client en copiant un dossier.
  const key = K.dossierKey(manifest);
  const month = (manifest.periode || {}).mois || 'inconnu';
  const known = state.dossiers.find(d => d.id === key);
  const fiche = known || { id: key, name: (manifest.entreprise || {}).nom || '(sans nom)', matricule: (manifest.entreprise || {}).matricule || '' };
  const dest = getStore().storePack(file, fiche, month, state.dossiers.concat(known ? [] : [fiche]));

  const res = K.filePack(state, manifest, {
    receivedAt: Date.now(), digest: Z.sha256(mEntry.data()), bytes: fs.statSync(file).size,
    path: dest, sealed
  });
  return { ...res, integrity: { checked, bad } };
}

// Ouvrir un fichier contenu dans un paquet : on l'extrait dans un dossier temporaire, en lecture.
// Les extractions sont effacées à la fermeture de l'application : elles contiennent les pièces
// comptables d'un client, elles n'ont rien à faire dans /tmp pour toujours.
const tempDirs = [];
ipcMain.handle('cab:openInPack', async (_e, { packPath, name, password } = {}) => {
  requireOpen();
  let buf = fs.readFileSync(packPath);
  if (Z.isSealedForCabinet(buf)) buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
  else if (Z.isSealed(buf)) buf = Z.openBuffer(buf, password || '');
  const e = Z.zipRead(buf).find(x => x.name === name);
  if (!e) throw new Error('Fichier absent du paquet.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skanpack-'));
  tempDirs.push(dir);
  const out = path.join(dir, path.basename(name));
  fs.writeFileSync(out, e.data());
  await shell.openPath(out);
  return out;
});

function cleanTemp() {
  while (tempDirs.length) {
    const d = tempDirs.pop();
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  }
}

// La liste des fichiers d'un paquet, sans rien extraire.
ipcMain.handle('cab:listPack', (_e, { packPath, password } = {}) => {
  requireOpen();
  let buf = fs.readFileSync(packPath);
  if (Z.isSealedForCabinet(buf)) buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
  else if (Z.isSealed(buf)) buf = Z.openBuffer(buf, password || '');
  return Z.zipRead(buf).map(e => ({ name: e.name, size: e.size }));
});

// Extraire TOUT un paquet dans un dossier choisi : c'est ce qu'on fait pour rendre ses pièces à un
// client qui part, ou pour travailler dessus dans son logiciel de production.
ipcMain.handle('cab:extractPack', async (_e, { packPath, password, label } = {}) => {
  requireOpen();
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Où extraire les pièces ?', properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || !filePaths.length) return null;
  let buf = fs.readFileSync(packPath);
  if (Z.isSealedForCabinet(buf)) buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
  else if (Z.isSealed(buf)) buf = Z.openBuffer(buf, password || '');
  const target = path.join(filePaths[0], CS.slug(label || 'paquet'));
  let n = 0;
  Z.zipRead(buf).forEach(e => {
    // Jamais de chemin qui remonte : une entrée « ../../ » dans un ZIP écrirait hors du dossier
    // choisi. Un paquet vient d'un client, pas de nous : on ne lui fait pas confiance sur parole.
    const rel = String(e.name).replace(/\\/g, '/').split('/').filter(s => s && s !== '.' && s !== '..').join('/');
    if (!rel) return;
    const out = path.join(target, rel);
    if (!path.resolve(out).startsWith(path.resolve(target))) return;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, e.data());
    n++;
  });
  return { dir: target, files: n };
});

// ---------- IPC : sauvegardes, copie externe, clé de secours ----------
ipcMain.handle('cab:backups', () => {
  const s = getStore();
  return {
    list: s.listBackups(),
    external: s.state.external,
    packs: s.packStats(),
    dir: app.getPath('userData'),
    corruptFile: s.state.corruptFile || ''
  };
});

ipcMain.handle('cab:backupNow', (_e, label) => {
  requireOpen();
  const p = getStore().backupNow(label || 'manuelle');
  if (!p) throw new Error('Rien à sauvegarder pour l\'instant.');
  return { path: p, list: getStore().listBackups() };
});

// Montrer ce que contient une sauvegarde AVANT de restaurer. Une restauration qui ne dit pas ce
// qu'on va perdre n'est pas une restauration, c'est un pari.
ipcMain.handle('cab:peekBackup', (_e, { path: p, password } = {}) => {
  requireOpen();
  const d = K.migrate(getStore().peek(p, password));
  return {
    dossiers: d.dossiers.length,
    paquets: d.dossiers.reduce((s, x) => s + (x.packs || []).length, 0),
    cabinet: (d.cabinet || {}).name || '',
    // Ce que la restauration ferait perdre : ce qu'on a maintenant et que la sauvegarde n'a pas.
    actuels: { dossiers: state.dossiers.length, paquets: state.dossiers.reduce((s, x) => s + (x.packs || []).length, 0) }
  };
});

ipcMain.handle('cab:restore', (_e, { path: p, password } = {}) => {
  requireOpen();
  const plain = getStore().restore(p, password);
  state = K.migrate(plain);
  getStore().reorganize(state);
  getStore().write(state);
  return safeState();
});

ipcMain.handle('cab:pickExternal', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Dossier de copie (clé USB, iCloud Drive, disque externe…)',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths.length) return null;
  writeAppCfg({ externalBackupDir: r.filePaths[0] });
  const ext = getStore().setExternalDir(r.filePaths[0]);
  return { ...ext };
});

ipcMain.handle('cab:clearExternal', () => {
  writeAppCfg({ externalBackupDir: null });
  return { ...getStore().setExternalDir(null) };
});

ipcMain.handle('cab:mirrorNow', () => {
  const ok = getStore().mirrorExternal();
  return { ok, ...getStore().state.external };
});

// Changer le mot de passe. Il n'y avait aucun moyen de le faire : s'il fuitait, ou si un
// collaborateur partait, il n'existait aucun recours.
ipcMain.handle('cab:changePassword', (_e, { current, next } = {}) => {
  requireOpen();
  if (String(next || '').length < 8) throw new Error('Choisis un mot de passe d\'au moins huit caractères.');
  // On revérifie l'ancien en relisant le fichier : sans ça, quelqu'un qui passe devant un poste
  // déverrouillé changerait le mot de passe sans connaître l'ancien.
  const check = CS.createCabStore(app.getPath('userData'), {}).unlock(String(current || ''));
  if (!check.ok) throw new Error('Mot de passe actuel incorrect.');
  getStore().backupNow('avant-changement-mot-de-passe');
  getStore().setPassword(state, String(next));
  return { ok: true };
});

// La clé de secours : le fichier le plus important que ce cabinet produira jamais.
ipcMain.handle('cab:exportRecovery', async (_e, password) => {
  requireOpen();
  if (String(password || '').length < 8) throw new Error('Choisis un mot de passe d\'au moins huit caractères pour ce fichier.');
  const safe = CS.slug(state.cabinet.name || 'cabinet');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Clé de secours du cabinet — à garder hors de cet ordinateur',
    defaultPath: path.join(app.getPath('documents'), `${safe}-cle-de-secours.skanrecover`),
    filters: [{ name: 'Clé de secours SkanFact', extensions: ['skanrecover'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(CS.makeRecovery(state.cabinet, String(password), new Date()), null, 2), { mode: 0o600 });
  writeAppCfg({ recoveryExportedAt: Date.now() });
  return { path: filePath };
});

ipcMain.handle('cab:importRecovery', async (_e, password) => {
  requireOpen();
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Clé de secours à restaurer', filters: [{ name: 'Clé de secours SkanFact', extensions: ['skanrecover'] }], properties: ['openFile']
  });
  if (r.canceled || !r.filePaths.length) return null;
  const obj = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
  const keys = CS.readRecovery(obj, String(password || ''));
  if (!keys.privateKey || !keys.publicKey) throw new Error('Cette clé de secours est vide.');
  getStore().backupNow('avant-restauration-cle');
  state.cabinet = { ...state.cabinet, publicKey: keys.publicKey, privateKey: keys.privateKey };
  save();
  return { fingerprint: Z.keyFingerprint(keys.publicKey), name: keys.name || '' };
});

ipcMain.handle('cab:recoveryStatus', () => ({ exportedAt: readAppCfg().recoveryExportedAt || null }));

// Exporter la liste des dossiers en CSV : un comptable doit pouvoir sortir ses données de
// l'application. Une application qui garde ce qu'on lui confie n'inspire pas confiance.
ipcMain.handle('cab:exportCsv', async (_e, { rows, name } = {}) => {
  requireOpen();
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le tableau',
    defaultPath: path.join(app.getPath('documents'), `${CS.slug(name || 'dossiers')}.csv`),
    filters: [{ name: 'Tableau CSV', extensions: ['csv'] }]
  });
  if (canceled || !filePath) return null;
  // BOM : sans lui, Excel en français lit « Société » comme « SociÃ©tÃ© ».
  fs.writeFileSync(filePath, '﻿' + String(rows || ''), 'utf8');
  return { path: filePath };
});

ipcMain.handle('cab:support', () => ({
  version: VERSION, electron: process.versions.electron, platform: process.platform, arch: process.arch,
  userData: app.getPath('userData'),
  log: path.join(app.getPath('userData'), 'main.log'),
  dossiers: state ? state.dossiers.length : 0,
  paquets: state ? state.dossiers.reduce((s, d) => s + (d.packs || []).length, 0) : 0,
  external: getStore().state.external
}));

ipcMain.handle('cab:openLog', () => shell.openPath(path.join(app.getPath('userData'), 'main.log')));
ipcMain.handle('cab:openDataDir', () => shell.openPath(app.getPath('userData')));

// ---------- mises à jour (6.6.0) ----------
//
// Les deux applications sont publiées dans la MÊME release GitHub. Elles ne peuvent donc pas partager
// le fichier de mise à jour (`latest.yml`), qui porte un nom fixe : le cabinet a son propre canal,
// `cabinet.yml` / `cabinet-mac.yml`, produit par `build/cabinet.config.js`. C'est ce qui permet à un
// comptable de recevoir SES mises à jour sans jamais voir passer celles de l'app entreprise.
//
// macOS : l'app n'est pas signée, donc Squirrel ne peut pas l'installer. On réutilise le même
// `mac-update.sh` que SkanFact, en lui passant le nom du binaire.
const GITHUB = { owner: 'saouthq', repo: 'skanfact', private: true };
const RELEASES_URL = `https://github.com/${GITHUB.owner}/${GITHUB.repo}/releases`;
const IS_MAC = process.platform === 'darwin';
const MAC_SIGNED = false;
const UPDATE_CHANNEL = 'cabinet';

let updater = null, updateInfo = null, downloaded = false, downloadedFile = null, silentCheck = true;
// Pourquoi le module n'a pas démarré, en clair : sans ça le comptable lit « indisponible » et
// personne ne peut l'aider à distance.
let updaterError = '', relayFailure = '';
const UPDATE_CFG = () => path.join(app.getPath('userData'), 'update-config.json');
const UPDATE_RESULT = () => path.join(app.getPath('userData'), 'update-result.json');
const readUpdateCfg = () => { try { return JSON.parse(fs.readFileSync(UPDATE_CFG(), 'utf8')); } catch { return {}; } };
function writeUpdateCfg(cfg) {
  fs.mkdirSync(path.dirname(UPDATE_CFG()), { recursive: true });
  fs.writeFileSync(UPDATE_CFG(), JSON.stringify(cfg), { mode: 0o600 });
}
const sendUpd = (s, payload) => { try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:event', { state: s, ...(payload || {}) }); } catch {} };

function friendlyError(err) {
  const m = String((err && err.message) || err);
  if (/404/.test(m)) return 'Aucune version trouvée : le jeton d\'accès manque ou n\'a pas accès au dépôt (Réglages → Mises à jour).';
  if (/401|403|Bad credentials/i.test(m)) return 'Jeton d\'accès refusé ou expiré. Demande-en un nouveau.';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|net::/i.test(m)) return 'Impossible de joindre GitHub. Vérifie ta connexion internet.';
  if (/sha512|checksum/i.test(m)) return 'Le fichier téléchargé est abîmé. Réessaie.';
  return m.split('\n')[0].slice(0, 200);
}

function getUpdater() {
  if (updater) return updater;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = !IS_MAC || MAC_SIGNED;
    autoUpdater.autoRunAppAfterInstall = true;
    autoUpdater.channel = UPDATE_CHANNEL;         // le canal du cabinet, jamais celui de l'app entreprise
    // ATTENTION : affecter `channel` met `allowDowngrade` à true — c'est écrit dans electron-updater,
    // et c'est voulu chez eux (changer de canal peut signifier revenir en arrière). Chez nous, non :
    // l'application proposait d'installer une version PLUS ANCIENNE que celle en place, c'est-à-dire
    // de revenir à un défaut déjà corrigé. Toujours remettre la valeur APRÈS le canal.
    autoUpdater.allowDowngrade = false;
    const ulog = path.join(app.getPath('userData'), 'updater.log');
    const ul = lvl => m => { try { fs.appendFileSync(ulog, `${new Date().toISOString()} ${lvl} ${m}\n`); } catch {} };
    autoUpdater.logger = { info: ul('info'), warn: ul('warn'), error: ul('error'), debug: ul('debug') };
    autoUpdater.on('checking-for-update', () => { if (!silentCheck) sendUpd('checking'); });
    autoUpdater.on('update-available', info => { updateInfo = info; downloaded = false; downloadedFile = null; sendUpd('available', { version: info.version }); });
    autoUpdater.on('update-not-available', () => { if (!silentCheck) sendUpd('none'); });
    autoUpdater.on('download-progress', p => sendUpd('downloading', { percent: Math.round(p.percent), version: updateInfo && updateInfo.version }));
    autoUpdater.on('update-downloaded', info => { downloaded = true; downloadedFile = info.downloadedFile || null; sendUpd('downloaded', { version: info.version }); });
    autoUpdater.on('error', err => { if (!silentCheck) sendUpd('error', { message: friendlyError(err) }); });
    // Relais si l'application a été construite avec son adresse, GitHub en direct sinon.
    const feedGithub = () => {
      const cfg = readUpdateCfg();
      autoUpdater.setFeedURL({ provider: 'github', owner: GITHUB.owner, repo: GITHUB.repo, channel: UPDATE_CHANNEL, private: !!cfg.token, token: cfg.token || undefined });
    };
    const base = relayBase();
    if (!base) feedGithub();
    else {
      try {
        // Une adresse invalide doit être vue ICI, pas au premier téléchargement.
        const url = new URL(`${base}/cabinet`).toString();
        autoUpdater.requestHeaders = { 'X-SkanFact-App': relaySecret() };
        autoUpdater.setFeedURL({ provider: 'generic', url, channel: UPDATE_CHANNEL });
      } catch (e) {
        // Jamais de cabinet sans recours : on retombe sur GitHub + jeton, et on le dit.
        relayFailure = `Relais injoignable (${String(e && e.message || e).slice(0, 120)}). Retour au téléchargement direct depuis GitHub.`;
        feedGithub();
      }
    }
    updater = autoUpdater;
  } catch (e) {
    updaterError = String(e && e.message || e).split('\n')[0].slice(0, 200);
    updater = null;
  }
  return updater;
}

function updaterUnavailable() {
  return { state: 'error', message: 'Module de mise à jour indisponible' + (updaterError ? ' : ' + updaterError : '.') };
}

async function checkForUpdates(isSilent) {
  silentCheck = !!isSilent;
  if (!app.isPackaged) return { state: 'dev' };
  // Dépôt privé sans jeton : GitHub répond 404 quoi qu'il arrive. Inutile de demander, on explique.
  if (!relayBase() && GITHUB.private && !readUpdateCfg().token) return { state: 'token' };
  const u = getUpdater();
  if (!u) return updaterUnavailable();
  if (downloaded) { sendUpd('downloaded', { version: updateInfo && updateInfo.version }); return { state: 'ok' }; }
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('ETIMEDOUT: pas de réponse de GitHub')), 45000));
  try {
    const r = await Promise.race([u.checkForUpdates(), timeout]);
    if (!r) return { state: 'error', message: 'Le module de mise à jour est inactif dans cette installation.' };
    return { state: 'ok' };
  } catch (e) { return { state: 'error', message: friendlyError(e) }; }
}

function takeLastUpdateResult() {
  try { const r = JSON.parse(fs.readFileSync(UPDATE_RESULT(), 'utf8')); fs.unlinkSync(UPDATE_RESULT()); return r; } catch { return null; }
}

function installOnMac() {
  if (!downloaded || !downloadedFile || !fs.existsSync(downloadedFile)) return { state: 'error', message: 'Le téléchargement n\'est pas terminé.' };
  const appPath = path.resolve(app.getPath('exe'), '..', '..', '..');
  if (!appPath.endsWith('.app')) return { state: 'error', message: 'Application introuvable sur le disque. Réinstalle depuis le .dmg.' };
  try { fs.accessSync(path.dirname(appPath), fs.constants.W_OK); }
  catch { return { state: 'error', message: `Impossible d'écrire dans ${path.dirname(appPath)}. Mets l'application dans ton dossier Applications, ou installe la nouvelle version depuis le .dmg.` }; }
  const dir = app.getPath('userData');
  const script = path.join(dir, 'mac-update.sh');
  try {
    fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, '..', 'mac-update.sh'), 'utf8'), { mode: 0o755 });
    try { fs.unlinkSync(UPDATE_RESULT()); } catch {}
    const out = fs.openSync(path.join(dir, 'mac-update.log'), 'a');
    const child = require('child_process').spawn('/bin/bash',
      [script, String(process.pid), downloadedFile, appPath, UPDATE_RESULT(), updateInfo ? updateInfo.version : '', 'SkanFact Cabinet'],
      { detached: true, stdio: ['ignore', out, out] });
    child.unref();
  } catch (e) { return { state: 'error', message: 'Impossible de lancer l\'installation : ' + e.message }; }
  setTimeout(() => app.quit(), 300);
  return { state: 'ok' };
}

ipcMain.handle('upd:version', () => ({
  version: VERSION, packaged: app.isPackaged, platform: process.platform, macSigned: MAC_SIGNED,
  hasToken: !!readUpdateCfg().token,
  // Un relais qui a échoué n'est pas un relais : le champ jeton doit revenir.
  relay: !!relayBase() && !relayFailure, relayFailure,
  lastUpdate: takeLastUpdateResult()
}));
ipcMain.handle('upd:setToken', (_e, token) => {
  const cfg = readUpdateCfg();
  if (token) cfg.token = String(token).trim(); else delete cfg.token;
  writeUpdateCfg(cfg);
  updater = null;                                  // le flux se reconstruit avec le nouveau jeton
  return { hasToken: !!cfg.token };
});
ipcMain.handle('upd:check', () => checkForUpdates(false));
ipcMain.handle('upd:download', () => {
  const u = getUpdater();
  if (!u || !updateInfo) return { state: 'error', message: 'Aucune mise à jour détectée.' };
  silentCheck = false;
  try { u.downloadUpdate(); return { state: 'ok' }; } catch (e) { return { state: 'error', message: friendlyError(e) }; }
});
ipcMain.handle('upd:install', () => {
  const u = getUpdater();
  if (!u) return updaterUnavailable();
  if (IS_MAC && !MAC_SIGNED) return installOnMac();
  setImmediate(() => u.quitAndInstall(true, true));
  return { state: 'ok' };
});
ipcMain.handle('upd:openReleases', () => shell.openExternal(RELEASES_URL + '/latest'));

ipcMain.handle('cab:mail', async (_e, { to, subject, body } = {}) => {
  const url = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
  await shell.openExternal(url);
  return true;
});

// Un numéro de téléphone tunisien composé depuis l'ordinateur, ou le message WhatsApp tout prêt :
// en Tunisie, un comptable qui court après des pièces appelle bien plus souvent qu'il n'écrit.
ipcMain.handle('cab:tel', async (_e, { number, whatsapp, text } = {}) => {
  const n = String(number || '').replace(/[^\d+]/g, '');
  if (!n) throw new Error('Ce dossier n\'a pas de numéro de téléphone.');
  const url = whatsapp
    ? `https://wa.me/${n.replace(/^\+/, '')}${text ? '?text=' + encodeURIComponent(text) : ''}`
    : `tel:${n}`;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('cab:reveal', (_e, p) => shell.showItemInFolder(p));

// ---------- ouverture d'un .skanpack depuis le Finder ----------
// Double-cliquer un paquet reçu par mail doit l'importer, pas ouvrir un dossier d'archives.
function queueOpen(file) {
  if (!file || !/\.(skanpack|skanpair|skanrecover)$/i.test(file)) return;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('file:open', file);
  else pendingOpen.push(file);
}
app.on('open-file', (e, file) => { e.preventDefault(); queueOpen(file); });
ipcMain.handle('cab:takePending', () => { const p = pendingOpen.slice(); pendingOpen = []; return p; });

// ---------- démarrage ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
    argv.filter(a => /\.(skanpack|skanpair|skanrecover)$/i.test(a)).forEach(queueOpen);
  });
  process.on('uncaughtException', e => logError('erreur inattendue', e));
  process.on('unhandledRejection', e => logError('promesse rejetée', e));
  // Mode développement : dossier de données séparé, pour la même raison que dans src/main.js — sans
  // ça on écrit dans les données réelles (macOS ne distingue pas « skanfact » de « SkanFact »).
  // `--user-data-dir` reste prioritaire : les tests s'en servent pour s'isoler.
  if (!app.isPackaged && !process.argv.some(a => a.startsWith('--user-data-dir'))) {
    try { app.setPath('userData', path.join(app.getPath('appData'), 'SkanFact Cabinet (essais)')); } catch {}
  }
  process.argv.filter(a => /\.(skanpack|skanpair|skanrecover)$/i.test(a)).forEach(f => pendingOpen.push(f));
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId(APP_ID);
    try { Menu.setApplicationMenu(buildMenu()); } catch (e) { logError('menu', e); }
    createWindow();
    // Vérification silencieuse au démarrage : si une version est là, la pastille s'allume dans la
    // barre de gauche. Rien ne s'affiche s'il n'y a rien — on ne dérange pas pour dire « rien ».
    setTimeout(() => { checkForUpdates(true).catch(() => {}); }, 4000);
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(e => logError('démarrage', e));
  app.on('before-quit', cleanTemp);
  app.on('window-all-closed', () => { cleanTemp(); if (process.platform !== 'darwin') app.quit(); });
}
