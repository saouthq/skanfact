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
const sendUpd = (state, payload) => { try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:event', { state, ...(payload || {}) }); } catch {} };

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
    // Vérification silencieuse au démarrage : si une version est là, la pastille s'allume dans la
    // barre de gauche. Rien ne s'affiche s'il n'y a rien — on ne dérange pas pour dire « rien ».
    setTimeout(() => { checkForUpdates(true).catch(() => {}); }, 4000);
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(e => logError('démarrage', e));
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
