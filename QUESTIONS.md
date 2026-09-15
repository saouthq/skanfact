# SkanFact — Toutes les questions du projet, et leurs réponses

*Écrit le 15/09/2026 pour Skander, en complément de `DIRECTION.md`. Chaque question qu'on s'est posée
ou qu'on va se poser, avec la réponse et le pourquoi. Trois marques : **Décidé** (on ne rediscute
pas), **À toi** (une décision de Skander, avec ma recommandation), **À VÉRIFIER** (un comptable,
l'Ordre, un juriste ou le marché doit répondre).*

---

## 1. Le but

- **On répond à quelle demande ?** À deux demandes qui se rejoignent. Le chef d'une petite entreprise
  tunisienne veut facturer correctement, savoir où est son argent, payer ses salariés et ses impôts,
  sans rien connaître à la comptabilité. Son comptable veut recevoir des pièces complètes, à l'heure,
  et ne plus ressaisir. **Décidé.**
- **En une phrase, c'est quoi SkanFact ?** Une PME gère et facture dans SkanFact sans rien savoir de
  la comptabilité ; son comptable reçoit chaque mois sa comptabilité déjà écrite avec les pièces, la
  vérifie, la complète et la dépose depuis SkanFact Cabinet, sans jamais ressaisir. **Décidé.**
- **Comment on saura qu'on a réussi ?** Zéro ressaisie entre les deux ; le comptable pilote ouvre le
  Cabinet tous les jours sur un vrai dossier ; puis un nombre de cabinets et de dossiers qui grandit.
- **Pourquoi deux applications et pas une ?** Deux métiers, deux façons de travailler. Une seule
  application serait trop compliquée pour le chef d'entreprise et trop pauvre pour le comptable. Elles
  partagent le même dépôt, le même moteur, les mêmes règles. **Décidé.**
- **Qu'est-ce qui n'existe nulle part ailleurs ?** Un logiciel de cabinet où les écritures des clients
  arrivent déjà écrites, avec leurs pièces, vérifiées, hors ligne, et où une question posée sur une
  ligne arrive chez le client en face de sa pièce. Les concurrents ont soit la comptabilité (Sage,
  EBP), soit la collaboration (Pennylane, en ligne, payant par utilisateur), jamais les deux hors ligne.
- **Qui sont les concurrents ?** Côté cabinet : Sage 100, EBP, Ciel, des éditeurs tunisiens
  (À VÉRIFIER lesquels). Côté PME : Excel et Word d'abord, puis des logiciels de facturation locaux.
  Modèles à regarder : Pennylane, Odoo.
- **On vise au-delà de la Tunisie ?** Non. La fiscalité tunisienne est au cœur (paramétrable, jamais
  en dur), l'interface est en français, les documents existent en anglais. Un autre pays, c'est un
  autre produit. **Décidé, pas avant d'avoir des cabinets tunisiens.**
- **Et en arabe ?** Les noms, adresses et libellés en arabe fonctionnent partout (identité, recherche,
  tri). Une interface en arabe est possible plus tard ; personne ne l'a demandée. **À toi, plus tard.**
- **Les deux applications restent hors ligne ?** Oui, pour toujours. Un cabinet ou une entreprise
  doit pouvoir travailler sans réseau, et survivre à la disparition de l'éditeur. Le serveur ne fait
  et ne fera que la licence et, un jour, le transport. **Décidé.**

## 2. L'application entreprise (SkanFact)

- **Elle fait quoi ?** La gestion : devis, factures, avoirs, bons, contrats récurrents, clients,
  catalogue, achats et fournisseurs, trésorerie, stock et numéros de série, immobilisations, paie,
  congés, déclarations sociales, clôture mensuelle, paquet au comptable. **Décidé : elle s'arrête là.**
- **Le chef d'entreprise doit-il connaître la comptabilité ?** Non. Aucun numéro de compte ne lui est
  jamais demandé ; les écritures se déduisent de ses pièces. **Décidé.**
- **Que deviennent le grand livre, la balance, les états financiers qu'on y a mis (8.8.0 → 9.0.0) ?**
  Le moteur reste : c'est lui qui écrit les écritures du paquet. Les écrans deviennent un module
  « Comptabilité » désactivé par défaut **et payant** : l'option pour la petite entreprise sans
  comptable qui tient elle-même ses livres. Elle voyage dans la clé de licence, se vend depuis la
  console, est incluse dans l'essai, et ne touche jamais à Écritures ni au paquet. **Décidé le
  15/09/2026.** Son prix reste **à toi** (proposition : 190 DT HT/an).
- **L'onglet Écritures reste visible ?** Oui : c'est le seul endroit où le client voit ce qui part
  chez son comptable, et où il comprendra une question reçue. **Décidé.**
- **Et l'onglet TVA à payer, si c'est le comptable qui déclare ?** Il reste : c'est une estimation pour
  la trésorerie du client. La déclaration officielle est celle du cabinet, et l'écran le dira.
- **Une entreprise sans comptable ?** Elle active le module Comptabilité et voit ses livres. Mais
  l'application ne prétend pas faire la liasse à sa place : une PME tunisienne a un comptable.
- **Une entreprise dont le comptable n'a pas SkanFact Cabinet ?** Elle envoie quand même son paquet :
  c'est un ZIP ordinaire, avec des CSV lisibles dans Excel et les PDF. Le comptable peut l'importer
  dans son logiciel. Et le paquet lui dit que le Cabinet est gratuit pour ce dossier : c'est le levier
  pour qu'il l'installe.
- **Combien ça coûte ?** Essai 30 jours ; Indépendant 390 DT HT/an ; Entreprise 690 DT HT/an ;
  −20 % la première année si un cabinet équipé parraine. **Décidé (site Tarifs).**
- **Combien de postes ?** Illimités pour un même matricule : un dossier partagé emporte sa clé.
  On ne vend pas des sièges. **Décidé.**
- **Que se passe-t-il à la fin de la licence ?** Lire, imprimer, exporter, sauvegarder, envoyer le
  paquet au comptable : toujours. Créer une nouvelle pièce : bloqué. Jamais de données en otage.
  **Décidé depuis la 6.4.0.**
- **Les mises à jour ?** Automatiques par le relais Cloudflare, vérifiées toutes les quatre heures.
  Une licence expirée reçoit quand même les corrections. **Décidé.**
- **Plusieurs entreprises sur un poste (ton père, ta famille) ?** Oui : dossiers, sélecteur en haut du
  menu, partage à deux avec fusion. **Livré.**
- **Une application sur téléphone ?** Pas maintenant. C'est la seule raison pour laquelle la lecture
  de photo est en pause. **À toi, plus tard.**
- **L'e-facture (TTN / El Fatoora) ?** Le jour où elle devient obligatoire pour les clients de
  SkanFact, c'est l'app entreprise qui émet. **À VÉRIFIER : le calendrier et le périmètre.**
- **La lecture de photo de facture ?** En pause, code conservé. Reprendra avec une app mobile.

## 3. L'application cabinet (SkanFact Cabinet)

- **Elle fait quoi ?** La tenue complète : plan de comptes, saisie, brouillard et validation, banque
  et rapprochement, lettrage, TVA et déclarations mensuelles, immobilisations, inventaire, clôture
  d'exercice, états financiers, liasse, révision, portefeuille, relances, collaborateurs. **Décidé,
  version par version (`PLAN-COMPTABLE.md`).**
- **Le comptable doit-il avoir ses clients sur SkanFact ?** Non. Un dossier hors SkanFact est un
  dossier ordinaire : tout arrive par la saisie, le relevé bancaire, l'import d'un autre logiciel.
  **Décidé.**
- **Peut-il modifier les données du client ?** Jamais. Il tient SON livre. S'il veut une correction
  chez le client, il pose une question ; le client corrige et renvoie un mois révisé. **Décidé.**
- **Qui a raison si le livre du cabinet et le SkanFact du client diffèrent ?** Le livre du cabinet est
  la comptabilité officielle (c'est elle qui est déclarée). L'écart reste visible des deux côtés
  jusqu'à ce que le client renvoie un mois révisé.
- **Que se passe-t-il quand un client renvoie un mois déjà reçu ?** Si les écritures de ce mois ne
  sont pas encore validées, elles sont remplacées. Si elles sont validées (mois déjà déclaré), le
  Cabinet montre l'écart et le comptable décide : OD de régularisation, ou rien. Le mécanisme
  « mois reçu deux fois » existe déjà (`-r2`).
- **Une écriture validée peut-elle être modifiée ?** Non. Elle se contre-passe. C'est la règle légale
  d'un logiciel de tenue et la première chose qu'un comptable vérifie. **Décidé.**
- **Combien de dossiers, d'exercices ?** Sans limite technique : un fichier par dossier, plusieurs
  exercices ouverts.
- **Plusieurs collaborateurs, plusieurs postes ?** Oui (9.8.0) : droits par dossier (saisie,
  validation, supervision), deux postes sur le même cabinet sans s'écraser, piste d'audit. Postes
  illimités. **Décidé.**
- **Il remplace Sage ?** C'est l'objectif, atteint version par version. Jusqu'à la clôture d'exercice
  (9.6.0) le cabinet pourra continuer d'exporter vers son logiciel pour ce qui manque.
- **Comment il reprend ses soixante dossiers existants ?** Par balance d'ouverture importée (CSV ou
  Excel de son logiciel actuel) et plan de comptes importé (9.2.0). C'est le geste qui décide s'il
  vient ou pas.
- **Il tient la paie de ses clients dans le Cabinet ?** Pas pour l'instant. Le moteur de paie existe
  côté entreprise et se partagera le jour où un cabinet le demande. Les bulletins d'un client SkanFact
  arrivent déjà en écritures dans le paquet.
- **Il facture ses honoraires dans le Cabinet ?** Non. Le Cabinet ne devient pas un second logiciel de
  facturation ; le cabinet est une entreprise, il a SkanFact entreprise pour ça.
- **Il télédéclare depuis le Cabinet ?** Non : il prépare la déclaration (chiffres, fichier), il
  dépose lui-même sur le portail. Une application qui déposerait à sa place se tromperait un jour sans
  qu'il le sache. **Décidé. À VÉRIFIER : ce que le portail accepte comme fichier.**
- **Que se passe-t-il s'il arrête SkanFact Cabinet ?** Export complet de chaque dossier, en ZIP
  ordinaire (CSV, PDF), lisible sans SkanFact. Jamais de données en otage. **Décidé.**
- **Un client qui a lui-même Sage ?** Dossier hors SkanFact : ses écritures s'importent en CSV.
- **Le comptable peut-il ouvrir directement le SkanFact du client (dossier partagé) ?** Techniquement
  oui, aujourd'hui déjà. Mais ce n'est pas la voie : deux personnes qui écrivent dans le même livre,
  c'est la leçon de la 3.2.0. Le pont reste le paquet.
- **Le client voit-il ce que le cabinet a fait (bilan, déclarations) ?** Le cabinet lui envoie ses
  états en PDF, comme aujourd'hui par mail. Un retour par le pont viendra avec les questions (9.9.0).
- **Qui clôture ?** Deux clôtures, deux sens. Le client clôture son mois (verrouille sa saisie : le
  paquet devient définitif). Le cabinet clôture l'exercice dans son livre (irréversible).

## 4. Le pont entre les deux

- **Comment les données circulent ?** Par le paquet mensuel `.skanpack`, chiffré pour le cabinet, envoyé
  par n'importe quel moyen : mail, WhatsApp, Drive, clé USB. Pas de serveur. **Décidé.**
- **Pourquoi pas un serveur tout de suite ?** Coût mensuel, données hébergées, déclaration INPDP,
  surface à surveiller la nuit. Le fichier fait le même travail. Le serveur viendra comme simple
  transport quand un cabinet dira qu'il en veut un. **Décidé.**
- **Le client peut-il envoyer un mois non clôturé ?** Oui, il est marqué provisoire ; le cabinet le
  voit et ne déclare pas dessus.
- **Et dans l'autre sens ?** Les questions du cabinet (pièce absente, compte d'attente, facture
  ouverte) partent vers le client, qui les voit sur la pièce concernée, répond, joint ce qui manque, et
  renvoie un mois révisé (9.9.0). Le transport : un fichier ou un mail au début, le serveur un jour.
  **Décidé dans le principe ; le transport reste à choisir avant la 9.9.0.**
