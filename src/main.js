// Process principal Electron : fenêtre, menu, stockage local, export PDF, mises à jour.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pkg = require('../package.json');
const { createStorage } = require('./storage');

const IS_MAC = process.platform === 'darwin';
// macOS : sans certificat Apple Developer, Squirrel.Mac refuse d'installer une mise à jour.
// On la télécharge quand même (electron-updater vérifie le sha512) et on remplace l'app nous-mêmes
// (src/mac-update.sh). Passe à true le jour où l'app est signée : electron-updater fera tout.
const MAC_SIGNED = false;

let mainWindow = null;
let storage = null;

// ---------- une seule instance ----------
// Deux fenêtres qui écrivent le même fichier = données corrompues.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  main();
}

function main() {
  if (process.platform === 'win32') app.setAppUserModelId(pkg.build.appId);
  app.setAboutPanelOptions({
    applicationName: 'SkanFact',
    applicationVersion: app.getVersion(),
    version: '',
    copyright: '© SKANCYBER SECURITY SUARL',
    credits: 'Devis et factures'
  });

  app.whenReady().then(() => {
    storage = createStorage(app.getPath('userData'));
    Menu.setApplicationMenu(buildMenu());
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    // Vérification silencieuse des mises à jour 5 s après l'ouverture.
    if (app.isPackaged) setTimeout(() => checkForUpdates(true), 5000);
  });

  app.on('window-all-closed', () => { if (!IS_MAC) app.quit(); });
}

// ---------- fenêtre ----------

const WINDOW_STATE = () => path.join(app.getPath('userData'), 'window-state.json');

function readWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(WINDOW_STATE(), 'utf8'));
    if (!s || typeof s.width !== 'number' || typeof s.height !== 'number') return null;
    // la fenêtre doit apparaître sur un écran encore branché
    if (typeof s.x === 'number' && typeof s.y === 'number') {
      const onScreen = screen.getAllDisplays().some(d => {
        const b = d.workArea;
        return s.x + 100 > b.x && s.x + 100 < b.x + b.width && s.y + 50 > b.y && s.y + 50 < b.y + b.height;
      });
      if (!onScreen) { delete s.x; delete s.y; }
    }
    return s;
  } catch { return null; }
}

function createWindow() {
  const st = readWindowState() || {};
  mainWindow = new BrowserWindow({
    width: st.width || 1280,
    height: st.height || 820,
    x: st.x, y: st.y,
    minWidth: 980,
    minHeight: 640,
    title: 'SkanFact',
    show: false,
    backgroundColor: '#f5f7fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (st.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  let saveTimer = null;
  const saveState = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const b = mainWindow.getNormalBounds();
      try { fs.writeFileSync(WINDOW_STATE(), JSON.stringify({ ...b, maximized: mainWindow.isMaximized() })); } catch {}
    }, 300);
  };
  mainWindow.on('resize', saveState);
  mainWindow.on('move', saveState);
  mainWindow.on('close', () => { clearTimeout(saveTimer); saveTimer = null; try { const b = mainWindow.getNormalBounds(); fs.writeFileSync(WINDOW_STATE(), JSON.stringify({ ...b, maximized: mainWindow.isMaximized() })); } catch {} });
  mainWindow.on('closed', () => { mainWindow = null; });
  // liens externes → navigateur, jamais dans l'app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

// ---------- menu ----------

