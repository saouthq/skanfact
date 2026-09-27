# Plan commercial — vendre, garder, amener du monde

*Écrit le 26/09/2026, à la demande de Skander : « afin de convertir, faut faire un plan afin de pouvoir
quand même gagner de l'argent et ramener du monde ».*

C'est un **plan**, pas un état du code. Ce que le code tient en matière d'offres et de prix vit dans
`TARIFS-REFERENCE.md`, et c'est lui qui fait foi pour le site : **aucun chiffre de ce document ne
paraît sur `skanfact.tn` tant qu'il n'est pas passé dans `TARIFS-REFERENCE.md`.**

---

## 0. Ce qui est décidé (26/09/2026)

1. **Les applications peuvent envoyer des COMPTES à la plateforme** — le nombre de dossiers d'un
   cabinet, le nombre de pièces émises sur trente jours —, **jamais la base d'un client** : ni un nom,
   ni un montant, ni une pièce, ni un fichier. Mot de Skander : « quitte à communiquer avec les
   applications c'est pas grave tant qu'on a pas leur base de données ». La règle « la liste se
   compte » reste entière : chaque champ ajouté est nommé ici avec la décision qu'il sert (§ 5),
   affiché dans l'application, et compté par un test. **Rien n'est encore codé.**
2. **Les prix de SkanFact ne bougent pas** : Indépendant 390 DT HT/an, Entreprise 690 DT HT/an,
   parrainage −20 % la première année.
3. **Le Cabinet se vend par tranches de dossiers** (10, 25, 50, sans limite). Les montants du § 2
   sont une proposition : ils ne sont posés nulle part, et ne paraissent pas sur le site tant que
   l'avis de l'Ordre n'est pas revenu.
4. **Les cabinets pilotes : gratuits sans limite, avec une date de fin** (douze mois). Ça révise
   l'offre fondatrice de `TARIFS-REFERENCE.md` § 5 — voir § 3.

---

## 1. Le modèle en une phrase

**Les cabinets sont le canal ; les entreprises sont le revenu.**

```
SkanFact Cabinet — gratuit pour les dossiers des clients qui sont sur SkanFact
   │   le cabinet gagne des heures : les écritures arrivent déjà écrites,
   │   et chaque client passé sur SkanFact sort de sa facture Cabinet
   ▼
Ses clients installent SkanFact — 30 jours d'essai, puis −20 % la première année
   ▼
390 ou 690 DT HT par an, renouvelés chaque année
```

Le chiffre qui décide de tout n'est ni le prix du Cabinet ni celui de SkanFact : c'est **la part des
clients d'un cabinet qui passent sur SkanFact**. C'est le premier chiffre que la console doit savoir
mesurer (§ 5).

**Un ordre de grandeur, pas une promesse** — les hypothèses sont écrites pour être remplacées par les
vrais chiffres dès le premier trimestre (§ 9) :

- 20 cabinets de 60 clients : 1 200 entreprises atteignables.
- Une sur dix passe sur SkanFact la première année, moitié Indépendant, moitié Entreprise :
  120 licences × 540 DT de prix moyen × 0,8 (remise de parrainage) ≈ **52 000 DT HT la première
  année**.
- Huit sur dix renouvellent au prix plein : 96 × 540 ≈ **52 000 DT HT la deuxième**, plus les
  nouvelles licences.
- Le Cabinet payant (à partir du 21e cabinet, § 2 et § 3) vient en plus.

---

## 2. Les prix

### SkanFact — inchangés

Indépendant 390, Entreprise 690 DT HT/an, réglables dans la console depuis la 10.5.0. Parrainage
−20 % la première année. Option Comptabilité : prix non fixé (`DIRECTION.md` propose 190 DT).

### SkanFact Cabinet — la grille proposée (pas décidée)

