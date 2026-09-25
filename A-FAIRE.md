# Ce qui reste à faire

*Le carnet des choses repérées et pas encore traitées, sur les TROIS surfaces du produit :
les deux applications (`skanfact`), le site (`skanfact-site`) et la plateforme (console + relais).
Il ne remplace pas `VERSIONS-A-VENIR.md`, qui inventorie les VERSIONS à écrire : ici vivent les
constats isolés, les dettes et les décisions en attente. Une ligne en sort quand elle est faite, ou
quand elle devient une version.*

Dernière relecture : 24/09/2026.

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

## 1 quater. Ce que le rapport QA de l'application entreprise (23/09/2026) laisse à décider

Les douze défauts et les mineurs sont corrigés en 10.12.0 (CHANGELOG, « Une entreprise a tenu
SkanFact »). Restent trois questions qui ne sont pas du code :

- **Un bulletin au net négatif enregistré avant la 10.10.0 est SIGNALÉ, pas corrigé.** « À faire » le
  nomme en rouge et la déclaration CNSS de son trimestre ne se marque plus déposée ; c'est
  l'utilisateur qui corrige les absences ou les retenues. Le recalculer d'office réécrirait un
  bulletin déjà remis à un salarié (règle 5.0.0). Si une CNSS avait DÉJÀ été déposée avec ce
  bulletin, la rectification se fait auprès de la caisse : l'application ne peut pas la faire.
- **Le RIB est vérifié, jamais refusé.** Vingt chiffres et leur clé, ou un IBAN : une forme de compte
  étranger que la règle ne connaît pas s'affiche en orange sans bloquer. Si un utilisateur signale
  un RIB juste marqué douteux, la règle se relit — elle a été vérifiée sur un RIB publié, pas sur les
  RIB de chaque banque tunisienne.
- **L'ordre des mouvements de stock d'une journée suit l'instant du geste** (création d'un achat,
  émission d'une facture). Les pièces d'avant la 10.12.0 n'ont pas d'instant d'émission : pour elles,
  les entrées passent avant les sorties. La valeur d'une journée ancienne où une vente et un achat
  se croisent change donc à la mise à jour (sur le cas du rapport : 4 300 → 4 425 DT), y compris dans
  un mois déjà clôturé — dans le sens juste, mais sans un mot à l'écran. Faut-il le dire (une ligne
  « À faire » qui nomme les mois clôturés dont le coût des ventes a bougé) ? À décider avec le
  comptable pilote : c'est lui qui aurait déclaré l'ancien chiffre.

**Vu en tenant une menuiserie (Menuiserie Kmar SARL, 24/09/2026), laissé à décider :**

- **La méthode de proratisation d'une entrée ou d'une sortie en cours de mois** est celle des jours
  ouvrables des barèmes (26 par défaut). Les jours calendaires ou le trentième donnent un autre
  brut : à faire trancher par le comptable pilote — la règle vit dans `payslipInputFor`.
- **L'acompte provisionnel du 28 septembre est rappelé à une entreprise créée cette année**, qui n'en
  doit en principe pas (il se calcule sur l'impôt de l'année précédente). L'échéance est un
  pense-bête réglable ; la désactiver d'office pour une première année demande une date de création
  de la société, que la fiche ne porte pas. À VÉRIFIER avec le comptable.
- ~~Petits constats (carte « Coût de la paie », total « Net estimé », « Top clients » coupé)~~ —
  corrigés dans 10.12.0-beta.1.
- **La marge d'une affaire compte ses achats rattachés en ENTIER.** Des planches achetées pour le
  stock et rattachées à un chantier y comptent pour tout le lot, même si la moitié sert ailleurs. La
  marge exacte demanderait de rattacher les SORTIES de stock (« Matière utilisée ») à l'affaire, au
  coût moyen. À décider avec Skander : c'est un changement de modèle, pas un correctif.
- **Un achat dont toutes les lignes vont en stock n'a pas de catégorie de charge** : la colonne
  affiche « — ». C'est juste (ce n'est pas une charge), mais rien ne le dit ; une mention « stock »
  à la place du tiret serait plus claire.
