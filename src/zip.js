// Écriture de fichiers ZIP, sans aucune dépendance (6.1.0).
//
// Pourquoi écrire un ZIP à la main plutôt que d'ajouter une bibliothèque : le paquet mensuel part
// chez un comptable qui ne connaît pas SkanFact. Il doit pouvoir l'ouvrir avec le Finder, l'Explorateur
// ou n'importe quel outil, sans rien installer, même si SkanFact disparaît demain. Un format propriétaire
// ferait de nous le seul lecteur possible des pièces comptables de quelqu'un d'autre — c'est inacceptable.
// Et le projet n'a aucune dépendance runtime hors Electron : ce n'est pas le paquet mensuel qui va
// commencer (voir CLAUDE.md).
//
// Ce module est du Node pur (zlib, crypto) : il se teste sans Electron.
const zlib = require('zlib');
const crypto = require('crypto');

// Table CRC-32 (polynôme 0xEDB88320), calculée une fois.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ (-1)) >>> 0;
}

// Date/heure au format MS-DOS, sur deux mots de 16 bits. La seconde est sur 5 bits : elle ne compte
// que les secondes paires, c'est le format qui veut ça. Avant 1980, DOS ne sait rien représenter.
function dosDateTime(date) {
  const d = date instanceof Date && !isNaN(date) ? date : new Date(Date.UTC(1980, 0, 1));
  const y = Math.max(1980, d.getUTCFullYear());
  const time = ((d.getUTCHours() & 31) << 11) | ((d.getUTCMinutes() & 63) << 5) | ((d.getUTCSeconds() / 2) & 31);
  const day = (((y - 1980) & 127) << 9) | (((d.getUTCMonth() + 1) & 15) << 5) | (d.getUTCDate() & 31);
  return { time: time & 0xFFFF, date: day & 0xFFFF };
}

const SIG_LOCAL = 0x04034b50, SIG_CENTRAL = 0x02014b50, SIG_EOCD = 0x06054b50;
const METHOD_STORE = 0, METHOD_DEFLATE = 8;
const FLAG_UTF8 = 0x0800;              // les noms de fichiers sont en UTF-8 (accents des libellés français)
const MAX_ZIP = 0xFFFFFFFF;            // au-delà il faudrait ZIP64 : on refuse plutôt que d'écrire un fichier illisible

// Ce qui ne gagne rien à être recompressé : déjà compressé à la source. Compresser un JPEG le
// rallonge et coûte du temps pour rien.
const ALREADY_COMPRESSED = /\.(jpe?g|png|gif|webp|heic|pdf|zip|gz|mp4|mov|docx|xlsx)$/i;

function shouldDeflate(name, buf) {
  if (buf.length < 128) return false;           // l'entête de deflate coûterait plus que le gain
  return !ALREADY_COMPRESSED.test(name);
}

// `entries` : [{ name: 'journaux/ventes.csv', data: Buffer|string, date?: Date, store?: boolean }]
// Renvoie un Buffer qui est un fichier ZIP valide.
function zipBuffer(entries, opts) {
  opts = opts || {};
  const parts = [];
  const central = [];
  let offset = 0;

  (entries || []).forEach(e => {
    const name = String(e.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!name) throw new Error('Entrée sans nom dans le paquet.');
    if (/(^|\/)\.\.(\/|$)/.test(name)) throw new Error('Nom de fichier interdit dans le paquet : ' + name);
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data == null ? '' : e.data), 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const { time, date } = dosDateTime(e.date || opts.date);

    const deflate = e.store === true ? false : shouldDeflate(name, raw);
    const body = deflate ? zlib.deflateRawSync(raw, { level: 6 }) : raw;
    const method = deflate ? METHOD_DEFLATE : METHOD_STORE;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4);             // version minimale pour extraire : 2.0
    local.writeUInt16LE(FLAG_UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);             // pas de champ « extra »
    parts.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(SIG_CENTRAL, 0);
    cd.writeUInt16LE(0x031E, 4);            // écrit par un système Unix, version 3.0
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(FLAG_UTF8, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);                // extra
    cd.writeUInt16LE(0, 32);                // commentaire
    cd.writeUInt16LE(0, 34);                // disque de départ
    cd.writeUInt16LE(0, 36);                // attributs internes
    // Droits Unix (fichier ordinaire, lecture pour tous) dans les 16 bits de poids fort. Le `>>> 0`
    // n'est pas décoratif : en JavaScript un décalage travaille sur 32 bits SIGNÉS, et 0o100644 << 16
    // devient négatif — writeUInt32LE le refuse.
    cd.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
    if (offset > MAX_ZIP) throw new Error('Paquet trop volumineux (plus de 4 Go).');
  });

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);                 // numéro de ce disque
  eocd.writeUInt16LE(0, 6);                 // disque où commence le répertoire central
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);                // pas de commentaire d'archive
  return Buffer.concat([...parts, cdBuf, eocd]);
}

