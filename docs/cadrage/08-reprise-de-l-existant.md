# 08 — La reprise de l'existant

*Proposé le 28/09/2026, relu le même jour contre tout le dépôt. **Validé par Skander le 28/09/2026.** Suit `VISION-ARCHITECTURE.md` (§ 4.3, § 4.8,
risque R15, § 11 points 1 et 2), `00-les-trois-parcours.md` (décision 5 : le passage de la v10),
`01-modele-de-donnees.md` (§ 20 : où va chaque donnée de la v10, R16 : l'origine),
`07-offres-et-prix.md`.*

## En bref (pour Skander)

Trois choses à reprendre, et une règle pour toutes :
1. **Le moteur et ses tests.** C'est la vraie valeur du projet : environ 20 000 lignes de calcul
   tunisien (`core.js`, `compta.js`, `cabcore.js`, `teif.js`) tenues par **1 740 tests**. On les
   **porte**, on ne les réécrit pas (vision § 4.8).
2. **Les données de nos utilisateurs actuels** (application entreprise et SkanFact Cabinet). Rien
   n'est forcé (décision du 28/09). Celui qui passe retrouve **tout son historique**, et le temps de
   licence qu'il lui reste devient du temps d'abonnement.
3. **Les données des concurrents** (Excel, Sage, Ciel, Hesabi…). Personne ne change de logiciel s'il
   doit tout retaper (vision § 11, point 2). C'est un argument de vente autant qu'un outil.

**La règle : une reprise n'est acceptée que si les chiffres sont les mêmes avant et après.** La TVA
de chaque mois, la balance, le chiffre d'affaires, ce que chaque client doit : l'outil de reprise
calcule tout **des deux côtés** et compare. Un écart bloque le passage et le montre. C'est notre
règle « deux chemins, un chiffre », appliquée au déménagement.

---

## 1. Le moteur et ses tests

### 1.1 Ce qu'on porte

| Aujourd'hui | Ce qu'il devient | Comment |
|---|---|---|
| `src/renderer/core.js` (≈ 10 600 lignes) : calcul des pièces, TVA, timbre, retenue, devises, stock, paie, déclarations | Le **moteur de calcul du socle** (`02` § 2) | Porté en TypeScript, fonction par fonction, **tests d'abord** |
| `src/renderer/compta.js` (≈ 6 900 lignes) : moteur comptable pur, partagé avec le Cabinet | Le **moteur d'écritures** du socle et la Comptabilité complète | Même méthode |
| `src/cabinet/cabcore.js` (≈ 2 400 lignes) : droits, production, révision | Module Cabinet, et la porte des droits (`03` D2 reprend `peut`) | Ce qui est pur est porté ; ce qui tient au fichier local disparaît |
| `src/renderer/teif.js` : le fichier TEIF 1.8.8 | Module Ventes (facture électronique) | Porté tel quel, avec sa validation contre le schéma |
| `test/suites/` : 46 suites, 1 740 tests | Les tests du nouveau moteur | Chaque test de calcul est porté **avant** la fonction qu'il vérifie |

**Ce qui n'est pas porté** : les écrans (`app.js`, ≈ 19 000 lignes), qui sont refaits avec la
bibliothèque d'interface (vision § 4.8) ; le stockage JSON, les sauvegardes locales, le paquet
`.skanpack`, les licences hors ligne, les mises à jour Electron. La plateforme remplace tout cela par
le serveur (`01` § 20).

### 1.2 Comment on porte sans rien casser

1. **Les tests d'abord.** On porte un test, on le voit échouer sur le nouveau moteur vide, on porte la
   fonction, il passe. La règle du projet vaut toujours : un test se prouve en réintroduisant son
   défaut.
2. **L'argent passe en entiers** (vision § 4.3, `01` R3). C'est **le** changement de fond : le moteur
   actuel calcule en nombres à virgule et arrondit au millime (`round3`). Pendant tout le portage, un
   **banc de comparaison** fait tourner l'ancien et le nouveau moteur sur les mêmes pièces : l'exemple
   de cinq ans, les jeux de saturation (8 000 pièces, 60 dossiers), des pièces tirées au hasard. Il
   exige **le même millime**. Un écart est soit un défaut du portage, soit un défaut de l'ancien
   moteur que les entiers révèlent. Dans les deux cas, il s'écrit et se tranche. Il ne se tolère
   jamais.
3. **Les invariants « deux chemins, un chiffre »** (`test/suites/verite-comptable.js`) sont portés en
   premier : ce sont eux qui disent si le reste est juste.
4. **Les leçons ne se reperdent pas.** Chaque test qui porte un numéro de version (« 10.14.0 : la
   retenue naît au règlement ») garde ce numéro. Le nouveau moteur retombe ainsi sur les mêmes pièges
   au même endroit, et le test le dit.

### 1.3 Pendant que la v10 vit encore

Tant que les deux existent, une correction de calcul dans la v10 (une loi de finances, un défaut
trouvé chez un pilote) **est aussi portée** dans le nouveau moteur, avec son test. Un fichier de
suivi liste les corrections faites d'un côté et pas encore de l'autre, et il doit être vide avant
chaque version de la plateforme. C'est la règle des deux applications : ce qui est appris d'un côté
se vérifie de l'autre.

---

## 2. Les utilisateurs de l'application actuelle

### 2.1 Le parcours « Passer à la plateforme » (décision 5 du `00`)

1. Dans l'application actuelle, un bouton **« Passer à la plateforme »**. C'est la seule fonction
   nouvelle que la v10 recevra pendant son entretien (décision 5 du `00`), et elle n'arrive qu'à la
   fin du développement, quand la plateforme sait recevoir. Il explique ce qui va se
   passer, ce qui est envoyé (le fichier de données et les pièces jointes) et ce qui ne l'est pas.
2. **Un essai à blanc d'abord** : le fichier est envoyé et **repris sur le serveur sans rien
   créer**. Le serveur renvoie le **rapport de reprise** (§ 2.3) : ce qui passe, les chiffres comparés,
   et ce qui demande une réponse (un client sans matricule, une série qui continue…).
3. L'utilisateur lit le rapport, répond aux questions, et **confirme**. L'entreprise est créée sur le
   serveur avec tout son historique. Il en est le **propriétaire** (`03` § 10).
4. **Le dossier de l'application actuelle passe en lecture seule**, avec son accord explicite, à la
   même seconde. C'est indispensable : sinon, la même série de factures continuerait des deux côtés,
   et deux factures différentes porteraient le même numéro. L'écran de la v10 le dit : « Ce dossier
   vit maintenant sur la plateforme, depuis le … », avec le lien. Le fichier local **n'est jamais
   effacé** : il reste lisible, et il reste la preuve de ce qui a été envoyé.
5. **Le temps de licence qui reste devient du temps d'abonnement** (décision du 28/09) :
   `abonnement.credit_v10` (`01` § 18). Le calcul est affiché avant la confirmation. Aujourd'hui
   personne ne paie (§ 4) : le cas ne se présentera que si une licence est vendue avant le lancement.

**Ce qui ne passe jamais** : le **jeu d'exemple**. Un fichier marqué exemple (`estDemo`) est refusé,
avec le message qui explique. Une fausse entreprise ne doit pas devenir une vraie.

### 2.2 Ce que chaque donnée devient

La table complète est au `01` § 20. Les points délicats :

| Donnée | Ce qui se passe |
|---|---|
| **Factures déjà émises** dans la v10 | Reprises comme **émises**, avec leur numéro, leur date et leur copie figée (`01` R7). Elles n'ont pas été envoyées à la TTN par SkanFact : elles portent l'origine « v10, hors TTN » (`01` R16), et aucun envoi n'est tenté après coup |
| **Séries et compteurs** | La série **continue** : la prochaine facture sur la plateforme suit la dernière de la v10 (`01` § 6) |
| **La chaîne d'empreintes** | Elle **commence à la reprise** : la première pièce reprise ouvre la chaîne, qui porte l'empreinte du fichier v10 envoyé. On ne prétend pas avoir scellé ce qui ne l'était pas |
| **Écritures** | La v10 les **déduit** des pièces à chaque lecture ; la plateforme les **écrit** (`01` § 14). La reprise les génère **une fois**, avec le moteur porté, puis elles sont validées pour les mois clôturés dans la v10, et laissées au brouillard pour les autres |
| **Mois et exercices clôturés** | Restent clôturés (`periode_close`, `exercice`) |
| **Pièces jointes** | Reprises en `fichier`, liées aux mêmes pièces |
| **Paie** | Salariés, bulletins remis (scellés), absences, avances, déclarations sociales déposées |
| **Réglages** | Repris ; le **régime fiscal** devient une règle datée (`regle_entreprise`) à partir de sa date d'effet connue, sinon du premier jour de l'historique, avec une question dans le rapport |
| **Historique des conflits** (`conflictArchive`) et suppressions mémorisées | Gardés comme **fichier d'archive** attaché à l'entreprise, jamais comme des pièces |
| **Plusieurs entreprises sur un poste** (7.14.0) | Chaque dossier passe séparément ; le rapport propose de les réunir dans une même organisation |

### 2.3 Le rapport de reprise

C'est le cœur de la confiance. Il dit, **avant** toute création :
- **ce qui passe** : le nombre de clients, de pièces, de règlements, de bulletins, de pièces jointes,
  par année ;
- **les chiffres comparés**, calculés par la v10 et par la plateforme sur les données reprises :

| Chiffre | Comparé |
|---|---|
| TVA collectée, déductible et à payer | Mois par mois, sur tout l'historique |
| Retenues à la source (subies et opérées) | Mois par mois |
| Chiffre d'affaires | Mois par mois |
| Ce que doit chaque client, ce qu'on doit à chaque fournisseur | À la date de la reprise |
| Solde de chaque compte de trésorerie | À la date de la reprise |
| Balance des comptes | À chaque fin d'exercice |
| Stock (quantité et valeur) | À la date de la reprise |
| Masse salariale, cotisations | Par trimestre |

- **ce qui demande une réponse** : les champs manquants qu'on ne devine pas (règle du projet : la
  valeur qui ne fait rien, jamais un chiffre inventé) ;
