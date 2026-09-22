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
// 3. **Tant qu'aucune clé publique n'est configurée, l'application est libre.** C'était l'état livré
//    de la 6.4.0 à la 7.33.0 : la machinerie était là, elle ne verrouillait rien tant que le
//    propriétaire ne l'avait pas armée. Depuis la **8.0.0**, `build/licence-public.json` porte la clé
//    publique de l'éditeur (créée dans SkanFact le 14/09/2026) : chaque installation a 30 jours
//    d'essai à partir du jour où elle voit cette clé, puis attend une clé de licence.
// 4. **Celui qui signe n'achète pas.** Le poste où vit la clé PRIVÉE correspondant à la clé publique
//    en vigueur est l'état `editeur` : jamais d'essai, jamais de verrou — sinon l'éditeur se serait
//    retrouvé verrouillé chez lui au trente-et-unième jour, avec une clé qu'il ne peut s'émettre qu'en
//    se déclarant client de lui-même. Une clé collée sur ce poste reprend le dessus : c'est ainsi
//    qu'il voit exactement ce que voit un client.
//
// Testable sans Electron : c'est du Node pur.
const crypto = require('crypto');

const FORMAT = 1;
const TRIAL_DAYS = 30;
const PREFIX = 'SKAN1.';
// L'adresse à laquelle un client écrit quand quelque chose ne va pas avec sa licence. Elle vit aussi
// dans app.js (`LICENCE_CONTACT`), parce qu'un renderer ne peut pas charger ce module ; un test
// confronte les deux — deux adresses qui divergent, c'est un client qui écrit dans le vide.
const CONTACT = 'contact@skanfact.tn';

// ---------- les offres (7.33.0) ----------
// Ce que la page Tarifs du site promet, et rien d'autre. L'offre voyage DANS la clé signée : un client
// ne peut pas se la changer. `reserves` liste les modules (ids de core.MODULES) dont la CRÉATION est
// réservée à l'offre du dessus — jamais la lecture, jamais l'export, jamais l'envoi au comptable
// (6.4.0 : aucune donnée en otage). Quelqu'un qui repasse d'Entreprise à Indépendant garde ses
// bulletins de paie lisibles pour toujours, il ne peut plus en établir de nouveaux.
// `partage` n'est pas un module de la barre latérale : c'est le dossier partagé à deux (3.2.0).
// Une clé sans `offre` (émise avant la 7.33.0) vaut Entreprise, et une offre inconnue aussi : en cas de
// doute, on ouvre — jamais de données en otage.
//
// « achats » en est sorti en 10.7.0, et ce n'est pas une concession commerciale : c'est un
// correctif. Mesuré sur le jeu de démonstration, exercice 2026 entier — un client qui n'a jamais
// pu enregistrer un achat envoie à son comptable un paquet qui déclare **7 441,33 DT** de TVA au
// lieu de **3 250,16** : la collectée y est, la déductible vaut zéro, et l'écart de 4 191 DT est
// annoncé à l'administration sur un logiciel vendu 390. C'est le seul des six modules réservés qui
// change un chiffre que le client DÉPOSE et PAIE ; les cinq autres ne touchent ni la TVA ni une
// case déclarée, et ce qu'ils portent (stock, amortissements, bulletins) est très exactement ce
// que le cabinet fait à sa place depuis les 9.7.0 et 10.3.0. Le module s'appelle d'ailleurs
// « Achats et fournisseurs — ce que tu dépenses, et LA TVA QUE TU RÉCUPÈRES DESSUS ».
//
// La règle qui en sort, et qu'un test tient : **une offre peut fermer un confort, jamais une case
// de déclaration.** Remettre « achats » ici fait tomber ce test, avec le chiffre.
const OFFRES = {
  independant: { label: 'Indépendant', reserves: ['stock', 'immos', 'pilotage', 'paie', 'partage'] },
  entreprise: { label: 'Entreprise', reserves: [] }
};
const OFFRE_DEFAUT = 'entreprise';
function offreDe(payload) {
  const o = payload && payload.offre;
  return OFFRES[o] ? o : OFFRE_DEFAUT;
}

