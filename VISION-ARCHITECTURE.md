# Vision et architecture de SkanFact

*Document de cadrage, version 1 — 27/09/2026, relu le 28/09/2026. Écrit après l'étude de marché (`docs/etudes/ETUDE-MARCHE.md`) et
une recherche technique sur Odoo, ERPNext, les bases de données partagées entre clients, la
synchronisation hors ligne, et la signature électronique en Tunisie. **Il fait foi** : les plans de
l'ancienne vision sont rangés dans `docs/archives/ancienne-vision/`, et le détail de chaque sujet
vit dans `docs/cadrage/`.*

*Rien dans ce document n'est codé. C'est le plan qu'on valide avant la première ligne.*

---

## 1. La vision

**SkanFact devient la plateforme tunisienne où une entreprise gère tout son travail — vendre,
acheter, encaisser, payer ses employés, déclarer — et où son comptable travaille dans les mêmes
données, depuis un ordinateur, un navigateur ou pendant une coupure, avec des chiffres toujours
justes et un prix par entreprise.**

### Ce qui sera possible

- Le chef d'entreprise fait un devis, le transforme en facture, et la facture est **signée et
  envoyée à la TTN en un clic** ; le numéro El Fatoora et le QR code reviennent sur le PDF, qui part
  par WhatsApp ou par mail.
- L'employé encaisse à la caisse **même quand internet est coupé** ; tout remonte au retour du réseau.
- Le comptable voit la pièce **dès qu'elle existe**, la valide, pose sa question sur la pièce,
  prépare la TVA, la retenue à la source, la CNSS, la clôture et la liasse — **sans rien retaper**.
- Un **groupe** passe d'une société à l'autre ; chaque personne a ses **droits** (le vendeur voit les
  ventes, pas la paie).
- Depuis **n'importe quel navigateur**, on consulte, on facture, on valide.
- Les déclarations sortent **au format de l'administration**, prêtes à déposer — et partent
  directement quand l'administration l'accepte.

### Nos points forts face au marché (voir `docs/etudes/ETUDE-MARCHE.md`)

1. **Le seul hybride** : utilisable pendant une coupure ET en ligne. Hesabi, Swiver, Finco,
   Pennylane sont uniquement web ; les coupures tunisiennes sont documentées jusqu'en 2026.
2. **Le comptable dans les mêmes données, gratuitement pour les dossiers de ses clients abonnés**
   (`docs/cadrage/07-offres-et-prix.md`). Personne ne le fait en Tunisie.
3. **Le plus complet** : facturation, stock, caisse, paie, trésorerie, comptabilité complète,
   cabinet — déjà écrit et tenu par plus de 1 700 tests.
4. **Des chiffres prouvés** : la fiscalité tunisienne contrôlée par deux calculs indépendants
   (`test/suites/verite-comptable.js`).
5. **Un prix par entreprise**, pas par utilisateur (le piège reproché à Odoo), facture électronique
   comprise dans chaque offre payante.
6. **Utilisable sans formation** : visites guidées sur chaque geste.
7. **Un journal inaltérable** (voir § 4.4) : personne, pas même nous, ne peut réécrire le passé.

---

## 2. Ce qu'Odoo nous apprend

Odoo sert des millions d'utilisateurs. On copie ce qui marche, on évite ce qui coince.

| Ce qu'Odoo fait | Ce qu'on en retient |
|---|---|
| **Un seul modèle de données partagé par toutes les « applications »** (une facture, un article, un client sont des enregistrements du même moteur) | **On le copie.** C'est ce qui supprime la ressaisie entre modules. |
| **Modules qui s'étendent les uns les autres par héritage** (un module modifie le modèle, les vues, les droits d'un autre) | **On le fait plus strict.** Chez Odoo, cette liberté rend chaque mise à jour douloureuse (« chaque version sautée multiplie l'effort par ~1,5 », sources dans l'étude). Chez nous : des **points d'extension déclarés**, jamais un module qui réécrit l'intérieur d'un autre. Les besoins particuliers d'un client passent par des **champs personnalisés** (données), pas par du code. |
| **Une base PostgreSQL par client** (dbfilter), aussi chez ERPNext (« sites ») | **On ne le copie pas tel quel** : au-delà de quelques milliers de bases, les migrations et la maintenance deviennent un chantier. Voir § 4.2. |
| **Workers en processus** : ~1 worker pour ~25 utilisateurs internes, 150–200 Mo par worker, un worker à part pour le temps réel | Node.js tient beaucoup plus de connexions par processus ; mais on garde l'idée : **les travaux longs (rapports, envois TTN, clôtures) partent dans une file d'attente**, jamais dans la requête de l'utilisateur. |
| **ORM lent sur les gros volumes**, champs calculés qui se recalculent en cascade, lenteur avec 200+ modules | **On garde la main sur le SQL** pour les états lourds (balance, grand livre, TVA), avec des **totaux tenus à jour** plutôt que recalculés à chaque affichage. On mesure avant d'écrire (déjà notre règle : `npm run charge`). |
| **Caisse hors ligne** : données chargées à l'ouverture de session, commandes gardées dans le navigateur (IndexedDB), resynchronisées ; **impossible d'ouvrir une nouvelle session hors ligne** ; des conflits entre copie locale et serveur signalés dans leur suivi de bugs | **On copie le principe**, en réglant d'avance ce qui a coûté à Odoo : série de tickets **propre à chaque caisse**, chaque vente **identifiée de façon unique à sa création** (jamais deux fois enregistrée), et la règle écrite de ce qui marche hors ligne (§ 4.5). |
| **Journal comptable scellé par une chaîne d'empreintes** (SHA-256, « restrictive audit trail », rapport d'inaltérabilité) | **On le copie, par défaut et partout** (§ 4.4). Chez Odoo c'est une option ; chez nous c'est la règle. |
| **Facture électronique par pays** dans un cadre commun (envois en file, reprises, suivi du statut) | **On le copie** pour la TTN, la TEJ, la CNSS (§ 5). |
| **Prix par utilisateur, intégrateur quasi obligatoire, support jugé lent** | **Notre opposé** : prix par entreprise, démarrage seul grâce aux visites, support tunisien. |

