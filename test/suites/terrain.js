'use strict';
// ============================================================================================
// Les tests terrain (TESTS-TERRAIN.md) — ce que Skander a vu en jouant le comptable, corrigé en 9.8.8
//
// Chaque test porte le numéro du constat qu'il tient (T-nn) et se prouve en réintroduisant le
// défaut : un test qui ne peut pas échouer est pire que pas de test (7.2.0). Les tests purs
// construisent un vrai livre depuis les paquets de l'exemple ; les tests de source relisent le
// renderer du Cabinet, commentaires retirés.
module.exports = ({ t, assert, lireSource }) => {
const fs = require('fs'), path = require('path');
const K = require('../../src/renderer/compta.js');
const core = require('../../src/renderer/core.js');

// Un livre COMPLET, bâti comme le Cabinet le bâtit : les paquets de l'exemple, mois par mois,
// importés définitifs (donc validés). C'est le seul jeu de données qui ressemble à un exercice.
function livreDeLExemple() {
  const commis = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'cabinet', 'exemple-paquets.json'), 'utf8'));
  const annee = Number(commis.mois[0].mois.slice(0, 4));
  const livre = K.livreVide('MF:TEST', annee);
  commis.mois.slice().sort((a, b) => a.mois.localeCompare(b.mois)).forEach((m, i) => {
    const csv = m.fichiers.find(f => f.chemin === 'journaux/ecritures.csv').texte;
    const pieces = K.piecesDepuisLignes(K.entreesDepuisCsv(csv));
    const r = K.importerPaquet(livre, m.mois, pieces, true, 'test', 1000 + i);
    assert.ok(r.ajoutees > 0, m.mois + ' : rien importé');
  });
  return livre;
}
const sansComm = src => {
  const net = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(net.length > src.length * 0.5, 'le nettoyage des commentaires a mangé le code');
  return net;
};
const cabApp = () => sansComm(lireSource('src', 'cabinet', 'renderer', 'app.js'));
const tranche = (src, deb, fin, min, max) => {
  const a = src.indexOf(deb); assert.ok(a >= 0, 'ancre introuvable : ' + deb);
  const b = src.indexOf(fin, a + deb.length); assert.ok(b > a, 'borne introuvable : ' + fin);
  const z = src.slice(a, b);
  assert.ok(z.length >= min && z.length <= max, `tranche suspecte (${z.length}) entre ${deb} et ${fin}`);
  return z;
};

t('T-01 : le journal de trésorerie du paquet porte sa nature, son compte, ses entrées et ses sorties', () => {
  // `cashCsvColumns` réclamait quatre clés que `cashMovements` n'écrivait pas : quatre colonnes
  // vides dans chaque paquet depuis la 6.1.0, sans un message. Le contrat se vérifie clé par clé.
  const co = { name: 'Test', currency: 'TND', paymentTermsDays: 30, stampFee: 1 };
  const d = core.migrateData({
    accounts: [{ id: 'b1', name: 'Banque Test', isDefault: true, opening: 0 }],
    clients: [{ id: 'c1', name: 'Client A' }], suppliers: [{ id: 's1', name: 'Scierie' }],
    documents: [{ id: 'f1', type: 'facture', clientId: 'c1', number: 'FAC-2026-001', status: 'envoyée', date: '2026-08-10',
      lines: [{ label: 'Pose', qty: 1, unitPrice: 1000, vatRate: 19 }], payments: [{ id: 'p1', date: '2026-08-20', amount: 500, method: 'virement', accountId: 'b1' }] }],
    purchases: [{ id: 'a1', kind: 'facture', supplierId: 's1', number: 'F-99', date: '2026-08-05',
      lines: [{ label: 'bois', qty: 1, unitPrice: 200, vatRate: 19, destination: 'charge', deductible: true }],
      payments: [{ id: 'q1', date: '2026-08-22', amount: 238, method: 'virement', accountId: 'b1' }] }]
  });
  const per = core.packPeriod(2026, 8);
  const cash = core.cashMovements(d, co, per);
  assert.strictEqual(cash.length, 2, 'le jeu doit porter un encaissement et un règlement');
  const rows = core.cashCsvRows(d, cash);
  core.cashCsvColumns().forEach(c => rows.forEach(r => assert.ok(r[c.key] !== undefined, `la colonne « ${c.label} » (${c.key}) n'est écrite par personne`)));
  const enc = rows.find(r => r.source === 'vente'), reg = rows.find(r => r.source === 'achat');
  assert.deepStrictEqual([enc.kindLabel, enc.accountName, enc.inAmount, enc.outAmount], ['Encaissement client', 'Banque Test', 500, 0]);
  assert.deepStrictEqual([reg.kindLabel, reg.accountName, reg.inAmount, reg.outAmount], ['Règlement fournisseur', 'Banque Test', 0, 238]);
  // Et c'est bien ce qui part dans le paquet : la ligne du CSV porte les quatre valeurs.
  const plan = core.packPlan(d, co, per, {});
  const csv = plan.entries.find(e => e.path === 'journaux/tresorerie.csv').text;
  const lignes = csv.split('\n').filter(Boolean);
  assert.ok(lignes[1].includes('Encaissement client;Banque Test;500,000;0,000'), 'le CSV du paquet ne porte pas la nature, le compte et l\'entrée : ' + lignes[1]);
  assert.ok(lignes[2].includes('Règlement fournisseur;Banque Test;0,000;238,000'), lignes[2]);
});

t('T-08 : un relevé déjà importé est refusé pour CETTE raison, avant tout reproche sur les soldes', () => {
  const livre = K.livreVide('D1', 2026, { plan: [{ compte: '532', libelle: 'Banque' }] });
  const releve = { compte: '532', empreinte: 'sha-abc', soldeDebut: 100, soldeFin: 90, fichier: 'r.csv', lignes: [{ date: '2026-03-04', libelle: 'FRAIS', montant: -10 }] };
  assert.strictEqual(K.ajouterReleve(livre, releve, 'moi', 1).ok, true);
  // Le même fichier, avec des soldes QUELCONQUES : le vrai motif doit sortir en premier.
  const r = K.ajouterReleve(livre, { ...releve, soldeDebut: 23220, soldeFin: 11110 }, 'moi', 2);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.deja, true, 'le refus ne dit pas que c\'est un doublon');
  assert.ok(/déjà été importé/.test(r.motif) && !/ne se boucle pas/.test(r.motif), 'le premier refus est un faux motif : ' + r.motif);
  assert.ok(K.releveDejaImporte(livre, 'sha-abc'), 'l\'écran doit pouvoir le dire dès le choix du fichier');
  assert.strictEqual(K.releveDejaImporte(livre, 'sha-autre'), null);
  assert.strictEqual(K.releveDejaImporte(livre, ''), null, 'sans empreinte, rien à comparer');
});

