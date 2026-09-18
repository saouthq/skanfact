# Ce que le terrain a trouvé

Les constats des sessions où **Skander teste vraiment l'application**, écran par écran, en se
mettant à la place d'un comptable. Ce document n'est ni une spécification ni un plan : c'est le
carnet de ce qu'on a VU, avec l'ancrage exact dans le code, pour que rien ne se reperde entre deux
sessions.

Chaque constat porte : la **gravité**, ce qu'on a vu, **pourquoi ça compte**, et l'ancrage. Rien
n'est corrigé ici — les correctifs partent dans les versions, et la ligne se barre quand c'est fait.

**Règle de la session** : on ne publie RIEN pendant qu'un test est en cours. Une version nouvelle
fait se recharger le jeu d'exemple tout seul (règle 9.4.2) et emporte le travail du testeur.

---

## Session du 18/09/2026 — le premier jour d'un comptable, dans SkanFact Cabinet

Contexte : jeu d'exemple en place, cabinet « Cabinet Elyes », cinq clients. Parcours suivi : la
boucle du mois (recevoir → écrire → contrôler → déclarer → relancer → clôturer) sur **Menuiserie
Trabelsi SUARL**, le seul dossier à trois mois (juin, juillet, août 2026).

### T-01 · GRAVE · Le journal de trésorerie part vide dans CHAQUE paquet

**Vu** : `journaux/tresorerie.csv` d'un paquet reçu porte neuf mouvements dont **les colonnes
Nature, Compte, Entrée et Sortie sont vides ou à 0,000**. Seules Date, Libellé, Référence et Pointé
sont renseignées.

**Pourquoi ça compte** : c'est un fichier que le comptable ouvre pour comprendre les mouvements
d'argent de son client. Quatre colonnes sur huit ne disent rien, et **aucun message ne le signale** —
il conclut que le client n'a rien saisi. Le défaut est dans le PRODUIT, pas dans l'exemple : il
touche tous les paquets envoyés depuis la 6.1.0.

**Ancrage** : `src/renderer/core.js` — `cashCsvColumns()` (ligne ~3530) réclame les clés
`kindLabel`, `accountName`, `inAmount`, `outAmount` ; `cashMovements()` (ligne ~2946) écrit
`kind`, `accountId`, `amount`. Quatre clés qui n'existent nulle part, donc quatre colonnes vides.
Seul `reconciled` correspond des deux côtés.

**Ce qui ne va PAS être corrigé au passage** : `journaux/ecritures.csv` est juste, avec ses montants
et ses comptes. C'est lui que le livre lit, donc la comptabilité du cabinet n'est pas fausse — c'est
la lecture humaine du journal qui l'est.

**Règle du projet violée** : « un champ lu mais jamais écrit donne un chiffre faux tous les jours »
(7.3.0), vue de l'autre côté — ici c'est une colonne qui NOMME une clé que personne n'écrit.

---

### T-02 · GRAVE · L'avertissement « livre incomplet » disparaît quand le livre est créé

**Vu** : sans livre, la page Comptabilité affiche « Il manque 9 mois sur cette période : ces livres
sont incomplets. » Une fois le livre créé par « Créer le livre à partir des paquets reçus… », le
bandeau **disparaît**.

**Pourquoi ça compte** : il disparaît exactement au moment où il compte le plus. Sans livre on ne
peut que LIRE. Avec le livre on peut **valider**, **déclarer la TVA** et **clôturer l'exercice** —
sur un livre à qui il manque neuf mois sur douze, et plus rien ne le dit.

**Ancrage** : `src/cabinet/renderer/app.js:1984` — la branche `if (s.livre)` de
`lignesDeLaPeriode()` renvoie `manquants: []` **en dur**. L'affichage, lui, est correct
(`app.js:2198`, non conditionné à la source) : il n'a simplement plus rien à afficher.

**La nuance à ne pas rater dans le correctif** : avec un livre, « mois manquant » ne veut plus dire
« paquet non reçu ». Un dossier **hors SkanFact** n'a aucun paquet, et lui annoncer « il manque
12 mois » serait du bruit permanent — donc un second défaut. Le manque doit se déduire des **mois de
l'exercice sans la moindre écriture**, jamais des paquets.

**Règle du projet violée** : celle que le commentaire de `app.js:2000` énonce lui-même — « un livre
incomplet qui ne le dit pas est un livre faux », dérivée de « avant d'écrire une phrase rassurante,
vérifier que l'univers concerné est non vide » (7.0.0).