function buildMenu() {
  const act = (name) => () => { if (!mainWindow) createWindow(); send('menu:action', name); };
  const releasesUrl = `https://github.com/${pkg.build.publish.owner}/${pkg.build.publish.repo}/releases`;

  const appMenu = IS_MAC ? [{
    label: 'SkanFact',
    submenu: [
      { role: 'about', label: 'À propos de SkanFact' },
      { label: 'Vérifier les mises à jour…', click: () => { act('settings')(); checkForUpdates(false); } },
      { type: 'separator' },
      { label: 'Paramètres…', accelerator: 'Cmd+,', click: act('settings') },
      { type: 'separator' },
      { role: 'hide', label: 'Masquer SkanFact' },
      { role: 'hideOthers', label: 'Masquer les autres' },
      { role: 'unhide', label: 'Tout afficher' },
      { type: 'separator' },
      { role: 'quit', label: 'Quitter SkanFact' }
    ]
  }] : [];

  const template = [
    ...appMenu,
    {
      label: 'Fichier',
      submenu: [
        { label: 'Nouveau devis', accelerator: 'CmdOrCtrl+N', click: act('new-devis') },
        { label: 'Nouvelle facture', accelerator: 'CmdOrCtrl+Shift+N', click: act('new-facture') },
        { type: 'separator' },
        { label: 'Enregistrer', accelerator: 'CmdOrCtrl+S', click: act('save') },
        { label: 'Exporter en PDF…', accelerator: 'CmdOrCtrl+P', click: act('pdf') },
        { type: 'separator' },
        { label: 'Exporter les données…', click: act('export-data') },
        { label: 'Importer des données…', click: act('import-data') },
        { label: 'Ouvrir le dossier des sauvegardes', click: () => openBackups() },
        ...(IS_MAC ? [] : [
          { type: 'separator' },
          { label: 'Paramètres', accelerator: 'Ctrl+,', click: act('settings') },
          { type: 'separator' },
          { role: 'quit', label: 'Quitter' }
        ])
      ]
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { label: 'Accueil', accelerator: 'CmdOrCtrl+1', click: act('go:dashboard') },
        { label: 'Devis', accelerator: 'CmdOrCtrl+2', click: act('go:devis') },
        { label: 'Factures', accelerator: 'CmdOrCtrl+3', click: act('go:factures') },
        { label: 'Clients', accelerator: 'CmdOrCtrl+4', click: act('go:clients') },
        { label: 'Catalogue', accelerator: 'CmdOrCtrl+5', click: act('go:catalogue') },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Taille réelle' },
        { role: 'zoomIn', label: 'Agrandir' },
        { role: 'zoomOut', label: 'Réduire' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Outils de développement' }
      ]
    },
    {
      label: 'Fenêtre',
      role: 'window',
      submenu: [
        { role: 'minimize', label: 'Réduire' },
        { role: 'zoom', label: 'Agrandir/réduire' },
        ...(IS_MAC ? [{ type: 'separator' }, { role: 'front', label: 'Tout ramener au premier plan' }] : [{ role: 'close', label: 'Fermer' }])
      ]
    },
    {
      label: 'Aide',
      role: 'help',
      submenu: [
        { label: 'Nouveautés de cette version', click: act('changelog') },
        { label: 'Toutes les versions (GitHub)', click: () => shell.openExternal(releasesUrl) },
        { type: 'separator' },
        { label: 'Ouvrir le dossier des données', click: () => shell.openPath(app.getPath('userData')) },
        ...(IS_MAC ? [] : [
          { type: 'separator' },
          { label: 'Vérifier les mises à jour…', click: () => { act('settings')(); checkForUpdates(false); } },
          { label: 'À propos de SkanFact', click: () => dialog.showMessageBox(mainWindow, { type: 'info', title: 'À propos de SkanFact', message: `SkanFact ${app.getVersion()}`, detail: 'Devis et factures\n© SKANCYBER SECURITY SUARL' }) }
        ])
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
}

// ---------- stockage ----------

ipcMain.handle('data:load', () => {
  const data = storage.read();
  const corruptFile = storage.state.corruptFile;
  storage.state.corruptFile = null;
  return { data, corruptFile };
});
ipcMain.handle('data:save', (_e, data) => storage.write(data));
ipcMain.handle('data:path', () => storage.file);

ipcMain.handle('data:export', async (_e, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter les données',
    defaultPath: path.join(app.getPath('documents'), `skanfact-export-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
});

ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer des données',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const parsed = storage.readExternal(filePaths[0]); // lève une erreur claire si ce n'est pas un export SkanFact
  storage.backupNow('avant-import');                   // on garde l'état précédent
  storage.write(parsed);
  return parsed;
});

function openBackups() {
  fs.mkdirSync(storage.backupDir, { recursive: true });
  return shell.openPath(storage.backupDir);
}
ipcMain.handle('backups:open', () => openBackups());
ipcMain.handle('backups:create', () => storage.backupNow('manuelle'));
ipcMain.handle('backups:list', () => storage.listBackups());

// ---------- logo ----------

ipcMain.handle('logo:pick', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir un logo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const file = filePaths[0];
  const size = fs.statSync(file).size;
  if (size > 1024 * 1024) throw new Error('Image trop lourde (1 Mo maximum). Réduis-la avant de l\'utiliser.');
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/jpeg';
  const b64 = fs.readFileSync(file).toString('base64');
  return `data:${mime};base64,${b64}`;
});

// ---------- PDF ----------

ipcMain.handle('pdf:export', async (_e, { html, suggestedName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le PDF',
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return null;

  // Le document passe par un fichier temporaire : une URL data: est limitée en taille (logo en base64).
  const tmp = path.join(app.getPath('temp'), `skanfact-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    await win.loadFile(tmp);
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true
    });
    fs.writeFileSync(filePath, pdf);
  } finally {
    win.destroy();
    try { fs.unlinkSync(tmp); } catch {}
  }
  return filePath;
});

ipcMain.handle('shell:open', (_e, target) => shell.openPath(target));
ipcMain.handle('shell:showInFolder', (_e, target) => shell.showItemInFolder(target));
ipcMain.handle('app:changelog', () => {
  try { return fs.readFileSync(path.join(app.getAppPath(), 'CHANGELOG.md'), 'utf8'); } catch { return ''; }
});

// ---------- mises à jour ----------
// Versions publiées sur GitHub Releases (package.json → build.publish). Dépôt privé : token de lecture
// saisi par l'utilisateur, stocké dans userData/update-config.json (jamais dans le code).
//  - vérification silencieuse au démarrage, puis à la demande (Paramètres, menu) ;
//  - téléchargement automatique en arrière-plan dès qu'une version est disponible ;
//  - Windows : installation par electron-updater (installateur NSIS silencieux) ;
//  - macOS non signé : installation par src/mac-update.sh.

let updater = null;
let updateInfo = null;
let downloaded = false;
let downloadedFile = null;
let silent = true;

const UPDATE_CFG = () => path.join(app.getPath('userData'), 'update-config.json');
const UPDATE_RESULT = () => path.join(app.getPath('userData'), 'update-result.json');
function readUpdateCfg() { try { return JSON.parse(fs.readFileSync(UPDATE_CFG(), 'utf8')); } catch { return {}; } }
function writeUpdateCfg(cfg) { fs.mkdirSync(path.dirname(UPDATE_CFG()), { recursive: true }); fs.writeFileSync(UPDATE_CFG(), JSON.stringify(cfg), { mode: 0o600 }); }

function configureFeed(u) {
  const pub = pkg.build.publish;
  const cfg = readUpdateCfg();
  u.setFeedURL({ provider: 'github', owner: pub.owner, repo: pub.repo, private: !!cfg.token, token: cfg.token || undefined });
}

function notesToText(notes) {
  if (!notes) return '';
  if (Array.isArray(notes)) return notes.map(n => (n && n.note) || '').join('\n');
  return String(notes);
}

function sendUpdate(state, payload) { send('update:event', { state, ...(payload || {}) }); }

function getUpdater() {
  if (updater) return updater;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = !IS_MAC || MAC_SIGNED;
    autoUpdater.autoRunAppAfterInstall = true;
    autoUpdater.logger = null;
    autoUpdater.on('checking-for-update', () => { if (!silent) sendUpdate('checking'); });
    autoUpdater.on('update-available', (info) => { updateInfo = info; downloaded = false; downloadedFile = null; sendUpdate('available', { version: info.version, notes: notesToText(info.releaseNotes) }); });
    autoUpdater.on('update-not-available', () => { if (!silent) sendUpdate('none'); });
    autoUpdater.on('download-progress', (p) => sendUpdate('downloading', { percent: Math.round(p.percent), version: updateInfo && updateInfo.version }));
    autoUpdater.on('update-downloaded', (info) => { downloaded = true; downloadedFile = info.downloadedFile || null; sendUpdate('downloaded', { version: info.version, notes: notesToText(info.releaseNotes) }); });
    autoUpdater.on('error', (err) => { if (!silent) sendUpdate('error', { message: friendlyError(err) }); });
    configureFeed(autoUpdater);
    updater = autoUpdater;
  } catch (e) {
    updater = null;
  }
  return updater;
}

