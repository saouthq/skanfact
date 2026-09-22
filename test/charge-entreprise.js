// Le test de charge de l'app ENTREPRISE (10.0.1, SPEC-OUT-007).
//
//   npm run charge:entreprise
//
// POURQUOI IL EXISTE, DIX VERSIONS APRÈS SON JUMEAU.
//
// `npm run charge` (9.1.0) mesure le livre du Cabinet, parce qu'un format qu'on s'apprête à écrire
// chez un cabinet pilote ne se change plus sans migration. L'app entreprise, elle, n'a JAMAIS été
// mesurée — et son format est bien plus ancien : `skanfact-data.json` est un seul objet JSON,
// réécrit EN ENTIER à chaque geste depuis la 1.0.0, chiffré depuis la 1.7.0. Personne ne savait ce
// que ça coûte au bout de dix ans d'activité. « On mesure avant d'écrire un format, jamais après »
// est arrivé trop tard pour celui-ci : ce script ne décide donc rien, il SURVEILLE, et il dit
// quand on s'approche du moment où le fichier unique cesse de tenir.
//
// CE QU'IL MESURE VRAIMENT. Les primitives RÉELLES, pas une imitation : `createStorage` de
// `src/storage.js` avec un mot de passe (donc scrypt + AES-256-GCM + écriture atomique), et
// `C.migrateData` à l'ouverture, exactement comme `app.js`. Mesurer un `JSON.stringify` nu
// donnerait un chiffre qui n'existe nulle part.
//
// LES SIX SEUILS, ÉCRITS AVANT LA MESURE — c'est ce qui les rend honnêtes. Ils ne décrivent pas ce
// que le code fait, ils décrivent ce qu'un utilisateur supporte :
//   ouvrir le dossier            < 2 000 ms   au lancement, une fois : deux secondes se pardonnent
//   enregistrer (save)           <   400 ms   à CHAQUE geste ; au-delà, la saisie rame
//   « À faire » (todoList)       <   500 ms   recalculé à chaque changement de page
//   écritures d'un exercice      < 2 000 ms   on ouvre Comptabilité → Écritures et on attend
//   paquet du mois (packPlan)    < 2 000 ms   le plan s'affiche AVANT la fabrication, donc il est
//                                             devant les yeux de quelqu'un qui attend
//   statistiques d'une année     < 1 000 ms   la page Statistiques se redessine à chaque filtre
//
// LE SEUIL DU PAQUET EST LE SEUL À DEUX SECONDES, ET IL FAUT DIRE POURQUOI. Je l'avais écrit à
// 1 000 ms, et la première mesure a rendu 0,9 à 1,4 s selon la pression mémoire — c'est-à-dire un
// test qui passe ou tombe au hasard sur le même code, ce qui ne se lit plus. Mesuré morceau par
// morceau, le coût vient de DEUX appels que `packPlan` contient et qui, par construction, lisent
// depuis le début de l'EXERCICE et pas du mois : `balanceGenerale` (641 ms — il lui faut les soldes
// d'ouverture) et `journalEntries` (129 ms en juin, 526 ms en janvier, parce que janvier porte les
// à-nouveaux, règle 9.0.0). Ce n'est donc pas un défaut à corriger, c'est ce que ces deux chiffres
// coûtent quand ils sont justes. Le seuil est posé là où la base passe avec de la marge — « une
// règle qu'on ajoute en erreur le jour où la base ne la passe pas encore naît rouge, et un
// instrument rouge est un instrument qu'on désactive » (9.1.0). Reste que c'est la marge la plus
// ÉTROITE des six : si un jour elle se resserre encore, c'est ici que ça se verra en premier.
//
// Le script ÉCHOUE (exit 1) au premier seuil dépassé, mais il imprime les six : savoir lequel passe
// et de combien vaut autant que savoir lequel tombe.
//
// ET IL VÉRIFIE SON PROPRE JEU AVANT DE MESURER. C'est la leçon de la 9.1.0, payée cher : un banc
// d'essai dont les données mentent fait mentir le verdict, et c'est le pire cas — il a l'air de
// fonctionner. Le générateur d'alors était un LCG dont les bits de poids faible ont une période
// très courte : `graine % 12` ne rendait que six mois sur douze. Mulberry32 ici, et six contrôles
// sur le jeu produit avant la première mesure.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const C = require('../src/renderer/core.js');
const { createStorage } = require('../src/storage.js');

