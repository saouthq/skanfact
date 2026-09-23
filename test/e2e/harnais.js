// Le petit harnais commun aux tests qui lancent l'application POUR DE VRAI.
//
// Pourquoi ces tests existent : `npm test` vérifie les calculs sans DOM et sans Electron. Il ne peut
// pas attraper une fonction appelée mais jamais définie dans un gabarit, une classe CSS qui prend en
// silence les règles d'une autre application, un bouton inerte parce qu'un écran passe devant, ou un
// gel de l'interface. Tout ça ne se voit qu'en ouvrant vraiment l'application.
//
// Pourquoi ce fichier est DANS le dépôt : ces scripts vivaient dans un dossier de travail temporaire,
// effacé à chaque session. Il fallait donc les réécrire de mémoire à chaque fois, et ils dérivaient —
// une assertion sur le numéro de version restait sur une version périmée, un écran nouveau n'était
// jamais parcouru. Un test qu'on doit réécrire pour s'en servir n'est pas un test.
//
// Playwright n'est pas une dépendance du projet (il ne sert qu'ici, et il pèse plus que
// l'application) : on le cherche là où il peut être, et on le dit clairement s'il manque.
const path = require('path');
const fs = require('fs');

const ENDROITS = [
  'playwright',                                       // installé dans le projet
  '/opt/node22/lib/node_modules/playwright',          // installé pour tout le système
  '/usr/lib/node_modules/playwright',
  '/usr/local/lib/node_modules/playwright'
];

function playwright() {
  for (const p of ENDROITS) {
    try { return require(p); } catch { /* on essaie le suivant */ }
  }
  console.error(
    '\nPlaywright est introuvable. Ces tests ouvrent l\'application réelle et en ont besoin :\n' +
    '  npm i -D playwright      (puis relancer)\n' +
    'Sur une machine sans écran, les lancer sous Xvfb :\n' +
    '  xvfb-run -a node test/e2e/<fichier>.js\n');
  process.exit(4);
}

const RACINE = path.join(__dirname, '..', '..');
const ELECTRON = path.join(RACINE, 'node_modules', '.bin', 'electron');

// Les clés de signature de l'ÉDITEUR vivent dans ~/.skanfact (7.33.0). Un parcours lancé sur son Mac
// ouvrirait l'application ARMÉE avec sa clé — puis verrouillée au trente-et-unième jour. Tout test
// qui lance Electron hérite de `process.env` : on désigne ici, une fois pour toutes, un dossier de
// clés vide et temporaire. Un test qui veut le sien (licence.js) le remplace dans son `env`.
if (!process.env.SKANFACT_DOSSIER_CLES) {
  process.env.SKANFACT_DOSSIER_CLES = fs.mkdtempSync(path.join(require('os').tmpdir(), 'skanfact-cles-vide-'));
}

// La version que les tests doivent voir affichée. Lue dans package.json plutôt qu'écrite en dur :
// c'est exactement l'assertion qui se périmait à chaque publication.
const VERSION = require(path.join(RACINE, 'package.json')).version;

// Un compteur d'étapes et deux fonctions d'affichage, pour que la sortie se lise sans effort.
function journal() {
  let n = 0;
  return {
    etape: m => { n++; console.log('\n' + n + '. ' + m); },
    ok: m => console.log('  ✓ ' + m),
    total: () => n
  };
}

// Les erreurs JS du renderer : le vrai butin de ces tests. Une seule suffit à faire échouer.
function surveiller(win, tag, bac) {
  win.on('pageerror', e => bac.push(`${tag || ''} PAGEERROR: ${e.message}`));
  win.on('console', m => { if (m.type() === 'error') bac.push(`${tag || ''} CONSOLE: ${m.text()}`); });
}

