// Le banc de PowerSync : les MÊMES seuils que « notre chemin » (04 § 9.3), les mêmes données, la
// même connexion bridée à 4 Mbit/s. Seuls changent les épreuves que PowerSync ne fait pas lui-même :
// ses écritures passent par NOTRE serveur (uploadData appelle notre API), si bien que le geste
// envoyé trois fois, le brouillon modifié sur deux postes et la version précédente de la file sont
// le même code dans les deux candidats. Ce banc mesure donc ce qui les distingue : la lecture,
// la paie cachée, l'isolation, la révocation, et le rattrapage de la caisse à travers PowerSync.
//
//   node --experimental-strip-types --experimental-sqlite mesures/powersync.ts
//   (il faut PostgreSQL 16 sur 127.0.0.1:5433 avec wal_level = logical, et Docker ; voir le README)

// Tout ce banc parle à la machine elle-même : aucun relais sortant.
for (const v of ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[v];

import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHmac, createHash, randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PowerSyncDatabase, Schema, Table, column } from '@powersync/node';
import { creerServeur } from '../serveur/serveur.ts';
import { brider } from '../outils/bride.ts';

const RACINE = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const SUPER = process.env.PG_SUPER || 'postgres://postgres@127.0.0.1:5433/postgres';
const APP = process.env.PG_APP || 'postgres://proto_app:proto@127.0.0.1:5433/postgres';
const PORT_SERVEUR = 7101, PORT_BRIDE_SERVEUR = 7102, PORT_POWERSYNC = 8080, PORT_BRIDE_PS = 7103;
const QUATRE_MBITS = 4_000_000 / 8;
// La durée d'un jeton : 5 minutes, une valeur courante (plus court = plus d'allers-retours).
const DUREE_JETON = Number(process.env.DUREE_JETON || 300);
const CLE = randomBytes(32); // tirée à chaque mesure : aucun secret dans le dépôt
const CONTENEUR = 'ps-proto';

type Resultat = { epreuve: string; seuil: string; mesure: string; tenu: boolean; detail?: string };
const resultats: Resultat[] = [];
const noter = (r: Resultat) => { resultats.push(r); console.log(`${r.tenu ? 'TENU  ' : 'MANQUÉ'}  ${r.epreuve} — ${r.mesure} (seuil : ${r.seuil})${r.detail ? ' — ' + r.detail : ''}`); };
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const pause = (ms: number) => new Promise(ok => setTimeout(ok, ms));

// Le schéma côté poste : PowerSync le veut déclaré (colonnes texte, entier, réel).
const t = column.text, n = column.integer;
const SCHEMA = new Schema({
  tiers: new Table({ entreprise: t, nom: t, telephone: t, adresse: t, champs_rev: t, supprime: n, revision: n }),
  article: new Table({ entreprise: t, designation: t, prix_millimes: n, tva_pourmille: n, supprime: n, revision: n }),
  piece: new Table({ entreprise: t, type: t, statut: t, numero: t, tiers: t, jour: t, total_millimes: n, note: t, supprime: n, revision: n }),
  ligne_piece: new Table({ entreprise: t, piece: t, article: t, designation: t, quantite_milliemes: n, prix_millimes: n, supprime: n, revision: n }),
  ticket: new Table({ entreprise: t, caisse: t, numero: n, instant: t, total_millimes: n, empreinte: t, precedente: t, supprime: n, revision: n }),
  bulletin: new Table({ entreprise: t, salarie: t, mois: t, brut_millimes: n, net_millimes: n, supprime: n, revision: n }),
  a_reprendre: new Table({ entreprise: t, operation: t, objet: t, raison: t, version_mise_de_cote: t, supprime: n, revision: n }),
});
const TABLES = ['tiers', 'article', 'piece', 'ligne_piece', 'ticket', 'bulletin', 'a_reprendre'];

const b64 = (x: Buffer | string) => Buffer.from(x).toString('base64url');

