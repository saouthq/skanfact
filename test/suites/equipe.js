'use strict';
// ============================================================================================
// Le cabinet à plusieurs (9.9.0)
//
// Ce que ces tests tiennent, et c'est UNE règle déclinée cinq fois : **le danger du partage n'est
// pas la panne, c'est le silence** (3.2.0). Une écriture validée ne se fusionne jamais et n'est
// jamais perdue ; un numéro déjà pris est signalé, jamais réattribué ; un brouillard présent des
// deux côtés est gardé DEUX fois plutôt que tranché à la place de quelqu'un ; un droit refusé dit
// qui peut le faire ; et la valeur par défaut — aucun collaborateur déclaré — ne fait RIEN.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');
const C = require('../../src/cabinet/cabcore.js');

// Un livre minimal, deux comptes, de quoi écrire des pièces équilibrées.
function livre(dossier, annee) {
  return K.livreVide(dossier || 'D1', annee || 2026, {
    plan: [{ compte: '411', libelle: 'Clients', role: 'clients' },
      { compte: '706', libelle: 'Prestations', role: 'ventes' }]
  });
}
const piece = (l, o, valide, qui) => {
  const e = K.ajouterEcriture(l, {
    id: o.id, date: o.date || '2026-03-04', journal: o.journal || 'VT', piece: o.piece || 'F1',
    libelle: o.libelle || 'Facture',
    lignes: [{ compte: '411', debit: o.montant || 100 }, { compte: '706', credit: o.montant || 100 }]
  }, qui || 'poste A', 1000);
  if (valide) K.validerEcriture(l, e.id, qui || 'poste A', 2000);
  return e;
};

// ---------------------------------------------------------------- la fusion de deux postes

t('9.9.0 : une écriture validée de l\'autre poste n\'est JAMAIS perdue', () => {
  const mien = livre(); piece(mien, { id: 'a', piece: 'F1' }, true);
  const autre = livre(); piece(autre, { id: 'a', piece: 'F1' }, true);
  piece(autre, { id: 'b', piece: 'F2', montant: 250 }, true, 'poste B');

  const r = K.fusionnerLivres(mien, autre, 9000);
  assert.ok(r.ok, 'la fusion a été refusée : ' + (r.motif || ''));
  assert.ok(mien.ecritures.some(e => e.id === 'b'), 'la validée de l\'autre poste a disparu');
  assert.strictEqual(r.rapport.valideesAjoutees.length, 1, 'le rapport ne nomme pas ce qui est entré');
  // L'identique des deux côtés ne produit NI doublon NI conflit : c'est le cas le plus fréquent,
  // et le rapport doit rester lisible.
  assert.strictEqual(mien.ecritures.filter(e => e.id === 'a').length, 1, 'l\'écriture commune a été dupliquée');
  assert.strictEqual(r.rapport.valideesEnConflit.length, 0, 'deux écritures identiques ne sont pas un conflit');
});

t('9.9.0 : un numéro déjà pris est SIGNALÉ, jamais réattribué et jamais jeté', () => {
  // Les deux postes ont validé chacun de leur côté : les deux pièces portent le numéro 1. Un
  // numéro naît à la validation et ne bouge plus (9.2.0) — donc on ne renumérote pas, et on ne
  // jette pas. On le DIT, et le comptable contre-passe. C'est le seul cas insoluble du partage,
  // exactement comme deux factures émises hors ligne sous le même numéro en 3.2.0.
  const mien = livre(); piece(mien, { id: 'a', piece: 'F1' }, true);
  const autre = livre(); piece(autre, { id: 'z', piece: 'F9', montant: 999 }, true, 'poste B');
  assert.strictEqual(mien.ecritures[0].numero, 1);
  assert.strictEqual(autre.ecritures[0].numero, 1, 'le décor du test est faux : les deux numéros devaient se heurter');

  const r = K.fusionnerLivres(mien, autre, 9000);
  const venue = mien.ecritures.find(e => e.id === 'z');
  assert.ok(venue, 'une validée au numéro déjà pris a été JETÉE');
  assert.strictEqual(venue.numero, 1, 'son numéro a été réécrit : un numéro validé ne bouge jamais');
  assert.strictEqual(r.rapport.numerosEnDoublon.length, 1, 'le doublon de numéro n\'est pas signalé');
  assert.strictEqual(r.rapport.numerosEnDoublon[0].numero, 1);
  assert.ok(r.rapport.aRegarder >= 1, 'un doublon de numéro doit compter dans « à regarder »');
});

