# Tarifs SkanFact — la référence

*État du code au 22/09/2026, version 10.8.0-beta.1.*

Ce document dit ce que le **code fait**, pour que la page Tarifs de `skanfact.tn` ne promette rien
que l'application ne tienne. Il vit ici, dans le dépôt, et pas dans un fichier qu'on se passe de
main en main : **un document qu'on doit se transmettre finit par ne plus être transmis**, et deux
tables séparées divergent toujours (règle du projet depuis la 6.8.0).

**La règle, dans les deux sens :** le site n'écrit jamais un chiffre que l'application ne tient
pas ; et quand l'application renvoie vers une page du site, cette page doit exister. Si les deux
divergent, **c'est l'application qui fait foi** — c'est elle que le client ouvre.

Ce document se relit à chaque changement d'offre, de prix ou de module.

---

## 1. Le principe, à dire avant les prix

**Une offre ne cache jamais rien. Elle limite seulement ce qu'on peut CRÉER.**

Quelle que soit l'offre, quelle que soit la date d'expiration, ceci reste ouvert pour toujours :
lire, imprimer, exporter en CSV, sauvegarder, envoyer le paquet mensuel au comptable. Un client qui
passe d'Entreprise à Indépendant garde ses bulletins de paie lisibles à vie — il ne peut simplement
plus en établir de nouveaux.

