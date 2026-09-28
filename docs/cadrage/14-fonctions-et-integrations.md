# 14 — Tout ce que fait SkanFact : Hesabi, les métiers, les intégrations, les langues

*Proposé le 28/09/2026, **par délégation** (« c'est toi le chef du projet, donc il faut faire le
meilleur possible »). Répond à la demande de Skander du même jour : « il faut s'aligner avec Hesabi,
donc tout ce qu'ils ont, il nous le faut aussi » ; l'hôtellerie « à la fin, quand tout sera fini » ;
« l'arabe pour plus tard, mais préparer l'infrastructure qui va l'accueillir » ; « l'intégration de
plusieurs autres outils, comme fait Hesabi ». **Validé par délégation de Skander le 28/09/2026** (« relis-les à ma place et valide toi si c'est bon »), après deux relectures complètes du dépôt le même jour. Les documents 00 à 09,
11 à 13, la vision et `CLAUDE.md` ont été mis à jour pour le suivre. **Relu le même jour contre tout
le dépôt** : les vagues passent de trois à quatre (la vague 1 débordait, `09` § 1).*

*Ce que ce document dit des concurrents, ce sont **leurs affirmations** : leurs sites (hesabi.tn,
swiver.io, caissa.tn, tn-pos.com…) sont bloqués depuis l'environnement de travail, on les lit par les
moteurs de recherche. Avant toute comparaison publique, on ouvre leur essai et on vérifie
(`docs/etudes/ETUDE-HESABI.md`). Sources en fin de document.*

## En bref (pour Skander)

- **Tout ce que Hesabi a, on l'a au lancement.** Sur les 20 fonctions qu'ils annoncent, **six
  manquaient au cadrage ou n'y étaient qu'à moitié. Elles sont ajoutées au lancement** : l'**espace client** (le client
  de nos clients voit et paie ses factures en ligne), la **lecture d'une facture en photo ou en
  PDF**, les **lettres de mission et les honoraires** du cabinet, les **clés d'API**, les écrans
  pensés pour le **téléphone**, et la **préparation de l'arabe**.
- **On va plus loin qu'eux** : hors ligne, rapprochement bancaire, lettrage, immobilisations,
  clôture et liasse, relances, devises, journal inaltérable, comptable gratuit, et le **paiement en
  ligne d'une facture par Konnect** (Swiver l'a, Hesabi ne l'annonce pas).
- **Les métiers.** Au lancement, la **caisse de comptoir** et les **commerces et grossistes** : prix
  par quantité, encours, commandes fournisseurs, réceptions. La **restauration** (plan de salle,
  tables, cuisine, réservations, repris de Slate : `15`) arrive **en vague 1**, une fois la base
  stable (décision de Skander, 28/09/2026). Le **bâtiment**, la
  **fabrication**, les **rendez-vous**, la **location**, le temps passé : dans les vagues qui suivent
  le lancement. L'**hôtellerie à la toute fin**, comme tu l'as demandé.
- **Les intégrations.** Au lancement : l'administration (TTN, DigiGo, TEJ, CNSS, caisse), Konnect,
  WhatsApp, l'e-mail, les relevés de banque, l'API. Ensuite, dans l'ordre : WhatsApp automatique et
  les SMS de rappel (avec la restauration), puis les boutiques en ligne (WooCommerce, Shopify), les
  sociétés de livraison (Intigo, First Delivery) et un autre paiement (Flouci).
- **L'arabe** : l'infrastructure dès la première ligne de code, avec un test qui la prouve à chaque
  version ; l'interface en arabe dans la première vague après le lancement.
- **Ce que ça coûte** : le lancement passe de **22 à 25 mois** au plan (28 avec la marge), `09`. Et
  l'offre Essentiel (390 DT) comprend désormais **le stock et une caisse**, comme Hesabi Starter au
  même prix, mais avec la facture électronique et TEJ qu'ils vendent 790 DT (`07`).

**Les six moments** utilisés dans ce document :

| Moment | Quand (`09`) |
|---|---|
| **Lancement** | J5, le lancement public |
| **Vague 1** | Environ **6 mois** après J5 |
| **Vague 2** | Environ **12 mois** après J5 |
| **Vague 3** | Environ **18 mois** après J5 |
| **Vague 4** | Environ **24 mois** après J5 |
| **À la fin** | Après la vague 4 : l'hôtellerie |

Chaque fonction d'une vague a **sa forme posée dès maintenant** dans le modèle de données (`01`
§ 24) : la faire plus tard ne demandera jamais de tout reprendre.

---

## 1. Hesabi, fonction par fonction