| Dossiers hors SkanFact | Prix HT/an | Par dossier, tranche pleine |
|---|---|---|
| Jusqu'à 3 | Gratuit — déjà dans le code (`CABINET_GRATUITS`) | — |
| Jusqu'à 10 | 490 DT | 49 DT |
| Jusqu'à 25 | 990 DT | 40 DT |
| Jusqu'à 50 | 1 690 DT | 34 DT |
| Sans limite | 2 490 DT | 25 DT à 100 dossiers |

Ce qui ne change pas : les dossiers des clients SkanFact sont gratuits et ne comptent jamais ; les
postes sont illimités ; la grâce de douze mois après une licence client **payée** ; au-delà du quota,
seule la validation d'une écriture s'arrête (jamais de données en otage).

**Pourquoi des tranches plutôt qu'un prix par dossier.** La licence est hors ligne : c'est la clé
signée qui porte le nombre acheté. Une tranche donne quatre clés possibles au lieu de soixante, un
prix qui se lit d'un coup d'œil, et aucune raison de surveiller le compteur tous les mois. Le prix
par dossier baisse d'une tranche à l'autre : grandir ne coûte pas plus cher par client.

**Changer de tranche en cours d'année** : une clé neuve à la même date de fin, facturée au prorata
des jours restants. Le calcul existe (`core.prorataOffre`, 8.2.0) ; il reste à le brancher sur le
Cabinet.

**Deux vérifications avant de poser ces chiffres :**

1. **Ce que le cabinet pilote paie aujourd'hui** pour son logiciel, licence et maintenance, par an.
   La grille doit être nettement en dessous : c'est cette ancre qui compte. **À VÉRIFIER.**
2. **L'avis de l'Ordre** sur la vente par dossier et sur le parrainage. **À VÉRIFIER.**

Une fois décidés, ils se posent dans Console → Réglages, **jamais comme valeur par défaut dans le
code** (9.4.1 : un prix par défaut devient un tarif par simple préremplissage), puis dans
`TARIFS-REFERENCE.md` et sur le site.

---

## 3. Les cabinets fondateurs — l'offre révisée

`TARIFS-REFERENCE.md` § 5 (22/09) proposait : les vingt premiers cabinets gratuits, sans limite,
**sans date de fin**. Proposition révisée :

| | Proposé le 22/09 | Proposé le 26/09 |
|---|---|---|
| Places | 20 | 20, statut **posé** à la main dans la console, jamais déduit du rang (10.8.0) |
| Pendant | gratuit, sans limite, à vie | gratuit, sans limite, **12 mois** à partir de la licence |
| Après | — | **prix fondateur à vie : −50 %** sur la grille (245 / 495 / 845 / 1 245 DT HT) |
| Dossiers des clients SkanFact | gratuits | gratuits, comme pour tout le monde |

Pourquoi :

- **Sans date de fin, il n'y a jamais de moment où l'on vend.** Les cabinets les plus engagés — ceux
  qu'on aura convaincus — ne paieraient jamais, et une promesse « à vie » ne se reprend pas.
- **La date de fin crée exactement l'incitation qu'on veut.** Pendant douze mois, chaque client que
  le cabinet fait passer sur SkanFact sort de sa future facture. Gratuit à vie, cette incitation
  disparaît.
- **Douze mois, c'est un exercice entier** : saisie, déclarations, clôture. Un cabinet qui a clôturé
  une année dans le Cabinet ne repart pas.
- **Le −50 % à vie garde au statut de fondateur sa valeur**, et c'est une promesse qu'on peut tenir.

En échange — une demande, pas une condition de la licence : un retour par trimestre, et l'accord
d'être cité comme référence sur le site.

Les trois cabinets qui testent aujourd'hui sont les fondateurs n° 1 à 3. Leurs licences de test ne
comptent pas (`TARIFS-REFERENCE.md` § 7, Q1 bis) ; leur licence « sans limite » part avec une fin à
douze mois le jour où ils commencent pour de vrai.

**À écrire avant de le proposer** : la convention « cabinet fondateur » (`A-FAIRE.md` § 1). Une page,
qui dit les douze mois, le −50 % à vie, et que la gratuité porte sur **la licence** — pas sur un
engagement de support, de disponibilité ou de développement.