function updatesConfigured() {
  const pub = pkg.build.publish;
  return !!(pub && pub.owner && pub.repo);
}

function friendlyError(err) {
  const m = String(err && err.message || err);
  if (/404/.test(m)) return 'Aucune version trouvée sur GitHub : token manquant ou sans accès au dépôt (Paramètres → Mises à jour).';
  if (/401|403|Bad credentials/i.test(m)) return 'Token GitHub refusé ou expiré. Génère-en un nouveau et colle-le ci-dessous.';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|net::/i.test(m)) return 'Impossible de joindre GitHub. Vérifie ta connexion internet.';
  if (/sha512|checksum/i.test(m)) return 'Le fichier téléchargé est corrompu. Réessaie.';
  return m.split('\n')[0].slice(0, 200);
}

async function checkForUpdates(isSilent) {
  silent = !!isSilent;
  if (!app.isPackaged) return { state: 'dev' };
  if (!updatesConfigured()) return { state: 'unconfigured' };
  const u = getUpdater();
  if (!u) return { state: 'error', message: 'Module de mise à jour indisponible.' };
  if (downloaded) { sendUpdate('downloaded', { version: updateInfo && updateInfo.version, notes: notesToText(updateInfo && updateInfo.releaseNotes) }); return { state: 'ok' }; }
  try { await u.checkForUpdates(); return { state: 'ok' }; }
  catch (e) { return { state: 'error', message: friendlyError(e) }; }
}

