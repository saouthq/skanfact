'use strict';
// ============================================================================================
// Le fichier de télédéclaration CNSS du trimestre (10.14.1, DECL D2)
//
// Le format est celui du document « Trace d'enregistrement du support magnétique des
// télédéclarations de salaires (nouvelle version 2012) » : 122 caractères par salarié, 12 lignes
// par page, le salaire en millimes. Ce que ces tests tiennent : que chaque champ est à SA place et
// de SA longueur (les positions sont écrites ici à la main, depuis le document, jamais recopiées
// de la sortie), et qu'AUCUN fichier ne sort tant qu'une ligne est fausse — chaque refus nommant
// le salarié et la case à corriger.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');

// Les positions du document, champ par champ (début, longueur).
const CHAMPS = [
  ['employeur', 0, 8], ['cleEmployeur', 8, 2], ['code', 10, 4], ['trimestre', 14, 1], ['annee', 15, 4],
  ['page', 19, 3], ['ligne', 22, 2], ['assure', 24, 8], ['cleAssure', 32, 2], ['identite', 34, 60],
  ['cin', 94, 8], ['salaire', 102, 10], ['vierge', 112, 10]
];
const lire = rec => Object.fromEntries(CHAMPS.map(([k, d, n]) => [k, rec.slice(d, d + n)]));
const enregistrements = r => r.contenu.split('\r\n').slice(0, -1);
const ligne = (n, o) => Object.assign({ salarieId: 's' + n, nom: 'Salarié ' + n, identite: 'Prenom Pere Nom' + String.fromCharCode(65 + (n % 26)), cnss: '1234567' + (n % 10) + '-0' + (n % 10), cin: '0' + String(1000000 + n), salaire: 1000 }, o || {});

t('CNSS D2 : l\'exemple du document donne son nom de fichier, et chaque champ tombe à sa place', () => {
  const r = K.fichierCnss({
    employeur: '123456-72', code: '06', annee: 2010, trimestre: 1,
    lignes: [{ salarieId: 'a', nom: 'Sonia', identite: 'Sonia Mohamed Khélifi', cnss: '12345678-90', cin: '01234567', salaire: 3600.5 }]
  });
  assert.ok(r.ok, JSON.stringify(r.refus));
  assert.strictEqual(r.nom, 'DS00123456720006.12010', 'le nom de fichier de l\'exemple du document');
  assert.strictEqual(r.format, 'CNSS 2012');
  const recs = enregistrements(r);
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].length, 122, 'un enregistrement fait 122 caractères');
  assert.deepStrictEqual(lire(recs[0]), {
    employeur: '00123456', cleEmployeur: '72', code: '0006', trimestre: '1', annee: '2010',
    page: '001', ligne: '01', assure: '12345678', cleAssure: '90',
    identite: 'SONIA MOHAMED KHELIFI' + ' '.repeat(60 - 21), cin: '01234567',
    salaire: '0003600500', vierge: ' '.repeat(10)
  });
  assert.strictEqual(r.total, 3600.5);
  assert.deepStrictEqual(r.avertissements, [], 'une identité saisie et un CIN présent ne laissent rien à vérifier');
});

t('CNSS D2 : exactement 12 lignes par page, pages et lignes consécutives, chaque ligne finie par un retour chariot', () => {
  const lignes = Array.from({ length: 25 }, (_, i) => ligne(i + 1));
  const r = K.fichierCnss({ employeur: '7654321-01', annee: 2026, trimestre: 3, lignes });
  assert.ok(r.ok, JSON.stringify(r.refus));
  assert.ok(r.contenu.endsWith('\r\n') && !r.contenu.includes('\n\n') && !/[^\r]\n/.test(r.contenu), 'CRLF après chaque salarié');
  const pl = enregistrements(r).map(x => { const c = lire(x); return c.page + '/' + c.ligne; });
  assert.deepStrictEqual(pl.slice(0, 13), ['001/01', '001/02', '001/03', '001/04', '001/05', '001/06',
    '001/07', '001/08', '001/09', '001/10', '001/11', '001/12', '002/01']);
  assert.strictEqual(pl[23], '002/12');
  assert.strictEqual(pl[24], '003/01', 'la 25e ligne ouvre la page 3');
  assert.strictEqual(new Set(pl).size, 25, 'aucun doublon');
  assert.ok(enregistrements(r).every(x => x.length === 122 && lire(x).code === '0000'), 'code ordinaire par défaut');
  assert.ok([...r.contenu].every(c => c.charCodeAt(0) < 128), 'le fichier est en ASCII : aucun encodage à deviner');
  assert.strictEqual(r.total, 25000);
});