t('9.9.0 : une validée différente des deux côtés garde la NÔTRE et rapporte l\'écart', () => {
  const mien = livre(); piece(mien, { id: 'a', piece: 'F1', montant: 100 }, true);
  const autre = livre(); piece(autre, { id: 'a', piece: 'F1', montant: 4242 }, true, 'poste B');

  const r = K.fusionnerLivres(mien, autre, 9000);
  const gardee = mien.ecritures.find(e => e.id === 'a');
  assert.strictEqual(gardee.lignes[0].debit, 100, 'une écriture VALIDÉE a été réécrite par la fusion');
  assert.strictEqual(mien.ecritures.filter(e => e.id === 'a').length, 1, 'la validée de l\'autre poste a été ajoutée en double');
  assert.strictEqual(r.rapport.valideesEnConflit.length, 1, 'le conflit n\'est pas rapporté : il serait résolu en silence');
  assert.strictEqual(r.rapport.valideesEnConflit[0].garde, 'ce poste');
});

t('9.9.0 : un brouillard modifié des deux côtés est gardé DEUX fois, jamais tranché', () => {
  const mien = livre(); piece(mien, { id: 'b1', piece: 'OD1', montant: 10 });
  const autre = livre(); piece(autre, { id: 'b1', piece: 'OD1', montant: 77 }, false, 'poste B');

  const r = K.fusionnerLivres(mien, autre, 9000);
  const tous = mien.ecritures.filter(e => e.id === 'b1' || (e.venuDe && e.venuDe.id === 'b1'));
  assert.strictEqual(tous.length, 2, 'un brouillard a été perdu : c\'est une demi-journée de travail');
  const copie = tous.find(e => e.venuDe);
  assert.ok(copie, 'la copie ne dit pas d\'où elle vient');
  assert.strictEqual(copie.statut, 'brouillard', 'une copie de fusion ne doit jamais arriver validée');
  assert.strictEqual(copie.numero, null, 'une copie de fusion ne porte aucun numéro');
  assert.strictEqual(copie.lignes[0].debit, 77, 'la copie ne porte pas le travail de l\'autre poste');
  assert.strictEqual(r.rapport.brouillardsEnConflit.length, 1, 'le conflit de brouillard n\'est pas montré');
  // Et refusionner ne l'écrase pas : `+fusion` posé deux fois détruirait la copie du premier tour.
  const encore = K.fusionnerLivres(mien, autre, 9001);
  assert.ok(encore.ok);
  assert.strictEqual(mien.ecritures.filter(e => e.venuDe).length, 2, 'la seconde fusion a écrasé la copie de la première');
});

t('9.9.0 : la fusion refuse un autre dossier et un autre exercice', () => {
  assert.strictEqual(K.fusionnerLivres(livre('D1', 2026), livre('D2', 2026), 1).ok, false);
  assert.strictEqual(K.fusionnerLivres(livre('D1', 2026), livre('D1', 2025), 1).ok, false);
  assert.ok(/2025/.test(K.fusionnerLivres(livre('D1', 2026), livre('D1', 2025), 1).motif),
    'le refus doit NOMMER l\'exercice trouvé : sinon on rouvre le même fichier');
  assert.strictEqual(K.fusionnerLivres(livre(), { format: 1 }, 1).ok, false);
});

t('9.9.0 : la fusion recolle les deux pistes d\'audit, dans l\'ordre du temps', () => {
  // Amputer la moitié venue de l'autre poste reviendrait à effacer son travail — or la piste
  // d'audit est ce qu'un contrôle vient lire, et c'est le seul point de cette version.
  const mien = livre(); mien.audit.push({ quand: 300, qui: 'Amine', quoi: 'saisie', detail: '' });
  const autre = livre();
  autre.audit.push({ quand: 100, qui: 'Sonia', quoi: 'saisie', detail: '' });
  autre.audit.push({ quand: 300, qui: 'Amine', quoi: 'saisie', detail: '' });   // le même geste, vu des deux côtés
  K.fusionnerLivres(mien, autre, 9000);
  assert.deepStrictEqual(mien.audit.map(a => a.quand), [100, 300], 'la piste d\'audit est doublée ou tronquée');
  assert.strictEqual(mien.audit[0].qui, 'Sonia');
});

// ---------------------------------------------------------------- les droits

t('9.9.0 : sans collaborateur déclaré, RIEN n\'est restreint', () => {
  // La valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien (9.1.1). Tous
  // les cabinets d'aujourd'hui sont à une personne : une mise à jour ne doit enfermer personne
  // dehors, et l'écran ne doit rien montrer de neuf.
  const s = C.migrate({ dossiers: [{ id: 'D1', name: 'Client' }] });
  ['saisie', 'validation', 'supervision'].forEach(g => {
    assert.strictEqual(C.peut(s, 'D1', '', g).ok, true, `le geste « ${g} » est refusé sur un cabinet d'une personne`);
  });
  assert.strictEqual(C.roleSurDossier(s, 'D1', ''), 'libre');
});