function dossierCaptures(nom) {
  const d = process.env.SHOTS || path.join(RACINE, 'dist-e2e', nom);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// ---------------------------------------------------------------------------- les sondes de rendu
//
// Elles vivaient chacune DANS son parcours — `contraste.js`, `colonnes.js`, `entetes.js` — et les
// trois ne regardaient que l'application entreprise. L'app Cabinet a hérité de ses fonctionnalités
// et d'aucun de ses garde-fous visuels : c'est très exactement pourquoi elle a dérivé (des onglets
// qui ne montrent pas lequel est ouvert pendant trois versions, des champs muets, des tableaux de
// six mille pixels). Recopier les sondes dans un quatrième fichier aurait garanti la divergence
// (règle 7.29.0) ; elles sont donc ici, en un exemplaire, et les quatre parcours les partagent.
//
// Chacune est une fonction PURE du document, passée telle quelle à `win.evaluate` : elle ne connaît
// ni Playwright, ni Electron, ni laquelle des deux applications elle mesure.

// 1. Le contraste : les boutons ET les champs de saisie, lisibles, et dans la fenêtre. On remonte
//    les ancêtres jusqu'à un fond opaque, parce qu'un élément dont le fond est `transparent` est
//    peint par ce qu'il y a derrière.
//
//    Pourquoi les DEUX, et pourquoi dans la même sonde. La moitié « champs » existait, écrite en
//    7.30.0 pour un défaut que la relecture du CSS ne pouvait pas voir : en thème sombre, chaque
//    `<input>` gardait son fond CLAIR avec le texte clair du thème — contraste 1,18, c'est-à-dire
//    du blanc sur du blanc, depuis que le thème existe. Elle a été PERDUE dans la refonte de la
//    9.4.3, quand la sonde a déménagé ici pour être partagée : seuls les boutons ont fait le
//    voyage, et CLAUDE.md a continué d'affirmer pendant onze versions que « e2e:contraste mesure
//    désormais les champs autant que les boutons ». Une règle que plus rien ne tient est un bug
//    (7.3.0), et celle-ci couvrait trois surfaces au lieu d'une.
//
//    Une seule sonde parce que les quatre fonctions de mesure (luminance, fond opaque, débordement)
//    seraient sinon recopiées dans une seconde — et une copie diverge, toujours (7.29.0). Deux
//    listes NOMMÉES parce que les comptes ne se mélangent pas : « 2 125 boutons » doit rester
//    comparable d'une version à l'autre, et un instrument doit dire combien il a mesuré de quoi.
const SONDE_CONTRASTE = () => {
  const lum = ([r, g, b]) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const opaque = s => { const v = rgb(s); return v.length >= 3 && (v.length < 4 || v[3] >= 0.95) ? v.slice(0, 3) : null; };
  const fondDe = el => {
    for (let n = el; n; n = n.parentElement) {
      const v = opaque(getComputedStyle(n).backgroundColor);
      if (v) return v;
    }
    return [255, 255, 255];
  };
  // Un bouton qui dépasse n'est pas toujours HORS de l'écran : s'il vit dans un conteneur qui
  // défile vraiment de côté, il est à une molette, et le projet a tranché que ce n'est pas un
  // défaut (7.13.0 sur `.scroll-x`, 9.4.4). La sonde rend donc le FAIT — « il est dans quelque
  // chose qui défile » — et laisse l'appelant décider : elle ne connaît ni la classe que telle
  // surface emploie pour le marquer (`.scroll-x` dans les applications, `.wrap` dans la console),
  // ni ce que cet appelant-là veut en faire.
  const defile = el => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX;
      if ((o === 'auto' || o === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
  };
  const visible = (el, s, r) => r.width && r.height && s.visibility !== 'hidden' && s.display !== 'none';
  const contraste = (t, f) => {
    const a = lum(t), c = lum(f);
    return +(((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05))).toFixed(2);
  };

  const boutons = [];
  document.querySelectorAll('button, .btn').forEach(b => {
    const r = b.getBoundingClientRect();
    const s = getComputedStyle(b);
    if (!visible(b, s, r)) return;
    if (!b.textContent.trim()) return;             // un pictogramme seul n'est pas jugé ici
    if (b.disabled || s.opacity < 0.3) return;     // un bouton désactivé a le droit d'être pâle
    const f = fondDe(b);
    boutons.push({
      texte: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40),
      id: b.id || '', cls: String(b.className || '').split(' ')[0],
      color: s.color, bg: `rgb(${f.join(',')})`,
      ratio: contraste(rgb(s.color).slice(0, 3), f),
      hors: Math.round(Math.max(0, r.right - document.documentElement.clientWidth)),
      defilant: defile(b)
    });
  });

  // Les CHAMPS DE SAISIE, par la même méthode et pour le même défaut. Une case à cocher, un bouton
  // radio, un sélecteur de fichier, une réglette et un sélecteur de couleur n'affichent aucun texte
  // qui leur soit propre : les juger reviendrait à mesurer la couleur d'un dessin du système.
  // `select` et `textarea` comptent autant que `input` — c'est précisément parce qu'ils n'étaient
  // PAS touchés par le défaut de la 7.30.0 (dans une liste de sélecteurs, chacun porte sa propre
  // spécificité) que l'écran paraissait à moitié correct, ce qui est la pire façon d'être faux.
  //
  // Un champ DÉSACTIVÉ a le droit d'être pâle, comme un bouton. Un champ en lecture seule, non : il
  // se lit, donc il doit être lisible.
  const champs = [];
  document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file])'
    + ':not([type=range]):not([type=color]):not([type=hidden]), select, textarea').forEach(el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (!visible(el, s, r)) return;
    if (el.disabled || s.opacity < 0.3) return;
    const t = rgb(s.color); if (t.length < 3) return;
    const f = fondDe(el);
    champs.push({
      texte: 'champ ' + (el.name || el.id || el.getAttribute('aria-label') || el.tagName.toLowerCase()),
      id: el.id || '', cls: String(el.className || '').split(' ')[0],
      color: s.color, bg: `rgb(${f.join(',')})`,
      ratio: contraste(t.slice(0, 3), f)
    });
  });

  return { boutons, champs };
};

