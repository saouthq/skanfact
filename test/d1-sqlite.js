// Une base D1 pour les tests, posée sur le SQLite de Node (22.5+).
//
// Le worker du plan de contrôle parle à D1 par quatre gestes : `prepare(sql).bind(...).first()`,
// `.all()` (qui rend `{ results }`), `.run()` — et rien d'autre. Les imiter avec de faux retours
// écrits à la main, c'est ce que faisait la première version de `e2e:console` : le test passait
// sur des lignes inventées, et une requête SQL fausse (une colonne qui n'existe pas, un JOIN qui
// ne rend rien) restait invisible jusqu'à Cloudflare. Ici le SQL s'exécute POUR DE VRAI, sur le
// vrai schéma (`schema-a-coller.sql`, celui qu'on demande à Skander de coller).
//
// `undefined` devient `null` : D1 le fait, SQLite de Node le refuse.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, '..', 'plateforme', 'schema-a-coller.sql');

function lier(st, args) {
  const a = args.map(x => (x === undefined ? null : x));
  return {
    bind(...b) { return lier(st, b); },
    async first() { const r = st.get(...a); return r === undefined ? null : r; },
    async all() { return { results: st.all(...a) }; },
    async run() { const r = st.run(...a); return { success: true, meta: { changes: Number(r.changes) || 0 } }; }
  };
}

function baseD1(opts) {
  const db = new DatabaseSync(':memory:');
  const sql = (opts && opts.schema) || fs.readFileSync(SCHEMA, 'utf8');
  sql.split('\n').map(s => s.trim()).filter(Boolean).forEach(s => db.exec(s));
  return {
    prepare(texte) { return lier(db.prepare(texte), []); },
    // Pour lire directement dans un test, sans passer par le worker.
    lire(texte, ...args) { return db.prepare(texte).all(...args.map(x => (x === undefined ? null : x))); },
    fermer() { db.close(); }
  };
}

module.exports = { baseD1, SCHEMA };