- **ce qui ne passe pas**, et pourquoi.

**Un écart bloque la confirmation.** Il est montré ligne par ligne, avec les pièces qui le causent.
Un écart qui vient d'un **défaut de l'ancienne version** (le passage en entiers peut en révéler) ne
se « corrige » pas en silence : il est expliqué dans le rapport, et le client choisit, aidé par son
comptable s'il en a un.

### 2.4 Les cabinets (SkanFact Cabinet)

| Ce qu'a le cabinet | Ce que ça devient |
|---|---|
| L'état du cabinet : nom, collaborateurs, relances, modèles, correspondance de comptes | Une organisation `cabinet`, avec son **code cabinet** (`00`) |
| **Collaborateurs déclarés par leur nom** | Des **invitations par e-mail**, avec leur rôle converti (`03` § 10). Leur nom reste sur le travail déjà signé, et il est relié à leur compte quand ils acceptent (`01` R16) |
| **Dossiers d'un client qui envoyait des paquets** | Un **mandat** (proposé) vers l'entreprise du client **si le client passe aussi** ; sinon un **dossier tenu** (`03` § 3.5) repris du livre |
| **Dossiers hors SkanFact** | Des **dossiers tenus** (`01` § 20) |
| Livres par exercice (`livre-AAAA.json`) : écritures, lettrages, relevés, immobilisations, révision, questions, liasses | Repris dans l'entreprise du dossier, avec leurs **numéros et validations** |
| Paquets reçus | Gardés comme **fichiers d'archive** (plus de paquets ensuite) |
| Licence du cabinet | Temps restant repris, comme pour l'entreprise |

