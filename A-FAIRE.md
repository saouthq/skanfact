# Ce qui reste à faire

*Le carnet des choses repérées et pas encore traitées, sur les TROIS surfaces du produit :
les deux applications (`skanfact`), le site (`skanfact-site`) et la plateforme (console + relais).
Il ne remplace pas `VERSIONS-A-VENIR.md`, qui inventorie les VERSIONS à écrire : ici vivent les
constats isolés, les dettes et les décisions en attente. Une ligne en sort quand elle est faite, ou
quand elle devient une version.*

Dernière relecture : 26/09/2026.

---

## 0. EN COURS — la 2e vérification (10.14.1, bêta) et les demandes du 26/09/2026

*Écrit le 26/09/2026 à la demande de Skander, pour que rien ne se perde entre deux sessions. La
10.14.0 est publiée en stable ; tout ce qui suit part en **10.14.1** en BÊTA (ça touche à l'argent
et au moteur), puis en stable quand Skander valide.*

### 0.1 Ce que je suis en train de faire (10.14.1)

- **Fait, prouvé et testé à la souris (26/09)** :
  - **C1** — un bien au bilan sans être au tableau des immobilisations (ligne d'achat sans fiche,
    bien pas encore en service, en service avant sa facture) : page, contrôle de clôture, action,
    invariant de janvier.
  - **ACP-01** — un acompte demandé en MONTANT fait ce montant TTC au millime (`depositLinesMontant`,
    recherche sur chaque base, plusieurs taux, remise, euros au centime) ; la facture dit « 500,000 DT
    TTC du devis … » (`acompteDit`) ; les bulles et l'article « Acompte et solde » ne disent plus
    « converti en pourcentage ».
  - **NUM-01** — la règle commune des champs vit dans un `:where()` : les 26 règles de conteneur
    qu'elle écrasait depuis la 7.9.0 s'appliquent (P.U. d'un achat, quantités, mot de passe sous
    « Afficher », grilles du Cabinet). Trois anciens tests CSS retournés vers la règle (37e, 38e).
  - **Bulles** : la sonde des champs sans bulle ne voyait pas une balise qui porte un `id` ou un
    `style` après sa classe ; trois champs nus trouvés et habillés (pourcentage d'acompte, solde du
    relevé, compte du grand livre).
  - **Écrans de verrouillage** : le Cabinet n'a plus l'invite « •••••••• » (un champ vide qui se lit
    rempli) ; dans les deux applications le reproche disparaît quand on retape.
  - **S-01** — en bêta, une stable plus récente que la dernière bêta est proposée, par TOUS les
    chemins : le relais (`indexAServir`, `trouveIndex`, `INDEX_STABLE_DE`, `/sante` dit
    `sertStable`), le repli GitHub du Cabinet (même décision, jumelle dans `src/canaux.js`, et le
    canal reposé dans les trois chemins par `poserCanal`), le repli GitHub de l'app entreprise
    (electron-updater le fait déjà avec notre `appliquerCanal` — prouvé sur le vrai module) et la
    console (la ligne « Essais » nomme la stable servie). 11 preuves. **Vu à l'écran** : le vrai
    relais lancé sur les VRAIES releases (10.14.0 stable, 10.13.0-beta.1) sert la 10.14.0 aux
    quatre index d'essai, et la vraie console branchée dessus l'affiche. Le relais ne se déploie que
    quand `worker/skanfact-maj.mjs` arrive sur `main` (à la stable 10.14.1) : d'ici là, un Cabinet
    en 10.13.0-beta.1 case cochée reste sur « tu as la dernière version » — il doit décocher une
    fois, ou attendre la stable. Le test à la souris dans l'application elle-même demande une
    application construite (une copie de développement ne cherche pas de mise à jour).
  - **S-05** — la facture ou la proforma payable le jour même : UN cadre, « Émise le 24/09/2026 » et
    dessous « À régler à réception » ; le récapitulatif d'émission dit « À réception ». Test retourné
    vers la règle, prouvé sur l'ancienne forme exacte de la 10.12.0.
  - **Cabinet** : la pastille de l'étape en cours de « Tes premiers pas » débordait de sa liste
    (marge négative → ombre + `clip-path`) ; le jour de relance affichait « 1 » pour le 10 (le zéro
    sous les flèches, depuis NUM-01 : `5.5ch` ne comptait ni la marge ni les flèches).
  - **Parcours e2e rafraîchis** (ils décrivaient l'état d'avant la 10.14.0) : `cabinet` (bandeaux
    reconnus par ce qu'ils portent, adresse avec l'exercice), `cabinet-perte`, `boucle` (un mois
    OUVERT, sinon le paquet part définitif et le brouillard n'existe pas), `cabinet-premier-jour`
    (« Suivant » par son id), `console` (montants à espace insécable), `entreprise` (montant
    complété, rapprochement paginé, résultat simplifié à toutes ses composantes).
  - ~~**Reste à `e2e:cabinet-jour1`** : la grille de saisie commence à 592 px sur un portable (seuil
    480)~~ **Fait (26/09)** : « Première fois ? » ne pousse plus rien (S-03), le bandeau de l'exemple
    se RAPPELLE sur une ligne hors de la page d'accueil (les deux applications), et l'en-tête d'une
    fiche garde ses gestes sur la rangée du nom — la grille commence à 462 px et montre 9 lignes ;
    `e2e:cabinet-jour1` passe. Vu au passage et corrigé : « Voir dans le paquet » recouvrait le
    Crédit à 1280 px (mot court « Paquet »), « Commence par la page de garde » sur un paquet qui
    n'en a pas, et « Enregistrer les droits » vert au repos à côté de « Relancer ».
- **Fait, prouvé et testé à la souris (26/09, suite)** :
  - **S-04** — une pièce jointe se retrouve par son nom (Ctrl K, recherche des listes) et chaque
    ligne qui a un justificatif porte 📎 (factures, devis, achats, dépenses, mouvements, écritures).
    Vérifié de bout en bout jusqu'au Cabinet : 📎 sur la pièce du journal, et « Ouvrir le
    justificatif du client » qui ouvre le fichier du paquet.
  - **RESET-01** — « Réinitialiser les filtres » et les gestes d'un état vide redessinaient la page
    par `routes.X()` direct : le bandeau de l'exemple, le lien d'aide et les bandeaux de la page
    disparaissaient. Tout passe par le routeur.
  - **LET-01** — un achat sans numéro de fournisseur reçoit une référence lisible et unique
    `SN-AAAAMMJJ[-n]` : la pièce, le lettrage, le dossier du paquet, la recherche et la colonne
    « Pièce » de `achats.csv` et `reglements-fournisseurs.csv` (au Cabinet, deux achats du même
    jour sont deux pièces distinctes, 114 et 115). **Limite** : supprimer un achat sans numéro plus
    ancien le même jour décale les `-n` des suivants (la référence est déduite, comme un statut) —
    à dire au CHANGELOG avec le conseil de refaire les paquets des mois qui portaient des achats
    sans numéro.
  - **REF-01** (Cabinet) — un refus qui renvoie aux Réglages montre la case fautive une fois le
    panneau chargé (le nom du cabinet avant d'enregistrer l'appairage).
  - **OPEN-01** (les deux applications) — `shell.openPath` ne lève rien : il REND un message quand
    aucun programme n'ouvre le fichier, et ce message était ignoré (clic accepté, rien ne s'ouvre).
    Une seule porte par application (`ouvrirOuMontrer`, jumelles comparées par un test) : le
    fichier est montré dans son dossier et l'écran le dit ; une copie disparue du disque se dit
    autrement. Vérifié à la souris : la copie déplacée (« ne s'ouvre pas : la copie … a peut-être
    été déplacée »), et le cas « aucun programme » sur une copie de l'application lancée avec un
    `shell` simulé (ce poste Linux prétend tout ouvrir).
  - **Élision** : « le brouillon d'octobre 2026 », « dans son paquet d'août 2026 » (`deLibelle` dans
    core.js, jumelle de `de` du Cabinet), vues à l'écran dans les deux applications.
  - **Limites notées, non bloquantes** : le jeu d'exemple porte peu de justificatifs (la recherche
    par nom de fichier s'y démontre mal) ; une copie jointe à une pièce abandonnée peut rester sur
    le disque si l'application est tuée pendant la saisie ; la liste des mouvements de Trésorerie
    n'a pas de champ de recherche ; sous Linux (qui n'est pas une plateforme livrée) l'écran dit
    « l'Explorateur ».
