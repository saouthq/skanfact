# 04 — Le hors-ligne et la synchronisation

*Proposé le 28/09/2026, relu le même jour contre tout le dépôt. **Validé le 28/09/2026**, après la
relecture demandée par Skander. Suit `VISION-ARCHITECTURE.md` (§ 4.5, § 6, § 8),
`01-modele-de-donnees.md` (R15, § 6 numérotation, § 10 caisse, § 17 `operation`), `02-modules.md`
(§ 4 : le stock sorti par la caisse, aussi hors ligne) et `03-droits.md` (D8 : les droits hors
ligne). **Complété le même jour, après validation**, pour suivre le `14` : la salle d'un restaurant
et ce qui attend le réseau (§ 1). **À revalider.***

## En bref (pour Skander)

Internet se coupe en Tunisie, et c'est notre premier argument face aux concurrents, qui ne marchent
qu'en ligne (vision § 1, point fort 1). Ce document dit **exactement** ce qui marche pendant une
coupure, ce qui attend le retour du réseau, et comment rien ne se perd ni ne se double.

Les idées qui comptent :
1. **Le serveur fait foi.** Le poste garde une copie de ce dont il a besoin, et une **file de gestes
   à envoyer**. Au retour du réseau, le serveur rejoue chaque geste et peut le **refuser** en
   disant pourquoi.
2. **Rien ne se perd en silence.** Un geste refusé va dans « À reprendre », avec la raison et le
   bouton qui débloque. L'écran dit en permanence combien de gestes attendent d'être envoyés.
3. **Rien ne se double.** Chaque geste a un identifiant créé sur le poste : envoyé deux fois, il ne
   compte qu'une fois.
4. **Un fait n'est jamais refusé.** Un ticket encaissé ou de l'argent reçu pendant la coupure ont
   eu lieu : le serveur les garde toujours, même si le mois a été fermé, le droit retiré ou
   l'abonnement échu entre-temps. Il les **régularise** ou les met **en attente de décision**, jamais
   à la poubelle.
5. **On ne fusionne jamais deux versions d'une même pièce en une troisième.** On garde celle du
   serveur, on met l'autre de côté, et on le dit. C'est la règle de l'application actuelle depuis la
   3.2.0.
6. **La caisse marche toute seule** pendant la coupure : tickets numérotés par la caisse, chaînés,
   stock sorti sur le poste.
7. **Une facture ne s'émet pas hors ligne** : son numéro, sa signature et son envoi à la TTN
   demandent le serveur. Elle se prépare entièrement, et part d'un geste au retour du réseau.
8. **Le choix de l'outil de synchronisation se fait sur un prototype mesuré**, avec des seuils
   écrits avant de mesurer (§ 9).

---

## 1. Ce qui marche pendant une coupure

Cette liste **fait foi** (vision § 8 : « pas de promesse "tout marche hors ligne" »). L'écran la
montre quand on est hors ligne, et un geste absent de la liste le dit **avant** qu'on commence,
jamais après.

