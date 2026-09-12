// SkanFact Cabinet — le stockage, et surtout les filets.
//
// Jusqu'ici le cabinet tenait dans UN fichier chiffré, écrit une fois par modification, sans aucune
// copie. C'était l'application la plus exposée du lot : elle détient la comptabilité de dizaines
// d'entreprises ET la clé privée qui ouvre leurs paquets. Un disque qui lâche, et soixante clients
// doivent réimporter un appairage — en admettant qu'on s'en aperçoive.
//
// Ce module fait pour le cabinet ce que src/storage.js fait depuis la 1.7.0 pour l'app entreprise,
// avec trois différences :
//  - le chiffrement n'est jamais optionnel (le mot de passe est obligatoire à l'ouverture) ;
//  - les PAQUETS comptent autant que la base : ce sont les pièces justificatives, la copie externe
//    doit les emporter ;
//  - il existe une clé de secours exportable : sans elle, perdre le poste rend illisibles tous les
//    paquets déjà reçus, pour toujours.
//
// Aucune dépendance Electron : tout se teste avec `npm test`.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MARK = 'skanfactCabinet';
const RECOVER_MARK = 'skanfactCabinetRecovery';
const DAILY_RE = /^cabinet-(\d{4}-\d{2}-\d{2})\.json$/;
const DAILY_KEEP = 30;
const NAMED_KEEP = 20;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function stamp(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}`;
}

// Un nom de dossier lisible par un humain qui ouvre le Finder. Le comptable doit pouvoir retrouver
// les pièces d'un client sans lancer l'application — et pouvoir les lui rendre en copiant un dossier.
// Toutes les lettres, pas seulement l'alphabet latin : « مخبزة الياسمين » et « شركة الأمان »
// donnaient tous deux « sans-nom », donc le MÊME dossier sur le disque — et le paquet de l'un
// écrasait celui de l'autre. Les systèmes de fichiers de macOS et de Windows acceptent l'arabe.
function slug(s) {
  const t = String(s || '').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return t || 'sans-nom';
}

function isEnvelope(o) { return !!(o && typeof o === 'object' && o[MARK] === 1 && o.salt && o.iv && o.tag && o.data); }

function deriveKey(password, salt) { return crypto.scryptSync(String(password), salt, 32, SCRYPT); }

function sealWithKey(obj, salt, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(obj), 'utf8')), cipher.final()]);
  return {
    [MARK]: 1, kdf: 'scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), data: body.toString('base64')
  };
}

function openWithKey(env, key) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  d.setAuthTag(Buffer.from(env.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(env.data, 'base64')), d.final()]).toString('utf8'));
}

// Une structure de cabinet plausible. On refuse d'écrire autre chose : mieux vaut une erreur nette
// qu'un fichier chiffré qui ne contient pas ce qu'on croit.
function isValidCabinet(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  if (s.dossiers !== undefined && !Array.isArray(s.dossiers)) return false;
  if (s.cabinet !== undefined && (typeof s.cabinet !== 'object' || s.cabinet === null)) return false;
  return true;
}

// ---------- la clé de secours ----------
//
// Le fichier le plus important que ce cabinet produira jamais : sans lui, perdre l'ordinateur rend
// illisible TOUT ce que ses clients lui ont envoyé. Il porte la paire de clés du cabinet, scellée par
// un mot de passe choisi pour l'occasion (pas celui de l'application : ce fichier a vocation à
// quitter le poste, à être mis dans un coffre ou chez le notaire).
function makeRecovery(cabinet, password, now) {
  const salt = crypto.randomBytes(16);
  const env = sealWithKey({
    publicKey: cabinet.publicKey || '', privateKey: cabinet.privateKey || '',
    name: cabinet.name || '', email: cabinet.email || ''
  }, salt, deriveKey(password, salt));
  return {
    [RECOVER_MARK]: 1, format: 1,
    cabinet: cabinet.name || '',
    creeLe: (now || new Date()).toISOString(),
    avertissement: 'Ce fichier contient la clé qui ouvre les paquets de tes clients. Garde-le hors de ton ordinateur (coffre, clé USB rangée ailleurs). Sans lui et sans ton poste, aucun paquet déjà reçu ne pourra plus être ouvert.',
    coffre: env
  };
}

function readRecovery(obj, password) {
  if (!obj || obj[RECOVER_MARK] !== 1 || !obj.coffre) throw new Error('Ce fichier n\'est pas une clé de secours SkanFact.');
  const env = obj.coffre;
  const salt = Buffer.from(env.salt, 'base64');
  try { return openWithKey(env, deriveKey(password, salt)); }
  catch { throw new Error('Mot de passe de la clé de secours incorrect.'); }
}

// ---------- le magasin ----------

function createCabStore(dir, opts) {
  opts = opts || {};
  const now = opts.now || (() => new Date());
  const log = opts.log || (() => {});
  const file = path.join(dir, 'cabinet-data.json');
  const backupDir = path.join(dir, 'sauvegardes');
  const packRoot = path.join(dir, 'paquets');
  // `password` est gardé en mémoire pour la session, à UN seul usage : ouvrir une sauvegarde dont le
  // sel diffère de celui du fichier courant. C'est le cas qui arrive précisément le jour où ça
  // compte — le fichier principal a disparu, on rouvre l'application avec le MÊME mot de passe, mais
  // un nouveau sel est tiré au hasard, donc la clé dérivée n'est plus la même et les sauvegardes
  // paraissent verrouillées. Sans ça, l'application répond « cette sauvegarde a été faite avec un
  // autre mot de passe » à quelqu'un qui vient de taper le bon, au pire moment possible.
  // Ce n'est pas un affaiblissement : la clé dérivée, déjà gardée en mémoire, ouvre exactement les
  // mêmes données.
  const st = { key: null, salt: null, password: null, corruptFile: null, external: { dir: opts.externalDir || null, lastCopy: null, lastError: null } };

  const today = () => stamp(now()).slice(0, 10);
  const exists = () => { try { return fs.existsSync(file); } catch { return false; } };

  // Un fichier illisible n'est JAMAIS écrasé. C'est la règle qui a sauvé l'app entreprise : sans
  // elle, une première écriture après une corruption détruit la seule copie qui restait.
  function readEnvelope() {
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    let o;
    try { o = JSON.parse(raw); } catch { o = null; }
    if (!isEnvelope(o)) {
      const aside = path.join(dir, `cabinet-data.illisible-${stamp(now())}.json`);
      try { fs.renameSync(file, aside); st.corruptFile = aside; } catch { st.corruptFile = file; }
      return null;
    }
    return o;
  }

  // Première ouverture : on fabrique le coffre avec la paire de clés du cabinet.
  function create(password, initial) {
    const salt = crypto.randomBytes(16);
    st.salt = salt;
    st.key = deriveKey(password, salt);
    st.password = String(password);
    const s = { ...initial };
    write(s);
    return s;
  }

  function unlock(password) {
    const env = readEnvelope();
    if (!env) return { missing: true, corruptFile: st.corruptFile };
    const salt = Buffer.from(env.salt, 'base64');
    const key = deriveKey(password, salt);
    let plain;
    try { plain = openWithKey(env, key); }
    catch { return { ok: false, error: 'Mot de passe incorrect.' }; }
    st.key = key; st.salt = salt; st.password = String(password);
    return { ok: true, state: plain };
  }

  function lock() { st.key = null; st.salt = null; st.password = null; }
  const unlocked = () => !!st.key;

  function write(state) {
    if (!st.key) throw new Error('Aucun cabinet ouvert.');
    if (!isValidCabinet(state)) throw new Error('Données de cabinet invalides : enregistrement refusé.');
    fs.mkdirSync(dir, { recursive: true });
    snapshotDaily();
    const plain = { ...state };
    delete plain.__salt;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(sealWithKey(plain, st.salt, st.key)), 'utf8');
    fs.renameSync(tmp, file);
    mirrorExternal();
    return { ok: true };
  }

  // Changer le mot de passe : on rechiffre le fichier ET les sauvegardes. Une sauvegarde qui reste
  // sur l'ancien mot de passe est une sauvegarde qu'on ne pourra pas restaurer le jour venu —
  // c'est-à-dire pas une sauvegarde.
  function setPassword(state, password) {
    if (!st.key) throw new Error('Aucun cabinet ouvert.');
    const oldKey = st.key;
    const salt = crypto.randomBytes(16);
    st.salt = salt;
    st.key = deriveKey(password, salt);
    st.password = String(password);
    write(state);
    let names = [];
    try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch { names = []; }
    names.forEach(n => {
      const p = path.join(backupDir, n);
      try {
        const env = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!isEnvelope(env)) return;
        const plain = openWithKey(env, oldKey);
        fs.writeFileSync(p + '.tmp', JSON.stringify(sealWithKey(plain, st.salt, st.key)), 'utf8');
        fs.renameSync(p + '.tmp', p);
      } catch (e) { log('conversion sauvegarde ' + n, e); }
    });
    mirrorExternal();
    return true;
  }

  // ---------- sauvegardes ----------

  function snapshotDaily() {
    if (!exists()) return null;
    fs.mkdirSync(backupDir, { recursive: true });
    const target = path.join(backupDir, `cabinet-${today()}.json`);
    if (fs.existsSync(target)) return null;
    fs.copyFileSync(file, target);
    prune();
    return target;
  }

  function backupNow(label) {
    if (!exists()) return null;
    fs.mkdirSync(backupDir, { recursive: true });
    const safe = String(label || 'manuelle').replace(/[^a-z0-9_-]/gi, '_');
    const target = path.join(backupDir, `${safe}-${stamp(now())}.json`);
    fs.copyFileSync(file, target);
    prune();
    // Une sauvegarde annoncée qui n'existe plus est pire que pas de sauvegarde : on le dit tout de
    // suite plutôt que de laisser l'appelant effacer trente-six paquets en toute confiance.
    if (!fs.existsSync(target)) throw new Error('La sauvegarde n\'a pas pu être conservée : vérifie l\'espace disque.');
    mirrorExternal();
    return target;
  }

  // On purge par DATE, jamais par nom. L'ordre alphabétique mettait « avant-changement-mot-de-passe »
  // en tête : c'était donc TOUJOURS la première effacée, y compris celle qu'on venait de prendre.
  // Pire, vingt sauvegardes « manuelle » (Cmd+S, le réflexe universel) suffisaient à faire
  // disparaître la copie « avant-suppression-dossier » à la seconde même où elle naissait — pendant
  // que la fenêtre affichait « Une sauvegarde est prise juste avant ».
  const FILETS = /^avant-/;
  function dated(names) {
    return names.map(name => {
      let m = 0;
      try { m = fs.statSync(path.join(backupDir, name)).mtimeMs; } catch {}
      return { name, m };
    }).sort((a, b) => a.m - b.m);                              // le plus ancien d'abord
  }
  function prune() {
    let names;
    try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch { return; }
    const jeter = liste => { while (liste.length > 0) { try { fs.unlinkSync(path.join(backupDir, liste.shift().name)); } catch {} } };
    const daily = dated(names.filter(f => DAILY_RE.test(f)));
    jeter(daily.slice(0, Math.max(0, daily.length - DAILY_KEEP)));
    // Deux réserves séparées : les filets pris par l'application avant un geste risqué ne doivent
    // jamais être chassés par des sauvegardes volontaires.
    const filets = dated(names.filter(f => !DAILY_RE.test(f) && FILETS.test(f)));
    jeter(filets.slice(0, Math.max(0, filets.length - NAMED_KEEP)));
    const manuelles = dated(names.filter(f => !DAILY_RE.test(f) && !FILETS.test(f)));
    jeter(manuelles.slice(0, Math.max(0, manuelles.length - NAMED_KEEP)));
  }

  function listBackups() {
    let names;
    try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch { return []; }
    return names.map(name => {
      const p = path.join(backupDir, name);
      const s = fs.statSync(p);
      return { name, path: p, size: s.size, mtime: s.mtimeMs, daily: DAILY_RE.test(name) };
    }).sort((a, b) => b.mtime - a.mtime);
  }

  // Lire une sauvegarde SANS rien écrire : on montre ce qu'elle contient avant de la restaurer.
  // Une restauration qui ne dit pas ce qu'on va perdre n'est pas une restauration, c'est un pari.
  function peek(p, password) {
    const env = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!isEnvelope(env)) throw new Error('Ce fichier n\'est pas une sauvegarde SkanFact Cabinet.');
    let plain = null;
    if (password) {
      const salt = Buffer.from(env.salt, 'base64');
      try { plain = openWithKey(env, deriveKey(password, salt)); }
      catch { throw new Error('Mot de passe incorrect pour cette sauvegarde.'); }
    } else {
      if (!st.key) throw new Error('Aucun cabinet ouvert.');
      try { plain = openWithKey(env, st.key); }
      catch {
        // Même mot de passe, autre sel : c'est le cas d'une sauvegarde d'avant une recréation du
        // cabinet. On réessaie avec le sel de la sauvegarde AVANT de conclure quoi que ce soit.
        let ok2 = false;
        if (st.password) {
          try { plain = openWithKey(env, deriveKey(st.password, Buffer.from(env.salt, 'base64'))); ok2 = true; }
          catch { ok2 = false; }
        }
        if (!ok2) { const e = new Error('Cette sauvegarde a été faite avec un autre mot de passe.'); e.code = 'OTHERPW'; throw e; }
      }
    }
    return plain;
  }

  // Restaurer : on met l'état actuel de côté d'abord. Toujours. Une restauration qui se révèle être
  // la mauvaise sauvegarde ne doit pas être un aller simple.
  function restore(p, password) {
    const plain = peek(p, password);
    if (!isValidCabinet(plain)) throw new Error('Cette sauvegarde ne contient pas un cabinet SkanFact.');
    backupNow('avant-restauration');
    write(plain);
    return plain;
  }

  // ---------- les paquets ----------
  //
  // Ils étaient tous à plat dans un seul répertoire, nommés par matricule :
  //   paquets/MF_1122334A_M_P_000-2026-08.skanpack
  // À soixante clients sur trois ans, cela fait deux mille fichiers illisibles dans un dossier.
  // Désormais : paquets/<client>/<année>/<mois>.skanpack — ce qui permet enfin de rendre à un client
  // ses pièces en copiant un dossier, et d'archiver un exercice.

  function folderName(dossier, collisions) {
    const base = slug(dossier.name || dossier.matricule || dossier.id);
    return (collisions && collisions.has(base) && collisions.get(base) > 1)
      ? `${base}-${slug(dossier.matricule || dossier.id).slice(0, 20)}`
      : base;
  }

  function folderIndex(dossiers) {
    const counts = new Map();
    (dossiers || []).forEach(d => { const b = slug(d.name || d.matricule || d.id); counts.set(b, (counts.get(b) || 0) + 1); });
    return counts;
  }

  // Le mois vient du manifeste d'un paquet reçu par mail — donc de l'extérieur. Le coller dans un
  // chemin sans le contrôler laissait `mois = '../../../../tmp/piege'` écrire hors du dossier de
  // l'application, par-dessus le paquet archivé d'un autre client.
  const moisSain = m => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || '')) ? String(m) : 'inconnu');
  function packPathFor(dossier, month, collisions) {
    const m = moisSain(month);
    const year = m === 'inconnu' ? 'sans-date' : m.slice(0, 4);
    const dest = path.join(packRoot, folderName(dossier, collisions), year, `${m}.skanpack`);
    // Ceinture et bretelles : même si un nom de dossier venait à contenir une remontée.
    if (!path.resolve(dest).startsWith(path.resolve(packRoot) + path.sep)) {
      throw new Error('Chemin de paquet refusé : il sortirait du dossier de l\'application.');
    }
    return dest;
  }

  // Ranger un paquet reçu à sa place. Le fichier d'origine du comptable n'est jamais déplacé.
  // Le comptable a déclaré sur un paquet. Si le client rouvre son mois et renvoie, l'ancien fichier
  // ne doit PAS disparaître : sans lui, il ne peut ni montrer sur quoi il a déclaré, ni établir la
  // rectificative par différence. On ne réutilise donc jamais un nom.
  function storePack(sourceFile, dossier, month, dossiers) {
    const base = packPathFor(dossier, month, folderIndex(dossiers));
    fs.mkdirSync(path.dirname(base), { recursive: true });
    let dest = base;
    for (let n = 2; fs.existsSync(dest) && n < 100; n++) dest = base.replace(/\.skanpack$/, `-r${n}.skanpack`);
    fs.copyFileSync(sourceFile, dest);
    mirrorExternal({ packs: true });
    return dest;
  }

  function removePack(p) {
    try { if (p && p.startsWith(packRoot)) fs.unlinkSync(p); return true; }
    catch (e) { log('suppression paquet', e); return false; }
  }

  // Supprimer un dossier : ses paquets partent avec lui. On ne garde pas les pièces d'un client qu'on
  // a décidé d'effacer — ce serait le pire des deux mondes (plus visible, mais toujours là).
  function removeDossierFiles(dossier, dossiers) {
    const f = path.join(packRoot, folderName(dossier, folderIndex(dossiers)));
    try { if (fs.existsSync(f)) fs.rmSync(f, { recursive: true, force: true }); } catch (e) { log('suppression dossier', e); }
    (dossier.packs || []).forEach(p => { if (p.path) removePack(p.path); });
    return true;
  }

  // Remettre tous les paquets à leur place canonique et corriger les chemins enregistrés. Sert à la
  // reprise de l'ancien rangement à plat, et après un changement de nom de client.
  // Renvoie le nombre de fichiers déplacés ; l'appelant enregistre l'état ensuite.
  function reorganize(state) {
    let moved = 0, lost = 0;
    const collisions = folderIndex(state.dossiers);
    (state.dossiers || []).forEach(d => {
      (d.packs || []).forEach(p => {
        if (!p.path) return;                                  // paquet d'exemple : aucun fichier
        const want = packPathFor(d, p.month, collisions);
        try {
          // Le contrôle d'existence vient AVANT celui de la place : un paquet déjà bien rangé dont le
          // fichier a disparu n'était jamais compté, et restait vert et « définitif » à l'écran.
          if (!fs.existsSync(p.path)) { lost++; p.missingFile = true; return; }
          delete p.missingFile;
          if (p.path === want) return;
          if (fs.existsSync(want)) return;                    // jamais écraser une autre réception
          fs.mkdirSync(path.dirname(want), { recursive: true });
          fs.renameSync(p.path, want);
          p.path = want;
          moved++;
        } catch (e) { log('rangement paquet', e); }
      });
    });
    // Les répertoires vides laissés par l'ancien rangement ne servent plus à rien.
    try {
      fs.readdirSync(packRoot, { withFileTypes: true }).forEach(e => {
        if (!e.isDirectory()) return;
        const p = path.join(packRoot, e.name);
        try { if (!fs.readdirSync(p).length) fs.rmdirSync(p); } catch {}
      });
    } catch {}
    return { moved, lost };
  }

  // Taille occupée par les paquets : un comptable doit pouvoir répondre à « pourquoi mon disque se
  // remplit ». Personne ne l'a jamais dit dans l'application.
  function packStats() {
    let files = 0, bytes = 0;
    const walk = p => {
      let entries = [];
      try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
      entries.forEach(e => {
        const q = path.join(p, e.name);
        if (e.isDirectory()) return walk(q);
        try { const s = fs.statSync(q); files++; bytes += s.size; } catch {}
      });
    };
    walk(packRoot);
    return { files, bytes };
  }

  // ---------- copie externe ----------

  function setExternalDir(p) {
    st.external.dir = p || null;
    st.external.lastError = null;
    st.external.lastCopy = null;
    if (p) mirrorExternal({ packs: true });
    return st.external;
  }

  // Vers <externe>/SkanFact Cabinet : la base, les sauvegardes, et les paquets. Les paquets SONT les
  // pièces justificatives : une copie qui ne les emporte pas laisserait le comptable avec un index de
  // ce qu'il a perdu.
  //
  // Mais les paquets ne bougent qu'à l'import et à la suppression, alors que la base est réécrite à
  // chaque modification de fiche. Parcourir deux mille fichiers et cinquante gigaoctets pour
  // enregistrer un numéro de téléphone bloquerait l'application plusieurs secondes, à chaque frappe
  // d'un bouton Enregistrer — et sur une clé USB, bien plus. `avecPaquets` n'est donc vrai que
  // lorsqu'ils ont vraiment changé.
  function mirrorExternal(opts) {
    const avecPaquets = !!(opts && opts.packs);
    const ext = st.external.dir;
    if (!ext) return false;
    try {
      if (!fs.existsSync(ext)) throw new Error('dossier introuvable (support débranché ?)');
      const target = path.join(ext, 'SkanFact Cabinet');
      fs.mkdirSync(path.join(target, 'sauvegardes'), { recursive: true });
      if (exists()) {
        const tmp = path.join(target, 'cabinet-data.json.tmp');
        fs.copyFileSync(file, tmp);
        fs.renameSync(tmp, path.join(target, 'cabinet-data.json'));
      }
      let names = [];
      try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch {}
      names.forEach(n => {
        const dst = path.join(target, 'sauvegardes', n);
        if (!fs.existsSync(dst)) fs.copyFileSync(path.join(backupDir, n), dst);
      });
      if (avecPaquets && fs.existsSync(packRoot)) fs.cpSync(packRoot, path.join(target, 'paquets'), { recursive: true, force: false, errorOnExist: false });
      st.external.lastCopy = now().toISOString();
      st.external.lastError = null;
      return true;
    } catch (e) {
      st.external.lastError = e.message;
      log('copie externe', e);
      return false;
    }
  }

  return {
    file, backupDir, packRoot, state: st,
    exists, unlocked, create, unlock, lock, write, setPassword,
    snapshotDaily, backupNow, listBackups, peek, restore,
    packPathFor, storePack, removePack, removeDossierFiles, reorganize, packStats, folderName, folderIndex,
    setExternalDir, mirrorExternal
  };
}

module.exports = { createCabStore, makeRecovery, readRecovery, isValidCabinet, isEnvelope, slug, stamp, MARK, RECOVER_MARK };
