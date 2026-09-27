'use strict';
// ============================================================================================
// Le fichier des écritures — FEC (10.15.0, H3 de l'étude Hesabi)
//
// Ce que ces tests tiennent :
//   • la forme de la norme : dix-huit colonnes dans leur ordre, une tabulation entre chacune,
//     aucune tabulation ni retour à la ligne DANS un champ, virgule décimale sans séparateur de
//     milliers, dates AAAAMMJJ ;
//   • ce qu'un logiciel qui l'importe refuserait n'est pas écrit : brouillard, pièce sans numéro,
//     pièce déséquilibrée — chacune nommée ;
//   • le fichier dit la même comptabilité que l'écran : chaque compte y porte le débit et le crédit
//     du livre-journal, les numéros vont 1..n sans trou ni retour en arrière ;
//   • le compte auxiliaire d'un client est celui que la balance auxiliaire connaît ;
//   • les deux applications passent par le MÊME constructeur.
module.exports = ({ t, assert, lireSource }) => {
const C = require('../../src/renderer/core.js');
const K = require('../../src/renderer/compta.js');
const D = require('../../src/renderer/demo.js');
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const COLS = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'];
const lire = texte => texte.split('\r\n').filter(Boolean).map(l => l.split('\t'));
const val = s => Number(String(s).replace(',', '.'));

t('FEC : dix-huit colonnes, dans l\'ordre de la norme, et des montants à la virgule', () => {
  assert.deepStrictEqual(K.FEC_COLONNES, COLS);
  assert.strictEqual(K.fecMontant(1234567.891), '1234567,891', 'aucun séparateur de milliers');
  assert.strictEqual(K.fecMontant(0), '0,000');
  assert.strictEqual(K.fecMontant(12.5, 2), '12,50', 'deux décimales pour une devise à centimes');
  assert.strictEqual(K.fecMontant(1.0005), '1,001', 'le demi-millime s\'arrondit vers le haut, jamais par toFixed');
  assert.strictEqual(K.fecMontant(-3.2, 3), '-3,200');
  assert.strictEqual(K.fecNom('1234567A/A/M/000', '2025-12-31'), '1234567AAM000FEC20251231.txt');
  assert.strictEqual(K.fecNom('', '2025-12-31'), 'SKANFACTFEC20251231.txt', 'sans matricule, un nom lisible quand même');
});

t('FEC : ce qu\'un logiciel refuserait n\'est pas écrit, et chaque refus nomme sa pièce', () => {
  const l = (o) => Object.assign({ date: '2026-03-04', journal: 'VT', piece: 'FAC-1', numero: 1, account: '411', label: 'x', debit: 0, credit: 0 }, o);
  const juste = [l({ debit: 119 }), l({ account: '706', credit: 100 }), l({ account: '4367', credit: 19 })];
  assert.strictEqual(K.fichierFec(juste).ok, true);
  const boiteuse = [l({ debit: 119 }), l({ account: '706', credit: 100 })];
  const r1 = K.fichierFec(boiteuse);
  assert.strictEqual(r1.ok, false); assert.strictEqual(r1.texte, undefined, 'aucun fichier tant qu\'une pièce ne tombe pas juste');
  assert.match(r1.refus[0].piece, /FAC-1/); assert.match(r1.refus[0].motif, /déséquilibrée/);
  const brouillard = juste.map(x => Object.assign({}, x, { ecritureId: 'e1', statut: 'brouillard', numero: 0 }));
  assert.match(K.fichierFec(brouillard).refus[0].motif, /brouillard/, 'un brouillard ne part pas');
  assert.strictEqual(K.fichierFec([]).vide, true);
});

t('FEC : un champ ne porte ni tabulation ni retour à la ligne, et une formule reçoit son apostrophe', () => {
  const l = (o) => Object.assign({ date: '2026-03-04', journal: 'OD', piece: 'OD-1', numero: 1, label: '', debit: 0, credit: 0 }, o);
  const r = K.fichierFec([l({ account: '606', label: 'Loyer\tmars\nbureau', debit: 50 }), l({ account: '532', label: '=HYPERLINK("x")', credit: 50 })]);
  const rangs = lire(r.texte);
  rangs.forEach(c => assert.strictEqual(c.length, 18, 'une ligne a dix-huit champs : ' + c.join('|')));
  assert.strictEqual(rangs[1][10], 'Loyer mars bureau');
  assert.strictEqual(rangs[2][10], '\'=HYPERLINK("x")', 'une cellule qu\'un tableur exécuterait est neutralisée (9.1.1)');
});

t('FEC : l\'exercice 2025 de l\'exemple — même comptabilité que le livre-journal, numéros sans trou', () => {
  const data = C.migrateData(D.buildDemoData(C.DEFAULT_COMPANY, '2026-09-27'));
  const p = { from: '2025-01-01', to: '2025-12-31' };
  const r = C.fecEntreprise(data, data.company, p);
  assert.strictEqual(r.ok, true, JSON.stringify(r.refus));
  assert.match(r.nom, /FEC20251231\.txt$/);
  const rangs = lire(r.texte);
  assert.deepStrictEqual(rangs[0], COLS, 'la première ligne nomme les colonnes');
  const corps = rangs.slice(1);
  assert.ok(corps.length > 500, 'l\'exemple porte une année pleine : ' + corps.length);
  corps.forEach(c => { assert.strictEqual(c.length, 18); assert.match(c[3], /^2025\d{4}$/); assert.match(c[11], /^\d+,\d{3}$/); assert.match(c[12], /^\d+,\d{3}$/); assert.match(c[15], /^\d{8}$/); });
  // Les numéros : 1..n, jamais en arrière dans l'ordre du fichier, et chaque pièce tombe juste.
  const nums = corps.map(c => Number(c[2]));
  nums.forEach((n, i) => { if (i) assert.ok(n >= nums[i - 1], 'un numéro revient en arrière : ' + nums[i - 1] + ' puis ' + n); });
  const distincts = [...new Set(nums)];
  assert.deepStrictEqual(distincts, distincts.map((_, i) => i + 1), 'un trou dans la numérotation');
  const parPiece = {};
  corps.forEach(c => { parPiece[c[2]] = C.round3((parPiece[c[2]] || 0) + val(c[11]) - val(c[12])); });
  Object.entries(parPiece).forEach(([n, s]) => assert.strictEqual(s, 0, 'la pièce ' + n + ' ne tombe pas juste'));
  // Chaque compte y porte le débit et le crédit du livre-journal de l'écran.
  const parCompte = {};
  corps.forEach(c => { const x = parCompte[c[4]] = parCompte[c[4]] || { d: 0, c: 0 }; x.d = C.round3(x.d + val(c[11])); x.c = C.round3(x.c + val(c[12])); });
  const ecran = C.entriesByAccount(C.livreJournal(data, data.company, p, {}));
  assert.strictEqual(Object.keys(parCompte).length, ecran.length);
  ecran.forEach(a => assert.deepStrictEqual(parCompte[a.account], { d: C.round3(a.debit), c: C.round3(a.credit) }, 'le compte ' + a.account));
});

t('FEC : le compte auxiliaire d\'un client est celui que la balance auxiliaire connaît', () => {
  const data = C.migrateData(D.buildDemoData(C.DEFAULT_COMPANY, '2026-09-27'));
  const r = C.fecEntreprise(data, data.company, { from: '2025-01-01', to: '2025-12-31' });
  const corps = lire(r.texte).slice(1);
  const codes = C.codesAuxiliaires(data.clients);
  const avecAux = corps.filter(c => c[6]);
  assert.ok(avecAux.length > 50, 'les lignes clients et fournisseurs portent leur auxiliaire');
  avecAux.forEach(c => { assert.ok(/^4[01]/.test(c[4]), 'un auxiliaire sur un compte qui n\'est pas un tiers : ' + c.join('|')); assert.ok(c[7], 'un auxiliaire sans nom'); });
  const client = data.clients.find(x => corps.some(c => c[7] === x.name && c[4] === '411'));
  assert.ok(client, 'un client de l\'exemple est dans le fichier');
  assert.ok(corps.filter(c => c[7] === client.name && c[4] === '411').every(c => c[6] === '411' + codes[client.id]), 'le code auxiliaire est celui de la fiche');
  assert.ok(corps.filter(c => /^(7|6|43)/.test(c[4])).every(c => !c[6] && !c[7]), 'une ligne de produit, de charge ou de TVA n\'a pas d\'auxiliaire');
});

t('FEC : les deux applications passent par le même constructeur, et le Cabinet n\'emporte que les validées', () => {
  const core = sansCommentaires(lireSource('src', 'renderer', 'core.js'));
  assert.match(core, /Compta\.fichierFec\(lignes, \{/, 'core.js recopie le constructeur au lieu de l\'appeler');
  assert.ok(!/function fichierFec\(/.test(core));
  const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
  assert.match(app, /\$\('#ecr-fec'\)\.onclick = async \(\) => \{\s*const r = C\.fecEntreprise\(data, company\(\), p\);/, 'l\'export ne porte pas la période entière de l\'écran');
  const cab = sansCommentaires(lireSource('src', 'cabinet', 'renderer', 'app.js'));
  const f = cab.slice(cab.indexOf('async function exporterFec('), cab.indexOf('async function exporterLivre('));
  assert.ok(f.length > 500 && f.length < 5000, 'tranche inattendue : ' + f.length);
  assert.match(f, /KC\.fichierFec\(toutes\.filter\(l => l\.statut !== 'brouillard'\)/, 'le Cabinet laisse partir des brouillards');
  assert.ok(f.indexOf('confirmDialog(') > 0 && f.indexOf('confirmDialog(') < f.indexOf('KC.fichierFec('), 'les brouillards laissés de côté se disent AVANT l\'export');
  assert.match(f, /valideeLe/, 'la date de validation n\'est pas celle du livre');
  const main = sansCommentaires(lireSource('src', 'cabinet', 'main.js'));
  const h = main.slice(main.indexOf("ipcMain.handle('cab:exportFec'"), main.indexOf("ipcMain.handle('cab:exportCsv'"));
  assert.ok(h.length > 100, 'le pont du fichier FEC manque');
  assert.ok(!/\\uFEFF|\uFEFF/i.test(h), 'un BOM devant « JournalCode » rendrait la première ligne méconnaissable');
  assert.match(h, /extensions: \['txt'\]/);
  assert.match(lireSource('src', 'cabinet', 'preload.js'), /exportFec: \(texte, nom\) => ipcRenderer\.invoke\('cab:exportFec'/);
});

t('FEC : dans le Cabinet, les exports d\'un livre vivent dans UN menu, et la question s\'accorde', () => {
  const cab = sansCommentaires(lireSource('src', 'cabinet', 'renderer', 'app.js'));
  // La barre : un menu « Exporter » à la place des boutons, sinon elle passe sur deux rangées.
  const b = cab.slice(cab.indexOf('const barreLivres = '), cab.indexOf('const fmtJour = '));
  assert.ok(b.length > 200 && b.length < 2500, 'tranche inattendue : ' + b.length);
  assert.match(b, /RowMenu\.bouton\('EXP', 'Exporter'/, 'les exports ne sont plus dans un menu');
  assert.ok(!/id="lv-fec"|id="lv-csv"/.test(b), 'un export posé en bouton à côté du menu refait la seconde rangée');
  // La table : la MÊME que celle des lignes de la vue, et le FEC seulement là où la barre le porte.
  const v = cab.slice(cab.indexOf('function brancherVue('), cab.indexOf('async function exporterFec('));
  const exp = v.slice(v.indexOf("if (cle === 'EXP')"), v.indexOf("if (cle === 'EXP')") + 900);
  assert.ok(v.indexOf("if (cle === 'EXP')") > 0, 'le menu Exporter n\'a pas d\'actions');
  assert.match(exp, /exporterLivre\(lignes\)/);
  assert.match(exp, /hasAttribute\('data-fec'\) \? \{[^}]*run: \(\) => exporterFec\(\)/, 'le FEC se propose hors du livre-journal');
  assert.strictEqual((v.match(/bindRowMenus\(el,/g) || []).length, 1, 'deux tables sur la même racine se mangent (9.4.8)');
  // L'accord : une seule pièce ne se dit pas « Des pièces », ni « Valide-les ».
  const f = cab.slice(cab.indexOf('async function exporterFec('), cab.indexOf('async function exporterLivre('));
  assert.match(f, /plus \? 'Des pièces en brouillard' : 'Une pièce en brouillard'/, 'le titre ne s\'accorde pas');
  assert.match(f, /plus \? 'Valide-les' : 'Valide-la'/, 'le verbe ne s\'accorde pas');
  // Un menu posé dans une barre a l'allure d'un bouton, pas d'un bouton éteint.
  const css = lireSource('src', 'renderer', 'style.css');
  const r = /^\.row-menu-btn\.btn \{([^}]*)\}/m.exec(css);
  assert.ok(r, 'un menu posé dans une barre garde le gris d\'un menu de ligne');
  assert.match(r[1], /color: var\(--text\)/);
  assert.match(r[1], /opacity: 1/);
});
};