// Les durées qu'on propose à l'émission. « À vie » = pas de date d'expiration du tout.
const DUREES = [
  { id: '1m', label: '1 mois', mois: 1 },
  { id: '3m', label: '3 mois', mois: 3 },
  { id: '6m', label: '6 mois', mois: 6 },
  { id: '1a', label: '1 an', mois: 12 },
  { id: '2a', label: '2 ans', mois: 24 },
  { id: 'vie', label: 'À vie', mois: null },
  { id: 'date', label: 'Jusqu\'à une date précise', mois: null }
];

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
// Un mois de licence est un mois du calendrier, pas 30,44 jours : « un an » à partir du 14 septembre
// finit le 14 septembre suivant, et le 31 janvier + 1 mois donne le 28 février, pas le 3 mars.
function addMonths(iso, months) {
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d)) return '';
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + (Number(months) || 0));
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return isoDay(d);
}
function daysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso + 'T00:00:00Z'), b = Date.parse(toIso + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}
// Un jour qui existe vraiment : « 2027-02-30 » a la bonne forme et Date.parse le fait rouler au
// 2 mars sans rien dire — une licence finirait un jour que personne n'a choisi.
const dateValide = iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) && isoDay(new Date(iso + 'T00:00:00Z')) === iso;
// La date de fin d'une licence pour cette durée, à partir de `fromIso` ('' = à vie). Une date libre
// doit être dans le futur : une licence née expirée n'est pas une licence.
function expirationPour(fromIso, dureeId, dateLibre) {
  if (dureeId === 'vie') return '';
  if (dureeId === 'date') {
    const d = String(dateLibre || '').trim();
    return dateValide(d) && daysBetween(fromIso, d) > 0 ? d : null;
  }
  const du = DUREES.find(x => x.id === dureeId);
  return du && du.mois ? addMonths(fromIso, du.mois) : null;
}

// ---------- le matricule fiscal : ce qui attache une clé à UNE entreprise ----------
// Une clé émise pour Trabelsi ne s'active pas sur le dossier d'une autre société. On compare le CŒUR
// du matricule : les sept chiffres, et la lettre-clé quand les deux côtés l'écrivent — « MF 1234567A »,
// « 1234567/A/M/000 », « 1234567-a » désignent la même entreprise. Un côté vide ne compte pas : on ne
// punit pas quelqu'un qui n'a pas encore rempli sa fiche — ses factures, elles, n'auront pas de
// matricule, et c'est déjà son problème.
function normMatricule(s) {
  const brut = String(s || '').toUpperCase();
  // La lettre-clé est COLLÉE aux chiffres (« 1234567A ») ; ce qui suit une barre (« /A/M/000 ») est
  // le code TVA et le suffixe, pas la clé — les confondre ferait refuser une clé légitime.
  const m = brut.match(/(\d{7})\s?([A-Z])?/);
  if (m) return { chiffres: m[1], lettre: m[2] || '' };
  const reste = brut.replace(/[^A-Z0-9]/g, '');
  return reste ? { chiffres: reste, lettre: '' } : null;
}
function memeMatricule(a, b) {
  const na = normMatricule(a), nb = normMatricule(b);
  if (!na || !nb) return true;
  return na.chiffres === nb.chiffres && (!na.lettre || !nb.lettre || na.lettre === nb.lettre);
}

const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// ---------- les clés publiques que l'application connaît (8.4.0) ----------
// Jusqu'à la 8.3.0 il n'y en avait qu'une : celle de Skander, dans `build/licence-public.json`.
// La plateforme en ajoute une seconde — celle qui vit sur le serveur et signe les ventes courantes —
// et il en viendra d'autres le jour où l'une sera remplacée. Le mécanisme est celui des autorités de
// certification : chaque clé porte un identifiant (`kid`), et la licence dit laquelle l'a signée.
//
// `lireCles` accepte les trois formes qui existent VRAIMENT, parce que les trois sont déjà sur des
// disques quelque part :
//   - une chaîne PEM                      (l'appelant d'avant la 8.4.0)
//   - `{ format, publicKey, createdAt }`  (le fichier de la 8.0.0, et celui de l'éditeur)
//   - `{ cles: [{ kid, publicKey, depuis, retiree? }] }`  (build/licences-publiques.json)
// Une clé sans `kid` devient `master` : c'est la clé historique, et c'est elle que désigne une
// licence qui n'en nomme aucune.
function lireCles(source) {
  if (!source) return [];
  if (typeof source === 'string') {
    const s = source.trim();
    if (!s) return [];
    if (s.startsWith('-----')) return [{ kid: 'master', publicKey: s, depuis: '' }];
    try { return lireCles(JSON.parse(s)); } catch { return []; }
  }
  const liste = Array.isArray(source) ? source
    : (Array.isArray(source.cles) ? source.cles : (source.publicKey ? [source] : []));
  return liste
    .filter(c => c && c.publicKey && !c.retiree)
    .map(c => ({ kid: String(c.kid || 'master'), publicKey: String(c.publicKey), depuis: String(c.depuis || c.createdAt || '') }));
}

