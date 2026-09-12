# Plan UX — rendre SkanFact utilisable par quelqu'un qui débute

> Skander, 12/09/2026 : « je suis débutant et j'ai essayé de bidouiller en testant tout seul et je me
> suis perdu. Faut que ça soit le plus simple et faut que tout t'accompagne. (…) Il faut tout aligner
> et faciliter et guider une personne qui ne sait pas trop utiliser notre application, car là **soit
> t'es pro soit tu te prends la tête**. »

C'est le propriétaire de l'application qui parle, et il ne sait pas s'en servir. Ce document est le
plan de la remise à plat. Il se lit avant de commencer une version 7.x.

---

## Ce qui s'est passé

En six semaines, SkanFact est passé de « devis et factures » à quinze modules : achats, stock,
numéros de série, immobilisations, marges, trésorerie, paie, congés, déclarations sociales, clôture,
paquet comptable, écritures, licence, mises à jour, application cabinet.

**Chaque module a été livré avec son aide, ses bulles et ses états vides.** Aucun n'a été livré avec
une révision de l'ensemble. L'assistant de première utilisation date de la 2.0.0 et ne parle que de
la fiche société. La barre latérale a reçu une entrée de plus à chaque fois, sans jamais être
recomptée. Le résultat n'est pas une application mal faite : c'est une application **faite pour
quelqu'un qui sait déjà**.

---

## Les quatre mesures qui résument le problème

Mesurées dans l'application réelle, pas estimées.

### 1. Le bouton « Aide » n'a jamais été visible

`nav` a besoin de **866 px**. Voilà ce dont il dispose :

| Fenêtre | Disponible | Entrées hors champ |
|---|---|---|
| 1680 × 1050 | 855 px | 1 — **Aide** |
| 1440 × 900 | 705 px | 5 — Immobilisations, Statistiques, Comptabilité, Paramètres, **Aide** |
| 1280 × 800 | 605 px | 7 |
| 1366 × 768 | 573 px | 8 — Marges, Paie, Stock, Immos, Stats, Compta, Paramètres, **Aide** |

Sur **aucune** taille d'écran courante « Aide » n'est visible sans faire défiler une barre latérale
qui n'a pas l'air de défiler (`nav { overflow-y: auto }`, sans ombre ni repère). « Paramètres » non
plus au-delà de 1440×900 — alors que l'article « Démarrer : les cinq premières minutes » dit onze
fois « va dans Paramètres → … ».

*Quelqu'un qui se perd cherche le bouton Aide. Il était sous le plancher.*

### 2. Cinquante-deux états vides sur cinquante-huit n'ont aucun bouton

`grep 'class="empty"' src/renderer/app.js` → 58 occurrences, dont **6 seulement** contiennent un
bouton. Les 52 autres écrivent le geste en prose :

> « Aucun article n'est suivi par numéro de série. Ouvre le Catalogue, modifie un article suivi en
> stock et coche "Suivre chaque unité par son numéro de série". »

C'est une notice de montage, pas une interface. L'utilisateur doit tenir la phrase en mémoire,
naviguer ailleurs, retrouver le bon article, retrouver la bonne case.

### 3. Le premier jour, l'accueil ne montre rien — le lendemain, il montre tout

| | Premier jour | Avec des données |
|---|---|---|
| Ce qu'on voit | quatre cartes à **0,000 DT**, un graphique de 12 mois vides dans le plus gros panneau, un « Top clients » vide | **« À faire » : 13 tâches** qui occupent l'écran entier |
| Ce qui est caché | « Voilà par où commencer », à ~800 px du haut | le chiffre d'affaires, le graphique, tout le reste |
| Ce que l'app dit | « Fiche société incomplète : il manque le RIB » | « 13 mois à clôturer », sans dire ce qu'est clôturer |

Et le tout premier message de l'application — « Bienvenue ! Commence par un devis, ou charge la démo
depuis Paramètres » — est un **toast** : il s'efface au bout de quelques secondes, il n'emmène nulle
part, et il nomme un onglet de Paramètres que l'utilisateur ne voit pas dans sa barre latérale.

### 4. L'éditeur demande dix décisions avant la première ligne

