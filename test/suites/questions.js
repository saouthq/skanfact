'use strict';
// ============================================================================================
// Une question dit ce qu'elle demande (10.14.0)
//
// Les quatre-vingt-sept questions de l'app entreprise s'intitulaient toutes « Confirmation » : on
// lisait le corps pour savoir si l'on supprimait un paiement ou si l'on quittait l'exemple. Le
// Cabinet titre chacune des siennes depuis toujours (le jumeau, 7.3.0). Le titre se déduit — une
// règle écrite appel par appel se serait perdue au quatre-vingt-huitième — et l'appelant qui sait
// mieux le donne.
module.exports = ({ t, assert }) => {
  const fs = require('fs');
  const path = require('path');
  const core = require('../../src/renderer/core.js');
  const app = fs.readFileSync(path.join(__dirname, '../../src/renderer/app.js'), 'utf8');

  t('10.14.0 : la question par laquelle le message commence devient le titre, et quitte le corps', () => {
    const r = core.titreQuestion('Supprimer le paiement de 50,000 DT du 01/03/2026 ? FAC-2026-001 redeviendra due.', 'Supprimer le paiement');
    assert.strictEqual(r.titre, 'Supprimer le paiement de 50,000 DT du 01/03/2026 ?');
    assert.strictEqual(r.corps, 'FAC-2026-001 redeviendra due.');
    const r2 = core.titreQuestion('Abandonner cette saisie ?\nCe que tu viens de taper ne sera pas enregistré.', 'Abandonner la saisie');
    assert.strictEqual(r2.titre, 'Abandonner cette saisie ?');
    assert.strictEqual(r2.corps, 'Ce que tu viens de taper ne sera pas enregistré.');
  });

  t('10.14.0 : un avertissement qui FINIT par une question n\'est pas un titre', () => {
    // La première phrase seulement : sinon tout le message monte dans le titre et le corps est vide.
    const r = core.titreQuestion('La date est dans le futur. Enregistrer quand même ?', 'Enregistrer quand même');
    assert.strictEqual(r.titre, 'Avant de continuer');
    assert.strictEqual(r.corps, 'La date est dans le futur. Enregistrer quand même ?');
  });

  t('10.14.0 : sinon le geste du bouton, sauf un geste qui ne dit rien (« Confirmer », « … quand même »)', () => {
    assert.strictEqual(core.titreQuestion('Ce devis a déjà donné FAC-2026-001.', 'Refacturer la totalité').titre, 'Refacturer la totalité ?');
    assert.strictEqual(core.titreQuestion('Importer remplacera tout.', 'Choisir le fichier à importer…').titre, 'Choisir le fichier à importer ?');
    for (const vide of ['', 'Confirmer', 'Continuer quand même', 'Créer quand même']) {
      assert.strictEqual(core.titreQuestion('Des mois sont clôturés.', vide).titre, 'Avant de continuer', vide);
    }
    // Une question trop longue pour un titre reste dans le corps.
    const longue = 'Marquer ' + 'x'.repeat(100) + ' ?';
    assert.strictEqual(core.titreQuestion(longue, 'Marquer').corps, longue);
  });

  t('10.14.0 : la boîte de question ne s\'intitule plus « Confirmation » — elle lit son titre', () => {
    const i = app.indexOf('function confirmDialog(');
    const f = app.slice(i, app.indexOf('\n  }\n', i));
    assert.ok(f.length > 300 && f.length < 3000, 'tranche confirmDialog : ' + f.length);
    assert.ok(!/<h2>Confirmation<\/h2>/.test(app), 'un titre « Confirmation » écrit en dur est revenu');
    assert.ok(/C\.titreQuestion\(msg, okLabel\)/.test(f), 'le titre se déduit du message et du geste');
    assert.ok(/opts && opts\.titre/.test(f), 'l\'appelant qui sait mieux peut donner le sien');
    assert.ok(/<h2>\$\{numerosInsecables\(h\(enTete\(q\.titre\)\)\)\}<\/h2>/.test(f), 'le titre est affiché, échappé, et un numéro de pièce ne s\'y coupe pas');
  });

  // « Émise » au lieu de « envoyée » : le LIBELLÉ change, jamais la valeur rangée dans les données.
  t('10.14.0 : une facture émise se dit « émise », une proforma envoyée reste « envoyée »', () => {
    assert.strictEqual(core.statusLabel('envoyée'), 'émise', 'sans type : une facture');
    assert.strictEqual(core.statusLabel('envoyée', 'facture'), 'émise');
    assert.strictEqual(core.statusLabel('envoyée', 'proforma'), 'envoyée', 'une proforma, c\'est l\'envoi qui la pose');
    assert.strictEqual(core.statusLabel('envoyé', 'devis'), 'envoyé', 'le devis garde son geste d\'envoi');
    assert.strictEqual(core.statusLabel('retard', 'facture'), 'en retard');
    // La donnée ne bouge pas : c'est toujours « envoyée » que l'émission range.
    assert.ok(core.STATUSES.facture.includes('envoyée'));
  });

  t('10.14.0 : les badges et les listes passent le TYPE de la pièce, et « Émis » ne double pas « Émise »', () => {
    assert.ok(/function statusBadge\(doc\) \{ return badge\(effStatus\(doc\), doc && doc\.type\); \}/.test(app), 'le badge d\'une pièce connaît son type');
    assert.ok(/optionStatut\(x, type\)/.test(app), 'la liste des autres pièces passe son type');
    assert.ok(/optionStatut\(st, doc\.type\)/.test(app), 'l\'éditeur passe le type');
    const i = app.indexOf('const FILTRES_REGROUPES');
    const zone = app.slice(i, i + 200);
    assert.ok(i > 0 && /'émis': 'Toutes les pièces émises'/.test(zone), 'le regroupement a son libellé');
    assert.ok(/FILTRES_REGROUPES\[x\] \|\| optionStatut\(x\)/.test(app), 'la liste des factures l\'utilise');
  });

  // H-E30 (10.14.0) — l'onglet vide renvoyait au menu « Transformer » d'une autre pièce, juste
  // au-dessus du bouton « Partir d'un devis existant » qui fait la même chose, ici.
  t('10.14.0 : un onglet vide ne renvoie pas ailleurs quand le geste « Partir d\'… » est sous les yeux', () => {
    const i = app.indexOf('const VIDE_AUTRES = {');
    const table = app.slice(i, app.indexOf('};', i));
    assert.ok(i > 0 && table.length > 300 && table.length < 3000, 'tranche VIDE_AUTRES : ' + table.length);
    const lignes = [...table.matchAll(/(\w+): \[('(?:[^'\\]|\\.)*'),\s*('(?:[^'\\]|\\.)*'),\s*('(?:[^'\\]|\\.)*')\]/g)];
    assert.strictEqual(lignes.length, 4, 'quatre onglets, trois phrases chacun');
    lignes.forEach(([, type, , avecBouton]) => {
      assert.ok(!/Transformer/.test(avecBouton), type + ' : la phrase posée à côté du bouton renvoie encore au menu « Transformer »');
    });
    assert.ok(/VIDE_AUTRES\[type\]\[aPartir \? 1 : 2\]/.test(app), 'la phrase suit la présence du bouton');
    assert.ok(/\.\.\.\(aPartir \? \[\['vide-depuis'/.test(app), 'le bouton et la phrase lisent la même condition');
  });

  // La barre de l'éditeur tient sur UNE rangée (10.14.0) : « Transformer ▾ » et « Email » n'y ont un
  // bouton que quand ils sont l'étape suivante ; sinon leurs entrées vivent dans « Plus ▾ ».
  t('10.14.0 : Transformer et Email ont un bouton quand ils sont l\'étape suivante, une entrée de « Plus ▾ » sinon', () => {
    assert.ok(/const convDansPlus = convertibles\.length > 0 && suiteExtra !== 'transform' && avecPlus;/.test(app), 'les conversions ne quittent la barre que si elles ne sont pas l\'étape suivante');
    assert.ok(/const transformMenu = convertibles\.length && !convDansPlus \?/.test(app), 'pas de bouton Transformer quand ses entrées sont dans Plus');
    assert.ok(/\$\{convDansPlus \? `<div class="ml-titre">Transformer en…<\/div>\$\{convBoutons\}/.test(app), 'les conversions sont en tête de « Plus ▾ », sous leur titre');
    assert.ok(/const emailDansPlus = \(isQ \|\| isExtra\) && !envoiSuivant && avecPlus;/.test(app), 'l\'envoi d\'un devis ou d\'une pièce annexe suit la même règle — jamais celui d\'une facture');
    assert.ok(/\$\{!isNew && !emailDansPlus \? `<button class="btn/.test(app), 'pas de bouton Email quand l\'envoi est dans Plus');
    assert.ok(/\$\{emailDansPlus \? `<button id="email">Envoyer par email…<\/button>`/.test(app), 'l\'entrée garde l\'identifiant que le gestionnaire lit');
    // Les entrées rangées dans Plus sont branchées comme celles du menu Transformer.
    assert.ok(/\$\$\('#conv-list button, #more-list \[data-conv\]'\)\.forEach/.test(app), 'les conversions de Plus sont branchées');
    // Et la feuille connaît les deux classes neuves (sinon le titre de section serait un bouton nu).
    const css = fs.readFileSync(path.join(__dirname, '../../src/renderer/style.css'), 'utf8');
    assert.ok(/\.more-list \.ml-titre \{/.test(css) && /\.more-list \.ml-sep \{/.test(css));
  });
  // « Clôturer jusqu'à… » clôturait plusieurs mois d'un coup sans montrer un seul contrôle, alors que
  // le bouton du mois suivant les montre (6.0.0 : les contrôles nomment, ils ne bloquent pas). Un
  // avertissement se lit AVANT le geste (9.4.2) — et sur toute la période choisie.
  t('10.14.0 : « Clôturer jusqu\'à… » montre les points à régler de TOUTE la période choisie, avant le geste', () => {
    const i = app.indexOf("if ($('#close-to')) $('#close-to').onclick");
    const f = app.slice(i, app.indexOf("if ($('#do-reopen'))", i));
    assert.ok(i > 0 && f.length > 600 && f.length < 4000, 'tranche close-to : ' + f.length);
    assert.ok(/C\.closureChecks\(data, company\(\), next\.from, to\)\.filter\(c => c\.level === 'danger'\)/.test(f), 'les contrôles portent du premier mois ouvert au mois choisi');
    assert.ok(/\$\('select\[name=m\]', root\)\.onchange = points;\s*points\(\);/.test(f), 'l\'annonce suit le mois choisi, et paraît dès l\'ouverture');
    assert.ok(f.indexOf('points();') < f.indexOf('C.closePeriod('), 'l\'annonce se pose avant que le geste soit possible');
    assert.ok(/id="ct-points" class="small annonce-stable encadre"/.test(f), 'l\'annonce réserve sa hauteur : le bouton ne bouge pas sous le curseur');
  });

  // Vu à la souris (10.14.0) : choisir « août 2026 » dans « Clôturer jusqu'à… » puis « Annuler »
  // demandait « Abandonner cette saisie ? Ce que tu viens de taper… » — rien n'avait été tapé.
  t('10.14.0 : choisir n\'est pas taper — une fenêtre de listes seules se referme sans demander, un champ tapé demande', () => {
    const vm = require('vm');
    const src = app.match(/function suivreSaisie\(layer\) \{[\s\S]*?\n  \}/)[0];
    const suivre = vm.runInNewContext('(' + src + ')');
    // Une fausse couche : `querySelector` ne trouve que ce qui répond au sélecteur « tapable ».
    // Elle LIT le sélecteur : un `:not(...)` retiré du code doit changer ce qu'elle rend.
    const repond = (sel, c) => sel.split(',').map(x => x.trim()).some(x => {
      if (x === 'textarea' || x === 'select') return c.tag === x;
      if (!x.startsWith('input') || c.tag !== 'input') return false;
      const exclus = [...x.matchAll(/:not\(([^)]*)\)/g)].map(m => m[1]);
      return !exclus.some(e => (e === '.combo-q' && c.cls === 'combo-q') || e === `[type=${c.type}]`);
    });
    const couche = champs => ({
      querySelector: sel => champs.find(c => repond(sel, c)) || null,
      querySelectorAll: sel => champs.filter(c => repond(sel, c))
    });
    const liste = { tag: 'select', type: 'select-one', value: '2026-06-30' };
    const g1 = suivre(couche([liste]));
    liste.value = '2026-08-31';
    assert.strictEqual(g1(), false, 'une liste changée n\'est pas une saisie à protéger');
    const recherche = { tag: 'input', type: 'text', cls: 'combo-q', value: '' };
    const g2 = suivre(couche([liste, recherche]));
    recherche.value = 'hôtel';
    assert.strictEqual(g2(), false, 'la recherche d\'une liste ne compte pas');
    const texte = { tag: 'input', type: 'text', value: '' };
    const g3 = suivre(couche([liste, texte]));
    texte.value = 'Menuiserie';
    assert.strictEqual(g3(), true, 'une frappe dans un champ se protège toujours');
    // Le jumeau du Cabinet a le même corps (test 10.12.0) — on le relit ici aussi.
    const cab = fs.readFileSync(path.join(__dirname, '../../src/cabinet/renderer/app.js'), 'utf8');
    assert.strictEqual(cab.match(/function suivreSaisie\(layer\) \{[\s\S]*?\n  \}/)[0], src, 'les deux applications ont le même garde-fou');
  });

  // La ponctuation double à la française, portée du Cabinet (9.4.2) à l'app entreprise : un « ? »
  // seul en début de ligne. Un OBSERVATEUR la pose partout — un appel oublié dans un des cent draw()
  // laisserait l'écran à moitié typographié — et jamais dans ce qui se saisit.
  t('10.14.0 : la prose de l\'app entreprise prend l\'espace fine insécable, jamais un texte qu\'on saisit', () => {
    const vm = require('vm');
    const pas = app.match(/const PAS_TYPO = ('[^']+');/);
    const noeud = app.match(/const typoNoeud = (n => \{[\s\S]*?\n  \});/);
    assert.ok(pas && noeud, 'PAS_TYPO et typoNoeud sont définis');
    const typoNoeud = vm.runInNewContext(`const PAS_TYPO = ${pas[1]}; (${noeud[1]})`, { C: core });
    const exclus = pas[1].slice(1, -1).split(',').map(x => x.trim());
    const n = (texte, parent) => ({ nodeValue: texte, parentElement: { closest: sel => (sel.split(',').map(x => x.trim()).includes(parent) ? {} : null) } });
    const prose = n('Tu es sûr ? Oui : « bien »', 'p');
    typoNoeud(prose);
    assert.strictEqual(prose.nodeValue, 'Tu es sûr ? Oui : « bien »', 'la prose prend l\'espace fine insécable');
    ['textarea', 'option', 'code'].forEach(tag => {
      assert.ok(exclus.includes(tag), tag + ' est exclu');
      const saisi = n('Note : à relire ?', tag);
      typoNoeud(saisi);
      assert.strictEqual(saisi.nodeValue, 'Note : à relire ?', tag + ' : ce qui se saisit ou se copie ne bouge pas');
    });
    // La règle est celle du moteur (C.typoFr), et l'observateur couvre tout le document.
    assert.ok(/C\.typoFr\(t\)/.test(noeud[1]), 'une seule règle : C.typoFr');
    assert.ok(/new MutationObserver\([\s\S]{0,300}typographie\(n\)[\s\S]{0,200}\.observe\(document\.body, \{ childList: true, subtree: true \}\)/.test(app), 'un observateur sur tout le document');
  });

  // Un matricule fiscal est un seul mot pour le navigateur : il imposait sa largeur à la colonne, et
  // à 1280 px la liste des clients débordait de trente pixels (saturation, 10.14.0).
  t('10.14.0 : un matricule fiscal se coupe après ses « / », dans les listes des clients et des fournisseurs', () => {
    const vm = require('vm');
    const m = app.match(/const mfCoupable = (mf => [^\n]+);/);
    assert.ok(m, 'mfCoupable est définie');
    const h = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const f = vm.runInNewContext(m[1], { h });
    assert.strictEqual(f('1472411D/A/M/000'), '1472411D/<wbr>A/<wbr>M/<wbr>000');
    assert.strictEqual(f('<b>/'), '&lt;b>/<wbr>', 'échappé AVANT de poser les coupures');
    assert.strictEqual(f(undefined), '');
    assert.ok(/key: 'mf', cls: 'mf', label: 'MF \/ CIN', get: r => `\$\{mfCoupable\(r\.c\.matricule\)\}/.test(app), 'la liste des clients coupe le matricule');
    assert.ok(/key: 'mf', cls: 'mf', label: 'Matricule', get: r => `\$\{mfCoupable\(r\.s\.matricule\)\}/.test(app), 'la liste des fournisseurs aussi');
    // … mais seulement quand la place manque : sur un écran large, une ligne.
    const css = fs.readFileSync(path.join(__dirname, '../../src/renderer/style.css'), 'utf8');
    assert.ok(/@media \(min-width: 1340px\) \{ td\.mf wbr \{ display: none; \} \}/.test(css), 'au-dessus de 1340 px le matricule tient sur une ligne (nowrap ne suffit pas : Chrome coupe à un <wbr>)');
  });

  // Trois écrans appelaient purchaseBalance sans `data` : les avoirs et acomptes imputés n'y
  // comptaient pas. La fenêtre « Régler LOC-2026-08 » annonçait un reste de 1 309 DT et le
  // PRÉREMPLISSAIT, pendant que la liste « À payer » disait 1 071 — un trop-payé proposé (10.14.0).
  t('10.14.0 : chaque reste dû d\'un achat compte ses avoirs et acomptes imputés', () => {
    const appels = [...app.matchAll(/C\.purchaseBalance\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map(m => m[1]);
    assert.ok(appels.length >= 4, 'les appels sont lus (' + appels.length + ')');
    appels.forEach(a => {
      const args = a.split(',').map(x => x.trim());
      assert.strictEqual(args[2], 'data', 'C.purchaseBalance(' + a + ') : sans data, un avoir imputé ne compte pas');
    });
    // Et ce qui a été imputé se LIT là où on lit le reste : sinon « net 1 309, réglé 0, reste 1 071 »
    // ne s'additionne pas.
    const fen = app.slice(app.indexOf('function supplierPaymentForm('), app.indexOf('function supplierPaymentForm(') + 2500);
    assert.ok(/b\.impute \?[\s\S]{0,200}imputé/.test(fen), 'la fenêtre de règlement dit ce qui est imputé');
    // Deux drawPayments existent (document et achat) : celle de l'achat suit l'éditeur d'achat.
    const dp = app.indexOf('function drawPayments(', app.indexOf('function supplierPaymentForm('));
    const grille = app.slice(dp, dp + 2000);
    assert.ok(grille.includes('purchaseBalance'), 'la tranche est celle de l\'achat');
    assert.ok(/b\.impute \?[\s\S]{0,200}imputé/.test(grille), 'la grille des règlements dit ce qui est imputé');
  });

  // La recherche d'une liste fait 300 px : « Rechercher : n°, fournisseur, objet, catégo… » s'y
  // coupait au milieu d'un mot, la liste des licences aussi. Une invite qu'on lit coupée ne dit
  // plus ce qu'on peut chercher (10.14.0 ; mesuré : 38 caractères tiennent dans la case).
  t('10.14.0 : l\'invite d\'une recherche de liste tient dans sa case', () => {
    // `#q` seul : c'est la case de 300 px des listes. Celle de la Comptabilité (`#cpt-q`) a 416 px
    // de place, et son invite de 42 caractères y tient — mesuré, pas supposé.
    const invites = [...app.matchAll(/<input type="(?:text|search)" id="q"[^>]*placeholder="([^"]*)"/g)].map(m => m[1]);
    assert.ok(invites.length >= 7, 'les invites sont lues (' + invites.length + ')');
    invites.forEach(x => assert.ok(x.length <= 38, '« ' + x + ' » : ' + x.length + ' caractères, coupé dans une case de 300 px'));
  });
};