- **Fait, prouvé et testé à la souris (26/09, S-02 — la visite guidée, première moitié)** :
  - **Elle ne passe plus toute seule** : seul un GESTE de la personne fait avancer (un redessin de la
    page, une zone vue puis vidée, un geste déjà fait en entrant ne sautent plus d'étape — « Déjà
    fait » attend « Suivant ») ; pendant qu'on essaie ce que la bulle montre, rien n'avance.
  - **Ce que la bulle montre se clique** : le voile est un masque PERCÉ (la zone, chaque bouton nommé
    « entre guillemets » avec son anneau, et chaque contrôle que la liste décrit — même hors d'une
    zone coupée, même quand deux contrôles partagent une phrase, comme les jours de dépôt TVA et
    CNSS) ; pendant un essai ou une liste ouverte, pas de voile, la bulle se range en retrait.
  - **Reprendre** : une visite de page reprend à l'étape où l'on s'était arrêté ; un geste arrêté au
    milieu repart de l'écran où il commence, et « Me guider » le dit ; « Déjà rempli » au lieu de
    « écris la désignation » d'une case remplie ; « Étape 1 » (pas « 1 sur 2 ») d'une page encore à lire.
  - **Des fins honnêtes** : une visite qui finit sur « Enregistrer » ne félicite que si c'est
    enregistré (les régimes du Cabinet : `mesure`/`but` et l'étape d'enregistrement).
  - **Le haut de page dit ce qu'il EST** : le bouton vert nommé, « plus bas, en vert — … », ou
    « aucun n'est vert » (`texteDuHaut`) — la promesse « un seul est vert » était fausse sur les
    Réglages du Cabinet.
  - **Réglages du Cabinet** : la visite lit un panneau par étape (la `<section>` d'onglet se
    traverse) ; « Déclarer les régimes » ouvre le BON onglet (un test confronte, dans les deux
    applications, l'onglet ouvert au panneau visé : `test/onglets-visites.js`) ; un régime déclaré se
    choisit enfin sur la fiche d'un client (`choixRegimes`), et l'en-tête dit « régime exonéré » (plus
    « régime Régime réel ») ; « ✓ enregistré » ne pousse plus le bouton de 84 px.
  - 18 preuves par réintroduction pour la dernière partie ; `npm test` 1519 OK, lint propre.
- **Fait, prouvé et testé à la souris (26/09, S-02 — la visite guidée, seconde moitié)** :
  - **Des fins honnêtes pour tous les gestes guidés** des deux applications (émettre, régler, avoir,
    mot de passe, clôturer, envoyer, relancer, bulletin, paquet, équipe, pièce saisie…) : une fin qui
    affirme un fait a un `but` ou une `preuve` ; un geste PASSÉ ne se félicite pas et la fin le nomme ;
    une fin ratée dit l'état et le geste qui le fait, jamais une cause devinée — la règle
    (`finsHonnetes`) est tenue dans les deux applications.
  - **Après un geste passé, la visite saute ce qu'il aurait ouvert** (plus de récapitulatif décrit
    alors qu'il ne s'est jamais ouvert) ; **ce qui s'est refermé pendant qu'on le regardait** se dit
    « Ça s'est refermé » avec « Revenir à « … » » (le geste qui l'ouvre). Vérifié à la souris :
    Émettre (passé, fait, annulé), Relancer (annulé dans la question de l'exemple, puis fait
    jusqu'au bout), et au Cabinet « Travailler à plusieurs » (annulé, revenu, déclaré).
  - Trois visites neuves ne se lancent que quand elles ont un sens : une facture EN RETARD à relancer,
    un achat DÛ à régler, un mois À CLÔTURER — sinon elles disent pourquoi. La visite du mot de passe
    sait si les données sont déjà chiffrées. Un test confronte clé par clé ce que les visites
    demandent à ce que chaque application leur prête (`premier`, `chiffre`, `ecritures`, les sortes
    de dossier du Cabinet, l'entrée de menu « Relancer par email » visée par sa clé).
  - Fenêtres : deux champs empilés ne se touchent plus (14 px) ; une zone de texte ne s'écrit plus en
    gras. 38 preuves par réintroduction ; `npm test` 1524 OK, lint propre.
  - **Vu pendant le test à la souris, à traiter** : la ligne « Reportées » des Relances est pâlie
    jusqu'à son bouton « Actions », qui paraît éteint ; les numéros de « Échéances dans les 7 jours »
    ne s'ouvrent pas (du texte) ; l'anneau d'une étape posé sur une case recouvre son libellé
    (« Rôle ») — éclairer le `.field` entier ; la fenêtre du mail dit « l'Explorateur » sous Linux
    (juste sous Windows, plateforme livrée).
  - **Reste de S-02** : les textes des actions beaucoup plus explicatifs (ce que fait le bouton, quand
    s'en servir, ce qui se passe après) — « Ouvre un devis vierge » ne suffit pas ; relancer
    `e2e:couverture` et `e2e:cabinet-couverture`. Quand `e2e:visites` tournera (§ 4 bis), la visite
    « motdepasse » chiffrera le profil du robot (essai « Visite-2026 ») : les visites suivantes
    trouveront l'écran de verrouillage.
- **Fait, prouvé et testé à la souris (26/09, S-03 — « Guide-moi »)** :
  - « Comprendre cette page → » est remplacé, dans les DEUX applications, par **« Guide-moi »** : en
    haut de chaque page (reposé par un observateur quand une page redessine son en-tête), il ouvre la
    liste de ce qu'on peut faire ici — la visite de la page et son article d'abord, puis les gestes
    guidés de l'onglet ouvert, ceux des autres onglets rangés par onglet, et « Toutes les visites
    guidées ». Un seul moteur (`Visite.guideDeLaPage` / `menuDuGuide` / `dansLeGuide`, purs).
  - Sur une fiche, seuls les gestes qui s'y feront (le brouillon ouvert → « Émettre » ; le dossier
    regardé au Cabinet) ; une visite en pause se REPREND depuis « Guide-moi », à son étape ; la pause
    ne nomme « Guide-moi » que s'il la propose ; l'article suit l'onglet ouvert (`PAR_ONGLET`) ;
    « Déclarer un salarié » ouvre l'onglet Salariés avant de viser « + Salarié » ; un menu s'ouvre
    vers la page (`RowMenu.placerMenu`) ; « Première fois sur cette page ? » s'accroche au bouton,
    par-dessus la page, au lieu de pousser l'écran de travail.
  - `test/suites/guide-moi.js` (17 tests, 22 preuves par réintroduction), `e2e:aide` passe par
    « Guide-moi », quatre anciens tests remis sur la règle ; `npm test` 1541 OK, lint propre. Vérifié
    à la souris : listes, facture, Paie (onglets), Paramètres/Réglages, fiche et écrans de
    comptabilité d'un dossier du Cabinet, invitation, pause puis reprise à l'étape 3.
- **Fait, prouvé et testé à la souris (26/09, S-06)** :
  - **« Chargement… » avant un calcul long** (les deux applications) : la navigation pose un voile
    sur la zone de travail, laisse une image se peindre, puis dessine ; le voile n'apparaît qu'après
    un quart de seconde (une page rapide ne le montre jamais) et c'est le compositeur qui le joue
    pendant que le calcul occupe le fil principal. Vu à l'écran pendant un dessin rendu lent (trois
    secondes), et parti ensuite.
  - **Une page qui change se voit changer** : son contenu monte de 8 px en apparaissant (200 ms),
    seulement quand la PAGE change — un tri, un filtre, un enregistrement ne rejouent rien ; « réduire
    les animations » l'éteint. Vu au milieu de l'animation dans les deux applications.
  - **« Nouveau dans SkanFact 10.14.1 »** : au premier lancement d'une version, une carte au coin de
    l'écran dit en phrases simples ce qui change pour la personne (`src/renderer/nouveautes.js`, une
    table par version, partagée) — jamais à une installation neuve, jamais par-dessus une fenêtre,
    l'assistant ou une visite, une seule fois ; revenir sur une version plus ancienne n'oublie pas ce
    qui a été lu (trouvé à la souris : la version retenue reculait au redémarrage). Un test exige les
    phrases de chaque version publiée, et que ce qu'elles citent existe. Vu et fermé à la souris dans
    les deux applications. 12 preuves ; `npm test` 1554 OK.