t('CNSS D2 : le salaire en millimes entiers, sans virgule, arrondi au millime', () => {
  const r = K.fichierCnss({ employeur: '123456-72', annee: 2026, trimestre: 2, lignes: [ligne(1, { salaire: 1234.5675 }), ligne(2, { salaire: 0.1 + 0.2 })] });
  const s = enregistrements(r).map(x => lire(x).salaire);
  assert.deepStrictEqual(s, ['0001234568', '0000000300']);
});

t('CNSS D2 : un matricule se lit « 123456-72 » ou en dix chiffres collés, et sa forme se vérifie', () => {
  assert.deepStrictEqual(K.lireMatriculeCnss('123456-72'), { ok: true, matricule: '00123456', cle: '72', texte: '0012345672' });
  assert.strictEqual(K.lireMatriculeCnss('1234567290').texte, '1234567290', 'sans séparateur : les deux derniers chiffres sont la clé');
  // Huit chiffres collés : « 12345672 » est le 123456-72 du document, jamais un matricule 12345672 sans clé.
  assert.strictEqual(K.lireMatriculeCnss('12345672').texte, '0012345672');
  assert.strictEqual(K.lireMatriculeCnss(' 12345678 / 90 ').texte, '1234567890');
  assert.deepStrictEqual(K.lireMatriculeCnss(''), { ok: false, motif: 'manquant' });
  assert.strictEqual(K.lireMatriculeCnss('123456789-01').ok, false, 'neuf chiffres de matricule : trop long');
  assert.strictEqual(K.lireMatriculeCnss('12-345').ok, false, 'une clé de trois chiffres');
  assert.strictEqual(K.lireMatriculeCnss('12A456-72').ok, false);
});

t('CNSS D2 : l\'identité passe en majuscules sans accents, une écriture arabe ou trop longue est refusée', () => {
  assert.deepStrictEqual(K.identiteCnss('  Hédi   ben Aïcha '), { ok: true, texte: 'HEDI BEN AICHA' });
  assert.strictEqual(K.identiteCnss('O’Neil').texte, 'O\'NEIL');
  const ar = K.identiteCnss('سنية الخليفي');
  assert.strictEqual(ar.ok, false); assert.strictEqual(ar.motif, 'latin');
  assert.deepStrictEqual(K.identiteCnss('A'.repeat(61)), { ok: false, motif: 'long' });
  assert.strictEqual(K.identiteCnss('A'.repeat(60)).ok, true, '60 caractères tiennent');
});

t('CNSS D2 : la virgule que l\'invite souffle SÉPARE, elle n\'est pas refusée ; un refus NOMME ce qui ne passe pas', () => {
  // Vu au test humain : l'invite écrit « Prénom, prénom du père, nom », et le fichier refusait
  // ensuite la virgule comme « pas en lettres latines ».
  assert.deepStrictEqual(K.identiteCnss('Ahmed, Mohamed, Ben Salah'), { ok: true, texte: 'AHMED MOHAMED BEN SALAH' });
  assert.deepStrictEqual(K.identiteCnss('Ines ; Ali / Gharbi'), { ok: true, texte: 'INES ALI GHARBI' });
  const r = K.identiteCnss('Ines 2 Gharbi');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.car, '2');
  assert.ok(K.motifIdentiteCnss(r).includes('« 2 »'), 'la phrase nomme le caractère');
  assert.strictEqual(K.motifIdentiteCnss(K.identiteCnss('')), 'Son identité manque.');
  const f = K.fichierCnss({ employeur: '123456-72', annee: 2026, trimestre: 2, lignes: [{ salarieId: 'a', nom: 'Ines Gharbi', identite: 'Ines 2 Gharbi', cnss: '12345678-90', cin: '12345678', salaire: 10 }] });
  assert.strictEqual(f.ok, false);
  assert.ok(f.refus[0].motif.includes('« 2 »'), 'le fichier dit la même phrase que la fiche');
});

