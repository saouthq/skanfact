# 10 — La console

*Proposé le 28/09/2026. **À valider par Skander.** Détaille `VISION-ARCHITECTURE.md` § 12 et le
parcours « Je suis Skander » (`00` § 3). Ses tables sont au `01` § 18 (schéma `plateforme`), ses rôles
au `03` § 5, sa sécurité au `06`. Elle reprend ce qui marche dans la console actuelle
(`plateforme/`, versions 10.4.0 à 10.9.0).*

## En bref (pour Skander)

La console, c'est **ton bureau** : `console.skanfact.tn`. Tu y gères les clients, leurs abonnements,
nos factures, le support et la santé du service. Elle ne sert **qu'à l'équipe SkanFact**.

Trois règles :
1. **Elle s'ouvre sur ce qui demande une décision**, comme aujourd'hui (« À décider », 10.4.0). Chaque
   ligne mène à l'écran qui la règle. Une alerte qu'on ne peut pas ouvrir est une inquiétude, pas une
   tâche.
2. **Elle n'a aucun passe-droit sur les données des clients.** Elle voit les comptes, les abonnements
   et les factures SkanFact. Elle ne voit **jamais** le contenu d'un dossier (factures du client,
   salaires, comptabilité), sauf avec l'accord du client, en lecture, pour 48 heures au plus (`03` § 5).
3. **Chaque geste demande une confirmation et laisse une trace** : qui, quand, quoi, pourquoi.

---

## 1. Qui entre, et comment

| Rôle (`03` § 5) | Écrans |
|---|---|
| **Direction** (Skander, son père) | Tous |
| **Support** | À décider, Clients, Support, Abonnements (gestes simples : prolonger un essai, offrir un mois) |
| **Technique** | Service seulement |

- Une adresse à part (`console.skanfact.tn`), une connexion à part, **le code sur le téléphone
  obligatoire**, et seulement sur un **appareil reconnu** (`03` § 6, `06` § 3).
- La console est un **module du même serveur**, avec la même base et le même moteur (vision § 12). Ses
  tables vivent dans le schéma `plateforme` (`01` § 18). Elle n'a **aucun** passe-droit sur la
  sécurité par ligne. Chaque accès aux données d'une entreprise passe par une fonction qui vérifie
  l'accord et écrit la trace.

---

## 2. Les écrans

### 2.1 À décider (l'écran d'accueil)

Ce qui demande une action, **le plus urgent en haut**, chaque ligne avec son bouton « Ouvrir » :

| Ligne | Ouvre |
|---|---|
| Un incident en cours, une alerte du service (sauvegarde manquée, chaîne cassée, TTN en échec) | Service |
| Une demande de support sans réponse depuis plus de 24 heures | Support |
| Un paiement reçu par virement à pointer | Paiements |
| Un abonnement échu, en grâce ou passé en lecture seule cette semaine | Abonnements |
| Un essai qui se termine dans 3 jours sans avoir été utilisé | Clients (pour appeler) |
| Une facture SkanFact refusée par la TTN | Nos factures |
| Un exercice de restauration raté, ou plus lent que l'objectif (`06` § 4.1) | Service |
| Une loi de finances publiée mais pas encore relue (`05` § 7) | Réglages |
| Un **accès d'urgence** à la base ouvert (`06` § 6) | Service |

**Une console où rien ne se passe affiche une liste vide**, et le dit. Elle n'invente pas de travail.

### 2.2 Le tableau du matin