// Lecture : on n'a besoin que du répertoire central, qui donne tout. On lit depuis la fin, comme le
// veut le format — c'est ce qui permet d'ajouter des fichiers à un ZIP sans le réécrire.
function zipRead(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('Ce fichier n\'est pas un paquet lisible.');
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65535; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fin d\'archive introuvable : le fichier est tronqué ou n\'est pas un paquet.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== SIG_CENTRAL) throw new Error('Répertoire de l\'archive abîmé.');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const rawSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const cmtLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    // L'entête local redonne les longueurs du nom et de l'extra : elles peuvent différer du central.
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const body = buf.subarray(start, start + compSize);
    out.push({
      name, method, crc, size: rawSize,
      data: () => {
        const raw = method === METHOD_DEFLATE ? zlib.inflateRawSync(body) : Buffer.from(body);
        if (crc32(raw) !== crc) throw new Error(`Le fichier « ${name} » du paquet est abîmé.`);
        return raw;
      }
    });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8')).digest('hex');
}

// ---------- paquet scellé ----------
// Un paquet chiffré reste un FICHIER BINAIRE : une entête lisible d'une ligne, puis les octets
// chiffrés tels quels. Pas de base64 : sur un paquet de 50 Mo de photos, il ajouterait 17 Mo pour rien.
// L'entête est en clair à dessein — le comptable doit pouvoir lire de qui vient le paquet et pour quel
// mois AVANT de connaître le mot de passe, sinon un paquet mal rangé devient indéchiffrable.
const SEAL_MAGIC = 'SKANPACK1';
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(password, salt) {
  return crypto.scryptSync(String(password), salt, 32, SCRYPT);
}

function sealBuffer(buf, password, headerExtra) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(password, salt), iv);
  const body = Buffer.concat([cipher.update(buf), cipher.final()]);
  const head = Buffer.from(JSON.stringify({
    alg: 'aes-256-gcm', kdf: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
    salt: salt.toString('base64'), iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ...(headerExtra || {})
  }), 'utf8');
  return Buffer.concat([Buffer.from(SEAL_MAGIC + '\n', 'utf8'), head, Buffer.from('\n', 'utf8'), body]);
}

function isSealed(buf) {
  return Buffer.isBuffer(buf) && buf.length > SEAL_MAGIC.length && buf.toString('utf8', 0, SEAL_MAGIC.length) === SEAL_MAGIC;
}

// L'entête seule, sans mot de passe : c'est ce qui permet de dire « ce paquet vient de X, pour août »
// même quand on n'a pas la clé.
function sealHeader(buf) {
  if (!isSealed(buf)) return null;
  const start = SEAL_MAGIC.length + 1;
  const end = buf.indexOf(0x0A, start);
  if (end < 0) throw new Error('Paquet scellé illisible : entête tronquée.');
  try { return JSON.parse(buf.toString('utf8', start, end)); }
  catch { throw new Error('Paquet scellé illisible : entête abîmée.'); }
}

function openBuffer(buf, password) {
  const head = sealHeader(buf);
  if (!head) throw new Error('Ce fichier n\'est pas un paquet scellé.');
  const end = buf.indexOf(0x0A, SEAL_MAGIC.length + 1);
  const body = buf.subarray(end + 1);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(password, Buffer.from(head.salt, 'base64')), Buffer.from(head.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(head.tag, 'base64'));
  try { return Buffer.concat([decipher.update(body), decipher.final()]); }
  catch { throw new Error('Mot de passe incorrect, ou paquet modifié depuis son envoi.'); }
}