- **Comment le cabinet sait que le paquet vient bien de ce client ?** Aujourd'hui : il est chiffré
  pour lui et porte le matricule. Demain : signé par le client (C1), la clé du client épinglée au
  dossier. **Décidé, 9.9.0.**
- **Comment le client sait que le cabinet est le bon ?** L'empreinte du cabinet, vingt caractères,
  dictée au téléphone à l'appairage. **Livré.**
- **Si le client change de cabinet ?** Il importe le fichier d'appairage du nouveau ; ses paquets
  suivants partent au nouveau. L'ancien garde ce qu'il a reçu (c'est son travail à lui). Les données
  restent chez le client.
- **Un client suivi par deux cabinets ?** Un seul appairage à la fois. Un paquet protégé par mot de
  passe peut être envoyé à un autre destinataire.

## 5. Le modèle économique

- **Qui paie quoi ?** L'entreprise paie sa licence. Le cabinet paie ses dossiers hors SkanFact au-delà
  de trois. **Décidé.**
- **Pourquoi le cabinet ne paie pas pour ses clients SkanFact ?** Ils ont déjà payé, et c'est
  l'incitation : chaque client amené sur SkanFact fait baisser sa facture. **Décidé.**
- **Pourquoi trois dossiers gratuits ?** Pour essayer sur ses vrais dossiers sans rien signer, et pour
  qu'un petit cabinet avec trois clients hors SkanFact ne paie rien. **Décidé.**
- **Combien par dossier ?** Proposition : 72 DT HT par dossier et par an (6 DT/mois), dégressif
  (60 DT au-delà de 20, 48 DT au-delà de 50). **À toi, après avoir regardé les prix pratiqués en
  Tunisie (À VÉRIFIER).**
- **Un très gros cabinet (200 dossiers) ?** Un palier « illimité » à prix plafonné. **À toi.**
- **Pourquoi par dossier et pas par poste ou par utilisateur ?** Parce qu'un cabinet grandit par
  dossiers, pas par sièges ; et parce que les concurrents vendent des sièges — c'est un argument de
  vente immédiat. **Décidé.**
- **Comment on compte un dossier ?** Actif (non archivé), au moins une écriture validée dans les
  douze derniers mois, sans licence client. Un dossier archivé ne compte jamais. **Décidé.**
- **Qu'est-ce qu'un dossier « sur SkanFact » ?** Un dossier dont le dernier paquet a moins de treize
  mois et porte une licence valide (ou un essai de moins de 30 jours). Une licence expirée depuis plus
  de 60 jours fait retomber le dossier en « hors SkanFact », et le cabinet le voit venir 30 jours
  avant. **Décidé.**
- **Que se passe-t-il si le cabinet dépasse son quota ?** Bandeau, ligne « À faire », puis la
  validation de nouvelles écritures est bloquée sur les dossiers au-delà du quota — le cabinet choisit
  lesquels. Lire, exporter, imprimer, déclarer ce qui est validé : toujours. **Décidé.**
- **Le cabinet gagne quoi à amener un client ?** 72 DT de moins par an, et un client qui envoie des
  pièces propres. Jamais d'argent versé au cabinet. **Décidé.**
- **Est-ce que l'Ordre l'accepte ?** Notre lecture : oui, aucun argent ne circule vers le cabinet, il
  paie simplement moins un outil. **À VÉRIFIER avant de publier la page Tarifs.**
- **Le pilote paie ?** Non pendant le pilotage : quota gratuit sur ses dossiers de test. **À toi.**
- **Comment on encaisse ?** Virement ou carte, hors application. Tu marques « payée » dans la
  console, la clé part par mail dans la seconde. Le paiement en ligne (Konnect, Paymee, Flouci,
  ClicToPay — À VÉRIFIER) branchera le même bouton plus tard. **Décidé.**
- **Qui émet la facture de licence ?** Toi, depuis SkanFact entreprise (module Éditeur) ou la
  console : c'est une facture comme une autre dans ta comptabilité. **Livré (8.7.0).**
- **Remboursement, rétractation ?** Avoir sur la facture et révocation de la licence. Limite dite en
  clair : une clé livrée continue chez le client jusqu'à sa date, sauf si sa version embarque la clé
  de réponse. **Livré (8.2.0, 8.4.0).**
- **Renouvellement ?** Réclamé 30 jours avant, prorata pour une montée d'offre ou de quota, remise de
  parrainage limitée à la première année. **Livré.**
- **La TVA sur les licences ?** Celle de ton régime, posée par l'app. **À VÉRIFIER : le taux applicable
  aux licences logicielles.**
- **Ça peut rapporter combien ?** Ordre de grandeur pour un cabinet de 60 dossiers dont 10 sur
  SkanFact : 6 900 DT/an payés par les entreprises, 3 384 DT/an payés par le cabinet. Dix cabinets
  comme celui-là : cent mille dinars par an. Un chiffre à vérifier avec le premier cabinet réel.
- **Ça coûte combien à faire tourner ?** Presque rien : Cloudflare (relais, API, base) gratuit à ce
  volume, le domaine et la boîte mail chez OVH, Resend gratuit à petit volume, GitHub Actions gratuit
  tant que le dépôt est public. Aucune donnée hébergée.
- **Le site vend-il ?** Il présente et donne le contact. La vente se fait par mail et console : un
  clic, pas zéro. L'inscription en autonomie viendra après les premières ventes. **Décidé.**

## 6. La licence et la plateforme

- **Comment marche la licence entreprise ?** Une clé signée (Ed25519) portant le matricule, l'offre,
  la date de fin, vérifiée sur le poste avec la clé publique embarquée. Aucun serveur nécessaire.
  **Livré.**
- **Et la licence du Cabinet ?** Le même mécanisme : le sujet est l'empreinte de la clé du cabinet (qui
  existe déjà), la charge porte `type: cabinet` et le quota de dossiers hors SkanFact. Vérifiée hors
  ligne. **Décidé, après la saisie (étape 4 de `DIRECTION.md`).**