- **L'éditeur d'une proforma ou d'un bon de livraison tient sa barre sur deux rangées à 1440 px**
  avec l'aperçu (huit commandes, 1 216 px pour 1 129). C'est stable — rien ne saute au clic — mais
  45 px de moins pour le formulaire ; « Email » et « Transformer ▾ » pourraient entrer dans « Plus ▾ »
  quand ils ne sont pas l'étape suivante.
- ~~La famille proposée par défaut pour un bien neuf (« informatique ») suppose le métier de
  l'auteur~~ — corrigé dans 10.12.0-beta.1 : la famille se choisit, et propose la durée.
- **La TFP d'une menuiserie.** La note des barèmes dit « 1 % pour les industries manufacturières,
  2 % ailleurs », et le taux livré est 2 %. Une menuiserie fabrique : elle est peut-être à 1 %.
  Aucun métier ne porte de TFP tant que le comptable n'a pas tranché (règle 9.1.1) — la question
  est à lui poser, métier par métier.
- **Le panneau « Documents à remettre » du Registre** répète la liste des salariés avec un bouton
  chacun. Tenable à trois salariés ; à vingt, le geste devrait vivre sur la ligne du registre (un
  menu d'actions) ou sur la seule fiche du salarié. À revoir si une entreprise en a beaucoup.
- **Le centralisateur du livre-journal défile de côté à 1440 px** (douze mois × journaux). C'est un
  tableau large dans son `.scroll-x`, donc rien n'est perdu ; mais une vue par trimestre, ou les
  journaux en lignes et les mois en colonnes, le ferait tenir. À décider sur l'usage réel.
- **L'échéance d'un avoir fournisseur s'appelle encore « Échéance de paiement »** : pour un avoir,
  c'est la date à laquelle le fournisseur rembourse ou déduit. Le libellé suit la nature pour le
  numéro et les lignes (10.12.0) ; celui-ci attend de savoir comment un comptable le nomme.
- **Verrouiller puis déverrouiller ramène sur le premier onglet des Paramètres** : le verrou recharge
  la fenêtre, et l'onglet ouvert (« Données et sécurité ») est un état du renderer, perdu avec lui.
  On revient sur la bonne page, pas sur le bon onglet. Le garder demanderait de le confier au
  processus principal ou au stockage de session ; mineur tant qu'on verrouille rarement depuis là.
- **Un mot de passe faux à l'import d'un fichier chiffré oblige à tout recommencer** : la question
  se ferme, puis « Mot de passe incorrect » arrive seul, et il faut rechoisir le fichier. La
  vérification demande le processus principal (asynchrone), ce que la fenêtre à une question ne sait
  pas attendre aujourd'hui. À faire le jour où un client importe des fichiers chiffrés.

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

- **L'audit UI/UX du Cabinet est fait et corrigé** (23/09/2026) : ses trente constats (U-01 à
  U-30) et ce que leur vérification à la souris a trouvé en plus sont livrés en **10.12.0 (bêta)** —
  détail dans `CHANGELOG.md` et `CLAUDE.md` § 10.12.0. Reste à le faire relire par le cabinet pilote.