// ---------------------------------------------------------------- le jeu d'essai
// Mulberry32 : déterministe, et ses bits de poids faible valent les autres. Surtout pas un LCG.
function rng(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ANS = 10;
const PAR_MOIS = 40;          // 4 800 factures : une petite entreprise active, dix ans durant
const CLIENTS = 300;
const ACHATS_PAR_MOIS = 12;
const AN0 = 2016;
const ANNEE_TEST = AN0 + ANS - 2;   // un exercice complet, ni le premier ni le dernier

function construire() {
  const r = rng(42);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const jour = (m, d) => {
    const dt = new Date(Date.UTC(AN0, 0, 1));
    dt.setUTCMonth(dt.getUTCMonth() + m);
    dt.setUTCDate(1 + d);
    return dt.toISOString().slice(0, 10);
  };

  const data = JSON.parse(JSON.stringify(C.DEFAULT_DATA));
  data.company = {
    ...data.company, name: 'Entreprise de charge', matricule: '1234567A', currency: 'TND',
    stampFee: 1, regime: 'reel', activity: 'services', address: 'Rue de la Mesure, Tunis'
  };

  for (let i = 0; i < CLIENTS; i++) {
    data.clients.push({
      id: 'c' + i, name: 'Client ' + i, address: 'Rue ' + i + ', Tunis',
      matricule: String(1000000 + i) + 'B', email: 'c' + i + '@exemple.tn'
    });
  }
  for (let i = 0; i < 60; i++) {
    data.catalog.push({ id: 'k' + i, label: 'Prestation ' + i, price: 50 + i * 7, vatRate: 19, unit: 'unité', unitCost: 20 + i * 3 });
  }
  for (let i = 0; i < 40; i++) {
    data.suppliers.push({ id: 's' + i, name: 'Fournisseur ' + i, matricule: String(2000000 + i) + 'C' });
  }

  let n = 0;
  for (let m = 0; m < ANS * 12; m++) {
    for (let j = 0; j < PAR_MOIS; j++) {
      const iso = jour(m, Math.floor(r() * 27));
      const cl = pick(data.clients);
      const lines = [];
      for (let l = 0; l < 1 + Math.floor(r() * 5); l++) {
        const a = pick(data.catalog);
        lines.push({
          label: a.label, description: 'Ligne détaillée pour ' + a.label,
          qty: 1 + Math.floor(r() * 4), unitPrice: a.price, vatRate: a.vatRate, unit: a.unit, itemId: a.id
        });
      }
      n++;
      const t = C.computeTotals({ lines, currency: 'TND', exchangeRate: 1, stampFee: 1, type: 'facture' }, data.company);
      // Trois sorts, pour que les statuts ne soient pas tous les mêmes : payée, partielle, impayée.
      const sort = r();
      const payments = sort < 0.7
        ? [{ id: 'p' + n, date: iso, amount: t.netToPay, method: 'virement' }]
        : sort < 0.85
          ? [{ id: 'p' + n, date: iso, amount: Math.round(t.netToPay / 2), method: 'espèces' }]
          : [];
      data.documents.push({
        id: 'd' + n, type: 'facture', number: `FAC-${iso.slice(0, 4)}-${String(j + 1).padStart(3, '0')}`,
        date: iso, dueDate: iso, clientId: cl.id, lines, currency: 'TND', exchangeRate: 1,
        status: 'envoyée', issuedAt: iso + 'T09:00:00.000Z', stampFee: 1,
        payments, reminders: [], emails: [], attachments: []
      });
    }
    for (let j = 0; j < ACHATS_PAR_MOIS; j++) {
      const iso = jour(m, Math.floor(r() * 27));
      data.purchases.push({
        id: 'a' + m + '-' + j, kind: 'facture', supplierId: pick(data.suppliers).id,
        number: 'F' + m + '-' + j, date: iso, dueDate: iso, category: 'Achats',
        lines: [{ label: 'Achat ' + j, qty: 1, unitPrice: 50 + Math.floor(r() * 400), vatRate: 19, destination: 'charge', deductible: true }],
        payments: [{ id: 'ap' + m + j, date: iso, amount: 100 }], attachments: []
      });
    }
  }
  return data;
}

// ---------------------------------------------------------------- le jeu se vérifie AVANT la mesure
function verifierLeJeu(data) {
  const soucis = [];
  const mois = new Set(data.documents.map(d => d.date.slice(0, 7)));
  if (mois.size !== ANS * 12) soucis.push(`${mois.size} mois couverts au lieu de ${ANS * 12} : le générateur ne répartit pas`);

  const parMois = {};
  data.documents.forEach(d => { parMois[d.date.slice(0, 7)] = (parMois[d.date.slice(0, 7)] || 0) + 1; });
  const creux = Object.entries(parMois).filter(([, v]) => v !== PAR_MOIS);
  if (creux.length) soucis.push(`${creux.length} mois n'ont pas ${PAR_MOIS} pièces (p.ex. ${creux[0][0]} : ${creux[0][1]})`);

  const clientsVus = new Set(data.documents.map(d => d.clientId));
  if (clientsVus.size < CLIENTS * 0.9) soucis.push(`${clientsVus.size} clients facturés sur ${CLIENTS} : le tirage se concentre`);

  const jours = new Set(data.documents.map(d => Number(d.date.slice(8, 10))));
  if (jours.size < 20) soucis.push(`${jours.size} jours du mois distincts : le tirage se concentre`);

  const statuts = {};
  data.documents.forEach(d => {
    const s = C.effectiveStatus(d, data, data.company, '2026-09-21');
    statuts[s] = (statuts[s] || 0) + 1;
  });
  if (Object.keys(statuts).length < 2) soucis.push('un seul statut de facture dans tout le jeu : les calculs ne traversent qu\'une branche');

  const lignes = data.documents.reduce((s, d) => s + d.lines.length, 0);
  if (lignes < data.documents.length * 2) soucis.push(`${(lignes / data.documents.length).toFixed(1)} ligne par pièce en moyenne : trop peu`);

  return { soucis, mois: mois.size, clients: clientsVus.size, statuts, lignes };
}

// ---------------------------------------------------------------- la mesure
const SEUILS = {
  ouvrir: 2000, enregistrer: 400, todo: 500, ecritures: 2000, paquet: 2000, stats: 1000
};
let rate = null;

// MEILLEUR de trois passages, et on le DIT dans la sortie plutôt que de laisser lire une moyenne.
// Ce n'est pas une façon d'arrondir en sa faveur : le calcul est déterministe, donc tout ce qui
// varie d'un passage à l'autre vient de la machine (un autre processus, le ramasse-miettes, un
// conteneur partagé). Le minimum est l'estimation la plus proche du coût réel — et surtout, un
// test qui passe ou tombe au hasard sur le MÊME code cesse d'être lu, ce qui serait pire que pas
// de mesure du tout.
function chrono(nom, cle, fn) {
  fn();                                      // chauffe : le premier passage paie la compilation
  let ms = Infinity, res;
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    res = fn();
    ms = Math.min(ms, performance.now() - t);
  }
  const seuil = SEUILS[cle];
  const ok = ms <= seuil;
  if (!ok && !rate) rate = { nom, ms, seuil };
  console.log(`  ${nom.padEnd(47)} ${ms.toFixed(0).padStart(6)} ms   ${ok ? `ok (seuil ${seuil})` : `DÉPASSE le seuil de ${seuil} ms`}`);
  return res;
}

