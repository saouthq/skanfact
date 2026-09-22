-- SkanFact — mettre une base D1 DÉJÀ EN SERVICE au niveau du schéma d'aujourd'hui.
--
-- `schema-a-coller.sql` crée une base neuve ; il ne touche pas une base qui existe déjà, parce que
-- tout y est en `CREATE TABLE IF NOT EXISTS`. Ce fichier-ci est l'autre moitié : les colonnes, les
-- tables et l'index qui se sont ajoutés depuis, dans l'ordre.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- À LIRE AVANT DE COLLER — deux choses, et la seconde est un piège silencieux.
--
-- 1. « duplicate column name » n'est PAS une erreur. SQLite (donc D1) ne connaît pas
--    `ADD COLUMN IF NOT EXISTS` : une colonne déjà présente fait échouer SA ligne, et c'est tout ce
--    qu'on lui demande de faire. Colle les instructions UNE PAR UNE, passe celles qui répondent ça,
--    et arrête-toi seulement sur un autre message.
--
-- 2. `DROP INDEX` avant de recréer `idx_activ_unique`, et ce n'est pas de la prudence.
--    `CREATE UNIQUE INDEX IF NOT EXISTS` sur un nom qui EXISTE DÉJÀ ne remplace rien : il ne fait
--    rien, sans un mot. L'ancien index portait sur (empreinte, device_id) et ne laissait qu'UNE
--    ligne par ordinateur : les deux applications d'un même poste s'y écrasaient l'une l'autre, et
--    la moitié du parc — celle des comptables — n'apparaissait nulle part (10.4.0-beta.3). Sans le
--    DROP, ce correctif-là ne s'applique jamais et rien ne le dit.
--    Le nouvel index est strictement plus PERMISSIF que l'ancien (trois colonnes au lieu de deux) :
--    aucune ligne déjà en base ne peut le violer, la recréation ne peut donc pas échouer.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- ÉTAT DE LA BASE DE PRODUCTION, relevé le 22/09/2026 (D1 « skanfact »).
-- Elle portait déjà tout jusqu'à la 10.5.0 — `app`, l'index du parc avec COALESCE, `reglages`,
-- `suivis`. Seule `licences.illimite` manquait, et elle a été ajoutée ce jour-là. Ce fichier reste
-- écrit pour une base dont on ne sait PLUS où elle en est : c'est son seul intérêt.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- ---------- 8.5.0 — ce que la console signe et envoie ----------
-- (Présentes depuis l'émission de la première clé. Si elles répondent « duplicate column », c'est
-- simplement que la base a déjà servi à vendre.)
ALTER TABLE licences ADD COLUMN charge TEXT;
ALTER TABLE licences ADD COLUMN envoyee_le TEXT;

-- ---------- 9.4.1 — la console vend une licence de CABINET ----------
-- `type` vaut 'cabinet' ou NULL. NULL = entreprise, c'est-à-dire tout ce qui a été émis avant.
ALTER TABLE licences ADD COLUMN type TEXT;
ALTER TABLE licences ADD COLUMN dossiers_hors INTEGER;

-- ---------- 10.4.0 — le parc porte les DEUX applications ----------
ALTER TABLE activations ADD COLUMN app TEXT;

-- ---------- 10.8.0 — « sans limite de dossiers » ----------
-- Un ÉTAT, pas un très grand `dossiers_hors` : une clé à 99 999 ferait lire au cabinet
-- « 100 002 dossiers autorisés », un nombre que personne n'a décidé.
ALTER TABLE licences ADD COLUMN illimite INTEGER;

-- ---------- 10.4.0-beta.3 — l'index du parc (voir le point 2 ci-dessus) ----------
DROP INDEX IF EXISTS idx_activ_unique;
CREATE UNIQUE INDEX idx_activ_unique
  ON activations(empreinte, device_id, COALESCE(app, 'entreprise'));

-- ---------- 10.5.0 — les réglages et le suivi commercial ----------
-- Celles-ci sont des tables : `IF NOT EXISTS` les rend inoffensives à rejouer.
CREATE TABLE IF NOT EXISTS reglages (
  cle       TEXT PRIMARY KEY,
  valeur    TEXT NOT NULL,
  change_le TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suivis (
  id     TEXT PRIMARY KEY,
  sujet  TEXT NOT NULL,
  quand  TEXT NOT NULL,
  moyen  TEXT,
  note   TEXT,
  rappel TEXT,
  issue  TEXT,
  motif  TEXT,
  source TEXT
);
CREATE INDEX IF NOT EXISTS idx_suivis_sujet ON suivis(sujet);