---

### T-03 · MOYEN · Rien ne dit que créer le livre fait apparaître sept onglets

**Vu** : le testeur a cherché l'onglet **Banque** pendant plusieurs minutes et a conclu « il manque,
il faut peut-être publier la dernière version ». Sans livre, la page ne montre que quatre onglets
(Livre-journal, Grand livre, Balance, Lettrage) ; sept autres — **Saisie, Déclaration, Banque,
Immobilisations, Inventaire, Exercice, Recherche** — n'existent qu'une fois le livre créé.

**Pourquoi ça compte** : le choix de les masquer est JUSTE (un onglet Banque sans livre serait un
bouton qui ne peut rien enregistrer). Mais rien ne l'annonce, donc l'absence se lit comme un
manque du logiciel. Le bandeau bleu explique bien la lecture seule ; il ne dit pas ce que le bouton
vert va faire apparaître.

**Ancrage** : `src/cabinet/renderer/app.js:2237–2253` — sept boutons d'onglet sous `${s.livre ? …}`.

**Piste** : le bandeau bleu, ou le bouton, nomme ce qui s'ouvre. Une phrase suffit.

---

### T-04 · MOYEN · « Solde au début » proposé à 0, alors que le livre connaît la réponse

**Vu** : le formulaire d'import d'un relevé propose `0` en solde de départ. Or un relevé bancaire ne
commence quasiment jamais à zéro — il reprend le solde de la veille. Avec `0`, le contrôle de
bouclage passe (il ne vérifie que `début + Σ = fin`), le relevé entre, et **l'écart de suspens sort
faux** : −7 918,355 DT au lieu de −4,500 DT sur le cas testé.

**Pourquoi ça compte** : l'écart de suspens est LA carte qui dit si le mois est propre. Faux, il ne
désigne plus rien — alors qu'avec le bon solde de départ il vaut exactement le montant de la seule
opération que le livre n'a pas. C'est la différence entre un indicateur et du bruit.

**Ce qui le rend sérieux** : c'est l'auteur du guide de test qui est tombé dedans en fabriquant le
fichier. Quelqu'un qui découvre n'a aucune chance de s'en apercevoir — rien à l'écran ne dit que
le chiffre est incohérent avec le livre.

**Ancrage** : `src/cabinet/renderer/app.js:3455` — `<input name="debut" … value="0">`.

