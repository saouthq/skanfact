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
- ***À VÉRIFIER*** *: un comptable, l'Ordre, un juriste ou le marché doit répondre avant que ce
  soit sûr.*

---

## Sommaire

1. [Le projet en dix questions](#1-le-projet-en-dix-questions)
2. [Les mots du projet](#2-les-mots-du-projet)
3. [Le but et le positionnement](#3-le-but-et-le-positionnement)
4. [L'application entreprise, SkanFact](#4-lapplication-entreprise-skanfact)
5. [L'application du comptable, SkanFact Cabinet](#5-lapplication-du-comptable-skanfact-cabinet)
6. [Le pont entre les deux](#6-le-pont-entre-les-deux)
7. [Le modèle économique](#7-le-modèle-économique)
8. [La licence et la plateforme](#8-la-licence-et-la-plateforme)
9. [Le quotidien : installer, vendre, dépanner](#9-le-quotidien--installer-vendre-dépanner)
10. [La technique du projet](#10-la-technique-du-projet)
11. [Les données, la sécurité, la loi](#11-les-données-la-sécurité-la-loi)
12. [La construction : comment on travaille](#12-la-construction--comment-on-travaille)
13. [Les versions à venir, une par une](#13-les-versions-à-venir-une-par-une)
14. [Les risques, et ce qui les couvre](#14-les-risques-et-ce-qui-les-couvre)
15. [Quand je suis perdu : où trouver quoi](#15-quand-je-suis-perdu--où-trouver-quoi)
16. [Les décisions à ne pas rediscuter](#16-les-décisions-à-ne-pas-rediscuter)
17. [Ce qui reste à décider](#17-ce-qui-reste-à-décider)

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
  comptabilité** : c'est le chantier qui commence (versions 9.1.0 à 10.0.0, § 13).
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
- **Timbre fiscal** : 1 dinar ajouté sur chaque facture (règle tunisienne).
- **Retenue à la source (RS)** : une partie du montant d'une facture que le client garde et verse
  directement à l'État à la place du fournisseur (0,5 %, 1 %, 1,5 %, jusqu'à 25 % selon la nature).
  Le fournisseur reçoit une **attestation de retenue** qui lui sert de justificatif.
- **Régime fiscal** : réel (on facture la TVA) ou forfaitaire (on ne la facture pas, avec une
  mention légale à la place). C'est le régime qui décide de la TVA, pas le métier.
- **CNSS** : la caisse de sécurité sociale. Part salarié 9,18 %, part employeur 16,57 % (À VÉRIFIER
  chaque année). **IRPP** : l'impôt sur le revenu, retenu sur le salaire par barème progressif.
  **TFP** et **FOPROLOS** : deux taxes patronales sur les salaires (2 % et 1 %, À VÉRIFIER).
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
- **Écritures d'inventaire** : celles de fin d'année qui ajustent la réalité : dotations aux
  amortissements, provisions (une perte probable), charges constatées d'avance (un loyer payé en
  décembre pour janvier), factures non parvenues (une charge de décembre facturée en janvier),
  produits constatés d'avance, factures à établir.
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

- **On répond à quelle demande ?** À deux demandes qui se rejoignent. Le chef d'une petite
  entreprise veut facturer correctement, savoir où est son argent, payer ses salariés et ses impôts,
  sans rien connaître à la comptabilité. Son comptable veut recevoir des pièces complètes, à
  l'heure, et ne plus ressaisir. **Décidé.**
- **En une phrase, c'est quoi SkanFact ?** Une PME gère et facture dans SkanFact sans rien savoir de
  la comptabilité ; son comptable reçoit chaque mois sa comptabilité déjà écrite avec les pièces, la
  vérifie, la complète et la dépose depuis SkanFact Cabinet, sans jamais ressaisir. **Décidé.**
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
- **Et en arabe ?** Les noms, adresses et libellés en arabe fonctionnent partout (identité, recherche,
  tri). Une interface en arabe est possible plus tard ; personne ne l'a demandée. **À toi, plus tard.**
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
  Mais l'application ne prétend pas faire la liasse fiscale à sa place : en Tunisie, une entreprise
  a un comptable, et l'application le dit.
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
- **L'e-facture (TTN / El Fatoora) ?** Le jour où elle devient obligatoire pour les clients de
  SkanFact, c'est l'app entreprise qui émettra, et le cabinet qui vérifiera. Rien avant.
  **À VÉRIFIER : le calendrier et le périmètre en Tunisie.**
- **Ce qui va encore changer côté entreprise ?** Peu de choses, et toutes au service du pont : le
  module Comptabilité masqué et l'option dans la clé (9.1.0) ; la licence et la mention d'essai dans
  le manifeste du paquet (9.2.0) ; la réception des questions du cabinet, affichées sur la pièce, et
  la signature du paquet (9.9.0). Le reste, c'est de l'entretien et les retours des utilisateurs.
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
  liasse, révision, collaborateurs. **Décidé, version par version (§ 13).**
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
- **Que se passe-t-il quand un client renvoie un mois déjà reçu ?** Si les écritures de ce mois ne
  sont pas encore validées dans le Cabinet, elles sont remplacées et l'application le dit. Si elles
  sont validées (mois déjà déclaré), le Cabinet montre l'écart ligne par ligne et le comptable
  décide : une écriture de régularisation, ou rien. Le paquet précédent est gardé (`-r2`), jamais
  écrasé.
- **Une écriture validée peut-elle être modifiée ?** Non, jamais. Elle se contre-passe. C'est la
  règle légale d'un logiciel de tenue. **Décidé.**
- **Une écriture venue d'un paquet peut-elle être modifiée dans le Cabinet ?** Non plus, même en
  brouillard : elle appartient au client. Le cabinet ajoute ses propres écritures à côté (OD,
  banque, inventaire), ou demande une correction. **Décidé.**
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
- **Qui clôture ?** Deux clôtures, deux sens. Le client clôture son **mois** (il verrouille sa
  saisie, le paquet devient définitif). Le cabinet clôture l'**exercice** dans son livre
  (irréversible, tracé).
- **Un mois provisoire, il en fait quoi ?** Il le voit marqué provisoire, peut le saisir en
  brouillard, et ne le valide pas avant le paquet définitif. Le comptable pilote dira s'il préfère
  attendre ou saisir puis corriger. **À VÉRIFIER avec lui.**

### Comment ça marchera, techniquement

- **Où vivront les livres ?** Un fichier par dossier (`dossiers/<client>/livre.json`), chiffré avec
  la même clé que le reste, à côté des paquets. Soixante dossiers sur dix ans ne tiennent pas dans un
  seul fichier relu à chaque enregistrement : c'est la décision de stockage à prendre avant la
  9.2.0, parce qu'elle ne se reprend pas. Les sauvegardes, la copie externe et la clé de secours
  emporteront ces fichiers ; l'index (`cabinet-data.json`) garde le portefeuille et les relances.
  **Décidé.**
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
- **Le moteur est-il refait ?** Non. Les fonctions qui calculent le journal, le grand livre, la
  balance, le lettrage, les états existent dans l'app entreprise. Elles sortent dans un fichier
  partagé (`src/renderer/compta.js`) que les deux applications chargent ; l'app entreprise continue
  de les appeler comme avant. Un test vérifie que le Cabinet, nourri des douze paquets de l'exemple,
  donne **la même balance au millime** que l'app entreprise. **Décidé, 9.1.0.**
- **Ce que le moteur ne sait pas encore faire ?** Le brouillard et la validation, la
  contre-passation, l'extourne, les guides d'écritures et les abonnements, l'import de relevé
  bancaire et le rapprochement automatique, le lettrage manuel, la balance âgée, les provisions et
  régularisations, la clôture d'exercice définitive, l'amortissement dégressif, la liasse. C'est le
  contenu des versions 9.3.0 à 10.0.0 (§ 13).
- **La numérotation des écritures ?** Continue par journal et par exercice, sans trou, attribuée
  **à la validation** (une écriture en brouillard n'a pas de numéro définitif). Un numéro n'est
  jamais réutilisé. **Décidé.**
- **Le plan de comptes ?** Chaque dossier a le sien, initialisé depuis le plan de référence du
  cabinet (le SCE complet, modifiable). Les comptes venus d'un paquet SkanFact sont ceux du client ;
  une table de correspondance du cabinet les traduit dans ses numéros si besoin (9.3.0). **À
  construire.**

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
  questions envoyé par mail au début, le serveur un jour. **Décidé dans le principe ; le transport
  exact reste à choisir avant la 9.9.0** (À toi, le moment venu : le client n'a pas de clé de
  chiffrement aujourd'hui, donc soit il en génère une à l'appairage, soit les questions partent en
  clair — recommandation : en clair, une question n'est pas une pièce).
- **Comment le cabinet sait que le paquet vient bien de ce client ?** Aujourd'hui : il est chiffré
  pour lui et porte le matricule. Demain : signé par le client, dont la clé est épinglée au dossier
  (9.9.0). **Décidé.**
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
  et la mention d'essai (9.2.0) ; la **signature** du client (9.9.0). Le numéro de format monte, les
  paquets anciens restent lisibles.

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
- **Un très gros cabinet (200 dossiers) ?** Un palier « illimité » à prix plafonné. **À toi.**
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
  mois et porte une licence valide (ou un essai de moins de 30 jours). Une licence expirée depuis
  plus de 60 jours fait retomber le dossier en « hors SkanFact », et le cabinet le voit venir 30
  jours avant : c'est lui qui rappelle son client, l'intérêt est le sien. **Décidé.**
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

### L'argent

- **Le cabinet gagne quoi à amener un client ?** 72 DT de moins par an sur sa facture, et un client
  qui lui envoie des pièces propres. Jamais d'argent versé au cabinet. **Décidé.**
- **Est-ce que l'Ordre l'accepte ?** Notre lecture : oui, aucun argent ne circule vers le cabinet,
  il paie simplement moins un outil qu'il aurait payé de toute façon. **À VÉRIFIER avant de publier
  la page Tarifs.**
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
  le nom, l'offre (Indépendant ou Entreprise), la date de fin (ou « à vie »), la date d'émission,
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
  SkanFact. Vérifiée hors ligne. **Décidé, à construire après la saisie (§ 13).**
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
  automatique n'existe. À prévoir : un export régulier de la base (un bouton dans la console ou une
  tâche planifiée), parce que c'est la seule donnée du projet qui n'est pas sur un poste de Skander.
  **À construire (avec la licence du Cabinet).**

---

## 9. Le quotidien : installer, vendre, dépanner

### Installer et démarrer

- **Comment un client installe SkanFact ?** Il télécharge l'installateur depuis le site (ou la page
  Releases) : `.dmg` sur Mac, `.exe` sur Windows. Au premier lancement, le système prévient que
  l'application n'est pas signée (Mac : clic droit → Ouvrir ; Windows : « Informations
  complémentaires → Exécuter quand même »). Puis l'assistant pose ses questions : métier, régime
  fiscal, société, modules. Dix minutes. **Livré.**
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
- **Le code est public : quelqu'un peut-il le copier et le vendre ?** Il n'y a pas de licence
  d'utilisation du code écrite (le dépôt dit « UNLICENSED », c'est-à-dire tous droits réservés).
  Copier le code serait illégal, mais rien ne l'empêche techniquement. La vraie protection est
  ailleurs : la clé, le service, les mises à jour, le pont. **À toi : ajouter une licence de code
  explicite si tu veux clarifier (À VÉRIFIER avec un juriste).**

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
- **Dans quel ordre ensuite ?** Le § 13 détaille chaque version. En résumé : 9.2.0 le livre par
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
- **Et la bêta ?** Le canal bêta existe pour l'app entreprise ; le pilote pourra recevoir les
  versions du Cabinet en avance. À adapter : aujourd'hui une bêta ne construit pas le Cabinet.

---

## 13. Les versions à venir, une par une

*Pour chaque version : ce qu'elle contient, ce qu'elle exclut, ce dont elle dépend, comment on la
prouve. Les deux applications sortent ensemble sous le même numéro. Les durées sont des ordres de
grandeur de construction, hors attente des réponses.*

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
- **Exclu.** Aucune saisie, aucun livre propre au dossier, aucune modification des paquets.
- **Preuve.** Test de parité (même balance au millime) ; e2e `cabinet-livres` (les quatre onglets
  sur un vrai paquet, le mois manquant annoncé) ; e2e `boucle` relancé ; test « module désactivé
  par défaut » et `e2e:entreprise` relu ; test « `optionBlock` n'est posé que sur l'entrée du
  module ».

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
- **Dépend de.** Le plan de comptes du comptable, son logiciel actuel (pour le format de la balance
  d'ouverture).
- **Exclu.** La saisie à la main (sauf la balance d'ouverture), la banque.
- **Preuve.** Parité maintenue ; e2e : reprise d'un dossier par balance, import de douze paquets,
  mois renvoyé ; e2e `refus` avec un paquet au nouveau format sur un Cabinet ancien.

### 9.3.0 — La saisie (deux semaines)

- **Cabinet.** L'écran de saisie au kilomètre, tout au clavier : journal, date, pièce, lignes
  compte/tiers/libellé/débit/crédit ; recherche de compte par numéro ou nom pendant la frappe ;
  raccourcis (recopier la ligne, solder, dupliquer) ; contrôle d'équilibre ; pièce jointe glissée.
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
  grâce de 60 jours, l'expiration client vue 30 jours avant). La porte unique sur la validation.
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

### 9.4.0 — La banque (deux semaines)

- **Cabinet.** Import du relevé bancaire (CSV des banques tunisiennes, OFX, MT940 — les formats
  que le comptable rencontre), rapprochement automatique (montant, date à ± n jours, libellé),
  proposition d'écriture pour chaque ligne non rapprochée (guide selon le libellé), suspens, état
  de rapprochement, lettrage automatique des tiers (montant, référence), lettrage et délettrage à
  la main, échéancier, balance âgée clients et fournisseurs.
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

### 9.6.0 — La clôture d'exercice (deux à trois semaines)

- **Cabinet.** Écritures d'inventaire guidées (dotations, provisions, CCA, FNP, PCA, FAE,
  régularisations) avec extourne automatique ; contrôles de clôture (comptes d'attente, brouillard
  restant, TVA non déclarée, balance des tiers) ; clôture d'exercice définitive, tracée ; à-nouveaux
  générés ; exercice suivant ouvert pendant que le précédent se termine ; états financiers au
  format SCE (bilan, état de résultat, flux de trésorerie, notes), comparatif N/N-1, SIG, ratios ;
  impression et PDF.
- **Dépend de.** La présentation exacte des états (NCT 01) et des notes.
- **Preuve.** Test : actif = passif, résultat identique des deux côtés, à-nouveau égal aux soldes
  du 31/12 ; e2e : une clôture refusée puis acceptée, la réouverture impossible.

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

### 9.9.0 — La révision et les questions (deux semaines)

- **Cabinet.** Dossier de révision par exercice (feuilles maîtresses par cycle, comptes revus et
  signés, points en suspens, notes de revue, questionnaire de fin d'exercice) ; **questions au
  client** envoyées depuis la ligne (pièce absente, 471 non soldé, facture ouverte, mois provisoire)
  ; signature du paquet par le client et épinglage de sa clé.
- **Entreprise.** Réception des questions, affichage sur la pièce, réponse, pièce jointe, mois
  révisé renvoyé ; signature du paquet.
- **Dépend de.** La méthode de révision du comptable ; le choix du transport des questions.
- **Preuve.** e2e `boucle` étendu : une question part, arrive sur la pièce, la réponse revient dans
  un mois révisé, le paquet signé est accepté et un paquet non signé d'un client épinglé est
  signalé.

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

## 14. Les risques, et ce qui les couvre

- **Le comptable ne joue pas le jeu du pilote.** On reste sur le pont amélioré (les livres lus dans
  les paquets, 9.1.0) et on ne construit pas la tenue complète sans cabinet. Un logiciel « au
  niveau des meilleurs » construit sans personne qui l'utilise tous les jours serait un beau
  logiciel que personne n'ouvre. **Décidé.**
- **On s'éparpille.** Une version à la fois, finie, testée, publiée, utilisée avant la suivante.
  Ce qui n'est pas décrit dans le § 13 n'entre pas dans la version. **Décidé.**
- **La loi de finances change les taux.** Aucun taux n'est écrit en dur, tout est paramétrable, et
  l'application porte « À VÉRIFIER » partout où un chiffre relève du comptable. **Décidé.**
- **Sage sort la même chose.** Notre différence est de structure, pas de fonctions : le pont avec le
  client, le hors-ligne, pas de sièges, le prix.
- **Skander est seul.** Le dépôt porte les plans, les règles apprises et les tests : un développeur
  qui arrive peut reprendre. Et la clé maître est sauvegardée.
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
- **Un cabinet reçoit un paquet frauduleux.** Chiffré pour lui, empreintes vérifiées, fichiers non
  annoncés signalés, et demain signé par le client.

---

## 15. Quand je suis perdu : où trouver quoi

### Les documents

| Je cherche… | Le document |
|---|---|
| Les décisions, le modèle économique, l'ordre des versions | `DIRECTION.md` |
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

## 16. Les décisions à ne pas rediscuter

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

---

## 17. Ce qui reste à décider

**À Skander**
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

**Au comptable pilote** (le détail par version est au § 13)
8. Quel logiciel il veut remplacer, et sur quels trois écrans il jugera que c'est fait.
9. Son plan de comptes, ses journaux, sa façon de saisir, ses relevés, sa déclaration, ses états, sa
   révision, la liasse — chacun au moment où la version qui en dépend commence.
10. Ses réponses aux choix marqués « À VÉRIFIER » dans l'application (TVA en une écriture au dernier
    jour du mois, compte 13 pour le résultat, contreparties par défaut, TFP à 2 % ou 1 %, assiette
    de la retenue, avoir sans timbre), et ce qu'il fait d'un mois provisoire.

**À l'Ordre, au juriste, à l'administration (À VÉRIFIER)**
11. La gratuité conditionnelle du Cabinet est-elle une rémunération indirecte du cabinet ?
12. Ce qu'exige la loi tunisienne d'un logiciel de tenue (irréversibilité, conservation, restitution).
13. L'INPDP pour la plateforme (empreintes et contacts).
14. Le taux de TVA sur les licences logicielles, et le calendrier de l'e-facture.
15. Quelle solution de paiement en ligne accepte une SUARL, à quel coût, avec quel délai de
    versement.