---

## 3. L'architecture en un schéma

```
 NAVIGATEUR (web)      APPLICATION DE BUREAU                         TÉLÉPHONE (navigateur)
 rien à installer      = la même application web dans une coque      devis, encaisser, photo,
                       + un « agent local » : clé USB de signature,  salle en vague 1 ;
                         imprimantes, tiroir, douchette              magasins d'applis : plus tard
        │                         │                                         │
        └──────── copie locale chiffrée + file d'envoi (hors ligne) ────────┘
                                  │  synchronisation (HTTPS)
┌─────────────────────────── SERVEUR SKANFACT (en Tunisie) ────────────────────────────┐
│  API publique — nos propres écrans passent par elle (les intégrations seront gratuites) │
│  Un seul programme serveur, rangé en modules : Ventes · Achats · Trésorerie ·          │
│  Déclarations · Pilotage · Stock · Caisse · Paie · Comptabilité · Cabinet · Groupe     │
│  Moteur de calcul tunisien (le même code que dans l'application) — c'est lui qui fait foi│
│  Comptes → organisations (groupe, cabinet) → entreprises → utilisateurs et droits      │
│  Journal inaltérable (chaîne d'empreintes) · piste d'audit                             │
│  File de travaux : envois TTN / TEJ / CNSS, PDF, rapports lourds, mails, sauvegardes   │
│  PostgreSQL (données) · stockage de fichiers (justificatifs, PDF, XML signés, 10 ans)  │
└──────────────────────────────────────────────────────────────────────────────────────┘
  (La liste complète des modules, dont Intégrations après le lancement : `docs/cadrage/02-modules.md` § 2.)
        │                    │                   │                    │
   TTN El Fatoora       TunTrust DigiGo      TEJ / e-jibaya /     Konnect (abonnements,
   (envoi, référence,   (signature à         CNSS (fichiers au    et factures payées
    QR code)             distance, OTP)       bon format)          par les clients)
```

---

## 4. Les choix techniques, un par un

### 4.1 Une seule application (web installable), pas deux

Une application web qui s'installe et fonctionne hors ligne. L'application de bureau est **la même**,
dans une coque, avec un **agent local** réservé à ce qu'un navigateur ne sait pas faire : la clé USB
de signature, l'imprimante thermique, le tiroir-caisse. Un seul code à écrire et à tester ; le web
n'est jamais en retard sur le bureau.

### 4.2 La base de données : partagée, isolée, et découpable

Trois façons de ranger les clients dans PostgreSQL :