- **Le test humain de l'app entreprise** (23/09/2026, en chef d'entreprise qui fait son premier
  devis, sa première facture, puis son premier achat) a livré ses corrections en 10.12.0 (H-E1 →
  H-E28). Ce qu'il a vu
  et qui reste à décider ou à faire :
  - **Un trop-perçu ne se rembourse pas dans SkanFact.** Un avoir émis sur une facture déjà payée
    laisse une somme due au client : la carte « Trop-perçu » le dit, mais aucun geste n'enregistre
    le remboursement rattaché à la facture — on note la sortie à la main dans Trésorerie, et la
    carte reste. C'est de l'argent : à spécifier avant d'écrire (compte, pièce, effet sur le
    lettrage), et à faire en bêta. Au même endroit : la liste des clients, la fiche du client et l'accueil
    annoncent un « reste à payer » qui ne déduit pas ce qu'on doit à ce même client (1 012,500 DT
    affichés quand il nous doit 505,560 net) — c'est le même chantier, le relevé de compte, lui, est
    juste.
  - ~~Les champs de montant suivent la langue du SYSTÈME~~ — **fait en 10.12.0 (H-E28)**, et c'était
    pire qu'un affichage : sur un poste en anglais, « 2,5 » tapé devenait 25. L'application pose sa
    langue (`--lang fr-FR`) avant de démarrer. Reste, si un jour on le veut : les espaces de milliers
    DANS un champ (« 1 250,500 »), que le Cabinet sait lire (H-3) et qu'un `type=number` refuse.
  - **Toutes les questions s'intitulent « Confirmation »** : le titre devrait dire le geste
    (« Supprimer ce paiement ? »), la phrase en dessous dit déjà le reste. 78 appels ; dériver le
    titre du libellé du bouton donnerait « Passer ? » ou « Le client a refusé ? » — c'est à écrire
    appel par appel, pas à fabriquer.
  - **Une facture qu'on vient d'émettre se dit « envoyée »**, avant tout envoi : c'est le nom du
    statut déduit depuis la 1.4.0 (la bulle le dit), mais un créateur d'entreprise qui n'a rien
    envoyé le lit comme une erreur. Changer le mot touche les données (la valeur `envoyée`), les
    filtres, les relances et l'aide : à décider (« émise » ?), pas à glisser dans un correctif.
  - **Une pièce tirée d'une autre s'ouvre marquée « Modifications non enregistrées »** alors qu'elle
    vient d'être enregistrée (même chemin que « Transformer ») : vu en 10.12.0 en partant d'un devis
    depuis l'onglet Proformas (H-E30), non corrigé — à comprendre avant d'y toucher.
  - **Un avoir tiré d'une facture ne porte pas le timbre** (réglage « avoir sans timbre par défaut —
    À VÉRIFIER ») : un avoir « total » laisse donc la facture due d'un dinar, et elle ne passe jamais
    « annulée ». Question au comptable : le timbre d'une facture annulée par avoir se rend-il ?
- **La menuiserie tenue à la souris** (23/09/2026, fin de 10.12.0-beta.1 : devis, acompte, facture
  payée sur un compte créé depuis le paiement) a vu, sans les corriger :
  - **Le menu « Plus ▾ » d'une facture tirée d'un devis** laisse une rangée seule sur sa ligne quand
    la barre d'actions passe à la ligne : à mesurer à 1280 et 1440 avant d'y toucher.
  - **Un acompte provisionnel est réclamé à une société neuve** dans le calendrier fiscal, qui n'a
    par définition aucun impôt de l'an dernier sur lequel le calculer. À VÉRIFIER avec le comptable
    pilote : la règle d'exonération la première année est une règle de droit, pas d'interface.
  - **Un RIB valide ne dit rien** : le contrôle orange (10.12.0, E-11) avertit d'un RIB douteux, mais
    un RIB juste n'affiche aucune confirmation. Un « ✓ clé vérifiée » discret rassurerait au moment
    où l'on colle vingt chiffres ; à écrire avec la même fonction (`verifRib`).
  - La touche Tab passe par la bulle « i » de chaque libellé : c'est **voulu** (7.0.0 et 9.3.0 — une
    explication doit rester atteignable au clavier), gardé ici pour ne pas le « corriger » un jour.
