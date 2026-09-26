'use strict';
// ============================================================================================
// La seconde vérification (10.14.1) — ce que le deuxième tour, fait comme un humain, a trouvé.
//
// Skander : « des champs où le montant s'écrivait "250" au lieu de la vraie écriture en dinar ».
// Chaque test de ce fichier se prouve en réintroduisant son défaut (7.2.0).
module.exports = async ({ t, ta, assert }) => {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const app = fs.readFileSync(path.join(__dirname, '../../src/renderer/app.js'), 'utf8');
  const core = require('../../src/renderer/core.js');
  const compta = require('../../src/renderer/compta.js');

  // ---------- un montant s'écrit avec ses décimales jusque dans un champ ----------
  const tranche = (debut, fin) => {
    const a = app.indexOf(debut); const b = app.indexOf(fin, a + 1);
    assert.ok(a > 0 && b > a, 'tranche introuvable : ' + debut);
    return app.slice(a, b);
  };

  t('10.14.1 : un champ de montant complète ses décimales — « 150 » devient « 150,000 » en dinars, « 150,00 » en euros, jamais arrondi', () => {
    const src = tranche('  function completerMontant(el) {', '  // Une pièce qui change de devise');
    const jouer = (valeur, devise) => {
      const el = { value: valeur, validity: { badInput: false } };
      const ctx = { el, decimalesDuChamp: () => core.decimalsFor(core.normCurrency(devise)), Number, isFinite };
      vm.runInNewContext(src + '\ncompleterMontant(el);', ctx);
      return el.value;
    };
    assert.strictEqual(jouer('150', 'DT'), '150.000');          // la ligne de devis de la capture
    assert.strictEqual(jouer('250', 'TND'), '250.000');          // le « 250 » de Skander
    assert.strictEqual(jouer('633.37', 'DT'), '633.370');
    assert.strictEqual(jouer('800', 'EUR'), '800.00');
    assert.strictEqual(jouer('1100.5', 'USD'), '1100.50');
    // Jamais d'arrondi : une valeur plus précise garde ses décimales, puisque c'est elle que les
    // données portent — l'écran afficherait sinon un chiffre que la pièce n'a pas.
    assert.strictEqual(jouer('12.3456', 'DT'), '12.3456');
    assert.strictEqual(jouer('12.345', 'EUR'), '12.345');
    // Un champ vide reste vide (« aucun seuil », « laisse vide : coût moyen »).
    assert.strictEqual(jouer('', 'DT'), '');
  });

  t('10.14.1 : chaque champ de MONTANT de l\'app entreprise est reconnu (pas de 0,001 ou .montant) — et un taux ou une quantité ne l\'est pas', () => {
    const SEL = /step="0\.001"|\bmontant\b/;
    // Les noms que l'application donne à un montant saisi. Un champ neuf qui porte l'un de ces noms
    // sans être reconnu montrerait « 250 » au lieu de « 250,000 ».
    const MONTANTS = ['amount', 'unitPrice', 'unitCost', 'initialCost', 'fees', 'grossSalary', 'gross', 'monthly', 'residual',
      'opening', 'stampFee', 'withholdingThreshold', 'revenueTarget', 'target', 'prix', 'montant', 'proCap', 'headOfFamily', 'perChild', 'upTo'];
    const manquants = [];
    app.split('\n').forEach((ligne, i) => {
      // Champs posés à la main : <input type="number" … name="x" | data-k="x" | data-f="x" | data-b="x">
      (ligne.match(/<input type="number"[^>]*>/g) || []).forEach(tag => {
        const nom = (tag.match(/(?:name|data-k|data-f|data-b)="([^"$]+)"/) || [])[1] || (/od-debit|od-credit/.test(tag) ? 'od' : (/id="stmt"/.test(tag) ? 'stmt' : ''));
        if ((MONTANTS.includes(nom) || nom === 'od' || nom === 'stmt') && !SEL.test(tag)) manquants.push(`${i + 1} : ${nom}`);
      });
      // Champs posés par field(…, 'nom', valeur, 'number', 'attributs')
      const f = ligne.match(/,\s*'(\w+)',[^;]*?,\s*'number',\s*'([^']*)'/);
      if (f && MONTANTS.includes(f[1]) && !SEL.test(f[2])) manquants.push(`${i + 1} : ${f[1]}`);
      // Champs des barèmes de paie : num('nom', libellé, clé[, montant])
      // (le libellé porte lui-même un `${h(cur)}` : on lit l'appel jusqu'à son `, true)}`, sans
      // jamais déborder sur l'appel suivant de la même ligne)
      (ligne.match(/\$\{num\('\w+'/g) || []).forEach(x => {
        const nom = x.slice(7, -1);
        if (MONTANTS.includes(nom) && !new RegExp("num\\('" + nom + "',(?:(?!num\\().)*?, true\\)\\}").test(ligne)) manquants.push(`${i + 1} : ${nom}`);
      });
    });
    assert.deepStrictEqual(manquants, [], 'champs de montant sans ses décimales :\n' + manquants.join('\n'));
    // Et la sélection ne prend pas les taux : la remise et le taux de change ont leur propre pas.
    assert.ok(!/name="discountRate"[^>]*step="0\.001"/.test(app) && !/'discountRate'[^\n]*step="0\.001"/.test(app), 'une remise (%) n\'est pas un montant');
  });

  t('10.14.1 : une fenêtre complète ses montants AVANT l\'instantané de sa saisie — fermer une fenêtre intacte ne demande rien', () => {
    const corps = tranche('  function modal(', '  function suivreSaisie(layer) {');
    const c = corps.indexOf('completerMontants(layer)');
    const g = corps.indexOf('garde = suivreSaisie(layer)');
    assert.ok(c > 0, 'modal() ne complète pas les montants de la fenêtre');
    assert.ok(c < g, 'les montants se complètent après l\'instantané : « 633,37 » devenu « 633,370 » passerait pour une frappe');
  });

  t('10.14.1 : les montants d\'un paiement disent leur devise, et la pièce en devise la donne à ses champs', () => {
    assert.ok(/lbl\(`\$\{rend \? 'Montant rendu' : 'Montant'\} \(\$\{h\(cur\)\}\)`/.test(app), 'le montant d\'un paiement client ne nomme pas sa devise');
    assert.ok(/lbl\(`\$\{rend \? 'Montant reçu' : 'Montant'\} \(\$\{h\(cur\)\}\)`/.test(app), 'le montant d\'un règlement fournisseur ne nomme pas sa devise');
    ['<form id="pf2" class="grid-2" data-devise="${h(cur)}">', '<form id="spf" class="grid-2" data-devise="${h(cur)}">',
      '<div class="editor" data-devise="${h(cur)}">', '<div class="buy-editor" data-devise="${h(cur)}">']
      .forEach(x => assert.ok(app.includes(x), 'sans devise : ' + x));
    // Changer la devise d'une pièce change les décimales de ses champs.
    assert.ok((app.match(/poserDevise\(head, cur\)/g) || []).length >= 3, 'un changement de devise ne recomplète pas les champs');
  });

  // ================================================================ le Cabinet et la console (MC-*)
  const KC = require('../../src/renderer/compta.js');
  const cab = fs.readFileSync(path.join(__dirname, '../../src/cabinet/renderer/app.js'), 'utf8');
  const trancheCab = (debut, fin) => {
    const a = cab.indexOf(debut); const b = cab.indexOf(fin, a + 1);
    assert.ok(a > 0 && b > a, 'tranche introuvable : ' + debut);
    return cab.slice(a, b);
  };

  t('MC-01 : un guide lit « 1 250,000 » et « 1,5 » comme un comptable les tape — et refuse ce qui ne se lit pas, en nommant la ligne', () => {
    // Calculé à la main sur une base de 1 000 : 622 D 1 000 ; 4366 D 19 % = 190 ; 4352 C 1,5 % = 15 ;
    // 401 C le reste = 1 175. Un loyer FIXE de 1 250 sur une autre ligne.
    const g = { nom: 'Honoraires', journal: 'AC', lignes: [
      { compte: '622', sens: 'debit', base: true }, { compte: '4366', sens: 'debit', taux: '19' },
      { compte: '4352', sens: 'credit', taux: '1,5' }, { compte: '401', sens: 'credit', solde: true }] };
    assert.ok(KC.guideValide(g).ok, KC.guideValide(g).motif);
    const e = KC.ecritureDepuisGuide(g, { montant: 1000 });
    const l = c => e.lignes.find(x => x.compte === c);
    assert.deepStrictEqual([l('622').debit, l('4366').debit, l('4352').credit, l('401').credit], [1000, 190, 15, 1175]);
    const fixe = KC.ecritureDepuisGuide({ lignes: [{ compte: '613', sens: 'debit', montant: '1 250,000' }, { compte: '512', sens: 'credit', solde: true }] }, {});
    assert.deepStrictEqual(fixe.lignes.map(x => x.debit + x.credit), [1250, 1250], 'un loyer fixe « 1 250,000 » vaut zéro');
    const ko = KC.guideValide({ nom: 'x', journal: 'AC', lignes: [{ compte: '613', sens: 'debit', montant: '150 DT' }, { compte: '401', sens: 'credit', taux: 'dix' }] });
    assert.ok(!ko.ok && /Ligne 1 : « 150 DT » n'est pas un montant/.test(ko.motifs.join('\n')) && /Ligne 2 : « dix » n'est pas un taux/.test(ko.motifs.join('\n')), ko.motifs.join(' | '));    // Une ligne qui dit deux choses : le moteur en garderait une et oublierait l'autre sans un mot.
    // Calculé à la main : « base » avec un loyer fixe de 1 250 → la ligne ignorait les 1 000 tapés.
    const deux = KC.guideValide({ nom: 'x', journal: 'AC', lignes: [
      { compte: '613', sens: 'debit', base: true, montant: '1 250,000' },
      { compte: '401', sens: 'credit', solde: true, taux: '5,5' }] });
    assert.ok(!deux.ok, 'une ligne à deux sources passe');
    assert.ok(/Ligne 1 : un montant fixe et « base » à la fois/.test(deux.motifs.join('\n')), deux.motifs.join(' | '));
    assert.ok(/Ligne 2 : un taux et « solde » à la fois/.test(deux.motifs.join('\n')), deux.motifs.join(' | '));
    // Un guide ordinaire (base, taux, solde sur trois lignes différentes) passe toujours.
    assert.ok(KC.guideValide(g).ok);
  });

  t('MC-01 : le formulaire d\'un guide range ses montants en NOMBRE et les réaffiche en français — rouvrir ne vide plus le loyer fixe', () => {
    const src = trancheCab('  const nombreOuTexte = v =>', '  function guideForm(guide) {');
    const ctx = { KC, montantIllisible: v => { const b = String(v == null ? '' : v).trim(); return !!b && !Number.isFinite(KC.nombreStrict(b)); },
      lireMontant: v => { const n = KC.nombreStrict(v); return Number.isFinite(n) ? n : 0; },
      montantSaisi: n => (n < 0 ? '-' : '') + KC.fmtMontant(Math.abs(n)) };
    vm.runInNewContext(src + '\nthis.r = { nombreOuTexte, montantDuGuide, tauxDuGuide };', ctx);
    const { nombreOuTexte, montantDuGuide, tauxDuGuide } = ctx.r;
    assert.strictEqual(nombreOuTexte('1 250,000'), 1250);
    assert.strictEqual(nombreOuTexte('5,5'), 5.5);
    assert.strictEqual(nombreOuTexte(''), '');
    assert.strictEqual(nombreOuTexte('12a'), '12a', 'une frappe illisible se garde telle quelle, pour être refusée en la montrant');
    // Un guide rangé par une version d'avant (texte français) se rouvre plein.
    assert.strictEqual(montantDuGuide('1 250,000'), '1\u202f250,000');
    assert.strictEqual(montantDuGuide(1250.5), '1\u202f250,500');
    assert.strictEqual(tauxDuGuide(5.5), '5,5');
    const relire = trancheCab('        const relire = () => {', '        const redessiner = ');
    assert.ok(/nombreOuTexte\(f\.value\)/.test(relire), 'le formulaire range encore le texte tapé');
  });

  t('MC-06 : le moins que l\'écran affiche (U+2212) garde son signe, dans un solde collé comme dans une case', () => {
    assert.strictEqual(KC.nombreDepuisCsv('\u22121\u202f500,000'), -1500);
    assert.strictEqual(KC.nombreStrict('\u2212500,000'), -500);
    assert.ok(Number.isNaN(KC.nombreStrict('150 DT')), 'une unité n\'est pas un chiffre : elle se refuse, elle ne se devine pas');
    assert.ok(Number.isNaN(KC.nombreStrict('\u2212')), 'un moins seul n\'est pas un montant');
  });

  t('MC-05 : un montant se cherche comme l\'écran l\'écrit — « 1 200 », « 1 200,000 », « 1.200,000 », « 1 200 DT »', () => {
    const livre = { ecritures: [
      { id: 'a', date: '2026-03-04', journal: 'AC', piece: 'X', libelle: 'Loyer', statut: 'validee', lignes: [{ compte: '613', debit: 1200, credit: 0 }, { compte: '512', debit: 0, credit: 1200 }] },
      { id: 'b', date: '2026-03-05', journal: 'AC', piece: 'Y', libelle: 'Autre', statut: 'validee', lignes: [{ compte: '613', debit: 50, credit: 0 }, { compte: '512', debit: 0, credit: 50 }] }] };
    ['1200', '1200,000', '1 200', '1\u202f200,000', '1.200,000', '1 200 DT', '\u22121 200'].forEach(q =>
      assert.deepStrictEqual(KC.chercherEcritures(livre, q).map(e => e.id), ['a'], 'introuvable : ' + q));
  });

  t('MC-02 : une case de montant illisible se REFUSE avant le geste, dans toutes les fenêtres du Cabinet — et un montant prérempli se complète avant l\'instantané', () => {
    const m = trancheCab('  function modal(html, onMount, onDismiss, opts) {', '  function suivreSaisie(layer) {');
    const c = m.indexOf('$$(SEL_MONTANT, layer).forEach(completerMontant)');
    const g = m.indexOf('gardeAuto = suivreSaisie(layer)');
    assert.ok(c > 0 && c < g, 'les montants se complètent après l\'instantané : fermer une fenêtre intacte demanderait « Abandonner cette saisie ? »');
    assert.ok(/layer\.addEventListener\('click', e => \{[\s\S]{0,400}const ko = montantIllisibleDans\(layer\)[\s\S]{0,200}stopImmediatePropagation\(\)[\s\S]{0,200}refus\(ko,[\s\S]{0,200}?\}, true\);/.test(m),
      'une case illisible n\'est plus refusée avant le gestionnaire du bouton (capture)');
    // La case cherchée est une case VISIBLE et modifiable : un champ caché ou grisé ne se refuse pas.
    const dans = (cab.match(/const montantIllisibleDans = root => [^\n]+/) || [''])[0];
    assert.ok(/!el\.disabled/.test(dans) && /offsetParent !== null/.test(dans) && /montantIllisible\(el\.value\)/.test(dans), 'la case refusée est cherchée sans sa règle : ' + dans);
    // Et les APERÇUS le disent aussi : un bien de « 85 000 DT » ne s'annonce pas amorti sur zéro.
    ['const val = illisible ? { ok: false, motifs: [motifIllisible(illisible.value)] } : KC.immoValide(p);',
      'const verdict = illisible ? { ok: false, motif: motifIllisible(illisible.value) } : KC.bulletinValide(v, L, baremes);']
      .forEach(x => assert.ok(cab.includes(x), 'un aperçu calcule sur une case illisible comme si elle valait zéro : ' + x.slice(0, 60)));
    // Les deux portes, et deux seulement : la complétion et la case refusée passent par elles.
    const comp = trancheCab('  function completerMontant(el) {', '  document.addEventListener(\'focusout\'');
    assert.ok(/montantIllisible\(brut\)/.test(comp) && /lireMontant\(brut\)/.test(comp) && !/KC\.nombreStrict/.test(comp), 'la complétion lit les montants par sa propre porte');
  });

  t('MC-03 : « Retirer » une ligne de la reprise relit d\'abord l\'écran — les montants corrigés ne reviennent pas', () => {
    const r = trancheCab('  function repriseForm(root, dossier) {', '        $(\'#rf-csv\', rootModal).onclick');
    assert.ok(/b\.onclick = \(\) => \{ lignes = lireRangees\(\); lignes\.splice\(/.test(r), 'Retirer retire dans l\'état d\'avant la dernière frappe');
    assert.ok(/\$\('#rf-add', rootModal\)\.onclick = \(\) => \{ lignes = lireRangees\(\)/.test(r), 'Ajouter relit les montants sans leur frappe');
    assert.ok(/value="\$\{esc\(montantRepris\(l\.debit\)\)\}"/.test(r) && /value="\$\{esc\(montantRepris\(l\.credit\)\)\}"/.test(r), 'une ligne relue s\'écrit à la machine');
    // MC-04 : un montant importé (un nombre) s'écrit en français, un zéro laisse la case vide.
    assert.ok(/const montantRepris = v => typeof v === 'number' \? montantChamp\(v\)/.test(r), 'une ligne importée s\'écrit « 250.125 »');
    assert.ok(/const montantChamp = n => \{ const v = Number\(n\); return v \? /.test(cab), 'un zéro repris s\'écrit « 0 »');
    // MC-09 : un abonnement rouvert réaffiche son montant comme on l'a tapé.
    assert.ok(/id="ab-montant" class="num montant" inputmode="decimal" value="\$\{esc\(montantChamp\(a\.montant\)\)\}"/.test(cab), 'un abonnement rouvert s\'écrit « 1250.5 »');
  });

  t('MC-13 : le début de mission se tape et se relit comme un comptable l\'écrit — « 01/2026 », et un mois faux se refuse en montrant la case', () => {
    const K = require('../../src/cabinet/cabcore.js');
    assert.deepStrictEqual(['01/2026', '1/2026', '01-2026', '2026-01', ''].map(x => K.moisTape(x).mois), ['2026-01', '2026-01', '2026-01', '2026-01', '']);
    for (const faux of ['13/2026', '2026', 'janv', '00/2026']) assert.strictEqual(K.moisTape(faux).ok, false, faux + ' passe pour un mois');
    assert.strictEqual(K.moisAffiche('2026-01'), '01/2026');
    // Les deux fenêtres : la case s'affiche en français, se lit par moisTape, et se REFUSE en la montrant —
    // la création d'un dossier effaçait en silence un mois tapé « 01/2026 ».
    assert.ok(/id="f-from" value="\$\{esc\(K\.moisAffiche\(d\.from\)\)\}" placeholder="01\/2026"/.test(cab), 'la case affiche « 2026-01 »');
    assert.ok(/const from = K\.moisTape\(\$\('#f-from', layer\)\.value\);/.test(cab) && /from: from\.ok \? from\.mois : ''/.test(cab));
    assert.strictEqual((cab.match(/if \(!mois\.ok\) return refus\(\$\('#f-from', layer\), mois\.motif\);/g) || []).length, 2, 'une des deux fenêtres ne refuse pas un mois faux');
    assert.ok(!/s\\'écrit comme 2026-01/.test(cab), 'le refus réclame encore l\'écriture machine');
  });

  t('MC-14 : un dossier tenu au cabinet avec un début de mission n\'est jamais relancé — ses mois sont à SAISIR, pas des paquets manquants', () => {
    const K = require('../../src/cabinet/cabcore.js');
    const jour = '2026-09-25';
    const S = K.migrate({ settings: { relanceDay: 10 }, dossiers: [
      { id: 'h', name: 'Test Mission SARL', manual: true, from: '2026-01', packs: [] },
      { id: 'r', name: 'Retardataire', packs: [{ month: '2026-06', definitive: true, missing: [] }] }
    ] });
    const hors = S.dossiers.find(d => d.id === 'h');
    // Le début de mission compte toujours (audit D3) : il dit d'où partent les mois à saisir…
    const mois = K.dossierMonths(hors, jour);
    assert.deepStrictEqual(mois.map(m => m.month), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
    // … mais aucun n'est un paquet manquant.
    assert.deepStrictEqual([...new Set(mois.map(m => m.state))], ['tenu'], 'un mois d\'un dossier tenu au cabinet se lit « manquant »');
    const row = K.dossierRow(hors, jour, 10);
    assert.strictEqual(row.missingCount, 0, 'la fiche annonce « 8 manquants » et propose « Relancer »');
    assert.strictEqual(row.level, 'hors');
    // Ni dans les Relances, ni dans « À faire » comme retardataire.
    assert.deepStrictEqual(K.relanceRows(S, jour).map(r => r.name), ['Retardataire'], 'il figure dans les Relances');
    const todo = K.cabinetTodo(S, jour, {});
    const tard = todo.find(x => x.id === 'manquants');
    assert.ok(tard && !/Test Mission/.test(tard.detail), '« n\'ont pas tout envoyé » le nomme');
    const rel = todo.find(x => x.id === 'jour-de-relance');
    assert.ok(rel && /1 dossier à relancer/.test(rel.label), 'le jour de relance le compte : ' + (rel && rel.label));
    // Les Échéances : la TVA d'août le compte À SAISIR (le travail du cabinet), jamais « n'a pas envoyé ».
    const tvaAout = K.echeances(S, jour, {}).find(e => e.id === 'tva-m' && e.mois.includes('2026-08'));
    assert.ok(tvaAout, 'la TVA d\'août n\'est plus au calendrier');
    assert.ok(!tvaAout.manquants.includes('Test Mission SARL'), 'la TVA d\'août dit qu\'il « n\'a pas envoyé son mois »');
    assert.ok(tvaAout.aSaisir.includes('Test Mission SARL'), 'la TVA d\'août ne le compte pas à saisir : ' + JSON.stringify(tvaAout.aSaisir));
    const ech = todo.find(x => x.id === 'echeance');
    assert.ok(ech && /: 1 client n'a pas envoyé son mois, 1 autre tenu au cabinet est encore à saisir$/.test(ech.label),
      '« À faire » : ' + (ech && ech.label));
    // La fiche : sans manque, ni « Relancer » ni « Ce client est à jour » — il n'est pas « à jour », il est tenu.
    assert.ok(/dossier\.manual \? 'Tenu au cabinet : SkanFact ne lui réclame rien\. '/.test(cab), 'la fiche d\'un dossier tenu dit « Ce client est à jour »');
  });

  t('MC-10 : un taux s\'écrit avec sa virgule — jamais « 9.18 % de 1 500,000 DT »', () => {
    const brut = cab.split('\n').filter(l => /\$\{(?:r\.\w+|f\.taux\w*|L\.tauxImpot)\} ?%/.test(l) || /String\(f\.taux/.test(l) || /String\(L\.tauxImpot\)/.test(l));
    assert.deepStrictEqual(brut.map(l => l.trim().slice(0, 80)), [], 'des taux s\'affichent encore à la machine');
    const taux = vm.runInNewContext('(' + /const taux = (v => \{[^\n]*\});/.exec(cab)[1] + ')', {});
    assert.deepStrictEqual([taux(9.18), taux(0.4), taux(22.5), taux(19), taux(null)], ['9,18', '0,4', '22,5', '19', '']);
  });

  t('M-02 / MR-04 / DEV-13 / MR-05 : une relance réclame le RESTE dû, dans la langue du mail — et l\'envoi d\'une facture n\'appelle pas « TTC » un net après retenue', () => {
    const CO = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', currency: 'DT', stampFee: 1 };
    // À la main : 1 000 HT + 190 de TVA + 1 de timbre = 1 191 DT ; payée de 1 000, il reste 191.
    const f = { id: 'f', type: 'facture', number: 'FAC-2026-009', status: 'envoyée', clientId: 'c', date: '2026-06-01', dueDate: '2026-07-01',
      applyStamp: true, lines: [{ label: 'Pose', qty: 1, unitPrice: 1000, vatRate: 19 }], payments: [{ id: 'p', date: '2026-06-15', amount: 1000 }] };
    const data = { documents: [f], clients: [{ id: 'c', name: 'ACME', email: 'a@b.tn' }] };
    ['relance1', 'relance2', 'relance3'].forEach(k => {
      const m = core.emailFor(k, f, data.clients[0], CO, { jours: 20 }, data);
      assert.ok(m.body.includes('191,000\u00a0DT') && !m.body.includes('1\u00a0191'), k + ' : la relance réclame le total au client qui a déjà versé 1 000 DT : ' + m.body);
    });
    // Un mail anglais écrit ses montants comme le PDF anglais joint.
    const impayee = { ...f, lang: 'en', payments: [] };
    const en = core.emailFor('relance2', impayee, data.clients[0], CO, { jours: 20 }, { ...data, documents: [impayee] });
    assert.ok(en.body.includes('1,191.000\u00a0DT'), 'le mail anglais écrit le montant à la française : ' + en.body);
    // Une facture avec retenue : le montant envoyé est le NET après retenue, et le mail ne l'appelle plus TTC.
    const rs = { ...f, payments: [], withholdingRate: 1.5 };
    const envoi = core.emailFor('facture', rs, data.clients[0], CO, {}, { ...data, documents: [rs] });
    assert.ok(!/\{?montant\}? TTC|DT TTC/.test(envoi.body), 'le mail appelle « TTC » le net après retenue : ' + envoi.body);
  });

  t('M-01 / DEV-06 / DEV-07 : un prix et un coût du catalogue (en dinars) se convertissent au taux d\'une pièce en euros — jamais 150 DT recopiés en 150 €', () => {
    const CO = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', currency: 'DT' };
    const eur = { type: 'facture', currency: 'EUR', exchangeRate: 3.4 };
    // À la main : 150 DT / 3,4 = 44,117… → 44,12 € ; 60 DT / 3,4 = 17,647… → 17,65 €.
    assert.strictEqual(core.prixDuCatalogue(150, eur, CO), 44.12);
    assert.strictEqual(core.prixDuCatalogue(60, eur, CO), 17.65);
    assert.strictEqual(core.prixDuCatalogue(150, { type: 'facture', currency: 'DT' }, CO), 150, 'une pièce en dinars garde le prix tel quel');
    assert.strictEqual(core.prixDuCatalogue(150, { type: 'facture', currency: 'EUR' }, CO), null, 'sans taux, la conversion est impossible : rien d\'inventé');
    assert.strictEqual(core.prixDuCatalogue('', eur, CO), '', 'un coût vide reste vide');
    // La marge d'une vente en euros : le coût du catalogue (60 DT) se lit 17,65 €, jamais 60 €.
    const data = { catalog: [{ id: 'k', label: 'Audit', unitPrice: 150, unitCost: 60 }] };
    const doc = { ...eur, lines: [{ label: 'Audit', qty: 1, unitPrice: 44.12, vatRate: 0 }] };
    const m = core.documentMargin(doc, data, CO);
    assert.strictEqual(m.cost, 17.65, 'le coût en dinars est compté comme des euros : ' + m.cost);
    assert.strictEqual(m.margin, 26.47);
    // Les deux éditeurs passent par la conversion, pour le prix affiché comme pour la ligne posée.
    ['const pu = C.prixDuCatalogue(it.unitPrice, doc, company())', 'right: prixAffiche(c)', 'doc.lines.push({ qty: 1, ...depuisCatalogue(it) })',
      'Object.assign(l, depuisCatalogue(it))', 'C.prixDuCatalogue(Number(it.unitCost) || Number(it.unitPrice) || 0, p, company())', 'unitPrice: coutCatalogue(it)']
      .forEach(x => assert.ok(app.includes(x), 'un chemin du catalogue recopie le prix sans le convertir : ' + x));
    assert.ok(!/unitPrice: it\.unitPrice, unitCost: it\.unitCost/.test(app.replace(/\/\/.*$/gm, '').replace(/function templateForm[\s\S]*?\n  }\n/, '')), 'un chemin recopie encore le prix brut du catalogue');
  });

  t('M-06 : modifier un modèle — la frappe met à jour la donnée et les totaux, jamais les lignes (« 250 » ne devient plus « 2 »)', () => {
    const f = tranche('  function templateForm(tpl, done) {', '  function applyTemplate(');
    const gest = (f.match(/forEach\(el => el\.oninput = el\.onchange = \(\) => \{[\s\S]*?\n          \}\);/) || [''])[0];
    assert.ok(gest, 'gestionnaire de frappe introuvable');
    assert.ok(!/drawLines\(\)/.test(gest), 'la frappe redessine les lignes : le champ est détruit sous le curseur');
    assert.ok(/majSomme\(\)/.test(gest) && /td\.total/.test(gest), 'la frappe ne met plus à jour le total de la ligne ni la somme');
  });

  t('MR-01 : « Transformer ▾ » en facture prend l\'exonération de timbre et la retenue du client — comme « Facturer ce devis »', () => {
    const CO = { currency: 'DT', paymentTermsDays: 30, stampFee: 1, taxRegime: 'reel', defaultWithholdingRate: 0 };
    const client = { id: 'c', name: 'Administration', stampExempt: true, withholdingRate: 1.5 };
    const lignes = [{ label: 'Maintenance', qty: 1, unitPrice: 1000, vatRate: 19 }];
    // Un bon de livraison ne porte pas de retenue : la facture qu'on en tire prend celle du client.
    const bl = { id: 'bl', type: 'livraison', number: 'BL-2026-001', clientId: 'c', date: '2026-03-01', lines: lignes, withholdingRate: 0, createdAt: 1 };
    const fac = core.convertDoc(bl, 'facture', CO, '2026-03-10', client);
    assert.strictEqual(fac.applyStamp, false, 'un client exonéré reçoit une facture avec un timbre');
    assert.strictEqual(fac.withholdingRate, 1.5, 'la retenue du client est perdue en passant par un bon de livraison');
    // À la main : 1 000 HT + 190 de TVA = 1 190 TTC ; aucun timbre ; retenue 1,5 % de 1 190 = 17,850 ;
    // net 1 190 − 17,850 = 1 172,150.
    const tt = core.computeTotals(fac, CO);
    assert.strictEqual(tt.totalTTC, 1190);
    assert.strictEqual(tt.withholding, 17.85);
    assert.strictEqual(tt.netToPay, 1172.15);
    // Une proforma PORTE une retenue : celle qu'on y a choisie reste, même 0 %.
    const pro = { ...bl, id: 'pro', type: 'proforma', withholdingRate: 0 };
    assert.strictEqual(core.convertDoc(pro, 'facture', CO, '2026-03-10', client).withholdingRate, 0,
      'la conversion défait la retenue choisie sur la proforma');
    // Un client ordinaire garde son timbre.
    assert.strictEqual(core.convertDoc(bl, 'facture', CO, '2026-03-10', { id: 'c', name: 'X' }).applyStamp, true);
    // Et l'appelant passe le client.
    const tp = tranche('  function transformerPiece(src, t) {', '\n  }\n');
    assert.ok(/C\.convertDoc\(src, t, company\(\), C\.today\(\), clientById\(src\.clientId\)\)/.test(tp),
      '« Transformer ▾ » ne donne pas le client à la conversion');
  });

  t('M-09 / DEV-11 : le seuil de retenue (en dinars) se compare au TTC CONVERTI d\'une facture en devise', () => {
    const CO = { currency: 'DT', stampFee: 1, taxRegime: 'reel', withholdingThreshold: 1000 };
    const fac = (unitPrice, currency, exchangeRate) => ({ id: 'f', type: 'facture', currency, exchangeRate, withholdingRate: 1.5,
      applyStamp: false, lines: [{ label: 'Service', qty: 1, unitPrice, vatRate: 19 }] });
    // 300 € HT + 19 % = 357,00 € ; à 3,4 → 1 213,800 DT : AU-DESSUS du seuil de 1 000 DT. L'ancien
    // calcul comparait 357 à 1 000 et avertissait à tort.
    assert.strictEqual(core.sousSeuilRetenue(fac(300, 'EUR', 3.4), CO), null, 'une facture de 1 213,800 DT est dite « sous le seuil » de 1 000 DT');
    // 200 € HT → 238,00 € → 809,200 DT : sous le seuil, avec sa contre-valeur.
    const s1 = core.sousSeuilRetenue(fac(200, 'EUR', 3.4), CO);
    assert.ok(s1, 'une facture de 809,200 DT n\'est pas dite sous le seuil de 1 000 DT');
    assert.strictEqual(s1.ttc, 238); assert.strictEqual(s1.ttcBase, 809.2); assert.strictEqual(s1.taux, 1.5);
    // En dinars : 800 HT → 952 TTC, sous le seuil ; 900 HT → 1 071, au-dessus.
    assert.ok(core.sousSeuilRetenue(fac(800, 'DT'), CO));
    assert.strictEqual(core.sousSeuilRetenue(fac(900, 'DT'), CO), null);
    // Sans taux saisi, on ne compare rien (la pièce ne peut pas être émise).
    assert.strictEqual(core.sousSeuilRetenue(fac(200, 'EUR', ''), CO), null);
    // Sans retenue, ou sans seuil réglé, rien.
    assert.strictEqual(core.sousSeuilRetenue({ ...fac(200, 'DT'), withholdingRate: 0 }, CO), null);
    assert.strictEqual(core.sousSeuilRetenue(fac(200, 'DT'), { ...CO, withholdingThreshold: 0 }), null);
    // L'avertissement dit la contre-valeur d'une pièce en devise.
    const iw = tranche('    function issueWarnings() {', '    async function premierEnvoiOk()');
    assert.ok(/C\.sousSeuilRetenue\(doc, co\)/.test(iw) && /soit \$\{C\.money\(sous\.ttcBase, co\.currency\)\}/.test(iw),
      'l\'avertissement ne passe pas par la comparaison convertie, ou tait la contre-valeur');
  });

  t('M-08 / DEV-08 : un contrat récurrent porte sa devise — celle du client, ses totaux dedans, son taux obligatoire — et la retenue du client', () => {
    const f = tranche('  function recurrenceForm(rec, done) {', '  // Génère les brouillons de factures dus');
    assert.ok(/let cur = C\.normCurrency\(r\.currency \|\| co0\.currency\)/.test(f), 'le formulaire compte en dinars quoi que porte le contrat');
    assert.ok(/<select name="currency">/.test(f) && /name="exchangeRate"/.test(f), 'le formulaire n\'a ni devise ni taux');
    // Les totaux se calculent dans la devise du contrat (le timbre converti avec lui).
    assert.ok(/C\.computeTotals\(\{ type: 'facture', lines: r\.lines,[^}]*currency: cur, exchangeRate:/.test(f), 'les totaux du contrat ignorent sa devise');
    assert.ok(!/C\.money\([^)]*company\(\)\.currency\)/.test(f), 'un montant du contrat s\'annonce dans la devise de la société');
    // Choisir le client pose sa devise et sa retenue (tant qu'on n'a pas touché à la retenue).
    const poser = (f.match(/const poserClient = id => \{[\s\S]*?\n        \};/) || [''])[0];
    assert.ok(/c\.currency/.test(poser) && /clientWithholding\(id\)/.test(poser) && /retenueTouchee/.test(poser), 'choisir le client ne pose ni sa devise ni sa retenue');
    assert.ok(/onPick: id => poserClient\(id\)/.test(f), 'le choix du client n\'est pas branché');
    // Le taux est obligatoire en devise, et l'enregistrement range la devise.
    assert.ok(/if \(enDevise\(\) && !\(Number\(v\.exchangeRate\) > 0\)\) return refus\(txTaux/.test(f), 'un contrat en devise s\'enregistre sans taux');
    assert.ok(/currency: cur, exchangeRate: enDevise\(\) \? Number\(v\.exchangeRate\) : ''/.test(f), 'l\'enregistrement ne range pas la devise du contrat');
    // Et le moteur reporte la devise et le taux du contrat sur la facture qu'il prépare.
    const inv = core.buildRecurringInvoice({ id: 'r', clientId: 'c', subject: 'Maintenance — {mois}', lines: [{ label: 'M', qty: 1, unitPrice: 100, vatRate: 19 }], currency: 'EUR', exchangeRate: 3.4, withholdingRate: 1.5 },
      '2026-10-01', { currency: 'DT', stampFee: 1, paymentTermsDays: 30 }, { id: 'c' });
    assert.strictEqual(inv.currency, 'EUR'); assert.strictEqual(inv.exchangeRate, 3.4); assert.strictEqual(inv.withholdingRate, 1.5);
  });

  t('H-V2-01 : sans taux de change, l\'étiquette du timbre dit « 1,000 DT, converti au taux » — jamais « 1,00 EUR »', () => {
    const src = tranche('    const timbreAffiche = () => {', '    // Attribuer des numéros de série');
    const jouer = (doc) => vm.runInNewContext(src + '\nlibelleTimbre();', { C: core, doc, cur: core.normCurrency(doc.currency || 'DT'), company: () => ({ currency: 'DT', stampFee: 1 }) });
    const lignes = [{ label: 'X', qty: 1, unitPrice: 100, vatRate: 19 }];
    assert.strictEqual(jouer({ type: 'facture', currency: 'EUR', exchangeRate: '', applyStamp: true, lines: lignes }), core.money(1, 'DT') + ', converti au taux');
    // Avec le taux : le timbre converti, au centime (1 / 3,4 = 0,29 €).
    assert.strictEqual(jouer({ type: 'facture', currency: 'EUR', exchangeRate: 3.4, applyStamp: true, lines: lignes }), core.money(0.29, 'EUR'));
    // En dinars : le timbre lui-même.
    assert.strictEqual(jouer({ type: 'facture', currency: 'DT', applyStamp: true, lines: lignes }), core.money(1, 'DT'));
  });

  t('DEV-14 : le récapitulatif d\'émission d\'une pièce en devise dit son taux et sa contre-valeur en dinars — ce que la comptabilité retiendra', () => {
    const f = tranche('  function confirmerEmission(doc, numero, avertissements, opts) {', '    return new Promise(resolve => {');
    const r = tranche('  function confirmerEmission(doc, numero, avertissements, opts) {', '        <p class="small">Le numéro devient définitif');
    assert.ok(f.length > 500 && r.length > f.length, 'tranche du récapitulatif suspecte');
    assert.ok(/ligne\('Taux de change', `1 \$\{h\(cur\)\} = \$\{C\.money\(C\.rateOf\(doc, company\(\)\), company\(\)\.currency\)\}/.test(r),
      'le récapitulatif ne dit pas le taux de la pièce en devise');
    assert.ok(/C\.money\(C\.toBase\(doc, t\.netToPay, company\(\)\), company\(\)\.currency\)/.test(r),
      'le récapitulatif ne dit pas la contre-valeur en dinars');
    // Seulement en devise, et seulement quand le taux est connu (sinon l'émission est refusée).
    assert.ok(/C\.normCurrency\(cur\) !== C\.normCurrency\(company\(\)\.currency\) && !C\.missingRate\(doc, company\(\)\)/.test(r),
      'la ligne du taux s\'affiche sans condition');
  });

  t('AN-01 : dans un lot, la chaîne de TVA et les régularisations de retenue se calculent une fois — mêmes chiffres, et des COPIES', () => {
    const CO = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', matricule: '1234567A', stampFee: 1 };
    const d = core.migrateData(require('../../src/renderer/demo.js').buildDemoData(CO, core.today()));
    const co = d.company;
    const annee = String(Number(core.today().slice(0, 4)) - 1);
    const hors = core.vatChain(d, co, annee, 12);
    const hors3 = core.vatChain(d, co, annee, 3);
    core.enLot(() => {
      const dans = core.vatChain(d, co, annee, 12);
      assert.deepStrictEqual(dans, hors, 'la chaîne d\'une année diffère dans un lot');
      // Le début de la chaîne entière est la chaîne coupée au mois demandé.
      assert.deepStrictEqual(core.vatChain(d, co, annee, 3), hors3, 'la chaîne coupée à mars diffère dans un lot');
      // Un appelant qui annote ne fausse pas le suivant.
      dans[0].collected = -1; dans[0].byRate[19] = null; dans.length = 1;
      assert.deepStrictEqual(core.vatChain(d, co, annee, 12), hors, 'la chaîne rendue par le lot est partagée : un appelant l\'a modifiée');
      // La page TVA d'un mois, dans un lot, dit ce qu'elle dit hors lot (régularisations comprises).
      for (let m = 1; m <= 12; m++) {
        const from = annee + '-' + String(m).padStart(2, '0') + '-01';
        const to = annee + '-' + String(m).padStart(2, '0') + '-28';
        const a = core.retenuesDeLaPeriode(d, co, { from, to }, 'ventes');
        const b = core.retenuesDeLaPeriode(d, co, { from, to }, 'achats');
        a.lignesRegul.forEach(r => { r.rs = 999; });
        const a2 = core.retenuesDeLaPeriode(d, co, { from, to }, 'ventes');
        assert.ok(a2.lignesRegul.every(r => r.rs !== 999), 'les régularisations rendues par le lot sont partagées');
        assert.strictEqual(a2.total, a.total); assert.ok(Number.isFinite(b.total));
      }
    });
    // Des données qui DISCRIMINENT (l'exemple ne porte aucune régularisation) : une facture payée en
    // mars, un avoir en mai. À la main : 200 HT × 1,19 × 1,5 % = 3,570 de retenue à régulariser en mai.
    const L = p => [{ label: 'S', qty: 1, unitPrice: p, vatRate: 19 }];
    const r = core.migrateData({ company: CO, clients: [{ id: 'c', name: 'C' }], purchases: [], suppliers: [], documents: [
      { id: 'F', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', clientId: 'c', date: '2026-03-01', dueDate: '2026-04-01', withholdingRate: 1.5, applyStamp: false, lines: L(1000), payments: [{ date: '2026-03-10', amount: 1172.15, mode: 'virement' }], createdAt: 1 },
      { id: 'A', type: 'avoir', number: 'AVO-2026-001', status: 'envoyée', clientId: 'c', creditOf: 'F', date: '2026-05-05', withholdingRate: 1.5, lines: L(200), createdAt: 2 }] });
    const mai = { from: '2026-05-01', to: '2026-05-31' };
    assert.deepStrictEqual(core.regularisationsRetenueVentes(r, r.company, mai).map(x => x.rs), [-3.57]);
    core.enLot(() => {
      const x = core.regularisationsRetenueVentes(r, r.company, mai);
      assert.deepStrictEqual(x.map(y => y.rs), [-3.57], 'dans un lot, la régularisation de mai change');
      x[0].rs = 999;
      assert.deepStrictEqual(core.regularisationsRetenueVentes(r, r.company, mai).map(y => y.rs), [-3.57], 'la régularisation rendue par le lot est partagée : un appelant l\'a modifiée');
      assert.deepStrictEqual(core.regularisationsRetenueVentes(r, r.company, { from: '2026-03-01', to: '2026-03-31' }), [], 'une régularisation sort de son mois dans un lot');
    });
  });

  t('MC-08 : un mois reçu deux fois DIT de combien ses chiffres ont bougé', () => {
    const src = trancheCab('  function importLine(x) {', '    bits.push(x.nowDefinitive');
    assert.ok(/x\.ecart/.test(src) && /chiffre d'affaires \$\{signe\(e\.ca\)\}, TVA à décaisser \$\{signe\(e\.tvaADecaisser\)\}/.test(src) && /chiffres inchangés/.test(src),
      'le rapport d\'import tait l\'écart que le moteur calcule');
  });

  t('CA-01 : une reprise ne pose qu\'un exercice qui finit le 31 décembre — le suivant naissait neuf mois plus tard', () => {
    // Le défaut : un exercice du 01/04/2023 au 31/03/2024, repris sous « 2024 », et l'exercice suivant
    // ouvert du 01/01/2025 au 31/12/2025 — avril à décembre 2024 n'appartenaient à aucun livre.
    const r = KC.exerciceDeReprise(2024, '2023-04-01', '2024-03-31');
    assert.strictEqual(r.ok, false, 'un exercice décalé est accepté');
    assert.strictEqual(r.champ, 'au', 'le refus doit montrer la case « Au »');
    assert.ok(/31\/12\/2024/.test(r.motif) && /À VÉRIFIER/.test(r.motif), 'le refus dit la date attendue et le doute : ' + r.motif);
    // Un premier exercice plus court (une société créée en avril) reste possible : il finit le 31/12.
    assert.deepStrictEqual(KC.exerciceDeReprise(2024, '2024-04-01', '2024-12-31'), { ok: true, du: '2024-04-01', au: '2024-12-31' });
    assert.deepStrictEqual(KC.exerciceDeReprise('2024', '', ''), { ok: true, du: '2024-01-01', au: '2024-12-31' }, 'les dates vides valent l\'année civile');
    assert.strictEqual(KC.exerciceDeReprise(2024, '2023-07-01', '2024-12-31').champ, 'du', 'un exercice de dix-huit mois passe');
    assert.strictEqual(KC.exerciceDeReprise(2024, '2024-12-31', '2024-12-30').ok, false, 'une fin avant le début passe');
    assert.strictEqual(KC.exerciceDeReprise('24', '', '').champ, 'annee');
    assert.strictEqual(KC.exerciceDeReprise(2024, '2024-02-30', '2024-12-31').champ, 'du', 'le 30 février passe');
    // Le pont refuse aussi — une porte ne dépend pas de chacun de ses appelants —, avant le livre.
    const main = fs.readFileSync(path.join(__dirname, '../../src/cabinet/main.js'), 'utf8');
    const h = main.slice(main.indexOf("ipcMain.handle('cab:reprendre'"), main.indexOf("ipcMain.handle('", main.indexOf("ipcMain.handle('cab:reprendre'") + 10));
    const iGarde = h.indexOf('exerciceDeReprise('); const iLivre = h.indexOf('livreVide(');
    assert.ok(iGarde > 0 && iLivre > iGarde && /if \(!ex\.ok\) throw erreur\(/.test(h), 'le pont crée le livre sans juger l\'exercice');
    assert.ok(/livreVide\(dossierId, annee, \{ du: ex\.du, au: ex\.au/.test(h), 'le livre ne prend pas les dates jugées');
    // La fenêtre juge par la MÊME fonction, montre la case, et le verdict se lit pendant la saisie.
    const f = trancheCab("        $('#ok', rootModal).onclick = async () => {\n          const f = $('#rf', rootModal);", '            const r = await api.reprendre(');
    assert.ok(/KC\.exerciceDeReprise\(/.test(f) && /return refus\(/.test(f), 'la fenêtre envoie un exercice décalé au pont sans le refuser');
    const m = trancheCab('        const majExo = () => {', "        $('#rf-add', rootModal).onclick");
    assert.ok(/KC\.exerciceDeReprise\(/.test(m) && /addEventListener\('input', majExo\)/.test(m), 'le verdict ne se lit pas pendant la saisie');
    assert.ok(/=== `\$\{anneeVue\}-01-01`\) champ\('du'\)\.value = `\$\{a\}-01-01`/.test(m), 'les dates ne suivent pas l\'année tapée');
  });

  t('CA-02 : un exercice rouvert qui change un mois DÉJÀ déposé ne se reclôture plus en silence — le contrôle confronte la déclaration au livre', () => {
    // Calculé à la main : décembre porte une vente de 1 000 HT (TVA 190), déclarée et déposée ; on rouvre
    // pour une vente oubliée de 500 HT (TVA 95). Le livre dit 285, le dépôt 190.
    let q = 1;
    const passer = (livre, ecr) => { const e = KC.ajouterEcriture(livre, ecr, 'cab', q++); KC.validerEcriture(livre, e.id, 'cab', q++); return e; };
    const livre = KC.livreVide('D1', 2024);
    KC.balanceOuverture(livre, [{ compte: '512', debit: 10000, credit: 0 }, { compte: '101', debit: 0, credit: 10000 }], '2024-01-01', 'balance', 'cab', q++);
    passer(livre, { journal: 'VT', date: '2024-12-05', piece: 'FAC-1', libelle: 'Vente', lignes: [{ compte: '411', debit: 1190, credit: 0 }, { compte: '706', debit: 0, credit: 1000 }, { compte: '4367', debit: 0, credit: 190 }] });
    const decl = KC.declarationMensuelle(livre, '2024-12');
    passer(livre, KC.ecritureDeclaration(livre, decl));
    KC.poserDeclaration(livre, decl, 'cab', q++);
    assert.ok(KC.pointerDeclaration(livre, '2024-12', 'deposee', { le: '2025-01-15' }, 'cab', q++).ok);
    const ctrl = () => KC.controlesCloture(livre, {}).find(c => c.id === 'declarations');
    assert.ok(ctrl() && ctrl().ok, 'une déclaration à jour est signalée périmée : ' + JSON.stringify(ctrl()));
    assert.ok(KC.cloturerExercice(livre, 'cab', q++).ok);
    assert.ok(KC.rouvrirExercice(livre, 'Vente de décembre oubliée', 'cab', q++).ok);
    passer(livre, { journal: 'VT', date: '2024-12-28', piece: 'FAC-2', libelle: 'Vente oubliée', lignes: [{ compte: '411', debit: 595, credit: 0 }, { compte: '706', debit: 0, credit: 500 }, { compte: '4367', debit: 0, credit: 95 }] });
    const c = ctrl();
    assert.ok(c && c.ok === false, 'le contrôle de clôture juge en règle un mois dont le dépôt ne correspond plus au livre');
    assert.ok(/décembre 2024/.test(c.detail) && /190,000/.test(c.detail) && /285,000/.test(c.detail), 'le contrôle ne nomme pas le mois et ses deux chiffres : ' + c.detail);
    assert.ok(/rectificative/.test(c.detail) && /À VÉRIFIER/.test(c.detail), 'une déposée périmée doit dire la rectificative, avec son doute');
    // Il nomme, il ne bloque pas (règle 6.0.0).
    assert.ok(KC.cloturerExercice(livre, 'cab', q++).ok, 'le contrôle bloque la clôture');
    // L'écran le nomme : le libellé existe dans la table des contrôles.
    assert.ok(/declarations: '/.test(cab), 'le contrôle neuf n\'a pas de libellé à l\'écran : il s\'afficherait sous son identifiant');
  });

  t('MR-02 : passé au réel, un contrat ou un modèle né au forfait ne fabrique plus de factures sans TVA en silence', () => {
    const reel = { taxRegime: 'reel', defaultVatRate: 19, currency: 'DT', stampFee: 1 };
    const forfait = { ...reel, taxRegime: 'forfaitaire' };
    const ligne = (label, prix, tva, extra) => ({ label, qty: 1, unitPrice: prix, vatRate: tva, ...(extra || {}) });
    const data = {
      recurring: [
        { id: 'r1', clientId: 'c1', subject: 'Maintenance', active: true, lines: [ligne('Maintenance mensuelle', 250, 0), ligne('Hébergement', 40, 19)] },
        { id: 'r2', clientId: 'c1', subject: 'Suspendu', active: false, lines: [ligne('Ancien', 100, 0)] },
        { id: 'r3', clientId: 'c1', subject: 'Taxé', active: true, lines: [ligne('Audit', 900, 19)] }
      ],
      templates: [
        { id: 't1', name: 'Pose', lines: [ligne('Pose', 1000, 0)] },
        { id: 't2', name: 'Taxé', lines: [ligne('Pose', 1000, 19)] },
        { id: 't3', name: 'Vide', lines: [ligne('', 0, 0), ligne('Déduction acompte', -300, 0, { noDiscount: true })] }
      ]
    };
    const src = core.sourcesSansTva(data, reel);
    assert.deepStrictEqual(src.contrats.map(r => r.id), ['r1'], 'un contrat suspendu, ou entièrement taxé, n\'a rien à signaler');
    assert.deepStrictEqual(src.modeles.map(t => t.id), ['t1'], 'une ligne sans libellé ou de déduction d\'acompte ne facture rien');
    // Rien à dire quand l'entreprise ne facture pas de TVA, ni quand son taux par défaut est 0 %.
    assert.deepStrictEqual(core.sourcesSansTva(data, forfait), { contrats: [], modeles: [] });
    assert.deepStrictEqual(core.sourcesSansTva(data, { ...reel, defaultVatRate: 0 }), { contrats: [], modeles: [] });
    // Le défaut, calculé à la main : la facture du contrat r1 portait 250 HT sans TVA, soit 40 × 19 % = 7,6 seulement.
    const fac = () => core.buildRecurringInvoice(data.recurring[0], '2026-10-01', reel, { id: 'c1' });
    assert.strictEqual(core.computeTotals(fac(), reel).totalVAT, 7.6);
    // Le geste (le même prédicat que l'écran) : 250 × 19 % = 47,5 de plus, 55,1 en tout.
    [...src.contrats, ...src.modeles].forEach(x => x.lines.forEach(l => { if (core.ligneFactureeSansTva(l)) l.vatRate = 19; }));
    assert.strictEqual(core.computeTotals(fac(), reel).totalVAT, 55.1);
    assert.strictEqual(data.templates[0].lines[0].vatRate, 19);
    assert.strictEqual(data.recurring[1].lines[0].vatRate, 0, 'le geste touche un contrat suspendu qu\'il n\'a pas nommé');
    assert.deepStrictEqual(core.sourcesSansTva(data, reel), { contrats: [], modeles: [] });

    // À l'émission : une facture dont AUCUNE ligne ne porte de TVA se signale ; une ligne exonérée
    // au milieu de lignes taxées, un avoir, un forfait, un taux par défaut à 0 % : rien.
    const f = lignes => ({ type: 'facture', lines: lignes });
    assert.strictEqual(core.factureSansTvaSuspecte(f([ligne('Pose', 1000, 0)]), reel), true);
    assert.strictEqual(core.factureSansTvaSuspecte(f([ligne('Pose', 1000, 0), ligne('Audit', 100, 19)]), reel), false);
    assert.strictEqual(core.factureSansTvaSuspecte({ type: 'avoir', lines: [ligne('Pose', 1000, 0)] }, reel), false);
    assert.strictEqual(core.factureSansTvaSuspecte(f([ligne('Pose', 1000, 0)]), forfait), false);
    assert.strictEqual(core.factureSansTvaSuspecte(f([ligne('Pose', 1000, 0)]), { ...reel, defaultVatRate: 0 }), false);
    assert.strictEqual(core.factureSansTvaSuspecte(f([ligne('Offert', 0, 0)]), reel), false, 'une ligne à zéro ne facture rien');
    assert.strictEqual(core.factureSansTvaSuspecte(f([ligne('Pose', 1000, 19), ligne('Acompte', -300, 0, { noDiscount: true })]), reel), false, 'la déduction d\'acompte n\'est pas une ligne facturée');

    // L'écran : la zone existe dans les Paramètres, se redessine à chaque changement de régime et de
    // taux, le geste passe par le moteur, demande avant, et laisse un « Annuler ».
    const dess = tranche('  function dessinerSourcesSansTva() {', '  function noteRegime(c) {');
    assert.ok(/C\.sourcesSansTva\(data, co\)/.test(dess) && /C\.sourcesSansTva\(data, co2\)/.test(dess), 'la phrase et le geste ne lisent pas le moteur');
    assert.ok(/C\.ligneFactureeSansTva\(l\)/.test(dess), 'le geste ne passe pas par le prédicat du moteur');
    assert.ok(dess.indexOf('confirmDialog(') < dess.indexOf('save(true)') && /toastUndo\(/.test(dess), 'le geste doit demander avant, puis laisser un « Annuler »');
    assert.ok(app.includes('<div id="regime-sources"></div>'), 'la zone n\'est pas posée dans les Paramètres');
    // Elle se redessine au changement de régime ET de taux, et au premier dessin : on lit chacun.
    const ecouteur = debut => { const a = app.indexOf(debut); assert.ok(a > 0, 'écouteur introuvable : ' + debut); return app.slice(a, app.indexOf('\n    });', a)); };
    assert.ok(/dessinerSourcesSansTva\(\)/.test(ecouteur("selRegime.addEventListener('change', () => {")), 'la zone ne se redessine pas au changement de régime');
    assert.ok(/dessinerSourcesSansTva\(\)/.test(ecouteur("selTaux.addEventListener('change', () => {")), 'la zone ne se redessine pas au changement de taux');
    assert.ok(/\n    dessinerCatalogueSansTva\(\); dessinerSourcesSansTva\(\);\n/.test(app), 'la zone n\'est pas dessinée à l\'ouverture des Paramètres');
    const warn = tranche('    function issueWarnings() {', '    // L\'avertissement « ta fiche société est incomplète »');
    assert.ok(/C\.factureSansTvaSuspecte\(doc, co\)/.test(warn), 'l\'émission n\'avertit pas d\'une facture sans aucune TVA');
  });

  t('10.14.1 : le titre de la fenêtre se lit sans la bulle « i » collée au dernier mot du titre — « Maintenance mensuelle i »', () => {
    const src = tranche('  function texteDeTitre(el) {', '  // Titre de la fenêtre');
    const txt = data => ({ nodeType: 3, data });
    const el = (tagName, enfants, extra) => ({ nodeType: 1, tagName, childNodes: enfants, classList: { contains: c => ((extra || {}).cls || []).includes(c) }, getClientRects: () => ((extra || {}).cache ? [] : [1]) });
    const h1 = el('H1', [txt('Maintenance '), el('SPAN', [txt('mensuelle '), el('BUTTON', [txt('i')])], { cls: ['colle-bulle'] }),
      el('SPAN', [txt('Modifications non enregistrées')], { cls: ['dirty-dot'] }), el('SPAN', [txt('caché')], { cache: true })]);
    const ctx = { h1, Array };
    vm.runInNewContext(src + '\nthis.r = texteDeTitre(h1);', ctx);
    assert.strictEqual(ctx.r, 'Maintenance mensuelle');
    assert.ok(/t = h1 \? texteDeTitre\(h1\)/.test(app), 'le titre de la fenêtre ne passe pas par texteDeTitre');
  });

  t('MR-08 : le montant en lettres — « quatre-vingt mille », « deux cent mille », « un million de dinars »', () => {
    const w = (n, cur, lang) => core.amountToWords(n, cur || 'DT', lang);
    // Devant « mille », adjectif numéral, « vingt » et « cent » restent au singulier…
    assert.strictEqual(w(80000), 'Quatre-vingt mille dinars');
    assert.strictEqual(w(200000), 'Deux cent mille dinars');
    assert.strictEqual(w(280000), 'Deux cent quatre-vingt mille dinars');
    assert.strictEqual(w(80080), 'Quatre-vingt mille quatre-vingts dinars');
    assert.strictEqual(w(200200), 'Deux cent mille deux cents dinars');
    // … en fin de nombre, et devant « million » (un nom), ils prennent leur s.
    assert.strictEqual(w(80), 'Quatre-vingts dinars');
    assert.strictEqual(w(200), 'Deux cents dinars');
    assert.strictEqual(w(80000000), 'Quatre-vingts millions de dinars');
    assert.strictEqual(w(200000000), 'Deux cents millions de dinars');
    // Un nombre qui finit par million se lie à l'unité par « de » (« d' » devant une voyelle) ; sinon, non.
    assert.strictEqual(w(1000000), 'Un million de dinars');
    assert.strictEqual(w(2000000), 'Deux millions de dinars');
    assert.strictEqual(w(1200000), 'Un million deux cent mille dinars');
    assert.strictEqual(w(1000000, 'EUR'), 'Un million d\'euros');
    assert.strictEqual(w(1000000.5), 'Un million de dinars et cinq cents millimes');
    assert.strictEqual(w(1000000, 'EUR', 'en'), 'One million euros', 'l\'anglais n\'a pas de « de »');
  });

  t('MR-06 : une facture émise garde le régime de TVA sous lequel elle est partie — sa mention ne change pas au passage au réel', () => {
    const forfait = { name: 'Atelier', currency: 'DT', stampFee: 1, taxRegime: 'forfaitaire' };
    const reel = { ...forfait, taxRegime: 'reel', defaultVatRate: 19 };
    const fac = { type: 'facture', number: 'FAC-2026-004', status: 'envoyée', date: '2026-03-01', lines: [{ label: 'Pose', qty: 1, unitPrice: 800, vatRate: 0 }], applyStamp: true };
    // Émise au forfait, la pièce porte la mention et aucune colonne TVA.
    const emise = { ...fac, regimeTva: 'forfaitaire' };
    const avant = core.documentHtml(emise, { name: 'C' }, forfait);
    assert.ok(avant.includes('TVA non applicable — régime forfaitaire'));
    // Réimprimée après le passage au réel : elle ne change PAS.
    const apres = core.documentHtml(emise, { name: 'C' }, reel);
    assert.ok(apres.includes('TVA non applicable — régime forfaitaire'), 'la mention d\'une facture émise disparaît au passage au réel');
    assert.ok(!/<td class="r num dim">0%<\/td>/.test(apres), 'une colonne « TVA 0 % » apparaît sur une facture émise au forfait');
    assert.ok(core.documentHtml(emise, { name: 'C' }, { ...forfait, taxRegime: 'exonere' }).includes('régime forfaitaire'), 'la mention change au passage à l\'exonéré');
    // Un brouillon suit le régime du jour ; le régime rangé d'une copie n'y fait rien.
    assert.ok(!core.documentHtml({ ...emise, status: 'brouillon' }, { name: 'C' }, reel).includes('TVA non applicable'));
    // La migration fige les pièces DÉJÀ émises sur le régime d'aujourd'hui, pas les brouillons.
    const d = core.migrateData({ company: forfait, documents: [{ ...fac, id: 'a' }, { ...fac, id: 'b', status: 'brouillon', number: '' }, { ...fac, id: 'c', type: 'devis', number: 'DEV-1' }] });
    assert.strictEqual(d.documents.find(x => x.id === 'a').regimeTva, 'forfaitaire');
    assert.strictEqual(d.documents.find(x => x.id === 'b').regimeTva, undefined, 'un brouillon ne se fige pas');
    assert.strictEqual(d.documents.find(x => x.id === 'c').regimeTva, undefined);
    // L'émission le fige, et une pièce tirée d'une émise ne l'emporte pas.
    assert.ok(/doc\.regimeTva = C\.regimeOf\(company\(\)\)\.id;\s*\n\s*doc\.status = isInv/.test(app), 'l\'émission ne fige pas le régime');
    assert.ok(!('regimeTva' in core.convertDoc({ ...emise, id: 'x', type: 'proforma' }, 'facture', forfait, '2026-09-01')), 'une conversion emporte le régime figé');
    assert.ok(/issuedTs: undefined, regimeTva: undefined,/.test(app), '« Dupliquer » emporte le régime figé');
  });

  t('MR-10 : la mention « TVA non applicable » se dit dans la langue de la pièce', () => {
    const co = { name: 'A', currency: 'DT', stampFee: 1, taxRegime: 'forfaitaire' };
    const d = { type: 'facture', number: 'F1', status: 'envoyée', lang: 'en', lines: [{ label: 'a', qty: 1, unitPrice: 100, vatRate: 0 }], applyStamp: true };
    const en = core.documentHtml(d, { name: 'c' }, co);
    assert.ok(en.includes('VAT not applicable — flat-rate tax regime') && !en.includes('TVA non applicable'));
    assert.ok(core.documentHtml({ ...d, lang: 'fr' }, { name: 'c' }, co).includes('TVA non applicable — régime forfaitaire'));
    assert.strictEqual(core.mentionTVA({ taxRegime: 'exonere' }, 'en'), 'VAT not applicable — VAT-exempt activity');
    assert.strictEqual(core.mentionTVA({ taxRegime: 'reel' }, 'en'), '', 'un régime qui facture la TVA n\'a pas de mention');
  });

  t('MR-09 : une note d\'honoraires porte un seul nom — sur la pièce, sur son avoir, dans son mail et à l\'écran', () => {
    const co = { name: 'Cabinet Médical', activity: 'sante', currency: 'DT', stampFee: 1, taxRegime: 'reel', defaultVatRate: 19 };
    const doc = { type: 'facture', number: 'FAC-2026-001', status: 'envoyée', date: '2026-09-01', dueDate: '2026-10-01', lines: [{ label: 'Consultation', qty: 1, unitPrice: 100, vatRate: 19 }], applyStamp: true };
    const html = core.documentHtml(doc, { name: 'C' }, co);
    assert.ok(html.includes('Arrêtée la présente note d\'honoraires') && !html.includes('présente facture'));
    const av = { type: 'avoir', number: 'AVO-2026-001', status: 'émis', date: '2026-09-02', creditOfNumber: 'FAC-2026-001', lines: [{ label: 'Consultation', qty: 1, unitPrice: 100, vatRate: 19 }] };
    const hav = core.documentHtml(av, { name: 'C' }, co);
    assert.ok(hav.includes('Note d&#39;honoraires FAC-2026-001') && hav.includes('déduction de la note d\'honoraires FAC-2026-001'), 'l\'avoir dit « facture »');
    assert.ok(!/[Ff]acture FAC-2026-001/.test(hav));
    const m = core.emailFor('facture', doc, { name: 'C' }, co);
    assert.ok(/^Note d'honoraires FAC-2026-001/.test(m.subject) && m.body.includes('notre note d\'honoraires') && !/facture/i.test(m.body), 'le mail dit « facture » : ' + m.subject);
    assert.ok(/note d'honoraires FAC-2026-001/.test(core.emailFor('relance1', doc, { name: 'C' }, co, {}, { documents: [doc], clients: [] }).body), 'la relance dit « facture »');
    // Un modèle rangé tel quel par les Paramètres (l'ancien texte) suit le métier ; un modèle réécrit reste le sien.
    assert.ok(/^Note d'honoraires/.test(core.emailFor('facture', doc, {}, { ...co, emailTemplates: { facture: { ...core.DEFAULT_EMAIL_TEMPLATES.facture } } }).subject));
    assert.strictEqual(core.emailFor('facture', doc, {}, { ...co, emailTemplates: { facture: { subject: 'Ma pièce {numero}', body: 'x' } } }).subject, 'Ma pièce FAC-2026-001');
    // Sans métier libéral, rien ne change.
    assert.ok(/^Facture FAC-2026-001/.test(core.emailFor('facture', doc, {}, { ...co, activity: 'informatique' }).subject));
    // L'écran : le nom d'une pièce passe par core.docLabel, et les modèles affichés sont ceux qui partiront.
    assert.ok(/const docLabel = doc => `\$\{C\.docLabel\(doc\.type, company\(\)\)\}/.test(app), 'l\'écran nomme la pièce par TITLES');
    assert.ok(/const t = C\.modeleMail\(c, k, lg === 'en'\);/.test(app), 'les Paramètres montrent un modèle qui ne partira pas');
    assert.ok(/isInv \? 'Émettre ' \+ laPiece\(\)/.test(app) && !/'Émettre la facture'/.test(app), 'le bouton dit « Émettre la facture » sous une note d\'honoraires');
    assert.ok(/— \$\{modeles\.length\} messages/.test(app), 'le compte des modèles est écrit à la main');
    // Les listes, la palette, les modèles et le toast de création la nomment aussi (vu à l'écran : la
    // fiche d'un contrat listait « Facture » sous une « Note d'honoraires »).
    assert.ok(!/C\.TITLES\[d\.type\] \}|get: d => C\.TITLES\[d\.type\]/.test(app), 'la colonne Type dit « Facture »');
    assert.ok(/facture: C\.estLiberal\(company\(\)\) \? 'Honoraires' : 'Facture'/.test(app), 'la palette dit « Facture »');
    assert.ok(/const pieceCreee = t => `\$\{C\.docLabel\(t, company\(\)\)\}/.test(app), 'le toast dit « Facture créée »');
    assert.ok(!/isInv \? 'cette facture'/.test(app), 'le garde-fou dit « cette facture »');
  });

  t('DEV-09 : la fiche d\'un contrat ne retranche plus un encaissé TTC d\'un facturé HT — facturé (HT, avoirs déduits), encaissé (la banque), reste dû (TTC)', () => {
    const co = { currency: 'DT', stampFee: 1, taxRegime: 'reel', defaultVatRate: 19 };
    const L = (pu, tva) => [{ label: 'Maintenance', qty: 1, unitPrice: pu, vatRate: tva }];
    const docs = [
      // 1 000 HT + 190 + 1 de timbre = 1 191, payée en entier.
      { id: 'f1', type: 'facture', recurringId: 'r1', status: 'envoyée', date: '2026-01-05', applyStamp: true, lines: L(1000, 19), payments: [{ amount: 1191, date: '2026-01-20' }] },
      // 1 191, payée 500, et un avoir de 200 HT (238 TTC, sans timbre) : reste 1 191 − 238 − 500 = 453.
      { id: 'f2', type: 'facture', recurringId: 'r1', status: 'envoyée', date: '2026-02-05', applyStamp: true, lines: L(1000, 19), payments: [{ amount: 500, date: '2026-02-20' }] },
      { id: 'a1', type: 'avoir', creditOf: 'f2', status: 'émis', date: '2026-02-10', applyStamp: false, lines: L(200, 19) },
      { id: 'f3', type: 'facture', recurringId: 'r1', status: 'brouillon', date: '2026-03-05', applyStamp: true, lines: L(1000, 19) },
      // Un avoir encore en BROUILLON n'a rien corrigé : il ne se retranche pas.
      { id: 'a2', type: 'avoir', creditOf: 'f1', status: 'brouillon', date: '2026-03-06', applyStamp: false, lines: L(500, 19) },
      // Un contrat en euros à 3,300 : 100 € réglés au taux du jour 3,400 (la banque reçoit 340 DT) ;
      // 50 € payés 60 € — un trop-perçu de 10 € (33 DT), qui ne se retranche d'aucun reste.
      { id: 'f4', type: 'facture', recurringId: 'r2', status: 'envoyée', date: '2026-01-05', currency: 'EUR', exchangeRate: 3.3, applyStamp: false, lines: L(100, 0), payments: [{ amount: 100, date: '2026-01-20', exchangeRate: 3.4 }] },
      { id: 'f5', type: 'facture', recurringId: 'r2', status: 'envoyée', date: '2026-02-05', currency: 'EUR', exchangeRate: 3.3, applyStamp: false, lines: L(50, 0), payments: [{ amount: 60, date: '2026-02-20' }] }
    ];
    const data = { documents: docs, recurring: [{ id: 'r1' }, { id: 'r2', currency: 'EUR' }], purchases: [], clients: [], items: [] };
    const s1 = core.contratSuivi(data, co, 'r1');
    assert.deepStrictEqual([s1.facture, s1.encaisse, s1.restant, s1.tropPercu, s1.emises, s1.avoirs, s1.brouillons], [1800, 1691, 453, 0, 2, 1, 1]);
    const s2 = core.contratSuivi(data, co, 'r2');
    assert.deepStrictEqual([s2.facture, s2.encaisse, s2.restant, s2.tropPercu], [495, 538, 0, 33]);
    // La rentabilité du contrat (page Marges) compte l'avoir aussi.
    assert.strictEqual(core.recurringProfitability(data, co, 'r1').revenue, 1800);
    // L'écran lit la fonction ; il ne refait plus « netToPay − reste » à la main.
    const route = tranche('  routes.contrat = (parts) => {', '  const contratState = ');
    assert.ok(/C\.contratSuivi\(data, co, r\.id\)/.test(route), 'la fiche ne lit pas contratSuivi');
    assert.ok(!/netToPay - balance\(d\)\.remaining/.test(route) && !/facture - encaisse/.test(route), 'la fiche recalcule son reste à la main');
    assert.ok(/info\('contrat\.encaisse'\)/.test(route), 'la carte Encaissé porte la bulle « Reste à encaisser »');
  });

  t('DEV-15 : trier une liste de pièces par montant compare des dinars à des dinars — 952,30 € (3 190 DT) passe devant 2 000 DT', () => {
    const src = tranche('  function docColumns(opts) {', '  // Liste de documents triable');
    const co = { currency: 'DT' };
    const ctx = { C: core, company: () => co, montantDeListe: d => d._m, docCur: d => d.currency || 'DT', balance: d => ({ remaining: d._r }),
      h: x => x, clientName: () => '', effStatus: () => '', statusBadge: () => '' };
    vm.runInNewContext(src + '\nthis.cols = docColumns({}).cols;', ctx);
    const col = k => ctx.cols.find(c => c.key === k);
    const eur = { type: 'facture', status: 'envoyée', currency: 'EUR', exchangeRate: 3.35, _m: 952.30, _r: 952.30 };
    const dt = { type: 'facture', status: 'envoyée', currency: 'DT', _m: 2000, _r: 2000 };
    assert.ok(col('amount').val(eur) > col('amount').val(dt), 'le montant se trie en devise native');
    assert.ok(col('rest').val(eur) > col('rest').val(dt), 'le reste se trie en devise native');
    assert.strictEqual(col('amount').get(eur), core.money(952.30, 'EUR'), 'l\'affichage reste dans la devise de la pièce');
  });

  t('DEV-12 : le relevé envoyé à un client facturé en euros et en anglais est en euros et en anglais — mêlé, il rappelle la devise d\'origine', () => {
    const co = { name: 'Atelier', currency: 'DT', stampFee: 1, taxRegime: 'reel' };
    const L = (pu, tva) => [{ label: 'Audit', qty: 1, unitPrice: pu, vatRate: tva }];
    const eur = { id: 'f1', type: 'facture', number: 'FAC-2026-001', clientId: 'c1', status: 'envoyée', date: '2026-03-01', dueDate: '2026-03-31', currency: 'EUR', exchangeRate: 3.35, lang: 'en', applyStamp: false, lines: L(800, 19), payments: [] };
    const libre = { id: 'a1', type: 'avoir', number: 'AVO-2026-001', clientId: 'c1', status: 'émis', date: '2026-03-05', currency: 'EUR', exchangeRate: 3.35, lang: 'en', applyStamp: false, lines: L(100, 0) };
    const data = { documents: [eur, libre], clients: [{ id: 'c1', name: 'Globex Ltd', lang: 'en', currency: 'EUR' }], purchases: [] };
    const r = core.releveClient(data, 'c1', co, { date: '2026-06-30', natif: true });
    // 800 € + 19 % = 952,00 € dû, moins un avoir libre de 100 € : le client lit SES montants.
    assert.strictEqual(r.currency, 'EUR');
    assert.strictEqual(r.lang, 'en');
    assert.deepStrictEqual(r.lignes.map(l => l.reste), [952, -100]);
    assert.strictEqual(r.total, 852);
    const html = core.releveHtml(r, co, {});
    assert.ok(html.includes('lang="en"') && html.includes('Statement of account') && html.includes('Balance due') && html.includes('Credit note'), 'le relevé est en français');
    assert.ok(html.includes('952.00') && !html.includes('3,189') && !/Relevé de compte|Reste dû/.test(html), 'le relevé est en dinars ou en français');
    const m = core.mailReleve(r, co);
    assert.ok(/^Statement of account/.test(m.subject) && m.body.includes('Balance due: 852.00 EUR'), 'le mail est en français ou en dinars : ' + m.body);
    // Sans `natif` (la fiche, le menu) : la devise de la société, comme partout où l'on additionne.
    const base = core.releveClient(data, 'c1', co, { date: '2026-06-30' });
    assert.strictEqual(base.currency, 'DT');
    assert.strictEqual(base.total, 2854.2);   // 852 € × 3,35
    // Des pièces en DEUX devises : le relevé reste en dinars, et chaque pièce étrangère dit son montant.
    const dt = { id: 'f2', type: 'facture', number: 'FAC-2026-002', clientId: 'c1', status: 'envoyée', date: '2026-04-01', dueDate: '2026-05-01', currency: 'DT', lang: 'en', applyStamp: false, lines: L(100, 0), payments: [] };
    const mixte = core.releveClient({ ...data, documents: [eur, libre, dt] }, 'c1', co, { date: '2026-06-30', natif: true });
    assert.strictEqual(mixte.currency, 'DT');
    assert.ok(/^952\.00|952,00/.test(mixte.lignes[0].origine) && mixte.lignes[0].origine.includes('EUR'), 'la pièce en euros ne rappelle pas son montant : ' + mixte.lignes[0].origine);
    assert.strictEqual(mixte.lignes[2].origine, '', 'une pièce en dinars n\'a pas d\'origine à rappeler');
    // L'écran envoie ce qu'il montre.
    const form = tranche('  function releveForm(clientId) {', '  function clientForm(');
    assert.ok(/natif: true/.test(form) && /C\.mailReleve\(r, company\(\)\)/.test(form) && !/const cur = company\(\)\.currency/.test(form), 'la fenêtre montre un autre relevé que celui qui part');
    assert.ok(/const rv = C\.releveClient\(data, c\.id, company\(\), \{ natif: true \}\);/.test(app) && /C\.money\(ouvert, rv\.currency\)\} encore dû/.test(app), 'le menu annonce le relevé dans une autre devise que le relevé');
  });

  t('M-04 / M-05 / M-13 à M-16 / DEV-10 : un montant dans une phrase s\'écrit comme à l\'écran — séparateurs, décimales et devise', () => {
    // M-05 : le refus d'une opération diverse.
    const od = core.odValide({ date: '2026-03-01', label: 'Loyer', lignes: [{ compte: '616', debit: 1250.5 }, { compte: '4551', credit: 1200 }] }, { currency: 'DT' });
    assert.ok(od.erreurs.includes(`Débit ${core.money(1250.5, 'DT')} ≠ crédit ${core.money(1200, 'DT')} : l'écriture ne tombe pas juste.`), od.erreurs.join(' | '));
    assert.ok(/C\.odValide\(o, company\(\)\)/.test(app) && /C\.odValide\(lire\(\), company\(\)\)/.test(app) && /C\.odValide\(n, company\(\)\)/.test(app), 'un appel de odValide ne passe pas la société');
    // M-16 : la lecture d'une photo.
    const w = core.ocrToPurchase({ totalHT: '1 250,50', number: 'X', supplier: 'a', lines: [{ label: 'x', qty: 1, unitPrice: 1190.5 }] }, { suppliers: [], company: { currency: 'DT' } }, '2026-09-25').warnings;
    assert.ok(w.includes(`Les lignes totalisent ${core.money(1190.5, 'DT')} alors que la pièce annonce ${core.money(1250.5, 'DT')}.`), w.join(' | '));
    // M-04 : la bulle de comparaison des Statistiques, jouée.
    const sc = tranche('  function statCard(label, value, now, before, sub, key, fmt) {', '  // Histogramme comparatif');
    const ctx = { info: () => '', h: x => x, Math };
    vm.runInNewContext(sc + '\nthis.out = statCard("CA", "x", 100, 66572.5, "", "k", n => "F(" + n + ")"); this.brut = statCard("N", "1", 2, 3, "", "k");', ctx);
    assert.ok(ctx.out.includes('Même période l\'an dernier : F(66572.5)') && ctx.brut.includes('dernier : 3'));
    assert.ok((app.match(/'stat\.(ca|avg|vat)', x => C\.money\(x, cur\)\)/g) || []).length === 3, 'une carte de montant n\'écrit pas le chiffre de l\'an dernier comme un montant');
    // M-15 : aucun montant sans devise hors des tables, et les tables suivent la devise de la société.
    const brut = [];
    for (let i = app.indexOf('C.money('); i >= 0; i = app.indexOf('C.money(', i + 1)) {
      let j = i + 8, d = 1, virgules = 0;
      while (d > 0 && j < app.length) { const c = app[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ',' && d === 1) virgules++; j++; }
      if (!virgules) brut.push(app.slice(i, j));
    }
    assert.deepStrictEqual(brut, [], 'des montants s\'écrivent sans devise ni décimales de la société');
    assert.ok(/const montantCompta = n => C\.money\(n, '', C\.decimalsFor\(company\(\)\.currency\)\);/.test(app));
    assert.ok(/Écart de \$\{C\.money\(Math\.abs\(ecart\), company\(\)\.currency\)\}/.test(app), 'l\'écart d\'une OD ne dit pas sa devise');
    // M-14 : une vente de la console s'écrit en DT.
    assert.ok(/C\.money\(Number\(x\.montant_ht\) \|\| 0, C\.normCurrency\(x\.devise \|\| 'DT'\)\)/.test(app), 'une vente de la console reste en TND');
    // DEV-10 : le doublon d'un achat en euros s'annonce en euros.
    assert.ok(/C\.money\(t\.totalTTC, jumeau\.currency \|\| company\(\)\.currency\)\} TTC/.test(app), 'le doublon d\'un achat en devise s\'annonce en dinars');
    // M-13 : l'exemple de l'Aide écrit le dinar à trois décimales, timbre compris.
    const guide = fs.readFileSync(path.join(__dirname, '../../src/renderer/guide.js'), 'utf8');
    assert.ok(guide.includes('tu reçois 1 173,150 DT') && !guide.includes('1 173,15 DT'), 'l\'Aide écrit 1 173,15 DT');
  });

  t('M-10 : choisir un client facturé en euros après avoir tapé des prix le DIT — la pièce change de devise, les prix ne se convertissent pas seuls', () => {
    const h = tranche('    head.oninput = head.onchange = (e) => {', '    // les affaires proposées suivent le client');
    const dire = /const direDevise = \(\) => \{\s*if \(cur !== avantDevise && doc\.lines\.some\(l => Number\(l\.unitPrice\)\)\) toast\(`La pièce passe en \$\{cur\}/.test(h);
    assert.ok(dire, 'le changement de devise se fait sans un mot');
    const client = h.slice(h.indexOf("e.target.name === 'clientId'"));
    assert.ok(client.indexOf('applyClientDefaults(doc, doc.clientId)') > 0 && client.indexOf('direDevise()') > client.indexOf('applyClientDefaults(doc, doc.clientId)'),
      'le choix d\'un client en euros change la devise des prix sans le dire');
  });

  t('M-03 / M-11 : un champ de montant dit sa devise à côté de lui, et s\'écrit avec ses décimales — barèmes et crédit de TVA compris', () => {
    // Chaque champ(…) dont la saisie est un montant (pas de 0,001, ou classe « montant ») : son
    // libellé nomme la devise — celle de la société, ou celle de la pièce quand elle peut changer.
    const nus = [];
    app.split('\n').forEach((l, i) => {
      if (!/field\(lbl\(/.test(l) || !/step="0\.001"|class="[^"]*montant/.test(l)) return;
      const lab = l.slice(l.indexOf('field(lbl(') + 10, l.indexOf(', \'', l.indexOf('field(lbl(')));
      if (!/currency|\$\{h\(cur\)\}|data-unite-devise|\(DT\)/.test(lab)) nus.push(`${i + 1} : ${lab.trim().slice(0, 70)}`);
    });
    assert.deepStrictEqual(nus, [], 'des champs de montant ne disent pas leur devise');
    // Le Cabinet tient ses livres en dinars : chaque case de montant d'une fenêtre le dit aussi.
    const cabL = fs.readFileSync(path.join(__dirname, '../../src/cabinet/renderer/app.js'), 'utf8').split('\n');
    const nusCab = [];
    cabL.forEach((l, i) => {
      if (!/<label class="field/.test(l)) return;
      // Le champ est sur la ligne du libellé, ou sur la suivante quand le libellé ne s'y ferme pas.
      const bloc = /<\/label>/.test(l) ? l : l + '\n' + (cabL[i + 1] || '');
      if (!/<input[^>]*class="[^"]*\bmontant\b/.test(bloc)) return;
      if (!/\(DT\b/.test(l)) nusCab.push(`${i + 1} : ${l.trim().slice(0, 90)}`);
    });
    assert.deepStrictEqual(nusCab, [], 'des champs de montant du Cabinet ne disent pas leur devise');
    // Le libellé d'un champ vit dans `.fl`, un conteneur flex : « Timbre et frais (», « DT » et « ) »
    // y deviennent trois morceaux écartés — « ( DT ) ». Un libellé qui porte une balise est UN élément.
    for (const [nom, src] of [['entreprise', app], ['cabinet', fs.readFileSync(path.join(__dirname, '../../src/cabinet/renderer/app.js'), 'utf8')]]) {
      const mixtes = (src.match(/lbl\(`[^`]*`/g) || []).map(x => x.slice(5, -1)).filter(t => /<span/.test(t) && !/^<span[^>]*>[\s\S]*<\/span>$/.test(t));
      assert.deepStrictEqual(mixtes, [], nom + ' : un libellé mêle du texte et une balise dans un conteneur flex');
    }
    // Une pièce qui change de devise change le libellé de ses frais avec ses décimales.
    const pd = tranche('  function poserDevise(dans, cur) {', '  function completerMontants(racine) {');
    assert.ok(/\[data-unite-devise\]/.test(pd) && /u\.textContent = cur/.test(pd), 'le libellé « Timbre et frais » garde l\'ancienne devise');
    assert.ok(/Timbre et frais \(<span data-unite-devise>\$\{h\(cur\)\}<\/span>\)/.test(app));
    // M-11 : les barèmes et le crédit de TVA passent par la complétion des montants.
    assert.ok(/const num = \(k, lab, key, montant\) => [^\n]*class="num\$\{montant \? ' montant' : ''\}"/.test(app));
    for (const k of ['proCap', 'headOfFamily', 'perChild']) assert.ok(new RegExp(`num\\('${k}', [^\\n]*, true\\)`).test(app), k + ' n\'est pas un montant');
    assert.ok(/<input type="number" class="num montant" data-b="upTo"/.test(app), 'la tranche du barème s\'écrit « 5000 »');
    const pr = tranche('  function promptDialog(title, label, value, done, type, o = {}) {', '  // ---------- modèles de documents ----------');
    assert.ok(/o\.montant \? ' step="0\.001" min="0" class="num montant"'/.test(pr), 'une question de montant n\'a pas de champ de montant');
    assert.ok(/ok: 'Enregistrer le crédit', montant: true \}/.test(app), 'le crédit de TVA s\'écrit « 316,16 »');
    // Le délai annoncé : 0 jour veut dire « à réception ».
    assert.ok(/annoncé : \$\{delaiAnnonce \? pl\(delaiAnnonce, 'jour'\) : 'à réception'\}/.test(app) && !/pl\(Number\(company\(\)\.paymentTermsDays\) \|\| 0/.test(app), 'un délai de 0 s\'annonce « 0 jour »');
  });

  t('MR-03 / MR-07 / DEV-03 / DEV-04 / DEV-05 / M-07 / MC-12 : l\'arrondi — le demi-millime et le demi-centime montent, la pièce imprimée tombe juste, les lettres suivent le chiffre', () => {
    // MR-03 : 100,35 × 19 % vaut 19,0665 — en machine 19,06649999… ; arrondi commercial : 19,067.
    for (const R of [core.round3, compta.round3]) {
      assert.strictEqual(R(100.35 * 19 / 100), 19.067);
      assert.strictEqual(R(200.7 * 19 / 100), 38.133);
      assert.strictEqual(R(100.1 * 0.5 / 100), 0.501);
      assert.strictEqual(R(100.05 * 3 / 100), 3.002);
      assert.strictEqual(R(-100.35 * 19 / 100), -19.067, 'le négatif s\'arrondit comme son contraire');
      assert.strictEqual(Object.is(R(-0.0001), -0), false, 'un zéro arrondi garde un signe');
    }
    const co = { name: 'A', currency: 'DT', stampFee: 1, taxRegime: 'reel' };
    assert.strictEqual(core.computeTotals({ type: 'facture', currency: 'DT', applyStamp: false, lines: [{ qty: 1, unitPrice: 100.35, vatRate: 19 }] }, co).totalVAT, 19.067);
    // M-07 / DEV-05 : une pièce en euros s'arrondit au centime AVANT d'additionner — ce qu'on lit s'additionne.
    const eur = { type: 'facture', currency: 'EUR', exchangeRate: 3.4, applyStamp: true, lines: [{ qty: 1, unitPrice: 1000.5, vatRate: 19 }] };
    const t = core.computeTotals(eur, co);
    assert.deepStrictEqual([t.netHT, t.totalVAT, t.stamp, t.netToPay], [1000.5, 190.1, 0.29, 1190.89]);
    const t5 = core.computeTotals({ ...eur, lines: [{ qty: 1, unitPrice: 100.07, vatRate: 19 }] }, co);
    assert.strictEqual(Math.round((t5.netHT + t5.totalVAT + t5.stamp) * 100) / 100, t5.netToPay, 'HT + TVA + timbre ≠ net imprimé');
    // money() : le demi-centime monte, et un seul arrondi (2,67465 → 2,67, pas 2,675 → 2,68).
    assert.strictEqual(core.money(190.095, 'EUR'), '190,10 EUR');
    assert.strictEqual(core.money(1.005, 'EUR'), '1,01 EUR');
    assert.strictEqual(core.money(2.67465, 'EUR'), '2,67 EUR');
    assert.strictEqual(core.money(-0.0001, 'DT'), '0,000 DT', 'un zéro affiché porte un signe moins');
    // DEV-03 : payer le montant IMPRIMÉ solde la facture en euros — ni relance, ni trop-perçu.
    const d3 = { id: 'f', type: 'facture', status: 'envoyée', date: '2026-03-10', dueDate: '2026-03-20', currency: 'EUR', exchangeRate: 3.4, withholdingRate: 1.5, applyStamp: false, lines: [{ qty: 10, unitPrice: 80, vatRate: 19 }] };
    d3.payments = [{ amount: core.computeTotals(d3, co).netToPay, date: '2026-03-12' }];
    const b3 = core.invoiceBalance(d3, { documents: [d3] }, co);
    assert.ok(Math.abs(b3.remaining) < 0.0005 && core.effectiveStatus(d3, { documents: [d3] }, co, '2026-09-01') === 'payée', 'payer le net imprimé laisse ' + b3.remaining);
    // DEV-04 / MR-07 : les lettres disent le chiffre imprimé — jamais « et cent centimes ».
    assert.strictEqual(core.amountToWords(119.996, 'EUR'), 'Cent vingt euros');
    assert.strictEqual(core.amountToWords(1016.999, 'EUR', 'en'), 'One thousand seventeen euros');
    assert.ok(!/cent centimes|hundred cents/i.test(core.amountToWords(5.999, 'EUR') + core.amountToWords(5.999, 'EUR', 'en')));
    // MC-12 : la devise tient au nombre par une insécable, dans le moteur comme à l'écran du Cabinet.
    assert.strictEqual(compta.fmtMontant(1500, 'DT'), '1 500,000 DT');
    const moneyCab = trancheCab('  const money = (n, cur) => {', '  // Un montant AFFICHÉ, sans sa devise');
    const dinarCab = (cab.match(/const dinar = cur => [^\n]+/) || [''])[0];
    const ctx = {};
    vm.runInNewContext(dinarCab + '\n' + moneyCab + '\nthis.m = money;', ctx);
    assert.strictEqual(ctx.m(190.095, 'EUR'), '190,10 EUR', 'le Cabinet écrit le demi-centime vers le bas');
    assert.strictEqual(ctx.m(-0.0001, 'DT'), '0,000 DT', 'le Cabinet écrit « −0,000 »');
  });

  t('DEV-12 bis : la fiche d\'un client facturé en euros dit son reste dans SA devise, comme le relevé', () => {
    const r = tranche('  routes.client = (parts) => {', '    $(\'#view\').innerHTML = `');
    assert.ok(/const rvNatif = C\.releveClient\(data, c\.id, company\(\), \{ natif: true \}\);/.test(r), 'la fiche ne lit pas le relevé en devise');
    assert.ok(/rvNatif\.currency !== C\.normCurrency\(cur\)/.test(r) && /soit \$\{C\.money\(Math\.abs\(rvNatif\.total\), rvNatif\.currency\)\}/.test(r));
    const carte = app.slice(app.indexOf('<div class="lbl">Reste à payer ${info(\'cl.due\')}'), app.indexOf('<div class="lbl">Délai moyen de paiement ${info(\'dash.delay\')}'));
    assert.ok(carte.length > 100 && carte.length < 1200 && carte.includes('${soitNatif}'), 'la carte « Reste à payer » ne dit pas la devise du client');
    const faveur = app.slice(app.indexOf('<div class="lbl">En sa faveur ${info(\'cl.due\')}'), app.indexOf('<div class="lbl">Reste à payer ${info(\'cl.due\')}'));
    assert.ok(faveur.includes('${soitNatif}'), 'la carte « En sa faveur » ne dit pas la devise du client');
  });

  // Un acompte de 17 % sur un devis de 333,33 € : 56,6661 € — un MONTANT, qui se paie au centime. Le
  // moteur l'écrivait au millime (56,666 €), la grille de la facture d'acompte l'affichait tel quel à
  // côté d'un PDF qui écrivait 56,67, et la fenêtre préremplissait « 118,998 € » (DEV-16).
  t('DEV-16 : l\'acompte d\'un devis en euros se compte au centime — la ligne, sa déduction au solde, et le montant proposé', () => {
    const co = { ...core.DEFAULT_COMPANY, name: 'Atelier', currency: 'DT', stampFee: 1, taxRegime: 'reel' };
    const devisEur = { id: 'q1', type: 'devis', number: 'DEV-2026-001', date: '2026-09-25', currency: 'EUR', exchangeRate: 3.4,
      lines: [{ label: 'Identité visuelle', qty: 1, unitPrice: 333.33, vatRate: 19 }] };
    // À la main : 333,33 × 17 % = 56,6661 → 56,67 € (deux décimales pour l'euro).
    assert.deepStrictEqual(core.depositLines(devisEur, 17, co).map(l => l.unitPrice), [56.67], 'la part d\'un devis en euros n\'est pas au centime');
    // Le dinar garde ses trois décimales : 333,333 × 17 % = 56,66661 → 56,667 DT.
    const devisDt = { ...devisEur, currency: 'DT', exchangeRate: '', lines: [{ label: 'X', qty: 1, unitPrice: 333.333, vatRate: 19 }] };
    assert.deepStrictEqual(core.depositLines(devisDt, 17, co).map(l => l.unitPrice), [56.667], 'la part d\'un devis en dinars a perdu son millime');
    // Un acompte né AVANT la 10.14.1 porte 56,666 € : sa facture l'a compté 56,67, et le solde retranche
    // ce que SA facture a compté — pas un prix au millime qu'aucune pièce n'a imprimé.
    const vieil = { id: 'a1', type: 'facture', number: 'FAC-2026-004', currency: 'EUR', exchangeRate: 3.4,
      lines: [{ label: 'Acompte', qty: 1, unitPrice: 56.666, vatRate: 19, noDiscount: true }] };
    const ht = core.computeTotals(vieil, co).lines[0].ht;
    assert.strictEqual(ht, 56.67, 'la facture d\'acompte ne compte pas au centime');
    const deduc = core.settlementLines(devisEur, [vieil]).filter(l => l.noDiscount).map(l => l.unitPrice);
    assert.deepStrictEqual(deduc, [-ht], 'la facture de solde ne retranche pas ce que la facture d\'acompte a compté');
    // Et le montant proposé dans la fenêtre (mode « Montant TTC ») : 30 % d'un TTC de 396,66 € = 118,998 → 119,00 €.
    const m = /name="montant" value="\$\{([^}]*\))\}"/.exec(app);
    assert.ok(m, 'le champ « Montant TTC » de la fenêtre d\'acompte est introuvable');
    const propose = cur => vm.runInNewContext(m[1], { C: core, cur, ttcDevis: cur === 'EUR' ? 396.66 : 396.667 });
    assert.strictEqual(propose('EUR'), 119, 'le montant proposé en euros n\'est pas au centime : ' + propose('EUR'));
    assert.strictEqual(propose('DT'), 119, 'le montant proposé en dinars a changé : ' + propose('DT'));
  });

  // Un dossier tenu au cabinet, sans aucun paquet : son onglet Paquets affichait « Les paquets de cette
  // année ne portent pas de chiffres (fabriqués avant la 6.2.1) » — des paquets qui n'existent pas.
  t('MC-15 : le panneau du chiffre d\'affaires dit la vraie raison de son vide — et n\'existe pas sans paquet', () => {
    const f = trancheCab('  function caSansChiffre(packs, annee) {', '  function caChart(packs, annee) {');
    const dire = vm.runInNewContext('(' + f.trim().replace(/^function caSansChiffre/, 'function') + ')', {});
    const p25 = [{ month: '2025-11', figures: null }];
    assert.ok(/^Aucun paquet reçu pour 2026/.test(dire(p25, '2026')), 'une année sans paquet se dit sans chiffres : ' + dire(p25, '2026'));
    assert.ok(/^Les paquets de 2025 ne portent pas de chiffres/.test(dire(p25, '2025')), dire(p25, '2025'));
    assert.ok(/\$\{years\.length && packs\.length \? `<div class="panel"><h2>Chiffre d'affaires/.test(cab), 'le panneau s\'affiche sur un dossier qui n\'a reçu aucun paquet');
    assert.ok(/caChart\(packs, anneeVue\) \|\| `<div class="empty mini">\$\{esc\(caSansChiffre\(packs, anneeVue\)\)\}<\/div>`/.test(cab), 'le vide du panneau ne passe pas par la raison');
  });

  // La fenêtre d'acompte, montant tapé en euros : « (30,000504210154787 % du devis) », et une annonce
  // calculée sur un autre pourcentage que la pièce que « Créer le brouillon » fabrique (E-02 : une
  // annonce se calcule par les MÊMES constructeurs que ce qu'elle annonce).
  // 10.14.1 (ACP-01) — retourné vers la règle : l'annonce et la création lisent la MÊME demande
  // (`demande()`), qui rend les lignes elles-mêmes. L'ancienne forme comparait deux expressions de
  // pourcentage — elle tombait dès que la demande a rendu des lignes plutôt qu'un pourcentage.
  t('DEV-16 bis : l\'annonce de l\'acompte lit la demande que la création lira — et son pourcentage s\'écrit au millième', () => {
    const f = tranche('    if ($(\'#deposit\')) $(\'#deposit\').onclick = () => {', '    if ($(\'#settle2\'))');
    const annonce = /const apercu = \(\) => \{\s*const q = demande\(\);[\s\S]*?invoiceFromQuote\(doc, q\.lignes, 0\)/.test(f);
    const creation = /\$\('#ok', root\)\.onclick = \(\) => \{\s*const q = demande\(\);[\s\S]*?invoiceFromQuote\(doc, q\.lignes, 0\)/.test(f);
    assert.ok(annonce, 'l\'annonce de l\'acompte ne lit pas la demande');
    assert.ok(creation, 'la création de l\'acompte ne lit pas la même demande que l\'annonce');
    // Le pourcentage annoncé s'écrit au plus au millième : 119,00 € tapés sur un devis de 396,66 €.
    const expr = /const p = ttcDevis > 0 \? (C\.round3\(\(m \/ ttcDevis\) \* 100\)) : 0;/.exec(f);
    assert.ok(expr, 'le pourcentage d\'un montant tapé n\'est pas arrondi au millième');
    const p = vm.runInNewContext(expr[1], { C: core, m: 119, ttcDevis: 396.66 });
    assert.ok(/^\d+(\.\d{1,3})?$/.test(String(p)), 'le pourcentage annoncé n\'est pas arrondi : ' + p);
  });

  // ACP-01 — « 500 DT » tapés faisaient 500,002 TTC : le montant passait par un pourcentage arrondi au
  // millième, appliqué ensuite aux bases du devis. La facture annoncée au client ne tombait pas juste.
  t('ACP-01 : un acompte demandé en MONTANT fait ce montant TTC — au millime, au centime, sur plusieurs taux', () => {
    const co = { currency: 'DT', stampFee: 1 };
    const ttcDe = (lignes, cur) => core.computeTotals({ type: 'facture', currency: cur, exchangeRate: 3.4, lines: lignes }, co);
    // Le devis de la capture : 3 109,244 HT à 19 %, 3 700 TTC ; 500 demandés.
    const q1 = { type: 'devis', number: 'DEV-2026-009', currency: 'DT', lines: [{ qty: 1, unitPrice: 3109.244, vatRate: 19 }] };
    const l500 = core.depositLinesMontant(q1, 500, co);
    const t500 = ttcDe(l500, 'DT');
    assert.strictEqual(core.round3(t500.netHT + t500.totalVAT), 500, 'les lignes ne font pas 500 TTC');
    assert.strictEqual(t500.netToPay, 501, 'le timbre ne s\'ajoute pas par-dessus : ' + t500.netToPay);
    assert.strictEqual(l500[0].unitPrice, 420.168, 'la base de 500 TTC à 19 % vaut 420,168 (420,168 + 79,832)');
    assert.ok(/Acompte de 500,000\u00a0DT TTC sur le devis DEV-2026-009/.test(l500[0].label), 'la ligne ne dit pas le montant demandé : ' + l500[0].label);
    // Plusieurs taux, une remise : chaque montant tombe juste (un autre taux rattrape l'unité qu'un
    // 19 % saute). Calculé sur des montants qui ne se divisent pas.
    const q2 = { type: 'devis', number: 'DEV-2', currency: 'DT', discountRate: 10, lines: [{ qty: 1, unitPrice: 1000, vatRate: 19 }, { qty: 2, unitPrice: 250, vatRate: 7 }, { qty: 1, unitPrice: 300, vatRate: 0 }] };
    for (const m of [100.274, 102.055, 777.777, 1234.567]) {
      const tt = ttcDe(core.depositLinesMontant(q2, m, co), 'DT');
      assert.strictEqual(core.round3(tt.netHT + tt.totalVAT), m, `${m} demandés ne font pas ${m} sur trois taux`);
    }
    // En euros, au centime.
    const qe = { type: 'devis', number: 'DEV-E', currency: 'EUR', exchangeRate: 3.4, lines: [{ qty: 3, unitPrice: 333.33, vatRate: 19 }, { qty: 1, unitPrice: 50, vatRate: 7 }] };
    const te = ttcDe(core.depositLinesMontant(qe, 500, co), 'EUR');
    assert.strictEqual(Math.round((te.netHT + te.totalVAT) * 100) / 100, 500, 'un acompte de 500 € ne fait pas 500 €');
    // Un montant qu'aucune base ne peut faire à 19 % seul (99,99 € : 84,02 donne 99,98, 84,03 donne
    // 100,00) : le plus proche, et à égalité le plus bas — jamais plus que ce qu'on a annoncé.
    const q3 = { type: 'devis', number: 'DEV-3', currency: 'EUR', exchangeRate: 3.4, lines: [{ qty: 1, unitPrice: 999.99, vatRate: 19 }] };
    const t3 = ttcDe(core.depositLinesMontant(q3, 99.99, co), 'EUR');
    assert.strictEqual(Math.round((t3.netHT + t3.totalVAT) * 100) / 100, 99.98, 'un montant inatteignable doit donner le plus proche par en dessous');
    // Rien d'absurde : un montant nul ou un devis vide ne font aucune ligne.
    assert.deepStrictEqual(core.depositLinesMontant(q1, 0, co), []);
    assert.deepStrictEqual(core.depositLinesMontant({ type: 'devis', lines: [] }, 100, co), []);
    // Ce qui a été demandé se dit comme on l'a demandé, sur la pièce et à l'écran.
    assert.strictEqual(core.acompteDit({ percent: 30 }, 'DT'), '30 %');
    assert.strictEqual(core.acompteDit({ percent: 13.514, montant: 500 }, 'DT'), '500,000\u00a0DT TTC');
    // documentHtml(doc, client, company, opts) — le client en second, la société en troisième.
    const html = core.documentHtml({ type: 'facture', number: 'FAC-1', date: '2026-09-26', dueDate: '2026-09-26', currency: 'DT', lines: l500, deposit: { percent: 13.514, montant: 500, quoteNumber: 'DEV-2026-009' } }, { name: 'Client X' }, { name: 'Société Y', currency: 'DT', stampFee: 1 }, {});
    assert.ok(/500,000\u00a0DT TTC du devis DEV-2026-009/.test(html.replace(/<[^>]+>/g, '')), 'la facture ne dit pas le montant d\'acompte demandé');
  });

  // Dans `.field` (un conteneur flex en colonne), chaque morceau de texte d'une étiquette devient une
  // RANGÉE : « Recopie », « SUPPRIMER » et « pour confirmer » s'empilaient sur trois lignes au-dessus
  // de la case à remplir, « Montant TTC » et « (EUR) i » sur deux. Le test M-03 ne lisait que les
  // étiquettes passées par `lbl(` : celles écrites à la main lui échappaient (10.12.0 — un test qui
  // reconnaît un défaut par UNE forme manque son jumeau écrit à la main).
  t('H-V2-02 : une étiquette de champ écrite à la main est UN élément, dans les deux applications', () => {
    for (const [nom, source] of [['entreprise', app], ['cabinet', cab]]) {
      const src = source.replace(/\$\{\/\*[\s\S]*?\*\/\s*''\}/g, '');   // les commentaires de gabarit
      const re = /<label class="field[^"]*"[^>]*>/g; let m, lues = 0; const mixtes = [];
      while ((m = re.exec(src))) {
        const suite = src.slice(m.index + m[0].length, m.index + m[0].length + 600);
        const fin = suite.search(/<input|<select|<textarea|\$\{(?:combo|dateInput|withholdingSelect)\(/);
        if (fin < 0) continue;
        lues++;
        // `<span class="pw-wrap">` porte le CHAMP (le mot de passe et son « Afficher ») : l'étiquette s'arrête avant.
        const lab = suite.slice(0, fin).split('<span class="pw-wrap">')[0].trim();
        if (!lab || /^\$\{(?:lbl\(|o\.info \? lbl\()/.test(lab) || /^<span class="fl/.test(lab)) continue;
        const texte = lab.replace(/\$\{[^}]*\}/g, '').replace(/<[^>]+>/g, '');
        const balise = /<(?!br)[a-z]/i.test(lab) || /\$\{info\(/.test(lab);
        if (/[A-Za-zÀ-ÿ]/.test(texte) && balise && !/^<span[^>]*>[\s\S]*<\/span>$/.test(lab)) mixtes.push(`${src.slice(0, m.index).split('\n').length} : ${lab.slice(0, 80)}`);
      }
      assert.ok(lues > 100, nom + ' : trop peu d\'étiquettes lues (' + lues + ') — la sonde n\'atteint plus le code');
      assert.deepStrictEqual(mixtes, [], nom + ' : une étiquette mêle du texte et une balise dans un conteneur flex');
    }
  });

  // « Clôturer jusqu'à… » propose jusqu'à dix ans d'un coup, et la boucle des bulletins manquants
  // s'arrêtait à vingt-quatre mois : « 24 bulletins de paie à établir » pour quatre-vingts, ou rien
  // du tout quand l'oubli commençait après le 24e mois — la seule information lue avant de
  // verrouiller des années (CLOT-01).
  t('CLOT-01 : les bulletins manquants se comptent sur TOUTE la période qu\'on s\'apprête à clôturer — jamais un plafond de deux ans', () => {
    const CO = { ...core.DEFAULT_COMPANY, name: 'Menuiserie', currency: 'DT', stampFee: 1, matricule: '1234567A' };
    const avec = employees => core.migrateData({ ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: CO, employees });
    const bulletins = (data, from, to) => core.closureChecks(data, CO, from, to).find(c => c.id === 'bulletins') || { count: 0, label: '' };
    // À la main : en poste de janvier 2020 à août 2026, aucun bulletin — un manque par mois, 6 × 12 + 8 = 80.
    const ali = avec([{ id: 'e1', name: 'Ali Trabelsi', hireDate: '2020-01-01', grossSalary: 900 }]);
    const b = bulletins(ali, '2020-01-01', '2026-08-31');
    assert.strictEqual(b.count, 80, 'le compte des bulletins manquants est plafonné : ' + b.count);
    assert.strictEqual(b.label, '80 bulletins de paie à établir');
    // Le cas qui rassurait à tort : l'oubli commence APRÈS le 24e mois de la période — une embauche du
    // 15 février 2022 sur une clôture ouverte en janvier 2020. À la main : février à juin 2022, cinq mois.
    const sonia = avec([{ id: 'e2', name: 'Sonia Khelifi', hireDate: '2022-02-15', grossSalary: 1100 }]);
    assert.strictEqual(bulletins(sonia, '2020-01-01', '2022-06-30').count, 5, 'un oubli au-delà du 24e mois de la période disparaît de l\'annonce');
    // Une période qui traverse un 31 décembre, et une période d'un seul mois.
    assert.strictEqual(bulletins(ali, '2025-11-01', '2026-02-28').count, 4);
    assert.strictEqual(bulletins(ali, '2026-03-01', '2026-03-31').count, 1);
  });

  // Une CNSS jamais marquée déposée disparaissait de « À faire », du calendrier fiscal et de la Paie
  // le jour où elle passait l'an dernier : `socialDue` ne regardait que deux années (SOC-01).
  t('SOC-01 : une déclaration sociale jamais déposée reste réclamée quel que soit son âge — et « À faire » n\'en détaille que trois', () => {
    const CO = { ...core.DEFAULT_COMPANY, name: 'Menuiserie', currency: 'DT', stampFee: 1, matricule: '1234567A' };
    const calc = { gross: 1200, net: 1000, cnssBase: 1200, cnssEmployee: 110.16, cnssEmployer: 198.84, accident: 6, irpp: 50, css: 0, employerCost: 1404.84, workedDays: 26, absentDays: 0 };
    const bulletin = (y, m) => ({ id: `s-${y}-${m}`, employeeId: 'e1', year: y, month: m, computed: calc, paidDate: `${y}-${String(m).padStart(2, '0')}-28` });
    const data = core.migrateData({ ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: CO,
      employees: [{ id: 'e1', name: 'Ali Trabelsi', hireDate: '2019-01-01', grossSalary: 1200 }],
      payslips: [bulletin(2022, 4), bulletin(2022, 5), bulletin(2022, 6), bulletin(2025, 7), bulletin(2025, 8), bulletin(2025, 9)] });
    const T = '2026-09-26';
    const due = core.socialDue(data, T);
    // Deux trimestres payés et jamais déposés, et les deux déclarations annuelles qu'ils entraînent :
    // quatre, de la plus ancienne à la plus récente, toutes en retard le 26 septembre 2026.
    assert.deepStrictEqual(due.map(x => x.id), ['cnss-2022-T2', 'employeur-2022', 'cnss-2025-T3', 'employeur-2025'], 'une déclaration de plus d\'un an n\'est plus réclamée');
    assert.ok(due.every(x => x.late), 'une déclaration échue n\'est pas dite en retard');
    // Le calendrier fiscal la met en tête, en retard (10.14.0 : un pense-bête regarde aussi derrière lui).
    assert.ok(core.calendrierFiscal(data, T, 30).some(x => x.socialId === 'cnss-2022-T2' && x.retard), 'le calendrier fiscal oublie la CNSS de 2022');
    // « À faire » : les trois plus anciennes en toutes lettres, puis le compte du reste.
    const ligne = core.todoList(data, CO, T).find(x => x.id === 'declarations-sociales');
    assert.ok(ligne && ligne.count === 4 && ligne.label === '4 déclarations sociales à déposer', JSON.stringify(ligne));
    assert.strictEqual(ligne.detail.split(' · ').length, 4, 'la ligne d\'« À faire » détaille chaque déclaration : ' + ligne.detail);
    assert.ok(/^Déclaration CNSS 2e trimestre 2022 — échéance dépassée le 15\/07\/2022 · /.test(ligne.detail), ligne.detail);
    assert.ok(/ · et 1 autre$/.test(ligne.detail), 'le reste ne se compte pas : ' + ligne.detail);
    // Seul « Marquer déposée » dit qu'elle ne l'est plus.
    data.socialFilings = [{ id: 'cnss-2022-T2', at: T }];
    assert.deepStrictEqual(core.socialDue(data, T).map(x => x.id), ['employeur-2022', 'cnss-2025-T3', 'employeur-2025']);
  });

  // « + Opération diverse » : la liste des comptes demandait toutes les écritures de toute l'histoire,
  // hors lot et à-nouveaux compris — quinze secondes et demie pour dix ans, au-delà des douze du chien
  // de garde (PERF-01). Le coût se mesure en LECTURES, jamais en millisecondes : une horloge dépend de
  // la machine, un compte de lectures non. Ce qui compte : combien de fois chaque pièce est relue
  // quand l'histoire s'allonge — constant, jamais plus.
  t('PERF-01 : les comptes proposés à une OD relisent chaque pièce un nombre de fois qui ne grandit pas avec les années — et ce sont les mêmes', () => {
    const construire = annees => {
      const d = JSON.parse(JSON.stringify(core.DEFAULT_DATA));
      d.company = { ...core.DEFAULT_COMPANY, name: 'Mesure', matricule: '1234567A', currency: 'DT', stampFee: 1 };
      d.clients.push({ id: 'c1', name: 'Client 1' }, { id: 'c2', name: 'Client 2' });
      d.suppliers.push({ id: 's1', name: 'Fournisseur 1' });
      const an0 = Number(core.today().slice(0, 4)) - annees; let n = 0, na = 0;
      for (let m = 0; m < annees * 12; m++) {
        const y = an0 + Math.floor(m / 12), mm = String((m % 12) + 1).padStart(2, '0');
        for (let j = 0; j < 4; j++) {
          const id = 'd' + (++n);
          d.documents.push({ id, type: 'facture', number: `FAC-${y}-${String(n).padStart(4, '0')}`, date: `${y}-${mm}-1${j}`, dueDate: `${y}-${mm}-2${j}`,
            clientId: j % 2 ? 'c1' : 'c2', status: 'envoyée', applyStamp: true, lines: [{ label: 'Presta', qty: 1, unitPrice: 100 + j, vatRate: 19 }],
            payments: j % 3 ? [{ id: 'p' + n, date: `${y}-${mm}-25`, amount: 60 }] : [] });
          // Un avoir par mois : c'est lui que chaque facture relisait hors lot, pour son lettrage.
          if (j === 1) d.documents.push({ id: 'd' + (++n), type: 'avoir', creditOf: id, number: `AVO-${y}-${String(++na).padStart(4, '0')}`, date: `${y}-${mm}-21`,
            clientId: 'c1', status: 'envoyée', lines: [{ label: 'Remise', qty: 1, unitPrice: 20, vatRate: 19 }] });
        }
        d.purchases.push({ id: 'a' + (++n), kind: 'facture', supplierId: 's1', number: 'F' + n, date: `${y}-${mm}-05`, dueDate: `${y}-${mm}-05`,
          lines: [{ label: 'Achat', qty: 1, unitPrice: 50, vatRate: 19, destination: 'charge', deductible: true }], payments: [] });
      }
      return core.migrateData(d);
    };
    const lecturesParPiece = annees => {
      const d = construire(annees); const lu = {};
      const espion = { get(cible, k, r) { if (typeof k === 'string') lu[k] = (lu[k] || 0) + 1; return Reflect.get(cible, k, r); } };
      d.documents = d.documents.map(x => new Proxy(x, espion));
      core.comptesProposes(d, d.company);
      return { lignes: (lu.lines || 0) / d.documents.length, avoirs: (lu.creditOf || 0) / d.documents.length };
    };
    const un = lecturesParPiece(1), quatre = lecturesParPiece(4);
    assert.ok(un.lignes > 0 && un.avoirs > 0, 'la sonde ne voit aucune lecture : ' + JSON.stringify(un));
    // Les à-nouveaux relisaient, pour chaque exercice, tout ce qui le précède : les lignes relues par
    // pièce grandissaient avec les années (16 → 25 de un à quatre ans, mesuré ; 45 → 412 avec, en plus, le calcul hors lot).
    assert.ok(quatre.lignes <= un.lignes * 1.1, `les lignes de chaque pièce sont relues davantage quand l'histoire s'allonge : ${un.lignes} → ${quatre.lignes}`);
    // Hors lot, chaque facture relisait tous les avoirs (174 → 4 955 lectures par pièce, mesuré).
    assert.ok(quatre.avoirs <= un.avoirs * 1.1, `les avoirs sont relus par chaque facture : ${un.avoirs} → ${quatre.avoirs}`);
    // Et la liste est celle que les à-nouveaux donnaient : mêmes comptes, mêmes noms, même marque
    // « utilisé » — sur l'exemple de cinq ans, sur une seule année passée (le résultat y est rouvert
    // par l'à-nouveau de l'année en cours), et sur l'année en cours seule (il ne l'est pas).
    const avant = d => {
      const vus = {};
      core.journalEntries(d, d.company, { from: '', to: '' }, {}).forEach(e => { if (e.account && !vus[e.account]) vus[e.account] = core.accountLabel(d, e.account, e.role ? e.tiers : ''); });
      const out = Object.keys(vus).sort().map(k => ({ compte: k, label: vus[k], utilise: true }));
      core.PLAN_COMPTABLE.forEach(([k, l]) => { if (k.length >= 2 && !vus[k]) out.push({ compte: k, label: l, utilise: false }); });
      return out;
    };
    const y = Number(core.today().slice(0, 4));
    const uneFacture = annee => core.migrateData({ ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: { ...core.DEFAULT_COMPANY, name: 'X', matricule: '1234567A', stampFee: 1 },
      clients: [{ id: 'c', name: 'C' }], documents: [{ id: 'f', type: 'facture', number: `FAC-${annee}-001`, status: 'envoyée', clientId: 'c', date: `${annee}-03-10`,
        dueDate: `${annee}-04-10`, applyStamp: true, lines: [{ label: 'S', qty: 1, unitPrice: 100, vatRate: 19 }], payments: [] }] });
    const exemple = core.migrateData(require('../../src/renderer/demo.js').buildDemoData({ name: 'X' }, core.today()));
    for (const [nom, d] of [['l\'exemple', exemple], ['une année passée', uneFacture(y - 1)], ['l\'année en cours', uneFacture(y)]]) {
      const res = core.chartAccounts(d).resultat;
      const neuf = core.comptesProposes(d, d.company);
      assert.deepStrictEqual(neuf, avant(d), nom + ' : les comptes proposés ne sont plus ceux que les à-nouveaux donnaient');
      assert.strictEqual(neuf.find(x => x.compte === res).utilise, nom !== 'l\'année en cours', nom + ' : le résultat n\'a pas la bonne marque');
    }
  });

  // Les bulletins d'une année passée n'avaient AUCUNE porte : le sélecteur d'année de la Paie ne
  // proposait que les années qui portaient déjà un bulletin — et l'année en cours. « 44 bulletins de
  // paie à établir » annoncés par la clôture, et pas un seul mois de 2023 où les établir (test humain).
  t('Paie : le sélecteur d\'année propose chaque année où un salarié était en poste — pas seulement celles qui ont déjà un bulletin', () => {
    const base = extra => core.migrateData({ ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: { ...core.DEFAULT_COMPANY, name: 'X' }, ...extra });
    const T = '2026-09-26';
    // À la main : embauché le 1er janvier 2023, aucun bulletin — quatre années, la plus récente d'abord.
    assert.deepStrictEqual(core.anneesDePaie(base({ employees: [{ id: 'e', name: 'A', hireDate: '2023-01-01' }] }), T), ['2026', '2025', '2024', '2023'],
      'une année où le salarié était en poste n\'est pas proposée');
    // Parti le 30 juin 2022 : ses deux années restent, les suivantes non — l'année en cours toujours.
    assert.deepStrictEqual(core.anneesDePaie(base({ employees: [{ id: 'e', name: 'A', hireDate: '2021-03-01', endDate: '2022-06-30' }] }), T), ['2026', '2022', '2021']);
    // Un bulletin compte toujours, même d'un salarié dont on n'a plus la fiche.
    assert.deepStrictEqual(core.anneesDePaie(base({ employees: [], payslips: [{ id: 's', employeeId: 'x', year: 2019, month: 5 }] }), T), ['2026', '2019']);
    // Et c'est ce que l'écran lit.
    assert.ok(/const years = C\.anneesDePaie\(data\);/.test(tranche('  routes.paie = () => {', '    const P_ACTION = {')),
      'la Paie construit encore ses années à la main');
  });

  // Le contrôle « 44 bulletins de paie à établir » menait à la Paie du mois en cours — où il n'en
  // manque aucun. Il nomme son premier mois manquant, et « Voir les bulletins » ouvre ce mois-là.
  t('CLOT-01 bis : le contrôle des bulletins nomme son PREMIER mois manquant, et « Voir les bulletins » ouvre la Paie sur ce mois', () => {
    const CO = { ...core.DEFAULT_COMPANY, name: 'Menuiserie', currency: 'DT', stampFee: 1, matricule: '1234567A' };
    const calc = { gross: 900, net: 800, cnssBase: 900, cnssEmployee: 82.62, cnssEmployer: 149.13, accident: 4.5, irpp: 10, css: 0, employerCost: 1053.63, workedDays: 26, absentDays: 0 };
    const slip = (y, m) => ({ id: `s-${y}-${m}`, employeeId: 'e1', year: y, month: m, computed: calc });
    const donnees = payslips => core.migrateData({ ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: CO,
      employees: [{ id: 'e1', name: 'Ali Trabelsi', hireDate: '2020-01-01', grossSalary: 900 }], payslips });
    const controle = d => core.closureChecks(d, CO, '2020-01-01', '2020-06-30').find(c => c.id === 'bulletins');
    assert.strictEqual(controle(donnees([])).mois, '2020-01');
    // Janvier et février établis : il en manque quatre, le premier est mars.
    const c = controle(donnees([slip(2020, 1), slip(2020, 2)]));
    assert.strictEqual(c.count, 4);
    assert.strictEqual(c.mois, '2020-03', 'le contrôle ne dit pas où commence le manque');
    // Le geste : on JOUE l'entrée de la table, avec un faux routeur.
    const src = tranche('    bulletins: { label: \'Voir les bulletins\', run: c => vers(', '    stock: { label: \'Voir les alertes\'');
    const paieState = { tab: 'salaries', year: '2026', month: '9' };
    const ctx = { paieState, vers: (hash, prep) => () => { prep(); ctx.hash = hash; } };
    vm.runInNewContext('this.A = {' + src + '};', ctx);
    ctx.A.bulletins.run(c);
    assert.deepStrictEqual({ ...paieState }, { tab: 'bulletins', year: '2020', month: '3', moisTouche: true }, '« Voir les bulletins » n\'ouvre pas le mois manquant');
    assert.strictEqual(ctx.hash, '#/paie');
    // Les DEUX écrans qui posent ce contrôle lui passent la ligne qu'on vient de cliquer.
    assert.ok(/CHECK_ACTIONS\[b\.dataset\.check\]\.run\(checks\.find\(c => c\.id === b\.dataset\.check\)\)/.test(app), 'les Clôtures ne passent pas le contrôle à son geste');
    assert.ok(/CHECK_ACTIONS\[b\.dataset\.check\]\.run\(plan\.checklist\.find\(c => c\.id === b\.dataset\.check\)\)/.test(app), 'l\'onglet Cabinet ne passe pas le contrôle à son geste');
  });

  // Trouvé à la souris : un achat neuf, redaté au 10/01/2023, restait dû au 26/10/2026 — l'éditeur
  // d'achat n'avait jamais reçu la règle de la 7.19.0. Et le choix du fournisseur écrasait une
  // échéance recopiée de sa facture par son délai habituel.
  const corps = nom => tranche(`  function ${nom}(`, '\n  }') + '\n  }';
  t('Achat : l\'échéance posée par l\'application suit la date de la pièce et le délai du fournisseur — jamais une échéance recopiée de sa facture', () => {
    const fournisseurs = { s60: { id: 's60', paymentTermsDays: 60 }, s0: { id: 's0', paymentTermsDays: 0 }, sv: { id: 'sv', paymentTermsDays: '' } };
    const ctx = { C: core, supplierById: id => fournisseurs[id] || null };
    vm.runInNewContext([corps('echeanceAuto'), corps('echeanceSuivie'), corps('delaiAchat')].join('\n') + '\nthis.f = { echeanceAuto, echeanceSuivie, delaiAchat };', ctx);
    const { echeanceAuto, echeanceSuivie, delaiAchat } = ctx.f;
    assert.deepStrictEqual(['s60', 's0', 'sv', '', 'inconnu'].map(delaiAchat), [60, 0, 30, 30, 30], 'le délai d\'un achat n\'est pas celui du fournisseur');
    // Le cas trouvé : posée le 26/09/2026 à trente jours, redatée au 10/01/2023 — due le 09/02/2023.
    const auto = echeanceAuto('2026-09-26', '2026-10-26', 30);
    assert.strictEqual(auto, '2026-10-26');
    assert.strictEqual(echeanceSuivie('2023-01-10', '2026-10-26', auto, 30), '2023-02-09', 'l\'achat redaté reste dû à l\'ancienne échéance');
    // Chez un fournisseur à soixante jours : 10/01/2023 + 60 = 11/03/2023.
    assert.strictEqual(echeanceSuivie('2023-01-10', '2026-11-25', echeanceAuto('2026-09-26', '2026-11-25', 60), 60), '2023-03-11');
    // Recopiée de la facture (ni la date plus le délai, ni posée par l'application) : elle ne bouge
    // jamais, même à la réouverture de la pièce.
    assert.strictEqual(echeanceAuto('2023-01-10', '2023-03-31', 30), '', 'une échéance recopiée passe pour posée par l\'application');
    assert.strictEqual(echeanceSuivie('2023-01-12', '2023-03-31', '', 30), '');
    // L'éditeur d'achat s'en sert, avec le délai du fournisseur.
    const ed = tranche('  routes.achat = (parts) => {', '    const lieCombo = bindCombo(');
    assert.ok(/let dueAuto = echeanceAuto\(p\.date, p\.dueDate, delaiAchat\(p\.supplierId\)\);/.test(ed), 'l\'éditeur d\'achat ne sait pas quelle échéance il a posée');
    assert.ok(/e\.target\.name === 'date' \? echeanceSuivie\(p\.date, p\.dueDate, dueAuto, delaiAchat\(p\.supplierId\)\)/.test(ed), 'la date d\'un achat ne fait pas suivre son échéance');
    // Choisir le fournisseur ne reprend l'échéance que si l'application l'avait posée — ou qu'elle manque.
    const choix = ed.slice(ed.indexOf('e.target.name === \'supplierId\''));
    assert.ok(/if \(p\.date && \(\(dueAuto && p\.dueDate === dueAuto\) \|\| \(!p\.dueDate && termes\)\)\)/.test(choix),
      'choisir le fournisseur écrase une échéance recopiée de sa facture');
    // Une règle pour le délai : l'achat neuf et sa copie aussi (la copie d'un achat à soixante jours
    // repartait à trente).
    assert.ok(/const days = delaiAchat\(supplierId\);/.test(app), 'l\'achat neuf calcule son délai à part');
    assert.ok(/copy\.dueDate = C\.addDays\(copy\.date, delaiAchat\(copy\.supplierId\)\)/.test(app), 'la copie d\'un achat repart à trente jours');
  });

  // H-E1, une fois de plus : la note « Échéance recalculée » de la 7.19.0 naissait dans une cellule de
  // la grille de l'éditeur, et tout le formulaire descendait d'une rangée — « Objet » glissait sous le
  // curseur, « Référence » passait à la ligne. Et sur un devis, elle disait « Échéance » d'une date de
  // validité. On le dit par un message passager, qui porte « Annuler ».
  t('H-E1 : l\'échéance recalculée se dit par un message passager qui ne pousse rien — « Annuler » la rend, et seulement sur une pièce encore ouverte', () => {
    assert.ok(!/id="due-auto"/.test(app), 'une note naît encore dans la grille du formulaire');
    const vus = [];
    const ctx = { C: core, toastUndo: (msg, undo) => vus.push({ msg, undo }), toast: m => vus.push({ toast: m }) };
    vm.runInNewContext(tranche('  const pl = (n, un, plur) =>', '\n') + '\n' + corps('annoncerEcheance') + '\nthis.a = annoncerEcheance;', ctx);
    let annule = 0;
    ctx.a('Échéance', '2023-02-09', 30, { isConnected: true }, () => annule++);
    assert.strictEqual(vus[0].msg, 'Échéance recalculée au 09/02/2023 : 30 jours après la date.');
    vus[0].undo();
    assert.strictEqual(annule, 1, '« Annuler » ne rend pas l\'échéance');
    // Cliqué après avoir quitté la pièce : rien ne change — et on le dit.
    ctx.a('Échéance', '2023-02-09', 30, { isConnected: false }, () => annule++);
    vus[1].undo();
    assert.strictEqual(annule, 1, '« Annuler » touche une pièce qui n\'est plus à l\'écran');
    assert.ok(vus[2] && /n'est plus ouverte/.test(vus[2].toast || ''), 'rien ne dit pourquoi « Annuler » n\'a rien fait');
    // Payable à réception : « le jour même », jamais « 0 jour ».
    ctx.a('Échéance', '2023-01-10', 0, { isConnected: true }, () => {});
    assert.strictEqual(vus[3].msg, 'Échéance recalculée au 10/01/2023 : le jour même de la date.');
    // Un devis nomme sa date de validité.
    assert.ok(/annoncerEcheance\(isQ \? 'Date de validité' : 'Échéance', neuf, joursEcheance, head,/.test(app), 'un devis dit « Échéance » de sa date de validité');
  });

  // ---------- C1 : un bien au bilan sans être au tableau des immobilisations ----------
  // Regardé un 1er janvier, l'exemple portait 53 950 DT au 22 et 52 500 sur la page
  // Immobilisations : l'imprimante de décembre n'avait pas de fiche. L'invariant de
  // verite-comptable.js, qui compare les deux, tombait chaque 1er–18 janvier.
  const CO_C1 = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', matricule: '1234567A', stampFee: 1, currency: 'DT' };
  const vingtDeux = (d, y) => {
    const acc = core.chartAccounts(d);
    const bg = core.balanceGenerale(d, d.company, { from: `${y}-01-01`, to: `${y}-12-31` });
    return core.round3(bg.rows.filter(r => r.account.startsWith(acc.immobilisations)).reduce((s, r) => s + r.solde, 0));
  };
  const surLaPage = (d, y) => {
    const at = core.assetTotals(d, y), hors = core.immosHorsTableau(d, y);
    return core.round3(at.grossActif + hors.auBilan - hors.horsBilan);
  };
  // Une scie à format achetée le 20/12/2025, et ce qu'on en fait selon le cas.
  const scie = (fiche, achatLe, avoir) => core.migrateData({
    company: { ...CO_C1 },
    suppliers: [{ id: 's1', name: 'Machines du Sahel' }],
    purchases: [
      { id: 'p1', kind: 'facture', supplierId: 's1', number: 'MS-77', date: achatLe || '2025-12-20',
        lines: [{ label: 'Scie à format', qty: 1, unitPrice: 10000, vatRate: 19, destination: 'immobilisation' }] },
      ...(avoir ? [{ id: 'p2', kind: 'avoir', achatLie: 'p1', supplierId: 's1', number: 'MS-A1', date: avoir.date,
        lines: [{ label: 'Scie à format', qty: 1, unitPrice: avoir.montant, vatRate: 19, destination: 'immobilisation' }] }] : [])
    ],
    assets: fiche ? [{ id: 'a1', label: 'Scie à format', category: 'materiel', amount: 10000, residual: 0, years: 5,
      date: fiche, purchaseId: 'p1', lineIndex: 0 }] : []
  });

  t('C1 : le compte 22 au 31/12 est ce que la page Immobilisations montre — son tableau, plus ce qu\'elle nomme au-dessus', () => {
    // L'exemple, regardé un 1er janvier : l'imprimante de décembre sans fiche.
    const ex = core.migrateData(require('../../src/renderer/demo.js').buildDemoData(CO_C1, '2026-01-01'));
    const hEx = core.immosHorsTableau(ex, 2025);
    assert.ok(hEx.sansFiche.length >= 1, 'les données ne discriminent pas : aucune ligne sans fiche au 31/12/2025');
    assert.notStrictEqual(vingtDeux(ex, 2025), core.assetTotals(ex, 2025).grossActif, 'le tableau seul tombe déjà sur le 22 : le test ne voit rien');
    assert.strictEqual(vingtDeux(ex, 2025), surLaPage(ex, 2025), 'le bilan et la page Immobilisations ne disent pas la même chose');
    // (a) sans fiche : au 22 depuis l'achat, nulle part au tableau.
    const a = scie(null);
    assert.deepStrictEqual(core.immosHorsTableau(a, 2025).sansFiche.map(w => [w.label, w.amount]), [['Scie à format', 10000]]);
    assert.strictEqual(vingtDeux(a, 2025), 10000);
    assert.strictEqual(surLaPage(a, 2025), 10000);
    // Achetée en mars 2026 : ni au 22 ni au-dessus du tableau de 2025.
    const a2 = scie(null, '2026-03-01');
    assert.ok(core.immosHorsTableau(a2, 2025).vide, 'un achat de 2026 est compté au bilan de 2025');
    assert.strictEqual(vingtDeux(a2, 2025), surLaPage(a2, 2025));
    // (b) achetée en décembre, mise en service en janvier : au 22 en 2025, au tableau en 2026.
    const b = scie('2026-01-05');
    const hb = core.immosHorsTableau(b, 2025);
    assert.deepStrictEqual([hb.sansFiche.length, hb.pasEnService.map(w => w.amount)], [0, [10000]]);
    assert.strictEqual(vingtDeux(b, 2025), surLaPage(b, 2025));
    assert.ok(core.immosHorsTableau(b, 2026).vide, 'en 2026 la scie est au tableau : rien à nommer');
    assert.strictEqual(vingtDeux(b, 2026), surLaPage(b, 2026));
    // (c) mise en service AVANT sa facture : au tableau de 2025, pas encore au 22.
    const c = scie('2025-12-15', '2026-01-10');
    const hc = core.immosHorsTableau(c, 2025);
    assert.deepStrictEqual([hc.avantFacture.map(w => w.amount), hc.horsBilan], [[10000], 10000]);
    assert.strictEqual(vingtDeux(c, 2025), 0);
    assert.strictEqual(surLaPage(c, 2025), 0, 'un bien en service avant sa facture est compté au 22 avant d\'y être');
    // (d) un avoir de février diminue la fiche PROPOSÉE (le montant d'aujourd'hui), pas le 22 du 31/12.
    const d = scie(null, null, { date: '2026-02-01', montant: 2000 });
    assert.strictEqual(core.immosHorsTableau(d, 2025).sansFiche[0].amount, 10000, 'le 31/12 compte un avoir qui n\'existe pas encore');
    assert.strictEqual(core.assetsToCreate(d)[0].amount, 8000, 'la fiche proposée ignore l\'avoir');
    assert.strictEqual(vingtDeux(d, 2025), surLaPage(d, 2025));
    assert.strictEqual(vingtDeux(d, 2026), surLaPage(d, 2026));
  });

  t('C1 : une fiche liée à son achat sans rang de ligne ne laisse pas l\'achat « à immobiliser » — une seconde fiche amortirait le bien deux fois', () => {
    // La fiche porte l'achat mais pas `lineIndex` (des données écrites à la main, un import).
    const d = scie(null);
    // Nommée autrement que la ligne d'achat (on renomme une fiche) : seule la règle « la seule ligne
    // immobilisation de l'achat » peut la rattacher — le libellé ne départage rien ici.
    d.assets = [{ id: 'a1', label: 'Scie Altendorf F45', category: 'materiel', amount: 10000, residual: 0, years: 5, date: '2025-12-20', purchaseId: 'p1' }];
    assert.strictEqual(core.ligneDeFiche(d.assets[0], d.purchases[0]), 0, 'la seule ligne « immobilisation » de l\'achat n\'est pas reconnue');
    assert.deepStrictEqual(core.assetsToCreate(d), [], 'l\'achat qui a sa fiche reste « à immobiliser »');
    assert.ok(core.immosHorsTableau(d, 2025).vide, 'l\'encadré dit « sans fiche » d\'un bien qui en a une');
    assert.strictEqual(vingtDeux(d, 2025), surLaPage(d, 2025));
    // Deux lignes « immobilisation » : c'est le libellé qui départage, et un rang qui désigne une
    // ligne de charge (un achat corrigé depuis) ne compte pas.
    const deux = { lines: [{ label: 'Raboteuse', destination: 'immobilisation' }, { label: 'Fournitures', destination: 'charge' }, { label: 'Scie à format', destination: 'immobilisation' }] };
    assert.strictEqual(core.ligneDeFiche({ label: 'Scie à format' }, deux), 2);
    assert.strictEqual(core.ligneDeFiche({ label: 'Scie à format', lineIndex: 1 }, deux), 2, 'un rang qui désigne une ligne de charge est cru');
    assert.strictEqual(core.ligneDeFiche({ label: 'Raboteuse', lineIndex: 0 }, deux), 0);
    assert.strictEqual(core.ligneDeFiche({ label: 'Tour à bois' }, deux), -1, 'une fiche sans ligne reconnaissable prend une ligne au hasard');
    // L'éditeur d'achat lit la même règle.
    assert.ok(/new Map\(\(data\.assets \|\| \[\]\)\.filter\(a => a\.purchaseId && a\.purchaseId === p\.id\)\.map\(a => \[C\.ligneDeFiche\(a, p\), a\]\)\)/.test(app), 'l\'éditeur d\'achat relit `lineIndex` à la main');
  });

  t('C1 : clôturer une période où un achat attend sa fiche le dit — sauf si l\'offre ferme le module, et « Voir » y mène', () => {
    const a = scie(null);
    const chk = (from, to, opts) => core.closureChecks(a, a.company, from, to, opts).find(c => c.id === 'immobilisations');
    const dec = chk('2025-12-01', '2025-12-31');
    assert.ok(dec && dec.level === 'warn' && dec.count === 1, 'rien ne dit qu\'un achat attend sa fiche avant de clôturer décembre');
    assert.strictEqual(dec.label, '1 achat à immobiliser dans la période');
    assert.ok(/ne pourra plus l'être sans rouvrir/.test(dec.detail), 'le contrôle ne dit pas pourquoi c\'est avant la clôture qu\'il faut agir');
    assert.ok(!chk('2026-01-01', '2026-01-31'), 'un achat d\'un autre mois est réclamé');
    assert.ok(!chk('2025-12-01', '2025-12-31', { reserves: ['immos'] }), 'on réclame une fiche que l\'offre ne permet pas de créer');
    // Le paquet porte la même liste, et le même respect de l'offre.
    const per = core.packPeriod(2025, 12);
    assert.ok(core.packPlan(a, a.company, per).checklist.some(c => c.id === 'immobilisations'));
    assert.ok(!core.packPlan(a, a.company, per, { reserves: ['immos'] }).checklist.some(c => c.id === 'immobilisations'));
    // Chaque appel de l'écran passe l'offre (un argument facultatif se tient appel par appel).
    // Les arguments de chaque appel, parenthèses équilibrées (un `?:` ou une accolade ne coupent rien).
    const appels = [...app.matchAll(/C\.(closureChecks|packPlan)\(/g)].map(m => {
      let i = m.index + m[0].length, prof = 1;
      while (i < app.length && prof) { if (app[i] === '(') prof++; else if (app[i] === ')') prof--; i++; }
      return app.slice(m.index, i);
    });
    assert.ok(appels.length >= 3, 'les appels ont changé de forme : ' + appels.length);
    appels.forEach(x => assert.ok(/reserves: licence\.reserves/.test(x), 'un appel oublie l\'offre : ' + x.slice(0, 90)));
    // « Voir les achats à immobiliser » ouvre l'onglet où la fiche se crée.
    const ctx = { immoState: { tab: 'tableau' }, vise: '', filtre: () => () => {},
      vers: (hash, poser) => () => { if (poser) poser(); ctx.vise = hash; } };
    const table = tranche('  const CHECK_ACTIONS = {', '\n  };') + '\n  };';
    vm.runInNewContext(table.replace('const CHECK_ACTIONS', 'this.CA'), ctx);
    assert.ok(ctx.CA.immobilisations, 'le contrôle n\'a pas de bouton');
    ctx.CA.immobilisations.run();
    assert.deepStrictEqual([ctx.vise, ctx.immoState.tab], ['#/immos', 'attente']);
  });

  t('C1 : la page Immobilisations nomme au-dessus du tableau ce que le bilan porte en plus — avec le geste qui le règle, un seul vert', () => {
    const src = tranche('    function horsTableauHtml(hors, annee) {', '    function brancherHorsTableau(hors) {');
    const jouer = (hors, reserves, annee) => {
      const ctx = { h: core.escapeHtml, C: core, cur: 'DT', licence: { reserves: reserves || [] } };
      vm.runInNewContext(src + '\nthis.f = horsTableauHtml;', ctx);
      return ctx.f(hors, annee || '2025');
    };
    const un = jouer(core.immosHorsTableau(scie(null), 2025));
    assert.ok(/id="im-sans-fiche"/.test(un) && /« Scie à format » n'a pas de fiche/.test(un), un.slice(0, 200));
    assert.ok(un.includes(core.money(10000, 'DT')) && /au bilan du 31\/12\/2025 \(compte 22\)/.test(un), 'le montant et le compte ne sont pas dits');
    assert.ok(/class="btn btn-sm btn-primary" id="im-creer-fiche">Créer la fiche du bien…/.test(un), 'pas de geste, ou pas le vert');
    // L'exercice en cours ne parle pas d'un 31/12 qui n'est pas encore arrivé.
    assert.ok(/au bilan \(compte 22\) depuis son achat/.test(jouer(core.immosHorsTableau(scie(null), 2025), [], '2099')), 'l\'exercice en cours annonce le bilan d\'un 31/12 à venir');
    const ferme = jouer(core.immosHorsTableau(scie(null), 2025), ['immos']);
    assert.ok(!/im-creer-fiche/.test(ferme) && /Ton comptable/.test(ferme), 'l\'offre fermée propose un geste interdit');
    const deux = core.immosHorsTableau(scie(null), 2025);
    deux.sansFiche = [deux.sansFiche[0], { ...deux.sansFiche[0], label: 'Raboteuse' }];
    assert.ok(/Voir les 2 lignes à immobiliser/.test(jouer(deux)) && /2 lignes d'achat marquées « immobilisation » n'ont pas de fiche/.test(jouer(deux)));
    assert.ok(/id="im-pas-en-service"[^]*mis en service plus tard/.test(jouer(core.immosHorsTableau(scie('2026-01-05'), 2025))));
    assert.ok(/id="im-avant-facture"[^]*avant sa facture/.test(jouer(core.immosHorsTableau(scie('2025-12-15', '2026-01-10'), 2025))));
    assert.strictEqual(jouer(core.immosHorsTableau(scie('2025-12-20'), 2025)), '', 'une scie au tableau fait parler l\'encadré');
    // Posé au-dessus des cartes, branché, et le vert de l'en-tête s'efface devant lui.
    const table = tranche('    function drawTable() {', '    function drawWaiting() {');
    assert.ok(/const hors = C\.immosHorsTableau\(data, y\);/.test(table));
    assert.ok(/innerHTML = `\$\{horsTableauHtml\(hors, s\.year\)\}\s*<div class="stats">/.test(table), 'l\'encadré n\'est pas au-dessus des cartes');
    assert.ok(/brancherHorsTableau\(hors\);/.test(table), 'le bouton de l\'encadré n\'est pas branché');
    assert.ok(/toggle\('btn-primary', [^\n]*&& !sansFicheAn\)/.test(app), 'deux verts : « + Nouveau bien » reste principal au-dessus de « Créer la fiche du bien… »');
  });

  // ---------- NUM-01 : une règle de champ posée dans un conteneur ne perd plus contre la règle commune ----------
  // En 7.9.0 la règle commune des champs est passée de `input[type=text]` (0,1,1) à une chaîne de
  // quatre `:not()` nus (0,4,1). Toute règle de champ posée dans un conteneur a perdu contre elle, en
  // silence, dans les deux applications : le prix d'un achat de 4 500 DT s'affichait « 4500,00 »
  // coupé, un mot de passe passait sous « Afficher », une clé de licence perdait sa chasse fixe, un
  // champ qui a le curseur gardait sa bordure grise. Neuf rattrapages règle par règle. Le test CALCULE
  // la spécificité de chaque règle de champ des deux feuilles, et exige qu'aucune ne perde.
  t('NUM-01 : aucune règle de champ d\'un conteneur ne perd contre la règle commune des champs — dans les deux feuilles', () => {
    const lire = f => fs.readFileSync(path.join(__dirname, '../../src', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const feuilles = [['renderer/style.css', lire('renderer/style.css')], ['cabinet/renderer/cabinet.css', lire('cabinet/renderer/cabinet.css')]];
    // La spécificité d'un sélecteur : identifiants, classes/attributs/pseudo-classes, éléments.
    // :where() ne pèse rien ; :not(), :is() et :has() pèsent leur argument le plus lourd.
    const plusLourd = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
    const decouper = liste => { const out = []; let n = 0, cur = ''; for (const ch of liste) { if (ch === '(') n++; if (ch === ')') n--; if (ch === ',' && !n) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
    const specificite = sel => {
      let a = 0, b = 0, c = 0, reste = '';
      for (let i = 0; i < sel.length; i++) {
        const m = /^:(where|not|is|has)\(/.exec(sel.slice(i));
        if (!m) { reste += sel[i]; continue; }
        let n = 1, j = i + m[0].length; while (j < sel.length && n) { if (sel[j] === '(') n++; if (sel[j] === ')') n--; j++; }
        const arg = sel.slice(i + m[0].length, j - 1);
        if (m[1] !== 'where') { const s = decouper(arg).map(specificite).sort(plusLourd).pop(); a += s[0]; b += s[1]; c += s[2]; }
        reste += ' '; i = j - 1;
      }
      const sansAttr = reste.replace(/\[[^\]]*\]/g, m => { b++; return ' '; });
      a += (sansAttr.match(/#[\w-]+/g) || []).length;
      b += (sansAttr.match(/\.[\w-]+/g) || []).length + (sansAttr.match(/(^|[^:]):(?!:)[\w-]+/g) || []).length;
      c += (sansAttr.match(/::[\w-]+/g) || []).length + (sansAttr.replace(/[#.:]+[\w-]+/g, ' ').match(/[a-z][\w-]*/gi) || []).length;
      return [a, b, c];
    };
    // Les règles, dans l'ordre de la cascade (style.css puis cabinet.css, comme les deux index.html).
    const regles = [];
    for (const [nom, css] of feuilles) {
      const re = /([^{}]+)\{([^{}]*)\}/g; let m;
      while ((m = re.exec(css))) {
        const sels = m[1].trim(); if (!sels || sels.startsWith('@')) continue;
        const decl = m[2].split(';').map(x => x.trim()).filter(Boolean).map(x => ({ prop: x.split(':')[0].trim(), important: /!important/.test(x) }));
        decouper(sels).forEach(sel => regles.push({ feuille: nom, sel, decl, rang: regles.length }));
      }
    }
    const commune = regles.find(r => r.feuille === 'renderer/style.css' && /^input\b/.test(r.sel) && r.decl.some(d => d.prop === 'width') && regles.some(x => x.rang === r.rang + 2 && x.sel === 'textarea'));
    assert.ok(commune, 'la règle commune des champs est introuvable (input…, select, textarea)');
    const specCommune = specificite(commune.sel);
    const siennes = new Set(commune.decl.map(d => d.prop));
    const touche = prop => siennes.has(prop) || [...siennes].some(p => prop.startsWith(p + '-'));
    // Une règle qui vise un champ texte : son dernier composé est un `input`, sans pseudo-élément, et
    // pas un type que la règle commune exclut.
    const perdantes = regles.filter(r => {
      if (r === commune || r.feuille === commune.feuille && r.rang === commune.rang) return false;
      const dernier = r.sel.split(/\s*[>+~]\s*|\s+/).pop();
      if (!/^input\b/.test(dernier) || /::/.test(dernier) || /type=["']?(checkbox|radio|file|range|hidden)/.test(dernier)) return false;
      const disputees = r.decl.filter(d => !d.important && touche(d.prop));
      if (!disputees.length) return false;
      const cmp = plusLourd(specificite(r.sel), specCommune);
      return cmp < 0 || (cmp === 0 && r.rang < commune.rang);
    }).map(r => `${r.feuille} : ${r.sel} (${specificite(r.sel).join(',')} contre ${specCommune.join(',')})`);
    assert.deepStrictEqual(perdantes, [], 'des règles de champ perdent contre la règle commune des champs :\n  ' + perdantes.join('\n  '));
    // Et l'instrument voit bien ce qu'il juge : sur la forme de la 7.9.0, il nomme les règles qui ont
    // perdu pendant deux semaines (preuve qu'il ne passe pas faute d'avoir lu quelque chose).
    const specAncienne = specificite('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range])');
    assert.deepStrictEqual(specAncienne, [0, 4, 1]);
    const auraientPerdu = regles.filter(r => /^(table\.lines-edit input\.num|\.pw-wrap input|\.token-box input|\.palette input|input:focus)$/.test(r.sel) && plusLourd(specificite(r.sel), specAncienne) < 0).map(r => r.sel);
    assert.deepStrictEqual([...new Set(auraientPerdu)].sort(), ['.palette input', '.pw-wrap input', '.token-box input', 'input:focus', 'table.lines-edit input.num'].sort());
  });

  await ta('MC-07 / MC-11 : la console écrit un montant d\'une seule façon — le dinar à trois décimales, l\'euro à deux, « DT » et « TND » la même monnaie', async () => {
    const P = await import('../../plateforme/skanfact-api.mjs');
    assert.strictEqual(P.fmtMontant(1822.1, 'TND'), '1\u202f822,100\u00a0TND');
    assert.strictEqual(P.fmtMontant(1822.1, 'DT'), '1\u202f822,100\u00a0TND');
    assert.strictEqual(P.fmtMontant(690, 'EUR'), '690,00\u00a0EUR');
    assert.strictEqual(P.fmtMontant(-5, 'DT'), '\u22125,000\u00a0TND');
    assert.strictEqual(P.fmtMontant(null, 'DT'), '', 'un montant absent disparaît de la phrase');
    // Les deux mails qui portent un montant : la relance d'impayé et le devis. Un type qui n'en porte
    // pas (« fin ») ne prouverait rien — le test l'a fait passer une fois pour cette raison.
    ['impayee', 'devis'].forEach(type => {
      const mail = P.mailRelance(type, { client: 'X', offre: 'Entreprise', montant: 1380, devise: 'DT' }).corps;
      assert.ok(mail.includes('1\u202f380,000\u00a0TND'), type + ' : le mail n\'écrit pas le montant comme l\'écran (1 380,000 TND) : ' + mail.slice(0, 200));
      assert.ok(!/1380/.test(mail), type + ' : le mail écrit le montant sans ses milliers');
    });
  });
};