| Geste | Hors ligne | Au retour du réseau |
|---|---|---|
| **Encaisser à la caisse** (ticket, retour avec le code d'un responsable, tiroir, imprimante) | ✓, complet | Les tickets remontent, dans l'ordre |
| **La salle d'un restaurant** : prendre une commande, l'envoyer aux imprimantes de cuisine, partager l'addition (`14` § 3.1) | ✓, **sur la caisse** : c'est elle qui tient la salle et parle aux imprimantes par le réseau du restaurant (l'agent local) | Les commandes et les tickets remontent |
| Un client demande une **facture pour son ticket** | ✓, préparée et liée au ticket (le ticket suffit comme preuve d'achat en attendant) | Émise : numéro, signature, TTN |
| Ouvrir et fermer une **session de caisse**, imprimer le Z | ✓ (**À VÉRIFIER** avec la caisse certifiée, `01` § 10) | La session et son Z remontent |
| **Devis, proforma, commande, bon de livraison** : créer, modifier, imprimer, envoyer plus tard | ✓, avec un numéro (§ 3.2) | Enregistrés sur le serveur |
| **Facture, avoir** : préparer entièrement, voir l'aperçu | ✓, **sans numéro** | « Émettre » : numéro, signature, TTN |
| Enregistrer un **règlement** reçu ou versé (espèces, chèque) | ✓ | Rejoué ; refusé si la pièce a changé entre-temps (§ 5) |
| Enregistrer un **achat**, une dépense | ✓ | Rejoué |
| Mouvements de **stock**, comptage d'inventaire | ✓ | Rejoués ; la validation de l'inventaire se fait en ligne |
| Créer, modifier un **client**, un **fournisseur**, un **article** | ✓ | Rejoué, fusion champ par champ (§ 5) |
| **Saisie comptable au brouillard** (entreprise et cabinet) | ✓ | Rejouée ; la validation se fait en ligne |
| **Bulletin de paie** en brouillon | ✓ | La remise se fait en ligne |
| **Consulter** ce qui est sur le poste (§ 2) | ✓ | Mis à jour avec ce que les autres ont fait |
| Répondre à une question du cabinet | ✓ | Envoyée |
| Préparer un envoi par e-mail ou WhatsApp | ✓, **mis en attente** | Part tout seul, et l'écran le dit |

**Ce qui attend le réseau**, et pourquoi :

| Geste | Pourquoi |
|---|---|
| Émettre une facture ou un avoir | Le numéro est donné par le serveur (`01` § 6) ; la signature DigiGo et la TTN demandent internet (vision § 5) |
| Valider des écritures, le mois, clôturer l'exercice | Numéro et empreinte donnés par le serveur, dans l'ordre (`01` R9, § 14) |
| Préparer ou marquer déposée une déclaration | Elle doit voir **tous** les postes, pas seulement celui-ci |
| Valider un inventaire | L'écart devient une écriture, sur un stock qui doit être complet |
| Remettre un bulletin, déclarations sociales | Bulletin scellé à la remise ; chiffres de tous les postes |
| Inviter, retirer un membre, changer un rôle, le mandat, l'abonnement | Les droits se décident sur le serveur (`03` D2) |
| Export complet | Il doit contenir tout, pas ce que le poste a |
| Chercher dans ce qui n'est pas sur le poste | Le poste n'a qu'une partie des données (§ 2) |
| Prendre une commande **sur le téléphone d'un serveur** | La salle se tient sur la caisse pendant la coupure ; le téléphone le dit, et le serveur passe par la caisse (`14` § 3.1) |
| L'**espace client**, le **paiement en ligne** d'une facture | Ils vivent sur le serveur, pour le client de l'entreprise (`14` § 2.1, 2.2) |
| **Lire une photo ou un PDF** de facture | La lecture se fait sur nos serveurs, en Tunisie (`14` § 2.3). La photo, elle, se prend hors ligne et part au retour du réseau |
| L'**API**, les **avis d'événement**, les **intégrations** | Ils parlent au serveur, jamais au poste |

---

## 2. Ce que le poste garde

Le poste ne garde pas tout. Dix ans de pièces n'ont rien à faire sur un téléphone, et chaque ligne
gardée est une ligne qui peut être volée avec l'appareil.

| Qui | Ce qui est sur le poste |
|---|---|
| **Tout poste** | Les fiches (clients, fournisseurs, articles, prix), les règles fiscales **y compris celles qui entrent en vigueur plus tard** (§ 6), les séries, les réglages, **les 13 derniers mois** de pièces, **et toute pièce encore ouverte** quel que soit son âge (impayée, devis en cours), ses propres gestes en attente |
| **Poste de caisse** | Le catalogue, les prix, les quantités **de son établissement**, les clients (pour une facture sur ticket), les codes de caisse (§ 7), sa session, ses tickets du jour et ceux pas encore remontés. Rien d'autre |
| **Cabinet** | Les dossiers qu'on choisit d'**emporter** (par défaut : ses dossiers confiés, exercice en cours) |
| **Selon le rôle** | **Seulement ce que le rôle permet de voir** (`03`). Le poste d'un commercial ne reçoit jamais une ligne de paie ; la règle est la même porte que pour l'écran, et un test le vérifie (§ 9) |
| **« Ce n'est pas mon ordinateur »** | Rien (`03` § 6) |

Ce qui n'est pas sur le poste se lit **en ligne** : l'écran le dit (« 2019 : disponible en ligne »),
il ne montre jamais une liste tronquée comme si elle était complète. C'est la règle du projet : une
phrase affichée que rien ne tient est un bug.

**La copie locale est chiffrée** (vision § 3). La clé appartient à l'appareil (`01` § 4 : clé de
l'appareil) et elle est gardée par le système : le trousseau pour l'application de bureau, une clé
**non exportable** du navigateur pour l'application installée. **Limite honnête** : quelqu'un qui
vole un ordinateur **allumé et ouvert** lit ce qui est à l'écran. Le chiffrement protège contre le
vol d'un disque ou d'un appareil éteint, pas contre tout. La parade complémentaire, c'est la
révocation (§ 7).

---

## 3. La numérotation hors ligne

Reprise de `01` § 6, et complétée pour les pièces qui ne sont pas légales.

### 3.1 Les tickets

- Une série **par caisse**, numérotée **sur le poste**, même hors ligne.
- **Une caisse n'est tenue que par un appareil à la fois** (`01` § 10). Deux postes hors ligne sur la
  même série prendraient le même numéro ; c'est le seul moyen sûr de l'empêcher. Changer d'appareil
  se fait en ligne, après la fermeture de la session.
- Chaque ticket est **chaîné** au précédent (`01` R9), sur le poste. Au retour du réseau, le serveur
  vérifie la chaîne. Un trou ou une chaîne cassée est une **alerte**, pas une correction
  silencieuse.

### 3.2 Les devis, commandes et bons de livraison

Un artisan fait souvent son devis **chez le client**, parfois sans réseau, et le client veut un
papier avec un numéro. Ces pièces n'ont pas de valeur fiscale, donc :
- chaque appareil reçoit à l'avance un **bloc de numéros** dans la série des devis (par exemple
  20 numéros), renouvelé à chaque synchronisation ;
- un numéro de bloc non utilisé reste un **trou**, et c'est permis pour ces séries. Ce n'est
  **jamais** permis pour les factures ;
- les pièces sortent donc dans l'ordre de chaque appareil, pas dans l'ordre général. Si une
  entreprise veut une série de devis strictement continue, elle le règle, et ses devis sont alors
  numérotés en ligne seulement.

Ceci **précise** la règle du `01` § 6 (« un numéro qu'on n'a pas encore pris se lit, il ne se
réserve pas ») : elle vaut pour les **pièces légales**. Les séries non légales peuvent réserver un
bloc.

### 3.3 Les factures et les avoirs

**Jamais hors ligne.** La facture préparée hors ligne porte « À émettre au retour du réseau ». Si le
client a besoin d'un papier tout de suite, on lui donne le **devis** ou une **proforma**. L'écran le
propose, avec le bouton.

---

## 4. La file d'envoi

**Chaque geste fait hors ligne devient une opération** (`operation`, `01` § 17) :

| Ce qu'elle porte | Pourquoi |
|---|---|
| Un **identifiant unique** créé sur le poste (UUIDv7, `01`) | Envoyée deux fois, elle ne compte qu'une fois |
| L'appareil, la personne, et un **numéro d'ordre** propre à l'appareil | Le serveur rejoue les gestes d'un appareil **dans l'ordre**, et voit s'il en manque un |
| La **révision** de l'objet vue par le poste (`01` R15) | Le serveur sait si l'objet a changé entre-temps (§ 5) |
| L'instant du geste sur le poste, et l'instant de réception | Voir § 6, l'horloge |
| La version du format | Une mise à jour de l'application ne rend jamais illisible une file déjà écrite (§ 8) |

**Règles de la file** :
- Un geste est **écrit dans la file avant** que l'écran dise « enregistré ». Il ne vit jamais
  seulement en mémoire.
- La file part **dès que le réseau revient**, sans geste de l'utilisateur, dans l'ordre.
- **L'écran dit toujours où on en est** : « En ligne », ou « Hors ligne depuis 14 h 32 — 23 gestes
  en attente ». Chaque pièce pas encore envoyée le porte sur elle.
- **Fermer la session, se déconnecter ou vider le navigateur avec des gestes en attente** : l'écran
  prévient **avant**, et propose d'attendre le réseau.
- **Le stockage du navigateur peut être vidé par le navigateur lui-même** (Safari, par exemple, peut
  effacer les données d'un site qu'on n'a pas ouvert depuis sept jours). L'application installée demande donc le
  **stockage persistant**. Si le navigateur le refuse, l'écran le dit, et le hors-ligne est limité à
  la consultation. **Pour une caisse, l'application de bureau est recommandée.** **À VÉRIFIER** sur
  les navigateurs du marché pendant le prototype.

---

## 5. Quand deux personnes ont touché la même chose

| Ce qui a été touché | Ce qui se passe |
|---|---|
| **Un ticket, une pièce émise, une écriture validée** | Pas de conflit possible : c'est scellé (`01` R6). Un ticket est un fait, il est toujours accepté (voir § 6 pour le mois fermé) |
| **Un brouillon** (devis, facture préparée, achat, écriture au brouillard) | En ligne, un brouillon est **tenu par une personne** : l'autre voit qu'il est ouvert et par qui (vision § 8). Si deux personnes l'ont modifié **hors ligne** : on garde la version arrivée la première au serveur. L'autre est **mise de côté**, jamais jetée : elle s'affiche dans « À reprendre », à côté de la première, avec « Garder celle-ci » |
| **Une fiche** (client, fournisseur, article) | Fusion **champ par champ** (c'est ainsi que se lit `01` R15 pour une fiche : rien n'est écrasé, puisque seuls les champs que l'autre n'a pas touchés se fusionnent) : l'un a changé le téléphone, l'autre l'adresse, les deux changements sont gardés. Si **le même champ** a changé des deux côtés, on garde la version du serveur, et l'autre est mise de côté et signalée. Le RIB d'un fournisseur ne se fusionne jamais : un conflit sur un RIB est **toujours** signalé au propriétaire (`03` § 7) |
| **Un règlement sur une facture** qui a changé entre-temps (avoir total, soldée ailleurs) | Le règlement est accepté (l'argent a été reçu) ; s'il dépasse le reste dû, il devient un **trop-perçu** signalé, jamais une affectation forcée |
| **Le stock** | Les mouvements s'additionnent : aucun conflit. Une quantité qui passe sous zéro est **signalée**, jamais refusée. La vente a eu lieu |
| **Un réglage** (fiche société, séries, régime) | Réservé au propriétaire et à l'administrateur (`03`), donc rarement hors ligne. Si c'est le cas : version du serveur, l'autre mise de côté et signalée |

Pourquoi pas une fusion automatique « à la Google Docs » : les outils qui le font (les CRDT) sont
faits pour du texte. Une facture fusionnée à partir de deux versions serait une troisième facture que
personne n'a écrite (vision § 4.5). La règle vient de l'application actuelle, 3.2.0 : **on ne
fusionne jamais deux versions d'une même pièce en une troisième**.

### 5.1 Un fait n'est jamais refusé

Un **ticket** encaissé et un **règlement** reçu ou versé sont des faits : l'argent a bougé. Le serveur
ne les jette donc jamais, quelle que soit la raison :

| Ce qui a changé pendant la coupure | Ce qui arrive au fait |
|---|---|
| Le mois a été fermé | Accepté, régularisé dans le premier mois ouvert (§ 6) |
| La personne a été retirée de l'entreprise, ou son rôle réduit | **En attente de décision** : le propriétaire l'accepte (la vente a eu lieu) ou la rejette, avec un motif. La piste d'audit garde les deux |
| L'appareil a été révoqué | En quarantaine, même décision (§ 7) |
| L'abonnement est passé en lecture seule | Accepté : c'est un fait, et jamais de données en otage (`07`). La caisse apprend la lecture seule à la synchronisation, et c'est **ensuite** qu'elle cesse d'encaisser |

Les autres gestes (un brouillon, une fiche, une saisie) peuvent être refusés : ils vont dans « À
reprendre », où l'on peut les refaire.

### 5.2 « À reprendre »

Chaque geste refusé ou mis de côté arrive dans « À reprendre ». Chaque ligne y dit :
- **ce qui** a été refusé ;
- **pourquoi**, avec la première raison qui manque (`03` D1 : l'accès, l'offre ou la période, le
  rôle) ;
- **le bouton** qui règle le problème : garder cette version, refaire le geste à une autre date,
  demander le droit.

« À reprendre » n'est jamais vide en silence, et il ne se vide que par un geste. C'est la règle du
projet : un refus dit ce qui est refusé, pourquoi, et le bouton qui débloque.

---

## 6. L'horloge, les dates et les règles

**Deux temps par geste.** Le poste note l'instant du geste (c'est lui qui fait foi pour un ticket :
la vente a eu lieu à ce moment-là), et le serveur note l'instant de réception. Si l'horloge d'un
poste s'écarte de plus de **5 minutes** de celle du serveur, le poste le dit à l'écran, et le
serveur marque les gestes concernés. Une date de pièce reste un **jour du calendrier** dans le
fuseau de l'entreprise (`01` R5).

**Un geste daté dans un mois fermé entre-temps.** Le cas réel : une caisse coupée du réseau pendant
que le cabinet ferme le mois.
- Avant de fermer un mois, le serveur **nomme les postes qui n'ont pas remonté** depuis ce mois
  (« La caisse 2 du magasin de Sfax n'a rien envoyé depuis le 29 »). Il propose d'attendre, il ne
  bloque pas : c'est la règle des contrôles de clôture.
- Un **ticket** ou un **règlement** qui arrive après la fermeture est **accepté**, puisque c'est un
  fait. Il garde sa vraie date. Son écriture se passe en **régularisation dans le premier mois
  ouvert**, avec un renvoi vers le ticket, et le cabinet la voit dans « À reprendre ». Le mois
  fermé n'est jamais réécrit. C'est la règle de la 10.14.0 : un fait fiscal se régularise à la date
  de la pièce qui le change. **À VÉRIFIER** avec un comptable.
- Un **brouillon** ou un geste de saisie daté dans le mois fermé est refusé. « À reprendre » propose
  de le refaire dans le mois ouvert.

**Les règles fiscales sur le poste.** Le poste garde les règles **avec leurs dates d'effet, y compris
celles qui entrent en vigueur plus tard** : une loi de finances publiée en décembre est sur les
caisses avant le 1er janvier. Si le serveur découvre qu'un ticket a été calculé avec une règle
périmée (un poste resté hors ligne pendant le changement), il ne le réécrit pas : le ticket garde
ce qui a servi à le calculer (`01` R7), et une **régularisation** est proposée dans « À reprendre ».

---

## 7. Combien de temps un poste reste-t-il hors ligne ?

`03` D8 renvoyait ici le chiffre. Proposition :

| Poste | Droits gardés hors ligne | Ensuite |
|---|---|---|
| **Poste de caisse** reconnu | **7 jours** | La caisse s'arrête d'encaisser. L'écran dit pourquoi et depuis quand, et ce qui la débloque : une connexion, même courte |
| **Tout autre poste** reconnu | **72 heures** | Consultation seulement ; les gestes en attente restent dans la file et partiront |

Pourquoi deux durées : une caisse est fixe dans un magasin, et arrêter de vendre coûte cher. Un
ordinateur portable se perd ou se vole plus facilement. **À VÉRIFIER** avec la caisse certifiée :
l'administration impose peut-être un délai maximal de transmission des tickets (l'Arabie saoudite,
notre modèle, impose 24 heures, vision § 4.5). Si c'est le cas, c'est ce délai qui gagne.

**Les codes de caisse hors ligne.** Pour qu'un caissier change de session ou qu'un responsable
autorise un retour sans réseau, le poste de caisse garde les codes à 4 chiffres **en empreinte**
(`01` § 4), chiffrés avec la clé de l'appareil. **Limite honnête** : un code à 4 chiffres ne résiste
pas à qui a déjà la clé de l'appareil. Il sert à dire **qui** encaisse, pas à protéger un secret.
C'est la même chose que l'identité déclarée du Cabinet actuel (9.9.0). Après **5 erreurs**, le poste
attend un code de responsable.

**Un appareil révoqué** (volé, perdu, employé parti) :
- à sa reconnexion, il reçoit l'ordre d'**effacer** ses données avant toute autre chose ;
- les gestes qu'il avait en attente sont **reçus mais mis en quarantaine**, jamais appliqués
  d'office. Le propriétaire les voit et décide, un par un ou en bloc : les accepter (les tickets
  d'une caisse révoquée par erreur) ou les rejeter (ceux d'un voleur). Rien n'est perdu, rien n'est
  cru sur parole.

---

## 8. Les mises à jour de l'application pendant qu'une file attend

- Le serveur accepte les opérations écrites par **les deux versions précédentes** de l'application.
  Une file écrite avant une mise à jour part donc toujours.
- L'application installée **vide sa file avant de se mettre à jour**. Si elle ne peut pas (pas de
  réseau), elle garde l'ancienne version jusqu'au retour du réseau.
- C'est la règle de `02` § 7 appliquée au format d'une opération : il ne se casse jamais sans
  préavis.

---

## 9. Le choix de l'outil de synchronisation

### 9.1 Ce qui est déjà décidé, quel que soit l'outil

- **Les écritures passent par notre file d'opérations** (§ 4). Le serveur doit pouvoir **refuser** un
  geste : droit manquant, mois fermé, facture déjà émise ailleurs (vision § 4.5). Aucun outil ne
  décide à notre place de ce qui est accepté.
- **Le droit de lire se vérifie par la même porte** que pour l'écran (`03` D2, et la sécurité par
  ligne de la base). Ce que le poste reçoit, c'est exactement ce que la personne a le droit de voir.

