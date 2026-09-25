// SkanFact Cabinet — processus principal.
//
// Une seconde application, dans le même dépôt, qui partage tout ce qui peut l'être : core.js pour
// les calculs, zip.js pour les paquets, style.css pour l'apparence. Ce qui change, c'est le métier :
// ici on REÇOIT et on LIT. Aucune donnée de client n'est jamais modifiée ni renvoyée.
//
// Depuis la 2.0.0, le stockage et les filets vivent dans cabstore.js (sauvegardes, copie externe,
// clé de secours, rangement des paquets) : ce fichier ne fait plus que l'orchestration et l'IPC.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
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

// Écrire dans le journal, sans rien montrer. Le chien de garde s'en sert : devant une application
// figée, une fenêtre d'erreur ne sert à personne, et `logError` en ouvre une.
// Le journal technique, BORNÉ depuis la 9.1.0 (SPEC-OUT-004) — même règle et même code que dans
// l'application entreprise : UNE rotation à 2 Mo, deux fichiers au maximum. Une règle apprise d'un
// côté se pose de l'autre (règle 7.3.0), et celle-ci compte double ici : le processus principal du
// cabinet travaille longtemps (vingt paquets à importer), donc il écrit davantage.
const LOG_MAX = 2 * 1024 * 1024;
function logPath() { return path.join(app.getPath('userData'), 'main.log'); }
function logToFile(where, err) {
  try {
    const f = logPath();
    try { if (fs.statSync(f).size > LOG_MAX) fs.renameSync(f, f + '.1'); } catch {}
    fs.appendFileSync(f, `${new Date().toISOString()} [${where}] ${err && err.stack || err}\n`);
  } catch {}
}

function logError(where, err) {
  logToFile(where, err);
  try { dialog.showErrorBox('SkanFact Cabinet — erreur', `${where}\n\n${err && err.message || err}`); } catch {}
}

// 9.4.10 — Chaque refus porte son CODE (Partie 10 du cahier des charges). La phrase en français ne
// bouge pas : c'est elle qu'on lit. Le code, lui, se cite — dans un signalement, au téléphone, dans
// le cahier — alors que « il m'a dit que le paquet est illisible » ne désigne aucune ligne du code.
// Il voyage DANS le message parce qu'une propriété posée sur une Error ne traverse pas le pont IPC
// (Electron sérialise l'erreur en une chaîne) ; l'écran le détache avant d'afficher la phrase.
const erreur = (code, message) => Object.assign(new Error(`${message} [${code}]`), { code, refus: true });

// 10.0.1 — La panne SYSTÈME est la seule famille de refus que la règle de la 7.26.0 n'avait jamais
// couverte, et c'est celle où l'utilisateur perd son travail. Ici elle coûte plus cher qu'ailleurs :
// un livre qui ne s'écrit pas, c'est une journée de saisie. La table est identique au caractère
// près dans `src/main.js` — un test compare les deux corps, comme pour `round3` (9.1.0) — d'où la
// phrase NEUTRE (« l'application ») : les deux applications écrivent sur le même disque et doivent
// en dire la même chose.
const PANNES_DISQUE = {
  ENOSPC: 'Le disque est plein : rien n\'a été enregistré. Libère de la place, puis réessaie — ton travail est encore à l\'écran.',
  EDQUOT: 'Le quota de ce disque est atteint : rien n\'a été enregistré. Libère de la place, puis réessaie — ton travail est encore à l\'écran.',
  EACCES: 'L\'accès au fichier de données est refusé : rien n\'a été enregistré. Un antivirus ou un autre programme le tient peut-être ouvert — ferme-le, puis réessaie.',
  EPERM: 'L\'accès au fichier de données est refusé : rien n\'a été enregistré. Un antivirus ou un autre programme le tient peut-être ouvert — ferme-le, puis réessaie.',
  EROFS: 'Le dossier de données est en lecture seule : rien n\'a été enregistré. Choisis un autre emplacement dans les réglages, puis réessaie.',
  EBUSY: 'Le fichier de données est utilisé par un autre programme : rien n\'a été enregistré. Ferme-le, puis réessaie.',
  ENOENT: 'Le dossier de données est introuvable : rien n\'a été enregistré. Un disque externe ou un dossier synchronisé (iCloud Drive, OneDrive) s\'est peut-être déconnecté — rebranche-le, puis réessaie.',
  EIO: 'Le disque ne répond plus : rien n\'a été enregistré. Fais une copie de tes données dès qu\'il répond de nouveau.',
  EMFILE: 'Trop de fichiers sont ouverts sur cet ordinateur : rien n\'a été enregistré. Redémarre l\'application, puis réessaie.',
  ENFILE: 'Trop de fichiers sont ouverts sur cet ordinateur : rien n\'a été enregistré. Redémarre l\'application, puis réessaie.'
};
// `e.code` d'abord — mais une erreur qui a déjà traversé une frontière l'a perdu (9.4.10), et il ne
// reste alors que le préfixe du message. On lit les deux plutôt que de rater la moitié des cas.
function panneDisque(e) {
  const direct = e && e.code;
  const dansLeTexte = (String((e && e.message) || '').match(/^([A-Z]{3,6}):/) || [])[1];
  return PANNES_DISQUE[direct] || PANNES_DISQUE[dansLeTexte] || '';
}

// Et un refus laisse une trace, toujours. On enveloppe `ipcMain.handle` UNE fois plutôt qu'à chaque
// enregistrement : quatre-vingts points d'appel, c'est quatre-vingts occasions d'en oublier un — et
// la forme `ipcMain.handle(` reste celle que les tranches de source des tests reconnaissent.
const handleBrut = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (canal, fn) => handleBrut(canal, async (...a) => {
  try { return await fn(...a); }
  // Un refus qu'on a ÉCRIT (`erreur(…)`) est une RÉPONSE, pas une panne : l'inscrire noierait le
  // journal sous les mots de passe mal tapés, et un journal qu'on ne lit plus ne dépanne personne
  // (même règle que le rouge sur une situation normale, 8.0.1). Ce qui manquait est l'autre moitié :
  // une exception qu'aucune phrase n'attendait n'écrivait RIEN nulle part — elle repartait vers
  // l'écran habillée en « Error invoking remote method », et le journal restait muet.
  //
  // Une panne système, elle, va au journal ET reçoit sa phrase : c'est une panne (donc on l'écrit)
  // dont on connaît la cause (donc on la nomme). La traduire ICI plutôt qu'à l'écran, c'est la
  // règle de la 9.4.10 : on enveloppe une fois, pas quatre-vingts.
  catch (e) {
    if (!(e && e.refus)) logToFile('panne ' + canal, e);
    const phrase = (e && e.refus) ? '' : panneDisque(e);
    throw phrase ? erreur('ERR-CAB-076', phrase) : e;
  }
});

function getStore() {
  if (!store) {
    store = CS.createCabStore(app.getPath('userData'), {
      // Par `logToFile`, et pas en écrivant directement : sinon la sauvegarde contourne la
      // rotation, et c'est elle qui écrit le plus.
      log: logToFile,
      externalDir: readAppCfg().externalBackupDir || null
    });
  }
  return store;
}

function requireOpen() {
  if (!state || !getStore().unlocked()) throw erreur('ERR-CAB-009', 'Aucun cabinet ouvert.');
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
    // L'empreinte de SIGNATURE (10.13.0) : c'est celle que le client voit à sa première clôture ou à
    // ses premières questions, et celle qu'il te lira au téléphone si elle change.
    const sig = cleSignatureCabinet();
    s.cabinet.signatureFingerprint = sig ? Z.keyFingerprint(sig.publicKey) : '';
  }
  // QUI travaille sur ce poste (9.9.0). L'identité vit dans `app-config.json`, pas dans l'état :
  // elle est AJOUTÉE ici pour l'écran, exactement comme l'empreinte du cabinet — et pour la même
  // raison qu'elle a failli désarmer le contrôle de licence en 9.4.0, un test l'exige, parce qu'un
  // champ absent de `safeState` vaut `undefined` côté renderer et désarme tout ce qui s'y fie.
  s.moi = moiId();
  s.moiNom = quiSuisJe();
  // 10.10.0 (C-08) — le modèle de liasse du cabinet, relu À LA LECTURE comme un livre ancien
  // (9.8.5) : une copie des rubriques de la 10.0.0 enregistrée telle quelle retrouve les comptes
  // qu'elles laissaient dehors, sans que rien soit réécrit sur le disque avant un geste du cabinet.
  s.liasse = KC.migrerModeleLiasse(s.liasse);
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

// ---------- chien de garde (porté de l'app entreprise, 6.5.0) ----------
//
// L'app cabinet n'en avait pas. Un gel de son interface ne laisse AUCUNE trace : rien ne plante,
// aucune erreur, le journal reste vide — et le comptable n'a rien à envoyer à personne. C'est le
// même chien de garde qu'en 6.5.0, avec les mêmes règles, plus une qui n'existe qu'ici (voir
// `retard` plus bas) : dans cette application, c'est le processus PRINCIPAL qui travaille
// longtemps, et son silence à lui ne doit pas être mis sur le dos de l'interface.
//
// Le point à ne pas rater : le domaine Debugger doit être activé **avant** le gel. `Debugger.enable`
// attend le fil principal ; demandé pendant le gel, il attendrait pour toujours.
const WATCHDOG = { every: 3000, dead: 12000, enabled: true, reveil: 8000 };
// Le dernier gel constaté, pour le dire à l'utilisateur une fois l'interface revenue et pour le
// joindre à un rapport de problème.
let lastFreeze = null;
function startWatchdog(win) {
  if (!WATCHDOG.enabled || !win || win.isDestroyed()) return;
  let lastPong = Date.now();
  // Un ordinateur qui dort n'est pas une application qui gèle (8.1.0). Le saut d'horloge ci-dessous
  // l'attrapait déjà par ricochet — il avait été écrit pour le processus principal occupé — mais il
  // ne laisse pas de délai à l'interface pour reparler au réveil. `powerMonitor` donne le signal
  // franc ; les deux se complètent, et le saut d'horloge reste le filet quand l'événement n'arrive
  // pas (hibernation, machine virtuelle, capot refermé).
  let reveilAvant = 0;
  let dort = false;
  let reported = false;

  const attach = () => {
    try {
      if (win.isDestroyed() || win.webContents.isDevToolsOpened()) return;
      if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3');
      win.webContents.debugger.sendCommand('Debugger.enable').catch(() => {});
    } catch (e) { logToFile('chien de garde', e); }
  };
  attach();
  // Un seul programme peut inspecter la page à la fois : tant que les outils de développement sont
  // ouverts, le chien de garde s'efface, puis revient. Sans ça, ouvrir les outils le débranchait en
  // silence — et on se croyait surveillé sans l'être.
  win.webContents.on('devtools-opened', () => {
    try { if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach(); } catch {}
  });
  win.webContents.on('devtools-closed', attach);
  // Rechargement de la page : le débogueur reste attaché, mais le domaine se réactive par sécurité.
  win.webContents.on('did-finish-load', () => { if (!win.webContents.isDevToolsOpened()) attach(); });

  ipcMain.on('alive:pong', (e) => { if (!win.isDestroyed() && e.sender === win.webContents) { lastPong = Date.now(); reported = false; } });

  let lastTick = Date.now();
  try {
    powerMonitor.on('suspend', () => { dort = true; });
    powerMonitor.on('resume', () => { dort = false; lastPong = Date.now(); lastTick = Date.now(); reveilAvant = Date.now() + WATCHDOG.reveil; reported = false; });
  } catch (e) { logToFile('chien de garde', e); }

  const timer = setInterval(async () => {
    if (win.isDestroyed()) return clearInterval(timer);
    const maintenant = Date.now();
    const retard = maintenant - lastTick;      // le temps RÉELLEMENT écoulé depuis le battement d'avant
    lastTick = maintenant;
    // La règle propre au cabinet : ici, le processus principal travaille longtemps (ranger vingt
    // paquets, en extraire un, relire soixante paquets pour un export d'écritures). Pendant ce
    // temps aucun battement ne part, et le silence qu'on mesure est le sien, pas celui de
    // l'interface. On repart de zéro plutôt que d'accuser un innocent — et de recharger une page
    // qui n'avait rien fait, sous les doigts du comptable.
    if (retard > WATCHDOG.every * 2) {
      lastPong = maintenant; reveilAvant = maintenant + WATCHDOG.reveil;
      if (retard > WATCHDOG.every * 4) logToFile('chien de garde', new Error(`silence ignoré — l'ordinateur s'est arrêté ${Math.round(retard / 1000)} s`));
    }
    try { win.webContents.send('alive:ping'); } catch { return; }
    if (dort || maintenant < reveilAvant) return;
    const silence = maintenant - lastPong;
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

    // On recharge, sans rien demander. Une fenêtre de question qu'on ne peut pas lire dans une
    // application figée ne ferait qu'ajouter au blocage. On le DIT après coup, une fois vivant.
    lastFreeze = { at: new Date().toISOString(), silence: Math.round(silence / 1000), stack };
    try { if (!win.isDestroyed()) { lastPong = Date.now(); lastTick = Date.now(); win.webContents.reload(); } }
    catch (e) { logToFile('chien de garde', e); }
  }, WATCHDOG.every);

  // Le message d'après : la première fois que l'interface reparle après un gel, elle l'explique.
  // Ici c'est indispensable — le cabinet se rouvre sur son écran de verrouillage, et sans un mot le
  // comptable ne comprend pas pourquoi on lui redemande son mot de passe.
  win.webContents.on('did-finish-load', () => {
    if (!lastFreeze || lastFreeze.told) return;
    lastFreeze.told = true;
    setTimeout(() => { try { win.webContents.send('freeze:notice', lastFreeze); } catch {} }, 1200);
  });

  win.on('closed', () => clearInterval(timer));
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
  // Si l'interface cesse de répondre, il nomme la fonction coupable dans le journal, interrompt la
  // boucle et recharge la page — puis le dit. Sans lui, un gel du cabinet ne laissait rien du tout.
  startWatchdog(mainWindow);
  // 10.12.0 (U-09) — une pièce commencée dans la grille de saisie vit en mémoire : fermer la fenêtre
  // l'effaçait sans une question. C'est le garde-fou de l'app entreprise (2.4.0), porté au Cabinet :
  // l'interface nomme les dossiers dont une pièce n'est pas enregistrée, la fermeture demande.
  mainWindow.on('close', (e) => {
    if (saisiesEnCours.length && !fermerQuandMeme) {
      e.preventDefault();
      const r = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning', buttons: ['Annuler', 'Fermer sans enregistrer'], defaultId: 0, cancelId: 0,
        title: 'Une pièce n\'est pas enregistrée',
        message: saisiesEnCours.length > 1
          ? `Des pièces commencées ne sont pas enregistrées : ${saisiesEnCours.join(', ')}.`
          : `Une pièce commencée pour ${saisiesEnCours[0]} n'est pas enregistrée.`,
        detail: 'Si tu fermes maintenant, elle est perdue. Enregistre-la en brouillard : elle ne prend aucun numéro, et tu la reprendras quand tu voudras.'
      });
      if (r !== 1) return;
      fermerQuandMeme = true;
      mainWindow.close();
      return;
    }
    rememberBounds();
  });
  mainWindow.on('closed', () => { mainWindow = null; saisiesEnCours = []; fermerQuandMeme = false; });
  // Une interface rechargée (le menu, ou le chien de garde après un gel) repart sans pièce en
  // mémoire : la liste de la précédente ne vaut plus rien, et garder la question ferait demander
  // pour une pièce qui n'existe plus. La nouvelle interface redira ce qu'elle a.
  mainWindow.webContents.on('did-navigate', () => { saisiesEnCours = []; });
}

// Ce que l'interface déclare, à chaque pièce commencée ou enregistrée : les NOMS des dossiers, rien
// d'autre — la pièce elle-même ne traverse pas le pont, elle n'a rien à faire ici.
let saisiesEnCours = [];
let fermerQuandMeme = false;
ipcMain.on('cab:saisieEnCours', (_e, noms) => {
  saisiesEnCours = Array.isArray(noms) ? noms.map(n => String(n || '').slice(0, 120)).filter(Boolean).slice(0, 20) : [];
});

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
      // 10.12.0 (U-06) — l'onglet d'une fiche et l'écran de sa comptabilité vivent dans l'adresse
      // depuis la 9.2.2 et la 10.12.0 ; sans « Précédent », rien ne s'en servait. Le jumeau de
      // l'app entreprise (2.4.0), jamais porté (7.3.0).
      { type: 'separator' },
      { label: 'Précédent', accelerator: 'CmdOrCtrl+[', click: act('back') },
      { label: 'Suivant', accelerator: 'CmdOrCtrl+]', click: act('forward') },
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
    // C'est aussi, jusqu'ici, le chemin qu'empruntait sans le savoir un comptable qui changeait
    // d'ordinateur : une clé NEUVE, une nouvelle empreinte, et tous les paquets suivants refusés chez
    // lui (« adressé à un autre cabinet »). D'où `cab:adopt` juste en dessous, et le bouton « J'ai
    // déjà un cabinet sur un autre ordinateur » de l'écran de mot de passe : on reprend AVANT de créer.
    const keys = Z.generateCabinetKeys();
    state = s.create(password, K.migrate({ cabinet: { name: '', email: '', phone: '', publicKey: keys.publicKey, privateKey: keys.privateKey } }));
    demarrerPlateforme();
    return { created: true, state: safeState() };
  }
  const r = s.unlock(password);
  if (r.missing) {
    // Le fichier existait et n'était pas lisible : cabstore l'a mis de côté SANS l'écraser.
    const e = erreur('ERR-CAB-016', 'Le fichier du cabinet est illisible. Il a été mis de côté, rien n\'a été effacé : restaure une sauvegarde depuis l\'écran suivant.');
    e.corrupt = s.state.corruptFile || '';
    throw e;
  }
  if (!r.ok) throw erreur('ERR-CAB-012', r.error);
  state = K.migrate(r.state);
  // Reprise du rangement à plat des versions précédentes : les paquets passent en
  // paquets/<client>/<année>/<mois>.skanpack. Silencieux, une seule fois.
  // Un chemin recollé (paquet repris d'un autre poste) compte autant qu'un fichier déplacé : sans
  // l'enregistrer, le rattrapage serait à refaire à chaque ouverture.
  const moved = s.reorganize(state);
  // L'exemple se refait AVANT la première écriture : une seule écriture pour les deux rattrapages.
  const exemple = rafraichirExemple();
  if (moved.moved || moved.recovered || exemple) s.write(state);
  // L'annonce au plan de contrôle part APRÈS l'ouverture : avant, il n'y a pas de clé de licence à
  // présenter, et le poste s'annoncerait comme un essai alors qu'il est peut-être sous licence.
  demarrerPlateforme();
  return { created: false, state: safeState(), reorganized: moved, exemple };
});