- **Ce que « Guide-moi » a montré qu'il manque (S-02, à faire)** — des pages sans aucun geste guidé
  dans leur section « Ce que tu peux faire ici » : **Catalogue** (modèles, textes), **Proforma, bons et
  contrats** (faire une proforma, un bon de commande ou de livraison), **Facturation récurrente**
  (créer un contrat), **Trésorerie** (noter un mouvement, un virement entre mes comptes), **Paie**
  (poser un congé ou une absence `#new-lv`, une avance `#new-av`, déposer la CNSS, un document du
  personnel, les barèmes), **Stock** (un article suivi, un mouvement `#st-adj`, un inventaire, des
  numéros de série `#se-add`), **Garanties**, **Comptabilité** onglet TVA, **Immobilisations** (céder
  un bien), **Marges** (analyse, contrats, seuil) ; au Cabinet, « Créer le livre d'un client » et
  « Reprendre un dossier (balance d'ouverture) » sur un dossier sans livre. Et des textes trop
  courts à réécrire (« Ouvre un devis vierge. », « Le reste à payer est proposé : tu n'as souvent
  qu'à valider. », « Clique sur « + Salarié ». »).
- **Cabinet — 84 champs sans bulle « i »** (trouvés en portant la sonde de l'app entreprise au
  Cabinet, le jumeau manquant) : salarié, bulletin, bien, cession, écriture de trésorerie, questions,
  réouverture, mots de passe… À écrire dans `cabguide.js` (chaque bulle dit ce que le CODE fait du
  champ), puis porter le test de `assistant.js` au Cabinet.
- ~~**C2 — les CSV du Cabinet au format machine**~~ **Fait (26/09)** : `K.csvMontant` / `K.csvDate`
  (le format de `core.toCsv`, comparé à lui par un test) dans les cinq exports — portefeuille, biens,
  déclaration, liasse, livres. Vu à la souris : le livre-journal du garage exporté par « Enregistrer »,
  lu sur le disque (`01/01/2026`, `20000,000`). Et deux constats du test à la souris faits : la ligne
  « Reportées » ne pâlit plus son bouton « Actions », le numéro d'une échéance à 7 jours est un lien.
- ~~**L'aller-retour par un tableur** (Skander, 26/09 : le comptable corrige dans Excel et
  réimporte)~~ **Fait (26/09)** : « Réimporter depuis un tableur… » sur le livre-journal du Cabinet —
  rien n'est supprimé, tout entre en brouillard, une validée ne se contre-passe que si on coche,
  chaque ligne écartée nommée par sa ligne dans le tableur, Windows-1252 lu. Vu à la souris sur le
  garage (2 nouvelles, 1 validée corrigée, 1 déséquilibrée, 2 lignes écartées). Reste : **l'app
  entreprise n'a pas ce geste** (elle ne tient pas de livre : ce n'est pas un manque tant qu'aucun
  client ne le demande), et **un fichier .xlsx est refusé** en le disant — l'enregistrer en CSV.
