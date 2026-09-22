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

-- Pas de PRAGMA ici : D1 les refuse dans une requête (« not authorized »), et les clés étrangères
-- y sont de toute façon actives. Une ligne qu'on ne peut pas exécuter n'a rien à faire dans un
-- fichier qu'on demande à quelqu'un de coller.

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
  revoquee_motif    TEXT,
  -- P 0.2 : le contenu EXACT qui a été signé (le JSON, à l'octet près). On ne range jamais la clé
  -- elle-même : Ed25519 est déterministe, donc signer de nouveau ce contenu avec la même clé privée
  -- redonne la même clé, à l'identique — et sans la clé privée, ce contenu ne vaut rien.
  charge            TEXT,
  -- 10.8.0 — « sans limite » : une licence de cabinet qui ne compte PAS ses dossiers. NULL ou 0 =
  -- tout ce qui a été vendu avant, c'est-à-dire un quota ordinaire. C'est un ÉTAT, pas un très
  -- grand `dossiers_hors` : une clé à 99 999 afficherait un nombre que personne n'a décidé.
  illimite          INTEGER,
  envoyee_le        TEXT,                 -- la clé est partie par mail (NULL = jamais envoyée)
  -- 9.4.1 : une licence de CABINET (SkanFact Cabinet). NULL = entreprise, c'est-à-dire tout ce qui
  -- a été émis avant. Son sujet est `cabinet_empreinte`, et ce qu'elle porte est un quota de
  -- dossiers hors SkanFact (9.4.0 : on vend des dossiers, jamais des postes).
  type              TEXT,                 -- 'cabinet' ou NULL
  dossiers_hors     INTEGER               -- le quota, en plus des trois gratuits (NULL sauf cabinet)
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
  -- 10.4.0 — 'entreprise' ou 'cabinet'. NULL = tout ce qui a été noté avant, c'est-à-dire l'app
  -- entreprise : elle était seule à s'annoncer. Sans cette colonne, la moitié du parc — celle des
  -- comptables — n'existait nulle part, et deux applications se confondaient sur la même version.
  app            TEXT,
  premiere_fois  TEXT NOT NULL,
  derniere_fois  TEXT NOT NULL
);
-- 10.4.0-beta.3 — `app` ENTRE dans la clé. Sans elle, deux applications qui partagent une identité
-- de poste se battent pour la même ligne : la seconde écrase la première, et le parc perd une
-- moitié en silence. Ça tenait par accident jusqu'ici — chaque application a son propre dossier
-- `userData`, donc son propre `deviceId` — mais un accident n'est pas un garde-fou.
--
-- COALESCE et non `app` nu : dans un index UNIQUE de SQLite, deux NULL sont DISTINCTS. Sur la clé
-- nue, une annonce de l'app entreprise arrivant sur une ligne d'avant la 10.4.0 (app NULL) ne
-- trouverait aucun conflit et créerait un DOUBLON — le poste compterait deux fois. Avec COALESCE,
-- l'ancienne ligne vaut 'entreprise' et se met à jour, ce qu'elle est vraiment : l'app entreprise
-- était seule à s'annoncer avant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_activ_unique
  ON activations(empreinte, device_id, COALESCE(app, 'entreprise'));

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

-- ---------- les réglages de la console (10.5.0) ----------
-- Un prix, un seuil d'alerte, une signature de mail : tout ce qui se décide plutôt que se calcule.
-- Jusqu'ici ces valeurs vivaient dans les VARIABLES du worker (`PRIX_ENTREPRISE`…) ou, pire, en dur
-- dans le code : changer un tarif demandait un déploiement. Un réglage qu'on ne peut pas changer
-- depuis l'écran n'est pas un réglage, c'est une constante avec un nom trompeur.
--
-- Trois rangs, du plus fort au plus faible : ce que porte cette table, sinon la variable du worker,
-- sinon la valeur par défaut écrite dans `REGLAGES`. L'ordre compte — poser une valeur ici doit
-- pouvoir CORRIGER une variable mal réglée sans toucher à Cloudflare, jamais l'inverse.
CREATE TABLE IF NOT EXISTS reglages (
  cle       TEXT PRIMARY KEY,
  valeur    TEXT NOT NULL,
  change_le TEXT NOT NULL
);

