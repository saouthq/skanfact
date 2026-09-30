# 12 — La pile technique

*Proposé le 28/09/2026. **Validé par délégation de Skander le 28/09/2026** (« relis-les à ma place et valide toi si c'est bon »), après deux relectures complètes du dépôt le même jour. Suit `VISION-ARCHITECTURE.md` (§ 4, § 8 : pas de
microservices ni de Kubernetes ; § 9 : TypeScript et une bibliothèque d'interface, validés le
27/09) et les documents 01 à 11. **À décider avant la première ligne de code** (J0, `09`) : deux points étaient suspendus au prototype ; **la synchronisation et la copie locale sont tranchées le 28/09/2026** (`04` § 9.4) ; l'essai de l'arabe avec les outils d'interface **n'a plus lieu d'être** : Skander a abandonné l'arabe le même jour (`14` § 5). Complété
le même jour pour suivre le `14` (lecture de documents, API publique, téléphone, langue factice,
imprimantes de cuisine).*

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

Chaque choix dit **pourquoi**, et **ce qui le remettrait en cause**. L'outil de synchronisation et
le stockage sur le poste ont été **tranchés par le prototype** du `04` § 9, le 28/09/2026.

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
  bureau/        la coque et l'agent local (clé USB, imprimantes, tiroir, douchette)
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
| **Lecture de documents** : un moteur de lecture libre (**PaddleOCR** ou **Tesseract**, qui lisent tous deux le français et l'arabe), sur **nos** serveurs, dans la file de travaux | `14` § 2.3 : aucune image ne sort de Tunisie | Le seuil du § 10 non atteint : on garde le TEIF et le tableur, et on n'annonce pas la lecture de photo |
| **API publique** : documentation générée depuis les schémas Zod ; avis d'événement **signés**, renvoyés par la file de travaux ; limites d'appels par clé | `14` § 2.5 | — |
| **Paiement en ligne** : l'API de Konnect (créer un paiement, puis **relire** son état chez Konnect) | `14` § 2.2 ; déjà fait pour nos abonnements dans la v10 (10.9.0) | **À VÉRIFIER** : un compte marchand par entreprise |

---

## 4. L'application (web installable)

| Choix | Pourquoi | Ce qui le remettrait en cause |
|---|---|---|
| **React** | La bibliothèque d'interface la plus répandue ; validé le 27/09 (« une vraie bibliothèque d'interface ») | — |
| **shadcn, Tailwind et Base UI** pour les composants (boutons, champs, fenêtres, dates) — **les outils de Slate** (revu le 28/09/2026, `15` § 4 ; Mantine était proposé avant) | On garde les écrans déjà écrits dans Slate au lieu de les refaire ; Tailwind écrit « début » et « fin », pas « gauche » et « droite » | — (la réserve sur l'arabe est levée : arabe abandonné le 28/09/2026, `14` § 5) |
| **Konva** pour dessiner le plan de salle (vague 1) | Déjà utilisé par l'éditeur de plan de Slate (`15` § 2) | — |
| **TanStack Table et Virtual** pour les listes et la **grille de saisie** | Sans habillage imposé : on garde nos règles d'interface (un seul bouton principal, rien ne pousse sous le curseur) ; tient des dizaines de milliers de lignes (saturation 10.14.0) | — |
| **Textes traduisibles dès le premier écran** (catalogue de messages), propriétés CSS « de début et de fin » ; une **langue factice** (40 % plus longue) photographiée à chaque version ; des **polices libres** (famille Noto) dans les PDF, qui impriment aussi un nom saisi en arabe | Pour l'anglais en vague 4 ; l'arabe est abandonné (Skander, 28/09/2026, `14` § 5) | — |
| **Écrans pensés pour le téléphone** : la mise en page suit la largeur ; l'instrument de rendu photographie chaque écran à la largeur d'un téléphone (390 points) et d'un ordinateur (1 440) ; des cibles d'au moins 44 points pour un doigt | `14` § 2.6 | — |
| **Application installable** (service worker) | `00` : la même application dans le navigateur, installée, ou dans la coque | — |
| **Copie locale** : **SQLite dans le navigateur** (version WebAssembly, stockée dans le système de fichiers privé du navigateur) | Une vraie base sur le poste, chiffrable, rapide (budget de 100 ms à la frappe, vision § 6) | **Mesuré au prototype le 28/09/2026** (`04` § 9.4) : 13,4 Mo pour une PME, 7,9 ms au pire pour un ticket, la copie survit à la fermeture. Reste le stockage persistant, refusé par Chromium à une page non installée (`04` § 4) |
| **Synchronisation** : écriture par **notre file d'opérations** ; lecture par **notre propre chemin** (« tout ce qui a changé depuis N », réponses compressées, et un canal qui prévient le poste) | `04` § 9.1 et 9.2 : une seule porte pour les droits ; **confirmé par le prototype** le 28/09/2026 (`04` § 9.4) | PowerSync, qui tient aussi les seuils, reste le plan B si notre chemin coûte trop à écrire |
| **Visites guidées** : le moteur de la v10 (`visite.js`), porté | Il a fait ses preuves ; chaque geste expliqué (`02` M6) | — |

---

## 5. La coque de bureau et l'agent local

| Choix | Pourquoi | Ce qui le remettrait en cause |
|---|---|---|
| **Electron** pour la coque | On le connaît (toute la v10) ; l'agent local tourne dans le même programme ; les mises à jour savent déjà se faire | Une coque plus légère (Tauri) ne vaut pas de réapprendre un autre langage pour une seule personne |
| **Agent local** : clé USB de signature par l'interface standard des jetons cryptographiques (PKCS#11), imprimante de tickets en ESC/POS, en vague 1, les **imprimantes de cuisine** (plusieurs, sur le réseau du restaurant ou en USB), tiroir par l'imprimante, douchette comme un clavier ; en vague 3, la balance | Les protocoles du matériel vendu en Tunisie (note de recherche `hebergement_technique.md`) ; le restaurant (`14` § 3.1) | **À VÉRIFIER** : les pilotes des clés USB TunTrust sur Windows et Mac |
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
| **Site** : les pages d'aide comparées aux articles de l'application, la page Tarifs comparée à la grille de la console (`11` § 4 et § 6) | Un test dans le dépôt du site | À chaque publication du site |
| **Test humain** : refaire à la souris et regarder l'écran (décision du 24/09) | Les outils de `scripts/humain/`, adaptés au navigateur | Avant d'annoncer quoi que ce soit |
| **Téléphone et langue factice** : chaque écran photographié à deux largeurs et dans la langue factice ; aucune phrase écrite en dur dans un écran (`14` § 2.6 et § 5) | L'instrument de rendu, porté | À chaque envoi |

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
- **Pas d'intelligence artificielle qui écrit dans le produit au lancement** (un assistant). Elle ne
  viendra qu'hébergée en Tunisie, ou avec l'autorisation de l'INPDP (`05` § 4.3). La **lecture de
  documents**, elle, est au lancement, **sur nos serveurs** (§ 3, `14` § 2.3) : c'est ainsi que la
  lecture de photo de la v10 revient sans qu'une image sorte de Tunisie.

---

## 10. À VÉRIFIER

1. **Le prototype** du `04` § 9.3 : **fait le 28/09/2026** (`04` § 9.4). Reste le stockage persistant sur Safari, Firefox et les téléphones.
2. **La signature XAdES** acceptée par la TTN, avec la bibliothèque choisie.
3. **Les pilotes des clés USB** TunTrust (Windows, Mac) pour l'agent local.
4. **La licence de MinIO** pour notre usage.
5. ~~La recherche en arabe avec PostgreSQL.~~ Sans objet : arabe abandonné (28/09/2026).
6. **Le fournisseur d'e-mails et de SMS** en Tunisie (`03` § 6).
7. **Le moteur de lecture de documents** : PaddleOCR ou Tesseract, choisi sur un lot de vraies
   factures tunisiennes prêtées **avec l'accord** de leurs propriétaires ; retenu s'il lit juste le
   matricule, la date et le total sur **au moins 9 factures sur 10** (`14` § 2.3). *30/09/2026 (brique
   84) : Tesseract 5 (français) et Poppler sont branchés pour construire la lecture, et le banc qui
   mesure le seuil est prêt (`npm run banc:lecture`, le lot hors du dépôt) : 6 sur 6 sur nos pièces
   d'essai inventées ; la mesure sur le vrai lot, et PaddleOCR sur ce même lot, restent à faire.*
8. **Un nom saisi en arabe** s'imprime-t-il juste dans les PDF de Chromium (police Noto) ?
9. **L'API de Konnect** pour le compte marchand de chaque entreprise (`14` § 2.2).

## 11. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | Un dépôt neuf et public, `skanfact-plateforme`, créé à J0 ; le dépôt actuel reste celui de la v10 |
| 28/09/2026 (proposé) | TypeScript et Node.js ; argent en `bigint`, dates avec `Temporal` ; le moteur sans dépendance |
| 28/09/2026 (proposé) | Fastify, Zod, PostgreSQL, Kysely et SQL écrit à la main, pg-boss ; PDF par Chromium ; signature et envoi TTN écrits par nous |
| 28/09/2026 (proposé) | React, Mantine, TanStack Table ; textes traduisibles dès le départ ; copie locale et synchronisation tranchées par le prototype |
| 28/09/2026 (`15`) | shadcn, Tailwind et Base UI à la place de Mantine, pour reprendre les écrans de Slate, sous réserve de l'arabe au prototype ; Konva pour le plan de salle |
| 28/09/2026 (proposé) | Electron pour la coque et l'agent local ; application signée |
| 28/09/2026 | Kysely branché (étape 1) : les types de la base sont écrits par **notre propre script**, lu dans une base où toutes les migrations sont passées (un entier de 64 bits se lit en `bigint`, une date de pièce reste un jour écrit, un type inconnu arrête la génération au lieu de devenir « inconnu ») ; un test tombe si le fichier ne suit plus les migrations. Les requêtes Kysely ne servent que **dans la transaction qui porte le nom de la personne**. Les modules écrivent leurs requêtes avec Kysely ; les appels aux fonctions du socle et les états lourds restent en SQL écrit à la main. Un entier de 64 bits sort de l'API en texte |
| 28/09/2026 (proposé) | Serveurs dédiés, Docker Compose, Ansible, pgBackRest, réplication PostgreSQL avec bascule par script, MinIO, SOPS, Prometheus et Grafana ; tout chez nous, en Tunisie |
| 28/09/2026 (proposé) | Quatre environnements, jamais de donnée réelle hors production ; tous les tests de la v10 portés ; intégration continue sur GitHub Actions, jamais contournée |
| 28/09/2026 (**Skander**) | Arabe abandonné : shadcn, Tailwind et Base UI confirmés sans réserve ; la langue factice n'est plus que 40 % plus longue (`14` § 5) |
| 28/09/2026 (**Skander**, précisé) | **Le code de l'interface v10 est repris lui-même** (entreprise et Cabinet, branche `beta`), copié tel quel par un outil de reprise ; un point de contact neuf le branche sur le serveur (données chargées, changements envoyés et vérifiés, gestes officiels par le serveur) ; React et Tailwind servent aux écrans NOUVEAUX (connexion, modules des vagues, Slate) |
| 28/09/2026 (**Skander**) | **L'interface de la v10 est gardée** : sa feuille de style reprise telle quelle et chaque écran repris du sien (vision § 4.8) ; React, Tailwind et Base UI restent les outils, les couleurs de Tailwind branchées sur celles de la v10 ; les écrans de Slate prendront cette identité |
| 28/09/2026 (prototype) | Copie locale : SQLite WebAssembly dans l'espace privé du navigateur (OPFS), tenu par un worker ; lecture par notre propre chemin ; PowerSync en plan B (`04` § 9.4) |
| 28/09/2026 (par délégation, `14`) | Lecture de documents par un moteur libre sur nos serveurs ; API publique documentée depuis le code, avis signés ; langue factice et largeur de téléphone photographiées à chaque version ; imprimantes de cuisine dans l'agent local |