**Le cas délicat : le client et son cabinet passent tous les deux.** Les mêmes opérations existent
alors deux fois : dans le fichier du client (ses pièces, dont la v10 déduit les écritures) et dans
le livre du cabinet (les écritures reçues par paquet, puis révisées, complétées et validées).
- **Pour les périodes que le cabinet a validées ou clôturées**, le **livre du cabinet fait foi**
  pour les écritures : c'est la comptabilité légale, signée par lui. Les pièces du client y sont
  rattachées comme justificatifs.
- **Pour les périodes que le cabinet n'a pas encore traitées**, les écritures naissent des pièces du
  client, au brouillard, comme pour tout nouveau travail (`01` § 14).
- **L'ordre ne compte pas** : si le cabinet passe avant son client, son dossier est d'abord tenu. Il
  devient un mandat quand le client passe et accepte, et le rapport montre alors le rapprochement.
- **Le rapport compare les deux côtés**, période par période. C'est exactement le test de parité
  qui existe déjà (les cinq ans de l'exemple envoyés par paquet, chaque chiffre comparé : TVA, report,
  timbre, retenue, balance, états, liasse).
- **À VÉRIFIER** avec les trois cabinets pilotes : que cette règle correspond à leur manière de
  travailler, sur un vrai dossier.

---

