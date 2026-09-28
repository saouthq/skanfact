// Le banc de « notre chemin » : les seuils du 04 § 9.3, écrits AVANT de mesurer, et jamais
// retouchés après (« un seuil dépassé change le plan, pas le seuil »).
//
//   node --experimental-strip-types --experimental-sqlite mesures/notre-chemin.ts
//   (il faut PostgreSQL 16 sur 127.0.0.1:5433, voir le README)

import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { creerServeur } from '../serveur/serveur.ts';
import { Poste } from '../poste/poste.ts';
import { brider } from '../outils/bride.ts';

const RACINE = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const SUPER = process.env.PG_SUPER || 'postgres://postgres@127.0.0.1:5433/postgres';
const APP = process.env.PG_APP || 'postgres://proto_app:proto@127.0.0.1:5433/postgres';
const PORT_SERVEUR = 7101, PORT_BRIDE = 7102;
const QUATRE_MBITS = 4_000_000 / 8; // octets par seconde

const md5uuid = async (db: pg.Client, t: string) => (await db.query('select proto.uid($1) u', [t])).rows[0].u as string;

type Resultat = { epreuve: string; seuil: string; mesure: string; tenu: boolean; detail?: string };
const resultats: Resultat[] = [];
const noter = (r: Resultat) => { resultats.push(r); console.log(`${r.tenu ? 'TENU  ' : 'MANQUÉ'}  ${r.epreuve} — ${r.mesure} (seuil : ${r.seuil})${r.detail ? ' — ' + r.detail : ''}`); };
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