- **Le pont testé pour de vrai** (24/09/2026, 10.13.0-beta.1 : paquet → Cabinet → questions →
  réponse → paquet refait → Cabinet) a corrigé ce qu'il a trouvé (signature retenue, paquet périmé,
  réponses orphelines, compte rendu muet). Il laisse :
  - **La pièce d'une question se tape à la main** dans le Cabinet (« FAC-2026-022 ») : une faute de
    frappe et la question ne s'affiche en face d'aucune pièce chez le client. Proposer les numéros
    lus dans les paquets reçus rendrait la faute impossible.
  - **Deux questions de suite en ouvrant un paquet d'exemple** (« Ce sont des données d'exemple »
    puis « Août n'est pas clôturé ») : les deux sont légitimes, mais deux fenêtres à la file se
    cliquent sans être lues (7.28.0). À fondre en une seule le jour où l'on retouche la fabrication.
  - **La signature du cabinet se retient au premier usage** : un attaquant qui intercepterait le
    TOUT PREMIER envoi d'un cabinet serait retenu à sa place. Même limite, assumée, que côté Cabinet
    (9.2.0). La lever demanderait que le fichier d'appairage porte aussi la clé de signature ET que
    l'empreinte lue au téléphone la couvre — donc un changement du format d'appairage.
- **Porter `typographie()` du Cabinet à la prose de l'app entreprise** (10.14.0) : l'espace fine
  insécable devant `? ! ; : »` n'y est posée que dans les visites et sur les questions du comptable
  (`C.typoFr`). Le portage général change le texte que les parcours comparent (bandeaux, `p`) :
  à faire avec les parcours, pas en passant.
- **Saturation (10.14.0), ce qui reste** : un compte du grand livre ouvert affiche TOUTES ses lignes
  (le 411 d'un livre de douze mille pièces en porte huit mille) — la page est rapide (0,4 s) parce
  que les comptes sont repliés, mais le compte déplié n'est pas paginé ; les onglets Comptabilité ›
  Écritures et Cabinet de l'app entreprise mettent ~1,3 s par clic sur huit mille pièces
  (à-nouveaux et balance lus depuis le début de l'exercice, 10.0.1) ; à 1280 px, la liste des
  clients déborde encore d'une quarantaine de pixels quand les montants dépassent cent millions ;
  la Déclaration employeur et le Registre du personnel restent d'un seul tenant (ce sont des
  documents imprimés, pas des listes).
- Les trois pistes jamais demandées, gardées pour mémoire : séparer les installateurs arm64 / x64
  (les 222 Mo du dmg universel), la signature Apple et Windows (certificats payants — mais elle
  passe **avant la première vente**, cf. `QUESTIONS.md` : un expert-comptable ne clique pas sur
  « Exécuter quand même »), et l'export TEIF si l'e-facture devient obligatoire.

## 4 bis. Reporté le 24/09/2026 : ce qui vient après la visite guidée

Skander a validé l'inventaire du 24/09 et choisi l'ordre : **d'abord la visite guidée complète**
(10.14.0), avec l'exemple sur cinq ans et le mode exemple rassurant. Le reste attend ici, dans
l'ordre proposé.

- ~~**L'assistant de démarrage (entreprise)**~~ — *fait en 10.14.0* (213a → 213g) : la porte prend une
  clé de licence ou un dossier partagé ; la numérotation continue (« Je facturais déjà », et
  Paramètres → Documents → Numérotation de tes pièces) ; le RIB remplit le premier compte ; la copie
  externe propose le mot de passe ; la messagerie se choisit au premier envoi ; Clients et Catalogue →
  Importer… depuis un tableur ; « Ta facture à ton image » (logo, cachet, couleurs sur la prochaine
  facture) ; A2 (devises nommées), A3 (l'étoile), A4 (« Question 1 sur 3 ») ; et les bulles de chaque
  champ des quatre formulaires du premier jour. Chaque geste joué à la souris. Reste :
  - **les champs sans bulle hors du premier jour** : 22 appels `field('…')` à libellé nu (paiement,
    référence, emplacement, remise globale, destinataire d'un envoi, CIN, poste, RIB d'un salarié,
    coût unitaire, numéro et frais d'un achat, banque d'un compte, email du comptable, remise et
    note d'un contrat…) et quelques `<label class="field">` écrits en texte. Le test de 10.14.0
    ne tient que les quatre formulaires du premier jour ; l'étendre à tout le fichier ferait le
    ménage d'un coup.
- ~~**L'assistant du Cabinet**~~ — *fait en 10.14.0* (214a → 214d) : la porte, deux questions (le nom,
  la liste des clients collée), puis « Tes premiers pas » — la clé de secours, la copie externe, le
  fichier d'appairage qui PART (« Remettre le fichier à mes clients… » l'enregistre et prépare le mail,
  clients en copie cachée, chemin exact dans SkanFact, empreinte à vérifier), et deux étapes
  facultatives cochées sur un geste : déclarer l'équipe (le premier déclaré est proposé
  « Supervision »), régler la grille de saisie (les touches se capturent et se lisent en français).
  Chaque geste joué à la souris. Reste une **décision de Skander** :
  - **la ligne rouge du premier jour.** Un cabinet qui colle sa liste de clients à l'assistant voit
    aussitôt, en rouge, « 4 dossiers hors SkanFact sont comptés, 3 sont couverts » (et la pastille de
    licence), avant d'avoir validé quoi que ce soit. C'est la règle de la 9.4.0 (trois dossiers hors
    SkanFact gratuits, la validation fermée au-delà) — le chiffre est juste. Mais le premier écran d'un
    comptable qui essaie est une alerte de paiement. Trois réponses possibles : un essai pour le
    Cabinet (comme les trente jours de SkanFact), un ton orange tant qu'aucune validation n'a été
    refusée, ou garder le rouge. C'est une décision commerciale, pas un défaut : rien n'est changé.
