// Process principal Electron : fenêtre, menu, stockage local, export PDF, mises à jour.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createStorage } = require('./storage');

// Identifiants de l'app. Ne PAS les lire dans package.json au démarrage : electron-builder
// retire la section « build » du package.json empaqueté (l'app installée n'a plus build.publish).
const APP_ID = 'tn.skancyber.skanfact';
const GITHUB = { owner: 'saouthq', repo: 'skanfact', private: true }; // dépôt privé : token de lecture obligatoire
const RELEASES_URL = `https://github.com/${GITHUB.owner}/${GITHUB.repo}/releases`;

const IS_MAC = process.platform === 'darwin';
// macOS : sans certificat Apple Developer, Squirrel.Mac refuse d'installer une mise à jour.
// On la télécharge quand même (electron-updater vérifie le sha512) et on remplace l'app nous-mêmes
// (src/mac-update.sh). Passe à true le jour où l'app est signée : electron-updater fera tout.
const MAC_SIGNED = false;

let mainWindow = null;
let storage = null;
let rendererDirty = false;   // l'interface a-t-elle un document modifié non enregistré ?
let forceClose = false;      // fermeture déjà confirmée par l'utilisateur

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

// Rien ne doit échouer en silence : une erreur du process principal est affichée à l'écran
// et notée dans userData/main.log (à joindre en cas de problème).
// Le jour du calendrier de l'utilisateur (pas le jour UTC, qui le soir est déjà demain à l'est).
function localDay() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function logToFile(where, err) {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'main.log'), `${new Date().toISOString()} [${where}] ${err && err.stack || err}\n`); } catch {}
}
function logError(where, err) {
  const msg = `${new Date().toISOString()} [${where}] ${err && err.stack || err}\n`;
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'main.log'), msg); } catch {}
  try { dialog.showErrorBox('SkanFact — erreur', `${where}\n\n${err && err.message || err}\n\nDétail dans : ${path.join(app.getPath('userData'), 'main.log')}`); } catch {}
}

