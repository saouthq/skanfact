// Configuration electron-builder de la SECONDE application du dépôt : SkanFact Cabinet.
//
// Même code source, même dépendances, un autre point d'entrée (`src/cabinet/main.js`) et un autre
// identifiant de paquet. `appId` doit rester distinct de `tn.skancyber.skanfact` : c'est ce qui
// permet à un comptable d'avoir les deux applications installées côte à côte — il est souvent
// lui-même une entreprise.
//
// Sa version est indépendante de celle de l'app entreprise : elle vit dans `cabinetVersion` de
// package.json. Le paquet n'est PAS publié par electron-updater (pas de latest.yml) : les artefacts
// sont attachés à la release par le workflow. Le cabinet n'a donc pas encore de mise à jour
// automatique — c'est assumé en 1.0.0, il y a au plus quelques dizaines d'installations.
const pkg = require('../package.json');

module.exports = {
  appId: 'tn.skancyber.skanfact.cabinet',
  productName: 'SkanFact Cabinet',
  extraMetadata: {
    name: 'skanfact-cabinet',
    productName: 'SkanFact Cabinet',
    version: pkg.cabinetVersion,
    main: 'src/cabinet/main.js'
  },
  files: ['src/**/*', 'package.json', 'CHANGELOG.md'],
  directories: { output: 'dist-cabinet' },
  mac: {
    // Pas de .zip : il ne sert qu'à electron-updater, dont l'app cabinet ne se sert pas encore.
    // C'est 215 Mo de moins à téléverser à chaque release — et un téléversement de moins à rater.
    target: [{ target: 'dmg', arch: ['universal'] }],
    category: 'public.app-category.business',
    icon: 'build/icon-cabinet.png',
    hardenedRuntime: false,
    identity: null
  },
  dmg: {
    title: 'SkanFact Cabinet ${version}',
    contents: [{ x: 140, y: 200 }, { x: 400, y: 200, type: 'link', path: '/Applications' }],
    window: { width: 540, height: 380 }
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon-cabinet.png'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'SkanFact Cabinet',
    uninstallDisplayName: 'SkanFact Cabinet',
    installerLanguages: ['fr_FR'],
    language: '1036',
    runAfterFinish: true,
    deleteAppDataOnUninstall: false
  },
  publish: null,
  artifactName: 'SkanFact-Cabinet-${version}-${os}-${arch}.${ext}'
};
