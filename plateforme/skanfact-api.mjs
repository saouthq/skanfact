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
  admin: ['etat', 'stats', 'clients', 'licences', 'activations', 'ventes', 'evenements', 'importer',
    // 10.4.0 — l'espace de gestion : le parc des DEUX applications, les cabinets, ce qui demande une
    // décision, la santé des canaux de mise à jour, et l'export de la base.
    'parc', 'cabinets', 'alertes', 'sante', 'export']
};
// `relance` est la seule sous-action qui se LIT (GET) : elle ne change rien, elle compose le texte
// d'un mail que l'éditeur relira dans sa propre messagerie avant de l'envoyer.
const SOUS_ACTIONS = ['revoquer', 'renouveler', 'changer-offre', 'envoyer', 'payee', 'facturee', 'relance'];
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
// lit pas : ce qu'on veut savoir d'abord, c'est si cette installation vit encore. (L'heure exacte,
// elle, se lit sous la phrase dans la console — les deux questions sont différentes.)
//
// Un jour n'est pas une tranche de 24 heures : sans cette distinction, une application ouverte hier
// à 23 h et regardée ce matin à 8 h se lisait « aujourd'hui ». Ici les deux horodatages viennent du
// serveur, donc les jours se comptent en UTC ; dans la console, ils se comptent dans le fuseau de
// celui qui regarde, parce que c'est SON « aujourd'hui » qui est en question.
export function depuisQuand(iso, maintenant) {
  const da = new Date(String(iso || '')), db = new Date(String(maintenant || ''));
  const a = da.getTime(), b = db.getTime();
  if (isNaN(a) || isNaN(b)) return '';
  const jourUTC = d => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const j = Math.round((jourUTC(db) - jourUTC(da)) / 86400000);
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
    version: VERSION.test(String(c.version || '').trim()) ? String(c.version).trim() : null,
    // 10.4.0 — quelle application s'annonce. Une annonce qui ne le dit pas est une annonce de
    // SkanFact : c'est ce qu'elle était forcément avant que l'app du comptable sache s'annoncer.
    app: Object.prototype.hasOwnProperty.call(APPS, String(c.app || '')) ? String(c.app) : 'entreprise'
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
  // 10.4.0-beta.3 — les essais et les postes se comptent PAR APPLICATION. Avant, « 2 essais en
  // cours » additionnait SkanFact et SkanFact Cabinet : un éditeur qui a les deux sur son Mac
  // lisait « 2 postes SkanFact » et ne pouvait pas savoir combien de comptables l'utilisaient.
  // Deux produits, deux marchés, deux tarifs — les mélanger dans un compteur, c'est la faute de la
  // 7.16.0 (additionner ce qui ne porte pas la même unité) appliquée au parc.
  const ess = { entreprise: n((d.essais || {}).entreprise), cabinet: n((d.essais || {}).cabinet) };
  const pos = { entreprise: n((d.postes || {}).entreprise), cabinet: n((d.postes || {}).cabinet) };
  const vus = n(d.essaisVus);
  const conv = Math.min(n(d.essaisConvertis), vus);
  return {
    clients: n(d.clients),
    licencesActives: n(d.licencesActives),
    licencesExpirees: n(d.licencesExpirees),
    licencesRevoquees: n(d.licencesRevoquees),
    essaisEntreprise: ess.entreprise,
    essaisCabinet: ess.cabinet,
    postesEntreprise: pos.entreprise,
    postesCabinet: pos.cabinet,
    // La conversion : combien d'ordinateurs ont ESSAYÉ, et combien de ceux-là ont fini sous
    // licence. C'est le chiffre d'un produit qu'on vend, et il n'existait nulle part. Il se déduit
    // sans rien demander à personne : un poste qui convertit garde sa ligne d'essai et en gagne
    // une sous sa vraie empreinte.
    essaisVus: vus,
    essaisConvertis: conv,
    // Un taux sans dénominateur vaut `null`, jamais 0 % : « 0 % de conversion » sur zéro essai
    // annonce un échec là où il n'y a pas encore de question (règle 9.6.0).
    tauxConversion: vus ? Math.round((conv / vus) * 100) : null,
    // Ce qu'on ne peut PAS savoir se dit, au lieu d'être inventé : un essai qui n'a jamais eu de
    // réseau n'est nulle part, et le taux de conversion n'a de sens que là-dessus.
    incertain: ess.entreprise + ess.cabinet + pos.entreprise + pos.cabinet === 0
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
    // 9.4.1 — le prix d'UN dossier hors SkanFact, par an, pour une licence de cabinet. Aucun
    // défaut : les prix du Cabinet ne sont pas fixés (l'avis de l'Ordre n'est pas revenu,
    // DIRECTION.md § 8), et un chiffre inventé ici deviendrait un tarif par simple préremplissage.
    // Zéro = « le formulaire ne propose rien, le montant se décide à la main ».
    cabinetDossier: n(env && env.PRIX_CABINET_DOSSIER, 0),
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
// Le NaN est testé AVANT `toISOString`, qui LÈVE sur une date impossible. « 2026-13-99 » passe la
// forme et ne fait pas une date : sans cette garde, un jour tapé de travers dans le champ de date
// libre de la console ne rendait pas un refus, il faisait tomber le worker en 500. Trouvé en
// 10.4.0 par le test du filtre de journal.
export const dateValide = iso => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return false;
  const d = new Date(iso + 'T00:00:00Z');
  return !isNaN(d.getTime()) && isoJour(d) === iso;
};
// Une date est un JOUR DE CALENDRIER, jamais un instant : arithmétique en UTC pur (règle 5.2.3).
// `new Date(y, m, d)` construirait la date en heure locale et la relirait en UTC — à minuit à
// Tunis, ajouter un jour n'en ajouterait aucun, et c'est le défaut qui a gelé l'application
// entière en 5.1.0.
export function ajouterJours(iso, jours) {
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + (Number(jours) || 0));
  return isoJour(d);
}
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

// L'empreinte telle que l'application l'ÉCRIT dans la clé (`licence:emettre` dans main.js) et
// telle que le cabinet la lit dans ses Réglages : cinq groupes de quatre, en majuscules, tirets.
// La base, elle, range la forme nue (vingt hexadécimaux minuscules, `CABINET`) : c'est sur elle
// que les jointures se font, et une seule forme en base évite qu'un même cabinet apparaisse deux
// fois selon la casse du copier-coller.
export const canonEmpreinte = nue => (String(nue || '').toUpperCase().match(/.{4}/g) || []).join('-');

// Une émission (ou un renouvellement, ou un changement d'offre : ce sont les mêmes champs, moins
// ceux que la licence remplacée impose). `depuis` : le jour d'où part la durée.
//
// 9.4.1 — le TYPE. Une licence d'ENTREPRISE porte une offre et un matricule ; une licence de
// CABINET porte un quota de dossiers hors SkanFact, et son sujet est l'EMPREINTE du cabinet — pas
// de matricule, pas d'offre (`offre: 'cabinet'`, pour que la colonne reste renseignée). Les mêmes
// règles que `licence:emettre` dans src/main.js : une empreinte obligatoire, un quota de 1 à 5000.
// Les deux applications refusent la clé de l'autre (9.4.0) : le type est ce qui les sépare.
export function nettoyerEmission(corps, depuis) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const type = c.type === 'cabinet' ? 'cabinet' : 'entreprise';
  const offre = type === 'cabinet' ? 'cabinet' : (OFFRES[c.offre] ? String(c.offre) : '');
  if (!offre) return { ok: false, erreur: 'Choisis une offre : Indépendant ou Entreprise.' };
  const exp = expirationPour(depuis, String(c.duree || ''), c.dateLibre);
  if (exp === null) return { ok: false, erreur: 'La durée est inconnue, ou la date de fin n\'est pas dans le futur.' };
  const prix = Number(c.prix);
  if (!Number.isFinite(prix) || prix < 0) return { ok: false, erreur: 'Le prix HT doit être un nombre positif ou nul.' };
  const remise = c.remise == null || c.remise === '' ? 0 : Number(c.remise);
  if (!Number.isFinite(remise) || remise < 0 || remise > 100) return { ok: false, erreur: 'La remise est un pourcentage entre 0 et 100.' };
  const cabinet = String(c.cabinet || '').toLowerCase().replace(/[\s:._-]/g, '');
  if (cabinet && !CABINET.test(cabinet)) return { ok: false, erreur: 'L\'empreinte du cabinet fait vingt caractères hexadécimaux (cinq groupes de quatre).' };
  let dossiersHors = 0;
  if (type === 'cabinet') {
    if (!cabinet) return { ok: false, erreur: 'Une licence de cabinet est attachée à son EMPREINTE : les vingt caractères que le comptable lit dans SkanFact Cabinet → Réglages → Mon cabinet.' };
    dossiersHors = Math.round(Number(c.dossiersHors));
    if (!Number.isFinite(dossiersHors) || dossiersHors < 1 || dossiersHors > 5000) {
      return { ok: false, erreur: 'Combien de dossiers hors SkanFact cette licence couvre-t-elle, en plus des trois gratuits ? (entre 1 et 5000)' };
    }
  }
  const payeeLe = c.payeeLe ? String(c.payeeLe).trim() : '';
  if (payeeLe && !dateValide(payeeLe)) return { ok: false, erreur: 'La date de paiement n\'est pas une date (AAAA-MM-JJ).' };
  const devise = String(c.devise || 'TND').trim().toUpperCase().slice(0, 3) || 'TND';
  return {
    ok: true,
    e: {
      type, dossiersHors,
      offre, exp, prix: Math.round(prix * 1000) / 1000, remise, devise, cabinet,
      // Ce qui entre dans la CLÉ : la forme que l'application écrit et que le cabinet compare.
      cabinetCanon: cabinet ? canonEmpreinte(cabinet) : '',
      montant: Math.round(prix * (1 - remise / 100) * 1000) / 1000,
      payeeLe, moyen: texteNet(c.moyen, 40)
    }
  };
}

