// Ce que chaque canal de mise à jour sert AUJOURD'HUI : la dernière version stable et la dernière
// version d'essai réellement publiées, pour l'application qui pose la question.
//
// Pourquoi ce fichier existe (23/09/2026). L'écran des mises à jour écrivait « Numérotées
// `9.2.0-beta.1` » dans le Cabinet et « `7.26.0-beta.1` » dans l'app entreprise : deux exemples
// écrits à la main, figés depuis la version où la case a été posée, et faux depuis. Un numéro qu'on
// affiche doit venir de ce qui est publié, pas de la mémoire de celui qui a écrit la phrase — sinon
// il vaut mieux ne pas l'afficher du tout.
//
// Deux sources, dans cet ordre, comme les mises à jour elles-mêmes : le relais (`/sante`, qui relit
// les releases une par une, voir worker/skanfact-maj.mjs), puis l'API GitHub en direct. Chargé par
// LES DEUX applications : il vit dans `src/`, comme `depot.js`, et entre dans les `files` de
// `build/cabinet.config.js`.
'use strict';

const INDEX = {
  app: { stable: 'latest', essai: 'beta' },
  cabinet: { stable: 'cabinet', essai: 'cabinet-beta' }
};

function nomIndex(base, plateforme) {
  const suffixe = plateforme === 'darwin' ? '-mac' : plateforme === 'linux' ? '-linux' : '';
  return `${base}${suffixe}.yml`;
}

const versionDuTag = t => String(t || '').trim().replace(/^v/, '');

// Comparer deux numéros comme des NOMBRES : « 10.10.0 » est plus récent que « 9.8.8 », ce qu'un tri
// de chaînes dit exactement à l'envers (10.4.0). Une préversion passe AVANT la version qu'elle
// prépare, et « beta.10 » après « beta.9 ».
function comparerVersions(a, b) {
  const lire = v => {
    const [base, pre] = String(v || '').replace(/^v/, '').split('-');
    return { n: base.split('.').map(x => Number(x) || 0), pre: pre ? pre.split('.') : null };
  };
  const x = lire(a), y = lire(b);
  for (let i = 0; i < 3; i++) if ((x.n[i] || 0) !== (y.n[i] || 0)) return (x.n[i] || 0) < (y.n[i] || 0) ? -1 : 1;
  if (!x.pre && !y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const np = /^\d+$/.test(p), nq = /^\d+$/.test(q);
    if (np && nq && Number(p) !== Number(q)) return Number(p) < Number(q) ? -1 : 1;
    if (!np || !nq) { if (p !== q) return p < q ? -1 : 1; }
  }
  return 0;
}

// **Une bêta voit la stable qui la dépasse** (S-01, 10.14.1). Cocher « recevoir les versions d'essai »
// veut dire « avant les autres », jamais « à la place de la stable » : sur une 13.0.0-beta.1, une
// 14.0.0 stable publiée ensuite doit être proposée sans décocher la case. Pour un index d'essai, on
// regarde aussi son jumeau stable, et la plus récente des deux est celle qu'on sert.
// Jumelles EXACTES de `INDEX_STABLE_DE` et `indexAServir` du relais (worker/skanfact-maj.mjs, un
// fichier déployé seul qui ne peut rien charger du dépôt) : un test compare les deux. C'est ce qui
// fait que le repli GitHub du Cabinet décide comme le relais.
const INDEX_STABLE_DE = {
  'beta.yml': 'latest.yml', 'beta-mac.yml': 'latest-mac.yml', 'beta-linux.yml': 'latest-linux.yml',
  'cabinet-beta.yml': 'cabinet.yml', 'cabinet-beta-mac.yml': 'cabinet-mac.yml', 'cabinet-beta-linux.yml': 'cabinet-linux.yml'
};

