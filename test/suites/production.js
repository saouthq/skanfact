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

  // ---------------------------------------------------------------- une seule hauteur
  t('10.13.0 : tout ce qui flotte par-dessus l\'application se pose à la MÊME hauteur', () => {
    // Trois hauteurs coexistaient — questions à 7 %, palette à 12 %, assistant et verrou centrés —,
    // et « Passer la suite ? » s'ouvrait au-dessus de l'assistant qu'elle concernait.
    const css = code(lireSource('src', 'renderer', 'style.css'));
    assert.ok(/--haut-fenetre:\s*\d+vh;/.test(css), 'la hauteur commune n\'est plus déclarée');
    for (const sel of ['.modal-bg', '#palette-root', '#setup', '#lock-screen']) {
      const m = css.match(new RegExp('^' + sel.replace(/[.#-]/g, c => '\\' + c) + ' \\{([^}]*)\\}', 'm'));
      assert.ok(m, sel + ' : règle introuvable');
      assert.ok(/var\(--haut-fenetre\)/.test(m[1]), sel + ' : ne se pose pas à la hauteur commune');
      assert.ok(/align-items:\s*flex-start/.test(m[1]), sel + ' : centré verticalement — il ne tombe plus à la hauteur de ses questions');
    }
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
};
