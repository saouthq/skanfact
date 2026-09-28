# 15 — Slate devient la partie restaurant de SkanFact

*Décidé par Skander le 28/09/2026 ; le détail est **validé par délégation de Skander le même jour**
(« relis-les à ma place et valide toi si c'est bon »), après deux relectures complètes du dépôt. Sa
phrase : « oui je suis d'accord sur ce choix, et on lui refera un
rebranding, mais au moins on a une base et on ne part pas de 0 ». Slate est l'application pour
restaurateurs que Skander a commencée il y a quelques mois (dépôt privé `saouthq/Slate`, dernière
modification le 15/07/2026). Ce document dit ce qu'on en reprend, ce qu'on change, et quand. Suit
`14-fonctions-et-integrations.md` § 3.1 (la restauration) et `08-reprise-de-l-existant.md` (reprendre
plutôt que refaire).*

## En bref (pour Skander)

- **Slate n'est pas fini à part, puis relié** : il **entre dans SkanFact** comme sa partie
  restaurant. Une seule application, une seule connexion, un seul abonnement, et la chaîne complète
  **réservation → table → commande → cuisine → ticket → comptabilité** dans les mêmes données.
- **Ses données quittent Supabase** (un hébergeur hors de Tunisie) pour nos serveurs en Tunisie,
  comme tout le reste (`06`).
- **Quand : en vague 1, environ six mois après le lancement** (décision de Skander du 28/09/2026 :
  « on commence avec la base et après on rajoute Slate »). L'entreprise, le cabinet et la console
  d'abord, stables ; puis toute la partie restaurant d'un coup : le plan de salle et son éditeur,
  le service du jour, les réservations avec le widget public, les rappels, la liste d'attente, le
  fichier clients du restaurant, **et** le mode restaurant de la caisse (tables, cuisine,
  suppléments, addition partagée).
- **Ce qu'il n'a pas** et que SkanFact apporte : la caisse certifiée, l'envoi en cuisine, le stock
  par recette, la facture électronique, la comptabilité.
- **Le nom Slate disparaît** : la partie restaurant porte la marque SkanFact (le nom exact de
  l'offre restaurant se choisit avec le rebranding, § 6).
- **Ses outils d'interface deviennent ceux de toute la plateforme** (shadcn, Tailwind, Base UI), à
  confirmer au prototype sur l'arabe (`12` § 4) : c'est ce qui permet de garder ses écrans au lieu de
  les refaire.

---

## 1. Ce qu'est Slate (mesuré le 28/09/2026)

| Mesure | Valeur |
|---|---|
| Écrans et code | ≈ 600 fichiers TypeScript, ≈ 180 000 lignes |
| Base de données | 206 migrations PostgreSQL, **multi-entreprise avec sécurité par ligne** (la même méthode que notre `01` R2) |
| Tests | 40 fichiers ; **371 tests passent** ; un fichier ne se lance pas sans les réglages de connexion (pas un défaut du code) ; des tests d'isolation entre restaurants sur un vrai PostgreSQL |
| Vérification des types | **Propre** (0 erreur) |
| Fonctions serveur | 13 (paiement Konnect, envoi WhatsApp, rappels, avis, campagnes, absences) |
| Outils | React 19, TypeScript, Tailwind 4, shadcn et Base UI, TanStack, Zod, React Query, Konva (dessin du plan) ; Supabase comme serveur |
| Avancement | Le pilote visé en juin 2026 avait six parcours, finis entre 35 et 88 % ; le reste des écrans existe à 30-70 % (`docs/MVP-PILOTE.md` de Slate) |

---

## 2. Ce qu'on reprend, écran par écran

| Partie de Slate | Taille | Ce qu'on en fait | Quand |
|---|---|---|---|
| **Éditeur du plan de salle** (salles, zones, tables, modèles, versions) | ≈ 17 500 lignes | **Repris** : c'est le plan de salle du `14` § 3.1, déjà écrit | Vague 1 |
| **Service du jour** (plan interactif, frise, statuts assis ou à table, avec l'heure) | dans les réservations | **Repris**, et relié aux commandes et à la caisse | Vague 1 |
| **Réservations** : liste, création, modification, annulation, table attribuée, cycle complet des statuts, reconfirmation, absences | ≈ 24 000 lignes | **Repris** dans le module Réservations (`02` § 2) | Vague 1 |
| **Widget public de réservation** (`/r/:slug`), créneaux réels, calendrier | ≈ 6 400 lignes | **Repris** | Vague 1 |
| **Rappels** avant la réservation (la veille, deux heures avant) | fonction serveur | **Repris**, envoyés par **SMS et e-mail** en Tunisie, et par WhatsApp automatique (`14` § 4) | Vague 1 |
| **Liste d'attente** | petite | Reprise | Vague 1 |
| **Fiche client du restaurant**, fusion des doublons, étiquettes | ≈ 5 000 lignes | **Fusionnée** avec la fiche client de SkanFact (`01` § 5) : un seul client pour la réservation, le ticket et la facture | Vague 1 |
| **Horaires, fermetures, exceptions, réglages du service**, dont le **Ramadan** | dans les réglages | Repris | Vague 1 |
| **Acompte de réservation** (prépaiement Konnect) | petite | Repris sur le paiement en ligne du `14` § 2.2 (compte Konnect de l'entreprise, preuve relue chez Konnect) | Vague 1 |
| **Vente à emporter et livraison en ligne** (commande par le client sur une page) | ≈ 3 000 lignes | Reprise comme la page de commande du restaurant ; les boutiques WooCommerce et Shopify suivent en vague 2 (`14` § 4) | Vague 1 |
| **Messages WhatsApp reçus**, conversations | petite | Repris avec WhatsApp automatique (données chez Meta, hors de Tunisie : avis du juriste) | Vague 1 |
| **Campagnes marketing**, segments, désinscription | ≈ 5 400 lignes | Reprises ; le suivi des prospects suit en vague 2 (`14` § 3.6) | Vague 1 |
| **Avis clients** (demande d'avis, synchronisation) | ≈ 2 300 lignes | Repris ; la synchronisation avec Google ou TripAdvisor est un flux vers l'étranger, compté avant d'être ouvert (`05` § 4.3, `14` § 4) | Vague 1 |
| **Bons cadeaux** | petite | Repris avec les cartes cadeaux du `14` § 3.2 (qui avancent de la vague 2 à la vague 1) | Vague 1 |
| **Menus numériques** | ≈ 1 000 lignes | Reliés au catalogue de SkanFact (un article, un prix, une TVA) | Vague 1 |
| **Statistiques, revenus, tableau de bord** | ≈ 4 300 lignes | Idées et écrans repris dans le Pilotage ; les chiffres viennent des tickets et des pièces, **jamais d'un second calcul** | Lancement (les idées), vague 1 (ce qui est propre au restaurant) |
| **Comptabilité de Slate** (paiements, virements, exports) | ≈ 4 200 lignes | **Pas reprise** : la comptabilité de SkanFact la remplace | — |
| **Abonnement, parrainage, inscription, équipe** | ≈ 3 000 lignes | **Pas repris** tels quels : ceux de SkanFact (`03`, `07`, `10`) ; les bonnes idées d'écran, oui | — |
| **Console d'administration** (restaurants, supervision, support, audit) | ≈ 18 000 lignes | Idées reprises pour notre console (`10`), pas le code : elle vivait dans l'application des clients | — |
| **Aide, pages légales, pages d'erreur** | ≈ 4 000 lignes | Idées reprises ; une seule aide pour tout SkanFact (`11` § 4) | — |
| **Vocabulaire adapté au lieu** (couverts, places, transats pour un club de plage) | petite | Repris | Vague 1 |

---

## 3. Ce qui change en le reprenant

1. **L'hébergement.** Slate parle à Supabase, hors de Tunisie. Dans SkanFact, tout passe par **notre
   serveur et notre API** (`02` M8, `12` § 3) ; les fonctions Supabase deviennent des travaux de
   notre file (`12` § 3).
2. **L'argent.** Slate range les montants de trois façons (dinars à virgule, millimes, centimes).
   Dans SkanFact, **l'argent est en entiers, dans l'unité de la devise** (`01` R3), partout, et
   chaque montant repris est converti avec un test qui le prouve.
3. **Les droits.** Les rôles de Slate deviennent ceux du `03` (Propriétaire, Administrateur,
   Caissier, **Serveur**…), par la porte unique (`03` D2).
4. **Le client.** Un client de restaurant est une fiche `tiers` de SkanFact (`01` § 5) ; ses données
   de réservation (préférences, allergies, occasions) sont des champs de sa fiche ou des champs
   personnalisés (`02` § 5).
5. **Le hors-ligne.** Slate est en ligne seulement ; dans SkanFact, la salle et la caisse tiennent
   pendant une coupure (`04` § 1). La **réservation**, elle, reste en ligne (le widget et les
   rappels vivent sur le serveur).
6. **Les tests.** Les 371 tests de Slate et ses tests d'isolation entre restaurants sont **portés**
   avec le code qu'ils protègent, et chacun se prouve en réintroduisant son défaut (règle du projet).
7. **Les textes.** Slate a déjà ses textes dans un fichier (`src/i18n/fr.json`) : ils rejoignent le
   catalogue de textes (`14` § 5). **La partie restaurant reste en français seulement** (décision de
   Skander, 28/09/2026) : pas de traduction en arabe, et ses écrans sont dispensés du test de droite
   à gauche ; le catalogue garde seulement la porte ouverte.

---

## 4. Les outils d'interface

Slate est construit avec **shadcn, Tailwind et Base UI** ; le `12` proposait **Mantine**. Pour garder
les écrans de Slate au lieu de les refaire, **la plateforme prend les outils de Slate**, à une
condition vérifiée au prototype (J0) : l'écriture de droite à gauche (l'arabe) doit tenir, avec la
langue factice du `14` § 5. Tailwind sait écrire « début » et « fin » au lieu de « gauche » et
« droite » ; Slate en utilise déjà une partie.

---

## 5. Ce que ça change au calendrier

- **Le lancement s'allège** : le mode restaurant de la caisse quitte l'étape 4 du `09`. Le
  lancement passe à **25 mois au plan, 28 avec la marge** (au lieu de 27 et 30).
- **La vague 1 reçoit toute la partie restaurant**, Slate compris. Le plan de salle, déjà écrit,
  fait gagner le temps que les réservations demandent.
- **Ce qu'on prépare dès maintenant, pour que l'ajout ne coûte rien** : les tables du restaurant
  sont déjà dans le modèle de données (`01` § 24.4 et 24.8), et la plateforme prend dès le départ
  les outils d'interface de Slate (§ 4).

---

## 6. Le rebranding

Décision de Skander : Slate prend l'identité de SkanFact. **À décider** : le nom de l'offre ou de la
partie restaurant, ses couleurs dans la charte de SkanFact, et ce qu'on dit aux restaurateurs qui
auraient vu Slate. **Aucun nom nouveau n'est public** avant le dépôt de la marque (`05` § 4.6).

---

## 7. À VÉRIFIER

1. ~~Des données réelles sur le projet Supabase de Slate ?~~ **Réglé** : Slate n'a jamais été en
   production, il ne contient que des données de développement (Skander, 28/09/2026).
2. **Les secrets** du projet Supabase (clés, WhatsApp, Konnect) : les **révoquer** quand Slate
   s'arrête, pour qu'aucune clé ne reste valable.
3. **L'arabe** avec shadcn, Tailwind et Base UI (§ 4), au prototype.
4. **Les rappels par SMS** : le prix par message, **refacturé** à l'entreprise qui les envoie, jamais
   caché dans notre prix (`14` § 6) ; le fournisseur (`03` § 11).

## 8. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (**Skander**) | Slate entre dans SkanFact comme sa partie restaurant, au lieu d'être fini à part et relié ; il prend l'identité de SkanFact |
| 28/09/2026 (**Skander**, le même jour) | **La partie restaurant vient en vague 1**, après une base stable (entreprise, cabinet, console) : plan de salle, service du jour, réservations et widget, rappels, liste d'attente, fiche client fusionnée, mode restaurant de la caisse, vente en ligne, WhatsApp, campagnes, avis, bons cadeaux, menus |
| 28/09/2026 (par délégation) | Les données passent sur nos serveurs en Tunisie, l'argent en entiers, les droits du `03`, les tests portés |
| 28/09/2026 (par délégation) | La plateforme prend les outils d'interface de Slate (shadcn, Tailwind, Base UI), sous réserve de l'arabe au prototype |
| 28/09/2026 (**Skander**) | La partie restaurant reste **en français seulement** : pas d'arabe pour Slate ni pour le mode restaurant de la caisse (`14` § 5) |