function main() {
  process.on('uncaughtException', (e) => logError('erreur inattendue', e));
  process.on('unhandledRejection', (e) => logError('promesse rejetée', e));
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

  app.whenReady().then(() => {
    openStorage();
    try {
      app.setAboutPanelOptions({
        applicationName: 'SkanFact',
        applicationVersion: app.getVersion(),
        version: '',
        copyright: '',
        credits: 'Devis et factures pour les petites entreprises'
      });
    } catch (e) { logError('panneau À propos', e); }
    try { Menu.setApplicationMenu(buildMenu()); }
    catch (e) { logError('menu', e); } // on garde le menu par défaut plutôt que de ne rien afficher
    try { createWindow(); }
    catch (e) { logError('ouverture de la fenêtre', e); }
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    // Vérification silencieuse des mises à jour 5 s après l'ouverture.
    if (app.isPackaged) setTimeout(() => checkForUpdates(true), 5000);
  }).catch(e => logError('démarrage', e));

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
  // La fenêtre s'affiche dès que la page est prête, et de toute façon après 1,5 s :
  // une fenêtre vide vaut mieux qu'une app invisible dont on ne peut rien lire.
  const win = mainWindow;
  const showOnce = () => { if (!win.isDestroyed() && !win.isVisible()) { win.show(); win.focus(); } };
  win.once('ready-to-show', showOnce);
  setTimeout(showOnce, 1500);
  win.webContents.on('did-fail-load', (_e, code, desc, url) => { showOnce(); if (code !== -3) logError('chargement de l\'interface', new Error(`${desc} (${code}) ${url}`)); });
  win.webContents.on('render-process-gone', (_e, d) => logError('interface arrêtée', new Error(d.reason)));
  win.webContents.on('preload-error', (_e, p, err) => logError('preload', err));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch(e => logError('chargement de l\'interface', e));

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
  // Fermer la fenêtre pendant la saisie d'un devis le perdait sans un mot. On demande d'abord.
  // Le dialogue est natif : à ce stade la fenêtre s'en va, une modale dans la page serait trop fragile.
  mainWindow.on('close', (e) => {
    if (rendererDirty && !forceClose) {
      e.preventDefault();
      const { response } = dialog.showMessageBoxSync
        ? { response: dialog.showMessageBoxSync(mainWindow, {
            type: 'warning', buttons: ['Annuler', 'Fermer sans enregistrer'], defaultId: 0, cancelId: 0,
            title: 'Modifications non enregistrées',
            message: 'Tu as un document modifié qui n\'est pas enregistré.',
            detail: 'Si tu fermes maintenant, ces modifications sont perdues.'
          }) }
        : { response: 1 };
      if (response !== 1) return;
      forceClose = true;
      mainWindow.close();
      return;
    }
    clearTimeout(saveTimer); saveTimer = null;
    try { const b = mainWindow.getNormalBounds(); fs.writeFileSync(WINDOW_STATE(), JSON.stringify({ ...b, maximized: mainWindow.isMaximized() })); } catch {}
  });
  mainWindow.on('closed', () => { mainWindow = null; rendererDirty = false; forceClose = false; });
  // liens externes → navigateur, jamais dans l'app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

// ---------- menu ----------

function buildMenu() {
  const act = (name) => () => { if (!mainWindow) createWindow(); send('menu:action', name); };

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
        { label: 'Nouvel avoir', click: act('new-avoir') },
        { type: 'separator' },
        { label: 'Enregistrer', accelerator: 'CmdOrCtrl+S', click: act('save') },
        { label: 'Exporter en PDF…', accelerator: 'CmdOrCtrl+P', click: act('pdf') },
        { type: 'separator' },
        { label: 'Exporter les données…', click: act('export-data') },
        { label: 'Importer des données…', click: act('import-data') },
        { label: 'Ouvrir le dossier des sauvegardes', click: () => openBackups() },
        { type: 'separator' },
        { label: 'Verrouiller (mot de passe)', accelerator: 'CmdOrCtrl+L', click: act('lock') },
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
        // Revenir à l'écran précédent : la seule façon de sortir d'une sous-page était de cliquer
        // dans la barre latérale, ce qui fait perdre l'endroit d'où l'on venait.
        { label: 'Précédent', accelerator: 'CmdOrCtrl+[', click: act('back') },
        { type: 'separator' },
        { label: 'Accueil', accelerator: 'CmdOrCtrl+1', click: act('go:dashboard') },
        { label: 'Devis', accelerator: 'CmdOrCtrl+2', click: act('go:devis') },
        { label: 'Factures', accelerator: 'CmdOrCtrl+3', click: act('go:factures') },
        { label: 'Clients', accelerator: 'CmdOrCtrl+4', click: act('go:clients') },
        { label: 'Catalogue', accelerator: 'CmdOrCtrl+5', click: act('go:catalogue') },
        { label: 'Relances', click: act('go:relances') },
        { label: 'Contrats récurrents', click: act('go:contrats') },
        { label: 'Autres documents', click: act('go:autres') },
        { label: 'Achats et dépenses', accelerator: 'CmdOrCtrl+7', click: act('go:achats') },
        { label: 'Fournisseurs', click: act('go:fournisseurs') },
        { label: 'Trésorerie', accelerator: 'CmdOrCtrl+8', click: act('go:tresorerie') },
        { label: 'Marges et rentabilité', accelerator: 'CmdOrCtrl+9', click: act('go:marges') },
        { label: 'Paie', click: act('go:paie') },
        { label: 'Stock', click: act('go:stock') },
        { label: 'Immobilisations', click: act('go:immos') },
        { label: 'Statistiques', click: act('go:stats') },
        { label: 'Comptabilité', accelerator: 'CmdOrCtrl+6', click: act('go:compta') },
        { type: 'separator' },
        { label: 'Rechercher…', accelerator: 'CmdOrCtrl+K', click: act('search') },
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
        { label: 'Guide d\'utilisation', accelerator: 'CmdOrCtrl+?', click: act('go:aide') },
        { label: 'Comprendre la facturation', click: act('help:facture') },
        { label: 'TVA, timbre et retenue à la source', click: act('help:fiscal') },
        { label: 'Sauvegardes et sécurité', click: act('help:donnees') },
        { type: 'separator' },
        { label: 'Nouveautés de cette version', click: act('changelog') },
        { label: 'Toutes les versions (GitHub)', click: () => shell.openExternal(RELEASES_URL) },
        { type: 'separator' },
        { label: 'Ouvrir le dossier des données', click: () => shell.openPath(app.getPath('userData')) },
        ...(IS_MAC ? [] : [
          { type: 'separator' },
          { label: 'Vérifier les mises à jour…', click: () => { act('settings')(); checkForUpdates(false); } },
          { label: 'À propos de SkanFact', click: () => dialog.showMessageBox(mainWindow, { type: 'info', title: 'À propos de SkanFact', message: `SkanFact ${app.getVersion()}`, detail: 'Devis et factures pour les petites entreprises' }) }
        ])
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
}

// ---------- stockage ----------

// Réglages propres à cet ordinateur (dossiers, copie externe, identité du poste), hors du fichier de données.
// Modèle utilisé pour la lecture des factures (4.2.0). Modifiable par l'utilisateur si un autre
// convient mieux, mais celui-ci lit bien les photos de factures.
const OCR_DEFAULT_MODEL = 'claude-sonnet-5';

const APP_CFG = () => path.join(app.getPath('userData'), 'app-config.json');
function readAppCfg() { try { return JSON.parse(fs.readFileSync(APP_CFG(), 'utf8')); } catch { return {}; } }
function writeAppCfg(cfg) { fs.mkdirSync(path.dirname(APP_CFG()), { recursive: true }); fs.writeFileSync(APP_CFG(), JSON.stringify(cfg, null, 2)); }

// ---------- dossiers : plusieurs entreprises sur le même ordinateur ----------
// Chaque dossier a son fichier de données, ses sauvegardes et ses pièces jointes, dans
// userData/dossiers/<id>/. Un dossier peut aussi vivre dans un dossier partagé (iCloud, réseau) :
// c'est ce qui permet à deux personnes de travailler sur la même entreprise.
function dossiersDir() { return path.join(app.getPath('userData'), 'dossiers'); }

// Identité de ce poste : elle sert à dire QUI a enregistré en dernier, jamais à identifier une personne.
function deviceIdentity() {
  const cfg = readAppCfg();
  if (!cfg.deviceId) {
    cfg.deviceId = require('crypto').randomUUID();
    try { cfg.deviceName = cfg.deviceName || require('os').hostname().replace(/\.local$/, ''); } catch { cfg.deviceName = 'Cet ordinateur'; }
    writeAppCfg(cfg);
  }
  return { id: cfg.deviceId, name: cfg.deviceName || 'Cet ordinateur' };
}

// Reprise de l'existant : avant la 3.2.0, tout vivait directement dans userData. On recopie ce qui
// s'y trouve dans un premier dossier, sans jamais toucher à l'original — s'il faut revenir en
// arrière, le fichier d'origine est intact.
function ensureDossiers() {
  const cfg = readAppCfg();
  if (Array.isArray(cfg.dossiers) && cfg.dossiers.length) return cfg;
  const id = 'principal';
  const dest = path.join(dossiersDir(), id);
  fs.mkdirSync(dest, { recursive: true });
  const legacy = path.join(app.getPath('userData'), 'skanfact-data.json');
  try {
    if (fs.existsSync(legacy) && !fs.existsSync(path.join(dest, 'skanfact-data.json'))) {
      fs.copyFileSync(legacy, path.join(dest, 'skanfact-data.json'));
      const lb = path.join(app.getPath('userData'), 'backups');
      if (fs.existsSync(lb)) fs.cpSync(lb, path.join(dest, 'backups'), { recursive: true, force: false, errorOnExist: false });
      const la = path.join(app.getPath('userData'), 'pieces-jointes');
      if (fs.existsSync(la)) fs.cpSync(la, path.join(dest, 'pieces-jointes'), { recursive: true, force: false, errorOnExist: false });
    }
  } catch (e) { logError('reprise des dossiers', e); }
  cfg.dossiers = [{ id, name: 'Mon entreprise', dir: dest, shared: false }];
  cfg.currentDossier = id;
  writeAppCfg(cfg);
  return cfg;
}

function currentDossier() {
  const cfg = ensureDossiers();
  return cfg.dossiers.find(d => d.id === cfg.currentDossier) || cfg.dossiers[0];
}

function openStorage() {
  const cfg = ensureDossiers();
  const d = currentDossier();
  const me = deviceIdentity();
  storage = createStorage(d.dir, {
    log: (w, e) => logToFile(w, e),
    externalDir: (d.shared ? null : cfg.externalBackupDir) || null,
    deviceId: me.id, deviceName: me.name
  });
  return d;
}

ipcMain.handle('dossiers:list', () => {
  const cfg = ensureDossiers();
  return { dossiers: cfg.dossiers, current: cfg.currentDossier, device: deviceIdentity() };
});
ipcMain.handle('dossiers:switch', (_e, id) => {
  const cfg = ensureDossiers();
  if (!cfg.dossiers.some(d => d.id === id)) return { ok: false, error: 'Dossier inconnu.' };
  cfg.currentDossier = id; writeAppCfg(cfg);
  openStorage();
  if (mainWindow) mainWindow.reload();
  return { ok: true };
});
ipcMain.handle('dossiers:add', async (_e, { name, shared }) => {
  const cfg = ensureDossiers();
  const clean = String(name || '').trim();
  if (!clean) return { ok: false, error: 'Donne un nom à ce dossier.' };
  let dir;
  if (shared) {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir le dossier partagé (iCloud Drive, OneDrive, disque réseau…)',
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, cancelled: true };
    dir = path.join(r.filePaths[0], 'SkanFact-' + clean.replace(/[^A-Za-z0-9À-ÿ _-]/g, '').trim().replace(/\s+/g, '-'));
  } else {
    dir = path.join(dossiersDir(), 'd' + Date.now().toString(36));
  }
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return { ok: false, error: e.message }; }
  const entry = { id: 'd' + Date.now().toString(36), name: clean, dir, shared: !!shared };
  cfg.dossiers.push(entry); cfg.currentDossier = entry.id; writeAppCfg(cfg);
  openStorage();
  if (mainWindow) mainWindow.reload();
  return { ok: true, dossier: entry };
});
ipcMain.handle('dossiers:rename', (_e, { id, name }) => {
  const cfg = ensureDossiers();
  const d = cfg.dossiers.find(x => x.id === id); if (!d) return { ok: false };
  d.name = String(name || '').trim() || d.name; writeAppCfg(cfg); return { ok: true };
});
// Retirer un dossier de la liste ne supprime JAMAIS ses fichiers : ils restent là où ils sont.
ipcMain.handle('dossiers:forget', (_e, id) => {
  const cfg = ensureDossiers();
  if (cfg.dossiers.length <= 1) return { ok: false, error: 'Impossible de retirer le dernier dossier.' };
  const gone = cfg.dossiers.find(d => d.id === id);
  cfg.dossiers = cfg.dossiers.filter(d => d.id !== id);
  if (cfg.currentDossier === id) cfg.currentDossier = cfg.dossiers[0].id;
  writeAppCfg(cfg);
  openStorage();
  if (mainWindow) mainWindow.reload();
  return { ok: true, dir: gone && gone.dir };
});
ipcMain.handle('device:rename', (_e, name) => {
  const cfg = readAppCfg();
  cfg.deviceName = String(name || '').trim() || cfg.deviceName;
  writeAppCfg(cfg);
  if (storage) storage.state.deviceName = cfg.deviceName;
  return { ok: true, name: cfg.deviceName };
});