- ~~**La console et la licence Cabinet offerte, sans limite**~~ **Fait (26/09)** : récapitulatif
  (« offerte : rien à encaisser »), clé envoyée tout de suite, « offerte » dans Ventes et sur la
  fiche, pas d'« Impayées », mail « dossiers sans limite », renouvellement qui garde la case,
  empreinte en cinq groupes, cadre du bloc de la clé. Vu à la souris jusqu'au Cabinet (clé collée :
  « Couverts : sans limite »). Constats restés : **le formulaire d'émission sans client dit « crée-le
  d'abord » sans bouton sur place** ; **l'app entreprise n'a pas de lien vers le portail CNSS** ; le
  texte du champ mot de passe du Cabinet est centré ; la carte « 0 / 0 à jour » s'affiche sur un
  portefeuille de dossiers hors SkanFact (vrai, mais pas utile) ; « Postes 0 » dans la console est
  attendu (le Cabinet local ne s'annonce pas).
- **PERF-01** (la fenêtre « Nouvelle opération diverse » gelait 15,5 s sur dix ans ; corrigé par le
  lot de `comptesProposes`) : le vérifier à la souris sur l'exemple de cinq ans.
- **Le Cabinet, parcouru par moi-même** (les agents n'y ont rien trouvé : ça ne vaut pas preuve).
- **Ce qui reste des tâches de la 2e vérification** : scénarios du moteur (entreprise neuve, cinq
  ans, dix ans et plus, les quinze métiers, les régimes, les taux, les devises) ; aucun montant
  affiché brut (« 250 » au lieu de « 250,000 DT ») dans les deux applications, toutes devises ;
  parcours humains écran par écran (entreprise et Cabinet) ; relancer les recherches interrompues.
- **Déjà fait dans la 10.14.1** (à écrire au CHANGELOG) : CA-01/02/03, MR-*, M-*, MC-*, DEV-*
  (arrondis, libellés de devise), MC-14, MC-15, DEV-16, DEV-16 bis, H-V2-02, CLOT-01 (le contrôle des
  bulletins compte TOUS les mois et nomme le premier qui manque), SOC-01, PERF-01, les années de la
  Paie, l'accord de l'état vide de la Paie, l'échéance d'un ACHAT qui suit la date et le délai du
  fournisseur (et ne réécrit pas une échéance recopiée), le message passager « Échéance recalculée »
  avec « Annuler » (plus de note qui pousse le formulaire, H-E1), « Date de validité » sur un devis,
  la copie d'un achat qui reprend le délai du fournisseur, deux tests retournés vers la règle
  (`.run(` au lieu de `.run()`), et `e2e:editeur` réparé (champ caché attendu « attaché », devis
  choisi dans un mois ouvert).
- **Pour publier la 10.14.1-beta** : `npm run lint`, `npm test` complet (régénérer
  `node scripts/exemple-cabinet.js` si un test du gabarit tombe), `npm run charge:entreprise`,
  CHANGELOG, les leçons dans CLAUDE.md, bump, commit, push `beta`, workflow Release, vérifier les
  fichiers et les index du canal bêta.
- **Reporté par Skander le 24/09** : faire tourner `e2e:visites` et `e2e:cabinet-visites` jusqu'au
  bout (§ 4 bis).

- **Fait (26/09, commité)** — tout vérifié à la souris :
  - l'anneau d'une case à cocher entoure son LIBELLÉ (`zoneDeLaCase`) ;
  - le gérant qui signe une attestation s'écrit enfin quelque part (`managerName`) ;
  - le Cabinet colle une liste de clients depuis « Nouveau client… » (`#nd-coller`), un homonyme sans
    matricule est un doublon ;
  - « Relancer » depuis la fiche d'un client ouvre les Relances filtrées sur lui (« 1 sur 3 », vu) ;
  - deux cibles de visite fantômes (`gross` → `grossSalary`, `#pv-col` → `#view .preview`), et le test
    permanent qui lit chaque cible contre son application et chaque champ contre le formulaire que la
    visite ouvre (table `FORMULAIRE`) ; la visite « salarié » rejouée, le brut devenu geste obligatoire ;
  - chaque champ que l'enregistrement refuse vide porte son étoile (quatorze fenêtres, test `verif2`) ;
  - changer de client dans l'éditeur rend la langue et la devise DU NOUVEAU (défaut vu à la souris :
    un client en euros laissait sa devise au suivant) ; le taux se vide quand la devise change ;
  - les visites qui choisissent un client guident le taux de change quand il apparaît (`etapeTaux`,
    devis, proforma, contrat récurrent), vu avec Nova Digital.
- **Demandé par Skander le 26/09 — « Guide-moi » sur une entreprise VIDE qui vient d'être créée** :
  c'est le cas le plus courant (on appuie sur le bouton pour découvrir), et tout n'a été joué que sur
  l'exemple. Créer une entreprise neuve (porte → « Commencer avec mon entreprise », les trois
  questions), puis sur chaque page : ouvrir « Guide-moi », lancer chaque geste proposé et le jouer
  jusqu'au bout à la souris. À vérifier : un geste qui suppose une donnée absente (une facture à
  émettre, un client, un article) ne doit ni se lancer dans le vide ni viser un bouton inexistant — il
  propose d'abord le geste qui crée ce qui manque ; les listes vides et leurs visites ; les fins
  honnêtes ; « Première fois sur cette page ». Idem dans le Cabinet avec un cabinet neuf sans dossier.
- **Reste de ce lot** : les propositions de texte vérifiées des visites (sauter 22, 80, 81, 106,
  118–129 ; accents de 77–79 ; réécrire 132) ; relancer `e2e:couverture` et `e2e:cabinet-couverture`
  (boutons neufs `#hf-gerant-go`, `#nd-coller`).

### 0.3 La question de Skander du 26/09 : « et après la comptabilité, le comptable transfère à l'État ? »

*Il veut que le comptable dépose SANS RESSAISIE (DIRECTION.md, « zéro ressaisie »), CNSS comme
e-jibaya. Ce qui se dépose (sources officielles, **À VÉRIFIER** avec le comptable pilote) : chaque mois
avant le 28 la déclaration mensuelle sur e-jibaya (TVA, retenues, TFP, FOPROLOS, TCL, timbre, saisie
sur le portail) ; chaque trimestre la déclaration des salaires à la CNSS (saisie OU fichier texte,
salaires en millimes, cahier `services.cnss.tn/FileControl/Desc_File_cnss.pdf`) ; avant le 28 février
la déclaration d'employeur (fichiers DECEMP_/ANXEMP_, cahier des charges republié chaque année :
`jibaya.tn/wp-content/uploads/2026/01/EMPCCA_25V2.pdf`) ; avant le 25 mars l'IS avec la liasse fiscale
en XML normalisé (LF 2017 art. 41) ; les acomptes provisionnels (6e, 9e, 12e mois après la clôture).*