- **Où sont les clés privées ?** La clé maître sur ton Mac (`~/.skanfact/`), jamais vue par aucune
  session ; la clé serveur `srv-1` dans un réglage Cloudflare ; la clé de réponse est brûlée et sera
  recréée le jour de la mise en production. **Décidé.**
- **Si la clé maître est perdue ?** Plus aucune licence ne peut être signée par elle ; il faudrait une
  nouvelle clé et réémettre. Tu en as une copie à l'abri : c'est la chose la plus précieuse du projet.
- **Si elle est compromise ?** On la marque retirée (jamais supprimée), on signe avec une autre, on
  réémet les licences concernées. Les clés multiples existent pour ça (8.4.0).
- **Le piratage ?** Le code est ouvert ; le secret est la clé, pas le code. On ne combat pas le pirate
  individuel : la valeur est dans les mises à jour, le support et le pont avec le cabinet. **Décidé.**
- **L'essai de 30 jours se contourne ?** En reculant l'horloge ou en réinstallant sans ses données,
  oui. Accepté : ce n'est pas un client. **Décidé.**
- **Que remonte au serveur ?** L'empreinte de la licence, l'identifiant du poste, son nom, la
  plateforme, la version. Jamais un client, une facture, un montant, un nom de dossier. Un test compte
  les champs. **Décidé.**