// Résultat de la dernière mise à jour Mac (écrit par mac-update.sh), lu une seule fois au démarrage suivant.
function takeLastUpdateResult() {
  try {
    const r = JSON.parse(fs.readFileSync(UPDATE_RESULT(), 'utf8'));
    fs.unlinkSync(UPDATE_RESULT());
    return r;
  } catch { return null; }
}

ipcMain.handle('update:version', () => ({
  version: app.getVersion(), packaged: app.isPackaged, platform: process.platform, macSigned: MAC_SIGNED,
  hasToken: !!readUpdateCfg().token, lastUpdate: takeLastUpdateResult()
}));

ipcMain.handle('update:setToken', (_e, token) => {
  const cfg = readUpdateCfg();
  if (token) cfg.token = String(token).trim(); else delete cfg.token;
  writeUpdateCfg(cfg);
  if (updater) configureFeed(updater);
  return { hasToken: !!cfg.token };
});

ipcMain.handle('update:check', () => checkForUpdates(false));

ipcMain.handle('update:download', async () => {
  const u = getUpdater();
  if (!u || !updateInfo) return { state: 'error', message: 'Aucune mise à jour détectée.' };
  silent = false;
  try { u.downloadUpdate(); return { state: 'ok' }; }
  catch (e) { return { state: 'error', message: friendlyError(e) }; }
});

ipcMain.handle('update:install', async () => {
  const u = getUpdater();
  if (!u) return { state: 'error', message: 'Module de mise à jour indisponible.' };
  if (IS_MAC && !MAC_SIGNED) return installOnMac();
  setImmediate(() => u.quitAndInstall(true, true));
  return { state: 'ok' };
});

ipcMain.handle('update:openReleases', () => shell.openExternal(`https://github.com/${pkg.build.publish.owner}/${pkg.build.publish.repo}/releases/latest`));

function installOnMac() {
  if (!downloaded || !downloadedFile || !fs.existsSync(downloadedFile)) return { state: 'error', message: 'Le téléchargement n\'est pas terminé.' };
  // /Applications/SkanFact.app/Contents/MacOS/SkanFact → /Applications/SkanFact.app
  const appPath = path.resolve(app.getPath('exe'), '..', '..', '..');
  if (!appPath.endsWith('.app') || !fs.existsSync(path.join(appPath, 'Contents', 'MacOS'))) {
    return { state: 'error', message: 'Application introuvable sur le disque. Installe SkanFact depuis le .dmg.' };
  }
  try { fs.accessSync(path.dirname(appPath), fs.constants.W_OK); }
  catch { return { state: 'error', message: `Impossible d'écrire dans ${path.dirname(appPath)}. Déplace SkanFact dans le dossier Applications de ta session, ou installe la nouvelle version depuis le .dmg.` }; }

  const dir = app.getPath('userData');
  const script = path.join(dir, 'mac-update.sh');
  const log = path.join(dir, 'mac-update.log');
  try {
    fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, 'mac-update.sh'), 'utf8'), { mode: 0o755 });
    try { fs.unlinkSync(UPDATE_RESULT()); } catch {}
    const out = fs.openSync(log, 'a');
    const child = spawn('/bin/bash', [script, String(process.pid), downloadedFile, appPath, UPDATE_RESULT(), updateInfo ? updateInfo.version : ''], {
      detached: true, stdio: ['ignore', out, out]
    });
    child.unref();
  } catch (e) {
    return { state: 'error', message: 'Impossible de lancer l\'installation : ' + e.message };
  }
  setTimeout(() => app.quit(), 300);
  return { state: 'ok' };
}
