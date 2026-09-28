// Le banc du poste DANS LE NAVIGATEUR (Chromium) : SQLite en WebAssembly, stocké dans le système
// de fichiers privé du navigateur (OPFS), tenu par un worker. Mêmes seuils que le 04 § 9.3, même
// serveur, même connexion bridée à 4 Mbit/s. Il ajoute ce que Node ne peut pas dire : la copie
// survit-elle à la fermeture du navigateur (04 § 11, point 2) ?
//
//   node --experimental-strip-types --experimental-sqlite mesures/navigateur.ts
//   (PostgreSQL 16 sur 127.0.0.1:5433, et Chromium ; voir le README)

for (const v of ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[v];

import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import { creerServeur } from '../serveur/serveur.ts';
import { brider } from '../outils/bride.ts';

const RACINE = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const SUPER = process.env.PG_SUPER || 'postgres://postgres@127.0.0.1:5433/postgres';
const APP = process.env.PG_APP || 'postgres://proto_app:proto@127.0.0.1:5433/postgres';
const PORT_SERVEUR = 7101, PORT_BRIDE = 7102, PORT_PAGE = 7104;
const QUATRE_MBITS = 4_000_000 / 8;

type Resultat = { epreuve: string; seuil: string; mesure: string; tenu: boolean; detail?: string };
const resultats: Resultat[] = [];
const noter = (r: Resultat) => { resultats.push(r); console.log(`${r.tenu ? 'TENU  ' : 'MANQUÉ'}  ${r.epreuve} — ${r.mesure} (seuil : ${r.seuil})${r.detail ? ' — ' + r.detail : ''}`); };
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// La page et ses fichiers, et /api/* renvoyé vers notre serveur À TRAVERS la bride.
function servirPage() {
  const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm' };
  const sqlite = path.join(RACINE, 'node_modules/@sqlite.org/sqlite-wasm/dist');
  const s = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    if (url.pathname.startsWith('/api/')) {
      const amont = http.request({ host: '127.0.0.1', port: PORT_BRIDE, method: req.method, path: url.pathname.slice(4) + url.search, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode || 502, r.headers); r.pipe(res);
      });
      amont.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(amont);
      return;
    }
    const fichier = url.pathname === '/' ? path.join(RACINE, 'navigateur/index.html')
      : url.pathname.startsWith('/sqlite/') ? path.join(sqlite, path.basename(url.pathname))
        : path.join(RACINE, 'navigateur', path.basename(url.pathname));
    if (!fs.existsSync(fichier)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(fichier)] || 'application/octet-stream' });
    fs.createReadStream(fichier).pipe(res);
  });
  return new Promise<http.Server>(ok => s.listen(PORT_PAGE, '127.0.0.1', () => ok(s)));
}