- **La console sert à quoi ?** Voir les licences, vendre, révoquer, renouveler, marquer payée, envoyer
  la clé, et demain gérer les cabinets et leurs quotas. SkanFact tire les ventes pour les facturer.
  **Livré (P 0.2, 8.7.0).**
- **La révocation s'applique quand ?** À la prochaine connexion de l'application, et seulement si sa
  version embarque la clé de réponse. Dit en clair dans la console. **Livré.**
- **Le dépôt public, c'est un risque ?** Non pour le secret (la clé). Il est public pour que les
  publications soient gratuites ; il peut redevenir privé en une ligne. **Décidé.**

## 7. Les données, la sécurité, la loi

- **Où sont les données ?** Sur le poste de l'utilisateur, dans un fichier JSON, chiffrable côté
  entreprise, chiffré obligatoirement côté cabinet. Rien chez nous. **Décidé.**
- **Les sauvegardes ?** Quotidiennes (30 jours), nommées avant chaque geste risqué, copie externe
  (iCloud, USB), et pour le cabinet une clé de secours exportable. **Livré.**
- **Si le poste est perdu ?** Restauration depuis la copie externe. Pour le cabinet, sans clé de
  secours, les paquets déjà reçus sont illisibles pour toujours : l'écran le dit en rouge tant qu'elle
  n'est pas enregistrée. **Livré.**
