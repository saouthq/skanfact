# Le plan comptable — ce que le comptable doit voir dans SkanFact Cabinet

*Écrit le 15/09/2026, après la visite du comptable de Skander. Il a ouvert **SkanFact Cabinet**, pas
l'application entreprise, et il a dit qu'il manquait « beaucoup de choses comptables ». Il a retenu
deux termes : le **mouvement de compte** et l'**écriture comptable dans le journal**.*

*Les versions 8.8.0, 8.9.0 et 9.0.0 ont construit tout cela… dans l'application entreprise. Le
Cabinet, lui, n'a pas bougé : il reçoit les fichiers, il ne les montre pas. Ce plan corrige ça.*

---

## En une page

- **Le comptable juge l'outil à ce qu'il voit en ouvrant un dossier.** Aujourd'hui il voit : une fiche
  client, des cases « reçu / manquant », un graphique de chiffre d'affaires, une liste de paquets et
  un bouton « Exporter les écritures » qui écrit un CSV sur le disque. **Aucun livre à l'écran.**
  Pour lui, c'est un classeur de fichiers, pas un logiciel comptable.
- **La matière est déjà là.** Chaque paquet mensuel contient les écritures en partie double (avec
  numéro, journal, pièce, compte, tiers, lettrage depuis la 9.0.0), la balance du mois, les cinq
  journaux auxiliaires, la TVA du mois, les factures en PDF, les justificatifs d'achat, les bulletins.
  Il ne manque **que les écrans**.
- **Quatre versions, dans cet ordre** : d'abord les livres (ce qu'il a demandé), puis les pièces derrière
  chaque chiffre, puis son travail à lui (états d'un mois, plan de comptes du cabinet, questions au
  client), et enfin la démonstration qui montre tout ça rempli au premier lancement.
- **Une règle ne bouge pas** : l'application cabinet **ne modifie jamais** les données d'un client et
  ne lui renvoie rien (Cabinet 1.0.0). Elle lit, elle montre, elle exporte, elle pose des questions.
  Elle ne saisit pas d'écriture chez le client.
- **Une garantie à tenir** : le Cabinet doit afficher **exactement le même chiffre** que l'application
  entreprise pour le même mois. Un test comparera la balance calculée côté cabinet, depuis le CSV du
  paquet, à celle que l'app entreprise a calculée en le fabriquant.

---

## Ce que le comptable a vu, et ce qu'il attendait

| Ce qu'il cherche | Ce que le Cabinet montre aujourd'hui | Ce qui manque |
|---|---|---|
| Le **journal** : chaque pièce, numérotée, avec ses lignes D/C | Rien à l'écran. Un export CSV sur le disque. | La page Livre-journal |
| Le **mouvement d'un compte** : ce qui est passé sur le 411, sur la banque, avec le solde | Rien. | Le Grand livre |
| La **balance** : est-ce que ça tombe juste, compte par compte | Rien (le fichier `balance.csv` est dans le paquet, jamais lu). | La Balance |
| Ce que **chaque client doit** encore, ce qu'on doit à chaque fournisseur | Rien. | Le lettrage / l'échéancier |
| La **TVA du mois** : collectée, déductible, crédit, à payer | Une seule case « TVA à décaisser » dans la liste des paquets. | Le détail (`tva.json` est dans le paquet) |
| **La pièce** derrière une écriture : la facture, le justificatif | « Ouvrir le paquet » ouvre une liste de fichiers, sans lien avec les chiffres. | Le clic depuis le livre vers le PDF |
| Le **résultat** de l'exercice, le bilan | Rien. | Les états, sur les mois reçus |
| **Où il en est** de son travail sur ce client | Trois états, tous côté client (reçu / provisoire / manquant). | *saisi → déclaré* côté cabinet (F1 du plan Cabinet) |
| **Ses** numéros de compte | Une phrase : « donne-les une fois à ton client ». | Une table de correspondance côté cabinet |
| Ce qu'il doit **demander au client** (pièce manquante, compte d'attente non soldé) | La liste « Signalé » du manifeste, en un chiffre. | Une page de questions, envoyable |

---

