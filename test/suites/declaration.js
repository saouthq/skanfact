'use strict';
// ============================================================================================
// La déclaration mensuelle (9.6.0) — les chiffres que le comptable recopie, et rien de plus
//
// Ce que ces tests tiennent : que chaque case se DÉDUIT des écritures, qu'elle est traçable
// jusqu'aux pièces qui la font, et qu'une case dont la règle n'est pas connue vaut `null` —
// jamais 0. Un zéro se recopie sur un formulaire ; un « — » avec sa raison se demande.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');

function livreDeTest(ecritures, plan) {
  const l = K.livreVide('D1', 2026, {
    plan: plan || [
      { compte: '4367', libelle: 'TVA collectée', role: 'tvaCollectee' },
      { compte: '4366', libelle: 'TVA déductible', role: 'tvaDeductible' },
      { compte: '4365', libelle: 'TVA à décaisser', role: 'tvaAPayer' },
      { compte: '4368', libelle: 'Timbre', role: 'timbre' },
      { compte: '4352', libelle: 'RS opérée', role: 'rsOperee' }
    ]
  });
  (ecritures || []).forEach((e, i) => l.ecritures.push({
    id: e.id || 'E' + (i + 1), numero: i + 1, statut: e.statut || 'validee',
    journal: e.journal || 'OD', piece: e.piece || '', date: e.date, libelle: e.libelle || '',
    lignes: e.lignes, source: e.source || 'saisie'
  }));
  return l;
}
// Une vente : client débité du TTC, ventes et TVA créditées.
const vente = (id, date, ht, tva, compteTva) => ({
  id, journal: 'VT', date, piece: id, lignes: [
    { compte: '411', libelle: 'Client', debit: ht + tva, credit: 0 },
    { compte: '706', libelle: 'Ventes', debit: 0, credit: ht },
    { compte: compteTva || '4367', libelle: 'TVA collectée', debit: 0, credit: tva }
  ]
});
const achat = (id, date, ht, tva) => ({
  id, journal: 'AC', date, piece: id, lignes: [
    { compte: '606', libelle: 'Achats', debit: ht, credit: 0 },
    { compte: '4366', libelle: 'TVA déductible', debit: tva, credit: 0 },
    { compte: '401', libelle: 'Fournisseur', debit: 0, credit: ht + tva }
  ]
});

t('9.6.0 : la déclaration se déduit des écritures, et chaque case porte ses pièces', () => {
  const livre = livreDeTest([vente('V1', '2026-03-04', 1000, 190), achat('A1', '2026-03-06', 500, 95)]);
  const d = K.declarationMensuelle(livre, '2026-03');
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.du, '2026-03-01');
  assert.strictEqual(d.au, '2026-03-31', 'le dernier jour du mois se calcule, il ne se devine pas');
  assert.strictEqual(d.cases.tvaCollectee.montant, 190);
  assert.strictEqual(d.cases.tvaDeductible.montant, 95);
  assert.strictEqual(d.cases.netAPayer.montant, 95);
  assert.strictEqual(d.cases.creditAReporter.montant, 0);
  // Traçable : la case nomme les écritures qui la font. Un chiffre qu'on ne peut pas ouvrir se
  // croit ou ne se croit pas ; un chiffre qui montre ses pièces se vérifie.
  assert.deepStrictEqual(d.cases.tvaCollectee.ecritures, ['V1']);
  assert.deepStrictEqual(d.cases.tvaDeductible.ecritures, ['A1']);
  // Février n'est pas mars : une période se borne aux deux bouts.
  const fevrier = K.declarationMensuelle(livre, '2026-02');
  assert.strictEqual(fevrier.cases.tvaCollectee.montant, 0);
  // Et une période qui n'a pas la forme d'un mois est refusée, pas devinée.
  assert.strictEqual(K.declarationMensuelle(livre, '2026').ok, false);
});

t('9.6.0 : une case dont la règle n\'est pas connue vaut null, jamais 0', () => {
  const livre = livreDeTest([vente('V1', '2026-03-04', 1000, 190)]);
  const d = K.declarationMensuelle(livre, '2026-03');
  ['tfp', 'foprolos', 'tcl', 'acomptes'].forEach(k => {
    assert.strictEqual(d.cases[k].montant, null, k + ' : un zéro se recopierait sur un formulaire');
    assert.ok(/À VÉRIFIER/.test(d.cases[k].motif), k + ' : la case doit dire POURQUOI elle est vide');
  });
  // Le jour où le plan du dossier porte un compte pour cette taxe, elle se calcule. C'est ce qui
  // fait que la règle « null » n'est pas un abandon : c'est une attente, et elle se lève.
  const avecTfp = livreDeTest(
    [{ id: 'P1', journal: 'OD', date: '2026-03-31', lignes: [{ compte: '645', libelle: 'TFP', debit: 20, credit: 0 }, { compte: '4537', libelle: 'TFP due', debit: 0, credit: 20 }] }],
    [{ compte: '4367', role: 'tvaCollectee' }, { compte: '4366', role: 'tvaDeductible' }, { compte: '4537', libelle: 'TFP', role: 'tfp' }]
  );
  const d2 = K.declarationMensuelle(avecTfp, '2026-03');
  assert.strictEqual(d2.cases.tfp.montant, 20);
  assert.deepStrictEqual(d2.cases.tfp.ecritures, ['P1']);
});