| | Une base par client (Odoo, ERPNext) | Un schéma par client | **Tables partagées + identifiant d'entreprise + sécurité par ligne (RLS)** |
|---|---|---|---|
| Isolation | Maximale | Bonne | **Garantie par la base elle-même** (chaque requête ne voit que son entreprise) |
| Tient à 50 000 entreprises | Non sans gros outillage | Non (au-delà de quelques centaines, fichiers et maintenance explosent) | **Oui** |
| Mise à jour du schéma | Une par client | Une par client | **Une seule** |
| Exporter / restaurer UN client | Facile | Facile | **À outiller** (on l'écrit dès le départ) |

**Choix : tables partagées avec sécurité par ligne**, plus deux garde-fous :
- **un outil d'export et de restauration d'une seule entreprise**, écrit dès le socle (c'est aussi
  la promesse « tes données restent à toi ») ;
- **des « cellules »** : un groupe d'entreprises par serveur de base. Le jour où un serveur est plein,
  on en ouvre un second, sans rien réécrire (c'est ce que font les très gros, par groupes de clients).

Piège connu, écrit ici pour ne pas l'oublier : **le super-utilisateur de la base contourne la
sécurité par ligne** ; l'application ne se connecte jamais avec lui, et un test le vérifie.

### 4.3 L'argent en nombres entiers

Aujourd'hui, notre moteur calcule en nombres à virgule et arrondit au millime (`round3`). Ça tient
grâce à des milliers de tests, mais c'est la source classique d'erreurs dans un logiciel d'argent
(0,1 + 0,2 ≠ 0,3). **Dans la nouvelle base, tout montant est un entier en millimes** (en centimes
pour une devise à deux décimales), et chaque devise déclare son nombre de décimales. Le moteur
convertit à l'entrée et à la sortie. C'est un **point qui bloquerait plus tard** s'il n'était pas
décidé maintenant.

### 4.4 Le journal inaltérable

Chaque écriture validée, chaque facture émise, chaque ticket est scellé par une empreinte qui dépend
de la précédente. Modifier le passé casse la chaîne, et ça se voit. Une correction se fait par une
écriture de plus (contre-passation), **jamais en réécrivant** — c'est déjà notre règle depuis la 9.2.0.
C'est la base de la future caisse certifiée, de la confiance des comptables et d'un contrôle fiscal.

### 4.5 Ce qui marche pendant une coupure (et ce qui attend)

| Hors ligne | Au retour du réseau |
|---|---|
| Caisse (tickets, série propre à la caisse) | Envoi des tickets au serveur |
| Devis, brouillons, saisie comptable en brouillard | Validation définitive, numéro légal |
| Consultation de ce qui est déjà sur le poste | Mise à jour avec ce que les autres ont fait |
| Préparation d'une facture | **Numéro, signature, envoi à la TTN** (la TTN exige internet) |

La liste détaillée, qui fait foi, et les règles de conflit : `docs/cadrage/04-hors-ligne-et-synchro.md`.

Règles de synchronisation, choisies pour la comptabilité :
- **le serveur fait foi** ; le poste garde une **file d'envoi** de ses gestes ;
- chaque geste porte un **identifiant unique** : envoyé deux fois, il n'est enregistré qu'une fois ;
- **pas de fusion automatique « à la Google Docs »** (les CRDT sont faits pour du texte, pas pour une
  comptabilité) : une pièce validée existe ou pas ; deux modifications d'un même brouillon sont
  **gardées toutes les deux** et signalées (notre règle de la 9.9.0) ;
- un poste hors ligne garde ses droits **quelques jours au plus** ; un poste volé se **révoque** et
  s'efface à la reconnexion.

Modèle de référence pour la numérotation hors ligne : l'Arabie saoudite (ZATCA) — une série et un
compteur par caisse, chaque ticket chaîné au précédent, déclaration à l'administration dans les
24 heures. **À VÉRIFIER** : ce que la Tunisie exige pour la caisse certifiée.

Moteur de synchronisation : **à choisir pendant le cadrage** entre un moteur éprouvé qui s'appuie sur
PostgreSQL (PowerSync est le plus mûr en 2026 ; Zero et ElectricSQL sont les alternatives) et notre
propre file d'envoi. Critère : le serveur doit pouvoir **refuser** un geste (une clôture, un droit
manquant) — c'est exactement ce que font PowerSync et Zero. **Choisi le 28/09/2026 sur un prototype
mesuré** : notre propre chemin de lecture, avec notre file d'opérations ; PowerSync tient aussi les
seuils mais oblige à écrire nos droits une seconde fois, il reste le plan B
(`docs/cadrage/04-hors-ligne-et-synchro.md` § 9.4, `prototypes/synchro/`).

### 4.6 Un seul programme serveur, bien découpé

Pas de dizaines de petits services : **un programme, rangé en modules**, comme Odoo et comme Shopify.
Les travaux longs partent dans une **file de travaux** (envois TTN, PDF, rapports, mails,
sauvegardes). On découpera un module en service à part seulement si une mesure l'exige.

### 4.7 L'API d'abord

Nos écrans utilisent l'API que les intégrations utiliseront. Shopify, WooCommerce, les banques
viendront plus tard — mais l'API existera déjà, testée chaque jour par nos propres écrans.

### 4.8 Les outils

- **TypeScript** (JavaScript avec des types vérifiés) : sur deux ans et 100 000 lignes, il évite toute
  une famille de défauts que nos tests attrapent aujourd'hui trop tard.
- **Une vraie bibliothèque d'interface** : les 19 000 lignes de `src/renderer/app.js` en un seul bloc
  ne tiendront pas vingt modules.
- **On garde le moteur** (`core.js` et `compta.js`, ~17 500 lignes) **et ses tests** : c'est la vraie
  valeur du projet. Il est porté, pas réécrit.
- **Validé par Skander le 27/09/2026** (§ 9). Les outils précis (serveur, interface, migrations,
  file de travaux, synchronisation, PDF, mails) se choisissent dans `docs/cadrage/12-pile-technique.md`.

---

## 5. La signature électronique, l'ANCE et la TTN

Ce que la recherche a établi (sources dans `docs/etudes/ETUDE-MARCHE.md` et dans ce document) :

- La facture TEIF est signée en **XAdES** par un certificat qualifié (TunTrust, sous l'ANCE), puis
  envoyée à la TTN par un **service web (SOAP)** ; la TTN rend une **référence et un QR code**, à
  imprimer et à archiver **10 ans**.
- **DigiGo** (TunTrust) est une **signature à distance** : le certificat est gardé dans le coffre de
  TunTrust, chaque signature est autorisée par un **code reçu sur le téléphone**. Un éditeur peut
  l'intégrer par une **API**, après une **adhésion auprès de l'ANCE comme « entité d'intégration »**.
- Swiver a obtenu en septembre 2026 une **homologation ANCE** pour signer depuis son application.

Nos trois chemins, dans l'ordre :

1. **DigiGo intégré (le chemin principal)** : marche depuis le web, le bureau et plus tard le
   téléphone ; le client autorise avec le code reçu sur son téléphone ; aucune clé à brancher.
2. **Clé USB du client** (celle qu'il utilise déjà pour la CNSS) : signée par l'agent local de
   l'application de bureau ; la clé ne quitte jamais son poste.
3. **Signature par le serveur** après homologation ANCE, pour qui le demande et l'autorise (comme
   Swiver) — la clé serveur vit alors dans un **module matériel de sécurité**, jamais dans un fichier.

Dans les trois cas, le **serveur** envoie à la TTN, relance si la TTN ne répond pas (sans jamais
envoyer deux fois la même facture), garde le statut, imprime la référence et le QR code, et archive le
XML signé en stockage non modifiable pendant 10 ans.

**Les démarches** (elles prennent des semaines ; ordre et détail : `docs/cadrage/05-obligations-legales.md`
§ 5, et § 9 ci-dessous) : **dès maintenant**, l'adhésion ANCE « entité d'intégration » DigiGo,
l'accès de test El Fatoora et l'inscription comme fournisseur sur la plateforme d'homologation de la
**caisse enregistreuse certifiée** ; la déclaration INPDP **avant la première donnée réelle** d'un
client ; l'homologation ANCE de la signature serveur et celle de la caisse **en fin de
développement**. Chacune est **À VÉRIFIER** directement auprès de l'organisme.

---

## 6. Performances : les budgets écrits d'avance

Règle déjà appliquée au projet depuis la 9.1.0 : **on écrit le seuil avant de mesurer**, et une
mesure qui dépasse change le plan, pas le seuil.

| Geste | Budget |
|---|---|
| Ouvrir l'application (poste déjà synchronisé) | < 2 s |
| Afficher une liste, une fiche | < 300 ms côté serveur (95 % des requêtes) |
| Taper une ligne dans la grille de saisie | < 100 ms (local, sans attendre le serveur) |
| Encaisser un ticket à la caisse | < 200 ms, en ligne ou hors ligne |
| Balance, grand livre, TVA du mois d'une PME (10 ans d'historique) | < 1 s |
| Balance consolidée d'un cabinet de 60 dossiers | < 5 s |
| Rattrapage après une journée de coupure (un magasin) | < 1 min |
| Envoi d'une facture à la TTN | en file, résultat visible en moins d'une minute quand la TTN répond |

**Estimation de volume à valider par un test de charge** : une PME fait de l'ordre de quelques milliers
de pièces par an et quelques dizaines de milliers de lignes d'écriture ; un commerce avec caisse, des
dizaines de milliers de tickets. À 50 000 entreprises, les grandes tables (lignes d'écriture, tickets)
atteignent **le milliard de lignes** : elles seront **partitionnées** (par période) dès le départ, et
les cellules du § 4.2 répartissent la charge. Un serveur bien dimensionné devrait tenir **plusieurs
milliers de PME** ; le chiffre exact se mesure, il ne se devine pas.

---

## 7. Ce qui pourrait nous bloquer — et la parade décidée maintenant

| # | Risque | Parade |
|---|---|---|
| R1 | Arrondis faux dans un logiciel d'argent | Montants en entiers (§ 4.3) ; invariants « deux chemins, un chiffre » gardés |
| R2 | Un client voit les données d'un autre | Sécurité par ligne dans la base + tests qui essaient de lire l'entreprise d'à côté |
| R3 | Base trop grosse, requêtes lentes | Partitionnement dès le départ, cellules, budgets mesurés à chaque version |
| R4 | Numérotation légale cassée par le hors ligne | Séries par caisse ; numéro de facture donné par le serveur ; à VÉRIFIER auprès d'un comptable |
| R5 | Double envoi d'une facture à la TTN | Identifiant unique par envoi ; file avec reprise ; statut suivi |
| R6 | Signature bloquée par une démarche administrative | Démarches lancées pendant le cadrage ; trois chemins de signature |
| R7 | Mises à jour qui cassent les personnalisations (le mal d'Odoo) | Points d'extension déclarés ; personnalisation par champs, pas par code |
| R8 | Perte de données (panne, erreur, rançongiciel +140 % en Tunisie) | Sauvegarde continue de la base (restauration à la minute près), copie chiffrée hors du serveur, **exercice de restauration réel chaque mois** |
| R9 | Hébergement tunisien sans base de données gérée | **Décidé le 27/09/2026 : tout en Tunisie.** On exploite donc nous-mêmes, très outillé (réplique, surveillance, alertes, restauration mensuelle) |
| R10 | Obligations légales découvertes trop tard (INPDP, audit de cybersécurité ANCS pour un hébergeur, caisse certifiée) | Liste « À VÉRIFIER » traitée pendant le cadrage, avec un juriste |
| R11 | Une seule personne pour tout faire (support, incidents, ventes) | Architecture la plus simple qui tient ; surveillance automatique ; prévoir un humain pour le support avant le lancement |
| R12 | L'arabe demandé plus tard | Textes traduisibles et mise en page « sens de lecture » dès le départ (déjà commencé : CSS logique depuis la 9.4.10) |
| R13 | Dates et fuseaux horaires | Déjà une règle du projet (5.2.3) : une date est un jour du calendrier, arithmétique en UTC |
| R14 | Les 3 comptables pilotes attendent (2 mois annoncés) | Leur faire tester l'application actuelle pendant la construction, et le socle serveur dès qu'il tient |
| R15 | Les données actuelles des utilisateurs | Outil de reprise des fichiers JSON et des livres du Cabinet vers le serveur, testé sur l'exemple de 5 ans |
| R16 | Piratage et copie | La valeur est sur le serveur (données, sauvegardes, comptable, TTN). Dépôts publics pour l'instant (décision du 27/09/2026) ; où vivra le code du serveur : `docs/cadrage/12-pile-technique.md` |

---

## 8. Les limites qu'on accepte

- Pas d'édition **simultanée** d'une même pièce par deux personnes (un brouillon est tenu par une
  personne ; l'autre voit qu'il est ouvert).
- Pas de microservices, pas de Kubernetes au départ.
- L'application **des magasins** (App Store, Google Play) vient après le lancement ; les écrans du
  quotidien marchent sur téléphone, dans le navigateur, **dès le lancement** (revu le 28/09/2026,
  `docs/cadrage/14-fonctions-et-integrations.md` § 2.6).
- Les intégrations de boutiques en ligne, de livraison et d'autres paiements viennent **après** le
  lancement, dans l'ordre du `14` § 4 ; l'**API publique** (clés comprises), Konnect et les
  obligations sont là au lancement (revu le 28/09/2026). Pas de connexion bancaire directe : aucune
  banque tunisienne n'en ouvre.
- Pas de promesse « tout marche hors ligne » : la liste du § 4.5 fait foi, et l'écran le dit.

---

## 9. Décisions qui reviennent à Skander

**Décidé le 27/09/2026 :**
- **Hébergement en Tunisie**, copie de secours comprise (un second centre de données tunisien) : pas
  de transfert de données à l'étranger. La **déclaration du traitement** auprès de l'INPDP reste à
  faire (**À VÉRIFIER**) ; seule l'autorisation de transfert disparaît.
- **Budget accepté** (ordres de grandeur ci-dessous).
- **Les démarches sont lancées par le père de Skander.** Trois d'entre elles partent **dès
  maintenant**, pour être prêtes pendant le développement, parce que le code en a besoin pour être
  testé : l'**accès à l'environnement de test El Fatoora (TTN)**, l'**adhésion « entité
  d'intégration » DigiGo auprès de l'ANCE**, et (**décidé le 28/09/2026**, `docs/cadrage/05-obligations-legales.md`
  § 3.7) l'**inscription comme fournisseur sur la plateforme d'homologation des caisses** avec le
  cahier des charges, puisque la caisse s'y raccorde par des tests d'intégration. La déclaration INPDP
  se fait avant la première donnée réelle d'un client (pilotes compris) ; l'homologation ANCE de la
  signature serveur et l'homologation de la caisse, en fin de développement.

- **TypeScript et une bibliothèque d'interface : validés.** Les règles « JS pur » et « stockage
  JSON » de `CLAUDE.md` valent pour l'application actuelle ; la nouvelle plateforme suit ce document.

**Ordres de grandeur du budget** (acceptés le 27/09) : ~1 000 DT/mois de fonctionnement au
lancement, 10 000 à 20 000 DT de frais uniques (certificats, juriste, audit de sécurité). **Affinés
le 28/09** dans `docs/cadrage/09-feuille-de-route.md` § 4 : 800 à 1 650 DT par mois (la lecture de
documents en Tunisie ajoute un serveur) et 12 500 à 26 000 DT de frais uniques connus, matériel de
caisse compris, sans les frais encore inconnus des démarches.

**Décidé le 28/09/2026, par délégation de Skander** (révisable après les entretiens) :
- Essai de 30 jours ; **Essentiel 390 DT/an**, **Complet 690 DT/an** ; le cabinet est gratuit pour
  ses clients abonnés et pour trois dossiers tenus, puis 60 DT par dossier, plafonné à 1 990 DT
  (`docs/cadrage/07-offres-et-prix.md`).
- Code de connexion sur le téléphone obligatoire pour les comptables, les propriétaires, les
  administrateurs et la paie ; les rôles ; un **code cabinet** au lieu d'un annuaire ; le passage de
  la v10 sans rien forcer (`docs/cadrage/00-les-trois-parcours.md`).
- Tiers et articles propres à chaque société, partage possible dans un groupe ; plusieurs
  établissements dès le départ ; fin de mandat d'un cabinet (`docs/cadrage/01-modele-de-donnees.md`).
- **S'aligner sur Hesabi, et aller plus loin** (demande de Skander, 28/09/2026 ;
  `docs/cadrage/14-fonctions-et-integrations.md`) : tout ce que Hesabi annonce est au lancement,
  plus l'espace client et le paiement en ligne des factures, la lecture de documents sur nos
  serveurs, le cabinet complet, l'API, le téléphone ; les commerces au lancement ;
  **quatre vagues** après (trois au départ, quatre depuis la relecture du 28/09 : `09` § 1), puis
  **l'hôtellerie à la fin** et **l'arabe plus tard, l'infrastructure maintenant** (deux décisions
  de Skander). Lancement à 25 mois après le premier code (28 avec la
  marge) ; Essentiel comprend le stock et une caisse.
- **Slate, l'application pour restaurateurs de Skander, devient la partie restaurant de SkanFact**
  (décision de Skander, 28/09/2026 ; `docs/cadrage/15-reprise-de-slate.md`), **en vague 1**, une
  fois l'entreprise, le cabinet et la console stables : plan de salle, réservations, service du
  jour et mode restaurant de la caisse, sur nos serveurs en Tunisie. La partie restaurant reste **en
  français seulement** (décision de Skander, 28/09/2026).

## 10. La suite du cadrage

La liste des documents, leur ordre et leur état vivent dans `docs/cadrage/README.md` (un seul
endroit, pour qu'ils ne divergent pas). En parallèle : les entretiens terrain (questionnaire en
annexe de `docs/etudes/ETUDE-MARCHE.md`) et les trois démarches qui servent pendant le
développement (accès test El Fatoora, adhésion DigiGo, inscription à la plateforme d'homologation
des caisses), plus le label Startup dès que la société qui porte SkanFact est choisie
(`docs/cadrage/05-obligations-legales.md` § 4.8).

---

## 11. Ce qu'on risquait d'oublier (relu le 27/09/2026)

**À traiter pendant le cadrage**
1. **L'application actuelle vit encore deux ans.** Ses utilisateurs (et les trois comptables) ont
   besoin des corrections et des changements des **lois de finances 2027, 2028 et 2029** (revu le
   28/09/2026 avec le calendrier du `09`). On prévoit un
   temps d'entretien réservé, sans nouvelles fonctions.
2. **Reprendre les données des concurrents** : Excel, Sage, Ciel, Hesabi… Personne ne change de
   logiciel s'il doit tout retaper. C'est un argument de vente autant qu'un outil.
3. **La langue arabe** : interface et, surtout, pièces bilingues arabe/français si des clients ou
   l'administration les demandent (**À VÉRIFIER** avec les entretiens). **Décidé le 28/09/2026** :
   l'infrastructure dès la première ligne, l'interface en arabe dans la première vague après le
   lancement (`docs/cadrage/14-fonctions-et-integrations.md` § 5).
4. **Le rythme de développement dépend du quota Claude** : 25 à 28 mois (revu le 28/09/2026,
   `docs/cadrage/09-feuille-de-route.md`) supposent un usage quotidien ; le budget doit l'inclure.
5. ~~**Un `CLAUDE.md` neuf pour la nouvelle plateforme.**~~ **Fait le 27/09/2026** : le fichier
   garde les règles ; le récit est dans `docs/application-actuelle/CLAUDE-HISTORIQUE.md`.

**À traiter avant le lancement**
6. **Nos propres factures sont électroniques** : SkanFact vend des abonnements à des entreprises
   tunisiennes, donc émet lui-même des factures TEIF signées via la TTN. Et **aucun prélèvement
   automatique** n'existe en Tunisie : prévoir le renouvellement, les relances et la coupure douce.
7. **Nous devenons « sous-traitant » des données de nos clients** : contrat de traitement, conditions
   générales, politique de confidentialité, droit d'accès et de suppression — face à l'obligation de
   garder les pièces **10 ans**. Règle proposée : un client qui arrête garde un **accès en lecture et
   l'export complet** ; rien n'est effacé avant la fin de la durée légale sans sa demande écrite.
8. **Responsabilité en cas d'erreur de calcul** : clause de limitation dans les conditions, et une
   **assurance responsabilité civile professionnelle** (**À VÉRIFIER** avec un assureur).
9. **Dépôt de la marque SkanFact** (INNORPI) : **dès que la société est choisie** (revu le
   28/09/2026 : le nom est déjà public).
10. **Réversibilité** : l'engagement écrit que le client récupère toutes ses données dans un format
    ouvert, et ce qui se passe si SkanFact s'arrête (le « pli scellé » existe déjà côté licences).
11. **L'exploitation** : environnements de test et de production séparés, mises à jour sans
    coupure, surveillance et alertes, page d'état du service, **exercice de restauration mensuel**.
12. **Un audit de sécurité externe** (test d'intrusion) avant d'ouvrir le serveur au public.
13. **Le support** : canal (WhatsApp Business, e-mail), horaires, délais de réponse ; un humain avant
    le lancement.
14. **Mesurer l'usage** (quels écrans servent, où l'on bloque), avec l'accord des clients et sans
    jamais lire leurs données.
15. **Le label Startup Act** : avantages fiscaux et financement possibles (**À VÉRIFIER** ; ce qu'on
    en sait : `docs/cadrage/05-obligations-legales.md` § 4.8).

---

## 12. La console d'administration et le site (ajouté le 27/09/2026)

*Décidé le 27/09/2026 : une seule session Claude écrit le produit, la console ET le site
(dépôt `saouthq/skanfact-site`). La console doit devenir « un meilleur système ».*

### Ce que la console fait aujourd'hui, et pourquoi ça ne suffira pas

Aujourd'hui la console est un worker Cloudflare avec une base D1 (`plateforme/`). Elle signe et
révoque des **clés de licence hors ligne**, suit les postes qui s'annoncent, les ventes, les commandes
Konnect, les prospects, la santé des canaux de mise à jour, et garde un export et un pli scellé.
C'est le bon outil pour une application qu'on installe sur chaque ordinateur.

Trois choses changent avec la nouvelle plateforme :
1. **Plus de clé de licence** : l'entreprise a un **abonnement** sur le serveur. Ce qu'elle a payé,
   les modules ouverts et la date de fin se lisent au même endroit que ses données.
2. **La console gère des clients vivants**, et plus seulement des clés. Elle voit les entreprises,
   leurs abonnements, leurs factures, l'état du service. Et, quand le client l'a accepté, elle ouvre
   son dossier pour l'aider.
3. **Ses données sont personnelles** (noms, e-mails, matricules des clients). Elles suivent la
   décision d'hébergement : en Tunisie. La D1 actuelle est chez Cloudflare, hors de Tunisie :
   **À VÉRIFIER** pour l'application actuelle, et à ne pas reconduire.

### Ce que la nouvelle console doit faire (cible, à détailler en `docs/cadrage/10-console.md`)

| Domaine | Ce qu'elle permet |
|---|---|
| Clients | Organisations, entreprises, cabinets ; fiche complète ; historique commercial ; parrainage d'un cabinet |
| Abonnements | Offres, modules, essai, renouvellement sans prélèvement (relances, coupure douce, lecture seule), avoirs et remboursements |
| Nos factures | Émises en TEIF, signées, envoyées à la TTN par le même moteur que celui des clients (§ 11, point 6) |
| Paiement | Konnect, virement, chèque ; rapprochement ; relances |
| Support | Tickets, WhatsApp et e-mail rattachés au client. Accès au dossier d'un client **en lecture, seulement avec son accord, limité dans le temps et tracé**, avec le nom de la personne qui l'ouvre |
| Service | Santé des serveurs, file de travaux, envois TTN/CNSS en échec, sauvegardes et exercice de restauration, incidents, page d'état publique |
| Mesure | Usage par écran et blocages (§ 11, point 14), **sans jamais lire le contenu** ; entonnoir essai → client ; départs |
| Équipe | Plusieurs comptes (Skander, son père, support) avec des rôles ; double authentification obligatoire ; journal de chaque geste |
| Application actuelle | Tant qu'elle vit, la console garde les licences hors ligne et la reprise des utilisateurs vers la plateforme |

**Règle d'architecture** : la console est un **module du même serveur** (même base, même code
métier). Elle a sa propre porte d'entrée (adresse, connexion et rôles séparés). Elle n'a **aucun**
passe-droit sur la sécurité par ligne. Chaque accès aux données d'une entreprise passe par une
fonction qui vérifie l'accord et écrit la trace.