- ~~**La visite guidée du Cabinet**~~ — *faite en 10.14.0* : `cabvisites.js` (découverte, une visite par
  page et par écran de comptabilité, gestes guidés et techniques), « Me guider », et
  `e2e:cabinet-couverture`. Puis la parité (même jour, demandée par Skander) : 49 gestes guidés, un
  par écran de travail au moins, le bandeau de l'exemple de SkanFact sur chaque page, et quatre
  constats du test à la souris corrigés. Joués à la souris : grand livre, balance, production,
  paquets, et la découverte.
- ~~**Le jeu d'exemple du Cabinet sur plusieurs exercices**~~ — *fait en 10.14.0* (215) : le garage
  tient deux exercices (le précédent clos, rouvert une fois avec son motif, reclos ; le courant ouvert
  par ses à-nouveaux et son registre), et la découverte a son chapitre « D'un exercice à l'autre ». Ce
  qu'il a fait tomber est corrigé : le registre qui ne suivait pas « Ouvrir N+1 », un exercice clos
  qui bougeait (la porte d'écriture le refuse, ERR-CAB-064), janvier qui déclarait l'à-nouveau de
  décembre, « les six contrôles » en dur. L'exercice vit dans l'adresse. Reste :
  - **un client SUR SkanFact sur deux exercices** (Béji) : sa clôture partirait chez lui par le
    `.skanclose`, et l'exemple de l'app entreprise devrait alors la recevoir — c'est le flux retour
    joué des deux côtés, qui demande que les deux jeux d'exemple se répondent. À décider avant de
    l'écrire : c'est l'exemple de SkanFact qui changerait.
  - **À VÉRIFIER, lié au point précédent** : chez un client SUR SkanFact, les à-nouveaux de janvier
    arrivent dans son paquet (`source: 'skanfact'`, journal AN). « Ouvrir N+1 » ne les reconnaît pas
    comme des à-nouveaux (il ne connaît que `source: 'an'`) : il proposerait d'en poser une seconde
    pièce, en brouillard, à côté de celle du client. Le geste ne touche jamais les pièces du client, et
    rien n'est validé d'office — mais le bouton dirait « Poser les à-nouveaux » au lieu de « Voir », et
    l'écart entre l'ouverture du client et la clôture du cabinet (`ecartAnouveaux`) ne se calculerait
    pas. Le jeu d'exemple ne peut pas le montrer (seul le garage, hors SkanFact, a deux exercices) :
    à trancher avec le flux retour ci-dessus — qui fait foi pour l'ouverture d'un client sur SkanFact,
    sa pièce ou celle du cabinet ? Même limite, depuis la suite de 215, pour les **à-nouveaux
    complémentaires** (`poserComplementAnouveaux`, `nettesAnouveaux`) : l'écart et le complément ne
    lisent que les pièces `source: 'an'`, donc l'ouverture d'un client sur SkanFact ne compterait pas
    comme « portée » et l'écart annoncerait la clôture entière. La réponse à la question ci-dessus
    décide des deux à la fois.
  - le chapitre neuf passe par les instruments reportés ci-dessous (`e2e:cabinet-visites`).
- **Les deux instruments `e2e:visites` et `e2e:cabinet-visites` — reportés le 24/09 par Skander**
  (« on laissera le E2E des deux app pour plus tard », pour passer à l'assistant de démarrage). Ils
  sont ÉCRITS (harnais partagé `test/e2e/jouer-visites.js`, `amenerGuide` qui dit où il s'est perdu,
  `VISITES_DEPUIS=<id>` pour reprendre au milieu) et ils ont déjà trouvé trois défauts, corrigés : la
  méthode de révision et le modèle de liasse qui figeaient le Cabinet (`{ ok, state }` au lieu de
  l'état), et trois visites qui ouvraient l'impression sans l'annoncer. Ce qui reste :
  - `e2e:cabinet-visites` joue les **74 visites** jusqu'au bout ; le **bilan des fautes n'a pas encore
    été lu** — le dernier passage s'arrêtait à la fermeture (la question « saisie non enregistrée »,
    U-09), désormais répondue par le parcours, et il a été interrompu avant de conclure.
  - `e2e:visites` (l'app entreprise) n'a **jamais été joué en entier** : ses deux passes (exemple, puis
    vraie entreprise) restent à faire tourner et leurs fautes à corriger une par une.
  - Puis relancer **tous** les parcours (règle 7.28.0 : après une refonte, tous) et publier la
    **10.14.0-beta.1** — elle attend ces deux instruments verts.
- **Le test humain des visites** (souris, clavier, 1440 et 1280, clair et sombre) : toutes les
  visites de page, une par une — à faire avant la stable.
- **Le paiement dans l'application** (bêta obligatoire : argent et clés) : « Acheter » et
  « Renouveler » qui ouvrent la page de paiement préremplie (offre, matricule) et une clé récupérée
  toute seule après le paiement, par une référence que l'application a elle-même créée — jamais par
  le matricule, qui est public ; sans réseau, le mail reste. Une licence achetée pendant l'essai
  démarre-t-elle au paiement ou à la fin de l'essai (décision de Skander). Et le remboursement d'un
  trop-perçu, avec le « reste à payer » net (§ 4 ci-dessus).
- **Ne jamais se perdre** : les 78 titres « Confirmation » à écrire geste par geste, « émise » au lieu
  de « envoyée », H-E30, les barres qui passent sur deux rangées, et les restes de la console (§ 3).
- **Les tests humains mis en pause** le 24/09 pour la visite : l'app entreprise (achats, stock, biens,
  trésorerie, paie, comptabilité, paramètres, données) et le Cabinet en entier. Les 55 parcours de la
  10.13.0-beta.1 tournaient au même moment. Et le relancement de tous les parcours de la 10.14.0
  (plus haut, avec les deux instruments de visites).

## 5. Les dettes d'outillage

- **`skanfact.tn` est injoignable depuis une session Claude** (le proxy le bloque, `api.skanfact.tn`
  aussi). On vérifie donc la branche publiée et le run de déploiement, jamais la page telle qu'un
  visiteur la reçoit. Toute affirmation sur « ce que le site affiche » doit le dire.
- **Les tarifs du site ne sont pas confrontés à ceux du worker par un test.** `essai-achat.mjs`
  travaille contre un faux serveur ; le jour où les deux divergent, rien ne le dira.
- **Aucun test ne confronte `TARIFS-REFERENCE.md` aux prix réellement réglés** dans la console.
