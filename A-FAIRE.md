# Ce qui reste à faire

*Le carnet des choses repérées et pas encore traitées, sur les TROIS surfaces du produit :
les deux applications (`skanfact`), le site (`skanfact-site`) et la plateforme (console + relais).
Il ne remplace pas `VERSIONS-A-VENIR.md`, qui inventorie les VERSIONS à écrire : ici vivent les
constats isolés, les dettes et les décisions en attente. Une ligne en sort quand elle est faite, ou
quand elle devient une version.*

Dernière relecture : 22/09/2026.

---

## 1. Ce qui bloque une vente

Rien ici ne demande d'écrire du code. Tant que ces lignes tiennent, on ne peut pas encaisser.

| Quoi | Où | Qui tranche |
|---|---|---|
| **Quatre clauses `À COMPLÉTER`** : délai d'envoi de la clé, rétractation et remboursement, périmètre de l'assistance, juridiction | `conditions-vente.html` | Skander |
| **RNE, capital social**, et un numéro de téléphone — ou la décision de ne pas en publier | `conditions-vente.html`, mentions légales | Skander |
| **Vérification d'identité Konnect**, puis `KONNECT_API_KEY` en Secret Cloudflare, `konnect_wallet` et `achat_retour` dans Console → Réglages | plateforme | Skander |
| **TVA 19 % et timbre 1 DT** sur une facture de licence — « À VÉRIFIER » depuis la 10.9.0 | réglages de la console | le comptable |
| **Prix du Cabinet** (par dossier au-delà de trois) et de l'option Comptabilité : `prix_cabinet_dossier` vaut 0, donc le Cabinet ne se vend pas en ligne | `TARIFS-REFERENCE.md` | Skander, après l'avis de l'Ordre |

## 2. Le site

Mesuré par la session qui l'a écrit, le 22/09/2026. Aucun de ces points n'est faux — ils sont
lourds, ce qui n'est pas la même chose.

- **Les pages sont trop longues.** En écrans de téléphone : accueil **16,8**, cabinet **15,0**,
  excel **12,1**, tunisie **10,2**. Sur l'accueil précisément, **trois sections font le même
  travail** (orienter entreprise / cabinet) — « Vous n'êtes pas venu pour la même chose »,
  « Quatre pages, quatre questions », « Un logiciel de tenue, pas un lecteur de fichiers ». Et un
  paragraphe entier y explique le **test de parité des balances** : du processus d'ingénierie sur
  une page qui doit vendre.
- **Les deux images du héros de l'accueil sont écrasées à 400 px** — texte à 4 px, illisible, du
  bruit gris. Les grandes captures, elles, sont bonnes.
- **Les cartes de la section entreprise** portent des captures recadrées au milieu d'une rangée de
  tableau, coupées en haut ; et leurs liens sont des **flèches « → » nues** qui ne disent pas où
  elles mènent (règle 7.29.0 : un libellé décrit l'écran d'arrivée).
- **GoatCounter n'est pas branché** : `var MESURE = ''` dans `assets/site.js`. Tant qu'il est vide,
  on ne sait rien de ce que les visiteurs regardent.
- **Une branche distante orpheline** : `claude/bancs-de-captures` sur le dépôt du site.

## 3. La console

Constats de l'audit du 22/09/2026 restés hors de la 10.6.0.

- La vue **Cabinets n'a pas de colonne Actions** : on voit les cabinets, on ne peut rien en faire.
- Le **Parc déborde à 1440 px** (la sonde de largeur de la 10.5.0 le mesure).
- Le bouton **« ⋯ »** : Skander avait demandé en 7.29.0 qu'un menu de ligne porte un mot, pas un
  pictogramme. Fait dans les deux applications, pas dans la console.
- Les champs des **Réglages** ont des bords gauches irréguliers d'une ligne à l'autre.
- La table des **ventes n'affiche pas la date de vente** — c'est pourtant la colonne qu'on trie.

## 4. Les applications

- **6.9.0 — B10** : la page Écritures démontrable pendant le jeu d'exemple du Cabinet.
- **Un audit UI/UX du Cabinet** en Product Designer SaaS senior (gravité / problème / pourquoi /
  correction), comme celui qui a donné la 10.6.0 pour la console.
- Les trois pistes jamais demandées, gardées pour mémoire : séparer les installateurs arm64 / x64
  (les 222 Mo du dmg universel), la signature Apple et Windows (certificats payants — mais elle
  passe **avant la première vente**, cf. `QUESTIONS.md` : un expert-comptable ne clique pas sur
  « Exécuter quand même »), et l'export TEIF si l'e-facture devient obligatoire.

## 5. Les dettes d'outillage

- **`skanfact.tn` est injoignable depuis une session Claude** (le proxy le bloque, `api.skanfact.tn`
  aussi). On vérifie donc la branche publiée et le run de déploiement, jamais la page telle qu'un
  visiteur la reçoit. Toute affirmation sur « ce que le site affiche » doit le dire.
- **Les tarifs du site ne sont pas confrontés à ceux du worker par un test.** `essai-achat.mjs`
  travaille contre un faux serveur ; le jour où les deux divergent, rien ne le dira.
- **Aucun test ne confronte `TARIFS-REFERENCE.md` aux prix réellement réglés** dans la console.