t('9.9.0 : un saisisseur ne valide pas, et le refus NOMME qui peut', () => {
  const s = C.migrate({
    collaborateurs: [
      { id: 'c1', nom: 'Amine', role: 'saisie' },
      { id: 'c2', nom: 'Sonia', role: 'validation' }
    ],
    dossiers: [{ id: 'D1', name: 'Client' }]
  });
  assert.strictEqual(C.peut(s, 'D1', 'c1', 'saisie').ok, true, 'un saisisseur doit pouvoir saisir');
  const v = C.peut(s, 'D1', 'c1', 'validation');
  assert.strictEqual(v.ok, false, 'un saisisseur a validé une écriture');
  // Un refus dit TROIS choses : ce qui est refusé, pourquoi, et le bouton qui débloque (7.0.0).
  assert.ok(/Amine/.test(v.motif), 'le refus ne nomme pas qui est refusé');
  assert.ok(/Sonia/.test(v.geste), 'le refus ne dit pas qui peut le faire : il n\'y a alors rien à faire');
  assert.strictEqual(C.peut(s, 'D1', 'c2', 'validation').ok, true);
  assert.strictEqual(C.peut(s, 'D1', 'c2', 'supervision').ok, false, 'la validation ne doit pas ouvrir la clôture');
  // Un poste qui ne dit pas qui travaille dessus : refusé, avec le geste.
  const anonyme = C.peut(s, 'D1', '', 'saisie');
  assert.strictEqual(anonyme.ok, false);
  assert.ok(/Collaborateurs/.test(anonyme.geste), 'le poste anonyme n\'est pas emmené là où il se déclare');
});

t('9.9.0 : le droit du DOSSIER l\'emporte sur le rôle général, dans les deux sens', () => {
  const base = {
    collaborateurs: [
      { id: 'c1', nom: 'Amine', role: 'saisie' },
      { id: 'c2', nom: 'Sonia', role: 'supervision' }
    ],
    dossiers: [{ id: 'D1', name: 'Client', droits: { c1: 'validation', c2: 'saisie' } }]
  };
  const s = C.migrate(base);
  assert.strictEqual(C.peut(s, 'D1', 'c1', 'validation').ok, true,
    'un droit posé sur le dossier n\'élargit pas le rôle général');
  assert.strictEqual(C.peut(s, 'D1', 'c2', 'validation').ok, false,
    'un droit posé sur le dossier ne restreint pas le rôle général');
  // Et sur un AUTRE dossier, chacun retrouve son rôle général.
  const s2 = C.migrate({ ...base, dossiers: base.dossiers.concat([{ id: 'D2', name: 'Autre' }]) });
  assert.strictEqual(C.peut(s2, 'D2', 'c1', 'validation').ok, false);
  assert.strictEqual(C.peut(s2, 'D2', 'c2', 'validation').ok, true);
});

t('9.9.0 : seul un superviseur gère l\'équipe — sauf quand il n\'y en a aucun', () => {
  // Tant qu'aucun superviseur n'existe, la porte est ouverte : sinon le premier cabinet qui déclare
  // deux saisisseurs ne pourrait plus jamais revenir sur cet écran.
  const amorce = C.migrate({ collaborateurs: [{ id: 'c1', nom: 'Amine', role: 'saisie' }] });
  assert.strictEqual(C.peutGererCollaborateurs(amorce, 'c1').ok, true);
  assert.strictEqual(C.peutGererCollaborateurs(amorce, 'c1').amorce, true);
  const s = C.migrate({
    collaborateurs: [{ id: 'c1', nom: 'Amine', role: 'saisie' }, { id: 'c2', nom: 'Sonia', role: 'supervision' }]
  });
  assert.strictEqual(C.peutGererCollaborateurs(s, 'c1').ok, false);
  assert.ok(/Sonia/.test(C.peutGererCollaborateurs(s, 'c1').geste), 'le refus ne dit pas à qui demander');
  assert.strictEqual(C.peutGererCollaborateurs(s, 'c2').ok, true);
});

t('9.9.0 : deux collaborateurs ne peuvent pas porter le même nom', () => {
  // Une piste d'audit qui porte deux fois « Amine » ne dit plus QUI : c'est très exactement ce que
  // cette version existe pour donner.
  const s = C.migrate({ collaborateurs: [{ id: 'c1', nom: 'Amine', role: 'saisie' }] });
  assert.strictEqual(C.collaborateurValide(s, { nom: 'amine', role: 'saisie' }, '').ok, false);
  assert.strictEqual(C.collaborateurValide(s, { nom: 'Amine', role: 'saisie' }, 'c1').ok, true,
    'se renommer en soi-même doit rester possible');
  assert.strictEqual(C.collaborateurValide(s, { nom: 'A', role: 'saisie' }, '').ok, false);
  assert.strictEqual(C.collaborateurValide(s, { nom: 'Sonia', role: 'chef' }, '').ok, false, 'un rôle inventé est accepté');
});