La vraie question est donc **le chemin de lecture** : comment le poste reçoit, et tient à jour, sa
copie des données (§ 2).

### 9.2 Les candidats

| Candidat | Ce qu'il fait | Pour | Contre |
|---|---|---|---|
| **Notre propre chemin** : « tout ce qui a changé depuis la révision N », par notre API | Le poste demande les changements depuis sa dernière révision, table par table, filtrés par la porte des droits | Une seule règle de droits, la nôtre ; pas un composant de plus à exploiter (vision R11 : une seule personne) ; les volumes d'une PME sont petits | Tout à écrire et à tester nous-mêmes : reprises, pagination, suppressions |
| **PowerSync** (auto-hébergé) | Lit les changements de PostgreSQL, et tient une base SQLite sur le poste, selon des règles de synchronisation | Le plus mûr en 2026 (vision § 4.5) ; SQLite local, navigateur et bureau | Nos droits (rôle, établissement, paie cachée) doivent être réécrits dans **ses** règles : deux endroits pour une même règle, ce que D2 interdit. Un service de plus à héberger en Tunisie. **À VÉRIFIER** : sa licence en auto-hébergement |
| **ElectricSQL**, **Zero** | Même famille (vision § 4.5) | — | Mêmes objections, et moins mûrs |

**Préférence, à confirmer par le prototype : notre propre chemin de lecture.** La raison principale,
c'est la règle D2 du `03` : une seule porte pour les droits. Un outil qui garde ses propres règles de
filtrage en crée une seconde, et deux règles finissent toujours par diverger. C'est la leçon du
projet depuis la 6.8.0 : deux tables séparées divergent toujours.

