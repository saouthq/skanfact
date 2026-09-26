'use strict';
// ============================================================================================
// L'aller-retour par le tableur (10.14.1)
//
// Un comptable qui reprend la comptabilité d'une entreprise mal tenue l'EXPORTE, la corrige dans
// Excel et la RÉIMPORTE. Ce que ces tests tiennent : que rien n'est supprimé, que tout entre en
// brouillard, qu'une validée ne se modifie jamais (elle se contre-passe, si on le demande), que
// chaque ligne écartée est nommée par son numéro de ligne dans le tableur — et que la pièce qu'un
// cabinet a corrigée ne se fait plus écraser par le paquet du client relu.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');

// Un livre : une facture VALIDÉE (n° 1) et un règlement du client resté en brouillard, venu d'un
// paquet (source « skanfact »), qui porte le NOM et l'identifiant du tiers.
const livreDeDepart = () => {
  const L = K.livreVide('D', 2026);
  const f = K.ajouterEcriture(L, { date: '2026-03-04', journal: 'VT', piece: 'F1', libelle: 'Facture',
    lignes: [{ compte: '411', tiers: 'Clinique', tiersId: 'c1', libelle: 'Facture', debit: 119 },
      { compte: '706', libelle: 'Facture', credit: 100 }, { compte: '4367', libelle: 'TVA', credit: 19 }] }, 't', 1);
  K.validerEcriture(L, f.id, 't', 2);
  K.ajouterEcriture(L, { date: '2026-03-05', journal: 'BQ', piece: 'R1', libelle: 'Règlement', source: 'skanfact', mois: '2026-03',
    lignes: [{ compte: '532', debit: 119 }, { compte: '411', tiers: 'Clinique', tiersId: 'c1', credit: 119 }] }, 't', 3);
  return L;
};
const ENTETE = 'N°;Date;Journal;Pièce;Compte;Tiers;Libellé;Débit;Crédit;Lettrage';
// Le livre tel que l'export du livre-journal l'écrit (N° 0 pour un brouillard).
const EXPORT = [ENTETE,
  '1;04/03/2026;VT;F1;411;Clinique;Facture;119,000;;', '1;04/03/2026;VT;F1;706;;Facture;;100,000;', '1;04/03/2026;VT;F1;4367;;TVA;;19,000;',
  '0;05/03/2026;BQ;R1;532;;Règlement;119,000;;', '0;05/03/2026;BQ;R1;411;Clinique;Règlement;;119,000;'];

t('tableur : un export réimporté tel quel ne change RIEN', () => {
  const L = livreDeDepart();
  const avant = JSON.stringify(L.ecritures);
  const a = K.analyserImportEcritures(L, EXPORT.join('\n'));
  assert.ok(a.ok, a.motif);
  assert.deepStrictEqual(a.pieces.map(p => p.action), ['identique', 'identique']);
  const r = K.appliquerImportEcritures(L, a, { qui: 'moi', quand: 9, jour: '2026-09-26' });
  assert.strictEqual(r.identiques, 2);
  assert.strictEqual(JSON.stringify(L.ecritures), avant, 'un aller-retour sans correction a modifié le livre');
});

t('tableur : une pièce nouvelle entre en BROUILLARD, source « import », même équilibrée', () => {
  const L = livreDeDepart();
  const csv = EXPORT.concat(['0;10/03/2026;AC;A7;607;;Marchandises;200,000;;', '0;10/03/2026;AC;A7;401;Fournisseur X;Marchandises;;200,000;']).join('\n');
  const a = K.analyserImportEcritures(L, csv);
  assert.strictEqual(a.compte.nouvelles, 1);
  K.appliquerImportEcritures(L, a, { qui: 'moi', quand: 9, jour: '2026-09-26' });
  const e = L.ecritures.find(x => x.piece === 'A7');
  assert.ok(e, 'la pièce nouvelle n\'est pas entrée');
  assert.strictEqual(e.statut, 'brouillard', 'une pièce importée ne doit jamais entrer validée : le comptable relit et valide');
  assert.strictEqual(e.numero, null);
  assert.strictEqual(e.source, 'import');
  assert.strictEqual(e.lignes.find(l => l.compte === '401').tiers, 'Fournisseur X', 'le tiers du tableur s\'est perdu');
  assert.ok(L.plan.some(c => c.compte === '607'), 'le compte nouveau n\'est pas entré au plan');
});