### Le site (`skanfact-site`)

- Il reste **statique** : rapide, bien référencé, et il ne tombe pas si le serveur tombe. Il est
  hébergé à part du produit.
- Il devient la porte d'entrée : présentation, tarifs, **inscription** (qui crée l'essai sur la
  plateforme), centre d'aide (les mêmes articles que dans l'application), page d'état du service,
  pages légales (conditions, confidentialité, contrat de traitement), et reprise des données
  (Excel, concurrents).
- **Il ne vend rien qui n'existe pas encore.** Jusqu'au lancement, il continue de présenter
  l'application actuelle. La nouvelle offre n'y paraît que lorsqu'elle est livrable ; ses tarifs sont ceux
  de `docs/cadrage/07-offres-et-prix.md`. D'ici là, le site annonce ceux de l'application actuelle
  (`docs/application-actuelle/TARIFS-REFERENCE.md`).

## Sources de la recherche technique (27/09/2026)

- Odoo, sizing et multi-client : [Odoo 19 — System configuration](https://www.odoo.com/documentation/19.0/administration/on_premise/deploy.html), [How many Odoo workers (Skysize)](https://www.skysize.io/blog/guides-5/how-many-odoo-workers-do-you-need-35), [Odoo multi-tenant (OEC.sh)](https://oec.sh/blog/odoo-multi-tenant-architecture)
- Odoo, performances : [Hidden performance killers (SGEEDE)](https://sgeede.com/blog/sgeede-knowledge-4/hidden-performance-killers-in-odoo-what-most-developers-dont-notice-193), [Odoo slow — diagnose (DeployMonkey)](https://deploymonkey.com/blog/fix-odoo-slow-performance), [Forum Odoo — huge data](https://www.odoo.com/forum/help-1/reason-why-odoo-being-slow-when-there-is-huge-data-inside-the-database-87498)
- Odoo, caisse hors ligne : [Forum — POS offline mode](https://www.odoo.com/forum/help-1/how-is-the-point-of-sale-offline-mode-working-218314), [Issue #189836 — IndexedDB en conflit](https://github.com/odoo/odoo/issues/189836), [PR #288974 — garder les commandes hors ligne](https://github.com/odoo/odoo/pull/288974)
- Odoo, inaltérabilité : [Data inalterability check report (Odoo 19)](https://www.odoo.com/documentation/19.0/applications/finance/accounting/reporting/data_inalterability.html), [PR #36304 — hash sur account.move](https://github.com/odoo/odoo/pull/36304)
- ERPNext : [Frappe — multitenancy](https://docs.frappe.io/framework/user/en/bench/guides/setup-multitenancy), [Scaling ERPNext (livre blanc)](https://erpnext.com/files/Scaling%20ERPNext.pdf)
- Multi-client sur PostgreSQL : [PlanetScale — approaches to tenancy](https://planetscale.com/blog/approaches-to-tenancy-in-postgres), [RLS vs schema-per-tenant (dev.to)](https://dev.to/itsjayanth/multi-tenant-postgresql-row-level-security-vs-schema-per-tenant-when-to-use-which-3joe)
- Synchronisation : [ElectricSQL vs PowerSync](https://powersync.com/blog/electricsql-vs-powersync), [ElectricSQL vs PowerSync vs Zero 2026](https://trybuildpilot.com/648-electric-sql-vs-powersync-vs-zero-2026)
- Argent en entiers, grand livre : [Divvy — building a ledger](https://blog.divvyhomes.com/building-your-own-ledger-system-pointers-and-pitfalls/), [Fintech engineering handbook](https://w.pitula.me/fintech-engineering-handbook/)
- Caisse hors ligne réglementée (modèle) : [Dynamics 365 — factures simplifiées Arabie saoudite](https://learn.microsoft.com/en-us/dynamics365/commerce/localizations/mea/emea-sau-simplified-e-invoices), [POS integration with ZATCA](https://invoiceq.com/en/e-invoicing-articles/pos-integration-with-zatca/)
- Signature et TTN : [TunTrust — DigiGo](https://www.tuntrust.tn/fr/solutions/digigo), [Certificats numériques en Tunisie 2026 (Noqta)](https://noqta.tn/en/blog/certificat-numerique-tunisie-tuntrust-ance-2026), [Intégration ERP et TTN/TEIF](https://www.elfatoora.digital/integration-erp-facture-electronique-tunisie.php?lang=en), [VATupdate — El Fatoora 2026](https://www.vatupdate.com/2026/01/01/tunisia-2026-electronic-invoicing-el-fatoora-ttn-compliance-guide-for-service-providers/)
- Hébergement, INPDP, coupures, cybersécurité : notes `docs/etudes/notes-de-recherche/marche-2026/hebergement_technique.md` et `cadre_legal.md`.

*Limite honnête : plusieurs sites (notamment digigo.tuntrust.tn et les sites officiels tunisiens) sont
bloqués depuis l'environnement de travail ; ces points viennent de résumés de recherche et restent
À VÉRIFIER à la source.*