// 2. Les colonnes : l'en-tête aligné comme ses valeurs. `table.list th` (une classe, deux éléments)
//    l'emporte sur `th.r` — le HTML est juste, c'est la feuille qui décide, et ça ne se voit qu'en
//    mesurant (7.23.0).
const SONDE_COLONNES = () => {
  const ecarts = []; let colonnes = 0;
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const norme = a => (a === 'start' ? 'left' : a === 'end' ? 'right' : a);
  document.querySelectorAll('table').forEach(table => {
    if (!visible(table)) return;
    const ths = [...table.querySelectorAll('thead th')];
    const corps = [...table.querySelectorAll('tbody tr')].filter(visible);
    colonnes += ths.length;
    if (!ths.length || !corps.length) return;
    ths.forEach((th, i) => {
      const titre = (th.textContent || '').replace(/\s+/g, ' ').trim();
      if (!titre) return;                                    // colonne d'actions : rien à aligner
      const comptes = {};
      corps.forEach(tr => {
        const td = tr.children[i];
        if (!td || td.colSpan > 1) return;
        let a;
        if ((td.textContent || '').trim()) a = getComputedStyle(td).textAlign;
        else {
          // Une cellule qui porte un CHAMP (10.12.0) : c'est le champ qui aligne ce qu'on lit — des
          // chiffres à droite dans « Qté » et « P.U. HT » —, pas la cellule, restée à gauche. La sonde
          // sautait ces cellules (leur `textContent` est vide) : les en-têtes des cinq éditeurs de
          // lignes n'étaient jugés par personne, et ils étaient à gauche au-dessus de chiffres à droite.
          const champs = [...td.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')].filter(visible);
          if (champs.length !== 1 || !String(champs[0].value || '').trim()) return;
          a = getComputedStyle(champs[0]).textAlign;
        }
        comptes[a] = (comptes[a] || 0) + 1;
      });
      const paires = Object.entries(comptes).sort((x, y) => y[1] - x[1]);
      if (!paires.length) return;
      if (norme(getComputedStyle(th).textAlign) !== norme(paires[0][0])) {
        ecarts.push({ colonne: titre, entete: norme(getComputedStyle(th).textAlign), cellules: norme(paires[0][0]) });
      }
    });
  });
  return { colonnes, ecarts };
};

// 3. Les barres d'en-tête : aucun contrôle étiré d'un bord à l'autre, aucune barre sur trois rangées.
//    Un `select` hérite de `width: 100%` de la règle générale des champs ; dans un conteneur flex,
//    chacun réclame donc toute la ligne (7.23.0).
//
//    `barres` nomme les conteneurs à juger, parce que les trois surfaces du produit ne rangent pas
//    leurs actions sous le même nom : les deux applications ont `#view .page-head .actions`, la
//    console de l'éditeur a `main .bar`. La sonde ne connaît ni l'une ni l'autre — c'est l'appelant
//    qui dit où regarder, et le défaut jugé reste exactement le même. Un second exemplaire de cette
//    sonde, écrit pour la console, aurait divergé au premier ajustement (7.29.0).
//    `recherche` (10.12.0) dit ce qui compte comme un champ de RECHERCHE, jugé à `maxR` : les barres
//    de filtres de l'app entreprise en posent en `type="text"` (`#q`, `.q`), et leur recherche
//    prenait toute la ligne sans qu'aucune mesure ne regarde ces barres-là.
const SONDE_ENTETES = ({ maxL, maxR, maxH, barres, recherche }) => {
  const zones = [...document.querySelectorAll(barres || '#view .page-head .actions')]
    .filter(a => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (!zones.length) return { n: 0, larges: [], hauteur: 0 };
  let n = 0, hauteur = 0; const larges = [];
  zones.forEach(actions => {
    const ctrls = [...actions.querySelectorAll('select, input:not([type=checkbox]):not([type=radio])')];
    n += ctrls.length;
    ctrls.map(c => ({
      tag: c.tagName.toLowerCase(), id: c.id || c.name || c.className || '(sans nom)',
      w: Math.round(c.getBoundingClientRect().width),
      borne: (recherche ? c.matches(recherche) : c.type === 'search') ? maxR : maxL
    })).filter(x => x.w > x.borne).forEach(x => larges.push(x));
    if (ctrls.length) hauteur = Math.max(hauteur, Math.round(actions.getBoundingClientRect().height));
  });
  return { n, larges, hauteur, maxH };
};

// 4. L'ESPACEMENT des boutons. Signalé par Skander sur l'app Cabinet : « plein de boutons mal
//    espacés et collés au contenu ».
//
//    Pourquoi aucune des trois sondes précédentes ne pouvait le voir : elles mesurent un bouton
//    TOUT SEUL — sa couleur, son débordement — jamais sa distance à ce qui l'entoure. Or un bouton
//    collé au paragraphe du dessus est parfaitement lisible, parfaitement dans la fenêtre, et
//    parfaitement moche. C'est une propriété de la RELATION entre deux éléments, et il faut donc
//    la mesurer comme telle.
//
//    La règle a déjà été écrite deux fois pour un cas particulier — `td.actions .btn + .btn`
//    (7.29.0, deux boutons collés par un gabarit sans espace) et `.modal-actions` (6.8.0, des
//    boutons collés au texte faute de mise en page). Deux correctifs ponctuels pour un défaut
//    général : c'est le signe qu'il manquait la mesure.
//
//    Ce qu'on mesure : pour chaque bouton visible, l'écart géométrique avec son voisin de gauche et
//    celui de droite dans le document. Si les deux rectangles se chevauchent verticalement, ils
//    sont sur la même rangée et l'écart est horizontal ; sinon ils sont empilés et l'écart est
//    vertical. Un `gap` de flex, une marge, un `margin-inline-start` : peu importe d'où vient
//    l'espace, c'est le résultat À L'ÉCRAN qui est jugé.
//
//    Les exceptions sont NOMMÉES, jamais devinées — une exception anonyme est un trou (9.4.10) :
//      · `.tabs`     — un jeu d'onglets est un contrôle segmenté, ses boutons se touchent par
//                      construction et l'onglet actif se reconnaît à son trait, pas à son écart ;
//      · `.row-menu` — les entrées d'un menu déroulant sont une LISTE : les espacer en ferait des
//                      objets séparés flottant dans une boîte ;
//      · `.pager`    — même raison qu'un jeu d'onglets : une pagination est une bande.
//
//    `racine` borne la sonde au corps de la page, parce qu'une barre de fenêtre ou un pied n'ont
//    pas les mêmes règles d'espacement que le contenu. Les deux applications passent `#view`, la
//    console `body` : elle n'a pas de cadre fixe, tout son écran EST le contenu.
//
//    10.12.0 — et une FENÊTRE ouverte vit HORS de `#view`, dans `#modal-root`. Bornée au corps, la
//    sonde ne l'a jamais regardée : deux boutons collés dans la fenêtre du modèle de liasse (U-19)
//    passaient sans un mot. C'est T-55 une surface plus loin — un instrument qui n'atteint pas
//    l'écran annonce « tout va bien ». Les deux applications mesurent donc AUSSI la fenêtre du
//    dessus quand il y en a une (`FENETRE`), avec la même sonde et les mêmes exceptions.
const FENETRE = '#modal-root > .modal-bg:last-child .modal';
const SONDE_ESPACEMENT = ({ min, exceptions, racine }) => {
  const visible = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const nomme = el => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) return t.slice(0, 32);
    return el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '');
  };
  // Le rectangle qu'on MESURE est celui de l'encre, pas celui de la boîte. Un bouton qui porte un
  // fond ou une bordure a les deux confondus. Un bouton sans l'un ni l'autre — `.link-add`, un lien
  // souligné — n'est visible que par son texte, et son `padding` est du vide : « + description »
  // touchait son champ de 0 px de boîte alors que l'œil voit les 4 px de son `padding-top`.
  // Mesurer la boîte reviendrait à accuser du code juste, ce que le projet refuse autant qu'un test
  // trop étroit (9.1.0).
  const encre = el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    const fond = (s.backgroundColor.match(/[\d.]+/g) || []);
    const peint = fond.length >= 3 && (fond.length < 4 || Number(fond[3]) > 0.05);
    const borde = ['Top', 'Right', 'Bottom', 'Left'].some(c => parseFloat(s['border' + c + 'Width']) > 0);
    if (peint || borde) return r;
    const p = c => parseFloat(s['padding' + c]) || 0;
    return {
      top: r.top + p('Top'), bottom: r.bottom - p('Bottom'),
      left: r.left + p('Left'), right: r.right - p('Right'),
      get height() { return this.bottom - this.top; }, get width() { return this.right - this.left; }
    };
  };
  const out = []; let mesures = 0;
  const R = racine || '#view';
  document.querySelectorAll(R + ' button, ' + R + ' .btn').forEach(b => {
    if (!visible(b)) return;
    if (!(b.textContent || '').trim()) return;          // un pictogramme seul n'est pas jugé ici
    if (exceptions.some(sel => b.closest(sel))) return;
    const rb = encre(b);
    const cliquable = el => el.matches('button, .btn, a[href]');
    // Un bouton SEUL dans son conteneur n'a pas de frère : son voisin réel est celui du conteneur,
    // et c'est très souvent un TITRE de section. Sans cette remontée d'un cran, « + Ajouter une
    // ligne », seul dans son `<div>`, touchait le titre du panneau suivant sans qu'aucune mesure ne
    // le voie (T-49) — la sonde ne regardait que les frères du bouton, et il n'en avait aucun.
    // Mais « seul » veut dire SEUL. Un conteneur qui porte aussi du TEXTE n'est pas l'emballage du
    // bouton, c'est une phrase dans laquelle il est posé : ses voisins à lui sont des MOTS, pas des
    // objets, et l'espacement de la prose n'est pas le sujet de cette sonde. « téléphone à
    // renseigner » vit au milieu de la ligne d'identité d'une fiche ; remonter d'un cran revenait à
    // juger cette ligne contre le titre au-dessus — 28 accusations portées sur du code juste, dont
    // l'écart de 3 px est écrit noir sur blanc dans la feuille (`margin-block-start`). Un test trop
    // large accuse du code juste, ce qui est aussi grave qu'un test trop étroit (9.1.0, 9.4.7).
    const enProse = el => Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    const seul = b.parentElement && b.parentElement.children.length === 1
      && !b.parentElement.matches('td, th, li') && !enProse(b.parentElement);
    const ref = seul ? b.parentElement : b;
    [['avant', ref.previousElementSibling], ['après', ref.nextElementSibling]].forEach(([cote, v]) => {
      if (!v || !visible(v)) return;
      // La bulle « i » est une ANNOTATION : elle explique ce qu'elle touche, et elle DOIT le
      // toucher — l'écarter de son libellé la ferait flotter entre deux titres, et on ne saurait
      // plus lequel elle explique. On ne la juge donc que face à un autre objet cliquable : deux
      // bulles collées sont deux cibles qui se lisent comme une seule, et ça, c'est un défaut.
      if ((b.matches('button.i') || v.matches('button.i')) && !(cliquable(b) && cliquable(v))) return;
      const rv = encre(v);
      // Même rangée ? On exige un vrai recouvrement vertical — deux objets qui se frôlent d'un
      // pixel ne sont pas côte à côte, ils sont empilés et mal alignés.
      const haut = Math.max(rb.top, rv.top), bas = Math.min(rb.bottom, rv.bottom);
      const recouvre = bas - haut > Math.min(rb.height, rv.height) * 0.5;
      const ecart = recouvre
        ? (rv.left >= rb.right ? rv.left - rb.right : rb.left - rv.right)
        : (rv.top >= rb.bottom ? rv.top - rb.bottom : rb.top - rv.bottom);
      mesures++;
      if (ecart >= min) return;
      out.push({
        bouton: nomme(b), voisin: nomme(v), cote, sens: recouvre ? 'horizontal' : 'vertical',
        ecart: Math.round(ecart * 10) / 10,
        parent: v.parentElement ? (v.parentElement.className || v.parentElement.tagName).toString().split(' ')[0] : ''
      });
    });
  });
  return { mesures, colles: out, min };
};