## 3. Les données des concurrents

### 3.1 Le principe : l'essentiel d'abord, l'historique si on le veut

Une entreprise qui arrive d'ailleurs a besoin, **pour travailler dès le premier jour**, de :
1. ses **fiches** : clients, fournisseurs, articles avec leurs prix ;
2. ce qui est **encore ouvert** : les factures impayées, les devis en cours, les chèques et traites
   en portefeuille ;
3. ses **soldes d'ouverture** : les à-nouveaux de la comptabilité (donnés par son comptable), les
   soldes de banque et de caisse, le stock de départ ;
4. la **suite de sa numérotation** : son dernier numéro de facture (déjà possible dans la v10, 213b).

L'**historique complet** (les factures des années passées) est **facultatif**. Il est repris en
**lecture seule**, avec son origine (`01` R16), pour être consulté et compter dans les statistiques.
Il ne crée jamais de nouvelle écriture dans une période qu'un autre logiciel a déjà déclarée.

### 3.2 Les sources, par ordre d'utilité

| Source | Ce qu'on reprend | Comment |
|---|---|---|
| **Tableur** (Excel, CSV, copier-coller) | Fiches, factures ouvertes, soldes, stock | Déjà en partie dans la v10 (clients et catalogue collés, 213e) : on reconnaît les colonnes, on montre un aperçu, on demande ce qu'on ne devine pas |
| **Fichier d'écritures comptables** (FEC ou équivalent, balance) | Balance d'ouverture, historique comptable | Pour les **cabinets** qui quittent un autre logiciel : l'étude de marché signale que Sage Coala, encore utilisé, est arrêté par son éditeur. La v10 sait déjà **écrire** le FEC (H3) ; on apprend à le **lire** |
| **Factures TEIF reçues ou émises** | Achats (déjà dans la v10, H1), historique des ventes | Le format officiel est le même pour tous : c'est la reprise la plus fiable |
| **Relevés bancaires** | Mouvements, rapprochement | Déjà dans la v10 (9.5.0, lignes d'en-tête des banques comprises) |
| **Exports des logiciels concurrents** (Sage, Ciel, Hesabi, Swiver…) | Selon ce que chacun exporte | **À VÉRIFIER** : les formats réels. On les apprend sur des fichiers fournis par les pilotes et les premiers clients, jamais en devinant |

### 3.3 Les mêmes garanties

La reprise d'un concurrent suit la même règle que celle de la v10 : un **essai à blanc**, un
**rapport**, des **chiffres comparés** (les totaux que le fichier annonce contre ceux que nous
recalculons), et **rien d'inventé** : une TVA absente reste absente et se demande.

---

## 4. Les offres : de la v10 à la plateforme

Les deux offres gardent leur prix, mais elles ne contiennent pas exactement la même chose (`07`,
et `TARIFS-REFERENCE.md` pour la v10) :

| v10 | Plateforme | Ce qui change pour le client |
|---|---|---|
| **Indépendant**, 390 DT/an | **Essentiel**, 390 DT/an | Il gagne la facture électronique signée et envoyée, la retenue avec TEJ, le comptable dans les mêmes données, le web et le hors-ligne, et (depuis le 28/09/2026, `14`) **le stock et une caisse**. La paie et les immobilisations, en **lecture seule** dans la v10, se prennent **en module** (`07`) |
| **Entreprise**, 690 DT/an | **Complet**, 690 DT/an | Tout, comme aujourd'hui, avec la caisse et la comptabilité complète comprises |
| Option Comptabilité (9.1.0) | Module Comptabilité complète, ou compris dans Complet | — |

**Aujourd'hui, personne ne paie l'application actuelle** (Skander, 28/09/2026 : elle est encore en
phase de développement, avec les trois comptables pilotes). Il n'y a donc ni crédit de licence à
reprendre, ni « ancien client » à traiter à part. La règle du `00` (le temps payé devient du temps
d'abonnement) reste écrite pour le cas où une licence serait vendue avant le lancement.

**Le message aux clients** (écrit dans le document 11, pour le site et l'application) dit
honnêtement : ce qui s'ajoute, ce qui devient un module, et ce que devient leur licence.

---

## 5. La fin de vie de l'application actuelle

- Elle vit tant que la plateforme n'est pas complète (vision § 11, point 1) : **corrections et lois
  de finances**, pas de nouvelles fonctions (décision du 27/09).
- **Le jour de la fin est annoncé 12 mois à l'avance**, dans l'application et sur le site.
- **Après la fin** : plus de mises à jour, mais **l'application continue de s'ouvrir** et d'exporter.
  Les données sont sur le poste du client, et elles restent à lui (règle : jamais de données en
  otage). Le serveur des licences reste allumé jusqu'à l'expiration de la dernière licence vendue.
- Le passage à la plateforme reste possible **jusqu'au dernier jour**, et même après, par le site
  (envoyer son fichier de données).

---

## 6. Comment on prouve que la reprise est juste

| Jeu de données | Ce qu'il prouve |
|---|---|
| **L'exemple de cinq ans** (entreprise) | Toute la reprise, chiffre par chiffre ; il sert déjà de référence aux invariants |
| **Les jeux de saturation** (8 000 pièces et 1 500 clients ; 60 dossiers du Cabinet) | La tenue en volume et le temps de reprise |
| **La parité entreprise → Cabinet** (déjà écrite, `test/suites/verite-comptable.js`) | Le cas « le client et son cabinet passent tous les deux » (§ 2.4) |
| **Les fichiers des trois cabinets pilotes**, avec leur accord | La vraie vie : ce qu'aucun jeu fabriqué ne contient |
| **Des fichiers v10 anciens** (formats de données des premières versions) | La reprise passe par la même migration de format que la v10 (`migrateData`), qui sait lire toutes ses versions |

Seuils, écrits d'avance (règle du projet : on mesure avant) ; `migrateData` est dans `src/renderer/core.js` :

| Mesure | Seuil |
|---|---|
| Reprise d'une PME de cinq ans (essai à blanc et rapport) | < 2 minutes |
| Reprise d'un cabinet de 60 dossiers | < 30 minutes, dossier par dossier, reprenable si elle s'interrompt |
| Écart toléré sur un chiffre comparé | **0 millime** |

---

## 7. À VÉRIFIER

1. **Le client et son cabinet qui passent tous les deux** : la règle du § 2.4, sur un vrai dossier
   (cabinets pilotes).
2. **Les formats d'export** de Sage, Ciel, Hesabi et Swiver, sur des fichiers réels (pilotes, premiers
   clients).
3. **Les factures v10 reprises « hors TTN »** : aucune obligation de les envoyer après coup ? (TTN,
   comptable ; `05` § 3.1).
4. **L'historique repris d'un concurrent** en lecture seule suffit-il à un comptable, ou veut-il les
   écritures ? (comptable).

## 8. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | Le moteur et ses tests sont portés, tests d'abord ; un banc compare l'ancien et le nouveau moteur au millime pendant tout le portage ; toute correction de la v10 est aussi portée |
| 28/09/2026 (proposé) | Une reprise n'est acceptée que si les chiffres sont identiques avant et après ; essai à blanc et rapport avant toute création ; écart toléré : zéro |
| 28/09/2026 (proposé) | Le dossier v10 passe en lecture seule au moment du passage, avec l'accord du client ; le fichier local n'est jamais effacé ; le jeu d'exemple ne passe jamais |
| 28/09/2026 (proposé) | Factures v10 reprises comme émises, « hors TTN », la série continue ; la chaîne d'empreintes commence à la reprise |
| 28/09/2026 (proposé) | Client et cabinet qui passent tous les deux : le livre du cabinet fait foi pour les périodes qu'il a validées, les pièces du client pour le reste |
| 28/09/2026 (proposé) | Concurrents : fiches, pièces ouvertes, soldes d'ouverture et suite de numérotation d'abord ; historique facultatif en lecture seule ; lecture du FEC pour les cabinets |
| 28/09/2026 (relecture) | Personne ne paie la v10 aujourd'hui : pas de crédit ni de prix fondateur à prévoir pour d'anciens clients ; le bouton « Passer à la plateforme » est la seule fonction nouvelle de la v10, en fin de développement |
| 28/09/2026 (proposé) | Fin de la v10 annoncée 12 mois à l'avance ; elle continue de s'ouvrir et d'exporter après |
