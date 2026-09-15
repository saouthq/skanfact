// Fabrique `plateforme/schema-a-coller.sql` à partir de `plateforme/schema.sql`.
//
// Pourquoi ce script existe : la console D1 du tableau de bord Cloudflare est un champ de saisie
// d'UNE SEULE LIGNE. Coller un fichier SQL commenté dedans écrase les retours à la ligne, et le
// premier « -- » met alors en commentaire TOUT le reste — on croit avoir créé six tables, on en a
// créé une, et aucune erreur ne s'affiche. C'est le pire cas : un échec silencieux sur la seule
// chose qu'on ne peut pas corriger après coup sans migration.
//
// Le fichier produit n'a donc aucun commentaire et porte une instruction par ligne, pour être collé
// telle quelle, d'un coup ou une par une.
//
// Il est ENGENDRÉ, jamais écrit à la main : une seconde copie tenue à la main diverge toujours
// (règle 7.29.0). Un test de `npm test` refait le travail et compare — si les deux s'écartent, il
// tombe.
//
//   node scripts/plateforme-sql.js

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'plateforme', 'schema.sql');
const SORTIE = path.join(RACINE, 'plateforme', 'schema-a-coller.sql');

// Retire les commentaires, recolle chaque instruction sur une ligne, garde l'ordre.
function aColler(sql) {
  const sansCommentaires = String(sql).replace(/--[^\n]*/g, ' ');
  return sansCommentaires
    .split(';')
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(s => s + ';')
    .join('\n') + '\n';
}

// On ne livre pas un fichier SQL que personne n'a jamais exécuté. Avant d'écrire, on le passe dans
// un vrai SQLite : une virgule en trop ne se voit pas à la relecture, et la découvrir dans la
// console de Cloudflare coûte un aller-retour à quelqu'un qui n'y peut rien.
//
// `node:sqlite` n'existe que depuis Node 22.5 : absent, on le DIT et on refuse d'écrire, plutôt que
// de produire un fichier non vérifié en affichant « ok » (un contrôle qui se saute en silence ne
// protège plus de rien).
function verifier(sql) {
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch {
    throw new Error('node:sqlite est indisponible (Node 22.5+ requis) : le schéma ne serait pas vérifié.');
  }
  const db = new DatabaseSync(':memory:');
  const lignes = sql.trim().split('\n').filter(Boolean);
  lignes.forEach((s, i) => {
    try { db.exec(s); } catch (e) {
      throw new Error('instruction ' + (i + 1) + ' refusée par SQLite : ' + e.message + '\n  ' + s.slice(0, 120));
    }
  });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  db.close();
  return { instructions: lignes.length, tables: tables.map(t => t.name) };
}

module.exports = { aColler, verifier, SOURCE, SORTIE };

if (require.main === module) {
  const out = aColler(fs.readFileSync(SOURCE, 'utf8'));
  const v = verifier(out);
  fs.writeFileSync(SORTIE, out);
  console.log('plateforme/schema-a-coller.sql — ' + v.instructions + ' instructions, une par ligne.');
  console.log('vérifié dans SQLite : ' + v.tables.join(', '));
}