Constats **vérifiés dans le code du 26/09** (ceux de Skander, relus un par un) :

1. Aucun export XML, aucune mention d'e-jibaya ni du portail CNSS dans `src/` : la liasse sort à
   l'écran et en CSV.
2. Cabinet, onglet Paie : « La déclaration CNSS » est un tableau par salarié qui dit « c'est un tableau
   à recopier sur le portail » — ni export, ni « déposée / payée », et hors du groupe « Déclarer et
   clôturer ».
3. La déclaration annuelle d'employeur est un panneau en bas de la Liasse, en totaux seulement, sans
   export ni pointage, alors qu'elle se dépose un mois AVANT la liasse. Sa phrase (`employeurAnnuel`,
   compta.js) dit que le cabinet ne reçoit pas les bulletins : **fausse depuis la 10.3.0**, les
   bulletins vivent dans le livre du Cabinet.
4. La Déclaration mensuelle : les cases ne suivent ni l'ordre ni les codes du formulaire e-jibaya,
   aucun montant n'a de bouton « Copier », aucun lien n'ouvre le portail, TCL et acomptes valent « — ».

Ce que je décide (règle 5.2.0 : SkanFact ne dépose rien — produire un fichier que le comptable dépose
lui-même ne la contredit pas ; mais un format officiel republié chaque année ne doit JAMAIS produire un
fichier rejeté le jour de l'échéance : chaque fichier porte la version du cahier des charges qu'il
suit, et l'écran dit de le contrôler sur le portail avant l'échéance) :

- ~~**D1 — sans ressaisie sur les écrans existants** : « Copier » sur chaque montant de la déclaration
  mensuelle (au format que le portail attend, sans espace ni devise), un lien « Ouvrir e-jibaya » et
  « Ouvrir le portail CNSS », l'échéance de chaque déclaration dans son écran.~~ **Fait pour la
  déclaration mensuelle du Cabinet (26/09)** : bouton sur chaque montant, forme réglable (point,
  virgule, millimes — le guide DGI dit « point décimal », d'où le défaut), date limite lue par la
  règle des Échéances (trimestre compris), lien e-jibaya. Reste : le même geste sur la CNSS (D2).
- **D1bis — fait (26/09)** : l'écran de déclaration du Cabinet suit le formulaire 2026 — six
  rubriques numérotées avec leur titre arabe, lignes 1 / 3 de la retenue séparées quand les bulletins
  refont le 4321, base et taux de la TFP et du FOPROLOS lus sur les bulletins, TVA I / II / report /
  solde, récapitulatif « ce qui se paie » avec son total (IRPP, TFP et FOPROLOS compris : le
  formulaire les porte), et « hors formulaire » (retenues subies, acomptes). Le montant de l'écriture
  du mois (4365) ne change pas. **Reste, et ne s'invente pas** : la répartition des retenues opérées
  sur les lignes 4 à 31 (le livre ne porte pas leur taux), la TVA par taux et les achats par
  catégorie (immeuble / équipement / autre, local / importé), la TCL (sa catégorie se choisit).
  Le texte d'origine du plan :
- ~~**D1bis — la déclaration mensuelle dans l'ordre du formulaire 2026**~~ (reçu de Skander le 26/09,
  `mensuelle2026.pdf`, en arabe) : RS en 31 lignes (base, taux, montant), TFP (1 % industrie / 2 %
  autres) et FOPROLOS (1 %) en base + taux, TVA par BASE HT et par taux (7/13/19 + autres), achats HT
  déductibles par catégorie (immeubles ; équipements local / importé ; autres achats local /
  importé), régularisations, crédit du mois précédent, timbre, TCL (0,2 % du CA local brut, 0,1 %
  export), minimum de 30 DT pour une personne morale. Chaque case copiée doit tomber sur une case du
  formulaire. **Ce qui manque au moteur** : la catégorie d'un achat (immeuble / équipement / autre,
  local / importé) n'existe pas — la déduire de la destination (immobilisation = équipement) et
  demander le reste, ne rien inventer (9.1.1).