// LA règle de compatibilité la plus dangereuse du chantier, et son jumeau côté serveur
// (`plateforme/skanfact-api.mjs`). Toutes les licences émises depuis la 8.0.0 ont été signées par la
// clé maître et ne portent AUCUN `kid` : sans la première ligne, la mise à jour les invaliderait
// toutes d'un coup, et chaque client payant lirait « clé non reconnue » le même matin.
//
// On ne tente JAMAIS toutes les clés à la suite : `kid` désigne une clé et une seule. C'est ce qui
// permet de RETIRER une clé compromise — elle ne vérifie plus rien — au lieu de la laisser valider
// éternellement les licences qu'elle a signées.
function choisirCle(kid, cles) {
  const liste = lireCles(cles);
  const k = String(kid || '').trim();
  if (!k) return liste.find(c => c.kid === 'master') || null;
  return liste.find(c => c.kid === k) || null;
}

// L'empreinte d'une clé de licence : la même que celle du serveur (`empreinteCle` du worker), sinon
// une réponse ne pourrait pas être rattachée à SA licence. SHA-256 du texte de la clé, 32 hexa.
function empreinteCle(cle) {
  return crypto.createHash('sha256').update(String(cle || '').trim(), 'utf8').digest('hex').slice(0, 32);
}

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
// `cles` est ce que `lireCles` accepte — une chaîne PEM continue de marcher, c'est ce que tous les
// appelants d'avant la 8.4.0 passent.
function verifyKey(key, cles) {
  const pub = choisirCle(((parseKey(key) || {}).payload || {}).kid, cles);
  if (!pub) return null;
  const p = parseKey(key);
  if (!p) return null;
  try {
    if (!crypto.verify(null, p.json, crypto.createPublicKey(pub.publicKey), p.sig)) return null;
  } catch { return null; }
  return p.payload;
}

// ---------- la réponse du plan de contrôle (8.4.0) ----------
// Depuis la 8.4.0 l'application demande à la plateforme ce qu'elle sait de sa clé. La réponse ne
// peut faire qu'UNE chose : ajouter une restriction déjà prévue (une révocation). Elle n'accorde
// jamais un droit que la clé signée ne porte pas — le serveur ne peut pas transformer un Indépendant
// en Entreprise, ni prolonger une licence finie. C'est la règle 4 du § 8 de PLAN-PLATEFORME.md, et
// c'est elle qui fait que la disparition du serveur ne casse rien.
//
// Trois garde-fous, chacun contre une attaque précise :
//   - **signée** : sans ça, quiconque se place entre le client et le serveur (un wifi d'hôtel, un
//     pare-feu d'entreprise) répond « révoquée » et bloque un client honnête ;
//   - **liée au sujet** : sans ça, la réponse « révoquée » destinée au client A se rejoue chez B ;
//   - **datée** : sans ça, on rejoue une vieille réponse pour ressusciter une révocation annulée.
const REPONSE_V = 1;
const REPONSE_JOURS_MAX = 45;   // au-delà, on ne l'accepte plus : c'est un rejeu, pas une nouvelle
const REPONSE_JOURS_AVANCE = 1; // tolérance d'horloge, dans l'autre sens

// Le corps exactement tel que le serveur l'a signé (`corpsReponse` du worker). On le RECONSTRUIT
// champ par champ au lieu de re-sérialiser ce qui est arrivé : un champ ajouté par un proxy, un
// ordre de clés différent, et la signature paraîtrait fausse sur une réponse parfaitement valide.
function corpsReponse(rep) {
  const r = rep || {};
  return {
    v: REPONSE_V,
    sujet: String(r.sujet || ''),
    etat: String(r.etat || 'inconnue'),
    offre: r.offre == null ? null : r.offre,
    exp: r.exp == null ? null : r.exp,
    postes: Number.isFinite(r.postes) ? r.postes : null,
    motif: r.motif == null ? null : r.motif,
    emisLe: String(r.emisLe || '')
  };
}

// L'âge de la réponse en jours (négatif = datée dans le futur), ou null si la date est illisible.
function ageReponse(emisLe, maintenant) {
  const t = Date.parse(String(emisLe || ''));
  const n = maintenant ? Date.parse(String(maintenant)) : Date.now();
  if (isNaN(t) || isNaN(n)) return null;
  return (n - t) / 86400000;
}

