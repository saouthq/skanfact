'use strict';
// ============================================================================================
// Les justificatifs (10.14.1, S-04)
//
// Skander : « tous les documents joints, après, quand je cherche une pièce jointe je la trouve pas,
// et c'est pas pratique ; et il faut qu'on voie quand une ligne a un justificatif joint, car c'est
// une brique importante : c'est ce qui va parvenir au comptable, et c'est grâce à ça qu'on prouve
// tout ». Trois défauts derrière une phrase : un fichier joint ne se cherchait NULLE PART (ni dans
// les listes, ni dans Ctrl K), seule la liste des achats portait un 📎, et le paquet du comptable
// n'emportait que les justificatifs d'achat — ceux d'une facture de vente ou d'un mouvement libre
// (la quittance d'un loyer payé sans facture) restaient sur le poste.
//
// Chaque test se prouve en réintroduisant son défaut (7.2.0).
module.exports = ({ t, assert, lireSource }) => {
  const core = require('../../src/renderer/core.js');
  const app = lireSource('src', 'renderer', 'app.js');

  const tranche = (debut, fin) => {
    const a = app.indexOf(debut); const b = app.indexOf(fin, a + 1);
    assert.ok(a > 0 && b > a, 'tranche introuvable : ' + debut);
    return app.slice(a, b);
  };

  // Un petit jeu qui porte un justificatif sur CHAQUE sorte de pièce : une facture émise (le bon de
  // commande du client), un brouillon (qui ne doit rien emporter), un achat (la facture du
  // fournisseur), un achat SANS justificatif, un achat hors du mois, et un mouvement libre (la
  // quittance du loyer). Chacun est réglé, pour que les lignes DÉDUITES existent aussi.
  const co = { name: 'Atelier Test SARL', matricule: '1234567A/A/M/000', currency: 'TND', paymentTermsDays: 30, stampFee: 1, regime: 'reel' };
  const jeu = () => core.migrateData({
    documents: [
      { id: 'f1', type: 'facture', clientId: 'c1', number: 'FAC-2026-001', status: 'envoyée', date: '2026-08-10', dueDate: '2026-09-09',
        lines: [{ label: 'Pose', qty: 1, unitPrice: 1000, vatRate: 19 }],
        // Réglée LE JOUR MÊME : l'encaissement (journal BQ, qui passe avant VT dans l'ordre des
        // écritures) porte le même document — c'est lui que le lien ne doit PAS désigner.
        payments: [{ id: 'p1', date: '2026-08-10', amount: 500, method: 'virement' }],
        attachments: [{ name: 'bon de commande Hôtel.pdf', file: 'bc-1.pdf', size: 10, date: '2026-08-10' }] },
      { id: 'f2', type: 'facture', clientId: 'c1', number: '', status: 'brouillon', date: '2026-08-12',
        lines: [{ label: 'x', qty: 1, unitPrice: 50, vatRate: 19 }],
        attachments: [{ name: 'brouillon.pdf', file: 'br.pdf' }] }
    ],
    clients: [{ id: 'c1', name: 'Hôtel du Lac' }],
    purchases: [
      { id: 'a1', kind: 'facture', supplierId: 's1', number: 'F/99', date: '2026-08-05',
        lines: [{ label: 'bois', qty: 1, unitPrice: 200, vatRate: 19, destination: 'charge', deductible: true }],
        payments: [{ id: 'r1', date: '2026-08-25', amount: 238, method: 'virement' }],
        attachments: [{ name: 'facture scierie.jpg', file: 'fs.jpg' }] },
      { id: 'a2', kind: 'facture', supplierId: 's1', number: 'F-100', date: '2026-08-06',
        lines: [{ label: 'vis', qty: 1, unitPrice: 20, vatRate: 19, destination: 'charge', deductible: true }] },
      { id: 'a3', kind: 'facture', supplierId: 's1', number: 'F-50', date: '2026-07-06',
        lines: [{ label: 'colle', qty: 1, unitPrice: 20, vatRate: 19, destination: 'charge', deductible: true }] }
    ],
    suppliers: [{ id: 's1', name: 'Scierie du Nord' }],
    accounts: [{ id: 'b1', name: 'Banque', isDefault: true, opening: 0 }],
    movements: [{ id: 'm1', date: '2026-08-03', kind: 'autre-sortie', amount: 800, accountId: 'b1', label: 'Loyer d\'août', reference: 'CH-12',
      method: 'cheque', compte: '613', attachments: [{ name: 'quittance loyer août.pdf', file: 'q8.pdf' }] }]
  });

  t('S-04 : une ligne DÉDUITE montre les justificatifs de la pièce d\'où elle vient — encaissement, règlement, écriture', () => {
    const d = jeu();
    const noms = x => core.justificatifsDe(d, x).map(a => a.name);
    const doc = d.documents.find(x => x.id === 'f1'); const achat = d.purchases.find(x => x.id === 'a1'); const mv = d.movements[0];
    // La pièce elle-même.
    assert.deepStrictEqual(noms(doc), ['bon de commande Hôtel.pdf']);
    assert.deepStrictEqual(noms(achat), ['facture scierie.jpg']);
    assert.deepStrictEqual(noms(mv), ['quittance loyer août.pdf']);
    // Les lignes de trésorerie : l'encaissement de la facture, le règlement de l'achat, le mouvement libre.
    const tre = core.cashMovements(d, co, { from: '2026-08-01', to: '2026-08-31' }, null);
    assert.deepStrictEqual(noms(tre.find(m => m.docId === 'f1')), ['bon de commande Hôtel.pdf'], 'l\'encaissement ne montre pas le justificatif de sa facture');
    assert.deepStrictEqual(noms(tre.find(m => m.purchaseId === 'a1')), ['facture scierie.jpg'], 'le règlement ne montre pas le justificatif de son achat');
    assert.deepStrictEqual(noms(tre.find(m => m.movementId === 'm1')), ['quittance loyer août.pdf'], 'le mouvement libre ne montre pas le sien');
    // Les écritures, chaque source.
    const e = core.journalEntries(d, co, { from: '2026-08-01', to: '2026-08-31' }, {});
    const par = src => e.find(x => x.source === src && core.justificatifsDe(d, x).length);
    ['vente', 'achat', 'encaissement', 'règlement', 'mouvement'].forEach(src =>
      assert.ok(par(src), 'une écriture « ' + src + ' » ne montre pas le justificatif de sa pièce'));
    // Une écriture qui n'a pas de pièce jointe possible (la TVA du mois, une paie) n'en invente pas.
    assert.deepStrictEqual(core.justificatifsDe(d, { source: 'declarations', docId: 'f1' }), []);
    assert.deepStrictEqual(core.justificatifsDe(d, null), []);
    // Le nom se cherche : une seule chaîne, les noms des fichiers.
    assert.strictEqual(core.nomsJustificatifs(doc), 'bon de commande Hôtel.pdf');
    assert.strictEqual(core.nomsJustificatifs({ attachments: [{ name: 'a.pdf' }, { file: 'x' }, { name: 'b.jpg' }] }), 'a.pdf b.jpg');
  });

  t('S-04 : le paquet emporte les justificatifs des ventes émises et des mouvements, et dit à quelle écriture chacun appartient', () => {
    const d = jeu();
    const plan = core.packPlan(d, co, core.packPeriod(2026, 8), {});
    const chemins = plan.entries.filter(x => x.kind === 'attachment').map(x => x.path).sort();
    assert.deepStrictEqual(chemins, [
      'achats/F_99/facture scierie.jpg',
      'tresorerie/2026-08-03_CH-12/quittance loyer août.pdf',
      'ventes/FAC-2026-001/bon de commande Hôtel.pdf'
    ].sort(), 'les justificatifs du paquet : ' + chemins.join(', '));
    // Le brouillon n'emporte rien : il n'a ni numéro ni écriture.
    assert.ok(!plan.entries.some(x => x.file === 'br.pdf'));
    // Chaque justificatif désigne la pièce qu'il prouve, par la clé de `ecritures.csv`.
    const j = plan.entries.find(x => x.path === 'justificatifs.json');
    assert.ok(j, 'le paquet ne dit pas où va chaque justificatif');
    const liens = JSON.parse(j.text);
    assert.strictEqual(liens.format, 1);
    const du = chemin => liens.justificatifs.find(x => x.chemin === chemin) || {};
    assert.deepStrictEqual([du('ventes/FAC-2026-001/bon de commande Hôtel.pdf').journal, du('ventes/FAC-2026-001/bon de commande Hôtel.pdf').piece], ['VT', 'FAC-2026-001']);
    assert.deepStrictEqual([du('achats/F_99/facture scierie.jpg').journal, du('achats/F_99/facture scierie.jpg').piece, du('achats/F_99/facture scierie.jpg').date], ['AC', 'F/99', '2026-08-05']);
    const loyer = du('tresorerie/2026-08-03_CH-12/quittance loyer août.pdf');
    assert.strictEqual(loyer.piece, 'CH-12');
    assert.strictEqual(loyer.date, '2026-08-03');
    // La clé désigne une pièce qui EXISTE dans le fichier des écritures du même paquet.
    const csv = plan.entries.find(x => x.path === 'journaux/ecritures.csv').text;
    liens.justificatifs.forEach(l => assert.ok(csv.includes(`;${l.journal};${l.piece};`) || csv.includes(`;${l.journal};"${l.piece}";`),
      'la pièce ' + l.journal + ' ' + l.piece + ' n\'existe pas dans ecritures.csv'));
    // Le compte de la page de garde les compte tous.
    assert.strictEqual(plan.totaux.justificatifs, 3);
    // Un mois sans aucun justificatif n'emporte pas de fichier vide.
    assert.ok(!core.packPlan(d, co, core.packPeriod(2026, 7), {}).entries.some(x => x.path === 'justificatifs.json'));
  });

  t('S-04 : deux justificatifs ne partent jamais sous le même nom — et un nom en arabe garde ses lettres', () => {
    const d = jeu();
    const a1 = d.purchases.find(x => x.id === 'a1');
    a1.attachments.push({ name: 'facture scierie.jpg', file: 'fs-2.jpg' }, { name: 'facture scierie.jpg', file: 'fs-3.jpg' },
      { name: 'فاتورة.pdf', file: 'ar-1.pdf' }, { name: 'وصل.pdf', file: 'ar-2.pdf' }, { name: 'a:b?.pdf', file: 'x.pdf' });
    const plan = core.packPlan(d, co, core.packPeriod(2026, 8), {});
    const chemins = plan.entries.map(x => x.path);
    assert.strictEqual(new Set(chemins).size, chemins.length, 'deux entrées sous le même chemin : ' + chemins.join(', '));
    ['achats/F_99/facture scierie.jpg', 'achats/F_99/facture scierie (2).jpg', 'achats/F_99/facture scierie (3).jpg',
      'achats/F_99/فاتورة.pdf', 'achats/F_99/وصل.pdf', 'achats/F_99/a_b_.pdf'].forEach(c =>
      assert.ok(chemins.includes(c), 'manque : ' + c + ' — ' + chemins.filter(x => x.startsWith('achats/')).join(', ')));
    // Chaque fichier garde SA copie : le suffixe change le nom dans le paquet, jamais la source.
    const par = c => plan.entries.find(x => x.path === c);
    assert.deepStrictEqual(['achats/F_99/facture scierie.jpg', 'achats/F_99/facture scierie (2).jpg', 'achats/F_99/facture scierie (3).jpg'].map(c => par(c).file), ['fs.jpg', 'fs-2.jpg', 'fs-3.jpg']);
    // Et le fichier des liens les désigne tous, chacun sous son vrai chemin.
    const liens = JSON.parse(plan.entries.find(x => x.path === 'justificatifs.json').text).justificatifs;
    assert.strictEqual(liens.filter(l => l.chemin.startsWith('achats/F_99/')).length, 6);
  });

  t('S-04 : « sans justificatif » est UNE règle — le contrôle de clôture la compte avec sa période, la liste la montre avec la même', () => {
    const d = jeu();
    const c = core.closureChecks(d, co, '2026-08-01', '2026-08-31').find(x => x.id === 'justificatifs');
    assert.ok(c && c.count === 1, 'le contrôle compte l\'achat du mois sans justificatif (a2), pas celui de juillet');
    assert.deepStrictEqual([c.du, c.au], ['2026-08-01', '2026-08-31'], 'le contrôle ne dit pas sur quelle période il compte');
    assert.strictEqual(core.sansJustificatif(d.purchases.find(p => p.id === 'a2')), true);
    assert.strictEqual(core.sansJustificatif(d.purchases.find(p => p.id === 'a1')), false);
    // Le contrôle lit la règle, et la liste aussi.
    const src = lireSource('src', 'renderer', 'core.js');
    const ctrl = src.slice(src.indexOf('  function closureChecks('), src.indexOf('  function closePeriod('));
    assert.ok(ctrl.length > 500 && ctrl.length < 20000, 'tranche de closureChecks inattendue : ' + ctrl.length);
    assert.ok(/sansJustificatif\(p\)/.test(ctrl), 'le contrôle de clôture ne passe pas par sansJustificatif');
    const liste = tranche('routes.achats = ', 'routes.achat = ');
    assert.ok(/s\.st === SANS_JUSTIF \? C\.sansJustificatif\(p\)/.test(liste), 'le filtre de la liste ne passe pas par la même règle');
    assert.ok(/\.filter\(p => !s\.du \|\| \(\(p\.date \|\| ''\) >= s\.du && \(p\.date \|\| ''\) <= \(s\.au \|\| '9999-12-31'\)\)\)/.test(liste), 'la liste ne garde pas la période du contrôle');
    // Le bouton du contrôle ouvre CE filtre, avec CETTE période.
    assert.ok(/justificatifs: \{ label: 'Voir les achats sans justificatif', run: c => vers\('#\/achats', \(\) => filtreAchats\(SANS_JUSTIF, c && c\.du, c && c\.au\)\)\(\) \}/.test(app),
      'le bouton du contrôle n\'ouvre pas les achats sans justificatif de sa période');
  });

  t('S-04 : chaque liste montre le 📎 d\'une ligne qui a son justificatif, par UNE fonction', () => {
    const marque = tranche('  function marqueJustif(liste) {', '  function tableauJustificatifs(');
    assert.ok(/📎/.test(marque) && /aria-label/.test(marque), 'le repère ne se lit pas au clavier');
    // Joué : aucun fichier, aucun repère ; deux fichiers, leurs noms au survol.
    const vm = require('vm');
    const jouer = liste => vm.runInNewContext(marque + '\nmarqueJustif(liste)', {
      liste, h: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
      pl: (n, m) => `${n} ${m}${n > 1 ? 's' : ''}`, sPl: n => (n > 1 ? 's' : '')
    });
    assert.strictEqual(jouer([]), '');
    assert.strictEqual(jouer(undefined), '');
    const deux = jouer([{ name: 'a.pdf' }, { name: 'b<c>.jpg' }]);
    assert.ok(deux.includes('2 justificatifs joints : a.pdf, b&lt;c&gt;.jpg'), deux);
    // Les listes qui l'appellent : documents, achats, mouvements, écritures, grand livre, journaux.
    const appels = [
      ['docColumns', tranche('  function docColumns(opts) {', '  function purchaseColumns(opts)'), /marqueJustif\(d\.attachments\)/],
      ['purchaseColumns', tranche('  function purchaseColumns(opts) {', 'const buyState'), /marqueJustif\(p\.attachments\)/],
      ['mouvements', tranche('    function drawMoves() {\n      const cols = [', '    // --- Rapprochement'), /marqueJustif\(C\.justificatifsDe\(data, m\)\)/],
      ['écritures', tranche('    function drawEntries() {', '      bindSort($(\'#c-body\')'), /marqueJustif\(C\.justificatifsDe\(data, e\)\)/]
    ];
    appels.forEach(([nom, src, re]) => assert.ok(re.test(src), 'la liste « ' + nom + ' » ne montre pas le 📎'));
    assert.strictEqual((app.match(/\$\{h\(e\.piece\)\}\$\{marqueJustif\(C\.justificatifsDe\(data, e\)\)\}/g) || []).length, 2, 'les écritures ET le grand livre');
    assert.ok(/marqueJustif\(C\.justificatifsDe\(data, \{ purchaseId: r\.id \}\)\)/.test(app), 'le journal des achats');
    assert.ok(/marqueJustif\(C\.justificatifsDe\(data, \{ source: 'vente', docId: r\.id \}\)\)/.test(app), 'le journal des ventes');
    // Une seule forme : personne ne pose un repère 📎 à la main à côté (une PHRASE qui en parle, si).
    // Un repère est l'émoji seul dans une balise, ou seul dans une chaîne.
    const reperes = app.split('\n').filter(l => />\s*📎\s*</.test(l) || /(['"`])📎\1/.test(l));
    assert.deepStrictEqual(reperes.filter(l => !l.includes('att-mark')), [], 'un 📎 posé à la main à côté de marqueJustif');
    assert.strictEqual(reperes.length, 1, 'le repère vit dans marqueJustif, et là seulement');
  });

  t('S-04 : le nom d\'un fichier joint se CHERCHE — listes de pièces, achats, journaux, et Ctrl K', () => {
    // Les listes : ventes (documents), achats.
    assert.ok((app.match(/C\.nomsJustificatifs\(d\)\]\.join\(' '\), s\.q\)/g) || []).length >= 2, 'la recherche des listes de pièces de vente ne lit pas les fichiers joints');
    assert.ok(/contenuAchat\(p\), C\.nomsJustificatifs\(p\)\]\.join\(' '\), s\.q\)/.test(app), 'la recherche des achats ne lit pas les fichiers joints');
    // Les journaux de la Comptabilité.
    assert.ok(/hit\(r\.number, r\.client, r\.subject, r\.creditOfNumber, C\.nomsJustificatifs\(/.test(app), 'le journal des ventes');
    assert.ok(/\$\{C\.nomsJustificatifs\(\{ attachments: C\.justificatifsDe\(data, \{ purchaseId: r\.id \}\) \}\)\}`, q\)/.test(app), 'le journal des achats');
    // La palette : les achats, les fournisseurs, et chaque fichier joint (ventes, achats, mouvements).
    const pal = tranche('    const KIND_ACHAT = {', '    const recentes = docs.concat(achats)');
    assert.ok(/kind: 'Fournisseur'/.test(pal) && /kind: KIND_ACHAT\[p\.kind\]/.test(pal), 'la palette ne connaît ni les achats ni les fournisseurs');
    assert.ok(/kind: 'Fichier', main: a\.name \|\| a\.file/.test(pal), 'la palette ne propose pas le fichier joint');
    ['data.documents.forEach(d => joindre(', '(data.purchases || []).forEach(p => joindre(', '(data.movements || []).forEach(m => joindre('].forEach(x =>
      assert.ok(pal.includes(x), 'la palette ne cherche pas les fichiers joints de : ' + x));
    assert.ok(/pageFocus = 'p-pj'; navigate\('#\/doc\/' \+ d\.id\)/.test(pal) && /pageFocus = 'p-pj'; navigate\('#\/achat\/' \+ p\.id\)/.test(pal), 'le fichier trouvé n\'ouvre pas le panneau de la pièce qui le porte');
    assert.ok(/\.\.\.clients, \.\.\.fournisseurs, \.\.\.items, \.\.\.justifs\]/.test(app), 'les résultats neufs n\'entrent pas dans la palette');
  });

  t('S-04 : un mouvement libre porte ses justificatifs — joints dans sa fenêtre, retirés si on l\'abandonne ou le supprime', () => {
    const f = tranche('  function movementForm(mv, done) {', '  routes.tresorerie = ');
    assert.ok(/<div id="mv-pj"><\/div>/.test(f) && /lbl\('Justificatifs', 'tre\.moveJustif'\)/.test(f), 'la fenêtre n\'a pas de place pour le justificatif');
    assert.ok(/bridge\.addAttachments\(m\.id\)/.test(f) && /tableauJustificatifs\(list\)/.test(f) && /brancherJustificatifs\(el, m\.id, list,/.test(f));
    // Une fenêtre abandonnée ne laisse pas de copie ; une suppression emporte les siennes.
    assert.ok(/\(\) => \{ if \(!enregistre && !mv\) ajoutes\.forEach\(a => \{ try \{ bridge\.removeAttachment\(m\.id, a\.file\)/.test(f), 'une fenêtre abandonnée laisse ses copies');
    assert.ok(/\(m\.attachments \|\| \[\]\)\.forEach\(a => \{ try \{ bridge\.removeAttachment\(m\.id, a\.file\)/.test(f), 'un mouvement supprimé laisse ses copies');
    // La fenêtre compte un fichier joint comme une saisie : fermer demande avant de le perdre.
    assert.ok(/garde: \(\) => \(champs \? champs\(\) : false\) \|\| ajoutes\.length > 0/.test(f));
    // Et la bulle existe (le test des clés d'aide le dirait aussi, mais on nomme la règle ici).
    assert.ok(/'tre\.moveJustif': \{ t: 'Justificatifs du mouvement'/.test(lireSource('src', 'renderer', 'guide.js')));
  });

  // ---------- le Cabinet (S-04b) ----------
  const K = require('../../src/cabinet/cabcore.js');
  const KC = require('../../src/renderer/compta.js');

  t('S-04b : le Cabinet ne garde de justificatifs.json que ce qu\'il sait lire — un chemin qui remonte ne désigne rien', () => {
    assert.deepStrictEqual(K.justificatifsDuPaquet(null), []);
    assert.deepStrictEqual(K.justificatifsDuPaquet({ format: 2, justificatifs: [{ chemin: 'a.pdf' }] }), [], 'un format inconnu');
    assert.deepStrictEqual(K.justificatifsDuPaquet({ format: 1, justificatifs: 'non' }), []);
    const l = K.justificatifsDuPaquet({ format: 1, justificatifs: [
      { chemin: 'achats/F-1/facture.pdf', nom: 'facture.pdf', journal: 'AC', piece: 'F-1', date: '2026-08-05' },
      { chemin: '../../etc/passwd', journal: 'AC', piece: 'F-2', date: '2026-08-05' },
      { chemin: '/tmp/x.pdf', journal: 'AC', piece: 'F-3', date: '2026-08-05' },
      { chemin: 'ventes/FAC-1/../../x.pdf', journal: 'VT', piece: 'FAC-1', date: '2026-08-05' },
      { chemin: 'tresorerie/2026-08-03_CH/q.pdf', journal: 'BQ', piece: 'CH', date: '3 août' },
      null, 12, { nom: 'sans chemin' }
    ] });
    assert.deepStrictEqual(l.map(j => j.chemin), ['achats/F-1/facture.pdf', 'tresorerie/2026-08-03_CH/q.pdf']);
    assert.strictEqual(l[1].date, '', 'une date qui n\'est pas un jour ISO ne se garde pas');
    assert.strictEqual(l[1].nom, 'q.pdf', 'sans nom, le nom est celui du fichier');
    // Borné : un fichier démesuré ne gonfle pas la mémoire du Cabinet.
    const beaucoup = K.justificatifsDuPaquet({ format: 1, justificatifs: Array.from({ length: 6000 }, (_, i) => ({ chemin: `a/${i}.pdf`, piece: 'x', journal: 'AC' })) });
    assert.strictEqual(beaucoup.length, 5000);
  });

  t('S-04b : chaque justificatif du paquet désigne une PIÈCE que le Cabinet lit — le contrat entre les deux applications', () => {
    // Le vrai paquet de l'application entreprise, lu comme le Cabinet le lit : le CSV des écritures
    // par `entreesDepuisCsv`, les liens par `justificatifsDuPaquet`. Sans cette confrontation, un
    // champ renommé d'un côté laisserait tous les 📎 du Cabinet éteints, sans une erreur nulle part.
    const d = jeu();
    const plan = core.packPlan(d, co, core.packPeriod(2026, 8), {});
    const csv = plan.entries.find(x => x.path === 'journaux/ecritures.csv').text;
    const liens = K.justificatifsDuPaquet(JSON.parse(plan.entries.find(x => x.path === 'justificatifs.json').text));
    assert.strictEqual(liens.length, 3);
    const lignes = KC.entreesDepuisCsv(csv).map(l => ({ ...l, mois: '2026-08' }));
    const paquets = [{ month: '2026-08', path: '/cabinet/paquets/2026-08.skanpack', justificatifs: liens }];
    const vus = new Set();
    lignes.forEach(l => K.justificatifsDeLigne(paquets, l).forEach(j => vus.add(j.chemin)));
    assert.deepStrictEqual([...vus].sort(), liens.map(j => j.chemin).sort(), 'un justificatif ne trouve pas sa pièce dans le fichier des écritures');
    // La pièce de l'achat porte le justificatif de l'achat, et lui seul ; son règlement (même
    // document, autre pièce) ne le porte pas — c'est la pièce qui se prouve.
    const achat = lignes.find(l => l.journal === 'AC' && l.piece === 'F/99');
    assert.deepStrictEqual(K.justificatifsDeLigne(paquets, achat).map(j => j.nom), ['facture scierie.jpg']);
    assert.strictEqual(K.justificatifsDeLigne(paquets, achat)[0].path, '/cabinet/paquets/2026-08.skanpack', 'le Cabinet ne sait pas dans quel paquet l\'ouvrir');
    // Un autre mois, un autre journal, un paquet sans fichier : rien.
    assert.deepStrictEqual(K.justificatifsDeLigne(paquets, { ...achat, mois: '2026-07' }), []);
    assert.deepStrictEqual(K.justificatifsDeLigne(paquets, { ...achat, journal: 'OD' }), []);
    assert.deepStrictEqual(K.justificatifsDeLigne([{ month: '2026-08', justificatifs: liens }], achat), []);
  });

  t('S-04b : le Cabinet lit les liens dans le paquet, et montre le 📎 du client sur le journal, le grand livre et la recherche', () => {
    const main = lireSource('src', 'cabinet', 'main.js');
    const lire = main.slice(main.indexOf('function lireEcritures(p) {'), main.indexOf('// ---------- les livres d\'un dossier (9.1.0)'));
    assert.ok(lire.length > 200 && lire.length < 3000, 'tranche lireEcritures inattendue : ' + lire.length);
    assert.ok(/x\.name === 'justificatifs\.json'/.test(lire) && /K\.justificatifsDuPaquet\(JSON\.parse\(/.test(lire), 'le Cabinet ne lit pas les liens du paquet');
    assert.ok(/justificatifs: r\.justificatifs \|\| \[\]/.test(main) && /csv: p\.csv, justificatifs: p\.justificatifs/.test(main), 'les liens ne vont pas jusqu\'à l\'écran');
    const cab = lireSource('src', 'cabinet', 'renderer', 'app.js');
    const journal = cab.slice(cab.indexOf('  function vueJournal(lignes) {'), cab.indexOf('  function nomDeCompte() {'));
    assert.ok(/marqueJustif\(e, e\.ecritureId && s\.livre \?/.test(journal), 'le livre-journal ne montre pas le 📎');
    assert.ok(/\[e\.piece, e\.mois \|\| '', e\.journal \|\| '', e\.date \|\| ''\]\.join\('\|'\)/.test(journal), 'une ligne de paquet ne dit pas au menu sa pièce entière');
    const gl = cab.slice(cab.indexOf('  function vueGrandLivre(lignes) {'), cab.indexOf('  const GL_PLAFOND'));
    assert.ok(/marqueJustif\(e, e\.ecritureId && s\.livre \?/.test(gl), 'le grand livre ne montre pas le 📎');
    const rech = cab.slice(cab.indexOf('  function vueRecherche('), cab.indexOf('  function sansPerdreLaFrappe('));
    assert.ok(/marqueJustif\(e, e\.pieceJointe\)/.test(rech) && !/<span title="Justificatif joint">📎<\/span>/.test(rech), 'la recherche pose encore son 📎 à la main');
    // Les gestes : dans la table d'actions de l'écriture (recherche, brouillard, journal) ET d'une ligne de paquet.
    const act = cab.slice(cab.indexOf('  function actionsEcriture(root, dossier, e) {'), cab.indexOf('  async function extournerEcriture('));
    assert.ok(/a\.push\(\.\.\.actionsJustifsClient\(e\)\)/.test(act), 'l\'écriture ne propose pas d\'ouvrir le justificatif du client');
    assert.ok(/return actionsJustifsClient\(\{ piece, mois, journal, date \}\)\.concat\(/.test(cab), 'une ligne de paquet ne propose pas d\'ouvrir le justificatif du client');
    // L'ouverture passe par le paquet, jamais par un chemin du disque.
    const ouvrir = cab.slice(cab.indexOf('  async function ouvrirJustifClient(j) {'), cab.indexOf('  function actionsJustifsClient(e) {'));
    assert.ok(/api\.openInPack\(j\.path, j\.chemin, password\)/.test(ouvrir) && /askPassword\(/.test(ouvrir));
  });

  t('S-04 : la liste d\'un justificatif garde UN bouton — le nom l\'ouvre, le reste vit dans le menu de la ligne', () => {
    const tab = tranche('  function tableauJustificatifs(list) {', '  // Ouvrir la COPIE rangée par SkanFact');
    assert.ok(/data-open="\$\{h\(a\.file\)\}"/.test(tab) && /rowMenuCell\(a\.file\)/.test(tab), 'le tableau d\'un justificatif');
    assert.ok(!/>✕</.test(tab) && !/>Dossier</.test(tab), 'le « ✕ » muet et « Dossier » sont revenus');
    const br = tranche('  function brancherJustificatifs(el, ownerId, list, retirer) {', '  function docColumns(opts) {');
    assert.ok(/label: 'Ouvrir le fichier'/.test(br) && /label: `Montrer dans \$\{EXPLORATEUR\}`/.test(br) && /label: 'Retirer ce justificatif'/.test(br) && /danger: true/.test(br));
    // Les trois fenêtres qui en portent (document, achat, mouvement) passent par la même forme.
    assert.ok((app.match(/tableauJustificatifs\(list\)/g) || []).length >= 3, 'une liste de justificatifs recopiée à la main');
    assert.ok((app.match(/brancherJustificatifs\(el, /g) || []).length >= 3);
    // Un fichier qui n'est plus là se dit en français, jamais par le message du système (7.26.0).
    const ouvrir = tranche('  async function ouvrirJustificatif(ownerId, a) {', '  function brancherJustificatifs(');
    assert.ok(/if \(err\) toast\(`« \$\{a\.name \|\| a\.file\} » ne s'ouvre pas/.test(ouvrir));
  });

  // LET-01 (10.14.1) : un achat sans numéro — le carburant, la papeterie, un ticket de caisse —
  // s'écrivait avec la pièce « (sans numéro) » (la même pour tous : le Cabinet regroupait deux
  // tickets du même jour en une seule pièce), son règlement sans pièce du tout, sa lettre était
  // l'IDENTIFIANT interne (« n1 », « lqz8f3k2x9 ») et son dossier dans le paquet aussi. Une
  // référence lisible et unique, déduite de la date — « SN-20260810 », puis « -2 » pour le
  // second du même jour, dans l'ordre de création — sert partout où l'achat a besoin d'un nom.
  t('LET-01 : un achat sans numéro a UNE référence lisible — pièce, lettre, règlement, dossier du paquet, lettrage, recherche', () => {
    const d = jeu();
    const achat = (id, date, montant, extra) => Object.assign({ id, kind: 'depense', supplierId: 's1', number: '', date,
      lines: [{ label: 'carburant', qty: 1, unitPrice: montant, vatRate: 19, destination: 'charge', deductible: true }] }, extra || {});
    d.purchases.push(
      // Deux tickets le MÊME jour, avec un justificatif du même nom : c'est là que tout se confondait.
      achat('n1', '2026-08-10', 100, { payments: [{ id: 'rn1', date: '2026-08-10', amount: 119, method: 'virement' }],
        attachments: [{ name: 'ticket.jpg', file: 't1.jpg' }] }),
      achat('n2', '2026-08-10', 10, { number: '   ', attachments: [{ name: 'ticket.jpg', file: 't2.jpg' }] }),
      // Un identifiant qui passe AVANT les deux autres, mais un autre jour : il ne prend pas leur rang.
      achat('m0', '2026-08-12', 20));
    const p = id => d.purchases.find(x => x.id === id);
    assert.deepStrictEqual(['n1', 'n2', 'm0', 'a1'].map(id => core.referenceAchat(p(id), d)),
      ['SN-20260810', 'SN-20260810-2', 'SN-20260812', 'F/99']);
    // La référence ne dépend que du jour et de l'ordre de création : un ticket d'un AUTRE jour, créé
    // après, ne décale personne (un numéro qui bouge n'est plus un numéro).
    d.purchases.push(achat('z9', '2026-08-11', 5));
    assert.deepStrictEqual(['n1', 'n2', 'm0', 'z9'].map(id => core.referenceAchat(p(id), d)),
      ['SN-20260810', 'SN-20260810-2', 'SN-20260812', 'SN-20260811']);
    // Ni de l'ordre de la liste : une fusion ou un import range les pièces autrement, et la référence
    // d'une pièce déjà envoyée au comptable ne doit pas changer pour autant.
    const renverse = core.migrateData(JSON.parse(JSON.stringify(Object.assign({}, d, { purchases: d.purchases.slice().reverse() }))));
    assert.deepStrictEqual(['n1', 'n2'].map(id => core.referenceAchat(renverse.purchases.find(x => x.id === id), renverse)),
      ['SN-20260810', 'SN-20260810-2'], 'la référence dépend de l\'ordre de la liste');
    // Les écritures : chaque achat sans numéro porte SA pièce, jamais « (sans numéro) » ni son identifiant.
    const e = core.journalEntries(d, co, { from: '2026-08-01', to: '2026-08-31' }, {});
    const lignes = (src, id) => e.filter(x => x.source === src && x.docId === id);
    assert.ok(lignes('achat', 'n1').length && lignes('achat', 'n2').length, 'les deux achats sans numéro n\'ont pas d\'écriture');
    assert.deepStrictEqual([...new Set(lignes('achat', 'n1').map(x => x.piece))], ['SN-20260810']);
    assert.deepStrictEqual([...new Set(lignes('achat', 'n2').map(x => x.piece))], ['SN-20260810-2'],
      'deux tickets du même jour portent la même pièce : le Cabinet en ferait une seule');
    assert.ok(!e.some(x => /sans num/i.test(x.piece || '')), 'une pièce « (sans numéro) » est revenue');
    // Le règlement porte la pièce qu'il règle, et le lettrage la même lettre des deux côtés — jamais l'identifiant.
    assert.deepStrictEqual([...new Set(lignes('règlement', 'n1').map(x => x.piece))], ['SN-20260810'], 'le règlement d\'un achat sans numéro n\'a pas de pièce');
    const lettres = [...new Set([...lignes('achat', 'n1'), ...lignes('règlement', 'n1')].map(x => x.lettre))];
    assert.deepStrictEqual(lettres, ['SN-20260810'], 'la lettre d\'un achat sans numéro : ' + lettres.join(', '));
    assert.ok(!e.some(x => ['n1', 'n2', 'm0', 'z9'].includes(x.lettre) || ['n1', 'n2', 'm0', 'z9'].includes(x.piece)), 'un identifiant interne est sorti dans les écritures');
    // Le paquet : chaque ticket a SON dossier, lisible, et les liens désignent des pièces qui existent.
    const plan = core.packPlan(d, co, core.packPeriod(2026, 8), {});
    const chemins = plan.entries.filter(x => x.kind === 'attachment').map(x => x.path);
    assert.ok(chemins.includes('achats/SN-20260810/ticket.jpg') && chemins.includes('achats/SN-20260810-2/ticket.jpg'),
      'les dossiers des tickets dans le paquet : ' + chemins.join(', '));
    assert.ok(!chemins.some(c => /^achats\/(n1|n2)\//.test(c)), 'un dossier du paquet porte un identifiant interne');
    const liens = JSON.parse(plan.entries.find(x => x.path === 'justificatifs.json').text).justificatifs;
    const csv = plan.entries.find(x => x.path === 'journaux/ecritures.csv').text;
    liens.forEach(l => assert.ok(csv.includes(`;${l.journal};${l.piece};`) || csv.includes(`;${l.journal};"${l.piece}";`),
      'la pièce ' + l.journal + ' ' + l.piece + ' n\'existe pas dans ecritures.csv'));
    // Le lettrage fournisseurs nomme la pièce ouverte par sa référence.
    const ouverts = core.lettrage(d, co, 'fournisseurs', '2026-09-26').rows.flatMap(r => r.ouverts);
    const n2 = ouverts.find(o => o.id === 'n2');
    assert.ok(n2 && n2.piece === 'SN-20260810-2', 'le lettrage nomme l\'achat ouvert : ' + (n2 && n2.piece));
    // L'écran : la liste des achats et Ctrl K cherchent la référence, et la ligne la montre au survol.
    assert.ok(/C\.correspondRecherche\(\[C\.referenceAchat\(p, data\)/.test(app), 'la recherche des achats ignore la référence d\'un achat sans numéro');
    assert.ok(/text: `\$\{C\.referenceAchat\(p, data\)\}/.test(app), 'Ctrl K ignore la référence d\'un achat sans numéro');
    // Le journal des achats du paquet porte la même référence : le comptable rapproche le dossier
    // « achats/SN-20260810/ » de sa ligne sans deviner.
    const achatsCsv = plan.entries.find(x => x.path === 'journaux/achats.csv').text.split(/\r?\n/);
    assert.ok(/;Pièce;/.test(achatsCsv[0]), 'le journal des achats n\'a pas de colonne Pièce : ' + achatsCsv[0]);
    assert.ok(achatsCsv.some(l => l.includes(';SN-20260810-2;')), 'le journal des achats ne nomme pas le second ticket');
    const regCsv = plan.entries.find(x => x.path === 'journaux/reglements-fournisseurs.csv').text;
    assert.ok(regCsv.includes(';SN-20260810;'), 'le règlement du ticket ne nomme pas sa pièce');
    // Chaque liste d'achats montre la référence sous « sans numéro », par UNE fonction.
    const cellule = tranche('  function celluleNumeroAchat(num, ref, marque) {', '\n  }\n');
    assert.ok(/sans numéro<\/span>\$\{marque \|\| ''\}<div[^>]*>réf\. \$\{h\(ref/.test(cellule), 'la cellule d\'un achat sans numéro ne montre plus sa référence');
    const appels = (app.match(/celluleNumeroAchat\(/g) || []).length - 1;
    assert.ok(appels >= 4, 'les listes d\'achats (liste, à payer, journal, règlements) : ' + appels);
    assert.ok(!/>sans numéro<\/span>'/.test(app), 'une liste d\'achats recopie « sans numéro » sans la référence');
    // Le titre de l'éditeur dit « Dépense sans numéro » — c'est vrai —, et son sous-titre donne la référence.
    const seuls = app.match(/\|\| 'sans numéro'/g) || [];
    assert.strictEqual(seuls.length, 1, '« sans numéro » écrit sans sa référence : ' + seuls.length);
    assert.ok(/\$\{natureLabel\(p\.kind\)\} \$\{h\(p\.number \|\| 'sans numéro'\)\}/.test(app));
    assert.ok(/réf\. \$\{h\(C\.referenceAchat\(stored, data\)\)\}/.test(app), 'le sous-titre de l\'éditeur ne donne pas la référence');
  });


  // S-04 : joindre un fichier dans la fenêtre d'un mouvement faisait passer la fenêtre de 580 à
  // 860 px (la règle des fenêtres à tableau s'appliquait à la liste des justificatifs) : tout ce
  // qu'on venait de remplir bougeait sous le curseur (H-E1, dans une fenêtre).
  t('S-04 : une fenêtre qui porte ses justificatifs ne s\'élargit pas — leur tableau sort de la règle des fenêtres à tableau', () => {
    const tab = tranche('  function tableauJustificatifs(list) {', '  // Ouvrir la COPIE rangée par SkanFact');
    assert.ok(/<table class="list compact pj">/.test(tab), 'le tableau des justificatifs ne porte plus sa marque');
    const css = lireSource('src', 'renderer', 'style.css');
    const regle = css.match(/\.modal:where\(:has\(([^{]*?)\)\)\s*\{\s*width:\s*860px/);
    assert.ok(regle, 'la règle des fenêtres à tableau a changé de forme');
    assert.ok(/table\.list:not\(\.pj\)/.test(regle[1]), 'la liste des justificatifs élargit la fenêtre : ' + regle[1]);
  });

};
