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

// ---------------------------------------------------------------------------- les trois sondes de rendu
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

// 1. Les boutons : lisibles, et dans la fenêtre. On remonte les ancêtres jusqu'à un fond opaque,
//    parce qu'un bouton dont le fond est `transparent` est peint par ce qu'il y a derrière.
const SONDE_BOUTONS = () => {
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
  const out = [];
  document.querySelectorAll('button, .btn').forEach(b => {
    const r = b.getBoundingClientRect();
    const s = getComputedStyle(b);
    if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none') return;
    if (!b.textContent.trim()) return;             // un pictogramme seul n'est pas jugé ici
    if (b.disabled || s.opacity < 0.3) return;     // un bouton désactivé a le droit d'être pâle
    const t = rgb(s.color).slice(0, 3), f = fondDe(b);
    const a = lum(t), c = lum(f);
    out.push({
      texte: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40),
      id: b.id || '', cls: String(b.className || '').split(' ')[0],
      color: s.color, bg: `rgb(${f.join(',')})`,
      ratio: +(((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05))).toFixed(2),
      hors: Math.round(Math.max(0, r.right - document.documentElement.clientWidth))
    });
  });
  return out;
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
        if (!(td.textContent || '').trim()) return;
        const a = getComputedStyle(td).textAlign;
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
const SONDE_ENTETES = ({ maxL, maxR, maxH }) => {
  const head = document.querySelector('#view .page-head');
  if (!head) return { n: 0, larges: [], hauteur: 0 };
  const actions = head.querySelector('.actions');
  if (!actions) return { n: 0, larges: [], hauteur: 0 };
  const ctrls = [...actions.querySelectorAll('select, input:not([type=checkbox]):not([type=radio])')];
  const larges = ctrls.map(c => ({
    tag: c.tagName.toLowerCase(), id: c.id || c.name || '(sans nom)',
    w: Math.round(c.getBoundingClientRect().width),
    borne: c.type === 'search' ? maxR : maxL
  })).filter(x => x.w > x.borne);
  return { n: ctrls.length, larges, hauteur: Math.round(actions.getBoundingClientRect().height), maxH };
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

async function capturePleine(win, chemin, opts = {}) {
  await win.evaluate(css => {
    const s = document.createElement('style');
    s.id = '__capture-pleine'; s.textContent = css;
    document.head.appendChild(s);
  }, RELACHE);
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

module.exports = {
  playwright, RACINE, ELECTRON, VERSION, journal, surveiller, dossierCaptures, ouvrirChromium,
  capturePleine, SONDE_BOUTONS, SONDE_COLONNES, SONDE_ENTETES
};
