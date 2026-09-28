# 02 — Les modules

*Proposé le 28/09/2026, relu le même jour contre tout le dépôt. **Validé le 28/09/2026**, après la
relecture demandée par Skander. Suit `VISION-ARCHITECTURE.md` (§ 4.6 et § 4.7),
`01-modele-de-donnees.md` et `07-offres-et-prix.md`. **Complété le même jour, après validation**,
pour suivre `14-fonctions-et-integrations.md` (l'alignement sur Hesabi, les métiers, les
intégrations) : le tableau des modules, les événements, les fournisseurs et le § 11. Ces ajouts sont
**à revalider**.*

## En bref (pour Skander)

SkanFact sera rangé comme Odoo : **un socle commun et des modules**. On peut vendre, activer ou
masquer un module sans toucher aux autres. La différence avec Odoo tient à une règle : **un module ne
modifie jamais l'intérieur d'un autre.** Il utilise seulement les **points de branchement** que
l'autre a prévus. Chez Odoo, un module peut réécrire l'intérieur d'un autre, et c'est ce qui rend
ses mises à jour pénibles chez ses clients : on l'évite dès le départ.

Ce document dit :
1. **quels modules existent**, ce que chacun contient, et de quoi il dépend (§ 2) ;
2. **les règles** qu'un module respecte (§ 3) ;
3. **les points de branchement** entre modules (§ 4) ;
4. **les champs personnalisés**, pour qu'un client adapte SkanFact sans une ligne de code (§ 5) ;
5. comment un module s'**active**, se **désactive**, se **met à jour** (§ 6 et § 7) ;
6. la place du **cabinet** : ce qu'il fait pour son client ne se facture pas au client (§ 8).

---

## 1. Deux notions à ne jamais confondre