// ---------------------------------------------------------------------------- la capture qui montre TOUT
//
// Pourquoi cette fonction existe : pendant des versions, TOUTES les captures de ces parcours se sont
// arrêtées au bas de la fenêtre. Ce n'était pas un oubli de `fullPage: true` — c'est que `fullPage`
// ne pouvait rien y faire. Les deux applications posent un cadre FIXE (`#app { height: 100vh }`) et
// c'est `main#view` qui défile : le DOCUMENT ne dépasse donc jamais la fenêtre, et une capture
// « page entière » rend exactement la même image qu'une capture d'écran. Une page de quatre écrans
// de haut se photographiait au quart, et on relisait ce quart en croyant relire la page.
//
// On relâche le cadre le temps de la photo, on photographie, on le remet. Ce qui est en `position:
// fixed` (une fenêtre modale, l'assistant, le voile) est relâché aussi, sans quoi il resterait à la
// taille de l'écran au milieu d'une image trois fois plus haute.
const RELACHE = `
  html, body { height: auto !important; overflow: visible !important; }
  #app { height: auto !important; min-height: 100vh; align-items: flex-start !important; }
  main, main#view { overflow: visible !important; }
  .sidebar { position: sticky !important; top: 0; align-self: flex-start !important; }
  .modal-bg, #setup, #lock-screen {
    position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important;
    height: auto !important; min-height: 100vh; align-items: flex-start !important; padding: 28px 0 !important;
  }
  .modal, #setup .wiz-card, .lock-card { max-height: none !important; overflow: visible !important; }
  .modal, #setup .wiz-card { margin: 0 auto; }
  #setup .wiz-body { overflow: visible !important; }
  .scroll-y, nav { overflow: visible !important; }
`;