| Ce que Hesabi annonce (leur offre) | Chez nous | Quand | Où c'est écrit |
|---|---|---|---|
| Devis, facture, proforma, bon de livraison, avoir (Starter) | Oui, plus commande, note d'honoraires, acompte et solde, contrats récurrents, devis par sections | Lancement | `02` § 2, Ventes |
| Facture électronique signée et envoyée à la TTN, par NGSign (Pro) | Oui, par DigiGo ou la clé USB, avec la file d'envoi, l'accusé, le QR code et l'archive de 10 ans, **dans toutes les offres payantes** | Lancement | `05` § 3.1, 3.2 |
| TEJ : retenue à la source, fichier XML, dépôt à la main (Pro) | Oui, avec les certificats, et le dépôt direct quand l'administration l'ouvre | Lancement | `05` § 3.3 |
| Déclaration de TVA (Pro) | La déclaration du mois prête, case par case, à copier | Lancement | `02`, Déclarations |
| Comptabilité PCG-TN, écritures automatiques (Pro) | Oui, plus rapprochement, lettrage, immobilisations, clôture, liasse, révision | Lancement | `02`, Comptabilité complète |
| Export FEC (Pro) | Oui (déjà dans la v10, 10.15.0) | Lancement | `02`, Comptabilité complète ; `03` § 3.1 |
| Paie : CDI, CDD, CIVP, Karama, saisonniers ; CNSS, IRPP, TFP (Pro) | Oui, plus le fichier CNSS au format DS 2012 et la déclaration d'employeur | Lancement | `05` § 3.6 |
| Stock : code-barres, mouvements automatiques, alertes, export Excel (Starter) | Oui, plus dépôts, transferts, lots, numéros de série, coût moyen, **recettes et kits** ; **dans Essentiel** | Lancement | `02`, Stock ; `07` |
| Caisse web, ticket 80 mm, plusieurs moyens de paiement, WhatsApp (Starter) | Oui, **hors ligne**, certifiée dès l'homologation ; **une caisse dans Essentiel** ; le **mode restaurant** en vague 1 (§ 3.1) | Lancement | `02`, Caisse |
| Import « IA » : tableur, PDF, image, XML (Pro) | Tableur avec les colonnes reconnues ; facture TEIF lue **exactement** ; **photo et PDF lus sur nos serveurs en Tunisie** (§ 2.3) | Lancement | § 2.3 |
| Chiffrage d'un devis (Pro) | Le calculateur de prix de la v10 (coefficient, marge, marque, TTC visé), dans toutes les offres | Lancement | `02`, Ventes |
| Portail du cabinet : tous les clients, bascule dans un dossier, calendrier fiscal, TEJ en masse, **honoraires** (Cabinet, 2 490 DT) | Tout, **gratuit** pour les dossiers abonnés ; plus les **lettres de mission**, la **facturation des honoraires** et les **dépôts groupés** (§ 2.4) | Lancement | `02`, Cabinet ; `07` |
| **Portail client** : le client consulte ses factures (Starter) | L'**espace client**, avec le **paiement en ligne** (§ 2.1 et 2.2) | Lancement | § 2.1 |
| Plusieurs utilisateurs, rôles ; 3 en Starter, illimités en Pro | Neuf rôles et des droits par personne ; 3 en Essentiel, illimités en Complet | Lancement | `03` § 2 |
| Arabe (de droite à gauche), français, anglais | Infrastructure au lancement ; **interface en arabe** en vague 1, en anglais en vague 4 ; pièces en anglais dès le lancement (§ 5) | Lancement, vague 1, vague 4 | § 5 |
| Envoi par WhatsApp | Oui (déjà dans la v10, 10.15.0) | Lancement | § 4 |
| Tableaux de bord, rapports exportables | Pilotage, et **toute liste s'exporte** en Excel | Lancement | `02`, Pilotage |
| Clés d'API (Pro) | **API publique documentée**, clés et avis d'événement (§ 2.5) | Lancement | § 2.5 |
| Sur téléphone, tablette et ordinateur | Les écrans du quotidien pensés pour le téléphone (§ 2.6) ; l'application des magasins en vague 4 | Lancement, vague 4 | § 2.6 |
| Essai de 14 jours | 30 jours | — | `07` |

**Ce qu'on a et qu'ils n'annoncent pas** : le travail **pendant une coupure** ; le rapprochement
bancaire, le lettrage, les immobilisations, la clôture et la liasse, la révision ; les relances, les
devises et l'écart de change ; le journal inaltérable ; le comptable **gratuit** pour les dossiers
abonnés ; le **paiement en ligne** d'une facture ; un prix par entreprise.

---

## 2. Les six manques, décidés

### 2.1 L'espace client

Le client d'une entreprise (son client à elle) ouvre un lien et voit, sans rien installer :
- ses **factures, avoirs et bons de livraison émis**, avec le PDF et le XML signé ;
- son **relevé** : ce qu'il doit, ce qu'il a payé, les échéances ;
- le bouton **« Payer en ligne »**, si l'entreprise l'a activé (§ 2.2).

**Les règles** :
- **Deux sortes de liens**, tous deux secrets, révocables et tracés : le lien **d'une pièce** (dans
  l'e-mail ou le WhatsApp qui l'envoie) et le lien **du compte** (le relevé, pour un client
  régulier). L'entreprise voit sur la pièce « vue le … ».