### 9.3 Le prototype, et ses seuils écrits d'avance

Règle du projet : **on mesure avant d'écrire un format**, avec des seuils fixés avant la mesure
(`npm run charge`). Le prototype essaie **notre chemin** et **PowerSync** sur les mêmes données :
l'exemple de cinq ans de l'application actuelle, et un magasin fictif de 500 tickets par jour.

| Mesure | Seuil |
|---|---|
| Encaisser un ticket hors ligne | < 200 ms (vision § 6) |
| Rattrapage après une journée de coupure d'un magasin (500 tickets) | < 1 min (vision § 6) |
| Première copie d'une PME (13 mois + fiches) sur une connexion de 4 Mbit/s | < 60 s |
| Place prise sur le poste par une PME | < 200 Mo |
| Poste d'un commercial : lignes de paie reçues | **0**, prouvé par un test |
| Appareil révoqué : données effacées après la reconnexion | < 1 min |
| Un même geste envoyé trois fois | Compté une fois |
| Deux postes modifient le même brouillon hors ligne | Une version gardée, l'autre dans « À reprendre », aucune perdue |
| Une file écrite par la version précédente de l'application | Acceptée |

Un seuil dépassé **change le plan, pas le seuil**. Le prototype a lieu **avant** le document 12 (pile
technique), qui en reprend le résultat. Sa durée et son coût vont dans le document 09.