Écran « Nouveau devis », avant d'arriver aux lignes : Client, Date, Valable jusqu'au, Objet,
Référence, **Affaire**, **Langue du document**, **Devise**, **Statut**, **Remise globale**.

Pour un premier devis en Tunisie, en français, en dinars : six de ces dix champs sont du bruit.
« Affaire (optionnel) » propose une liste vide à quelqu'un qui ne sait pas ce qu'est une affaire.

---

## Le principe directeur

> **L'application ne doit jamais être amputée. Elle doit être présentée dans l'ordre.**

Trois règles qui découlent de là, et qu'aucune version ne doit casser :

1. **Rien de masqué n'est perdu.** Un module non affiché reste atteignable par la palette (Cmd/Ctrl+K),
   par son adresse, et par une page « Tous les modules ». Ouvrir sa page fonctionne.
2. **Ce qui contient des données se montre.** Un module masqué qui contient ne serait-ce qu'une ligne
   réapparaît tout seul. On ne cache jamais le travail de quelqu'un.
3. **Un refus dit toujours trois choses** : ce qui est refusé, pourquoi, et le bouton qui débloque.

---

## Les versions

### 7.0.0 — « On te prend par la main »

Le socle. Quatre changements structurels.

**a) La navigation devient une donnée, pas du HTML en dur.**
La barre latérale vit aujourd'hui dans `src/renderer/index.html` (19 liens écrits à la main) et
`setWindowTitle` va jusqu'à **relire le texte du lien** pour composer le titre de la fenêtre. On la
déplace dans `core.js` :

```js
const MODULES = [
  { id: 'ventes',   label: 'Devis et factures',      toujours: true, pages: ['devis','factures','relances'] },
  { id: 'fichiers', label: 'Clients et catalogue',   toujours: true, pages: ['clients','catalogue'] },
  { id: 'compta',   label: 'Comptabilité',           toujours: true, pages: ['compta'] },
  { id: 'pieces',   label: 'Proforma, bons, contrats',              pages: ['autres','contrats'] },
  { id: 'achats',   label: 'Achats et fournisseurs',                pages: ['achats','fournisseurs'] },
  { id: 'stock',    label: 'Stock et garanties',                    pages: ['stock','garanties'] },
  { id: 'immos',    label: 'Immobilisations',                       pages: ['immos'] },
  { id: 'paie',     label: 'Salariés et paie',                      pages: ['paie'] },
  { id: 'pilotage', label: 'Trésorerie, marges, statistiques',      pages: ['tresorerie','marges','stats'] }
];
```

`moduleActif(data, id)` = **choisi par l'utilisateur OU contenant des données**. Le second terme est
le garde-fou de la règle 2 : il se calcule, il ne se stocke pas.

**b) La barre latérale ne déborde plus jamais.**
« Accueil » en haut ; **« Paramètres » et « Aide » descendent dans `.sidebar-foot`**, qui est déjà
`margin-top: auto` et donc toujours visible. Entre les deux, seuls les modules actifs. Une entrée
« ＋ Tous les modules » ferme la liste : c'est là qu'on active ce qu'on n'a pas. Un test mesure
`nav.scrollHeight <= nav.clientHeight` à 1366×768 avec **tous** les modules actifs — sinon on n'a
rien réglé, on a déplacé le problème.