// ---------- sceller pour un cabinet précis (6.2.0) ----------
// Le mot de passe partagé a deux défauts : il se transmet (donc il fuite), et il est le même pour
// tous les clients d'un cabinet. Ici chaque cabinet a une paire de clés ; l'entreprise ne connaît
// que la clé PUBLIQUE, et un paquet chiffré pour elle n'est lisible que par le cabinet. Rien à
// transmettre, rien à retenir, et une clé volée chez un client n'ouvre aucun paquet.
//
// X25519 pour l'échange (une clé éphémère par paquet, donc deux paquets identiques donnent deux
// fichiers différents), HKDF-SHA256 pour dériver la clé, AES-256-GCM pour le contenu.
const SEALBOX_MAGIC = 'SKANPACKX1';
const HKDF_INFO = Buffer.from('skanpack-v1');

function generateCabinetKeys() {
  const kp = crypto.generateKeyPairSync('x25519');
  return {
    publicKey: kp.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: kp.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
  };
}

// L'empreinte que le comptable lit à voix haute au téléphone pour que son client vérifie qu'il a bien
// SA clé, et pas celle d'un imposteur. Vingt caractères en cinq groupes : assez court pour être dicté,
// assez long pour qu'on ne puisse pas en fabriquer une identique.
function keyFingerprint(publicKeyB64) {
  const hex = sha256(Buffer.from(String(publicKeyB64 || ''), 'base64')).toUpperCase();
  return (hex.slice(0, 20).match(/.{4}/g) || []).join('-');
}

function publicKeyFrom(b64) {
  return crypto.createPublicKey({ key: Buffer.from(b64, 'base64'), type: 'spki', format: 'der' });
}
function privateKeyFrom(b64) {
  return crypto.createPrivateKey({ key: Buffer.from(b64, 'base64'), type: 'pkcs8', format: 'der' });
}
function deriveShared(privateKey, publicKey, salt) {
  const secret = crypto.diffieHellman({ privateKey, publicKey });
  return Buffer.from(crypto.hkdfSync('sha256', secret, salt, HKDF_INFO, 32));
}

function sealForCabinet(buf, cabinetPublicKeyB64, headerExtra) {
  const eph = crypto.generateKeyPairSync('x25519');
  const salt = crypto.randomBytes(16);
  const key = deriveShared(eph.privateKey, publicKeyFrom(cabinetPublicKeyB64), salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(buf), cipher.final()]);
  const head = Buffer.from(JSON.stringify({
    alg: 'x25519+aes-256-gcm', kdf: 'hkdf-sha256',
    ephemeral: eph.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    destinataire: keyFingerprint(cabinetPublicKeyB64),
    salt: salt.toString('base64'), iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ...(headerExtra || {})
  }), 'utf8');
  return Buffer.concat([Buffer.from(SEALBOX_MAGIC + '\n', 'utf8'), head, Buffer.from('\n', 'utf8'), body]);
}

function isSealedForCabinet(buf) {
  return Buffer.isBuffer(buf) && buf.length > SEALBOX_MAGIC.length && buf.toString('utf8', 0, SEALBOX_MAGIC.length) === SEALBOX_MAGIC;
}

function cabinetHeader(buf) {
  if (!isSealedForCabinet(buf)) return null;
  const start = SEALBOX_MAGIC.length + 1;
  const end = buf.indexOf(0x0A, start);
  if (end < 0) throw new Error('Paquet illisible : entête tronquée.');
  try { return JSON.parse(buf.toString('utf8', start, end)); }
  catch { throw new Error('Paquet illisible : entête abîmée.'); }
}

function openWithCabinetKey(buf, cabinetPrivateKeyB64) {
  const head = cabinetHeader(buf);
  if (!head) throw new Error('Ce fichier n\'est pas un paquet adressé à un cabinet.');
  const end = buf.indexOf(0x0A, SEALBOX_MAGIC.length + 1);
  const body = buf.subarray(end + 1);
  const key = deriveShared(privateKeyFrom(cabinetPrivateKeyB64), publicKeyFrom(head.ephemeral), Buffer.from(head.salt, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(head.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(head.tag, 'base64'));
  try { return Buffer.concat([decipher.update(body), decipher.final()]); }
  catch { throw new Error('Ce paquet n\'est pas destiné à ce cabinet, ou il a été modifié depuis son envoi.'); }
}

module.exports = {
  zipBuffer, zipRead, crc32, sha256, dosDateTime,
  sealBuffer, openBuffer, sealHeader, isSealed,
  generateCabinetKeys, keyFingerprint, sealForCabinet, openWithCabinetKey, cabinetHeader, isSealedForCabinet
};