- **Quel chiffrement ?** AES-256-GCM avec scrypt pour les fichiers, X25519 pour les paquets au
  cabinet, Ed25519 pour les licences. Rien de maison. **Décidé.**
- **L'INPDP ?** Les applications tournent sur le poste : le responsable du traitement est
  l'utilisateur. La plateforme, elle, détient des empreintes et des contacts : à déclarer.
  **À VÉRIFIER avant la première vente.**
- **Ce que la loi exige d'un logiciel de tenue ?** Écritures validées irréversibles, numérotation
  continue, conservation dix ans, restitution des livres. Le Cabinet le fera (9.3.0, export complet).
  **À VÉRIFIER : le texte tunisien exact.**
- **La signature Apple et Windows ?** Pas encore (certificats payants) : un avertissement au premier
  lancement, et une procédure décrite. **À toi, le jour où ça vend.**
- **Une mise à jour peut-elle casser des données ?** Chaque version migre les données et prend une
  sauvegarde avant. Les paquets anciens restent lisibles pour toujours. **Décidé.**
- **Le support ?** « Signaler un problème » joint le journal technique ; « Proposer une amélioration »
  ne joint rien ; les deux écrivent à contact@skanfact.tn. **Livré.**
- **Le gel de l'application ?** Un chien de garde dans les deux applications recharge et nomme la
  fonction coupable dans le journal. **Livré.**