// La console de l'éditeur est la TROISIÈME surface, et elle a le même cadre fixe pour la même
// raison — `.coque { height: 100vh }`, `main` qui défile à côté du rail. Ses sélecteurs ne sont pas
// ceux des deux applications, donc elle a son propre relâchement ; il vit ICI, à côté de l'autre,
// parce qu'un mécanisme recopié dans le parcours qui s'en sert diverge toujours (7.29.0). Ce qui
// n'est PAS relâché : `.wrap`, le conteneur qui fait défiler un tableau large de côté — l'élargir
// montrerait une page que personne ne voit, et c'est justement ce débordement que la sonde de
// densité mesure.
const RELACHE_CONSOLE = `
  html, body { height: auto !important; overflow: visible !important; }
  .coque { height: auto !important; min-height: 100vh; align-items: flex-start !important; }
  main { overflow: visible !important; }
  .rail { position: sticky !important; top: 0; align-self: flex-start !important; }
  .rail nav { overflow: visible !important; }
`;

async function capturePleine(win, chemin, opts = {}) {
  await win.evaluate(css => {
    const s = document.createElement('style');
    s.id = '__capture-pleine'; s.textContent = css;
    document.head.appendChild(s);
  }, opts.css || RELACHE);
  await win.waitForTimeout(opts.pose || 150);
  try {
    await win.screenshot({ path: chemin, fullPage: true });
  } finally {
    await win.evaluate(() => {
      const s = document.getElementById('__capture-pleine');
      if (s) s.remove();
    });
    await win.waitForTimeout(80);
  }
}

// Playwright installé dans le projet peut ne pas avoir SON chromium (image préchargée, version
// décalée) : il réclame alors `npx playwright install` alors qu'un navigateur parfaitement utilisable
// est déjà là, sous un autre numéro. On essaie le chemin normal, puis les navigateurs présents.
//
// Cette fonction vivait DANS pages.js. Elle est remontée ici le jour où un second parcours en a eu
// besoin : un mécanisme recopié diverge toujours (règle 7.29.0), et celui-ci est exactement le genre
// qu'on ne corrige qu'à un seul endroit sur deux.
async function ouvrirChromium(pw) {
  try { return await pw.chromium.launch({ args: ['--no-sandbox'] }); } catch (e) {
    const racines = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
    for (const r of racines) {
      let noms = [];
      try { noms = fs.readdirSync(r); } catch { continue; }
      for (const n of noms.filter(x => /^chromium(-\d+)?$/.test(x)).sort().reverse()) {
        for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
          const p = path.join(r, n, rel);
          if (fs.existsSync(p)) {
            try { return await pw.chromium.launch({ executablePath: p, args: ['--no-sandbox'] }); } catch { /* suivant */ }
          }
        }
      }
    }
    console.error('\nChromium est introuvable pour Playwright :\n  npx playwright install chromium\n');
    throw e;
  }
}

