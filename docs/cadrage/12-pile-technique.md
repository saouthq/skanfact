# 12 — La pile technique

*Proposé le 28/09/2026. **À valider par Skander.** Suit `VISION-ARCHITECTURE.md` (§ 4, § 8 : pas de
microservices ni de Kubernetes ; § 9 : TypeScript et une bibliothèque d'interface, validés le
27/09) et les documents 01 à 11. **À décider avant la première ligne de code** (J0, `09`).*

## En bref (pour Skander)

Ce document choisit **les outils** avec lesquels la plateforme sera construite. Les critères, dans
l'ordre :
1. **Tenir à une seule personne** (vision R11) : peu de pièces, des outils éprouvés, pas de service à
   payer à l'étranger.
2. **Tout en Tunisie** : aucun outil qui envoie des données dehors (`05` § 4.3).
3. **Libre et gratuit** quand c'est possible. Tout ce qui est choisi ici est un logiciel libre qu'on
   installe chez nous.
4. **Connu de Claude** : des outils très répandus, que Claude maîtrise bien, parce que le quota est
   notre temps de développement (vision § 11, point 4).
5. **Garder la main sur les calculs et sur le SQL** : c'est la leçon d'Odoo (vision § 2).

Chaque choix dit **pourquoi**, et **ce qui le remettrait en cause**. Deux choix attendent le
**prototype** du `04` § 9 : l'outil de synchronisation et le stockage sur le poste.

---

## 1. Où vit le code

**Un dépôt neuf, `saouthq/skanfact-plateforme`**, public comme les autres (décision du 27/09).
- Le dépôt actuel reste celui de l'**application actuelle**, en entretien, avec ses publications et
  ses canaux. Mélanger les deux mêlerait deux cycles de publication et deux sortes de tests.
- Le dépôt neuf est **un seul dépôt pour toute la plateforme** : le serveur, l'application web, la
  coque de bureau et son agent local, le moteur partagé, l'aide, les outils.
- Il est créé à **J0**, avec son intégration continue, avant la première ligne de code métier.
- Le dépôt étant public, **aucun secret** n'y entre, jamais (`06` S3). Un outil le vérifie à chaque
  envoi (§ 8).

```
skanfact-plateforme/
  moteur/        le calcul tunisien porté (pièces, TVA, retenue, paie, écritures), sans dépendance
  serveur/       le programme unique, rangé par module (socle, ventes, achats…, console)
  web/           l'application (écrans, copie locale, file d'envoi)
  bureau/        la coque et l'agent local (clé USB, imprimante, tiroir, douchette)
  aide/          les articles d'aide, une seule fois (`11` § 4)
  base/          migrations, règles de sécurité par ligne
  exploitation/  installation des serveurs, sauvegardes, bascule, fiches d'incident
  tests/         invariants, droits, charge, parcours
```

---

## 2. Le langage et le moteur

