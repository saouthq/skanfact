// Configuration electron-builder de la SECONDE application du dépôt : SkanFact Cabinet.
//
// Même code source, même dépendances, un autre point d'entrée (`src/cabinet/main.js`) et un autre
// identifiant de paquet. `appId` doit rester distinct de `tn.skancyber.skanfact` : c'est ce qui
// permet à un comptable d'avoir les deux applications installées côte à côte — il est souvent
// lui-même une entreprise.
//
// Depuis la 6.6.0, les deux applications partagent le même numéro de version et la même release
// GitHub. Ce qui les sépare, c'est le **canal** de mise à jour : `latest.yml` pour l'entreprise,
// `cabinet.yml` pour le cabinet. Sans ça, le second écraserait le fichier du premier et chaque app
// proposerait à ses utilisateurs la mise à jour de l'autre.
//
// Le `.zip` mac redevient nécessaire : c'est lui qu'electron-updater télécharge sur macOS (le .dmg
// ne sert qu'à la première installation).
const pkg = require('../package.json');

module.exports = {
  appId: 'tn.skancyber.skanfact.cabinet',
  productName: 'SkanFact Cabinet',
  extraMetadata: {
    name: 'skanfact-cabinet',
    productName: 'SkanFact Cabinet',
    version: pkg.version,
    main: 'src/cabinet/main.js'
  },
  files: ['src/**/*', 'package.json', 'CHANGELOG.md'],
  directories: { output: 'dist-cabinet' },
  mac: {
    target: [{ target: 'dmg', arch: ['universal'] }, { target: 'zip', arch: ['universal'] }],
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
  publish: {
    provider: 'github',
    owner: 'saouthq',
    repo: 'skanfact',
    releaseType: 'release',
    channel: 'cabinet'          // → cabinet.yml / cabinet-mac.yml, à côté de latest.yml
  },
  artifactName: 'SkanFact-Cabinet-${version}-${os}-${arch}.${ext}'
};
