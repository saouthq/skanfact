// Le serveur du prototype : « notre propre chemin » (04 § 9.2).
//
// Deux routes, et la porte des droits devant chacune :
//   POST /operations    l'écriture : la file de gestes d'un appareil, rejouée dans l'ordre (04 § 4)
//   GET  /changements   la lecture : « tout ce qui a changé depuis la révision N » (04 § 9.2)
//
// La porte (03 D2) : l'appareil → le membre → l'entreprise et le rôle. Ils sont posés pour la
// transaction (SET LOCAL), et c'est la BASE qui filtre (schema.sql, RLS). Le serveur ne réécrit
// jamais un filtre de droits à la main : c'est tout l'enjeu du choix face à PowerSync.

import http from 'node:http';
import pg from 'pg';
import { gzipSync } from 'node:zlib';

// La compression peut s'éteindre pour mesurer ce qu'elle apporte (SANS_COMPRESSION=1).
const COMPRESSER = !process.env.SANS_COMPRESSION;

export const FORMAT_ACTUEL = 2;
const FORMATS_ACCEPTES = [FORMAT_ACTUEL, FORMAT_ACTUEL - 1]; // 04 § 8 : la version précédente passe

type Identite = { appareil: string; membre: string; entreprise: string; role: string; revoque: boolean };

