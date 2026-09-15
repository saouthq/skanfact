// SkanFact — le plan de contrôle (P 0.1 : voir, P 0.2 : vendre).
//
// Ce que ce worker fait : une application cliente lui présente sa clé de licence et son ordinateur,
// il enregistre l'activation et répond ce qu'il sait de cette licence — active, révoquée, expirée.
// Une application en ESSAI n'a pas de clé : elle s'annonce quand même (sinon aucun essai ne serait
// visible, et « combien d'essais convertissent » est justement la question qui compte). Et il sert
// la console de l'éditeur sur « / » : un seul déploiement, aucun domaine croisé à régler.
//
// Depuis P 0.2, la console VEND : elle crée un client, émet une licence signée par la clé du
// serveur (`srv-1`), la révoque, la renouvelle, change son offre, marque la vente payée et envoie
// la clé par mail. Une vente complète sans ouvrir SkanFact — c'est le § 12 de PLAN-PLATEFORME.md :
// « un clic, pas zéro ».
//
// Les trois règles qui gouvernent chaque ligne de ce fichier (PLAN-PLATEFORME.md § 8) :
//
//   1. **On laisse toujours passer en cas de panne.** Base injoignable, table absente, requête qui
//      échoue : on répond « active » si la signature est bonne. Un serveur en panne ne doit jamais
//      pouvoir verrouiller la facturation de quelqu'un. C'est la règle 6.7.2 appliquée ici.
//   2. **La clé signée est la source de vérité.** Ce worker ne peut qu'AJOUTER une restriction
//      connue — la révocation. Il n'accorde jamais un droit que la clé ne porte pas, et une licence
//      parfaitement valide qu'il ne connaît pas est ACTIVE : toutes celles émises depuis la 8.0.0
//      sont dans ce cas, et le contraire les couperait toutes le jour de la mise en service.
//   3. **La réponse est signée et liée à sa licence.** Sans signature, quelqu'un placé entre les
//      deux répondrait « révoquée » et bloquerait un client honnête. Sans lien avec la licence, on
//      rejouerait la réponse « révoquée » du client A chez le client B.
//
// Et une quatrième, propre à la vente : **la clé privée MAÎTRE ne vient jamais ici.** Ce worker ne
// signe qu'avec `srv-1`, une clé de second rang que l'application accepte parce que sa moitié
// publique est embarquée avec un `kid`. Si ce serveur est compromis un jour, on retire `srv-1` de
// la version suivante et on continue avec la maître — sans invalider une seule licence vendue par
// elle (§ 4).
//
// Les décisions sont pures et exportées : elles se testent dans `npm test`, sans réseau et sans
// base, exactement comme celles du relais de mise à jour (worker/skanfact-maj.mjs). Les handlers,
// eux, se testent contre une vraie base SQLite (test/d1-sqlite.js) et dans un vrai navigateur
// (npm run e2e:console).
//
// Déploiement : voir plateforme/README.md.

// ---------- les chemins que ce worker connaît ----------
// Tout le reste est refusé avant de regarder qui demande. Versionné dès le premier jour : une
// application installée chez un client ne se met pas à jour sur commande, et le jour où la forme
// d'une réponse doit changer, /v2/ naîtra à côté pendant que /v1/ continuera de répondre.
const ACTIONS = {
  licence: ['etat'],
  admin: ['etat', 'stats', 'clients', 'licences', 'activations', 'ventes', 'evenements', 'importer']
};
const SOUS_ACTIONS = ['revoquer', 'renouveler', 'changer-offre', 'envoyer', 'payee', 'facturee'];
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

// « /v1/licence/etat » → { v: 1, espace: 'licence', action: 'etat' }
// « /v1/admin/licences/lic_42/revoquer » → { …, action: 'licences', id: 'lic_42', sous: 'revoquer' }
export function routeApi(pathname) {
  const p = String(pathname || '').split('/').filter(Boolean);
  if (p.length < 3 || p.length > 5) return null;
  if (!/^v(\d{1,2})$/.test(p[0])) return null;
  const v = Number(p[0].slice(1));
  const espace = p[1];
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, espace)) return null;
  const action = p[2];
  if (!ACTIONS[espace].includes(action)) return null;
  if (p.length === 3) return { v, espace, action, id: null, sous: null };
  const id = p[3];
  if (!SEGMENT.test(id)) return null;
  if (p.length === 4) return { v, espace, action, id, sous: null };
  const sous = p[4];
  if (!SOUS_ACTIONS.includes(sous)) return null;
  return { v, espace, action, id, sous };
}

// ---------- outils ----------
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const pemVersDer = pem => unb64u(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_'));

// Une installation en essai n'a pas de clé : son empreinte est cette sentinelle. Le couple
// (empreinte, ordinateur) reste unique, donc un essai ne compte qu'une fois par machine.
export const ESSAI = 'ESSAI';

// L'empreinte d'une clé de licence : ce qu'on range dans la base et ce qui lie une réponse à SA
// licence. On ne stocke jamais la clé entière — elle ne sert à rien ici, et une base lue par un
// tiers ne doit donner accès à rien.
export async function empreinteCle(cle) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(String(cle || '').trim()));
  return hex(h).slice(0, 32);
}

// « 1 licence », « 3 licences » — jamais « 1 licence(s) ». La règle vient de l'app du cabinet
// (1.0.0) : un logiciel qui écrit « 1 dossier(s) » paraît bâclé, et c'est le premier écran que
// l'éditeur regarde tous les matins.
export function pl(n, mot, pluriel) {
  const x = Number(n) || 0;
  return x + ' ' + (Math.abs(x) >= 2 ? (pluriel || (mot + 's')) : mot);
}

// « vu aujourd'hui », « vu hier », « vu il y a 5 jours ». Un horodatage brut dans un tableau ne se
// lit pas : ce qu'on veut savoir, c'est si cette installation vit encore.
export function depuisQuand(iso, maintenant) {
  const a = Date.parse(String(iso || '')), b = Date.parse(String(maintenant || ''));
  if (isNaN(a) || isNaN(b)) return '';
  const j = Math.floor((b - a) / 86400000);
  if (j <= 0) return 'aujourd\'hui';
  if (j === 1) return 'hier';
  if (j < 31) return 'il y a ' + pl(j, 'jour');
  const m = Math.floor(j / 30);
  if (m < 12) return 'il y a ' + pl(m, 'mois', 'mois');
  return 'il y a ' + pl(Math.floor(j / 365), 'an');
}

// ---------- choisir la clé publique qui doit vérifier ----------
// LA règle de compatibilité la plus dangereuse du chantier. Toutes les licences émises depuis la
// 8.0.0 ont été signées par la clé maître et ne portent AUCUN `kid` : sans la première ligne, la
// mise en service les invaliderait toutes d'un coup, et chaque client payant se retrouverait avec
// « clé non reconnue » le même matin.
//
// Une clé RETIRÉE (compromise, remplacée) ne vérifie plus rien : c'est ainsi qu'on sort une clé du
// jeu après une fuite, une fois les licences concernées réémises.
export function choisirCle(kid, cles) {
  const liste = Array.isArray(cles) ? cles.filter(c => c && c.publicKey && !c.retiree) : [];
  const k = String(kid || '').trim();
  if (!k) return liste.find(c => c.kid === 'master') || null;
  return liste.find(c => c.kid === k) || null;
}

// Découpe une clé sans rien vérifier. Renvoie null si elle n'a pas la bonne forme.
export function decoupeLicence(cle) {
  const s = String(cle || '').trim();
  if (!s.startsWith('SKAN1.')) return null;
  const p = s.slice(6).split('.');
  if (p.length !== 2) return null;
  try {
    const corps = unb64u(p[0]);
    return { corps, signature: unb64u(p[1]), contenu: JSON.parse(new TextDecoder().decode(corps)) };
  } catch { return null; }
}

// Vérifie la signature contre la clé que `choisirCle` désigne. Une licence expirée reste VALIDE
// ici : c'est `etatLicence` qui juge la date. Séparer les deux évite qu'une horloge fausse côté
// serveur fasse passer une vraie licence pour une fausse.
export async function verifierLicence(cle, cles) {
  const l = decoupeLicence(cle);
  if (!l) return { ok: false, raison: 'clé illisible' };
  const pub = choisirCle(l.contenu && l.contenu.kid, cles);
  if (!pub) return { ok: false, raison: 'aucune clé publique ne correspond' };
  try {
    const k = await crypto.subtle.importKey('spki', pemVersDer(pub.publicKey), { name: 'Ed25519' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'Ed25519' }, k, l.signature, l.corps);
    return ok ? { ok: true, contenu: l.contenu, kid: pub.kid } : { ok: false, raison: 'signature fausse' };
  } catch (e) { return { ok: false, raison: 'vérification impossible : ' + (e && e.message) }; }
}

// ---------- l'état d'une licence ----------
// Pure, et c'est le cœur du système. `ligne` est ce que la base sait (ou null si elle ne sait
// rien). L'ordre des tests n'est pas indifférent : une licence révoquée ET expirée se dit
// « révoquée », parce que c'est la raison qui compte pour l'utilisateur.
export function etatLicence(opts) {
  const o = opts || {};
  if (!o.contenu) return 'inconnue';
  if (o.ligne && o.ligne.revoquee_le) return 'revoquee';
  const exp = String(o.contenu.exp || '');
  // Une licence à vie n'a pas d'`exp` du tout.
  if (exp && o.aujourdhui && exp < String(o.aujourdhui)) return 'expiree';
  // Signature bonne, rien contre elle : active — même si la base ne la connaît pas. C'est le cas
  // de toutes les clés émises avant la plateforme.
  return 'active';
}

// ---------- ce qui arrive de l'extérieur ----------
// Validé AVANT de toucher au disque (règle 6.8.1). Aucun champ cosmétique ne peut faire échouer
// l'appel : un nom d'ordinateur bizarre ne doit pas empêcher quelqu'un d'apprendre que sa licence
// est active. Ce qui ne passe pas est mis à null, pas refusé.
const PLATEFORMES = ['darwin', 'win32', 'linux'];
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}(-[A-Za-z0-9.]{1,20})?$/;
const DEVICE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/;

const texteNet = (v, max) => {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

export function nettoyerActivation(corps) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const deviceId = String(c.deviceId || '').trim();
  return {
    deviceId: DEVICE.test(deviceId) ? deviceId : null,
    deviceNom: texteNet(c.deviceNom, 80),
    plateforme: PLATEFORMES.includes(String(c.plateforme || '')) ? String(c.plateforme) : null,
    version: VERSION.test(String(c.version || '').trim()) ? String(c.version).trim() : null
  };
}

// ---------- la réponse ----------
// `sujet` est l'empreinte de la licence à qui l'on répond : sans lui, la réponse « révoquée »
// destinée au client A se rejouerait chez le client B. `emisLe` est la date : sans elle, une
// vieille réponse « active » se rejouerait pour annuler une révocation.
export function corpsReponse(opts) {
  const o = opts || {};
  const c = o.contenu || {};
  return {
    v: 1,
    sujet: o.sujet || '',
    etat: o.etat || 'inconnue',
    offre: c.offre || null,
    exp: c.exp || null,
    postes: Number.isFinite(c.postes) ? c.postes : null,
    motif: o.motif || null,
    emisLe: o.emisLe || ''
  };
}

