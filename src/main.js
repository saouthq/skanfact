// Process principal Electron : fenêtre, menu, stockage local, export PDF, mises à jour.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createStorage } = require('./storage');
const { zipBuffer, zipRead, sha256, sealBuffer, openBuffer, isSealed, sealForCabinet, keyFingerprint, generateClientKeys, signManifest, verifyManifest } = require('./zip');

// Identifiants de l'app. Ne PAS les lire dans package.json au démarrage : electron-builder
// retire la section « build » du package.json empaqueté (l'app installée n'a plus build.publish).
const APP_ID = 'tn.skancyber.skanfact';
const PKG = require('../package.json');
// Le dépôt est PUBLIC depuis le 13/09/2026 : les releases se téléchargent sans rien présenter.
// Tant que `private` valait `true`, l'application réclamait un jeton de lecture que plus personne
// n'a besoin de fournir, et l'écran des mises à jour affirmait « Le dépôt GitHub de SkanFact est
// privé » — une phrase devenue fausse, sur l'écran qu'on regarde au moment d'installer.
const GITHUB = require('./depot');            // public ou privé : une seule ligne, dans src/depot.js
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

// Le journal technique, BORNÉ depuis la 9.1.0 (SPEC-OUT-004).
//
// Il a toujours grossi sans limite. Tant que seul le processus principal y écrivait, ça restait
// quelques kilo-octets par an. Le garde-fou d'erreur du renderer change l'échelle : une boucle qui
// lève à chaque tour peut écrire des mégaoctets par minute, et remplir le disque de quelqu'un est
// une panne bien pire que celle qu'on cherchait à tracer.
//
// UNE rotation, pas deux : `main.log` dépasse 2 Mo → il devient `main.log.1` (l'ancien `.1` est
// écrasé) et on repart à vide. Deux fichiers au maximum, donc 4 Mo au pire, et on garde toujours
// l'historique récent — c'est lui qui sert à dépanner (règle 6.7.2). Une rotation numérotée à
// cinq fichiers donnerait 10 Mo pour une information que personne ne lit jamais.
const LOG_MAX = 2 * 1024 * 1024;
function logPath() { return path.join(app.getPath('userData'), 'main.log'); }
function logToFile(where, err) {
  try {
    const f = logPath();
    // On regarde AVANT d'écrire : après, la ligne qui a fait déborder serait la première du
    // fichier neuf, et c'est précisément celle qu'on veut lire à la suite des autres.
    try { if (fs.statSync(f).size > LOG_MAX) fs.renameSync(f, f + '.1'); } catch {}
    fs.appendFileSync(f, `${new Date().toISOString()} [${where}] ${err && err.stack || err}\n`);
  } catch {}
}
function logError(where, err) {
  logToFile(where, err);
  try { dialog.showErrorBox('SkanFact — erreur', `${where}\n\n${err && err.message || err}\n\nDétail dans : ${logPath()}`); } catch {}
}

// 9.4.10 — Chaque refus porte son CODE (Partie 10 du cahier des charges). La phrase en français ne
// bouge pas : c'est elle qu'on lit. Le code se cite — dans un signalement, au téléphone, dans le
// cahier. Il voyage DANS le message parce qu'une propriété posée sur une Error ne traverse pas le
// pont IPC (Electron la sérialise en une chaîne) ; l'écran le détache avant d'afficher la phrase.
const erreur = (code, message) => Object.assign(new Error(`${message} [${code}]`), { code, refus: true });

