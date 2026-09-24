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
    // La RÈGLE (le choix n'existe que sous SUR_MAC), pas la forme du champ — elle a changé en 10.12.0.
    assert.ok(/SUR_MAC\s*\?\s*`[^`]*name="mailClient"/.test(ent) && (ent.match(/name="mailClient"/g) || []).length === 1, 'le choix « Mail (Apple) » est proposé hors d\'un Mac');
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
    assert.strictEqual(core.capitalAffiche('10000', 'DT', 'fr'), '10\u00a0000\u00a0DT');
    assert.strictEqual(core.capitalAffiche('1 000 DT', 'DT', 'fr'), '1 000 DT', 'ce que l\'utilisateur a écrit reste tel quel');
    assert.strictEqual(core.capitalAffiche('10.000', 'DT', 'fr'), '10.000', '« 10.000 » ne se devine pas');
    const doc = { id: 'x', type: 'devis', number: 'DEV-1', date: '2026-09-01', lines: [{ label: 'x', qty: 1, unitPrice: 10, vatRate: 19 }] };
    const html = core.documentHtml(doc, { name: 'C' }, { ...société, capital: '10000' }, {});
    assert.ok(/Capital 10\u00a0000\u00a0DT/.test(html), 'le pied de page écrit encore « Capital 10000 »');
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

  // Trouvé en rejouant le premier écran d'une vraie entreprise (10.12.0) : « Tout reste sur cet
  // ordinateur : rien n'est envoyé sur Internet » — faux depuis la 8.4.0, où l'application annonce sa
  // licence (la clé, l'identifiant et le NOM de l'ordinateur, le système, la version), et depuis la
  // 6.7.0, où elle présente sa clé au relais de mise à jour. La 8.0.0 avait déjà corrigé « ta clé n'est
  // envoyée nulle part » dans un panneau ; la même phrase vivait encore dans une bulle, et l'Aide de la
  // lecture de photo se disait « la seule fonction qui envoie quelque chose ». Une promesse sur ce qui
  // part se vérifie contre le code, et la phrase dit ce qui part — jamais « rien ».
  t('Aucune phrase ne promet que rien ne part sur Internet : l\'accueil nomme les mises à jour et la licence', () => {
    const sansCommentaires = (...c) => lireSource(...c).replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const textes = ['app.js', 'guide.js', 'onboarding.js'].map(f => [f, sansCommentaires('src', 'renderer', f)]);
    const FAUX = [
      [/[Rr]ien n.{1,2}est envoyé sur [Ii]nternet/, '« rien n\'est envoyé sur Internet »'],
      [/n.{1,2}est envoyée nulle part/, '« elle n\'est envoyée nulle part »'],
      [/seule[^.<]{0,60}qui envoie quelque chose/, '« la seule fonction qui envoie quelque chose »'],
      [/Rien ne transite par Internet/, '« rien ne transite par Internet »'],
      [/présentée qu.{1,2}au service de mise à jour/, '« présentée qu\'au service de mise à jour »']
    ];
    const fautes = [];
    textes.forEach(([f, s]) => FAUX.forEach(([re, nom]) => { if (re.test(s)) fautes.push(`${f} : ${nom}`); }));
    assert.deepStrictEqual(fautes, [], 'une phrase promet que rien ne part, alors que la licence et les mises à jour se connectent');
    const accueil = textes.find(([f]) => f === 'onboarding.js')[1];
    const p = accueil.slice(accueil.indexOf('sur cet ordinateur</b>') - 200, accueil.indexOf('sur cet ordinateur</b>') + 400);
    assert.ok(/mises à jour/.test(p) && /licence/.test(p), 'l\'écran d\'accueil ne dit pas ce qui se connecte : ' + p.slice(0, 200));
  });
  // Trouvé en tenant une menuiserie de bout en bout (10.12.0), à la dernière étape de l'assistant :
  // « Choisir un dossier… » et « Terminer » en vert côte à côte — on cliquait « Terminer » en croyant
  // avoir fini l'étape qu'on venait de sauter (U-11) ; et « iCloud Drive » proposé à un utilisateur
  // Windows, la plateforme où SkanFact est distribué (le jumeau du « Finder », E-14).
  t('L\'étape « Protéger tes données » : un seul vert, et le dossier en ligne de l\'ordinateur', () => {
    const app = code('src', 'renderer', 'app.js');
    const pied = app.slice(app.indexOf('id="sf-skip"'), app.indexOf('id="sf-skip"') + 400);
    assert.ok(/class="btn \$\{s\.id === 'sauvegarde' \? '' : 'btn-primary'\}" id="sf-next"/.test(pied),
      '« Continuer / Terminer » est vert à l\'étape de la sauvegarde, à côté de « Choisir un dossier… » : ' + pied.slice(0, 200));
    const f0 = app.indexOf('const direExt = x =>');
    const direExt = app.slice(f0, app.indexOf('\n        };', f0));
    assert.ok(direExt.length > 200 && direExt.length < 2500, 'tranche de direExt : ' + direExt.length);
    assert.ok(/classList\.toggle\('btn-primary', !faite\)/.test(direExt) && /classList\.toggle\('btn-primary', faite\)/.test(direExt),
      'le vert ne passe pas de « Choisir un dossier… » à « Terminer » une fois la copie en place');
    const nus = ['app.js', 'guide.js', 'onboarding.js', 'core.js'].map(f => [f, code('src', 'renderer', f)])
      .filter(([f, c]) => (f === 'app.js' ? c.replace(/const NUAGE = [^\n]+/, '') : c).split(/iCloud(?: Drive)?/).slice(1)
        .some(apres => !/^\s*(\(Mac\)|, OneDrive|,? ?(ou|et) OneDrive)/.test(apres)))
      .map(([f]) => f);
    assert.deepStrictEqual(nus, [], '« iCloud Drive » proposé sans OneDrive : un utilisateur Windows n\'en a pas');
    assert.ok(!/Si le Mac meurt/.test(app), 'une phrase suppose encore que l\'ordinateur est un Mac');
  });
  // Même famille, sur l'accueil d'une entreprise neuve : « + Nouvelle facture » en vert dans
  // l'en-tête, « + Créer un client » en vert dans « Tes premiers pas » — la seconde est l'étape
  // suivante, la première impossible sans client (U-11).
  t('L\'accueil n\'a qu\'un vert : celui des premiers pas tant qu\'ils proposent l\'étape suivante', () => {
    const app = code('src', 'renderer', 'app.js');
    const e0 = app.indexOf('<div class="page-head"><h1>Accueil</h1>');
    const entete = app.slice(e0, e0 + 400);
    assert.ok(e0 > 0, 'en-tête de l\'accueil introuvable');
    assert.ok(/id="new-facture"/.test(entete) && !/class="btn btn-primary" id="new-facture"/.test(entete),
      '« + Nouvelle facture » est vert quoi qu\'il arrive : ' + entete.slice(0, 300));
    const avant = app.slice(e0 - 500, e0);
    assert.ok(/const pasEnCours = \/btn-primary\/\.test\(pas\)/.test(avant), 'le vert de l\'en-tête ne lit pas celui des premiers pas');
    // Et le panneau « Et maintenant » ne redit pas une autre suite tant que les premiers pas parlent.
    const m0 = app.indexOf('<h2>Et maintenant</h2>');
    assert.ok(m0 > 0 && /\|\| pas \? '' : `\s*$/.test(app.slice(m0 - 120, m0).split('\n').slice(-2)[0]),
      '« Et maintenant » s\'affiche sous les premiers pas, avec un second vert : ' + app.slice(m0 - 120, m0));
  });
  // Le Catalogue était la seule liste dont la ligne ne s'ouvrait pas au clic : « Tes premiers pas »
  // disait « Ouvre-en une, mets ton prix », et le clic ne faisait rien (10.12.0, parcours d'une
  // menuiserie). Chaque liste construite par `drawList` porte son geste d'ouverture, et le branche.
  t('Chaque ligne du Catalogue (prestations, modèles, textes) s\'ouvre au clic', () => {
    const app = code('src', 'renderer', 'app.js');
    const appels = app.split('drawList(\'#').slice(1).map(x => x.slice(0, x.indexOf('\n    });')));
    assert.strictEqual(appels.length, 3, 'appels à drawList : ' + appels.length);
    appels.forEach(a => assert.ok(/\bouvrir: \([a-z], redraw\) => \w+Form\(/.test(a),
      'une liste du Catalogue ne s\'ouvre pas au clic : ' + a.slice(0, 60)));
    const d0 = app.indexOf('const drawList = (');
    const corps = app.slice(d0, app.indexOf('return redraw;', d0));
    assert.ok(/data-ouvrir=/.test(corps) && /tr\[data-ouvrir\]/.test(corps) && /opts\.ouvrir\(r, redraw\)/.test(corps),
      'drawList ne rend pas la ligne cliquable, ou ne branche pas le clic');
  });
  // « Ex : Audit de sécurité du réseau » dans l'Objet du devis d'une menuiserie : un exemple écrit
  // pour le métier de l'auteur, resté dans l'éditeur et dans deux bulles (10.12.0).
  t('L\'invite de l\'Objet d\'un devis ne suppose aucun métier — surtout pas celui de l\'auteur', () => {
    const app = code('src', 'renderer', 'app.js'), guide = code('src', 'renderer', 'guide.js');
    assert.ok(!/Audit de sécurité/.test(app) && !/Audit de sécurité/.test(guide), 'un exemple de cybersécurité est proposé à tous les métiers');
    assert.ok(/name="subject"[^>]*placeholder="\$\{h\(exempleObjet\(\)\)\}"/.test(app), 'l\'Objet ne passe pas par son invite neutre');
    const f0 = app.indexOf('const exempleObjet = () =>');
    assert.ok(f0 > 0 && !/Ex :/.test(app.slice(f0, f0 + 120)), 'l\'invite de l\'Objet propose encore un exemple de métier');
    // Et TOUS les champs Objet : l'achat proposait « Ex : disques durs pour la Clinique », le contrat
    // récurrent « Maintenance et supervision » — le métier de l'auteur, à une menuiserie (10.12.0).
    const invites = app.match(/name="subject"[^>]*placeholder="[^"]*"/g) || [];
    assert.ok(invites.length >= 4, 'champs Objet trouvés : ' + invites.length);
    for (const i of invites) assert.ok(!/placeholder="Ex/.test(i) && !/Clinique|supervision|disques/i.test(i), 'une invite d\'Objet suppose un métier : ' + i);
    assert.ok(!/Clinique|Disques durs/.test(guide), 'la bulle de l\'Objet d\'un achat suppose encore un métier');
  });
  // La « Marge estimée » apparaît au premier coût connu : posée à CÔTÉ de la carte des totaux, elle
  // la faisait sauter de 250 px vers la gauche pendant la frappe (10.12.0, parcours d'une menuiserie).
  t('La marge estimée se pose SOUS les totaux : la carte ne quitte pas la colonne des montants', () => {
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const r = (css.match(/^\.totals-box \{[^}]*\}/m) || [''])[0];
    assert.ok(/flex-direction:\s*column/.test(r) && /align-items:\s*flex-end/.test(r), '.totals-box range la marge à côté de la carte : ' + r);
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/\$\('#totals'\)\.appendChild\(el\)/.test(app), 'la marge ne vit plus dans #totals : le test ne vise plus le bon endroit');
  });
  // « 4 530,188 DT » coupé en fin de ligne dans la fenêtre d'acompte — « 4 » d'un côté, « 530,188 DT »
  // de l'autre (10.12.0, parcours d'une menuiserie). Un montant se lit d'un bloc : ses espaces sont
  // insécables — entre les milliers, avant la devise, après le signe. Les CSV gardent leur format.
  t('Un montant ne se coupe jamais à la ligne : ses espaces sont insécables', () => {
    for (const m of [core.money(4530.188, 'DT'), core.money(-1234567.5, 'DT'), core.money(1234.5, 'EUR')]) {
      assert.ok(!/ /.test(m), `« ${m} » contient une espace ordinaire : le navigateur peut le couper`);
      assert.ok(/ /.test(m), `« ${m} » n'a plus d'espace insécable`);
    }
    // L'export pour le comptable n'est pas touché : un tableur relit « 4530,188 », pas une chaîne.
    const csv = core.toCsv([{ m: 4530.188 }], [{ key: 'm', label: 'Montant', type: 'money' }]);
    assert.ok(/4530,188/.test(csv) && !/ /.test(csv), 'le CSV a changé de format : ' + csv);
  });
  // Un paiement sans compte de trésorerie n'offrait qu'un lien vers la Trésorerie, qui QUITTAIT la
  // fenêtre et jetait la saisie — alors que l'assistant avait demandé la banque et le RIB (10.12.0).
  t('Un paiement sans compte propose de le créer par-dessus, avec la banque et le RIB déjà donnés', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('function paymentForm(');
    const f = app.slice(i, app.indexOf('\n  function ', i + 10));
    assert.ok(f.length > 500, 'tranche de paymentForm : ' + f.length);
    assert.ok(!/href="#\/tresorerie"/.test(f), 'le paiement renvoie encore vers la Trésorerie, hors de la fenêtre');
    assert.ok(/id="pf-compte"/.test(f) && /accountForm\(null,[\s\S]{0,300}bank: company\(\)\.bank[\s\S]{0,80}rib: company\(\)\.rib/.test(f),
      'le paiement ne propose pas de créer le compte prérempli avec la banque et le RIB de la société');
    const a0 = app.indexOf('function accountForm(');
    assert.ok(/\.\.\.\(modele \|\| \{\}\)/.test(app.slice(a0, a0 + 400)), 'accountForm ne reprend pas le modèle qu\'on lui passe');
  });
  // « Timbre fiscal par facture : 1 » — un dinar, un millime ? La règle 9.4.8 veut l'unité à côté du
  // champ ; dans l'assistant elle suit la devise choisie juste au-dessus (10.12.0).
  t('Le timbre fiscal dit son unité, dans les Paramètres et dans l\'assistant', () => {
    const app = code('src', 'renderer', 'app.js');
    const champs = app.match(/lbl\(`Timbre fiscal par facture[^`]*`/g) || [];
    assert.strictEqual(champs.length, 2, 'deux champs du timbre attendus, trouvé : ' + champs.length);
    for (const c of champs) assert.ok(/normCurrency\(/.test(c), 'le champ du timbre ne dit pas sa devise : ' + c);
    assert.ok(!/lbl\('Timbre fiscal par facture'/.test(app), 'un champ du timbre reste sans unité');
    assert.ok(/unite\.textContent = C\.normCurrency\(devise\.value\)/.test(app), 'l\'unité du timbre ne suit pas la devise choisie dans l\'assistant');
  });
  // Une menuiserie facture l'acompte de 30 % d'un devis accepté : le devis quittait « À faire », parce
  // que l'acompte porte `fromQuoteId` comme une facture totale — les 70 % restants n'étaient réclamés
  // nulle part (10.12.0). Seule une facture totale ou de solde ferme la ligne.
  t('Un devis dont seul l\'acompte est facturé reste « à facturer », pour son solde', () => {
    const d = vierge();
    d.clients = [{ id: 'c1', name: 'Hôtel Dar El Marsa' }];
    const q = { id: 'q1', type: 'devis', status: 'accepté', number: 'DEV-2026-001', date: '2026-09-01', clientId: 'c1',
      lines: [{ label: 'Portes', qty: 1, unitPrice: 10000, vatRate: 19 }] };
    const acompte = { id: 'f1', type: 'facture', status: 'envoyée', number: 'FAC-2026-001', date: '2026-09-02', clientId: 'c1',
      fromQuoteId: 'q1', deposit: { percent: 30, quoteId: 'q1', quoteNumber: 'DEV-2026-001' },
      lines: [{ label: 'Acompte 30 %', qty: 1, unitPrice: 3000, vatRate: 19 }] };
    d.documents = [q, acompte];
    const l = core.todoList(d, d.company, '2026-09-10').find(x => x.id === 'devis-acceptes');
    assert.ok(l, 'le devis dont seul l\'acompte est facturé a disparu de « À faire »');
    // 10 000 HT + 19 % = 11 900 TTC ; l'acompte 3 000 + 19 % = 3 570 (son timbre n'était pas au devis).
    assert.strictEqual(l.amount, 8330, 'le reste à facturer ne déduit pas l\'acompte : ' + l.amount);
    assert.ok(/Facturer le solde/.test(l.detail), 'la ligne ne dit pas le geste qui facture le solde : ' + l.detail);
    // La facture de solde, même en brouillon, ferme la ligne.
    d.documents.push({ id: 'f2', type: 'facture', status: 'brouillon', date: '2026-09-10', clientId: 'c1', fromQuoteId: 'q1',
      settles: { quoteId: 'q1', depositIds: ['f1'] }, lines: [] });
    assert.ok(!core.todoList(d, d.company, '2026-09-10').some(x => x.id === 'devis-acceptes'), 'la facture de solde ne ferme pas la ligne');
  });
  // Le menu d'un devis dont l'acompte est facturé ne proposait que « Refacturer la totalité »
  // (facturer une seconde fois l'acompte), et l'éditeur gardait « Facture de solde » en VERT sur un
  // devis déjà soldé — un clic, une seconde facture de solde (10.12.0).
  t('Le solde d\'un devis se facture depuis sa ligne, et jamais deux fois', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('async function facturerSolde(');
    assert.ok(i > 0, 'facturerSolde n\'existe plus');
    const f = app.slice(i, app.indexOf('\n  function ', i));
    assert.ok(/if \(totales\.length && !await confirmDialog\(/.test(f), 'facturerSolde crée un second solde sans rien demander');
    assert.ok(/\$\('#settle'\)\.onclick = \(\) => facturerSolde\(doc\)/.test(app), 'le bouton de l\'éditeur ne passe pas par facturerSolde');
    assert.ok(/if \(acomptes\.length && !totales\.length\)\s*a\.push\(\{ icon: 'facture', label: 'Facturer le solde'[\s\S]{0,160}run: \(\) => facturerSolde\(d\)/.test(app),
      'le menu de la ligne ne propose pas « Facturer le solde » quand l\'acompte seul est facturé');
    assert.ok(/const soldable = issuedDeposits\.length > 0 && !dejaFacture\.length;/.test(app), 'le solde reste proposé sur un devis déjà soldé');
    assert.ok(/: soldable\s*\?\s*`<button class="btn btn-primary" id="settle2">/.test(app), 'le vert « Facture de solde » ne dépend pas de soldable');
    assert.ok(/\$\{soldable \? ligneMenu\(`<button id="settle">/.test(app), 'l\'entrée « Facture de solde » du menu ne dépend pas de soldable');
  });
  // Le récapitulatif d'émission d'une facture de solde ne disait ni le devis ni l'acompte déduit —
  // ce qu'un gérant vérifie avant d'envoyer (10.12.0).
  t('Le récapitulatif d\'émission nomme le devis d\'un solde et l\'acompte qu\'il déduit', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('function confirmerEmission(');
    const f = app.slice(i, app.indexOf('\n  function ', i + 10));
    assert.ok(f.length > 800, 'tranche de confirmerEmission : ' + f.length);
    assert.ok(/doc\.settles\s*\?\s*ligne\('Solde du devis'/.test(f), 'le solde ne nomme pas son devis');
    assert.ok(/depositIds[\s\S]{0,120}map\(docById\)/.test(f), 'le solde ne nomme pas les acomptes déduits');
    assert.ok(/doc\.deposit \? ligne\('Acompte du devis'/.test(f), 'l\'acompte ne nomme pas son devis');
    assert.ok(/\$\{origine\}/.test(f), 'la ligne d\'origine n\'est pas posée dans le récapitulatif');
  });
  // Taper « Bois du Sahel » dans la recherche d'un fournisseur, ne rien trouver, cliquer « + Nouveau
  // fournisseur » : la fiche s'ouvrait vide, et la frappe avait déjà marqué la pièce « modifiée »
  // (10.12.0, une menuiserie).
  t('« + Nouveau… » d\'une liste reprend ce qu\'on a tapé, et chercher ne modifie pas la pièce', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/add\.onclick = \(\) => \{ const saisi = \(q && q\.value \|\| ''\)\.trim\(\); close\(\); if \(o\.onAdd\) o\.onAdd\(saisi\); \}/.test(app),
      'le combo ne passe pas la recherche à onAdd');
    assert.ok(!/onAdd: \(\) =>/.test(app), 'un « + Nouveau… » jette encore ce qu\'on a tapé');
    // Chaque appel, jusqu'au suivant (ou 700 caractères) : la recherche doit y servir, pas seulement y entrer.
    const debuts = [...app.matchAll(/onAdd: saisi => /g)].map(m => m.index);
    const appels = debuts.map((d, i) => app.slice(d, Math.min(debuts[i + 1] || Infinity, d + 700)));
    assert.ok(appels.length >= 9, 'appels onAdd trouvés : ' + appels.length);
    for (const a of appels) assert.ok((a.match(/saisi/g) || []).length >= 2, 'un « + Nouveau… » reçoit la recherche sans s\'en servir : ' + a.slice(0, 120));
    assert.ok(/function clientForm\(client, done, preset\)/.test(app), 'la fiche client ne sait pas recevoir un nom proposé');
    assert.ok(/for \(const ev of \['input', 'change'\]\) q\.addEventListener\(ev, e => e\.stopPropagation\(\)\)/.test(app),
      'la frappe dans la recherche d\'une liste remonte encore au formulaire');
  });
  // Une menuiserie achète des planches qu'elle n'a pas encore au catalogue : l'avertissement disait
  // « Choisir l'article… », et la liste ouverte n'offrait que « + Créer … » sous un trait qui séparait
  // du vide (10.12.0).
  t('Une ligne de stock sans article propose de le CRÉER quand il n\'y a rien à choisir', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/data-orph="\$\{i\}">\$\{propositionsCatalogue\(data\.catalog, l\.label \|\| '', true, true\)\.shown\.length \? 'Choisir l\\'article…' : 'Créer l\\'article…'\}/.test(app),
      'le bouton de la ligne orpheline ne dépend pas de ce que la liste montrera');
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(/\.sugg-add:first-child \{ border-top: 0;/.test(css), 'la création seule dans la liste garde un trait au-dessus du vide');
  });
  // L'article créé depuis un achat arrive avec son coût et sans prix : la fiche criait « Marge :
  // − 38,500 DT, soit 0 % — tu vends à perte » en orange sur une planche qu'on ne revend pas (10.12.0).
  t('Un prix de vente à 0 est un prix pas encore fixé, pas une vente à perte', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf("const el = $('#marge-hint', root);");
    const f = app.slice(i, i + 1200);
    const avant = f.indexOf('if (!pv)'), perte = f.indexOf('tu vends à perte');
    assert.ok(avant > 0 && perte > avant, 'la marge d\'un article sans prix de vente se calcule encore — et crie « à perte »');
    assert.ok(/if \(!pv\) \{ el\.innerHTML = '<span class="small muted">/.test(f), 'l\'absence de prix se dit en couleur d\'alerte');
  });
  // « Prix de vente du stock : 0,000 DT — ce qu'il rapporterait vendu » sur 1 540 DT de planches :
  // un article sans prix n'a pas de prix, il ne vaut pas zéro (10.12.0, une menuiserie).
  t('Le stock sans prix de vente dit « — », jamais « 0 rapporterait vendu »', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(!/r\.qty\) \* r\.unitPrice, 0\)\), cur\)\}<\/div><div class="sub">ce qu'il rapporterait vendu/.test(app), 'la carte additionne encore des prix absents comme des zéros');
    assert.ok(/const prices = t\.rows\.filter\(r => Number\(r\.unitPrice\) > 0\)/.test(app), 'la carte ne distingue pas les articles sans prix');
    assert.ok(/prices\.length \? C\.money\(total, cur\) : '—'/.test(app), 'sans aucun prix, la carte affiche un montant');
    assert.ok(/Number\(r\.unitPrice\) > 0 \? C\.money\(r\.unitPrice, cur\) : '<span class="muted" title="Pas de prix de vente fixé">—<\/span>'/.test(app), 'la colonne montre 0,000 pour un prix absent');
  });
  // Une menuiserie achète 40 planches à 38,5 DT, en utilise 10 sur un chantier, en casse 2, en revend 4,
  // en reprend 1 sur avoir et en retrouve 1 à l'inventaire. Jusqu'en 10.12.0, seules les 4 vendues
  // entraient dans la charge : 154 DT — le bois du chantier et la casse disparaissaient du résultat.
  t('Toute sortie de stock est une charge — la matière d\'un chantier et la casse aussi, un retour la rend', () => {
    const d = vierge();
    d.catalog = [{ id: 'pl', label: 'Planche chêne massif 27 mm', unit: 'u', unitPrice: 60, unitCost: 38.5, vatRate: 19, tracked: true }];
    d.suppliers = [{ id: 's1', name: 'Bois du Sahel' }];
    d.clients = [{ id: 'c1', name: 'Hôtel Dar El Marsa' }];
    d.purchases = [{ id: 'a1', kind: 'facture', supplierId: 's1', number: 'BS-1', date: '2026-09-01', currency: 'DT',
      lines: [{ label: 'Planche chêne massif 27 mm', itemId: 'pl', qty: 40, unitPrice: 38.5, vatRate: 19, destination: 'stock', deductible: true }], payments: [], fees: 0 }];
    d.documents = [
      { id: 'f1', type: 'facture', status: 'envoyée', number: 'FAC-2026-001', date: '2026-09-10', clientId: 'c1',
        lines: [{ label: 'Planche chêne massif 27 mm', itemId: 'pl', qty: 4, unitPrice: 60, vatRate: 19 }], payments: [] },
      { id: 'v1', type: 'avoir', status: 'émis', number: 'AVO-2026-001', date: '2026-09-12', clientId: 'c1', creditOf: 'f1',
        lines: [{ label: 'Planche chêne massif 27 mm', itemId: 'pl', qty: 1, unitPrice: 60, vatRate: 19 }] }];
    d.stockAdjustments = [
      { id: 'm1', date: '2026-09-05', itemId: 'pl', qty: -10, unitCost: '', source: 'consommation', note: 'Chantier Dar El Marsa' },
      { id: 'm2', date: '2026-09-06', itemId: 'pl', qty: -2, unitCost: '', source: 'casse', note: '' },
      { id: 'm3', date: '2026-09-30', itemId: 'pl', qty: 1, unitCost: '', source: 'inventaire', note: '' }];
    const periode = { from: '2026-09-01', to: '2026-09-30' };
    // Calculé à la main : (4 vendues − 1 reprise + 10 utilisées + 2 cassées − 1 retrouvée) × 38,5 = 14 × 38,5.
    assert.strictEqual(core.costOfGoodsSold(d, periode), 539);
    assert.strictEqual(core.simpleResult(d, d.company, periode).cogs, 539);
    // Le stock et la charge se tiennent : 40 achetées, 26 restent, 14 sont passées en charge.
    assert.strictEqual(core.stockOf(d, 'pl').qty, 26);
    assert.ok(core.MOVE_SOURCES.some(([k]) => k === 'consommation'), 'la nature « chantier ou fabrication » n\'existe pas');
  });
  // Le menuisier note les 10 planches posées sur un chantier : il tape « 10 ». Jusqu'en 10.12.0 la
  // quantité se tapait signée, et ce « 10 » faisait GAGNER dix planches au stock, valorisées, sans un
  // mot — la fenêtre annonçait « Après ce mouvement : 50 . ». Une casse ou de la matière utilisée ne
  // peut que sortir : on saisit la quantité sortie, et c'est `qteMouvement` qui la signe.
  t('Une casse ou de la matière utilisée se tape en quantité SORTIE : « 10 » retire dix planches', () => {
    assert.strictEqual(core.qteMouvement('consommation', '10'), -10);
    assert.strictEqual(core.qteMouvement('casse', 2), -2);
    assert.strictEqual(core.qteMouvement('casse', -2), -2, 'un signe tapé par habitude ne doit pas faire RENTRER la casse');
    // L'inventaire et l'ajustement vont dans les deux sens : le signe reste celui qu'on tape.
    assert.strictEqual(core.qteMouvement('inventaire', 1), 1);
    assert.strictEqual(core.qteMouvement('ajustement', -3), -3);
    assert.strictEqual(core.qteMouvement('casse', ''), 0);
    // La fenêtre enregistre la quantité SIGNÉE, jamais le nombre tapé, et le libellé suit la nature.
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('function adjustForm(');
    const zone = app.slice(i, app.indexOf('\n  routes.stock = ', i));
    assert.ok(zone.length > 1500 && zone.length < 9000, 'tranche adjustForm introuvable (' + zone.length + ')');
    assert.ok(/stockAdjustments\.push\(\{[^}]*qty: qte\b/.test(zone), 'le mouvement enregistre le nombre tapé au lieu de la quantité signée');
    assert.ok(/const qte = C\.qteMouvement\(v\.source, v\.qty\)/.test(zone), 'l\'enregistrement ne passe pas par qteMouvement');
    assert.ok(/C\.qteMouvement\(v\.source, v\.qty\)[\s\S]*Sortent/.test(zone.slice(zone.indexOf('const hint'))), 'l\'annonce ne calcule pas le stock obtenu par la même fonction');
    assert.ok(/'Quantité sortie'/.test(zone), 'le libellé ne dit pas qu\'on tape la quantité qui sort');
    // L'annonce se récrit à chaque chiffre : sa hauteur est réservée, sinon la fenêtre se recentre
    // et « Enregistrer » bouge sous le curseur ; et une nature se lit entière dans sa demi-colonne.
    assert.ok(/id="adj-hint"/.test(zone) && /class="[^"]*annonce-stable[^"]*" id="adj-hint"/.test(zone), 'l\'annonce du mouvement n\'a pas de hauteur réservée');
    assert.ok(/\.annonce-stable \{[^}]*min-height/.test(lireSource('src', 'renderer', 'style.css')), '.annonce-stable ne réserve aucune hauteur');
    const saisies = core.MOVE_SOURCES.filter(([k]) => ['casse', 'consommation', 'inventaire', 'ajustement'].includes(k));
    assert.ok(saisies.every(([, l]) => l.length <= 24), 'une nature de mouvement est coupée dans sa liste : ' + saisies.map(([, l]) => l).join(' / '));
    // « 50 . » : une unité vide ne laisse pas d'espace avant le point.
    assert.ok(!/\$\{pct\([^)]*\)\} \$\{h\(s\.unit\)\}/.test(zone), 'une unité vide laisse une espace avant le point');
  });
  t('refus() accepte un champ comme un sélecteur : un champ dans SA fenêtre se désigne par lui-même', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('function refus(');
    const corps = app.slice(i, i + 400);
    assert.ok(/typeof selecteur === 'string' \? \$\(selecteur\) : selecteur/.test(corps), 'refus() passe un élément à querySelector, qui lève');
  });
  // La palette engendre ses onglets depuis les tableaux qui les dessinent (7.30.0). Neuf entrées
  // écrites à la main les doublaient (« Bulletins de paie » sous « Paie → Bulletins »), passaient par
  // `navigate()` — inertes depuis la page visée (7.15.0) — et « Seuil de rentabilité » ouvrait
  // l'onglet Affaires. Une entrée à la main ne pose plus d'onglet : elle nomme une PAGE ou un GESTE.
  t('La palette ne double aucun onglet par une entrée écrite à la main', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('const actions = [');
    const bloc = app.slice(i, app.indexOf('.concat(ongletsDePalette()', i));
    assert.ok(bloc.length > 2000 && bloc.length < 12000, 'liste des actions de la palette introuvable (' + bloc.length + ')');
    const poses = bloc.match(/\w+(?:State\.tab|Tab)\s*=\s*'[^']+'/g) || [];
    assert.deepStrictEqual(poses, [], 'une entrée de palette écrite à la main pose un onglet : ' + poses.join(', '));
    // Et ce que ces entrées faisaient trouver reste trouvable : leurs mots vivent sur l'onglet.
    const alias = app.slice(app.indexOf('const ALIAS'), app.indexOf('function closePalette'));
    [['Paie → Bulletins', 'bulletins de paie'], ['Paie → Registre', 'registre du personnel'], ['Paie → Déclarations', 'déclaration cnss'],
      ['Immobilisations → À immobiliser', 'lignes à immobiliser']].forEach(([cle, mots]) => {
      const m = alias.match(new RegExp("'" + cle + "': '([^']*)'"));
      assert.ok(m && m[1].includes(mots), `« ${mots} » ne mène plus à « ${cle} »`);
    });
  });
  // Une annonce qui se récrit pendant la frappe (le net d'un brut, le plan d'un bien, le stock obtenu)
  // passait d'une ligne à deux : la fenêtre se recentrait et « Enregistrer » bougeait sous le curseur.
  // Toute annonce vivante d'une fenêtre réserve sa hauteur — pas seulement celle qu'on a vue bouger.
  t('Chaque annonce vivante d\'une fenêtre réserve sa hauteur : rien ne bouge pendant la frappe', () => {
    const app = code('src', 'renderer', 'app.js');
    const annonces = app.match(/<div [^>]*id="[a-z]+-hint"[^>]*>/g) || [];
    assert.ok(annonces.length >= 8, 'annonces introuvables (' + annonces.length + ')');
    const nues = annonces.filter(a => !/annonce-stable/.test(a) && !/\bhidden\b/.test(a));
    assert.deepStrictEqual(nues, [], 'une annonce de fenêtre ne réserve pas sa hauteur');
    // Le contrat se lit entier dans sa demi-colonne : le sigle, la définition en infobulle.
    assert.ok(/C\.CONTRACT_TYPES\.map\(\(\[v, l\]\) => `<option[^`]*\$\{h\(l\.split\(' —'\)\[0\]\)\}/.test(app), 'le contrat affiche sa définition entière et se coupe (« CDI — contrat à durée indéterm »)');
  });
  // Une menuiserie embauche son premier ouvrier le 24 septembre et ouvre la Paie : l'onglet Bulletins
  // s'ouvrait sur AOÛT, « aucun salarié en poste », et rien ne menait à septembre.
  t('La Paie s\'ouvre sur le mois où il y a un bulletin à établir, et un mois vide y mène', () => {
    const jour = '2026-09-24';
    const d = vierge();
    d.employees = [{ id: 'e1', name: 'Hichem Trabelsi', grossSalary: 1200, hireDate: '2026-09-24' }];
    assert.deepStrictEqual(core.moisDePaie(d, jour), { year: 2026, month: 9 }, 'un salarié embauché ce mois-ci : la Paie doit s\'ouvrir sur ce mois');
    // Un salarié déjà là en août sans bulletin : c'est août qu'il faut établir d'abord.
    d.employees[0].hireDate = '2026-01-05';
    assert.deepStrictEqual(core.moisDePaie(d, jour), { year: 2026, month: 8 });
    // Août établi, septembre à faire : septembre.
    d.payslips = [{ id: 'p8', employeeId: 'e1', year: 2026, month: 8, computed: { net: 900, gross: 1200 } }];
    assert.deepStrictEqual(core.moisDePaie(d, jour), { year: 2026, month: 9 });
    // Personne : le mois précédent, comme avant.
    assert.deepStrictEqual(core.moisDePaie(vierge(), jour), { year: 2026, month: 8 });
    // Janvier : le mois précédent est décembre de l'année d'avant.
    assert.deepStrictEqual(core.moisDePaie(vierge(), '2027-01-10'), { year: 2026, month: 12 });
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('routes.paie = ');
    const zone = app.slice(i, i + 6000);
    assert.ok(/if \(!s\.moisTouche\) \{ const mp = C\.moisDePaie\(data\)/.test(zone), 'la Paie ne s\'ouvre pas sur le mois à faire');
    assert.ok(/id="p-vers-mois"/.test(app) && /\$\('#p-vers-mois'\)\.onclick/.test(app), 'un mois sans salarié ne mène pas au mois qui en a');
  });
  // Un ouvrier embauché le 24 septembre recevait un mois plein pour six jours de travail ; celui qui
  // part le 5 aussi. Calculé à la main sur septembre 2026 (le dimanche chômé, 26 jours ouvrables) :
  // du 1er au 23, 23 jours dont 3 dimanches → 20 hors contrat, 6 jours payés → 1 200 × 6 / 26.
  t('Une entrée ou une sortie en cours de mois proratise le brut proposé, et le dit', () => {
    const d = vierge();
    const e = { id: 'e1', name: 'Hichem Trabelsi', grossSalary: 1200, hireDate: '2026-09-24' };
    d.employees = [e];
    const i = core.payslipInputFor(d, e, 2026, 9);
    assert.strictEqual(i.gross, 276.923);
    assert.deepStrictEqual({ jours: i.prorata.jours, sur: i.prorata.sur }, { jours: 6, sur: 26 });
    assert.ok(/entrée le 24\/09\/2026/.test(i.prorata.motif));
    assert.strictEqual(core.computePayslip(e, i, core.payrollSettings(d)).baseGross, 276.923, 'le bulletin ne reprend pas le brut proratisé');
    // Le mois suivant, un mois entier.
    const o = core.payslipInputFor(d, e, 2026, 10);
    assert.strictEqual(Number(o.gross), 1200); assert.strictEqual(o.prorata, null);
    // Une sortie le samedi 5 : du 6 au 30, 25 jours dont 4 dimanches → 21 hors contrat, 5 payés.
    const s2 = { id: 'e2', name: 'Ines Jaziri', grossSalary: 1200, hireDate: '2025-01-06', endDate: '2026-09-05' };
    const j = core.payslipInputFor(d, s2, 2026, 9);
    assert.strictEqual(j.gross, 230.769);
    assert.ok(/sortie le 05\/09\/2026/.test(j.prorata.motif));
    // L'écran le dit, et un brut retouché à la main cesse de se dire proratisé.
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/id="bf-prorata"/.test(app), 'le bulletin ne dit pas que son brut est proratisé');
    assert.ok(/if \(p\.prorata && C\.round3\(i\.gross\) !== C\.round3\(p\.prorata\.brut\)\) p\.prorata = null/.test(app), 'un brut retouché se dit encore proratisé');
  });
  // « Net versé : 249,237 DT » au-dessus d'un bulletin « pas encore » payé, et une ligne qui offrait
  // PDF et Modifier mais pas le geste suivant : marquer le salaire payé.
  t('La Paie ne dit « versé » que ce qui l\'est, et la ligne d\'un bulletin propose de le marquer payé', () => {
    const d = vierge();
    d.employees = [{ id: 'e1', name: 'Hichem Trabelsi', grossSalary: 1200, hireDate: '2026-01-05' }];
    d.payslips = [
      { id: 'p8', employeeId: 'e1', year: 2026, month: 8, paidDate: '2026-08-31', computed: { net: 900, gross: 1200 } },
      { id: 'p9', employeeId: 'e1', year: 2026, month: 9, paidDate: '', computed: { net: 900, gross: 1200 } }];
    const sum = core.payrollSummary(d, 2026);
    assert.strictEqual(sum.net, 1800);
    assert.strictEqual(sum.netPaid, 900, 'le net « versé » compte un bulletin qui n\'est pas payé');
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/<div class="lbl">Net versé \$\{info\('pay\.netVerse'\)\}<\/div><div class="val">\$\{C\.money\(sum\.netPaid, cur\)\}/.test(app), 'la carte « Net versé » affiche le net de tous les bulletins');
    const i = app.indexOf('function drawSlips()');
    const zone = app.slice(i, app.indexOf('function drawEmployees()', i));
    assert.ok(zone.length > 2000 && zone.length < 12000, 'tranche drawSlips introuvable (' + zone.length + ')');
    assert.ok(/rowMenuCell\(x\.id, x\.paidDate \? '' : `<button[^`]*data-payer=/.test(zone), 'un bulletin non payé ne propose pas « Marquer payé » sur sa ligne');
    assert.ok(!/data-ed=/.test(zone) && !/data-pdf=/.test(zone), 'la ligne d\'un bulletin porte encore deux boutons');
    assert.ok(/toastUndo\([^;]*marqué payé/.test(zone), 'marquer un salaire payé ne se défait pas');
  });
  // « Comprendre cette page → » est posé une fois par le routeur. La Paie, le Stock et le Catalogue
  // redessinent leur en-tête à chaque onglet et à chaque geste : le lien disparaissait après le
  // premier clic (marquer un salaire payé), et l'article qui explique l'écran avec lui.
  t('Une page qui redessine son en-tête y repose « Comprendre cette page »', () => {
    const app = code('src', 'renderer', 'app.js');
    const redessins = app.split('\n').filter(l => /\$\('#[\w-]*head'\)\.innerHTML = /.test(l));
    assert.ok(redessins.length >= 3, 'redessins d\'en-tête introuvables (' + redessins.length + ')');
    const sans = redessins.filter(l => !/poserLienAide\('/.test(l));
    assert.deepStrictEqual(sans, [], 'un en-tête redessiné perd son lien d\'aide');
  });
  // Le paquet d'août d'une menuiserie qui a commencé en septembre : « commence par émettre une
  // facture » à quelqu'un qui en a émis deux, et « Clôturer août 2026 » en orange sur le néant.
  t('Un paquet vide dit quand viendra le premier, et ne propose pas de clôturer le néant', () => {
    const d = vierge();
    d.documents = [{ id: 'f1', type: 'facture', status: 'envoyée', number: 'FAC-2026-001', date: '2026-09-12', lines: [] }];
    d.purchases = [{ id: 'a1', kind: 'facture', date: '2026-09-02', lines: [] }];
    assert.strictEqual(core.premierePieceApres(d, '2026-08-01'), '2026-09-02');
    assert.strictEqual(core.premierePieceApres(d, '2026-09-01'), '');
    // Un brouillon n'est pas une pièce : il ne partira dans aucun paquet.
    d.purchases = []; d.documents.push({ id: 'b1', type: 'facture', status: 'brouillon', date: '2026-09-01', lines: [] });
    assert.strictEqual(core.premierePieceApres(d, '2026-08-01'), '2026-09-12');
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('function drawCabinet()');
    const zone = app.slice(i, i + 12000);
    assert.ok(/\$\{moisVide \? '' : plan\.definitive/.test(zone), 'un mois vide propose encore de se clôturer');
    assert.ok(/C\.premierePieceApres\(data, per\.month/.test(zone) && /le sera à partir du/.test(zone), 'un paquet vide ne dit pas quand viendra le premier');
  });
  // Le 24 septembre, « 1 déclaration sociale à déposer : CNSS 3e trimestre » — un trimestre qui n'est
  // pas fini, et qu'on aurait pu « Marquer déposée » sans les bulletins de la fin du mois.
  t('Un trimestre CNSS ne se réclame qu\'une fois terminé', () => {
    const d = vierge();
    d.employees = [{ id: 'e1', name: 'Hichem Trabelsi', grossSalary: 1200, hireDate: '2026-09-24' }];
    const e = d.employees[0];
    const i = core.payslipInputFor(d, e, 2026, 9);
    d.payslips = [{ id: 'p9', employeeId: 'e1', year: 2026, month: 9, ...i, computed: core.computePayslip(e, i, core.payrollSettings(d)) }];
    assert.ok(!core.socialDue(d, '2026-09-24').some(x => x.id === 'cnss-2026-T3'), 'le 3e trimestre est réclamé avant d\'être terminé');
    assert.ok(!core.socialDue(d, '2026-09-30').some(x => x.id === 'cnss-2026-T3'), 'le dernier jour du trimestre n\'est pas encore un trimestre terminé');
    assert.ok(core.socialDue(d, '2026-10-01').some(x => x.id === 'cnss-2026-T3'), 'le trimestre terminé n\'est pas réclamé');
  });
  // ------------------------------------------------------------------ parcours humain, lot 1
  // La carte « Coût de la paie 2026 » disait « 0 bulletin, 0 salarié » à une menuiserie qui avait un
  // ouvrier en poste : le « 0 salarié » comptait les salariés PAYÉS dans l'année, et contredisait
  // l'onglet d'à côté. Sans bulletin, la carte dit qu'il n'y en a pas encore.
  t('La carte « Coût de la paie » ne dit pas « 0 salarié » à une entreprise qui en a un', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('<div class="lbl">Coût de la paie ${s.year}');
    assert.ok(i > 0, 'carte « Coût de la paie » introuvable');
    const carte = app.slice(i, app.indexOf('</div></div>', i) + 12);
    assert.ok(carte.length < 600, 'tranche de la carte trop large (' + carte.length + ')');
    assert.ok(/<div class="sub">\$\{sum\.count \? `\$\{pl\(sum\.count, 'bulletin'\)\} pour \$\{pl\(sum\.employees, 'salarié'\)\}` : `aucun bulletin établi/.test(carte),
      'la carte compte encore « 0 salarié » quand aucun bulletin n\'est établi');
  });
  // Brut, Net estimé, Coût employeur : le pied totalisait deux colonnes sur trois. Un total sous une
  // colonne est lu comme sa somme (9.8.8) — une case vide sous « Net estimé » se lit « rien ».
  t('Le pied des Salariés totalise chaque colonne de montants', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('function drawEmployees()');
    const zone = app.slice(i, app.indexOf('\n    function ', i + 30));
    assert.ok(zone.length > 1500 && zone.length < 8000, 'tranche drawEmployees introuvable (' + zone.length + ')');
    const entetes = (zone.match(/<th class="r">[^<]+<\/th>/g) || []).length;
    const pied = zone.slice(zone.indexOf('class="total-row"'));
    const totaux = (pied.match(/<td class="r"><strong>\$\{C\.money\(/g) || []).length;
    assert.strictEqual(entetes, 3, 'colonnes de montants attendues : Brut, Net estimé, Coût employeur');
    assert.strictEqual(totaux, entetes, 'une colonne de montants n\'a pas de total dans le pied');
  });
  // « Hôtel Dar El Marsa … » à côté d'une barre de 55 px et de 60 px vides : le nom plafonné à 42 %
  // de la ligne, et une piste de barre qui changeait avec la longueur du nom.
  t('Un classement se lit en colonnes : le nom avant la barre, une seule piste pour toutes les barres', () => {
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const regle = sel => (new RegExp('^' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'm').exec(css) || [])[1] || '';
    assert.ok(/display: grid/.test(regle('.rank')) && /grid-template-columns: fit-content\(60%\) minmax\(56px, 1fr\) max-content/.test(regle('.rank')),
      'le classement ne réserve pas au nom la place dont il a besoin');
    assert.ok(/grid-template-columns: subgrid/.test(regle('.rank li')), 'chaque ligne a sa propre piste : deux barres ne se comparent plus');
    assert.ok(!/max-width: 42%/.test(regle('.rank .name')), 'le nom est encore plafonné à 42 % de la ligne');
    assert.ok(!/min-width: 110px/.test(regle('.rank .amt')), 'le montant réserve encore 110 px, pris au nom');
  });
  // « 0 jours », « 1 jours de retard », « plus ancienne : 1 jours » : les nombres de jours s'écrivaient
  // à la main. Un nombre de jours calculé passe par l'accord ; seules les listes de CONSTANTES
  // (« 30 jours », « 60 jours » d'un sélecteur) l'écrivent en toutes lettres.
  t('Un nombre de jours calculé s\'accorde : jamais « 1 jours » ni « 0 jours »', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(!/\+ ' jours/.test(app), 'un nombre de jours est encore concaténé à « jours »');
    const restes = [...app.matchAll(/\$\{([^{}]+)\} jours/g)]
      .filter(m => !(m[1] === 'd' && /\.map\(d => `<option value="\$\{d\}"/.test(app.slice(Math.max(0, m.index - 160), m.index))));
    assert.deepStrictEqual(restes.map(m => m[0]), [], 'un nombre de jours calculé est écrit sans accord');
    const cor = code('src', 'renderer', 'core.js');
    const dansCore = [...cor.matchAll(/\$\{([^{}]+)\} jours/g)].filter(m => m[1] !== 'LICENCE_PREAVIS');
    assert.deepStrictEqual(dansCore.map(m => m[0]), [], 'core.js écrit un nombre de jours sans accord');
  });
  // Trois cartes sur une rangée, et le chiffre de « Coût des ventes » montait de 3 px : son étiquette
  // n'avait pas de bulle « i », donc une ligne de 12 px contre 15 à ses voisines. La hauteur de ligne
  // des étiquettes est celle d'une bulle — et elle se DÉDUIT de la bulle : un changement de taille de
  // la bulle doit faire tomber ce test, pas remettre l'escalier en silence.
  t('Une étiquette de carte a la hauteur d\'une bulle « i », avec ou sans bulle', () => {
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const regle = sel => (new RegExp('^' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'm').exec(css) || [])[1] || '';
    const lbl = regle('.eyebrow, .k-label, .stat .lbl');
    const bulle = regle('button.i');
    const px = (r, p) => Number((new RegExp('(?:^|[;\\s])' + p + ': (-?[\\d.]+)px').exec(r) || [])[1]);
    const hauteurLigne = px(lbl, 'line-height'), hauteurBulle = px(bulle, 'height'), releve = px(bulle, 'vertical-align') || 0;
    assert.ok(hauteurBulle > 0, 'hauteur de la bulle introuvable');
    assert.ok(hauteurLigne >= hauteurBulle + releve, `l'étiquette (${hauteurLigne || 'hauteur normale'}) est plus basse qu'une bulle (${hauteurBulle} + ${releve}) : une carte sans bulle décale son chiffre`);
  });
  // La hauteur de ligne réglait l'étiquette SANS bulle ; elle ne pouvait rien contre une étiquette
  // qui passe sur deux lignes à 1280 px (« Délai moyen de paiement ») : son chiffre descendait de
  // 16 px sous ceux de sa rangée, sur onze écrans (sonde de rangée, e2e:entreprise-rendu). Les cartes
  // d'une rangée partagent leurs pistes : l'étiquette, le chiffre et le commentaire en trois rangées
  // communes (subgrid). La variante `.rangee` du Cabinet pose tout sur une ligne et en est exclue.
  t('Les cartes d\'une rangée partagent leurs pistes : une étiquette sur deux lignes ne descend pas son chiffre', () => {
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const m = /^\.stats:not\(\.rangee\) > \.stat \{([^}]*)\}/m.exec(css);
    assert.ok(m, 'aucune règle ne fait partager aux cartes d\'une rangée les pistes de leurs voisines');
    assert.ok(/grid-template-rows: subgrid/.test(m[1]) && /grid-row: span 3/.test(m[1]), 'la carte ne reprend pas les trois pistes de sa rangée : ' + m[1].trim());
    assert.ok(/display: grid/.test(m[1]), 'une carte en subgrid doit être elle-même une grille');
    // Une carte à quatre éléments déborderait de ses trois pistes : chaque carte des deux
    // applications compte au plus une étiquette, un chiffre et un commentaire.
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js']]) {
      const src = lireSource(...f);
      for (const c of src.matchAll(/<div class="stat"(?: [^>]*)?>([\s\S]*?)<\/div>\s*(?:<\/div>\s*){0,1}(?=\s*(?:<div class="stat"|\$\{|<\/div>|`))/g)) {
        const enfants = (c[1].match(/<div class="(?:lbl|val|sub)\b/g) || []).length;
        assert.ok(enfants <= 3, f.join('/') + ' : une carte porte ' + enfants + ' éléments — ' + c[0].slice(0, 90));
      }
    }
  });
  // La page Relances d'une menuiserie qui attendait 4 530 DT expliquait comment elle se remplit,
  // jamais POURQUOI elle était vide ni QUAND elle cesserait de l'être (E-06 : un état vide dit sa
  // raison et le jour où ça changera).
  t('Relances vide : la prochaine facture qui arrive à échéance, et le jour', () => {
    const d = vierge();
    d.clients = [{ id: 'c1', name: 'Hôtel Dar El Marsa SARL' }];
    const f = (id, n, date, due, statut) => ({ id, type: 'facture', number: n, status: statut || 'envoyée', clientId: 'c1', date, dueDate: due,
      applyStamp: false, withholdingRate: 0, discountRate: 0, lines: [{ label: 'Porte', qty: 1, unitPrice: 1000, vatRate: 19 }], payments: [] });
    d.documents = [f('a', 'FAC-2026-001', '2026-09-01', '2026-10-31'), f('b', 'FAC-2026-002', '2026-09-12', '2026-10-12'),
      f('c', 'FAC-2026-003', '2026-08-01', '2026-08-31'), f('x', '', '2026-09-20', '2026-10-20', 'brouillon')];
    // Une facture payée n'est plus « à venir ».
    d.documents.push({ ...f('p', 'FAC-2026-004', '2026-09-15', '2026-10-15'), payments: [{ id: 'r', date: '2026-09-16', amount: 1190 }] });
    const av = core.facturesAVenir(d, société, '2026-09-24');
    assert.deepStrictEqual(av.map(x => x.doc.number), ['FAC-2026-002', 'FAC-2026-001'], 'les factures à venir ne sont pas triées par échéance, ou un brouillon, une facture en retard ou payée s\'y glisse');
    assert.strictEqual(av[0].remaining, 1190);
    assert.strictEqual(core.overdueInvoices(d, société, '2026-09-24').length, 1, 'la facture échue n\'est plus en retard');
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('routes.relances = ');
    const zone = app.slice(i, app.indexOf("<h1>Relances ${info('rel.levels')}", i));
    assert.ok(zone.length > 3000 && zone.length < 14000, 'tranche des Relances introuvable (' + zone.length + ')');
    assert.ok(/C\.facturesAVenir\(data, company\(\)\)/.test(zone) && /La prochaine échéance est celle de/.test(zone), 'la page Relances vide ne nomme pas la prochaine échéance');
  });
  // « trésorerie » dans une phrase de la Paie, « Voir les relances » des Statistiques, le numéro de
  // facture des Relances : le bleu brut du navigateur, lisible en clair par chance, illisible en sombre.
  t('Un lien dans une phrase est stylé par l\'application, jamais par le navigateur', () => {
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const r = /^#view a\[href\]:not\(\[class\]\), #modal-root a\[href\]:not\(\[class\]\) \{([^}]*)\}/m.exec(css);
    assert.ok(r && /color: var\(--primary\)/.test(r[1]) && /text-decoration: underline/.test(r[1]), 'aucune règle ne style un lien écrit dans une phrase');
  });
  // Un instrument ne protège que ce qu'il mesure : la sonde de contraste ne regardait que boutons et
  // champs ; celle des rangées de cartes n'existait pas. Branchées, et un parcours qui n'en mesure
  // aucune TOMBE — sinon il annoncerait « tout va bien » sans avoir regardé (T-55).
  t('Les liens et les rangées de cartes sont mesurés par les parcours de rendu', () => {
    const h = lireSource('test', 'e2e', 'harnais.js');
    assert.ok(/const liens = \[\];/.test(h) && /brut: s\.color === 'rgb\(0, 0, 238\)'/.test(h) && /return \{ boutons, champs, liens \};/.test(h), 'la sonde de contraste ne mesure pas les liens');
    // L'EXPORT, pas le voisin de la ligne d'export : `SONDE_RANGEE, FENETRE` tombait dès qu'une sonde
    // s'ajoutait entre les deux — une forme, pas la règle (7.16.0).
    const exports = (/module\.exports = \{([\s\S]*?)\};/.exec(h) || [])[1] || '';
    assert.ok(/const SONDE_RANGEE = /.test(h) && /\bSONDE_RANGEE\b/.test(exports), 'la sonde des rangées de cartes n\'est pas exportée');
    for (const f of ['entreprise-rendu', 'cabinet-rendu', 'console-rendu', 'contraste']) {
      const src = lireSource('test', 'e2e', f + '.js');
      // Le FILTRE qui juge, pas le mot « brut » : il vit aussi dans le message de la faute, et un
      // test qui le cherche n'importe où restait vert avec le jugement retiré.
      assert.ok(/liens(: lks)? \} = await \w+\.evaluate\(SONDE(_CONTRASTE)?\)/.test(src) && /\.filter\(l => l\.ratio < SEUIL \|\| l\.brut\)/.test(src), f + ' ne juge pas les liens');
    }
    for (const f of ['entreprise-rendu', 'cabinet-rendu']) {
      const src = lireSource('test', 'e2e', f + '.js');
      assert.ok(/evaluate\(SONDE_RANGEE/.test(src) && /!rangees/.test(src) && /!liensMesures/.test(src), f + ' ne mesure pas les rangées, ou passe sans en avoir mesuré');
    }
  });
  // « hotel » ne trouvait pas « Hôtel Dar El Marsa SARL » — dans les listes, le choix du client d'une
  // facture, la palette Ctrl K et l'Aide. Le Cabinet plie les accents depuis la 6.8.0 (jumeau manquant).
  t('Toute recherche tapée ignore accents et majuscules, mot par mot', () => {
    assert.strictEqual(core.correspondRecherche('Hôtel Dar El Marsa SARL', 'hotel'), true);
    assert.strictEqual(core.correspondRecherche('Hôtel Dar El Marsa SARL', 'MARSA hôtel'), true, 'les mots se cherchent chacun, dans n\'importe quel ordre');
    assert.strictEqual(core.correspondRecherche('Règles de facturation — délai paiement', 'delai'), true);
    assert.strictEqual(core.correspondRecherche('Café des Arts', 'thé'), false);
    assert.strictEqual(core.correspondRecherche('n\'importe quoi', '  '), true, 'une recherche vide garde tout');
    const app = code('src', 'renderer', 'app.js');
    // CHAQUE recherche, pas « au moins une » : un filtre écrit à la main et laissé sensible aux
    // accents passerait sous un test qui compte (10.12.0, 7.33.0).
    const restes = (app.match(/\.toLowerCase\(\)\.includes\(/g) || []).length;
    assert.strictEqual(restes, 0, 'une recherche compare encore le texte sans plier ses accents (' + restes + ')');
    assert.ok(/C\.correspondRecherche\(x\.text \|\| x\.label \|\| '', q\.value\)/.test(app), 'le choix d\'un client dans l\'éditeur est sensible aux accents');
    assert.ok(/const q = C\.plier\(input\.value\.trim\(\)\);/.test(app) && /plie\(x\)\.includes\(w\)/.test(app), 'la palette Ctrl K ne plie pas les accents');
    assert.ok(/const aideMots = q => C\.plier\(/.test(app) && /const titre = C\.plier\(a\.title\)/.test(app), 'la recherche de l\'Aide ne plie pas les accents');
    // Le surlignage découpe le texte d'origine aux positions trouvées dans le texte plié : les deux
    // doivent avoir la même longueur.
    const plierPareil = s2 => Array.from(String(s2 || ''), ch => { const f = core.plier(ch); return f.length === ch.length ? f : ch; }).join('');
    const phrase = 'L\'échéance de la déclaration arrive';
    assert.strictEqual(plierPareil(phrase).length, phrase.length);
    assert.ok(/const bas = plierPareil\(texte\);[\s\S]{0,400}const bas = plierPareil\(texte\);/.test(app) || (app.match(/const bas = plierPareil\(texte\);/g) || []).length === 2, 'le surlignage de l\'Aide ne plie pas le texte à longueur égale');
  });
  // Un contrat mensuel pour un client exonéré de timbre : chaque brouillon portait un timbre. Les deux
  // autres chemins de création reprenaient l'exonération (le choix du client, E-02) ; pas celui-ci.
  t('Une facture préparée par un contrat reprend l\'exonération de timbre du client', () => {
    const rec = { id: 'r1', clientId: 'c1', subject: 'Entretien — {mois}', every: 'month', day: 1, nextDate: '2026-10-01',
      lines: [{ label: 'Réglage des portes', qty: 1, unitPrice: 150, vatRate: 19 }] };
    const exo = core.buildRecurringInvoice(rec, '2026-10-01', société, { id: 'c1', stampExempt: true });
    const ord = core.buildRecurringInvoice(rec, '2026-10-01', société, { id: 'c1' });
    assert.strictEqual(exo.applyStamp, false, 'le brouillon d\'un client exonéré porte un timbre');
    assert.strictEqual(ord.applyStamp, true);
    // 150 HT + 28,5 de TVA, sans timbre : 178,5 — calculé à la main.
    assert.strictEqual(core.computeTotals(exo, société).netToPay, 178.5);
    // La prévision de trésorerie compte ce que le contrat facturera VRAIMENT.
    const d = vierge();
    d.clients = [{ id: 'c1', name: 'Hôtel', stampExempt: true }];
    d.recurring = [{ ...rec, active: true }];
    const f = core.cashForecast(d, société, 90, '2026-09-24');
    const ev = (f.events || []).find(e => e.kind === 'contrat');
    assert.ok(ev, 'le contrat n\'entre pas dans la prévision');
    assert.strictEqual(ev.amount, 178.5, 'la prévision compte un timbre que la facture ne portera pas');
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/C\.buildRecurringInvoice\(rec, rec\.nextDate, company\(\), clientById\(rec\.clientId\)\)/.test(app), 'la génération des brouillons ne passe pas le client');
    assert.ok(/C\.buildRecurringInvoice\(r, r\.nextDate, co, clientById\(r\.clientId\)\)/.test(app), 'la fiche du contrat annonce une facture avec un timbre');
  });
  // « Paiement à réception » : délai 0. `Number(x) || 30` le changeait en trente jours, sur chaque
  // facture — et le formulaire des Paramètres l'écrivait 30 à l'enregistrement (7.16.0).
  t('Un délai de paiement de 0 jour reste 0 : seule une case vide prend les 30 jours', () => {
    assert.strictEqual(core.delaiJours(0, 30), 0);
    assert.strictEqual(core.delaiJours('0', 30), 0);
    assert.strictEqual(core.delaiJours('', 30), 30);
    assert.strictEqual(core.delaiJours(null, 30), 30);
    assert.strictEqual(core.delaiJours(45, 30), 45);
    assert.strictEqual(core.delaiJours(-3, 30), 30, 'un délai négatif n\'existe pas');
    const rec = { id: 'r1', clientId: 'c1', subject: 'x', lines: [] };
    assert.strictEqual(core.buildRecurringInvoice(rec, '2026-10-01', { ...société, paymentTermsDays: 0 }).dueDate, '2026-10-01', 'un contrat « à réception » donne une échéance à trente jours');
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'renderer', 'core.js']]) {
      const src = code(...f);
      assert.ok(!/(paymentTermsDays|quoteValidityDays)\)? \|\| 30/.test(src), f[2] + ' transforme encore un délai de 0 jour en 30');
    }
  });
  // Le formulaire d'un contrat : une bulle pour UNE unité sur neuf champs, et des refus en bandeau
  // de 2,6 secondes qui ne montraient pas le champ.
  t('Le formulaire de contrat explique chaque champ et montre celui qu\'il refuse', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('function recurrenceForm(');
    const zone = app.slice(i, app.indexOf('\n  function ', i + 30));
    assert.ok(zone.length > 3000 && zone.length < 12000, 'tranche recurrenceForm introuvable (' + zone.length + ')');
    for (const cle of ['contrat.client', 'contrat.periode', 'contrat.objet', 'contrat.jour', 'contrat.next', 'ed.withholding', 'ed.discount', 'ed.notes', 'contrat.actif']) {
      assert.ok(zone.includes(`'${cle}'`), 'le champ de la bulle ' + cle + ' n\'en porte pas');
    }
    const ok = zone.slice(zone.indexOf("$('#ok', root).onclick"));
    assert.ok(!/return toast\(/.test(ok.slice(0, 1500)), 'un refus du contrat reste un bandeau qui ne montre pas le champ');
    assert.strictEqual((ok.slice(0, 1500).match(/return refus\(/g) || []).length, 4, 'les quatre refus du contrat ne passent pas tous par refus()');
    assert.ok(/t\.netHT > 0\.0005 \?/.test(zone), 'un contrat vide annonce un montant fait du seul timbre');
  });
  // 10.12.0 — un délai de 0 jour imprimait « À régler avant le 24/09/2026 » sous « Émise le
  // 24/09/2026 » : un délai qui se lit impossible. La mention d'usage est « à réception ».
  t('Une facture payable le jour de son émission porte « à réception », pas « avant le » ce jour-là', () => {
    const client = { id: 'c1', name: 'Client' };
    const base = { type: 'facture', number: 'FAC-2026-001', date: '2026-09-24', status: 'envoyée', clientId: 'c1', applyStamp: true,
      lines: [{ label: 'Pose', qty: 1, unitPrice: 100, vatRate: 19 }] };
    const html = d => core.documentHtml(d, client, société, {});
    const jour = html({ ...base, dueDate: '2026-09-24', lang: 'fr' });
    assert.ok(/À réception/.test(jour), 'une facture à 0 jour n\'imprime pas « à réception »');
    assert.ok(!/À régler avant le/.test(jour), 'une facture à 0 jour imprime encore « À régler avant le » le jour de son émission');
    const trente = html({ ...base, dueDate: '2026-10-24', lang: 'fr' });
    assert.ok(/À régler avant le/.test(trente) && /24\/10\/2026/.test(trente), 'une facture à trente jours ne dit plus sa date limite');
    assert.ok(!/À réception/.test(trente), 'une facture à trente jours se dit « à réception »');
    assert.ok(/On receipt/.test(html({ ...base, dueDate: '2026-09-24', lang: 'en' })), 'la facture anglaise à 0 jour n\'a pas sa mention');
    const pro = html({ ...base, type: 'proforma', dueDate: '2026-09-24', lang: 'fr' });
    assert.ok(/À réception/.test(pro) && !/À régler avant le/.test(pro), 'la proforma à 0 jour garde « avant le » le jour même');
  });
  // 10.12.0 — la fiche d'un contrat, à la souris : l'aperçu de la prochaine facture barré d'une
  // barre de défilement horizontale (et le bord droit de la page coupé), un « Générer maintenant »
  // vert une semaine avant l'échéance, un cadre pointillé de 110 px pour « aucune facture générée »,
  // et le pied de la liste des contrats sur trois lignes (« par mois · 1 800,000 DT par / an »).
  t('Contrats : l\'aperçu tient dans son cadre, le vert attend l\'échéance, le vide s\'annonce, le total tient sur sa ligne', () => {
    const app = code('src', 'renderer', 'app.js');
    // L'aperçu en colonne : le zoom se recale sur la largeur qui reste APRÈS la mise en page — celle
    // qui décide de la barre de défilement. Le grand aperçu garde le zoom de l'utilisateur.
    const fn = app.slice(app.indexOf('function ajusterAuCadre('), app.indexOf('function ajusterAuCadre(') + 400);
    assert.ok(/scrollWidth <= el\.clientWidth/.test(fn) && /el\.clientWidth - 2\) \/ 794/.test(fn), 'le zoom de l\'aperçu ne se recalcule pas sur la largeur qui reste : ' + fn.slice(0, 160));
    const editeur = app.slice(app.indexOf('function drawPreview()'), app.indexOf('function dessinerPleinEcran()'));
    const contrat = app.slice(app.indexOf('routes.contrat = '), app.indexOf('routes.contrat = ') + 9000);
    for (const [nom, zone] of [['l\'éditeur', editeur], ['la fiche d\'un contrat', contrat]]) {
      const i = zone.indexOf('mettreEnPage('), j = zone.indexOf('ajusterAuCadre(');
      assert.ok(i > 0 && j > i, 'l\'aperçu de ' + nom + ' ne recale pas son zoom après la mise en page');
    }
    const plein = app.slice(app.indexOf('function dessinerPleinEcran()'), app.indexOf('function fermerPleinEcran()'));
    assert.ok(plein.length > 200 && !plein.includes('ajusterAuCadre('), 'le grand aperçu écrase le zoom choisi par l\'utilisateur');
    // Le bouton principal de la fiche : vert seulement quand une facture est due.
    const gen = /<button class="([^"]*)" id="c-gen">/.exec(contrat) || /<button class="btn\$\{([^}]*)\}" id="c-gen">/.exec(contrat);
    assert.ok(gen, 'bouton « Générer maintenant » introuvable');
    assert.ok(!/^btn btn-primary$/.test(gen[1]) && /isDue \? ' btn-primary'/.test(gen[1]), '« Générer maintenant » est vert même quand rien n\'est dû : ' + gen[1]);
    // Les listes d'une fiche : un état vide secondaire.
    const fiches = [...app.matchAll(/docTable\([^,]+, \{\s*hideClient: true[^}]*\}/g)].map(m => m[0]);
    assert.ok(fiches.length >= 2, 'les listes des fiches client et contrat sont introuvables (' + fiches.length + ')');
    for (const f of fiches) assert.ok(/mini: true/.test(f), 'la liste d\'une fiche garde le grand cadre vide d\'une page : ' + f.slice(0, 80));
    // Le pied de la liste des contrats : la phrase du total sur UNE ligne, dans deux colonnes.
    const liste = app.slice(app.indexOf('routes.contrats = '), app.indexOf('routes.contrats = ') + 7000);
    const pied = liste.slice(liste.indexOf('<tfoot>'), liste.indexOf('</tfoot>'));
    assert.ok(/<td class="r nw" colspan="2"><strong>\$\{C\.money\(parMois/.test(pied), 'le total des contrats ne tient pas sur sa ligne : ' + pied.slice(0, 200));
    assert.ok(/key: 'every'[^\n]*nw: true/.test(liste), 'la période d\'un contrat passe à la ligne (« Chaque / mois »)');
  });
  // 10.12.0 — une bulle « i » qui termine une phrase passait seule sur la ligne suivante (l'état vide
  // des Proformas : « … pour un dossier. » puis un « i » orphelin). En prose, l'espace qui la précède
  // devient insécable, sur chaque nœud ajouté au document — dans les DEUX applications, par le même
  // corps. Et une sonde le mesure sur tous les écrans des deux parcours de rendu.
  t('Une bulle « i » ne passe jamais seule à la ligne : l\'espace qui la précède est insécable, dans les deux applications', () => {
    const corps = f => {
      const src = lireSource(...f);
      const i = src.indexOf('function collerBulles(');
      assert.ok(i > 0, f.join('/') + ' ne colle pas ses bulles à leur dernier mot');
      const fin = src.indexOf('\n  }\n', i);
      return src.slice(i, fin);
    };
    const e = corps(['src', 'renderer', 'app.js']), c = corps(['src', 'cabinet', 'renderer', 'app.js']);
    assert.strictEqual(e, c, 'les deux applications ne collent pas leurs bulles de la même façon');
    assert.ok(/\\u00a0/.test(e) && /flex\|grid/.test(e), 'la bulle n\'est pas collée par une espace insécable, ou l\'est aussi dans un conteneur flex');
    // Une espace insécable NE SUFFIT PAS : la bulle est un élément en ligne atomique, et Chrome coupe
    // avant lui même derrière une insécable — la sonde l'a vu à 1280 px sur des étiquettes « collées ».
    // Le dernier mot et la bulle vont dans un <span> qui ne se coupe pas.
    assert.ok(/colle\.className = 'colle-bulle'/.test(e) && /colle\.append\(b\)/.test(e), 'la bulle n\'est plus rangée avec son dernier mot dans un <span> insécable');
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(/^\.colle-bulle \{ white-space: nowrap; \}/m.test(css), 'le <span> du dernier mot et de sa bulle peut se couper');
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js']]) {
      assert.ok(/new MutationObserver\([\s\S]{0,200}collerBulles\(n\)/.test(code(...f)), f.join('/') + ' ne colle pas les bulles des listes redessinées');
    }
    for (const f of ['entreprise-rendu.js', 'cabinet-rendu.js']) {
      const src = lireSource('test', 'e2e', f);
      assert.ok(/evaluate\(SONDE_BULLE/.test(src) && /\|\| !bulles\)/.test(src), f + ' ne mesure pas les bulles orphelines, ou ne tombe pas quand il n\'en voit aucune');
    }
  });
  // 10.12.0 — la retenue et la remise des totaux de l'éditeur s'écrivaient « - 133,875 DT » : un
  // trait d'union et une espace ordinaire, là où le document imprimé et toutes les listes écrivent
  // « − 133,875 DT » (vrai signe moins, espace insécable). Un montant négatif s'écrit par money().
  t('Un montant retranché s\'écrit par money(), pas avec un trait d\'union posé devant', () => {
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js']]) {
      const src = lireSource(...f);
      const restes = src.match(/<td[^>]*>\s*[-−]\s*\$\{C\.money\(/g) || [];
      assert.deepStrictEqual(restes, [], f.join('/') + ' écrit un signe à la main devant un montant');
    }
    assert.strictEqual(core.money(-133.875, 'DT'), '− 133,875 DT', 'money() n\'écrit plus le vrai signe moins');
  });
  // 10.12.0 — une proforma envoyée par email partait avec un PDF tamponné « BROUILLON » et restait
  // brouillon : seul le devis passait à « envoyé ». La pièce qu'une banque demande pour un dossier.
  t('Envoyer une pièce la fait passer de brouillon à envoyée, et le PDF joint n\'est pas tamponné « BROUILLON »', () => {
    for (const [type, st] of Object.entries(core.STATUT_ENVOI)) {
      assert.ok((core.STATUSES[type] || []).includes(st), type + ' passe à un statut qu\'il ne connaît pas : ' + st);
    }
    assert.ok(!core.STATUT_ENVOI.facture && !core.STATUT_ENVOI.avoir, 'une facture ou un avoir s\'ÉMET, il ne « s\'envoie » pas hors de son émission');
    // Toute autre pièce qui connaît le brouillon a son statut d'envoi : sans lui, l'envoyer la
    // laisserait brouillon — et une entrée qui manque ne se voit pas dans la boucle du dessus.
    for (const type of Object.keys(core.STATUSES).filter(t => t !== 'facture' && t !== 'avoir')) {
      assert.ok(core.STATUT_ENVOI[type], type + ' n\'a pas de statut d\'envoi : l\'envoyer la laisserait brouillon');
    }
    const client = { id: 'c1', name: 'Hôtel' };
    const pro = { id: 'p1', type: 'proforma', number: 'PRO-2026-001', date: '2026-09-24', dueDate: '2026-10-24', clientId: 'c1',
      lines: [{ label: 'Porte coupe-feu', qty: 6, unitPrice: 1250, vatRate: 19 }] };
    const tampon = d => /class="stamp[^"]*draft|>Brouillon</.test(core.documentHtml(d, client, société, {}));
    assert.ok(tampon({ ...pro, status: 'brouillon' }), 'le jeu ne discrimine pas : la proforma brouillon devrait porter son tampon');
    for (const type of ['proforma', 'livraison', 'commande']) {
      assert.ok(!tampon({ ...pro, type, status: core.STATUT_ENVOI[type] }), 'une ' + type + ' envoyée garde le tampon « BROUILLON »');
    }
    const app = code('src', 'renderer', 'app.js');
    const envoi = app.slice(app.indexOf('async function sendByEmail('), app.indexOf('function sendReminder('));
    assert.ok(envoi.length > 1500 && envoi.length < 8000, 'tranche sendByEmail introuvable (' + envoi.length + ')');
    assert.ok(/C\.STATUT_ENVOI\[doc\.type\]/.test(envoi), 'l\'envoi ne lit pas le statut d\'envoi de la pièce');
    assert.ok(/exportPdfSilent\(C\.documentHtml\(telle,/.test(envoi), 'le PDF joint est celui de la pièce encore brouillon');
    assert.ok(!/stored\.type === 'devis' && stored\.status === 'brouillon'/.test(envoi), 'seul le devis passe encore à « envoyé »');
  });
  // 10.12.0 — « Facture créé en brouillon à partir de PRO-2026-001 » : le participe ne s'accordait
  // pas avec la pièce. Et le retour de la facture tirée d'une proforma disait « ← Facture proforma
  // PRO-2026-001 » : 29 caractères, « Plus ▾ » sur une troisième rangée.
  t('Une pièce créée s\'accorde avec son type, et son nom trop long cède la place à son numéro sur le retour', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(!/\$\{C\.TITLES\[\w+\]\} créé /.test(lireSource('src', 'renderer', 'app.js')), 'un message écrit encore « <type> créé » sans accorder');
    const pc = app.slice(app.indexOf('const pieceCreee = '), app.indexOf('const pieceCreee = ') + 200);
    assert.ok(/t === 'facture' \|\| t === 'proforma'/.test(pc), 'le participe ne s\'accorde plus au féminin de la facture et de la proforma');
    for (const [t, attendu] of [['facture', 'Facture'], ['proforma', 'Facture proforma']]) assert.strictEqual(core.TITLES[t], attendu, 'le titre de ' + t + ' a changé : l\'accord se relit');
    // Le retour : les types longs (proforma, bons, contrat) dépassent vingt caractères avec leur
    // numéro — c'est ce qui DOIT les faire passer au numéro seul (règle lue dans pageLabel, audit-ux).
    const longs = Object.entries(core.TITLES).filter(([k, v]) => (v + ' ' + core.PREFIX[k] + '-2026-001').length > 20).map(([k]) => k);
    assert.ok(longs.includes('proforma') && !longs.includes('devis'), 'le jeu ne discrimine plus : ' + longs.join(', '));
  });
  // 10.12.0 — l'affaire d'un chantier, parcourue par une menuiserie qui la crée APRÈS avoir facturé.
  // Le « reste en devis » comptait un devis déjà facturé en entier, en plus de ses propres factures :
  // la fiche annonçait 5 520 DT facturés PLUS 5 520 DT en devis pour un seul chantier.
  t('Le « reste en devis » d\'une affaire ne compte que ce qui n\'est pas encore facturé', () => {
    const d = vierge();
    const L = (ht, extra) => [{ label: 'Porte', qty: 1, unitPrice: ht, vatRate: 19, ...(extra || {}) }];
    d.projects = [{ id: 'P', name: 'Réception', status: 'en cours' }];
    d.documents = [
      { id: 'D1', type: 'devis', number: 'DEV-2026-001', status: 'accepté', date: '2026-03-01', projectId: 'P', lines: [{ label: 'Porte', qty: 10, unitPrice: 100, vatRate: 19 }] },
      { id: 'A1', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', date: '2026-03-02', projectId: 'P', fromQuoteId: 'D1', deposit: { percent: 30, quoteId: 'D1' }, lines: L(300, { noDiscount: true }) },
      { id: 'D2', type: 'devis', number: 'DEV-2026-002', status: 'refusé', date: '2026-03-03', projectId: 'P', lines: L(500) },
      { id: 'D3', type: 'devis', number: 'DEV-2026-003', status: 'envoyé', date: '2026-03-04', projectId: 'P', lines: L(400) },
      { id: 'F3', type: 'facture', status: 'brouillon', date: '2026-03-05', projectId: 'P', fromQuoteId: 'D3', lines: L(400) },
      { id: 'D4', type: 'devis', number: 'DEV-2026-004', status: 'envoyé', date: '2026-03-06', projectId: 'P', lines: L(250) }
    ];
    // À la main : D1 1 000 − acompte émis 300 = 700 ; D2 refusé : rien ; D3 400 (sa facture n'est
    // qu'un BROUILLON, elle ne ferme rien) ; D4 250. Total 1 350 — l'ancien code disait 1 650.
    let m = core.projectMargin(d, société, 'P');
    assert.strictEqual(m.pending, 1350, 'reste en devis avec un acompte émis : ' + m.pending);
    assert.strictEqual(m.revenue, 300, 'vendu : seul l\'acompte émis compte');
    // La facture de solde émise FERME le devis : il ne compte plus du tout, et le vendu porte 1 000.
    d.documents.push({ id: 'S1', type: 'facture', number: 'FAC-2026-002', status: 'envoyée', date: '2026-03-07', projectId: 'P', fromQuoteId: 'D1', settles: true,
      lines: [{ label: 'Porte', qty: 10, unitPrice: 100, vatRate: 19 }, { label: 'Acompte déjà facturé', qty: 1, unitPrice: -300, vatRate: 19, noDiscount: true }] });
    m = core.projectMargin(d, société, 'P');
    assert.strictEqual(m.revenue, 1000, 'vendu après le solde : ' + m.revenue);
    assert.strictEqual(m.pending, 650, 'le devis facturé en entier compte encore « en devis » : ' + m.pending);
    const guide = code('src', 'renderer', 'guide.js');
    assert.ok(/'mg\.projectRevenue'[^\n]*pas encore facturée/.test(lireSource('src', 'renderer', 'guide.js')) && guide.length, 'la bulle ne dit plus que le devis ne compte que pour sa part non facturée');
  });
  t('Une affaire se crée après coup : une pièce émise la reçoit, et on peut la retirer', () => {
    const app = code('src', 'renderer', 'app.js'), brut = lireSource('src', 'renderer', 'app.js');
    // Le champ Affaire d'une pièce émise n'est plus grisé, et le choix s'enregistre tout de suite.
    const ligne = brut.split('\n').find(l => /combo\(\{ name: 'projectId', value: doc\.projectId/.test(l)) || '';
    assert.ok(ligne && !/ro: locked/.test(ligne) && !/add: locked \? null/.test(ligne), 'le champ Affaire d\'une pièce émise est encore en lecture seule : ' + ligne.trim());
    const pa = app.slice(app.indexOf('const poserAffaire = v =>'), app.indexOf('const projectCombo = bindCombo('));
    assert.ok(pa.length > 100 && pa.length < 1200, 'tranche poserAffaire introuvable (' + pa.length + ')');
    assert.ok(/if \(!locked\) return;/.test(pa) && /st\.projectId = v/.test(pa) && /delete st\.projectId/.test(pa) && /save\(true\)/.test(pa),
      'sur une pièce émise, l\'affaire choisie n\'est pas enregistrée sur la pièce rangée');
    const pc = app.slice(app.indexOf('const projectCombo = bindCombo('), app.indexOf('const projectCombo = bindCombo(') + 500);
    assert.ok(/onPick: poserAffaire/.test(pc), 'le choix d\'une affaire ne passe pas par poserAffaire');
    // Retirer : la liste commence par « — Aucune affaire — », grisée comme l'invite qu'elle remplace.
    const pi = app.slice(app.indexOf('const projectItems = '), app.indexOf('function projectForm('));
    assert.ok(/\[\{ v: '', label: '— Aucune affaire —'[^\]]*vide: true \}\]\.concat\(/.test(pi.replace(/\n\s*/g, ' ')) || /v: '', label: '— Aucune affaire —'/.test(brut.slice(brut.indexOf('const projectItems = '), brut.indexOf('const projectItems = ') + 400)),
      'la liste des affaires n\'offre plus de quoi retirer une affaire choisie');
    assert.ok(/span\.classList\.toggle\('ph', !it \|\| !!it\.vide\)/.test(app), 'l\'entrée « — Aucune affaire — » ne se lit plus comme une invite grisée');
    // Changer de client emporte l'affaire de l'ancien : absente de la liste, elle restait en silence.
    assert.ok(/!items\.some\(x => x\.v === doc\.projectId\)\) \{ doc\.projectId = ''; projectCombo\.setValue\('', true\)/.test(app),
      'changer le client d\'un brouillon garde en silence l\'affaire d\'un autre client');
  });
  t('« + Devis » et « + Achat » depuis une affaire créent des pièces RATTACHÉES à cette affaire', () => {
    const app = code('src', 'renderer', 'app.js');
    const doc = app.slice(app.indexOf('routes.doc = (parts) =>'), app.indexOf('routes.doc = (parts) =>') + 2500);
    assert.ok(/const iAff = parts\.indexOf\('affaire'\);\s*if \(iAff > 1 && projectById\(parts\[iAff \+ 1\]\)\) doc\.projectId = parts\[iAff \+ 1\];/.test(doc), 'un devis ouvert depuis une affaire ne lui est pas rattaché');
    const achat = app.slice(app.indexOf('routes.achat = (parts) =>'), app.indexOf('routes.achat = (parts) =>') + 2500);
    assert.ok(/const iAff = parts\.indexOf\('affaire'\);\s*if \(iAff > 0 && projectById\(parts\[iAff \+ 1\]\)\) p\.projectId = parts\[iAff \+ 1\];/.test(achat), 'un achat ouvert depuis une affaire ne lui est pas rattaché');
    const fiche = app.slice(app.indexOf('routes.affaire = (parts) =>'), app.indexOf('const employeeById = id =>'));
    assert.ok(fiche.length > 2000 && fiche.length < 12000, 'tranche de la fiche d\'affaire introuvable (' + fiche.length + ')');
    assert.ok(/#p-devis'\)\.onclick = \(\) => navigate\('#\/doc\/new\/devis'[^;]*'\/affaire\/' \+ p\.id\)/.test(fiche), '« + Devis » ne passe pas l\'affaire');
    assert.ok(/#p-achat'\)\.onclick = \(\) => navigate\('#\/achat\/new\/-\/facture\/-\/affaire\/' \+ p\.id\)/.test(fiche), '« + Achat » ne passe pas l\'affaire');
    // La fiche montre TOUT ce qui est rattaché, brouillons compris (le devis créé depuis elle disparaissait).
    assert.ok(/const sales = data\.documents\.filter\(d => d\.projectId === p\.id\)/.test(fiche), 'la fiche ne montre que les pièces émises : le devis qu\'on vient de créer y est invisible');
    // Un seul vert, et c'est l'étape suivante — calculée (U-11).
    assert.ok(/const suivante = sansVente \? \(ventesLibres \? 'rattacher-ventes' : 'devis'\) : 'achat';/.test(fiche), 'l\'étape suivante de la fiche n\'est plus calculée');
    assert.ok(!/class="btn btn-primary" id="p-(achat|devis)"/.test(fiche), 'un bouton de l\'en-tête est vert en dur');
    // Une marge sans aucun achat rattaché n'est pas une bonne nouvelle : elle n'est pas encore comptée.
    assert.ok(/m\.margin > 0 && !margeSansAchat\(m\) \? 'ok' : ''/.test(fiche), 'la marge d\'une affaire sans achat s\'affiche en vert');
    // Et les deux autres écrans qui la montrent le disent par la MÊME règle.
    const liste = app.slice(app.indexOf('function drawProjects()'), app.indexOf('function drawAnalysis()'));
    assert.ok(/margeSansAchat\(p\) \? NOTE_SANS_ACHAT/.test(liste) && /margeSansAchat\(p\) \? '<span class="muted"/.test(lireSource('src', 'renderer', 'app.js')), 'la liste des affaires montre « 100 % » pour une affaire sans achat');
    const cl = app.slice(app.indexOf('routes.client = (parts) =>'), app.indexOf('routes.client = (parts) =>') + 12000);
    assert.ok(/margeSansAchat\(x\) \? NOTE_SANS_ACHAT/.test(cl), 'la fiche client montre la marge d\'une affaire sans achat sans le dire');
  });
  t('Rattacher des pièces existantes : l\'avoir suit sa facture, décocher détache, et le geste s\'annule', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = app.slice(app.indexOf('function rattacherPieces('), app.indexOf('routes.affaire = (parts) =>'));
    assert.ok(f.length > 1500 && f.length < 9000, 'tranche rattacherPieces introuvable (' + f.length + ')');
    assert.ok(/x\.type === 'avoir' && x\.creditOf \? x\.creditOf/.test(f) && /tr\.dataset\.suit === id/.test(f), 'l\'avoir ne suit plus la facture qu\'il corrige');
    assert.ok(/if \(oui\) x\.projectId = p\.id; else delete x\.projectId;/.test(f), 'décocher ne détache pas la pièce');
    assert.ok(/toastUndo\(/.test(f), 'le rattachement ne laisse pas d\'« Annuler »');
    assert.ok(/visibles\(\)\.forEach\(tr => poser\(/.test(f), 'la case d\'en-tête coche autre chose que les pièces affichées');
    // Les pièces proposées : ventes du client de l'affaire, jamais une pièce annulée.
    const d = vierge();
    const pieces = app.slice(app.indexOf('const piecesPourAffaire = '), app.indexOf('function rattacherPieces('));
    assert.ok(/d\.status !== 'annulée' && \(!p\.clientId \|\| d\.clientId === p\.clientId\)/.test(pieces), 'la fenêtre propose des pièces annulées ou d\'un autre client');
    assert.ok(d, 'jeu');
  });
  t('La page Marges vide propose de créer la première affaire, et la fiche d\'une affaire nomme son retour', () => {
    const app = code('src', 'renderer', 'app.js');
    const mg = app.slice(app.indexOf('routes.marges = () =>'), app.indexOf('const affaireDocState = '));
    assert.ok(/etatVide\('Ce que te rapporte chaque chantier'[\s\S]{0,700}\['proj-first', '\+ Créer ma première affaire', true\]/.test(mg), 'l\'onglet Affaires vide ne porte plus son geste');
    assert.ok(/#proj-first'\)\.onclick = \(\) => projectForm\(null, p => navigate\('#\/affaire\/' \+ p\.id\)\)/.test(mg), 'la première affaire ne mène pas à sa fiche');
    // Le retour : « ← l'affaire » ne disait pas laquelle.
    const pl0 = app.indexOf('const pageLabel = ');
    const pg = app.slice(pl0, app.indexOf('return PAGE_LABELS[route]', pl0));
    for (const route of ['affaire', 'salarie', 'immo', 'article']) assert.ok(new RegExp(route + ': \\[data\\.').test(pg), 'le retour ne nomme pas la fiche : ' + route);
    assert.ok(/route === 'contrat'/.test(pg) && /route === 'achat'/.test(pg), 'le retour ne nomme pas le contrat ou l\'achat');
    // L'invite du nom d'affaire ne suppose pas le métier de l'auteur (le jumeau de l'Objet).
    const brut = lireSource('src', 'renderer', 'app.js');
    const invites = brut.match(/placeholder="[^"$]*"/g) || [];
    assert.ok(invites.length > 40, 'invites lues : ' + invites.length);
    for (const i of invites) assert.ok(!/serveur|réseau|cyber|Lauriers|Clinique|disques|supervision/i.test(i), 'une invite suppose le métier de l\'auteur : ' + i);
  });
  // 10.12.0 — quitter un achat neuf sans l'enregistrer laissait « ← l'achat » sur la page suivante,
  // et le retour rouvrait un achat VIERGE. Une page de création n'entre jamais dans la pile.
  t('Une page de création abandonnée n\'entre pas dans la pile du retour', () => {
    const app = code('src', 'renderer', 'app.js');
    const ph = app.slice(app.indexOf('function pushHistory(previous)'), app.indexOf('function pushHistory(previous)') + 600);
    const m = ph.match(/if \(\/([^\n]*?)\/([a-z]*)\.test\(previous \|\| ''\)\) return;/);
    assert.ok(m, 'pushHistory empile encore les pages de création');
    const re = new RegExp(m[1], m[2]);
    for (const h of ['#/doc/new/devis', '#/doc/new/devis/client/c1/affaire/p1', '#/achat/new', '#/achat/new/-/facture/-/affaire/p1']) assert.ok(re.test(h), 'page de création empilée : ' + h);
    for (const h of ['#/doc/abc', '#/achats', '#/client/x', '#/affaire/newton']) assert.ok(!re.test(h), 'une vraie page ne s\'empile plus : ' + h);
  });
  // 10.12.0 — la fenêtre du modèle de liasse du Cabinet retombait à 860 px et cachait 25 px de
  // colonnes : la règle partagée qui élargit les fenêtres à tableau pesait (0,2,1) et écrasait sa
  // largeur voulue (`.modal.cab-large`, 1 240 px). La règle générale ne bat jamais une exception.
  t('La largeur des fenêtres à tableau ne bat pas la largeur qu\'une fenêtre demande', () => {
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/^\.modal:has\(/m.test(css), 'une règle `.modal:has(…)` pèse plus lourd qu\'une classe de largeur');
    assert.ok(/^\.modal:where\(:has\(table\.mini, table\.lines-edit, table\.list\)\) \{ width: 860px; \}/m.test(css), 'les fenêtres à tableau ne s\'élargissent plus');
    const cab = lireSource('src', 'cabinet', 'renderer', 'cabinet.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(/^\.modal\.cab-large \{ width: 1240px; \}/m.test(cab) && /^\.modal\.cab-moyen \{ width: 880px; \}/m.test(cab), 'les largeurs voulues du Cabinet ne sont plus trouvées');
  });
  // 10.12.0 — l'onglet Contrats de Marges disait « aucun contrat n'a produit de facture » à une
  // menuiserie qui avait un contrat ET son premier brouillon : on croyait que le contrat n'avait pas
  // tourné. Un état vide dit SA raison (E-06), et mène là où le geste se fait.
  t('Marges → Contrats vide dit pourquoi, selon qu\'il existe un contrat ou un brouillon', () => {
    const brut = lireSource('src', 'renderer', 'app.js');
    const m = brut.match(/const videContrats = (\(\) => \{[\s\S]*?\n {4}\});/);
    assert.ok(m, 'videContrats introuvable');
    const pl = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');
    const dire = data => require('vm').runInNewContext('(' + m[1] + ')()', { data, pl });
    const rien = dire({ recurring: [], documents: [] });
    assert.ok(/Aucun contrat récurrent/.test(rien), 'sans contrat : ' + rien);
    const sansBrouillon = dire({ recurring: [{ id: 'r1' }], documents: [] });
    assert.ok(/n'ont encore produit aucune facture émise/.test(sansBrouillon) && !/brouillon/.test(sansBrouillon), 'un contrat sans pièce : ' + sansBrouillon);
    const avecBrouillon = dire({ recurring: [{ id: 'r1' }], documents: [{ recurringId: 'r1', status: 'brouillon' }, { recurringId: 'r1', status: 'brouillon' }, { status: 'brouillon' }] });
    assert.ok(/seulement 2 brouillons/.test(avecBrouillon), 'un contrat qui a produit des brouillons ne le dit pas : ' + avecBrouillon);
    const app = code('src', 'renderer', 'app.js');
    const dc = app.slice(app.indexOf('function drawContracts()'), app.indexOf('function drawBreakEven()'));
    assert.ok(dc.length > 500 && dc.length < 4000, 'tranche drawContracts (' + dc.length + ')');
    assert.ok(/<div class="empty">\$\{videContrats\(\)\}/.test(dc), 'l\'état vide des contrats ne dit plus sa raison');
    assert.ok(/#mg-vers-contrats'\)\.onclick = \(\) => navigate\('#\/contrats'\)/.test(dc) && /id="mg-vers-contrats"/.test(dc), 'l\'état vide ne mène plus à la facturation récurrente');
  });
  // 10.12.0 — la note « ≈ » s'affichait sous un tableau où AUCUNE ligne ne portait le repère : une
  // légende qui renvoie à une marque absente est une phrase que rien ne tient (7.3.0).
  t('Marges → Analyse : la légende du « ≈ » ne s\'affiche que si une ligne le porte', () => {
    const app = code('src', 'renderer', 'app.js');
    const an = app.slice(app.indexOf('function drawAnalysis()'), app.indexOf('const videContrats = '));
    assert.ok(an.length > 1000 && an.length < 6000, 'tranche drawAnalysis (' + an.length + ')');
    const at = an.indexOf('Le repère « ≈ »');
    assert.ok(at > 0, 'la légende du repère a disparu');
    assert.ok(/\$\{incomplete \? '<p [^']*>$/.test(an.slice(Math.max(0, at - 60), at)), 'la légende du « ≈ » s\'affiche même quand aucune ligne ne le porte');
  });
  // 10.12.0 (U-11) — « + Nouvelle affaire » restait vert sur Analyse, Contrats et Seuil, où il n'est
  // l'étape suivante de rien, et doublait le vert de l'état vide sur un onglet Affaires vide.
  t('Marges : « + Nouvelle affaire » n\'est vert que sur l\'onglet Affaires, et seulement s\'il en existe', () => {
    const app = code('src', 'renderer', 'app.js');
    const m = app.match(/\$\('#new-proj'\)\.classList\.toggle\('btn-primary', ([^;]+)\);/);
    assert.ok(m, 'le vert de « + Nouvelle affaire » ne se calcule plus');
    const vert = (tab, n) => require('vm').runInNewContext('(' + m[1] + ')', { s: { tab }, C: { projectList: () => new Array(n).fill({}) }, data: {}, company: () => ({}) });
    assert.strictEqual(vert('affaires', 2), true, 'Affaires avec des affaires : le geste suivant est d\'en créer une');
    assert.strictEqual(vert('affaires', 0), false, 'Affaires vide : deux verts pour le même geste');
    for (const tab of ['analyse', 'contrats', 'seuil']) assert.strictEqual(vert(tab, 3), false, 'vert sur l\'onglet ' + tab);
    const mg = app.slice(app.indexOf('routes.marges = () =>'), app.indexOf('const affaireDocState = '));
    const dr = mg.slice(mg.indexOf('const draw = () => {'), mg.indexOf('const draw = () => {') + 900);
    assert.ok(dr.indexOf("$('#new-proj').classList.toggle") > 0 && dr.indexOf("$('#new-proj').classList.toggle") < dr.indexOf('drawProjects()'), 'le vert se décide ailleurs qu\'au dessin de chaque onglet');
  });
  // 10.12.0 — la fenêtre qui rattache des achats montrait date, numéro, fournisseur : « BS-2026-0412,
  // Bois du Sahel » ne dit pas si ce sont les planches du chantier. Et une fois la dernière pièce
  // rattachée, le bouton disparaissait — plus aucune porte pour en DÉTACHER une depuis la fiche.
  t('Rattacher un achat se décide sur ce qu\'il contient, et la fiche garde la porte pour détacher', () => {
    const brut = lireSource('src', 'renderer', 'app.js');
    const m = brut.match(/const contenuAchat = (x => \{[\s\S]*?\n {2}\});/);
    assert.ok(m, 'contenuAchat introuvable');
    const pl = (n, mot) => n + ' ' + (n > 1 ? mot.split(' ').map(w => w + 's').join(' ') : mot);
    const contenu = require('vm').runInNewContext('(' + m[1] + ')', { pl });
    assert.strictEqual(contenu({ subject: 'Bois de la réception', lines: [{ label: 'Planche' }] }), 'Bois de la réception', 'l\'objet saisi ne passe plus en premier');
    assert.strictEqual(contenu({ lines: [{ label: 'Planche chêne' }] }), 'Planche chêne');
    assert.strictEqual(contenu({ lines: [{ label: 'A' }, { label: ' ' }, { label: 'B' }, { label: 'C' }, { label: 'D' }] }), 'A, B + 2 autres lignes', 'les lignes ne se résument plus');
    assert.strictEqual(contenu({ lines: [] }), '', 'un achat vide invente un contenu');
    const app = code('src', 'renderer', 'app.js');
    const f = app.slice(app.indexOf('function rattacherPieces('), app.indexOf('routes.affaire = (parts) =>'));
    assert.ok(/label: 'Ce qui a été acheté', get: x => h\(contenuAchat\(x\)\)/.test(f), 'la fenêtre ne dit pas ce qui a été acheté');
    assert.ok(/supplierName\(x\.supplierId\)\} \$\{contenuAchat\(x\)\}`/.test(f), 'la recherche ne lit pas les lignes de l\'achat');
    const pc = app.slice(app.indexOf('function purchaseColumns('), app.indexOf('function purchaseColumns(') + 3000);
    assert.ok(/contenuAchat\(p\) \? `<div class="small muted">\$\{h\(contenuAchat\(p\)\)\}/.test(pc), 'la liste des achats ne dit ce qui a été acheté que si un objet a été saisi');
    const fiche = app.slice(app.indexOf('routes.affaire = (parts) =>'), app.indexOf('const employeeById = id =>'));
    assert.ok(/<div class="inline mt">\$\{geste\('p-att-v', ventesLibres \? /.test(fiche) && /<div class="inline mt">\$\{geste\('p-att-a', achatsLibres \? /.test(fiche), 'sous une liste pleine, la porte pour détacher disparaît avec la dernière pièce libre');
  });
  // 10.12.0 — une proforma envoyée ne proposait, dans son menu de ligne, que « Ouvrir », « PDF » et
  // « Email » : la facturer demandait d'ouvrir la pièce pour chercher « Transformer ▾ ». Et le bon
  // de livraison qu'on en tirait s'ouvrait sans AUCUN bouton en vert.
  t('Les autres pièces : leur suite est dans le menu de ligne, par UN chemin, et l\'éditeur la met en vert', () => {
    const app = code('src', 'renderer', 'app.js');
    // Un seul chemin de conversion, qui pose le garde-fou de licence AVANT de créer.
    assert.strictEqual((app.match(/C\.convertDoc\(/g) || []).length, 1, 'une conversion vit ailleurs que dans transformerPiece');
    const tp = app.slice(app.indexOf('function transformerPiece('), app.indexOf('function transformerPiece(') + 500);
    assert.ok(tp.indexOf("licenceBlock('Créer une pièce')") > 0 && tp.indexOf("licenceBlock('Créer une pièce')") < tp.indexOf('C.convertDoc('), 'une conversion crée une pièce sans le garde-fou de licence');
    assert.ok(/transformerPiece\(docById\(doc\.id\) \|\| doc, b\.dataset\.conv\)/.test(app), '« Transformer ▾ » de l\'éditeur ne passe plus par le chemin unique');
    // Le menu de ligne propose chaque suite de CONVERSIONS, ou la pièce déjà tirée.
    const bd = app.slice(app.indexOf('bindRowMenus(anchor ? $(anchor) : document'), app.indexOf('if (redraw) bindSort(document, redraw);'));
    assert.ok(bd.length > 1000 && bd.length < 9000, 'tranche du menu de ligne (' + bd.length + ')');
    assert.ok(/C\.EXTRA_TYPES\.includes\(d\.type\) && d\.number/.test(bd) && /C\.CONVERSIONS\[d\.type\]/.test(bd), 'le menu d\'une proforma ou d\'un bon ne propose pas sa suite');
    assert.ok(/C\.chaineDePieces\(data, d\)\.find\(x => x\.type === t/.test(bd) && /run: \(\) => transformerPiece\(d, t\)/.test(bd), 'le menu refabrique une pièce déjà établie pour cette vente, ou ne passe pas par le chemin unique');
    // L'étape suivante de l'éditeur, évaluée sur chaque cas.
    const brut = lireSource('src', 'renderer', 'app.js');
    const m = brut.match(/const suiteExtra = ([\s\S]*?: '');\n/);
    assert.ok(m, 'l\'étape suivante des autres pièces ne se calcule plus');
    const suite = (doc, o = {}) => require('vm').runInNewContext('(' + m[1] + ')', {
      isExtra: true, isNew: false, locked: false, envoiSuivant: false, doc,
      convertibles: o.conv || ['facture'], data: {}, C: { chaineDePieces: () => o.derivees || [] }, ...o.ctx });
    assert.strictEqual(suite({ type: 'livraison', status: 'brouillon', number: '' }), 'save', 'une pièce tirée d\'une autre, sans numéro : c\'est « Enregistrer » qui le lui donne');
    assert.strictEqual(suite({ type: 'livraison', status: 'brouillon', number: 'BL-1' }), 'pdf', 'un bon de livraison s\'imprime pour être signé');
    assert.strictEqual(suite({ type: 'proforma', status: 'envoyée', number: 'PRO-1' }), 'transform', 'une proforma envoyée se facture');
    assert.strictEqual(suite({ type: 'proforma', status: 'envoyée', number: 'PRO-1' }, { derivees: [{ type: 'facture', status: 'brouillon' }] }), '', 'une pièce déjà transformée se propose une seconde fois');
    assert.strictEqual(suite({ type: 'proforma', status: 'envoyée', number: 'PRO-1' }, { derivees: [{ type: 'facture', status: 'annulée' }, { type: 'devis', status: 'accepté' }] }), 'transform', 'une pièce annulée, ou le devis d\'origine, bloque la suite');
    assert.strictEqual(suite({ type: 'commande', status: 'annulée', number: 'BC-1' }), '', 'une pièce annulée propose une suite');
    assert.strictEqual(suite({ type: 'proforma', status: 'brouillon', number: 'PRO-1' }, { ctx: { envoiSuivant: true } }), '', 'deux verts : l\'envoi ET la suite');
    assert.strictEqual(suite({ type: 'devis', status: 'brouillon', number: 'DEV-1' }, { ctx: { isExtra: false } }), '', 'la règle déborde sur le devis');
    assert.ok(/suiteExtra === 'transform' \? ' btn-primary'/.test(brut) && /suiteExtra === 'pdf' \? ' btn-primary'/.test(brut) && /\|\| suiteExtra === 'save' \? 'btn-primary'/.test(brut), 'l\'étape calculée ne colore aucun bouton');
    assert.ok(/doc\.status === 'brouillon' && !!doc\.number/.test(brut), 'une pièce sans numéro propose de l\'envoyer');
  });
  // 10.12.0 — un bon de livraison tiré d'une proforma DÉJÀ facturée proposait « Facturer » : le menu
  // ne voyait que les enfants directs de la pièce, et le chantier se facturait deux fois.
  t('Une vente se lit en entier : la facture tirée de la proforma se voit depuis son bon de livraison', () => {
    const d = vierge();
    const doc = (id, type, extra) => ({ id, type, status: 'brouillon', number: id.toUpperCase(), clientId: 'c1', lines: [], ...extra });
    d.documents = [
      doc('dev1', 'devis', { status: 'accepté' }),
      doc('pro1', 'proforma', { fromDocId: 'dev1', status: 'envoyée' }),
      doc('fac1', 'facture', { fromDocId: 'pro1', number: '' }),
      doc('bl1', 'livraison', { fromDocId: 'pro1' }),
      doc('aco1', 'facture', { fromQuoteId: 'dev1', deposit: { quoteId: 'dev1', percent: 30 } }),
      doc('autre', 'facture', { fromDocId: 'ailleurs' })
    ];
    const ids = x => core.chaineDePieces(d, d.documents.find(y => y.id === x)).map(y => y.id).sort();
    assert.deepStrictEqual(ids('bl1'), ['aco1', 'dev1', 'fac1', 'pro1'], 'la chaîne du bon de livraison ne voit pas la facture de sa proforma');
    assert.deepStrictEqual(ids('fac1'), ['aco1', 'bl1', 'dev1', 'pro1']);
    assert.ok(!ids('dev1').includes('autre') && !ids('dev1').includes('dev1'), 'la chaîne déborde sur une autre vente, ou se contient elle-même');
    assert.deepStrictEqual(core.chaineDePieces(d, { type: 'devis' }), [], 'une pièce sans identifiant rend toute la base');
    // Une boucle (données corrompues) ne gèle pas l'écran.
    d.documents[0].fromDocId = 'bl1';
    assert.ok(ids('pro1').length >= 3, 'une chaîne en boucle ne rend plus rien');
  });
  // 10.12.0 — « Fixe ou variable ? » rangeait les catégories en deux colonnes selon leur état :
  // cocher « Assurances » l'envoyait dans l'autre colonne, « Honoraires » montait sous le curseur, et
  // le clic suivant au même endroit reclassait une charge qu'on n'avait pas visée.
  t('Seuil de rentabilité : reclasser une charge ne déplace aucune ligne', () => {
    const app = code('src', 'renderer', 'app.js');
    const be = app.slice(app.indexOf('function drawBreakEven()'), app.indexOf('const draw = () => {', app.indexOf('function drawBreakEven()')));
    assert.ok(be.length > 1500 && be.length < 9000, 'tranche drawBreakEven (' + be.length + ')');
    assert.ok(!/cats\.filter\(c => C\.isFixedCategory\(data, c\) === /.test(be), 'les catégories se rangent encore par état : elles changent de place au clic');
    assert.ok(/cats\.map\(\(c, i\) =>/.test(be) && /type="radio" name="fv-\$\{i\}" data-fix=/.test(be), 'chaque catégorie ne porte plus son choix sur sa ligne');
    assert.ok(/r\.value === 'fixe' \?/.test(be), 'le choix ne se lit plus sur le bouton choisi');
    assert.ok(/meme\.focus\(\)/.test(be), 'au clavier, le redessin perd le bouton qu\'on vient de choisir');
    // Et la page ne grandit pas quand la liste d'années paraît sur cet onglet.
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const ph = css.match(/^\.page-head \{[^}]*\}/m);
    assert.ok(ph && /min-height: 38px/.test(ph[0]), 'l\'en-tête prend la hauteur de son plus grand enfant : il grandit quand un champ paraît');
    assert.ok(/^\.choix2 input:checked \+ span \{[^}]*\}/m.test(css) && !/^\.choix2 input:checked \+ span \{[^}]*font-weight/m.test(css), 'le choix actif change la géométrie (gras) ou ne se voit pas');
  });
  // 10.12.0 — « Marges » finissait 12 px sous le bord de la barre : le rendu ramenait l'entrée dans
  // le champ, puis la barre était REDESSINÉE (licence relue), des compteurs paraissaient, une barre de
  // défilement naissait — et plus rien ne la ramenait. Chacun de ces gestes la ramène.
  t('L\'entrée allumée de la barre latérale reste visible après chaque geste qui déplace la barre', () => {
    const app = code('src', 'renderer', 'app.js');
    const corps = nom => {
      const i = app.indexOf('function ' + nom + '(');
      assert.ok(i > 0, nom + ' introuvable');
      const p = app.indexOf('{', i); let n = 0;
      for (let j = p; j < app.length; j++) { if (app[j] === '{') n++; else if (app[j] === '}' && --n === 0) return app.slice(p, j + 1); }
      return '';
    };
    const f = corps('montrerEntreeActive');
    assert.ok(/\$\('nav a\.active'\)/.test(f) && /scrollIntoView\(\{ block: 'nearest' \}\)/.test(f), 'montrerEntreeActive ne ramène plus l\'entrée allumée');
    for (const nom of ['ajusterNav', 'updateNavCounts', 'redessinerBarre', 'render']) {
      assert.ok(/\bmontrerEntreeActive\(\)/.test(corps(nom)), nom + ' déplace la barre sans ramener l\'entrée allumée');
    }
    // ajusterNav la ramène APRÈS avoir décidé de la barre de défilement (c'est elle qui décale).
    const an = corps('ajusterNav');
    assert.ok(an.indexOf('montrerEntreeActive()') > an.indexOf("toggle('deborde'"), 'l\'entrée est ramenée avant que la barre ne change de largeur');
    // Et quand la liste rétrécit sans que la fenêtre change (la pastille de l'essai qui arrive dans
    // le pied après le rendu) : c'est la BOÎTE de la liste qu'on observe.
    const ro = app.match(/new ResizeObserver\(([\s\S]{0,300}?)\)\.observe\(document\.getElementById\('nav'\)\)/);
    assert.ok(ro && /ajusterNav\(\)/.test(ro[1]), 'la barre qui rétrécit sous l\'effet du pied ne ramène plus l\'entrée allumée');
  });

  // ------------------------------------------------------------------ La menuiserie, lot 3
  // Les immobilisations, parcourues à la souris : un bien enregistré, sorti sans prix, remis à
  // l'actif, une machine achetée dont la fiche se crée depuis l'achat. Chaque test se prouve en
  // réintroduisant son défaut (règle 7.2.0).
  const corpsDe = (app, debut) => {
    const i = app.indexOf(debut);
    assert.ok(i >= 0, debut + ' introuvable');
    const p = app.indexOf('{', i); let n = 0;
    for (let j = p; j < app.length; j++) { if (app[j] === '{') n++; else if (app[j] === '}' && --n === 0) return app.slice(i, j + 1); }
    return '';
  };
  const plT = (n, un, plur) => `${n} ${n > 1 ? (plur || un + 's') : un}`;

  // « Matériel informatique » et 3 ans proposés d'office à une menuiserie qui enregistrait sa scie :
  // la famille se CHOISIT, et c'est elle qui propose la durée (3.5.0 : la durée est une décision).
  t('Une immobilisation neuve ne part sur aucune famille ni aucune durée, et le refus montre le champ', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function assetForm(');
    assert.ok(f.length > 2000 && f.length < 16000, 'tranche assetForm (' + f.length + ')');
    assert.ok(/category: '',/.test(f) && /years: '',/.test(f), 'la fiche neuve part encore sur une famille ou une durée que personne n\'a choisie');
    assert.ok(/<option value="" \$\{a\.category \? '' : 'selected'\}>— Choisis la famille —<\/option>/.test(f), 'la liste des familles ne commence plus par « Choisis »');
    assert.ok(!/Ordinateur portable/.test(f), 'l\'invite de la désignation porte encore le métier de l\'auteur');
    assert.ok(/refus\(champ\('category'\), 'Choisis la famille du bien/.test(f), 'une fiche sans famille passe, ou se refuse sans montrer le champ');
    assert.ok(!/toast\([^)]*true\)/.test(f.slice(f.indexOf("$('#ok', root).onclick"))), 'un refus de la fiche ne montre pas le champ (7.0.0)');
    // Choisir « — Choisis — » ne vide pas une durée déjà proposée.
    assert.ok(/if \(!yearsTouched && e\.target\.value\)/.test(f), 'revenir sur « Choisis la famille » efface la durée');
  });

  t('Immobilisations vides : un état qui dit à quoi sert la page, et rien au-dessus du vide', () => {
    const app = code('src', 'renderer', 'app.js');
    const r = corpsDe(app, 'routes.immos = ');
    const dt = corpsDe(r, 'function drawTable(');
    const vide = dt.indexOf('if (!data.assets.length)');
    assert.ok(vide > 0 && vide < dt.indexOf('<div class="stats">'), 'des cartes à zéro s\'affichent encore sans aucun bien');
    assert.ok(/etatVide\('Ce que tu gardes plusieurs années'/.test(dt), 'l\'état vide ne dit plus à quoi sert la page');
    assert.ok(/immo-premier', '\+ Enregistrer mon premier bien', true/.test(dt), 'l\'état vide ne porte plus son geste principal');
    const draw = r.slice(r.indexOf('const draw = () => {'));
    assert.ok(/\$\('#im-csv'\)\.hidden = s\.tab !== 'tableau' \|\| !data\.assets\.length/.test(draw), 'l\'export se propose sur rien');
    assert.ok(/years\.length < 2/.test(draw), 'une liste d\'une seule année s\'affiche encore');
    assert.ok(/classList\.toggle\('btn-primary', !!data\.assets\.length/.test(draw), 'deux verts pour le même geste (en-tête et état vide)');
  });

  // « 1 bien à l'actif » sous une carte dont le seul bien était sorti de l'actif.
  t('La carte « Valeur d\'acquisition » compte ce qui reste à l\'actif et ce qui en est sorti', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function biensAuBilan(');
    const dire = rows => require('vm').runInNewContext('(' + f.replace(/^function biensAuBilan/, 'function') + ')', { pl: plT })({ rows }, '2026');
    assert.strictEqual(dire([{ out: true }]), 'aucun bien à l\'actif au 31/12/2026 · 1 sorti en 2026');
    assert.strictEqual(dire([{ out: false }, { out: false }, { out: true }]), '2 biens à l\'actif au 31/12/2026 · 1 sorti en 2026');
    assert.strictEqual(dire([{ out: false }]), '1 bien à l\'actif au 31/12/2026');
    assert.ok(/biensAuBilan\(t, s\.year\)/.test(app), 'la carte ne lit plus biensAuBilan');
  });

  // « moins-value de 18 489,722 DT » en orange à l'ouverture, prix à son zéro par défaut ; et
  // « Vendu 0,000 DT » sur la fiche d'un bien mis au rebut.
  t('Sortir un bien : pas d\'alarme avant un prix, et « sans prix » n\'est pas « vendu 0 »', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function annonceSortie(');
    const C = { fmtDate: d => d, money: n => String(n) };
    const annonce = require('vm').runInNewContext('(' + f.replace(/^function annonceSortie/, 'function') + ')', { C });
    const r = { date: '2026-09-24', nbv: 18489.722, result: -18489.722 };
    const sansPrix = annonce(r, false, 'DT');
    assert.ok(/muted/.test(sansPrix) && !/warn-text|ok-text/.test(sansPrix), 'sans prix, la sortie crie déjà : ' + sansPrix);
    assert.ok(/Sans prix \(mis au rebut, volé\)/.test(sansPrix), 'sans prix, la phrase ne dit pas ce que la sortie deviendrait');
    const vente = annonce({ ...r, result: -3489.222 }, true, 'DT');
    assert.ok(/warn-text">moins-value de 3489\.222/.test(vente), 'avec un prix, la moins-value ne se colore plus : ' + vente);
    assert.ok(/ok-text">plus-value de 10/.test(annonce({ ...r, result: 10 }, true, 'DT')), 'la plus-value ne se lit plus');
    const df = corpsDe(app, 'function disposalForm(');
    assert.ok(/annonceSortie\(r, Number\(v\.amount\) > 0, cur\)/.test(df), 'un zéro tapé ou vide colore encore la sortie');
    assert.ok(/asset\.disposal \? \(d\.amount \|\| 0\) : ''/.test(df), 'le prix d\'une sortie neuve s\'ouvre encore sur un zéro que personne n\'a décidé');
    assert.ok(/String\(v\.amount\)\.trim\(\) === ''[\s\S]{0,400}'Oui, sans prix', false/.test(df), 'un prix laissé vide s\'enregistre sans question, ou la question est en rouge');
    assert.ok(/refus\(champ\('date'\)/.test(df) && !/toast\('Date de sortie invalide/.test(df), 'un refus de la sortie ne montre pas le champ');
    assert.ok(!/btn-danger" id="undo-dis"/.test(df) && /'Remettre à l\\'actif', false/.test(df), 'remettre un bien à l\'actif se présente comme un geste destructeur');
    const fiche = corpsDe(app, 'routes.immo = ');
    assert.ok(/dis\.price > 0\s*\?\s*`Vendu /.test(fiche) && /Sorti sans prix \(mis au rebut, volé\)/.test(fiche), 'la fiche écrit « Vendu 0,000 » d\'un bien mis au rebut');
    assert.ok(!/border-left:3px solid \$\{dis\.result < 0 \? 'var\(--danger\)'/.test(fiche), 'une sortie se lit encore comme une erreur (liseré rouge)');
  });

  t('La durée de détention se dit comme on la dit, et la TVA à reverser parle au bon temps', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function dureeDetenue(');
    const duree = require('vm').runInNewContext('(' + f.replace(/^function dureeDetenue/, 'function') + ')', { pl: plT });
    assert.strictEqual(duree(0), 'moins d\'un mois', 'une sortie le jour même « a duré 1 mois »');
    assert.strictEqual(duree(29), 'moins d\'un mois');
    assert.strictEqual(duree(45), '1 mois');
    assert.strictEqual(duree(400), '1 an et 1 mois');
    assert.strictEqual(duree(720), '2 ans');
    const i = app.indexOf('const vatWarning = ');
    const vw = app.slice(i, app.indexOf('};', i) + 2);
    const tva = require('vm').runInNewContext(vw.replace(/^const vatWarning = /, '(').replace(/;$/, ')'), { C: core, dureeDetenue: duree });
    const bien = { date: '2026-01-10' };
    assert.ok(/avant de conclure la vente/.test(tva(bien, '2026-06-10', { vente: true })), 'la question de la TVA ne se pose plus avant une vente');
    assert.ok(!/conclure la vente/.test(tva(bien, '2026-06-10', { vente: false })), 'un bien mis au rebut « conclut une vente »');
    const passe = tva(bien, '2026-06-10', { passe: true });
    assert.ok(/n'a été détenu/.test(passe) && !/conclure/.test(passe), 'la fiche d\'un bien déjà sorti parle au futur : ' + passe);
    assert.strictEqual(tva(bien, '2032-01-10'), '', 'au-delà de cinq ans, plus rien à reverser');
  });

  // Le moteur marquait « sorti » un bien amorti en 2022 et vendu en 2026, dès 2023.
  t('Un bien entièrement amorti n\'est « sorti » que l\'année de sa sortie', () => {
    const a = { id: 'x', date: '2020-01-01', amount: 1000, years: 3, category: 'informatique', disposal: { date: '2026-06-30', amount: 100 } };
    for (const y of [2023, 2024, 2025]) assert.strictEqual(core.assetYear(a, y).out, false, 'en ' + y + ', le bien est encore à l\'actif (vendu en 2026)');
    assert.strictEqual(core.assetYear(a, 2026).out, true);
    assert.strictEqual(core.assetYear(a, 2027).out, true);
  });

  t('Les sorties de l\'exercice : « sans prix » pour un rebut, et un total nul n\'est pas vert', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function drawDisposals(');
    assert.ok(/d\.price > 0 \? C\.money\(d\.price, cur\) : '<span class="muted">sans prix<\/span>'/.test(f), 'un bien mis au rebut affiche « 0,000 » comme prix obtenu');
    assert.ok(/gain \? `<b class="ok-text">/.test(f) && /loss \? `<b class="warn-text">/.test(f), 'un total nul de plus-values s\'affiche encore en vert');
  });

  // Deux boutons par ligne, dont un VERT sur chaque ligne ; et « Voir les biens à créer » qui quittait
  // un achat PAS ENCORE enregistré pour une liste où sa ligne n'était pas.
  t('À immobiliser : un geste par ligne, un seul vert, et l\'achat mène à la fiche du bien', () => {
    const app = code('src', 'renderer', 'app.js');
    const w = corpsDe(app, 'function drawWaiting(');
    const ligne = w.slice(w.indexOf('waiting.map('), w.indexOf(".join('')", w.indexOf('waiting.map(')));
    assert.strictEqual((ligne.match(/<button /g) || []).length, 1, 'une ligne porte encore plusieurs boutons (7.29.0)');
    assert.ok(/i === 0 \? ' btn-primary' : ''/.test(ligne), 'chaque ligne a son vert : autant de boutons principaux que de lignes (U-11)');
    assert.ok(/<tr class="clickable" data-open=/.test(ligne), 'la pièce d\'origine ne s\'ouvre plus en cliquant la ligne');
    assert.ok(/e\.stopPropagation\(\)/.test(w), 'le bouton de la ligne ouvre aussi la facture d\'achat');
    assert.ok(/s\.tab = 'tableau'/.test(w), 'la dernière fiche créée laisse sur « Rien en attente »');
    const b = app.slice(app.indexOf("if ($('#b-immo')) $('#b-immo').onclick"), app.indexOf("$$('[data-orph]', box)"));
    assert.ok(b.length > 200 && b.length < 2500, 'tranche du bouton de l\'achat (' + b.length + ')');
    assert.ok(b.indexOf('persist()') > 0 && b.indexOf('persist()') < b.indexOf('assetForm('), 'la fiche s\'ouvre sur un achat pas encore enregistré');
    assert.ok(/C\.assetsToCreate\(data\)\.filter\(w => w\.purchaseId === p\.id\)/.test(b), 'la fiche ne se préremplit plus depuis la ligne de CET achat');
    assert.ok(!/Voir les biens à créer/.test(app), 'le bouton de l\'achat renvoie encore vers une liste');
  });

  // La fiche enregistrée, l'achat répétait « ce montant n'est déduit nulle part » sous un bien qui
  // s'amortissait déjà.
  t('Une ligne d\'achat qui a sa fiche d\'immobilisation le dit, et n\'est plus réclamée', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('const fichesDeLAchat = ');
    assert.ok(i > 0, 'l\'achat ne cherche plus quelles lignes ont leur fiche');
    const z = app.slice(i, i + 3500);
    assert.ok(/const immos = lignesImmo\.filter\(\(\{ i \}\) => !fichesDeLAchat\.has\(i\)\)/.test(z), 'une ligne qui a sa fiche est encore réclamée');
    assert.ok(/a sa fiche : il s'amortit sur/.test(z) && /href="#\/immo\//.test(z), 'une ligne qui a sa fiche ne le dit pas, ou n\'y mène pas');
    // La même règle que assetsToCreate : l'achat ET le rang de la ligne.
    const d = vierge();
    d.purchases = [{ id: 'p1', supplierId: 's', date: '2026-09-24', lines: [
      { label: 'Scie', qty: 1, unitPrice: 100, destination: 'immobilisation' },
      { label: 'Aspirateur', qty: 1, unitPrice: 50, destination: 'immobilisation' }] }];
    d.assets = [{ id: 'a1', purchaseId: 'p1', lineIndex: 0 }];
    assert.deepStrictEqual(core.assetsToCreate(d).map(w => w.lineIndex), [1]);
  });

  // « + Nouveau fournisseur » sous « Felder Tunisie » introuvable ne disait pas que la fiche
  // arriverait déjà nommée.
  t('Le bouton de création d\'une liste nomme ce qu\'il va créer', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function bindCombo(');
    const dessin = f.slice(f.indexOf('const draw = () => {'), f.indexOf('const close = () =>'));
    assert.ok(/add\.textContent = saisi \? `\$\{o\.add\} «\\u00a0\$\{saisi\}\\u00a0»` : o\.add/.test(dessin), 'le bouton de création ne reprend pas ce qu\'on vient de taper');
  });

  // Taper le prix élargissait la colonne Total HT : toutes les colonnes glissaient de 10 px sous le
  // curseur, au moment où l'on vise la destination.
  t('Les grilles de lignes à colonnes fixes réservent la place du total', () => {
    const app = code('src', 'renderer', 'app.js');
    const tables = app.match(/<table class="lines-edit(?! lignes-doc)[^>]*><thead>[\s\S]*?<\/thead>/g) || [];
    const avecTotal = tables.filter(x => /Total HT/.test(x));
    assert.ok(avecTotal.length >= 3, 'grilles avec un total : ' + avecTotal.length);
    avecTotal.forEach(x => assert.ok(/<th class="r" style="width:\d+px">Total HT<\/th>/.test(x), 'la colonne du total suit son contenu : ' + x.slice(0, 80)));
  });
  // ------------------------------------------------------------ La menuiserie, lot 3 (la paie)
  // Congés, avances, documents, déclarations, registre et barèmes, parcourus à la souris.
  const sPlT = n => (Math.abs(Number(n)) > 1 ? 's' : '');

  // La fenêtre d'une absence annonçait le solde AVANT la demande, jamais celui d'après : « −3 » ne se
  // découvrait qu'une fois l'absence enregistrée.
  t('Une absence annonce le solde de congés avant ET après, et prévient d\'un solde négatif', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function soldeApresConge(');
    const C = { workingDays: () => 2, payrollSettings: () => ({ offDays: [0] }) };
    const solde = require('vm').runInNewContext('(' + f.replace(/^function soldeApresConge/, 'function') + ')', { C, data: {}, pct: n => String(n), sPl: sPlT });
    const neuf = solde(18, 3, null, { from: '2026-10-05' });
    assert.ok(/<b>18 jours<\/b> avant, <b>15 jours<\/b> après/.test(neuf) && !/warn-text/.test(neuf), 'une demande couverte : ' + neuf);
    const trop = solde(1, 4, null, { from: '2026-10-05' });
    assert.ok(/<b>-3 jours<\/b> après/.test(trop) && /warn-text">Il prendrait 3 jours de plus/.test(trop), 'un solde qui passe sous zéro ne prévient pas : ' + trop);
    // Modifier une absence déjà comptée : le moteur l'a déjà retranchée, « avant » la lui rend.
    const modif = solde(10, 2, { kind: 'conges', from: '2026-08-03', to: '2026-08-04' }, { from: '2026-08-03' });
    assert.ok(/<b>12 jours<\/b> avant, <b>10 jours<\/b> après/.test(modif), 'une absence modifiée est retranchée deux fois : ' + modif);
    assert.ok(/<b>10 jours<\/b> avant/.test(solde(10, 2, { kind: 'maladie', from: '2026-08-03', to: '2026-08-04' }, { from: '2026-08-03' })), 'un arrêt maladie est rendu au solde de congés');
    const lf = corpsDe(app, 'function leaveForm(');
    assert.ok(/soldeApresConge\(bal\.remaining, days, leave, v\)/.test(lf), 'la fenêtre n\'annonce plus le solde d\'après');
    assert.ok(/refus\(champ\('from'\)/.test(lf) && /refus\(champ\('to'\)/.test(lf), 'une absence sans date se refuse sans montrer le champ');
    assert.ok(!/toast\([^)]*true\)/.test(lf.slice(lf.indexOf("$('#ok', root).onclick"), lf.indexOf("$('#del-lv', root)"))), 'un refus de l\'absence part encore en bandeau');
  });

  // Deux « 0 » proposés d'office, l'explication en gras (classe d'un libellé), et un refus en bandeau.
  t('Une avance ne propose aucun montant, les dit obligatoires et refuse en montrant le champ', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function advanceForm(');
    assert.ok(/field\('<span>Montant avancé<\/span>', 'amount', a\.amount \|\| ''/.test(f), 'le montant d\'une avance neuve s\'ouvre sur un zéro que personne n\'a décidé');
    assert.ok(/'monthly', a\.monthly \|\| ''/.test(f), 'la retenue d\'une avance neuve s\'ouvre sur un zéro');
    assert.strictEqual((f.match(/replace\('class="field"', 'class="field obligatoire"'\)/g) || []).length, 2, 'les deux montants ne se disent pas obligatoires');
    assert.ok(/<div class="span-2 annonce-stable" id="af2-hint">/.test(f) && !/class="field span-2" id="af2-hint"/.test(f), 'l\'annonce de l\'avance est stylée comme un libellé, ou change de hauteur');
    assert.ok(/refus\(champ\('amount'\)/.test(f) && /refus\(champ\('monthly'\)/.test(f), 'une avance sans montant se refuse sans montrer le champ');
  });

  t('Les listes de la paie : les lignes s\'ouvrent au clic, et rien ne se compte au-dessus du vide', () => {
    const app = code('src', 'renderer', 'app.js');
    const lv = corpsDe(app, 'function drawLeaves(');
    assert.ok(/\$\{all\.length \? `<div class="filters"><span class="small muted">\$\{pl\(all\.length, 'enregistrement'\)\}/.test(lv), '« 0 enregistrement » au-dessus d\'une liste vide');
    assert.ok(/<tr class="clickable" data-lv=/.test(lv), 'une absence ne s\'ouvre plus en cliquant sa ligne');
    const lignesLv = lv.slice(lv.indexOf('all.map(l =>'), lv.indexOf(".join('')", lv.indexOf('all.map(l =>')));
    assert.ok(!/<button/.test(lignesLv), 'une absence garde un bouton « Modifier » au bout de sa ligne');
    const av = corpsDe(app, 'function drawAdvances(');
    assert.ok(/\$\{all\.length \? `<div class="filters">/.test(av), '« 0 en cours sur 0 » au-dessus d\'une liste vide');
    const lignesAv = av.slice(av.indexOf('all.map(a =>'), av.indexOf(".join('')", av.indexOf('all.map(a =>')));
    assert.ok(/<tr class="clickable[^"]*" data-av=/.test(lignesAv) && !/<button/.test(lignesAv), 'une avance ne s\'ouvre pas en cliquant sa ligne');
    assert.ok(!/row-warn/.test(lignesAv), 'une avance en cours se peint encore en orange, alors que c\'est son état normal');
    const reg = corpsDe(app, 'function drawRegister(');
    assert.ok(/<tr class="clickable\$\{r\.active \? '' : ' muted'\}" data-eid=/.test(reg), 'une ligne du registre ne mène pas à la fiche du salarié');
    assert.ok(/tr\[data-eid\]'\)\.forEach\(tr => tr\.onclick = \(\) => navigate\('#\/salarie\/'/.test(reg), 'la ligne du registre porte l\'attribut sans que le clic mène nulle part');
  });

  t('La fiche d\'un salarié : le document dans l\'identité, les bulletins et les avances s\'ouvrent', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'routes.salarie = ');
    const identite = f.slice(f.indexOf('<h2>Identité</h2>'), f.indexOf('<div class="split">'));
    assert.ok(/id="hr-doc">Établir un document…/.test(identite), '« Établir un document… » n\'est pas dans le panneau de l\'identité');
    assert.strictEqual((f.match(/id="hr-doc"/g) || []).length, 1, '« Établir un document… » vit à deux endroits de la fiche');
    const bulletins = f.slice(f.indexOf('slips.map(x =>'), f.indexOf(".join('')", f.indexOf('slips.map(x =>')));
    assert.ok(/<tr class="clickable [^"]*" data-ed=/.test(bulletins), 'un bulletin ne s\'ouvre pas en cliquant sa ligne');
    assert.strictEqual((bulletins.match(/<button /g) || []).length, 1, 'une ligne de bulletin garde plusieurs boutons (7.29.0)');
    assert.ok(/data-pdf[\s\S]{0,80}ev\.stopPropagation\(\)/.test(f), 'le PDF d\'un bulletin ouvre aussi le bulletin');
    assert.ok(/av\.map\(x => `<tr class="clickable" data-av=/.test(f) && /tr\[data-av\]'\)\.forEach\(b => b\.onclick = \(\) => advanceForm\(/.test(f), 'une avance de la fiche ne s\'ouvre pas');
  });

  // Un solde de congés négatif disparaissait du seul document où il compte ; et une panne de PDF
  // montrait le message brut.
  t('Le solde de tout compte dit un solde de congés négatif, et une panne se dit en français', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function hrDocForm(');
    assert.ok(/bal\.remaining < 0 \? `<p class="small warn-text mt">Il a pris/.test(f), 'un solde de congés négatif ne se dit pas sur le solde de tout compte');
    assert.ok(/catch \(err\) \{ toast\(plainError\(err\), true\)/.test(f), 'une panne du PDF montre le message brut (7.26.0)');
  });

  t('« −3 jours » : un nombre négatif s\'accorde comme son contraire, dans les quatre jumeaux', () => {
    const corps = [];
    for (const [fichier, motif] of [[['src', 'renderer', 'app.js'], /const pl = \(n, un, plur\) => (`[^`]*`);/],
      [['src', 'cabinet', 'renderer', 'app.js'], /const pl = \(n, un, plur\) => (`[^`]*`);/],
      [['src', 'renderer', 'core.js'], /const plFr = \(n, un, plur\) => (`[^`]*`);/],
      [['src', 'renderer', 'compta.js'], /const plFr = \(n, un, plur\) => (`[^`]*`);/]]) {
      const m = motif.exec(lireSource(...fichier));
      assert.ok(m, 'accord introuvable dans ' + fichier.join('/'));
      corps.push(m[1]);
    }
    assert.ok(corps.every(c => c === corps[0]), 'les quatre accords ont divergé');
    const pl = require('vm').runInNewContext('(n, un, plur) => ' + corps[0]);
    assert.strictEqual(pl(-3, 'jour'), '-3 jours', 'un nombre négatif s\'accorde au singulier');
    assert.strictEqual(pl(-1, 'jour'), '-1 jour');
    assert.strictEqual(pl(0, 'jour'), '0 jour');
    const s2 = /const sPl = n => \(([^;]*)\);/.exec(lireSource('src', 'renderer', 'app.js'));
    assert.ok(s2 && /Math\.abs/.test(s2[1]), 'sPl accorde encore « −3 jour »');
  });

  // « Solde de tout compte » faisait remonter la fenêtre de 196 px sous le curseur.
  t('Une fenêtre s\'ancre en haut : elle ne grandit que vers le bas', () => {
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const r = /\n\.modal-bg \{([^}]*)\}/.exec(css);
    assert.ok(r, '.modal-bg introuvable');
    assert.ok(/align-items: flex-start/.test(r[1]) && !/align-items: center/.test(r[1]), 'une fenêtre se recentre encore quand elle grandit (H-E1)');
  });

  t('La colonne de l\'impôt dit ce qu\'elle additionne', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function drawSlips(');
    assert.ok(/<th class="r">Impôt retenu \$\{info\('pay\.impot'\)\}<\/th>/.test(f), 'la colonne additionne IRPP et solidarité sous un nom qui n\'en dit qu\'un');
    assert.ok(/C\.round3\(x\.c\.irpp \+ x\.c\.css\)/.test(f), 'la colonne de l\'impôt n\'additionne plus IRPP et solidarité');
    assert.ok(/'pay\.impot': \{/.test(lireSource('src', 'renderer', 'guide.js')), 'la bulle de l\'impôt retenu n\'existe pas');
  });

  // « Marquer déposée » en vert sur le trimestre EN COURS : la déclaration serait figée sans ses
  // derniers bulletins.
  t('Une déclaration sociale se marque déposée une fois la période terminée', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function drawDeclarations(');
    const src = f.slice(f.indexOf('const finTrimestre = '), f.indexOf('const enCoursCnss'));
    const mk = today => require('vm').runInNewContext(`(() => { ${src}; return { finTrimestre, pasFini }; })()`,
      { C: { addDays: core.addDays, today: () => today, fmtDate: core.fmtDate } });
    const { finTrimestre, pasFini } = mk('2026-09-24');
    assert.strictEqual(finTrimestre(2026, 1), '2026-03-31');
    assert.strictEqual(finTrimestre(2026, 3), '2026-09-30');
    assert.strictEqual(finTrimestre(2026, 4), '2026-12-31');
    assert.ok(/se termine le 30\/09\/2026 : on le déclare une fois terminé/.test(pasFini('2026-09-30', 'Le 3e trimestre 2026', false)), 'le trimestre en cours se déclare comme un trimestre fini');
    assert.ok(/on la déclare une fois terminée/.test(pasFini('2026-12-31', 'L\'année 2026', true)), 'l\'année ne s\'accorde pas');
    assert.strictEqual(mk('2026-09-30').pasFini('2026-09-30', 'x', false), 'x se termine le 30/09/2026 : on le déclare une fois terminé, sinon il manquerait ses derniers bulletins.', 'le dernier jour du trimestre n\'est pas un trimestre terminé');
    assert.strictEqual(mk('2026-10-01').pasFini('2026-09-30', 'x', false), '', 'un trimestre terminé ne se déclare toujours pas');
    assert.ok(/enCoursCnss \? '' : 'btn-primary'/.test(f) && /\(raisonCnss\(y, q\) \|\| enCoursCnss\) && !filed/.test(f), 'le trimestre en cours se marque déposé en vert');
    assert.ok(/filed\('employeur-' \+ y\) \|\| enCoursAnnee \? '' : 'btn-primary'/.test(f) && /enCoursAnnee && !filed\('employeur-' \+ y\) \? ` disabled/.test(f), 'l\'année en cours se marque déposée en vert');
  });

  // Une tranche du barème ne se tapait pas : le formulaire redessinait les lignes à chaque frappe.
  t('Les barèmes : une tranche se tape, « Enregistrer » n\'apparaît qu\'après un changement, et on ne perd rien en changeant d\'onglet', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function drawRates(');
    const saisie = f.slice(f.indexOf("$('#rf').oninput"), f.indexOf("$('#add-br').onclick"));
    assert.ok(saisie.length > 50 && saisie.length < 900, 'tranche de la saisie (' + saisie.length + ')');
    assert.ok(!/drawRows\(|drawBrackets\(/.test(saisie), 'chaque frappe redessine les lignes du barème : le champ tapé est détruit');
    assert.ok(/brackets\[i\]\[el\.dataset\.b\] = Number\(el\.value\)/.test(saisie), 'la valeur tapée dans une tranche n\'est pas retenue pendant la frappe');
    assert.ok(/el\.value\.trim\(\) !== '' && !el\.validity\.badInput/.test(saisie), 'une tranche vidée pour retaper devient zéro (7.19.0)');
    assert.ok(/majDe\(\)/.test(saisie), 'la tranche suivante ne part pas de la nouvelle borne');
    assert.ok(/<div class="save-bar" id="rf-bar" hidden>/.test(f), '« Enregistrer les barèmes » est vert au repos (U-11), ou loin du premier taux');
    const horsBarre = f.replace(/<div class="save-bar" id="rf-bar" hidden>[\s\S]*?<\/div>/, '');
    assert.ok(!/btn-primary/.test(horsBarre), 'un bouton vert au repos sur les barèmes');
    assert.ok(/setGuard\(garde\)/.test(f) && /dirty: \(\) => modifie/.test(f), 'quitter les barèmes modifiés ne pose aucune question');
    assert.ok(/Plafond annuel des frais \(\$\{h\(cur\)\}\)/.test(f) && /Déduction chef de famille \(\$\{h\(cur\)\} par an\)/.test(f), 'un montant ne dit pas son unité (9.4.8)');
    assert.ok(/'Revenir aux valeurs livrées', true\)/.test(f), 'revenir aux valeurs livrées se confirme par « Confirmer »');
    const onglets = app.slice(app.indexOf("$$('#p-tabs button').forEach(b => b.onclick"), app.indexOf("$$('#p-tabs button').forEach(b => b.onclick") + 400);
    assert.ok(/if \(!await leaveOk\(\)\) return;[\s\S]{0,40}clearGuard\(\)/.test(onglets), 'changer d\'onglet jette les barèmes modifiés sans rien demander');
  });
  // ------------------------------------------------------------ La menuiserie, lot 4 (compta)
  // La clôture, le paquet, la TVA, le calendrier fiscal, parcourus à la souris.

  // Deux pense-bêtes pour la même déclaration CNSS : l'occurrence du calendrier et la déclaration
  // de la Paie. Pointer l'un laissait l'autre crier, et le calendrier acceptait un trimestre en cours.
  t('Une échéance du calendrier désigne la déclaration sociale qu\'elle rappelle, et une seule mention vaut pour les deux écrans', () => {
    assert.deepStrictEqual(core.echeanceSociale('cnss', '2026-10-15'), { id: 'cnss-2026-T3', fin: '2026-09-30' });
    assert.deepStrictEqual(core.echeanceSociale('cnss', '2027-01-15'), { id: 'cnss-2026-T4', fin: '2026-12-31' });
    assert.deepStrictEqual(core.echeanceSociale('cnss', '2026-04-15'), { id: 'cnss-2026-T1', fin: '2026-03-31' });
    assert.deepStrictEqual(core.echeanceSociale('employeur', '2027-04-30'), { id: 'employeur-2026', fin: '2026-12-31' });
    assert.strictEqual(core.echeanceSociale('tva', '2026-10-28'), null, 'une échéance fiscale sans déclaration sociale en désigne une');
    const d = vierge();
    d.employees = [{ id: 'e1', name: 'Hichem', grossSalary: 1200, hireDate: '2026-07-01' }];
    const cnss = up => up.find(x => x.id === 'cnss');
    // Le 24 septembre : la CNSS du 3e trimestre tombe le 15 octobre, et le trimestre n'est pas fini.
    const avant = cnss(core.upcomingFiscal(d, '2026-09-24', 60));
    assert.ok(avant && avant.date === '2026-10-15' && avant.socialId === 'cnss-2026-T3', 'l\'échéance CNSS ne désigne pas le 3e trimestre');
    assert.strictEqual(avant.enCours, true, 'le calendrier propose de déposer un trimestre en cours');
    assert.strictEqual(cnss(core.upcomingFiscal(d, '2026-10-02', 60)).enCours, false, 'un trimestre terminé reste « en cours »');
    // Pointée dans la PAIE, l'échéance quitte aussi le calendrier.
    d.socialFilings = [{ id: 'cnss-2026-T3', filedAt: '2026-10-05', label: 'CNSS' }];
    const apres = cnss(core.upcomingFiscal(d, '2026-10-02', 120));
    assert.ok(!apres || apres.date !== '2026-10-15', 'une CNSS déposée dans la Paie crie encore dans le calendrier');
    // Une mention d'avant la 10.12.0, posée dans le calendrier, vaut encore pour la Paie.
    d.socialFilings = []; d.fiscalFilings = [{ id: 'cnss@2026-10-15', at: 1 }];
    assert.ok(core.socialesDeposees(d).has('cnss-2026-T3'), 'une mention posée dans le calendrier est oubliée par la Paie');
  });

  t('« À faire » ne nomme pas deux fois la même déclaration sociale', () => {
    const app = code('src', 'renderer', 'core.js');
    const i = app.indexOf('const annoncees = new Set(soc.map(x => x.id));');
    assert.ok(i > 0, '« À faire » ne retient plus les déclarations déjà annoncées');
    assert.ok(/upcomingFiscal\(data, t, 14\)\.filter\(x => !\(x\.socialId && annoncees\.has\(x\.socialId\)\)\)/.test(app.slice(i, i + 300)), 'l\'échéance fiscale d\'une déclaration déjà annoncée est comptée une seconde fois');
  });

  t('Le calendrier fiscal : pas de « Marquer déposée » sur une période en cours, et la CNSS se pointe sur la déclaration de la Paie', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function drawFiscal(');
    assert.ok(/data-fsoc="\$\{h\(x\.socialId \|\| ''\)\}"/.test(f), 'le bouton ne sait pas quelle déclaration sociale il pointe');
    assert.ok(/\$\{x\.enCours \? ` disabled title="\$\{h\(attente\(x\)\)\}"` : ''\}/.test(f), 'une période en cours se marque déposée depuis le calendrier');
    assert.ok(/if \(soc\) data\.socialFilings = \(data\.socialFilings \|\| \[\]\)\.concat\(/.test(f), 'une CNSS pointée dans le calendrier écrit un second pense-bête');
    assert.ok(/if \(soc\) data\.socialFilings = \(data\.socialFilings \|\| \[\]\)\.filter\(/.test(f), '« Annuler » ne défait pas la mention de la Paie');
    assert.ok(/\.concat\(\(data\.socialFilings \|\| \[\]\)/.test(f), '« Déjà déposées » oublie ce qui a été pointé dans la Paie');
  });

  // « Rien n'est clôturé, donc rien à rouvrir » dans un cadre de 110 px, sous un État qui le disait.
  t('Les clôtures : pas de panneau « Rouvrir » sans rien à rouvrir, et un journal vide s\'annonce', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function drawClosures(');
    assert.ok(/\$\{closed \? `<div class="panel"><h2>Rouvrir/.test(f), 'le panneau « Rouvrir » s\'affiche sans rien à rouvrir');
    assert.ok(!/rien à rouvrir/.test(f), 'le panneau « Rouvrir » répète l\'État');
    assert.ok(/<div class="empty mini">Aucune clôture pour l\\?'instant/.test(f), 'le journal vide occupe un cadre de 110 px');
  });

  // Un mois sans pièce : un tableau de sept zéros et trois cartes à 0,000 DT au-dessus de « aucune pièce ».
  t('Le paquet d\'un mois vide ne compte rien au-dessus du vide, et le mois se choisit sans s\'étirer', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = corpsDe(app, 'function drawCabinet(');
    assert.ok(/\$\{moisVide \? '' : `<div class="dash-grid mt">/.test(f), 'un mois vide montre encore son tableau de zéros');
    assert.ok(/<div class="empty mini">Aucun paquet fabriqué/.test(f), 'l\'historique vide occupe un cadre de 110 px');
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(/\n\.inline > select \{ width: auto; \}/.test(css), 'un sélecteur dans une rangée s\'étire sur toute la ligne');
    assert.ok(/\n\.panel > \.empty\.mini \{ padding-inline: 0; \}/.test(css), 'une annonce dans un panneau est décalée de son titre');
  });

  // « OK », une explication en gras, un refus en bandeau qui fermait la fenêtre et perdait le taux tapé.
  t('La petite fenêtre de saisie : l\'explication se lit, le bouton dit le geste, un refus garde la fenêtre', () => {
    const app = code('src', 'renderer', 'app.js');
    // `corpsDe` s'arrêterait à l'accolade du paramètre par défaut (`o = {}`) : on borne sur la fonction
    // suivante — pas sur un commentaire, que `code()` retire (8.2.0).
    const i0 = app.indexOf('function promptDialog(');
    const f = app.slice(i0, app.indexOf('const templatesFor = type =>', i0));
    assert.ok(f.length > 400 && f.length < 3000, 'tranche promptDialog (' + f.length + ')');
    assert.ok(/const long = String\(label\)\.length > 48;/.test(f) && /\$\{long \? `<p class="small muted">\$\{h\(label\)\}<\/p>` : ''\}/.test(f), 'une explication longue s\'affiche encore comme un libellé en gras');
    assert.ok(/\$\{h\(o\.ok \|\| 'Valider'\)\}/.test(f) && !/>OK</.test(f), 'le bouton dit encore « OK »');
    assert.ok(/if \(!v\) return refus\(champ,/.test(f) && !/toast\('Valeur obligatoire/.test(f), 'une valeur vide part en bandeau sans montrer le champ');
    const go = f.slice(f.indexOf('const go = () =>'));
    assert.ok(go.indexOf('if (erreur) return refus(champ, erreur)') > 0 && go.indexOf('if (erreur) return refus(champ, erreur)') < go.indexOf('close(); done(v);'), 'une valeur refusée ferme la fenêtre avant de le dire');
    assert.ok(/'Autre taux de retenue'[\s\S]{0,700}valider: v =>/.test(app), '« Autre taux… » refuse après avoir fermé la fenêtre');
    assert.strictEqual((app.match(/v => \{ if \(v\) importer(?:Cloture|Questions)\(v\); \}, 'password'/g) || []).length, 2, 'un mot de passe de fichier se tape en clair');
    assert.ok(/Reporter un crédit de TVA de \$\{Number\(year\) - 1\}…/.test(app), 'le bouton du crédit reporté se lit comme une information, pas comme un geste');
  });
  // Le seul client qui avait payé figurait à la fois parmi les plus rapides et les plus lents.
  t('Qui paie vite, qui paie tard : un client n\'est jamais dans les deux colonnes', () => {
    const d = vierge();
    d.clients = ['A', 'B', 'C'].map(n => ({ id: n, name: n }));
    const fac = (id, cl, date, paye) => ({ id, type: 'facture', number: id, status: 'envoyée', clientId: cl, date,
      lines: [{ label: 'x', qty: 1, unitPrice: 100, vatRate: 0 }], stampApplied: false, payments: [{ date: paye, amount: 100 }] });
    d.documents = [fac('F1', 'A', '2026-09-01', '2026-09-03'), fac('F2', 'B', '2026-09-01', '2026-09-11'), fac('F3', 'C', '2026-09-01', '2026-09-21')];
    const soc = { ...société, stampFee: 0 };
    const r = core.payerRanking(d, soc, 5);
    assert.deepStrictEqual(r.tous.map(x => x.name), ['A', 'B', 'C']);
    const rap = r.rapides.map(x => x.name), lents = r.lents.map(x => x.name);
    assert.ok(!rap.some(n => lents.includes(n)), `un client dans les deux colonnes : ${rap} / ${lents}`);
    assert.deepStrictEqual(rap, ['A', 'B']);
    assert.deepStrictEqual(lents, ['C']);
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/payers\.tous\.length === 1 \? `<p>Un seul client a soldé une facture/.test(app), 'un seul payeur est encore classé en deux colonnes');
  });

  t('Le graphique des statistiques n\'annonce pas une année précédente vide', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/const anPrecedentVide = !seriesPrev\.some\(x => Number\(x\.ht\)\);/.test(app), 'l\'année précédente vide n\'est pas reconnue');
    assert.ok(/compareChart\(series, anPrecedentVide \? \[\] : seriesPrev\)/.test(app), 'une année précédente vide dessine encore ses barres à zéro');
    assert.ok(/\$\{anPrecedentVide \? '' : `<span><i style="background:#9aa7b4;opacity:\.6"><\/i>\$\{p\.year - 1\}<\/span>`\}/.test(app), 'la légende annonce une année précédente qui n\'a rien');
  });

  // « Le renseigner » ouvrait la fiche société EN HAUT : on cherchait la case parmi douze. Un renvoi
  // `panneau:champ` amène le panneau ET le curseur — et il ne peut viser qu'une case qui existe.
  t('Un renvoi vers un réglage vise une case qui existe, et y met le curseur', () => {
    const app = code('src', 'renderer', 'app.js');
    const reglages = app.slice(app.indexOf('routes.parametres = '), app.indexOf('routes.aide = '));
    assert.ok(reglages.length > 20000, 'tranche des Paramètres (' + reglages.length + ')');
    const cibles = [...app.matchAll(/['"](p-[a-z-]+):([a-zA-Z]+)['"]/g)].map(m => [m[1], m[2]]);
    assert.ok(cibles.length >= 2, 'aucun renvoi « panneau:champ » : ' + cibles.length);
    cibles.forEach(([pan, champ]) => {
      assert.ok(new RegExp(`'${pan}': \\{ onglet:`).test(app), `le renvoi vise un panneau qui n'existe pas : ${pan}`);
      assert.ok(new RegExp(`name="${champ}"|, '${champ}', `).test(reglages), `le renvoi vise une case qui n'existe pas : ${pan}:${champ}`);
    });
    assert.ok(/const amenerChamp = spec => \{[\s\S]{0,200}reg\.montrer\(vise\);[\s\S]{0,120}el\.focus\(\)/.test(reglages), 'le renvoi amène le panneau sans y mettre le curseur');
    assert.ok(/if \(settingsFocus\) \{ const spec = settingsFocus; settingsFocus = ''; amenerChamp\(spec\); \}/.test(reglages), 'un renvoi venu d\'une autre page ne passe pas par la même porte');
    assert.ok(/\$\$\('#pf \[data-vers-champ\]'\)\.forEach\(b => b\.onclick = \(\) => amenerChamp\(b\.dataset\.versChamp\)\)/.test(reglages), 'un renvoi d\'un panneau à l\'autre n\'est branché sur rien');
    assert.ok(/\$\('#cn-mat'\)\.onclick = e => \{ e\.preventDefault\(\); allerParametres\('societe', 'p-identite:cnss'\); \}/.test(app), '« Le renseigner » n\'est branché sur rien');
  });

  // Le matricule CNSS de l'entreprise manquait sans un mot sur la déclaration qui le demande.
  t('La déclaration CNSS dit ce qui lui manque AVANT ses boutons, et nomme qui', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('id="cn-csv"');
    const zone = app.slice(i - 3000, i);
    assert.ok(/\(company\(\)\.cnss \|\| ''\)\.trim\(\) \? '' : `<p class="small warn-text mt" id="cn-employeur">/.test(zone), 'le matricule CNSS de l\'entreprise manque sans un mot, ou se lit sous les boutons');
    assert.ok(/id="cn-sans-numero">[\s\S]{0,200}cn\.rows\.filter\(r => !r\.cnss\)\.map\(r => r\.name\)/.test(zone), 'le salarié sans numéro CNSS n\'est pas nommé, ou se lit sous les boutons');
    assert.ok(!/Un matricule CNSS manque sur une fiche/.test(app), '« une fiche » ne dit pas laquelle');
  });

  // « 0 » dans la case se lisait « un seuil de zéro dinar » : toutes les factures.
  t('Un réglage à zéro qui veut dire « aucun » s\'affiche vide, et porte son unité', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/lbl\(`Seuil de retenue à la source \(\$\{C\.normCurrency\(c\.currency\)\}\)`, 'doc\.withholdingThreshold'\), 'withholdingThreshold', Number\(c\.withholdingThreshold\) > 0 \? c\.withholdingThreshold : '', 'number', '[^']*placeholder="aucun seuil"'\)/.test(app), 'le seuil de retenue affiche « 0 » ou ne dit pas son unité');
    assert.ok(/'revenueTarget', Number\(c\.revenueTarget\) > 0 \? c\.revenueTarget : '', 'number', '[^']*placeholder="aucun objectif"'\)/.test(app), 'l\'objectif de chiffre d\'affaires affiche « 0 »');
    assert.ok(/data\.company\.withholdingThreshold = Math\.max\(0, Number\(data\.company\.withholdingThreshold\) \|\| 0\)/.test(app), 'une case vidée n\'est plus ramenée à « aucun seuil »');
    assert.ok(/data\.company\.revenueTarget = Math\.max\(0, Number\(data\.company\.revenueTarget\) \|\| 0\)/.test(app), 'une case vidée n\'est plus ramenée à « aucun objectif »');
    assert.ok(!/placeholder="60000"/.test(app), 'la fenêtre de l\'objectif propose un chiffre que personne n\'a décidé');
    const guide = lireSource('src', 'renderer', 'guide.js');
    assert.ok(!/Laisse 0 si tu n\\'en veux pas/.test(guide), 'la bulle dit encore « laisse 0 »');
  });

  // Données et sécurité : deux verts (copie externe, mot de passe) ; L'application : deux verts
  // (une clé vide à enregistrer, un problème à signaler alors que rien ne va mal).
  t('Un onglet des Paramètres n\'a qu\'un vert, et c\'est l\'étape suivante', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/'<button class="btn" id="sec-set">Activer un mot de passe…<\/button>'/.test(app), '« Activer un mot de passe » est vert d\'office, à côté de la copie externe');
    assert.ok(/const etapeMotDePasse = ok => \{[\s\S]{0,120}\$\('#ext-choose'\)\.classList\.toggle\('btn-primary', !ok\);[\s\S]{0,120}\$\('#sec-set'\)\.classList\.toggle\('btn-primary', ok\);/.test(app), 'le vert ne passe pas de la copie externe au mot de passe');
    assert.ok(/etapeMotDePasse\(!!i\.dir\)/.test(app), 'le vert ne suit pas la copie externe posée');
    const mdp = app.slice(app.indexOf("panneau('p-motdepasse'"), app.indexOf("panneau('p-motdepasse'") + 1800);
    assert.ok(mdp.indexOf('aucune récupération') > 0 && mdp.indexOf('aucune récupération') < mdp.indexOf('id="sec-set"'), '« aucune récupération » se lit sous le bouton qui l\'engage');
    assert.ok(/<button type="button" class="btn" id="lic-save">Enregistrer la clé<\/button>/.test(app), '« Enregistrer la clé » est vert sur une case vide');
    assert.ok(/const cleNouvelle = \(\) => \{ const v = \$\('#lic-key'\)\.value\.trim\(\); return !!v && v !== \(st\.key \|\| ''\); \};/.test(app), 'le vert ne dépend pas d\'une clé nouvelle');
    assert.ok(/\$\('#lic-save'\)\.classList\.toggle\('btn-primary', cleNouvelle\(\)\)/.test(app), '« Enregistrer la clé » ne s\'allume pas quand une clé est collée');
    assert.ok(/<button type="button" class="btn" id="set-support">Signaler un problème…<\/button>/.test(app), '« Signaler un problème » est vert au repos');
    const guide = lireSource('src', 'renderer', 'guide.js');
    assert.ok(/'lic\.cle': \{ t:/.test(guide) && /lbl\('Clé de licence', 'lic\.cle'\)/.test(app), 'la case de la clé n\'a pas de bulle');
  });

  // « Le premier bouton partage… le second » : la rangée en porte trois, et le premier crée un dossier.
  t('Une phrase qui désigne un bouton le nomme, et ce nom existe', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(!/Le premier bouton|Le second sert/.test(app), 'une phrase désigne encore les boutons par leur rang');
    const i = app.indexOf('id="dos-join"');
    const zone = app.slice(i - 400, i + 700);
    ['Partager ce dossier à deux', 'Rejoindre un dossier déjà partagé'].forEach(nom => {
      assert.ok(zone.includes('>↔ ' + nom + '…<') || zone.includes('>↓ ' + nom + '…<'), 'le bouton « ' + nom + ' » a changé de nom');
      assert.ok(zone.includes('<b>' + nom + '</b>'), 'la phrase ne nomme pas « ' + nom + ' »');
    });
  });

  // Le gras de l'étiquette passait à la phrase posée dans le champ : deux libellés à la suite.
  t('Une phrase posée dans un champ ne prend pas le gras de l\'étiquette', () => {
    const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(/\n\.field \{[^}]*font-weight: 600;/.test(css), 'l\'étiquette d\'un champ n\'est plus en gras');
    assert.ok(/\n\.field p \{ font-weight: 400; \}/.test(css), 'une phrase dans un champ se lit comme un second libellé');
    const app = code('src', 'renderer', 'app.js');
    assert.ok(!/<div class="field" id="mail-fixe">/.test(app), 'la phrase de l\'envoi des emails vit dans un champ qui répète le titre du panneau');
    assert.ok(/<p class="small muted" id="mail-fixe">/.test(app), 'la phrase de l\'envoi des emails a disparu');
  });

  // Une entreprise sans aucun article suivi par numéro lisait « aucune garantie ne se termine » — sous
  // un sélecteur de durée — et « Choisir une prestation à suivre » menait au Catalogue sans rien cocher.
  t('Les garanties et les numéros de série : dire à quoi ça sert, et le geste mène à la case cochée', () => {
    const app = code('src', 'renderer', 'app.js');
    const g = app.slice(app.indexOf('routes.garanties = '), app.indexOf('routes.garanties = ') + 4000);
    const vide = g.indexOf('if (!C.serializedItems(data).length) {');
    assert.ok(vide > 0 && vide < g.indexOf('Aucune garantie ne se termine'), 'une entreprise qui ne suit rien lit « aucune garantie ne se termine »');
    assert.ok(g.slice(vide, g.indexOf('return;', vide)).includes("etatVide('Aucun article suivi par numéro de série'"), 'la page vide ne dit pas à quoi elle sert');
    assert.ok(!g.slice(vide, g.indexOf('return;', vide)).includes('g-days'), 'un sélecteur de durée au-dessus du vide');
    assert.ok(!/\$\('#ser-pick'\)\.onclick = \(\) => navigate\('#\/catalogue'\)/.test(app), '« Choisir une prestation à suivre » mène encore au Catalogue');
    assert.strictEqual((app.match(/choisirArticleASuivre\(\(\) => render\(\)\)/g) || []).length, 2, 'Stock et Garanties ne partagent pas le même geste');
    const f = corpsDe(app, 'function catalogForm(');
    assert.ok(/const suit = \{ tracked: it\.tracked \|\| !!opts\.suivre, serialized: it\.serialized \|\| !!opts\.suivre \};/.test(f), 'la fiche ouverte pour suivre un article n\'arrive pas cochée');
    ['name="tracked" ${suit.tracked', 'name="serialized" ${suit.serialized', 'id="serial-block" ${suit.serialized', 'id="stock-block" ${suit.tracked']
      .forEach(x => assert.ok(f.includes(x), 'la fiche ne lit pas la proposition : ' + x));
    assert.ok(/catalogForm\(it, x => \{ if \(x && done\) done\(x\); \}, \{ suivre: true,/.test(app), 'le choix d\'un article n\'ouvre pas sa fiche cochée');
  });

  // Un cadre de 110 px pour dire « aucune opération diverse », sous un tableau d'écritures plein.
  t('L\'onglet Écritures annonce l\'absence d\'opération diverse sans la contempler', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/`<div class="empty mini">Aucune opération diverse sur cette période\./.test(app), 'l\'absence d\'opération diverse occupe un cadre d\'écran vide (9.4.7)');
  });

  // Un devis en euros, en anglais : « 1,200.00 » partout, et « 1 EUR = 3,350 DT » dans le cartouche.
  t('Une pièce en anglais écrit son taux de change comme le reste de ses montants', () => {
    const doc = { id: 'x', type: 'devis', number: 'DEV-2026-001', status: 'brouillon', date: '2026-09-24', dueDate: '2026-10-24',
      lang: 'en', currency: 'EUR', exchangeRate: 3.35, clientId: '', lines: [{ label: 'Kitchen cabinets', qty: 1, unitPrice: 1200, vatRate: 19 }] };
    const en = core.documentHtml(doc, null, société, {});
    assert.ok(/1 EUR = 3\.350 DT/.test(en), 'le taux d\'une pièce anglaise s\'écrit à la française : ' + (en.match(/1 EUR = [^<]*/) || [''])[0]);
    assert.ok(/1,200\.00/.test(en), 'le montant d\'une pièce anglaise n\'est plus au format anglais');
    const fr = core.documentHtml({ ...doc, lang: 'fr' }, null, société, {});
    assert.ok(/1 EUR = 3,350 DT/.test(fr), 'le taux d\'une pièce française ne s\'écrit plus à la française');
  });

  // Choisir « EUR » faisait naître le taux AVANT Statut et Remise : les deux sautaient d'une colonne.
  t('Le champ du taux naît en fin de formulaire : il ne pousse rien', () => {
    const app = code('src', 'renderer', 'app.js');
    const f = app.slice(app.indexOf('<label class="field">${lbl(\'Devise\', \'ed.docCurrency\')}'), app.indexOf('<div class="panel"><h2>Lignes ${info(\'ed.lines\')}'));
    assert.ok(f.length > 500 && f.length < 6000, 'tranche du formulaire (' + f.length + ')');
    const taux = f.indexOf('id="rate-field"');
    assert.ok(taux > 0, 'le champ du taux a disparu');
    assert.ok(taux > f.indexOf('${statusCell}') && taux > f.indexOf("'discountRate'") && taux > f.indexOf('name="hidePrices"'), 'le taux naît avant des champs qu\'il repousse');
    assert.ok(taux > f.lastIndexOf('name="applyStamp"'), 'le taux naît avant le timbre, qu\'il repousse');
    assert.strictEqual(f.slice(taux).indexOf('</form>') > 0 && !/<label|<div class="field/.test(f.slice(f.indexOf('</label>', taux), f.indexOf('</form>', taux))), true, 'un champ vit encore après le taux');
    assert.ok(!/placeholder="ex\. 3\.4"/.test(app), 'l\'invite du taux écrit un point là où la saisie attend une virgule (H-E28)');
  });
  // Un avoir fournisseur s'ouvrait sous « Nouvelle facture d'achat », demandait « Numéro de la facture »
  // et promettait de « récupérer la TVA » — un avoir en RETIRE. Ce que la pièce est se dit dans son
  // titre et ses libellés, à l'ouverture comme quand on change la nature.
  t('Un avoir fournisseur se dit avoir : titre, numéro, invite et phrase des lignes suivent la nature', () => {
    const brut = lireSource('src', 'renderer', 'app.js');
    const i = brut.indexOf('const motsDePiece = kind =>');
    const fin = brut.indexOf('};\n', i);
    assert.ok(i > 0 && fin > i && fin - i < 2500, 'tranche de motsDePiece (' + (fin - i) + ')');
    const mots = require('vm').runInNewContext('(' + brut.slice(i + 'const motsDePiece = '.length, fin + 1) + ')');
    const av = mots('avoir'), fa = mots('facture'), ac = mots('acompte'), de = mots('depense');
    assert.ok(/avoir/i.test(av.titre) && /avoir/i.test(av.numero) && /avoir/i.test(av.invite), 'un avoir se présente comme une facture : ' + JSON.stringify(av));
    assert.ok(/retire/.test(av.lignes) && !/permet de récupérer/.test(av.lignes), 'un avoir promet de récupérer la TVA');
    assert.ok(/facture d'achat/i.test(fa.titre) && /récupérer la TVA/.test(fa.lignes), 'la facture a perdu ses mots');
    assert.ok(/acompte/i.test(ac.titre) && /dépense/i.test(de.titre) && /justificatif/.test(de.numero), 'l\'acompte ou la dépense ont perdu leurs mots');
    const app = code('src', 'renderer', 'app.js');
    assert.ok(app.includes('<span id="b-titre">${h(motsDePiece(p.kind).titre)}</span>'), 'le titre d\'une pièce neuve ne vient pas de la nature');
    assert.ok(app.includes('<span id="b-num-lbl">${h(motsDePiece(p.kind).numero)}</span>') && app.includes('placeholder="${h(motsDePiece(p.kind).invite)}"'), 'le numéro ne vient pas de la nature');
    const k = app.indexOf("e.target.name === 'kind'");
    const change = app.slice(k, k + 900);
    ["$('#b-titre').textContent = mots.titre", "$('#b-num-lbl', head).textContent = mots.numero", "$('[name=number]', head).placeholder = mots.invite", "$('#b-lignes-hint').textContent = mots.lignes", "setWindowTitle('achat'"]
      .forEach(x => assert.ok(change.includes(x), 'changer la nature ne met pas à jour : ' + x));
    assert.ok(!/p\.kind !== 'depense'\) \{ \$\('#b-num-lbl'/.test(app), 'passer en dépense laisse « Numéro de la facture »');
  });

  // « Maintenance mensuelle — » sur la fiche client, dans la liste des marges et dans la question de
  // suppression : le tiret du gabarit « — {mois} {annee} » restait seul au bout, trois fois sur quatre.
  t('L\'objet d\'un contrat se dit sans le tiret de son gabarit, partout, par une seule fonction', () => {
    const brut = lireSource('src', 'renderer', 'app.js');
    const i = brut.indexOf('const objetDeContrat = r =>');
    const fin = brut.indexOf(';\n', i);
    const objet = require('vm').runInNewContext('(' + brut.slice(i + 'const objetDeContrat = '.length, fin) + ')', { C: core });
    assert.strictEqual(objet({ subject: 'Maintenance mensuelle — {mois} {annee}' }), 'Maintenance mensuelle', 'le tiret du gabarit reste au bout de l\'objet');
    assert.strictEqual(objet({ subject: 'Location — machine' }), 'Location — machine', 'un tiret au milieu de l\'objet est mangé');
    assert.strictEqual(objet({}), '', 'un contrat sans objet ne rend pas une chaîne vide');
    const app = code('src', 'renderer', 'app.js');
    const autres = (app.match(/fillTemplate\([^\n]*?\{ mois: '', annee: '' \}/g) || []).length;
    assert.strictEqual(autres, 1, 'l\'objet d\'un contrat se calcule encore à la main ailleurs (' + autres + ' fois)');
    assert.ok((app.match(/objetDeContrat\(r\)/g) || []).length >= 4, 'un écran ne passe plus par objetDeContrat');
  });

  // « dont 0,000 DT échu » au pied d'un relevé où rien n'est en retard : un zéro qui se lit comme une dette.
  t('Le pied d\'un relevé ne dit pas « dont 0,000 échu »', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(!/Total dû au \$\{C\.fmtDate\(r\.date\)\} — dont \$\{C\.money\(r\.echu, cur\)\} échu</.test(app), 'le pied du relevé annonce une part échue nulle');
    assert.ok(/r\.echu > 0\.0005 \? ` — dont \$\{C\.money\(r\.echu, cur\)\} échu` : ' — rien n\\'est encore échu'/.test(app), 'le pied du relevé ne dit plus ce qui est échu');
  });

  // L'introduction de l'Aide promettait « le ? en haut de chaque page » : ce bouton n'existe nulle part,
  // le lien s'appelle « Comprendre cette page ». Une phrase affichée que rien ne tient (7.3.0).
  t('L\'Aide nomme le lien d\'aide des pages par son vrai nom', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(!/le <b>\?<\/b> en haut de chaque page/.test(app), 'l\'Aide promet un « ? » qui n\'existe pas');
    assert.ok(/a\.textContent = 'Comprendre cette page →'/.test(app), 'le lien des pages a changé de nom');
    assert.ok(/«&nbsp;Comprendre cette page&nbsp;» en haut de chaque page/.test(app), 'l\'Aide ne nomme plus le lien des pages');
  });

  // « Taux : 1 EUR = ? DT » à l'ouverture et « 1 EUR = ? DT » après un changement de devise, dans un
  // éditeur ; l'autre écrivait l'inverse. Un libellé qui change en changeant de devise se lit comme un
  // autre champ : la même formule, dans les deux éditeurs, au dessin comme au changement.
  t('Le libellé du taux de change est le même au dessin et au changement, dans les deux éditeurs', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(app.includes('<span class="rate-lbl">1 ${h(cur)} = ? ${h(company().currency)}</span>'), 'le libellé du taux de la pièce a changé au dessin');
    assert.ok(app.includes("$('.rate-lbl', rf).textContent = `1 ${cur} = ? ${company().currency}`"), 'le libellé du taux de la pièce change au changement de devise');
    assert.ok(app.includes('<span class="b-rate-lbl">1 ${h(cur)} = ? ${h(company().currency)}</span>'), 'le libellé du taux de l\'achat a changé au dessin');
    assert.ok(app.includes("$('.b-rate-lbl', rf).textContent = `1 ${cur} = ? ${company().currency}`"), 'le libellé du taux de l\'achat change au changement de devise');
    assert.ok(!/Taux : 1 \$\{/.test(app), 'un des deux libellés porte encore « Taux : »');
  });
  // L'inventaire se redessinait à chaque chiffre : le champ recréé rendait son curseur au DÉBUT, et
  // « 28 » tapé devenait 82 — un écart de +52 planches prêt à être enregistré en mouvements. Puis la
  // règle de 10.12.0 (un champ de nombre sélectionne ce qu'il contient quand on y entre) a fait pire :
  // le focus rendu par le code sélectionnait le « 2 », et le « 8 » le remplaçait.
  t('Un comptage d\'inventaire se tape sans que le tableau se redessine sous les doigts', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf("$$('#st-body .inv-in').forEach(el => el.oninput = ");
    assert.ok(i > 0, 'le champ du comptage n\'a plus de gestionnaire de frappe');
    const gest = app.slice(i, app.indexOf('\n', i));
    assert.ok(!/drawInventory\(\)|draw\(\)/.test(gest), 'le comptage redessine le tableau à chaque chiffre : ' + gest.trim());
    assert.ok(/majInventaire\(\)/.test(gest), 'le comptage ne met plus à jour son écart');
    const maj = corpsDe(app, 'function majInventaire(');
    ['[data-ecart]', '[data-valeur]', '#inv-compte', '#inv-apply', '#inv-clear', '#inv-impact'].forEach(x =>
      assert.ok(maj.includes(x), 'la mise à jour du comptage oublie : ' + x));
    assert.ok(!maj.includes('innerHTML = `') || !/\$\('#st-body'\)\.innerHTML/.test(maj), 'la mise à jour du comptage redessine tout le panneau');
  });

  t('Un champ de nombre ne sélectionne son contenu que quand la PERSONNE y entre, jamais sur un focus rendu par le code', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/document\.addEventListener\('keydown', e => \{ entreeVoulue = e\.key === 'Tab'; \}, true\);/.test(app), 'une frappe ordinaire ne désarme pas la sélection');
    assert.ok(/document\.addEventListener\('pointerdown', \(\) => \{ entreeVoulue = true; \}, true\);/.test(app), 'un clic n\'arme plus la sélection');
    const f = app.indexOf("document.addEventListener('focusin', e => {");
    assert.ok(/!entreeVoulue\) return;/.test(app.slice(f, f + 200)), 'un focus rendu par le code sélectionne ce qui vient d\'être tapé');
  });

  // « -1 » en tiret dans la colonne Écart, à côté de « − 38,500 DT » avec le signe moins.
  t('Une quantité signée s\'écrit avec le même signe moins que les montants', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/const qteSignee = n => \(n > 0 \? '\+' : n < 0 \? '−' : ''\) \+ pct\(Math\.abs\(n\)\);/.test(app), 'le signe des quantités a changé');
    assert.ok(!/\$\{(m\.qty|r\.gap) > 0 \? '\+' : ''\}\$\{pct\(/.test(app), 'une quantité signée s\'écrit encore avec un tiret');
  });
  // On recopie le solde de son relevé et on attend : l'écran répétait « Saisis le solde de ton relevé
  // pour voir l'écart » sous un solde saisi, tant qu'on n'avait pas quitté la case.
  t('Le rapprochement répond pendant qu\'on recopie le solde du relevé, par la même phrase qu\'au dessin', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(/\$\('#stmt'\)\.oninput = e => \{/.test(app), 'le verdict du rapprochement attend qu\'on quitte la case');
    const i = app.indexOf("$('#stmt').oninput = e => {");
    assert.ok(/verdictReleve\(/.test(app.slice(i, i + 300)), 'la frappe écrit son propre verdict');
    assert.ok(app.includes('<span id="stmt-verdict">${verdictReleve(r.gap)}</span>'), 'le premier dessin écrit son propre verdict');
    assert.strictEqual((app.match(/Ça tombe juste\./g) || []).length, 1, 'le verdict du rapprochement s\'écrit à deux endroits');
    assert.ok(!/\$\('#stmt'\)\.oninput[^\n]*draw\(\)/.test(app), 'la frappe redessine le panneau et perd la case');
    // Le compte à rapprocher se choisissait dans une liste sans nom : claire à l'œil (le nom de la
    // banque), muette au clavier et pour un lecteur d'écran.
    assert.ok(/<select id="t-acc2" aria-label="[^"]+"/.test(app) && /<select id="t-acc" aria-label="[^"]+"/.test(app), 'le choix du compte n\'a pas de nom');
  });
  // « Tous les modules » et « Aide », au pied de la barre, en gris #4b5563 sur le fond sombre : 2,1 de
  // contraste. La couleur était recopiée des liens du menu, qui ont leur règle sombre depuis la 1.6.0 —
  // le pied, jamais. Une couleur de texte FONCÉE écrite en dur a sa jumelle sombre, pour chaque sélecteur.
  t('Toute couleur de texte foncée écrite en dur a sa jumelle en thème sombre (les deux applications)', () => {
    // `.print-only` est l'exception NOMMÉE : une page imprimée est toujours claire.
    const css = (lireSource('src', 'renderer', 'style.css') + '\n' + lireSource('src', 'cabinet', 'renderer', 'cabinet.css'))
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const regles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), corps: m[2] }));
    const sombre = regles.filter(r => r.sel.includes('body.dark')).map(r => r.sel).join(' , ');
    const lum = hx => {
      let x = hx.slice(1); if (x.length === 3) x = x.split('').map(c => c + c).join('');
      const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(parseInt(x.slice(0, 2), 16)) + 0.7152 * f(parseInt(x.slice(2, 4), 16)) + 0.0722 * f(parseInt(x.slice(4, 6), 16));
    };
    const vues = [], orphelins = [];
    regles.filter(r => !r.sel.includes('body.dark') && !r.sel.startsWith('@') && r.sel !== '.print-only').forEach(r => {
      const m = r.corps.match(/(?:^|[;\s])color:\s*(#[0-9a-fA-F]{3,6})\b/);
      if (!m || lum(m[1]) >= 0.25) return;
      vues.push(r.sel);
      if (!r.sel.split(',').map(x => x.trim()).some(x => sombre.includes(x))) orphelins.push(r.sel + ' (' + m[1] + ')');
    });
    assert.ok(vues.length >= 5, 'la sonde ne lit plus les couleurs de la feuille (' + vues.length + ')');
    assert.deepStrictEqual(orphelins, [], 'une couleur foncée sans jumelle sombre : ' + orphelins.join(' ; '));
  });
  // Corriger une lettre au milieu d'une recherche envoyait la suivante au bout du texte : quatre
  // recherches replaçaient le curseur à la fin après avoir redessiné leur liste. Le Cabinet avait la
  // parade depuis la 10.12.0 (`sansPerdreLaFrappe`) : le jumeau, corps identique.
  t('Une recherche qui redessine sa liste garde la place du curseur, par la même fonction dans les deux applications', () => {
    const app = code('src', 'renderer', 'app.js');
    assert.ok(!/setSelectionRange\([a-z]+\.value\.length, [a-z]+\.value\.length\)/.test(app), 'une recherche renvoie encore le curseur au bout du texte');
    const corps = (src) => { const i = src.indexOf('function sansPerdreLaFrappe('); return src.slice(i, src.indexOf('\n  }\n', i)); };
    const ent = corps(lireSource('src', 'renderer', 'app.js')), cab = corps(lireSource('src', 'cabinet', 'renderer', 'app.js'));
    assert.ok(ent.length > 150, 'l\'app entreprise n\'a plus sa fonction (' + ent.length + ')');
    assert.strictEqual(ent, cab, 'les deux applications ne gardent plus le curseur de la même façon');
    assert.ok((app.match(/sansPerdreLaFrappe\(e\.target, /g) || []).length >= 6, 'une recherche redessine sans rendre le curseur');
  });
  // Une alerte de stock portait DEUX boutons (« Ajuster », « Voir » — règle 7.29.0 : au plus un), et
  // « Ajuster » pour un stock négatif, que la règle 4.0.0 interdit d'ajuster : c'est un achat oublié.
  // Le geste est l'achat, et il naît avec la ligne de l'article (quantité à commander, coût, stock).
  t('Une alerte de stock mène à l\'achat, jamais à l\'ajustement d\'un stock négatif', () => {
    const app = code('src', 'renderer', 'app.js');
    const i = app.indexOf('function drawAlerts()');
    const f = app.slice(i, app.indexOf('function drawSerials()', i));
    assert.ok(f.length > 400 && f.length < 5000, 'tranche des alertes (' + f.length + ')');
    assert.ok(!/data-fix=/.test(f) && !/>Ajuster</.test(f), 'une alerte propose encore « Ajuster »');
    assert.ok(!/<button[^>]*data-see=/.test(f), 'une alerte porte un second bouton « Voir »');
    assert.ok(/tr class="clickable[^"]*" data-see=/.test(f), 'la ligne d\'une alerte n\'ouvre plus la fiche de l\'article');
    assert.ok(/r\.kind === 'negatif' \? 'Saisir l\\'achat oublié…' : 'Commander…'/.test(f), 'le bouton ne dit pas le geste selon l\'alerte');
    assert.ok(/navigate\(`#\/achat\/new\/-\/facture\/-\/article\//.test(f), 'le bouton ne mène pas à un achat de cet article');
    const r = app.slice(app.indexOf('routes.achat = '), app.indexOf('routes.achat = ') + 4000);
    assert.ok(/const iArt = parts\.indexOf\('article'\);/.test(r) && /destination: 'stock'/.test(r), 'l\'achat ne naît pas avec la ligne de l\'article');
  });
};
