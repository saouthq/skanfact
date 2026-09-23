'use strict';
// ============================================================================================
// Les tests terrain (TESTS-TERRAIN.md) — ce que Skander a vu en jouant le comptable, corrigé en 9.8.8
//
// Chaque test porte le numéro du constat qu'il tient (T-nn) et se prouve en réintroduisant le
// défaut : un test qui ne peut pas échouer est pire que pas de test (7.2.0). Les tests purs
// construisent un vrai livre depuis les paquets de l'exemple ; les tests de source relisent le
// renderer du Cabinet, commentaires retirés.
module.exports = ({ t, assert, lireSource }) => {
// Évalue un morceau de source dans un contexte VIDE, où l'on ne pose que ce qu'il lit : une table
// ou une fonction pure se juge sur ce qu'elle rend, pas sur sa forme.
const evaluer = (src, ctx) => require('vm').runInNewContext('(' + src + ')', { ...(ctx || {}) });
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
// Le nettoyage des commentaires se prouve par un TÉMOIN, pas par un rapport de longueurs. Le
// danger qu'il garde est réel — un `/*` non refermé, ou un `/*` cité dans une chaîne, et le
// `[\s\S]*?` avale un bloc entier de code sans qu'un seul test s'en plaigne. Mais le rapport
// « il doit rester plus de la moitié » n'est qu'un PROXY, et il est tombé sur du code
// parfaitement juste le jour où `harnais.js` a franchi 50 % de prose (0,497) : c'est un fichier
// d'instruments, il s'explique plus qu'il ne code, et c'est voulu. Un test trop étroit accuse du
// code juste, aussi sûrement qu'un test trop large laisse passer le défaut (9.1.0, 9.4.7) — et le
// « réparer » en baissant le chiffre n'aurait rien vérifié du tout (7.13.0). On exige donc ce que
// la règle dit vraiment : un morceau de code que le fichier porte à coup sûr doit survivre.
const sansComm = (src, temoin) => {
  const net = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(src.includes(temoin), 'témoin absent du fichier d\'origine : ' + temoin);
  assert.ok(net.includes(temoin), 'le nettoyage des commentaires a mangé le code (' + temoin + ')');
  return net;
};
const cabApp = () => sansComm(lireSource('src', 'cabinet', 'renderer', 'app.js'), 'function draw(');
const tranche = (src, deb, fin, min, max) => {
  const a = src.indexOf(deb); assert.ok(a >= 0, 'ancre introuvable : ' + deb);
  const b = src.indexOf(fin, a + deb.length); assert.ok(b > a, 'borne introuvable : ' + fin);
  const z = src.slice(a, b);
  assert.ok(z.length >= min && z.length <= max, `tranche suspecte (${z.length}) entre ${deb} et ${fin}`);
  return z;
};

// Les tables de la navigation de la comptabilité (10.12.0, U-06), ÉVALUÉES telles que
// l'application les porte : juger leur texte à coups d'expressions régulières décrirait leur
// forme ; les évaluer dit ce qu'elles montrent. `ongletDispo` lit `livresState.livre` : on le lui
// passe explicitement.
function tablesCompta(app) {
  const pris = (re, quoi) => { const m = re.exec(app); assert.ok(m, quoi + ' a disparu'); return m[1]; };
  const ONGLETS_COMPTA = evaluer(pris(/const ONGLETS_COMPTA = (\{[\s\S]*?\n  \});/, 'la table des onglets de la comptabilité'));
  const GROUPES_COMPTA = evaluer(pris(/const GROUPES_COMPTA = (\[[\s\S]*?\n  \]);/, 'la table des groupes'));
  const ONGLETS_SANS_LIVRE = evaluer(pris(/const ONGLETS_SANS_LIVRE = (\[[^\]]*\]);/, 'la liste des écrans lus sans livre'));
  const ONGLETS_DU_LIVRE = evaluer(pris(/const ONGLETS_DU_LIVRE = ([^;]+);/, 'la liste des onglets du livre'), { ONGLETS_COMPTA, ONGLETS_SANS_LIVRE });
  const porte = pris(/const ongletDispo = (o => [^;]+);/, 'la porte des onglets');
  const ongletDispo = (o, livre) => evaluer(porte, { ONGLETS_COMPTA, ONGLETS_SANS_LIVRE, livresState: { livre } })(o);
  return { ONGLETS_COMPTA, GROUPES_COMPTA, ONGLETS_SANS_LIVRE, ONGLETS_DU_LIVRE, ongletDispo };
}

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

