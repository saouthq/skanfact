-- Le prototype de synchronisation (docs/cadrage/04-hors-ligne-et-synchro.md § 9.3).
-- Un modèle RÉDUIT, mais avec les règles du cadrage qui décident du chemin de lecture :
--   - chaque ligne porte son entreprise, et la base elle-même refuse l'entreprise d'à côté (01 R2) ;
--   - la paie n'est visible que des rôles qui y ont droit (03 D10), par la MÊME porte ;
--   - chaque ligne porte une révision croissante : « tout ce qui a changé depuis N » (04 § 9.2) ;
--   - l'argent en entiers (millimes), jamais en virgule (01 R3).
-- Ce n'est pas le modèle de la plateforme : c'est juste ce qu'il faut pour mesurer.

drop schema if exists proto cascade;
create schema proto;
set search_path = proto;

-- Une seule suite de révisions pour toutes les tables : un poste retient UN nombre.
create sequence revision_seq;

create table entreprise (
  id uuid primary key,
  nom text not null
);

create table membre (
  id uuid primary key,
  entreprise uuid not null references entreprise(id),
  nom text not null,
  role text not null check (role in ('proprietaire', 'commercial', 'caissier', 'paie'))
);

create table appareil (
  id uuid primary key,
  membre uuid not null references membre(id),
  revoque_le timestamptz
);

-- Les tables qui descendent sur les postes. Toutes : entreprise, révision, supprime.
create table tiers (
  id uuid primary key,
  entreprise uuid not null references entreprise(id),
  nom text not null,
  telephone text,
  adresse text,
  -- La révision de CHAQUE champ : c'est ce qui permet la fusion champ par champ (04 § 5).
  champs_rev jsonb not null default '{}',
  supprime boolean not null default false,
  revision bigint not null default nextval('revision_seq')
);

create table article (
  id uuid primary key,
  entreprise uuid not null references entreprise(id),
  designation text not null,
  prix_millimes bigint not null,
  tva_pourmille int not null,
  supprime boolean not null default false,
  revision bigint not null default nextval('revision_seq')
);

create table piece (
  id uuid primary key,
  entreprise uuid not null references entreprise(id),
  type text not null,
  statut text not null check (statut in ('brouillon', 'emise')),
  numero text,
  tiers uuid references tiers(id),
  jour date not null,
  total_millimes bigint not null default 0,
  note text,
  supprime boolean not null default false,
  revision bigint not null default nextval('revision_seq')
);

create table ligne_piece (
  id uuid primary key,
  entreprise uuid not null references entreprise(id),
  piece uuid not null references piece(id),
  article uuid references article(id),
  designation text not null,
  quantite_milliemes bigint not null,
  prix_millimes bigint not null,
  supprime boolean not null default false,
  revision bigint not null default nextval('revision_seq')
);

create table ticket (
  id uuid primary key,
  entreprise uuid not null references entreprise(id),
  caisse uuid not null,
  numero int not null,
  instant timestamptz not null,
  total_millimes bigint not null,
  empreinte text not null,
  precedente text not null,
  supprime boolean not null default false,
  revision bigint not null default nextval('revision_seq'),
  unique (caisse, numero)
);

-- La paie : la ligne que le poste d'un commercial ne doit JAMAIS recevoir (seuil : 0).
create table bulletin (
  id uuid primary key,
  entreprise uuid not null references entreprise(id),
  salarie text not null,
  mois date not null,
  brut_millimes bigint not null,
  net_millimes bigint not null,
  supprime boolean not null default false,
  revision bigint not null default nextval('revision_seq')
);

-- La file d'opérations reçues (04 § 4) : un identifiant créé sur le poste, un ordre par appareil.
create table operation (
  id uuid primary key,
  entreprise uuid not null,
  appareil uuid not null references appareil(id),
  seq bigint not null,
  format int not null,
  type text not null,
  statut text not null,
  recu_le timestamptz not null default now(),
  unique (appareil, seq)
);

-- « À reprendre » (04 § 5.2) : rien n'est jeté, tout ce qui est mis de côté se voit.
create table a_reprendre (
  id uuid primary key default gen_random_uuid(),
  entreprise uuid not null,
  operation uuid not null,
  objet text not null,
  raison text not null,
  version_mise_de_cote jsonb not null,
  supprime boolean not null default false,
  revision bigint not null default nextval('revision_seq')
);

-- Toute modification prend une révision neuve : c'est elle que « depuis N » compare.
create function nouvelle_revision() returns trigger language plpgsql as $$
begin
  new.revision := nextval('proto.revision_seq');
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tiers', 'article', 'piece', 'ligne_piece', 'ticket', 'bulletin', 'a_reprendre'] loop
    execute format('create trigger rev before update on %I for each row execute function nouvelle_revision()', t);
    execute format('create index on %I (entreprise, revision)', t);
  end loop;
end $$;

-- ── La porte, dans la base elle-même (01 R2, 03 D2) ──────────────────────────────────────────
-- Le serveur se connecte avec un rôle SANS privilège, et pose l'entreprise et le rôle de la
-- personne pour la transaction. Même si le code du serveur se trompe de filtre, la base refuse.
drop role if exists proto_app;
create role proto_app login password 'proto';
grant usage on schema proto to proto_app;
grant select, insert, update on all tables in schema proto to proto_app;
grant usage on all sequences in schema proto to proto_app;

create function moi_entreprise() returns uuid language sql stable as
  $$ select nullif(current_setting('app.entreprise', true), '')::uuid $$;
create function moi_role() returns text language sql stable as
  $$ select current_setting('app.role', true) $$;

do $$
declare t text;
begin
  foreach t in array array['tiers', 'article', 'piece', 'ligne_piece', 'ticket', 'a_reprendre', 'operation'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy entreprise on %I using (entreprise = proto.moi_entreprise()) with check (entreprise = proto.moi_entreprise())', t);
  end loop;
end $$;

alter table bulletin enable row level security;
create policy paie on bulletin
  using (entreprise = proto.moi_entreprise() and proto.moi_role() in ('proprietaire', 'paie'))
  with check (entreprise = proto.moi_entreprise() and proto.moi_role() in ('proprietaire', 'paie'));

-- Les tables d'identité : lues par le serveur pour décider (pas de RLS ici, jamais descendues).
grant select on entreprise, membre, appareil to proto_app;