t('T-06 : l\'écart de rapprochement est « solde du relevé − solde comptable », et il peut tomber à zéro', () => {
  // Un livre qui porte juin et juillet ; un relevé d'août seul. La première version rendait
  // « Σ suspens banque − Σ suspens livre » : sans borne basse côté livre et sans jamais relire
  // `soldeFin`, l'écart valait le solde de juin + juillet et ne bougeait jamais.
  const livre = K.livreVide('D1', 2026, { plan: [{ compte: '532', libelle: 'Banque' }, { compte: '606', libelle: 'Achats' }] });
  const bq = (id, date, montant, libelle) => livre.ecritures.push({
    id, numero: livre.ecritures.length + 1, statut: 'validee', journal: 'BQ', piece: id, date, libelle, source: 'saisie',
    lignes: [{ compte: '532', libelle, debit: montant > 0 ? montant : 0, credit: montant < 0 ? -montant : 0 },
      { compte: '606', libelle, debit: montant < 0 ? -montant : 0, credit: montant > 0 ? montant : 0 }]
  });
  bq('E1', '2026-06-01', 10000, 'Apport'); bq('E2', '2026-07-05', -2081.645, 'Loyer'); bq('E3', '2026-08-10', 1000, 'VIR CLIENT');
  const r = K.ajouterReleve(livre, {
    compte: '532', empreinte: 'aout', soldeDebut: 7918.355, soldeFin: 8913.855, du: '2026-08-01', au: '2026-08-31',
    lignes: [{ date: '2026-08-10', libelle: 'VIR CLIENT', montant: 1000 }, { date: '2026-08-12', libelle: 'COMMISSION', montant: -4.5 }]
  }, 'moi', 1);
  assert.strictEqual(r.ok, true, r.motif);
  const s1 = K.suspens(livre, r.releve.id);
  assert.strictEqual(s1.soldeComptable, 8918.355);
  assert.strictEqual(s1.ecart, -4.5, 'l\'écart doit être la seule opération que le livre n\'a pas');
  // Les deux listes ne bougent pas : c'est le NOMBRE qui était faux. Et ce que les suspens
  // n'expliquent pas est nommé — ici juin et juillet, d'avant le premier relevé.
  assert.strictEqual(s1.banque.length, 2);
  assert.strictEqual(s1.livre.length, 3);
  assert.strictEqual(s1.avant, 7918.355);
  // La commission passée en écriture : l'écart tombe à ZÉRO. Un indicateur qui ne peut pas
  // atteindre zéro est une décoration.
  bq('E4', '2026-08-12', -4.5, 'COMMISSION');
  const s2 = K.suspens(livre, r.releve.id);
  assert.strictEqual(s2.ecart, 0);
  assert.strictEqual(s2.soldeFin, 8913.855);
});

t('T-21 : annuler le dépôt d\'une déclaration payée annule le paiement du même geste, et le dit', () => {
  const livre = K.livreVide('D1', 2026);
  livre.declarations.push({ periode: '2026-03', cases: {}, deposee: { le: '', par: '', reference: '' }, payee: { le: '', par: '', reference: '' } });
  assert.strictEqual(K.pointerDeclaration(livre, '2026-03', 'payee', { le: '2026-04-10' }, 'moi', 1).ok, false, 'on ne paie pas ce qu\'on n\'a pas déposé');
  assert.strictEqual(K.pointerDeclaration(livre, '2026-03', 'deposee', { le: '2026-04-10' }, 'moi', 2).ok, true);
  assert.strictEqual(K.pointerDeclaration(livre, '2026-03', 'payee', { le: '2026-04-12' }, 'moi', 3).ok, true);
  const r = K.pointerDeclaration(livre, '2026-03', 'deposee', null, 'moi', 4);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.aussiPayee, true, 'l\'appelant doit pouvoir dire « dépôt ET paiement annulés »');
  const d = livre.declarations[0];
  assert.strictEqual(d.deposee.le, '');
  assert.strictEqual(d.payee.le, '', '« payée mais pas déposée » est l\'état que la porte d\'entrée refuse : on ne doit pas pouvoir l\'obtenir par la sortie');
  // Et l'ordre inverse — annuler le paiement seul — ne touche pas au dépôt.
  K.pointerDeclaration(livre, '2026-03', 'deposee', { le: '2026-04-10' }, 'moi', 5);
  K.pointerDeclaration(livre, '2026-03', 'payee', { le: '2026-04-12' }, 'moi', 6);
  const r2 = K.pointerDeclaration(livre, '2026-03', 'payee', null, 'moi', 7);
  assert.strictEqual(r2.aussiPayee, false);
  assert.strictEqual(d.deposee.le, '2026-04-10');
});

t('T-16 : le total à décaisser NOMME ce qu\'il additionne, et ce qui n\'y entre pas le dit', () => {
  const livre = K.livreVide('D1', 2026, {
    plan: [{ compte: '4367', libelle: 'TVA collectée', role: 'tvaCollectee' }, { compte: '4366', libelle: 'TVA déductible', role: 'tvaDeductible' },
      { compte: '4365', libelle: 'TVA à décaisser', role: 'tvaAPayer' }, { compte: '4368', libelle: 'Timbre', role: 'timbre' },
      { compte: '4352', libelle: 'RS opérée', role: 'rsOperee' }, { compte: '4358', libelle: 'RS subie', role: 'rsSubie' }, { compte: '4321', libelle: 'IRPP', role: 'irpp' }]
  });
  const e = (id, lignes) => livre.ecritures.push({ id, numero: livre.ecritures.length + 1, statut: 'validee', journal: 'OD', piece: id, date: '2026-08-15', libelle: id, source: 'saisie', lignes });
  e('V1', [{ compte: '411', libelle: 'Client', debit: 1195, credit: 0 }, { compte: '706', libelle: 'Ventes', debit: 0, credit: 1000 }, { compte: '4367', libelle: 'TVA', debit: 0, credit: 190 }, { compte: '4368', libelle: 'Timbre', debit: 0, credit: 5 }]);
  e('P1', [{ compte: '640', libelle: 'Salaires', debit: 1500, credit: 0 }, { compte: '4321', libelle: 'IRPP', debit: 0, credit: 292.046 }, { compte: '425', libelle: 'Net', debit: 0, credit: 1207.954 }]);
  e('A1', [{ compte: '606', libelle: 'Achat', debit: 100, credit: 0 }, { compte: '4352', libelle: 'RS', debit: 0, credit: 1.5 }, { compte: '401', libelle: 'Fourn', debit: 0, credit: 98.5 }]);
  const d = K.declarationMensuelle(livre, '2026-08');
  const c = d.cases;
  assert.deepStrictEqual(c.aDecaisser.composantes, ['netAPayer', 'timbre', 'retenuesOperees']);
  // Le montant EST la somme des composantes nommées — une composante ajoutée sans son nom tombe.
  assert.strictEqual(c.aDecaisser.montant, K.round3(c.aDecaisser.composantes.reduce((s, k) => s + c[k].montant, 0)));
  assert.strictEqual(c.aDecaisser.montant, 196.5);
  assert.strictEqual(c.irpp.montant, 292.046, 'l\'IRPP reste calculé et tracé');
  assert.ok(typeof c.irpp.horsTotal === 'string' && /À VÉRIFIER/.test(c.irpp.horsTotal), 'une ligne qui n\'entre pas dans le total doit le dire, avec le « À VÉRIFIER »');
  assert.strictEqual(c.retenuesSubies.sens, 'creance', 'une somme qu\'on récupère ne se lit pas comme une somme qu\'on paie');
});