t('9.6.0 : le crédit reporté se LIT sur le compte, il ne se saisit pas', () => {
  // Février : 50 de collectée contre 200 de déductible → 150 de crédit. Mars : 300 de collectée.
  const livre = livreDeTest([
    vente('V1', '2026-02-04', 250, 50), achat('A1', '2026-02-06', 1000, 200),
    vente('V2', '2026-03-04', 1500, 300)
  ]);
  const fev = K.declarationMensuelle(livre, '2026-02');
  assert.strictEqual(fev.cases.creditReporte.montant, 0);
  assert.strictEqual(fev.cases.netAPayer.montant, 0, 'on ne paie pas un net négatif');
  assert.strictEqual(fev.cases.creditAReporter.montant, 150);
  // L'écriture de février impute 50 de déductible : il reste 150 sur le 4366.
  const ecr = K.ecritureDeclaration(livre, fev);
  assert.strictEqual(K.ecritureValide(ecr, []).ok, true, 'l\'écriture de déclaration doit s\'équilibrer');
  livre.ecritures.push({ ...ecr, id: 'DECL02', numero: 99, statut: 'validee' });
  const mars = K.declarationMensuelle(livre, '2026-03');
  assert.strictEqual(mars.cases.creditReporte.montant, 150, 'le report se lit sur le 4366, pas dans un champ');
  assert.strictEqual(mars.cases.netAPayer.montant, 150, '300 − 0 − 150');
});

t('9.6.0 : l\'écriture de déclaration solde le mois et porte le net au 4365', () => {
  const livre = livreDeTest([
    vente('V1', '2026-03-04', 1000, 190),
    achat('A1', '2026-03-06', 500, 95),
    // Un timbre encaissé et une retenue opérée : les deux entrent dans « à décaisser ».
    { id: 'T1', journal: 'VT', date: '2026-03-04', lignes: [{ compte: '411', debit: 1, credit: 0, libelle: 'Timbre' }, { compte: '4368', debit: 0, credit: 1, libelle: 'Timbre' }] },
    { id: 'R1', journal: 'AC', date: '2026-03-10', lignes: [{ compte: '401', debit: 15, credit: 0, libelle: 'RS' }, { compte: '4352', debit: 0, credit: 15, libelle: 'RS opérée' }] }
  ]);
  const d = K.declarationMensuelle(livre, '2026-03');
  assert.strictEqual(d.cases.timbre.montant, 1);
  assert.strictEqual(d.cases.retenuesOperees.montant, 15);
  assert.strictEqual(d.cases.aDecaisser.montant, 111, '95 de TVA + 1 de timbre + 15 de retenue');
  const ecr = K.ecritureDeclaration(livre, d);
  assert.strictEqual(ecr.date, '2026-03-31', 'une écriture d\'inventaire tombe au dernier jour du mois');
  assert.strictEqual(ecr.piece, 'DECL-2026-03');
  assert.strictEqual(K.ecritureValide(ecr, []).ok, true);
  const parCompte = {};
  ecr.lignes.forEach(l => { parCompte[l.compte] = K.round3((parCompte[l.compte] || 0) + l.debit - l.credit); });
  assert.strictEqual(parCompte['4367'], 190, 'la collectée se solde');
  assert.strictEqual(parCompte['4366'], -95, 'la déductible UTILISÉE se solde, pas plus');
  assert.strictEqual(parCompte['4368'], 1);
  assert.strictEqual(parCompte['4352'], 15);
  assert.strictEqual(parCompte['4365'], -111, 'et le 4365 porte ce qu\'il faut vraiment payer');
});

// Le défaut que le parcours réel a trouvé, et qu'aucun de mes tests ne pouvait voir : le jeu
// d'exemple porte les livres du CLIENT, et un client à jour a déjà passé son écriture de
// déclaration. Celle-ci DÉBITE le 4367 d'exactement ce que les ventes y ont crédité — donc un
// « crédit moins débit » sur le mois donne zéro, et un mois plein paraît vide.
t('9.6.0 : un mois DÉJÀ déclaré montre quand même ce qu\'il a collecté', () => {
  const livre = livreDeTest([vente('V1', '2026-03-04', 1000, 190), achat('A1', '2026-03-06', 500, 95)]);
  const avant = K.declarationMensuelle(livre, '2026-03');
  // Le client passe SA déclaration, avec SON libellé — jamais celui qu'on utiliserait.
  livre.ecritures.push({
    id: 'CLIENT-DECL', numero: 50, statut: 'validee', journal: 'OD', date: '2026-03-31',
    piece: 'TVA-2026-03', libelle: 'Déclaration mensuelle mars 2026', source: 'paquet',
    lignes: [
      { compte: '4367', libelle: 'TVA collectée', debit: 190, credit: 0 },
      { compte: '4366', libelle: 'TVA déductible imputée', debit: 0, credit: 95 },
      { compte: '4365', libelle: 'Net à payer', debit: 0, credit: 95 }
    ]
  });
  const apres = K.declarationMensuelle(livre, '2026-03');
  assert.strictEqual(apres.cases.tvaCollectee.montant, avant.cases.tvaCollectee.montant,
    'la déclaration ne compte pas l\'écriture qui la solde : sinon un mois plein paraît vide');
  assert.strictEqual(apres.cases.tvaDeductible.montant, 95);
  // Et l'écriture déjà passée est RECONNUE — à sa forme, pas à son libellé : c'est elle qui éteint
  // le bouton « Écrire l'écriture du mois ». La repasser compterait la TVA du mois deux fois.
  assert.strictEqual(apres.ecritureExistante, 'CLIENT-DECL');
  assert.strictEqual(avant.ecritureExistante, '');
  // Le contrôle le dit dans les deux sens : avant, le 4367 n'est pas soldé ; après, il l'est.
  const ctl = x => x.controles.find(c => c.id === 'tva-soldee');
  assert.strictEqual(ctl(avant).ok, false);
  assert.ok(/190/.test(ctl(avant).detail), 'le contrôle nomme ce qui reste au compte');
  assert.strictEqual(ctl(apres).ok, true);
});

