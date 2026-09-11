#!/usr/bin/env node
// Publie une nouvelle version : incrémente le numéro, crée un tag git, pousse.
// GitHub Actions construit ensuite Mac + Windows et publie la release automatiquement.
//
//   npm run release            → patch  (1.0.0 → 1.0.1)  corrections
//   npm run release minor      → minor  (1.0.1 → 1.1.0)  nouvelles fonctionnalités
//   npm run release major      → major  (1.1.0 → 2.0.0)  gros changement

const { execSync } = require('child_process');
const pkg = require('../package.json');

const type = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage : npm run release [patch|minor|major]');
  process.exit(1);
}
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
run(`npm version ${type} -m "Version %s"`);
run('git push --follow-tags');

const v = require('../package.json').version;
console.log(`\nVersion ${v} envoyée. GitHub Actions construit les installateurs (5 à 10 min) :`);
console.log(`https://github.com/${pkg.build.publish.owner}/${pkg.build.publish.repo}/actions`);
console.log('Une fois terminé, l\'app installée proposera la mise à jour toute seule.');