// Renvoie `{ ok, raison, etat, motif, emisLe }`. Le résultat ne sert qu'à RESTREINDRE : une réponse
// qu'on ne peut pas vérifier est simplement ignorée, jamais transformée en refus. `ok: false` est
// donc le cas sûr, et c'est pour ça qu'il est le cas par défaut partout ici.
function verifierReponse(rep, reponsePublicKeyPem, opts) {
  const o = opts || {};
  const non = raison => ({ ok: false, raison, etat: '', motif: '', emisLe: '', sujet: '' });
  const r = rep && typeof rep === 'object' ? rep : null;
  if (!r) return non('réponse vide');
  if (!reponsePublicKeyPem) return non('aucune clé de réponse embarquée');
  if (Number(r.v) !== REPONSE_V) return non('version de réponse inconnue');
  if (!r.signature) return non('réponse non signée');
  const sujet = String(o.sujet || '');
  if (!sujet || String(r.sujet || '') !== sujet) return non('réponse destinée à une autre licence');
  const age = ageReponse(r.emisLe, o.maintenant);
  if (age === null) return non('date de réponse illisible');
  if (age > REPONSE_JOURS_MAX) return non('réponse trop ancienne');
  if (age < -REPONSE_JOURS_AVANCE) return non('réponse datée dans le futur');
  try {
    const json = Buffer.from(JSON.stringify(corpsReponse(r)), 'utf8');
    if (!crypto.verify(null, json, crypto.createPublicKey(reponsePublicKeyPem), unb64u(r.signature))) {
      return non('signature de réponse fausse');
    }
  } catch { return non('signature de réponse illisible'); }
  return { ok: true, raison: '', etat: String(r.etat || ''), motif: String(r.motif || ''), emisLe: String(r.emisLe || ''), sujet };
}

// L'état de la licence, tel que l'application le montre et l'applique.
//   libre     : aucune clé publique configurée — la licence n'est pas armée, tout est permis
//   essai     : les 30 premiers jours, complets
//   active    : licence valide
//   expiree   : licence dépassée → seule la création de nouvelles pièces attend
//   invalide  : clé illisible ou signature fausse
//   autre     : clé authentique, mais émise pour une autre entreprise (matricule différent)
//   revoquee  : la plateforme a dit, preuve à l'appui, que cette clé est révoquée (8.4.0)
//   finessai  : essai terminé sans licence
//   editeur   : la clé privée qui signe les licences est sur ce poste, et c'est bien celle de la clé
//               publique en vigueur (`opts.editeur`) — pas d'essai, pas de verrou ; une clé collée
//               reprend le dessus (elle est jugée AVANT), pour voir ce que voit un client
// `offre` et `reserves` : l'offre en cours et les modules dont la création lui est fermée. Pendant
// l'essai, tout est ouvert (c'est la seule façon de savoir de quelle offre on a besoin) ; une fois
// verrouillé, `reserves` ne sert plus — `locked` ferme déjà toute création.
// Les options portées par la clé (9.1.0). Elles voyagent DANS la charge signée, comme l'offre :
// personne ne peut en ajouter une à distance, et c'est ce qui rend la vérification hors ligne.
//
// En cas de DOUTE, on ouvre : une clé d'avant la 9.1.0 n'a pas de champ `options`, et refuser
// l'option à tous les clients déjà servis serait leur retirer quelque chose qu'ils n'ont pas
// demandé à perdre. C'est la même règle que pour une offre inconnue (7.33.0).
// Les options qui existent. Une seule pour l'instant : la comptabilité (grand livre, balance,
// états financiers), décidée payante le 15/09/2026 (`DIRECTION.md`).
const TOUTES_OPTIONS = ['compta'];
const OPTION_LABELS = { compta: 'Comptabilité' };

function optionsDe(payload) {
  const o = payload && payload.options;
  return Array.isArray(o) ? o.filter(x => typeof x === 'string' && x) : [];
}

