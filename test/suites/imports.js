'use strict';
// ============================================================================================
// Les imports de tableur, tels qu'un comptable les reçoit (10.14.1, IMP-01)
//
// Trouvé à la souris, en important un relevé BIAT enregistré par Excel : la banque écrit son nom,
// le titulaire et la période AU-DESSUS du tableau, une ligne « Solde au 31/10/2026 » dessous — et
// l'import ne reconnaissait plus aucune colonne. Le sélecteur de fichier ne proposait même pas un
// .xlsx, le format que la banque, la paie et le confrère envoient neuf fois sur dix. Ce que ces
// tests tiennent : la ligne des TITRES se cherche, une ligne de solde ou de total n'est jamais un
// mouvement, les soldes que la banque écrit sont LUS, et un classeur Excel se lit comme un CSV.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');
const Z = require('../../src/zip.js');

// Le relevé du test humain, tel qu'Excel l'écrit (point-virgule, une présentation au-dessus).
const BIAT = [
  'BANQUE INTERNATIONALE ARABE DE TUNISIE;;;;',
  'Relevé de compte courant;;;;',
  'Titulaire : Garage Ezzahra SUARL;;;;',
  'Compte n° 08 006 0123456789012 34;;;;',
  'Période du 01/10/2026 au 31/10/2026;;;;',
  ';;;;',
  'Date opération;Libellé;Date valeur;Débit;Crédit',
  '02/10/2026;VIR RECU CLIENT FACTURE 012;02/10/2026;;1 250,000',
  '05/10/2026;PRLV STEG FACTURE 2026-09;05/10/2026;214,500;',
  '12/10/2026;CHQ 4521 FOURNISSEUR PIECES;12/10/2026;1 830,750;',
  '15/10/2026;VERSEMENT ESPECES;15/10/2026;;600,000',
  '31/10/2026;FRAIS TENUE DE COMPTE;31/10/2026;12,000;',
  '31/10/2026;VIR SALAIRE OCTOBRE;31/10/2026;900,000;',
  'Solde au 31/10/2026;;;;'
].join('\r\n');

t('IMP-01 : un relevé avec la présentation de la banque au-dessus se lit — la ligne des titres se CHERCHE', () => {
  const r = K.releveDepuisCsv(K.rangeesDeTexte(BIAT));
  assert.strictEqual(r.motif, '', 'le relevé BIAT est refusé : ' + r.motif);
  assert.strictEqual(r.ligneTitres, 7, 'la ligne des titres est la 7e du tableur');
  assert.deepStrictEqual(r.lignes.map(l => l.montant), [1250, -214.5, -1830.75, 600, -12, -900], 'les six mouvements, au signe de la banque');
  assert.strictEqual(r.lignes[0].date, '2026-10-02');
  // « Solde au 31/10/2026 » sans montant : ni un mouvement, ni une ligne à signaler.
  assert.strictEqual(r.ignorees.length, 0, 'une ligne de solde vide est comptée comme ignorée : ' + JSON.stringify(r.ignorees));
  assert.deepStrictEqual(r.soldes, { debut: null, fin: null }, 'un solde sans montant ne s\'invente pas');
});

t('IMP-01 : les soldes que la banque écrit sont LUS, et un total n\'est ni un mouvement ni un solde', () => {
  const csv = [
    'Relevé BNA;;;',
    'Solde initial au 30/09/2026;;;5 000,000',
    'Date;Libellé;Débit;Crédit',
    '02/10/2026;VIR RECU;;1 250,000',
    '05/10/2026;SOLDE FACTURE 123 FOURNISSEUR;300,000;',
    'Total des mouvements;;300,000;1 250,000',
    'Nouveau solde;;;5 950,000'
  ].join('\n');
  const r = K.releveDepuisCsv(K.rangeesDeTexte(csv));
  assert.strictEqual(r.motif, '');
  // « SOLDE FACTURE 123 » est un règlement qui SOLDE une facture : un vrai mouvement.
  assert.deepStrictEqual(r.lignes.map(l => l.montant), [1250, -300], 'le total est compté comme un mouvement, ou le règlement d\'une facture est jeté');
  assert.strictEqual(r.totaux, 1, 'la ligne de total n\'est pas reconnue');
  assert.deepStrictEqual(r.soldes, { debut: 5000, fin: 5950 }, 'les soldes du relevé ne sont pas lus');
  // Un solde débiteur écrit dans la colonne Débit est un découvert : négatif pour la banque.
  const dec = K.releveDepuisCsv(K.rangeesDeTexte('Date;Libellé;Débit;Crédit\n01/10/2026;Solde précédent;420,000;\n03/10/2026;VIR;;500,000\nSolde final;;;80,000'));
  assert.deepStrictEqual(dec.soldes, { debut: -420, fin: 80 }, 'un solde débiteur garde son sens');
  // Et le relevé BOUCLE avec ce qu'il a lu : c'est ce que la fenêtre va préremplir.
  assert.ok(K.releveValide({ compte: '532', lignes: r.lignes, soldeDebut: r.soldes.debut, soldeFin: r.soldes.fin }).ok);
});

