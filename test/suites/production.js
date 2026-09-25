'use strict';
// ============================================================================================
// Avant la mise en production (10.13.0) — ce que Skander a demandé en regardant les deux
// applications côte à côte : « les dropdown, y en a qui sont natifs et y en a qui sont modernes » ;
// « les bulles d'aide doivent rediriger vers l'article comme l'app cabinet, et être toutes du même
// style ». Les règles se tiennent ici sans Electron ; `npm run e2e:listes` les refait à la souris.
const path = require('path');

module.exports = ({ t, assert, lireSource }) => {
  const RACINE = path.join(__dirname, '..', '..');
  const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

  // ---------------------------------------------------------------- les listes déroulantes
  t('10.13.0 : listes.js est chargé par les DEUX applications, et emporté par le Cabinet construit', () => {
    // Un fichier partagé a TROIS branchements (7.26.0, 7.29.0) : oublier le troisième, c'est une
    // application qui marche en développement et retombe sur la liste du système une fois installée.
    const ent = lireSource('src', 'renderer', 'index.html');
    const cab = lireSource('src', 'cabinet', 'renderer', 'index.html');
    const conf = lireSource('build', 'cabinet.config.js');
    assert.ok(/<script src="listes\.js"><\/script>/.test(ent), 'l\'app entreprise ne charge pas listes.js');
    assert.ok(/<script src="\.\.\/\.\.\/renderer\/listes\.js"><\/script>/.test(cab), 'le Cabinet ne charge pas listes.js');
    assert.ok(/'src\/renderer\/listes\.js'/.test(code(conf)), 'build/cabinet.config.js n\'emporte pas listes.js : le Cabinet installé ouvrirait la liste du système');
    // Avant app.js : la première page dessinée doit déjà trouver le geste installé.
    // Les balises, pas le texte : un commentaire de la page nomme app.js plus haut.
    for (const [nom, html] of [['entreprise', ent], ['Cabinet', cab]]) {
      const i = html.search(/<script src="[^"]*listes\.js">/), j = html.search(/<script src="app\.js">/);
      assert.ok(i > 0 && j > 0 && i < j, nom + ' : listes.js doit précéder app.js');
    }
  });

  t('10.13.0 : la liste ouverte est une surface d\'overlay, et aucun <select> n\'y échappe sans le dire', () => {
    const Listes = require(path.join(RACINE, 'src', 'renderer', 'listes.js'));
    require(path.join(RACINE, 'src', 'renderer', 'rowmenu.js'));
    const RowMenu = globalThis.RowMenu;
    // Sans ça, le garde-fou global des overlays fermerait un calendrier ou une liste de client au
    // moment où l'on clique DANS la liste — c'est le défaut de la 7.28.0.
    assert.ok(RowMenu.SURFACES.split(',').map(x => x.trim()).includes(Listes.SURFACE),
      'RowMenu.SURFACES ne connaît pas la liste de SkanFact');
    // `data-natif` rend un <select> au système : l'exception se NOMME, et aucune n'existe
    // aujourd'hui. La première qui arrivera devra venir ici avec sa raison.
    const EXCEPTIONS = [];
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js'], ['src', 'renderer', 'onboarding.js']]) {
      const n = (lireSource(...f).match(/<select[^>]*data-natif/g) || []).length;
      assert.strictEqual(n, EXCEPTIONS.filter(e => e === f.join('/')).length, f.join('/') + ' : un <select> rendu au système sans raison nommée');
    }
  });

  t('10.13.0 : le chevron des listes l\'emporte sur toute règle qui repose un fond', () => {
    // Un raccourci `background:` remet `background-image` à zéro. Le chevron vit donc dans une règle
    // plus spécifique que TOUTE règle qui pose un fond sur un <select> — sinon il disparaît sur la
    // moitié des listes (les filtres, le thème sombre), ce que `e2e:listes` a mesuré.
    const css = code(lireSource('src', 'renderer', 'style.css'));
    const spec = sel => {
      const s = sel.replace(/:where\([^)]*\)/g, '');
      const ids = (s.match(/#[\w-]+/g) || []).length;
      const cls = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!not\b|is\b|where\b)[\w-]+/g) || []).length;
      const els = (s.replace(/\[[^\]]*\]|\([^)]*\)/g, '').match(/(^|[\s>+~(])([a-z][\w-]*)/gi) || []).length;
      return ids * 10000 + cls * 100 + els;
    };
    const chevron = css.match(/^(select:not\(\[multiple\]\):not\(\[size\]\):not\(\[data-natif\]\)) \{[^}]*background-image[^}]*\}/m);
    assert.ok(chevron, 'la règle du chevron est introuvable');
    const sChevron = spec(chevron[1]);
    const regles = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)];
    const fautes = [];
    for (const [, sels, corps] of regles) {
      if (!/(^|;|\s)background\s*:/.test(corps)) continue;
      for (const sel of sels.split(',').map(x => x.trim())) {
        if (!/(^|[\s>])select\b/.test(sel) || /option/.test(sel)) continue;
        if (spec(sel) >= sChevron) fautes.push(sel);
      }
    }
    assert.deepStrictEqual(fautes, [], 'règle(s) qui reposent un fond sur un <select> avec une spécificité ≥ au chevron');
    assert.ok(/appearance:\s*none/.test(chevron[0]), 'le chevron ne retire pas la flèche du système');
  });

  // ---------------------------------------------------------------- les bulles « i »
  t('10.13.0 : CHAQUE bulle mène à un article qui existe, dans les deux applications', () => {
    for (const [nom, f] of [['entreprise', ['src', 'renderer', 'guide.js']], ['Cabinet', ['src', 'cabinet', 'renderer', 'cabguide.js']]]) {
      const G = require(path.join(RACINE, ...f));
      const ids = new Set(G.ARTICLES.map(a => a.id));
      const cles = Object.keys(G.INFO);
      assert.ok(cles.length > 50, nom + ' : les bulles ne se lisent plus');
      const sans = cles.filter(k => !G.articleDe(k));
      assert.deepStrictEqual(sans, [], nom + ' : bulle(s) qui s\'arrêtent à leur dernière phrase, sans article');
      const faux = cles.filter(k => !ids.has(G.articleDe(k)));
      assert.deepStrictEqual(faux, [], nom + ' : bulle(s) qui mènent à un article inexistant');
      // Le `a` d'une bulle décide avant la famille : une règle ne REPREND jamais un choix écrit.
      cles.filter(k => G.INFO[k].a).forEach(k => assert.strictEqual(G.articleDe(k), G.INFO[k].a, nom + ' : ' + k));
      // Une règle qui ne sert à aucune bulle est une règle morte — elle ment sur ce qu'elle couvre.
      const mortes = G.ARTICLE_PAR_CLE.filter(([m]) => !cles.some(k => !G.INFO[k].a && G.ARTICLE_PAR_CLE.find(([mm]) => mm.test(k))[0] === m));
      assert.deepStrictEqual(mortes.map(r => String(r[0])), [], nom + ' : règle(s) de famille qui ne servent à rien');
    }
    // Des DONNÉES qui discriminent (10.0.0) : « pay. » mêle le RIB et la paie, la règle la plus
    // précise doit gagner — sinon le RIB mène à l'article sur les bulletins.
    const G = require(path.join(RACINE, 'src', 'renderer', 'guide.js'));
    assert.strictEqual(G.articleDe('pay.rib'), 'paiements');
    assert.strictEqual(G.articleDe('pay.gross'), 'paie');
  });

  t('10.13.0 : la bulle des deux applications ouvre l\'article par la MÊME règle', () => {
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js']]) {
      const src = code(lireSource(...f));
      const i = src.indexOf('function openInfoPop(');
      const corps = src.slice(i, src.indexOf('\n  }', i));
      assert.ok(corps.length > 200 && corps.length < 3000, f.join('/') + ' : tranche de openInfoPop suspecte (' + corps.length + ')');
      assert.ok(/G\.articleDe\(btn\.dataset\.info\)/.test(corps), f.join('/') + ' : la bulle ne demande pas son article à articleDe');
      assert.ok(!/x\.a \?/.test(corps), f.join('/') + ' : la bulle ne lit encore que son `a` : les autres restent des culs-de-sac');
      assert.ok(/class="ip-more"/.test(corps), f.join('/') + ' : le lien vers l\'article n\'a plus le dessin commun');
    }
  });

  t('10.13.0 : les articles neufs du Cabinet mènent à un panneau qui existe', () => {
    const C = require(path.join(RACINE, 'src', 'cabinet', 'renderer', 'cabguide.js'));
    const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
    for (const id of ['licence', 'equipe']) {
      const a = C.ARTICLES.find(x => x.id === id);
      assert.ok(a, 'l\'article ' + id + ' manque : les bulles de sa famille n\'ont nulle part où aller');
      assert.ok(a.geste && a.geste.panneau && app.includes(`panneauReg('${a.geste.panneau}'`), id + ' : son geste vise un panneau introuvable');
    }
  });

  // ---------------------------------------------------------------- une seule règle de hauteur
  t('10.13.0 : tout ce qui flotte part de la MÊME marge haute, et jamais centré par la feuille', () => {
    // Trois hauteurs coexistaient — questions à 7 %, palette à 12 %, assistant et verrou centrés —,
    // et « Passer la suite ? » s'ouvrait au-dessus de l'assistant qu'elle concernait. La marge haute
    // est commune ; ce qui décide de la hauteur d'une fenêtre, c'est `placement.js` (test suivant).
    const css = code(lireSource('src', 'renderer', 'style.css'));
    assert.ok(/--haut-fenetre:\s*\d+vh;/.test(css), 'la hauteur commune n\'est plus déclarée');
    for (const sel of ['.modal-bg', '#palette-root', '#setup', '#lock-screen']) {
      const m = css.match(new RegExp('^' + sel.replace(/[.#-]/g, c => '\\' + c) + ' \\{([^}]*)\\}', 'm'));
      assert.ok(m, sel + ' : règle introuvable');
      assert.ok(/var\(--haut-fenetre\)/.test(m[1]), sel + ' : ne part pas de la marge commune');
      // Centrée par la feuille, une fenêtre se RECENTRE en grandissant : le bouton visé remonte sous
      // le curseur (10.12.0). La position se décide une fois, à l'ouverture, par le script.
      assert.ok(/align-items:\s*flex-start/.test(m[1]), sel + ' : centré par la feuille de style — il se recentrerait en grandissant');
    }
  });

  t('10.13.0 : une question courte se pose au CENTRE OPTIQUE, une fenêtre longue en haut, et rien ne redescend', () => {
    // Skander : « le toast de confirmation est trop haut, il devrait être au milieu ». Montants
    // calculés à la main sur un écran de 873 px (900 moins la barre de titre), marge haute 87 px
    // (10 vh), marge basse 26 px (3 vh).
    const P = require(path.join(RACINE, 'src', 'renderer', 'placement.js'));
    assert.strictEqual(P.PART_AU_DESSUS, 0.4, 'quatre dixièmes au-dessus : le milieu que voit l\'œil, pas le milieu géométrique');
    // Une confirmation de 162 px : (873 − 162) × 0,4 = 284,4 → 284. Son centre tombe à 365, soit 42 %.
    assert.strictEqual(P.hautOptique(162, 873, 87, 26), 284);
    // La fiche d'un client, 694 px : (873 − 694) × 0,4 = 71,6 → sous la marge : elle reste à 87.
    assert.strictEqual(P.hautOptique(694, 873, 87, 26), 87);
    // Sur un grand écran de 1400 px, une fenêtre de 700 : (1400 − 700) × 0,4 = 280.
    assert.strictEqual(P.hautOptique(700, 1400, 140, 42), 280);
    // Après l'ouverture : une fenêtre à 284 qui grandit à 500 px tient encore (284 + 500 < 847) : elle
    // ne BOUGE PAS. À 650 px elle déborderait (284 + 650 = 934) : elle remonte à 873 − 26 − 650 = 197.
    assert.strictEqual(P.hautApresCroissance(284, 500, 873, 87, 26), 284, 'une fenêtre qui grandit ne se recentre pas');
    assert.strictEqual(P.hautApresCroissance(284, 650, 873, 87, 26), 197, 'elle remonte juste assez pour rester dans l\'écran');
    // Et elle ne redescend JAMAIS : rétrécie à 100 px, elle reste où elle est.
    assert.strictEqual(P.hautApresCroissance(197, 100, 873, 87, 26), 197, 'une fenêtre qui rétrécit ne redescend pas');
    assert.strictEqual(P.hautApresCroissance(284, 900, 873, 87, 26), 87, 'jamais au-dessus de la marge haute');
    // Ce qui est placé : les fenêtres et le verrou des DEUX applications, et ni la palette (son champ
    // de recherche doit rester immobile quand les résultats changent) ni l'assistant (son en-tête
    // sauterait d'une étape à l'autre).
    assert.ok(/\.modal-bg > \.modal/.test(P.CIBLES) && /#lock-screen > \.lock-card/.test(P.CIBLES), 'placement.js ne vise plus les fenêtres et le verrou');
    assert.ok(!/palette|#setup/.test(P.CIBLES), 'la palette et l\'assistant n\'ont rien à faire au centre : ils grandissent ou changent d\'étape');
    // Trois branchements, comme tout fichier partagé (7.26.0, 7.29.0).
    const ent = lireSource('src', 'renderer', 'index.html'), cab = lireSource('src', 'cabinet', 'renderer', 'index.html');
    assert.ok(/<script src="placement\.js"><\/script>/.test(ent), 'l\'app entreprise ne charge pas placement.js');
    assert.ok(/<script src="\.\.\/\.\.\/renderer\/placement\.js"><\/script>/.test(cab), 'le Cabinet ne charge pas placement.js');
    assert.ok(/'src\/renderer\/placement\.js'/.test(code(lireSource('build', 'cabinet.config.js'))), 'le Cabinet construit n\'emporterait pas placement.js');
    // La position posée ne vient QUE de la règle pure : un calcul recopié dans `placer` divergerait.
    const src = code(lireSource('src', 'renderer', 'placement.js'));
    const placer = src.slice(src.indexOf('function placer('), src.indexOf('const suivies'));
    assert.ok(/hautOptique\(/.test(placer) && /hautApresCroissance\(/.test(placer), 'placer() ne passe plus par les deux règles testées');
    assert.ok(!/0\.4|\/ ?2/.test(placer), 'placer() recalcule le centre à la main');
  });

  // ---------------------------------------------------------------- le libellé et son champ
  t('10.13.0 : un libellé désigne son CHAMP, jamais la bulle qui le précède', () => {
    // `lbl()` pose la bulle AVANT le champ ; un <label> désigne le premier élément étiquetable
    // qu'il contient, et un <button> l'est. Cliquer « Raison sociale » ouvrait l'explication.
    const L = require(path.join(RACINE, 'src', 'renderer', 'listes.js'));
    assert.strictEqual(typeof L.lierLibelles, 'function');
    for (const sorte of ['input', 'select', 'textarea', '.combo-btn']) assert.ok(L.CHAMP.includes(sorte), 'un libellé ne sait pas désigner ' + sorte);
    assert.ok(/:not\(\[type=hidden\]\)/.test(L.CHAMP), 'un champ caché ne se désigne pas : la valeur d\'un combo n\'est pas une case');
    const src = code(lireSource('src', 'renderer', 'listes.js'));
    assert.ok(/lierLibelles\(n\)/.test(src) && /lierLibelles\(document\)/.test(src), 'le lien se pose sur la page ET sur ce qui s\'y ajoute');
    // Les deux applications posent la bulle dans le libellé par la même fonction : c'est elle que
    // la règle rattrape. Si `lbl` change de forme, ce test doit être relu.
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js']]) {
      assert.ok(/const lbl = \(text, key\) => key \? `<span class="fl">\$\{text\} \$\{info\(key\)\}<\/span>` : text;/.test(lireSource(...f)), f.join('/') + ' : lbl() a changé de forme');
    }
  });

  // ---------------------------------------------------------------- revu à la souris (10.13.0)
  t('10.13.0 : le bouton de création d\'une liste garde le libellé de son gabarit', () => {
    // `combo({ add: '+ Nouveau client' })` écrit le bouton ; `bindCombo` ne reçoit pas toujours `add`.
    // Le relire dans ses options le vidait à chaque dessin : une bande blanche sous « Aucun client
    // pour l'instant », à l'endroit exact du seul geste utile — dans la 10.12.0 publiée.
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const i = src.indexOf('function bindCombo(');
    const corps = src.slice(i, src.indexOf('\n  }\n', i));
    assert.ok(corps.length > 1500 && corps.length < 9000, 'tranche de bindCombo suspecte (' + corps.length + ')');
    const poses = corps.match(/add\.textContent\s*=[^;]*/g) || [];
    assert.ok(poses.length >= 1, 'bindCombo ne pose plus le libellé du bouton de création');
    poses.forEach(p => assert.ok(!/\bo\.add\b/.test(p), 'le libellé du bouton de création se relit dans les options, qui ne le portent pas toujours : ' + p));
    assert.ok(/add\.textContent\.trim\(\)/.test(corps), 'le libellé du bouton ne se lit plus dans le gabarit');
  });

  t('10.13.0 : « Revoir l\'assistant » emporte ce qui vient d\'être réglé, jamais à la poubelle', () => {
    // Vu à la souris : « Sombre » choisi, puis « Revoir l'assistant » — au retour, Clair, sans un mot.
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const i = src.indexOf('async function rejouerAssistant(');
    const corps = src.slice(i, src.indexOf('\n  }\n', i));
    const jette = corps.indexOf('clearGuard()');
    assert.ok(jette > 0, 'rejouerAssistant ne désarme plus le garde-fou');
    const avant = corps.slice(0, jette);
    assert.ok(/enregistrerEnCours\(\)/.test(avant), 'depuis les Paramètres, le réglage en cours n\'est pas enregistré avant l\'assistant (règle 7.30.0)');
    assert.ok(/leaveOk\(\)/.test(avant), 'depuis une autre page, la question de toute sortie n\'est pas posée');
  });

  t('10.13.0 : cliquer les mots d\'un libellé qui n\'est pas un <label> pose aussi le curseur', () => {
    // Le libellé « Client » d'une facture vit dans une RANGÉE (`.fl-ligne`, avec « Modifier la
    // fiche ») : le chercher dans le parent immédiat ne trouvait jamais le `.field`.
    const src = code(lireSource('src', 'renderer', 'listes.js'));
    const i = src.indexOf("document.addEventListener('click'");
    const corps = src.slice(i, src.indexOf('});', i));
    assert.ok(/closest\('\.fl'\)/.test(corps), 'le clic sur les mots d\'un libellé n\'est plus écouté');
    assert.ok(/closest\('\.field'\)/.test(corps), 'le champ se cherche dans le parent immédiat : une rangée intermédiaire le cache');
    assert.ok(/tagName === 'LABEL'/.test(corps), 'un <label> fait déjà le geste lui-même : le doubler donnerait deux focus');
  });

  t('10.13.0 : un combo, une liste et une case parlent le même dessin', () => {
    const css = code(lireSource('src', 'renderer', 'style.css'));
    // Toutes les règles qui visent exactement ce sélecteur, sur une ou plusieurs lignes : deux règles
    // pour un même élément finissent par se contredire, et le test lit ce que la feuille décide EN TOUT.
    const regle = sel => [...css.matchAll(/(?<=^|\})\s*([^{}]+)\{([^}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(';');
    const caret = regle('.combo-caret');
    assert.ok(/font-size:\s*0/.test(caret) && /svg/.test(caret), 'le triangle d\'un combo est encore un caractère « ▾ » à côté des chevrons des listes');
    const chevron = (css.match(/^select:not\(\[multiple\]\):not\(\[size\]\):not\(\[data-natif\]\) \{[^}]*url\("([^"]+)"\)/m) || [])[1];
    assert.ok(chevron && caret.includes(chevron), 'le combo et la liste ne portent pas le même dessin');
    assert.ok(/accent-color:\s*var\(--primary\)/.test(regle('input[type=checkbox], input[type=radio]')), 'une case cochée garde le bleu du système');
    assert.ok(/box-sizing:\s*border-box/.test(regle('.lm-pop')), 'la liste ouverte dépasse son champ de sa bordure et de son rembourrage');
    assert.ok(/border:\s*1px solid/.test(regle('body.dark .modal')), 'en sombre, le bord d\'une fenêtre ne se voit pas');
  });

  // ---------------------------------------------------------------- la barre latérale
  t('10.13.0 : une famille de la barre s\'ouvre selon le CHOIX de l\'utilisateur, et celle de la page ouverte le temps d\'y être', () => {
    // Skander : « trop d'onglets ». Dix-huit entrées pour 705 px ; chaque famille se replie sur son
    // intertitre. Les cas qui discriminent : un choix, pas de choix, la page ouverte, et le repli
    // demandé sur la page même.
    const C = require(path.join(RACINE, 'src', 'renderer', 'core.js'));
    const o = C.familleNavOuverte;
    assert.deepStrictEqual(C.FAMILLES_OUVERTES_AU_DEBUT, ['Vendre'], 'au premier jour, seule « Vendre » (le geste quotidien) est ouverte');
    assert.strictEqual(o('Vendre', {}, null, null), true);
    assert.strictEqual(o('Piloter', {}, null, null), false, 'une famille jamais touchée est repliée');
    assert.strictEqual(o('Vendre', { Vendre: false }, null, null), false, 'un choix de l\'utilisateur fait foi, même sur « Vendre »');
    assert.strictEqual(o('Piloter', { Piloter: true }, null, null), true);
    // La page ouverte ouvre sa famille — sans en faire un choix.
    assert.strictEqual(o('Piloter', {}, 'Piloter', null), true, 'on voit toujours où vit la page ouverte');
    assert.strictEqual(o('Piloter', { Piloter: false }, 'Piloter', null), true, 'même repliée par choix, la famille de la page ouverte se montre');
    assert.strictEqual(o('Piloter', { Piloter: false }, 'Piloter', 'Piloter'), false, 'repliée à la main SUR cette page : on respecte le geste');
    assert.strictEqual(o('Acheter', {}, 'Piloter', null), false, 'la page ouverte n\'ouvre que SA famille');
  });

  t('10.13.0 : seul un clic sur l\'intertitre change ce que la barre retient, et une famille repliée porte le compte de ce qui attend', () => {
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const i = src.indexOf('function drawNav(');
    const dessin = src.slice(i, src.indexOf('\n  }\n', i));
    assert.ok(dessin.length > 1500 && dessin.length < 9000, 'tranche de drawNav suspecte (' + dessin.length + ')');
    // Le dessin ne décide pas : il demande à la règle pure, et n'écrit RIEN — sinon chaque page
    // visitée rouvrirait sa famille pour de bon, et la barre se remplirait de nouveau.
    assert.ok(/C\.familleNavOuverte\(/.test(dessin), 'drawNav ne passe plus par la règle testée');
    assert.ok(!/prefs\.set\(/.test(dessin), 'drawNav retient un état : visiter une page rouvrirait sa famille pour toujours');
    // L'intertitre repliable est un BOUTON qui dit son état — et une famille d'une entrée n'en a pas.
    assert.ok(/<button type="button" class="nav-group" data-famille="[^"]*" aria-expanded="\$\{ouverte\}"/.test(dessin), 'l\'intertitre d\'une famille n\'est pas un bouton qui dit s\'il est ouvert');
    assert.ok(/g\.pages\.length < 2/.test(dessin), 'une famille d\'une seule entrée se replierait : un clic pour découvrir une ligne');
    // Un seul endroit écrit le choix : le clic.
    const toutes = [...src.matchAll(/prefs\.set\('navFamilles'/g)].length;
    const bascule = src.slice(src.indexOf('function basculerFamille('), src.indexOf('function resumerFamilles('));
    assert.ok(toutes === 1 && /prefs\.set\('navFamilles'/.test(bascule), 'le choix des familles s\'écrit ailleurs que sur le clic de l\'intertitre (' + toutes + ')');
    // Le compte de la famille repliée suit les compteurs : il se refait à chaque mise à jour.
    const maj = src.slice(src.indexOf('function updateNavCounts('), src.indexOf('function updateNavCounts(') + 4000);
    assert.ok(/resumerFamilles\(\)/.test(maj), 'un compteur qui change ne se voit plus sur sa famille repliée');
    // « À faire » crie une déclaration sociale en retard : l'entrée Paie la compte aussi.
    assert.ok(/C\.socialDue\(data, t\)\.filter\(x => x\.late\)/.test(maj), 'le compteur de Paie ignore les déclarations sociales en retard');
  });

  t('10.13.0 : une liste « libellé : valeur » décide sa colonne de libellés une fois, pour toutes ses rangées', () => {
    // « Ce qu'elle ne fait pas » dépassait le minimum de 110 px et poussait SA valeur de 2 px :
    // chaque rangée était sa propre ligne flex (règle 10.12.0 : aucune colonne ligne par ligne).
    const css = code(lireSource('src', 'renderer', 'style.css'));
    const grille = css.match(/^\.kv:not\(\.two\) \{([^}]*)\}/m), rangee = css.match(/^\.kv:not\(\.two\) > div \{([^}]*)\}/m);
    assert.ok(grille && /display:\s*grid/.test(grille[1]) && /grid-template-columns:\s*max-content/.test(grille[1]), 'la liste n\'est plus une grille dont la colonne des libellés suit le plus long');
    assert.ok(rangee && /grid-template-columns:\s*subgrid/.test(rangee[1]) && /grid-column:\s*1 \/ -1/.test(rangee[1]), 'chaque rangée décide encore sa propre colonne');
    // Et chaque rangée de toutes les listes porte bien DEUX éléments : une troisième cellule
    // passerait à la ligne dans la sous-grille, sans un mot.
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js']]) {
      const src = lireSource(...f);
      for (const m of src.matchAll(/<div class="kv(?! two)[^"]*">([\s\S]*?)<\/div>\s*(?:`|\$\{|<\/div>|<p|<div class="(?!kv))/g)) {
        for (const r of m[1].matchAll(/<div>([\s\S]*?)<\/div>/g)) {
          // Les interpolations `${…}` remplacées par un jeton (accolades équilibrées), puis seules les
          // cellules de PREMIER niveau comptent : un libellé porte sa bulle, une valeur son `<span>`.
          let plat = '', prof = 0;
          for (let k = 0; k < r[1].length; k++) {
            if (!prof && r[1][k] === '$' && r[1][k + 1] === '{') { prof = 1; k++; plat += 'X'; continue; }
            if (prof) { if (r[1][k] === '{') prof++; else if (r[1][k] === '}') prof--; continue; }
            plat += r[1][k];
          }
          let niveau = 0, n = 0;
          for (const tag of plat.matchAll(/<(\/?)span\b/g)) { if (tag[1]) niveau--; else { if (!niveau) n++; niveau++; } }
          assert.ok(n <= 2, f.join('/') + ' : une rangée de liste porte ' + n + ' cellules : ' + r[1].slice(0, 80));
        }
      }
    }
  });

  t('10.13.0 : une chose FAITE se ferme, elle ne s\'annule pas — dans les deux applications', () => {
    // « Fichier d'appairage créé » proposait « Annuler » à côté de « Le montrer dans le dossier » : le
    // fichier est déjà sur le disque, il n'y a rien à annuler, et le mot laisse croire le contraire.
    // L'export de la base (app entreprise) posait « Annuler » à côté de « Fermer » : deux boutons au
    // même effet. Le test lit chaque appel, son titre et ses arguments, accolades équilibrées.
    const appels = (src, nom) => {
      const out = [];
      for (const m of src.matchAll(new RegExp('\\b' + nom + '\\(', 'g'))) {
        if (/function\s+$/.test(src.slice(Math.max(0, m.index - 9), m.index))) continue;
        const args = [];
        let d = 0, j = m.index + nom.length, cur = '', q = null;
        for (; j < src.length; j++) {
          const c = src[j];
          if (q) { cur += c; if (c === '\\') { cur += src[++j]; continue; } if (c === q) q = null; continue; }
          if (c === '\'' || c === '"' || c === '`') { q = c; cur += c; continue; }
          if ('([{'.includes(c)) { d++; if (d === 1 && c === '(') continue; }
          else if (')]}'.includes(c)) { d--; if (d === 0) break; }
          if (d === 1 && c === ',') { args.push(cur.trim()); cur = ''; continue; }
          cur += c;
        }
        args.push(cur.trim());
        out.push({ ligne: src.slice(0, m.index).split('\n').length, args });
      }
      return out;
    };
    const INFO = /^['`](Fermer|OK|J\\'ai compris|Compris)['`]$/;
    // Cabinet : confirmDialog(titre, corps, ok, danger, annuler).
    const cab = code(lireSource('src', 'cabinet', 'renderer', 'app.js'));
    const cabAppels = appels(cab, 'confirmDialog');
    assert.ok(cabAppels.length > 30, 'la lecture des appels du Cabinet ne voit plus rien (' + cabAppels.length + ')');
    // Sans le drapeau `u`, `\b` ne voit pas la fin de « créé » : un « é » n'est pas un caractère de mot.
    const FAIT = /(?<!\p{L})(créée?s?|enregistrée?s?|exportée?s?|reprise?|repris|posée?s?|refaite?s?|importée?s?|terminée?s?|envoyée?s?)(?!\p{L})/iu;
    assert.ok(FAIT.test('\'Fichier d\\\'appairage créé\'') && !FAIT.test('Recréer'), 'la lecture des titres ne reconnaît plus un geste FAIT');
    for (const a of cabAppels) {
      const titre = a.args[0] || '';
      assert.ok(!INFO.test(a.args[2] || ''), 'Cabinet l.' + a.ligne + ' : une explication posée comme une question (« Annuler » à côté de ' + a.args[2] + ') — infoDialog');
      if (!titre.includes('?') && FAIT.test(titre)) {
        assert.ok(a.args[4] && !/Annuler/.test(a.args[4]), 'Cabinet l.' + a.ligne + ' : ' + titre + ' dit une chose FAITE et propose « Annuler » — nomme la sortie (Fermer, Plus tard)');
      }
    }
    // App entreprise : confirmDialog(message, ok, danger) — son bouton de sortie est toujours
    // « Annuler », donc un « Fermer » ou un « OK » y est un compte rendu déguisé.
    const ent = code(lireSource('src', 'renderer', 'app.js'));
    const entAppels = appels(ent, 'confirmDialog');
    assert.ok(entAppels.length > 30, 'la lecture des appels de l\'app entreprise ne voit plus rien (' + entAppels.length + ')');
    for (const a of entAppels) {
      assert.ok(!INFO.test(a.args[1] || ''), 'app entreprise l.' + a.ligne + ' : un compte rendu posé comme une question (« Annuler » à côté de ' + a.args[1] + ') — infoDialog');
    }
    // Et le compte rendu n'a qu'UN bouton.
    const info = ent.slice(ent.indexOf('function infoDialog('), ent.indexOf('function confirmerEmission('));
    assert.ok(info.length > 100 && info.length < 1200 && (info.match(/<button/g) || []).length === 1, 'le compte rendu de l\'app entreprise porte plus d\'un bouton');
  });

  t('10.13.0 : appairer ou retirer un cabinet redessine SON panneau, là où l\'on est, et un refus parle français', () => {
    // Le geste redessinait la page entière : elle remontait en haut, et l'empreinte à vérifier de
    // vive voix — la réponse au geste — repartait sous le bas de l'écran.
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const i = src.indexOf('const doImport = async () =>');
    const zone = src.slice(i, src.indexOf('drawCabinetPair();\n    drawLicencePanel();', i));
    assert.ok(i > 0 && zone.length > 300 && zone.length < 2500 && zone.includes('#cab-unpair'), 'la tranche de l\'appairage ne se trouve plus (' + zone.length + ')');
    assert.ok(!/\brender\(/.test(zone), 'appairer ou retirer un cabinet redessine encore toute la page (elle remonte en haut)');
    assert.ok((zone.match(/drawCabinetPair\(\)/g) || []).length >= 2, 'le panneau du cabinet ne se redessine plus après le geste');
    // Rien n'enregistre à la place de l'utilisateur ce qu'il tape ailleurs dans les Paramètres.
    assert.ok(!/applySettings\(\)/.test(zone), 'le geste enregistre en silence les autres réglages en cours de saisie');
    assert.ok(/plainError\(e\)/.test(zone) && !/e\.message/.test(zone), 'un fichier refusé montre le message brut du pont');
  });

  t('10.13.0 : une famille qu\'on OUVRE se montre entière dans la barre', () => {
    // « Piloter » ouverte en bas de la barre laissait Comptabilité sous le bord, sans rien pour dire
    // qu'il fallait faire défiler la barre (test humain du pont).
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const f = src.slice(src.indexOf('function basculerFamille('), src.indexOf('function resumerFamilles('));
    assert.ok(f.length > 200 && f.length < 3000, 'la tranche de basculerFamille ne se trouve plus');
    assert.ok(/if \(etat\[famille\]\) bloc\.scrollIntoView\(\{ block: 'nearest' \}\)/.test(f), 'une famille ouverte peut rester à moitié sous le bord de la barre');
  });

  t('10.13.0 : le contenu du paquet n\'a pas de faux total sous sa colonne', () => {
    // « Fichiers en tout : 15 » sous une colonne « Nombre » qui additionne 14 lignes de journal,
    // encaissements et pièces : un total sous une colonne est lu comme sa somme (9.8.8).
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const i = src.indexOf('<th>Ce que contient le paquet</th>');
    const table = src.slice(i, src.indexOf('</table>', i));
    assert.ok(i > 0 && table.length > 200 && table.length < 2000, 'le tableau du contenu du paquet ne se trouve plus');
    assert.ok(!/total-row/.test(table), 'le contenu du paquet porte encore un « total » qui n\'est pas la somme de sa colonne');
    const apres = src.slice(src.indexOf('</table>', i), src.indexOf('</table>', i) + 1200);
    // Le poids se DIT ; son compte exact (+ 3 depuis que la signature est comptée, 10.14.0) est tenu
    // par verite-comptable.js, qui lit les fichiers que le processus principal ajoute au plan.
    assert.ok(/pl\(plan\.entries\.length \+ \d, 'fichier'\)/.test(apres), 'le poids du paquet ne se dit plus');
  });

  t('10.13.0 : une question commence par une majuscule, même ouverte sur un nom de mois', () => {
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const f = require('vm').runInNewContext(src.match(/const enTete = (s => \{[^\n]*\});/)[1]);
    assert.strictEqual(f('août 2026 n\'est pas clôturé'), 'Août 2026 n\'est pas clôturé');
    assert.strictEqual(f('Émettre ?'), 'Émettre ?');
    assert.strictEqual(f(''), '');
    for (const nom of ['confirmDialog', 'infoDialog', 'choiceDialog']) {
      const i = src.indexOf('function ' + nom + '(');
      const corps = src.slice(i, src.indexOf('\n  }\n', i));
      // Retournée vers la règle (10.14.0) : confirmDialog affiche un TITRE et un corps tirés du
      // message ; ce qui compte est que ce qui s'affiche passe par `enTete(`, pas le nom de sa variable.
      assert.ok(nom === 'confirmDialog' ? /enTete\(q\.titre\)[\s\S]*enTete\(q\.corps\)/.test(corps) : /enTete\(msg\)/.test(corps), nom + ' laisse une phrase commencer par une minuscule');
    }
  });

  t('10.13.0 : le vert du paquet suit l\'étape suivante — répondre, fabriquer, refaire, envoyer (U-11)', () => {
    // Trouvé au test humain du pont : répondre à la question du comptable, puis cliquer le vert
    // « Envoyer au comptable » joignait le paquet fabriqué AVANT la réponse. Elle n'arrivait jamais.
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const vm = require('vm');
    const m = src.match(/const suivante = (moisVide \? ''[\s\S]*?);\n/);
    assert.ok(m, 'l\'étape suivante du paquet n\'est plus calculée par une seule expression');
    const i = src.indexOf('id="cab-build"');
    const zone = src.slice(src.lastIndexOf('<div class="inline">', i), src.indexOf('</div>', i));
    const etat = (sent, enAttente, nonParties) => {
      // `change` (10.14.0) : les écritures n'ont pas bougé depuis le paquet — ce test-ci juge les réponses.
      const ctx = { sent, enAttente, nonParties, change: [], moisVide: false, h: x => x };
      ctx.suivante = vm.runInNewContext(m[1], ctx);
      const html = vm.runInNewContext('`' + zone.replace(/\$\{moisVide[^}]*\}/, '') + '`', ctx);
      return { suivante: ctx.suivante, verts: [...html.matchAll(/class="btn ([^"]*)" id="([^"]+)"/g)].filter(x => /btn-primary/.test(x[1])).map(x => x[2]), html };
    };
    assert.deepStrictEqual(etat([], [], []).verts, ['cab-build'], 'avant la fabrication, le seul vert est « Fabriquer le paquet… »');
    assert.deepStrictEqual(etat([{ at: 1 }], [], []).verts, ['cab-mail'], 'le paquet fabriqué, le seul vert doit être « Envoyer au comptable… »');
    const refaire = etat([{ at: 1 }], [], [{ id: 'q' }]);
    assert.deepStrictEqual(refaire.verts, ['cab-build'], 'une réponse plus récente que le paquet : le vert doit être de le REFAIRE, pas d\'envoyer l\'ancien');
    assert.ok(/Refaire le paquet avec ta réponse/.test(refaire.html), 'le bouton ne dit pas qu\'il emporte la réponse');
    const repondre = etat([{ at: 1 }], [{ id: 'q' }], []);
    assert.strictEqual(repondre.suivante, 'repondre', 'une question qui attend passe avant l\'envoi');
    assert.deepStrictEqual(repondre.verts, [], 'une question attend : ni fabriquer ni envoyer n\'est l\'étape suivante');
    // Le vert de « Répondre » vit dans le panneau des questions, sur la PREMIÈRE question en attente.
    assert.ok(/data-rep="\$\{h\(q\.id\)\}"/.test(src) && /suivante === 'repondre' && i === 0 \? ' btn-primary'/.test(src),
      'le panneau des questions ne pose pas le vert sur la première question en attente');
    // Le panneau des questions vient AVANT « Fabriquer et envoyer » quand il y a des questions.
    const q = src.indexOf('${questions.length ? panneauQuestions() : \'\'}'), f = src.indexOf('<h2>Fabriquer et envoyer');
    assert.ok(q > 0 && f > q, 'les questions ne passent pas avant le paquet qui emporte leurs réponses');
  });

  t('10.13.0 : une réponse plus récente que le paquet n\'y est pas', () => {
    const C = require(path.join(RACINE, 'src', 'renderer', 'core.js'));
    const Compta = require(path.join(RACINE, 'src', 'renderer', 'compta.js'));
    assert.strictEqual(C.reponsesApres, Compta.reponsesApres, 'core.js doit réexporter la fonction de compta.js, pas une copie');
    const qs = [
      { id: 'a', reponse: { texte: 'avant', le: 100 } },
      { id: 'b', reponse: { texte: 'après', le: 300 } },
      { id: 'c', reponse: null },
      { id: 'd', reponse: { texte: '   ', le: 400 } }
    ];
    assert.deepStrictEqual(C.reponsesApres(qs, 200).map(q => q.id), ['b'], 'seule la réponse donnée après le paquet manque au paquet');
    assert.deepStrictEqual(C.reponsesApres(qs, 500), []);
    assert.deepStrictEqual(C.reponsesApres(null, 0), []);
  });

  t('10.13.0 : une réponse déjà rangée qui revient dans le paquet suivant n\'est pas « sans question »', () => {
    // Le client renvoie TOUTES ses réponses dans CHAQUE paquet : la même réponse revient donc tous
    // les mois. Elle doit être reconnue, sans être recomptée ni prise pour une réponse orpheline.
    const Compta = require(path.join(RACINE, 'src', 'renderer', 'compta.js'));
    const livre = { questions: [{ id: 'q1', statut: 'envoyee', reponse: null }, { id: 'q2', statut: 'envoyee', reponse: null }] };
    const ouvert = [];
    const ouvrir = a => { ouvert.push(a); return a === 2026 ? livre : { questions: [] }; };
    const r1 = Compta.posterReponsesDansLivres([2026], ouvrir, [{ id: 'q1', texte: 'Oui', le: 10 }], 99);
    assert.strictEqual(r1.posees, 1);
    assert.strictEqual(r1.inconnues, 0);
    assert.strictEqual(r1.modifies.length, 1);
    assert.strictEqual(livre.questions[0].statut, 'repondue');
    // Le paquet suivant renvoie la même réponse, plus une nouvelle.
    const r2 = Compta.posterReponsesDansLivres([2026], ouvrir, [{ id: 'q1', texte: 'Oui', le: 10 }, { id: 'q2', texte: 'Non', le: 20 }], 99);
    assert.strictEqual(r2.posees, 1, 'la réponse déjà rangée est recomptée');
    assert.strictEqual(r2.inconnues, 0, 'une réponse déjà rangée est prise pour une réponse sans question');
    // Le troisième ne porte que des réponses déjà rangées : rien à écrire, rien d'orphelin.
    const r3 = Compta.posterReponsesDansLivres([2026], ouvrir, [{ id: 'q1', texte: 'Oui', le: 10 }, { id: 'q2', texte: 'Non', le: 20 }], 99);
    assert.deepStrictEqual([r3.posees, r3.inconnues, r3.modifies.length], [0, 0, 0], 'un paquet sans rien de neuf ne doit rien écrire ni rien signaler');
    // Une réponse à une question qu'aucun livre ne porte reste orpheline — et on cherche dans tous les exercices.
    const r4 = Compta.posterReponsesDansLivres([2025, 2026], ouvrir, [{ id: 'zz', texte: '?', le: 5 }], 99);
    assert.strictEqual(r4.inconnues, 1);
    // Et on n'ouvre pas un livre de plus quand tout a trouvé sa question.
    ouvert.length = 0;
    Compta.posterReponsesDansLivres([2026, 2025], ouvrir, [{ id: 'q1', texte: 'Oui', le: 10 }], 99);
    assert.deepStrictEqual(ouvert, [2026], 'un livre de plus a été ouvert alors que toutes les réponses avaient leur question');
    const cm = code(lireSource('src', 'cabinet', 'main.js'));
    assert.ok(/KC\.posterReponsesDansLivres\(annees,/.test(cm), 'le Cabinet ne range plus les réponses par la règle du moteur');
  });

  t('10.13.0 : le compte rendu d\'import dit les réponses du client et y mène ; le livre ouvert se relit', () => {
    const src = code(lireSource('src', 'cabinet', 'renderer', 'app.js'));
    const f = src.slice(src.indexOf('function importLine('), src.indexOf('function showImportReport('));
    assert.ok(f.length > 500 && f.length < 5000, 'la tranche d\'une ligne du compte rendu ne se trouve plus');
    assert.ok(/rep\.posees\) bits\.push/.test(f), 'le compte rendu ne dit pas les réponses reçues');
    assert.ok(/data-imp-rev=/.test(f), 'le compte rendu ne mène pas aux réponses');
    const g = src.slice(src.indexOf('function showImportReport('), src.indexOf('function showImportReport(') + 3000);
    assert.ok(/\[data-imp-rev\][\s\S]{0,200}comptabilite\/revision/.test(g), '« Lire la réponse » n\'ouvre pas la Révision du dossier');
    assert.ok(/livresState\.livreCle = ''; livresState\.revision = null;/.test(src), 'un import qui écrit dans le livre du dossier ouvert laisse l\'écran sur l\'ancien livre');
    // Un raccourci vise un PANNEAU (7.18.0), et la cible ne se pose qu'une fois la révision LUE.
    assert.ok(/\[data-imp-rev\][\s\S]{0,200}livresState\.revViser = 'rv-questions'/.test(g), '« Lire la réponse » ouvre la Révision en haut, la réponse trois panneaux plus bas');
    assert.ok(/<div class="panel" id="rv-questions">/.test(src), 'le panneau des questions n\'a pas l\'identifiant que le raccourci vise');
    const b = src.slice(src.indexOf('function brancherRevision('), src.indexOf('function brancherRevision(') + 1500);
    const iCharge = b.indexOf('chargerRevision(root, dossier); return; }'), iViser = b.indexOf('if (s.revViser) { pageFocus = s.revViser;');
    assert.ok(iCharge > 0 && iViser > iCharge, 'la cible se pose avant que la révision soit lue : focaliser la consomme sur l\'écran de chargement');
  });

  t('10.13.0 : la pièce qu\'une question nomme s\'ouvre, et le bandeau de la pièce ne pose pas un second vert', () => {
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const f = src.slice(src.indexOf('function lienPiece('), src.indexOf('\n  }\n', src.indexOf('function lienPiece(')));
    assert.ok(/#\/doc\//.test(f) && /#\/achat\//.test(f), 'la pièce d\'une question ne mène ni à la vente ni à l\'achat');
    assert.ok(/lienPiece\(q\.piece\)/.test(src), 'la liste des questions ne rend pas la pièce cliquable');
    const b = src.slice(src.indexOf('function bandeauQuestions('), src.indexOf('const brancherQuestions'));
    assert.ok(b.length > 200 && !/btn-primary/.test(b), '« Répondre » du bandeau est un second vert à côté du geste de la pièce (U-11)');
  });

  t('10.13.0 : l\'origine d\'un envoi du cabinet — « vérifiée » seulement contre une signature RETENUE', () => {
    // Trouvé au test humain du pont : « Origine vérifiée » s'affichait pour n'importe quel fichier
    // auto-signé. Le matricule d'un client est public ; une clôture importée VERROUILLE un exercice.
    const C = require(path.join(RACINE, 'src', 'renderer', 'core.js'));
    const V = C.verdictEnvoiCabinet;
    const bonne = { niveau: 'prouvee', empreinte: 'AAAA-AAAA-AAAA-AAAA-AAAA' };
    const autre = { niveau: 'prouvee', empreinte: 'BBBB-BBBB-BBBB-BBBB-BBBB' };
    const nue = { niveau: 'non-prouvee', empreinte: '', motif: 'Ce dossier n\'est pas signé.' };
    const fausse = { niveau: 'refusee', empreinte: 'CCCC-CCCC-CCCC-CCCC-CCCC', motif: 'La signature ne correspond pas.' };
    const pin = { empreinte: bonne.empreinte, depuis: 1 };
    // 1. signature fausse : refusé, avec ou sans signature retenue
    assert.strictEqual(V(null, fausse).ok, false);
    assert.strictEqual(V(pin, fausse).ok, false);
    // 2. pas de signature, rien de retenu : accepté, mais en le DISANT en rouge
    const a = V(null, nue);
    assert.ok(a.ok && a.alerte && /ORIGINE NON PROUVÉE/.test(a.ligne) && !a.epingler);
    // 3. pas de signature alors qu'une est retenue : refusé
    const b = V(pin, nue);
    assert.ok(!b.ok && b.etat === 'signature-manquante' && b.texte.includes(pin.empreinte));
    // 4. première signature : acceptée, retenue, et PAS dite « vérifiée »
    const c = V(null, bonne);
    assert.ok(c.ok && c.epingler === bonne.empreinte && !/vérifiée/.test(c.ligne) && /retenue/.test(c.ligne));
    // 5. la même : « origine vérifiée », sans rien retenir de plus
    const d = V(pin, bonne);
    assert.ok(d.ok && /Origine vérifiée/.test(d.ligne) && !d.epingler);
    // 6. une autre : refusée en nommant les DEUX empreintes
    const e = V(pin, autre);
    assert.ok(!e.ok && e.etat === 'autre-cle' && e.attendue === pin.empreinte && e.recue === autre.empreinte
      && e.texte.includes(pin.empreinte) && e.texte.includes(autre.empreinte));
    // La donnée : une forme qu'on ne reconnaît pas n'est pas retenue, et « Tout effacer » l'efface.
    assert.ok('cabinetSignature' in C.DEFAULT_DATA && C.DEFAULT_DATA.cabinetSignature === null);
    const m1 = C.migrateData({ cabinetSignature: { empreinte: '  ' } });
    assert.strictEqual(m1.cabinetSignature, null, 'une empreinte vide retenue ferait refuser tous les envois signés');
    const m2 = C.migrateData({ cabinetSignature: { empreinte: pin.empreinte, depuis: 5 } });
    assert.strictEqual(m2.cabinetSignature.empreinte, pin.empreinte);
  });

  t('10.13.0 : les deux imports du cabinet passent par le verdict, et ne retiennent qu\'une fois acceptés', () => {
    const src = code(lireSource('src', 'renderer', 'app.js'));
    for (const nom of ['importerCloture', 'importerQuestions']) {
      const i = src.indexOf('async function ' + nom + '(');
      const f = src.slice(i, src.indexOf('\n      }\n', i));
      assert.ok(i > 0 && f.length > 800 && f.length < 6000, nom + ' : la tranche ne se trouve plus (' + f.length + ')');
      const iV = f.indexOf('await origineAcceptee(lu,'), iQ = f.indexOf('await confirmDialog('), iR = f.indexOf('retenirSignature(orig)'), iOk = f.indexOf('if (!ok) return;');
      assert.ok(iV > 0 && iV < iQ, nom + ' : l\'origine doit se juger AVANT la question');
      assert.ok(iOk > 0 && iR > iOk, nom + ' : la signature se retient avant que l\'utilisateur ait accepté l\'import');
      assert.ok(!/lu\.origine\.niveau === 'prouvee'/.test(f), nom + ' : « vérifiée » se décide encore sur la seule signature du fichier');
    }
    // Le cabinet change, ou on le retire : la signature de l'ancien ne vaut plus rien.
    const p = src.slice(src.indexOf('function drawCabinetPair('), src.indexOf('drawCabinetPair();\n    drawLicencePanel();'));
    assert.ok(/if \(avant && avant !== r\.fingerprint\) data\.cabinetSignature = null;/.test(p), 'un nouveau cabinet hérite de la signature de l\'ancien');
    assert.ok(/delete data\.company\.cabinet; data\.cabinetSignature = null;/.test(p), 'retirer le cabinet garde sa signature');
    assert.ok(/id="cab-oublier-sig"/.test(p), 'la signature retenue ne s\'oublie nulle part : un comptable qui change de clé bloquerait son client');
  });

  t('10.13.0 : accepter une autre clé de signature ne se fait jamais par réflexe — Entrée annule', () => {
    const src = code(lireSource('src', 'renderer', 'app.js'));
    // La question sur la clé passe l'option ; confirmDialog l'honore en donnant le curseur à « Annuler »
    // (Entrée sur un bouton qui a le curseur clique CE bouton : le raccourci « bouton principal » de
    // modal() ne s'applique pas quand la cible est un bouton).
    const o = src.slice(src.indexOf('async function origineAcceptee('), src.indexOf('const retenirSignature'));
    assert.ok(o.length > 200 && o.length < 1500, 'origineAcceptee introuvable (' + o.length + ')');
    // Retournée vers la règle (10.14.0) : l'option gagne un titre, ce qui compte est `prudent: true`.
    assert.ok(/confirmDialog\([^;]*accepter', true, \{[^}]*prudent: true[^}]*\}\)/.test(o), 'la question sur une autre clé s\'accepte d\'un Entrée');
    const d = src.slice(src.indexOf('function confirmDialog('), src.indexOf('function infoDialog('));
    assert.ok(/if \(opts && opts\.prudent\) \$\('\[data-close\]', root\)\.focus\(\);/.test(d), 'confirmDialog ne donne pas le curseur à « Annuler » quand on le lui demande');
    const m = src.slice(src.indexOf("layer.addEventListener('keydown'"), src.indexOf('if (onMount) onMount(layer, close);'));
    assert.ok(/e\.target\.tagName === 'BUTTON'\) return;/.test(m), 'Entrée sur un bouton qui a le curseur doit rester à ce bouton');
  });

  t('10.13.0 : le curseur entre dans la fenêtre — dans les DEUX applications, par la même règle', () => {
    // Sans champ, il restait sur le bouton de la PAGE qui avait ouvert la question : Entrée
    // re-cliquait ce bouton derrière la fenêtre (le sélecteur de fichier se rouvrait par-dessus
    // l'import). Le Cabinet le faisait depuis la 10.12.0 ; l'app entreprise, jamais (7.3.0).
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js']]) {
      const src = code(lireSource(...f));
      const i = src.indexOf('function modal(');
      const corps = src.slice(i, src.indexOf('return close;', i));
      assert.ok(i > 0 && corps.length > 1500 && corps.length < 9000, f.join('/') + ' : la tranche de modal() ne se trouve plus (' + corps.length + ')');
      assert.ok(/const cible = saisie \|\| \(principal && !principal\.disabled \? principal : null\);/.test(corps), f.join('/') + ' : une question sans champ laisse le curseur sur la page');
      assert.ok(/if \(cible && !layer\.contains\(document\.activeElement\)\) cible\.focus\(\);/.test(corps), f.join('/') + ' : une question sans champ ne prend pas le curseur, ou la fenêtre reprend celui que l\'appelant a posé dedans');
      const iMount = corps.indexOf('if (onMount) onMount(layer, close);'), iCible = corps.indexOf('const cible = saisie');
      assert.ok(iMount > 0 && iCible > iMount, f.join('/') + ' : le curseur se décide avant que l\'appelant ait pu poser le sien');
    }
  });

  t('10.13.0 : la clé de signature du cabinet suit sa clé — tous ses postes signent pareil', () => {
    const Z = require(path.join(RACINE, 'src', 'zip.js'));
    const k = Z.generateCabinetKeys();
    const a = Z.cleSignatureDerivee(k.privateKey), b = Z.cleSignatureDerivee(k.privateKey);
    assert.strictEqual(a.publicKey, b.publicKey, 'deux postes du même cabinet ne signeraient pas pareil');
    assert.notStrictEqual(Z.cleSignatureDerivee(Z.generateCabinetKeys().privateKey).publicKey, a.publicKey, 'deux cabinets auraient la même signature');
    const man = Buffer.from('{"format":1}', 'utf8');
    assert.ok(Z.verifyManifest(man, Z.signManifest(man, a.privateKey, a.publicKey)).ok, 'la clé dérivée ne signe pas');
    const cm = code(lireSource('src', 'cabinet', 'main.js'));
    const f = cm.slice(cm.indexOf('function cleSignatureCabinet('), cm.indexOf('\n}\n', cm.indexOf('function cleSignatureCabinet(')));
    assert.ok(/Z\.cleSignatureDerivee\(state\.cabinet\.privateKey\)/.test(f), 'le Cabinet ne signe plus avec la clé dérivée');
    assert.ok(!/generateClientKeys|writeFileSync/.test(f), 'le Cabinet tire encore une clé de signature par poste');
    assert.ok(/signatureFingerprint/.test(cm), 'l\'écran du Cabinet ne connaît pas l\'empreinte de sa signature');
  });

  t('10.13.0 : aucune fenêtre de l\'app entreprise n\'écrit « * obligatoire » à la main — modal() la pose', () => {
    // Deux légendes dans la fenêtre de réponse au comptable : la recopiée ET la déduite (7.20.0).
    const src = code(lireSource('src', 'renderer', 'app.js'));
    assert.ok(/note\.innerHTML = '<b>\*<\/b> obligatoire'/.test(src), 'modal() ne pose plus la légende');
    assert.strictEqual((src.match(/\* obligatoire/g) || []).length, 0, 'une fenêtre écrit « * obligatoire » à la main : elle l\'affichera deux fois');
  });

  t('10.13.0 : la confirmation d\'import des questions s\'accorde au nombre', () => {
    const src = code(lireSource('src', 'renderer', 'app.js'));
    const f = src.slice(src.indexOf('async function importerQuestions('), src.indexOf('async function importerQuestions(') + 2600);
    assert.ok(/v\.questions > 1 \? '• Elles s\\'afficheront/.test(f) && /'• Elle s\\'affichera en face de la pièce/.test(f),
      '« Elles s\'afficheront… » pour une seule question');
  });

  t('10.13.0 : la signature du client n\'est pas un fichier glissé dans le paquet', () => {
    // Trouvé en envoyant un vrai paquet d'une application à l'autre : « ⚠ 1 fichier présent mais non
    // annoncé par ton client » sur un paquet honnête, fabriqué à l'instant. `signature.json` signe les
    // octets du manifeste, il ne peut donc pas y figurer — et il était compté comme intrus.
    const K = require(path.join(RACINE, 'src', 'cabinet', 'cabcore.js'));
    const man = { fichiers: [{ chemin: 'journaux/ventes.csv', empreinte: 'aaa' }] };
    const signe = K.checkIntegrity(man, { 'journaux/ventes.csv': 'aaa', 'signature.json': 'zzz' });
    assert.deepStrictEqual(signe.intrus, [], 'la signature du client passe pour un fichier glissé après coup');
    assert.ok(signe.ok);
    // Et un vrai intrus reste un intrus : l'exception est NOMMÉE, elle n'ouvre rien d'autre.
    const glisse = K.checkIntegrity(man, { 'journaux/ventes.csv': 'aaa', 'signature.json': 'zzz', 'facture.pdf.command': 'x' });
    assert.deepStrictEqual(glisse.intrus, ['facture.pdf.command']);
    // Un verdict déjà RANGÉ (paquet reçu entre la 9.2.0 et la 10.13.0) se relit sans la signature,
    // et un vrai intrus rangé avec elle reste un intrus.
    const ancien = K.migrateDossier({ packs: [
      { month: '2026-07', integrity: { checked: 12, bad: [], intrus: ['signature.json'], ok: false } },
      { month: '2026-08', integrity: { checked: 12, bad: [], intrus: ['signature.json', 'x.command'], ok: false } }
    ] });
    assert.deepStrictEqual(ancien.packs[0].integrity, { checked: 12, bad: [], intrus: [], ok: true });
    assert.deepStrictEqual(ancien.packs[1].integrity.intrus, ['x.command']);
    assert.strictEqual(ancien.packs[1].integrity.ok, false);
    // Le nom que l'app entreprise ÉCRIT est celui que le Cabinet exempte : deux moitiés, un seul nom.
    const ent = code(lireSource('src', 'main.js'));
    const ecrit = [...ent.matchAll(/files\.push\(\{ name: '([^']+)'/g)].map(m => m[1]).filter(n => n.endsWith('.json'));
    assert.ok(ecrit.includes('signature.json'), 'l\'app entreprise n\'écrit plus signature.json sous ce nom (' + ecrit.join(', ') + ')');
    assert.ok(K.HORS_MANIFESTE.includes('signature.json') && K.HORS_MANIFESTE.includes('manifeste.json'));
    // La vue d'un paquet lit la même liste, et le compte rendu ne dit l'alerte qu'une fois.
    const cm = code(lireSource('src', 'cabinet', 'main.js'));
    assert.ok(/annonce: !annonces \|\| K\.HORS_MANIFESTE\.includes\(e\.name\)/.test(cm), 'la vue d\'un paquet marque encore la signature d\'un « ? »');
    const cr = code(lireSource('src', 'cabinet', 'renderer', 'app.js'));
    assert.strictEqual((cr.match(/integ\.intrus \|\| \[\]\)\.length/g) || []).length, 1, 'le compte rendu d\'import dit deux fois la même alerte');
  });

  t('10.13.0 : écrire le fichier de questions ne se dit pas « envoyé » — il reste à le transmettre', () => {
    const src = code(lireSource('src', 'cabinet', 'renderer', 'app.js'));
    const f = src.slice(src.indexOf('function envoyerQuestions('), src.indexOf('\n  }\n', src.indexOf('function envoyerQuestions(')));
    assert.ok(f.length > 800 && f.length < 5000, 'la tranche d\'envoi des questions ne se trouve plus (' + f.length + ')');
    assert.ok(!/toast\(`\$\{pl\(r\.envoyees, 'question envoyée'/.test(f), '« 1 question envoyée » : un fichier écrit n\'est pas un envoi');
    assert.ok(/'Le montrer dans le dossier', false, 'Fermer'\)/.test(f) && /api\.reveal\(r\.path\)/.test(f), 'le compte rendu ne dit plus où est le fichier ni ne le montre');
    assert.ok(/refus\(\$\('#qe-pw', couche\)/.test(f), 'un mot de passe trop court ne montre pas sa case');
  });
};