function licenceState(opts) {
  opts = opts || {};
  const t = opts.today || today();
  // `cles` depuis la 8.4.0 ; `publicKey` continue de marcher, c'est ce que passent les appelants
  // d'avant — et c'est le fichier de la 8.0.0 chez tous ceux qui ne se sont pas encore mis à jour.
  const pub = opts.cles || opts.publicKey || '';
  const jours = n => `${n} jour${n === 1 ? '' : 's'}`;
  if (!lireCles(pub).length) {
    return { state: 'libre', locked: false, label: 'Licence non requise',
      detail: 'Cette version n\'exige pas de licence.', key: '', name: '', exp: '', daysLeft: null,
      offre: OFFRE_DEFAUT, offreLabel: '', reserves: [], options: TOUTES_OPTIONS.slice() };
  }
  // L'essai compte à partir du jour où la licence a été ARMÉE (la date du fichier de clé publique)
  // quand celui-ci est postérieur à l'installation : la date d'installation est enregistrée depuis
  // la 6.4.0, et sans ce garde-fou toute installation de plus de trente jours se verrouillerait à
  // la minute même de la mise à jour qui arme la licence.
  const installedAt = opts.installedAt || t;
  const armedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.armedAt || '')) ? opts.armedAt : '';
  const trialStart = armedAt && armedAt > installedAt ? armedAt : installedAt;
  const trialEnd = addDays(trialStart, TRIAL_DAYS);
  const payload = opts.key ? verifyKey(opts.key, pub) : null;

  // Une clé de CABINET n'ouvre pas l'application entreprise (9.4.0). Le garde-fou est ici et pas
  // seulement sur le type : une licence de cabinet n'a pas de matricule (son sujet est l'empreinte
  // du cabinet), et `memeMatricule` laisse passer un côté vide — « on ne punit pas qui n'a pas
  // rempli sa fiche » (7.33.0). Les deux règles, posées chacune pour une bonne raison, se
  // combinaient en un trou : une clé Cabinet déverrouillait TOUT chez n'importe quelle entreprise.
  if (payload && payload.type === 'cabinet') {
    return { state: 'autre', locked: true, label: 'Licence de SkanFact Cabinet',
      detail: 'Cette clé est celle d\'un cabinet comptable, pas d\'une entreprise : elle s\'installe dans SkanFact Cabinet. '
        + 'Pour cette application, demande une licence à ton nom.',
      key: opts.key, name: payload.nom || '', exp: String(payload.exp || ''), daysLeft: null,
      offre: OFFRE_DEFAUT, offreLabel: '', reserves: [], options: [] };
  }

  if (opts.key && !payload) {
    return { state: 'invalide', locked: true, label: 'Licence non reconnue',
      detail: 'Cette clé n\'est pas lisible ou n\'a pas été émise pour SkanFact. Vérifie qu\'elle a été collée en entier.',
      key: opts.key, name: '', exp: '', daysLeft: null, offre: OFFRE_DEFAUT, offreLabel: '', reserves: [], options: [] };
  }

  if (payload) {
    const offre = offreDe(payload);
    const commun = {
      key: opts.key, name: payload.nom || '', matricule: payload.matricule || '',
      cabinet: payload.cabinet || '', payload, offre, offreLabel: OFFRES[offre].label,
      options: optionsDe(payload)
    };
    if (!memeMatricule(payload.matricule, opts.matricule)) {
      return {
        ...commun, state: 'autre', locked: true, label: 'Licence d\'une autre entreprise',
        detail: `Cette clé a été émise pour ${payload.nom || 'une autre société'} (matricule ${payload.matricule}), `
          + `pas pour le matricule ${opts.matricule} de cette entreprise. Demande une licence à ton nom.`,
        exp: String(payload.exp || ''), daysLeft: null, reserves: [], options: []
      };
    }
    // La révocation reçue de la plateforme, si elle concerne bien CETTE clé. Elle est jugée avant
    // l'expiration : une licence révoquée ET expirée se dit « révoquée », parce que c'est la raison
    // qui compte pour celui qui la lit — même ordre que `etatLicence` côté serveur.
    // Elle ne mord qu'après avoir été reçue : quelqu'un qui reste hors ligne pour toujours n'est
    // jamais coupé, et c'est assumé (§ 8, règle 5).
    const srv = opts.serveur || null;
    if (srv && srv.etat === 'revoquee' && srv.sujet && srv.sujet === empreinteCle(opts.key)) {
      return {
        ...commun, state: 'revoquee', locked: true, label: 'Licence révoquée',
        detail: 'Cette clé a été révoquée par l\'éditeur'
          + (srv.motif ? ` (${srv.motif})` : '')
          + '. Tout reste lisible, imprimable et exportable ; seule la création de nouvelles pièces attend.'
          + ' Si c\'est une erreur, écris à ' + CONTACT + '.',
        exp: String(payload.exp || ''), daysLeft: null, reserves: [], options: [], revoqueeLe: srv.emisLe || ''
      };
    }
    const exp = String(payload.exp || '');
    const left = exp ? daysBetween(t, exp) : null;
    if (!exp || left >= 0) {
      return {
        ...commun, state: 'active', locked: false,
        label: (exp ? `Licence active jusqu'au ${exp}` : 'Licence sans limite de durée') + ` — offre ${OFFRES[offre].label}`,
        detail: left != null && left <= 30 ? `Elle se termine dans ${jours(left)} : pense à la renouveler.` : '',
        exp, daysLeft: left, reserves: OFFRES[offre].reserves.slice()
      };
    }
    return {
      ...commun, state: 'expiree', locked: true, label: `Licence expirée le ${exp}`,
      detail: 'Tout reste lisible, imprimable et exportable. Seule la création de nouvelles pièces attend le renouvellement.',
      exp, daysLeft: left, reserves: [], options: []
    };
  }

  // Le poste de l'éditeur, sans clé collée : celui qui signe n'achète pas. Jugé APRÈS une clé
  // collée (qui reprend le dessus) et AVANT l'essai (qui ne le concerne pas).
  if (opts.editeur) {
    return { state: 'editeur', locked: false, label: 'Poste de l\'éditeur — licence non requise',
      detail: 'La clé privée qui signe les licences est sur cet ordinateur : il n\'a pas besoin de licence. Pour voir exactement ce que voit un client, colle ci-dessous une clé émise pour le matricule de cette société (ou sans matricule) ; retire-la pour revenir ici.',
      key: '', name: '', exp: '', daysLeft: null, offre: OFFRE_DEFAUT, offreLabel: '', reserves: [], options: TOUTES_OPTIONS.slice() };
  }

  const left = daysBetween(t, trialEnd);
  if (left >= 0) {
    return { state: 'essai', locked: false, label: `Période d'essai — ${jours(left)} restant${left === 1 ? '' : 's'}`,
      detail: 'Tout est disponible pendant l\'essai. Demande ta licence avant la fin pour ne pas être interrompu.',
      key: '', name: '', exp: trialEnd, daysLeft: left, offre: OFFRE_DEFAUT, offreLabel: '', reserves: [], options: TOUTES_OPTIONS.slice() };
  }
  return { state: 'finessai', locked: true, label: 'Période d\'essai terminée',
    detail: 'L\'essai de 30 jours de cet ordinateur est terminé — il compte par ordinateur, et chaque entreprise a besoin de sa propre clé, attachée à son matricule. Tes données restent lisibles, imprimables et exportables ; seule la création de nouvelles pièces attend ta licence.',
    key: '', name: '', exp: trialEnd, daysLeft: left, offre: OFFRE_DEFAUT, offreLabel: '', reserves: [], options: [] };
}