Ce n'est pas un argument marketing, c'est une règle tenue par un test (`licenceBlock` n'est posé que
sur des créations, et un test relit `app.js` pour l'exiger). Le site peut l'écrire sans réserve.

**L'essai** : 30 jours, sur chaque installation, sans carte et sans clé (`TRIAL_DAYS`). Il démarre le
jour où l'application voit la clé publique de l'éditeur, pas le jour de fabrication de la clé.

---

## 2. Les deux offres SkanFact

| | Prix |
|---|---|
| **Indépendant** | **390 DT HT/an** — tout ce qu'il faut pour facturer **et déclarer juste** |
| **Entreprise** | **690 DT HT/an** — la même chose, plus tout ce qui sert à gérer |

Source : `plateforme/skanfact-api.mjs`, réglages `prix_independant` / `prix_entreprise`. Ils sont
**réglables depuis la console** depuis la 10.5.0 : si Skander les change, ce document et le site
changent avec.

Chaque ligne du tableau ci-dessous est un module de `core.MODULES`, avec le nom exact de ses écrans.
La colonne « Indépendant » se déduit de `OFFRES.independant.reserves` dans `src/licence.js`.

| Module | Écrans | Indépendant | Entreprise |
|---|---|---|---|
| Devis et factures | Devis, Factures, Relances | Inclus | Inclus |
| Clients et catalogue | Clients, Catalogue | Inclus | Inclus |
| Proforma, bons et contrats | Autres pièces, Contrats | Inclus | Inclus |
| **Achats et fournisseurs** | Achats, Fournisseurs | **Inclus** | Inclus |
| Comptabilité (base) | TVA, Écritures, Calendrier fiscal, Clôtures, Cabinet | Inclus | Inclus |
| Statistiques | Statistiques | Inclus | Inclus |
| Stock et garanties | Stock, Garanties | Lecture seule | Inclus |
| Immobilisations | Immobilisations | Lecture seule | Inclus |
| Salariés et paie | Paie | Lecture seule | Inclus |
| Trésorerie et marges | Trésorerie, Marges | Lecture seule | Inclus |
| Dossier partagé à deux postes | — | Non | Inclus |

**« Lecture seule »** veut dire : l'écran existe, il s'ouvre, il s'exporte, il part au comptable — on
ne peut pas y créer de nouvelle pièce.

**Achats est passé d'Entreprise à Indépendant le 22/09/2026** (10.7.0), et ce n'était pas une
concession commerciale. Sans lui, la TVA déductible d'un client vaut zéro : mesuré sur un exercice
complet du jeu de démonstration, le paquet envoyé au comptable déclarait **7 441,33 DT de TVA au
lieu de 3 250,16** — 4 191 DT annoncés en trop à l'administration, sur un logiciel vendu 390. Une
offre peut fermer un confort, jamais une case de déclaration.

**Le parrainage** : 20 % de remise la première année quand un cabinet comptable amène le client
(réglage `remise_parrainage`). La remise repart à zéro au renouvellement.

**Les prix TTC**, pour mémoire — TVA 19 % et timbre fiscal de 1 DT : **465,100 DT** (Indépendant) et
**822,100 DT** (Entreprise). Vérifié : 390 × 1,19 + 1 = 465,1 ; 690 × 1,19 + 1 = 822,1. Ces chiffres
ne vivent pas dans le code — l'application facture en HT et calcule la TVA à l'émission — mais
l'arithmétique est juste et c'est bien ce qui part du compte de l'acheteur.

---

## 3. L'option Comptabilité, vendue à part

Trois écrans, pour qui veut tenir ses livres lui-même : **Grand livre, Balance, États financiers**
(`ONGLETS_OPTION` dans `app.js`). Elle s'ajoute à n'importe laquelle des deux offres, Indépendant
comprise, et elle est ouverte pendant l'essai.

Tout le reste de la page Comptabilité — **TVA à payer, Écritures, Calendrier fiscal, Clôtures, envoi
du paquet au cabinet** — est **inclus partout, sans option**. C'est le point à ne pas rater : la page
Tarifs ne doit pas laisser croire que la comptabilité est payante. Ce qui est payant, ce sont les
trois écrans de tenue de livres.

**Prix : non fixé.** `DIRECTION.md` propose 190 DT ; ce n'est pas une décision, et le chiffre ne doit
pas paraître sur le site.

---

## 4. SkanFact Cabinet — la grille d'aujourd'hui

C'est **l'autre application**, celle du comptable : un second téléchargement, avec sa propre licence.
Ce n'est pas une offre de SkanFact.

| | Ce que le code applique |
|---|---|
| Dossiers dont le client est sur SkanFact | Gratuits, sans limite de nombre |
| Dossiers hors SkanFact | **3 gratuits** (`CABINET_GRATUITS`), puis une licence |
| Une licence peut aussi être **sans limite** | Depuis la 10.8.0 — une case à l'émission, pas une offre publique (§ 7, Q1) |
| Postes | Illimités — on vend des dossiers, jamais des ordinateurs |
| Prix d'un dossier au-delà | **Non fixé** — à 0 dans le code, donc rien n'est proposé nulle part |
| Ce qui s'arrête si le quota est dépassé | **La validation d'une écriture, et rien d'autre** |

La dernière ligne est la plus importante pour le site : même quota dépassé, le comptable continue de
lire, d'importer un paquet, de saisir en brouillard, d'exporter et de relancer ses clients. Un
cabinet ne perd jamais l'accès aux pièces de ses clients. Un test relit `src/cabinet/main.js` et
vérifie les deux sens : la porte sur les gestes qui valident, et son **absence** sur tout ce qui lit.

**Deux garanties supplémentaires, déjà dans le code :**

- Un dossier dont le client n'a pas renouvelé bénéficie de **douze mois de grâce** avant d'être
  compté — un cabinet ne paie pas parce que son client a oublié. La grâce ne suit qu'une licence
  **payée** : après un essai non converti, le dossier compte dès la fin de l'essai.
- Un paquet trop ancien pour dire si son client a une licence **ne compte pas**, et l'écran dit
  pourquoi. On ne fait pas payer ce qu'on n'a pas su lire.

---

## 5. L'offre fondatrice des 20 premiers cabinets — proposée, pas livrée

**La proposition** (session « site », 22/09/2026) : les vingt premiers cabinets sont gratuits, sans
limite de dossiers, définitivement ; la grille ci-dessus ne s'applique qu'à partir du vingt-et-unième.

**Avis côté application : oui, et c'est mieux que d'élargir le palier gratuit.** Le problème
d'aujourd'hui n'est pas le prix, c'est qu'il y a zéro cabinet utilisateur. À 3 dossiers gratuits, un
cabinet qui colle sa liste de 60 clients se cogne au mur au quatrième, et tout ce qui fait la valeur
du produit — le portefeuille d'un coup d'œil, qui est en retard, les échéances — est conçu pour 60
lignes. Avec 3, il voit un écran vide et conclut que ce n'est pas pour lui. Vingt cabinets gratuits,
c'est jusqu'à 1 200 entreprises atteignables et vingt références, pour un chiffre d'affaires
abandonné de zéro — puisque personne ne paie aujourd'hui.

Une objection soulevée puis retirée : on pourrait croire que la gratuité enlève au cabinet la
pression de pousser ses clients sur SkanFact. Mais le levier n'a jamais été la facture — un client
sur SkanFact envoie ses écritures **déjà écrites**, le cabinet gagne des heures. C'est infiniment
plus fort qu'un dossier à 20 DT.

### Trois choses à régler avant que le site l'écrive

1. **La date veut dire deux choses.** « Définitivement, jusqu'au 31/12/2027 » se lit dans les deux
   sens. Formulation retenue par les deux sessions :
   *« Les 20 premiers cabinets inscrits avant le 31/12/2027 gardent la gratuité totale, sans limite
   de dossiers et sans date de fin. »*
2. ~~**L'application ne sait pas encore dire « sans limite ».**~~ **Livré en 10.8.0** (22/09/2026,
   bêta). La console coche « sans limite de dossiers » sur une licence de cabinet, l'application
   affiche « sans limite » et ne verrouille plus jamais. Ce n'est pas un quota énorme : c'est un
   état — une clé à 99 999 dossiers aurait fait lire « 100 002 dossiers autorisés » au cabinet.
   Voir § 7, Q1.
