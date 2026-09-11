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
  const state = { corruptFile: null, key: null, salt: null, encrypted: false, external: { dir: opts.externalDir || null, lastCopy: null, lastError: null } };

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
      catch (e) { return { locked: true }; }
    }
    state.encrypted = false;
    return r.data;
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
    } catch (e) { return { ok: false, error: 'Mot de passe incorrect.' }; }
  }

  function lock() { state.key = null; state.salt = null; }

  // Active / change / retire le mot de passe. Réécrit le fichier immédiatement et convertit les
  // sauvegardes existantes (elles ne doivent jamais rester en clair à côté d'un fichier chiffré,
  // ni devenir illisibles quand on retire le mot de passe).
  function setPassword(data, password) {
    const oldKey = state.key;
    if (password) {
      state.salt = crypto.randomBytes(16);
      state.key = deriveKey(password, state.salt);
      state.encrypted = true;
    } else {
      state.key = null; state.salt = null; state.encrypted = false;
    }
    write(data);
    convertBackups(oldKey);
    return true;
  }

  function convertBackups(oldKey) {
    let names = [];
    try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch { return; }
    names.forEach(n => {
      const p = path.join(backupDir, n);
      try {
        let d = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (isEncrypted(d)) { if (!oldKey) return; d = decryptWithKey(d, oldKey); }
        const payload = state.key ? encryptWithKey(d, state.salt, state.key) : d;
        fs.writeFileSync(p + '.tmp', JSON.stringify(payload, null, state.key ? 0 : 2), 'utf8');
        fs.renameSync(p + '.tmp', p);
      } catch (e) { log('conversion sauvegarde ' + n, e); }
    });
    mirrorExternal();
  }

  function write(data) {
    if (!isValidData(data)) throw new Error('Données invalides : enregistrement refusé.');
    if (state.encrypted && !state.key) throw new Error('Données verrouillées : mot de passe requis.');
    fs.mkdirSync(dir, { recursive: true });
    snapshotDaily();
    const payload = state.key ? encryptWithKey(data, state.salt, state.key) : data;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload, null, state.key ? 0 : 2), 'utf8');
    fs.renameSync(tmp, file);
    mirrorExternal();
    return true;
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
    const daily = names.filter(f => DAILY_RE.test(f)).sort();
    while (daily.length > DAILY_KEEP) fs.unlinkSync(path.join(backupDir, daily.shift()));
    const named = names.filter(f => !DAILY_RE.test(f)).sort();
    while (named.length > NAMED_KEEP) fs.unlinkSync(path.join(backupDir, named.shift()));
  }

  function listBackups() {
    let names;
    try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch { return []; }
    return names.map(name => {
      const p = path.join(backupDir, name);
      const st = fs.statSync(p);
      return { name, path: p, size: st.size, mtime: st.mtimeMs };
    }).sort((a, b) => b.mtime - a.mtime);
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
      names.forEach(n => { const dst = path.join(target, 'backups', n); if (!fs.existsSync(dst)) fs.copyFileSync(path.join(backupDir, n), dst); });
      state.external.lastCopy = now().toISOString(); state.external.lastError = null;
      return true;
    } catch (e) {
      state.external.lastError = e.message; log('copie externe', e);
      return false;
    }
  }

  return { file, backupDir, state, read, unlock, lock, setPassword, write, backupNow, listBackups, readExternal, snapshotDaily, setExternalDir, mirrorExternal };
}

module.exports = { createStorage, isValidData, stamp, isEncrypted, encryptData, decryptData };
