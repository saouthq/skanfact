'use strict';
// ============================================================================================
// Les immobilisations et l'inventaire du cabinet (9.7.0)
//
// Ce que ces tests tiennent : que le cabinet calcule le MÊME plan que l'app entreprise pour un
// même bien (sinon le comptable et son client auraient deux tableaux d'amortissement et aucun
// moyen de savoir lequel croire) ; que rien de ce que personne n'a confirmé n'est écrit en dur ;
// et qu'une dotation déjà passée en écriture ne se recalcule jamais en silence.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');

const livre = (opts) => K.livreVide('D1', 2026, opts);

const bien = (o) => Object.assign({
  libelle: 'Serveur', compte: '2241', compteAmort: '2841', compteDotation: '681',
  dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
  valeur: 4800, residuelle: 0, methode: 'lineaire', duree: 4
}, o || {});

// ---------------------------------------------------------------- le dégressif

t('9.7.0 : le taux dégressif se SAISIT — aucun coefficient n\'est écrit dans le code', () => {
  // Le coefficient tunisien dépend de la durée et du régime, et personne ne l'a confirmé. Écrire
  // « 1,5 pour 3 ou 4 ans » serait poser une règle de droit (règle 9.1.1). Le moteur refuse donc
  // un dégressif sans taux, au lieu d'en deviner un.
  const sansTaux = K.immoValide(bien({ methode: 'degressif' }));
  assert.ok(!sansTaux.ok, 'un dégressif sans taux doit être refusé');
  assert.ok(/TAUX/.test(sansTaux.motifs.join(' ')), 'le refus doit nommer le taux');
  assert.ok(K.immoValide(bien({ methode: 'degressif', tauxDegressif: 37.5 })).ok);
  // Et la source : pas de table de coefficients cachée quelque part.
  const src = lireSource('src', 'renderer', 'compta.js');
  assert.ok(!/COEFFICIENTS?_DEGRESSIFS?/.test(src), 'une table de coefficients dégressifs est apparue');
  assert.ok(K.IMMO_A_VERIFIER.tauxDegressif.includes('À VÉRIFIER'),
    'le taux dégressif doit porter son « À VÉRIFIER »');
});

t('9.7.0 : le plan dégressif se calcule sur la valeur NETTE, et à la main', () => {
  // 10 000 DT, quatre ans, taux 37,5 %, mis en service le 1er janvier : l'année est pleine.
  // 1 : 10 000 × 37,5 % = 3 750 → reste 6 250
  // 2 : 6 250 × 37,5 %  = 2 343,750 → reste 3 906,250
  // 3 : 3 906,25 × 37,5 % = 1 464,844 (arrondi au millime)
  // 4 : la dernière solde le reste.
  const p = K.planDegressif(bien({ valeur: 10000, duree: 4, methode: 'degressif', tauxDegressif: 37.5 }));
  assert.strictEqual(p.length, 4);
  assert.strictEqual(p[0].annuity, 3750);
  assert.strictEqual(p[1].annuity, 2343.75);
  assert.strictEqual(p[2].annuity, K.round3(3906.25 * 0.375));
  assert.strictEqual(p[3].nbv, 0, 'un dégressif pur ne finit jamais : la dernière annuité doit solder');
  assert.strictEqual(K.round3(p.reduce((s, r) => s + r.annuity, 0)), 10000);
  // Le dégressif amortit PLUS vite au début : c'est toute sa raison d'être.
  const lin = K.planDuBien(bien({ valeur: 10000, duree: 4 }));
  assert.ok(p[0].annuity > lin[0].dotation, 'le dégressif doit amortir plus que le linéaire la première année');
});