## 8. La construction

- **Par quoi on commence ?** La 9.1.0 : les livres lus dans les paquets, le moteur partagé, le test de
  parité. Elle n'attend personne et c'est ce qu'il faut montrer au comptable pour obtenir le reste.
  **Décidé.**
- **Dans quel ordre ensuite ?** 9.2.0 le livre par dossier → 9.3.0 la saisie → la licence du Cabinet
  → 9.4.0 la banque → 9.5.0 le fiscal mensuel → 9.6.0 la clôture et les états → 9.7.0 immobilisations
  et stocks → 9.8.0 collaborateurs → 9.9.0 révision et questions → 10.0.0 liasse et exemple complet.
  **Décidé (`DIRECTION.md` § 7).**
- **Combien de temps ?** Plusieurs mois de construction ; la vraie horloge, ce sont les réponses du
  comptable. Chaque version est finie, testée, publiée et utilisée avant la suivante.
- **Qu'est-ce qui exige le comptable ?** Son plan de comptes et son logiciel actuel (9.2.0), le
  regarder saisir (9.3.0), les relevés de ses clients (9.4.0), le modèle de déclaration (9.5.0), la
  présentation des états (9.6.0), sa méthode de révision (9.9.0), la liasse (10.0.0). Et un vrai
  dossier dès la 9.1.0.