- **L'IS annuel** (`التصريح بالضريبة على الشركات 2025`, reçu le 26/09) : taux 10/15/20/35/40 %,
  minimum d'impôt 0,2 % du CA local brut TTC (500 DT au moins ; 0,1 % et 300 DT au taux de 10 %),
  contribution sociale solidaire 3 % (400 DT au moins aux taux 20/15 %) ou 4 % (500 DT, taux 35/40 %),
  acomptes en trois, et la liste des retenues SUBIES à joindre (nous l'avons : `retenueSubie`).
  La 10.0.0 refuse tout taux en dur : le formulaire officiel autorise maintenant à PROPOSER la liste
  (« la liste propose, elle n'enferme pas », 8.3.0), le cabinet choisit. **À VÉRIFIER** avec le pilote.
- **Documents officiels** (reçus de Skander, jamais commités) : guide de télédéclaration DGI, CNSS
  DS 2012 (122 caractères) et ancien format, régime complémentaire (`Desc_Sal_Rc`), I16, mensuelle
  2026, DEC-EMPL 2025 (formulaire papier), IS 2025, puis le cahier des charges du fichier de la
  déclaration d'employeur (`EMPCCA_25V3.pdf`, pour D3) et une liasse fiscale (`Liasse_fiscale-CCT-OPCVM`,
  à lire pour D4 : son nom la dit propre aux OPCVM — vérifier qu'elle vaut pour une société ordinaire
  avant de s'en servir).
- ~~**D2 — la CNSS trimestrielle**~~ **Fait (26/09) : le fichier texte CNSS**, au format DS 2012
  (122 caractères, 12 lignes par page, salaires en millimes, CRLF, nom `DS` + employeur + code +
  `.` + trimestre + année), dans les DEUX applications, par UN moteur (`compta.fichierCnss`) : Cabinet
  → Paie (matricule et code d'exploitation sur la fiche du dossier), app entreprise → Paie →
  Déclarations (Paramètres → Identité). Aucun fichier tant qu'une ligne est fausse ; chaque refus
  nomme le salarié, la case et le geste ; un trimestre EN COURS ne se déclare pas ; l'identité et la
  CIN se complètent sur la fiche (« Compléter sa fiche… »), et ce que le fichier refuserait se refuse
  déjà à la saisie. Testé à la souris des deux côtés, fichiers relus octet par octet. **Reste** : le
  pointage déposée / payée de la CNSS dans le Cabinet (l'app entreprise l'a), et un écran à elle dans
  « Déclarer et clôturer » — elle vit encore dans l'onglet Paie. **À VÉRIFIER** sur le portail : la
  CIN vide, l'identité (nom de jeune fille), le code d'exploitation.
- **D3 — la déclaration d'employeur** sort de la Liasse : son propre écran, état NOMINATIF lu dans les
  bulletins du livre (salaires) et dans les retenues opérées par fournisseur, phrase fausse corrigée,
  pointage, export ; les fichiers DECEMP_/ANXEMP_ seulement sur le cahier de l'année, versionné.
- **D4 — la liasse en XML** : seulement sur spécification officielle lue ; sinon reporté, avec la
  raison. TCL et acomptes provisionnels : ne rien inventer (9.1.1) — l'acompte peut se CALCULER si
  l'impôt de l'exercice précédent est dans le livre (fiscal annuel de N-1), à vérifier.
- **Côté app entreprise** : ses déclarations sociales (Paie → Déclarations) ont le même « à recopier » ;
  même traitement pour la CNSS, et le lien vers le portail.

### 0.2 Ce que Skander a demandé le 26/09/2026 (à faire, dans cet ordre de gravité)

1. ~~**Mises à jour : en bêta, une stable plus récente doit être proposée.** Sur une 13.0.0-beta.1
   avec « Recevoir les versions bêta » coché, une 14.0.0 stable n'apparaît pas : il faut décocher
   la case pour la voir. Le canal bêta doit prendre la plus récente des deux (bêta ou stable), dans
   les DEUX applications (`beta` et `cabinet-beta`) — relais, repli GitHub et `canalDe` compris.~~
   **Fait (S-01, § 0.1)** — en ligne quand le relais sera déployé avec la stable.
2. ~~**La visite guidée passe parfois toute seule à l'étape suivante** sans qu'on ait appuyé sur
   « Suivant ».~~ **Fait (S-02, § 0.1).**
3. ~~**Quand la visite montre un bouton ou parle d'une action, on doit pouvoir CLIQUER dessus** pour
   la découvrir — pas le voir assombri derrière le voile.~~ **Fait (S-02, § 0.1).**
4. ~~**Remplacer « Comprendre cette page » par « Guide-moi »** : une liste de TOUTES les actions qu'on
   peut faire sur la page, chacune lançant sa visite ou son geste guidé — l'assistant toujours à
   portée de main.~~ **Fait (S-03, § 0.1)** — les pages qui n'ont encore aucun geste guidé sont
   listées au § 0.1 : c'est la suite de S-02.
5. **Les textes des visites et de l'assistant doivent être beaucoup plus explicatifs**, surtout sur
   les ACTIONS : ce que fait le bouton, quand s'en servir, ce qui se passe après. Et améliorer
   « Première fois sur cette page ». Beaucoup de défauts UI/UX et d'ergonomie dans la page
   « Me guider », l'assistant et la visite : tout reprendre, les deux applications.
6. ~~**Pièces jointes** : une pièce jointe se RETROUVE par la recherche (son nom de fichier, Ctrl K et
   les listes), et **chaque ligne qui a un justificatif le montre** (📎 sur les factures, devis,
   achats, dépenses, mouvements, écritures) — c'est la preuve qui part au comptable.~~ **Fait (S-04,
   § 0.1).**
7. ~~**Une facture à échéance 0** (échéance = date) : l'aperçu montre deux cadres avec la même date.
   N'en garder qu'un (« À réception »). Signalé une première fois, pas réglé.~~ **Fait (S-05,
   § 0.1).**
8. ~~**Un chargement visible au lieu d'une page blanche** quand un calcul est long.~~ **Fait (S-06,
   § 0.1)** — la navigation ; une FENÊTRE qui calcule longtemps à l'ouverture n'a pas encore le sien.
9. ~~**Une transition visible entre deux pages.**~~ **Fait (S-06, § 0.1).**
10. ~~**À chaque nouvelle version, au premier lancement : présenter la version et ses changements.**~~
    **Fait (S-06, § 0.1)** — à chaque version, écrire ses phrases dans `src/renderer/nouveautes.js`.

11. **Un arrêt maladie ou une absence porte son justificatif** (Skander, 26/09) : vérifié dans le code,
    la fenêtre « Congé ou absence » (`leaveForm`) n'a aucune pièce jointe. Un arrêt de travail est
    la preuve de l'absence payée ou retenue — c'est lui que le comptable et la CNSS demandent. Poser
    le mécanisme des pièces jointes (celui des achats, 8.5.1 : joindre AVANT d'enregistrer, 📎 dans la
    liste des absences, retrouvable par la recherche comme les autres, S-04), la bulle, la ligne de la
    visite « conge », et le rappel dans « À faire » d'un arrêt maladie sans justificatif — sans jamais
    bloquer l'enregistrement (le certificat arrive souvent après).

Puis continuer les tests et les corrections, sans s'arrêter tant que les deux applications ont des
défauts.

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
- ~~**L'éditeur d'une proforma ou d'un bon de livraison tient sa barre sur deux rangées à 1440 px**~~ —
  **fait en 10.14.0** : Transformer et Email vont dans « Plus ▾ » quand ils ne sont pas l'étape suivante. Avant :
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

*Les cinq constats restés hors de la 10.6.0 sont faits en 10.14.0 :* ~~la vue Cabinets sans colonne
Actions~~ (les gestes d'une licence, par la même fonction que la vue Licences) ; ~~le Parc qui
déborde à 1440 px~~ (les titres de chiffres se plient) ; ~~le bouton « ⋯ »~~ (« Plus ▾ ») ; ~~les
bords gauches irréguliers des Réglages~~ (une colonne de champs commune) ; ~~la date de vente
absente~~ (« Vendue le », en tête).

## 4. Les applications

- **L'audit UI/UX du Cabinet est fait et corrigé** (23/09/2026) : ses trente constats (U-01 à
  U-30) et ce que leur vérification à la souris a trouvé en plus sont livrés en **10.12.0 (bêta)** —
  détail dans `CHANGELOG.md` et `CLAUDE.md` § 10.12.0. Reste à le faire relire par le cabinet pilote.
- **Le test humain de l'app entreprise** (23/09/2026, en chef d'entreprise qui fait son premier
  devis, sa première facture, puis son premier achat) a livré ses corrections en 10.12.0 (H-E1 →
  H-E28). Ce qu'il a vu
  et qui reste à décider ou à faire :
  - ~~**Un trop-perçu ne se rembourse pas dans SkanFact.**~~ — **fait en 10.14.0** : « Rembourser …
    au client » sur la facture (un règlement négatif : la Trésorerie voit la sortie, l'écriture passe
    D client / C banque), et la fiche, la liste et le relevé du client donnent le reste NET. Reste :
    rembourser un AVOIR LIBRE (non rattaché à une facture) — il compte dans le net, mais aucun geste
    ne le rend encore.
  - ~~Les champs de montant suivent la langue du SYSTÈME~~ — **fait en 10.12.0 (H-E28)**, et c'était
    pire qu'un affichage : sur un poste en anglais, « 2,5 » tapé devenait 25. L'application pose sa
    langue (`--lang fr-FR`) avant de démarrer. Reste, si un jour on le veut : les espaces de milliers
    DANS un champ (« 1 250,500 »), que le Cabinet sait lire (H-3) et qu'un `type=number` refuse.
  - ~~**Toutes les questions s'intitulent « Confirmation »**~~ — **fait en 10.14.0** : le titre se
    tire de la première phrase quand c'est une question, sinon du geste du bouton (sauf un geste
    générique), et dix-sept avertissements portent un titre écrit (`opts.titre`).
  - ~~**Une facture qu'on vient d'émettre se dit « envoyée »**~~ — **fait en 10.14.0** : « émise » à
    l'affichage (`statusLabel(s, type)`), la valeur `envoyée` reste ; la proforma garde « envoyée ».
    Avant :, avant tout envoi : c'est le nom du
    statut déduit depuis la 1.4.0 (la bulle le dit), mais un créateur d'entreprise qui n'a rien
    envoyé le lit comme une erreur. Changer le mot touche les données (la valeur `envoyée`), les
    filtres, les relances et l'aide : à décider (« émise » ?), pas à glisser dans un correctif.
  - ~~**Une pièce tirée d'une autre s'ouvre marquée « Modifications non enregistrées »**~~ — **vérifié en
    10.14.0** : plus le cas par aucun des deux chemins ; restait la phrase de l'onglet vide, corrigée. Avant : alors qu'elle
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
- ~~**Porter `typographie()` du Cabinet à la prose de l'app entreprise**~~ — *fait en 10.14.0* : un
  observateur pose l'espace fine insécable sur toute la prose au moment où elle est posée (pages,
  fenêtres, bulles, annonces), jamais dans un `textarea`, une `option` ou un code. Aucun parcours e2e
  ne comparait une ponctuation double brute (vérifié par recherche) ; à confirmer au prochain lot e2e.