// `essai` est ce que porte l'index demandé, `stable` ce que porte son jumeau stable (null si l'un
// manque) — chacun `{ tag }`. On garde l'essai tant qu'il est au moins aussi récent.
function indexAServir(fichier, essai, stable) {
  if (!INDEX_STABLE_DE[String(fichier || '')]) return essai;
  if (stable && (!essai || comparerVersions(stable.tag, essai.tag) > 0)) return { ...stable, stableServie: true };
  return essai;
}

const ligne = (tag, publie) => tag ? { version: versionDuTag(tag), publie: String(publie || '') } : null;

// Depuis la réponse de `/sante` du relais : une ligne par (canal, index).
function depuisSante(sante, app, plateforme) {
  const noms = INDEX[app]; if (!noms) return null;
  const canal = app === 'cabinet' ? 'cabinet' : 'app';
  const lignes = (sante && Array.isArray(sante.canaux)) ? sante.canaux : [];
  const trouve = fichier => {
    const l = lignes.find(x => x && x.canal === canal && x.fichier === fichier && x.servi);
    return l ? ligne(l.tag, l.publie) : null;
  };
  return { stable: trouve(nomIndex(noms.stable, plateforme)), essai: trouve(nomIndex(noms.essai, plateforme)) };
}

// Depuis la liste des releases de l'API : la première qui porte l'index, et un index STABLE ne vient
// jamais d'une préversion (la règle du relais, 9.8.8).
function depuisReleases(releases, app, plateforme) {
  const noms = INDEX[app]; if (!noms) return null;
  const premiere = (fichier, stable) => {
    for (const rel of Array.isArray(releases) ? releases : []) {
      if (!rel || rel.draft) continue;
      if (stable && rel.prerelease) continue;
      if ((rel.assets || []).some(a => a && a.name === fichier)) return ligne(rel.tag_name, rel.published_at);
    }
    return null;
  };
  return { stable: premiere(nomIndex(noms.stable, plateforme), true), essai: premiere(nomIndex(noms.essai, plateforme), false) };
}

function getJson(url, entetes) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(url, { headers: entetes, timeout: 12000 }, res => {
      let corps = '';
      res.setEncoding('utf8');
      res.on('data', d => { corps += d; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(corps)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('ETIMEDOUT')));
    req.on('error', reject);
  });
}

// Lu au plus une fois par demi-heure : c'est une information d'écran, pas une vérification.
let cache = null;
async function lireCanaux({ app, plateforme, relaisBase, relaisSecret, owner, repo, token, userAgent }) {
  if (cache && Date.now() - cache.at < 30 * 60 * 1000 && cache.app === app) return cache.valeur;
  let valeur = null;
  if (relaisBase && relaisSecret) {
    try {
      const sante = await getJson(`${relaisBase}/sante`, { 'X-SkanFact-App': relaisSecret, 'User-Agent': userAgent });
      valeur = { ...depuisSante(sante, app, plateforme), source: 'relais' };
    } catch (_) { valeur = null; }
  }
  if (!valeur && owner && repo) {
    try {
      const entetes = { 'User-Agent': userAgent, Accept: 'application/vnd.github+json' };
      if (token) entetes.Authorization = `Bearer ${String(token).trim()}`;
      const base = `https://api.github.com/repos/${owner}/${repo}/releases`;
      const releases = await getJson(`${base}?per_page=20`, entetes);
      // La liste peut rendre une release récente sans ses fichiers : on relit les trois premières.
      for (const rel of releases.filter(r => r && !r.draft).slice(0, 3)) {
        try { rel.assets = await getJson(`${base}/${rel.id}/assets?per_page=100`, entetes); } catch (_) { /* on garde la liste */ }
      }
      valeur = { ...depuisReleases(releases, app, plateforme), source: 'github' };
    } catch (_) { valeur = null; }
  }
  if (valeur) cache = { at: Date.now(), app, valeur };
  return valeur;
}

module.exports = { INDEX, nomIndex, versionDuTag, comparerVersions, INDEX_STABLE_DE, indexAServir, depuisSante, depuisReleases, lireCanaux };