- **Jamais un brouillon, jamais le tiers d'à côté** : le lien porte un tiers, et la porte des droits
  (`03` D2) ne lui laisse lire que **ses** pièces émises.
- **Rien ne change par l'espace client**, sauf le paiement (qui passe par le prestataire).
- Le visiteur **n'est pas un utilisateur** : il ne compte pas dans l'offre (`03` § 4.1).
- Tout est servi par **notre serveur en Tunisie** : aucune donnée ne sort pour l'afficher.

### 2.2 Le paiement en ligne d'une facture

**Konnect au lancement**, parce que nous l'avons déjà intégré pour nos propres abonnements (`10`
§ 2.6), et que Swiver le propose déjà à ses clients (annoncé en 2025).
- L'entreprise branche **son propre compte Konnect**. L'argent va **directement chez elle** :
  SkanFact ne touche jamais l'argent de ses clients. La clé de son compte se garde chiffrée, et ne
  se relit jamais (`06` § 5).
- La facture (PDF, e-mail, WhatsApp, espace client) porte « Payer en ligne ». Le montant proposé est
  le **reste à payer**.
- **Le paiement se prouve auprès de Konnect**, jamais sur la page de retour (la règle de la 10.9.0).
  Une fois prouvé, le **règlement se crée tout seul**, sur un compte de trésorerie « Konnect »
  (portefeuille électronique, `01` § 11). Le virement de Konnect vers la banque est un virement entre
  comptes, et la commission une charge.
- **Flouci** en vague 2, **ClicToPay** et **e-Dinar** en vague 4 : chacun remplit le même point de
  branchement, le « prestataire de paiement » (`02` § 4.3). **Paymee** attend : une source dit que
  ses comptes marchands ont été gelés par la Banque centrale (**À VÉRIFIER**).

**À VÉRIFIER** : un client qui fait une **retenue à la source** paie le net ; le lien doit alors
proposer le net de retenue, et l'attestation se réclame (`05` § 3.3).

### 2.3 Lire une facture en photo ou en PDF

La v10 envoyait la photo à un service à l'étranger, et c'est pour ça qu'elle ne passait pas à la
plateforme (`05` § 4.3). **Décision : la lecture se fait sur nos serveurs, en Tunisie**, avec un
moteur de lecture libre (choisi au `12` § 3). Aucune image ne sort.
- **D'abord le plus sûr** : une facture électronique TEIF reçue se lit **exactement**, sans lecture
  d'image (déjà dans la v10, 10.15.0).
- **Une photo ou un PDF** : le moteur lit le texte, SkanFact **propose** le fournisseur (par son
  matricule), la date, le numéro, le HT, la TVA par taux, le timbre et le total. **Rien ne
  s'enregistre sans que la personne confirme**, et chaque champ proposé montre où il a été lu.
- **Deux chemins, un chiffre** : SkanFact recalcule le total depuis les montants lus ; s'il ne
  tombe pas sur le total lu, il le dit, et ne choisit pas à la place de la personne.
- **Un tableur** (clients, articles, pièces, relevés) : les colonnes sont reconnues par leur titre et
  leur contenu, et la personne corrige ce qui est mal reconnu (la v10 le fait déjà en partie, 213e).
- **Un seuil écrit d'avance** : le moteur est retenu s'il lit juste le matricule, la date et le total
  sur **au moins 9 factures sur 10** d'un lot de vraies factures tunisiennes, prêtées **avec
  l'accord** de leurs propriétaires (`12` § 10).
- **L'intelligence artificielle qui écrit** (un assistant) n'est pas au lancement. Elle ne viendra
  qu'hébergée en Tunisie, ou avec l'autorisation de l'INPDP (`05` § 4.3).

### 2.4 Le cabinet : lettres de mission, honoraires, dépôts groupés

