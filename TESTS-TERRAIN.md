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

**Le bon modèle existe un onglet plus loin** (constaté le 18/09) : le lettrage automatique répond
« **Rien à lettrer d'office : 5 lignes ouvertes, aucune paire qui se solde sans ambiguïté.** » — une
phrase pour le cas « rien à faire », avec sa raison. C'est exactement ce qui manque à la banque.

---

### T-08 · MOYEN · Réimporter le même fichier reproche les SOLDES avant de dire qu'il est déjà là

**Vu** : relevé déjà importé. On le réimporte avec des soldes quelconques (23220 / 11110) → refus
« **Ce relevé ne se boucle pas** : … il manque 15 931,147 ». Le vrai motif — *ce fichier a déjà été
importé* — n'apparaît que si l'on prend la peine de retrouver les bons soldes d'abord.

**Pourquoi ça compte** : le doublon est une propriété du **fichier**, connue avant toute saisie —
l'empreinte est calculée à la lecture, et le fichier est nommé à l'écran. Reprocher les soldes
envoie le comptable chercher dans un relevé papier une information qui ne servira à rien : il
reviendra dix minutes plus tard pour apprendre que l'import n'aurait de toute façon pas eu lieu.
Deux refus pour une seule situation, et le premier est un faux motif.

**Ancrage** : `src/renderer/compta.js:1399` — `ajouterReleve` appelle `releveValide` (bouclage) en
premier, et ne teste l'empreinte qu'à la ligne 1406.

**Ce qui est juste et ne doit pas bouger** : les deux contrôles, et leurs deux phrases. C'est leur
ORDRE qui trompe.

**Vu de plus** (capture du 18/09, refus obtenu avec les bons soldes) : la fenêtre affiche un bandeau
**vert** « 10 lignes lues · mouvements 3 821,147 DT » **en même temps** que le refus rouge s'affiche
en bas de l'écran. Deux messages contradictoires sur le même écran, et le rassurant est celui qui se
trouve dans la fenêtre où l'œil est posé. L'empreinte est connue à la lecture du fichier,
c'est-à-dire **au moment exact où l'app écrit le vert**.

**Piste** : tester l'empreinte avant le bouclage. Mieux : le dire **dès que le fichier est choisi**,
dans l'aperçu — le bandeau vert devient orange et nomme la date du premier import, le bouton
« Importer » s'éteint en disant pourquoi (règle 9.4.5), et les champs de solde deviennent inutiles à
remplir.

**Règle du projet en jeu** : « un refus dit trois choses : ce qui est refusé, pourquoi, et le bouton
qui débloque » (7.0.0). Ici le *pourquoi* annoncé n'est pas le vrai.

---

### T-09 · GRAVE · Les NEUF boutons « Annuler » de l'app Cabinet sont inertes

**Vu** : dans la fenêtre d'import d'un relevé, le bouton « Annuler » ne fait rien. Constaté par le
testeur : « et le bouton annuler (pour fermer) ne marche pas ne fait rien btw ».

**Ce n'est pas un bouton, c'est tous.** `modal()` de l'app Cabinet branche Échap, le clic sur le
fond, et la touche Entrée vers le bouton principal — **jamais `[data-close]`**. Les neuf boutons
« Annuler » de l'application sont donc parfaitement visibles et parfaitement morts, depuis toujours.

**Pourquoi ça compte** : c'est le symptôme le plus démoralisant qui soit — on clique, rien ne se
passe, on reclique, on doute de soi puis du logiciel. Et il se produit au pire moment : dans une
fenêtre, donc quand on vient de décider de NE PAS faire quelque chose. La sortie existe (Échap, ou
un clic à côté), donc ce n'est pas un piège sans issue — c'est pire à sa façon : le seul chemin
visible est celui qui ne marche pas, et le chemin qui marche n'est écrit nulle part.

**Ancrage** :
- `src/cabinet/renderer/app.js:229-298` — `modal()` : `onKey` (Échap → `dismiss`), le `mousedown`
  sur la couche, le `keydown` pour Entrée, puis `onMount(layer, close)`. Aucune ligne ne cherche
  `[data-close]`.
- Les neuf boutons morts : lignes **2070, 2744, 2768, 2990, 3147, 3365, 3399, 3463, 6062**.
- **Le jumeau existe et fonctionne** : `src/renderer/app.js:505` —
  `$$('[data-close]', layer).forEach(b => b.addEventListener('click', close));`, plus les lignes
  538 et 550 pour `confirmDialog` et `choiceDialog`.

**Ce qui est juste et ne doit pas bouger** : Échap et le clic sur le fond valent « Annuler », et la
promesse posée par la fenêtre se résout toujours (règle 5.2.2). Le mécanisme de sortie est bon ;
c'est son bouton qui n'y est pas relié.

**Piste** : une ligne dans `modal()`, copiée de l'app entreprise. Et un test qui compte, des DEUX
côtés : tout `[data-close]` posé dans une couche doit refermer cette couche — sinon la même ligne
disparaîtra un jour d'un seul des deux fichiers, sans que rien ne le dise.

**Règles du projet en jeu** : « une règle apprise d'un côté se vérifie de l'autre, à la main »
(7.3.0) — celle-ci ne l'a jamais été ; et « un bouton qui ne répond pas est pire qu'un bouton
absent » (7.0.0), qui avait coûté les treize « Voir » morts de l'app entreprise.

---

### T-10 · MINEUR · La pastille d'un onglet veut dire trois choses différentes

**Vu** : la barre d'onglets de la comptabilité d'un dossier porte des pastilles `tab-n`. Elles ne
comptent pas la même chose :

| Onglet | Ce que la pastille compte | Ce que le lecteur comprend |
|---|---|---|
| Saisie | les écritures **en brouillard** | à traiter ✔ |
| Banque | les lignes **non rapprochées** | à traiter ✔ |
| Immobilisations | **le nombre de biens** | à traiter ✘ — c'est un inventaire |
| Exercice | le mot « **clos** » | un état, pas un nombre |

**Pourquoi ça compte** : une pastille sur un onglet se lit universellement comme « il y a N choses
qui t'attendent là-dedans ». « Immobilisations 4 » sur un dossier dont les quatre fiches sont
parfaitement à jour envoie le comptable ouvrir un onglet où il n'a rien à faire. Répété chaque
matin, ça apprend à ignorer les pastilles — y compris les deux qui disent vrai.

**Ancrage** : `src/cabinet/renderer/app.js:2237-2252` — quatre expressions dans la même barre, trois
sémantiques.

**Ce qui est juste et ne doit pas bouger** : Saisie et Banque. Et la pastille **disparaît** quand le
compte tombe à zéro, ce qui est la bonne règle.