ipcMain.handle('data:load', () => {
  const r = storage.read();
  const corruptFile = storage.state.corruptFile;
  storage.state.corruptFile = null;
  const locked = !!(r && r.locked);
  return { data: locked ? null : r, locked, encrypted: storage.state.encrypted, corruptFile };
});
ipcMain.handle('data:save', (_e, { data, force } = {}) => storage.write(data, { force: !!force }));
ipcMain.handle('data:path', () => storage.file);

// ---------- mot de passe (chiffrement du fichier) ----------
ipcMain.handle('data:unlock', (_e, password) => storage.unlock(password));
ipcMain.handle('data:lock', () => { storage.lock(); if (mainWindow) mainWindow.reload(); return true; });
ipcMain.handle('data:security', () => ({ encrypted: storage.state.encrypted }));
ipcMain.handle('data:setPassword', (_e, { data, password, current }) => {
  if (storage.state.encrypted && storage.state.key) {
    const r = storage.unlock(current || '');
    if (!r.ok) return { ok: false, error: 'Mot de passe actuel incorrect.' };
  }
  storage.setPassword(data, password || '');
  return { ok: true, encrypted: storage.state.encrypted };
});

// ---------- copie externe des sauvegardes ----------
const externalInfo = () => ({ ...storage.state.external });
ipcMain.handle('backups:externalInfo', () => externalInfo());
ipcMain.handle('backups:setExternal', (_e, dir) => {
  const cfg = readAppCfg();
  if (dir) cfg.externalBackupDir = dir; else delete cfg.externalBackupDir;
  writeAppCfg(cfg);
  storage.setExternalDir(dir || null);
  return externalInfo();
});
ipcMain.handle('backups:chooseExternal', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Dossier de copie externe (iCloud Drive, clé USB, disque…)',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Utiliser ce dossier'
  });
  if (canceled || !filePaths.length) return null;
  const cfg = readAppCfg(); cfg.externalBackupDir = filePaths[0]; writeAppCfg(cfg);
  storage.setExternalDir(filePaths[0]);
  return externalInfo();
});

