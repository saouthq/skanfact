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
  const z = tranche(app, 'function vueCloture(', 'function brancherCloture(', 2000, 9000);
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
};