---

## 10. Ce qu'on reprend de l'application actuelle

| Application actuelle | Nouvelle plateforme |
|---|---|
| Fichier JSON entier sur chaque poste, partagé par un dossier (3.2.0) | Une copie partielle, et un serveur qui fait foi |
| `mergeData` : jamais deux versions d'une pièce fusionnées, l'autre archivée (`conflictArchive`), suppressions mémorisées | Même principe (§ 5), avec « À reprendre » à la place de l'archive |
| Compteurs : on prend toujours le plus haut ; deux factures au même numéro sont signalées | Le problème disparaît : les factures sont numérotées par le serveur |
| Révision attendue du livre du Cabinet (9.9.0) : on n'écrase jamais, on rend le conflit | `01` R15 : la révision vue part avec chaque geste |
| Caisse (H5) sur le poste | Même geste, série propre à la caisse, chaîne d'empreintes, remontée au serveur |

---

## 11. À VÉRIFIER

1. **Caisse certifiée** : session ouverte hors ligne, délai maximal de transmission des tickets,
   format du Z (`01` § 21). Tout se confronte au cahier des charges de la plateforme d'homologation
   des caisses (`05` § 3.7), avant d'écrire la caisse.
2. **Stockage persistant** des navigateurs (Safari, Chrome, Firefox ; ordinateur et téléphone) :
   vérifié pendant le prototype.
