// Un poste du prototype : la copie locale (SQLite, comme prévu au 12 § 4) et la file de gestes.
//
// Les règles du 04 qu'il tient :
//   - un geste est écrit dans la file AVANT que l'écran dise « enregistré » (04 § 4), dans la même
//     transaction que la ligne qu'il change ;
//   - les tickets sont numérotés et chaînés sur la caisse, même hors ligne (04 § 3.1) ;
//   - la file part dans l'ordre, et un geste renvoyé ne compte qu'une fois (le serveur y veille) ;
//   - un ordre « effacer » (appareil révoqué) efface la copie avant toute autre chose (04 § 7).

import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';

const TABLES = {
  tiers: ['id', 'entreprise', 'nom', 'telephone', 'adresse', 'champs_rev', 'supprime', 'revision'],
  article: ['id', 'entreprise', 'designation', 'prix_millimes', 'tva_pourmille', 'supprime', 'revision'],
  piece: ['id', 'entreprise', 'type', 'statut', 'numero', 'tiers', 'jour', 'total_millimes', 'note', 'supprime', 'revision'],
  ligne_piece: ['id', 'entreprise', 'piece', 'article', 'designation', 'quantite_milliemes', 'prix_millimes', 'supprime', 'revision'],
  ticket: ['id', 'entreprise', 'caisse', 'numero', 'instant', 'total_millimes', 'empreinte', 'precedente', 'supprime', 'revision'],
  bulletin: ['id', 'entreprise', 'salarie', 'mois', 'brut_millimes', 'net_millimes', 'supprime', 'revision'],
  a_reprendre: ['id', 'entreprise', 'operation', 'objet', 'raison', 'version_mise_de_cote', 'supprime', 'revision'],
} as const;

export class Poste {
  fichier: string;
  appareil: string;
  serveur: string;
  db: DatabaseSync | null;
  efface = false;

  constructor(fichier: string, appareil: string, serveur: string) {
    this.fichier = fichier;
    this.appareil = appareil;
    this.serveur = serveur;
    this.db = new DatabaseSync(fichier);
    // Un geste ne vit jamais seulement en mémoire : chaque validation touche le disque.
    this.db.exec('pragma journal_mode = wal; pragma synchronous = full;');
    for (const [t, cols] of Object.entries(TABLES)) {
      this.db.exec(`create table if not exists ${t} (${cols.map(c => c === 'id' ? 'id text primary key' : c).join(', ')})`);
    }
    this.db.exec(`create table if not exists meta (cle text primary key, valeur text);
      create table if not exists file_envoi (seq integer primary key, id text not null, format int not null, type text not null, donnees text not null);
      create index if not exists ticket_caisse on ticket (caisse, numero);`);
  }

  private get base(): DatabaseSync {
    if (!this.db) throw new Error('copie effacée');
    return this.db;
  }

  meta(cle: string, defaut = ''): string {
    const r = this.base.prepare('select valeur from meta where cle = ?').get(cle) as any;
    return r ? r.valeur : defaut;
  }

  private poserMeta(cle: string, valeur: string) {
    this.base.prepare('insert into meta (cle, valeur) values (?, ?) on conflict (cle) do update set valeur = excluded.valeur').run(cle, valeur);
  }

  private mettreEnFile(type: string, donnees: unknown, format = 2) {
    this.base.prepare('insert into file_envoi (id, format, type, donnees) values (?, ?, ?, ?)')
      .run(randomUUID(), format, type, JSON.stringify(donnees));
  }

  enAttente(): number {
    return (this.base.prepare('select count(*) n from file_envoi').get() as any).n;
  }

  // ── Les gestes (hors ligne) ────────────────────────────────────────────────────────────────
  encaisser(entreprise: string, caisse: string, total_millimes: number, format = 2) {
    const db = this.base;
    db.exec('begin immediate');
    try {
      const avant = db.prepare('select numero, empreinte from ticket where caisse = ? order by numero desc limit 1').get(caisse) as any;
      const numero = avant ? Number(avant.numero) + 1 : 1;
      const precedente = avant ? avant.empreinte : 'origine';
      const instant = new Date().toISOString();
      const id = randomUUID();
      const empreinte = createHash('sha256').update([precedente, caisse, numero, instant, total_millimes].join('|')).digest('hex');
      db.prepare('insert into ticket (id, entreprise, caisse, numero, instant, total_millimes, empreinte, precedente, supprime, revision) values (?,?,?,?,?,?,?,?,0,0)')
        .run(id, entreprise, caisse, numero, instant, total_millimes, empreinte, precedente);
      const d: any = { id, caisse, numero, instant, empreinte, precedente };
      if (format === 1) d.montant_millimes = total_millimes; else d.total_millimes = total_millimes;
      this.mettreEnFile('ticket.encaisser', d, format);
      db.exec('commit');
      return { id, numero };
    } catch (e) {
      db.exec('rollback');
      throw e;
    }
  }

  modifierTiers(id: string, champs: Record<string, string>) {
    const db = this.base;
    db.exec('begin immediate');
    const t = db.prepare('select champs_rev from tiers where id = ?').get(id) as any;
    const revs = JSON.parse(t?.champs_rev || '{}');
    const revs_vues: Record<string, number> = {};
    for (const [k, v] of Object.entries(champs)) {
      db.prepare(`update tiers set ${k} = ? where id = ?`).run(v, id);
      revs_vues[k] = Number(revs[k] ?? 0);
    }
    this.mettreEnFile('tiers.modifier', { id, champs, revs_vues });
    db.exec('commit');
  }

