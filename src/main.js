// Process principal Electron : fenêtre, menu, stockage local, export PDF, mises à jour.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createStorage } = require('./storage');
const { zipBuffer, sha256, sealBuffer, sealForCabinet, keyFingerprint } = require('./zip');

// Identifiants de l'app. Ne PAS les lire dans package.json au démarrage : electron-builder
// retire la section « build » du package.json empaqueté (l'app installée n'a plus build.publish).
const APP_ID = 'tn.skancyber.skanfact';
const PKG = require('../package.json');
// Le dépôt est PUBLIC depuis le 13/09/2026 : les releases se téléchargent sans rien présenter.
// Tant que `private` valait `true`, l'application réclamait un jeton de lecture que plus personne
// n'a besoin de fournir, et l'écran des mises à jour affirmait « Le dépôt GitHub de SkanFact est
// privé » — une phrase devenue fausse, sur l'écran qu'on regarde au moment d'installer.
const GITHUB = { owner: 'saouthq', repo: 'skanfact', private: false };
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

// En mode développement (`npm start`), on travaille dans un dossier de données SÉPARÉ.
// Sans ça, on écrit dans les vraies données de l'utilisateur : l'application installée s'appelle
// « SkanFact » et celle lancée depuis les sources « skanfact », or macOS ne distingue pas les
// majuscules dans les noms de dossiers — c'est donc le MÊME dossier. Essayer une version pas encore
// publiée sur ses factures réelles est le genre d'accident qu'on ne découvre qu'après.
// On respecte `--user-data-dir` quand il est fourni : les tests s'en servent pour s'isoler.
function separateDevData() {
  if (app.isPackaged) return;
  if (process.argv.some(a => a.startsWith('--user-data-dir'))) return;
  try { app.setPath('userData', path.join(app.getPath('appData'), 'SkanFact (essais)')); } catch {}
}

