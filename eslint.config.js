// Le lint (9.1.0, SPEC-OUT-003).
//
// Pourquoi maintenant. Ce dépôt attrape déjà beaucoup par des tests qui RELISENT la source — les
// appels à une fonction qui n'existe pas, les `C.<nom>` absents de core.js, les pluriels mal
// accordés. Ils sont écrits à la main, un par défaut rencontré, et chacun a coûté une session. Un
// analyseur syntaxique fait gratuitement la moitié du travail, et sur TOUT le fichier : une
// variable d'une autre route (7.20.0), une fonction d'un autre module (7.22.0), un `var` qui fuit
// d'un bloc. Ces trois-là restaient blancs jusqu'à l'exécution de la ligne, et `node --check` ne
// voit rien.
//
// Ce que le lint ne fait PAS, et qu'il ne faut pas lui demander : juger le style. Aucune règle de
// mise en forme ici — pas de point-virgule obligatoire, pas de largeur de ligne, pas de guillemets
// imposés. Un lint qui crie sur mille lignes de formatage cesse d'être lu, et emmène avec lui les
// dix erreurs qui comptaient. Et `innerHTML` n'est pas interdit : l'application est faite de
// gabarits, et la vraie règle — « toute interpolation passe par `h()` » — est tenue par les tests
// de source, qui la comprennent alors qu'un lint ne le peut pas.
//
// Première passe : les avertissements sont tolérés, les erreurs non. On n'ajoute une règle `error`
// que le jour où la base la passe déjà — sinon le lint naît rouge, et un lint rouge est un lint
// qu'on désactive.
//
// eslint . — ou `npm run lint`.

// Les globales du navigateur et d'Electron. Elles sont énumérées à la main plutôt qu'importées
// d'un paquet de définitions : c'est trois lignes, ça ne dépend de rien, et la liste DIT ce que
// l'application a le droit d'utiliser.
const NAVIGATEUR = {
  window: 'readonly', document: 'readonly', location: 'readonly', navigator: 'readonly',
  localStorage: 'readonly', sessionStorage: 'readonly', history: 'readonly',
  fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly',
  FileReader: 'readonly', Image: 'readonly', Event: 'readonly', CustomEvent: 'readonly',
  MutationObserver: 'readonly', ResizeObserver: 'readonly', IntersectionObserver: 'readonly',
  // Parcourir les nœuds de TEXTE d'un bloc sans toucher aux balises : c'est ce qui permet de poser
  // l'espace insécable de la ponctuation française sans réécrire du HTML (9.4.2).
  NodeFilter: 'readonly',
  getComputedStyle: 'readonly', matchMedia: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
  performance: 'readonly', crypto: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
  btoa: 'readonly', atob: 'readonly', alert: 'readonly', self: 'readonly',
  HTMLElement: 'readonly', Node: 'readonly', DOMParser: 'readonly', AbortController: 'readonly'
};

const NODE = {
  require: 'readonly', module: 'writable', exports: 'writable', process: 'readonly',
  Buffer: 'readonly', __dirname: 'readonly', __filename: 'readonly', global: 'readonly',
  console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', setImmediate: 'readonly',
  queueMicrotask: 'readonly', structuredClone: 'readonly',
  // Node 22 pose l'API fetch en global. Les tests s'en servent pour appeler le vrai worker
  // (`e2e:plateforme`, `e2e:pont`) : ce ne sont pas des globales de navigateur oubliées.
  Request: 'readonly', Response: 'readonly', Headers: 'readonly', FormData: 'readonly'
};

// Les modules que les deux applications posent sur `window` et se partagent.
const PARTAGES = {
  SkanCore: 'readonly', SkanCompta: 'readonly', SkanDemo: 'readonly', SkanGuide: 'readonly',
  SkanOnboarding: 'readonly', RowMenu: 'readonly', Reglages: 'readonly', MajUI: 'readonly',
  Visite: 'readonly', SkanVisites: 'readonly', Nouveautes: 'readonly',
  CabCore: 'readonly', CabGuide: 'readonly'
};

