-- SkanFact — le plan de contrôle (P 0.1). Base D1 (SQLite managé par Cloudflare).
--
-- Voir PLAN-PLATEFORME.md § 6. Deux principes gouvernent ce schéma :
--
--   1. Le client est une entité, la licence en est une autre. Un client peut acheter deux fois,
--      renouveler, changer de matricule — sans ce fil, rien ne relie deux achats de la même
--      personne, et c'est ce qui coûterait cher à rattraper une fois les clients arrivés.
--   2. Tout est un événement, jamais un écrasement. « Révoquée le 14/10 pour rétractation » reste
--      écrit pour toujours. Sans ça, impossible de répondre à un client six mois plus tard.
--
-- Le statut d'une licence ne se saisit JAMAIS : il se déduit (active / expirée / révoquée /
-- remplacée), comme le statut d'une facture depuis la 1.4.0. Une colonne « statut » écrite à la
-- main finirait par mentir — d'où son absence ici.
--
-- Les dates sont des jours du calendrier (AAAA-MM-JJ), jamais des instants, sauf les colonnes
-- nommées `_le` qui portent un horodatage ISO complet. Règle 5.2.3.

PRAGMA foreign_keys = ON;

-- ---------- les clients ----------
CREATE TABLE IF NOT EXISTS clients (
  id          TEXT PRIMARY KEY,           -- identifiant à nous, stable à vie
  nom         TEXT NOT NULL,
  matricule   TEXT,                       -- peut changer : ce n'est PAS l'identifiant
  email       TEXT,
  tel         TEXT,
  adresse     TEXT,
  notes       TEXT,
  cree_le     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_matricule ON clients(matricule);

-- ---------- les licences ----------
CREATE TABLE IF NOT EXISTS licences (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES clients(id),
  kid               TEXT NOT NULL,        -- quelle clé a signé (master / srv-1 …)
  empreinte         TEXT NOT NULL,        -- SHA-256 tronquée de la clé émise : le lien avec le terrain
  offre             TEXT NOT NULL,
  postes            INTEGER,              -- NULL = illimité (toutes les clés d'avant la 8.4.0)
  debut             TEXT NOT NULL,
  fin               TEXT,                 -- NULL = à vie
  prix              REAL,
  devise            TEXT,
  remise            REAL,
  cabinet_empreinte TEXT,                 -- le parrainage (6.2.0)
  emise_le          TEXT NOT NULL,
  remplace_id       TEXT REFERENCES licences(id),
  remplacee_motif   TEXT,                 -- renouvellement / offre / matricule (8.2.0)
  revoquee_le       TEXT,
  revoquee_motif    TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_licences_empreinte ON licences(empreinte);
CREATE INDEX IF NOT EXISTS idx_licences_client ON licences(client_id);

-- ---------- les activations ----------
-- Une ligne par couple (licence, ordinateur). `derniere_fois` est le seul champ qui se réécrit :
-- c'est un compteur de présence, pas une histoire.
CREATE TABLE IF NOT EXISTS activations (
  id             TEXT PRIMARY KEY,
  licence_id     TEXT REFERENCES licences(id),
  empreinte      TEXT NOT NULL,           -- utile même si la licence est inconnue de la base
  device_id      TEXT NOT NULL,
  device_nom     TEXT,
  plateforme     TEXT,
  version        TEXT,
  premiere_fois  TEXT NOT NULL,
  derniere_fois  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_activ_unique ON activations(empreinte, device_id);

-- ---------- les ventes ----------
-- Le pont comptable (§ 11) : SkanFact les TIRE, l'API ne pousse jamais.
CREATE TABLE IF NOT EXISTS ventes (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES clients(id),
  licence_id       TEXT REFERENCES licences(id),
  montant_ht       REAL NOT NULL,
  tva              REAL,
  devise           TEXT NOT NULL,
  payee_le         TEXT,
  moyen            TEXT,
  facture_skanfact TEXT,                  -- le numéro rendu par SkanFact une fois la pièce émise
  importee_le      TEXT
);
CREATE INDEX IF NOT EXISTS idx_ventes_afacturer ON ventes(facture_skanfact);

-- ---------- les jetons de poste ----------
-- Jamais le jeton lui-même : seulement son empreinte. Une base lue par un tiers ne doit donner
-- accès à rien.
CREATE TABLE IF NOT EXISTS jetons (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,            -- « le Mac de Skander », pour savoir lequel on révoque
  empreinte     TEXT NOT NULL UNIQUE,
  cree_le       TEXT NOT NULL,
  dernier_usage TEXT,
  revoque_le    TEXT
);

-- ---------- le journal ----------
CREATE TABLE IF NOT EXISTS evenements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  quand      TEXT NOT NULL,
  quoi       TEXT NOT NULL,
  client_id  TEXT,
  licence_id TEXT,
  detail     TEXT,
  par_qui    TEXT
);
CREATE INDEX IF NOT EXISTS idx_evt_quand ON evenements(quand);