function main() {
  process.on('uncaughtException', (e) => logError('erreur inattendue', e));
  process.on('unhandledRejection', (e) => logError('promesse rejetée', e));
  separateDevData();
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

// ---------- chien de garde (6.6.0) ----------
//
// Un gel de l'interface ne laisse AUCUNE trace : rien ne plante, aucune erreur, les journaux restent
// vides. C'est exactement ce qui s'est passé en 5.1.0 — une boucle infinie dans un calcul de dates,
// invisible sur la machine de test, et un utilisateur devant une application morte sans rien à
// envoyer. Ce chien de garde transforme ce silence en rapport.
//
// Le point à ne pas rater : le domaine Debugger doit être activé **avant** le gel. `Debugger.enable`
// attend le fil principal ; demandé pendant le gel, il attendrait pour toujours.
const WATCHDOG = { every: 3000, dead: 12000, enabled: true };
// Le dernier gel constaté, pour le dire à l'utilisateur une fois l'interface revenue et pour le
// joindre à un rapport de problème.
let lastFreeze = null;
function startWatchdog(win) {
  if (!WATCHDOG.enabled || !win || win.isDestroyed()) return;
  let lastPong = Date.now();
  let reported = false;

  const attach = () => {
    try {
      if (win.isDestroyed() || win.webContents.isDevToolsOpened()) return;
      if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3');
      win.webContents.debugger.sendCommand('Debugger.enable').catch(() => {});
    } catch (e) { logToFile('chien de garde', e); }
  };
  attach();
  // Un seul débogueur à la fois : tant que les outils de développement sont ouverts, le chien de
  // garde s'efface. Sans ça, ouvrir les outils échouerait — ou détacherait le chien de garde sans
  // que personne ne le sache, ce qui est pire.
  win.webContents.on('devtools-opened', () => {
    try { if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach(); } catch {}
  });
  win.webContents.on('devtools-closed', attach);
  // Rechargement de la page : le débogueur reste attaché, mais le domaine se réactive par sécurité.
  win.webContents.on('did-finish-load', () => { if (!win.webContents.isDevToolsOpened()) attach(); });

  ipcMain.on('alive:pong', (e) => { if (!win.isDestroyed() && e.sender === win.webContents) { lastPong = Date.now(); reported = false; } });

  const timer = setInterval(async () => {
    if (win.isDestroyed()) return clearInterval(timer);
    try { win.webContents.send('alive:ping'); } catch { return; }
    const silence = Date.now() - lastPong;
    if (silence < WATCHDOG.dead || reported) return;
    reported = true;                       // un seul rapport par gel, sinon le journal se remplit
    logToFile('gel détecté', new Error(`L'interface n'a pas répondu depuis ${Math.round(silence / 1000)} s`));
    // Aucune de ces commandes ne doit pouvoir bloquer le chien de garde lui-même : un gel annoncé
    // par un processus qui gèle à son tour ne servirait à personne. Chacune a donc sa borne.
    const cmd = (name, args, ms) => Promise.race([
      win.webContents.debugger.sendCommand(name, args || {}).catch(() => null),
      new Promise(res => setTimeout(() => res(null), ms || 4000))
    ]);
    let stack = '';
    try {
      // Où en est le programme ? C'est la seule question qui compte, et le débogueur est le seul
      // à pouvoir y répondre pendant que le fil principal est bloqué.
      const paused = new Promise(res => {
        const onMsg = (_e, method, params) => {
          if (method !== 'Debugger.paused') return;
          win.webContents.debugger.off('message', onMsg);
          res(params);
        };
        win.webContents.debugger.on('message', onMsg);
        setTimeout(() => { win.webContents.debugger.off('message', onMsg); res(null); }, 4000);
      });
      cmd('Debugger.pause');
      const p = await paused;
      stack = ((p && p.callFrames) || []).slice(0, 12)
        .map(f => `    à ${f.functionName || '(anonyme)'} — ${(f.url || '').split('/').pop()}:${(f.location || {}).lineNumber}`)
        .join('\n');
      logToFile('gel — pile d\'appels', new Error('\n' + (stack || '(pile indisponible)')));
      // L'ORDRE compte : on relâche d'abord le débogueur, puis on interrompt l'exécution.
      // `Runtime.terminateExecution` sur une machine virtuelle en pause ne rend jamais la main.
      if (p) await cmd('Debugger.resume');
      await cmd('Runtime.terminateExecution');
    } catch (e) { logToFile('chien de garde', e); }

    // On recharge, sans rien demander. Il n'y a pas de choix à offrir : après l'interruption, la
    // page est morte de toute façon, et une fenêtre de question qu'on ne peut pas lire dans une
    // application figée ne ferait qu'ajouter au blocage. On le DIT après coup, une fois vivant.
    lastFreeze = { at: new Date().toISOString(), silence: Math.round(silence / 1000), stack };
    try { if (!win.isDestroyed()) { lastPong = Date.now(); win.webContents.reload(); } }
    catch (e) { logToFile('chien de garde', e); }
  }, WATCHDOG.every);

  // Le message d'après : la première fois que l'interface reparle après un gel, elle l'explique.
  win.webContents.on('did-finish-load', () => {
    if (!lastFreeze || lastFreeze.told) return;
    lastFreeze.told = true;
    setTimeout(() => { try { win.webContents.send('freeze:notice', lastFreeze); } catch {} }, 1200);
  });

  win.on('closed', () => clearInterval(timer));
}

// Ce qu'il faut joindre à un rapport de problème — et rien d'autre : aucune donnée d'entreprise,
// aucun nom de client, aucun montant. Seulement de quoi comprendre ce qui a planté.
ipcMain.handle('support:info', () => {
  const logPath = path.join(app.getPath('userData'), 'main.log');
  let log = '';
  try { const b = fs.readFileSync(logPath, 'utf8'); log = b.length > 40000 ? b.slice(-40000) : b; } catch {}
  return {
    version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome,
    platform: `${process.platform} ${process.arch} ${require('os').release()}`,
    packaged: app.isPackaged, logPath, log, lines: log ? log.split('\n').length - 1 : 0,
    lastFreeze: lastFreeze ? { at: lastFreeze.at, silence: lastFreeze.silence } : null
  };
});
ipcMain.handle('support:openLog', () => shell.showItemInFolder(path.join(app.getPath('userData'), 'main.log')));

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

  startWatchdog(win);

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
        // Le document tel que le client le recevra, en grand. Dans la colonne de droite il s'affiche
        // à la moitié de sa taille — on y voit une mise en page, pas un prix.
        { label: 'Voir le document en grand', accelerator: 'CmdOrCtrl+Shift+A', click: act('apercu') },
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

// ---------- licence (6.4.0) ----------
// La clé publique est embarquée dans le paquet (`build/licence-public.json`). Tant qu'elle n'existe
// pas, l'application est libre : livrer un logiciel qui se verrouille tout seul serait un défaut.
const L = require('./licence');
const LIC_FILE = () => path.join(app.getPath('userData'), 'licence.json');
let licencePublicKey = null;
function publicKey() {
  if (licencePublicKey !== null) return licencePublicKey;
  try { licencePublicKey = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'licence-public.json'), 'utf8')).publicKey || ''; }
  catch { licencePublicKey = ''; }
  return licencePublicKey;
}
function readLicence() { try { return JSON.parse(fs.readFileSync(LIC_FILE(), 'utf8')); } catch { return {}; } }
// Date de première ouverture : le point de départ de l'essai. Elle vit dans app-config.json, donc
// elle ne part pas avec une sauvegarde ni un export — un essai ne se rejoue pas en réimportant.
function installedAt() {
  const cfg = readAppCfg();
  if (!cfg.installedAt) { cfg.installedAt = L.today(); writeAppCfg(cfg); }
  return cfg.installedAt;
}
function licenceStatus() {
  const lic = readLicence();
  return L.licenceState({ key: lic.key || '', publicKey: publicKey(), installedAt: installedAt(), today: L.today() });
}

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

