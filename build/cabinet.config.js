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
    main: 'src/cabinet/main.js',
    // Adresse du relais de mise à jour et secret de l'application, posés à la construction depuis
    // les secrets du dépôt. Ils n'existent JAMAIS dans Git : vides, l'application retombe sur
    // l'ancien fonctionnement (jeton saisi à la main), donc rien ne casse s'ils ne sont pas définis.
    updateBase: process.env.UPDATE_BASE || '',
    updateSecret: process.env.UPDATE_SECRET || ''
  },
  // L'application GRATUITE du comptable embarquait le code source complet de l'application PAYANTE :
  // `src/**/*` emportait `src/renderer/app.js`, `core.js`, toute la logique de facturation, de paie
  // et de stock. N'importe qui recevant l'app cabinet repartait avec le produit qu'on vend.
  // On ne livre que ce dont elle a vraiment besoin (vérifié par un test qui relit les `require` et
  // les balises de son HTML) :
  files: [
    'src/cabinet/**/*',
    'src/zip.js',                      // fabrication et lecture des paquets
    'src/depot.js',                    // public ou privé : la même vérité que l'app entreprise
    'src/mac-update.sh',               // remplacement de l'app sur macOS non signé
    'src/renderer/style.css',          // la feuille partagée, chargée par son index.html
    'src/renderer/rowmenu.js',         // le menu d'actions d'une ligne, partagé lui aussi
    'src/renderer/reglages.js',        // le sommaire et la recherche des réglages, partagés aussi
    'src/renderer/compta.js',          // le moteur comptable : la balance du cabinet est celle du client
    'package.json',
    'CHANGELOG.md'
  ],
  directories: { output: 'dist-cabinet' },
  // Double-cliquer un paquet reçu par mail doit l'importer. C'est le geste le plus naturel après
  // avoir enregistré la pièce jointe, et jusqu'ici le système ne savait pas quoi faire d'un
  // `.skanpack` : il proposait une liste d'applications au hasard.
  // `role: 'Viewer'` dit vrai : l'application du cabinet LIT les paquets, elle ne les modifie pas.
  //
  // L'icône se déclare SANS EXTENSION. electron-builder ne convertit rien : il échange `.ico` et
  // `.icns` selon la plateforme, donc un chemin en `.png` ressort inchangé et s'installe tel quel
  // là où macOS attend un `.icns`. Rien n'échouait, rien n'était signalé, et le comptable voyait
  // un fichier blanc générique parmi vingt autres. Les vrais fichiers sont fabriqués par
  // `node scripts/icones.js` et commités (electron-builder REFUSE de construire s'ils manquent).
  fileAssociations: [
    { ext: 'skanpack', name: 'Paquet mensuel SkanFact', description: 'Les pièces comptables d\'un mois, envoyées par un client', role: 'Viewer', icon: 'skanpack' },
    { ext: 'skanrecover', name: 'Clé de secours SkanFact Cabinet', description: 'La clé qui rouvre les paquets déjà reçus', role: 'Viewer', icon: 'skanrecover' }
  ],
  // Aucune dépendance native (electron-updater est du JavaScript pur) : l'étape de recompilation
  // d'electron-builder ne produit rien et coûte une minute de machine macOS à chaque publication.
  npmRebuild: false,
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
