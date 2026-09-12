// SkanFact Cabinet — processus principal.
//
// Une seconde application, dans le même dépôt, qui partage tout ce qui peut l'être : core.js pour
// les calculs, zip.js pour les paquets, style.css pour l'apparence. Ce qui change, c'est le métier :
// ici on REÇOIT et on LIT. Aucune donnée de client n'est jamais modifiée ni renvoyée.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Z = require('../zip');
const K = require('./cabcore');

const APP_ID = 'tn.skancyber.skanfact.cabinet';
// La version du cabinet est indépendante de celle de l'app entreprise : elle vit dans
// `cabinetVersion` de package.json, et c'est elle qu'electron-builder recopie dans le paquet.
// On la lit là plutôt que par app.getVersion(), qui renvoie la version d'Electron en développement.
const VERSION = require('../../package.json').cabinetVersion || app.getVersion();
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

let mainWindow = null;
let key = null;            // clé dérivée du mot de passe, en mémoire pour la session seulement
let state = null;          // l'état déchiffré

const dataFile = () => path.join(app.getPath('userData'), 'cabinet-data.json');
const packDir = () => path.join(app.getPath('userData'), 'paquets');

function logError(where, err) {
  const msg = `${new Date().toISOString()} [${where}] ${err && err.stack || err}\n`;
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'main.log'), msg); } catch {}
  try { dialog.showErrorBox('SkanFact Cabinet — erreur', `${where}\n\n${err && err.message || err}`); } catch {}
}

// ---------- état chiffré ----------
// Le fichier contient la clé privée du cabinet ET la comptabilité de tous ses clients. Le chiffrer
// n'est pas une option : un portable de comptable qui se perd ne doit pas emporter soixante dossiers.
function deriveKey(password, salt) { return crypto.scryptSync(String(password), salt, 32, SCRYPT); }

function writeState() {
  if (!state || !key) throw new Error('Aucun dossier ouvert.');
  const salt = state.__salt ? Buffer.from(state.__salt, 'base64') : crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const plain = { ...state }; delete plain.__salt;
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(plain), 'utf8')), cipher.final()]);
  const env = {
    skanfactCabinet: 1, salt: salt.toString('base64'), iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), data: body.toString('base64')
  };
  const tmp = dataFile() + '.tmp';
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(env), 'utf8');
  fs.renameSync(tmp, dataFile());
  state.__salt = salt.toString('base64');
}

function fileExists() { try { return fs.existsSync(dataFile()); } catch { return false; } }

function unlock(password) {
  if (!fileExists()) {
    // Première ouverture : on crée le dossier du cabinet avec sa paire de clés.
    const salt = crypto.randomBytes(16);
    key = deriveKey(password, salt);
    const keys = Z.generateCabinetKeys();
    state = K.migrate({ cabinet: { name: '', email: '', publicKey: keys.publicKey, privateKey: keys.privateKey } });
    state.__salt = salt.toString('base64');
    writeState();
    return { created: true, state: safeState() };
  }
  const env = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  const salt = Buffer.from(env.salt, 'base64');
  key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
  let plain;
  try { plain = JSON.parse(Buffer.concat([decipher.update(Buffer.from(env.data, 'base64')), decipher.final()]).toString('utf8')); }
  catch { key = null; throw new Error('Mot de passe incorrect.'); }
  state = K.migrate(plain);
  state.__salt = env.salt;
  return { created: false, state: safeState() };
}

// La clé privée ne sort JAMAIS vers l'interface : elle n'y servirait à rien et un jour elle finirait
// dans un journal ou une capture d'écran.
function safeState() {
  const s = JSON.parse(JSON.stringify({ ...state }));
  delete s.__salt;
  if (s.cabinet) { delete s.cabinet.privateKey; s.cabinet.fingerprint = state.cabinet.publicKey ? Z.keyFingerprint(state.cabinet.publicKey) : ''; }
  return s;
}