export async function signerReponse(corps, priveePem) {
  const json2 = enc.encode(JSON.stringify(corps));
  const k = await crypto.subtle.importKey('pkcs8', pemVersDer(priveePem), { name: 'Ed25519' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, k, json2);
  return { corps, signature: b64u(sig) };
}

// ---------- accès ----------
export function memeSecret(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (!x || !y || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// La console. Un seul secret, long et tiré au hasard, posé dans les réglages du worker — il n'y a
// qu'un administrateur, et une table d'utilisateurs pour une personne serait du décor.
//
// Un secret trop court est refusé À LA CONFIGURATION, pas à l'usage : mieux vaut un écran qui dit
// « mal réglé » qu'une console qu'on croit fermée et qui s'ouvre en devinant « skanfact ».
export const ADMIN_MIN = 24;
export function autoriseAdmin(headers, env) {
  const attendu = String((env && env.ADMIN_SECRET) || '').trim();
  if (!attendu) return { ok: false, code: 503, message: 'Console non configurée : ADMIN_SECRET manque.' };
  if (attendu.length < ADMIN_MIN) {
    return { ok: false, code: 503, message: 'Console mal configurée : ADMIN_SECRET fait moins de ' + ADMIN_MIN + ' caractères.' };
  }
  const donne = (headers && headers.get('x-skanfact-admin')) || '';
  if (!memeSecret(donne, attendu)) return { ok: false, code: 403, message: 'Accès refusé.' };
  return { ok: true };
}

// Les clés publiques en vigueur, lues depuis les réglages du worker. Mal réglé, on ne PEUT pas
// juger : on le dit (503) au lieu de refuser (403). Refuser couperait chaque client qui a payé,
// et c'est exactement ce qui est arrivé au relais en 8.0.0 — la leçon est déjà écrite.
export function lireCles(env) {
  const brut = String((env && env.LICENCE_PUBLIC_KEYS) || '').trim();
  if (!brut) return [];
  try {
    const j = JSON.parse(brut);
    const liste = Array.isArray(j) ? j : (j && Array.isArray(j.cles) ? j.cles : []);
    return liste.filter(c => c && c.kid && c.publicKey);
  } catch { return []; }
}

// ---------- ce que la console affiche ----------
// Pur, donc testable : c'est ce qui décide des chiffres que l'éditeur lira tous les matins, et un
// compteur qui ment est le pire défaut d'un tableau de bord (6.8.1).
//
// `essaisVus` ne compte que les installations vues RÉCEMMENT : un essai abandonné il y a six mois
// n'est pas un essai en cours, et le compter ferait croire à un vivier qui n'existe pas.
export function resumeStats(r) {
  const n = x => Number(x) || 0;
  const d = r || {};
  return {
    clients: n(d.clients),
    licencesActives: n(d.licencesActives),
    licencesExpirees: n(d.licencesExpirees),
    licencesRevoquees: n(d.licencesRevoquees),
    essaisEnCours: n(d.essaisEnCours),
    postes: n(d.postes),
    // Ce qu'on ne peut PAS savoir se dit, au lieu d'être inventé : un essai qui n'a jamais eu de
    // réseau n'est nulle part, et le taux de conversion n'a de sens que là-dessus.
    incertain: n(d.essaisEnCours) === 0 && n(d.postes) === 0
  };
}

// ======================================================================================
// P 0.2 — vendre depuis la console
// ======================================================================================

// ---------- les offres et les durées : les MÊMES que dans l'application ----------
// Ce que la page Tarifs du site promet. Les identifiants sont ceux de src/licence.js (`OFFRES`,
// `DUREES`) : une clé porte `offre: 'independant'`, et c'est l'application qui sait ce que ça ferme.
// Ici on ne décide de rien — on écrit dans la clé ce que l'éditeur a choisi.
export const OFFRES = {
  independant: { label: 'Indépendant' },
  entreprise: { label: 'Entreprise' }
};
export const DUREES = [
  { id: '1m', label: '1 mois', mois: 1 },
  { id: '3m', label: '3 mois', mois: 3 },
  { id: '6m', label: '6 mois', mois: 6 },
  { id: '1a', label: '1 an', mois: 12 },
  { id: '2a', label: '2 ans', mois: 24 },
  { id: 'vie', label: 'À vie', mois: null },
  { id: 'date', label: 'Jusqu\'à une date précise', mois: null }
];
// Les prix proposés par défaut dans le formulaire, MODIFIABLES à chaque émission et remplaçables
// par les variables `PRIX_INDEPENDANT` / `PRIX_ENTREPRISE` / `REMISE_PARRAINAGE` du worker. Ce sont
// ceux de la page Tarifs de skanfact.tn au 15/09/2026, HT, en dinars ; ils ne servent qu'à
// préremplir un champ — aucun montant n'est jamais calculé à partir d'eux sans passer par l'écran.
export function tarifs(env) {
  const n = (v, d) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : d; };
  return {
    independant: n(env && env.PRIX_INDEPENDANT, 390),
    entreprise: n(env && env.PRIX_ENTREPRISE, 690),
    remiseParrainage: n(env && env.REMISE_PARRAINAGE, 20),
    devise: String((env && env.DEVISE) || 'TND').slice(0, 3).toUpperCase()
  };
}

// ---------- dates : mêmes règles que src/licence.js (et CLAUDE.md, 5.2.3) ----------
// Un jour du calendrier, jamais un instant ; toute arithmétique en UTC pur. Un mois de licence est
// un mois du calendrier : « un an » à partir du 14 septembre finit le 14 septembre suivant, et le
// 31 janvier + 1 mois donne le 28 février. Un test confronte ces fonctions à celles de
// src/licence.js sur une série de dates : deux copies qui divergent, c'est une licence qui ne finit
// pas le jour que la facture annonce.
const isoJour = d => d.toISOString().slice(0, 10);
export function addMonths(iso, months) {
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d)) return '';
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + (Number(months) || 0));
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return isoJour(d);
}
export const dateValide = iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) && isoJour(new Date(iso + 'T00:00:00Z')) === iso;
export function joursEntre(a, b) {
  const x = Date.parse(a + 'T00:00:00Z'), y = Date.parse(b + 'T00:00:00Z');
  if (isNaN(x) || isNaN(y)) return 0;
  return Math.round((y - x) / 86400000);
}
// La date de fin pour cette durée à partir de `depuis` ('' = à vie, null = refusé). Une date libre
// doit être dans le futur : une licence née expirée n'est pas une licence.
export function expirationPour(depuis, dureeId, dateLibre) {
  if (dureeId === 'vie') return '';
  if (dureeId === 'date') {
    const d = String(dateLibre || '').trim();
    return dateValide(d) && joursEntre(depuis, d) > 0 ? d : null;
  }
  const du = DUREES.find(x => x.id === dureeId);
  return du && du.mois ? addMonths(depuis, du.mois) : null;
}

// Le prorata d'un changement d'offre : la date de fin ne bouge pas, on facture la différence sur
// les jours restants. Même règle que `core.prorataOffre` dans l'application. Une licence à vie n'a
// pas de fin sur laquelle répartir : `jours` et `total` valent null pour que l'écran le DISE au
// lieu d'afficher un ratio inventé — et une « montée » vers moins cher ne rend jamais d'argent.
export function prorataOffre(opts) {
  const o = opts || {};
  const r3 = x => Math.round(x * 1000) / 1000;
  const diff = Math.max(0, (Number(o.prixNouveau) || 0) - (Number(o.prixAncien) || 0));
  if (!o.fin) return { jours: null, total: null, part: 1, montant: r3(diff) };
  const aujourdhui = o.aujourdhui || isoJour(new Date());
  const total = Math.max(1, joursEntre(o.debut || aujourdhui, o.fin));
  const jours = Math.max(0, joursEntre(aujourdhui, o.fin));
  const part = Math.min(1, jours / total);
  return { jours, total, part, montant: r3(diff * part) };
}

// ---------- ce qui arrive de la console ----------
// Validé avant de toucher au disque, et chaque refus porte une phrase que l'éditeur comprend.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CABINET = /^[0-9a-f]{20}$/;

export function idCourt() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return hex(b);
}

export function nettoyerClient(corps) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const nom = texteNet(c.nom, 120);
  if (!nom || nom.length < 2) return { ok: false, erreur: 'Le nom du client est obligatoire (deux caractères au moins).' };
  const email = texteNet(c.email, 200);
  if (email && !EMAIL.test(email)) return { ok: false, erreur: 'L\'adresse e-mail n\'a pas la forme attendue : ' + email };
  return {
    ok: true,
    client: {
      nom,
      matricule: (texteNet(c.matricule, 30) || '').toUpperCase() || null,
      email: email ? email.toLowerCase() : null,
      tel: texteNet(c.tel, 40),
      adresse: texteNet(c.adresse, 300),
      notes: texteNet(c.notes, 2000)
    }
  };
}

// Une émission (ou un renouvellement, ou un changement d'offre : ce sont les mêmes champs, moins
// ceux que la licence remplacée impose). `depuis` : le jour d'où part la durée.
export function nettoyerEmission(corps, depuis) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const offre = OFFRES[c.offre] ? String(c.offre) : '';
  if (!offre) return { ok: false, erreur: 'Choisis une offre : Indépendant ou Entreprise.' };
  const exp = expirationPour(depuis, String(c.duree || ''), c.dateLibre);
  if (exp === null) return { ok: false, erreur: 'La durée est inconnue, ou la date de fin n\'est pas dans le futur.' };
  const prix = Number(c.prix);
  if (!Number.isFinite(prix) || prix < 0) return { ok: false, erreur: 'Le prix HT doit être un nombre positif ou nul.' };
  const remise = c.remise == null || c.remise === '' ? 0 : Number(c.remise);
  if (!Number.isFinite(remise) || remise < 0 || remise > 100) return { ok: false, erreur: 'La remise est un pourcentage entre 0 et 100.' };
  const cabinet = String(c.cabinet || '').toLowerCase().replace(/[\s:.-]/g, '');
  if (cabinet && !CABINET.test(cabinet)) return { ok: false, erreur: 'L\'empreinte du cabinet fait vingt caractères hexadécimaux (cinq groupes de quatre).' };
  const payeeLe = c.payeeLe ? String(c.payeeLe).trim() : '';
  if (payeeLe && !dateValide(payeeLe)) return { ok: false, erreur: 'La date de paiement n\'est pas une date (AAAA-MM-JJ).' };
  const devise = String(c.devise || 'TND').trim().toUpperCase().slice(0, 3) || 'TND';
  return {
    ok: true,
    e: {
      offre, exp, prix: Math.round(prix * 1000) / 1000, remise, devise, cabinet,
      montant: Math.round(prix * (1 - remise / 100) * 1000) / 1000,
      payeeLe, moyen: texteNet(c.moyen, 40)
    }
  };
}

// Une licence de l'historique de SkanFact, telle que l'application l'envoie au premier branchement.
// Ce qui ne passe pas est REFUSÉ avec sa raison (pas mis à null) : ici on importe des ventes, et
// une vente à moitié importée serait pire qu'une vente absente.
export function nettoyerImport(l) {
  const c = l && typeof l === 'object' ? l : {};
  const id = String(c.id || '').trim();
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) return { ok: false, erreur: 'identifiant manquant ou douteux' };
  const cle = String(c.cle || '').trim();
  if (!cle.startsWith('SKAN1.')) return { ok: false, erreur: 'clé absente' };
  const offre = OFFRES[c.offre] ? String(c.offre) : 'entreprise';
  const emisLe = dateValide(c.emisLe) ? c.emisLe : null;
  if (!emisLe) return { ok: false, erreur: 'date d\'émission illisible' };
  const exp = c.exp ? String(c.exp) : '';
  if (exp && !dateValide(exp)) return { ok: false, erreur: 'date de fin illisible' };
  const prix = Number(c.prix); const remise = Number(c.remise) || 0;
  const facture = c.facture && typeof c.facture === 'object' && (c.facture.numero || Number.isFinite(Number(c.facture.montant)))
    ? { numero: texteNet(c.facture.numero, 40), montant: Number(c.facture.montant) || 0, payeeLe: dateValide(c.facture.payeeLe) ? c.facture.payeeLe : '' }
    : null;
  const cabinet = String(c.cabinet || '').toLowerCase().replace(/[\s:.-]/g, '');
  return {
    ok: true,
    l: {
      id, cle, offre, emisLe, exp,
      nom: texteNet(c.nom, 120) || '', matricule: (texteNet(c.matricule, 30) || '').toUpperCase() || '', email: texteNet(c.email, 200),
      prix: Number.isFinite(prix) && prix >= 0 ? prix : null, devise: String(c.devise || 'TND').toUpperCase().slice(0, 3) || 'TND',
      remise: remise >= 0 && remise <= 100 ? remise : 0, cabinet: CABINET.test(cabinet) ? cabinet : '',
      motif: ['renouvellement', 'offre', 'matricule'].includes(c.motif) ? c.motif : '',
      revoqueeLe: dateValide(c.revoqueeLe) ? c.revoqueeLe : '', revoqueeMotif: texteNet(c.revoqueeMotif, 200) || '',
      envoyeeLe: dateValide(c.envoyeeLe) ? c.envoyeeLe : '', facture
    }
  };
}

// ---------- la clé : ce que le serveur signe ----------
// Le contenu d'une licence, dans l'ORDRE où l'application le lit (src/licence.js, `signLicence` et
// `licence:emettre` dans main.js). `format: 2` porte les champs de PLAN-PLATEFORME.md § 5 : `kid`
// (quelle clé a signé — sans lui, l'application vérifierait avec la maître et refuserait), `sub`
// (le client, stable, qui survit à un changement de matricule). L'application ignore ce qu'elle ne
// connaît pas : en cas de doute, elle ouvre (règle de tolérance de la 7.33.0).
export function chargeLicence(o) {
  const x = o || {};
  return {
    format: 2,
    kid: String(x.kid || ''),
    id: String(x.id || ''),
    sub: String(x.sub || ''),
    nom: String(x.nom || ''),
    matricule: String(x.matricule || ''),
    offre: String(x.offre || ''),
    exp: String(x.exp || ''),
    cabinet: String(x.cabinet || ''),
    note: '',
    emisLe: String(x.emisLe || '')
  };
}

