# PLAN-PLATEFORME — le plan de contrôle de SkanFact

**État : proposition. Rien n'est construit. À relire et corriger avant la première ligne de code.**

Décidé le 15/09/2026 avec Skander, après la 8.3.0. Ce document fige les **contrats** — identités,
format de clé, modèle de données, points d'entrée, règles intangibles. Ce sont les choses qui coûtent
cher à changer une fois qu'il y a des clients. Les écrans, eux, bougeront toute leur vie.

---

## 1. Pourquoi, et où passe la ligne

Ce qui a déclenché la réflexion, c'est la limite écrite noir sur blanc en 8.2.0 : **une clé livrée ne
se reprend pas**. Un client qui se rétracte garde son logiciel, et « Révoquer » ne peut que le dire
poliment. À côté de ça, Skander ne sait rien de son propre commerce : combien d'essais en cours,
combien convertissent, qui a installé quoi.

La bonne ligne de séparation **n'est pas** « gestion / logiciel ». C'est :

> **Ce qui doit être réveillé en permanence, et ce qui peut dormir.**

Un ordinateur de bureau est éteint la nuit. Si quelqu'un achète à 3 h du matin, il faut que quelque
chose d'éveillé signe sa clé et la lui envoie. SkanFact ne peut pas faire ça, quelle que soit la
qualité du code qu'on y mettrait. C'est la seule raison de créer une plateforme — pas le rangement,
pas l'élégance.

Corollaire, qui évite de tout refaire : **le raisonnement de la 7.33.0 reste juste.** Une vente de
licence est une vraie facture avec sa TVA et son journal des ventes ; elle doit vivre dans SkanFact.
Ce qui change, c'est le sens du flux — l'API pousse, SkanFact tire (§ 11).

### Ce qui ne change pas

- La licence reste une **clé signée, vérifiée hors ligne**. C'est elle qui autorise le logiciel à
  fonctionner, et elle seule. Le serveur ne sert qu'à **gérer**.
- Une application sans réseau fonctionne, indéfiniment.
- Une application dont le serveur est mort, éteint, impayé ou disparu fonctionne, indéfiniment.

---

## 2. Les trois plans

| | Quoi | Où | Toujours allumé |
|---|---|---|---|
| **Le produit** | SkanFact et SkanFact Cabinet, chez le client | son ordinateur | non |
| **Le plan de contrôle** | `api.skanfact.tn` — clients, licences, activations, révocations ; **c'est lui qui signe** | Cloudflare Workers + D1 | oui |
| **La console** | `admin.skanfact.tn` — statistiques, clients, ventes | Cloudflare Pages, lit la même base | — |

Un seul est nouveau. **La console n'est pas un système séparé** : c'est un écran posé sur la base du
plan de contrôle. On construit une base avec deux portes — une pour les machines, une pour Skander.

Le relais de mise à jour (`worker/skanfact-maj.mjs`, 6.7.0) **reste ce qu'il est** et ne se mélange
pas à l'API. Il sert des fichiers de release ; elle gère des licences. Deux métiers, deux workers.
Ils partageront seulement `APP_SECRET` et la liste des clés publiques.

### Pourquoi Cloudflare et pas autre chose

Le relais y tourne déjà. Gratuit à cette échelle, aucun serveur à administrer, aucune base à
sauvegarder à la main, et une seule facture à surveiller. Les alternatives (Supabase, un VPS) ne sont
pas mauvaises — elles ajoutent un fournisseur pour un bénéfice nul aujourd'hui.

---

## 3. Qui a le droit de quoi

C'est la première section parce que c'est elle qui structure tout le reste, et parce que c'est la
question que Skander a posée en premier : *« comment il va savoir que c'est moi ? »*

### Aujourd'hui : la preuve est un fichier

`editeurDeLaCleEnVigueur()` (`src/main.js:550`) lit `~/.skanfact/licence-privee.pem`, en déduit la
clé publique et la compare à celle embarquée. Le panneau `p-editeur` s'affiche si `licence.editeur`
est vrai (`src/renderer/app.js:4526`). Aucun client n'a ce fichier : il n'est ni dans le dépôt, ni
dans le paquet téléchargé.

### Demain : la preuve est un compte