**Piste** : une pastille = « ce qui attend une décision », partout. Immobilisations compterait les
biens dont la dotation de l'exercice n'est pas passée ; Exercice garderait « clos » mais dans un
autre habit (le mot n'est pas un compteur).

**Un cas de plus, vu le 18/09** : sur un exercice **clos**, l'onglet Saisie garde sa pastille `1`
(une écriture en brouillard) alors que l'écran répond « L'exercice 2026 est clos. On n'y saisit
plus. » Un compteur qui annonce une chose à traiter sur un écran qui refuse de la traiter. Le refus,
lui, est parfait — il nomme le geste qui débloque. C'est la pastille qui devrait se taire, ou dire
autre chose (« 1 en attente, exercice clos »).

---

### T-11 · MOYEN · Le lettrage NOMME des pièces et n'en ouvre aucune

**Vu** : l'onglet Lettrage liste, tiers par tiers, les pièces qui restent ouvertes — numéro, date,
débit, crédit, reste. Chaque ligne se termine par une **colonne vide**, et aucune ligne ne s'ouvre.

**Pourquoi ça compte** : « FAC-2026-014 · 3 200,000 DT · en retard » est une **question**, pas une
information : le comptable veut voir la pièce pour comprendre pourquoi elle n'est pas soldée. C'est
très exactement la règle 7.15.0 — *un écran qui NOMME un ensemble doit pouvoir l'ouvrir*. Et la
colonne vide en bout de ligne coûte de la largeur à toutes les autres (règle 9.4.4).

**Ancrage** : `src/cabinet/renderer/app.js:2419-2423` — la ligne porte `data-piece` et un
`<td class="row-actions"></td>` **toujours vide**. `bindRowMenus` est bien appelé sur l'écran
(ligne 4359) mais aucune cellule du lettrage n'appelle `rowMenuCell`. Et `data-piece` est **écrit à
deux endroits et lu nulle part** dans tout le fichier : c'est un attribut mort.

**Ce qui est juste et ne doit pas bouger** : le livre-journal, lui, pose le menu sur la **première**
ligne de chaque pièce (ligne 2307) et laisse les suivantes vides — c'est le bon modèle, il suffisait
de le reprendre.

**À ne pas confondre** : CLAUDE.md (8.9.0) écrit « le lettrage dont une ligne ouvre sa pièce » et
`e2e:livres` le prouve — mais sur l'**app entreprise** (`#bal-vues button[data-vue=lettrage]`). Le
lettrage du Cabinet est un écran distinct, livré en 9.5.0, qui n'a jamais reçu ce geste. Encore un
jumeau manquant (règle 7.3.0).

**Piste** : `rowMenuCell` sur chaque ligne ouverte, avec « Voir dans le paquet » quand le mois de la
pièce est connu — le mécanisme existe déjà dix lignes plus haut.

---

### T-12 · MOYEN · « En face » nomme une écriture, ne dit pas QUELLE ligne, et ne l'ouvre pas

**Vu** : relevé entièrement rapproché. La colonne « En face » porte `BQ PAIE-2026-07`,
`BQ FAC-2026-021`, `BQ COM0831`… Les **deux** lignes de salaire du 01/08 (−1 703,731 et −508,355)
affichent **le même texte**. Et aucune de ces pièces ne s'ouvre : une ligne rapprochée n'offre que
« Défaire le rapprochement ».

**Pourquoi ça compte** — deux moitiés :

1. **Vérifier est impossible.** Le moteur rapproche **ligne à ligne** (la clé est
   `ecritureId#ligne`), donc deux lignes de relevé sur deux lignes différentes d'une pièce de paie,
   c'est juste. Mais à l'écran, ça ressemble trait pour trait à la faute que le moteur interdit —
   la même écriture qui répondrait deux fois. Le comptable qui contrôle ne peut pas trancher, et
   **un contrôle qu'on ne peut pas faire finit par ne plus se faire**.
2. **Le nom ne mène nulle part.** « BQ FAC-2026-021 » est une pièce nommée sur l'écran de
   quelqu'un dont le métier est de la regarder. Règle 7.15.0 : *un écran qui NOMME un ensemble doit
   pouvoir l'ouvrir* — même défaut que T-11, sur l'écran d'à côté.

**Ancrage** : `src/cabinet/renderer/app.js:3248` — la cellule rend `e.journal + ' ' + e.piece`, le
`title` ajoute le libellé ; ni le montant de la ligne appariée, ni son numéro de ligne.
`app.js:3317-3320` — quand `r.ecritureId` existe, la seule action est « Défaire le rapprochement ».

**Ce qui est juste et ne doit pas bouger** : le moteur (clé par ligne), et le fait que « rapproché »
se défasse (« l'automatique propose, c'est toi qui décides »). Le défaut est dans ce que la colonne
MONTRE.

**Piste** : afficher le **montant de la ligne appariée** à côté du numéro de pièce — deux lignes de
la même pièce cessent alors d'être indiscernables, et l'œil vérifie que le montant en face est bien
celui du relevé. Et ajouter « Voir l'écriture » au menu d'une ligne rapprochée, le mécanisme existe
déjà pour les lignes sans réponse (« Choisir l'écriture en face »).

---

### T-13 · GRAVE · Le nom du TIERS est détruit à l'import : le lettrage et la balance âgée raisonnent par FACTURE

**Le constat le plus important de la session.** Une ligne de code, trois écrans faux, et seize
fausses alertes en orange.

**Vu**, sur les trois captures :

1. Le tableau « **Ce qui reste dû, par ancienneté** » a une colonne **TIERS** dont les lignes sont
   `Facture FAC-2026-025 — Cabin…`, `Facture FAC-2026-017 — Lemo…` — **des pièces, pas des tiers**.
   Le pied annonce « **5 tiers** » : ce sont cinq **factures**.
2. Les panneaux du bas sont **un par facture** : « Facture FAC-2026-022 — Clinique Les Jasmins »,
   « Facture FAC-2026-014 — Clinique Les Jasmins », « Facture FAC-2026-018 — Clinique Les
   Jasmins ». **Le même client occupe trois panneaux** et n'a jamais de total.
3. Un bandeau orange annonce **seize lettrages faux**, tous par **paires** :
   « Lettrage "FAC-2026-014" de **Facture** FAC-2026-014 … écart 399,531 » et
   « Lettrage "FAC-2026-014" de **Règlement** FAC-2026-014 … écart 399,531 ». Même lettre, même
   montant, sens opposés — c'est un lettrage **parfaitement juste**, coupé en deux.

**La chaîne, vérifiée de bout en bout** :

- Le CSV du paquet est **juste** : `Tiers = Clinique Les Jasmins`,
  `Libellé = Facture FAC-2026-022 — Clinique Les Jasmins`. Deux colonnes distinctes.
- `entreesDepuisCsv` (`compta.js:216`) lit bien les deux.
- **`piecesDepuisLignes` (`compta.js:857`) jette le tiers** : la ligne du livre n'a que
  `compte`, `tiersId`, `libelle`, `debit`, `credit`, `lettre` — **aucun champ `tiers`** — et elle
  écrit `libelle: l.label || l.tiers`, donc le libellé gagne toujours. `tiersId` reste `null`
  (aucune colonne du CSV ne le porte).
- **`lignesDuLivre` (`compta.js:831`) doit alors en inventer un** : `tiers: l.libelle`.

**Ce que ça casse, et pourquoi c'est grave** :

| Écran | Conséquence |
|---|---|
| Balance âgée | Regroupe par `tiersId \|\| '~' + tiers` (`compta.js:1703`) → **une ligne par facture**. Le tableau qui doit répondre à « qui me doit combien » ne peut plus totaliser un client. |
| Lettrage | Un panneau par facture ; le « reste » d'un client n'existe nulle part. |
| Contrôle des lettrages | Le groupe est `tiers\|lettre` (`compta.js:452`) : deux libellés différents pour la même lettre → **deux groupes déséquilibrés**. Seize accusations contre du travail juste. |
| Balance auxiliaire | `balanceAux` (`app.js:2375`) prend `l.tiers` **comme numéro de compte auxiliaire** → un « compte » par facture. |

C'est **une régression de la 9.2.0** : en 9.1.0, le Cabinet lisait les CSV directement et
`entreesDepuisCsv` rendait un vrai tiers. Le livre l'a perdu en chemin.

**La forme la plus nue du défaut**, vue au livre-journal le 18/09 : les colonnes **TIERS** et
**LIBELLÉ** portent **exactement le même texte, sur les 185 lignes**. Une colonne qui ne diffère
jamais de sa voisine ne porte aucune information — et c'est celle qui devrait nommer le client ou le
fournisseur de chaque ligne.

Et c'est la faute la plus coûteuse en confiance : **seize alertes orange qui accusent du travail
correct**. Un comptable qui voit ça une fois cesse de lire l'encadré ; la dix-septième, qui sera
vraie, ne sera plus lue non plus.

**Ce qui est juste et ne doit pas bouger** : le CSV du paquet, `entreesDepuisCsv`, le contrôle des
lettrages lui-même (une lettre dont les pièces ne se soldent pas EST une faute de saisie, et il faut
la nommer), et la clé `tiersId || tiers` — c'est la bonne clé, elle est simplement alimentée avec la
mauvaise valeur.

**Piste** : ajouter `tiers` à la forme d'une ligne de `livre.json`. C'est une **décision de format**
(règle 9.7.0 : une liste ajoutée est compatible, un champ ajouté doit être décidé et le test du
format doit tomber pour le dire), pas un ajout discret côté appelant. Les livres déjà écrits se
rattrapent en relisant les paquets. Et un test : sur le jeu d'exemple, la balance âgée doit rendre
**autant de lignes que de clients distincts**, jamais que de factures.

---

### T-14 · MOYEN · Le lettrage consacre un panneau entier à ce qui est SOLDÉ

**Vu** : entre les factures ouvertes, des panneaux pleine largeur — titre, sous-titre, cadre,
~130 px — pour dire « **Tout est lettré : 1 pièce soldée.** ». Il y en a autant que de pièces
soldées, et la page en devient interminable.

**Pourquoi ça compte** : cet écran répond à UNE question — *qu'est-ce qui reste dû ?* Ce qui est
soldé est précisément ce qu'on n'a plus à regarder. Lui donner la même présence visuelle qu'à une
créance en retard, c'est noyer la réponse dans ce qui n'est pas la question. (Amplifié par T-13 :
avec un vrai regroupement par client, ces panneaux seraient rares au lieu d'être la majorité.)

**Ancrage** : `src/cabinet/renderer/app.js:2416-2424` — chaque entrée de `l.rows` produit un
`.panel`, y compris quand `r.ouverts` est vide.

**Ce qui est juste et ne doit pas bouger** : le dire. Un client dont tout est soldé n'est pas la
même information qu'un client absent de la liste — c'est une bonne nouvelle, et elle se voit.

**Piste** : une seule ligne récapitulative sous le tableau (« 11 tiers entièrement lettrés »),
dépliable. Règle 9.4.5 : *ce qui prend la place n'est pas le nombre d'objets mais leur taille —
replier avant de paginer*.

---

### T-15 · MINEUR · « 5 ligne ouvertes » — le raccourci de pluriel ne sait accorder qu'UN mot

**Vu** : le message du lettrage automatique affiche **« Rien à lettrer d'office : 5 ligne ouvertes,
aucune paire qui se solde sans ambiguïté. »** Nom au singulier, adjectif au pluriel.

**Pourquoi ça compte** : c'est la règle que le projet s'est donnée à sa toute première version
Cabinet — *« un logiciel qui écrit "1 dossier(s)" paraît bâclé, et c'est le premier contact d'un
comptable avec SkanFact »* — et celle de la 7.30.0, *« un pluriel mal accordé se compte en
dizaines »*. Elle est tenue partout ailleurs ; ici elle tombe sur un cas que le raccourci ne sait
pas traiter.

**Ancrage** : `pl` colle le `s` à la fin de **toute la chaîne** —
`const pl = (n, un, plur) => \`${n} ${n > 1 ? (plur || un + 's') : un}\`` (`cabinet/renderer/app.js:390`
et `renderer/app.js:1908`, corps identiques). Donc `pl(5, 'ligne ouverte')` rend
`'ligne ouverte' + 's'` = **« ligne ouvertes »**. Le troisième argument existe pour ça, et il
manque. **Deux appels concernés dans tout le projet** :
- `src/cabinet/renderer/app.js:4353` — `pl(r.restent, 'ligne ouverte')`
- `src/renderer/app.js:11446` — `pl(r.importees || 0, 'licence importée')` → « 5 licence importées »

**Ce qui est juste et ne doit pas bouger** : le raccourci lui-même. Il ne peut pas connaître la
grammaire française ; c'est pour ça qu'il prend une forme plurielle en paramètre.

**Piste** : les deux appels passent leur pluriel. Et un **test** interdit la forme dangereuse —
`pl(n, '<deux mots ou plus>')` sans troisième argument — sinon un troisième appel naîtra faux, et
celui-là on ne le verra pas non plus.

---

### T-16 · GRAVE · « Total à décaisser » exclut l'IRPP qui figure juste au-dessus, sans le dire

**Vu** (déclaration d'août 2026) :

| Case | Montant |
|---|---|
| TVA nette à payer | 127,400 DT |
| Droit de timbre | 4,000 DT |
| Retenues à la source opérées | 0,000 DT |
| **IRPP retenu sur salaires** | **292,046 DT** |
| **Total à décaisser** | **131,400 DT** |

Le total est **127,400 + 4,000 + 0** : il saute la ligne de 292,046 DT, qui est **plus de deux fois
son montant**, et qui est imprimée juste au-dessus de lui.

**Pourquoi c'est grave** : ce tableau existe pour être **recopié sur le portail**. Un total posé au
bas d'une colonne de montants est lu comme la somme de cette colonne — c'est la règle 9.4.5 du
projet, *un total vit sous sa colonne*. Si l'IRPP retenu doit être reversé avec cette déclaration,
le comptable recopie 131,400 au lieu de 423,446 et le client prend une pénalité. Si au contraire il
ne doit pas l'être, l'écran doit l'écrire — parce que sans ça, personne ne peut savoir lequel des
deux cas s'applique.

**Ancrage** : `src/renderer/compta.js:1852` —
`aDecaisser: caseDe(round3(Math.max(0, net) + timbre.v + rsOp.v), [])`. L'IRPP (`irpp.v`, posé
ligne 1851) n'y entre pas, et aucune phrase de l'écran ne le signale.

**À VÉRIFIER avec le comptable** : en Tunisie, la déclaration mensuelle d'impôt porte
habituellement sur la TVA, le droit de timbre **et les retenues à la source, salaires compris**, le
tout réglé ensemble. Si c'est le cas, `aDecaisser` doit inclure `irpp.v`. **Je ne tranche pas une
règle de droit** (règle 9.1.1) — mais le choix actuel est invisible, et c'est ça le défaut, quelle
que soit la réponse.

**Ce qui est juste et ne doit pas bouger** : que la case IRPP existe et soit tracée (« 1 écriture »).
La faute n'est pas de la calculer, c'est de ne pas dire ce qu'on en fait.

**Piste** : quelle que soit la réponse du comptable, le total NOMME ce qu'il additionne
(« TVA nette + timbre + retenues »), et toute ligne du tableau qui n'y entre pas le dit dans sa
colonne « d'où ça vient ». Même remarque pour **« Retenues subies (créance) »**, rangée *après* le
total : c'est une somme qu'on **récupère**, pas qu'on paie, et rien ne l'indique.

---

### T-17 · MOYEN · Trois boutons éteints, dont un qui n'explique rien et deux qui n'expliquent qu'au survol

**Vu** : le panneau « Ce qui suit » porte trois boutons tous gris et inertes — « Écrire l'écriture du
mois », « Marquer déposée », « Marquer payée ». Rien à l'écran ne dit pourquoi.

**Pourquoi ça compte** : la raison existe (« Prépare la déclaration d'abord »), et le bouton qui
débloque existe (« Préparer la déclaration », tout en haut de l'écran, à deux écrans de défilement).
Mais les deux ne se rencontrent jamais. La règle 9.4.5 dit qu'**un bouton éteint dit pourquoi**, et
la 9.4.2 que **le motif se lit au-dessus des boutons, en gris** — pas dans une infobulle qu'il faut
deviner en survolant, invisible au clavier et sur un écran tactile.

**Ancrage** : `src/cabinet/renderer/app.js:2493-2499`. `#dc-ecriture` porte un `title`,
`#dc-payee` aussi — **`#dc-deposee` n'en a aucun** : il est `disabled` quand `!posee` et ne dit rien
du tout.

**Ce qui est juste et ne doit pas bouger** : les motifs eux-mêmes, qui sont excellents — « Elle
existe déjà : la refaire compterait la TVA du mois deux fois », « On ne paie pas ce qu'on n'a pas
déposé ». Ils méritent mieux qu'une infobulle.

**Piste** : une phrase grise au-dessus des trois boutons, et le bouton « Préparer la déclaration »
répété **là**, au moment où il sert.

**Confirmé à l'écran de la meilleure façon** (18/09) : après « Préparer la déclaration », « Marquer
déposée » s'allume et « Marquer payée » reste éteint — les deux corrects — mais **« Écrire
l'écriture du mois » reste éteint lui aussi**, c'est-à-dire précisément l'action que le geste devait
débloquer. Le comportement est JUSTE : `ecrite = !!d.ecritureExistante` (`app.js:2454`), et le
client avait déjà passé son écriture de TVA d'août dans ses propres livres. Mais le testeur, qui
venait de faire ce qu'on lui demandait, **n'avait aucun moyen de savoir si c'était un bug ou le bon
comportement**. Un motif juste et invisible vaut un bug.

---

### T-18 · MOYEN · Le panneau « Abonnements » s'affiche sous les ONZE sous-onglets

**Vu** : sous la déclaration de TVA, un panneau « Abonnements — Un abonnement s'appuie sur un guide
d'écritures, et il n'y en a aucun pour l'instant. » avec son bouton « Écrire un premier guide… ».

**Pourquoi ça compte** : un abonnement est un modèle d'écriture récurrente — il appartient à la
**Saisie**. Le voir sous la Balance, sous le Grand livre, sous la Banque et sous la Déclaration
n'apprend rien et repousse chaque fois le contenu réel. Et c'est un état vide **secondaire** qui
prend la place d'un état vide principal (T-14, même famille).

**Ancrage** : `src/cabinet/renderer/app.js:1738` — `<div class="panel" id="c-abos">` est posé
**hors** de `#c-livres`, donc hors du corps des sous-onglets.

**Piste** : le déplacer dans le corps de l'onglet Saisie.

---

### T-19 · MINEUR · « 1 pièce(s) » — la forme que le projet s'interdit depuis Cabinet 1.0.0

**Vu** : « **1 pièce(s) encore en brouillard sur ce mois** : elles n'entrent dans aucun chiffre de
cette déclaration. » Et au passage, « elles » au pluriel pour une seule pièce.

**Pourquoi ça compte** : c'est **littéralement** l'exemple cité dans la règle fondatrice de l'app
Cabinet — *« un logiciel qui écrit "1 dossier(s)" paraît bâclé, et c'est le premier contact d'un
comptable avec SkanFact »*.

**Ancrage** : `src/renderer/compta.js:1888` et `src/renderer/compta.js:2530`. C'est dans le **moteur
partagé**, donc les deux applications le portent. Le contrôle de la 7.30.0 interdit la forme dans
les deux `app.js` — il n'a jamais été étendu à `compta.js`, créé en 9.1.0. Encore un jumeau
manquant (règle 7.3.0), cette fois entre un fichier et son garde-fou.

**Piste** : les deux phrases s'accordent, et le test de la 7.30.0 couvre `compta.js`, `core.js` et
`cabcore.js` — pas seulement les deux interfaces.

---

### T-20 · MOYEN · « D'où ça vient » ouvre un panneau qu'il faut aller chercher

**Vu**, et signalé par le testeur : *« l'affichage vient en fin de page, faut le chercher, pas
pratique »*. Clic sur « 4 écritures » face à la TVA collectée → le panneau « TVA collectée — les
pièces » s'ouvre **sous le tableau des quatorze cases**, donc hors de l'écran. Rien ne bouge, rien ne
clignote, le bouton n'a pas changé d'aspect : l'impression immédiate est que le clic n'a rien fait.

**Pourquoi ça compte** : c'est le geste de **contrôle** de cet écran — *d'où vient ce chiffre que je
m'apprête à recopier sur le portail ?* Un geste de contrôle dont on doute qu'il ait fonctionné n'est
pas fait. Et c'est le symptôme le plus démoralisant du projet (7.0.0) : un bouton qui accepte le
clic sans effet visible.

**Ancrage** : `src/cabinet/renderer/app.js:2533` — le clic pose `declState.ouverte` puis appelle
`drawLivres`, qui redessine tout. Le panneau est bien inséré à sa place logique
(`app.js:2490`, entre les cases et « Ce qui suit ») mais **rien ne l'amène à l'écran** : aucun
`scrollIntoView`, aucun repère. Le Cabinet n'a que **deux** `scrollIntoView` dans tout son fichier,
tous deux pour les Réglages.

**Le jumeau manquant, encore** (règle 7.3.0) : l'app entreprise a `pageFocus` depuis la 7.18.0
(`src/renderer/app.js:83` et `:1501`) — elle retient la cible, l'amène à l'écran **après** le rendu
(`render()` remet `scrollTop` à zéro, donc un `scrollIntoView` posé pendant le dessin serait effacé,
règle 7.27.0) et la marque une seconde et demie. Le Cabinet ne l'a jamais reçu.

**Ce qui est juste et ne doit pas bouger** : la place du panneau (les pièces vivent sous les cases,
pas ailleurs), et le fait que le bouton soit un interrupteur — recliquer referme.

**Piste** : porter `pageFocus` au Cabinet. Il servira aussi à T-17 (le bouton qui débloque, deux
écrans plus haut) et partout où un clic ouvre un panneau plus bas. Et le bouton dit qu'il est
ouvert (`aria-expanded`, un chevron), sinon on ne sait pas qu'on peut le refermer.

---

### T-21 · MOYEN · Annuler « déposée » avant « payée » enferme dans un état sans issue

**Le geste** : marquer déposée, marquer payée, puis annuler **« déposée » en premier**.

**Ce qui arrive** : `pointerDeclaration` efface `d.deposee` et **ne touche pas à `d.payee`**. La
déclaration est donc « payée mais pas déposée » — l'état exact que le moteur REFUSE de créer par la
porte d'entrée (`compta.js:1975` : *« on ne paie pas ce qu'on n'a pas déposé »*). Et le bouton, lui,
est éteint dès que `deposee` est vide (`app.js:2497`), quelle que soit la valeur de `payee` : il
affiche donc **« Payée le 18/09/2026 — annuler »** en gris, inerte. **Le seul chemin pour défaire le
paiement est fermé par l'annulation du dépôt.**

**Pourquoi ça compte** : c'est la règle 7.12.0, mot pour mot — *un réglage qui accepte un clic, ne
fait rien de visible, et se retire ensuite la possibilité de revenir en arrière est pire que pas de
réglage du tout*. Et l'état obtenu est **faux** : sur soixante dossiers, le comptable lit « payée »
sur une déclaration que l'application elle-même considère comme non déposée.

**Ancrage** : `src/renderer/compta.js:1978-1980` — l'effacement ne porte que sur `quoi` ;
`src/cabinet/renderer/app.js:2497` — la condition `disabled` ignore `payee`.

**Ce qui est juste et ne doit pas bouger** : l'ordre imposé à la pose (on ne paie pas ce qu'on n'a
pas déposé) et le fait que les deux pointages se défassent. C'est la **symétrie** qui manque : ce
qu'on interdit de poser dans un sens doit être interdit d'obtenir dans l'autre.

**Piste** : annuler « déposée » annule « payée » du même geste, et **le dit** (« Dépôt et paiement
annulés »), plutôt que de laisser un état que rien ne permet de quitter. Un test pur : après
`pointerDeclaration(…, 'deposee', null)`, `d.payee.le` doit être vide.

**Confirmé à l'écran** (18/09, capture) : la barre montre « Marquer déposée » actif à côté de
**« Payée le 18/09/2026 — annuler » en gris et inerte**. Sortie possible seulement en remarquant
« déposée » d'abord — ce que rien n'indique.

---

### T-22 · GRAVE · Dans le BILAN, chaque rubrique porte le libellé d'une écriture au hasard

**Troisième manifestation de T-13, et la plus grave** — parce qu'un bilan se montre à une banque et
à un contrôleur.

**Vu** :

| Compte | Intitulé affiché | Montant |
|---|---|---|
| 411 | `Facture FAC-2026-014 — Clinique Les Jasmins` | **2 711,635 DT** |
| 532 | `Paiement salaire Ahmed Ben Salah mai 2026` | **11 739,502 DT** |
| 401 | `Achat LOC-2026-08 — Agence Immobilière Le…` | **3 844,500 DT** |
| 706 | `Facture FAC-2026-014 — Clinique Les Jasmins (HT 19 %)` | **32 720,000 DT** |
| 54 | `Fournitures diverses` | 120,000 DT |

Ces intitulés devraient être **« Clients »**, **« Banque »**, **« Fournisseurs »**, **« Ventes »**,
**« Concours bancaires »**. Le montant est le **total du compte** ; l'étiquette nomme **une seule
opération** parmi des dizaines. Le 706 à 32 720,000 DT, c'est le chiffre d'affaires de tout
l'exercice, étiqueté du nom d'une facture de 2 711 DT.

**Pourquoi c'est pire qu'ailleurs** : dans le lettrage, l'erreur produisait des groupes faux ; ici
elle produit un **document faux qui a l'air juste**. Les totaux tombent, l'actif égale le passif, et
chaque ligne raconte quelque chose qui n'est pas vrai.

**La chaîne** : `balanceDepuisLignes` (`compta.js:286`) retient le tiers de la **PREMIÈRE** ligne
rencontrée sur le compte (`if (e.tiers && !r.tiers) r.tiers = e.tiers;`) et le rend comme `label`
(`:293`). Le Cabinet lui passe `(c, t) => t || ''`. Et `tiers` vaut `l.libelle` (T-13). Donc
l'étiquette d'une rubrique de bilan est le libellé de la première écriture de l'exercice qui touche
ce compte.

**Ce qui est juste et ne doit pas bouger** : le mécanisme lui-même. `etatsDepuisLignes` prend une
**fonction** `libelle(compte, tiers)` : c'est la bonne conception, et elle attend seulement qu'on
lui donne un nom de compte. `accountLabel` existe déjà côté entreprise.

**Piste** : le Cabinet passe le **plan comptable du dossier** comme fonction de libellé, et n'utilise
le tiers que sur un **sous-compte** de tiers (411001, 401002…), là où c'est le sens même du compte.
Un test : sur le jeu d'exemple, aucune ligne de bilan ne doit porter un libellé contenant
« Facture », « Paiement » ou « Achat ».

---

### T-23 · MOYEN · « Actif = passif, au millime » en vert sur un bilan à capitaux propres NULS

**Vu** :
- **Actifs non courants (valeur brute) : −7 550,000 DT** — un actif **négatif**, dont l'unique ligne
  est « Sortie — Serveur de sauvegarde : valeur brute ».
- **Capitaux propres et résultats reportés : 0,000 DT**.
- Et sous le tout, un bandeau **vert** : « Actif = passif, au millime. »

**Pourquoi ça compte** : les deux chiffres sont **exacts** et le bilan **s'équilibre** — mais ce
n'est pas un bilan, c'est la photo d'un livre qui commence en juin 2026 **sans à-nouveaux**. La
cession du serveur y figure sans son acquisition, donc l'actif part en négatif ; aucun capital
n'ayant jamais été saisi, les capitaux propres sont à zéro. Un bilan avec un actif négatif et zéro
capital, présenté à une banque, ne se discute pas : il se referme.

Le vert affirme quelque chose de vrai (l'équilibre) à un endroit où le lecteur comprend autre chose
(« ce bilan est bon »). C'est la règle de la 7.0.0 — *avant d'écrire une phrase rassurante,
vérifier que l'univers concerné est non vide* — et celle du Cabinet 1.0.0 : *ne jamais prétendre ce
qu'on ne peut pas prouver*.

**Ce qui est juste et ne doit pas bouger** : l'équilibre est bien la seule chose garantie, et le
dire est honnête. L'écran du **lettrage** fait déjà exactement ce qu'il faut à deux onglets de là :
« *C'est attendu sur un livre lu mois par mois : … Le contrôle ne vaut que sur un livre complet,
avec ses à-nouveaux.* » Cette phrase manque ici, où elle compte bien davantage.

**Ancrage** : `src/cabinet/renderer/app.js:2660-2664` — le bandeau ne juge que `e.equilibre`.

**Piste** : quand le livre n'a **aucune ouverture** (`soldesDepuisOuverture` vide) ou que les
capitaux propres sont nuls, le dire au-dessus du bilan, et proposer le geste : **« Reprendre les
soldes d'ouverture… »**, qui existe déjà (`repriseForm`). Le vert ne se pose que sur un exercice
qui a ses à-nouveaux.

---

### T-24 · MOYEN · Les contrôles de clôture sont lus UNE fois et ne se rafraîchissent jamais

**Vu** : le contrôle annonce « **3 mois sans déclaration préparée (2026-06, 2026-07, 2026-08)** »
alors qu'août venait d'être préparé dans l'onglet Déclaration. Il devrait en rester deux.

**Ancrage** : `src/cabinet/renderer/app.js:2699` — `if (!s.cloture) { chargerCloture(…); return; }`.
`s.cloture` n'est remis à `null` qu'au **changement de couple (dossier, exercice)** (`app.js:1955`).
Préparer une déclaration, écrire une écriture, valider un brouillard, poser un inventaire : aucun de
ces gestes ne l'invalide, et tous changent les six contrôles.

**Pourquoi ça compte** — et c'est la seconde moitié qui est sérieuse : `s.cloture.controles` sert
aussi à **construire la question posée avant de clôturer** (`app.js:2702-2706`). Le comptable peut
donc lire, dans la fenêtre de confirmation du geste le plus définitif de l'application, une liste de
manques **déjà réglés** — ou pire, ne pas y lire un manque apparu depuis. Il clôture alors sur une
photo périmée.

C'est la règle 7.1.x, appliquée à l'écran où elle coûte le plus cher : *un état lu une fois au
démarrage se périme*. Et la règle 6.8.1 : *un compteur et la liste qu'il annonce se calculent avec
la même fonction* — ici avec les mêmes **données**.

**Ce qui est juste et ne doit pas bouger** : ne pas relire à chaque affichage (règle 9.2.0 — un
redessin systématique détache les menus ouverts). La bonne parade est celle que le projet a déjà
retenue : **les gestes qui modifient le livre reposent l'état eux-mêmes.** Ici, il en manque.

**Piste** : `s.cloture = null` dans les gestes qui touchent aux déclarations, aux écritures, aux
immobilisations et à l'inventaire ; et, à défaut, relire à l'ouverture de l'onglet Exercice — c'est
un écran qu'on n'ouvre pas dix fois par heure.

**Confirmé à l'écran** (18/09) : après un aller-retour sur un autre sous-onglet, le contrôle annonce
toujours « 3 mois sans déclaration préparée (2026-06, 2026-07, 2026-08) ». Que la déclaration d'août
existe bien est prouvé par ailleurs : les pointages « déposée » puis « payée » ont survécu à
plusieurs redessins, et ils sont rangés **dans** cette déclaration.

**Preuve décisive** : la clôture force une relecture (`app.js:2712`). Avant / après le geste, sans
qu'aucune donnée n'ait changé entre les deux :

| Contrôle | Avant (état figé) | Après la relecture |
|---|---|---|
| Les pièces encore en brouillard | `ok — rien à signaler` | `à voir — 1 pièce encore en brouillard` |
| Les déclarations de TVA | `3 mois (2026-06, 07, 08)` | `2 mois (2026-06, 07)` |

**Deux contrôles faux sur six** — dont un qui passait du vert au rouge — sur l'écran qui décide
d'une clôture. Et la fenêtre de confirmation avait affiché les deux valeurs périmées.

---

### T-25 · MOYEN · La fenêtre de clôture noie ses avertissements dans un pavé

**Vu**, et signalé par le testeur : *« c'est mal écrit les deux contrôles, ça se distingue pas dans le
paragraphe »*. La fenêtre « Clôturer l'exercice 2026 ? » affiche :

> …La rouvrir reste possible, mais elle exigera un motif — c'est la seule trace qui expliquera
> pourquoi un chiffre a changé après coup. 2 contrôles signalent encore quelque chose : • Le compte
> d'attente porte encore 120.000 : une pièce est rangée nulle part. Ventile-la avant la clôture. •
> 3 mois sans déclaration préparée (2026-06, 2026-07, 2026-08). Prépare-les dans l'onglet
> Déclaration.

Les puces existent, les retours à la ligne aussi — dans la **chaîne**. Pas à l'écran.

**Pourquoi ça compte** : c'est la dernière fenêtre avant le geste le plus définitif de
l'application, et son rôle est de faire **lire** deux avertissements. Un pavé de six lignes sans
respiration ne se lit pas : on cherche le bouton vert. La règle du projet veut qu'un refus dise
trois choses distinctement (7.0.0) ; ici l'avertissement en dit deux et les colle l'une à l'autre.

**Ancrage** — le contrat diverge entre les deux applications, pour une fonction du même nom :
- `src/cabinet/renderer/app.js:318` — `<div>${body}</div>` : le corps est du **HTML**, et presque
  tous les appels passent des `<p>` (ex. `:1845`, `:4489`).
- `src/cabinet/renderer/app.js:2704-2706` — ce caller-ci passe du **texte brut**, avec `\n\n` et
  `map(c => '• ' + c.detail).join('\n')`. Le HTML avale les `\n`.
- `src/renderer/app.js:536` — l'app entreprise, elle, fait `C.nl2br(msg)`. **Deux fonctions du même
  nom, deux contrats** : c'est la divergence que la 6.8.0 avait déjà nommée sur `h`/`esc`.

**Ce qui est juste et ne doit pas bouger** : lister les contrôles dans la fenêtre plutôt que de
renvoyer à la page, et ne pas bloquer.

**Piste** : ce caller construit une vraie liste (`<ul><li>`), avec la phrase d'introduction dans son
propre `<p>`. Et un test qui interdit un `\n` dans le corps d'un `confirmDialog` du Cabinet — le
contrat est « HTML », il doit être tenu partout.

**Vérifié au passage, et ce n'est PAS un défaut** : les données venues d'un paquet (nom de fichier,
nom de dossier, libellé de pièce) sont bien échappées dans les corps de fenêtre (`esc(p.label)`,
`esc(dossier.name)`, `esc(f.name)`). Un `.skanpack` ne peut pas injecter de HTML par cette porte.

---

### T-26 · GRAVE · Le motif de réouverture disparaît de l'écran à la seconde où il est donné

**Vu**, et signalé par le testeur : *« je ne vois pas le motif après la réouverture avec motif »*.

L'application EXIGE ce motif, et elle écrit pourquoi, dans la fenêtre qui le demande :

> « Le motif est la **seule trace** qui expliquera, **dans six mois**, pourquoi un chiffre a changé
> après que le client a reçu ses états. Il est obligatoire. »

Le motif est bien enregistré (`ex.reouvertures`). Il n'est affiché **nulle part** une fois la
réouverture faite.

**Ancrage** : `src/cabinet/renderer/app.js:2636-2637` — **unique** occurrence de `reouvertures` dans
tout le renderer, et elle vit **à l'intérieur de la branche `ex.clos ? …`**. Dès que l'exercice
repasse « ouvert », ce bandeau cède la place à l'avertissement des contrôles et le motif s'évapore.
Aucune vue de piste d'audit n'existe par ailleurs dans l'app (zéro occurrence de `audit` dans le
renderer).

**Pourquoi c'est grave — deux fois** :

1. **Le motif est invisible pendant la période exacte où il sert.** Un exercice rouvert est un
   exercice *en train de changer* : c'est là que le collaborateur qui reprend le dossier, ou le
   comptable lui-même trois semaines plus tard, se demande *pourquoi est-il ouvert ?*. Il ne
   réapparaît qu'une fois reclôturé — quand la question ne se pose plus.
2. **Seul le DERNIER motif est rendu**, même une fois clos
   (`ex.reouvertures[ex.reouvertures.length - 1]`). Deux réouvertures, et la première explication
   est perdue pour l'écran. Or c'est précisément la succession qui intéresse un contrôleur.

**La règle du projet, mot pour mot** : *une donnée enregistrée et jamais affichée n'existe pas*
(7.21.0). Et celle de la 6.8.1 : *un verdict qui vit deux secondes n'est pas un verdict*. Ici c'est
pire qu'une donnée oubliée : l'application **promet à l'écran** que cette trace sera là dans six
mois, et la cache dès la seconde suivante — c'est « une phrase affichée que rien ne tient » (7.3.0),
sur la garantie la plus sérieuse du logiciel.

**Ce qui est juste et ne doit pas bouger** : exiger le motif, la phrase qui l'explique, et le refus
quand il manque. Tout cela fonctionne parfaitement.

**Piste** : un bandeau permanent sur un exercice rouvert — « **Exercice rouvert le 18/09/2026 :
"Facture d'électricité de décembre reçue après la clôture"** » — et **l'historique complet** des
clôtures et réouvertures dans un panneau dépliable, comme `closureLog` le fait côté entreprise
depuis la 6.0.0. Encore un jumeau manquant (7.3.0). Un test : après
`rouvrir(…, motif)`, le motif doit figurer dans le rendu de l'onglet Exercice.

---

### T-27 · MOYEN · Le dossier de clôture ne laisse AUCUNE trace

**Vu**, et signalé par le testeur : *« quand je produis et que je l'ai mis dans Téléchargements, y'a
rien qui dit que c'est déjà produit, et pas d'ouvrir le dossier, rien »*.

Le fichier est bien écrit — le nom est excellent et reconnaissable
(`cloture-menuiserie-trabelsi-suarl-2026.skanclose`). Puis un message passager de 2,6 secondes :
« Dossier de clôture écrit (avec le PDF). » Et **plus rien**, pour toujours :

- pas de **chemin** affiché, donc rien à recopier pour retrouver le fichier ;
- pas de bouton **« Ouvrir le dossier »** — *un fichier qu'on ne retrouve pas est un fichier qu'on
  ne peut pas envoyer* ;
- **rien n'est enregistré** : revenir demain sur l'onglet Exercice ne dit pas que ce dossier a été
  produit, ni quand, ni s'il était scellé.

**Pourquoi ça compte** : un cabinet a soixante clients et clôture en rafale sur trois semaines. La
question du lundi matin est *« lesquels ont reçu leur dossier de clôture ? »* — et l'application n'a
aucune réponse. C'est le geste final du flux retour, celui qui justifie tout le reste, et il ne
laisse pas de trace.

**Le jumeau existe et fait exactement ce qu'il faut** (règle 7.3.0) : côté entreprise, le paquet
mensuel écrit `data.packs` depuis la 6.1.0 — mois, horodatage, chemin, empreinte — et la page
affiche l'historique des douze derniers avec le bouton qui ouvre le fichier
(`src/renderer/app.js:9759-9760`, `:9894`). La 7.21.0 avait même corrigé ce même écran parce qu'il
montrait l'empreinte au lieu du chemin. Rien de tout ça n'a été porté ici.

**Ancrage** : `src/cabinet/renderer/app.js:2774-2777` — `api.ecrireCloture` puis un `toast`, et
c'est tout. Aucune écriture dans le livre, aucun panneau d'historique.

**Ce qui est juste et ne doit pas bouger** : le nom du fichier, le fait que l'utilisateur choisisse
l'emplacement, et le message qui distingue « avec le PDF » de « le PDF n'a pas pu être produit,
l'HTML est là ».

**Piste** : ranger `{ annee, le, chemin, scelle, pdf }` dans le livre, l'afficher dans l'onglet
Exercice (« Dossier de clôture produit le 18/09/2026 — Ouvrir le dossier »), et le remonter dans la
liste des dossiers pour répondre à la question du lundi matin.

---

### T-09 · confirmé à l'écran une seconde fois (18/09)

Le testeur, sur la fenêtre du dossier de clôture : *« le bouton annuler ne marche pas déjà »*. Cette
fenêtre (`app.js:2768`) et celle du motif de réouverture (`app.js:2744`) portent toutes deux
`<button class="btn" data-close>Annuler</button>` — deux des neuf boutons morts. Le défaut se
rencontre donc à chaque étape du parcours, pas seulement à l'import d'un relevé.

---

### T-28 · MOYEN · La grille de saisie change de séparateur décimal dès qu'on tape

**Vu** : au repos, le pied affiche « Total de la pièce **0,000** / **0,000** » — virgule, comme tout
le reste de l'application (« 32 720,000 DT », « −7 913,855 DT »). La ligne de brouillard juste en
dessous, elle, affiche **« 4.500 »**. Et dès la première frappe dans la grille, les totaux
deviennent « 1250.000 ».

**Pourquoi ça compte** : en français, le séparateur décimal est la **virgule**. « 4.500 » se lit
*quatre mille cinq cents*. Sur l'écran dont le métier entier est de saisir et de contrôler des
montants, lire son propre total dans une autre convention que celle qu'on vient de taper est une
invitation à l'erreur — et l'écart de mille entre les deux lectures est exactement celui qu'un
comptable passe sa journée à traquer.

**Ancrage** : le gabarit écrit la virgule (`src/cabinet/renderer/app.js:3691`, `:3693` — `0,000`),
mais **toutes** les mises à jour au fil de la frappe passent par `toFixed(3)`, qui rend un point :
`:3773`, `:3774`, `:3776`. **Seize occurrences de `toFixed(3)`** dans le renderer du Cabinet —
la liste du brouillard (`:3720`, `:3721`), la phrase de solde (`:3766`, `:3767`), les abonnements
(`:4120`), la recherche (`:4261`), le compte rendu de relecture des paquets (`:2030`)… Partout
ailleurs l'application passe par `money()`.

**Ce qui est juste et ne doit pas bouger** : `toFixed(3)` aux lignes `:3856`, `:3857`, `:3931`,
`:3945`, `:4017` — là il remplit un **champ de saisie**, et un champ numérique se relit en interne.
C'est le rendu **à l'écran** qui doit porter la virgule, pas la valeur.

**Piste** : un `montant(n)` du Cabinet, jumeau de `money()`, et un test qui interdit `toFixed(3)`
dans du HTML rendu. Le distinguo « champ de saisie / texte affiché » doit être écrit, sinon la
correction repartira dans l'autre sens à la version suivante.

---

### T-29 · MOYEN · Les deux boutons « Valider par lot » ne peuvent rien valider de ce qui est affiché

**Vu** : le panneau « Le brouillard » contient **une** écriture — `2026-08-31 · BQ · COM0831`. Juste
au-dessus, deux boutons : « **Valider tout le journal VT** » et « **Valider le mois septembre
2026** ». Cliquer l'un ou l'autre donne : « **Rien à valider — Aucune écriture en brouillard ne
correspond.** »

Les deux périmètres viennent de l'**en-tête de saisie** (journal `VT`, date du jour `18/09/2026`),
jamais du contenu du brouillard. Le journal proposé par défaut et le mois du jour n'ont aucune
raison de correspondre à ce qui attend d'être validé.

**Pourquoi ça compte** : c'est la règle 7.0.0 — *un bouton qui accepte le clic et ne fait rien est
pire qu'un bouton absent* — et la 9.4.5 — *un bouton éteint dit pourquoi*. Ici il n'est même pas
éteint : il est vif, il se clique, et il ouvre une fenêtre pour dire qu'il n'y avait rien à faire.
Répété, ça apprend à ne plus s'en servir — or valider un lot est précisément le geste qui fait
gagner du temps sur une journée de saisie.

**Ancrage** : `src/cabinet/renderer/app.js:3709-3710` — les libellés sont construits sur
`p.journal` et `moisLabelCourt(p.date.slice(0, 7))`, c'est-à-dire sur la pièce **en cours de
saisie**, pas sur `brouillards`.

**Ce qui est juste et ne doit pas bouger** : suivre l'en-tête **quand on vient de taper** est le bon
comportement — on valide ce qu'on vient de saisir. Et le refus est honnête.

**Piste** : proposer les périmètres qui **existent** dans le brouillard (« Valider les 3 de BQ »,
« Valider les 7 d'août ») ; à défaut, éteindre le bouton en disant combien il trouverait — le
compte est connu avant le clic.

---

### T-30 · GRAVE · T-13 atteint la SAISIE, et y écrit un libellé faux dans une vraie écriture

**Quatrième manifestation de T-13, et celle qui fait passer le défaut de « affichage » à
« données ».**

**Vu** : saisie d'un achat de fournitures. On tape `606`, et la colonne **INTITULÉ** annonce
« **Achat LOC-2026-08 — A…** » (le libellé d'une écriture de loyer). `401` donne la même chose.
`4366` donne « TVA déductible LOC-202… ». Puis — signalé par le testeur : *« le libellé à chaque
fois que je mets le compte il s'écrit tout seul »* — la colonne **LIBELLÉ de la ligne** se remplit
avec ce même texte. Une facture de papeterie part donc avec trois lignes libellées
« Achat LOC-2026-08 ».

**Pourquoi c'est un cran au-dessus** : jusqu'ici T-13 salissait des écrans. Ici, **si le comptable
valide, le mensonge est écrit** — dans une écriture numérotée, définitive, qui ne se modifie plus.
Et il ne se corrige que par une contre-passation.

**La chaîne** :
- `livre.plan` reçoit ses comptes par `assurerCompte(livre, compte, libelle)`
  (`src/renderer/compta.js:607-613`), qui prend le **libellé de la ligne** comme nom de compte.
  Comme `lignesDuLivre` met `tiers: l.libelle` (T-13), le plan se peuple de libellés d'écritures.
- `lignesSaisieHtml` (`src/cabinet/renderer/app.js:3732`) rend ce nom dans la colonne INTITULÉ.
- Et le sélecteur de compte **le recopie dans la ligne** :
  `if (!String(p.lignes[i].libelle || '').trim()) p.lignes[i].libelle = c.libelle || '';`
  (`app.js:3866`).

**Ce qui est juste et ne doit pas bouger** : pré-remplir le libellé d'une ligne avec le **nom du
compte** est le bon geste — tous les logiciels comptables le font, et ça fait gagner du temps. Et
`assurerCompte` a raison de ne jamais refuser en silence. C'est la **valeur** qui est fausse, pas
le mécanisme.

**Piste** : corriger T-13 à la racine (`tiers` dans la forme d'une ligne de `livre.json`) règle les
quatre manifestations d'un coup. En attendant, `assurerCompte` devrait nommer le compte par le
**plan comptable SCE** (`PLAN_COMPTABLE` existe côté entreprise, `accountLabel` fait exactement ça)
et ne retomber sur un libellé d'écriture que si rien d'autre n'existe.

**PROUVÉ SUR DONNÉES RÉELLES** (18/09) — la pièce a été validée, elle porte le **n° 49** et ne se
modifie plus :

| Compte | Libellé écrit au livre-journal | Montant |
|---|---|---|
| 606 | `Achat LOC-2026-08 — Agence Immobilière Le Lac (ch…)` | 250,000 DT |
| 4366 | `TVA déductible LOC-2026-08` | 47,500 DT |
| 401 | `Achat LOC-2026-08 — Agence Immobilière Le Lac` | 297,500 DT |

Une facture de **papeterie** (`FA-2026-0912`, journal AC) est inscrite au registre légal comme une
facture de **loyer d'agence immobilière**. Ce n'est plus un défaut d'affichage : c'est une écriture
comptable fausse, numérotée, et qui ne se corrige que par contre-passation.

---

### T-31 · MOYEN · La légende du clavier cache le comportement normal de Tab

**Vu**, et dit par le testeur : *« quand je fais Entrée ça passe de libellé à compte de la ligne
suivante — j'avais pas essayé Tab car je pensais qu'il soldait et pas aller vers la case des
débit/crédit, donc c'est pas clair »*.

Le partage des touches est **bon** et c'est celui des vrais logiciels comptables : **Tab** avance de
champ en champ (comportement natif), **Entrée** saute à la ligne suivante, et **Tab sur le crédit de
la dernière ligne** solde la pièce.

Mais la légende n'annonce que : « Ligne suivante ↵ Entrée · **Solder la pièce ⇥ Tab** ». Elle nomme
l'**exception** de Tab et tait sa **règle**. Résultat : l'utilisateur n'ose pas s'en servir pour
atteindre les montants, cherche avec Entrée, tombe sur la ligne suivante, et conclut que la grille
est mal faite.

**Ancrage** : `src/cabinet/renderer/app.js:3830-3838` — `t.ligneSuivante` va toujours au `compte` de
la ligne suivante ; `:3849` — Tab ne solde que depuis `credit` de la dernière ligne.

**Piste** : « Champ suivant ⇥ Tab · Ligne suivante ↵ Entrée · Solder la dernière ligne ⇥ Tab ». La
règle avant l'exception.

---

### T-32 · MOYEN · Aucun bouton « Ajouter une ligne »

**Vu**, et dit par le testeur : *« il manque le bouton ajouter une ligne quand on ne veut pas
utiliser le clavier »*.

Une ligne ne s'ajoute qu'en appuyant sur **Entrée depuis la dernière ligne**. Le commentaire du code
l'assume : « la grille suit la saisie, on ne clique jamais "ajouter une ligne" » (`app.js:3833`).

**Pourquoi ça compte** : c'est vrai pour qui saisit au kilomètre toute la journée — et faux pour
tous les autres. Le comptable qui corrige une pièce à la souris, celui qui découvre l'écran, celui
qui revient dessus une fois par semaine : aucun ne devinera qu'Entrée ajoute une ligne. **Et chaque
ligne porte son « ✕ » pour la retirer** : une grille qui offre le geste destructeur à la souris et
réserve le geste constructif au clavier est déséquilibrée.

**Piste** : un « + Ajouter une ligne » discret sous la grille. Le clavier reste le chemin rapide ;
la souris cesse d'être un cul-de-sac.

---

### T-33 · MOYEN · La liste des comptes est coupée par le cadre du tableau

**Vu**, et dit par le testeur : *« la liste est cachée du compte »*. En tapant un numéro de compte,
la liste de propositions apparaît **sous la dernière ligne** et se trouve tronquée : une seule
entrée visible, elle-même coupée en deux.

**Ancrage** : `src/cabinet/renderer/app.js:3606` — la liste (`.sugg-pop`) est ajoutée dans le
`<td>` du champ, donc **à l'intérieur** du tableau, lui-même dans un conteneur `.scroll-x`
(`overflow-x: auto`). Un conteneur qui défile **rogne** ce qui dépasse : c'est la même mécanique que
le débordement des boutons de la 7.13.0, vue de l'autre côté.

**Pourquoi ça compte** : la liste est le seul moyen de retrouver un compte quand on ne connaît pas
son numéro par cœur — c'est-à-dire tout le temps, sur un plan de cent comptes. Coupée, elle ne sert
qu'à confirmer ce qu'on savait déjà.

**Ce qui est juste et ne doit pas bouger** : le composant lui-même (`mousedown` plutôt que `click`
pour survivre au `blur`, Entrée et Tab qui choisissent, flèches, Échap). Il est bien fait.

**Piste** : sortir la liste du tableau — l'ancrer au `body` en position fixe, calculée sur le champ.

---

### T-11 · confirmé à l'écran (18/09)

Le testeur a cliqué une ligne de pièce dans un panneau client : **rien ne se passe**. Le constat
tient.

---

## Le plan de parcours — ce qui est testé, ce qui ne l'est pas

*Posé le 18/09/2026, après le premier tour. « Il faut tout tester, pas que la partie qu'on vient de
faire » (Skander). On coche au fur et à mesure ; ce qui n'est pas coché n'a jamais été ouvert par
quelqu'un qui cherchait un défaut.*

**Les 6 pages**

| Page | État |
|---|---|
| Dossiers | ▨ vue en surface (liste, « À faire ») — pas exercée |
| Relances | ☐ |
| Échéances | ☐ |
| Écritures | ☐ |
| Réglages | ☐ |
| Aide | ☐ |

**Les 3 onglets d'une fiche client**

| Onglet | État |
|---|---|
| Suivi | ☐ |
| Comptabilité | ☑ |
| Paquets | ☐ |

**Les 11 sous-onglets de Comptabilité**

| Sous-onglet | État | Bloc |
|---|---|---|
| Saisie | ☐ | C — l'écran où un comptable passe ses journées |
| Recherche | ☐ | C |
| Livre-journal | ☐ | D — ce qu'on imprime |
| Grand livre | ☐ | D |
| Balance | ☐ | D |
| Immobilisations | ☐ | E — le dossier permanent |
| Inventaire | ☐ | E |
| Lettrage | ☑ | — |
| Déclaration | ☑ | — |
| Banque | ☑ | — |
| Exercice | ☑ | — |

**Ordre retenu** : C (saisie et recherche) → D (les livres) → E (dossier permanent) → F (Suivi et
Paquets) → G (portefeuille : Dossiers en profondeur, Relances, Échéances, Écritures) → H (Réglages,
Aide). La saisie d'abord parce que c'est l'écran le plus utilisé et le plus complexe ; l'Aide en
dernier parce qu'elle décrit les écrans qu'on vient de corriger.

---

## Comment se servir de ce document

- Un constat qui part dans une version : barrer la ligne, citer le numéro de version.
- Un constat réfuté après vérification dans le code : le garder, barré, **avec la raison** — un
  constat qu'on efface revient à la session suivante.
- Ce document se relit avant chaque version d'entretien.