3. **Monter est facile, redescendre est impossible.** Le palier gratuit est une constante de
   l'application, pas une valeur dans la clé vendue : le relever vaut pour toutes les installations,
   le rabaisser verrouillerait des cabinets qui allaient bien la veille. Porte à sens unique.

**Ce que « gratuit » doit dire, noir sur blanc :** la gratuité porte sur **la licence**. Pas sur un
engagement de support, pas sur une garantie de disponibilité, pas sur des développements
spécifiques.

---

## 6. Ce qui n'est pas décidé, et ce qu'il ne faut pas écrire

**Pas décidé — aucun de ces chiffres ne doit paraître sur le site :**

- Le prix d'un dossier de cabinet au-delà du palier gratuit. L'avis de l'Ordre des experts-comptables
  n'est pas revenu.
- Le prix de l'option Comptabilité.
- L'offre fondatrice du § 5, tant que ses trois points ne sont pas tranchés.

**À ne pas écrire, parce que l'application ne le tient pas :**

- « La comptabilité est réservée à l'offre Entreprise » — faux : la TVA, les écritures et le paquet
  au comptable sont inclus partout.
- « Vos données sont bloquées à l'expiration », sous quelque forme que ce soit — c'est l'inverse exact
  d'une règle du produit.
- Un nombre de postes limité pour le Cabinet — ils sont illimités.
- Une date de disponibilité de la facture électronique TTN / El Fatoora — rien n'est construit.
- « SkanFact dépose vos déclarations » — l'application ne dépose rien et ne se connecte à aucune
  administration. Elle prépare les chiffres à recopier, et le dit elle-même à l'écran.

**Deux détails vrais et utiles à la vente :**

- L'application fonctionne **hors ligne**, toujours. La licence se vérifie sur le poste, sans
  serveur : elle survit à une coupure de connexion, et à la disparition de son éditeur.
- Une licence se vérifie publiquement en collant son empreinte — voir § 7, question 2, pour
  l'adresse exacte.

---

## 7. Les questions de la session « site », et leurs réponses

### Q1 — Le « sans limite » : prévu, sur quelle version ?

**Livré en 10.8.0**, le 22/09/2026, en bêta. La réponse d'hier disait « non planifié » ; elle ne
l'est plus. Skander a tranché le jour même, et pour la raison qui rendait la question urgente : le
cabinet pilote teste l'application en ce moment et se cogne au quatrième dossier.

Ce que ça fait : la console coche « sans limite de dossiers » sur une licence **de cabinet**, la clé
signée la porte, l'application affiche « sans limite » au lieu d'un nombre et ne verrouille plus
jamais. Le quota reste caché tant que la case est cochée, et le prix se saisit à la main — il se
calculait sur le nombre de dossiers, qui ne compte plus.

Ce que ça ne fait pas, et c'est volontaire : ce n'est pas un très grand nombre. Une clé à 99 999
dossiers aurait fonctionné sans une ligne de code, et le cabinet aurait lu « 100 002 dossiers
autorisés » sur l'écran qui doit le rassurer — un chiffre que personne n'a décidé.

**Pour le site :** rien à écrire. Le « sans limite » est une capacité de l'outil d'émission, pas une
offre publique. Il ne devient une phrase sur la page Tarifs que si Skander tranche le § 5.

### Q1 bis — Les licences de test ne consomment aucune place de fondateur

Question de Skander en découvrant la 10.8.0 : « vu que je vais tester l'application je vais créer
des licences, est-ce que ça va pas me cramer mes 20 licences sans limite ? »

**Non, et par construction : rien ne compte.** Vérifié dans le code avant de répondre — le mot
« fondateur » n'existe nulle part, et aucun compteur d'émissions n'existe. La règle posée pour que
ça reste vrai le jour où on comptera :

> **Le statut de fondateur se POSE, il ne se déduit jamais du rang d'émission.** Une case explicite
> au moment d'émettre. Une clé de test n'est simplement pas marquée.