t('9.9.0 : les collaborateurs et les droits survivent à migrate', () => {
  // Un champ absent de `migrate` est un champ jeté au prochain chargement, en silence — le défaut
  // de `matricule` (6.8.0). Ici, un droit perdu rend à quelqu'un un pouvoir qu'on lui avait retiré.
  const s = C.migrate({
    collaborateurs: [{ id: 'c1', nom: 'Amine', role: 'validation', poste: 'iMac' }],
    dossiers: [{ id: 'D1', name: 'Client', droits: { c1: 'saisie' } }]
  });
  assert.strictEqual(s.collaborateurs.length, 1);
  assert.strictEqual(s.collaborateurs[0].poste, 'iMac');
  assert.strictEqual(s.dossiers[0].droits.c1, 'saisie');
  // Et ce qui n'a pas la forme attendue ne traîne pas dans les données.
  const sale = C.migrate({ collaborateurs: [{ nom: 'Sans identifiant', role: 'saisie' }, { id: 'c9' }] });
  assert.strictEqual(sale.collaborateurs.length, 0, 'un collaborateur sans nom ou sans identifiant a été gardé');
});

t('9.9.0 : « À faire » par collaborateur restreint le PORTEFEUILLE, donc ses comptes tombent juste', () => {
  // Filtrer les lignes après coup laisserait chaque libellé annoncer le compte du cabinet entier
  // au-dessus d'une liste réduite : un compteur et la liste qu'il annonce se calculent avec la
  // même fonction (6.8.1).
  const vieux = '2026-01';
  const dossier = (id, nom) => ({ id, name: nom, matricule: id, from: vieux, packs: [] });
  const s = C.migrate({
    collaborateurs: [{ id: 'c1', nom: 'Amine', role: 'saisie' }],
    dossiers: [
      { ...dossier('D1', 'Client A'), droits: { c1: 'saisie' } },
      dossier('D2', 'Client B'), dossier('D3', 'Client C')
    ]
  });
  assert.deepStrictEqual(C.dossiersConfies(s, 'c1').map(d => d.id), ['D1']);
  const tout = C.cabinetTodo(s, '2026-09-21', {});
  const sien = C.cabinetTodo(s, '2026-09-21', { collabId: 'c1' });
  const ligne = l => (l.find(x => x.id === 'manquants') || {});
  assert.strictEqual(ligne(tout).count, 3, 'le décor du test est faux : les trois dossiers devaient être en retard');
  assert.strictEqual(ligne(sien).count, 1, 'le « À faire » personnel compte encore les dossiers des autres');
  // Le LIBELLÉ suit le compte : c'est là que la divergence se verrait.
  assert.ok(/^1 dossier n/.test(ligne(sien).label), 'le libellé annonce un autre chiffre que la liste : ' + ligne(sien).label);
});

// ---------------------------------------------------------------- la production

t('9.9.0 : la production lit l\'index, et « révisé » vaut null quand on ne SAIT pas', () => {
  const d = {
    id: 'D1', name: 'Client', matricule: 'D1', from: '2026-01',
    packs: [{ month: '2026-01', definitive: true }, { month: '2026-02', definitive: true }]
  };
  const index = { exercices: [{ annee: 2026, production: { '2026-01': { ecritures: 12, validees: 12, brouillards: 0, revise: false, declare: true, qui: 'Amine', depuis: 5 } } }] };
  const mois = C.productionDuDossier(d, index, '2026-04-10', 10);
  const m1 = mois.find(m => m.mois === '2026-01');
  const m2 = mois.find(m => m.mois === '2026-02');
  assert.strictEqual(m1.saisi, 12);
  assert.strictEqual(m1.declare, true);
  assert.strictEqual(m1.etape, 'fini', 'un mois déclaré n\'est pas au bout de la chaîne');
  assert.strictEqual(m1.qui, 'Amine', 'le tableau ne dit pas QUI a fait le dernier geste');
  // Le mois reçu mais absent de l'index : on ne sait rien de sa révision ni de sa déclaration.
  assert.strictEqual(m2.recu, true);
  assert.strictEqual(m2.saisi, 0);
  assert.strictEqual(m2.revise, null, 'sans livre, « révisé » doit rester inconnu et non « non »');
  assert.strictEqual(m2.declare, null, 'sans livre, « déclaré » doit rester inconnu et non « non »');
  assert.strictEqual(m2.etape, 'saisi', 'un mois reçu et non saisi doit être bloqué à la saisie');
});

