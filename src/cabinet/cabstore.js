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
// Le moteur comptable partagé (9.1.0) : `cabstore` ne juge pas un livre lui-même, il demande à
// `compta.js` s'il en est un. Deux jugements séparés divergeraient au premier champ ajouté.
const KC = require('../renderer/compta.js');

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

// Le nom d'une sauvegarde porte la date que L'APPLICATION a écrite (stamp() ci-dessus), au format
// AAAA-MM-JJ_HHhMMmSS. Il est zéro-rempli, donc son ordre alphabétique EST l'ordre du temps — sans
// aucun calcul de date, donc sans la moindre question de fuseau horaire.
//
// On s'y fie AVANT le mtime du disque, qui ment dans deux cas bien réels :
//   - Sur Windows, l'horloge système n'avance que toutes les ~15 ms. Vingt-six copies d'affilée
//     portent donc le MÊME mtime : l'ordre « la plus ancienne d'abord » devient arbitraire, et la
//     purge efface n'importe laquelle. C'est ce qui faisait échouer le test A4 sur Windows
//     pendant qu'il passait sur Linux.
//   - Une COPIE réécrit les mtime : miroir externe, clé USB, changement d'ordinateur. Après un
//     déménagement — le scénario que 6.8.2 a précisément ouvert — ils ne disent plus rien du tout,
//     et la purge peut effacer la plus récente en croyant prendre la plus ancienne.
// Le mtime reste le second critère, pour un fichier dont le nom ne porte pas de date.
const MARQUE = /(\d{4}-\d{2}-\d{2}(?:_\d{2}h\d{2}m\d{2})?)\.json$/;
function marque(name) { const m = MARQUE.exec(name); return m ? m[1] : ''; }
function plusAncienDabord(a, b) {
  const ma = marque(a.name), mb = marque(b.name);
  if (ma && mb && ma !== mb) return ma < mb ? -1 : 1;
  if (a.mtime !== b.mtime) return a.mtime - b.mtime;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;       // dernier recours : stable
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
    // Les sauvegardes déjà copiées sur la clé USB restent chiffrées avec l'ANCIEN mot de passe.
    // Comme on ne remplace que ce qui diffère par la taille et la date, et que le rechiffrement
    // change les deux, elles seront bien réécrites — mais on vide d'abord ce qui ne correspond plus
    // à aucune sauvegarde locale, sinon la clé garde des fichiers qu'aucun mot de passe n'ouvre.
    const ext = st.external.dir;
    if (ext) {
      const cible = path.join(ext, 'SkanFact Cabinet', 'sauvegardes');
      try {
        const locales = new Set(fs.readdirSync(backupDir));
        fs.readdirSync(cible).forEach(n => { if (!locales.has(n)) fs.unlinkSync(path.join(cible, n)); });
      } catch {}
    }
    mirrorExternal({ packs: false });
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
      let mtime = 0;
      try { mtime = fs.statSync(path.join(backupDir, name)).mtimeMs; } catch {}
      return { name, mtime };
    }).sort(plusAncienDabord);                                 // le plus ancien d'abord
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
      // Même ordre que la purge, à l'envers : la plus récente en tête. Trier ici par mtime seul
      // mettrait la liste des sauvegardes dans un ordre arbitraire sur Windows — et le jour où on
      // restaure est le pire jour pour choisir au hasard.
    }).sort((a, b) => plusAncienDabord(b, a));
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

  // ---------- reprendre un cabinet venu d'un autre ordinateur ----------
  //
  // Un comptable change de poste, ou son disque lâche. Il a fait exactement ce qu'on lui demandait :
  // la copie sur clé USB, la clé de secours. Et l'application n'avait AUCUN chemin pour reprendre
  // tout ça : sur la machine neuve elle disait « Bienvenue », fabriquait une clé NEUVE, et les
  // paquets que ses clients lui enverraient ensuite seraient refusés — « adressé à un autre
  // cabinet ». Huit cents paquets lisibles sur la table, et aucun bouton pour les reprendre. C'est le
  // pire des défauts : celui qui punit quelqu'un qui a tout bien fait.
  //
  // Trois formes acceptées, parce que c'est sous ces trois-là que la chose se présente vraiment :
  //  - le dossier de la copie externe (le bon cas : il porte AUSSI les paquets) ;
  //  - le fichier cabinet-data.json seul ;
  //  - une sauvegarde (même enveloppe, autre nom).
  function scelle(p) {
    let o = null;
    try { o = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
    return isEnvelope(o) ? o : null;
  }

  // Ce qu'on a sous la main, AVANT de demander quoi que ce soit : on ne fait pas taper un mot de
  // passe pour annoncer ensuite que ce n'était pas le bon fichier.
  function inspectSource(p) {
    let s;
    try { s = fs.statSync(p); } catch { throw new Error('Ce fichier ou ce dossier est introuvable.'); }
    if (!s.isDirectory()) {
      if (!scelle(p)) throw new Error('Ce fichier n\'est pas un cabinet SkanFact : cherche « cabinet-data.json », ou un fichier du dossier « sauvegardes ».');
      return { kind: 'fichier', source: p, base: p, backups: [], packs: 0, bytes: 0 };
    }
    // On accepte aussi bien le dossier « SkanFact Cabinet » que celui qui le contient (la racine de
    // la clé USB) : personne ne se souvient duquel des deux il s'agit, et se tromper de niveau ne
    // doit pas ressembler à « tes données ne sont pas là ».
    const dedans = path.join(p, 'SkanFact Cabinet');
    const racine = (scelle(path.join(dedans, 'cabinet-data.json')) || fs.existsSync(path.join(dedans, 'sauvegardes'))) ? dedans : p;
    const base = scelle(path.join(racine, 'cabinet-data.json')) ? path.join(racine, 'cabinet-data.json') : null;
    let backups = [];
    try {
      backups = fs.readdirSync(path.join(racine, 'sauvegardes'))
        .filter(n => n.endsWith('.json')).map(n => path.join(racine, 'sauvegardes', n))
        .filter(q => !!scelle(q));
    } catch {}
    if (!base && !backups.length) {
      throw new Error('Ce dossier ne contient aucun cabinet SkanFact. Cherche le dossier « SkanFact Cabinet » de ta copie de sauvegarde : il contient « cabinet-data.json ».');
    }
    const stats = treeStats(path.join(racine, 'paquets'));
    return { kind: 'dossier', source: racine, base, backups, packs: stats.files, bytes: stats.bytes };
  }

  // On ne remplace JAMAIS un fichier déjà présent ici : ce qui est sur ce poste y a été reçu, il fait
  // foi. Et rien n'est déplacé chez la source — une clé USB reste une clé USB, et un premier essai
  // raté ne doit pas la vider.
  function reprendreFichier(src, dst) {
    try {
      if (fs.existsSync(dst)) return false;
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const a = fs.statSync(src);
      fs.copyFileSync(src, dst);
      try { fs.utimesSync(dst, a.atime, a.mtime); } catch {}
      return true;
    } catch (e) { log('reprise ' + path.basename(src), e); return false; }
  }

  function reprendreArbre(src, dst) {
    let n = 0, entries = [];
    try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch { return 0; }
    entries.forEach(e => {
      const a = path.join(src, e.name), b = path.join(dst, e.name);
      if (e.isDirectory()) n += reprendreArbre(a, b);
      else if (reprendreFichier(a, b)) n++;
    });
    return n;
  }

  // Reprendre pour de bon. TOUT est vérifié avant d'écrire quoi que ce soit : un mot de passe raté ne
  // laisse rien derrière lui — et sur cette machine-là, il n'y a encore rien à quoi revenir. La
  // session repart ouverte : redemander le mot de passe qu'on vient de taper serait une question de
  // plus au moment où l'on doute déjà de tout.
  function adoptSource(p, password) {
    const vu = inspectSource(p);
    let depuis = vu.base;
    if (!depuis) {
      // Pas de fichier principal, seulement des sauvegardes : on prend la plus récente. C'est
      // exactement l'état d'un poste dont le disque a lâché après la dernière copie.
      depuis = vu.backups.map(q => {
        let m = 0;
        try { m = fs.statSync(q).mtimeMs; } catch {}
        return { q, m };
      }).sort((a, b) => b.m - a.m)[0].q;
    }
    const env = scelle(depuis);
    if (!env) throw new Error('Ce fichier n\'est pas un cabinet SkanFact.');
    const salt = Buffer.from(env.salt, 'base64');
    const key = deriveKey(password, salt);
    let plain;
    try { plain = openWithKey(env, key); }
    catch { throw new Error('Mot de passe incorrect : c\'est celui que tu utilisais sur l\'autre ordinateur, il n\'a pas changé.'); }
    if (!isValidCabinet(plain)) throw new Error('Ce fichier ne contient pas un cabinet SkanFact.');

    // À partir d'ici seulement, on touche au disque. Si un cabinet existait déjà sur ce poste (une
    // création faite par erreur, avant d'avoir trouvé ce bouton), il est mis de côté, jamais effacé.
    fs.mkdirSync(dir, { recursive: true });
    if (exists()) backupNow('avant-reprise');
    if (path.resolve(depuis) !== path.resolve(file)) {
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(env), 'utf8');
      fs.renameSync(tmp, file);
    }
    st.salt = salt; st.key = key; st.password = String(password);

    let backups = 0, packs = 0;
    if (vu.kind === 'dossier') {
      const sauv = path.join(vu.source, 'sauvegardes');
      if (path.resolve(sauv) !== path.resolve(backupDir)) backups = reprendreArbre(sauv, backupDir);
      const pq = path.join(vu.source, 'paquets');
      if (path.resolve(pq) !== path.resolve(packRoot)) packs = reprendreArbre(pq, packRoot);
    }
    // Les chemins enregistrés dans l'état désignent encore l'autre poste : c'est `reorganize` qui les
    // recolle, et c'est l'appelant qui enregistre ensuite.
    return { state: plain, from: depuis, backups, packs };
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
  // ================================================================ LE LIVRE (9.2.0)
  //
  // Un fichier par dossier ET par exercice : `livres/<dossier>/livre-<AAAA>.json`. Chiffré avec la
  // MÊME clé dérivée que `cabinet-data.json` — la clé se dérive une fois au déverrouillage et reste
  // en mémoire ; la redériver par fichier coûterait 6,8 s sur soixante dossiers (mesuré).
  //
  // **Le corps est BINAIRE, pas base64**, et c'est la mesure qui l'a décidé, avant d'écrire une
  // ligne de 9.2.0 (`npm run charge`, SPEC-OUT-006). Sur 50 000 lignes, valider une écriture réécrit
  // le fichier entier : 141 ms en base64 pour un seuil de 100, 57 ms en binaire. base64 ajoute 33 %
  // d'octets et 59 % du temps d'écriture, pour rien. C'est la règle de la 6.1.0 (« le corps est
  // binaire ») qui n'avait jamais été portée ici parce qu'elle ne coûtait rien sur un petit fichier.
  //
  // La forme est celle du paquet mensuel : **l'entête reste en CLAIR sur une ligne**, puis les
  // octets. Sans entête lisible, un livre mal rangé serait impossible à identifier sans la clé —
  // et un comptable qui retrouve un fichier sur une clé USB doit pouvoir savoir de quel client et
  // de quelle année il parle avant de chercher son mot de passe.
  //
  // `cabinet-data.json` ne change PAS : il est petit, et migrer son enveloppe serait un risque pour
  // zéro gain.
  const livreRoot = path.join(dir, 'livres');
  const LIVRE_MARK = 'skanfact-livre';

  function livreDir(dossier, collisions) {
    const dest = path.join(livreRoot, folderName(dossier, collisions));
    if (!path.resolve(dest).startsWith(path.resolve(livreRoot) + path.sep)) {
      throw new Error('Chemin de livre refusé : il sortirait du dossier de l\'application.');
    }
    return dest;
  }
  const anneeSaine = a => (/^\d{4}$/.test(String(a)) ? String(a) : null);
  function livrePath(dossier, annee, collisions) {
    const a = anneeSaine(annee);
    if (!a) throw new Error('Exercice invalide : une année s\'écrit sur quatre chiffres.');
    return path.join(livreDir(dossier, collisions), `livre-${a}.json`);
  }

  function sealLivreBuffer(obj, salt, key, entete) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(obj), 'utf8')), cipher.final()]);
    const head = Buffer.from(JSON.stringify({
      [LIVRE_MARK]: 1, kdf: 'scrypt', salt: salt.toString('base64'),
      iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
      ...(entete || {})
    }) + '\n', 'utf8');
    return Buffer.concat([head, body]);
  }

  // Relire : l'entête jusqu'au premier saut de ligne, le reste en octets. On ne charge pas le
  // fichier en chaîne UTF-8 — des octets chiffrés ne sont pas du texte, et les décoder puis les
  // réencoder les abîmerait en silence.
  function openLivreBuffer(buf, key) {
    const nl = buf.indexOf(0x0a);
    if (nl < 0) throw new Error('Ce fichier n\'est pas un livre SkanFact.');
    let head;
    try { head = JSON.parse(buf.slice(0, nl).toString('utf8')); } catch { head = null; }
    if (!head || head[LIVRE_MARK] !== 1) throw new Error('Ce fichier n\'est pas un livre SkanFact.');
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(head.iv, 'base64'));
    d.setAuthTag(Buffer.from(head.tag, 'base64'));
    return { entete: head, livre: JSON.parse(Buffer.concat([d.update(buf.slice(nl + 1)), d.final()]).toString('utf8')) };
  }
  // L'entête seule, sans la clé : c'est elle qui rend un fichier mal rangé identifiable.
  function enteteLivre(fichier) {
    try {
      const fd = fs.openSync(fichier, 'r');
      const b = Buffer.alloc(1024);
      const n = fs.readSync(fd, b, 0, 1024, 0);
      fs.closeSync(fd);
      const nl = b.slice(0, n).indexOf(0x0a);
      if (nl < 0) return null;
      const h = JSON.parse(b.slice(0, nl).toString('utf8'));
      return h && h[LIVRE_MARK] === 1 ? h : null;
    } catch { return null; }
  }

  // ---------- le verrou ----------
  //
  // Un livre ouvert en écriture sur un autre poste ne s'écrase pas. Le verrou est **consultatif** et
  // il PÉRIME : un poste qui plante laisserait sinon un dossier verrouillé pour toujours, et c'est
  // pire que le risque qu'il évite (il n'y a qu'un poste en 9.2.0 ; la vraie fusion vient en 9.9.0).
  const LOCK_MS = 24 * 3600 * 1000;
  const lockPath = (dossier, annee, collisions) => livrePath(dossier, annee, collisions).replace(/\.json$/, '.lock');
  function lireVerrou(dossier, annee, collisions) {
    try {
      const o = JSON.parse(fs.readFileSync(lockPath(dossier, annee, collisions), 'utf8'));
      if (!o || !o.depuis) return null;
      return (now().getTime() - Number(o.depuis)) > LOCK_MS ? null : o;
    } catch { return null; }
  }
  function poserVerrou(dossier, annee, moi, collisions) {
    const v = lireVerrou(dossier, annee, collisions);
    if (v && v.deviceId && moi && v.deviceId !== moi.deviceId) return { ok: false, verrou: v };
    const f = lockPath(dossier, annee, collisions);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ deviceId: (moi && moi.deviceId) || '', deviceName: (moi && moi.deviceName) || '', depuis: now().getTime() }), 'utf8');
    return { ok: true };
  }
  function leverVerrou(dossier, annee, collisions) {
    try { fs.unlinkSync(lockPath(dossier, annee, collisions)); } catch { /* déjà parti */ }
  }

  // ---------- lire et écrire ----------
  //
  // Un livre illisible n'est JAMAIS écrasé : mis de côté sous son nom horodaté, exactement comme
  // `cabinet-data.json`. C'est la règle qui a sauvé l'app entreprise, et un livre porte la
  // comptabilité d'une année entière — il n'y a rien de plus cher dans cette application.
  function lireLivre(dossier, annee, collisions) {
    if (!st.key) throw new Error('Aucun cabinet ouvert.');
    const f = livrePath(dossier, annee, collisions);
    let buf;
    try { buf = fs.readFileSync(f); }
    catch (e) { if (e.code === 'ENOENT') return { absent: true }; throw e; }
    let r;
    try { r = openLivreBuffer(buf, st.key); }
    catch (e) { return { illisible: true, motif: e.message, fichier: f }; }
    if (KC.livreVersionInconnue(r.livre)) {
      return { versionInconnue: true, format: r.livre.format, fichier: f };
    }
    if (!KC.isValidLivre(r.livre)) {
      const aside = f.replace(/\.json$/, `.illisible-${stamp(now())}.json`);
      try { fs.renameSync(f, aside); } catch { /* on garde le fichier tel quel */ }
      return { illisible: true, motif: 'Ce fichier n\'a pas la forme d\'un livre.', misDeCote: aside };
    }
    return { livre: r.livre, entete: r.entete, fichier: f };
  }

  function ecrireLivre(dossier, livre, collisions) {
    if (!st.key) throw new Error('Aucun cabinet ouvert.');
    if (!KC.isValidLivre(livre)) throw new Error('Livre invalide : enregistrement refusé.');
    const f = livrePath(dossier, livre.exercice.annee, collisions);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    // L'entête en clair : de qui, de quand, combien. Pas un chiffre de plus — elle n'est pas
    // chiffrée, et le nombre d'écritures d'un client n'est pas un secret, son contenu si.
    const buf = sealLivreBuffer(livre, st.salt, st.key, {
      dossier: livre.dossier, nom: dossier.name || '', exercice: livre.exercice.annee,
      ecritures: livre.ecritures.length, ecritLe: stamp(now())
    });
    // La version PRÉCÉDENTE est gardée, une génération, avant d'écrire la nouvelle. Ce n'est pas la
    // sauvegarde — c'est la copie externe qui l'est — mais c'est ce qui rattrape l'accident réel :
    // un import qui remplace un mois de travers, une reprise relancée par erreur. Une génération et
    // pas trente : trente livres de 50 000 lignes par dossier feraient 2,9 Go pour un cabinet de
    // soixante clients, et une sauvegarde qui remplit le disque n'est plus une sauvegarde.
    //
    // La sauvegarde QUOTIDIENNE, elle, ne les emporte pas : elle est un seul JSON par jour, et le
    // dire vaut mieux que le laisser croire — c'est l'écran qui doit rappeler la copie externe.
    try { if (fs.existsSync(f)) fs.copyFileSync(f, f.replace(/\.json$/, '.precedent.json')); } catch { /* le filet manque, l'écriture passe quand même */ }
    const tmp = f + '.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, f);
    majIndexLivres(dossier, livre, collisions);
    return { ok: true, fichier: f };
  }

  // Un index léger par dossier : les exercices et leur état. Sans lui, afficher « ce client a 2024,
  // 2025 et 2026, dont 2024 clos » demanderait d'ouvrir et de déchiffrer trois livres entiers —
  // soixante dossiers, cent quatre-vingts fichiers, pour dessiner une liste.
  function indexPath(dossier, collisions) { return path.join(livreDir(dossier, collisions), 'livre-index.json'); }
  function lireIndexLivres(dossier, collisions) {
    try { const o = JSON.parse(fs.readFileSync(indexPath(dossier, collisions), 'utf8')); return Array.isArray(o.exercices) ? o : { format: 1, exercices: [] }; }
    catch { return { format: 1, exercices: [] }; }
  }
  function majIndexLivres(dossier, livre, collisions) {
    const idx = lireIndexLivres(dossier, collisions);
    const e = {
      annee: livre.exercice.annee, du: livre.exercice.du, au: livre.exercice.au,
      clos: !!livre.exercice.clos,
      ecritures: livre.ecritures.length,
      brouillards: livre.ecritures.filter(x => x.statut === 'brouillard').length,
      majLe: stamp(now())
    };
    idx.exercices = idx.exercices.filter(x => x.annee !== e.annee).concat([e]).sort((a, b) => a.annee - b.annee);
    try { fs.writeFileSync(indexPath(dossier, collisions), JSON.stringify(idx), 'utf8'); } catch { /* l'index se reconstruit */ }
    return idx;
  }

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
    let moved = 0, lost = 0, recovered = 0;
    const collisions = folderIndex(state.dossiers);
    // « Est-ce que ce chemin est dans MON dossier de paquets ? » Tout le reste vient d'ailleurs.
    const dansPackRoot = q => {
      try { return path.resolve(q).startsWith(path.resolve(packRoot) + path.sep); } catch { return false; }
    };
    (state.dossiers || []).forEach(d => {
      (d.packs || []).forEach(p => {
        if (!p.path) return;                                  // paquet d'exemple : aucun fichier
        const want = packPathFor(d, p.month, collisions);
        try {
          // Le contrôle d'existence vient AVANT celui de la place : un paquet déjà bien rangé dont le
          // fichier a disparu n'était jamais compté, et restait vert et « définitif » à l'écran.
          if (!fs.existsSync(p.path)) {
            // Mais « ce chemin ne désigne rien » ne veut pas dire « le fichier n'est plus là ». Un
            // paquet repris d'un autre ordinateur porte le chemin de CET autre ordinateur, alors que
            // le fichier, lui, a été recopié ici avec le reste. On le cherche donc à sa place
            // canonique — et sous son propre nom, pour les renvois (« -r2 ») — avant de déclarer
            // perdu un paquet qui est sur le disque. Sans ça, un comptable qui change de poste voit
            // ses huit cents pièces passer pour perdues, sans un mot.
            const nom = String(p.path).replace(/\\/g, '/').split('/').pop();
            const ici = [want, path.join(path.dirname(want), nom)].find(q => {
              try { return q && fs.existsSync(q); } catch { return false; }
            });
            if (!ici) { lost++; p.missingFile = true; return; }
            delete p.missingFile;
            p.path = ici;
            recovered++;
            return;
          }
          delete p.missingFile;
          if (p.path === want) return;
          // Le chemin existe, mais est-il CHEZ NOUS ? Après une reprise, il peut désigner le support
          // d'origine — la clé USB encore branchée, le dossier iCloud de l'ancien poste. Le fichier
          // a pourtant été recopié ici avec le reste : c'est sur notre copie qu'il faut se recoller,
          // sinon le cabinet lit les pièces de ses clients sur une clé qu'on va débrancher.
          if (!dansPackRoot(p.path)) {
            const nom = String(p.path).replace(/\\/g, '/').split('/').pop();
            const ici = [path.join(path.dirname(want), nom), want].find(q => {
              try { return fs.existsSync(q); } catch { return false; }
            });
            if (ici) { p.path = ici; recovered++; return; }
            // Pas encore chez nous : on le rapatrie par COPIE. Un `rename` entre deux disques
            // échoue (EXDEV), et surtout on ne vide pas le support de quelqu'un d'autre.
            fs.mkdirSync(path.dirname(want), { recursive: true });
            fs.copyFileSync(p.path, want);
            p.path = want;
            recovered++;
            return;
          }
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
    return { moved, lost, recovered };
  }

  // Taille occupée par les paquets : un comptable doit pouvoir répondre à « pourquoi mon disque se
  // remplit ». Personne ne l'a jamais dit dans l'application.
  function treeStats(root) {
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
    walk(root);
    return { files, bytes };
  }
  function packStats() { return treeStats(packRoot); }

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
  // `cpSync(..., { force: false })` ne remplace JAMAIS ce qui existe déjà. Sur la clé USB, l'index
  // disait « mars, définitif » pendant que le paquet posé à côté était la version d'avant. Une
  // sauvegarde qui ment est pire que pas de sauvegarde : on compare taille et date, et on recopie
  // ce qui diffère. (On n'efface rien : une sauvegarde qui supprime ce qu'on supprime n'en est plus
  // une. L'interface le dit dans les fenêtres de suppression.)
  function copierSiDifferent(src, dst) {
    try {
      const a = fs.statSync(src);
      let b = null;
      try { b = fs.statSync(dst); } catch {}
      if (b && b.size === a.size && Math.abs(b.mtimeMs - a.mtimeMs) < 2000) return false;
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const tmp = dst + '.tmp';
      fs.copyFileSync(src, tmp);
      fs.renameSync(tmp, dst);
      try { fs.utimesSync(dst, a.atime, a.mtime); } catch {}
      return true;
    } catch (e) { log('copie externe ' + path.basename(src), e); return false; }
  }

  function copierArbre(src, dst) {
    let entries = [];
    try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch { return; }
    fs.mkdirSync(dst, { recursive: true });
    entries.forEach(e => {
      const a = path.join(src, e.name), b = path.join(dst, e.name);
      if (e.isDirectory()) copierArbre(a, b);
      else copierSiDifferent(a, b);
    });
  }

  function mirrorExternal(opts) {
    const avecPaquets = !!(opts && opts.packs);
    const ext = st.external.dir;
    if (!ext) return false;
    try {
      if (!fs.existsSync(ext)) throw new Error('dossier introuvable (support débranché ?)');
      const target = path.join(ext, 'SkanFact Cabinet');
      fs.mkdirSync(path.join(target, 'sauvegardes'), { recursive: true });
      if (exists()) copierSiDifferent(file, path.join(target, 'cabinet-data.json'));
      let names = [];
      try { names = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')); } catch {}
      names.forEach(n => copierSiDifferent(path.join(backupDir, n), path.join(target, 'sauvegardes', n)));
      if (avecPaquets && fs.existsSync(packRoot)) copierArbre(packRoot, path.join(target, 'paquets'));
      // Les LIVRES partent toujours, avec ou sans les paquets (9.2.0). Un paquet perdu se redemande
      // au client ; un livre perdu, non — il porte le travail du comptable, saisies, validations et
      // lettrages compris, et personne d'autre ne l'a. C'est le fichier le plus cher de
      // l'application, et il pèse moins que les photos de justificatifs d'un seul mois.
      if (fs.existsSync(livreRoot)) copierArbre(livreRoot, path.join(target, 'livres'));
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
    inspectSource, adoptSource,
    packPathFor, storePack, removePack, removeDossierFiles, reorganize, packStats, folderName, folderIndex,
    // Le livre (9.2.0)
    livreDir, livrePath, lireLivre, ecrireLivre, enteteLivre, lireIndexLivres,
    lireVerrou, poserVerrou, leverVerrou,
    setExternalDir, mirrorExternal
  };
}

module.exports = { createCabStore, makeRecovery, readRecovery, isValidCabinet, isEnvelope, slug, stamp, MARK, RECOVER_MARK };