3. **Régularisation d'un ticket arrivé après la fermeture du mois** : acceptable pour un comptable
   et en cas de contrôle ?
4. **Licence de PowerSync** en auto-hébergement, si le prototype le retient.
5. **Blocs de numéros par appareil** pour les devis : aucune règle ne l'interdit pour une pièce sans
   valeur fiscale ? Comptable.

## 12. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | La liste du § 1 fait foi ; un geste absent de la liste le dit avant qu'on commence |
| 28/09/2026 (proposé) | Le poste garde 13 mois, les pièces ouvertes, les fiches, les règles (même futures), et seulement ce que le rôle permet de voir ; copie chiffrée |
| 28/09/2026 (proposé) | Tickets numérotés par la caisse ; devis, commandes et bons de livraison par blocs de numéros par appareil ; factures jamais hors ligne |
| 28/09/2026 (proposé) | Chaque geste est écrit dans la file avant l'écran ; identifiant unique, ordre par appareil, révision vue ; l'écran dit toujours combien attendent |
| 28/09/2026 (proposé) | Jamais de fusion de deux versions d'une pièce ; fiches fusionnées champ par champ, sauf un RIB ; « À reprendre » pour tout refus ou version mise de côté |
| 28/09/2026 (proposé) | Ticket ou règlement arrivé après la fermeture d'un mois : accepté, régularisé dans le premier mois ouvert ; la clôture nomme les postes qui n'ont pas remonté |
| 28/09/2026 (proposé) | Droits gardés hors ligne : 7 jours pour une caisse, 72 heures pour un autre poste ; appareil révoqué : effacé, et ses gestes en quarantaine jusqu'à la décision du propriétaire |
| 28/09/2026 (relecture) | Un fait (ticket, règlement) n'est jamais refusé : régularisé, ou en attente de la décision du propriétaire ; facture demandée sur un ticket préparée hors ligne, émise au retour |
| 28/09/2026 (proposé) | Écriture par notre file d'opérations ; lecture : notre propre chemin de préférence, départagé avec PowerSync par un prototype aux seuils écrits d'avance |