// ---------- IPC : reprendre un cabinet venu d'un autre ordinateur ----------
//
// Les deux seuls handlers, avec `cab:status` et `cab:unlock`, qui travaillent cabinet fermé — et
// c'est tout l'intérêt : ils passent AVANT la création d'une paire de clés.
ipcMain.handle('cab:pickRecover', async (_e, mode) => {
  // Un seul dialogue pour les deux ne marcherait que sur macOS : Windows ne sait pas proposer un
  // fichier OU un dossier dans la même fenêtre. C'est l'interface qui pose la question.
  const r = await dialog.showOpenDialog(mainWindow, mode === 'fichier'
    ? { title: 'Le fichier de ton cabinet, ou une de ses sauvegardes', filters: [{ name: 'Cabinet SkanFact', extensions: ['json'] }], properties: ['openFile'] }
    : { title: 'Le dossier de ta copie de sauvegarde', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return null;
  // On annonce ce qu'on a trouvé avant de demander le mot de passe : on ne le fait pas taper pour
  // apprendre ensuite que ce n'était pas le bon dossier.
  const vu = getStore().inspectSource(r.filePaths[0]);
  return { path: r.filePaths[0], kind: vu.kind, base: !!vu.base, backups: vu.backups.length, packs: vu.packs, bytes: vu.bytes };
});

ipcMain.handle('cab:adopt', (_e, { path: p, password } = {}) => {
  const s = getStore();
  // adoptSource valide tout — enveloppe, mot de passe, structure — avant de toucher au disque : la
  // règle de ce fichier vaut ici plus qu'ailleurs, puisqu'il n'y a encore rien à quoi revenir.
  const r = s.adoptSource(String(p || ''), String(password || ''));
  state = K.migrate(r.state);
  // Les chemins enregistrés désignent l'autre poste. Le rangement les recolle sur les fichiers qu'on
  // vient de reprendre, sans quoi des paquets bien présents passeraient pour perdus.
  const moved = s.reorganize(state);
  s.write(state);
  demarrerPlateforme();
  return {
    state: safeState(), reorganized: moved,
    repris: { dossiers: state.dossiers.length, sauvegardes: r.backups, paquets: r.packs }
  };
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
  // L'identité ne se remplace que si elle est FOURNIE. Avant la 10.0.0, `String(p.name || '')`
  // écrasait le nom du cabinet par une chaîne vide dès qu'un écran n'envoyait que des réglages —
  // et un cabinet sans nom rouvre l'assistant de bienvenue au démarrage suivant. Tous les appelants
  // pensaient à recopier `...S.cabinet` ; le premier qui oublierait effacerait l'identité du
  // cabinet sans un mot. Le piège vivait dans le handler, il se répare dans le handler.
  ['name', 'email', 'phone'].forEach(k => {
    if (p[k] !== undefined) state.cabinet = { ...state.cabinet, [k]: String(p[k] || '') };
  });
  if (p.settings) {
    const day = Number(p.settings.relanceDay);
    state.settings = { ...state.settings, relanceDay: day >= 1 && day <= 28 ? Math.round(day) : state.settings.relanceDay };
    if (p.settings.deadlines) state.settings.deadlines = { ...state.settings.deadlines, ...p.settings.deadlines };
    // Les régimes et ce que chacun dépose (F-9.6.0-12). REMPLACÉS et non fusionnés : retirer un
    // régime est un geste, et fusionner le ferait revenir. La normalisation vit dans `migrateRegime`
    // — une seule porte, donc un fichier relu et un fichier écrit disent la même chose.
    if (Array.isArray(p.settings.regimes)) {
      state.settings.regimes = p.settings.regimes.map(K.migrateRegime).filter(r => r.id && r.label);
    }
    // Les réglages de saisie (9.3.0). On fusionne au lieu de remplacer : un écran qui n'envoie que
    // les touches ne doit pas effacer le journal par défaut réglé dans un autre panneau.
    if (p.settings.saisie) {
      const avant = state.settings.saisie || {};
      state.settings.saisie = {
        ...avant, ...p.settings.saisie,
        touches: { ...(avant.touches || {}), ...(p.settings.saisie.touches || {}) }
      };
    }
    // Le thème (9.4.3). Fusionné comme le reste : un écran qui n'envoie que le thème ne doit pas
    // effacer le jour de relance, et réciproquement.
    if (p.settings.theme) state.settings = { ...state.settings, theme: String(p.settings.theme) };
    // Les échéances pointées (9.4.6). REMPLACÉES et non fusionnées : dépointer est un geste, et une
    // fusion rendrait le « Annuler » impossible — on ne pourrait qu'ajouter. `migrate` filtre
    // ensuite les clés qui n'ont pas la forme attendue.
    if (Array.isArray(p.settings.depots)) state.settings = { ...state.settings, depots: p.settings.depots };
    // migrate() rejette les valeurs aberrantes et remet l'usage : un réglage à zéro ferait
    // disparaître l'échéance du calendrier au lieu de la décaler.
    state.settings = K.migrate(state).settings;
  }
  return save();
});

const DOSSIER_TEXT = ['name', 'email', 'phone', 'contact', 'note', 'regime', 'tvaPeriod', 'from'];

ipcMain.handle('cab:saveDossier', (_e, { id, patch } = {}) => {
  requireOpen();
  const d = state.dossiers.find(x => x.id === id);
  if (!d) throw erreur('ERR-CAB-009', 'Dossier introuvable.');
  // On calcule d'abord, on valide ensuite, on écrit en dernier. L'ancienne version modifiait l'objet
  // vivant PUIS refusait : le comptable lisait « un autre dossier porte déjà ce matricule », fermait
  // la fenêtre rassuré, et l'enregistrement suivant — une relance notée vingt minutes plus tard —
  // écrivait tout sur le disque. Règle de ce fichier : un handler ne touche à `state` qu'après
  // avoir passé toutes ses validations.
  const futur = { ...d };
  DOSSIER_TEXT.forEach(k => { if (patch && patch[k] != null) futur[k] = String(patch[k]); });
  if (patch && patch.fees != null) futur.fees = Number(patch.fees) || 0;
  if (patch && patch.archived != null) futur.archived = !!patch.archived;
  if (futur.from && !/^\d{4}-\d{2}$/.test(futur.from)) futur.from = '';
  // Le matricule ne se modifie QUE tant qu'aucun paquet n'est arrivé. Après, c'est le client qui
  // fait foi : il vient de ses envois, et le changer ici détacherait le dossier de ses propres
  // paquets. (L'interface met déjà le champ en lecture seule ; on ne s'y fie pas.)
  if (patch && patch.matricule != null && !(d.packs || []).length) futur.matricule = String(patch.matricule);
  // L'identifiant d'un dossier vient du matricule (ou du nom à défaut) : c'est ce qui fait qu'un
  // paquet tombe dans le bon dossier. Tant qu'AUCUN paquet n'est arrivé, corriger le matricule doit
  // donc corriger l'identifiant — sinon le premier envoi du client créerait un second dossier à
  // côté du premier, et personne ne comprendrait pourquoi.
  if (!(d.packs || []).length) {
    const neuf = K.dossierKey({ entreprise: { matricule: futur.matricule, nom: futur.name } });
    if (neuf && neuf !== d.id) {
      if (state.dossiers.some(x => x !== d && x.id === neuf)) {
        throw erreur('ERR-CAB-008', 'Un autre dossier porte déjà ce matricule (ou ce nom).');
      }
      futur.id = neuf;
    }
  }
  Object.assign(d, futur);                       // tout est validé : on écrit maintenant
  // Le nom sert au rangement des paquets sur le disque : s'il change, les fichiers suivent.
  const moved = getStore().reorganize(state);
  save();
  return { state: safeState(), moved: moved.moved, id: d.id };
});

// Créer un dossier à la main. C'est ce qui transforme l'application en tableau de bord du
// portefeuille au lieu d'une liste des deux clients déjà passés à SkanFact.
ipcMain.handle('cab:newDossier', (_e, fields) => {
  requireOpen();
  const f = fields || {};
  if (!String(f.name || '').trim()) throw erreur('ERR-CAB-009', 'Donne au moins un nom à ce client.');
  const d = K.newDossier({ ...f, name: String(f.name).trim(), createdAt: Date.now() });
  if (!d.id || d.id === 'NOM:') throw erreur('ERR-CAB-009', 'Nom de client inutilisable.');
  if (state.dossiers.some(x => x.id === d.id)) throw erreur('ERR-CAB-008', 'Un dossier existe déjà pour ce client (même matricule ou même nom).');
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
  droitBlock(id, 'supervision');
  const i = state.dossiers.findIndex(x => x.id === id);
  if (i < 0) throw erreur('ERR-CAB-009', 'Dossier introuvable.');
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
  if (!d) throw erreur('ERR-CAB-009', 'Dossier introuvable.');
  const p = (d.packs || []).find(x => x.month === month);
  if (!p) throw erreur('ERR-CAB-009', 'Paquet introuvable.');
  getStore().backupNow('avant-suppression-paquet');
  if (p.path) getStore().removePack(p.path);
  d.packs = d.packs.filter(x => x.month !== month);
  viderCacheLivres(id);        // le mois supprimé ne doit plus apparaître dans les livres
  return save();
});

ipcMain.handle('cab:noteRelance', (_e, { id, months, via, note } = {}) => {
  requireOpen();
  const d = state.dossiers.find(x => x.id === id);
  if (!d) throw erreur('ERR-CAB-009', 'Dossier introuvable.');
  K.noteRelance(d, months, via, Date.now(), note);
  return save();
});

// Un jeu d'exemple, pour qu'un comptable qui découvre l'application voie à quoi elle ressemble
// pleine. Il disparaît au premier vrai paquet importé (voir `cab:importPack`) : on ne mélange jamais
// des dossiers fictifs avec les comptabilités réelles de ses clients.
// ---------- l'exemple : de VRAIS paquets (9.2.2) ----------
//
// Jusqu'ici l'exemple posait cinq dossiers avec des chiffres inventés et AUCUN fichier : la page
// d'un dossier affichait « aucun paquet ne contient d'écritures » — sur l'écran qui doit justement
// montrer un exercice ouvert. Skander, devant son vrai dossier : « ton jeu d'exemple ne montre pas
// le vrai écran ». Et rien de ce que l'exemple montrait n'avait traversé la vraie porte.
//
// Le Cabinet n'embarque pas le moteur de l'app entreprise (exprès). Les journaux de huit mois du jeu
// de démonstration sont donc PRÉ-CALCULÉS par `scripts/exemple-cabinet.js` et livrés en JSON ;
// ici on en fait de vrais `.skanpack` — recalés sur le mois courant, manifeste avec empreintes,
// scellés pour la clé de CE cabinet — et on les passe par `ingest()`, exactement comme un paquet
// reçu par mail. `demoDossiers()` ne porte plus que le SCÉNARIO (qui, quels mois, définitif ou
// provisoire, ce qui manque) ; les chiffres viennent des écritures.
const GABARITS_EXEMPLE = require('./exemple-paquets.json');
const VITRINE = require('./exemple-vitrine');
const moisEntre =(a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (ya - yb) * 12 + (ma - mb); };

// 10.12.0 (U-10) — les deux vitrines de l'exemple. Banque, Immobilisations, Paie et Révision
// étaient vides : l'exemple ne montrait que ce qu'un tableur fait déjà. Le client SUR SkanFact reçoit
// un livre bâti depuis SES paquets (la même relecture que « Créer le livre de ce client »), une
// ouverture, un relevé rapproché et une révision entamée ; le client HORS SkanFact, le livre que le
// cabinet tient pour lui (ouverture, biens, salariés, bulletins). Tout passe par les moteurs de
// `compta.js` et par `ecrireLeLivre`, la porte unique (9.2.0) — donc par la piste d'audit aussi.
//
// Une vitrine qui échoue ne fait pas échouer l'exemple : les paquets et les dossiers sont déjà là,
// et un écran vide vaut mieux qu'un exemple qui ne se charge plus. L'échec va au journal.
function garnirVitrines(scenario) {
  const qui = quiSuisJe(), quand = Date.now(), aujourdhui = K.today();
  (scenario || []).filter(x => x.vitrine).forEach(x => {
    const d = state.dossiers.find(y => y.id === x.id);
    if (!d) return;
    try {
      let livre;
      if (x.vitrine === 'skanfact') {
        const dernier = (d.packs || []).map(p => p.month).sort().pop();
        if (!dernier) return;
        const annee = Number(dernier.slice(0, 4));
        livre = KC.livreVide(d.id, annee);
        VITRINE.ouvrirClientSkanfact(livre, { qui, quand });
        importerPaquetsDans(d, livre, annee);
        const banque = VITRINE.garnirBanque(livre, { qui, quand, aujourdhui });
        if (!banque.ok) logToFile('exemple', `vitrine banque de ${d.name} : ${banque.motif}`);
        VITRINE.garnirRevision(livre, { qui, quand, periode: String(annee), banque: banque.ok ? banque : null });
      } else {
        const r = VITRINE.livreHorsSkanfact(d.id, { qui, quand, aujourdhui });
        if (r.motifs.length) logToFile('exemple', `vitrine de ${d.name} : ${r.motifs.join(' ; ')}`);
        livre = r.livre;
        // 10.14.0 — l'exercice PRÉCÉDENT, clos, rouvert une fois puis reclos : c'est de lui que
        // l'exercice courant tient ses à-nouveaux, ses biens et ses salariés. Écrit d'abord, par la
        // même porte — un livre clos qui arrive d'un exemple ne se relit pas avant d'être écrit.
        if (r.precedent && r.precedent.livre) ecrireLeLivre(d.id, r.precedent.livre, 'exemple', 'exercice précédent, clos');
      }
      ecrireLeLivre(d.id, livre, 'exemple', 'livre de démonstration');
    } catch (e) {
      logToFile('exemple', `vitrine de ${d.name} : ${(e && e.stack) || e}`);
    }
  });
}

function retirerExemple() {
  const demos = state.dossiers.filter(d => d.demo);
  // Leurs fichiers partent avec eux : un paquet d'exemple qui traîne dans le rangement d'un vrai
  // portefeuille serait une pièce comptable qui n'existe pas. On COMPTE les livres qui partent
  // (T-36) : le travail saisi sur un dossier d'exemple s'efface avec lui, et l'écran le dit.
  let livres = 0;
  demos.forEach(d => { const r = getStore().removeDossierFiles(d, state.dossiers); livres += (r && r.livres) || 0; viderCacheLivres(d.id); });
  state.dossiers = state.dossiers.filter(d => !d.demo);
  state.exemple = null;
  return { livres };
}

function chargerExemple() {
  const retire = retirerExemple();
  const scenario = K.demoDossiers();
  const gabarits = GABARITS_EXEMPLE.mois;
  const aujourdhui = K.today().slice(0, 7);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-exemple-'));
  try {
    scenario.forEach((d, rang) => {
      // Un dossier SANS paquet — le client hors SkanFact (10.0.0) — n'a aucun `ingest` pour le
      // créer : il se pose ici, à la main. Sans cette branche il n'existerait tout simplement pas,
      // et l'exemple ne montrerait que les clients qui envoient — c'est-à-dire l'inverse d'un vrai
      // portefeuille, où ils sont deux sur soixante (6.8.0).
      if (!(d.packs || []).length) {
        if (!state.dossiers.some(x => x.id === d.id)) {
          state.dossiers.push(K.migrateDossier({
            ...d, demo: true, createdAt: new Date().toISOString(), packs: []
          }));
          getStore().write(state);
        }
        return;
      }
      (d.packs || []).slice().sort((a, b) => (a.month < b.month ? -1 : 1)).forEach(p => {
        // Le gabarit se choisit par l'ancienneté du mois, décalé d'un cran par dossier : deux
        // clients ne montrent pas le même chiffre d'affaires pour le même mois.
        const k = Math.max(1, moisEntre(aujourdhui, p.month));
        const g = gabarits[(k - 1 + rang) % gabarits.length];
        const r = K.rebaserPaquet(g, {
          mois: p.month, entreprise: { nom: d.name, matricule: d.matricule, devise: 'TND' },
          definitif: p.definitive, genereLe: p.generatedAt, versionApp: VERSION,
          manques: (p.missing || []).map(m => ({ id: m.id, niveau: m.level, quoi: m.label, combien: m.count }))
        });
        const files = r.fichiers.map(f => ({ name: f.chemin, data: Buffer.from(f.texte, 'utf8') }));
        // Le manifeste s'écrit EN DERNIER, avec l'empreinte de chaque fichier — comme `pack:build`.
        const manifest = { ...r.manifest, fichiers: files.map(f => ({ chemin: f.name, octets: f.data.length, empreinte: Z.sha256(f.data) })) };
        files.unshift({ name: 'manifeste.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') });
        const zip = Z.zipBuffer(files, { date: new Date(p.generatedAt) });
        const out = Z.sealForCabinet(zip, state.cabinet.publicKey, {
          entreprise: d.name, matricule: d.matricule, periode: p.month, definitif: !!p.definitive, format: manifest.format
        });
        const file = path.join(tmp, `${CS.slug(d.name)}-${p.month}.skanpack`);
        fs.writeFileSync(file, out);
        const res = ingest(file);
        // La date de réception est celle du scénario, pas celle du clic : « août, reçu le 06/09 ».
        const rangé = (res.dossier.packs || []).find(x => x.month === p.month);
        if (rangé) rangé.receivedAt = p.receivedAt;
        Object.assign(res.dossier, { demo: true, email: d.email || '', note: d.note || '' });
      });
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  garnirVitrines(scenario);
  // Ce que l'exemple sait de lui-même : de quelle version il sort, et sur quel mois il a été recalé.
  // Sans ces deux repères, impossible de savoir qu'il est périmé sans le refaire pour voir.
  state.exemple = { version: VERSION, mois: aujourdhui, le: K.today() };
  return retire;
}

// ---------- l'exemple se refait tout seul (9.4.2) ----------
//
// Skander : « on part du principe que mon comptable, qui est en train d'essayer l'app, ne va pas
// appuyer sur effacer l'exemple puis le recharger à chaque mise à jour ». Il a raison, et le
// problème est plus large que les mises à jour : l'exemple est RELATIF au mois courant (9.2.2).
// Chargé en septembre et regardé en décembre, il montre trois mois de retard chez des clients qui
// sont censés être à jour, et une échéance de TVA passée depuis longtemps. Un exemple périmé
// dessert le produit : c'est exactement la capture qu'on ne veut pas voir arriver.
//
// La règle : on ne touche à RIEN d'autre. `retirerExemple()` ne connaît que les dossiers `demo`,
// donc un vrai dossier créé à la main pendant l'essai survit. Une sauvegarde est prise avant (une
// note tapée sur un dossier fictif reste du travail), et l'application le DIT au comptable —
// un jeu de données qui change tout seul sans un mot ferait douter de tout le reste.
function rafraichirExemple() {
  if (!state.dossiers.some(d => d.demo)) return null;
  const mois = K.today().slice(0, 7);
  // Un exemple d'avant la 9.4.2 n'a aucun repère : il est périmé par construction, on le refait.
  const raison = K.exemplePerime(state.exemple, VERSION, mois);
  if (!raison) return null;
  getStore().backupNow('avant-exemple');
  const retire = chargerExemple();
  return { version: VERSION, mois, raison, livres: (retire && retire.livres) || 0 };
}

ipcMain.handle('cab:demo', (_e, on) => {
  requireOpen();
  if (on) chargerExemple(); else retirerExemple();
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
  // 10.14.0 — « Tes premiers pas » se lisent sur l'ÉTAT, jamais sur une case cochée à la main : le
  // fichier remis se retient ici, au moment où il existe sur le disque. Un échec d'écriture de l'état
  // ne défait pas le fichier (il est là, il sert) : l'étape resterait simplement à faire.
  state.cabinet.pairingExportedAt = new Date().toISOString();
  let etat = null;
  try { etat = save(); } catch (_) { etat = null; }
  return { path: filePath, fingerprint: fp, state: etat };
});

// ---------- IPC : import d'un paquet ----------
//
// Vingt paquets de cinquante mégaoctets, c'est une vingtaine de secondes de travail : lecture,
// déchiffrement, vérification pièce par pièce, copie. Tout cela est synchrone — et tant que la
// boucle ne rend pas la main, le processus principal ne lit AUCUN message : l'avancement ne part
// pas, la demande d'arrêt n'arrive pas, et le comptable a devant lui une application qui paraît
// morte. Beaucoup la tuent au bout de dix secondes, en plein rangement. D'où la respiration entre
// deux paquets : une ligne, et l'application redevient vivante.
let importAnnule = false;
// Et un import à la fois : le second se refuse au lieu de piétiner le filet du premier (10.0.1).
let importEnCours = false;
// Arrêter un import en cours. Le drapeau est lu ENTRE deux paquets, jamais pendant : un paquet
// interrompu au milieu de sa copie serait pire que pas de paquet du tout.
ipcMain.on('cab:importCancel', () => { importAnnule = true; });

ipcMain.handle('cab:importPack', async (_e, opts) => {
  requireOpen();
  // 10.0.1 — Deux imports à la fois. Le cas n'est pas théorique : la fenêtre a DEUX portes (le
  // bouton, qui ouvre un sélecteur de fichiers, et le glisser-déposer, qui n'en ouvre aucun), et
  // rien n'empêchait de lâcher vingt paquets sur la fenêtre pendant que vingt autres s'ingéraient.
  // Ce qui casse alors n'est pas l'import : c'est le FILET. Le second `backupNow('avant-import')`
  // écrase le premier par un état qui contient déjà la moitié du premier import — donc « défaire
  // l'import » ne ramène plus rien de reconnaissable. Et les deux boucles écrivent `state` à tour
  // de rôle, chacune sur ce que l'autre vient de poser.
  //
  // On refuse la seconde, on dit pourquoi, et on nomme ce qui débloque (règle 7.0.0). Le refus
  // passe AVANT le sélecteur de fichiers : demander vingt paquets pour les refuser ensuite serait
  // la pire des deux façons de dire non.
  if (importEnCours) {
    throw erreur('ERR-CAB-077', 'Un import de paquets est déjà en cours. Attends qu\'il finisse — ou arrête-le depuis la fenêtre d\'avancement — avant d\'en lancer un second.');
  }
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
  // Le drapeau se lève ICI, une fois les fichiers connus : un sélecteur qu'on referme sans rien
  // choisir n'a rien commencé, et n'a donc rien à bloquer. Il retombe dans le `finally`, sinon un
  // import qui échoue au milieu fermerait la porte pour le reste de la session.
  importEnCours = true;
  try {
    // Une sauvegarde AVANT d'ingérer : un import qui range mal (ou un paquet inattendu) doit pouvoir
    // être défait. Même règle que l'app entreprise avant un import.
    getStore().backupNow('avant-import');
    importAnnule = false;                    // un arrêt demandé à l'import précédent ne vaut pas ici
    const progres = p => {
      try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('import:progress', p); } catch {}
    };
    const results = [];
    let restants = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      progres({ numero: i + 1, total: files.length, faits: i, nom: path.basename(f) });
      // LA respiration. Le message d'avancement part vers l'écran, et une demande d'arrêt a le temps
      // d'arriver. Sans elle, la boucle entière tenait le processus principal sans un mot.
      await new Promise(res => setImmediate(res));
      // L'arrêt prend effet ENTRE deux paquets : ce qui est rangé l'est pour de bon, et rien n'est
      // laissé à moitié écrit.
      if (importAnnule) { restants = files.length - i; break; }
      try { results.push({ file: f, ...ingest(f, opts.password) }); }
      catch (err) { results.push({ file: f, error: err.message || String(err) }); }
      // Le paquet est rangé : on peut enfin dire de QUI il venait. « paquet 7 sur 20 — Pharmacie El
      // Menzah » dit quelque chose ; un nom de fichier, non.
      const dernier = results[results.length - 1];
      progres({ numero: i + 1, total: files.length, faits: i + 1, nom: (dernier.dossier && dernier.dossier.name) || path.basename(f) });
    }
    // Un vrai paquet est arrivé : les dossiers d'exemple s'effacent d'eux-mêmes. Les laisser
    // reviendrait à afficher des retards imaginaires à côté des vrais.
    const demoOut = results.some(r => !r.error) && state.dossiers.some(d => d.demo);
    if (demoOut) retirerExemple();
    save();
    // Un paquet venu de la boîte de réception et rangé ne doit plus être proposé.
    markSeen(results.filter(r => !r.error).map(r => r.file));
    importAnnule = false;
    return { results, demoRemoved: demoOut, restants, state: safeState() };
  } finally { importEnCours = false; }
});

// Le format de paquet que cette version sait lire. Un paquet plus récent se refuse avec une phrase
// compréhensible, il ne se range pas à moitié.
const PACK_FORMAT = 1;

function verifierManifeste(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw erreur('ERR-CAB-003', 'Le manifeste de ce paquet ne ressemble pas à un envoi SkanFact.');
  const f = Number(m.format || m.version || 1);
  if (f > PACK_FORMAT) throw erreur('ERR-CAB-004', 'Ce paquet vient d\'une version plus récente de SkanFact. Mets à jour SkanFact Cabinet pour le lire.');
  const e = m.entreprise, p = m.periode;
  if (!e || typeof e !== 'object' || Array.isArray(e)) throw erreur('ERR-CAB-005', 'Ce paquet ne dit pas de quelle entreprise il vient.');
  if (typeof e.nom !== 'string' && typeof e.matricule !== 'string') throw erreur('ERR-CAB-005', 'Ce paquet ne dit ni le nom ni le matricule de l\'entreprise.');
  if (!String(e.nom || e.matricule || '').trim()) throw erreur('ERR-CAB-005', 'Ce paquet ne dit ni le nom ni le matricule de l\'entreprise.');
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw erreur('ERR-CAB-005', 'Ce paquet ne dit pas de quel mois il parle.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(p.mois || ''))) {
    throw erreur('ERR-CAB-005', `Le mois annoncé par ce paquet est illisible (« ${String(p.mois || '').slice(0, 30)} »).`);
  }
  if (m.fichiers != null && !Array.isArray(m.fichiers)) throw erreur('ERR-CAB-006', 'La liste des fichiers de ce paquet est illisible.');
  return m;
}

function ingest(file, password) {
  let buf = fs.readFileSync(file);
  let sealed = false;
  if (Z.isSealedForCabinet(buf)) {
    const head = Z.cabinetHeader(buf);
    const mine = Z.keyFingerprint(state.cabinet.publicKey);
    if (head.destinataire && head.destinataire !== mine) {
      throw erreur('ERR-CAB-014', `Ce paquet est adressé à un autre cabinet (${head.destinataire}).`);
    }
    buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
    sealed = true;
  } else if (Z.isSealed(buf)) {
    if (!password) { throw Object.assign(erreur('ERR-CAB-017', 'Ce paquet est protégé par un mot de passe.'), { needPassword: true }); }
    buf = Z.openBuffer(buf, password);
    sealed = true;
  }
  const entries = Z.zipRead(buf);
  const mEntry = entries.find(e => e.name === 'manifeste.json');
  if (!mEntry) throw erreur('ERR-CAB-001', 'Ce fichier n\'est pas un paquet SkanFact : le manifeste est absent.');
  // Le manifeste n'est décompressé QU'UNE FOIS : `data()` refait l'inflate et le contrôle CRC à
  // chaque appel, et il était appelé trois fois par paquet (la lecture, la boucle d'empreintes,
  // puis l'empreinte du paquet). La lecture reste DANS le try : un CRC abîmé doit continuer de
  // donner la même phrase en français, pas une erreur de bibliothèque.
  let manifest, mBuf;
  try { mBuf = mEntry.data(); manifest = JSON.parse(mBuf.toString('utf8')); }
  catch { throw erreur('ERR-CAB-002', 'Le manifeste de ce paquet est illisible : le fichier a été abîmé pendant l\'envoi.'); }
  // Un paquet arrive par mail : il vient de l'EXTÉRIEUR. Tout ce qu'il annonce est contrôlé avant
  // que quoi que ce soit ne touche au disque — un mois de la forme « ../../.. » servait à fabriquer
  // un chemin de fichier, et un paquet d'une version future était rangé à moitié vide, dossier vert.
  verifierManifeste(manifest);

  // Vérification : chaque fichier annoncé est là, et avec l'empreinte annoncée. C'est ce qui permet
  // de dire « ce que j'ai reçu est exactement ce qui a été envoyé ».
  // On calcule l'empreinte de ce qu'on a reçu ; cabcore compare et compte. La règle du comptage
  // vit dans la partie testable : c'est la seule affirmation rigoureuse de cette application
  // (« ce que j'ai reçu est exactement ce qui a été envoyé »), elle doit compter juste.
  // Le manifeste ne peut pas porter sa propre empreinte : le hacher était du travail que personne ne
  // lit, sur chaque fichier de chaque paquet. Vingt paquets de 50 Mo, ça compte.
  const hashes = {};
  entries.forEach(e => {
    if (e.name === 'manifeste.json') return;
    try { hashes[e.name] = Z.sha256(e.data()); } catch { hashes[e.name] = '(illisible)'; }
  });
  // Et dans l'autre sens : ce que le manifeste n'annonce pas (« intrus ») n'a été comparé à rien.
  const { checked, bad, intrus } = K.checkIntegrity(manifest, hashes);

  // On range le paquet tel quel : c'est la pièce justificative, on ne la réécrit pas. Le classement
  // (client / année / mois) permet au comptable de retrouver les pièces sans ouvrir l'application —
  // et de les rendre à un client en copiant un dossier.
  const key = K.dossierKey(manifest);
  const month = (manifest.periode || {}).mois || 'inconnu';
  const known = state.dossiers.find(d => d.id === key);
  const fiche = known || { id: key, name: (manifest.entreprise || {}).nom || '(sans nom)', matricule: (manifest.entreprise || {}).matricule || '' };

  // ---------- l'ORIGINE du paquet (9.2.0) ----------
  //
  // Chiffrer n'est pas signer. `sealForCabinet` ne demande que la clé PUBLIQUE du cabinet — celle
  // que le comptable donne à tous ses clients — donc quiconque la tenait pouvait fabriquer un
  // paquet parfaitement chiffré au nom d'une autre entreprise. La signature du client règle ça.
  //
  // On vérifie AVANT de ranger quoi que ce soit : un paquet refusé ne doit rien laisser sur le
  // disque, et surtout pas dans le dossier d'un client dont il usurpe le nom.
  //
  // L'ordre est fixé : le sha256 du manifeste D'ABORD, la signature ensuite. Ce n'est pas une
  // question de sécurité — Ed25519 porte sur les octets, donc un manifeste modifié fait échouer
  // `verify` de toute façon — c'est une question de PHRASE : « modifié après l'envoi » et
  // « signature inconnue » ne demandent pas le même coup de téléphone.
  const sEntry = entries.find(e => e.name === 'signature.json');
  let sig = null;
  if (sEntry) {
    try { sig = Z.verifyManifest(mBuf, JSON.parse(sEntry.data().toString('utf8'))); }
    catch { sig = { ok: false, motif: 'illisible', texte: 'La signature de ce paquet est illisible.' }; }
  }
  const origine = K.verdictOrigine(fiche, sig);
  if (!origine.ok) { throw Object.assign(erreur(origine.code, origine.texte), { origine }); }
  const dest = getStore().storePack(file, fiche, month, state.dossiers.concat(known ? [] : [fiche]));

  const res = K.filePack(state, manifest, {
    receivedAt: Date.now(), digest: Z.sha256(mBuf), bytes: fs.statSync(file).size,
    path: dest, sealed,
    // Rangé AVEC le paquet, pas seulement affiché : un verdict qui vit deux secondes n'est pas un
    // verdict (règle 6.8.1). Six mois plus tard, on doit pouvoir dire de quel paquet l'origine
    // était prouvée et de quel autre elle ne l'était pas.
    origine: { etat: origine.etat, empreinte: origine.empreinte || null, at: Date.now() },
    integrity: { checked, bad, intrus, at: Date.now() }
  });
  // L'ÉPINGLAGE : le premier paquet signé fixe la clé de ce client, et tout ce qui suit lui est
  // comparé. C'est la confiance au premier usage — la tolérance « origine non prouvée » s'éteint
  // alors d'elle-même pour ce client, sans date butoir imposée à tout le portefeuille.
  if (origine.epingler) {
    const d = state.dossiers.find(x => x.id === key);
    if (d) {
      d.clePublique = origine.epingler;
      d.cleEmpreinte = origine.empreinte;
      d.cleEpingleeLe = new Date().toISOString();
      d.audit = (d.audit || []).concat([{ quand: Date.now(), quoi: 'cle-epinglee', detail: origine.empreinte }]);
      getStore().write(state);
    }
  }
  // Ce que le paquet dit de la licence du CLIENT (9.4.0) : c'est elle qui décide si ce dossier
  // compte dans la licence du cabinet. On ne la retient que si le paquet la porte — un paquet plus
  // ancien laisse la valeur d'avant plutôt que de l'effacer, sinon rejouer un vieux mois ferait
  // soudain compter un dossier qui ne comptait pas.
  const licenceClient = K.licenceDuPaquet(manifest);
  if (licenceClient) {
    const d = state.dossiers.find(x => x.id === key);
    if (d) { d.clientLicence = licenceClient; getStore().write(state); }
  }
  // Les RÉPONSES aux questions posées à ce client (9.10.0). Elles voyagent dans le paquet plutôt
  // que dans un fichier à part : c'est déjà le geste mensuel du client, et une réponse qu'il faut
  // penser à envoyer séparément n'est jamais envoyée. Elles ne touchent AUCUN chiffre — elles se
  // rangent sur la question, et le comptable décide ensuite de ce qu'il en fait.
  let reponses = null;
  const rEntry = entries.find(e => e.name === 'reponses.json');
  if (rEntry) {
    try {
      const obj = JSON.parse(rEntry.data().toString('utf8'));
      if (obj && Number(obj.format) === 1 && Array.isArray(obj.reponses)) reponses = posterReponses(key, obj.reponses);
    } catch (e) { logToFile('reponses-paquet', e); }
  }
  // Un mois qui vient d'arriver doit apparaître dans les livres tout de suite. Sans cette ligne,
  // il n'apparaîtrait qu'au redémarrage et le comptable croirait l'import raté.
  viderCacheLivres(key);
  return { ...res, integrity: { checked, bad, intrus }, origine, reponses };
}

// Ranger les réponses dans le livre qui porte les questions. On les cherche dans TOUS les exercices
// du dossier : une question posée sur 2025 peut recevoir sa réponse dans le paquet de mars 2026.
// Le droit ne s'applique pas ici — c'est le CLIENT qui répond, pas un collaborateur qui valide, et
// refuser une réponse reçue reviendrait à la perdre.
function posterReponses(dossierId, reponses) {
  const d = dossierDe(dossierId);
  if (!d) return null;
  const annees = (getStore().lireIndexLivres(d, indexDossiers()).exercices || []).map(x => x.annee);
  // La règle vit dans le moteur (10.13.0), où elle se prouve sans Electron : une réponse déjà
  // rangée qui revient dans le paquet suivant est CONNUE, pas « sans question ».
  const out = KC.posterReponsesDansLivres(annees, annee => {
    const o = ouvrirLivre(dossierId, annee);
    return o && o.livre;
  }, reponses, Date.now());
  out.modifies.forEach(m => ecrireLeLivre(dossierId, m.livre, 'reponses', `${m.posees} réponse${m.posees > 1 ? 's' : ''} du client`));
  return out.posees || out.inconnues ? { posees: out.posees, inconnues: out.inconnues } : null;
}

// Ouvrir un fichier contenu dans un paquet : on l'extrait dans un dossier temporaire, en lecture.
// Les extractions sont effacées à la fermeture de l'application : elles contiennent les pièces
// comptables d'un client, elles n'ont rien à faire dans /tmp pour toujours.
const tempDirs = [];
// Ce qu'un paquet comptable contient légitimement, et que le système peut ouvrir sans risque.
const LISIBLES = new Set(['.pdf', '.csv', '.txt', '.json', '.xml', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.tif', '.tiff']);
ipcMain.handle('cab:openInPack', async (_e, { packPath, name, password } = {}) => {
  requireOpen();
  let buf = fs.readFileSync(packPath);
  if (Z.isSealedForCabinet(buf)) buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
  else if (Z.isSealed(buf)) buf = Z.openBuffer(buf, password || '');
  const e = Z.zipRead(buf).find(x => x.name === name);
  if (!e) throw erreur('ERR-CAB-007', 'Fichier absent du paquet.');
  // Le NOM du fichier est choisi par l'expéditeur. `shell.openPath` lance le programme associé à
  // l'extension : un paquet contenant « facture.pdf.command » ou « bulletin.exe » ferait exécuter
  // du code par un simple clic dans une liste de pièces comptables. On n'ouvre que ce qui se lit.
  const ext = path.extname(name).toLowerCase();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skanpack-'));
  tempDirs.push(dir);
  const base = path.basename(name).replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_');
  const out = path.join(dir, base);
  fs.writeFileSync(out, e.data());
  if (!LISIBLES.has(ext)) {
    // On le montre dans le dossier plutôt que de le lancer : le comptable décide, pas l'expéditeur.
    shell.showItemInFolder(out);
    return { path: out, opened: false, reason: `« ${base} » n'est pas un document (${ext || 'sans extension'}) : SkanFact ne l'ouvre pas tout seul. Il est montré dans le dossier.` };
  }
  await shell.openPath(out);
  return { path: out, opened: true };
});

function cleanTemp() {
  while (tempDirs.length) {
    const d = tempDirs.pop();
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  }
}

// La liste des fichiers d'un paquet, sans rien extraire. Chaque fichier dit s'il est ANNONCÉ par le
// manifeste : celui qui ne l'est pas n'a été comparé à rien, et l'interface pose une question avant
// de l'ouvrir. On relit le manifeste du paquet plutôt que le verdict rangé à la réception : un
// paquet reçu avant cette version n'en porte pas, et la réponse est dans le fichier lui-même.
ipcMain.handle('cab:listPack', (_e, { packPath, password } = {}) => {
  requireOpen();
  let buf = fs.readFileSync(packPath);
  if (Z.isSealedForCabinet(buf)) buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
  else if (Z.isSealed(buf)) buf = Z.openBuffer(buf, password || '');
  const entries = Z.zipRead(buf);
  // Sans manifeste lisible on ne sait pas : on n'accuse personne, tout passe pour annoncé.
  let annonces = null;
  const mEntry = entries.find(e => e.name === 'manifeste.json');
  if (mEntry) {
    try {
      const m = JSON.parse(mEntry.data().toString('utf8'));
      if (Array.isArray(m.fichiers)) annonces = new Set(m.fichiers.map(f => f && f.chemin));
    } catch { annonces = null; }
  }
  return entries.map(e => ({
    name: e.name, size: e.size,
    annonce: !annonces || K.HORS_MANIFESTE.includes(e.name) || annonces.has(e.name)
  }));
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

// ---------- IPC : la boîte de réception ----------
//
// À soixante clients, le geste quotidien n'est pas d'importer un paquet : c'est d'en importer douze.
// Enregistrer chaque pièce jointe puis cliquer douze fois sur « Importer », c'est le genre de corvée
// qui fait abandonner un logiciel. Le comptable désigne un dossier (celui où sa messagerie range les
// pièces jointes, ou un dossier partagé), et l'application lui dit ce qui est arrivé.
//
// Elle n'importe JAMAIS toute seule : elle propose, il clique. C'est la même règle que la lecture de
// photo de facture côté entreprise — l'application ne remplit rien sans décision humaine.
function inboxSeen() { const c = readAppCfg(); return c.inboxSeen && typeof c.inboxSeen === 'object' ? c.inboxSeen : {}; }

function scanInbox() {
  const dir = readAppCfg().inboxDir;
  if (!dir) return { dir: null, nouveaux: [] };
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) {
    // La raison change le GESTE, donc elle se lit (10.0.1). « Support débranché ? » sur un dossier
    // que le système refuse d'ouvrir envoie chercher une clé USB qui est là : on ne devine pas une
    // cause quand `e.code` la donne.
    const erreur = e && (e.code === 'EACCES' || e.code === 'EPERM')
      ? 'Ce dossier existe mais l\'accès est refusé. Vérifie ses autorisations, ou choisis-en un autre.'
      : e && e.code === 'ENOTDIR'
        ? 'Ce chemin désigne un fichier, pas un dossier. Choisis le dossier qui contient les paquets.'
        : 'Dossier introuvable — un disque ou une clé USB débranchée, ou un dossier déplacé.';
    return { dir, erreur, nouveaux: [] };
  }
  const vus = inboxSeen();
  const nouveaux = [];
  entries.forEach(e => {
    if (!e.isFile() || !/\.skanpack$/i.test(e.name)) return;
    const p = path.join(dir, e.name);
    let s;
    try { s = fs.statSync(p); } catch { return; }
    // Une empreinte bon marché : chemin + taille + date. Recopier le même fichier sous un autre nom
    // le reproposera — et c'est voulu : le comptable saura pourquoi, l'application non.
    const cle = `${s.size}:${Math.round(s.mtimeMs)}`;
    if (vus[p] === cle) return;
    nouveaux.push({ path: p, name: e.name, size: s.size, mtime: s.mtimeMs });
  });
  nouveaux.sort((a, b) => a.mtime - b.mtime);
  return { dir, nouveaux };
}

function markSeen(paths) {
  const vus = inboxSeen();
  (paths || []).forEach(p => {
    try { const s = fs.statSync(p); vus[p] = `${s.size}:${Math.round(s.mtimeMs)}`; } catch {}
  });
  // On ne garde pas l'historique de toute une carrière : les 500 derniers suffisent à ne pas
  // reproposer ce qu'on vient d'importer.
  const cles = Object.keys(vus);
  if (cles.length > 500) cles.slice(0, cles.length - 500).forEach(k => { delete vus[k]; });
  writeAppCfg({ inboxSeen: vus });
}

ipcMain.handle('cab:inbox', () => scanInbox());

ipcMain.handle('cab:pickInbox', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Le dossier où tu ranges les paquets reçus',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths.length) return null;
  writeAppCfg({ inboxDir: r.filePaths[0] });
  return scanInbox();
});

ipcMain.handle('cab:clearInbox', () => { writeAppCfg({ inboxDir: null }); return { dir: null, nouveaux: [] }; });

// Ne plus proposer ces fichiers, sans les importer : un paquet déjà traité ailleurs, un fichier
// d'essai. On ne les efface pas — ce sont les pièces d'un client, pas les nôtres.
ipcMain.handle('cab:inboxIgnore', (_e, paths) => { markSeen(paths); return scanInbox(); });

// ---------- IPC : regrouper les écritures ----------
//
// Le renderer décide de ce qui part (K.ecrituresPlan, pur et testable) et le montre au comptable
// AVANT de fabriquer quoi que ce soit ; ici on ne fait qu'exécuter — même règle que pour le paquet
// mensuel côté entreprise.
ipcMain.handle('cab:ecrituresPlan', (_e, opts) => {
  requireOpen();
  return K.ecrituresPlan(state, opts);
});

// Lire `journaux/ecritures.csv` d'UN paquet. Une seule fonction pour les deux usages — l'export
// groupé et les livres du dossier — parce que deux lectures séparées finiraient par ne plus
// accepter les mêmes paquets, et personne ne saurait pourquoi un mois apparaît d'un côté et pas
// de l'autre (règle « une table en double diverge toujours »).
//
// Elle ne LÈVE jamais : un paquet illisible ne doit pas emporter les onze autres. Elle rend son
// motif, en français, et l'appelant le montre (même règle que `absents` dans le manifeste, 6.1.0).
function lireEcritures(p) {
  try {
    let buf = fs.readFileSync(p.path);
    if (Z.isSealedForCabinet(buf)) buf = Z.openWithCabinetKey(buf, state.cabinet.privateKey);
    else if (Z.isSealed(buf)) return { motif: 'protégé par un mot de passe' };
    const e = Z.zipRead(buf).find(x => x.name === 'journaux/ecritures.csv');
    if (!e) return { motif: 'paquet sans écritures (version trop ancienne)' };
    return { csv: e.data().toString('utf8') };
  } catch (err) {
    return { motif: String((err && err.message) || err) };
  }
}

// ---------- les livres d'un dossier (9.1.0) ----------
//
// Le Cabinet LIT une comptabilité dans les paquets reçus. Il n'écrit rien, ne modifie rien chez le
// client, et ne tient pas encore de livre à lui (c'est la 9.2.0).
//
// Le cache : les CSV d'un dossier sont relus une fois par session. Douze paquets scellés, c'est
// douze déchiffrements AES ; les relire à chaque changement d'onglet rendrait l'écran poussif sans
// aucune raison. Il s'invalide à l'import — sinon un mois reçu n'apparaîtrait qu'au redémarrage,
// et le comptable croirait l'import raté.
const cacheLivres = new Map();
function viderCacheLivres(dossierId) {
  if (dossierId) cacheLivres.delete(dossierId); else cacheLivres.clear();
}

ipcMain.handle('cab:livres', (_e, { dossierId, du, au } = {}) => {
  requireOpen();
  const d = (state.dossiers || []).find(x => x.id === dossierId);
  if (!d) throw erreur('ERR-CAB-009', 'Ce dossier n\'existe plus.');

  let cache = cacheLivres.get(dossierId);
  if (!cache) {
    cache = { paquets: [] };
    (d.packs || []).filter(p => p.path).sort((a, b) => (a.month < b.month ? -1 : 1)).forEach(p => {
      const r = lireEcritures(p);
      cache.paquets.push({ month: p.month, definitive: !!p.definitive, path: p.path, motif: r.motif || '', csv: r.csv || '' });
    });
    cacheLivres.set(dossierId, cache);
  }

  // La période : bornes de mois. Sans borne, tout ce qui a été reçu.
  const dans = p => (!du || p.month >= du) && (!au || p.month <= au);
  const pris = cache.paquets.filter(dans);
  return {
    dossier: { id: d.id, name: d.name, matricule: d.matricule || '' },
    // Les mois du paquet, avec leur CSV brut : c'est le RENDERER qui l'analyse, par `compta.js`,
    // exactement comme l'app entreprise. Le processus principal ne fait que déchiffrer et lire.
    paquets: pris.map(p => ({ month: p.month, definitive: p.definitive, path: p.path, motif: p.motif, csv: p.csv })),
    // Tous les mois connus du dossier, pour le sélecteur de période — y compris hors bornes.
    tousLesMois: cache.paquets.map(p => p.month),
    aucunPaquet: !cache.paquets.length,
    // 10.10.0 (C-07, C-12) — les exercices que le CABINET tient, lus dans l'index (jamais en
    // déchiffrant les livres). Le sélecteur d'exercice se construisait sur les seuls paquets reçus :
    // « Ouvrir 2027 » écrivait un livre qu'aucun écran ne permettait d'ouvrir, et un dossier hors
    // SkanFact — qui ne reçoit AUCUN paquet — n'avait pas d'exercice du tout.
    exercices: exercicesDuDossier(d)
  };
});

function exercicesDuDossier(d) {
  try {
    return (getStore().lireIndexLivres(d, indexDossiers()).exercices || [])
      .map(x => ({ annee: String(x.annee), clos: !!x.clos, ecritures: Number(x.ecritures) || 0 }));
  } catch { return []; }
}

// ================================================================ LE LIVRE (9.2.0)
//
// **UNE seule porte d'écriture** : `ecrireLeLivre`. Tout geste qui touche au livre passe par elle,
// et elle fait trois choses dans le même mouvement — poser le verrou, écrire, tracer. Deux portes,
// c'est la garantie qu'un jour l'une d'elles oubliera l'audit, et un livre comptable sans piste
// d'audit ne vaut rien devant un contrôle.
//
// Le moteur, lui, est PUR (`compta.js`) : ce fichier ne calcule rien, il ouvre, applique, referme.
const KC = require('../renderer/compta.js');

function dossierDe(dossierId) {
  const d = (state.dossiers || []).find(x => x.id === dossierId);
  if (!d) throw erreur('ERR-CAB-009', 'Ce dossier n\'existe plus.');
  return d;
}
const indexDossiers = () => getStore().folderIndex(state.dossiers);
// 10.14.0 — l'identité du poste naît au PREMIER besoin, pas à la première annonce à la plateforme
// (qui ne part que quelques minutes après le démarrage, et jamais sans plan de contrôle configuré).
// Sans elle, le verrou d'un livre portait un identifiant vide — et `poserVerrou` ne reconnaît un
// AUTRE poste qu'à un identifiant non vide : deux postes sur le même livre ne se voyaient pas. Et la
// piste d'audit, comme l'exemple, écrivait « clos … par cabinet » (vu à la souris).
const moiPoste = () => { const p = identitePoste(); return { deviceId: p.id, deviceName: p.name }; };

// ---------------------------------------------------------------- le cabinet à plusieurs (9.9.0)
//
// QUI travaille sur ce poste. L'identité vit dans `app-config.json` et non dans l'état chiffré :
// c'est une propriété du POSTE, pas du cabinet. Deux postes partagent la même base — donc la même
// liste de collaborateurs — et doivent pouvoir être deux personnes différentes en même temps ;
// rangée dans l'état, l'identité du dernier qui s'est déclaré suivrait la copie externe et
// renommerait l'autre.
const moiId = () => String(readAppCfg().collaborateurId || '');
const moiCollab = () => K.collaborateurDe(state, moiId());

// Le `qui` de la piste d'audit. Le nom de la personne quand elle est déclarée, le nom du poste
// sinon — un cabinet d'une seule personne n'a rien à déclarer, et sa piste d'audit ne doit pas se
// vider pour autant.
const quiSuisJe = () => { const c = moiCollab(); return (c && c.nom) || moiPoste().deviceName || 'cabinet'; };

// La porte UNIQUE des droits, jumelle de `licenceBlockCab` (9.4.0). Toute la 9.9.0 tient à ce
// qu'il n'y en ait qu'une : une seconde vérification recopiée ailleurs finirait par diverger, et
// une divergence ici veut dire « quelqu'un valide ce qu'il n'a pas le droit de valider ».
function droitBlock(dossierId, geste) {
  const v = K.peut(state, dossierId, moiId(), geste);
  if (v.ok) return v;
  const e = erreur('ERR-CAB-070', `${v.motif} ${v.geste}`);
  e.code = 'ERR-CAB-070';
  throw e;
}

// Ouvrir un livre, ou dire pourquoi on ne peut pas. JAMAIS d'écriture ici : un livre créé en
// silence à la première consultation ferait croire à un dossier repris qui ne l'est pas.
// Ce que chaque livre CLOS portait quand on l'a lu (10.14.0) : la porte d'écriture le compare à ce
// qu'on s'apprête à écrire. Un exercice clos ne bouge plus — pour TOUS les gestes, pas seulement la
// grille de saisie. Un WeakMap : la marque suit l'objet lu, et disparaît avec lui.
const figeAuChargement = new WeakMap();

function ouvrirLivre(dossierId, annee) {
  const d = dossierDe(dossierId);
  const r = getStore().lireLivre(d, annee, indexDossiers());
  if (r.livre && r.livre.exercice && r.livre.exercice.clos) figeAuChargement.set(r.livre, KC.empreinteFigee(r.livre));
  return { dossier: { id: d.id, name: d.name, matricule: d.matricule || '' }, ...r };
}

// Depuis quand un verrou traîne, en français. « depuis 3 heures » se juge tout seul ; un
// horodatage brut demande de compter, et on ne compte pas avant de décider d'un geste.
function depuisQuand(ms) {
  const min = Math.max(0, Math.round((Date.now() - Number(ms || 0)) / 60000));
  if (min < 2) return 'à l\'instant';
  if (min < 60) return `depuis ${min} minutes`;
  const h = Math.round(min / 60);
  return h < 24 ? `depuis ${h} heure${h > 1 ? 's' : ''}` : `depuis ${Math.round(h / 24)} jour${h >= 48 ? 's' : ''}`;
}

function ecrireLeLivre(dossierId, livre, quoi, detail, opts) {
  // Un exercice clos à la lecture et encore clos à l'écriture ne change aucun chiffre : la clôture,
  // sa trace, les questions et la révision passent ; une écriture, un bien, un bulletin, un relevé
  // non. Le refus nomme le geste qui débloque (la réouverture, motif exigé).
  const fige = figeAuChargement.get(livre);
  if (fige !== undefined && livre.exercice && livre.exercice.clos && KC.empreinteFigee(livre) !== fige) {
    throw erreur('ERR-CAB-064', KC.refusExerciceClos(livre));
  }
  const d = dossierDe(dossierId);
  const idx = indexDossiers();
  const v = getStore().poserVerrou(d, livre.exercice.annee, moiPoste(), idx, { forcer: !!(opts && opts.forcerVerrou) });
  if (!v.ok) {
    // Le refus porte de quoi DÉCIDER : quel poste, depuis quand, et le geste qui débloque. Sans
    // ces trois-là, « attends » est la seule réponse possible, et un poste éteint au milieu d'une
    // écriture bloquerait la saisie pour vingt-quatre heures (ERR-CAB-022, moitié « forcer »).
    const e = erreur('ERR-CAB-022', `Ce livre est ouvert sur un autre ordinateur (${v.verrou.deviceName || 'poste inconnu'}) ${depuisQuand(v.verrou.depuis)}.`
      + ' Ferme-le là-bas, ou reprends le verrou si ce poste est éteint.');
    e.code = 'ERR-CAB-022';
    e.verrou = { deviceName: v.verrou.deviceName || '', depuis: v.verrou.depuis || 0 };
    throw e;
  }
  if (quoi) livre.audit.push({ quand: Date.now(), qui: quiSuisJe(), poste: moiPoste().deviceName || '', quoi, detail: detail || '' });
  let r = getStore().ecrireLivre(d, livre, idx, { qui: quiSuisJe() });
  // ---------- deux postes ont écrit le même exercice (9.9.0) ----------
  //
  // La révision du disque a bougé depuis qu'on a ouvert ce livre : un autre poste a enregistré
  // entre-temps. Écrire par-dessus ferait disparaître son travail SANS UN MOT — c'est le défaut
  // que la 3.2.0 a corrigé côté entreprise, et le danger du partage n'est pas la panne, c'est le
  // silence. On fusionne : sa version devient la base, la nôtre s'y ajoute, et rien de validé ne
  // se perd ni ne s'écrase (voir `fusionnerLivres`). Le rapport remonte à l'écran, parce qu'un
  // conflit résolu en silence est encore un silence.
  if (r && r.conflit) {
    const f = KC.fusionnerLivres(r.disque, livre, Date.now());
    if (!f.ok) throw erreur('ERR-CAB-072', `Impossible de réunir les deux versions de ce livre : ${f.motif}`);
    f.livre.audit.push({
      quand: Date.now(), qui: quiSuisJe(), poste: moiPoste().deviceName || '', quoi: 'fusion',
      detail: `${f.rapport.total} écriture(s) reprises d'un autre poste, ${f.rapport.aRegarder} à regarder`
    });
    r = getStore().ecrireLivre(d, f.livre, idx, { force: true, qui: quiSuisJe() });
    r.fusion = f.rapport;
    r.livre = f.livre;
  }
  // Le verrou se LÈVE : il garde l'écriture, pas la session. Laissé posé — et il l'était jusqu'ici,
  // `leverVerrou` n'ayant jamais eu un seul appelant — il interdisait à l'autre poste d'écrire
  // pendant vingt-quatre heures après un seul enregistrement. Ce qui protège du travail perdu,
  // c'est la révision ci-dessus ; le verrou ne protège que de deux écritures simultanées.
  getStore().leverVerrou(d, livre.exercice.annee, idx);
  return r;
}

ipcMain.handle('cab:livre', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  return ouvrirLivre(dossierId, annee);
});

// La liste des exercices d'un dossier, lue dans l'INDEX : sans lui, dessiner un sélecteur d'année
// demanderait d'ouvrir et de déchiffrer chaque livre.
ipcMain.handle('cab:livreIndex', (_e, { dossierId } = {}) => {
  requireOpen();
  return getStore().lireIndexLivres(dossierDe(dossierId), indexDossiers());
});

// Reprendre un dossier : exercice + plan + balance d'ouverture, en UN geste. Refusé si un livre
// existe déjà pour cette année — on ne remplace pas un exercice commencé sans le dire.
ipcMain.handle('cab:reprendre', (_e, { dossierId, annee, du, au, plan, ouverture, source } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'supervision');
  const existant = ouvrirLivre(dossierId, annee);
  if (existant.livre) {
    const e = erreur('ERR-CAB-015', `Ce dossier a déjà un livre pour ${annee}. Ouvre-le plutôt que de le reprendre à zéro : une reprise effacerait son point de départ.`);
    throw e;
  }
  // Deux refus différents sous une même condition : un livre écrit par une version plus récente
  // (on ne l'ouvre pas, on ne l'abîme pas) et un livre illisible (il a été mis de côté). Le code les
  // sépare, parce que le geste qui débloque n'est pas le même — mettre à jour, ou restaurer.
  if (existant.illisible || existant.versionInconnue) {
    throw erreur(existant.versionInconnue ? 'ERR-CAB-020' : 'ERR-CAB-021',
      existant.motif || 'Le livre de cet exercice n\'est pas lisible.');
  }
  const livre = KC.livreVide(dossierId, annee, { du, au, plan: Array.isArray(plan) ? plan : [] });
  if (Array.isArray(ouverture) && ouverture.length) {
    const r = KC.balanceOuverture(livre, ouverture, du || `${annee}-01-01`, source || 'balance', quiSuisJe(), Date.now());
    if (!r.ok) { throw Object.assign(erreur('ERR-CAB-023', r.motif), { ecart: r.ecart }); }
  }
  ecrireLeLivre(dossierId, livre, 'reprise', `exercice ${annee}`);
  return ouvrirLivre(dossierId, annee);
});

// Les deux imports CSV. Le fichier est lu ici, l'analyse est PURE (`compta.js`) : c'est elle qui
// associe les colonnes par nom et nomme chaque ligne ignorée.
function lireCsvFichier(chemin) {
  const brut = fs.readFileSync(chemin, 'utf8').replace(/^﻿/, '');
  return K.parseCsv(brut);
}

ipcMain.handle('cab:importerPlan', async (_e, { dossierId, annee, chemin } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const f = chemin || (await dialog.showOpenDialog({ title: 'Importer un plan de comptes', filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }], properties: ['openFile'] })).filePaths[0];
  if (!f) return { annule: true };
  const r = KC.planDepuisCsv(lireCsvFichier(f));
  if (r.motif) throw erreur('ERR-CAB-027', r.motif);
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas encore de livre pour cet exercice.');
  // Un compte déjà présent n'est PAS écrasé : le comptable a pu le renommer, et un import ne
  // défait pas ce qu'il a décidé. On ajoute ce qui manque, on dit ce qu'on a laissé.
  let ajoutes = 0, deja = 0;
  r.comptes.forEach(c => {
    if (o.livre.plan.some(x => x.compte === c.compte)) { deja++; return; }
    o.livre.plan.push({ ...c, source: 'import' });
    ajoutes++;
  });
  ecrireLeLivre(dossierId, o.livre, 'import-plan', `${ajoutes} compte(s) ajouté(s), ${deja} déjà là, ${r.ignorees.length} ignorée(s)`);
  return { ajoutes, deja, ignorees: r.ignorees, fichier: f };
});