- **La lettre de mission**, attachée au mandat (`03` § 3.4) : les missions (tenue, révision, paie,
  déclarations, conseil), les **honoraires** (forfait au mois ou à l'année, par bulletin, par pièce
  au-delà d'un nombre), les dates. Elle se signe par DigiGo si le cabinet le veut.
- **Les honoraires se facturent tout seuls** : la lettre de mission produit un contrat récurrent
  dans la **société du cabinet**, qui émet ses factures électroniques à ses clients. C'est **compris
  dans l'espace du cabinet** (`07`) : Hesabi le vend dans une offre à 2 490 DT.
- **Les dépôts groupés** : préparer en un geste la déclaration du mois ou le fichier TEJ de
  **plusieurs dossiers**, chacun contrôlé et tracé à part. Un dossier qui bloque se nomme ; il
  n'empêche pas les autres.
- **Le temps passé par dossier** viendra avec le module Projets (vague 3), que le cabinet utilise
  dans sa propre société.

### 2.5 L'API publique, dès le lancement

Le cadrage disait « l'API d'abord, les clés plus tard ». **Décision : les clés sont ouvertes au
lancement**, dans toutes les offres payantes.
- Une **documentation publique** (générée depuis le code, donc jamais en retard sur lui), une
  **entreprise d'essai** pour les développeurs, des adresses versionnées (`/v1/…`).
- Des **clés** créées par le propriétaire ou l'administrateur, avec une liste de gestes, une
  expiration, une trace à leur nom (`03` § 8).
- Des **avis d'événement** (une facture émise, un règlement reçu) envoyés aux adresses que
  l'entreprise choisit, **signés** pour qu'on sache qu'ils viennent de nous, et renvoyés s'ils
  échouent.
- Des **limites d'appels** par clé, pour qu'une intégration mal écrite ne ralentisse pas les autres
  (vision § 6).

### 2.6 Le téléphone, dès le lancement

Le cadrage disait « le téléphone après le web et le bureau ». **Décision : les écrans du quotidien
marchent sur téléphone dès le lancement**, dans le navigateur ou installés sur l'écran d'accueil. Ce
qui attend, c'est seulement l'application **des magasins** (App Store, Google Play), en vague 4.
- **Pensés pour le téléphone** : faire et envoyer un devis ou une facture, encaisser un règlement,
  photographier un justificatif (§ 2.3), consulter l'accueil, les soldes et « À faire », répondre au
  comptable, **la caisse sur tablette** ; en vague 1, **prendre une commande à table** (§ 3.1).
- **Utilisables mais pensés pour l'ordinateur** : la saisie comptable, la révision, la liasse, la
  paie complète. Sur un petit écran, ils le disent.
- **Prouvé à chaque version** : l'instrument de rendu de la v10, porté, photographie chaque écran à
  la largeur d'un téléphone et à celle d'un ordinateur ; un bouton trop petit pour un doigt, un
  texte coupé ou une ligne qui déborde font tomber la construction.
- **Hors ligne sur un téléphone** : mêmes règles (`04`), et le stockage des navigateurs de téléphone
  se vérifie au prototype (`04` § 11, point 2).

---

## 3. Les métiers

### 3.1 La restauration (vague 1, avec Slate)

**Pourquoi en vague 1 et pas au lancement** (décision de Skander, 28/09/2026) : l'entreprise, le
cabinet et la console sont le cœur, et on les rend **stables d'abord** ; la restauration est un
métier complet qui s'ajoute ensuite, en reprenant Slate (`15`). Et le calendrier de la caisse
certifiée le permet : à notre lancement, les restaurants et cafés seront **déjà** obligés depuis
plus de deux ans (`05` § 3.7) et déjà équipés. On ne les prendra pas sur l'urgence, mais sur
l'offre complète : la caisse, les réservations, le stock et la comptabilité au même endroit.

**Pourquoi en vague 1 et pas à la fin** : Slate est déjà écrit, et un code qu'on laisse dormir
coûte plus cher à reprendre chaque mois ; la caisse de comptoir, elle, est déjà là au lancement.
Une caisse sans tables ne sert à rien à un restaurant. Les caisses tunisiennes spécialisées le font
déjà : TN-POS Resto Pro annonce le plan de salle, les quatre façons de vendre et plusieurs
imprimantes de cuisine ; Caissa, le terminal de paiement.

| Ce qu'il faut | Quand |
|---|---|
| **Plan de salle** : salles, tables, places ; l'état de chaque table en couleur (libre, commande prise, en cours, à encaisser) | Vague 1 |
| **Quatre façons de vendre** : à table, au comptoir, à emporter, en livraison | Vague 1 (le comptoir : lancement) |
| **La commande part en cuisine** : chaque article va à **sa** zone (cuisine, bar, pizza), sur **son** imprimante | Vague 1 |
| **Suppléments et options** (cuisson, sans oignon, supplément fromage) et **formules** (entrée, plat, dessert à prix fixe) | Vague 1 |
| **Transférer ou regrouper** des tables ; **partager l'addition** par convive ou par plat | Vague 1 |
| **Titres-restaurant** (chèques et cartes Pluxee) comme moyen de paiement, avec la remise à l'émetteur et sa commission (les épiceries en acceptent aussi) | Lancement |
| **La recette** d'un plat sort ses ingrédients du stock (§ 3.3 : les recettes et kits sont au lancement) | Vague 1 |
| Annuler une ligne **déjà partie en cuisine** : avec le **code d'un responsable** (`03` § 2.3) | Vague 1 |
| **Réservations** (widget public, rappels, liste d'attente, table attribuée) et **service du jour**, repris de Slate (`15`) | Vague 1 |
| **Écran de cuisine** (à la place du papier) | Vague 2 |

**Pendant une coupure**, la salle se tient **sur la caisse** : c'est elle qui prend les commandes et
les envoie aux imprimantes de cuisine, par le réseau du restaurant (l'agent local, `12` § 5). Les
téléphones des serveurs, eux, ont besoin du serveur : pendant la coupure, ils le disent, et les
serveurs passent par la caisse (`04` § 1).

**À VÉRIFIER** (cahier des charges de la caisse, `05` § 3.7) : une commande prise à table mais pas
encore encaissée doit-elle être enregistrée ou transmise ? Le QR code et l'identifiant du module de
sécurisation sur chaque ticket.

### 3.2 Les commerces, grossistes et distributeurs (au lancement)

| Ce qu'il faut | Quand |
|---|---|
| Caisse au comptoir, code-barres, **articles vendus au poids** (quantité à décimales) | Lancement |
| **Prix par client ou par catégorie** (déjà au `01` § 5) et **prix par quantité** (à partir de 10, de 100…) | Lancement |
| **Encours autorisé** par client : au-delà, SkanFact avertit ou demande l'accord d'un responsable | Lancement |
| **Commandes clients** livrées en plusieurs fois, **reliquats** suivis, **plusieurs bons de livraison en une facture** | Lancement |
| Côté achats : **demande de prix, commande fournisseur, réception** (même partielle), et la facture rapprochée de la réception (un écart de quantité ou de prix se signale) | Lancement |
| Stock par dépôt, transferts (déjà au `02`) | Lancement |
| **Cartes cadeaux** (déjà écrites dans Slate, `15`) | Vague 1 |
| **Fidélité** (points), **promotions** datées | Vague 2 |
| **Balance connectée** à la caisse ; étiquettes de balance lues à la douchette | Vague 3 |
| Tournées de livraison, prise de commande par un représentant sur la route | Vague 4 |

### 3.3 La fabrication et les ateliers

- **Recettes et kits** au lancement : un article **composé** d'autres articles (un plat, un coffret,
  un meuble en kit) sort ses composants du stock quand il est vendu.
- **Ordres de fabrication** en vague 3 (module Production) : consommer les composants, produire
  l'article fini, et figer son **coût de revient** (composants, main d'œuvre, frais).

### 3.4 Le bâtiment et les chantiers

- Au lancement : **devis par sections** (titres et sous-totaux), suivi par chantier (l'axe analytique
  « Affaires » existe déjà, `01` § 14), acomptes et soldes.
- En vague 2 : les **situations de travaux** (on facture l'avancement, en pourcentage du marché, avec
  le cumul), la **retenue de garantie** (retenue sur chaque situation, libérée à la réception) et
  l'**avance de démarrage** remboursée au fil des situations. **À VÉRIFIER** avec un comptable : les
  taux et le traitement en marché public et privé.

### 3.5 Les services, les rendez-vous, la location

- **Prestataires** (cible n° 2) : tout est au lancement (note d'honoraires, retenue, facture
  électronique, récurrent). Le **temps passé** et la facturation au temps viennent avec le module
  **Projets** (vague 3).
- **Rendez-vous** (coiffure, esthétique, santé, garages, auto-écoles) : module **Réservations**,
  en vague 1, avec les restaurants (repris de Slate, `15`) : un agenda par personne ou par poste,
  une page de prise de rendez-vous, le rappel au client, l'encaissement au passage.
- **Location** (matériel, voitures, salles) : le même module, en vague 3 : une chose réservée sur une
  période, la **caution** (reçue puis rendue ou retenue ; ce n'est pas un chiffre d'affaires,
  **À VÉRIFIER** avec un comptable), l'état au départ et au retour, la facture à la durée.

### 3.6 Pour tous les métiers

| Ce qu'il faut | Quand |
|---|---|
| **Balance âgée** : ce que chaque client doit, par ancienneté (déjà dans la v10, 9.5.0) | Lancement |
| **L'accord d'un responsable au-delà d'un seuil** (remise, encours, commande, retour), la règle de la caisse étendue à tout (`03` D11) | Lancement |
| **Tableau de bord du groupe** : les chiffres de toutes les sociétés d'un groupe, dans la devise de base (le `13` le promet à la cible n° 6) | Lancement |
| **Suivi commercial** : prospects, opportunités, prochaine action, rappels (les campagnes et les avis de Slate, eux, viennent en vague 1 avec la restauration) | Vague 2 |
| **Notes de frais** : le salarié photographie son justificatif, un responsable l'accepte, le remboursement suit | Vague 3 |
| **Rapports à la carte** : choisir ses colonnes et ses filtres | Vague 3 |
| **Groupe complet** : consolidation, ventes entre sociétés reliées toutes seules | Vague 4 |

### 3.7 L'hôtellerie (à la fin)

Décision de Skander (28/09/2026) : les chambres, les séjours et ce qui va avec viennent **à la fin,
quand tout le reste est fini**. Le module **Réservations** est conçu pour l'accueillir : une chambre
est une chose qu'on réserve sur une période, comme une salle ou une voiture. Rien ne sera à refaire.

---

## 4. Les intégrations

**Les règles** (celles du projet, appliquées aux intégrations) :
- chaque intégration passe par l'**API publique** et par un **point de branchement déclaré** (`02`
  § 4.3 : prestataire de paiement, société de livraison, boutique en ligne) ; aucune ne touche
  l'intérieur d'un module ;