- **Saturation (10.14.0), ce qui reste** : ~~un compte du grand livre ouvert affiche TOUTES ses lignes~~
  (fait : 300 lignes, puis la suite à la demande) ; les onglets Comptabilité ›
  Écritures et Cabinet de l'app entreprise mettent ~1,3 s par clic sur huit mille pièces
  (à-nouveaux et balance lus depuis le début de l'exercice, 10.0.1) — **mesuré le 25/09** : 0,5 s
  de calcul à l'année, dont 0,4 s d'à-nouveaux, immédiat au mois ; un cache entre deux clics
  demanderait une invalidation à chaque enregistrement, et une invalidation oubliée montrerait un
  chiffre périmé : non fait, c'est le prix d'un chiffre juste (10.0.1) ; ~~à 1280 px, la liste des
  clients déborde encore d'une quarantaine de pixels quand les montants dépassent cent millions~~
  (fait : le matricule se coupe après ses « / ») ; la Déclaration employeur et le Registre du personnel restent d'un seul tenant (ce sont des
  documents imprimés, pas des listes).
- **La vérité comptable (10.14.0), ce qui reste** :
  - **Où en est le tour à la souris (25/09/2026)** : dans l'app entreprise, tous les onglets de la
    Comptabilité ont été relus chiffre par chiffre sur l'exemple de cinq ans, avec des paiements, une
    OD et des retenues posés à la main — Ventes, Achats, TVA à payer, Écritures, Grand livre,
    Balance (générale, deux auxiliaires, lettrage : 411 à 5 209,811 et 401 à 3 211,051 sur les
    quatre écrans), États financiers (actif = passif = 127 581,008 ; dotation en attente = l'année
    moins ce que la cession a déjà écrit), Calendrier fiscal, Clôtures, Cabinet. Reste à faire le
    même tour dans le **Cabinet** sur un dossier qui reçoit ces paquets : la CNSS d'un trimestre en
    retard (le Cabinet la réclame-t-il comme le calendrier de l'app entreprise ?), et les derniers
    lots (retenue subie au règlement, régularisation d'un avoir) relus sur son livre.
  - **Le compte d'attente se voit au bilan, pas dans « À faire »** : un mouvement « Autre entrée /
    sortie » ou un virement sans compte va au 471 (« à ventiler par le comptable ») — c'est écrit
    dans sa bulle, et le 471 paraît au bilan (120 DT sur l'exemple). Rien ne le rappelle avant la
    clôture ; à décider : une ligne des contrôles de clôture « n mouvements au compte d'attente ».
  - **L'app entreprise ne dit pas qu'une TVA « déclarée » a changé depuis.** Le Cabinet compare
    désormais la déclaration préparée au livre et refuse de pointer un dépôt périmé ; dans l'app
    entreprise, « Marquer déclarée » (calendrier fiscal) est un pense-bête sans copie des chiffres,
    et une facture saisie ensuite dans le mois — s'il n'est pas clôturé — change la TVA sans un mot.
    La clôture (6.0.0) est la parade, et « À faire » la réclame à dix jours ; à décider : garder les
    chiffres au pointage, comme le Cabinet, pour pouvoir dire « déclarée avec d'autres chiffres ».
  - **Les paquets fabriqués avant la 10.14.0 n'ont pas de sceau** : SkanFact ne peut pas dire s'ils
    sont devenus faux avec les corrections de cette version (TVA non récupérable, stock au bilan,
    solde remisé, février). Le CHANGELOG demande de les refaire ; à dire aussi, de vive voix, au
    cabinet pilote et à Skander pour ses propres mois déjà envoyés.
  - **La prévision de trésorerie ne compte pas l'argent dû à un client** (un trop-perçu pas encore
    rendu, un avoir libre) : elle ne projette que les échéances engagées, et ces dettes n'ont pas de
    date. À décider : les montrer en bas de la courbe, sans date, plutôt que les taire.
  - **Le Cabinet numérote ses propres pièces** dans un livre créé depuis les paquets (le numéro naît
    à la validation, 9.2.0) : l'INVENTAIRE-2025, n° 272 chez le client, y prend le numéro de sa
    validation au Cabinet. C'est voulu (le livre-journal officiel est celui du comptable), mais la
    référence de pièce reste le seul identifiant commun — à dire dans l'Aide du Cabinet si le pilote
    s'y trompe.
  - **Une « Échéance d'emprunt » saisie en un seul mouvement va entière au 164** (le capital) :
    ses intérêts n'entrent donc dans aucune charge tant qu'on ne les saisit pas à part (un second
    mouvement, contrepartie 651). À VÉRIFIER avec le comptable pilote : proposer, dans la fenêtre du
    mouvement, de ventiler capital et intérêts — le tableau d'amortissement de la banque les donne.
  - **La prévision de trésorerie ne chiffre pas les impôts et la CNSS à payer** : elle compte
    désormais les salaires dus et tout ce qui est saisi pour plus tard, mais la TVA du mois
    écoulé, l'IRPP retenu et la CNSS du trimestre ne sont listés sous la courbe que par leur date.
    Leur montant est pourtant connu (les soldes du 4365/4367, 4321, 4531 à ce jour, ou `vatChain` et
    `cnssDeclaration`) : à projeter à leur échéance du calendrier fiscal — qui reste un pense-bête
    « À VÉRIFIER » —, une seule fois, et plus du tout une fois le mouvement de paiement saisi.
  - **Un salaire payé sans bulletin va au 640 en entier** : SkanFact ne sait pas quelle part est le
    net, le CNSS salarié ou l'IRPP retenu. À VÉRIFIER : un comptable voudra peut-être le 471, pour le
    ventiler lui-même — la contrepartie se choisit déjà à la main, dans la fenêtre du mouvement.
  - **L'écart de change d'un RÈGLEMENT n'est pas écrit.** Un paiement d'une facture en euros se
    convertit au taux de la facture : la banque reçoit en réalité le taux du jour, et la différence
    (gain ou perte de change, 755/655) n'apparaît nulle part — le solde de la banque du grand livre
    peut différer du relevé de quelques dinars. Ce qui est réglé en 10.14.0 : un avoir ou un acompte
    à un autre taux que sa pièce. Pour un règlement, il faudrait saisir le montant reçu en dinars à
    côté du montant en devise. À VÉRIFIER avec le comptable pilote : le taux retenu (celui du jour du
    règlement, de la banque) et le geste attendu.
  - **Un avoir LIBRE ne peut pas être remboursé depuis SkanFact** : seul un règlement sur une facture
    se saisit en négatif (le trop-perçu, 10.14.0). Un avoir libre — de l'argent dû au client — ne
    naît plus que d'un import ou d'une pièce d'avant ; il se rattache à une facture, ou se rembourse
    par un mouvement de trésorerie à la main (qui ne le lettrera pas). À décider : un geste
    « Rembourser cet avoir… » sur la pièce.
  - **Un avoir libre reprend le taux de retenue à la source du client** : sur un avoir qui ne
    corrige aucune facture, la retenue a-t-elle un sens ? À VÉRIFIER avec le comptable.
  - **Une fenêtre qui date une saisie dans un mois clôturé la refuse à l'ENREGISTREMENT** (paiement,
    mouvement, congé…) : l'éditeur de pièce le dit avant qu'on tape depuis la 10.14.0, les fenêtres
    pas encore. La saisie tient en quelques champs, mais la règle 9.4.2 vaut aussi pour elles : dire
    la clôture sous le champ date, pendant la frappe.
  - **Un stock négatif se valorise au dernier coût connu, en négatif** (une vente saisie avant son
    achat) : le bilan porte alors un 37 négatif jusqu'à l'achat qui le comble. C'est le signal
    « pièce manquante » de la 4.0.0 ; un comptable voudra peut-être le ramener à zéro au bilan.
    À VÉRIFIER.
  - **La liasse : le 18 (comptes de liaison) n'a pas de rubrique, exprès** — un solde y est une
    anomalie, que la liasse montre en orphelin. À confirmer par le cabinet pilote, avec la première
    liasse réelle.
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
  - ~~**les champs sans bulle hors du premier jour**~~ — *fait en 10.14.0* : 118 champs (libellés
    nus, dates, listes de choix, libellés en expression), et le test lit désormais tout `app.js`
    avec des exceptions nommées. Restent, notés au passage :
    - **l'avance à un salarié n'entre ni en trésorerie ni en écritures** : la bulle le dit, le moteur
      ne la sort pas du compte — à décider (quel compte, 425 ?) avec le comptable. À VÉRIFIER ;
    - **le numéro de pièce d'une OD se modifie librement** et peut doubler un numéro existant : rien
      ne le refuse. À ajouter à `odValide` (refus nommé) ;
    - **le Cabinet** n'a pas de test statique équivalent (seul `e2e:cabinet-jour1` mesure les champs
      sans bulle, à l'écran).
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
- **Le paiement dans l'application** — l'ACHAT est fait en 10.14.0 (Paramètres → Licence : offres
  et prix lus sur le serveur, page de paiement préremplie, clé récupérée toute seule par le jeton que
  la commande a rendu une fois). Reste :
  - **le renouvellement en ligne** : une licence payée en cours ne se rachète pas en ligne (elle
    repartirait d'aujourd'hui et perdrait les jours payés, règle 7.33.0), donc il passe encore par
    le mail. Il demande un départ côté serveur (`depuis` = la fin de la licence en cours, PROUVÉE par
    la clé présentée) et une colonne D1 de plus — un `ALTER TABLE` à passer à la main.
  - **la décision de Skander** : une licence achetée pendant l'essai démarre-t-elle au paiement (ce
    que fait le code aujourd'hui) ou à la fin de l'essai ?
  - ~~le remboursement d'un trop-perçu, avec le « reste à payer » net~~ — fait en 10.14.0.
  - **avant de publier la 10.14.0-beta.1 : déployer le worker de `beta`** (Actions → Worker → Run
    workflow, branche `beta`). Le worker en service ne connaît ni `/v1/achat/cle` ni le jeton : une
    commande passée depuis l'application y resterait « en attente » (l'écran dit « hors ligne »,
    rien n'est perdu, la clé arrive par mail) — mais le geste neuf ne servirait à rien.
- **Ne jamais se perdre** : ~~les 78 titres « Confirmation »~~ (fait en 10.14.0), ~~« émise » au lieu
  de « envoyée »~~ (fait), ~~H-E30, les barres qui passent sur deux rangées~~ (faits), et les restes de la console (§ 3).
- **Les tests humains mis en pause** le 24/09 pour la visite : l'app entreprise (~~achats~~ — repris le
  25/09 : le reste dû ignorait les avoirs imputés, corrigé —, stock, biens,
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
