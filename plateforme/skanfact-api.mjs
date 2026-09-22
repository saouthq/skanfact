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
  // 10.5.0 — la vérification PUBLIQUE d'une empreinte de licence : sans secret, et sans rien
  // divulguer de plus que ce que celui qui la présente sait déjà. C'est le seul espace ouvert.
  verif: ['licence'],
  // 10.9.0 — l'ACHAT en ligne, ouvert au site. Public comme `verif`, et pour la même raison : c'est
  // un visiteur qui l'appelle, depuis une page, avant d'être qui que ce soit pour nous. Ce qui le
  // protège n'est pas un secret — il n'en a pas — c'est que RIEN de ce qu'il envoie ne décide d'un
  // montant, et que la preuve du paiement se redemande au prestataire, jamais au navigateur.
  achat: ['tarifs', 'commander', 'etat', 'webhook'],
  admin: ['etat', 'stats', 'clients', 'licences', 'activations', 'ventes', 'evenements', 'importer',
    // 10.9.0 — les commandes en ligne, et le bouton qui redemande une preuve au prestataire.
    'commandes',
    // 10.4.0 — l'espace de gestion : le parc des DEUX applications, les cabinets, ce qui demande une
    // décision, la santé des canaux de mise à jour, et l'export de la base.
    'parc', 'cabinets', 'alertes', 'sante', 'export',
    // 10.5.0 — les réglages (prix, seuils), les essais nommés un par un, et le pli scellé.
    'reglages', 'essais', 'pli']
};
// `relance` et `devis` sont les sous-actions qui se LISENT (GET) : elles ne changent rien, elles
// composent le texte d'un mail que l'éditeur relira dans sa propre messagerie avant de l'envoyer.
const SOUS_ACTIONS = ['revoquer', 'renouveler', 'changer-offre', 'envoyer', 'payee', 'facturee', 'relance', 'suivi', 'devis',
  // 10.9.0 — redemander au prestataire où en est une commande, et abandonner un panier resté ouvert.
  'verifier', 'abandonner'];
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

// La console. Un secret long et tiré au hasard, posé dans les réglages du worker — il n'y a qu'un
// administrateur, et une table d'utilisateurs pour une personne serait du décor.
//
// Un secret trop court est refusé À LA CONFIGURATION, pas à l'usage : mieux vaut un écran qui dit
// « mal réglé » qu'une console qu'on croit fermée et qui s'ouvre en devinant « skanfact ».
//
// 10.5.0 — un SECOND secret est accepté, `ADMIN_SECRET_2`, et il n'existe que pour une raison :
// changer le premier. Sans lui, remplacer le secret ferme la console à la seconde où on le
// remplace — et c'est ce qui fait qu'on ne le remplace jamais, y compris le jour où il faudrait.
// Les deux valent pendant la rotation ; on retire le second quand elle est finie. Le second est
// tenu aux MÊMES exigences que le premier : un secret de rotation court serait une porte de
// service, c'est-à-dire exactement ce qu'on croit ne pas avoir.
export const ADMIN_MIN = 24;
export function autoriseAdmin(headers, env) {
  const e = env || {};
  const attendu = String(e.ADMIN_SECRET || '').trim();
  const second = String(e.ADMIN_SECRET_2 || '').trim();
  if (!attendu) return { ok: false, code: 503, message: 'Console non configurée : ADMIN_SECRET manque.' };
  if (attendu.length < ADMIN_MIN) {
    return { ok: false, code: 503, message: 'Console mal configurée : ADMIN_SECRET fait moins de ' + ADMIN_MIN + ' caractères.' };
  }
  if (second && second.length < ADMIN_MIN) {
    return { ok: false, code: 503, message: 'Console mal configurée : ADMIN_SECRET_2 fait moins de ' + ADMIN_MIN + ' caractères. Retire-le ou allonge-le.' };
  }
  const donne = (headers && headers.get('x-skanfact-admin')) || '';
  if (memeSecret(donne, attendu)) return { ok: true, secret: 'principal' };
  if (second && memeSecret(donne, second)) return { ok: true, secret: 'rotation' };
  return { ok: false, code: 403, message: 'Accès refusé.' };
}