// ================================================================ LA LICENCE DU CABINET (9.4.0)
//
// On vend des DOSSIERS, jamais des postes (`DIRECTION.md`) : un cabinet installe l'application sur
// autant d'ordinateurs qu'il veut. Ce qui se compte, ce sont ses dossiers **hors SkanFact** — ceux
// de ses clients qui n'utilisent pas l'application. Les trois premiers sont gratuits, et un cabinet
// dont tous les clients sont sur SkanFact ne paie jamais rien.
//
// Le sujet de la clé est l'EMPREINTE du cabinet, pas un matricule : c'est elle qui l'identifie de
// façon stable, elle survit à un changement d'ordinateur (6.8.1), et le cabinet la connaît déjà —
// c'est celle qu'il dicte à ses clients au téléphone.
const CABINET_GRATUITS = 3;

// Ce qui est AUTORISÉ, et ce qui est bloqué. La porte unique est sur la VALIDATION d'une écriture :
// lire, importer un paquet, exporter, relancer un client restent libres quoi qu'il arrive. Jamais de
// données en otage (règle 6.4.0) — et ici c'est encore plus vrai qu'ailleurs, puisque ce sont les
// pièces de SOIXANTE entreprises qui dorment dans cette application.
function licenceCabinet(opts) {
  opts = opts || {};
  const t = opts.today || today();
  const pub = opts.cles || opts.publicKey || '';
  const comptes = Math.max(0, Number(opts.comptes) || 0);
  const empreinte = String(opts.empreinte || '').trim().toUpperCase();
  // Deux empreintes se comparent sans leurs séparateurs ni leur casse : « 3f9a-2c1e-… » recopiée
  // d'un message, « 3F9A2C1E… » telle que la console la range, « 3F9A-2C1E-… » telle que le cabinet
  // la lit — c'est le même cabinet. Retirer seulement les SÉPARATEURS, jamais « tout ce qui n'est
  // pas hexadécimal » : un G tapé pour un 6 doit rester une faute visible (8.1.0).
  const nue = s => String(s || '').replace(/[\s.:_-]/g, '').toUpperCase();
  const base = { comptes, gratuits: CABINET_GRATUITS, quota: 0, autorises: CABINET_GRATUITS, key: opts.key || '', exp: '', daysLeft: null };
  const fin = (x) => {
    // « Sans limite » (10.8.0) est un ÉTAT, pas un très grand nombre. Une clé qui porterait un quota
    // de 99 999 fonctionnerait et afficherait « 100 002 dossiers autorisés » : un chiffre que
    // personne n'a décidé, sur l'écran qui doit rassurer. `autorisesInfini` existait déjà pour la
    // version non armée ; on le réemploie plutôt que d'inventer un second mot.
    if (x.autorisesInfini) return { ...base, ...x, autorises: null, locked: false, depasse: 0 };
    const autorises = CABINET_GRATUITS + Math.max(0, Number(x.quota) || 0);
    // UN seul endroit décide du verrou, et c'est un dépassement de quota. Une clé illisible ou
    // d'un autre cabinet n'accorde rien — mais elle ne punit rien non plus tant qu'on est dans les
    // trois dossiers gratuits : on ne verrouille pas quelqu'un qui ne devait rien.
    return { ...base, ...x, autorises, locked: comptes > autorises, depasse: Math.max(0, comptes - autorises) };
  };

  if (!lireCles(pub).length) {
    return fin({ state: 'libre', quota: 0, label: 'Licence non requise',
      detail: 'Cette version n\'exige pas de licence.', autorisesInfini: true, locked: false });
  }

  const payload = opts.key ? verifyKey(opts.key, pub) : null;

  if (opts.key && !payload) {
    return fin({ state: 'invalide', quota: 0, label: 'Licence non reconnue',
      detail: 'Cette clé n\'est pas lisible ou n\'a pas été émise pour SkanFact Cabinet. Vérifie qu\'elle a été collée en entier.' });
  }
  if (payload && payload.type !== 'cabinet') {
    return fin({ state: 'autre', quota: 0, label: 'Licence d\'une entreprise',
      detail: 'Cette clé est celle d\'une entreprise, pas d\'un cabinet : elle s\'installe dans SkanFact, pas ici.' });
  }
  if (payload && empreinte && nue(payload.cabinet) !== nue(empreinte)) {
    return fin({ state: 'autre', quota: 0, label: 'Licence d\'un autre cabinet',
      detail: `Cette clé a été émise pour l'empreinte ${payload.cabinet || '(inconnue)'}, pas pour ${empreinte}. `
        + 'Si tu viens de reprendre ton cabinet sur un autre ordinateur, vérifie que tu as bien repris ta clé de secours : '
        + 'un cabinet recréé à neuf a une autre empreinte.' });
  }

  if (payload) {
    const quota = Math.max(0, Number(payload.dossiersHors) || 0);
    const exp = String(payload.exp || '');
    const left = exp ? daysBetween(t, exp) : null;
    const srv = opts.serveur || null;
    if (srv && srv.etat === 'revoquee' && srv.sujet && srv.sujet === empreinteCle(opts.key)) {
      return fin({ state: 'revoquee', quota: 0, exp, daysLeft: null, label: 'Licence révoquée',
        detail: 'Cette clé a été révoquée par l\'éditeur' + (srv.motif ? ` (${srv.motif})` : '')
          + '. Tout reste lisible, importable et exportable ; seule la validation d\'une écriture attend.'
          + ' Si c\'est une erreur, écris à ' + CONTACT + '.' });
    }
    if (!exp || left >= 0) {
      // `illimite` (10.8.0) est en QUEUE de la charge signée, comme `type` et `dossiersHors` avant
      // lui : au milieu, il changerait l'ordre des champs déjà signés, et une clé refabriquée
      // depuis sa charge rangée en base ne serait plus identique à celle qu'on a envoyée. Une clé
      // qui ne le porte pas vaut `false` : rien de ce qui a été vendu ne bouge.
      const illimite = payload.illimite === true;
      return fin({ state: 'active', quota, exp, daysLeft: left, autorisesInfini: illimite,
        label: (exp ? `Licence active jusqu'au ${exp}` : 'Licence sans limite de durée')
          + (illimite
            ? ' — dossiers hors SkanFact sans limite'
            : ` — ${quota} dossier${quota === 1 ? '' : 's'} hors SkanFact en plus des ${CABINET_GRATUITS} gratuits`),
        detail: left != null && left <= 30 ? `Elle se termine dans ${left} jour${left === 1 ? '' : 's'} : pense à la renouveler.` : '' });
    }
    return fin({ state: 'expiree', quota: 0, exp, daysLeft: left, label: `Licence expirée le ${exp}`,
      detail: 'Tout reste lisible, importable et exportable. Seule la validation d\'une écriture attend le renouvellement.' });
  }

  // Sans clé : les trois dossiers gratuits. Ce n'est pas un essai qui se termine — c'est l'offre.
  // Un cabinet dont tous les clients sont sur SkanFact reste ici pour toujours, sans rien payer.
  return fin({ state: 'gratuit', quota: 0,
    label: comptes > CABINET_GRATUITS
      ? `${comptes} dossiers hors SkanFact comptés — ${CABINET_GRATUITS} sont gratuits`
      : `Gratuit — ${comptes} dossier${comptes === 1 ? '' : 's'} hors SkanFact sur ${CABINET_GRATUITS}`,
    detail: comptes > CABINET_GRATUITS
      ? 'Au-delà de trois dossiers hors SkanFact, la validation d\'une écriture demande une licence. Tout le reste — lire, importer, exporter, relancer — reste ouvert.'
      : 'Les dossiers de tes clients qui utilisent SkanFact ne comptent pas, quel que soit leur nombre.' });
}