t('9.6.0 : les contrôles avant dépôt nomment, ils ne bloquent pas', () => {
  const livre = livreDeTest([
    vente('V1', '2026-03-04', 1000, 190),
    { id: 'B1', statut: 'brouillard', journal: 'VT', date: '2026-03-20', lignes: [{ compte: '411', debit: 100, credit: 0 }, { compte: '706', debit: 0, credit: 100 }] },
    { id: 'X1', journal: 'OD', date: '2026-03-21', lignes: [{ compte: '471', libelle: 'En attente', debit: 60, credit: 0 }, { compte: '532', debit: 0, credit: 60 }] }
  ]);
  const d = K.declarationMensuelle(livre, '2026-03');
  const par = {}; d.controles.forEach(c => { par[c.id] = c; });
  assert.strictEqual(par.brouillard.ok, false);
  assert.ok(/brouillard/.test(par.brouillard.detail));
  assert.strictEqual(par.attente.ok, false);
  assert.ok(/60/.test(par.attente.detail), 'le contrôle nomme le montant resté en attente');
  // Un brouillard n'entre dans AUCUN chiffre : c'est le sens même du brouillard, et c'est ce que
  // le contrôle dit. La déclaration reste préparable — on ne fait pas la difficile (6.0.0).
  assert.strictEqual(d.cases.tvaCollectee.montant, 190);
  assert.strictEqual(K.poserDeclaration(livre, d, 'moi', 1).ok, true);
});

t('9.6.0 : une période n\'a qu\'UNE déclaration, et une déposée ne se refait pas en silence', () => {
  const livre = livreDeTest([vente('V1', '2026-03-04', 1000, 190)]);
  const d = K.declarationMensuelle(livre, '2026-03');
  assert.strictEqual(K.poserDeclaration(livre, d, 'moi', 1).ok, true);
  assert.strictEqual(K.poserDeclaration(livre, d, 'moi', 2).ok, true);
  assert.strictEqual(livre.declarations.length, 1, 'la refaire REMPLACE : deux chiffres du même mois et plus personne ne sait lequel a été déposé');
  // Une fois déposée, la refaire est refusée — avec le geste qui débloque.
  K.pointerDeclaration(livre, '2026-03', 'deposee', { le: '2026-04-15' }, 'moi', 3);
  const r = K.poserDeclaration(livre, d, 'moi', 4);
  assert.strictEqual(r.ok, false);
  assert.ok(/Dé-pointe/.test(r.motif));
});

t('9.6.0 : « déposée » et « payée » sont des pense-bêtes, et ils se DÉFONT', () => {
  const livre = livreDeTest([vente('V1', '2026-03-04', 1000, 190)]);
  K.poserDeclaration(livre, K.declarationMensuelle(livre, '2026-03'), 'moi', 1);
  // On ne paie pas ce qu'on n'a pas déposé : l'ordre des deux pense-bêtes est une information.
  assert.strictEqual(K.pointerDeclaration(livre, '2026-03', 'payee', { le: '2026-04-20' }, 'moi', 2).ok, false);
  assert.strictEqual(K.pointerDeclaration(livre, '2026-03', 'deposee', { le: '2026-04-15', reference: 'ABC' }, 'moi', 3).ok, true);
  assert.strictEqual(livre.declarations[0].deposee.reference, 'ABC');
  assert.strictEqual(K.pointerDeclaration(livre, '2026-03', 'payee', { le: '2026-04-20' }, 'moi', 4).ok, true);
  // Et tout se défait (droit à l'erreur, 7.12.0) : un pense-bête qui ne se défait pas devient un
  // mensonge le jour où l'on se trompe de mois.
  assert.strictEqual(K.pointerDeclaration(livre, '2026-03', 'payee', null, 'moi', 5).ok, true);
  assert.strictEqual(livre.declarations[0].payee.le, '');
  assert.ok(livre.audit.some(a => /dé-pointage/.test(a.quoi)), 'et la piste d\'audit le dit');
  assert.strictEqual(K.pointerDeclaration(livre, '2026-04', 'deposee', { le: 'x' }, 'moi', 6).ok, false);
});