ipcMain.handle('data:export', async (_e, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter les données',
    defaultPath: path.join(app.getPath('documents'), `skanfact-export-${localDay()}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
});

let lastImportPath = null;
ipcMain.handle('data:import', async (_e, opts) => {
  opts = opts || {};
  let file = opts.retry ? lastImportPath : null;
  if (!file) {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer des données',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths.length) return null;
    file = filePaths[0];
  }
  lastImportPath = file;
  let parsed;
  try { parsed = storage.readExternal(file, opts.password); } // lève une erreur claire si ce n'est pas un export SkanFact
  catch (e) { if (e.code === 'ENCRYPTED') return { needPassword: true }; throw e; }
  storage.backupNow('avant-import');                   // on garde l'état précédent
  storage.write(parsed);
  return { data: parsed };
});

function openBackups() {
  fs.mkdirSync(storage.backupDir, { recursive: true });
  return shell.openPath(storage.backupDir);
}
ipcMain.handle('backups:open', () => openBackups());
ipcMain.handle('backups:create', (_e, label) => storage.backupNow(typeof label === 'string' && label ? label : 'manuelle'));
// Titre de la fenêtre : ce qui est ouvert se lit dans le Dock et le menu Fenêtre
ipcMain.on('window:title', (_e, title) => { if (mainWindow && typeof title === 'string') mainWindow.setTitle(title.slice(0, 120)); });
ipcMain.on('window:dirty', (_e, dirty) => { rendererDirty = !!dirty; });
ipcMain.handle('backups:list', () => storage.listBackups());

// ---------- logo ----------

ipcMain.handle('logo:pick', async (_e, title) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: title || 'Choisir un logo',
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

// ---------- pièces jointes ----------
// Les fichiers sont COPIÉS dans userData/pieces-jointes/<document>/ : si l'utilisateur déplace ou
// supprime l'original, la pièce reste attachée au document.
ipcMain.handle('attach:add', async (_e, docId) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir un ou plusieurs fichiers à joindre',
    properties: ['openFile', 'multiSelections']
  });
  if (canceled || !filePaths.length) return [];
  const out = [];
  for (const f of filePaths) {
    const size = fs.statSync(f).size;
    if (size > 25 * 1024 * 1024) throw new Error(`« ${path.basename(f)} » dépasse 25 Mo. Réduis le fichier avant de le joindre.`);
    out.push(storage.addAttachment(docId, f));
  }
  return out;
});
// Joindre un fichier dont on connaît déjà le chemin (la photo qu'on vient de lire, par exemple) :
// même copie dans userData/pieces-jointes/, sans redemander à l'utilisateur de le retrouver.
ipcMain.handle('attach:addPath', (_e, { docId, path: file } = {}) => {
  if (!file || !fs.existsSync(file)) throw new Error('Fichier introuvable.');
  const size = fs.statSync(file).size;
  if (size > 25 * 1024 * 1024) throw new Error(`« ${path.basename(file)} » dépasse 25 Mo.`);
  return storage.addAttachment(docId, file);
});
ipcMain.handle('attach:open', (_e, { docId, file }) => shell.openPath(storage.attachmentPath(docId, file)));
ipcMain.handle('attach:reveal', (_e, { docId, file }) => shell.showItemInFolder(storage.attachmentPath(docId, file)));
ipcMain.handle('attach:remove', (_e, { docId, file }) => storage.removeAttachment(docId, file));

// ---------- lecture d'une photo de facture d'achat (4.2.0) ----------
// Trois règles, dans cet ordre :
//  1. RIEN NE PART SANS CLÉ. Sans clé saisie par l'utilisateur, aucune requête réseau n'est émise :
//     la photo est simplement attachée comme justificatif, ce qui marche hors ligne et pour toujours.
//  2. La clé vit dans userData/lecture-config.json (mode 0600), jamais dans le code, jamais dans le
//     fichier de données, jamais dans une sauvegarde envoyée à quelqu'un.
//  3. L'APPLICATION NE REMPLIT JAMAIS TOUTE SEULE. Elle renvoie une proposition que l'utilisateur
//     valide ou corrige. Une erreur de lecture sur une quantité pourrit tout l'inventaire derrière.
const OCR_CFG = () => path.join(app.getPath('userData'), 'lecture-config.json');
function readOcrCfg() { try { return JSON.parse(fs.readFileSync(OCR_CFG(), 'utf8')); } catch { return {}; } }
function writeOcrCfg(cfg) { fs.mkdirSync(path.dirname(OCR_CFG()), { recursive: true }); fs.writeFileSync(OCR_CFG(), JSON.stringify(cfg), { mode: 0o600 }); }

const OCR_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' };

// Ce qu'on demande au modèle. Volontairement strict : du JSON, rien d'autre, et « null » plutôt qu'une
// invention quand l'information n'est pas lisible sur l'image.
const OCR_PROMPT = `Tu lis une facture d'achat tunisienne (ou un reçu) et tu en extrais les informations.

Réponds UNIQUEMENT par un objet JSON, sans texte avant ni après, sans balises de code, à ce format exact :
{
  "supplier": string|null,        // raison sociale du fournisseur, telle qu'écrite
  "matricule": string|null,       // matricule fiscal du fournisseur
  "number": string|null,          // numéro de la facture
  "date": string|null,            // date de la facture, format AAAA-MM-JJ
  "dueDate": string|null,         // échéance de paiement si elle figure, format AAAA-MM-JJ
  "subject": string|null,         // objet en quelques mots
  "currency": string|null,        // "TND", "EUR", "USD"…
  "fees": number|null,            // timbre fiscal et frais divers, en unité monétaire
  "totalHT": number|null,         // total hors taxes annoncé sur la pièce
  "totalTTC": number|null,        // total toutes taxes comprises annoncé sur la pièce
  "lines": [                      // une entrée par ligne de la facture
    { "label": string, "qty": number, "unitPrice": number, "vatRate": number }
  ]
}

Règles :
- N'INVENTE RIEN. Si une information n'est pas lisible, mets null (ou omets la ligne).
- Les montants sont des nombres, avec le point comme séparateur décimal, sans symbole ni espace.
- "unitPrice" est le prix unitaire HORS TAXES. Si seul un prix TTC figure, divise-le par (1 + taux/100).
- "vatRate" est un nombre : 0, 7, 13 ou 19 en Tunisie. Si aucun taux n'est lisible, mets 19.
- Les dates tunisiennes s'écrivent souvent JJ/MM/AAAA : convertis-les en AAAA-MM-JJ.
- Ne mets pas le timbre fiscal dans les lignes : il va dans "fees".`;

function ocrRequest(key, model, payload) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload));
    const req = require('https').request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': body.length,
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      timeout: 120000
    }, (res) => {
      let out = '';
      res.setEncoding('utf8');
      res.on('data', c => { out += c; });
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) return reject(new Error('Clé refusée : vérifie-la dans Paramètres → Lecture de factures.'));
        if (res.statusCode === 429) return reject(new Error('Trop de demandes d\'un coup. Réessaie dans une minute.'));
        if (res.statusCode >= 400) {
          let msg = '';
          try { msg = (JSON.parse(out).error || {}).message || ''; } catch {}
          return reject(new Error(`Le service a répondu ${res.statusCode}${msg ? ' : ' + msg : ''}.`));
        }
        try { resolve(JSON.parse(out)); } catch { reject(new Error('Réponse illisible du service.')); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('Le service met trop de temps à répondre. Réessaie, ou saisis la facture à la main.')); });
    req.on('error', (e) => reject(new Error(/ENOTFOUND|EAI_AGAIN|ECONNREFUSED/.test(e.code || '') ? 'Pas de connexion internet. Tu peux joindre la photo et saisir la facture à la main.' : e.message)));
    req.end(body);
  });
}

// Le modèle peut encadrer son JSON de texte malgré la consigne : on récupère le premier objet complet.
function parseOcrJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Le service n\'a pas renvoyé de facture lisible.');
  return JSON.parse(s.slice(start, end + 1));
}

ipcMain.handle('ocr:status', () => {
  const cfg = readOcrCfg();
  return { hasKey: !!cfg.key, model: cfg.model || OCR_DEFAULT_MODEL, lastUsed: cfg.lastUsed || '' };
});
ipcMain.handle('ocr:setKey', (_e, { key, model } = {}) => {
  const cfg = readOcrCfg();
  if (key === null) { try { fs.unlinkSync(OCR_CFG()); } catch {} return { hasKey: false, model: OCR_DEFAULT_MODEL }; }
  if (typeof key === 'string' && key.trim()) cfg.key = key.trim();
  if (model) cfg.model = model;
  writeOcrCfg(cfg);
  return { hasKey: !!cfg.key, model: cfg.model || OCR_DEFAULT_MODEL };
});

// Choisir la photo. Aucune requête réseau ici : on renvoie juste le chemin et la taille.
ipcMain.handle('ocr:pick', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir la photo ou le PDF de la facture',
    filters: [{ name: 'Facture', extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const f = filePaths[0];
  const type = OCR_TYPES[path.extname(f).toLowerCase()];
  if (!type) throw new Error('Format non reconnu. Utilise une photo (JPG, PNG, WEBP) ou un PDF.');
  const size = fs.statSync(f).size;
  if (size > 10 * 1024 * 1024) throw new Error(`« ${path.basename(f)} » fait ${(size / 1024 / 1024).toFixed(1)} Mo. Au-delà de 10 Mo, le service refuse l'image : prends une photo un peu moins lourde.`);
  return { path: f, name: path.basename(f), size, type };
});

// La lecture elle-même. Appelée seulement quand l'utilisateur a saisi une clé ET cliqué « Lire ».
ipcMain.handle('ocr:read', async (_e, { path: file } = {}) => {
  const cfg = readOcrCfg();
  if (!cfg.key) throw new Error('Aucune clé n\'est enregistrée : rien n\'a été envoyé. Paramètres → Lecture de factures.');
  if (!file || !fs.existsSync(file)) throw new Error('Fichier introuvable.');
  const type = OCR_TYPES[path.extname(file).toLowerCase()];
  if (!type) throw new Error('Format non reconnu.');
  const b64 = fs.readFileSync(file).toString('base64');
  const source = { type: 'base64', media_type: type, data: b64 };
  const content = [
    type === 'application/pdf' ? { type: 'document', source } : { type: 'image', source },
    { type: 'text', text: OCR_PROMPT }
  ];
  const res = await ocrRequest(cfg.key, cfg.model || OCR_DEFAULT_MODEL, {
    model: cfg.model || OCR_DEFAULT_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content }]
  });
  const text = (res.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  const parsed = parseOcrJson(text);
  cfg.lastUsed = new Date().toISOString();
  writeOcrCfg(cfg);
  return parsed;
});