// Les deux fautes de date qui ont gelé l'application entière chez l'utilisateur (5.2.3). Une date
// de SkanFact est un JOUR de calendrier, pas un instant : toute arithmétique se fait en UTC pur.
// `new Date(y, m, d)` construit en heure locale et `getDay()` la relit de même — à Tunis, minuit
// est 23 h la veille en UTC, donc `addDays(d, 1)` rendait `d` et la boucle de `workingDays` ne
// finissait jamais. Sur la machine de test, en UTC, rien ne se voyait. Ces deux lignes sont le
// garde-fou que je n'avais pas ce jour-là.
const DATES = ['error',
  { selector: "NewExpression[callee.name='Date'][arguments.length>1]", message: 'new Date(y, m, d) construit un jour LOCAL — utiliser Date.UTC(…) ou new Date(iso + "T00:00:00Z") (CLAUDE.md 5.2.3)' },
  { selector: "CallExpression[callee.property.name='getDay']", message: 'getDay() lit le jour LOCAL — utiliser getUTCDay() (CLAUDE.md 5.2.3)' },
  { selector: "CallExpression[callee.property.name='setDate']", message: 'setDate() écrit le jour LOCAL — utiliser setUTCDate() (CLAUDE.md 5.2.3)' }
];

const COMMUNES = {
  'no-var': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  // Trois façons d'exécuter une chaîne. `main.js` sérialise `fitToPage` et `paginate` vers la
  // fenêtre PDF, ce qui est délibéré et passe par `executeJavaScript` — pas par eval.
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-undef': 'error',
  // `builtinGlobals: false` : `const crypto = require('crypto')` est du Node correct, et le
  // refuser au motif qu'une globale du même nom existe ferait renommer des imports justes.
  'no-redeclare': ['error', { builtinGlobals: false }],
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-unsafe-negation': 'error',
  'no-unreachable': 'error',
  // En avertissement, pas en erreur : la base en porte, et les corriger est un autre chantier.
  //
  // `caughtErrorsIgnorePattern` (10.0.1) : `catch (_) {}` est la façon dont ce dépôt écrit « je
  // jette délibérément cette erreur » — un `localStorage` refusé en navigation privée, un
  // `JSON.parse` sur un réglage qu'on sait pouvoir être absent. ESLint 9 vérifie les liaisons de
  // `catch` par défaut et n'applique PAS `varsIgnorePattern` : trente avertissements sur une
  // convention volontaire, au milieu desquels les vrais se perdaient. Ce qui reste signalé est
  // alors la bonne question : `catch (e)` où `e` n'est jamais lu, c'est-à-dire un endroit où
  // quelqu'un comptait s'en servir.
  'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
  'prefer-const': 'warn',
  'no-empty': ['warn', { allowEmptyCatch: true }]
};

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'dist-cabinet/**', 'dist-e2e/**', 'build/release-notes.md']
  },
  {
    // Les deux applications, les tests, les scripts. `sourceType: 'script'` : ce dépôt est en JS
    // pur sans empaqueteur, et c'est une décision qui ne se rediscute pas.
    files: ['src/**/*.js', 'test/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...NAVIGATEUR, ...NODE, ...PARTAGES }
    },
    rules: { ...COMMUNES, 'no-restricted-syntax': DATES }
  },
  {
    // Le relais de mise à jour et la console : des modules ES qui tournent sur Cloudflare Workers.
    // Pas de `require`, pas de `Buffer`, et une plateforme qui n'a ni `window` ni `document`.
    files: ['worker/**/*.mjs', 'plateforme/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        fetch: 'readonly', Response: 'readonly', Request: 'readonly', Headers: 'readonly',
        crypto: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
        btoa: 'readonly', atob: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
        console: 'readonly', caches: 'readonly', addEventListener: 'readonly'
      }
    },
    rules: { ...COMMUNES, 'no-restricted-syntax': DATES }
  }
];
