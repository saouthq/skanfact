// SkanFact — le plan de contrôle (P 0.1).
//
// Ce que ce worker fait : une application cliente lui présente sa clé de licence et son ordinateur,
// il enregistre l'activation et répond ce qu'il sait de cette licence — active, révoquée, expirée.
// Une application en ESSAI n'a pas de clé : elle s'annonce quand même (sinon aucun essai ne serait
// visible, et « combien d'essais convertissent » est justement la question qui compte). Et il sert
// la console de l'éditeur sur « / » : un seul déploiement, aucun domaine croisé à régler.
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
// Les décisions sont pures et exportées : elles se testent dans `npm test`, sans réseau et sans
// base, exactement comme celles du relais de mise à jour (worker/skanfact-maj.mjs).
//
// Déploiement : voir plateforme/README.md.

// ---------- les chemins que ce worker connaît ----------
// Tout le reste est refusé avant de regarder qui demande. Versionné dès le premier jour : une
// application installée chez un client ne se met pas à jour sur commande, et le jour où la forme
// d'une réponse doit changer, /v2/ naîtra à côté pendant que /v1/ continuera de répondre.
const ACTIONS = {
  licence: ['etat'],
  admin: ['stats', 'clients', 'licences', 'activations', 'ventes']
};
const SOUS_ACTIONS = ['revoquer', 'renouveler', 'changer-offre', 'facturee'];
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

