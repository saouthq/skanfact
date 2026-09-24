'use strict';
// ============================================================================================
// La clôture d'exercice (9.8.0)
//
// Ce que ces tests tiennent : que les contrôles NOMMENT sans jamais bloquer, qu'une clôture est
// définitive et qu'une réouverture exige un motif, que les à-nouveaux se calculent sur les
// écritures RÉELLES seules — jamais sur les à-nouveaux précédents, ce qui compterait le passé deux
// fois — et que le fichier envoyé au client refuse plus qu'il n'accepte.
module.exports = ({ t, assert }) => {
const K = require('../../src/renderer/compta.js');

function livreRempli(opts) {
  const o = opts || {};
  const l = K.livreVide('D1', 2026, {
    plan: [
      { compte: '411', libelle: 'Clients', role: 'clients' },
      { compte: '401', libelle: 'Fournisseurs', role: 'fournisseurs' },
      { compte: '532', libelle: 'Banque', role: 'banque' },
      { compte: '706', libelle: 'Prestations', role: 'ventes' },
      { compte: '606', libelle: 'Achats', role: 'charges' },
      { compte: '13', libelle: 'Résultat', role: 'resultat' }
    ]
  });
  const pose = (e, valide) => {
    const n = K.ajouterEcriture(l, e, 'test', 1);
    if (valide !== false) K.validerEcriture(l, n.id, 'test', 1);
    return n;
  };
  // Une vente de 1 000, encaissée ; un achat de 400, payé. Résultat = 600.
  pose({ journal: 'VT', date: '2026-03-10', piece: 'FAC-1', libelle: 'Vente', source: 'saisie',
    lignes: [{ compte: '411', libelle: 'Client', debit: 1000, credit: 0 }, { compte: '706', libelle: 'Vente', debit: 0, credit: 1000 }] });
  pose({ journal: 'BQ', date: '2026-03-20', piece: 'ENC-1', libelle: 'Encaissement', source: 'saisie',
    lignes: [{ compte: '532', libelle: 'Banque', debit: 1000, credit: 0 }, { compte: '411', libelle: 'Client', debit: 0, credit: 1000 }] });
  pose({ journal: 'AC', date: '2026-04-02', piece: 'FA-1', libelle: 'Achat', source: 'saisie',
    lignes: [{ compte: '606', libelle: 'Achat', debit: 400, credit: 0 }, { compte: '401', libelle: 'Fournisseur', debit: 0, credit: 400 }] });
  pose({ journal: 'BQ', date: '2026-04-10', piece: 'REG-1', libelle: 'Règlement', source: 'saisie',
    lignes: [{ compte: '401', libelle: 'Fournisseur', debit: 400, credit: 0 }, { compte: '532', libelle: 'Banque', debit: 0, credit: 400 }] });
  if (o.brouillard) {
    pose({ journal: 'OD', date: '2026-05-01', piece: 'OD-X', libelle: 'En attente', source: 'saisie',
      lignes: [{ compte: '606', libelle: 'x', debit: 50, credit: 0 }, { compte: '401', libelle: 'x', debit: 0, credit: 50 }] }, false);
  }
  return l;
}

// ---------------------------------------------------------------- les contrôles

t('9.8.0 : les contrôles NOMMENT et ne bloquent jamais', () => {
  const l = livreRempli({ brouillard: true });
  const c = K.controlesCloture(l);
  const parId = {};
  c.forEach(x => { parId[x.id] = x; });
  assert.ok(parId.brouillard && !parId.brouillard.ok, 'le brouillard restant doit être signalé');
  assert.ok(/[Vv]alide/.test(parId.brouillard.detail), 'le contrôle doit dire un GESTE, pas un constat');
  assert.ok(parId.equilibre.ok, 'la balance de ce livre est équilibrée');
  // Et surtout : ils ne bloquent pas. La clôture passe malgré le brouillard, et elle le DIT.
  const r = K.cloturerExercice(l, 'test', 1000);
  assert.ok(r.ok, 'un contrôle en échec ne doit jamais empêcher de clôturer');
  assert.strictEqual(r.brouillards, 1, 'la clôture doit dire combien de pièces restent en brouillard');
});

t('9.8.0 : le compte d\'attente et les tiers au solde inversé sont signalés', () => {
  const l = livreRempli();
  const n = K.ajouterEcriture(l, {
    journal: 'OD', date: '2026-06-01', piece: 'OD-471', libelle: 'À ventiler', source: 'saisie',
    lignes: [{ compte: '471', libelle: 'À ventiler', debit: 120, credit: 0 }, { compte: '532', libelle: 'Banque', debit: 0, credit: 120 }]
  }, 'test', 1);
  K.validerEcriture(l, n.id, 'test', 1);
  const c = K.controlesCloture(l).find(x => x.id === 'attente');
  assert.ok(!c.ok && /120/.test(c.detail), 'le compte d\'attente doit être nommé avec son solde');
});

// ---------------------------------------------------------------- clôture et réouverture

t('9.8.0 : une clôture est définitive, et une réouverture exige un MOTIF', () => {
  const l = livreRempli();
  assert.ok(K.cloturerExercice(l, 'skander', 5000).ok);
  assert.strictEqual(l.exercice.clos, true);
  assert.strictEqual(l.exercice.closPar, 'skander');
  // Deux fois, non.
  const deux = K.cloturerExercice(l, 'skander', 6000);
  assert.ok(!deux.ok && /déjà clos/.test(deux.motif));
  // Rouvrir sans motif, non plus.
  assert.ok(!K.rouvrirExercice(l, '', 'skander', 7000).ok);
  assert.ok(!K.rouvrirExercice(l, 'oups', 'skander', 7000).ok, 'un motif de quatre lettres n\'explique rien');
  const r = K.rouvrirExercice(l, 'Facture d\'électricité de décembre reçue après la clôture', 'skander', 7000);
  assert.ok(r.ok);
  assert.strictEqual(l.exercice.clos, false);
  assert.strictEqual(l.exercice.reouvertures.length, 1);
  assert.ok(/électricité/.test(l.exercice.reouvertures[0].motif), 'le motif doit être gardé : c\'est la seule trace');
  assert.ok(l.audit.some(a => a.quoi === 'exercice rouvert'), 'la réouverture doit laisser une trace d\'audit');
});

// ---------------------------------------------------------------- les à-nouveaux

t('9.8.0 : les à-nouveaux reportent le BILAN et portent le net de la gestion au résultat', () => {
  const l = livreRempli();
  const an = K.anouveauxDe(l);
  assert.ok(an.equilibre, 'des à-nouveaux déséquilibrés propageraient une balance fausse');
  const par = {};
  an.lignes.forEach(x => { par[x.compte] = x; });
  // La banque a reçu 1 000 et payé 400 : elle rouvre à 600 au débit.
  assert.strictEqual(par['532'].debit, 600);
  // Les comptes de gestion ne se reportent PAS : leur net va au compte de résultat.
  assert.ok(!par['706'] && !par['606'], 'un compte de gestion ne se reporte jamais tel quel');
  assert.strictEqual(par['13'].credit, 600, 'un bénéfice de 600 est un CRÉDIT au compte de résultat');
  assert.strictEqual(an.resultat, 600);
});

t('9.8.0 : une PERTE est un débit au compte de résultat', () => {
  const l = K.livreVide('D1', 2026);
  const n = K.ajouterEcriture(l, {
    journal: 'AC', date: '2026-02-01', piece: 'FA-1', libelle: 'Achat', source: 'saisie',
    lignes: [{ compte: '606', libelle: 'Achat', debit: 250, credit: 0 }, { compte: '401', libelle: 'Fournisseur', debit: 0, credit: 250 }]
  }, 'test', 1);
  K.validerEcriture(l, n.id, 'test', 1);
  const an = K.anouveauxDe(l);
  const res = an.lignes.find(x => x.compte === '13');
  assert.strictEqual(res.debit, 250, 'une perte de 250 est un DÉBIT');
  assert.strictEqual(an.resultat, -250);
  assert.ok(an.equilibre);
});

t('9.8.0 : les à-nouveaux se calculent sur les écritures RÉELLES, jamais sur les précédents', () => {
  // Règle 9.0.0. Un livre dont l'ouverture porte déjà 600 à la banque et qui n'a aucune écriture
  // doit rouvrir à 600 — pas à 1 200.
  const l = K.livreVide('D1', 2027);
  l.ouverture = { date: '2027-01-01', source: 'an', lignes: [
    { compte: '532', libelle: 'Banque', debit: 600, credit: 0 },
    { compte: '13', libelle: 'Résultat', debit: 0, credit: 600 }
  ] };
  const an = K.anouveauxDe(l);
  const banque = an.lignes.find(x => x.compte === '532');
  assert.strictEqual(banque.debit, 600, 'l\'ouverture a été comptée deux fois');
  assert.ok(an.equilibre);
});

t('10.14.0 : les tiers rouvrent pièce par pièce — la facture de décembre se lettre avec son règlement de janvier', () => {
  // Le jumeau de l'application entreprise : un seul solde global du 411 perdait le client et la
  // lettre. L'exercice suivant voyait un règlement de janvier sans sa facture, et sa balance
  // auxiliaire rangeait toute l'ouverture sous « (sans tiers) ».
  const l = livreRempli();
  const pose = e => { const n = K.ajouterEcriture(l, e, 'test', 1); K.validerEcriture(l, n.id, 'test', 1); };
  // Une facture de décembre, jamais réglée dans l'exercice, lettrée à son numéro.
  pose({ journal: 'VT', date: '2026-12-18', piece: 'FAC-9', libelle: 'Vente', source: 'saisie',
    lignes: [{ compte: '411', tiers: 'Hôtel du Lac', libelle: 'Facture FAC-9', debit: 238, credit: 0, lettre: 'FAC-9' },
      { compte: '706', libelle: 'Vente', debit: 0, credit: 238 }] });
  // Une autre, réglée dans l'exercice : lettrée à zéro, elle ne se rouvre pas.
  pose({ journal: 'VT', date: '2026-11-02', piece: 'FAC-7', libelle: 'Vente', source: 'saisie',
    lignes: [{ compte: '411', tiers: 'Café de Sfax', libelle: 'Facture FAC-7', debit: 119, credit: 0, lettre: 'FAC-7' },
      { compte: '706', libelle: 'Vente', debit: 0, credit: 119 }] });
  pose({ journal: 'BQ', date: '2026-11-20', piece: 'ENC-7', libelle: 'Encaissement', source: 'saisie',
    lignes: [{ compte: '532', libelle: 'Banque', debit: 119, credit: 0 },
      { compte: '411', tiers: 'Café de Sfax', libelle: 'Règlement FAC-7', debit: 0, credit: 119, lettre: 'FAC-7' }] });
  const an = K.anouveauxDe(l);
  assert.ok(an.equilibre);
  const clients = an.lignes.filter(x => x.compte === '411');
  assert.strictEqual(clients.length, 1, 'une ligne par pièce ouverte, et rien pour ce qui est lettré à zéro');
  assert.strictEqual(clients[0].tiers, 'Hôtel du Lac', 'la ligne rouvre avec son client');
  assert.strictEqual(clients[0].lettre, 'FAC-9', 'et avec sa lettre : c\'est elle qui retrouve le règlement');
  assert.strictEqual(clients[0].debit, 238);
  // Le total du compte ne bouge pas d'un millime.
  const bal = K.balanceDepuisLignes(K.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au }), K.soldesDepuisOuverture(l));
  const solde411 = bal.rows.find(r => r.account === '411').solde;
  assert.strictEqual(K.round3(clients.reduce((s, x) => s + x.debit - x.credit, 0)), solde411);

  // L'exercice suivant : l'à-nouveau posé, puis le règlement de janvier lettré à la même facture.
  const suivant = K.livreVide('D1', 2027, { plan: l.plan });
  const ae = K.ajouterEcriture(suivant, K.ecritureAnouveaux(l, 2027), 'test', 1);
  K.validerEcriture(suivant, ae.id, 'test', 1);
  const reg = K.ajouterEcriture(suivant, { journal: 'BQ', date: '2027-01-12', piece: 'ENC-9', libelle: 'Encaissement', source: 'saisie',
    lignes: [{ compte: '532', libelle: 'Banque', debit: 238, credit: 0 },
      { compte: '411', tiers: 'Hôtel du Lac', libelle: 'Règlement FAC-9', debit: 0, credit: 238, lettre: 'FAC-9' }] }, 'test', 1);
  K.validerEcriture(suivant, reg.id, 'test', 1);
  const lignes27 = K.lignesDuLivre(suivant, { du: suivant.exercice.du, au: suivant.exercice.au });
  const aux = K.balanceAuxiliaireDepuisLignes(lignes27, K.collectifsDeTiers(suivant, 'clients'));
  assert.ok(!aux.rows.some(r => r.tiers === '(sans tiers)'), 'l\'ouverture du 411 ne doit plus tomber « sans tiers »');
  const hotel = aux.rows.find(r => r.tiers === 'Hôtel du Lac');
  assert.ok(hotel, 'le client de décembre est dans l\'auxiliaire de janvier');
  assert.strictEqual(hotel.solde, 0, 'et son règlement le solde');
});

