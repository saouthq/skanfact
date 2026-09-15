# SkanFact — Le projet expliqué de A à Z, en questions et réponses

*Écrit le 15/09/2026 pour Skander, et pour toute personne qui découvre le projet sans en connaître
ni le métier ni la technique. Ce document est le repère : le jour où l'on ne sait plus où l'on va,
c'est ici qu'on revient. Il complète `DIRECTION.md` (les décisions) et `PLAN-COMPTABLE.md` (les
versions à construire) ; quand ils se contredisent, `DIRECTION.md` fait foi. Son ambition : qu'aucune
question ne surgisse pendant le développement sans avoir sa réponse ici.*

*Chaque réponse porte une marque :*
- ***Décidé*** *: on ne rediscute pas.*
- ***Livré*** *: ça existe déjà dans l'application, on peut le voir.*
- ***À construire*** *: décidé, décrit, pas encore écrit.*
- ***À toi*** *: une décision qui appartient à Skander, avec ma recommandation.*
- ***À VÉRIFIER*** *: un comptable ou le marché doit répondre avant que ce soit sûr.*
- ***À VALIDER JURIDIQUEMENT*** *: une affirmation de droit ou de déontologie, qui attend un juriste
  ou l'Ordre. On ne la transforme jamais en règle du logiciel avant la réponse.*

*La règle d'usage, puisqu'une relecture a trouvé le mélange confus : une marque se pose sur ce qui
est une DÉCISION ou un PLAN (un choix, un prix, une version, une règle). Une description de ce qui
existe (« une facture en euros ? oui ») ou une définition n'en porte pas — elle se vérifie dans
l'application, pas dans ce document. Une réponse sans marque n'est donc pas un oubli : c'est un
fait.*

---

## Sommaire