// Revenir en arrière depuis l'application (7.0.0). Jusqu'ici, l'app entreprise n'avait AUCUNE
// restauration : il fallait passer par « Importer », ouvrir une fenêtre de fichiers, trouver le
// dossier `backups`, et reconnaître le bon fichier à son nom. L'application du cabinet, elle, sait
// restaurer depuis la 6.8.0 — le filet existait d'un côté seulement.
//
// Deux garanties reprises du cabinet :
//   — on REGARDE d'abord (`backups:peek`) pour pouvoir dire ce qu'on va perdre avant d'écraser ;
//   — on met l'état actuel de côté avant de le remplacer. Une restauration qui ne protège pas ce
//     qu'elle remplace est un pari, pas une restauration.
ipcMain.handle('backups:peek', (_e, name) => {
  try {
    const cible = (storage.listBackups() || []).find(b => b.name === name);
    if (!cible) return { ok: false, error: 'Sauvegarde introuvable.' };
    const d = storage.readExternal(cible.path);
    return {
      ok: true, name: cible.name, mtime: cible.mtime,
      compte: { documents: (d.documents || []).length, clients: (d.clients || []).length, catalog: (d.catalog || []).length },
      societe: (d.company || {}).name || '', demo: !!d.demo
    };
  } catch (e) {
    return { ok: false, error: e && e.code === 'ENCRYPTED' ? 'Cette sauvegarde est chiffrée : ouvre d\'abord la session.' : (e.message || String(e)) };
  }
});
ipcMain.handle('backups:restore', (_e, name) => {
  try {
    const cible = (storage.listBackups() || []).find(b => b.name === name);
    if (!cible) return { ok: false, error: 'Sauvegarde introuvable.' };
    const d = storage.readExternal(cible.path);
    storage.backupNow('avant-restauration');      // ce qu'on remplace ne disparaît pas
    const r = storage.write(d, { force: true });
    if (r && r.conflict) return { ok: false, error: 'Le fichier a changé entre-temps.' };
    return { ok: true, data: d };
  } catch (e) {
    return { ok: false, error: e && e.code === 'ENCRYPTED' ? 'Cette sauvegarde est chiffrée : ouvre d\'abord la session.' : (e.message || String(e)) };
  }
});

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

const { fitToPage, canalDe } = require('./renderer/core.js');

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