t('tableur : rien n\'est SUPPRIMÉ — une écriture absente du fichier ne bouge pas', () => {
  const L = livreDeDepart();
  const a = K.analyserImportEcritures(L, [ENTETE, '0;10/03/2026;OD;X;606;;Frais;10;;', '0;10/03/2026;OD;X;401;;Frais;;10;'].join('\n'));
  K.appliquerImportEcritures(L, a, { qui: 'moi', quand: 9, jour: '2026-09-26' });
  assert.ok(L.ecritures.some(e => e.piece === 'F1'), 'un fichier partiel a fait disparaître la facture');
  assert.ok(L.ecritures.some(e => e.piece === 'R1'), 'un fichier partiel a fait disparaître le brouillard');
});

t('tableur : un brouillard corrigé est remplacé EN PLACE, et garde son identifiant de tiers', () => {
  const L = livreDeDepart();
  const id = L.ecritures.find(e => e.piece === 'R1').id;
  // Le comptable range le règlement à la BANQUE (512) au lieu du 532, et le date du 6.
  const csv = [ENTETE, '0;06/03/2026;BQ;R1;512;;Règlement;119,000;;', '0;06/03/2026;BQ;R1;411;Clinique;Règlement;;119,000;'].join('\n');
  const a = K.analyserImportEcritures(L, csv);
  assert.strictEqual(a.pieces[0].action, 'brouillard', 'la date changée dans le tableur en a fait une pièce NOUVELLE — la même pièce aurait été comptée deux fois');
  K.appliquerImportEcritures(L, a, { qui: 'moi', quand: 9, jour: '2026-09-26' });
  const r1 = L.ecritures.filter(e => e.piece === 'R1');
  assert.strictEqual(r1.length, 1);
  assert.strictEqual(r1[0].id, id, 'le brouillard a été remplacé par un autre (justificatif et lettrage perdus)');
  assert.strictEqual(r1[0].date, '2026-03-06');
  assert.ok(r1[0].lignes.some(l => l.compte === '512'));
  const l411 = r1[0].lignes.find(l => l.compte === '411');
  assert.strictEqual(l411.tiersId, 'c1', 'l\'identifiant du tiers s\'est perdu : la ligne tombe « sans tiers » dans la balance auxiliaire');
});

