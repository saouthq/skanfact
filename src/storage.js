// Stockage local des données : un fichier JSON + sauvegardes. Aucune dépendance Electron
// pour pouvoir le tester avec `npm test`.
//
// Règles :
//  - écriture atomique (fichier temporaire puis renommage) : jamais de fichier à moitié écrit ;
//  - un fichier illisible n'est JAMAIS écrasé : il est mis de côté (skanfact-data.illisible-<date>.json)
//    et signalé pour que l'utilisateur restaure une sauvegarde ;
//  - la sauvegarde quotidienne est l'état du fichier AVANT la première écriture du jour
//    (on peut donc revenir à « ce matin » après une fausse manipulation), 30 jours conservés ;
//  - une sauvegarde nommée est prise avant tout import ou sur demande.
const fs = require('fs');
const path = require('path');

const DAILY_RE = /^skanfact-(\d{4}-\d{2}-\d{2})\.json$/;
const DAILY_KEEP = 30;
const NAMED_KEEP = 20;

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

function createStorage(dir, opts) {
  opts = opts || {};
  const now = opts.now || (() => new Date());
  const file = path.join(dir, 'skanfact-data.json');
  const backupDir = path.join(dir, 'backups');
  const state = { corruptFile: null };

  function today() { return stamp(now()).slice(0, 10); }

  function read() {
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    try {
      const d = JSON.parse(raw);
      if (!isValidData(d)) throw new Error('structure inattendue');
      return d;
    } catch (e) {
      const aside = path.join(dir, `skanfact-data.illisible-${stamp(now())}.json`);
      try { fs.renameSync(file, aside); state.corruptFile = aside; } catch (_) { state.corruptFile = file; }
      return null;
    }
  }

  function write(data) {
    if (!isValidData(data)) throw new Error('Données invalides : enregistrement refusé.');
    fs.mkdirSync(dir, { recursive: true });
    snapshotDaily();
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
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
  function readExternal(p) {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!isValidData(d)) throw new Error('Ce fichier n\'est pas un export SkanFact.');
    return d;
  }

  return { file, backupDir, state, read, write, backupNow, listBackups, readExternal, snapshotDaily };
}

module.exports = { createStorage, isValidData, stamp };
