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
};