t('9.8.0 : l\'écriture d\'à-nouveaux tombe au 1er janvier de l\'exercice SUIVANT', () => {
  const l = livreRempli();
  const e = K.ecritureAnouveaux(l, 2027);
  assert.strictEqual(e.date, '2027-01-01');
  assert.strictEqual(e.journal, 'AN');
  assert.strictEqual(e.source, 'an');
  const b = K.entriesBalance(e.lignes.map(x => ({ debit: x.debit, credit: x.credit })));
  assert.strictEqual(b.debit, b.credit);
});

// ---------------------------------------------------------------- les extournes

t('9.8.0 : une extourne est un MIROIR au 1er janvier — l\'originale ne bouge pas', () => {
  const l = livreRempli();
  const n = K.ajouterEcriture(l, {
    journal: 'OD', date: '2026-12-31', piece: 'CCA-1', libelle: 'Charge constatée d\'avance', source: 'inventaire',
    extourne: true,
    lignes: [{ compte: '471', libelle: 'CCA', debit: 300, credit: 0 }, { compte: '606', libelle: 'Achat', debit: 0, credit: 300 }]
  }, 'test', 1);
  K.validerEcriture(l, n.id, 'test', 1);
  const ext = K.extournesDe(l, 2027);
  assert.strictEqual(ext.length, 1);
  assert.strictEqual(ext[0].date, '2027-01-01');
  assert.strictEqual(ext[0].lignes[0].credit, 300, 'le débit d\'origine devient un crédit');
  assert.strictEqual(ext[0].lignes[1].debit, 300);
  // L'originale reste VALIDÉE, dans son exercice, avec son numéro : une extourne n'est pas une
  // contre-passation (règle 9.3.0). La marquer « contrepassee » fausserait le résultat de 2026.
  const orig = l.ecritures.find(x => x.id === n.id);
  assert.strictEqual(orig.statut, 'validee');
  assert.strictEqual(orig.date, '2026-12-31');
  // Une écriture d'inventaire qui NE s'extourne pas (une provision) ne repart pas.
  const p = K.ajouterEcriture(l, {
    journal: 'OD', date: '2026-12-31', piece: 'PROV-1', libelle: 'Provision', source: 'inventaire',
    lignes: [{ compte: '606', libelle: 'Dotation', debit: 100, credit: 0 }, { compte: '471', libelle: 'Provision', debit: 0, credit: 100 }]
  }, 'test', 1);
  K.validerEcriture(l, p.id, 'test', 1);
  assert.strictEqual(K.extournesDe(l, 2027).length, 1, 'une provision ne s\'extourne pas');
  // Et ce qui est DÉJÀ extourné ne repart pas : rouvrir l'exercice suivant une seconde fois
  // annulerait la charge deux fois, et rien à l'écran ne le montrerait.
  assert.strictEqual(K.extournesDe(l, 2027, new Set([n.id])).length, 0);
  assert.strictEqual(ext[0].extourneDe, n.id, 'l\'extourne doit dire de QUELLE écriture elle vient');
});