**c) L'assistant de première utilisation, refait et rejouable.**
Il gagne un écran **« Qu'est-ce que tu fais ? »** — achètes-tu à des fournisseurs, tiens-tu du stock,
as-tu des salariés, veux-tu suivre ta trésorerie. Les réponses allument les modules. Il gagne aussi
un écran de fin qui n'est pas une page d'adieu mais **les trois premiers gestes**, cliquables.
Et il devient **rejouable** : aujourd'hui `needsSetup()` exige `!company.name && aucun document &&
aucun client` — une fois passé, il est perdu pour toujours. Bouton « Refaire la présentation » dans
Paramètres, et l'assistant ne réécrit que ce qu'on lui redonne.

**d) L'accueil du premier jour.**
Tant qu'il n'y a aucun document : pas de cartes à zéro, pas de graphique vide. À la place, **« Tes
premiers pas »** — cinq étapes qui se cochent toutes seules (compléter la fiche, créer un client,
faire un devis, l'envoyer, le transformer en facture), chacune avec son bouton. Le panneau disparaît
quand la cinquième est faite, et se retrouve dans l'Aide. Le message de bienvenue quitte le toast
pour cet endroit-là.

### 7.1.0 — « Pourquoi je n'y arrive pas »

La réponse directe à « y'a des choses qu'on arrive pas à faire et on ne comprend pas pourquoi ».

- **Aucun bouton éteint et muet.** Les 27 `disabled` du renderer sont recensés ; chacun reçoit soit
  un `title` qui dit la condition manquante, soit — mieux — reste cliquable et explique au clic.
- **Chaque refus propose la sortie.** `closedBlock` → un bouton « Rouvrir la période » ;
  `licenceBlock` → « Saisir ma clé » ; pièce émise verrouillée → « Corriger par un avoir » posé sur
  l'écran, pas caché dans « Plus ▾ ».
- **Les prérequis silencieux se nomment** : email du comptable absent, cabinet non appairé, RIB
  manquant, matricule manquant, barème de paie jamais réglé. Chacun se dit **avant** l'échec.
- **Les 52 états vides reçoivent leur bouton.**
- **Les exports sans rien à exporter** cessent d'être proposés comme s'ils marchaient (page
  Comptabilité vide : « Exporter en CSV » et « Envoyer au comptable » sont actifs devant zéro ligne).

### 7.2.0 — Les mots

- **Un glossaire atteignable depuis les mots eux-mêmes.** Retenue à la source, TVA déductible, VNC,
  prorata temporis, seuil de rentabilité, coût moyen pondéré, affaire, avoir, proforma, acompte,
  rapprochement, écriture, clôture, CNSS, IRPP, timbre fiscal : chacun avec sa bulle là où il
  s'affiche, et un lien vers l'article.
- **Chaque page mène à son article d'aide en un clic.** Trente-deux articles que personne n'atteint
  au moment où il en a besoin ne servent à rien.
- **Une recherche dans l'aide.** Elle n'existe pas : c'est une liste de 32 titres.
- **L'éditeur se replie.** Affaire, Langue, Devise, Référence, Remise globale passent sous un
  « Options » dépliable — ouvert d'office dès qu'un de ces champs est renseigné.

### 7.3.0 — L'exemple qui enseigne

- **On peut revenir de la démonstration.** Elle prend bien une sauvegarde `avant-demo`, mais le
  chemin du retour passe par « Importer » : à vérifier et à rendre évident, sinon charger l'exemple
  est un aller simple pour quelqu'un qui a déjà saisi des choses.
- **Pendant la démo, l'application le dit.** Un bandeau permanent, pas une case dans les réglages :
  le risque d'envoyer une fausse facture à un vrai client existe.
- **La démo devient une visite guidée** : « regarde cette facture en retard — voilà comment on
  relance », avec la possibilité de sauter d'une étape à l'autre.

---

## Ce qui ne change pas

- Aucune fonction n'est retirée. Le mode « tout afficher » reste à un clic.
- Les règles métier sont intouchées : verrouillage des pièces émises, statuts déduits, numérotation
  à l'émission, « À VÉRIFIER avec ton comptable » sur tout ce qui relève du comptable.
- Le format des données ne bouge pas : `company.modules` est un champ de plus, absent = tout afficher
  (une installation existante ne perd rien au premier lancement).

---

## L'instrument

`test/e2e/captures.js` (`npm run e2e:captures`) photographie les 20 pages, leurs onglets et quatre
gestes (éditeur, choix de client, palette, nouvelle fiche) dans **deux états** — vierge et démo — aux
deux largeurs qui comptent. Il existe parce que la méthode d'audit décrite dans CLAUDE.md supposait
que `e2e:entreprise` le faisait : ce n'était plus vrai, et il fallait donc réécrire le photographe à
chaque audit.

---

## L'audit du 12/09/2026

*(Douze angles, chaque constat relu par un contradicteur chargé de le réfuter. Résultats ci-dessous.)*