t('IMP-01 : le séparateur se déduit — tabulation et virgule autant que point-virgule', () => {
  assert.strictEqual(K.separateurCsv('a;b;c\n1;2;3'), ';');
  assert.strictEqual(K.separateurCsv('Date\tLibellé\tMontant\n01/10/2026\tVIR\t10'), '\t');
  assert.strictEqual(K.separateurCsv('Date,Libelle,Montant\n2026-10-01,VIR,10.5'), ',');
  const r = K.releveDepuisCsv(K.rangeesDeTexte('Date\tLibellé\tMontant\n01/10/2026\tVIR RECU\t10,500'));
  assert.deepStrictEqual(r.lignes.map(l => l.montant), [10.5]);
});

t('IMP-01 : plan et balance de reprise trouvent leurs titres sous une présentation, et sautent le total', () => {
  const plan = K.planDepuisCsv(K.rangeesDeTexte('Plan comptable — Garage;;\n;;\nCompte;Intitulé\n411;Clients\n606;Achats non stockés\nTotal;'));
  assert.deepStrictEqual(plan.comptes.map(c => c.compte), ['411', '606'], 'le plan a lu la présentation ou le total : ' + JSON.stringify(plan));
  const bal = K.balanceDepuisCsv(K.rangeesDeTexte('Balance au 31/12/2025;;;\nCompte;Intitulé;Débit;Crédit\n532;Banque;1 000,000;\n101;Capital;;1 000,000\nTotaux;;1 000,000;1 000,000'));
  assert.deepStrictEqual(bal.lignes.map(l => l.compte), ['532', '101'], 'la balance a lu la présentation ou la ligne de totaux');
});

// Un vrai classeur, fabriqué comme Excel le fait : des textes partagés, une DATE (un nombre et un
// style), une cellule vide absente, une rangée vide absente.
function classeur() {
  const wb = '<?xml version="1.0"?><workbook xmlns:r="r"><sheets><sheet name="Relevé" sheetId="1" r:id="rId3"/></sheets></workbook>';
  const rels = '<Relationships><Relationship Id="rId3" Type="ws" Target="worksheets/feuille.xml"/></Relationships>';
  const ss = '<sst><si><t>BIAT</t></si><si><t>Date</t></si><si><t>Libellé</t></si><si><t>Débit</t></si><si><t>Crédit</t></si><si><r><t>VIR RECU </t></r><r><t>CLIENT &amp; FILS</t></r></si><si><t>PRLV STEG</t></si></sst>';
  const styles = '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="4"/></cellXfs></styleSheet>';
  const feuille = '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
    '<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="s"><v>2</v></c><c r="C3" t="s"><v>3</v></c><c r="D3" t="s"><v>4</v></c></row>' +
    '<row r="4"><c r="A4" s="1"><v>46297</v></c><c r="B4" t="s"><v>5</v></c><c r="D4" s="2"><v>1250</v></c></row>' +
    '<row r="5"><c r="A5" s="1"><v>46300</v></c><c r="B5" t="s"><v>6</v></c><c r="C5" s="2"><v>214.5</v></c></row>' +
    '</sheetData></worksheet>';
  return Z.zipBuffer([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: 'xl/workbook.xml', data: wb }, { name: 'xl/_rels/workbook.xml.rels', data: rels },
    { name: 'xl/sharedStrings.xml', data: ss }, { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/feuille.xml', data: feuille }
  ]);
}