export function creerServeur(urlBase: string) {
  const pool = new pg.Pool({ connectionString: urlBase, max: 8 });

  async function identite(client: pg.PoolClient, appareil: string): Promise<Identite | null> {
    const r = await client.query(
      `select a.id appareil, m.id membre, m.entreprise, m.role, a.revoque_le is not null revoque
         from proto.appareil a join proto.membre m on m.id = a.membre where a.id = $1`, [appareil]);
    return r.rows[0] || null;
  }

  // Une transaction « au nom de » quelqu'un : la base ne voit plus que son entreprise, et la paie
  // seulement si son rôle y a droit.
  async function auNomDe<T>(appareil: string, travail: (c: pg.PoolClient, id: Identite) => Promise<T>,
                            quarantaine?: (c: pg.PoolClient, id: Identite) => Promise<void>) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      const id = await identite(c, appareil);
      if (!id) { await c.query('rollback'); return { statut: 401, corps: { erreur: 'appareil inconnu' } }; }
      if (id.revoque) {
        // 04 § 7 : les gestes d'un appareil révoqué sont REÇUS, mais mis en quarantaine : le
        // propriétaire décide. Rien n'est appliqué d'office, rien n'est perdu.
        if (quarantaine) {
          await c.query(`select set_config('app.entreprise', $1, true), set_config('app.role', $2, true)`, [id.entreprise, id.role]);
          await quarantaine(c, id);
          await c.query('commit');
        } else await c.query('rollback');
        // 04 § 7 : l'appareil révoqué reçoit l'ordre d'effacer, avant toute autre chose.
        return { statut: 410, corps: { ordre: 'effacer', raison: 'appareil révoqué' } };
      }
      await c.query(`select set_config('app.entreprise', $1, true), set_config('app.role', $2, true)`, [id.entreprise, id.role]);
      const corps = await travail(c, id);
      await c.query('commit');
      return { statut: 200, corps };
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }

  // ── La lecture ─────────────────────────────────────────────────────────────────────────────
  // Une seule suite de révisions pour toutes les tables : une page = les L plus petites révisions
  // au-dessus de N, toutes tables confondues. Le poste retient le plus grand numéro reçu.
  const TABLES_LUES = ['tiers', 'article', 'piece', 'ligne_piece', 'ticket', 'bulletin', 'a_reprendre'];

  async function changements(appareil: string, depuis: number, limite: number) {
    return auNomDe(appareil, async (c) => {
      const union = TABLES_LUES.map(t =>
        `select '${t}' as t, revision, to_jsonb(x) as ligne from proto.${t} x where revision > $1`).join(' union all ');
      const r = await c.query(`select t, revision, ligne from (${union}) u order by revision limit $2`, [depuis, limite]);
      const lignes: Record<string, unknown[]> = {};
      let jusqua = depuis;
      for (const row of r.rows) {
        (lignes[row.t] ||= []).push(row.ligne);
        jusqua = Math.max(jusqua, Number(row.revision));
      }
      return { lignes, jusqua, fini: r.rows.length < limite };
    });
  }

  // ── L'écriture ─────────────────────────────────────────────────────────────────────────────
  type Op = { id: string; seq: number; format: number; type: string; donnees: any };

  async function operations(appareil: string, ops: Op[]) {
    return auNomDe(appareil, async (c, id) => {
      // Les gestes d'une entreprise s'écrivent l'un après l'autre : les révisions sont alors
      // attribuées dans l'ordre où elles deviennent visibles, et « depuis N » ne saute jamais une
      // ligne validée plus tard avec un numéro plus petit.
      await c.query('select pg_advisory_xact_lock(hashtext($1))', [id.entreprise]);
      const dernier = await c.query('select coalesce(max(seq), 0) s from proto.operation where appareil = $1', [appareil]);
      let attendu = Number(dernier.rows[0].s) + 1;
      const resultats: { id: string; statut: string; raison?: string }[] = [];
      for (const op of [...ops].sort((a, b) => a.seq - b.seq)) {
        // Rien ne se double (04 § 4) : un identifiant déjà reçu ne compte pas une seconde fois.
        const deja = await c.query('select 1 from proto.operation where id = $1', [op.id]);
        if (deja.rowCount) { resultats.push({ id: op.id, statut: 'deja' }); continue; }
        if (op.seq !== attendu) { resultats.push({ id: op.id, statut: 'attendre', raison: `il manque le geste ${attendu}` }); break; }
        if (!FORMATS_ACCEPTES.includes(op.format)) { resultats.push({ id: op.id, statut: 'refuse', raison: `format ${op.format} trop ancien` }); break; }
        const statut = await appliquer(c, id, op);
        await c.query(
          'insert into proto.operation (id, entreprise, appareil, seq, format, type, statut) values ($1,$2,$3,$4,$5,$6,$7)',
          [op.id, id.entreprise, appareil, op.seq, op.format, op.type, statut]);
        resultats.push({ id: op.id, statut });
        attendu++;
      }
      return { resultats };
    }, async (c, id) => {
      for (const op of ops) {
        await c.query('insert into proto.a_reprendre (entreprise, operation, objet, raison, version_mise_de_cote) values ($1,$2,$3,$4,$5)',
          [id.entreprise, op.id, op.type, 'appareil révoqué : en quarantaine, à accepter ou rejeter', JSON.stringify(op)]);
      }
    });
  }

  async function mettreDeCote(c: pg.PoolClient, id: Identite, op: Op, objet: string, raison: string, version: unknown) {
    await c.query('insert into proto.a_reprendre (entreprise, operation, objet, raison, version_mise_de_cote) values ($1,$2,$3,$4,$5)',
      [id.entreprise, op.id, objet, raison, JSON.stringify(version)]);
  }

  async function appliquer(c: pg.PoolClient, id: Identite, op: Op): Promise<string> {
    const d = op.donnees;
    if (op.type === 'ticket.encaisser') {
      // Format 1 (la version précédente) appelait le total « montant » : il se lit encore (04 § 8).
      const total = op.format === 1 ? d.montant_millimes : d.total_millimes;
      // Un ticket est un fait : il est TOUJOURS accepté (04 § 5.1). La chaîne se vérifie, et une
      // chaîne cassée est une alerte, jamais une correction silencieuse (04 § 3.1).
      const avant = await c.query('select empreinte from proto.ticket where caisse = $1 and numero = $2', [d.caisse, d.numero - 1]);
      const attendue = avant.rows[0]?.empreinte ?? (d.numero === 1 ? 'origine' : null);
      await c.query(
        `insert into proto.ticket (id, entreprise, caisse, numero, instant, total_millimes, empreinte, precedente)
         values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing`,
        [d.id, id.entreprise, d.caisse, d.numero, d.instant, total, d.empreinte, d.precedente]);
      if (attendue !== null && attendue !== d.precedente) {
        await mettreDeCote(c, id, op, 'ticket ' + d.numero, 'chaîne des tickets cassée', d);
        return 'accepte-alerte';
      }
      return 'accepte';
    }
    if (op.type === 'tiers.modifier') {
      // Une fiche se fusionne champ par champ (04 § 5) : un champ que personne d'autre n'a touché
      // depuis la version vue passe ; un champ touché des deux côtés garde la version du serveur,
      // et l'autre est mise de côté, jamais jetée.
      const r = await c.query('select champs_rev from proto.tiers where id = $1 for update', [d.id]);
      if (!r.rowCount) return 'refuse';
      const revs = r.rows[0].champs_rev || {};
      let conflit = false;
      for (const [champ, valeur] of Object.entries(d.champs as Record<string, string>)) {
        if (!['nom', 'telephone', 'adresse'].includes(champ)) continue;
        const vue = Number(d.revs_vues?.[champ] ?? 0);
        if (Number(revs[champ] ?? 0) > vue) {
          conflit = true;
          await mettreDeCote(c, id, op, 'tiers ' + d.id + ' / ' + champ, 'le même champ a changé ailleurs', { champ, valeur });
          continue;
        }
        const n = await c.query(`select nextval('proto.revision_seq') n`);
        await c.query(`update proto.tiers set ${champ} = $2, champs_rev = champs_rev || jsonb_build_object($3::text, $4::bigint) where id = $1`,
          [d.id, valeur, champ, n.rows[0].n]);
      }
      return conflit ? 'accepte-en-partie' : 'accepte';
    }
    if (op.type === 'brouillon.modifier') {
      // Un brouillon ne se fusionne jamais (04 § 5) : le premier arrivé gagne, l'autre version
      // part dans « À reprendre », à côté, avec « Garder celle-ci ».
      const r = await c.query('select revision, statut from proto.piece where id = $1 for update', [d.id]);
      if (!r.rowCount) return 'refuse';
      if (r.rows[0].statut !== 'brouillon' || Number(r.rows[0].revision) !== Number(d.revision_vue)) {
        await mettreDeCote(c, id, op, 'pièce ' + d.id, 'le brouillon a changé ailleurs', d);
        return 'mis-de-cote';
      }
      await c.query('update proto.piece set note = $2, total_millimes = $3 where id = $1', [d.id, d.note, d.total_millimes]);
      return 'accepte';
    }
    return 'refuse';
  }

  // ── HTTP ───────────────────────────────────────────────────────────────────────────────────
  const serveur = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://x');
      const appareil = String(req.headers['x-appareil'] || '');
      let r;
      if (req.method === 'GET' && url.pathname === '/changements') {
        r = await changements(appareil, Number(url.searchParams.get('depuis') || 0), Math.min(Number(url.searchParams.get('limite') || 5000), 20000));
      } else if (req.method === 'POST' && url.pathname === '/operations') {
        const morceaux: Buffer[] = [];
        for await (const m of req) morceaux.push(m as Buffer);
        r = await operations(appareil, JSON.parse(Buffer.concat(morceaux).toString('utf8')).ops);
      } else {
        r = { statut: 404, corps: { erreur: 'route inconnue' } };
      }
      // Compressé quand le poste l'accepte : du JSON de pièces se réduit de moitié ou plus, et
      // c'est ce qui compte sur une connexion de 4 Mbit/s.
      const brut = Buffer.from(JSON.stringify(r.corps));
      const gz = COMPRESSER && /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) && brut.length > 1024;
      const corps = gz ? gzipSync(brut, { level: 6 }) : brut;
      res.writeHead(r.statut, { 'content-type': 'application/json', 'content-length': corps.length, ...(gz ? { 'content-encoding': 'gzip' } : {}) });
      res.end(corps);
    } catch (e: any) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ erreur: String(e?.message || e) }));
    }
  });

  return {
    ecouter: (port: number) => new Promise<void>(ok => serveur.listen(port, '127.0.0.1', () => ok())),
    fermer: async () => { await new Promise(ok => serveur.close(() => ok(null))); await pool.end(); },
  };
}