- **c'est l'entreprise qui l'allume**, et elle voit **la liste de ce qui part** chez le partenaire ;
- **chaque flux qui sort est compté avant d'être ouvert** (`05` § 4.3) ; un partenaire **hors de
  Tunisie** (Meta pour WhatsApp, Shopify) demande l'avis du juriste et, s'il le faut, l'autorisation
  de l'INPDP.

| Pour quoi | Partenaire | Ce qui part | Quand |
|---|---|---|---|
| **Administration** | TTN (El Fatoora), DigiGo et TunTrust, TEJ, e-jibaya (cases à copier), CNSS (fichier), plateforme des caisses | Ce que la loi demande (`05` § 3) | Lancement |
| **Paiement des factures** | Konnect | Montant, référence de la facture | Lancement |
| | Flouci | Idem | Vague 2 |
| | Paymee, **si** ses comptes marchands sont rouverts (gelés par la Banque centrale selon une source) | Idem | **À VÉRIFIER** |
| | ClicToPay (SMT), e-Dinar (La Poste) | Idem ; leur API est **À VÉRIFIER** | Vague 4 |
| **Terminal de paiement bancaire** | Non connecté : le montant se tape sur le terminal, le ticket garde « carte » et la référence | Rien | Lancement |
| | Connecté, quand une banque publie un protocole | À décider | Vague 4, **À VÉRIFIER** |
| **Titres-restaurant** | Pluxee | Rien (un moyen de paiement et une remise) | Lancement |
| **Messages** | E-mail, par notre serveur en Tunisie | Le message et la pièce | Lancement |
| | WhatsApp **par lien** : le message s'ouvre dans le WhatsApp de l'utilisateur, qui l'envoie lui-même | Rien ne passe par nous | Lancement |
| | SMS : codes de connexion (`03` § 6) ; puis relances et rappels de rendez-vous | Numéro, texte | Lancement ; vague 1 |
| | WhatsApp **automatique** (l'API de Meta, par un prestataire) | Numéro, message ; **hors de Tunisie** | Vague 1, après l'avis du juriste |
| **Banque** | Relevés de chaque banque tunisienne importés en fichier | Rien | Lancement |
| | Connexion directe : **aucune API bancaire publique trouvée en Tunisie** | — | Rien de promis ; revu chaque année |
| **Boutiques en ligne** | WooCommerce (le plus répandu avec les paiements tunisiens), Shopify | Commandes, articles, stock | Vague 2 |
| | PrestaShop | Idem | Vague 4 |
| **Livraison** | Intigo (API et modules pour les boutiques, confirmés) ; First Delivery (**paiement à la livraison** reversé chaque jour ; son API est **À VÉRIFIER**) | Adresse, colis, montant à encaisser | Vague 2 |
| | Navex, Aramex | Idem | Vague 3 |
| **Avis en ligne** | Google, TripAdvisor (la demande d'avis de Slate, `15`) | Le nom du lieu, l'avis ; **hors de Tunisie** | Vague 1, après l'avis du juriste |
| **Autres logiciels** | Export FEC, Excel, CSV ; reprise depuis Sage, Ciel, Hesabi (`08`) | Ce qu'on exporte soi-même | Lancement |
| | Connecteurs sans code (Zapier, Make, n8n), par les avis d'événement | Ce que l'entreprise choisit | Vague 3 |
| | Odoo, échange continu | À décider | Vague 4, si des clients le demandent |
| **Assistants d'IA extérieurs** | Accès en lecture par le protocole MCP, **allumé par l'entreprise** | Ce qu'elle choisit ; **hors de Tunisie** en général | Vague 4, après l'avis du juriste |
| **Stockage et agenda** (Google Drive, Dropbox, Google Agenda) | **Non**, par défaut : ce serait des données à l'étranger | — | Seulement sur une demande précise, avec l'autorisation |

**Une boutique en ligne branchée**, concrètement : une commande de la boutique devient une **commande
client** dans SkanFact ; le stock de SkanFact remonte à la boutique ; la facture électronique est
émise à la livraison ; la société de livraison encaisse et reverse, et ce reversement se rapproche
comme un relevé.

---

## 5. Les langues

Décision de Skander (28/09/2026) : **l'arabe plus tard, l'infrastructure maintenant.**

**Dès la première ligne de code** :
- **Aucune phrase écrite dans un écran** : chaque texte visible vient d'un **catalogue de textes**
  (une clé, et sa version française). Un test fait tomber la construction si une phrase est écrite
  en dur, comme celui qui exige une bulle « i » sur chaque champ.
- **La mise en page ne dit jamais « gauche » ni « droite »**, mais « début » et « fin » (c'est déjà
  la règle de la v10 depuis la 9.4.10), et la bibliothèque d'interface sait écrire de droite à gauche
  (`12` § 4).
- **Une langue pour tester** : à chaque version, l'application est photographiée dans une langue
  factice, **40 % plus longue et de droite à gauche**. Si un texte est coupé ou qu'un bloc déborde,
  la construction tombe. C'est ainsi qu'on sait que l'arabe tiendra **avant** d'en traduire un mot.
- **Les dates, les nombres et les montants** se mettent en forme selon la langue, jamais à la main.
- **Les données** : nom en arabe des tiers (existe déjà), **désignation en arabe des articles**,
  raison sociale et adresse en arabe de l'entreprise (`01` § 24). Les PDF savent écrire l'arabe, avec
  une police libre qui le contient.
- **La langue de chaque personne** est déjà dans sa fiche (`01` § 4).

**Ensuite** :
- **Vague 1** : l'interface, l'aide et les visites **en arabe**, traduites puis **relues par un
  arabophone** ; les **pièces bilingues** arabe et français ; le site en arabe (`11`).
- **La partie restaurant reste en français seulement** (décision de Skander, 28/09/2026) : les
  écrans de la salle, du plan de salle, du service du jour et de la cuisine, le mode restaurant de
  la caisse, les réservations du restaurant et leur widget public, la page de commande, les menus,
  les campagnes et les avis (tout ce qui vient de Slate, `15`). Ses textes passent quand même par
  le catalogue (une seule règle pour tout le code) : ajouter l'arabe un jour ne demanderait que la
  traduction. Ces écrans sont dispensés du test de la langue factice de droite à gauche.
- **Vague 4** : l'interface **en anglais** (les pièces en anglais existent dès le lancement, comme
  dans la v10).

**À VÉRIFIER** (entretiens) : les chiffres attendus en arabe (0-9 ou ٠-٩) ; les mentions obligatoires
en arabe sur une pièce (`05` § 3.9).

---

## 6. Ce que ça coûte

**Le calendrier** (`09`) : ajouter au lancement l'espace client, le paiement en ligne, la lecture de
documents, le cabinet complet, l'API, le téléphone et les commerces **repousse le lancement
d'environ trois mois : 25 mois au plan après le premier code, 28 avec la marge** (au lieu de 22 et
24). Les pilotes passent à la plateforme au mois 16 au lieu du mois 14. La restauration, en vague 1,
n'allonge pas le lancement.