| Choix | Pourquoi | Ce qui le remettrait en cause |
|---|---|---|
| **TypeScript**, partout (serveur, web, bureau) | Validé le 27/09 ; un seul langage, et le moteur tourne à l'identique sur le poste et sur le serveur | Rien de prévisible |
| **Node.js**, version maintenue à long terme | Le moteur actuel est du JavaScript : il se porte sans changer de langage ; un seul programme qui tient beaucoup de connexions (vision § 2) | Une mesure de charge qui montrerait un calcul trop lent : on sortirait **ce** calcul, pas le programme |
| **L'argent en `bigint`** (entiers natifs du langage) | `01` R3 : jamais de nombre à virgule ; les entiers de 64 bits de la base se lisent sans perte | — |
| **Les dates avec `Temporal`** (la nouvelle norme du langage, et son complément tant que les navigateurs ne l'ont pas tous) | Il distingue enfin un **jour de calendrier** d'un **instant** : c'est `01` R5 dit par l'outil lui-même | — |
| **Le moteur sans aucune dépendance** | Il se teste seul, tourne partout, et ne change pas quand une bibliothèque change | — |

---

## 3. Le serveur

| Choix | Pourquoi | Ce qui le remettrait en cause |
|---|---|---|
| **Fastify** (le cadre du serveur) | Rapide, simple, très répandu ; chaque route **déclare** son schéma et son geste (`03` D2) | — |
| **Zod** pour décrire les données échangées | Une seule description sert à vérifier les entrées et à **écrire la documentation de l'API** (vision § 4.7 : l'API d'abord) | — |
| **PostgreSQL**, version maintenue | Décidé le 27/09 ; sécurité par ligne, partitionnement, recherche plein texte | — |
| **Kysely** pour écrire les requêtes, et du **SQL écrit à la main** pour les états lourds et les règles de sécurité par ligne | On garde la main sur le SQL (vision § 2 : l'ORM lent d'Odoo) ; Kysely vérifie les requêtes avec les types, sans rien cacher | — |
| **Migrations en fichiers numérotés**, en deux temps (ajouter, puis retirer plus tard) | `06` § 8 : jamais de coupure pendant une mise à jour | — |
| **pg-boss**, la file de travaux **dans PostgreSQL** | Pas de composant de plus à exploiter (vision R11) ; les travaux (TTN, PDF, mails) sont sauvegardés avec la base | Un volume de travaux que PostgreSQL ne tiendrait plus : on changerait de file, pas de programme |
| **Recherche** : plein texte de PostgreSQL, avec la recherche approchée (`pg_trgm`) et sans accents | Pas de moteur de recherche à part ; la palette Ctrl K (`02` § 4.2) | **À VÉRIFIER** : la recherche en arabe ; si elle ne suffit pas, on l'ajoutera plus tard |
| **PDF** : la page HTML de la pièce, imprimée par un **Chromium sans écran**, dans la file de travaux | Les gabarits de la v10 sont du HTML : ils se portent. Le même rendu partout | — |
| **Signature XAdES et envoi à la TTN** : écrits par nous, en s'appuyant sur une bibliothèque libre de signature XML, et avec l'intergiciel libre de Tekru comme référence (`05` § 9) | Le cœur de notre promesse ; on doit le comprendre ligne à ligne | **À VÉRIFIER** sur l'environnement de test de la TTN |
| **Mots de passe** : empreinte **Argon2id** ; la liste des mots de passe volés est **téléchargée et gardée chez nous** | `03` § 6 : rien ne sort, même pas un début d'empreinte | — |
| **Code sur le téléphone** : SMS (fournisseur tunisien) ou application d'authentification (TOTP) | `03` § 6 | — |
| **E-mails** : un serveur d'envoi **en Tunisie**, par la file de travaux | `05` § 4.3 | **À VÉRIFIER** : fournisseur, délivrabilité |

---

## 4. L'application (web installable)

| Choix | Pourquoi | Ce qui le remettrait en cause |
|---|---|---|
| **React** | La bibliothèque d'interface la plus répandue ; validé le 27/09 (« une vraie bibliothèque d'interface ») | — |
| **Mantine** pour les composants (boutons, champs, fenêtres, dates) | Complet, accessible, gère l'**écriture de droite à gauche** (l'arabe, vision R12) sans travail en plus | Un manque bloquant découvert au prototype |
| **TanStack Table et Virtual** pour les listes et la **grille de saisie** | Sans habillage imposé : on garde nos règles d'interface (un seul bouton principal, rien ne pousse sous le curseur) ; tient des dizaines de milliers de lignes (saturation 10.14.0) | — |
| **Textes traduisibles dès le premier écran** (catalogue de messages), propriétés CSS « de début et de fin » | Vision R12 : l'arabe plus tard, sans tout reprendre (c'est déjà la règle depuis la 9.4.10) | — |
| **Application installable** (service worker) | `00` : la même application dans le navigateur, installée, ou dans la coque | — |
| **Copie locale** : **SQLite dans le navigateur** (version WebAssembly, stockée dans le système de fichiers privé du navigateur) | Une vraie base sur le poste, chiffrable, rapide (budget de 100 ms à la frappe, vision § 6) | **Le prototype du `04` § 9 tranche**, avec le stockage persistant (`04` § 4) |
| **Synchronisation** : écriture par **notre file d'opérations** ; lecture par **notre propre chemin** de préférence | `04` § 9.1 et 9.2 : une seule porte pour les droits | **Le prototype tranche** entre notre chemin et PowerSync |
| **Visites guidées** : le moteur de la v10 (`visite.js`), porté | Il a fait ses preuves ; chaque geste expliqué (`02` M6) | — |