Skander se connecte **une fois** dans SkanFact → Paramètres → Éditeur. L'application range un jeton
de poste dans `userData/app-config.json` — jamais dans les données de l'entreprise, jamais dans les
sauvegardes, jamais dans un dossier partagé. Chaque appel au pont le présente.

C'est meilleur que le fichier sur trois points, et ce sont exactement les cas que Skander redoutait :

| | Fichier (aujourd'hui) | Compte (demain) |
|---|---|---|
| **Changer d'ordinateur** | recopier un `.pem` à la main au bon endroit | se reconnecter |
| **Perdre l'ordinateur** | l'historique des ventes vit dans `data.licences`, sur ce Mac | tout est sur le serveur, la console s'ouvre d'un navigateur |
| **Se le faire voler** | le voleur fabrique des licences valides **pour toujours** | on révoque le jeton en un clic |

### La règle qui compte plus que tout le reste

> **Cacher un écran est de la politesse. C'est la clé qui fait la sécurité.**

Le dépôt est public **provisoirement**, le temps du développement, et redeviendra privé en production
(Actions y est gratuit sur un dépôt public — voir § 15). Mais **ça ne change rien à la sécurité** :
une application installée s'ouvre avec `asar extract`, dépôt privé ou pas. C'est comme ça qu'on a
vérifié en 8.0.0 que la clé publique était bien embarquée.

Donc quelqu'un peut toujours forcer l'affichage du module Éditeur chez lui. **Il obtiendra un
formulaire vide** : pour émettre, il faut signer ; pour signer, il faut la clé privée, qu'il n'a pas.
Et une clé mal signée est refusée par chaque SkanFact installé sur terre. C'est déjà la règle du
projet depuis la 6.2.0 (« une clé publique ne se protège pas, elle se vérifie ») et la 7.33.0 (« le
secret n'est pas le code, c'est la clé »). On ne cherche **jamais** à protéger un écran.

### Les trois sortes d'appelants

| Appelant | Ce qu'il présente | Ce qu'il peut faire |
|---|---|---|
| **Une application cliente** | `APP_SECRET` + sa clé de licence + son `deviceId` | déclarer son activation, demander son état. Rien d'autre. |
| **SkanFact chez l'éditeur** | un **jeton de poste** | tout ce qui précède, plus lire les ventes et les marquer facturées |
| **La console** | une **session admin** (email + mot de passe) | tout |

Une application cliente **ne s'authentifie pas avec un compte** : sa clé signée est sa propre preuve.
C'est une conséquence heureuse du choix hors ligne — un client n'a aucun mot de passe à retenir, rien
à créer, rien à perdre. **Il n'y a pas de compte client en v1** (§ 13).

---

## 4. Les clés de signature

C'est la décision la plus structurante du document, et celle qu'on ne peut pas rattraper après.

Automatiser l'émission veut dire que **la clé de signature s'installe sur le serveur**. C'est un vrai
recul : aujourd'hui elle dort sur un Mac éteint la nuit. La parade est celle des autorités de
certification, celles qui signent les certificats HTTPS de tout l'internet : **deux clés**.

| | Où elle vit | Ce qu'elle signe |
|---|---|---|
| **`master`** | la clé actuelle de Skander, hors ligne (`~/.skanfact/` + copie à l'abri) | les cas exceptionnels, et l'autorisation d'une rotation |
| **`srv-1`** | un secret Cloudflare, jamais dans le dépôt, illisible une fois posé | les ventes courantes, automatiquement |

L'application fait confiance **aux deux**, chacune avec son identifiant (`kid`). Si le serveur est
compromis un jour : on retire `srv-1` dans la version suivante, on continue à vendre avec `master`, et
**aucune licence déjà vendue n'est invalidée**. Sans ce mécanisme, Skander serait coincé entre laisser
faire et tuer tous ses clients d'un coup.

Conséquence heureuse : la clé maître ne sert plus au quotidien. Perdre son portable ne l'empêche plus
de travailler une seule minute.

### `build/licence-public.json` devient `build/licences-publiques.json`

```json
{ "cles": [
  { "kid": "master", "publicKey": "-----BEGIN PUBLIC KEY-----…", "depuis": "2026-09-14" },
  { "kid": "srv-1",  "publicKey": "-----BEGIN PUBLIC KEY-----…", "depuis": "2026-10-01" }
] }
```

Règles, chacune tenue par un test :

1. **La clé `master` est celle de la 8.0.0, au caractère près.** Ne jamais la supprimer, la
   régénérer ni la remplacer : une autre clé invaliderait toutes les licences déjà vendues. Le
   fichier actuel est **conservé tel quel** dans le dépôt le temps de la transition.
   *(Livré en 8.4.0. Le fichier porte aussi la clé publique qui vérifie les RÉPONSES du serveur,
   champ `reponse` — elle n'a rien à voir avec les licences, et sa compromission ne permettrait
   jamais d'en fabriquer une.)*
2. **Une clé sans `kid` se vérifie avec `master`.** Toutes les licences émises entre la 8.0.0 et
   aujourd'hui n'ont pas de `kid` : sans cette règle, la mise à jour les invaliderait toutes. C'est le
   point de compatibilité le plus dangereux du chantier.
3. **Ajouter une clé** = une nouvelle version de l'application. **Retirer une clé** = une nouvelle
   version **et** la réémission des licences qu'elle avait signées — ce qui n'est possible que parce
   qu'un registre existe. C'est une des raisons d'être du registre.
4. La clé privée maître **ne quitte jamais son support**. Le serveur ne la voit jamais. Aucune session
   Claude ne l'a jamais vue et ne doit jamais la voir.
5. `build/` doit rester dans les `files` d'electron-builder, et le glob couvre le nouveau nom. Le
   paquet sera **ouvert et vérifié** (`asar extract-file`) avant de dire que c'est embarqué — la
   7.33.0 a appris que `build/` n'y était pas, et ça ne se voit qu'en regardant dedans.

---

## 5. Le format de la clé, v2

Aujourd'hui (`src/licence.js`), la charge signée porte : `format`, `nom`, `matricule`, `offre`,
`exp`, `cabinet`, plus la date de création. Le préfixe est `SKAN1.` et `FORMAT` vaut 1.

La v2 ajoute quatre champs et n'en retire aucun :

| Champ | Rôle |
|---|---|
| `kid` | quelle clé a signé (§ 4). Absent ⇒ `master`. |
| `lic` | l'identifiant de la licence dans la base — le fil qui relie la clé au registre |
| `sub` | l'identifiant **du client**, stable, qui survit à un changement de matricule |
| `postes` | nombre d'activations autorisées. Absent ⇒ illimité (toutes les clés d'avant). |

`format` passe à 2, le préfixe reste `SKAN1.` (c'est la version du conteneur, pas de la charge).

**Ce qui est autorisé voyage dans la clé, jamais dans le code.** `OFFRES` et ses `reserves` restent où
ils sont, mais le jour où une offre « Cabinet 5 postes » apparaîtra, ce sera une ligne dans la base et
un champ dans la clé — pas une nouvelle version du logiciel.

**Règle de tolérance, déjà écrite en 7.33.0 et à ne pas casser :** une offre inconnue, un champ
absent, un format plus récent que celui que l'application connaît → on retombe sur le plus permissif.
En cas de doute, **on ouvre**. Jamais de données en otage.

---

## 6. Le modèle de données

Six tables. Tout est en append-only pour ce qui raconte une histoire.

```
clients      id · nom · matricule · email · tel · adresse · cree_le · notes
licences     id · client_id · kid · offre · postes · debut · fin · prix · devise
             · remise · cabinet_empreinte · statut · emise_le
             · remplace_id · revoquee_le · revoquee_motif
activations  id · licence_id · device_id · device_nom · plateforme · version
             · premiere_fois · derniere_fois
ventes       id · client_id · licence_id · montant_ht · tva · devise
             · payee_le · moyen · facture_skanfact · importee_le
jetons       id · nom · empreinte · cree_le · dernier_usage · revoque_le
evenements   id · quand · quoi · licence_id · client_id · detail · par_qui
```

Règles :

- **Le client est une entité, la licence en est une autre.** Un client peut avoir deux licences, en
  renouveler une, changer de matricule. Aujourd'hui la clé est attachée au matricule et rien ne relie
  deux achats de la même personne — c'est ce qui coûterait cher à rattraper après la vente.
- **Tout est un événement, jamais un écrasement.** « Révoquée le 14/10 pour rétractation » reste
  écrit pour toujours. Réflexe déjà présent dans le projet (`closureLog`, `remplaceePar`) ; il devient
  la règle côté serveur. Sans ça, impossible de répondre à un client six mois plus tard.
- **`statut` est déduit, pas saisi** — comme le statut d'une facture depuis la 1.4.0 : *active*,
  *expirée*, *révoquée*, *remplacée*. Une valeur en dur finirait par mentir.
- Les motifs de remplacement restent ceux de la 8.2.0 (`LICENCE_MOTIFS`) : renouvellement, changement
  d'offre, correction de matricule. Trois gestes, trois libellés — les confondre ferait mentir la
  colonne.

---

## 7. L'API, v1

Versionnée **dès le premier jour** : une application installée chez un client ne se met pas à jour sur
commande. Le jour où la forme d'une réponse doit changer, `/v2/` naîtra à côté et `/v1/` continuera de
répondre pendant des années.

### Côté application cliente

```
POST /v1/licence/etat
     en-têtes : X-SkanFact-App: <APP_SECRET>
     corps    : { cle, deviceId, deviceNom, plateforme, version }
     réponse  : { etat, offre, postes, fin, message, signature, emisLe }
```

**Un seul point d'entrée**, qui fait les deux choses : il enregistre (ou rafraîchit) l'activation et
renvoie l'état. Deux endpoints séparés « activer » et « vérifier » se seraient désynchronisés ; moins
de surface, moins à se tromper.

`etat` vaut `active`, `revoquee`, `expiree` ou `inconnue`.

**La réponse est signée par la clé serveur, et l'application vérifie cette signature.** Sans ça,
quelqu'un capable de se placer entre le client et le serveur pourrait répondre « révoquée » et
bloquer un client honnête. La réponse porte sa date (`emisLe`) : une réponse trop vieille est
ignorée, sinon on pourrait rejouer une ancienne réponse pour annuler une révocation.

**Une révocation reçue est gardée sur le poste.** Sinon il suffirait de se débrancher pour l'annuler.

### Côté éditeur (jeton de poste ou session admin)

```
GET    /v1/admin/clients                       POST /v1/admin/clients
GET    /v1/admin/licences                      POST /v1/admin/licences          ← signe la clé
POST   /v1/admin/licences/:id/revoquer
POST   /v1/admin/licences/:id/changer-offre    POST /v1/admin/licences/:id/renouveler
GET    /v1/admin/ventes?non_facturees=1        POST /v1/admin/ventes/:id/facturee
GET    /v1/admin/stats
```

`POST /v1/admin/licences` est le seul endroit au monde où la clé serveur signe. Il fait trois choses
dans le même geste, comme aujourd'hui en 7.33.0 : la clé, la ligne de vente, la ligne d'historique.

---

## 8. Les règles intangibles

Celles-ci passent avant toute demande de fonctionnalité. Chacune doit être tenue par un test.

1. **On laisse toujours passer en cas de panne.** Serveur injoignable, DNS mort, pare-feu, compte
   Cloudflare fermé, éditeur disparu : l'application fonctionne. C'est la règle 6.7.2 (« un chemin de
   secours ne sert que s'il se déclenche tout seul ») appliquée au plan de contrôle.
2. **Jamais de données en otage.** Une licence révoquée ou expirée bloque la **création** de nouvelles
   pièces. Lire, imprimer, exporter, sauvegarder, envoyer le paquet au comptable : toujours.
3. **Pas d'activation obligatoire au premier lancement.** Quelqu'un qui installe dans un atelier sans
   wifi colle sa clé et démarre. L'activation se déclarera plus tard, toute seule.
4. **La clé signée reste la source de vérité pour fonctionner.** Le serveur ne peut qu'ajouter une
   restriction connue (révocation), jamais accorder un droit que la clé ne porte pas.
5. **Une révocation ne mord qu'après avoir été reçue.** Un client éternellement hors ligne n'est jamais
   coupé. C'est assumé : c'est de toute façon la même population que celle qui contournerait.
6. **Aucune donnée d'entreprise ne remonte** (§ 9).
7. **La sécurité ne repose jamais sur le secret du code** (§ 3).
8. **Les mises à jour ne dépendent pas de la licence.** Règle 6.7.0 : une licence expirée ou révoquée
   reçoit quand même les corrections de bugs. Décision prise avec Skander le 15/09/2026.

---

## 9. Ce qui remonte, et ce qui ne remonte jamais

**Remonte :** la clé de licence (elle est déjà présentée au relais depuis la 6.7.0), le `deviceId`
(un UUID tiré au hasard, déjà présent dans `app-config.json`), le nom donné au poste, la plateforme,
le numéro de version, la date.

**Ne remonte jamais :** un client, une facture, un montant, un salarié, un fournisseur, un fichier,
un chemin de dossier, une adresse e-mail saisie dans l'application.

La clé elle-même contient le nom et le matricule de l'acheteur — c'est normal, c'est le contrat de
vente. Rien de plus ne part.

**Et l'application le dit à l'écran.** La 8.0.0 a déjà attrapé une phrase rassurante devenue fausse
sur ce sujet (« SkanFact n'envoie jamais ta clé nulle part »). Un test relit la phrase et la liste
des champs envoyés : les deux ne peuvent pas diverger.

**À VÉRIFIER — INPDP.** Tenir un registre de clients tunisiens avec matricule fiscal et adresse est un
traitement de données à caractère personnel. Il y a probablement une déclaration à déposer auprès de
l'Instance Nationale de Protection des Données Personnelles. À confirmer avec un juriste ou le
comptable **avant la première vraie vente**, pas après.

---

## 10. La console

Une page, six onglets : **Tableau de bord · Clients · Licences · Activations · Ventes · Journal**.

Volontairement moche en v1, et complète. Ce qu'elle doit répondre du premier coup d'œil : combien
d'essais en cours, combien finissent cette semaine, combien de licences actives, combien d'impayées,
combien de clés jamais activées.

Elle hérite des règles d'interface du projet, parce qu'elles ne sont pas propres à SkanFact :

- Un chiffre affiché s'ouvre (7.15.0). « 3 clés jamais activées » est une question tant qu'on ne peut
  pas cliquer dessus.
- Un geste destructeur demande ; un geste réparable laisse un « Annuler » (7.12.0).
- Le pluriel s'accorde. « 1 licence(s) » sur l'écran d'un éditeur de logiciel, non.

---

## 11. Le pont comptable

Le module Éditeur dans SkanFact **rétrécit** au lieu de grossir. Il cesse d'être l'endroit où vivent
les licences et garde un seul rôle : le lien avec la comptabilité.

```
Skander ouvre SkanFact
  → l'app demande  GET /v1/admin/ventes?non_facturees=1
  → elle fabrique un BROUILLON de facture par vente (jamais nextNumber, règle 6.0.0)
  → à l'émission, elle répond  POST /v1/admin/ventes/:id/facturee { numero }
```

Un **tirage**, jamais une poussée : un serveur ne peut pas écrire dans un logiciel de bureau éteint.

Migration : les lignes de `data.licences` déjà présentes sont **envoyées une fois** vers la base au
premier branchement, pour que rien de l'historique ne soit perdu. `data.licences` devient ensuite un
miroir local, utile hors ligne, qui n'est plus la source de vérité.

**Simplification à gagner au passage :** une fois la plateforme en place, Skander peut s'émettre une
licence à vie comme n'importe quel client. L'état spécial `editeur` — qui n'existe que parce qu'on ne
peut pas être client de soi-même — peut disparaître. Moins de code, et plus un seul chemin emprunté
par une seule personne au monde. À faire **après** la mise en service, pas pendant.

---

## 12. Le paiement

**Viser un clic, pas zéro.** Skander marque « payé » dans la console, la clé part par mail dans la
seconde. 95 % du bénéfice, et ça marche avec un virement comme avec une carte.

La raison est concrète : une PME tunisienne à qui on vend 390 DT veut souvent une facture et paie par
virement. Une automatisation qui suppose une carte bancaire ne servirait à personne le premier mois.

Le jour où un encaissement en ligne est branché, il déclenche **le même bouton**. Rien à réécrire.

**À VÉRIFIER, aucun n'est technique :**
- Les solutions locales (Konnect, Paymee, Flouci, ClicToPay) : laquelle accepte une SUARL, à quel
  coût, avec quel délai de versement.
- Les plateformes internationales type Paddle ou Lemon Squeezy, qui géreraient la TVA européenne :
  question de rapatriement des devises et d'Office des Changes. C'est un sujet de banquier.

---

## 13. Ce qu'on ne construit PAS avant la première vente

Inscription en autonomie, portail client, gestion d'abonnement par le client, relances de paiement
automatiques, multi-devises, boutique en ligne, application mobile, facturation récurrente
automatique.

Ce sont des réponses à des problèmes qui n'existent pas encore. **La structure doit être bâtie avant
la production ; la surface, non.** Construire une plateforme complète avant la première vente est la
façon la plus courante de ne jamais vendre.

---

## 14. L'ordre de livraison

| Étape | Quoi | Ce qui marche à la fin |
|---|---|---|
| ~~**P 0.1**~~ ✅ | base D1, `POST /v1/licence/etat`, console en lecture seule | on **voit** les activations. Rien ne bloque, rien ne dépend du serveur. |
| ~~**8.4.0**~~ ✅ | clés multiples (`kid`), activation, état, révocation appliquée, bandeau | l'application parle à la plateforme et respecte une révocation |
| ~~**P 0.2**~~ ✅ | émission depuis la console (clé serveur), révocation, ventes, envoi du mail | une vente complète sans ouvrir SkanFact |
| ~~**8.5.0**~~ ✅ | la clé du serveur se fabrique dans SkanFact ; l'application accepte une clé `srv-1` | une clé de la console se vérifie, si la version embarque `srv-1` |
| ~~**8.6.0**~~ ✅ | la publique `srv-1` (créée le 15/09/2026) embarquée | une clé émise depuis la console est reconnue chez les clients à jour |
| ~~**8.7.0**~~ ✅ | le pont comptable, migration de `data.licences` | les factures se fabriquent toutes seules |
| ~~**9.4.1**~~ ✅ | la clé de réponse recréée (17/09/2026, sur le Mac de Skander) et embarquée ; sa privée dans `REPONSE_PRIVATE_KEY` | la révocation s'applique chez tout client à jour |
| **P 1.0** | console complète, statistiques, journal | on pilote |

Une semaine de travail environ, **0 DT par mois** d'infrastructure. Après ça la structure ne bouge
plus : ce qui évoluera en production, c'est l'UX et les fonctionnalités, jamais les fondations.

---

## 15. Les tests qui prouvent

Même exigence que le reste du projet : **tout correctif se prouve en réintroduisant le défaut.**

- Les fonctions pures du worker (routage, autorisation, signature, grâce, états) sont testées dans
  `npm test`, comme celles du relais depuis la 6.7.0.
- `npm run e2e:plateforme` — une vente de bout en bout contre un faux serveur local :
  1. une clé **sans `kid`** (émise en 8.0.0) est toujours acceptée ;
  2. serveur **éteint** → l'application fonctionne, aucun message rouge ;
  3. serveur qui répond « révoquée » **avec une signature valide** → création bloquée, lecture et
     export libres ;
  4. la même réponse **sans signature valide** → ignorée ;
  5. une réponse **rejouée** (trop vieille) → ignorée ;
  6. premier lancement **sans réseau** → la clé s'installe et l'application démarre.
- `e2e:licence` est étendu, pas remplacé. Ses assertions sur l'état `editeur` seront à **retourner**
  le jour du § 11 — quand une règle change, c'est le test qui se relit en premier (7.12.0, 7.26.0,
  8.0.1, 8.2.0 : c'est la sixième fois).

---

## 15 bis. Ce que la direction du 15/09/2026 ajoute (`DIRECTION.md`)

Le Cabinet devient un logiciel de tenue payant pour les dossiers hors SkanFact. Pour la plateforme,
ça veut dire : une **offre Cabinet** (clé `type: 'cabinet'`, `dossiersHors: N`, sujet = l'empreinte
du cabinet), une table `cabinets` et la vue « les dossiers de ce cabinet » dans la console, l'émission
et la facturation par palier, et la **licence du client dans le manifeste du paquet** pour que le
Cabinet sache, hors ligne, quel dossier est sur SkanFact. Le détail est au § 5.A et § 5.B de
`DIRECTION.md` ; l'ordre est au § 7 (après la saisie, étape 4). La question n° 5 ci-dessous est
tranchée : **on ne vend pas des postes, on vend des dossiers** — postes illimités.

## 16. Questions ouvertes

1. **INPDP** — déclaration du registre clients (§ 9). **À VÉRIFIER avant la première vente.**
2. **Encaissement** — solution locale ou internationale, et l'Office des Changes (§ 12).
3. **Le dépôt privé coûte des minutes Actions.** Le dépôt est public **provisoirement**, le temps du
   développement, précisément parce qu'Actions y est gratuit ; il redeviendra privé en production. Ce
   jour-là, le quota revient — et la 6.7.2 a montré que six publications en une matinée consomment le
   quota gratuit d'un mois (les machines macOS sont facturées dix fois les autres). Il faudra soit
   regrouper les publications, soit payer, soit construire localement. **À trancher avant la
   bascule**, pas le jour où un job meurt en cinq secondes sans démarrer.
4. **Le relais partage-t-il le worker de l'API ?** Proposition : non, deux workers distincts, deux
   métiers. À confirmer.
5. **Nombre de postes par offre.** Le champ existe (§ 5) ; la valeur commerciale n'est pas décidée.
   La page Tarifs du site n'en parle pas aujourd'hui.

---

## 17. Décisions prises (ne pas rediscuter)

- Une plateforme séparée, oui — parce qu'un logiciel de bureau ne peut pas être un serveur (§ 1).
- On **construit**, on n'achète pas (Keygen, Cryptolens, LicenseSpring). La partie difficile — la
  licence signée vérifiée hors ligne — est déjà écrite, testée et embarquée. Ce qui reste est une base
  et cinq points d'entrée. Acheter voudrait dire tout refaire, payer un abonnement, et remettre la
  survie du produit entre les mains d'un tiers : l'inverse exact de sa promesse.
- Cloudflare Workers + D1, parce que le relais y est déjà.
- Deux clés de signature, maître hors ligne et serveur en ligne (§ 4).
- Un clic pour vendre, pas zéro (§ 12).
- Aucune donnée d'entreprise ne remonte, jamais (§ 9).
- Le logiciel fonctionne sans le serveur, pour toujours (§ 8).

---

## 18. Runbooks de la plateforme (déplacés de `CAHIER-DES-CHARGES.md` v1.1, 15/09/2026)

Deux procédures d'exploitation, écrites dans la v1 du cahier des charges et déplacées ici parce
qu'un cahier dit ce que le logiciel doit faire, pas ce que l'opérateur tape. Chaque réglage nommé
est détaillé dans `plateforme/README.md`. Format : **déclencheur → étapes → vérification → ce qu'on
ne fait jamais**. Skander ne tape rien, c'est Claude qui exécute, sauf mention « sur le Mac de
Skander ».

**R1 — Mettre la plateforme en production.** Déclencheur : la première vente. Étapes (sur le Mac
de Skander) : Paramètres → Éditeur → « Créer la clé de réponse » → la **privée** (`BEGIN PRIVATE
KEY`) dans le réglage Cloudflare `REPONSE_PRIVATE_KEY` **et nulle part ailleurs** ; la **publique**
collée dans la conversation → `build/licences-publiques.json` → `reponse` ; `SRV_PRIVATE_KEY`
(déjà en place) ; `LICENCE_PUBLIC_KEYS` = le contenu du fichier ; `ADMIN_SECRET` ≥ `ADMIN_MIN`
(24) ; `RESEND_API_KEY`, `MAIL_FROM` ; coller `schema-a-coller.sql` dans D1 ; `GET /v1/admin/etat`
→ `emission.ok`, `mail.ok`, `reponse: true`. Puis publier la version qui embarque `reponse`.
Vérification : `e2e:plateforme` contre l'adresse réelle (variable d'environnement). Jamais :
embarquer une publique dont la privée a été **vue** (la clé de réponse du 15/09/2026 était brûlée ;
celle du 17/09/2026 est embarquée depuis la 9.4.1 — ce geste-là est **fait**) ; poser
`LICENCE_REQUISE=1` avant que tous les clients aient une clé.

**R2 — Retirer `srv-1` (compromission).** Déclencheur : la privée `SRV_PRIVATE_KEY` a été vue ou
copiée hors de Cloudflare. Étapes : `retiree: true` sur l'entrée `srv-1` de
`build/licences-publiques.json`, **jamais** l'effacer ; créer `srv-2` (même geste que 8.5.0,
Paramètres → Éditeur → « Créer la clé du serveur ») ; `SRV_PRIVATE_KEY` remplacée sur Cloudflare ;
**réémettre** chaque licence signée par `srv-1` (`GET /v1/admin/licences` → `kid = 'srv-1'` →
renouveler) et renvoyer les clés ; publier. Vérification : une clé `srv-1` refusée par `verifyKey`
de la nouvelle version, une clé `srv-2` acceptée, une clé **sans `kid`** toujours acceptée
(`master`). Jamais : toucher à `master` — une autre clé maître invaliderait toutes les licences
vendues depuis la 8.0.0.

**R3 — Mettre l'espace de gestion (10.4.0) en service.** Déclencheur : la 10.4.0 est écrite,
testée et commitée ; il reste à la mettre en ligne. Les étapes sont dans cet ordre parce que la
console interroge le relais : le relais d'abord, sinon elle reçoit un 404 et l'annonce.

| | Étape | État |
|---|---|---|
| 1 | `ALTER TABLE activations ADD COLUMN app TEXT;` dans D1 | **fait le 21/09/2026, succès** |
| 2 | Redéployer le **relais** (`worker/skanfact-maj.mjs` → worker `skanfact-maj`) — c'est lui qui gagne `/sante` | à faire |
| 3 | Redéployer la **console** (`plateforme/skanfact-api.mjs` → worker `skanfact-api`) — onglets « À décider », « Parc », « Cabinets », export, ligne d'argent | à faire |
| 4 | *(facultatif)* `RELAIS_BASE` (Text) et `RELAIS_SECRET` (Secret) sur **skanfact-api** | à faire |
| 5 | Publier **10.2.0 + 10.3.0 + 10.4.0** en **bêta** (les trois touchent des chiffres ou un format : § « Publier une version » de `CLAUDE.md`) | à faire |

Sur l'étape 1 : rejouer l'`ALTER` une seconde fois répond « duplicate column » — c'est sans
gravité, la colonne est posée. `NULL` y vaut « app entreprise », la seule qui s'annonçait avant la
10.4.0 (§ 10.4.0 de `CLAUDE.md`).

Sur l'étape 4 : `RELAIS_BASE` est l'adresse **racine** du worker du relais (rien après), et
`RELAIS_SECRET` est l'`APP_SECRET` **du relais**, c'est-à-dire le secret de dépôt `UPDATE_SECRET`.
**Ce n'est PAS l'`APP_SECRET` de la console**, qui vaut `PLATEFORME_SECRET` : les deux workers
vérifient le même en-tête `X-SkanFact-App` mais contre deux secrets différents, et les recopier
l'un sur l'autre donne un 403 permanent. La valeur se retrouve dans `relais.local.json` à la racine
du clone sur le Mac de Skander (en clair, mode 600, écrit par `Installer SkanFact.command`, jamais
commité), ou dans le `package.json` de `app.asar` d'une application installée construite par la CI.
Vérifié le 21/09/2026 : elle n'a **jamais** transité par une conversation.

Vérification : rouvrir la console, la ligne sous les cartes passe de « canaux : non lus » à
« Les N canaux stables servent une version ». Un **403** dit que `RELAIS_SECRET` ne correspond pas
à l'`APP_SECRET` du relais ; un **404**, que le relais n'a pas été redéployé. Jamais : publier ces
trois versions en stable direct ; laisser la console afficher un vert qu'elle ne peut pas prouver
(sans les deux réglages elle écrit « non lus » **avec la raison**, et c'est le comportement voulu).