// ---------- licence ----------
ipcMain.handle('licence:status', () => licenceStatus());
// On refuse d'enregistrer une clé invalide : mieux vaut le dire tout de suite que laisser
// l'utilisateur croire qu'il est en règle et découvrir le contraire au moment de facturer.
ipcMain.handle('licence:set', (_e, key) => {
  const k = String(key || '').trim();
  if (!k) { try { fs.unlinkSync(LIC_FILE()); } catch {} return licenceStatus(); }
  if (publicKey() && !L.verifyKey(k, publicKey())) {
    const err = new Error('Cette clé n\'est pas reconnue. Vérifie qu\'elle a été copiée en entier, de « SKAN1. » jusqu\'au dernier caractère.');
    err.code = 'LICENCE_INVALIDE';
    throw err;
  }
  fs.mkdirSync(path.dirname(LIC_FILE()), { recursive: true });
  fs.writeFileSync(LIC_FILE(), JSON.stringify({ key: k, savedAt: new Date().toISOString() }, null, 2));
  return licenceStatus();
});

ipcMain.handle('licence:requestMail', (_e, { company, device } = {}) => L.requestMail(company || {}, licenceStatus(), device || ''));

// Import du fichier d'appairage remis par le cabinet (6.2.0). On ne stocke QUE sa clé publique :
// elle ne permet que de chiffrer POUR lui, jamais de lire ce qu'il reçoit. Rien de secret ici.
ipcMain.handle('cabinet:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Fichier d\'appairage du cabinet',
    filters: [{ name: 'Appairage SkanFact', extensions: ['skanpair', 'json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || !filePaths[0]) return null;
  let j;
  try { j = JSON.parse(fs.readFileSync(filePaths[0], 'utf8')); }
  catch { throw new Error('Ce fichier n\'est pas lisible.'); }
  if (!j || j.kind !== 'cabinet' || !j.publicKey) throw new Error('Ce fichier n\'est pas un appairage de cabinet.');
  let fingerprint;
  try { fingerprint = keyFingerprint(j.publicKey); }
  catch { throw new Error('La clé de ce cabinet est illisible.'); }
  // L'empreinte annoncée dans le fichier doit correspondre à la clé qu'il contient : sinon quelqu'un
  // a changé l'une des deux, et c'est exactement ce qu'un imposteur ferait.
  if (j.fingerprint && j.fingerprint !== fingerprint) throw new Error('Fichier incohérent : l\'empreinte ne correspond pas à la clé.');
  return { name: String(j.name || ''), email: String(j.email || ''), publicKey: String(j.publicKey), fingerprint, pairedAt: new Date().toISOString() };
});

// ---------- le paquet mensuel pour le cabinet (6.1.0) ----------
// Le renderer décide de CE QUE contient le paquet (core.packPlan, testable sans Electron) et fournit
// le HTML des pièces à rendre. Ici on ne fait qu'exécuter : produire les octets, empreinter, zipper,
// sceller, écrire. Cette séparation permet de tester tout le contenu du paquet sans lancer Electron.
ipcMain.handle('pack:build', async (_e, { plan, coverHtml, password, cabinetKey, suggestedName } = {}) => {
  if (!plan || !Array.isArray(plan.entries)) throw new Error('Plan de paquet invalide.');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le paquet pour le cabinet',
    defaultPath: path.join(app.getPath('documents'), suggestedName || 'paquet.skanpack'),
    filters: [{ name: 'Paquet SkanFact', extensions: ['skanpack'] }]
  });
  if (canceled || !filePath) return null;

  const total = plan.entries.length + 2;                 // + la page de garde + le manifeste
  let done = 0;
  const step = (label) => { done++; send('pack:progress', { done, total, label }); };

  const win = pdfWindow();
  const files = [];                                      // { name, data } prêts pour le zip
  const missing = [];                                    // ce qu'on n'a pas pu joindre : on le DIT, on ne l'efface pas
  try {
    for (const e of plan.entries) {
      try {
        if (e.kind === 'text') {
          files.push({ name: e.path, data: Buffer.from(String(e.text == null ? '' : e.text), 'utf8') });
        } else if (e.kind === 'pdf' || e.kind === 'payslip') {
          if (!e.html) throw new Error('document non rendu');
          files.push({ name: e.path, data: await renderPdf(e.html, win) });
        } else if (e.kind === 'attachment') {
          files.push({ name: e.path, data: fs.readFileSync(storage.attachmentPath(e.ownerId, e.file)) });
        }
      } catch (err) {
        // Un justificatif effacé du disque ne doit pas faire échouer tout l'envoi : le paquet part
        // sans lui, et le manifeste comme la page de garde disent lequel manque.
        missing.push({ fichier: e.path, quoi: e.label || '', pourquoi: err && err.message || String(err) });
        logToFile('paquet', new Error(`${e.path} : ${err && err.message}`));
      }
      step(e.label || e.path);
    }

    const cover = await renderPdf(coverHtml || '<html><body></body></html>', win);
    files.unshift({ name: '00-page-de-garde.pdf', data: cover });
    step('Page de garde');

    // Le manifeste est écrit EN DERNIER : il porte l'empreinte de chaque fichier réellement produit.
    const manifest = {
      ...plan.manifest,
      genereLe: new Date().toISOString(),
      versionApp: app.getVersion(),
      absents: missing,
      fichiers: files.map(f => ({ chemin: f.name, octets: f.data.length, empreinte: sha256(f.data) }))
    };
    const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    files.unshift({ name: 'manifeste.json', data: manifestBuf });
    step('Manifeste');

    const zip = zipBuffer(files, { date: new Date() });
    // Trois niveaux, dans cet ordre de préférence : chiffré pour le cabinet appairé (rien à
    // transmettre), à défaut un mot de passe, à défaut rien du tout.
    const entete = {
      entreprise: manifest.entreprise.nom, matricule: manifest.entreprise.matricule,
      periode: manifest.periode.mois, definitif: manifest.definitif, format: manifest.format
    };
    const out = cabinetKey ? sealForCabinet(zip, cabinetKey, entete)
      : password ? sealBuffer(zip, password, entete)
        : zip;
    // Écriture atomique : un paquet à moitié écrit, envoyé par erreur, serait pire que pas de paquet.
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, out);
    fs.renameSync(tmp, filePath);
    return {
      path: filePath, octets: out.length, fichiers: files.length,
      chiffre: !!(password || cabinetKey), pourCabinet: cabinetKey ? keyFingerprint(cabinetKey) : null,
      absents: missing, empreinte: sha256(manifestBuf)
    };
  } finally {
    win.destroy();
  }
});

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
// Pourquoi le module n'a pas pu démarrer, en clair. Sans ça, l'utilisateur lit « indisponible » et
// n'a aucune piste — et moi non plus, à distance.
let updaterError = '';
let relayFailure = '';

