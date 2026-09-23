# Ce qui reste à faire

*Le carnet des choses repérées et pas encore traitées, sur les TROIS surfaces du produit :
les deux applications (`skanfact`), le site (`skanfact-site`) et la plateforme (console + relais).
Il ne remplace pas `VERSIONS-A-VENIR.md`, qui inventorie les VERSIONS à écrire : ici vivent les
constats isolés, les dettes et les décisions en attente. Une ligne en sort quand elle est faite, ou
quand elle devient une version.*

Dernière relecture : 23/09/2026.

---

## 1. Ce qui bloque une vente

Rien ici ne demande d'écrire du code. Tant que ces lignes tiennent, on ne peut pas encaisser.

| Quoi | Où | Qui tranche |
|---|---|---|
| **Quatre clauses `À COMPLÉTER`** : délai d'envoi de la clé, rétractation et remboursement, périmètre de l'assistance, juridiction | `conditions-vente.html` | Skander |
| **RNE, capital social**, et un numéro de téléphone — ou la décision de ne pas en publier | `conditions-vente.html`, mentions légales | Skander |
| **Vérification d'identité Konnect**, puis `KONNECT_API_KEY` en Secret Cloudflare, `konnect_wallet` et `achat_retour` dans Console → Réglages | plateforme | Skander |
| **TVA 19 % et timbre 1 DT** sur une facture de licence — « À VÉRIFIER » depuis la 10.9.0 | réglages de la console | le comptable |
| **Une convention « cabinet fondateur »** : « gratuit à vie » sans aucun écrit inquiète un expert-comptable au lieu de le rassurer, et les conditions de vente ne parlent pas du Cabinet | à écrire | Skander |
| **La signature des exécutables** (Windows et Mac) : la première chose qu'un expert-comptable refuse, c'est « Exécuter quand même » sur le poste qui porte cinquante-cinq comptabilités | certificats | Skander |
| **Prix du Cabinet** (par dossier au-delà de trois) et de l'option Comptabilité : `prix_cabinet_dossier` vaut 0, donc le Cabinet ne se vend pas en ligne | `TARIFS-REFERENCE.md` | Skander, après l'avis de l'Ordre |

## 1 bis. Deux décisions de produit ouvertes par l'audit « trois regards » (23/09/2026)

Le site dit maintenant la vérité sur les deux ; reste à décider si la vérité doit changer.

- **Envoyer le nom de l'ordinateur au serveur, ou non.** Le signal de présence (8.4.0) envoie le
  nom du poste tel que le système l'affiche, souvent « MacBook de Prénom » : une donnée
  personnelle. Il sert à reconnaître un poste dans la console ; l'identifiant tiré au hasard suffit
  à compter. Le retirer rendrait la politique de confidentialité plus courte et plus facile à
  défendre. Si c'est décidé : `annoncerPlateforme` dans les deux `main.js`, la colonne
  `device_nom` de la console, et les pages du site listées dans le `CLAUDE.md` du site.
- **Faire partir la licence du paiement, ou de la fin de l'essai.** Aujourd'hui les douze mois
  partent de l'émission : acheter au dixième jour d'essai en fait perdre vingt. Le site le dit et
  conseille d'acheter en fin d'essai. Changer la règle serait un argument de vente (« achetez quand
  vous voulez, vous ne perdez rien »), mais la plateforme ne connaît pas la date de fin d'essai d'un
  poste : c'est une version, pas une ligne.
- **Un email facultatif à l'essai** (« prévenez-moi avant la fin ») : demandé par la lecture
  commerciale, pas fait, parce qu'il suppose une route qui garde l'adresse et l'engagement
  d'envoyer les messages. Et le champ « Comment nous avez-vous connus ? » ne part que par email :
  une commande payée par carte passe par la plateforme, dont la liste de champs est fixée par un
  test.

## 1 ter. Ce que le rapport QA du Cabinet (23/09/2026) laisse à décider

- **L'export « toutes les écritures de tous les clients »** ne lit que les paquets reçus : un client
  hors SkanFact, tenu à la main depuis la 10.10.0, n'y entre pas (la page le dit, et son
  livre-journal s'exporte depuis sa fiche). Faut-il qu'il y entre ? C'est une question de métier —
  à quoi sert ce fichier chez le pilote — pas de code.
- **La liasse n'a toujours pas été confrontée à une liasse réelle.** Elle tombe juste sur l'exemple ;
  le modèle de rubriques reste « À VÉRIFIER » tant que le pilote ne l'a pas comparée à la sienne.