**Les prix** (`07`, par délégation, révisables après les entretiens) :
- **Essentiel (390 DT par an)** comprend désormais **le stock et une caisse** (le mode restaurant
  s'y ajoute en vague 1), l'espace client, le paiement en ligne, la lecture de documents et l'API. C'est le prix
  de Hesabi Starter, avec ce que Hesabi vend dans son offre à 790 DT (facture électronique, TEJ,
  lecture de documents, API).
- **Complet (690 DT par an)** : tout, plus la paie, la comptabilité complète, les modules de métier
  des vagues (Réservations, Production, Projets), deux caisses, des utilisateurs illimités.

**Le budget** (`09` § 4) : un serveur de plus pour la lecture de documents ; la relecture de
l'arabe par un arabophone en vague 1 ; les frais de chaque partenaire (Konnect, SMS, WhatsApp) payés
par l'entreprise qui les utilise, jamais cachés dans notre prix.

---

## 7. À VÉRIFIER

1. **Chaque affirmation des concurrents**, dans leur essai, avant toute comparaison publique.
2. **La caisse** (`05` § 3.7) : commandes de table avant l'encaissement ; QR code et module de
   sécurisation sur le ticket.
3. **Le paiement en ligne et la retenue à la source** : proposer le net de retenue (§ 2.2).
4. **Konnect** : le compte marchand de chaque entreprise, ses frais, l'avis de paiement (`10` § 2.6).
5. **Le bâtiment** : retenue de garantie, avance de démarrage, marchés publics (comptable).
6. **Les titres-restaurant** : traitement de la commission de l'émetteur (comptable).
7. **La caution** d'une location et les **cartes cadeaux** : ni l'une ni l'autre n'est un chiffre
   d'affaires à la réception ? TVA ? (comptable).
8. **WhatsApp automatique, Shopify, avis en ligne, assistants d'IA** : données hors de Tunisie
   (juriste, INPDP).
9. **La qualité de la lecture de documents**, mesurée sur de vraies factures prêtées avec accord
   (`12` § 10).
10. **Les terminaux de paiement** : un protocole ouvert chez une banque tunisienne ?
11. **L'arabe** : chiffres et mentions obligatoires (§ 5).
12. **Paymee** (comptes gelés ?) et l'**API de First Delivery** (§ 4).

## 8. Sources

- Hesabi : [tarifs](https://hesabi.tn/tarifs), [Hesabi vs Swiver](https://hesabi.tn/hesabi-vs-swiver)
  (portail client, cabinet et honoraires, arabe, français et anglais), [comptabilité](https://hesabi.tn/logiciel-comptabilite-tunisie),
  [TEJ](https://hesabi.tn/tej-retenue-source-tunisie), [caisse](https://hesabi.tn/logiciel-caisse-pos-tunisie),
  [stock](https://hesabi.tn/logiciel-gestion-stock-tunisie) ; notre étude : `docs/etudes/ETUDE-HESABI.md`.
- Paiement : [Swiver et Konnect, payer ses factures en ligne](https://swiver.io/blog/swiver-konnect-payer-vos-factures-en-ligne/),
  [Konnect, API d'initiation de paiement](https://docs.konnect.network/docs/fr/api-integration/endpoints/initiate-payment),
  [Konnect, liens de paiement](https://konnect.network/services/payment-link/),
  [Flouci, API](https://docs.flouci.com/introduction), [Paymee sur Shopify, et le gel de ses comptes](https://www.cartdna.com/fr_FR/guide-de-paiement-shopify/afrique/tunisie), [comparatif des paiements en ligne](https://smartegy.tn/les-moyens-de-paiement-e-commerce-en-tunisie-ou-en-est-on-en-2025/).
- Restauration et caisse : [TN-POS Resto Pro](https://www.tn-pos.com/produit/resto-pro/),
  [Caissa, terminal de paiement intégré](https://caissa.tn/faq.html),
  [WMC, plateforme des caisses](https://www.webmanagercenter.com/2025/10/17/553889/caisse-enregistreuse-la-tunisie-met-en-place-une-plateforme-pour-les-fournisseurs-et-tests-dintegration),
  [Pluxee Tunisie, commerçants](https://www.pluxee.tn/produits/commercant/carte/).
- Livraison : [Intigo, services et intégrations](https://intigo.net/services/),
  [Intigo sur Shopify](https://apps.shopify.com/intigo-prod), [First Delivery, « First Tsaba9lek »](https://www.firstdeliverygroup.com/first-delivery-revolutionne-la-logistique-avec-son-nouveau-service-innovant-first-tsaba9lek/).
- WhatsApp : [BuzzBip](https://whatsapptunisie.buzzbip.com/), [tarifs de l'API WhatsApp Business](https://sleekflow.io/en-us/blog/whatsapp-business-price).
- Banques : [Open Banking Tracker, Tunisie](https://www.openbankingtracker.com/providers/country/tn).

## 9. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (par délégation) | Tout ce que Hesabi annonce est au lancement ; les six manques (espace client, lecture de documents, cabinet complet, API, téléphone, arabe préparé) y sont ajoutés |
| 28/09/2026 (par délégation) | Paiement en ligne des factures par Konnect au lancement, sur le compte de l'entreprise ; jamais d'argent de client chez SkanFact ; le paiement se prouve auprès du prestataire |
| 28/09/2026 (par délégation) | La lecture de photos et de PDF se fait sur nos serveurs en Tunisie, avec confirmation de la personne ; pas d'IA qui écrit au lancement |
| 28/09/2026 (par délégation, **revu le même jour par Skander**) | La restauration en vague 1, avec Slate ; caisse de comptoir, commerces et grossistes au lancement ; bâtiment, rendez-vous et suivi commercial en vague 1 ; fabrication, location, projets en vague 2 ; groupe complet en vague 3 ; **hôtellerie à la fin (décision de Skander)** (vagues revues à la dernière ligne) |
| 28/09/2026 (par délégation) | Intégrations dans l'ordre du § 4, chacune allumée par l'entreprise, chaque flux compté avant d'être ouvert |
| 28/09/2026 (**Skander**) | La partie restaurant (Slate et le mode restaurant de la caisse) reste **en français seulement** ; le reste de l'interface passe en arabe en vague 1 (§ 5) |
| 28/09/2026 | **L'arabe plus tard, l'infrastructure maintenant (décision de Skander)** : catalogue de textes, mise en page début et fin, langue factice testée à chaque version ; interface arabe en vague 1 |
| 28/09/2026 (par délégation) | Les écrans du quotidien marchent sur téléphone dès le lancement ; l'application des magasins en vague 3 (vague 4 depuis la relecture) |
| 28/09/2026 (par délégation) | Lancement à 25 mois au plan, 28 avec la marge (après le passage du restaurant en vague 1) ; Essentiel comprend le stock et une caisse |
| 28/09/2026 (**Skander**, `15`) | Slate, l'application pour restaurateurs de Skander, entre dans SkanFact comme sa partie restaurant ; **en vague 1**, une fois la base stable (entreprise, cabinet, console) ; cartes cadeaux en vague 1 |
| 28/09/2026 (par délégation, relecture) | **Quatre vagues** (`09` § 1) : vague 1, la restauration avec Slate, l'arabe, les rendez-vous, WhatsApp automatique et les SMS ; vague 2, le bâtiment, le suivi commercial, les boutiques, la livraison, Flouci, la fidélité, l'écran de cuisine ; vague 3, Production, Projets, la location, les notes de frais, la balance, Navex et Aramex, les connecteurs, les rapports ; vague 4, le groupe, l'anglais, les applications des magasins, PrestaShop, ClicToPay et e-Dinar, le terminal connecté, Odoo, l'IA, les tournées ; puis l'hôtellerie |