## Ce que chaque paquet contient déjà (rien à changer côté entreprise)

`journaux/ecritures.csv` — N° ; Date ; Journal ; Pièce ; Compte ; Tiers ; Libellé ; Débit ; Crédit ;
Lettrage ; Devise. `journaux/balance.csv` — la balance du mois. `journaux/ventes.csv`, `achats.csv`,
`encaissements.csv`, `reglements-fournisseurs.csv`, `tresorerie.csv`. `journaux/tva.json` — la
déclaration du mois. `ventes/*.pdf`, `achats/<n°>/*`, `paie/*.pdf`, `social/cnss-T*.json`.
`manifeste.json` — chaque fichier avec son empreinte, plus `chiffres` (CA, TVA) et `absents`.

Deux précisions qui décident de la conception :

- **Un paquet ne contient que son mois.** Le grand livre d'un compte sur l'année, c'est la
  concaténation de douze paquets. L'à-nouveau est dans le paquet de janvier (pièce `AN-AAAA`, 9.0.0)
  et les soldes de départ des comptes dans une pièce `OUVERTURE` (8.9.0). **Un mois manquant fausse
  tous les soldes qui suivent** : chaque livre doit le dire en tête, pas le cacher.
- **Un paquet d'avant la 8.8.0 n'a ni N°, ni Tiers, ni Lettrage** (colonnes absentes du CSV). Les
  colonnes sont lues par NOM (règle 6.8.0) : ces écrans affichent « — » et une phrase, jamais des zéros.

---

## Les versions

*Les deux applications partagent le même numéro depuis la 6.6.0. Les numéros ci-dessous sont ceux
du dépôt ; côté cabinet, le CHANGELOG le dit en clair : « Cabinet ».*

### 9.1.0 — Les livres du dossier *(la réponse au comptable)*

Dans la fiche d'un dossier, un bloc **« Comptabilité »** avec un sélecteur de période (un mois, un
exercice, du… au…) et quatre onglets. Tout est calculé à partir des `ecritures.csv` des paquets de la
période, rien n'est ressaisi.

- **Livre-journal.** Chaque pièce numérotée, filtrable par journal (VT, AC, BQ, CA, PAIE, OD, AN),
  recherche sur le libellé, le tiers et le numéro de pièce. En dessous, le **centralisateur** : un
  total débit/crédit par mois et par journal. Export CSV de ce qu'on regarde (le bouton nomme ce qu'il
  exporte, règle 7.17.0).
- **Grand livre.** Un sélecteur de compte (recherche par numéro ou par nom), et pour le compte
  choisi : ouverture, chaque ligne avec son solde progressif, total. « Tous les comptes » donne la
  suite complète, un compte après l'autre, comme sur papier. Le nom d'un compte vient du plan (le
  cabinet aura le sien en 9.3.0), et un sous-compte de tiers porte le nom du tiers.
- **Balance.** Générale (ouverture, mouvements, soldes, six totaux, « équilibrée » en vert ou l'écart
  en rouge) et auxiliaire clients / fournisseurs. Un test la compare au `balance.csv` que l'app
  entreprise a mis dans le paquet : **les deux applications doivent dire la même chose au millime.**
- **Lettrage.** Ce qui reste ouvert, tiers par tiers : factures non réglées, avoirs non imputés,
  achats non payés, avec l'âge. C'est la première question d'un comptable à son client.
- **Le mois manquant se dit sur chaque onglet** : « mars 2026 n'a pas été reçu : les soldes après
  février sont incomplets », avec le bouton « Relancer ». Et le mois **provisoire** aussi.
- **Un paquet ancien se dit** : « fabriqué par SkanFact 8.7.0 : pas de numérotation ni de tiers ».

Comment c'est construit, pour que ça ne diverge pas de l'app entreprise :

- Un module **pur et partagé**, `src/renderer/livres.js`, chargé par LES DEUX applications (comme
  `rowmenu.js` et `reglages.js`), qui prend des **lignes d'écriture** (date, journal, pièce, compte,
  tiers, libellé, débit, crédit, lettrage, n°) et rend le journal, le centralisateur, le grand livre,
  la balance et le lettrage. L'app entreprise continue de passer par `core.js` ; le test qui compte
  vérifie que `livres.js` nourri du CSV du paquet rend la **même balance** que `core.balanceGenerale`
  sur le jeu d'exemple, sur les 24 mois.