t('9.7.0 : la bascule au linéaire est DÉCOCHÉE par défaut, et elle change vraiment le plan', () => {
  // Personne n'a dit que l'usage d'ici l'applique. Un défaut qui ne fait rien (règle 9.1.1) — mais
  // qui existe, parce que le jour où le comptable tranche, c'est une case, pas une version.
  const base = { valeur: 10000, duree: 5, methode: 'degressif', tauxDegressif: 30 };
  const sans = K.planDegressif(bien(base));
  const avec = K.planDegressif(bien({ ...base, bascule: true }));
  assert.notDeepStrictEqual(sans.map(r => r.annuity), avec.map(r => r.annuity),
    'la bascule doit changer le plan, sinon la case ne sert à rien');
  // Les deux amortissent le même total : ce qui change, c'est la répartition.
  assert.strictEqual(K.round3(sans.reduce((s, r) => s + r.annuity, 0)),
    K.round3(avec.reduce((s, r) => s + r.annuity, 0)));
  assert.strictEqual(K.immoValide(bien(base)).ok, true);
  assert.strictEqual(!!bien(base).bascule, false, 'la bascule ne doit pas être posée d\'office');
});

// ---------------------------------------------------------------- la parité avec l'entreprise

t('9.7.0 : le MÊME bien donne le même plan côté cabinet et côté entreprise', () => {
  // C'est le test qui compte. Le cabinet écrit ses champs en français (`valeur`, `duree`,
  // `dateMiseEnService`), l'app entreprise porte les siens depuis la 3.5.0 — un seul moteur les
  // calcule. Recopier ce moteur aurait donné deux tableaux d'amortissement pour un seul bien.
  const C = require('../../src/renderer/core.js');
  const f = bien({ valeur: 7300, residuelle: 300, duree: 5, dateMiseEnService: '2026-04-15' });
  const cote = C.assetSchedule({ amount: 7300, residual: 300, years: 5, date: '2026-04-15' });
  const ici = K.planDuBien(f);
  assert.strictEqual(ici.length, cote.length);
  ici.forEach((p, i) => {
    assert.strictEqual(p.annee, cote[i].year, 'les exercices diffèrent');
    assert.strictEqual(p.dotation, cote[i].annuity, 'la dotation diffère en ' + p.annee);
    assert.strictEqual(p.vnc, cote[i].nbv, 'la VNC diffère en ' + p.annee);
  });
});

// ---------------------------------------------------------------- cession et rebut

t('9.7.0 : une cession fige le plan, et l\'amortissement est repris EN ENTIER', () => {
  const l = livre();
  const r = K.ajouterImmobilisation(l, bien({ valeur: 4800, duree: 4, cession: { date: '2027-06-30', prix: 2000 } }), 'test', 1);
  assert.ok(r.ok, r.motif);
  const f = r.fiche;
  const plan = K.planDuBien(f);
  assert.strictEqual(plan[plan.length - 1].annee, 2027, 'le plan s\'arrête à l\'année de la sortie');
  const ced = K.resultatCession(f);
  assert.strictEqual(ced.vnc, K.round3(4800 - K.cumulDuBien(f, '2027-06-30')));
  assert.strictEqual(ced.resultat, K.round3(2000 - ced.vnc));
  // L'écriture de sortie : 28 débité de TOUT le cumul, 675 de la VNC, 22 crédité de la valeur brute.
  const ecr = K.ecrituresImmobilisations(l, 2027).find(e => e.genre === 'cession');
  assert.ok(ecr, 'aucune écriture de sortie proposée');
  const b = K.entriesBalance(ecr.lignes.map(x => ({ debit: x.debit, credit: x.credit })));
  assert.strictEqual(b.debit, b.credit, 'la sortie d\'actif doit être équilibrée');
  assert.strictEqual(ecr.lignes.find(x => x.compte === '2841').debit, K.cumulDuBien(f, '2027-06-30'));
  assert.strictEqual(ecr.lignes.find(x => x.compte === '2241').credit, 4800);
  // Le PRIX n'est jamais écrit d'office : il arrive par la facture ou par le relevé (règle 9.0.0).
  assert.ok(!ecr.lignes.some(x => x.debit === 2000 || x.credit === 2000),
    'le prix de cession ne doit pas être inventé par l\'écriture de sortie');
});

