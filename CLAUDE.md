# SkanFact — consignes pour Claude

*Réécrit le 27/09/2026, au passage à la nouvelle vision. L'ancien fichier (≈ 8 800 lignes, toute
l'histoire des versions 1.0 → 10.15) vit dans `docs/application-actuelle/CLAUDE-HISTORIQUE.md` : on
y cherche le **pourquoi** d'une règle, on ne le relit pas à chaque session.*

## Qui, quoi, comment

- **Propriétaire** : Skander Ben Amor (saouthq). **Français, tutoiement.** Débutant en Git, en
  terminal, en gestion et en comptabilité : il ne tape pas de commandes, Claude fait le travail en
  autonomie (code, tests, commits, publications) et explique simplement, sans jargon.
- Son père l'accompagne (chef d'entreprise) et lancera les démarches administratives.
- **Le produit** : SkanFact, gestion commerciale, caisse, paie et comptabilité pour les entreprises
  tunisiennes, avec leur cabinet comptable dans les mêmes données.
- Ce qui est incertain (fiscal, légal, social) s'écrit **« À VÉRIFIER »**, jamais comme un fait.

## Où on en est (28/09/2026)

1. **Phase de cadrage.** Aucun développement neuf tant que le cadrage n'est pas validé par Skander,
   document par document. Plan, état de chaque document et journal des décisions :
   `docs/cadrage/README.md` (c'est là qu'on regarde où on en est).