// Relire un montant AFFICHÉ (9.4.10). `core.money` écrit un négatif « − 1 234,500 DT » avec le SIGNE
// MOINS typographique (U+2212) et une espace derrière : cinq parcours le nettoyaient avec
// `[^\d,.-]`, qui ne garde que le trait d'union ASCII — le signe disparaissait et « − 4 000 »
// devenait quatre mille. Un tri décroissant paraissait alors non trié, selon la place des sorties
// dans le jeu d'exemple : le parcours tombait certains jours et pas d'autres, sur du code juste.
// Une seule fonction, ici, plutôt que cinq copies qui divergeront (règle 7.29.0).
function montant(texte) {
  const s = String(texte == null ? '' : texte).trim();
  const negatif = /^[-−–]/.test(s);
  const n = Number(s.replace(/[^\d,.]/g, '').replace(',', '.'));
  if (!isFinite(n)) return NaN;
  return negatif ? -n : n;
}

// 5. LA LARGEUR (10.5.0). Les quatre sondes précédentes mesurent des objets — leur couleur, leur
//    débordement, leur alignement, leur écart. Aucune ne regardait la PLACE PERDUE : la console
//    bornait tout son contenu à 1180 px, prose et tableaux confondus, et sur une fenêtre ordinaire
//    un tableau de dix colonnes se serrait pendant que 700 px restaient vides à droite. Ça ne
//    plante pas, ça ne déborde pas, ça n'est pas illisible — et c'est ce que Skander a vu du
//    premier coup d'œil sur une capture.
//
//    La règle mesurée n'est PAS « tout en pleine largeur » : une ligne de prose de 1900 px est
//    illisible. Ce qu'on interdit, c'est qu'un TABLEAU — un objet qui se compare colonne par
//    colonne — laisse plus que `perte` de la largeur disponible inutilisée. La prose, elle, a le
//    droit d'être bornée : la sonde ne juge que ce qu'on lui désigne.
const SONDE_LARGEUR = ({ cibles, perte }) => {
  const dispo = document.documentElement.clientWidth;
  const out = [];
  document.querySelectorAll(cibles).forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || el.offsetParent === null) return;
    // La place RÉELLEMENT offerte à cet élément : celle de son parent, pas celle de la fenêtre —
    // un tableau dans un rail étroit n'a pas à remplir l'écran.
    const p = el.parentElement ? el.parentElement.getBoundingClientRect().width : dispo;
    const libre = Math.max(0, p - r.width);
    if (libre > p * perte) {
      out.push({ quoi: el.className || el.tagName, largeur: Math.round(r.width), offert: Math.round(p), perdu: Math.round(libre) });
    }
  });
  return { dispo, gaspillages: out };
};

// ---------------------------------------------------------------- 6. la colonne collante
// 10.12.0 (U-02) — la colonne d'actions d'un tableau large reste collée au bord droit (9.4.4), pour
// que le menu d'une ligne reste sous la main. Collée, elle passe PAR-DESSUS ce qui défile dessous —
// et elle recouvrait « Débit » et « Crédit » dans le livre-journal, « Signalés » dans la liste des
// dossiers, juillet et août dans la Production (où c'était la colonne « À saisir », une DONNÉE, qui
// collait). Aucune des cinq sondes ne pouvait le voir : chacune mesure un objet, jamais la relation
// entre deux cellules. Celle-ci compare chaque cellule collante horizontalement à ses voisines de
// ligne, sur l'écran tel qu'il s'ouvre : une cellule de donnée qu'elle recouvre de plus de 2 px est
// une donnée qu'on ne lit pas. Les en-têtes collés en HAUT (`thead th`, collants verticalement) ne
// sont pas concernés : on ne juge que ce qui colle au bord de la ligne.
const SONDE_COLLANT = () => {
  const out = [];
  let tables = 0;
  document.querySelectorAll('.scroll-x').forEach(sx => {
    const t = sx.querySelector('table');
    if (!t || sx.offsetParent === null) return;
    tables++;
    const collante = c => {
      const cs = getComputedStyle(c);
      return cs.position === 'sticky' && (cs.insetInlineEnd !== 'auto' || cs.insetInlineStart !== 'auto');
    };
    [...t.rows].forEach(tr => {
      const cells = [...tr.cells];
      cells.filter(collante).forEach(c => {
        const rc = c.getBoundingClientRect();
        cells.forEach(d => {
          if (d === c || collante(d) || !d.textContent.trim()) return;
          const rd = d.getBoundingClientRect();
          const recouvre = Math.min(rc.right, rd.right) - Math.max(rc.left, rd.left);
          if (recouvre > 2) {
            out.push({ table: String(t.className || '').slice(0, 40), cellule: d.textContent.trim().replace(/\s+/g, ' ').slice(0, 24), px: Math.round(recouvre) });
          }
        });
      });
    });
  });
  return { tables, couverts: out };
};