Au-dessus d'« À décider », une bande de chiffres, **chacun calculé par la même fonction que l'écran
qu'il ouvre** (règle du projet : un compteur et la liste qu'il annonce viennent de la même fonction) :
- inscriptions de la semaine, essais en cours, essais transformés ;
- abonnements actifs, par offre ; revenus du mois (encaissés, pas facturés) ;
- demandes de support ouvertes ;
- état du service (vert **seulement** si tout ce qui est mesuré l'est : une mesure qui manque
  s'affiche « non mesuré », jamais « vert », comme la santé des canaux de la 10.4.0).

### 2.3 Clients

Une ligne par **organisation** (une entreprise seule, un groupe, un cabinet). La fiche d'un client :
- ses **entreprises**, leur matricule, leurs établissements ;
- son **abonnement** : offre, modules, options, état, échéance, prix fondateur, remise (`07`) ;
- ses **factures SkanFact** et ses **paiements** ;
- son **cabinet** (mandat, parrainage) ; pour un cabinet, ses dossiers tenus et ses clients abonnés ;
- ses **demandes de support** et nos échanges ;
- ses **membres** : noms et rôles seulement, pour savoir à qui parler ;
- le **journal** de tout ce que la console a fait pour lui.

**Ce que la fiche ne montre jamais** : le contenu de ses dossiers (`03` § 5). Elle peut montrer des
**comptes** qui ne révèlent rien (« 1 240 pièces émises cette année, 3 utilisateurs, dernière
connexion hier »), parce qu'ils servent au support et à la mesure. Leur liste est **fermée et
décidée** (§ 4).

### 2.4 Abonnements

Les gestes de `00` § 3, chacun avec **confirmation, motif et trace** :

| Geste | Qui | Ce qui se passe |
|---|---|---|
| Prolonger un essai | Support, Direction | De 7 à 30 jours, une fois par entreprise sans l'accord de la direction |
| Offrir un mois | Support, Direction | Un **avoir** sur la prochaine facture, jamais une facture effacée (`01` R6) |
| Ajouter ou retirer un module, changer d'offre | Direction | Prorata calculé et montré **avant** ; la facture ou l'avoir part tout seul |
| Passer en lecture seule, réactiver | Direction | Jamais de données en otage : la lecture et l'export restent (`07`) |
| Résilier | Direction | Idem ; les données sont gardées selon le `05` § 3.8 |
| Rembourser | Direction | Un avoir, puis le remboursement, rapproché comme un paiement (10.9.0 : trop-perçu) |

**Les relances** partent toutes seules : **15 jours, 7 jours et la veille** de l'échéance, puis **7
jours de grâce** avant la lecture seule (`07`). Aucun prélèvement automatique : chaque échéance se
paie en un clic (Konnect) ou par virement.

### 2.5 Nos factures

SkanFact est **une entreprise de sa propre plateforme** (`01` § 18). Nos factures sont des pièces de
vente de l'entreprise « SkanFact », émises par le même moteur, signées, envoyées à la TTN (`05` § 4.1)
et comptabilisées de la même façon. La console ne les **refait** pas : elle **montre** celles de
l'entreprise SkanFact et en déclenche l'émission à chaque renouvellement. Skander tient sa gestion
dans `app.skanfact.tn`, comme n'importe quel client, et son comptable la voit par son mandat (`00`
§ 3).

### 2.6 Paiements

- **Konnect** : reconnu tout seul, avec la **preuve reposée au prestataire** (10.9.0 : on ne croit pas
  une page de retour, on redemande à Konnect).
- **Virement, chèque** : pointés d'un geste, rapprochés de la facture ; le trop-perçu est gardé et
  proposé en remboursement (10.9.0, P1 bis).
- **Retenue à la source** faite par un client sur notre facture : si le `05` § 4.2 la confirme, le
  paiement est accepté **net de retenue**, et l'attestation est réclamée au client.

### 2.7 Support

- Une demande arrive par **e-mail** ou **WhatsApp** et se range sur la fiche du client.
- **L'accès au dossier** : bouton « Demander l'accès », avec un motif. Le client accepte dans son
  application. L'accès est **en lecture seule**, dure **48 heures au plus**, **chaque page lue est
  tracée**, et le client voit ces lectures (`03` § 5). La console affiche le temps qui reste, et
  l'accès se ferme tout seul.
