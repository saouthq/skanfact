// SkanFact — relais de mise à jour.
//
// Le problème qu'il résout : une application qui se met à jour toute seule doit pouvoir télécharger
// ses fichiers sans que personne tape un mot de passe. Tout ce qu'elle peut atteindre sans secret,
// n'importe qui peut l'atteindre aussi. Ce relais déplace le secret : le jeton GitHub reste ICI,
// côté serveur, et l'application ne reçoit que ce à quoi elle a droit.
//
// Ce qu'il fait, dans l'ordre :
//   1. il n'accepte que les chemins qu'il connaît (/app/... et /cabinet/...) ;
//   2. il exige le secret de l'application — un inconnu est refusé avant tout le reste ;
//   3. si une licence est présentée, il vérifie sa signature et REFUSE une licence inventée ;
//   4. il va chercher le fichier dans la release GitHub privée, avec son propre jeton, et le renvoie.
//
// Ce qu'il ne fait pas : aucune base de données, aucun compte, aucune donnée d'entreprise. Il ne
// voit passer que des noms de fichiers et, éventuellement, le nom inscrit dans une licence.
//
// Déploiement : voir worker/README.md (tout se fait depuis le site de Cloudflare, sans terminal).

// ---------- ce que chaque canal a le droit de demander ----------
// Sans cette table, l'app du comptable pourrait réclamer le fichier de mise à jour de l'app
// entreprise, et proposer à ses utilisateurs d'installer le mauvais logiciel.
// `beta*.yml` appartient à l'app entreprise et à elle seule : c'est le canal des versions d'essai
// (7.25.0). Sans cette ligne, une installation qui a coché « recevoir les bêtas » réclamerait
// `beta-mac.yml`, le relais répondrait 404, et l'écran afficherait « aucune version trouvée » —
// un canal muet, sans rien qui dise pourquoi.
export const CANAUX = {
  app: {
    yml: ['latest.yml', 'latest-mac.yml', 'latest-linux.yml', 'beta.yml', 'beta-mac.yml', 'beta-linux.yml'],
    prefixe: 'SkanFact-',
    interdit: 'SkanFact-Cabinet-'
  },
  cabinet: {
    yml: ['cabinet.yml', 'cabinet-mac.yml', 'cabinet-linux.yml'],
    prefixe: 'SkanFact-Cabinet-',
    interdit: null
  }
};

const EXTENSIONS = ['.yml', '.dmg', '.zip', '.exe', '.blockmap'];


// ---------- le formulaire de contact du site ----------
// Pourquoi ici plutôt qu'un service de formulaires : le site promet que rien ne part chez un
// tiers. Un formulaire hébergé ailleurs ferait exactement le contraire, sur la page où l'on
// demande à quelqu'un de nous faire confiance. Ce relais est déjà déployé, il ne stocke rien,
// et il oublie le message aussitôt remis.
//
// Ce chemin n'a PAS de secret, et ne peut pas en avoir : le formulaire est public par nature,
// et un secret écrit dans une page publique n'est pas un secret. Les protections sont donc
// celles d'un formulaire public : une origine attendue, un piège à robots, des tailles bornées.

export const ORIGINES = [
  'https://saouthq.github.io',
  'https://skanfact.tn',
  'https://www.skanfact.tn'
];

// L'origine est-elle une des nôtres ? Sans cette porte, n'importe quelle page du web pourrait
// poster dans notre boîte depuis le navigateur de ses visiteurs.
export function origineAutorisee(origine, env) {
  const sup = String(env && env.CONTACT_ORIGINES || '').split(',').map(x => x.trim()).filter(Boolean);
  return ORIGINES.concat(sup).includes(String(origine || ''));
}

