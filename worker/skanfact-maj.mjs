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
    // Depuis la 9.1.0, l'application du cabinet a son canal d'essai, comme l'app entreprise depuis
    // la 7.25.0. Le comptable pilote a besoin de recevoir une version avant tout le monde : sans
    // ça, la seule façon de lui faire essayer quelque chose est de le publier à tous les cabinets.
    yml: ['cabinet.yml', 'cabinet-mac.yml', 'cabinet-linux.yml',
          'cabinet-beta.yml', 'cabinet-beta-mac.yml', 'cabinet-beta-linux.yml'],
    prefixe: 'SkanFact-Cabinet-',
    interdit: null
  }
};

const EXTENSIONS = ['.yml', '.dmg', '.zip', '.exe', '.blockmap'];

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
  // Un relais SANS clé publique ne peut pas juger : il laisse passer comme « sans licence » (le
  // secret a déjà été contrôlé). Refuser ici couperait les mises à jour de chaque client qui a PAYÉ
  // — c'est ce qui serait arrivé à la 8.0.0 : les clients ont de vraies clés, l'application les
  // présente, et le relais de Skander n'avait pas encore LICENCE_PUBLIC_KEY.
  if (!env.LICENCE_PUBLIC_KEY) {
    if (env.LICENCE_REQUISE === '1' && canal !== 'cabinet') return { ok: false, code: 503, message: 'Relais non configuré (LICENCE_PUBLIC_KEY manque).' };
    return { ok: true, qui: 'licence non vérifiée (relais sans clé publique)' };
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
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Méthode non autorisée.', { status: 405 });
    }
    const url = new URL(request.url);
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