async function main() {
  const db = new pg.Client({ connectionString: SUPER });
  await db.connect();

  // ── Préparation : mêmes données que « notre chemin », puis PowerSync branché dessus ────────
  console.log('Préparation de la base (schéma et données)…');
  await db.query(`drop publication if exists powersync`);
  for (const r of (await db.query(`select slot_name from pg_replication_slots where slot_name like 'powersync%'`)).rows) {
    await db.query('select pg_drop_replication_slot($1)', [r.slot_name]).catch(() => {});
  }
  try { execFileSync('docker', ['rm', '-f', CONTENEUR], { stdio: 'ignore' }); } catch { /* pas encore lancé */ }
  await db.query(fs.readFileSync(path.join(RACINE, 'base/schema.sql'), 'utf8'));
  await db.query(fs.readFileSync(path.join(RACINE, 'base/donnees.sql'), 'utf8'));
  // PowerSync lit par la réplication logique : il lui faut un rôle qui PASSE AU-DESSUS de la
  // sécurité par ligne. C'est le cœur de l'objection du 04 § 9.2.
  await db.query(`do $$ begin
      if not exists (select from pg_roles where rolname = 'ps_replique') then
        create role ps_replique login replication bypassrls password 'ps';
      end if; end $$;
    grant usage on schema proto to ps_replique;
    grant select on all tables in schema proto to ps_replique;
    create publication powersync for table proto.tiers, proto.article, proto.piece, proto.ligne_piece, proto.ticket, proto.bulletin, proto.a_reprendre;`);
  await db.query('drop database if exists ps_stockage with (force)');
  await db.query('create database ps_stockage owner ps_replique');

  execFileSync('docker', ['run', '-d', '--name', CONTENEUR, '--network', 'host',
    '-v', `${path.join(RACINE, 'powersync')}:/config`,
    '-e', 'POWERSYNC_CONFIG_PATH=/config/service.yaml',
    '-e', 'PS_DATA_SOURCE_URI=postgres://ps_replique:ps@127.0.0.1:5433/postgres',
    '-e', 'PS_STORAGE_SOURCE_URI=postgres://ps_replique:ps@127.0.0.1:5433/ps_stockage',
    '-e', `PS_PORT=${PORT_POWERSYNC}`, '-e', `PS_JWT_K=${b64(CLE)}`,
    'journeyapps/powersync-service:latest', 'start', '-r', 'unified'], { stdio: 'ignore' });
  const tDepart = performance.now();
  for (;;) {
    const logs = execFileSync('docker', ['logs', CONTENEUR], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (logs.includes('Activated new replication stream')) break;
    if (logs.includes('Fatal startup error')) throw new Error('PowerSync ne démarre pas :\n' + logs.slice(-2000));
    if (performance.now() - tDepart > 300_000) throw new Error('PowerSync n\'a pas fini sa copie initiale en 5 minutes');
    await pause(500);
  }
  const copieServeur = (performance.now() - tDepart) / 1000;
  console.log(`  PowerSync a lu la base en ${copieServeur.toFixed(1)} s`);

  // Notre serveur reste là : il délivre les jetons (c'est lui qui connaît les appareils et les
  // rôles) et reçoit les écritures.
  const serveur = creerServeur(APP);
  await serveur.ecouter(PORT_SERVEUR);
  const brideServeur = brider(PORT_BRIDE_SERVEUR, PORT_SERVEUR, QUATRE_MBITS);
  const bridePS = brider(PORT_BRIDE_PS, PORT_POWERSYNC, QUATRE_MBITS);
  await brideServeur.ecouter(); await bridePS.ecouter();

  const uid = async (texte: string) => (await db.query('select proto.uid($1) u', [texte])).rows[0].u as string;
  const E = { pme: await uid('pme'), magasin: await uid('magasin'), voisine: await uid('voisine') };

  // Le jeton : ce que NOTRE serveur devrait calculer et signer pour PowerSync. Le rôle y est
  // traduit en « paie: oui/non » : c'est la règle de la paie écrite une seconde fois.
  const jetonPour = async (appareil: string) => {
    const r = (await db.query(`select a.revoque_le, m.entreprise, m.role from proto.appareil a join proto.membre m on m.id = a.membre where a.id = $1`, [appareil])).rows[0];
    if (!r || r.revoque_le) return null;
    const maintenant = Math.floor(Date.now() / 1000);
    const entete = b64(JSON.stringify({ alg: 'HS256', kid: 'prototype', typ: 'JWT' }));
    const corps = b64(JSON.stringify({ sub: appareil, aud: 'powersync', iat: maintenant, exp: maintenant + DUREE_JETON,
      entreprise: r.entreprise, paie: ['proprietaire', 'paie'].includes(r.role) }));
    return `${entete}.${corps}.${b64(createHmac('sha256', CLE).update(`${entete}.${corps}`).digest())}`;
  };

  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'synchro-ps-'));
  type Poste = { base: PowerSyncDatabase; appareil: string; fichier: string; efface: boolean; seq: number };
  const ouvrir = async (nom: string, cle: string, url = `http://127.0.0.1:${PORT_BRIDE_PS}`, serveurEcriture = `http://127.0.0.1:${PORT_BRIDE_SERVEUR}`) => {
    const appareil = await uid(cle);
    const fichier = nom + '.sqlite';
    const base = new PowerSyncDatabase({ schema: SCHEMA, database: { dbFilename: fichier, dbLocation: dossier } });
    const poste: Poste = { base, appareil, fichier: path.join(dossier, fichier), efface: false, seq: 0 };
    const connecteur = {
      fetchCredentials: async () => {
        const token = await jetonPour(appareil);
        if (!token) {
          // Refus : l'appareil est révoqué. C'est à NOTRE code d'effacer la copie.
          if (!poste.efface) { poste.efface = true; setTimeout(() => { base.disconnectAndClear().catch(() => {}); }, 0); }
          return null;
        }
        return { endpoint: url, token };
      },
      // Les écritures remontent par NOTRE file d'opérations (04 § 9.1), comme dans « notre chemin ».
      uploadData: async (b: any) => {
        const lot = await b.getCrudBatch(500);
        if (!lot) return;
        const ops = lot.crud.map((c: any) => {
          if (c.table !== 'ticket' || c.op !== 'PUT') throw new Error('geste non prévu par le banc : ' + c.table + ' ' + c.op);
          const d = c.opData;
          return { id: c.id, seq: ++poste.seq, format: 2, type: 'ticket.encaisser',
            donnees: { id: c.id, caisse: d.caisse, numero: d.numero, instant: d.instant, empreinte: d.empreinte, precedente: d.precedente, total_millimes: d.total_millimes } };
        });
        const r = await fetch(serveurEcriture + '/operations', { method: 'POST', headers: { 'content-type': 'application/json', 'x-appareil': appareil }, body: JSON.stringify({ ops }) });
        if (!r.ok) throw new Error('/operations : ' + r.status);
        await lot.complete();
      },
    };
    return { poste, connecter: () => base.connect(connecteur as any), };
  };
  const compter = async (p: Poste, table: string, ou = '', args: any[] = []) => Number((await p.base.get<any>(`select count(*) n from ${table} ${ou}`, args)).n);
  const tailleFichier = (f: string) => [f, f + '-wal'].reduce((s, x) => s + (fs.existsSync(x) ? fs.statSync(x).size : 0), 0);

  // ── 3 et 4. Première copie d'une PME sur 4 Mbit/s, et la place prise ─────────────────────────
  const proprio = await ouvrir('proprio', 'a-proprio-1');
  bridePS.remettreAZero();
  let t0 = performance.now();
  await proprio.connecter();
  await proprio.poste.base.waitForFirstSync();
  const dureeCopie = (performance.now() - t0) / 1000;
  const octetsCopie = bridePS.octets();
  let lignes = 0;
  for (const tb of TABLES) lignes += await compter(proprio.poste, tb);
  noter({ epreuve: 'Première copie d\'une PME (13 mois + fiches) sur 4 Mbit/s', seuil: '< 60 s', mesure: `${dureeCopie.toFixed(1)} s`,
    tenu: dureeCopie < 60, detail: `${lignes} lignes, ${(octetsCopie / 1e6).toFixed(1)} Mo transférés` });
  await pause(1000);
  const taille = tailleFichier(proprio.poste.fichier);
  noter({ epreuve: 'Place prise sur le poste par une PME', seuil: '< 200 Mo', mesure: `${(taille / 1e6).toFixed(1)} Mo`, tenu: taille < 200e6,
    detail: 'PowerSync garde chaque ligne en JSON, plus son journal d\'opérations' });

  // ── 5. La paie et l'entreprise d'à côté ────────────────────────────────────────────────────
  const direct = `http://127.0.0.1:${PORT_POWERSYNC}`;
  const commercial = await ouvrir('commercial', 'a-commercial', direct);
  const paie = await ouvrir('paie', 'a-paie', direct);
  const voisin = await ouvrir('voisin', 'a-voisin', direct);
  for (const p of [commercial, paie, voisin]) { await p.connecter(); await p.poste.base.waitForFirstSync(); }
  const paieCommercial = await compter(commercial.poste, 'bulletin');
  const paiePaie = await compter(paie.poste, 'bulletin');
  let fuite = 0;
  for (const tb of TABLES) fuite += await compter(voisin.poste, tb, 'where entreprise = ?', [E.pme]) + await compter(proprio.poste, tb, 'where entreprise = ?', [E.voisine]);
  noter({ epreuve: 'Poste d\'un commercial : lignes de paie reçues', seuil: '0', mesure: String(paieCommercial), tenu: paieCommercial === 0 && paiePaie > 0,
    detail: `le poste « paie » en reçoit ${paiePaie} ; mais la règle vit ici en double (sync-config.yaml ET la base)` });
  noter({ epreuve: 'Aucune ligne d\'une autre entreprise', seuil: '0', mesure: String(fuite), tenu: fuite === 0 });

  // ── 1. Encaisser un ticket hors ligne (à travers la base locale de PowerSync) ──────────────
  const caisse = await ouvrir('caisse', 'a-caisse');
  // La base locale s'ouvre au lancement de l'application, pas au premier ticket : comme dans
  // « notre chemin » (le Poste s'ouvre avant le chronomètre), l'ouverture n'est pas comptée.
  // La première mesure l'avait comptée (702 ms sur le premier ticket) : on la note à part.
  const tOuverture = performance.now();
  await caisse.poste.base.init();
  await caisse.poste.base.get('select 1');
  const ouvertureCaisse = performance.now() - tOuverture;
  const idCaisse = randomUUID();
  const durees: number[] = [];
  let avant = { numero: 0, empreinte: 'origine' };
  for (let i = 0; i < 500; i++) {
    const t1 = performance.now();
    await caisse.poste.base.writeTransaction(async (tx) => {
      const numero = avant.numero + 1;
      const instant = new Date().toISOString();
      const total = 1000 + i * 37;
      const empreinte = createHash('sha256').update([avant.empreinte, idCaisse, numero, instant, total].join('|')).digest('hex');
      await tx.execute(`insert into ticket (id, entreprise, caisse, numero, instant, total_millimes, empreinte, precedente, supprime, revision) values (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [randomUUID(), E.magasin, idCaisse, numero, instant, total, empreinte, avant.empreinte]);
      avant = { numero, empreinte };
    });
    durees.push(performance.now() - t1);
  }
  noter({ epreuve: 'Encaisser un ticket hors ligne (500 tickets)', seuil: '< 200 ms', mesure: `max ${quantile(durees, 1).toFixed(1)} ms`,
    tenu: quantile(durees, 1) < 200, detail: `médiane ${quantile(durees, 0.5).toFixed(2)} ms, 95 % sous ${quantile(durees, 0.95).toFixed(2)} ms ; premier ticket ${durees[0].toFixed(1)} ms ; ouverture de la base au lancement ${ouvertureCaisse.toFixed(0)} ms (non comptée)` });

  // ── 2. Rattrapage : la caisse se reconnecte, 500 tickets montent par notre file et redescendent
  bridePS.remettreAZero(); brideServeur.remettreAZero();
  t0 = performance.now();
  await caisse.connecter();
  for (;;) {
    const enAttente = await compter(caisse.poste, 'ps_crud');
    const surServeur = Number((await db.query('select count(*) n from proto.ticket where caisse = $1', [idCaisse])).rows[0].n);
    const st = caisse.poste.base.currentStatus;
    if (enAttente === 0 && surServeur === 500 && st.hasSynced && !st.dataFlowStatus?.downloading && !st.dataFlowStatus?.uploading) break;
    if (performance.now() - t0 > 180_000) break;
    await pause(50);
  }
  const dureeRattrapage = (performance.now() - t0) / 1000;
  const surServeur = Number((await db.query('select count(*) n from proto.ticket where caisse = $1', [idCaisse])).rows[0].n);
  const alertes = Number((await db.query(`select count(*) n from proto.a_reprendre where raison like 'chaîne%'`)).rows[0].n);
  noter({ epreuve: 'Rattrapage après une journée de coupure (500 tickets) sur 4 Mbit/s', seuil: '< 60 s', mesure: `${dureeRattrapage.toFixed(1)} s`,
    tenu: dureeRattrapage < 60 && surServeur === 500 && alertes === 0,
    detail: `${surServeur} tickets sur le serveur, ${alertes} alerte de chaîne ; ${((bridePS.octets() + brideServeur.octets()) / 1e3).toFixed(0)} ko (montée par notre file, descente par PowerSync)` });

  // ── En plus : un changement fait au serveur arrive sur un poste connecté ────────────────────
  const idNouveau = randomUUID();
  t0 = performance.now();
  await db.query(`insert into proto.tiers (id, entreprise, nom) values ($1, $2, 'Client créé au bureau')`, [idNouveau, E.pme]);
  while (await compter(proprio.poste, 'tiers', 'where id = ?', [idNouveau]) === 0 && performance.now() - t0 < 30_000) await pause(20);
  const propagation = performance.now() - t0;
  console.log(`  (information) un changement du serveur arrive sur un poste connecté en ${propagation.toFixed(0)} ms, sans qu'il le demande`);

  // ── 6. Appareil révoqué ────────────────────────────────────────────────────────────────────
  // L'appareil volé est connecté avec un jeton valide. On le révoque, puis le bureau crée un
  // client : le voleur le reçoit-il ? Et combien de temps avant que sa copie soit effacée ?
  const vole = await ouvrir('vole', 'a-vole');
  await vole.connecter();
  await vole.poste.base.waitForFirstSync();
  await db.query('update proto.appareil set revoque_le = now() where id = $1', [vole.poste.appareil]);
  const tRevoque = performance.now();
  const idApres = randomUUID();
  await db.query(`insert into proto.tiers (id, entreprise, nom, telephone) values ($1, $2, 'Client créé APRÈS la révocation', '+216 98 765 432')`, [idApres, E.pme]);
  let recuApres = false;
  let dureeEffacement = NaN;
  const limite = (DUREE_JETON + 90) * 1000;
  while (performance.now() - tRevoque < limite) {
    if (!vole.poste.efface && !recuApres) {
      try { recuApres = (await compter(vole.poste, 'tiers', 'where id = ?', [idApres])) > 0; } catch { /* base en cours d'effacement */ }
    }
    if (vole.poste.efface) {
      // L'effacement est lancé : on attend qu'il ait vraiment vidé les tables.
      try { if ((await compter(vole.poste, 'tiers')) === 0) { dureeEffacement = (performance.now() - tRevoque) / 1000; break; } } catch { /* idem */ }
    }
    await pause(200);
  }
  noter({ epreuve: 'Appareil révoqué : données effacées après la reconnexion', seuil: '< 1 min',
    mesure: Number.isNaN(dureeEffacement) ? `pas effacé en ${(limite / 1000).toFixed(0)} s` : `${dureeEffacement.toFixed(1)} s`,
    tenu: !Number.isNaN(dureeEffacement) && dureeEffacement < 60 && !recuApres,
    detail: `client créé après la révocation reçu par l'appareil volé : ${recuApres ? 'OUI' : 'non'} ; jeton de ${DUREE_JETON} s : c'est lui qui fixe le délai` });

  // ── Bilan ──────────────────────────────────────────────────────────────────────────────────
  const version = execFileSync('docker', ['logs', CONTENEUR], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).match(/PowerSync Service v([\d.]+)/)?.[1];
  const bilan = { date: new Date().toISOString(), candidat: `PowerSync ${version} (Open Edition, auto-hébergé), client @powersync/node`,
    machine: `${os.cpus().length} cœurs, ${(os.totalmem() / 1e9).toFixed(0)} Go`, copieServeur_s: copieServeur, propagation_ms: Math.round(propagation), duree_jeton_s: DUREE_JETON, resultats };
  fs.mkdirSync(path.join(RACINE, 'resultats'), { recursive: true });
  fs.writeFileSync(path.join(RACINE, 'resultats', `powersync-jeton-${DUREE_JETON}s.json`), JSON.stringify(bilan, null, 2));
  const manques = resultats.filter(r => !r.tenu).length;
  console.log(`\n${resultats.length - manques} épreuves tenues sur ${resultats.length}.`);
  for (const p of [proprio, commercial, paie, voisin, caisse, vole]) await p.poste.base.close().catch(() => {});
  execFileSync('docker', ['rm', '-f', CONTENEUR], { stdio: 'ignore' });
  await db.end();
  process.exit(manques ? 1 : 0);
}

main().catch((e) => { console.error(e); try { execFileSync('docker', ['rm', '-f', CONTENEUR], { stdio: 'ignore' }); } catch { /* rien */ } process.exit(2); });