t('9.9.0 : le tableau de production met en tête ce qui est en retard', () => {
  const dossier = (id, nom, mois) => ({
    id, name: nom, matricule: id, from: '2026-01',
    packs: mois.map(m => ({ month: m, definitive: true }))
  });
  const s = C.migrate({
    settings: { relanceDay: 10 },
    dossiers: [dossier('D1', 'Aaa', ['2026-01']), dossier('D2', 'Bbb', ['2026-01', '2026-02'])]
  });
  const index = { D1: { exercices: [{ annee: 2026, production: { '2026-01': { ecritures: 3, validees: 3 } } }] }, D2: { exercices: [] } };
  const lignes = C.production(s, index, { today: '2026-04-10' });
  assert.strictEqual(lignes.length, 2);
  assert.strictEqual(lignes[0].id, 'D2', 'le dossier le plus en retard n\'est pas en tête');
  assert.strictEqual(lignes[0].aSaisir, 2);
  assert.strictEqual(lignes[1].aSaisir, 0);
  assert.strictEqual(lignes[1].saisis, 1);
});

t('9.9.0 : l\'état de production d\'un livre se DÉDUIT, il ne se coche pas', () => {
  // Une liste d'états qu'on coche est fausse le jour où quelqu'un oublie de cocher : tout vient
  // des écritures, des déclarations et des révisions du livre lui-même.
  const { createCabStore } = require('../../src/cabinet/cabstore.js');
  const l = livre();
  piece(l, { id: 'a', date: '2026-03-04' }, true, 'Amine');
  piece(l, { id: 'b', date: '2026-03-08' }, false, 'Sonia');
  piece(l, { id: 'c', date: '2026-04-02' }, true, 'Amine');
  l.declarations.push({ periode: '2026-03', deposee: true });
  const p = createCabStore(require('os').tmpdir()).productionDuLivre(l);
  assert.strictEqual(p['2026-03'].ecritures, 2);
  assert.strictEqual(p['2026-03'].validees, 1);
  assert.strictEqual(p['2026-03'].brouillards, 1);
  assert.strictEqual(p['2026-03'].declare, true);
  assert.strictEqual(p['2026-03'].revise, false);
  assert.strictEqual(p['2026-04'].declare, false, 'un mois sans déclaration ne doit pas hériter de celle d\'à côté');
  assert.ok(p['2026-03'].qui, 'le mois ne retient pas qui l\'a touché en dernier');
});

// ---------------------------------------------------------------- les portes, lues dans la source

