// Stockage local des données : un fichier JSON + sauvegardes. Aucune dépendance Electron
// pour pouvoir le tester avec `npm test`.
//
// Règles :
//  - écriture atomique (fichier temporaire puis renommage) : jamais de fichier à moitié écrit ;
//  - un fichier illisible n'est JAMAIS écrasé : il est mis de côté (skanfact-data.illisible-<date>.json)
//    et signalé pour que l'utilisateur restaure une sauvegarde ;
//  - la sauvegarde quotidienne est l'état du fichier AVANT la première écriture du jour
//    (on peut donc revenir à « ce matin » après une fausse manipulation), 30 jours conservés ;
//  - une sauvegarde nommée est prise avant tout import ou sur demande ;
//  - chiffrement optionnel du fichier (AES-256-GCM, clé dérivée du mot de passe par scrypt) ;
//    les sauvegardes sont alors chiffrées aussi ;
//  - copie miroir optionnelle vers un dossier externe (iCloud Drive, clé USB…), en arrière-plan.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DAILY_RE = /^skanfact-(\d{4}-\d{2}-\d{2})\.json$/;
const DAILY_KEEP = 30;
const NAMED_KEEP = 20;
const ENC_MARK = 'skanfact-encrypted';
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function stamp(d) {
  d = d || new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}`;
}

// Les filets : les sauvegardes que l'APPLICATION prend d'elle-même avant un geste risqué
// (« avant-import », « avant-demo », « avant-effacement »). Elles ont leur propre réserve, sinon
// vingt sauvegardes volontaires — Cmd+S, le réflexe universel — les chassent toutes.
const FILETS = /^avant-/;

// Jumeau de src/cabinet/cabstore.js : le nom porte la date que l'application a écrite (stamp()),
// au format AAAA-MM-JJ_HHhMMmSS, zéro-rempli. Son ordre alphabétique EST l'ordre du temps, sans
// aucun calcul de date, donc sans la moindre question de fuseau horaire. On s'y fie avant le mtime
// du disque, qui ment dans deux cas réels : sur Windows l'horloge système n'avance que toutes les
// ~15 ms (des copies successives portent le même mtime, et l'ordre devient arbitraire), et une
// copie — miroir externe, clé USB, changement d'ordinateur — réécrit tous les mtime.
const MARQUE = /(\d{4}-\d{2}-\d{2}(?:_\d{2}h\d{2}m\d{2})?)\.json$/;
function marque(name) { const m = MARQUE.exec(name); return m ? m[1] : ''; }
function plusAncienDabord(a, b) {
  const ma = marque(a.name), mb = marque(b.name);
  if (ma && mb && ma !== mb) return ma < mb ? -1 : 1;
  if (a.mtime !== b.mtime) return a.mtime - b.mtime;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;       // dernier recours : stable
}

function isValidData(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  for (const k of ['clients', 'catalog', 'documents']) {
    if (d[k] !== undefined && !Array.isArray(d[k])) return false;
  }
  if (d.company !== undefined && (typeof d.company !== 'object' || d.company === null)) return false;
  return true;
}

// ---------- chiffrement ----------

function isEncrypted(obj) { return !!(obj && typeof obj === 'object' && obj[ENC_MARK] === 1 && obj.salt && obj.iv && obj.tag && obj.data); }

function deriveKey(password, salt) {
  return crypto.scryptSync(String(password), salt, 32, SCRYPT);
}

function encryptWithKey(data, salt, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return { [ENC_MARK]: 1, kdf: 'scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: enc.toString('base64') };
}

function encryptData(data, password, salt) {
  salt = salt || crypto.randomBytes(16);
  return encryptWithKey(data, salt, deriveKey(password, salt));
}

// Déchiffre avec une clé déjà dérivée (évite de recalculer scrypt à chaque lecture).
function decryptWithKey(envelope, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

function decryptData(envelope, password) {
  const salt = Buffer.from(envelope.salt, 'base64');
  return decryptWithKey(envelope, deriveKey(password, salt));
}

// ---------- stockage ----------

function createStorage(dir, opts) {
  opts = opts || {};
  const now = opts.now || (() => new Date());
  const log = opts.log || (() => {});
  const file = path.join(dir, 'skanfact-data.json');
  const backupDir = path.join(dir, 'backups');
  // Pièces jointes : un sous-dossier par document, à côté du fichier de données. Elles ne sont pas
  // mises dans le JSON (une photo de facture pèse plus que toute la base) : le document ne garde que
  // le nom du fichier. Elles ne sont donc PAS dans les sauvegardes quotidiennes, qui sont un seul
  // fichier JSON — mais la copie externe, elle, les emporte.
  const attachDir = path.join(dir, 'pieces-jointes');
  // `revision` : celle du fichier tel qu'on l'a lu. Avant d'écrire, on vérifie que le fichier sur le
  // disque porte toujours ce numéro. S'il a changé, c'est qu'un autre poste a enregistré entre-temps :
  // on refuse d'écraser et on rend sa version à l'appelant, qui fusionne.
  const state = { corruptFile: null, key: null, salt: null, encrypted: false, revision: 0, deviceId: opts.deviceId || '', deviceName: opts.deviceName || '',
    external: { dir: opts.externalDir || null, lastCopy: null, lastError: null } };

  function today() { return stamp(now()).slice(0, 10); }

  function readRaw() {
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return { missing: true }; throw e; }
    try {
      const d = JSON.parse(raw);
      if (isEncrypted(d)) return { envelope: d };
      if (!isValidData(d)) throw new Error('structure inattendue');
      return { data: d };
    } catch (e) {
      const aside = path.join(dir, `skanfact-data.illisible-${stamp(now())}.json`);
      try { fs.renameSync(file, aside); state.corruptFile = aside; } catch (_) { state.corruptFile = file; }
      // La RAISON va au journal (10.0.1). L'écran dit « un fichier illisible a été mis de côté » —
      // c'est ce qu'il faut à l'utilisateur — mais pour dépanner à distance, « JSON mal formé » et
      // « structure inattendue » n'appellent pas du tout le même geste. C'est le seul endroit du
      // stockage où une erreur était jetée sans que rien nulle part ne dise pourquoi.
      log('fichier de données illisible, mis de côté : ' + aside, e);
      return { missing: true };
    }
  }

  // Lecture : données, ou null si absent, ou { locked: true } si chiffré sans clé en mémoire.
  function read() {
    const r = readRaw();
    if (r.missing) return null;
    if (r.envelope) {
      state.encrypted = true;
      if (!state.key) return { locked: true };
      try { return decryptWithKey(r.envelope, state.key); }
      catch (_) { return { locked: true }; }
    }
    state.encrypted = false;
    state.revision = Number(r.data.syncRevision) || 0;
    return r.data;
  }

  // Révision du fichier sur le disque, sans le déchiffrer entièrement quand c'est possible.
  // Un fichier chiffré ne révèle rien : on doit le déchiffrer pour le comparer.
  function diskRevision() {
    const r = readRaw();
    if (r.missing) return { missing: true, revision: 0 };
    if (r.envelope) {
      if (!state.key) return { locked: true, revision: state.revision };
      try { const d = decryptWithKey(r.envelope, state.key); return { revision: Number(d.syncRevision) || 0, data: d }; }
      catch (_) { return { locked: true, revision: state.revision }; }
    }
    return { revision: Number(r.data.syncRevision) || 0, data: r.data };
  }

  // Déverrouillage avec le mot de passe : conserve la clé pour la session.
  function unlock(password) {
    const r = readRaw();
    if (!r.envelope) { state.encrypted = false; return { ok: true, data: r.data || null }; }
    try {
      const salt = Buffer.from(r.envelope.salt, 'base64');
      const key = deriveKey(password, salt);
      const data = decryptWithKey(r.envelope, key);
      state.key = key; state.salt = salt; state.encrypted = true;
      return { ok: true, data };
    } catch (_) { return { ok: false, error: 'Mot de passe incorrect.' }; }
  }

  function lock() { state.key = null; state.salt = null; }

  // Active / change / retire le mot de passe. Réécrit le fichier immédiatement et convertit les
  // sauvegardes existantes (elles ne doivent jamais rester en clair à côté d'un fichier chiffré,
  // ni devenir illisibles quand on retire le mot de passe).
  function setPassword(data, password) {
    // L'état d'AVANT, pour pouvoir y revenir. `write` peut refuser — un autre poste a enregistré
    // entre-temps sur un dossier partagé — et il refuse en RENDANT le conflit, pas en levant. Ce
    // retour était jeté : la clé était déjà remplacée en mémoire, les sauvegardes se faisaient
    // rechiffrer avec elle, et l'écran annonçait « Données chiffrées » alors que le fichier de
    // données, lui, n'avait pas bougé. Au redémarrage, plus rien ne s'ouvrait avec le bon mot de
    // passe : le fichier réclamait l'ancien, les sauvegardes le nouveau.
    const avant = { key: state.key, salt: state.salt, encrypted: state.encrypted };
    if (password) {
      state.salt = crypto.randomBytes(16);
      state.key = deriveKey(password, state.salt);
      state.encrypted = true;
    } else {
      state.key = null; state.salt = null; state.encrypted = false;
    }
    let r;
    try { r = write(data); }
    catch (e) { Object.assign(state, avant); throw e; }
    if (r && r.conflict) {
      Object.assign(state, avant);
      return { ok: false, conflict: true, disk: r.disk };
    }
    convertBackups(avant.key);
    return { ok: true };
  }

  // Rechiffrer (ou déchiffrer) une sauvegarde en place. Rend `true` si le fichier a changé.
  function convertirUne(p, oldKey) {
    let d = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (isEncrypted(d)) { if (!oldKey) return false; d = decryptWithKey(d, oldKey); }
    const payload = state.key ? encryptWithKey(d, state.salt, state.key) : d;
    fs.writeFileSync(p + '.tmp', JSON.stringify(payload, null, state.key ? 0 : 2), 'utf8');
    fs.renameSync(p + '.tmp', p);
    return true;
  }

  function convertBackups(oldKey) {
    let names = [];
    try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch { return; }
    names.forEach(n => {
      try { convertirUne(path.join(backupDir, n), oldKey); }
      catch (e) { log('conversion sauvegarde ' + n, e); }
    });
    // La copie externe AUSSI, et c'est le point qui manquait.
    //
    // « Changer le mot de passe rechiffre les sauvegardes » est une règle posée en 6.8.0 — mais
    // elle ne valait que pour le dossier local. Sur la clé USB ou dans iCloud, `mirrorExternal` ne
    // recopiait un fichier que s'il n'existait pas encore : les sauvegardes déjà copiées en CLAIR
    // y restaient en clair pour toujours, à côté d'un fichier de données chiffré, pendant que
    // l'écran annonçait « le fichier de données et ses sauvegardes sont chiffrés ». Quelqu'un qui
    // active un mot de passe parce que son ordinateur voyage emporte donc trente jours de sa
    // comptabilité en clair sur la clé qui voyage avec lui.
    //
    // On les convertit sur place, sans rien supprimer : une sauvegarde externe plus ancienne que la
    // rotation locale de trente jours reste un filet, elle n'a pas à disparaître — elle a juste à
    // ne pas rester lisible.
    const ext = state.external.dir;
    if (ext) {
      try {
        const dossier = path.join(ext, 'SkanFact', 'backups');
        if (fs.existsSync(dossier)) {
          fs.readdirSync(dossier).filter(f => f.endsWith('.json')).forEach(n => {
            try { convertirUne(path.join(dossier, n), oldKey); }
            catch (e) { log('conversion sauvegarde externe ' + n, e); }
          });
        }
      } catch (e) { state.external.lastError = e.message; log('copie externe (conversion)', e); }
    }
    mirrorExternal();
  }

  // Écriture. Renvoie { ok: true } ou, si un autre poste a écrit entre-temps, { conflict: true, disk }
  // — dans ce cas RIEN n'est écrit : c'est à l'appelant de fusionner puis de réécrire avec force.
  function write(data, opts2) {
    opts2 = opts2 || {};
    if (!isValidData(data)) throw new Error('Données invalides : enregistrement refusé.');
    if (state.encrypted && !state.key) throw new Error('Données verrouillées : mot de passe requis.');
    if (!opts2.force) {
      const d = diskRevision();
      // On ne compare que si le fichier existe et qu'on sait le lire : un fichier absent ou verrouillé
      // ne prouve rien, et bloquer l'enregistrement là-dessus ferait plus de mal que de bien.
      if (!d.missing && !d.locked && d.revision !== state.revision) {
        return { conflict: true, disk: d.data, diskRevision: d.revision, myRevision: state.revision };
      }
    }
    fs.mkdirSync(dir, { recursive: true });
    snapshotDaily();
    const rev = Math.max(Number(state.revision) || 0, Number(data.syncRevision) || 0) + 1;
    const stamped = { ...data, syncRevision: rev, syncDevice: state.deviceId, syncDeviceName: state.deviceName, syncWrittenAt: now().getTime() };
    const payload = state.key ? encryptWithKey(stamped, state.salt, state.key) : stamped;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload, null, state.key ? 0 : 2), 'utf8');
    fs.renameSync(tmp, file);
    state.revision = rev;
    mirrorExternal();
    return { ok: true, revision: rev };
  }

  // Copie le fichier actuel vers backups/skanfact-AAAA-MM-JJ.json si ce n'est pas déjà fait aujourd'hui.
  function snapshotDaily() {
    if (!fs.existsSync(file)) return null;
    fs.mkdirSync(backupDir, { recursive: true });
    const target = path.join(backupDir, `skanfact-${today()}.json`);
    if (fs.existsSync(target)) return null;
    fs.copyFileSync(file, target);
    prune();
    return target;
  }

  // Sauvegarde nommée immédiate (avant import, ou à la demande de l'utilisateur).
  function backupNow(label) {
    if (!fs.existsSync(file)) return null;
    fs.mkdirSync(backupDir, { recursive: true });
    const safe = String(label || 'manuelle').replace(/[^a-z0-9_-]/gi, '_');
    const target = path.join(backupDir, `${safe}-${stamp(now())}.json`);
    fs.copyFileSync(file, target);
    prune();
    mirrorExternal();
    return target;
  }

  function prune() {
    let names;
    try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch { return; }
    // Les quotidiennes portent leur date dans leur nom : l'ordre alphabétique EST l'ordre du temps.
    const daily = names.filter(f => DAILY_RE.test(f)).sort();
    while (daily.length > DAILY_KEEP) fs.unlinkSync(path.join(backupDir, daily.shift()));
    // Les nommées, non — et elles étaient purgées par ordre ALPHABÉTIQUE. « avant-demo »,
    // « avant-effacement », « avant-import » passent toujours avant « manuelle-… » : le filet
    // disparaissait donc à la seconde où il était pris, pendant que l'écran annonçait qu'une
    // sauvegarde est faite avant. Même défaut corrigé dans l'app cabinet en 6.8.1, jamais porté
    // ici. Une purge se fait par DATE, jamais par nom — la plus ancienne part, point.
    //
    // Et l'ordre alphabétique revenait par la porte de service : il servait de DÉPARTAGE quand
    // deux mtime sont égaux. Sur Windows ils le sont presque toujours (l'horloge système n'avance
    // que toutes les ~15 ms), donc « avant-… » repassait en tête et redevenait la première
    // effacée — le bug de 6.8.1, intact, sur la seule plateforme où personne ne le testait.
    // On ordonne donc par la date écrite dans le NOM, et le mtime ne sert plus qu'en second.
    const dated = liste => liste
      .map(f => { let mtime = 0; try { mtime = fs.statSync(path.join(backupDir, f)).mtimeMs; } catch (_) {} return { name: f, mtime }; })
      .sort(plusAncienDabord);
    const jeter = liste => { while (liste.length > 0) fs.unlinkSync(path.join(backupDir, liste.shift().name)); };
    // Deux réserves séparées, comme dans l'app cabinet : les filets pris par l'application avant un
    // geste risqué ne doivent jamais être chassés par des sauvegardes volontaires. Sans ça, vingt
    // « manuelle » suffisaient à faire disparaître « avant-import » à la seconde où il naissait.
    const restantes = names.filter(f => !DAILY_RE.test(f));
    const filets = dated(restantes.filter(f => FILETS.test(f)));
    jeter(filets.slice(0, Math.max(0, filets.length - NAMED_KEEP)));
    const volontaires = dated(restantes.filter(f => !FILETS.test(f)));
    jeter(volontaires.slice(0, Math.max(0, volontaires.length - NAMED_KEEP)));
  }

  function listBackups() {
    let names;
    try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch { return []; }
    return names.map(name => {
      const p = path.join(backupDir, name);
      const st = fs.statSync(p);
      return { name, path: p, size: st.size, mtime: st.mtimeMs };
      // Même ordre que la purge, à l'envers : la plus récente en tête. Trier par mtime seul
      // mettrait la liste dans un ordre arbitraire sur Windows — et le jour où l'on restaure est
      // le pire jour pour choisir au hasard.
    }).sort((a, b) => plusAncienDabord(b, a));
  }

  // Lit un fichier JSON externe (import) et vérifie sa structure sans rien écrire.
  // Un fichier chiffré demande le mot de passe (celui de la session par défaut).
  function readExternal(p, password) {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (isEncrypted(d)) {
      if (password) return decryptData(d, password);
      if (state.key) { try { return decryptWithKey(d, state.key); } catch (_) { /* autre mot de passe */ } }
      const err = new Error('Ce fichier est chiffré : mot de passe requis.'); err.code = 'ENCRYPTED'; throw err;
    }
    if (!isValidData(d)) throw new Error('Ce fichier n\'est pas un export SkanFact.');
    return d;
  }

  // ---------- pièces jointes ----------

  // Nom de fichier sûr : on garde le nom d'origine lisible, préfixé d'un identifiant pour éviter
  // qu'un second « facture.pdf » écrase le premier.
  function safeName(name) {
    const base = String(name || 'fichier').replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').slice(-120) || 'fichier';
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${base}`;
  }
  function attachmentPath(docId, fileName) {
    const d = String(docId || '').replace(/[^A-Za-z0-9_-]/g, '');
    const f = String(fileName || '').replace(/[/\\]/g, '');
    if (!d || !f) throw new Error('Pièce jointe introuvable.');
    return path.join(attachDir, d, f);
  }
  // Copie un fichier choisi par l'utilisateur dans le dossier du document. Renvoie la fiche à stocker.
  function addAttachment(docId, sourcePath) {
    const d = String(docId || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!d) throw new Error('Document inconnu.');
    const name = path.basename(sourcePath);
    const stored = safeName(name);
    const dest = path.join(attachDir, d, stored);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(sourcePath, dest);
    const size = fs.statSync(dest).size;
    mirrorExternal();
    return { name, file: stored, size, date: today() };
  }
  function removeAttachment(docId, fileName) {
    try { fs.unlinkSync(attachmentPath(docId, fileName)); } catch (e) { log('pièce jointe', e); }
    return true;
  }

  // ---------- copie externe ----------

  function setExternalDir(p) { state.external.dir = p || null; state.external.lastError = null; state.external.lastCopy = null; if (p) mirrorExternal(); }

  // Copie le fichier de données et les sauvegardes manquantes vers <externe>/SkanFact. Synchrone mais rapide
  // (quelques centaines de Ko) ; en cas de dossier absent (clé débranchée), on note l'erreur sans bloquer.
  function mirrorExternal() {
    const ext = state.external.dir;
    if (!ext) return false;
    try {
      if (!fs.existsSync(ext)) throw new Error('dossier introuvable (support débranché ?)');
      const target = path.join(ext, 'SkanFact');
      fs.mkdirSync(path.join(target, 'backups'), { recursive: true });
      if (fs.existsSync(file)) {
        const tmp = path.join(target, 'skanfact-data.json.tmp');
        fs.copyFileSync(file, tmp); fs.renameSync(tmp, path.join(target, 'skanfact-data.json'));
      }
      let names = [];
      try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch {}
      // Recopier aussi ce qui a CHANGÉ, pas seulement ce qui manque. Un nom de sauvegarde porte sa
      // date, donc son contenu ne bouge normalement jamais — sauf après un changement de mot de
      // passe, qui rechiffre tout le dossier local. Avec le seul test « le fichier n'existe pas »,
      // la copie externe gardait la version d'avant, en clair.
      names.forEach(n => {
        const src = path.join(backupDir, n), dst = path.join(target, 'backups', n);
        try {
          if (fs.existsSync(dst)) {
            const a = fs.statSync(src), b = fs.statSync(dst);
            if (a.size === b.size && Math.abs(a.mtimeMs - b.mtimeMs) < 2000) return;
          }
          fs.copyFileSync(src, dst);
        } catch (e) { log('copie externe ' + n, e); }
      });
      // Les pièces jointes ne tiennent pas dans le JSON : la copie externe est le seul filet qui les emporte.
      if (fs.existsSync(attachDir)) fs.cpSync(attachDir, path.join(target, 'pieces-jointes'), { recursive: true, force: false, errorOnExist: false });
      state.external.lastCopy = now().toISOString(); state.external.lastError = null;
      return true;
    } catch (e) {
      state.external.lastError = e.message; log('copie externe', e);
      return false;
    }
  }

  return { file, backupDir, attachDir, state, read, unlock, lock, setPassword, write, diskRevision, backupNow, listBackups, readExternal, snapshotDaily, setExternalDir, mirrorExternal, addAttachment, removeAttachment, attachmentPath };
}

module.exports = { createStorage, isValidData, stamp, isEncrypted, encryptData, decryptData };