// ---------- fenêtre ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240, height: 820, minWidth: 960, minHeight: 620,
    title: 'SkanFact Cabinet', show: false, backgroundColor: '#f5f7fa',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) mainWindow.show(); }, 1500);
  mainWindow.webContents.on('render-process-gone', (_e, d) => logError('interface arrêtée', new Error(d.reason)));
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch(e => logError('chargement', e));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const act = name => () => { if (mainWindow) mainWindow.webContents.send('menu:action', name); };
  return Menu.buildFromTemplate([
    ...(mac ? [{ label: 'SkanFact Cabinet', submenu: [{ role: 'about', label: 'À propos' }, { type: 'separator' }, { role: 'hide', label: 'Masquer' }, { role: 'quit', label: 'Quitter' }] }] : []),
    { label: 'Fichier', submenu: [{ label: 'Importer un paquet…', accelerator: 'CmdOrCtrl+O', click: act('import') }, { type: 'separator' }, mac ? { role: 'close', label: 'Fermer' } : { role: 'quit', label: 'Quitter' }] },
    { label: 'Édition', submenu: [{ role: 'undo', label: 'Annuler' }, { role: 'redo', label: 'Rétablir' }, { type: 'separator' }, { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' }, { role: 'paste', label: 'Coller' }, { role: 'selectAll', label: 'Tout sélectionner' }] },
    { label: 'Affichage', submenu: [{ label: 'Dossiers', accelerator: 'CmdOrCtrl+1', click: act('go:dossiers') }, { label: 'Relances', accelerator: 'CmdOrCtrl+2', click: act('go:relances') }, { label: 'Réglages', accelerator: 'CmdOrCtrl+,', click: act('go:reglages') }, { type: 'separator' }, { role: 'reload', label: 'Recharger' }, { role: 'toggleDevTools', label: 'Outils de développement' }, { type: 'separator' }, { role: 'resetZoom', label: 'Taille réelle' }, { role: 'zoomIn', label: 'Agrandir' }, { role: 'zoomOut', label: 'Réduire' }] },
    { label: 'Fenêtre', submenu: [{ role: 'minimize', label: 'Réduire' }, { role: 'zoom', label: 'Zoom' }] }
  ]);
}

// ---------- IPC ----------
ipcMain.handle('cab:status', () => ({ exists: fileExists(), unlocked: !!state, version: VERSION }));
ipcMain.handle('cab:unlock', (_e, password) => unlock(password));
ipcMain.handle('cab:state', () => (state ? safeState() : null));

ipcMain.handle('cab:saveCabinet', (_e, patch) => {
  if (!state) throw new Error('Aucun dossier ouvert.');
  state.cabinet = { ...state.cabinet, name: String((patch && patch.name) || ''), email: String((patch && patch.email) || '') };
  writeState();
  return safeState();
});

ipcMain.handle('cab:saveDossier', (_e, { id, patch } = {}) => {
  if (!state) throw new Error('Aucun dossier ouvert.');
  const d = state.dossiers.find(x => x.id === id);
  if (!d) throw new Error('Dossier introuvable.');
  ['name', 'email', 'note'].forEach(k => { if (patch && patch[k] != null) d[k] = String(patch[k]); });
  if (patch && patch.archived != null) d.archived = !!patch.archived;
  writeState();
  return safeState();
});

// Un jeu d'exemple, pour qu'un comptable qui découvre l'application voie à quoi elle ressemble
// pleine. Il disparaît au premier vrai paquet importé (voir `cab:importPack`) : on ne mélange jamais
// des dossiers fictifs avec les comptabilités réelles de ses clients.
ipcMain.handle('cab:demo', (_e, on) => {
  if (!state) throw new Error('Aucun dossier ouvert.');
  state.dossiers = on
    ? state.dossiers.filter(d => !d.demo).concat(K.demoDossiers())
    : state.dossiers.filter(d => !d.demo);
  writeState();
  return safeState();
});

// Le fichier d'appairage à remettre aux clients : uniquement la clé publique.
ipcMain.handle('cab:exportPairing', async () => {
  if (!state) throw new Error('Aucun dossier ouvert.');
  const fp = Z.keyFingerprint(state.cabinet.publicKey);
  const safe = (state.cabinet.name || 'cabinet').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cabinet';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Fichier d\'appairage à remettre à tes clients',
    defaultPath: path.join(app.getPath('documents'), `${safe}.skanpair`),
    filters: [{ name: 'Appairage SkanFact', extensions: ['skanpair'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(K.pairingFile(state.cabinet, fp), null, 2), 'utf8');
  return { path: filePath, fingerprint: fp };
});

// Importer un paquet. C'est le geste central de l'application.
ipcMain.handle('cab:importPack', async (_e, opts) => {
  if (!state) throw new Error('Aucun dossier ouvert.');
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
  const results = [];
  for (const f of files) {
    try { results.push({ file: f, ...ingest(f, opts.password) }); }
    catch (err) { results.push({ file: f, error: err.message || String(err) }); }
  }
  // Un vrai paquet est arrivé : les dossiers d'exemple s'effacent d'eux-mêmes. Les laisser
  // reviendrait à afficher des retards imaginaires à côté des vrais.
  const demoOut = results.some(r => !r.error) && state.dossiers.some(d => d.demo);
  if (demoOut) state.dossiers = state.dossiers.filter(d => !d.demo);
  writeState();
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
  const manifest = JSON.parse(mEntry.data().toString('utf8'));

  // Vérification : chaque fichier annoncé est là, et avec l'empreinte annoncée. C'est ce qui permet
  // de dire « ce que j'ai reçu est exactement ce qui a été envoyé ».
  // On calcule l'empreinte de ce qu'on a reçu ; cabcore compare et compte. La règle du comptage
  // vit dans la partie testable : c'est la seule affirmation rigoureuse de cette application
  // (« ce que j'ai reçu est exactement ce qui a été envoyé »), elle doit compter juste.
  const hashes = {};
  entries.forEach(e => { try { hashes[e.name] = Z.sha256(e.data()); } catch { hashes[e.name] = '(illisible)'; } });
  const { checked, bad } = K.checkIntegrity(manifest, hashes);

  // On garde le paquet tel quel : c'est la pièce justificative, on ne la réécrit pas.
  fs.mkdirSync(packDir(), { recursive: true });
  const key2 = K.dossierKey(manifest).replace(/[^A-Za-z0-9]/g, '_');
  const dest = path.join(packDir(), `${key2}-${(manifest.periode || {}).mois || 'inconnu'}.skanpack`);
  fs.copyFileSync(file, dest);

  const res = K.filePack(state, manifest, {
    receivedAt: Date.now(), digest: Z.sha256(mEntry.data()), bytes: fs.statSync(file).size,
    path: dest, sealed
  });
  return { ...res, integrity: { checked, bad } };
}

// Ouvrir un fichier contenu dans un paquet : on l'extrait dans un dossier temporaire, en lecture.
ipcMain.handle('cab:openInPack', async (_e, { packPath, name, password } = {}) => {
  if (!state) throw new Error('Aucun dossier ouvert.');
  let buf = fs.readFileSync(packPath);
  if (Z.isSealedForCabinet(buf)) buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
  else if (Z.isSealed(buf)) buf = Z.openBuffer(buf, password || '');
  const e = Z.zipRead(buf).find(x => x.name === name);
  if (!e) throw new Error('Fichier absent du paquet.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skanpack-'));
  const out = path.join(dir, path.basename(name));
  fs.writeFileSync(out, e.data());
  await shell.openPath(out);
  return out;
});

// La liste des fichiers d'un paquet, sans rien extraire.
ipcMain.handle('cab:listPack', (_e, { packPath, password } = {}) => {
  if (!state) throw new Error('Aucun dossier ouvert.');
  let buf = fs.readFileSync(packPath);
  if (Z.isSealedForCabinet(buf)) buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
  else if (Z.isSealed(buf)) buf = Z.openBuffer(buf, password || '');
  return Z.zipRead(buf).map(e => ({ name: e.name, size: e.size }));
});

ipcMain.handle('cab:mail', async (_e, { to, subject, body } = {}) => {
  const url = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('cab:reveal', (_e, p) => shell.showItemInFolder(p));

// ---------- démarrage ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  process.on('uncaughtException', e => logError('erreur inattendue', e));
  process.on('unhandledRejection', e => logError('promesse rejetée', e));
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId(APP_ID);
    try { Menu.setApplicationMenu(buildMenu()); } catch (e) { logError('menu', e); }
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(e => logError('démarrage', e));
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