- **Réponses types** et **articles d'aide** : les mêmes que dans l'application et sur le site (`11`),
  une seule source.

### 2.8 Service

La santé de la plateforme (`06` § 7) sur un seul écran :
- disponibilité et temps de réponse, par rapport aux budgets de la vision § 6 ;
- file de travaux ; **envois à la TTN, TEJ et CNSS en échec**, par client, avec relance possible
  (sans jamais envoyer deux fois, vision R5) ;
- sauvegardes, réplication vers le site de secours, **exercice de restauration du mois** et son temps
  mesuré (`06` § 4.3) ;
- **chaîne d'empreintes** (contrôle quotidien) ;
- accès d'urgence ouverts (`06` § 6) ;
- **incidents** : ouvrir, suivre, publier sur la **page d'état** publique, clore avec le compte rendu
  (`06` § 9).

### 2.9 Mesure

L'usage de la plateforme (vision § 11, point 14), **sans jamais lire le contenu** :
- quels écrans servent, où l'on s'arrête, quels refus reviennent le plus (`03` D2 : un refus qui
  revient souvent est un écran mal fait) ;
- l'entonnoir : inscription, essai utilisé, abonnement ; les départs et leurs motifs déclarés ;
- par **offre** et par **module**, jamais par client nommé.
- **la liste des événements mesurés est écrite et comptée avant la première mesure** (règle du
  projet : jamais une donnée de plus sans liste décidée) ; un événement qui n'y est pas n'est pas
  envoyé, et un test le vérifie.

### 2.10 Équipe

Les membres de l'équipe, leur rôle, leurs appareils, et **le journal de chaque geste** de chacun.
Code sur le téléphone obligatoire pour tous (`00`).

### 2.11 Réglages de la plateforme

| Réglage | Règle |
|---|---|
| **Offres, modules, prix** | **Datés** : un nouveau prix ne touche jamais une période déjà payée (`01` § 18). Changer un prix demande l'accord de Skander (règle du projet) |
| **Règles fiscales** d'une loi de finances | Écrites avec leur **texte de loi** et leur **date d'effet**, puis **relues par un comptable** avant publication (`05` § 7). La console montre qui a écrit et qui a relu |
| **Formats officiels** (TEIF, TEJ, CNSS, liasse, caisse) | Versions et dates de validité (`format_officiel`, `01` § 3) |
| **Messages aux clients** | Nouveautés, maintenance prévue, incident : affichés dans l'application, datés, jamais plus d'un à la fois |
| **Drapeaux** | Allumer une nouveauté pour des entreprises volontaires (`02` § 7) |

### 2.12 Application actuelle

Tant que la v10 vit (`08` § 5) :
- ses **licences** hors ligne (émission, révocation, activations), comme aujourd'hui ;
- son **parc** (postes, versions, canaux de mise à jour) ;
- le suivi des **passages à la plateforme** (`08` § 2).

---

## 3. Les règles de la console