---

## 4. L'entonnoir : chaque étape, sa mesure, son geste

| Étape | Ce qu'on mesure (des comptes, § 5) | Le geste qui fait avancer | Existe ? |
|---|---|---|---|
| **Amener** | installations par source : site, cabinet, code de campagne | codes de campagne (§ 6) ; « Inviter mes clients » dans le Cabinet (§ 8) | à construire |
| **Activer** | première pièce émise dans les sept jours | relance « besoin d'aide ? » à J+3 si rien n'est émis — composée, relue et envoyée par toi, comme les relances d'essai | à construire (le compte) |
| **Convertir** | essais qui finissent, conversion par ordinateur | alertes « essai qui se termine », relance composée, carte « Tes réussites », achat dans l'application | oui (10.4.0, 10.5.0, 10.14.0) |
| **Garder** | renouvellements à 60 et 30 jours ; clients à risque | **renouvellement en ligne** ; liste « à risque » | alertes : oui — renouvellement en ligne : **non** |
| **Élargir** | Indépendants qui butent sur un cadenas ; cabinets proches de leur quota | **passer à Entreprise dans l'application, au prorata** ; tranche supérieure du Cabinet | **non** |
| **Recommander** | filleuls par cabinet et par client | parrainage cabinet (−20 %) ; un client qui en amène un autre gagne un mois au renouvellement | cabinet : oui — entreprise : à construire |

**Deux trous coûtent de l'argent dès le premier client**, et passent avant le reste :

1. **Le renouvellement en ligne.** Une licence qui court ne se rachète pas en ligne (10.14.0 : la clé
   achetée repartirait d'aujourd'hui et perdrait les jours payés). Or le renouvellement, c'est
   l'argent récurrent — et il passe aujourd'hui par un mail. Le serveur doit prouver la fin de la
   licence en cours, et la clé neuve part de là. C'est aussi ce qui permettra d'acheter après une
   clé offerte (§ 6, contrôle 6).
2. **La montée d'offre dans l'application.** Quand un Indépendant touche un cadenas (Stock, Paie…),
   le bouton doit proposer « Passer à Entreprise : X DT pour les N jours restants ». Le prorata
   existe ; le geste, non.

---

## 5. Ce que les applications enverront — des comptes, jamais la base

Aujourd'hui l'annonce d'un poste porte la clé, l'identité du poste, le système, la version et le nom
de l'application (`PLAN-PLATEFORME.md` § 9, liste comptée par un test). Proposé, champ par champ,
avec la décision que chacun sert :

**SkanFact Cabinet**

| Champ | Ce que c'est | Ce qu'il permet de décider |
|---|---|---|
| `dossiersComptes` | le nombre que la licence compte — hors SkanFact, non archivés, grâce appliquée : le chiffre que Réglages → Licence affiche déjà | « proche du quota » : proposer la tranche au-dessus ; « quota dépassé » : la validation est bloquée, appeler |
| `dossiersSkanfact` | ses dossiers dont le client est sur SkanFact | l'effet canal de ce cabinet — le chiffre du § 1 |
| `dossiersActifs` | dossiers qui ont reçu un paquet ou une écriture dans les trente derniers jours | un cabinet qui cesse de travailler dans l'application part bientôt |

**SkanFact**

| Champ | Ce que c'est | Ce qu'il permet de décider |
|---|---|---|
| `piecesEmises30j` | nombre de factures et d'avoirs émis sur trente jours | l'activation (la première facture), la santé du client |
| `cabinet` | l'empreinte du cabinet appairé — publique, c'est celle du fichier d'appairage | rattacher un ESSAI à son cabinet avant tout achat ; une licence payée la porte déjà (parrainage) |

Les règles qui vont avec :

- **Rien d'autre** : ni nom, ni montant, ni chiffre d'affaires, ni client, ni fichier, ni chemin. La
  liste « ne remonte jamais » de `PLAN-PLATEFORME.md` § 9 ne bouge pas.
