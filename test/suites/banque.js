'use strict';
// ============================================================================================
// La banque (9.5.0) — le relevé importé, le rapprochement, le lettrage, la balance âgée
//
// Le moteur est PUR : il tient dans `compta.js`, sans une dépendance, et se teste sans ouvrir
// Electron. C'est ce qui permet de le faire tourner à chaque poussée alors que les parcours,
// eux, ne tournent qu'avant publication.
//
// Deux choses qu'on confond tout le temps et qui ont ici deux modèles et deux tests : le
// RAPPROCHEMENT (le relevé contre le 532) et le LETTRAGE (une facture contre son règlement).
module.exports = ({ t, assert }) => {
const K = require('../../src/renderer/compta.js');

// Un livre minimal, avec ses écritures de banque. `statut: 'validee'` partout : un brouillard
// n'est pas encore un fait, et le rapprochement ne doit jamais s'appuyer dessus.
function livreDeTest(ecritures) {
  const l = K.livreVide('D1', 2026, { plan: [{ compte: '532', libelle: 'Banque' }, { compte: '606', libelle: 'Achats non stockés' }, { compte: '411', libelle: 'Clients' }] });
  (ecritures || []).forEach((e, i) => {
    l.ecritures.push({
      id: e.id || 'E' + (i + 1), numero: i + 1, statut: e.statut || 'validee',
      journal: e.journal || 'BQ', piece: e.piece || '', date: e.date, libelle: e.libelle || '',
      lignes: e.lignes, source: 'saisie'
    });
  });
  return l;
}
const bq = (date, montant, libelle, opts) => ({
  date, libelle, piece: (opts || {}).piece || '',
  lignes: [
    { compte: '532', libelle, debit: montant > 0 ? montant : 0, credit: montant < 0 ? -montant : 0 },
    { compte: '606', libelle, debit: montant < 0 ? -montant : 0, credit: montant > 0 ? montant : 0 }
  ]
});

t('9.5.0 : un relevé s\'associe par NOM de colonne, jamais par position', () => {
  // Colonnes dans le désordre, en-têtes accentués, date française, espace des milliers, et une
  // banque qui écrit deux colonnes Débit/Crédit plutôt qu'un montant signé.
  const r = K.releveDepuisCsv([
    ['Libellé opération', 'Référence', 'Date valeur', 'Crédit', 'Débit'],
    ['VIREMENT CLIENT SARL', 'VIR-77', '04/03/2026', '1 234,567', ''],
    ['PRELEVEMENT STEG', '', '06/03/2026', '', '89,300']
  ]);
  assert.strictEqual(r.motif, '');
  assert.strictEqual(r.lignes.length, 2);
  assert.deepStrictEqual(r.lignes.map(l => l.date), ['2026-03-04', '2026-03-06']);
  // Le signe est celui de la BANQUE : ce qui entre est positif, ce qui sort est négatif.
  assert.strictEqual(r.lignes[0].montant, 1234.567);
  assert.strictEqual(r.lignes[1].montant, -89.3);
  assert.strictEqual(r.lignes[0].reference, 'VIR-77');
  // Et un fichier dont on ne reconnaît pas les colonnes le DIT, en nommant ce qui manque, au lieu
  // d'aligner à l'aveugle — c'est la règle de la 6.8.0, qui mettait des montants dans « Tiers ».
  const inconnu = K.releveDepuisCsv([['Colonne A', 'Colonne B'], ['x', 'y']]);
  assert.ok(inconnu.motif.includes('colonnes attendues'), 'un CSV inconnu doit le dire');
  assert.ok(inconnu.manque.includes('date') && inconnu.manque.includes('montant'), 'ce qui manque est nommé');
  // Associé à la main, le MÊME fichier passe : c'est l'assistant « CSV inconnu », et c'est ce qui
  // évite qu'une nouvelle banque soit une nouvelle version du logiciel.
  const force = K.releveDepuisCsv([['Quand', 'Quoi', 'Combien'], ['04/03/2026', 'VIR', '-50,000']], { date: 0, libelle: 1, montant: 2 });
  assert.strictEqual(force.lignes.length, 1);
  assert.strictEqual(force.lignes[0].montant, -50);
});

t('9.5.0 : une ligne illisible est nommée, jamais devinée', () => {
  const r = K.releveDepuisCsv([
    ['Date', 'Libellé', 'Montant'],
    ['04/03/2026', 'OK', '100,000'],
    ['le 5 mars', 'date illisible', '20,000'],
    ['06/03/2026', 'montant vide', '']
  ]);
  assert.strictEqual(r.lignes.length, 1);
  assert.strictEqual(r.ignorees.length, 2);
  assert.ok(r.ignorees[0].motif.includes('date'), 'la raison est nommée');
  assert.strictEqual(r.ignorees[0].ligne, 3, 'et le numéro de ligne du fichier avec');
});

t('9.5.0 : un relevé qui ne se boucle pas est refusé, avec l\'écart', () => {
  const lignes = [{ date: '2026-03-04', libelle: 'a', montant: 100 }, { date: '2026-03-05', libelle: 'b', montant: -30 }];
  const juste = K.releveValide({ compte: '532', soldeDebut: 1000, soldeFin: 1070, lignes });
  assert.strictEqual(juste.ok, true);
  const faux = K.releveValide({ compte: '532', soldeDebut: 1000, soldeFin: 1100, lignes });
  assert.strictEqual(faux.ok, false);
  assert.strictEqual(faux.ecart, -30);
  assert.ok(faux.motif.includes('30'), 'l\'écart est dans la phrase, pas seulement dans un champ');
  // Le compte bancaire se CHOISIT avant l'import : le deviner d'après le fichier, c'est ranger les
  // mouvements d'un compte sur un autre sans que rien ne plante.
  assert.strictEqual(K.releveValide({ soldeDebut: 0, soldeFin: 70, lignes }).ok, false);
});

t('9.5.0 : le même fichier ne s\'importe jamais deux fois', () => {
  const livre = livreDeTest([]);
  const releve = { compte: '532', soldeDebut: 0, soldeFin: 100, empreinte: 'abc', fichier: 'mars.csv', lignes: [{ date: '2026-03-04', libelle: 'a', montant: 100 }] };
  const a = K.ajouterReleve(livre, releve, 'moi', Date.parse('2026-03-10T09:00:00Z'));
  assert.strictEqual(a.ok, true);
  assert.strictEqual(livre.releves.length, 1);
  assert.ok(a.releve.lignes[0].id, 'chaque ligne reçoit son identifiant');
  const b = K.ajouterReleve(livre, releve, 'moi', Date.parse('2026-03-11T09:00:00Z'));
  assert.strictEqual(b.ok, false);
  assert.ok(b.motif.includes('déjà été importé'), 'et on dit quand');
  assert.strictEqual(livre.releves.length, 1);
  // Un import laisse une trace : c'est un livre comptable, pas un tableur.
  assert.ok(livre.audit.some(a2 => a2.quoi === 'relevé importé'), 'l\'import entre dans la piste d\'audit');
});

t('9.5.0 : seul un candidat UNIQUE se rapproche d\'office', () => {
  const livre = livreDeTest([
    { id: 'E1', date: '2026-03-04', ...bq('2026-03-04', 100, 'VIREMENT SARL DUPONT') },
    { id: 'E2', date: '2026-03-05', ...bq('2026-03-05', 250, 'CHEQUE 4412') },
    { id: 'E3', date: '2026-03-06', ...bq('2026-03-06', 250, 'CHEQUE 4413') }
  ]);
  K.ajouterReleve(livre, {
    compte: '532', soldeDebut: 0, soldeFin: 1349, empreinte: 'x',
    lignes: [
      { date: '2026-03-04', libelle: 'VIR SARL DUPONT', montant: 100 },
      { date: '2026-03-05', libelle: 'REMISE CHEQUE', montant: 250 },
      { date: '2026-03-07', libelle: 'INCONNU', montant: 999 }
    ]
  }, 'moi', 1);
  const r = K.rapprocherAuto(livre, livre.releves[0].id, { jours: 3 });
  assert.strictEqual(r.ok, true);
  const L = livre.releves[0].lignes;
  // Un seul candidat au bon montant : certain, et posé.
  assert.strictEqual(L[0].rapprochement.niveau, 'certain');
  assert.strictEqual(L[0].rapprochement.ecritureId, 'E1');
  assert.strictEqual(L[0].rapprochement.par, 'auto');
  // DEUX candidats à 250 : jamais certain, jamais posé — c'est LA règle de cette version. Un
  // rapprochement faux est pire qu'un rapprochement absent, parce qu'il ferme la question.
  // (10.12.0) Le niveau se GARDE pour que l'écran dise « à trancher » ; l'écriture, jamais.
  assert.strictEqual(L[1].rapprochement.niveau, 'a-confirmer');
  assert.strictEqual(L[1].rapprochement.ecritureId, '', 'une ambiguïté n\'est jamais posée');
  const d = r.detail.find(x => x.ligneId === L[1].id);
  assert.strictEqual(d.niveau, 'a-confirmer');
  assert.strictEqual(d.candidats.length, 2, 'et l\'écran reçoit TOUS les candidats');
  // Rien au bon montant : aucun.
  assert.strictEqual(L[2].rapprochement.niveau, 'aucun');
  assert.strictEqual(r.compte.certain, 1);
});

t('9.5.0 : le libellé départage deux candidats — en « probable », jamais en « certain »', () => {
  const livre = livreDeTest([
    { id: 'E1', date: '2026-03-05', ...bq('2026-03-05', 250, 'CHEQUE DUPONT') },
    { id: 'E2', date: '2026-03-05', ...bq('2026-03-05', 250, 'CHEQUE MARTIN') }
  ]);
  K.ajouterReleve(livre, {
    compte: '532', soldeDebut: 0, soldeFin: 250, empreinte: 'y',
    lignes: [{ date: '2026-03-05', libelle: 'REMISE CHEQUE DUPONT', montant: 250 }]
  }, 'moi', 1);
  const r = K.rapprocherAuto(livre, livre.releves[0].id, {});
  assert.strictEqual(r.detail[0].niveau, 'probable');
  // (10.12.0) La règle est qu'il ne se POSE pas — rien en face —, pas qu'il se taise : la ligne dit
  // « probable », l'écriture reste à choisir.
  assert.strictEqual(livre.releves[0].lignes[0].rapprochement.niveau, 'probable');
  assert.strictEqual(livre.releves[0].lignes[0].rapprochement.ecritureId, '',
    'un « probable » ne se pose pas tout seul : il se propose');
});

t('9.5.0 : une écriture déjà rapprochée ne répond pas d\'une seconde ligne', () => {
  const livre = livreDeTest([{ id: 'E1', date: '2026-03-04', ...bq('2026-03-04', 100, 'VIR') }]);
  K.ajouterReleve(livre, {
    compte: '532', soldeDebut: 0, soldeFin: 200, empreinte: 'z',
    lignes: [{ date: '2026-03-04', libelle: 'VIR A', montant: 100 }, { date: '2026-03-04', libelle: 'VIR B', montant: 100 }]
  }, 'moi', 1);
  K.rapprocherAuto(livre, livre.releves[0].id, {});
  const L = livre.releves[0].lignes;
  assert.strictEqual(L[0].rapprochement.niveau, 'certain');
  assert.strictEqual(L[1].rapprochement.niveau, 'aucun',
    'sinon le même mouvement tomberait juste deux fois');
});

t('9.5.0 : un rapprochement se pose et se défait à la main, même « certain »', () => {
  const livre = livreDeTest([{ id: 'E1', date: '2026-03-04', ...bq('2026-03-04', 100, 'VIR') }]);
  K.ajouterReleve(livre, { compte: '532', soldeDebut: 0, soldeFin: 100, empreinte: 'w', lignes: [{ date: '2026-03-04', libelle: 'VIR', montant: 100 }] }, 'moi', 1);
  const rid = livre.releves[0].id, lid = livre.releves[0].lignes[0].id;
  // La ligne d'écriture visée doit toucher le compte du relevé : viser la contrepartie serait un
  // rapprochement qui a l'air juste et ne veut rien dire.
  const faux = K.rapprocherLigne(livre, rid, lid, { ecritureId: 'E1', ligne: 1 }, 'moi', 1);
  assert.strictEqual(faux.ok, false);
  assert.ok(faux.motif.includes('532'));
  assert.strictEqual(K.rapprocherLigne(livre, rid, lid, { ecritureId: 'E1', ligne: 0 }, 'moi', 1).ok, true);
  assert.strictEqual(livre.releves[0].lignes[0].rapprochement.par, 'moi');
  assert.strictEqual(K.rapprocherLigne(livre, rid, lid, {}, 'moi', 1).niveau, 'aucun');
  assert.strictEqual(livre.releves[0].lignes[0].rapprochement.ecritureId, '');
});

t('9.5.0 : tout se défait d\'un coup après un automatique qui s\'est trompé', () => {
  const livre = livreDeTest([
    { id: 'E1', date: '2026-03-04', ...bq('2026-03-04', 100, 'A') },
    { id: 'E2', date: '2026-03-05', ...bq('2026-03-05', 200, 'B') }
  ]);
  K.ajouterReleve(livre, {
    compte: '532', soldeDebut: 0, soldeFin: 300, empreinte: 'd',
    lignes: [{ date: '2026-03-04', libelle: 'A', montant: 100 }, { date: '2026-03-05', libelle: 'B', montant: 200 }]
  }, 'moi', 1);
  K.rapprocherAuto(livre, livre.releves[0].id, {});
  assert.strictEqual(livre.releves[0].lignes.filter(l => l.rapprochement.ecritureId).length, 2);
  const r = K.derapprocherReleve(livre, livre.releves[0].id, 'moi', 1);
  assert.strictEqual(r.defaits, 2);
  assert.strictEqual(livre.releves[0].lignes.filter(l => l.rapprochement.ecritureId).length, 0);
  // Et la trace le dit : trente lignes défaites sans un mot dans la piste d'audit, c'est un livre
  // comptable qui a changé d'avis sans qu'on puisse dire quand.
  assert.ok(livre.audit.some(a => a.quoi === 'rapprochements défaits'));
  assert.strictEqual(K.derapprocherReleve(livre, 'REL-inconnu', 'moi', 1).ok, false);
});

t('9.5.0 : les suspens se comptent DANS LES DEUX SENS', () => {
  const livre = livreDeTest([
    { id: 'E1', date: '2026-03-04', ...bq('2026-03-04', 100, 'VIR') },
    { id: 'E2', date: '2026-03-08', ...bq('2026-03-08', -40, 'CHEQUE EMIS') }   // émis, jamais encaissé
  ]);
  K.ajouterReleve(livre, {
    compte: '532', soldeDebut: 0, soldeFin: 180, empreinte: 's', au: '2026-03-31',
    lignes: [{ date: '2026-03-04', libelle: 'VIR', montant: 100 }, { date: '2026-03-09', libelle: 'FRAIS', montant: 80 }]
  }, 'moi', 1);
  K.rapprocherAuto(livre, livre.releves[0].id, {});
  const s = K.suspens(livre, livre.releves[0].id);
  assert.strictEqual(s.banque.length, 1, 'la banque porte des frais que le livre n\'a pas');
  assert.strictEqual(s.livre.length, 1, 'le livre porte un chèque que la banque n\'a pas encore');
  assert.strictEqual(s.ecart, 120, '80 d\'un côté, −40 de l\'autre');
});

t('9.5.0 : l\'écriture proposée laisse le compte VIDE quand aucune règle ne le dit', () => {
  const ligne = { date: '2026-03-06', libelle: 'PRELEVEMENT STEG MARS', montant: -89.3, reference: 'P-12' };
  const sansTable = K.ecritureProposee(ligne, [], { compte: '532' });
  assert.strictEqual(sansTable.aChoisir, true);
  assert.strictEqual(sansTable.lignes[1].compte, '', 'on ne verse pas d\'office au 471 : le doute se pose, il ne se range pas');
  // Et elle ne s'enregistrerait pas telle quelle — c'est ce qui force la décision.
  assert.strictEqual(K.ecritureValide(sansTable, ['532']).ok, false);
  // L'argent SORT : la banque est créditée, la charge débitée.
  assert.strictEqual(sansTable.lignes[0].credit, 89.3);
  assert.strictEqual(sansTable.lignes[1].debit, 89.3);
  // Avec une règle, le compte arrive — et le motif le plus LONG gagne, sinon le résultat dépendrait
  // de l'ordre du tableau (même règle que la correspondance de comptes, 9.3.0).
  const avec = K.ecritureProposee(ligne, [{ motif: 'STEG', compte: '606' }, { motif: 'PRELEVEMENT STEG', compte: '6061', libelle: 'Électricité' }], { compte: '532' });
  assert.strictEqual(avec.lignes[1].compte, '6061');
  assert.strictEqual(avec.aChoisir, false);
  assert.strictEqual(K.ecritureValide(avec, ['532', '6061']).ok, true);
  // L'argent ENTRE : l'inverse.
  const entree = K.ecritureProposee({ date: '2026-03-04', libelle: 'VIR', montant: 100 }, [], { compte: '532' });
  assert.strictEqual(entree.lignes[0].debit, 100);
});

t('9.5.0 : le lettrage automatique ne relie que ce qui SOLDE, et jamais une ambiguïté', () => {
  const livre = livreDeTest([
    { id: 'F1', journal: 'VT', date: '2026-01-10', piece: 'FAC-2026-001', lignes: [{ compte: '411', libelle: 'Client A', debit: 500, credit: 0, tiersId: 'A' }, { compte: '706', libelle: 'v', debit: 0, credit: 500 }] },
    { id: 'R1', journal: 'BQ', date: '2026-02-10', piece: 'FAC-2026-001', lignes: [{ compte: '411', libelle: 'Client A', debit: 0, credit: 500, tiersId: 'A' }, { compte: '532', libelle: 'r', debit: 500, credit: 0 }] },
    { id: 'F2', journal: 'VT', date: '2026-01-11', piece: 'FAC-2026-002', lignes: [{ compte: '411', libelle: 'Client B', debit: 300, credit: 0, tiersId: 'B' }, { compte: '706', libelle: 'v', debit: 0, credit: 300 }] },
    { id: 'R2', journal: 'BQ', date: '2026-02-11', lignes: [{ compte: '411', libelle: 'Client B', debit: 0, credit: 120, tiersId: 'B' }, { compte: '532', libelle: 'r', debit: 120, credit: 0 }] },
    // Client D : UNE facture et DEUX règlements du même montant, sans référence commune. C'est le
    // cas qui prouve la règle : un lettrage généreux en choisirait un au hasard et affirmerait que
    // la facture est payée — par celui-là. On ne lettre pas ce qu'on ne sait pas.
    { id: 'F3', journal: 'VT', date: '2026-01-12', lignes: [{ compte: '411', libelle: 'Client D', debit: 400, credit: 0, tiersId: 'D' }, { compte: '706', libelle: 'v', debit: 0, credit: 400 }] },
    { id: 'R3', journal: 'BQ', date: '2026-02-12', lignes: [{ compte: '411', libelle: 'Client D', debit: 0, credit: 400, tiersId: 'D' }, { compte: '532', libelle: 'r', debit: 400, credit: 0 }] },
    { id: 'R4', journal: 'BQ', date: '2026-02-13', lignes: [{ compte: '411', libelle: 'Client D', debit: 0, credit: 400, tiersId: 'D' }, { compte: '532', libelle: 'r', debit: 400, credit: 0 }] }
  ]);
  const r = K.lettrageAuto(livre, '411', { date: '2026-03-01' });
  assert.strictEqual(r.poses.length, 1, 'un seul couple se solde exactement');
  assert.strictEqual(r.poses[0].montant, 500);
  const lettres = livre.ecritures.flatMap(e => e.lignes.filter(l => l.compte === '411').map(l => l.lettre || ''));
  assert.strictEqual(lettres.filter(Boolean).length, 2, 'la facture ET son règlement portent la lettre');
  // Le règlement partiel reste OUVERT : c'est très exactement ce que « ce client me doit-il encore
  // quelque chose ? » veut savoir. Une lettre posée dessus affirmerait que la facture est payée.
  const f2 = livre.ecritures.find(e => e.id === 'F2');
  assert.strictEqual(f2.lignes[0].lettre || '', '');
  // Et jamais entre deux tiers différents : le montant seul ne fait pas une correspondance.
  assert.ok(!r.poses.some(p => p.ecritures.includes('F2')));
});

t('9.5.0 : la balance âgée et l\'échéancier lisent les lignes non lettrées, pas une liste à part', () => {
  const lignes = [
    { date: '2025-10-01', echeance: '2025-10-31', account: '411', tiers: 'Client A', tiersId: 'A', debit: 1000, credit: 0, piece: 'FAC-1', lettre: '' },
    { date: '2026-02-20', echeance: '2026-03-22', account: '411', tiers: 'Client B', tiersId: 'B', debit: 400, credit: 0, piece: 'FAC-2', lettre: '' },
    { date: '2026-01-05', echeance: '2026-01-05', account: '411', tiers: 'Client C', tiersId: 'C', debit: 200, credit: 0, piece: 'FAC-3', lettre: 'A' },
    { date: '2026-01-06', echeance: '2026-01-06', account: '411', tiers: 'Client C', tiersId: 'C', debit: 0, credit: 200, piece: 'REG-3', lettre: 'A' }
  ];
  const e = K.echeancierDepuisLignes(lignes, '411', '2026-03-17');
  assert.strictEqual(e.lignes.length, 2, 'la pièce lettrée est soldée : elle n\'attend plus rien');
  assert.strictEqual(e.total, 1400);
  assert.ok(e.lignes[0].retard > 100, 'une échéance d\'octobre est en retard de plus de cent jours');
  assert.strictEqual(e.lignes[1].retard, 0, 'une échéance future n\'est pas un retard');
  const b = K.balanceAgeeDepuisLignes(lignes, '411', '2026-03-17');
  assert.strictEqual(b.total, 1400);
  assert.strictEqual(b.tranches.length, 5);
  assert.strictEqual(b.tranches[0].montant, 400, 'pas encore échu');
  assert.strictEqual(b.tranches[4].montant, 1000, 'plus de 90 jours');
  assert.strictEqual(b.tiers.length, 2);
  assert.strictEqual(b.tiers[0].total, 1000, 'le plus gros dû en premier');
});

t('9.5.0 : les tranches d\'âge n\'existent qu\'à UN endroit', () => {
  const C = require('../../src/renderer/core.js');
  assert.strictEqual(C.AGING_BUCKETS, K.AGING_BUCKETS,
    'core.js doit réexporter les tranches de compta.js, pas en garder une copie');
});

t('9.5.0 : un relevé retiré ne touche pas au journal', () => {
  const livre = livreDeTest([{ id: 'E1', date: '2026-03-04', ...bq('2026-03-04', 100, 'VIR') }]);
  K.ajouterReleve(livre, { compte: '532', soldeDebut: 0, soldeFin: 100, empreinte: 'q', lignes: [{ date: '2026-03-04', libelle: 'VIR', montant: 100 }] }, 'moi', 1);
  K.rapprocherAuto(livre, livre.releves[0].id, {});
  const avant = livre.ecritures.length;
  const r = K.supprimerReleve(livre, livre.releves[0].id);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(livre.releves.length, 0);
  assert.strictEqual(livre.ecritures.length, avant, 'le lien va de la ligne vers l\'écriture, jamais l\'inverse');
});

// Le brouillard COMPTE dans le rapprochement, et c'est un choix. Ma première version l'excluait
// — « un brouillard n'est pas encore un fait » — et le parcours réel a montré ce que ça donne :
// on écrit l'écriture manquante depuis une ligne de relevé, elle arrive en brouillard, et
// l'automatique ne la retrouve plus. Le rapprochement devenait inutile très exactement pendant la
// demi-journée où le comptable saisit depuis son relevé. Ce qu'il faut en contrepartie, c'est
// qu'une écriture rapprochée ne puisse plus bouger en douce — même règle que le lettrage.
t('9.5.0 : un brouillard se rapproche, et une écriture rapprochée ne bouge plus', () => {
  const livre = livreDeTest([{ id: 'E1', statut: 'brouillard', date: '2026-03-04', ...bq('2026-03-04', 100, 'VIR') }]);
  K.ajouterReleve(livre, { compte: '532', soldeDebut: 0, soldeFin: 100, empreinte: 'br', lignes: [{ date: '2026-03-04', libelle: 'VIR', montant: 100 }] }, 'moi', 1);
  K.rapprocherAuto(livre, livre.releves[0].id, {});
  assert.strictEqual(livre.releves[0].lignes[0].rapprochement.niveau, 'certain',
    'le comptable saisit depuis son relevé : exclure le brouillard rendrait le rapprochement inutile');
  // Et maintenant elle est tenue : changer la ligne de banque ou la date ferait pointer le
  // rapprochement sur un montant qui a changé, la supprimer sur une écriture disparue. Les deux
  // refusent, et disent le geste.
  const e1 = livre.ecritures.find(x => x.id === 'E1');
  const m = K.modifierEcriture(livre, 'E1', { lignes: [{ compte: '532', debit: 90 }, { compte: '606', credit: 90 }] });
  assert.strictEqual(m.ok, false);
  assert.ok(/rapprochée/.test(m.motif) && /défais/i.test(m.motif), 'le refus doit nommer le geste qui débloque');
  assert.ok(/532/.test(m.motif), 'le refus nomme la ligne que le relevé tient');
  assert.strictEqual(K.modifierEcriture(livre, 'E1', { date: '2026-03-09' }).ok, false, 'la date est tenue aussi');
  assert.strictEqual(e1.date, '2026-03-04');
  const s = K.supprimerEcriture(livre, 'E1');
  assert.strictEqual(s.ok, false);
  assert.ok(/rapprochée/.test(s.motif));
  // Défait, tout redevient possible : un garde-fou n'est pas un piège (7.12.0).
  K.rapprocherLigne(livre, livre.releves[0].id, livre.releves[0].lignes[0].id, {}, 'moi', 1);
  assert.strictEqual(K.modifierEcriture(livre, 'E1', { date: '2026-03-09' }).ok, true);
});

// 10.14.1 (test humain du 26/09) : « PRLV STEG FACTURE 0926 » retenait FACTURE → 606 — le mot le
// plus long —, et le virement d'un CLIENT « VIR RECU FACTURE 012 » était ensuite proposé en charge.
// Un mot bancaire ne se retient pas, et une règle ancienne qui n'en porte qu'un ne décide plus rien.
t('10.14.1 : le mot retenu d\'un libellé de relevé n\'est jamais un mot bancaire', () => {
  assert.strictEqual(K.motifDeLibelle('PRLV STEG FACTURE 0926'), 'STEG');
  assert.strictEqual(K.motifDeLibelle('FRAIS TENUE DE COMPTE'), 'FRAIS');
  assert.strictEqual(K.motifDeLibelle('Prélèvement Sonède facture 1026'), 'SONÈDE');
  assert.strictEqual(K.motifDeLibelle('VIR RECU FACTURE 012'), '', 'rien de propre au tiers : on ne retient rien');
  const table = [{ motif: 'FACTURE', compte: '606' }, { motif: 'STEG', compte: '6061' }];
  assert.strictEqual(K.compteDuLibelle(table, 'VIR RECU FACTURE 012 CLIENT'), null, 'une règle ancienne sur un mot bancaire ne décide plus rien');
  assert.strictEqual(K.compteDuLibelle(table, 'PRLV STEG FACTURE 1126').compte, '6061');
});

// 10.14.1 (test humain du 26/09) : écrire depuis le relevé « PRLV STEG 214,500 », puis ventiler
// la TVA — le geste qu'un comptable fait juste après — était refusé en bloc, alors que la ligne 532
// que le relevé désigne n'avait pas bougé. Ce que le rapprochement TIENT, c'est cette ligne (compte,
// montant) et la date ; le libellé et la contrepartie se corrigent, et le lien suit sa ligne.
t('10.14.1 : une écriture rapprochée se ventile, la ligne que le relevé désigne ne bouge pas', () => {
  const livre = livreDeTest([{ id: 'E1', statut: 'brouillard', date: '2026-09-10', ...bq('2026-09-10', -214.5, 'PRLV STEG') }]);
  K.ajouterReleve(livre, { compte: '532', soldeDebut: 0, soldeFin: -214.5, empreinte: 'steg', lignes: [{ date: '2026-09-10', libelle: 'PRLV STEG', montant: -214.5 }] }, 'moi', 1);
  K.rapprocherAuto(livre, livre.releves[0].id, {});
  const lien = livre.releves[0].lignes[0].rapprochement;
  assert.strictEqual(lien.niveau, 'certain');
  assert.strictEqual(K.modifierEcriture(livre, 'E1', { libelle: 'STEG facture 0926' }).ok, true, 'un libellé ne change aucun montant');
  // La ventilation, avec une ligne insérée AU-DESSUS de la banque : le lien doit suivre la 532.
  const v = K.modifierEcriture(livre, 'E1', { lignes: [
    { compte: '606', debit: 180.252 }, { compte: '4366', debit: 34.248 }, { compte: '532', credit: 214.5 }] });
  assert.strictEqual(v.ok, true, v.motif);
  const e = livre.ecritures.find(x => x.id === 'E1');
  assert.strictEqual(e.lignes.length, 3);
  assert.strictEqual(lien.ligne, 2, 'le rapprochement suit la ligne 532 à son nouveau rang');
  assert.strictEqual(e.lignes[lien.ligne].compte, '532');
  // Et la ligne de banque elle-même reste tenue.
  const faux = K.modifierEcriture(livre, 'E1', { lignes: [
    { compte: '606', debit: 180.252 }, { compte: '4366', debit: 34.248 }, { compte: '5311', credit: 214.5 }] });
  assert.strictEqual(faux.ok, false, 'déplacer la ligne de banque vers un autre compte défait ce que le relevé désigne');
  assert.strictEqual(lien.ligne, 2, 'un refus ne touche pas au lien');
});
// 10.14.1 (test humain du 26/09) : un mot retenu par erreur (« FACTURE », le mauvais compte)
// proposait le mauvais compte pour toujours — la table n'avait aucun écran. Elle se relit sous le
// relevé où elle sert, et chaque mot se retire, avec un « Annuler » (ce qui se répare, 7.12.0).
t('10.14.1 : les mots retenus se relisent et se retirent depuis l\'onglet Banque', () => {
  const fs = require('fs');
  const sans = x => x.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const app = sans(fs.readFileSync(require.resolve('../../src/cabinet/renderer/app.js'), 'utf8'));
  const vue = app.slice(app.indexOf('function vueBanque('), app.indexOf('function motsRetenusPanel('));
  assert.ok(vue.length > 500 && /\$\{motsRetenusPanel\(\)\}/.test(vue), 'l\'onglet Banque pose le panneau des mots retenus');
  const panneau = app.slice(app.indexOf('function motsRetenusPanel('), app.indexOf('function brancherBanque('));
  assert.ok(panneau.length > 200 && panneau.length < 3000, 'tranche du panneau');
  assert.ok(/info\('bq\.mots'\)/.test(panneau), 'le titre porte sa bulle');
  assert.ok(/RowMenu\.cellule\('MOT:'/.test(panneau), 'chaque mot porte son geste');
  assert.ok(/motifDeLibelle\(x\.motif\)/.test(panneau), 'un mot trop courant le dit sur sa ligne');
  const branche = app.slice(app.indexOf("cle.startsWith('MOT:')"), app.indexOf("cle.startsWith('REL:')"));
  assert.ok(branche.length > 100 && branche.length < 1500, 'tranche du geste');
  assert.ok(/saveBanque\(\{\s*libelles:\s*avant\.filter\(x => x\.motif !== mot\)/.test(branche), 'on ne retire que CE mot');
  assert.ok(/toastUndo\([\s\S]*saveBanque\(\{\s*libelles:\s*avant\s*\}\)/.test(branche), '« Annuler » rend la table d\'avant');
  const guide = fs.readFileSync(require.resolve('../../src/cabinet/renderer/cabguide.js'), 'utf8');
  assert.ok(/'bq\.mots':\s*\{\s*a:\s*'banque'/.test(guide), 'la bulle existe et mène à l\'article de la banque');
});
};