const UPDATE_CFG = () => path.join(app.getPath('userData'), 'update-config.json');
const UPDATE_RESULT = () => path.join(app.getPath('userData'), 'update-result.json');
function readUpdateCfg() { try { return JSON.parse(fs.readFileSync(UPDATE_CFG(), 'utf8')); } catch { return {}; } }
function writeUpdateCfg(cfg) { fs.mkdirSync(path.dirname(UPDATE_CFG()), { recursive: true }); fs.writeFileSync(UPDATE_CFG(), JSON.stringify(cfg), { mode: 0o600 }); }

// Deux chemins possibles, et c'est volontaire :
//
//  - **le relais** (`updateBase`), quand il est configuré à la construction : l'application demande
//    ses mises à jour à un petit service qui détient le jeton GitHub. Elle présente le secret de
//    l'application et, si elle en a une, sa licence. Personne d'autre ne peut télécharger.
//  - **GitHub en direct**, sinon : l'utilisateur colle son propre jeton dans Paramètres. C'est le
//    fonctionnement d'origine, et il reste le filet si le relais est indisponible ou pas déployé.
// L'adresse et le secret voyagent par des champs collés à la main dans des formulaires web : une
// espace ou un retour à la ligne invisible s'y glisse facilement. Un secret avec un retour à la
// ligne fait refuser l'en-tête par Node (« Invalid character in header content »), et une adresse
// mal formée fait échouer la configuration entière — d'où le nettoyage AVANT toute utilisation.
function relayBase() { return String(PKG.updateBase || '').trim().replace(/\/+$/, ''); }
function relaySecret() { return String(PKG.updateSecret || '').trim(); }