// ---------------------------------------------------------------- les états

t('9.8.0 : actif = passif, et le résultat est le même des deux côtés', () => {
  const l = livreRempli();
  const lignes = K.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au });
  const e = K.etatsDepuisLignes(lignes, K.soldesDepuisOuverture(l));
  assert.ok(e.equilibre, `actif ${e.totalActif} ≠ passif ${e.totalPassif}`);
  assert.strictEqual(e.resultat, 600);
  assert.strictEqual(K.round3(e.produits.total - e.charges.total), e.resultat,
    'le résultat du bilan et celui de l\'état de résultat doivent être le même chiffre');
});

t('9.8.0 : un ratio sans dénominateur vaut « null », jamais 0 %', () => {
  const vide = K.sigDepuisLignes([], {});
  vide.ratios.forEach(r => assert.strictEqual(r.valeur, null, r.id + ' : un ratio sans base ne vaut pas 0 %'));
  const l = livreRempli();
  const sig = K.sigDepuisLignes(K.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au }), K.soldesDepuisOuverture(l));
  const ca = sig.lignes.find(x => x.id === 'ca');
  assert.strictEqual(ca.montant, 1000);
  assert.strictEqual(sig.lignes.find(x => x.id === 'va').montant, 600, '1 000 de ventes − 400 d\'achats');
  assert.strictEqual(sig.lignes.find(x => x.id === 'net').montant, 600);
  // Chaque solde porte SA FORMULE : un chiffre de gestion qu'on ne sait pas refaire ne se discute pas.
  sig.lignes.forEach(x => assert.ok(x.formule, x.id + ' n\'a pas de formule'));
  assert.strictEqual(sig.ratios.find(r => r.id === 'marge').valeur, 60);
});

