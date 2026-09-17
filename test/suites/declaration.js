'use strict';
// ============================================================================================
// La déclaration mensuelle (9.6.0) — les chiffres que le comptable recopie, et rien de plus
//
// Ce que ces tests tiennent : que chaque case se DÉDUIT des écritures, qu'elle est traçable
// jusqu'aux pièces qui la font, et qu'une case dont la règle n'est pas connue vaut `null` —
// jamais 0. Un zéro se recopie sur un formulaire ; un « — » avec sa raison se demande.
module.exports = ({ t, assert }) => {
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
};