t('tableur : une validée que le fichier change ne bouge pas… sauf si on demande de la contre-passer', () => {
  const csv = [ENTETE, '1;04/03/2026;VT;F1;411;Clinique;Facture;119,000;;', '1;04/03/2026;VT;F1;7061;;Facture;;100,000;', '1;04/03/2026;VT;F1;4367;;TVA;;19,000;'].join('\n');
  const L1 = livreDeDepart();
  const a1 = K.analyserImportEcritures(L1, csv);
  assert.strictEqual(a1.pieces[0].action, 'validee');
  const r1 = K.appliquerImportEcritures(L1, a1, { qui: 'moi', quand: 9, jour: '2026-09-26' });
  assert.strictEqual(r1.validees.length, 1, 'la validée changée n\'est pas nommée');
  assert.strictEqual(r1.validees[0].numero, 1);
  const f1 = L1.ecritures.find(e => e.numero === 1);
  assert.strictEqual(f1.statut, 'validee', 'une validée a été touchée sans qu\'on le demande');
  assert.ok(f1.lignes.some(l => l.compte === '706'));

  const L2 = livreDeDepart();
  const a2 = K.analyserImportEcritures(L2, csv);
  const r2 = K.appliquerImportEcritures(L2, a2, { qui: 'moi', quand: 9, jour: '2026-09-26', corrigerValidees: true });
  assert.strictEqual(r2.corrigees, 1);
  const orig = L2.ecritures.find(e => e.numero === 1);
  assert.strictEqual(orig.statut, 'contrepassee', 'l\'originale n\'a pas été contre-passée');
  assert.deepStrictEqual(orig.lignes.map(l => l.compte), ['411', '706', '4367'], 'l\'originale a été MODIFIÉE au lieu d\'être contre-passée');
  const miroir = L2.ecritures.find(e => e.contrepasseDe === orig.id);
  assert.ok(miroir && miroir.statut === 'validee' && miroir.date === '2026-09-26', 'le miroir n\'est pas posé au jour du geste');
  const neuve = L2.ecritures.find(e => e.source === 'import');
  assert.ok(neuve && neuve.statut === 'brouillard' && neuve.lignes.some(l => l.compte === '7061'), 'la version corrigée n\'est pas en brouillard');
});

t('tableur : chaque ligne écartée est NOMMÉE par son numéro de ligne, et un montant négatif change de colonne', () => {
  const L = livreDeDepart();
  const csv = [ENTETE,
    ';06/03/2026;AC;X9;607;;Achat;-50;;',          // ligne 2 : négatif au débit → 50 au crédit
    ';06/03/2026;AC;X9;401;;Achat;;;',              // ligne 3 : aucun montant
    ';;;;;;;;;',                                    // ligne 4 : vide, ne se nomme pas
    ';07/03/2026;OD;Y;abc;;?;1;;',                  // ligne 5 : compte qui n'est pas un numéro
    ';;;;;;Total;1000;1000;'                        // ligne 6 : sans compte
  ].join('\r\n');
  const a = K.analyserImportEcritures(L, csv);
  assert.deepStrictEqual(a.ignorees.map(i => i.ligne), [3, 5, 6], 'les lignes nommées ne sont pas celles du tableur');
  assert.ok(/aucun montant/.test(a.ignorees[0].motif));
  assert.ok(/abc/.test(a.ignorees[1].motif));
  const x9 = a.pieces.find(p => p.piece === 'X9');
  assert.deepStrictEqual([x9.lignes[0].debit, x9.lignes[0].credit], [0, 50], 'un montant négatif garde son signe au lieu de changer de colonne');
  assert.strictEqual(x9.action, 'nouvelle', 'une pièce déséquilibrée doit entrer en brouillard pour être corrigée, pas être refusée');
  assert.strictEqual(K.round3(x9.ecart), -50);
  const r = K.appliquerImportEcritures(L, a, { qui: 'moi', quand: 9, jour: '2026-09-26' });
  assert.strictEqual(r.desequilibrees.length, 1, 'la pièce déséquilibrée n\'est pas nommée');
});

t('tableur : un numéro de ligne tient compte des champs sur plusieurs lignes', () => {
  const L = livreDeDepart();
  const csv = [ENTETE, ';06/03/2026;OD;M;606;;"Libellé sur', 'deux lignes";10;;', ';06/03/2026;OD;M;abc;;x;;10;'].join('\n');
  const a = K.analyserImportEcritures(L, csv);
  assert.deepStrictEqual(a.ignorees.map(i => i.ligne), [4], 'un libellé sur deux lignes décale le numéro nommé');
});