// ---------------------------------------------------------------- 7. le texte coupé à côté du vide
// 10.12.0 (vu au test humain de la Banque) — une cellule `tronq` coupe son texte pour que le tableau
// TIENNE (U-02) : c'est juste quand la place manque. Dans les deux tableaux de suspens, elle coupait
// « COMMISSION SUR VIREMENT EMIS » à « COMMISSI… » pendant que la colonne de la date, juste à côté,
// gardait 94 px de blanc et celle du montant 108 — la part en % avait été pensée pour un livre à huit
// colonnes. Aucune des six sondes ne pouvait le voir : le texte ne déborde pas (il est coupé EXPRÈS),
// rien n'est hors de l'écran, rien n'est illisible au sens du contraste. C'est une relation entre
// deux colonnes, et elle se mesure comme telle : dans un tableau où une cellule coupe son texte,
// aucune AUTRE colonne ne doit garder plus de `vide` px au-delà de ce que son contenu demande (le
// plus large de ses cellules, en-tête compris, marges intérieures comprises). La colonne qui coupe
// est souple par définition : son vide à elle ne se juge pas. `racines` borne la sonde comme celle
// de l'espacement — le corps de la page, et la fenêtre du dessus s'il y en a une.
const SONDE_TRONQUE = ({ vide, racines }) => {
  const out = []; let tables = 0, coupees = 0;
  const besoin = el => {
    const cs = getComputedStyle(el);
    const bord = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    if (!el.childNodes.length) return bord;
    const r = document.createRange(); r.selectNodeContents(el);
    return r.getBoundingClientRect().width + bord;
  };
  // Coupé : la cellule elle-même, ou un élément qu'elle porte (la console coupe dans un `.cut`, le
  // Cabinet coupe la pièce « en face » à côté de son montant) — c'est la COLONNE qui est souple.
  const coupeEl = el => getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
  const coupe = c => (coupeEl(c) ? c : [...c.querySelectorAll('*')].find(coupeEl)) || null;
  const nom = c => (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32);
  (racines || ['#view']).forEach(sel => document.querySelectorAll(sel + ' table').forEach(t => {
    if (t.offsetParent === null) return;
    tables++;
    // Une ligne à cellule fusionnée n'a pas de colonnes : elle ne dit rien de leur largeur.
    const lignes = [...t.rows].filter(tr => tr.offsetParent !== null && ![...tr.cells].some(c => c.colSpan > 1));
    const cc = [];
    lignes.forEach(tr => [...tr.cells].forEach(c => { const el = coupe(c); if (el) cc.push({ c, el }); }));
    if (!cc.length) return;
    coupees += cc.length;
    const souples = new Set(cc.map(x => x.c.cellIndex));
    const n = Math.max(...lignes.map(tr => tr.cells.length));
    for (let i = 0; i < n; i++) {
      if (souples.has(i)) continue;
      const cells = lignes.map(tr => tr.cells[i]).filter(Boolean);
      if (!cells.length) continue;
      const libre = Math.max(...cells.map(c => c.getBoundingClientRect().width)) - Math.max(...cells.map(besoin));
      if (libre > vide) {
        const h = t.tHead && t.tHead.rows[0] && t.tHead.rows[0].cells[i];
        out.push({ colonne: h && nom(h) ? nom(h) : 'n° ' + (i + 1), libre: Math.round(libre),
          coupee: nom(cc[0].el), visible: Math.round(cc[0].el.clientWidth) });
      }
    }
  }));
  return { tables, coupees, gaspillages: out };
};

// ---------------------------------------------------------------- 8. la fenêtre qui défile de côté
// 10.12.0 (vu au test humain de la Banque) — dans la fenêtre « Choisir l'écriture en face », chaque
// ligne portait son bouton « Rapprocher »… derrière un défilement horizontal : on voyait « R », pas le
// geste. La sonde de contraste n'en dit rien, et c'est voulu — un bouton dans un conteneur qui défile
// est « à une molette » (7.13.0, 9.4.4) : un livre de dix colonnes a le droit de défiler, et sa
// colonne d'actions reste collée au bord. Une FENÊTRE, non : c'est une tâche qu'on fait d'un regard,
// et ce qui vit hors de sa largeur n'existe pas. On rend chaque conteneur qui défile de côté DANS la
// fenêtre, avec ce qu'il cache.
const SONDE_DEFILEMENT = ({ racine }) => {
  const out = [];
  document.querySelectorAll(racine + ', ' + racine + ' *').forEach(n => {
    if (n.offsetParent === null && n.tagName !== 'BODY') return;
    const o = getComputedStyle(n).overflowX;
    if ((o === 'auto' || o === 'scroll') && n.scrollWidth > n.clientWidth + 1) {
      const t = n.querySelector('th, td, button');
      out.push({ quoi: String(n.className || n.tagName).slice(0, 30), cache: n.scrollWidth - n.clientWidth,
        contenu: t ? (t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) : '' });
    }
  });
  return out;
};

