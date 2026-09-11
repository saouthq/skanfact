// Process principal Electron : fenêtre, stockage local, export PDF.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = () => path.join(app.getPath('userData'), 'skanfact-data.json');
const BACKUP_DIR = () => path.join(app.getPath('userData'), 'backups');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'SkanFact',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------- Stockage ----------

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE(), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null; // pas encore de fichier : le renderer initialise les valeurs par défaut
  }
}

function writeData(data) {
  const file = DATA_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // écriture atomique : on écrit dans un temporaire puis on renomme
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  rotateBackup(file);
  return true;
}

// Une sauvegarde par jour, on garde les 30 dernières.
function rotateBackup(file) {
  try {
    const dir = BACKUP_DIR();
    fs.mkdirSync(dir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const target = path.join(dir, `skanfact-${today}.json`);
    fs.copyFileSync(file, target);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    while (files.length > 30) fs.unlinkSync(path.join(dir, files.shift()));
  } catch (e) {
    console.error('backup failed', e);
  }
}

ipcMain.handle('data:load', () => readData());
ipcMain.handle('data:save', (_e, data) => writeData(data));
ipcMain.handle('data:path', () => DATA_FILE());

ipcMain.handle('data:export', async (_e, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter les données',
    defaultPath: `skanfact-export-${new Date().toISOString().slice(0, 10)}.json`,
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
  const parsed = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
  writeData(parsed);
  return parsed;
});

// ---------- Logo ----------

ipcMain.handle('logo:pick', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir un logo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const file = filePaths[0];
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/jpeg';
  const b64 = fs.readFileSync(file).toString('base64');
  return `data:${mime};base64,${b64}`;
});

// ---------- PDF ----------

ipcMain.handle('pdf:export', async (_e, { html, suggestedName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le PDF',
    defaultPath: suggestedName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return null;

  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true }
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true
    });
    fs.writeFileSync(filePath, pdf);
  } finally {
    win.destroy();
  }
  return filePath;
});

ipcMain.handle('shell:open', (_e, target) => shell.openPath(target));
ipcMain.handle('shell:showInFolder', (_e, target) => shell.showItemInFolder(target));

// ---------- Mises à jour ----------
// Les nouvelles versions sont publiées sur GitHub Releases (voir package.json → build.publish).
// Windows : téléchargement + installation automatiques.
// macOS : sans signature Apple, electron-updater refuse d'installer ; on télécharge alors le .dmg
//         et on l'ouvre pour que l'utilisateur glisse l'app dans Applications. Passe MAC_SIGNED à true
//         le jour où l'app est signée avec un certificat Apple Developer.
const MAC_SIGNED = false;
let updater = null;
let updateInfo = null;

// Le token GitHub (dépôt privé) est stocké dans le dossier de données de l'utilisateur, jamais dans le code.
const UPDATE_CFG = () => path.join(app.getPath('userData'), 'update-config.json');
function readUpdateCfg() { try { return JSON.parse(fs.readFileSync(UPDATE_CFG(), 'utf8')); } catch { return {}; } }
function writeUpdateCfg(cfg) { fs.mkdirSync(path.dirname(UPDATE_CFG()), { recursive: true }); fs.writeFileSync(UPDATE_CFG(), JSON.stringify(cfg), { mode: 0o600 }); }

function configureFeed(u) {
  const pub = require('../package.json').build.publish;
  const cfg = readUpdateCfg();
  u.setFeedURL({ provider: 'github', owner: pub.owner, repo: pub.repo, private: !!cfg.token, token: cfg.token || undefined });
}

function sendUpdate(state, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:event', { state, ...(payload || {}) });
}

function getUpdater() {
  if (updater) return updater;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;
    autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
    autoUpdater.on('update-available', (info) => { updateInfo = info; sendUpdate('available', { version: info.version, notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '' }); });
    autoUpdater.on('update-not-available', () => sendUpdate('none'));
    autoUpdater.on('download-progress', (p) => sendUpdate('downloading', { percent: Math.round(p.percent), speed: p.bytesPerSecond }));
    autoUpdater.on('update-downloaded', () => sendUpdate('downloaded'));
    autoUpdater.on('error', (err) => sendUpdate('error', { message: friendlyError(err) }));
    configureFeed(autoUpdater);
    updater = autoUpdater;
  } catch (e) {
    updater = null;
  }
  return updater;
}

ipcMain.handle('update:version', () => ({ version: app.getVersion(), packaged: app.isPackaged, platform: process.platform, macSigned: MAC_SIGNED, hasToken: !!readUpdateCfg().token }));
ipcMain.handle('update:setToken', (_e, token) => {
  const cfg = readUpdateCfg();
  if (token) cfg.token = String(token).trim(); else delete cfg.token;
  writeUpdateCfg(cfg);
  if (updater) configureFeed(updater);
  return { hasToken: !!cfg.token };
});

function updatesConfigured() {
  const pub = require('../package.json').build.publish;
  return pub && pub.owner && pub.owner !== 'SKANDER_GITHUB';
}

function friendlyError(err) {
  const m = String(err && err.message || err);
  if (/404/.test(m)) return 'Aucune version trouvée sur GitHub : dépôt introuvable, sans release, ou token manquant/invalide pour un dépôt privé.';
  if (/401|Bad credentials/i.test(m)) return 'Token GitHub refusé. Vérifie-le dans le champ ci-dessous.';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::/i.test(m)) return 'Impossible de joindre GitHub. Vérifie ta connexion internet.';
  return m.split('\n')[0].slice(0, 200);
}

ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { state: 'dev' };
  if (!updatesConfigured()) return { state: 'unconfigured' };
  const u = getUpdater();
  if (!u) return { state: 'error', message: 'Module de mise à jour indisponible.' };
  try { await u.checkForUpdates(); return { state: 'ok' }; }
  catch (e) { return { state: 'error', message: friendlyError(e) }; }
});

ipcMain.handle('update:download', async () => {
  const u = getUpdater();
  if (!u || !updateInfo) return { state: 'error', message: 'Aucune mise à jour détectée.' };
  if (process.platform === 'darwin' && !MAC_SIGNED) {
    // Ouvre la page de la release : l'utilisateur télécharge le .dmg et remplace l'app.
    const pkg = require('../package.json');
    const url = `https://github.com/${pkg.build.publish.owner}/${pkg.build.publish.repo}/releases/latest`;
    await shell.openExternal(url);
    return { state: 'manual', url };
  }
  try { u.downloadUpdate(); return { state: 'ok' }; }
  catch (e) { return { state: 'error', message: String(e && e.message || e) }; }
});

ipcMain.handle('update:install', () => {
  const u = getUpdater();
  if (u) setImmediate(() => u.quitAndInstall(false, true));
  return true;
});

// Vérification silencieuse au démarrage (5 s après l'ouverture), sans téléchargement.
app.whenReady().then(() => {
  if (app.isPackaged && updatesConfigured()) setTimeout(() => { const u = getUpdater(); if (u) u.checkForUpdates().catch(() => {}); }, 5000);
});

// ---------- Cycle de vie ----------

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