t('9.9.0 : tout geste qui ÉCRIT dans le livre passe par la porte des droits, et aucune lecture', () => {
  // Le jumeau exact du test de licence (9.4.0), et pour la même raison : une seconde vérification
  // recopiée ailleurs finirait par diverger, et une divergence ici veut dire « quelqu'un valide ce
  // qu'il n'a pas le droit de valider ». Les DEUX sens — la porte sur ce qui écrit, son ABSENCE sur
  // ce qui lit : sans la seconde moitié, le test laisserait passer une porte posée partout,
  // c'est-à-dire des données en otage (6.4.0).
  const src = lireSource('src', 'cabinet', 'main.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(src.includes('function droitBlock(dossierId, geste)'), 'la porte unique des droits a disparu');

  // La borne est la PREMIÈRE des deux : le handler suivant, ou une déclaration de fonction au
  // niveau du fichier. Bornée sur le seul handler suivant, la tranche de `cab:livres` avalait la
  // définition de `droitBlock` elle-même, cent lignes plus bas, et le test accusait un handler de
  // lecture parfaitement innocent. Une tranche de source se prouve par ce qu'elle NE contient pas
  // autant que par ce qu'elle contient (7.21.0).
  const bloc = nom => {
    const i = src.indexOf(`ipcMain.handle('cab:${nom}'`);
    if (i < 0) return null;
    const suivants = [src.indexOf('ipcMain.handle(', i + 10), src.indexOf('\nfunction ', i + 10)]
      .filter(x => x > 0);
    return src.slice(i, suivants.length ? Math.min(...suivants) : src.length);
  };
  const ECRIVENT = {
    saisir: 'saisie', modifierEcriture: 'saisie', supprimerEcriture: 'saisie', joindreEcriture: 'saisie',
    importerPlan: 'saisie', importerBalance: 'saisie', relireLesPaquets: 'saisie',
    ajouterReleve: 'saisie', supprimerReleve: 'saisie', rapprocherAuto: 'saisie', rapprocher: 'saisie',
    derapprocher: 'saisie', saveInventaire: 'saisie', saveImmobilisation: 'saisie',
    supprimerImmobilisation: 'saisie', saveAbonnements: 'saisie', genererAbonnements: 'saisie',
    valider: 'validation', validerLot: 'validation', contrepasser: 'validation', extourner: 'validation',
    lettrer: 'validation', lettrageAuto: 'validation', poserDeclaration: 'validation',
    pointerDeclaration: 'validation', ecrireDeclaration: 'validation', ecrireDotations: 'validation',
    ecrireVariationStock: 'validation',
    reprendre: 'supervision', cloturer: 'supervision', rouvrir: 'supervision',
    ouvrirSuivant: 'supervision', ecrireCloture: 'supervision', deleteDossier: 'supervision'
  };
  const sans = [];
  Object.keys(ECRIVENT).forEach(nom => {
    const b = bloc(nom);
    assert.ok(b, `le handler cab:${nom} a disparu : le test ne prouve plus rien de lui`);
    if (!new RegExp(`droitBlock\\((dossierId|id), '${ECRIVENT[nom]}'\\)`).test(b)) sans.push(nom);
  });
  assert.deepStrictEqual(sans, [], 'ces gestes écrivent dans le livre sans passer par les droits');

  // Et l'autre moitié : rien de ce qui LIT n'est fermé. Lire, exporter, relancer, sauvegarder —
  // toujours ouverts, quel que soit le rôle.
  const LISENT = ['livre', 'livreIndex', 'state', 'declaration', 'immobilisations', 'inventaire',
    'cloture', 'exportEcritures', 'exportCsv', 'livres', 'ecrituresPlan', 'noteRelance', 'backupNow',
    'importPack', 'listPack', 'production', 'collaborateurs'];
  const fermes = LISENT.filter(nom => { const b = bloc(nom); return b && /droitBlock\(/.test(b); });
  assert.deepStrictEqual(fermes, [], 'ces gestes LISENT et se retrouvent fermés : des données en otage');
});

t('9.9.0 : la piste d\'audit porte QUI, et le verrou se LÈVE après l\'écriture', () => {
  const src = lireSource('src', 'cabinet', 'main.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const i = src.indexOf('function ecrireLeLivre(');
  assert.ok(i > 0, 'la porte d\'écriture unique a disparu');
  const corps = src.slice(i, src.indexOf('\n}', i));
  // On ancre sur LA ligne qui trace le geste, pas sur le corps entier : `ecrireLeLivre` porte une
  // SECONDE piste d'audit, celle de la fusion, et elle satisfaisait à elle seule un test écrit sur
  // le corps — le défaut remis restait vert. Un test trop LARGE laisse passer le défaut, aussi
  // sûrement qu'un test trop étroit accuse du code juste (9.4.7), et je ne l'ai su qu'en essayant
  // de le faire tomber.
  const trace = (corps.match(/if \(quoi\) livre\.audit\.push\(\{[^}]*\}\);/) || [])[0];
  assert.ok(trace, 'la porte d\'écriture ne trace plus le geste dans la piste d\'audit');
  assert.ok(/qui: quiSuisJe\(\)/.test(trace), 'la piste d\'audit ne porte plus le nom de qui a agi');
  assert.ok(/poste: moiPoste\(\)\.deviceName/.test(trace), 'la piste d\'audit ne dit plus depuis quel poste');
  // `leverVerrou` n'avait AUCUN appelant jusqu'ici : le verrou, posé à chaque écriture, interdisait
  // à l'autre poste d'écrire pendant vingt-quatre heures après un seul enregistrement.
  assert.ok(/leverVerrou\(/.test(corps), 'le verrou ne se lève jamais : un seul enregistrement bloque l\'autre poste 24 h');
  // Et le conflit de révision se FUSIONNE au lieu d'écraser.
  assert.ok(/if \(r && r\.conflit\)/.test(corps) && /fusionnerLivres\(r\.disque, livre/.test(corps),
    'un enregistrement concurrent écrase le travail de l\'autre poste au lieu de le réunir');
  // `quiSuisJe` rend le nom du collaborateur, et le nom du poste à défaut.
  assert.ok(/const quiSuisJe = \(\) => \{ const c = moiCollab\(\); return \(c && c\.nom\)/.test(src),
    'l\'identité de qui travaille ne vient plus du collaborateur déclaré');
});

t('9.9.0 : deux postes sur un même livre — le second ne peut pas écraser le premier', () => {
  // Le vrai danger du partage par fichier, et il est silencieux : A ouvre, B ouvre, A enregistre,
  // B enregistre — et la demi-journée de A a disparu. Ce test pose deux VRAIS fichiers sur le
  // disque et rejoue exactement cette séquence.
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { createCabStore } = require('../../src/cabinet/cabstore.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'equipe-'));
  const store = createCabStore(dir);
  store.create('motdepasse-essai');
  const dossier = { id: 'D1', name: 'Client' };
  const idx = store.folderIndex([dossier]);

  const base = livre('D1', 2026);
  piece(base, { id: 'a', piece: 'F1' }, true);
  assert.ok(store.ecrireLivre(dossier, base, idx).ok, 'la première écriture a échoué');

  // Les deux postes ouvrent la MÊME révision.
  const posteA = store.lireLivre(dossier, 2026, idx).livre;
  const posteB = store.lireLivre(dossier, 2026, idx).livre;
  assert.strictEqual(posteA.revision, posteB.revision, 'le décor du test est faux : les deux devaient partir de la même révision');

  piece(posteA, { id: 'a2', piece: 'F2' }, true, 'poste A');
  assert.ok(store.ecrireLivre(dossier, posteA, idx).ok, 'le poste A n\'a pas pu enregistrer');

  piece(posteB, { id: 'b2', piece: 'F3' }, true, 'poste B');
  const r = store.ecrireLivre(dossier, posteB, idx);
  assert.strictEqual(r.conflit, true, 'le poste B a ÉCRASÉ le travail du poste A, en silence');
  assert.ok(r.disque.ecritures.some(e => e.id === 'a2'), 'le conflit ne rend pas ce qui est sur le disque');

  // Et la parade : on fusionne, puis on force. Rien n'est perdu des deux côtés.
  const f = K.fusionnerLivres(r.disque, posteB, 1);
  assert.ok(f.ok);
  assert.ok(store.ecrireLivre(dossier, f.livre, idx, { force: true }).ok);
  const final = store.lireLivre(dossier, 2026, idx).livre;
  ['a', 'a2', 'b2'].forEach(id => assert.ok(final.ecritures.some(e => e.id === id), `l'écriture ${id} a été perdue`));

  // Le verrou : posé par un autre poste, il refuse — et « forcer » le reprend.
  store.poserVerrou(dossier, 2026, { deviceId: 'AUTRE', deviceName: 'iMac du bureau' }, idx);
  const refus = store.poserVerrou(dossier, 2026, { deviceId: 'MOI', deviceName: 'mon portable' }, idx);
  assert.strictEqual(refus.ok, false, 'le verrou d\'un autre poste ne protège plus rien');
  assert.strictEqual(refus.verrou.deviceName, 'iMac du bureau', 'le refus ne nomme pas le poste : il n\'y a rien à décider');
  const repris = store.poserVerrou(dossier, 2026, { deviceId: 'MOI', deviceName: 'mon portable' }, idx, { forcer: true });
  assert.strictEqual(repris.ok, true, 'un verrou orphelin ne se reprend pas : la saisie est bloquée 24 h');
  assert.strictEqual(repris.repris, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

t('9.9.1 : le contrôle anti-écrasement se paie sur l\'ENTÊTE, pas sur le livre entier', () => {
  // Relire le LIVRE avant chaque enregistrement coûterait une ouverture complète — 90 à 160 ms sur
  // 50 000 lignes, mesurés par `npm run charge`, pour un geste dont le seuil est de 100 ms. Le
  // garde-fou aurait coûté plus cher que ce qu'il protège. L'entête est en clair : mille vingt-
  // quatre octets, aucune clé, 0,1 ms. Ce test tient les deux moitiés — la révision EST dans
  // l'entête, et c'est elle que le contrôle lit.
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { createCabStore } = require('../../src/cabinet/cabstore.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'equipe3-'));
  const store = createCabStore(dir);
  store.create('motdepasse-essai');
  const dossier = { id: 'D1', name: 'Client' };
  const idx = store.folderIndex([dossier]);
  const l = livre('D1', 2026); piece(l, { id: 'a' }, true);
  const r1 = store.ecrireLivre(dossier, l, idx);
  const h1 = store.enteteLivre(r1.fichier);
  assert.ok(h1, 'l\'entête du livre ne se lit plus sans la clé');
  assert.strictEqual(h1.revision, 1, 'l\'entête ne porte pas la révision : le contrôle devrait déchiffrer le livre entier');
  piece(l, { id: 'b' }, true);
  store.ecrireLivre(dossier, l, idx);
  assert.strictEqual(store.enteteLivre(r1.fichier).revision, 2, 'la révision de l\'entête ne monte pas');

  const src = lireSource('src', 'cabinet', 'cabstore.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(x => !/^\s*\/\//.test(x)).join('\n');
  const i = src.indexOf('function ecrireLivre(');
  const corps = src.slice(i, src.indexOf('\n  }', i));
  assert.ok(/const h = enteteLivre\(f\);/.test(corps),
    'le contrôle de révision ne passe plus par l\'entête : il déchiffrerait le livre à chaque enregistrement');
  fs.rmSync(dir, { recursive: true, force: true });
});

t('9.9.1 : le test de charge mesure les primitives que le LIVRE utilise vraiment', () => {
  // Il a mesuré le base64 jusqu'ici, alors que le livre est en corps binaire depuis la 9.2.0 —
  // décidé par cette mesure même. Il annonçait donc « 174 ms pour un seuil de 100, le format doit
  // changer avant d'être écrit » sur un format déjà changé pour cette raison. Un instrument qui
  // mesure ce que le code n'utilise plus annonce un défaut qui n'existe pas.
  const charge = lireSource('test', 'charge-livre.js');
  // On juge la FONCTION DE SCELLEMENT, pas le fichier : il porte aussi un banc de comparaison qui
  // écrit délibérément du base64 pour mesurer ce que ça coûterait. Un test qui interdit un MOT
  // accuse du code juste (9.4.0).
  const i = charge.indexOf('function sealWithKey(');
  const seal = charge.slice(i, charge.indexOf('\n}', i));
  assert.ok(i > 0 && /return Buffer\.concat\(\[head, body\]\);/.test(seal),
    'le test de charge ne scelle plus comme le livre : sa mesure ne porte pas sur ce qu\'elle annonce');
  assert.ok(!/data: body\.toString\('base64'\)/.test(seal),
    'le test de charge est revenu au base64 — ce n\'est pas ce que le livre écrit');
  // Et son garde-fou vise les primitives du LIVRE, pas celles de `cabinet-data.json`.
  assert.ok(/\['corps binaire du livre', 'return Buffer\.concat\(\[head, body\]\);'\]/.test(charge),
    'le contrôle de dérive du test de charge ne surveille plus le bon scellement');
  // Le cinquième seuil existe, et il est écrit AVANT la mesure comme les quatre autres.
  assert.ok(/ecritureAdeux: 100/.test(charge), 'le seuil « enregistrer à trois postes » a disparu');
});

t('9.9.0 : un livre venu d\'ailleurs se lit sans jamais toucher à son fichier', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { createCabStore } = require('../../src/cabinet/cabstore.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'equipe2-'));
  const store = createCabStore(dir);
  store.create('motdepasse-essai');
  const dossier = { id: 'D1', name: 'Client' };
  const idx = store.folderIndex([dossier]);
  const l = livre('D1', 2026); piece(l, { id: 'a' }, true);
  const ecrit = store.ecrireLivre(dossier, l, idx);
  // On copie le fichier ailleurs : c'est la clé USB d'un collaborateur.
  const ailleurs = path.join(dir, 'usb-livre-2026.json');
  fs.copyFileSync(ecrit.fichier, ailleurs);
  const avant = fs.statSync(ailleurs).size;
  const r = store.lireLivreFichier(ailleurs);
  assert.ok(r.livre, 'le livre de la clé USB ne se lit pas');
  assert.strictEqual(r.livre.ecritures.length, 1);
  assert.strictEqual(fs.statSync(ailleurs).size, avant, 'le fichier d\'origine a été réécrit : ce support n\'est pas le nôtre');
  fs.rmSync(dir, { recursive: true, force: true });
});

t('9.9.0 : l\'écran de l\'équipe et les droits existent, et leurs bulles sont posées', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/'pan-equipe': \{ onglet: 'cabinet'/.test(app), 'le panneau de l\'équipe n\'est plus déclaré dans la table');
  assert.ok(app.includes('panneauReg(\'pan-equipe\''), 'le panneau de l\'équipe n\'est posé nulle part');
  // Le panneau des droits vit dans la FICHE, pas dans les Réglages : il ne porte donc pas le
  // préfixe `pan-`, que le garde-fou des Réglages réserve à sa table.
  assert.ok(/<div class="panel" id="d-droits">/.test(app), 'le panneau des droits d\'un dossier a disparu');
  assert.ok(/function panneauDroits\(dossier\)/.test(app) && /if \(!liste\.length\) return '';/.test(app),
    'la grille des droits s\'affiche même sur un cabinet d\'une personne');
  // Un bouton éteint dit POURQUOI, et par la même fonction que celle qui refusera (9.4.5) : le
  // verdict de `peutGererCollaborateurs` voyage du processus principal jusqu'à l'écran.
  assert.ok(/gestion: K\.peutGererCollaborateurs\(state, moiId\(\)\)/.test(lireSource('src', 'cabinet', 'main.js')),
    'l\'écran ne reçoit plus le verdict : il devrait le recalculer, et les deux divergeraient');
  assert.ok(/id="eq-add" \$\{g\.ok \? '' : 'disabled'\}/.test(app), 'le bouton d\'ajout ne s\'éteint plus');
  assert.ok(/g\.ok \? '' : `<p class="muted small mt">\$\{esc\(g\.motif/.test(app), 'le bouton éteint ne dit pas pourquoi');
});
};