// T-46 (9.8.8-beta.3) — sur un dossier SANS livre, « Balance auxiliaire » ne faisait rien : le
// redessin lisait `livre.ouverture` sur un livre absent, plantait en silence, et l'écran restait celui
// d'avant le clic. Le moteur doit rendre le même verdict avec ou sans livre : l'auxiliaire se calcule
// sur des LIGNES (règle 9.1.0), et un dossier lu dans ses paquets en a.
t('T-46 : la balance auxiliaire se calcule aussi sur un dossier sans livre (lu dans ses paquets)', () => {
  assert.deepStrictEqual(K.soldesDepuisOuverture(null), {}, 'sans livre, aucune ouverture — pas une exception');
  assert.deepStrictEqual(K.soldesDepuisOuverture(undefined), {});
  assert.deepStrictEqual(K.soldesDepuisOuverture({}), {}, 'un livre sans ouverture non plus');
  // Et la chaîne entière que l'écran déroule sur un dossier sans livre, avec les lignes de l'exemple.
  const lignes = K.lignesDuLivre(livreDeLExemple());
  const C = K.collectifsDeTiers(null, 'clients');
  assert.deepStrictEqual(C, ['411'], 'sans livre, le collectif clients est le repli du plan');
  const aux = K.balanceAuxiliaireDepuisLignes(lignes, C, { avant: [] });
  const gen = K.balanceDepuisLignes(lignes, null, null);
  const solde411 = K.round3(gen.rows.filter(r => String(r.account).startsWith('411')).reduce((s, r) => s + r.solde, 0));
  assert.ok(aux.rows.length >= 2 && aux.solde === solde411, 'l\'auxiliaire d\'un dossier sans livre dit la même chose que sa générale');
  // Le verdict de l'écran lit l'ouverture reprise PAR COMPTE pour expliquer un écart : sur un dossier
  // sans livre elle vaut zéro, et la phrase ne doit pas l'inventer.
  const repris = K.round3(Object.keys(K.soldesDepuisOuverture(null)).filter(k => C.some(c => k.startsWith(c))).reduce((a, k) => a + 0, 0));
  assert.strictEqual(repris, 0);
});