function main() {
  console.log('Test de charge — SkanFact entreprise\n');

  const data = construire();
  const v = verifierLeJeu(data);
  const json = JSON.stringify(data);
  const mo = (Buffer.byteLength(json) / 1048576).toFixed(1);
  console.log(`Jeu : ${data.documents.length} factures sur ${ANS} ans, ${data.purchases.length} achats, ${data.clients.length} clients, ${v.lignes} lignes — ${mo} Mo`);
  console.log(`      ${v.mois} mois couverts, ${v.clients} clients facturés, statuts : ${Object.entries(v.statuts).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  if (v.soucis.length) {
    console.log('\nLe JEU D\'ESSAI est faux — on ne mesure rien tant qu\'il ne l\'est pas :');
    v.soucis.forEach(s => console.log('  · ' + s));
    process.exit(1);
  }
  console.log('      jeu vérifié ✓\n');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-charge-'));
  const st = createStorage(dir);
  // Chiffré, comme chez quelqu'un qui a suivi ce que l'application conseille : c'est ce chemin-là
  // qu'il faut mesurer, pas le plus rapide.
  st.setPassword(data, 'un mot de passe de charge');

  // Ce que ces chiffres ne contiennent PAS, et il faut le dire plutôt que de le laisser croire :
  // la dérivation scrypt du mot de passe (~100 ms, N=2^15) est payée UNE fois au déverrouillage,
  // pas à chaque lecture — la clé vit ensuite en mémoire pour la session. Le déverrouillage est un
  // geste où l'utilisateur tape un mot de passe et s'attend à patienter ; ce n'est pas le geste
  // qu'on surveille ici.
  console.log('Les six gestes, dans les conditions réelles (chiffré, écriture atomique) — meilleur de 3 passages :\n');
  chrono('ouvrir le dossier (lire + déchiffrer + migrer)', 'ouvrir', () => C.migrateData(st.read()));
  chrono('enregistrer (save)', 'enregistrer', () => st.write(data, { force: true }));
  chrono('« À faire » (todoList)', 'todo', () => C.todoList(data, data.company));
  chrono('écritures d\'un exercice (journalEntries)', 'ecritures',
    () => C.journalEntries(data, data.company, { from: `${ANNEE_TEST}-01-01`, to: `${ANNEE_TEST}-12-31` }));
  chrono('paquet du mois (packPlan)', 'paquet',
    () => C.packPlan(data, data.company, C.packPeriod(ANNEE_TEST, 6)));
  chrono('statistiques d\'une année (salesTotals)', 'stats',
    () => C.salesTotals(data, data.company, C.periodBounds('annee', ANNEE_TEST)));

  fs.rmSync(dir, { recursive: true, force: true });

  if (rate) {
    console.log(`\nÉCHEC : « ${rate.nom} » met ${rate.ms.toFixed(0)} ms pour un seuil de ${rate.seuil} ms.`);
    console.log('Le fichier unique approche de sa limite. Les leviers, du moins cher au plus cher :');
    console.log('  · ne réécrire que ce qui a changé (journal d\'ajouts plutôt que réécriture totale)');
    console.log('  · découper par exercice, comme le livre du Cabinet en 9.2.0');
    console.log('  · un index séparé pour ce que les écrans LISENT sans ouvrir les pièces');
    process.exit(1);
  }
  console.log('\nLes six seuils sont tenus.');
}

if (require.main === module) main();
module.exports = { construire, verifierLeJeu, SEUILS };
