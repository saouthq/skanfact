// Licence hors ligne (6.4.0).
//
// SkanFact se vend, donc il faut une licence. Trois règles, posées avant d'écrire une ligne :
//
// 1. **Pas de serveur.** Une licence est une clé signée par Skander avec sa clé privée, et vérifiée
//    par l'application avec la clé publique embarquée. Aucun appel réseau, jamais — une entreprise
//    tunisienne dont la connexion tombe ne doit pas perdre l'accès à sa facturation.
// 2. **Jamais de données en otage.** Une licence expirée n'empêche que la CRÉATION de nouvelles
//    pièces. Lire, imprimer, exporter, sauvegarder, envoyer le paquet au comptable : toujours.
//    C'est une limite commerciale, pas une prise d'otage.
// 3. **Tant qu'aucune clé publique n'est configurée, l'application est libre.** C'est l'état livré :
//    la machinerie est là, elle ne verrouille rien tant que le propriétaire ne l'a pas armée
//    (`scripts/licence.js --keygen`, puis la clé publique dans `build/licence-public.json`).
//    Un logiciel qui se verrouillerait tout seul à l'installation serait un défaut, pas une licence.
//
// Testable sans Electron : c'est du Node pur.
const crypto = require('crypto');

const FORMAT = 1;
const TRIAL_DAYS = 30;
const PREFIX = 'SKAN1.';

// ---------- dates : mêmes règles que partout ailleurs (voir CLAUDE.md, 5.2.3) ----------
const isoDay = dt => dt.toISOString().slice(0, 10);
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d)) return '';
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
  return isoDay(d);
}
function daysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso + 'T00:00:00Z'), b = Date.parse(toIso + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// ---------- fabrication (côté Skander, jamais dans l'application) ----------
function generateKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' })
  };
}

// Une licence tient en une ligne : le contenu en clair (base64url) et sa signature. Elle se copie
// dans un mail, elle se colle dans l'application. Rien à installer, rien à activer en ligne.
function signLicence(payload, privateKeyPem) {
  const body = { format: FORMAT, ...payload };
  const json = Buffer.from(JSON.stringify(body), 'utf8');
  const sig = crypto.sign(null, json, crypto.createPrivateKey(privateKeyPem));
  return PREFIX + b64u(json) + '.' + b64u(sig);
}

// ---------- vérification (dans l'application) ----------
function parseKey(key) {
  const s = String(key || '').trim().replace(/\s+/g, '');
  if (!s.startsWith(PREFIX)) return null;
  const parts = s.slice(PREFIX.length).split('.');
  if (parts.length !== 2) return null;
  try {
    const json = unb64u(parts[0]);
    return { json, sig: unb64u(parts[1]), payload: JSON.parse(json.toString('utf8')) };
  } catch { return null; }
}

// Renvoie le contenu de la licence, ou null. Aucune exception : une clé mal collée est un cas
// ordinaire, pas une erreur de programmation.
function verifyKey(key, publicKeyPem) {
  if (!publicKeyPem) return null;
  const p = parseKey(key);
  if (!p) return null;
  try {
    if (!crypto.verify(null, p.json, crypto.createPublicKey(publicKeyPem), p.sig)) return null;
  } catch { return null; }
  return p.payload;
}

// L'état de la licence, tel que l'application le montre et l'applique.
//   libre     : aucune clé publique configurée — la licence n'est pas armée, tout est permis
//   essai     : les 30 premiers jours, complets
//   active    : licence valide
//   expiree   : licence dépassée → seule la création de nouvelles pièces attend
//   invalide  : clé illisible ou signature fausse
//   finessai  : essai terminé sans licence
function licenceState(opts) {
  opts = opts || {};
  const t = opts.today || today();
  const pub = opts.publicKey || '';
  if (!pub) {
    return { state: 'libre', locked: false, label: 'Licence non requise',
      detail: 'Cette version n\'exige pas de licence.', key: '', name: '', exp: '', daysLeft: null };
  }
  const installedAt = opts.installedAt || t;
  const trialEnd = addDays(installedAt, TRIAL_DAYS);
  const payload = opts.key ? verifyKey(opts.key, pub) : null;

  if (opts.key && !payload) {
    return { state: 'invalide', locked: true, label: 'Licence non reconnue',
      detail: 'Cette clé n\'est pas lisible ou n\'a pas été émise pour SkanFact. Vérifie qu\'elle a été collée en entier.',
      key: opts.key, name: '', exp: '', daysLeft: null };
  }

  if (payload) {
    const exp = String(payload.exp || '');
    const left = exp ? daysBetween(t, exp) : null;
    if (!exp || left >= 0) {
      return {
        state: 'active', locked: false,
        label: exp ? `Licence active jusqu'au ${exp}` : 'Licence sans limite de durée',
        detail: left != null && left <= 30 ? `Elle se termine dans ${left} jour(s) : pense à la renouveler.` : '',
        key: opts.key, name: payload.nom || '', matricule: payload.matricule || '',
        cabinet: payload.cabinet || '', exp, daysLeft: left, payload
      };
    }
    return {
      state: 'expiree', locked: true, label: `Licence expirée le ${exp}`,
      detail: 'Tout reste lisible, imprimable et exportable. Seule la création de nouvelles pièces attend le renouvellement.',
      key: opts.key, name: payload.nom || '', matricule: payload.matricule || '',
      cabinet: payload.cabinet || '', exp, daysLeft: left, payload
    };
  }

  const left = daysBetween(t, trialEnd);
  if (left >= 0) {
    return { state: 'essai', locked: false, label: `Période d'essai — ${left} jour(s) restants`,
      detail: 'Tout est disponible pendant l\'essai. Demande ta licence avant la fin pour ne pas être interrompu.',
      key: '', name: '', exp: trialEnd, daysLeft: left };
  }
  return { state: 'finessai', locked: true, label: 'Période d\'essai terminée',
    detail: 'Tes données restent lisibles, imprimables et exportables. La création de nouvelles pièces attend ta licence.',
    key: '', name: '', exp: trialEnd, daysLeft: left };
}

// Le mail de demande de licence : tout ce qu'il faut pour émettre la clé, déjà écrit.
function requestMail(company, state, deviceName) {
  const cab = (company && company.cabinet) || {};
  return {
    subject: `Demande de licence SkanFact — ${(company && company.name) || ''}`,
    body: `Bonjour,\n\nJe souhaite une licence SkanFact.\n\n`
      + `Entreprise : ${(company && company.name) || ''}\n`
      + `Matricule fiscal : ${(company && company.matricule) || ''}\n`
      + `Email : ${(company && company.email) || ''}\n`
      + `Poste : ${deviceName || ''}\n`
      + (cab.fingerprint ? `Cabinet comptable : ${cab.name || ''} (empreinte ${cab.fingerprint})\n` : '')
      + `État actuel : ${state ? state.label : ''}\n\n`
      + (cab.fingerprint ? `Mon cabinet utilise SkanFact Cabinet : merci d'appliquer la remise de parrainage.\n\n` : '')
      + `Merci,\n${(company && company.name) || ''}`
  };
}

module.exports = { FORMAT, TRIAL_DAYS, PREFIX, generateKeys, signLicence, parseKey, verifyKey, licenceState, requestMail, today, addDays, daysBetween };