t('9.6.0 : l\'état d\'un mois se déduit — reçu, saisi, déclaré, payé', () => {
  const livre = livreDeTest([]);
  assert.strictEqual(K.etatDuMois(livre, '2026-03', {}).etat, 'rien');
  assert.strictEqual(K.etatDuMois(livre, '2026-03', { recu: true }).etat, 'reçu');
  livre.ecritures.push({ id: 'B', statut: 'brouillard', journal: 'VT', date: '2026-03-04', lignes: [] });
  assert.strictEqual(K.etatDuMois(livre, '2026-03', { recu: true }).etat, 'reçu', 'un brouillard n\'est pas une saisie faite');
  assert.strictEqual(K.etatDuMois(livre, '2026-03', { recu: true }).brouillard, 1);
  livre.ecritures.push({ id: 'V', statut: 'validee', journal: 'VT', date: '2026-03-05', lignes: [] });
  assert.strictEqual(K.etatDuMois(livre, '2026-03', { recu: true }).etat, 'saisi');
  K.poserDeclaration(livre, K.declarationMensuelle(livre, '2026-03'), 'moi', 1);
  assert.strictEqual(K.etatDuMois(livre, '2026-03', { recu: true }).etat, 'saisi', 'préparer n\'est pas déposer');
  K.pointerDeclaration(livre, '2026-03', 'deposee', { le: '2026-04-15' }, 'moi', 2);
  assert.strictEqual(K.etatDuMois(livre, '2026-03', { recu: true }).etat, 'déclaré');
  K.pointerDeclaration(livre, '2026-03', 'payee', { le: '2026-04-20' }, 'moi', 3);
  assert.strictEqual(K.etatDuMois(livre, '2026-03', { recu: true }).etat, 'payé');
});

t('9.6.0 : le détail par TAUX ne s\'invente pas', () => {
  // Un seul compte de TVA collectée : rendre un tableau à une ligne laisserait croire que tout est
  // au même taux. On rend `null`, et l'écran le dit.
  const un = livreDeTest([vente('V1', '2026-03-04', 1000, 190)]);
  assert.strictEqual(K.declarationMensuelle(un, '2026-03').parTaux, null);
  // Des sous-comptes par taux : le détail existe, et il tombe juste.
  const plusieurs = livreDeTest([
    vente('V1', '2026-03-04', 1000, 190, '43671'),
    vente('V2', '2026-03-05', 1000, 70, '43672')
  ]);
  const d = K.declarationMensuelle(plusieurs, '2026-03');
  assert.strictEqual(d.cases.tvaCollectee.montant, 260, 'le total reste le total');
  assert.deepStrictEqual(d.parTaux, [{ compte: '43671', montant: 190 }, { compte: '43672', montant: 70 }]);
});

t('9.6.0 : les comptes fiscaux n\'existent qu\'à UN endroit', () => {
  const C = require('../../src/renderer/core.js');
  Object.keys(K.COMPTES_FISCAUX).forEach(role => {
    assert.strictEqual(C.DEFAULT_ACCOUNTS[role], K.COMPTES_FISCAUX[role],
      'le compte « ' + role + ' » diffère entre core.js et compta.js : deux déclarations qui ne lisent pas les mêmes comptes ne se comparent pas');
  });
});

t('9.6.0 : le plan du dossier prime sur le compte par défaut', () => {
  // Un cabinet qui a ses propres numéros ne doit pas voir une déclaration vide : c'est le RÔLE qui
  // désigne le compte, jamais le numéro écrit dans le code (règle de la 6.3.0, aucun numéro de
  // compte n'est une vérité).
  const livre = livreDeTest(
    [{ id: 'V1', journal: 'VT', date: '2026-03-04', lignes: [{ compte: '411', debit: 1190, credit: 0 }, { compte: '706', debit: 0, credit: 1000 }, { compte: '44571', libelle: 'TVA', debit: 0, credit: 190 }] }],
    [{ compte: '44571', libelle: 'TVA collectée', role: 'tvaCollectee' }, { compte: '44566', libelle: 'TVA déductible', role: 'tvaDeductible' }]
  );
  const d = K.declarationMensuelle(livre, '2026-03');
  assert.strictEqual(d.cases.tvaCollectee.montant, 190);
  assert.strictEqual(d.comptes.collectee, '44571');
});