// T-47 (9.8.8-beta.3) — « Il manque 9 mois » sans livre, « 5 mois » avec, sur le même dossier au
// même instant : le compte sans livre réclamait le mois en cours ET l'avenir. Une seule fonction
// pour les deux états, qui s'arrête au mois dernier (Cabinet 1.0.0).
t('T-47 : les mois manquants se comptent avec la MÊME fonction, avec ou sans livre, et jamais l\'avenir', () => {
  const Kc = require('../../src/cabinet/cabcore.js');
  // Trois mois reçus (juin, juillet, août) sur un exercice lu le 21 septembre : janvier→mai manquent,
  // septembre est en cours, octobre→décembre n'existent pas encore.
  const m = Kc.moisManquants(['2026-06', '2026-07', '2026-08'], '2026-01', '2026-12', '2026-09-21');
  assert.deepStrictEqual(m, ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'], 'cinq mois, jamais neuf');
  // Des DATES complètes (les lignes d'un livre) comptent comme des mois.
  assert.deepStrictEqual(Kc.moisManquants(['2026-06-05', '2026-07-18', '2026-08-29'], '2026-01', '2026-12', '2026-09-21'), m);
  // Une période entièrement passée se compte en entier ; une période entièrement future ne réclame rien.
  assert.deepStrictEqual(Kc.moisManquants([], '2025-11', '2025-12', '2026-09-21'), ['2025-11', '2025-12']);
  assert.deepStrictEqual(Kc.moisManquants([], '2026-10', '2026-12', '2026-09-21'), []);
  // Un mois seul, tout juste passé.
  assert.deepStrictEqual(Kc.moisManquants([], '2026-08', '2026-08', '2026-09-21'), ['2026-08']);
  assert.deepStrictEqual(Kc.moisManquants([], '2026-09', '2026-09', '2026-09-21'), [], 'le mois en cours n\'est jamais réclamé');
  assert.deepStrictEqual(Kc.moisManquants([], '', '2026-12'), [], 'sans bornes, rien');
  // Et l'écran n'a plus de boucle à lui : les deux états passent par cette fonction.
  const src = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const zone = src.slice(src.indexOf('function lignesDeLaPeriode('), src.indexOf('function lignesDeLaPeriode(') + 6000);
  assert.ok(zone.includes("source: 'livre'") && zone.includes("source: 'paquets'"), 'découpage de lignesDeLaPeriode raté');
  assert.strictEqual((zone.match(/K\.moisManquants\(/g) || []).length, 2, 'les DEUX états du dossier comptent par la même fonction');
  assert.ok(!/manquants\.push\(/.test(zone), 'aucune boucle locale ne doit recompter les mois à sa façon');
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
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'), 'ipcMain.handle(');
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
  // 10.10.0 (C-02) — retourné. Ce test exigeait « sept onglets » écrits à la main : il gravait la
  // phrase au lieu de la règle, et il est resté vert quand trois onglets de plus sont arrivés (Paie,
  // Révision, Liasse). La phrase se DÉDUIT de `ONGLETS_DU_LIVRE`, et la liste se confronte à la
  // barre d'onglets dans les DEUX sens : chaque nom annoncé est un onglet qui n'existe qu'avec un
  // livre, et chaque onglet qui n'existe qu'avec un livre est annoncé.
  // 10.12.0 (U-06) — retourné une seconde fois, et pour la même raison : il lisait la barre
  // d'onglets écrite à la main, bouton par bouton. Elle se DÉDUIT désormais d'une table (les
  // quatorze écrans, rangés en trois groupes) et d'une seule porte, `ongletDispo`. On évalue donc
  // la table et la porte telles que l'application les porte, et on confronte ce qu'elles
  // montrent à ce que le bandeau annonce — dans les DEUX sens, comme avant.
  const tables = tablesCompta(app);
  const labels = tables.ONGLETS_COMPTA;
  const annonces = tables.ONGLETS_DU_LIVRE;
  const sansLivre = Object.keys(labels).filter(o => !tables.ongletDispo(o, null));
  assert.ok(sansLivre.length >= 10, 'la porte des onglets n\'a pas été lue : ' + sansLivre.length);
  // Chaque onglet qui n'existe qu'avec un livre est annoncé, et chaque onglet annoncé n'existe
  // qu'avec un livre.
  sansLivre.forEach(o => assert.ok(annonces.includes(labels[o]), `l'onglet « ${labels[o]} » n'existe qu'avec un livre et le bandeau ne l'annonce pas`));
  annonces.forEach(lb => assert.ok(sansLivre.some(o => labels[o] === lb), `« ${lb} » est annoncé mais existe déjà sans livre : le bandeau ment`));
  // Et avec un livre, tout existe : rien d'annoncé ne reste introuvable.
  Object.keys(labels).forEach(o => assert.ok(tables.ongletDispo(o, {}), `« ${labels[o]} » reste absent même avec un livre`));
  assert.ok(app.includes('Créer le livre ouvre ${ONGLETS_DU_LIVRE.length} onglets de plus'), 'le bandeau ne se déduit plus de la liste (T-03, C-02)');
  // La barre ne pose QUE ce que la porte laisse passer : sans ce filtre, les écrans du livre
  // s'afficheraient sans livre, et le bandeau qui les annonce mentirait.
  assert.ok(/id="c-tabs"[^>]*>\$\{gOuvert\.onglets\.filter\(ongletDispo\)\.map\(boutonOnglet\)/.test(app), 'la barre d\'onglets ne passe plus par la porte `ongletDispo`');
  // T-05 : la réassurance se lit AVANT le geste — une bulle à côté du bouton, avec sa clé d'aide.
  assert.ok(/id="lv-relire2"[^`]*Relire les paquets reçus<\/button>\$\{info\('lv\.relire'\)\}/.test(app), '« Relire les paquets reçus » n\'a pas sa bulle');
  const guide = lireSource('src', 'cabinet', 'renderer', 'cabguide.js');
  assert.ok(/'lv\.relire': \{[^}]*ne touche jamais/.test(guide), 'la bulle ne dit pas que les validées ne bougent pas');
  // T-36 : le bandeau de l'exemple compte les livres partis, et main.js les compte à la source.
  assert.ok(app.includes('exempleRefait.livres') && app.includes('livre de démonstration est parti'), 'le bandeau ne dit pas que la saisie d\'essai est partie');
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'), 'ipcMain.handle(');
  assert.ok(/livres \+= \(r && r\.livres\) \|\| 0/.test(main) && /return \{ version: VERSION, mois, raison, livres:/.test(main), 'rafraichirExemple ne compte pas les livres');
});

t('T-10 : une pastille compte ce qui attend une décision, partout', () => {
  const app = cabApp();
  // 10.12.0 (U-06) — retourné vers la règle : les pastilles vivaient chacune dans son bouton,
  // elles vivent dans UNE fonction que chaque onglet appelle, et que chaque groupe additionne.
  const p = tranche(app, 'function pastilleCompta(o) {', 'function drawLivres(root, dossier) {', 800, 4000);
  const immo = tranche(p, "if (o === 'immobilisations') {", 'return n ?', 30, 400);
  assert.ok(/etatImmobilisations\(L, s\.annee\)\.aEcrire/.test(immo), 'Immobilisations compte encore ses fiches, pas les dotations à passer');
  assert.ok(!/const n = \(L\.immobilisations \|\| \[\]\)\.length;/.test(immo), 'la pastille des immobilisations affiche encore un inventaire');
  const saisie = tranche(p, "if (o === 'saisie') {", '}', 30, 400);
  assert.ok(/statut === 'brouillard'/.test(saisie) && /!\(L\.exercice && L\.exercice\.clos\)/.test(saisie), 'la Saisie garde sa pastille sur un exercice clos');
  const bouton = tranche(app, 'const boutonOnglet = o => {', 'el.innerHTML = `${sansLivre}', 200, 2000);
  assert.ok(/const p = pastilleCompta\(o\);/.test(bouton), 'un onglet ne demande plus sa pastille à la fonction commune');
  assert.ok(/<span class="badge b-paid">clos<\/span>/.test(bouton) && !/tab-n">clos/.test(bouton), '« clos » est encore habillé en compteur');
  // Un groupe replié cache ses écrans : sa pastille est la SOMME des leurs, sinon ce qui attend
  // une décision dans « Déclarer et clôturer » disparaît dès qu'on est dans « Saisir ».
  assert.ok(/const totalGroupe = g => g\.onglets\.reduce\(\(a, o\) => a \+ \(\(pastilleCompta\(o\) \|\| \{\}\)\.n \|\| 0\), 0\);/.test(app), 'la pastille d\'un groupe n\'additionne plus celles de ses écrans');
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
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'), 'ipcMain.handle(');
  assert.ok(/KC\.noterDossierCloture\(livre, \{ chemin: res\.filePath/.test(main), 'main.js n\'écrit pas la trace dans le livre');
  const K = require('../../src/renderer/compta.js');
  const livre = K.livreVide('D1', 2026);
  K.noterDossierCloture(livre, { chemin: '/tmp/x.skanclose', scelle: true, pdf: false }, 'moi', 5);
  assert.strictEqual(livre.exercice.dossiersProduits.length, 1);
  assert.deepStrictEqual(livre.exercice.dossiersProduits[0], { le: 5, par: 'moi', chemin: '/tmp/x.skanclose', scelle: true, pdf: false, signe: false });
  assert.ok(livre.audit.some(a => a.quoi === 'dossier de clôture produit' && a.detail === 'x.skanclose'), 'la piste d\'audit ne porte pas le dossier produit');
});

// La 9.8.8 laissait `toFixed(3)` REMPLIR un champ, « qui se relit en interne ». Le test humain de
// la 10.12.0 (H-3) a montré ce que ça donne : Tab soldait une pièce en écrivant « 250.000 » sous un
// total à « 250,000 » — en français, deux cent cinquante mille. Un champ, c'est le COMPTABLE qui le
// relit. L'exception est retirée : plus aucun `toFixed(3)` ; l'écran passe par `montant()`, un
// champ par `montantChamp()`, et tout se relit par `lireMontant()`.
t('T-28 / H-3 : un montant porte la virgule PARTOUT — à l\'écran comme dans un champ', () => {
  const app = cabApp();
  assert.ok(/const montant = n => money\(n\)\.replace/.test(app), 'le formateur sans devise manque');
  assert.ok(/const montantChamp = /.test(app) && /const lireMontant = /.test(app), 'le format et la lecture d\'un champ manquent');
  const restes = app.split('\n').filter(l => l.includes('.toFixed(3)')).map(l => l.trim().slice(0, 110));
  assert.deepStrictEqual(restes, [], 'un montant s\'écrit encore avec un point (toFixed(3))');
  // Et aucun champ ne se relit plus par la lecture naïve, qui rendait ZÉRO pour l'espace des milliers.
  // (Un TAUX dégressif n'est pas un montant : il reste lu à part, et nommé ici pour que ça se voie.)
  const naifs = app.split('\n').filter(l => /Number\(String\(.*\.replace\(',', '\.'\)\)/.test(l) && !/tauxDegressif/.test(l)).map(l => l.trim().slice(0, 110));
  assert.deepStrictEqual(naifs, [], 'un montant se relit encore par Number(x.replace(\',\', \'.\'))');
});

t('T-29 / T-31 / T-32 / T-33 : les lots existent, Tab est expliqué, une ligne s\'ajoute à la souris, la liste sort du tableau', () => {
  const app = cabApp();
  assert.ok(/function lotsDuBrouillard\(brouillards\)/.test(app), 'les lots ne se déduisent pas du brouillard');
  assert.ok(/lotsDuBrouillard\(brouillards\)\.map\(l => `<button type="button" class="btn btn-sm" data-lot-\$\{l\.type\}/.test(app), 'les boutons de lot ne viennent pas du brouillard');
  assert.ok(!/Valider tout le journal \$\{esc\(p\.journal\)\}/.test(app), 'le lot suit encore l\'en-tête de saisie');
  assert.ok(/\$\$\('\[data-lot-journal\]', el\)\.forEach/.test(app) && /\$\$\('\[data-lot-mois\]', el\)\.forEach/.test(app), 'les lots ne sont pas branchés');
  // T-31 : la règle avant l'exception. L'assertion recopiait le libellé du jour et est tombée le
  // jour où il a dit d'OÙ l'on solde (T-48), sur du code juste — la seizième fois que ce motif
  // revient. Ce qui compte est l'ORDRE des deux paires, pas leur orthographe.
  const aide = tranche(app, 'function aideTouches(', '\n  }', 200, 1200);
  const iChamp = aide.indexOf("paire('Champ suivant', 'Tab')");
  const iSolder = aide.search(/paire\('Solder/);
  assert.ok(iChamp > 0 && iSolder > iChamp, 'la légende nomme l\'exception de Tab avant sa règle');
  assert.ok(!/paire\('Solder la pièce'/.test(aide), '« Solder la pièce » laisse croire que Tab solde toujours');
  // T-48 : et elle dit d'OÙ. Le geste ne part que de la case Crédit de la dernière ligne ; une
  // légende qui l'annonce sans sa condition fait croire à un raccourci qui marche une fois sur deux.
  assert.ok(/paire\('Solder[^']*Crédit'/.test(aide), 'la légende de solde doit nommer la case d\'où l\'on appuie');
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

// T-52 (9.8.8-beta.3) — TEST-1, datée du 4 mars et validée le 21 septembre, s'affichait « n° 1 »
// dans le livre-journal, et les six validées d'avant passaient 2..7. Le moteur recomptait 1..n par
// date sur des lignes qui portaient pourtant, chacune, le numéro ÉCRIT à la validation (9.2.0).
t('T-52 : le livre-journal montre le numéro ÉCRIT à la validation, jamais un rang recompté par date', () => {
  const livre = livreDeLExemple();
  const validees = livre.ecritures.filter(e => e.statut === 'validee');
  assert.ok(validees.length > 5, 'l\'exemple doit porter des validées');
  const avant = new Map(validees.map(e => [e.id, e.numero]));
  const max = Math.max(...validees.map(e => e.numero));
  // Une pièce datée AVANT toutes les autres, validée après elles : elle prend le numéro suivant.
  const premiere = validees.map(e => e.date).sort()[0];
  const date = livre.exercice.du < premiere ? livre.exercice.du : premiere;
  const tard = K.ajouterEcriture(livre, { date, journal: 'AC', piece: 'TEST-1', libelle: 'Test saisie',
    lignes: [{ compte: '606', debit: 100 }, { compte: '401', credit: 100 }] }, 'test', 5000);
  const brouillon = K.ajouterEcriture(livre, { date, journal: 'AC', piece: 'TEST-2', libelle: 'Brouillard',
    lignes: [{ compte: '606', debit: 50 }, { compte: '401', credit: 50 }] }, 'test', 5001);
  assert.ok(K.validerEcriture(livre, tard.id, 'test', 5002).ok, 'la validation doit passer');
  assert.strictEqual(livre.ecritures.find(e => e.id === tard.id).numero, max + 1, 'le numéro naît à la validation, par ordre de validation');

  const lj = K.journalDepuisLignes(K.lignesDuLivre(livre, { brouillard: true }));
  const parPiece = new Map(lj.pieces.map(p => [p.lignes[0].ecritureId, p.numero]));
  assert.strictEqual(parPiece.get(tard.id), max + 1, 'la pièce validée en dernier porte le dernier numéro, pas « 1 » parce qu\'elle est datée en premier');
  avant.forEach((n, id) => assert.strictEqual(parPiece.get(id), n, 'une validée d\'avant a changé de numéro : ' + id));
  assert.strictEqual(parPiece.get(brouillon.id), null, 'un brouillard n\'a pas de numéro');
  // Un journal se lit par DATE, et le numéro dit l'ordre de validation — les deux informations
  // coexistent, l'une ne réécrit pas l'autre : la pièce datée du premier jour reste au début, le
  // même jour se range par numéro, et le brouillard du même jour passe après les validées.
  const rang = id => lj.pieces.findIndex(p => p.lignes[0].ecritureId === id);
  assert.ok(lj.pieces.slice(0, rang(tard.id)).every(p => p.date === date), 'la pièce datée du premier jour a été rangée après une date postérieure');
  assert.ok(rang(tard.id) < rang(brouillon.id), 'un brouillard du même jour passe après les validées');
  // Filtrer sur un journal ne fait pas repartir la numérotation à 1 (c'était le cas sur l'écran).
  const seulAC = K.journalDepuisLignes(K.lignesDuLivre(livre).filter(l => l.journal === 'AC'));
  seulAC.pieces.forEach(p => assert.strictEqual(p.numero, avant.get(p.lignes[0].ecritureId) || max + 1, 'le filtre a renuméroté ' + p.piece));

  // Des lignes lues dans un PAQUET n'ont pas de numéro écrit : là, on recompte 1..n — et le « N° »
  // du CSV (celui que le client a déduit chez lui) n'est pas repris tel quel.
  const commis = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'cabinet', 'exemple-paquets.json'), 'utf8'));
  const csv = commis.mois[commis.mois.length - 1].fichiers.find(f => f.chemin === 'journaux/ecritures.csv').texte;
  const relues = K.entreesDepuisCsv(csv).map(l => ({ ...l, numero: l.numero + 40 }));
  K.journalDepuisLignes(relues).pieces.forEach((p, i) => assert.strictEqual(p.numero, i + 1, 'un paquet se recompte 1..n'));
});

// T-53 (9.8.8-beta.3) — « Valider la seule de AC » : le bouton de lot n'avait pas de nom et
// n'élidait pas, alors que la branche des mois élidait trois caractères plus loin. Un seul libellé,
// dans cabcore, et l'écran ne fabrique plus le sien.
t('T-53 : le bouton de lot nomme la pièce et élide devant une voyelle', () => {
  const Kc = require('../../src/cabinet/cabcore.js');
  assert.strictEqual(Kc.libelleLot({ type: 'journal', cle: 'AC', label: 'AC', n: 1 }), 'Valider la seule pièce d\'AC');
  assert.strictEqual(Kc.libelleLot({ type: 'journal', cle: 'VT', label: 'VT', n: 3 }), 'Valider les 3 pièces de VT');
  assert.strictEqual(Kc.libelleLot({ type: 'mois', cle: '2026-08', label: 'août 2026', n: 1 }), 'Valider la seule pièce d\'août 2026');
  assert.strictEqual(Kc.libelleLot({ type: 'mois', cle: '2026-03', label: 'mars 2026', n: 2 }), 'Valider les 2 pièces de mars 2026');
  const app = cabApp();
  const zone = tranche(app, 'lotsDuBrouillard(brouillards).map(', '</button>', 40, 400);
  assert.ok(/K\.libelleLot\(l\)/.test(zone), 'le bouton de lot doit prendre son libellé dans cabcore');
  assert.ok(!/la seule|les \$\{/.test(zone), 'l\'écran ne doit plus fabriquer le libellé lui-même');
});

// T-48 (9.8.8-beta.3) — « Solder la dernière ligne ⇥ Tab » ne disait pas d'OÙ : le geste ne part
// que de la case Crédit, sur une ligne qui porte un compte et pas encore de montant. Trois
// conditions qu'aucun écran ne montrait — donc un raccourci qui « ne marche pas » une fois sur deux.
t('T-48 : le geste de solde s\'annonce dans la case d\'où il part, par la MÊME fonction qui l\'exécute', () => {
  const app = cabApp();
  assert.ok(/const soldeProposable = \(\) => \{/.test(app), 'la condition du geste doit vivre dans UNE fonction');
  // Le gestionnaire de Tab ne rejuge rien lui-même : il demande, il pose.
  const tab = tranche(app, "if (ev.key === 'Tab' && !ev.shiftKey && k === 'credit'", '\n          }', 80, 700);
  assert.ok(/soldeProposable\(\)/.test(tab), 'Tab doit demander le solde à `soldeProposable`');
  assert.ok(!/KC\.soldeDeLignes/.test(tab), 'Tab recalcule la condition à la main : elle divergera de ce que l\'écran annonce');
  // Et l'annonce vit dans `majSolde`, avec les totaux : écrite au dessin, elle serait périmée à la
  // frappe suivante — c'est le même mécanisme que `#sa-td` / `#sa-tc` (9.4.5).
  const maj = tranche(app, 'const majSolde = () => {', '\n    };', 600, 4200);
  assert.ok(/soldeProposable\(\)/.test(maj), 'le placeholder du solde doit se recalculer avec les totaux');
  // Les deux assertions qui suivaient cherchaient `placeholder = ` et « au débit » : la première
  // était satisfaite par `placeholder = ''` (une annonce VIDE), la seconde par la phrase du solde
  // juste au-dessus, qui écrit déjà « Il manque 191,000 au débit ». Un test trop large laisse
  // passer le défaut aussi sûrement qu'un test trop étroit accuse du code juste (9.4.7) — et on ne
  // l'a su qu'en essayant de le faire tomber. On exige que l'annonce soit CONSTRUITE sur `prop`.
  assert.ok(/placeholder = prop/.test(maj) && /montant\(prop\./.test(maj),
    'le geste doit s\'annoncer DANS la case avec le montant qu\'il posera, pas par une chaîne vide');
  assert.ok(/prop\.debit \? ' au débit'/.test(maj),
    'l\'annonce doit nommer la colonne quand le montant n\'ira pas dans celle où l\'on est');
});

// T-49 (9.8.8-beta.3) — « + Ajouter une ligne » vivait APRÈS la barre qui clôt la pièce, et collé
// au titre du panneau suivant. Le geste qui ALLONGE un tableau vit sous ce tableau (9.4.8).
t('T-49 : le geste qui allonge la grille vit sous la grille, avant la barre qui clôt la pièce', () => {
  const app = cabApp();
  const iGrille = app.indexOf('<tbody id="sa-lignes">');
  const iAjout = app.indexOf('<div class="sa-ajout">');
  const iPied = app.indexOf('<div class="sa-pied">');
  const iBrouillard = app.indexOf('<h2 class="mt">Le brouillard');
  [iGrille, iAjout, iPied, iBrouillard].forEach(i => assert.ok(i > 0, 'un repère du gabarit de saisie a disparu'));
  assert.ok(iGrille < iAjout, '« + Ajouter une ligne » doit suivre la grille qu\'il allonge');
  assert.ok(iAjout < iPied, 'il doit précéder la barre qui CLÔT la pièce, sinon on le cherche au-dessus d\'un bouton qui enregistre');
  assert.ok(iPied < iBrouillard, 'la barre d\'actions reste le dernier geste de la pièce en cours');
});

// T-49 bis (9.8.8-beta.4) — la remontée d'un cran écrite pour T-49 a fait accuser du code juste :
// « téléphone à renseigner », bouton posé AU MILIEU de la ligne d'identité d'une fiche, s'est
// retrouvé jugé contre le titre du client — 28 défauts annoncés par `e2e:cabinet-rendu`, tous sur
// un écart de 3 px décidé dans la feuille (`.d-ident { margin-block-start: 3px }`). Un conteneur
// qui porte du TEXTE n'est pas l'emballage d'un bouton : c'est une phrase, et les voisins du
// bouton y sont des mots. Un test trop large accuse du code juste (9.1.0, 9.4.7).
t('T-49 bis : la sonde ne remonte d\'un cran que sur un VRAI emballage, jamais sur une phrase', () => {
  const h = sansComm(lireSource('test', 'e2e', 'harnais.js'), 'function capturePleine(');
  const i = h.indexOf('const seul = b.parentElement');
  assert.ok(i > 0, 'la remontée d\'un cran de la sonde d\'espacement a disparu');
  const regle = h.slice(i, i + 220);
  assert.ok(/children\.length === 1/.test(regle), 'un emballage ne contient qu\'un seul élément');
  assert.ok(/enProse\(b\.parentElement\)/.test(regle) && /&&\s*!enProse/.test(regle),
    'un conteneur qui porte aussi du texte n\'est pas un emballage : la remontée doit s\'y arrêter');
  assert.ok(/nodeType === 3 && n\.textContent\.trim\(\)/.test(h),
    'la prose se reconnaît à ses NŒUDS DE TEXTE, pas à un textContent qui compte celui du bouton');
});

// T-56 et T-57 (9.8.8-beta.4) — les deux premiers défauts que l'instrument a vus une fois qu'il
// atteignait les sept écrans cachés (T-55). Les deux sont des écarts que PERSONNE n'a décidés.
t('T-56 : le bandeau du livre est une rangée de gestes, pas de la prose à marges posées à la main', () => {
  const app = cabApp();
  // 10.12.0 (U-01) — retourné vers la règle, pas retiré : le bandeau vert (« Le livre de 2026 »,
  // 54 px) est monté dans la barre de la période, à côté de ce qu'il qualifie. La règle ne change
  // pas : une rangée de gestes décide de ses écarts par un gap, jamais par une marge à la main.
  assert.ok(/<span class="c-livre" id="c-livre-etat">/.test(app), 'la rangée du livre ouvert doit porter la classe qui décide de ses écarts');
  const i = app.indexOf('const etatLivre = source === ');
  assert.ok(i > 0, 'l\'état du livre n\'est plus composé à un seul endroit');
  const bandeau = app.slice(i, i + 1200);
  assert.ok(!/style="margin-inline-start/.test(bandeau),
    'une marge posée à la main ne décide que l\'écart horizontal : au passage à la ligne, le bouton se colle sous la case');
  assert.ok(/<span class="nw"><button class="btn btn-sm" id="lv-relire2"/.test(bandeau),
    'le bouton et sa bulle forment UN objet de la rangée, sinon le gap les sépare et la bulle ne dit plus ce qu\'elle explique');
  // Une classe posée par le code et inconnue de la feuille ne se voit nulle part (6.8.0, 8.1.0, 9.4.3).
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  const regle = css.match(/^\.c-livre \{[^}]*\}/m);
  assert.ok(regle, '.c-livre doit exister dans la feuille du Cabinet');
  assert.ok(/display: (inline-)?flex/.test(regle[0]) && /flex-wrap: wrap/.test(regle[0]) && /gap:/.test(regle[0]),
    'la rangée doit pouvoir passer à la ligne ET porter un gap, sinon elle ne règle qu\'un des deux écarts');
});

t('T-57 : une bulle qui suit un BOUTON a son écart, et rien ne se colle par une espace de gabarit', () => {
  // Les 2 px de l'annotation valent face à un libellé, qui ne se clique pas. Face à un bouton, ce
  // sont deux cibles bord à bord, et c'est la règle « button.i + button.i » (7.29.0) un cran plus
  // large : deux objets cliquables collés se lisent comme un seul.
  const css = lireSource('src', 'renderer', 'style.css');
  assert.ok(/^\.btn \+ button\.i \{ margin-inline-start: \d+px; \}$/m.test(css),
    'une bulle posée après un bouton doit porter son propre écart dans la feuille PARTAGÉE');
  const app = cabApp();
  assert.ok(/const hors = c\.horsTotal \? `<span class="muted small dc-hors"/.test(app),
    'la mention « hors total » ne se sépare pas du bouton par une espace de gabarit (3,6 px, décidés par personne)');
  const cab = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/^\.dc-hors \{ margin-inline-start: \d+px; \}$/m.test(cab), '.dc-hors doit exister dans la feuille');
});

// T-50 (9.8.8-beta.3) — le brouillard et la recherche affichaient « 2026-03-04 » sous une grille
// qui écrit « 04/03/2026 ». Le format interne ne fuit pas dans un écran (9.4.5).
t('T-50 : aucune cellule de tableau du Cabinet n\'affiche une date brute', () => {
  const app = cabApp();
  // Un contrôle de FORME assumé, parce que la faute EST une forme : une cellule qui interpole une
  // date sans passer par `fmtJour`. Les `value=` des champs de saisie ne sont pas concernés — là,
  // le format est annoncé par le placeholder.
  const fautes = [];
  const re = /<td[^>]*>\$\{([^}]*\.date[^}]*)\}/g;
  let m;
  while ((m = re.exec(app))) {
    if (!/fmtJour|moisLabel/.test(m[1])) fautes.push(m[1].slice(0, 60));
  }
  assert.deepStrictEqual(fautes, [], 'des cellules affichent une date au format interne : ' + fautes.join(' · '));
  // Et les deux écrans qui l'avaient le font bien, maintenant.
  assert.ok(/<td class="nw">\$\{esc\(fmtJour\(e\.date\)\)\}<\/td><td>\$\{esc\(e\.journal\)\}/.test(app), 'le brouillard doit dater en français');
});

// T-51 (9.8.8-beta.3) — « Valider cette écriture ? AC — » : une pièce sans référence NI libellé se
// validait, prenait un numéro et devenait définitive sans que rien ne dise ce qu'elle enregistre.
t('T-51 : la validation exige un libellé, le brouillard non, et la référence se montre sans être exigée', () => {
  const K = require('../../src/renderer/compta.js');
  const piece = {
    date: '2026-03-04', journal: 'AC', piece: '', libelle: '',
    lignes: [{ compte: '606', debit: 100 }, { compte: '401', credit: 100 }]
  };
  // Le brouillard accepte tout : c'est sa raison d'être, on y revient avant de valider.
  assert.strictEqual(K.ecritureValide(piece, []).ok, true, 'un brouillard anonyme doit pouvoir s\'enregistrer');
  const v = K.ecritureValide(piece, [], { valider: true });
  assert.strictEqual(v.ok, false, 'une écriture que rien ne nomme ne peut pas devenir définitive');
  assert.ok(/libellé/i.test(v.motif), 'le refus doit NOMMER le champ qui manque : ' + v.motif);
  // Le libellé peut vivre sur la pièce OU sur chaque ligne : `lignesDuLivre` affiche
  // `l.libelle || e.libelle`, donc ce qu'on refuse est une ligne que RIEN ne nomme.
  assert.strictEqual(K.ecritureValide({ ...piece, libelle: 'Achat de fournitures' }, [], { valider: true }).ok, true);
  const parLigne = { ...piece, lignes: piece.lignes.map(l => ({ ...l, libelle: 'Fournitures' })) };
  assert.strictEqual(K.ecritureValide(parLigne, [], { valider: true }).ok, true, 'des lignes toutes nommées suffisent');
  const moitie = { ...piece, lignes: [{ ...piece.lignes[0], libelle: 'Fournitures' }, piece.lignes[1]] };
  assert.strictEqual(K.ecritureValide(moitie, [], { valider: true }).ok, false, 'une ligne anonyme sur deux ne suffit pas');
  // La RÉFÉRENCE de pièce, elle, n'est jamais exigée (règle 9.1.1) : savoir si un cabinet l'impose
  // est une règle d'organisation que personne n'a confirmée.
  assert.strictEqual(K.ecritureValide({ ...piece, libelle: 'Achat', piece: '' }, [], { valider: true }).ok, true,
    'la référence de pièce ne doit pas bloquer une validation');

  // Le MOTEUR refuse, pas seulement l'écran : le pont passe par là.
  const L = K.livreVide('D', 2026);
  const anonyme = K.ajouterEcriture(L, piece, 'p', 1);
  const r = K.validerEcriture(L, anonyme.id, 'p', 2);
  assert.strictEqual(r.ok, false, 'le moteur doit refuser de valider une écriture anonyme');
  assert.strictEqual(L.ecritures.find(e => e.id === anonyme.id).numero, null, 'un refus ne consomme pas de numéro');

  const app = cabApp();
  // La fenêtre NOMME ce qu'elle valide, et dit ce qui manque au lieu d'un tiret.
  const fen = tranche(app, "confirmDialog('Valider cette écriture ?'", '</p>', 60, 500);
  assert.ok(/sans référence/.test(app.slice(app.indexOf('const quoi = ['), app.indexOf('const quoi = [') + 220)),
    'la fenêtre doit écrire « sans référence » au lieu d\'un vide');
  assert.ok(/\$\{quoi\}/.test(fen), 'la fenêtre doit afficher la pièce nommée');
  // Le geste DEMANDÉ décide du contrôle : valider exige plus que le brouillard.
  assert.ok(/puisValider \? \{ valider: true \} : null/.test(app),
    'l\'enregistrement doit juger selon le geste demandé, sinon le pont refuse APRÈS avoir enregistré');
});

// T-51 bis — un refus de validation à l'import ne s'avale pas : le mois paraîtrait classé.
t('T-51 bis : une pièce qu\'un import définitif n\'a pas pu valider est NOMMÉE', () => {
  const K = require('../../src/renderer/compta.js');
  const L = K.livreVide('D', 2026);
  const r = K.importerPaquet(L, '2026-03', [
    { date: '2026-03-01', journal: 'VT', piece: 'F1', libelle: 'Vente', lignes: [{ compte: '411', debit: 10 }, { compte: '706', credit: 10 }] },
    { date: '2026-03-02', journal: 'VT', piece: 'F2', libelle: '', lignes: [{ compte: '411', debit: 10 }, { compte: '706', credit: 10 }] }
  ], true, 'import', 100);
  assert.strictEqual(r.ajoutees, 2);
  assert.strictEqual(r.validees, 1, 'la pièce anonyme ne doit pas devenir définitive');
  assert.strictEqual(r.nonValidees.length, 1, 'et le refus ne s\'avale pas en silence');
  assert.strictEqual(r.nonValidees[0].piece, 'F2');
  assert.ok(r.nonValidees[0].motif, 'la pièce refusée porte son motif');
  assert.strictEqual(L.ecritures.find(e => e.piece === 'F2').statut, 'brouillard');
  // Et le compte rendu de l'écran le dit.
  const app = cabApp();
  assert.ok(/r\.nonValidees/.test(app), 'le compte rendu de relecture doit nommer les pièces restées en brouillard');
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'), 'ipcMain.handle(');
  assert.ok(/nonValidees/.test(main), 'le bilan de relecture doit remonter les non validées');
});

// T-54 (9.8.8-beta.3) — « 1 écriture trouvée sur 49 écritures » répétait le mot des deux côtés.
t('T-54 : le compteur de recherche ne répète pas le mot des deux côtés du « sur »', () => {
  const app = cabApp();
  const z = tranche(app, "pl(trouvees.length, 'écriture trouvée'", '</div>', 40, 300);
  assert.ok(/sur \$\{total\}/.test(z), 'le total se lit en chiffres : « n sur N »');
  assert.ok(!/sur \$\{pl\(total/.test(z), 'le mot « écritures » ne se répète pas après le « sur »');
});
};