t('9.7.0 : une mise au rebut est une cession à prix nul, et elle le DIT', () => {
  const l = livre();
  const r = K.ajouterImmobilisation(l, bien({ valeur: 1200, duree: 3, cession: { date: '2027-03-31', prix: 0, motif: 'rebut' } }), 'test', 1);
  const ced = K.resultatCession(r.fiche);
  assert.strictEqual(ced.motif, 'rebut');
  assert.ok(ced.resultat < 0, 'jeter un bien non amorti fait une moins-value');
  const ecr = K.ecrituresImmobilisations(l, 2027).find(e => e.genre === 'cession');
  assert.ok(/rebut/i.test(ecr.libelle), 'la pièce doit dire que c\'est un rebut, pas une vente');
});

// ---------------------------------------------------------------- le plan et les écritures

t('9.7.0 : le plan se RECALCULE, mais l\'écriture d\'une dotation est un fait qui survit', () => {
  const l = livre();
  const f = K.ajouterImmobilisation(l, bien(), 'test', 1).fiche;
  const props = K.ecrituresImmobilisations(l, 2026);
  assert.strictEqual(props.length, 1);
  assert.strictEqual(props[0].source, 'inventaire');
  assert.strictEqual(props[0].date, '2026-12-31', 'une dotation est une écriture d\'inventaire : au dernier jour');
  const e = K.ajouterEcriture(l, props[0], 'test', 2);
  K.noterEcritureImmo(l, f.id, 2026, e.id);
  // Un recalcul du plan ne doit pas effacer le lien : sinon on repasserait la dotation, et elle
  // serait comptée deux fois sans que rien ne le montre.
  const apres = K.planDuBien(l.immobilisations[0]);
  assert.strictEqual(apres.find(p => p.annee === 2026).ecritureId, e.id);
  assert.strictEqual(K.ecrituresImmobilisations(l, 2026).length, 0, 'la dotation écrite est reproposée');
  assert.strictEqual(K.etatImmobilisations(l, 2026).aEcrire, 0);
});

t('9.7.0 : une dotation déjà écrite ne se recalcule pas en silence', () => {
  const l = livre();
  const f = K.ajouterImmobilisation(l, bien(), 'test', 1).fiche;
  const e = K.ajouterEcriture(l, K.ecrituresImmobilisations(l, 2026)[0], 'test', 2);
  K.noterEcritureImmo(l, f.id, 2026, e.id);
  const r = K.modifierImmobilisation(l, f.id, { valeur: 9600 }, 'test', 3);
  assert.ok(!r.ok, 'changer la valeur d\'un bien dont la dotation est écrite doit être refusé');
  assert.ok(/[Cc]ontre-passe/.test(r.motif), 'le refus doit nommer le geste qui débloque');
  // Mais ce qui ne touche PAS aux chiffres passe : renommer un bien n'a jamais rendu une écriture fausse.
  assert.ok(K.modifierImmobilisation(l, f.id, { libelle: 'Serveur de sauvegarde' }, 'test', 4).ok);
  assert.ok(!K.supprimerImmobilisation(l, f.id, 'test', 5).ok, 'supprimer laisserait une dotation sans bien');
});

t('9.7.0 : une ligne au compte d\'immobilisation sans fiche est SIGNALÉE, jamais créée d\'office', () => {
  const l = livre({ plan: [{ compte: '22', libelle: 'Immobilisations', role: 'immobilisations' }] });
  K.ajouterEcriture(l, {
    journal: 'AC', date: '2026-02-10', piece: 'FA-12', libelle: 'Serveur Dell', source: 'import',
    lignes: [{ compte: '2241', libelle: 'Serveur Dell', debit: 4800, credit: 0 },
      { compte: '401', libelle: 'Fournisseur', debit: 0, credit: 4800 }]
  }, 'test', 1);
  const aCreer = K.immobilisationsACreer(l, 2026);
  assert.strictEqual(aCreer.length, 1, 'la ligne d\'acquisition doit remonter');
  assert.strictEqual(aCreer[0].montant, 4800);
  assert.strictEqual((l.immobilisations || []).length, 0, 'aucune fiche ne doit être créée toute seule');
  // Une fois la fiche créée avec l'origine, la ligne ne se repropose plus.
  K.ajouterImmobilisation(l, bien({ valeur: 4800, origine: { source: 'paquet', docId: aCreer[0].docId, mois: '2026-02' } }), 'test', 2);
  assert.strictEqual(K.immobilisationsACreer(l, 2026).length, 0);
});