---

## 5. La coque de bureau et l'agent local

| Choix | Pourquoi | Ce qui le remettrait en cause |
|---|---|---|
| **Electron** pour la coque | On le connaît (toute la v10) ; l'agent local tourne dans le même programme ; les mises à jour savent déjà se faire | Une coque plus légère (Tauri) ne vaut pas de réapprendre un autre langage pour une seule personne |
| **Agent local** : clé USB de signature par l'interface standard des jetons cryptographiques (PKCS#11), imprimante de tickets en ESC/POS, tiroir par l'imprimante, douchette comme un clavier | Les protocoles du matériel vendu en Tunisie (note de recherche `hebergement_technique.md`) | **À VÉRIFIER** : les pilotes des clés USB TunTrust sur Windows et Mac |
| **Application signée** (Apple, Microsoft) | `06` § 10 : un prérequis, pas une option | — |

---

## 6. L'exploitation

| Choix | Pourquoi | Ce qui le remettrait en cause |
|---|---|---|
| **Serveurs dédiés** sous Linux, **conteneurs** lancés par **Docker Compose**, **sans Kubernetes** | Vision § 8 ; le plus simple qui tienne à deux sites | Plusieurs cellules et beaucoup de serveurs : on revoit à ce moment-là |
| **Installation des serveurs par des scripts relus** (Ansible) | `06` S5 : tout s'automatise ; un serveur neuf s'installe sans mémoire humaine | — |
| **Sauvegardes : pgBackRest** | Retour à la minute, sauvegardes chiffrées, deux dépôts (un par site), vérification | — |
| **Réplication : celle de PostgreSQL**, en continu vers le site de secours ; **bascule par un script**, décidée par un humain | `06` § 4.1 : 4 heures pour la perte du site ; une bascule automatique entre deux sites est un piège (les deux se croiraient le principal) | Un objectif de reprise plus court |
| **Stockage des fichiers : MinIO** (compatible S3), avec le **verrou d'écriture** pour les archives de 10 ans et la copie intouchable | `06` § 4.2 | **À VÉRIFIER** : sa licence (AGPL) pour notre usage, sans modification |
| **Secrets : fichiers chiffrés (SOPS et age)**, clés dans le pli scellé | `06` § 5 et § 9.3 : pas de coffre compliqué à exploiter seul | — |
| **Surveillance : Prometheus, Alertmanager, Grafana**, chez nous ; alertes sur le téléphone | `06` § 7 | — |
| **Erreurs du programme** : un outil libre compatible Sentry, chez nous | Rien ne part à l'étranger ; jamais une donnée de client dans un rapport d'erreur (`06` S4) | — |
| **Surveillance extérieure et page d'état** : un outil libre qui tourne dans **GitHub Actions** et publie la page d'état avec le site | Gratuit (dépôts publics), hors de nos serveurs, ne voit qu'une adresse de santé (`11` § 5) | Une précision insuffisante (vérifications toutes les 5 minutes au mieux) : on ajouterait une sonde dans une autre ville |

---

## 7. Les environnements

| Environnement | Où | Données |
|---|---|---|
| **Le poste de développement** | La session de Claude (conteneurs) | Fabriquées, l'exemple de cinq ans |
| **Test** | Un petit serveur, n'importe où | **Jamais de donnée réelle** (`06` § 6) : l'exemple, la saturation, des données fabriquées |
| **Pré-production** | En Tunisie, **identique** à la production | Données fabriquées ; c'est là qu'on essaie les migrations et les bascules |
| **Production** | En Tunisie, deux sites (`06`) | Les vraies |

---

## 8. Les tests et l'intégration continue

