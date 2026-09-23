'use strict';
// ============================================================================================
// Le rapport QA de l'application ENTREPRISE (23/09/2026) — E-01 à E-14, corrigés en 10.12.0.
//
// Une session a tenu une vraie entreprise tunisienne (Atelier Nour Design SUARL, régime réel,
// assujettie TVA) du premier écran au paquet du comptable, par de vrais clics et de vraies frappes.
// Chaque test ci-dessous se prouve en réintroduisant son défaut (règle 7.2.0), et chaque montant
// attendu est calculé à la main depuis la règle — jamais recopié de la sortie (règle 7.0.1).
// E-08 (la prévision en devise) vit dans `devise-achat.js`, avec les autres agrégateurs d'achats.
module.exports = ({ t, assert, lireSource }) => {
  const core = require('../../src/renderer/core.js');
  const société = { ...core.DEFAULT_DATA.company, name: 'Atelier Nour Design SUARL', currency: 'DT', stampFee: 1, regime: 'reel' };
  const vierge = () => { const d = JSON.parse(JSON.stringify(core.DEFAULT_DATA)); d.company = société; return d; };

  // Le code d'un fichier sans ses commentaires : un test qui lit du code doit lire du CODE (6.8.0).
  const code = (...chemin) => lireSource(...chemin)
    .replace(/\$\{\/\*[\s\S]*?\*\/''\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

  // ------------------------------------------------------------------------------------ E-10
  // Trois gestes le même jour : stock de départ 5 à 700, vente de 2, achat de 3 à 800. Les
  // mouvements se triaient par IDENTIFIANT (« buy- » < « doc- » < « init- ») : Achat → Vente → Stock
  // de départ, et la vente sortait au coût de l'achat qui la SUIT.
  const JOUR = '2026-08-15';
  const stockDuJour = ({ avecInstants = true } = {}) => {
    const d = vierge();
    d.catalog = [{ id: 'k1', label: 'Chaise Tolix', unit: 'pièce', unitPrice: 1200, vatRate: 19, tracked: true,
      initialQty: 5, initialCost: 700, initialDate: JOUR }];
    d.clients = [{ id: 'c1', name: 'Hôtel Les Oliviers' }];
    d.suppliers = [{ id: 's1', name: 'Mobilier Sfax' }];
    // L'ordre des gestes : la vente (émise à 10 h), PUIS l'achat (saisi à 11 h).
    const dix = Date.UTC(2026, 7, 15, 9), onze = Date.UTC(2026, 7, 15, 10);
    d.documents = [{ id: 'f1', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', date: JOUR, clientId: 'c1',
      lines: [{ label: 'Chaise Tolix', itemId: 'k1', qty: 2, unitPrice: 1200, vatRate: 19 }], payments: [],
      ...(avecInstants ? { createdAt: dix, issuedTs: dix } : {}) }];
    d.purchases = [{ id: 'p1', kind: 'facture', supplierId: 's1', number: 'MS-77', date: JOUR, currency: 'DT', exchangeRate: 1,
      lines: [{ label: 'Chaise Tolix', itemId: 'k1', qty: 3, unitPrice: 800, vatRate: 19, destination: 'stock', deductible: true }],
      payments: [], ...(avecInstants ? { createdAt: onze } : {}) }];
    return d;
  };

  t('Rapport QA E-10 : le stock se valorise dans l\'ordre des gestes — le départ, la vente, puis l\'achat', () => {
    const s = core.stockOf(stockDuJour(), 'k1');
    // 5 × 700 = 3 500 ; la vente sort 2 × 700 → 3 × 700 = 2 100 ; l'achat entre 3 × 800 = 2 400.
    assert.strictEqual(s.qty, 6);
    assert.strictEqual(s.value, 4500, `valeur ${s.value} : la vente a été sortie au coût de l'achat qui la suit`);
    assert.strictEqual(s.cmp, 750);
    const sources = s.moves.map(m => m.source);
    assert.deepStrictEqual(sources, ['depart', 'vente', 'achat'], 'le stock de départ ouvre sa journée, puis les gestes dans leur ordre');
    assert.deepStrictEqual(s.moves.map(m => m.qtyAfter), [5, 3, 6], '« Stock après » se lit comme un cumul');
    assert.strictEqual(s.moves[1].unitApplied, 700, 'la vente sort au coût moyen du moment, 700');
  });

  t('Rapport QA E-10 : sans instant connu, le stock de départ passe en tête et les entrées avant les sorties', () => {
    // Des pièces d'avant la 10.12.0 n'ont pas toutes d'instant : l'ordre se DÉCIDE, il ne se laisse
    // plus au hasard des identifiants. 5 × 700, puis +3 × 800 → 8 à 737,5, puis −2 → 6 × 737,5.
    const s = core.stockOf(stockDuJour({ avecInstants: false }), 'k1');
    assert.deepStrictEqual(s.moves.map(m => m.source), ['depart', 'achat', 'vente']);
    assert.strictEqual(s.qty, 6);
    assert.strictEqual(s.value, 4425);
    assert.ok(s.moves.every(m => m.qtyAfter >= 0), 'aucune sortie ne se valorise sur une marchandise pas encore là');
  });

  t('Rapport QA E-10 : l\'instant d\'émission se pose à l\'émission, et ne se copie jamais', () => {
    const ent = code('src', 'renderer', 'app.js');
    const i = ent.indexOf('function issue()');
    const issue = ent.slice(i, ent.indexOf('\n    }\n', i));
    assert.ok(/doc\.issuedTs = Date\.now\(\)/.test(issue), 'l\'émission ne note plus son instant : la sortie de stock reprend l\'ordre du brouillon');
    // Une pièce tirée d'une autre naît brouillon : elle ne porte pas l'instant de celle dont elle vient.
    const conv = core.convertDoc({ id: 'x', type: 'facture', number: 'FAC-1', status: 'envoyée', issuedTs: 123, lines: [] }, 'livraison', société, JOUR);
    assert.strictEqual(conv.issuedTs, undefined, 'un bon de livraison tiré d\'une facture emporterait l\'instant de la facture');
    assert.ok(/issuedTs: undefined/.test(ent.slice(ent.indexOf('function duplicate'), ent.indexOf('function duplicate') + 1200)),
      'une copie emporterait l\'instant d\'émission de l\'original');
  });
  // ------------------------------------------------------------------------------------ E-04
  // La garde de la 10.10.0 ferme la porte, elle ne nettoie pas ce qui est passé : un bulletin à net
  // négatif enregistré avant restait sans alerte, écriture inversée comprise, et la déclaration CNSS
  // l'additionnait sous un « Marquer déposée ».
  const avecBulletins = () => {
    const d = vierge();
    d.employees = [{ id: 'e1', name: 'Sami Ben Salah', grossSalary: 1200 }, { id: 'e2', name: 'Ines Jaziri', grossSalary: 900 }];
    d.payslips = [
      { id: 'b1', employeeId: 'e1', year: 2026, month: 8, computed: { gross: 1200, net: 980.5 } },
      { id: 'b2', employeeId: 'e2', year: 2026, month: 8, computed: { gross: -461.54, net: -586.837 } },
      { id: 'b3', employeeId: 'e1', year: 2026, month: 7 }          // sans copie de calcul : pas jugé
    ];
    return d;
  };

  t('Rapport QA E-04 : un bulletin au net négatif déjà enregistré se signale, en rouge, et se nomme', () => {
    const d = avecBulletins();
    const imp = core.bulletinsImpossibles(d);
    assert.deepStrictEqual(imp.map(b => b.id), ['b2'], 'seul le bulletin au net négatif est impossible');
    assert.strictEqual(imp[0].net, -586.837);
    const l = core.todoList(d, d.company, '2026-09-10').find(x => x.id === 'bulletins-impossibles');
    assert.ok(l, '« À faire » ne dit rien d\'un bulletin impossible');
    assert.strictEqual(l.level, 'danger', 'il fausse une déclaration qu\'on s\'apprête à déposer : c\'est rouge');
    assert.ok(/Ines Jaziri/.test(l.detail) && /août 2026/.test(l.detail), `la ligne doit nommer qui et quand : ${l.detail}`);
    assert.ok(/1 bulletin au net négatif/.test(l.label), l.label);
    // Et un dossier propre ne crie pas.
    const propre = avecBulletins(); propre.payslips = propre.payslips.filter(b => b.id !== 'b2');
    assert.ok(!core.todoList(propre, propre.company, '2026-09-10').some(x => x.id === 'bulletins-impossibles'));
  });

  t('Rapport QA E-04 : la déclaration CNSS d\'un trimestre qui compte un bulletin impossible ne se marque pas déposée', () => {
    const ent = code('src', 'renderer', 'app.js');
    const i = ent.indexOf('function drawDeclarations()');
    const decl = ent.slice(i, i + 9000);
    assert.ok(/C\.bulletinsImpossibles\(data\)/.test(decl), 'la déclaration ne regarde pas les bulletins impossibles');
    const bouton = decl.slice(decl.indexOf('id="cn-file"') - 200, decl.indexOf('id="cn-file"') + 400);
    assert.ok(/raisonCnss\(y, q\)[^\n]*disabled title=/.test(bouton), '« Marquer déposée » reste allumé sur un trimestre faux');
    assert.ok(/id="cn-impossible"/.test(decl), 'le motif ne se lit pas au-dessus des boutons (9.4.5)');
    assert.ok(/data-file="\$\{h\(x\.id\)\}"[^\n]*raisonDe\(x\.id\)[^\n]*disabled/.test(decl),
      'la ligne « À déposer » propose encore « Marquer déposée » sur le trimestre faux');
  });
  // ------------------------------------------------------------------------------------ E-02
  // La fenêtre d'acompte annonçait le solde à la main — « total du devis − acompte » — et se trompait
  // de deux timbres : elle retranchait celui de l'acompte et oubliait celui du solde. Les factures,
  // elles, étaient justes. L'annonce passe désormais par les fonctions qui les fabriquent ; ce test
  // tient la règle de calcul qu'elle emprunte, sur les chiffres exacts du rapport.
  const devis = ht => ({ id: 'q1', type: 'devis', number: 'DEV-2026-004', status: 'accepté', date: JOUR, clientId: 'c1',
    lines: [{ label: 'Identité visuelle', qty: 1, unitPrice: ht, vatRate: 19 }], discountRate: 0 });
  const facture = (q, lignes, remise) => ({ ...q, type: 'facture', status: 'brouillon', number: '', lines: lignes, discountRate: remise || 0, applyStamp: true, withholdingRate: 0 });
  [[4800, 30, 1714.6, 3999.4], [700, 50, 417.5, 417.5], [3000, 30, 1072, 2500]].forEach(([ht, pct, acompteAttendu, soldeAttendu]) => {
    t(`Rapport QA E-02 : un devis de ${core.round3(ht * 1.19)} TTC, acompte ${pct} % — l'acompte fait ${acompteAttendu}, le solde ${soldeAttendu}`, () => {
      const q = devis(ht);
      const acompte = facture(q, core.depositLines(q, pct, société));
      const solde = facture(q, core.settlementLines(q, [acompte]), q.discountRate);
      // Calculé à la main : TTC du devis × pourcentage, plus le timbre ; le solde reprend le reste des
      // lignes TTC, plus SON timbre. L'écart de l'ancienne annonce valait exactement deux timbres.
      assert.strictEqual(core.computeTotals(acompte, société).netToPay, acompteAttendu);
      assert.strictEqual(core.computeTotals(solde, société).netToPay, soldeAttendu);
      assert.strictEqual(core.round3(core.computeTotals(q, société).totalTTC - core.computeTotals(acompte, société).totalTTC), core.round3(soldeAttendu - 2),
        'l\'ancienne annonce (total − acompte) se trompait de deux timbres exactement');
    });
  });

  // ------------------------------------------------------------------------------------ E-03
  // Un acompte en BROUILLON n'était vu nulle part : « Facturer ce devis » restait le bouton vert et
  // fabriquait une facture complète à côté de lui, sans une question — 150 % du devis.
  t('Rapport QA E-03 : un acompte en brouillon compte — la question le nomme, le bouton vert l\'ouvre, l\'émission prévient', () => {
    const ent = code('src', 'renderer', 'app.js');
    const pdd = ent.slice(ent.indexOf('function piecesDuDevis('), ent.indexOf('function piecesDuDevis(') + 900);
    assert.ok(/const brouillons = [\s\S]*?d\.status === 'brouillon'/.test(pdd) && /return \{ totales, acomptes, brouillons \}/.test(pdd),
      'les acomptes en brouillon ne sont comptés nulle part');
    const fd = ent.slice(ent.indexOf('async function facturerDevis(q) {'), ent.indexOf('async function facturerDevis(q) {') + 1600);
    assert.ok(/const deja = totales\.concat\(acomptes, brouillons\)/.test(fd) && /if \(deja\.length\)/.test(fd),
      '« Facturer ce devis » ne demande rien quand un acompte attend en brouillon');
    assert.ok(/const devisFacturable = [^;]*!brouillonsAcompte\.length/.test(ent), 'le bouton vert reste « Facturer ce devis » à côté d\'un acompte en brouillon');
    assert.ok(/id="voir-acompte">Ouvrir l'acompte en brouillon/.test(ent) && /\$\('#voir-acompte'\)\.onclick = \(\) => navigate\('#\/doc\/' \+ brouillonsAcompte\[0\]\.id\)/.test(ent),
      'le geste suivant (émettre l\'acompte) n\'est pas proposé');
    const iw = ent.slice(ent.indexOf('function issueWarnings()'), ent.indexOf('function issueWarnings()') + 4000);
    assert.ok(/doc\.fromQuoteId && !doc\.deposit && !doc\.settles/.test(iw) && /en reprend la TOTALITÉ/.test(iw),
      'l\'émission d\'une facture totale ne dit rien d\'un acompte déjà tiré du même devis');
  });

  // Trouvé en corrigeant E-02 : une facture tirée d'un devis ne reprenait pas l'exonération de timbre
  // du client (9.1.1) — elle ne se posait qu'en choisissant le client dans l'éditeur.
  t('Une facture tirée d\'un devis reprend l\'exonération de timbre du client', () => {
    const ent = code('src', 'renderer', 'app.js');
    const ifq = ent.slice(ent.indexOf('function invoiceFromQuote('), ent.indexOf('function invoiceFromQuote(') + 1400);
    assert.ok(/inv\.applyStamp = !cl\.stampExempt/.test(ifq), 'la facture tirée d\'un devis porte un timbre à un client exonéré');
  });
  // ------------------------------------------------------------------------------------ E-07
  // La colonne « N° » du fichier d'écritures du paquet sortait VIDE : l'écran numérotait par
  // `livreJournal`, le paquet écrivait par `journalEntries`. C'est la colonne qui regroupe les lignes
  // en pièces à l'import du comptable.
  t('Rapport QA E-07 : chaque ligne d\'écriture du paquet porte le numéro de sa pièce, le même qu\'à l\'écran', () => {
    const demo = require('../../src/renderer/demo.js');
    const d = core.migrateData(demo.buildDemoData(société, '2026-09-21'));
    const periode = core.packPeriod(2026, 8);
    const plan = core.packPlan(d, d.company, periode);
    const f = plan.entries.find(e => e.path === 'journaux/ecritures.csv');
    assert.ok(f, 'le paquet n\'a plus son fichier d\'écritures');
    const lignes = f.text.split(/\r?\n/).filter(Boolean);
    assert.ok(/^N°;/.test(lignes[0].replace(/^﻿/, '')), 'la première colonne n\'est plus « N° » : ' + lignes[0]);
    const nums = lignes.slice(1).map(l => l.split(';')[0]);
    assert.ok(nums.length > 10, 'le mois d\'exemple devrait porter des écritures');
    const vides = nums.filter(n => !/^\d+$/.test(n));
    assert.strictEqual(vides.length, 0, `${vides.length} ligne(s) sans numéro de pièce dans le fichier du comptable`);
    const ecran = core.livreJournal(d, d.company, { from: periode.from, to: periode.to }, {});
    assert.deepStrictEqual(nums.map(Number), ecran.map(e => e.numero), 'le fichier et l\'écran ne numérotent pas les mêmes pièces');
  });

  // ------------------------------------------------------------------------------------ E-06
  // « Aucune pièce datée pour l'instant » sur un dossier qui en portait cinq, toutes dans le mois en
  // cours. La vraie condition était « aucune pièce dans un mois TERMINÉ » : il manquait une branche,
  // exactement pour l'entreprise qui vient de commencer.
  t('Rapport QA E-06 : rien à clôturer se dit selon sa vraie raison, avec le jour où ça changera', () => {
    const AUJ = '2026-09-23';
    const d = vierge();
    assert.deepStrictEqual(core.rienACloturer(d, AUJ), { cas: 'aucune' });
    // Cinq pièces, toutes de septembre : c'est le cas du rapport.
    d.documents = ['02', '05', '09', '15', '20'].map((j, i) => ({ id: 'd' + i, type: 'devis', date: `2026-09-${j}`, lines: [] }));
    assert.deepStrictEqual(core.closableMonths(d, AUJ), [], 'septembre n\'est pas terminé : rien ne doit être clôturable');
    const r = core.rienACloturer(d, AUJ);
    assert.strictEqual(r.cas, 'pas-termine', 'cinq pièces datées ne font pas « aucune pièce » : ' + JSON.stringify(r));
    assert.strictEqual(r.n, 5);
    assert.strictEqual(r.enCours, true);
    assert.strictEqual(r.mois, 'septembre 2026');
    assert.strictEqual(r.des, '2026-10-01', 'septembre devient clôturable le 1er octobre');
    // La liste des dates est la MÊME que celle de `closableMonths` : une pièce d'août rend août
    // clôturable, et la raison n'a alors plus lieu d'être demandée.
    d.purchases = [{ id: 'p1', kind: 'depense', date: '2026-08-15', lines: [] }];
    assert.deepStrictEqual(core.closableMonths(d, AUJ).map(m => m.month), ['2026-08']);
    // Une pièce datée d'un mois FUTUR : c'est la fin de SON mois qui compte.
    const f = vierge();
    f.documents = [{ id: 'x', type: 'devis', date: '2026-11-04', lines: [] }];
    const rf = core.rienACloturer(f, AUJ);
    assert.strictEqual(rf.enCours, false);
    assert.strictEqual(rf.des, '2026-12-01');
    // Tout est clôturé jusqu'au mois dernier.
    const c = vierge();
    c.documents = [{ id: 'y', type: 'devis', date: '2026-08-10', lines: [] }];
    c.closedUntil = '2026-08-31';
    assert.deepStrictEqual(core.closableMonths(c, AUJ), []);
    assert.deepStrictEqual(core.rienACloturer(c, AUJ), { cas: 'a-jour', mois: 'septembre 2026', des: '2026-10-01' });
    // L'écran lit cette raison : « aucune pièce » n'y vient plus que du cas où il n'y en a aucune.
    const ent = code('src', 'renderer', 'app.js');
    const f0 = ent.indexOf('function phraseRienACloturer(');
    const phr = ent.slice(f0, ent.indexOf('\n    }\n', f0));
    assert.ok(phr.length > 200 && phr.length < 1600, 'tranche de phraseRienACloturer : ' + phr.length);
    assert.ok(/r\.cas === 'aucune'\) return 'Aucune pièce datée/.test(phr), '« Aucune pièce datée » doit être réservé au cas sans pièce');
    const dc = ent.slice(ent.indexOf('function drawClosures('), ent.indexOf('function drawClosures(') + 3000);
    assert.ok(/phraseRienACloturer\(C\.rienACloturer\(data, C\.today\(\)\)\)/.test(dc), 'le panneau Clôturer ne lit plus la raison');
    assert.ok(!/Aucune pièce datée/.test(dc), 'le panneau Clôturer écrit encore sa phrase à la main');
  });

  // ------------------------------------------------------------------------------------ E-14
  // « … glisse le PDF affiché dans le Finder » à un utilisateur Windows, trois fois — et la fenêtre
  // d'email promettait « Sur Mac, le message s'ouvre dans Mail avec le PDF joint » à qui n'a pas de
  // Mac. Le mécanisme existait dans l'AUTRE application (`EXPLORATEUR()` du Cabinet).
  t('Rapport QA E-14 : l\'application nomme l\'explorateur et les touches de l\'ordinateur où elle tourne', () => {
    const ent = code('src', 'renderer', 'app.js');
    // Le nom du gestionnaire de fichiers ne s'écrit qu'à un endroit : sa définition.
    const finder = ent.split('\n').filter(l => /Finder/.test(l));
    assert.deepStrictEqual(finder.map(l => l.trim()), ['const EXPLORATEUR = SUR_MAC ? \'le Finder\' : \'l\\\'Explorateur\';'],
      'le Finder est encore écrit en clair : ' + finder.join(' | '));
    assert.ok(!/Cmd\/Ctrl/.test(ent), 'une phrase demande encore à l\'utilisateur de choisir entre Cmd et Ctrl');
    // Chaque envoi respecte la messagerie choisie, et chaque envoi qui porte un FICHIER dit après
    // coup ce qui s'est passé par UNE fonction : où est le fichier quand la messagerie ne le joint pas.
    const envois = ent.split('bridge.composeMail(').slice(1).map(e => {
      let p = 1, i = 0;
      while (p && i < e.length) { if (e[i] === '(') p++; else if (e[i] === ')') p--; i++; }
      return { args: e.slice(0, i), suite: e.slice(i, i + 900) };
    });
    assert.ok(envois.length >= 10, 'les envois de l\'application (document, relevé, journaux, paquet, licence…) : ' + envois.length);
    envois.forEach(({ args }) => assert.ok(/\bmode: (modeEnvoi\(\)|'mailto')/.test(args),
      'un envoi ignore la messagerie choisie dans les Paramètres : ' + args.slice(0, 140)));
    const avecFichier = envois.filter(({ args }) => /\battachments?(?:\s*:\s*(?![\s]|null\b)|\s*[,}])/.test(args));
    assert.ok(avecFichier.length >= 7, 'les envois qui portent un fichier : ' + avecFichier.length);
    avecFichier.forEach(({ args, suite }) => assert.ok(/messageOuvert\(|emailComptablePret\([^)]*, r,/.test(suite),
      `un envoi avec fichier n'annonce pas où le trouver : ${args.slice(0, 100)} → ${suite.slice(0, 120)}`));
    const pret = ent.slice(ent.indexOf('async function emailComptablePret('), ent.indexOf('async function emailComptablePret(') + 700);
    assert.ok(/messageOuvert\(r, joint\)/.test(pret), 'l\'envoi au comptable ne dit plus où trouver le fichier');
    const dehors = ent.replace(/function messageOuvert\([\s\S]*?\n  \}/, '');
    assert.ok(!/'Message ouvert/.test(dehors), 'un envoi écrit encore son propre message après coup');
    // La fonction elle-même, jouée sur les deux plateformes.
    const src = ent.match(/function messageOuvert\([\s\S]*?\n  \}/)[0];
    const fabrique = explo => require('vm').runInNewContext(src + '\nmessageOuvert;', { EXPLORATEUR: explo });
    const win = fabrique('l\'Explorateur'), mac = fabrique('le Finder');
    assert.strictEqual(win({ state: 'mailto' }, 'le PDF'), 'Message ouvert dans ta messagerie — glisse le PDF affiché dans l\'Explorateur');
    assert.strictEqual(win({ state: 'mailto' }, 'la facture'), 'Message ouvert dans ta messagerie — glisse la facture affichée dans l\'Explorateur');
    assert.strictEqual(win({ state: 'mailto' }, null), 'Message ouvert dans ta messagerie');
    assert.strictEqual(mac({ state: 'mail' }, 'la facture'), 'Message ouvert dans Mail avec la facture jointe');
    assert.strictEqual(mac({ state: 'mail' }, 'le journal'), 'Message ouvert dans Mail avec le journal joint');
    // Avant l'envoi : Mail n'est promis que sur un Mac, et le réglage n'existe que là.
    assert.ok(/const envoiParMail = \(\) => SUR_MAC && /.test(ent), 'la promesse de Mail ne dépend plus de la plateforme');
    const fen = ent.slice(ent.indexOf('id="mf-envoi"'), ent.indexOf('id="mf-envoi"') + 400);
    assert.ok(/envoiParMail\(\) \?/.test(fen) && /\$\{EXPLORATEUR\}/.test(fen), 'la fenêtre d\'email ne dit pas ce qui se passera sur CET ordinateur');
    assert.ok(/\$\{SUR_MAC\s*\?\s*`<label class="field">\$\{lbl\('Envoi des emails'/.test(ent), 'le choix « Mail (Apple) » est proposé hors d\'un Mac');
    // Les touches de l'aide : ⌘ sur un Mac, Ctrl ailleurs — bulles et articles.
    const cl = ent.match(/const clavierLocal = [^\n]+/)[0];
    const loc = mac => require('vm').runInNewContext(cl + '\nclavierLocal;', { SUR_MAC: mac });
    assert.strictEqual(loc(false)('<kbd>⌘</kbd> <kbd>K</kbd>'), '<kbd>Ctrl</kbd> <kbd>K</kbd>');
    assert.strictEqual(loc(true)('<kbd>⌘</kbd> <kbd>K</kbd>'), '<kbd>⌘</kbd> <kbd>K</kbd>');
    assert.ok(/<div class="ip-body">\$\{clavierLocal\(x\.d\)\}/.test(ent), 'les bulles montrent encore ⌘ à un utilisateur Windows');
    assert.ok(/const corps = clavierLocal\(a\.body\)/.test(ent), 'les articles montrent encore ⌘ à un utilisateur Windows');
    // L'aide, qui est fixe, reste neutre : le Finder n'y vient qu'avec l'Explorateur.
    const guide = lireSource('src', 'renderer', 'guide.js');
    [...guide.matchAll(/Finder/g)].forEach(m => {
      const autour = guide.slice(Math.max(0, m.index - 300), m.index + 300);
      assert.ok(/Explorateur/.test(autour), 'l\'aide parle du Finder sans l\'Explorateur : ' + guide.slice(m.index - 80, m.index + 40));
    });
    assert.ok(!/\bton Mac\b|\bce Mac\b/.test(guide), 'l\'aide parle encore d\'un Mac à tout le monde');
    assert.ok(!/remplace <kbd>⌘<\/kbd> par/.test(guide), 'la note « remplace ⌘ par Ctrl » dirait « Ctrl par Ctrl » une fois les touches localisées');
    // L'aide écrit ⌘ et l'écran le traduit : une touche Ctrl écrite à la main ferait lire
    // « Ctrl K, ou Ctrl K sous Windows » à qui est sous Windows.
    assert.ok(!/<kbd>Ctrl<\/kbd>/.test(guide), 'l\'aide écrit encore Ctrl elle-même : sous Windows la touche serait nommée deux fois');
  });

  // ------------------------------------------------------------------------------------ E-09
  // « undefined–undefined sur undefined client après filtrage » et « Page undefined / undefined »
  // sur la page Marges : `paginate` rend `{ rows, pg }`, et la page passait l'EMBALLAGE à la barre.
  // Aucune console ne le montre, et la liste paraît juste — jusqu'à la vingt et unième ligne.
  t('Rapport QA E-09 : la barre de pagination reçoit la page, jamais ce que rend `paginate`', () => {
    const ent = code('src', 'renderer', 'app.js');
    const emballages = [...ent.matchAll(/const (\w+) = paginate\(/g)];
    assert.ok(emballages.length >= 8, 'les listes qui gardent l\'emballage de paginate : ' + emballages.length);
    emballages.forEach(m => {
      const suite = ent.slice(m.index, m.index + 4000);
      assert.ok(!new RegExp('pagerBar\\(' + m[1] + '\\s*[,)]').test(suite),
        `pagerBar reçoit « ${m[1]} » (ce que rend paginate) au lieu de « ${m[1]}.pg » : la barre écrirait undefined`);
    });
    // Et la barre elle-même, jouée : une vraie page ne rend jamais « undefined ».
    const src = ent.match(/function pagerBar\(pg, opts\) \{[\s\S]*?\n  \}/)[0];
    const bar = require('vm').runInNewContext(src + '\npagerBar;', { h: x => String(x), PAGE_SIZES: [[20, '20'], [50, '50']], info: () => '' });
    const pg = core.pageInfo(45, 2, 20);
    const html = bar(pg, { noun: 'client' });
    assert.ok(/21–40 sur 45 clients/.test(html) && !/undefined/.test(html), html.slice(0, 200));
  });

  // ------------------------------------------------------------------------------------ mineurs
  // E-05 « Établir les 1 bulletin manquant » : un article pluriel devant un compte qui peut valoir 1.
  t('Rapport QA E-05 : « les » ne précède un compte que dans la branche du pluriel', () => {
    const ent = code('src', 'renderer', 'app.js');
    const devant = [...ent.matchAll(/\bles \$\{(?:pl|C\.plFr)\(/gi)];
    assert.ok(devant.length >= 2, 'les tournures « les ${pl(…)} » de l\'écran : ' + devant.length);
    devant.forEach(m => assert.ok(/> 1 \?[^:]*$/.test(ent.slice(Math.max(0, m.index - 120), m.index)),
      '« les » devant un compte hors de la branche « > 1 » : ' + ent.slice(m.index - 80, m.index + 40)));
  });

  // E-11 « moins-value … le traitement fiscal de cette plus-value » : la fin était écrite en dur.
  t('Rapport QA E-11 : la phrase d\'une cession nomme la moins-value jusqu\'au bout', () => {
    const ent = code('src', 'renderer', 'app.js');
    const i = ent.indexOf('moins-value de ${C.money(-r.result, cur)}');
    const zone = ent.slice(i, i + 700);
    assert.ok(i > 0 && /cette \$\{r\.result >= 0 \? 'plus-value' : 'moins-value'\}/.test(zone),
      'la seconde moitié de la phrase ne suit plus le signe du résultat');
    assert.ok(!/traitement fiscal de cette plus-value/.test(ent), 'la plus-value est encore écrite en dur');
  });

  // E-13 « 5 prestation, 12 document, 2 bulletin de paie » : un compte de liste, accordé.
  t('Rapport QA E-13 : chaque liste a son pluriel écrit en entier, et les deux fenêtres l\'emploient', () => {
    assert.deepStrictEqual(Object.keys(core.LIST_PLURIELS).sort(), Object.keys(core.LIST_LABELS).sort(),
      'une liste sans pluriel écrit retomberait sur « 2 bulletin de paie »');
    assert.strictEqual(core.compteListe('payslips', 2), '2 bulletins de paie');
    assert.strictEqual(core.compteListe('payslips', 1), '1 bulletin de paie');
    assert.strictEqual(core.compteListe('catalog', 5), '5 prestations');
    assert.strictEqual(core.compteListe('packs', 2), '2 envois au cabinet');
    assert.strictEqual(core.compteListe('fiscalFilings', 3), '3 échéances fiscales déposées');
    const ent = code('src', 'renderer', 'app.js');
    assert.ok(!/\$\{data\[k\]\.length\} \$\{C\.LIST_LABELS\[k\]\}/.test(ent), 'un compte de liste est encore collé à son étiquette au singulier');
    assert.ok((ent.match(/C\.compteListe\(k, data\[k\]\.length\)/g) || []).length >= 2, 'le chargement de l\'exemple et « Tout effacer » comptent par compteListe');
    // Le même défaut, un filtre plus loin : « Facture d'achats », « Acompte versés ».
    core.PURCHASE_KINDS.forEach(([k, un, plusieurs]) => assert.ok(plusieurs && plusieurs !== un + 's' || k === 'depense',
      `« ${un} » n'a pas de pluriel écrit : ${plusieurs}`));
    assert.ok(/C\.PURCHASE_KINDS\.map\(\(\[v, , pluriel\]\)/.test(ent) && !/\$\{l\}s<\/option>/.test(ent), 'le filtre des achats ajoute encore un « s » au bout');
  });

  t('Rapport QA : aucun numéro de version interne dans un texte affiché', () => {
    const ent = code('src', 'renderer', 'app.js').replace(/<!--[\s\S]*?-->/g, '')
      .split('\n').map(l => l.replace(/\s\/\/ .*$/, '')).join('\n');
    const vus = [...ent.matchAll(/.{0,50}\(\d+\.\d+\.\d+[^)]*\)/g)].map(m => m[0].trim());
    assert.deepStrictEqual(vus, [], 'un numéro de version s\'affiche à l\'écran');
  });

  // Le RIB : dix chiffres traversaient l'assistant, les Paramètres et l'émission sans un mot.
  t('Rapport QA : un RIB se vérifie — 20 chiffres et leur clé, ou un IBAN — et on prévient sans bloquer', () => {
    assert.strictEqual(core.verifRib('07040005810111129653').ok, true, 'un RIB publié, valide');
    assert.strictEqual(core.verifRib('0704 0005 8101 1112 9653').ok, true, 'les espaces ne comptent pas');
    assert.strictEqual(core.verifRib('TN59 0704 0005 8101 1112 9653').ok, true, 'son IBAN tunisien');
    assert.strictEqual(core.verifRib('FR7630006000011234567890189').ok, true, 'un IBAN étranger valide');
    assert.deepStrictEqual([core.verifRib('0801234567').ok, core.verifRib('0801234567').court], [false, '10 chiffres sur 20']);
    assert.strictEqual(core.verifRib('07040005810111129654').court, 'clé incorrecte', 'une faute de frappe sur la clé');
    assert.strictEqual(core.verifRib('07040005810111139653').court, 'clé incorrecte', 'une faute de frappe dans le compte');
    assert.strictEqual(core.verifRib('TN58 0704 0005 8101 1112 9653').court, 'IBAN incorrect');
    assert.strictEqual(core.verifRib('').ok, true, 'un RIB vide n\'est pas un RIB faux : c\'est companyGaps qui le réclame');
    // Le jeu d'exemple ne montre pas un RIB faux : il afficherait un avertissement sur sa propre fiche.
    const demo = require('../../src/renderer/demo.js');
    const d = demo.buildDemoData({ ...core.DEFAULT_COMPANY }, '2026-09-21');
    assert.strictEqual(core.verifRib(d.company.rib).ok, true, 'le RIB de l\'exemple : ' + d.company.rib);
    (d.suppliers || []).filter(x => x.rib).forEach(x => assert.ok(core.verifRib(x.rib).ok, 'RIB de fournisseur de l\'exemple : ' + x.rib));
    (d.accounts || []).filter(x => x.rib).forEach(x => assert.ok(core.verifRib(x.rib).ok, 'RIB de compte de l\'exemple : ' + x.rib));
    // Les quatre champs RIB passent par le même composant, branché partout où un écran se dessine.
    const ent = code('src', 'renderer', 'app.js');
    assert.strictEqual((ent.match(/\$\{ribField\(/g) || []).length, 4, 'fiche société, assistant, fournisseur, compte bancaire');
    assert.ok(!/field\([^)]*'rib'/.test(ent), 'un champ RIB échappe encore à la vérification');
    assert.ok((ent.match(/bindRibFields\((layer|view|root)\)/g) || []).length >= 4, 'la vérification n\'est pas branchée sur les fenêtres, les pages et l\'assistant');
    assert.ok(/isInv && \(co\.rib \|\| ''\)\.trim\(\) && !C\.verifRib\(co\.rib\)\.ok/.test(ent), 'l\'émission ne prévient pas d\'un RIB faux');
    assert.ok(/\.rib-note \{/.test(lireSource('src', 'renderer', 'style.css')), 'la remarque du RIB n\'a pas de style');
  });

  t('Rapport QA : le capital nu s\'écrit comme les autres montants de la pièce', () => {
    assert.strictEqual(core.capitalAffiche('10000', 'DT', 'fr'), '10 000 DT');
    assert.strictEqual(core.capitalAffiche('1 000 DT', 'DT', 'fr'), '1 000 DT', 'ce que l\'utilisateur a écrit reste tel quel');
    assert.strictEqual(core.capitalAffiche('10.000', 'DT', 'fr'), '10.000', '« 10.000 » ne se devine pas');
    const doc = { id: 'x', type: 'devis', number: 'DEV-1', date: '2026-09-01', lines: [{ label: 'x', qty: 1, unitPrice: 10, vatRate: 19 }] };
    const html = core.documentHtml(doc, { name: 'C' }, { ...société, capital: '10000' }, {});
    assert.ok(/Capital 10 000 DT/.test(html), 'le pied de page écrit encore « Capital 10000 »');
  });

  t('Rapport QA : un mois sans salarié en poste ne dit pas « tous les bulletins sont établis »', () => {
    const ent = code('src', 'renderer', 'app.js');
    const i = ent.indexOf('Tous les bulletins du mois sont établis');
    assert.ok(/: month\.length \? '<span class="small ok-text">Tous les bulletins du mois sont établis/.test(ent.slice(i - 60, i + 60)),
      'la phrase rassurante s\'affiche aussi sur un mois vide');
    assert.ok(/Aucun salarié en poste en \$\{h\(MONTHS_LONG\[m - 1\]\)\}/.test(ent), 'le mois vide ne dit pas pourquoi il est vide');
  });

  t('Rapport QA : un délai constaté ne descend jamais sous zéro', () => {
    const d = vierge();
    d.clients = [{ id: 'c1', name: 'A' }];
    d.documents = [
      { id: 'q', type: 'devis', number: 'DEV-1', status: 'accepté', clientId: 'c1', date: '2026-08-10', lines: [{ label: 'x', qty: 1, unitPrice: 100, vatRate: 19 }] },
      { id: 'f', type: 'facture', number: 'FAC-1', status: 'envoyée', clientId: 'c1', fromQuoteId: 'q', date: '2026-08-07', dueDate: '2026-09-07',
        lines: [{ label: 'x', qty: 1, unitPrice: 100, vatRate: 19 }], payments: [{ id: 'p', date: '2026-08-05', amount: 120 }] }
    ];
    const f = core.quoteFunnel(d, société, '2026-01-01', '2026-12-31', '2026-09-23');
    assert.strictEqual(f.replyDelay, 0, 'une facture datée avant son devis donnait « −3 jours »');
    assert.strictEqual(core.avgPaymentDelay(d, société, '2026-01-01', '2026-12-31'), 0, 'un règlement avant la date de facture');
    assert.strictEqual(core.payerRanking(d, société).tous[0].delay, 0);
  });

  t('Rapport QA : la fenêtre de partage nomme la clé de signature qui part avec le dossier', () => {
    const ent = code('src', 'renderer', 'app.js');
    const i = ent.indexOf('async function partagerDossier(');
    const zone = ent.slice(i, i + 3000);
    assert.ok(/la clé qui signe tes paquets pour le comptable/.test(zone), 'la clé de signature part sans être nommée');
    assert.ok(/pourrait signer en ton nom/.test(zone), 'la fenêtre ne dit pas pourquoi l\'emplacement compte');
  });

  // ------------------------------------------------------------------------------------ E-01
  // `npm run e2e:entreprise` passait ses 83 étapes puis ne rendait jamais la main : `app.close()`
  // attendait une réponse à un garde-fou de sortie que personne ne voyait. La règle « toute fermeture
  // passe sous Promise.race » (7.28.0) ne tenait que sur 11 parcours sur 49 : elle vit maintenant
  // dans le harnais, et aucun parcours ne ferme une application à la main.
  t('Rapport QA E-01 : aucun parcours ne ferme une application sans le garde-fou du harnais', () => {
    const fs = require('fs'), path = require('path');
    const dossier = path.join(__dirname, '..', 'e2e');
    const fichiers = fs.readdirSync(dossier).filter(f => f.endsWith('.js') && f !== 'harnais.js');
    const aLaMain = [];
    let branches = 0;
    fichiers.forEach(f => {
      const src = fs.readFileSync(path.join(dossier, f), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
      if (/electron\.launch\(/.test(src)) {
        const m = src.match(/\b(app\w*|ent|cab)\.close\(/g);
        if (m) aLaMain.push(`${f} : ${m.join(', ')}`);
        if (/\bfermer\((app\w*|ent|cab)\b/.test(src)) branches++;
      }
    });
    assert.deepStrictEqual(aLaMain, [], 'des parcours ferment encore une application sans garde-fou');
    assert.ok(branches >= 45, 'les parcours qui ferment par le harnais : ' + branches);
    // Le garde-fou lui-même : il ATTEND, puis il TUE et il DIT pourquoi — jamais un vert silencieux.
    const h = lireSource('test', 'e2e', 'harnais.js');
    const f0 = h.indexOf('async function fermer(');
    const corps = h.slice(f0, h.indexOf('\n}\n', f0));
    assert.ok(corps.length > 200 && corps.length < 1500, 'tranche de fermer : ' + corps.length);
    assert.ok(/Promise\.race\(/.test(corps) && /kill\('SIGKILL'\)/.test(corps) && /throw new Error\(/.test(corps),
      'fermer ne borne pas l\'attente, ne tue pas le processus ou avale le blocage');
    assert.ok(/module\.exports = \{\s*fermer,/.test(h), 'fermer n\'est pas exporté par le harnais');
  });
};