- **L'application le dit** : Paramètres → Licence, et Réglages → Licence dans le Cabinet, gagnent
  « Ce que SkanFact envoie », la liste exacte, relue par un test contre le code (8.0.0 : une phrase
  rassurante se vérifie contre ce qui part).
- **Hors ligne, rien ne part et rien ne se bloque** (`PLAN-PLATEFORME.md` § 8).
- **INPDP, plus pressant maintenant** : la déclaration à l'Instance doit nommer ces comptes.
  **À VÉRIFIER** avant la première vente.
- Côté plateforme : des colonnes ajoutées à `activations`, jamais une table de données client.

---

## 6. Les contrôles de la console

Classés par ce qu'ils rapportent ou évitent de perdre. Chacun porte, à côté, la règle du projet qui
le borne.

### Voir

1. **Le tableau de bord des revenus** : revenu annuel récurrent (licences payées actives,
   annualisées), encaissé et attendu par mois, renouvellements à 30, 60 et 90 jours en montant,
   taux de renouvellement, le tout par offre. Un agrégat porte sa période et sa devise (7.16.0).
2. **Le quota des cabinets** : dossiers comptés face à la licence, alertes « proche » et « dépassé »,
   et « Proposer la tranche au-dessus » — un mail composé avec le prorata. Demande le § 5.
3. **L'effet canal par cabinet** : ses clients sur SkanFact, ses essais en cours, ses conversions.
   Ce sont les cabinets qui amènent du monde : à remercier, à citer.
4. **Santé et « à risque »** : dernière vue, pièces émises, version, échéance. La liste des clients
   à appeler **avant** leur renouvellement, pas après.
5. **L'entonnoir par mois** : installés, actifs, essais finis, payants — par source.

### Agir, sans jamais toucher aux données d'un client

6. **Prolonger un essai, ou faire un geste** : une clé offerte de N jours (la 10.14.1 sait émettre
   une licence à 0 DT). Surtout pas une réponse du serveur : le serveur ne peut qu'ajouter une
   restriction, jamais accorder un droit (`PLAN-PLATEFORME.md` § 8, règle 4) ; une clé signée, si.
7. **Des codes de campagne** — salon, partenaire, cabinet : remise, dates, plafond d'usage, source.
   Vérifiés par le serveur : le code est une **demande**, le prix ne vient jamais du navigateur
   (10.9.0).
8. **Des actions en masse** : relancer les essais qui finissent cette semaine, préparer les
   renouvellements du mois, exporter une sélection.
9. **Un message signé aux postes** : un texte daté, qui expire, ciblé (tous, une offre, un client,
   une version), affiché en bandeau, jamais bloquant, signé par la clé de réponse. Il n'accorde ni
   ne retire rien : il informe. Il voyage dans la réponse à l'annonce — aucun canal neuf.
10. **Une version minimale ciblée** : pour un client, « mise à jour recommandée » avec son motif, en
    bandeau dans l'application. Le motif est un réglage de la console depuis la 10.5.0 ; il
    n'arrive pas encore jusqu'au client.