t('CNSS D2 : les deux fiches du salarié refusent À LA SAISIE ce que le fichier refuserait, en montrant la case', () => {
  const app = lireSource('src/renderer/app.js');
  const ok = app.slice(app.indexOf('function employeeForm('), app.indexOf('function employeeForm(') + 9000);
  const enreg = ok.indexOf('save(true); close(); if (done) done(e);');
  const idc = ok.indexOf("C.identiteCnss(v.cnssName)");
  const mat = ok.indexOf("C.lireMatriculeCnss(v.cnss)");
  assert.ok(idc > 0 && idc < enreg && mat > 0 && mat < enreg, 'l\'app entreprise refuse avant d\'enregistrer');
  assert.ok(/refus\(\$\('\[name=cnssName\]', root\), C\.motifIdentiteCnss\(idc\)\)/.test(ok), 'et montre la case, avec la phrase du fichier');
  const cab = lireSource('src/cabinet/renderer/app.js');
  const sf = cab.slice(cab.indexOf('function salarieForm('), cab.indexOf('function bulletinForm('));
  const save = sf.indexOf('api.saveSalarie(');
  const cidc = sf.indexOf('KC.identiteCnss(v.identiteCnss)');
  const cmat = sf.indexOf('KC.lireMatriculeCnss(v.cnss)');
  assert.ok(cidc > 0 && cidc < save && cmat > 0 && cmat < save, 'le Cabinet refuse avant d\'enregistrer');
  assert.ok(/refus\(\$\('\[name=identiteCnss\]', f\), KC\.motifIdentiteCnss\(idc\)\)/.test(sf), 'et montre la case');
});

t('CNSS D2 : « Voir les déclarations » ouvre le trimestre qu\'il ANNONCE, pas le trimestre en cours', () => {
  const app = lireSource('src/renderer/app.js');
  const act = app.slice(app.indexOf("'declarations-sociales': {"), app.indexOf("'declarations-sociales': {") + 500);
  assert.ok(/C\.socialDue\(data\)\.find\(x => x\.kind === 'cnss'\)/.test(act), 'la plus ancienne CNSS à déposer');
  assert.ok(/paieState\.quarter = String\(d\.quarter\)/.test(act) && /paieState\.year = String\(d\.year\)/.test(act), 'son année et son trimestre');
  const dd = app.slice(app.indexOf('function drawDeclarations('), app.indexOf('function drawDeclarations(') + 900);
  assert.ok(/aDeposer \? aDeposer\.quarter/.test(dd), 'sans trimestre choisi, la page s\'ouvre sur celui qu\'il faut déposer');
});