// Le bandeau, à trois tons. **Corps IDENTIQUE à `pastilleLicence` de core.js** — un test l'exige,
// comme pour `round3` (9.1.0). Les deux applications doivent dire la même chose de la même échéance,
// et aucune des deux ne peut charger le module de l'autre : core.js est un UMD de navigateur, ce
// fichier a besoin de `crypto`. Le seul garde-fou possible est donc l'égalité, vérifiée.
function pastille(lic) {
  const l = lic || {};
  const j = l.daysLeft;
  if (l.locked) return { show: true, ton: 'alerte', texte: (l.label || 'Licence requise') + ' — voir Paramètres → L\'application → Licence' };
  if (l.state === 'essai' && j != null) {
    const reste = `Essai — ${j} jour${j === 1 ? '' : 's'}`;
    return j <= 7
      ? { show: true, ton: 'attire', texte: reste + (j === 0 ? ' : dernier jour' : ' avant la fin') }
      : { show: true, ton: 'calme', texte: reste };
  }
  // Une licence payante qui se termine se dit ici aussi : sans ça, un client verrouillé un matin
  // n'aurait été prévenu nulle part ailleurs que dans un panneau qu'il n'ouvre jamais.
  if (l.state === 'active' && j != null && j <= 14) {
    return { show: true, ton: 'attire', texte: (l.label || '') + ' — pense à la renouveler' };
  }
  return { show: false, ton: '', texte: '' };
}