// ---------- PDF ----------

const { fitToPage } = require('./renderer/core.js');

// Rend un document HTML en PDF A4. Le HTML passe par un fichier temporaire : une URL data:
// est limitée en taille (logo en base64).
async function renderPdf(html, win) {
  const tmp = path.join(app.getPath('temp'), `skanfact-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  try {
    await win.loadFile(tmp);
    // Même règle que l'aperçu : si le contenu déborde d'un peu, marges resserrées pour tenir sur une page.
    try { await win.webContents.executeJavaScript('(' + fitToPage.toString() + ')(document)'); } catch (e) { logToFile('fitToPage', e); }
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true
    });
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}
const pdfWindow = () => new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });

ipcMain.handle('pdf:export', async (_e, { html, suggestedName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le PDF',
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return null;
  const win = pdfWindow();
  try { fs.writeFileSync(filePath, await renderPdf(html, win)); }
  finally { win.destroy(); }
  return filePath;
});

// Export groupé (journal des ventes) : tous les PDF dans un dossier choisi par l'utilisateur.
ipcMain.handle('pdf:exportMany', async (_e, { files, folderName }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir le dossier où créer les PDF',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Exporter ici'
  });
  if (canceled || !filePaths.length) return null;
  const dir = path.join(filePaths[0], folderName || 'SkanFact');
  fs.mkdirSync(dir, { recursive: true });
  const win = pdfWindow();
  try {
    for (const f of files) {
      const safe = String(f.name).replace(/[\\/:*?"<>|]/g, '_');
      fs.writeFileSync(path.join(dir, safe), await renderPdf(f.html, win));
    }
  } finally { win.destroy(); }
  return dir;
});

// PDF sans boîte de dialogue (pièce jointe d'un email) : userData/envois/<nom>.pdf
ipcMain.handle('pdf:exportSilent', async (_e, { html, name }) => {
  const dir = path.join(app.getPath('userData'), 'envois');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, String(name || 'document.pdf').replace(/[\\/:*?"<>|]/g, '_'));
  const win = pdfWindow();
  try { fs.writeFileSync(file, await renderPdf(html, win)); }
  finally { win.destroy(); }
  return file;
});

// Fichier texte sans boîte de dialogue (pièce jointe d'un email) : userData/envois/<nom>
ipcMain.handle('file:saveSilent', (_e, { name, content }) => {
  const dir = path.join(app.getPath('userData'), 'envois');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, String(name || 'export.csv').replace(/[\\/:*?"<>|]/g, '_'));
  fs.writeFileSync(file, content, 'utf8');
  return file;
});

// Composition d'un email dans le client de messagerie de l'utilisateur.
//  - macOS + Apple Mail : nouveau message avec destinataire, objet, texte ET le PDF joint (AppleScript) ;
//  - sinon : lien mailto (sans pièce jointe possible) + le PDF est montré dans le Finder / l'Explorateur.
ipcMain.handle('mail:compose', async (_e, { to, subject, body, attachment, attachments, mode }) => {
  // `attachments` (tableau) depuis la 3.1.0 : l'envoi au comptable joint plusieurs journaux.
  // `attachment` (fichier unique) reste accepté pour tous les envois de documents.
  const files = (Array.isArray(attachments) ? attachments : []).concat(attachment ? [attachment] : []).filter(Boolean);
  if (IS_MAC && mode !== 'mailto') {
    const esc = v => String(v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = [
      'tell application "Mail"',
      `  set m to make new outgoing message with properties {subject:"${esc(subject)}", content:"${esc(body)}", visible:true}`,
      to ? `  tell m to make new to recipient at end of to recipients with properties {address:"${esc(to)}"}` : '',
      files.length ? '  delay 0.5' : '',
      ...files.map(f => `  tell m to make new attachment with properties {file name:POSIX file "${esc(f)}"} at after the last paragraph`),
      '  activate',
      'end tell'
    ].filter(Boolean).join('\n');
    const tmp = path.join(app.getPath('temp'), `skanfact-mail-${Date.now()}.applescript`);
    fs.writeFileSync(tmp, script, 'utf8');
    try {
      await new Promise((resolve, reject) => require('child_process').execFile('osascript', [tmp], { timeout: 20000 }, (err, _out, stderr) => err ? reject(new Error((stderr || err.message).trim())) : resolve()));
      return { state: 'mail' };
    } catch (e) {
      logToFile('mail', e);
      // Mail indisponible (autre client, refus d'automatisation…) : on retombe sur mailto
    } finally { try { fs.unlinkSync(tmp); } catch {} }
  }
  const url = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
  await shell.openExternal(url);
  if (files.length) shell.showItemInFolder(files[0]);
  return { state: 'mailto' };
});

// Enregistrement d'un fichier texte (CSV pour le comptable).
ipcMain.handle('file:saveText', async (_e, { suggestedName, content }) => {
  const ext = path.extname(suggestedName || '').slice(1) || 'txt';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer',
    defaultPath: path.join(app.getPath('documents'), suggestedName || 'export.txt'),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf8');
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
  const cfg = readUpdateCfg();
  u.setFeedURL({ provider: 'github', owner: GITHUB.owner, repo: GITHUB.repo, private: !!cfg.token, token: cfg.token || undefined });
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
    // journal des mises à jour (userData/updater.log) : indispensable pour diagnostiquer à distance
    const ulog = path.join(app.getPath('userData'), 'updater.log');
    const ul = (lvl) => (m) => { try { fs.appendFileSync(ulog, `${new Date().toISOString()} ${lvl} ${m}\n`); } catch {} };
    autoUpdater.logger = { info: ul('info'), warn: ul('warn'), error: ul('error'), debug: ul('debug') };
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

function updatesConfigured() { return !!(GITHUB.owner && GITHUB.repo); }

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
  // Sans token, un dépôt privé répond toujours 404 : inutile d'interroger GitHub, on explique quoi faire.
  if (GITHUB.private && !readUpdateCfg().token) return { state: 'token' };
  const u = getUpdater();
  if (!u) return { state: 'error', message: 'Module de mise à jour indisponible.' };
  if (downloaded) { sendUpdate('downloaded', { version: updateInfo && updateInfo.version, notes: notesToText(updateInfo && updateInfo.releaseNotes) }); return { state: 'ok' }; }
  // 45 s maximum : sans réponse de GitHub on rend la main avec un message plutôt que d'attendre sans fin
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('ETIMEDOUT: pas de réponse de GitHub')), 45000));
  try {
    const r = await Promise.race([u.checkForUpdates(), timeout]);
    // null = electron-updater inactif dans cette installation (ex. Linux hors AppImage) : aucun événement n'arrivera
    if (!r) return { state: 'error', message: 'Le module de mise à jour est inactif dans cette installation. Télécharge la nouvelle version depuis GitHub.' };
    return { state: 'ok' };
  } catch (e) { return { state: 'error', message: friendlyError(e) }; }
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

ipcMain.handle('update:openReleases', () => shell.openExternal(RELEASES_URL + '/latest'));

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