async function main() {
  const db = new pg.Client({ connectionString: SUPER });
  await db.connect();
  console.log('Préparation de la base (schéma et données)…');
  await db.query(fs.readFileSync(path.join(RACINE, 'base/schema.sql'), 'utf8'));
  await db.query(fs.readFileSync(path.join(RACINE, 'base/donnees.sql'), 'utf8'));
  const uid = async (texte: string) => (await db.query('select proto.uid($1) u', [texte])).rows[0].u as string;
  const E = { pme: await uid('pme'), magasin: await uid('magasin') };

  const serveur = creerServeur(APP);
  await serveur.ecouter(PORT_SERVEUR);
  const bride = brider(PORT_BRIDE, PORT_SERVEUR, QUATRE_MBITS);
  await bride.ecouter();
  const page = await servirPage();

  // Chaque poste a son propre profil de navigateur : sa propre copie, qui survit à la fermeture.
  const profils = fs.mkdtempSync(path.join(os.tmpdir(), 'synchro-nav-'));
  const ouvrirNavigateur = async (nom: string) => {
    const ctx = await chromium.launchPersistentContext(path.join(profils, nom), { headless: true });
    const p = ctx.pages()[0] || await ctx.newPage();
    const erreurs: string[] = [];
    p.on('pageerror', e => erreurs.push(String(e)));
    await p.goto(`http://127.0.0.1:${PORT_PAGE}/`);
    await p.waitForFunction(() => (window as any).pret === true);
    const poste = (action: string, args: any = {}) => p.evaluate(([a, g]) => (window as any).poste(a, g), [action, args] as const) as Promise<any>;
    return { ctx, page: p, poste, erreurs };
  };

  // ── Ouverture, première copie, place ────────────────────────────────────────────────────────
  const proprioApp = await uid('a-proprio-1');
  let nav = await ouvrirNavigateur('proprio');
  const ouverture = await nav.poste('ouvrir');
  console.log(`  base ouverte dans le navigateur en ${ouverture.ms.toFixed(0)} ms (SQLite ${ouverture.version}, ${ouverture.vfs})`);
  const version = await nav.page.evaluate(() => navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]);
  const persistant = await nav.page.evaluate(async () => ({ avant: await navigator.storage.persisted(), demande: await navigator.storage.persist() }));
  bride.remettreAZero();
  let t = performance.now();
  const copie = await nav.poste('recevoir', { appareil: proprioApp });
  const dureeCopie = (performance.now() - t) / 1000;
  noter({ epreuve: 'Première copie d\'une PME dans le navigateur, sur 4 Mbit/s', seuil: '< 60 s', mesure: `${dureeCopie.toFixed(1)} s`, tenu: dureeCopie < 60 && copie.lignes > 50000,
    detail: `${copie.lignes} lignes, ${copie.pages} pages, ${(bride.octets() / 1e6).toFixed(1)} Mo transférés` });
  const taille = await nav.poste('taille');
  noter({ epreuve: 'Place prise dans le navigateur par une PME', seuil: '< 200 Mo', mesure: `${(taille / 1e6).toFixed(1)} Mo`, tenu: taille < 200e6 });

  // ── La copie survit à la fermeture du navigateur (04 § 11, point 2) ──────────────────────────
  const tiersAvant = await nav.poste('compter', { table: 'tiers' });
  await nav.poste('fermer');
  await nav.ctx.close();
  nav = await ouvrirNavigateur('proprio');
  t = performance.now();
  await nav.poste('ouvrir');
  const reouverture = performance.now() - t;
  const tiersApres = await nav.poste('compter', { table: 'tiers' });
  noter({ epreuve: 'La copie survit à la fermeture du navigateur', seuil: 'rien de perdu', mesure: `${tiersApres} fiches sur ${tiersAvant}`, tenu: tiersApres === tiersAvant && tiersAvant > 0,
    detail: `rouverte en ${reouverture.toFixed(0)} ms ; stockage « persistant » accordé par le navigateur : ${persistant.demande ? 'oui' : 'non'} (${version}, sans installation)` });

  // ── Encaisser 500 tickets hors ligne, puis rattraper ─────────────────────────────────────────
  const caisse = await ouvrirNavigateur('caisse');
  await caisse.poste('ouvrir');
  const idCaisse = randomUUID();
  const { durees } = await caisse.poste('encaisser', { entreprise: E.magasin, caisse: idCaisse, n: 500 });
  noter({ epreuve: 'Encaisser un ticket hors ligne dans le navigateur (500 tickets)', seuil: '< 200 ms', mesure: `max ${quantile(durees, 1).toFixed(1)} ms`,
    tenu: quantile(durees, 1) < 200, detail: `médiane ${quantile(durees, 0.5).toFixed(2)} ms, 95 % sous ${quantile(durees, 0.95).toFixed(2)} ms ; ticket et geste écrits ensemble` });
  const caisseApp = await uid('a-caisse');
  bride.remettreAZero();
  t = performance.now();
  const envoi = await caisse.poste('envoyer', { appareil: caisseApp });
  await caisse.poste('recevoir', { appareil: caisseApp });
  const dureeRattrapage = (performance.now() - t) / 1000;
  const surServeur = Number((await db.query('select count(*) n from proto.ticket where caisse = $1', [idCaisse])).rows[0].n);
  const alertes = Number((await db.query(`select count(*) n from proto.a_reprendre where raison like 'chaîne%'`)).rows[0].n);
  noter({ epreuve: 'Rattrapage de 500 tickets depuis le navigateur, sur 4 Mbit/s', seuil: '< 60 s', mesure: `${dureeRattrapage.toFixed(1)} s`,
    tenu: dureeRattrapage < 60 && surServeur === 500 && alertes === 0, detail: `${envoi.acquittes} gestes acquittés, ${surServeur} tickets sur le serveur, ${alertes} alerte de chaîne` });

  // ── Appareil révoqué : la copie du navigateur est effacée ────────────────────────────────────
  await db.query('update proto.appareil set revoque_le = now() where id = $1', [proprioApp]);
  t = performance.now();
  const r = await nav.poste('recevoir', { appareil: proprioApp });
  const dureeEffacement = (performance.now() - t) / 1000;
  const fichiers = await nav.poste('fichiers');
  await nav.ctx.close();
  // Et après une réouverture : il ne reste rien.
  nav = await ouvrirNavigateur('proprio');
  await nav.poste('ouvrir');
  const resteTiers = await nav.poste('compter', { table: 'tiers' });
  noter({ epreuve: 'Appareil révoqué : la copie du navigateur est effacée', seuil: '< 1 min', mesure: `${dureeEffacement.toFixed(2)} s`,
    tenu: r.efface === true && dureeEffacement < 60 && resteTiers === 0,
    detail: `fichiers restants juste après : ${fichiers.length} ; fiches retrouvées à la réouverture : ${resteTiers}` });

  const erreurs = [...nav.erreurs, ...caisse.erreurs];
  if (erreurs.length) console.log('Erreurs de la page :', erreurs);

  const bilan = { date: new Date().toISOString(), candidat: 'notre chemin, poste dans le navigateur', navigateur: version, sqlite: ouverture.version, stockage: 'OPFS (opfs-sahpool)',
    machine: `${os.cpus().length} cœurs, ${(os.totalmem() / 1e9).toFixed(0)} Go`, resultats };
  fs.mkdirSync(path.join(RACINE, 'resultats'), { recursive: true });
  fs.writeFileSync(path.join(RACINE, 'resultats', 'navigateur.json'), JSON.stringify(bilan, null, 2));
  const manques = resultats.filter(x => !x.tenu).length;
  console.log(`\n${resultats.length - manques} épreuves tenues sur ${resultats.length}.`);
  await nav.ctx.close(); await caisse.ctx.close();
  page.close();
  await db.end();
  process.exit(manques ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