// Le mail de demande de licence d'un CABINET. Ce qui part : l'empreinte, le nombre de dossiers
// comptés, la version — jamais un nom de client. Un cabinet ne donne pas son portefeuille pour
// acheter une licence, et cette règle est tenue par un test (§ 17 de PLAN-PLATEFORME).
function requestMailCabinet(cabinet, etat, version) {
  const c = cabinet || {};
  return {
    subject: `Demande de licence SkanFact Cabinet — ${c.name || ''}`,
    body: `Bonjour,\n\nJe souhaite une licence SkanFact Cabinet.\n\n`
      + `Cabinet : ${c.name || ''}\n`
      + `Email : ${c.email || ''}\n`
      + `Empreinte : ${c.fingerprint || ''}\n`
      + `Dossiers hors SkanFact comptés : ${(etat && etat.comptes) || 0}\n`
      + `Version : ${version || ''}\n`
      + `État actuel : ${etat ? etat.label : ''}\n\n`
      + `Merci,\n${c.name || ''}`
  };
}

// Un identifiant court pour retrouver une licence dans l'historique de l'éditeur : il voyage dans la
// clé, donc un client qui écrit « ma licence 3f9a2c1e » désigne une ligne précise.
function licenceId() { return crypto.randomBytes(4).toString('hex'); }

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

module.exports = { FORMAT, TRIAL_DAYS, PREFIX, CONTACT, OFFRES, OFFRE_DEFAUT, DUREES, TOUTES_OPTIONS, OPTION_LABELS, optionsDe, generateKeys, signLicence, parseKey, verifyKey,
  licenceState, licenceId, offreDe, expirationPour, dateValide, memeMatricule, normMatricule, requestMail, today, addDays, addMonths, daysBetween,
  CABINET_GRATUITS, licenceCabinet, pastille, requestMailCabinet,
  lireCles, choisirCle, empreinteCle, corpsReponse, verifierReponse, ageReponse, REPONSE_V, REPONSE_JOURS_MAX };