## 2. Le site

Mesuré par la session qui l'a écrit, le 22/09/2026. Aucun de ces points n'est faux — ils sont
lourds, ce qui n'est pas la même chose.

- **Les pages sont trop longues.** En écrans de téléphone : accueil **16,8**, cabinet **15,0**,
  excel **12,1**, tunisie **10,2**. Sur l'accueil précisément, **trois sections font le même
  travail** (orienter entreprise / cabinet) — « Vous n'êtes pas venu pour la même chose »,
  « Quatre pages, quatre questions », « Un logiciel de tenue, pas un lecteur de fichiers ». Et un
  paragraphe entier y explique le **test de parité des balances** : du processus d'ingénierie sur
  une page qui doit vendre.
- **Les deux images du héros de l'accueil sont écrasées à 400 px** — texte à 4 px, illisible, du
  bruit gris. Les grandes captures, elles, sont bonnes.
- **Les cartes de la section entreprise** portent des captures recadrées au milieu d'une rangée de
  tableau, coupées en haut ; et leurs liens sont des **flèches « → » nues** qui ne disent pas où
  elles mènent (règle 7.29.0 : un libellé décrit l'écran d'arrivée).
- **GoatCounter n'est pas branché** : `var MESURE = ''` dans `assets/site.js`. Tant qu'il est vide,
  on ne sait rien de ce que les visiteurs regardent.
- **Ce que l'audit commercial du 23/09/2026 a demandé et que seul Skander peut fournir** (le reste
  est corrigé, voir le README du site, « L'audit commercial ») :
  - des **témoignages et des chiffres réels** — noms, entreprises, nombre d'installations. On n'en
    invente pas ; la page Nouveautés reste la seule preuve honnête tant qu'il n'y en a pas.
  - la **signature des exécutables** (certificats Apple et Windows, payants) : la page
    Téléchargement explique l'alerte, elle ne la supprime pas.
  - un **lien de parrainage par cabinet** (`skanfact.tn/…?cabinet=<empreinte>`) qui préremplit la
    remise et rend le canal mesurable — aujourd'hui le client tape le nom de son cabinet, et la
    console rattache à la main. Une version du site et du worker, à décider.
  - un **numéro de téléphone** publié, ou la décision de rester sur « rendez-vous par email ».
- **Une branche distante orpheline** : `claude/bancs-de-captures` sur le dépôt du site.

## 3. La console

Constats de l'audit du 22/09/2026 restés hors de la 10.6.0.

- La vue **Cabinets n'a pas de colonne Actions** : on voit les cabinets, on ne peut rien en faire.
- Le **Parc déborde à 1440 px** (la sonde de largeur de la 10.5.0 le mesure).
- Le bouton **« ⋯ »** : Skander avait demandé en 7.29.0 qu'un menu de ligne porte un mot, pas un
  pictogramme. Fait dans les deux applications, pas dans la console.
- Les champs des **Réglages** ont des bords gauches irréguliers d'une ligne à l'autre.
- La table des **ventes n'affiche pas la date de vente** — c'est pourtant la colonne qu'on trie.

## 4. Les applications

- **6.9.0 — B10** : la page Écritures démontrable pendant le jeu d'exemple du Cabinet.
- **L'audit UI/UX du Cabinet est fait** (23/09/2026) : ses constats sont au § 4 bis, proposés et
  pas encore corrigés.
- Les trois pistes jamais demandées, gardées pour mémoire : séparer les installateurs arm64 / x64
  (les 222 Mo du dmg universel), la signature Apple et Windows (certificats payants — mais elle
  passe **avant la première vente**, cf. `QUESTIONS.md` : un expert-comptable ne clique pas sur
  « Exécuter quand même »), et l'export TEIF si l'e-facture devient obligatoire.

## 4 bis. L'audit UI/UX du Cabinet (23/09/2026) — proposé, pas encore corrigé