// Ce qu'on accepte de recevoir. Pur, donc testé sans réseau — et c'est ce qui décide.
export function contactValide(c) {
  const t = k => String((c && c[k]) || '').trim();
  // Le piège : un champ que la feuille de style cache et qu'aucun humain ne voit. Un robot
  // remplit tout ce qu'il trouve. On répond « reçu » sans rien envoyer : lui dire qu'il a été
  // repéré lui apprend à contourner.
  if (t('piege')) return { ok: false, muet: true };
  if (!t('nom')) return { ok: false, erreur: 'Indiquez votre nom.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t('email'))) return { ok: false, erreur: 'Cette adresse ne permettra pas de vous répondre.' };
  // Le site a DEUX formulaires — nous écrire, et demander une clé — et ils n'ont pas les mêmes
  // champs. Plutôt que d'énumérer ici ceux de chacun (une liste que la prochaine page rendrait
  // fausse en silence), le site assemble lui-même le corps du message avec les intitulés qu'il
  // affiche, et le relais ne valide que ce dont il a besoin pour répondre : un nom, une adresse,
  // et du texte. `message` reste accepté : un navigateur qui a gardé l'ancien script en cache
  // continue de passer.
  const texte = t('corps') || t('message');
  if (texte.length < 10) return { ok: false, erreur: 'Dites-nous en un peu plus, pour qu\'on puisse répondre utilement.' };
  // Des bornes, parce que tout ce qui vient du dehors est sans limite jusqu'à ce qu'on en pose une.
  if (t('nom').length > 120 || t('societe').length > 160 || t('email').length > 160
      || t('tel').length > 40 || texte.length > 5000) {
    return { ok: false, erreur: 'Message trop long : écrivez-nous directement à contact@skanfact.tn.' };
  }
  return { ok: true };
}

// Le message tel qu'il arrivera dans la boîte. Pur lui aussi : le corps d'un email est
// exactement le genre de chose qu'on croit juste sans jamais l'avoir lu.
export function contactCourriel(c) {
  const t = k => String((c && c[k]) || '').trim();
  const profil = t('profil') === 'un cabinet comptable' ? 'un cabinet comptable' : 'une entreprise';
  // Le corps assemblé par le site : on le remet tel quel. L'objet dit de quel formulaire il
  // vient, parce qu'une demande de clé et une question ne se traitent pas le même jour.
  if (t('corps')) {
    return {
      sujet: `SkanFact — ${t('genre') === 'commande' ? 'demande de clé' : 'message'} · ${t('nom')}`,
      repondreA: t('email'),
      texte: t('corps') + '\n\n— envoyé depuis le formulaire de skanfact'
    };
  }
  return {
    sujet: `SkanFact — ${profil === 'un cabinet comptable' ? 'cabinet' : 'entreprise'} · ${t('nom')}`,
    repondreA: t('email'),
    texte: [
      `Je suis ${profil}.`,
      '',
      `Nom      : ${t('nom')}`,
      `Société  : ${t('societe') || '—'}`,
      `Email    : ${t('email')}`,
      `Téléphone: ${t('tel') || '—'}`,
      '',
      t('message'),
      '',
      '— envoyé depuis le formulaire de skanfact'
    ].join('\n')
  };
}

// L'envoi. Séparé du reste pour que tout ce qui DÉCIDE reste testable sans réseau.
async function remettre(courriel, env) {
  if (!env.RESEND_KEY || !env.CONTACT_TO) return { ok: false, code: 503, config: true };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CONTACT_FROM || 'SkanFact <site@skanfact.tn>',
      to: [env.CONTACT_TO],
      reply_to: courriel.repondreA,     // répondre au visiteur, pas à soi-même
      subject: courriel.sujet,
      text: courriel.texte
    })
  });
  return r.ok ? { ok: true } : { ok: false, code: 502 };
}

function entetesCors(origine) {
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', origine);
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  h.set('Access-Control-Max-Age', '86400');
  h.set('Vary', 'Origin');
  return h;
}