t('IMP-01 : un classeur Excel .xlsx se LIT — textes partagés, dates, cellules et rangées vides à leur place', () => {
  const r = K.lireFichierTexte(classeur(), 'releve.xlsx', { dezipper: Z.zipRead });
  assert.strictEqual(r.ok, true, r.motif);
  assert.strictEqual(r.classeur, true);
  const lignes = r.texte.split('\n');
  assert.strictEqual(lignes[1], '', 'la rangée vide (absente du fichier) a disparu : les numéros de ligne ne sont plus ceux du tableur');
  assert.strictEqual(lignes[3], '02/10/2026;VIR RECU CLIENT & FILS;;1250', 'une date lue comme un nombre, ou une cellule vide qui décale la colonne : ' + lignes[3]);
  const rel = K.releveDepuisCsv(K.rangeesDeTexte(r.texte));
  assert.strictEqual(rel.motif, '', rel.motif);
  assert.deepStrictEqual(rel.lignes.map(l => [l.date, l.montant]), [['2026-10-02', 1250], ['2026-10-05', -214.5]]);
  // Sans lecteur de ZIP, le même fichier se refuse avec le geste qui marche.
  const sans = K.lireFichierTexte(classeur(), 'releve.xlsx');
  assert.strictEqual(sans.ok, false);
  assert.ok(/Enregistrer sous/.test(sans.motif));
  // Un classeur LibreOffice se nomme.
  const ods = Z.zipBuffer([{ name: 'mimetype', data: 'application/vnd.oasis.opendocument.spreadsheet' }, { name: 'content.xml', data: '<x/>' }]);
  assert.ok(/LibreOffice \(\.ods\)/.test(K.lireFichierTexte(ods, 'a.ods', { dezipper: Z.zipRead }).motif));
  // Le système 1904 (anciens classeurs Mac) décale l'origine.
  const t1904 = K.texteDeClasseur(n => ({ 'xl/workbook.xml': '<workbook><workbookPr date1904="1"/></workbook>',
    'xl/worksheets/sheet1.xml': '<row r="1"><c r="A1" s="1"><v>0</v></c></row>', 'xl/styles.xml': '<cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs>' }[n] || null));
  assert.strictEqual(t1904.texte, '01/01/1904');
});

t('IMP-01 : les deux applications ouvrent un .xlsx, et le relevé passe par le même lecteur que les autres imports', () => {
  const cab = lireSource('src', 'cabinet', 'main.js');
  assert.ok(/KC\.lireFichierTexte\(fs\.readFileSync\(chemin\), path\.basename\(chemin\), \{ dezipper: Z\.zipRead \}\)/.test(cab), 'le Cabinet ne sait pas ouvrir un classeur');
  assert.ok(/const FILTRE_TABLEUR = \[\{[^\]]*'xlsx'/.test(cab), 'le sélecteur du Cabinet ne propose pas les .xlsx');
  const releve = cab.slice(cab.indexOf("ipcMain.handle('cab:lireReleve'"), cab.indexOf("ipcMain.handle('cab:ajouterReleve'"));
  assert.ok(releve.length > 200 && releve.length < 3000);
  assert.ok(/KC\.releveDepuisCsv\(lireCsvFichier\(/.test(releve), 'le relevé est encore lu en UTF-8 et en point-virgule seulement');
  assert.ok(/filters: FILTRE_TABLEUR/.test(releve));
  ['cab:importerPlan', 'cab:importerBalance', 'cab:lireEcrituresTableur'].forEach(h => {
    const tr = cab.slice(cab.indexOf(`ipcMain.handle('${h}'`), cab.indexOf(`ipcMain.handle('${h}'`) + 500);
    assert.ok(/filters: FILTRE_TABLEUR/.test(tr), h + ' ne propose pas les .xlsx');
  });
  const ent = lireSource('src', 'main.js');
  const o = ent.slice(ent.indexOf("ipcMain.handle('file:openText'"), ent.indexOf("ipcMain.handle('shell:open'"));
  assert.ok(/extensions: \['xlsx'/.test(o), 'l\'app entreprise ne propose pas les .xlsx');
});
};