export function nettoyerActivation(corps) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const texte = (v, max) => {
    const s = String(v == null ? '' : v).replace(/[ -]/g, ' ').trim();
    return s ? s.slice(0, max) : null;
  };
  const deviceId = String(c.deviceId || '').trim();
  return {
    deviceId: DEVICE.test(deviceId) ? deviceId : null,
    deviceNom: texte(c.deviceNom, 80),
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

// ---------- la console (lecture seule pour l'instant) ----------
async function repondreAdmin(r, request, env) {
  const a = autoriseAdmin(request.headers, env);
  if (!a.ok) return json({ erreur: a.message }, a.code);

  // Écrire arrive en P 0.2. Répondre 501 plutôt que 404 dit que le chemin existe et n'est pas
  // encore branché — un 404 ferait chercher une faute de frappe. Et la console n'affiche aucun
  // bouton pour ces gestes : un bouton qui ne fait rien est pire qu'un bouton absent (7.0.0).
  if (request.method !== 'GET') return json({ erreur: 'Pas encore en service : la console est en lecture seule.' }, 501);
  if (!env || !env.DB) return json({ erreur: 'La base n\'est pas branchée sur ce worker (réglage « DB »).' }, 503);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const tous = async (sql, ...p) => {
    const res = await sansCasser(env.DB.prepare(sql).bind(...p).all(), null);
    return (res && res.results) || [];
  };
  const un = async (sql, ...p) => (await sansCasser(env.DB.prepare(sql).bind(...p).first(), null)) || {};

  if (r.action === 'stats') {
    const recent = new Date(Date.now() - 30 * 86400000).toISOString();
    const c = await un('SELECT COUNT(*) AS n FROM clients');
    const l = await un(
      'SELECT COUNT(*) AS total,' +
      ' SUM(CASE WHEN revoquee_le IS NOT NULL THEN 1 ELSE 0 END) AS revoquees,' +
      ' SUM(CASE WHEN revoquee_le IS NULL AND fin IS NOT NULL AND fin < ? THEN 1 ELSE 0 END) AS expirees' +
      ' FROM licences', aujourdhui);
    const e = await un('SELECT COUNT(*) AS n FROM activations WHERE empreinte = ? AND derniere_fois >= ?', ESSAI, recent);
    const p = await un('SELECT COUNT(*) AS n FROM activations WHERE empreinte <> ?', ESSAI);
    const total = Number(l.total) || 0;
    return json(resumeStats({
      clients: c.n,
      licencesActives: total - (Number(l.revoquees) || 0) - (Number(l.expirees) || 0),
      licencesExpirees: l.expirees,
      licencesRevoquees: l.revoquees,
      essaisEnCours: e.n,
      postes: p.n
    }));
  }

  if (r.action === 'clients') {
    return json({ lignes: await tous('SELECT id, nom, matricule, email, tel, cree_le FROM clients ORDER BY cree_le DESC LIMIT 500') });
  }
  if (r.action === 'licences') {
    return json({ lignes: await tous(
      'SELECT l.id, l.kid, l.empreinte, l.offre, l.postes, l.debut, l.fin, l.prix, l.devise,' +
      ' l.emise_le, l.revoquee_le, l.revoquee_motif, c.nom AS client, c.matricule' +
      ' FROM licences l LEFT JOIN clients c ON c.id = l.client_id' +
      ' ORDER BY l.emise_le DESC LIMIT 500') });
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
    return json({ lignes: await tous(
      'SELECT v.id, v.montant_ht, v.tva, v.devise, v.payee_le, v.moyen, v.facture_skanfact, c.nom AS client' +
      ' FROM ventes v LEFT JOIN clients c ON c.id = v.client_id ORDER BY v.payee_le DESC LIMIT 500') });
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
const CONSOLE_HTML = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>SkanFact — console</title>
<style>
  :root{--ground:#f5f7fa;--surface:#fff;--surface2:#eaf1f1;--ink:#152a2e;--ink2:#4e666c;
        --line:#d3e0e0;--acc:#0f9d8f;--srv:#5a6ac2;--alr:#bf4a33;color-scheme:light dark}
  @media (prefers-color-scheme:dark){:root{--ground:#0d1517;--surface:#142023;--surface2:#1b2a2d;
        --ink:#e3efec;--ink2:#9ab0b3;--line:#2b3f42;--acc:#41c1b0;--srv:#94a1e6;--alr:#e4785e}}
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
  .btn:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
  input{font:inherit;padding:9px 12px;border-radius:8px;border:1px solid var(--line);
        background:var(--surface);color:var(--ink);width:100%}
  input:focus-visible{outline:2px solid var(--acc);outline-offset:1px}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px}
  .tabs button{font:inherit;font-size:14px;padding:7px 14px;border-radius:999px;cursor:pointer;
       border:1px solid var(--line);background:var(--surface);color:var(--ink2)}
  .tabs button[aria-selected=true]{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}
  /* Six cartes ne se rangent proprement qu'en 6, 3, 2 ou 1 colonnes. En laissant faire
     auto-fit, une largeur intermédiaire en choisit 4 ou 5 et laisse une ou deux orphelines
     sur la seconde ligne. On énumère donc les seuls découpages qui REMPLISSENT chaque rangée.
     (Aucun backtick dans ce commentaire : il vit dans un template literal.) */
  .cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-bottom:24px}
  @media (max-width:1180px){.cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media (max-width:700px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media (max-width:430px){.cards{grid-template-columns:1fr}}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
  .card b{display:block;font-size:28px;font-weight:700;letter-spacing:-.02em;
          font-variant-numeric:tabular-nums;line-height:1.1}
  .card span{display:block;font-size:12.5px;color:var(--ink2);margin-top:4px}
  .card.ess b{color:var(--srv)} .card.rev b{color:var(--alr)} .card.act b{color:var(--acc)}
  .wrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th,td{padding:10px 14px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
  tr:last-child td{border-bottom:0}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink2);background:var(--surface2)}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .mono{font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;font-size:12px}
  .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:600;
        border:1px solid var(--line)}
  .pill.a{color:var(--acc);border-color:var(--acc)}
  .pill.r{color:var(--alr);border-color:var(--alr)}
  .pill.e{color:var(--ink2)}
  .vide,.chargement{padding:36px 22px;text-align:center;color:var(--ink2)}
  .msg{padding:14px 18px;border-radius:10px;border:1px solid var(--alr);
       background:var(--surface);color:var(--ink);margin-bottom:20px}
  .msg.ok{border-color:var(--acc)}
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
    <span class="pill e" id="lecture">lecture seule</span>
    <span class="sp"></span>
    <button id="refresh" class="btn" type="button">Actualiser</button>
    <button id="out" class="btn" type="button">Fermer la session</button>
  </header>
  <main>
    <div id="err" class="msg" hidden></div>
    <div class="cards" id="cards"></div>
    <div class="tabs" id="tabs" role="tablist"></div>
    <div id="table"></div>
  </main>
  <footer>Lecture seule : émettre, révoquer et facturer arrivent à l'étape suivante.</footer>
</div>

<script>
(function () {
  var CLE = 'skanfact-console';
  var secret = sessionStorage.getItem(CLE) || '';
  var onglet = 'licences';
  var $ = function (id) { return document.getElementById(id); };
  var h = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var pl = function (n, mot, plur) {
    n = Number(n) || 0;
    return n + ' ' + (Math.abs(n) >= 2 ? (plur || (mot + 's')) : mot);
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

  function api(chemin) {
    return fetch('/v1/admin/' + chemin, { headers: { 'X-SkanFact-Admin': secret } })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.erreur || ('Le serveur a répondu ' + r.status + '.'));
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

  // --- les chiffres ---
  // Chaque carte porte SES deux formes : le libellé s'accorde avec son chiffre. Écrit en dur au
  // pluriel, il donnait « 0 essais en cours » (zéro prend le singulier en français) et aurait donné
  // « 1 licences actives ». C'est le premier écran que l'éditeur regarde tous les matins.
  var CARTES = [
    { k: 'essaisEnCours', s: 'essai en cours', p: 'essais en cours', c: 'ess' },
    { k: 'licencesActives', s: 'licence active', p: 'licences actives', c: 'act' },
    { k: 'licencesExpirees', s: 'expirée', p: 'expirées', c: '' },
    { k: 'licencesRevoquees', s: 'révoquée', p: 'révoquées', c: 'rev' },
    { k: 'postes', s: 'ordinateur vu', p: 'ordinateurs vus', c: '' },
    { k: 'clients', s: 'client', p: 'clients', c: '' }
  ];

  var COLONNES = {
    licences: [
      { k: 'client', t: 'Client' },
      { k: 'offre', t: 'Offre' },
      { k: 'fin', t: 'Fin', f: function (v) { return v || 'à vie'; } },
      { k: 'postes', t: 'Postes', n: true, f: function (v) { return v == null ? 'illimité' : v; } },
      { k: 'kid', t: 'Clé', m: true },
      { k: 'empreinte', t: 'Empreinte', m: true, f: function (v) { return String(v || '').slice(0, 12); } },
      { k: 'revoquee_le', t: 'État', f: function (v, r) {
          if (v) return '<span class="pill r">révoquée' + (r.revoquee_motif ? ' — ' + h(r.revoquee_motif) : '') + '</span>';
          if (r.fin && r.fin < new Date().toISOString().slice(0, 10)) return '<span class="pill e">expirée</span>';
          return '<span class="pill a">active</span>';
        }, brut: true }
    ],
    activations: [
      { k: 'client', t: 'Client', f: function (v, r) { return v || (r.empreinte === 'ESSAI' ? '— en essai —' : '— licence inconnue —'); } },
      { k: 'device_nom', t: 'Ordinateur' },
      { k: 'plateforme', t: 'Système' },
      { k: 'version', t: 'Version', m: true },
      { k: 'derniere_fois', t: 'Vu', f: function (v) { return depuis(v); } },
      { k: 'premiere_fois', t: 'Depuis', f: function (v) { return String(v || '').slice(0, 10); } }
    ],
    clients: [
      { k: 'nom', t: 'Nom' }, { k: 'matricule', t: 'Matricule', m: true },
      { k: 'email', t: 'Courriel' }, { k: 'tel', t: 'Téléphone' },
      { k: 'cree_le', t: 'Créé', f: function (v) { return String(v || '').slice(0, 10); } }
    ],
    ventes: [
      { k: 'client', t: 'Client' },
      { k: 'montant_ht', t: 'Montant HT', n: true },
      { k: 'devise', t: 'Devise' },
      { k: 'payee_le', t: 'Payée le' },
      { k: 'moyen', t: 'Moyen' },
      { k: 'facture_skanfact', t: 'Facture', f: function (v) { return v || 'à établir'; } }
    ]
  };
  var TITRES = { licences: 'Licences', activations: 'Activations', clients: 'Clients', ventes: 'Ventes' };
  // Chaque écran vide dit quoi faire, au lieu d'un tableau nu (7.0.0).
  var VIDES = {
    licences: "Aucune licence enregistrée. Elles apparaîtront ici dès que la console saura en émettre.",
    activations: "Aucune application ne s'est encore annoncée. Il faut une installation en 8.4.0 ou plus récente.",
    clients: "Aucun client enregistré. La création arrive à l'étape suivante.",
    ventes: "Aucune vente enregistrée. Elles arriveront avec l'émission des licences."
  };

  function dessiner() {
    $('err').hidden = true;
    $('tabs').innerHTML = Object.keys(TITRES).map(function (k) {
      return '<button role="tab" data-t="' + k + '" aria-selected="' + (k === onglet) + '">' + TITRES[k] + '</button>';
    }).join('');
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.onclick = function () { onglet = b.dataset.t; dessiner(); };
    });

    api('stats').then(function (s) {
      $('cards').innerHTML = CARTES.map(function (c) {
        var n = Number(s[c.k]) || 0;
        return '<div class="card ' + c.c + '"><b>' + n + '</b><span>' + (n >= 2 ? c.p : c.s) + '</span></div>';
      }).join('');
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
            var cl = (c.n ? 'num ' : '') + (c.m ? 'mono' : '');
            return '<td' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + '>' + (c.brut ? texte : h(texte)) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      $('table').innerHTML = html;
    }, montrerErreur);
  }

  function montrerErreur(e) {
    var el = $('err');
    el.textContent = e && e.message ? e.message : 'Quelque chose n\\u2019a pas répondu.';
    el.hidden = false;
  }

  if (secret) {
    api('stats').then(function () { $('lock').hidden = true; $('app').hidden = false; dessiner(); },
      function () { sessionStorage.removeItem(CLE); secret = ''; $('sec').focus(); });
  } else { $('sec').focus(); }
})();
</script>
</body></html>`;