// Signe un contenu (l'objet, ou le JSON exact rangé en base) : « SKAN1.<contenu>.<signature> »,
// la forme que `parseKey` découpe côté application. Ed25519 est DÉTERMINISTE : le même JSON signé
// par la même clé redonne la même chaîne, à l'octet près. C'est ce qui permet de ne jamais ranger
// la clé en base — seulement son contenu — et de la refabriquer le jour où il faut la renvoyer.
export async function signerLicence(charge, priveePem) {
  const jsonTexte = typeof charge === 'string' ? charge : JSON.stringify(charge);
  const corps = enc.encode(jsonTexte);
  const k = await crypto.subtle.importKey('pkcs8', pemVersDer(priveePem), { name: 'Ed25519' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, k, corps);
  return 'SKAN1.' + b64u(corps) + '.' + b64u(sig);
}

// La clé du serveur : sa privée (réglage `SRV_PRIVATE_KEY`) et sa publique, qui doit figurer dans
// `LICENCE_PUBLIC_KEYS` sous son `kid` (réglage `SRV_KID`, `srv-1` par défaut). On VÉRIFIE que les
// deux moitiés vont ensemble en signant un octet et en le vérifiant : une privée collée à côté d'une
// publique qui n'est pas la sienne produirait des clés que l'application refuse — et rien, nulle
// part, ne le dirait avant le premier client. Le verdict est gardé en mémoire par isolat.
const cacheCleServeur = new Map();
export async function cleServeur(env) {
  const e = env || {};
  const kid = String(e.SRV_KID || 'srv-1').trim();
  const privee = String(e.SRV_PRIVATE_KEY || '').trim();
  if (!privee) return { ok: false, kid, raison: 'SRV_PRIVATE_KEY manque : la console ne peut pas signer.' };
  const pub = lireCles(e).find(c => c.kid === kid && !c.retiree) || null;
  if (!pub) return { ok: false, kid, raison: 'la clé publique « ' + kid + ' » manque dans LICENCE_PUBLIC_KEYS (ou elle est retirée).' };
  // La clé du cache porte la privée ENTIÈRE, pas sa longueur : toutes les clés Ed25519 en PEM
  // font la même longueur, et un verdict « ne correspond pas » rendu pour une privée aurait été
  // resservi à la bonne (attrapé par le test qui essaie les deux à la suite).
  const cle = kid + '|' + privee + '|' + pub.publicKey;
  if (cacheCleServeur.has(cle)) return cacheCleServeur.get(cle);
  let verdict;
  try {
    const kp = await crypto.subtle.importKey('pkcs8', pemVersDer(privee), { name: 'Ed25519' }, false, ['sign']);
    const kv = await crypto.subtle.importKey('spki', pemVersDer(pub.publicKey), { name: 'Ed25519' }, false, ['verify']);
    const sonde = enc.encode('skanfact');
    const ok = await crypto.subtle.verify({ name: 'Ed25519' }, kv, await crypto.subtle.sign({ name: 'Ed25519' }, kp, sonde), sonde);
    verdict = ok ? { ok: true, kid, privee, publicKey: pub.publicKey }
      : { ok: false, kid, raison: 'SRV_PRIVATE_KEY ne correspond pas à la clé publique « ' + kid + '» de LICENCE_PUBLIC_KEYS : les clés émises seraient refusées partout.' };
  } catch (err) {
    verdict = { ok: false, kid, raison: 'SRV_PRIVATE_KEY est illisible : ' + (err && err.message) };
  }
  cacheCleServeur.set(cle, verdict);
  return verdict;
}

// ---------- le mail qui porte la clé ----------
// Le même texte que le gabarit `licence` de l'application (core.DEFAULT_EMAIL_TEMPLATES) : un client
// qui reçoit sa clé depuis la console ou depuis SkanFact lit les mêmes phrases. Un test compare
// la phrase d'activation aux deux endroits.
const fmtJour = iso => (dateValide(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
export function mailLicence(o) {
  const x = o || {};
  const offre = (OFFRES[x.offre] || {}).label || 'Entreprise';
  const fin = x.exp ? ', valable jusqu\'au ' + fmtJour(x.exp) : ', sans limite de durée';
  return {
    sujet: 'Votre licence SkanFact — ' + offre,
    texte: 'Bonjour,\n\n'
      + 'Voici votre clé de licence SkanFact (' + offre + fin + ') :\n\n'
      + String(x.cle || '') + '\n\n'
      + 'Pour l\'activer : dans SkanFact, ouvrez Paramètres → L\'application → Licence, collez la clé en entier (de « SKAN1. » jusqu\'au dernier caractère) et cliquez sur « Enregistrer la clé ». Aucune connexion n\'est nécessaire.\n\n'
      + (x.facture ? 'Votre facture ' + x.facture + ' suit par le même canal.\n\n' : '')
      + 'Merci de votre confiance.\n\n'
      + 'Cordialement,\n' + String(x.signature || 'SkanFact')
  };
}

// L'envoi passe par Resend depuis `send.skanfact.tn` (la seule ligne DKIM de la zone DNS, voir
// DNS-skanfact-tn.md). C'est la SEULE requête sortante de ce worker, et un test le tient : le
// secret d'administration, les clés et les activations ne doivent pouvoir partir nulle part.
// Sans `RESEND_API_KEY`, on ne fait rien et on le DIT — l'éditeur copie la clé et l'envoie à la
// main, comme avant.
export const MAIL_API = 'https://api.resend.com/emails';
export async function envoyerMail(env, m) {
  const e = env || {};
  const cle = String(e.RESEND_API_KEY || '').trim();
  if (!cle) return { ok: false, raison: 'RESEND_API_KEY manque : l\'envoi de mail n\'est pas configuré.' };
  if (!m || !EMAIL.test(String(m.a || ''))) return { ok: false, raison: 'ce client n\'a pas d\'adresse e-mail valable.' };
  const corps = {
    from: String(e.MAIL_FROM || 'SkanFact <licences@send.skanfact.tn>').trim(),
    to: [String(m.a)],
    reply_to: String(e.MAIL_REPLY_TO || 'contact@skanfact.tn').trim(),
    subject: String(m.sujet || ''),
    text: String(m.texte || '')
  };
  try {
    const r = await fetch(MAIL_API, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + cle, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, raison: 'Resend a répondu ' + r.status + (j && j.message ? ' : ' + j.message : '') };
    return { ok: true, id: (j && j.id) || '' };
  } catch (err) { return { ok: false, raison: 'Resend injoignable : ' + (err && err.message) }; }
}

// Ce que la console demande AVANT d'afficher un bouton : peut-on signer, peut-on envoyer ? Un
// bouton qui ne fait rien est pire qu'un bouton absent (7.0.0) — et un bouton présent qui échoue
// avec une phrase claire vaut mieux qu'un bouton absent sans explication.
export async function etatPlateforme(env) {
  const e = env || {};
  const ks = await cleServeur(e);
  return {
    base: !!e.DB,
    emission: { ok: ks.ok, kid: ks.kid, raison: ks.ok ? '' : ks.raison },
    mail: e.RESEND_API_KEY
      ? { ok: true, expediteur: String(e.MAIL_FROM || 'SkanFact <licences@send.skanfact.tn>') }
      : { ok: false, raison: 'RESEND_API_KEY manque : la clé se copie et s\'envoie à la main.' },
    reponse: !!e.REPONSE_PRIVATE_KEY,
    tarifs: tarifs(e),
    offres: OFFRES,
    durees: DUREES
  };
}

// ---------- la base : jamais bloquante ----------
// Chaque accès est enveloppé. Une table absente, une base non branchée, une panne Cloudflare : on
// renvoie le secours et la suite continue comme si la base ne savait rien — c'est-à-dire « active ».
async function sansCasser(promesse, secours) {
  try { return await promesse; } catch { return secours; }
}

async function ligneLicence(env, empreinte) {
  if (!env || !env.DB) return null;
  return sansCasser(
    env.DB.prepare('SELECT id, revoquee_le, revoquee_motif FROM licences WHERE empreinte = ?').bind(empreinte).first(),
    null
  );
}

async function noterActivation(env, empreinte, licenceId, a, maintenant) {
  if (!env || !env.DB || !a.deviceId) return;
  await sansCasser(env.DB.prepare(
    'INSERT INTO activations (id, licence_id, empreinte, device_id, device_nom, plateforme, version, premiere_fois, derniere_fois)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(empreinte, device_id) DO UPDATE SET' +
    '   device_nom = excluded.device_nom, plateforme = excluded.plateforme,' +
    '   version = excluded.version, derniere_fois = excluded.derniere_fois'
  ).bind(
    empreinte.slice(0, 12) + '_' + a.deviceId.slice(0, 12), licenceId, empreinte,
    a.deviceId, a.deviceNom, a.plateforme, a.version, maintenant, maintenant
  ).run(), null);
}

const json = (obj, status) => new Response(JSON.stringify(obj), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

// ---------- la console ----------
// Le journal : tout est un événement, jamais un écrasement (schema.sql). « Révoquée le 14/10 pour
// rétractation » reste écrit pour toujours, et c'est ce qui permet de répondre à un client six
// mois plus tard. Une écriture de journal qui échoue ne fait jamais échouer le geste.
async function journaliser(env, quoi, o) {
  const x = o || {};
  await sansCasser(env.DB.prepare(
    'INSERT INTO evenements (quand, quoi, client_id, licence_id, detail, par_qui) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(new Date().toISOString(), quoi, x.client_id || null, x.licence_id || null, x.detail || null, 'console').run(), null);
}

async function repondreAdmin(r, request, env) {
  const a = autoriseAdmin(request.headers, env);
  if (!a.ok) return json({ erreur: a.message }, a.code);
  if (r.action === 'etat') return json(await etatPlateforme(env));
  if (!env || !env.DB) return json({ erreur: 'La base n\'est pas branchée sur ce worker (réglage « DB »).' }, 503);

  const maintenant = new Date().toISOString();
  const aujourdhui = maintenant.slice(0, 10);
  const tous = async (sql, ...p) => {
    const res = await sansCasser(env.DB.prepare(sql).bind(...p).all(), null);
    return (res && res.results) || [];
  };
  const un = async (sql, ...p) => (await sansCasser(env.DB.prepare(sql).bind(...p).first(), null)) || null;
  const executer = async (sql, ...p) => !!(await sansCasser(env.DB.prepare(sql).bind(...p).run(), null));
  let corps = {};
  if (request.method === 'POST') { try { corps = await request.json(); } catch { corps = {}; } }
  if (request.method !== 'GET' && request.method !== 'POST') return json({ erreur: 'Méthode non autorisée.' }, 405);

  // ----- lectures -----
  const SEL_LICENCE =
    'SELECT l.id, l.client_id, l.kid, l.empreinte, l.offre, l.postes, l.debut, l.fin, l.prix, l.devise, l.remise,' +
    ' l.cabinet_empreinte, l.emise_le, l.remplace_id, l.remplacee_motif, l.revoquee_le, l.revoquee_motif, l.envoyee_le,' +
    ' l.charge IS NOT NULL AS resignable, c.nom AS client, c.matricule, c.email,' +
    ' (SELECT r2.id FROM licences r2 WHERE r2.remplace_id = l.id LIMIT 1) AS remplacee_par,' +
    ' (SELECT COUNT(*) FROM activations a2 WHERE a2.licence_id = l.id) AS activations' +
    ' FROM licences l LEFT JOIN clients c ON c.id = l.client_id';

  if (request.method === 'GET') {
    if (r.action === 'stats') {
      const recent = new Date(Date.now() - 30 * 86400000).toISOString();
      const c = (await un('SELECT COUNT(*) AS n FROM clients')) || {};
      // Une licence REMPLACÉE (renouvelée, offre changée) n'est pas une licence active de plus :
      // compter l'ancienne et la nouvelle ferait deux clients là où il n'y en a qu'un. Le statut se
      // déduit (schema.sql) : révoquée, sinon expirée, sinon remplacée, sinon active.
      const l = (await un(
        'SELECT COUNT(*) AS total,' +
        ' SUM(CASE WHEN revoquee_le IS NOT NULL THEN 1 ELSE 0 END) AS revoquees,' +
        ' SUM(CASE WHEN revoquee_le IS NULL AND fin IS NOT NULL AND fin < ? THEN 1 ELSE 0 END) AS expirees,' +
        ' SUM(CASE WHEN revoquee_le IS NULL AND (fin IS NULL OR fin >= ?)' +
        '   AND NOT EXISTS (SELECT 1 FROM licences r WHERE r.remplace_id = l.id) THEN 1 ELSE 0 END) AS actives' +
        ' FROM licences l', aujourdhui, aujourdhui)) || {};
      const e = (await un('SELECT COUNT(*) AS n FROM activations WHERE empreinte = ? AND derniere_fois >= ?', ESSAI, recent)) || {};
      const p = (await un('SELECT COUNT(*) AS n FROM activations WHERE empreinte <> ?', ESSAI)) || {};
      return json(resumeStats({
        clients: c.n,
        licencesActives: l.actives,
        licencesExpirees: l.expirees,
        licencesRevoquees: l.revoquees,
        essaisEnCours: e.n,
        postes: p.n
      }));
    }
    if (r.action === 'clients') {
      return json({ lignes: await tous('SELECT id, nom, matricule, email, tel, adresse, notes, cree_le FROM clients ORDER BY cree_le DESC LIMIT 500') });
    }
    if (r.action === 'licences' && r.id) {
      // Une licence, avec sa clé — refabriquée à l'identique depuis son contenu signé (voir
      // `signerLicence`). Une licence signée par une autre clé que celle du serveur (la maître,
      // depuis SkanFact) n'est pas refabricable ici, et on le dit plutôt que d'inventer.
      const l = await un(SEL_LICENCE + ' WHERE l.id = ?', r.id);
      if (!l) return json({ erreur: 'Licence introuvable.' }, 404);
      const cle = await cleDeLicence(env, l);
      return json({ licence: l, cle: cle.cle || '', cleRaison: cle.raison || '' });
    }
    if (r.action === 'licences') {
      return json({ lignes: await tous(SEL_LICENCE + ' ORDER BY l.emise_le DESC LIMIT 500') });
    }
    if (r.action === 'activations') {
      return json({ lignes: await tous(
        'SELECT a.empreinte, a.device_id, a.device_nom, a.plateforme, a.version,' +
        ' a.premiere_fois, a.derniere_fois, c.nom AS client' +
        ' FROM activations a LEFT JOIN licences l ON l.id = a.licence_id' +
        ' LEFT JOIN clients c ON c.id = l.client_id' +
        ' ORDER BY a.derniere_fois DESC LIMIT 500') });
    }
    if (r.action === 'ventes') {
      // `?non_facturees=1` : le pont comptable (§ 11). SkanFact TIRE les ventes qui n'ont pas encore
      // de facture, et reçoit avec chacune la clé (refabriquée) pour tenir son miroir local — un
      // serveur ne peut pas écrire dans un logiciel de bureau éteint, c'est lui qui vient chercher.
      const nonFacturees = new URL(request.url).searchParams.get('non_facturees') === '1';
      const lignes = await tous(
        'SELECT v.id, v.client_id, v.licence_id, v.montant_ht, v.tva, v.devise, v.payee_le, v.moyen, v.facture_skanfact, v.importee_le,' +
        ' c.nom AS client, c.matricule, c.email, l.offre, l.fin, l.debut, l.kid, l.emise_le, l.prix, l.remise, l.cabinet_empreinte, l.envoyee_le, l.revoquee_le,' +
        ' l.empreinte, l.charge IS NOT NULL AS resignable' +
        ' FROM ventes v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN licences l ON l.id = v.licence_id' +
        (nonFacturees ? ' WHERE v.facture_skanfact IS NULL' : '') +
        ' ORDER BY COALESCE(v.payee_le, \'\') ASC, v.rowid DESC LIMIT 500');
      if (nonFacturees) {
        for (const v of lignes) {
          const cle = v.licence_id ? await cleDeLicence(env, { id: v.licence_id, kid: v.kid, empreinte: v.empreinte, resignable: v.resignable }) : { cle: '' };
          v.cle = cle.cle || '';
        }
      }
      return json({ lignes });
    }
    if (r.action === 'evenements') {
      return json({ lignes: await tous(
        'SELECT e.id, e.quand, e.quoi, e.client_id, e.licence_id, e.detail, e.par_qui, c.nom AS client' +
        ' FROM evenements e LEFT JOIN clients c ON c.id = e.client_id ORDER BY e.id DESC LIMIT 500') });
    }
    return json({ erreur: 'Introuvable.' }, 404);
  }

  // ----- écritures (P 0.2) -----
  if (r.action === 'clients' && !r.id) {
    const n = nettoyerClient(corps);
    if (!n.ok) return json({ erreur: n.erreur }, 400);
    const id = 'cli_' + idCourt();
    const ok = await executer(
      'INSERT INTO clients (id, nom, matricule, email, tel, adresse, notes, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, n.client.nom, n.client.matricule, n.client.email, n.client.tel, n.client.adresse, n.client.notes, maintenant);
    if (!ok) return json({ erreur: 'La base a refusé l\'écriture du client.' }, 500);
    await journaliser(env, 'client.cree', { client_id: id, detail: n.client.nom });
    return json({ client: { id, ...n.client, cree_le: maintenant } }, 201);
  }

  if (r.action === 'licences' && !r.id) {
    // Émettre : la clé, la ligne de vente, la ligne de journal — dans le même geste, comme en
    // 7.33.0 dans l'application. Et si la vente est déjà payée, la clé part par mail tout de suite.
    const client = await un('SELECT id, nom, matricule, email FROM clients WHERE id = ?', String(corps.clientId || ''));
    if (!client) return json({ erreur: 'Choisis un client existant (crée-le d\'abord).' }, 400);
    const n = nettoyerEmission(corps, aujourdhui);
    if (!n.ok) return json({ erreur: n.erreur }, 400);
    return emettre(env, { client, e: n.e, aujourdhui, maintenant, remplace: null, motif: null });
  }

  if (r.action === 'licences' && r.id && r.sous) {
    const l = await un(SEL_LICENCE + ' WHERE l.id = ?', r.id);
    if (!l) return json({ erreur: 'Licence introuvable.' }, 404);

    if (r.sous === 'revoquer') {
      const motif = texteNet(corps.motif, 200);
      if (!motif || motif.length < 3) return json({ erreur: 'Un motif est obligatoire : c\'est la seule trace qui explique la révocation six mois plus tard.' }, 400);
      if (l.revoquee_le) return json({ erreur: 'Cette licence est déjà révoquée (' + l.revoquee_le + ', ' + (l.revoquee_motif || '') + ').' }, 409);
      await executer('UPDATE licences SET revoquee_le = ?, revoquee_motif = ? WHERE id = ?', aujourdhui, motif, l.id);
      await journaliser(env, 'licence.revoquee', { client_id: l.client_id, licence_id: l.id, detail: motif });
      return json({ ok: true, licence: { ...l, revoquee_le: aujourdhui, revoquee_motif: motif },
        // La limite, dite : une clé livrée ne se reprend pas. L'application ne l'applique qu'à sa
        // prochaine connexion, et seulement si la version publiée embarque la clé de réponse.
        note: 'La révocation sera appliquée chez le client à sa prochaine connexion, si la version installée embarque la clé de réponse. Hors ligne, la clé continue jusqu\'à sa date de fin.' });
    }

    if (r.sous === 'renouveler' || r.sous === 'changer-offre') {
      if (l.revoquee_le) return json({ erreur: 'Une licence révoquée ne se renouvelle pas : émets-en une nouvelle.' }, 409);
      if (l.remplacee_par) return json({ erreur: 'Cette licence a déjà été remplacée par ' + l.remplacee_par + '.' }, 409);
      const client = await un('SELECT id, nom, matricule, email FROM clients WHERE id = ?', l.client_id);
      if (!client) return json({ erreur: 'Le client de cette licence est introuvable.' }, 409);
      let n, motif;
      if (r.sous === 'renouveler') {
        // Un renouvellement part de la FIN de la licence en cours quand elle est encore future : les
        // trente jours de préavis sont payés (règle 8.2.0). La remise de parrainage repart à zéro.
        const depart = l.fin && l.fin > aujourdhui ? l.fin : aujourdhui;
        n = nettoyerEmission({ ...corps, offre: l.offre, remise: corps.remise == null ? 0 : corps.remise, cabinet: l.cabinet_empreinte || '' }, depart);
        if (!n.ok) return json({ erreur: n.erreur }, 400);
        n.e.debut = depart;
        motif = 'renouvellement';
      } else {
        // Changer d'offre : la date de fin ne bouge pas, on facture ce que l'écran a annoncé (le
        // prorata, ou un autre montant décidé à la main). Même offre = rien à changer.
        if (!OFFRES[corps.offre]) return json({ erreur: 'Choisis la nouvelle offre.' }, 400);
        if (corps.offre === l.offre) return json({ erreur: 'Cette licence est déjà en offre ' + OFFRES[l.offre].label + '.' }, 409);
        n = nettoyerEmission({ ...corps, duree: l.fin ? 'date' : 'vie', dateLibre: l.fin, remise: 0, cabinet: l.cabinet_empreinte || '' }, aujourdhui);
        if (!n.ok) return json({ erreur: n.erreur }, 400);
        motif = 'offre';
      }
      return emettre(env, { client, e: n.e, aujourdhui, maintenant, remplace: l, motif });
    }

    if (r.sous === 'envoyer') {
      const cle = await cleDeLicence(env, l);
      if (!cle.cle) return json({ erreur: cle.raison }, 409);
      const m = mailLicence({ offre: l.offre, exp: l.fin || '', cle: cle.cle, signature: env.MAIL_SIGNATURE });
      const envoi = await envoyerMail(env, { a: l.email, sujet: m.sujet, texte: m.texte });
      if (!envoi.ok) {
        await journaliser(env, 'mail.echec', { client_id: l.client_id, licence_id: l.id, detail: envoi.raison });
        return json({ erreur: 'Mail non envoyé : ' + envoi.raison, cle: cle.cle }, 502);
      }
      await executer('UPDATE licences SET envoyee_le = ? WHERE id = ?', maintenant, l.id);
      await journaliser(env, 'mail.envoye', { client_id: l.client_id, licence_id: l.id, detail: l.email });
      return json({ ok: true, envoyee_le: maintenant, a: l.email });
    }
    return json({ erreur: 'Introuvable.' }, 404);
  }

  // L'historique de SkanFact, envoyé UNE fois au premier branchement (§ 11) : les licences émises
  // sur le poste de l'éditeur avant que la console sache vendre. Rien n'est réécrit — une
  // empreinte déjà connue est laissée telle quelle — et chaque refus est nommé, jamais muet.
  if (r.action === 'importer' && !r.id) {
    const liste = Array.isArray(corps && corps.licences) ? corps.licences.slice(0, 500) : [];
    const cles = lireCles(env);
    if (!cles.length) return json({ erreur: 'Plateforme mal réglée (aucune clé publique).' }, 503);
    const bilan = { importees: 0, dejaLa: 0, ignorees: [] };
    const ids = new Map();   // id SkanFact → id en base, pour relier les remplacements
    for (const l of liste) {
      const n = nettoyerImport(l);
      if (!n.ok) { bilan.ignorees.push({ id: String((l && l.id) || '?'), raison: n.erreur }); continue; }
      const v = await verifierLicence(n.l.cle, cles);
      if (!v.ok) { bilan.ignorees.push({ id: n.l.id, raison: 'clé non vérifiable : ' + v.raison }); continue; }
      const empreinte = await empreinteCle(n.l.cle);
      const deja = await un('SELECT id FROM licences WHERE empreinte = ? OR id = ?', empreinte, n.l.id);
      if (deja) { bilan.dejaLa++; ids.set(n.l.id, deja.id); continue; }
      // Le client : par matricule d'abord (unique), par nom ensuite ; créé sinon.
      let client = n.l.matricule ? await un('SELECT id FROM clients WHERE matricule = ?', n.l.matricule) : null;
      if (!client && n.l.nom) client = await un('SELECT id FROM clients WHERE nom = ?', n.l.nom);
      if (!client) {
        const cid = 'cli_' + idCourt();
        await executer('INSERT INTO clients (id, nom, matricule, email, cree_le) VALUES (?, ?, ?, ?, ?)', cid, n.l.nom || 'Client importé', n.l.matricule || null, n.l.email || null, maintenant);
        client = { id: cid };
      }
      const ok = await executer(
        'INSERT INTO licences (id, client_id, kid, empreinte, offre, postes, debut, fin, prix, devise, remise, cabinet_empreinte,' +
        ' emise_le, remplacee_motif, revoquee_le, revoquee_motif, envoyee_le, charge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        n.l.id, client.id, v.kid, empreinte, n.l.offre, null, n.l.emisLe, n.l.exp || null, n.l.prix, n.l.devise, n.l.remise, n.l.cabinet || null,
        n.l.emisLe + 'T00:00:00.000Z', n.l.motif || null, n.l.revoqueeLe || null, n.l.revoqueeMotif || null, n.l.envoyeeLe ? n.l.envoyeeLe + 'T00:00:00.000Z' : null, null);
      if (!ok) { bilan.ignorees.push({ id: n.l.id, raison: 'la base a refusé l\'écriture' }); continue; }
      ids.set(n.l.id, n.l.id);
      if (n.l.facture) {
        await executer('INSERT INTO ventes (id, client_id, licence_id, montant_ht, tva, devise, payee_le, moyen, facture_skanfact, importee_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          'v_' + idCourt(), client.id, n.l.id, n.l.facture.montant, null, n.l.devise, n.l.facture.payeeLe || null, null, n.l.facture.numero || null, maintenant);
      }
      await journaliser(env, 'licence.importee', { client_id: client.id, licence_id: n.l.id, detail: OFFRES[n.l.offre].label + ' — émise dans SkanFact le ' + n.l.emisLe });
      bilan.importees++;
    }
    // Second passage : qui remplace qui. L'ordre d'arrivée ne garantit rien.
    for (const l of liste) {
      const de = ids.get(String((l && l.id) || '')), vers = l && l.remplaceePar ? ids.get(String(l.remplaceePar)) : null;
      if (de && vers) await executer('UPDATE licences SET remplace_id = ? WHERE id = ? AND remplace_id IS NULL', de, vers);
    }
    return json(bilan);
  }

  if (r.action === 'ventes' && r.id && r.sous) {
    const v = await un('SELECT v.*, c.email, c.nom AS client FROM ventes v LEFT JOIN clients c ON c.id = v.client_id WHERE v.id = ?', r.id);
    if (!v) return json({ erreur: 'Vente introuvable.' }, 404);
    if (r.sous === 'payee') {
      // « Skander marque payé, la clé part par mail dans la seconde » (§ 12). Un clic, pas zéro.
      const date = corps.date ? String(corps.date).trim() : aujourdhui;
      if (!dateValide(date)) return json({ erreur: 'La date de paiement n\'est pas une date (AAAA-MM-JJ).' }, 400);
      if (v.payee_le) return json({ erreur: 'Cette vente est déjà marquée payée le ' + v.payee_le + '.' }, 409);
      await executer('UPDATE ventes SET payee_le = ?, moyen = ? WHERE id = ?', date, texteNet(corps.moyen, 40), v.id);
      await journaliser(env, 'vente.payee', { client_id: v.client_id, licence_id: v.licence_id, detail: String(v.montant_ht) + ' ' + v.devise + (corps.moyen ? ' (' + texteNet(corps.moyen, 40) + ')' : '') });
      const mail = await envoyerSiPossible(env, v.licence_id, maintenant);
      return json({ ok: true, payee_le: date, mail });
    }
    if (r.sous === 'facturee') {
      // Le pont comptable (§ 11) : SkanFact rend le numéro de la facture qu'il a émise.
      const numero = texteNet(corps.numero, 40);
      if (!numero) return json({ erreur: 'Le numéro de facture manque.' }, 400);
      await executer('UPDATE ventes SET facture_skanfact = ?, importee_le = ? WHERE id = ?', numero, maintenant, v.id);
      await journaliser(env, 'vente.facturee', { client_id: v.client_id, licence_id: v.licence_id, detail: numero });
      return json({ ok: true, facture_skanfact: numero });
    }
  }
  return json({ erreur: 'Introuvable.' }, 404);

  // ----- les gestes composés -----
  async function emettre(envx, o) {
    const ks = await cleServeur(envx);
    if (!ks.ok) return json({ erreur: 'Émission impossible : ' + ks.raison }, 503);
    const id = idCourt();
    const charge = chargeLicence({
      kid: ks.kid, id, sub: o.client.id, nom: o.client.nom, matricule: o.client.matricule || '',
      offre: o.e.offre, exp: o.e.exp, cabinet: o.e.cabinet, emisLe: o.aujourdhui
    });
    const chargeTexte = JSON.stringify(charge);
    let cle;
    try { cle = await signerLicence(chargeTexte, ks.privee); }
    catch (err) { return json({ erreur: 'La signature a échoué : ' + (err && err.message) }, 500); }
    const empreinte = await empreinteCle(cle);
    const ok = await executer(
      'INSERT INTO licences (id, client_id, kid, empreinte, offre, postes, debut, fin, prix, devise, remise, cabinet_empreinte,' +
      ' emise_le, remplace_id, remplacee_motif, charge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, o.client.id, ks.kid, empreinte, o.e.offre, null, o.e.debut || o.aujourdhui, o.e.exp || null, o.e.prix, o.e.devise,
      o.e.remise, o.e.cabinet || null, o.maintenant, o.remplace ? o.remplace.id : null, o.motif, chargeTexte);
    if (!ok) return json({ erreur: 'La base a refusé l\'écriture de la licence.' }, 500);
    const venteId = 'v_' + idCourt();
    await executer(
      'INSERT INTO ventes (id, client_id, licence_id, montant_ht, tva, devise, payee_le, moyen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      venteId, o.client.id, id, o.e.montant, null, o.e.devise, o.e.payeeLe || null, o.e.payeeLe ? o.e.moyen : null);
    await journaliser(envx, o.motif ? 'licence.' + o.motif : 'licence.emise', {
      client_id: o.client.id, licence_id: id,
      detail: OFFRES[o.e.offre].label + (o.e.exp ? ' jusqu\'au ' + o.e.exp : ' à vie') + ' — ' + o.e.montant + ' ' + o.e.devise + ' HT'
        + (o.remplace ? ' (remplace ' + o.remplace.id + ')' : '')
    });
    const mail = o.e.payeeLe ? await envoyerSiPossible(envx, id, o.maintenant) : { envoye: false, raison: 'la vente n\'est pas encore payée' };
    return json({
      licence: { id, client: o.client.nom, matricule: o.client.matricule, email: o.client.email, kid: ks.kid, empreinte, offre: o.e.offre,
        debut: o.e.debut || o.aujourdhui, fin: o.e.exp || null, prix: o.e.prix, remise: o.e.remise, devise: o.e.devise, emise_le: o.maintenant,
        remplace_id: o.remplace ? o.remplace.id : null, remplacee_motif: o.motif },
      cle, vente: { id: venteId, montant_ht: o.e.montant, devise: o.e.devise, payee_le: o.e.payeeLe || null }, mail
    }, 201);
  }

  // La clé d'une licence rangée : refabriquée depuis son contenu, avec la clé du serveur — à
  // condition que ce soit elle qui l'ait signée.
  async function cleDeLicence(envx, l) {
    if (!l.resignable) return { cle: '', raison: 'Cette licence n\'a pas été émise depuis la console : sa clé est dans SkanFact.' };
    const ks = await cleServeur(envx);
    if (!ks.ok) return { cle: '', raison: 'Émission impossible : ' + ks.raison };
    if (l.kid !== ks.kid) return { cle: '', raison: 'Cette licence a été signée par « ' + l.kid + ' », pas par la clé de ce serveur (« ' + ks.kid + ' »).' };
    const row = await un('SELECT charge FROM licences WHERE id = ?', l.id);
    if (!row || !row.charge) return { cle: '', raison: 'Le contenu signé de cette licence manque.' };
    try {
      const cle = await signerLicence(row.charge, ks.privee);
      // Ce qu'on refabrique doit être ce qu'on a rangé : sinon la clé renvoyée au client n'est pas
      // celle que la base suit, et une révocation viserait une empreinte que personne ne présente.
      if (await empreinteCle(cle) !== l.empreinte) return { cle: '', raison: 'La clé refabriquée ne correspond pas à l\'empreinte rangée : la clé du serveur a changé.' };
      return { cle, raison: '' };
    } catch (err) { return { cle: '', raison: 'Signature impossible : ' + (err && err.message) }; }
  }

  async function envoyerSiPossible(envx, licenceId, quand) {
    if (!licenceId) return { envoye: false, raison: 'aucune licence liée' };
    const l = await un(SEL_LICENCE + ' WHERE l.id = ?', licenceId);
    if (!l) return { envoye: false, raison: 'licence introuvable' };
    if (l.envoyee_le) return { envoye: false, raison: 'déjà envoyée le ' + l.envoyee_le.slice(0, 10) };
    if (!l.email) return { envoye: false, raison: 'ce client n\'a pas d\'adresse e-mail : copie la clé et envoie-la toi-même' };
    const cle = await cleDeLicence(envx, l);
    if (!cle.cle) return { envoye: false, raison: cle.raison };
    const m = mailLicence({ offre: l.offre, exp: l.fin || '', cle: cle.cle, signature: envx.MAIL_SIGNATURE });
    const envoi = await envoyerMail(envx, { a: l.email, sujet: m.sujet, texte: m.texte });
    if (!envoi.ok) {
      await journaliser(envx, 'mail.echec', { client_id: l.client_id, licence_id: l.id, detail: envoi.raison });
      return { envoye: false, raison: envoi.raison };
    }
    await executer('UPDATE licences SET envoyee_le = ? WHERE id = ?', quand, l.id);
    await journaliser(envx, 'mail.envoye', { client_id: l.client_id, licence_id: l.id, detail: l.email });
    return { envoye: true, a: l.email };
  }
}

// ---------- l'état d'une licence, demandé par une application ----------
async function repondreLicence(request, env) {
  if (request.method !== 'POST') return json({ erreur: 'Méthode non autorisée.' }, 405);
  if (!env || !env.APP_SECRET) return json({ erreur: 'Plateforme non configurée.' }, 503);
  if (!memeSecret(request.headers.get('x-skanfact-app') || '', env.APP_SECRET)) {
    return json({ erreur: 'Accès refusé.' }, 403);
  }

  let corps = {};
  try { corps = await request.json(); } catch { corps = {}; }
  const a = nettoyerActivation(corps);
  const maintenant = new Date().toISOString();
  const cle = String((corps && corps.cle) || '').trim();

  // Sans clé : une installation en essai. Elle s'annonce, on le note, et on ne lui dit rien
  // d'autre — c'est SON application qui compte ses trente jours, pas nous. Le jour où ce serveur
  // disparaît, un essai continue exactement comme avant.
  if (!cle) {
    await noterActivation(env, ESSAI, null, a, maintenant);
    return json({ v: 1, etat: 'essai', emisLe: maintenant, signature: null });
  }

  const cles = lireCles(env);
  if (!cles.length) return json({ erreur: 'Plateforme mal réglée (aucune clé publique).' }, 503);

  const v = await verifierLicence(cle, cles);
  const empreinte = await empreinteCle(cle);
  const aujourdhui = maintenant.slice(0, 10);

  const ligne = v.ok ? await ligneLicence(env, empreinte) : null;
  const etat = etatLicence({ contenu: v.ok ? v.contenu : null, ligne, aujourdhui });

  if (v.ok) await noterActivation(env, empreinte, ligne ? ligne.id : null, a, maintenant);

  const rep = corpsReponse({
    sujet: empreinte, etat, contenu: v.ok ? v.contenu : null,
    motif: ligne && ligne.revoquee_motif ? ligne.revoquee_motif : null,
    emisLe: maintenant
  });

  // Sans clé privée de réponse, on répond quand même — non signé. L'application ignorera une
  // réponse non signée pour tout ce qui RESTREINT (c'est sa garantie), et la plateforme reste
  // utilisable en lecture pendant la mise en place.
  if (!env.REPONSE_PRIVATE_KEY) return json({ ...rep, signature: null });
  const signe = await sansCasser(signerReponse(rep, env.REPONSE_PRIVATE_KEY), null);
  return json(signe ? { ...signe.corps, signature: signe.signature } : { ...rep, signature: null });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // La console est servie par le worker lui-même : un seul déploiement, et aucune requête vers un
    // autre domaine à autoriser. Elle ne contient aucune donnée — c'est une page vide tant que le
    // secret n'a pas été saisi.
    if (url.pathname === '/' || url.pathname === '/console') {
      if (request.method !== 'GET') return json({ erreur: 'Méthode non autorisée.' }, 405);
      return new Response(CONSOLE_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer'
        }
      });
    }

    // Un navigateur réclame toujours une icône. Répondre 404 laisse une erreur rouge dans sa
    // console à chaque ouverture — bénigne, mais c'est exactement le bruit qui fait cesser de
    // regarder les erreurs, et donc rater la vraie le jour où elle arrive.
    if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 });

    const r = routeApi(url.pathname);
    if (!r) return json({ erreur: 'Introuvable.' }, 404);
    if (r.v !== 1) return json({ erreur: 'Version d\'interface inconnue.' }, 404);
    if (r.espace === 'admin') return repondreAdmin(r, request, env);
    return repondreLicence(request, env);
  }
};

// ---------- la page de la console ----------
// Une seule page, servie telle quelle. Aucune bibliothèque, aucune requête vers l'extérieur.
//
// ⚠️ AUCUN BACKTICK ni `${` dans ce gabarit : il vit dans un template literal, et le projet s'est
// fait piéger trois fois (7.20.0, 7.29.0, 7.31.0). Le JavaScript de la page concatène ses chaînes
// pour cette raison.
//
// Le secret est gardé dans `sessionStorage` et pas `localStorage` : il disparaît à la fermeture du
// navigateur. Sur un poste partagé, c'est la différence entre « il faut le retaper » et « la
// console de l'éditeur est restée ouverte ».
//
// Les règles d'interface du projet s'appliquent ici comme ailleurs : un chiffre affiché s'ouvre,
// un geste qui change l'état d'une licence DEMANDE d'abord (dans un formulaire qui rappelle de
// quoi on parle), un bouton qui ne peut rien faire dit pourquoi, le pluriel s'accorde.
const CONSOLE_HTML = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>SkanFact — console</title>
<style>
  :root{--ground:#f5f7fa;--surface:#fff;--surface2:#eaf1f1;--ink:#152a2e;--ink2:#4e666c;
        --line:#d3e0e0;--acc:#0f9d8f;--srv:#5a6ac2;--alr:#bf4a33;--warn:#b8791a;color-scheme:light dark}
  @media (prefers-color-scheme:dark){:root{--ground:#0d1517;--surface:#142023;--surface2:#1b2a2d;
        --ink:#e3efec;--ink2:#9ab0b3;--line:#2b3f42;--acc:#41c1b0;--srv:#94a1e6;--alr:#e4785e;--warn:#e0a24a}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
  header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:18px 22px;
         border-bottom:1px solid var(--line);background:var(--surface)}
  header h1{font-size:17px;margin:0;font-weight:700;letter-spacing:-.01em}
  header .sp{flex:1}
  main{padding:22px;max-width:1280px;margin:0 auto}
  .btn{font:inherit;font-size:14px;padding:8px 14px;border-radius:8px;border:1px solid var(--line);
       background:var(--surface);color:var(--ink);cursor:pointer}
  .btn:hover{border-color:var(--acc)}
  .btn.p{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}
  .btn.s{font-size:12.5px;padding:4px 9px}
  .btn.d{color:var(--alr)}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
  input,select,textarea{font:inherit;padding:9px 12px;border-radius:8px;border:1px solid var(--line);
        background:var(--surface);color:var(--ink);width:100%}
  input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--acc);outline-offset:1px}
  label.f{display:block;font-size:12.5px;color:var(--ink2)}
  label.f span{display:block;margin-bottom:4px}
  label.c{display:flex;align-items:center;gap:8px;font-size:14px}
  label.c input{width:auto}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .grid .w{grid-column:1/-1}
  @media (max-width:640px){.grid{grid-template-columns:1fr}}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px}
  .tabs button{font:inherit;font-size:14px;padding:7px 14px;border-radius:999px;cursor:pointer;
       border:1px solid var(--line);background:var(--surface);color:var(--ink2)}
  .tabs button[aria-selected=true]{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}
  /* Six cartes ne se rangent proprement qu'en 6, 3, 2 ou 1 colonnes. En laissant faire
     auto-fit, une largeur intermédiaire en choisit 4 ou 5 et laisse une ou deux orphelines
     sur la seconde ligne. On énumère donc les seuls découpages qui REMPLISSENT chaque rangée.
     (Aucun backtick dans ce commentaire : il vit dans un template literal.) */
  .cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-bottom:20px}
  @media (max-width:1180px){.cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media (max-width:700px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media (max-width:430px){.cards{grid-template-columns:1fr}}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
  .card b{display:block;font-size:28px;font-weight:700;letter-spacing:-.02em;
          font-variant-numeric:tabular-nums;line-height:1.1}
  .card span{display:block;font-size:12.5px;color:var(--ink2);margin-top:4px}
  .card.ess b{color:var(--srv)} .card.rev b{color:var(--alr)} .card.act b{color:var(--acc)}
  .bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
  .panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:20px}
  .panel h2{margin:0 0 4px;font-size:16px}
  .panel .why{margin:0 0 14px;color:var(--ink2);font-size:13.5px}
  .panel .row{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
  .cle{font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;font-size:12.5px;word-break:break-all;
       background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0;user-select:all}
  .note{font-size:13px;color:var(--warn);margin:8px 0 0}
  .wrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th,td{padding:10px 14px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
  tr:last-child td{border-bottom:0}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink2);background:var(--surface2)}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  td.acts{white-space:normal}
  td.acts .btn{margin:2px 4px 2px 0}
  .mono{font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;font-size:12px}
  .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:600;
        border:1px solid var(--line)}
  .pill.a{color:var(--acc);border-color:var(--acc)}
  .pill.r{color:var(--alr);border-color:var(--alr)}
  .pill.w{color:var(--warn);border-color:var(--warn)}
  .pill.e{color:var(--ink2)}
  .vide,.chargement{padding:36px 22px;text-align:center;color:var(--ink2)}
  .msg{padding:14px 18px;border-radius:10px;border:1px solid var(--alr);
       background:var(--surface);color:var(--ink);margin-bottom:20px}
  .msg.ok{border-color:var(--acc)}
  .msg.w{border-color:var(--warn)}
  .lock{max-width:420px;margin:12vh auto;background:var(--surface);border:1px solid var(--line);
        border-radius:16px;padding:28px}
  .lock h2{margin:0 0 6px;font-size:19px}
  .lock p{margin:0 0 18px;color:var(--ink2);font-size:14px}
  .lock .row{display:flex;gap:10px;margin-top:14px}
  footer{padding:20px 22px;color:var(--ink2);font-size:12.5px;text-align:center}
  [hidden]{display:none!important}
</style>
</head><body>

<div id="lock" class="lock">
  <h2>Console SkanFact</h2>
  <p>Colle le secret d'administration. Il reste dans cet onglet et disparaît quand tu fermes le navigateur.</p>
  <label for="sec" style="display:block;font-size:12.5px;color:var(--ink2);margin-bottom:6px">Secret d'administration</label>
  <input id="sec" type="password" autocomplete="current-password" spellcheck="false">
  <div class="row"><button id="go" class="btn p" type="button">Ouvrir la console</button></div>
  <p id="lockmsg" style="margin-top:14px;color:var(--alr)" hidden></p>
</div>

<div id="app" hidden>
  <header>
    <h1>SkanFact — console</h1>
    <span class="pill e" id="etat-pill">…</span>
    <span class="sp"></span>
    <button id="refresh" class="btn" type="button">Actualiser</button>
    <button id="out" class="btn" type="button">Fermer la session</button>
  </header>
  <main>
    <div id="err" class="msg" hidden></div>
    <div id="info" class="msg ok" hidden></div>
    <div class="cards" id="cards"></div>
    <div class="bar">
      <button id="emettre" class="btn p" type="button">Émettre une licence…</button>
      <button id="nouveau-client" class="btn" type="button">Nouveau client…</button>
      <span id="etat-txt" style="font-size:13px;color:var(--ink2)"></span>
    </div>
    <div id="form" class="panel" hidden></div>
    <div id="resultat" class="panel" hidden></div>
    <div class="tabs" id="tabs" role="tablist"></div>
    <div id="table"></div>
  </main>
  <footer id="foot">Une clé livrée ne se reprend pas : une révocation s'applique chez le client à sa prochaine connexion, et seulement si sa version embarque la clé de réponse.</footer>
</div>

<script>
(function () {
  var CLE = 'skanfact-console';
  var secret = sessionStorage.getItem(CLE) || '';
  var onglet = 'licences';
  var etat = null;        // ce que /v1/admin/etat a répondu : peut-on signer, peut-on envoyer
  var clients = [];       // pour le choix d'un client à l'émission
  var $ = function (id) { return document.getElementById(id); };
  var h = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var pl = function (n, mot, plur) {
    n = Number(n) || 0;
    return n + ' ' + (Math.abs(n) >= 2 ? (plur || (mot + 's')) : mot);
  };
  var jour = function (iso) {
    iso = String(iso || '').slice(0, 10);
    return /^\\d{4}-\\d{2}-\\d{2}$/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  };
  var depuis = function (iso) {
    var a = Date.parse(iso || ''); if (isNaN(a)) return '';
    var j = Math.floor((Date.now() - a) / 86400000);
    if (j <= 0) return "aujourd'hui";
    if (j === 1) return 'hier';
    if (j < 31) return 'il y a ' + pl(j, 'jour');
    var m = Math.floor(j / 30);
    if (m < 12) return 'il y a ' + pl(m, 'mois', 'mois');
    return 'il y a ' + pl(Math.floor(j / 365), 'an');
  };
  var montant = function (n, dev) {
    var x = Number(n) || 0;
    return x.toFixed(3).replace('.', ',').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ') + ' ' + (dev || '');
  };
  var aujourdhui = function () {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  function api(chemin, corps) {
    var o = { headers: { 'X-SkanFact-Admin': secret } };
    if (corps) { o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(corps); }
    return fetch('/v1/admin/' + chemin, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.erreur || ('Le serveur a répondu ' + r.status + '.')); e.reponse = j; throw e; }
        return j;
      });
    });
  }

  // --- l'écran d'entrée ---
  function ouvrir() {
    var v = $('sec').value.trim();
    if (!v) { return echecEntree('Colle le secret pour continuer.'); }
    secret = v;
    api('stats').then(function () {
      sessionStorage.setItem(CLE, secret);
      $('lock').hidden = true; $('app').hidden = false;
      dessiner();
    }, function (e) { secret = ''; echecEntree(e.message); });
  }
  function echecEntree(m) {
    var el = $('lockmsg'); el.textContent = m; el.hidden = false;
    $('sec').focus(); $('sec').select();
  }
  $('go').onclick = ouvrir;
  $('sec').onkeydown = function (e) { if (e.key === 'Enter') ouvrir(); };
  $('out').onclick = function () {
    sessionStorage.removeItem(CLE); secret = '';
    $('app').hidden = true; $('lock').hidden = false; $('sec').value = ''; $('sec').focus();
  };
  $('refresh').onclick = function () { dessiner(); };
  $('emettre').onclick = function () { formEmettre(null, null); };
  $('nouveau-client').onclick = function () { formClient(); };

  // --- les messages ---
  function montrerErreur(e) {
    var el = $('err');
    el.textContent = e && e.message ? e.message : 'Quelque chose n\\u2019a pas répondu.';
    el.hidden = false; $('info').hidden = true;
    window.scrollTo(0, 0);
  }
  function montrerInfo(t) { var el = $('info'); el.textContent = t; el.hidden = false; $('err').hidden = true; }
  function fermerForm() { $('form').hidden = true; $('form').innerHTML = ''; }

  // --- l'état du serveur : ce qu'on PEUT faire ---
  function dessinerEtat() {
    var pill = $('etat-pill'), txt = $('etat-txt');
    if (!etat) { pill.textContent = '…'; return; }
    if (etat.emission.ok) {
      pill.className = 'pill a'; pill.textContent = 'émission prête (' + etat.emission.kid + ')';
      txt.textContent = etat.mail.ok ? 'Les clés partent par mail depuis ' + etat.mail.expediteur + '.' : 'Mail non configuré : ' + etat.mail.raison;
    } else {
      pill.className = 'pill r'; pill.textContent = 'émission impossible';
      txt.textContent = etat.emission.raison;
    }
    $('emettre').disabled = !etat.emission.ok;
    $('emettre').title = etat.emission.ok ? '' : etat.emission.raison;
  }

  // --- les formulaires : une seule zone, un seul formulaire à la fois ---
  // Chaque formulaire RAPPELLE de quoi on parle (le client, la licence, le montant) avant de
  // demander : une question posée hors contexte se clique sans être lue (7.28.0).
  function formulaire(titre, why, champs, okLibelle, onOk) {
    var el = $('form');
    el.innerHTML = '<h2>' + h(titre) + '</h2><p class="why">' + why + '</p>' +
      '<div class="grid">' + champs + '</div>' +
      '<p id="f-msg" class="note" hidden></p>' +
      '<div class="row"><button id="f-ok" class="btn p" type="button">' + h(okLibelle) + '</button>' +
      '<button id="f-non" class="btn" type="button">Annuler</button></div>';
    el.hidden = false;
    $('f-non').onclick = fermerForm;
    $('f-ok').onclick = function () {
      $('f-ok').disabled = true; $('f-msg').hidden = true;
      // Après un succès, le formulaire a été refermé et ses boutons n'existent plus : on relit
      // l'élément au lieu de le supposer là (attrapé par e2e:console — une exception dans une
      // promesse ne s'affiche nulle part chez l'utilisateur).
      var libere = function () { var b = $('f-ok'); if (b) b.disabled = false; };
      Promise.resolve().then(onOk).then(libere, function (e) {
        libere();
        var m = $('f-msg'); if (m) { m.textContent = e && e.message ? e.message : 'Échec.'; m.hidden = false; }
      });
    };
    var premier = el.querySelector('input,select,textarea'); if (premier) premier.focus();
  }
  var val = function (name) { var e = document.querySelector('#form [name="' + name + '"]'); return e ? (e.type === 'checkbox' ? e.checked : e.value) : ''; };
  var champ = function (name, label, attrs, w) {
    return '<label class="f' + (w ? ' w' : '') + '"><span>' + h(label) + '</span><input name="' + name + '" ' + (attrs || '') + '></label>';
  };

  function formClient() {
    formulaire('Nouveau client', 'Le nom et le matricule fiscal vont DANS la clé : elle ne s\\u2019activera que sur le dossier qui porte ce matricule. L\\u2019adresse e-mail sert à envoyer la clé.',
      champ('nom', 'Raison sociale *', 'maxlength="120"', true) +
      champ('matricule', 'Matricule fiscal', 'placeholder="1234567A/M/P/000" maxlength="30"') +
      champ('email', 'E-mail', 'type="email" maxlength="200"') +
      champ('tel', 'Téléphone', 'maxlength="40"') +
      champ('adresse', 'Adresse', 'maxlength="300"') +
      '<label class="f w"><span>Notes</span><textarea name="notes" rows="2"></textarea></label>',
      'Créer le client', function () {
        return api('clients', { nom: val('nom'), matricule: val('matricule'), email: val('email'), tel: val('tel'), adresse: val('adresse'), notes: val('notes') })
          .then(function (j) {
            fermerForm(); montrerInfo('Client créé : ' + j.client.nom + '.');
            onglet = 'clients'; dessiner();
          });
      });
  }

  // Émettre (lic = null), renouveler (mode 'renouveler') ou changer d'offre (mode 'offre').
  function formEmettre(lic, mode) {
    if (!etat || !etat.emission.ok) return montrerErreur(new Error(etat ? etat.emission.raison : 'État du serveur inconnu.'));
    var t = etat.tarifs;
    var offres = Object.keys(etat.offres).map(function (k) {
      return '<option value="' + k + '"' + (lic && lic.offre === k && mode !== 'offre' ? ' selected' : '') + '>' + h(etat.offres[k].label) + '</option>';
    }).join('');
    var durees = etat.durees.map(function (d) { return '<option value="' + d.id + '"' + (d.id === '1a' ? ' selected' : '') + '>' + h(d.label) + '</option>'; }).join('');
    var choixClient = clients.length
      ? '<select name="clientId">' + clients.map(function (c) { return '<option value="' + h(c.id) + '">' + h(c.nom) + (c.matricule ? ' — ' + h(c.matricule) : '') + (c.email ? '' : ' (sans e-mail)') + '</option>'; }).join('') + '</select>'
      : '<span style="color:var(--alr)">Aucun client : crée-le d\\u2019abord (« Nouveau client… »).</span>';
    var titre, why, champs, ok;
    if (!lic) {
      titre = 'Émettre une licence';
      why = 'Trois choses dans le même geste : la clé signée par le serveur, la vente, la ligne de journal. Si la vente est déjà payée, la clé part par mail tout de suite (quand le client a une adresse).';
      champs = '<label class="f w"><span>Client *</span>' + choixClient + '</label>' +
        '<label class="f"><span>Offre</span><select name="offre">' + offres + '</select></label>' +
        '<label class="f"><span>Durée</span><select name="duree">' + durees + '</select></label>' +
        champ('dateLibre', 'Date de fin (si « jusqu\\u2019à une date précise »)', 'type="date"') +
        champ('prix', 'Prix HT (' + h(t.devise) + ') *', 'type="number" step="0.001" min="0" value="' + t.entreprise + '"') +
        '<label class="c w"><input type="checkbox" name="parrain"> Client parrainé par un cabinet comptable (remise de ' + t.remiseParrainage + ' % la première année)</label>' +
        champ('cabinet', 'Empreinte du cabinet (facultatif)', 'placeholder="xxxx-xxxx-xxxx-xxxx-xxxx" maxlength="30"', true) +
        '<label class="c w"><input type="checkbox" name="payee"> Déjà payée</label>' +
        champ('payeeLe', 'Payée le', 'type="date" value="' + aujourdhui() + '"') +
        champ('moyen', 'Moyen de paiement', 'placeholder="virement, espèces, chèque…" maxlength="40"');
      ok = 'Émettre la clé';
    } else if (mode === 'renouveler') {
      var depart = lic.fin && lic.fin > aujourdhui() ? lic.fin : aujourdhui();
      titre = 'Renouveler la licence de ' + lic.client;
      why = 'Offre ' + h(etat.offres[lic.offre].label) + (lic.fin ? ', fin actuelle le ' + jour(lic.fin) : '') + '. La nouvelle période part du <strong>' + jour(depart) + '</strong> : les jours déjà payés ne sont pas perdus. Une nouvelle clé est signée, l\\u2019ancienne reste valable jusqu\\u2019à sa date. La remise de parrainage ne s\\u2019applique qu\\u2019à la première année.';
      champs = '<label class="f"><span>Durée</span><select name="duree">' + durees + '</select></label>' +
        champ('dateLibre', 'Date de fin (si « jusqu\\u2019à une date précise »)', 'type="date"') +
        champ('prix', 'Prix HT (' + h(t.devise) + ') *', 'type="number" step="0.001" min="0" value="' + (t[lic.offre] || t.entreprise) + '"') +
        '<label class="c w"><input type="checkbox" name="payee"> Déjà payée</label>' +
        champ('payeeLe', 'Payée le', 'type="date" value="' + aujourdhui() + '"') +
        champ('moyen', 'Moyen de paiement', 'maxlength="40"');
      ok = 'Renouveler';
    } else {
      var autre = lic.offre === 'entreprise' ? 'independant' : 'entreprise';
      var pro = prorata(lic, t[autre], t[lic.offre]);
      titre = 'Changer l\\u2019offre de ' + lic.client;
      why = 'Actuellement <strong>' + h(etat.offres[lic.offre].label) + '</strong>' + (lic.fin ? ', jusqu\\u2019au ' + jour(lic.fin) : ', à vie') + '. La date de fin ne bouge pas ; on facture la différence sur les jours restants' +
        (pro.jours == null ? ' — <strong>licence à vie : pas de prorata possible, décide le montant à la main</strong>.' : ' : <strong>' + pro.jours + ' jours sur ' + pro.total + '</strong>, soit ' + montant(pro.montant, t.devise) + ' HT proposés.') +
        ' Une « descente » vers moins cher ne rembourse rien toute seule.';
      champs = '<label class="f"><span>Nouvelle offre</span><select name="offre">' + Object.keys(etat.offres).map(function (k) {
          return '<option value="' + k + '"' + (k === autre ? ' selected' : '') + '>' + h(etat.offres[k].label) + '</option>';
        }).join('') + '</select></label>' +
        champ('prix', 'Montant à facturer HT (' + h(t.devise) + ') *', 'type="number" step="0.001" min="0" value="' + pro.montant + '"') +
        '<label class="c w"><input type="checkbox" name="payee"> Déjà payée</label>' +
        champ('payeeLe', 'Payée le', 'type="date" value="' + aujourdhui() + '"') +
        champ('moyen', 'Moyen de paiement', 'maxlength="40"');
      ok = 'Changer l\\u2019offre';
    }
    formulaire(titre, why, champs, ok, function () {
      var corps = { offre: val('offre'), duree: val('duree'), dateLibre: val('dateLibre'), prix: val('prix'),
        remise: val('parrain') ? t.remiseParrainage : 0, cabinet: val('cabinet'),
        payeeLe: val('payee') ? val('payeeLe') : '', moyen: val('moyen'), devise: t.devise };
      var chemin;
      if (!lic) { corps.clientId = val('clientId'); chemin = 'licences'; }
      else chemin = 'licences/' + lic.id + '/' + (mode === 'renouveler' ? 'renouveler' : 'changer-offre');
      return api(chemin, corps).then(function (j) {
        fermerForm(); montrerResultat(j); dessiner();
      });
    });
    // Le prix proposé suit l'offre choisie — c'est un préremplissage, jamais une décision.
    var so = document.querySelector('#form [name="offre"]');
    if (so && !lic) so.onchange = function () { var p = document.querySelector('#form [name="prix"]'); if (p) p.value = t[so.value]; };
  }
  function prorata(lic, prixNouveau, prixAncien) {
    var diff = Math.max(0, (Number(prixNouveau) || 0) - (Number(prixAncien) || 0));
    var r3 = function (x) { return Math.round(x * 1000) / 1000; };
    if (!lic.fin) return { jours: null, total: null, montant: r3(diff) };
    var d = function (iso) { return Date.parse(iso + 'T00:00:00Z'); };
    var total = Math.max(1, Math.round((d(lic.fin) - d(lic.debut || aujourdhui())) / 86400000));
    var jours = Math.max(0, Math.round((d(lic.fin) - d(aujourdhui())) / 86400000));
    return { jours: jours, total: total, montant: r3(diff * Math.min(1, jours / total)) };
  }

  // La clé, affichée après l'émission : c'est LE produit, la vente n'en est que la conséquence
  // (règle 8.2.0 : un geste finit là où il se termine vraiment).
  function montrerResultat(j) {
    var el = $('resultat'); var l = j.licence || {};
    var mail = j.mail || {};
    el.innerHTML = '<h2>Clé émise pour ' + h(l.client) + '</h2>' +
      '<p class="why">' + h(etat.offres[l.offre] ? etat.offres[l.offre].label : l.offre) + (l.fin ? ', jusqu\\u2019au ' + jour(l.fin) : ', à vie') +
      ' — ' + montant(j.vente ? j.vente.montant_ht : l.prix, l.devise) + ' HT' + (j.vente && j.vente.payee_le ? ', payée le ' + jour(j.vente.payee_le) : ', à encaisser') + '.</p>' +
      '<div class="cle" id="cle">' + h(j.cle) + '</div>' +
      '<p class="note">' + (mail.envoye ? '✓ Envoyée par mail à ' + h(mail.a) + '.' : 'Pas envoyée par mail : ' + h(mail.raison || '') + '.') + '</p>' +
      '<div class="row"><button id="cle-copier" class="btn p" type="button">Copier la clé</button>' +
      '<button id="cle-fermer" class="btn" type="button">Fermer</button></div>';
    el.hidden = false;
    $('cle-copier').onclick = function () { copier(j.cle, $('cle-copier')); };
    $('cle-fermer').onclick = function () { el.hidden = true; el.innerHTML = ''; };
    el.scrollIntoView({ block: 'nearest' });
  }
  function copier(texte, bouton) {
    var fini = function (ok) { if (bouton) { bouton.textContent = ok ? 'Copiée ✓' : 'Sélectionne et copie à la main'; } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(function () { fini(true); }, function () { fini(false); });
    else fini(false);
  }

  // --- les gestes sur une ligne ---
  function voirCle(id) {
    api('licences/' + id).then(function (j) {
      var el = $('resultat'); var l = j.licence;
      el.innerHTML = '<h2>Licence de ' + h(l.client) + '</h2>' +
        '<p class="why">' + h(etat.offres[l.offre] ? etat.offres[l.offre].label : l.offre) + (l.fin ? ', jusqu\\u2019au ' + jour(l.fin) : ', à vie') +
        ' — émise le ' + jour(l.emise_le) + (l.envoyee_le ? ', envoyée le ' + jour(l.envoyee_le) : ', jamais envoyée') +
        (l.email ? ' (' + h(l.email) + ')' : ' — ce client n\\u2019a pas d\\u2019e-mail') + '.</p>' +
        (j.cle ? '<div class="cle" id="cle">' + h(j.cle) + '</div>' : '<p class="note">' + h(j.cleRaison) + '</p>') +
        '<div class="row">' + (j.cle ? '<button id="cle-copier" class="btn p" type="button">Copier la clé</button>' : '') +
        '<button id="cle-fermer" class="btn" type="button">Fermer</button></div>';
      el.hidden = false;
      if (j.cle) $('cle-copier').onclick = function () { copier(j.cle, $('cle-copier')); };
      $('cle-fermer').onclick = function () { el.hidden = true; el.innerHTML = ''; };
      el.scrollIntoView({ block: 'nearest' });
    }, montrerErreur);
  }
  function envoyer(lic) {
    formulaire('Envoyer la clé par mail', 'À <strong>' + h(lic.email || '(pas d\\u2019adresse)') + '</strong>, pour ' + h(lic.client) + ' — offre ' + h(etat.offres[lic.offre] ? etat.offres[lic.offre].label : lic.offre) + (lic.envoyee_le ? '. Déjà envoyée le ' + jour(lic.envoyee_le) + ' : ceci renvoie la même clé.' : '.'),
      '', 'Envoyer', function () {
        return api('licences/' + lic.id + '/envoyer', {}).then(function (j) { fermerForm(); montrerInfo('Clé envoyée à ' + j.a + '.'); dessiner(); });
      });
  }
  function revoquer(lic) {
    formulaire('Révoquer la licence de ' + lic.client,
      'Offre ' + h(etat.offres[lic.offre] ? etat.offres[lic.offre].label : lic.offre) + (lic.fin ? ', jusqu\\u2019au ' + jour(lic.fin) : ', à vie') + ', ' + pl(lic.activations, 'ordinateur') + ' vu' + (Number(lic.activations) >= 2 ? 's' : '') + '.<br>' +
      '<strong style="color:var(--warn)">Ce que ça fait vraiment :</strong> la licence sort des actives avec son motif, et l\\u2019application du client ferme la création de nouvelles pièces à sa prochaine connexion — si sa version embarque la clé de réponse. Hors ligne, la clé continue jusqu\\u2019à sa date de fin : une clé livrée ne se reprend pas. Le remboursement, lui, passe par un avoir dans SkanFact.',
      champ('motif', 'Motif *', 'placeholder="rétractation, impayé, erreur d\\u2019émission…" maxlength="200"', true),
      'Révoquer', function () {
        return api('licences/' + lic.id + '/revoquer', { motif: val('motif') }).then(function (j) { fermerForm(); montrerInfo('Licence révoquée. ' + (j.note || '')); dessiner(); });
      });
  }
  function payee(v) {
    formulaire('Marquer la vente payée', h(v.client) + ' — ' + montant(v.montant_ht, v.devise) + ' HT. ' +
      (v.licence_id && !v.envoyee_le ? 'La clé partira par mail dans la foulée' + (v.email ? ' à ' + h(v.email) : ' — mais ce client n\\u2019a pas d\\u2019adresse : tu la copieras') + '.' : ''),
      champ('date', 'Payée le', 'type="date" value="' + aujourdhui() + '"') + champ('moyen', 'Moyen', 'placeholder="virement, espèces, chèque…" maxlength="40"'),
      'Marquer payée', function () {
        return api('ventes/' + v.id + '/payee', { date: val('date'), moyen: val('moyen') }).then(function (j) {
          fermerForm();
          montrerInfo('Vente payée. ' + (j.mail && j.mail.envoye ? 'Clé envoyée à ' + j.mail.a + '.' : 'Clé non envoyée : ' + (j.mail ? j.mail.raison : '') + '.'));
          dessiner();
        });
      });
  }
  function facturee(v) {
    formulaire('Numéro de la facture SkanFact', h(v.client) + ' — ' + montant(v.montant_ht, v.devise) + ' HT. Le numéro de la facture émise dans SkanFact, pour que la vente et la comptabilité se retrouvent.',
      champ('numero', 'Numéro *', 'placeholder="FAC-2026-012" maxlength="40"', true),
      'Enregistrer', function () {
        return api('ventes/' + v.id + '/facturee', { numero: val('numero') }).then(function () { fermerForm(); montrerInfo('Numéro enregistré.'); dessiner(); });
      });
  }

  // --- les chiffres ---
  // Chaque carte porte SES deux formes : le libellé s'accorde avec son chiffre. Écrit en dur au
  // pluriel, il donnait « 0 essais en cours » (zéro prend le singulier en français) et aurait donné
  // « 1 licences actives ». C'est le premier écran que l'éditeur regarde tous les matins.
  var CARTES = [
    { k: 'essaisEnCours', s: 'essai en cours', p: 'essais en cours', c: 'ess', t: 'activations' },
    { k: 'licencesActives', s: 'licence active', p: 'licences actives', c: 'act', t: 'licences' },
    { k: 'licencesExpirees', s: 'expirée', p: 'expirées', c: '', t: 'licences' },
    { k: 'licencesRevoquees', s: 'révoquée', p: 'révoquées', c: 'rev', t: 'licences' },
    { k: 'postes', s: 'ordinateur vu', p: 'ordinateurs vus', c: '', t: 'activations' },
    { k: 'clients', s: 'client', p: 'clients', c: '', t: 'clients' }
  ];

  var etatLic = function (r) {
    if (r.revoquee_le) return '<span class="pill r">révoquée' + (r.revoquee_motif ? ' — ' + h(r.revoquee_motif) : '') + '</span>';
    if (r.remplacee_par) return '<span class="pill e">remplacée</span>';
    if (r.fin && r.fin < aujourdhui()) return '<span class="pill e">expirée</span>';
    return '<span class="pill a">active</span>';
  };
  var COLONNES = {
    licences: [
      { k: 'client', t: 'Client' },
      { k: 'offre', t: 'Offre', f: function (v) { return etat && etat.offres[v] ? etat.offres[v].label : v; } },
      { k: 'fin', t: 'Fin', f: function (v) { return v ? jour(v) : 'à vie'; } },
      { k: 'activations', t: 'Postes', n: true },
      { k: 'kid', t: 'Clé', m: true },
      { k: 'envoyee_le', t: 'Envoyée', f: function (v, r) { return v ? jour(v) : (r.revoquee_le ? '—' : '<span class="pill w">jamais</span>'); }, brut: true },
      { k: 'revoquee_le', t: 'État', f: function (v, r) { return etatLic(r); }, brut: true },
      { k: 'id', t: 'Actions', brut: true, a: true, f: function (v, r) {
          var b = function (act, lib, cls) { return '<button type="button" class="btn s' + (cls || '') + '" data-act="' + act + '" data-id="' + h(r.id) + '">' + lib + '</button>'; };
          var s = b('voir', 'Voir la clé');
          if (!r.revoquee_le) {
            if (r.resignable) s += b('envoyer', r.envoyee_le ? 'Renvoyer par mail' : 'Envoyer par mail');
            if (!r.remplacee_par) s += b('renouveler', 'Renouveler') + b('offre', 'Changer d\\u2019offre');
            s += b('revoquer', 'Révoquer', ' d');
          }
          return s;
        } }
    ],
    activations: [
      { k: 'client', t: 'Client', f: function (v, r) { return v || (r.empreinte === 'ESSAI' ? '— en essai —' : '— licence inconnue —'); } },
      { k: 'device_nom', t: 'Ordinateur' },
      { k: 'plateforme', t: 'Système' },
      { k: 'version', t: 'Version', m: true },
      { k: 'derniere_fois', t: 'Vu', f: function (v) { return depuis(v); } },
      { k: 'premiere_fois', t: 'Depuis', f: function (v) { return jour(v); } }
    ],
    clients: [
      { k: 'nom', t: 'Nom' }, { k: 'matricule', t: 'Matricule', m: true },
      { k: 'email', t: 'Courriel' }, { k: 'tel', t: 'Téléphone' },
      { k: 'cree_le', t: 'Créé', f: function (v) { return jour(v); } }
    ],
    ventes: [
      { k: 'client', t: 'Client' },
      { k: 'montant_ht', t: 'Montant HT', n: true, f: function (v, r) { return montant(v, r.devise); } },
      { k: 'payee_le', t: 'État', f: function (v) { return v ? '<span class="pill a">payée le ' + jour(v) + '</span>' : '<span class="pill w">à encaisser</span>'; }, brut: true },
      { k: 'moyen', t: 'Moyen' },
      { k: 'facture_skanfact', t: 'Facture', f: function (v) { return v || 'à établir'; } },
      { k: 'id', t: 'Actions', brut: true, a: true, f: function (v, r) {
          var b = function (act, lib) { return '<button type="button" class="btn s" data-act="' + act + '" data-id="' + h(r.id) + '">' + lib + '</button>'; };
          return (r.payee_le ? '' : b('payee', 'Marquer payée')) + (r.facture_skanfact ? '' : b('facturee', 'N° de facture…'));
        } }
    ],
    evenements: [
      { k: 'quand', t: 'Quand', f: function (v) { return jour(v) + ' ' + String(v || '').slice(11, 16); } },
      { k: 'quoi', t: 'Quoi', m: true },
      { k: 'client', t: 'Client' },
      { k: 'detail', t: 'Détail' }
    ]
  };
  var TITRES = { licences: 'Licences', ventes: 'Ventes', activations: 'Activations', clients: 'Clients', evenements: 'Journal' };
  // Chaque écran vide dit quoi faire, au lieu d'un tableau nu (7.0.0).
  var VIDES = {
    licences: 'Aucune licence émise depuis la console. « Émettre une licence… » ci-dessus signe la clé, enregistre la vente et l\\u2019envoie par mail.',
    activations: 'Aucune application ne s\\u2019est encore annoncée. Il faut une installation en 8.4.1 ou plus récente.',
    clients: 'Aucun client. « Nouveau client… » ci-dessus — le nom et le matricule entrent dans la clé.',
    ventes: 'Aucune vente : elles naissent avec l\\u2019émission d\\u2019une licence.',
    evenements: 'Rien dans le journal : chaque émission, révocation, paiement et envoi y sera écrit, pour toujours.'
  };

  function dessiner() {
    $('err').hidden = true;
    $('tabs').innerHTML = Object.keys(TITRES).map(function (k) {
      return '<button role="tab" data-t="' + k + '" aria-selected="' + (k === onglet) + '">' + TITRES[k] + '</button>';
    }).join('');
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.onclick = function () { onglet = b.dataset.t; dessiner(); };
    });

    api('etat').then(function (e) { etat = e; dessinerEtat(); }, montrerErreur);
    api('clients').then(function (d) { clients = d.lignes || []; }, function () {});

    api('stats').then(function (s) {
      $('cards').innerHTML = CARTES.map(function (c) {
        var n = Number(s[c.k]) || 0;
        return '<div class="card ' + c.c + '" role="button" tabindex="0" data-t="' + c.t + '" style="cursor:pointer"><b>' + n + '</b><span>' + (n >= 2 ? c.p : c.s) + '</span></div>';
      }).join('');
      // Un chiffre affiché s'ouvre (7.15.0).
      Array.prototype.forEach.call($('cards').children, function (c) {
        var aller = function () { onglet = c.dataset.t; dessiner(); };
        c.onclick = aller; c.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aller(); } };
      });
    }, montrerErreur);

    // « Chargement » n'est PAS un écran vide : même apparence, classe différente, sinon rien ne
    // distingue « on attend la réponse » de « il n'y a rien », ni à l'œil ni pour un test.
    $('table').innerHTML = '<div class="chargement">Chargement…</div>';
    api(onglet).then(function (d) {
      var lignes = d.lignes || [];
      if (!lignes.length) { $('table').innerHTML = '<div class="wrap"><div class="vide">' + VIDES[onglet] + '</div></div>'; return; }
      var cols = COLONNES[onglet];
      var html = '<div class="wrap"><table><thead><tr>' +
        cols.map(function (c) { return '<th' + (c.n ? ' class="num"' : '') + '>' + c.t + '</th>'; }).join('') +
        '</tr></thead><tbody>' +
        lignes.map(function (r) {
          return '<tr>' + cols.map(function (c) {
            var v = r[c.k];
            var texte = c.f ? c.f(v, r) : (v == null || v === '' ? '—' : v);
            var cl = (c.n ? 'num ' : '') + (c.m ? 'mono ' : '') + (c.a ? 'acts' : '');
            return '<td' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + '>' + (c.brut ? texte : h(texte)) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      $('table').innerHTML = html;
      // Les boutons de ligne : un seul gestionnaire, qui retrouve la LIGNE au moment du clic (le
      // tableau a pu être redessiné entre-temps — piège 7.17.0).
      $('table').onclick = function (e) {
        var b = e.target.closest('button[data-act]'); if (!b) return;
        var r = lignes.find(function (x) { return String(x.id) === b.dataset.id; }); if (!r) return;
        var act = b.dataset.act;
        if (act === 'voir') voirCle(r.id);
        else if (act === 'envoyer') envoyer(r);
        else if (act === 'renouveler') formEmettre(r, 'renouveler');
        else if (act === 'offre') formEmettre(r, 'offre');
        else if (act === 'revoquer') revoquer(r);
        else if (act === 'payee') payee(r);
        else if (act === 'facturee') facturee(r);
      };
    }, montrerErreur);
  }

  if (secret) {
    api('stats').then(function () { $('lock').hidden = true; $('app').hidden = false; dessiner(); },
      function () { sessionStorage.removeItem(CLE); secret = ''; $('sec').focus(); });
  } else { $('sec').focus(); }
})();
</script>
</body></html>`;