t('9.7.0 : une reprise de subvention suit le rythme de l\'amortissement', () => {
  const l = livre();
  const f = K.ajouterImmobilisation(l, bien({ valeur: 4800, duree: 4, subvention: { montant: 1200 } }), 'test', 1).fiche;
  // 1 200 pour 4 800 amortissables : un quart de chaque dotation. La dotation 2026 vaut 1 200,
  // donc la reprise vaut 300.
  assert.strictEqual(K.repriseSubvention(f, 2026), 300);
  const somme = K.planDuBien(f).reduce((s, p) => s + K.repriseSubvention(f, p.annee), 0);
  assert.strictEqual(K.round3(somme), 1200, 'toute la subvention doit finir reprise');
  const sub = K.ecrituresImmobilisations(l, 2026).find(e => e.genre === 'subvention');
  assert.ok(sub, 'aucune écriture de reprise proposée');
  assert.strictEqual(sub.lignes[0].compte, '14');
  assert.strictEqual(sub.lignes[1].compte, '739');
});

// ---------------------------------------------------------------- l'inventaire de stock

t('9.7.0 : un inventaire vide n\'est pas un stock vide', () => {
  assert.ok(!K.inventaireValide({ date: '2026-12-31', lignes: [] }).ok,
    'zéro ligne veut dire « rien n\'a été compté », pas « le stock est vide »');
  assert.ok(!K.inventaireValide({ date: '', lignes: [{ libelle: 'x', quantite: 1, cout: 1 }] }).ok);
  assert.ok(!K.inventaireValide({ date: '2026-12-31', lignes: [{ libelle: 'x', quantite: -1, cout: 1 }] }).ok);
  assert.ok(K.inventaireValide({ date: '2026-12-31', lignes: [{ libelle: 'Câble', quantite: 24, cout: 7.5 }] }).ok);
  assert.strictEqual(K.totalInventaire({ lignes: [{ quantite: 24, cout: 7.5 }, { quantite: 3, cout: 100 }] }), 480);
});

t('9.7.0 : la variation de stock va dans les DEUX sens, et une variation nulle n\'écrit rien', () => {
  const l = livre({ plan: [{ compte: '37', libelle: 'Stocks', role: 'stocks' }] });
  // Le stock aux comptes vaut 1 000 au départ. L'écriture doit être VALIDÉE : un brouillard n'est
  // pas encore de la comptabilité, donc il n'entre dans aucun solde — et une variation de stock
  // calculée sur un brouillard dirait n'importe quoi.
  const an = K.ajouterEcriture(l, {
    journal: 'OD', date: '2026-01-01', piece: 'AN', libelle: 'À nouveau', source: 'an',
    lignes: [{ compte: '37', libelle: 'Stock initial', debit: 1000, credit: 0 },
      { compte: '12', libelle: 'Report', debit: 0, credit: 1000 }]
  }, 'test', 1);
  K.poserInventaire(l, { date: '2026-12-31', lignes: [{ libelle: 'Câble', quantite: 200, cout: 7.5 }] }, 'test', 2);
  assert.strictEqual(K.variationDeStock(l, 2026).initial, 0,
    'tant que l\'à-nouveau est en brouillard, le stock aux comptes est nul');
  K.validerEcriture(l, an.id, 'test', 2);

  // Il MONTE à 1 500 : on débite le stock, on crédite la variation.
  K.poserInventaire(l, { date: '2026-12-31', lignes: [{ libelle: 'Câble', quantite: 200, cout: 7.5 }] }, 'test', 2);
  let v = K.variationDeStock(l, 2026);
  assert.strictEqual(v.initial, 1000);
  assert.strictEqual(v.final, 1500);
  assert.strictEqual(v.ecart, 500);
  assert.strictEqual(v.ecriture.lignes[0].compte, '37');
  assert.strictEqual(v.ecriture.lignes[0].debit, 500);
  assert.strictEqual(v.ecriture.lignes[1].compte, '603');
  assert.strictEqual(v.ecriture.lignes[1].credit, 500);

  // Il DESCEND à 600 : l'inverse.
  K.poserInventaire(l, { date: '2026-12-31', lignes: [{ libelle: 'Câble', quantite: 80, cout: 7.5 }] }, 'test', 3);
  v = K.variationDeStock(l, 2026);
  assert.strictEqual(v.ecart, -400);
  assert.strictEqual(v.ecriture.lignes[0].compte, '603');
  assert.strictEqual(v.ecriture.lignes[0].debit, 400);

  // Il ne bouge PAS : aucune écriture. Une pièce à zéro dans un journal n'apprend rien.
  K.poserInventaire(l, { date: '2026-12-31', lignes: [{ libelle: 'Câble', quantite: 100, cout: 10 }] }, 'test', 4);
  v = K.variationDeStock(l, 2026);
  assert.strictEqual(v.ecart, 0);
  assert.strictEqual(v.ecriture, null);
  assert.ok(v.motif, 'une variation nulle doit DIRE pourquoi il n\'y a rien à passer');
});