2. **Nouvelle plateforme à construire** (27 mois au plan, 30 avec la marge, pas de lancement public
   avant qu'elle soit complète : `docs/cadrage/09-feuille-de-route.md`) : `VISION-ARCHITECTURE.md`
   fait foi. Tout ce qu'elle fait, au lancement et dans les vagues qui suivent :
   `docs/cadrage/14-fonctions-et-integrations.md`.
3. **L'application actuelle** (SkanFact et SkanFact Cabinet, Electron, v10.x) passe en
   **entretien** : corrections, lois de finances, et les trois comptables pilotes (tests reportés
   de deux mois, annoncé le 27/09/2026). Pas de nouvelles fonctions sans demande explicite.
   Dernière stable publiée : **10.14.0** ; `package.json` porte **10.15.0-beta.1**, non publiée.

## Décisions prises pour la nouvelle plateforme (27/09/2026)

Détail et raisons dans `VISION-ARCHITECTURE.md` ; ne pas les rediscuter sans que Skander le demande.

- **Un serveur qui fait foi** ; une application **web installable** qui marche pendant les coupures
  (liste exacte de ce qui marche hors ligne : § 4.5) ; l'application de bureau est **la même** dans une
  coque, avec un agent local (clé USB de signature, imprimante, tiroir, douchette). Les écrans du
  quotidien marchent sur téléphone dès le lancement ; l'application des magasins vient plus tard
  (`docs/cadrage/14-fonctions-et-integrations.md` § 2.6).
- **Des modules sur un socle commun**, comme Odoo, mais avec des **points d'extension déclarés**
  (jamais un module qui réécrit l'intérieur d'un autre) et des champs personnalisés en données.
- **PostgreSQL**, tables partagées + identifiant d'entreprise + **sécurité par ligne (RLS)**,
  « cellules » pour grandir, grandes tables **partitionnées**, export/restauration d'UNE entreprise.
- **L'argent en entiers** (millimes, centimes selon la devise). Jamais de nombre à virgule en base.
- **Journal inaltérable** (chaîne d'empreintes) sur les écritures, factures et tickets.
- **Un seul programme serveur rangé en modules** + file de travaux ; **l'API d'abord** (nos écrans
  l'utilisent, les intégrations viendront plus tard).
- **TypeScript** et **une vraie bibliothèque d'interface** (validés le 27/09/2026). On **garde et on
  porte le moteur** `core.js` / `compta.js` et ses tests ; les écrans seront refaits.
- **Prix par entreprise**, pas par utilisateur, modules payants, facture électronique incluse.
  Grille décidée le 28/09/2026 par délégation : `docs/cadrage/07-offres-et-prix.md`.
- **Signature** : DigiGo intégré (chemin principal), clé USB via l'agent local, signature serveur
  après homologation ANCE. Envoi TTN par le serveur, archivage 10 ans.
- **Hébergement en Tunisie**, copie de secours comprise (un second centre de données tunisien).
- **Budget** accepté (~1 000 DT/mois au lancement, 10 à 20 kDT de frais uniques, à affiner).
- **Démarches** (père de Skander), **dès maintenant** : accès test El Fatoora, adhésion DigiGo, et
  inscription fournisseur sur la plateforme d'homologation des caisses (décidé le 28/09/2026) ;
  INPDP avant la première donnée réelle d'un client ; le label Startup dès que la société qui porte
  SkanFact est choisie ; homologations ANCE et caisse en fin de développement. Détail et questions
  par interlocuteur : `docs/cadrage/05-obligations-legales.md`.
- **Tout ce que Hesabi a, au lancement, et plus** (demande de Skander, 28/09/2026) : espace client et
  paiement en ligne, lecture de documents sur nos serveurs, cabinet complet, API, téléphone ;
  restauration et commerces au lancement ; trois vagues après, puis l'**hôtellerie à la fin** ;
  **l'arabe plus tard, l'infrastructure maintenant** (catalogue de textes, langue factice testée).
  Détail : `docs/cadrage/14-fonctions-et-integrations.md`.
- **Slate** (dépôt privé `saouthq/Slate`, l'application pour restaurateurs de Skander) **devient la
  partie restaurant de SkanFact** (décision de Skander, 28/09/2026) : on reprend ses écrans et ses
  tests dans la plateforme, en Tunisie, avec l'argent en entiers ; il prend l'identité de SkanFact.
  Détail : `docs/cadrage/15-reprise-de-slate.md`.
- Les règles « JS pur, pas de React » et « stockage JSON, pas SQLite » de l'ancien fichier ne valent
  plus que pour l'application actuelle.

## Carte du dépôt

| Où | Quoi |
|---|---|
| `VISION-ARCHITECTURE.md` | **La référence** : vision, leçons d'Odoo, architecture, signature, budgets de performance, risques, décisions |
| `docs/cadrage/` | Le travail du cadrage (modèle de données, droits, synchro…), un document par sujet |
| `docs/etudes/` | `ETUDE-MARCHE.md` (concurrents, marché, loi 2026, questionnaire d'entretien), `ETUDE-HESABI.md`, notes de recherche |
| `docs/application-actuelle/` | Ce qui sert encore à l'app v10 : `A-FAIRE.md` (carnet), `TARIFS-REFERENCE.md` (contrat avec le site), `TESTS-TERRAIN.md`, `e-facture-controle.md`, `CLAUDE-HISTORIQUE.md` |
| `docs/archives/ancienne-vision/` | Plans de l'ancienne vision (cahier des charges, direction, plans, questions, versions à venir) — lecture seule |
| `src/` | L'application actuelle : `src/main.js` + `src/renderer/` (entreprise), `src/cabinet/` (Cabinet). Moteur : `src/renderer/core.js`, `src/renderer/compta.js` |
| `plateforme/` | Worker Cloudflare de la console éditeur actuelle (licences, ventes, paiement Konnect). La console cible est décrite dans `VISION-ARCHITECTURE.md` § 12 |
| `worker/` | Relais de mise à jour |
| `test/` | `npm test` (`test/run-tests.js` + `test/suites/`), parcours `test/e2e/`, charges |
| `scripts/` | Publication, icônes, exemple du Cabinet, outils de test humain (`scripts/humain/`) |
| `CHANGELOG.md` | Notes de version (lues par la publication : ne pas déplacer) |

**Le site** `skanfact.tn` vit dans le dépôt `saouthq/skanfact-site` (`/home/user/skanfact-site`), et c'est **cette même session** qui l'écrit (décidé le 27/09/2026). `TARIFS-REFERENCE.md` (désormais dans `docs/application-actuelle/`) reste le contrat entre l'application actuelle et le site.

## Règles de travail (permanentes)

**Méthode**
- **Tester comme un humain avant d'annoncer quoi que ce soit** (décision du 24/09/2026) :
  `scripts/humain/lancer.sh entreprise|cabinet`, `scripts/humain/ecran.sh capture` (et LIRE l'image),
  `clic`, `taper`, `touche`, `defiler`. Rien ne s'annonce « réglé » avant d'avoir été refait à la
  souris et vu à l'écran. Un test vert ne suffit pas.
- **Agents et workflows en `sonnet`** (quota). Ce qu'un agent trouve se **revérifie soi-même**.
  Quand Skander dit « vérifie toi-même », pas d'agent.
- **Prix et plans commerciaux** : on en parle d'abord ; on ne modifie un plan qu'après accord.
- **Chaque décision de cadrage s'écrit** (dans `VISION-ARCHITECTURE.md` § 9 ou `docs/cadrage/`),
  avec sa date.
- Quota hebdomadaire limité : regrouper, ne pas relancer des parcours longs pour rien.

**Sécurité (sans exception)**
- Jamais de **token** ni de secret dans le dépôt (le jeton GitHub vit dans `userData/update-config.json`).
- `build/licences-publiques.json` : ne **jamais** supprimer, régénérer ni remplacer les clés
  publiques `master`, `srv-1`, `reponse`. Une clé retirée se marque `retiree: true`. Les clés privées
  vivent dans `~/.skanfact/` (Mac de Skander) ou dans les secrets Cloudflare, jamais ici. Jamais
  embarquer une clé publique dont la privée a été **vue**.
- Jamais réintroduire « SKANCYBER » ni le matricule 1998268D dans le code, les valeurs par défaut,
  les exemples ou les textes (seule exception : `build.appId` = `tn.skancyber.skanfact`).
- Jamais une donnée de plus dans ce qui part vers un serveur sans que la liste soit comptée et
  décidée.
- Les PDF et formulaires officiels reçus ne se commitent pas.
- Le dépôt est **public** (interrupteur unique : `src/depot.js`), et le site aussi. **Décidé le
  27/09/2026 : ils restent publics** (le projet est peu connu, et GitHub Actions reste gratuit) ;
  reconfirmé le 28/09/2026, y compris pour le futur dépôt de la plateforme.

**Git et publication**
- Branche de travail **`beta`** ; `git push -u origin beta` (réessayer 4 fois avec attente en cas
  d'erreur réseau). Pas de PR sans demande. Aucun identifiant de modèle dans ce qui est poussé.
- Messages de commit en français, terminés par les lignes `Co-Authored-By` et `Claude-Session`
  fournies par la session.
- Avant tout commit de code : `npm test` (**lire le code de sortie**, jamais `npm test | tail`) et
  `npm run lint` (**0 erreur, 0 avertissement**). Aucun `.preuve-bak` ne traîne.
- Publier l'application actuelle : voir « Application actuelle » ci-dessous.

## Les leçons qui valent pour la nouvelle plateforme

*Chacune a coûté un défaut réel ; le récit est dans `CLAUDE-HISTORIQUE.md` (chercher la version).*

**L'argent et la comptabilité**
- Une date est un **jour de calendrier**, jamais un instant ; toute arithmétique de date en UTC (5.2.3).
- Aucun **taux** écrit en dur : les taux viennent de réglages ; la valeur par défaut d'une règle
  inconnue est celle qui **ne fait rien** (0 ou « — », jamais un chiffre inventé) (5.0.0, 9.1.1, 9.6.0).
- Tout ce qui **additionne** plusieurs pièces convertit dans la devise de base (7.0.1, 10.1.0).
- Une pièce émise garde une **copie** de ce qui a servi à la calculer (timbre, taux, bulletin) (7.1.x).
- Une écriture **validée** ne se modifie jamais : elle se contre-passe ; un **numéro** naît à la
  validation et le contrôle passe **avant** l'attribution (6.0.0, 9.2.0).
- Un **fait fiscal naît à son fait générateur** (la retenue au règlement) et se **régularise à la
  date de la pièce qui le change**, jamais en réécrivant un mois déclaré (10.14.0).
- Un compteur et la liste qu'il annonce se calculent avec **la même fonction** ; deux écrans qui
  montrent la même chose disent le même chiffre (6.8.1, 10.12.0).
- **Deux chemins, un chiffre** : les invariants qui comparent deux calculs indépendants
  (`test/suites/verite-comptable.js`) sont le filet le plus efficace du projet : on les garde et on
  les porte.

**Les tests**
- Tout test **se prouve en réintroduisant son défaut** ; sur un lot **vert**, sinon on mesure le vide.
- Un test qui lit du code lit du **code** (commentaires retirés). Un test écrit contre l'état du jour
  décrit cet état : on le **retourne vers la règle**.
- Les données d'un test doivent **discriminer** (un montant rond ne prouve rien d'un arrondi).
- Un e2e reconnaît un écran à ce qu'il **contient**, un bouton à ce qu'il **fait**, jamais à son rang
  ou à sa couleur. Un parcours qui choisit « le premier venu » change de cible quand les données grandissent.
- Un instrument qui n'**atteint** pas l'écran annonce « tout va bien » : il exige d'avoir mesuré.
- On **mesure avant** d'écrire un format, avec des seuils écrits d'avance (`npm run charge`).

**L'interface**
- Ce qui apparaît selon une valeur ne **pousse** rien sous le curseur ; un état actif ne change pas
  la géométrie.
- **Un seul bouton principal** par écran : l'étape suivante, calculée.
- Un refus dit **ce qui est refusé, pourquoi, et le bouton qui débloque**, et **montre le champ** ;
  un avertissement se lit **avant** le geste ; ce qui détruit demande, ce qui se répare offre « Annuler ».
- Une phrase affichée que rien ne tient est un **bug** ; une phrase rassurante se vérifie sur un
  univers non vide.
- Toute liste qu'on nomme se **pagine** ; un calcul qui lit tout se fait en **lot** (saturation 10.14.0).
- Chaque champ porte son aide (« i ») ; les visites guidées expliquent chaque geste, avec des **fins
  honnêtes** (une fin qui affirme un fait le prouve).

**Les deux applications (entreprise et cabinet)**
- Une règle apprise d'un côté **se vérifie de l'autre** ; un fichier partagé ne diverge pas.
- Le cabinet **n'écrit jamais** chez un client sans son accord ; une pièce validée n'est jamais
  fusionnée ni perdue ; un travail d'un autre poste n'est jamais écrasé.
- Jamais de **données en otage** : une licence expirée ne bloque que la création.

## Application actuelle (v10, entretien)

**Commandes** : `npm start` (entreprise), `npm run start:cabinet`, `npm test`, `npm run lint`,
`npm run charge`, `npm run charge:entreprise`, `npm run e2e:<nom>` (59 parcours, sous
`xvfb-run -a` sauf `e2e:pages` et `e2e:cabinet-rendu`). Playwright n'est pas une dépendance :
`npm i -D playwright` avant un e2e. Outils humains : `scripts/humain/` (écran virtuel 1440×900,
ports CDP 9222 entreprise, 9223 cabinet).

**Structure** : `src/main.js` (fenêtre, IPC, PDF, mises à jour, chien de garde), `src/storage.js`
(fichier de données, sauvegardes, chiffrement), `src/renderer/core.js` (logique métier, calculs,
gabarits de documents), `src/renderer/compta.js` (moteur comptable pur, partagé avec le Cabinet),
`src/renderer/app.js` (interface), `visite.js`/`visites.js` (visites guidées), `src/cabinet/`
(Cabinet : `cabcore.js`, `cabstore.js`, `main.js`, `renderer/`), `src/zip.js` (paquet `.skanpack`),
`src/licence.js`, `src/depot.js`, `src/canaux.js`. Fichiers partagés par les deux applications :
les deux `index.html` ET les `files` de `build/cabinet.config.js`.

**Publier** (chemin normal par la bêta, décidé le 18/09/2026) :
1. Travailler sur `beta`, numéroter `X.Y.Z-beta.N` (`npm run release preminor`, puis `prerelease`).
   Ce qui touche à l'argent, à une clé, au moteur comptable ou au format d'un fichier passe par la bêta.
2. Entrée datée dans `CHANGELOG.md`, `npm test`, `npm run lint`, commit, push.
3. Lancer le workflow **Release** en `workflow_dispatch` sur la branche (le push de tag est bloqué
   depuis une session). Les deux applications sont construites, chacune sur son canal.
4. Vérifier que le run est **vert ET que les fichiers sont là** (bêta : `beta.yml`, `beta-mac.yml`,
   `cabinet-beta.yml`, `cabinet-beta-mac.yml` ; stable : 16 fichiers). Un job vert ne suffit pas.
5. Stable : `npm run release minor`, `main` avance, puis remettre `main` et `beta` à niveau.

**Contexte fiscal** (À VÉRIFIER avec un comptable) : TVA 0/7/13/19 %, timbre fiscal 1 DT par
facture, retenue à la source (liste de taux jamais fermée : « Autre taux… »), assiette TTC hors
timbre. Depuis la 10.15.0, SkanFact écrit le fichier TEIF d'une pièce émise ; il ne signe et ne
dépose rien.

**Ce qui reste ouvert** sur l'app actuelle : `docs/application-actuelle/A-FAIRE.md` (§ 00 : l'arrêt
du 27/09/2026, H7 en cours, tests restants).