t('T-41 : la balance auxiliaire détaille le COLLECTIF, et son total est le solde du 411 dans la générale', () => {
  const livre = livreDeLExemple();
  const lignes = K.lignesDuLivre(livre);
  assert.ok(lignes.length > 100, 'le livre de l\'exemple doit porter des centaines de lignes');
  const C = K.collectifsDeTiers(livre, 'clients');
  assert.deepStrictEqual(C, ['411'], 'sans rôle dans le plan, le repli est le collectif clients');
  const aux = K.balanceAuxiliaireDepuisLignes(lignes, C);
  const gen = K.balanceDepuisLignes(lignes, null, null);
  const solde411 = K.round3(gen.rows.filter(r => String(r.account).startsWith('411')).reduce((s, r) => s + r.solde, 0));
  assert.ok(aux.rows.length >= 2, 'au moins deux clients attendus');
  assert.strictEqual(aux.solde, solde411, 'l\'auxiliaire et la générale doivent dire la même chose des clients');
  // Le défaut : chaque tiers soldait à zéro par construction. Ici au moins un client doit encore
  // quelque chose — et aucune ligne de produit ou de TVA n'entre dans le détail.
  assert.ok(aux.rows.some(r => r.solde !== 0), 'tous les clients à zéro : la balance auxiliaire ne dit rien');
  aux.rows.forEach(r => r.account.split(', ').forEach(a => assert.ok(a.startsWith('411'), `un compte hors collectif dans l'auxiliaire : ${a}`)));
  // Fournisseurs : même règle, autre collectif.
  const four = K.balanceAuxiliaireDepuisLignes(lignes, K.collectifsDeTiers(livre, 'fournisseurs'));
  const solde401 = K.round3(gen.rows.filter(r => String(r.account).startsWith('401')).reduce((s, r) => s + r.solde, 0));
  assert.strictEqual(four.solde, solde401);
  // Le rôle du plan prime sur le repli (règle 6.3.0 : aucun numéro n'est une vérité).
  assert.deepStrictEqual(K.collectifsDeTiers({ plan: [{ compte: '4111', role: 'clients' }, { compte: '4112', role: 'clients' }] }, 'clients'), ['4111', '4112']);
  // L'ouverture par tiers vient des lignes d'AVANT la période.
  const mars = lignes.filter(l => l.date.slice(0, 7) === lignes[lignes.length - 1].date.slice(0, 7));
  const avant = lignes.filter(l => l.date < mars[0].date.slice(0, 7) + '-01');
  const auxMois = K.balanceAuxiliaireDepuisLignes(mars, C, { avant });
  assert.strictEqual(auxMois.solde, aux.solde, 'ouverture + mouvements du mois = solde de l\'exercice');
});

t('T-22 : dans le bilan, chaque rubrique porte un NOM DE COMPTE, jamais le libellé d\'une écriture', () => {
  const livre = livreDeLExemple();
  const lignes = K.lignesDuLivre(livre);
  // Le résolveur des deux handlers de `src/cabinet/main.js`, recopié à l'identique — et un test de
  // source, plus bas, exige qu'ils passent par `libelleDuPlan`.
  const libelle = c => ((livre.plan || []).find(p => p.compte === c) || {}).libelle || K.libelleDuPlan(c) || '';
  const e = K.etatsDepuisLignes(lignes, K.soldesDepuisOuverture(livre), { libelle });
  const toutes = [].concat(...e.actif.map(g => g.lignes), ...e.passif.map(g => g.lignes), e.produits.lignes, e.charges.lignes);
  assert.ok(toutes.length >= 5);
  toutes.forEach(l => assert.ok(!/Facture|Paiement|Achat |LOC-|FAC-/.test(l.libelle), `une rubrique porte un libellé d'écriture : ${l.compte} « ${l.libelle} »`));
  const c411 = toutes.find(l => l.compte === '411');
  assert.ok(c411 && /Clients/.test(c411.libelle), 'le 411 doit s\'appeler « Clients »');
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'));
  const libs = main.split('\n').filter(l => /const libelle = \(c\) =>/.test(l));
  assert.ok(libs.length >= 2, 'les deux résolveurs de main.js sont attendus');
  libs.forEach(l => assert.ok(l.includes('KC.libelleDuPlan(c)'), 'un résolveur de bilan ne retombe pas sur le plan comptable : ' + l.trim()));
});