- Côté cabinet, `main.js` lit `ecritures.csv` dans chaque paquet de la période (il sait déjà le faire
  pour l'export) et rend les lignes ; le renderer calcule et affiche. Les lignes lues sont gardées en
  mémoire pour la session, jamais écrites dans `cabinet-data.json` (un paquet reçu avant cette
  version doit s'afficher pareil qu'un paquet reçu après).
- Aucun paquet n'est modifié, aucun fichier n'est écrit : c'est de la lecture.

Ce que le comptable doit pouvoir dire après cette version : *« je vois le journal, je vois le
mouvement de n'importe quel compte, je vois que la balance tombe juste, et je sais ce que chaque
client doit encore. »*

### 9.2.0 — Les pièces derrière les chiffres

- **Un clic sur une écriture ouvre sa pièce.** La pièce `FAC-2026-012` est dans `ventes/FAC-2026-012.pdf`,
  un achat dans `achats/<numéro>/`, un bulletin dans `paie/`. Le manifeste fait le lien. Une pièce
  que le client n'a **pas pu joindre** (`absents`) se dit en orange à côté de la ligne — c'est la
  constatation E1 du plan Cabinet, jamais livrée.
- **La TVA du mois, lisible** : collectée, déductible, crédit reporté, à payer, timbres, retenues —
  lue dans `tva.json`, dans une carte de la fiche du dossier, mois par mois. Et le crédit de TVA
  reporté ne s'affiche plus « 0,000 DT » quand il n'y a rien à déclarer (B7).
- **Le résultat et le bilan sur les mois reçus** : le même calcul que « États financiers » côté
  entreprise, avec la même phrase « déduits de la balance, pas la liasse » — et l'avertissement si
  un mois manque. Réservé à un exercice complet reçu ; sur un exercice troué, on montre le résultat
  de la période et rien d'autre.
- **L'empreinte du manifeste** affichée sur le paquet (E2) : c'est ce que le client lit dans son
  SkanFact, et c'est le seul rituel qui prouve que le fichier est bien celui qu'il a envoyé.
- Impression : le grand livre d'un compte et la balance s'impriment (la fiche s'imprime déjà).

### 9.3.0 — Le travail du cabinet

- **L'état d'un mois côté cabinet** (F1) : *reçu → saisi dans mon logiciel → déclaré → payé*. Trois
  cases à cocher par mois, avec la date. « À faire » les compte. Ce sont les seules données que le
  cabinet écrit sur un dossier, et elles sont les siennes : elles ne repartent jamais chez le client.
- **Le plan de comptes du cabinet** : une table de correspondance (compte SkanFact → compte du
  cabinet, avec le libellé du cabinet), appliquée aux livres ET à l'export. Aujourd'hui la seule
  réponse est « donne tes numéros à ton client » : ça marche pour un client, pas pour soixante.
  À VÉRIFIER avec le comptable : quel logiciel il utilise et quel format il importe (voir plus bas).
- **L'export au format de son logiciel**. Le CSV actuel est un format neutre ; s'il faut un format
  précis (colonnes, séparateur, encodage, dates), il se règle une fois dans les Réglages et sert à
  tous les dossiers.
- **Les questions au client** : une page qui rassemble ce que les livres ont fait apparaître — une
  pièce absente, un compte d'attente (471) non soldé, une facture ouverte depuis plus de 90 jours, un
  mois provisoire — et qui se transforme en un mail au client d'un geste, comme la relance. Le
  cabinet ne corrige pas : il demande, et le client corrige chez lui.

### 9.4.0 — La démonstration qui montre tout

- **Le jeu d'exemple livre de vrais paquets `.skanpack`** (tâche n° 67, et B10 du plan Cabinet) :
  fabriqués depuis le jeu d'exemple de l'app entreprise, posés dans un dossier « exemple » à part,
  effacés au premier vrai paquet. Sans ça, tout ce qui précède est **vide** pendant la démonstration
  — et la démonstration est le moment où un comptable décide.
- Les livres, la TVA, le lettrage, les questions au client : tout doit être rempli au premier
  lancement, sur trois ou quatre dossiers d'exemple, dont un avec un mois manquant et un avec un
  paquet provisoire, pour que les avertissements se voient aussi.

---

## Ce que le comptable verra en ouvrant un dossier, à la fin

1. En haut : la fiche, le régime, la période de TVA, les honoraires.
2. Une ligne de **douze cases** : reçu / provisoire / manquant, et pour le cabinet saisi / déclaré / payé.
3. La **TVA du mois** en cartes, et le **chiffre d'affaires** en barres.
4. Le bloc **Comptabilité** : Livre-journal · Grand livre · Balance · Lettrage — sur le mois, sur
   l'exercice, ou du… au…, avec l'avertissement si un mois manque, et un clic qui ouvre la pièce.
5. Les **questions au client**, prêtes à partir.
6. Les paquets reçus, avec leur empreinte et leurs pièces vérifiées, comme aujourd'hui.

---

## Ce qu'il faut lui demander (À VÉRIFIER, avant la 9.3.0)

- **Quel logiciel de production** il utilise (Sage, Ciel, un logiciel tunisien ?) et **quel format**
  il importe : colonnes, séparateur, encodage, format de date, longueur des comptes.
- **Son plan de comptes** : est-ce qu'il veut des sous-comptes par tiers (411001…) ou le collectif
  avec le nom du tiers ? Est-ce qu'il code les journaux comme nous (VT, AC, BQ, CA, OD, AN, PAIE) ?
- **La TVA en une écriture au dernier jour du mois**, le 13 pour le résultat et non le 12, les
  contreparties par défaut (434, 4421, 16, 471), la TFP à 2 % (1 % pour l'industrie) : ce sont les
  choix faits en 8.9.0 et 9.0.0, signalés « À VÉRIFIER » dans l'app entreprise. Il faut sa réponse.
- **Ce qu'il fait d'un mois provisoire** : il attend, ou il saisit et corrige ensuite ?
- **Ce qu'il veut voir en premier** en ouvrant un dossier : la balance ? le lettrage ? la TVA ?
  C'est ce qui décidera de l'ordre des onglets.

---

## Ce qu'on ne fait pas

- **Pas de saisie d'écriture dans le Cabinet.** Le cabinet qui veut passer une OD chez le client la
  demande au client, ou la saisit dans son propre logiciel. Un Cabinet qui écrirait chez le client
  casserait la règle qui fait la valeur du produit (les données appartiennent au client, le cabinet
  ne peut rien y changer sans qu'il le sache).
- **Pas de serveur** : les livres se lisent dans les paquets reçus, hors ligne, comme tout le reste.
- **Pas de liasse fiscale ni de bilan officiel** : les états sont déduits de la balance et le disent.
  La liasse se fait dans le logiciel du cabinet, avec ce qu'il a importé.

---

## L'ordre, et ce que chaque version doit prouver

| Version | Ce qu'elle prouve | Le test qui compte |
|---|---|---|
| **9.1.0** | Le comptable voit le journal, le mouvement d'un compte, la balance juste, ce qui reste dû | `e2e:cabinet-livres` : les quatre onglets sur un vrai paquet ; le test unitaire « même balance que l'app entreprise » |
| **9.2.0** | Chaque chiffre mène à sa pièce ; la TVA du mois se lit | `e2e:boucle` étendu : la pièce s'ouvre depuis le journal |
| **9.3.0** | Le cabinet avance son travail sans toucher au client | `e2e:cabinet` étendu : états d'un mois, correspondance de comptes dans l'export, questions envoyées |
| **9.4.0** | Tout est rempli à la première ouverture | `e2e:cabinet` : le jeu d'exemple ouvre un paquet réel et affiche des livres non vides |

La 9.1.0 peut partir tout de suite : elle ne demande aucune réponse du comptable, seulement de lire
ce qui est déjà dans les paquets.