// Ce qu'une licence EST, en un libellé : l'offre d'une entreprise, ou le quota d'un cabinet.
// Partagé par le journal, le mail et la console — deux libellés écrits à deux endroits divergent.
export function libelleLicence(l) {
  const x = l || {};
  if (x.type === 'cabinet') {
    const n = Math.max(0, Number(x.dossiersHors != null ? x.dossiersHors : x.dossiers_hors) || 0);
    return 'Cabinet — ' + n + ' dossier' + (n === 1 ? '' : 's') + ' hors SkanFact';
  }
  return (OFFRES[x.offre] || {}).label || 'Entreprise';
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
  // 9.4.1 — une licence de CABINET émise dans SkanFact garde son type et son quota à l'import :
  // sans eux, la console la montrerait en « Entreprise » et la renouvellerait comme telle.
  const type = c.type === 'cabinet' ? 'cabinet' : 'entreprise';
  const offre = type === 'cabinet' ? 'cabinet' : (OFFRES[c.offre] ? String(c.offre) : 'entreprise');
  const dossiersHors = type === 'cabinet' ? Math.max(0, Math.round(Number(c.dossiersHors) || 0)) : 0;
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
      id, cle, offre, emisLe, exp, type, dossiersHors,
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
    emisLe: String(x.emisLe || ''),
    // 9.4.0 — la licence d'un CABINET. Elle n'a ni offre utile ni matricule : son sujet est
    // l'empreinte du cabinet (champ `cabinet`), et ce qu'elle porte est un quota de dossiers hors
    // SkanFact. Les deux champs sont en QUEUE : ajoutés au milieu, ils changeraient l'ordre des
    // champs déjà signés, et une clé refabriquée depuis sa charge rangée en base ne serait plus
    // identique à celle qu'on a envoyée — or c'est exactement ce qui permet de ne jamais ranger la
    // clé elle-même. L'application ignore ce qu'elle ne connaît pas : un `type` absent vaut
    // `entreprise`, donc rien de ce qui a été vendu ne bouge.
    type: String(x.type || 'entreprise'),
    dossiersHors: Math.max(0, Math.round(Number(x.dossiersHors) || 0))
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
  const fin = x.exp ? ', valable jusqu\'au ' + fmtJour(x.exp) : ', sans limite de durée';
  // 9.4.1 — la clé d'un CABINET se colle dans SkanFact Cabinet, pas dans SkanFact : le chemin
  // d'activation est celui de ses Réglages, et le mail porte le quota au lieu d'une offre. La
  // phrase est celle du gabarit `licenceCabinet` de l'application (un test les compare).
  if (x.type === 'cabinet') {
    const n = Math.max(0, Number(x.dossiersHors) || 0);
    const quota = n + ' dossier' + (n === 1 ? '' : 's') + ' hors SkanFact en plus des trois gratuits';
    return {
      sujet: 'Votre licence SkanFact Cabinet — ' + n + ' dossier' + (n === 1 ? '' : 's'),
      texte: 'Bonjour,\n\n'
        + 'Voici votre clé de licence SkanFact Cabinet (' + quota + fin + ') :\n\n'
        + String(x.cle || '') + '\n\n'
        + 'Pour l\'activer : dans SkanFact Cabinet, ouvrez Réglages → Mon cabinet → Licence, collez la clé en entier (de « SKAN1. » jusqu\'au dernier caractère) et cliquez sur « Enregistrer la clé ». Aucune connexion n\'est nécessaire.\n\n'
        + (x.facture ? 'Votre facture ' + x.facture + ' suit par le même canal.\n\n' : '')
        + 'Merci de votre confiance.\n\n'
        + 'Cordialement,\n' + String(x.signature || 'SkanFact')
    };
  }
  const offre = (OFFRES[x.offre] || {}).label || 'Entreprise';
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

// ======================================================================================
// 10.4.0 — l'espace de gestion des DEUX plateformes
// ======================================================================================
// Jusqu'ici la console ne voyait qu'une des deux applications : SkanFact seule s'annonçait, et
// l'app du comptable — qui porte pourtant sa licence depuis la 9.4.0 et son canal d'essai depuis
// la 9.1.0 — n'existait nulle part. Un éditeur qui ne voit qu'une moitié de son parc ne le
// contrôle pas : il le constate après coup.

// Quelle application s'annonce. NULL en base = tout ce qui a été noté avant la 10.4.0, c'est-à-dire
// l'app entreprise, seule à s'annoncer alors. Une colonne s'AJOUTE, aucune ne se renomme : même
// compatibilité que `type` sur les licences (9.4.1).
export const APPS = { entreprise: 'SkanFact', cabinet: 'SkanFact Cabinet' };
export const appDe = v => (Object.prototype.hasOwnProperty.call(APPS, String(v || '')) ? String(v) : 'entreprise');

// ---------- la santé des canaux de mise à jour ----------
// Le relais est un AUTRE worker : la console ne peut pas deviner ce qu'il sert, et elle ne
// l'invente pas. Non branché, elle le DIT — « 7 pièces vérifiées, intactes » est la seule
// affirmation qu'on s'autorise quand on peut la prouver (Cabinet 1.0.0).
export function verdictCanaux(canaux) {
  const l = Array.isArray(canaux) ? canaux : [];
  // On ne juge que ce que le projet PUBLIE (`attendus` du relais). Sans ce filtre, les index
  // `-linux.yml` — permis par le relais, produits par aucune construction — étaient comptés muets
  // pour toujours : un orange qui ne s'éteint jamais apprend à ignorer la barre (8.0.1).
  // `!== false` et non `=== true` : un relais d'AVANT la 10.4.1 n'envoie pas ce champ, et on
  // préfère qu'il juge trop que de se taire — un instrument muet annonce que tout va bien (9.8.8).
  const stables = l.filter(c => !c.essai && c.attendu !== false);
  const muets = stables.filter(c => !c.servi).map(c => c.fichier);
  // Un index STABLE servi par une PRÉVERSION : c'est le défaut de la 9.8.8, celui qui a proposé une
  // bêta à toutes les installations stables. Le relais le refuse désormais, donc ceci ne devrait
  // jamais se voir — et c'est exactement pour ça qu'on le regarde.
  const melanges = stables.filter(c => c.servi && c.prerelease).map(c => c.fichier);
  if (melanges.length) return { niveau: 'alerte', phrase: 'Un index stable est servi par une préversion : ' + melanges.join(', ') + '.' };
  if (muets.length === stables.length && stables.length) return { niveau: 'alerte', phrase: 'Aucun canal stable ne sert de version : une mise à jour est impossible pour tout le monde.' };
  if (muets.length) return { niveau: 'attention', phrase: pl2(muets.length, 'canal stable muet', 'canaux stables muets') + ' : ' + muets.join(', ') + '.' };
  return { niveau: 'calme', phrase: 'Les ' + stables.length + ' canaux stables servent une version.' };
}
const pl2 = (n, s, p) => n + ' ' + (n >= 2 ? p : s);

export async function santeCanaux(env) {
  const e = env || {};
  const base = String(e.RELAIS_BASE || '').trim().replace(/\/+$/, '');
  const secret = String(e.RELAIS_SECRET || '').trim();
  if (!base || !secret) {
    return { ok: false, canaux: [],
      raison: 'Le relais de mise à jour n\'est pas branché sur cette console (réglages « RELAIS_BASE » et « RELAIS_SECRET »). Ce que chaque canal sert ne peut pas être lu d\'ici.' };
  }
  let r;
  try { r = await fetch(base + '/sante', { headers: { 'X-SkanFact-App': secret } }); }
  catch (err) { return { ok: false, canaux: [], raison: 'Le relais ne répond pas : ' + ((err && err.message) || err) }; }
  if (!r.ok) return { ok: false, canaux: [], raison: 'Le relais a répondu ' + r.status + (r.status === 403 ? ' : « RELAIS_SECRET » ne correspond pas à son « APP_SECRET ».' : '.') };
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  const canaux = (j && Array.isArray(j.canaux)) ? j.canaux : [];
  return { ok: true, canaux, verdict: verdictCanaux(canaux) };
}

// ---------- l'argent ----------
// La question qu'un éditeur se pose en ouvrant sa console : combien ai-je encaissé, et combien
// m'attend ? Elle n'avait de réponse nulle part — les ventes se lisent ligne par ligne, et aucun
// total ne les résumait.
//
// Un agrégat de montants porte une DEVISE (7.0.1, 7.16.0) : on groupe, on n'additionne jamais des
// dinars avec des euros. Et la période est NOMMÉE (3.1.0) : « encaissé » sans son année ne veut
// rien dire. « En attente » n'en porte pas — une vente de l'an dernier qui n'est pas payée attend
// toujours, et c'est justement celle-là qu'on veut voir.
export function resumeArgent(ventes, aujourdhui) {
  const annee = String(aujourdhui || '').slice(0, 4);
  const par = new Map();
  (ventes || []).forEach(v => {
    const devise = String(v.devise || 'DT').trim() || 'DT';
    let g = par.get(devise);
    if (!g) { g = { devise, encaisse: 0, attente: 0, nbEncaisse: 0, nbAttente: 0 }; par.set(devise, g); }
    const montant = Number(v.montant_ht) || 0;
    const paye = String(v.payee_le || '').slice(0, 10);
    if (paye) { if (paye.slice(0, 4) === annee) { g.encaisse += montant; g.nbEncaisse++; } }
    else { g.attente += montant; g.nbAttente++; }
  });
  const r3 = x => Math.round(x * 1000) / 1000;
  return {
    annee,
    lignes: [...par.values()]
      .map(g => ({ ...g, encaisse: r3(g.encaisse), attente: r3(g.attente) }))
      .filter(g => g.nbEncaisse || g.nbAttente)
      .sort((a, b) => (b.encaisse + b.attente) - (a.encaisse + a.attente))
  };
}

// ---------- le parc ----------
// Cinq cents lignes brutes ne répondent pas à la seule question qu'on se pose avant de publier un
// correctif : combien de postes sont restés sur une version d'il y a six mois ? On groupe par
// application et par version.
//
// « Endormi » n'est pas « perdu » : une installation qu'on n'a pas vue depuis trente jours peut
// être un portable refermé pour les vacances. On la compte À PART, on ne la retranche pas — et la
// nuance est ce qui distingue un parc qui rétrécit d'un mois d'août.
export const PARC_FRAIS = 30;

// Comparer deux numéros de version. `10.3.0` est plus récent que `9.8.8`, ce qu'un tri de chaînes
// dit exactement à l'envers ; et une préversion passe AVANT la version qu'elle prépare
// (`10.4.0-beta.1` < `10.4.0`), comme partout ailleurs dans ce projet.
export function compVersion(a, b) {
  const d = s => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-(.*))?$/.exec(String(s || '').trim());
    return m ? { n: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] || '' } : null;
  };
  const x = d(a), y = d(b);
  if (!x || !y) return x ? -1 : (y ? 1 : 0);
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] - y.n[i];
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

export function resumeParc(lignes, aujourdhui) {
  const jour = String(aujourdhui || '').slice(0, 10);
  const par = new Map();
  (lignes || []).forEach(l => {
    const app = appDe(l.app);
    const version = VERSION.test(String(l.version || '').trim()) ? String(l.version).trim() : '';
    const cle = app + '\u0000' + version;
    let g = par.get(cle);
    if (!g) {
      g = {
        id: cle, app, appNom: APPS[app], version,
        // Une préversion se reconnaît à son numéro, et à lui seul — c'est la règle du projet
        // depuis la 7.25.0, et c'est ce qui rend « combien de postes tournent une bêta ? »
        // répondable sans qu'aucune application n'ait à déclarer son canal.
        essai: version.includes('-'),
        postes: 0, vus: 0, endormis: 0, darwin: 0, win32: 0, linux: 0,
        licences: 0, enEssai: 0, dernier: ''
      };
      par.set(cle, g);
    }
    g.postes++;
    const vu = String(l.derniere_fois || '').slice(0, 10);
    if (vu && dateValide(jour) && dateValide(vu) && joursEntre(vu, jour) <= PARC_FRAIS) g.vus++;
    else g.endormis++;
    if (PLATEFORMES.includes(String(l.plateforme || ''))) g[String(l.plateforme)]++;
    if (String(l.empreinte || '') === ESSAI) g.enEssai++; else g.licences++;
    if (String(l.derniere_fois || '') > g.dernier) g.dernier = String(l.derniere_fois || '');
  });
  return [...par.values()].sort((a, b) =>
    (a.app === b.app ? compVersion(b.version, a.version) : (a.app < b.app ? -1 : 1)));
}

// ---------- ce qui demande une décision ----------
// Le pendant de « À faire » dans l'application (7.0.0) : un tableau de bord qui n'affiche que des
// compteurs laisse l'éditeur chercher lui-même ce qui cloche. Chaque ligne nomme son sujet et
// l'onglet où le régler — une alerte qu'on ne peut pas ouvrir est une inquiétude, pas une tâche.
//
// Trié par urgence, jamais par ordre d'écriture : la promesse « trié par urgence » tenue par rien
// est le défaut de `todoList` avant la 7.0.0.
export const ALERTE_FIN = 30;        // jours avant la fin d'une licence
export const ALERTE_EXPORT = 30;     // jours sans export de la base
// L'essai dure trente jours et c'est la règle de l'application (8.0.0). Le chiffre est ÉCRIT ici
// plutôt que deviné, et il doit rester d'accord avec `src/licence.js` : un test le confronte.
export const ESSAI_JOURS = 30;
export const ALERTE_ESSAI = 7;       // jours avant la fin d'un essai : c'est là qu'on décroche
const NIVEAUX = { alerte: 0, attention: 1, calme: 2 };

export function alertesPlateforme(d, aujourdhui) {
  const o = d || {};
  const jour = String(aujourdhui || '').slice(0, 10);
  const out = [];
  const add = (niveau, quoi, sujet, detail, onglet, id) => out.push({ id: id || (quoi + ':' + sujet), niveau, quoi, sujet, detail, onglet });

  (o.licences || []).forEach(l => {
    const nom = l.client || l.id;
    // Une clé jamais envoyée est une vente livrée à personne : le client a payé et attend.
    if (!l.envoyee_le && !l.revoquee_le && !l.remplacee_par) {
      add('alerte', 'Clé jamais envoyée', nom, 'La licence est signée et n\'est jamais partie.', 'licences', 'env:' + l.id);
    }
    if (l.revoquee_le || l.remplacee_par || !l.fin) return;
    const reste = dateValide(jour) && dateValide(l.fin) ? joursEntre(jour, l.fin) : null;
    if (reste === null) return;
    if (reste < 0) add('attention', 'Licence expirée', nom, 'Finie le ' + l.fin + '. Un renouvellement se propose, il ne se devine pas.', 'licences', 'exp:' + l.id);
    else if (reste <= ALERTE_FIN) add('attention', 'Licence qui se termine', nom, 'Fin le ' + l.fin + ' (' + reste + ' jour' + (reste === 1 ? '' : 's') + ').', 'licences', 'fin:' + l.id);
  });

  (o.ventes || []).forEach(v => {
    if (v.payee_le) return;
    add('attention', 'Vente à encaisser', v.client || v.id, 'Licence livrée, rien d\'encaissé.', 'ventes', 'pay:' + v.id);
  });

  // Un ESSAI qui se termine est un client à appeler — c'est le seul signal commercial de cette
  // console, et il n'existait nulle part : `alertesPlateforme` ne regardait que les licences, les
  // ventes et la copie de la base. Un essai qui finit sans qu'on ait décroché son téléphone est une
  // vente qu'on ne fera pas.
  //
  // Ce que la plateforme SAIT : la première fois qu'elle a vu ce poste. Ce qu'elle ne sait PAS : le
  // jour où l'essai a vraiment commencé — il se compte sur la machine, et une installation restée
  // trois semaines hors ligne s'annonce trois semaines trop tard. La date est donc APPROCHÉE, et le
  // dit (« vers le »). Prétendre une précision qu'on n'a pas, c'est ce que cette application
  // s'interdit depuis « 7 pièces vérifiées, intactes » (Cabinet 1.0.0). Une version future des
  // applications pourrait envoyer sa vraie date de fin ; d'ici là, une estimation à quelques jours
  // reste parfaitement actionnable — on appelle un client, on ne lui facture pas une échéance.
  (o.essais || []).forEach(a => {
    const debut = String(a.premiere_fois || '').slice(0, 10);
    if (!dateValide(jour) || !dateValide(debut)) return;
    const fin = ajouterJours(debut, ESSAI_JOURS);
    const reste = joursEntre(jour, fin);
    if (reste > ALERTE_ESSAI) return;
    const qui = String(a.device_nom || a.device_id || 'un ordinateur');
    const quoi = APPS[appDe(a.app)] || APPS.entreprise;
    const id = 'essai:' + String(a.device_id || '') + ':' + appDe(a.app);
    if (reste < 0) {
      add('attention', 'Essai terminé', qui,
        quoi + ' — essai commencé vers le ' + debut + ', fini vers le ' + fin + '. Personne n’a acheté.', 'parc', id);
    } else {
      add('alerte', 'Essai qui se termine', qui,
        quoi + ' — il reste ' + reste + ' jour' + (reste === 1 ? '' : 's') + ' (vers le ' + fin + '). C’est maintenant qu’on appelle.', 'parc', id);
    }
  });

  // L'export de la base : la seule chose dont la disparition ne se rattrape pas. Sans lui, une base
  // perdue emporte QUI a acheté QUOI — et aucune clé vendue ne peut plus être réémise ni révoquée.
  //
  // Mais on vérifie d'abord que l'univers concerné n'est pas VIDE (7.0.0) : une console où rien
  // n'a encore été vendu n'a rien à perdre, et réclamer une copie du néant au premier écran d'un
  // logiciel qu'on vient d'installer apprend à ignorer les alertes.
  const aPerdre = (o.licences || []).length > 0 || (o.ventes || []).length > 0;
  const exp = String(o.dernierExport || '').slice(0, 10);
  if (aPerdre && !exp) add('alerte', 'La base n\'a jamais été exportée', 'Plateforme', 'Un export range la base entière dans ~/.skanfact/. Sans lui, une base perdue emporte toutes les ventes.', 'parc', 'exp:base');
  else if (aPerdre && dateValide(jour) && dateValide(exp) && joursEntre(exp, jour) > ALERTE_EXPORT) {
    add('attention', 'Export de la base ancien', 'Plateforme', 'Dernier export le ' + exp + '.', 'parc', 'exp:base');
  }

  return out.sort((a, b) => (NIVEAUX[a.niveau] - NIVEAUX[b.niveau]) || (a.quoi < b.quoi ? -1 : a.quoi > b.quoi ? 1 : 0));
}