  modifierBrouillon(id: string, note: string, total_millimes: number) {
    const db = this.base;
    db.exec('begin immediate');
    const p = db.prepare('select revision from piece where id = ?').get(id) as any;
    db.prepare('update piece set note = ?, total_millimes = ? where id = ?').run(note, total_millimes, id);
    this.mettreEnFile('brouillon.modifier', { id, note, total_millimes, revision_vue: Number(p.revision) });
    db.exec('commit');
  }

  // ── Le réseau ──────────────────────────────────────────────────────────────────────────────
  private async appel(chemin: string, init?: RequestInit) {
    const r = await fetch(this.serveur + chemin, { ...init, headers: { 'content-type': 'application/json', 'x-appareil': this.appareil, ...(init?.headers || {}) } });
    const corps: any = await r.json();
    if (r.status === 410 && corps.ordre === 'effacer') { this.effacer(); return null; }
    if (!r.ok) throw new Error(`${chemin} : ${r.status} ${JSON.stringify(corps)}`);
    return corps;
  }

  effacer() {
    // 04 § 7 : un appareil révoqué efface ses données avant toute autre chose.
    this.db?.close();
    this.db = null;
    for (const f of [this.fichier, this.fichier + '-wal', this.fichier + '-shm']) fs.rmSync(f, { force: true });
    this.efface = true;
  }

  // Envoie la file, par paquets, dans l'ordre. Rend le nombre de gestes acquittés.
  async envoyer(parPaquet = 500): Promise<{ acquittes: number; resultats: any[] }> {
    let acquittes = 0;
    const tous: any[] = [];
    for (;;) {
      if (!this.db) return { acquittes, resultats: tous };
      const lot = this.base.prepare('select seq, id, format, type, donnees from file_envoi order by seq limit ?').all(parPaquet) as any[];
      if (!lot.length) break;
      const base = Number(this.meta('seq_envoye', '0'));
      const ops = lot.map((o, i) => ({ id: o.id, seq: base + i + 1, format: o.format, type: o.type, donnees: JSON.parse(o.donnees) }));
      const r = await this.appel('/operations', { method: 'POST', body: JSON.stringify({ ops }) });
      if (!r) return { acquittes, resultats: tous };
      tous.push(...r.resultats);
      const faits = r.resultats.filter((x: any) => ['accepte', 'accepte-alerte', 'accepte-en-partie', 'mis-de-cote', 'deja', 'refuse'].includes(x.statut)).length;
      this.base.exec('begin');
      this.base.prepare('delete from file_envoi where seq in (select seq from file_envoi order by seq limit ?)').run(faits);
      this.poserMeta('seq_envoye', String(base + faits));
      this.base.exec('commit');
      acquittes += faits;
      if (faits < lot.length) break;
    }
    return { acquittes, resultats: tous };
  }

  // Reçoit « tout ce qui a changé depuis ma dernière révision », page par page.
  async recevoir(limite = 5000): Promise<{ lignes: number; pages: number }> {
    let lignes = 0, pages = 0;
    for (;;) {
      if (!this.db) return { lignes, pages };
      const depuis = Number(this.meta('revision', '0'));
      const r = await this.appel(`/changements?depuis=${depuis}&limite=${limite}`);
      if (!r) return { lignes, pages };
      pages++;
      const db = this.base;
      db.exec('begin');
      for (const [t, rows] of Object.entries(r.lignes as Record<string, any[]>)) {
        const cols = (TABLES as any)[t] as string[];
        const st = db.prepare(`insert or replace into ${t} (${cols.join(',')}) values (${cols.map(() => '?').join(',')})`);
        for (const row of rows) {
          st.run(...cols.map(c => {
            const v = row[c];
            return v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : typeof v === 'boolean' ? (v ? 1 : 0) : v;
          }));
          lignes++;
        }
      }
      this.poserMeta('revision', String(r.jusqua));
      db.exec('commit');
      if (r.fini) break;
    }
    return { lignes, pages };
  }

  compter(table: string): number {
    return (this.base.prepare(`select count(*) n from ${table}`).get() as any).n;
  }

  taille(): number {
    this.base.exec('pragma wal_checkpoint(truncate)');
    return fs.statSync(this.fichier).size;
  }

  // Combien de lignes, toutes tables confondues, appartiennent à cette entreprise.
  base_compter_entreprise(entreprise: string): number {
    let n = 0;
    for (const t of Object.keys(TABLES)) n += (this.base.prepare(`select count(*) n from ${t} where entreprise = ?`).get(entreprise) as any).n;
    return n;
  }

  // Le premier geste de la file, tel qu'il partira (pour le renvoyer à la main dans le banc).
  premiereOperation() {
    const o = this.base.prepare('select id, format, type, donnees from file_envoi order by seq limit 1').get() as any;
    return { id: o.id, seq: Number(this.meta('seq_envoye', '0')) + 1, format: o.format, type: o.type, donnees: JSON.parse(o.donnees) };
  }

  tiersTelephones(): [string, string][] {
    return (this.base.prepare('select id, telephone from tiers').all() as any[]).map(r => [r.id, r.telephone]);
  }

  fermer() { this.db?.close(); this.db = null; }
}
