#!/usr/bin/env node
// Extrait la section de CHANGELOG.md correspondant à la version de package.json
// et l'écrit dans build/release-notes.md. electron-builder la met dans latest.yml
// (l'app l'affiche dans Paramètres → Mises à jour) et le workflow la copie dans la release GitHub.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const version = require(path.join(root, 'package.json')).version;
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

const re = new RegExp(`^## ${version.replace(/\./g, '\\.')}[^\\n]*\\n([\\s\\S]*?)(?=^## |\\s*$(?![\\s\\S]))`, 'm');
const m = changelog.match(re);
const notes = m ? m[1].trim() : `Version ${version}`;
if (!m) console.warn(`Attention : pas d'entrée « ## ${version} » dans CHANGELOG.md`);

const out = path.join(root, 'build', 'release-notes.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, notes + '\n');
console.log(`build/release-notes.md écrit (version ${version}, ${notes.split('\n').length} ligne(s))`);
