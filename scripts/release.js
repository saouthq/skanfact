#!/usr/bin/env node
// Publie une nouvelle version : incrémente le numéro, crée un tag git, pousse.
// GitHub Actions construit ensuite Mac + Windows et publie la release automatiquement.
//
//   npm run release            → patch  (1.0.0 → 1.0.1)  corrections
//   npm run release minor      → minor  (1.0.1 → 1.1.0)  nouvelles fonctionnalités
//   npm run release major      → major  (1.1.0 → 2.0.0)  gros changement
//
// Les versions d'essai (7.25.0 → 7.26.0-beta.1 → -beta.2) passent par `npm version prerelease`,
// depuis la branche `beta`. C'est le suffixe du numéro qui fait tout le reste : le workflow marque
// la release « préversion » et electron-builder écrit `beta.yml` au lieu de `latest.yml`.
//
//   npm run release preminor   → 7.25.0 → 7.26.0-beta.0   première bêta d'une nouveauté
//   npm run release prerelease → 7.26.0-beta.0 → -beta.1   essai suivant
//   npm run release minor      → 7.26.0-beta.1 → 7.26.0    on confirme, ça devient la stable

const { execSync } = require('child_process');
const pkg = require('../package.json');

const type = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major', 'prerelease', 'prepatch', 'preminor', 'premajor'].includes(type)) {
  console.error('Usage : npm run release [patch|minor|major|preminor|prerelease]');
  process.exit(1);
}
// `npm version preminor` seul donnerait `7.26.0-0`, sans nom de canal : electron-builder en
// déduirait le canal « 0 », et l'application chercherait `0-mac.yml`. Le nom du canal fait partie
// du numéro, il n'est pas décoratif.
const preid = type.startsWith('pre') ? ' --preid beta' : '';
if (pkg.build.publish.owner === 'SKANDER_GITHUB') {
  console.error('Remplace d\'abord SKANDER_GITHUB par ton identifiant GitHub dans package.json (build.publish.owner et repository.url).');
  process.exit(1);
}

const run = (cmd) => { console.log('› ' + cmd); execSync(cmd, { stdio: 'inherit' }); };

try {
  execSync('git diff --quiet && git diff --cached --quiet');
} catch {
  console.error('Tu as des modifications non enregistrées. Fais d\'abord :\n  git add -A && git commit -m "description des changements"');
  process.exit(1);
}

run('npm test');
run(`npm version ${type}${preid} -m "Version %s"`);
run('git push --follow-tags');

const v = require('../package.json').version;
console.log(`\nVersion ${v} envoyée. GitHub Actions construit les installateurs (5 à 10 min) :`);
console.log(`https://github.com/${pkg.build.publish.owner}/${pkg.build.publish.repo}/actions`);
console.log('Une fois terminé, l\'app installée proposera la mise à jour toute seule.');
