// Le poste dans le NAVIGATEUR (12 § 4 : « SQLite dans le navigateur, version WebAssembly, stockée
// dans le système de fichiers privé du navigateur »). Même travail que poste/poste.ts, mais là où
// l'application vivra vraiment : un « worker » qui tient la base, pendant que l'écran reste libre.
import sqlite3InitModule from '/sqlite/index.mjs';

const TABLES = {
  tiers: ['id', 'entreprise', 'nom', 'telephone', 'adresse', 'champs_rev', 'supprime', 'revision'],
  article: ['id', 'entreprise', 'designation', 'prix_millimes', 'tva_pourmille', 'supprime', 'revision'],
  piece: ['id', 'entreprise', 'type', 'statut', 'numero', 'tiers', 'jour', 'total_millimes', 'note', 'supprime', 'revision'],
  ligne_piece: ['id', 'entreprise', 'piece', 'article', 'designation', 'quantite_milliemes', 'prix_millimes', 'supprime', 'revision'],
  ticket: ['id', 'entreprise', 'caisse', 'numero', 'instant', 'total_millimes', 'empreinte', 'precedente', 'supprime', 'revision'],
  bulletin: ['id', 'entreprise', 'salarie', 'mois', 'brut_millimes', 'net_millimes', 'supprime', 'revision'],
  a_reprendre: ['id', 'entreprise', 'operation', 'objet', 'raison', 'version_mise_de_cote', 'supprime', 'revision'],
};

let db = null;
let pool = null;

const un = (sql, args) => db.selectObject(sql, args?.length ? args : undefined);
const meta = (cle, defaut = '') => un('select valeur from meta where cle = ?', [cle])?.valeur ?? defaut;
const poserMeta = (cle, valeur) => db.exec({ sql: 'insert into meta (cle, valeur) values (?, ?) on conflict (cle) do update set valeur = excluded.valeur', bind: [cle, valeur] });
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function ouvrir() {
  if (db) return { deja: true };
  const t = performance.now();
  const sqlite3 = await sqlite3InitModule();
  pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'skanfact-proto' });
  db = new pool.OpfsSAHPoolDb('/poste.sqlite3');
  db.exec('pragma synchronous = full;');
  for (const [t2, cols] of Object.entries(TABLES)) {
    db.exec(`create table if not exists ${t2} (${cols.map(c => c === 'id' ? 'id text primary key' : c).join(', ')})`);
  }
  db.exec(`create table if not exists meta (cle text primary key, valeur text);
    create table if not exists file_envoi (seq integer primary key, id text not null, format int not null, type text not null, donnees text not null);
    create index if not exists ticket_caisse on ticket (caisse, numero);`);
  return { ms: performance.now() - t, version: sqlite3.version.libVersion, vfs: 'opfs-sahpool' };
}

async function recevoir(appareil, limite = 5000) {
  let lignes = 0, pages = 0;
  for (;;) {
    const depuis = Number(meta('revision', '0'));
    const r = await fetch(`/api/changements?depuis=${depuis}&limite=${limite}`, { headers: { 'x-appareil': appareil } });
    const corps = await r.json();
    if (r.status === 410) { await effacer(); return { lignes, pages, efface: true }; }
    pages++;
    db.transaction(() => {
      for (const [t, rows] of Object.entries(corps.lignes)) {
        const cols = TABLES[t];
        const st = db.prepare(`insert or replace into ${t} (${cols.join(',')}) values (${cols.map(() => '?').join(',')})`);
        try {
          for (const row of rows) {
            st.bind(cols.map(c => { const v = row[c]; return v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : typeof v === 'boolean' ? (v ? 1 : 0) : v; }));
            st.stepReset();
            lignes++;
          }
        } finally { st.finalize(); }
      }
      poserMeta('revision', String(corps.jusqua));
    });
    if (corps.fini) break;
  }
  return { lignes, pages };
}

