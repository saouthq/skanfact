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

## Comment se servir de ce document

- Un constat qui part dans une version : barrer la ligne, citer le numéro de version.
- Un constat réfuté après vérification dans le code : le garder, barré, **avec la raison** — un
  constat qu'on efface revient à la session suivante.
- Ce document se relit avant chaque version d'entretien.