t('tableur : une pièce hors de l\'exercice ou à la date illisible est refusée avec sa raison', () => {
  const L = livreDeDepart();
  const csv = [ENTETE, ';31/12/2025;OD;Z;606;;old;1;;', ';31/12/2025;OD;Z;401;;old;;1;', ';32/13/2026;OD;W;606;;?;1;;', ';32/13/2026;OD;W;401;;?;;1;'].join('\n');
  const a = K.analyserImportEcritures(L, csv);
  const z = a.pieces.find(p => p.piece === 'Z'), w = a.pieces.find(p => p.piece === 'W');
  assert.strictEqual(z.action, 'refusee'); assert.ok(/hors de l'exercice 2026/.test(z.motif), z.motif);
  assert.strictEqual(w.action, 'refusee'); assert.ok(/ne se lit pas comme un jour/.test(w.motif), w.motif);
  assert.deepStrictEqual(a.comptesNouveaux, [], 'une pièce refusée annonce des comptes qui n\'entreront pas');
});

t('tableur : un exercice CLÔTURÉ ne se modifie pas par un tableur', () => {
  const L = livreDeDepart();
  L.exercice.clos = true;
  const a = K.analyserImportEcritures(L, [ENTETE, ';10/03/2026;OD;X;606;;Frais;10;;', ';10/03/2026;OD;X;401;;Frais;;10;'].join('\n'));
  assert.strictEqual(a.pieces[0].action, 'refusee');
  assert.ok(/clôturé/.test(a.pieces[0].motif));
});

t('tableur : un fichier sans colonne Compte, Date ou montant se refuse en disant laquelle', () => {
  const L = livreDeDepart();
  assert.ok(/colonne « Compte »/.test(K.analyserImportEcritures(L, 'Nom;Prix\nA;1').motif));
  assert.ok(/colonne « Date »/.test(K.analyserImportEcritures(L, 'Compte;Débit\n606;1').motif));
  assert.ok(/ni colonne « Débit » ni colonne « Crédit »/.test(K.analyserImportEcritures(L, 'Compte;Date\n606;01/03/2026').motif));
});

t('tableur : un CSV Windows-1252 (Excel) se lit, entête « Libellé » compris', () => {
  const L = livreDeDepart();
  const texte = [ENTETE, ';10/03/2026;OD;X;606;;Frais généraux;10;;', ';10/03/2026;OD;X;401;;Frais généraux;;10;'].join('\r\n');
  // Encodé comme Excel l'enregistre sous Windows : « é » sur UN octet (0xE9).
  const octets = Buffer.from(texte, 'latin1');
  const lu = K.lireFichierTexte(octets, 'livre.csv');
  assert.ok(lu.ok);
  const a = K.analyserImportEcritures(L, lu.texte);
  assert.ok(a.colonnes.label != null, 'la colonne « Libellé » ne s\'associe pas : le fichier a été lu en UTF-8');
  assert.strictEqual(a.pieces[0].libelle, 'Frais généraux');
  // Le décodeur est UN : l'app entreprise le réexporte à l'identité.
  assert.strictEqual(require('../../src/renderer/core.js').lireFichierTexte, K.lireFichierTexte);
});

t('modifier un brouillard garde le tiers de chaque ligne, et une pièce du client reste une pièce du client', () => {
  const L = livreDeDepart();
  const r1 = L.ecritures.find(e => e.piece === 'R1');
  // Ce que la grille envoie : des lignes sans tiers, et `source: 'saisie'`.
  const r = K.modifierEcriture(L, r1.id, { source: 'saisie', libelle: 'Règlement corrigé',
    lignes: [{ compte: '532', libelle: 'x', debit: 119 }, { compte: '411', libelle: 'x', credit: 119 }] }, 42);
  assert.ok(r.ok);
  const l411 = r.ecriture.lignes.find(l => l.compte === '411');
  assert.strictEqual(l411.tiers, 'Clinique', 'modifier un brouillard a effacé le nom du tiers');
  assert.strictEqual(l411.tiersId, 'c1', 'modifier un brouillard a effacé l\'identifiant du tiers');
  assert.strictEqual(r.ecriture.source, 'skanfact', 'une pièce du client devenue « saisie » : le paquet relu la reposera à côté');
  assert.strictEqual(r.ecriture.corrigeeLe, 42, 'la correction du cabinet n\'est pas retenue');
});

t('le paquet relu n\'écrase plus une pièce que le cabinet a CORRIGÉE — et ne la double pas', () => {
  const L = livreDeDepart();
  const r1 = L.ecritures.find(e => e.piece === 'R1');
  K.modifierEcriture(L, r1.id, { date: '2026-04-02', lignes: [{ compte: '512', debit: 119 }, { compte: '411', credit: 119 }] }, 42);
  // Le client renvoie mars, avec SA version du règlement (au 532).
  const res = K.importerPaquet(L, '2026-03', [{ date: '2026-03-05', journal: 'BQ', piece: 'R1', libelle: 'Règlement',
    lignes: [{ compte: '532', debit: 119 }, { compte: '411', tiers: 'Clinique', credit: 119 }] }], false, 'import', 50);
  const tous = L.ecritures.filter(e => e.piece === 'R1');
  assert.strictEqual(tous.length, 1, 'le paquet relu a reposé sa version À CÔTÉ de la pièce corrigée : le règlement compte deux fois');
  assert.ok(tous[0].lignes.some(l => l.compte === '512'), 'le paquet relu a écrasé la correction du cabinet');
  assert.strictEqual(res.corrigeesGardees, 1);
  // Et un brouillard que le cabinet n'a PAS touché se remplace toujours (le client a rouvert son mois).
  const L2 = livreDeDepart();
  K.importerPaquet(L2, '2026-03', [{ date: '2026-03-05', journal: 'BQ', piece: 'R1', libelle: 'Règlement',
    lignes: [{ compte: '532', debit: 120 }, { compte: '411', credit: 120 }] }], false, 'import', 50);
  assert.strictEqual(K.round3(L2.ecritures.find(e => e.piece === 'R1').lignes[0].debit), 120, 'un brouillard non corrigé ne suit plus le paquet');
});

t('l\'écran : le réimport est à côté de l\'export, la grille garde le tiers, les deux handlers passent par la porte unique', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/id="lv-reimport"/.test(app) && /\$\('#lv-reimport', el\)[\s\S]{0,80}importerTableur\(root, dossier\)/.test(app), 'le bouton de réimport n\'est pas branché');
  const pd = app.slice(app.indexOf('const pieceDepuis = e =>'), app.indexOf('async function supprimerBrouillard'));
  assert.ok(pd.length > 100 && pd.length < 1500, 'tranche pieceDepuis : ' + pd.length);
  assert.ok(/tiers: l\.tiers/.test(pd) && /tiersId: l\.tiersId/.test(pd), 'la grille reprend un brouillard sans son tiers');
  const main = lireSource('src', 'cabinet', 'main.js');
  const i = main.indexOf("ipcMain.handle('cab:importerEcrituresTableur'");
  const bloc = main.slice(i, main.indexOf('ipcMain.handle(', i + 10));
  assert.ok(i > 0 && /ecrireLeLivre\(/.test(bloc), 'l\'import écrit le livre sans la porte unique');
  assert.ok(/droitBlock\(dossierId, 'saisie'\)/.test(bloc), 'l\'import n\'exige pas le droit de saisie');
  assert.ok(/corrigerValidees && [\s\S]{0,80}droitBlock\(dossierId, 'validation'\)[\s\S]{0,40}licenceBlockCab/.test(bloc), 'contre-passer par l\'import n\'exige ni le droit de validation ni la licence');
  assert.ok(/analyserImportEcritures\(o\.livre, lireTexteFichier\(chemin/.test(bloc), 'l\'import applique une analyse venue de l\'écran au lieu de relire le fichier');
  assert.ok(/KC\.lireFichierTexte\(fs\.readFileSync/.test(main), 'les imports du Cabinet lisent encore le fichier en UTF-8 seulement');
});
};