// ---------------------------------------------------------------- le dossier de clôture

t('9.8.0 : le dossier de clôture porte les à-nouveaux, l\'inventaire et les états', () => {
  const l = livreRempli();
  const n = K.ajouterEcriture(l, {
    journal: 'OD', date: '2026-12-31', piece: 'DOT-1', libelle: 'Dotation', source: 'inventaire',
    lignes: [{ compte: '681', libelle: 'Dotation', debit: 120, credit: 0 }, { compte: '28', libelle: 'Amortissement', debit: 0, credit: 120 }]
  }, 'test', 1);
  K.validerEcriture(l, n.id, 'test', 1);
  K.cloturerExercice(l, 'skander', 9000);
  const d = K.dossierDeCloture(l);
  assert.strictEqual(d.format, 1);
  assert.strictEqual(d.exercice.annee, 2026);
  assert.strictEqual(d.closPar, 'skander');
  assert.ok(d.anouveaux.length, 'aucun à-nouveau dans le dossier de clôture');
  assert.strictEqual(d.inventaire.length, 1, 'l\'écriture d\'inventaire doit partir avec');
  assert.ok(d.etats.equilibre);
  assert.strictEqual(d.resultat, 480, '600 de marge moins 120 de dotation');
});

t('9.8.0 : le client REFUSE plus qu\'il n\'accepte', () => {
  assert.ok(!K.clotureValide(null).ok);
  assert.ok(!K.clotureValide({ format: 1, exercice: { annee: 2026 }, anouveaux: [] }).ok,
    'un dossier sans à-nouveau n\'a rien à reprendre');
  // Déséquilibré : refusé, avec les deux chiffres.
  const bancal = K.clotureValide({ format: 1, exercice: { annee: 2026 }, anouveaux: [
    { compte: '532', debit: 600, credit: 0 }, { compte: '13', debit: 0, credit: 500 }
  ] });
  assert.ok(!bancal.ok);
  assert.ok(/600[.,]000.*500[.,]000/.test(bancal.motifs.join(' ')), 'le refus doit nommer les deux totaux');
  // Une VERSION PLUS RÉCENTE se dit autrement : ce n'est pas un fichier cassé, c'est une
  // application en retard, et le geste qui débloque n'est pas le même.
  const futur = K.clotureValide({ format: 9, exercice: { annee: 2026 }, anouveaux: [] });
  assert.ok(!futur.ok && futur.tropRecent);
  assert.ok(/à jour/.test(futur.motifs.join(' ')), 'il faut dire « mets l\'application à jour »');
  // Le matricule d'une AUTRE entreprise : refusé.
  const autre = K.clotureValide(
    { format: 1, exercice: { annee: 2026 }, matricule: '1111111A', anouveaux: [{ compte: '532', debit: 1, credit: 0 }, { compte: '13', debit: 0, credit: 1 }] },
    { matricule: '2222222B' });
  assert.ok(!autre.ok && /autre entreprise/.test(autre.motifs.join(' ')));
  // Et le cas normal passe.
  assert.ok(K.clotureValide({ format: 1, exercice: { annee: 2026 }, anouveaux: [
    { compte: '532', debit: 600, credit: 0 }, { compte: '13', debit: 0, credit: 600 }
  ] }).ok);
});

t('9.8.0 : les guides d\'inventaire disent lesquels s\'extournent', () => {
  const ids = K.GUIDES_INVENTAIRE.map(g => g.id).sort();
  assert.deepStrictEqual(ids, ['cca', 'fae', 'fnp', 'pca', 'provision']);
  K.GUIDES_INVENTAIRE.forEach(g => {
    assert.ok(g.nom && g.aide, g.id + ' : un guide sans explication ne guide rien');
    assert.strictEqual(typeof g.extourne, 'boolean', g.id + ' ne dit pas s\'il s\'extourne');
  });
  // Une PROVISION ne s'extourne pas : elle se reprend quand le risque disparaît. Les quatre autres,
  // si. Confondre les deux ferait disparaître une provision au 1er janvier.
  assert.strictEqual(K.GUIDES_INVENTAIRE.find(g => g.id === 'provision').extourne, false);
  assert.ok(K.GUIDES_INVENTAIRE.filter(g => g.id !== 'provision').every(g => g.extourne));
});
};