// ---------- écrire à un client ----------
// Relancer était le seul geste commercial que la console ne savait pas faire : elle signe, elle
// envoie la clé, elle encaisse — et devant « licence qui se termine dans douze jours » ou « vente
// livrée, rien d'encaissé », il n'y avait rien à cliquer. Un écran qui NOMME une échéance doit
// porter le geste qui va avec (7.15.0).
//
// La console n'ENVOIE pas cette relance : elle l'OUVRE dans la messagerie de l'éditeur (`mailto:`).
// Resend ne sert qu'à la clé, parce que c'est un envoi qui suit un paiement et ne se discute pas ;
// une relance, elle, se relit toujours avant de partir — et son ton dépend du client. C'est le
// même choix que `mail:compose` dans les deux applications depuis la 1.5.0.
//
// Aucune phrase n'invente un fait : tout ce qui est écrit vient de la ligne (le nom, l'offre, la
// date de fin, le montant et sa devise), et ce qui manque disparaît de la phrase au lieu d'être
// remplacé par un vide ou par un zéro.
export function mailRelance(type, d) {
  const o = d || {};
  const nom = String(o.client || '').trim();
  // Le client lit une date française, pas un format de fichier : « 14/10/2026 ». Une date ISO dans
  // un mail commercial donne l'impression d'un envoi automatique — ce que ce mail n'est pas.
  const fi = String(o.fin || '');
  const fin = dateValide(fi) ? fi.slice(8, 10) + '/' + fi.slice(5, 7) + '/' + fi.slice(0, 4) : '';
  const off = String(o.offre || '').trim();
  const mt = o.montant != null && o.montant !== '' && !isNaN(Number(o.montant))
    ? Number(o.montant).toFixed(3).replace('.', ',') + (o.devise ? ' ' + String(o.devise) : '') : '';
  const lignes = [nom ? 'Bonjour ' + nom + ',' : 'Bonjour,', ''];

  if (type === 'fin') {
    lignes.push('Votre licence SkanFact' + (off ? ' (' + off + ')' : '')
      + (fin ? ' se termine le ' + fin + '.' : ' arrive à son terme.'));
    lignes.push('');
    lignes.push('Je peux la renouveler dès maintenant : la nouvelle clé part du jour où l’actuelle se termine, vous ne perdez donc aucun jour.');
    lignes.push('Vos données restent lisibles, imprimables et exportables quoi qu’il arrive — seule la création de nouvelles pièces attend la clé.');
  } else if (type === 'expiree') {
    lignes.push('Votre licence SkanFact' + (off ? ' (' + off + ')' : '')
      + (fin ? ' s’est terminée le ' + fin + '.' : ' est arrivée à son terme.'));
    lignes.push('');
    lignes.push('Vos données sont intactes : tout reste lisible, imprimable et exportable. Seule la création de nouvelles pièces attend le renouvellement.');
    lignes.push('Dites-moi si je vous prépare la nouvelle clé.');
  } else if (type === 'impayee') {
    lignes.push('Je reviens vers vous au sujet de votre licence SkanFact'
      + (off ? ' (' + off + ')' : '') + (mt ? ', d’un montant de ' + mt + ' HT' : '') + '.');
    lignes.push('');
    lignes.push('Le règlement ne m’est pas encore parvenu. Si c’est déjà parti de votre côté, ne tenez pas compte de ce message.');
  } else {
    lignes.push('Je me permets de revenir vers vous au sujet de SkanFact.');
  }

  lignes.push('', 'Bien cordialement,', 'Skander Ben Amor — SkanFact');
  const sujets = {
    fin: 'Votre licence SkanFact' + (fin ? ' se termine le ' + fin : ' arrive à son terme'),
    expiree: 'Votre licence SkanFact est arrivée à son terme',
    impayee: 'Votre licence SkanFact — règlement'
  };
  return {
    a: String(o.email || '').trim(),
    sujet: sujets[type] || 'SkanFact',
    corps: lignes.join('\n')
  };
}

// Combien de sujets on ÉNUMÈRE avant de compter le reste. Trois, pour la raison de la Cabinet
// 1.0.0 : « un objet de mail qui énumère onze mois n'est plus lu ». Au-delà, le nombre apprend
// plus que la liste.
export const ALERTES_NOMMEES = 3;

// Grouper les alertes pour l'écran. Mesuré avant d'y toucher : la colonne « Pourquoi ça compte »
// imprimait jusqu'à CINQ fois « La licence est signée et n'est jamais partie. » — et à la
// troisième, on ne lit plus la colonne du tout. Une explication se lit une fois (9.4.6).
//
// La clé du groupe inclut le DÉTAIL, et c'est tout l'intérêt : une explication qui décrit la RÈGLE
// est la même sur chaque occurrence et se replie ; une qui nomme un FAIT — « Finie le 2026-09-01 »,
// « Dernier export le 2026-08-30 » — diffère d'une ligne à l'autre et reste sur sa ligne. On ne
// fusionne donc jamais deux informations différentes sous prétexte qu'elles portent le même titre.
export function grouperAlertes(lignes, nommees) {
  const max = Number.isInteger(nommees) && nommees > 0 ? nommees : ALERTES_NOMMEES;
  const ordre = [];
  const par = new Map();
  (lignes || []).forEach(a => {
    const cle = [a.niveau, a.quoi, a.detail, a.onglet].join('\u0000');
    if (!par.has(cle)) {
      par.set(cle, { id: cle, niveau: a.niveau, quoi: a.quoi, detail: a.detail, onglet: a.onglet, n: 0, tous: [], ids: [] });
      ordre.push(cle);
    }
    const g = par.get(cle);
    g.n += 1;
    // Rien ne se perd dans un repli : le groupe garde l'identifiant de CHACUN de ses membres. Sans
    // eux, replier reviendrait à jeter ce qui permettra un jour d'agir sur une alerte précise.
    if (a.id) g.ids.push(a.id);
    // Le même client deux fois sous la même alerte ne se nomme qu'une fois : on compte les
    // occurrences, on n'écrit pas deux fois son nom.
    if (a.sujet && g.tous.indexOf(a.sujet) < 0) g.tous.push(a.sujet);
  });
  return ordre.map(cle => {
    const g = par.get(cle);
    const reste = g.tous.length - max;
    g.sujets = reste > 0
      ? g.tous.slice(0, max).join(', ') + ' et ' + reste + ' autre' + (reste === 1 ? '' : 's')
      : g.tous.join(', ');
    return g;
  });
}

// ---------- l'export de la base ----------
// Décidé avant la première vente (QUESTIONS.md, 4e relecture). Ce n'est pas une sauvegarde de
// confort : D1 est le SEUL endroit où vit la correspondance « qui a acheté quelle clé ». Le
// contenu signé (`charge`) en fait partie — c'est lui qui permet de refabriquer une clé à
// l'identique (8.5.0), donc de la renvoyer à un client qui a perdu la sienne.
//
// L'enveloppe porte un COMPTE par table : un export tronqué qui ressemble à un export complet est
// pire qu'un export absent, et c'est ce compte qui le dit au moment de le relire.
// La liste est celle du cahier (SPEC-API-011), `jetons` compris : une table qu'on laisse en dehors
// d'un export est une table perdue le jour où l'on restaure, et personne ne s'en aperçoit avant.
export const EXPORT_TABLES = ['clients', 'licences', 'activations', 'ventes', 'jetons', 'evenements'];
export function enveloppeExport(tables, quand) {
  const t = tables || {};
  const comptes = {};
  const contenu = {};
  EXPORT_TABLES.forEach(nom => {
    const lignes = Array.isArray(t[nom]) ? t[nom] : [];
    contenu[nom] = lignes;
    comptes[nom] = lignes.length;
  });
  return { v: 1, quoi: 'skanfact-console', quand: String(quand || ''), comptes, tables: contenu };
}