Tout ce qui fait la qualité de la v10 est porté (`08` § 1) :

| Tests | Outil | Quand |
|---|---|---|
| Moteur, invariants « deux chemins, un chiffre », **banc de comparaison avec la v10** au millime | Vitest | À chaque envoi |
| **Droits** : chaque rôle contre chaque geste ; lire l'entreprise d'à côté ; aucune route sans geste (`03` § 9) | Vitest, contre un vrai PostgreSQL | À chaque envoi |
| **Parcours** reconnus à ce qu'ils contiennent, pas à leur rang (règle du projet) | Playwright (déjà utilisé) | À chaque envoi pour les courts, chaque nuit pour les longs |
| **Accessibilité** | Contrôle automatique dans les parcours | À chaque envoi |
| **Charge**, avec les seuils écrits d'avance (vision § 6) | Un outil de charge, comme `npm run charge` aujourd'hui | Avant chaque version |
| **Hors ligne** : coupure, double envoi, conflit, révocation (`04` § 9.3) | Playwright | Chaque nuit |
| **Secrets** : aucun dans le dépôt | Un chercheur de secrets, qui arrête la construction | À chaque envoi |
| **Test humain** : refaire à la souris et regarder l'écran (décision du 24/09) | Les outils de `scripts/humain/`, adaptés au navigateur | Avant d'annoncer quoi que ce soit |

**L'intégration continue tourne sur GitHub Actions** : gratuite pour un dépôt public (décision du
27/09). Une construction rouge **ne se contourne jamais** : on ne saute pas un test, on ne le met pas
de côté. Chaque test se prouve en réintroduisant son défaut.

---

## 9. Ce qui n'est pas choisi, exprès

- **Pas de microservices, pas de Kubernetes, pas de file de messages à part** : vision § 8.
- **Pas de service à l'étranger** (authentification, e-mails, erreurs, mesure) : `05` § 4.3.
- **Pas de moteur de recherche à part**, pas de cache à part : PostgreSQL suffit tant qu'une mesure ne
  dit pas le contraire.
- **Pas d'ORM qui cache le SQL** : vision § 2.
- **Pas d'intelligence artificielle dans le produit au lancement.** La lecture de photo de facture de
  la v10 envoie une image à l'étranger : elle ne revient qu'avec un service en Tunisie, ou avec
  l'autorisation de l'INPDP (`05` § 4.3).

---

## 10. À VÉRIFIER

1. **Le prototype** du `04` § 9.3 : synchronisation et stockage sur le poste.
2. **La signature XAdES** acceptée par la TTN, avec la bibliothèque choisie.
3. **Les pilotes des clés USB** TunTrust (Windows, Mac) pour l'agent local.
4. **La licence de MinIO** pour notre usage.
5. **La recherche en arabe** avec PostgreSQL.
6. **Le fournisseur d'e-mails et de SMS** en Tunisie (`03` § 6).

## 11. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | Un dépôt neuf et public, `skanfact-plateforme`, créé à J0 ; le dépôt actuel reste celui de la v10 |
| 28/09/2026 (proposé) | TypeScript et Node.js ; argent en `bigint`, dates avec `Temporal` ; le moteur sans dépendance |
| 28/09/2026 (proposé) | Fastify, Zod, PostgreSQL, Kysely et SQL écrit à la main, pg-boss ; PDF par Chromium ; signature et envoi TTN écrits par nous |
| 28/09/2026 (proposé) | React, Mantine, TanStack Table ; textes traduisibles dès le départ ; copie locale et synchronisation tranchées par le prototype |
| 28/09/2026 (proposé) | Electron pour la coque et l'agent local ; application signée |
| 28/09/2026 (proposé) | Serveurs dédiés, Docker Compose, Ansible, pgBackRest, réplication PostgreSQL avec bascule par script, MinIO, SOPS, Prometheus et Grafana ; tout chez nous, en Tunisie |
| 28/09/2026 (proposé) | Quatre environnements, jamais de donnée réelle hors production ; tous les tests de la v10 portés ; intégration continue sur GitHub Actions, jamais contournée |