| | **Module ouvert** (l'offre) | **Module affiché** (le métier) |
|---|---|---|
| Qui décide | L'abonnement (`07-offres-et-prix.md`) | L'entreprise, ou son métier au démarrage |
| Ce que ça change | Ce qu'on a le droit de **créer** | Ce qu'on voit dans le **menu** |
| Quand c'est « non » | On voit tout ce qui existe déjà, on ne crée plus rien de neuf dans ce module ; l'écran le dit, avec le bouton qui l'ouvre | L'entrée disparaît du menu ; la palette (Ctrl K) et l'adresse y mènent toujours |

C'est la leçon de l'application actuelle. Un menu raccourci selon le métier (7.3.0) et une offre qui
ferme un module (7.33.0) sont deux mécanismes différents. Les confondre avait fait disparaître des
pages que le client avait payées (7.12.0). **Une offre ne masque jamais rien ; un menu ne ferme
jamais rien.**

---

## 2. La liste des modules

### Le socle (toujours là, jamais facturé à part)

Tout ce dont les modules ont besoin, et ce qui porte les promesses de la plateforme :
- les **identités** : organisations, entreprises, établissements, utilisateurs, membres, rôles et
  droits, appareils, invitations, mandats de cabinet ;
- les **fiches communes** : tiers (clients et fournisseurs), articles, unités, catégories ;
- la **numérotation** (séries, compteurs) ;
- les **règles fiscales datées** et les référentiels (devises, cours, plan comptable) ;
- le **moteur de calcul** (porté depuis `core.js` et `compta.js`) ;
- le **moteur d'écritures** : chaque pièce produit ses écritures, même sans le module Comptabilité
  (§ 8) ; et la **validation du mois** (numéro, empreinte, mois fermé), le geste qui précède une
  déclaration (`01` § 14, règle 4) ;
- les **fichiers**, les **envois** (e-mail, WhatsApp, SMS), les **notifications**, la **file de travaux** ;
- la **lecture de documents** (photo, PDF, tableur, facture TEIF), sur nos serveurs (`14` § 2.3) ;
- l'**accord d'un responsable au-delà d'un seuil** (`03` D11) ;
- la **piste d'audit** et le **journal inaltérable** ;
- la **recherche** (Ctrl K), l'**aide**, les **visites guidées**, les **champs personnalisés** ;
- la **synchronisation** hors ligne, l'**API publique** avec ses clés et ses avis d'événement
  (`14` § 2.5), l'**export d'une entreprise** ;
- le **catalogue de textes** et les langues (`14` § 5) ;
- l'**abonnement** vu du client (son offre, ses factures SkanFact, le paiement).

### Les modules

| Module | Contient | Dépend de | Offre (`07`) |
|---|---|---|---|
| **Ventes** | Devis (par sections), proforma, commandes (livrées en plusieurs fois, reliquats), bons de livraison, factures (plusieurs livraisons en une), avoirs, notes d'honoraires ; prix par client, par catégorie et **par quantité** ; **encours autorisé** ; calculateur de prix ; règlements reçus ; chèques et traites ; relances ; contrats récurrents ; **facture électronique signée et envoyée à la TTN** ; retenue subie et attestations ; **espace client** et **paiement en ligne** (Konnect) (`14` § 2.1, 2.2) ; en vague 1 : situations de travaux et retenue de garantie, suivi commercial (`14` § 3) | Socle | Essentiel |
| **Achats** | **Demandes de prix, commandes fournisseurs, réceptions** (même partielles) ; factures d'achat rapprochées de la réception, avoirs, acomptes, dépenses ; règlements versés ; retenue opérée et **certificats TEJ** ; lecture d'une facture TEIF, d'une photo ou d'un PDF ; en vague 2 : notes de frais | Socle | Essentiel |
| **Trésorerie** | Comptes (banque, caisse, portefeuille électronique comme Konnect, titres-restaurant à remettre), mouvements, virements entre comptes, relevés importés, rapprochement, prévision | Socle | Essentiel |
| **Déclarations** | TVA du mois (cases prêtes à copier), retenues à la source, timbre, TFP et FOPROLOS, calendrier fiscal ; **les salaires du mois** saisis en total quand la paie est faite ailleurs (§ 3, M4) | Ventes, Achats | Essentiel |
| **Pilotage** | Tableau de bord, statistiques, marges par client, par article et par affaire, **balance âgée**, **tableau de bord du groupe** (les sociétés du groupe où la personne a ce droit, `14` § 3.6) | Ventes | Essentiel |
| **Stock** | Emplacements, mouvements, transferts, inventaires, lots, numéros de série et garanties, coût moyen, **recettes et kits** (un article composé sort ses composants), articles au poids | Ventes, Achats (il écoute leurs pièces, § 4) ; remplit un point du Pilotage | Essentiel |
| **Caisse** | Caisses, sessions, tickets hors ligne, ticket 80 mm, douchette, tiroir, Z de caisse ; en vague 1, le **mode restaurant** (`15`) : salles et tables, quatre façons de vendre, envoi en cuisine par zone, suppléments et formules, addition partagée ; titres-restaurant ; terminal de paiement non connecté (`14` § 3.1) | Ventes, Stock (§ 4), Trésorerie | Essentiel (1 caisse), + 120 DT par caisse |
| **Paie** | Salariés, contrats, bulletins, absences, avances, CNSS trimestrielle (fichier), déclaration d'employeur | Trésorerie ; remplit un point du Pilotage | Complet, ou + 150 DT |
| **Comptabilité complète** | Saisie, livre-journal, grand livre, balance, lettrage, OD, immobilisations, clôture d'exercice, états financiers, liasse, révision, export FEC | Achats (il écoute leurs pièces pour proposer les immobilisations) | Complet, ou + 150 DT ; **toujours ouvert au cabinet** (§ 8) |
| **Cabinet** | Portefeuille, production, échéances de tous les clients, relances, affectation des collaborateurs, questions au client ; **lettres de mission et honoraires**, **dépôts groupés** (`14` § 2.4) | Comptabilité complète | Espace du cabinet (§ 8 et `07`) |
| **Réservations** (vague 1 : restaurants, repris de Slate, `15`, et rendez-vous) | Choses et personnes qu'on réserve (une table, un agenda par personne ou par poste, un matériel, une salle), créneaux, widget public de réservation, rappels, liste d'attente, service du jour ; en vague 2 : la location (période, caution, état au départ et au retour) | Ventes, Trésorerie | Complet, ou + 120 DT |
| **Production** (vague 2) | Ordres de fabrication : composants consommés, article fini produit, coût de revient figé | Stock, Achats | Complet, ou + 120 DT |
| **Projets** (vague 2) | Temps passé, budget et facturation au temps, sur les affaires (l'axe « Affaires » du `01` § 14) | Ventes, Paie (le coût d'une heure, s'il est ouvert) | Complet, ou + 120 DT |
| **Groupe** (vague 3) | Consolidation, ventes entre sociétés reliées toutes seules | Pilotage, Comptabilité complète | À décider le jour venu |
| **Intégrations** (vague 1 et suivantes) | Boutiques en ligne, sociétés de livraison, autres prestataires de paiement, WhatsApp automatique, connecteurs sans code, dans l'ordre du `14` § 4 ; chacune remplit un point de branchement déclaré (§ 4.3) | API du socle ; les points de Ventes, Achats et Stock | Selon l'intégration, à décider avec chacune |
| **Hôtellerie** (à la fin) | Chambres, séjours (décision de Skander du 28/09/2026 : quand tout le reste est fini) | Réservations, Caisse | À décider le jour venu |

**Ce qui n'est pas un module** : la facture électronique, la retenue à la source et la TVA. Ce sont
des obligations, donc elles vivent dans Ventes, Achats et Déclarations, qui sont dans toutes les
offres payantes (règle de `07`).

**« Dépend de » parle du code, pas de l'offre.** La Caisse s'appuie sur le code du Stock même pour
un article qui n'est pas suivi en stock (un service, un café au comptoir) : rien n'en sort, c'est tout.
De même, les Projets appellent la Paie pour le coût d'une heure ; sans bulletin, ce coût reste vide
et l'écran le dit, jamais un chiffre inventé.

**Les dépendances vont dans un seul sens** : un module ne dépend que du socle et des modules placés
**au-dessus** de lui dans le tableau, jamais d'un module placé en dessous. Un test le vérifie à chaque
version. Une boucle entre deux modules les soude pour toujours, et plus aucun des deux ne peut
évoluer seul.

Quand un module du haut a besoin d'un chiffre d'un module du bas (le Pilotage veut le coût moyen du
Stock pour ses marges, ou la masse salariale de la Paie), c'est le module du haut qui **déclare le
point** (« coût d'un article », « charges du mois ») et le module du bas qui le **remplit**. Si le
module du bas n'est pas là, le point reste vide et l'écran le dit (« marge calculée sans coût
d'achat : le Stock n'est pas ouvert »), jamais un chiffre inventé.

---

## 3. Les règles d'un module

**M1. Un module se déclare.** Sa fiche dit : son nom, ce qu'il fait en une phrase, ses tables, ses
gestes (pour les droits, document 03), ses écrans, ses points de branchement **offerts** et ceux
qu'il **utilise**, ses dépendances, ses articles d'aide et ses visites, ses tests. Ce qui n'est pas
déclaré n'existe pas : le socle refuse de le charger.

**M2. Un module n'écrit jamais dans les tables d'un autre.** Il appelle ses **fonctions publiques**.
Exemple : la Caisse ne touche pas aux mouvements de stock ; elle appelle « sortir du stock » que le
module Stock lui offre. Un outil de contrôle refuse toute importation qui contourne cette porte.

**M3. Le calcul d'un montant n'est jamais un point de branchement.** Totaux, TVA, timbre, retenue,
cotisations, amortissements : c'est le moteur du socle qui calcule, un seul chemin. Un module peut
**ajouter** une ligne à une pièce (par la porte prévue), jamais changer la façon dont une autre ligne
se calcule. C'est la condition des invariants « deux chemins, un chiffre ».

**M4. Fermer un module ne fausse aucune déclaration.** C'est la règle de la 10.7.0, et un test la
porte : pour chaque module payant, on le ferme sur l'exemple complet, et **aucune case d'aucune
déclaration** ne doit bouger. Si elle bouge, ce module porte une obligation et il n'a pas le droit
d'être payant.

Le cas qui l'a fait écrire : **la paie**. La déclaration mensuelle porte la retenue sur les salaires,
la TFP et le FOPROLOS, calculées sur les bulletins. Une entreprise en Essentiel qui a des salariés,
sans le module Paie et sans cabinet qui la fait, aurait des cases vides. D'où, dans Déclarations, **les
salaires du mois saisis en total** (brut imposable, retenue, base des taxes) quand aucun bulletin
n'existe pour ce mois. C'est la règle de la 10.7.0 (les Achats sortis de l'offre payante parce qu'ils
portaient la TVA déductible), appliquée d'avance.

**M5. Fermer un module ne cache rien et n'efface rien.** Tout ce qui a été créé reste lisible,
exportable, et continue de compter dans les écritures et les déclarations. Rouvrir le module
retrouve tout, sans rien reprendre. Jamais de données en otage (6.4.0).

**M6. Un module apporte ses tests, son aide et ses visites, ou il n'entre pas.** Ses tests, avec leur
preuve par réintroduction ; ses invariants ; une bulle « i » pour chaque champ ; une visite pour
chaque geste. L'instrument de couverture (10.14.0) est porté : un contrôle d'écran sans explication
fait tomber la construction.

**M7. Un module respecte des budgets de performance** (vision § 6), mesurés à chaque version. Un
module lent ralentit tout le monde : c'est lui qu'on corrige, pas le budget.

**M8. Un module expose son API** sous son nom (`/v1/ventes/…`, `/v1/stock/…`), avec les mêmes droits
que ses écrans. Nos écrans passent par elle (vision § 4.7).

---

## 4. Les points de branchement

Trois sortes, et c'est tout. Chaque point porte un nom stable. Le renommer est un changement de
version qui se prévient, jamais un effet de bord.

### 4.1 Les événements : « ceci vient d'arriver »

Un module annonce ce qu'il a fait ; les autres s'y abonnent. Le socle, lui, **n'écoute aucun module**
(il ne les connaît pas) : c'est chaque module qui **passe ses écritures** en appelant le moteur
d'écritures du socle, dans la même opération que la pièce. Les événements servent aux autres
modules.

**Écouter un module, c'est en dépendre** : un module n'écoute que le socle et les modules placés
au-dessus de lui (§ 2). Pour agir sur un module placé au-dessus, il **appelle ses fournisseurs**
(§ 4.3) : la Caisse appelle « sortir du stock » et « verser en banque », la Paie appelle « net à
payer » de la Trésorerie.

Deux moments possibles :
- **dans la même opération**, quand les deux doivent réussir ou échouer ensemble. Exemple : une
  facture émise et la sortie de son stock. Si la sortie échoue, la facture n'est pas émise.
- **après**, par la file de travaux, pour ce qui peut attendre. Exemples : envoyer le mail, prévenir
  un logiciel extérieur, recalculer un tableau de bord.

| Événement | Annoncé par | Qui l'écoute (exemples) | Moment |
|---|---|---|---|
| `piece_vente.emise` | Ventes | Stock (sortie), Pilotage | Stock : même opération ; Pilotage : après |
| `piece_vente.avoir_emis` | Ventes | Stock (retour) | Même opération |
| `reglement.enregistre` | Ventes, Achats | Trésorerie (mouvement du compte) | Même opération |
| `reglement.impaye` | Ventes | Trésorerie (chèque ou traite revenu) | Même opération |
| `piece_achat.enregistree` | Achats | Stock (entrée, **sauf** si une réception l'a déjà faite), Comptabilité complète (fiche d'immobilisation **proposée**, jamais créée d'office) | Stock : même opération ; proposition : après |
| `reception.validee` | Achats | Stock (entrée) | Même opération |
| `ticket.encaisse`, `session_caisse.fermee` | Caisse | Intégrations | Après |
| `bulletin.remis` | Paie | Intégrations, Projets (le coût d'une heure) | Après |
| `piece_vente.emise`, `reglement.enregistre` (le même événement que plus haut) | Ventes | **Avis d'événement de l'API** vers les adresses de l'entreprise (`14` § 2.5) | Après |
| `ecriture.validee` | Socle (moteur d'écritures) | Journal inaltérable, Déclarations (le mois peut se déclarer), Cabinet (production) | Même opération |
| `mois.cloture` / `exercice.cloture` | Socle (le mois : demandé par l'entreprise ou le cabinet ; l'exercice : par la Comptabilité complète ou le cabinet) | Tous ; le socle refuse ensuite tout geste daté avant | Même opération |
| `abonnement.change` | Socle | Tous (modules ouverts, écrans) | Même opération |

Le ticket de caisse sort son stock **par un appel**, pas par un événement, et **aussi hors ligne** :
le poste tient une copie des règles de stock et rejoue l'appel au retour du réseau (document 04).

Ce qui ne passe **pas** par un événement, parce que c'est l'affaire du module lui-même : l'envoi à la
TTN et la retenue (dans Ventes et Achats), les relances (dans Ventes), les écritures (appel au
moteur du socle, ci-dessus), et les notifications, comme une question du cabinet à son client
(appel au socle). **Une déclaration se prépare sur les écritures validées du mois** (`01` § 14,
règle 4). La validation du mois est donc un geste **du socle**, ouvert dans toutes les offres : si
elle vivait dans la Comptabilité complète, il faudrait l'acheter pour déclarer (contraire à M4).

### 4.2 Les emplacements d'écran : « ici, un autre module peut se montrer »

Un module réserve des places dans ses écrans, et un autre peut y poser quelque chose. Il ne réécrit
jamais l'écran lui-même.
- un **onglet** sur une fiche (le Stock pose « Matériel installé » sur la fiche client) ;
- une **colonne** dans une liste (le Stock pose « En stock » dans le catalogue) ;
- une **action** dans le menu « Actions » d'une ligne ou d'une pièce (la Caisse pose « Refaire en
  facture » sur un ticket) ;
- une **ligne** dans « À faire » et une **carte** sur l'accueil ;
- une **entrée** dans la palette (Ctrl K) et un **article** dans l'Aide.

Chaque emplacement porte les règles d'interface du projet : un seul bouton principal par écran, une
ligne garde au plus un bouton visible, et ce qui apparaît ne pousse rien sous le curseur.

### 4.3 Les fournisseurs : « voici ce que je sais faire, pour qui en a besoin »

Des fonctions publiques qu'un module offre aux autres, avec une forme fixée. Exemples :
- Stock : `quantiteDisponible(article, emplacement)`, `sortir(…)`, `entrer(…)`, `composants(article)`
  (la recette ou le kit d'un article composé), et il remplit le point « coût d'un article » que le
  Pilotage déclare ;
- Ventes : `encours(tiers)`, `creerCommande(…)` (appelé par les Intégrations pour une commande de
  boutique) ; il **déclare** trois points : « prestataire de paiement » (qu'il remplit lui-même pour
  Konnect au lancement, et que les Intégrations remplissent pour les autres), « société de
  livraison » et « boutique en ligne » (remplis par les Intégrations, `14` § 4) ;
- Achats : `recevoir(…)` (une réception, appelée par le Stock pour un réassort) ;
- Trésorerie : `comptePourMode(mode, etablissement)`, `enregistrerMouvement(…)` (appelé par la
  Caisse et la Paie) ;
- Paie : remplit le point « charges du mois » que le Pilotage déclare (§ 2) ;
- Socle : `regle(code, date)`, `prochainNumero(serie)` (lecture seule), `emettreNumero(serie)`
  (dans la transaction d'émission), `passerEcritures(piece)`, `notifier(…)`.

---

## 5. Les champs personnalisés

Pour qu'un client adapte SkanFact **sans une ligne de code** (règle R13 de `01`) :
- **Objets personnalisables** : tiers, articles, pièces de vente et d'achat (en-tête et ligne),
  salariés, affaires, immobilisations.
- **Types** : texte, nombre, montant, date, oui/non, liste de choix, lien vers une fiche (un tiers,
  un article).
- **Où ils se voient** : sur la fiche, en colonne facultative dans la liste, dans la recherche, dans
  les exports et l'API ; **sur le PDF** seulement si on le coche (et jamais à la place d'une mention
  légale).
- **Règles** : un champ peut être obligatoire, mais ne bloque jamais une pièce déjà émise ; un champ
  supprimé est **archivé**, ses valeurs restent lisibles ; renommer un champ ne change pas ses
  valeurs.
- **Ce qu'ils ne font pas** : entrer dans un calcul de montant (M3). Un « taux de remise
  personnalisé » ne peut pas changer un total ; c'est une demande de fonction, pas un champ.

---

## 6. Activer, désactiver, changer d'offre

| Geste | Ce qui se passe |
|---|---|
| **Ouvrir** un module (achat, essai, changement d'offre) | Immédiat, sans rechargement de données. Le module apparaît au menu, et sa visite guidée se propose une fois |
| **Fermer** un module (fin d'abonnement, offre plus petite) | Lecture seule dans ce module (M5) : l'écran dit pourquoi, avec le bouton qui le rouvre. Rien n'est effacé ni caché |
| **Masquer** un module du menu (préférence) | Seulement le menu (§ 1) ; la palette et les adresses y mènent toujours. Si on enregistre quelque chose dans un module masqué (par la palette, ou depuis un autre écran), il **revient au menu et l'application le dit** : c'est un événement, pas un réglage qui se rallume tout seul (le piège de la 7.12.0, `modulesRevenus`) |
| **Fin de l'abonnement entier** | Lecture seule partout, export complet toujours possible (`07`) |

**Un module fermé continue de recevoir les événements dont dépend l'exactitude des chiffres.**
Exemple : Stock fermé, une facture émise sort quand même le stock de ses articles suivis. Sinon, le
jour où le module rouvre, le stock serait faux, et rien ne permettrait de le rattraper. La lecture
seule porte sur les **gestes de l'utilisateur**, jamais sur la tenue des chiffres.

---

## 7. Versions et mises à jour

- **Une seule version du serveur pour tout le monde.** Pas de module en retard chez un client, pas de
  code propre à un client.
- **Chaque module porte ses migrations de base, dans l'ordre.** Une migration s'applique à toutes les
  entreprises d'une cellule en une fois ; elle est **réversible** ou accompagnée d'une sauvegarde
  vérifiée, et elle est essayée d'abord sur une copie de la base de production.
- **Les nouveautés s'allument par entreprise** (drapeaux), pour les faire essayer d'abord aux
  entreprises volontaires : c'est le canal bêta d'aujourd'hui, sans installation.
- **Un point de branchement ne se casse jamais sans préavis** : on en crée un nouveau, l'ancien
  continue le temps que tous les modules passent au nouveau, puis il est retiré.

---

## 8. Le cabinet et les modules

Règle (principe 3 de `07`) : **ce que le cabinet fait pour son client ne se facture pas au client.**

- Sur un dossier dont il a le mandat, le cabinet a **toujours** Comptabilité complète, Déclarations
  et Paie, **quelle que soit l'offre du client**. Il tient la comptabilité ou fait la paie de son
  client ; c'est son métier et son outil.
- Le **client**, lui, voit ces modules selon **son** offre. Un client en Essentiel dont le cabinet
  fait la paie voit ses bulletins en **lecture** (ils le concernent), sans pouvoir en créer.
- Un dossier tenu par le cabinet pour un client **non abonné** est facturé au cabinet (`07`), avec
  tous les modules.
- Si l'abonnement du client **s'arrête**, le client passe en lecture seule (`07`), et le cabinet
  aussi sur ce dossier. Pour continuer à le tenir, le cabinet le prend comme **dossier tenu**
  (`07`) ; le jour où le client se réabonne, le dossier redevient gratuit pour le cabinet.
- Le **moteur d'écritures est dans le socle** pour cette raison : sans lui, un client en Essentiel ne
  produirait pas les écritures dont son comptable a besoin.

---

## 9. Comment le code est rangé

- **Un dossier par module** (et un pour le socle), qui contient ses tables et migrations, ses
  fonctions publiques, son API, ses écrans, ses tests, son aide et ses visites.
- **Une seule porte d'entrée par module** : les autres modules n'importent que ce qu'il déclare
  public (M2). Un outil de contrôle vérifie les frontières à chaque construction (le choix de l'outil
  est fait dans le document 12).
- **Le moteur de calcul est porté une fois**, dans le socle, avec ses tests actuels. Les modules
  l'appellent ; aucun ne le recopie.

---

## 10. Ce que deviennent les modules de l'application actuelle

| Application actuelle (`MODULES` de `core.js`) | Nouvelle plateforme |
|---|---|
| Devis et factures ; Clients et catalogue (toujours) | Ventes ; fiches du socle |
| Proforma, bons et contrats | Ventes (les mêmes pièces, et les contrats récurrents) |
| Achats et fournisseurs | Achats |
| Stock et garanties | Stock |
| Caisse | Caisse |
| Immobilisations | Comptabilité complète (et toujours ouvert au cabinet) |
| Salariés et paie | Paie |
| Trésorerie | Trésorerie |
| Pilotage (statistiques, marges) | Pilotage |
| Comptabilité, la partie ouverte à tous (TVA, écritures, calendrier fiscal, clôtures du mois, paquet du comptable) | Déclarations, et le socle (écritures, validation du mois) ; le paquet disparaît : le comptable est dans les mêmes données |
| Comptabilité (onglets payants de la 9.1.0) | Comptabilité complète |
| SkanFact Cabinet (l'application entière) | Module Cabinet + Comptabilité complète, dans la même plateforme |
| Menu raccourci selon le métier (`MODULES_PAR_ACTIVITE`) | « Module affiché » (§ 1), repris tel quel |

---

## 11. À VÉRIFIER, et à décider plus tard

1. **Groupe et consolidation** : le tableau de bord du groupe est au lancement ; ce qu'un groupe
   tunisien attend de plus (consolidation légale ?) se décide avant la vague 3. Entretiens.
2. **Intégrations** : l'ordre est proposé au `14` § 4 ; les entretiens peuvent le changer.
3. **Une paie faite par le cabinet** pour un client en Essentiel : vérifier auprès des cabinets
   pilotes que c'est bien ainsi qu'ils veulent travailler.
4. **Les salaires saisis en total** dans Déclarations : quelles cases ils doivent remplir exactement
   (retenue sur salaires, TFP, FOPROLOS ; la CNSS est trimestrielle et vit dans la Paie). À VÉRIFIER
   avec un comptable.
5. **Les métiers** : tout ce que le `14` § 7 laisse à vérifier (caisse et commandes de table,
   retenue de garantie, titres-restaurant, caution, cartes cadeaux).

## 12. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | Un socle et douze modules (dont deux plus tard), dépendances à sens unique, vérifiées par un test (écouter un module, c'est en dépendre) ; un module du haut qui a besoin d'un chiffre du bas déclare un point que l'autre remplit |
| 28/09/2026 (proposé) | Un module n'écrit jamais dans les tables d'un autre ; trois sortes de points de branchement : événements, emplacements d'écran, fournisseurs |
| 28/09/2026 (proposé) | Le calcul d'un montant n'est jamais un point de branchement ; fermer un module ne fausse aucune déclaration (test) |
| 28/09/2026 (proposé) | « Module ouvert » (l'offre) et « module affiché » (le métier) sont deux notions séparées |
| 28/09/2026 (proposé) | Un module fermé : lecture seule pour l'utilisateur, mais les chiffres continuent d'être tenus |
| 28/09/2026 (proposé) | Le moteur d'écritures et la validation du mois sont dans le socle, ouverts à toutes les offres ; les salaires du mois se saisissent en total dans Déclarations quand la paie est faite ailleurs ; le cabinet a toujours Comptabilité complète, Déclarations et Paie sur ses dossiers |
| 28/09/2026 (proposé) | Champs personnalisés en données, jamais dans un calcul ; nouveautés allumées par entreprise |
| 28/09/2026 (proposé) | Un module masqué où l'on enregistre quelque chose revient au menu, et l'application le dit ; un client qui arrête son abonnement : le cabinet continue en dossier tenu |
| 28/09/2026 (**Skander**, `15`) | Slate devient la partie restaurant, en vague 1 avec le mode restaurant de la caisse, après une base stable |
| 28/09/2026 (par délégation, après validation, `14`) | Ventes, Achats, Stock, Caisse, Pilotage et Cabinet complétés pour être au niveau de Hesabi et des métiers du lancement (restauration, commerces, grossistes) ; Stock et une caisse passent dans Essentiel ; quatre modules nouveaux : Réservations (vague 1), Production et Projets (vague 2), Hôtellerie (à la fin) ; Groupe en vague 3 ; Intégrations dans l'ordre du `14` § 4 |
