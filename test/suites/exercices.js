'use strict';
// ============================================================================================
// D'un exercice à l'autre (10.14.0)
//
// L'exemple du Cabinet sur DEUX exercices — le précédent clos, rouvert une fois avec son motif puis
// reclos ; le courant ouvert par ses à-nouveaux — a fait tomber ce que des jeux d'un seul exercice
// ne pouvaient pas voir :
//   le registre qui ne suivait pas   « Ouvrir N+1 » posait les à-nouveaux et laissait les biens et
//                                    les salariés derrière lui ; l'écran proposait de « créer la
//                                    fiche » du pont élévateur comme d'un achat du 1er janvier ;
//   un exercice clos qui bougeait    seule la grille de saisie tenait la promesse de la clôture ;
//   janvier qui déclarait décembre   l'à-nouveau, daté du 1er janvier, comptait dans les cases du mois ;
//   « les six contrôles »            écrit en dur, sur un dossier qui en a sept.
module.exports = ({ t, assert, lireSource }) => {
const vm = require('vm');
const KC = require('../../src/renderer/compta.js');
const V = require('../../src/cabinet/exemple-vitrine.js');
const CV = require('../../src/cabinet/renderer/cabvisites.js');

// Le code sans ses commentaires de ligne : un commentaire qui cite la forme interdite ne fait pas
// tomber un test, et une forme décrite en commentaire ne le fait pas passer (6.8.0, 7.25.0).
const sansCommentaires = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const appCab = sansCommentaires(lireSource('src', 'cabinet', 'renderer', 'app.js'));
const mainCab = sansCommentaires(lireSource('src', 'cabinet', 'main.js'));
// Le corps d'UNE fonction, bornée sur SA fin — l'accolade à son niveau —, jamais sur un voisin qui
// déménage (10.4.0). `niveau` : l'indentation de la déclaration.
const corps = (src, debut, niveau) => {
  const i = src.indexOf(debut);
  assert.ok(i >= 0, 'introuvable : ' + debut);
  const fin = '\n' + ' '.repeat(niveau) + '}' + (niveau ? '\n' : '');
  const j = src.indexOf(fin, i);
  assert.ok(j > i, 'fin introuvable : ' + debut);
  return src.slice(i, j + fin.length);
};

// Un garage repris au 1er janvier 2025 : un pont élévateur déjà amorti d'un an (sa dotation de 2025
// écrite et validée), et trois salariés — Ali parti en juin, Sami qui partira fin février 2026,
// Mounir qui reste.
function exerciceN() {
  const L = KC.livreVide('MF:X', 2025);
  const ouv = KC.balanceOuverture(L, [
    { compte: '223', libelle: 'Pont élévateur', debit: 18000, credit: 0 },
    { compte: '28', libelle: 'Amortissements', debit: 0, credit: 1800 },
    { compte: '532', libelle: 'Banque', debit: 12400, credit: 0 },
    { compte: '101', libelle: 'Capital', debit: 0, credit: 28600 }
  ], '2025-01-01', 'balance', 'moi', 1);
  assert.ok(ouv.ok, ouv.motif);
  const pont = KC.ajouterImmobilisation(L, {
    id: 'pont', libelle: 'Pont élévateur', compte: '223', valeur: 18000,
    dateAcquisition: '2024-01-01', dateMiseEnService: '2024-01-01', duree: 10, methode: 'lineaire',
    origine: { source: 'ouverture', docId: ouv.ecriture.id + '#0', mois: '2025-01' }
  }, 'moi', 2);
  assert.ok(pont.ok, pont.motif);
  KC.ecrituresImmobilisations(L, 2025).filter(x => x.genre === 'dotation').forEach(x => {
    const e = KC.ajouterEcriture(L, x, 'moi', 3);
    assert.ok(KC.validerEcriture(L, e.id, 'moi', 3).ok);
    KC.noterEcritureImmo(L, x.immoId, 2025, e.id);
  });
  [['mounir', 'Mounir Jaziri', '2022-03-01', ''], ['ali', 'Ali Ben Salah', '2023-01-01', '2025-06-30'], ['sami', 'Sami Trabelsi', '2024-05-01', '2026-02-28']]
    .forEach(([id, nom, embauche, sortie]) => {
      const r = KC.ajouterSalarie(L, { id, nom, embauche, sortie, brut: 1200, cnss: '1' }, 'moi', 4);
      assert.ok(r.ok, r.motif);
    });
  return L;
}
const livreN1 = N => KC.livreVide('MF:X', Number(N.exercice.annee) + 1, {
  plan: (N.plan || []).map(p => ({ ...p })), journaux: (N.journaux || []).map(j => ({ ...j }))
});

t('10.14.0 : « Ouvrir N+1 » reprend le REGISTRE — les biens encore détenus avec leur plan, les salariés encore présents, jamais les bulletins', () => {
  const N = exerciceN();
  assert.ok(KC.cloturerExercice(N, 'moi', 10).ok);
  const N1 = livreN1(N);
  const r = KC.ouvrirExerciceSuivant(N, N1, 'moi', 11);
  assert.ok(r.ok, r.motif);
  assert.strictEqual(r.anDejaValides, false);
  assert.ok(r.ecriture && r.ecriture.journal === 'AN' && r.ecriture.source === 'an' && r.ecriture.statut === 'brouillard', 'les à-nouveaux ne sont pas posés en brouillard');
  // Le pont : repris, marqué d'où il vient, son plan recalculé. La dotation de 2025 reste un FAIT de
  // 2025 — son écriture vit dans le livre de 2025 —, celle de 2026 attend l'inventaire de 2026.
  const pont = N1.immobilisations.find(f => f.id === 'pont');
  assert.ok(pont, 'le pont élévateur n\'a pas suivi');
  assert.strictEqual(r.biens.repris, 1, 'le compte rendu ne dit pas le bien repris');
  assert.strictEqual(pont.reporteDe, 2025, 'le bien repris ne dit pas d\'où il vient');
  const ligne = a => pont.plan.find(p => p.annee === a) || {};
  assert.ok(ligne(2025).ecritureId, 'la dotation écrite en 2025 a perdu son écriture');
  assert.ok(!ligne(2026).ecritureId, 'la dotation de 2026 se dit déjà passée');
  const etat = KC.etatImmobilisations(N1, 2026);
  assert.strictEqual(etat.rows[0].ouverture, 3600, 'le cumul au 1er janvier ne reprend pas là où 2025 s\'était arrêté');
  assert.strictEqual(etat.rows[0].reporteDe, 2025, 'l\'état ne dit pas d\'où vient le bien');
  // Les salariés présents au 1er janvier : Mounir et Sami. Ali est parti en juin. Aucun bulletin.
  assert.deepStrictEqual(N1.salaries.map(s => s.id).sort(), ['mounir', 'sami'], 'les salariés repris ne sont pas ceux présents au 1er janvier (Ali est parti en juin)');
  assert.ok(N1.salaries.every(s => s.reporteDe === 2025), 'un salarié repris ne dit pas d\'où il vient');
  assert.deepStrictEqual(N1.bulletins, [], 'des bulletins de 2025 ont suivi dans 2026');
  // Le report d'un bien n'est pas une acquisition : le 223 des à-nouveaux est couvert par sa fiche.
  assert.deepStrictEqual(KC.immobilisationsACreer(N1, 2026), [], 'le pont élévateur se propose comme un achat du 1er janvier');
});

t('10.14.0 : refaire les à-nouveaux REFAIT le registre sans le doubler, et ce qui a quitté N en sort', () => {
  const N = exerciceN();
  // Un second bien, le compresseur, sans dotation écrite : il pourra sortir de N après l'ouverture.
  const comp = KC.ajouterImmobilisation(N, { id: 'comp', libelle: 'Compresseur', compte: '223', valeur: 2400,
    dateAcquisition: '2025-03-01', dateMiseEnService: '2025-03-01', duree: 5, methode: 'lineaire' }, 'moi', 5);
  assert.ok(comp.ok, comp.motif);
  const N1 = livreN1(N);
  const r1 = KC.ouvrirExerciceSuivant(N, N1, 'moi', 11);
  assert.ok(r1.ok, r1.motif);
  assert.strictEqual(r1.biens.total, 2);
  // Refaire : l'ancien brouillard d'à-nouveaux est REMPLACÉ, les fiches refaites, pas ajoutées.
  const r2 = KC.ouvrirExerciceSuivant(N, N1, 'moi', 12);
  assert.ok(r2.ok, r2.motif);
  assert.strictEqual(r2.refaits, 1, 'l\'ancien brouillard d\'à-nouveaux n\'est pas remplacé');
  assert.strictEqual(N1.ecritures.filter(e => e.source === 'an').length, 1, 'deux pièces d\'à-nouveaux dans le même livre');
  assert.strictEqual(N1.immobilisations.length, 2, 'refaire les à-nouveaux double le registre');
  assert.strictEqual(r2.biens.repris, 0);
  assert.strictEqual(r2.biens.refaits, 2);
  assert.strictEqual(N1.salaries.length, 2, 'refaire les à-nouveaux double les salariés');
  // Le compresseur est vendu en novembre, dans N, APRÈS l'ouverture de N+1 : il en sort.
  const vendu = KC.modifierImmobilisation(N, 'comp', { cession: { date: '2025-11-30', prix: 2000, motif: 'cession' } }, 'moi', 13);
  assert.ok(vendu.ok, vendu.motif);
  const r3 = KC.ouvrirExerciceSuivant(N, N1, 'moi', 14);
  assert.ok(r3.ok, r3.motif);
  assert.strictEqual(r3.biens.retires, 1, 'un bien vendu dans N reste dans le registre de N+1');
  assert.deepStrictEqual(N1.immobilisations.map(f => f.id), ['pont']);
});

t('10.14.0 : des à-nouveaux VALIDÉS ne bougent plus — le registre se reprend quand même, et un geste qui n\'a rien à faire le dit', () => {
  const N = exerciceN();
  const N1 = livreN1(N);
  const r = KC.ouvrirExerciceSuivant(N, N1, 'moi', 11);
  assert.ok(KC.validerEcriture(N1, r.ecriture.id, 'moi', 12).ok);
  const rien = KC.ouvrirExerciceSuivant(N, N1, 'moi', 13);
  assert.strictEqual(rien.ok, false, 'un geste qui ne fait rien se dit réussi');
  assert.ok(/déjà validés/.test(rien.motif) && /Contre-passe/.test(rien.motif), 'le refus ne nomme pas le geste qui débloque : ' + rien.motif);
  // Un bien entré dans N après l'ouverture (une facture de décembre saisie en janvier) : les
  // à-nouveaux validés ne bougent pas, mais le bien suit.
  assert.ok(KC.ajouterImmobilisation(N, { id: 'valise', libelle: 'Valise de diagnostic', compte: '223', valeur: 3000,
    dateAcquisition: '2025-12-15', dateMiseEnService: '2025-12-15', duree: 5, methode: 'lineaire' }, 'moi', 14).ok);
  const repris = KC.ouvrirExerciceSuivant(N, N1, 'moi', 15);
  assert.ok(repris.ok, repris.motif);
  assert.strictEqual(repris.anDejaValides, true);
  assert.strictEqual(repris.ecriture, null, 'des à-nouveaux validés ont été reposés');
  assert.strictEqual(N1.ecritures.filter(e => e.source === 'an').length, 1);
  assert.ok(N1.immobilisations.some(f => f.id === 'valise' && f.reporteDe === 2025), 'le bien entré après l\'ouverture n\'a pas suivi');
});

t('10.14.0 : seul ce que les fiches reprises ne COUVRENT pas se propose comme acquisition — au montant qui reste', () => {
  // Les DONNÉES discriminent (10.0.0) : deux biens au 223 dans N, dont un seul a sa fiche. L'ancienne
  // lecture proposait tout le 223 des à-nouveaux (20 000) ; la juste ne propose que ce qu'aucune
  // fiche reprise ne porte (2 000) — sans le taire.
  const N = exerciceN();
  const achat = KC.ajouterEcriture(N, { date: '2025-06-10', journal: 'AC', piece: 'F-77', libelle: 'Élévateur de boîte',
    lignes: [{ compte: '223', libelle: 'Élévateur de boîte', debit: 2000, credit: 0 }, { compte: '532', libelle: 'Paiement', debit: 0, credit: 2000 }] }, 'moi', 6);
  assert.ok(KC.validerEcriture(N, achat.id, 'moi', 6).ok);
  const N1 = livreN1(N);
  assert.ok(KC.ouvrirExerciceSuivant(N, N1, 'moi', 11).ok);
  const a = KC.immobilisationsACreer(N1, 2026);
  assert.strictEqual(a.length, 1, 'propositions : ' + JSON.stringify(a));
  assert.strictEqual(a[0].compte, '223');
  assert.strictEqual(a[0].montant, 2000, 'la proposition n\'est pas ce qui reste une fois les fiches reprises déduites');
});

t('10.14.0 : un bien REPRIS se corrige dans l\'exercice où sa dotation est écrite, et ne se supprime pas ici', () => {
  const N = exerciceN();
  const N1 = livreN1(N);
  assert.ok(KC.ouvrirExerciceSuivant(N, N1, 'moi', 11).ok);
  const change = KC.modifierImmobilisation(N1, 'pont', { valeur: 20000 }, 'moi', 12);
  assert.strictEqual(change.ok, false, 'la valeur d\'un bien dont la dotation de 2025 est écrite change dans 2026');
  assert.ok(/dans l'exercice 2025/.test(change.motif) && /Corrige ce bien dans 2025/.test(change.motif), 'le refus envoie contre-passer une écriture que ce livre n\'a pas : ' + change.motif);
  assert.ok(!/contre-passe-la d'abord/i.test(change.motif));
  // Ce qui ne touche aucune dotation passe.
  assert.ok(KC.modifierImmobilisation(N1, 'pont', { libelle: 'Pont élévateur deux colonnes' }, 'moi', 13).ok);
  assert.strictEqual(N1.immobilisations[0].reporteDe, 2025, 'renommer un bien repris efface d\'où il vient');
  const sup = KC.supprimerImmobilisation(N1, 'pont', 'moi', 14);
  assert.strictEqual(sup.ok, false);
  assert.ok(/vient de l'exercice 2025/.test(sup.motif) && /cession ou sa mise au rebut/.test(sup.motif), sup.motif);
  // Corriger le salaire d'un salarié repris ne le fait pas naître ici : d'où vient la fiche est un
  // FAIT de la fiche, pas une donnée du formulaire.
  const mounir = N1.salaries.find(s => s.id === 'mounir');
  assert.ok(KC.ajouterSalarie(N1, { ...mounir, brut: 1350 }, 'moi', 15).ok);
  const apres = N1.salaries.find(s => s.id === 'mounir');
  assert.strictEqual(apres.brut, 1350);
  assert.strictEqual(apres.reporteDe, 2025, 'corriger un salarié repris efface d\'où il vient');
});

t('10.14.0 : un exercice CLOS ne bouge plus — la porte d\'écriture le refuse, et ce qui ne change aucun chiffre passe', () => {
  const N = exerciceN();
  assert.ok(KC.cloturerExercice(N, 'moi', 10).ok);
  const avant = KC.empreinteFigee(N);
  // Ce qui reste MOBILE : la clôture et sa trace, la piste d'audit, le lettrage, la révision, les
  // questions — aucun ne change un chiffre.
  const mobile = JSON.parse(JSON.stringify(N));
  mobile.audit.push({ quand: 11, qui: 'moi', quoi: 'lu' });
  mobile.questions = [{ id: 'q1', texte: 'Cette facture ?' }];
  mobile.revisions = [{ periode: '2025', comptes: {} }];
  mobile.lettrages = [{ id: 'L1' }];
  mobile.exercice.dossiersProduits = [{ le: 12 }];
  assert.strictEqual(KC.empreinteFigee(mobile), avant, 'la porte refuserait un geste qui ne change aucun chiffre');
  // Ce qui est FIGÉ : chaque liste que la clôture promet de ne plus laisser bouger.
  const gestes = {
    plan: l => l.plan.push({ compte: '6061', libelle: 'Carburant' }),
    journaux: l => l.journaux.push({ code: 'XX', libelle: 'Divers' }),
    ecritures: l => l.ecritures.push({ id: 'x', statut: 'brouillard', lignes: [] }),
    releves: l => { l.releves = (l.releves || []).concat([{ id: 'r' }]); },
    immobilisations: l => { l.immobilisations[0].valeur = 1; },
    declarations: l => { l.declarations = (l.declarations || []).concat([{ periode: '2025-12' }]); },
    inventaires: l => { l.inventaires = (l.inventaires || []).concat([{ id: 'i' }]); },
    salaries: l => { l.salaries[0].brut = 9; },
    bulletins: l => { l.bulletins = (l.bulletins || []).concat([{ id: 'b' }]); },
    ouverture: l => { l.ouverture.lignes[0].debit = 1; }
  };
  assert.deepStrictEqual(KC.FIGE_A_LA_CLOTURE, Object.keys(gestes), 'la liste de ce qui est figé a changé : c\'est une décision, pas un effet de bord');
  Object.entries(gestes).forEach(([k, f]) => {
    const c = JSON.parse(JSON.stringify(N));
    f(c);
    assert.notStrictEqual(KC.empreinteFigee(c), avant, k + ' bouge dans un exercice clos sans que la porte le voie');
  });
  // Le refus nomme le geste qui débloque.
  assert.ok(/est clos/.test(KC.refusExerciceClos(N)) && /Rouvre-le/.test(KC.refusExerciceClos(N)) && /motif/.test(KC.refusExerciceClos(N)));
  // La règle vit à la porte UNIQUE (9.2.0) : l'empreinte se prend à la lecture d'un exercice clos, et
  // l'écriture la compare AVANT de poser le verrou — un refus après le verrou le laisserait posé.
  const ouvrir = corps(mainCab, 'function ouvrirLivre(', 0);
  assert.ok(/if \(r\.livre && r\.livre\.exercice && r\.livre\.exercice\.clos\) figeAuChargement\.set\(r\.livre, KC\.empreinteFigee\(r\.livre\)\)/.test(ouvrir), 'la lecture d\'un exercice clos ne retient plus ce qu\'il porte');
  const ecrire = corps(mainCab, 'function ecrireLeLivre(', 0);
  const refus = ecrire.indexOf('throw erreur(\'ERR-CAB-064\', KC.refusExerciceClos(livre))');
  assert.ok(refus > 0, 'la porte d\'écriture ne refuse plus un exercice clos');
  assert.ok(/KC\.empreinteFigee\(livre\) !== fige/.test(ecrire) && /livre\.exercice\.clos/.test(ecrire), 'la porte ne compare plus ce que l\'exercice clos portait à la lecture');
  assert.ok(refus < ecrire.indexOf('poserVerrou'), 'le refus arrive après la pose du verrou');
});

t('10.14.0 : l\'à-nouveau n\'est pas l\'activité de janvier — il reste hors des cases du mois, et le crédit reporté le lit', () => {
  // Les DONNÉES discriminent (9.6.1) : l'IRPP de décembre porté par l'à-nouveau (87,730) vaut
  // exactement celui retenu en janvier. L'ancienne lecture donnait 175,460 — deux fois — et comptait
  // le crédit de TVA reporté comme de la TVA déductible du mois.
  const L = KC.livreVide('MF:X', 2026);
  const an = KC.ajouterEcriture(L, { date: '2026-01-01', journal: 'AN', piece: 'AN-2026', libelle: 'À-nouveaux 2026', source: 'an',
    lignes: [
      { compte: '532', libelle: 'Banque', debit: 1000, credit: 0 },
      { compte: '4366', libelle: 'TVA déductible', debit: 300, credit: 0 },
      { compte: '4321', libelle: 'IRPP de décembre', debit: 0, credit: 87.73 },
      { compte: '101', libelle: 'Capital', debit: 0, credit: 1212.27 }
    ] }, 'moi', 1);
  assert.ok(KC.validerEcriture(L, an.id, 'moi', 1).ok);
  const paie = KC.ajouterEcriture(L, { date: '2026-01-31', journal: 'OD', piece: 'PAIE-2026-01', libelle: 'Paie de janvier',
    lignes: [
      { compte: '641', libelle: 'Salaires', debit: 1000, credit: 0 },
      { compte: '4321', libelle: 'IRPP retenu', debit: 0, credit: 87.73 },
      { compte: '425', libelle: 'Net à payer', debit: 0, credit: 912.27 }
    ] }, 'moi', 2);
  assert.ok(KC.validerEcriture(L, paie.id, 'moi', 2).ok);
  const reverse = KC.ajouterEcriture(L, { date: '2026-01-15', journal: 'BQ', piece: 'RS-2025-12', libelle: 'IRPP de décembre reversé',
    lignes: [{ compte: '4321', libelle: 'IRPP', debit: 87.73, credit: 0 }, { compte: '532', libelle: 'Banque', debit: 0, credit: 87.73 }] }, 'moi', 3);
  assert.ok(KC.validerEcriture(L, reverse.id, 'moi', 3).ok);
  const d = KC.declarationMensuelle(L, '2026-01');
  assert.strictEqual(d.cases.irpp.montant, 87.73, 'l\'IRPP de décembre, porté par l\'à-nouveau, compte comme retenu en janvier');
  assert.strictEqual(d.cases.tvaDeductible.montant, 0, 'le crédit reporté se déclare comme de la TVA déductible du mois');
  assert.strictEqual(d.cases.creditReporte.montant, 300, 'le crédit de TVA venu de l\'à-nouveau n\'est pas reporté');
  // Février ne voit plus l'à-nouveau que dans son report : le crédit est intact.
  assert.strictEqual(KC.declarationMensuelle(L, '2026-02').cases.creditReporte.montant, 300);
});

t('10.14.0 : l\'exemple tient DEUX exercices — le précédent clos, rouvert une fois avec son motif, reclos ; le courant ouvert par ses à-nouveaux et son registre', () => {
  [['2026-09-25', 2026], ['2026-02-10', 2026], ['2026-03-05', 2026], ['2027-01-15', 2026]].forEach(([jour, annee]) => {
    const h = V.livreHorsSkanfact('MF:TEST5', { qui: 'test', quand: 1, aujourdhui: jour });
    assert.deepStrictEqual(h.motifs, [], jour + ' : ' + h.motifs.join(' ; '));
    assert.strictEqual(h.annee, annee, jour);
    const p = h.precedent.livre;
    assert.strictEqual(Number(p.exercice.annee), annee - 1, jour);
    assert.ok(p.exercice.clos, jour + ' : l\'exercice précédent n\'est pas clos');
    // Rouvert UNE fois, avec son motif, puis reclos : la trace que l'écran d'historique montre.
    assert.strictEqual((p.exercice.reouvertures || []).length, 1, jour);
    const re = p.exercice.reouvertures[0];
    assert.ok(/assurance/i.test(re.motif) && re.closLe && re.closLe < re.le && re.le < p.exercice.closLe, jour + ' : la suite clôture → réouverture → clôture n\'est pas dans l\'ordre');
    // Tout ce qui s'est passé l'a été AVANT aujourd'hui.
    [re.closLe, re.le, p.exercice.closLe].forEach(x => assert.ok(new Date(x).toISOString().slice(0, 10) <= jour, `${jour} : une clôture datée du futur`));
    // La pièce oubliée est entrée dans l'exercice, validée, pendant la réouverture.
    assert.ok(p.ecritures.some(e => /^ASS-/.test(e.piece) && e.statut === 'validee'), jour + ' : la pièce oubliée n\'est pas passée');
    // Les contrôles avant clôture passent tous — sept, puisque le cabinet tient le registre des biens.
    const c = KC.controlesCloture(p, {});
    assert.strictEqual(c.length, 7, jour + ' : ' + c.map(x => x.id).join(', '));
    assert.deepStrictEqual(c.filter(x => !x.ok).map(x => x.id + ' : ' + x.detail), [], jour);
    // Le courant s'ouvre par ses à-nouveaux, VALIDÉS, numéro 1.
    const l = h.livre;
    const an = l.ecritures.find(e => e.source === 'an' && e.journal === 'AN');
    assert.ok(an && an.statut === 'validee' && an.numero === 1, jour + ' : les à-nouveaux ne sont pas la pièce n° 1 validée');
    // Et ils portent la pièce oubliée : ils ont été calculés APRÈS la seconde clôture. Posés à la
    // première, la banque des à-nouveaux dépasserait de l'assurance celle de la fin d'exercice.
    const banque = KC.round3((an.lignes || []).filter(x => x.compte === '532').reduce((s, x) => s + x.debit - x.credit, 0));
    const bal = KC.balanceDepuisLignes(KC.lignesDuLivre(p), KC.soldesDepuisOuverture(p));
    const soldeFin = ((bal.rows.find(r => r.account === '532') || {}).solde) || 0;
    assert.ok(soldeFin > 0, jour);
    assert.strictEqual(banque, soldeFin, jour + ' : la banque des à-nouveaux n\'est pas celle de la fin d\'exercice');
    // Le registre a suivi : le pont repris, le mécanicien repris ; l'aide embauchée cette année, non.
    assert.ok(l.immobilisations.some(f => /Pont/.test(f.libelle) && f.reporteDe === annee - 1), jour + ' : le pont n\'a pas suivi');
    assert.ok(l.salaries.some(s => s.id === 'sal-exemple-1' && s.reporteDe === annee - 1), jour + ' : le mécanicien n\'a pas suivi');
    assert.ok(l.salaries.some(s => s.id === 'sal-exemple-2' && !s.reporteDe), jour + ' : l\'aide se dit reprise');
    assert.deepStrictEqual(KC.immobilisationsACreer(l, annee), [], jour + ' : le report se propose comme un achat');
    assert.ok(h.anouveaux && h.anouveaux.biens >= 1 && h.anouveaux.salaries >= 1, jour);
  });
});

t('10.14.0 : « Le contrôle passe » ou « Les sept contrôles passent » — le compte se LIT sur la liste, jamais écrit en dur', () => {
  const i = appCab.indexOf('const EN_LETTRES = ');
  assert.ok(i > 0, 'EN_LETTRES introuvable');
  const bloc = appCab.slice(i, appCab.indexOf('\n', appCab.indexOf('const controlesPassent', i)));
  const ctx = {};
  vm.runInNewContext(bloc + '\nthis.f = controlesPassent;', ctx);
  assert.strictEqual(ctx.f(1), 'Le contrôle passe.', 'un seul contrôle ne s\'accorde pas');
  assert.strictEqual(ctx.f(6), 'Les six contrôles passent.', 'six contrôles ne s\'écrivent pas en lettres');
  assert.strictEqual(ctx.f(7), 'Les sept contrôles passent.', 'le compte n\'est pas celui de la liste');
  assert.strictEqual(ctx.f(12), 'Les 12 contrôles passent.', 'au-delà de dix, le compte ne s\'écrit pas en chiffres');
  assert.ok(/controlesPassent\(\(d\.controles \|\| \[\]\)\.length\)/.test(appCab), 'l\'écran n\'écrit plus le compte lu sur la liste');
  assert.ok(!/Les six contrôles passent/.test(appCab), '« Les six contrôles » est revenu en dur');
  // Le jumeau de l'Aide : son sous-titre écrivait « Six contrôles » pendant que l'écran en comptait
  // sept. Ni l'Aide ni une visite ne comptent les contrôles — le compte vit sur l'écran, lu sur la liste.
  ['cabguide.js', 'cabvisites.js'].forEach(f => {
    const src = sansCommentaires(lireSource('src', 'cabinet', 'renderer', f));
    const m = src.match(/\b(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|\d+)\s+contrôles\b/i);
    assert.ok(!m, f + ' écrit un nombre de contrôles en dur : « ' + (m && m[0]) + ' »');
  });
});

t('10.14.0 : l\'exercice vit dans l\'ADRESSE de la comptabilité, et toute porte qui en change réécrit l\'adresse', () => {
  assert.ok(/drawDossier\(view, arg, hash\.split\('\/'\)\[2\], hash\.split\('\/'\)\[3\], hash\.split\('\/'\)\[4\]\)/.test(appCab), 'le routeur ne transmet pas l\'exercice de l\'adresse');
  const fiche = corps(appCab, 'function drawDossier(', 2);
  assert.ok(/\/\^\\d\{4\}\$\/\.test\(String\(anneeDemandee \|\| ''\)\) && String\(livresState\.annee\) !== anneeDemandee/.test(fiche), 'la fiche ignore l\'exercice de l\'adresse, ou le prend sans vérifier que c\'est une année');
  // L'adresse se fabrique par UNE fonction, et elle porte l'exercice du dossier qu'on regarde.
  const adr = corps(appCab, 'function adresseCompta(', 2);
  const ctx = { encodeURIComponent, livresState: { dossierId: 'MF:1', annee: '2025' } };
  vm.runInNewContext(adr + '\nthis.f = adresseCompta;', ctx);
  assert.strictEqual(ctx.f({ id: 'MF:1' }, 'exercice'), '#/dossier/MF%3A1/comptabilite/exercice/2025', 'l\'adresse ne porte pas l\'exercice regardé');
  assert.strictEqual(ctx.f({ id: 'MF:2' }, 'journal'), '#/dossier/MF%3A2/comptabilite/journal', 'l\'exercice d\'un client suit sur un autre');
  // CHAQUE changement d'exercice réécrit l'adresse — sinon le prochain redessin ramènerait l'ancien.
  // Trois exceptions nommées, qui ne CHANGENT pas d'exercice : la remise à zéro d'un autre dossier,
  // le choix par défaut quand rien n'est choisi, et l'exercice lu dans l'adresse elle-même.
  const sites = [...appCab.matchAll(/\b(?:s|livresState)\.annee = /g)].map(m => m.index);
  assert.ok(sites.length >= 6, 'changements d\'exercice lus : ' + sites.length);
  sites.forEach(i => {
    const apres = appCab.slice(i, i + 700);
    if (/^s\.annee = '';/.test(apres) || /^s\.annee = m\.length/.test(apres) || /^livresState\.annee = anneeDemandee;/.test(apres)) return;
    assert.ok(/suivreExercice\(dossier\)|adresseCompta\(dossier|location\.hash = /.test(apres), 'un changement d\'exercice ne réécrit pas l\'adresse : ' + apres.slice(0, 90));
  });
});

t('10.14.0 : la découverte montre l\'exercice clos du garage — sa réouverture, ce qu\'il laisse, et le registre qui a suivi', () => {
  const ctxDe = exercices => ({ state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'MF:X', exercices: () => exercices,
    estExemple: () => true, cleSecours: () => true, copieExterne: () => true, Visite: require('../../src/renderer/visite.js') });
  const deux = [{ annee: '2025', clos: true }, { annee: '2026', clos: false }];
  const d = CV.parcours(ctxDe(deux)).find(v => v.id === 'decouvrir');
  const par = titre => { const e = d.etapes.find(x => x.titre === titre); assert.ok(e, 'étape introuvable : ' + titre); return e; };
  const page = e => (typeof e.page === 'function' ? e.page() : e.page);
  assert.ok(d.etapes.some(e => e.chapitre === 'D\'un exercice à l\'autre'), 'le chapitre des deux exercices a disparu');
  // L'exercice est dans l'ADRESSE de chaque étape : elle ne dépend pas de celui que la page avait en mémoire.
  const clos = '#/dossier/MF%3AX/comptabilite/exercice/2025';
  assert.strictEqual(page(par('Un exercice clos')), clos, 'l\'étape de l\'exercice clos n\'ouvre pas l\'exercice clos');
  assert.strictEqual(page(par('Rouvert, avec son motif')), clos);
  assert.strictEqual(page(par('Ce qu\'il laisse au suivant')), clos);
  assert.strictEqual(par('Rouvert, avec son motif').cible, '#cl-historique');
  assert.strictEqual(par('Ce qu\'il laisse au suivant').cible, '#cl-sec-an');
  assert.ok(typeof par('Rouvert, avec son motif').avant === 'function', 'l\'historique replié n\'est pas déplié pour être lu');
  assert.strictEqual(page(par('Les à-nouveaux reçus')), '#/dossier/MF%3AX/comptabilite/journal/2026');
  assert.strictEqual(page(par('Le registre a suivi')), '#/dossier/MF%3AX/comptabilite/immobilisations/2026');
  assert.ok([].concat(par('Le registre a suivi').cible).includes('#c-livres [data-repris]'), 'l\'étape du registre ne vise plus la marque « repris de »');
  // Les étapes du client tenu montrent l'exercice COURANT.
  assert.strictEqual(page(par('La saisie')), '#/dossier/MF%3AX/comptabilite/saisie/2026', 'la saisie du garage ne dit pas son exercice');
  assert.strictEqual(page(par('Sa paie')), '#/dossier/MF%3AX/comptabilite/paie/2026', 'la paie du garage ne dit pas son exercice');
  // Sans exercice clos, le chapitre se saute : il ne décrit pas ce qui n'existe pas.
  const titres = ['Un exercice clos', 'Rouvert, avec son motif', 'Ce qu\'il laisse au suivant', 'Les à-nouveaux reçus', 'Le registre a suivi'];
  titres.forEach(x => assert.strictEqual(par(x).si(), true, x));
  const un = CV.parcours(ctxDe([{ annee: '2026', clos: false }])).find(v => v.id === 'decouvrir');
  titres.forEach(x => assert.strictEqual(un.etapes.find(e => e.titre === x).si(), false, x + ' se montre sans exercice clos'));
  // La marque que la visite vise existe à l'écran, sur les biens ET sur les salariés repris.
  assert.ok(/data-repris="\$\{esc\(r\.reporteDe\)\}"/.test(appCab), 'les biens repris ne portent plus leur marque');
  assert.ok(/data-repris="\$\{esc\(x\.reporteDe\)\}"/.test(appCab), 'les salariés repris ne portent plus leur marque');
  // L'index dit quel exercice est clos, sans ouvrir un livre (mesure de la 9.1.0).
  const q = mainCab.slice(mainCab.indexOf('ipcMain.handle(\'cab:questionsEnAttente\''), mainCab.indexOf('ipcMain.handle(\'cab:fusionner\''));
  assert.ok(q.length > 200 && q.length < 4000, 'tranche suspecte : ' + q.length);
  assert.ok(/clos: !!e\.clos/.test(q), 'le résumé des index ne dit plus quel exercice est clos');
  assert.ok(/exercices: exercicesDe/.test(appCab), 'la visite ne reçoit plus les exercices des dossiers');
});

// Vu à la souris : la découverte sautait son chapitre « D'un exercice à l'autre » — de la liasse aux
// relances, sans un mot. Les livres disaient bien 2025 clos et 2026 ouvert ; c'est le RÉSUMÉ des
// index, lu au démarrage (avant l'exemple), que la condition du chapitre lisait. Un test pur ne
// pouvait pas le voir : il donne ses exercices à la visite au lieu de les lire là où l'écran les lit.
t('10.14.0 : le résumé des livres se RELIT quand l\'exemple change et quand une visite part — sinon le chapitre des deux exercices se saute', () => {
  const ex = corps(appCab, 'async function chargerOuRetirerExemple(', 2);
  assert.ok(ex.length < 1500, 'tranche suspecte : ' + ex.length);
  const demo = ex.indexOf('api.demo(on)'), relu = ex.indexOf('await chargerQuestionsAttente(');
  assert.ok(demo > 0 && relu > demo, 'charger ou retirer l\'exemple ne relit plus le résumé des livres, ou le relit AVANT de les écrire');
  const lv = corps(appCab, 'async function lancerVisite(', 2);
  assert.ok(lv.length < 3000, 'tranche suspecte : ' + lv.length);
  const relu2 = lv.indexOf('await chargerQuestionsAttente('), lance = lv.indexOf('Visite.lancer(');
  assert.ok(relu2 > 0 && lance > relu2, 'une visite part sur le résumé du démarrage : ses conditions lisent un état périmé');
  // Et la condition du chapitre lit bien CE résumé — sinon le relire ne servirait à rien.
  const ed = corps(appCab, 'function exercicesDe(', 2);
  assert.ok(/questionsAttente/.test(ed), 'la visite lit les exercices ailleurs que dans le résumé qu\'on relit');
});

// Vu à la souris : « Quitter l'exemple » depuis la paie du garage laissait l'écran sur « Ce dossier
// n'existe plus. » — la barre latérale pour seule sortie.
t('10.14.0 : quitter l\'exemple depuis un dossier fictif ramène au portefeuille, et un dossier disparu donne le geste qui en sort', () => {
  const fiche = corps(appCab, 'function drawDossier(', 2);
  const vide = fiche.slice(0, fiche.indexOf('const row = K.dossierRow(dossier);'));
  assert.ok(vide.length > 80 && vide.length < 1500, 'tranche suspecte : ' + vide.length);
  assert.ok(/if \(!dossier\)/.test(vide) && /id="dz-retour"/.test(vide) && /navigate\('#\/dossiers'\)/.test(vide),
    'la fiche d\'un dossier disparu ne donne plus le geste qui en sort');
  const ban = corps(appCab, 'function bandeauDemo(', 2);
  const off = ban.slice(ban.indexOf('off.onclick'), ban.indexOf('toast(\'Exemple effacé.\')'));
  assert.ok(off.length > 50 && off.length < 1200, 'tranche suspecte : ' + off.length);
  assert.ok(/location\.hash = '#\/dossiers'/.test(off) && /\.some\(d => d\.id === decodeURIComponent\(/.test(off),
    'quitter l\'exemple depuis un dossier fictif laisse l\'écran sur un dossier parti');
  // Et sur la fiche d'un VRAI dossier, on reste : la condition vérifie que le dossier n'existe plus.
  assert.ok(/else render\(\)/.test(off), 'quitter l\'exemple renvoie au portefeuille même depuis un vrai dossier');
});

// Vu à la souris : la découverte éclairait la marque « repris de 2025 »… et l'écran ne montrait que
// « … » — la marque suivait le nom dans une cellule tronquée, donc elle partait la première.
t('10.14.0 : dans une cellule tronquée, le NOM se coupe et ses marques jamais — biens et salariés repris', () => {
  const m = corps(appCab, 'function marquesDuNom(', 2);
  assert.ok(/class="face"><span class="face-p">\$\{nomHtml\}<\/span><span class="face-m">/.test(m), 'le nom et ses marques ne sont plus séparés');
  assert.ok(/m\.length \? /.test(m), 'un nom sans marque gagne une enveloppe pour rien');
  // Les deux tableaux qui portent la marque la rangent dans la partie qui ne se coupe pas.
  const repris = [...appCab.matchAll(/<td class="tronq"[^>]*>\$\{marquesDuNom\(esc\([a-z]\.(libelle|nom)\), \[\s*[a-z]\.reporteDe \? `<span class="badge" data-repris=/g)];
  assert.strictEqual(repris.length, 2, 'la marque « repris de » n\'est plus hors de la partie tronquée sur les biens ET les salariés');
  assert.ok(!/\$\{esc\([a-z]\.(libelle|nom)\)\}\$\{[a-z]\.reporteDe/.test(appCab), 'une marque suit encore un nom tronqué');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/#c-livres td\.tronq \.face-m \{[^}]*flex: none/.test(css) && /#c-livres td\.tronq \.face-p \{[^}]*text-overflow: ellipsis/.test(css),
    'la partie des marques se coupe comme le nom');
});

// Vu à la souris : sur l'exercice clos du garage, « Ouvrir 2026 (à-nouveaux)… » répondait en rouge
// « Les à-nouveaux de 2026 sont déjà validés. Contre-passe-les si le report a changé. » — et, une
// fois la contre-passation faite, EXACTEMENT la même phrase : le miroir d'une contre-passation garde
// `source: 'an'` et se valide, donc il comptait comme des à-nouveaux en vigueur.
t('10.14.0 : la sortie que le refus promet EXISTE — après la contre-passation des à-nouveaux validés, « Ouvrir N+1 » les repose', () => {
  const N = exerciceN();
  const N1 = livreN1(N);
  const r = KC.ouvrirExerciceSuivant(N, N1, 'moi', 11);
  assert.ok(KC.validerEcriture(N1, r.ecriture.id, 'moi', 12).ok);
  assert.strictEqual(KC.ouvrirExerciceSuivant(N, N1, 'moi', 13).rien, true, 'un geste qui n\'a rien à faire ne se distingue pas d\'une panne');
  assert.ok(KC.contrepasser(N1, r.ecriture.id, 'moi', '2026-02-01', 14).ok);
  const repose = KC.ouvrirExerciceSuivant(N, N1, 'moi', 15);
  assert.ok(repose.ok, 'après la contre-passation conseillée, le geste refuse encore : ' + repose.motif);
  assert.strictEqual(repose.anDejaValides, false);
  assert.ok(repose.ecriture && repose.ecriture.statut === 'brouillard', 'les à-nouveaux ne sont pas reposés en brouillard');
  // Le miroir reste un miroir : il n'est jamais pris pour des à-nouveaux en vigueur.
  const miroir = N1.ecritures.find(e => e.contrepasseDe === r.ecriture.id);
  assert.ok(miroir && miroir.source === 'an' && miroir.statut === 'validee', 'le jeu de données ne discrimine plus : le miroir n\'est pas une « an » validée');
  assert.strictEqual(KC.anEnVigueur(miroir), false, 'le miroir d\'une contre-passation compte comme des à-nouveaux en vigueur');
  assert.strictEqual(KC.anEnVigueur(repose.ecriture), false, 'un brouillard compte comme en vigueur');
});

t('10.14.0 : une extourne prévue APRÈS la validation des à-nouveaux part quand même — une fois', () => {
  const N = exerciceN();
  const prov = KC.ajouterEcriture(N, { date: '2025-12-20', journal: 'OD', piece: 'PROV-12', libelle: 'Électricité de décembre',
    lignes: [{ compte: '6061', libelle: 'Électricité', debit: 340, credit: 0 }, { compte: '408', libelle: 'Facture à recevoir', debit: 0, credit: 340 }] }, 'moi', 6);
  assert.ok(KC.validerEcriture(N, prov.id, 'moi', 6).ok);
  const N1 = livreN1(N);
  const r = KC.ouvrirExerciceSuivant(N, N1, 'moi', 11);
  assert.ok(KC.validerEcriture(N1, r.ecriture.id, 'moi', 12).ok);
  // Prévue maintenant, avec des à-nouveaux déjà validés : « Prévoir l'extourne » promet que le geste
  // la posera. Avant, il refusait « déjà validés », et l'extourne ne partait jamais.
  assert.ok(KC.prevoirExtourne(N, prov.id, 'moi', 13).ok);
  const c = KC.ouvrirExerciceSuivant(N, N1, 'moi', 14);
  assert.ok(c.ok, 'l\'extourne prévue ne part pas : ' + c.motif);
  assert.strictEqual(c.anDejaValides, true);
  assert.strictEqual(c.extournes, 1, 'le compte rendu ne dit pas l\'extourne posée');
  const ext = N1.ecritures.filter(e => e.extourneDe === prov.id);
  assert.strictEqual(ext.length, 1);
  assert.strictEqual(ext[0].date, '2026-01-01');
  assert.strictEqual(N1.ecritures.filter(e => e.source === 'an').length, 1, 'des à-nouveaux validés ont été reposés');
  // Une seconde fois : rien — une extourne posée deux fois annule la charge deux fois.
  const encore = KC.ouvrirExerciceSuivant(N, N1, 'moi', 15);
  assert.strictEqual(encore.ok, false, 'l\'extourne se repose à chaque geste');
  assert.strictEqual(N1.ecritures.filter(e => e.extourneDe === prov.id).length, 1, 'l\'extourne a été posée deux fois');
});

t('10.14.0 : ce que ferait « Ouvrir N+1 » se décide en jouant LE MÊME geste sur une copie — ouvrir, refaire, compléter, voir, refus', () => {
  const N = exerciceN();
  const s0 = KC.etatExerciceSuivant(N, null);
  assert.deepStrictEqual([s0.etat, s0.annee, s0.existe], ['ouvrir', 2026, false]);
  const N1 = livreN1(N);
  const vide = KC.etatExerciceSuivant(N, N1);
  assert.deepStrictEqual([vide.etat, vide.existe], ['ouvrir', true], 'un livre de N+1 sans à-nouveaux ne propose pas de les poser');
  const r = KC.ouvrirExerciceSuivant(N, N1, 'moi', 11);
  const avant = JSON.stringify(N1);
  assert.strictEqual(KC.etatExerciceSuivant(N, N1).etat, 'refaire');
  assert.strictEqual(JSON.stringify(N1), avant, 'décider du libellé a écrit dans le livre de N+1');
  assert.ok(KC.validerEcriture(N1, r.ecriture.id, 'moi', 12).ok);
  const voir = KC.etatExerciceSuivant(N, N1);
  assert.strictEqual(voir.etat, 'voir', 'tout est reporté, et l\'écran proposerait encore d\'ouvrir : ' + voir.etat);
  assert.deepStrictEqual(voir.ecart, [], 'des à-nouveaux conformes se disent en écart');
  // Un bien entré dans N après la validation : il reste quelque chose à reporter.
  assert.ok(KC.ajouterImmobilisation(N, { id: 'valise', libelle: 'Valise de diagnostic', compte: '223', valeur: 3000,
    dateAcquisition: '2025-12-15', dateMiseEnService: '2025-12-15', duree: 5, methode: 'lineaire' }, 'moi', 13).ok);
  const comp = KC.etatExerciceSuivant(N, N1);
  assert.strictEqual(comp.etat, 'completer');
  assert.strictEqual(comp.biens, 1);
  // Et le libellé suit le geste : joué pour de vrai, il ne reste plus qu'à voir.
  assert.ok(KC.ouvrirExerciceSuivant(N, N1, 'moi', 14).ok);
  assert.strictEqual(KC.etatExerciceSuivant(N, N1).etat, 'voir');
  // Un exercice sans aucun solde : le bouton s'éteint avec la raison que le geste donnerait.
  const nu = KC.livreVide('MF:Y', 2025);
  const refus = KC.etatExerciceSuivant(nu, null);
  assert.strictEqual(refus.etat, 'refus');
  assert.strictEqual(refus.motif, KC.ouvrirExerciceSuivant(nu, KC.livreSuivantVide(nu), 'x', 1).motif, 'le bouton éteint ne dit pas ce que le geste répondrait');
});

t('10.14.0 : « contre-passe-les si le report a changé » se VÉRIFIE — l\'écart entre les à-nouveaux validés et la clôture, compte par compte', () => {
  const N = exerciceN();
  const N1 = livreN1(N);
  const r = KC.ouvrirExerciceSuivant(N, N1, 'moi', 11);
  assert.ok(KC.validerEcriture(N1, r.ecriture.id, 'moi', 12).ok);
  assert.deepStrictEqual(KC.ecartAnouveaux(N, N1), []);
  // N change après la validation (une facture de décembre saisie en janvier) : la banque et le
  // résultat ne sont plus ceux que les à-nouveaux portent. Des DONNÉES qui ne se compensent pas.
  const tard = KC.ajouterEcriture(N, { date: '2025-12-28', journal: 'BQ', piece: 'F-900', libelle: 'Pneus',
    lignes: [{ compte: '6061', libelle: 'Pneus', debit: 250, credit: 0 }, { compte: '532', libelle: 'Banque', debit: 0, credit: 250 }] }, 'moi', 13);
  assert.ok(KC.validerEcriture(N, tard.id, 'moi', 13).ok);
  const e = KC.ecartAnouveaux(N, N1);
  const banque = e.find(x => x.compte === '532');
  assert.ok(banque, 'l\'écart ne nomme pas la banque : ' + JSON.stringify(e));
  assert.strictEqual(banque.ecart, -250, 'l\'écart de la banque n\'est pas celui de la pièce ajoutée');
  assert.strictEqual(banque.attendu, KC.round3(banque.porte - 250));
  assert.ok(e.some(x => x.compte === '13'), 'le résultat reporté ne se dit pas en écart');
  assert.strictEqual(KC.etatExerciceSuivant(N, N1).etat, 'voir');
  assert.strictEqual(KC.etatExerciceSuivant(N, N1).ecart.length, e.length, 'l\'état ne porte pas l\'écart que l\'écran affiche');
});

t('10.14.0 : l\'écran de l\'exercice lit l\'état du moteur — le bouton dit ce qu\'il fera, « Voir » emmène sans rien écrire, un refus s\'éteint avec sa raison', () => {
  // Le libellé, évalué pour chaque état.
  const f = corps(appCab, 'function libelleSuivant(', 2);
  const ctx = {};
  vm.runInNewContext(f + '\nthis.f = libelleSuivant;', ctx);
  assert.strictEqual(ctx.f({ etat: 'ouvrir', annee: 2026, existe: false }), 'Ouvrir 2026 (à-nouveaux)…');
  assert.strictEqual(ctx.f({ etat: 'ouvrir', annee: 2026, existe: true }), 'Poser les à-nouveaux de 2026…');
  assert.strictEqual(ctx.f({ etat: 'refaire', annee: 2026 }), 'Refaire les à-nouveaux de 2026…');
  assert.strictEqual(ctx.f({ etat: 'completer', annee: 2026 }), 'Compléter l\'ouverture de 2026…');
  assert.strictEqual(ctx.f({ etat: 'voir', annee: 2026 }), 'Voir les à-nouveaux de 2026', '« Voir » promet une question qu\'il ne pose pas');
  // Le bouton est posé par cette fonction, jamais par un libellé écrit en dur.
  const vue = corps(appCab, 'function vueCloture(', 2);
  assert.ok(/id="cl-suivant"[^>]*>\$\{esc\(libelleSuivant\(su\)\)\}<\/button>/.test(vue), 'le bouton de l\'exercice suivant ne lit plus l\'état du moteur');
  assert.ok(!/Ouvrir \$\{esc\(Number\(ex\.annee\) \+ 1\)\} \(à-nouveaux\)/.test(vue), 'le libellé écrit en dur est revenu');
  assert.ok(/su\.etat === 'refus' \? ' disabled aria-describedby="cl-suivant-motif"'/.test(vue) && /id="cl-suivant-motif"/.test(vue),
    'un report impossible laisse un bouton actif, ou éteint sans dire pourquoi sous ses yeux');
  assert.ok(/id="cl-ecart-an"/.test(vue), 'l\'écart des à-nouveaux validés ne se montre pas');
  // Un solde dans une phrase dit son SENS en mots, jamais un signe (6.3.0) : « −29 872,140 DT portés »
  // se lisait comme une faute de frappe sous les yeux d'un comptable.
  const iS = appCab.indexOf('const soldeEnClair = ');
  assert.ok(iS > 0, 'soldeEnClair introuvable');
  const ctxS = { money: v => v.toFixed(3).replace('.', ',') + ' DT' };
  vm.runInNewContext(appCab.slice(iS, appCab.indexOf('\n', iS)) + '\nthis.f = soldeEnClair;', ctxS);
  assert.strictEqual(ctxS.f(-29872.14), '29872,140 DT créditeur', 'un solde créditeur garde son signe dans la phrase');
  assert.strictEqual(ctxS.f(45718.075), '45718,075 DT débiteur');
  assert.strictEqual(ctxS.f(0), 'soldé');
  const phrase = vue.slice(vue.indexOf('id="cl-ecart-an"'), vue.indexOf('</div>', vue.indexOf('id="cl-ecart-an"')));
  assert.ok(/soldeEnClair\(x\.porte\)/.test(phrase) && /soldeEnClair\(x\.attendu\)/.test(phrase) && !/money\(x\.(porte|attendu)\)/.test(phrase),
    'l\'écart des à-nouveaux écrit ses soldes avec un signe');
  // « Voir » n'appelle pas le geste : il emmène au journal des à-nouveaux de l'année d'après.
  const br = corps(appCab, 'function brancherCloture(', 2);
  const clic = br.slice(br.indexOf('const su = $(\'#cl-suivant\', el);'));
  const voir = clic.indexOf('=== \'voir\''), appel = clic.indexOf('api.ouvrirSuivant(');
  assert.ok(voir > 0 && appel > voir, '« Voir » appelle encore le geste, qui répondrait « déjà validés » en rouge');
  assert.ok(/s\.journal = 'AN';\s*await ouvrirExercice\(root, dossier, String\(Number\(s\.annee\) \+ 1\), 'journal'\);\s*return;/.test(clic.slice(voir, appel)),
    '« Voir » ne mène pas au journal des à-nouveaux de l\'année d\'après');
  // Rester sur N après le geste relit l'état : sinon le bouton dirait encore « Ouvrir ».
  assert.ok(/await chargerCloture\(root, dossier\);\s*\};/.test(clic), 'le bouton ne se relit pas après le geste');
  // Le processus principal rend l'état, et construit le livre suivant par la fonction du moteur.
  assert.ok(/suivant: KC\.etatExerciceSuivant\(livre, ouvrirLivre\(dossierId, Number\(annee\) \+ 1\)\.livre\)/.test(mainCab), 'la lecture de l\'exercice ne dit plus ce que ferait « Ouvrir N+1 »');
  assert.ok(/const cible = o\.livre \|\| KC\.livreSuivantVide\(livre, dossierId\);/.test(mainCab), 'le geste construit son livre suivant à part');
  assert.ok(/suivantEtat: suivant\.livre \? KC\.etatExerciceSuivant\(/.test(mainCab), '« Prévoir l\'extourne » propose encore de refaire des à-nouveaux validés');
});

};