-- ---------- les commandes en ligne (10.9.0) ----------
-- Ce qu'un visiteur du site a demandé, AVANT d'avoir payé. Une commande n'est pas une vente : elle
-- devient une vente le jour où le paiement est PROUVÉ, et pas une seconde avant.
--
-- Quatre décisions, et chacune répond à une façon de se faire voler :
--
--   1. Le PRIX ne vient jamais du navigateur. Cette table le porte parce que c'est le serveur qui
--      l'a calculé, depuis ses propres réglages, au moment de la commande. Un montant envoyé par la
--      page se ferait corriger à 1 DT par la première console de développement venue.
--   2. Le CLIENT n'est créé qu'au paiement. Une commande abandonnée ne laisse donc aucune fiche
--      derrière elle, et la table des clients reste ce qu'elle dit être : les gens qui ont acheté.
--   3. `paiement_le` et `etat` sont DEUX choses. Un paiement encaissé dont la clé n'est pas partie
--      est le pire état possible — le client a payé et n'a rien — et il doit pouvoir se lire :
--      `paiement_le` rempli avec `etat` encore « ouverte », c'est l'alerte rouge de la console.
--   4. `id` est une référence PUBLIQUE (elle voyage dans l'adresse de retour) : seize octets, pas
--      quatre. Une référence qu'on peut énumérer est une référence qu'on énumérera.
CREATE TABLE IF NOT EXISTS commandes (
  id           TEXT PRIMARY KEY,
  cree_le      TEXT NOT NULL,
  offre        TEXT NOT NULL,             -- 'independant' ou 'entreprise' — jamais 'cabinet' (§ tarifs)
  duree        TEXT NOT NULL,             -- l'identifiant d'une durée de DUREES
  nom          TEXT NOT NULL,
  email        TEXT NOT NULL,             -- obligatoire : c'est par là que la clé part
  matricule    TEXT,
  tel          TEXT,
  cabinet      TEXT,                      -- l'empreinte du parrain, telle qu'annoncée par l'acheteur
  parraine     INTEGER,                   -- 1 seulement si la base CONNAÎT ce cabinet
  prix_ht      REAL NOT NULL,             -- le tarif affiché, avant remise
  montant_ht   REAL NOT NULL,             -- ce qui est facturé HT : remise déduite
  remise       REAL NOT NULL,             -- en pourcentage, et seulement si le parrain est connu
  tva          REAL NOT NULL,
  timbre       REAL NOT NULL,
  montant_ttc  REAL NOT NULL,             -- ce qui est réellement demandé au payeur
  devise       TEXT NOT NULL,
  paiement_ref TEXT,                      -- la référence rendue par le prestataire
  paiement_le  TEXT,                      -- quand le prestataire a CONFIRMÉ (voir la décision 3)
  etat         TEXT NOT NULL,             -- 'ouverte' | 'payee' | 'abandonnee'
  licence_id   TEXT REFERENCES licences(id),
  client_id    TEXT REFERENCES clients(id),
  echec        TEXT                       -- la dernière raison pour laquelle la clé n'a pas pu partir
);
CREATE INDEX IF NOT EXISTS idx_commandes_ref ON commandes(paiement_ref);
CREATE INDEX IF NOT EXISTS idx_commandes_etat ON commandes(etat, cree_le);

-- ---------- le suivi commercial (10.5.0) ----------
-- Ce que l'éditeur a FAIT d'un prospect ou d'un client : appelé, écrit, rappeler le 12, perdu parce
-- que trop cher. La console savait ce qui EXISTE et ne retenait rien de ce qu'on en faisait : un
-- essai se terminait, l'alerte se levait, on appelait — et le lendemain la même alerte se relevait
-- à l'identique. Une alerte qui ne se referme pas cesse d'être lue au cinquième prospect.
--
-- `sujet` désigne ce qu'on suit, avec le MÊME identifiant que l'alerte correspondante : un essai
-- (« essai:<device_id>:<app> ») ou un client (« client:<id> »). Deux façons de nommer le même
-- prospect donneraient un suivi qui ne referme jamais rien.
--
-- `rappel` est la seule date qui fait taire : d'ici là, le sujet ne redemande rien. `issue` clôt —
-- gagné, ou perdu avec son motif, qui est la seule chose qui apprend quelque chose.
CREATE TABLE IF NOT EXISTS suivis (
  id     TEXT PRIMARY KEY,
  sujet  TEXT NOT NULL,
  quand  TEXT NOT NULL,                   -- horodatage ISO de la saisie
  moyen  TEXT,                            -- appel, mail, visite, message
  note   TEXT,
  rappel TEXT,                            -- AAAA-MM-JJ, ou vide
  issue  TEXT,                            -- '', 'gagne', 'perdu'
  motif  TEXT,                            -- pourquoi perdu : la seule chose qui apprend
  source TEXT                             -- comment il nous a connus, saisi à la main
);
CREATE INDEX IF NOT EXISTS idx_suivis_sujet ON suivis(sujet);