t('T-38 : l\'ouverture d\'une période se calcule, et la phrase qui la décrit dit la vraie raison', () => {
  const app = cabApp();
  const z = tranche(app, 'function lignesDeLaPeriode(', 'function phraseOuverture(', 1500, 6000);
  assert.ok(/const avant = duJ \? toutes\.filter\(l => l\.date < duJ\)/.test(z), 'les lignes d\'avant la période ne sont pas séparées');
  assert.ok(/const ouverture = KC\.soldesDepuisOuverture\(s\.livre\)/.test(z) && /avant\.forEach\(l => \{ ouverture\[l\.account\]/.test(z), 'l\'ouverture n\'additionne pas la reprise et les mouvements antérieurs');
  assert.ok(!/manquants: \[\]/.test(z.slice(z.indexOf('if (s.livre) {'), z.indexOf("return { source: 'livre'"))), 'T-02 : la branche du livre renvoie encore « manquants: [] » en dur');
  // Les trois lectures passent l'ouverture de la période — plus jamais `null` (quatre recopies).
  ['KC.grandLivreDepuisLignes(lignes, s.compte, ouverture, nomDeCompte())',
    'KC.balanceDepuisLignes(lignes, ouverture, nomDeCompte())',
    "KC.balanceDepuisLignes(lignes, (s.periode || {}).ouverture || null, nomDeCompte())"].forEach(f => assert.ok(app.includes(f), 'un appel ne passe pas l\'ouverture : ' + f));
  assert.ok(!/DepuisLignes\(lignes, (s\.compte, )?null, nomDeCompte\(\)\)/.test(app), 'un appel passe encore `null` en ouverture');
  // La phrase : une seule fonction, trois cas, et le mot « paquets » réservé au cas des paquets.
  const p = tranche(app, 'function phraseOuverture(', '\n  }', 400, 1600);
  assert.ok(p.includes("p.source !== 'livre'") && p.includes('lues dans les paquets'), 'le cas des paquets a disparu');
  assert.ok(p.includes('p.du > debutEx') && p.includes('nulle'), 'les deux cas du livre (période plus courte, exercice entier) ont disparu');
  assert.strictEqual((app.match(/dans les paquets reçus, sans à-nouveau/g) || []).length, 1, 'la phrase des paquets doit vivre à un seul endroit');
  assert.ok(!app.includes('ce livre est lu dans les paquets, sans à-nouveau'), 'l\'ancienne phrase permanente est encore là');
  // « trois paires » n'est plus une promesse : le compte des paires suit ce que l'écran montre.
  assert.ok(app.includes("avecOuv ? 'les trois paires de totaux") && app.includes("'les deux paires de totaux"), 'le verdict de la balance promet des paires qu\'on ne voit pas');
});

t('T-23 : le vert du bilan ne se pose que sur un exercice qui a ses à-nouveaux', () => {
  const app = cabApp();
  const z = tranche(app, 'function vueCloture(', 'function brancherCloture(', 2000, 16000);
  assert.ok(/const sansOuverture = !\(\(s\.livre\.ouverture \|\| \{\}\)\.lignes \|\| \[\]\)\.length && !\(capitaux && capitaux\.total\)/.test(z), 'sansOuverture ne juge pas ET la reprise ET les capitaux');
  const bloc = z.slice(z.indexOf('${!e.equilibre'), z.indexOf('Actif = passif, au millime.') + 40);
  assert.ok(bloc.includes('sansOuverture') && bloc.indexOf('sansOuverture') < bloc.indexOf('Actif = passif, au millime.'), 'le vert se pose avant d\'avoir jugé l\'ouverture');
  assert.ok(bloc.includes('id="cl-reprise"') && bloc.includes('Reprendre les soldes d\'ouverture'), 'l\'avertissement ne porte pas le geste qui débloque');
  assert.ok(/\$\('#cl-reprise', el\)[\s\S]{0,80}repriseForm\(root, dossier\)/.test(app), 'le bouton n\'est pas branché sur la reprise');
});

t('T-17 : les trois gestes d\'une déclaration disent pourquoi ils attendent, et le bouton qui débloque est là', () => {
  const app = cabApp();
  const z = tranche(app, '<h2>Ce qui suit ${info(\'dc.suite\')}</h2>', 'id="dc-payee"', 300, 3000);
  assert.ok(z.includes('prépare-la d\'abord') && z.includes('id="dc-preparer2"'), 'le motif ne se lit pas au-dessus des boutons, ou le bouton n\'est pas répété');
  assert.ok(/id="dc-deposee"[^>]*title="\$\{!posee \? 'Prépare la déclaration d\\'abord\.'/.test(z), '« Marquer déposée » éteint n\'explique rien');
  assert.ok(/\[\$\('#dc-preparer', el\), \$\('#dc-preparer2', el\)\]\.forEach/.test(app), 'les deux boutons « Préparer » ne font pas le même geste');
  // T-21, côté écran : le bouton du paiement reste allumé tant qu'un paiement est posé.
  assert.ok(app.includes("id=\"dc-payee\" ${!posee || (!(posee.deposee && posee.deposee.le) && !(posee.payee && posee.payee.le)) ? 'disabled' : ''}"), 'le bouton du paiement s\'éteint dès que le dépôt est vide, même payée');
  assert.ok(app.includes('Dépôt et paiement annulés'), 'le geste double n\'est pas dit');
});

t('T-03 / T-05 / T-36 : ce qu\'un bouton fait apparaître, ce qu\'il ne touche pas, ce qui est parti', () => {
  const app = cabApp();
  assert.ok(app.includes('Créer le livre ouvre sept onglets de plus'), 'le bandeau ne dit pas ce que le bouton vert fait apparaître (T-03)');
  const onglets = ['Saisie', 'Déclaration', 'Banque', 'Immobilisations', 'Inventaire', 'Exercice', 'Recherche'];
  const z = tranche(app, 'Créer le livre ouvre sept onglets', '</div>', 40, 400);
  onglets.forEach(o => assert.ok(z.includes(o), 'un onglet n\'est pas nommé : ' + o));
  // Les sept sont bien ceux qui n'existent qu'avec un livre : on les relit dans la barre d'onglets.
  const tabs = tranche(app, '<div class="tabs" id="c-tabs">', '</div>${corps}', 500, 4000);
  onglets.forEach(o => assert.ok(new RegExp(`\\$\\{s\\.livre \\? \`<button data-tab="[a-z-]+"[^>]*>${o}`).test(tabs), `${o} n'est pas conditionné au livre, ou le bandeau ment`));
  // T-05 : la réassurance se lit AVANT le geste — une bulle à côté du bouton, avec sa clé d'aide.
  assert.ok(/id="lv-relire2"[^`]*Relire les paquets reçus<\/button>\$\{info\('lv\.relire'\)\}/.test(app), '« Relire les paquets reçus » n\'a pas sa bulle');
  const guide = lireSource('src', 'cabinet', 'renderer', 'cabguide.js');
  assert.ok(/'lv\.relire': \{[^}]*ne touche jamais/.test(guide), 'la bulle ne dit pas que les validées ne bougent pas');
  // T-36 : le bandeau de l'exemple compte les livres partis, et main.js les compte à la source.
  assert.ok(app.includes('exempleRefait.livres') && app.includes('livre de démonstration est parti'), 'le bandeau ne dit pas que la saisie d\'essai est partie');
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'));
  assert.ok(/livres \+= \(r && r\.livres\) \|\| 0/.test(main) && /return \{ version: VERSION, mois, raison, livres:/.test(main), 'rafraichirExemple ne compte pas les livres');
});

t('T-10 : une pastille compte ce qui attend une décision, partout', () => {
  const app = cabApp();
  const tabs = tranche(app, '<div class="tabs" id="c-tabs">', '</div>${corps}', 500, 4000);
  assert.ok(/etatImmobilisations\(s\.livre, s\.annee\)\.aEcrire/.test(tabs), 'Immobilisations compte encore ses fiches, pas les dotations à passer');
  assert.ok(!/immobilisations \|\| \[\]\)\.length\}<\/span>/.test(tabs), 'la pastille des immobilisations affiche encore un inventaire');
  assert.ok(/<span class="badge b-paid">clos<\/span>/.test(tabs) && !/tab-n">clos/.test(tabs), '« clos » est encore habillé en compteur');
  assert.ok(/statut === 'brouillard'\) && !\(s\.livre\.exercice && s\.livre\.exercice\.clos\)/.test(tabs), 'la Saisie garde sa pastille sur un exercice clos');
});

t('T-11 / T-14 : chaque pièce ouverte du lettrage s\'ouvre, et les soldés tiennent sur une ligne', () => {
  const app = cabApp();
  const z = tranche(app, 'function vueLettrage(', 'const declState', 3000, 12000);
  assert.ok(/rowMenuCell\(o\.ecritureId \? 'E:' \+ o\.ecritureId : o\.piece \+ '\|' \+ \(o\.mois \|\| ''\)\)/.test(z), 'une pièce ouverte n\'a pas de menu');
  assert.ok(!/<td class="row-actions"><\/td>/.test(z), 'une colonne d\'actions toujours vide');
  assert.ok(!/data-piece=/.test(z), '`data-piece` : un attribut écrit et lu nulle part');
  assert.ok(/id="lv-soldes"/.test(z) && !/Tout est lettré :/.test(z), 'les tiers soldés ont encore un panneau chacun');
  // Le moteur porte ce que l'écran ouvre : l'identifiant de l'écriture et son mois.
  const K = require('../../src/renderer/compta.js');
  const l = K.lettrageDepuisLignes([
    { account: '411', tiers: 'A', piece: 'F1', date: '2026-03-01', debit: 100, credit: 0, ecritureId: 'E9', mois: '2026-03' }
  ], '411', '2026-04-01');
  assert.strictEqual(l.rows[0].ouverts[0].ecritureId, 'E9');
  assert.strictEqual(l.rows[0].ouverts[0].mois, '2026-03');
});

t('T-12 : « En face » montre la LIGNE appariée avec son montant, et l\'écriture s\'ouvre', () => {
  const app = cabApp();
  const z = tranche(app, 'function vueBanque(', 'function brancherBanque(', 3000, 14000);
  assert.ok(/const lg = e && Array\.isArray\(e\.lignes\) \? e\.lignes\[Number\(r\.ligne\)\] : null/.test(z), 'la ligne appariée n\'est pas relue');
  assert.ok(/mFace != null \? ` <span class="muted nw">· \$\{esc\(money\(mFace\)\)\}<\/span>` : ''/.test(z), 'le montant de la ligne en face n\'est pas affiché');
  const m = tranche(app, 'function brancherBanque(', 'function ecritureDialog(', 2000, 9000);
  assert.ok(/label: 'Voir l\\'écriture en face'[\s\S]{0,220}run: \(\) => ecritureDialog\(e, Number\(r\.ligne\)\)/.test(m), 'une ligne rapprochée n\'ouvre pas son écriture');
  assert.ok(app.includes('function ecritureDialog('), 'la fenêtre de lecture d\'une écriture manque');
});

t('T-18 / T-20 / T-42 : les abonnements vivent dans la Saisie, un clic amène son panneau, un libellé dit où il mène', () => {
  const app = cabApp();
  const z = tranche(app, 'function vueSaisie(', 'function lotsDuBrouillard(', 3000, 12000);
  assert.ok(/<div class="panel mt" id="c-abos">/.test(z), 'le panneau Abonnements n\'est pas dans la Saisie');
  assert.strictEqual((app.match(/id="c-abos"/g) || []).length, 1, 'le panneau Abonnements vit à deux endroits');
  assert.ok(/if \(s\.onglet === 'saisie'\) \{ brancherSaisie\(el, root, dossier\); dessinerAbonnements\(el, dossier\); \}/.test(app), 'les abonnements ne se dessinent pas avec la Saisie');
  assert.ok(/if \(String\(cle\)\.startsWith\('A:'\)\) return actionsAbonnement\(root, dossier, cle\);/.test(app), 'UNE table d\'actions par racine : les abonnements doivent passer par celle de la Saisie');
  const abos = tranche(app, 'function dessinerAbonnements(', 'function actionsAbonnement(', 500, 4000);
  assert.ok(!/bindRowMenus\(/.test(abos), 'dessinerAbonnements branche encore ses menus sur une racine imbriquée');
  // T-20 : pageFocus, consommé APRÈS le dessin, et posé par le bouton « d'où ça vient ».
  assert.ok(/let pageFocus = '';/.test(app) && /function focaliser\(root\)/.test(app), 'pageFocus n\'a pas été porté');
  const dl = tranche(app, 'function drawLivres(', 'const miroirBadge', 3000, 16000);
  assert.ok(/else brancherVue\(el, root, dossier, lignes\);\s*focaliser\(el\);/.test(dl), 'focaliser doit venir APRÈS le dessin, pas au milieu');
  assert.ok(/if \(declState\.ouverte\) pageFocus = 'dc-pieces';/.test(app), 'ouvrir les pièces d\'une case ne les amène pas à l\'écran');
  assert.ok(/data-cases="\$\{k\}" aria-expanded=/.test(app), 'le bouton ne dit pas qu\'il est ouvert');
});

t('T-24 / T-25 / T-26 / T-27 : l\'exercice se relit, sa fenêtre liste, son motif se lit, son dossier laisse une trace', () => {
  const app = cabApp();
  const bc = tranche(app, 'function brancherCloture(', 'async function chargerCloture(', 800, 5000);
  assert.ok(/const rev = `\$\{\(s\.livre\.audit \|\| \[\]\)\.length\}:\$\{\(s\.livre\.ecritures \|\| \[\]\)\.length\}`/.test(bc) && /s\.clotureRev !== rev/.test(bc), 'les contrôles de clôture ne se relisent pas quand le livre bouge (T-24)');
  // T-25 : le corps est du HTML, une vraie liste, et aucun `\n` dans un corps de confirmDialog.
  assert.ok(/<ul>\$\{echecs\.map\(c => `<li>\$\{esc\(c\.detail\)\}<\/li>`\)\.join\(''\)\}<\/ul>/.test(bc), 'la fenêtre de clôture ne liste pas ses contrôles');
  // Le contrat de `confirmDialog` est HTML : un `\n\n` de paragraphe n'y produit RIEN. Sept
  // fenêtres le faisaient. Un `\n\n` littéral ne peut vivre que dans un `infoDialog` (qui rend en
  // `pre-wrap`) ou dans le corps d'un mail.
  app.split('\n').forEach(l => {
    if (!l.includes('\\n\\n')) return;
    assert.ok(/infoDialog\(|Bonjour,|Ce que j'aimerais|Comment je fais|--- version|\.join\('\\n\\n'\)/.test(l),
      'un corps de fenêtre porte un `\\n\\n` que le HTML avalera : ' + l.trim().slice(0, 100));
  });
  assert.ok(app.includes("<p>Une écriture miroir sera créée et VALIDÉE au"), 'la fenêtre d\'extourne ne fait pas ses paragraphes');
  // T-26 : le motif se lit sur l'exercice ROUVERT, et l'historique complet existe.
  const vc = tranche(app, 'function vueCloture(', 'function brancherCloture(', 3000, 14000);
  assert.ok(/id="cl-rouvert"/.test(vc) && /!ex\.clos && \(ex\.reouvertures \|\| \[\]\)\.length/.test(vc), 'le motif de réouverture disparaît dès que l\'exercice est rouvert');
  assert.ok(/id="cl-historique"/.test(vc) && /\(ex\.reouvertures \|\| \[\]\)\.map\(d =>/.test(vc), 'l\'historique complet des réouvertures manque');
  // T-27 : la trace du dossier produit, dans le livre, avec le bouton qui retrouve le fichier.
  assert.ok(/id="cl-produits"/.test(vc) && /data-reveal="\$\{esc\(p\.chemin\)\}"/.test(vc), 'les dossiers produits n\'ont ni panneau ni bouton « Ouvrir le dossier »');
  assert.ok(/\$\$\('\[data-reveal\]', el\)\.forEach\(b => \{ b\.onclick = \(\) => api\.reveal\(b\.dataset\.reveal\); \}\);/.test(bc), '« Ouvrir le dossier » n\'est pas branché');
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'));
  assert.ok(/KC\.noterDossierCloture\(livre, \{ chemin: res\.filePath/.test(main), 'main.js n\'écrit pas la trace dans le livre');
  const K = require('../../src/renderer/compta.js');
  const livre = K.livreVide('D1', 2026);
  K.noterDossierCloture(livre, { chemin: '/tmp/x.skanclose', scelle: true, pdf: false }, 'moi', 5);
  assert.strictEqual(livre.exercice.dossiersProduits.length, 1);
  assert.deepStrictEqual(livre.exercice.dossiersProduits[0], { le: 5, par: 'moi', chemin: '/tmp/x.skanclose', scelle: true, pdf: false, signe: false });
  assert.ok(livre.audit.some(a => a.quoi === 'dossier de clôture produit' && a.detail === 'x.skanclose'), 'la piste d\'audit ne porte pas le dossier produit');
});

t('T-28 : un montant AFFICHÉ porte la virgule ; toFixed(3) ne sert plus qu\'à remplir un champ', () => {
  const app = cabApp();
  assert.ok(/const montant = n => money\(n\)\.replace/.test(app), 'le formateur sans devise manque');
  const restes = app.split('\n').filter(l => l.includes('.toFixed(3)'));
  restes.forEach(l => {
    // Autorisé : remplir la VALEUR d'un champ de saisie (`debit: x ? x.toFixed(3) : ''`,
    // `p.lignes[i].debit = …`, `champDebut.value = …`). Tout le reste est du texte rendu.
    assert.ok(/(debit|credit): [\w.()]+ \? [\w.()]+\.toFixed\(3\) : ''|p\.lignes\[i\]\.(debit|credit) = |\.value = [\w.]+\.toFixed\(3\)/.test(l),
      'un montant est rendu à l\'écran par toFixed(3), donc avec un point : ' + l.trim().slice(0, 110));
  });
  assert.ok(restes.length >= 4, 'les champs de saisie doivent garder toFixed(3), sinon le test ne garde rien');
});

t('T-29 / T-31 / T-32 / T-33 : les lots existent, Tab est expliqué, une ligne s\'ajoute à la souris, la liste sort du tableau', () => {
  const app = cabApp();
  assert.ok(/function lotsDuBrouillard\(brouillards\)/.test(app), 'les lots ne se déduisent pas du brouillard');
  assert.ok(/lotsDuBrouillard\(brouillards\)\.map\(l => `<button type="button" class="btn btn-sm" data-lot-\$\{l\.type\}/.test(app), 'les boutons de lot ne viennent pas du brouillard');
  assert.ok(!/Valider tout le journal \$\{esc\(p\.journal\)\}/.test(app), 'le lot suit encore l\'en-tête de saisie');
  assert.ok(/\$\$\('\[data-lot-journal\]', el\)\.forEach/.test(app) && /\$\$\('\[data-lot-mois\]', el\)\.forEach/.test(app), 'les lots ne sont pas branchés');
  // T-31 : la règle avant l'exception.
  const aide = tranche(app, 'function aideTouches(', '\n  }', 200, 1200);
  assert.ok(aide.indexOf("paire('Champ suivant', 'Tab')") > 0 && aide.indexOf("paire('Champ suivant', 'Tab')") < aide.indexOf("paire('Solder la dernière ligne'"), 'la légende nomme l\'exception de Tab avant sa règle');
  assert.ok(!/paire\('Solder la pièce'/.test(aide), '« Solder la pièce » laisse croire que Tab solde toujours');
  // T-32.
  assert.ok(/id="sa-ajouter"/.test(app) && /aj\.onclick = \(\) => \{ p\.lignes\.push\(ligneVide\(\)\); redessinerLignes\(\{ i: p\.lignes\.length - 1, k: 'compte' \}\); \}/.test(app), '« + Ajouter une ligne » manque ou n\'est pas branché');
  // T-33 : la liste vit sur le body, en position fixe calculée sur le champ.
  const sg = tranche(app, 'function suggererCompte(', 'const choisir', 400, 3000);
  assert.ok(/pop\.className = 'sugg-pop sugg-fixe'; document\.body\.appendChild\(pop\)/.test(sg), 'la liste est encore dans la cellule, donc rognée par le tableau');
  assert.ok(/input\.getBoundingClientRect\(\)/.test(sg) && /pop\.style\.top = \(r\.bottom \+ 4\)/.test(sg), 'la liste n\'est pas placée sur le champ');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/^\.sugg-pop\.sugg-fixe \{ position: fixed;/m.test(css), 'la feuille ne pose pas la position fixe');
});

t('T-34 : le miroir d\'une contre-passation se reconnaît, au journal comme au grand livre', () => {
  const K = require('../../src/renderer/compta.js');
  const livre = K.livreVide('D1', 2026, { plan: [{ compte: '606', libelle: 'Achats' }, { compte: '401', libelle: 'Fournisseurs' }] });
  const e = K.ajouterEcriture(livre, { date: '2026-03-04', journal: 'AC', piece: 'FA-1', libelle: 'Papeterie', lignes: [
    { compte: '606', libelle: 'Papeterie', debit: 100, credit: 0 }, { compte: '401', libelle: 'Papeterie', debit: 0, credit: 100 }] }, 'moi', 1);
  assert.strictEqual(K.validerEcriture(livre, e.id, 'moi', 2).ok, true);
  const r = K.contrepasser(livre, e.id, 'moi', '2026-04-10', 3);
  assert.strictEqual(r.ok, true);
  const lignes = K.lignesDuLivre(livre);
  const miroir = lignes.find(l => l.ecritureId === r.ecriture.id);
  assert.strictEqual(miroir.contrepasseDe, e.id, 'le lien vers l\'origine ne traverse pas lignesDuLivre');
  assert.strictEqual(miroir.origineNumero, 1, 'le numéro de l\'origine n\'est pas résolu');
  assert.ok(/^Contre-passation — /.test(miroir.libellePiece), 'le libellé de PIÈCE n\'arrive pas à l\'écran');
  const app = cabApp();
  assert.ok(/const miroirBadge = e => e\.contrepasseDe/.test(app), 'le badge du miroir manque');
  const vj = tranche(app, 'function vueJournal(', 'function nomDeCompte(', 2000, 9000);
  assert.ok(/e\.contrepasseDe \|\| e\.extourneDe \? 'cp-miroir'/.test(vj) && /esc\(e\.piece\) \+ miroirBadge\(e\)/.test(vj), 'le livre-journal ne marque pas le miroir');
  const gl = tranche(app, 'function vueGrandLivre(', 'function vueBalance(', 1500, 8000);
  assert.ok(/'cp-ligne' : e\.contrepasseDe \|\| e\.extourneDe \? 'cp-miroir'/.test(gl) && /miroirBadge\(e\)/.test(gl), 'le grand livre ne marque ni l\'originale ni le miroir');
  assert.ok(/^tr\.cp-miroir td \{/m.test(lireSource('src', 'cabinet', 'renderer', 'cabinet.css')), 'la classe du miroir n\'existe pas dans la feuille');
});

t('T-04 : le solde de départ d\'un relevé se propose depuis le livre, et cède à ce qu\'on tape', () => {
  const app = cabApp();
  const z = tranche(app, 'function releveForm(', 'const barreLivres', 3000, 10000);
  assert.ok(/KC\.lignesBancaires\(s\.livre, compte\)\.filter\(c => c\.date < premiere\)/.test(z), 'le solde n\'est pas lu dans le livre à la veille de la première ligne');
  assert.ok(/champDebut\.addEventListener\('input', \(\) => \{ debutTouche = true; \}\)/.test(z) && /if \(!champDebut \|\| debutTouche \|\| !lignes\.length\) return;/.test(z), 'la proposition écraserait ce que le comptable a tapé');
  assert.ok(/d'après le livre : \$\{money\(solde\)\}/.test(z), 'la proposition n\'est pas nommée');
  assert.ok(/id="rv-debut-hint"/.test(z), 'l\'endroit où la nommer manque');
});

t('T-07 / T-08 : la banque nomme « rien à faire », et un doublon se voit dès le choix du fichier', () => {
  const app = cabApp();
  assert.ok(app.includes('Tout est déjà rapproché : ${pl(total, \'ligne\')} sur ${total}.'), 'trois zéros pour la meilleure nouvelle possible');
  assert.ok(app.includes('Rien à rapprocher d\'office'), 'les deux riens ne sont pas distingués');
  const z = tranche(app, 'function releveForm(', 'const barreLivres', 3000, 9000);
  assert.ok(z.includes('KC.releveDejaImporte(s.livre, lu.empreinte)') && z.includes('id="rv-deja"'), 'la fenêtre n\'annonce pas le doublon à la lecture du fichier');
  assert.ok(z.includes('ok.disabled = !lignes.length || !!deja'), 'le bouton « Importer » reste allumé sur un doublon');
  // T-06, côté écran : la carte affiche l'écart de rapprochement avec ses deux termes.
  assert.ok(app.includes('Écart de rapprochement') && app.includes('sus.soldeComptable') && !app.includes('Écart de suspens'), 'la carte affiche encore l\'ancien nombre');
});

// ---------- le stockage : une sauvegarde qui n'emporte pas le fichier le plus cher n'est pas une sauvegarde ----------

// Un vrai magasin dans un dossier temporaire, avec une horloge qu'on avance à la main : deux
// sauvegardes prises dans la même seconde portent le MÊME nom (7.21.x), et une horloge réelle ne
// se pilote pas.
function magasin(nom) {
  const os = require('os');
  const { createCabStore } = require('../../src/cabinet/cabstore.js');
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'skan-' + nom + '-'));
  const horloge = { t: Date.UTC(2026, 8, 21, 10, 0, 0) };
  const store = createCabStore(path.join(racine, 'app'), { now: () => new Date(horloge.t) });
  return { store, racine, avance: s => { horloge.t += s * 1000; } };
}
const DOSSIER = { id: 'MF:1234567A', name: 'Client Un', matricule: '1234567A' };
const MDP = 'mot-de-passe-assez-long';
function livreAvecUnePiece() {
  const livre = K.livreVide(DOSSIER.id, 2026, { plan: [{ compte: '606', libelle: 'Achats' }, { compte: '401', libelle: 'Fournisseurs' }] });
  const e = K.ajouterEcriture(livre, { date: '2026-03-04', journal: 'AC', piece: 'FA-1', libelle: 'Papeterie', lignes: [
    { compte: '606', libelle: 'Papeterie', debit: 100, credit: 0 }, { compte: '401', libelle: 'Papeterie', debit: 0, credit: 100 }] }, 'moi', 1);
  assert.strictEqual(K.validerEcriture(livre, e.id, 'moi', 2).ok, true);
  return livre;
}
const zipDe = f => f.replace(/\.json$/, '.livres.zip');

t('T-35 : une sauvegarde nommée emporte les livres, la quotidienne dit qu\'elle ne les a pas, et la restauration les rend', () => {
  const { store, avance } = magasin('t35');
  store.create(MDP, { cabinet: { name: 'Cabinet' }, dossiers: [DOSSIER] });
  store.ecrireLivre(DOSSIER, livreAvecUnePiece(), null);
  assert.strictEqual(store.compterLivres(), 1);
  const nommee = store.backupNow('avant-suppression-dossier');
  assert.ok(fs.existsSync(zipDe(nommee)), 'la sauvegarde nommée n\'emporte pas les livres');
  assert.strictEqual(store.livresDansSauvegarde(nommee), 1, 'le compte des livres emportés est faux');
  const quotidienne = store.snapshotDaily();
  assert.ok(quotidienne && !fs.existsSync(zipDe(quotidienne)), 'la quotidienne ne doit pas emporter les livres (trente ZIP rempliraient le disque)');
  assert.strictEqual(store.livresDansSauvegarde(quotidienne), null, 'une sauvegarde sans livres doit répondre null, pas 0 : l\'écran doit pouvoir le DIRE');
  const liste = store.listBackups();
  assert.strictEqual(liste.find(b => b.path === nommee).livres, true);
  assert.strictEqual(liste.find(b => b.path === quotidienne).livres, false);
  // Le dossier est effacé par erreur, livre compris ; la sauvegarde prise juste avant le rend.
  assert.strictEqual(store.removeDossierFiles(DOSSIER, [DOSSIER]).livres, 1);
  assert.strictEqual(store.lireLivre(DOSSIER, 2026, null).absent, true, 'le livre devrait avoir disparu');
  avance(2);
  const rendu = store.restore(nommee);
  assert.strictEqual(rendu.dossiers.length, 1);
  const relu = store.lireLivre(DOSSIER, 2026, null);
  assert.ok(relu.livre, 'la restauration ne rend pas le livre : ' + JSON.stringify(relu));
  assert.strictEqual(relu.livre.ecritures.length, 1);
  assert.strictEqual(relu.livre.ecritures[0].statut, 'validee');
  // Une sauvegarde d'avant la 9.8.8 (JSON seul) ne détruit pas les livres qu'elle ne connaît pas.
  avance(2);
  const ancienne = store.backupNow('manuelle');
  fs.unlinkSync(zipDe(ancienne));
  avance(2);
  store.restore(ancienne);
  assert.ok(store.lireLivre(DOSSIER, 2026, null).livre, 'restaurer une sauvegarde sans livres ne doit pas les effacer');
  // La purge emporte le ZIP avec son JSON : un ZIP orphelin serait une sauvegarde à moitié.
  for (let i = 0; i < 22; i++) { avance(2); store.backupNow('avant-x'); }
  const zips = fs.readdirSync(store.backupDir).filter(n => n.endsWith('.livres.zip'));
  const jsons = fs.readdirSync(store.backupDir).filter(n => n.endsWith('.json'));
  zips.forEach(z => assert.ok(jsons.includes(z.replace(/\.livres\.zip$/, '.json')), 'ZIP orphelin après la purge : ' + z));
  assert.ok(!fs.existsSync(zipDe(nommee)), 'la première sauvegarde a été purgée, son ZIP doit partir avec elle');
});

t('T-43 : changer le mot de passe rechiffre les livres du disque ET ceux des sauvegardes', () => {
  // Trouvé en corrigeant T-35 : les livres sont chiffrés avec la clé dérivée du mot de passe, et
  // `setPassword` ne rechiffrait que `cabinet-data.json` et ses sauvegardes. Au prochain démarrage,
  // chaque livre du portefeuille répondait « illisible » — pendant que l'écran annonçait « Les
  // sauvegardes ont été rechiffrées ».
  const { store, avance } = magasin('t43');
  const etat = store.create(MDP, { cabinet: { name: 'Cabinet' }, dossiers: [DOSSIER] });
  store.ecrireLivre(DOSSIER, livreAvecUnePiece(), null);
  const nommee = store.backupNow('avant-changement-mot-de-passe');
  avance(2);
  store.setPassword(etat, 'un-autre-mot-de-passe-long');
  const relu = store.lireLivre(DOSSIER, 2026, null);
  assert.ok(relu.livre, 'le livre du disque n\'a pas été rechiffré : ' + JSON.stringify(relu));
  // Et celui que la sauvegarde nommée emporte : on le prouve en effaçant le dossier puis en restaurant.
  store.removeDossierFiles(DOSSIER, [DOSSIER]);
  avance(2);
  store.restore(nommee);
  const depuisSauvegarde = store.lireLivre(DOSSIER, 2026, null);
  assert.ok(depuisSauvegarde.livre, 'le livre de la sauvegarde nommée n\'a pas été rechiffré : ' + JSON.stringify(depuisSauvegarde));
  // Une session rouverte avec le NOUVEAU mot de passe lit tout.
  const { createCabStore } = require('../../src/cabinet/cabstore.js');
  const store2 = createCabStore(path.dirname(store.file));
  assert.strictEqual(store2.unlock('un-autre-mot-de-passe-long').ok, true);
  assert.ok(store2.lireLivre(DOSSIER, 2026, null).livre, 'une session neuve ne lit pas le livre avec le nouveau mot de passe');
});

t('T-44 : la copie externe emporte les livres et leurs ZIP, et la reprise sur un poste neuf les rapporte', () => {
  // La copie externe emportait les livres depuis la 9.2.0 ; la reprise (« changer d\'ordinateur »)
  // ne les rapportait jamais. Le comptable avait tout bien fait et retrouvait ses dossiers sans une
  // écriture — « le pire défaut est celui qui punit quelqu\'un qui a tout bien fait » (6.8.1).
  const a = magasin('t44a');
  a.store.create(MDP, { cabinet: { name: 'Cabinet' }, dossiers: [DOSSIER] });
  a.store.ecrireLivre(DOSSIER, livreAvecUnePiece(), null);
  const nommee = a.store.backupNow('avant-x');
  const cle = path.join(a.racine, 'cle-usb');
  fs.mkdirSync(cle);
  a.store.setExternalDir(cle);
  const ext = path.join(cle, 'SkanFact Cabinet');
  assert.ok(fs.existsSync(path.join(ext, 'sauvegardes', path.basename(zipDe(nommee)))), 'le ZIP des livres ne suit pas sa sauvegarde sur la clé');
  assert.ok(fs.existsSync(path.join(ext, 'livres')), 'les livres ne partent pas sur la clé');
  const b = magasin('t44b');
  const vu = b.store.inspectSource(cle);
  assert.strictEqual(vu.livres, 1, 'l\'inspection ne compte pas les livres de la copie');
  const r = b.store.adoptSource(cle, MDP);
  assert.strictEqual(r.livres, 1, 'la reprise ne rapporte pas les livres');
  const relu = b.store.lireLivre(DOSSIER, 2026, null);
  assert.ok(relu.livre && relu.livre.ecritures.length === 1, 'le livre repris n\'est pas lisible sur le poste neuf : ' + JSON.stringify(relu));
  assert.ok(fs.existsSync(path.join(ext, 'livres')), 'la reprise ne doit rien enlever à la clé');
});
};