async function main() {
  const db = new pg.Client({ connectionString: SUPER });
  await db.connect();
  console.log('Préparation de la base (schéma et données)…');
  await db.query(fs.readFileSync(path.join(RACINE, 'base/schema.sql'), 'utf8'));
  const t0 = performance.now();
  await db.query(fs.readFileSync(path.join(RACINE, 'base/donnees.sql'), 'utf8'));
  const volumes = (await db.query(`select (select count(*) from proto.tiers) tiers, (select count(*) from proto.article) articles,
      (select count(*) from proto.piece) pieces, (select count(*) from proto.ligne_piece) lignes, (select count(*) from proto.bulletin) bulletins`)).rows[0];
  console.log(`  données prêtes en ${((performance.now() - t0) / 1000).toFixed(1)} s :`, volumes);

  const serveur = creerServeur(APP);
  await serveur.ecouter(PORT_SERVEUR);
  const bride = brider(PORT_BRIDE, PORT_SERVEUR, QUATRE_MBITS);
  await bride.ecouter();
  const viaBride = `http://127.0.0.1:${PORT_BRIDE}`;
  const direct = `http://127.0.0.1:${PORT_SERVEUR}`;

  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'synchro-'));
  const poste = async (nom: string, cle: string, url = viaBride) => new Poste(path.join(dossier, nom + '.sqlite'), await md5uuid(db, cle), url);
  const E = { pme: await md5uuid(db, 'pme'), magasin: await md5uuid(db, 'magasin'), voisine: await md5uuid(db, 'voisine') };

  // ── 3 et 4. Première copie d'une PME sur 4 Mbit/s, et la place prise ─────────────────────────
  const proprio = await poste('proprio-1', 'a-proprio-1');
  bride.remettreAZero();
  let t = performance.now();
  const copie = await proprio.recevoir(5000);
  const dureeCopie = (performance.now() - t) / 1000;
  const octetsCopie = bride.octets();
  noter({ epreuve: 'Première copie d\'une PME (13 mois + fiches) sur 4 Mbit/s', seuil: '< 60 s', mesure: `${dureeCopie.toFixed(1)} s`,
    tenu: dureeCopie < 60, detail: `${copie.lignes} lignes, ${copie.pages} pages, ${(octetsCopie / 1e6).toFixed(1)} Mo transférés` });
  const taille = proprio.taille();
  noter({ epreuve: 'Place prise sur le poste par une PME', seuil: '< 200 Mo', mesure: `${(taille / 1e6).toFixed(1)} Mo`, tenu: taille < 200e6 });

  // ── 5. Le poste d'un commercial : 0 ligne de paie ─────────────────────────────────────────
  const commercial = await poste('commercial', 'a-commercial', direct);
  await commercial.recevoir(5000);
  const paieCommercial = commercial.compter('bulletin');
  const paiePaie = await (async () => { const p = await poste('paie', 'a-paie', direct); await p.recevoir(5000); const n = p.compter('bulletin'); p.fermer(); return n; })();
  const voisin = await poste('voisin', 'a-voisin', direct);
  await voisin.recevoir(5000);
  const fuiteVoisine = (voisin.base_compter_entreprise(E.pme)) + (proprio.base_compter_entreprise(E.voisine));
  noter({ epreuve: 'Poste d\'un commercial : lignes de paie reçues', seuil: '0', mesure: String(paieCommercial), tenu: paieCommercial === 0,
    detail: `le poste « paie » en reçoit ${paiePaie} (contrôle : la paie existe bien) ; lignes d'une autre entreprise reçues : ${fuiteVoisine}` });
  const isolation = fuiteVoisine === 0 && paiePaie > 0;
  noter({ epreuve: 'Aucune ligne d\'une autre entreprise, par la même porte', seuil: '0', mesure: String(fuiteVoisine), tenu: isolation });

  // ── 1. Encaisser un ticket hors ligne ──────────────────────────────────────────────────────
  const caisse = await poste('caisse', 'a-caisse');
  const idCaisse = randomUUID();
  const durees: number[] = [];
  for (let i = 0; i < 500; i++) {
    t = performance.now();
    caisse.encaisser(E.magasin, idCaisse, 1000 + i * 37);
    durees.push(performance.now() - t);
  }
  noter({ epreuve: 'Encaisser un ticket hors ligne (500 tickets)', seuil: '< 200 ms', mesure: `max ${quantile(durees, 1).toFixed(1)} ms`,
    tenu: quantile(durees, 1) < 200, detail: `médiane ${quantile(durees, 0.5).toFixed(2)} ms, 95 % sous ${quantile(durees, 0.95).toFixed(2)} ms ; chaque ticket et son geste écrits sur disque ensemble` });

  // ── 2. Rattrapage d'une journée de coupure (500 tickets) ──────────────────────────────────
  bride.remettreAZero();
  t = performance.now();
  const envoi = await caisse.envoyer(500);
  const reception = await caisse.recevoir(5000);
  const dureeRattrapage = (performance.now() - t) / 1000;
  const chaine = (await db.query('select count(*) n from proto.ticket where entreprise = $1', [E.magasin])).rows[0].n;
  const alertes = (await db.query(`select count(*) n from proto.a_reprendre where raison like 'chaîne%'`)).rows[0].n;
  noter({ epreuve: 'Rattrapage après une journée de coupure (500 tickets) sur 4 Mbit/s', seuil: '< 60 s', mesure: `${dureeRattrapage.toFixed(1)} s`,
    tenu: dureeRattrapage < 60 && Number(chaine) === 500 && Number(alertes) === 0,
    detail: `${envoi.acquittes} gestes acquittés, ${chaine} tickets sur le serveur, ${alertes} alerte de chaîne, ${reception.lignes} lignes redescendues, ${(bride.octets() / 1e3).toFixed(0)} ko` });

  // ── 7. Un même geste envoyé trois fois ────────────────────────────────────────────────────
  caisse.encaisser(E.magasin, idCaisse, 4242);
  const op = caisse.premiereOperation();
  const statuts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await fetch(direct + '/operations', { method: 'POST', headers: { 'content-type': 'application/json', 'x-appareil': caisse.appareil }, body: JSON.stringify({ ops: [op] }) });
    statuts.push((await r.json()).resultats[0].statut);
  }
  const comptes = (await db.query('select count(*) n from proto.ticket where id = $1', [op.donnees.id])).rows[0].n;
  noter({ epreuve: 'Un même geste envoyé trois fois', seuil: 'compté une fois', mesure: `${comptes} ticket`,
    tenu: Number(comptes) === 1 && statuts.join(',') === 'accepte,deja,deja', detail: `réponses : ${statuts.join(', ')}` });
  await caisse.envoyer(); // la file du poste se vide normalement : le serveur répond « déjà »

  // ── 9. Une file écrite par la version précédente de l'application ─────────────────────────
  const { numero } = caisse.encaisser(E.magasin, idCaisse, 7777, 1);
  const env9 = await caisse.envoyer();
  const t9 = (await db.query('select total_millimes from proto.ticket where caisse = $1 and numero = $2', [idCaisse, numero])).rows[0];
  noter({ epreuve: 'Une file écrite par la version précédente de l\'application', seuil: 'acceptée', mesure: env9.resultats.map((r: any) => r.statut).join(', '),
    tenu: env9.resultats[0]?.statut === 'accepte' && Number(t9?.total_millimes) === 7777, detail: `total relu sur le serveur : ${t9?.total_millimes} millimes` });

  // ── 8. Deux postes modifient le même brouillon hors ligne ─────────────────────────────────
  const proprio2 = await poste('proprio-2', 'a-proprio-2', direct);
  await proprio2.recevoir(5000);
  await proprio.recevoir(5000);
  const brouillon = (await db.query(`select id from proto.piece where entreprise = $1 and statut = 'brouillon' limit 1`, [E.pme])).rows[0].id;
  proprio.modifierBrouillon(brouillon, 'Version du poste 1', 111000);
  proprio2.modifierBrouillon(brouillon, 'Version du poste 2', 222000);
  const r1 = await proprio.envoyer();
  const r2 = await proprio2.envoyer();
  const surServeur = (await db.query('select note from proto.piece where id = $1', [brouillon])).rows[0].note;
  const deCote = (await db.query(`select version_mise_de_cote v from proto.a_reprendre where objet = $1`, ['pièce ' + brouillon])).rows;
  await proprio2.recevoir(5000);
  const voitDeCote = proprio2.compter('a_reprendre');
  noter({ epreuve: 'Deux postes modifient le même brouillon hors ligne', seuil: 'une version gardée, l\'autre dans « À reprendre », aucune perdue',
    mesure: `gardée : « ${surServeur} » ; mise de côté : ${deCote.length}`,
    tenu: surServeur === 'Version du poste 1' && deCote.length === 1 && deCote[0].v.note === 'Version du poste 2' && voitDeCote >= 1,
    detail: `réponses ${r1.resultats[0]?.statut} puis ${r2.resultats[0]?.statut} ; le poste 2 voit ${voitDeCote} ligne dans « À reprendre »` });

  // En plus : une fiche se fusionne champ par champ (04 § 5).
  const client1 = (await db.query('select id from proto.tiers where entreprise = $1 limit 1', [E.pme])).rows[0].id;
  proprio.modifierTiers(client1, { telephone: '+216 71 000 001' });
  proprio2.modifierTiers(client1, { adresse: '9 avenue Habib Bourguiba, Tunis' });
  await proprio.envoyer(); await proprio2.envoyer();
  const fiche = (await db.query('select telephone, adresse from proto.tiers where id = $1', [client1])).rows[0];
  noter({ epreuve: 'Une fiche modifiée sur deux postes, deux champs différents', seuil: 'les deux changements gardés', mesure: `${fiche.telephone} / ${fiche.adresse}`,
    tenu: fiche.telephone === '+216 71 000 001' && fiche.adresse === '9 avenue Habib Bourguiba, Tunis' });

  // ── En plus : des écritures simultanées pendant qu'un poste lit ───────────────────────────
  // Le piège de « tout ce qui a changé depuis N » : une écriture qui prend le numéro 100, une
  // autre le 101 et qui valide AVANT elle ; le lecteur retient 101 et ne verra jamais 100. Huit
  // postes écrivent en même temps pendant qu'un neuvième lit sans arrêt ; à la fin, sa copie doit
  // être exactement celle du serveur.
  const ecrivains = await Promise.all(Array.from({ length: 8 }, async (_, i) => {
    await db.query('insert into proto.appareil values ($1, proto.uid($2), null) on conflict do nothing', [await md5uuid(db, 'a-ecrivain-' + i), 'm-proprio']);
    const p = await poste('ecrivain-' + i, 'a-ecrivain-' + i, direct);
    await p.recevoir(5000);
    return p;
  }));
  const lecteur = await poste('lecteur', 'a-proprio-2', direct);
  lecteur.fermer();
  const lecteur2 = proprio2;
  const clients = (await db.query('select id from proto.tiers where entreprise = $1 order by id limit 400', [E.pme])).rows.map((r: any) => r.id);
  let enCours = true;
  const lecture = (async () => { let tours = 0; while (enCours) { await lecteur2.recevoir(5000); tours++; } return tours; })();
  await Promise.all(ecrivains.map(async (p, i) => {
    for (let k = 0; k < 25; k++) {
      for (let j = 0; j < 2; j++) p.modifierTiers(clients[(i * 50 + k * 2 + j) % clients.length], { telephone: `+216 ${i}${k}${j} 000` });
      await p.envoyer();
    }
  }));
  enCours = false;
  const tours = await lecture;
  await lecteur2.recevoir(5000);
  const serveurTel = new Map((await db.query('select id, telephone from proto.tiers where entreprise = $1', [E.pme])).rows.map((r: any) => [r.id, r.telephone]));
  const ecarts = lecteur2.tiersTelephones().filter(([id, tel]) => serveurTel.get(id) !== tel).length;
  noter({ epreuve: 'Écritures simultanées de 8 postes pendant qu\'un 9e lit', seuil: 'copie identique au serveur', mesure: `${ecarts} fiche différente`,
    tenu: ecarts === 0, detail: `${tours} lectures pendant les écritures, 400 envois de 2 gestes` });
  for (const p of ecrivains) p.fermer();

  // ── 6. Appareil révoqué : données effacées après la reconnexion ───────────────────────────
  const vole = await poste('vole', 'a-vole', viaBride);
  await vole.recevoir(5000);
  vole.modifierTiers(client1, { nom: 'Geste fait par le voleur' });
  await db.query('update proto.appareil set revoque_le = now() where id = $1', [vole.appareil]);
  t = performance.now();
  await vole.envoyer();
  const dureeEffacement = (performance.now() - t) / 1000;
  const fichierParti = !fs.existsSync(path.join(dossier, 'vole.sqlite'));
  const quarantaine = (await db.query(`select count(*) n from proto.a_reprendre where raison like 'appareil révoqué%'`)).rows[0].n;
  const nomIntact = (await db.query('select nom from proto.tiers where id = $1', [client1])).rows[0].nom !== 'Geste fait par le voleur';
  noter({ epreuve: 'Appareil révoqué : données effacées après la reconnexion', seuil: '< 1 min', mesure: `${dureeEffacement.toFixed(2)} s`,
    tenu: vole.efface && fichierParti && dureeEffacement < 60 && Number(quarantaine) === 1 && nomIntact,
    detail: `copie effacée : ${fichierParti ? 'oui' : 'NON'} ; gestes en quarantaine : ${quarantaine} ; appliqués d'office : ${nomIntact ? 'aucun' : 'UN'}` });

  // ── Bilan ──────────────────────────────────────────────────────────────────────────────────
  const bilan = { date: new Date().toISOString(), candidat: 'notre chemin', machine: `${os.cpus().length} cœurs, ${(os.totalmem() / 1e9).toFixed(0)} Go`, volumes, resultats };
  fs.mkdirSync(path.join(RACINE, 'resultats'), { recursive: true });
  fs.writeFileSync(path.join(RACINE, 'resultats', 'notre-chemin.json'), JSON.stringify(bilan, null, 2));
  const manques = resultats.filter(r => !r.tenu).length;
  console.log(`\n${resultats.length - manques} épreuves tenues sur ${resultats.length}.`);
  for (const p of [proprio, proprio2, commercial, voisin, caisse]) p.fermer();
  await db.end();
  process.exit(manques ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