Parcouru en designer senior avec les outils « comme un humain » (xdotool, captures d'écran, Playwright
branché sur l'application), sur la 10.11.0 et le jeu d'exemple, à 1440×900 puis à 1280×800, en
clair et en sombre. Captures : `/tmp/skanfact-humain/audit/` (effacées avec la session). Trois lignes
(U-03, U-15, U-23) ont été vérifiées dans le code avant d'être écrites ici.

| Id | Gravité | Écran | Constat | Correction proposée |
|---|---|---|---|---|
| U-01 | critique | Saisie | La grille commence à 764 px sur un écran de 800 (1280×800) : **une seule ligne** visible. En tout, 480 px d'en-tête, de période, de bandeaux et d'onglets passent devant | En-tête de dossier compact et collant (nom, période, état : une ligne) ; les deux bandeaux fondus en une ligne ; l'aide des touches repliable ; objectif : 8 lignes visibles à 1280×800 |
| U-02 | critique | Livre-journal, Dossiers, Production | La colonne collante (Actions, À saisir) **recouvre des données** : Débit et Crédit coupés dans le journal, « Signalés » caché dans Dossiers, juillet et août cachés dans Production | La colonne collante réserve sa largeur ; en-têtes de mois compacts ; une sonde « aucune cellule de données sous une colonne collante » dans `e2e:cabinet-rendu` |
| U-03 | critique | Liasse → Déclaration annuelle d'employeur | « Charges sociales patronales — aucun mouvement sur 65 » pendant que la paie écrit 627 890 DT au **645** (`compta.js` : la déclaration lit `masse('65')`, le rôle `chargesPatronales` vaut `'645'`). La rubrique RE6 lit aussi le 65 | Lire le compte du rôle, jamais un préfixe écrit à part ; faire confirmer RE5 et RE6 par le comptable (À VÉRIFIER) |
| U-04 | majeur | Dossiers | La carte « 18 647,900 DT de CA suivi — somme des derniers mois reçus » additionne le mois de mars d'un client et le mois d'août d'un autre : le chiffre ne veut rien dire | Nommer la période : « CA d'août 2026 : … sur 3 clients », ou le cumul 2026 |
| U-05 | majeur | Comptabilité (tous les sous-onglets) | « Il manque 6 mois sur cette période : ces livres sont incomplets » pendant que Suivi dit que janvier à juin sont hors mission ; l'alerte reste une fois le livre créé | Même fonction que Suivi : ne compter que les mois de la mission |
| U-06 | majeur | Comptabilité | 13 sous-onglets sur deux rangées (« Liasse » et « Recherche » seuls sur la seconde) | Trois groupes : Saisir / Consulter / Déclarer et clôturer, avec un second niveau ; l'adresse garde l'onglet |
| U-07 | majeur | Cmd+K | « balance » rend « Rien ne correspond. » ; « tva » ne propose que trois panneaux de Réglages (étiquetés « Action ») | Indexer les 13 vues du dossier ouvert, et les couples « client + vue » (« béji balance ») |
| U-08 | majeur | Aide | 10 articles : aucun ne couvre Banque, Déclaration, Immobilisations, Paie, Révision, Exercice ou Liasse. « rapprochement » ne trouve rien | Un article par onglet, qui finit par son geste ; la bulle du titre de chaque onglet y mène |
| U-09 | majeur | Saisie | Une pièce commencée vit en mémoire (`saisieState.piece`) : elle survit à la navigation mais disparaît à la fermeture de l'application, sans question — le Cabinet n'a aucun garde-fou de fermeture | Un point « non enregistrée » sur l'onglet Saisie, et le garde-fou de fermeture de l'app entreprise (2.4.0) |
| U-10 | majeur | Démo | Banque, Immobilisations, Inventaire, Paie et Révision sont vides dans l'exemple : ce qui impressionne un comptable ne se montre pas | Un relevé (dont une ambiguïté), deux biens, deux salariés avec leurs bulletins, une révision entamée |
| U-11 | moyen | Révision, Relances, Déclaration, assistant | Le bouton principal n'est pas le geste suivant : « Arrêter la révision » à 0 compte signé sur 19 ; quatre boutons verts sur Relances ; « Préparer la déclaration » deux fois | Un seul bouton principal par écran, et c'est l'étape suivante |
| U-12 | moyen | Paie | S'ouvre sur décembre 2026 et le 4e trimestre, deux périodes futures ; la Déclaration s'ouvre sur août | Même règle partout : le dernier mois qui a des données, sinon le mois courant |
| U-13 | moyen | Déclaration, Réglages, Révision, Relances | Bandeaux empilés : quatre avant le premier chiffre de la Déclaration, la clé de secours dite trois fois sur Données et sécurité, de l'orange sur des états normaux (« 19 comptes ne sont pas signés » au départ d'une révision) | Une seule ligne d'état par écran ; l'orange seulement quand il y a un geste à faire |
| U-14 | moyen | Déclaration | La raison d'une case « — » (TFP, FOPROLOS, TCL) et la note de l'IRPP (« Non compris dans le total à dé… ») sont coupées par une ellipse | La raison passe à la ligne, sous le libellé de la case |
| U-15 | moyen | Exercice → À-nouveaux | La colonne « Intitulé » est vide sauf pour le 13 : elle lit le libellé de la ligne, pas le nom du compte (`app.js`, règle 9.8.7) | `nomDeCompte`, comme le grand livre |
| U-16 | moyen | Liasse | 17 rubriques vides sur 26, chacune avec sa phrase grise, noient les 9 qui portent un montant ; une colonne de « Voir les comptes » | « Masquer les rubriques vides (17) », coché par défaut ; le montant devient le lien |
| U-17 | moyen | Production | « reçu, rien de saisi » et « à saisir » ne se distinguent pas pour un comptable ; carrés de 16 px ; « saisi » et « révisé » ne diffèrent que par la couleur ; « hors mission » ressemble à « reçu » | Quatre états, quatre formes, le texte au survol |
| U-18 | moyen | Assistant, Réglages | Les textes d'exemple dans les champs (« +216 … », « SKAN1…. ») sont en gras foncé : on les prend pour des valeurs déjà saisies | Texte d'exemple gris et en graisse normale, dans la feuille partagée |
| U-19 | moyen | Exercice, Liasse, Réglages → Comptabilité | 3 192 px, 3 657 px et 4 193 px ; le modèle de liasse est une grille éditable de 26 × 6 champs aux libellés coupés | Sections repliables avec sommaire ; le modèle en lecture, modifiable dans une fenêtre |
| U-20 | moyen | Immobilisations | Un panneau permanent de quatre paragraphes de réserves (« Ce que cet écran ne décide pas ») | Dans la bulle du titre (règle 9.4.9) |
| U-21 | moyen | Échéances | « Un pense-bête : SkanFact ne dépose rien à ta place » répété sous chaque carte ; la CNSS dit « SkanFact ne sait pas lesquels » alors que la Paie (10.3.0) connaît les salariés des dossiers tenus | Une fois en tête de page ; filtrer la CNSS sur les salariés connus |
| U-22 | mineur | Fiche → Suivi | « Le bouton « Relancer », en haut » s'affiche sur un client à jour, où ce bouton n'existe pas | La phrase suit la condition du bouton |
| U-23 | mineur | Immobilisations, Inventaire, Paie | Les boutons éteints disent pourquoi, mais seulement au survol (`title`) | La raison en gris, visible à côté, comme dans la Saisie |
| U-24 | mineur | Paie | « Les salariés — c'est par là qu'une paie commence » sans bouton ; la masse salariale est un tableau de zéros | Le bouton dans le panneau ; un état vide au lieu des zéros |
| U-25 | mineur | Dossiers, fiche | Seules deux cartes sur quatre sont cliquables (chevrons) ; « 2 à jour sur 5 » ; deux bulles « i » côte à côte sur « Paquets reçus » ; le chiffre d'affaires de la liste (le mois) et celui de la fiche (l'année) sans période nommée | Toutes les cartes ouvrent quelque chose ; nommer la période du CA partout |
| U-26 | mineur | Saisie | Les colonnes se décalent quand l'intitulé apparaît pendant la frappe | Largeurs fixes (`colgroup`) |
| U-27 | mineur | Création du livre | « Créer le livre… » agit sans fenêtre malgré ses points de suspension ; le compte rendu ne propose pas la suite | « Ouvrir la saisie » / « Voir le livre-journal » dans le compte rendu |
| U-28 | mineur | Exercice | « 2 mois sans déclaration préparée (2026-07, 2026-08) » : format machine dans une phrase | `fmtJour` / nom du mois |
| U-29 | mineur | Production | L'étiquette « exemple » tronquée donne « Garage Ben Salem … », comme un nom coupé | L'étiquette hors de la cellule tronquée |
| U-30 | mineur | Aide | La loupe est sous la ligne du texte ; « Essaie un seul mot » après un seul mot tapé | Aligner l'icône ; la phrase suit le nombre de mots |

## 5. Les dettes d'outillage

- **`skanfact.tn` est injoignable depuis une session Claude** (le proxy le bloque, `api.skanfact.tn`
  aussi). On vérifie donc la branche publiée et le run de déploiement, jamais la page telle qu'un
  visiteur la reçoit. Toute affirmation sur « ce que le site affiche » doit le dire.
- **Les tarifs du site ne sont pas confrontés à ceux du worker par un test.** `essai-achat.mjs`
  travaille contre un faux serveur ; le jour où les deux divergent, rien ne le dira.
- **Aucun test ne confronte `TARIFS-REFERENCE.md` aux prix réellement réglés** dans la console.