1. [Le projet en dix questions](#1-le-projet-en-dix-questions)
2. [Les mots du projet](#2-les-mots-du-projet)
3. [Le but et le positionnement](#3-le-but-et-le-positionnement) — *dont [où on en est
   vraiment](#où-on-en-est-vraiment-au-15092026) (zéro client payant, les chiffres du marché
   sourcés) et [les jalons de décision](#les-jalons-de-décision) (ce qui doit être vrai chaque
   trimestre pour continuer à construire)*
4. [L'application entreprise, SkanFact](#4-lapplication-entreprise-skanfact)
5. [L'application du comptable, SkanFact Cabinet](#5-lapplication-du-comptable-skanfact-cabinet)
6. [Le pont entre les deux](#6-le-pont-entre-les-deux)
7. [Le modèle économique](#7-le-modèle-économique)
8. [La licence et la plateforme](#8-la-licence-et-la-plateforme)
9. [Le quotidien : installer, vendre, dépanner](#9-le-quotidien--installer-vendre-dépanner)
10. [La technique du projet](#10-la-technique-du-projet)
11. [Les données, la sécurité, la loi](#11-les-données-la-sécurité-la-loi)
12. [La construction : comment on travaille](#12-la-construction--comment-on-travaille)
13. [La bêta : comment on s'en sert](#13-la-bêta--comment-on-sen-sert)
14. [Entretenir l'application quand il y a beaucoup d'utilisateurs](#14-entretenir-lapplication-quand-il-y-a-beaucoup-dutilisateurs)
15. [Ce que font les développeurs seniors, et ce qui nous manque encore](#15-ce-que-font-les-développeurs-seniors-et-ce-qui-nous-manque-encore)
16. [Les versions à venir, une par une](#16-les-versions-à-venir-une-par-une)
17. [Les risques, et ce qui les couvre](#17-les-risques-et-ce-qui-les-couvre)
18. [Quand je suis perdu : où trouver quoi](#18-quand-je-suis-perdu--où-trouver-quoi)
19. [Les décisions à ne pas rediscuter](#19-les-décisions-à-ne-pas-rediscuter)
20. [Ce qui reste à décider](#20-ce-qui-reste-à-décider)

---

## 1. Le projet en dix questions

- **C'est quoi, SkanFact ?** Deux logiciels qui s'installent sur un ordinateur (Mac ou Windows) et
  qui travaillent sans Internet. Le premier, **SkanFact**, sert à une petite entreprise tunisienne
  pour faire ses devis, ses factures, suivre ses achats, sa trésorerie, son stock, ses salariés. Le
  second, **SkanFact Cabinet**, sert à son expert-comptable pour recevoir tout ça chaque mois et
  tenir la comptabilité de ses clients.
- **Qui l'a fait ?** Skander Ben Amor, qui dirige SKANCYBER SECURITY SUARL, l'a conçu pour sa propre
  entreprise avec l'aide de Claude (une intelligence artificielle qui écrit et teste le code). Il
  est devenu un produit à vendre, et c'est SKANCYBER SECURITY SUARL qui le vend.
- **À qui ça s'adresse ?** Aux petites entreprises tunisiennes (indépendants, professions
  libérales, SUARL, petites SARL) et aux cabinets d'expertise comptable qui tiennent leurs livres.
- **Quel problème ça règle ?** Aujourd'hui, un chef de petite entreprise fait ses factures sur Word
  ou Excel, envoie un carton de pièces à son comptable chaque mois, et le comptable ressaisit tout
  dans son logiciel. SkanFact fait que les pièces sont propres dès le départ, et que le comptable
  les reçoit **déjà écrites en comptabilité**, avec les justificatifs, sans rien ressaisir.
- **Ça coûte combien ?** L'entreprise paie une licence annuelle (390 ou 690 DT hors taxes par an,
  après 30 jours d'essai). Le cabinet ne paie rien pour ses clients qui sont sur SkanFact, et paie
  par dossier pour les clients qui n'y sont pas, au-delà de trois dossiers gratuits.
- **Il faut Internet ?** Non, jamais pour travailler. Internet ne sert qu'à recevoir les mises à jour
  et, un jour, à acheter la licence. Si Internet tombe ou si l'éditeur disparaît, le logiciel
  continue de fonctionner.
- **Où sont mes données ?** Sur ton ordinateur, dans un fichier. Nulle part ailleurs. Rien n'est
  envoyé sur un serveur, jamais.
- **Comment les deux logiciels se parlent ?** Par un **paquet mensuel** : un fichier chiffré que
  l'entreprise fabrique en un clic et envoie à son comptable par mail, WhatsApp ou clé USB. Le
  comptable l'ouvre dans son application, et tout est là.
- **Où en est-on ?** L'application entreprise est complète (version 9.0.0, quinze modules). Le
  Cabinet reçoit les paquets, vérifie, relance, exporte, mais **ne tient pas encore de
  comptabilité** : c'est le chantier qui commence (versions 9.1.0 à 10.0.0, § 16).
- **Qu'est-ce qui rend SkanFact différent ?** Aucun logiciel de comptabilité ne reçoit les écritures
  de ses clients déjà écrites, avec les pièces, vérifiées, hors ligne, et ne permet de poser une
  question au client **sur la ligne** concernée. Les concurrents ont soit la comptabilité (Sage,
  EBP), soit la collaboration en ligne (Pennylane), jamais les deux sans serveur.

---

## 2. Les mots du projet

*Le métier d'abord, la technique ensuite. Chaque mot est utilisé dans les réponses qui suivent.*

### Le métier

- **Pièce** : un document qui a une valeur comptable ou commerciale — devis, facture, avoir, bon de
  livraison, facture d'achat, bulletin de paie.
- **Facture émise** : une facture qui a reçu son numéro officiel (FAC-2026-012). À partir de là elle
  ne se modifie plus jamais ; une erreur se corrige par un **avoir** (une facture négative qui
  annule tout ou partie de la première).
- **Brouillon** : une facture pas encore émise, sans numéro, modifiable à volonté.
- **Matricule fiscal** : l'identifiant d'une entreprise en Tunisie (sept chiffres, une lettre-clé,
  puis un code TVA et des suffixes, par exemple 1234567A/M/000). C'est lui qui identifie un dossier,
  jamais le nom : un nom change de forme juridique, se corrige, et deux entreprises peuvent
  s'appeler pareil.
- **TVA** : la taxe sur la valeur ajoutée. En Tunisie : 0, 7, 13 ou 19 %. La TVA **collectée** est
  celle qu'on facture aux clients ; la TVA **déductible** est celle qu'on a payée aux fournisseurs ;
  on déclare et on paie la différence chaque mois. Le **crédit de TVA** est ce qui reste quand la
  déductible dépasse la collectée : il se reporte au mois suivant.
- **Timbre fiscal** : 1 dinar ajouté sur chaque facture (usage tunisien courant, pas une règle que
  je peux énoncer). Son montant est réglable,
  il se fige sur la pièce à l'émission, et il se décoche par document. **Deux points restent
  À VÉRIFIER** : les cas d'exonération, et ce qu'on met sur une facture en devise (aujourd'hui
  l'application convertit le dinar dans la devise de la facture — c'est cohérent avec le total,
  mais la règle fiscale exacte n'a jamais été confirmée).
- **Retenue à la source (RS)** : une partie du montant d'une facture que le client garde et verse
  directement à l'État à la place du fournisseur. Le fournisseur reçoit une **attestation de
  retenue** qui lui sert de justificatif. **Le taux dépend de la NATURE de l'opération** (honoraires,
  loyers, commissions, marchés…), pas du client ni du fournisseur : l'application en propose onze
  depuis la 8.3.0 et accepte n'importe quel autre, parce qu'une liste fermée finit toujours par
  enfermer quelqu'un — c'est le frère de Skander qui l'a montré en une phrase (« leur retenue est de
  1 % alors que sur l'app ça commence à 1,5 »). **À VÉRIFIER avec le comptable : la correspondance
  exacte entre nature d'opération et taux**, et les deux points ouverts du § 11 (le seuil en dessous
  duquel elle ne s'applique pas, et l'assiette).
- **Régime fiscal** : réel (on facture la TVA), forfaitaire ou exonéré (on ne la facture pas, avec
  une mention légale à la place). C'est le régime qui décide de la TVA, pas le métier. La liste des
  régimes est **ouverte** : si un cas réel ne rentre dans aucun des trois — par exemple une
  entreprise au réel non assujettie —, on ajoute une entrée à la liste avec sa mention, sans rien
  restructurer. **À VÉRIFIER avec le comptable : la liste des trois couvre-t-elle ses clients ?**
- **CNSS** : la caisse de sécurité sociale. Part salarié 9,18 %, part employeur 16,57 % — ce sont les
  taux du **régime général**, et il en existe d'autres (agriculture, régimes particuliers) que
  l'application ne propose pas : elle les accepte, puisque tout est réglable, mais elle ne les
  suggère pas. **À VÉRIFIER chaque année, et à VÉRIFIER une fois : les clients du cabinet pilote
  sont-ils tous au régime général ?** **IRPP** : l'impôt sur le revenu, retenu sur le salaire par
  barème progressif. **TFP** et **FOPROLOS** : deux taxes patronales sur les salaires (2 % et 1 % par
  défaut) — la TFP serait à 1 % pour l'industrie manufacturière, et l'application ne le propose pas
  encore alors qu'elle connaît le métier (§ 11, corrigé en 9.1.1). **À VÉRIFIER.**
- **Écriture comptable** : la traduction d'une pièce en lignes « débit / crédit » sur des comptes.
  Une facture de 1 190 DT TTC donne : débit 411 (client) 1 190 ; crédit 70 (ventes) 1 000 ; crédit
  4367 (TVA collectée) 190. Le total des débits est toujours égal au total des crédits : c'est la
  **partie double**. Une écriture porte une **pièce** (la référence du document) et un **numéro**
  dans le journal.
- **Compte** : une case numérotée du **plan comptable**. En Tunisie le plan suit le SCE (Système
  comptable des entreprises, 1996) : classe 1 capitaux, 2 immobilisations, 3 stocks, 4 tiers et
  État, 5 banque et caisse, 6 charges, 7 produits. Un **compte auxiliaire** (411001, 411002…) est
  un sous-compte par client ou par fournisseur.
- **Journal** : la liste des écritures dans l'ordre, numérotées sans trou. Les journaux sont VT
  (ventes), AC (achats), BQ (banque), CA (caisse), PAIE, OD (opérations diverses), AN (à-nouveaux).
  Le **centralisateur** totalise chaque journal par mois.
- **Grand livre** : les écritures rangées **par compte**, avec le solde qui avance ligne après ligne.
  C'est le « mouvement de compte » dont parle le comptable.
- **Balance** : un tableau avec une ligne par compte : solde d'ouverture, total débit, total crédit,
  solde final. Elle « tombe juste » quand ses totaux sont égaux. La **balance auxiliaire** ne montre
  que les clients (ou les fournisseurs). La **balance âgée** dit depuis combien de temps chaque
  somme est due.
- **Lettrage** : rapprocher une facture et son paiement pour dire « celle-ci est soldée ». Ce qui
  reste non lettré, c'est ce que les clients doivent encore, et ce qu'on doit aux fournisseurs.
- **Rapprochement bancaire** : comparer le relevé de la banque avec ce que la comptabilité dit du
  compte, ligne par ligne, et expliquer chaque écart (un chèque pas encore encaissé, des frais
  oubliés). L'**état de rapprochement** est le document qui le formalise.
- **OD (opération diverse)** : une écriture saisie à la main, qui ne vient d'aucune pièce (une
  régularisation, un loyer sans facture, une correction).
- **Clôture** : verrouiller une période. Côté entreprise, on clôture un **mois** (plus rien ne
  bouge dans ce mois, le paquet devient définitif). Côté cabinet, on clôture un **exercice**
  (l'année) après les écritures d'inventaire.
- **Écritures d'inventaire** : celles de fin d'année qui ajustent la réalité — **notamment** les
  dotations aux amortissements, les provisions (une perte probable), les charges constatées d'avance
  (un loyer payé en décembre pour janvier), les factures non parvenues (une charge de décembre
  facturée en janvier), les produits constatés d'avance, les factures à établir, la variation des
  stocks, les écarts de conversion sur les dettes et créances en devise. La liste n'est pas
  exhaustive : c'est le comptable qui sait lesquelles s'appliquent à un dossier.
- **À-nouveau** : l'écriture du 1er janvier qui reporte les soldes de l'année passée (la banque, les
  dettes, les créances) et met le résultat de l'année dans un compte de réserve ou de report.
- **Amortissement** : étaler le coût d'un bien (un ordinateur, une voiture) sur plusieurs années. La
  **dotation** est la part de l'année. **Linéaire** : la même part chaque année ; **dégressif** :
  plus au début, moins à la fin. La **VNC** (valeur nette comptable) est ce qui reste à amortir.
- **États financiers** : le bilan (ce qu'on possède et ce qu'on doit à une date), l'état de résultat
  (ce qu'on a gagné ou perdu sur l'année), l'état de flux de trésorerie, et les notes. La **liasse
  fiscale** est la version officielle déposée à l'administration avec la déclaration annuelle.
- **Brouillard / validation** : dans un logiciel de tenue, une écriture saisie est d'abord en
  brouillard (modifiable). Une fois **validée**, elle ne se modifie plus jamais ; on la
  **contre-passe** (on écrit l'inverse) pour l'annuler. C'est une obligation légale, et la première
  chose qu'un comptable vérifie.
- **Extourne** : contre-passer automatiquement au 1er du mois suivant une écriture d'ajustement
  (une facture non parvenue, par exemple).
- **Guide d'écriture** : un modèle (« loyer », « salaires », « achat avec TVA ») qui prépare les
  lignes ; un **abonnement** est un guide qui se rejoue chaque mois.
- **Révision** : le travail du comptable qui vérifie compte par compte qu'un dossier est juste avant
  de produire les états : un **dossier de travail** par exercice, des **feuilles maîtresses** par
  cycle (trésorerie, ventes, achats, personnel, immobilisations, fiscal), des **points en suspens**
  à demander au client.
- **Déclaration mensuelle** : le formulaire mensuel tunisien qui regroupe la TVA, les retenues à la
  source, la TFP, le FOPROLOS, la TCL (taxe sur les établissements) et le droit de timbre.
  **Acomptes provisionnels** : trois versements dans l'année sur l'impôt sur les sociétés.
- **Ordre** : l'Ordre des experts-comptables de Tunisie, qui fixe les règles de déontologie.
- **INPDP** : l'autorité tunisienne de protection des données personnelles.
- **TTN / El Fatoora** : la facture électronique tunisienne, obligatoire pour certaines entreprises
  (À VÉRIFIER pour les clients de SkanFact).

### La technique

- **Application de bureau** : un programme installé sur l'ordinateur, pas un site web. Les deux
  applications sont construites avec **Electron** (un navigateur embarqué qui affiche l'interface)
  et **JavaScript** (le langage), sans aucun outil de compilation : le code qu'on lit est celui qui
  tourne.
- **Dépôt** (ou *repo*) : l'endroit où vit le code, sur GitHub (`saouthq/skanfact`). Il est
  **public** depuis le 13/09/2026, pour que les publications soient gratuites. Il contient les
  DEUX applications, la plateforme et le relais.
- **Version** : un numéro comme 9.0.0. Le premier chiffre change pour un gros changement, le
  deuxième pour une fonctionnalité, le troisième pour une correction. Les deux applications
  partagent le même numéro et sortent ensemble.
- **Release** (publication) : une version mise à disposition sur GitHub avec ses installateurs
  (`.dmg` et `.zip` pour Mac, `.exe` pour Windows, pour chacune des deux applications), fabriqués
  automatiquement par **GitHub Actions** (des machines louées qui construisent le logiciel).
- **Mise à jour automatique** : l'application vérifie toutes les quatre heures s'il existe une
  version plus récente, la télécharge et propose de l'installer.
- **Canal** : la file de mises à jour qu'une application suit : `latest` (stable, entreprise),
  `beta` (préversions, pour qui a coché la case), `cabinet` (l'app du comptable).
- **Relais de mise à jour** : un petit programme sur **Cloudflare** (un hébergeur, gratuit à notre
  échelle) qui sert les fichiers de mise à jour aux applications. Il permettra de remettre le dépôt
  en privé sans casser les mises à jour.
- **Plateforme** (ou plan de contrôle, `api.skanfact.tn`) : un second programme sur Cloudflare qui
  gère les licences : émettre, révoquer, renouveler, voir qui a activé quoi. Sa base de données
  s'appelle **D1**. Sa page d'administration est la **console**.
- **Worker** : le nom que Cloudflare donne à un tel programme. On en a deux : `skanfact-maj` (le
  relais) et `skanfact-api` (la plateforme).
- **Clé de licence** : une longue chaîne de caractères (`SKAN1.…`) qui prouve qu'une entreprise a
  payé. Elle est **signée** : on ne peut pas la fabriquer sans la clé privée de l'éditeur.
- **Signature, clé privée, clé publique** : le mécanisme (Ed25519) qui permet à l'éditeur de
  prouver qu'il est l'auteur d'une licence. La **clé privée** signe ; elle est secrète et vit sur
  le Mac de Skander. La **clé publique** vérifie ; elle est embarquée dans l'application, et
  n'importe qui peut l'avoir, ça ne sert qu'à vérifier, jamais à fabriquer.
- **Chiffrement** : rendre un fichier illisible sans la bonne clé. Les données peuvent être chiffrées
  par mot de passe (AES-256-GCM, la norme, avec une clé dérivée du mot de passe par scrypt) ; les
  paquets sont chiffrés **pour** le cabinet (X25519 : seule sa clé privée peut les ouvrir).
- **Empreinte** : vingt caractères (cinq groupes de quatre) qui résument la clé publique d'un
  cabinet. Assez courts pour être dictés au téléphone, et impossibles à imiter.
- **Paquet** (`.skanpack`) : le fichier mensuel que l'entreprise envoie à son comptable. C'est un
  ZIP ordinaire (lisible avec n'importe quel outil) contenant les PDF, les CSV et les écritures.
- **Manifeste** : le fichier à l'intérieur du paquet qui liste chaque fichier avec son empreinte
  (une somme de contrôle), les chiffres du mois, et ce qui n'a pas pu être joint.
- **Appairage** (`.skanpair`) : le fichier que le cabinet donne à ses clients pour que leurs paquets
  soient chiffrés pour lui.
- **Clé de secours** (`.skanrecover`) : la copie de la paire de clés du cabinet, scellée par un mot
  de passe choisi pour l'occasion, à garder hors de l'ordinateur. Sans elle, un ordinateur perdu
  rend tous les paquets reçus illisibles pour toujours.
- **Dossier** : côté entreprise, une entreprise (on peut en avoir plusieurs sur un poste) ; côté
  cabinet, un client du cabinet.
- **Module** : un bloc de fonctions de l'app entreprise (Achats, Stock, Paie…) qu'on peut afficher ou
  masquer dans le menu. **Offre** : le niveau de licence (Indépendant ou Entreprise), qui décide
  quels modules peuvent créer des pièces. **Option** : un supplément vendu à part (la Comptabilité).
- **Garde-fou** (ou porte) : dans le code, la fonction unique par laquelle passe tout refus d'un
  genre donné (période clôturée, licence expirée, jeu d'exemple). Une seule porte, testée, plutôt
  que vingt vérifications recopiées.
- **Test** : un programme qui vérifie que le logiciel fait ce qu'on attend. `npm test` fait 384
  vérifications de calcul en quelques secondes ; les **e2e** (« de bout en bout ») ouvrent la
  vraie application et cliquent dedans comme un utilisateur.
- **Chien de garde** : un mécanisme qui surveille l'application et la relance si elle se fige, en
  écrivant dans un journal quelle fonction a fauté.
- **Moteur** : la partie du code qui calcule (les totaux, les écritures, les livres), séparée des
  écrans. Le moteur de l'app entreprise vit dans un fichier, `core.js`, et se teste sans ouvrir
  l'application.
- **Migration** : ce qu'une nouvelle version fait des données de l'ancienne au premier lancement,
  pour les mettre à la forme du jour, sans rien perdre.

---

## 3. Le but et le positionnement

### Où on en est vraiment, au 15/09/2026

*Cette sous-section manquait, et c'est une relecture extérieure qui a posé les questions. Elle
change la lecture de tout le reste du document : ce qui suit décrit un produit construit, pas un
produit vendu.*

- **Combien de personnes utilisent SkanFact aujourd'hui ?** Trois, et aucune ne paie : Skander, son
  père (qui gère deux sociétés), son frère — c'est lui qui a trouvé le défaut de la retenue à la
  source en une phrase, le premier retour d'un utilisateur qui n'est ni l'auteur ni le propriétaire.
  **Zéro client payant, zéro licence vendue à un tiers, zéro cabinet équipé.** Il faut le lire avec
  les quinze modules livrés : le produit existe, le marché n'a pas encore répondu.
- **Combien de vraies factures sont passées par SkanFact ?** **À toi de le dire** — je ne peux pas le
  savoir depuis le code, et c'est le seul chiffre qui dise si le produit est éprouvé. Une centaine
  de vraies factures émises et envoyées à de vrais clients vaut plus que n'importe quel test.
- **Quel est le chiffre d'affaires du produit ?** Zéro. Toutes les projections du § 7 (« dix cabinets
  comme celui-là : cent mille dinars par an ») sont des calculs, pas des observations.
- **Combien de temps peux-tu tenir sans revenus de SkanFact ?** **À toi, et c'est la question la plus
  importante de ce document.** Elle ne demande pas un chiffre à écrire ici ; elle demande de savoir,
  pour toi, si l'horizon est de six mois ou de trois ans. La réponse change tout l'ordre du travail :
  à six mois, on signe le code, on vend l'app entreprise à dix clients et le Cabinet attend ; à trois
  ans, le plan du § 16 tient tel quel. Aucune autre décision de ce document ne mérite d'être prise
  avant celle-là.
- **Est-ce que ce document sert à lever de l'argent ou à convaincre un client ?** Non, et il ne
  faudrait pas essayer : c'est une référence interne de deux mille lignes, faite pour qu'on s'y
  retrouve dans six mois. **Ce qui manque à côté — et qui n'existe pas — c'est une page unique** :
  le problème, la solution, pour qui, combien, pourquoi nous. Un cabinet, un client ou un associé
  lira cette page-là ; personne ne lira celui-ci. **À construire (une heure), avant la première
  démonstration.**
- **Le marché, en chiffres sourcés (cherchés le 15/09/2026).** L'INS compte **836 808 entreprises
  privées en 2024**, dont **87 % sans aucun salarié** (729 240) — il reste donc de l'ordre de
  **107 000 entreprises avec au moins un salarié**, et c'est dans ce sous-ensemble que vivent nos
  clients (une entreprise au réel, avec une paie, un comptable, des factures à émettre). Source :
  répertoire national des entreprises, 14ᵉ édition, `ins.tn`. Le nombre d'experts-comptables
  inscrits à l'Ordre n'est **pas publié** comme un total : l'OECT tient un annuaire alphabétique en
  ligne (`oect.org.tn/les-membres`), qu'il faut compter page par page — **À toi, une demi-heure**,
  ou une question au comptable pilote qui le sait de mémoire. Ce que ces deux chiffres disent déjà :
  le plafond du § 7 (dix cabinets, cent clients entreprise) représente **un millième** du marché
  adressable. Le problème n'est pas la taille du marché, c'est d'y entrer.
- **Ce que coûte l'entretien de l'app entreprise pendant que le Cabinet se construit.** Une
  relecture a demandé un chiffre, et il faut d'abord dire une chose que ce document n'écrivait
  nulle part : **le code et les démarches ne se disputent pas le même temps.** Le code est écrit
  par Claude ; les démarches (marque, certificats, Ordre, INPDP, ventes, démonstrations) sont
  faites par Skander. Une semaine de démarches ne retarde pas une version, et une version ne
  retarde pas une démarche. Ce qui est en concurrence, c'est le temps de Skander entre *ses*
  démarches et *sa* relecture des versions. Pour l'entretien proprement dit, l'ordre de grandeur :
  une mise à jour d'Electron tous les trois à six mois (un à deux jours, e2e compris) ; la loi de
  finances (un à deux jours par an, plus la séance avec le comptable) ; les correctifs signalés
  par les clients — inconnus tant qu'il n'y a pas de clients, et c'est le seul poste qui grossit
  avec eux. **Estimation honnête : un à trois jours par mois avec quelques clients**, davantage
  au-delà de cinquante. Si ce chiffre dépasse cinq jours par mois, c'est que les clients sont là,
  et le plan du § 16 a le droit de ralentir : ce serait une bonne nouvelle.

### Les jalons de décision

*Ajouté le 15/09/2026. Une relecture a fait remarquer que le § 16 planifie neuf versions sans
qu'aucune ne soit conditionnée à un premier client, et que la question « combien de temps sans
revenus » n'avait pas de suite. Voici la suite. Les dates sont des propositions ; les seuils sont
à toi.*

- **Le principe.** On ne s'arrête pas de construire parce qu'on n'a pas vendu — la 9.1.0 et la 9.2.0
  sont ce qu'on montre pour vendre, et un pilote qui n'a rien à essayer ne s'engage pas. Mais on ne
  construit pas non plus neuf versions dans le vide. Chaque trimestre pose une question à laquelle
  la réponse est un chiffre, et un chiffre qui manque change l'ordre du travail, pas seulement
  l'humeur.
- **Fin 2026 (après 9.1.x et 9.2.0).** Ce qui doit être vrai : les six démarches du § 20 faites ;
  le pilote engagé par écrit et sur deux dossiers réels ; **au moins trois licences entreprise
  vendues** hors famille ; la question à l'Ordre posée. Si les trois licences manquent : la 9.3.0
  attend, et le trimestre suivant est un trimestre de démonstrations, pas de code — dix
  démonstrations en personne, comptées.
- **Mi-2027 (après 9.3.0 et 9.4.0).** Ce qui doit être vrai : **dix licences entreprise** ; le
  pilote qui tient ses dossiers dans le Cabinet sans revenir à son ancien logiciel ; une réponse de
  l'Ordre, ou à défaut celle du juriste. Si le pilote est revenu à son ancien logiciel : on arrête
  le Cabinet à la 9.4.0 et on demande pourquoi, avant d'écrire une ligne de la 9.5.0. Si l'Ordre a
  dit non : plan B de prix (§ 17), sans toucher au code.
- **Fin 2027 (après 9.6.0).** Ce qui doit être vrai : un **second cabinet** qui a commencé, même sur
  un dossier ; **vingt-cinq licences entreprise** ; un chiffre d'affaires qui couvre au moins les
  coûts fixes (domaine, certificats, abonnements). Si le second cabinet n'existe pas : le Cabinet
  reste un produit pour un seul cabinet, et 9.7.0 → 10.0.0 ne se justifient plus — on livre ce que
  le pilote demande, et rien d'autre.
- **Ce qui déclenche l'arrêt, à n'importe quel moment.** Si à un jalon **aucune** licence n'a été
  vendue depuis le jalon précédent, le trimestre suivant ne contient pas de version nouvelle. Cette
  règle vaut pour n'importe quelle raison — le prix, le produit, le temps de Skander, le marché — et
  c'est exprès : la cause se cherche pendant le trimestre de vente, pas avant.
- **Où ça se lit.** Trois nombres par mois, à la main (§ 9 : démonstrations, essais démarrés,
  licences vendues), dans un fichier à côté de celui-ci. Le jalon se juge sur ces trois nombres,
  jamais sur l'impression que « ça avance ». **À toi : les seuils. Décidé : qu'il y en ait.**

### Le positionnement

- **On répond à quelle demande ?** À deux demandes qui se rejoignent. Le chef d'une petite
  entreprise veut facturer correctement, savoir où est son argent, payer ses salariés et ses impôts,
  sans rien connaître à la comptabilité. Son comptable veut recevoir des pièces complètes, à
  l'heure, et ne plus ressaisir. **Décidé.**
- **En une phrase, c'est quoi SkanFact ?** Une PME gère et facture dans SkanFact sans rien savoir de
  la comptabilité ; son comptable reçoit chaque mois **les pièces et les écritures qui s'en
  déduisent**, les contrôle, les corrige, les complète et tient son livre depuis SkanFact Cabinet,
  sans jamais ressaisir. **Décidé.**
- **Attention au mot « comptabilité ».** SkanFact Entreprise ne « fait pas la comptabilité » : il
  produit des **écritures sources** — des propositions déduites des pièces, justes dans la plupart
  des cas, à contrôler dans tous. La comptabilité officielle est celle que le cabinet tient,
  valide, régularise, clôture et déclare. Toute la chaîne, dans l'ordre : *pièces chez le client →
  écritures sources → paquet mensuel → contrôle et correction au cabinet → livre officiel →
  opérations diverses, banque, inventaire → états et déclarations*. Le dire autrement serait
  surpromettre, et un comptable le verrait en cinq minutes. **Décidé.**
- **Comment on saura qu'on a réussi ?** Trois signes, dans l'ordre : zéro ressaisie entre les deux ;
  le comptable pilote ouvre le Cabinet tous les jours sur un vrai dossier ; puis un nombre de
  cabinets et de dossiers qui grandit. Aucun de ces signes n'est technique.
- **Pourquoi deux applications et pas une seule ?** Parce que ce sont deux métiers et deux façons de
  travailler. Le chef d'entreprise fait dix gestes par jour et ne doit rien apprendre ; le comptable
  passe ses journées dedans et a besoin de tout. Une seule application serait trop compliquée pour
  l'un et trop pauvre pour l'autre. Les deux partagent le même code de calcul, les mêmes règles, le
  même dépôt. **Décidé.**
- **Qu'est-ce qui n'existe nulle part ailleurs ?** Un logiciel de cabinet où les écritures des
  clients arrivent déjà écrites avec leurs pièces, vérifiées, hors ligne, et où une question posée
  sur une ligne arrive chez le client en face de sa pièce. C'est l'avantage à garder quoi qu'il
  arrive.
- **Une personne seule peut-elle vraiment tenir deux produits ?** C'est la critique principale de la
  troisième relecture extérieure : « choisissez UN produit, l'autre devient un satellite minimal ».
  Elle a raison sur les ressources et tort sur la conclusion, et il faut savoir pourquoi, parce que
  la question reviendra. **Le conseil détruit la seule chose qui nous distingue.** Un logiciel de
  cabinet sans l'app entreprise, c'est Sage en moins complet ; une app de facturation sans le
  Cabinet, c'est un logiciel de facturation de plus. Ce qui n'existe nulle part est précisément
  **le trait d'union**, et on ne peut pas garder un trait d'union en coupant une des deux extrémités.
  Ce qui est vrai dans la critique, et qu'on retient : **les deux produits n'avancent jamais en même
  temps.** L'app entreprise est finie (15 modules) et passe en entretien ; tout le travail neuf va
  au Cabinet. Ce n'est pas deux chantiers, c'en est un — le second — pendant que le premier ne bouge
  plus que pour des correctifs. Si un jour il faut vraiment en abandonner un, ce sera une décision
  prise sur un chiffre (celui du § 3, « combien de temps sans revenus »), pas sur un principe.
- **Et si on ne devait en vendre qu'un, lequel d'abord ?** L'app entreprise, sans hésiter : elle est
  finie, elle se vend seule, son prix est décidé, et chaque client vendu est un dossier de moins à
  facturer à un cabinet plus tard. Le Cabinet a besoin d'un pilote, d'une réponse de l'Ordre et de
  neuf versions ; l'app entreprise a besoin d'une signature de code et d'un client. C'est l'ordre
  que suggère le bon sens, et c'est aussi celui que la 9.1.1 (les corrections fiscales) et la
  signature de code mettent en place sans rien coûter au reste.
- **Qui sont les concurrents ?** Côté cabinet : Sage 100 Comptabilité (le plus répandu dans les
  cabinets francophones), EBP, Ciel, et des éditeurs tunisiens (À VÉRIFIER lesquels le comptable
  connaît). Côté entreprise : Excel et Word d'abord, puis quelques logiciels de facturation locaux.
  Les modèles à regarder pour la collaboration : Pennylane (France) et Odoo.
- **Pourquoi on ne fait pas comme Pennylane, tout en ligne ?** Parce qu'un cabinet tunisien doit
  pouvoir travailler sans réseau, que des données hébergées coûtent chaque mois et exigent des
  déclarations, et qu'un logiciel qui dépend d'un serveur meurt avec lui. Le hors-ligne est une
  promesse du produit, pas une limite. **Décidé.**
- **On vise au-delà de la Tunisie ?** Non. La fiscalité tunisienne est au cœur, l'interface est en
  français, les documents existent aussi en anglais pour les clients étrangers. Un autre pays
  serait un autre produit. **Décidé, pas avant d'avoir des cabinets tunisiens.**
- **Le marché tunisien est-il assez grand ?** Question posée par la troisième relecture extérieure,
  qui avance « quelques centaines à mille cabinets, cinquante à cent mille PME formelles » — des
  chiffres **sans source, donnés comme des faits** ; je ne peux ni les confirmer ni les infirmer, et
  ils méritent d'être vérifiés avant de servir à décider quoi que ce soit (l'Ordre publie le nombre
  de ses inscrits, l'INS publie le nombre d'entreprises). Ce qui est sûr : le plafond du § 7 (« dix
  cabinets, cent mille dinars ») est un **plafond de départ**, pas un plancher, et il suffit très
  largement à valider le modèle avant d'envisager quoi que ce soit d'autre. **À VÉRIFIER : les
  chiffres réels du marché, une heure de recherche.**
- **Et le Maghreb, l'Afrique de l'Ouest francophone ?** C'est la proposition d'agrandissement la plus
  sérieuse qu'on nous ait faite, et elle est juste sur un point : les concepts (TVA, retenue,
  lettrage, liasse, plan de comptes) se ressemblent, seuls les référentiels changent — et
  l'application est déjà construite pour ça, puisque **aucun taux n'est écrit en dur**. Ce qui
  changerait vraiment n'est pas le code : c'est un référentiel comptable de plus à connaître, des
  déclarations à comprendre, un pilote par pays, un support dans un fuseau différent. **Rien avant
  dix cabinets tunisiens** — le jour où le modèle est prouvé chez nous, cette porte est ouverte, et
  c'est une raison de plus de ne jamais écrire un taux en dur. **À toi, plus tard.**
- **Et en arabe ?** Les noms, adresses et libellés en arabe fonctionnent partout (identité, recherche,
  tri) — c'est déjà réglé depuis la 6.8.1, où deux raisons sociales arabes tombaient dans le même
  dossier. Une **interface** en arabe est une autre affaire : personne ne l'a demandée, mais personne
  n'a encore rien acheté non plus, donc « personne ne l'a demandée » ne prouve rien. **À toi, plus
  tard** — avec une réserve ci-dessous qui, elle, ne peut pas attendre.
- **Faut-il préparer l'écriture de droite à gauche maintenant ?** Oui, et c'est presque gratuit si on
  le fait tout de suite. Une interface arabe n'est pas une traduction : c'est une inversion de tout
  ce qui a un côté (marges, alignements, bordures, chevrons, colonnes de tableau). Ce qui bloque est
  le CSS écrit en **propriétés physiques** (`padding-left`, `text-align: right`) au lieu de
  **propriétés logiques** (`padding-inline-start`, `text-align: end`), qui se retournent toutes
  seules. J'ai compté : **93 déclarations physiques** dans tout le projet (65 dans la feuille
  partagée, 10 dans celle du Cabinet, 18 dans le modèle du document imprimé) et **zéro** logique.
  C'est peu — deux à trois heures de conversion mécanique aujourd'hui, un chantier dans deux ans.
  **Décidé : à partir de maintenant, tout CSS neuf s'écrit en propriétés logiques**, et la conversion
  des 93 existantes entre dans la prochaine version d'entretien. La dette cesse de grossir
  immédiatement ; le jour où quelqu'un demande l'arabe, il restera la traduction et les essais, pas
  la mise en page. Ce n'est pas une promesse de livrer l'arabe — c'est le refus d'en fermer la porte
  pour rien.
- **Le logiciel survit-il à son éditeur ?** Oui, c'est voulu : la licence se vérifie sur le poste,
  les données sont sur le poste, le paquet est un ZIP ordinaire, le code est public. Si SkanFact
  disparaît demain, chaque client garde un logiciel qui fonctionne et des fichiers qu'il peut ouvrir.
  **Décidé.**
- **Et si Skander veut un jour arrêter, vendre ou confier le projet ?** Tout ce qu'il faut pour
  reprendre est dans le dépôt : le code, les tests, les plans, les règles apprises, ce document. Ce
  qui n'y est pas et qu'il faudrait transmettre : la clé privée maître, le secret d'administration,
  les accès Cloudflare, OVH, GitHub, Resend.

---

## 4. L'application entreprise, SkanFact

### Ce qu'elle fait

- **Elle fait quoi, module par module ?** *Ventes* : devis, factures, avoirs, proforma, bons de
  commande et de livraison, contrats à signer, contrats récurrents (facture automatique chaque
  mois), relances des impayés, envoi par mail avec le PDF, acomptes et soldes. *Achats* :
  fournisseurs, factures d'achat et dépenses avec justificatif joint, règlements, TVA déductible,
  attestations de retenue. *Fichiers* : clients, catalogue de prestations et d'articles, modèles de
  documents, textes types. *Gestion* : trésorerie (comptes, mouvements, pointage, prévision), marges
  par affaire et seuil de rentabilité, immobilisations et amortissements, stock et numéros de série
  avec garanties, paie (bulletins, congés, avances, documents du personnel, déclarations CNSS et
  employeur), comptabilité (TVA du mois, écritures, calendrier fiscal, clôture mensuelle, paquet au
  comptable), statistiques. **Livré.**
- **Le chef d'entreprise doit-il connaître la comptabilité ?** Non. Aucun numéro de compte ne lui est
  jamais demandé. Les écritures se déduisent de ses pièces : quand il émet une facture, l'écriture
  existe. **Décidé.**
- **Comment on sait qu'un débutant s'y retrouve ?** Chaque champ porte une bulle « i » qui
  l'explique, une rubrique Aide de trente-deux articles explique la facturation et la routine
  comptable, un assistant de première utilisation pose les questions dans l'ordre (métier, régime
  fiscal, société, modules), un panneau « Tes premiers pas » et un panneau « À faire » disent quoi
  faire. Un jeu d'exemple complet se charge en un clic pour apprendre sans risque, et ne peut jamais
  signer une vraie facture. **Livré.**
- **Que se passe-t-il quand on se trompe ?** Ce qui détruit demande confirmation ; ce qui se répare
  laisse un « Annuler » pendant huit secondes ; une pièce émise ne se supprime pas, elle se corrige
  par avoir ; toute modification d'une période clôturée est refusée avec le chemin pour rouvrir
  (avec un motif). **Livré.**
- **Que deviennent le grand livre, la balance, les états financiers ajoutés en 8.8.0 → 9.0.0 ?** Ils
  deviennent un module « Comptabilité » **désactivé par défaut et payant** : l'option pour la petite
  entreprise sans comptable qui tient elle-même ses livres. Le moteur qui les calcule reste, parce
  que c'est lui qui écrit les écritures du paquet. L'onglet Écritures reste libre. **Décidé le
  15/09/2026, à construire en 9.1.0.** Son prix reste **à toi** (proposition : 190 DT HT par an).
- **Pourquoi masquer plutôt que supprimer ?** Supprimer aurait cassé le paquet (le moteur écrit les
  écritures et la balance que le comptable vérifie), jeté une trentaine de tests, et privé un
  indépendant sans comptable de voir sa balance. Masquer coûte une case dans les Paramètres.
- **Que contient exactement l'option Comptabilité ?** Les onglets Grand livre, Balance, États
  financiers et la saisie d'opérations diverses. Elle ne contient pas : Écritures (libre), TVA à
  payer (libre), Clôtures (libre), Cabinet (libre). Une entreprise sans l'option voit les onglets
  payants avec un cadenas et une phrase qui dit où l'activer ; jamais un écran blanc.
- **L'onglet Écritures reste visible chez tout le monde ?** Oui. C'est le seul endroit où le client
  voit ce qui part chez son comptable, et où il comprendra une question qu'il recevra. **Décidé.**
- **Et l'onglet « TVA à payer », si c'est le comptable qui déclare ?** Il reste comme estimation
  pour la trésorerie du client (« je vais devoir sortir 1 200 DT le 28 »). La déclaration officielle
  est celle du cabinet, et l'écran le dira.
- **Une entreprise sans comptable du tout ?** Elle active l'option Comptabilité et voit ses livres.
  Mais l'application ne prétend pas faire la liasse fiscale à sa place, et elle écrit qu'un
  professionnel doit valider. Selon la forme juridique, le régime et la taille, les obligations
  diffèrent : l'application dit **« ton cabinet »** ou **« ton responsable comptable »**, elle
  n'affirme jamais qu'un comptable est obligatoire. **À VALIDER JURIDIQUEMENT si on veut l'écrire
  autrement.**
- **Une entreprise dont le comptable n'utilise pas SkanFact Cabinet ?** Elle envoie quand même son
  paquet : c'est un ZIP ordinaire avec des CSV lisibles dans Excel et les PDF des pièces. Le
  comptable les importe dans son logiciel. Et le paquet lui dit que SkanFact Cabinet est gratuit
  pour ce dossier : c'est le levier pour qu'il l'installe.
- **Plusieurs entreprises sur le même ordinateur (ton père et sa société, par exemple) ?** Oui : des
  « dossiers », un sélecteur en haut du menu pour passer de l'un à l'autre, et le partage d'un
  dossier entre deux ordinateurs (iCloud, clé USB) avec fusion en cas de conflit. Chaque dossier a
  sa propre licence (son propre matricule). **Livré.**
- **Une facture en euros ?** Oui : chaque document porte sa devise et son taux de change (obligatoire,
  sinon toute la comptabilité serait fausse), et la comptabilité reste en dinars. Le timbre fiscal
  se convertit. **Livré.**
- **Une application sur téléphone ?** Pas maintenant. C'est la seule raison pour laquelle la lecture
  de photo de facture (prendre une facture en photo pour préremplir la saisie) est en pause : sans
  téléphone, personne ne photographie. **À toi, plus tard.**
- **Mais le mobile n'est-il pas indispensable pour de petits entrepreneurs ?** La troisième relecture
  extérieure le soutient et propose React Native ou Flutter. C'est probablement vrai du besoin, et
  ce n'est pas faisable comme elle le décrit. Il faut voir ce que ça engage réellement : une app
  mobile n'est pas une vue de plus sur les mêmes données, **c'est un troisième produit** — un autre
  langage, deux magasins d'applications avec leurs validations et leurs comptes payants, un cycle de
  publication différent, et surtout un **serveur**, puisque les données vivent sur l'ordinateur et
  qu'un téléphone n'y accède pas. C'est-à-dire exactement la chose que le produit refuse (§ 3,
  « pourquoi pas comme Pennylane »). **Ce qui est réaliste et qui reste ouvert**, le jour où le
  besoin se confirme : une application mobile **étroite** — photographier une facture d'achat,
  regarder l'encours, encaisser — qui parle à l'ordinateur et à lui seul, sur le réseau local ou par
  un fichier, sans jamais devenir le lieu où vivent les données. C'est un vrai chantier, il vient
  après le Cabinet, et il ne se décide pas avant d'avoir entendu un client le demander. **À toi.**
- **L'e-facture (TTN / El Fatoora) ?** Le jour où elle devient obligatoire pour les clients de
  SkanFact, c'est l'app entreprise qui émettra, et le cabinet qui vérifiera. Rien avant.
  **À VÉRIFIER : le calendrier et le périmètre en Tunisie.**
- **Ce qui va encore changer côté entreprise ?** Peu de choses, et toutes au service du pont : le
  module Comptabilité masqué et l'option dans la clé (9.1.0) ; la licence et la mention d'essai dans
  le manifeste du paquet (9.2.0) ; la réception des questions du cabinet, affichées sur la pièce, et
  la signature du paquet (9.2.0, remontée de la 9.9.0). Le reste, c'est de l'entretien et les
  retours des utilisateurs.
  **Décidé.**

### Comment elle marche, techniquement

- **Où sont les données ?** Dans un seul fichier JSON (`skanfact-data.json`) par dossier, sur
  l'ordinateur. Chaque enregistrement réécrit le fichier de façon atomique (on écrit à côté, puis on
  remplace : jamais un fichier à moitié écrit). Un fichier illisible est mis de côté, jamais écrasé.
- **Les sauvegardes ?** Automatiques : une par jour (l'état du matin, gardé 30 jours), plus une
  sauvegarde nommée avant chaque geste risqué (import, exemple, effacement, bêta). Une copie miroir
  vers un dossier externe (iCloud, clé USB) se règle en un clic et emporte aussi les pièces jointes.
  Restaurer se fait depuis les Paramètres, avec l'annonce de ce qu'on va perdre. **Livré.**
- **Le chiffrement ?** Optionnel côté entreprise : un mot de passe chiffre le fichier et les
  sauvegardes. Changer le mot de passe rechiffre les sauvegardes, y compris celles de la clé USB.
  **Un mot de passe oublié est définitif** : il n'existe aucune récupération, et l'écran le dit en
  gras avant d'activer. **Livré.**
- **Le PDF ?** L'application fabrique une page HTML du document, la découpe en pages A4 (une par
  feuille, pied numéroté, en-tête répété) et l'imprime en PDF. Un test imprime 161 documents et
  vérifie qu'aucune ligne n'est perdue. Le rendu est clair et épuré, sur une page pour un devis
  classique. **Livré.**
- **L'envoi par mail ?** Sur Mac, l'application ouvre Mail avec le PDF joint. Sur Windows, elle
  ouvre la messagerie par défaut et montre le PDF à joindre. **Livré.**
- **Les mises à jour ?** L'application vérifie toutes les quatre heures (et au retour au premier
  plan), télécharge la nouvelle version, et l'installe : Windows par l'installateur, Mac par un
  script qui remplace l'application (elle n'est pas signée par Apple). La date de la dernière
  vérification est affichée. **Livré.**
- **Que se passe-t-il si l'application se fige ?** Un chien de garde l'interroge toutes les trois
  secondes ; sans réponse, il relance l'interface et écrit dans le journal quelle fonction a fauté.
  Il sait faire la différence avec un ordinateur qui dormait. **Livré.**
- **Les données sont versionnées ?** Oui : chaque version qui change la forme des données (v6
  aujourd'hui) les migre au premier lancement, après une sauvegarde. Une donnée ancienne reste
  lisible pour toujours. **Décidé.**
- **Quelle taille de données ça supporte ?** Une petite entreprise (quelques milliers de pièces par
  an) sans effort : le fichier fait quelques mégaoctets. Ce n'est pas fait pour dix mille factures
  par mois, et ce n'est pas la cible.

### Ce qu'elle coûte

- **Combien ?** Essai 30 jours ; **Indépendant 390 DT HT/an** (ventes, clients, catalogue,
  contrats, relances, paquet au comptable) ; **Entreprise 690 DT HT/an** (tout : en plus les
  achats, le stock, les immobilisations, la paie, le pilotage — trésorerie, marges, statistiques —
  et le partage à deux) ; **−20 % la première année** si un cabinet équipé de SkanFact Cabinet
  parraine. Plus l'option Comptabilité (prix à décider). **Décidé, sauf le prix de l'option.**
- **Combien de postes ?** Illimités pour un même matricule fiscal : un dossier partagé emporte sa
  clé. On ne vend pas des sièges. **Décidé.**
- **Que se passe-t-il à la fin de la licence ?** Lire, imprimer, exporter, sauvegarder, envoyer le
  paquet au comptable : toujours. Créer une nouvelle pièce : bloqué, avec un bandeau qui dit où
  aller. Modifier une pièce existante reste possible (sinon une licence expirée empêcherait de
  corriger une faute de frappe). **Jamais de données en otage.** Un bandeau discret annonce l'essai
  dès le premier jour et devient orange la dernière semaine. **Livré.**
- **Une licence expirée reçoit-elle les mises à jour ?** Oui. Elle limite la création de pièces, pas
  le droit de recevoir une correction. **Décidé.**
- **Que bloque l'offre Indépendant ?** La **création** dans les modules réservés (achats, stock,
  immobilisations, pilotage, paie, partage). Les pages restent visibles avec un cadenas ; ce qui
  existe se lit et s'exporte. L'offre ne masque rien. Passer à Entreprise en cours d'année se paie
  au prorata des jours restants. **Livré.**
- **Une clé sans offre ou avec une offre inconnue ?** Vaut Entreprise : en cas de doute, on ouvre.
  **Décidé.**

---

## 5. L'application du comptable, SkanFact Cabinet

### Aujourd'hui

- **Elle fait quoi aujourd'hui ?** Elle reçoit les paquets mensuels (glissés sur la fenêtre ou
  double-cliqués), vérifie l'empreinte de chaque fichier (« 7 pièces vérifiées, intactes »), range
  les paquets par client et par année, montre le portefeuille (qui a envoyé, qui est en retard,
  qui n'est pas sur SkanFact), le chiffre d'affaires et la TVA de chaque mois, relance les clients
  par mail ou WhatsApp (avec l'historique des relances), tient un calendrier d'échéances (TVA, CNSS),
  et exporte les écritures de tous ses clients en un seul CSV pour son logiciel comptable. Un jeu
  d'exemple montre les quatre situations au premier lancement. **Livré (versions 1.0 à 2.2).**
- **Qu'est-ce qu'elle protège ?** Ses données sont chiffrées avec un mot de passe obligatoire ;
  sauvegardes quotidiennes et nommées ; copie externe qui emporte les paquets ; **clé de secours**
  exportable, réclamée en rouge tant qu'elle n'est pas enregistrée ; changement d'ordinateur guidé
  (la même empreinte à l'arrivée) ; verrouillage manuel. **Livré.**
- **Le rouge suffit-il pour la clé de secours ?** Non, et c'est un trou que la troisième relecture
  extérieure a désigné. Un cabinet peut installer l'application, importer soixante paquets, et
  **ensuite seulement** exporter sa clé — entre les deux, une panne de disque rend illisible pour
  toujours tout ce qu'il a reçu, pendant qu'un bandeau rouge décrit exactement ce qui va se passer.
  Vérifié dans le code : rien ne s'interpose entre l'installation et le premier import. Ce qui
  manque n'est pas le nombre de clés, c'est le **moment**. **Décidé (9.1.0) : le premier import de
  paquet demande la clé de secours avant d'importer** — pas un rappel, une étape, avec « pas
  maintenant » possible une fois et une seule. C'est le seul instant où l'on est certain que le
  cabinet est devant l'écran et qu'il n'a encore rien à perdre.
- **Et plusieurs clés de secours, ou un partage à seuil (Shamir) ?** Refusé, avec la raison. Trois
  parts sur cinq chez un associé, un notaire, un coffre : c'est plus solide sur le papier et
  ingérable en pratique pour un cabinet de trois personnes, qui perdra les parts avant de perdre le
  disque — et chaque mécanisme qu'on ajoute est un mécanisme de plus à comprendre le jour où tout va
  mal. Ce qui est retenu à la place est plus bête et plus efficace : la clé est réclamée **avant**
  le premier paquet, l'écran dit où ne PAS la ranger (« vérifie qu'elle n'est pas sur cet
  ordinateur »), et la copie externe l'emporte. Si un cabinet pilote demande un jour le partage à
  seuil, on le rediscutera avec son cas réel.
- **Que fait-elle d'un paquet suspect ?** Un fichier qui n'est pas un paquet, un paquet adressé à un
  autre cabinet, un paquet protégé par mot de passe, un fichier glissé dans le paquet après coup, un
  paquet tronqué : chaque cas donne une phrase en français, et un fichier non annoncé par le
  manifeste n'est jamais compté parmi les pièces vérifiées. **Livré.**
- **Qu'est-ce qui lui manque, d'après le comptable ?** Les livres. Il ne voit ni le journal, ni le
  mouvement d'un compte, ni la balance : il reçoit des fichiers, il ne voit pas de comptabilité.
  C'est ce qu'il a dit en une phrase, et c'est le chantier.

### Demain

- **Elle deviendra quoi ?** Le **logiciel de comptabilité du cabinet**, complet : plan de comptes,
  saisie d'écritures, brouillard et validation, banque et rapprochement, lettrage, TVA et
  déclarations mensuelles, immobilisations, inventaire, clôture d'exercice, états financiers,
  liasse, révision, collaborateurs. **Décidé, version par version (§ 16).**
- **Le comptable doit-il avoir ses clients sur SkanFact ?** Non. Un dossier hors SkanFact est un
  dossier ordinaire : tout arrive par la saisie, le relevé bancaire, l'import d'un autre logiciel.
  Un cabinet de soixante clients dont deux sur SkanFact doit pouvoir tout tenir. **Décidé.**
- **Peut-il modifier les données du client ?** Jamais. Il tient SON livre, dans SES données. S'il
  veut une correction chez le client, il pose une question ; le client corrige chez lui et renvoie
  un mois révisé. Deux personnes qui écrivent dans le même livre, c'est la source de tous les
  conflits. **Décidé, depuis la première version du Cabinet.**
- **Qui a raison si le livre du cabinet et le SkanFact du client diffèrent ?** Le livre du cabinet :
  c'est lui qui est déclaré. L'écart reste visible des deux côtés jusqu'à ce que le client renvoie
  un mois révisé.
- **Et les écritures que le cabinet passe tout seul (provisions, régularisations, amortissements de
  fin d'année) ?** Le client ne les voit pas : son livre à lui ne connaît que ses pièces. Tant que
  ça ne dure qu'un exercice, c'est sans conséquence. Mais **à la clôture, l'écart devient
  permanent** : les à-nouveaux de l'année suivante chez le client seraient faux, et l'écart
  grandirait chaque année. D'où le **flux retour de clôture** (§ 16, version 9.6.0) : le cabinet
  renvoie les à-nouveaux officiels et la liste de ses écritures d'inventaire, le client les importe
  et verrouille son exercice. **Décidé.**
- **Que se passe-t-il quand un client renvoie un mois déjà reçu ?** Si les écritures de ce mois ne
  sont pas encore validées dans le Cabinet, elles sont remplacées et l'application le dit. Si elles
  sont validées (mois déjà déclaré), le Cabinet montre l'écart ligne par ligne et le comptable
  décide : une écriture de régularisation, ou rien. Le paquet précédent est gardé (`-r2`), jamais
  écrasé.
- **Une écriture validée peut-elle être modifiée ?** Non, jamais. Elle se contre-passe. C'est la
  règle légale d'un logiciel de tenue. **Décidé.**
- **Une écriture venue d'un paquet peut-elle être modifiée dans le Cabinet ?** **Oui, tant qu'elle
  est en brouillard, et c'est essentiel.** Une écriture qui arrive du client est une **proposition**,
  pas une vérité : le client a pu imputer une charge au mauvais compte, oublier de ventiler, mettre
  une TVA qui n'a pas lieu d'être. Le comptable la ré-impute, la scinde, la corrige dans **son**
  livre, puis la valide — c'est son métier, et le lui interdire rendrait le logiciel inutilisable.
  Ce qu'il ne peut pas faire, c'est toucher aux **données du client** : sa facture reste ce qu'elle
  est, et le paquet reçu n'est jamais réécrit. Chaque écriture garde donc **deux traces** : d'où
  elle vient (le paquet de mars du dossier X, telle pièce) et ce que le cabinet en a fait (modifiée
  le tant, par qui, valeur d'origine conservée). Quand il corrige une imputation qui se répétera, il
  a intérêt à le dire au client par une question (9.9.0) : sinon il la corrigera tous les mois.
  **Décidé — corrigé le 15/09/2026 après une relecture extérieure ; la version précédente de ce
  document disait le contraire, et elle avait tort.**
- **Combien de dossiers, d'exercices ?** Sans limite : un fichier par dossier, plusieurs exercices
  ouverts en même temps (on termine décembre pendant qu'on saisit janvier).
- **Plusieurs collaborateurs, plusieurs postes ?** Oui (version 9.8.0) : chaque collaborateur a des
  droits par dossier (saisie, validation, supervision), deux postes du cabinet peuvent travailler sur
  le même dossier sans s'écraser, et chaque écriture garde qui l'a faite et quand (la piste
  d'audit). Postes illimités. **Décidé.**
- **Il remplace Sage ?** C'est l'objectif, atteint version par version. Jusqu'à la clôture
  d'exercice (9.6.0) le cabinet pourra continuer d'exporter vers son logiciel pour ce qui manque
  encore.
- **Comment il reprend ses soixante dossiers existants ?** Par une balance d'ouverture importée
  (CSV ou Excel sorti de son logiciel actuel) et un plan de comptes importé (9.2.0). C'est le geste
  qui décide s'il vient ou pas : personne ne ressaisit dix ans d'historique. L'historique reste
  dans l'ancien logiciel ; SkanFact Cabinet commence à une date de reprise.
- **Il tient la paie de ses clients dans le Cabinet ?** Pas pour l'instant. Le moteur de paie existe
  côté entreprise et se partagera le jour où un cabinet le demande. Les bulletins d'un client
  SkanFact arrivent déjà en écritures dans le paquet.
- **Il facture ses honoraires dans le Cabinet ?** Non. Le Cabinet ne devient pas un second logiciel
  de facturation ; le cabinet est une entreprise, il a SkanFact entreprise pour ça.
- **Il télédéclare depuis le Cabinet ?** Non : il prépare la déclaration (les chiffres, le fichier),
  et dépose lui-même sur le portail de l'administration. Une application qui déposerait à sa place
  se tromperait un jour sans qu'il le sache. **Décidé. À VÉRIFIER : ce que le portail accepte.**
- **S'il arrête SkanFact Cabinet ?** Export complet de chaque dossier en ZIP ordinaire (CSV, PDF),
  lisible sans SkanFact. Jamais de données en otage. **Décidé.**
- **Un client qui a lui-même Sage ?** Dossier hors SkanFact : ses écritures s'importent en CSV.
- **Le comptable peut-il ouvrir directement le SkanFact du client ?** Techniquement oui, dès
  aujourd'hui, par un dossier partagé. Mais ce n'est pas la voie : ce serait deux personnes dans le
  même livre. Le pont reste le paquet.
- **Le client voit-il ce que le cabinet a fait (bilan, déclarations) ?** Par PDF envoyé par mail,
  comme aujourd'hui. Un retour par le pont viendra avec les questions (9.9.0).
- **Qui clôture ?** Deux gestes, et **un seul est une clôture comptable**. Côté client, c'est un
  **verrouillage de la période transmise** : il fige ce qu'il a saisi pour que le paquet soit
  définitif, et il peut rouvrir avec un motif. Côté cabinet, c'est la **clôture d'exercice** :
  irréversible, tracée, elle arrête le livre officiel. Le vocabulaire compte : appeler « clôture
  comptable » le geste du client laisserait croire que sa comptabilité est arrêtée alors qu'elle
  n'est pas encore tenue. **Décidé — vocabulaire corrigé le 15/09/2026 ; les écrans suivront dans
  la version qui touche à la clôture.**
- **Un mois provisoire, il en fait quoi ?** Il le voit marqué provisoire, peut le saisir en
  brouillard, et ne le valide pas avant le paquet définitif. Le comptable pilote dira s'il préfère
  attendre ou saisir puis corriger. **À VÉRIFIER avec lui.**

### Comment ça marchera, techniquement

- **Où vivront les livres ?** Un fichier **par dossier et par exercice**
  (`dossiers/<client>/livre-2026.json`), chiffré avec la même clé que le reste, à côté des paquets.
  Soixante dossiers sur dix ans ne tiennent pas dans un seul fichier relu à chaque enregistrement :
  c'est la décision de stockage à prendre avant la 9.2.0, parce qu'elle ne se reprend pas. Les
  sauvegardes, la copie externe et la clé de secours emportent ces fichiers ; l'index
  (`cabinet-data.json`) garde le portefeuille et les relances. **Décidé.**
- **Pourquoi pas une vraie base de données (SQLite) ?** Trois raisons, dans l'ordre. La corruption
  n'est **pas** l'argument : l'écriture atomique remplace le fichier entier (on écrit à côté, puis on
  renomme), ce qui donne la même garantie tout-ou-rien qu'une transaction, sur la totalité des
  données au lieu d'une ligne. Le vrai sujet est la **vitesse**, et le découpage par exercice le
  règle : un exercice d'un dossier moyen pèse quelques centaines de kilooctets, réécrits en quelques
  millisecondes, même en saisie au kilomètre. Enfin, SQLite est une **dépendance native** : elle doit
  être recompilée pour chaque système et chaque processeur, elle casse la construction universelle
  Mac (Intel et Apple Silicon dans un seul fichier) et elle rompt la règle « aucune bibliothèque
  tierce dans l'application », qui est ce qui rend ce projet reprenable par une personne seule. **On
  mesure avant de décider quoi que ce soit d'autre** : un test de charge (un dossier de cinquante
  mille écritures, chronométré) passe **avant la 9.2.0**, et s'il montre que ça ne tient pas, on
  rediscute avec des chiffres. **Décidé, avec mesure avant la 9.2.0 — corrigé le 15/09/2026.** Ce
  document disait « avant la 9.3.0 » à deux endroits et « avant de décider quoi que ce soit
  d'autre » à un troisième : c'est contradictoire, et la troisième relecture extérieure l'a vu. La
  9.2.0 est précisément la version qui **écrit** le format du livre. Mesurer après, c'est mesurer
  une fois qu'on ne peut plus changer d'avis sans tout réécrire — et un test de charge qui arrive
  trop tard ne sert qu'à nommer le problème qu'on a déjà.
- **Que mesure exactement ce test, et à partir de quand il échoue ?** Sans seuil, un test de charge
  ne peut pas échouer, donc il ne prouve rien — la relecture qui l'a dit a raison. Les seuils, fixés
  AVANT de mesurer : **ouverture d'un dossier < 1 s ; enregistrement d'une écriture en saisie au
  kilomètre < 100 ms** (c'est celui qui décide : il se paie à chaque ligne tapée, et au-delà la
  frappe se sent) **; balance consolidée de soixante dossiers < 5 s ; recherche globale < 3 s** —
  sur un portable ordinaire, pas sur la machine de développement. Un seul seuil dépassé et on change
  le modèle (index à côté des livres, § 5) avant d'écrire la 9.2.0. **Décidé.** Trois choses, sur un
  livre de cinquante mille écritures :
  le temps d'ouverture d'un dossier ; le temps d'un enregistrement en saisie au kilomètre (c'est
  celui qui décide, parce qu'il se paie à chaque ligne tapée) ; et le temps des trois lectures
  transverses qu'un cabinet fait vraiment — une balance consolidée de soixante dossiers, une
  recherche globale (« où est passée cette facture ? »), un tableau de production. Ces trois-là
  ouvrent **soixante fichiers**, et c'est le point que le découpage par exercice ne règle pas : il
  règle l'écriture, pas la lecture d'ensemble. La parade prévue si la mesure est mauvaise est un
  **index** (par compte, par tiers, par date, par montant) tenu à côté des livres et reconstructible
  à partir d'eux — un index qui se perd se refabrique, un livre qui se perd est perdu.
- **Que contient un livre ?** Les **exercices** (début, fin, clos ou non, par qui, quand) ; le
  **plan de comptes** du dossier (numéro, libellé, nature) ; les **journaux** ; les **écritures**,
  chacune avec sa date, son journal, sa pièce, son numéro, son libellé, ses lignes (compte, tiers,
  libellé, débit, crédit, lettre de lettrage), sa **source** (`skanfact`, `saisie`, `banque`,
  `inventaire`, `an`, `import`), le mois du paquet d'où elle vient, son **statut** (brouillard ou
  validée), l'auteur, les dates, et pour une contre-passation le lien vers l'écriture d'origine ;
  les **lettrages** ; les **relevés bancaires** importés ; les **immobilisations** ; les
  **déclarations** préparées ; la **piste d'audit** (qui a fait quoi, quand). **À construire.**
- **Comment un paquet devient des écritures ?** À l'import, le Cabinet lit le fichier d'écritures du
  paquet et le range dans le livre du dossier avec sa source (« skanfact »), le mois, et le lien
  vers la pièce (le PDF est dans le paquet). Ces écritures ne se modifient pas dans le Cabinet.
  Elles arrivent validées si le mois est clôturé chez le client, en brouillard sinon. Les paquets
  déjà reçus avant cette version sont relus une fois pour remplir les livres. **À construire (9.2.0).**
- **Et si le même paquet est importé deux fois ?** **L'import d'un mois REMPLACE les écritures de ce
  mois pour ce dossier ; il n'ajoute jamais.** Sans cette règle, un client qui renvoie mars
  doublerait toutes ses écritures de mars, la balance tomberait quand même juste (deux écritures
  équilibrées valent une), et personne ne verrait rien avant que le chiffre d'affaires soit doublé.
  La même règle vaut déjà pour les paquets eux-mêmes depuis la Cabinet 1.0.0 ; elle se porte aux
  écritures. Les écritures déjà **validées** d'un mois ne sont pas remplacées : c'est l'écart qui
  s'affiche, et le comptable décide (voir ci-dessus). Un test importe deux fois le même paquet et
  compte les lignes. **Décidé, 9.2.0.**
- **Le moteur est-il refait ?** Non. Les fonctions qui calculent le journal, le grand livre, la
  balance, le lettrage, les états existent dans l'app entreprise. Elles sortent dans un fichier
  partagé (`src/renderer/compta.js`) que les deux applications chargent ; l'app entreprise continue
  de les appeler comme avant. Un test vérifie que le Cabinet, nourri des douze paquets de l'exemple
  — **qui n'existent pas encore comme fichiers**, il faut le dire : le jeu d'exemple de l'app
  entreprise (`demo.js`, vingt-quatre mois datés par rapport à aujourd'hui, tous les taux de TVA,
  avoir total et partiel, retenue, timbre, facture en devise, acompte et solde, paie, immobilisation
  cédée) est fabriqué à la volée, et le test de parité le passera dans `packPlan` mois par mois
  pour produire les paquets **au moment du test**, jamais des fichiers versionnés dans le dépôt
  (datés relativement, ils seraient périmés le lendemain). Le Cabinet, lui, n'a aujourd'hui qu'un
  jeu d'exemple sans paquets ouvrables ; leur fabrication réelle est la tâche restée en attente
  depuis la 8.7.0, reprise en 10.0.0 — donne **la même balance au millime** que l'app entreprise.
  **Décidé, 9.1.0.**
- **Ce que le moteur ne sait pas encore faire ?** Le brouillard et la validation, la
  contre-passation, l'extourne, les guides d'écritures et les abonnements, l'import de relevé
  bancaire et le rapprochement automatique, le lettrage manuel, la balance âgée, les provisions et
  régularisations, la clôture d'exercice définitive, l'amortissement dégressif, la liasse. C'est le
  contenu des versions 9.3.0 à 10.0.0 (§ 16).
- **La numérotation des écritures ?** Continue par journal et par exercice, sans trou, attribuée
  **à la validation** (une écriture en brouillard n'a pas de numéro définitif). Un numéro n'est
  jamais réutilisé. **Décidé.**
- **Trois numéros différents, à ne jamais confondre.** Le **numéro de facture** (`FAC-2026-012`) est
  commercial et légal : il vit chez le client, il est attribué à l'émission, il est continu par type
  et par année. Le **numéro de pièce** identifie le justificatif dans le journal (souvent le numéro
  de facture, mais pas toujours : une opération diverse a le sien, `OD-2026-002`). Le **numéro
  d'écriture** est l'ordre dans le journal du cabinet, par journal et par exercice, attribué à la
  validation. Les trois coexistent sur la même ligne et ne se remplacent pas : les mélanger rendrait
  impossible de retrouver une pièce à partir d'un livre, et c'est la première chose qu'un contrôle
  demande. **Décidé.**
- **Et si on restaure une sauvegarde ?** C'est le seul cas où un numéro peut être rejoué : la
  sauvegarde d'hier ne connaît pas la facture émise ce matin, et la prochaine émission reprendrait
  son numéro. L'application doit donc, **après toute restauration**, comparer ses compteurs à la
  plus haute pièce trouvée dans les données et les remonter si besoin, puis le dire. Même règle
  après une fusion de deux postes (elle existe déjà : les compteurs sont pris au maximum).
  **À construire (petit, avec les corrections).**
- **Le plan de comptes ?** Chaque dossier a le sien, initialisé depuis le plan de référence du
  cabinet (le SCE complet, modifiable). Les comptes venus d'un paquet SkanFact sont ceux du client ;
  une table de correspondance du cabinet les traduit dans ses numéros si besoin (9.3.0). **À
  construire.**
- **Un compte, c'est juste un numéro et un libellé ?** Non, et c'est une erreur à ne pas faire :
  côté Cabinet, un compte porte aussi sa **classe**, son **type** (bilan ou gestion), s'il est
  **lettrable**, s'il est **collectif** (411, qui ne reçoit pas d'écriture directe) ou
  **auxiliaire** (411001, rattaché à un tiers), s'il est **actif** (on peut encore l'utiliser) et
  son **comportement TVA** s'il en a un. Sans ces attributs, on ne peut ni interdire une écriture
  directe sur un collectif, ni proposer le lettrage au bon endroit, ni sortir une balance auxiliaire
  correcte, ni empêcher qu'un compte abandonné resserve par erreur. Côté entreprise, le modèle plus
  simple d'aujourd'hui suffit : le client ne saisit pas d'écriture. **Décidé, 9.2.0.**

---

## 6. Le pont entre les deux

- **Comment les données circulent ?** Par le paquet mensuel `.skanpack`. L'entreprise clôture son
  mois, clique « Envoyer au cabinet », et obtient un fichier chiffré pour son cabinet, envoyé par
  n'importe quel moyen : mail, WhatsApp, Drive, clé USB. Le cabinet le glisse dans son application.
  **Livré.**
- **Qu'est-ce qu'il y a dedans ?** Les factures et avoirs en PDF, les justificatifs d'achat, les
  bulletins de paie, les journaux en CSV (ventes, achats, encaissements, règlements, trésorerie), la
  TVA du mois, les **écritures en partie double** (numéro, date, journal, pièce, compte, tiers,
  libellé, débit, crédit, lettrage), la **balance** du mois, la déclaration CNSS, et un
  **manifeste** qui liste chaque fichier avec son empreinte et les chiffres du mois. Une page de
  garde en HTML explique tout ça à qui l'ouvre à la main.
- **Pourquoi un ZIP et pas un format maison ?** Pour que le comptable puisse l'ouvrir avec le Finder
  ou l'Explorateur même si SkanFact disparaît. On ne devient jamais le seul lecteur possible des
  pièces comptables de quelqu'un d'autre. **Décidé.**
- **Comment il est chiffré ?** Pour le cabinet et pour lui seul : une clé éphémère par paquet
  (X25519), le contenu en AES-256-GCM. L'en-tête reste en clair (nom de l'entreprise, mois,
  empreinte du destinataire) pour qu'un paquet mal rangé reste identifiable. Sans cabinet appairé,
  un mot de passe ; sans mot de passe, rien.
- **Pourquoi pas un serveur tout de suite ?** Coût mensuel, données hébergées, déclaration INPDP,
  surface à surveiller la nuit. Le fichier fait le même travail. Le serveur viendra comme simple
  transport quand un cabinet dira qu'il en veut un. **Décidé.**
- **Le client peut-il envoyer un mois non clôturé ?** Oui, il est marqué provisoire ; le cabinet le
  voit et ne déclare pas dessus. Le mois en cours n'est jamais réclamé.
- **Que se passe-t-il si une pièce n'a pas pu être jointe ?** Le paquet part quand même et le
  manifeste le dit (`absents`) : mieux vaut 99 % avec le trou signalé qu'un envoi qui échoue. Le
  Cabinet affichera ces manques à côté des écritures (9.2.0).
- **Et dans l'autre sens ?** Les questions du cabinet (pièce absente, compte d'attente non soldé,
  facture ouverte depuis 90 jours) partent vers le client, qui les voit **sur la pièce concernée**,
  répond, joint ce qui manque, et renvoie un mois révisé (9.9.0). Le transport : un fichier de
  questions envoyé par mail au début, le serveur un jour. **Décidé : les questions sont CHIFFRÉES,
  comme les paquets.** Ma première recommandation était de les envoyer en clair, au motif qu'une
  question n'est pas une pièce comptable. C'est faux : une question porte le nom d'un client, un
  montant exact, un doute sur un compte bancaire — c'est du secret professionnel, et l'envoyer en
  clair romprait la promesse du produit. À l'appairage, le client génère donc **sa propre paire de
  clés** et rend sa clé publique au cabinet (le fichier d'appairage devient un aller-retour) ; le
  fichier de questions (`.skanask`) est scellé pour lui seul, avec le mécanisme du paquet, qui
  existe depuis la 6.2.0. Le même aller-retour sert au flux de clôture (`.skanclose`, 9.6.0) : une
  seule clé du client, deux usages.
- **Comment le cabinet sait que le paquet vient bien de ce client ?** Aujourd'hui : **il ne le sait
  pas.** Il sait seulement que le paquet a été scellé pour lui, et il croit le matricule écrit
  dedans. Ce n'est pas une preuve, et c'est une faiblesse réelle : le scellement se fait avec la
  clé **publique** du cabinet, celle qui vit dans le fichier d'appairage que le cabinet donne à
  **tous** ses clients. Quiconque tient ce fichier — un client du même cabinet, quelqu'un à qui il
  a été transféré — peut fabriquer un paquet au nom d'une autre entreprise et l'envoyer. Le cabinet
  l'ouvrira, verra des écritures d'apparence normale, et n'aura aucun moyen de dire qu'elles ne
  viennent pas de son client. Vérifié dans le code : `sealForCabinet` (`src/zip.js`) ne demande que
  la clé publique, et aucune signature ne figure nulle part dans le manifeste.
  **Décidé — corrigé le 15/09/2026 après une troisième relecture extérieure : la signature passe de
  la 9.9.0 à la 9.2.0.** Elle était rangée avec la révision, huit versions plus loin, c'est-à-dire
  après toute la période où le Cabinet est réellement utilisé par le pilote. Tout le nécessaire
  existe déjà : le client a sa paire de clés (créée à l'appairage pour recevoir les questions
  chiffrées), Ed25519 est dans `src/licence.js` depuis la 6.4.0, et le manifeste s'écrit en dernier
  — c'est exactement ce qu'on signe. Le cabinet **épingle** la clé publique du client au dossier au
  premier paquet ; un paquet signé par une autre clé est refusé en nommant le dossier, et un paquet
  **non signé** (venu d'une version d'avant) est accepté avec la mention « origine non prouvée »,
  jamais silencieusement.
- **Et cette tolérance dure combien de temps ?** Pas indéfiniment, sinon elle est le trou qu'on
  vient de fermer, déplacé d'un cran : un client resté deux ans sur une vieille version serait
  usurpable pendant deux ans. La règle, ajoutée le 15/09/2026 après relecture : **dès qu'un dossier
  a reçu UN paquet signé, tout paquet non signé de ce dossier est refusé** — le client a mis à jour,
  il ne redescend pas. C'est le principe « confiance au premier usage » des clés SSH : la tolérance
  ne vaut que pour les dossiers qui n'ont jamais signé, et elle s'éteint d'elle-même, dossier par
  dossier, sans date à décider. Un client qui revient sur une version ancienne (réinstallation
  d'une vieille sauvegarde) verra un refus qui nomme la cause et le geste : mettre à jour.
  **Décidé.**
- **Pourquoi ne pas l'avoir fait dès la 6.1.0 ?** Parce que le danger identifié à l'époque était la
  confidentialité (un paquet qui traîne dans une boîte mail), pas l'imposture. Le chiffrement répond
  au premier, pas au second. C'est la même erreur de cadrage que « la corruption n'est pas
  l'argument, la vitesse l'est » : on avait la bonne parade pour la mauvaise menace.
- **Peut-on rejouer un vieux paquet pour fausser les chiffres du cabinet ?** Non : un paquet dont la
  date de fabrication est **antérieure** à celui déjà reçu pour ce mois est refusé, avec sa phrase.
  C'est ce qui empêche un mois définitif de redevenir provisoire quand on rattrape une boîte mail en
  retard, et c'est aussi la protection contre le rejeu. Ce qui manque encore, et qui vient en 9.9.0 :
  la signature du client, sans laquelle quelqu'un qui connaît la clé publique du cabinet pourrait
  fabriquer un paquet de toutes pièces. **Livré pour l'anti-rejeu, à construire pour la signature.**
- **Comment le client sait que le cabinet est le bon ?** L'**appairage** : le cabinet donne un
  fichier `.skanpair` (sa clé publique, rien de secret) et dicte son empreinte au téléphone. Le
  client importe le fichier et compare l'empreinte. Un fichier d'imposteur ne passe pas. **Livré.**
- **Cette empreinte sert à autre chose ?** Oui : c'est aussi la **preuve du parrainage**. Elle
  figure dans la demande de licence du client, et c'est elle qui déclenche la remise de 20 %.
  Le mécanisme technique et le mécanisme commercial sont le même objet.
- **Si le client change de cabinet ?** Il importe le fichier d'appairage du nouveau ; ses paquets
  suivants partent au nouveau. L'ancien garde ce qu'il a reçu (c'est son travail à lui). Les données
  restent chez le client.
- **Un client suivi par deux cabinets ?** Un seul appairage à la fois. Un paquet protégé par mot de
  passe peut être envoyé à un autre destinataire.
- **Les deux applications doivent-elles avoir la même version ?** Non. Un paquet porte son numéro
  de format ; un Cabinet plus récent lit tous les paquets anciens pour toujours ; un Cabinet plus
  ancien qu'un paquet dit « mets à jour SkanFact Cabinet » au lieu de se tromper. Règle : **le
  cabinet se met à jour en premier**, et les paquets anciens ne perdent jamais leur lisibilité.
  **Décidé.**
- **Qu'est-ce qui va changer dans le paquet ?** Deux choses : la **licence** du client dans le
  manifeste (pour que le cabinet sache, hors ligne, que ce dossier est sur SkanFact et donc gratuit)
  et la mention d'essai ; et la **signature** du client — les deux en 9.2.0, la signature ayant été
  remontée de la 9.9.0 le 15/09/2026. Le numéro de format monte, les paquets anciens restent
  lisibles (et se disent « origine non prouvée » plutôt que d'être refusés).

---

## 7. Le modèle économique

### Les prix

- **Qui paie quoi ?** L'entreprise paie sa licence. Le cabinet paie ses dossiers hors SkanFact
  au-delà de trois. **Décidé.**
- **Pourquoi le cabinet ne paie pas pour ses clients SkanFact ?** Ils ont déjà payé leur licence,
  et c'est l'incitation : chaque client que le cabinet fait passer sur SkanFact fait baisser sa
  propre facture. **Décidé.**
- **Pourquoi trois dossiers gratuits ?** Pour qu'un cabinet essaie sur ses vrais dossiers sans rien
  signer, et pour qu'un petit cabinet avec trois clients hors SkanFact ne paie rien. Il n'y a donc
  pas d'essai de 30 jours pour le Cabinet : la gratuité des trois premiers dossiers en tient lieu.
  **Décidé.**
- **Combien par dossier ?** Proposition : **72 DT HT par dossier et par an** (6 DT par mois),
  dégressif par paliers (60 DT au-delà de 20 dossiers, 48 DT au-delà de 50). **À toi, après avoir
  regardé les prix pratiqués en Tunisie (À VÉRIFIER).**
- **Un très gros cabinet (200 dossiers) ?** La troisième relecture extérieure recommande de **ne pas
  proposer d'illimité** et de continuer les paliers dégressifs jusqu'à ~20 DT le dossier. L'argument
  tient : un plafond n'a que deux positions possibles, trop bas (on laisse des milliers de dinars
  sur la table — 150 dossiers facturables à 48 DT font 7 200 DT) ou trop haut (personne ne le
  prend), et on ne saura de quel côté il tombe qu'après avoir vu un vrai gros cabinet. Une grille
  dégressive n'a pas ce défaut : elle est juste à toutes les tailles et elle se lit sans
  explication. **Décidé (tranché le 15/09/2026) : la STRUCTURE est « des paliers dégressifs, pas
  d'illimité »**, parce qu'une question laissée ouverte oblige la console à porter les deux
  modèles, et qu'on ne construit pas deux fois pour un cas qui n'arrivera peut-être jamais. **Les
  NOMBRES — le prix de chaque palier, jusqu'où ils descendent — restent à toi**, et peuvent attendre
  le premier cabinet de plus de cent dossiers : c'est un problème qu'on aura de la chance d'avoir.
- **Pourquoi par dossier et pas par poste ou par utilisateur ?** Parce qu'un cabinet grandit par
  dossiers, pas par sièges ; et parce que les concurrents vendent des sièges. « Postes et
  collaborateurs illimités » est un argument de vente immédiat. **Décidé.**
- **Les prix peuvent-ils changer ?** Oui, mais jamais en cours de licence : un prix ne change qu'au
  renouvellement, et il est annoncé au moins trente jours avant. **Décidé.**
- **Une remise pour deux ans ?** Une licence de deux ans existe déjà dans les durées proposées. Son
  prix (remise ou pas) est **à toi**.
- **Le cabinet a-t-il besoin d'une licence SkanFact entreprise pour lui-même ?** S'il veut facturer
  ses honoraires avec SkanFact, oui, au prix normal — c'est une entreprise comme une autre. Pour le
  pilote : gratuite pendant le pilotage. **À toi.**

### Le comptage des dossiers

- **Comment on compte un dossier ?** Un dossier **actif** (non archivé), avec au moins une écriture
  validée dans les douze derniers mois, **sans licence client valide**. Un dossier archivé ne compte
  jamais : ses livres restent lisibles pour toujours. **Décidé.**
- **Qu'est-ce qu'un dossier « sur SkanFact » ?** Un dossier dont le dernier paquet a moins de treize
  mois et porte une licence valide (ou un essai de moins de 30 jours). Le cabinet voit venir
  l'expiration 30 jours avant : c'est lui qui rappelle son client, l'intérêt est le sien.
  **Décidé.**
- **Et si le client ne renouvelle pas ?** **Le dossier reste gratuit douze mois de plus.**
  **Décidé — corrigé le 15/09/2026 après une troisième relecture extérieure ; ce document disait
  60 jours, et c'était une faute de conception.** Le raisonnement qu'elle a cassé était : « le
  cabinet le voit venir, l'intérêt est le sien ». C'est vrai de l'intérêt, c'est faux du **pouvoir** :
  le cabinet peut rappeler son client, il ne peut pas le forcer à payer. À 60 jours, un client qui
  oublie, qui a un trou de trésorerie ou qui arrête son activité fait **arriver une facture chez son
  comptable**, qui n'a rien demandé et n'a rien pu faire. On aurait fabriqué la seule chose qu'on ne
  peut pas se permettre avec un prescripteur : le sentiment d'être puni pour le comportement de
  quelqu'un d'autre. Douze mois, c'est un exercice entier — le temps de convaincre, ou de constater
  que ce client-là est redevenu un dossier ordinaire. Et ce délai est **affiché** sur le dossier :
  « gratuit jusqu'au 14/10/2027, sans renouvellement il comptera ensuite ».
- **La grâce s'applique-t-elle après un simple essai ?** **Non — et c'est un trou que la règle
  ci-dessus laissait ouvert**, trouvé en relisant une objection extérieure. Un essai de 30 jours
  compte comme « sur SkanFact » ; avec douze mois de grâce derrière, un client qui n'a jamais rien
  payé aurait rendu son dossier gratuit treize mois. **La grâce ne suit qu'une licence PAYÉE
  expirée.** Après un essai non converti, le dossier compte dès la fin de l'essai. **Décidé.**
- **Et après les douze mois, un tarif réduit plutôt que le plein ?** Proposé par une relecture (« le
  cabinet n'est pas responsable du choix de son client »). **Refusé, avec la raison.** Au bout de
  douze mois, ce dossier n'est plus « un ancien client SkanFact » : c'est un dossier hors SkanFact
  comme les cinquante-sept autres, et lui faire un prix à vie créerait une catégorie que le cabinet
  aurait intérêt à fabriquer — un client mis sur SkanFact un an puis laissé expirer coûterait moins
  cher, pour toujours, qu'un client jamais inscrit. Ce qui absorbe déjà le cas de bonne foi : les
  trois dossiers gratuits, les paliers dégressifs, et la règle « un dossier sans écriture validée
  depuis douze mois ne compte pas ». Quant à « cacher » un dossier : archiver bloque la validation
  d'écritures, donc on ne cache pas un dossier sur lequel on travaille.
- **Le cabinet qui perd un client au profit d'un confrère paie-t-il pour autant ?** Non : un dossier
  sans écriture validée depuis douze mois ne compte pas, quoi qu'il arrive. Les deux règles se
  recoupent exprès — on préfère compter un dossier de moins que d'en facturer un de trop.
- **Et un paquet fabriqué par une ancienne version, sans licence dedans ?** Le dossier compte comme
  hors SkanFact **et l'écran le dit** (« demande à ton client de mettre à jour SkanFact et de
  renvoyer le mois »), jamais en silence.
- **Que se passe-t-il si le cabinet dépasse son quota ?** Un bandeau, une ligne dans « À faire »,
  puis la **validation de nouvelles écritures** est bloquée sur les dossiers au-delà du quota. Le
  cabinet choisit lesquels restent actifs. Lire, exporter, imprimer, déclarer ce qui est validé :
  toujours. **Décidé.**
- **Et si le cabinet triche (archive un dossier pour ne pas le compter) ?** Un dossier archivé ne
  peut plus recevoir d'écriture validée. S'il le désarchive, il compte à nouveau. On ne construit
  pas de police au-delà : un cabinet qui veut tricher trichera, et ce n'est pas un client qu'on
  cherche.
- **Et si le comptage se trompe au détriment d'un cabinet honnête ?** C'est le risque le plus grave
  de ce mécanisme : un fichier abîmé, une licence client mal lue, et un cabinet qui a payé se
  retrouve bloqué un matin de déclaration. Deux garde-fous. **Le doute profite toujours au
  cabinet** : une licence client qu'on ne peut pas juger compte comme valide, un dossier dont on ne
  sait rien ne compte pas. Et **un blocage nomme toujours les dossiers comptés**, un par un, avec le
  bouton pour en archiver un : jamais un refus sans la liste qui l'explique ni le geste qui le lève.
  **Décidé.**

### L'argent

- **Le cabinet gagne quoi à amener un client ?** Il faut distinguer deux cas, et ce document les
  confondait sous un « 72 DT de moins par an » qui n'est vrai que dans l'un des deux (relevé par la
  troisième relecture extérieure). **Un client qu'il a déjà** et qu'il fait passer sur SkanFact : ce
  dossier sortait de sa poche, il n'en sort plus — 72 DT réels, chaque année, et c'est le cas
  courant, puisqu'un cabinet qui découvre SkanFact a par construction soixante dossiers hors
  SkanFact. **Un client nouveau** qu'il amène : ce dossier n'était facturé nulle part, donc il ne
  fait baisser aucune facture ; son gain est ailleurs — des pièces propres, des écritures déjà
  écrites, et un client qui lui coûte moins d'heures. Dans les deux cas : **jamais d'argent versé au
  cabinet.** **Décidé, reformulé le 15/09/2026.**
- **Et un cabinet dont TOUS les dossiers sont sur SkanFact ?** Il ne paie rien, donc il n'a plus rien
  à économiser : la remise ne peut plus rien pour lui. C'est voulu, et c'est même l'objectif — le
  meilleur client du modèle est celui qui n'a plus de facture. Ce qui le retient alors n'est plus le
  prix, c'est le produit. Si ce n'est pas suffisant, le modèle est faux et aucune remise ne le
  sauvera.
- **La remise de −20 % au client parrainé, elle, porte sur quoi ?** Sur la **première année de la
  licence du client**, pas sur la facture du cabinet — ce sont deux remises distinctes, sur deux
  factures distinctes, et les nommer pareil a déjà créé une confusion dans ce document. Coût total
  d'une conversion pour l'éditeur : 78 ou 138 DT chez le client, plus 72 DT chez le cabinet.
  **Décidé.**
- **Est-ce que l'Ordre l'accepte ?** Je n'en sais rien, et je ne peux pas le dire à sa place.
  L'argument qu'on lui présentera : aucun argent ne circule vers le cabinet, il paie simplement
  moins un outil qu'il aurait payé de toute façon. Tant que l'Ordre n'a pas répondu, cette phrase
  est un argument, pas une garantie, et rien n'est publié sur la page Tarifs. **À VALIDER
  JURIDIQUEMENT, avant la première vente à un cabinet.**
- **Le pilote paie ?** Non pendant le pilotage : quota gratuit sur ses dossiers de test. **À toi.**
- **Comment on encaisse ?** Par virement ou carte, hors application. Tu marques « payée » dans la
  console, et la clé part par mail dans la seconde (si Resend est réglé) ou se copie à la main. Le
  paiement en ligne (Konnect, Paymee, Flouci, ClicToPay — À VÉRIFIER lequel accepte une SUARL et à
  quel coût) branchera le même bouton plus tard. **Décidé.**
- **Qui émet la facture de licence ?** SKANCYBER SECURITY SUARL, depuis SkanFact entreprise : le
  module Éditeur tire les ventes de la console et crée un brouillon de facture, que tu émets comme
  n'importe quelle facture. Elle entre dans ta comptabilité, avec sa TVA, et part dans ton paquet à
  ton comptable. **Livré.**
- **Dans quel ordre se passe une vente, exactement ?** (1) Le client demande une licence depuis
  l'application (« Demander une licence » prépare un mail avec son matricule et, s'il en a un,
  l'empreinte de son cabinet) ou par le site. (2) Tu crées la vente dans la console : client, offre,
  durée, prix, remise de parrainage. (3) Tu ouvres SkanFact : le brouillon de facture est là, tu
  l'émets et l'envoies au client. (4) Le client paie par virement ou carte. (5) Tu marques la vente
  « payée » dans la console : la clé est signée et envoyée par mail dans la seconde. (6) Le client
  colle la clé dans Paramètres → Licence. (7) À l'émission, SkanFact a rendu le numéro de facture à
  la console. **Livré.**
- **Et pour un cabinet ?** Le même circuit, avec un client de type cabinet, un quota de dossiers, et
  un prix par palier. **À construire (étape 4 de `DIRECTION.md`).**
- **Remboursement, rétractation ?** Un avoir sur la facture et une révocation de la licence. La
  limite est dite en clair : une clé livrée continue chez le client jusqu'à sa date, sauf si sa
  version de SkanFact embarque la clé de réponse (voir § 8). **Livré.** Le délai de rétractation
  accordé (14 jours ?) est **à toi**, et à écrire dans les conditions de vente.
- **Renouvellement ?** Réclamé 30 jours avant dans « À faire » (et par mail au client, À construire
  côté console), il part de la fin de la licence en cours : les trente jours d'avance sont payés.
  Prorata pour une montée d'offre ou de quota en cours d'année. La remise de parrainage ne vaut que
  la première année. **Livré.**
- **La TVA sur les licences ?** Celle de ton régime, posée par l'application sur la facture.
  **À VÉRIFIER : le taux applicable aux licences logicielles.**
- **Ça peut rapporter combien ?** Ordre de grandeur pour un cabinet de 60 dossiers dont 10 sur
  SkanFact : 6 900 DT par an payés par les entreprises, 3 384 DT par an payés par le cabinet. Dix
  cabinets comme celui-là : cent mille dinars par an. Un chiffre à vérifier avec le premier cabinet
  réel.
- **Ça coûte combien à faire tourner ?** Presque rien : Cloudflare (relais, plateforme, base) gratuit
  à ce volume, le domaine et la boîte mail chez OVH (à renouveler chaque année), Resend gratuit à
  petit volume, GitHub Actions gratuit tant que le dépôt est public, et l'abonnement à Claude pour
  le développement. Aucune donnée hébergée.
- **Le site vend-il ?** Il présente les deux produits et donne le contact. La vente se fait par mail
  et console : un clic, pas zéro. L'inscription en autonomie viendra après les premières ventes.
  **Décidé.**
- **Comment les dix premiers clients nous trouvent-ils ?** Ils ne nous trouvent pas : **on va les
  chercher**, un par un. La troisième relecture extérieure a raison de dire que ce document n'avait
  pas de plan d'acquisition — il avait trois phrases (« par les clients », « le pilote s'il en
  parle », « le jeu d'exemple ») qui décrivent une propagation, pas une démarche. Ce qui est réaliste
  pour une personne seule, dans l'ordre : **le cercle proche d'abord** (le père, le frère, leurs
  fournisseurs et leurs clients — ce sont de vraies entreprises, pas des faveurs) ; **le cabinet
  pilote ensuite**, qui parle à ses confrères mieux que n'importe quelle publicité ; puis **la
  démonstration en personne**, une heure chez le client, qui est la seule chose qui convertisse
  quand on est inconnu. Le reste — référencement, réseaux sociaux, chambres de commerce — vient
  après, quand il y a des clients à citer : un site bien référencé qui ne montre aucun client ne
  vend rien.
- **Et comment on saura si ça marche ?** En comptant trois choses, à la main, dans un tableur :
  combien de démonstrations faites, combien d'essais démarrés (la plateforme les voit), combien de
  licences vendues. Trois nombres par mois. Si les démonstrations se transforment mal, le problème
  est le produit ou le prix ; s'il n'y a pas de démonstrations, le problème est qu'on ne va pas
  chercher les gens. **À toi** — c'est un geste de dix minutes par mois, et c'est le seul moyen de
  ne pas confondre « le produit avance » avec « le projet avance ».
- **Que faut-il pour pouvoir vendre, exactement ?** La liste est courte et elle est entièrement à ta
  main : le **dépôt de la marque**, la **signature de code** (§ 9), les **conditions de vente** et la
  **déclaration INPDP** (§ 11), le **bouton de téléchargement du Cabinet** qui mène aujourd'hui à un
  404, la validation fiscale avec le comptable (qui débloque la 9.1.1), et la **page unique** du § 3.
  Aucune de ces six choses n'est du développement, et aucune ligne de code neuve ne rapportera un
  dinar tant qu'elles ne sont pas faites.
- **Il faut des conditions générales de vente ?** Oui : ce qu'achète le client (un droit d'usage
  d'un an, par matricule), ce qui se passe à l'expiration (jamais de données en otage), le
  remboursement, le support (par mail, sans engagement de délai), la responsabilité (l'application
  calcule et propose, le comptable valide), et la politique de confidentialité (rien ne remonte). À
  écrire avant la page Tarifs, à faire relire par un juriste. **À toi, À VÉRIFIER.**
- **La marque « SkanFact » est-elle protégée ?** Pas aujourd'hui. Un dépôt à l'INNORPI (l'institut
  tunisien de la propriété industrielle) protège le nom. **À toi.**

---

## 8. La licence et la plateforme

### La clé de licence

- **Comment marche une licence, simplement ?** L'éditeur écrit une petite fiche (matricule de
  l'entreprise, offre, date de fin, options) et la **signe** avec sa clé privée. Le résultat est une
  chaîne `SKAN1.…` que le client colle dans son application. L'application vérifie la signature avec
  la clé publique embarquée : si elle est bonne, la fiche est authentique. Personne ne peut fabriquer
  une clé sans la clé privée. Aucun serveur n'est nécessaire. **Livré.**
- **Qu'est-ce qui est dans la fiche signée ?** Le matricule (la clé est attachée à une entreprise),
  le nom, l'offre (Indépendant ou Entreprise), la date de fin (ou « à vie » — ce qui veut dire, très
  exactement, **aucune date de fin dans la clé** : elle reste valide tant que l'application sait la
  vérifier, c'est-à-dire tant que la clé publique qui l'a signée est embarquée ; ce n'est ni « la
  vie du client » ni une date lointaine écrite en dur, et rien ne peut l'éteindre sinon une
  révocation signée), la date d'émission,
  l'empreinte du cabinet parrain s'il y en a un, l'identifiant de la clé de signature (`kid`), un
  identifiant de licence (`sub`), et demain les options (`options: ['compta']`) et, pour un cabinet,
  le type et le quota. Un champ qu'une vieille version ne connaît pas est ignoré. L'ordre des champs
  ne change jamais (un champ déplacé changerait la signature).
- **La clé est attachée à quoi ?** Au matricule fiscal (les sept chiffres et la lettre). Une clé
  émise pour une entreprise est refusée par une autre, en nommant les deux matricules. Elle vit dans
  le dossier de l'entreprise, donc un dossier partagé sur trois postes l'emporte avec lui. Un
  matricule vide ne compte pas : on ne punit pas qui n'a pas rempli sa fiche.
- **Un client se trompe de matricule, ou change de forme juridique ?** Une correction de matricule
  donne une clé neuve **sans facture** : la licence est déjà payée. **Livré.**
- **Et la licence du Cabinet ?** Le même mécanisme. Le sujet de la licence est l'**empreinte de la
  clé du cabinet** (qui existe déjà), la fiche porte `type: cabinet` et le quota de dossiers hors
  SkanFact. Vérifiée hors ligne. **Décidé, à construire après la saisie (§ 16).**
- **L'essai de 30 jours ?** Compté par ordinateur, depuis le jour où l'application a vu pour la
  première fois la clé publique (donc depuis la mise à jour qui l'a embarquée, pas depuis
  l'installation). Un second dossier créé après la fin de l'essai s'ouvre verrouillé : c'est voulu.
  Reculer l'horloge ou réinstaller sans ses données rejoue l'essai : accepté, ce n'est pas un
  client. L'essai inclut toutes les offres et l'option Comptabilité. **Décidé.**
- **Le piratage ?** Le code est ouvert ; le secret est la clé, pas le code. On ne combat pas le
  pirate individuel : la valeur est dans les mises à jour, le support et le pont avec le cabinet.
  **Décidé.**
- **Un client perd sa clé ?** La console la refabrique à l'identique (« Voir la clé », « Renvoyer
  par mail ») : la signature est déterministe, la même fiche redonne la même clé. **Livré.**

### Les clés de signature

- **Combien de clés, et où sont-elles ?** Trois. La **clé maître** (`master`) : créée dans SkanFact
  le 14/09/2026, sa moitié privée vit sur le Mac de Skander (`~/.skanfact/`) avec une copie à
  l'abri, sa moitié publique est embarquée dans l'application. Aucune session Claude ne l'a jamais
  vue. La **clé serveur** (`srv-1`) : de second rang, avec laquelle la console signe les ventes ; sa
  privée est dans un réglage Cloudflare, sa publique dans le même fichier embarqué. La **clé de
  réponse** : celle avec laquelle le serveur signera les révocations ; celle du 15/09/2026 a été
  brûlée (sa privée a été vue) et sera recréée le jour de la mise en production, dans SkanFact, sur
  le poste de l'éditeur. **Décidé.**
- **Pourquoi plusieurs clés ?** Pour pouvoir en retirer une sans invalider les autres. Si la clé
  serveur est compromise, on la marque retirée et on réémet les licences qu'elle a signées ; les
  licences signées par la maître ne bougent pas. Chaque clé porte un identifiant (`kid`) ; une
  licence sans identifiant se vérifie avec la maître, et avec elle seule. On n'essaie jamais toutes
  les clés à la suite : c'est ce qui permet de retirer une clé pour de vrai.
- **Que se passe-t-il si la clé maître est perdue ?** Plus aucune licence ne peut être signée par
  elle ; il faudrait une nouvelle clé et réémettre toutes les licences. C'est pourquoi sa copie à
  l'abri est la chose la plus précieuse du projet.
- **Et si elle est compromise ?** On la marque retirée (jamais supprimée du fichier : les vieilles
  licences doivent rester vérifiables le temps de les réémettre), on signe avec une autre, on réémet.
- **Ce qui commence par `BEGIN PRIVATE KEY` ne se colle que dans Cloudflare ; ce qui commence par
  `BEGIN PUBLIC KEY` se colle dans le dépôt.** Une clé privée qui a été collée ailleurs est brûlée
  et se recrée. **Décidé.**
- **Que signe qui ?** La clé maître signe les licences émises depuis le module Éditeur de SkanFact
  (sur le Mac de Skander). La clé serveur signe les licences vendues depuis la console. Les deux sont
  acceptées par l'application. La clé de réponse ne signe que les réponses du serveur (révocations).

### La plateforme

- **C'est quoi, exactement ?** Un programme (« worker ») sur Cloudflare, à l'adresse
  `api.skanfact.tn`, avec une base de données (D1, six tables : clients, licences, activations,
  ventes, jetons, événements). Il connaît les clients, les licences, les activations, les
  révocations, les ventes. Sa page d'administration, la **console**, s'ouvre dans un navigateur à la
  même adresse avec le secret d'administration. **Livré (P 0.1, P 0.2).**
- **Pourquoi un serveur, alors qu'on n'en voulait pas ?** Parce qu'un ordinateur de bureau est
  éteint la nuit : si quelqu'un achète à 3 h du matin, il faut que quelque chose d'éveillé signe sa
  clé et l'envoie. C'est la seule raison. La licence reste vérifiée hors ligne ; le serveur ne sert
  qu'à **gérer**, jamais à faire fonctionner. **Décidé.**
- **Que fait la console ?** Voir les essais en cours, les licences actives, expirées, révoquées, les
  ordinateurs vus ; émettre une licence (signée par la clé serveur) ; la marquer payée (la clé part
  par mail dans la seconde) ; renouveler, changer d'offre, révoquer avec un motif ; demain gérer les
  cabinets, leurs quotas et l'option Comptabilité. **Livré, à étendre.**
- **Quels réglages vivent sur Cloudflare ?** Pour la plateforme : `ADMIN_SECRET` (le secret de la
  console), `LICENCE_PUBLIC_KEYS` (les clés publiques, pour vérifier), `SRV_PRIVATE_KEY` (la clé
  serveur, pour signer), `REPONSE_PRIVATE_KEY` (la clé de réponse, à poser en production),
  `RESEND_API_KEY` (le mail), `LICENCE_REQUISE` (0 aujourd'hui). Pour le relais : le jeton GitHub
  et le secret de l'application. Rien de tout ça n'est dans le code. **Livré.**
- **Que remonte au serveur depuis une application ?** L'empreinte de la licence, l'identifiant du
  poste, son nom, la plateforme, la version. **Jamais** un client, une facture, un montant, un nom de
  dossier. Un test compte les champs pour que personne n'en ajoute « juste un ». Un essai s'annonce
  aussi (sans clé), sinon l'éditeur ne verrait jamais ses essais. **Décidé.**
- **Et si le serveur ne répond pas ?** Rien ne change dans l'application, aucun message rouge. Tout
  ce qui touche au serveur est facultatif. Un test coupe le serveur et vérifie qu'on ne voit rien.
  **Livré.**
- **La révocation s'applique quand ?** À la prochaine connexion de l'application au serveur, et
  seulement si sa version embarque la clé de réponse. La réponse du serveur n'est crue que si elle
  est signée, datée et adressée à cette licence : sinon un intermédiaire malveillant (un wifi
  d'hôtel) pourrait révoquer un client qui a payé. Le serveur peut **ajouter** une restriction
  prévue, jamais accorder un droit ; lever une révocation exige la même preuve que la poser.
  **Livré, en attente de la clé de réponse.**
- **Le pont entre la console et SkanFact ?** SkanFact **tire** les ventes de la console (un serveur
  ne peut pas écrire dans un logiciel éteint), fabrique un brouillon de facture par vente, et rend le
  numéro à l'émission. L'historique des licences émises avant la console y a été envoyé une fois. Le
  secret d'administration vit à côté des clés, jamais dans les données. **Livré (8.7.0).**
- **Le relais de mise à jour, c'est la même chose ?** Non : un second worker, séparé
  (`skanfact-maj`), qui sert les fichiers de release aux applications. Il détient le jeton GitHub ;
  les applications présentent un secret embarqué à la construction. Deux métiers, deux programmes.
  Si le relais tombe, l'application retombe sur GitHub directement. **Livré.**
- **Les mails partent d'où ?** Les mails automatiques de la console (la clé après paiement) partent
  par Resend, depuis `send.skanfact.tn`. La boîte `contact@skanfact.tn` (OVH, Zimbra) reçoit les
  demandes de licence et les signalements de problème. Elle doit exister avant la fin du premier
  essai. **Livré ; la clé Resend reste à poser sur Cloudflare (À toi).**
- **Comment on modifie la plateforme ?** Le code du worker est dans le dépôt
  (`plateforme/skanfact-api.mjs`) ; Skander le colle dans l'éditeur de Cloudflare (il l'a fait pour
  la 8.7.0 : 1 635 lignes). La base se crée et se met à jour en collant `schema-a-coller.sql` ; les
  changements de base sont toujours **additifs** (on ajoute une colonne, on n'en retire jamais), et
  le README de la plateforme dit quoi coller quand. **Décidé.**
- **La base de la plateforme est-elle sauvegardée ?** Cloudflare la conserve, mais aucun export
  automatique n'existe. C'est la seule donnée du projet qui n'est pas sur un poste de Skander, et
  ce document la remettait « avec la licence du Cabinet », c'est-à-dire trop tard : une relecture a
  eu raison de le dire. Ce qu'on perdrait si Cloudflare perdait la base — les clients gardent leurs
  clés signées, mais on ne peut plus révoquer, ni voir qui a activé quoi, ni renouveler sans
  ressaisir. **Décidé : une route `GET /v1/admin/export`, protégée par le secret d'administration,
  qui rend les six tables en un JSON ; SkanFact l'appelle depuis le panneau Éditeur (« Sauvegarder la
  console… ») et range le fichier à côté des clés, dans `~/.skanfact/`, daté ; et « À faire » le
  réclame s'il a plus de trente jours. À construire AVANT la première vente — une heure de travail
  côté worker, une côté application.** Une tâche planifiée viendrait après, quand il y aura de quoi
  planifier.

---

## 9. Le quotidien : installer, vendre, dépanner

### Installer et démarrer

- **Comment un client installe SkanFact ?** Il télécharge l'installateur depuis le site (ou la page
  Releases) : `.dmg` sur Mac, `.exe` sur Windows. Au premier lancement, le système prévient que
  l'application n'est pas signée (Mac : clic droit → Ouvrir ; Windows : « Informations
  complémentaires → Exécuter quand même »). Puis l'assistant pose ses questions : métier, régime
  fiscal, société, modules. Dix minutes. **Livré.**
- **Cet avertissement est-il acceptable pour vendre ?** Non, et c'est le point sur lequel la
  troisième relecture extérieure a le plus raison. Ce document classait la signature de code dans
  « le jour où ça vend » : c'est l'ordre inverse du vrai. **Un expert-comptable ne clique pas sur
  « Exécuter quand même » sur le poste de son cabinet** — et il a raison de ne pas le faire, c'est
  exactement le réflexe qu'on lui a appris. Ce n'est donc pas une gêne au premier lancement, c'est
  un mur devant la première vente, et le seul de la liste qu'on ne peut pas franchir avec du travail.
  **Décidé — requalifié le 15/09/2026 : la signature passe de « le jour où ça vend » à « avant la
  première vente ».** C'est la dépense la plus rentable du projet : elle ne rend l'application
  meilleure en rien, et sans elle rien ne se vend.
- **Qu'est-ce que ça coûte, exactement ?** Côté Apple : le programme développeur, de l'ordre de
  99 $/an, qui donne la signature **et** la notarisation — et qui supprime l'avertissement
  entièrement. Côté Windows, c'est plus nuancé qu'il n'y paraît et le chiffre seul induit en erreur :
  un certificat **OV** (le moins cher) est signé mais ne supprime pas tout de suite l'écran
  SmartScreen, qui se lève avec la réputation, c'est-à-dire après un certain nombre de
  téléchargements — donc précisément pas pour les premiers clients. Un certificat **EV** lève
  SmartScreen immédiatement, coûte nettement plus cher, et depuis 2023 sa clé doit vivre sur un
  support matériel ou dans un HSM, ce qui complique la signature depuis GitHub Actions. **À VÉRIFIER :
  les prix du jour, les fournisseurs qui livrent en Tunisie, et si la signature EV est faisable
  depuis le workflow ou s'il faut signer sur le Mac.** L'ordre de grandeur à retenir pour décider :
  quelques centaines d'euros par an, à comparer à une seule licence Entreprise vendue.
- **Et si le budget ne suit pas tout de suite ?** Alors on signe **Mac d'abord** (c'est le moins cher,
  c'est le poste de Skander, et c'est là que l'avertissement disparaît complètement pour 99 $), et on
  accompagne le téléchargement Windows d'une page qui explique l'écran SmartScreen avec une capture,
  plutôt que de laisser le client le découvrir seul. Ce n'est pas une solution, c'est un pansement
  daté : il tient le temps de vendre les premières licences, pas au-delà.
- **Quels systèmes sont supportés ?** macOS (Intel et Apple Silicon, un seul installateur
  universel) et Windows 10/11 64 bits. Pas de Linux, pas de téléphone, pas de navigateur.
- **Comment un cabinet installe SkanFact Cabinet ?** Même téléchargement (le bouton du site reste à
  réparer), même avertissement. Au premier lancement : un mot de passe (obligatoire), la création de
  sa paire de clés, et l'assistant : nom du cabinet, e-mail, coller sa liste de clients depuis un
  tableur. Puis, tout de suite : **enregistrer la clé de secours** sur une clé USB, et donner son
  fichier d'appairage à ses clients. **Livré.**
- **Comment un cabinet amène un client sur SkanFact ?** Il lui envoie le lien de téléchargement et
  son fichier d'appairage, lui dicte son empreinte au téléphone. Le client installe, passe
  l'assistant, importe l'appairage dans Paramètres → Cabinet comptable, et envoie son premier mois.
  Le cabinet le voit passer au vert. Demain, un bouton « Inviter un client » dans le Cabinet fera
  tout ça d'un geste. **Livré, le bouton à construire.**
- **Un client qui passe d'un autre logiciel ?** Il ressaisit ses clients et son catalogue (ou colle
  une liste), commence ses factures dans SkanFact à partir d'un numéro qu'il choisit (la
  numérotation continue la sienne), et garde son ancien logiciel pour consulter le passé. Il n'y a
  pas d'import de factures d'un autre logiciel : une facture émise ailleurs reste là-bas.
  **Décidé.**
- **Un client qui change d'ordinateur ?** Il copie son dossier (ou restaure sa copie externe) sur
  le nouveau poste : Paramètres → Sécurité et données → Restaurer. La licence suit le dossier.
  L'essai, lui, est compté par ordinateur. **Livré.**
- **Un cabinet qui change d'ordinateur ?** Sur le nouveau poste, à l'écran du mot de passe : « J'ai
  déjà un cabinet sur un autre ordinateur… », avec sa copie externe ou sa clé de secours. La même
  empreinte doit s'afficher à l'arrivée, sinon les clients seraient refusés. **Livré.**

### Vendre et facturer

- **La routine de Skander, éditeur ?** Chaque semaine : ouvrir la console (essais en cours, ventes
  à facturer, renouvellements à venir), émettre et envoyer les factures depuis SkanFact, marquer
  payées les ventes réglées, répondre aux mails de `contact@`. Chaque mois : envoyer son propre
  paquet à son comptable (les licences vendues sont des ventes comme les autres). Chaque année :
  renouveler le domaine chez OVH et vérifier que la clé maître est toujours en lieu sûr.
- **Que fait le client en fin d'essai ?** Un bandeau orange la dernière semaine, puis « création
  bloquée » avec le bouton « Demander une licence » qui prépare le mail. Il lit, imprime, exporte et
  envoie son paquet sans limite. **Livré.**
- **Que fait le cabinet quand il dépasse ses dossiers gratuits ?** Un bandeau, une ligne « À
  faire », puis la validation bloquée sur les dossiers au-delà du quota, avec « Demander une
  licence ». **À construire.**
- **Comment on présente le produit à un cabinet ?** Avec le jeu d'exemple : le Cabinet s'ouvre
  rempli (dossiers, paquets, retards, et demain les livres). Puis avec un vrai dossier du cabinet,
  repris par balance d'ouverture. Le jeu d'exemple s'efface tout seul au premier vrai paquet.
- **Comment on présente le produit à une entreprise ?** Trente jours d'essai complet, l'assistant,
  le jeu d'exemple, et l'aide intégrée. Pas de démonstration en personne nécessaire.

### Dépanner

- **Un client a un problème : que se passe-t-il ?** Il clique « Signaler un problème » (Aide ou
  Paramètres) : un mail part vers `contact@skanfact.tn` avec le journal technique joint. Skander le
  transmet à Claude, qui reproduit, corrige, teste et publie une version corrective (regroupée avec
  d'autres si possible). Le client la reçoit dans les quatre heures suivant la publication. Aucun
  délai n'est promis contractuellement. **Livré.**
- **Un client a une idée ?** « Proposer une amélioration » : deux questions (ce qu'il voudrait faire,
  comment il s'en sort aujourd'hui), sans journal. Skander décide ; une idée retenue entre dans le
  prochain lot. **Livré.**
- **Un client a oublié son mot de passe (app entreprise) ?** Ses données sont perdues, sauvegardes
  comprises (elles sont chiffrées avec le même mot de passe). L'écran le disait en gras avant
  l'activation. Il repart de zéro, ou d'une sauvegarde d'avant le chiffrement s'il en a une. Rien
  d'autre n'est possible, et c'est le prix d'un vrai chiffrement. **Décidé.**
- **Un cabinet a oublié son mot de passe ?** Même règle pour ses données (portefeuille, relances,
  demain les livres). Mais sa **clé de secours**, scellée par son propre mot de passe (choisi à
  l'exportation), lui rend la paire de clés : il recrée un cabinet vide avec la même empreinte, et
  réimporte les paquets (ils sont sur son disque, chiffrés pour cette clé). **Livré.** Le jour où
  les livres existeront, leur perte sera plus chère : d'où la copie externe et les sauvegardes, qui
  restent lisibles tant que le mot de passe est connu.
- **L'application dit « L'application n'a plus répondu pendant N secondes » ?** Le chien de garde
  a relancé l'interface ; le journal nomme la fonction. Si l'ordinateur dormait, c'était un faux
  positif, corrigé en 8.1.0. Si ça se reproduit, « Signaler un problème ».
- **Un client refuse les mises à jour ?** Il peut rester sur sa version pour toujours ; elle
  continue de fonctionner. Seule la dernière version est suivie : un défaut se corrige dans une
  nouvelle version, jamais dans une ancienne. Ses paquets restent lisibles par un Cabinet plus
  récent.
- **Un paquet ne s'ouvre pas au cabinet ?** L'application dit pourquoi en français : pas un paquet,
  adressé à un autre cabinet, protégé par mot de passe, version plus récente que le Cabinet, fichier
  altéré. Chaque cas a sa phrase et son geste.
- **La console ne répond pas ?** Vérifier d'abord depuis un autre réseau (le téléphone en 4G) : si
  ça marche, c'est le DNS du poste. Sinon, Cloudflare (le worker est-il déployé, les réglages
  sont-ils posés). Le journal technique de SkanFact note la cause exacte.

---

## 10. La technique du projet

### Le dépôt et le code

- **Où est le code ?** Sur GitHub, dépôt `saouthq/skanfact`, public. Un seul dépôt pour les deux
  applications : `src/` pour l'entreprise, `src/cabinet/` pour le cabinet, `src/renderer/` pour les
  écrans et les fichiers partagés, `plateforme/` pour l'API et la console, `worker/` pour le relais,
  `test/` pour les tests, `build/` pour les icônes, la configuration des installateurs et les clés
  publiques, `scripts/` pour la publication et les icônes.
- **Avec quoi c'est écrit ?** JavaScript pur, sans outil de compilation (pas de React, pas de
  bundler) : le fichier qu'on lit est celui qui tourne. Electron affiche l'interface. Les données
  sont des fichiers JSON, pas une base de données. Aucune bibliothèque tierce dans l'application (le
  ZIP, le chiffrement, le PDF sont faits avec ce que Node et Electron fournissent). **Décidé, ne pas
  rediscuter.**
- **Comment le code est organisé ?** Le **moteur** (`core.js`, ~70 fonctions de calcul pures :
  totaux, TVA, écritures, livres, paie, stock) est séparé des **écrans** (`app.js`). Le moteur se
  teste sans ouvrir l'application. Trois fichiers sont partagés par les deux applications : le
  menu d'actions d'une ligne (`rowmenu.js`), les réglages (`reglages.js`), la feuille de style
  (`style.css`). Demain, le moteur d'écritures (`compta.js`) le sera aussi. Tout fichier partagé
  doit être déclaré dans la configuration de construction du Cabinet, sinon l'application
  construite ne démarre pas.
- **Quelles sont les règles de code qui ne se discutent plus ?** Aucun taux fiscal écrit en dur dans
  un calcul. Une pièce émise garde une copie de ce qui a servi à la calculer. Aucun message d'erreur
  brut à l'écran. Une seule source de vérité par règle. Une seule porte par garde-fou. Les dates
  sont des jours du calendrier calculés en UTC. Les actions d'une ligne vivent dans un menu. Les
  réglages passent par le sommaire commun. Un test qui lit du code retire d'abord les commentaires.
  Un e2e reconnaît un écran à ce qu'il contient, jamais à son rang.

### Les tests

- **Comment on sait que c'est juste ?** Trois niveaux. `npm test` : 384 vérifications de calcul
  (TVA, numérotation, montants en lettres, balances, paie, fusion, chiffrement, paquet) en quelques
  secondes, lancées avant chaque enregistrement du code. Les **tests de source** : des vérifications
  qui relisent le code lui-même pour interdire une forme dangereuse (un garde-fou oublié, un taux en
  dur, une clé privée qui traverse le pont). Les **e2e** : 42 parcours qui ouvrent la vraie
  application, cliquent, tapent, mesurent (contraste des boutons, colonnes alignées, pages
  imprimées) et rejouent les deux applications à la suite (le cabinet appaire, l'entreprise envoie,
  le cabinet reçoit), plus le vrai worker de la plateforme sur une base locale.
- **Quelle est la règle sur les tests ?** Un test se prouve en réintroduisant le défaut qu'il est
  censé attraper : s'il reste vert, il ne teste rien. Une assertion sur un montant se calcule à la
  main à partir de la règle, jamais en recopiant ce que le code renvoie. Quand une règle change,
  c'est le test qui se relit en premier. Après une refonte, tous les parcours se relancent.
- **Et le test de parité ?** Le test qui comptera le plus pour le Cabinet : les douze paquets du jeu
  d'exemple, importés dans le Cabinet, doivent donner la même balance au millime que l'app
  entreprise. Un chiffre différent entre les deux applications ruinerait la confiance d'un comptable
  en une fois.
- **Où tournent les tests ?** Dans l'environnement de Claude (une machine Linux avec un écran
  virtuel pour les e2e) avant chaque publication, et sur le Mac de Skander pour `npm test` s'il le
  veut. Un seul e2e à la fois : deux écrans virtuels en même temps s'enlisent.

### La publication

- **Comment une version arrive chez les gens ?** On change le numéro de version, on écrit l'entrée
  du journal des modifications (`CHANGELOG.md`, qui devient les notes de version dans l'app), on
  lance les tests, on enregistre sur la branche `main`, et on déclenche le workflow **Release** sur
  GitHub Actions. Des machines Mac et Windows construisent les quatre installateurs (deux
  applications, deux systèmes), les attachent à la release avec les fichiers de mise à jour, et
  toutes les applications installées la voient dans les quatre heures. On vérifie que le run est
  vert **et** que les fichiers sont là avant de dire « publié ».
- **Ça coûte quelque chose ?** Sur un dépôt public, rien. Sur un dépôt privé, environ 0,65 $ par
  publication, et le quota gratuit d'un mois part en six publications (les machines Mac coûtent dix
  fois les autres). D'où la règle : **regrouper les corrections, publier une fois par lot.**
- **C'est quoi les branches ?** `main` est la version stable ; `beta` la version de travail qu'on
  peut publier en préversion (numéro `9.1.0-beta.1`) pour ceux qui ont coché la case bêta ; les
  branches `claude/…` sont celles où Claude travaille avant de fusionner dans `main`.
- **Les trois canaux de mise à jour ?** `latest` (l'app entreprise stable), `beta` (les préversions,
  pour qui a coché la case), `cabinet` (l'app du comptable). Un canal ne peut jamais réclamer les
  fichiers d'un autre. Une application ne revient jamais en arrière toute seule.
- **Que se passe-t-il si une version publiée est mauvaise ?** On ne la retire pas et on ne revient
  pas en arrière : on publie une version corrective par-dessus, le plus vite possible. Les
  sauvegardes prises avant la migration permettent de restaurer si des données ont été touchées.
  **Décidé.**
- **Les secrets de construction ?** Quatre valeurs stockées dans les secrets du dépôt GitHub et
  gravées dans l'application à la construction : l'adresse et le secret du relais (`UPDATE_BASE`,
  `UPDATE_SECRET`), l'adresse et le secret de la plateforme (`PLATEFORME_BASE`,
  `PLATEFORME_SECRET`). Jamais dans le code.
- **Mac et Windows sont traités pareil ?** Les deux sont construits et testés. Aucune des deux
  applications n'est **signée** (certificats Apple et Microsoft payants) : un avertissement apparaît
  au premier lancement, et la procédure est décrite. Sur Mac, la mise à jour passe par un script
  maison parce que le mécanisme d'Apple exige la signature. Windows a longtemps été la plateforme
  que personne ne testait : trois défauts invisibles depuis un Mac y ont été trouvés d'un coup.
- **Et si GitHub Actions ne marche pas ?** Un installateur local (`Installer SkanFact.command` sur
  Mac, `.bat` sur Windows) construit les deux applications depuis les sources, gratuitement.
- **Les données de développement et les vraies ?** Le mode développement (`npm start`) écrit dans
  un dossier séparé (« SkanFact (essais) ») : un accident de la 6.7.3 a montré que sinon il
  travaillait sur les vraies factures.

### L'infrastructure autour

- **Le domaine `skanfact.tn` ?** Commandé chez OVH le 14/09/2026, ses serveurs de noms basculés chez
  Cloudflare le 15/09/2026. Le site est sur GitHub Pages ; l'API sur `api.skanfact.tn` ; les mails
  automatiques depuis `send.skanfact.tn` ; la boîte `contact@skanfact.tn` chez OVH (Zimbra). Le
  détail de chaque enregistrement DNS est dans `plateforme/DNS-skanfact-tn.md`.
- **Le site ?** Un dépôt à part (`skanfact-site`), qui présente les produits et la page Tarifs. Il
  doit gagner l'offre Cabinet (après l'Ordre), l'option Comptabilité, les conditions de vente, et un
  vrai téléchargement du Cabinet (le bouton actuel mène à un 404).
- **Pourquoi Cloudflare ?** Le relais y tournait déjà ; gratuit à cette échelle ; aucun serveur à
  administrer ; une seule facture à surveiller. **Décidé.**
- **Le DNS du Mac de Skander ?** Son Mac n'atteignait pas `api.skanfact.tn` alors que l'iPhone en
  4G y arrivait : un cache DNS local. Régler le Wi-Fi du Mac sur les serveurs 1.1.1.1 et 1.0.0.1
  règle le problème. **À toi.**
- **Quels comptes existent, et qui les tient ?** GitHub (le code, les releases, les secrets),
  Cloudflare (DNS, les deux workers, la base), OVH (le domaine, la boîte mail), Resend (les mails
  automatiques), Anthropic (Claude). Tous au nom de Skander. Leurs identifiants ne sont écrits nulle
  part dans le dépôt, et ne doivent jamais l'être.

---

## 11. Les données, la sécurité, la loi

- **Où sont les données ?** Sur le poste de l'utilisateur, dans un fichier JSON par dossier,
  chiffrable côté entreprise, chiffré obligatoirement côté cabinet. Rien chez nous. **Décidé.**
- **Les sauvegardes ?** Quotidiennes (30 jours), nommées avant chaque geste risqué, copie externe
  (iCloud, USB), et pour le cabinet une clé de secours exportable. Les sauvegardes se purgent par
  date, jamais par nom. **Livré.**
- **Si le poste est perdu ?** Restauration depuis la copie externe, avec l'annonce de ce qu'on va
  perdre. Pour le cabinet, sans clé de secours, les paquets déjà reçus sont illisibles pour
  toujours : l'écran le dit en rouge tant qu'elle n'est pas enregistrée. **Livré.**
- **Quel chiffrement ?** AES-256-GCM avec scrypt pour les fichiers, X25519 pour les paquets au
  cabinet, Ed25519 pour les licences. Rien de maison, jamais. **Décidé.**
- **Qu'est-ce qui sort de l'ordinateur ?** Trois choses, et rien d'autre : la vérification de mise à
  jour (version, secret de l'application, licence si elle existe) vers le relais ; l'activation de
  la licence (empreinte, poste, version) vers la plateforme ; et, si l'utilisateur l'active un jour,
  la lecture d'une photo de facture (en pause). Les mails partent de la messagerie de
  l'utilisateur, pas de nous. **Décidé.**
- **Les secrets « gravés » dans l'application sont-ils vraiment secrets ?** Non, et c'est assumé
  depuis la 6.7.0 : **tout ce qu'une application peut télécharger sans secret, quelqu'un qui ouvre le
  paquet le peut aussi.** Un secret embarqué arrête les curieux, pas un attaquant. La question qui
  compte est donc : que protège-t-il ? Deux choses sans gravité — l'accès aux fichiers de mise à
  jour (publics de toute façon tant que le dépôt l'est) et une route de **lecture** de la plateforme
  (« cette licence est-elle révoquée ? »). Ce qui serait grave n'est jamais embarqué : le **secret
  d'administration** de la console vit dans un fichier du Mac de Skander, et les **clés privées de
  signature** ne quittent ni son poste ni Cloudflare. Règle : **rien de sensible ne doit jamais
  dépendre d'un secret embarqué**, et ce qui décide de l'argent ou d'un droit se vérifie par une
  signature, pas par la connaissance d'un mot de passe. **Décidé.**
- **L'INPDP ?** Les applications tournent sur le poste : le responsable du traitement est
  l'utilisateur (l'entreprise ou le cabinet). La plateforme, elle, détient des empreintes et des
  contacts de clients et de cabinets : à déclarer. **À VÉRIFIER avant la première vente.**
- **Ce que la loi exige d'un logiciel de tenue comptable ?** Écritures validées irréversibles,
  numérotation continue sans trou, conservation dix ans, restitution des livres sous une forme
  lisible. Le Cabinet le fera (9.3.0 pour la validation, export complet). **À VÉRIFIER : le texte
  tunisien exact.**
- **Les mentions obligatoires sur une facture ?** L'application les pose : matricule, adresse,
  numéro continu, date, TVA par taux, timbre, retenue à la source, mention légale pour le régime
  forfaitaire, montant en lettres. Trois points restent marqués « À VÉRIFIER » dans l'application
  elle-même : l'assiette de la retenue (TTC hors timbre), l'avoir sans timbre, et la liste des taux.
- **La retenue à la source, c'est juste un pourcentage ?** Aujourd'hui oui, et c'est un peu court.
  Le taux, le montant, le net à payer, l'attestation et le report dans la déclaration d'employeur
  existent ; ce qui manque, c'est la **nature de l'opération** (honoraires, loyers, marchés,
  commissions…). Or c'est elle qui justifie le taux et qui **classe les lignes de la déclaration
  d'employeur** : sans elle, le comptable reclasse à la main chaque année. Une liste ouverte de
  natures, comme la liste des taux depuis la 8.3.0 (jamais fermée), chacune proposant son taux
  habituel sans l'imposer. **À construire**, avec les autres corrections fiscales.
- **Y a-t-il un seuil en dessous duquel la retenue à la source ne s'applique pas ?** Probablement
  oui en Tunisie (de l'ordre de 1 000 DT TTC pour certaines opérations), et l'application n'en tient
  compte nulle part : elle applique le taux qu'on lui donne, quel que soit le montant. Ça ne fausse
  rien tout seul — c'est l'utilisateur qui choisit le taux, pièce par pièce — mais l'application
  devrait **avertir** quand une facture est sous le seuil et porte quand même une retenue.
  **À VÉRIFIER avec le comptable**, puis un seuil réglable et un avertissement à l'émission, dans la
  même version que les autres corrections fiscales.
- **Le seuil par défaut vaudra donc 1 000 DT ?** Non, et c'est important : il vaudra **0, c'est-à-dire
  aucun seuil**, jusqu'à ce que le comptable donne le chiffre. Deux relectures extérieures ont
  recommandé « seuil réglable, par défaut 1 000 DT TTC » ; les suivre écrirait dans le code une règle
  de droit que personne n'a confirmée, et qui deviendrait fausse à la loi de finances suivante — c'est
  exactement ce que la règle du projet interdit depuis la 5.0.0 (« aucun taux n'est écrit en dur dans
  un calcul »). Un défaut à 0 ne change le comportement de personne et n'affirme rien ; un défaut à
  1 000 changerait en silence le montant de factures déjà justes. La bonne valeur par défaut d'une
  règle qu'on ne connaît pas est celle qui ne fait rien.
- **Un client exonéré de timbre fiscal (exportateur total, secteur public) ?** Le timbre se décoche
  par document (`applyStamp`), mais il n'existe pas de drapeau « ce client est exonéré » sur la fiche
  client : il faut donc y penser à chaque facture. **À construire (petit)** : une case sur la fiche
  client qui décoche le timbre par défaut sur ses documents.
- **Le taux de TFP est-il proposé selon le métier ?** Non : il vaut 2 % par défaut pour tout le
  monde, alors que l'industrie manufacturière est à 1 % (À VÉRIFIER) et que l'application connaît
  déjà le métier de l'entreprise. C'est exactement la règle de la 7.25.0 (« un réglage global qui a
  une bonne valeur par défaut par métier doit la prendre, sans l'imposer une fois le champ
  touché »), qui n'a pas été appliquée ici. **À construire (petit).**
- **Ces corrections fiscales, elles sortent quand ?** Elles étaient dispersées dans ce document sans
  version, ce qui est la meilleure façon de ne jamais les faire. **Décidé : elles forment un lot
  unique, la 9.1.1, publiée juste après l'outillage de la 9.1.0 et avant toute vente.** Le lot :
  l'exonération de timbre sur la fiche client, la TFP proposée par métier, le seuil de retenue
  réglable avec son avertissement, et le contrôle d'une heure sur l'e-facture ci-dessous. Chacune
  vaut entre une heure et un jour, aucune ne dépend du Cabinet, et toutes les quatre touchent des
  chiffres qui partent chez un tiers — l'administration, un client, un comptable. Elles passent donc
  **avant** le confort, et elles attendent une seule chose : la séance de validation avec le
  comptable, qui les tranche toutes les quatre en une fois.
- **Et la facture électronique tunisienne (TTN / El Fatoora), si elle devient obligatoire ?**
  On ne construit pas l'export maintenant (décision). Mais un contrôle gratuit vaut d'être fait une
  fois : **vérifier que le modèle de données porte déjà tout ce qu'un format officiel exigerait**
  (matricule complet, codes TVA, lignes détaillées, unités, références). S'il manque un champ, mieux
  vaut l'ajouter maintenant que migrer des milliers de factures le jour de l'obligation. **À faire
  une fois, en une heure.**
- **La signature Apple et Windows ?** Pas encore (certificats payants). **À toi, le jour où ça vend.**
- **Une mise à jour peut-elle casser des données ?** Chaque version migre les données et prend une
  sauvegarde avant. Les paquets et fichiers anciens restent lisibles pour toujours. **Décidé.**
- **Une faille de sécurité, ça se signale comment ?** En privé, par l'onglet Security du dépôt
  (`SECURITY.md` l'explique). Un correctif sort dans une nouvelle version, jamais dans une
  ancienne. Pas de programme de récompense. **Livré.**
- **Le support ?** « Signaler un problème » (dans l'Aide et les Paramètres) prépare un mail avec le
  journal technique ; « Proposer une amélioration » ne joint rien. Les deux écrivent à
  `contact@skanfact.tn`. **Livré.**
- **Le dépôt public, c'est un risque ?** Non pour le secret (la clé privée n'y est pas). Il est
  public pour que les publications soient gratuites ; il peut redevenir privé en changeant une
  ligne, et le champ « jeton d'accès » revient alors tout seul dans les Paramètres. Le jour de la
  bascule, une seule chose à vérifier : que le jeton du relais ait le droit de lire les releases.
  **Décidé.**
- **Le code est public : quelqu'un peut-il le copier et le vendre ?** Le dépôt ne porte pas de
  licence d'utilisation explicite (il dit « UNLICENSED »). Je ne dis pas le droit : ce que je peux
  affirmer, c'est que **rien ne l'empêche techniquement** et que la vraie protection est ailleurs —
  la clé, le service, les mises à jour, le pont avec le cabinet. **À VALIDER JURIDIQUEMENT**, et
  **à toi** : ajouter une licence de code explicite si tu veux clarifier.
- **Ce qui a été public le reste-t-il si le dépôt redevient privé ?** Oui. Tout ce qui a été publié
  a pu être copié, y compris l'historique. C'est sans conséquence ici — aucun secret n'a jamais été
  commité, par règle — mais ça se vérifie au lieu de se supposer : **un balayage de l'historique à
  la recherche de secrets est à faire une fois**, avant la bascule en privé (GitHub le propose dans
  l'onglet Security du dépôt). **À construire (petit).**

---

## 12. La construction : comment on travaille

- **Qui fait quoi ?** Skander décide (produit, prix, ordre, ce qu'il montre au comptable), teste
  sur son Mac et son PC, parle au comptable et à l'Ordre, détient les clés privées et les comptes.
  Claude écrit le code, les tests, les documents, publie les versions et vérifie les builds. Le
  comptable pilote juge chaque version sur son bureau. **Décidé.**
- **Par quoi on commence ?** La **9.1.0** : les livres lus dans les paquets côté Cabinet, le
  moteur partagé, le test de parité, et le module Comptabilité masqué côté entreprise. Elle
  n'attend personne, et c'est ce qu'il faut montrer au comptable pour obtenir les réponses au
  reste. **Décidé.**
- **Dans quel ordre ensuite ?** Le § 16 détaille chaque version. En résumé : 9.2.0 le livre par
  dossier → 9.3.0 la saisie → la licence du Cabinet → 9.4.0 la banque → 9.5.0 le fiscal mensuel →
  9.6.0 la clôture d'exercice → 9.7.0 immobilisations et stocks → 9.8.0 collaborateurs → 9.9.0
  révision et questions → 10.0.0 liasse et exemple complet. **Décidé.**
- **Pourquoi la licence du Cabinet arrive après la saisie ?** Parce que c'est la saisie qui crée le
  premier dossier hors SkanFact, donc la première chose qu'on peut vendre. Avant, il n'y a rien à
  compter.
- **Quand une version est-elle « finie » ?** Quand : le numéro et le CHANGELOG sont écrits ;
  `npm test` passe ; les e2e concernés passent dans la vraie application, et tous les parcours
  après une refonte ; chaque nouveauté a sa bulle d'aide et son paragraphe d'article ; les données
  anciennes migrent sans perte ; la release est publiée avec ses quatre installateurs ; et le
  pilote l'a vue. Pas avant. **Décidé.**
- **Combien de temps ?** Plusieurs mois de construction ; la vraie horloge, ce sont les réponses du
  comptable. Chaque version est finie, testée, publiée et utilisée avant la suivante. Rien n'est
  commencé avant que la précédente soit sur le bureau du pilote.
- **Qu'est-ce qui exige le comptable ?** Son plan de comptes et son logiciel actuel (9.2.0), le
  regarder saisir (9.3.0), les relevés de ses clients (9.4.0), le modèle de déclaration mensuelle
  (9.5.0), la présentation des états financiers (9.6.0), sa méthode de révision (9.9.0), la liasse
  (10.0.0). Et un vrai dossier dès la 9.1.0. Et une question à lui poser tout de suite : **quel
  logiciel il veut remplacer, et sur quels trois écrans il jugera que c'est fait.**
- **Qu'est-ce qui exige Skander ?** Le nom du produit cabinet ; les prix ; l'Ordre ; l'INPDP ; les
  conditions de vente ; la clé Resend sur Cloudflare ; le DNS de son Mac ; la clé de réponse à la
  mise en production ; les certificats de signature ; regarder chaque version ; et relayer les
  retours du pilote.
- **Comment on évite de construire deux fois la même chose ?** Le moteur d'écritures sort dans un
  fichier partagé, et un test exige que la balance calculée par le Cabinet soit celle de l'app
  entreprise au millime. **Décidé.**
- **Comment on évite les surprises ?** Chaque version est décrite ici et dans `PLAN-COMPTABLE.md`
  avant d'être commencée, avec ce qu'elle contient, ce qu'elle exclut, ce dont elle dépend, et le
  test qui la prouve. Ce qui n'est pas dans la description n'est pas dans la version. Une question
  qui surgit en cours de route s'ajoute à ce document avec sa réponse. **Décidé.**
- **Comment on relit ce qu'on construit ?** Avant chaque version qui touche à l'argent, à une clé
  ou à un chiffre comptable : une relecture adversariale (des relecteurs indépendants chargés de
  réfuter chaque constat), et chaque constat retenu est corrigé et prouvé en réintroduisant le
  défaut. C'est la méthode qui a trouvé les défauts les plus graves des versions 7.16.0, 7.33.0 et
  8.0.0. **Décidé.**
- **Le quota de Claude ?** Pas de travail en parallèle sauf nécessité, une version à la fois, les
  corrections regroupées. Le projet est documenté et testé pour qu'un développeur humain puisse
  reprendre demain.
- **Le nom du produit cabinet ?** « SkanFact Cabinet » aujourd'hui. Un nom qui dit « comptabilité »
  vaut peut-être mieux pour le vendre à des cabinets. **À toi.**
- **La formation du comptable ?** L'aide intégrée (bulles et articles), le jeu d'exemple rempli au
  premier lancement, et Skander en démonstration. Pas de formation payante. **Décidé.**
- **Comment on gagne d'autres cabinets ?** Par les clients : chaque paquet envoyé à un comptable sans
  Cabinet est un ZIP lisible qui lui dit que le Cabinet est gratuit pour ce dossier. Et par le
  pilote, s'il en parle à ses confrères.
- **Et la bêta ?** Chaque lot passe par une bêta chez quelques personnes réelles avant la stable.
  Le § 13 dit comment. Et le § 14 dit comment on entretient l'application quand elle est chez
  beaucoup de monde.

---

## 13. La bêta : comment on s'en sert

### Avant la bêta : le mode développement

- **Où Claude développe-t-il ?** Dans son propre environnement (une machine Linux avec un écran
  virtuel), sur une branche de travail (`claude/…`), jamais directement sur `main`. Il lance
  l'application avec `npm start` (et `npm run start:cabinet` pour le Cabinet) : en mode
  développement, l'application écrit dans un dossier de données **à part** (« SkanFact (essais) »,
  « SkanFact Cabinet (essais) »), jamais dans les vraies données. C'est un accident de la 6.7.3 qui
  a imposé cette séparation. **Livré.**
- **Qu'est-ce que le mode développement change d'autre ?** Les clés : une application en
  développement peut lire une clé publique d'essai à la place de la vraie (`SKANFACT_CLE_EMBARQUEE`)
  et signer avec une clé privée d'essai dans un dossier isolé (`SKANFACT_DOSSIER_CLES`), pour jouer
  l'éditeur et le client sans toucher aux vraies clés. La plateforme : une adresse locale
  (`SKANFACT_PLATEFORME_BASE`) où tourne le vrai worker sur une base SQLite. Les outils de
  développement (menu Affichage) s'ouvrent, et le chien de garde se détache pendant qu'ils sont
  ouverts. **Une application installée ignore toutes ces variables** : elle lit toujours sa propre
  clé, et un test relit cette garde. **Livré.**
- **Que vérifie Claude avant de proposer une bêta ?** Dans l'ordre : `npm test` ; les tests de
  source ; les e2e concernés, puis tous les parcours si une refonte a eu lieu ; les captures
  d'écran de toutes les pages (`npm run e2e:captures` photographie les vingt pages en état vierge
  et en état exemple, aux deux largeurs) qu'il regarde une par une et peut t'envoyer ; et, pour
  tout ce qui touche à l'argent, aux clés ou aux chiffres comptables, une relecture adversariale.
  Rien ne part en bêta avec un test rouge. **Décidé.**
- **Comment teste-t-on la plateforme sans toucher à la vraie ?** Le vrai code du worker tourne sur
  une base SQLite locale dans les tests (`e2e:console`, `e2e:plateforme`, `e2e:pont`) ; on ne
  teste jamais contre `api.skanfact.tn`. Un défaut de la vraie base se reproduit sur une copie.
  **Livré.**
- **Comment teste-t-on une migration de données ?** Sur le jeu d'exemple (24 mois, tous les cas),
  et demain sur des fichiers anciens conservés, un par version majeure (§ 14). Jamais sur les
  données d'un client. Toi, tu peux tester une migration sur une **copie** de tes vraies données :
  Paramètres → Sécurité et données → Exporter, puis Importer dans une version d'essai (ci-dessous).
- **Et toi, comment essayer une version avant la bêta, sans taper de commande ?** Aujourd'hui, deux
  moyens, et aucun n'est bon : les captures d'écran que Claude t'envoie (tu regardes, tu ne
  cliques pas), et `Installer SkanFact.command`, qui construit depuis les sources mais **remplace**
  l'application installée et travaille sur tes vraies données — c'est un secours en cas de panne
  de publication, pas un banc d'essai. **À construire, avec le canal `cabinet-beta`, avant la
  9.1.0** : une **version d'essai à côté**. Un workflow « Construire un essai » sur GitHub (onglet
  Actions, un clic, gratuit sur un dépôt public) fabrique « SkanFact Essais » et « SkanFact Cabinet
  Essais » pour Mac et Windows : un autre nom, une autre icône, un dossier de données à part,
  **sans mise à jour automatique**, téléchargeables depuis la page du run et installables **à côté**
  de la vraie application. Tu y charges le jeu d'exemple ou une copie exportée de tes données, tu
  cliques partout, et tu ne risques rien. C'est ce qui te permet de dire « c'est bon pour la bêta »
  avant qu'un pilote la reçoive.
- **Essai, bêta, stable : la différence en une ligne.** L'**essai** est une construction à part,
  sur des données à part, sans mise à jour, pour regarder et cliquer sans risque. La **bêta** est la
  vraie application, sur les vraies données, chez ceux qui l'ont demandée. La **stable** est pour
  tout le monde. Une version passe par les trois, dans cet ordre. **Décidé.**
- **La routine de Claude pour une version, du début à la fin.** (1) Décrire la version ici et dans
  le plan (contenu, exclusions, dépendances, preuve). (2) Construire sur une branche, tests verts
  à chaque étape. (3) Captures envoyées à Skander, corrections. (4) Construction d'essai pour
  Skander (et le pilote s'il veut), retours, corrections. (5) Bêta (§ ci-dessous). (6) Stable.
  (7) Règles apprises écrites dans `CLAUDE.md`, ce document mis à jour si une question a surgi.
  **Décidé.**

### La bêta

- **C'est quoi, une bêta ?** Une version d'essai, numérotée `9.1.0-beta.1`, publiée **avant** la
  version stable, que seuls reçoivent ceux qui ont coché « Recevoir les versions bêta ». Elle sert
  à faire tourner une nouveauté chez quelques personnes réelles avant de la donner à tout le monde.
  **Livré côté entreprise (7.25.0).**
- **Comment ça marche, techniquement ?** Le numéro décide de tout : le workflow marque la release
  « préversion » sur GitHub (la page « dernière version » continue de pointer sur la stable), les
  fichiers de mise à jour s'appellent `beta.yml` au lieu de `latest.yml`, le relais les sert, et
  seule une application qui a coché la case les demande. Une application sans la case ne voit
  jamais une bêta. Une application ne revient jamais en arrière toute seule ; décocher la case
  ramène à la stable **suivante**. Une bêta se travaille sur la branche `beta` du dépôt ; quand
  elle est confirmée, la même version devient stable sur `main`.
- **Le Cabinet a-t-il une bêta ?** Non, pas encore : une préversion ne construit pas le Cabinet, et
  il n'a qu'un canal (`cabinet`). Or tout le chantier est côté Cabinet. À construire **avant la
  première bêta de la 9.1.0** : un canal `cabinet-beta` (fichier `cabinet-beta.yml`), la case dans
  ses Réglages avec la même question et la même sauvegarde « avant-beta », le relais qui sert ce
  canal et lui seul, le workflow qui construit le Cabinet en préversion. Un test vérifie qu'un
  canal ne peut pas réclamer les fichiers d'un autre. **À construire, en premier.**
- **Qui est dans la bêta ?** Skander (Mac et PC), sa famille si elle veut, et le comptable pilote.
  Jamais un client payant qui ne l'a pas demandé : la case est décochée à l'installation, une
  question est posée avant de la cocher, et un test le vérifie. **Décidé.**
- **Le pilote travaille sur une bêta avec un vrai dossier, n'est-ce pas risqué ?** C'est le pacte
  du pilote, et il est encadré : sauvegarde « avant-beta » prise automatiquement, copie externe
  réglée, tous les tests verts avant toute bêta, et une bêta qui touche aux écritures le dit en
  première ligne de ses notes. Un client ordinaire, lui, laisse la case décochée sur l'ordinateur
  qui sert à travailler, comme l'application le lui écrit.
- **Le cycle d'une version, avec la bêta ?** (1) Claude construit sur la branche `beta`, tous les
  tests verts. (2) Publication de `9.1.0-beta.1` (workflow Release sur la branche `beta`). (3) Les
  bêta-testeurs la reçoivent dans les quatre heures ; la sauvegarde « avant-beta » est prise avant
  la bascule. (4) Ils travaillent avec pendant **au moins une semaine réelle** (deux pour une version
  qui touche aux écritures, à l'argent ou aux clés). (5) Les retours arrivent par « Signaler un
  problème », « Proposer une amélioration », ou de vive voix. (6) Chaque correction donne une
  `beta.2`, `beta.3`. (7) Quand le pilote et Skander disent oui, la même version devient `9.1.0`
  stable, publiée depuis `main` : tout le monde la reçoit. (8) La bêta suivante ne commence pas
  avant que la stable soit sortie. **Décidé.**
- **Qui dit que la bêta est bonne, et sur quel critère ?** Skander, après le pilote. Le critère :
  aucun défaut grave ouvert, tous les retours traités (corrigés, planifiés ou refusés avec un
  motif), les tests verts, et la version **utilisée** sur un vrai dossier pendant la durée — pas
  seulement regardée. **Décidé.**
- **Peut-on revenir en arrière depuis une bêta ?** Si la bêta n'a pas changé le format des données :
  oui, décocher la case, la stable suivante remplace. Si elle l'a changé (une migration) : non,
  l'ancienne version ne lirait plus le fichier. C'est pour ça qu'une sauvegarde « avant-beta » est
  prise avant, et qu'on la restaure sur la stable si besoin. Règle : une bêta qui migre les données
  le dit dans ses notes, en première ligne. **Décidé.**
- **Combien de bêtas en même temps ?** Une seule. Un lot de nouveautés = une bêta = une stable.
  Un correctif urgent pendant une bêta sort en stable (x.y.z) sur `main`, et la bêta le reprend.
- **Que fait-on des retours de bêta ?** Chaque retour devient soit une correction dans la bêta
  suivante, soit une ligne dans le plan avec sa version, soit un « non » motivé. Rien ne se perd,
  rien n'est promis sans version. Skander tient la liste ; Claude la traite.
- **La bêta remplace-t-elle les tests ?** Non. Elle passe **après** tous les tests verts. Elle
  attrape ce que les tests ne voient pas : l'ergonomie, le métier réel, le fuseau horaire, Windows,
  ce qu'un comptable fait vraiment de ses journées.
- **Une bêta de la plateforme ?** La console et le worker n'ont pas de bêta : ils se testent sur une
  base locale avec le vrai code (les e2e `console`, `plateforme`, `pont`), puis Skander colle le
  nouveau code dans Cloudflare. Un changement de base est toujours additif, donc un ancien worker
  et une nouvelle base cohabitent le temps de coller.

---

## 14. Entretenir l'application quand il y a beaucoup d'utilisateurs

- **Le principe.** Ne jamais casser ce qui marche chez quelqu'un. Ça tient par cinq choses : des
  garanties de compatibilité, un rythme de publication, un chemin d'urgence, la bêta avant la
  stable, et l'absence de tout mécanisme qui pourrait toucher tous les postes d'un coup. **Décidé.**
- **Les garanties de compatibilité, ce qui ne casse jamais.** (1) Les **données** : chaque version
  lit tout ce que les précédentes ont écrit ; une migration ajoute, ne retire jamais un champ ; une
  sauvegarde est prise avant. (2) Le **paquet** : un Cabinet récent lit tous les paquets anciens ;
  un Cabinet ancien reconnaît un paquet trop récent et le dit. (3) La **clé de licence** : une clé
  émise reste valide jusqu'à sa date quoi qu'on publie ; un champ inconnu est ignoré ; l'ordre des
  champs ne change jamais. (4) Les **réglages du poste** (relais, plateforme) : facultatifs, avec
  repli. (5) Une **pièce émise** ne change jamais de montant après une mise à jour (copie figée).
  Chacune a un test, et casser l'une d'elles est un défaut grave. **Décidé.**
- **Le rythme.** Une stable toutes les deux à quatre semaines, par lot, précédée d'une bêta. Un
  correctif (x.y.z) dès qu'un défaut grave est confirmé, sans attendre le lot. Jamais deux
  publications le même jour sauf urgence : chaque publication coûte des minutes de construction et
  une mise à jour chez tout le monde, on ne publie pas pour une virgule. **Décidé.**
- **La gravité d'un défaut, et ce qu'elle déclenche.** *Grave* : un chiffre faux, une donnée perdue,
  une application qui ne démarre plus, un paquet illisible, une clé refusée à tort → correctif sous
  48 heures, et un mail aux utilisateurs touchés. *Moyen* : une fonction qui ne répond pas, un écran
  faux sans conséquence sur les chiffres → le prochain lot. *Petit* : libellé, esthétique → quand ça
  arrange. **Décidé.**
- **Le chemin d'urgence.** Reproduire avec le journal reçu ; corriger sur `main` ; `npm test`, les
  e2e touchés et les parcours de base ; publier x.y.z ; vérifier la release ; mail aux touchés ;
  écrire la règle apprise dans `CLAUDE.md` pour que ça n'arrive plus. Jamais de retour en arrière,
  jamais de retrait d'une version publiée. **Décidé.**
- **La liste de contrôle avant chaque publication.** Toujours : `npm test`, puis les e2e
  `entreprise`, `cabinet`, `boucle`, `refus`, `perte`, `livres`, `licence`, `plateforme`, `pages`.
  Selon ce qui a été touché : les autres. Un lot qui touche à l'argent, à une clé ou à un chiffre
  comptable passe en plus par une relecture adversariale. Puis le numéro, le CHANGELOG, l'aide et
  les bulles, la migration testée sur le jeu d'exemple **et sur des fichiers de données anciens
  conservés** (un par version majeure, anonymisé : à constituer, **À construire**). **Décidé.**
- **Comment on sait ce qui tourne chez les gens ?** Aucune télémétrie. La seule mesure : les
  activations sur la plateforme (version, système, poste), qui disent combien de postes sont sur
  quelle version. Les retours arrivent par les deux boutons. On ne saura jamais quelle fonction est
  utilisée : c'est le prix de « rien ne remonte », et il est assumé. **Décidé.**
- **Et les utilisateurs qui ne mettent pas à jour ?** Ils gardent une version qui marche. Seule la
  dernière est suivie ; un correctif ne sort que dans une nouvelle version. Un paquet d'une vieille
  version reste lisible. Le jour où une version est vraiment nécessaire (une loi, un format),
  l'application le dit dans son bandeau, sans forcer. **Jamais de mise à jour forcée, jamais de
  coupure à distance.** **Décidé.**
- **Comment on communique avec les utilisateurs ?** Les notes de version dans l'application (bouton
  « Nouveautés ») et sur GitHub, écrites pour un utilisateur, pas pour un développeur. Un mail aux
  clients pour une version importante ou un défaut grave (la liste des clients est dans la
  console). Pas de lettre d'information tant qu'il y a moins de cinquante clients. **À toi.**
- **Le support quand ils sont cent.** L'aide intégrée répond d'abord (chaque écran a sa bulle,
  chaque question sa recherche). Les mails arrivent sur `contact@` avec le journal ; Skander trie
  (grave, moyen, petit) et transmet. Une question posée trois fois devient un paragraphe d'aide.
  Pas d'engagement de délai ; l'ordre est : grave d'abord. Si ça dépasse ce qu'une personne peut
  lire, une boîte partagée et une deuxième personne, pas un outil de tickets. **À toi.**
- **Et à cinq cents ?** Là, « pas d'outil de tickets » devient une erreur, et la troisième relecture
  extérieure a eu raison de le dire. Ce document énonçait la règle sans son seuil, donc elle se
  lisait comme un principe alors que c'est une observation valable jusqu'à une certaine taille. Ce
  qu'une boîte mail partagée ne sait pas faire : dire ce qui est resté sans réponse, retrouver ce
  qu'on a répondu à quelqu'un il y a six mois, et montrer que la même question revient vingt fois —
  or c'est précisément cette dernière qui dit quel paragraphe d'aide écrire. **Décidé : au-delà de
  deux cents clients, un outil de support** (quelques dizaines de dinars par mois, ce qui est
  dérisoire à cette taille). Avant deux cents, la boîte partagée suffit et un outil serait une
  discipline de plus à tenir pour rien.
- **La loi de finances, chaque janvier.** Les taux sont des réglages : un utilisateur peut les
  changer sans mise à jour. On publie quand même une version en janvier avec les nouveaux défauts et
  une ligne « À VÉRIFIER avec ton comptable », après relecture par le comptable pilote. Le
  calendrier fiscal et les barèmes de paie ont chacun leur écran. **Décidé.**
- **L'entretien technique sans nouveauté.** Electron embarque un navigateur : une mise à jour
  d'Electron tous les trois à six mois pour ses correctifs de sécurité, avec tous les e2e relancés,
  publiée dans un lot. Les dépendances se comptent sur les doigts d'une main (Electron,
  electron-builder), c'est voulu : moins de dépendances, moins de surprises. **Décidé.**
- **Retirer une fonction ?** On ne retire jamais une fonction qui porte des données ; on la masque
  (module) ou on la met en pause (comme la lecture de photo). Ce qui a été saisi reste lisible et
  exportable. **Décidé.**
- **La plateforme sous charge.** Une application n'appelle le serveur qu'à l'activation et à la
  vérification de mise à jour : quelques requêtes par poste et par jour. L'offre gratuite de
  Cloudflare (de l'ordre de cent mille requêtes par jour) tient donc des milliers de postes ;
  au-delà, l'offre payante coûte quelques dollars par mois. **À VÉRIFIER : les limites exactes le
  jour où on approche.** Un export régulier de la base est à mettre en place.
- **Si Skander est absent (vacances, maladie) ?** Les applications continuent, la console attend,
  les mails attendent. Le seul point sensible : un client dont la licence expire pendant l'absence
  est bloqué à la création. Parades : le renouvellement réclamé trente jours avant, un jour le
  paiement en ligne qui émet la clé sans personne, et une personne de confiance qui a accès au
  secret de la console et sait « marquer payée ». **À toi.**
- **Un cabinet de soixante dossiers sur dix ans : les performances ?** Un fichier par dossier,
  chargé à l'ouverture du dossier seulement. Avant la 9.2.0, un e2e de charge (un dossier de
  cinquante mille écritures) mesure ; on n'optimise qu'après avoir mesuré. **À construire.**
- **Si beaucoup de cabinets arrivent ?** Chaque cabinet est indépendant : rien ne se partage entre
  eux, aucun serveur ne les relie. Le seul point commun est la plateforme (licences) et le relais.
  L'échelle ne change rien au produit, seulement au support et à la vente.
- **Comment on évite de casser en changeant le code ?** Une seule porte par garde-fou, une seule
  source de vérité par règle, un test par règle, un test qui se prouve en réintroduisant le défaut,
  les commentaires retirés avant de juger, et `CLAUDE.md` qui porte toutes les règles apprises pour
  qu'une session suivante ne refasse pas une erreur passée. C'est ce qui a tenu plus de deux cents
  versions sans perte de données connue. **Décidé.**
- **Comment sait-on qu'une écriture automatique est juste ?** Pas parce qu'elle est équilibrée.
  **Une écriture équilibrée n'est pas une écriture correcte** : elle doit aussi correspondre à sa
  pièce, au bon compte, au bon tiers, à la bonne période, au bon taux de TVA, à la bonne retenue.
  On en a la preuve dans le projet : jusqu'à la 8.9.0, une facture entièrement couverte par un avoir
  ne produisait aucune écriture pendant que son avoir en produisait une — la balance tombait juste,
  et le compte du client était faux de 405 dinars. C'est le **lettrage** qui l'a révélé, pas
  l'équilibre. D'où la règle : chaque calcul comptable a un contrôle qui ne passe **pas** par
  l'équilibre (le reste ouvert égale le solde du compte client, la trésorerie du bilan égale celle
  de la page Trésorerie, le résultat du bilan égale celui de l'état de résultat, l'à-nouveau égale
  les soldes du 31 décembre). **Décidé.**
- **Tester sur des données réelles ?** Jamais sur les données d'un client. Sur le jeu d'exemple, et
  sur des fichiers que des utilisateurs donnent volontairement, anonymisés. **Décidé.**
- **Un poste client compromis (virus, vol) ?** Rien de central n'est atteint : aucune clé privée de
  l'éditeur n'est sur un poste client. Le pire est la perte de ses propres données, couverte par les
  sauvegardes et le chiffrement. Chez le cabinet : chiffré, mot de passe, verrouillage (automatique
  en 9.8.0).
- **Quand faut-il une version majeure (x.0.0) ?** Quand la forme des données change de manière
  qu'une ancienne version ne pourrait pas lire, ou qu'une habitude change pour tout le monde. Elle
  passe toujours par une bêta plus longue et un mail aux clients. **Décidé.**

---

## 15. Ce que font les développeurs seniors, et ce qui nous manque encore

*Réponse honnête à « qu'est-ce qui manque encore ? ». Le projet a déjà beaucoup de ce qu'une équipe
mûre pratique : des tests à trois niveaux, des versions numérotées avec leur journal, des écritures
atomiques, des migrations avec sauvegarde, des post-mortems (les « règles apprises » de
`CLAUDE.md`), des relectures adversariales, une chaîne essai → bêta → stable. Ce qui suit est ce
qui manque, mesuré dans le dépôt le 15/09/2026, et ce qu'on en fait.*

- **Comment une équipe senior tient-elle un logiciel de cette taille ?** Par des habitudes plus que
  par du talent. Dix, en général : (1) rien n'entre dans la branche principale sans que les tests
  aient tourné **automatiquement** ; (2) une relecture par quelqu'un d'autre que l'auteur ; (3) des
  outils qui lisent le code à la place des humains (analyse statique) ; (4) une chaîne
  essai → bêta → stable ; (5) une observation du logiciel chez les utilisateurs (journaux, rapports
  d'erreur) ; (6) une dette technique écrite et remboursée par petites tranches ; (7) les décisions
  d'architecture consignées ; (8) un registre des retours et des défauts ; (9) du code découpé en
  morceaux qu'une personne peut tenir en tête ; (10) un post-mortem après chaque incident. Sur ces
  dix, le projet en a cinq pleinement (4, 6 en partie, 7, 10, et 2 pour les versions sensibles),
  trois à moitié (5, 8, 9), et deux pas du tout (1, 3).
- **1 — L'intégration continue.** Aujourd'hui les tests tournent quand Claude les lance ; rien
  n'empêche un commit avec un test rouge d'atteindre `main`. Le seul workflow du dépôt est la
  publication. Ce qu'on fait : un second workflow qui lance `npm test` (et le lint ci-dessous) **à
  chaque push et à chaque fusion**, sur Linux **et sur Windows** (la classe de défauts qu'on a
  trouvée trop tard en 7.21.x), gratuit sur un dépôt public ; et la branche `main` **protégée** sur
  GitHub (interdiction de fusionner si les tests sont rouges, interdiction de réécrire l'historique
  : un réglage, **à toi**). **À construire (9.1.0).**
- **2 — L'analyse statique (le lint).** Trois fois au moins, un écran est resté blanc parce qu'une
  fonction appelée n'existait pas ou qu'une variable venait d'une autre page ; un test maison
  l'attrape depuis, mais après coup. Un linter (ESLint, dépendance de développement seulement, aucun
  effet sur l'application) le voit à la frappe : `no-undef`, `no-unused-vars`, `no-redeclare`,
  `eqeqeq`, et l'interdiction des formes déjà bannies par les tests de source. Lancé dans `npm test`
  et dans la CI. **À construire (9.1.0).** Plus tard, optionnel : des annotations de types (JSDoc
  vérifié) sur `core.js`, qui attraperaient un argument oublié comme la société en troisième
  position de `invoiceBalance`.
- **3 — Le garde-fou d'erreur global.** Aucun des deux écrans ne capte une exception non attrapée
  (ni `window.onerror`, ni `unhandledrejection`) : une erreur imprévue donne un écran blanc ou un
  bouton mort, sans un mot, et rien dans le journal. Ce qu'on fait : un gestionnaire global dans
  chaque application qui écrit l'erreur dans `main.log` par le pont, affiche une phrase en français
  avec « Signaler un problème », et laisse l'application utilisable. C'est ce qui transforme un
  « ça ne marche pas » en un rapport exploitable. **À construire (9.1.0).**
- **4 — Le journal technique borné.** `main.log` grossit sans limite : il n'est jamais tourné ni
  tronqué. Chez un utilisateur de deux ans, il pèsera des mégaoctets et sera inutilisable dans un
  signalement. Ce qu'on fait : rotation à quelques mégaoctets (le fichier courant et un précédent),
  dans les deux applications. **À construire (9.1.0).**
- **5 — La taille des fichiers.** `app.js` fait 12 300 lignes, `core.js` 6 500, le fichier des
  tests 10 500. Aucune personne ne tient ça en tête ; un développeur qui arrive met des jours à
  s'y repérer, et un test de source qui découpe le fichier en tranches se casse à chaque
  déménagement. Une équipe senior découpe par domaine (ventes, achats, comptabilité, paie,
  licences, réglages), chaque fichier chargé par la page (sans bundler, comme `rowmenu.js` et
  `reglages.js` le sont déjà). Le faire d'un coup serait le plus gros risque de régression du
  projet : on le fait **par occasion** — chaque version déplace dans son fichier les routes qu'elle
  touche, avec ses tests, et **aucun fichier ne dépasse plus sa taille du jour** ; le code neuf va
  dans un fichier neuf. Le moteur d'écritures (`compta.js`, 9.1.0) est le premier pas. **Décidé.**
- **6 — Les règles écrites, mais dans l'ordre où elles ont été apprises.** `CLAUDE.md` fait 2 474
  lignes et 68 sections, rangées par version : c'est un excellent journal de post-mortems et une
  mauvaise référence. Chercher « comment on calcule une date » oblige à lire la 5.2.3. Une équipe
  senior tient des fiches de décision par sujet. Ce qu'on fait : un **index thématique** en tête de
  `CLAUDE.md` (dates, tests, CSS, licence, paquet, cabinet, pièges e2e, publication…) qui renvoie
  aux sections, sans réécrire le journal. **À construire (9.1.0).**
- **7 — Le registre des retours et de la dette.** Aujourd'hui les retours vivent dans la
  conversation et les plans, et la liste de la bêta « chez Skander ». Une équipe senior a un suivi
  des défauts. Ce qu'on fait : les **Issues GitHub** du dépôt (tu les crées depuis le navigateur,
  sans commande ; elles suivent le dépôt s'il redevient privé), avec quatre étiquettes : grave,
  moyen, petit, dette. Claude les lit et les ferme avec la version qui les règle. La dette
  technique connue y est posée dès maintenant (la liste ci-dessous). **À toi (accepter le
  principe), puis Décidé.**
- **8 — La convention de nommage.** Les champs de données sont en anglais (`payments`,
  `purchases`, `dueDate`), le code métier récent est en français (`odValide`, `livreJournal`) : deux
  langues dans le même fichier, parce que le projet a grandi plus vite que sa convention. Renommer
  les champs existants est exclu (ils sont écrits dans les fichiers de tous les clients). Règle :
  **les champs de données gardent leur nom pour toujours ; le code neuf est en français ; une
  fonction nouvelle ne mélange pas les deux dans son propre nom.** **Décidé.**
- **9 — Les tests sur Mac et Windows.** Les parcours e2e ne tournent que sur Linux ; les défauts
  propres à Windows ont été trouvés par Skander, pas par un test. Une machine Mac coûte dix fois
  une Linux ; une machine Windows est gratuite sur un dépôt public. Ce qu'on fait : `npm test` sur
  Windows dans la CI (point 1) ; les e2e restent sur Linux ; les constructions d'essai (§ 13)
  donnent à Skander la vérification réelle sur Mac et sur PC. **À construire (9.1.0).**
- **10 — Observer sans télémétrie.** Une équipe senior a un rapport d'erreurs automatique
  (Sentry ou équivalent) ; on s'y refuse par principe (« rien ne remonte »). Ce qui en tient lieu :
  le garde-fou d'erreur (point 3) qui remplit le journal, le bouton « Signaler un problème » qui
  l'envoie en un clic, et les activations de la plateforme qui disent quelle version tourne où.
  C'est moins, et c'est assumé. **Décidé.**
- **11 — La revue de sécurité périodique.** Les réglages d'Electron sont ceux qu'il faut
  (isolation du contexte, pas d'accès Node depuis l'écran, bac à sable). Ce qui manque : un
  `npm audit` dans la CI, et une relecture de la liste de sécurité d'Electron à chaque montée de
  version majeure d'Electron. **À construire (dans la CI).**
- **12 — La reproductibilité de la construction.** Le fichier de verrouillage des dépendances
  existe et la publication utilise Node 22. Mais l'installeur local installe « le Node du moment »
  par Homebrew : deux constructions peuvent différer. Ce qu'on fait : la version de Node inscrite
  dans `package.json` (`engines`) et vérifiée par l'installeur. **À construire (petit).**
- **13 — Une relecture pour chaque version, pas seulement les sensibles.** La relecture
  adversariale est réservée à l'argent, aux clés et aux chiffres comptables. Ce qu'on fait : chaque
  version reçoit au moins une relecture indépendante de son changement avant la bêta (un relecteur,
  pas trois), et les sensibles gardent la relecture complète. **Décidé.**
  **Qui est ce relecteur ?** Il faut le dire, parce qu'une relecture a remarqué que la règle ne le
  disait pas — et qu'une règle sans acteur n'existe pas. C'est **une autre session de Claude, ou une
  autre IA**, à qui l'on donne le changement sans son histoire et la consigne de le réfuter ; les
  trois relectures extérieures de ce document sont exactement ce mécanisme, et elles ont trouvé une
  faille de sécurité et une erreur de conception que l'auteur n'avait pas vues. **La limite, assumée
  :** ce n'est pas l'indépendance d'un humain qui connaît le métier — la même famille de modèles a
  des angles morts communs, et aucune IA ne remplace le comptable pilote sur un chiffre fiscal. Ce
  qu'on en attend est donc précis : les fautes de cohérence, les cas non traités, les tests qui ne
  peuvent pas échouer — pas la vérité métier, qui vient du pilote, ni la vérité de droit, qui vient
  du juriste. Un relecteur humain payé n'est pas prévu ; le jour où le chiffre d'affaires le
  permet, c'est la première embauche qui aurait du sens.
- **14 — Du temps réservé à l'entretien.** Une équipe senior garde environ un cinquième de son
  temps pour la dette et l'outillage, sinon ils ne sont jamais faits. Règle : **une version sur
  quatre est une version d'entretien** (Electron, lint, découpage d'un fichier, docs, dette), sans
  nouveauté, publiée dans un lot comme les autres. **Décidé.** Et pour que ce ne soit pas un vœu
  pieux (une relecture a constaté qu'aucune version du § 16 n'était marquée « entretien ») : **la
  9.1.0 en est une pour moitié** (l'outillage passe avant les livres), puis **9.3.1** après la
  saisie, **9.5.1** après le fiscal, et **9.8.1** après le multi-poste sont des versions
  d'entretien, écrites dans le § 16, avec un contenu (Electron, conversion des 93 déclarations CSS,
  découpage d'un gros fichier, dette listée au point 15). Elles ne sautent pas parce qu'on est
  pressé : c'est précisément quand on est pressé qu'on les saute, et c'est pour ça qu'elles sont
  écrites d'avance.
- **15 — La dette technique connue, au 15/09/2026.** Ce qu'on sait devoir rembourser, et quand :
  pas d'intégration continue, pas de lint, pas de garde-fou d'erreur global, journal non borné
  (9.1.0) ; le canal `cabinet-beta` et les constructions d'essai (9.1.0) ; `app.js` et `core.js`
  trop gros (par occasion, à partir de 9.1.0) ; `CLAUDE.md` sans index thématique (9.1.0) ; les
  tests dans un seul fichier de 10 500 lignes (à découper par thème, version d'entretien) ; les
  données du Cabinet dans un seul fichier (9.2.0) ; pas de fichiers de données anciens pour tester
  les migrations (9.2.0) ; le jeu d'exemple du Cabinet sans vrais paquets (10.0.0) ; pas d'export
  de la base de la plateforme (avec la licence du Cabinet) ; la lecture de photo en pause (le jour
  d'une application mobile) ; les applications non signées (le jour où ça vend) ; la version de
  Node non verrouillée pour l'installeur (petit). Et, venus de la relecture extérieure du
  15/09/2026 : pas de seuil de retenue à la source, pas d'exonération de timbre par client, le taux
  de TFP non proposé par le métier, la clé de secours non imprimable, le contrôle « notre modèle
  porte-t-il ce qu'un format officiel exigerait ? » jamais fait (tous petits, dans une version de
  corrections fiscales) ; le test de charge du Cabinet (avant 9.2.0). Cette liste vit dans les
  Issues GitHub dès que le point 7 est accepté ; en attendant, ici.
- **Le projet respecte-t-il « toutes les recommandations » ?** Non, et aucun projet ne le fait :
  ce n'est pas un état, c'est un écart qu'on mesure. Sur l'échelle usuelle de maturité
  (improvisé → répétable → défini → mesuré → optimisé), au 15/09/2026 : *architecture* défini ;
  *tests* mesuré ; *qualité du code* répétable (aucun outil ne le lit) ; *sécurité* défini ;
  *fiabilité* défini (sans garde-fou d'erreur global) ; *publication* mesuré (sans intégration
  continue) ; *documentation* optimisée en volume, définie en organisation ; *méthode* défini ;
  *ergonomie* mesuré (l'accessibilité jamais regardée) ; *performance* improvisé ; *observation*
  improvisé par choix ; *juridique* improvisé. Par rapport à un projet ordinaire de cette taille :
  nettement au-dessus sur les tests, la documentation, les données et l'ergonomie ; nettement en
  dessous sur l'outillage automatique (intégration continue, lint). Le biais à connaître : le
  même auteur écrit le code et les tests, donc il partage ses angles morts avec eux — d'où « un
  test se prouve en réintroduisant le défaut », les relecteurs indépendants, et le pilote. Après
  l'outillage de la 9.1.0, tout passe à « défini » ou « mesuré » sauf le juridique, qui ne dépend
  pas du code. Cette auto-évaluation se refait à chaque version d'entretien.
- **Ce que des relectures extérieures ont proposé, et qu'on a refusé (15/09/2026).** Pour ne pas
  rediscuter les mêmes idées à chaque relecture. **SQLite pour le Cabinet** : refusé, l'argument de
  la corruption ne tient pas (l'écriture atomique est plus forte), le vrai sujet est la vitesse et
  le découpage par exercice le règle, et une dépendance native casserait la construction universelle
  Mac (§ 5). **Une phrase mnémonique de 24 mots** pour la clé de secours : refusé, un comptable qui
  recopie 24 mots et se trompe d'un est bloqué pour toujours, alors qu'un fichier scellé par mot de
  passe se copie sans erreur ; **retenu en revanche** : rendre la clé de secours imprimable en PDF,
  pour qu'elle survive sur papier (**à construire, petit**). **Structurer les factures au format
  officiel TTN dès maintenant** : refusé, c'est du travail pour une obligation qui n'existe pas
  encore ; retenu : le contrôle d'une heure « notre modèle porte-t-il déjà ce qu'il faudrait ? »
  (§ 11). **Héberger les installateurs ailleurs que sur les releases GitHub** : inutile, le quota
  concerne la construction, pas l'hébergement, et la construction locale est déjà le secours.
- **Ce que la troisième relecture a proposé, et qu'on a refusé (15/09/2026).** **Remplacer
  l'impression PDF par une bibliothèque (PDFKit, jsPDF)** : refusé, et la raison avancée était
  fausse. Le reproche était que « le CSS d'impression est notoirement instable entre les versions
  d'Electron, les OS et les imprimantes » — c'est vrai d'un site web dans le navigateur du visiteur,
  et faux ici : Electron **embarque son propre Chromium**, donc le même moteur de rendu tourne à
  l'identique sur un Mac de 2019 et un Windows 11, et rien ne passe par une imprimante (on écrit un
  fichier). C'est précisément ce que `e2e:pages` prouve sur 161 documents imprimés et mesurés, et
  refaire tout le modèle avec une bibliothèque en perdrait la mise en page automatique.
  **Retenu en revanche, deux sous-points justes** : le rendu d'un texte arabe dans le PDF (la
  liaison des lettres et le sens d'écriture) n'a jamais été essayé, et la résolution d'un logo
  importé non plus — deux vérifications à faire le jour où l'arabe ou un vrai logo arrivent.
  **Lier l'essai de 30 jours à l'adresse MAC** : refusé, c'est une donnée personnelle qu'on n'a
  aucune raison de collecter, elle change avec la carte réseau (donc un client honnête se retrouve
  bloqué en changeant de wifi) et elle se falsifie en une commande — tous les défauts, aucun
  bénéfice. La position ne bouge pas (§ 8) : l'essai est une incitation, pas une serrure, et une
  application en source ouverte ne peut pas prétendre le contraire. **Ce qui change quand même** :
  la plateforme **voit** les essais qui se rejouent sur le même poste, et c'est une information
  commerciale utile (« ce prospect essaie depuis quatre mois, appelle-le ») plutôt qu'un blocage.
  **Un programme de certification, un forum d'entraide, un bug bounty** : refusés pour l'instant,
  non pas sur le principe mais sur la taille — un programme de certification avec un cabinet, un
  forum avec trois utilisateurs et une prime aux chercheurs avec zéro client coûtent du temps et ne
  rendent rien. À reposer au-dessus de cent clients, pas avant.
- **Ce que la quatrième relecture (sur la v4) a apporté, et ce qu'elle a pris pour des faits.**
  C'est la meilleure des quatre : elle a reconnu ce qui avait été corrigé avant de critiquer, et
  presque tout ce qu'elle a demandé est entré — les jalons de décision (§ 3), les seuils du test de
  charge (§ 5), la fin de la tolérance aux paquets non signés (§ 6), la grâce réservée aux licences
  payées (§ 7), l'export de la base avant la première vente (§ 8), le relecteur nommé et les
  versions d'entretien numérotées (§ 15, § 16), le `.skanclose` chez un client pas à jour (§ 16),
  le pli scellé et la libération en lot décrits (§ 17), la liste des contrôles hors équilibre
  (§ 19). Ce qu'elle avait faux, pour la calibration : le document « fait plus de 3 000 lignes »
  (2 536) ; « le doc dit : à six mois, on vend à dix clients » — c'est un scénario conditionnel du
  § 3 (« *si* l'horizon est de six mois, *alors*… »), pas une promesse ; et « la plateforme tourne
  déjà et collecte des données » — elle est construite et testée, pas en production (la clé de
  réponse est encore `null`, § 8), ce qui ne change rien à l'obligation INPDP mais change son
  urgence. Et un refus, un seul : le tarif réduit à vie après la grâce (§ 7).
- **Ce que la troisième relecture a proposé et qui reste ouvert, pas refusé.** **Une offre gratuite
  limitée** (dix factures par mois) pour attirer les indépendants : le mécanisme existe déjà
  presque — une licence porte son offre, et `licenceBlock` est la porte unique ; il faudrait
  seulement une offre « Découverte » et un compteur. Le vrai coût n'est pas technique, c'est le
  **support de gens qui ne paient pas**, et c'est une décision de modèle. **À toi.** **Une
  synchronisation cloud facultative** (les données restent locales, une copie chiffrée sur un
  serveur) : différent de la synchronisation temps réel refusée en 3.2.0, et ça ouvrirait les
  entreprises à plusieurs sites. Ce que ça coûte : un service à tenir, et surtout la **garde des
  données comptables de tiers**, avec ce que ça implique de responsabilité et de déclaration. **À
  toi, après les premiers clients.** **Un programme de partenaires** (des cabinets ou des
  consultants qui revendent, avec une commission) : sérieux et peu cher, mais il bute sur la même
  question de déontologie que la gratuité conditionnelle, et se pose donc dans la même
  conversation. **À VALIDER JURIDIQUEMENT.**
- **Ce qui ne manque pas, et qu'on ne fera pas.** Un bundler ou un framework (React) : le code lu
  est le code qui tourne, c'est une force pour un projet tenu par une personne et une IA. Une base
  de données : les fichiers JSON suffisent à la taille visée et se sauvegardent en copiant. Une
  télémétrie. Un outil de tickets payant. Une couverture de tests chiffrée : on préfère « chaque
  règle a son test, et chaque test se prouve ».

---

## 16. Les versions à venir, une par une

*Pour chaque version : ce qu'elle contient, ce qu'elle exclut, ce dont elle dépend, comment on la
prouve. Les deux applications sortent ensemble sous le même numéro. Les durées sont des ordres de
grandeur de construction, hors attente des réponses.*

**Ce que ces durées ne disent pas, et qu'il faut lire avant de les additionner.** Mises bout à bout,
elles font environ **seize à dix-neuf semaines** — quatre mois pour aller de la 9.1.0 à la 10.0.0.
C'est le temps de **construction pure**, et ce serait vrai si rien d'autre n'existait. Or il y a le
support des clients qu'on espère avoir, les correctifs qu'ils provoqueront, les allers-retours avec
le cabinet pilote (qui ne répond pas dans la journée), la validation fiscale, les démarches (marque,
INPDP, signature de code), la vente elle-même — et le travail de Skander chez SKANCYBER, qui n'est
pas ce projet. Une relecture extérieure a reproché à ce plan un tempo irréaliste ; elle citait un
calendrier que le document ne donne nulle part, mais son fond est juste, et la vraie réponse est
plus sévère que sa critique : **compter le double est prudent, et l'ordre compte plus que la
vitesse.** Ce qui protège ici n'est pas une date, c'est la règle « une version à la fois, finie,
publiée, utilisée avant la suivante » — la seule qui garantisse qu'un arrêt à n'importe quel moment
laisse quelque chose d'utilisable plutôt qu'un chantier.

### Étape 0 — Ce qui n'est pas du code, et qui passe avant (une semaine de travail, plus des attentes)

*Ajouté le 15/09/2026. Une relecture a trouvé incohérent que six démarches soient déclarées
« bloquantes pour la vente » et absentes du plan des versions. Elle avait raison sur la forme ; sur
le fond, ces démarches sont faites par Skander pendant que le code est écrit par Claude — elles ne
retardent aucune version, et aucune version ne les retarde. Les mettre ici sert à une chose : qu'on
ne puisse pas lire ce plan sans les voir.*

| Démarche | Travail réel | Attente | Ce que ça débloque |
|---|---|---|---|
| Déposer la marque à l'INNORPI | un jour | quelques semaines | tout — un nom qu'on ne peut pas perdre |
| Certificat Apple (signature + notarisation) | une demi-journée | immédiat | la première installation Mac sans avertissement |
| Certificat Windows (OV ou EV, § 9) | un jour, plus le support matériel | une à deux semaines | la première installation Windows chez un cabinet |
| Déclaration INPDP | deux jours | quelques semaines | la mise en production de la plateforme |
| Conditions de vente, premier jet par Skander puis relecture juridique | deux jours | selon le juriste | la page Tarifs, la première facture |
| La lettre à l'Ordre (trois phrases suffisent : ce qu'on offre, à qui, contre quoi) | une heure | des mois, peut-être | la publication du prix Cabinet, pas le développement |
| Séance de validation fiscale avec le comptable | une demi-journée | un rendez-vous | la 9.1.1 entière |
| Le bouton de téléchargement du Cabinet (404) et la page unique | un jour | aucune | la première démonstration |

Total : **une semaine de travail réel**, moins que la 9.1.0. Ce qui est long, ce sont les attentes —
et c'est exactement pourquoi tout se lance maintenant, en parallèle, plutôt qu'au moment où l'on en
a besoin. **À toi, dans cet ordre.**

### 9.1.0 — Les livres du dossier (quelques jours, n'attend personne)

- **Cabinet.** Dans la fiche d'un dossier, un bloc « Comptabilité » avec un sélecteur de période
  (un mois, l'exercice, du… au…) et quatre onglets, tous **lus dans les fichiers d'écritures des
  paquets** de la période : *Livre-journal* (filtre par journal, recherche, centralisateur) ;
  *Grand livre* (un compte, solde progressif ; « tous les comptes ») ; *Balance* (générale et
  auxiliaire, six totaux, « équilibrée » ou l'écart) ; *Lettrage* (ce qui reste ouvert par tiers).
  Un mois manquant ou provisoire se dit en tête de chaque onglet. Un paquet d'avant la 8.8.0 (sans
  numéro ni tiers) le dit. Export CSV de ce qu'on regarde.
- **Entreprise.** Le module « Comptabilité » (Grand livre, Balance, États financiers, saisie d'OD)
  devient un module désactivé par défaut, activable dans Paramètres → Modules ; Écritures, TVA,
  Clôtures et Cabinet restent hors module. L'option `compta` dans la clé de licence, la porte
  unique `optionBlock`, l'essai qui l'inclut, la page avec cadenas et chemin. La console et le
  module Éditeur savent vendre l'option (prix à décider).
- **Partagé.** `compta.js` extrait de `core.js` (grand livre, balance, journal, centralisateur,
  lettrage, états, à-nouveaux, plan comptable, libellés de comptes), rechargé par les deux
  applications, `core.js` inchangé pour ses appelants.
- **Outillage, construit en premier** (§ 13 et § 15) : le canal `cabinet-beta` ; le workflow
  « Construire un essai » ; l'intégration continue (`npm test` et lint à chaque push, Linux et
  Windows) ; le lint ; le garde-fou d'erreur global des deux écrans ; le journal borné ; l'index
  thématique de `CLAUDE.md`. Pour que la 9.1.0 puisse être essayée par Skander à côté de sa vraie
  application, puis partir en bêta chez le pilote, puis en stable.
- **Deux filets, ajoutés le 15/09/2026 après la troisième relecture extérieure.** (1) **La clé de
  secours est réclamée au premier import de paquet**, comme une étape et non comme un rappel :
  aujourd'hui un cabinet peut recevoir soixante paquets avant d'y penser, et une panne de disque
  entre les deux les rend illisibles pour toujours (§ 5). (2) **Le test de charge du Cabinet** —
  cinquante mille écritures, l'ouverture d'un dossier, un enregistrement en saisie au kilomètre, et
  les trois lectures qui ouvrent soixante fichiers — passe **ici**, parce que c'est la 9.2.0 qui
  écrit le format et qu'après il sera trop tard pour en changer.
- **Exclu.** Aucune saisie, aucun livre propre au dossier, aucune modification des paquets.
- **Preuve.** Test de parité (même balance au millime) ; e2e `cabinet-livres` (les quatre onglets
  sur un vrai paquet, le mois manquant annoncé) ; e2e `boucle` relancé ; test « module désactivé
  par défaut » et `e2e:entreprise` relu ; test « `optionBlock` n'est posé que sur l'entrée du
  module » ; e2e : le premier import demande la clé de secours, et « pas maintenant » ne se propose
  qu'une fois.

### 9.1.1 — Les quatre corrections fiscales (un à deux jours, après la séance avec le comptable)

*Version à part, et volontairement minuscule : ces quatre points touchent des chiffres qui partent
chez un tiers — l'administration, un client, un comptable — et ils traînaient dans ce document sans
version, ce qui est la meilleure façon de ne jamais les faire (§ 11).*

- **Entreprise.** Une case « exonéré de timbre fiscal » sur la fiche client, qui décoche le timbre
  par défaut sur ses documents. La **TFP proposée par métier** (règle de la 7.25.0 : proposer sans
  imposer, et ne plus écraser une fois le champ touché). Un **seuil de retenue à la source**
  réglable — **par défaut 0, c'est-à-dire aucun seuil**, tant que le comptable n'a pas donné le
  chiffre — avec un avertissement à l'émission quand une facture est dessous et porte quand même
  une retenue. Et le contrôle d'une heure sur l'e-facture : notre modèle porte-t-il déjà ce qu'un
  format officiel exigerait ?
- **Dépend de.** Une seule chose : la séance de validation avec le comptable (§ 20, point 0e), qui
  tranche les quatre en une fois.
- **Exclu.** Tout le reste. Cette version ne contient rien d'autre, exprès.
- **Preuve.** Un test par règle, chacun prouvé en réintroduisant le défaut ; le test du seuil
  s'écrit sur un taux **négatif**, parce que `Number('') === 0` rend l'assertion évidente inutile
  (leçon de la 8.3.0).

### 9.2.0 — Le livre du dossier (une à deux semaines)

- **Cabinet.** Un fichier par dossier (`livre.json`), migration sans perte de l'état actuel.
  Exercices (création, plusieurs ouverts). Plan de comptes : le SCE complet à tous les niveaux,
  modifiable, initialisé depuis le plan de référence du cabinet ; import d'un plan (CSV). Journaux.
  **Importer un paquet crée des écritures** (source `skanfact`, pièce jointe, validées si
  définitif, brouillard sinon) ; les paquets déjà reçus sont relus une fois. Mois renvoyé : les
  brouillards sont remplacés, les validées montrent l'écart. Reprise d'un dossier existant par
  **balance d'ouverture** saisie ou importée (CSV/Excel), à une date de reprise. Les quatre onglets
  de la 9.1.0 lisent désormais le livre. Les pièces absentes annoncées par le manifeste s'affichent
  à côté des écritures. Sauvegardes, copie externe, clé de secours et changement d'ordinateur
  emportent les livres (e2e `perte` et `demenagement` rejoués).
- **Entreprise.** Le manifeste du paquet porte la licence du client et la mention d'essai ; le
  numéro de format du paquet monte ; l'app dit si le Cabinet du destinataire est trop ancien.
- **La signature du paquet, remontée de la 9.9.0 (15/09/2026).** Le client **signe le manifeste**
  avec sa clé privée — celle qu'il crée déjà à l'appairage pour recevoir les questions chiffrées —
  et le cabinet **épingle** sa clé publique au dossier au premier paquet. Un paquet signé par une
  autre clé est refusé en nommant le dossier ; un paquet non signé (ancienne version) est accepté
  avec la mention « origine non prouvée », jamais en silence. Jusqu'ici, n'importe qui tenant le
  fichier d'appairage — que le cabinet donne à tous ses clients — pouvait fabriquer un paquet au nom
  d'une autre entreprise (§ 6). La ranger avec la révision, huit versions plus loin, revenait à
  laisser le trou ouvert pendant toute la période où le pilote utilise vraiment le Cabinet.
- **Dépend de.** Le plan de comptes du comptable, son logiciel actuel (pour le format de la balance
  d'ouverture).
- **Exclu.** La saisie à la main (sauf la balance d'ouverture), la banque.
- **Preuve.** Parité maintenue ; e2e : reprise d'un dossier par balance, import de douze paquets,
  mois renvoyé ; e2e `refus` avec un paquet au nouveau format sur un Cabinet ancien, **plus deux cas
  d'imposture** : un paquet scellé pour le bon cabinet mais signé par une autre clé (refusé en
  nommant le dossier), et un paquet non signé (accepté, marqué « origine non prouvée »). Le test de
  charge de la 9.1.0 est rejoué sur le format réellement écrit.

### 9.3.0 — La saisie (deux semaines)

- **Cabinet.** L'écran de saisie au kilomètre, tout au clavier : journal, date, pièce, lignes
  compte/tiers/libellé/débit/crédit ; recherche de compte par numéro ou nom pendant la frappe ;
  raccourcis (recopier la ligne du dessus, **solder automatiquement la dernière ligne**, dupliquer,
  valider et enchaîner sur la pièce suivante depuis le dernier champ) ; contrôle d'équilibre ; pièce
  jointe glissée. Les touches exactes se décident **en regardant le comptable saisir dans son
  logiciel actuel** : reprendre les siennes vaut mieux que lui en imposer d'autres.
  **Brouillard puis validation** (numéro attribué à la validation, irréversible, contre-passation,
  extourne au 1er du mois suivant). Guides d'écritures et abonnements. Recherche dans le journal.
  **Piste d'audit** (qui, quand, quoi). Table de correspondance des comptes du cabinet appliquée aux
  livres et à l'export.
- **Dépend de.** Regarder le comptable saisir dans son logiciel actuel (les touches, l'ordre des
  champs, ce qui l'agace).
- **Exclu.** Les collaborateurs (un seul auteur : le poste), la banque.
- **Preuve.** e2e : mille écritures saisies au clavier sans souris ; une validée refusée à la
  modification ; une contre-passation ; l'extourne ; test de source « aucune écriture validée ne se
  modifie ailleurs que par contre-passation ».

### 9.3.x et P 0.3 — La licence du Cabinet (une semaine)

- **Cabinet.** La clé de licence de type cabinet (sujet = empreinte, quota), vérifiée hors ligne
  avec les clés publiques embarquées (le fichier des clés et `licence.js` entrent dans la
  construction du Cabinet). Le comptage (dossiers actifs hors SkanFact, les trois gratuits, la
  grâce de douze mois après une licence payée — pas 60 jours, corrigé le 15/09/2026, § 3 —, l'expiration client vue 30 jours avant). La porte unique sur la validation.
  Réglages → Licence (coller, état, ce qui est compté, la liste des dossiers hors SkanFact), le
  bandeau à trois tons, « À faire », « Demander une licence ».
- **Plateforme.** Une table `cabinets`, le lien cabinet ↔ clients, l'offre Cabinet dans la console
  (émettre, marquer payée, renouveler, monter le quota au prorata, révoquer), l'export régulier de
  la base.
- **Entreprise.** Le module Éditeur sait tirer et facturer une vente de type cabinet.
- **Dépend de.** L'Ordre (avant de vendre, pas avant de construire) ; les prix.
- **Preuve.** e2e `cabinet-licence` (jumeau de `e2e:licence`) : quota atteint, validation refusée,
  lecture ouverte, dossier archivé qui ne compte plus, licence client dans un paquet qui rend le
  dossier gratuit, paquet ancien qui le dit ; test « ce qui remonte au serveur » étendu.

### 9.3.1 — Entretien (quelques jours)

- **Contenu.** La mise à jour d'Electron du semestre ; la conversion des 93 déclarations CSS
  physiques en logiques (§ 3) ; le premier découpage de `app.js` par route (§ 15) ; la dette listée
  au § 15 point 15 qui n'a pas encore été remboursée ; les retours de la bêta 9.3.0 qui ne sont pas
  des nouveautés. **Aucune fonction nouvelle, par règle.**
- **Preuve.** Tous les e2e relancés — c'est la seule version où on les relance TOUS sans exception,
  parce que c'est celle où le moteur de rendu change.

### 9.4.0 — La banque (deux semaines)

- **Cabinet.** Import du relevé bancaire (CSV des banques tunisiennes — BIAT, Attijari, STB, UIB,
  BH et les autres que ses clients utilisent —, OFX, MT940), rapprochement automatique (montant,
  date à ± n jours, libellé),
  proposition d'écriture pour chaque ligne non rapprochée (guide selon le libellé), suspens, état
  de rapprochement, lettrage automatique des tiers (montant, référence), lettrage et délettrage à
  la main, échéancier, balance âgée clients et fournisseurs.
- **Deux choses distinctes, jamais mélangées.** Le **rapprochement bancaire** confronte le relevé de
  la banque aux écritures du compte 532 : il répond à « la banque et mon livre disent-ils la même
  chose ? ». Le **lettrage** rapproche une facture et son règlement sur le compte d'un tiers : il
  répond à « ce client me doit-il encore quelque chose ? ». Les confondre donnerait un état de
  rapprochement faux et un échéancier faux. Deux écrans, deux modèles, deux tests.
- **Une correspondance automatique ne se valide jamais toute seule.** Chaque proposition porte son
  **niveau de confiance** : certaine (même montant, même jour, même référence), probable (montant
  et date proches), ambiguë (plusieurs candidats), à contrôler. Seule la première se pose d'office,
  et elle reste défaisable ; les autres attendent un clic humain, et l'ambiguë montre tous les
  candidats. Un rapprochement automatique silencieux qui se trompe, c'est un compte faux que
  personne ne rouvre. **Décidé.**
- **Dépend de.** Les relevés réels de ses clients (un importeur par format).
- **Preuve.** e2e : un relevé importé, rapproché à 90 % automatiquement, le reste à la main, l'état
  de rapprochement à écart nul ; tests unitaires sur chaque format de relevé avec un fichier réel
  anonymisé.

### 9.5.0 — Le fiscal mensuel tunisien (une à deux semaines)

- **Cabinet.** La déclaration mensuelle complète depuis les écritures (TVA par taux, retenues par
  nature, TFP, FOPROLOS, TCL, timbre), au format du formulaire officiel, avec l'écriture de
  déclaration générée ; les acomptes provisionnels ; le calendrier fiscal par dossier selon son
  régime, avec « déclaré » et « payé » pointés (l'état d'un mois côté cabinet : reçu → saisi →
  déclaré → payé) ; la préparation de la télédéclaration (le fichier ou les chiffres à reporter).
- **Dépend de.** Le modèle officiel du mois et ses cases ; les réponses aux « À VÉRIFIER » de
  8.9.0/9.0.0 (TVA au dernier jour, compte 13, contreparties, TFP).
- **Exclu.** Le dépôt à la place du cabinet.
- **Preuve.** Test : la déclaration d'un mois de l'exemple, case par case, contre un calcul à la
  main ; e2e : pointer déclaré puis payé, et le défaire.

### 9.5.1 — Entretien (quelques jours)

- **Contenu.** Comme la 9.3.1 : Electron si une version est sortie, dette, découpage suivant
  (`core.js` → `compta.js` fini, `run-tests.js` découpé par domaine), retours de bêta hors
  nouveautés. **Aucune fonction nouvelle.**

### 9.6.0 — La clôture d'exercice (deux à trois semaines)

- **Cabinet.** Écritures d'inventaire guidées (dotations, provisions, CCA, FNP, PCA, FAE,
  régularisations) avec extourne automatique ; contrôles de clôture (comptes d'attente, brouillard
  restant, TVA non déclarée, balance des tiers) ; clôture d'exercice définitive, tracée ; à-nouveaux
  générés ; exercice suivant ouvert pendant que le précédent se termine ; états financiers au
  format SCE (bilan, état de résultat, flux de trésorerie, notes), comparatif N/N-1, SIG, ratios ;
  impression et PDF.
- **Le flux retour de clôture (`.skanclose`).** À la clôture d'un exercice, le Cabinet produit un
  fichier pour le client, chiffré pour lui, qui porte : les **à-nouveaux officiels** (les soldes
  d'ouverture de l'exercice suivant), la liste des **écritures d'inventaire** passées par le
  cabinet (dotations, provisions, régularisations) avec leur libellé, et la **date de clôture**.
  Côté entreprise, l'import pose ces à-nouveaux, verrouille l'exercice clos (comme une clôture
  mensuelle, mais sur l'année) et affiche ce que le comptable a ajouté. Sans ça, le bilan du client
  et celui du cabinet divergent **pour toujours**, et l'écart grandit chaque année : c'est le
  défaut le plus grave que le pont pouvait avoir. **Décidé, 9.6.0.**
- **Entreprise.** Réception du `.skanclose` : à-nouveaux officiels, exercice verrouillé, liste des
  écritures du comptable en lecture. Le module Comptabilité optionnel affiche alors les vrais
  chiffres, pas les siens.
- **Et si le client n'a pas la version qui lit le `.skanclose` ?** Le cas que ce document ne traitait
  pas (relecture du 15/09/2026). **Le cabinet clôture quand même** : sa clôture est SON acte, elle ne
  peut pas dépendre de l'ordinateur d'un client. Le fichier est produit, rangé avec le dossier, et
  **renvoyé automatiquement avec la première question ou relance suivante** tant qu'il n'a pas été
  importé — le Cabinet sait qu'il ne l'a pas été parce que le paquet suivant du client ne porte pas
  la date de clôture dans son manifeste. Côté client, une version trop ancienne dit « ton comptable a
  clôturé 2026 : mets à jour SkanFact pour recevoir les chiffres officiels » (le même mécanisme que
  « Cabinet trop ancien », dans l'autre sens). Et le `.skanclose` porte aussi une **version PDF**
  lisible par n'importe qui — la balance d'ouverture et la liste des écritures d'inventaire — pour
  que le client ait ses chiffres même s'il ne met jamais à jour. Ce qui reste bloqué sans import :
  seulement la clôture de l'exercice **suivant** côté client, puisqu'elle partirait de faux
  à-nouveaux. **Décidé.**
- **Dépend de.** La présentation exacte des états (NCT 01) et des notes.
- **Preuve.** Test : actif = passif, résultat identique des deux côtés, à-nouveau égal aux soldes
  du 31/12 ; e2e : une clôture refusée puis acceptée, la réouverture impossible ; **e2e du flux
  retour : le cabinet clôture, le client importe, le bilan des deux applications est identique au
  millime** — le jumeau du test de parité, dans l'autre sens.

### 9.7.0 — Immobilisations et stocks (une semaine)

- **Cabinet.** Fiches d'immobilisations tenues par le cabinet (linéaire et dégressif, tableau de
  l'exercice, cessions, mises au rebut, subventions), inventaire de stock de fin d'exercice et sa
  variation en écriture ; ce qui vient d'un paquet entre dans les mêmes fiches sans ressaisie.
- **Preuve.** Test du dégressif contre un calcul à la main ; parité avec l'app entreprise sur les
  biens venus d'un paquet.

### 9.8.0 — Le cabinet à plusieurs (deux semaines)

- **Cabinet.** Collaborateurs (identité locale, droits par dossier : saisie, validation,
  supervision) ; deux postes sur le même dossier sans s'écraser (révision et fusion, comme le
  partage de l'app entreprise ; une écriture validée ne se fusionne jamais, elle existe ou pas) ;
  verrouillage automatique ; tableau de production (par dossier et par mois : qui, depuis quand) ;
  « À faire » par collaborateur.
- **Preuve.** e2e à deux postes (comme `e2e:partage`) ; test de fusion des livres.

### 9.8.1 — Entretien (quelques jours)

- **Contenu.** Comme les précédentes. C'est aussi celle où l'on relit `CLAUDE.md` en entier pour
  retirer ce qui n'est plus vrai — un document de mémoire qui grossit sans jamais maigrir finit par
  mentir par omission.

### 9.9.0 — La révision et les questions (deux semaines)

- **Cabinet.** Dossier de révision par exercice (feuilles maîtresses par cycle, comptes revus et
  signés, points en suspens, notes de revue, questionnaire de fin d'exercice) ; **questions au
  client** envoyées depuis la ligne (pièce absente, 471 non soldé, facture ouverte, mois provisoire)
  . *(La signature du paquet et l'épinglage de la clé ne sont plus ici : ils sont remontés en 9.2.0
  le 15/09/2026 — voir § 6.)*
- **Entreprise.** Réception des questions, affichage sur la pièce, réponse, pièce jointe, mois
  révisé renvoyé.
- **Dépend de.** La méthode de révision du comptable. Le transport des questions est décidé
  (chiffré, § 6) et sa clé existe depuis la 9.2.0, puisque c'est la même que celle de la signature.
- **Preuve.** e2e `boucle` étendu : une question part, arrive sur la pièce, la réponse revient dans
  un mois révisé.

### 10.0.0 — La liasse et l'annuel (deux semaines)

- **Cabinet.** Liasse fiscale de l'année, déclaration annuelle d'IS ou d'IRPP, déclaration
  d'employeur, états signés ; **le jeu d'exemple livre de vrais paquets** et des dossiers d'exemple
  (dont un avec un mois manquant et un client sans SkanFact) : tout est rempli au premier
  lancement.
- **Site et aide.** Page Tarifs complète, téléchargement du Cabinet, conditions de vente, manuel de
  tenue dans l'aide du Cabinet.
- **Dépend de.** La liasse de l'année et ce que le portail accepte.
- **Preuve.** e2e : le premier lancement ouvre un paquet réel et affiche des livres non vides.

### Hors plan, volontairement

La télédéclaration à la place du cabinet ; la paie de cabinet (tant qu'aucun cabinet ne la
demande) ; la facturation des honoraires ; la gestion du temps ; la GED de cabinet ; le serveur de
transport (tant qu'aucun cabinet ne le demande) ; l'application mobile ; l'e-facture (tant qu'elle
n'est pas obligatoire) ; l'interface en arabe ; un autre pays.

---

## 17. Les risques, et ce qui les couvre

- **Le comptable ne joue pas le jeu du pilote.** On reste sur le pont amélioré (les livres lus dans
  les paquets, 9.1.0) et on ne construit pas la tenue complète sans cabinet. Un logiciel « au
  niveau des meilleurs » construit sans personne qui l'utilise tous les jours serait un beau
  logiciel que personne n'ouvre. **Décidé.**
- **A-t-il seulement dit oui ?** Ce document parlait de « ton comptable, le cabinet pilote » comme
  d'un fait acquis, et une relecture extérieure a eu raison de demander où était son accord. Il a
  regardé l'application et il a dit ce qui manquait — ce n'est pas la même chose que s'engager à
  l'utiliser sur de vrais dossiers pendant six mois. **À toi, en deux temps : la question orale
  MAINTENANT, avant d'écrire une ligne de la 9.1.0** (« si je te montre tes livres lus dans les
  paquets d'ici quelques semaines, tu essaies sur deux dossiers ? » — une réponse de dix secondes,
  qui coûte un appel), **puis l'engagement écrit après avoir vu la 9.1.0, avant la 9.2.0** : on ne
  demande pas à quelqu'un de s'engager sur un écran qu'il n'a pas vu, et la 9.1.0 est courte
  précisément pour ça. Une relecture voulait l'écrit avant la 9.1.0 ; c'est demander l'engagement
  avant la démonstration. Ce qu'on lui demande : essayer sur deux ou
  trois dossiers réels, répondre aux questions de conception, dire quand c'est faux. Ce qu'on lui
  donne : gratuit à vie pour son cabinet, son avis dans le produit, et son nom s'il le veut.
- **Et s'il s'arrête en cours de route** (il change d'avis, il part à la retraite, il tombe malade) ?
  C'est un point de défaillance unique, et il l'est doublement : sans lui, on perd le pilote **et**
  la source des réponses fiscales. Deux parades. **Un second cabinet, même informel** — quelqu'un à
  qui montrer une version tous les deux mois, sans engagement : ça vaut surtout pour éviter de
  construire pour une seule personne. Et **les questions au comptable se posent par écrit et se
  rangent dans le dépôt** avec leurs réponses : si le pilote disparaît, ce qu'il a déjà tranché
  reste. **À toi.**
- **On s'éparpille.** Une version à la fois, finie, testée, publiée, utilisée avant la suivante.
  Ce qui n'est pas décrit dans le § 16 n'entre pas dans la version. **Décidé.**
- **La loi de finances change les taux.** Aucun taux n'est écrit en dur, tout est paramétrable, et
  l'application porte « À VÉRIFIER » partout où un chiffre relève du comptable. **Décidé.**
- **Sage sort la même chose.** Notre différence est de structure, pas de fonctions : le pont avec le
  client, le hors-ligne, pas de sièges, le prix.
- **Skander est seul.** Le dépôt porte les plans, les règles apprises et les tests : un développeur
  qui arrive peut reprendre. Et la clé maître est sauvegardée. Mais « reprendre » veut dire quoi,
  exactement ? Voir les trois questions de continuité ci-dessous : elles manquaient, une relecture
  extérieure les a posées, et ce sont les plus importantes du document.
- **Skander est absent six mois (maladie, accident, autre chose).** C'est la question que ce document
  ne posait pas, et elle a une mauvaise réponse aujourd'hui. Les applications installées continuent
  de fonctionner, c'est acquis. Mais **personne d'autre ne peut émettre une licence** : la clé privée
  maître est sur son Mac et dans sa copie personnelle, et le secret d'administration de la console
  aussi. Un client dont l'essai finit pendant cette absence ne peut pas acheter ; un client qui
  renouvelle ne peut pas être servi. **À construire (avant les dix premiers clients) : un pli
  scellé.** Et puisqu'une relecture a demandé « qui, où, comment » — voici le mécanisme, décidé ;
  seul le « qui » reste à toi. **Ce qu'il contient** : la clé privée maître, la clé `srv-1`, le
  secret d'administration, l'accès au dépôt, et une page de marche à suivre écrite pour quelqu'un
  qui ne connaît pas le projet (« ouvrir SkanFact, panneau Éditeur, émettre ; ou la console »).
  **Comment il est protégé** : le tout scellé par le mécanisme qui existe déjà pour la clé de
  secours du Cabinet (`makeRecovery` : un fichier chiffré par un mot de passe, AES-256-GCM +
  scrypt), sur **deux supports** (une clé USB et une impression papier du fichier en base64,
  parce qu'une clé USB meurt en dix ans et le papier non), **chez deux personnes différentes** : le
  fichier chez l'une, le mot de passe chez l'autre — aucune des deux ne peut agir seule, et
  aucune ne peut perdre les deux. **Quand on l'ouvre** : sur une consigne écrite, remise avec le pli
  (absence de plus de trois mois sans nouvelles, incapacité, décès), et l'ouverture se dit aux
  clients par un mot dans la lettre d'information suivante. **Qui** : deux personnes qui ne vivent
  pas sous le même toit — **à toi**. Et le pli se **rejoue** une fois par an : on vérifie qu'il
  s'ouvre encore, comme on vérifie une sauvegarde. Ce n'est pas un mécanisme technique, et c'est
  justement pour ça que personne n'y pense.
- **Skander arrête, définitivement.** Chaque client garde un logiciel qui marche, ses données et ses
  fichiers : c'est la promesse tenue depuis la 6.4.0, et elle est réelle. Ce qu'il faut préparer en
  plus tient en deux gestes : **la dernière version publiée ne doit jamais dépendre d'un service à
  payer** (c'est déjà vrai : sans relais, les applications retombent sur GitHub ; sans plateforme,
  rien ne se verrouille), et **une licence « à vie » doit pouvoir être émise en lot** pour les
  clients en cours si l'aventure s'arrête. Ce second point n'existe pas et coûte une demi-journée
  — et une relecture a demandé comment, donc voici : **un bouton dans le panneau Éditeur, « Libérer
  tous les clients… »**, qui lit la liste des licences actives (la base de la console si elle
  répond, sinon `data.licences` du poste), signe pour chaque matricule une clé **sans date de fin**
  avec la clé maître, l'envoie par le gabarit de mail habituel (Resend si réglé, sinon un fichier
  par client à envoyer à la main), et écrit une ligne d'historique par clé. Il demande une
  confirmation qui nomme le nombre de clients, et il est **irréversible par construction** — une
  clé livrée ne se reprend pas (8.2.0), et c'est ici une qualité. Il vit derrière le passe-droit
  éditeur, donc n'existe sur aucun autre poste. **À construire, avec le pli scellé, avant les dix
  premiers clients** : le pli sert à ce que quelqu'un puisse appuyer sur ce bouton.
- **Claude devient indisponible** (fin du service, quota épuisé, coût). Le code reste du JavaScript
  ordinaire, sans bundler ni framework, avec 384 vérifications et une quarantaine de parcours qui
  ouvrent vraiment les applications, et des plans qui expliquent chaque décision. Un développeur
  humain peut donc reprendre. Il faut être honnête sur ce qu'il en coûterait : le **rythme**
  s'effondrerait, et une grande partie de ce qui tient ce projet debout est la mémoire écrite dans
  `CLAUDE.md` — c'est elle qu'il faudrait relire, pas le code. C'est une raison de plus de la tenir à
  jour à chaque version, ce qui est déjà la règle.
- **Un service gratuit cesse de l'être** (GitHub Actions, Cloudflare, Resend, OVH). Aucun n'est dans
  le chemin critique d'un client qui travaille : ils servent à publier, à mettre à jour, à envoyer un
  mail et à porter un nom de domaine. Chacun a un remplaçant et une porte de sortie — l'installateur
  local pour la publication, le repli GitHub pour les mises à jour, l'envoi manuel pour les clés, un
  autre registraire pour le domaine. Ce qu'il faut surveiller n'est pas la panne, c'est le **coût qui
  monte** sans qu'on le regarde : un point une fois par an suffit.
- **L'INNORPI refuse la marque, ou quelqu'un la dépose avant.** Alors il faut renommer le produit —
  les deux applications, le site, le domaine, les mails, les fichiers d'installation, et prévenir les
  clients. C'est quelques centaines de dinars de dépôt aujourd'hui contre des semaines de travail et
  une perte de crédibilité plus tard. Les trois relectures extérieures ont toutes mis ce point dans
  leurs recommandations les plus rentables, et elles ont raison : **c'est la chose la moins chère et
  la plus urgente de toute la liste.** Rien ne dépend de personne d'autre pour la faire.
- **L'Ordre refuse la gratuité conditionnelle.** Le logiciel ne change pas — c'est le **prix** qui
  serait à refaire, pas le produit, et c'est pourquoi on ne suspend pas le développement en attendant
  (voir § 20). Plan B déjà identifié : le cabinet paie un forfait annuel simple, sans condition, et
  c'est le **client** qui reçoit la remise quand son cabinet est équipé. Le levier change de côté, le
  modèle tient. **À VALIDER JURIDIQUEMENT.**
- **Un client attaque SkanFact pour une erreur de calcul.** Il n'y a pas de réponse purement
  technique à cette question : « l'application calcule et propose, le comptable valide » décrit la
  bonne pratique, pas la responsabilité juridique, et elle ne protège de rien si le client n'a pas de
  comptable. Ce qui protège vraiment est ailleurs et n'existe pas encore : des **conditions de vente**
  qui disent le périmètre et limitent la responsabilité, une assurance professionnelle, et le fait —
  vérifiable — que l'application n'a jamais prétendu remplacer un comptable. **À VALIDER
  JURIDIQUEMENT, avant la première vente.**
- **Un chiffre faux chez un comptable.** Le risque le plus grave : il ruine la confiance en une fois.
  D'où le test de parité, les contrôles (balance équilibrée, lettrage égal au solde du compte
  client), et la règle « on ne montre que ce qu'on peut prouver » (« 7 pièces vérifiées, intactes »
  doit compter juste).
- **Une clé privée qui fuit.** Les clés sont séparées et retirables une à une ; la maître ne va
  jamais sur un serveur ; ce qui a été vu est brûlé et recréé.
- **Une perte de données chez un client.** Sauvegardes quotidiennes, copie externe, migration après
  sauvegarde, fichier illisible mis de côté. Le seul cas sans issue est le mot de passe oublié, et
  il est annoncé.
- **Le quota de publication.** Regrouper, publier par lot ; l'installateur local en secours.
- **La plateforme tombe ou est piratée.** Les applications continuent (tout y est facultatif) ; la
  base ne contient ni données comptables ni montants ; les clés privées y sont retirables ; un
  export régulier de la base est à mettre en place.
- **Un cabinet reçoit un paquet frauduleux.** Aujourd'hui, la parade est incomplète et il faut le
  dire : chiffré pour lui, empreintes vérifiées, fichiers non annoncés signalés — mais **rien ne
  prouve l'expéditeur**, puisque le scellement n'utilise qu'une clé publique que le cabinet
  distribue à tous ses clients. C'est le trou que la troisième relecture extérieure a trouvé, et il
  se ferme en 9.2.0 par la signature du client (voir § 6), pas en 9.9.0 comme prévu jusqu'ici.

---

## 18. Quand je suis perdu : où trouver quoi

### Les documents

| Je cherche… | Le document |
|---|---|
| Les décisions, le modèle économique, l'ordre des versions | `DIRECTION.md` |
| **Quoi faire cette semaine**, les jalons, le chemin critique, les 26 premières semaines | `PLAN-DEVELOPPEMENT.md` |
| **Tout ce qui reste à faire**, version par version, de la 9.1.0 à la 10.0.0 | `VERSIONS-A-VENIR.md` |
| Le schéma exact d'un fichier, la signature d'une fonction, un format, un test à écrire, une migration | `CAHIER-DES-CHARGES.md` |
| Ce que le Cabinet doit devenir, version par version, et les dix domaines comparés aux concurrents | `PLAN-COMPTABLE.md` |
| L'histoire du Cabinet, ses audits, ses règles apprises | `PLAN-CABINET.md` |
| La plateforme, les clés, l'API, la console, comment la déployer | `PLAN-PLATEFORME.md`, `plateforme/README.md` |
| Le relais de mise à jour, comment l'installer | `worker/README.md` |
| Le domaine, le DNS, les mails, ce qui a été basculé et quand | `plateforme/DNS-skanfact-tn.md` |
| L'audit d'ergonomie de l'app entreprise | `PLAN-UX.md` |
| Les modules de l'app entreprise et leur histoire | `ROADMAP.md` |
| Toutes les règles apprises, version par version, pour qui écrit du code | `CLAUDE.md` |
| Ce qui a changé à chaque version | `CHANGELOG.md` |
| Comment installer, lancer, tester | `README.md` |
| Comment signaler une faille | `SECURITY.md` |
| Ce document | `QUESTIONS.md` |

### Les endroits

| Je cherche… | Où c'est |
|---|---|
| Le code | GitHub, `saouthq/skanfact`, branche `main` |
| Les versions publiées et leurs installateurs | GitHub → Releases |
| Lancer une publication | GitHub → Actions → Release → Run workflow (branche `main`, ou `beta` pour une préversion) |
| Les secrets de construction | GitHub → Settings → Secrets |
| La console des licences | `https://api.skanfact.tn` dans un navigateur, avec le secret d'administration |
| Les réglages de la plateforme (secrets, clés) | Cloudflare → Workers → `skanfact-api` → Settings |
| Le relais de mise à jour | Cloudflare → Workers → `skanfact-maj` |
| Le DNS | Cloudflare → `skanfact.tn` |
| Le domaine et la boîte mail | OVH |
| La clé privée maître | `~/.skanfact/licence-privee.pem` sur le Mac de Skander, et sa copie à l'abri |
| Le secret d'administration de la console | `~/.skanfact/plateforme-admin.json` sur le Mac de Skander |
| Le site | dépôt `skanfact-site`, GitHub Pages |
| Le journal technique d'une application | Paramètres → Aide et dépannage → Ouvrir le journal (ou « Signaler un problème ») |
| Les données d'une entreprise sur le poste | le dossier de données de l'application, chemin affiché dans Paramètres → Sécurité et données |

### Les écrans

| Je veux… | Dans l'app entreprise |
|---|---|
| Voir ce qui part au comptable | Comptabilité → Écritures, Comptabilité → Cabinet |
| Envoyer le mois au comptable | Comptabilité → Cabinet → « Envoyer au cabinet » |
| Clôturer un mois, ou le rouvrir avec un motif | Comptabilité → Clôtures |
| Appairer un cabinet | Paramètres → Cabinet comptable → importer le `.skanpair` |
| Coller une licence, voir l'essai, demander une licence | Paramètres → Licence |
| Vendre une licence (éditeur seulement) | Licences (menu), Paramètres → Éditeur |
| Activer ou masquer un module | Paramètres → Modules |
| Charger le jeu d'exemple, restaurer une sauvegarde, chiffrer | Paramètres → Sécurité et données |
| Changer d'entreprise | Le nom en haut du menu |
| Cocher la bêta | Paramètres → L'application → Mises à jour |

| Je veux… | Dans l'app cabinet |
|---|---|
| Recevoir un paquet | Le glisser sur la fenêtre, ou double-cliquer le fichier |
| Donner mon appairage à un client | Réglages → Mon cabinet → Exporter l'appairage |
| Enregistrer ma clé de secours, régler la copie externe | Réglages → Données et sécurité |
| Relancer les clients en retard | Relances |
| Voir les échéances de mes clients | Échéances |
| Exporter les écritures de tous mes clients | Écritures |
| Ajouter des clients en collant une liste | Dossiers → Ajouter |

### Que faire si…

| Situation | Ce qu'il faut savoir |
|---|---|
| « La console ne répond pas » sur le Mac, mais marche sur l'iPhone | Cache DNS du Mac : régler le Wi-Fi sur 1.1.1.1 / 1.0.0.1, ou passer en partage 4G |
| L'application dit « L'application n'a plus répondu pendant N secondes » | Le chien de garde a relancé l'interface ; le journal nomme la fonction. Si l'ordinateur dormait, c'est un faux positif corrigé en 8.1.0 |
| Un client dit que sa clé est refusée | Vérifier le matricule (la clé est attachée aux sept chiffres et la lettre), et que sa version embarque la clé qui l'a signée |
| Un client a perdu sa clé | Console → la licence → « Voir la clé » ou « Renvoyer par mail » |
| Le run Release est rouge | Lire les logs du job qui a échoué ; ne jamais dire « publié » tant que les quatre installateurs ne sont pas dans la release |
| Une version publiée a un défaut | Publier une version corrective par-dessus ; jamais de retour en arrière |
| Un mois reçu deux fois au cabinet | Normal : le client a rouvert sa période. L'application le dit, surtout si l'ancien était définitif |
| Le cabinet change d'ordinateur | « J'ai déjà un cabinet sur un autre ordinateur… » sur l'écran de mot de passe, avec la clé de secours : la même empreinte doit s'afficher à l'arrivée |
| Un chiffre diffère entre deux écrans | C'est un bug, jamais une nuance : deux écrans qui montrent la même chose se calculent avec la même fonction |
| Une clé privée a été collée au mauvais endroit | Elle est brûlée : on la marque retirée, on en crée une autre, on réémet ce qu'elle a signé |
| Le dépôt doit redevenir privé | Une ligne dans `src/depot.js` ; vérifier le droit de lecture du jeton du relais ; le quota Actions revient |

---

## 19. Les décisions à ne pas rediscuter

1. Deux applications, un dépôt, un moteur partagé, le même numéro de version.
2. Hors ligne pour toujours ; le serveur ne fait que gérer les licences et, un jour, transporter.
3. Les données restent sur le poste ; rien ne remonte, jamais, sauf ce qui est écrit au § 11.
4. Jamais de données en otage : une licence expirée bloque la création, jamais la lecture,
   l'export, le paquet.
5. L'app entreprise s'arrête à la gestion ; la comptabilité y est une option masquée et payante.
6. Le Cabinet tient les livres, avec ou sans SkanFact chez le client, et n'écrit jamais chez lui.
7. Le paquet est le pont, dans les deux sens, et reste un ZIP ordinaire.
8. Le cabinet paie par dossier hors SkanFact au-delà de trois ; gratuit pour les dossiers SkanFact ;
   postes illimités ; jamais d'argent versé au cabinet.
9. Un clic pour vendre, pas zéro : la clé part quand Skander marque payé.
10. La clé maître ne va jamais sur un serveur ; une clé privée vue est brûlée ; une clé retirée
    n'est jamais effacée.
11. Une pièce émise ne se modifie pas ; une écriture validée ne se modifie pas.
12. Aucun taux en dur ; « À VÉRIFIER » partout où un chiffre relève du comptable.
13. Une version à la fois, finie, testée, publiée, sur le bureau du pilote avant la suivante.
14. Un test se prouve en réintroduisant le défaut ; quand une règle change, le test se relit.
15. Electron et JavaScript pur, fichiers JSON, pas de bibliothèque tierce dans l'application.
16. Le comptable de Skander est le pilote ; sans pilote, pas de tenue complète.
17. Chaque lot passe par une bêta avant la stable ; une seule bêta à la fois ; jamais une bêta chez
    qui ne l'a pas demandée.
18. Jamais de mise à jour forcée, jamais de coupure à distance, jamais de retrait d'une version
    publiée : un défaut se corrige par une version par-dessus.
19. Une version ne casse jamais ce qu'une précédente a écrit : données, paquets, clés, réglages,
    pièces émises.
20. On ne développe ni ne teste jamais sur de vraies données : le mode développement, les tests et
    les constructions d'essai travaillent dans des dossiers à part. Une version passe par l'essai,
    la bêta, puis la stable.
21. Aucun fichier de code ne dépasse plus sa taille du 15/09/2026 ; le code neuf va dans un fichier
    neuf ; le découpage se fait par occasion, jamais d'un coup.
22. Les champs de données gardent leur nom pour toujours ; le code neuf est en français.
23. Une version sur quatre est une version d'entretien, sans nouveauté.
24. Chaque version reçoit une relecture indépendante avant la bêta ; les versions qui touchent à
    l'argent, aux clés ou aux chiffres comptables reçoivent la relecture adversariale complète.
25. Tout ce qui circule entre le client et le cabinet est chiffré : le paquet, les questions, la
    clôture. Aucune exception au motif que « ce n'est pas une pièce comptable ».
26. L'import d'un mois remplace les écritures de ce mois ; il n'ajoute jamais. Ce qui est validé
    n'est pas remplacé : l'écart s'affiche et le comptable décide.
27. À la clôture d'un exercice, le cabinet renvoie les à-nouveaux officiels au client. Les deux
    bilans doivent être identiques au millime, dans les deux sens.
28. SkanFact Entreprise produit des **écritures sources**, pas une comptabilité. Le livre officiel
    est celui du cabinet. On ne dit jamais au client que sa comptabilité est faite.
29. Le cabinet peut corriger une écriture venue d'un paquet **tant qu'elle est en brouillard**, dans
    son livre à lui, avec la trace de l'origine et de la modification. Il ne touche jamais aux
    données du client.
30. Une écriture équilibrée n'est pas une écriture correcte : chaque calcul comptable a un contrôle
    qui ne passe pas par l'équilibre. **La liste, au 15/09/2026, chacun tenu par un test de
    `npm test`** (une relecture a demandé qu'elle soit écrite) : le reste ouvert du lettrage égale
    le solde du 411 ; la banque du grand livre égale la banque de la Trésorerie, au millime, sur
    chaque compte ; la trésorerie du bilan égale `cashPosition` ; le résultat du bilan égale celui
    de l'état de résultat ; l'à-nouveau égale les soldes réels du 31 décembre (et jamais les
    à-nouveaux précédents) ; les ventes n'ouvrent pas l'année, la banque si, le résultat porte le
    net ; le 4366 garde exactement le report que `vatChain` reporte ; le 28 d'un bien cédé est
    repris en entier ; sur un mois, on amortit un mois. Et à venir avec le Cabinet : la parité de
    balance entre les deux applications, dans les deux sens. Un contrôle qui n'est pas dans cette
    liste et pas dans un test n'existe pas.
31. Rien de sensible ne dépend d'un secret embarqué dans l'application. Ce qui décide de l'argent ou
    d'un droit se vérifie par une signature.
32. Une correspondance automatique (rapprochement, lettrage) ne se valide jamais toute seule si elle
    est ambiguë.
33. On ne dit pas le droit. Une affirmation juridique porte la marque « À VALIDER JURIDIQUEMENT » et
    attend un juriste.
34. **Un paquet est signé par le client** et sa clé est épinglée au dossier du cabinet (9.2.0).
    Chiffrer dit « seul le cabinet peut lire » ; seule une signature dit « ça vient bien de lui ».
    Un paquet non signé est accepté avec la mention « origine non prouvée », jamais en silence.
35. **On mesure avant d'écrire un format de données**, jamais après. Un test de charge qui arrive
    après la version qui fixe le format ne sert qu'à nommer un problème qu'on ne peut plus corriger.
36. **La valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien.** Un seuil
    inconnu vaut 0, pas une valeur plausible : une valeur plausible écrite en dur est une règle de
    droit inventée, et elle change en silence des chiffres qui étaient justes.
37. **Un filet se réclame au moment où il protège encore**, pas après. La clé de secours du cabinet
    est demandée avant le premier paquet importé, pas rappelée en rouge une fois qu'il y en a
    soixante.
38. **Ce qu'un client ne contrôle pas ne lui est jamais facturé.** Un cabinet ne paie pas parce que
    son client a oublié de renouveler : douze mois de grâce, affichés sur le dossier.
39. **Tout CSS neuf s'écrit en propriétés logiques** (`padding-inline-start`, `text-align: end`).
    Coût nul aujourd'hui, chantier dans deux ans, et c'est ce qui garde la porte de l'arabe ouverte.
40. **Personne d'autre ne peut émettre une licence si Skander est absent** : la clé privée et le
    secret d'administration vivent en un seul endroit. Un pli scellé chez une personne de confiance
    est à poser avant les dix premiers clients — ce n'est pas un problème technique, c'est pour ça
    qu'on l'oublie.
41. **Les démarches passent avant le code quand elles bloquent la vente.** Marque, signature,
    INPDP, conditions de vente : aucune ligne de code neuve ne rapporte un dinar tant qu'elles ne
    sont pas faites.
42. **Un jalon est un chiffre, pas une impression.** Chaque trimestre pose une question dont la
    réponse est un nombre (démonstrations, essais, licences), et un nombre qui manque change l'ordre
    du travail : le trimestre suivant vend, il ne construit pas.
43. **Une tolérance de transition s'éteint d'elle-même.** Un dossier qui a reçu un paquet signé
    n'accepte plus jamais de paquet non signé — confiance au premier usage, sans date à décider.
44. **La grâce ne suit qu'une licence payée.** Un essai non converti compte dès sa fin ; sinon
    « avoir essayé » deviendrait moins cher que « ne jamais avoir essayé ».
45. **Un test de charge a ses seuils écrits avant la mesure**, sinon il ne peut pas échouer et ne
    prouve rien.
46. **Une règle sans acteur n'existe pas.** Le relecteur de chaque version est nommé (une autre
    session d'IA, avec sa limite assumée) ; les versions d'entretien sont numérotées dans le plan,
    pas promises « une sur quatre ».
47. **Ce qui ne vit que sur Cloudflare se sauvegarde chez Skander**, avant la première vente : un
    export de la base réclamé par « À faire » s'il a plus de trente jours.
48. **Un acte du cabinet ne dépend jamais de l'ordinateur d'un client.** Le cabinet clôture même si
    le client n'est pas à jour ; le fichier attend, et porte un PDF lisible par tous.
49. **Un secret de continuité se coupe en deux** : le fichier chez une personne, le mot de passe
    chez une autre, sur deux supports, rejoué une fois par an.

---

## 20. Ce qui reste à décider

**À Skander — les six qui bloquent la vente** *(ajoutées le 15/09/2026 ; aucune n'est du
développement, et aucune ligne de code neuve ne rapportera un dinar tant qu'elles ne sont pas
faites — voir § 9)*

0a. **Déposer la marque « SkanFact » à l'INNORPI.** Quelques centaines de dinars, et les trois
   relectures extérieures l'ont toutes mise en tête de leurs recommandations. C'est la seule qui ne
   dépend de personne d'autre, et celle dont le retard coûte le plus cher (renommer les deux
   applications, le site, le domaine, les mails, prévenir les clients).
0b. **Les certificats de signature de code**, requalifiés de « le jour où ça vend » à « avant la
   première vente » : un expert-comptable ne clique pas sur « Exécuter quand même » (§ 9).
0c. **La déclaration INPDP** pour la plateforme, et les **conditions de vente** relues par un
   juriste — les deux avant la première vente, pas après.
0d. **Poser la question à l'Ordre** (point 13), maintenant, parce que la réponse met des mois : elle
   ne bloque pas le développement, seulement la publication d'un prix.
0e. **La séance de validation fiscale avec le comptable**, qui débloque la 9.1.1 d'un coup (seuil de
   retenue, exonération de timbre, TFP par métier, e-facture).
0f. **Réparer le bouton de téléchargement du Cabinet** sur le site (il mène à un 404), et écrire la
   **page unique** du § 3 — celle qu'un prospect lira, contrairement à ce document.

**À Skander — le reste**
1. Le **prix de l'option Comptabilité** de l'app entreprise (proposition : 190 DT HT par an).
2. Le **nom** du produit cabinet : « SkanFact Cabinet », ou un nom qui dit « comptabilité ».
3. Les **prix** du Cabinet (72 DT par dossier hors SkanFact, 3 gratuits, paliers, palier illimité),
   après un regard sur les prix pratiqués en Tunisie.
4. Le **pilote** : ton comptable, avec un vrai dossier, dès la 9.1.0, sans payer pendant le pilotage.
5. Les **conditions de vente** (droit d'usage, rétractation, support, responsabilité,
   confidentialité), le **dépôt de la marque**, une **licence de code** explicite.
6. Le **transport des questions** au client (en clair par mail, ou chiffré avec une clé du client),
   avant la 9.9.0.
7. Les gestes qui n'attendent que toi : la clé Resend sur Cloudflare, le DNS du Mac, la clé de
   réponse à la mise en production, les certificats de signature le jour où ça vend, l'export
   régulier de la base de la plateforme.
8. L'entretien à l'échelle (§ 14) : qui reçoit les mails de support avec toi quand ils seront trop
   nombreux, quelle personne de confiance peut « marquer payée » en ton absence, et à partir de
   combien de clients on écrit une lettre d'information.
8 bis. L'outillage d'équipe (§ 15) : accepter que les retours et la dette vivent dans les Issues
   GitHub du dépôt, et **protéger la branche `main`** (Settings → Branches : tests obligatoires,
   pas de réécriture de l'historique) — deux réglages depuis le navigateur.

**Au comptable pilote** (le détail par version est au § 16)
9. Quel logiciel il veut remplacer, et sur quels trois écrans il jugera que c'est fait.
10. Son plan de comptes, ses journaux, sa façon de saisir, ses relevés, sa déclaration, ses états,
    sa révision, la liasse — chacun au moment où la version qui en dépend commence.
11. Ses réponses aux choix marqués « À VÉRIFIER » dans l'application (TVA en une écriture au dernier
    jour du mois, compte 13 pour le résultat, contreparties par défaut, TFP à 2 % ou 1 %, assiette
    de la retenue, avoir sans timbre), et ce qu'il fait d'un mois provisoire.
11 bis. Trois questions fiscales précises, venues de la relecture du 15/09/2026 : **le seuil en
    dessous duquel la retenue à la source ne s'applique pas** (de l'ordre de 1 000 DT ?) ; **le taux
    d'accident du travail** applicable aux activités de nos clients (l'application propose 0,4 %) ;
    et **les cas d'exonération du timbre fiscal** (exportateur total, secteur public).
12. Son accord pour travailler sur des versions bêta avec un vrai dossier, dans les conditions du
    § 13.

**À l'Ordre, au juriste, à l'administration (À VÉRIFIER)**
13. La gratuité conditionnelle du Cabinet est-elle une rémunération indirecte du cabinet ?
    **Ce que ça bloque, et ce que ça ne bloque pas.** La troisième relecture extérieure recommande de
    « ne construire **rien** du Cabinet avant la réponse de l'Ordre ». C'est excessif, et suivre ce
    conseil coûterait des mois pour rien : la question porte sur une **grille de prix**, pas sur le
    logiciel. Un grand livre, une balance, un rapprochement bancaire et une déclaration de TVA sont
    les mêmes que l'Ordre dise oui ou non ; seul change **qui paie quoi**, et le plan B est déjà
    écrit (§ 17 : le cabinet paie un forfait simple, la remise passe côté client). **Décidé : le
    développement du Cabinet ne s'arrête pas ; c'est la PUBLICATION D'UN PRIX et la première vente à
    un cabinet qui attendent la réponse.** Rien n'est écrit sur la page Tarifs du Cabinet d'ici là,
    et le pilote travaille gratuitement — ce qui est vrai dans les deux scénarios. La seule chose à
    faire tout de suite est de **poser la question**, parce que la réponse peut mettre des mois à
    venir et qu'elle ne viendra jamais si on ne la pose pas : l'Ordre d'abord, et un juriste
    spécialisé en déontologie comptable en parallèle, sans attendre l'un pour l'autre.
14. Ce qu'exige la loi tunisienne d'un logiciel de tenue (irréversibilité, conservation, restitution).
15. L'INPDP pour la plateforme (empreintes et contacts).
16. Le taux de TVA sur les licences logicielles, et le calendrier de l'e-facture.
17. Quelle solution de paiement en ligne accepte une SUARL, à quel coût, avec quel délai de
    versement.
18. Les limites exactes de l'offre gratuite de Cloudflare, le jour où l'on approche des milliers de
    postes.