t('9.7.0 : un inventaire déjà passé en écriture ne se refait pas en silence', () => {
  const l = livre();
  const r = K.poserInventaire(l, { date: '2026-12-31', lignes: [{ libelle: 'Câble', quantite: 10, cout: 5 }] }, 'test', 1);
  assert.ok(r.ok);
  assert.strictEqual(l.inventaires.length, 1);
  // Le refaire REMPLACE tant qu'aucune écriture ne le porte — deux inventaires du même exercice, et
  // plus personne ne sait lequel a servi.
  K.poserInventaire(l, { date: '2026-12-31', lignes: [{ libelle: 'Câble', quantite: 12, cout: 5 }] }, 'test', 2);
  assert.strictEqual(l.inventaires.length, 1);
  assert.strictEqual(l.inventaires[0].total, 60);
  l.inventaires[0].ecritureId = 'e_x';
  const ko = K.poserInventaire(l, { date: '2026-12-31', lignes: [{ libelle: 'Câble', quantite: 1, cout: 5 }] }, 'test', 3);
  assert.ok(!ko.ok, 'refaire un inventaire déjà écrit doit être refusé');
  assert.ok(/[Cc]ontre-passe/.test(ko.motif), 'le refus doit nommer le geste qui débloque');
});

// ---------------------------------------------------------------- les rôles et le format

t('9.7.0 : les comptes des immobilisations n\'existent qu\'à UN endroit', () => {
  // Même règle que les comptes fiscaux (9.6.0) : `COMPTES_IMMO` n'est que le repli du Cabinet,
  // qui ne charge pas core.js. Deux tables séparées finiraient par dire deux numéros pour un rôle.
  const C = require('../../src/renderer/core.js');
  Object.keys(K.COMPTES_IMMO).forEach(role => {
    assert.strictEqual(K.COMPTES_IMMO[role], C.DEFAULT_ACCOUNTS[role],
      `le rôle ${role} ne dit pas le même compte des deux côtés`);
  });
  // Et le plan du dossier PRIME sur le repli : aucun numéro de compte n'est une vérité (6.3.0).
  const l = livre({ plan: [{ compte: '2811', libelle: 'Amortissements', role: 'amortissements' }] });
  K.ajouterImmobilisation(l, bien({ compteAmort: '' }), 'test', 1);
  assert.strictEqual(l.immobilisations[0].compteAmort, '2811');
});

t('9.7.0 : l\'amortissement dérogatoire n\'existe pas, et c\'est écrit', () => {
  // La règle du plan : s'il n'est pas demandé, il n'existe pas. Le format du livre ne lui réserve
  // rien, et une case posée « au cas où » serait une règle fiscale offerte sans que personne l'ait
  // validée. Ce test tombe le jour où quelqu'un l'ajoute sans décision de format.
  assert.deepStrictEqual(K.IMMO_METHODES, ['lineaire', 'degressif']);
  const l = livre();
  const f = K.ajouterImmobilisation(l, bien(), 'test', 1).fiche;
  assert.ok(!('derogatoire' in f) && !('planFiscal' in f),
    'la fiche a gagné un plan dérogatoire sans décision de format');
});
};