function feedGithub(u) {
  const cfg = readUpdateCfg();
  u.setFeedURL({ provider: 'github', owner: GITHUB.owner, repo: GITHUB.repo, private: !!cfg.token, token: cfg.token || undefined });
}

// Le canal bêta (7.25.0). Deux canaux, un seul dépôt, une seule application :
//
//  - **latest** : ce que tout le monde reçoit. C'est le canal par défaut, et personne n'en sort
//    sans l'avoir demandé — la case vit dans Paramètres → Mises à jour et arrive décochée.
//  - **beta** : les versions d'essai, numérotées `7.26.0-beta.1`. electron-builder leur fabrique
//    `beta.yml` / `beta-mac.yml` ; une installation stable ne les regarde même pas.
//
// `allowPrerelease` est indispensable côté GitHub : sans lui, le module utilise `/releases/latest`,
// qui IGNORE les préversions par construction — la bêta serait publiée et jamais proposée.
//
// Et le retour en arrière, qui est le vrai piège. `u.channel = …` remet `allowDowngrade` à `true`
// en effet de bord (règle 6.7.3 : c'est écrit dans la source du module, pas dans son README), donc
// on le repositionne APRÈS, toujours. Une seule exception, et elle est voulue : quelqu'un qui
// DÉCOCHE la case tourne sur une version plus récente que la dernière stable ; lui interdire de
// reculer, c'est l'enfermer dans la bêta qu'il vient justement de quitter.
function appliquerCanal(u) {
  const beta = !!readUpdateCfg().beta;
  u.channel = beta ? 'beta' : 'latest';
  u.allowPrerelease = beta;
  u.allowDowngrade = !beta && canalDe(app.getVersion()) !== 'latest';
}

function configureFeed(u) {
  const base = relayBase();
  if (!base) { feedGithub(u); return appliquerCanal(u); }
  try {
    // Une adresse invalide (chemin collé en trop, espace, texte au lieu d'une URL) doit être vue
    // ICI, pas au premier téléchargement : `new URL` est le seul contrôle qui la rejette vraiment.
    const url = new URL(`${base}/app`).toString();
    const lic = readLicence();
    const h = { 'X-SkanFact-App': relaySecret() };
    if (lic.key) h['X-SkanFact-Licence'] = String(lic.key).trim();
    u.requestHeaders = h;
    u.setFeedURL({ provider: 'generic', url, channel: 'latest' });
  } catch (e) {
    // Le relais est mal réglé. On ne laisse JAMAIS l'application sans mise à jour possible pour
    // autant : on retombe sur GitHub + jeton, et on le dit au lieu de le cacher.
    relayFailure = `Relais injoignable (${String(e && e.message || e).slice(0, 120)}). Retour au téléchargement direct depuis GitHub.`;
    logToFile('relais de mise à jour', e);
    feedGithub(u);
  }
  // Le canal se pose APRÈS le flux, dans les deux chemins : `setFeedURL` ne le change pas, mais
  // `u.channel` doit être le dernier mot (il prime sur le `channel` passé à setFeedURL).
  appliquerCanal(u);
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
    // Jamais de retour en arrière : proposer une version plus ancienne que celle installée, c'est
    // proposer de réinstaller un défaut déjà corrigé. (Voir src/cabinet/main.js : là-bas, affecter
    // `channel` remet ce réglage à true, il faut donc le repositionner après.)
    autoUpdater.allowDowngrade = false;
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
    // Une erreur avalée en silence laisse l'utilisateur devant « indisponible » sans aucune piste,
    // et personne ne peut l'aider à distance. On garde la cause et on l'écrit dans le journal.
    updaterError = String(e && e.message || e).split('\n')[0].slice(0, 200);
    logToFile('module de mise à jour', e);
    updater = null;
  }
  return updater;
}

// Le message montré quand le module n'a pas démarré : il nomme la cause au lieu de constater l'échec.
function updaterUnavailable() {
  return { state: 'error', message: 'Module de mise à jour indisponible' + (updaterError ? ' : ' + updaterError : '.') };
}

function updatesConfigured() { return !!(GITHUB.owner && GITHUB.repo); }