11. **Le déploiement progressif, et la suspension** : une nouvelle version proposée d'abord à une
    part des postes (`stagingPercentage` d'electron-updater, posé par le relais), et un bouton qui
    suspend la diffusion d'une version fautive. Jamais de retour en arrière (6.7.3) : ceux qui l'ont
    la gardent, les autres ne la reçoivent plus.
12. **Les testeurs bêta** : qui est sur le canal d'essai (lu dans la version annoncée), et une
    invitation par message signé.

### Protéger

13. **Cloudflare Access devant la console** — ce qui a le plus de valeur pour le moins d'effort.
    Aujourd'hui un seul secret ouvre tout ; Access demande en plus un code envoyé à ton adresse
    (gratuit jusqu'à cinquante utilisateurs). Deux pièges, écrits d'avance :
    - protéger `/console` et `/v1/admin/*`, **jamais** les routes publiques (`/verifier`, l'achat,
      l'activation) — sinon plus aucun client ne vérifie ni n'achète ;
    - **le pont de SkanFact appelle `/v1/admin/*` depuis ton poste, sans navigateur** : il lui faut
      un « jeton de service » Access (deux en-têtes), rangé à côté du secret dans
      `~/.skanfact/plateforme-admin.json`. Sans lui, Access coupe le pont. C'est un petit code, à
      livrer **avant** d'activer Access.
14. **Un journal d'audit filtrable**, et un mail à toi à chaque geste sensible : révocation, clé sans
    limite, prix changé, secret tourné.

---

## 7. L'ordre de construction

**Lundi, on reprend les tests au guide comme prévu (`A-FAIRE.md` § 0.1).** Ce plan vient après,
sauf le lot 0, qui ne demande pas une ligne de code.

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| **0 — sans code** | finir la vérification Konnect ; relancer l'Ordre ; demander au pilote ce que coûte son logiciel ; écrire la convention fondateur ; INPDP ; conditions de vente (`A-FAIRE.md` § 1) | ils bloquent la vente, pas le code |
| **A — encaisser** | renouvellement en ligne ; passer à Entreprise dans l'application ; tableau de bord des revenus ; jeton de service du pont, puis Cloudflare Access | l'argent récurrent, et la clé du coffre |
| **B — le Cabinet vendable** | tranches dans la console et dans la clé ; les comptes du § 5 ; quota et alertes ; statut fondateur et −50 % à vie ; « Inviter mes clients » dans le Cabinet | le canal |
| **C — piloter** | santé et « à risque » ; entonnoir ; codes de campagne ; prolonger par clé offerte ; actions en masse | savoir où agir |
| **D — tenir le parc** | message signé ; version minimale ciblée ; déploiement progressif et suspension ; testeurs bêta ; journal d'audit | le contrôle à distance, fait avec soin |

Chaque lot touche à l'argent ou à une clé : **bêta d'abord** (règle de publication), tests, preuves
par réintroduction, et test à la souris avant de dire que c'est fait.

---

## 8. Où trouver les gens

**Les cabinets**

- Le pilote, puis ses confrères. Vingt places, c'est une rareté vraie : on peut la dire.
- Une démonstration de vingt minutes en cabinet, sur l'exemple du Cabinet (deux exercices, huit
  dossiers) : c'est ce qui convainc un comptable, bien plus qu'une page web.
- Les rencontres de la profession (OECT, formations continues) — déontologie **À VÉRIFIER**.

**Les entreprises**

- **Par leur cabinet — le meilleur canal de tous** : un conseiller de confiance écrit à soixante
  clients d'un coup. Le Cabinet sait déjà composer le mail du fichier d'appairage (10.14.0) pour
  les clients qui ont SkanFact ; il lui manque sa variante pour ceux qui ne l'ont **pas** :
  « Inviter mes clients » — le lien de téléchargement, les trente jours d'essai, les −20 % de
  parrainage, et ce que le client y gagne (son comptable reçoit ses écritures déjà écrites).
  Toujours composé, relu et envoyé par le comptable ; jamais un envoi automatique.
- Le site, sur les questions que les gens tapent vraiment : timbre fiscal, retenue à la source,
  TVA, modèle de facture conforme. L'Aide de l'application a déjà ces textes : ils deviennent des
  guides du site, chacun finissant par « essaie trente jours ».
- Les groupes d'entrepreneurs, les incubateurs, les chambres de commerce, les jeunes entreprises.

---

## 9. Les chiffres à suivre, chaque mois

Cabinets actifs · part des clients de chaque cabinet sur SkanFact · essais démarrés · essais activés
(première pièce en sept jours) · essais convertis · encaissé · revenu annuel récurrent · taux de
renouvellement · départs.

Le premier trimestre remplace les hypothèses du § 1 par ces chiffres-là, et les jalons de
`PLAN-DEVELOPPEMENT.md` les lisent.