// Un ticket : la ligne et son geste dans la même transaction, AVANT que l'écran dise « enregistré ».
async function encaisser(entreprise, caisse, total) {
  const avant = un('select numero, empreinte from ticket where caisse = ? order by numero desc limit 1', [caisse]);
  const numero = avant ? Number(avant.numero) + 1 : 1;
  const precedente = avant ? avant.empreinte : 'origine';
  const instant = new Date().toISOString();
  const id = crypto.randomUUID();
  const empreinte = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode([precedente, caisse, numero, instant, total].join('|'))));
  db.transaction(() => {
    db.exec({ sql: 'insert into ticket (id, entreprise, caisse, numero, instant, total_millimes, empreinte, precedente, supprime, revision) values (?,?,?,?,?,?,?,?,0,0)',
      bind: [id, entreprise, caisse, numero, instant, total, empreinte, precedente] });
    db.exec({ sql: 'insert into file_envoi (id, format, type, donnees) values (?, 2, ?, ?)',
      bind: [crypto.randomUUID(), 'ticket.encaisser', JSON.stringify({ id, caisse, numero, instant, empreinte, precedente, total_millimes: total })] });
  });
  return { numero };
}

async function envoyer(appareil, parPaquet = 500) {
  let acquittes = 0;
  for (;;) {
    const lot = db.selectObjects('select seq, id, format, type, donnees from file_envoi order by seq limit ?', [parPaquet]);
    if (!lot.length) break;
    const base = Number(meta('seq_envoye', '0'));
    const ops = lot.map((o, i) => ({ id: o.id, seq: base + i + 1, format: o.format, type: o.type, donnees: JSON.parse(o.donnees) }));
    const r = await fetch('/api/operations', { method: 'POST', headers: { 'content-type': 'application/json', 'x-appareil': appareil }, body: JSON.stringify({ ops }) });
    if (r.status === 410) { await effacer(); return { acquittes, efface: true }; }
    const corps = await r.json();
    const faits = corps.resultats.filter(x => ['accepte', 'accepte-alerte', 'accepte-en-partie', 'mis-de-cote', 'deja', 'refuse'].includes(x.statut)).length;
    db.transaction(() => {
      db.exec({ sql: 'delete from file_envoi where seq in (select seq from file_envoi order by seq limit ?)', bind: [faits] });
      poserMeta('seq_envoye', String(base + faits));
    });
    acquittes += faits;
    if (faits < lot.length) break;
  }
  return { acquittes };
}

// 04 § 7 : un appareil révoqué efface ses données avant toute autre chose.
async function effacer() {
  db?.close(); db = null;
  await pool?.wipeFiles();
}

const actions = {
  ouvrir,
  recevoir: ({ appareil }) => recevoir(appareil),
  envoyer: ({ appareil }) => envoyer(appareil),
  // Chronométré DANS le worker, geste par geste, comme l'écran le vivra.
  encaisser: async ({ entreprise, caisse, n }) => {
    const durees = [];
    for (let i = 0; i < n; i++) { const t = performance.now(); await encaisser(entreprise, caisse, 1000 + i * 37); durees.push(performance.now() - t); }
    return { durees };
  },
  compter: ({ table, entreprise }) => db ? un(`select count(*) n from ${table}${entreprise ? ' where entreprise = ?' : ''}`, entreprise ? [entreprise] : undefined).n : null,
  taille: () => { const p = un('pragma page_count').page_count; const s = un('pragma page_size').page_size; return p * s; },
  fichiers: () => pool ? pool.getFileNames() : [],
  fermer: () => { db?.close(); db = null; return true; },
};

onmessage = async (e) => {
  const { id, action, args } = e.data;
  try { postMessage({ id, ok: true, valeur: await actions[action](args || {}) }); }
  catch (err) { postMessage({ id, ok: false, erreur: String(err?.stack || err) }); }
};