function friendlyError(err) {
  const m = String(err && err.message || err);
  // Une bêta qui n'existe pas encore n'est pas une panne : c'est le cas normal entre deux essais.
  // Sans cette phrase, l'écran répondait « Aucune version trouvée » en rouge et faisait croire que
  // les mises à jour étaient cassées.
  if (/404|CHANNEL_FILE_NOT_FOUND/.test(m) && readUpdateCfg().beta) return 'Aucune version bêta publiée pour l\'instant. Tu as la dernière version stable ; décoche la case pour revenir au canal normal.';
  if (/403/.test(m) && relayBase()) return 'Le service de mise à jour a refusé cette installation. Vérifie ta licence dans Paramètres → Licence.';
  if (/402/.test(m)) return 'Une licence en cours de validité est nécessaire pour recevoir les mises à jour.';
  if (/404/.test(m)) return relayBase()
    ? 'Aucune version trouvée. Réessaie plus tard, ou télécharge la nouvelle version à la main.'
    : 'Aucune version trouvée sur GitHub : token manquant ou sans accès au dépôt (Paramètres → Mises à jour).';
  if (/401|403|Bad credentials/i.test(m)) return 'Token GitHub refusé ou expiré. Génère-en un nouveau et colle-le ci-dessous.';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|net::/i.test(m)) return 'Impossible de joindre GitHub. Vérifie ta connexion internet.';
  if (/sha512|checksum/i.test(m)) return 'Le fichier téléchargé est corrompu. Réessaie.';
  return m.split('\n')[0].slice(0, 200);
}

async function checkForUpdates(isSilent) {
  silent = !!isSilent;
  if (!app.isPackaged) return { state: 'dev' };
  if (!updatesConfigured()) return { state: 'unconfigured' };
  // Sans token, un dépôt privé répond toujours 404 : inutile d'interroger GitHub, on explique quoi
  // faire. Avec le relais, il n'y a rien à saisir : c'est lui qui détient l'accès.
  if (!relayBase() && GITHUB.private && !readUpdateCfg().token) return { state: 'token' };
  const u = getUpdater();
  if (!u) return updaterUnavailable();
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
  hasToken: !!readUpdateCfg().token,
  // Un relais qui a échoué n'est PAS un relais : le champ jeton doit revenir, sinon l'utilisateur
  // n'a plus aucun moyen de se mettre à jour et l'écran lui dit qu'il n'a rien à faire.
  relay: !!relayBase() && !relayFailure,
  // Un relais en panne n'est un PROBLÈME que si l'on ne peut pas s'en passer. Sur un dépôt privé,
  // c'était le cas : sans lui, plus de mise à jour, d'où le message en rouge et le retour du champ
  // jeton (règle 6.7.2). Sur un dépôt PUBLIC, le repli GitHub suffit tout seul : afficher
  // « Relais injoignable » en rouge alarme pour une panne qui n'empêche rien. On le garde dans le
  // journal (logToFile le fait déjà) et on ne le montre plus.
  relayFailure: GITHUB.private ? relayFailure : '',
  // Le canal choisi, et ce que la version installée EST réellement. Les deux, parce qu'ils peuvent
  // se contredire une journée entière : on décoche la case un matin en tournant sur une bêta, et on
  // reste dessus jusqu'à ce que la stable suivante arrive. L'écran doit pouvoir le dire.
  beta: !!readUpdateCfg().beta,
  prerelease: canalDe(app.getVersion()) !== 'latest',
  lastUpdate: takeLastUpdateResult()
}));

// Entrer dans le canal bêta ou en sortir. On reconfigure le flux tout de suite : sans ça, le
// changement ne prendrait effet qu'au prochain démarrage, et « Vérifier les mises à jour » juste
// après aurait répondu sur l'ancien canal — c'est-à-dire le contraire de ce qu'on vient de demander.
ipcMain.handle('update:setBeta', (_e, on) => {
  const cfg = readUpdateCfg();
  if (on) cfg.beta = true; else delete cfg.beta;
  writeUpdateCfg(cfg);
  // Un canal déjà téléchargé n'a plus rien à voir avec celui qu'on vient de choisir.
  updateInfo = null; downloaded = false; downloadedFile = null;
  if (updater) configureFeed(updater);
  return { beta: !!cfg.beta };
});

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
  if (!u) return updaterUnavailable();
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