**Piste** : proposer le solde du compte choisi **à la veille de la première ligne du relevé**, en le
nommant (« d'après le livre : 7 913,855 »). L'application a l'information : le compte est saisi
juste au-dessus, et la date vient du fichier. À défaut, dire l'écart avec le livre AVANT d'importer.

---

### T-05 · MOYEN · « Relire les paquets reçus » : on n'ose pas cliquer

**Vu** : question posée au testeur — « comprends-tu ce que fait ce bouton **sans** cliquer ? ».
Réponse : « oui j'hésite ». Le bouton vit dans le bandeau **vert** du livre, à côté de « 48 écritures
validées ».

**Pourquoi ça compte** : le geste est en réalité **sûr** — il ajoute les écritures nouvelles,
remplace les brouillards d'un mois renvoyé, et ne touche JAMAIS une écriture validée : il montre les
écarts et laisse le comptable trancher. Mais cette garantie n'apparaît **qu'après** le clic, dans la
fenêtre de compte rendu. Devant un bouton qui parle de « relire » à côté du compteur de ses
écritures validées, on hésite — donc soit on ne s'en sert jamais, soit on clique en craignant de
perdre son travail.

**Ancrage** : `src/cabinet/renderer/app.js:2019` (`relireLesPaquets`, le comportement, correct) et
`app.js:2033` (`infoDialog`, la réassurance, trop tard).

**Règle du projet violée** : « un avertissement se lit AVANT le geste, jamais sous le bouton »
(9.4.2), ici dans l'autre sens — c'est la RÉASSURANCE qui arrive après.

**Piste** : une phrase sous le bouton, ou une bulle « i » : « ajoute ce qui manque, remplace les
brouillards d'un mois renvoyé, ne touche jamais une écriture validée ».

---

### T-06 · GRAVE · L'écart de suspens ne peut pas atteindre zéro, et ignore le solde de départ

**Vu** : relevé d'août importé sur un livre qui porte juin, juillet et août. La carte **Écart de
suspens** affiche **−7 918,355 DT** et **ne bouge pas** quand on corrige les soldes de début et de
fin du relevé. Elle ne bougera pas non plus au rapprochement automatique, et finira à
**−7 913,855 DT** — soit exactement le solde du compte 532 sur juin + juillet.

**Le calcul réel** (`src/renderer/compta.js:1567`, `suspens`) :

```
sB = Σ des lignes du RELEVÉ non rapprochées
sL = Σ des lignes 532 du LIVRE non rapprochées, avec date <= releve.au
ecart = sB − sL
```

Il n'y a **aucune borne basse** côté livre, et `soldeDebut` / `soldeFin` n'entrent **nulle part**.

**Pourquoi ça compte** : c'est la carte qui répond à « ce mois est-il propre ? ». Dès que les relevés
ne couvrent pas toute l'histoire du livre — c'est-à-dire dans la vie réelle, où un cabinet reprend un
dossier en cours d'année — elle affiche un nombre qui ne désigne rien et qui ne peut jamais tomber à
zéro. Le comptable apprend à l'ignorer, et le jour où elle dirait quelque chose de vrai, personne ne
la regarde plus.

**Le symptôme qui trahit le défaut** : `soldeDebut` est demandé, contrôlé (le bouclage refuse un
relevé qui ne tombe pas juste), puis **jamais réutilisé**. Une donnée qu'on exige et qu'on n'emploie
pas est le signe qu'un calcul l'a oubliée.

**Ce qui est juste et ne doit pas bouger** : les deux listes du panneau « Les suspens » (ce que la
banque porte et que le livre n'a pas, et l'inverse) sont correctes. L'absence de borne basse côté
livre est même VOULUE — un chèque émis en juillet et encaissé en août doit apparaître. C'est le
**nombre unique** qui est faux, pas les listes.

**Le chiffre attendu par un comptable** est celui du rapprochement classique :

```
ecart = soldeFin du relevé − solde comptable du compte à la même date
```

Sur le cas testé : 11 735,002 − 11 739,502 = **−4,500**, soit exactement la seule opération que le
livre n'a pas (la commission bancaire). Et **0** une fois cette écriture passée. Un indicateur qui
atteint zéro est un indicateur ; un indicateur qui ne peut pas l'atteindre est une décoration.

**Piste** : ancrer l'écart sur les soldes, et garder les deux listes telles quelles. Vérifier au
passage que la somme des suspens explique bien l'écart — c'est le contrôle qui prouve les deux.

**Règle du projet en jeu** : « un agrégat porte une devise, une unité, et une période nommée »
(3.1.0). Ici la période affichée (« au 31/08/2026 ») laisse croire à une comparaison de soldes à une
date, alors que c'est une différence de deux ensembles de périodes différentes.

---

### T-07 · MINEUR · « Rapprocher automatiquement » sur un relevé déjà rapproché annonce trois zéros

**Vu** : relevé entièrement rapproché (10 sur 10). Clic sur « Rapprocher automatiquement » → le
message est « **0 ligne rapprochée d'office ; 0 à trancher, 0 sans réponse.** ». Le testeur a
rapporté : « rien n'a changé ».

**Pourquoi ça compte** : trois zéros se lisent comme un échec, alors que la réalité est la
meilleure possible — il n'y avait rien à faire. C'est le seul cas où le message devrait annoncer une
bonne nouvelle, et c'est celui où il ressemble le plus à une panne. Un bouton dont la réponse
ressemble à un échec quand tout va bien, on cesse de l'utiliser.

**Ancrage** : `src/cabinet/renderer/app.js:3287` — le `toast` de `brancherBanque` énumère
toujours les trois compteurs. `pl(0, 'ligne rapprochée', …)` rend « 0 ligne rapprochée »
(`app.js:390`).

**Ce qui est juste et ne doit pas bouger** : dire ce qui N'A PAS été posé est la bonne règle
(« 12 validées » en avalant trois refus serait pire). Le défaut est l'absence du cas « rien à
faire », pas la forme du message.

**Piste** : quand les quatre compteurs sont à zéro et que toutes les lignes sont déjà rapprochées,
dire « Tout est déjà rapproché : 10 lignes sur 10. » Distinguer aussi « rien à faire parce que tout
est rapproché » de « rien à faire parce que rien ne correspond » — ce ne sont pas les mêmes
nouvelles.

---

## Comment se servir de ce document

- Un constat qui part dans une version : barrer la ligne, citer le numéro de version.
- Un constat réfuté après vérification dans le code : le garder, barré, **avec la raison** — un
  constat qu'on efface revient à la session suivante.
- Ce document se relit avant chaque version d'entretien.