ipcMain.handle('cab:importerBalance', async (_e, { dossierId, annee, chemin } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const f = chemin || (await dialog.showOpenDialog({ title: 'Importer une balance d\'ouverture', filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }], properties: ['openFile'] })).filePaths[0];
  if (!f) return { annule: true };
  const r = KC.balanceDepuisCsv(lireCsvFichier(f));
  if (r.motif) throw erreur('ERR-CAB-023', r.motif);
  return { lignes: r.lignes, ignorees: r.ignorees, fichier: f };
});

// Les trois gestes du comptable sur une écriture. Chacun rend le livre relu : l'écran ne devine
// jamais ce que l'écriture est devenue, il le lit.
ipcMain.handle('cab:valider', (_e, { dossierId, annee, id } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  licenceBlockCab('Valider une écriture');
  const r = KC.validerEcriture(o.livre, id, quiSuisJe(), Date.now());
  if (!r.ok) { throw Object.assign(erreur('ERR-CAB-024', r.motif), { motifs: r.motifs }); }
  ecrireLeLivre(dossierId, o.livre, null);
  noterValidation(dossierId);
  return { ok: true, numero: r.ecriture.numero, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:contrepasser', (_e, { dossierId, annee, id, date } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  licenceBlockCab('Contre-passer une écriture');
  const r = KC.contrepasser(o.livre, id, quiSuisJe(), date, Date.now());
  if (!r.ok) throw erreur('ERR-CAB-025', r.motif);
  ecrireLeLivre(dossierId, o.livre, null);
  noterValidation(dossierId);
  return { ok: true, numero: r.ecriture.numero, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:saisir', (_e, { dossierId, annee, ecriture } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const e = KC.ajouterEcriture(o.livre, ecriture, quiSuisJe(), Date.now());
  ecrireLeLivre(dossierId, o.livre, 'saisie', `${e.journal} ${e.piece}`);
  return { ok: true, id: e.id, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:lettrer', (_e, { dossierId, annee, compte, ids, lettre, delettrer, date } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = delettrer
    ? KC.delettrer(o.livre, lettre, quiSuisJe(), Date.now())
    : KC.lettrer(o.livre, compte, ids, lettre, quiSuisJe(), date);
  if (!r.ok) { throw Object.assign(erreur('ERR-CAB-028', r.motif), { ecart: r.ecart }); }
  ecrireLeLivre(dossierId, o.livre, delettrer ? null : 'lettrage', r.lettre || lettre);
  return { ok: true, lettre: r.lettre, livre: ouvrirLivre(dossierId, annee).livre };
});

// ================================================================ LA BANQUE (9.5.0)
//
// Deux écrans, deux modèles, deux tests : le RAPPROCHEMENT confronte le relevé au compte 532, le
// LETTRAGE relie une facture et son règlement sur le compte d'un tiers. Ici, comme partout dans ce
// fichier, la RÈGLE est dans `compta.js` : main.js ouvre, applique, referme et trace.
//
// Lire un relevé et l'AJOUTER sont deux gestes séparés, exprès. Entre les deux, le comptable
// choisit le compte bancaire, saisit les deux soldes du relevé papier, et corrige l'association des
// colonnes si la banque est nouvelle. Fondre les deux reviendrait à écrire dans un livre comptable
// à partir d'un fichier que personne n'a regardé.
ipcMain.handle('cab:lireReleve', async (_e, { chemin, assoc } = {}) => {
  requireOpen();
  const f = chemin || (await dialog.showOpenDialog({
    title: 'Importer un relevé bancaire',
    filters: [{ name: 'Relevé (CSV)', extensions: ['csv', 'txt'] }], properties: ['openFile']
  })).filePaths[0];
  if (!f) return { annule: true };
  const brut = fs.readFileSync(f);
  const r = KC.releveDepuisCsv(K.parseCsv(brut.toString('utf8').replace(/^﻿/, '')), assoc);
  // L'empreinte est celle des OCTETS du fichier : c'est elle qui empêche d'importer deux fois le
  // même relevé, et elle doit donc être insensible à la façon dont on l'a relu.
  return { ...r, fichier: f, empreinte: crypto.createHash('sha256').update(brut).digest('hex') };
});

ipcMain.handle('cab:ajouterReleve', (_e, { dossierId, annee, releve } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.ajouterReleve(o.livre, releve, quiSuisJe(), Date.now());
  if (!r.ok) throw Object.assign(erreur('ERR-CAB-040', r.motif), { ecart: r.ecart });
  ecrireLeLivre(dossierId, o.livre, null);   // `ajouterReleve` a déjà tracé : jamais deux fois
  return { ok: true, releve: r.releve, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:supprimerReleve', (_e, { dossierId, annee, id } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.supprimerReleve(o.livre, id);
  if (!r.ok) throw erreur('ERR-CAB-009', r.motif);
  ecrireLeLivre(dossierId, o.livre, 'relevé retiré', id);
  return { ok: true, ecrituresGardees: r.ecrituresGardees, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:rapprocherAuto', (_e, { dossierId, annee, releveId, jours } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.rapprocherAuto(o.livre, releveId, { jours, date: K.today() });
  if (!r.ok) throw erreur('ERR-CAB-009', r.motif);
  ecrireLeLivre(dossierId, o.livre, 'rapprochement automatique',
    `${r.compte.certain} certain(s), ${r.compte.probable} probable(s), ${r.compte['a-confirmer']} à confirmer, ${r.compte.aucun} sans réponse`);
  return { ...r, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:rapprocher', (_e, { dossierId, annee, releveId, ligneId, choix } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.rapprocherLigne(o.livre, releveId, ligneId, choix, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-041', r.motif);
  ecrireLeLivre(dossierId, o.livre, null);
  return { ok: true, niveau: r.niveau, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:derapprocher', (_e, { dossierId, annee, releveId } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.derapprocherReleve(o.livre, releveId, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-041', r.motif);
  ecrireLeLivre(dossierId, o.livre, null);
  return { ok: true, defaits: r.defaits, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:lettrageAuto', (_e, { dossierId, annee, compte, jours } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.lettrageAuto(o.livre, compte, { jours, par: 'auto', date: K.today() });
  ecrireLeLivre(dossierId, o.livre, 'lettrage automatique', `${compte} — ${r.poses.length} lettre(s) posée(s), ${r.restent} ligne(s) ouverte(s)`);
  return { ...r, livre: ouvrirLivre(dossierId, annee).livre };
});

// Les deux tables que la banque apprend : l'association des colonnes PAR BANQUE, et les libellés
// reconnus. Elles vivent au niveau du cabinet (on les écrit une fois pour soixante clients) ; le
// compte bancaire proposé et le « ± n jours », eux, appartiennent au dossier.
ipcMain.handle('cab:saveBanque', (_e, { banques, libelles, dossierId, banque } = {}) => {
  requireOpen();
  if (banques && typeof banques === 'object') state.banques = banques;
  if (Array.isArray(libelles)) state.libelles = libelles;
  if (dossierId) dossierDe(dossierId).banque = (banque && typeof banque === 'object') ? banque : null;
  return save();
});

// ================================================================ LA DÉCLARATION (9.6.0)
//
// Préparer n'est pas déposer, et déposer n'est pas payer. L'application ne dépose RIEN et ne se
// connecte à aucune administration : elle prépare les chiffres, et les deux pointages qui suivent
// sont des pense-bêtes (règle 5.2.0). Comme partout ici, la RÈGLE vit dans `compta.js`.
ipcMain.handle('cab:declaration', (_e, { dossierId, annee, periode } = {}) => {
  requireOpen();
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const d = KC.declarationMensuelle(o.livre, periode);
  if (!d.ok) throw erreur('ERR-CAB-042', d.motif);
  // Celle qui est ENREGISTRÉE, si elle existe : c'est elle qui porte les pointages et l'écriture.
  const posee = (o.livre.declarations || []).find(x => x.periode === periode) || null;
  return { ...d, posee };
});

ipcMain.handle('cab:poserDeclaration', (_e, { dossierId, annee, periode } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const d = KC.declarationMensuelle(o.livre, periode);
  if (!d.ok) throw erreur('ERR-CAB-042', d.motif);
  const r = KC.poserDeclaration(o.livre, d, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-042', r.motif);
  ecrireLeLivre(dossierId, o.livre, null);
  return { ok: true, declaration: r.declaration, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:pointerDeclaration', (_e, { dossierId, annee, periode, quoi, valeur } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.pointerDeclaration(o.livre, periode, quoi, valeur, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-042', r.motif);
  ecrireLeLivre(dossierId, o.livre, null);
  return { ok: true, declaration: r.declaration, aussiPayee: !!r.aussiPayee, livre: ouvrirLivre(dossierId, annee).livre };
});

// L'écriture de déclaration entre en BROUILLARD, comme tout ce qui est proposé : c'est le comptable
// qui la valide, et c'est à ce moment-là qu'elle prend son numéro.
ipcMain.handle('cab:ecrireDeclaration', (_e, { dossierId, annee, periode } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const posee = (o.livre.declarations || []).find(x => x.periode === periode);
  if (!posee) throw erreur('ERR-CAB-042', 'Prépare la déclaration avant d\'en écrire l\'écriture.');
  const d = KC.declarationMensuelle(o.livre, periode);
  // Déjà passée — la nôtre, ou celle que le client avait dans ses propres livres, reconnue à sa
  // FORME et non à son libellé. La repasser compterait la TVA du mois deux fois.
  if (d.ecritureExistante) {
    throw erreur('ERR-CAB-042', 'L\'écriture de cette déclaration existe déjà dans le livre : la repasser compterait la TVA du mois deux fois.');
  }
  const brouillon = KC.ecritureDeclaration(o.livre, d);
  if (!brouillon.lignes.length) throw erreur('ERR-CAB-042', 'Ce mois ne porte aucune TVA : il n\'y a pas d\'écriture à passer.');
  const e = KC.ajouterEcriture(o.livre, brouillon, quiSuisJe(), Date.now());
  posee.ecritureId = e.id;
  ecrireLeLivre(dossierId, o.livre, 'écriture de déclaration', periode);
  return { ok: true, id: e.id, livre: ouvrirLivre(dossierId, annee).livre };
});

// ================================================ LES IMMOBILISATIONS ET L'INVENTAIRE (9.7.0)
//
// Le cabinet tient les fiches de biens de ses dossiers — surtout ceux qui n'ont PAS SkanFact, car
// eux n'ont aucune application qui les leur calcule. Le calcul vient de `compta.js`, partagé avec
// l'app entreprise : recopier le moteur donnerait deux plans d'amortissement pour un seul bien.
//
// Rien n'est jamais créé d'office. Une durée d'amortissement est une décision (règle 3.5.0), et
// une écriture de dotation passe en BROUILLARD comme tout ce que l'application propose.

const livreOuErreur = (dossierId, annee) => {
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  return o.livre;
};

ipcMain.handle('cab:immobilisations', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  const livre = livreOuErreur(dossierId, annee);
  return {
    etat: KC.etatImmobilisations(livre, annee),
    aCreer: KC.immobilisationsACreer(livre, annee),
    aEcrire: KC.ecrituresImmobilisations(livre, annee),
    fiches: livre.immobilisations || []
  };
});

ipcMain.handle('cab:saveImmobilisation', (_e, { dossierId, annee, fiche } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const livre = livreOuErreur(dossierId, annee);
  const qui = quiSuisJe();
  const r = fiche && fiche.id && (livre.immobilisations || []).some(x => x.id === fiche.id)
    ? KC.modifierImmobilisation(livre, fiche.id, fiche, qui, Date.now())
    : KC.ajouterImmobilisation(livre, fiche, qui, Date.now());
  if (!r.ok) throw erreur('ERR-CAB-043', r.motif);
  ecrireLeLivre(dossierId, livre, 'immobilisation', r.fiche.libelle);
  return { ok: true, fiche: r.fiche, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:supprimerImmobilisation', (_e, { dossierId, annee, id } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const livre = livreOuErreur(dossierId, annee);
  const r = KC.supprimerImmobilisation(livre, id, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-044', r.motif);
  ecrireLeLivre(dossierId, livre, 'immobilisation supprimée', id);
  return { ok: true, livre: ouvrirLivre(dossierId, annee).livre };
});

// Les écritures d'inventaire des biens : dotations, reprises de subvention, sorties d'actif.
// Elles arrivent en BROUILLARD, et chaque ligne de plan retient l'écriture qui la porte — c'est ce
// qui empêche de passer deux fois la même dotation.
ipcMain.handle('cab:ecrireDotations', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const livre = livreOuErreur(dossierId, annee);
  const props = KC.ecrituresImmobilisations(livre, annee);
  if (!props.length) throw erreur('ERR-CAB-045', 'Rien à passer : aucune dotation ni sortie en attente sur cet exercice.');
  const qui = quiSuisJe();
  const ids = [];
  props.forEach(p => {
    const e = KC.ajouterEcriture(livre, p, qui, Date.now());
    ids.push(e.id);
    if (p.genre !== 'subvention') KC.noterEcritureImmo(livre, p.immoId, annee, e.id);
  });
  ecrireLeLivre(dossierId, livre, 'écritures d\'inventaire', String(annee));
  return { ok: true, ids, livre: ouvrirLivre(dossierId, annee).livre };
});

// ---------- la paie d'un dossier (10.3.0) ----------
// Un cabinet a soixante clients dont deux utilisent SkanFact : pour les cinquante-huit autres — ceux
// qui PAIENT — il n'existait aucun moyen de tenir la paie. Le comptable établissait les bulletins
// ailleurs et retapait l'écriture à la main.
//
// Tout passe par `ecrireLeLivre`, la porte unique (9.2.0) : verrou, écriture et piste d'audit dans
// le même mouvement. Deux portes, c'est la garantie qu'un jour l'une oubliera l'audit.
ipcMain.handle('cab:paie', (_e, { dossierId, annee, mois } = {}) => {
  requireOpen();
  const livre = livreOuErreur(dossierId, annee);
  const m = Number(mois) || 1;
  const bulletins = KC.bulletinsDuMois(livre, annee, m);
  return {
    salaries: livre.salaries || [],
    bulletins,
    masse: KC.masseSalariale(bulletins),
    annee: KC.masseSalariale((livre.bulletins || []).filter(b => Number(b.annee) === Number(annee))),
    controles: KC.controlesPaie(livre, annee, m),
    aEcrire: bulletins.some(b => !b.ecritureId),
    baremes: KC.baremesPaie(dossierDe(dossierId).paie || {})
  };
});

ipcMain.handle('cab:saveSalarie', (_e, { dossierId, annee, salarie } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const livre = livreOuErreur(dossierId, annee);
  const r = KC.ajouterSalarie(livre, salarie, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-078', r.motif);
  ecrireLeLivre(dossierId, livre, 'salarié', r.salarie.nom);
  return { ok: true, salarie: r.salarie, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:retirerSalarie', (_e, { dossierId, annee, id } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const livre = livreOuErreur(dossierId, annee);
  const r = KC.retirerSalarie(livre, id, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-078', r.motif);
  ecrireLeLivre(dossierId, livre, 'salarié retiré', id);
  return { ok: true, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:saveBulletin', (_e, { dossierId, annee, bulletin } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const livre = livreOuErreur(dossierId, annee);
  const r = KC.ajouterBulletin(livre, bulletin, dossierDe(dossierId).paie || {}, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-079', r.motif);
  ecrireLeLivre(dossierId, livre, 'bulletin de paie', `${r.bulletin.salarieId} ${r.bulletin.annee}-${r.bulletin.mois}`);
  return { ok: true, bulletin: r.bulletin, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:supprimerBulletin', (_e, { dossierId, annee, id } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const livre = livreOuErreur(dossierId, annee);
  const r = KC.supprimerBulletin(livre, id, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-079', r.motif);
  ecrireLeLivre(dossierId, livre, 'bulletin supprimé', id);
  return { ok: true, livre: ouvrirLivre(dossierId, annee).livre };
});

// L'écriture de paie du mois, en BROUILLARD : elle se relit avant d'être validée. Chaque bulletin
// du lot la porte, sinon le bouton se rallumerait et la paie serait comptée deux fois (9.7.0).
ipcMain.handle('cab:ecrirePaie', (_e, { dossierId, annee, mois } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const livre = livreOuErreur(dossierId, annee);
  const d = dossierDe(dossierId);
  const prop = KC.ecritureDePaie(livre, annee, mois, { comptes: (d.comptesPaie || {}) });
  if (!prop.ok) throw erreur('ERR-CAB-080', prop.motif);
  const e = KC.ajouterEcriture(livre, prop.ecriture, quiSuisJe(), Date.now());
  KC.noterEcriturePaie(livre, prop.lot, e.id, quiSuisJe(), Date.now());
  ecrireLeLivre(dossierId, livre, 'écriture de paie', `${annee}-${String(mois).padStart(2, '0')}`);
  return { ok: true, id: e.id, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:cnss', (_e, { dossierId, annee, trimestre } = {}) => {
  requireOpen();
  const livre = livreOuErreur(dossierId, annee);
  return KC.cnssDuTrimestre(livre, annee, trimestre);
});

ipcMain.handle('cab:inventaire', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  const livre = livreOuErreur(dossierId, annee);
  return {
    inventaire: (livre.inventaires || []).find(x => Number(String(x.date).slice(0, 4)) === Number(annee)) || null,
    variation: KC.variationDeStock(livre, annee)
  };
});

ipcMain.handle('cab:saveInventaire', (_e, { dossierId, annee, inventaire } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const livre = livreOuErreur(dossierId, annee);
  const r = KC.poserInventaire(livre, inventaire, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-046', r.motif);
  ecrireLeLivre(dossierId, livre, 'inventaire de stock', String(annee));
  return { ok: true, inventaire: r.inventaire, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:ecrireVariationStock', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const livre = livreOuErreur(dossierId, annee);
  const v = KC.variationDeStock(livre, annee);
  if (!v.ok) throw erreur('ERR-CAB-046', v.motif);
  if (!v.ecriture) throw erreur('ERR-CAB-047', v.motif || 'Le stock compté est celui des comptes : aucune écriture à passer.');
  const inv = (livre.inventaires || []).find(x => Number(String(x.date).slice(0, 4)) === Number(annee));
  if (inv && inv.ecritureId) throw erreur('ERR-CAB-047', 'La variation de stock de cet exercice est déjà passée : la repasser compterait le stock deux fois.');
  const e = KC.ajouterEcriture(livre, v.ecriture, quiSuisJe(), Date.now());
  if (inv) inv.ecritureId = e.id;
  ecrireLeLivre(dossierId, livre, 'variation de stock', String(annee));
  return { ok: true, id: e.id, livre: ouvrirLivre(dossierId, annee).livre };
});

// ================================================== LA CLÔTURE D'EXERCICE (9.8.0)
//
// Clôturer, c'est arrêter de bouger. Les trois garanties : la clôture est DÉFINITIVE et tracée, une
// réouverture exige un motif, et les contrôles ne bloquent JAMAIS (règle 6.0.0) — un exercice clos
// avec trois manques signalés vaut mieux qu'un exercice jamais clos.
//
// Le fichier de clôture (`.skanclose`) referme la boucle dans l'autre sens : sans lui, le bilan du
// cabinet et celui du client divergent pour toujours, et personne ne s'en aperçoit avant le
// contrôle. Il porte les à-nouveaux officiels, les écritures d'inventaire, et un document lisible
// par n'importe qui — y compris par un client qui ne met jamais son application à jour.

// La clé de SIGNATURE du cabinet. Symétrique de celle du client (9.2.0) : chiffrer dit « seul lui
// peut lire », seule une signature dit « ça vient de lui ». Depuis la 10.13.0 elle est DÉRIVÉE de la
// clé du cabinet (`Z.cleSignatureDerivee`) au lieu d'être tirée par poste : le client retient désormais
// la signature de son cabinet, et deux postes du même cabinet — ou un cabinet qui a changé
// d'ordinateur avec sa clé de secours — doivent signer pareil. Elle ne traverse jamais le pont ; seule
// son empreinte part vers l'écran (`safeState`), pour être lue au client qui la vérifie.
function cleSignatureCabinet() {
  try {
    if (!state || !state.cabinet || !state.cabinet.privateKey) return null;
    return Z.cleSignatureDerivee(state.cabinet.privateKey);
  } catch (e) { logToFile('cle-signature-cabinet', e); return null; }
}

// Le document lisible par n'importe qui. HTML : il s'ouvre dans n'importe quel navigateur, sur
// n'importe quel système, aujourd'hui et dans dix ans — et il s'imprime en PDF de là. Le PDF est
// produit en plus quand Electron peut le faire ; son échec ne fait JAMAIS échouer la clôture
// (règle 6.1.0 : mieux vaut 99 % avec le trou signalé qu'un envoi qui échoue).
function htmlDeCloture(dossier, dos, etats) {
  // 10.10.0 (C-13) — le document qui part chez le client, sous la signature du cabinet, s'écrit
  // comme l'écran : « 76 493,448 DT » et « 31/12/2026 ». Il sortait en « 76 493.448 », sans devise,
  // avec des dates ISO, deux clics après un écran qui écrivait le même chiffre à la française — et
  // le PDF sort de ce même HTML. Le formateur est celui du moteur (`fmtMontant`), pas une copie.
  const m = n => KC.fmtMontant(n, 'DT');
  const j = iso => KC.fmtJour(iso);
  const e = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const groupe = g => `<tr class="g"><th colspan="2">${e(g.titre)}</th><th class="r">${m(g.total)}</th></tr>`
    + g.lignes.map(l => `<tr><td>${e(l.compte)}</td><td>${e(l.libelle)}</td><td class="r">${m(l.montant)}</td></tr>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Clôture ${e(dos.exercice.annee)} — ${e(dossier.name || '')}</title>
<style>
  body{font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1d2530;margin:32px;max-width:820px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:26px 0 8px;border-bottom:1px solid #d9dfe7;padding-bottom:4px}
  .sub{color:#6b7788;margin:0 0 20px}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  td,th{padding:3px 6px;text-align:start;border-bottom:1px solid #eef1f5;font-weight:400}
  .r{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
  tr.g th{background:#f5f7fa;font-weight:600}
  tr.t td,tr.t th{font-weight:700;border-top:2px solid #1d2530;border-bottom:none}
  .note{color:#6b7788;font-size:12px;margin-top:24px;border-top:1px solid #d9dfe7;padding-top:10px}
  /* 10.0.0 — la signature. Des états financiers qui partent chez un client sans dire QUI les a
     établis n'engagent personne : le cadre est laissé vide pour le cachet, parce qu'une signature
     manuscrite reste ce qu'un portail et un contrôleur attendent. */
  .sig{font-size:12px;margin-top:18px;color:#31404f}
  .sigbox{height:70px;border:1px solid #c7d0da;border-radius:6px;margin-top:6px;inline-size:260px}
  @media print{body{margin:0}}
</style></head><body>
<h1>Clôture de l'exercice ${e(dos.exercice.annee)}</h1>
<p class="sub">${e(dossier.name || '')}${dossier.matricule ? ' · ' + e(dossier.matricule) : ''}
  · du ${e(j(dos.exercice.du))} au ${e(j(dos.exercice.au))}${dos.closLe ? ' · close le ' + new Date(dos.closLe).toLocaleDateString('fr-FR') : ''}
  · montants en dinars tunisiens</p>
<h2>Bilan — actif</h2><table>${etats.actif.map(groupe).join('')}
  <tr class="t"><td colspan="2">Total actif</td><td class="r">${m(etats.totalActif)}</td></tr></table>
<h2>Bilan — passif</h2><table>${etats.passif.map(groupe).join('')}
  <tr class="g"><th colspan="2">Résultat de l'exercice</th><th class="r">${m(etats.resultat)}</th></tr>
  <tr class="t"><td colspan="2">Total passif</td><td class="r">${m(etats.totalPassif)}</td></tr></table>
<h2>État de résultat</h2><table>${groupe(etats.produits)}${groupe(etats.charges)}
  <tr class="t"><td colspan="2">Résultat de l'exercice</td><td class="r">${m(etats.resultat)}</td></tr></table>
<h2>À-nouveaux de l'exercice suivant</h2><table>
  <tr class="g"><th>Compte</th><th>Intitulé</th><th class="r">Débit</th><th class="r">Crédit</th></tr>
  ${dos.anouveaux.map(l => `<tr><td>${e(l.compte)}</td><td>${e(l.libelle)}</td><td class="r">${l.debit ? m(l.debit) : ''}</td><td class="r">${l.debit ? '' : m(l.credit)}</td></tr>`).join('')}</table>
<p class="note">Ces états sont <b>déduits de la balance</b>, rubrique par rubrique. La présentation exacte
du système comptable des entreprises est à VÉRIFIER : elle n'est validée par personne dans l'application.
Document produit par SkanFact Cabinet ; les chiffres engagent le cabinet qui l'a émis, pas l'application.</p>
<p class="sig">Établi par ${e((dos.cabinet || '').trim() || 'le cabinet')}${dos.closPar ? ' — ' + e(dos.closPar) : ''}${
  dos.closLe ? ', le ' + e(KC.fmtJour(KC.jourDeLInstant(dos.closLe))) : ''}.<br>
Signature et cachet :</p><div class="sigbox"></div>
</body></html>`;
}

async function pdfDeCloture(html) {
  let w = null;
  try {
    w = new BrowserWindow({ show: false, width: 860, height: 1200, webPreferences: { offscreen: true, javascript: false } });
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const buf = await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
    return buf;
  } catch (e) { logToFile('pdf-cloture', e); return null; }
  finally { if (w && !w.isDestroyed()) w.destroy(); }
}

ipcMain.handle('cab:cloture', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  const livre = livreOuErreur(dossierId, annee);
  const lignes = KC.lignesDuLivre(livre, { du: livre.exercice.du, au: livre.exercice.au });
  const ouv = KC.soldesDepuisOuverture(livre);
  // Le NOM DU COMPTE, jamais le tiers : le plan du dossier d'abord, le plan comptable en repli
  // (T-22). Une rubrique de bilan étiquetée « Facture FAC-2026-014 — Clinique Les Jasmins » pour
  // 32 720 DT de chiffre d'affaires est un document faux qui a l'air juste.
  const libelle = (c) => ((livre.plan || []).find(p => p.compte === c) || {}).libelle || KC.libelleDuPlan(c) || '';
  return {
    exercice: livre.exercice,
    controles: KC.controlesCloture(livre),
    etats: KC.etatsDepuisLignes(lignes, ouv, { libelle }),
    sig: KC.sigDepuisLignes(lignes, ouv, { libelle }),
    anouveaux: KC.anouveauxDe(livre),
    extournes: KC.extournesDe(livre, Number(annee) + 1),
    guides: KC.GUIDES_INVENTAIRE,
    // Ce que ferait « Ouvrir N+1 » maintenant (10.14.0) : le bouton dit ce qu'il fera, et ne mène plus
    // à « déjà validés » en rouge quand il n'y a plus qu'à aller voir l'année d'après.
    suivant: KC.etatExerciceSuivant(livre, ouvrirLivre(dossierId, Number(annee) + 1).livre)
  };
});

ipcMain.handle('cab:cloturer', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'supervision');
  licenceBlockCab('Clôturer un exercice');
  const livre = livreOuErreur(dossierId, annee);
  const r = KC.cloturerExercice(livre, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-060', r.motif);
  ecrireLeLivre(dossierId, livre, 'clôture', String(annee));
  return { ok: true, brouillards: r.brouillards, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:rouvrir', (_e, { dossierId, annee, motif } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'supervision');
  const livre = livreOuErreur(dossierId, annee);
  const r = KC.rouvrirExercice(livre, motif, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-061', r.motif);
  ecrireLeLivre(dossierId, livre, 'réouverture', String(motif || '').slice(0, 120));
  return { ok: true, livre: ouvrirLivre(dossierId, annee).livre };
});

// Ouvrir l'exercice SUIVANT pendant que celui-ci se termine : les à-nouveaux y entrent en
// brouillard, et le comptable continue de saisir janvier sans attendre que décembre soit fini.
// Ils se REFONT tant qu'ils ne sont pas validés — un exercice qui bouge encore change son report.
// 10.14.0 — et le REGISTRE suit : les biens encore détenus et les salariés encore présents. Tout le
// geste vit dans le moteur (`ouvrirExerciceSuivant`), que l'exemple emprunte aussi : il n'existe
// qu'une façon de passer d'un exercice au suivant.
ipcMain.handle('cab:ouvrirSuivant', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'supervision');
  const livre = livreOuErreur(dossierId, annee);
  const suivante = Number(annee) + 1;
  const o = ouvrirLivre(dossierId, suivante);
  const cible = o.livre || KC.livreSuivantVide(livre, dossierId);
  const r = KC.ouvrirExerciceSuivant(livre, cible, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-062', r.motif);
  ecrireLeLivre(dossierId, cible, r.anDejaValides ? 'registre repris' : r.refaits ? 'à-nouveaux refaits' : 'à-nouveaux posés', String(suivante));
  return {
    ok: true, id: r.ecriture ? r.ecriture.id : null, annee: suivante, refaits: r.refaits,
    anDejaValides: r.anDejaValides, biens: r.biens.total, salaries: r.salaries.total, extournes: r.extournes
  };
});

ipcMain.handle('cab:ecrireCloture', async (_e, { dossierId, annee, motDePasse } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'supervision');
  const livre = livreOuErreur(dossierId, annee);
  const d = dossierDe(dossierId);
  const dos = KC.dossierDeCloture(livre);
  dos.matricule = d.matricule || '';
  dos.client = d.name || '';
  dos.cabinet = (state.cabinet && state.cabinet.name) || '';
  if (!dos.anouveaux.length) throw erreur('ERR-CAB-063', 'Cet exercice ne porte aucun à-nouveau : il n\'y aurait rien à envoyer au client.');

  const lignes = KC.lignesDuLivre(livre, { du: livre.exercice.du, au: livre.exercice.au });
  const libelle = (c) => ((livre.plan || []).find(p => p.compte === c) || {}).libelle || KC.libelleDuPlan(c) || '';
  const etats = KC.etatsDepuisLignes(lignes, KC.soldesDepuisOuverture(livre), { libelle });
  const html = htmlDeCloture(d, dos, etats);
  const pdf = await pdfDeCloture(html);

  const clotureBuf = Buffer.from(JSON.stringify(dos, null, 2), 'utf8');
  const fichiers = [
    { name: 'cloture.json', data: clotureBuf },
    { name: 'etats.html', data: Buffer.from(html, 'utf8') }
  ];
  if (pdf) fichiers.push({ name: 'etats.pdf', data: pdf });
  const manifeste = Buffer.from(JSON.stringify({
    format: 1, type: 'skanclose', cabinet: dos.cabinet, client: dos.client, matricule: dos.matricule,
    exercice: dos.exercice, closLe: dos.closLe, produitLe: Date.now(),
    fichiers: fichiers.map(f => ({ nom: f.name, sha256: Z.sha256(f.data) })),
    // Le PDF a pu échouer : on le DIT plutôt que de laisser croire qu'il a été oublié.
    pdf: !!pdf
  }, null, 2), 'utf8');
  fichiers.push({ name: 'manifeste.json', data: manifeste });
  const cle = cleSignatureCabinet();
  if (cle) fichiers.push({ name: 'signature.json', data: Buffer.from(JSON.stringify(Z.signManifest(manifeste, cle.privateKey, cle.publicKey), null, 2), 'utf8') });

  let buf = Z.zipBuffer(fichiers);
  if (motDePasse) buf = Z.sealBuffer(buf, String(motDePasse), { type: 'skanclose', client: dos.client, exercice: dos.exercice.annee });

  const nom = `cloture-${(d.name || 'client').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}-${dos.exercice.annee}.skanclose`;
  const res = await dialog.showSaveDialog({ title: 'Le dossier de clôture pour le client', defaultPath: nom });
  if (res.canceled || !res.filePath) return { ok: false, annule: true };
  fs.writeFileSync(res.filePath, buf);
  // La trace vit dans le LIVRE (T-27) — le moteur la pose et trace, la porte unique écrit.
  KC.noterDossierCloture(livre, { chemin: res.filePath, scelle: !!motDePasse, pdf: !!pdf, signe: !!cle }, quiSuisJe(), Date.now());
  ecrireLeLivre(dossierId, livre, null);
  return { ok: true, path: res.filePath, pdf: !!pdf, signe: !!cle, scelle: !!motDePasse, livre: ouvrirLivre(dossierId, annee).livre };
});

// ================================================ LA LIASSE ET L'ANNUEL (10.0.0)
//
// Le document où une erreur coûte le plus cher. Rien ici n'invente un chiffre : la liasse est
// DÉDUITE de la balance par une table de rubriques entièrement modifiable, le taux d'impôt se
// saisit, et ce qu'aucune rubrique ne capte est MONTRÉ plutôt que perdu en silence.

const modeleLiasseDuCabinet = () => (Array.isArray(state.liasse) && state.liasse.length ? KC.migrerModeleLiasse(state.liasse) : KC.MODELE_LIASSE);

ipcMain.handle('cab:liasse', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  const livre = livreOuErreur(dossierId, annee);
  const lignes = KC.lignesDuLivre(livre, { du: livre.exercice.du, au: livre.exercice.au });
  const libelle = c => ((livre.plan || []).find(p => p.compte === c) || {}).libelle || KC.libelleDuPlan(c) || '';
  const modele = modeleLiasseDuCabinet();
  const ex = livre.exercice;
  return {
    ok: true,
    liasse: KC.liasseDepuisLignes(lignes, KC.soldesDepuisOuverture(livre), { libelle, modele }),
    fiscal: KC.resultatFiscal(
      KC.liasseDepuisLignes(lignes, KC.soldesDepuisOuverture(livre), { libelle, modele }).resultat,
      ex.retraitements || [], { taux: ex.tauxImpot == null ? null : ex.tauxImpot }),
    employeur: KC.employeurAnnuel(livre, {}),
    retraitements: ex.retraitements || [],
    tauxImpot: ex.tauxImpot == null ? null : ex.tauxImpot,
    natures: KC.RETRAITEMENTS,
    modele, etats: KC.LIASSE_ETATS,
    clos: !!ex.clos
  };
});

ipcMain.handle('cab:fiscalAnnuel', (_e, { dossierId, annee, retraitements, tauxImpot } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const livre = livreOuErreur(dossierId, annee);
  if (Array.isArray(retraitements)) {
    const mauvais = retraitements.map(r => KC.retraitementValide(r)).filter(v => !v.ok);
    if (mauvais.length) throw erreur('ERR-CAB-075', mauvais[0].motifs.join(' '));
    livre.exercice.retraitements = retraitements.map(r => ({
      id: String(r.id || ''), nature: String(r.nature || ''), libelle: String(r.libelle || '').slice(0, 200),
      montant: Number(r.montant) || 0
    }));
  }
  // Le taux se SAISIT, et `null` (le champ vide) est une valeur légitime : c'est elle qui fait
  // écrire « — » avec sa raison au lieu d'un impôt calculé sur un taux deviné (règle 9.1.1).
  if (tauxImpot !== undefined) {
    const t = String(tauxImpot == null ? '' : tauxImpot).trim();
    if (t === '') livre.exercice.tauxImpot = null;
    else {
      const n = Number(t.replace(',', '.'));
      if (!isFinite(n) || n < 0 || n > 100) throw erreur('ERR-CAB-075', 'Le taux d\'impôt se donne en pourcentage, entre 0 et 100.');
      livre.exercice.tauxImpot = n;
    }
  }
  ecrireLeLivre(dossierId, livre, 'fiscal', `${annee} · résultat fiscal`);
  return { ok: true, livre: ouvrirLivre(dossierId, annee).livre };
});

// Le modèle de liasse vit au niveau du CABINET, comme les guides et les cycles : on l'ajuste une
// fois pour soixante clients. Vide = celui que le moteur propose — et « À VÉRIFIER » est écrit
// partout, parce que la présentation exacte n'est validée par personne.
ipcMain.handle('cab:saveLiasse', (_e, { modele } = {}) => {
  requireOpen();
  if (Array.isArray(modele)) {
    state.liasse = modele.map(r => ({
      id: String(r.id || '').trim(), etat: String(r.etat || '').trim(),
      label: String(r.label || '').trim(),
      comptes: (Array.isArray(r.comptes) ? r.comptes : []).map(c => String(c).trim()).filter(Boolean),
      signe: Number(r.signe) === -1 ? -1 : 1,
      deduit: !!r.deduit, charge: !!r.charge, resultat: !!r.resultat, deuxSens: !!r.deuxSens
    })).filter(r => r.id && r.label && KC.LIASSE_ETATS.some(e => e.id === r.etat));
  }
  // L'écran fait `S = await api.…` : le handler rend l'ÉTAT, comme tous ceux qui enregistrent
  // (`save()`). Un `{ ok, state }` y devenait l'état entier — sans `cabinet` —, et le rendu suivant
  // tombait sur `S.cabinet.name` : plus aucune page ne s'ouvrait (10.14.0, trouvé par e2e:cabinet-visites).
  return save();
});

// ============================================ LA RÉVISION ET LES QUESTIONS (9.10.0)
//
// Le dossier de travail du comptable, et le SEUL mécanisme du projet qui remonte du cabinet vers
// le client. Il ne remonte pas une écriture : il remonte une QUESTION. Le cabinet n'écrit jamais
// chez un client (Cabinet 1.0.0), et rien de ce qui part d'ici ne touche à ses chiffres.
//
// Tout passe par `ecrireLeLivre` — la porte unique (9.2.0) — donc par le verrou, la révision et la
// piste d'audit. Aucun handler n'appelle `getStore().ecrireLivre` directement.

ipcMain.handle('cab:revision', (_e, { dossierId, annee, periode } = {}) => {
  requireOpen();
  const livre = livreOuErreur(dossierId, annee);
  const o = { periode: periode || String(annee), cycles: cyclesDuCabinet() };
  return {
    ok: true,
    dossier: KC.dossierDeRevision(livre, o),
    controles: KC.controlesRevision(livre, o.periode, o),
    questions: livre.questions || [],
    modeles: (state.questionnaire || []).slice(),
    cycles: cyclesDuCabinet()
  };
});

// Les cycles PROPOSENT (5.0.0, 8.3.0). Un cabinet qui range son 47 ailleurs le range ailleurs, et
// la table du cabinet remplace alors celle du moteur — jamais une fusion des deux, qui donnerait
// un rattachement que personne n'a décidé.
const cyclesDuCabinet = () => (Array.isArray(state.cycles) && state.cycles.length ? state.cycles : KC.CYCLES_REVISION);

ipcMain.handle('cab:signerCompte', (_e, { dossierId, annee, periode, compte, revu, note } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const livre = livreOuErreur(dossierId, annee);
  const r = KC.signerCompte(livre, periode || String(annee), compte, quiSuisJe(), Date.now(), { revu, note });
  if (!r.ok) throw erreur('ERR-CAB-073', r.motif);
  ecrireLeLivre(dossierId, livre, 'révision', `${periode || annee} · ${compte} ${r.revu ? 'signé' : 'dé-signé'}`);
  return { ok: true, revu: r.revu, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:noteRevue', (_e, { dossierId, annee, periode, note, id, levee } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const livre = livreOuErreur(dossierId, annee);
  const p = periode || String(annee);
  const r = id ? KC.leverNoteRevue(livre, p, id, quiSuisJe(), Date.now(), levee)
    : KC.ajouterNoteRevue(livre, p, note, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-073', r.motif);
  ecrireLeLivre(dossierId, livre, 'révision', `${p} · note de revue`);
  return { ok: true, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:questionnaire', (_e, { dossierId, annee, periode, poser, id, reponse } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const livre = livreOuErreur(dossierId, annee);
  const p = periode || String(annee);
  const r = poser
    ? KC.poserQuestionnaire(livre, p, state.questionnaire || [], quiSuisJe(), Date.now())
    : KC.repondreQuestionnaire(livre, p, id, reponse, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-073', r.motif);
  ecrireLeLivre(dossierId, livre, 'révision', `${p} · questionnaire`);
  return { ok: true, poses: r.poses || 0, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:arreterRevision', (_e, { dossierId, annee, periode, faite } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const livre = livreOuErreur(dossierId, annee);
  const p = periode || String(annee);
  const r = KC.arreterRevision(livre, p, quiSuisJe(), Date.now(), { faite, cycles: cyclesDuCabinet() });
  ecrireLeLivre(dossierId, livre, 'révision', `${p} · ${r.faite ? 'arrêtée' : 'rouverte'}`);
  return { ok: true, faite: r.faite, controles: r.controles, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:question', (_e, { dossierId, annee, question, id, geste, champs } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const livre = livreOuErreur(dossierId, annee);
  const qui = quiSuisJe();
  let r;
  if (geste === 'modifier') r = KC.modifierQuestion(livre, id, champs, qui, Date.now());
  else if (geste === 'supprimer') r = KC.supprimerQuestion(livre, id, qui, Date.now());
  else if (geste === 'fermer') r = KC.fermerQuestion(livre, id, qui, Date.now(), false);
  else if (geste === 'rouvrir') r = KC.fermerQuestion(livre, id, qui, Date.now(), true);
  else r = KC.ajouterQuestion(livre, { ...(question || {}), cycles: cyclesDuCabinet() }, qui, Date.now());
  if (!r.ok) throw erreur('ERR-CAB-074', (r.motifs || []).join(' '));
  ecrireLeLivre(dossierId, livre, 'question', geste || 'posée');
  return { ok: true, livre: ouvrirLivre(dossierId, annee).livre };
});

// Le fichier de questions (`.skanask`, SPEC-FMT-006). Même construction que `.skanclose` (9.8.0) —
// un ZIP ordinaire, un manifeste qui porte l'empreinte de chaque fichier, une signature Ed25519 du
// cabinet quand il en a une, et un scellement par mot de passe si on le demande. Le client doit
// pouvoir l'ouvrir avec le Finder même si SkanFact disparaît (règle 6.1.0).
ipcMain.handle('cab:ecrireQuestions', async (_e, { dossierId, annee, motDePasse } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const livre = livreOuErreur(dossierId, annee);
  const d = dossierDe(dossierId);
  const quand = Date.now();
  const dos = KC.dossierDeQuestions(livre, {
    cabinet: (state.cabinet && state.cabinet.name) || '', matricule: d.matricule || '', quand
  });
  if (!dos.questions.length) throw erreur('ERR-CAB-074', 'Aucune question n\'attend de réponse : il n\'y aurait rien à envoyer.');

  const fichiers = [{ name: 'questions.json', data: Buffer.from(JSON.stringify(dos, null, 2), 'utf8') }];
  const manifeste = Buffer.from(JSON.stringify({
    format: 1, type: 'skanask', cabinet: dos.cabinet, client: d.name || '', matricule: dos.matricule,
    exercice: dos.exercice, questions: dos.questions.length, produitLe: quand,
    fichiers: fichiers.map(f => ({ nom: f.name, sha256: Z.sha256(f.data) }))
  }, null, 2), 'utf8');
  fichiers.push({ name: 'manifeste.json', data: manifeste });
  const cle = cleSignatureCabinet();
  if (cle) fichiers.push({ name: 'signature.json', data: Buffer.from(JSON.stringify(Z.signManifest(manifeste, cle.privateKey, cle.publicKey), null, 2), 'utf8') });

  let buf = Z.zipBuffer(fichiers);
  if (motDePasse) buf = Z.sealBuffer(buf, String(motDePasse), { type: 'skanask', client: d.name || '', exercice: dos.exercice });

  const nom = `questions-${(d.name || 'client').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}-${dos.exercice}.skanask`;
  const res = await dialog.showSaveDialog({ title: 'Les questions pour le client', defaultPath: nom });
  if (res.canceled || !res.filePath) return { ok: false, annule: true };
  fs.writeFileSync(res.filePath, buf);
  // L'envoi se note APRÈS l'écriture : une question comptée comme partie sur un fichier qu'on n'a
  // pas su écrire ferait croire au client qu'il l'a déjà vue (règle des deux paquets).
  KC.noterEnvoiQuestions(livre, dos.questions.map(q => q.id), quand);
  ecrireLeLivre(dossierId, livre, 'question', `${dos.questions.length} envoyées`);
  return { ok: true, path: res.filePath, envoyees: dos.questions.length, signe: !!cle, scelle: !!motDePasse, livre: ouvrirLivre(dossierId, annee).livre };
});

// Les modèles de questionnaire vivent au NIVEAU DU CABINET, comme les guides de saisie (9.3.0) :
// on les écrit une fois pour soixante clients. Ils partent VIDES — les cinq questions les plus
// fréquentes du pilote ne sont pas connues, et les inventer serait écrire sa méthode à sa place.
ipcMain.handle('cab:saveQuestionnaire', (_e, { modeles, cycles } = {}) => {
  requireOpen();
  if (Array.isArray(modeles)) {
    state.questionnaire = modeles.map(m => String(m && m.question != null ? m.question : m).trim())
      .filter(Boolean).slice(0, 60).map(question => ({ question }));
  }
  if (Array.isArray(cycles)) {
    state.cycles = cycles.map(c => ({
      id: String(c.id || '').trim(), label: String(c.label || '').trim(),
      prefixes: (Array.isArray(c.prefixes) ? c.prefixes : []).map(p => String(p).trim()).filter(Boolean)
    })).filter(c => c.id && c.label);
  }
  // L'écran fait `S = await api.…` : le handler rend l'ÉTAT, comme tous ceux qui enregistrent
  // (`save()`). Un `{ ok, state }` y devenait l'état entier — sans `cabinet` —, et le rendu suivant
  // tombait sur `S.cabinet.name` : plus aucune page ne s'ouvrait (10.14.0, trouvé par e2e:cabinet-visites).
  return save();
});

// ================================================================ LA LICENCE DU CABINET (9.4.0)
//
// On vend des DOSSIERS, jamais des postes. La porte est posée sur la VALIDATION d'une écriture, et
// sur elle seule : lire, importer un paquet, exporter des écritures, relancer un client restent
// ouverts quoi qu'il arrive. Jamais de données en otage (règle 6.4.0) — et ici ce sont les pièces
// de soixante entreprises qui dorment dans cette application.
//
// Le sujet de la clé est l'EMPREINTE du cabinet : elle survit au changement d'ordinateur (6.8.1),
// et c'est celle que le comptable dicte déjà à ses clients.
const L = require('../licence.js');

const CLES_CABINET = () => [
  path.join(__dirname, '..', '..', 'build', 'licences-publiques.json'),
  path.join(__dirname, '..', '..', 'build', 'licence-public.json')
];
function clesCabinet() {
  // `SKANFACT_CLE_EMBARQUEE` n'est honoré qu'en DÉVELOPPEMENT (règle 8.0.0) : une application
  // installée lit toujours sa propre clé, quoi que dise l'environnement.
  if (!app.isPackaged && process.env.SKANFACT_CLE_EMBARQUEE) {
    return lireJson(process.env.SKANFACT_CLE_EMBARQUEE) || '';
  }
  for (const f of CLES_CABINET()) { const j = lireJson(f); if (j) return j; }
  return '';
}
function lireJson(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

// L'empreinte du cabinet. Elle n'est PAS rangée dans l'état : elle se CALCULE à partir de la clé
// publique, et `safeState()` l'ajoute pour l'écran. Lire `state.cabinet.fingerprint` rend donc
// `undefined` côté processus principal — et une empreinte vide désarme la comparaison, si bien que
// la licence d'un AUTRE cabinet passait. C'est le parcours réel qui l'a montré ; aucun test pur ne
// pouvait le voir, puisque le moteur, lui, rendait le bon verdict.
const empreinteDuCabinet = () => (state.cabinet && state.cabinet.publicKey) ? Z.keyFingerprint(state.cabinet.publicKey) : '';

// Ce que le cabinet doit : le comptage est PUR (`cabcore.comptageDossiers`), la décision aussi
// (`licence.licenceCabinet`). Ce fichier ne fait que les mettre l'un devant l'autre.
// Le chemin que la pastille donne quand la validation est fermée. La phrase vit dans `licence.js`,
// partagée avec SkanFact où elle dit « Paramètres → L'application → Licence » — un chemin qui
// n'existe PAS ici : le Cabinet a des Réglages, et sa licence vit dans « Mon cabinet ». La barre
// latérale d'un cabinet de quatre clients hors SkanFact envoyait chercher un onglet introuvable
// (vu au test humain de la 10.14.0). Un test confronte ce chemin aux onglets et aux panneaux réels.
const CHEMIN_LICENCE = 'Réglages → Mon cabinet → Licence';
function licenceCabinetStatus() {
  const compte = K.comptageDossiers(state, L.today());
  const lic = (state && state.licence) || {};
  const etat = L.licenceCabinet({
    key: lic.key || '', cles: clesCabinet(), empreinte: empreinteDuCabinet(),
    comptes: compte.comptes, today: L.today()
  });
  // Le jumeau de `licenceStatus` de l'app entreprise (10.9.2) : l'empreinte de la clé se pose à la
  // sortie unique, dérivée et jamais rangée. C'est elle que la page publique de vérification
  // demande — et sans elle, le comptable n'avait aucun moyen de l'obtenir (règle 7.3.0).
  return { ...etat, comptage: compte, pastille: L.pastille(etat, CHEMIN_LICENCE),
    empreinte: lic.key ? L.empreinteCle(lic.key) : '' };
}

ipcMain.handle('licence:status', () => { requireOpen(); return licenceCabinetStatus(); });

// On REFUSE d'enregistrer une clé qui ne vaut rien ici, plutôt que de la ranger et de laisser le
// comptable croire qu'il est en règle (règle 6.4.0). Et le refus dit POUR QUI la clé a été émise :
// « invalide » tout court n'aide personne à comprendre ce qu'il vient de coller.
ipcMain.handle('licence:set', (_e, key) => {
  requireOpen();
  const k = String(key || '').trim();
  if (!k) {
    state.licence = null;
    save();
    return licenceCabinetStatus();
  }
  const essai = L.licenceCabinet({
    key: k, cles: clesCabinet(), empreinte: empreinteDuCabinet(),
    comptes: K.comptageDossiers(state, L.today()).comptes, today: L.today()
  });
  if (essai.state === 'invalide' || essai.state === 'autre') {
    throw erreur('ERR-CAB-050', essai.detail || essai.label);
  }
  state.licence = { key: k, poseeLe: new Date().toISOString() };
  save();
  return licenceCabinetStatus();
});

ipcMain.handle('licence:requestMail', () => {
  requireOpen();
  // VERSION, jamais app.getVersion() : en développement, celle-ci rend la version d'ELECTRON
  // (« 44.4.1 »), que la demande de licence porterait à l'éditeur (10.12.0).
  return L.requestMailCabinet(state.cabinet || {}, licenceCabinetStatus(), VERSION);
});

// La porte UNIQUE. Elle est appelée par les quatre gestes qui valident une écriture, et par eux
// seuls — un test relit la source et l'exige. La poser ailleurs (sur la lecture, sur l'import)
// mettrait des données en otage.
function licenceBlockCab(quoi) {
  const etat = licenceCabinetStatus();
  if (!etat.locked) return null;
  const e = erreur('ERR-CAB-051',
    `${quoi} demande une licence : ${etat.comptage.comptes} dossiers hors SkanFact sont comptés, `
    + `et ${etat.autorises} ${etat.autorises === 1 ? 'est couvert' : 'sont couverts'}. `
    + 'Tout le reste — lire, importer un paquet, exporter tes écritures, relancer tes clients — reste ouvert. '
    + 'Réglages → Mon cabinet → Licence : tu y verras exactement quels dossiers sont comptés, et pourquoi.');
  e.licence = etat;
  throw e;
}

// ================================================ s'annoncer au plan de contrôle (10.4.0)
//
// Jusqu'ici, seule l'app entreprise s'annonçait : la console voyait UNE des deux applications, et
// l'éditeur ne savait rien du parc des comptables — ni combien de postes tournent, ni sur quelle
// version, ni depuis quand une installation ne s'est plus montrée. Un éditeur qui ne voit qu'une
// moitié de son parc ne la contrôle pas, il la découvre.
//
// Ce qui part est écrit en toutes lettres, et un test le compte : la clé, l'identité du poste, le
// système, la version, et le nom de l'application. **Rien d'autre** — jamais un dossier, jamais un
// client, jamais un chiffre. L'app du comptable détient la comptabilité de dizaines d'entreprises :
// c'est ce test qui doit arrêter quiconque voudra « juste ajouter » un compteur de dossiers.
//
// Tout est facultatif : sans adresse et sans secret, rien ne part et rien ne s'affiche (règle 1 du
// § 8 de PLAN-PLATEFORME.md). Et rien ne REVIENT qui restreigne quoi que ce soit ici : la licence
// du cabinet est vérifiée sur le poste, hors ligne, contre la clé publique embarquée.
const PLATEFORME_DEBUT = 20 * 1000;
const plateformeBase = () => String(
  (!app.isPackaged && process.env.SKANFACT_PLATEFORME_BASE !== undefined)
    ? process.env.SKANFACT_PLATEFORME_BASE : (PKG.plateformeBase || '')
).trim().replace(/\/+$/, '');
const plateformeSecret = () => String(
  (!app.isPackaged && process.env.SKANFACT_PLATEFORME_SECRET !== undefined)
    ? process.env.SKANFACT_PLATEFORME_SECRET : (PKG.plateformeSecret || '')
).trim();

// L'identité du POSTE, pas celle du cabinet : elle vit dans `app-config.json` (jamais dans l'état
// chiffré, qui voyage par la copie externe — deux postes partageraient alors une seule identité).
function identitePoste() {
  const cfg = readAppCfg();
  if (!cfg.deviceId) {
    cfg.deviceId = require('crypto').randomUUID();
    try { cfg.deviceName = cfg.deviceName || require('os').hostname().replace(/\.local$/, ''); }
    catch { cfg.deviceName = 'Cet ordinateur'; }
    writeAppCfg(cfg);
  }
  return { id: cfg.deviceId, name: cfg.deviceName || 'Cet ordinateur' };
}

// Ne jette jamais : c'est un appel de confort, pas une étape du démarrage. Une panne du plan de
// contrôle n'est pas une panne de l'application — elle va au journal (6.7.2) et rien à l'écran,
// parce qu'il n'y a rien que le comptable puisse faire et qu'un rouge sur une situation normale
// apprend à ignorer les rouges (8.0.1).
async function annoncerPlateforme() {
  const base = plateformeBase(), secret = plateformeSecret();
  if (!base || !secret) return { fait: false, raison: 'plan de contrôle non configuré' };
  const poste = identitePoste();
  const cle = String(((state && state.licence) || {}).key || '').trim();
  let url;
  try { url = new URL(base + '/v1/licence/etat'); } catch { return { fait: false, raison: 'adresse invalide' }; }
  // En clair seulement en développement (le faux serveur des parcours) : la clé de licence voyage
  // dans ce corps de requête.
  if (url.protocol !== 'https:' && app.isPackaged) return { fait: false, raison: 'le plan de contrôle exige https' };
  const donnees = Buffer.from(JSON.stringify({
    cle, deviceId: poste.id, deviceNom: poste.name,
    plateforme: process.platform, version: VERSION, app: 'cabinet'
  }), 'utf8');
  try {
    await new Promise((resolve, reject) => {
      const req = require(url.protocol === 'http:' ? 'http' : 'https').request(url, {
        method: 'POST', timeout: 8000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': donnees.length, 'X-SkanFact-App': secret }
      }, res => { res.resume(); res.on('end', () => (res.statusCode === 200 ? resolve() : reject(new Error('HTTP ' + res.statusCode)))); });
      req.on('timeout', () => req.destroy(new Error('délai dépassé')));
      req.on('error', reject);
      req.end(donnees);
    });
  } catch (e) { logToFile('plan de contrôle', e); return { fait: false, raison: String((e && e.message) || e) }; }
  return { fait: true };
}

let plateformeArmee = false;
function demarrerPlateforme() {
  if (plateformeArmee || !plateformeBase()) return;
  plateformeArmee = true;
  // Même cadence que la vérification de mise à jour, et pour la même raison : l'application du
  // comptable reste ouverte toute la semaine.
  setTimeout(() => { annoncerPlateforme(); }, PLATEFORME_DEBUT);
  setInterval(() => { annoncerPlateforme(); }, MAJ_INTERVALLE);
}

// La date de la dernière validation, retenue SUR LE DOSSIER. On pourrait la déduire du livre, mais
// il faudrait ouvrir et déchiffrer soixante fichiers à chaque affichage des Réglages — mesuré à
// 1,3 s par `npm run charge`. C'est un confort de comptage, jamais une donnée comptable.
function noterValidation(dossierId) {
  const d = (state.dossiers || []).find(x => x.id === dossierId);
  if (!d) return;
  const t = L.today();
  if (d.derniereValidation === t) return;
  d.derniereValidation = t;
  save();
}

// ================================================================ LA SAISIE (9.3.0)
//
// Les gestes de la grille. Tous passent par `ecrireLeLivre` — la porte unique — et tous délèguent
// la RÈGLE à `compta.js` : ce fichier ouvre, applique, referme et trace. Il ne décide rien.
//
// La trace est ici et nulle part ailleurs : `compta.js` ne trace pas ces gestes exprès, pour que la
// piste d'audit ne s'écrive jamais en double.

ipcMain.handle('cab:modifierEcriture', (_e, { dossierId, annee, id, patch } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.modifierEcriture(o.livre, id, patch);
  if (!r.ok) throw erreur('ERR-CAB-025', r.motif);
  ecrireLeLivre(dossierId, o.livre, 'modification', `${r.ecriture.journal} ${r.ecriture.piece || '(sans pièce)'}`);
  return { ok: true, id: r.ecriture.id, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:supprimerEcriture', (_e, { dossierId, annee, id } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.supprimerEcriture(o.livre, id);
  if (!r.ok) throw erreur('ERR-CAB-025', r.motif);
  ecrireLeLivre(dossierId, o.livre, 'suppression-brouillard', `${r.ecriture.journal} ${r.ecriture.piece || '(sans pièce)'} du ${r.ecriture.date}`);
  return { ok: true, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:extourner', (_e, { dossierId, annee, id } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  licenceBlockCab('Extourner une écriture');
  const r = KC.extourner(o.livre, id, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-025', r.motif);
  ecrireLeLivre(dossierId, o.livre, null);
  noterValidation(dossierId);
  return { ok: true, numero: r.ecriture.numero, date: r.ecriture.date, livre: ouvrirLivre(dossierId, annee).livre };
});

// 10.10.0 (C-06) — prévoir l'extourne d'une écriture de décembre : elle se posera à l'ouverture
// de l'exercice suivant. Un drapeau, aucun chiffre — mais un geste sur une validée : il demande le
// droit de valider, et il se trace.
ipcMain.handle('cab:prevoirExtourne', (_e, { dossierId, annee, id } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const r = KC.prevoirExtourne(o.livre, id, quiSuisJe(), Date.now());
  if (!r.ok) throw erreur('ERR-CAB-025', r.motif);
  ecrireLeLivre(dossierId, o.livre, null);
  const suivant = ouvrirLivre(dossierId, r.annee);
  // Ce que ferait « Ouvrir N+1 » maintenant : la question qui suit ne propose pas de « refaire » des
  // à-nouveaux validés — seule l'extourne peut encore entrer (10.14.0).
  return { ok: true, date: r.date, annee: r.annee, suivantOuvert: !!suivant.livre,
    suivantEtat: suivant.livre ? KC.etatExerciceSuivant(o.livre, suivant.livre).etat : null,
    livre: ouvrirLivre(dossierId, annee).livre };
});

// Valider un lot. Il n'échoue JAMAIS en bloc : ce qui passe est validé, ce qui ne passe pas est
// nommé. Un lot tout-ou-rien obligerait à ressortir la pièce fautive d'un mois de saisie avant de
// pouvoir valider les cinquante autres — et le comptable finirait par ne plus valider du tout.
ipcMain.handle('cab:validerLot', (_e, { dossierId, annee, journal, mois, ids } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  licenceBlockCab('Valider un lot d\'écritures');
  const r = KC.validerLot(o.livre, { journal, mois, ids }, quiSuisJe(), Date.now());
  ecrireLeLivre(dossierId, o.livre, 'validation-lot',
    `${journal || 'tous journaux'} ${mois || ''} — ${r.validees.length} validée(s), ${r.refusees.length} refusée(s)`);
  if (r.validees.length) noterValidation(dossierId);
  return { ...r, livre: ouvrirLivre(dossierId, annee).livre };
});

// Le justificatif. Le fichier est COPIÉ dans le dossier du client : le chemin d'origine aura disparu
// bien avant l'écriture qu'il justifie.
ipcMain.handle('cab:joindreEcriture', async (_e, { dossierId, annee, id, chemin } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const f = chemin || (await dialog.showOpenDialog({
    title: 'Joindre un justificatif',
    filters: [{ name: 'Justificatifs', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'webp', 'csv', 'xlsx', 'txt'] }],
    properties: ['openFile']
  })).filePaths[0];
  if (!f) return { annule: true };
  const d = dossierDe(dossierId);
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const e = (o.livre.ecritures || []).find(x => x.id === id);
  if (!e) throw erreur('ERR-CAB-009', 'Cette écriture n\'existe pas.');
  const range = getStore().rangerPieceJointe(f, d, state.dossiers, `${e.date || ''}-${e.piece || 'piece'}`);
  // Une VALIDÉE peut recevoir son justificatif : joindre un scan ne change aucun chiffre, et
  // refuser reviendrait à dire « ta pièce restera sans justificatif pour toujours ». C'est le seul
  // champ d'une validée qui bouge, et l'audit le nomme.
  e.pieceJointe = range.relatif;
  ecrireLeLivre(dossierId, o.livre, 'justificatif', `${e.journal} ${e.piece || '(sans pièce)'} → ${range.relatif}`);
  return { ok: true, pieceJointe: range.relatif, livre: ouvrirLivre(dossierId, annee).livre };
});

ipcMain.handle('cab:ouvrirJustificatif', (_e, { dossierId, relatif } = {}) => {
  requireOpen();
  const p = getStore().cheminPieceJointe(dossierDe(dossierId), state.dossiers, relatif);
  if (!p) throw erreur('ERR-CAB-029', 'Ce justificatif n\'est plus sur le disque. Il a peut-être été rangé ailleurs, ou le dossier a changé de nom.');
  shell.openPath(p);
  return { ok: true };
});

// ---------------------------------------------------------------- les collaborateurs (9.9.0)
//
// La liste vit dans l'état CHIFFRÉ du cabinet : elle voyage donc avec la clé de secours et avec la
// copie externe, comme la licence. L'identité du poste, elle, vit dans `app-config.json` — deux
// postes partagent la liste et doivent pouvoir être deux personnes différentes.

ipcMain.handle('cab:collaborateurs', () => {
  requireOpen();
  return {
    liste: state.collaborateurs || [],
    moi: moiId(),
    // Qui a le droit de toucher à cette liste, et pourquoi : l'écran doit pouvoir éteindre son
    // bouton EN DISANT POURQUOI, par la même fonction que celle qui refusera (règle 9.4.5).
    gestion: K.peutGererCollaborateurs(state, moiId())
  };
});

ipcMain.handle('cab:saveCollaborateur', (_e, { id, nom, role, poste } = {}) => {
  requireOpen();
  const g = K.peutGererCollaborateurs(state, moiId());
  if (!g.ok) throw erreur('ERR-CAB-071', `${g.motif} ${g.geste}`);
  const v = K.collaborateurValide(state, { nom, role }, id);
  if (!v.ok) throw erreur('ERR-CAB-071', v.motif);
  state.collaborateurs = state.collaborateurs || [];
  const existant = state.collaborateurs.find(c => c.id === id);
  if (existant) Object.assign(existant, { nom: v.nom, role, poste: String(poste || existant.poste || '') });
  else {
    // Le TOUT PREMIER collaborateur d'un cabinet est celui qui est en train de le déclarer : ce
    // poste devient le sien. Sans ça, quelqu'un qui se déclare « Supervision » en premier ferme la
    // porte derrière lui — le poste n'est plus personne, un superviseur existe désormais, et plus
    // aucun bouton ne permet d'ajouter le second. C'est très exactement « un réglage qui accepte
    // un clic et se retire ensuite la possibilité de revenir en arrière » (7.12.0), et c'est le
    // parcours à deux postes qui l'a trouvé — aucune relecture ne le voyait.
    //
    // Le PREMIER seulement : ensuite, ajouter quelqu'un ne change plus qui travaille ici. Déclarer
    // un collègue ne doit pas vous faire changer de nom au milieu d'une saisie.
    const premier = !K.collaborateurs(state).length;
    const neuf = K.migrateCollaborateur({
      id: 'c_' + Date.now().toString(36) + '_' + state.collaborateurs.length,
      nom: v.nom, role, poste: String(poste || moiPoste().deviceName || ''), creeLe: Date.now()
    });
    state.collaborateurs.push(neuf);
    if (premier && !moiId()) writeAppCfg({ collaborateurId: neuf.id });
  }
  return save();
});

// Retirer quelqu'un ne l'EFFACE pas : `actif: false`. Sa piste d'audit le nomme sur des écritures
// validées — un nom effacé rendrait illisible la seule chose qu'un contrôle vient lire. C'est la
// même règle que `retiree: true` sur une clé de signature (8.6.0).
ipcMain.handle('cab:retirerCollaborateur', (_e, id) => {
  requireOpen();
  const g = K.peutGererCollaborateurs(state, moiId());
  if (!g.ok) throw erreur('ERR-CAB-071', `${g.motif} ${g.geste}`);
  const c = (state.collaborateurs || []).find(x => x.id === id);
  if (!c) throw erreur('ERR-CAB-071', 'Ce collaborateur n\'existe plus.');
  const sup = K.collaborateurs(state).filter(x => x.role === 'supervision');
  if (c.role === 'supervision' && sup.length === 1) {
    throw erreur('ERR-CAB-071', 'C\'est le seul superviseur du cabinet : le retirer fermerait la porte de l\'intérieur. '
      + 'Donne d\'abord le rôle « Supervision » à quelqu\'un d\'autre.');
  }
  c.actif = false;
  if (moiId() === id) writeAppCfg({ collaborateurId: '' });
  return save();
});

// Qui travaille sur CE poste. Aucun mot de passe : l'identité est déclarée, pas prouvée — c'est
// écrit à l'écran, et c'est la vérité (le mot de passe du cabinet ouvre déjà toute la base).
ipcMain.handle('cab:jeSuis', (_e, id) => {
  requireOpen();
  const c = id ? K.collaborateurDe(state, id) : null;
  if (id && !c) throw erreur('ERR-CAB-071', 'Ce collaborateur n\'existe plus.');
  writeAppCfg({ collaborateurId: c ? c.id : '' });
  // Le poste habituel suit : c'est lui qui proposera la bonne identité au prochain démarrage.
  if (c) { c.poste = moiPoste().deviceName || c.poste; save(); }
  return { moi: moiId(), nom: quiSuisJe() };
});

// Les droits SUR UN DOSSIER. Un rôle vide retire le droit posé et rend la personne à son rôle
// général — ce n'est pas la même chose que lui interdire, et l'écran le dit.
ipcMain.handle('cab:saveDroits', (_e, { dossierId, droits } = {}) => {
  requireOpen();
  const g = K.peutGererCollaborateurs(state, moiId());
  if (!g.ok) throw erreur('ERR-CAB-071', `${g.motif} ${g.geste}`);
  const d = dossierDe(dossierId);
  const neuf = {};
  Object.keys(droits || {}).forEach(k => {
    if (K.collaborateurDe(state, k) && K.ROLES_COLLAB.includes(droits[k])) neuf[k] = droits[k];
  });
  d.droits = neuf;
  return save();
});

// ---------------------------------------------------------------- le tableau de production (9.9.0)
//
// Lu dans les INDEX, jamais dans les livres : soixante dossiers font cent quatre-vingts fichiers
// chiffrés, et une grille ne peut pas coûter une minute à dessiner (mesure de la 9.1.0).
ipcMain.handle('cab:production', (_e, opts) => {
  requireOpen();
  const idx = indexDossiers();
  const index = {};
  (state.dossiers || []).forEach(d => { index[d.id] = getStore().lireIndexLivres(d, idx); });
  return {
    lignes: K.production(state, index, opts || {}),
    etapes: K.ETAPES_PRODUCTION,
    collaborateurs: K.collaborateurs(state)
  };
});

// Les index écrits par une version d'avant se relisent UNE fois par ouverture (10.12.0,
// `cabstore.relireIndexAncien`) : sans eux, la CNSS serait réclamée « par prudence » à tous les
// clients le matin de la mise à jour. En rendant la main entre deux dossiers — soixante dossiers ne
// figent pas l'écran —, et la promesse est gardée : deux lectures simultanées n'en font qu'une.
let indexRelus = null;
function relireIndexAnciens() {
  if (indexRelus && indexRelus.pour === state) return indexRelus.fait;
  const pour = state;
  const fait = (async () => {
    const idx = indexDossiers();
    for (const d of (pour && pour.dossiers) || []) {
      if (state !== pour) return;            // le cabinet a été refermé entre-temps
      try { getStore().relireIndexAncien(d, idx); } catch (e) { logToFile('index', e); }
      await new Promise(res => setImmediate(res));
    }
  })();
  indexRelus = { pour, fait };
  return fait;
}

// Les questions sans réponse, résumées dossier par dossier depuis les INDEX (jamais en
// déchiffrant soixante livres — mesure de la 9.1.0). C'est ce que « À faire » compte.
ipcMain.handle('cab:questionsEnAttente', async () => {
  requireOpen();
  await relireIndexAnciens();
  requireOpen();
  const idx = indexDossiers();
  return (state.dossiers || []).filter(d => !d.archived).map(d => {
    const i = getStore().lireIndexLivres(d, idx);
    const q = (i.exercices || []).reduce((s, e) => ({
      ouvertes: s.ouvertes + Number((e.questions || {}).ouvertes || 0),
      aRelancer: s.aRelancer + Number((e.questions || {}).aRelancer || 0),
      repondues: s.repondues + Number((e.questions || {}).repondues || 0)
    }), { ouvertes: 0, aRelancer: 0, repondues: 0 });
    // 10.12.0 (U-21) — et ce que chaque livre sait des salariés, mois par mois, fusionné sur les
    // exercices : le calendrier en tire la CNSS des seuls employeurs (`cabcore.echeances`).
    const employeur = Object.assign({}, ...(i.exercices || []).map(e => (e.employeur && typeof e.employeur === 'object') ? e.employeur : {}));
    // 10.12.0 — un dossier TENU AU CABINET porte aussi ses exercices et leur production : c'est ce
    // qui le fait entrer dans le calendrier des échéances, avec la même fonction que la Production.
    // Et s'il est CLOS (10.14.0) : la découverte montre l'exercice clos du garage de l'exemple, et
    // elle ne peut pas le désigner sans savoir lequel l'est — sans ouvrir un livre pour autant.
    const tenu = d.manual ? { exercices: (i.exercices || []).map(e => ({ annee: e.annee, du: e.du, au: e.au, clos: !!e.clos, production: e.production || {} })) } : null;
    return { dossierId: d.id, name: d.name, ...q, employeur, tenu };
  }).filter(r => r.ouvertes || r.repondues || Object.keys(r.employeur).length || (r.tenu && r.tenu.exercices.length));
});

// ---------------------------------------------------------------- réunir deux postes (9.9.0)
//
// Le cas que la révision ne rattrape pas : deux postes qui n'ont JAMAIS vu le même fichier — une
// clé USB, un dossier réseau coupé, un collaborateur qui a travaillé chez lui. On lit le livre de
// l'autre poste tel qu'il est sur son support et on le réunit au nôtre.
ipcMain.handle('cab:fusionner', async (_e, { dossierId, annee } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'validation');
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Le livre de l\'autre poste',
    properties: ['openFile'],
    filters: [{ name: 'Livre SkanFact', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths[0]) return { annule: true };
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  let autre;
  try { autre = getStore().lireLivreFichier(r.filePaths[0]); }
  catch (e) { throw erreur('ERR-CAB-072', `Ce fichier ne s'ouvre pas avec le mot de passe de ce cabinet : ${e.message}`); }
  if (!autre || !autre.livre) throw erreur('ERR-CAB-072', 'Ce fichier n\'est pas un livre lisible par ce cabinet.');
  const f = KC.fusionnerLivres(o.livre, autre.livre, Date.now());
  if (!f.ok) throw erreur('ERR-CAB-072', f.motif);
  ecrireLeLivre(dossierId, f.livre, 'fusion',
    `${f.rapport.total} écriture(s) reprises, ${f.rapport.aRegarder} à regarder`);
  return { ok: true, rapport: f.rapport, livre: ouvrirLivre(dossierId, annee).livre };
});

// Reprendre un verrou laissé par un poste éteint. Jamais tout seul : l'écran a demandé, en nommant
// le poste et depuis quand (ERR-CAB-022, la moitié « forcer » qui manquait).
ipcMain.handle('cab:reprendreVerrou', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const d = dossierDe(dossierId);
  const v = getStore().poserVerrou(d, annee, moiPoste(), indexDossiers(), { forcer: true });
  getStore().leverVerrou(d, annee, indexDossiers());
  return { ok: true, repris: !!v.repris };
});

// ---------------------------------------------------------------- guides, abonnements, comptes
//
// Rien de tout cela ne vit dans `livre.json` : son format est FIGÉ (SPEC-DATA-005). Les guides et la
// correspondance vivent au niveau du cabinet (un comptable les écrit une fois pour ses soixante
// clients), les abonnements sur le dossier (un loyer appartient à un client).

ipcMain.handle('cab:saveGuides', (_e, { guides, dossierId } = {}) => {
  requireOpen();
  const L = (Array.isArray(guides) ? guides : []);
  const mauvais = L.map((g, i) => ({ i, v: KC.guideValide(g) })).find(x => !x.v.ok);
  if (mauvais) throw erreur('ERR-CAB-024', `Guide « ${L[mauvais.i].nom || mauvais.i + 1} » : ${mauvais.v.motif}`);
  if (dossierId) dossierDe(dossierId).guides = L;
  else state.guides = L;
  return save();
});

ipcMain.handle('cab:saveCorrespondance', (_e, { table, dossierId } = {}) => {
  requireOpen();
  const v = KC.correspondanceValide(table);
  if (!v.ok) { throw Object.assign(erreur('ERR-CAB-024', v.motif), { motifs: v.motifs }); }
  const propre = (Array.isArray(table) ? table : []).filter(r => String(r.de || '').trim() && String(r.vers || '').trim())
    .map(r => ({ de: String(r.de).trim(), vers: String(r.vers).trim(), prefixe: !!r.prefixe }));
  if (dossierId) dossierDe(dossierId).correspondance = propre;
  else state.correspondance = propre;
  return save();
});

ipcMain.handle('cab:saveAbonnements', (_e, { dossierId, abonnements } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const d = dossierDe(dossierId);
  d.abonnements = (Array.isArray(abonnements) ? abonnements : []).map(a => ({
    id: String(a.id || ''), nom: String(a.nom || ''), guideId: String(a.guideId || ''),
    actif: !!a.actif, depuis: String(a.depuis || ''), jusqua: String(a.jusqua || ''),
    tousLesMois: Math.max(1, Number(a.tousLesMois) || 1),
    montant: Number(a.montant) || 0, piece: String(a.piece || ''), libelle: String(a.libelle || ''),
    faites: Array.isArray(a.faites) ? a.faites : []
  }));
  return save();
});

// Générer ce qu'un abonnement doit à ce jour. EN BROUILLARD, toujours : une écriture validée d'office
// engagerait le comptable sur des chiffres que personne n'a regardés. Et rejouer ne double rien —
// `faites` porte les mois déjà générés, comme `importerPaquet` porte les mois déjà reçus.
ipcMain.handle('cab:genererAbonnements', (_e, { dossierId, annee, jusquA } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const d = dossierDe(dossierId);
  const o = ouvrirLivre(dossierId, annee);
  if (!o.livre) throw erreur('ERR-CAB-026', 'Ce dossier n\'a pas de livre pour cet exercice.');
  const guides = K.guidesDuDossier(state, d);
  const bilan = { crees: 0, sansGuide: [], horsExercice: 0, details: [] };
  (d.abonnements || []).forEach(a => {
    const g = guides.find(x => x.id === a.guideId);
    if (!g) { if (a.actif) bilan.sansGuide.push(a.nom || a.id); return; }
    KC.occurrencesAGenerer(a, jusquA || K.today()).forEach(date => {
      if (date < o.livre.exercice.du || date > o.livre.exercice.au) { bilan.horsExercice++; return; }
      const ecr = KC.ecritureDepuisGuide(g, {
        date, journal: g.journal, montant: a.montant,
        piece: a.piece ? `${a.piece}-${date.slice(0, 7)}` : '',
        libelle: a.libelle || a.nom
      });
      const e = KC.ajouterEcriture(o.livre, ecr, quiSuisJe(), Date.now());
      a.faites = (a.faites || []).concat([date.slice(0, 7)]);
      bilan.crees++;
      bilan.details.push({ id: e.id, date, nom: a.nom || g.nom });
    });
  });
  if (bilan.crees) ecrireLeLivre(dossierId, o.livre, 'abonnements', `${bilan.crees} écriture(s) en brouillard`);
  save();
  return { ...bilan, livre: ouvrirLivre(dossierId, annee).livre };
});

// Le dernier journal utilisé sur CE dossier, pour le proposer à l'ouverture de la grille. C'est un
// confort, pas une donnée comptable : il ne part dans aucun export et ne change aucun chiffre.
ipcMain.handle('cab:dernierJournal', (_e, { dossierId, journal } = {}) => {
  requireOpen();
  dossierDe(dossierId).dernierJournal = String(journal || '').toUpperCase().slice(0, 5);
  return save();
});

// Relire les paquets déjà reçus DANS le livre. C'est la migration (MIG-9.2.0-001) et le rattrapage
// quotidien : on rejoue chaque mois par ordre chronologique, et rejouer ne double rien — un mois
// déjà importé remplace ses brouillards et laisse les validées intactes.
ipcMain.handle('cab:relireLesPaquets', (_e, { dossierId, annee } = {}) => {
  requireOpen();
  droitBlock(dossierId, 'saisie');
  const d = dossierDe(dossierId);
  const o = ouvrirLivre(dossierId, annee);
  const livre = o.livre || KC.livreVide(dossierId, annee);
  const bilan = importerPaquetsDans(d, livre, annee);
  ecrireLeLivre(dossierId, livre, 'relecture-paquets', `${bilan.mois} mois, ${bilan.ajoutees} ajoutée(s), ${bilan.ecarts.length} écart(s)`);
  return { ...bilan, livre: ouvrirLivre(dossierId, annee).livre };
});

// La relecture elle-même, SANS écrire : le geste « Créer le livre de ce client » et l'exemple
// (10.12.0, U-10) passent par la même porte — un exemple qui importerait ses paquets autrement
// montrerait un livre que le produit ne sait pas produire.
function importerPaquetsDans(d, livre, annee) {
  const bilan = { mois: 0, ajoutees: 0, remplacees: 0, validees: 0, ecarts: [], illisibles: [], nonValidees: [] };
  (d.packs || []).filter(p => p.path && String(p.month).slice(0, 4) === String(annee))
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .forEach(p => {
      const r = lireEcritures(p);
      if (!r.csv) { bilan.illisibles.push({ mois: p.month, motif: r.motif || 'illisible' }); return; }
      // `entreesDepuisCsv` prend le TEXTE du CSV, pas des lignes déjà découpées : c'est elle qui
      // déduit le séparateur de l'entête. Lui passer un tableau le transformait en chaîne sans
      // entête reconnaissable, et le mois entrait avec zéro écriture — sans erreur, ni ici ni à
      // l'écran. C'est l'e2e qui l'a vu (« 0 écriture ajoutée » sur un paquet qui en a douze).
      const lignes = KC.entreesDepuisCsv(r.csv);
      if (!lignes.entete) { bilan.illisibles.push({ mois: p.month, motif: 'le CSV d\'écritures n\'a pas d\'entête reconnue' }); return; }
      const ecr = KC.piecesDepuisLignes(lignes);
      const res = KC.importerPaquet(livre, p.month, ecr, !!p.definitive, 'import', Date.now());
      bilan.mois++;
      bilan.ajoutees += res.ajoutees; bilan.remplacees += res.remplacees; bilan.validees += res.validees;
      res.ecarts.forEach(x => bilan.ecarts.push({ mois: p.month, ...x }));
      (res.nonValidees || []).forEach(x => bilan.nonValidees.push({ mois: p.month, ...x }));
    });
  return bilan;
}

ipcMain.handle('cab:exportEcritures', async (_e, opts) => {
  requireOpen();
  const plan = K.ecrituresPlan(state, opts);
  if (!plan.packs.length) throw erreur('ERR-CAB-009', 'Aucun paquet sur cette période.');
  const sources = [];
  const illisibles = [];
  for (const p of plan.packs) {
    // La MÊME lecture que celle des livres du dossier : un paquet accepté ici l'est là-bas.
    const r = lireEcritures(p);
    if (r.motif) { illisibles.push(`${p.name} (${p.month}) : ${r.motif}`); continue; }
    sources.push({ name: p.name, matricule: p.matricule, month: p.month, csv: r.csv });
  }
  if (!sources.length) {
    const e = erreur('ERR-CAB-013', 'Aucune écriture lisible sur cette période.' + (illisibles.length ? '\n' + illisibles.join('\n') : ''));
    throw e;
  }
  const out = K.mergeEcritures(sources);
  const periode = plan.mois.length > 1 ? `${plan.mois[0]}_${plan.mois[plan.mois.length - 1]}` : (plan.mois[0] || 'ecritures');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Écritures regroupées',
    defaultPath: path.join(app.getPath('documents'), `ecritures-${CS.slug(state.cabinet.name || 'cabinet')}-${periode}.csv`),
    filters: [{ name: 'Tableau CSV', extensions: ['csv'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, out.csv, 'utf8');
  return { path: filePath, lignes: out.lignes, dossiers: out.dossiers, vides: out.vides, illisibles, mois: plan.mois };
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
  if (!p) throw erreur('ERR-CAB-009', 'Rien à sauvegarder pour l\'instant.');
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
    // Les livres que la sauvegarde rendra — `null` quand elle n'en porte pas (T-35), et l'écran
    // le dit AVANT de restaurer, livres compris (règle 6.8.0).
    livres: getStore().livresDansSauvegarde(p),
    cabinet: (d.cabinet || {}).name || '',
    // Ce que la restauration ferait perdre : ce qu'on a maintenant et que la sauvegarde n'a pas.
    actuels: { dossiers: state.dossiers.length, paquets: state.dossiers.reduce((s, x) => s + (x.packs || []).length, 0), livres: getStore().compterLivres() }
  };
});

ipcMain.handle('cab:restore', (_e, { path: p, password } = {}) => {
  requireOpen();
  const plain = getStore().restore(p, password);
  state = K.migrate(plain);
  getStore().reorganize(state);
  getStore().write(state);
  // Les livres viennent d'être réécrits sur le disque : le cache servirait l'ancien.
  viderCacheLivres();
  return safeState();
});

ipcMain.handle('cab:pickExternal', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Dossier de copie (clé USB, disque externe, iCloud Drive, OneDrive…)',
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
  if (String(next || '').length < 8) throw erreur('ERR-CAB-012', 'Choisis un mot de passe d\'au moins huit caractères.');
  // On revérifie l'ancien en relisant le fichier : sans ça, quelqu'un qui passe devant un poste
  // déverrouillé changerait le mot de passe sans connaître l'ancien.
  const check = CS.createCabStore(app.getPath('userData'), {}).unlock(String(current || ''));
  if (!check.ok) throw erreur('ERR-CAB-012', 'Mot de passe actuel incorrect.');
  getStore().backupNow('avant-changement-mot-de-passe');
  getStore().setPassword(state, String(next));
  return { ok: true };
});

// La clé de secours : le fichier le plus important que ce cabinet produira jamais.
ipcMain.handle('cab:exportRecovery', async (_e, { password, current } = {}) => {
  requireOpen();
  if (String(password || '').length < 8) throw erreur('ERR-CAB-012', 'Choisis un mot de passe d\'au moins huit caractères pour ce fichier.');
  // Ce fichier contient la clé qui ouvre les comptabilités de TOUS les clients. Le produire sans
  // redemander le mot de passe du cabinet laissait n'importe qui, devant un poste déverrouillé,
  // repartir avec — et sans la moindre trace.
  const check = CS.createCabStore(app.getPath('userData'), {}).unlock(String(current || ''));
  if (!check.ok) throw erreur('ERR-CAB-012', 'Mot de passe du cabinet incorrect.');
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
  if (!keys.privateKey || !keys.publicKey) throw erreur('ERR-CAB-012', 'Cette clé de secours est vide.');
  getStore().backupNow('avant-restauration-cle');
  state.cabinet = { ...state.cabinet, publicKey: keys.publicKey, privateKey: keys.privateKey };
  save();
  // Restaurer une clé prouve qu'on en détient un fichier : on le note, sinon le poste neuf
  // reprocherait sa clé à quelqu'un qui vient de la restaurer depuis sa clé USB — c'est-à-dire à
  // quelqu'un qui a tout fait dans les règles (règle 6.8.1, « le pire défaut est celui qui punit
  // quelqu'un qui a tout bien fait »). On garde la date du fichier restauré si elle est plus
  // ancienne que maintenant : c'est celle de l'enregistrement, pas celle du geste d'aujourd'hui.
  const creeLe = Date.parse((obj && obj.creeLe) || '');
  writeAppCfg({ recoveryExportedAt: Number.isFinite(creeLe) ? creeLe : Date.now() });
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

// Une erreur du renderer arrive ici (9.1.0, SPEC-OUT-004). Même mécanisme que dans l'application
// entreprise, et pour la même raison : sur le poste d'un comptable, une exception d'interface
// n'existe pas — c'est ainsi que `h(a.relayFailure)` a plané des versions entières en 6.8.0, et
// qu'il faisait justement planter le panneau AU MOMENT où il devait annoncer une panne.
// Jamais de fenêtre, jamais de rechargement, et vingt par minute au maximum.
let erreursRenderer = { debut: 0, n: 0, tues: 0 };
ipcMain.handle('support:erreur', (_e, info) => {
  try {
    const maintenant = Date.now();
    if (maintenant - erreursRenderer.debut > 60000) {
      if (erreursRenderer.tues) logToFile('renderer', `… ${erreursRenderer.tues} erreur(s) identique(s) non journalisée(s) (limite d'une minute)`);
      erreursRenderer = { debut: maintenant, n: 0, tues: 0 };
    }
    if (erreursRenderer.n >= 20) { erreursRenderer.tues++; return false; }
    erreursRenderer.n++;
    const i = info || {};
    logToFile('renderer', `${i.message || '(sans message)'} — ${i.source || '?'}:${i.ligne || '?'}\n${i.pile || '(sans pile)'}`);
    return true;
  } catch { return false; }
});

ipcMain.handle('cab:support', () => ({
  version: VERSION, electron: process.versions.electron, platform: process.platform, arch: process.arch,
  userData: app.getPath('userData'),
  log: path.join(app.getPath('userData'), 'main.log'),
  dossiers: state ? state.dossiers.length : 0,
  paquets: state ? state.dossiers.reduce((s, d) => s + (d.packs || []).length, 0) : 0,
  external: getStore().state.external,
  // Un gel passé est la première chose à joindre à un rapport : c'est justement ce qu'aucune
  // console n'aurait montré. La pile, elle, reste dans le journal technique.
  dernierGel: lastFreeze ? { at: lastFreeze.at, silence: lastFreeze.silence } : null
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
const GITHUB = require('../depot');           // le MÊME fichier que l'app entreprise : un seul dépôt, une seule vérité
const RELEASES_URL = `https://github.com/${GITHUB.owner}/${GITHUB.repo}/releases`;
const IS_MAC = process.platform === 'darwin';
const MAC_SIGNED = false;
// Le canal du cabinet. Depuis la 9.1.0 il en existe deux, et c'est le RÉGLAGE du poste qui
// choisit — pas la version installée : quelqu'un qui décoche la case tourne encore sur une bêta
// jusqu'à ce que la stable suivante arrive, et il doit bien la recevoir.
const UPDATE_CHANNEL = () => (readUpdateCfg().beta ? 'cabinet-beta' : 'cabinet');

// La même règle que `core.canalDe` (7.25.0), recopiée : l'application du cabinet ne charge PAS
// core.js — il n'est même pas dans ses `files`, exprès, pour ne pas livrer au comptable le code de
// l'application payante. Y appeler `C.canalDe` lèverait une TypeError pendant la construction du
// gabarit, sans un mot en console : c'est la bombe silencieuse de la 7.22.0, et c'est le lint
// (9.1.0) qui l'a attrapée ici, deux secondes après que je l'ai écrite.
const canalDeVersion = v => {
  const m = /^\d+\.\d+\.\d+-([A-Za-z][A-Za-z0-9]*)/.exec(String(v || '').trim());
  return m ? m[1].toLowerCase() : 'latest';
};

let updater = null, updateInfo = null, downloaded = false, downloadedFile = null, silentCheck = true;
// Pourquoi le module n'a pas démarré, en clair : sans ça le comptable lit « indisponible » et
// personne ne peut l'aider à distance.
let updaterError = '', relayFailure = '';
// Une erreur qu'on va peut-être démentir par un second essai ne s'affiche pas tout de suite.
let silencerErreur = false;
// Voir src/main.js : une panne PENDANT un téléchargement que l'utilisateur voit se dit toujours,
// même si la vérification qui l'a déclenchée était silencieuse.
let enTelechargement = false;
const UPDATE_CFG = () => path.join(app.getPath('userData'), 'update-config.json');
const UPDATE_RESULT = () => path.join(app.getPath('userData'), 'update-result.json');
const readUpdateCfg = () => { try { return JSON.parse(fs.readFileSync(UPDATE_CFG(), 'utf8')); } catch { return {}; } };
function writeUpdateCfg(cfg) {
  fs.mkdirSync(path.dirname(UPDATE_CFG()), { recursive: true });
  fs.writeFileSync(UPDATE_CFG(), JSON.stringify(cfg), { mode: 0o600 });
}

// Voir src/main.js : quand la dernière vérification a eu lieu, et ce qu'elle a répondu. Ici c'était
// pire que dans l'app entreprise — l'écran affirmait « Les mises à jour arrivent toutes seules :
// rien à configurer » alors qu'une seule vérification avait lieu, quatre secondes après l'ouverture,
// et qu'un comptable n'éteint pas son poste de la semaine.
const MAJ_INTERVALLE = 4 * 60 * 60 * 1000;      // quatre heures
const MAJ_ETAT = () => path.join(app.getPath('userData'), 'update-state.json');
const readMajEtat = () => { try { return JSON.parse(fs.readFileSync(MAJ_ETAT(), 'utf8')); } catch { return {}; } };
function noterVerification(resultat, version) {
  try {
    fs.mkdirSync(path.dirname(MAJ_ETAT()), { recursive: true });
    fs.writeFileSync(MAJ_ETAT(), JSON.stringify({ at: Date.now(), resultat, version: version || '' }));
  } catch (_) { /* une date non écrite ne doit jamais empêcher une mise à jour */ }
}
const memePrete = info => !!(downloaded && updateInfo && info && updateInfo.version === info.version);
const notesTexte = n => !n ? '' : Array.isArray(n) ? n.map(x => (x && x.note) || '').join('\n') : String(n);
const sendUpd = (s, payload) => { try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:event', { state: s, ...(payload || {}) }); } catch {} };

// Voir src/main.js : **on ne montre jamais une phrase qu'on n'a pas écrite.** Le message brut
// d'electron-updater est en anglais et porte une URL — « Cannot find cabinet-mac.yml in the release
// https://github.com/… » n'apprend rien à un comptable et donne l'impression d'un logiciel cassé.
// La cause part dans `detail`, replié à l'écran, et dans le journal : c'est elle qui sert à dépanner.
function updateProblem(err) {
  const brut = String((err && err.message) || err || '').trim();
  const code = String((err && err.code) || '');       // le code vit sur l'erreur, pas dans son texte
  const tout = code + ' ' + brut;
  const detail = brut.split('\n')[0].slice(0, 300);
  const dit = (message, soft) => ({ message, detail, soft: !!soft });
  // Une release existe mais son fichier d'index n'est pas encore en ligne : c'est une publication
  // en cours, pas une panne. Gris, pas rouge.
  if (/CHANNEL_FILE_NOT_FOUND/.test(code) || /Cannot find .+ in the (latest )?release/i.test(brut)) {
    // Sur le canal d'essai, l'index qui manque est le plus souvent une bêta qui n'existe pas encore :
    // c'est le cas normal entre deux essais (7.25.0), pas une publication en cours.
    return readUpdateCfg().beta
      ? dit('Aucune version d\'essai publiée pour l\'instant. Tu as la dernière version ; désactive « Versions d\'essai » pour revenir au canal normal.', true)
      : dit('Une nouvelle version vient d\'être publiée et ses fichiers finissent de monter en ligne. Réessaie dans quelques minutes.', true);
  }
  if (/NO_PUBLISHED_VERSIONS|LATEST_VERSION_NOT_FOUND/.test(code)) return dit('Aucune version publiée pour l\'instant.', true);
  if (/401|403|Bad credentials/i.test(tout)) return dit('Le jeton d\'accès a été refusé ou a expiré. Demandes-en un nouveau.');
  if (/404/.test(tout)) return dit(GITHUB.private
    ? 'Aucune version trouvée : le jeton d\'accès manque, ou il n\'a pas accès au dépôt (Réglages → L\'application → Mises à jour).'
    : 'Aucune version trouvée pour l\'instant.', !GITHUB.private);
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN|net::/i.test(tout)) return dit('Impossible de joindre le service de mise à jour. Vérifie ta connexion internet.');
  if (/sha512|checksum|integrity/i.test(tout)) return dit('Le fichier téléchargé est incomplet ou abîmé. Réessaie.');
  if (/ENOSPC/i.test(tout)) return dit('Il n\'y a plus assez d\'espace disque pour télécharger la mise à jour.');
  if (/EACCES|EPERM/i.test(tout)) return dit('L\'application n\'a pas le droit d\'écrire la mise à jour ici. Place-la dans le dossier Applications, puis réessaie.');
  return dit('La mise à jour n\'a pas abouti. Réessaie dans un moment ; si ça continue, envoie le journal.');
}

// Relais si l'application a été construite avec son adresse, GitHub en direct sinon.
//
// `feedGithub` et `configureFeed` vivent au niveau du MODULE et non plus dans `getUpdater` : le
// repli automatique (voir checkForUpdates) doit pouvoir rebrancher le flux après coup. Enfermé dans
// une fermeture, il n'existait qu'au moment de la construction du module — c'est-à-dire au seul
// moment où l'on ne sait pas encore si le relais répond.
// La liste des releases du dépôt, telle que l'API la rend (de la plus récente à la plus ancienne,
// vingt au plus — plusieurs préversions peuvent s'intercaler entre deux stables, 7.25.0). Le jeton
// n'est envoyé qu'à l'API, jamais au CDN des fichiers.
function releasesGithub(token, chemin) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const entetes = { 'User-Agent': `SkanFact-Cabinet/${VERSION}`, Accept: 'application/vnd.github+json' };
    if (token) entetes.Authorization = `Bearer ${String(token).trim()}`;
    const req = https.get(`https://api.github.com/repos/${GITHUB.owner}/${GITHUB.repo}/releases${chemin || '?per_page=20'}`, { headers: entetes, timeout: 15000 }, res => {
      let corps = '';
      res.setEncoding('utf8');
      res.on('data', d => { corps += d; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(Object.assign(new Error(`GitHub a répondu ${res.statusCode} sur la liste des releases`), { code: `HTTP_${res.statusCode}` }));
        try { resolve(JSON.parse(corps)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('ETIMEDOUT: GitHub ne répond pas')));
    req.on('error', reject);
  });
}

// GitHub en direct. **Le canal d'essai n'y passe JAMAIS par le fournisseur GitHub d'electron-updater**
// (9.8.8-beta.2) : ce fournisseur ne connaît que les canaux « alpha » et « beta » — lus dans le tag
// de la release — donc `cabinet-beta` n'y trouve jamais rien (« No published versions on GitHub »,
// ce que le comptable pilote a lu à l'écran), et s'il trouvait, il irait chercher `beta-mac.yml`,
// l'index de l'app ENTREPRISE. Le Cabinet choisit donc lui-même la release qui porte son index
// (`K.releasePourIndex`, la règle du relais) et laisse le fournisseur GÉNÉRIQUE lire cette page.
// Le canal stable, lui, passe par `/releases/latest`, que le fournisseur GitHub lit correctement.
// Limite écrite : sur un dépôt PRIVÉ, la page d'une release ne se lit pas avec un jeton — le canal
// d'essai du Cabinet a alors besoin du relais.
async function feedGithub(u) {
  const cfg = readUpdateCfg();
  // Les en-têtes posés pour le relais (secret de l'application) ne partent ni vers GitHub ni vers le
  // CDN des fichiers : on les retire AVANT de changer de flux (8.0.0, jamais porté ici).
  u.requestHeaders = null;
  if (!cfg.beta) {
    u.setFeedURL({ provider: 'github', owner: GITHUB.owner, repo: GITHUB.repo, channel: 'cabinet', private: !!cfg.token, token: cfg.token || undefined });
    return;
  }
  const fichier = K.nomIndex('cabinet-beta', process.platform);
  // La liste peut rendre une release récente SANS ses fichiers (23/09/2026) : on relit celle qui
  // paraît vide avant de retomber sur une plus ancienne, sinon on sert une vieille bêta.
  const relire = r => releasesGithub(cfg.token, `/${r.id}/assets?per_page=100`).catch(() => null);
  const rel = await K.releasePourIndexRelue(await releasesGithub(cfg.token), fichier, relire);
  if (!rel) {
    // Pas de bêta publiée : le même code que le fournisseur générique sur un index absent, pour que
    // `updateProblem` en fasse la même phrase grise.
    throw Object.assign(new Error(`Aucune release ne porte ${fichier}`), { code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' });
  }
  u.setFeedURL({ provider: 'generic', url: `https://github.com/${GITHUB.owner}/${GITHUB.repo}/releases/download/${rel.tag}`, channel: 'cabinet-beta' });
}

// Le relais a échoué pendant une vérification : on ne repasse plus par lui de la session — sauf
// sur un clic (voir checkForUpdates).
let relayDown = false;

async function configureFeed(u) {
  const base = relayBase();
  if (!base || relayDown) return feedGithub(u);
  try {
    // Une adresse invalide doit être vue ICI, pas au premier téléchargement.
    const url = new URL(`${base}/cabinet`).toString();
    u.requestHeaders = { 'X-SkanFact-App': relaySecret() };
    u.setFeedURL({ provider: 'generic', url, channel: UPDATE_CHANNEL() });
  } catch (e) {
    // Jamais de cabinet sans recours : on retombe sur GitHub, et on le dit.
    relayFailure = `Relais injoignable (${String(e && e.message || e).slice(0, 120)}). Retour au téléchargement direct depuis GitHub.`;
    await feedGithub(u);
  }
}

function getUpdater() {
  if (updater) return updater;
  try {
    const { autoUpdater } = require('electron-updater');
    // `updater = null` (changement de canal ou de jeton) fait repasser ici sur le MÊME objet : sans
    // ce nettoyage, chaque passage ajoute un second jeu d'écouteurs et chaque événement arrive deux fois.
    autoUpdater.removeAllListeners();
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = !IS_MAC || MAC_SIGNED;
    autoUpdater.autoRunAppAfterInstall = true;
    const beta = !!readUpdateCfg().beta;
    autoUpdater.channel = UPDATE_CHANNEL();       // le canal du cabinet, jamais celui de l'app entreprise
    // ATTENTION : affecter `channel` met `allowDowngrade` à true — c'est écrit dans electron-updater,
    // et c'est voulu chez eux (changer de canal peut signifier revenir en arrière). Chez nous, non :
    // l'application proposait d'installer une version PLUS ANCIENNE que celle en place, c'est-à-dire
    // de revenir à un défaut déjà corrigé. Toujours remettre la valeur APRÈS le canal.
    //
    // La seule exception est voulue : quelqu'un qui DÉCOCHE la case tourne sur une version plus
    // récente que la dernière stable. Lui interdire de reculer, ce serait l'enfermer dans la bêta
    // qu'il vient de quitter.
    autoUpdater.allowDowngrade = !beta && canalDeVersion(VERSION) !== 'latest';
    // Sans lui, electron-updater interroge /releases/latest, qui ignore les préversions PAR
    // CONSTRUCTION : la bêta serait publiée et jamais proposée à personne, sans une erreur nulle part.
    autoUpdater.allowPrerelease = beta;
    const ulog = path.join(app.getPath('userData'), 'updater.log');
    const ul = lvl => m => { try { fs.appendFileSync(ulog, `${new Date().toISOString()} ${lvl} ${m}\n`); } catch {} };
    autoUpdater.logger = { info: ul('info'), warn: ul('warn'), error: ul('error'), debug: ul('debug') };
    autoUpdater.on('checking-for-update', () => { if (!silentCheck) sendUpd('checking'); });
    autoUpdater.on('update-available', info => {
      noterVerification('available', info.version);
      // La MÊME version que celle déjà téléchargée : elle reste prête.
      if (memePrete(info)) { sendUpd('downloaded', { version: info.version, notes: notesTexte(info.releaseNotes) }); return; }
      updateInfo = info; downloaded = false; downloadedFile = null; enTelechargement = autoUpdater.autoDownload;
      sendUpd('available', { version: info.version, notes: notesTexte(info.releaseNotes) });
    });
    autoUpdater.on('update-not-available', () => {
      noterVerification('none');
      if (silentCheck) return;
      if (downloaded && updateInfo) sendUpd('downloaded', { version: updateInfo.version, notes: notesTexte(updateInfo.releaseNotes) });
      else sendUpd('none');
    });
    autoUpdater.on('download-progress', p => { if (!downloaded) sendUpd('downloading', { percent: Math.round(p.percent), version: updateInfo && updateInfo.version, transferred: p.transferred, total: p.total }); });
    // Les notes voyagent avec l'annonce, comme dans l'app entreprise : la fenêtre « prête à
    // installer » dit ce que la version change, pas seulement son numéro.
    autoUpdater.on('update-downloaded', info => { downloaded = true; enTelechargement = false; downloadedFile = info.downloadedFile || null; sendUpd('downloaded', { version: info.version, notes: notesTexte(info.releaseNotes) }); });
    autoUpdater.on('error', err => { noterVerification('error'); const pendant = enTelechargement; enTelechargement = false; if ((pendant || !silentCheck) && !silencerErreur) sendUpd('error', updateProblem(err)); });
    // Le flux se branche dans `checkForUpdates` (il peut demander la liste des releases à GitHub,
    // donc attendre) : ici on ne pose que ce qui est synchrone.
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
  // Une version téléchargée n'arrête plus la recherche (23/09/2026, voir src/main.js) : la 10.9.3
  // prête cachait la 10.10.0 publiée entre-temps, et il fallait installer l'une pour voir l'autre.
  const patiente = () => new Promise((_, rej) => setTimeout(() => rej(new Error('ETIMEDOUT: pas de réponse')), 45000));
  // **Le repli n'est pas un réglage, c'est un réflexe.** Deux chemins existent — le relais et
  // GitHub en direct — et le second ne servait que lorsque le premier était MAL RÉGLÉ, pas quand il
  // répondait mal : le seul cas qui arrive vraiment. Le comptable lisait « Aucune version trouvée :
  // le jeton d'accès manque » pendant qu'un chemin parfaitement fonctionnel l'attendait à côté.
  // Un clic sur « Vérifier maintenant » réessaie le relais, même s'il a échoué plus tôt dans la
  // session : la cause la plus fréquente d'un échec est un index qui finissait de monter en ligne,
  // et c'est très exactement le moment où l'on clique. Les vérifications silencieuses, elles,
  // gardent le chemin qui a répondu.
  if (!isSilent && relayDown) { relayDown = false; relayFailure = ''; }
  const avecRelais = !!relayBase() && !relayDown;
  silencerErreur = avecRelais;
  try {
    await configureFeed(u);
    const r = await Promise.race([u.checkForUpdates(), patiente()]);
    silencerErreur = false;
    if (!r) return { state: 'error', message: 'Le module de mise à jour est inactif dans cette installation.' };
    return { state: 'ok' };
  } catch (e) {
    if (avecRelais) {
      relayDown = true;
      relayFailure = `Le service de mise à jour n'a pas répondu (${String((e && e.message) || e).slice(0, 120)}). Téléchargement direct depuis GitHub.`;
      try {
        await configureFeed(u);                        // relayDown est posé : on repart sur GitHub
        const r2 = await Promise.race([u.checkForUpdates(), patiente()]);
        silencerErreur = false;
        if (r2) return { state: 'ok' };
      } catch (e2) { silencerErreur = false; return { state: 'error', ...updateProblem(e2) }; }
    }
    silencerErreur = false;
    return { state: 'error', ...updateProblem(e) };
  }
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
  relay: !!relayBase() && !relayFailure,
  // Sur un dépôt public, une panne de relais n'empêche plus rien (le repli GitHub suffit) : on ne
  // l'affiche pas en rouge pour autant, elle reste dans le journal. Même règle que la 7.24.0.
  relayFailure: GITHUB.private ? relayFailure : '',
  private: GITHUB.private,
  // Le canal choisi, et ce que la version installée EST réellement. Les deux, parce qu'ils peuvent
  // se contredire une journée entière : on décoche la case un matin en tournant sur une bêta, et on
  // y reste jusqu'à ce que la stable suivante arrive. L'écran doit pouvoir le dire.
  beta: !!readUpdateCfg().beta,
  prerelease: canalDeVersion(VERSION) !== 'latest',
  lastCheck: readMajEtat().at || 0,
  lastResult: readMajEtat().resultat || '',
  autoEvery: MAJ_INTERVALLE,
  lastUpdate: takeLastUpdateResult()
}));
// Entrer dans le canal d'essai du cabinet ou en sortir (9.1.0). On reconfigure le flux tout de
// suite : sans ça, le changement ne prendrait effet qu'au prochain démarrage, et « Vérifier les
// mises à jour » juste après aurait répondu sur l'ancien canal — le contraire de ce qu'on demande.
ipcMain.handle('upd:setBeta', (_e, on) => {
  const cfg = readUpdateCfg();
  if (on) cfg.beta = true; else delete cfg.beta;
  writeUpdateCfg(cfg);
  // Un canal déjà téléchargé n'a plus rien à voir avec celui qu'on vient de choisir.
  updateInfo = null; downloaded = false; downloadedFile = null;
  // `updater = null` et pas `configureFeed` seul : `channel`, `allowDowngrade` et `allowPrerelease`
  // se posent dans `getUpdater()`, et les trois doivent changer ensemble.
  updater = null;
  return { beta: !!cfg.beta };
});

ipcMain.handle('upd:setToken', (_e, token) => {
  const cfg = readUpdateCfg();
  if (token) cfg.token = String(token).trim(); else delete cfg.token;
  writeUpdateCfg(cfg);
  updater = null;                                  // le flux se reconstruit avec le nouveau jeton
  return { hasToken: !!cfg.token };
});
ipcMain.handle('upd:check', () => checkForUpdates(false));
// La dernière version stable et la dernière version d'essai PUBLIÉES (voir src/main.js) : l'écran
// écrivait « Numérotées 9.2.0-beta.1 », figé depuis la 9.1.0.
ipcMain.handle('upd:canaux', async () => {
  try {
    return await require('../canaux').lireCanaux({
      app: 'cabinet', plateforme: process.platform, relaisBase: relayBase(), relaisSecret: relaySecret(),
      owner: GITHUB.owner, repo: GITHUB.repo, token: readUpdateCfg().token, userAgent: `SkanFact-Cabinet/${VERSION}`
    });
  } catch (_) { return null; }
});
ipcMain.handle('upd:download', () => {
  const u = getUpdater();
  if (!u || !updateInfo) return { state: 'error', message: 'Aucune mise à jour détectée.' };
  silentCheck = false;
  enTelechargement = true;
  try { u.downloadUpdate(); return { state: 'ok' }; } catch (e) { return { state: 'error', ...updateProblem(e) }; }
});
ipcMain.handle('upd:install', (_e, opts) => {
  // U-09 : l'installation ferme l'application sans passer par la question de la fermeture. Une
  // pièce commencée est donc un REFUS ici, sauf si l'interface a posé la question et reçu « oui ».
  if (saisiesEnCours.length && !(opts && opts.force)) {
    return { state: 'error', soft: true, message: `Une pièce commencée n'est pas enregistrée (${saisiesEnCours.join(', ')}) : enregistre-la avant de redémarrer.` };
  }
  if (opts && opts.force) fermerQuandMeme = true;
  const u = getUpdater();
  if (!u) return updaterUnavailable();
  if (IS_MAC && !MAC_SIGNED) return installOnMac();
  setImmediate(() => u.quitAndInstall(true, true));
  return { state: 'ok' };
});
ipcMain.handle('upd:openReleases', () => shell.openExternal(RELEASES_URL + '/latest'));

ipcMain.handle('cab:mail', async (_e, { to, bcc, subject, body, attachment } = {}) => {
  // 10.14.0 — des destinataires en copie cachée (le fichier d'appairage part à tous les clients d'un
  // coup) : ils n'entrent dans le lien que s'il TIENT (`K.mailtoUrl`), sinon Windows l'ouvrirait
  // tronqué ou pas du tout, sans une erreur. La réponse dit ce qui est parti, pour que l'écran le dise
  // (la règle de `messageOuvert`, E-14) — et une pièce à joindre est MONTRÉE dans son dossier : un
  // lien `mailto:` ne sait pas joindre un fichier.
  const m = K.mailtoUrl({ to, bcc: Array.isArray(bcc) ? bcc : [], subject, body });
  await shell.openExternal(m.url);
  let montre = false;
  if (attachment && fs.existsSync(String(attachment))) { shell.showItemInFolder(String(attachment)); montre = true; }
  return { state: 'mailto', bccInclus: m.bccInclus, montre };
});

// Un numéro de téléphone tunisien composé depuis l'ordinateur, ou le message WhatsApp tout prêt :
// en Tunisie, un comptable qui court après des pièces appelle bien plus souvent qu'il n'écrit.
ipcMain.handle('cab:tel', async (_e, { number, whatsapp, text } = {}) => {
  const n = String(number || '').replace(/[^\d+]/g, '');
  if (!n) throw erreur('ERR-CAB-009', 'Ce dossier n\'a pas de numéro de téléphone.');
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
    // Puis toutes les quatre heures, et au retour au premier plan si le minuteur a été suspendu
    // (portable refermé). Voir src/main.js : une seule vérification au démarrage ne sert que ceux
    // qui redémarrent l'application tous les jours.
    if (app.isPackaged) {
      setInterval(() => { checkForUpdates(true).catch(() => {}); }, MAJ_INTERVALLE);
      app.on('browser-window-focus', () => {
        const vu = readMajEtat().at || 0;
        if (Date.now() - vu > MAJ_INTERVALLE) checkForUpdates(true).catch(() => {});
      });
    }
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(e => logError('démarrage', e));
  app.on('before-quit', cleanTemp);
  app.on('window-all-closed', () => { cleanTemp(); if (process.platform !== 'darwin') app.quit(); });
}