// 10.0.1 — La panne SYSTÈME est la seule famille de refus que la règle de la 7.26.0 n'avait jamais
// couverte, et c'est celle où l'utilisateur perd son travail. Node lève « ENOSPC: no space left on
// device, write /Users/…/skanfact-data.json », le pont la sérialise telle quelle, et l'écran
// affiche l'anglais et le chemin du fichier — sur le geste le plus fréquent de l'application.
//
// Chaque phrase dit les TROIS choses d'un refus (7.0.0) : ce qui est refusé (rien n'a été
// enregistré), pourquoi, et ce qui débloque. « ton travail est encore à l'écran » n'est pas une
// consolation : c'est l'information qui évite de tout retaper avant d'avoir libéré de la place.
//
// La table est identique au caractère près dans `src/cabinet/main.js` — un test compare les deux
// corps, comme pour `round3` (9.1.0) : les deux applications écrivent des fichiers sur le même
// disque, et rien ne justifierait qu'elles n'en disent pas la même chose. D'où une phrase NEUTRE
// (« l'application »), qui vaut des deux côtés sans se recopier de travers.
const PANNES_DISQUE = {
  ENOSPC: 'Le disque est plein : rien n\'a été enregistré. Libère de la place, puis réessaie — ton travail est encore à l\'écran.',
  EDQUOT: 'Le quota de ce disque est atteint : rien n\'a été enregistré. Libère de la place, puis réessaie — ton travail est encore à l\'écran.',
  EACCES: 'L\'accès au fichier de données est refusé : rien n\'a été enregistré. Un antivirus ou un autre programme le tient peut-être ouvert — ferme-le, puis réessaie.',
  EPERM: 'L\'accès au fichier de données est refusé : rien n\'a été enregistré. Un antivirus ou un autre programme le tient peut-être ouvert — ferme-le, puis réessaie.',
  EROFS: 'Le dossier de données est en lecture seule : rien n\'a été enregistré. Choisis un autre emplacement dans les réglages, puis réessaie.',
  EBUSY: 'Le fichier de données est utilisé par un autre programme : rien n\'a été enregistré. Ferme-le, puis réessaie.',
  ENOENT: 'Le dossier de données est introuvable : rien n\'a été enregistré. Un disque externe ou un dossier iCloud s\'est peut-être déconnecté — rebranche-le, puis réessaie.',
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
// enregistrement : autant de points d'appel, autant d'occasions d'en oublier un — et la forme
// `ipcMain.handle(` reste celle que les tranches de source des tests reconnaissent.
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
  // règle de la 9.4.10 : on enveloppe une fois, pas quatre-vingts — et les quatre-vingts handlers
  // en profitent sans qu'aucun ait à y penser.
  catch (e) {
    if (!(e && e.refus)) logToFile('panne ' + canal, e);
    const phrase = (e && e.refus) ? '' : panneDisque(e);
    throw phrase ? erreur('ERR-ENT-085', phrase) : e;
  }
});

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
    // Vérification silencieuse des mises à jour 5 s après l'ouverture, PUIS toutes les quatre
    // heures. Une seule vérification au démarrage ne sert que ceux qui redémarrent l'application
    // tous les jours : SkanFact est ouvert du lundi au vendredi sans jamais être quitté, et une
    // correction publiée le mardi n'arrivait donc pas avant le lundi suivant.
    // Le retour au premier plan rattrape ce que le minuteur ne peut pas voir : un ordinateur
    // portable qu'on referme suspend les minuteurs, et il les reprend là où ils en étaient.
    if (app.isPackaged) {
      setTimeout(() => checkForUpdates(true), 5000);
      setInterval(() => checkForUpdates(true), MAJ_INTERVALLE);
      app.on('browser-window-focus', () => {
        const vu = readMajEtat().at || 0;
        if (Date.now() - vu > MAJ_INTERVALLE) checkForUpdates(true);
      });
    }
    // Le plan de contrôle (8.4.0). Hors du `isPackaged` ci-dessus : il ne parle qu'à l'adresse
    // qu'on lui donne, et `e2e:plateforme` a besoin de le voir fonctionner en développement contre
    // un faux serveur. Sans adresse configurée, la fonction ne fait rien du tout.
    try { demarrerPlateforme(); } catch (e) { logError('plan de contrôle', e); }
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
const WATCHDOG = { every: 3000, dead: 12000, enabled: true, reveil: 8000 };
// Le dernier gel constaté, pour le dire à l'utilisateur une fois l'interface revenue et pour le
// joindre à un rapport de problème.
let lastFreeze = null;
function startWatchdog(win) {
  if (!WATCHDOG.enabled || !win || win.isDestroyed()) return;
  let lastPong = Date.now();
  let lastTick = Date.now();     // le battement d'avant : sert à mesurer le temps RÉELLEMENT écoulé
  let reveilAvant = 0;           // tant que l'heure n'a pas dépassé ce point, on ne juge personne
  let dort = false;
  let reported = false;

  // Un ordinateur qui dort n'est pas une application qui gèle (8.1.0). Pendant la veille, le
  // renderer ne répond plus — parce que TOUT est suspendu, pas parce qu'il est bloqué. Au réveil,
  // le chien de garde voyait « 464 secondes sans réponse », concluait au gel, et rechargeait la
  // page : refermer son portable coûtait le brouillon en cours. Deux parades, et il faut les deux :
  //
  //   - `powerMonitor` dit la veille explicitement, c'est le signal le plus net ;
  //   - le SAUT D'HORLOGE la rattrape quand cet événement n'arrive pas (hibernation, machine
  //     virtuelle, certaines fermetures de capot) — et c'est celle qui se déclenche toute seule.
  //
  // Le saut d'horloge discrimine proprement : un gel du RENDERER n'empêche pas le minuteur du
  // processus principal de battre toutes les trois secondes. Un battement qui en a sauté vingt dit
  // donc que le processus entier était suspendu, jamais que l'interface était bloquée.
  const repartir = (raison) => {
    lastPong = Date.now(); lastTick = Date.now(); reveilAvant = Date.now() + WATCHDOG.reveil; reported = false;
    logToFile('chien de garde', new Error('silence ignoré — ' + raison));
  };
  try {
    powerMonitor.on('suspend', () => { dort = true; });
    powerMonitor.on('resume', () => { dort = false; repartir('retour de veille'); });
  } catch (e) { logToFile('chien de garde', e); }

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
    const maintenant = Date.now();
    const retard = maintenant - lastTick;   // le temps RÉELLEMENT écoulé depuis le battement d'avant
    lastTick = maintenant;
    try { win.webContents.send('alive:ping'); } catch { return; }
    // L'ordinateur a dormi, ou le processus a été gelé par le système : le silence qu'on mesure
    // n'est pas celui de l'interface. On repart de zéro plutôt que d'accuser un innocent.
    if (retard > WATCHDOG.every * 4) return repartir(`l'ordinateur s'est arrêté ${Math.round(retard / 1000)} s`);
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

    // On recharge, sans rien demander. Il n'y a pas de choix à offrir : après l'interruption, la
    // page est morte de toute façon, et une fenêtre de question qu'on ne peut pas lire dans une
    // application figée ne ferait qu'ajouter au blocage. On le DIT après coup, une fois vivant.
    lastFreeze = { at: new Date().toISOString(), silence: Math.round(silence / 1000), stack };
    try { if (!win.isDestroyed()) { lastPong = Date.now(); lastTick = Date.now(); win.webContents.reload(); } }
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
ipcMain.handle('support:openLog', () => shell.showItemInFolder(logPath()));

// Une erreur du renderer arrive ici (9.1.0, SPEC-OUT-004).
//
// Jusqu'ici, une exception dans l'interface finissait dans une console que personne n'ouvre : sur
// le poste d'un client, elle n'existait tout simplement pas. Cinq défauts de ce dépôt ont vécu des
// versions entières pour cette seule raison — une fonction appelée et jamais définie (6.8.0), une
// variable d'une autre route (7.20.0), `C.pl(...)` alors que `pl` est locale (7.22.0),
// `clientItems` déclarée dans un autre formulaire (7.23.0), `null.onclick` après une attente
// (7.6.0). Chacune laissait un écran blanc, un bouton mort ou une fenêtre qui ne s'ouvre pas, et
// AUCUNE trace. Maintenant il y en a une, et « Signaler un problème » l'emporte.
//
// Trois choses qu'on ne fait pas, et qui sont le cœur de la règle :
//   - jamais de fenêtre. Une erreur d'interface n'est pas forcément visible pour l'utilisateur ;
//     lui coller une boîte de dialogue le fait douter d'un travail qui s'est peut-être bien passé.
//   - jamais de rechargement. C'est au chien de garde de décider ça, lui seul sait si l'interface
//     répond encore.
//   - on cesse d'écrire au-delà de vingt par minute. Une boucle qui lève à chaque tour de rendu
//     remplirait le disque, et les vingt premières disent déjà tout ce qu'il y a à savoir.
let erreursRenderer = { debut: 0, n: 0, tues: 0 };
ipcMain.handle('support:erreur', (_e, info) => {
  try {
    const maintenant = Date.now();
    if (maintenant - erreursRenderer.debut > 60000) {
      // Une minute écoulée : on repart, en disant combien on a tues — sans cette ligne, le journal
      // laisserait croire que l'application s'est calmée alors qu'elle brûlait.
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

// ---------- licence (6.4.0 — offres et éditeur en 7.33.0 — armée en 8.0.0) ----------
// La clé publique est embarquée dans le paquet (`build/licence-public.json`). Tant qu'elle n'existait
// pas, l'application était libre : livrer un logiciel qui se verrouille tout seul serait un défaut.
// Depuis la 7.33.0 le fichier est bien LIVRÉ (il figure dans les `files` d'electron-builder) : avant,
// `build/` n'entrait pas dans le paquet, donc l'app installée restait libre quoi qu'on commite.
// Depuis la 8.0.0 il EXISTE : c'est la clé de Skander, et chaque installation a trente jours.
const L = require('./licence');
const os = require('os');
const crypto = require('crypto');
// La clé de licence vit DANS LE DOSSIER de l'entreprise (7.33.0) : une clé est émise pour UN
// matricule, et un même ordinateur ouvre plusieurs entreprises (le père de Skander gère la sienne
// et Darium). Une clé au niveau de l'ordinateur — c'était le cas en 6.4.0 — verrouillait le second
// dossier avec la clé du premier. Un dossier partagé (iCloud) emporte sa clé avec lui : c'est
// exactement ce qu'on veut pour « trois postes ».
const LIC_FILE = () => path.join(currentDossier().dir, 'licence.json');
const LIC_ANCIEN = () => path.join(app.getPath('userData'), 'licence.json');
// La paire de clés qui SIGNE les paquets envoyés au comptable (9.2.0). Elle vit dans le dossier de
// l'entreprise, pour la même raison que la licence : un ordinateur ouvre plusieurs entreprises, et
// c'est l'ENTREPRISE qui signe, pas le poste. Un dossier partagé emporte donc sa clé, et les deux
// personnes qui travaillent dessus signent avec la même — ce qui est exactement ce que le cabinet
// doit voir : un dossier, une clé.
//
// Elle est HORS de `skanfact-data.json`, donc hors du paquet et hors des exports : une clé privée
// qui voyagerait dans une sauvegarde qu'on envoie par mail ne serait plus une clé privée.
const CLE_CLIENT = () => path.join(currentDossier().dir, 'cle-client.json');
function cleClient() {
  const f = CLE_CLIENT();
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (j && j.publicKey && j.privateKey) return j;
  } catch { /* pas encore de clé, ou fichier abîmé : on en refait une */ }
  // Créée au premier envoi, jamais avant : une clé qu'on fabrique à l'installation pour tout le
  // monde est une clé que 90 % des installations n'utiliseront jamais.
  const k = generateClientKeys();
  const j = { format: 1, publicKey: k.publicKey, privateKey: k.privateKey, creeLe: new Date().toISOString() };
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(j, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch (e) { logToFile('cle-client', e); }
  return j;
}
// Les clés de l'ÉDITEUR : la privée signe les licences ; la publique du même jeu arme son propre
// poste, donc il voit exactement ce que verront ses clients. Hors du dépôt, hors des données, hors
// des sauvegardes. `SKANFACT_DOSSIER_CLES` ne sert qu'aux tests : ils posent une clé d'essai dans un
// dossier temporaire au lieu du vrai ~/.skanfact.
const CLES_DIR = () => process.env.SKANFACT_DOSSIER_CLES || path.join(os.homedir(), '.skanfact');
const CLE_PRIVEE = () => path.join(CLES_DIR(), 'licence-privee.pem');
const CLE_PUBLIQUE_EDITEUR = () => path.join(CLES_DIR(), 'licence-publique.json');
// Les clés qui signent les RÉPONSES du plan de contrôle (8.4.0), à côté des précédentes. Deux
// paires distinctes : celle-ci sert à chaque requête, l'autre ne sort que pour émettre une licence.
// Si celle-ci fuitait, on en publierait une nouvelle sans réémettre une seule licence vendue.
const REPONSE_PRIVEE = () => path.join(CLES_DIR(), 'reponse-privee.pem');
const REPONSE_PUBLIQUE = () => path.join(CLES_DIR(), 'reponse-publique.json');
// La clé du SERVEUR (8.5.0, P 0.2) : celle qui signe les ventes courantes depuis la console, sous le
// `kid` « srv-1 ». Fabriquée ici, sur le poste de l'éditeur — jamais sur le serveur, jamais dans une
// conversation. Sa privée part dans un réglage Cloudflare, sa publique dans la version suivante.
// Une clé de SECOND rang : si le serveur est compromis, on la retire sans toucher à la maître.
const SRV_KID = 'srv-1';
const SRV_PRIVEE = () => path.join(CLES_DIR(), 'serveur-privee.pem');
const SRV_PUBLIQUE = () => path.join(CLES_DIR(), 'serveur-publique.json');
// `SKANFACT_CLE_EMBARQUEE` : le chemin du fichier de clé publique à lire À LA PLACE de celui du
// paquet — pour que `e2e:licence` ouvre une application DÉSARMÉE (chemin inexistant) et arme le poste
// avec sa propre clé d'essai, maintenant que le dépôt embarque la vraie. Honoré en développement
// seulement : une application installée lit toujours sa propre clé, quoi que dise l'environnement.
// Depuis la 8.4.0 l'application connaît PLUSIEURS clés de signature (`build/licences-publiques.json`,
// voir licence.js) : la maître de Skander, et celle du serveur qui signera les ventes courantes.
// L'ancien fichier de la 8.0.0 reste lu en repli — il est encore seul sur le disque de tous les
// clients qui n'ont pas installé cette version, et un jour où l'autre il disparaîtra du dépôt.
const CLES_EMBARQUEES = () => (!app.isPackaged && process.env.SKANFACT_CLE_EMBARQUEE !== undefined)
  ? [process.env.SKANFACT_CLE_EMBARQUEE]
  : [path.join(__dirname, '..', 'build', 'licences-publiques.json'),
     path.join(__dirname, '..', 'build', 'licence-public.json')];
const CLE_EMBARQUEE = () => CLES_EMBARQUEES()[0];
const lireJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const editeurActif = () => fs.existsSync(CLE_PRIVEE());
const lirePrivee = () => fs.readFileSync(CLE_PRIVEE(), 'utf8');
// `{ cles, createdAt, reponse }`. Le cache se remet à `null` quand l'éditeur crée ou reprend ses
// clés pendant la session.
let clePubliqueCache = null;
function clePublique() {
  if (clePubliqueCache !== null) return clePubliqueCache;
  const fichiers = CLES_EMBARQUEES().concat([CLE_PUBLIQUE_EDITEUR()]);
  let trouve = null;
  for (const p of fichiers) {
    const j = lireJson(p);
    const cles = L.lireCles(j);
    if (cles.length) { trouve = { j, cles }; break; }
  }
  if (!trouve) { clePubliqueCache = { cles: [], createdAt: '', reponse: '' }; return clePubliqueCache; }
  // La date qui sert de plancher à l'essai est celle de la PLUS ANCIENNE clé, jamais de la plus
  // récente : ajouter la clé du serveur (« depuis 2026-10-01 ») ne doit pas rouvrir trente jours
  // d'essai à tout le monde le jour de la mise à jour.
  const dates = trouve.cles.map(c => c.depuis).filter(Boolean).sort();
  clePubliqueCache = {
    cles: trouve.cles,
    createdAt: dates[0] || trouve.j.createdAt || '',
    // La clé qui vérifie les RÉPONSES du plan de contrôle. Absente tant que Skander ne l'a pas
    // créée : sans elle, aucune réponse ne peut restreindre quoi que ce soit — et c'est le bon
    // défaut, celui qui laisse passer.
    reponse: (trouve.j && trouve.j.reponse && trouve.j.reponse.publicKey) || ''
  };
  return clePubliqueCache;
}
// La clé publique de l'ÉDITEUR (le pendant de sa clé privée), ou null s'il n'y a pas de clé privée
// ici. Des clés créées par l'outil en ligne de commande d'avant n'ont pas de fichier public : on le
// déduit de la privée et on l'écrit, une fois pour toutes.
function clePubliqueEditeur() {
  if (!editeurActif()) return null;
  // TOUJOURS déduite de la privée, jamais lue dans le fichier : licence-publique.json n'a rien de
  // secret, et quiconque y copierait la clé publique de SkanFact à côté d'un .pem quelconque
  // obtiendrait le passe-droit de l'éditeur (trouvé par la relecture adversariale de la 8.0.0).
  // Le fichier ne fait foi que pour la date ; s'il manque ou ne correspond pas, on le (ré)écrit.
  let publicKey;
  try { publicKey = crypto.createPublicKey(crypto.createPrivateKey(lirePrivee())).export({ type: 'spki', format: 'pem' }); }
  catch { return null; }
  const fichier = lireJson(CLE_PUBLIQUE_EDITEUR());
  const pub = { format: L.FORMAT, publicKey, createdAt: (fichier && fichier.createdAt) || L.today() };
  if (!fichier || fichier.publicKey !== publicKey) {
    try { fs.writeFileSync(CLE_PUBLIQUE_EDITEUR(), JSON.stringify(pub, null, 2) + '\n'); clePubliqueCache = null; } catch {}
  }
  return pub;
}
// Celui qui signe n'achète pas : le poste dont la clé privée correspond à la clé publique EN VIGUEUR
// (celle du paquet, ou la sienne tant que le paquet n'en porte pas) n'a ni essai ni verrou. Une
// autre clé privée (un second éditeur, une clé recréée par erreur) ne donne aucun passe-droit.
// À ne pas confondre avec `correspond` de editeurStatus(), qui compare à la clé EMBARQUÉE seulement
// (c'est l'état « armée avec cette clé / avec une autre / en attente » du panneau).
function editeurDeLaCleEnVigueur() {
  const mienne = clePubliqueEditeur();
  if (!mienne) return false;
  // Depuis la 8.4.0 il y a plusieurs clés en vigueur : correspondre à N'IMPORTE LAQUELLE suffit.
  // Ce n'est pas un relâchement — chacune de ces clés signe des licences que l'application accepte,
  // donc en tenir la privée, c'est déjà pouvoir s'en émettre une.
  return clePublique().cles.some(c => String(c.publicKey).trim() === String(mienne.publicKey).trim());
}
function ecrireLicence(key) {
  fs.mkdirSync(path.dirname(LIC_FILE()), { recursive: true });
  // La date d'armement doublée dans le dossier (voir armedAt) survit à la clé qu'on pose ou retire.
  const avant = lireJson(LIC_FILE()) || {};
  const doc = key ? { key, savedAt: new Date().toISOString() } : {};
  if (L.dateValide(avant.armedAt)) doc.armedAt = avant.armedAt;
  // Le verdict du plan de contrôle (8.4.0) survit lui aussi à la clé qu'on pose ou retire : sans
  // ça, « Retirer la clé » puis « Enregistrer » lèverait une révocation en deux clics. Il ne
  // s'applique qu'à la clé qu'il VISE (`sujet`), donc le garder ne pénalise jamais une clé neuve.
  if (avant.serveur) doc.serveur = avant.serveur;
  if (!key && !doc.armedAt && !doc.serveur) { try { fs.unlinkSync(LIC_FILE()); } catch {} return; }
  fs.writeFileSync(LIC_FILE(), JSON.stringify(doc, null, 2));
}
// La clé du dossier ouvert. Une clé rangée par la 6.4.0 au niveau de l'ordinateur est reprise pour
// le dossier qu'elle concerne (même matricule, ou clé sans matricule) — et pour lui seul.
function readLicence(matricule) {
  const mien = lireJson(LIC_FILE());
  if (mien && mien.key) return mien;
  const ancien = lireJson(LIC_ANCIEN());
  if (ancien && ancien.key) {
    const cles = clePublique().cles;
    const p = cles.length ? L.verifyKey(ancien.key, cles) : ((L.parseKey(ancien.key) || {}).payload || null);
    if (p && L.memeMatricule(p.matricule, matricule || '')) { try { ecrireLicence(ancien.key); } catch {} return ancien; }
  }
  return {};
}
// Date de première ouverture : le point de départ de l'essai. Elle vit dans app-config.json, donc
// elle ne part pas avec une sauvegarde ni un export — un essai ne se rejoue pas en réimportant.
function installedAt() {
  const cfg = readAppCfg();
  if (!cfg.installedAt) { cfg.installedAt = L.today(); writeAppCfg(cfg); }
  return cfg.installedAt;
}
// Le jour où l'application a été ARMÉE sur ce poste : la première fois qu'elle y voit une clé
// publique. La date de fabrication de la clé (createdAt) ne suffit pas — la version qui l'embarque
// peut arriver sur ce poste des semaines après le keygen, et l'essai doit compter à partir de LÀ.
function armedAt() {
  const pub = clePublique();
  if (!pub.cles.length) return '';
  const cfg = readAppCfg();
  if (!cfg.armedAt) { cfg.armedAt = L.today(); writeAppCfg(cfg); }
  // Doublée DANS le dossier de l'entreprise (<dossier>/licence.json) : effacer app-config.json en
  // gardant ses données ne rejoue pas l'essai. La plus ancienne des deux dates fait foi, et chacune
  // rattrape l'autre si elle manque.
  let arme = cfg.armedAt;
  try {
    const lic = lireJson(LIC_FILE()) || {};
    if (L.dateValide(lic.armedAt) && lic.armedAt < arme) { arme = lic.armedAt; cfg.armedAt = arme; writeAppCfg(cfg); }
    if (lic.armedAt !== arme) { fs.mkdirSync(path.dirname(LIC_FILE()), { recursive: true }); fs.writeFileSync(LIC_FILE(), JSON.stringify({ ...lic, armedAt: arme }, null, 2)); }
  } catch {}
  return arme > (pub.createdAt || '') ? arme : (pub.createdAt || arme);
}
// Le matricule de la société vit dans les données du renderer : c'est lui qui le passe, et il
// redemande l'état quand il change (chargement du dossier, fiche société enregistrée).
function licenceStatus(matricule) {
  const lic = readLicence(matricule);
  const pub = clePublique();
  return {
    ...L.licenceState({ key: lic.key || '', cles: pub.cles, installedAt: installedAt(), armedAt: armedAt(),
      matricule: matricule || '', today: L.today(), editeur: editeurDeLaCleEnVigueur(),
      serveur: verdictServeur(lic) }),
    editeur: editeurActif()
  };
}
// Ce que le manifeste d'un paquet dit de la licence de ce client (9.4.0). QUATRE champs, et rien
// d'autre : l'état, la date de fin, si elle a été payée, et l'offre. Ni la clé, ni le nom, ni le
// matricule — ils sont déjà dans le manifeste par ailleurs, et une clé qui voyagerait dans un
// paquet serait une clé qu'on peut réutiliser ailleurs.
//
// `payee` distingue une vraie licence d'un essai : c'est ce qui décide, chez le cabinet, si le
// dossier garde douze mois de grâce après l'expiration. Sans cette distinction, « avoir essayé »
// coûterait moins cher à son comptable que « n'avoir jamais essayé ».
function etatLicencePourPaquet(matricule) {
  try {
    const st = licenceStatus(matricule || '');
    return { etat: st.state, exp: String(st.exp || ''), payee: !!st.key, offre: st.offre || '' };
  } catch (e) {
    logToFile('licence du paquet', e);
    return null;                      // on ne devine pas : le cabinet ne comptera pas ce dossier
  }
}

// L'état de l'éditeur, tel que l'écran le reçoit. JAMAIS la clé privée dedans — elle ne traverse
// pas le pont, exactement comme la clé du cabinet dans l'autre application.
// `depuis` : le jour d'où partent les durées proposées (aujourd'hui, ou la fin de la licence qu'on
// renouvelle — un client qui renouvelle pendant le préavis ne perd pas les jours déjà payés).
function editeurStatus(depuis) {
  const depart = L.dateValide(depuis) && depuis > L.today() ? depuis : L.today();
  const actif = editeurActif();
  const pub = clePubliqueEditeur();
  // La clé MAÎTRE du paquet : c'est elle que l'éditeur compare à la sienne. Les autres clés en
  // vigueur (celle du serveur) ne sont pas les siennes et ne doivent pas lui faire croire le contraire.
  const embarquee = L.choisirCle('', lireJson(CLE_EMBARQUEE()) || lireJson(CLES_EMBARQUEES()[1] || '')) || null;
  return {
    actif, dossier: CLES_DIR(), chemin: CLE_PRIVEE(),
    publicKey: pub ? pub.publicKey : '', createdAt: pub ? pub.createdAt || '' : '',
    // La clé embarquée dans l'application (celle des clients) est-elle la sienne ? Tant que non, ses
    // clés n'arment que son poste : c'est l'état « en attente d'armement ».
    armee: !!(embarquee && embarquee.publicKey),
    correspond: !!(pub && embarquee && embarquee.publicKey === pub.publicKey),
    // Les durées portent la date de fin qu'elles donneraient à partir de `depart` : l'écran l'affiche
    // sans avoir à recalculer un mois du calendrier de son côté (une seule règle, dans licence.js).
    depart, offres: L.OFFRES, durees: L.DUREES.map(d => ({ ...d, exp: L.expirationPour(depart, d.id) })),
    // La clé de réponse du plan de contrôle : existe-t-elle sur ce poste, et celle que
    // l'application EMBARQUE est-elle bien la sienne ? Tant que non, le serveur peut répondre ce
    // qu'il veut, aucune réponse ne restreindra quoi que ce soit.
    reponse: (() => {
      const mienne = lireJson(REPONSE_PUBLIQUE());
      const embarquee = clePublique().reponse;
      return {
        existe: fs.existsSync(REPONSE_PRIVEE()),
        publicKey: (mienne && mienne.publicKey) || '',
        depuis: (mienne && mienne.depuis) || '',
        embarquee: !!embarquee,
        correspond: !!(mienne && embarquee && String(mienne.publicKey).trim() === String(embarquee).trim()),
        base: plateformeBase()
      };
    })(),
    // La clé du serveur (8.5.0) : existe-t-elle ici, et la version embarque-t-elle sa publique
    // sous « srv-1 » ? Tant que non, une clé signée par la console est refusée par les clients
    // (« pas reconnue ») — et le panneau le dit plutôt que de laisser croire qu'on peut vendre.
    serveur: (() => {
      const mienne = lireJson(SRV_PUBLIQUE());
      const embarquee = L.choisirCle(SRV_KID, clePublique().cles);
      return {
        kid: SRV_KID,
        existe: fs.existsSync(SRV_PRIVEE()),
        publicKey: (mienne && mienne.publicKey) || '',
        depuis: (mienne && mienne.depuis) || '',
        embarquee: !!embarquee,
        correspond: !!(mienne && embarquee && String(mienne.publicKey).trim() === String(embarquee.publicKey).trim())
      };
    })()
  };
}

// ---------- le plan de contrôle (8.4.0) ----------
//
// L'application annonce son installation à la plateforme et demande ce qu'elle sait de sa clé.
// **Tout ici est facultatif.** Pas d'adresse configurée, pas de réseau, pas de réponse, une réponse
// qu'on ne peut pas vérifier, un compte Cloudflare fermé, un éditeur disparu : l'application
// fonctionne exactement comme avant, sans un mot à l'écran. C'est la règle 1 du § 8 de
// PLAN-PLATEFORME.md, et c'est ce qui fait qu'une entreprise tunisienne ne perd pas sa facturation
// parce qu'un service hébergé à l'autre bout du monde a hoqueté.
//
// Ce qui part : la clé de licence (déjà présentée au relais de mise à jour depuis la 6.7.0), le
// `deviceId` (un UUID tiré au hasard, sans rapport avec la machine), le nom donné au poste, la
// plateforme et le numéro de version. **Rien d'autre, jamais** : aucun client, aucune facture,
// aucun montant, aucun chemin de dossier (§ 9).
//
// Ce qui peut en revenir : une révocation, et elle seule. Le serveur ne peut jamais ACCORDER un
// droit que la clé signée ne porte pas — il ne peut qu'ajouter une restriction déjà prévue.
const PLATEFORME_DEBUT = 20 * 1000;   // vingt secondes après l'ouverture : jamais pendant le démarrage

// L'adresse et le secret arrivent par `extraMetadata` à la construction, comme ceux du relais
// (6.7.0) — jamais dans Git. Les variables d'environnement ne servent qu'aux tests, et seulement en
// développement : une application installée ne se laisse pas rediriger par son environnement.
// Et tout se `trim()` avant usage : c'est une espace invisible en fin de secret qui avait cassé les
// mises à jour en 6.7.2.
function plateformeBase() {
  const brut = (!app.isPackaged && process.env.SKANFACT_PLATEFORME_BASE !== undefined)
    ? process.env.SKANFACT_PLATEFORME_BASE : (PKG.plateformeBase || '');
  return String(brut).trim().replace(/\/+$/, '');
}
function plateformeSecret() {
  const brut = (!app.isPackaged && process.env.SKANFACT_PLATEFORME_SECRET !== undefined)
    ? process.env.SKANFACT_PLATEFORME_SECRET : (PKG.plateformeSecret || '');
  return String(brut).trim();
}

// Le verdict gardé sur le poste, tel qu'il a été VÉRIFIÉ au moment où il est arrivé. Il est gardé
// parce que sans ça il suffirait de se débrancher pour annuler une révocation (§ 8, règle 5).
function verdictServeur(lic) {
  const s = lic && lic.serveur;
  if (!s || typeof s !== 'object') return null;
  return { etat: String(s.etat || ''), motif: String(s.motif || ''), emisLe: String(s.emisLe || ''), sujet: String(s.sujet || '') };
}
function ecrireVerdict(verdict) {
  try {
    const doc = lireJson(LIC_FILE()) || {};
    if (verdict) doc.serveur = verdict; else delete doc.serveur;
    fs.mkdirSync(path.dirname(LIC_FILE()), { recursive: true });
    fs.writeFileSync(LIC_FILE(), JSON.stringify(doc, null, 2));
  } catch { /* un verdict non écrit laisse l'application dans l'état d'avant : c'est le bon défaut */ }
}

// Une requête vers la plateforme. `opts.entetes` porte le secret de l'appelant (celui de
// l'application, ou celui de l'administrateur pour le pont comptable) ; le corps est du JSON.
// Résout `{ status, corps }` — c'est l'appelant qui juge le code, parce qu'un 400 du pont porte une
// phrase à montrer alors qu'un 403 de l'annonce doit rester muet.
function requetePlateforme(chemin, opts) {
  const o = opts || {};
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(plateformeBase() + chemin); }
    catch (e) { return reject(new Error('adresse du plan de contrôle invalide : ' + (e && e.message))); }
    // En clair, seulement en développement (le faux serveur de `e2e:plateforme`). Une application
    // installée exige https : la clé de licence voyage dans ce corps de requête.
    if (url.protocol !== 'https:' && app.isPackaged) return reject(new Error('le plan de contrôle exige https'));
    const donnees = o.corps === undefined ? null : Buffer.from(JSON.stringify(o.corps), 'utf8');
    const req = require(url.protocol === 'http:' ? 'http' : 'https').request(url, {
      method: o.method || (donnees ? 'POST' : 'GET'),
      timeout: o.timeout || 8000,
      headers: { ...(donnees ? { 'Content-Type': 'application/json', 'Content-Length': donnees.length } : {}), ...(o.entetes || {}) }
    }, res => {
      let txt = '';
      res.setEncoding('utf8');
      res.on('data', c => { txt += c; if (txt.length > (o.max || 32 * 1024)) req.destroy(new Error('réponse démesurée')); });
      res.on('end', () => {
        let corps = null;
        try { corps = JSON.parse(txt); } catch { corps = null; }
        resolve({ status: res.statusCode, corps });
      });
    });
    req.on('timeout', () => req.destroy(new Error('délai dépassé')));
    req.on('error', reject);
    req.end(donnees || undefined);
  });
}
async function postPlateforme(corps) {
  const r = await requetePlateforme('/v1/licence/etat', { corps, entetes: { 'X-SkanFact-App': plateformeSecret() } });
  if (r.status !== 200) throw new Error('HTTP ' + r.status);
  if (!r.corps) throw new Error('réponse illisible');
  return r.corps;
}

// Renvoie toujours, ne jette jamais : c'est un appel de confort, pas une étape du démarrage.
async function annoncerPlateforme() {
  if (!plateformeBase() || !plateformeSecret()) return { fait: false, raison: 'plan de contrôle non configuré' };
  const dev = deviceIdentity();
  const cle = String(readLicence().key || '').trim();
  let rep;
  try {
    rep = await postPlateforme({ cle, deviceId: dev.id, deviceNom: dev.name, plateforme: process.platform, version: app.getVersion() });
  } catch (e) {
    // Une panne du plan de contrôle n'est pas une panne de l'application. On l'écrit dans le
    // journal — c'est ce qui permet de dépanner à distance (6.7.2) — et rien à l'écran : il n'y a
    // rien que l'utilisateur puisse faire, et un rouge sur une situation normale apprend à ignorer
    // les rouges.
    logToFile('plan de contrôle', e);
    return { fait: false, raison: String((e && e.message) || e) };
  }
  // Une installation en essai s'annonce et n'attend rien en retour : c'est SON application qui
  // compte ses trente jours. Sans cet appel, aucun essai ne serait jamais visible — et un éditeur
  // qui ne voit pas ses essais ne sait pas s'il a des clients qui arrivent.
  if (!cle) return { fait: true, etat: 'essai' };

  const v = L.verifierReponse(rep, clePublique().reponse, { sujet: L.empreinteCle(cle) });
  if (!v.ok) return { fait: true, etat: '', raison: v.raison };
  // Le verdict vérifié remplace le précédent, dans les DEUX sens. Lever une révocation (un
  // remboursement annulé, une erreur de l'éditeur) exige exactement la même preuve que d'en poser
  // une : sans cette symétrie, quelqu'un capable de couper le réseau pourrait figer une révocation
  // pour toujours, et l'éditeur n'aurait aucun moyen de la reprendre.
  ecrireVerdict(v.etat === 'revoquee' ? { etat: 'revoquee', motif: v.motif, emisLe: v.emisLe, sujet: v.sujet } : null);
  return { fait: true, etat: v.etat };
}

let plateformeArmee = false;
function demarrerPlateforme() {
  if (plateformeArmee || !plateformeBase()) return;
  plateformeArmee = true;
  // Même cadence que la vérification de mise à jour, et pour la même raison : SkanFact reste
  // ouvert toute la semaine. Un seul appel au démarrage ne servirait que ceux qui le relancent
  // tous les jours.
  setTimeout(() => { annoncerPlateforme(); }, PLATEFORME_DEBUT);
  setInterval(() => { annoncerPlateforme(); }, MAJ_INTERVALLE);
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
// Partager le dossier qu'on a SOUS LES YEUX (7.28.0).
//
// Il manquait les deux moitiés qui comptent. « Dossier partagé à deux… » demandait un nom
// d'entreprise et fabriquait un dossier VIDE : quelqu'un qui venait de saisir sa société, ses
// clients et ses factures, et qui voulait les partager avec son père, se retrouvait devant un
// assistant de première utilisation. Et de l'autre côté, aucun moyen de REJOINDRE le dossier
// existant : il fallait retomber par hasard sur le même chemin en retapant le même nom.
//
// Le pire défaut est celui qui punit quelqu'un qui a tout bien fait (règle 6.8.1).
//
// On COPIE, on ne déplace pas : l'ancien emplacement reste intact et sert de filet, exactement
// comme la reprise de l'ancien format en 3.2.0. Tant que la copie n'est pas vérifiée, rien n'est
// bascule.
function nomDeDossier(nom) {
  return 'SkanFact-' + String(nom || 'entreprise').replace(/[^A-Za-z0-9À-ÿ _-]/g, '').trim().replace(/\s+/g, '-') || 'SkanFact-entreprise';
}
// Le nom de l'entreprise écrit DANS le dossier. Sur un dossier chiffré il n'est pas lisible : on
// ne devine pas, on le dit, et on retombe sur le nom du répertoire.
function societeDe(dir) {
  try {
    const brut = fs.readFileSync(path.join(dir, 'skanfact-data.json'), 'utf8');
    const j = JSON.parse(brut);
    if (j && j['skanfact-encrypted'] === 1) return { chiffre: true, name: '' };
    return { chiffre: false, name: String((j && j.company && j.company.name) || '').trim() };
  } catch { return { chiffre: false, name: '' }; }
}
ipcMain.handle('dossiers:share', async () => {
  const cfg = ensureDossiers();
  // `currentDossier()` relit la configuration sur le disque et rend un AUTRE objet : modifier ce
  // qu'il renvoie n'a aucun effet sur `cfg`, et `writeAppCfg(cfg)` réécrirait l'ancienne valeur.
  // Les fichiers étaient bien copiés, l'application se rechargeait… sur l'ancien emplacement, et
  // rien n'arrivait jamais de l'autre poste. Trouvé par `npm run e2e:partage`, qui fait vraiment
  // l'aller-retour entre deux applications.
  const ouvert = currentDossier();
  const d = cfg.dossiers.find(x => x.id === ouvert.id) || cfg.dossiers[0];
  if (d.shared) return { ok: false, error: 'Ce dossier est déjà posé dans un emplacement partagé.' };
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Où poser le dossier partagé ? (iCloud Drive, OneDrive, disque réseau, clé USB)',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths.length) return { ok: false, cancelled: true };
  const ancien = d.dir;
  const dest = path.join(r.filePaths[0], nomDeDossier(d.name));
  if (path.resolve(dest) === path.resolve(ancien)) return { ok: false, error: 'Ce dossier est déjà à cet endroit.' };
  if (fs.existsSync(path.join(dest, 'skanfact-data.json')))
    return { ok: false, error: 'Il y a déjà un dossier SkanFact à cet endroit. Pour l\'ouvrir, utilise « Rejoindre un dossier déjà partagé ».' };
  try {
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(ancien, dest, { recursive: true });
    // On ne bascule qu'une fois la copie CONSTATÉE : un dossier iCloud plein, un disque réseau
    // déconnecté en cours de route, et l'app ouvrirait un dossier à moitié écrit.
    const a = path.join(ancien, 'skanfact-data.json'), b = path.join(dest, 'skanfact-data.json');
    if (fs.existsSync(a) && (!fs.existsSync(b) || fs.statSync(b).size !== fs.statSync(a).size))
      return { ok: false, error: 'La copie est incomplète : le dossier partagé n\'a pas tout reçu. Rien n\'a été changé ici.' };
  } catch (e) { logError('partage du dossier', e); return { ok: false, error: e.message }; }
  d.dir = dest; d.shared = true; writeAppCfg(cfg);
  openStorage();
  if (mainWindow) mainWindow.reload();
  return { ok: true, dir: dest, ancien };
});

// Rejoindre un dossier qui existe DÉJÀ. On ne crée rien, on ne renomme rien : on l'ouvre.
ipcMain.handle('dossiers:join', async () => {
  const cfg = ensureDossiers();
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir le dossier SkanFact partagé (celui créé par l\'autre ordinateur)',
    properties: ['openDirectory']
  });
  if (r.canceled || !r.filePaths.length) return { ok: false, cancelled: true };
  let dir = r.filePaths[0];
  // Tolérance : on accepte qu'on ait choisi le dossier PARENT (« iCloud Drive » au lieu de
  // « iCloud Drive/SkanFact-Machin »), tant qu'il n'y a pas d'ambiguïté. C'est l'erreur qu'on fait
  // la première fois, et refuser sèchement n'apprend rien.
  if (!fs.existsSync(path.join(dir, 'skanfact-data.json'))) {
    let dedans = [];
    try {
      dedans = fs.readdirSync(dir).filter(n => {
        try { return fs.existsSync(path.join(dir, n, 'skanfact-data.json')); } catch { return false; }
      });
    } catch (e) { return { ok: false, error: 'Ce dossier ne peut pas être lu : ' + e.message }; }
    if (dedans.length === 1) dir = path.join(dir, dedans[0]);
    else if (dedans.length > 1) return { ok: false, error: `Il y a ${dedans.length} dossiers SkanFact ici. Ouvre celui de l'entreprise à rejoindre : ${dedans.slice(0, 3).join(', ')}${dedans.length > 3 ? '…' : ''}` };
    else return { ok: false, error: 'Aucun dossier SkanFact ici. Choisis le dossier créé par l\'autre ordinateur — son nom commence par « SkanFact- » et il contient un fichier skanfact-data.json.' };
  }
  const deja = cfg.dossiers.find(x => path.resolve(x.dir) === path.resolve(dir));
  if (deja) return { ok: false, error: `Ce dossier est déjà dans ta liste, sous le nom « ${deja.name} ».` };
  const soc = societeDe(dir);
  const entry = {
    id: 'd' + Date.now().toString(36),
    name: soc.name || path.basename(dir).replace(/^SkanFact-/, '').replace(/-/g, ' ') || 'Dossier partagé',
    dir, shared: true
  };
  cfg.dossiers.push(entry); cfg.currentDossier = entry.id; writeAppCfg(cfg);
  openStorage();
  if (mainWindow) mainWindow.reload();
  return { ok: true, dossier: entry, chiffre: soc.chiffre };
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
  // On lit ce que `setPassword` répond, et on l'enveloppe : un refus d'écriture (un autre poste a
  // enregistré entre-temps sur un dossier partagé) laissait l'écran annoncer « Données chiffrées »
  // sur un fichier qui n'avait pas bougé. Et une exception laissait le bouton figé sur
  // « Chiffrement… », sans un mot — il n'y avait aucun try/catch ici.
  try {
    const r = storage.setPassword(data, password || '');
    if (r && r.ok === false) {
      return {
        ok: false, encrypted: storage.state.encrypted,
        error: r.conflict
          ? 'Un autre poste vient d\'enregistrer dans ce dossier partagé. Rien n\'a été changé : recharge la page, puis recommence.'
          : 'Le mot de passe n\'a pas pu être appliqué. Rien n\'a été changé.'
      };
    }
    return { ok: true, encrypted: storage.state.encrypted };
  } catch (e) {
    logError('mot de passe', e);
    return { ok: false, encrypted: storage.state.encrypted, error: 'Le mot de passe n\'a pas pu être appliqué : ' + (e.message || 'erreur inconnue') };
  }
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
  if (size > 1024 * 1024) throw erreur('ERR-ENT-010', 'Image trop lourde (1 Mo maximum). Réduis-la avant de l\'utiliser.');
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
    if (size > 25 * 1024 * 1024) throw erreur('ERR-ENT-011', `« ${path.basename(f)} » dépasse 25 Mo. Réduis le fichier avant de le joindre.`);
    out.push(storage.addAttachment(docId, f));
  }
  return out;
});
// Joindre un fichier dont on connaît déjà le chemin (la photo qu'on vient de lire, par exemple) :
// même copie dans userData/pieces-jointes/, sans redemander à l'utilisateur de le retrouver.
ipcMain.handle('attach:addPath', (_e, { docId, path: file } = {}) => {
  if (!file || !fs.existsSync(file)) throw erreur('ERR-ENT-012', 'Fichier introuvable.');
  const size = fs.statSync(file).size;
  if (size > 25 * 1024 * 1024) throw erreur('ERR-ENT-011', `« ${path.basename(file)} » dépasse 25 Mo.`);
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
        if (res.statusCode === 401 || res.statusCode === 403) return reject(new Error('Clé refusée : vérifie-la dans Paramètres → Données et sécurité → Lecture de factures.'));
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
  if (start < 0 || end <= start) throw erreur('ERR-ENT-020', 'Le service n\'a pas renvoyé de facture lisible.');
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
  if (!type) throw erreur('ERR-ENT-021', 'Format non reconnu. Utilise une photo (JPG, PNG, WEBP) ou un PDF.');
  const size = fs.statSync(f).size;
  if (size > 10 * 1024 * 1024) throw erreur('ERR-ENT-022', `« ${path.basename(f)} » fait ${(size / 1024 / 1024).toFixed(1)} Mo. Au-delà de 10 Mo, le service refuse l'image : prends une photo un peu moins lourde.`);
  return { path: f, name: path.basename(f), size, type };
});

// La lecture elle-même. Appelée seulement quand l'utilisateur a saisi une clé ET cliqué « Lire ».
ipcMain.handle('ocr:read', async (_e, { path: file } = {}) => {
  const cfg = readOcrCfg();
  if (!cfg.key) throw erreur('ERR-ENT-023', 'Aucune clé n\'est enregistrée : rien n\'a été envoyé. Paramètres → Données et sécurité → Lecture de factures.');
  if (!file || !fs.existsSync(file)) throw erreur('ERR-ENT-012', 'Fichier introuvable.');
  const type = OCR_TYPES[path.extname(file).toLowerCase()];
  if (!type) throw erreur('ERR-ENT-021', 'Format non reconnu.');
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

const { fitToPage, paginate, canalDe } = require('./renderer/core.js');

// Rend un document HTML en PDF A4. Le HTML passe par un fichier temporaire : une URL data:
// est limitée en taille (logo en base64).
async function renderPdf(html, win) {
  const tmp = path.join(app.getPath('temp'), `skanfact-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  try {
    await win.loadFile(tmp);
    // Même règle que l'aperçu : si le contenu déborde d'un peu, marges resserrées pour tenir sur une
    // page ; puis découpage en vraies pages A4 (pied de page et numéro sur chacune). Les deux
    // fonctions sont sérialisées : elles n'appellent rien d'autre dans core.js, exprès.
    try { await win.webContents.executeJavaScript('(' + fitToPage.toString() + ')(document)'); } catch (e) { logToFile('fitToPage', e); }
    try { await win.webContents.executeJavaScript('(' + paginate.toString() + ')(document)'); } catch (e) { logToFile('paginate', e); }
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
ipcMain.handle('licence:status', (_e, opts) => licenceStatus((opts || {}).matricule));
ipcMain.handle('editeur:status', (_e, opts) => editeurStatus((opts || {}).depuis));
// On refuse d'enregistrer une clé invalide : mieux vaut le dire tout de suite que laisser
// l'utilisateur croire qu'il est en règle et découvrir le contraire au moment de facturer.
// Même chose pour une clé authentique émise pour une AUTRE entreprise : on dit pour qui elle est.
ipcMain.handle('licence:set', (_e, key, opts) => {
  const k = String(key || '').trim();
  const matricule = (opts || {}).matricule || '';
  if (!k) {
    // La clé du dossier ET celle héritée de la 6.4.0 (userData) : sans la seconde, readLicence()
    // la recopierait dans le dossier au prochain appel et « Retirer » ne retirerait rien.
    ecrireLicence('');                         // garde la date d'armement du dossier, retire la clé
    try { fs.unlinkSync(LIC_ANCIEN()); } catch {}
    return licenceStatus(matricule);
  }
  const cles = clePublique().cles;
  if (cles.length && !L.verifyKey(k, cles)) {
    const err = new Error('Cette clé n\'est pas reconnue. Vérifie qu\'elle a été copiée en entier, de « SKAN1. » jusqu\'au dernier caractère.');
    err.code = 'LICENCE_INVALIDE';
    throw err;
  }
  const essai = L.licenceState({ key: k, cles, matricule, today: L.today() });
  if (essai.state === 'autre') {
    const err = new Error(essai.detail);
    err.code = 'LICENCE_AUTRE_ENTREPRISE';
    throw err;
  }
  ecrireLicence(k);
  // La clé vient d'être collée : on l'annonce tout de suite plutôt que d'attendre vingt secondes.
  // C'est ce qui fait qu'une vente apparaît dans la console pendant que le client est encore au
  // téléphone. Détaché exprès — l'enregistrement de la clé ne doit dépendre d'aucun réseau.
  annoncerPlateforme().catch(() => {});
  return licenceStatus(matricule);
});

ipcMain.handle('licence:requestMail', (_e, { company, device } = {}) => L.requestMail(company || {}, licenceStatus((company || {}).matricule), device || ''));

// ---------- éditeur (7.33.0) : les clés, et l'émission d'une licence ----------
// Tout ce qui touche à la clé privée se passe ICI. L'écran demande, le processus principal signe,
// et ce qui repasse le pont est une chaîne « SKAN1.… » — jamais le fichier .pem.
ipcMain.handle('editeur:keygen', () => {
  if (editeurActif()) {
    const err = new Error(`Il existe déjà une clé privée sur cet ordinateur (${CLE_PRIVEE()}). En créer une nouvelle rendrait INVALIDES toutes les licences déjà émises.`);
    err.code = 'CLE_EXISTANTE';
    throw err;
  }
  const { publicKey: pubPem, privateKey } = L.generateKeys();
  fs.mkdirSync(CLES_DIR(), { recursive: true });
  fs.writeFileSync(CLE_PRIVEE(), privateKey, { mode: 0o600 });
  fs.writeFileSync(CLE_PUBLIQUE_EDITEUR(), JSON.stringify({ format: L.FORMAT, publicKey: pubPem, createdAt: L.today() }, null, 2) + '\n');
  clePubliqueCache = null;
  return editeurStatus();
});
// Changer d'ordinateur : on reprend le fichier de clé privée mis à l'abri (clé USB, gestionnaire de
// mots de passe). La publique se déduit — inutile de la transporter.
ipcMain.handle('editeur:importer', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Reprendre ma clé privée de signature', properties: ['openFile'],
    filters: [{ name: 'Clé privée', extensions: ['pem'] }, { name: 'Tous les fichiers', extensions: ['*'] }]
  });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  const pem = fs.readFileSync(r.filePaths[0], 'utf8');
  let pubPem;
  try { pubPem = crypto.createPublicKey(crypto.createPrivateKey(pem)).export({ type: 'spki', format: 'pem' }); }
  catch { const err = new Error('Ce fichier n\'est pas une clé privée de signature SkanFact.'); err.code = 'CLE_ILLISIBLE'; throw err; }
  if (editeurActif() && lirePrivee().trim() !== pem.trim()) {
    const err = new Error(`Une AUTRE clé privée existe déjà sur cet ordinateur (${CLE_PRIVEE()}). Deux clés, ce sont deux jeux de licences incompatibles : mets l'ancienne de côté d'abord.`);
    err.code = 'CLE_EXISTANTE';
    throw err;
  }
  // La date d'armement voyage avec le fichier public posé à côté du .pem, quand il y en a un ;
  // sinon c'est aujourd'hui — elle ne compte que pour un poste éditeur, jamais pour les clients.
  const voisin = lireJson(path.join(path.dirname(r.filePaths[0]), 'licence-publique.json'));
  fs.mkdirSync(CLES_DIR(), { recursive: true });
  fs.writeFileSync(CLE_PRIVEE(), pem, { mode: 0o600 });
  fs.writeFileSync(CLE_PUBLIQUE_EDITEUR(), JSON.stringify({ format: L.FORMAT, publicKey: pubPem, createdAt: (voisin && voisin.createdAt) || L.today() }, null, 2) + '\n');
  clePubliqueCache = null;
  return editeurStatus();
});
// Une copie de la clé privée, là où l'éditeur la met à l'abri. Sans copie, un disque qui lâche
// rend impossible tout renouvellement chez les clients existants.
ipcMain.handle('editeur:exporter', async () => {
  if (!editeurActif()) return { canceled: true };
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer une copie de ma clé privée', defaultPath: 'skanfact-licence-privee.pem',
    filters: [{ name: 'Clé privée', extensions: ['pem'] }]
  });
  if (r.canceled || !r.filePath) return { canceled: true };
  fs.copyFileSync(CLE_PRIVEE(), r.filePath);
  try { fs.chmodSync(r.filePath, 0o600); } catch {}
  // Le fichier public voyage avec elle : c'est lui qui porte la date d'armement. On le DIT (deux
  // fichiers déposés, pas un), et on n'écrase jamais un fichier public d'une AUTRE clé.
  const voisin = path.join(path.dirname(r.filePath), 'licence-publique.json');
  const mienne = lireJson(CLE_PUBLIQUE_EDITEUR());
  const deja = lireJson(voisin);
  let publique = '';
  if (mienne && (!deja || deja.publicKey === mienne.publicKey)) {
    try { fs.copyFileSync(CLE_PUBLIQUE_EDITEUR(), voisin); publique = voisin; } catch {}
  }
  return { ok: true, path: r.filePath, publique, autreCle: !!(deja && mienne && deja.publicKey !== mienne.publicKey) };
});
// La clé PUBLIQUE, dans le presse-papiers : c'est elle que l'éditeur colle pour armer l'application
// de tout le monde (build/licence-public.json). Elle n'a rien de secret.
ipcMain.handle('editeur:copierPublique', () => {
  const txt = fs.readFileSync(CLE_PUBLIQUE_EDITEUR(), 'utf8');
  require('electron').clipboard.writeText(txt);
  return { ok: true, texte: txt };
});

// ---------- la clé de réponse du plan de contrôle (8.4.0) ----------
// Le serveur SIGNE ses réponses, l'application les vérifie : c'est ce qui empêche un intermédiaire
// de répondre « révoquée » à un client honnête. Il faut donc une paire de clés de plus, et elle se
// fabrique ICI, sur l'ordinateur de l'éditeur — jamais ailleurs, et surtout jamais dans une
// conversation. Le même geste qu'en 7.33.0 pour les clés de licence, et pour la même raison :
// une clé privée dont dépend l'application n'a rien à faire dans un canal qu'on ne maîtrise pas.
//
// Ensuite, deux moitiés qui partent à deux endroits :
//   - la PRIVÉE se colle dans les réglages du worker Cloudflare (secret `REPONSE_PRIVATE_KEY`) ;
//   - la PUBLIQUE se colle dans `build/licences-publiques.json`, et se publie avec l'application.
// Tant que la publique n'est pas embarquée, aucune réponse ne peut restreindre quoi que ce soit :
// la mise en place est donc sans danger, et l'ordre des deux gestes n'a pas d'importance.
ipcMain.handle('editeur:cleReponseCreer', () => {
  if (fs.existsSync(REPONSE_PRIVEE())) {
    const err = new Error(`Il existe déjà une clé de réponse sur cet ordinateur (${REPONSE_PRIVEE()}). En créer une nouvelle ferait ignorer toutes les réponses du serveur jusqu'à la prochaine version publiée.`);
    err.code = 'CLE_EXISTANTE';
    throw err;
  }
  const { publicKey: pubPem, privateKey } = L.generateKeys();
  fs.mkdirSync(CLES_DIR(), { recursive: true });
  fs.writeFileSync(REPONSE_PRIVEE(), privateKey, { mode: 0o600 });
  fs.writeFileSync(REPONSE_PUBLIQUE(), JSON.stringify({ publicKey: pubPem, depuis: L.today() }, null, 2) + '\n');
  clePubliqueCache = null;
  return editeurStatus();
});
// La privée ne traverse pas le pont : elle va de main.js au presse-papiers, et l'écran n'en reçoit
// que la confirmation. Elle est de toute façon destinée à un formulaire de Cloudflare, pas à une
// fenêtre de SkanFact.
ipcMain.handle('editeur:cleReponseCopier', (_e, quoi) => {
  const privee = String(quoi || '') === 'privee';
  const chemin = privee ? REPONSE_PRIVEE() : REPONSE_PUBLIQUE();
  if (!fs.existsSync(chemin)) { const err = new Error('Aucune clé de réponse sur cet ordinateur.'); err.code = 'PAS_DE_CLE'; throw err; }
  require('electron').clipboard.writeText(fs.readFileSync(chemin, 'utf8'));
  return { ok: true, privee };
});
// La clé du SERVEUR (8.5.0) : même geste, même discipline que la clé de réponse. Sa moitié privée
// va dans le réglage `SRV_PRIVATE_KEY` du worker ; sa moitié publique dans
// `build/licences-publiques.json` sous le kid « srv-1 » ET dans `LICENCE_PUBLIC_KEYS` du worker.
// Tant que la publique n'est pas embarquée dans une version publiée, une clé émise depuis la
// console est refusée par les clients — c'est le panneau qui le dit.
ipcMain.handle('editeur:cleServeurCreer', () => {
  if (fs.existsSync(SRV_PRIVEE())) {
    const err = new Error(`Il existe déjà une clé de serveur sur cet ordinateur (${SRV_PRIVEE()}). En créer une nouvelle ferait refuser toutes les clés émises par la console jusqu'à la prochaine version publiée.`);
    err.code = 'CLE_EXISTANTE';
    throw err;
  }
  const { publicKey: pubPem, privateKey } = L.generateKeys();
  fs.mkdirSync(CLES_DIR(), { recursive: true });
  fs.writeFileSync(SRV_PRIVEE(), privateKey, { mode: 0o600 });
  fs.writeFileSync(SRV_PUBLIQUE(), JSON.stringify({ kid: SRV_KID, publicKey: pubPem, depuis: L.today() }, null, 2) + '\n');
  clePubliqueCache = null;
  return editeurStatus();
});
// La privée ne traverse pas le pont : de main.js au presse-papiers, et l'écran n'en reçoit que la
// confirmation — même règle que `editeur:cleReponseCopier`.
ipcMain.handle('editeur:cleServeurCopier', (_e, quoi) => {
  const privee = String(quoi || '') === 'privee';
  const chemin = privee ? SRV_PRIVEE() : SRV_PUBLIQUE();
  if (!fs.existsSync(chemin)) { const err = new Error('Aucune clé de serveur sur cet ordinateur.'); err.code = 'PAS_DE_CLE'; throw err; }
  // « service » : la valeur COMPLÈTE de LICENCE_PUBLIC_KEYS, prête à coller — toutes les clés que
  // l'application embarque, plus celle-ci. Le 15/09/2026, Skander a collé la clé seule dans le
  // réglage, comme l'écran l'y invitait : le service ne trouvait plus AUCUNE clé, ni srv-1 pour
  // émettre, ni la maître pour vérifier. Une liste s'assemble ici, jamais à la main.
  if (String(quoi || '') === 'service') {
    const mienne = lireJson(SRV_PUBLIQUE()) || {};
    const cles = clePublique().cles.filter(c => c.kid !== SRV_KID).map(c => ({ kid: c.kid, publicKey: c.publicKey }));
    cles.push({ kid: SRV_KID, publicKey: String(mienne.publicKey || '') });
    require('electron').clipboard.writeText(JSON.stringify(cles));
    return { ok: true, privee: false, service: true, nombre: cles.length };
  }
  require('electron').clipboard.writeText(fs.readFileSync(chemin, 'utf8'));
  return { ok: true, privee };
});
// ---------- le pont comptable (8.7.0, § 11 du plan) ----------
//
// SkanFact TIRE les ventes de la console (un serveur ne peut pas écrire dans un logiciel de bureau
// éteint), fabrique un brouillon de facture par vente, et rend le numéro une fois la facture émise.
// Le secret d'administration de la console vit sur le poste de l'éditeur, à côté de ses clés
// (`~/.skanfact/plateforme-admin.json`, mode 0600) : jamais dans les données, jamais dans une
// sauvegarde, jamais dans un dossier partagé. Sans lui, rien ici ne répond — et rien n'en dépend.
const PONT_ADMIN = () => path.join(CLES_DIR(), 'plateforme-admin.json');
const pontSecret = () => String(((lireJson(PONT_ADMIN()) || {}).secret) || '').trim();
const PONT_MIN = 24;
// Seuls les chemins de l'espace d'administration, jamais un chemin composé depuis l'écran.
const PONT_CHEMIN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+){0,2}(\?[A-Za-z0-9_=&-]*)?$/;
async function pontRequete(chemin, corps) {
  if (!editeurActif()) { throw erreur('ERR-ENT-070', 'Le pont comptable ne s\'utilise que sur le poste de l\'éditeur.'); }
  if (!plateformeBase()) { throw erreur('ERR-ENT-071', 'Aucune adresse de plan de contrôle dans cette version.'); }
  const secret = pontSecret();
  if (!secret) { throw erreur('ERR-ENT-072', 'Colle d\'abord le secret d\'administration de la console (Paramètres → L\'application → Éditeur).'); }
  const c = String(chemin || '');
  if (!PONT_CHEMIN.test(c) || c.includes('..')) { throw erreur('ERR-ENT-073', 'Chemin refusé.'); }
  let r;
  try { r = await requetePlateforme('/v1/admin/' + c, { corps, entetes: { 'X-SkanFact-Admin': secret }, timeout: 15000, max: 4 * 1024 * 1024 }); }
  catch (e) {
    // Aucun message brut à l'écran (7.26.0) : « socket hang up » va dans le journal, pas sous les yeux.
    logToFile('pont ' + c, e);
    throw erreur('ERR-ENT-074', 'La console ne répond pas. Vérifie ta connexion, ou réessaie dans un instant.');
  }
  if (r.status === 403) { throw erreur('ERR-ENT-075', 'La console refuse ce secret d\'administration : vérifie-le dans Paramètres → L\'application → Éditeur.'); }
  if (r.status >= 400) { throw erreur('ERR-ENT-076', (r.corps && r.corps.erreur) || ('La console a répondu ' + r.status + '.')); }
  return r.corps;
}
ipcMain.handle('pont:status', () => ({ editeur: editeurActif(), base: plateformeBase(), configure: !!pontSecret() }));
// Enregistrer le secret, puis l'ESSAYER tout de suite : un secret enregistré sans être vérifié se
// découvre faux le jour où l'on en a besoin. Vide, il s'efface.
ipcMain.handle('pont:setSecret', async (_e, secret) => {
  if (!editeurActif()) { throw erreur('ERR-ENT-070', 'Le pont comptable ne s\'utilise que sur le poste de l\'éditeur.'); }
  const s = String(secret || '').trim();
  if (!s) { try { fs.unlinkSync(PONT_ADMIN()); } catch {} return { configure: false }; }
  if (s.length < PONT_MIN) { throw erreur('ERR-ENT-072', `Le secret d'administration fait au moins ${PONT_MIN} caractères : celui-ci en a ${s.length}.`); }
  fs.mkdirSync(CLES_DIR(), { recursive: true });
  // L'ancien secret est gardé sous la main : si le nouveau est refusé, il reprend sa place — un
  // secret faux ne doit pas remplacer un secret qui marchait, ni rester écrit après un refus.
  const ancien = fs.existsSync(PONT_ADMIN()) ? fs.readFileSync(PONT_ADMIN(), 'utf8') : null;
  fs.writeFileSync(PONT_ADMIN(), JSON.stringify({ secret: s }, null, 2), { mode: 0o600 });
  let etat;
  try { etat = await pontRequete('etat'); }
  catch (e) {
    if (ancien === null) { try { fs.unlinkSync(PONT_ADMIN()); } catch {} }
    else fs.writeFileSync(PONT_ADMIN(), ancien, { mode: 0o600 });
    throw e;
  }
  return { configure: true, etat };
});
ipcMain.handle('pont:requete', (_e, chemin, corps) => pontRequete(chemin, corps));

// Émettre une licence : l'écran envoie les champs, le processus principal vérifie et signe.
ipcMain.handle('licence:emettre', (_e, p) => {
  if (!editeurActif()) { const err = new Error('Aucune clé privée sur cet ordinateur : crée tes clés dans Paramètres → L\'application → Licence.'); err.code = 'PAS_EDITEUR'; throw err; }
  p = p || {};
  const nom = String(p.nom || '').trim();
  if (!nom) { const err = new Error('La licence doit porter le nom de l\'entreprise.'); err.code = 'LICENCE_NOM'; throw err; }
  // Le TYPE (9.4.0) : une licence d'entreprise, ou une licence de CABINET. Une licence de cabinet
  // n'a pas d'offre ni de matricule — son sujet est l'empreinte du cabinet, et ce qu'elle porte est
  // un quota de dossiers hors SkanFact. Les deux ne se mélangent jamais : l'application entreprise
  // refuse une clé de cabinet, et réciproquement.
  const type = p.type === 'cabinet' ? 'cabinet' : 'entreprise';
  if (type === 'cabinet') {
    const emp = String(p.cabinet || '').trim().toUpperCase();
    if (!/^[0-9A-F]{4}(-[0-9A-F]{4}){4}$/.test(emp)) {
      const err = new Error('Une licence de cabinet est attachée à son EMPREINTE : cinq groupes de quatre caractères hexadécimaux, comme 3F9A-2C1E-….');
      err.code = 'LICENCE_EMPREINTE'; throw err;
    }
    const quota = Math.round(Number(p.dossiersHors));
    if (!Number.isFinite(quota) || quota < 1 || quota > 5000) {
      const err = new Error('Combien de dossiers hors SkanFact cette licence couvre-t-elle, en plus des trois gratuits ? (entre 1 et 5000)');
      err.code = 'LICENCE_QUOTA'; throw err;
    }
  }
  const offre = type === 'cabinet' ? 'cabinet' : (L.OFFRES[p.offre] ? p.offre : '');
  if (!offre) { const err = new Error('Choisis une offre : Indépendant ou Entreprise.'); err.code = 'LICENCE_OFFRE'; throw err; }
  // Soit une durée (« 1a », « vie », « date » + date libre), soit une date de fin toute faite ('' = à vie).
  // `depuis` : un renouvellement part de la fin de la licence précédente quand elle est encore
  // future — « À faire » réclame le renouvellement trente jours AVANT, et ces trente jours sont payés.
  const depart = L.dateValide(p.depuis) && p.depuis > L.today() ? p.depuis : L.today();
  const exp = p.duree ? L.expirationPour(depart, p.duree, p.dateLibre) : (p.exp == null ? null : String(p.exp));
  if (exp === null || (exp && !(L.dateValide(exp) && L.daysBetween(L.today(), exp) > 0))) {
    const err = new Error('La date de fin doit être dans le futur (ou vide pour une licence à vie).'); err.code = 'LICENCE_DATE'; throw err;
  }
  const payload = {
    id: L.licenceId(), nom, matricule: String(p.matricule || '').trim(), offre, exp,
    cabinet: String(p.cabinet || '').trim().toUpperCase(), note: String(p.note || '').trim(), emisLe: L.today(),
    // Les deux champs de la 9.4.0, en QUEUE de charge : ajoutés au milieu, ils changeraient l'ordre
    // des champs déjà signés, et une clé refabriquée depuis sa charge rangée en base ne serait plus
    // identique à celle qu'on a envoyée (Ed25519 est déterministe — c'est ce qui le permet).
    type, dossiersHors: type === 'cabinet' ? Math.round(Number(p.dossiersHors)) : 0
  };
  return { key: L.signLicence(payload, lirePrivee()), ...payload };
});

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
  catch { throw erreur('ERR-ENT-030', 'Ce fichier n\'est pas lisible.'); }
  if (!j || j.kind !== 'cabinet' || !j.publicKey) throw erreur('ERR-ENT-030', 'Ce fichier n\'est pas un appairage de cabinet.');
  let fingerprint;
  try { fingerprint = keyFingerprint(j.publicKey); }
  catch { throw erreur('ERR-ENT-030', 'La clé de ce cabinet est illisible.'); }
  // L'empreinte annoncée dans le fichier doit correspondre à la clé qu'il contient : sinon quelqu'un
  // a changé l'une des deux, et c'est exactement ce qu'un imposteur ferait.
  if (j.fingerprint && j.fingerprint !== fingerprint) throw erreur('ERR-ENT-030', 'Fichier incohérent : l\'empreinte ne correspond pas à la clé.');
  return { name: String(j.name || ''), email: String(j.email || ''), publicKey: String(j.publicKey), fingerprint, pairedAt: new Date().toISOString() };
});