// ---------- le journal, filtrable ----------
// Cinq cents dernières lignes sans filtre, ce n'est pas une piste d'audit : c'est un flux. La
// question d'un auditeur porte toujours sur UN client, UNE licence ou UNE période.
export function clauseJournal(params) {
  const p = params || {};
  const ou = [], args = [];
  const lire = k => (typeof p.get === 'function' ? p.get(k) : p[k]);
  const client = texteNet(lire('client'), 64);
  const licence = texteNet(lire('licence'), 64);
  const quoi = texteNet(lire('quoi'), 64);
  const depuis = String(lire('depuis') || '').trim();
  if (client && SEGMENT.test(client)) { ou.push('e.client_id = ?'); args.push(client); }
  if (licence && SEGMENT.test(licence)) { ou.push('e.licence_id = ?'); args.push(licence); }
  if (quoi && /^[a-z.]{1,64}$/.test(quoi)) { ou.push('e.quoi = ?'); args.push(quoi); }
  if (dateValide(depuis)) { ou.push('e.quand >= ?'); args.push(depuis); }
  return { where: ou.length ? ' WHERE ' + ou.join(' AND ') : '', args };
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
    'INSERT INTO activations (id, licence_id, empreinte, device_id, device_nom, plateforme, version, app, premiere_fois, derniere_fois)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' +
    // La cible du conflit doit correspondre à l'index EXACTEMENT, expression comprise
    // (schema.sql) : une cible qui ne correspond à aucun index unique fait échouer l'écriture.
    ' ON CONFLICT(empreinte, device_id, COALESCE(app, \'entreprise\')) DO UPDATE SET' +
    '   device_nom = excluded.device_nom, plateforme = excluded.plateforme,' +
    '   version = excluded.version, app = excluded.app, derniere_fois = excluded.derniere_fois'
  ).bind(
    // L'identifiant porte les MÊMES trois termes que la clé d'unicité. Sans l'application, deux
    // applications sur un poste se battent pour la même clé PRIMAIRE : la seconde écriture est
    // refusée par la base, `sansCasser` avale le refus, et le Cabinet n'apparaît JAMAIS dans le
    // parc — sans une ligne nulle part. C'est le défaut que cette version corrige, une couche plus
    // bas que l'index, et l'index seul ne le voyait pas.
    //
    // Une ligne d'AVANT la 10.4.0 porte l'ancienne forme (sans suffixe) : l'insertion ne heurte
    // donc pas sa clé primaire, elle heurte l'index unique, et c'est le DO UPDATE qui la met à
    // jour — elle garde son identifiant, ce qu'elle doit.
    empreinte.slice(0, 12) + '_' + a.deviceId.slice(0, 12) + '_' + appDe(a.app),
    licenceId, empreinte,
    a.deviceId, a.deviceNom, a.plateforme, a.version, appDe(a.app), maintenant, maintenant
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
    // 9.4.1 — le type et le quota (NULL sur tout ce qui a été émis avant : une entreprise).
    ' COALESCE(l.type, \'entreprise\') AS type, l.dossiers_hors,' +
    ' l.charge IS NOT NULL AS resignable, c.nom AS client, c.matricule, c.email,' +
    ' (SELECT r2.id FROM licences r2 WHERE r2.remplace_id = l.id LIMIT 1) AS remplacee_par,' +
    ' (SELECT COUNT(*) FROM activations a2 WHERE a2.licence_id = l.id) AS activations,' +
    // Pour un cabinet : combien de ses clients ont une licence d'entreprise parrainée par lui — la
    // preuve, côté éditeur, que ce cabinet amène du monde (et ce qui, un jour, décidera d'une remise).
    ' (SELECT COUNT(*) FROM licences p WHERE COALESCE(l.type, \'entreprise\') = \'cabinet\' AND p.cabinet_empreinte = l.cabinet_empreinte' +
    '   AND COALESCE(p.type, \'entreprise\') = \'entreprise\' AND p.revoquee_le IS NULL) AS parraines' +
    ' FROM licences l LEFT JOIN clients c ON c.id = l.client_id';

  if (request.method === 'GET') {
    if (r.action === 'stats') {
      // La MÊME fenêtre que celle du Parc et des alertes (`PARC_FRAIS`) : un 30 écrit ici et un
      // PARC_FRAIS écrit là-bas diraient la même chose jusqu'au jour où l'un des deux change.
      const recent = new Date(Date.now() - PARC_FRAIS * 86400000).toISOString();
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
      // Par APPLICATION : `COALESCE` range les lignes d'avant la 10.4.0 du côté de l'entreprise,
      // qui était seule à s'annoncer — les compter à part inventerait une troisième application.
      const parApp = l2 => {
        const o = { entreprise: 0, cabinet: 0 };
        (l2 || []).forEach(x => { if (o[x.app] !== undefined) o[x.app] = Number(x.n) || 0; });
        return o;
      };
      const e = parApp(await tous(
        'SELECT COALESCE(app, \'entreprise\') AS app, COUNT(*) AS n FROM activations' +
        ' WHERE empreinte = ? AND derniere_fois >= ? GROUP BY 1', ESSAI, recent));
      const p = parApp(await tous(
        'SELECT COALESCE(app, \'entreprise\') AS app, COUNT(*) AS n FROM activations' +
        ' WHERE empreinte <> ? GROUP BY 1', ESSAI));
      // La conversion se compte par ORDINATEUR, jamais par ligne : un poste qui passe de l'essai à
      // la licence garde sa ligne d'essai et en gagne une autre — compter les lignes le compterait
      // deux fois, et un taux de conversion au-dessus de 100 % ne veut rien dire.
      const ev = (await un('SELECT COUNT(DISTINCT device_id) AS n FROM activations WHERE empreinte = ?', ESSAI)) || {};
      const ec = (await un(
        'SELECT COUNT(DISTINCT device_id) AS n FROM activations WHERE empreinte <> ?' +
        ' AND device_id IN (SELECT device_id FROM activations WHERE empreinte = ?)', ESSAI, ESSAI)) || {};
      // Les compteurs gardent leur forme (`resumeStats`, dont un test fixe les champs) ; l'argent
      // vient à côté, parce qu'un montant n'est pas un compteur : il porte une devise.
      const vs = await tous('SELECT montant_ht, devise, payee_le FROM ventes');
      return json({ ...resumeStats({
        clients: c.n,
        licencesActives: l.actives,
        licencesExpirees: l.expirees,
        licencesRevoquees: l.revoquees,
        essais: e,
        postes: p,
        essaisVus: ev.n,
        essaisConvertis: ec.n
      }), argent: resumeArgent(vs, aujourdhui) });
    }
    if (r.action === 'clients') {
      return json({ lignes: await tous('SELECT id, nom, matricule, email, tel, adresse, notes, cree_le FROM clients ORDER BY cree_le DESC LIMIT 500') });
    }
    // La relance : le texte, pas l'envoi. C'est le SERVEUR qui décide de quoi on relance — il lit
    // les dates, et il les lit avec la MÊME règle que l'alerte qui a fait cliquer (`ALERTE_FIN`).
    // Deux règles, l'une pour l'alerte et l'autre pour le mail, finiraient par se contredire : on
    // relancerait « votre licence se termine » sur une licence déjà terminée.
    if (r.sous === 'relance' && r.id && (r.action === 'licences' || r.action === 'ventes')) {
      if (r.action === 'licences') {
        const l = await un(SEL_LICENCE + ' WHERE l.id = ?', r.id);
        if (!l) return json({ erreur: 'Licence introuvable.' }, 404);
        const finie = l.fin && l.fin < aujourdhui;
        return json({ ...mailRelance(finie ? 'expiree' : 'fin', {
          client: l.client, email: l.email, offre: libelleLicence(l), fin: l.fin
        }), client: l.client });
      }
      const v = await un('SELECT v.*, c.nom AS client, c.email, l.offre, l.type, l.dossiers_hors'
        + ' FROM ventes v LEFT JOIN clients c ON c.id = v.client_id'
        + ' LEFT JOIN licences l ON l.id = v.licence_id WHERE v.id = ?', r.id);
      if (!v) return json({ erreur: 'Vente introuvable.' }, 404);
      if (v.payee_le) return json({ erreur: 'Cette vente est payée depuis le ' + v.payee_le + ' : il n\'y a rien à relancer.' }, 409);
      return json({ ...mailRelance('impayee', {
        client: v.client, email: v.email, offre: v.offre ? libelleLicence(v) : '',
        montant: v.montant_ht, devise: v.devise
      }), client: v.client });
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
      const lignes = await tous(
        'SELECT a.empreinte, a.device_id, a.device_nom, a.plateforme, a.version, a.app,' +
        ' a.premiere_fois, a.derniere_fois, c.nom AS client' +
        ' FROM activations a LEFT JOIN licences l ON l.id = a.licence_id' +
        ' LEFT JOIN clients c ON c.id = l.client_id' +
        ' ORDER BY a.derniere_fois DESC LIMIT 500');
      // Le NOM de l'application se calcule ICI, comme sur le Parc, et il part avec la ligne : la
      // console AFFICHE, elle ne retraduit pas. Une seconde table de noms dans la page divergerait
      // de celle-ci au premier renommage — et `APPS` n'existe de toute façon pas dans la page.
      return json({ lignes: lignes.map(l => ({ ...l, appNom: APPS[appDe(l.app)] })) });
    }
    if (r.action === 'ventes') {
      // `?non_facturees=1` : le pont comptable (§ 11). SkanFact TIRE les ventes qui n'ont pas encore
      // de facture, et reçoit avec chacune la clé (refabriquée) pour tenir son miroir local — un
      // serveur ne peut pas écrire dans un logiciel de bureau éteint, c'est lui qui vient chercher.
      const nonFacturees = new URL(request.url).searchParams.get('non_facturees') === '1';
      const lignes = await tous(
        'SELECT v.id, v.client_id, v.licence_id, v.montant_ht, v.tva, v.devise, v.payee_le, v.moyen, v.facture_skanfact, v.importee_le,' +
        ' c.nom AS client, c.matricule, c.email, l.offre, l.fin, l.debut, l.kid, l.emise_le, l.prix, l.remise, l.cabinet_empreinte, l.envoyee_le, l.revoquee_le,' +
        ' COALESCE(l.type, \'entreprise\') AS type, l.dossiers_hors,' +
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
      // Filtrable : la question d'un auditeur porte toujours sur UN client, UNE licence, UN geste
      // ou UNE période — jamais sur « les cinq cents dernières lignes ».
      const f = clauseJournal(new URL(request.url).searchParams);
      return json({ lignes: await tous(
        'SELECT e.id, e.quand, e.quoi, e.client_id, e.licence_id, e.detail, e.par_qui, c.nom AS client' +
        ' FROM evenements e LEFT JOIN clients c ON c.id = e.client_id' + f.where +
        ' ORDER BY e.id DESC LIMIT 500', ...f.args) });
    }

    // ----- 10.4.0 : l'espace de gestion -----
    if (r.action === 'parc') {
      const lignes = await tous(
        'SELECT a.empreinte, a.plateforme, a.version, a.derniere_fois, COALESCE(a.app, \'entreprise\') AS app' +
        ' FROM activations a');
      return json({ lignes: resumeParc(lignes, aujourdhui) });
    }

    if (r.action === 'cabinets') {
      // Un cabinet par ligne : sa licence, son quota, et combien de ses clients ont une licence
      // parrainée par lui. C'est la moitié de l'activité que la console ne montrait nulle part.
      return json({ lignes: await tous(
        'SELECT l.id, l.empreinte, l.cabinet_empreinte, l.debut, l.fin, l.dossiers_hors, l.revoquee_le, l.envoyee_le,' +
        ' l.prix, l.devise, c.nom AS client, c.email,' +
        ' (SELECT COUNT(*) FROM licences p WHERE p.cabinet_empreinte = l.cabinet_empreinte' +
        '   AND COALESCE(p.type, \'entreprise\') = \'entreprise\' AND p.revoquee_le IS NULL) AS parraines,' +
        ' (SELECT COUNT(*) FROM activations a WHERE a.licence_id = l.id) AS postes,' +
        ' (SELECT MAX(a.derniere_fois) FROM activations a WHERE a.licence_id = l.id) AS vu' +
        ' FROM licences l LEFT JOIN clients c ON c.id = l.client_id' +
        ' WHERE COALESCE(l.type, \'entreprise\') = \'cabinet\'' +
        ' ORDER BY l.emise_le DESC LIMIT 500') });
    }

    if (r.action === 'alertes') {
      const licences = await tous(SEL_LICENCE + ' ORDER BY l.emise_le DESC LIMIT 500');
      const ventes = await tous(
        'SELECT v.id, v.payee_le, c.nom AS client FROM ventes v LEFT JOIN clients c ON c.id = v.client_id' +
        ' ORDER BY v.rowid DESC LIMIT 500');
      const ex = await un('SELECT quand FROM evenements WHERE quoi = ? ORDER BY id DESC LIMIT 1', 'base.exportee');
      // Les essais EN COURS seulement : un poste qu'on n'a pas vu depuis des mois a désinstallé ou
      // changé de machine, et le relancer sur un essai mort ne mène nulle part.
      const essais = await tous(
        'SELECT device_id, device_nom, app, premiere_fois FROM activations' +
        ' WHERE empreinte = ? AND derniere_fois >= ? ORDER BY premiere_fois LIMIT 500',
        ESSAI, new Date(Date.now() - PARC_FRAIS * 86400000).toISOString());
      return json({ lignes: grouperAlertes(alertesPlateforme({ licences, ventes, essais, dernierExport: ex && ex.quand }, aujourdhui)) });
    }

    if (r.action === 'sante') return json(await santeCanaux(env));

    if (r.action === 'export') {
      const tables = {};
      for (const nom of EXPORT_TABLES) tables[nom] = await tous('SELECT * FROM ' + nom);
      const env1 = enveloppeExport(tables, maintenant);
      // L'empreinte porte sur les octets exacts qu'on rend — la même règle que la signature d'un
      // manifeste (9.2.0) : re-sérialiser pour empreindre, c'est empreindre autre chose.
      const texte = JSON.stringify(env1);
      const somme = hex(await crypto.subtle.digest('SHA-256', enc.encode(texte)));
      await journaliser(env, 'base.exportee', { detail: EXPORT_TABLES.map(t => t + ' ' + env1.comptes[t]).join(', ') });
      return new Response(JSON.stringify({ ...env1, sha256: somme }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="skanfact-console-' + aujourdhui + '.json"'
        }
      });
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
      // Le type et l'empreinte de la licence en cours ne se choisissent pas ici : une licence de
      // cabinet reste une licence de cabinet, pour le même cabinet. Seul le quota peut bouger.
      const cab = l.type === 'cabinet';
      if (r.sous === 'renouveler') {
        // Un renouvellement part de la FIN de la licence en cours quand elle est encore future : les
        // trente jours de préavis sont payés (règle 8.2.0). La remise de parrainage repart à zéro.
        const depart = l.fin && l.fin > aujourdhui ? l.fin : aujourdhui;
        n = nettoyerEmission({ ...corps, type: l.type, offre: l.offre, remise: corps.remise == null ? 0 : corps.remise, cabinet: l.cabinet_empreinte || '',
          // Le quota se garde tel quel, sauf si le formulaire en propose un autre.
          dossiersHors: cab ? (corps.dossiersHors == null || corps.dossiersHors === '' ? l.dossiers_hors : corps.dossiersHors) : 0 }, depart);
        if (!n.ok) return json({ erreur: n.erreur }, 400);
        n.e.debut = depart;
        motif = 'renouvellement';
      } else if (cab) {
        // Changer le QUOTA d'un cabinet : même règle que changer d'offre — la date de fin ne bouge
        // pas, on facture ce que l'écran a annoncé (la différence au prorata, ou un montant décidé à
        // la main). Même quota = rien à changer.
        const q = Math.round(Number(corps.dossiersHors));
        if (!Number.isFinite(q) || q < 1) return json({ erreur: 'Indique le nouveau nombre de dossiers hors SkanFact.' }, 400);
        if (q === Number(l.dossiers_hors)) return json({ erreur: 'Cette licence couvre déjà ' + q + ' dossier' + (q === 1 ? '' : 's') + ' hors SkanFact.' }, 409);
        n = nettoyerEmission({ ...corps, type: 'cabinet', dossiersHors: q, duree: l.fin ? 'date' : 'vie', dateLibre: l.fin, remise: 0, cabinet: l.cabinet_empreinte || '' }, aujourdhui);
        if (!n.ok) return json({ erreur: n.erreur }, 400);
        motif = 'offre';
      } else {
        // Changer d'offre : la date de fin ne bouge pas, on facture ce que l'écran a annoncé (le
        // prorata, ou un autre montant décidé à la main). Même offre = rien à changer.
        if (!OFFRES[corps.offre]) return json({ erreur: 'Choisis la nouvelle offre.' }, 400);
        if (corps.offre === l.offre) return json({ erreur: 'Cette licence est déjà en offre ' + OFFRES[l.offre].label + '.' }, 409);
        n = nettoyerEmission({ ...corps, type: 'entreprise', duree: l.fin ? 'date' : 'vie', dateLibre: l.fin, remise: 0, cabinet: l.cabinet_empreinte || '' }, aujourdhui);
        if (!n.ok) return json({ erreur: n.erreur }, 400);
        motif = 'offre';
      }
      return emettre(env, { client, e: n.e, aujourdhui, maintenant, remplace: l, motif });
    }

    if (r.sous === 'envoyer') {
      const cle = await cleDeLicence(env, l);
      if (!cle.cle) return json({ erreur: cle.raison }, 409);
      const m = mailLicence({ type: l.type, dossiersHors: l.dossiers_hors, offre: l.offre, exp: l.fin || '', cle: cle.cle, signature: env.MAIL_SIGNATURE });
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
        ' emise_le, remplacee_motif, revoquee_le, revoquee_motif, envoyee_le, charge, type, dossiers_hors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        n.l.id, client.id, v.kid, empreinte, n.l.offre, null, n.l.emisLe, n.l.exp || null, n.l.prix, n.l.devise, n.l.remise, n.l.cabinet || null,
        n.l.emisLe + 'T00:00:00.000Z', n.l.motif || null, n.l.revoqueeLe || null, n.l.revoqueeMotif || null, n.l.envoyeeLe ? n.l.envoyeeLe + 'T00:00:00.000Z' : null, null,
        n.l.type === 'cabinet' ? 'cabinet' : null, n.l.type === 'cabinet' ? n.l.dossiersHors : null);
      if (!ok) { bilan.ignorees.push({ id: n.l.id, raison: 'la base a refusé l\'écriture' }); continue; }
      ids.set(n.l.id, n.l.id);
      if (n.l.facture) {
        await executer('INSERT INTO ventes (id, client_id, licence_id, montant_ht, tva, devise, payee_le, moyen, facture_skanfact, importee_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          'v_' + idCourt(), client.id, n.l.id, n.l.facture.montant, null, n.l.devise, n.l.facture.payeeLe || null, null, n.l.facture.numero || null, maintenant);
      }
      await journaliser(env, 'licence.importee', { client_id: client.id, licence_id: n.l.id, detail: libelleLicence(n.l) + ' — émise dans SkanFact le ' + n.l.emisLe });
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
    // L'empreinte entre dans la clé sous sa forme CANONIQUE (majuscules, tirets) — celle que
    // `licence:emettre` écrit dans SkanFact et que `licenceCabinet` compare ; la base garde la forme
    // nue, sur laquelle les jointures se font. Le type et le quota (9.4.0) vont en QUEUE de charge.
    const charge = chargeLicence({
      kid: ks.kid, id, sub: o.client.id, nom: o.client.nom, matricule: o.client.matricule || '',
      offre: o.e.offre, exp: o.e.exp, cabinet: o.e.cabinetCanon, emisLe: o.aujourdhui,
      type: o.e.type, dossiersHors: o.e.dossiersHors
    });
    const chargeTexte = JSON.stringify(charge);
    let cle;
    try { cle = await signerLicence(chargeTexte, ks.privee); }
    catch (err) { return json({ erreur: 'La signature a échoué : ' + (err && err.message) }, 500); }
    const empreinte = await empreinteCle(cle);
    const ok = await executer(
      'INSERT INTO licences (id, client_id, kid, empreinte, offre, postes, debut, fin, prix, devise, remise, cabinet_empreinte,' +
      ' emise_le, remplace_id, remplacee_motif, charge, type, dossiers_hors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, o.client.id, ks.kid, empreinte, o.e.offre, null, o.e.debut || o.aujourdhui, o.e.exp || null, o.e.prix, o.e.devise,
      o.e.remise, o.e.cabinet || null, o.maintenant, o.remplace ? o.remplace.id : null, o.motif, chargeTexte,
      o.e.type === 'cabinet' ? 'cabinet' : null, o.e.type === 'cabinet' ? o.e.dossiersHors : null);
    if (!ok) return json({ erreur: 'La base a refusé l\'écriture de la licence.' }, 500);
    const venteId = 'v_' + idCourt();
    await executer(
      'INSERT INTO ventes (id, client_id, licence_id, montant_ht, tva, devise, payee_le, moyen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      venteId, o.client.id, id, o.e.montant, null, o.e.devise, o.e.payeeLe || null, o.e.payeeLe ? o.e.moyen : null);
    await journaliser(envx, o.motif ? 'licence.' + o.motif : 'licence.emise', {
      client_id: o.client.id, licence_id: id,
      detail: libelleLicence(o.e) + (o.e.exp ? ' jusqu\'au ' + o.e.exp : ' à vie') + ' — ' + o.e.montant + ' ' + o.e.devise + ' HT'
        + (o.remplace ? ' (remplace ' + o.remplace.id + ')' : '')
    });
    const mail = o.e.payeeLe ? await envoyerSiPossible(envx, id, o.maintenant) : { envoye: false, raison: 'la vente n\'est pas encore payée' };
    return json({
      licence: { id, client: o.client.nom, matricule: o.client.matricule, email: o.client.email, kid: ks.kid, empreinte, offre: o.e.offre,
        type: o.e.type, dossiers_hors: o.e.type === 'cabinet' ? o.e.dossiersHors : null, cabinet_empreinte: o.e.cabinet || null,
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
    const m = mailLicence({ type: l.type, dossiersHors: l.dossiers_hors, offre: l.offre, exp: l.fin || '', cle: cle.cle, signature: envx.MAIL_SIGNATURE });
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
  /* ---------- la coque ----------
     La console est la TROISIÈME surface du produit, et c'était la seule à ne pas ressembler aux
     deux autres : un bandeau en haut, des pastilles d'onglets, et pas de rail. Les deux
     applications portent la même coque depuis toujours — barre latérale de 224 px, entrées
     groupées avec leur icône, contenu qui défile à côté. On la reprend ici À L'IDENTIQUE
     (src/renderer/style.css § sidebar) plutôt que d'en inventer une troisième : un mécanisme
     recopié de travers diverge (7.29.0), et surtout un éditeur qui passe de SkanFact à sa console
     ne doit pas avoir l'impression de changer de logiciel. */
  .coque{display:flex;height:100vh}
  .rail{width:224px;background:var(--surface);border-inline-end:1px solid var(--line);
        display:flex;flex-direction:column;padding:22px 14px;flex-shrink:0}
  .marque{padding:6px 8px 18px;display:flex;flex-direction:column;gap:6px}
  .marque b{font-size:15px;font-weight:700;letter-spacing:-.3px}
  .rail nav{display:flex;flex-direction:column;gap:2px;overflow-y:auto;margin:0 -4px;padding:0 4px}
  .nav-group{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#aab3be;
             font-weight:700;padding:12px 12px 3px}
  .nav-group:first-child{padding-top:2px}
  @media (prefers-color-scheme:dark){.nav-group{color:#6c7785}}
  .rail nav button{font:inherit;font-size:14px;color:var(--ink2);background:transparent;border:0;
       text-align:start;padding:8px 12px;border-radius:10px;font-weight:500;cursor:pointer;
       display:flex;align-items:center;gap:10px;width:100%;transition:background .12s,color .12s}
  .rail nav button svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;
       stroke-linecap:round;stroke-linejoin:round;opacity:.8;flex-shrink:0}
  .rail nav button:hover{background:var(--surface2);color:var(--ink)}
  .rail nav button[aria-selected=true]{background:rgba(15,157,143,.12);color:var(--acc);font-weight:600}
  .rail nav button[aria-selected=true] svg{opacity:1}
  .rail nav button .cpt{margin-inline-start:auto;font-size:11.5px;font-weight:700;
       font-variant-numeric:tabular-nums;color:var(--alr)}
  .rail-pied{margin-top:auto;display:flex;flex-direction:column;gap:2px;padding-top:12px;
             border-top:1px solid var(--line)}
  .rail-pied .btn{border:0;background:transparent;color:var(--ink2);text-align:start;padding:8px 12px}
  .rail-pied .btn:hover{background:var(--surface2);color:var(--ink);border:0}
  /* L'en-tête d'un écran : son nom, ce à quoi il sert, et les gestes qui lui appartiennent. La
     console n'avait AUCUN titre de page — « Parc » et « Activations » ne disaient nulle part ce
     qu'ils comptent, et il fallait lire le tableau pour le deviner. */
  .page-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:20px}
  .page-head h1{margin:0;font-size:24px;font-weight:700;letter-spacing:-.4px}
  .page-head .but{margin:4px 0 0;color:var(--ink2);font-size:13.5px;max-width:64ch}
  .page-head .actions{margin-inline-start:auto;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .page-head .actions input{width:auto;min-width:200px;max-width:280px}
  header h1{font-size:18px;margin:0;font-weight:700;letter-spacing:-.4px}
  /* L'échelle de titres des deux applications (9.4.3), portée ici : trois niveaux, un rôle chacun.
     Un titre gris de 11 px ne hiérarchise rien, il décore — et l'eyebrow ne sert QUE de
     sur-étiquette au-dessus d'un chiffre, jamais de titre de section. C'est très exactement
     l'usage qu'en fait le bloc de l'argent ci-dessous. */
  .eyebrow{font-size:11px;color:var(--ink2);text-transform:uppercase;letter-spacing:1px;font-weight:700}
  header .sp{flex:1}
  main{padding:26px 28px 40px;flex:1;overflow-y:auto;min-width:0}
  main > .dedans{max-width:1180px}
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
  .card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
  .card b{display:block;font-size:24px;font-weight:700;letter-spacing:-.02em;
          font-variant-numeric:tabular-nums;line-height:1.1}
  .card span{display:block;font-size:12.5px;color:var(--ink2);margin-top:4px}
  .card.ess b{color:var(--srv)} .card.rev b{color:var(--alr)} .card.act b{color:var(--acc)}
  /* Un compteur à zéro n'a rien à annoncer : il reste lisible — on ne cache jamais un chiffre —
     mais il cesse de crier aussi fort que celui qui porte une décision. « 0 expirée » et
     « 0 ordinateur vu » occupaient deux des six places de tête au même poids que le reste. */
  .card.zero b{color:var(--ink2);font-weight:600}

  /* ---------- l'argent ----------
     C'est le chiffre d'un éditeur : combien est rentré, combien attend. Il vivait dans deux
     pastilles de 11,5 px sous six cartes de même poids — la hiérarchie était à l'envers, et ça se
     mesure : le plus petit texte de l'écran portait l'information la plus importante. Il passe en
     tête, avec l'eyebrow des applications au-dessus du nombre (9.4.3).
     Chaque montant garde sa DEVISE et son ANNÉE : additionner des dinars et des euros est la faute
     de la 7.16.0, et un agrégat sans sa période ne veut rien dire (3.1.0). */
  .argent{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px}
  .sous{background:var(--surface);border:1px solid var(--line);border-radius:12px;
        padding:14px 18px;min-width:210px}
  .sous .n{display:block;font-size:30px;font-weight:700;letter-spacing:-.6px;line-height:1.15;
           font-variant-numeric:tabular-nums;margin-top:2px}
  .sous.du{border-color:var(--warn)} .sous.du .n{color:var(--warn)}
  .sous.rentre .n{color:var(--acc)}
  .sous .q{display:block;font-size:12.5px;color:var(--ink2);margin-top:2px}
  .sous[role=button]{cursor:pointer}
  .sous[role=button]:hover{border-color:var(--acc)}
  .sous:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
  .bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
  .etat-machine{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px;margin-bottom:20px;
                font-size:12.5px;color:var(--ink2)}
  .etat-machine p{margin:0}
  .etat-machine > div{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}
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
  /* Le geste d'une ligne reste ATTEIGNABLE quand la table déborde. Mesuré : à 1280 px, la table
     de l'écran d'entrée faisait 1350 px et « Ouvrir » sortait de 70 px — il fallait faire défiler
     de côté pour agir sur la ligne qu'on venait de lire. Un geste qu'on doit aller chercher est un
     geste qu'on ne fait pas. La colonne d'actions se colle à droite, comme celle du Cabinet
     (9.4.4), et porte son propre fond pour que le texte ne passe pas dessous. */
  .wrap{position:relative}
  th.acts,td.acts{position:sticky;inset-inline-end:0;background:var(--surface)}
  th.acts{background:var(--surface2)}
  td.acts::before{content:'';position:absolute;inset-block:0;inset-inline-start:0;width:1px;background:var(--line)}
  /* Une colonne qui EXPLIQUE a le droit de revenir à la ligne : c'est elle qui portait la table à
     1350 px, parce que le nowrap de la règle générale vaut pour toutes. Les colonnes de chiffres et de
     dates, elles, ne se coupent jamais. */
  td.libre{white-space:normal;min-width:260px}
  .mono{font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;font-size:12px}
  /* Le moment exact sous la phrase : « aujourd'hui » dit si l'installation vit encore, la seconde
     ligne dit à quelle heure elle a été ouverte. Les deux sont utiles, et ni l'une ni l'autre ne
     suffit — la première ne sait pas répondre à « il a testé quand dans la journée ? ». */
  .quand{display:block;color:var(--ink2);font-size:11.5px;font-variant-numeric:tabular-nums}
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

<div id="app" class="coque" hidden>
  <div class="rail">
    <div class="marque">
      <b>SkanFact</b>
      <span class="pill e" id="etat-pill">…</span>
    </div>
    <!-- Le rail GARDE role=tablist et ses boutons data-t : ce sont toujours des onglets, ils
         échangent la même région de contenu. Seule l'orientation change, et aria-orientation le
         dit. Renommer aurait cassé les deux parcours pour un gain nul. -->
    <nav id="tabs" role="tablist" aria-orientation="vertical" aria-label="Sections de la console"></nav>
    <div class="rail-pied">
      <button id="refresh" class="btn" type="button">Actualiser</button>
      <button id="exporter" class="btn" type="button" title="Range la base entière en un fichier JSON">Exporter la base…</button>
      <button id="out" class="btn" type="button">Fermer la session</button>
    </div>
  </div>
  <main>
    <div class="dedans">
      <div id="err" class="msg" hidden></div>
      <div id="info" class="msg ok" hidden></div>
      <div class="page-head">
        <div>
          <h1 id="page-titre">…</h1>
          <p class="but" id="page-but"></p>
        </div>
        <div class="actions" id="page-actions"></div>
      </div>
      <div id="form" class="panel" hidden></div>
      <div id="resultat" class="panel" hidden></div>
      <div id="bord" hidden>
        <div id="argent" class="argent"></div>
        <div class="cards" id="cards"></div>
        <!-- L'état de la machinerie : le mail qui porte les clés, et les canaux de mise à jour.
             Deux faits de même nature — « est-ce que ça marche ? » — donc une seule bande, discrète
             tant que tout va bien. Séparés, la phrase du mail flottait en prose de 15 px au milieu
             de l'écran et le bloc des canaux prenait deux lignes pour dire « non branché ». -->
        <div class="etat-machine">
          <div id="sante"></div>
          <p id="etat-txt"></p>
        </div>
      </div>
      <div id="table"></div>
      <footer id="foot">Une clé livrée ne se reprend pas : une révocation s'applique chez le client à sa prochaine connexion, et seulement si sa version embarque la clé de réponse.</footer>
    </div>
  </main>
</div>

<script>
(function () {
  var CLE = 'skanfact-console';
  var secret = sessionStorage.getItem(CLE) || '';
  // L'onglet d'entrée est « À décider » : un tableau de bord s'ouvre sur ce qui demande une
  // décision, pas sur la liste la plus longue (7.0.0 — « Ce qui manque » avant tout le reste).
  var onglet = 'alertes';
  var etat = null;        // ce que /v1/admin/etat a répondu : peut-on signer, peut-on envoyer
  var clients = [];       // pour le choix d'un client à l'émission
  var aDecider = 0;       // le compteur du rail : le seul chiffre qui se voit depuis partout
  var recherche = '';     // le filtre de l'écran courant, vidé quand on en change
  var lignesEcran = [];   // ce que la route a rendu, avant filtrage — on filtre l'affichage, pas la source
  // Où une recherche a un sens : les écrans qui portent des NOMS et des numéros. « À décider »
  // tient en trois lignes repliées et « Parc » en une ligne par version : un champ de recherche y
  // serait un contrôle de plus à lire pour rien.
  var CHERCHABLES = ['licences', 'ventes', 'clients', 'cabinets', 'activations', 'evenements'];
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
  // Un horodatage est un INSTANT ; « aujourd'hui » est un jour du CALENDRIER. Compter des tranches
  // de 24 h faisait dire « aujourd'hui » à une ouverture d'hier 23 h regardée ce matin à 8 h — et
  // c'est précisément la question posée : le comptable a-t-il ouvert l'application aujourd'hui ?
  // Le navigateur de l'éditeur est à Tunis : le jour local est le bon jour (règle 5.2.3).
  var jourDe = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  var depuis = function (iso) {
    var d = new Date(iso || ''); if (isNaN(d.getTime())) return '';
    var j = Math.round((jourDe(new Date()) - jourDe(d)) / 86400000);
    if (j <= 0) return "aujourd'hui";
    if (j === 1) return 'hier';
    if (j < 31) return 'il y a ' + pl(j, 'jour');
    var m = Math.floor(j / 30);
    if (m < 12) return 'il y a ' + pl(m, 'mois', 'mois');
    return 'il y a ' + pl(Math.floor(j / 365), 'an');
  };
  // Le jour ET l'heure, dans le fuseau de celui qui regarde. L'aide jour() découpe la chaîne ISO,
  // donc elle rend le jour UTC : à minuit et demi à Tunis, elle annoncerait la veille à côté d'une
  // heure qui, elle, serait juste. Deux moitiés d'une même date ne vivent pas dans deux fuseaux.
  var horodate = function (iso) {
    var d = new Date(iso || ''); if (isNaN(d.getTime())) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' à ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  // « aujourd'hui » répond à « cette installation vit-elle encore ? », l'horodatage à « il a testé
  // quand, ce jour-là ? ». Skander voulait la seconde réponse sans perdre la première.
  var quandVu = function (iso) {
    var q = depuis(iso); if (!q) return '—';
    return h(q) + '<span class="quand">' + h(horodate(iso)) + '</span>';
  };
  var montant = function (n, dev) {
    var x = Number(n) || 0;
    return x.toFixed(3).replace('.', ',').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ') + ' ' + (dev || '');
  };
  var aujourdhui = function () {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  // Une date de l'app est un JOUR du calendrier : arithmétique en UTC pur (5.2.3). La borne est la
  // même que celle de l'alerte — trente jours — et c'est voulu : « Écrire… » ne doit apparaître que
  // sur les lignes que « À décider » vient d'annoncer.
  var dansTrenteJours = function () {
    var d = new Date(aujourdhui() + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString().slice(0, 10);
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
  // « Émettre » et « Nouveau client » ne sont plus posés une fois pour toutes dans le gabarit :
  // ce sont les gestes d'un ÉCRAN, et c'est dessinerTete qui les crée et les branche. Les
  // brancher ici viserait des boutons qui n'existent pas encore.

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
    // Le bouton n'existe que sur les écrans qui le portent : on ne l'éteint que s'il est là.
    if ($('emettre')) {
      $('emettre').disabled = !etat.emission.ok;
      $('emettre').title = etat.emission.ok ? '' : etat.emission.raison;
    }
  }

  // --- la santé des canaux de mise à jour (10.4.0) ---
  // Ce que chaque canal sert aujourd'hui. Non branché, on le DIT : la console ne peut pas lire un
  // autre worker, et elle n'invente pas ce qu'elle ne sait pas.
  function dessinerSante() {
    var el = $('sante');
    el.innerHTML = '<span class="pill e">canaux…</span>';
    api('sante').then(function (s) {
      if (!s.ok) {
        el.innerHTML = '<span class="pill e">canaux : non lus</span> <span class="quand">' + h(s.raison || '') + '</span>';
        return;
      }
      var v = s.verdict || { niveau: 'calme', phrase: '' };
      var cls = v.niveau === 'alerte' ? 'r' : (v.niveau === 'attention' ? 'w' : 'a');
      var detail = (s.canaux || []).filter(function (c) { return c.servi; })
        .map(function (c) { return h(c.fichier) + ' → ' + h(c.tag); }).join(' · ');
      el.innerHTML = '<span class="pill ' + cls + '">' + h(v.phrase) + '</span>'
        + (detail ? '<div class="quand" style="margin-block-start:6px">' + detail + '</div>' : '');
    }, function (e) {
      el.innerHTML = '<span class="pill e">canaux : non lus</span> <span class="quand">' + h(e.message || '') + '</span>';
    });
  }

  // --- l'export de la base ---
  // La base porte « qui a acheté quelle clé » — et le contenu signé de chaque licence, celui qui
  // permet de la refabriquer à l'identique. L'avertissement se lit AVANT le geste.
  $('exporter').onclick = function () {
    var b = $('exporter'); b.disabled = true;
    fetch('/v1/admin/export', { headers: { 'X-SkanFact-Admin': secret } }).then(function (r) {
      if (!r.ok) throw new Error('Le serveur a répondu ' + r.status + '.');
      return r.json();
    }).then(function (j) {
      var txt = JSON.stringify(j, null, 2);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      a.download = 'skanfact-console-' + aujourdhui() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      var comptes = Object.keys(j.comptes || {}).map(function (t) { return t + ' : ' + j.comptes[t]; }).join(' · ');
      montrerInfo('Base exportée — ' + comptes + '. Ce fichier n\\u2019est pas chiffré et porte tes clients : range-le où tu ranges tes clés.');
      b.disabled = false;
      dessiner();
    }, function (e) { b.disabled = false; montrerErreur(e); });
  };

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

  // Ce qu'une licence EST, en un libellé — la même règle que libelleLicence() côté serveur : l'offre
  // d'une entreprise, ou le quota d'un cabinet.
  // (Aucun backtick dans un commentaire d'ici : cette page est un template literal, et un backtick
  // le referme — le fichier entier cesse alors d'être lisible. Quatrième fois, CLAUDE.md § 7.31.0.)
  var estCabinet = function (l) { return !!l && l.type === 'cabinet'; };
  var libOffre = function (l) {
    if (estCabinet(l)) { var n = Number(l.dossiers_hors) || 0; return 'Cabinet — ' + n + ' dossier' + (n === 1 ? '' : 's') + ' hors SkanFact'; }
    return etat && etat.offres[l.offre] ? etat.offres[l.offre].label : l.offre;
  };
  // Un champ du formulaire se montre ou se cache par son STYLE : la règle label.f{display:block} de
  // cette page bat l'attribut hidden de la feuille du navigateur, et un champ caché ainsi resterait
  // visible.
  var montrerChamp = function (id, oui) { var e = document.getElementById(id); if (e) e.style.display = oui ? '' : 'none'; };

  // Émettre (lic = null), renouveler (mode 'renouveler') ou changer d'offre / de quota (mode 'offre').
  //
  // 9.4.1 — le TYPE. Une licence d'ENTREPRISE porte une offre et un matricule et s'installe dans
  // SkanFact ; une licence de CABINET porte l'empreinte du cabinet et un quota de dossiers hors
  // SkanFact, et s'installe dans SkanFact Cabinet. Le type se choisit à l'émission ; renouveler et
  // changer gardent celui de la licence en cours. Une licence de cabinet n'a ni offre ni parrainage.
  function formEmettre(lic, mode) {
    if (!etat || !etat.emission.ok) return montrerErreur(new Error(etat ? etat.emission.raison : 'État du serveur inconnu.'));
    var t = etat.tarifs;
    var cab = estCabinet(lic);
    var offres = Object.keys(etat.offres).map(function (k) {
      return '<option value="' + k + '"' + (lic && lic.offre === k && mode !== 'offre' ? ' selected' : '') + '>' + h(etat.offres[k].label) + '</option>';
    }).join('');
    var durees = etat.durees.map(function (d) { return '<option value="' + d.id + '"' + (d.id === '1a' ? ' selected' : '') + '>' + h(d.label) + '</option>'; }).join('');
    var choixClient = clients.length
      ? '<select name="clientId">' + clients.map(function (c) { return '<option value="' + h(c.id) + '">' + h(c.nom) + (c.matricule ? ' — ' + h(c.matricule) : '') + (c.email ? '' : ' (sans e-mail)') + '</option>'; }).join('') + '</select>'
      : '<span style="color:var(--alr)">Aucun client : crée-le d\\u2019abord (« Nouveau client… »).</span>';
    var paiement = '<label class="c w"><input type="checkbox" name="payee"> Déjà payée</label>' +
      champ('payeeLe', 'Payée le', 'type="date" value="' + aujourdhui() + '"') +
      champ('moyen', 'Moyen de paiement', 'placeholder="virement, espèces, chèque…" maxlength="40"');
    // Le quota d'un cabinet, en plus des trois gratuits. Le prix d'un dossier n'est proposé que
    // s'il est réglé (PRIX_CABINET_DOSSIER) : les tarifs du Cabinet ne sont pas fixés, et un chiffre
    // inventé ici deviendrait un tarif par simple préremplissage.
    var champQuota = function (valeur, cache) {
      return '<label class="f" id="f-quota"' + (cache ? ' style="display:none"' : '') + '><span>Dossiers hors SkanFact couverts, en plus des 3 gratuits *</span>' +
        '<input name="dossiersHors" type="number" min="1" max="5000" step="1" value="' + h(valeur == null ? '' : valeur) + '"></label>';
    };
    var prixCabinet = function (n) { return t.cabinetDossier > 0 && n > 0 ? Math.round(t.cabinetDossier * n * 1000) / 1000 : ''; };
    var titre, why, champs, ok;
    if (!lic) {
      titre = 'Émettre une licence';
      why = 'Trois choses dans le même geste : la clé signée par le serveur, la vente, la ligne de journal. Si la vente est déjà payée, la clé part par mail tout de suite (quand le client a une adresse). ' +
        'Une licence de <strong>cabinet</strong> porte l\\u2019empreinte du cabinet et un quota de dossiers hors SkanFact, jamais une offre : SkanFact Cabinet la reconnaît, SkanFact la refuse.';
      champs = '<label class="f w"><span>Client *</span>' + choixClient + '</label>' +
        '<label class="f w"><span>Type</span><select name="type">' +
          '<option value="entreprise">Entreprise — s\\u2019installe dans SkanFact (une offre, un matricule)</option>' +
          '<option value="cabinet">Cabinet comptable — s\\u2019installe dans SkanFact Cabinet (un quota de dossiers)</option></select></label>' +
        '<label class="f" id="f-offre"><span>Offre</span><select name="offre">' + offres + '</select></label>' +
        '<label class="f"><span>Durée</span><select name="duree">' + durees + '</select></label>' +
        champ('dateLibre', 'Date de fin (si « jusqu\\u2019à une date précise »)', 'type="date"') +
        champQuota('', true) +
        champ('prix', 'Prix HT (' + h(t.devise) + ') *', 'type="number" step="0.001" min="0" value="' + t.entreprise + '"') +
        '<label class="c w" id="f-parrain"><input type="checkbox" name="parrain"> Client parrainé par un cabinet comptable (remise de ' + t.remiseParrainage + ' % la première année)</label>' +
        champ('cabinet', 'Empreinte du cabinet (facultatif)', 'placeholder="xxxx-xxxx-xxxx-xxxx-xxxx" maxlength="30"', true) +
        paiement;
      ok = 'Émettre la clé';
    } else if (mode === 'renouveler') {
      var depart = lic.fin && lic.fin > aujourdhui() ? lic.fin : aujourdhui();
      titre = 'Renouveler la licence de ' + lic.client;
      why = (cab ? h(libOffre(lic)) : 'Offre ' + h(libOffre(lic))) + (lic.fin ? ', fin actuelle le ' + jour(lic.fin) : '') + '. La nouvelle période part du <strong>' + jour(depart) + '</strong> : les jours déjà payés ne sont pas perdus. Une nouvelle clé est signée, l\\u2019ancienne reste valable jusqu\\u2019à sa date.' +
        (cab ? ' Le quota se garde tel quel — modifie-le ici si le cabinet a pris des clients.' : ' La remise de parrainage ne s\\u2019applique qu\\u2019à la première année.');
      champs = '<label class="f"><span>Durée</span><select name="duree">' + durees + '</select></label>' +
        champ('dateLibre', 'Date de fin (si « jusqu\\u2019à une date précise »)', 'type="date"') +
        (cab ? champQuota(lic.dossiers_hors, false) : '') +
        champ('prix', 'Prix HT (' + h(t.devise) + ') *', 'type="number" step="0.001" min="0" value="' + (cab ? prixCabinet(Number(lic.dossiers_hors) || 0) : (t[lic.offre] || t.entreprise)) + '"') +
        paiement;
      ok = 'Renouveler';
    } else if (cab) {
      // Changer le QUOTA : même règle que changer d'offre. La date de fin ne bouge pas, on facture
      // la différence sur les jours restants — et le montant se décide à la main tant que le prix
      // d'un dossier n'est pas réglé.
      var actuel = Number(lic.dossiers_hors) || 0;
      var proQ = prorata(lic, 0, 0);
      titre = 'Changer le quota de ' + lic.client;
      why = 'Actuellement <strong>' + h(libOffre(lic)) + '</strong>' + (lic.fin ? ', jusqu\\u2019au ' + jour(lic.fin) : ', à vie') + '. La date de fin ne bouge pas ; on facture la différence sur les jours restants' +
        (proQ.jours == null ? ' — <strong>licence à vie : pas de prorata possible, décide le montant à la main</strong>.' : ' : <strong>' + proQ.jours + ' jours sur ' + proQ.total + '</strong>.') +
        (t.cabinetDossier > 0 ? ' Le montant proposé suit le prix d\\u2019un dossier (' + montant(t.cabinetDossier, t.devise) + ' HT par an).' : ' Aucun prix de dossier n\\u2019est réglé : le montant se décide à la main.') +
        ' Une « descente » vers moins de dossiers ne rembourse rien toute seule.';
      champs = champQuota(actuel, false) +
        champ('prix', 'Montant à facturer HT (' + h(t.devise) + ') *', 'type="number" step="0.001" min="0" value=""') +
        paiement;
      ok = 'Changer le quota';
    } else {
      var autre = lic.offre === 'entreprise' ? 'independant' : 'entreprise';
      var pro = prorata(lic, t[autre], t[lic.offre]);
      titre = 'Changer l\\u2019offre de ' + lic.client;
      why = 'Actuellement <strong>' + h(libOffre(lic)) + '</strong>' + (lic.fin ? ', jusqu\\u2019au ' + jour(lic.fin) : ', à vie') + '. La date de fin ne bouge pas ; on facture la différence sur les jours restants' +
        (pro.jours == null ? ' — <strong>licence à vie : pas de prorata possible, décide le montant à la main</strong>.' : ' : <strong>' + pro.jours + ' jours sur ' + pro.total + '</strong>, soit ' + montant(pro.montant, t.devise) + ' HT proposés.') +
        ' Une « descente » vers moins cher ne rembourse rien toute seule.';
      champs = '<label class="f"><span>Nouvelle offre</span><select name="offre">' + Object.keys(etat.offres).map(function (k) {
          return '<option value="' + k + '"' + (k === autre ? ' selected' : '') + '>' + h(etat.offres[k].label) + '</option>';
        }).join('') + '</select></label>' +
        champ('prix', 'Montant à facturer HT (' + h(t.devise) + ') *', 'type="number" step="0.001" min="0" value="' + pro.montant + '"') +
        paiement;
      ok = 'Changer l\\u2019offre';
    }
    formulaire(titre, why, champs, ok, function () {
      var corps = { type: val('type') || undefined, offre: val('offre'), duree: val('duree'), dateLibre: val('dateLibre'), prix: val('prix'),
        dossiersHors: val('dossiersHors'),
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
    var prixEl = function () { return document.querySelector('#form [name="prix"]'); };
    var so = document.querySelector('#form [name="offre"]');
    if (so && !lic) so.onchange = function () { var p = prixEl(); if (p) p.value = t[so.value]; };
    // Le type décide des champs : une licence de cabinet n'a ni offre ni parrainage, une licence
    // d'entreprise n'a ni quota. L'empreinte, elle, change de rôle : facultative (parrainage) pour
    // une entreprise, obligatoire (sujet de la clé) pour un cabinet.
    var st = document.querySelector('#form [name="type"]');
    var sq = document.querySelector('#form [name="dossiersHors"]');
    var etiquetteEmpreinte = function (obligatoire) {
      var e = document.querySelector('#form [name="cabinet"]');
      var s = e && e.previousElementSibling; if (!s) return;
      s.textContent = obligatoire ? 'Empreinte du cabinet (le sujet de la clé) *' : 'Empreinte du cabinet (facultatif)';
    };
    if (st) st.onchange = function () {
      var cabinet = st.value === 'cabinet';
      montrerChamp('f-offre', !cabinet); montrerChamp('f-quota', cabinet); montrerChamp('f-parrain', !cabinet);
      etiquetteEmpreinte(cabinet);
      var p = prixEl(); if (p) p.value = cabinet ? prixCabinet(Number(sq && sq.value) || 0) : t[so ? so.value : 'entreprise'];
    };
    if (sq) sq.oninput = function () {
      var q = Number(sq.value) || 0, p = prixEl(); if (!p || !(t.cabinetDossier > 0)) return;
      // Émission ou renouvellement : le prix plein du quota. Changement : la différence au prorata.
      p.value = lic && mode !== 'renouveler' ? prorata(lic, prixCabinet(q), prixCabinet(Number(lic.dossiers_hors) || 0)).montant : prixCabinet(q);
    };
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
      '<p class="why">' + h(libOffre(l)) + (l.fin ? ', jusqu\\u2019au ' + jour(l.fin) : ', à vie') +
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
        '<p class="why">' + h(libOffre(l)) + (l.fin ? ', jusqu\\u2019au ' + jour(l.fin) : ', à vie') +
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
  // Relancer un client. La console COMPOSE, elle n'envoie pas : le texte s'ouvre dans la messagerie
  // de l'éditeur, qui le relit et l'envoie lui-même. Une relance part sous son nom, pas sous celui
  // d'un serveur — et son ton dépend du client. Resend ne sert qu'à la clé, qui suit un paiement et
  // ne se discute pas.
  function ecrire(r) {
    api(onglet + '/' + r.id + '/relance').then(function (j) {
      var el = $('resultat');
      var lien = 'mailto:' + encodeURIComponent(j.a) + '?subject=' + encodeURIComponent(j.sujet)
        + '&body=' + encodeURIComponent(j.corps);
      // Sans adresse, on ne fait pas semblant : on dit ce qui manque et où on le règle (7.0.0 — un
      // refus dit ce qui est refusé, pourquoi, et le geste qui débloque).
      el.innerHTML = '<h2>Écrire à ' + h(j.client || 'ce client') + '</h2>'
        + (j.a
          ? '<p class="why">À <strong>' + h(j.a) + '</strong>. Le texte s\\u2019ouvre dans ta messagerie : tu le relis, tu le modifies si tu veux, et c\\u2019est toi qui envoies.</p>'
          : '<p class="why" style="color:var(--warn)">Ce client n\\u2019a pas d\\u2019adresse e-mail : ajoute-la sur l\\u2019écran Clients, et le bouton s\\u2019allumera. Le texte reste copiable ci-dessous.</p>')
        + '<div class="cle" id="relance-txt" style="white-space:pre-wrap">' + h(j.sujet + '\\n\\n' + j.corps) + '</div>'
        + '<div class="row">'
        + (j.a ? '<a class="btn p" id="relance-ouvrir" href="' + h(lien) + '">Ouvrir dans ma messagerie</a>' : '')
        + '<button id="relance-copier" class="btn" type="button">Copier le texte</button>'
        + '<button id="relance-fermer" class="btn" type="button">Fermer</button></div>';
      el.hidden = false;
      $('relance-copier').onclick = function () { copier(j.sujet + '\\n\\n' + j.corps, $('relance-copier')); };
      $('relance-fermer').onclick = function () { el.hidden = true; el.innerHTML = ''; };
      el.scrollIntoView({ block: 'nearest' });
    }, montrerErreur);
  }
  function envoyer(lic) {
    formulaire('Envoyer la clé par mail', 'À <strong>' + h(lic.email || '(pas d\\u2019adresse)') + '</strong>, pour ' + h(lic.client) + ' — ' + (estCabinet(lic) ? '' : 'offre ') + h(libOffre(lic)) + (lic.envoyee_le ? '. Déjà envoyée le ' + jour(lic.envoyee_le) + ' : ceci renvoie la même clé.' : '.'),
      '', 'Envoyer', function () {
        return api('licences/' + lic.id + '/envoyer', {}).then(function (j) { fermerForm(); montrerInfo('Clé envoyée à ' + j.a + '.'); dessiner(); });
      });
  }
  function revoquer(lic) {
    formulaire('Révoquer la licence de ' + lic.client,
      (estCabinet(lic) ? '' : 'Offre ') + h(libOffre(lic)) + (lic.fin ? ', jusqu\\u2019au ' + jour(lic.fin) : ', à vie') + ', ' + pl(lic.activations, 'ordinateur') + ' vu' + (Number(lic.activations) >= 2 ? 's' : '') + '.<br>' +
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
  // Six places, et deux PRODUITS à distinguer. « 2 essais en cours » additionnait SkanFact et
  // SkanFact Cabinet : un éditeur qui a les deux sur son Mac lisait « 2 postes SkanFact » et ne
  // pouvait pas savoir combien de comptables l'utilisaient. Les essais se séparent donc, et ce qui
  // se lit déjà ailleurs cède la place : « expirée » est une ligne d'« À décider », et le compte
  // des ordinateurs vit dans le Parc, par application.
  var CARTES = [
    { k: 'essaisEntreprise', s: 'essai entreprise', p: 'essais entreprise', c: 'ess', t: 'parc' },
    { k: 'essaisCabinet', s: 'essai cabinet', p: 'essais cabinet', c: 'ess', t: 'parc' },
    { k: 'licencesActives', s: 'licence active', p: 'licences actives', c: 'act', t: 'licences' },
    { k: 'licencesRevoquees', s: 'révoquée', p: 'révoquées', c: 'rev', t: 'licences' },
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
      // Un cabinet : son quota, et combien de ses clients ont une licence parrainée par lui.
      { k: 'offre', t: 'Offre', f: function (v, r) {
          var n = Number(r.parraines) || 0;
          return libOffre(r) + (estCabinet(r) && n ? ' (' + n + ' parrainé' + (n === 1 ? '' : 's') + ')' : '');
        } },
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
            if (!r.remplacee_par) {
              s += b('renouveler', 'Renouveler') + b('offre', estCabinet(r) ? 'Changer le quota' : 'Changer d\\u2019offre');
              // « Écrire… » n'apparaît que sur une licence qui SE TERMINE : c'est le geste que
              // l'alerte annonce, et le poser sur chaque ligne ferait six boutons par ligne pour un
              // besoin qui n'existe qu'une fois par an et par client (le budget de boutons, 7.29.0).
              if (r.fin && r.fin <= dansTrenteJours()) s += b('ecrire', 'Écrire…');
            }
            s += b('revoquer', 'Révoquer', ' d');
          }
          return s;
        } }
    ],
    activations: [
      // L'APPLICATION d'abord : le champ était écrit en base depuis la 10.4.0 et affiché NULLE
      // PART — seulement dans le libellé agrégé du Parc. On ne pouvait donc pas répondre à
      // « lequel de ces deux postes est le Cabinet ? » depuis l'écran fait pour ça. Une donnée
      // enregistrée et jamais affichée n'existe pas (7.21.0).
      // Le NOM vient du serveur (appNom), jamais d'une table recopiée ici : APPS et appDe
      // vivent dans le module, pas dans cette page, et les appeler d'ici lève une ReferenceError
      // PENDANT la construction du gabarit — l'écran reste sur « Chargement… », rien en console,
      // et la colonne qu'on vient d'ajouter n'a jamais été dessinée une seule fois (7.22.0). Une
      // seconde table ici aurait de toute façon divergé de celle du Parc au premier renommage.
      { k: 'appNom', t: 'Application' },
      { k: 'client', t: 'Client', f: function (v, r) { return v || (r.empreinte === 'ESSAI' ? '— en essai —' : '— licence inconnue —'); } },
      { k: 'device_nom', t: 'Ordinateur' },
      { k: 'plateforme', t: 'Système' },
      { k: 'version', t: 'Version', m: true },
      { k: 'derniere_fois', t: 'Vu', f: function (v) { return quandVu(v); }, brut: true },
      { k: 'premiere_fois', t: 'Depuis', f: function (v) { return quandVu(v); }, brut: true }
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
          // Une vente livrée que personne n'a payée est la seule ligne de cet écran qui demande un
          // geste vers le client. « Relancer… » n'apparaît donc que là.
          return (r.payee_le ? '' : b('payee', 'Marquer payée') + b('ecrire', 'Relancer…'))
            + (r.facture_skanfact ? '' : b('facturee', 'N° de facture…'));
        } }
    ],
    evenements: [
      // Le journal portait l'heure UTC à côté d'une date UTC : une vente encaissée à 00 h 30 à Tunis
      // s'y lisait la veille à 23 h 30. Tout ce qui s'affiche passe par la même horloge, la locale.
      { k: 'quand', t: 'Quand', f: function (v) { return horodate(v); } },
      { k: 'quoi', t: 'Quoi', m: true },
      { k: 'client', t: 'Client' },
      { k: 'detail', t: 'Détail' }
    ],
    // 10.4.0 — ce qui demande une décision, le parc des DEUX applications, et les cabinets.
    // Les alertes sont GROUPÉES par nature avant d'arriver ici (voir grouperAlertes) : la colonne
    // « Pourquoi ça compte » imprimait jusqu'à cinq fois la même phrase, mesuré, et à la troisième
    // on ne lit plus la colonne du tout. Une explication se lit une fois (9.4.6) ; ce qui varie
    // d'une occurrence à l'autre, c'est le SUJET, et c'est lui qu'on énumère.
    alertes: [
      { k: 'niveau', t: 'Niveau', f: function (v) {
          return '<span class="pill ' + (v === 'alerte' ? 'r' : (v === 'attention' ? 'w' : 'a')) + '">' + h(v) + '</span>';
        }, brut: true },
      { k: 'quoi', t: 'Quoi', f: function (v, r) {
          return h(v) + (r.n > 1 ? ' <span class="pill e">' + r.n + '</span>' : '');
        }, brut: true },
      { k: 'sujets', t: 'Qui', l: true },
      { k: 'detail', t: 'Pourquoi ça compte', l: true },
      { k: 'onglet', t: 'Où', brut: true, a: true, f: function (v) {
          return '<button type="button" class="btn s" data-act="aller" data-onglet="' + h(v) + '">Ouvrir</button>';
        } }
    ],
    parc: [
      { k: 'appNom', t: 'Application' },
      { k: 'version', t: 'Version', m: true, f: function (v, r) {
          return (v || '— version inconnue —') + (r.essai ? ' <span class="pill w">essai</span>' : '');
        }, brut: true },
      { k: 'postes', t: 'Postes', n: true },
      // « Endormi » n'est pas « perdu » : un portable refermé pour les vacances compte à part, il
      // ne se retranche pas.
      { k: 'vus', t: 'Vus (30 j)', n: true },
      { k: 'endormis', t: 'Endormis', n: true },
      { k: 'licences', t: 'Sous licence', n: true },
      { k: 'enEssai', t: 'En essai', n: true },
      { k: 'darwin', t: 'Mac', n: true },
      { k: 'win32', t: 'Windows', n: true },
      { k: 'dernier', t: 'Dernier vu', f: function (v) { return quandVu(v); }, brut: true }
    ],
    cabinets: [
      { k: 'client', t: 'Cabinet' },
      { k: 'cabinet_empreinte', t: 'Empreinte', m: true },
      { k: 'dossiers_hors', t: 'Dossiers couverts', n: true },
      { k: 'parraines', t: 'Clients parrainés', n: true },
      { k: 'postes', t: 'Postes', n: true },
      { k: 'fin', t: 'Fin', f: function (v) { return v ? jour(v) : 'à vie'; } },
      { k: 'vu', t: 'Vu', f: function (v) { return quandVu(v); }, brut: true },
      { k: 'revoquee_le', t: 'État', f: function (v, r) { return etatLic(r); }, brut: true }
    ]
  };
  // Les icônes du rail : le même langage que les deux applications — 18 px, trait de 1,8, pas de
  // remplissage, la couleur du texte. Elles sont là pour qu'on retrouve une entrée d'un coup d'œil,
  // jamais à la place du mot (7.29.0 : un pictogramme n'est pas un libellé, mais une icône À CÔTÉ
  // d'un libellé est un repère).
  var ICONES = {
    alertes: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    licences: 'M15 7a4 4 0 1 0-3.9 5H14v3h3v3h4v-4l-5.2-5.2A4 4 0 0 0 15 7z',
    ventes: 'M3 6h18M3 12h18M3 18h12',
    cabinets: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5',
    clients: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9',
    parc: 'M2 4h20v12H2zM8 20h8M12 16v4',
    activations: 'M22 12h-4l-3 9L9 3l-3 9H2',
    evenements: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5'
  };

  // Chaque écran : son groupe dans le rail, son titre de page, et ce à quoi il sert. La console
  // n'avait aucun titre de page — « Parc » et « Activations » ne disaient nulle part ce qu'ils
  // comptent, et il fallait lire le tableau pour le deviner. Le champ « but » est ce qu'un éditeur veut
  // savoir en arrivant, pas une définition.
  var ECRANS = {
    alertes: { g: 'Pilotage', t: 'À décider', h: 'À décider aujourd\\u2019hui',
      but: 'Ce qui attend une décision : une clé signée qui n\\u2019est jamais partie, une licence livrée que personne n\\u2019a payée, une échéance proche.' },
    // Le Parc compte des POSTES, y compris pour le Cabinet — et c'est un fait vrai : un poste
    // installé est un poste installé. Ce qu'on VEND à un cabinet est un quota de dossiers, jamais
    // des postes (9.4.0), mais cette unité-là ne vit pas dans les activations : elle vit sur la
    // licence, donc sur l'écran Cabinets. Plutôt que de masquer un chiffre vrai derrière un « — »,
    // ou d'ajouter au parc une colonne que seule une ligne sur trois remplirait (9.4.4), l'écran
    // DIT où se lit l'unité commerciale — et le mot est un lien (7.15.0).
    parc: { g: 'Pilotage', t: 'Parc', h: 'Le parc installé',
      but: 'Les deux applications, version par version : combien de postes, combien vus ces trente jours, combien sous licence. '
        + 'Un cabinet se FACTURE au dossier et jamais au poste : ce compte-là se lit sur l\\u2019écran Cabinets.' },
    licences: { g: 'Ventes', t: 'Licences', h: 'Licences émises',
      but: 'Toutes les clés signées depuis cette console. Une licence remplacée reste ici avec son motif : rien ne s\\u2019efface.' },
    ventes: { g: 'Ventes', t: 'Ventes', h: 'Ventes',
      but: 'Une ligne par licence vendue. « Marquer payée » envoie la clé dans la seconde, si le client a une adresse.' },
    cabinets: { g: 'Ventes', t: 'Cabinets', h: 'Cabinets comptables',
      but: 'Ce qu\\u2019on vend à un cabinet est un QUOTA de dossiers hors SkanFact, jamais des postes.' },
    clients: { g: 'Ventes', t: 'Clients', h: 'Clients',
      but: 'Le nom et le matricule entrent dans la clé : un client peut acheter deux fois, renouveler, changer de matricule.' },
    activations: { g: 'Traces', t: 'Activations', h: 'Activations',
      but: 'Un ordinateur, une application, une date. C\\u2019est ce que les postes annoncent d\\u2019eux-mêmes — rien de plus.' },
    evenements: { g: 'Traces', t: 'Journal', h: 'Journal',
      but: 'Chaque émission, révocation, paiement et envoi, pour toujours. C\\u2019est ce qui permet de répondre à un client six mois plus tard.' }
  };
  var GROUPES = ['Pilotage', 'Ventes', 'Traces'];
  // Les gestes de CHAQUE écran. « Émettre » vit sur le tableau de bord et sur Licences (c'est de
  // là qu'on vend), « Nouveau client » partout où l'on peut avoir besoin d'en créer un avant
  // d'émettre. Un geste posé sur les huit écrans ne serait plus le geste d'un écran.
  // Chaque écran finit par le GESTE SUIVANT (7.27.0, 9.4.9). Après avoir créé un client on lui
  // vend une licence : « Émettre » vit donc aussi sur Clients — c'est le parcours réel qui l'a
  // montré, en cherchant le bouton là où on vient d'atterrir et en ne le trouvant pas.
  var ACTIONS = {
    alertes: ['emettre', 'client'], licences: ['emettre', 'client'],
    clients: ['emettre', 'client'], cabinets: ['emettre'],
    ventes: [], parc: [], activations: [], evenements: []
  };
  // Le gabarit ENTIER, identifiant compris, et pas un objet qu'on assemble : un contrôle de
  // npm test relit les balises « button » du HTML et exige que chacun soit branché (c'est le
  // défaut des treize boutons morts de la 7.0.0). Un identifiant construit par concaténation lui
  // échappe — il a d'ailleurs lu « ' + b.id + ' » comme un identifiant et fait tomber le test. On
  // garde donc l'identifiant LITTÉRAL, et le garde-fou continue de voir ces deux boutons-là.
  var BOUTONS = {
    emettre: '<button id="emettre" class="btn p" type="button">Émettre une licence…</button>',
    client: '<button id="nouveau-client" class="btn" type="button">Nouveau client…</button>'
  };
  var TITRES = {};
  Object.keys(ECRANS).forEach(function (k) { TITRES[k] = ECRANS[k].t; });
  // Chaque écran vide dit quoi faire, au lieu d'un tableau nu (7.0.0).
  var VIDES = {
    licences: 'Aucune licence émise depuis la console. « Émettre une licence… » ci-dessus signe la clé, enregistre la vente et l\\u2019envoie par mail.',
    activations: 'Aucune application ne s\\u2019est encore annoncée. Il faut une installation en 8.4.1 ou plus récente.',
    clients: 'Aucun client. « Nouveau client… » ci-dessus — le nom et le matricule entrent dans la clé.',
    ventes: 'Aucune vente : elles naissent avec l\\u2019émission d\\u2019une licence.',
    evenements: 'Rien dans le journal : chaque émission, révocation, paiement et envoi y sera écrit, pour toujours.',
    alertes: 'Rien à décider aujourd\\u2019hui : aucune clé en attente d\\u2019envoi, aucune vente à encaisser, aucune licence qui se termine dans les trente jours.',
    parc: 'Aucune application ne s\\u2019est encore annoncée. SkanFact s\\u2019annonce depuis la 8.4.1, SkanFact Cabinet depuis la 10.4.0.',
    cabinets: 'Aucune licence de cabinet vendue. « Émettre une licence… » ci-dessus, avec le type « Cabinet comptable » : ce qu\\u2019on y vend est un quota de dossiers, jamais des postes.'
  };

  // Le rail : les entrées rangées par groupe, chacune avec son icône. Le compteur rouge de
  // « À décider » vit sur son entrée — c'est le seul chiffre qui doit se voir depuis n'importe
  // quel écran, parce que c'est le seul qui demande quelque chose.
  function dessinerRail() {
    var html = '';
    GROUPES.forEach(function (g) {
      html += '<div class="nav-group">' + h(g) + '</div>';
      Object.keys(ECRANS).forEach(function (k) {
        if (ECRANS[k].g !== g) return;
        html += '<button role="tab" data-t="' + k + '" aria-selected="' + (k === onglet) + '">'
          + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONES[k] + '"/></svg>'
          + '<span>' + h(ECRANS[k].t) + '</span>'
          + (k === 'alertes' && aDecider ? '<span class="cpt">' + aDecider + '</span>' : '')
          + '</button>';
      });
    });
    $('tabs').innerHTML = html;
    Array.prototype.forEach.call($('tabs').querySelectorAll('button[data-t]'), function (b) {
      // Un filtre ne survit pas à la sortie de son écran : le retrouver trois jours plus tard sans
      // savoir d'où il vient est le piège du filtre qui cache ce qu'on vient chercher (9.4.6).
      b.onclick = function () { onglet = b.dataset.t; recherche = ''; dessiner(); };
    });
  }

  // L'en-tête de l'écran : son nom, ce à quoi il sert, ses gestes, et sa recherche. La recherche
  // n'apparaît que là où il y a quelque chose à chercher — une console qui vendra des centaines de
  // licences ne se parcourt pas à la molette, et un champ posé sur un écran de quatre lignes est
  // un contrôle de plus à lire pour rien.
  function dessinerTete() {
    var e = ECRANS[onglet] || { h: '', but: '' };
    $('page-titre').textContent = e.h;
    $('page-but').textContent = e.but;
    var act = (ACTIONS[onglet] || []).map(function (a) { return BOUTONS[a]; }).join('');
    if (CHERCHABLES.indexOf(onglet) >= 0) {
      act += '<input id="q" type="search" placeholder="Chercher dans ' + h(TITRES[onglet].toLowerCase()) + '…"'
        + ' aria-label="Chercher dans ' + h(TITRES[onglet].toLowerCase()) + '" value="' + h(recherche) + '">';
    }
    $('page-actions').innerHTML = act;
    if ($('emettre')) { $('emettre').onclick = function () { formEmettre(null, null); }; }
    if ($('nouveau-client')) { $('nouveau-client').onclick = function () { formClient(); }; }
    // L'état de la signature décide si « Émettre » peut servir, et il est déjà connu quand on
    // change d'écran : on le repose ici, sinon le bouton neuf naîtrait actif sur une console qui
    // ne peut pas signer, et le refus n'arriverait qu'au moment de valider le formulaire.
    if (etat && etat.emission && $('emettre')) {
      $('emettre').disabled = !etat.emission.ok;
      $('emettre').title = etat.emission.ok ? '' : etat.emission.raison;
    }
    var q = $('q');
    if (q) {
      q.oninput = function () { recherche = q.value; dessinerTable(); };
      if (recherche) { q.focus(); q.setSelectionRange(recherche.length, recherche.length); }
    }
    // Le tableau de bord porte l'argent, les compteurs et la santé des canaux ; les autres écrans
    // non. Avant, les six cartes se réaffichaient au-dessus de CHAQUE tableau : on payait quatre
    // cents pixels pour relire six chiffres qu'on venait de voir.
    $('bord').hidden = onglet !== 'alertes';
    // La limite d'une révocation ne concerne que les écrans qui vendent ou qui révoquent. Affichée
    // sous « Le parc installé », c'est une phrase qui ne parle pas de ce qu'on regarde — et une
    // phrase qu'on lit partout finit par ne se lire nulle part.
    $('foot').hidden = ['licences', 'ventes', 'cabinets', 'alertes'].indexOf(onglet) < 0;
  }

  function dessiner() {
    $('err').hidden = true;
    dessinerRail();
    dessinerTete();

    api('etat').then(function (e) { etat = e; dessinerEtat(); }, montrerErreur);
    api('clients').then(function (d) { clients = d.lignes || []; }, function () {});
    dessinerSante();

    api('stats').then(function (s) {
      // La CONVERSION ferme la rangée : combien d'ordinateurs ont essayé, combien ont acheté.
      // C'est le chiffre d'un produit qu'on vend, et il n'existait nulle part. Un taux sans
      // dénominateur vaut « — » et jamais « 0 % » : sur zéro essai il n'y a pas encore de question,
      // et annoncer un échec là où rien n'a été tenté apprend à ignorer le chiffre (9.6.0).
      var conv = s.tauxConversion == null
        ? '<div class="card zero"><b>—</b><span>aucun essai vu pour l\\u2019instant</span></div>'
        : '<div class="card act" role="button" tabindex="0" data-t="parc" style="cursor:pointer"><b>'
          + s.tauxConversion + ' %</b><span>' + h(pl(s.essaisConvertis, 'essai') + ' devenu'
          + (s.essaisConvertis > 1 ? 's' : '') + ' client sur ' + s.essaisVus) + '</span></div>';
      $('cards').innerHTML = CARTES.map(function (c) {
        var n = Number(s[c.k]) || 0;
        return '<div class="card ' + c.c + (n ? '' : ' zero') + '" role="button" tabindex="0" data-t="' + c.t + '" style="cursor:pointer"><b>' + n + '</b><span>' + (n >= 2 ? c.p : c.s) + '</span></div>';
      }).join('') + conv;
      // L'argent : combien encaissé cette année, combien attend. Groupé par DEVISE — additionner
      // des dinars et des euros est la faute de la 7.16.0, et elle ne se voit pas.
      var a = s.argent || { annee: '', lignes: [] };
      // L'eyebrow porte la PÉRIODE et la DEVISE, le nombre porte le montant : « ENCAISSÉ EN 2026 »
      // posé sur « 690,000 TND » est une unité de lecture (9.4.3). « En attente » n'a PAS d'année —
      // une vente de l'an dernier qui n'est pas payée attend toujours, et c'est justement celle-là
      // qu'on veut voir — et elle s'ouvre, parce qu'un chiffre affiché s'ouvre (7.15.0).
      $('argent').innerHTML = a.lignes.length
        ? a.lignes.map(function (g) {
            return '<div class="sous rentre"><span class="eyebrow">' + h('Encaissé en ' + a.annee) + '</span>'
                + '<span class="n">' + h(montant(g.encaisse, g.devise)) + '</span></div>'
              + (g.nbAttente ? '<div class="sous du" role="button" tabindex="0" data-t="ventes">'
                  + '<span class="eyebrow">En attente</span>'
                  + '<span class="n">' + h(montant(g.attente, g.devise)) + '</span>'
                  + '<span class="q">' + h(pl(g.nbAttente, 'vente') + ' livrée' + (g.nbAttente > 1 ? 's' : '') + ', rien d\\u2019encaissé') + '</span></div>' : '');
          }).join('')
        : '<div class="sous"><span class="eyebrow">Encaissé</span><span class="n">—</span>'
          + '<span class="q">Aucune vente : les montants apparaîtront ici.</span></div>';
      Array.prototype.forEach.call($('argent').querySelectorAll('[data-t]'), function (el) {
        var aller = function () { onglet = el.dataset.t; dessiner(); };
        el.onclick = aller;
        el.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); aller(); } };
      });
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
      lignesEcran = d.lignes || [];
      if (onglet === 'alertes') { aDecider = lignesEcran.reduce(function (s, x) { return s + (Number(x.n) || 1); }, 0); dessinerRail(); }
      dessinerTable();
    }, montrerErreur);
  }

  // Le tableau seul, pour que la frappe dans la recherche ne redessine ni le rail, ni l'en-tête,
  // ni les chiffres : un champ qui se recrée à chaque caractère est un champ dans lequel on ne
  // peut pas écrire (7.17.0), et c'est exactement ce qui arriverait en rappelant dessiner().
  function dessinerTable() {
    var q = recherche.trim().toLowerCase();
    // On cherche dans ce que la ligne PORTE, pas dans ce que l'écran en affiche : le formatage
    // d'une date ou d'un montant change avec la colonne, la donnée non.
    var lignes = !q ? lignesEcran : lignesEcran.filter(function (r) {
      return Object.keys(r).some(function (k) {
        var v = r[k];
        return (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().indexOf(q) >= 0;
      });
    });
    if (!lignes.length) {
      // Un écran vide parce qu'on a filtré n'est PAS un écran vide : le dire évite de croire que
      // la base a perdu quelque chose, et le bouton rend la main (9.4.6 — un filtre qu'on ne voit
      // pas est un piège).
      $('table').innerHTML = q
        ? '<div class="wrap"><div class="vide">Rien qui corresponde à « ' + h(recherche.trim()) + ' » dans '
          + h(TITRES[onglet].toLowerCase()) + '.<br><button type="button" class="btn" id="q-vider" style="margin-top:12px">Effacer la recherche</button></div></div>'
        : '<div class="wrap"><div class="vide">' + VIDES[onglet] + '</div></div>';
      if ($('q-vider')) $('q-vider').onclick = function () { recherche = ''; dessinerTete(); dessinerTable(); };
      return;
    }
    {
      var cols = COLONNES[onglet];
      var html = '<div class="wrap"><table><thead><tr>' +
        cols.map(function (c) {
          var cl = (c.n ? 'num' : '') + (c.a ? ' acts' : '');
          return '<th' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + '>' + c.t + '</th>';
        }).join('') +
        '</tr></thead><tbody>' +
        lignes.map(function (r) {
          return '<tr>' + cols.map(function (c) {
            var v = r[c.k];
            var texte = c.f ? c.f(v, r) : (v == null || v === '' ? '—' : v);
            var cl = (c.n ? 'num ' : '') + (c.m ? 'mono ' : '') + (c.l ? 'libre ' : '') + (c.a ? 'acts' : '');
            return '<td' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + '>' + (c.brut ? texte : h(texte)) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      $('table').innerHTML = html;
      // Les boutons de ligne : un seul gestionnaire, qui retrouve la LIGNE au moment du clic (le
      // tableau a pu être redessiné entre-temps — piège 7.17.0).
      $('table').onclick = function (e) {
        var b = e.target.closest('button[data-act]'); if (!b) return;
        // « À décider » nomme un ensemble : il doit pouvoir l'OUVRIR (7.15.0). Cette action-là ne
        // désigne pas une ligne de la table, elle désigne un onglet — elle passe donc avant la
        // recherche de la ligne, qui ne trouverait rien et avalerait le clic en silence.
        if (b.dataset.act === 'aller') { onglet = b.dataset.onglet; dessiner(); return; }
        var r = lignes.find(function (x) { return String(x.id) === b.dataset.id; }); if (!r) return;
        var act = b.dataset.act;
        if (act === 'voir') voirCle(r.id);
        else if (act === 'envoyer') envoyer(r);
        else if (act === 'renouveler') formEmettre(r, 'renouveler');
        else if (act === 'offre') formEmettre(r, 'offre');
        else if (act === 'revoquer') revoquer(r);
        else if (act === 'payee') payee(r);
        else if (act === 'facturee') facturee(r);
        else if (act === 'ecrire') ecrire(r);
      };
    }
  }

  if (secret) {
    api('stats').then(function () { $('lock').hidden = true; $('app').hidden = false; dessiner(); },
      function () { sessionStorage.removeItem(CLE); secret = ''; $('sec').focus(); });
  } else { $('sec').focus(); }
})();
</script>
</body></html>`;