Et la séparation qui la rend propre : **la clé porte ce que l'application doit faire respecter** (le
quota) ; **la console porte ce que l'éditeur doit compter** (le statut commercial). L'application n'a
pas à savoir qu'on compte jusqu'à vingt. Conséquence pratique pour le site : le compteur « il reste
N places » ne peut pas être alimenté automatiquement aujourd'hui — ne pas en écrire un.

**Le site ne doit pas publier l'offre avant que ce soit livré** — c'est le bon réflexe, et la raison
est une règle du projet : une phrase affichée que rien ne tient est un bug, pas une imprécision.

### Q2 — `skanfact.tn/verifier` n'existe pas

**L'erreur est de mon côté, et je la corrige ici.** La page de vérification existe et fonctionne,
mais elle n'est **pas servie par le site** : c'est le worker Cloudflare qui la sert, à
`<domaine de l'API>/verifier` — donc `api.skanfact.tn/verifier` une fois le worker déployé sur ce
domaine. Mon document disait `skanfact.tn/verifier` : faux.

**Et l'application ne renvoie vers aucune de ces deux adresses.** Vérifié : aucune URL de
vérification n'existe dans `src/`. Il n'y a donc aucun 404 chez un client aujourd'hui — il y a une
page utile que personne ne nomme.

**Ce qu'elle vérifie**, exactement (`repondreVerif`, `POST /v1/verif/licence`) : on colle une
empreinte de licence (16 à 64 caractères hexadécimaux, séparateurs tolérés), elle est cherchée dans
la table des licences, et la réponse est l'un de six états — *illisible*, *inconnue*, *révoquée*,
*remplacée*, *expirée*, *valable* (avec l'offre et la date de fin). **Elle ne dit jamais à qui une
licence appartient**, et la requête SQL ne lit pas la table des clients : c'est la requête qui
protège, pas la forme de la réponse.

**Ce que je recommande au site :** ne pas reconstruire la page. Une seconde implémentation
divergerait, et il lui faudrait un accès à la base que le site n'a pas. Deux chemins, au choix :
soit un lien vers `<api>/verifier`, soit un proxy `skanfact.tn/verifier` → le worker (meilleur pour
la confiance, même domaine). Dans les deux cas, le libellé à employer est celui de la page
elle-même : *« Colle l'empreinte de ta licence — tu la trouves dans SkanFact, sous Paramètres ›
L'application › Licence. »*

### Q3 — La version affichée

**Oui, c'est voulu : le visiteur ne doit voir qu'une version stable.** Mais l'état réel mérite d'être
dit.

| | Version |
|---|---|
| Dernière **stable** publiée | **v10.0.0** (21/09/2026) |
| Dernière **préversion** publiée | v10.4.0-beta.3 (22/09/2026) |
| Code du dépôt | 10.7.0-beta.1 (non publié) |

Entre la dernière stable et le code, **huit versions n'ont jamais été publiées** : 10.0.1, 10.1.0,
10.2.0, 10.3.0, 10.4.0, 10.5.0, 10.6.0 et 10.7.0. Le pied du site a donc raison de lire 10.0.0 —
c'est bien la dernière version qu'un client peut installer.

La prochaine stable passera par une release publiée, comme toutes les autres : le chemin est décrit
dans `CLAUDE.md` § « Publier une version ». Rien de ce qui est écrit ici ne dépend d'une version non
publiée, **sauf le passage d'Achats à l'offre Indépendant (§ 2)** : il est livré en 10.7.0-beta.1 et
donc pas encore chez les clients. Le site peut l'annoncer le jour de la publication, pas avant.

---

## 8. Les points que la session « site » garde, et l'avis d'ici

1. **Mentionner l'option Comptabilité sans son prix** — d'accord, et le raisonnement est meilleur que
   le silence de la première version de ce document. Taire l'option laisserait croire soit que toute
   la comptabilité est payante, soit qu'elle est gratuite ; les deux sont faux.
2. **La question « Qui tient votre comptabilité ? » dans le formulaire de commande** — décision
   commerciale, pas technique, donc pas la mienne. Une remarque utile quand même : la console a déjà
   un champ **« Comment il nous a connus »** dans le suivi d'un prospect (10.5.0). Si la réponse du
   formulaire y arrive, le chiffre « combien d'acheteurs ont un cabinet » se lit dans la console sans
   rien construire de plus.
3. **Les prix TTC 465,100 et 822,100** — arithmétique vérifiée, juste (§ 2). Ils ne vivent pas dans
   le code : l'application facture en HT et calcule TVA et timbre à l'émission.