// ---------------------------------------------------------------- la comptabilité d'un dossier
// 10.12.0 (U-06) — les quatorze écrans de la comptabilité d'un dossier du Cabinet sont rangés en
// trois groupes (Saisir, Consulter, Déclarer et clôturer) : un écran ne se clique qu'une fois son
// groupe ouvert. Ces deux fonctions passent par le groupe COMME UN COMPTABLE — elles ouvrent les
// groupes un par un jusqu'à trouver l'écran, sans connaître le rangement. Une copie de la table des
// groupes ici divergerait de celle de l'application au premier écran déplacé (7.29.0) ; celle-ci
// n'a rien à recopier, et un écran devenu introuvable fait TOMBER le parcours.
const selOngletCompta = onglet => `#c-tabs button[data-tab="${onglet}"]`;

// Vrai si l'écran existe dans l'un des groupes — c'est-à-dire, pour un écran du livre, si le livre
// existe. Le groupe qui le contient reste ouvert.
async function ongletComptaPresent(win, onglet, { timeout = 15000 } = {}) {
  await win.waitForSelector('#c-livres .c-nav', { timeout });
  if (await win.$(selOngletCompta(onglet))) return true;
  const groupes = await win.$$eval('#c-groupes button', bs => bs.map(b => b.dataset.groupe));
  for (const g of groupes) {
    await win.click(`#c-groupes button[data-groupe="${g}"]`);
    const vu = await win.waitForSelector(selOngletCompta(onglet), { timeout: 2500 }).then(() => true, () => false);
    if (vu) return true;
  }
  return false;
}

// Ouvre un écran de la comptabilité, et attend que son onglet soit l'onglet actif.
async function ongletCompta(win, onglet, { timeout = 15000 } = {}) {
  if (!(await ongletComptaPresent(win, onglet, { timeout }))) {
    throw new Error(`l'écran « ${onglet} » de la comptabilité est introuvable dans les trois groupes`);
  }
  await win.click(selOngletCompta(onglet));
  await win.waitForSelector(`${selOngletCompta(onglet)}.active`, { timeout });
}

// Tous les écrans atteignables, groupe par groupe — pour les instruments qui doivent les VOIR tous
// (T-55 : un instrument qui n'atteint pas l'écran annonce « tout va bien »).
async function ongletsCompta(win) {
  await win.waitForSelector('#c-livres .c-nav', { timeout: 15000 });
  // `innerText`, pas `textContent` : le point d'une pièce non enregistrée est caché, et son « ● »
  // ne fait pas partie du nom de l'écran.
  const lire = () => win.$$eval('#c-tabs button', bs => bs.map(b => ({ tab: b.dataset.tab, label: b.innerText.trim() })));
  const groupes = await win.$$eval('#c-groupes button', bs => bs.map(b => b.dataset.groupe));
  if (!groupes.length) return lire();
  const tous = [];
  for (const g of groupes) {
    await win.click(`#c-groupes button[data-groupe="${g}"]`);
    await win.waitForSelector(`#c-groupes button[data-groupe="${g}"].active`, { timeout: 8000 });
    (await lire()).forEach(o => { if (!tous.some(x => x.tab === o.tab)) tous.push({ ...o, groupe: g }); });
  }
  return tous;
}

// Fermer une application SANS jamais rester bloqué (E-01, rapport QA du 23/09/2026). `app.close()`
// attend qu'Electron quitte ; un garde-fou de sortie resté armé (« modifications non enregistrées »,
// 2.4.0) pose alors sa question dans une boîte que personne ne verra, et l'attente devient éternelle :
// `e2e:entreprise` passait ses 83 étapes puis ne rendait AUCUN code de sortie, deux processus
// Electron vivants un quart d'heure plus tard. Un parcours bloqué est pire qu'un parcours qui échoue
// (7.28.0) : on attend, puis on tue le processus et on DIT pourquoi. La règle existait depuis la
// 7.28.0 et n'était appliquée que sur 11 parcours sur 49 — elle vit désormais ici, en un seul
// exemplaire, et un test interdit tout `close()` d'application écrit à la main dans un parcours.
async function fermer(app, { delai = 15000, quoi = 'l\'application' } = {}) {
  if (!app) return;
  let bloque = false;
  let minuteur;
  await Promise.race([
    app.close().catch(() => {}),
    new Promise(r => { minuteur = setTimeout(() => { bloque = true; r(); }, delai); })
  ]);
  clearTimeout(minuteur);
  if (!bloque) return;
  try { app.process().kill('SIGKILL'); } catch (_) { /* déjà parti */ }
  throw new Error(`${quoi} ne se ferme pas en ${delai / 1000} s : un garde-fou de sortie attend sans doute une réponse (« modifications non enregistrées » ?). Le processus a été tué — quitte l'éditeur ou enregistre avant de fermer.`);
}

module.exports = {
  fermer,
  playwright, RACINE, ELECTRON, VERSION, journal, surveiller, dossierCaptures, ouvrirChromium,
  capturePleine, RELACHE_CONSOLE, SONDE_CONTRASTE, SONDE_COLONNES, SONDE_ENTETES, SONDE_ESPACEMENT, SONDE_LARGEUR, montant,
  ongletCompta, ongletComptaPresent, ongletsCompta, SONDE_COLLANT, SONDE_TRONQUE, SONDE_DEFILEMENT, FENETRE
};