// ---------- le dossier de clôture reçu du cabinet (9.8.0) ----------
//
// Le flux RETOUR. Sans lui, le bilan du cabinet et celui du client divergent pour toujours, et
// personne ne s'en aperçoit avant le contrôle. Ce handler LIT et VÉRIFIE ; il n'écrit rien dans les
// données — c'est le renderer qui décide, après avoir montré ce qui va changer.
ipcMain.handle('cloture:lire', async (_e, { motDePasse } = {}) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Le dossier de clôture envoyé par ton comptable',
    filters: [{ name: 'Clôture SkanFact', extensions: ['skanclose'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || !filePaths[0]) return null;
  let buf;
  try { buf = fs.readFileSync(filePaths[0]); }
  catch { throw erreur('ERR-ENT-080', 'Ce fichier n\'a pas pu être lu.'); }
  if (isSealed(buf)) {
    if (!motDePasse) throw erreur('ERR-ENT-081', 'Ce dossier de clôture est protégé par un mot de passe. Ton comptable te le dit au téléphone, jamais dans le même mail que le fichier.');
    try { buf = openBuffer(buf, String(motDePasse)); }
    catch (e) { throw erreur('ERR-ENT-081', e.message); }
  }
  let fichiers;
  try { fichiers = zipRead(buf); }
  catch { throw erreur('ERR-ENT-080', 'Ce fichier n\'est pas un dossier de clôture SkanFact.'); }
  const par = {};
  // `zipRead` rend `data` en fonction PARESSEUSE (elle décompresse et vérifie le CRC à l'appel).
  // Ranger la fonction au lieu des octets donne un « [object Function] » qui ne ressemble à rien —
  // et c'est le parcours réel qui l'a montré, jamais la relecture.
  fichiers.forEach(f => { try { par[f.name] = f.data(); } catch (e) { logToFile('cloture-lire', e); } });
  if (!par['cloture.json']) throw erreur('ERR-ENT-080', 'Ce fichier ne contient pas de dossier de clôture.');
  let obj;
  try { obj = JSON.parse(par['cloture.json'].toString('utf8')); }
  catch { throw erreur('ERR-ENT-080', 'Le dossier de clôture est abîmé.'); }

  // L'ORIGINE. Chiffrer dit « seul lui peut lire » ; seule une signature dit « ça vient de lui ».
  // Confiance au premier usage, exactement comme le cabinet fait pour ses clients depuis la 9.2.0 :
  // une fois une clé épinglée, un dossier non signé ou signé d'une autre clé est REFUSÉ.
  let origine = { niveau: 'non-prouvee', empreinte: '', motif: 'Ce dossier n\'est pas signé : rien ne prouve qu\'il vient de ton cabinet.' };
  if (par['manifeste.json'] && par['signature.json']) {
    let sig = null;
    try { sig = JSON.parse(par['signature.json'].toString('utf8')); } catch { sig = null; }
    const v = sig ? verifyManifest(par['manifeste.json'], sig) : { ok: false, motif: 'signature illisible' };
    origine = v.ok
      ? { niveau: 'prouvee', empreinte: sig.empreinte, motif: '' }
      : { niveau: 'refusee', empreinte: (sig && sig.empreinte) || '', motif: v.motif || 'La signature ne correspond pas.' };
  }
  return {
    path: filePaths[0], cloture: obj, origine,
    // Les deux documents lisibles par n'importe qui, écrits à côté du fichier pour être ouverts.
    etatsHtml: par['etats.html'] ? par['etats.html'].toString('utf8') : '',
    pdf: !!par['etats.pdf'],
    fichiers: fichiers.map(f => f.name)
  };
});

// Écrire les deux documents à côté du fichier reçu et les ouvrir : un client qui ne lit pas la
// comptabilité veut voir SON bilan, pas une liste d'à-nouveaux.
ipcMain.handle('cloture:ouvrirEtats', async (_e, { source, html, pdf } = {}) => {
  if (!html && !pdf) throw erreur('ERR-ENT-082', 'Ce dossier de clôture ne porte aucun document à ouvrir.');
  const dir = path.join(app.getPath('temp'), 'skanfact-cloture');
  fs.mkdirSync(dir, { recursive: true });
  const cible = path.join(dir, 'etats-' + String(source || 'cloture').replace(/[^\w-]/g, '') + '.html');
  fs.writeFileSync(cible, String(html || ''), 'utf8');
  await shell.openPath(cible);
  return { ok: true, path: cible };
});

// ---------- les questions du cabinet (9.10.0) ----------
//
// Le second flux retour, et le seul qui arrive EN FACE d'une pièce. Comme pour la clôture, ce
// handler LIT et VÉRIFIE ; il n'écrit rien dans les données — c'est le renderer qui décide, après
// avoir montré ce qui arrive. Et comme pour la clôture, l'origine se prouve par une signature :
// chiffrer dit « seul toi peux lire », seule une signature dit « ça vient bien de ton comptable ».
ipcMain.handle('questions:lire', async (_e, { motDePasse } = {}) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Les questions envoyées par ton comptable',
    filters: [{ name: 'Questions SkanFact', extensions: ['skanask'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || !filePaths[0]) return null;
  let buf;
  try { buf = fs.readFileSync(filePaths[0]); }
  catch { throw erreur('ERR-ENT-083', 'Ce fichier n\'a pas pu être lu.'); }
  if (isSealed(buf)) {
    if (!motDePasse) throw erreur('ERR-ENT-084', 'Cet envoi de questions est protégé par un mot de passe. Ton comptable te le dit au téléphone, jamais dans le même mail que le fichier.');
    try { buf = openBuffer(buf, String(motDePasse)); }
    catch (e) { throw erreur('ERR-ENT-084', e.message); }
  }
  let fichiers;
  try { fichiers = zipRead(buf); }
  catch { throw erreur('ERR-ENT-083', 'Ce fichier n\'est pas un envoi de questions SkanFact.'); }
  const par = {};
  fichiers.forEach(f => { try { par[f.name] = f.data(); } catch (e) { logToFile('questions-lire', e); } });
  if (!par['questions.json']) throw erreur('ERR-ENT-083', 'Ce fichier ne contient aucune question.');
  let obj;
  try { obj = JSON.parse(par['questions.json'].toString('utf8')); }
  catch { throw erreur('ERR-ENT-083', 'L\'envoi de questions est abîmé.'); }

  let origine = { niveau: 'non-prouvee', empreinte: '', motif: 'Cet envoi n\'est pas signé : rien ne prouve qu\'il vient de ton cabinet.' };
  if (par['manifeste.json'] && par['signature.json']) {
    let sig = null;
    try { sig = JSON.parse(par['signature.json'].toString('utf8')); } catch { sig = null; }
    const v = sig ? verifyManifest(par['manifeste.json'], sig) : { ok: false, motif: 'signature illisible' };
    origine = v.ok
      ? { niveau: 'prouvee', empreinte: sig.empreinte, motif: '' }
      : { niveau: 'refusee', empreinte: (sig && sig.empreinte) || '', motif: v.motif || 'La signature ne correspond pas.' };
  }
  return { path: filePaths[0], envoi: obj, origine, fichiers: fichiers.map(f => f.name) };
});

// ---------- le paquet mensuel pour le cabinet (6.1.0) ----------
// Le renderer décide de CE QUE contient le paquet (core.packPlan, testable sans Electron) et fournit
// le HTML des pièces à rendre. Ici on ne fait qu'exécuter : produire les octets, empreinter, zipper,
// sceller, écrire. Cette séparation permet de tester tout le contenu du paquet sans lancer Electron.
ipcMain.handle('pack:build', async (_e, { plan, coverHtml, password, cabinetKey, suggestedName } = {}) => {
  if (!plan || !Array.isArray(plan.entries)) throw erreur('ERR-ENT-032', 'Plan de paquet invalide.');
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
      // L'ÉTAT de la licence de ce client, et rien de plus (9.4.0) : ni la clé, ni son nom, ni son
      // matricule — ils sont déjà ailleurs dans le manifeste. Le cabinet s'en sert pour savoir si
      // ce dossier compte dans SA licence à lui : un client sur SkanFact ne lui coûte rien. Un
      // paquet d'avant la 9.4.0 n'a pas ce champ, et le cabinet ne devine pas — il ne compte pas.
      licence: etatLicencePourPaquet(((plan.manifest || {}).entreprise || {}).matricule || ''),
      absents: missing,
      fichiers: files.map(f => ({ chemin: f.name, octets: f.data.length, empreinte: sha256(f.data) }))
    };
    const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    files.unshift({ name: 'manifeste.json', data: manifestBuf });
    step('Manifeste');

    // La SIGNATURE (9.2.0), écrite après le manifeste et portant ses octets exacts. Chiffrer dit
    // « seul le cabinet peut lire » ; signer dit « ça vient bien de son client ». Sans elle,
    // quiconque tenait la clé publique du cabinet — que le comptable donne à tous ses clients —
    // pouvait lui envoyer un paquet au nom d'une autre entreprise.
    let signature = null;
    try {
      const k = cleClient();
      signature = signManifest(manifestBuf, k.privateKey, k.publicKey);
      files.push({ name: 'signature.json', data: Buffer.from(JSON.stringify(signature, null, 2), 'utf8') });
    } catch (e) {
      // Un paquet non signé reste un paquet : le cabinet le dira « origine non prouvée » plutôt que
      // de le refuser (sauf s'il a déjà épinglé la clé de ce client). Échouer ici priverait
      // quelqu'un de son envoi mensuel pour une clé qu'on n'a pas su écrire.
      logToFile('signature du paquet', e);
    }

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
      absents: missing, empreinte: sha256(manifestBuf),
      signe: !!signature, empreinteCle: signature ? signature.empreinte : null
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
// Une erreur qu'on va peut-être démentir par un second essai ne s'affiche pas tout de suite.
let silencerErreur = false;
// Un téléchargement est EN COURS. Sans ce drapeau, une coupure réseau à 40 % était avalée : la
// vérification du démarrage est silencieuse (`silent = true`) et le téléchargement démarre tout
// seul, donc l'erreur tombait dans le `if (!silent)` du gestionnaire — barre de progression figée,
// pastille figée, panneau sans un seul bouton, et aucun moyen de relancer quoi que ce soit.
// Une panne PENDANT un téléchargement que l'utilisateur voit se dit toujours.
let enTelechargement = false;

const UPDATE_CFG = () => path.join(app.getPath('userData'), 'update-config.json');
const UPDATE_RESULT = () => path.join(app.getPath('userData'), 'update-result.json');
function readUpdateCfg() { try { return JSON.parse(fs.readFileSync(UPDATE_CFG(), 'utf8')); } catch { return {}; } }
function writeUpdateCfg(cfg) { fs.mkdirSync(path.dirname(UPDATE_CFG()), { recursive: true }); fs.writeFileSync(UPDATE_CFG(), JSON.stringify(cfg), { mode: 0o600 }); }

// Quand la dernière vérification a eu lieu, et ce qu'elle a répondu.
//
// Jusqu'à la 7.30.0, l'application vérifiait UNE fois, cinq secondes après l'ouverture, et plus
// jamais : quelqu'un qui ne quitte pas SkanFact de la semaine ne voyait rien arriver. Et rien, nulle
// part, ne disait quand la dernière vérification avait eu lieu — donc « Tu as la dernière version »
// pouvait dater d'un mois sans qu'on puisse le savoir. Un écran qui affirme sans dire QUAND il l'a
// constaté n'est pas vérifiable ; on le range donc à côté de la phrase.
//
// Le résultat s'écrit là où on l'apprend (les événements d'electron-updater), jamais à l'endroit
// d'où l'on part : `checkForUpdates` rend la main avant que la réponse n'arrive.
const MAJ_INTERVALLE = 4 * 60 * 60 * 1000;      // quatre heures
const MAJ_ETAT = () => path.join(app.getPath('userData'), 'update-state.json');
function readMajEtat() { try { return JSON.parse(fs.readFileSync(MAJ_ETAT(), 'utf8')); } catch { return {}; } }
function noterVerification(resultat, version) {
  try {
    fs.mkdirSync(path.dirname(MAJ_ETAT()), { recursive: true });
    fs.writeFileSync(MAJ_ETAT(), JSON.stringify({ at: Date.now(), resultat, version: version || '' }));
  } catch (_) { /* une date non écrite ne doit jamais empêcher une mise à jour */ }
}

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
  // Les en-têtes posés pour le relais (secret de l'application, clé de licence) ne doivent pas
  // partir vers GitHub ni vers le CDN des fichiers : on les retire AVANT de changer de flux.
  u.requestHeaders = null;
  u.setFeedURL({ provider: 'github', owner: GITHUB.owner, repo: GITHUB.repo, private: !!cfg.token, token: cfg.token || undefined });
}

// Le canal bêta (7.25.0). Deux canaux, un seul dépôt, une seule application :
//
//  - **latest** : ce que tout le monde reçoit. C'est le canal par défaut, et personne n'en sort
//    sans l'avoir demandé — la case vit dans Paramètres → L'application → Mises à jour et arrive décochée.
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

// Le relais a échoué PENDANT une vérification (et pas seulement au réglage). On n'y revient plus de
// la session : réessayer un service qui vient de refuser, c'est faire attendre pour rien.
let relayDown = false;

function configureFeed(u) {
  const base = relayBase();
  if (!base || relayDown) { feedGithub(u); return appliquerCanal(u); }
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
    autoUpdater.on('update-available', (info) => { updateInfo = info; downloaded = false; downloadedFile = null; enTelechargement = autoUpdater.autoDownload; noterVerification('available', info.version); sendUpdate('available', { version: info.version, notes: notesToText(info.releaseNotes) }); });
    // La date se note même quand la vérification était silencieuse : c'est justement celle-là qu'on
    // ne peut constater nulle part ailleurs, et c'est elle qui rend la phrase « tu as la dernière
    // version » vérifiable le lendemain.
    autoUpdater.on('update-not-available', () => { noterVerification('none'); if (!silent) sendUpdate('none'); });
    autoUpdater.on('download-progress', (p) => sendUpdate('downloading', { percent: Math.round(p.percent), version: updateInfo && updateInfo.version }));
    autoUpdater.on('update-downloaded', (info) => { downloaded = true; enTelechargement = false; downloadedFile = info.downloadedFile || null; sendUpdate('downloaded', { version: info.version, notes: notesToText(info.releaseNotes) }); });
    autoUpdater.on('error', (err) => { noterVerification('error'); const pendant = enTelechargement; enTelechargement = false; if ((pendant || !silent) && !silencerErreur) sendUpdate('error', updateProblem(err)); });
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

// Ce que l'utilisateur lit quand une mise à jour n'aboutit pas.
//
// **On ne montre jamais une phrase qu'on n'a pas écrite.** Les messages d'electron-updater sont en
// anglais et portent une URL, un chemin de fichier ou une pile d'appels. « Cannot find
// latest-mac.yml in the release https://github.com/… » est techniquement exact et parfaitement
// inutilisable : celui qui le lit ne peut rien en faire, et une application qui affiche ça a l'air
// cassée alors qu'elle ne l'est pas.
//
// Le texte d'origine n'est pas perdu pour autant — c'est lui qui sert au dépannage à distance
// (règle 6.7.2). Il part dans `detail`, replié derrière « Détails techniques », et dans le journal.
//
// `soft` marque ce qui n'est PAS une panne : une version en cours de publication, une bêta qui
// n'existe pas encore. Ça s'affiche en gris et pas en rouge — du rouge sur une situation normale
// apprend à ignorer le rouge.
function updateProblem(err) {
  const brut = String((err && err.message) || err || '').trim();
  // Le code vit sur l'ERREUR, pas dans son message : `ERR_UPDATER_CHANNEL_FILE_NOT_FOUND` ne figure
  // nulle part dans « Cannot find latest-mac.yml in the release … ». Le chercher dans le texte,
  // c'est ne jamais le trouver — et c'est exactement ce que faisait la version précédente.
  const code = String((err && err.code) || '');
  const tout = code + ' ' + brut;
  const detail = brut.split('\n')[0].slice(0, 300);
  const dit = (message, soft) => ({ message, detail, soft: !!soft });
  try { logToFile('mise à jour', err); } catch {}

  // Le fichier d'index manque dans une release qui, elle, EXISTE. C'est la signature d'une
  // publication en cours : GitHub crée le tag et la page de la version avant que les installateurs
  // finissent de monter, et il y a quelques minutes entre les deux — pile le moment où l'on va voir
  // si la nouvelle version est là.
  if (/CHANNEL_FILE_NOT_FOUND/.test(code) || /Cannot find .+ in the (latest )?release/i.test(brut)) {
    return readUpdateCfg().beta
      ? dit('Aucune version bêta publiée pour l\'instant. Tu as la dernière version stable ; décoche la case pour revenir au canal normal.', true)
      : dit('Une nouvelle version vient d\'être publiée et ses fichiers d\'installation finissent de monter en ligne. Réessaie dans quelques minutes.', true);
  }
  if (/NO_PUBLISHED_VERSIONS|LATEST_VERSION_NOT_FOUND/.test(code)) return dit('Aucune version publiée pour l\'instant.', true);
  if (/402/.test(tout)) return dit('Une licence en cours de validité est nécessaire pour recevoir les mises à jour.');
  if (/403/.test(tout) && relayBase()) return dit('Le service de mise à jour a refusé cette installation. Vérifie ta licence dans Paramètres → L\'application → Licence.');
  if (/401|403|Bad credentials/i.test(tout)) return dit('Le jeton d\'accès a été refusé ou a expiré. Génères-en un nouveau et colle-le ci-dessous.');
  if (/404/.test(tout)) return dit(
    relayBase() ? 'Aucune version trouvée. Réessaie plus tard, ou installe la nouvelle version à la main.'
      : GITHUB.private ? 'Aucune version trouvée : le jeton d\'accès manque, ou il n\'a pas accès au dépôt. Colle-le ci-dessous.'
        : 'Aucune version trouvée pour l\'instant.',
    !relayBase() && !GITHUB.private);
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN|net::/i.test(tout)) return dit('Impossible de joindre le service de mise à jour. Vérifie ta connexion internet.');
  if (/sha512|checksum|integrity/i.test(tout)) return dit('Le fichier téléchargé est incomplet ou abîmé. Réessaie.');
  if (/ENOSPC/i.test(tout)) return dit('Il n\'y a plus assez d\'espace disque pour télécharger la mise à jour.');
  if (/EACCES|EPERM/i.test(tout)) return dit('SkanFact n\'a pas le droit d\'écrire la mise à jour ici. Place l\'application dans le dossier Applications, puis réessaie.');
  // Dernier recours : on ne recopie pas l'anglais. On dit ce qu'on sait et on garde la cause.
  return dit('La mise à jour n\'a pas abouti. Réessaie dans un moment ; si ça continue, envoie le journal (Aide → Signaler un problème).');
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
  // 45 s maximum : sans réponse on rend la main avec un message plutôt que d'attendre sans fin.
  const patiente = () => new Promise((_, rej) => setTimeout(() => rej(new Error('ETIMEDOUT: pas de réponse')), 45000));
  // **Le repli n'est pas un réglage, c'est un réflexe.** Il y a DEUX chemins pour se mettre à jour —
  // le relais, et GitHub en direct — et jusqu'ici le second ne servait que lorsque le premier était
  // MAL RÉGLÉ (adresse invalide). Pas quand il répondait mal, c'est-à-dire le seul cas qui arrive
  // vraiment : l'application affichait alors une erreur en rouge alors qu'un autre chemin
  // parfaitement fonctionnel l'attendait juste à côté. C'est le défaut de la 6.7.2, une couche plus
  // bas. Sur un dépôt public, GitHub en direct marche sans rien présenter du tout.
  // Un clic sur « Vérifier maintenant » réessaie le relais, même s'il a échoué plus tôt dans la
  // session (9.8.8-beta.2, porté du Cabinet) : la cause la plus fréquente d'un échec est un index qui
  // finissait de monter en ligne, et c'est très exactement le moment où l'on clique. Les
  // vérifications silencieuses, elles, gardent le chemin qui a répondu.
  if (!isSilent && relayDown) { relayDown = false; relayFailure = ''; configureFeed(u); }
  const avecRelais = !!relayBase() && !relayDown;
  // Tant qu'un second essai reste possible, on ne crie pas : l'événement `error` du premier
  // échec afficherait un message rouge que le repli va démentir une seconde plus tard.
  silencerErreur = avecRelais;
  try {
    const r = await Promise.race([u.checkForUpdates(), patiente()]);
    silencerErreur = false;
    // null = electron-updater inactif dans cette installation (ex. Linux hors AppImage) : aucun événement n'arrivera
    if (!r) return { state: 'error', message: 'Le module de mise à jour est inactif dans cette installation. Installe la nouvelle version à la main.' };
    return { state: 'ok' };
  } catch (e) {
    if (avecRelais) {
      relayDown = true;
      relayFailure = `Le service de mise à jour n'a pas répondu (${String((e && e.message) || e).slice(0, 120)}). Téléchargement direct depuis GitHub.`;
      logToFile('relais de mise à jour', e);
      configureFeed(u);                              // relayDown est posé : on repart sur GitHub
      try {
        const r2 = await Promise.race([u.checkForUpdates(), patiente()]);
        silencerErreur = false;
        if (r2) return { state: 'ok' };
      } catch (e2) { silencerErreur = false; return { state: 'error', ...updateProblem(e2) }; }
    }
    silencerErreur = false;
    return { state: 'error', ...updateProblem(e) };
  }
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
  // `GITHUB.private` doit rester UN SEUL interrupteur : le jour où le dépôt redevient privé, on
  // bascule cette constante et l'écran se réarme tout seul — le champ où coller un jeton revient,
  // les phrases redeviennent vraies. Sans ce drapeau ici, l'interface ne pouvait plus le savoir :
  // la 7.24.0 avait retiré le champ « en dur » parce que le dépôt venait de passer public, et
  // basculer la constante n'aurait plus rien réarmé — on aurait lu « colle ton jeton ci-dessous »
  // au-dessus de rien du tout.
  private: GITHUB.private,
  // Le canal choisi, et ce que la version installée EST réellement. Les deux, parce qu'ils peuvent
  // se contredire une journée entière : on décoche la case un matin en tournant sur une bêta, et on
  // reste dessus jusqu'à ce que la stable suivante arrive. L'écran doit pouvoir le dire.
  beta: !!readUpdateCfg().beta,
  prerelease: canalDe(app.getVersion()) !== 'latest',
  // Quand la dernière vérification a eu lieu, et ce qu'elle a répondu. Sans ces deux valeurs,
  // l'écran par défaut ne savait rien dire d'autre qu'un bouton « Vérifier » : il ne pouvait ni
  // annoncer que tout est à jour, ni dire depuis quand.
  lastCheck: readMajEtat().at || 0,
  lastResult: readMajEtat().resultat || '',
  autoEvery: MAJ_INTERVALLE,
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
  enTelechargement = true;
  try { u.downloadUpdate(); return { state: 'ok' }; }
  catch (e) { return { state: 'error', ...updateProblem(e) }; }
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