t('10.14.0 : une pièce saisie APRÈS l\'écriture du mois — le complément pose ce qui manque, et l\'écran ne se contredit plus', () => {
  // Trouvé à la souris dans le Cabinet : DECL-2026-09 validée (190 collectée, 380 déductible),
  // puis une vente de 95 de TVA saisie en septembre. L'écran disait « Écriture du mois passée ✓ »
  // au-dessus de « l'écriture de déclaration n'a pas été passée », et plus rien ne l'écrivait.
  const decl = (piece, lignes, statut) => ({ id: piece, piece, journal: 'OD', date: '2026-09-30', statut, lignes });
  // 1. Un mois en CRÉDIT : 190 collectée, 380 déductible → D 4367 190 / C 4366 190.
  const livre = livreDeTest([vente('V1', '2026-09-10', 1000, 190), achat('A1', '2026-09-12', 2000, 380),
    decl('DECL-2026-09', [{ compte: '4367', debit: 190, credit: 0 }, { compte: '4366', debit: 0, credit: 190 }])]);
  const avant = K.declarationMensuelle(livre, '2026-09');
  assert.strictEqual(avant.ecritureExistante, 'DECL-2026-09');
  assert.deepStrictEqual(avant.complement, [], 'une écriture qui couvre le mois n\'appelle aucun complément');
  assert.ok(avant.controles.every(c => c.ok), avant.controles.filter(c => !c.ok).map(c => c.detail).join(' | '));
  livre.ecritures.push({ id: 'V2', numero: 9, statut: 'validee', journal: 'VT', piece: 'V2', date: '2026-09-15', libelle: '', source: 'saisie',
    lignes: vente('V2', '2026-09-15', 500, 95).lignes });
  const apres = K.declarationMensuelle(livre, '2026-09');
  // Calculé à la main : collectée 285, déductible 380 → l'écriture entière imputerait 285 de 4366.
  // Déjà passés : 190. Ce qui manque : D 4367 95 / C 4366 95 — et rien au 4365 (le mois reste en crédit).
  assert.strictEqual(apres.cases.tvaCollectee.montant, 285);
  assert.strictEqual(apres.cases.creditAReporter.montant, 95);
  assert.deepStrictEqual(apres.complement.map(l => [l.compte, l.debit, l.credit]), [['4367', 95, 0], ['4366', 0, 95]]);
  const par = {}; apres.controles.forEach(c => { par[c.id] = c; });
  assert.strictEqual(par['decl-complete'].ok, false);
  assert.ok(/DECL-2026-09 ne couvre plus tout le mois/.test(par['decl-complete'].detail) && /complément/.test(par['decl-complete'].detail));
  // Et plus jamais « n'a pas été passée » à côté d'une écriture passée.
  assert.ok(apres.controles.every(c => !/n'a pas été passée/.test(c.detail)), 'deux phrases du même écran se contredisent');
  // Le complément posé et validé : il est reconnu comme écriture de déclaration (il ne compte pas
  // dans la TVA qu'il solde), le mois tombe juste, et il n'en appelle pas un second.
  const ec = K.ecritureComplementDeclaration(livre, apres);
  assert.strictEqual(ec.piece, 'DECL-2026-09-C1');
  assert.strictEqual(ec.date, '2026-09-30');
  livre.ecritures.push({ id: 'C1', numero: null, statut: 'brouillard', journal: ec.journal, piece: ec.piece, date: ec.date, libelle: ec.libelle, source: 'saisie', lignes: ec.lignes });
  // Au brouillard, le complément ne solde rien encore : le contrôle nomme CELUI qui attend — pas
  // « un mois précédent n'est pas soldé », trouvé à la souris sur ce geste exact.
  const enAttente = K.declarationMensuelle(livre, '2026-09');
  assert.strictEqual(enAttente.ecritureAuBrouillard, 'C1');
  assert.deepStrictEqual(enAttente.complement, [], 'un complément au brouillard ne s\'en appelle pas un second');
  const ts = enAttente.controles.find(c => c.id === 'tva-soldee');
  assert.ok(!ts.ok && /DECL-2026-09-C1 est encore au brouillard/.test(ts.detail), ts.detail);
  livre.ecritures[livre.ecritures.length - 1].statut = 'validee';
  const fin = K.declarationMensuelle(livre, '2026-09');
  assert.strictEqual(fin.cases.tvaCollectee.montant, 285, 'le complément ne se compte pas dans la TVA qu\'il solde');
  assert.deepStrictEqual(fin.complement, []);
  assert.ok(fin.controles.every(c => c.ok), fin.controles.filter(c => !c.ok).map(c => c.detail).join(' | '));
  assert.strictEqual(K.ecritureComplementDeclaration(livre, fin), null);
  // Une pièce de PLUS après le complément : le second se numérote C2, et la phrase parle des DEUX.
  livre.ecritures.push({ id: 'V3', numero: 11, statut: 'validee', journal: 'VT', piece: 'V3', date: '2026-09-20', libelle: '', source: 'saisie',
    lignes: vente('V3', '2026-09-20', 100, 19).lignes });
  const encore = K.declarationMensuelle(livre, '2026-09');
  assert.strictEqual(K.ecritureComplementDeclaration(livre, encore).piece, 'DECL-2026-09-C2');
  const dc2 = encore.controles.find(c => c.id === 'decl-complete');
  assert.ok(/Les écritures de déclaration DECL-2026-09 et DECL-2026-09-C1 ne couvrent plus/.test(dc2.detail), dc2.detail);

  // 2. Un mois qui PAIE : un achat arrivé après laisse le 4367 soldé, mais la dette du 4365 fausse.
  //    Collectée 190, déductible 0 → passé D 4367 190 / C 4365 190. Puis un achat de 38 de TVA :
  //    l'écriture entière serait D 4367 190 / C 4366 38 / C 4365 152 → complément D 4365 38 / C 4366 38.
  const paie = livreDeTest([vente('V1', '2026-04-10', 1000, 190),
    decl('DECL-2026-04', [{ compte: '4367', debit: 190, credit: 0 }, { compte: '4365', debit: 0, credit: 190 }])]);
  paie.ecritures[1].date = '2026-04-30';
  paie.ecritures.push({ id: 'A2', numero: 5, statut: 'validee', journal: 'AC', piece: 'A2', date: '2026-04-20', libelle: '', source: 'saisie', lignes: achat('A2', '2026-04-20', 200, 38).lignes });
  const p = K.declarationMensuelle(paie, '2026-04');
  const pc = {}; p.controles.forEach(c => { pc[c.id] = c; });
  assert.strictEqual(pc['tva-soldee'].ok, true, 'le 4367 tombe juste : ce n\'est pas lui qui le dit');
  assert.strictEqual(pc['decl-complete'].ok, false, 'une dette de TVA surévaluée de 38 passait sans un mot');
  assert.deepStrictEqual(p.complement.map(l => [l.compte, l.debit, l.credit]), [['4366', 0, 38], ['4365', 38, 0]]);

  // 4. Une écriture du client passée sur un SOUS-compte (43671) compte pour son rôle (4367) : le
  //    complément ne crédite pas 190 au 43671 pour débiter 285 au 4367 — il pose les 95 qui manquent.
  const sous = livreDeTest([vente('V1', '2026-06-10', 1000, 190, '43671'), achat('A1', '2026-06-12', 2000, 380),
    decl('DECL-2026-06', [{ compte: '43671', debit: 190, credit: 0 }, { compte: '4366', debit: 0, credit: 190 }])]);
  sous.ecritures[2].date = '2026-06-30';
  sous.ecritures.push({ id: 'V2', numero: 9, statut: 'validee', journal: 'VT', piece: 'V2', date: '2026-06-15', libelle: '', source: 'saisie',
    lignes: vente('V2', '2026-06-15', 500, 95, '43671').lignes });
  assert.deepStrictEqual(K.declarationMensuelle(sous, '2026-06').complement.map(l => [l.compte, l.debit, l.credit]), [['4367', 95, 0], ['4366', 0, 95]],
    'un sous-compte ne compte pas pour son rôle');

  // 3. Au BROUILLARD, l'écriture ne solde encore rien : le contrôle le dit tel quel.
  const br = livreDeTest([vente('V1', '2026-05-10', 1000, 190),
    decl('DECL-2026-05', [{ compte: '4367', debit: 190, credit: 0 }, { compte: '4365', debit: 0, credit: 190 }], 'brouillard')]);
  br.ecritures[1].date = '2026-05-31';
  const b = K.declarationMensuelle(br, '2026-05');
  const bs = b.controles.find(c => c.id === 'tva-soldee');
  assert.strictEqual(bs.ok, false);
  assert.ok(/encore au brouillard/.test(bs.detail), bs.detail);
});

t('10.14.0 : un dépôt se pointe sur les chiffres qu\'on recopie — préparés avant une pièce, ils sont refusés', () => {
  const livre = livreDeTest([vente('V1', '2026-09-10', 1000, 190)]);
  const d0 = K.declarationMensuelle(livre, '2026-09');
  assert.strictEqual(K.poserDeclaration(livre, d0, 'A', 1).ok, true);
  assert.deepStrictEqual(K.declarationMensuelle(livre, '2026-09').ecart, [], 'une préparation fraîche n\'a aucun écart');
  livre.ecritures.push({ id: 'V2', numero: 2, statut: 'validee', journal: 'VT', piece: 'V2', date: '2026-09-15', libelle: '', source: 'saisie', lignes: vente('V2', '2026-09-15', 500, 95).lignes });
  const d1 = K.declarationMensuelle(livre, '2026-09');
  const coll = d1.ecart.find(x => x.cle === 'tvaCollectee');
  assert.deepStrictEqual([coll.avant, coll.maintenant], [190, 285]);
  assert.ok(/TVA collectée : 190,000.*→ 285,000/.test(K.phraseEcartDeclaration(d1.ecart)), K.phraseEcartDeclaration(d1.ecart));
  // Pointer « déposée » sur la préparation périmée est refusé — en nommant ce qui a bougé.
  const r = K.pointerDeclaration(livre, '2026-09', 'deposee', { le: '2026-10-10' }, 'A', 2);
  assert.strictEqual(r.ok, false);
  assert.ok(/recalcule la déclaration/.test(r.motif) && /190,000/.test(r.motif));
  // Recalculer, puis pointer : ça passe.
  assert.strictEqual(K.poserDeclaration(livre, d1, 'A', 3).ok, true);
  assert.strictEqual(K.pointerDeclaration(livre, '2026-09', 'deposee', { le: '2026-10-10' }, 'A', 4).ok, true);
  // Une pièce arrive APRÈS le dépôt : on ne bloque rien (6.0.0), mais un contrôle le dit.
  livre.ecritures.push({ id: 'V3', numero: 3, statut: 'validee', journal: 'VT', piece: 'V3', date: '2026-09-20', libelle: '', source: 'saisie', lignes: vente('V3', '2026-09-20', 100, 19).lignes });
  const d2 = K.declarationMensuelle(livre, '2026-09');
  const dp = d2.controles.find(c => c.id === 'depot-perime');
  assert.strictEqual(dp.ok, false);
  assert.ok(/Déposée le 10\/10\/2026 avec d'autres chiffres/.test(dp.detail) && /rectificative/.test(dp.detail), dp.detail);
  // Et dé-pointer reste possible sur une déclaration périmée : ce qui se pointe se dé-pointe (7.12.0).
  assert.strictEqual(K.pointerDeclaration(livre, '2026-09', 'deposee', null, 'A', 5).ok, true);
});

t('10.14.0 : le Cabinet écrit le complément par le même bouton, et « Marquer déposée » s\'éteint sur des chiffres périmés', () => {
  const fs = require('fs'), path = require('path');
  const sans = f => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const main = sans('src/cabinet/main.js'), app = sans('src/cabinet/renderer/app.js');
  const h = main.slice(main.indexOf("ipcMain.handle('cab:ecrireDeclaration'"), main.indexOf('const brouillon = KC.ecritureDeclaration(o.livre, d);'));
  assert.ok(h.length > 100 && h.length < 2000, 'tranche inattendue');
  // Une écriture existante n'est plus un refus sec : ce qui lui manque se pose.
  assert.ok(/if \(d\.ecritureExistante\) \{\s*const complement = KC\.ecritureComplementDeclaration\(o\.livre, d\);\s*if \(!complement\) throw/.test(h), 'le pont refuse encore d\'écrire ce qui manque');
  assert.ok(/KC\.ajouterEcriture\(o\.livre, complement,/.test(h));
  // L'écran : le bouton de l'écriture se rallume sur un complément, celui du dépôt s'éteint sur des
  // chiffres préparés périmés — par ce que le MOTEUR rend (`complement`, `ecart`), jamais recalculé ici.
  assert.ok(/const aCompleter = ecrite && \(d\.complement \|\| \[\]\)\.length > 0;/.test(app));
  assert.ok(/id="dc-ecriture" \$\{!posee \|\| \(ecrite && !aCompleter\) \? 'disabled' : ''\}/.test(app), 'le bouton de l\'écriture reste éteint sur un complément');
  assert.ok(/const perime = !!\(posee && ecart\.length\);/.test(app) && /const ecart = d\.ecart \|\| \[\];/.test(app));
  assert.ok(/id="dc-deposee" \$\{!posee \|\| motifPerime \? 'disabled' : ''\}/.test(app), '« Marquer déposée » reste allumé sur des chiffres périmés');
  assert.ok(/const suivante = !posee \|\| \(perime && !deposee\) \? 'preparer' : \(!ecrite \|\| aCompleter\) \? 'ecriture'/.test(app), 'le vert ne suit pas le travail qui reste');
  assert.ok(/const LIBELLE_CASE = KC\.LIBELLES_CASES_DECL;/.test(app), 'deux tables de noms de cases divergeraient');
});
// 10.14.1 (D1) — le comptable RECOPIE les cases sur le portail. Ce qui supprime la ressaisie sans rien
// déposer : un clic copie le montant sous la forme que le portail accepte, et la date limite se lit
// sur l'écran où l'on déclare, par la MÊME règle que le calendrier des Échéances.
t('10.14.1 (D1) : un montant copié pour le portail, sans espace ni devise, dans la forme choisie', () => {
  const KB = require('../../src/cabinet/cabcore.js');
  // Des montants qui DISCRIMINENT (9.6.1) : un millime, un négatif, un arrondi au demi-millime,
  // un zéro de tête dans la partie décimale.
  assert.strictEqual(KB.montantPortail(1234.567, 'point'), '1234.567');
  assert.strictEqual(KB.montantPortail(1234.567, 'virgule'), '1234,567');
  assert.strictEqual(KB.montantPortail(1234.567, 'millimes'), '1234567');
  assert.strictEqual(KB.montantPortail(12.3, 'point'), '12.300', 'la décimale se complète : un portail qui attend trois chiffres');
  assert.strictEqual(KB.montantPortail(0.05, 'virgule'), '0,050');
  assert.strictEqual(KB.montantPortail(-0.5, 'virgule'), '-0,500', 'un négatif garde son signe (un crédit)');
  assert.strictEqual(KB.montantPortail(2.0005, 'point'), '2.001', 'arrondi au millime, pas tronqué');
  assert.strictEqual(KB.montantPortail(1000000, 'point'), '1000000.000', 'jamais une espace de milliers : le portail la refuserait');
  // Un réglage inconnu retombe sur le point ; absent, il vaut le point.
  assert.strictEqual(KB.migrate({}).settings.formatCopie, 'point');
  assert.strictEqual(KB.migrate({ settings: { formatCopie: 'n\'importe' } }).settings.formatCopie, 'point');
  assert.strictEqual(KB.migrate({ settings: { formatCopie: 'millimes' } }).settings.formatCopie, 'millimes');
  // Chaque forme proposée à l'écran est une forme que la fonction sait écrire.
  KB.FORMATS_COPIE.forEach(f => assert.ok(/^-?\d+([.,]\d{3})?$/.test(KB.montantPortail(7.25, f.id)), f.id));
});

t('10.14.1 (D1) : la date limite d\'une déclaration est celle du calendrier des Échéances', () => {
  const KB = require('../../src/cabinet/cabcore.js');
  const s = KB.migrate({ settings: { deadlines: { tvaDay: 28, cnssDay: 15 } } });
  assert.strictEqual(KB.dateLimiteDeclaration(s, '2026-09', 'tva'), '2026-10-28');
  // La CNSS se dépose après la FIN du trimestre, quel que soit le mois regardé.
  assert.strictEqual(KB.dateLimiteDeclaration(s, '2026-08', 'cnss'), '2026-10-15');
  assert.strictEqual(KB.dateLimiteDeclaration(s, '2026-12', 'cnss'), '2027-01-15', 'le 4e trimestre bascule sur janvier');
  // Un dossier trimestriel : février se dépose avec mars, en avril — pas le 28 mars.
  const trim = { tvaPeriod: 'trimestrielle' };
  assert.strictEqual(KB.dateLimiteDeclaration(s, '2026-02', 'tva', trim), '2026-04-28');
  assert.strictEqual(KB.dateLimiteDeclaration(s, '2026-02', 'tva', {}), '2026-03-28');
  // Février n'a pas de 30 : le jour se ramène au dernier jour, comme dans le calendrier.
  const s30 = KB.migrate({ settings: { deadlines: { tvaDay: 30, cnssDay: 15 } } });
  assert.strictEqual(KB.dateLimiteDeclaration(s30, '2026-01', 'tva'), '2026-02-28');
  // La MÊME date que le calendrier : on confronte CHAQUE échéance de TVA et de CNSS à `echeances`.
  const st = KB.migrate({ settings: { deadlines: { tvaDay: 28, cnssDay: 15 } }, dossiers: [
    { id: 'd1', name: 'Mensuel', months: ['2026-08'], from: '2026-01' },
    { id: 'd2', name: 'Trimestriel', months: ['2026-06'], from: '2026-01', tvaPeriod: 'trimestrielle' }] });
  const liste = KB.echeances(st, '2026-09-10').filter(x => ['tva-m', 'tva-t', 'cnss'].includes(x.id));
  assert.ok(liste.some(x => x.id === 'tva-m') && liste.some(x => x.id === 'tva-t') && liste.some(x => x.id === 'cnss'), 'des données qui ne discriminent pas');
  liste.forEach(x => {
    const dossier = x.id === 'tva-t' ? st.dossiers[1] : st.dossiers[0];
    // Le PREMIER mois de la période : c'est lui que la règle doit ramener à la fin du trimestre.
    assert.strictEqual(KB.dateLimiteDeclaration(st, x.mois[0], x.id === 'cnss' ? 'cnss' : 'tva', dossier), x.date,
      `${x.label} : deux écrans, deux dates pour la même échéance`);
  });
});

t('10.14.1 (D1) : l\'écran copie par le moteur, retient la forme, et dit la date limite', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const main = lireSource('src', 'cabinet', 'main.js');
  // Le montant à copier vient du MOTEUR, jamais d'un `toFixed` de l'écran (10.10.0).
  const b = app.slice(app.indexOf('function boutonCopie('), app.indexOf('function reglageCopie('));
  assert.ok(b.length > 100 && b.length < 900, 'tranche inattendue');
  assert.ok(/K\.montantPortail\(montant, formatCopie\(\)\)/.test(b), 'la copie doit passer par K.montantPortail');
  // Chaque case chiffrée porte son bouton ; le message dit ce qui a été copié.
  assert.ok(/c\.montant == null \? '<span class="muted">—<\/span>' : boutonCopie\(k, c\.montant\)/.test(app), 'une case chiffrée sans bouton de copie');
  assert.ok(/toast\(`Copié : \$\{txt\}/.test(app), 'le message doit dire exactement ce qui a été copié');
  // La forme se retient : fusionnée dans les réglages comme le thème, jamais en remplaçant.
  assert.ok(/state\.settings = \{ \.\.\.state\.settings, formatCopie: String\(p\.settings\.formatCopie\) \}/.test(main), 'la forme de copie n\'est pas enregistrée');
  assert.ok(/settings: \{ formatCopie: fmt\.value \}/.test(app), 'le sélecteur n\'enregistre pas la forme');
  // La date limite vient de la règle partagée, et la ligne est posée en tête des étapes.
  assert.ok(/K\.dateLimiteDeclaration\(S, periode, sorte, dossier\)/.test(app), 'la date limite doit venir de la règle du calendrier');
  assert.ok(/ligneEcheanceDeclaration\(dossier, d\.periode, deposee && posee\.deposee\.le\)/.test(app), 'la date limite n\'est pas sur l\'écran de la déclaration');
  // Le lien ouvre le NAVIGATEUR : une adresse http(s) en target=_blank, que la fenêtre renvoie dehors.
  assert.ok(/href="\$\{esc\(portail\.url\)\}" target="_blank" rel="noopener"/.test(app), 'le portail doit s\'ouvrir dans le navigateur');
  assert.ok(/setWindowOpenHandler\(\(\{ url \}\) => \{ if \(\/\^https\?:\/\.test\(url\)\) shell\.openExternal\(url\)/.test(main), 'un lien du Cabinet ne s\'ouvre plus dehors');
});
};