// Le chemin /contact, de bout en bout. Rend TOUJOURS du JSON : le site doit pouvoir distinguer
// « refusé, voici pourquoi » de « pas configuré » — dans ce dernier cas il repasse au logiciel de
// messagerie du visiteur plutôt que de perdre le message.
export async function servirContact(request, env) {
  const origine = request.headers.get('Origin') || '';
  if (!origineAutorisee(origine, env)) return new Response('Introuvable.', { status: 404 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: entetesCors(origine) });
  if (request.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405, headers: entetesCors(origine) });

  const h = entetesCors(origine);
  h.set('Content-Type', 'application/json; charset=utf-8');
  const dit = (code, o) => new Response(JSON.stringify(o), { status: code, headers: h });

  let corps = null;
  try { corps = await request.json(); } catch { return dit(400, { ok: false, erreur: 'Message illisible.' }); }

  const v = contactValide(corps);
  // Au robot on répond comme à tout le monde, et on ne remet rien.
  if (!v.ok && v.muet) return dit(200, { ok: true });
  if (!v.ok) return dit(400, { ok: false, erreur: v.erreur });

  const r = await remettre(contactCourriel(corps), env);
  if (r.ok) return dit(200, { ok: true });
  if (r.config) return dit(503, { ok: false, configurer: true, erreur: 'Le formulaire n\'est pas encore branché.' });
  return dit(502, { ok: false, erreur: 'L\'envoi a échoué. Écrivez-nous à contact@skanfact.tn.' });
}

// ---------- décisions pures (testées sans réseau) ----------

// « /app/latest-mac.yml » → { canal: 'app', fichier: 'latest-mac.yml' }. Tout le reste : null.
// Aucun « .. », aucun sous-dossier, aucun caractère exotique : ce relais ne sert que des fichiers
// de release, jamais autre chose.
export function route(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [canal, fichier] = parts;
  if (!Object.prototype.hasOwnProperty.call(CANAUX, canal)) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(fichier)) return null;
  if (fichier.includes('..')) return null;
  return { canal, fichier };
}

// Le fichier demandé appartient-il bien à ce canal ?
export function fichierAutorise(canal, fichier) {
  const c = CANAUX[canal];
  if (!c) return false;
  if (fichier.endsWith('.yml')) return c.yml.includes(fichier);
  if (!EXTENSIONS.some(e => fichier.endsWith(e))) return false;
  if (c.interdit && fichier.startsWith(c.interdit)) return false;
  return fichier.startsWith(c.prefixe);
}

// Comparaison à temps constant : comparer deux secrets avec === laisse fuir leur longueur commune.
export function memeSecret(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (!x || !y || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

// Découpe une clé de licence sans rien vérifier. Renvoie null si elle n'a pas la bonne forme.
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

const pemVersDer = pem => unb64u(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_'));

// Vérifie la signature d'une licence avec la clé publique. Une licence expirée reste VALIDE ici :
// quelqu'un dont l'abonnement se termine doit pouvoir recevoir les corrections de bugs. C'est
// l'application qui limite la création de pièces, pas le téléchargement.
export async function licenceValide(cle, pemPublique) {
  if (!pemPublique) return { ok: false, raison: 'aucune clé publique configurée' };
  const l = decoupeLicence(cle);
  if (!l) return { ok: false, raison: 'clé illisible' };
  try {
    const k = await crypto.subtle.importKey('spki', pemVersDer(pemPublique), { name: 'Ed25519' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'Ed25519' }, k, l.signature, l.corps);
    return ok ? { ok: true, contenu: l.contenu } : { ok: false, raison: 'signature fausse' };
  } catch (e) { return { ok: false, raison: 'vérification impossible : ' + (e && e.message) }; }
}

// Qui a le droit de télécharger. `env` porte les réglages du relais, `canal` dit quelle application
// demande (voir CANAUX).
export async function autorise(headers, env, canal) {
  const secret = headers.get('x-skanfact-app') || '';
  if (!env.APP_SECRET) return { ok: false, code: 503, message: 'Relais non configuré.' };
  if (!memeSecret(secret, env.APP_SECRET)) return { ok: false, code: 403, message: 'Accès refusé.' };

  const cle = headers.get('x-skanfact-licence') || '';
  if (!cle) {
    // L'application du cabinet est GRATUITE : elle n'a pas de licence et n'en aura jamais. Exiger
    // une licence sur son canal couperait les mises à jour de tous les comptables d'un coup, sans
    // que personne ne comprenne pourquoi — c'est exactement le contraire du but.
    if (canal === 'cabinet') return { ok: true, qui: 'cabinet (gratuit)' };
    // Pas encore de licence : période d'essai.
    if (env.LICENCE_REQUISE === '1') return { ok: false, code: 402, message: 'Licence requise pour les mises à jour.' };
    return { ok: true, qui: 'sans licence' };
  }
  const v = await licenceValide(cle, env.LICENCE_PUBLIC_KEY);
  // Une licence inventée est un refus, toujours : c'est le seul cas où quelqu'un ment.
  if (!v.ok) return { ok: false, code: 403, message: 'Licence non reconnue (' + v.raison + ').' };
  return { ok: true, qui: (v.contenu && v.contenu.nom) || 'licence valide', licence: v.contenu };
}

// ---------- accès aux fichiers de la release ----------
async function github(url, env, accept) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: accept || 'application/vnd.github+json',
      'User-Agent': 'skanfact-maj',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    redirect: 'follow'
  });
}