t('CNSS D2 : AUCUN fichier tant qu\'une ligne est fausse, et chaque refus nomme le salarié et sa case', () => {
  const r = K.fichierCnss({
    employeur: '123456-72', annee: 2026, trimestre: 3, lignes: [
      ligne(1),
      ligne(2, { nom: 'Karim', cnss: '' }),
      ligne(3, { nom: 'Sonia', identite: 'سنية الخليفي' }),
      ligne(4, { nom: 'Amine', cin: '1234567' }),
      ligne(5, { nom: 'Leila', salaire: -10 })
    ]
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.contenu, '', 'un fichier à moitié juste ne sort pas');
  assert.strictEqual(r.nom, '');
  assert.deepStrictEqual(r.refus.map(x => [x.salarieId, x.champ]), [['s2', 'cnss'], ['s3', 'identite'], ['s4', 'cin'], ['s5', 'salaire']]);
  assert.ok(r.refus.every(x => x.motif && x.nom), 'chaque refus a son motif et son nom');
});

t('CNSS D2 : sans matricule d\'employeur, le refus le nomme ; un code qui n\'est pas quatre chiffres aussi', () => {
  const r = K.fichierCnss({ employeur: '', code: 'AB', annee: 2026, trimestre: 1, lignes: [ligne(1)] });
  assert.deepStrictEqual(r.refus.map(x => x.champ), ['employeur', 'code']);
  assert.ok(/matricule CNSS de l'employeur manque/.test(r.refus[0].motif));
  assert.strictEqual(K.fichierCnss({ employeur: '123456-72', annee: 2026, trimestre: 1, lignes: [] }).refus[0].champ, 'lignes', 'un trimestre sans salaire ne fabrique pas un fichier vide');
});

t('CNSS D2 : une identité qui reprend le nom saisi et un CIN vide sortent, mais se disent À VÉRIFIER', () => {
  const r = K.fichierCnss({ employeur: '123456-72', annee: 2026, trimestre: 1, lignes: [ligne(1, { identite: '', nom: 'Ali Ben Salah', cin: '' })] });
  assert.ok(r.ok);
  const c = lire(enregistrements(r)[0]);
  assert.strictEqual(c.identite.trim(), 'ALI BEN SALAH');
  assert.strictEqual(c.cin, ' '.repeat(8), 'un CIN absent part vide, jamais inventé');
  assert.deepStrictEqual(r.avertissements.map(x => x.champ), ['identite', 'cin']);
  assert.ok(r.avertissements.every(x => /À VÉRIFIER/.test(x.motif)));
});

t('CNSS D2 : le fichier se tire du LIVRE — l\'assiette du trimestre, l\'identité et le CIN de la fiche du salarié', () => {
  const L = K.livreVide('D', 2026, {});
  L.salaries.push(K.normaliserSalarie({ nom: 'Sonia Khelifi', identiteCnss: 'Sonia Ali Khelifi', cin: '07654321', cnss: '12345678-90', embauche: '2026-01-01', brut: 1000 }, 'S1'));
  assert.strictEqual(L.salaries[0].identiteCnss, 'Sonia Ali Khelifi', 'la fiche garde son identité CNSS');
  // Deux bulletins de juillet et d'août : l'assiette du trimestre est leur somme (1 000 + 1 200).
  L.bulletins.push({ id: 'b7', salarieId: 'S1', annee: 2026, mois: 7, calcul: { cnssBase: 1000 } },
    { id: 'b8', salarieId: 'S1', annee: 2026, mois: 8, calcul: { cnssBase: 1200 } },
    { id: 'b4', salarieId: 'S1', annee: 2026, mois: 4, calcul: { cnssBase: 999 } });
  const r = K.fichierCnssDuLivre(L, { matricule: '123456-72', code: '' }, 2026, 3);
  assert.ok(r.ok, JSON.stringify(r.refus));
  assert.strictEqual(r.nom, 'DS00123456720000.32026');
  const c = lire(enregistrements(r)[0]);
  assert.strictEqual(c.salaire, '0002200000', 'le trimestre 3 seul : 2 200 DT');
  assert.strictEqual(c.identite.trim(), 'SONIA ALI KHELIFI');
  assert.strictEqual(c.cin, '07654321');
  assert.strictEqual(K.fichierCnssDuLivre(L, { matricule: '' }, 2026, 3).refus[0].champ, 'employeur');
});

t('CNSS D2 : le Cabinet garde le matricule CNSS de l\'employeur, et le fichier s\'écrit au processus principal depuis le livre', () => {
  const KC = require('../../src/cabinet/cabcore.js');
  const d = KC.migrate({ dossiers: [{ id: 'X', name: 'X', cnssEmployeur: '123456-72', cnssCode: '06' }] }).dossiers[0];
  assert.strictEqual(d.cnssEmployeur, '123456-72', 'absent de migrateDossier, il serait jeté au prochain chargement');
  assert.strictEqual(d.cnssCode, '06');
  const main = lireSource('src/cabinet/main.js').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(/DOSSIER_TEXT = \[[^\]]*'cnssEmployeur'[^\]]*'cnssCode'/.test(main), 'les deux champs s\'enregistrent');
  const h = main.slice(main.indexOf("ipcMain.handle('cab:fichierCnss'"), main.indexOf("ipcMain.handle('cab:exportCsv'"));
  assert.ok(h.length > 300 && h.length < 3000, 'tranche du handler : ' + h.length);
  assert.ok(/KC\.fichierCnssDuLivre\(o\.livre/.test(h), 'le fichier se calcule depuis le livre, ici');
  assert.ok(!/contenu\s*[,}]/.test(h.slice(0, h.indexOf('KC.fichierCnssDuLivre'))), 'le renderer n\'envoie jamais le contenu du fichier');
  assert.ok(/if \(!f\.ok\) return \{ ok: false, refus: f\.refus \}/.test(h), 'aucun fichier tant qu\'une ligne est fausse');
  assert.ok(/writeFileSync\(dest, f\.contenu, 'ascii'\)/.test(h));
  const app = lireSource('src/cabinet/renderer/app.js');
  assert.ok(/KC\.fichierCnssDuLivre\(L, \{ matricule: dossier\.cnssEmployeur, code: dossier\.cnssCode \}/.test(app), 'l\'écran annonce les refus par la MÊME fonction');
  const vue = app.slice(app.indexOf('function vuePaie('), app.indexOf('function panneauFichierCnss('));
  assert.ok(!/cnss\.echeance/.test(vue), 'la Paie n\'écrit plus « le 15 » à côté du calendrier des Échéances');
  assert.ok(/ligneEcheanceDeclaration\(dossier, [\s\S]{0,90}?, null, 'cnss', 'pa-portail'\)/.test(vue), 'la date limite vient de la règle des Échéances');
  // Un trimestre EN COURS ne se déclare pas : il lui manquerait ses derniers bulletins.
  assert.ok(/const trimEnCours = K\.today\(\) <= finTrim \?/.test(vue), 'le trimestre en cours se reconnaît au dernier jour du trimestre');
  assert.ok(/id="pa-fichier" \$\{f\.ok && !enCours \? '' : 'disabled'\}/.test(app), 'et il éteint le bouton');
});

t('CNSS D2 : l\'app entreprise fabrique le même fichier depuis ses bulletins — identité CNSS, CIN et assiette du trimestre', () => {
  const Core = require('../../src/renderer/core.js');
  const data = Core.migrateData({
    employees: [{ id: 'e1', name: 'Amel Trabelsi', cnssName: 'Amel Béchir Trabelsi', cin: '09876543', cnss: '7654321-12', grossSalary: 1000 }],
    payslips: [
      { id: 'p1', employeeId: 'e1', year: 2026, month: 1, computed: { cnssBase: 1000.5 } },
      { id: 'p2', employeeId: 'e1', year: 2026, month: 3, computed: { cnssBase: 999.5 } },
      { id: 'p3', employeeId: 'e1', year: 2026, month: 4, computed: { cnssBase: 777 } }
    ]
  });
  const r = Core.fichierCnssEntreprise(data, { cnss: '123456-72', cnssCode: '6' }, 2026, 1);
  assert.ok(r.ok, JSON.stringify(r.refus));
  assert.strictEqual(r.nom, 'DS00123456720006.12026');
  const c = lire(enregistrements(r)[0]);
  assert.strictEqual(c.identite.trim(), 'AMEL BECHIR TRABELSI', 'l\'identité CNSS de la fiche, pas le nom');
  assert.strictEqual(c.cin, '09876543');
  assert.strictEqual(c.salaire, '0002000000', 'janvier et mars : 1 000,500 + 999,500');
  assert.strictEqual(c.assure + c.cleAssure, '0765432112');
  assert.strictEqual(Core.fichierCnssEntreprise(data, {}, 2026, 1).refus[0].champ, 'employeur');
  const app = lireSource('src/renderer/app.js');
  assert.ok(/field\(lbl\('Code d\\'exploitation CNSS', 'pay\.cnssCode'\), 'cnssCode'/.test(app), 'le code d\'exploitation se règle dans les Paramètres');
  assert.ok(/name="cnssName"/.test(app), 'la fiche du salarié porte son identité CNSS');
  const decl = app.slice(app.indexOf('function blocFichierCnss('), app.indexOf("$('#cn-fichier').onclick"));
  assert.ok(/C\.fichierCnssEntreprise\(data, company\(\), y, q\)/.test(decl), 'l\'écran annonce les refus par la même fonction que le bouton');
  assert.ok(/id="cn-fichier" \$\{f\.ok && !enCours \? '' : `disabled/.test(decl), 'le bouton s\'éteint tant qu\'une ligne est fausse, ou que le trimestre n\'est pas terminé');
  assert.ok(app.includes('${blocFichierCnss(fichier, enCoursCnss)}'), 'la règle du trimestre en cours est celle de « Marquer déposée »');
  assert.ok(decl.indexOf('${blocFichierCnss(fichier)}') < decl.indexOf('id="cn-csv"'), 'les refus se lisent AVANT les boutons');
});
};
