-- Les données du prototype. Même ordre de grandeur que les jeux de saturation de la v10
-- (8 000 pièces, 1 500 clients) ramenés à 13 mois : ce qu'un poste garde (04 § 2).
-- Tout est déterministe (les identifiants sortent d'un md5), pour que deux mesures se comparent.
set search_path = proto;

create function uid(texte text) returns uuid language sql immutable as $$ select md5(texte)::uuid $$;

insert into entreprise values
  (uid('pme'), 'PME de services et de négoce'),
  (uid('voisine'), 'Entreprise voisine (ne doit jamais être lue)'),
  (uid('magasin'), 'Magasin (500 tickets par jour)');

insert into membre values
  (uid('m-proprio'), uid('pme'), 'Propriétaire', 'proprietaire'),
  (uid('m-commercial'), uid('pme'), 'Commercial', 'commercial'),
  (uid('m-paie'), uid('pme'), 'Paie', 'paie'),
  (uid('m-voisin'), uid('voisine'), 'Voisin', 'proprietaire'),
  (uid('m-caissier'), uid('magasin'), 'Caissier', 'caissier');

insert into appareil values
  (uid('a-proprio-1'), uid('m-proprio'), null),
  (uid('a-proprio-2'), uid('m-proprio'), null),
  (uid('a-commercial'), uid('m-commercial'), null),
  (uid('a-paie'), uid('m-paie'), null),
  (uid('a-voisin'), uid('m-voisin'), null),
  (uid('a-caisse'), uid('m-caissier'), null),
  (uid('a-vole'), uid('m-proprio'), null);

-- Deux entreprises remplies de la même façon : la PME et sa voisine (plus petite).
do $$
declare e record;
begin
  for e in select * from (values ('pme', 1500, 600, 8000, 20), ('voisine', 200, 100, 800, 5)) v(nom, nt, na, np, ns) loop
    insert into tiers (id, entreprise, nom, telephone, adresse)
      select uid(e.nom || '-t' || i), uid(e.nom), 'Client ' || i || ' — Société ' || md5(i::text)::varchar(10) || ' SARL',
             '+216 ' || (20000000 + i * 37 % 79999999), i || ' rue de la République, 1002 Tunis Belvédère'
        from generate_series(1, e.nt) i;
    insert into article (id, entreprise, designation, prix_millimes, tva_pourmille)
      select uid(e.nom || '-a' || i), uid(e.nom), 'Article ' || i || ' — référence ' || md5('a' || i)::varchar(8),
             1000 + (i * 7919) % 900000, (array[0, 70, 130, 190])[1 + i % 4]
        from generate_series(1, e.na) i;
    -- 13 mois de pièces ; les 40 dernières restent des brouillons.
    insert into piece (id, entreprise, type, statut, numero, tiers, jour, total_millimes, note)
      select uid(e.nom || '-p' || i), uid(e.nom), (array['facture', 'devis', 'avoir', 'livraison'])[1 + i % 4],
             case when i > e.np - 40 then 'brouillon' else 'emise' end,
             case when i > e.np - 40 then null else 'FAC-' || lpad(i::text, 6, '0') end,
             uid(e.nom || '-t' || (1 + i % e.nt)), date '2025-09-01' + (i * 395 / e.np),
             0, case when i % 5 = 0 then 'Livraison à prévoir avant la fin du mois, voir le bon de commande' end
        from generate_series(1, e.np) i;
    insert into ligne_piece (id, entreprise, piece, article, designation, quantite_milliemes, prix_millimes)
      select uid(e.nom || '-l' || i || '-' || j), uid(e.nom), uid(e.nom || '-p' || i), uid(e.nom || '-a' || (1 + (i * j) % e.na)),
             'Article ' || (1 + (i * j) % e.na) || ' — désignation reprise du catalogue', (1 + (i + j) % 12) * 1000,
             1000 + ((i * j) * 7919) % 900000
        from generate_series(1, e.np) i, generate_series(1, 5) j;
    update piece p set total_millimes = s.t from (select piece, sum(quantite_milliemes * prix_millimes / 1000) t from ligne_piece group by piece) s where s.piece = p.id;
    insert into bulletin (id, entreprise, salarie, mois, brut_millimes, net_millimes)
      select uid(e.nom || '-b' || s || '-' || m), uid(e.nom), 'Salarié ' || s, date '2025-09-01' + (m || ' months')::interval,
             900000 + s * 45000, 780000 + s * 38000
        from generate_series(1, e.ns) s, generate_series(0, 12) m;
  end loop;
end $$;

analyze;