async function trouveFichier(fichier, env) {
  const base = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/releases`;
  // On regarde la dernière release, puis les précédentes : une mise à jour peut demander un fichier
  // d'une version un peu plus ancienne (delta, blockmap). Vingt, et pas cinq : depuis le canal bêta
  // (7.25.0), plusieurs préversions peuvent s'intercaler entre deux stables, et une installation
  // restée sur le canal normal ne trouverait plus `latest.yml` dans la fenêtre.
  const r = await github(`${base}?per_page=20`, env);
  if (!r.ok) return { erreur: `GitHub a répondu ${r.status}` };
  const releases = await r.json();
  for (const rel of releases) {
    if (rel.draft) continue;
    const a = (rel.assets || []).find(x => x.name === fichier);
    if (a) return { asset: a, tag: rel.tag_name };
  }
  return { erreur: 'fichier introuvable dans les dernières versions' };
}

const typeDe = f => f.endsWith('.yml') ? 'text/yaml; charset=utf-8'
  : f.endsWith('.zip') ? 'application/zip'
  : f.endsWith('.exe') ? 'application/octet-stream'
  : f.endsWith('.dmg') ? 'application/x-apple-diskimage'
  : 'application/octet-stream';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Le formulaire poste : il passe avant le filtre GET, qui le refuserait.
    if (url.pathname === '/contact') return servirContact(request, env);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Méthode non autorisée.', { status: 405 });
    }
    const r = route(url.pathname);
    if (!r) return new Response('Introuvable.', { status: 404 });
    if (!fichierAutorise(r.canal, r.fichier)) return new Response('Introuvable.', { status: 404 });

    const a = await autorise(request.headers, env, r.canal);
    if (!a.ok) return new Response(a.message, { status: a.code });

    const f = await trouveFichier(r.fichier, env);
    if (f.erreur) return new Response(f.erreur, { status: 404 });

    // Une trace dans le journal Cloudflare : qui met à jour, et vers quoi. Rien n'est stocké.
    console.log(`${r.canal} ${r.fichier} → ${f.tag} · ${a.qui}`);

    const bin = await github(f.asset.url, env, 'application/octet-stream');
    if (!bin.ok) return new Response(`Téléchargement impossible (${bin.status}).`, { status: 502 });

    const h = new Headers();
    h.set('Content-Type', typeDe(r.fichier));
    if (f.asset.size) h.set('Content-Length', String(f.asset.size));
    // Les .yml ne se mettent pas en cache : c'est eux qui annoncent la nouvelle version.
    h.set('Cache-Control', r.fichier.endsWith('.yml') ? 'no-store' : 'public, max-age=3600');
    return new Response(request.method === 'HEAD' ? null : bin.body, { status: 200, headers: h });
  }
};
