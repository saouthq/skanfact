'use strict';
// ============================================================================================
// La saturation (10.14.0) : les deux applications ouvertes sur des données qu'aucun exemple ne
// porte — huit mille pièces, mille cinq cents clients, un livre de douze mille écritures, trois
// cents dossiers. Rien n'y était faux ; tout y était LENT ou INTERMINABLE, et une interface qui ne
// répond plus pendant douze secondes se fait recharger par le chien de garde. Ces tests tiennent
// ce qui a été corrigé : les calculs qui lisent tout se font dans un « lot », les listes qu'on
// nomme se paginent, un livre se parcourt par un index, et un compte de milliers se lit groupé.
module.exports = ({ t, assert, lireSource }) => {
const core = require('../../src/renderer/core.js');
const demo = require('../../src/renderer/demo.js');
const KC = require('../../src/renderer/compta.js');
const K = require('../../src/cabinet/cabcore.js');
const vm = require('vm');

const CO = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', matricule: '1234567A', stampFee: 1 };
const code = (...p) => lireSource(...p).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const corpsDe = (src, debut) => {
  const i = src.indexOf(debut);
  assert.ok(i >= 0, 'introuvable : ' + debut);
  const j = src.indexOf('\n  }\n', i);
  return src.slice(i, j > i ? j : undefined);
};

// ---------------------------------------------------------------- le lot de calcul (core.js)
t('saturation : un calcul fait DANS un lot rend exactement ce qu\'il rend hors du lot', () => {
  const data = core.migrateData(demo.buildDemoData(CO, '2026-09-24'));
  const factures = data.documents.filter(d => d.type === 'facture' && d.id);
  const devis = data.documents.filter(d => d.type === 'devis' && d.id);
  // Un avoir encore en BROUILLON ne corrige rien : l'index du lot doit l'écarter comme le calcul.
  data.documents.push({ id: 'AVO-BR', type: 'avoir', status: 'brouillon', creditOf: factures[0].id, date: '2026-09-01', lines: [] });
  const suivis = (data.catalog || []).filter(i => i.tracked).map(i => i.id);
  assert.ok(factures.length && devis.length && suivis.length, 'l\'exemple doit porter factures, devis et articles suivis');
  const hors = {
    avoirs: factures.map(f => core.creditsFor(data, f.id).map(a => a.id)),
    devis: devis.map(q => core.facturesDuDevis ? core.facturesDuDevis(data, q.id).map(x => x.id) : []),
    stock: suivis.map(id => core.stockMovements(data, id))
  };
  const dans = core.enLot(() => ({
    avoirs: factures.map(f => core.creditsFor(data, f.id).map(a => a.id)),
    devis: devis.map(q => core.facturesDuDevis ? core.facturesDuDevis(data, q.id).map(x => x.id) : []),
    stock: suivis.map(id => core.stockMovements(data, id))
  }));
  // Des données qui discriminent (10.0.0) : sans avoir ni facture de devis, l'égalité serait celle
  // de deux listes vides — et un index faux passerait.
  assert.ok(hors.avoirs.some(a => a.length), 'aucune facture de l\'échantillon n\'a d\'avoir : le test ne prouve rien');
  assert.ok(hors.devis.some(a => a.length), 'aucun devis de l\'échantillon n\'est facturé : le test ne prouve rien');
  assert.ok(hors.stock.every(m => m.length), 'un article suivi sans mouvement : le test ne prouve rien');
  assert.deepStrictEqual(dans, hors, 'un index du lot change un résultat');
});

t('saturation : ce que rend un lot est une COPIE — la modifier ne fausse pas le calcul suivant', () => {
  const data = core.migrateData(demo.buildDemoData(CO, '2026-09-24'));
  const id = ((data.catalog || []).find(i => i.tracked) || {}).id;
  core.enLot(() => {
    const a = core.stockMovements(data, id);
    assert.ok(a.length, 'l\'article suivi doit avoir des mouvements');
    const qte = a[0].qty;
    a[0].qty = 999999; a.length = 0;
    const b = core.stockMovements(data, id);
    assert.ok(b.length && b[0].qty === qte, 'le lot rend son tableau partagé : un appelant qui le trie ou le vide fausse les suivants');
    const e1 = core.journalEntries(data, CO, { from: '2026-01-01', to: '2026-12-31' });
    const n = e1.length, d0 = e1[0].debit; e1[0].debit = -1; e1.length = 0;
    const e2 = core.journalEntries(data, CO, { from: '2026-01-01', to: '2026-12-31' });
    assert.ok(e2.length === n && e2[0].debit === d0, 'le livre du lot se laisse abîmer par un appelant');
  });
});

t('saturation : un lot ne survit pas à son calcul — une pièce ajoutée après se voit', () => {
  const data = core.migrateData(demo.buildDemoData(CO, '2026-09-24'));
  const f = data.documents.find(d => d.type === 'facture' && d.status !== 'brouillon' && d.id);
  const avant = core.enLot(() => core.creditsFor(data, f.id).length);
  data.documents.push({ id: 'AVO-TEST', type: 'avoir', status: 'émis', creditOf: f.id, number: 'AVO-9999-001', date: '2026-09-01', lines: [] });
  assert.strictEqual(core.creditsFor(data, f.id).length, avant + 1, 'l\'index du lot a survécu au lot');
  assert.strictEqual(core.enLot(() => core.creditsFor(data, f.id).length), avant + 1, 'un nouveau lot doit relire les pièces');
});

t('saturation : les agrégats lourds s\'exécutent dans un lot, et l\'interface dessine dans un lot', () => {
  const src = code('src', 'renderer', 'core.js');
  const liste = /\[('overdueInvoices'[^\]]*)\]\s*\.forEach\(n => \{/.exec(src);
  assert.ok(liste, 'la liste des calculs enveloppés dans un lot a disparu');
  ['overdueInvoices', 'todoList', 'journalEntries', 'stockAlerts', 'balanceGenerale', 'packPlan'].forEach(n =>
    assert.ok(liste[1].includes(`'${n}'`), n + ' se calcule hors d\'un lot : l\'index est refait à chaque pièce'));
  const app = code('src', 'renderer', 'app.js');
  assert.ok(/function render\(keepScroll\) \{\s*return C\.enLot\(/.test(app), 'render() ne dessine plus dans un lot');
  const draws = [...app.matchAll(/const draw = ([^\n]{0,40})/g)].map(m => m[1]);
  assert.ok(draws.length >= 15, 'trop peu de listes trouvées : ' + draws.length);
  draws.forEach(d => assert.ok(/^dansUnLot\(/.test(d), 'une liste se redessine hors d\'un lot : ' + d));
});

t('saturation : « Me guider » trouve l\'objet le plus rempli en UN passage, pas par un tri', () => {
  const app = code('src', 'renderer', 'app.js');
  const i = app.indexOf('const plusRempli = ');
  // Bornée sur la ligne qui cherche le client (10.14.1) : une fenêtre de 2 500 caractères en dur est
  // tombée quand « la pièce ouverte d'abord » (S-03) s'est insérée entre les deux (9.4.6 : jamais sur
  // un décalage en dur).
  const fin = app.indexOf("case 'client':", i);
  assert.ok(i > 0 && fin > i && fin - i < 8000, 'tranche introuvable ou trop large : ' + (fin - i));
  const z = app.slice(i, app.indexOf('\n', fin));
  assert.ok(i > 0 && !/\.sort\(/.test(z.slice(0, z.indexOf('const parCle'))), 'plusRempli trie encore toute la liste');
  assert.ok(/const parCle = /.test(z) && /parCle\(docs, 'clientId'\)/.test(z), 'le compte par client se refait pour chaque client');
});

// ---------------------------------------------------------------- les listes qu'on NOMME se paginent
t('saturation : l\'app entreprise pagine les tableaux secondaires, et nomme « devis » sans s', () => {
  const app = code('src', 'renderer', 'app.js');
  ['relPages.reportees', 'relPages.bientot', 'relPages.devis'].forEach(p =>
    assert.ok(app.includes(`paginate(${p.includes('reportees') ? 'later' : p.includes('bientot') ? 'soon' : 'quotes'}, ${p})`), p + ' : tableau des Relances non paginé'));
  assert.ok(/pagerBar\(quotesPage\.pg, \{ noun: 'devis', pluriel: 'devis' \}\)/.test(app), '« 443 deviss »');
  const pb = corpsDe(app, 'function pagerBar(');
  assert.ok(/opts\.pluriel \|\| noun \+ 's'/.test(pb), 'pagerBar ne connaît pas les pluriels irréguliers');
  ['rsPage', 'pageEtat', 'invPage', 'alPage', 'prevPage'].forEach(n => assert.ok(new RegExp(`const ${n} = `).test(app), n + ' : un tableau secondaire affiché d\'un bloc'));
});

t('saturation : l\'axe d\'un graphique dit k, M et Md', () => {
  const app = lireSource('src', 'renderer', 'app.js');
  const m = /const short = (n => \{[\s\S]*?\n  \});/.exec(app);
  assert.ok(m, 'short() introuvable');
  const short = vm.runInNewContext(m[1]);
  assert.strictEqual(short(950), '950');
  assert.strictEqual(short(1500), '1,5 k');
  assert.strictEqual(short(25000), '25 k');
  assert.strictEqual(short(1500000), '1,5 M');
  assert.strictEqual(short(746977499), '747 M', '« 746977 k » sur l\'axe d\'une entreprise saturée');
  assert.strictEqual(short(2e9), '2 Md');
});

t('saturation : le Cabinet pagine la Production, le brouillard, les Relances, et replie le lettrage', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const prod = corpsDe(app, 'async function drawProduction(');
  assert.ok(/pagerBar\(lignes\.length, prodState\.pg, 'dossier'\)/.test(prod) && /montrees\.map\(l =>/.test(prod), 'la Production affiche tous les dossiers d\'un bloc');
  assert.ok(/bindPager\(view, \(\) => render\(\), prodState\.pg\)/.test(prod), 'la Production dessine un pager sans le brancher');
  const sa = corpsDe(app, 'function vueSaisie(');
  assert.ok(/pagerBar\(brouillards\.length, s, 'pièce'\)/.test(sa) && /brouillardsPage\.map\(e =>/.test(sa), 'le brouillard s\'affiche d\'un bloc sous la grille');
  assert.ok(/lotsDuBrouillard\(brouillards\)/.test(sa), 'les lots doivent porter sur TOUT le brouillard, pas sur la page');
  const bs = corpsDe(app, 'function brancherSaisie(');
  assert.ok(/bindPager\(el, \(\) => drawLivres\(root, dossier\), s\)/.test(bs), 'le pager du brouillard n\'est pas branché');
  const rel = corpsDe(app, 'function drawRelances(');
  assert.ok(/pagerBar\(rows\.length, relState\.pg, 'client'\)/.test(rel) && /rowsPage\.map\(r =>/.test(rel), 'les Relances affichent tout le monde d\'un bloc');
  assert.ok(/groupRelance\(\(coches\.length \? coches : rows\)/.test(rel), 'le geste de groupe porte sur la page au lieu de la sélection');
  const lt = corpsDe(app, 'function vueLettrage(');
  assert.ok(/<details class="panel mt gl-compte lt-tiers"/.test(lt), 'un tiers du lettrage n\'est plus replié sur sa ligne');
  assert.ok(/Reste \$\{esc\(money\(r\.reste\)\)\}/.test(lt), 'la ligne repliée d\'un tiers ne dit pas ce qui reste dû');
});

t('saturation : « personne à relancer » ne dit pas « à jour » de clients qui n\'envoient rien', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const rel = corpsDe(app, 'function drawRelances(');
  assert.ok(!/tous tes dossiers sont à jour/.test(rel), '« tous tes dossiers sont à jour » sur trois cents clients hors SkanFact');
  assert.ok(/r\.level !== 'hors'/.test(rel), 'la phrase ne distingue pas ceux qui envoient leurs paquets');
});

// ---------------------------------------------------------------- un livre se parcourt par un index
t('saturation : valider un lot ne relit pas le livre pour chaque pièce', () => {
  const livre = KC.livreVide('D1', 2026);
  const N = 20000;
  for (let n = 0; n < N; n++) {
    KC.ajouterEcriture(livre, { date: '2026-03-0' + (1 + n % 9), journal: 'VT', piece: 'F' + n, libelle: 'Vente ' + n,
      lignes: [{ compte: '411', debit: 10 }, { compte: '706', credit: 10 }] }, 'test', 1);
  }
  // Une pièce déjà validée avant le lot : la numérotation continue APRÈS elle.
  KC.validerEcriture(livre, livre.ecritures[5].id, 'test', 1);
  const t0 = Date.now();
  const r = KC.validerLot(livre, { journal: 'VT' }, 'test', 2);
  const ms = Date.now() - t0;
  assert.strictEqual(r.validees.length, N - 1);
  const nums = livre.ecritures.map(e => e.numero).sort((a, b) => a - b);
  nums.forEach((n, i) => assert.strictEqual(n, i + 1, 'la numérotation a un trou ou un doublon'));
  // Quadratique, ce lot prenait plus de six secondes ; linéaire, une centaine de millisecondes.
  assert.ok(ms < 2000, `valider ${N} pièces a pris ${ms} ms : chaque validation relit le livre`);
  // La sélection par identifiants passe aussi par un ensemble.
  const lv = KC.livreVide('D2', 2026);
  const ids = [];
  for (let n = 0; n < 3; n++) ids.push(KC.ajouterEcriture(lv, { date: '2026-01-02', journal: 'OD', piece: 'P' + n, libelle: 'x', lignes: [{ compte: '411', debit: 1 }, { compte: '706', credit: 1 }] }, 't', 1).id);
  const r2 = KC.validerLot(lv, { ids: [ids[0], ids[2]] }, 't', 1);
  assert.deepStrictEqual(r2.validees.map(v => v.id), [ids[0], ids[2]]);
});

t('saturation : les menus de ligne du Cabinet trouvent l\'écriture par un index, jamais par un parcours', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/const INDEX_LIVRE = new WeakMap\(\)/.test(app) && /function indexDuLivre\(livre\)/.test(app), 'l\'index du livre a disparu');
  assert.ok(!/\.ecritures(?: \|\| \[\]\))?\.find\(x => x\.id === (?:id|r\.ecritureId|String\(cle\)\.slice\(2\))\)/.test(app),
    'un menu de ligne cherche encore son écriture dans tout le livre');
  assert.ok(!/\.some\(x => x\.extourneDe === e\.id\)/.test(app), '« déjà extournée » se cherche encore dans tout le livre, ligne par ligne');
});

// ---------------------------------------------------------------- la licence se dit avant la question
t('saturation : un refus de licence se dit AVANT la question de validation, jamais après', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  [['async function validerEcriture(', 'Valider une écriture'],
    ['async function contrepasserEcriture(', 'Contre-passer une écriture'],
    ['async function extournerEcriture(', 'Extourner une écriture'],
    ['async function validerUnLot(', "Valider un lot d\\'écritures"]].forEach(([f, quoi]) => {
    const z = corpsDe(app, f);
    const r = z.indexOf(`refusLicence('${quoi}')`), q = z.indexOf('confirmDialog(');
    assert.ok(r > 0 && q > 0 && r < q, f + ' : la licence se vérifie après la question (ou pas du tout)');
  });
  const i = app.indexOf("const clo = $('#cl-cloturer', el);");
  const z = app.slice(i, i + 1500);
  assert.ok(z.indexOf("refusLicence('Clôturer un exercice')") > 0 && z.indexOf("refusLicence('Clôturer un exercice')") < z.indexOf('confirmDialog('), 'la clôture demande avant de vérifier la licence');
  const main = code('src', 'cabinet', 'main.js');
  const h = main.slice(main.indexOf("ipcMain.handle('licence:verifier'"));
  assert.ok(/licenceBlockCab\(/.test(h.slice(0, 300)), 'la vérification ne passe pas par la porte unique : sa phrase divergerait');
  // Les libellés sont ceux de la porte, au caractère près : une seconde phrase aurait divergé.
  ["'Valider une écriture'", "'Contre-passer une écriture'", "'Extourner une écriture'", "'Clôturer un exercice'"].forEach(q =>
    assert.ok(main.includes('licenceBlockCab(' + q + ')'), q + ' : la question et la porte ne nomment pas le même geste'));
});

// ---------------------------------------------------------------- les noms et les nombres
t('saturation : un nom se trie comme on le lit (« Café 3 » avant « Café 13 »)', () => {
  assert.deepStrictEqual(['Café 13', 'Café 3', 'café 8'].sort(K.parNom), ['Café 3', 'café 8', 'Café 13']);
  assert.ok(core.compareValues('Client 3', 'Client 13') < 0, 'les listes de l\'app entreprise trient encore « 13 » avant « 3 »');
  const S = { dossiers: ['Café 13', 'Café 3', 'Café 8'].map((n, i) => ({ id: 'd' + i, name: n, manual: true, packs: [] })) };
  const noms = K.dossierList(S, '2026-09-25', { sort: 'nom' }).map(r => r.name);
  assert.deepStrictEqual(noms, ['Café 3', 'Café 8', 'Café 13'], 'le portefeuille trie ses dossiers « 13, 3, 8 »');
});

t('saturation : un compte de milliers se lit groupé, dans les cinq jumeaux de pl()', () => {
  const corps = [];
  for (const [f, re] of [[['src', 'renderer', 'app.js'], /const pl = \(n, un, plur\) => (`[^`]*`);/],
    [['src', 'cabinet', 'renderer', 'app.js'], /const pl = \(n, un, plur\) => (`[^`]*`);/],
    [['src', 'renderer', 'core.js'], /const plFr = \(n, un, plur\) => (`[^`]*`);/],
    [['src', 'renderer', 'compta.js'], /const plFr = \(n, un, plur\) => (`[^`]*`);/],
    [['src', 'cabinet', 'cabcore.js'], /const pl = \(n, un, plur\) => (`[^`]*`);/]]) {
    const m = re.exec(lireSource(...f));
    assert.ok(m, 'accord introuvable : ' + f.join('/'));
    corps.push(m[1]);
  }
  assert.ok(corps.every(c => c === corps[0]), 'les cinq accords ont divergé');
  const pl = vm.runInNewContext('(n, un, plur) => ' + corps[0]);
  assert.strictEqual(pl(3526, 'pièce'), '3 526 pièces', '« 3526 pièces » : un compte de milliers se lit mal');
  assert.strictEqual(pl(999, 'pièce'), '999 pièces');
  assert.strictEqual(pl(1, 'pièce'), '1 pièce');
  assert.strictEqual(K.libelleLot({ n: 3526, label: 'BQ' }), 'Valider les 3 526 pièces de BQ');
  assert.strictEqual(K.nbFr(12000), '12 000');
});
};