- **Qu'est-ce qui exige Skander ?** Masquer ou supprimer les écrans comptables ; le nom du produit
  cabinet ; les prix ; l'Ordre ; l'INPDP ; RESEND_API_KEY sur Cloudflare ; le DNS de ton Mac ; la clé
  de réponse à la mise en production ; les certificats de signature ; regarder chaque version.
- **Comment on évite de construire deux fois la même chose ?** Le moteur d'écritures sort de `core.js`
  dans un module partagé, et un test exige que la balance calculée par le Cabinet soit celle de l'app
  entreprise au millime. **Décidé.**
- **Comment on sait que c'est juste ?** Les tests de calcul (384 aujourd'hui), les parcours dans
  l'application réelle, le test de parité, et le comptable pilote sur son bureau. Aucun chiffre
  affirmé qu'un test ne prouve. **Décidé.**
- **Comment on publie ?** Les deux applications dans la même release, même numéro, un lot de versions
  par publication (le quota Actions se consomme vite). **Décidé.**
- **Et la bêta ?** Le canal bêta existe ; le pilote pourra recevoir les versions du Cabinet en bêta
  avant les autres. À adapter : une bêta ne construit pas le Cabinet aujourd'hui.
- **Le quota Claude ?** Pas d'agents, une version à la fois, les corrections regroupées. Le projet est
  documenté et testé pour qu'un développeur humain puisse reprendre.
- **Le nom du produit cabinet ?** « SkanFact Cabinet » aujourd'hui. Un nom qui dit « comptabilité »
  vaut peut-être mieux pour le vendre à des cabinets. **À toi.**
- **Le site ?** Page Tarifs avec l'offre Cabinet (après l'Ordre), téléchargement du Cabinet (le bouton
  actuel mène à un 404), fiche d'installation. **À faire avec la licence du Cabinet.**
- **La formation du comptable ?** L'aide intégrée (bulles et articles, comme côté entreprise), le jeu
  d'exemple rempli, et toi en démonstration. Pas de formation payante. **Décidé.**
- **Comment on gagne d'autres cabinets ?** Par les clients : chaque paquet envoyé à un comptable sans
  Cabinet est un ZIP lisible qui lui dit que le Cabinet est gratuit pour ce dossier. Et par le pilote,
  s'il en parle.

## 9. Les risques, et ce qui les couvre

- **Le comptable ne joue pas le jeu du pilote.** On reste sur le pont amélioré (les livres lus dans les
  paquets) et on ne construit pas la tenue complète sans cabinet. **Décidé.**
- **On s'éparpille.** Une version à la fois, finie, testée, publiée, utilisée. Rien n'est commencé
  avant que la précédente soit sur le bureau du pilote. **Décidé.**
- **La loi de finances change les taux.** Aucun taux n'est écrit en dur, tout est paramétrable, et
  l'application porte « À VÉRIFIER » partout où un chiffre relève du comptable. **Décidé.**
- **Sage sort la même chose.** Notre différence : le pont avec le client, le hors-ligne, pas de sièges,
  le prix. Ce sont des choix de structure, pas des fonctions à copier.
- **Skander est seul.** Le dépôt porte les plans, les règles apprises, les tests : un développeur qui
  arrive peut reprendre. Et la clé maître est sauvegardée.
- **Un chiffre faux chez un comptable.** C'est le risque le plus grave : il ruine la confiance en une
  fois. D'où le test de parité, les contrôles (balance équilibrée, lettrage = solde), et la règle « on
  ne montre que ce qu'on peut prouver ».