**C1. Chaque geste qui change quelque chose demande une confirmation, un motif, et laisse une
trace.** Le journal se filtre par client, par geste, par personne et par période (comme aujourd'hui).

**C2. Rien n'est jamais « vert » sans mesure.** Une mesure absente se dit « non mesuré », avec la
raison (10.4.0).

**C3. Un chiffre de la console et l'écran qu'il ouvre disent la même chose**, calculés par la même
fonction.

**C4. La console ne refait pas ce que la plateforme fait déjà.** Nos factures sont celles de
l'entreprise SkanFact, les articles d'aide sont ceux de l'application, les règles fiscales sont
celles du moteur.

**C5. Les montants s'affichent comme dans l'application** : devise, millimes, jamais un nombre brut
(vérification de la v10 : « aucun 250 brut »).

**C6. Les gestes dangereux sont réservés à la direction** et prévenus (même règle que `03` § 7) : un
prix changé, un remboursement, un accès d'urgence, une résiliation.

---

## 4. Ce que la console a le droit de savoir d'un client

Règle du projet : **jamais une donnée de plus sans que la liste soit comptée et décidée.** Voici la
liste, fermée :

| Donnée | Pourquoi |
|---|---|
| Nom de l'organisation et des entreprises, matricule, adresse, téléphone et e-mail de contact | Facturer, joindre |
| Offre, modules, options, états, échéances, paiements, factures SkanFact | Gérer l'abonnement |
| Membres : nom, e-mail, rôle, dernière connexion | Savoir à qui parler, compter les utilisateurs (`03` § 4.1) |
| **Comptes** : pièces émises par mois, salariés comptés, caisses, établissements, place occupée | Facturer les options (`07`), dimensionner le service |
| Demandes de support et nos réponses | Le support |
| Mesures d'usage **sans contenu** (§ 2.9) | Améliorer le produit |

Tout ce qui n'est pas dans cette table (un nom de client du client, un montant, un salaire, une
ligne de facture) **ne remonte jamais** dans la console. La seule exception est l'accès accordé par
le client (§ 2.7). Un test vérifie que les écrans de la console ne lisent que ces colonnes.

---

## 5. Ce qu'on reprend de la console actuelle, et ce qui change

| Console actuelle (`plateforme/`, Cloudflare D1) | Nouvelle console |
|---|---|
| « À décider », chaque ligne avec « Ouvrir » (10.4.0) | Repris (§ 2.1) |
| Clients, licences, activations, ventes, commandes Konnect, prospects, journal | Clients, abonnements, paiements, journal ; les **prospects** deviennent des essais sur la plateforme |
| Parc des postes, cabinets, santé des canaux | Parc de la v10 (§ 2.12) tant qu'elle vit ; santé du service (§ 2.8) |
| Émission d'une clé, facture et mail | Plus de clé : l'abonnement vit sur le serveur ; nos factures sortent de l'entreprise SkanFact |
| Export de la base et pli scellé | Remplacés par les sauvegardes du serveur (`06` § 4) ; le pli scellé est étendu au serveur (`06` § 9.3) |
| Base chez Cloudflare, **hors de Tunisie** (vision § 12) | En Tunisie, dans le schéma `plateforme`. Les données personnelles de la D1 (prospects, acheteurs) y sont **reprises puis effacées** de la D1. La D1 ne garde que les licences v10 tant qu'elle vit (**À VÉRIFIER** : `05` § 4.3) |
| Un secret d'administration unique | Un compte par personne, un rôle, le code sur le téléphone |

---

## 6. À VÉRIFIER

1. **La D1 actuelle** (hors de Tunisie) : ce qu'elle contient de personnel, et le calendrier pour
   l'en vider (`05` § 4.3).
2. **Le canal WhatsApp du support** : WhatsApp Business et ses conditions ; où passent les messages
   (hors de Tunisie ?), à compter dans les flux (`05` § 4.3).

## 7. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | La console s'ouvre sur « À décider » ; chaque ligne ouvre l'écran qui la règle ; rien n'est vert sans mesure |
| 28/09/2026 (proposé) | Trois rôles (direction, support, technique) ; code sur le téléphone et appareil reconnu obligatoires |
| 28/09/2026 (proposé) | La liste de ce que la console sait d'un client est fermée (§ 4) ; le contenu d'un dossier n'y remonte jamais, sauf accès accordé par le client |
| 28/09/2026 (proposé) | Chaque geste confirmé, motivé et tracé ; un mois offert est un avoir, jamais une facture effacée |
| 28/09/2026 (proposé) | Nos factures sont celles de l'entreprise SkanFact sur la plateforme ; la console ne refait ni factures, ni aide, ni règles |
| 28/09/2026 (proposé) | Les données personnelles de la D1 actuelle sont reprises en Tunisie puis effacées de la D1 |