// Ce que l'écran des réglages dit de la rotation. On n'affiche jamais un secret, ni un fragment :
// ce qu'on montre, c'est s'il y en a un second et ce qu'il reste à faire.
export function etatSecret(env) {
  const e = env || {};
  const second = String(e.ADMIN_SECRET_2 || '').trim();
  if (!second) {
    return { rotation: false, phrase: 'Un seul secret d\'administration.',
      quoi: 'Pour le changer sans te fermer la porte : pose le nouveau dans « ADMIN_SECRET_2 », ouvre la console avec, puis remplace « ADMIN_SECRET » par lui et retire le second.' };
  }
  return { rotation: true, phrase: 'Rotation en cours : deux secrets ouvrent la console.',
    quoi: 'Termine-la — recopie le nouveau dans « ADMIN_SECRET », puis SUPPRIME « ADMIN_SECRET_2 ». Deux portes laissées ouvertes, c\'est une porte de plus à perdre.' };
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
// ---------- le prestataire de paiement (10.9.0) ----------
// La production. C'est le DÉFAUT d'un réglage, pas une adresse figée : le bac à sable du
// prestataire porte un autre nom d'hôte, et essayer un paiement sans encaisser un dinar ne doit pas
// demander un déploiement. C'est aussi pour ça qu'elle est exportée — le test qui compte les
// sorties du worker la nomme par RÉFÉRENCE, jamais par motif (10.8.0-beta.6).
export const KONNECT_API = 'https://api.konnect.network/api/v2';

// ---------- les réglages : ce qui se DÉCIDE, et qui se change depuis l'écran ----------
// 10.5.0. Jusqu'ici un prix vivait dans une variable du worker (`PRIX_ENTREPRISE`) et une signature
// de mail vivait EN DUR dans `mailRelance` : changer un tarif demandait un déploiement, changer une
// signature demandait un commit. Un réglage qu'on ne peut pas changer depuis l'écran n'est pas un
// réglage, c'est une constante avec un nom trompeur.
//
// TROIS RANGS, du plus fort au plus faible : la table `reglages` de la base, sinon la variable du
// worker, sinon le défaut écrit ici. L'ordre compte — poser une valeur depuis l'écran doit pouvoir
// CORRIGER une variable mal réglée sans toucher à Cloudflare, jamais l'inverse.
//
// Et une chose n'est PAS réglable, exprès : la durée de l'essai (`ESSAI_JOURS`). Ce n'est pas une
// politique de la console, c'est la règle de l'application (8.0.0) — un chiffre réglé ici la
// laisserait diverger en silence de ce que le client vit vraiment sur sa machine, et la console
// annoncerait des fins d'essai fausses. L'écran des réglages le DIT plutôt que de le taire.
export const REGLAGES = [
  // — Ce qu'on vend.
  { id: 'prix_independant', groupe: 'Prix', label: 'Indépendant, par an', type: 'montant', env: 'PRIX_INDEPENDANT', defaut: 390,
    aide: 'Proposé dans le formulaire d\'émission. Il ne décide de rien : le montant se corrige à chaque vente.' },
  { id: 'prix_entreprise', groupe: 'Prix', label: 'Entreprise, par an', type: 'montant', env: 'PRIX_ENTREPRISE', defaut: 690,
    aide: 'Proposé dans le formulaire d\'émission. Il ne décide de rien : le montant se corrige à chaque vente.' },
  // Aucun défaut pour le Cabinet : ses tarifs ne sont pas fixés (l'avis de l'Ordre n'est pas revenu,
  // DIRECTION.md § 8), et un chiffre inventé deviendrait un tarif par simple préremplissage.
  { id: 'prix_cabinet_dossier', groupe: 'Prix', label: 'Un dossier de cabinet, par an', type: 'montant', env: 'PRIX_CABINET_DOSSIER', defaut: 0,
    aide: 'Ce qu\'un cabinet paie par dossier hors SkanFact, au-delà des trois gratuits. À zéro, le formulaire ne propose aucun montant et il se décide à la main.' },
  { id: 'remise_parrainage', groupe: 'Prix', label: 'Remise de parrainage', type: 'pourcent', env: 'REMISE_PARRAINAGE', defaut: 20,
    aide: 'La remise de la première année pour un client amené par un cabinet. Elle ne se réapplique pas au renouvellement.' },
  { id: 'devise', groupe: 'Prix', label: 'Devise', type: 'devise', env: 'DEVISE', defaut: 'TND',
    aide: 'Trois lettres. Elle est écrite sur chaque vente : la changer ne convertit rien de ce qui est déjà vendu.' },
  { id: 'lien_paiement', groupe: 'Prix', label: 'Lien de paiement', type: 'url', env: 'LIEN_PAIEMENT', defaut: '',
    aide: 'L\'adresse où un client règle en ligne. Elle est ajoutée aux relances d\'impayé quand elle est réglée, et disparaît de la phrase sinon.' },
  { id: 'signature_mail', groupe: 'Prix', label: 'Signature des mails', type: 'texte', env: 'MAIL_SIGNATURE', defaut: 'Skander Ben Amor — SkanFact',
    aide: 'La dernière ligne des mails composés par la console. Vide, le mail s\'arrête à la formule de politesse.' },

  // — Ce qu'un achat en ligne fait payer (10.9.0). Les deux premiers sont des règles de DROIT, pas
  // des choix : ils portent leur « À VÉRIFIER », et ils sont réglables pour que la loi de finances
  // suivante ne demande pas un déploiement (règle 5.0.0 — aucun taux en dur dans un calcul).
  { id: 'tva_licence', groupe: 'Paiement en ligne', label: 'TVA sur une licence', type: 'pourcent', env: 'TVA_LICENCE', defaut: 19,
    aide: 'À VÉRIFIER avec le comptable. Ce qui est demandé en ligne doit être exactement ce que la facture dira : un écart d\'un millime laisse un solde impayé sur la pièce.' },
  { id: 'timbre_fiscal', groupe: 'Paiement en ligne', label: 'Timbre fiscal, par facture', type: 'montant', env: 'TIMBRE_FISCAL', defaut: 1,
    aide: 'À VÉRIFIER. SkanFact l\'ajoute tout seul à la facture : ne pas l\'encaisser en ligne laisserait la pièce due d\'un dinar, pour toujours.' },
  { id: 'konnect_wallet', groupe: 'Paiement en ligne', label: 'Identifiant du portefeuille', type: 'texte', env: 'KONNECT_WALLET', defaut: '',
    aide: 'Le compte qui reçoit l\'argent, tel que le prestataire le nomme. Vide, l\'achat en ligne est fermé et le site l\'annonce — il n\'échoue pas en silence.' },
  { id: 'konnect_api', groupe: 'Paiement en ligne', label: 'Adresse du prestataire', type: 'url', env: 'KONNECT_API', defaut: KONNECT_API,
    aide: 'La production par défaut. C\'est ici qu\'on pose l\'adresse du bac à sable pour essayer un paiement sans encaisser un dinar.' },
  { id: 'achat_retour', groupe: 'Paiement en ligne', label: 'Page de retour du site', type: 'url', env: 'ACHAT_RETOUR', defaut: '',
    aide: 'Où le payeur revient une fois la carte passée. La référence de sa commande y est ajoutée, et c\'est elle qui permet à la page de dire où en est sa clé.' },

  // — Quand la console doit parler. Chaque seuil est un jour où l'on décroche son téléphone.
  { id: 'alerte_fin', groupe: 'Alertes', label: 'Licence qui se termine', type: 'jours', defaut: 30,
    aide: 'Combien de jours avant la fin d\'une licence elle entre dans « À décider ».' },
  { id: 'jalon_renouvellement', groupe: 'Alertes', label: 'Préparer le renouvellement', type: 'jours', defaut: 60,
    aide: 'Un premier jalon, plus calme, qui laisse le temps de négocier. À zéro, il n\'existe pas.' },
  { id: 'alerte_essai', groupe: 'Alertes', label: 'Essai qui se termine', type: 'jours', defaut: 7,
    aide: 'Combien de jours avant la fin estimée d\'un essai on appelle le prospect.' },
  { id: 'silence_client', groupe: 'Alertes', label: 'Client sous licence devenu muet', type: 'jours', defaut: 45,
    aide: 'Un poste qui a payé et ne s\'annonce plus : désinstallation, réinstallation ratée ou réseau coupé. Dans les trois cas on appelle. À zéro, l\'alerte n\'existe pas.' },
  { id: 'alerte_export', groupe: 'Alertes', label: 'Copie de la base trop ancienne', type: 'jours', defaut: 30,
    aide: 'La base est le seul endroit où vit « qui a acheté quelle clé ».' },
  { id: 'parc_frais', groupe: 'Alertes', label: 'Un poste est « vu » depuis', type: 'jours', defaut: 30,
    aide: 'La fenêtre de fraîcheur du Parc : au-delà, un poste est compté « endormi ». Endormi n\'est pas perdu — il se compte à part, il ne se retranche pas.' },
  { id: 'version_minimale', groupe: 'Alertes', label: 'Version minimale attendue', type: 'texte', defaut: '',
    aide: 'Un poste sur une version antérieure entre dans « À décider ». Vide, l\'alerte n\'existe pas. Pour un logiciel comptable, un poste resté en arrière tourne sur du code dont on a corrigé des chiffres depuis.' },
  { id: 'version_motif', groupe: 'Alertes', label: 'Pourquoi cette version', type: 'texte', defaut: '',
    aide: 'Ce que la version minimale a corrigé. Sans ce motif, l\'alerte demande une mise à jour sans dire pourquoi — et on ne la fait pas.' }
];
const REGLAGE_PAR_ID = new Map(REGLAGES.map(r => [r.id, r]));

// Nettoyer UNE valeur selon son type. Rend `null` quand la valeur ne peut pas être retenue : c'est
// l'appelant qui décide s'il refuse ou s'il retombe sur le rang suivant.
export function valeurReglage(id, brut) {
  const def = REGLAGE_PAR_ID.get(id);
  if (!def) return null;
  const s = String(brut == null ? '' : brut).trim();
  if (def.type === 'montant' || def.type === 'pourcent' || def.type === 'jours') {
    if (s === '') return null;
    const x = Number(s.replace(',', '.'));
    if (!Number.isFinite(x) || x < 0) return null;
    if (def.type === 'pourcent' && x > 100) return null;
    // Un seuil est un nombre de jours entiers ; un demi-jour ne veut rien dire sur un calendrier.
    if (def.type === 'jours') return Math.round(x);
    return Math.round(x * 1000) / 1000;
  }
  if (def.type === 'devise') {
    // Une devise est un code à trois lettres. « dinar » ou « TND  » silencieusement acceptés
    // feraient passer des factures à deux décimales au lieu de trois (règle 7.30.0).
    const c = s.toUpperCase();
    return /^[A-Z]{3}$/.test(c) ? c : null;
  }
  if (def.type === 'url') {
    if (s === '') return '';
    // Tout ce qui vient d'un copier-coller se `trim()` — et une adresse qui ne s'analyse pas n'est
    // pas une adresse : la poser quand même la ferait partir telle quelle dans un mail (6.7.2).
    try { const u = new URL(s); if (u.protocol !== 'https:' && u.protocol !== 'http:') return null; } catch { return null; }
    return s.slice(0, 300);
  }
  return s.slice(0, 200);
}

// Pourquoi une valeur est refusée. Un refus dit TROIS choses (7.0.0) : ce qui est refusé, pourquoi,
// et ce qui débloque — ici, la forme attendue. « Valeur invalide » oblige à deviner.
export function refusReglage(def, brut) {
  const d = def || {};
  const formes = {
    montant: 'un montant positif, en chiffres (par exemple 390 ou 390,5)',
    pourcent: 'un pourcentage entre 0 et 100',
    jours: 'un nombre de jours entier et positif (0 = pas d\'alerte)',
    devise: 'un code de trois lettres (TND, EUR, USD…)',
    url: 'une adresse qui commence par https://',
    texte: 'du texte'
  };
  return 'attendu : ' + (formes[d.type] || formes.texte) + ' — reçu « ' + String(brut).slice(0, 40) + ' ».';
}

// Les valeurs qui s'appliquent VRAIMENT, et d'où chacune vient. La source part avec la valeur : un
// écran de réglages qui n'affiche que des nombres laisse croire qu'ils ont tous été décidés, alors
// que la plupart sont des défauts que personne n'a jamais regardés.
export function reglagesEffectifs(env, base) {
  const e = env || {};
  const b = base || {};
  const valeurs = {}, sources = {};
  REGLAGES.forEach(def => {
    const enBase = Object.prototype.hasOwnProperty.call(b, def.id) ? valeurReglage(def.id, b[def.id]) : null;
    if (enBase !== null) { valeurs[def.id] = enBase; sources[def.id] = 'base'; return; }
    const enEnv = def.env && e[def.env] != null && String(e[def.env]).trim() !== '' ? valeurReglage(def.id, e[def.env]) : null;
    if (enEnv !== null) { valeurs[def.id] = enEnv; sources[def.id] = 'worker'; return; }
    valeurs[def.id] = def.defaut; sources[def.id] = 'defaut';
  });
  return { valeurs, sources };
}

// Les tarifs, sous la forme que le formulaire d'émission attend depuis la 8.5.0. Ils ne servent
// qu'à préremplir un champ — aucun montant n'est jamais calculé à partir d'eux sans passer par
// l'écran. La forme ne bouge pas ; ce qui change, c'est d'où viennent les nombres.
export function tarifs(env, base) {
  const v = reglagesEffectifs(env, base).valeurs;
  return {
    independant: v.prix_independant,
    entreprise: v.prix_entreprise,
    cabinetDossier: v.prix_cabinet_dossier,
    remiseParrainage: v.remise_parrainage,
    devise: v.devise,
    lienPaiement: v.lien_paiement,
    signature: v.signature_mail
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

// Une référence PUBLIQUE, qui voyage dans une adresse de retour et que n'importe qui peut essayer
// de deviner : seize octets, pas quatre. `idCourt` suffit pour une licence ou une vente — on ne les
// atteint qu'avec le secret d'administration — mais une commande se relit sans secret, et une
// référence qu'on peut énumérer est une référence qu'on énumérera.
export function idLong() {
  const b = new Uint8Array(16);
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
  // 10.8.0 — « sans limite ». Un ÉTAT, pas un quota énorme : une clé à 99 999 dossiers ferait
  // afficher au cabinet un nombre que personne n'a décidé. Quand il est posé, le quota ne se
  // demande plus — réclamer un chiffre dont on vient de dire qu'il ne sert pas est un piège.
  const illimite = c.illimite === true || c.illimite === 'true' || c.illimite === 1 || c.illimite === '1';
  if (type === 'cabinet') {
    if (!cabinet) return { ok: false, erreur: 'Une licence de cabinet est attachée à son EMPREINTE : les vingt caractères que le comptable lit dans SkanFact Cabinet → Réglages → Mon cabinet.' };
    if (!illimite) {
      dossiersHors = Math.round(Number(c.dossiersHors));
      if (!Number.isFinite(dossiersHors) || dossiersHors < 1 || dossiersHors > 5000) {
        return { ok: false, erreur: 'Combien de dossiers hors SkanFact cette licence couvre-t-elle, en plus des trois gratuits ? (entre 1 et 5000) — ou coche « sans limite ».' };
      }
    }
  } else if (illimite) {
    return { ok: false, erreur: '« Sans limite » ne concerne que les dossiers d\'un CABINET : une licence d\'entreprise n\'en compte aucun.' };
  }
  const payeeLe = c.payeeLe ? String(c.payeeLe).trim() : '';
  if (payeeLe && !dateValide(payeeLe)) return { ok: false, erreur: 'La date de paiement n\'est pas une date (AAAA-MM-JJ).' };
  const devise = String(c.devise || 'TND').trim().toUpperCase().slice(0, 3) || 'TND';
  return {
    ok: true,
    e: {
      type, dossiersHors, illimite: type === 'cabinet' && illimite,
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
    if (x.illimite === true || x.illimite === 1) return 'Cabinet — dossiers sans limite';
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

// ---------- l'achat en ligne (10.9.0) ----------
// Tout ce qui suit est pur : les décisions d'un paiement se testent sans réseau et sans base, comme
// celles d'une licence. Ce qui les rend délicates n'est pas le calcul, c'est QUI parle — un
// visiteur, avant d'être quoi que ce soit pour nous.

// Ce qui s'achète en ligne, et ce qui ne s'achète pas. Une licence de CABINET en est absente, et ce
// n'est pas un oubli : son tarif n'est pas fixé (l'avis de l'Ordre n'est pas revenu, DIRECTION.md
// § 8), et le réglage `prix_cabinet_dossier` vaut zéro pour cette raison. Vendre en ligne au prix
// zéro, ou à un prix inventé pour l'occasion, sont aussi faux l'un que l'autre.
export const OFFRES_EN_LIGNE = ['independant', 'entreprise'];

// La durée d'un achat en ligne : un an, et rien d'autre. Une durée choisie par l'acheteur serait un
// second levier sur le prix, et il n'en a aucun.
export const DUREE_EN_LIGNE = '1a';

// Le prix HT d'une offre, tel que la console le règle. `null` quand rien n'est réglé : l'appelant
// le DIT au lieu de vendre à zéro.
export function prixEnLigne(offre, valeurs) {
  if (!OFFRES_EN_LIGNE.includes(String(offre || ''))) return null;
  const v = valeurs || {};
  const p = Number(offre === 'independant' ? v.prix_independant : v.prix_entreprise);
  return Number.isFinite(p) && p > 0 ? p : null;
}

// Ce que le SITE a le droit d'envoyer. La liste est courte exprès, et on remarquera ce qui n'y est
// pas : ni prix, ni remise, ni durée, ni type de licence. Le navigateur décrit un acheteur et une
// offre ; tout ce qui chiffre est calculé ici. Un montant venu de la page se ferait corriger à
// 1 DT par la première console de développement venue.
//
// L'adresse e-mail est OBLIGATOIRE — contrairement à une émission depuis la console, où l'éditeur
// peut copier la clé à la main. En ligne il n'y a personne pour la copier : sans adresse, on
// vendrait une clé qui n'arrive nulle part.
export function nettoyerCommande(corps) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const offre = String(c.offre || '').trim();
  if (!OFFRES_EN_LIGNE.includes(offre)) {
    return { ok: false, erreur: 'Choisis une offre : Indépendant ou Entreprise. Une licence de cabinet se règle avec nous.' };
  }
  const nom = texteNet(c.nom, 120);
  if (!nom || nom.length < 2) return { ok: false, erreur: 'Indique le nom de ton entreprise (deux caractères au moins).' };
  const email = (texteNet(c.email, 200) || '').toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, erreur: 'Indique une adresse e-mail : c\'est par là que la clé arrive.' };
  // L'empreinte du parrain se lit avec ou sans ses séparateurs (9.4.1) — mais on ne retire que les
  // SÉPARATEURS : un « G » tapé pour un « 6 » doit rester une faute visible (8.1.0). Annoncée
  // fausse, elle est refusée ici plutôt que silencieusement ignorée : quelqu'un qui tape le code de
  // son comptable attend une remise, et l'absence de réponse est la pire façon de la lui refuser.
  const cabinet = String(c.cabinet || '').trim().toLowerCase().replace(/[\s:._-]/g, '');
  if (cabinet && !CABINET.test(cabinet)) {
    return { ok: false, erreur: 'Le code de ton comptable fait vingt caractères (cinq groupes de quatre) : vérifie-le, ou laisse la case vide.' };
  }
  return {
    ok: true,
    c: {
      offre, nom, email, cabinet,
      matricule: (texteNet(c.matricule, 30) || '').toUpperCase(),
      tel: texteNet(c.tel, 40) || ''
    }
  };
}

// Ce qui est réellement demandé au payeur. Trois choses s'ajoutent au prix, et l'ordre compte :
// la remise s'applique au HT, la TVA au HT remisé, et le timbre vient APRÈS la TVA — c'est un
// droit fixe par facture, pas une base imposable.
//
// Le timbre n'est pas une coquetterie : SkanFact l'ajoute tout seul à la facture qu'il émettra
// depuis cette vente. Ne pas l'encaisser laisserait la pièce due d'un dinar, pour toujours, sur
// chaque vente en ligne — un impayé permanent que personne ne comprendrait six mois plus tard.
export function montantCommande(o) {
  const x = o || {};
  const r3 = n => Math.round(n * 1000) / 1000;
  const ht = Math.max(0, Number(x.prixHT) || 0);
  const remise = Math.min(100, Math.max(0, Number(x.remise) || 0));
  const montantHT = r3(ht * (1 - remise / 100));
  const tva = r3(montantHT * Math.max(0, Number(x.tvaTaux) || 0) / 100);
  const timbre = r3(Math.max(0, Number(x.timbre) || 0));
  return { ht: r3(ht), remise, montantHT, tva, timbre, ttc: r3(montantHT + tva + timbre) };
}

// Le prestataire compte en MILLIMES, en entier. Un montant à trois décimales s'y traduit sans
// perte — le dinar en a exactement trois — mais `Math.round` reste indispensable : 301.29 * 1000
// vaut 301289.99999999994 en virgule flottante, et un centième de millime en moins ferait refuser
// le paiement pour cause de montant qui ne correspond pas.
export function millimes(montant) {
  return Math.round((Number(montant) || 0) * 1000);
}

// La seule chose qui PROUVE un paiement. Le webhook du prestataire n'est pas signé : n'importe qui
// peut l'appeler. Il ne vaut donc que comme notification — « va regarder » — et c'est cette
// fonction qui juge ce que le prestataire a répondu à notre propre question, posée avec notre clé.
//
// Trois conditions, et chacune ferme une porte :
//   - le statut est « completed » : ni « pending », ni « failed », ni un mot qu'on ne connaît pas ;
//   - la commande référencée est bien LA nôtre (`orderId`) : sans ça, la preuve d'un paiement
//     pourrait être présentée pour une autre commande, moins chère ;
//   - le montant encaissé est celui qu'on a demandé : un paiement partiel n'est pas un paiement.
export function verdictPaiement(o) {
  const x = o || {};
  const p = x.paiement && typeof x.paiement === 'object' ? x.paiement : null;
  if (!p) return { ok: false, etat: 'inconnu', raison: 'Le prestataire n\'a pas rendu ce paiement.' };
  const statut = String(p.status || '').toLowerCase();
  if (statut !== 'completed') {
    return { ok: false, etat: statut || 'inconnu', raison: 'Le paiement n\'est pas encaissé (état « ' + (statut || 'inconnu') + '»).' };
  }
  const commande = x.commande || {};
  if (String(p.orderId || '') !== String(commande.id || '')) {
    return { ok: false, etat: 'autre', raison: 'Ce paiement porte la référence d\'une autre commande.' };
  }
  const du = millimes(commande.montant_ttc);
  const recu = Math.round(Number(p.amount) || 0);
  if (recu !== du) {
    return { ok: false, etat: 'montant', raison: 'Le montant encaissé (' + recu + ' millimes) n\'est pas celui de la commande (' + du + ').' };
  }
  return { ok: true, etat: 'completed', raison: '' };
}

// Où le payeur revient. L'adresse vient d'un réglage ; la référence de sa commande y est ajoutée,
// et c'est elle qui permet à la page du site de dire où en est sa clé. `r` dit d'où il revient —
// une page qui ne le sait pas afficherait « merci » à quelqu'un qui vient d'annuler.
export function retourAchat(base, id, ok) {
  const b = String(base || '').trim();
  if (!b) return '';
  try {
    const u = new URL(b);
    u.searchParams.set('commande', String(id || ''));
    u.searchParams.set('r', ok ? 'ok' : 'echec');
    return u.toString();
  } catch { return ''; }
}

// Ce que la page publique de retour apprend, et ce qu'elle n'apprend pas. Elle ne rend JAMAIS la
// clé : la référence voyage dans une adresse, qui se copie, se partage et se retrouve dans un
// historique de navigateur. La clé part par mail, et si le mail échoue, c'est la console qui le
// dit en rouge — pas une page publique qui la distribuerait à qui a l'adresse.
export function etatCommandePublic(cmd) {
  const c = cmd || {};
  const base = { offre: c.offre || '', montant: c.montant_ttc, devise: c.devise || '' };
  if (c.etat === 'payee') {
    return { ...base, etat: 'payee',
      phrase: 'Paiement reçu. Ta clé de licence part à ' + masquerEmail(c.email) + ' — vérifie tes indésirables si elle tarde.' };
  }
  if (c.etat === 'abandonnee') {
    return { ...base, etat: 'abandonnee', phrase: 'Cette commande a été abandonnée. Reprends-en une nouvelle quand tu veux.' };
  }
  if (c.paiement_le) {
    // Payé, et la clé n'est pas partie. On ne le cache pas : le client a donné son argent, il a le
    // droit de savoir que quelque chose cloche, et de savoir que nous le savons.
    return { ...base, etat: 'en_cours',
      phrase: 'Paiement reçu. La clé n\'est pas encore partie — nous en sommes prévenus, et elle arrivera à ' + masquerEmail(c.email) + '.' };
  }
  return { ...base, etat: 'ouverte', phrase: 'Cette commande attend son paiement.' };
}

// « sk****r@gmail.com ». Assez pour qu'on reconnaisse SON adresse, pas assez pour l'apprendre à
// quelqu'un qui aurait récupéré le lien.
export function masquerEmail(email) {
  const e = String(email || '');
  const at = e.indexOf('@');
  if (at < 1) return '';
  const nom = e.slice(0, at);
  const cache = nom.length <= 2 ? nom[0] + '*' : nom[0] + '*'.repeat(Math.min(6, nom.length - 2)) + nom[nom.length - 1];
  return cache + e.slice(at);
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
    dossiersHors: Math.max(0, Math.round(Number(x.dossiersHors) || 0)),
    // 10.8.0 — « sans limite ». En QUEUE, pour la même raison que les deux champs ci-dessus : au
    // milieu, il changerait l'ordre des champs déjà signés. Une clé qui ne le porte pas vaut
    // `false`, donc rien de ce qui a été vendu ne bouge. C'est un ÉTAT, pas un très grand quota :
    // une clé à 99 999 dossiers afficherait un nombre que personne n'a décidé.
    illimite: x.illimite === true
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
  // Les réglages viennent de la base quand elle est là. `etatPlateforme` répond AVANT le contrôle
  // « la base est-elle branchée ? » — c'est ce qui permet à l'écran de dire pourquoi elle ne l'est
  // pas — donc la lecture doit survivre à son absence sans rien casser.
  const base = await lireReglages(e);
  return {
    base: !!e.DB,
    emission: { ok: ks.ok, kid: ks.kid, raison: ks.ok ? '' : ks.raison },
    mail: e.RESEND_API_KEY
      ? { ok: true, expediteur: String(e.MAIL_FROM || 'SkanFact <licences@send.skanfact.tn>') }
      : { ok: false, raison: 'RESEND_API_KEY manque : la clé se copie et s\'envoie à la main.' },
    reponse: !!e.REPONSE_PRIVATE_KEY,
    tarifs: tarifs(e, base),
    seuils: reglagesEffectifs(e, base).valeurs,
    offres: OFFRES,
    durees: DUREES
  };
}

// Les réglages rangés en base, sous forme d'objet. Jamais bloquant : une table absente (une base
// d'avant la 10.5.0, une migration pas encore collée) doit laisser la console fonctionner sur les
// variables du worker et ses défauts, exactement comme avant. Un écran qui refuse de s'ouvrir
// parce qu'un réglage manque est pire que le réglage manquant.
export async function lireReglages(env) {
  if (!env || !env.DB) return {};
  const res = await sansCasser(env.DB.prepare('SELECT cle, valeur FROM reglages').all(), null);
  const out = {};
  ((res && res.results) || []).forEach(l => { out[l.cle] = l.valeur; });
  return out;
}

// Le DERNIER suivi de chaque sujet, sous forme de table. C'est le plus récent qui décide : un
// prospect rappelé hier n'est pas « perdu » parce qu'on l'avait noté ainsi le mois dernier, et un
// historique se lit sur la fiche, pas dans ce qui fait taire une alerte.
export async function lireSuivis(tous) {
  const lignes = await tous(
    'SELECT s.sujet, s.quand, s.moyen, s.note, s.rappel, s.issue, s.motif, s.source, c.nom' +
    ' FROM suivis s LEFT JOIN clients c ON (\'client:\' || c.id) = s.sujet' +
    ' ORDER BY s.quand ASC LIMIT 2000');
  const out = {};
  lignes.forEach(l => { out[l.sujet] = l; });
  return out;
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
    // Une vente à montant NUL ne gonfle pas « en attente » de rien : elle y comptait une ligne
    // pour zéro dinar, et le chiffre annonçait donc « 3 ventes livrées, rien d'encaissé » là où
    // il n'y en avait que deux à encaisser. Un compteur et le montant qu'il accompagne portent
    // sur le même ensemble (6.8.1).
    else if (montant > 0) { g.attente += montant; g.nbAttente++; }
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
// Les seuils par défaut : ceux de la 10.4.0, pour que `alertesPlateforme(d, jour)` sans troisième
// argument se comporte exactement comme avant. Ce sont les valeurs de `REGLAGES`, et un test les
// confronte — deux tables de défauts divergeraient au premier changement de tarif.
export const SEUILS_DEFAUT = {
  alerte_fin: ALERTE_FIN, jalon_renouvellement: 60, alerte_essai: ALERTE_ESSAI,
  silence_client: 45, alerte_export: ALERTE_EXPORT, version_minimale: '', version_motif: ''
};

// Un sujet SUIVI ne redemande rien : c'est toute la raison d'être du suivi (10.5.0). Trois états
// seulement — rappelé plus tard, gagné, perdu — et tout le reste redemande, parce qu'un prospect
// qu'on a « regardé » n'est pas un prospect traité.
//
// On suit une OCCURRENCE, jamais une règle (7.21.0) : le sujet d'un suivi est l'identifiant du
// prospect ou du client, donc faire taire l'échéance d'octobre ne fait pas taire celle de novembre.
export function suiviTait(suivis, sujet, jour) {
  const s = (suivis || {})[sujet];
  if (!s) return false;
  if (s.issue === 'perdu' || s.issue === 'gagne') return true;
  const r = String(s.rappel || '').slice(0, 10);
  return !!(r && dateValide(r) && dateValide(jour) && r >= jour);
}

export function alertesPlateforme(d, aujourdhui, seuils) {
  const o = d || {};
  const s = { ...SEUILS_DEFAUT, ...(seuils || {}) };
  const jour = String(aujourdhui || '').slice(0, 10);
  const suivis = o.suivis || {};
  const out = [];
  // `sujet2` est l'identifiant du SUIVI auquel l'alerte appartient — le client pour ce qui se
  // négocie, le poste pour un essai. Les alertes qui ne parlent pas à quelqu'un (une clé qu'on a
  // oublié d'envoyer, une base jamais copiée) n'en ont pas : ce sont des gestes de l'éditeur, et
  // un coup de téléphone ne les règle pas.
  const add = (niveau, quoi, sujet, detail, onglet, id, sujet2) => {
    if (sujet2 && suiviTait(suivis, sujet2, jour)) return;
    out.push({ id: id || (quoi + ':' + sujet), niveau, quoi, sujet, detail, onglet, suivi: sujet2 || '' });
  };

  (o.licences || []).forEach(l => {
    const nom = l.client || l.id;
    const cli = l.client_id ? 'client:' + l.client_id : '';
    // Une clé jamais envoyée est une vente livrée à personne : le client a payé et attend.
    if (!l.envoyee_le && !l.revoquee_le && !l.remplacee_par) {
      add('alerte', 'Clé jamais envoyée', nom, 'La licence est signée et n\'est jamais partie.', 'licences', 'env:' + l.id);
    }
    if (l.revoquee_le || l.remplacee_par || !l.fin) return;
    const reste = dateValide(jour) && dateValide(l.fin) ? joursEntre(jour, l.fin) : null;
    if (reste === null) return;
    if (reste < 0) add('attention', 'Licence expirée', nom, 'Finie le ' + l.fin + '. Un renouvellement se propose, il ne se devine pas.', 'licences', 'exp:' + l.id, cli);
    else if (reste <= s.alerte_fin) add('attention', 'Licence qui se termine', nom, 'Fin le ' + l.fin + ' (' + reste + ' jour' + (reste === 1 ? '' : 's') + ').', 'licences', 'fin:' + l.id, cli);
    // Le jalon : une licence annuelle se NÉGOCIE en amont. À trente jours on presse, à soixante on
    // prépare — et le ton d'un appel n'est pas le même. Calme exprès : ce n'est pas une urgence,
    // c'est une occasion, et une occasion criée en rouge apprend à ignorer le rouge (8.0.1).
    else if (s.jalon_renouvellement > 0 && reste <= s.jalon_renouvellement) {
      add('calme', 'Renouvellement à préparer', nom, 'Fin le ' + l.fin + ' (' + reste + ' jours) : le temps d\'en parler sans presser.', 'licences', 'jal:' + l.id, cli);
    }
  });

  (o.ventes || []).forEach(v => {
    if (v.payee_le) return;
    // Une vente à MONTANT NUL n'a rien à encaisser : une licence de cabinet part à zéro tant que
    // les tarifs ne sont pas fixés (9.4.1), et la réclamer chaque matin apprend à ignorer la
    // colonne. Ce n'est pas un impayé, c'est une vente sans prix.
    if (!(Number(v.montant_ht) > 0)) return;
    add('attention', 'Vente à encaisser', v.client || v.id, 'Licence livrée, rien d\'encaissé.', 'ventes',
      'pay:' + v.id, v.client_id ? 'client:' + v.client_id : '');
  });

  // 10.9.0 — LA ligne la plus grave de cette console : un paiement encaissé en ligne dont la clé
  // n'est pas partie. Le client a donné son argent et n'a rien. Aucun autre signal ne le dit : la
  // commande n'est pas une vente (elle n'apparaît nulle part ailleurs), la licence n'existe pas
  // encore (donc pas de « clé jamais envoyée »), et la page du site ne peut que répondre « nous en
  // sommes prévenus ». Si cette alerte n'existe pas, personne ne l'est.
  (o.commandes || []).forEach(c => {
    if (c.etat !== 'ouverte' || !c.paiement_le) return;
    add('alerte', 'Paiement encaissé, clé non partie', c.nom || c.id,
      c.montant_ttc + ' ' + (c.devise || '') + ' payés le ' + String(c.paiement_le).slice(0, 10)
      + (c.echec ? ' — ' + String(c.echec).slice(0, 160) : '') + ' Le client attend.',
      'commandes', 'cmd:' + c.id);
  });

  // Un client qui a PAYÉ et ne s'annonce plus. C'est une désinstallation, une réinstallation ratée
  // ou un réseau coupé — dans les trois cas on appelle, et dans les trois cas on ne l'apprenait
  // nulle part : le Parc comptait ces postes « endormis » sans que rien ne le dise. Un départ de
  // client payant qui ne fait aucun bruit est le pire signal manquant d'un éditeur.
  if (s.silence_client > 0) {
    (o.postes || []).forEach(p => {
      if (p.empreinte === ESSAI) return;
      const vu = String(p.derniere_fois || '').slice(0, 10);
      if (!dateValide(jour) || !dateValide(vu)) return;
      const mut = joursEntre(vu, jour);
      if (mut <= s.silence_client) return;
      const quoi = APPS[appDe(p.app)] || APPS.entreprise;
      add('attention', 'Client sous licence devenu muet', p.client || p.device_nom || p.device_id,
        quoi + ' — plus un signe depuis le ' + vu + ' (' + mut + ' jours). Désinstallation, réinstallation ratée ou réseau coupé : dans les trois cas, on appelle.',
        'parc', 'muet:' + String(p.device_id || '') + ':' + appDe(p.app), p.client_id ? 'client:' + p.client_id : '');
    });
  }

  // Un poste resté en arrière. Pour un logiciel COMPTABLE ce n'est pas un confort : une version
  // ancienne tourne sur du code dont on a corrigé des chiffres depuis. Le seuil et son MOTIF se
  // règlent ensemble — une alerte qui réclame une mise à jour sans dire ce qu'elle corrige ne se
  // fait pas, et c'est ce motif que l'on répète au client au téléphone.
  const vmin = String(s.version_minimale || '').trim();
  if (vmin) {
    (o.postes || []).forEach(p => {
      const v = String(p.version || '').trim();
      if (!v || compVersion(v, vmin) >= 0) return;
      const quoi = APPS[appDe(p.app)] || APPS.entreprise;
      add('attention', 'Poste sur une version ancienne', p.client || p.device_nom || p.device_id,
        quoi + ' ' + v + ' — attendu ' + vmin + ' au minimum.' + (s.version_motif ? ' ' + String(s.version_motif).trim() : ''),
        'parc', 'ver:' + String(p.device_id || '') + ':' + appDe(p.app));
    });
  }

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
    if (reste > s.alerte_essai) return;
    const qui = String(a.device_nom || a.device_id || 'un ordinateur');
    const quoi = APPS[appDe(a.app)] || APPS.entreprise;
    const id = 'essai:' + String(a.device_id || '') + ':' + appDe(a.app);
    if (reste < 0) {
      add('attention', 'Essai terminé', qui,
        quoi + ' — essai commencé vers le ' + debut + ', fini vers le ' + fin + '. Personne n’a acheté.', 'parc', id, id);
    } else {
      add('alerte', 'Essai qui se termine', qui,
        quoi + ' — il reste ' + reste + ' jour' + (reste === 1 ? '' : 's') + ' (vers le ' + fin + '). C’est maintenant qu’on appelle.', 'parc', id, id);
    }
  });

  // Un rappel arrivé à échéance : on avait dit « je le rappelle le 12 », on est le 12. Sans cette
  // ligne, un prospect mis en attente disparaîtrait pour toujours de l'écran qui devait le rendre.
  Object.keys(suivis).forEach(sujet => {
    const su = suivis[sujet];
    if (!su || su.issue === 'perdu' || su.issue === 'gagne') return;
    const r = String(su.rappel || '').slice(0, 10);
    if (!r || !dateValide(r) || !dateValide(jour) || r > jour) return;
    add('alerte', 'Rappel prévu aujourd\'hui', su.nom || sujet,
      'Tu avais noté de rappeler le ' + r + (su.note ? ' — ' + String(su.note).slice(0, 120) : '') + '.',
      sujet.indexOf('essai:') === 0 ? 'essais' : 'clients', 'rap:' + sujet);
  });

  // L'export de la base : la seule chose dont la disparition ne se rattrape pas. Sans lui, une base
  // perdue emporte QUI a acheté QUOI — et aucune clé vendue ne peut plus être réémise ni révoquée.
  //
  // Mais on vérifie d'abord que l'univers concerné n'est pas VIDE (7.0.0) : une console où rien
  // n'a encore été vendu n'a rien à perdre, et réclamer une copie du néant au premier écran d'un
  // logiciel qu'on vient d'installer apprend à ignorer les alertes.
  const aPerdre = (o.licences || []).length > 0 || (o.ventes || []).length > 0;
  const exp = String(o.dernierExport || '').slice(0, 10);
  if (aPerdre && !exp) add('alerte', 'La base n\'a jamais été exportée', 'Plateforme', 'Un export range la base entière dans ~/.skanfact/. Sans lui, une base perdue emporte toutes les ventes.', 'reglages', 'exp:base');
  else if (aPerdre && dateValide(jour) && dateValide(exp) && joursEntre(exp, jour) > s.alerte_export) {
    add('attention', 'Export de la base ancien', 'Plateforme', 'Dernier export le ' + exp + '.', 'reglages', 'exp:base');
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
  } else if (type === 'devis') {
    // Un prospect demande un prix ÉCRIT avant d'acheter, et la console ne savait rien lui donner :
    // elle ne parlait qu'aux clients déjà facturés. Le prix vient des réglages, jamais du code.
    lignes.push('Merci de votre intérêt pour SkanFact.');
    lignes.push('');
    lignes.push('Voici ce que je vous propose' + (off ? ' — ' + off : '') + (mt ? ' : ' + mt + ' HT par an' : '') + '.');
    lignes.push('Vos données restent chez vous : SkanFact fonctionne sans connexion, et vos pièces restent lisibles, imprimables et exportables quoi qu’il arrive.');
  } else {
    lignes.push('Je me permets de revenir vers vous au sujet de SkanFact.');
  }

  // Le lien de paiement : ce qui transforme une relance en encaissement. Réglé, il s'ajoute aux
  // messages où il a un sens — jamais sur une relance qui ne demande pas d'argent. Non réglé, il
  // DISPARAÎT de la phrase au lieu de laisser un vide (même règle que les faits ci-dessus).
  const lien = String(o.lien || '').trim();
  if (lien && (type === 'impayee' || type === 'fin' || type === 'expiree' || type === 'devis')) {
    lignes.push('', type === 'impayee' ? 'Vous pouvez régler en ligne ici : ' + lien : 'Pour régler en ligne : ' + lien);
  }

  // La signature se règle depuis l'écran : elle était écrite EN DUR ici, donc changer de nom
  // demandait un commit. Vide, le mail s'arrête à la formule de politesse plutôt que de laisser
  // une ligne blanche sous « Bien cordialement ».
  const sig = String(o.signature == null ? 'Skander Ben Amor — SkanFact' : o.signature).trim();
  lignes.push('', 'Bien cordialement,');
  if (sig) lignes.push(sig);
  const sujets = {
    fin: 'Votre licence SkanFact' + (fin ? ' se termine le ' + fin : ' arrive à son terme'),
    expiree: 'Votre licence SkanFact est arrivée à son terme',
    impayee: 'Votre licence SkanFact — règlement',
    devis: 'SkanFact — votre proposition'
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
      par.set(cle, { id: cle, niveau: a.niveau, quoi: a.quoi, detail: a.detail, onglet: a.onglet, n: 0, tous: [], ids: [], suivis: [] });
      ordre.push(cle);
    }
    const g = par.get(cle);
    g.n += 1;
    // Rien ne se perd dans un repli : le groupe garde l'identifiant de CHACUN de ses membres. Sans
    // eux, replier reviendrait à jeter ce qui permettra un jour d'agir sur une alerte précise.
    if (a.id) g.ids.push(a.id);
    // Le sujet du SUIVI, pour que la ligne porte « Suivre… » quand elle ne parle que d'un seul
    // prospect. Replié sur trois clients, le bouton n'a plus de destinataire unique — et un geste
    // qui agirait sur trois personnes d'un coup sans le dire serait pire que pas de geste.
    if (a.suivi && g.suivis.indexOf(a.suivi) < 0) g.suivis.push(a.suivi);
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

// Le NOM de chaque table, en français. L'écran écrivait `evenements` et `jetons` — les noms SQL,
// tels quels, accent manquant compris. C'est la même famille que « 1 dossier(s) » : ça ne casse
// rien, et ça dit à celui qui lit que personne n'a regardé cet écran.
// Le SINGULIER, parce que `pl` accorde : une table nommée « clients » ici donnerait « 0 clientss »
// au premier export vide. Le pluriel irrégulier s'écrit à côté quand la règle du « s » ne suffit
// pas — « jetons de poste » et non « jeton de postes ».
export const EXPORT_LABELS = {
  clients: ['client'], licences: ['licence'], activations: ['activation'],
  ventes: ['vente'], jetons: ['jeton de poste', 'jetons de poste'], evenements: ['événement']
};
export function resumeExport(comptes) {
  return EXPORT_TABLES.map(t => {
    const l = EXPORT_LABELS[t] || [t];
    return pl(Number((comptes || {})[t]) || 0, l[0], l[1]);
  }).join(' · ');
}

// ---------- la copie automatique de la base (10.5.0) ----------
// Jusqu'ici la copie demandait un CLIC, et une copie qui demande un clic est une copie qu'on ne
// fait pas : l'alerte à trente jours existait précisément parce que le geste ne se faisait pas.
// Le déclencheur programmé du worker l'écrit dans un bucket R2, toutes les nuits.
//
// Tant que le bucket n'existe pas, rien ne plante et rien ne ment : l'écran DIT ce qui manque,
// exactement comme le relais non branché (10.4.0). Un mécanisme qui ne peut pas fonctionner doit
// le dire, jamais s'afficher en vert.
export const R2_BINDING = 'SAUVEGARDES';
export function etatSauvegarde(env, dernierExport) {
  const e = env || {};
  const dernier = String(dernierExport || '').slice(0, 10);
  if (!e[R2_BINDING]) {
    return { auto: false, dernier,
      raison: 'La copie automatique n\'est pas branchée : il manque un bucket R2 nommé « ' + R2_BINDING + ' » dans les réglages du worker.',
      quoi: 'Crée un bucket R2, lie-le au worker sous ce nom, et ajoute un déclencheur programmé (cron) — la copie partira toute seule chaque nuit. D\'ici là, « Exporter la base… » reste le seul chemin, et c\'est un geste à faire à la main.' };
  }
  return { auto: true, dernier, raison: '', quoi: 'Une copie complète part chaque nuit dans le bucket « ' + R2_BINDING + ' ». « Exporter la base… » reste là pour en prendre une tout de suite.' };
}

// Ce que le pli scellé doit contenir, et pourquoi. Aucune clé privée n'en sort : ce qui sort est
// une PROCÉDURE et des chiffres. Le pli lui-même se prépare à la main — c'est le but : si la
// console pouvait le fabriquer seule, elle porterait déjà tout ce qu'il protège.
export function pliScelle(o) {
  const d = o || {};
  const c = d.comptes || {};
  return [
    'PLI SCELLÉ — SkanFact, préparé le ' + String(d.quand || ''),
    '',
    'Pourquoi ce pli existe : aujourd\'hui, une seule personne peut émettre, renouveler ou révoquer',
    'une licence SkanFact. La clé privée et le secret d\'administration vivent au même endroit. Si',
    'cette personne est absente six mois, aucun client ne peut être servi — et aucune sauvegarde',
    'ne répare ça, parce que ce n\'est pas une question de données.',
    '',
    'CE QUE LE PLI DOIT CONTENIR',
    '  1. La clé privée de licence (~/.skanfact/licence-privee.pem). C\'est elle qui signe les clés',
    '     vendues. Sans elle, aucune licence ne peut plus être émise ni renouvelée.',
    '  2. Le secret d\'administration de la console (réglage « ADMIN_SECRET » du worker).',
    '  3. Les accès Cloudflare (compte, worker, base D1) et le registrar du domaine.',
    '  4. Une copie récente de la base : ' + resumeExport(c) + '.',
    '  5. Cette page, qui dit dans quel ordre s\'en servir.',
    '',
    'COMMENT LE SCELLER',
    '  Le fichier chez une personne, le mot de passe chez une AUTRE : un pli dont les deux moitiés',
    '  voyagent ensemble n\'est pas scellé, c\'est une copie de plus. Deux supports distincts, et',
    '  l\'exercice se rejoue une fois par an — un pli qu\'on n\'a jamais ouvert est un pli dont on ne',
    '  sait pas s\'il fonctionne.',
    '',
    'CE QUI RESTE VRAI SANS LE PLI',
    '  Les clés déjà vendues continuent de fonctionner : elles sont vérifiées sur le poste du',
    '  client, hors ligne, contre une clé publique embarquée dans l\'application. Un client ne perd',
    '  jamais ses données ni son logiciel. Ce qui s\'arrête, c\'est la VENTE : plus une licence',
    '  émise, plus un renouvellement, plus une révocation.',
    '',
    d.kid ? 'Clé de signature en service : ' + d.kid : 'Aucune clé de signature n\'est en service sur ce worker.'
  ].join('\n');
}

// Écrire la copie dans R2. Rend toujours un verdict lisible — jamais une exception : ce code
// tourne dans un déclencheur programmé que personne ne regarde, et une panne muette y est pire
// qu'ailleurs.
export async function exporterVersR2(env, quand) {
  const e = env || {};
  if (!e.DB) return { ok: false, raison: 'La base n\'est pas branchée sur ce worker.' };
  const bucket = e[R2_BINDING];
  if (!bucket || typeof bucket.put !== 'function') return { ok: false, raison: 'Aucun bucket R2 « ' + R2_BINDING + ' » n\'est lié à ce worker.' };
  const tables = {};
  for (const nom of EXPORT_TABLES) {
    const res = await sansCasser(e.DB.prepare('SELECT * FROM ' + nom).all(), null);
    tables[nom] = (res && res.results) || [];
  }
  const doc = enveloppeExport(tables, quand);
  const texte = JSON.stringify(doc);
  const somme = hex(await crypto.subtle.digest('SHA-256', enc.encode(texte)));
  const nom = 'console-' + String(quand || '').slice(0, 10) + '.json';
  try { await bucket.put(nom, JSON.stringify({ ...doc, sha256: somme })); }
  catch (err) { return { ok: false, raison: 'R2 a refusé l\'écriture : ' + ((err && err.message) || err) }; }
  return { ok: true, nom, comptes: doc.comptes, sha256: somme };
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

// ---------- parler à la base ----------
// Trois lignes, mais au niveau du MODULE : `repondreAdmin` et l'atelier ci-dessous les partagent,
// et le webhook de paiement aussi. Recopiées dans chacun, elles auraient fini par ne plus traiter
// une panne de la même façon.
const dbTous = async (env, sql, ...p) => {
  const res = await sansCasser(env.DB.prepare(sql).bind(...p).all(), null);
  return (res && res.results) || [];
};
const dbUn = async (env, sql, ...p) => (await sansCasser(env.DB.prepare(sql).bind(...p).first(), null)) || null;
const dbExecuter = async (env, sql, ...p) => !!(await sansCasser(env.DB.prepare(sql).bind(...p).run(), null));

// Une licence, telle que la console et les mails la lisent.
const SEL_LICENCE =
  'SELECT l.id, l.client_id, l.kid, l.empreinte, l.offre, l.postes, l.debut, l.fin, l.prix, l.devise, l.remise,' +
  ' l.cabinet_empreinte, l.emise_le, l.remplace_id, l.remplacee_motif, l.revoquee_le, l.revoquee_motif, l.envoyee_le,' +
  // 9.4.1 — le type et le quota (NULL sur tout ce qui a été émis avant : une entreprise).
  ' COALESCE(l.type, \'entreprise\') AS type, l.dossiers_hors, l.illimite,' +
  ' l.charge IS NOT NULL AS resignable, c.nom AS client, c.matricule, c.email,' +
  ' (SELECT r2.id FROM licences r2 WHERE r2.remplace_id = l.id LIMIT 1) AS remplacee_par,' +
  ' (SELECT COUNT(*) FROM activations a2 WHERE a2.licence_id = l.id) AS activations,' +
  // Pour un cabinet : combien de ses clients ont une licence d'entreprise parrainée par lui — la
  // preuve, côté éditeur, que ce cabinet amène du monde (et ce qui, un jour, décidera d'une remise).
  ' (SELECT COUNT(*) FROM licences p WHERE COALESCE(l.type, \'entreprise\') = \'cabinet\' AND p.cabinet_empreinte = l.cabinet_empreinte' +
  '   AND COALESCE(p.type, \'entreprise\') = \'entreprise\' AND p.revoquee_le IS NULL) AS parraines' +
  ' FROM licences l LEFT JOIN clients c ON c.id = l.client_id';

// ---------- les gestes composés : émettre, refabriquer une clé, l'envoyer ----------
// Sortis de `repondreAdmin` en 10.9.0, parce qu'un paiement en ligne émet la MÊME licence par le
// MÊME chemin. C'est ce que le plan annonce depuis le premier jour (§ 12 : « le jour où un
// encaissement en ligne est branché, il déclenche le même bouton. Rien à réécrire ») — et recopier
// l'émission pour le webhook aurait donné deux façons de vendre, donc deux façons de se tromper
// (9.7.0 : un adaptateur vaut mieux qu'une seconde implémentation).
//
// `emettre` rend des DONNÉES — `{ ok, corps, status }` — jamais une `Response` : la console en fait
// du JSON, le webhook en tire un identifiant de licence.
//
// `valeurs` porte les réglages EFFECTIFS (base, puis variable, puis défaut). La signature des mails
// se lisait jusqu'ici dans `env.MAIL_SIGNATURE` : le réglage « Signature des mails » de la console
// était donc réglable et ignoré par les mails qu'il nomme.
export function atelierLicences(env, valeurs) {
  const un = (sql, ...p) => dbUn(env, sql, ...p);
  const executer = (sql, ...p) => dbExecuter(env, sql, ...p);
  const v = valeurs || {};
  const signatureMail = v.signature_mail != null ? v.signature_mail : env.MAIL_SIGNATURE;

  async function emettre(o) {
    const ks = await cleServeur(env);
    if (!ks.ok) return { ok: false, corps: { erreur: 'Émission impossible : ' + ks.raison }, status: 503 };
    const id = idCourt();
    // L'empreinte entre dans la clé sous sa forme CANONIQUE (majuscules, tirets) — celle que
    // `licence:emettre` écrit dans SkanFact et que `licenceCabinet` compare ; la base garde la forme
    // nue, sur laquelle les jointures se font. Le type et le quota (9.4.0) vont en QUEUE de charge.
    const charge = chargeLicence({
      kid: ks.kid, id, sub: o.client.id, nom: o.client.nom, matricule: o.client.matricule || '',
      offre: o.e.offre, exp: o.e.exp, cabinet: o.e.cabinetCanon, emisLe: o.aujourdhui,
      type: o.e.type, dossiersHors: o.e.dossiersHors, illimite: o.e.illimite === true
    });
    const chargeTexte = JSON.stringify(charge);
    let cle;
    try { cle = await signerLicence(chargeTexte, ks.privee); }
    catch (err) { return { ok: false, corps: { erreur: 'La signature a échoué : ' + (err && err.message) }, status: 500 }; }
    const empreinte = await empreinteCle(cle);
    const ok = await executer(
      'INSERT INTO licences (id, client_id, kid, empreinte, offre, postes, debut, fin, prix, devise, remise, cabinet_empreinte,' +
      ' emise_le, remplace_id, remplacee_motif, charge, type, dossiers_hors, illimite) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, o.client.id, ks.kid, empreinte, o.e.offre, null, o.e.debut || o.aujourdhui, o.e.exp || null, o.e.prix, o.e.devise,
      o.e.remise, o.e.cabinet || null, o.maintenant, o.remplace ? o.remplace.id : null, o.motif, chargeTexte,
      o.e.type === 'cabinet' ? 'cabinet' : null, o.e.type === 'cabinet' ? o.e.dossiersHors : null,
      o.e.illimite === true ? 1 : null);
    if (!ok) return { ok: false, corps: { erreur: 'La base a refusé l\'écriture de la licence.' }, status: 500 };
    const venteId = 'v_' + idCourt();
    await executer(
      'INSERT INTO ventes (id, client_id, licence_id, montant_ht, tva, devise, payee_le, moyen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      venteId, o.client.id, id, o.e.montant, null, o.e.devise, o.e.payeeLe || null, o.e.payeeLe ? o.e.moyen : null);
    await journaliser(env, o.motif ? 'licence.' + o.motif : 'licence.emise', {
      client_id: o.client.id, licence_id: id,
      detail: libelleLicence(o.e) + (o.e.exp ? ' jusqu\'au ' + fmtJour(o.e.exp) : ' à vie') + ' — ' + o.e.montant + ' ' + o.e.devise + ' HT'
        + (o.remplace ? ' (remplace ' + o.remplace.id + ')' : '')
    });
    const mail = o.e.payeeLe ? await envoyerSiPossible(id, o.maintenant) : { envoye: false, raison: 'la vente n\'est pas encore payée' };
    return { ok: true, status: 201, corps: {
      licence: { id, client: o.client.nom, matricule: o.client.matricule, email: o.client.email, kid: ks.kid, empreinte, offre: o.e.offre,
        type: o.e.type, dossiers_hors: o.e.type === 'cabinet' ? o.e.dossiersHors : null,
        illimite: o.e.illimite === true ? 1 : null, cabinet_empreinte: o.e.cabinet || null,
        debut: o.e.debut || o.aujourdhui, fin: o.e.exp || null, prix: o.e.prix, remise: o.e.remise, devise: o.e.devise, emise_le: o.maintenant,
        remplace_id: o.remplace ? o.remplace.id : null, remplacee_motif: o.motif },
      cle, vente: { id: venteId, montant_ht: o.e.montant, devise: o.e.devise, payee_le: o.e.payeeLe || null }, mail,
      licenceId: id, empreinte
    } };
  }

  // La clé d'une licence rangée : refabriquée depuis son contenu, avec la clé du serveur — à
  // condition que ce soit elle qui l'ait signée.
  async function cleDeLicence(l) {
    if (!l.resignable) return { cle: '', raison: 'Cette licence n\'a pas été émise depuis la console : sa clé est dans SkanFact.' };
    const ks = await cleServeur(env);
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

  async function envoyerSiPossible(licenceId, quand) {
    if (!licenceId) return { envoye: false, raison: 'aucune licence liée' };
    const l = await un(SEL_LICENCE + ' WHERE l.id = ?', licenceId);
    if (!l) return { envoye: false, raison: 'licence introuvable' };
    if (l.envoyee_le) return { envoye: false, raison: 'déjà envoyée le ' + l.envoyee_le.slice(0, 10) };
    if (!l.email) return { envoye: false, raison: 'ce client n\'a pas d\'adresse e-mail : copie la clé et envoie-la toi-même' };
    const cle = await cleDeLicence(l);
    if (!cle.cle) return { envoye: false, raison: cle.raison };
    const m = mailLicence({ type: l.type, dossiersHors: l.dossiers_hors, illimite: l.illimite, offre: l.offre, exp: l.fin || '', cle: cle.cle, signature: signatureMail });
    const envoi = await envoyerMail(env, { a: l.email, sujet: m.sujet, texte: m.texte });
    if (!envoi.ok) {
      await journaliser(env, 'mail.echec', { client_id: l.client_id, licence_id: l.id, detail: envoi.raison });
      return { envoye: false, raison: envoi.raison };
    }
    await executer('UPDATE licences SET envoyee_le = ? WHERE id = ?', quand, l.id);
    await journaliser(env, 'mail.envoye', { client_id: l.client_id, licence_id: l.id, detail: l.email });
    return { envoye: true, a: l.email };
  }
  return { emettre, cleDeLicence, envoyerSiPossible };
}

// Ce que la console renvoie d'une émission : les mêmes données, habillées en réponse HTTP. Les deux
// champs ajoutés pour le webhook (`licenceId`, `empreinte`) n'ont rien à faire dans le corps qu'elle
// lit — ils y répéteraient ce que `licence.id` et `licence.empreinte` disent déjà.
function reponseEmission(res) {
  if (!res.ok) return json(res.corps, res.status);
  const { licenceId, empreinte, ...corps } = res.corps;
  void licenceId; void empreinte;
  return json(corps, res.status);
}

async function repondreAdmin(r, request, env) {
  const a = autoriseAdmin(request.headers, env);
  if (!a.ok) return json({ erreur: a.message }, a.code);
  if (r.action === 'etat') return json(await etatPlateforme(env));
  if (!env || !env.DB) return json({ erreur: 'La base n\'est pas branchée sur ce worker (réglage « DB »).' }, 503);

  const maintenant = new Date().toISOString();
  const aujourdhui = maintenant.slice(0, 10);
  const tous = (sql, ...p) => dbTous(env, sql, ...p);
  const un = (sql, ...p) => dbUn(env, sql, ...p);
  const executer = (sql, ...p) => dbExecuter(env, sql, ...p);
  // Les réglages s'appliquent à TOUT ce qui suit : les prix proposés, les seuils qui décident
  // d'une alerte, la signature d'un mail. Lus UNE fois par requête — les relire à chaque usage
  // ferait dire deux choses différentes au même écran si quelqu'un enregistre entre-temps.
  const enBase = await lireReglages(env);
  const seuils = reglagesEffectifs(env, enBase).valeurs;
  // Les trois gestes composés vivent au niveau du module depuis la 10.9.0 : le webhook de paiement
  // émet la même licence par le même chemin.
  const { emettre, cleDeLicence, envoyerSiPossible } = atelierLicences(env, seuils);
  let corps = {};
  if (request.method === 'POST') { try { corps = await request.json(); } catch { corps = {}; } }
  if (request.method !== 'GET' && request.method !== 'POST') return json({ erreur: 'Méthode non autorisée.' }, 405);

  // ----- lectures -----

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
    // La FICHE d'un client (10.5.0). Répondre à « raconte-moi tout sur ce client » demandait
    // quatre écrans — Clients, Licences, Ventes, Activations — plus le Journal. C'est l'écran
    // qu'on ouvre à chaque appel, donc celui qui devait exister en premier.
    if (r.action === 'clients' && r.id && !r.sous) {
      const c = await un('SELECT id, nom, matricule, email, tel, adresse, notes, cree_le FROM clients WHERE id = ?', r.id);
      if (!c) return json({ erreur: 'Client introuvable.' }, 404);
      const [licences, ventes, postes, suivis, journal] = [
        await tous(SEL_LICENCE + ' WHERE l.client_id = ? ORDER BY l.emise_le DESC LIMIT 200', r.id),
        await tous('SELECT id, licence_id, montant_ht, devise, payee_le, moyen, facture_skanfact FROM ventes WHERE client_id = ? ORDER BY rowid DESC LIMIT 200', r.id),
        await tous('SELECT a.device_id, a.device_nom, a.plateforme, a.version, a.app, a.empreinte, a.premiere_fois, a.derniere_fois' +
          ' FROM activations a JOIN licences l ON l.id = a.licence_id WHERE l.client_id = ? ORDER BY a.derniere_fois DESC LIMIT 200', r.id),
        await tous('SELECT id, quand, moyen, note, rappel, issue, motif, source FROM suivis WHERE sujet = ? ORDER BY quand DESC LIMIT 200', 'client:' + r.id),
        await tous('SELECT id, quand, quoi, detail FROM evenements WHERE client_id = ? ORDER BY id DESC LIMIT 200', r.id)
      ];
      return json({
        client: c,
        licences, ventes, journal,
        postes: postes.map(p => ({ ...p, appNom: APPS[appDe(p.app)] })),
        suivis
      });
    }
    // Le DEVIS : un prospect demande un prix écrit avant d'acheter, et la console ne parlait qu'aux
    // clients déjà facturés. Le prix vient des réglages — jamais d'un nombre écrit dans le code.
    if (r.action === 'clients' && r.id && r.sous === 'devis') {
      const c = await un('SELECT id, nom, email FROM clients WHERE id = ?', r.id);
      if (!c) return json({ erreur: 'Client introuvable.' }, 404);
      const t = tarifs(env, await lireReglages(env));
      const offre = OFFRES[new URL(request.url).searchParams.get('offre')] ? new URL(request.url).searchParams.get('offre') : 'entreprise';
      return json({ ...mailRelance('devis', {
        client: c.nom, email: c.email, offre: OFFRES[offre].label,
        montant: t[offre], devise: t.devise, lien: t.lienPaiement, signature: t.signature
      }), client: c.nom });
    }
    if (r.action === 'clients') {
      // Chaque client porte ce qu'on a besoin de savoir AVANT de l'ouvrir : ce qu'il a acheté, ce
      // qu'il doit, et quand on lui a parlé pour la dernière fois. Une liste de noms nus oblige à
      // ouvrir chaque fiche pour trouver celle qu'on cherche.
      return json({ lignes: await tous(
        'SELECT c.id, c.nom, c.matricule, c.email, c.tel, c.adresse, c.notes, c.cree_le,' +
        ' (SELECT COUNT(*) FROM licences l WHERE l.client_id = c.id AND l.revoquee_le IS NULL' +
        '   AND NOT EXISTS (SELECT 1 FROM licences r2 WHERE r2.remplace_id = l.id)) AS licences,' +
        ' (SELECT COUNT(*) FROM ventes v WHERE v.client_id = c.id AND v.payee_le IS NULL) AS impayees,' +
        ' (SELECT MAX(s.quand) FROM suivis s WHERE s.sujet = \'client:\' || c.id) AS vu_le' +
        ' FROM clients c ORDER BY c.cree_le DESC LIMIT 500') });
    }
    // Les ESSAIS, un par un et nommés. Le Parc les agrège par version : utile pour compter, inutile
    // pour décrocher son téléphone. C'est la file d'appels du matin, et elle n'existait pas.
    if (r.action === 'essais') {
      const recent = new Date(Date.now() - (seuils.parc_frais || PARC_FRAIS) * 86400000).toISOString();
      const lignes = await tous(
        'SELECT device_id, device_nom, plateforme, version, app, premiere_fois, derniere_fois' +
        ' FROM activations WHERE empreinte = ? AND derniere_fois >= ? ORDER BY premiere_fois LIMIT 500', ESSAI, recent);
      const suivis = await lireSuivis(tous);
      return json({ lignes: lignes.map(l => {
        const sujet = 'essai:' + l.device_id + ':' + appDe(l.app);
        const debut = String(l.premiere_fois || '').slice(0, 10);
        const fin = dateValide(debut) ? ajouterJours(debut, ESSAI_JOURS) : '';
        const su = suivis[sujet] || null;
        return { ...l, id: sujet, sujet, appNom: APPS[appDe(l.app)], fin,
          reste: fin && dateValide(aujourdhui) ? joursEntre(aujourdhui, fin) : null,
          suivi_le: su ? su.quand : null, rappel: su ? su.rappel : null, issue: su ? su.issue : null, note: su ? su.note : null };
      }) });
    }
    // La relance : le texte, pas l'envoi. C'est le SERVEUR qui décide de quoi on relance — il lit
    // les dates, et il les lit avec la MÊME règle que l'alerte qui a fait cliquer (`ALERTE_FIN`).
    // Deux règles, l'une pour l'alerte et l'autre pour le mail, finiraient par se contredire : on
    // relancerait « votre licence se termine » sur une licence déjà terminée.
    if (r.sous === 'relance' && r.id && (r.action === 'licences' || r.action === 'ventes')) {
      const t = tarifs(env, enBase);
      if (r.action === 'licences') {
        const l = await un(SEL_LICENCE + ' WHERE l.id = ?', r.id);
        if (!l) return json({ erreur: 'Licence introuvable.' }, 404);
        const finie = l.fin && l.fin < aujourdhui;
        return json({ ...mailRelance(finie ? 'expiree' : 'fin', {
          client: l.client, email: l.email, offre: libelleLicence(l), fin: l.fin,
          lien: t.lienPaiement, signature: t.signature
        }), client: l.client, clientId: l.client_id });
      }
      const v = await un('SELECT v.*, c.nom AS client, c.email, l.offre, l.type, l.dossiers_hors, l.illimite'
        + ' FROM ventes v LEFT JOIN clients c ON c.id = v.client_id'
        + ' LEFT JOIN licences l ON l.id = v.licence_id WHERE v.id = ?', r.id);
      if (!v) return json({ erreur: 'Vente introuvable.' }, 404);
      if (v.payee_le) return json({ erreur: 'Cette vente est payée depuis le ' + v.payee_le + ' : il n\'y a rien à relancer.' }, 409);
      return json({ ...mailRelance('impayee', {
        client: v.client, email: v.email, offre: v.offre ? libelleLicence(v) : '',
        montant: v.montant_ht, devise: v.devise, lien: t.lienPaiement, signature: t.signature
      }), client: v.client, clientId: v.client_id });
    }
    if (r.action === 'licences' && r.id) {
      // Une licence, avec sa clé — refabriquée à l'identique depuis son contenu signé (voir
      // `signerLicence`). Une licence signée par une autre clé que celle du serveur (la maître,
      // depuis SkanFact) n'est pas refabricable ici, et on le dit plutôt que d'inventer.
      const l = await un(SEL_LICENCE + ' WHERE l.id = ?', r.id);
      if (!l) return json({ erreur: 'Licence introuvable.' }, 404);
      const cle = await cleDeLicence(l);
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
    // 10.9.0 — les commandes en ligne. Une commande n'est pas une vente : c'est ce qu'un visiteur a
    // demandé, et ce qui en est advenu. L'écran existe pour UNE ligne surtout — celle d'un paiement
    // encaissé dont la clé n'est pas partie : le client a payé, il n'a rien, et il faut le savoir.
    if (r.action === 'commandes') {
      const lignes = await tous(
        'SELECT c.*, cl.nom AS client_nom FROM commandes c LEFT JOIN clients cl ON cl.id = c.client_id' +
        ' ORDER BY c.cree_le DESC LIMIT 300');
      return json({ lignes });
    }
    if (r.action === 'ventes') {
      // `?non_facturees=1` : le pont comptable (§ 11). SkanFact TIRE les ventes qui n'ont pas encore
      // de facture, et reçoit avec chacune la clé (refabriquée) pour tenir son miroir local — un
      // serveur ne peut pas écrire dans un logiciel de bureau éteint, c'est lui qui vient chercher.
      const nonFacturees = new URL(request.url).searchParams.get('non_facturees') === '1';
      const lignes = await tous(
        'SELECT v.id, v.client_id, v.licence_id, v.montant_ht, v.tva, v.devise, v.payee_le, v.moyen, v.facture_skanfact, v.importee_le,' +
        ' c.nom AS client, c.matricule, c.email, l.offre, l.fin, l.debut, l.kid, l.emise_le, l.prix, l.remise, l.cabinet_empreinte, l.envoyee_le, l.revoquee_le,' +
        ' COALESCE(l.type, \'entreprise\') AS type, l.dossiers_hors, l.illimite,' +
        ' l.empreinte, l.charge IS NOT NULL AS resignable' +
        ' FROM ventes v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN licences l ON l.id = v.licence_id' +
        (nonFacturees ? ' WHERE v.facture_skanfact IS NULL' : '') +
        ' ORDER BY COALESCE(v.payee_le, \'\') ASC, v.rowid DESC LIMIT 500');
      if (nonFacturees) {
        for (const v of lignes) {
          const cle = v.licence_id ? await cleDeLicence({ id: v.licence_id, kid: v.kid, empreinte: v.empreinte, resignable: v.resignable }) : { cle: '' };
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
      // Le parrainage, CHIFFRÉ (10.5.0). Vendre aux entreprises en passant par les cabinets est le
      // modèle de vente du produit (DIRECTION.md) — et il n'était mesuré nulle part : la colonne
      // comptait les clients amenés, jamais ce qu'ils rapportent. Un canal de vente qu'on ne chiffre
      // pas est un canal qu'on ne sait pas récompenser, ni arrêter.
      return json({ lignes: await tous(
        'SELECT l.id, l.empreinte, l.cabinet_empreinte, l.debut, l.fin, l.dossiers_hors, l.illimite, l.revoquee_le, l.envoyee_le,' +
        ' l.prix, l.devise, l.client_id, c.nom AS client, c.email,' +
        ' (SELECT COUNT(*) FROM licences p WHERE p.cabinet_empreinte = l.cabinet_empreinte' +
        '   AND COALESCE(p.type, \'entreprise\') = \'entreprise\' AND p.revoquee_le IS NULL) AS parraines,' +
        // Payants : ceux dont au moins une vente est encaissée. « Amené » et « payé » ne sont pas
        // la même nouvelle, et les confondre ferait féliciter un cabinet qui n'a rien rapporté.
        ' (SELECT COUNT(DISTINCT p.client_id) FROM licences p JOIN ventes v2 ON v2.licence_id = p.id' +
        '   WHERE p.cabinet_empreinte = l.cabinet_empreinte AND COALESCE(p.type, \'entreprise\') = \'entreprise\'' +
        '   AND p.revoquee_le IS NULL AND v2.payee_le IS NOT NULL) AS payants,' +
        ' (SELECT COALESCE(SUM(v2.montant_ht), 0) FROM licences p JOIN ventes v2 ON v2.licence_id = p.id' +
        '   WHERE p.cabinet_empreinte = l.cabinet_empreinte AND COALESCE(p.type, \'entreprise\') = \'entreprise\'' +
        '   AND v2.payee_le IS NOT NULL) AS ca_amene,' +
        ' (SELECT COUNT(*) FROM activations a WHERE a.licence_id = l.id) AS postes,' +
        ' (SELECT MAX(a.derniere_fois) FROM activations a WHERE a.licence_id = l.id) AS vu' +
        ' FROM licences l LEFT JOIN clients c ON c.id = l.client_id' +
        ' WHERE COALESCE(l.type, \'entreprise\') = \'cabinet\'' +
        ' ORDER BY l.emise_le DESC LIMIT 500') });
    }

    if (r.action === 'alertes') {
      const licences = await tous(SEL_LICENCE + ' ORDER BY l.emise_le DESC LIMIT 500');
      const ventes = await tous(
        'SELECT v.id, v.client_id, v.payee_le, c.nom AS client FROM ventes v LEFT JOIN clients c ON c.id = v.client_id' +
        ' ORDER BY v.rowid DESC LIMIT 500');
      const ex = await un('SELECT quand FROM evenements WHERE quoi = ? ORDER BY id DESC LIMIT 1', 'base.exportee');
      // Les essais EN COURS seulement : un poste qu'on n'a pas vu depuis des mois a désinstallé ou
      // changé de machine, et le relancer sur un essai mort ne mène nulle part.
      const essais = await tous(
        'SELECT device_id, device_nom, app, premiere_fois FROM activations' +
        ' WHERE empreinte = ? AND derniere_fois >= ? ORDER BY premiere_fois LIMIT 500',
        ESSAI, new Date(Date.now() - (seuils.parc_frais || PARC_FRAIS) * 86400000).toISOString());
      // Les postes SOUS LICENCE, avec leur client : ils portent deux alertes à eux seuls — le
      // silence d'un client qui a payé, et la version restée en arrière. Une seule requête pour
      // les deux : ce sont les mêmes lignes, et deux requêtes finiraient par les filtrer
      // différemment.
      const postes = await tous(
        'SELECT a.device_id, a.device_nom, a.version, a.app, a.empreinte, a.derniere_fois,' +
        ' l.client_id, c.nom AS client FROM activations a' +
        ' LEFT JOIN licences l ON l.id = a.licence_id LEFT JOIN clients c ON c.id = l.client_id' +
        ' ORDER BY a.derniere_fois DESC LIMIT 500');
      const suivis = await lireSuivis(tous);
      // Les commandes ENCAISSÉES dont la clé n'est pas partie : un client a payé et n'a rien.
      // On ne lit que celles-là — un panier abandonné n'a rien à faire dans « À décider ».
      const commandes = await tous(
        // `etat` est SÉLECTIONNÉ alors que le WHERE le filtre déjà : sans lui, la ligne arrive
        // au constructeur d'alertes sans le champ qu'il teste, et elle est écartée en silence.
        // Un lecteur ne doit jamais dépendre d'un filtre qu'il ne voit pas.
        'SELECT id, nom, montant_ttc, devise, etat, paiement_le, echec FROM commandes' +
        ' WHERE etat = \'ouverte\' AND paiement_le IS NOT NULL ORDER BY paiement_le LIMIT 100');
      return json({ lignes: grouperAlertes(alertesPlateforme(
        { licences, ventes, essais, postes, suivis, commandes, dernierExport: ex && ex.quand }, aujourdhui, seuils)) });
    }

    // Les RÉGLAGES (10.5.0). L'écran rend les trois choses ensemble : ce qu'on peut régler, ce qui
    // s'applique aujourd'hui, et d'OÙ chaque valeur vient. Sans la troisième, un écran de nombres
    // laisse croire qu'ils ont tous été décidés, alors que la plupart sont des défauts que
    // personne n'a jamais regardés.
    if (r.action === 'reglages') {
      const { valeurs, sources } = reglagesEffectifs(env, enBase);
      const ex = await un('SELECT quand FROM evenements WHERE quoi = ? ORDER BY id DESC LIMIT 1', 'base.exportee');
      return json({
        definitions: REGLAGES, valeurs, sources,
        // Ce que la console NE règle pas, et pourquoi. Le taire donnerait l'impression d'un oubli ;
        // le dire évite qu'on cherche le champ pendant dix minutes.
        fixes: [
          { label: 'Durée de l\'essai', valeur: ESSAI_JOURS + ' jours',
            pourquoi: 'C\'est la règle de l\'application, pas une politique de la console : l\'essai se compte sur la machine du client. Réglé ici, il annoncerait des fins d\'essai fausses.' }
        ],
        // L'état de la machinerie que cet écran commande : la copie automatique, et la rotation du
        // secret. Chacun DIT ce qui lui manque plutôt que d'afficher un vert rassurant.
        sauvegarde: etatSauvegarde(env, ex && ex.quand),
        secret: etatSecret(env)
      });
    }

    // Le PLI SCELLÉ. Ce n'est pas du code, c'est le point le plus grave du projet : personne
    // d'autre que l'éditeur ne peut émettre une licence — la clé privée et le secret vivent en un
    // seul endroit. La console ne peut pas le résoudre ; elle peut préparer ce qu'il faut mettre
    // dans le pli, et compter ce qui serait perdu. Aucune clé privée n'en sort jamais : ce qui
    // sort, c'est une PROCÉDURE et des chiffres.
    if (r.action === 'pli') {
      const comptes = {};
      for (const nom of EXPORT_TABLES) {
        const c = await un('SELECT COUNT(*) AS n FROM ' + nom);
        comptes[nom] = (c && c.n) || 0;
      }
      const ks = await cleServeur(env);
      return json({ texte: pliScelle({ comptes, kid: ks.kid || '', quand: aujourdhui }), comptes });
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
      await journaliser(env, 'base.exportee', { detail: resumeExport(env1.comptes) });
      // Le résumé part AVEC l'export, en français : l'écran écrivait les noms de tables SQL tels
      // quels (« evenements », sans accent). Une seule table de noms, côté serveur — une seconde
      // dans la page divergerait au premier renommage (6.8.0).
      return new Response(JSON.stringify({ ...env1, sha256: somme, resume: resumeExport(env1.comptes) }), {
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

  // ----- 10.5.0 : régler depuis l'écran -----
  // Un prix ou un seuil se change ici, jamais dans le code ni dans les réglages de Cloudflare. Ce
  // qui est REFUSÉ est nommé champ par champ : un formulaire qui avale une valeur fausse et affiche
  // « enregistré » est le pire des deux (9.8.0).
  //
  // Vider un champ NUMÉRIQUE le rend à son rang suivant — la variable du worker, sinon le défaut :
  // c'est le seul moyen de défaire une valeur sans avoir à deviner ce qu'elle valait avant. Vider
  // un champ de TEXTE, lui, le laisse vide pour de bon : « aucune version minimale » est une
  // décision, pas un oubli.
  if (r.action === 'reglages' && !r.id) {
    const recus = (corps && typeof corps.valeurs === 'object' && corps.valeurs) || {};
    const poses = [], refuses = [];
    for (const def of REGLAGES) {
      if (!Object.prototype.hasOwnProperty.call(recus, def.id)) continue;
      const brut = String(recus[def.id] == null ? '' : recus[def.id]).trim();
      const v = valeurReglage(def.id, brut);
      if (v === null) {
        if (brut !== '') { refuses.push({ id: def.id, label: def.label, raison: refusReglage(def, brut) }); continue; }
        await executer('DELETE FROM reglages WHERE cle = ?', def.id);
        poses.push({ id: def.id, label: def.label, valeur: '' });
        continue;
      }
      const ok = await executer(
        'INSERT INTO reglages (cle, valeur, change_le) VALUES (?, ?, ?)' +
        ' ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, change_le = excluded.change_le',
        def.id, String(v), maintenant);
      if (!ok) { refuses.push({ id: def.id, label: def.label, raison: 'la base a refusé l\'écriture' }); continue; }
      poses.push({ id: def.id, label: def.label, valeur: String(v) });
    }
    // Le journal dit CE QUI A CHANGÉ, pas « des réglages ont changé » : c'est la seule trace qui
    // explique, six mois plus tard, pourquoi une vente porte ce montant-là.
    if (poses.length) await journaliser(env, 'reglages.changes', { detail: poses.map(p => p.label + ' = ' + (p.valeur === '' ? '(rendu au défaut)' : p.valeur)).join(', ') });
    const apres = reglagesEffectifs(env, await lireReglages(env));
    // Un refus porte une PHRASE, pas seulement une liste : l'écran affiche ce que le serveur dit,
    // et sans cette phrase il aurait rendu « Le serveur a répondu 400 » — c'est-à-dire rien.
    // Un refus dit ce qui est refusé, pourquoi, et ce qui débloque (7.0.0).
    const erreur = refuses.length
      ? refuses.map(r => '« ' + r.label +' » n\'a pas été enregistré (' + r.raison + ')').join(' ')
        + (poses.length ? ' Le reste a été enregistré.' : '')
      : undefined;
    return json({ erreur, poses, refuses, valeurs: apres.valeurs, sources: apres.sources }, refuses.length ? 400 : 200);
  }

  // Le SUIVI d'un prospect ou d'un client. Rien ne s'écrase : chaque contact est une ligne de plus,
  // et c'est la plus récente qui décide de ce que l'alerte fait. Un suivi qu'on corrigerait en
  // écrasant le précédent perdrait précisément ce qui sert — « je l'ai déjà appelé deux fois ».
  if (r.sous === 'suivi' && r.id && (r.action === 'clients' || r.action === 'essais')) {
    let sujet, nom = '';
    if (r.action === 'clients') {
      const c = await un('SELECT id, nom FROM clients WHERE id = ?', r.id);
      if (!c) return json({ erreur: 'Client introuvable.' }, 404);
      sujet = 'client:' + c.id; nom = c.nom;
    } else {
      // Un essai est désigné par son POSTE et son application : le même ordinateur peut essayer les
      // deux applications, et les confondre ferait taire une alerte qu'on n'a pas traitée.
      const app = appDe(corps && corps.app);
      const a = await un('SELECT device_id, device_nom FROM activations WHERE device_id = ? AND empreinte = ? AND COALESCE(app, \'entreprise\') = ?', r.id, ESSAI, app);
      if (!a) return json({ erreur: 'Aucun essai connu sur ce poste pour cette application.' }, 404);
      sujet = 'essai:' + a.device_id + ':' + app; nom = a.device_nom || a.device_id;
    }
    const issue = ['gagne', 'perdu'].indexOf(String(corps.issue || '')) >= 0 ? String(corps.issue) : '';
    const rappel = corps.rappel ? String(corps.rappel).trim() : '';
    if (rappel && !dateValide(rappel)) return json({ erreur: 'La date de rappel n\'est pas une date (AAAA-MM-JJ).' }, 400);
    // Un « perdu » sans motif n'apprend rien, et c'est la SEULE chose que cet écran peut apprendre :
    // pourquoi on ne vend pas. C'est le même refus que la révocation sans motif (8.2.0).
    const motif = texteNet(corps.motif, 200);
    if (issue === 'perdu' && (!motif || motif.length < 3)) {
      return json({ erreur: 'Dis pourquoi c\'est perdu : c\'est la seule chose que ce suivi peut t\'apprendre.' }, 400);
    }
    const id = 's_' + idCourt();
    const ok = await executer(
      'INSERT INTO suivis (id, sujet, quand, moyen, note, rappel, issue, motif, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, sujet, maintenant, texteNet(corps.moyen, 40), texteNet(corps.note, 500), rappel || null, issue || null, motif || null, texteNet(corps.source, 120));
    if (!ok) return json({ erreur: 'La base a refusé l\'écriture du suivi.' }, 500);
    await journaliser(env, 'suivi.note', {
      client_id: r.action === 'clients' ? r.id : null,
      detail: nom + (issue ? ' — ' + (issue === 'gagne' ? 'gagné' : 'perdu : ' + motif) : '') + (rappel ? ' — rappeler le ' + rappel : '')
    });
    return json({ ok: true, id, sujet }, 201);
  }

  if (r.action === 'licences' && !r.id) {
    // Émettre : la clé, la ligne de vente, la ligne de journal — dans le même geste, comme en
    // 7.33.0 dans l'application. Et si la vente est déjà payée, la clé part par mail tout de suite.
    const client = await un('SELECT id, nom, matricule, email FROM clients WHERE id = ?', String(corps.clientId || ''));
    if (!client) return json({ erreur: 'Choisis un client existant (crée-le d\'abord).' }, 400);
    const n = nettoyerEmission(corps, aujourdhui);
    if (!n.ok) return json({ erreur: n.erreur }, 400);
    return reponseEmission(await emettre({ client, e: n.e, aujourdhui, maintenant, remplace: null, motif: null }));
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
      return reponseEmission(await emettre({ client, e: n.e, aujourdhui, maintenant, remplace: l, motif }));
    }

    if (r.sous === 'envoyer') {
      const cle = await cleDeLicence(l);
      if (!cle.cle) return json({ erreur: cle.raison }, 409);
      const m = mailLicence({ type: l.type, dossiersHors: l.dossiers_hors, illimite: l.illimite, offre: l.offre, exp: l.fin || '', cle: cle.cle, signature: seuils.signature_mail });
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
      await journaliser(env, 'licence.importee', { client_id: client.id, licence_id: n.l.id, detail: libelleLicence(n.l) + ' — émise dans SkanFact le ' + fmtJour(n.l.emisLe) });
      bilan.importees++;
    }
    // Second passage : qui remplace qui. L'ordre d'arrivée ne garantit rien.
    for (const l of liste) {
      const de = ids.get(String((l && l.id) || '')), vers = l && l.remplaceePar ? ids.get(String(l.remplaceePar)) : null;
      if (de && vers) await executer('UPDATE licences SET remplace_id = ? WHERE id = ? AND remplace_id IS NULL', de, vers);
    }
    return json(bilan);
  }

  // 10.9.0 — les deux gestes d'une commande. « Redemander » est le TROISIÈME chemin vers
  // `finaliserCommande` : le webhook, la page de retour du client, et ce bouton. Trois chemins vers
  // la même fonction, jamais trois façons de livrer.
  if (r.action === 'commandes' && r.id && r.sous) {
    const cmd = await un('SELECT * FROM commandes WHERE id = ?', r.id);
    if (!cmd) return json({ erreur: 'Commande introuvable.' }, 404);
    if (r.sous === 'verifier') {
      const res = await finaliserCommande(env, seuils, cmd, maintenant);
      return json({ livree: !!res.ok, raison: res.raison || '', mail: res.mail || null });
    }
    if (r.sous === 'abandonner') {
      // Un paiement déjà encaissé ne s'abandonne pas : ce serait garder l'argent en fermant la
      // porte. Tant que la clé n'est pas partie, la ligne rouge doit rester rouge.
      if (cmd.paiement_le) return json({ erreur: 'Cette commande est PAYÉE : elle se livre (« Redemander au prestataire »), ou elle se rembourse — elle ne s\'abandonne pas.' }, 409);
      if (cmd.etat !== 'ouverte') return json({ erreur: 'Cette commande n\'est plus ouverte.' }, 409);
      await executer('UPDATE commandes SET etat = ? WHERE id = ?', 'abandonnee', cmd.id);
      await journaliser(env, 'commande.abandonnee', { detail: cmd.nom + ' — ' + cmd.montant_ttc + ' ' + cmd.devise + ' TTC (' + cmd.id + ')' });
      return json({ ok: true });
    }
    return json({ erreur: 'Introuvable.' }, 404);
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
      const mail = await envoyerSiPossible(v.licence_id, maintenant);
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

    // La page PUBLIQUE de vérification (10.5.0). Un client — ou son comptable — colle l'empreinte
    // de sa licence et lit si elle est valable, jusqu'à quand, et pour quelle offre. Sans secret,
    // parce que celui qui présente une empreinte la connaît déjà : on ne lui apprend rien qu'il
    // n'ait. Ce que cette page ne dit JAMAIS, c'est à qui la licence appartient.
    if (url.pathname === '/verifier') {
      if (request.method !== 'GET') return json({ erreur: 'Méthode non autorisée.' }, 405);
      return new Response(VERIF_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
      });
    }

    const r = routeApi(url.pathname);
    if (!r) return json({ erreur: 'Introuvable.' }, 404);
    if (r.v !== 1) return json({ erreur: 'Version d\'interface inconnue.' }, 404);
    if (r.espace === 'admin') return repondreAdmin(r, request, env);
    if (r.espace === 'verif') return repondreVerif(request, env);
    if (r.espace === 'achat') return repondreAchat(r, request, env);
    return repondreLicence(request, env);
  },

  // Le déclencheur programmé : la copie de la base part toute seule. Elle ne rend rien à personne
  // — donc tout ce qu'elle peut faire, c'est ÉCRIRE dans le journal, en succès comme en échec.
  // Une tâche de nuit muette qui échoue trois mois d'affilée est pire que pas de tâche : on croit
  // être protégé.
  async scheduled(evenement, env, ctx) {
    const quand = new Date((evenement && evenement.scheduledTime) || Date.now()).toISOString();
    const faire = async () => {
      const res = await exporterVersR2(env, quand);
      if (res.ok) await journaliser(env, 'base.exportee', { detail: 'copie automatique — ' + resumeExport(res.comptes) });
      else await journaliser(env, 'base.export.echec', { detail: res.raison });
    };
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(faire());
    else await faire();
  }
};

// ---------- la vérification publique ----------
// Les pages du site qui ont le droit d'interroger cette route depuis le navigateur de leurs
// visiteurs. Jumelle de `ORIGINES` dans `worker/skanfact-maj.mjs` (7.3.0) : les deux workers
// servent le MÊME site, et deux listes qui divergent donneraient un site dont une moitié
// fonctionne. Un test compare les deux.
export const ORIGINES_SITE = [
  'https://saouthq.github.io',
  'https://skanfact.tn',
  'https://www.skanfact.tn'
];

export function origineDuSite(origine, env) {
  const sup = String(env && env.VERIF_ORIGINES || '').split(',').map(x => x.trim()).filter(Boolean);
  return ORIGINES_SITE.concat(sup).includes(String(origine || ''));
}

// Ce que CORS fait ici, et ce qu'il ne fait pas. Il ne protège rien : `curl` l'ignore, et cette
// route est publique par construction. Ce qui PROTÈGE la réponse, c'est la REQUÊTE — le SELECT
// ci-dessous ne lit jamais la table des clients (10.5.0). CORS ne décide que d'une chose : quelle
// PAGE a le droit de lire la réponse dans un navigateur. On l'accorde au site pour qu'il vérifie
// une licence sans envoyer le visiteur sur `api.skanfact.tn`, et on ne l'accorde pas ailleurs.
//
// Une origine inconnue reçoit quand même sa réponse, simplement sans l'en-tête : refuser
// fabriquerait une panne là où il n'y en a pas — la page hébergée par ce worker lui-même
// n'envoie aucune origine, et c'est elle qui sert aujourd'hui.
function entetesPubliques(request, env, methodes) {
  const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin' });
  const origine = request.headers.get('Origin') || '';
  if (origineDuSite(origine, env)) {
    h.set('Access-Control-Allow-Origin', origine);
    h.set('Access-Control-Allow-Methods', methodes);
    h.set('Access-Control-Allow-Headers', 'Content-Type');
    h.set('Access-Control-Max-Age', '86400');
  }
  return h;
}

function entetesVerif(request, env) { return entetesPubliques(request, env, 'POST, OPTIONS'); }

// Ce qu'on rend : l'état, et rien de nominatif. Ce qu'on ne rend pas : le nom du client, son
// matricule, son adresse, ses postes. Une empreinte inconnue est dite inconnue — refuser de
// répondre ferait croire à une panne, et répondre « valable » par prudence serait un mensonge.
async function repondreVerif(request, env) {
  const h = entetesVerif(request, env);
  const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: h });

  // Le navigateur demande la permission AVANT d'envoyer : il ne doit rien lire ni écrire.
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (request.method !== 'POST') return json({ erreur: 'Méthode non autorisée.' }, 405);
  if (!env || !env.DB) return json({ erreur: 'Service momentanément indisponible.' }, 503);
  let corps = {};
  try { corps = await request.json(); } catch { corps = {}; }
  // L'empreinte se lit avec ou sans ses séparateurs, comme partout (9.4.1) — mais on ne retire que
  // les SÉPARATEURS : un « G » tapé pour un « 6 » doit rester une faute visible (8.1.0).
  const nue = String((corps && corps.empreinte) || '').trim().toLowerCase().replace(/[\s-]/g, '');
  if (!/^[0-9a-f]{16,64}$/.test(nue)) {
    return json({ ok: false, etat: 'illisible', phrase: 'Ce n\'est pas une empreinte de licence : attendu une suite de chiffres et de lettres a–f.' });
  }
  const l = await sansCasser(env.DB.prepare(
    'SELECT offre, type, dossiers_hors, illimite, fin, revoquee_le, emise_le,' +
    ' (SELECT COUNT(*) FROM licences r2 WHERE r2.remplace_id = licences.id) AS remplacee' +
    ' FROM licences WHERE empreinte = ?').bind(nue).first(), null);
  if (!l) return json({ ok: false, etat: 'inconnue', phrase: 'Cette empreinte ne correspond à aucune licence émise par SkanFact.' });
  const jour = new Date().toISOString().slice(0, 10);
  const quoi = libelleLicence(l);
  if (l.revoquee_le) return json({ ok: false, etat: 'revoquee', offre: quoi, phrase: 'Cette licence a été révoquée.' });
  if (l.remplacee) return json({ ok: false, etat: 'remplacee', offre: quoi, phrase: 'Cette licence a été remplacée par une plus récente : c\'est la nouvelle clé qui vaut.' });
  if (l.fin && l.fin < jour) return json({ ok: false, etat: 'expiree', offre: quoi, fin: l.fin, phrase: 'Cette licence s\'est terminée le ' + l.fin + '.' });
  return json({ ok: true, etat: 'valable', offre: quoi, fin: l.fin || '',
    phrase: 'Licence valable' + (l.fin ? ' jusqu\'au ' + l.fin + '.' : ', sans date de fin.') });
}

// ---------- l'achat en ligne (10.9.0) ----------
// Le site appelle trois routes ; le prestataire de paiement en appelle une quatrième. Aucune ne
// demande de secret, et c'est assumé : elles s'adressent à un visiteur, avant qu'il ne soit qui que
// ce soit pour nous. Ce qui les protège n'est pas un mot de passe, c'est la répartition des rôles.
//
//   GET  /v1/achat/tarifs          ce que coûte une licence aujourd'hui, réglages compris
//   POST /v1/achat/commander       crée une commande et rend l'adresse de paiement
//   GET  /v1/achat/etat/<cmd_…>    où en est MA commande (jamais la clé : elle part par mail)
//   POST /v1/achat/webhook         le prestataire dit « va regarder » — et on va regarder
//
// La règle qui gouverne tout : **rien de ce que le navigateur envoie ne décide d'un montant**, et
// **la preuve d'un paiement se redemande au prestataire**, avec notre clé, jamais au navigateur ni
// au webhook. Le webhook de Konnect n'est pas signé : n'importe qui peut l'appeler. Il ne vaut donc
// que comme notification, et c'est la question qu'il déclenche qui fait foi.

// Ce que le prestataire répond à « où en est ce paiement ? ». On ne rend jamais son corps brut plus
// loin : seuls le statut, le montant et la référence de commande servent à décider (`verdictPaiement`).
async function konnectPaiement(env, valeurs, ref) {
  const cfg = konnectConfig(env, valeurs);
  if (!cfg.ok) return { ok: false, raison: cfg.raison };
  try {
    const r = await fetch(cfg.base + '/payments/' + encodeURIComponent(ref), {
      headers: { 'x-api-key': cfg.cle, 'Accept': 'application/json' }
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, raison: 'Le prestataire a répondu ' + r.status + ((j && j.message) ? ' : ' + j.message : '') };
    // Konnect enveloppe sa réponse dans `payment`. On accepte les deux formes : une enveloppe qui
    // change de nom ne doit pas se traduire par « paiement introuvable » chez quelqu'un qui a payé.
    const p = (j && j.payment) || j;
    if (!p || typeof p !== 'object') return { ok: false, raison: 'Le prestataire a répondu quelque chose d\'illisible.' };
    return { ok: true, paiement: p };
  } catch (err) { return { ok: false, raison: 'Prestataire injoignable : ' + (err && err.message) }; }
}

// Ce qu'il faut pour vendre en ligne, et ce qui manque quand ça ne marche pas. Trois réglages, et
// chacun porte sa phrase : « le paiement en ligne ne répond pas » n'aide personne.
export function konnectConfig(env, valeurs) {
  const e = env || {}; const v = valeurs || {};
  const cle = String(e.KONNECT_API_KEY || '').trim();
  if (!cle) return { ok: false, raison: 'La clé du prestataire de paiement (KONNECT_API_KEY) n\'est pas posée : l\'achat en ligne est fermé.' };
  const portefeuille = String(v.konnect_wallet || '').trim();
  if (!portefeuille) return { ok: false, raison: 'L\'identifiant du portefeuille n\'est pas réglé (Réglages → Paiement en ligne) : l\'argent n\'aurait nulle part où aller.' };
  const base = String(v.konnect_api || KONNECT_API).trim().replace(/\/+$/, '');
  let ok = false;
  try { const u = new URL(base); ok = u.protocol === 'https:'; } catch { ok = false; }
  if (!ok) return { ok: false, raison: 'L\'adresse du prestataire n\'est pas une adresse https valable.' };
  return { ok: true, cle, portefeuille, base };
}

// La commande est déjà écrite quand on arrive ici : si le prestataire refuse, on garde la trace de
// son refus sur la commande plutôt que de la faire disparaître. Un panier qui s'évapore ne laisse
// rien à comprendre le jour où trois clients d'affilée n'arrivent pas à payer.
async function konnectInit(env, valeurs, cmd, urls) {
  const cfg = konnectConfig(env, valeurs);
  if (!cfg.ok) return { ok: false, raison: cfg.raison };
  // Le nom d'une entreprise n'a ni prénom ni nom de famille. On envoie ce qu'on a, plutôt que de
  // découper au premier espace : « Société Générale de Tunisie » ne se coupe pas en deux.
  const corps = {
    receiverWalletId: cfg.portefeuille,
    token: cmd.devise,
    amount: millimes(cmd.montant_ttc),
    type: 'immediate',
    description: 'SkanFact — licence ' + (OFFRES[cmd.offre] || {}).label + ' (1 an)',
    lifespan: 30,
    firstName: cmd.nom,
    lastName: '',
    email: cmd.email,
    phoneNumber: cmd.tel || '',
    orderId: cmd.id,
    webhook: urls.webhook,
    successUrl: urls.succes,
    failUrl: urls.echec,
    silentWebhook: true,
    checkoutForm: false
  };
  try {
    const r = await fetch(cfg.base + '/payments/init-payment', {
      method: 'POST',
      headers: { 'x-api-key': cfg.cle, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, raison: 'Le prestataire a refusé la demande (' + r.status + ')' + ((j && j.message) ? ' : ' + j.message : '') };
    const payUrl = String((j && (j.payUrl || j.pay_url)) || '');
    const ref = String((j && (j.paymentRef || j.payment_ref)) || '');
    if (!payUrl || !ref) return { ok: false, raison: 'Le prestataire n\'a pas rendu d\'adresse de paiement.' };
    return { ok: true, payUrl, ref };
  } catch (err) { return { ok: false, raison: 'Prestataire injoignable : ' + (err && err.message) }; }
}

// Le geste complet, du paiement prouvé à la clé partie. Il est IDEMPOTENT : un webhook se livre
// deux fois, une page de retour s'actualise, et rien de tout ça ne doit émettre deux licences.
//
// Il est aussi PARTAGÉ entre le webhook et la page de retour, et c'est délibéré : un chemin de
// secours ne sert que s'il se déclenche tout seul (6.7.2). Le jour où le webhook n'arrive pas — le
// prestataire est en panne, le worker était en train de se déployer — c'est la page que le client
// regarde qui finit le travail, sans que personne ait rien à faire.
async function finaliserCommande(env, valeurs, cmd, maintenant) {
  const un = (sql, ...p) => dbUn(env, sql, ...p);
  const executer = (sql, ...p) => dbExecuter(env, sql, ...p);
  const aujourdhui = maintenant.slice(0, 10);
  const noter = async raison => {
    await executer('UPDATE commandes SET echec = ? WHERE id = ?', raison, cmd.id);
    return { ok: false, raison };
  };

  if (cmd.etat === 'payee') return { ok: true, deja: true };
  if (cmd.etat === 'abandonnee') return { ok: false, raison: 'Cette commande a été abandonnée.' };
  if (!cmd.paiement_ref) return { ok: false, raison: 'Cette commande n\'a pas de référence de paiement.' };

  // La preuve. On ne croit jamais ce que le webhook raconte : on repose la question avec notre clé,
  // et on la pose sur la référence que NOUS avons rangée à la création de la commande.
  const rep = await konnectPaiement(env, valeurs, cmd.paiement_ref);
  if (!rep.ok) return { ok: false, raison: rep.raison, muet: true };
  const v = verdictPaiement({ paiement: rep.paiement, commande: cmd });
  // Un paiement encore en attente n'est pas un incident : c'est l'état NORMAL d'une commande dont
  // le client n'a pas fini de taper son code. Il ne laisse donc aucune trace d'échec.
  if (!v.ok) return v.etat === 'pending' ? { ok: false, raison: v.raison, muet: true } : noter(v.raison);

  if (!cmd.paiement_le) {
    await executer('UPDATE commandes SET paiement_le = ? WHERE id = ?', maintenant, cmd.id);
    await journaliser(env, 'commande.payee', { detail: cmd.nom + ' — ' + cmd.montant_ttc + ' ' + cmd.devise + ' TTC (' + cmd.id + ')' });
  }

  // Le client n'existe qu'à partir d'ici : une commande abandonnée ne laisse aucune fiche derrière
  // elle. On le retrouve par son ADRESSE d'abord — c'est l'identité qu'un acheteur en ligne donne,
  // et c'est celle qui reçoit la clé — puis par son matricule, unique quand il est là.
  let client = await un('SELECT id, nom, matricule, email FROM clients WHERE email = ?', cmd.email);
  if (!client && cmd.matricule) client = await un('SELECT id, nom, matricule, email FROM clients WHERE matricule = ?', cmd.matricule);
  if (!client) {
    const cid = 'cli_' + idCourt();
    const ok = await executer('INSERT INTO clients (id, nom, matricule, email, tel, cree_le) VALUES (?, ?, ?, ?, ?, ?)',
      cid, cmd.nom, cmd.matricule || null, cmd.email, cmd.tel || null, maintenant);
    if (!ok) return noter('La base a refusé l\'écriture du client.');
    client = { id: cid, nom: cmd.nom, matricule: cmd.matricule || null, email: cmd.email };
    await journaliser(env, 'client.cree', { client_id: cid, detail: cmd.nom + ' — achat en ligne' });
  }

  // La MÊME émission que celle de la console : mêmes contrôles, même clé, même mail (§ 12).
  const n = nettoyerEmission({
    type: 'entreprise', offre: cmd.offre, duree: DUREE_EN_LIGNE,
    prix: cmd.prix_ht, remise: cmd.remise, devise: cmd.devise,
    cabinet: cmd.parraine ? (cmd.cabinet || '') : '',
    payeeLe: (cmd.paiement_le || maintenant).slice(0, 10), moyen: 'carte (en ligne)'
  }, aujourdhui);
  if (!n.ok) return noter('Émission impossible : ' + n.erreur);

  const { emettre } = atelierLicences(env, valeurs);
  const res = await emettre({ client, e: n.e, aujourdhui, maintenant, remplace: null, motif: null });
  if (!res.ok) return noter((res.corps && res.corps.erreur) || 'L\'émission a échoué.');

  await executer('UPDATE commandes SET etat = ?, licence_id = ?, client_id = ?, echec = NULL WHERE id = ?',
    'payee', res.corps.licenceId, client.id, cmd.id);
  await journaliser(env, 'commande.livree', {
    client_id: client.id, licence_id: res.corps.licenceId,
    detail: libelleLicence(n.e) + ' — ' + cmd.montant_ttc + ' ' + cmd.devise + ' TTC, payée en ligne'
      + (res.corps.mail && res.corps.mail.envoye ? ' — clé envoyée à ' + cmd.email : ' — clé NON envoyée : ' + ((res.corps.mail || {}).raison || 'raison inconnue'))
  });
  // Le mail peut échouer alors que la licence existe : le client a payé et sa clé est là, mais elle
  // n'est pas partie. On ne transforme pas ça en échec de commande — la vente est faite — et c'est
  // l'alerte « clé jamais envoyée » de la console qui s'en charge.
  return { ok: true, licenceId: res.corps.licenceId, mail: res.corps.mail };
}

async function repondreAchat(r, request, env) {
  // Le webhook est appelé par le PRESTATAIRE, de serveur à serveur : aucune page ne le lit. Lui
  // accorder une autorisation de navigateur ouvrirait à n'importe quel site une route qui écrit.
  const h = r.action === 'webhook'
    ? new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    : entetesPubliques(request, env, 'GET, POST, OPTIONS');
  const rep = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: h });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (!env || !env.DB) return rep({ erreur: 'Service momentanément indisponible.' }, 503);

  const maintenant = new Date().toISOString();
  const un = (sql, ...p) => dbUn(env, sql, ...p);
  const executer = (sql, ...p) => dbExecuter(env, sql, ...p);
  const valeurs = reglagesEffectifs(env, await lireReglages(env)).valeurs;

  // ----- ce que ça coûte -----
  // Le site lisait ses prix dans son propre HTML : deux endroits pour un même chiffre, donc deux
  // chiffres le jour d'une augmentation. Il les lit ici, là où la console les règle.
  if (r.action === 'tarifs') {
    if (request.method !== 'GET') return rep({ erreur: 'Méthode non autorisée.' }, 405);
    const cfg = konnectConfig(env, valeurs);
    const devise = String(valeurs.devise || 'TND').toUpperCase();
    const offres = OFFRES_EN_LIGNE.map(id => {
      const ht = prixEnLigne(id, valeurs);
      const m = ht == null ? null : montantCommande({ prixHT: ht, remise: 0, tvaTaux: valeurs.tva_licence, timbre: valeurs.timbre_fiscal });
      return { id, label: (OFFRES[id] || {}).label || id, ht, ttc: m ? m.ttc : null, tva: m ? m.tva : null, timbre: m ? m.timbre : null };
    });
    return rep({
      devise, duree: DUREE_EN_LIGNE, tva: valeurs.tva_licence, timbre: valeurs.timbre_fiscal,
      remiseParrainage: valeurs.remise_parrainage, offres,
      // Fermé, on le DIT avec sa raison : une page qui affiche un bouton « Payer » sur un paiement
      // qui n'existe pas fait perdre un client au moment exact où il voulait acheter.
      ouvert: cfg.ok && offres.every(o => o.ht != null) && devise === 'TND',
      raison: !cfg.ok ? cfg.raison
        : (devise !== 'TND' ? 'Le paiement en ligne n\'accepte que le dinar tunisien.'
          : (offres.some(o => o.ht == null) ? 'Un tarif n\'est pas réglé.' : ''))
    });
  }

  // ----- commander -----
  if (r.action === 'commander') {
    if (request.method !== 'POST') return rep({ erreur: 'Méthode non autorisée.' }, 405);
    let corps = {};
    try { corps = await request.json(); } catch { corps = {}; }
    const n = nettoyerCommande(corps);
    if (!n.ok) return rep({ erreur: n.erreur }, 400);

    const cfg = konnectConfig(env, valeurs);
    if (!cfg.ok) return rep({ erreur: cfg.raison }, 503);
    const devise = String(valeurs.devise || 'TND').toUpperCase();
    // Le prestataire compte en MILLIMES et `millimes()` multiplie par mille : sur une devise à deux
    // décimales, le montant partirait dix fois trop grand. On refuse plutôt que d'encaisser faux.
    if (devise !== 'TND') return rep({ erreur: 'Le paiement en ligne n\'accepte que le dinar tunisien.' }, 503);
    const ht = prixEnLigne(n.c.offre, valeurs);
    if (ht == null) return rep({ erreur: 'Le tarif de cette offre n\'est pas réglé : écris-nous, on s\'en occupe à la main.' }, 503);

    // Le parrainage : la remise ne se pose que sur un cabinet que la BASE connaît. Vingt caractères
    // hexadécimaux se tapent au hasard ; ce qui ne se fabrique pas, c'est une licence de cabinet
    // vivante portant cette empreinte. L'empreinte annoncée est gardée dans les deux cas — un
    // parrainage qu'on n'a pas su reconnaître reste une information pour l'éditeur.
    const parrain = n.c.cabinet
      ? await un('SELECT id FROM licences WHERE cabinet_empreinte = ? AND type = \'cabinet\' AND revoquee_le IS NULL LIMIT 1', n.c.cabinet)
      : null;
    const remise = parrain ? Number(valeurs.remise_parrainage) || 0 : 0;
    const m = montantCommande({ prixHT: ht, remise, tvaTaux: valeurs.tva_licence, timbre: valeurs.timbre_fiscal });

    const id = 'cmd_' + idLong();
    const ok = await executer(
      'INSERT INTO commandes (id, cree_le, offre, duree, nom, email, matricule, tel, cabinet, parraine,' +
      ' prix_ht, montant_ht, remise, tva, timbre, montant_ttc, devise, etat)' +
      ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, maintenant, n.c.offre, DUREE_EN_LIGNE, n.c.nom, n.c.email, n.c.matricule || null, n.c.tel || null,
      n.c.cabinet || null, parrain ? 1 : null, m.ht, m.montantHT, m.remise, m.tva, m.timbre, m.ttc, devise, 'ouverte');
    if (!ok) return rep({ erreur: 'Service momentanément indisponible.' }, 503);

    const origine = new URL(request.url).origin;
    const retour = String(valeurs.achat_retour || '');
    const init = await konnectInit(env, valeurs, { ...n.c, id, devise, montant_ttc: m.ttc }, {
      webhook: origine + '/v1/achat/webhook',
      succes: retourAchat(retour, id, true),
      echec: retourAchat(retour, id, false)
    });
    if (!init.ok) {
      await executer('UPDATE commandes SET echec = ? WHERE id = ?', init.raison, id);
      await journaliser(env, 'commande.refusee', { detail: n.c.nom + ' — ' + init.raison });
      return rep({ erreur: 'Le paiement n\'a pas pu être ouvert. Réessaie dans un instant, ou écris-nous.' }, 502);
    }
    await executer('UPDATE commandes SET paiement_ref = ? WHERE id = ?', init.ref, id);
    await journaliser(env, 'commande.creee', {
      detail: n.c.nom + ' — ' + (OFFRES[n.c.offre] || {}).label + ', ' + m.ttc + ' ' + devise + ' TTC'
        + (parrain ? ' (parrainé, −' + remise + ' %)' : '') + ' — ' + id
    });
    return rep({ commande: id, payUrl: init.payUrl, montant: m.ttc, devise, detail: m, parraine: !!parrain }, 201);
  }

  // ----- où en est ma commande -----
  if (r.action === 'etat') {
    if (request.method !== 'GET') return rep({ erreur: 'Méthode non autorisée.' }, 405);
    if (!r.id) return rep({ erreur: 'Référence de commande manquante.' }, 400);
    let cmd = await un('SELECT * FROM commandes WHERE id = ?', r.id);
    // Une référence inconnue est dite inconnue. Répondre « en attente » par prudence enverrait
    // quelqu'un attendre une clé qui n'arrivera jamais.
    if (!cmd) return rep({ etat: 'inconnue', phrase: 'Cette référence de commande n\'existe pas.' }, 404);
    // Le chemin de secours : tant que le paiement n'est pas confirmé, chaque consultation redemande
    // au prestataire. C'est borné par la patience de l'acheteur, et c'est ce qui sauve la vente le
    // jour où le webhook n'arrive pas.
    if (cmd.etat === 'ouverte' && cmd.paiement_ref && !cmd.paiement_le) {
      await sansCasser(finaliserCommande(env, valeurs, cmd, maintenant), null);
      cmd = (await un('SELECT * FROM commandes WHERE id = ?', r.id)) || cmd;
    }
    return rep(etatCommandePublic(cmd));
  }

  // ----- le prestataire dit « va regarder » -----
  if (r.action === 'webhook') {
    // GET autant que POST : le webhook de Konnect arrive avec sa référence dans l'ADRESSE, et son
    // verbe a changé par le passé. Refuser sur le verbe perdrait des paiements pour une question
    // de forme, alors que la référence — la seule chose qui compte — est là.
    if (request.method !== 'POST' && request.method !== 'GET') return rep({ erreur: 'Méthode non autorisée.' }, 405);
    const url = new URL(request.url);
    let ref = String(url.searchParams.get('payment_ref') || url.searchParams.get('paymentRef') || '').trim();
    if (!ref && request.method === 'POST') {
      const corps = await request.json().catch(() => null);
      ref = String((corps && (corps.payment_ref || corps.paymentRef)) || '').trim();
    }
    // On ne cherche JAMAIS la commande autrement que par la référence qu'on a nous-mêmes rangée en
    // la créant : c'est ce qui fait qu'un appel inventé ne désigne rien.
    const cmd = ref ? await un('SELECT * FROM commandes WHERE paiement_ref = ?', ref) : null;
    // 200 quoi qu'il arrive : un webhook qui reçoit une erreur est réessayé sans fin, et une
    // réponse qui distingue « référence inconnue » de « référence connue » apprendrait à un
    // curieux lesquelles existent.
    if (!cmd) return rep({ ok: true });
    await sansCasser(finaliserCommande(env, valeurs, cmd, maintenant), null);
    return rep({ ok: true });
  }

  return rep({ erreur: 'Introuvable.' }, 404);
}

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
// La page publique de vérification. Volontairement minuscule et sans dépendance : elle doit
// s'ouvrir sur le téléphone d'un comptable dans un couloir, et ne rien savoir faire d'autre.
const VERIF_HTML = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vérifier une licence SkanFact</title>
<style>
  :root{color-scheme:light dark;--bg:#f5f7fa;--surface:#fff;--ink:#1a2430;--ink2:#5b6b7c;--line:#dde4ec;--acc:#0f9d8f;--alr:#c0392b;--ok:#1b7f5f}
  @media (prefers-color-scheme:dark){:root{--bg:#141a21;--surface:#1c242e;--ink:#e8eef5;--ink2:#9aa9b8;--line:#2b3644}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
       padding:32px 16px;display:flex;justify-content:center}
  .carte{width:100%;max-width:560px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:26px}
  h1{margin:0 0 6px;font-size:21px}
  p.lead{margin:0 0 20px;color:var(--ink2);font-size:14px}
  label{display:block;font-size:12.5px;color:var(--ink2);margin-bottom:6px}
  input{width:100%;font:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:11px 13px;border-radius:9px;
        border:1px solid var(--line);background:var(--surface);color:var(--ink)}
  button{margin-top:14px;font:inherit;font-weight:600;padding:11px 18px;border-radius:9px;border:1px solid var(--acc);
         background:var(--acc);color:#fff;cursor:pointer}
  button:disabled{opacity:.5;cursor:not-allowed}
  #out{margin-top:20px;padding:14px 16px;border-radius:10px;border:1px solid var(--line);font-size:14.5px}
  #out.ok{border-color:var(--ok);color:var(--ok)}
  #out.non{border-color:var(--alr);color:var(--alr)}
  .pied{margin-top:22px;color:var(--ink2);font-size:12.5px}
</style></head><body>
<main class="carte">
  <h1>Vérifier une licence SkanFact</h1>
  <p class="lead">Colle l’empreinte de ta licence — tu la trouves dans SkanFact, sous
    <em>Paramètres &rsaquo; L’application &rsaquo; Licence</em>. Cette page ne dit jamais à qui une licence appartient.</p>
  <label for="emp">Empreinte de la licence</label>
  <input id="emp" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="3f9a2c1e…">
  <button id="go" type="button">Vérifier</button>
  <div id="out" hidden></div>
  <p class="pied">Une licence SkanFact se vérifie aussi <strong>hors ligne</strong>, sur ton ordinateur : cette page
    n’est qu’une commodité, pas la source de vérité.</p>
</main>
<script>
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var sortie = function (cls, texte) { var o = $('out'); o.className = cls; o.textContent = texte; o.hidden = false; };
  var aller = function () {
    var v = $('emp').value.trim();
    if (!v) { sortie('non', 'Colle d\\u2019abord une empreinte.'); return; }
    $('go').disabled = true;
    fetch('/v1/verif/licence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empreinte: v }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { sortie(j.ok ? 'ok' : 'non', (j.offre ? j.offre + ' — ' : '') + (j.phrase || j.erreur || 'Réponse illisible.')); })
      .catch(function () { sortie('non', 'La vérification n\\u2019a pas pu aboutir. Réessaie dans un instant.'); })
      .then(function () { $('go').disabled = false; });
  };
  $('go').onclick = aller;
  $('emp').onkeydown = function (e) { if (e.key === 'Enter') aller(); };
  $('emp').focus();
})();
</script>
</body></html>`;

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
  /* 10.5.0 — LE PLAFOND SUIT LE RÔLE, pas le conteneur.
     Un seul plafond de 1180 px s'appliquait à tout : la prose comme les tableaux. Juste pour du
     texte — une ligne de 1900 px est illisible, c'est pourquoi « .page-head .but » tient déjà en
     64 caractères — et faux pour un tableau de dix colonnes, qui se serrait à 1180 px pendant que
     700 px restaient vides à droite sur un écran ordinaire.
     Ce qui se LIT garde une mesure de lecture ; ce qui se COMPARE — un tableau, une rangée de
     cartes — prend la place disponible, avec un plafond haut pour ne pas devenir une piste
     d'aéroport sur un 4K. Mesuré par « e2e:console-rendu », sinon la prochaine dérive passera aussi
     inaperçue que celle-ci. */
  main > .dedans{max-width:1600px}
  #form, #resultat, footer, .msg, .etat-machine{max-width:980px}
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
  /* LA COULEUR PORTE UN SENS, ou elle disparaît. Les six cartes en portaient cinq sans légende :
     bleu pour « essai », vert pour « licences actives », rouge pour « révoquée », noir pour
     « clients » — et vert pour un taux de conversion de 0 %, c'est-à-dire la mauvaise nouvelle
     dans la couleur de la bonne, juste à côté du chiffre d'affaires encaissé.
     Trois rôles, et rien d'autre : l'accent pour ce qui est acquis, le rouge pour ce qui est
     perdu, le neutre pour un COMPTE qui ne porte aucun jugement. Un essai en cours n'est ni bon
     ni mauvais — c'est une question ouverte — et un taux sans objectif ne se colore pas. */
  .card.rev b{color:var(--alr)} .card.act b{color:var(--acc)}
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
  /* La rangée de boutons qui clôt un bloc. Elle était bornée aux rangées vivant DANS un panneau : posée ailleurs —
     l'écran des Réglages, une fiche — elle ne recevait AUCUN écart, et « Enregistrer » touchait
     « Annuler » à zéro pixel. Un correctif qui dépend d'une classe qu'on pense à mettre n'est pas
     un correctif (9.8.3) : la règle vise la rangée, où qu'elle soit. */
  .row{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
  .cle{font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;font-size:12.5px;word-break:break-all;
       background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0;user-select:all}
  .note{font-size:13px;color:var(--warn);margin:8px 0 0}
  /* ---------- 10.6.0 : la saisie ---------- */
  /* Une date qu'on n'a pas su lire se MONTRE. On ne la corrige pas en silence — corriger à la
     place de quelqu'un, c'est décider pour lui — et on ne la vide pas : ce qu'il a tapé reste
     sous ses yeux, avec le bord qui dit que ça ne passe pas (7.0.0). */
  input.faux{border-color:var(--alr)}
  input.faux:focus-visible{outline-color:var(--alr)}
  /* D'où vient le montant qui est dans le champ. « Proposé » n'est pas « décidé » : tant que
     personne n'a regardé le chiffre, l'écran le dit — et il cesse de le dire à la première
     frappe, parce qu'un montant saisi à la main EST une décision. */
  .pr{font-weight:400;color:var(--ink2);text-transform:none;letter-spacing:normal;margin-inline-start:8px;font-size:11.5px}
  .pr.main{color:var(--acc)}
  /* Le RÉCAPITULATIF d'un geste irréversible : ce n'est ni une erreur ni une note, c'est ce qu'on
     s'apprête à faire. Il se lit comme un encadré, au-dessus du bouton qui le confirme. */
  .recap{margin:14px 0 0;padding:12px 14px;border:1px solid var(--acc);border-radius:10px;
         background:var(--surface2);color:var(--ink);font-size:13.5px;line-height:1.5}
  /* Le panneau d'un geste RÉUSSI. Il ne se distinguait de rien : même cadre, même bordure que
     tout le reste, sur le seul moment de la console où quelque chose d'irréversible vient
     d'aboutir. Une réussite se voit. */
  #resultat.ok{border-color:var(--acc)}
  #resultat.ok h2{display:flex;align-items:center;gap:9px}
  .coche{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;
         border-radius:999px;background:var(--acc);color:#fff;font-size:14px;font-weight:700;flex-shrink:0}
  /* La clé RÉSUMÉE. On la reconnaît par ses bouts ; on ne la lit jamais en entier, et lui donner
     cinq lignes revenait à faire de la donnée la moins lisible du produit l'élément le plus
     visible de l'écran. Le texte complet reste à un clic. */
  .cle-court{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0 0}
  .cle-court code{font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;font-size:13px;
                  background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:7px 11px}
  .note.bon{color:var(--acc)}
  /* Le corps d'un mail composé : la police de LECTURE, pas la chasse fixe. C'est le texte qu'un
     client va recevoir, pas un fichier de configuration. */
  .mail-txt{white-space:pre-wrap;background:var(--surface2);border:1px solid var(--line);
            border-radius:10px;padding:14px 16px;margin:12px 0;font-size:13.5px;line-height:1.55;
            max-height:46vh;overflow-y:auto}
  /* Un bouton principal n'est pas souligné, même quand c'est un lien : le seul de la console à
     l'être ne ressemblait ni à un bouton ni à un lien. */
  .lien-btn{text-decoration:none;display:inline-block}
  .oblig{margin:10px 0 0;color:var(--ink2);font-size:12px}
  .wrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th,td{padding:10px 14px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
  tr:last-child td{border-bottom:0}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink2);background:var(--surface2)}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  /* La cellule d'actions ne se PLIE plus : elle porte au plus deux boutons (le geste de la page,
     et « ⋯ » pour le reste), donc elle tient sur une ligne. En « white-space: normal » avec cinq
     boutons, elle les empilait l'un sous l'autre et chaque ligne de Licences faisait 210 px —
     pour une pagination à 50 lignes, c'est-à-dire treize écrans de défilement par page. */
  td.acts{white-space:nowrap}
  td.acts .btn{margin:2px 0 2px 6px}
  td.acts .btn:first-child{margin-inline-start:0}
  /* Le bouton du menu : un carré, pas un mot. Il accompagne un bouton NOMMÉ, jamais seul — un
     pictogramme n'est pas un libellé (7.29.0), mais à côté d'un libellé c'est un repère. */
  .menu-b{padding-inline:8px;font-weight:700;letter-spacing:1px}
  .menu-b[aria-expanded="true"]{border-color:var(--acc);color:var(--acc)}
  /* Le menu lui-même vit sur le BODY : dans la cellule, le conteneur qui défile de côté le
     rognerait — et c'est justement le débordement qu'on répare. Chaque entrée porte une PHRASE et
     son dessin, jamais un pictogramme seul, et son explication en dessous. */
  #rowmenu{position:fixed;z-index:500;min-width:236px;max-width:320px;background:var(--surface);
           border:1px solid var(--line);border-radius:12px;padding:6px;
           box-shadow:0 16px 44px rgba(0,0,0,.22)}
  #rowmenu button{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:start;
                  font:inherit;font-size:13.5px;color:var(--ink);background:transparent;border:0;
                  padding:8px 10px;border-radius:8px;cursor:pointer}
  #rowmenu button:hover,#rowmenu button:focus-visible{background:var(--surface2);outline:none}
  #rowmenu button.d{color:var(--alr)}
  #rowmenu button.d:hover,#rowmenu button.d:focus-visible{background:rgba(198,40,40,.08)}
  #rowmenu svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.7;
               stroke-linecap:round;stroke-linejoin:round;opacity:.75;flex-shrink:0;margin-top:2px}
  #rowmenu em{display:block;font-style:normal;color:var(--ink2);font-size:11.5px;margin-top:2px;
              white-space:normal;line-height:1.35}
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
  /* 260 px chacune, et l'écran d'entrée en porte DEUX : à elles seules elles réclamaient 520 px et
     faisaient déborder la page de 19 px dès que le bouton d'action a cessé de dire « Ouvrir » pour
     dire où il mène. Une colonne qui explique a besoin d'assez de place pour ne pas se couper mot
     à mot, pas de la moitié de l'écran. Mesuré : à 210 px, plus rien ne déborde à 1280. */
  td.libre{white-space:normal;min-width:210px}
  /* Une colonne de texte LONG se tronque au lieu de pousser la table hors du cadre : un nom de
     société tunisien fait soixante caractères, et il portait à lui seul les 524 px de débordement
     de l'écran Licences. Le texte entier reste au survol — ce qu'on cache à l'œil doit rester
     lisible, sinon on a remplacé un débordement par une perte (9.4.5, « td.tronq » du Cabinet). */
  td.tronq{max-width:270px}
  td.tronq .cut{display:block;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  /* Ce que le tableau ne montre pas, il le dit. */
  .colmsg{padding:8px 14px;border-top:1px solid var(--line);font-size:12.5px;color:var(--ink2);
          display:flex;gap:10px;align-items:center;flex-wrap:wrap}
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
  /* Un état vide SECONDAIRE s'annonce, il ne se contemple pas (9.4.7). Un cadre de 36 px de marge
     est la bonne présence quand le vide EST le corps de l'écran — au milieu d'une fiche déjà
     pleine, il consacre cent pixels à dire qu'il n'y a rien, et repousse tout le reste. */
  .vide.mini{padding:12px 16px;text-align:start;font-size:13.5px}

  /* ---------- 10.5.0 : trier, paginer, expliquer ---------- */
  /* Les deux applications ont des listes triables et paginées depuis la 1.9.0 et la 2.2.0 ; la
     console n'avait ni l'un ni l'autre, et tronquait à 500 lignes EN SILENCE. Une troncature muette
     se lit comme « tout est là » — et le Journal, qui grossit sans fin, y arrivera bien avant les
     clients. */
  th.tri{cursor:pointer;user-select:none}
  th.tri:hover{color:var(--ink)}
  th.tri .fl{opacity:.35;margin-inline-start:5px;font-weight:700}
  th.tri[aria-sort] .fl{opacity:1;color:var(--acc)}
  .pager{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--line);
         font-size:12.5px;color:var(--ink2)}
  .pager .sp{flex:1}
  .pager .btn{font-size:12.5px;padding:4px 10px}
  /* Une borne ATTEINTE se dit. Tant qu'on est sous les 500, cette ligne n'existe pas. */
  .coupe{color:var(--warn)}

  /* La bulle « i ». Les deux applications en ont partout depuis la 1.8.0 ; la console n'en avait
     aucune, alors que la moitié de ses en-têtes sont des DÉFINITIONS (« Endormis », « Vus (30 j) »,
     « Sous licence »). Une colonne dont le titre ne se comprend pas se devine, et une devinette se
     trompe. */
  button.i{appearance:none;border:1px solid var(--line);background:var(--surface);color:var(--ink2);
           width:16px;height:16px;border-radius:999px;font-size:10.5px;line-height:1;padding:0;cursor:help;
           margin-inline-start:6px;vertical-align:middle;font-weight:700}
  button.i:hover,button.i:focus-visible{border-color:var(--acc);color:var(--acc)}
  button.i + button.i{margin-inline-start:8px}
  #info-pop{position:fixed;z-index:900;max-width:320px;background:var(--surface);color:var(--ink);
            border:1px solid var(--acc);border-radius:10px;padding:11px 13px;font-size:13px;line-height:1.45;
            box-shadow:0 8px 28px rgba(0,0,0,.18);text-transform:none;letter-spacing:normal}

  /* La palette (Cmd+K), comme dans les deux applications. */
  #palette{position:fixed;inset:0;z-index:600;background:rgba(10,16,22,.45);display:flex;
           align-items:flex-start;justify-content:center;padding-block-start:14vh}
  #palette .boite{width:min(560px,92vw);background:var(--surface);border:1px solid var(--line);
                  border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.28)}
  #palette input{border:0;border-bottom:1px solid var(--line);border-radius:0;padding:15px 18px;font-size:15px}
  #palette input:focus-visible{outline:none;border-bottom-color:var(--acc)}
  #palette ul{list-style:none;margin:0;padding:6px;max-height:46vh;overflow-y:auto}
  #palette li{padding:9px 13px;border-radius:8px;cursor:pointer;font-size:14px;display:flex;gap:10px;align-items:baseline}
  #palette li .ou{color:var(--ink2);font-size:12px;margin-inline-start:auto}
  #palette li[aria-selected="true"]{background:var(--surface2);color:var(--acc)}
  #palette .rien{padding:18px;color:var(--ink2);font-size:13.5px;text-align:center}

  /* La FICHE d'un client : l'écran qu'on ouvre à chaque appel. */
  .fiche-tete{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:18px}
  .fiche-tete .id{color:var(--ink2);font-size:13px}
  .fiche-tete .sp{flex:1}
  .bloc{margin-bottom:22px}
  .bloc > h2{margin:0 0 10px;font-size:15.5px}
  .bloc .wrap{margin:0}
  .paires{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px 18px;margin:0 0 6px}
  .paires div{font-size:13.5px}
  .paires b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--ink2);font-weight:700}
  .fil{list-style:none;margin:0;padding:0}
  .fil li{border-inline-start:2px solid var(--line);padding:0 0 12px 14px;font-size:13.5px}
  .fil li:last-child{padding-bottom:0}
  .fil .q{display:block;color:var(--ink2);font-size:11.5px;font-variant-numeric:tabular-nums}

  /* Les réglages : un champ par ligne, avec ce qu'il fait et d'où sa valeur vient. */
  .reg{display:grid;grid-template-columns:minmax(220px,1fr) 200px;gap:6px 18px;align-items:start;
       padding:14px 0;border-bottom:1px solid var(--line)}
  .reg:last-child{border-bottom:0}
  .reg .quoi b{display:block;font-size:14px;font-weight:600}
  .reg .quoi span{display:block;color:var(--ink2);font-size:12.5px;margin-block-start:3px}
  .reg .src{grid-column:1;font-size:11.5px;color:var(--ink2)}
  /* Un DÉFAUT n'est pas une alerte : sur une console neuve, aucun réglage n'a été décidé, et
     quinze lignes orange sur le premier écran apprennent à ignorer le orange (8.0.1). La phrase
     complète vit dans la bulle du libellé ; ici, un mot ou rien. */
  .reg .src.defaut{display:none}
  .reg .src.base{color:var(--acc)}
  /* La LARGEUR dit ce qu'on attend : un nombre à trois chiffres, une devise, une URL et une
     signature ne se saisissent pas dans la même case. Le type de la valeur choisit le gabarit. */
  .reg.court{grid-template-columns:minmax(220px,1fr) 130px}
  .reg.moyen{grid-template-columns:minmax(220px,1fr) 220px}
  .reg.long{grid-template-columns:minmax(200px,1fr) minmax(300px,1.1fr)}
  @media (max-width:640px){.reg,.reg.court,.reg.moyen,.reg.long{grid-template-columns:1fr}.reg .src{grid-column:auto}}
  /* Le SOMMAIRE d'une page de trois écrans : ce qu'elle contient, avant de l'avoir parcourue. */
  .sommaire{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
  /* Un titre de section qu'on replie porte ses trois signes AU REPOS : le chevron, le curseur, et
     son état — un en-tête qui ne se distingue d'un titre qu'au survol n'est pas un bouton
     (Cabinet 1.0.0, 9.4.4). */
  .collapse-h{display:flex;align-items:center;gap:9px;width:100%;background:transparent;border:0;
              padding:0 0 10px;cursor:pointer;color:inherit;font:inherit;text-align:start}
  .collapse-h h2{margin:0}
  .collapse-h .chev{color:var(--ink2);transition:transform .15s;font-size:13px}
  .collapse-h[aria-expanded="false"] .chev{transform:rotate(-90deg)}
  .collapse-h:hover h2{color:var(--acc)}
  /* La barre d'enregistrement FLOTTE : sur trois écrans, un bouton posé en pied oblige à
     redescendre après chaque changement. Les Paramètres de l'app entreprise l'ont depuis la
     1.8.0 ; la console avait le bouton tout en bas. */
  .barre-enr{position:sticky;bottom:0;display:flex;gap:10px;align-items:center;
             padding:12px 0;margin-top:8px;background:var(--bg);border-top:1px solid var(--line)}
  .barre-enr .sp{flex:1}

  .msg{padding:14px 18px;border-radius:10px;border:1px solid var(--alr);
       background:var(--surface);color:var(--ink);margin-bottom:20px}
  .msg.ok{border-color:var(--acc)}
  .msg.w{border-color:var(--warn)}
  /* La carte flottait à 12 % du haut avec cinq cents pixels de vide dessous : un écran d'entrée
     posé ni en haut ni au centre se lit comme une page inachevée. */
  .lock{position:fixed;inset:0;margin:auto;width:min(420px,calc(100% - 32px));height:fit-content;
        background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:28px}
  .lock h2{margin:0 0 6px;font-size:19px}
  .lock p{margin:0 0 18px;color:var(--ink2);font-size:14px}
  .lock .row{display:flex;gap:10px;margin-top:14px}
  footer{padding:20px 22px;color:var(--ink2);font-size:12.5px;text-align:center}
  [hidden]{display:none!important}
</style>
</head><body>

<div id="lock" class="lock">
  <h2>Console SkanFact</h2>
  <p>Colle le secret d’administration. Il reste dans cet onglet et disparaît quand tu fermes le navigateur.</p>
  <label for="sec" style="display:block;font-size:12.5px;color:var(--ink2);margin-bottom:6px">Secret d’administration</label>
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
      <!-- Une région VIVANTE : sans elle, rien n'annonce le résultat d'une action — ni à un
           lecteur d'écran, ni à qui vient de cliquer en bas d'une page longue. « assertive » pour
           un refus (il interrompt), « polite » pour une réussite (elle attend son tour). -->
      <div id="err" class="msg" role="alert" aria-live="assertive" hidden></div>
      <div id="info" class="msg ok" role="status" aria-live="polite" hidden></div>
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
      <div id="fiche" hidden></div>
      <div id="table"></div>
      <!-- Le pied portait « Une clé livrée ne se reprend pas… » sous quatre écrans. Lue une
           fois, la phrase est utile ; lue quatre fois, elle devient du mobilier — et on cesse de
           lire les pieds de page, y compris le jour où l'un d'eux dit autre chose (9.4.6). Elle
           vit maintenant là où la limite compte : dans la fenêtre qui révoque. -->
    </div>
  </main>
</div>

<!-- La bulle « i » se pose en position fixe : dans un en-tête de tableau collant, une infobulle
     en position absolue serait rognée par le conteneur qui défile. -->
<div id="info-pop" hidden role="tooltip"></div>
<div id="palette" hidden></div>

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
  // Le tri et la pagination, par ÉCRAN : revenir sur Licences doit retrouver le tri qu'on y avait
  // posé, pas celui du Journal. Vidés quand on change d'écran ? Non — c'est justement ce qu'on
  // veut garder, contrairement à la recherche, qui cache ce qu'on vient chercher (9.4.6).
  var tris = {};          // écran → { k: colonne, sens: 1 | -1 }
  var pages = {};         // écran → numéro de page, à partir de 1
  // « Tout afficher » : le choix vaut pour la session, pas pour un écran. Une colonne vide
  // masquée sur Cabinets et rendue sur Licences ferait deux tableaux qui ne suivent pas la
  // même règle — et on ne saurait plus lequel dit tout.
  var colTout = false;
  var PAR_PAGE = 50;
  var fiche = null;       // { type: 'client', id } quand on regarde une fiche au lieu d'une liste
  var reg = null;         // ce que /v1/admin/reglages a répondu
  var generation = 0;     // le numéro du dessin en cours : une réponse en retard ne repeint rien
  // Où une recherche a un sens : les écrans qui portent des NOMS et des numéros. « À décider »
  // tient en trois lignes repliées et « Parc » en une ligne par version : un champ de recherche y
  // serait un contrôle de plus à lire pour rien.
  var CHERCHABLES = ['licences', 'ventes', 'clients', 'cabinets', 'activations', 'evenements', 'essais'];
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
      // Le verdict ne compte QUE les canaux stables ; le détail listait tout ce qui est servi,
      // bêtas comprises. Résultat : « Les 4 canaux stables servent une version » au-dessus de HUIT
      // lignes. Un compteur et la liste qu'il annonce se calculent avec la même fonction (6.8.1) —
      // ici on ne retire rien, on SÉPARE, parce que ce que sert le canal d'essai est utile aussi.
      var servis = (s.canaux || []).filter(function (c) { return c.servi; });
      var rendu = function (liste) { return liste.map(function (c) { return h(c.fichier) + ' \\u2192 ' + h(c.tag); }).join(' \\u00b7 '); };
      var stables = servis.filter(function (c) { return !c.essai; });
      var essais = servis.filter(function (c) { return c.essai; });
      var detail = (stables.length ? '<div class="quand" style="margin-block-start:6px">Stables : ' + rendu(stables) + '</div>' : '')
        + (essais.length ? '<div class="quand">Essais : ' + rendu(essais) + '</div>' : '');
      el.innerHTML = '<span class="pill ' + cls + '">' + h(v.phrase) + '</span>' + detail;
    }, function (e) {
      el.innerHTML = '<span class="pill e">canaux : non lus</span> <span class="quand">' + h(e.message || '') + '</span>';
    });
  }

  // --- l'export de la base ---
  // La base porte « qui a acheté quelle clé » — et le contenu signé de chaque licence, celui qui
  // permet de la refabriquer à l'identique. L'avertissement se lit AVANT le geste.
  // Les NOMS des tables, en français. L'écran écrivait « evenements : 3 · jetons : 0 » — les noms
  // SQL tels quels, accent manquant compris. Ça ne casse rien, et ça dit à celui qui lit que
  // personne n'a regardé cet écran. La table vit côté serveur, en un seul exemplaire.
  function exporterBase(b) {
    b.disabled = true;
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
      montrerInfo('Base exportée — ' + (j.resume || '') + '. Ce fichier n\\u2019est pas chiffré et porte tes clients : range-le où tu ranges tes clés.');
      b.disabled = false;
      dessiner();
    }, function (e) { b.disabled = false; montrerErreur(e); });
  }
  $('exporter').onclick = function () { exporterBase($('exporter')); };

  // --- les formulaires : une seule zone, un seul formulaire à la fois ---
  // Chaque formulaire RAPPELLE de quoi on parle (le client, la licence, le montant) avant de
  // demander : une question posée hors contexte se clique sans être lue (7.28.0).
  // Un jour de calendrier se saisit en FRANÇAIS. Un « input type=date » se rend dans la locale du
  // NAVIGATEUR : sur une machine en anglais il affiche « mm/dd/yyyy » et « 09/22/2026 », à côté
  // des « 22/09/2026 » que le reste de la console écrit. Une date comme 03/04/2027 devient alors
  // ambiguë — mars ou avril selon qui lit — et une date de fin de licence fausse est une licence
  // qui expire au mauvais moment chez un client qui a payé. Les deux applications ont réglé ça
  // depuis la 2.3.0, saisie tolérante et ISO gardé dans la donnée ; la console avait reçu le champ
  // natif, sur ses cinq dates.
  var jourSaisi = function (t) {
    t = String(t || '').trim();
    if (!t) return '';
    var j, mo, an;
    var iso = t.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})$/);
    if (iso) { an = Number(iso[1]); mo = Number(iso[2]); j = Number(iso[3]); } else {
      var m = t.match(/^(\\d{1,2})[\\/.\\- ](\\d{1,2})(?:[\\/.\\- ](\\d{2}|\\d{4}))?$/);
      if (!m) return '';
      j = Number(m[1]); mo = Number(m[2]);
      an = m[3] == null ? Number(aujourdhui().slice(0, 4)) : (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]));
    }
    if (!(mo >= 1 && mo <= 12) || !(j >= 1 && j <= 31) || !(an >= 1970 && an <= 9999)) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    var s = an + '-' + p(mo) + '-' + p(j);
    // Un 31 février ne se BORNE pas, il se refuse : borner inventerait une date que personne n'a
    // donnée (10.0.0). L'aller-retour par UTC est la seule façon de le savoir.
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
  };
  var champDate = function (name, label, iso, w) {
    return '<label class="f' + (w ? ' w' : '') + '"><span>' + h(label) + '</span>'
      + '<input name="' + name + '" data-date type="text" inputmode="numeric" autocomplete="off"'
      + ' placeholder="jj/mm/aaaa" maxlength="10" value="' + h(iso ? jour(iso) : '') + '"></label>';
  };
  // Au départ du champ : on remet la date au propre (« 4/3 » devient « 04/03/2026 ») et on MARQUE
  // ce qu'on n'a pas su lire — sans l'effacer. Une saisie refusée se montre, elle ne se corrige
  // pas en silence et ne disparaît pas sous les doigts (7.0.0).
  var brancherDates = function (racine) {
    Array.prototype.forEach.call(racine.querySelectorAll('[data-date]'), function (i) {
      i.onblur = function () {
        var d = jourSaisi(i.value);
        i.classList.toggle('faux', !!i.value.trim() && !d);
        if (d) i.value = jour(d);
      };
      i.oninput = function () { i.classList.remove('faux'); };
    });
  };

  function formulaire(titre, why, champs, okLibelle, onOk, opts) {
    var el = $('form');
    opts = opts || {};
    el.innerHTML = '<h2>' + h(titre) + '</h2><p class="why">' + why + '</p>' +
      '<div class="grid">' + champs + '</div>' +
      '<p id="f-msg" class="note" hidden></p>' +
      '<div class="row"><button id="f-ok" class="btn p" type="button">' + h(okLibelle) + '</button>' +
      '<button id="f-non" class="btn" type="button">Annuler</button></div>' +
      // La légende se DÉDUIT de la présence d'un champ étoilé : recopiée formulaire par formulaire,
      // elle manquerait au premier qui en gagne un (7.20.0).
      (/\\*<\\/span>/.test(champs) ? '<p class="oblig">* obligatoire</p>' : '');
    el.hidden = false;
    brancherDates(el);
    $('f-non').onclick = fermerForm;

    // LE RÉCAPITULATIF avant un geste irréversible. Émettre signe une clé qu'on ne peut pas
    // reprendre — la console l'écrit elle-même en bas de trois écrans — et c'était le seul geste
    // du produit à ne poser aucune question. On ne pose pas une boîte de plus : la phrase remplace
    // le message et le bouton change de verbe. Toute modification d'un champ DÉSARME : confirmer
    // un récapitulatif périmé serait pire que ne pas en avoir.
    var arme = !opts.recap;
    var desarmer = function () {
      if (arme && opts.recap) { arme = false; var b = $('f-ok'); if (b) b.textContent = okLibelle; $('f-msg').hidden = true; }
    };
    if (opts.recap) { el.addEventListener('input', desarmer); el.addEventListener('change', desarmer); }

    $('f-ok').onclick = function () {
      // Une date qu'on n'a pas su lire ne part pas en silence : elle vaudrait '' et la pièce
      // partirait sans elle. Le refus NOMME le champ et l'amène à l'écran (7.0.0).
      var faux = el.querySelector('[data-date].faux');
      if (faux) {
        var lab = faux.closest('label'), nom = lab ? (lab.querySelector('span') || {}).textContent : 'une date';
        var mf = $('f-msg'); mf.className = 'note'; mf.textContent = 'La date « ' + nom + ' » ne se lit pas : écris-la « jj/mm/aaaa ».';
        mf.hidden = false; faux.focus(); faux.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (!arme) {
        var phrase = opts.recap();
        if (phrase) {
          var m = $('f-msg'); m.className = 'recap'; m.innerHTML = phrase; m.hidden = false;
          $('f-ok').textContent = opts.confirmer || 'Confirmer';
          m.scrollIntoView({ block: 'nearest' });
          arme = true;
          return;
        }
        // Rien à récapituler — un champ obligatoire manque : on laisse le refus normal parler.
        arme = true;
      }
      $('f-ok').disabled = true; $('f-msg').hidden = true;
      // Après un succès, le formulaire a été refermé et ses boutons n'existent plus : on relit
      // l'élément au lieu de le supposer là (attrapé par e2e:console — une exception dans une
      // promesse ne s'affiche nulle part chez l'utilisateur).
      var libere = function () { var b = $('f-ok'); if (b) b.disabled = false; };
      Promise.resolve().then(onOk).then(libere, function (e) {
        libere();
        var m = $('f-msg'); if (m) { m.className = 'note'; m.textContent = e && e.message ? e.message : 'Échec.'; m.hidden = false; }
      });
    };
    var premier = el.querySelector('input,select,textarea'); if (premier) premier.focus();
    // Le formulaire s'insère dans le flux : sans ça il s'ouvre hors de l'écran quand on l'appelle
    // depuis le bas d'une page longue, et on croit que le bouton n'a rien fait.
    el.scrollIntoView({ block: 'nearest' });
  }
  var val = function (name) {
    var e = document.querySelector('#form [name="' + name + '"]');
    if (!e) return '';
    if (e.type === 'checkbox') return e.checked;
    // Un champ de date rend l'ISO, jamais ce qui est à l'écran : le format interne ne fuit pas
    // dans la saisie, et la saisie ne fuit pas dans la donnée (9.4.5).
    return e.hasAttribute('data-date') ? jourSaisi(e.value) : e.value;
  };
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
  var montrerChamp = function (id, oui) {
    var e = document.getElementById(id); if (!e) return;
    // Un ENVELOPPEUR de champs conditionnels se rend en « contents » : en « inline », les champs
    // qu'il porte cessent d'être des cellules de la grille et se collent les uns aux autres.
    e.style.display = oui ? (e.classList.contains('cond') ? 'contents' : '') : 'none';
  };

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
    // Les CHAMPS CONDITIONNELS n'apparaissent qu'avec leur condition. « Payée le » et « Moyen de
    // paiement » restaient visibles et actifs, la date préremplie à aujourd'hui, pendant que la
    // case « Déjà payée » était décochée : deux champs qu'on remplit pour rien. Idem pour la date
    // de fin libre, dont la condition tenait dans son propre libellé (« si jusqu'à une date
    // précise »). Le mécanisme existait déjà — « montrerChamp » sert l'offre et le quota — il
    // n'avait simplement pas été porté aux trois autres.
    var champDateCond = function (nom, label) {
      return '<span id="f-' + nom + '" class="cond" style="display:none">' + champDate(nom, label, '') + '</span>';
    };
    var paiement = '<label class="c w"><input type="checkbox" name="payee"> Déjà payée</label>' +
      '<span id="f-paiement" class="cond" style="display:none">' + champDate('payeeLe', 'Payée le', aujourdhui()) +
      champ('moyen', 'Moyen de paiement', 'placeholder="virement, espèces, chèque…" maxlength="40"') + '</span>';
    // Le quota d'un cabinet, en plus des trois gratuits. Le prix d'un dossier n'est proposé que
    // s'il est réglé (PRIX_CABINET_DOSSIER) : les tarifs du Cabinet ne sont pas fixés, et un chiffre
    // inventé ici deviendrait un tarif par simple préremplissage.
    var champQuota = function (valeur, cache) {
      return '<label class="c w" id="f-sans-limite"' + (cache ? ' style="display:none"' : '') + '>'
        + '<input type="checkbox" name="illimite"> Sans limite de dossiers</label>'
        + '<label class="f" id="f-quota"' + (cache ? ' style="display:none"' : '') + '><span>Dossiers hors SkanFact couverts, en plus des 3 gratuits *</span>'
        + '<input name="dossiersHors" type="number" min="1" max="5000" step="1" value="' + h(valeur == null ? '' : valeur) + '"></label>';
    };
    var prixCabinet = function (n) { return t.cabinetDossier > 0 && n > 0 ? Math.round(t.cabinetDossier * n * 1000) / 1000 : ''; };
    // Le PRIX PROPOSÉ, en une seule fonction — celle que le rendu et les gestionnaires appellent
    // tous les deux.
    //
    // Écrit en dur à côté du sélecteur, il s'en désaccorde à la première divergence : le
    // formulaire s'ouvrait sur « Offre : Indépendant » et « Prix : 690 », le prix de l'Entreprise,
    // parce que la liste des offres commence par « independant » pendant que le champ était
    // initialisé à « t.entreprise ». Le seul geste qui corrigeait était celui que personne n'a de
    // raison de faire — changer un sélecteur qui affiche déjà ce qu'on veut. Le cas nominal
    // émettait donc un Indépendant facturé 300 TND de trop, sur une clé qu'on ne peut pas
    // reprendre, et rien à l'écran ne le disait.
    // L'état initial se dérive de la MÊME fonction que la mise à jour : c'est ce qui rend les deux
    // indivergeables (règle 9.8.4, appliquée ici à un écran de saisie).
    var offreInitiale = (lic && lic.offre && mode !== 'offre') ? lic.offre : Object.keys(etat.offres)[0];
    var prixPropose = function (type, offre, quota) {
      return type === 'cabinet' ? prixCabinet(Number(quota) || 0) : (t[offre] != null ? t[offre] : '');
    };
    // « Proposé » n'est pas « décidé ». Un montant prérempli n'engage à rien tant qu'on ne l'a pas
    // regardé : le champ le DIT, et cesse de le dire dès qu'on y touche — même motif que
    // « regimeTouche » dans l'app entreprise (7.25.0, 7.30.0).
    var noteprix = function (texte) { return '<span class="pr" id="f-prix-src">' + h(texte) + '</span>'; };
    var champPrix = function (valeur, propose) {
      return '<label class="f"><span>Prix HT (' + h(t.devise) + ') *' + (propose ? noteprix(propose) : '') + '</span>'
        + '<input name="prix" type="number" step="0.001" min="0" value="' + h(valeur == null ? '' : valeur) + '"></label>';
    };
    var titre, why, champs, ok;
    if (!lic) {
      titre = 'Émettre une licence';
      why = 'Trois choses dans le même geste : la clé signée par le serveur, la vente, la ligne de journal. Si la vente est déjà payée, la clé part par mail tout de suite (quand le client a une adresse). ' +
        'Une licence de <strong>cabinet</strong> porte l\\u2019empreinte du cabinet et un quota de dossiers hors SkanFact \\u2014 ou aucune limite \\u2014, jamais une offre : SkanFact Cabinet la reconnaît, SkanFact la refuse.';
      champs = '<label class="f w"><span>Client *</span>' + choixClient + '</label>' +
        '<label class="f w"><span>Type</span><select name="type">' +
          '<option value="entreprise">Entreprise — s\\u2019installe dans SkanFact (une offre, un matricule)</option>' +
          '<option value="cabinet">Cabinet comptable — s\\u2019installe dans SkanFact Cabinet (un quota de dossiers)</option></select></label>' +
        '<label class="f" id="f-offre"><span>Offre</span><select name="offre">' + offres + '</select></label>' +
        '<label class="f"><span>Durée</span><select name="duree">' + durees + '</select></label>' +
        champDateCond('dateLibre', 'Date de fin') +
        champQuota('', true) +
        champPrix(prixPropose('entreprise', offreInitiale, 0), 'proposé d\\u2019après l\\u2019offre') +
        '<label class="c w" id="f-parrain"><input type="checkbox" name="parrain"> Client parrainé par un cabinet comptable (remise de ' + t.remiseParrainage + ' % la première année)</label>' +
        champ('cabinet', 'Empreinte du cabinet (facultatif)', 'placeholder="xxxx-xxxx-xxxx-xxxx-xxxx" maxlength="30"', true) +
        paiement;
      ok = 'Émettre la licence';
    } else if (mode === 'renouveler') {
      var depart = lic.fin && lic.fin > aujourdhui() ? lic.fin : aujourdhui();
      titre = 'Renouveler la licence de ' + lic.client;
      why = (cab ? h(libOffre(lic)) : 'Offre ' + h(libOffre(lic))) + (lic.fin ? ', fin actuelle le ' + jour(lic.fin) : '') + '. La nouvelle période part du <strong>' + jour(depart) + '</strong> : les jours déjà payés ne sont pas perdus. Une nouvelle clé est signée, l\\u2019ancienne reste valable jusqu\\u2019à sa date.' +
        (cab ? ' Le quota se garde tel quel — modifie-le ici si le cabinet a pris des clients.' : ' La remise de parrainage ne s\\u2019applique qu\\u2019à la première année.');
      champs = '<label class="f"><span>Durée</span><select name="duree">' + durees + '</select></label>' +
        champDateCond('dateLibre', 'Date de fin') +
        (cab ? champQuota(lic.dossiers_hors, false) : '') +
        champPrix(prixPropose(cab ? 'cabinet' : 'entreprise', lic.offre, lic.dossiers_hors), 'proposé d\\u2019après l\\u2019offre en cours') +
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
        champPrix('', 'la différence se calcule quand tu choisis l\\u2019offre') +
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
        champPrix(pro.montant, 'la différence au prorata') +
        paiement;
      ok = 'Changer l\\u2019offre';
    }
    // LE RÉCAPITULATIF. Une clé livrée ne se reprend pas — la console l'écrit sous trois de ses
    // écrans — et c'était pourtant le seul geste du produit à ne rien demander avant d'agir. On
    // relit ce qu'on est sur le point de signer, en une phrase : à qui, quelle offre, jusqu'à
    // quand, pour combien. La phrase se calcule au moment du clic, jamais au rendu : entre les
    // deux, quatre champs ont pu changer.
    var recap = function () {
      var cabinet = (val('type') || 'entreprise') === 'cabinet';
      var cl = document.querySelector('#form [name="clientId"]');
      var qui = lic ? lic.client : (cl && cl.options[cl.selectedIndex] ? cl.options[cl.selectedIndex].textContent : '');
      var prix = Number(val('prix'));
      if (!qui || !(prix >= 0) || val('prix') === '') return '';
      // Pour un cabinet, l'empreinte EST le sujet de la clé : sans elle, le serveur refuse. On ne
      // récapitule pas un formulaire incomplet — la relecture porterait sur un geste qui ne peut
      // pas aboutir, et c'est le refus normal qui doit parler (7.0.0).
      if (cabinet && !val('cabinet')) return '';
      var sansLimite = !!(document.querySelector('#form [name="illimite"]') || {}).checked;
      var quoi = cabinet
        ? (sansLimite ? 'dossiers hors SkanFact SANS LIMITE'
          : (val('dossiersHors') ? val('dossiersHors') + ' dossiers hors SkanFact' : ''))
        : (etat.offres[val('offre')] || {}).label;
      if (!quoi) return '';
      var d = val('duree'), dl = val('dateLibre');
      var jusque = d === 'vie' ? 'à vie' : (dl ? 'jusqu\\u2019au ' + jour(dl)
        : (etat.durees.filter(function (x) { return x.id === d; })[0] || {}).label || '');
      var remise = val('parrain') ? ' Remise de parrainage : ' + t.remiseParrainage + ' %.' : '';
      return '<strong>' + h(quoi) + ' pour ' + h(qui) + '</strong>, ' + h(jusque) + ', '
        + h(montant(prix, t.devise)) + ' HT.' + h(remise)
        + '<br>La clé sera signée et <strong>ne pourra pas être reprise</strong>'
        + (val('payee') ? ' ; la vente étant payée, elle part par mail tout de suite.' : '.');
    };
    formulaire(titre, why, champs, ok, function () {
      var corps = { type: val('type') || undefined, offre: val('offre'), duree: val('duree'), dateLibre: val('dateLibre'), prix: val('prix'),
        dossiersHors: val('dossiersHors'),
        illimite: !!(document.querySelector('#form [name="illimite"]') || {}).checked,
        remise: val('parrain') ? t.remiseParrainage : 0, cabinet: val('cabinet'),
        payeeLe: val('payee') ? val('payeeLe') : '', moyen: val('moyen'), devise: t.devise };
      var chemin;
      if (!lic) { corps.clientId = val('clientId'); chemin = 'licences'; }
      else chemin = 'licences/' + lic.id + '/' + (mode === 'renouveler' ? 'renouveler' : 'changer-offre');
      return api(chemin, corps).then(function (j) {
        fermerForm(); montrerResultat(j); dessiner();
      });
    }, { recap: recap, confirmer: 'Confirmer et signer' });
    // Le prix proposé suit l'offre choisie — c'est un préremplissage, jamais une décision.
    var prixEl = function () { return document.querySelector('#form [name="prix"]'); };
    // Poser le prix, c'est aussi poser ce que le champ DIT de lui-même : sans ça, la note
    // continuerait d'annoncer « proposé d'après l'offre » sur un montant que le sélecteur ne
    // produit plus.
    var poserPrix = function (valeur, note) {
      var p = prixEl(); if (!p) return;
      p.value = valeur == null ? '' : valeur;
      var s = document.getElementById('f-prix-src');
      if (s) { s.textContent = note; s.className = 'pr'; }
    };
    var p0 = prixEl();
    if (p0) p0.oninput = function () {
      var s = document.getElementById('f-prix-src');
      if (s) { s.textContent = 'saisi à la main'; s.className = 'pr main'; }
    };
    // Les deux conditions, posées à l'ouverture ET à chaque changement : un champ conditionnel
    // qui naît visible est un champ qu'on remplit pour rien.
    var cp = document.querySelector('#form [name="payee"]');
    var sd = document.querySelector('#form [name="duree"]');
    var majConditions = function () {
      montrerChamp('f-paiement', !!(cp && cp.checked));
      montrerChamp('f-dateLibre', !!(sd && sd.value === 'date'));   // l'identifiant de « Jusqu'à une date précise »
    };
    if (cp) cp.onchange = majConditions;
    if (sd) sd.onchange = majConditions;
    majConditions();
    var so = document.querySelector('#form [name="offre"]');
    if (so) so.onchange = !lic
      ? function () { poserPrix(prixPropose('entreprise', so.value, 0), 'proposé d\\u2019après l\\u2019offre'); }
      // Changer d'offre : ce qu'on facture est la DIFFÉRENCE au prorata, et elle dépend de l'offre
      // choisie. Sans ce gestionnaire, revenir à l'offre en cours laissait le montant de l'autre.
      : function () { poserPrix(prorata(lic, t[so.value], t[lic.offre]).montant, 'la différence au prorata'); };
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
    // « Sans limite » (10.8.0) : la case cache le quota, parce que réclamer un chiffre dont on vient
    // de dire qu'il ne sert pas est un piège — et le champ porte une étoile d'obligation qu'on ne
    // peut plus satisfaire. Les deux moitiés vont ensemble : cocher cache, décocher rend.
    var sl = document.querySelector('#form [name="illimite"]');
    // Tous les formulaires n'ont pas de sélecteur de type : le renouvellement d'une licence de
    // cabinet n'en a pas, et son quota est visible DÈS LE RENDU. Sans cette lecture, la mise à jour le
    // cachait au branchement — le champ obligatoire d'un formulaire qui ne peut plus aboutir.
    // C'est le parcours de la console qui l'a vu : la relecture, non.
    // ⚠️ Le nom NE PEUT PAS être « estCabinet » : la page en a déjà une, au niveau du module, et un
    // « var » local masque la fonction du module dans TOUT le corps — y compris au-dessus de sa propre
    // affectation, où il vaut « undefined ». La première version a donc tué « formEmettre » à sa
    // troisième ligne, avant même d'arriver ici : le formulaire ne s'ouvrait plus, et rien
    // n'apparaissait dans aucune console qu'on regarde. C'est la bombe silencieuse de la 7.22.0,
    // dans une variante neuve : masquer, au lieu d'appeler ce qui n'existe pas.
    var qEl = document.getElementById('f-quota');
    var quotaAuDepart = !!qEl && qEl.style.display !== 'none';
    var typeCabinet = function () { return st ? st.value === 'cabinet' : quotaAuDepart; };
    var majQuota = function () {
      var cabinet = typeCabinet();
      montrerChamp('f-sans-limite', cabinet);
      montrerChamp('f-quota', cabinet && !(sl && sl.checked));
    };
    if (st) st.onchange = function () {
      var cabinet = st.value === 'cabinet';
      montrerChamp('f-offre', !cabinet); montrerChamp('f-parrain', !cabinet);
      majQuota();
      etiquetteEmpreinte(cabinet);
      poserPrix(prixPropose(cabinet ? 'cabinet' : 'entreprise', so ? so.value : offreInitiale, sq && sq.value),
        cabinet ? 'proposé d\\u2019après le quota' : 'proposé d\\u2019après l\\u2019offre');
    };
    if (sl) sl.onchange = function () {
      majQuota();
      // Sans quota, il n'y a plus de prix à proposer : le laisser afficher un montant calculé sur
      // un nombre de dossiers qui ne compte plus serait un chiffre faux (7.16.0).
      if (sl.checked) poserPrix('', 'sans limite : le prix se saisit à la main');
    };
    majQuota();
    if (sq) sq.oninput = function () {
      var q = Number(sq.value) || 0; if (!(t.cabinetDossier > 0)) return;
      // Émission ou renouvellement : le prix plein du quota. Changement : la différence au prorata.
      var change = lic && mode !== 'renouveler';
      poserPrix(change ? prorata(lic, prixCabinet(q), prixCabinet(Number(lic.dossiers_hors) || 0)).montant : prixCabinet(q),
        change ? 'la différence au prorata' : 'proposé d\\u2019après le quota');
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
  // LA CLÉ, affichée. Un seul bloc, partagé par les deux panneaux qui la montrent — celui de
  // l'émission et celui de « Voir la clé ». Ils la dessinaient chacun à leur façon : deux
  // implémentations du même objet divergent toujours (7.29.0), et c'est ce qui a fait qu'une
  // refonte de l'un laissait l'autre en arrière.
  //
  // La clé est RÉSUMÉE : on la reconnaît par ses bouts, on ne la lit jamais en entier. Lui donner
  // cinq lignes revenait à faire de la donnée la moins lisible du produit l'élément le plus visible
  // de l'écran, pendant que le geste — copier — se trouvait en dessous. Le texte complet reste à
  // un clic, pour le cas où on le recopie à la main.
  function blocCle(cle, kid) {
    cle = String(cle || '');
    var court = cle.length > 44 ? cle.slice(0, 22) + '\\u2026' + cle.slice(-14) : cle;
    return '<div class="cle-court"><code id="cle-court">' + h(court) + '</code>'
      + '<button id="cle-voir" class="btn s" type="button">Voir la clé entière</button>'
      + (kid ? '<span class="quand">signée avec ' + h(kid) + '</span>' : '') + '</div>'
      + '<div class="cle" id="cle" hidden>' + h(cle) + '</div>';
  }
  function brancherCle(cle) {
    if ($('cle-copier')) $('cle-copier').onclick = function () { copier(cle, $('cle-copier')); };
    if (!$('cle-voir')) return;
    $('cle-voir').onclick = function () {
      var c = $('cle'), b = $('cle-voir');
      c.hidden = !c.hidden;
      b.textContent = c.hidden ? 'Voir la clé entière' : 'Masquer la clé';
    };
  }

  // Le panneau de la clé émise. C'est le seul moment de la console où quelque chose
  // d'IRRÉVERSIBLE vient de réussir, et il n'en avait aucun signe : même cadre, même bordure que
  // tout le reste. Pire, l'élément le plus proéminent de l'écran était cinq lignes de base64 que
  // personne ne lit, pendant que le geste — copier — se trouvait en dessous.
  //
  // Et le parcours s'arrêtait là : « Pas envoyée par mail : la vente n'est pas encore payée »
  // nommait le blocage sans offrir ce qui le lève, qui vivait sur un AUTRE onglet. Chaque écran
  // finit par le geste suivant (7.27.0, 9.4.9) — ici, encaisser.
  function montrerResultat(j) {
    var el = $('resultat'); var l = j.licence || {};
    var mail = j.mail || {};
    var v = j.vente;
    var cle = String(j.cle || '');
    el.className = 'ok';
    el.innerHTML = '<h2><span class="coche" aria-hidden="true">\\u2713</span> Clé émise pour ' + h(l.client) + '</h2>' +
      '<p class="why">' + h(libOffre(l)) + (l.fin ? ', jusqu\\u2019au ' + jour(l.fin) : ', à vie') +
      ' — ' + h(montant(v ? v.montant_ht : l.prix, l.devise)) + ' HT' + (v && v.payee_le ? ', payée le ' + jour(v.payee_le) : ', à encaisser') + '.</p>' +
      blocCle(cle, l.kid) +
      '<p class="note' + (mail.envoye ? ' bon' : '') + '">' + (mail.envoye ? '\\u2713 Envoyée par mail à ' + h(mail.a) + '.' : 'Pas envoyée par mail : ' + h(mail.raison || '') + '.') + '</p>' +
      '<div class="row">' +
      // Le geste SUIVANT passe devant : quand la vente n'est pas payée, c'est l'encaissement qui
      // débloque l'envoi, et c'est lui le bouton principal.
      (v && !v.payee_le
        ? '<button id="cle-payee" class="btn p" type="button">Marquer payée et envoyer la clé\\u2026</button>'
          + '<button id="cle-copier" class="btn" type="button">Copier la clé</button>'
        : '<button id="cle-copier" class="btn p" type="button">Copier la clé</button>') +
      '<button id="cle-fermer" class="btn" type="button">Fermer</button></div>';
    el.hidden = false;
    brancherCle(cle);
    if ($('cle-payee')) $('cle-payee').onclick = function () { payee(v); };
    $('cle-fermer').onclick = function () { el.hidden = true; el.className = ''; el.innerHTML = ''; };
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
        (j.cle ? blocCle(j.cle, l.kid) : '<p class="note">' + h(j.cleRaison) + '</p>') +
        '<div class="row">' + (j.cle ? '<button id="cle-copier" class="btn p" type="button">Copier la clé</button>' : '') +
        '<button id="cle-fermer" class="btn" type="button">Fermer</button></div>';
      el.hidden = false;
      brancherCle(j.cle);
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
      montrerMail(j, 'Écrire à ' + (j.client || 'ce client'));
    }, montrerErreur);
  }
  // Un mail composé par la console, quel qu'il soit : relance, devis. Une seule fonction, parce
  // que deux affichages du même objet finiraient par diverger — l'un porterait le bouton « copier »
  // et l'autre pas, sans que personne ne l'ait décidé (7.29.0).
  function montrerMail(j, titre) {
    {
      var el = $('resultat');
      var lien = 'mailto:' + encodeURIComponent(j.a) + '?subject=' + encodeURIComponent(j.sujet)
        + '&body=' + encodeURIComponent(j.corps);
      // Sans adresse, on ne fait pas semblant : on dit ce qui manque et où on le règle (7.0.0 — un
      // refus dit ce qui est refusé, pourquoi, et le geste qui débloque).
      el.innerHTML = '<h2>' + h(titre) + '</h2>'
        + (j.a
          ? '<p class="why">À <strong>' + h(j.a) + '</strong>. Le texte s\\u2019ouvre dans ta messagerie : tu le relis, tu le modifies si tu veux, et c\\u2019est toi qui envoies.</p>'
          : '<p class="why" style="color:var(--warn)">Ce client n\\u2019a pas d\\u2019adresse e-mail : ajoute-la sur l\\u2019écran Clients, et le bouton s\\u2019allumera. Le texte reste copiable ci-dessous.</p>')
        // Le corps d'un mail se lit dans la police de LECTURE. En chasse fixe, il ressemble à un
        // fichier de configuration — et donne l'impression d'un envoi automatique, alors que tout
        // ce panneau est bâti pour dire l'inverse (« c'est toi qui envoies »).
        + '<div class="mail-txt" id="relance-txt">' + h(j.sujet + '\\n\\n' + j.corps) + '</div>'
        + '<div class="row">'
        + (j.a ? '<a class="btn p lien-btn" id="relance-ouvrir" href="' + h(lien) + '">Ouvrir dans ma messagerie</a>' : '')
        + '<button id="relance-copier" class="btn" type="button">Copier le texte</button>'
        + '<button id="relance-fermer" class="btn" type="button">Fermer</button></div>';
      el.hidden = false;
      $('relance-copier').onclick = function () { copier(j.sujet + '\\n\\n' + j.corps, $('relance-copier')); };
      $('relance-fermer').onclick = function () { el.hidden = true; el.innerHTML = ''; };
      el.scrollIntoView({ block: 'nearest' });
    }
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
      champDate('date', 'Payée le', aujourdhui()) + champ('moyen', 'Moyen', 'placeholder="virement, espèces, chèque…" maxlength="40"'),
      'Marquer payée', function () {
        return api('ventes/' + v.id + '/payee', { date: val('date'), moyen: val('moyen') }).then(function (j) {
          fermerForm();
          montrerInfo('Vente payée. ' + (j.mail && j.mail.envoye ? 'Clé envoyée à ' + j.mail.a + '.' : 'Clé non envoyée : ' + (j.mail ? j.mail.raison : '') + '.'));
          dessiner();
        });
      });
  }
  // 10.9.0 — redemander au prestataire. C'est le troisième chemin vers la même fonction : le
  // webhook, la page de retour du client, et ce bouton. Un chemin de secours ne sert que s'il
  // existe le jour où les deux autres n'ont rien donné (6.7.2).
  function verifierCommande(c) {
    api('commandes/' + c.id + '/verifier', {}).then(function (j) {
      montrerInfo(j.livree ? 'Paiement confirm\u00e9 : la cl\u00e9 a \u00e9t\u00e9 \u00e9mise' + (j.mail && j.mail.envoye ? ' et envoy\u00e9e \u00e0 ' + j.mail.a : ' — mais le mail n\u2019est pas parti : ' + ((j.mail || {}).raison || '')) + '.'
        : 'Rien de neuf : ' + (j.raison || 'le prestataire ne confirme pas ce paiement.'));
      dessiner();
    });
  }
  function abandonnerCommande(c) {
    formulaire('Marquer cette commande abandonn\u00e9e ?',
      h(c.nom) + ' — ' + montant(c.montant_ttc, c.devise) + ' TTC, ouverte le ' + jour(c.cree_le) + '.<br>'
      + '<strong style="color:var(--warn)">Ce que \u00e7a fait vraiment :</strong> elle sort des paniers en attente et cesse d\u2019\u00eatre livrable. '
      + 'Rien n\u2019est encaiss\u00e9 \u00e0 ce stade — mais si le client paie malgr\u00e9 tout, son paiement ne livrera plus rien et il faudra le rembourser.',
      '', 'Marquer abandonn\u00e9e', function () {
        return api('commandes/' + c.id + '/abandonner', {}).then(function () { fermerForm(); montrerInfo('Commande abandonn\u00e9e.'); dessiner(); });
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
    { k: 'licencesRevoquees', s: 'licence révoquée', p: 'licences révoquées', c: 'rev', t: 'licences' },
    { k: 'clients', s: 'client', p: 'clients', c: '', t: 'clients' }
  ];

  // ---------------------------------------------------------------- ce qui se LIT, et ce qui se range
  //
  // Un identifiant interne n'est pas un mot. Le Journal affichait « licence.emise », « client.cree »
  // et « mail.envoye » en chasse fixe — sans accents, donc lus comme des fautes de frappe — et la
  // colonne Système rendait « darwin ». La console est l'écran d'un dirigeant, pas d'un
  // développeur : « darwin » ne répond pas à « mon prospect est sur Mac ou sur PC ? », et un
  // journal lisible est exactement ce qui permet « de répondre à un client six mois plus tard »,
  // ce que la page promet elle-même en sous-titre.
  //
  // L'identifiant reste atteignable au survol : on le donne quand on écrit à un développeur.
  var NOM_EVT = {
    'client.cree': 'Client créé',
    'licence.emise': 'Licence émise',
    'licence.renouvellement': 'Licence renouvelée',
    'licence.offre': 'Offre changée',
    'licence.matricule': 'Matricule corrigé',
    'licence.revoquee': 'Licence révoquée',
    'licence.importee': 'Licence importée depuis SkanFact',
    'mail.envoye': 'Clé envoyée par mail',
    'mail.echec': 'Envoi du mail en échec',
    'vente.payee': 'Vente encaissée',
    'vente.facturee': 'Numéro de facture posé',
    'base.exportee': 'Base exportée',
    'base.export.echec': 'Export de la base en échec',
    'reglages.changes': 'Réglages modifiés',
    'suivi.note': 'Contact noté'
  };
  var nomEvt = function (v) {
    return NOM_EVT[v] ? '<span title="' + h(v) + '">' + h(NOM_EVT[v]) + '</span>' : '<span class="mono">' + h(v) + '</span>';
  };
  // L'article d'un titre d'onglet. « Ouvrir licences » se lit comme une commande de terminal ;
  // un libellé décrit l'écran d'ARRIVÉE, dans la langue où on le nommerait à voix haute (7.29.0).
  var ARTICLE = { activations: 'les ', alertes: 'les ', cabinets: 'les ', clients: 'les ', essais: 'les ',
    evenements: 'le ', licences: 'les ', parc: 'le ', reglages: 'les ', ventes: 'les ' };
  var article = function (vue) {
    return (ARTICLE[vue] || '') + String(TITRES[vue] || vue).toLowerCase();
  };
  var NOM_OS = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

  var etatLic = function (r) {
    // Un ÉTAT est un vocabulaire fermé ; le motif d'une révocation est un texte libre. Collé dans
    // la pastille, il portait la colonne « État » à 338 px sur une table qui débordait de 256 — et
    // il changeait de largeur d'une ligne à l'autre. Le motif reste lisible au survol, et en
    // entier sur la fiche du client : ce n'est pas un état, c'est un détail de cet état.
    if (r.revoquee_le) return '<span class="pill r"' + (r.revoquee_motif ? ' title="' + h(r.revoquee_motif) + '"' : '') + '>révoquée</span>';
    if (r.remplacee_par) return '<span class="pill e">remplacée</span>';
    if (r.fin && r.fin < aujourdhui()) return '<span class="pill e">expirée</span>';
    return '<span class="pill a">active</span>';
  };
  // ---------------------------------------------------------------- LE MENU D'ACTIONS D'UNE LIGNE
  //
  // Les deux applications ont « src/renderer/rowmenu.js » depuis la 7.29.0 : une ligne garde AU PLUS
  // UN bouton visible — celui du geste pour lequel la page existe — et tout le reste passe par un
  // menu. La console ne l'avait jamais reçu, et elle empilait jusqu'à CINQ boutons par ligne, l'un
  // sous l'autre : mesuré, 210 px par ligne de Licences, contre 50 pour une ligne à un bouton.
  // Trois conséquences qui se cumulaient — la pagination est à 50 lignes, donc une page pleine
  // faisait 10 500 px ; la hauteur variait d'un facteur 4 selon le nombre d'actions disponibles,
  // donc le tableau n'avait aucun rythme ; et « Révoquer », le seul geste irréversible, avait
  // exactement le même poids visuel que « Voir la clé ».
  //
  // Ce module-ci est une SECONDE implémentation, et c'est assumé : le worker est un fichier unique
  // déployé sur Cloudflare, il ne peut pas charger un fichier du dépôt. Ce qui ne diverge pas,
  // ce sont les RÈGLES — au plus un bouton visible, jamais de libellé de moins de six caractères,
  // pas de bouton sur une ligne sans action, une action seule devient un bouton nommé — et c'est
  // un test qui les tient des DEUX côtés, plutôt qu'une comparaison de corps impossible ici.
  var ICONES_ACT = {
    voir: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    envoyer: 'M3 5h18v14H3z M3 6l9 7 9-7',
    renouveler: 'M21 12a9 9 0 1 1-2.6-6.4 M21 3v6h-6',
    offre: 'M12 3v18 M8 7h6a3 3 0 0 1 0 6H10a3 3 0 0 0 0 6h6',
    revoquer: 'M5 5l14 14 M19 5L5 19',
    ecrire: 'M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z',
    payee: 'M20 6 9 17l-5-5',
    facturee: 'M6 3h9l3 3v15H6z M9 9h6 M9 13h6 M9 17h4',
    fiche: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
    suivre: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z',
    aller: 'M5 12h14 M13 6l6 6-6 6'
  };
  var icoAct = function (k) {
    var d = ICONES_ACT[k];
    return d ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>' : '';
  };
  // La cellule d'actions d'une ligne. « actions » est la liste ENTIÈRE ; la première est celle qui
  // reste visible, le reste entre dans le menu. Une action seule ne se cache jamais derrière un
  // menu : deux clics et une lecture pour un choix unique, c'est ce qu'on reprochait aux rangées
  // (7.29.0).
  // Le contenu d'un menu vit dans une TABLE, jamais dans le DOM de la cellule : un « script » de
  // données au milieu d'un tableau est un piège (il change ce que comptent les sondes, et la
  // balise fermante casserait le gabarit de cette page). La table se vide à chaque dessin, sinon
  // elle retiendrait les lignes d'un écran qu'on a quitté.
  var MENUS = {};
  var celluleActions = function (id, actions) {
    actions = (actions || []).filter(Boolean);
    if (!actions.length) return '';
    var att = function (a) {
      return ' data-act="' + h(a.act) + '"' + (a.onglet ? ' data-onglet="' + h(a.onglet) + '"' : ' data-id="' + h(id) + '"');
    };
    var premier = actions[0];
    var s = '<button type="button" class="btn s' + (premier.cls || '') + '"' + att(premier) + '>' + h(premier.lib) + '</button>';
    if (actions.length === 1) return s;
    MENUS[id] = actions.slice(1);
    return s + '<button type="button" class="btn s menu-b" data-menu="' + h(id) + '" aria-haspopup="menu" aria-expanded="false" aria-label="Autres actions">'
      + '<span aria-hidden="true">\\u22ef</span></button>';
  };
  // Le menu vit sur le BODY, pas dans la cellule : un conteneur qui défile de côté le rognerait,
  // et c'est justement le cas qu'on répare. Il se ferme au clic à côté, à Échap, et au défilement
  // — mais seulement si le conteneur a VRAIMENT bougé de plus de quatre pixels : le « scroll » qui a
  // amené le bouton à l'écran juste avant le clic est livré à la frame suivante, et refermerait le
  // menu qu'on vient d'ouvrir (piège 7.29.0).
  var menuOuvertSur = null;
  // Le gestionnaire des gestes d'une ligne, reposé à chaque dessin du tableau. Il vit ici parce
  // que le menu, lui, vit sur le body : les deux doivent servir la même table d'actions.
  var agirLigne = null;
  function fermerMenuLigne() {
    var m = document.getElementById('rowmenu');
    if (m) m.remove();
    if (menuOuvertSur) { menuOuvertSur.setAttribute('aria-expanded', 'false'); menuOuvertSur = null; }
  }
  function ouvrirMenuLigne(bouton, actions) {
    // Rappuyer sur le bouton d'un menu ouvert le FERME : sans ça il clignote et reste ouvert, et
    // un bouton qui ne se referme pas n'est pas un interrupteur (7.29.0).
    if (menuOuvertSur === bouton) { fermerMenuLigne(); return; }
    fermerMenuLigne();
    var d = document.createElement('div');
    d.id = 'rowmenu'; d.setAttribute('role', 'menu');
    d.innerHTML = actions.map(function (a) {
      return '<button type="button" role="menuitem" class="' + (a.cls === ' d' ? 'd' : '') + '"'
        + ' data-act="' + h(a.act) + '"' + (a.onglet ? ' data-onglet="' + h(a.onglet) + '"' : ' data-id="' + h(bouton.dataset.menu) + '"') + '>'
        + icoAct(a.act) + '<span>' + h(a.lib) + (a.quoi ? '<em>' + h(a.quoi) + '</em>' : '') + '</span></button>';
    }).join('');
    document.body.appendChild(d);
    var r = bouton.getBoundingClientRect();
    var haut = r.bottom + 6, large = d.offsetWidth || 240;
    if (haut + d.offsetHeight > window.innerHeight - 8) haut = Math.max(8, r.top - d.offsetHeight - 6);
    d.style.top = haut + 'px';
    d.style.left = Math.max(8, Math.min(r.right - large, window.innerWidth - large - 8)) + 'px';
    bouton.setAttribute('aria-expanded', 'true');
    menuOuvertSur = bouton;
    var conteneur = document.querySelector('main'), depart = conteneur ? conteneur.scrollTop : 0;
    var auDefilement = function () {
      if (!conteneur || Math.abs(conteneur.scrollTop - depart) > 4) fermerMenuLigne();
    };
    if (conteneur) conteneur.addEventListener('scroll', auDefilement, { once: true });
    var premier = d.querySelector('button'); if (premier) premier.focus();
  }
  var COLONNES = {
    licences: [
      { k: 'client', t: 'Client', tr: true },
      // Un cabinet : son quota, et combien de ses clients ont une licence parrainée par lui.
      { k: 'offre', t: 'Offre', tr: true, f: function (v, r) {
          var n = Number(r.parraines) || 0;
          return libOffre(r) + (estCabinet(r) && n ? ' (' + n + ' parrainé' + (n === 1 ? '' : 's') + ')' : '');
        } },
      { k: 'fin', t: 'Fin', f: function (v) { return v ? jour(v) : 'à vie'; } },
      { k: 'activations', t: 'Postes', n: true },
      { k: 'envoyee_le', t: 'Envoyée', f: function (v, r) { return v ? jour(v) : (r.revoquee_le ? '—' : '<span class="pill w">jamais</span>'); }, brut: true },
      { k: 'revoquee_le', t: 'État', f: function (v, r) { return etatLic(r); }, brut: true },
      // Le geste pour lequel cette page existe est « Voir la clé » : c'est le produit. Tout le
      // reste vit dans le menu, dans l'ordre où l'on en a besoin, le destructeur en dernier.
      { k: 'id', t: 'Actions', brut: true, a: true, f: function (v, r) {
          var actes = [{ act: 'voir', lib: 'Voir la clé', quoi: 'la clé signée, à copier ou à relire' }];
          if (!r.revoquee_le) {
            if (r.resignable) actes.push({ act: 'envoyer', lib: r.envoyee_le ? 'Renvoyer par mail' : 'Envoyer par mail',
              quoi: r.envoyee_le ? 'le client l\\u2019a perdue' : 'la clé part à son adresse' });
            if (!r.remplacee_par) {
              actes.push({ act: 'renouveler', lib: 'Renouveler', quoi: 'repartir de la date de fin' });
              actes.push({ act: 'offre', lib: estCabinet(r) ? 'Changer le quota' : 'Changer d\\u2019offre',
                quoi: 'la différence se facture au prorata' });
              // « Écrire… » n'apparaît que sur une licence qui SE TERMINE : c'est le geste que
              // l'alerte annonce, et le proposer sur chaque ligne ferait une entrée de plus pour un
              // besoin qui n'existe qu'une fois par an et par client.
              if (r.fin && r.fin <= dansTrenteJours()) actes.push({ act: 'ecrire', lib: 'Écrire au client…', quoi: 'préparer le mail de renouvellement' });
            }
            actes.push({ act: 'revoquer', lib: 'Révoquer…', cls: ' d', quoi: 'la clé reste valable chez le client' });
          }
          return celluleActions(r.id, actes);
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
      // Un ÉTAT n'occupe pas la colonne où va un nom : « — en essai — » y remplaçait le client
      // par une valeur qui n'en est pas un. Le nom reste vide, et l'état porte sa pastille.
      { k: 'client', t: 'Client', tr: true },
      { k: 'empreinte', t: 'Licence', brut: true, f: function (v, r) {
          if (r.client) return '<span class="pill a">sous licence</span>';
          return v === 'ESSAI' ? '<span class="pill e">essai</span>' : '<span class="pill w">licence inconnue</span>';
        } },
      { k: 'device_nom', t: 'Ordinateur', tr: true },
      { k: 'plateforme', t: 'Système', f: function (v) { return NOM_OS[v] || v || '\\u2014'; } },
      { k: 'version', t: 'Version', m: true },
      // « Vu » et « Depuis » rendaient la même valeur au même format sur un poste neuf : deux
      // colonnes identiques dont rien ne disait qu'elles portent deux faits différents. Les
      // libellés le disent maintenant, et seule la DERNIÈRE fois porte l'heure — c'est elle qui
      // répond à « il a testé quand dans la journée ? ».
      { k: 'derniere_fois', t: 'Dernière fois', f: function (v) { return quandVu(v); }, brut: true },
      { k: 'premiere_fois', t: 'Première fois', f: function (v) { return v ? jour(v) : '\\u2014'; } }
    ],
    clients: [
      { k: 'nom', t: 'Nom', tr: true }, { k: 'matricule', t: 'Matricule', m: true },
      // Le courriel reste : c'est l'adresse où la console ENVOIE les clés, et « sans e-mail » est
      // une information qui change ce qu'on peut faire. Le téléphone et la date de création, eux,
      // vivent sur la fiche — et ils coûtaient 253 px à une table qui débordait de 251. Une
      // colonne qui répète la fiche sans jamais décider d'un geste est une colonne qui prend la
      // place de celle qu'on est en train de couper (9.4.4).
      { k: 'email', t: 'Courriel', tr: true },
      // Ce qu'on a besoin de savoir AVANT d'ouvrir une fiche. Une liste de noms nus oblige à ouvrir
      // chaque client pour trouver celui qu'on cherche.
      { k: 'licences', t: 'Licences', n: true, i: 'Ses licences en cours : ni révoquées, ni remplacées par une plus récente.' },
      { k: 'impayees', t: 'Impayées', n: true, brut: true,
        f: function (v) { return Number(v) ? '<span class="pill w">' + v + '</span>' : '—'; } },
      { k: 'vu_le', t: 'Dernier contact', brut: true,
        i: 'La dernière fois que tu as noté un contact avec ce client. Vide, personne ne lui a parlé depuis cette console.',
        f: function (v) { return v ? quandVu(v) : '<span class="quand">jamais noté</span>'; } },
      { k: 'id', t: 'Actions', brut: true, a: true, f: function (v, r) {
          return celluleActions(r.id, [{ act: 'fiche', lib: 'Ouvrir la fiche' }]);
        } }
    ],
    ventes: [
      { k: 'client', t: 'Client', tr: true },
      { k: 'montant_ht', t: 'Montant HT', n: true, f: function (v, r) { return montant(v, r.devise); } },
      // Un montant NUL n'a rien à encaisser : le dire « à encaisser » le fait entrer dans les
      // relances et gonfler le total « En attente » de rien du tout. Une licence de cabinet part
      // à zéro tant que les tarifs ne sont pas fixés — c'est le cas normal, pas un impayé.
      { k: 'payee_le', t: 'État', brut: true, f: function (v, r) {
          if (v) return '<span class="pill a">payée le ' + jour(v) + '</span>';
          if (!(Number(r.montant_ht) > 0)) return '<span class="pill e">sans montant</span>';
          return '<span class="pill w">à encaisser</span>';
        } },
      { k: 'moyen', t: 'Moyen' },
      { k: 'facture_skanfact', t: 'Facture', f: function (v) { return v || 'à établir'; } },
      // Encaisser est le geste de cet écran : « Marquer payée » reste visible, et c'est lui qui
      // envoie la clé. Une vente déjà payée n'a plus qu'à être facturée — le bouton visible change
      // donc avec l'état de la ligne, parce qu'un libellé décrit le geste SUIVANT (7.19.0).
      { k: 'id', t: 'Actions', brut: true, a: true, f: function (v, r) {
          var actes = [];
          if (!r.payee_le) {
            actes.push({ act: 'payee', lib: 'Marquer payée', quoi: 'la clé part par mail dans la seconde' });
            actes.push({ act: 'ecrire', lib: 'Relancer…', quoi: 'préparer le mail d\\u2019impayé' });
          }
          if (!r.facture_skanfact) actes.push({ act: 'facturee', lib: 'N\\u00b0 de facture…', quoi: 'celui que tu as établi dans SkanFact' });
          return celluleActions(r.id, actes);
        } }
    ],
    commandes: [
      { k: 'cree_le', t: 'Quand', f: function (v) { return horodate(v); } },
      { k: 'nom', t: 'Acheteur', tr: true },
      { k: 'offre', t: 'Offre', f: function (v) { return libOffre({ offre: v, type: 'entreprise' }); } },
      { k: 'montant_ttc', t: 'Montant TTC', n: true, f: function (v, r) { return montant(v, r.devise); } },
      // L'\u00c9TAT, et la seule ligne qui compte vraiment : payée et pas livrée. Elle est rouge, et
      // elle porte sa raison — « quelque chose a échoué » n'aide personne à décrocher son téléphone.
      { k: 'etat', t: '\u00c9tat', brut: true, f: function (v, r) {
          if (v === 'payee') return '<span class="pill a">livr\u00e9e</span>';
          if (v === 'abandonnee') return '<span class="pill e">abandonn\u00e9e</span>';
          if (r.paiement_le) return '<span class="pill r" title="' + h(r.echec || '') + '">PAY\u00c9E, cl\u00e9 non partie</span>';
          return '<span class="pill w">en attente de paiement</span>';
        } },
      { k: 'echec', t: 'Dernier refus', tr: true },
      { k: 'id', t: 'Actions', brut: true, a: true, f: function (v, r) {
          var actes = [];
          if (r.etat === 'ouverte' && r.paiement_ref) {
            actes.push({ act: 'verifier', lib: 'Redemander au prestataire', quoi: 'reposer la question, et livrer si c\u2019est pay\u00e9' });
          }
          if (r.etat === 'ouverte' && !r.paiement_le) {
            actes.push({ act: 'abandonner', lib: 'Marquer abandonn\u00e9e', quoi: 'un panier que personne n\u2019a pay\u00e9' });
          }
          return celluleActions(r.id, actes);
        } }
    ],
    evenements: [
      // Le journal portait l'heure UTC à côté d'une date UTC : une vente encaissée à 00 h 30 à Tunis
      // s'y lisait la veille à 23 h 30. Tout ce qui s'affiche passe par la même horloge, la locale.
      { k: 'quand', t: 'Quand', f: function (v) { return horodate(v); } },
      { k: 'quoi', t: 'Quoi', brut: true, f: function (v) { return nomEvt(v); } },
      { k: 'client', t: 'Client', tr: true },
      { k: 'detail', t: 'Détail', tr: true }
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
      // Le libellé décrit l'écran d'ARRIVÉE : cinq « Ouvrir » identiques menant à cinq endroits
      // différents obligent à cliquer pour savoir où l'on va (7.29.0).
      { k: 'onglet', t: 'Où', brut: true, a: true, f: function (v) {
          return celluleActions('', [{ act: 'aller', onglet: v, lib: 'Ouvrir ' + article(v) }]);
        } }
    ],
    parc: [
      { k: 'appNom', t: 'Application' },
      { k: 'version', t: 'Version', m: true, f: function (v, r) {
          return (v || '— version inconnue —') + (r.essai ? ' <span class="pill w">essai</span>' : '');
        }, brut: true },
      { k: 'postes', t: 'Postes', n: true, i: 'Le nombre d\\u2019ordinateurs distincts qui se sont annoncés sur cette version. Un poste qui change de version apparaît sur les deux lignes.' },
      // « Endormi » n'est pas « perdu » : un portable refermé pour les vacances compte à part, il
      // ne se retranche pas.
      { k: 'vus', t: 'Vus (30 j)', n: true, i: 'Les postes qui se sont annoncés dans les trente derniers jours. La fenêtre se règle dans Réglages.' },
      { k: 'endormis', t: 'Endormis', n: true, i: 'Les postes qu\\u2019on n\\u2019a pas vus dans la fenêtre. Endormi n\\u2019est PAS perdu : un portable refermé pour les vacances en fait partie. Ils se comptent à part, ils ne se retranchent pas — « vus » plus « endormis » font « postes ».' },
      { k: 'licences', t: 'Sous licence', n: true, i: 'Les postes qui présentent une clé, par opposition à ceux qui sont encore en essai.' },
      { k: 'enEssai', t: 'En essai', n: true, i: 'Les postes sans clé. Ils deviennent des clients ou ils disparaissent : c\\u2019est l\\u2019écran Essais qui dit lesquels appeler.' },
      { k: 'darwin', t: 'Mac', n: true },
      { k: 'win32', t: 'Windows', n: true },
      { k: 'dernier', t: 'Dernier vu', f: function (v) { return quandVu(v); }, brut: true }
    ],
    // Les essais, nommés un par un : la file d'appels du matin.
    essais: [
      { k: 'appNom', t: 'Application' },
      { k: 'device_nom', t: 'Ordinateur', tr: true },
      { k: 'plateforme', t: 'Système', f: function (v) { return NOM_OS[v] || v || '\\u2014'; } },
      { k: 'version', t: 'Version', m: true },
      { k: 'premiere_fois', t: 'Vu depuis', f: function (v) { return v ? jour(v) : '—'; } },
      { k: 'reste', t: 'Reste', n: true, brut: true,
        i: 'Ce qu\\u2019il reste avant la fin ESTIMÉE de l\\u2019essai. La plateforme sait quand elle a vu ce poste pour la première fois, jamais quand l\\u2019essai a commencé sur la machine : une installation restée trois semaines hors ligne s\\u2019annonce trois semaines trop tard.',
        f: function (v, r) {
          if (v == null) return '—';
          if (v < 0) return '<span class="pill e">fini vers le ' + h(jour(r.fin)) + '</span>';
          // Le SEUIL vient des réglages, jamais d'un chiffre écrit ici. Trente jours restants est
          // la meilleure nouvelle possible de cet écran, et la pastille était orange dès le
          // premier jour : du orange sur une situation normale apprend à ignorer le orange
          // (8.0.1). Trois tons, et le dernier est celui qu'on a réglé.
          var seuil = Number((etat && etat.seuils && etat.seuils.alerte_essai) || 7);
          var ton = v <= Math.ceil(seuil / 2) ? 'r' : (v <= seuil ? 'w' : 'e');
          return '<span class="pill ' + ton + '">' + v + ' j</span>';
        } },
      { k: 'suivi_le', t: 'Suivi', brut: true,
        i: 'Ce que tu as fait de ce prospect. Tant qu\\u2019un rappel est posé dans le futur, ce poste ne redemande rien dans « À décider ».',
        f: function (v, r) {
          if (r.issue === 'gagne') return '<span class="pill a">gagné</span>';
          if (r.issue === 'perdu') return '<span class="pill e">perdu</span>' + (r.motif ? '<span class="quand">' + h(r.motif) + '</span>' : '');
          if (r.rappel) return '<span class="pill w">rappeler le ' + h(jour(r.rappel)) + '</span>' + (v ? '<span class="quand">vu le ' + h(jour(v)) + '</span>' : '');
          if (v) return '<span class="pill e">noté le ' + h(jour(v)) + '</span>';
          return '<span class="quand">jamais contacté</span>';
        } },
      { k: 'id', t: 'Actions', brut: true, a: true, f: function (v, r) {
          return celluleActions(r.id, [{ act: 'suivre', lib: 'Noter un contact…' }]);
        } }
    ],
    cabinets: [
      { k: 'client', t: 'Cabinet', tr: true },
      { k: 'cabinet_empreinte', t: 'Empreinte', m: true },
      { k: 'dossiers_hors', t: 'Dossiers couverts', n: true, i: 'Le quota vendu à ce cabinet, en plus des trois dossiers hors SkanFact gratuits. C\\u2019est ce qu\\u2019on lui facture : jamais ses postes, qui sont illimités.' },
      { k: 'parraines', t: 'Clients parrainés', n: true, i: 'Les entreprises dont la licence porte l\\u2019empreinte de ce cabinet. « Amené » n\\u2019est pas « payé » : la colonne d\\u2019à côté dit combien ont réglé.' },
      { k: 'payants', t: 'dont payants', n: true, brut: true,
        i: 'Parmi les clients parrainés, ceux dont au moins une vente est encaissée. Vendre en passant par les cabinets est le modèle du produit — c\\u2019est ici qu\\u2019on voit s\\u2019il fonctionne.',
        f: function (v, r) {
          var n = Number(v) || 0;
          if (!Number(r.parraines)) return '—';
          return '<span class="pill ' + (n ? 'a' : 'e') + '">' + n + '</span>';
        } },
      { k: 'ca_amene', t: 'CA amené', n: true, f: function (v, r) { return Number(v) ? montant(v, r.devise) : '—'; },
        i: 'Le total encaissé sur les licences d\\u2019entreprise parrainées par ce cabinet, toutes années confondues.' },
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
    evenements: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5',
    essais: 'M12 2v6M9 2h6M7 8h10l3 10a3 3 0 0 1-3 4H7a3 3 0 0 1-3-4z',
    commandes: 'M3 4h2l2.5 11h10L20 7H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    reglages: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.1-2.7L4 7.2a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.6 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8'
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
    // Les ESSAIS, un par un et nommés. Le Parc les agrège par version : utile pour compter, inutile
    // pour décrocher son téléphone. C'est la file d'appels du matin, et elle n'existait pas — la
    // console savait ce qui EXISTE et ne retenait rien de ce qu'on en faisait.
    essais: { g: 'Pilotage', t: 'Essais', h: 'Les essais en cours',
      but: 'Chaque poste qui essaie SkanFact, avec ce qu\\u2019il lui reste et ce que tu en as fait. La date de fin est APPROCHÉE : l\\u2019essai se compte sur la machine du client, la plateforme ne sait que depuis quand elle le voit.' },
    parc: { g: 'Pilotage', t: 'Parc', h: 'Le parc installé',
      but: 'Les deux applications, version par version : combien de postes, combien vus ces trente jours, combien sous licence. '
        + 'Un cabinet se FACTURE au dossier et jamais au poste : ce compte-là se lit sur l\\u2019écran Cabinets.' },
    licences: { g: 'Ventes', t: 'Licences', h: 'Licences émises',
      but: 'Toutes les clés signées depuis cette console. Une licence remplacée reste ici avec son motif : rien ne s\\u2019efface.' },
    ventes: { g: 'Ventes', t: 'Ventes', h: 'Ventes',
      but: 'Une ligne par licence vendue. « Marquer payée » envoie la clé dans la seconde, si le client a une adresse.' },
    // 10.9.0 — les commandes en ligne. L'écran existe pour UNE ligne surtout : un paiement encaissé
    // dont la clé n'est pas partie. Le client a payé, il n'a rien, et sans cet écran personne ne le
    // saurait — le site, lui, ne peut que dire « nous en sommes prévenus ».
    commandes: { g: 'Ventes', t: 'Commandes', h: 'Commandes en ligne',
      but: 'Ce qu\u2019un visiteur du site a demandé, et ce qui en est advenu. Une commande devient une vente le jour où le paiement est PROUV\u00c9 : le webhook du prestataire n\u2019est qu\u2019une notification, c\u2019est la question qu\u2019on lui repose qui fait foi.' },
    cabinets: { g: 'Ventes', t: 'Cabinets', h: 'Cabinets comptables',
      but: 'Ce qu\\u2019on vend à un cabinet est un QUOTA de dossiers hors SkanFact, jamais des postes.' },
    clients: { g: 'Ventes', t: 'Clients', h: 'Clients',
      but: 'Le nom et le matricule entrent dans la clé : un client peut acheter deux fois, renouveler, changer de matricule.' },
    activations: { g: 'Traces', t: 'Activations', h: 'Activations',
      but: 'Un ordinateur, une application, une date. C\\u2019est ce que les postes annoncent d\\u2019eux-mêmes — rien de plus.' },
    evenements: { g: 'Traces', t: 'Journal', h: 'Journal',
      but: 'Chaque émission, révocation, paiement et envoi, pour toujours. C\\u2019est ce qui permet de répondre à un client six mois plus tard.' },
    // Les RÉGLAGES. Un prix qui se change en modifiant le code n'est pas un prix, c'est une
    // constante : il faut un déploiement pour l'ajuster, donc on ne l'ajuste pas.
    reglages: { g: 'Console', t: 'Réglages', h: 'Réglages de la console',
      but: 'Les prix proposés, les seuils qui décident d\\u2019une alerte, la signature des mails. Chaque valeur dit d\\u2019où elle vient : posée ici, venue des réglages du worker, ou restée au défaut.' }
  };
  var GROUPES = ['Pilotage', 'Ventes', 'Traces', 'Console'];
  // Ce que chaque écran COMPTE, au singulier — la fonction de pluriel accorde. Le pied disait « 4 lignes » : une
  // ligne n'est le nom de rien, et c'est précisément le mot qu'on emploie quand on n'a pas
  // regardé l'écran. On pagine ce qu'on NOMME (9.4.5).
  var NOM_LIGNE = {
    alertes: ['décision', 'décisions'], parc: ['version installée', 'versions installées'],
    essais: ['essai en cours', 'essais en cours'], licences: ['licence', 'licences'],
    ventes: ['vente', 'ventes'], cabinets: ['cabinet', 'cabinets'], clients: ['client', 'clients'],
    activations: ['activation', 'activations'], evenements: ['événement', 'événements']
  };
  // Les gestes de CHAQUE écran. « Émettre » vit sur le tableau de bord et sur Licences (c'est de
  // là qu'on vend), « Nouveau client » partout où l'on peut avoir besoin d'en créer un avant
  // d'émettre. Un geste posé sur les huit écrans ne serait plus le geste d'un écran.
  // Chaque écran finit par le GESTE SUIVANT (7.27.0, 9.4.9). Après avoir créé un client on lui
  // vend une licence : « Émettre » vit donc aussi sur Clients — c'est le parcours réel qui l'a
  // montré, en cherchant le bouton là où on vient d'atterrir et en ne le trouvant pas.
  var ACTIONS = {
    alertes: ['emettre', 'client'], licences: ['emettre', 'client'],
    clients: ['emettre', 'client'], cabinets: ['emettre'],
    ventes: [], parc: [], activations: [], evenements: [],
    // Un essai qui devient client passe par « Nouveau client… » : c'est le geste SUIVANT de cet
    // écran, et il n'y en a pas d'autre (7.27.0).
    essais: ['client'], reglages: []
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
    cabinets: 'Aucune licence de cabinet vendue. « Émettre une licence… » ci-dessus, avec le type « Cabinet comptable » : ce qu\\u2019on y vend est un quota de dossiers, jamais des postes.',
    essais: 'Aucun essai en cours. Un poste s\\u2019annonce tout seul au premier lancement : ceux qui apparaîtront ici sont les gens à appeler avant la fin de leur mois.',
    commandes: 'Aucune commande en ligne. Le site en cr\u00e9e une d\u00e8s qu\u2019un visiteur choisit son offre — et tant que le portefeuille du prestataire n\u2019est pas r\u00e9gl\u00e9 (R\u00e9glages \u2192 Paiement en ligne), l\u2019achat en ligne est ferm\u00e9 et le site le dit.',
    reglages: ''
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
      // Un message de succès ne SUIT pas d'écran en écran. « Base exportée — activations : 4 »
      // restait affiché pendant que le Parc, juste en dessous, en montrait cinq : un compte figé à
      // côté d'un compte vivant, sur le même écran. Un état lu une fois se périme (7.1.x).
      b.onclick = function () { onglet = b.dataset.t; recherche = ''; fiche = null; $('info').hidden = true; dessiner(); };
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
      // L'invite est COURTE et constante : « Chercher dans activations… » était coupé en plein
      // mot sur trois écrans, parce que le champ est borné à 280 px. Le nom de l'écran est déjà
      // dans le titre, à trente centimètres à gauche. L'étiquette pour lecteur d'écran, elle,
      // reste complète — c'est elle qui doit dire de quoi il s'agit.
      act += '<input id="q" type="search" placeholder="Chercher\\u2026"'
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

  }

  function dessiner() {
    $('err').hidden = true;
    $('fiche').hidden = true;
    $('fiche').innerHTML = '';
    dessinerRail();
    dessinerTete();

    api('etat').then(function (e) { etat = e; dessinerEtat(); }, montrerErreur);
    api('clients').then(function (d) { clients = d.lignes || []; }, function () {});

    // Une FICHE remplace la liste : ce n'est pas un onglet, c'est un objet qu'on ouvre. Le rail
    // garde l'onglet d'où l'on vient allumé, et « ← Clients » ramène — arriver sur le bon contenu
    // avec le mauvais onglet en surbrillance est pire que ne pas y aller (7.21.0).
    if (fiche) { dessinerFiche(); return; }
    // Les réglages ne sont pas une liste : ils n'ont ni tri, ni pagination, ni recherche.
    if (onglet === 'reglages') { dessinerReglages(); return; }

    dessinerSante();

    api('stats').then(function (s) {
      // La CONVERSION ferme la rangée : combien d'ordinateurs ont essayé, combien ont acheté.
      // C'est le chiffre d'un produit qu'on vend, et il n'existait nulle part. Un taux sans
      // dénominateur vaut « — » et jamais « 0 % » : sur zéro essai il n'y a pas encore de question,
      // et annoncer un échec là où rien n'a été tenté apprend à ignorer le chiffre (9.6.0).
      var conv = s.tauxConversion == null
        ? '<div class="card zero"><b>—</b><span>aucun essai vu pour l\\u2019instant</span></div>'
        // Un taux ne se colore pas par NATURE : il se colore par rapport à un objectif, et il n'y
        // en a pas. En vert, « 0 % » se lisait comme une bonne nouvelle.
        : '<div class="card" role="button" tabindex="0" data-t="parc" style="cursor:pointer"><b>'
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
    // La RÉPONSE d'un écran qu'on a quitté ne le repeint pas. Deux dessins peuvent se chevaucher —
    // « Actualiser » puis un clic sur un onglet, ou simplement deux clics rapides — et c'est la
    // réponse la plus LENTE qui gagnait : le tableau du Parc se faisait remplacer par les alertes,
    // sous le titre du Parc. Le défaut n'apparaît que lorsqu'un écran devient plus lent qu'un
    // autre, donc il serait arrivé un jour, en production, sans qu'on sache pourquoi.
    // C'est le message d'avancement en retard de la 6.8.1, côté lecture.
    var mien = ++generation;
    api(onglet).then(function (d) {
      if (mien !== generation) return;
      lignesEcran = d.lignes || [];
      // Le compteur du rail compte ce que le tableau MONTRE. Il comptait les OCCURRENCES
      // (« 5 ») pendant que le pied annonçait les lignes groupées (« 3 décisions ») : les deux
      // étaient justes et rien ne l'expliquait, donc on cessait de croire les deux. Un compteur et
      // la liste qu'il annonce se calculent avec la même règle (6.8.1) — et chaque ligne porte
      // déjà son propre « ×2 ».
      if (onglet === 'alertes') { aDecider = lignesEcran.length; dessinerRail(); }
      dessinerTable();
    }, function (e) { if (mien === generation) montrerErreur(e); });
  }

  // --- les RÉGLAGES ---
  // Un prix qui se change en modifiant le code n'est pas un prix, c'est une constante : il faut un
  // déploiement pour l'ajuster, donc on ne l'ajuste jamais. Chaque valeur dit d'OÙ elle vient —
  // sans ça, un écran de nombres laisse croire qu'ils ont tous été décidés, alors que la plupart
  // sont des défauts que personne n'a regardés.
  function dessinerReglages() {
    $('table').innerHTML = '';
    $('bord').hidden = true;
    var el = $('fiche');
    el.hidden = false;
    el.innerHTML = '<div class="chargement">Chargement…</div>';
    api('reglages').then(function (d) {
      reg = d;
      // L'ORIGINE d'une valeur : un repère, pas un avertissement.
      //
      // « valeur par défaut, jamais décidée » s'imprimait sous CHACUN des quinze champs, en
      // orange. Or sur une console neuve, aucun réglage n'a été décidé : c'est l'état NORMAL, pas
      // une alerte. Quinze lignes orange sur le premier écran apprennent à ignorer le orange, et
      // emmènent avec elles celui qui comptera un jour (8.0.1) ; et une explication se lit une
      // fois, pas quinze (9.4.6). La phrase complète vit dans la bulle « i » déjà présente à côté
      // de chaque libellé ; l'écran ne garde qu'un mot, et rien du tout pour un défaut.
      var SOURCES = { base: 'réglé ici', worker: 'réglage du worker', defaut: '' };
      var SRC_AIDE = {
        base: 'Cette valeur a été posée depuis cet écran : elle prime sur tout le reste.',
        worker: 'Cette valeur vient des réglages du worker sur Cloudflare. La poser ici la remplace, sans toucher à Cloudflare.',
        defaut: 'Valeur jamais décidée : c\\u2019est le défaut du code, que personne n\\u2019a encore regardé. La poser ici la fige.'
      };
      var groupes = [];
      (d.definitions || []).forEach(function (def) { if (groupes.indexOf(def.groupe) < 0) groupes.push(def.groupe); });
      var html = '';
      // LE SOMMAIRE. La page fait près de trois écrans : sans lui, on ne sait pas ce qu'elle
      // contient avant de l'avoir parcourue en entier. Il se DÉDUIT des groupes, jamais d'une
      // liste écrite à la main qui nommerait un jour une section disparue (7.30.0).
      var sections = groupes.concat(['Ce qui ne se règle pas ici', 'La copie de la base', 'Le secret d\\u2019administration']);
      html += '<nav class="sommaire" aria-label="Les sections des réglages">'
        + sections.map(function (t, i) { return '<button type="button" class="btn s" data-vers="sec-' + i + '">' + h(t) + '</button>'; }).join('')
        + '</nav>';
      var iSec = 0;
      var section = function (titre, corps, ouvert) {
        // Repliée, une section ne se devine pas : le titre porte un chevron, un curseur et son
        // état (9.4.4). La première est ouverte — on arrive ici pour les prix.
        var id = 'sec-' + (iSec++);
        return '<div class="bloc" id="' + id + '">'
          + '<button type="button" class="collapse-h" aria-expanded="' + (ouvert ? 'true' : 'false') + '" data-plier="' + id + '">'
          + '<span class="chev" aria-hidden="true">\\u25be</span><h2>' + h(titre) + '</h2></button>'
          + '<div class="corps"' + (ouvert ? '' : ' hidden') + '>' + corps + '</div></div>';
      };
      groupes.forEach(function (g, gi) {
        var corps = '<div class="panel">';
        (d.definitions || []).filter(function (def) { return def.groupe === g; }).forEach(function (def) {
          var v = d.valeurs[def.id];
          var src = d.sources[def.id];
          var type = def.type === 'montant' || def.type === 'pourcent' || def.type === 'jours' ? 'number' : 'text';
          var pas = def.type === 'montant' ? ' step="0.001" min="0"' : (def.type === 'jours' ? ' step="1" min="0"' : (def.type === 'pourcent' ? ' step="0.5" min="0" max="100"' : ''));
          // La LARGEUR d'un champ dit ce qu'on attend dedans. Les quinze partageaient la même
          // case de 150 px : la signature des mails s'y affichait tronquée, et un lien de
          // paiement y aurait eu le même bocal qu'un nombre à trois chiffres. Trois gabarits, et
          // c'est le TYPE de la valeur qui les choisit.
          var taille = type === 'number' ? 'court' : (def.type === 'long' || /lien|signature/.test(def.id) ? 'long' : 'moyen');
          html += '';
          corps += '<div class="reg ' + taille + '"><div class="quoi"><b>' + h(def.label) + bulle(def.aide + ' — ' + SRC_AIDE[src]) + '</b><span>' + h(def.aide) + '</span></div>'
            + '<input data-reg="' + h(def.id) + '" type="' + type + '"' + pas + ' value="' + h(v == null ? '' : v) + '"'
            + ' aria-label="' + h(def.label) + '">'
            + (SOURCES[src] ? '<span class="src ' + h(src) + '">' + h(SOURCES[src]) + '</span>' : '<span class="src ' + h(src) + '"></span>') + '</div>';
        });
        corps += '</div>';
        html += section(g, corps, gi === 0);
      });
      // Ce que la console NE règle pas, et pourquoi. Le taire donnerait l'impression d'un oubli.
      html += section('Ce qui ne se règle pas ici', '<div class="panel">' +
        (d.fixes || []).map(function (f) {
          return '<div class="reg"><div class="quoi"><b>' + h(f.label) + ' : ' + h(f.valeur) + '</b><span>' + h(f.pourquoi) + '</span></div></div>';
        }).join('') + '</div>', false);

      // La copie de la base et la rotation du secret : deux choses que cet écran COMMANDE, et qui
      // disent chacune ce qui leur manque plutôt que d'afficher un vert rassurant.
      var s = d.sauvegarde || {}, sec = d.secret || {};
      html += section('La copie de la base', '<div class="panel">' +
        '<p class="why">' + (s.auto ? '' : '<strong>') + h(s.raison || s.quoi) + (s.auto ? '' : '</strong>') + '</p>' +
        (s.auto ? '' : '<p class="why">' + h(s.quoi) + '</p>') +
        '<p class="note">' + (s.dernier ? 'Dernière copie le ' + h(jour(s.dernier)) + '.' : 'Aucune copie n\\u2019a jamais été prise.') + '</p>' +
        '<div class="row"><button id="reg-exporter" class="btn" type="button">Exporter la base maintenant…</button>' +
        '<button id="reg-pli" class="btn" type="button">Préparer le pli scellé…</button></div>' +
        '</div>', !s.auto);
      html += section('Le secret d\\u2019administration', '<div class="panel">' +
        '<p class="why">' + h(sec.phrase || '') + '</p><p class="why">' + h(sec.quoi || '') + '</p></div>', false);

      html += '<p id="reg-msg" class="note" hidden></p>';
      el.innerHTML = html;
      // La barre d'enregistrement FLOTTE : sur une page de trois écrans, le bouton posé tout en
      // bas oblige à redescendre le chercher après chaque changement, et à remonter ensuite. Les
      // Paramètres de l'app entreprise l'ont depuis la 1.8.0 ; la console avait le bouton en pied.
      var barre = document.createElement('div');
      barre.className = 'barre-enr';
      barre.innerHTML = '<span class="sp"></span><button id="reg-ok" class="btn p" type="button">Enregistrer les réglages</button>'
        + '<button id="reg-annuler" class="btn" type="button">Annuler</button>';
      el.appendChild(barre);
      $('reg-ok').onclick = enregistrerReglages;
      $('reg-annuler').onclick = function () { dessinerReglages(); };
      $('reg-exporter').onclick = function () { exporterBase($('reg-exporter')); };
      $('reg-pli').onclick = montrerPli;
      // Replier / déplier, et le sommaire qui OUVRE la section avant d'y descendre : arriver sur
      // un titre replié, c'est arriver nulle part (7.32.0).
      Array.prototype.forEach.call(el.querySelectorAll('[data-plier]'), function (b) {
        b.onclick = function () {
          var bloc = document.getElementById(b.dataset.plier), corps = bloc.querySelector('.corps');
          corps.hidden = !corps.hidden;
          b.setAttribute('aria-expanded', corps.hidden ? 'false' : 'true');
        };
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-vers]'), function (b) {
        b.onclick = function () {
          var bloc = document.getElementById(b.dataset.vers);
          if (!bloc) return;
          var corps = bloc.querySelector('.corps'), tete = bloc.querySelector('[data-plier]');
          if (corps && corps.hidden) { corps.hidden = false; tete.setAttribute('aria-expanded', 'true'); }
          bloc.scrollIntoView({ block: 'start', behavior: 'smooth' });
        };
      });
    }, montrerErreur);
  }

  function enregistrerReglages() {
    var b = $('reg-ok'); b.disabled = true;
    var valeurs = {};
    Array.prototype.forEach.call($('fiche').querySelectorAll('[data-reg]'), function (i) { valeurs[i.dataset.reg] = i.value; });
    api('reglages', { valeurs: valeurs }).then(function (j) {
      b.disabled = false;
      montrerInfo(j.poses.length ? pl(j.poses.length, 'réglage') + ' enregistré' + (j.poses.length > 1 ? 's' : '') + '.' : 'Rien n\\u2019a changé.');
      // Le formulaire se redessine : les prix proposés à l'émission viennent de là, et une valeur
      // rendue au défaut doit RÉAPPARAÎTRE dans son champ, sinon on croit l'avoir effacée.
      api('etat').then(function (e) { etat = e; }, function () {});
      dessinerReglages();
    }, function (e) {
      b.disabled = false;
      // Un refus NOMME le champ : « valeur invalide » oblige à relire quinze champs pour trouver
      // lequel (7.0.0 — un refus dit ce qui est refusé, pourquoi, et ce qui débloque).
      var m = $('reg-msg');
      if (m) { m.textContent = e && e.message ? e.message : 'Échec.'; m.hidden = false; m.scrollIntoView({ block: 'nearest' }); }
    });
  }

  function montrerPli() {
    api('pli').then(function (j) {
      var el = $('resultat');
      el.innerHTML = '<h2>Le pli scellé</h2>'
        + '<p class="why">Aucune clé privée ne sort d\\u2019ici : ce texte est une <strong>procédure</strong>. C\\u2019est à toi de rassembler le pli, et de le garder ailleurs que sur cet ordinateur.</p>'
        + '<div class="cle" style="white-space:pre-wrap">' + h(j.texte) + '</div>'
        + '<div class="row"><button id="pli-copier" class="btn" type="button">Copier</button>'
        + '<button id="pli-fermer" class="btn" type="button">Fermer</button></div>';
      el.hidden = false;
      $('pli-copier').onclick = function () { copier(j.texte, $('pli-copier')); };
      $('pli-fermer').onclick = function () { el.hidden = true; el.innerHTML = ''; };
      el.scrollIntoView({ block: 'nearest' });
    }, montrerErreur);
  }

  // L'alignement d'un en-tête SUIT ses cellules ; il ne se recopie pas colonne par colonne.
  // C'est très exactement la faute de la 7.23.0 : 139 en-têtes sur 338 étaient alignés autrement
  // que leurs valeurs, parce que chacun portait sa classe à la main et qu'un oubli ne se voit pas
  // à la relecture du HTML. Ici, on la DÉDUIT de la première ligne du corps : une colonne qui
  // devient un nombre demain s'aligne toute seule, et l'instrument de rendu — qui mesure les deux
  // — ne peut plus les voir diverger. Le grand tableau de la console, lui, déclare déjà ses
  // colonnes numériques dans leur définition : il n'en a pas besoin.
  function alignerEntetes(racine) {
    Array.prototype.forEach.call(racine.querySelectorAll('table'), function (t) {
      var prem = t.querySelector('tbody tr');
      if (!prem) return;
      var tetes = t.querySelectorAll('thead th');
      Array.prototype.forEach.call(prem.cells, function (cel, i) {
        if (tetes[i] && cel.classList.contains('num')) tetes[i].classList.add('num');
      });
    });
  }

  // --- la FICHE d'un client ---
  // Répondre à « raconte-moi tout sur ce client » demandait cinq écrans : Clients, Licences,
  // Ventes, Activations, Journal. C'est ce qu'on ouvre à CHAQUE appel, donc l'écran qui devait
  // exister en premier. Tout est ici, et rien n'y est saisi : on agit depuis les listes, qui
  // portent déjà les gestes et leurs garde-fous (7.29.0).
  function ouvrirFiche(id) {
    fiche = { type: 'client', id: id };
    dessiner();
  }
  function fermerFiche() { fiche = null; dessiner(); }

  function dessinerFiche() {
    $('table').innerHTML = '';
    $('bord').hidden = true;
    var el = $('fiche');
    el.hidden = false;
    el.innerHTML = '<div class="chargement">Chargement…</div>';
    api('clients/' + encodeURIComponent(fiche.id)).then(function (d) {
      var c = d.client || {};
      $('page-titre').textContent = c.nom || 'Client';
      $('page-but').textContent = 'Tout ce que la plateforme sait de ce client : ses licences, ses postes, ses paiements, ce que tu lui as dit.';
      var paire = function (lib, val) { return val ? '<div><b>' + h(lib) + '</b>' + h(val) + '</div>' : ''; };
      var bloc = function (titre, corps) { return '<div class="bloc"><h2>' + h(titre) + '</h2>' + corps + '</div>'; };
      // Le troisième argument dit ce qui manque. « — » ne dit rien — ni si la liste est vide, ni
      // si la plateforme n'a pas su la lire (9.4.7 : un état vide S'ANNONCE).
      var table = function (entetes, lignes2, rien) {
        if (!lignes2.length) return '<div class="wrap"><div class="vide mini">' + h(rien || '—') + '</div></div>';
        return '<div class="wrap"><table><thead><tr>' + entetes.map(function (t) { return '<th>' + h(t) + '</th>'; }).join('')
          + '</tr></thead><tbody>' + lignes2.join('') + '</tbody></table></div>';
      };
      var html = '<div class="fiche-tete">' +
        '<button type="button" class="btn" id="fiche-retour">\\u2190 Clients</button><span class="sp"></span>' +
        '<button type="button" class="btn" id="fiche-suivi">Noter un contact\\u2026</button>' +
        '<button type="button" class="btn" id="fiche-devis">Écrire un devis\\u2026</button>' +
        '</div>' +
        '<div class="paires">' + paire('Matricule', c.matricule) + paire('Courriel', c.email) +
          paire('Téléphone', c.tel) + paire('Adresse', c.adresse) + paire('Client depuis', jour(c.cree_le)) + '</div>' +
        (c.notes ? '<p class="but">' + h(c.notes) + '</p>' : '');

      html += bloc('Licences', table(['Offre', 'Fin', 'État', 'Signée par'], (d.licences || []).map(function (l) {
        return '<tr><td>' + h(libOffre(l)) + '</td><td>' + h(l.fin ? jour(l.fin) : 'à vie') + '</td><td>' + etatLic(l)
          + '</td><td class="mono">' + h(l.kid || '') + '</td></tr>';
      }), 'Aucune licence : ce client n\\u2019a encore rien acheté.'));
      html += bloc('Ventes', table(['Montant HT', 'État', 'Moyen', 'Facture'], (d.ventes || []).map(function (v) {
        return '<tr><td class="num">' + h(montant(v.montant_ht, v.devise)) + '</td><td>'
          + (v.payee_le ? '<span class="pill a">payée le ' + h(jour(v.payee_le)) + '</span>' : '<span class="pill w">à encaisser</span>')
          + '</td><td>' + h(v.moyen || '—') + '</td><td>' + h(v.facture_skanfact || 'à établir') + '</td></tr>';
      }), 'Aucune vente enregistrée.'));
      html += bloc('Ses postes', table(['Application', 'Ordinateur', 'Système', 'Version', 'Dernier signe'], (d.postes || []).map(function (p) {
        return '<tr><td>' + h(p.appNom || '') + '</td><td>' + h(p.device_nom || p.device_id) + '</td><td>' + h(p.plateforme || '—')
          + '</td><td class="mono">' + h(p.version || '—') + '</td><td>' + quandVu(p.derniere_fois) + '</td></tr>';
      }), 'Aucun poste ne s\\u2019est encore annoncé : soit l\\u2019application n\\u2019est pas installée, soit sa clé n\\u2019y est pas collée.'));
      // Ce qu'on lui a DIT : l'historique entier, pas seulement le dernier. « Je l'ai déjà appelé
      // deux fois » est précisément ce qu'on vient chercher avant de décrocher une troisième.
      html += bloc('Ce que tu lui as dit', (d.suivis || []).length
        ? '<ul class="fil">' + d.suivis.map(function (s) {
            return '<li>' + h((s.moyen ? s.moyen + ' — ' : '') + (s.note || (s.issue === 'gagne' ? 'gagné' : (s.issue === 'perdu' ? 'perdu : ' + (s.motif || '') : '—'))))
              + '<span class="q">' + h(horodate(s.quand) + (s.rappel ? ' \\u00b7 rappel le ' + jour(s.rappel) : '') + (s.source ? ' \\u00b7 venu par : ' + s.source : '')) + '</span></li>';
          }).join('') + '</ul>'
        : '<div class="wrap"><div class="vide mini">Aucun contact noté. « Noter un contact… » ci-dessus garde ce que tu lui as dit — et fait taire ses alertes jusqu\\u2019à la date où tu veux le rappeler.</div></div>');
      html += bloc('Journal', table(['Quand', 'Quoi', 'Détail'], (d.journal || []).map(function (e) {
        return '<tr><td>' + h(horodate(e.quand)) + '</td><td>' + nomEvt(e.quoi) + '</td><td class="libre">' + h(e.detail || '') + '</td></tr>';
      }), 'Rien dans le journal pour ce client.'));
      el.innerHTML = html;
      alignerEntetes(el);
      $('fiche-retour').onclick = fermerFiche;
      $('fiche-suivi').onclick = function () { formSuivi('client:' + c.id, c.nom, null); };
      $('fiche-devis').onclick = function () { ecrireDevis(c); };
    }, montrerErreur);
  }

  // --- noter un contact ---
  // Ce que la console ne retenait PAS : un essai se terminait, l'alerte se levait, on appelait — et
  // le lendemain la même alerte se relevait à l'identique. Une alerte qui ne se referme pas cesse
  // d'être lue au cinquième prospect, et emmène avec elle celles qui comptaient.
  function formSuivi(sujet, nom, app) {
    var estEssai = String(sujet).indexOf('essai:') === 0;
    formulaire('Noter un contact — ' + nom,
      'Ce que tu as fait, et quand tu veux y revenir. Tant qu\\u2019un rappel est posé dans le futur, ' + h(nom) + ' ne redemande rien dans « À décider ». Rien ne s\\u2019écrase : chaque contact est une ligne de plus, et la fiche les garde tous.',
      '<label class="f"><span>Comment</span><select name="moyen">' +
        ['appel', 'mail', 'message', 'visite', 'autre'].map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('') +
        '</select></label>' +
      champDate('rappel', 'Le rappeler le', '') +
      '<label class="f w"><span>Ce qui s\\u2019est dit</span><textarea name="note" rows="2" maxlength="500"></textarea></label>' +
      '<label class="f"><span>Issue</span><select name="issue">' +
        '<option value="">— en cours —</option><option value="gagne">Gagné</option><option value="perdu">Perdu</option>' +
        '</select></label>' +
      champ('motif', 'Si perdu, pourquoi *', 'maxlength="200" placeholder="trop cher, a choisi un concurrent, a fermé…"') +
      champ('source', 'Comment il nous a connus', 'maxlength="120" placeholder="bouche-à-oreille, cabinet X, recherche Google…"', true),
      'Enregistrer le contact', function () {
        var chemin = estEssai
          ? 'essais/' + encodeURIComponent(String(sujet).split(':')[1]) + '/suivi'
          : 'clients/' + encodeURIComponent(String(sujet).slice('client:'.length)) + '/suivi';
        return api(chemin, { app: estEssai ? (app || String(sujet).split(':')[2]) : undefined,
          moyen: val('moyen'), note: val('note'), rappel: val('rappel'), issue: val('issue'), motif: val('motif'), source: val('source') })
          .then(function () { fermerForm(); montrerInfo('Contact noté pour ' + nom + '.'); dessiner(); });
      });
  }

  // Le devis : la console composait des relances à des clients déjà facturés, et rien pour
  // quelqu'un qui n'a encore rien acheté. Le prix vient des réglages, jamais du code.
  function ecrireDevis(c) {
    var offres = Object.keys(etat.offres).map(function (k) { return '<option value="' + k + '">' + h(etat.offres[k].label) + '</option>'; }).join('');
    formulaire('Écrire un devis — ' + c.nom,
      'La console compose le texte ; c\\u2019est toi qui l\\u2019envoies, depuis ta messagerie. Le prix est celui de tes Réglages — corrige-le dans le message si tu proposes autre chose.',
      '<label class="f w"><span>Offre proposée</span><select name="offre">' + offres + '</select></label>',
      'Composer le devis', function () {
        return api('clients/' + encodeURIComponent(c.id) + '/devis?offre=' + encodeURIComponent(val('offre')))
          .then(function (j) { fermerForm(); montrerMail(j, 'Devis pour ' + (j.client || c.nom)); });
      });
  }

  // --- la bulle « i » ---
  // Les deux applications en ont partout depuis la 1.8.0 ; la console n'en avait AUCUNE, alors que
  // la moitié de ses en-têtes sont des définitions (« Endormis », « Sous licence », « Vus (30 j) »).
  // Un titre de colonne qui ne se comprend pas se devine, et une devinette se trompe.
  //
  // Le texte voyage dans l'attribut, jamais dans une table à part : une seconde table divergerait
  // de la colonne au premier renommage (6.8.0), et une bulle sans endroit où s'afficher est une
  // entrée morte (9.4.9).
  function bulle(texte) {
    return '<button type="button" class="i" data-bulle="' + h(texte) + '" aria-label="Qu\\u2019est-ce que c\\u2019est ?">i</button>';
  }
  var bulleOuverte = null;
  function fermerBulle() { $('info-pop').hidden = true; bulleOuverte = null; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button.i') : null;
    if (!b) { if (bulleOuverte) fermerBulle(); return; }
    e.preventDefault(); e.stopPropagation();
    if (bulleOuverte === b) { fermerBulle(); return; }
    var pop = $('info-pop');
    pop.textContent = b.dataset.bulle || '';
    pop.hidden = false;
    var r = b.getBoundingClientRect();
    // On place APRÈS avoir affiché : la hauteur d'une bulle dépend de son texte, et la mesurer
    // avant de la rendre donne zéro — la bulle sortait alors par le bas de la fenêtre.
    var w = pop.offsetWidth, hh = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    pop.style.top = (r.bottom + hh + 10 > window.innerHeight ? Math.max(8, r.top - hh - 8) : r.bottom + 8) + 'px';
    bulleOuverte = b;
  });

  // --- le pied de pagination ---
  // Il porte TROIS choses : où l'on en est, combien il y a en tout, et — quand la borne du serveur
  // est atteinte — le fait qu'on ne voit pas tout. Sans la troisième, cinq cents lignes affichées
  // se lisent comme « il y en a cinq cents » (9.4.5).
  function pagerBar(total, page, pageMax) {
    var de = (page - 1) * PAR_PAGE + 1, a = Math.min(total, page * PAR_PAGE);
    var nom = NOM_LIGNE[onglet] || ['ligne', 'lignes'];
    return '<div class="pager">' +
      '<span>' + (total > PAR_PAGE ? de + '\\u2013' + a + ' sur ' + pl(total, nom[0], nom[1]) : pl(total, nom[0], nom[1])) + '</span>' +
      (total >= 500 ? '<span class="coupe">\\u00b7 la console s\\u2019arrête à 500 lignes : affine la recherche pour voir le reste.</span>' : '') +
      '<span class="sp"></span>' +
      (pageMax > 1 ? '<button type="button" class="btn" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>Précédent</button>' +
        '<span>page ' + page + ' sur ' + pageMax + '</span>' +
        '<button type="button" class="btn" data-page="' + (page + 1) + '"' + (page >= pageMax ? ' disabled' : '') + '>Suivant</button>' : '') +
      '</div>';
  }
  function brancherPager() {
    Array.prototype.forEach.call($('table').querySelectorAll('.pager [data-page]'), function (b) {
      b.onclick = function () { pages[onglet] = Number(b.dataset.page); dessinerTable(); };
    });
  }
  function brancherTri() {
    Array.prototype.forEach.call($('table').querySelectorAll('th[data-tri]'), function (th) {
      var aller = function () {
        var k = th.dataset.tri, t = tris[onglet];
        // Un second clic RENVERSE, il ne repart pas de zéro : c'est ce qu'on attend d'un en-tête,
        // et c'est ce que font les deux applications.
        tris[onglet] = (t && t.k === k) ? { k: k, sens: -t.sens } : { k: k, sens: 1 };
        pages[onglet] = 1;
        dessinerTable();
      };
      th.onclick = aller;
      th.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aller(); } };
    });
  }

  // Le tableau seul, pour que la frappe dans la recherche ne redessine ni le rail, ni l'en-tête,
  // ni les chiffres : un champ qui se recrée à chaque caractère est un champ dans lequel on ne
  // peut pas écrire (7.17.0), et c'est exactement ce qui arriverait en rappelant dessiner().
  function dessinerTable() {
    // La table des menus se vide à chaque dessin : gardée, elle retiendrait les lignes d'un écran
    // qu'on a quitté, et un identifiant réutilisé ouvrirait le menu d'une autre ligne.
    MENUS = {};
    fermerMenuLigne();
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
      // LE TRI. Les deux applications trient leurs listes depuis la 1.9.0 ; la console arrivait
      // dans l'ordre de la requête et rien d'autre. On compare ce que la ligne PORTE, jamais ce que
      // la colonne en affiche — un montant formaté se trierait comme du texte, et « 1 000 » se
      // rangerait avant « 9 ».
      var tri = tris[onglet];
      if (tri) {
        var col = cols.filter(function (c) { return c.k === tri.k; })[0];
        lignes = lignes.slice().sort(function (a, b) {
          var x = a[tri.k], y = b[tri.k];
          // Ce qui manque va TOUJOURS au bout, dans les deux sens : une colonne vide n'est pas une
          // petite valeur, et la voir remonter en tête au premier clic ferait croire à un tri faux.
          var vx = x == null || x === '', vy = y == null || y === '';
          if (vx && vy) return 0;
          if (vx) return 1;
          if (vy) return -1;
          var d = col && col.n ? (Number(x) || 0) - (Number(y) || 0) : String(x).localeCompare(String(y), 'fr', { numeric: true });
          return d * tri.sens;
        });
      }
      // LA PAGINATION. Le « LIMIT 500 » du serveur tronquait en SILENCE, et le Journal — qui grossit sans fin —
      // l'atteindra bien avant les clients. Une troncature muette se lit comme « tout est là ».
      var total = lignes.length;
      var pageMax = Math.max(1, Math.ceil(total / PAR_PAGE));
      // On borne AVANT de découper : un filtre qui vient de réduire la sélection laisserait sinon
      // la page courante hors des bornes, donc un tableau vide sans raison (9.4.5).
      if (!pages[onglet] || pages[onglet] > pageMax) pages[onglet] = Math.min(pages[onglet] || 1, pageMax);
      var page = pages[onglet];
      var visibles = total > PAR_PAGE ? lignes.slice((page - 1) * PAR_PAGE, page * PAR_PAGE) : lignes;

      // LES COLONNES VIDES. Une colonne dont aucune ligne ne porte rien coûte de la largeur à
      // toutes les autres — et ici elle la coûtait exactement à celles qui débordaient : sur
      // Cabinets, quatre colonnes sur sept ne montraient qu'un tiret pendant que la huitième était
      // hors champ. On les masque, et on le DIT : masquer sans le dire serait un piège (7.12.0),
      // et « Tout afficher » les rend.
      var rendu = function (c, r) {
        var v = r[c.k];
        return c.f ? c.f(v, r) : (v == null || v === '' ? '\\u2014' : v);
      };
      var vide = function (x) {
        var t = String(x == null ? '' : x).replace(/<[^>]*>/g, '').trim();
        return t === '' || t === '\\u2014' || t === '-';
      };
      var masquees = 0;
      if (!colTout) {
        cols = cols.filter(function (c, i) {
          // La PREMIÈRE colonne et celle des actions ne se masquent jamais : l'une identifie la
          // ligne, l'autre la fait agir.
          if (i === 0 || c.a) return true;
          var toutesVides = visibles.every(function (r) { return vide(rendu(c, r)); });
          if (toutesVides) masquees++;
          return !toutesVides;
        });
      }

      var html = '<div class="wrap"><table><thead><tr>' +
        cols.map(function (c) {
          var cl = (c.n ? 'num' : '') + (c.a ? ' acts' : '') + (c.a ? '' : ' tri');
          var actif = tri && tri.k === c.k;
          return '<th' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + (c.a ? '' : ' data-tri="' + h(c.k) + '" tabindex="0" role="button"')
            + (actif ? ' aria-sort="' + (tri.sens > 0 ? 'ascending' : 'descending') + '"' : '') + '>' + c.t
            + (c.a ? '' : '<span class="fl" aria-hidden="true">' + (actif ? (tri.sens > 0 ? '\\u2191' : '\\u2193') : '\\u21c5') + '</span>')
            + (c.i ? bulle(c.i) : '') + '</th>';
        }).join('') +
        '</tr></thead><tbody>' +
        visibles.map(function (r) {
          return '<tr>' + cols.map(function (c) {
            var texte = rendu(c, r);
            var cl = (c.n ? 'num ' : '') + (c.m ? 'mono ' : '') + (c.l ? 'libre ' : '') + (c.tr ? 'tronq ' : '') + (c.a ? 'acts' : '');
            // Une colonne tronquée garde son texte ENTIER au survol : ce qu'on cache à l'œil
            // doit rester lisible, sinon on a remplacé un débordement par une perte.
            var titre = c.tr && !c.brut && texte ? ' title="' + h(texte) + '"' : '';
            // Le « max-width » d'une cellule n'est qu'INDICATIF : dans une table en disposition
            // automatique, le navigateur l'élargit quand même — mesuré, 318 px pour un plafond
            // annoncé à 270. C'est un bloc INTERNE qui tient la largeur, et lui seul.
            var contenu = (c.brut ? texte : h(texte));
            return '<td' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + titre + '>'
              + (c.tr ? '<span class="cut">' + contenu + '</span>' : contenu) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody>' +
        // Le pied est TOUJOURS là, même sur quatre lignes : c'est lui qui dit « tu vois tout ».
        // Ne l'afficher qu'au-delà d'une page laisserait le cas le plus dangereux — cinq cents
        // lignes rendues par le serveur, tronquées en silence — se lire comme une liste complète.
        '<tfoot><tr><td colspan="' + cols.length + '" style="padding:0">' + pagerBar(total, page, pageMax)
        // Ce qui est masqué se COMPTE et se rend : masquer sans le dire est un piège (7.12.0).
        + (masquees || colTout
          ? '<div class="colmsg">' + (masquees
              ? pl(masquees, 'colonne vide est masquée', 'colonnes vides sont masquées') + ', pour laisser la place aux autres. '
              : 'Toutes les colonnes sont affichées, y compris les vides. ')
            + '<button type="button" class="btn s" id="col-tout">' + (colTout ? 'Masquer les vides' : 'Tout afficher') + '</button></div>'
          : '')
        + '</td></tr></tfoot>' +
        '</table></div>';
      $('table').innerHTML = html;
      brancherTri();
      brancherPager();
      if ($('col-tout')) $('col-tout').onclick = function () { colTout = !colTout; dessinerTable(); };
      // Les boutons de ligne : un seul gestionnaire, qui retrouve la LIGNE au moment du clic (le
      // tableau a pu être redessiné entre-temps — piège 7.17.0). Il sert le bouton visible ET les
      // entrées du menu, qui vivent sur le body : une seconde table d'actions les ferait diverger,
      // et deux gestionnaires sur la même racine se mangent (9.4.8).
      var agir = function (e) {
        var mb = e.target.closest('button[data-menu]');
        if (mb) { ouvrirMenuLigne(mb, MENUS[mb.dataset.menu] || []); return; }
        var b = e.target.closest('button[data-act]'); if (!b) return;
        fermerMenuLigne();
        // « À décider » nomme un ensemble : il doit pouvoir l'OUVRIR (7.15.0). Cette action-là ne
        // désigne pas une ligne de la table, elle désigne un onglet — elle passe donc avant la
        // recherche de la ligne, qui ne trouverait rien et avalerait le clic en silence.
        if (b.dataset.act === 'aller') { onglet = b.dataset.onglet; dessiner(); return; }
        var r = lignes.find(function (x) { return String(x.id) === b.dataset.id; }); if (!r) return;
        var act = b.dataset.act;
        if (act === 'fiche') ouvrirFiche(r.id);
        else if (act === 'suivre') formSuivi(r.sujet || r.id, r.device_nom || r.client || r.id, r.app);
        else if (act === 'voir') voirCle(r.id);
        else if (act === 'envoyer') envoyer(r);
        else if (act === 'renouveler') formEmettre(r, 'renouveler');
        else if (act === 'offre') formEmettre(r, 'offre');
        else if (act === 'revoquer') revoquer(r);
        else if (act === 'payee') payee(r);
        else if (act === 'facturee') facturee(r);
        else if (act === 'ecrire') ecrire(r);
        else if (act === 'verifier') verifierCommande(r);
        else if (act === 'abandonner') abandonnerCommande(r);
      };
      $('table').onclick = agir;
      // Le menu vit sur le body : son clic n'arrive pas au tableau. Le MÊME gestionnaire le sert —
      // une seconde table d'actions divergerait au premier geste ajouté (7.23.0) — et il est
      // enregistré UNE fois, plus bas : posé ici, il s'ajouterait à chaque dessin du tableau.
      agirLigne = agir;
    }
  }

  // --- la palette (Cmd+K) ---
  // Les deux applications l'ont depuis la 1.5.0 ; la console obligeait à viser une entrée du rail.
  // Les entrées se DÉDUISENT des écrans et des gestes existants : une liste écrite à la main
  // nommerait un jour un écran disparu, et c'est exactement ce qui a cassé Cmd+K en 7.30.0.
  function entreesPalette() {
    var out = [];
    GROUPES.forEach(function (g) {
      Object.keys(ECRANS).forEach(function (k) {
        if (ECRANS[k].g !== g) return;
        out.push({ t: ECRANS[k].h, ou: g, go: function () { onglet = k; recherche = ''; fiche = null; dessiner(); } });
      });
    });
    out.push({ t: 'Émettre une licence…', ou: 'Geste', go: function () { onglet = 'licences'; fiche = null; dessiner(); formEmettre(null, null); } });
    out.push({ t: 'Nouveau client…', ou: 'Geste', go: function () { onglet = 'clients'; fiche = null; dessiner(); formClient(); } });
    out.push({ t: 'Exporter la base…', ou: 'Geste', go: function () { exporterBase($('exporter')); } });
    // Chaque client par son nom : c'est ce qu'on cherche quand on décroche le téléphone, et le
    // chemin le plus court y menait par deux écrans.
    clients.forEach(function (c) { out.push({ t: c.nom, ou: 'Client', go: function () { ouvrirFiche(c.id); } }); });
    return out;
  }
  var palChoix = 0, palListe = [];
  function fermerPalette() { $('palette').hidden = true; $('palette').innerHTML = ''; }
  function ouvrirPalette() {
    var el = $('palette');
    el.hidden = false;
    el.innerHTML = '<div class="boite"><input id="pal-q" type="search" placeholder="Aller à… (écran, geste, client)" aria-label="Chercher un écran, un geste ou un client"><ul id="pal-l" role="listbox"></ul></div>';
    var tout = entreesPalette();
    var rendre = function (q) {
      var s = q.trim().toLowerCase();
      palListe = (!s ? tout : tout.filter(function (e) { return (e.t + ' ' + e.ou).toLowerCase().indexOf(s) >= 0; })).slice(0, 40);
      palChoix = 0;
      $('pal-l').innerHTML = palListe.length
        ? palListe.map(function (e, i) { return '<li role="option" data-i="' + i + '" aria-selected="' + (i === 0) + '">' + h(e.t) + '<span class="ou">' + h(e.ou) + '</span></li>'; }).join('')
        : '<li class="rien" role="option" aria-selected="false">Rien qui corresponde.</li>';
      Array.prototype.forEach.call($('pal-l').querySelectorAll('li[data-i]'), function (li) {
        li.onclick = function () { var e = palListe[Number(li.dataset.i)]; fermerPalette(); if (e) e.go(); };
      });
    };
    rendre('');
    var q = $('pal-q');
    q.oninput = function () { rendre(q.value); };
    q.onkeydown = function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); fermerPalette(); return; }
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!palListe.length) return;
        palChoix = (palChoix + (ev.key === 'ArrowDown' ? 1 : palListe.length - 1)) % palListe.length;
        Array.prototype.forEach.call($('pal-l').querySelectorAll('li[data-i]'), function (li, i) {
          li.setAttribute('aria-selected', String(i === palChoix));
          if (i === palChoix) li.scrollIntoView({ block: 'nearest' });
        });
        return;
      }
      if (ev.key === 'Enter') { ev.preventDefault(); var e = palListe[palChoix]; fermerPalette(); if (e) e.go(); }
    };
    // Cliquer À CÔTÉ ferme : une couche qu'on ne peut quitter qu'au clavier enferme celui qui l'a
    // ouverte par erreur (5.2.2 — une promesse posée par une couche doit toujours se résoudre).
    el.onclick = function (ev) { if (ev.target === el) fermerPalette(); };
    q.focus();
  }
  // Le menu d'une ligne : son clic arrive sur le body, pas sur le tableau. Enregistré UNE fois —
  // posé dans le dessin du tableau, il s'ajouterait à chaque redessin et le même geste partirait
  // trois fois. Le clic À CÔTÉ referme, comme dans les deux applications (7.28.0).
  document.addEventListener('click', function (e) {
    var dans = e.target.closest ? e.target.closest('#rowmenu') : null;
    if (dans) { if (agirLigne) agirLigne(e); return; }
    if (menuOuvertSur && !(e.target.closest && e.target.closest('button[data-menu]'))) fermerMenuLigne();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOuvertSur) { var b = menuOuvertSur; fermerMenuLigne(); b.focus(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if ($('lock').hidden) { $('palette').hidden ? ouvrirPalette() : fermerPalette(); }
      return;
    }
    // Échap ferme ce qui est ouvert, du plus haut au plus bas : la bulle passe avant la palette,
    // sinon elle survivrait seule au-dessus d'un écran redevenu normal.
    if (e.key === 'Escape') {
      if (bulleOuverte) { fermerBulle(); return; }
      if (!$('palette').hidden) { fermerPalette(); return; }
    }
  });

  if (secret) {
    api('stats').then(function () { $('lock').hidden = true; $('app').hidden = false; dessiner(); },
      function () { sessionStorage.removeItem(CLE); secret = ''; $('sec').focus(); });
  } else { $('sec').focus(); }
})();
</script>
</body></html>`;
