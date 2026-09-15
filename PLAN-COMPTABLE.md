# Le plan comptable — SkanFact Cabinet devient un vrai logiciel de comptabilité

*Écrit le 15/09/2026. Le comptable de Skander a regardé **SkanFact Cabinet** et a dit qu'il manquait
« beaucoup de choses comptables ». Puis il a précisé ce qu'il veut : pas un pont qui reçoit des
fichiers, mais **une vraie application de comptabilité côté cabinet**, complète, au niveau des
meilleurs logiciels du marché. Ce plan dit ce que « complet » veut dire, ce qu'on a déjà, ce qui
manque, et dans quel ordre le construire.*

---

> **La direction, les décisions et le modèle économique sont dans `DIRECTION.md`** (15/09/2026).
> Ce plan ne porte que les versions du Cabinet et ce qu'elles doivent prouver. La licence du Cabinet
> (§ 5.A de la direction) s'insère après la 9.3.0.

## En une page

- **Ce qui change.** Jusqu'ici le Cabinet était un *récepteur* : il reçoit les paquets, vérifie,
  relance, exporte un CSV vers le logiciel du comptable. Désormais **le Cabinet EST le logiciel du
  comptable** : chaque dossier client y a sa comptabilité complète, tenue par le cabinet, dont le
  paquet SkanFact n'est qu'une source d'écritures parmi d'autres (saisie à la main, relevé bancaire,
  factures d'un client qui n'a pas SkanFact).
- **Ce qui ne change pas.** Le cabinet tient **ses** livres, dans **ses** données. Il n'écrit jamais
  dans le SkanFact du client, et ne lui renvoie rien qui modifie sa facturation. La règle de la
  Cabinet 1.0.0 tient : ce sont deux comptabilités qui se parlent, pas une seule partagée.
- **La bonne nouvelle.** Le moteur existe déjà, dans l'app entreprise : plan comptable SCE, journal en
  partie double, numérotation, grand livre, balance, lettrage, OD, à-nouveaux, amortissements,
  cessions, TVA mensuelle chaînée, retenues à la source, états financiers, rapprochement, clôture avec
  motif de réouverture, paie avec CNSS/IRPP/TFP/FOPROLOS (versions 3.x → 9.0.0, ~70 fonctions pures
  et testées dans `core.js`). **Rien de ça n'est dans le Cabinet.** Le travail, c'est de le partager,
  puis d'ajouter ce que le moteur d'une entreprise n'a jamais eu besoin de savoir faire : saisir au
  kilomètre, importer un relevé, valider un brouillard, réviser, superviser soixante dossiers.
- **La mesure honnête.** C'est un produit à part entière, de la taille de l'app entreprise. Ce plan
  le découpe en **dix versions**, chacune utilisable et démontrable seule, la première en quelques
  jours, l'ensemble en plusieurs mois. Et plusieurs versions **exigent des réponses du comptable**
  (plan de comptes, formats, liasse) : elles sont marquées.

---

## La référence : ce que font les meilleurs

Les logiciels de production comptable auxquels un cabinet compare (À VÉRIFIER lesquels sont
réellement utilisés par le comptable et ses confrères en Tunisie) : **Sage 100 Comptabilité** (le plus
répandu dans les cabinets francophones), **EBP** et **Ciel** (petits cabinets), **Odoo Comptabilité**
(intégré, en ligne), **Pennylane** (le modèle récent : collaboration cabinet ↔ client, flux
bancaires, pièces attachées à chaque ligne), **QuickBooks / Xero** (anglo-saxons, moins pertinents
pour la fiscalité tunisienne), et des éditeurs tunisiens locaux (À VÉRIFIER : noms, parts de marché).

Ce qu'ils ont **tous**, et qu'un comptable considère comme acquis, se range en dix domaines. Le
tableau ci-dessous les confronte à ce que SkanFact a aujourd'hui — **côté entreprise** (le moteur,
réutilisable) et **côté Cabinet** (l'écran du comptable, presque vide).

| Domaine | Ce que les meilleurs font | Moteur (app entreprise) | Cabinet aujourd'hui | Manque |
|---|---|---|---|---|
| **A. Socle** | Plan comptable complet et modifiable par dossier, plan de référence du cabinet, exercices (plusieurs ouverts), journaux paramétrables, devises, sections analytiques | Plan SCE ~110 comptes (nommage), rôles modifiables, 7 journaux fixes, devises sur pièces | Rien | Plan complet (classes 1-9, tous niveaux), exercices explicites, journaux libres, analytique |
| **B. Saisie** | Saisie au kilomètre avec clavier, guides d'écritures, abonnements, brouillard puis **validation** (une écriture validée ne se modifie plus : contre-passation), contrôle d'équilibre, pièces jointes par écriture, recherche | OD à la main équilibrées, pièces numérotées, clôture par période | Rien | Tout l'écran de saisie, le brouillard/validation, les guides, les abonnements, l'extourne |
| **C. Imports** | Relevés bancaires (CSV, OFX, MT940, flux directs), factures par OCR, écritures d'un autre logiciel, reprise de balance d'ouverture | Paquet SkanFact (écritures + pièces), lecture de photo (en pause) | Paquet SkanFact (fichiers, pas écritures) | Relevé bancaire, import d'écritures tiers, reprise d'un dossier existant (balance d'ouverture) |
| **D. Banque** | Rapprochement par relevé, lettrage automatique (montant, date, libellé), pointage, état de rapprochement, suspens | Pointage, état de rapprochement, solde relevé saisi | Rien | Import du relevé, rapprochement automatique, gestion des suspens |
| **E. Tiers** | Lettrage manuel et automatique, délettrage, échéancier, balance âgée clients/fournisseurs, relances | Lettrage déduit, balance auxiliaire, âge des impayés, relances (côté client) | Relances de paquets | Lettrage à la main, délettrage, balance âgée, échéancier côté cabinet |
| **F. Éditions** | Journaux, centralisateur, grand livre, balances (générale, auxiliaire, âgée, N/N-1), états financiers **au format légal**, SIG, ratios, tableaux de bord, tout en PDF/Excel, toute période | Tout sauf N/N-1, SIG, ratios ; états « déduits, pas la liasse » | Rien | Écrans + impressions + comparatifs + SIG/ratios, états conformes NCT 01 (À VÉRIFIER) |
| **G. Clôture** | Contrôles, écritures d'inventaire (dotations, provisions, CCA, FNP, PCA, régularisations), clôture d'exercice irréversible, à-nouveaux, réouverture tracée, verrouillage par période | Clôture mensuelle avec motif, dotations, à-nouveaux automatiques, cessions | Rien | Provisions, régularisations (CCA/FNP/PCA/FAE), clôture d'exercice définitive, suivi des écritures d'inventaire |
| **H. Fiscal tunisien** | Déclaration mensuelle (TVA, RS, TFP, FOPROLOS, TCL, timbre), acomptes provisionnels, IS/IRPP annuel, déclaration employeur, **liasse fiscale**, télédéclaration | TVA chaînée, RS, TFP/FOPROLOS, CNSS, déclaration employeur, échéances réglables | Échéances (dates) | Déclaration mensuelle complète, acomptes, IS, liasse, préparation de la télédéclaration (À VÉRIFIER : portail, formats) |
| **I. Cabinet** | Portefeuille, collaborateurs et droits, suivi de production par dossier et par mois, révision (dossier de travail, feuilles maîtresses par cycle, points en suspens, notes de revue), supervision, lettre de mission, honoraires | — | Portefeuille, relances, échéances, sauvegardes, clé de secours | Collaborateurs, production, révision, supervision |
| **J. Technique** | Multi-utilisateur, piste d'audit (qui a fait quoi, quand), verrouillage, performance sur des milliers d'écritures × dizaines de dossiers, sauvegardes, import/export standards | Partage à deux avec fusion, journal des clôtures | Chiffrement, sauvegardes, clé de secours, chien de garde | Multi-poste (A10), piste d'audit, volume |

Ce que Pennylane a montré, et que personne d'autre n'a bien : **la collaboration cabinet ↔ client**,
avec les pièces attachées à chaque ligne et les questions posées au client depuis la ligne. C'est
précisément ce que le paquet SkanFact rend possible et que les logiciels classiques n'ont pas.
**C'est l'avantage à garder** : le Cabinet ne doit pas seulement rattraper Sage, il doit garder ce
que Sage n'a pas.

---

## Le choix d'architecture (à décider avant d'écrire une ligne)

**Chaque dossier du Cabinet porte une comptabilité complète — la sienne.** Concrètement, un dossier
gagne un `livre` : exercices, plan de comptes, journaux, écritures (chacune avec sa source :
`skanfact` pour ce qui vient d'un paquet, `saisie`, `banque`, `inventaire`, `an`), lettrages,
immobilisations, déclarations. Ce livre vit dans `cabinet-data.json` (chiffré, sauvegardé, comme
tout le reste) — ou, dès qu'un cabinet a soixante dossiers sur dix ans, dans **un fichier par
dossier** : c'est la seule décision de stockage à prendre tôt, parce qu'elle ne se reprend pas.

**Le moteur est partagé, pas recopié.** Les fonctions de `core.js` qui ne parlent que d'écritures
(grand livre, balance, lettrage, centralisateur, états, à-nouveaux, amortissements) passent dans
un module pur commun aux deux applications, `src/renderer/compta.js`, que `core.js` réexporte pour
que l'app entreprise ne change pas. Un test compare, sur le jeu d'exemple, la balance de l'app
entreprise à celle que le Cabinet calcule après avoir importé les douze paquets : **au millime**.

**Un paquet SkanFact s'importe en écritures, jamais en fichiers seulement.** Les lignes venues d'un
paquet sont marquées de leur source et de leur pièce (le PDF est joint) ; elles ne se modifient pas
dans le Cabinet (la correction se fait chez le client, qui renvoie un mois révisé — le mécanisme
`-r2` existe déjà). Le cabinet **ajoute** à côté : ses OD, sa banque, ses écritures d'inventaire.

**Le brouillard et la validation deviennent la règle.** Tout ce qui est saisi est en brouillard ;
validé, ça ne se modifie plus, ça se contre-passe. C'est l'obligation légale d'un logiciel de tenue
(irréversibilité des écritures validées) et c'est ce qu'un comptable vérifie en premier. Les écritures
d'un paquet **définitif** (mois clôturé chez le client) arrivent validées ; celles d'un paquet
provisoire arrivent en brouillard.

---

## Les dix versions, dans l'ordre

*Chaque version est utilisable seule, démontrable, et livrée avec son test e2e. Les numéros suivent
le dépôt (les deux applications partagent la version depuis la 6.6.0). « ⚠ comptable » signale ce
qui exige une réponse du comptable avant de commencer.*

### 9.1.0 — Les livres du dossier *(lire ce qui arrive)*

La fiche d'un dossier gagne un bloc **Comptabilité** : livre-journal (filtre par journal, recherche,
centralisateur), grand livre (compte par compte, solde progressif), balance (générale, auxiliaire,
six totaux, équilibre), lettrage (ce qui reste ouvert). Tout est lu dans les `ecritures.csv` des
paquets de la période. Un mois manquant ou provisoire se dit sur chaque onglet. Le module partagé
`compta.js` naît ici, et le test « même balance que l'app entreprise » avec lui. Côté entreprise, la
même version pose le module Comptabilité masqué par défaut et l'option `compta` dans la clé de
licence (décision du 15/09/2026, `DIRECTION.md` § 5.L). Le détail de chaque version — contenu,
exclusions, dépendances, preuve — est au § 13 de `QUESTIONS.md`.
*C'est la réponse directe aux deux termes du comptable : mouvement de compte, écriture au journal.*

### 9.2.0 — Le livre du dossier *(le Cabinet tient ses propres écritures)*

Le dossier gagne son `livre` : exercices, plan de comptes (le SCE complet, classes 1 à 9, à tous les
niveaux, modifiable), journaux. **Importer un paquet crée des écritures** (source `skanfact`, pièce
jointe, validées si définitif), au lieu de seulement ranger un fichier. Reprise d'un dossier existant
par **balance d'ouverture** saisie ou importée (CSV/Excel) : c'est ainsi qu'on récupère un client qui
vient d'un autre cabinet. Les livres de la 9.1.0 lisent désormais le livre, plus les CSV.
**Le paquet est signé par le client** et sa clé publique est épinglée au dossier au premier paquet
(remonté de la 9.9.0 le 15/09/2026) : le scellement ne prouve que le destinataire, pas l'expéditeur,
et le fichier d'appairage qui permet de sceller est entre les mains de tous les clients du cabinet.
Un paquet signé par une autre clé est refusé en nommant le dossier ; un paquet non signé (ancienne
version) porte la mention « origine non prouvée ». **Le test de charge du format** (cinquante mille
écritures) passe AVANT cette version, pas après : c'est elle qui fixe le format.
⚠ comptable : son plan de comptes de référence, ses codes de journaux.

### 9.3.0 — La saisie *(l'écran où un comptable passe ses journées)*

Saisie au kilomètre : un journal, une date, une pièce, des lignes compte/libellé/débit/crédit, tout au
clavier (Tab, Entrée, raccourcis pour recopier la ligne du dessus, solder l'écriture, dupliquer).
Recherche de compte par numéro ou par nom pendant la frappe. **Guides d'écritures** (modèles : loyer,
salaires, achat avec TVA…) et **abonnements** (le loyer de chaque mois, généré). Brouillard puis
**validation** ; contre-passation d'une écriture validée ; extourne au 1er du mois suivant. Pièce
jointe glissée sur l'écriture. Recherche dans tout le journal.
*Test : mille écritures saisies au clavier dans l'app réelle, sans une souris.*

### 9.4.0 — La banque *(le relevé, le rapprochement, le lettrage automatique)*

Import du relevé bancaire (CSV des banques tunisiennes, OFX, MT940 — ⚠ comptable : lesquels ses
clients reçoivent), **rapprochement automatique** (montant + date ± n jours + libellé), proposition
d'écriture pour chaque ligne non rapprochée (guide selon le libellé : « STEG » → 606), suspens, état
de rapprochement, lettrage automatique des tiers (par montant et par référence), lettrage et
délettrage à la main, échéancier et **balance âgée** clients/fournisseurs.

### 9.5.0 — Le fiscal mensuel tunisien *(la déclaration prête)*

La **déclaration mensuelle** complète depuis les écritures : TVA (collectée par taux, déductible,
crédit reporté), retenues à la source par nature, TFP, FOPROLOS, TCL, droit de timbre, avec le
récapitulatif au format de la déclaration (⚠ comptable : le modèle officiel du mois, ses cases) et
l'écriture de déclaration générée. Les **acomptes provisionnels**. Le calendrier fiscal de chaque
dossier selon son régime, avec « déclaré » et « payé » pointés par le cabinet. Préparation de la
télédéclaration : le fichier ou les chiffres à reporter, jamais l'envoi à la place du cabinet
(À VÉRIFIER : ce que le portail accepte).

### 9.6.0 — La clôture d'exercice *(l'inventaire, les états, l'à-nouveau, le RETOUR au client)*

Écritures d'inventaire guidées : dotations (déjà calculées), **provisions**, charges constatées
d'avance, factures non parvenues, produits constatés d'avance, factures à établir, régularisations,
avec leur extourne automatique à l'ouverture. Contrôles de clôture (comptes d'attente non soldés,
brouillard restant, TVA non déclarée, balance des tiers). **Clôture d'exercice définitive**
(irréversible, tracée), à-nouveaux générés, exercice suivant ouvert pendant que le précédent se
termine. États financiers **au format SCE** : bilan, état de résultat, état des flux de trésorerie,
notes (⚠ comptable : la présentation exacte, NCT 01), comparatif N/N-1, SIG, ratios.

**Et le flux RETOUR, sans lequel tout le reste diverge** (trouvé par une relecture extérieure le
15/09/2026) : les écritures d'inventaire du cabinet n'existent pas chez le client, donc à la
clôture ses à-nouveaux de l'exercice suivant seraient faux **pour toujours**, avec un écart qui
grandit chaque année. Le cabinet produit donc un fichier `.skanclose`, chiffré pour le client (qui
a désormais sa propre clé depuis la 9.2.0, voir `QUESTIONS.md` § 6) : à-nouveaux officiels, liste des
écritures d'inventaire, date de clôture. Côté entreprise, l'import les pose, verrouille l'exercice
clos et affiche ce que le comptable a ajouté. Le test qui compte est le **jumeau du test de parité,
dans l'autre sens** : après la clôture et l'import, le bilan des deux applications est identique au
millime.

### 9.7.0 — Les immobilisations et les stocks côté cabinet

Fiches d'immobilisations tenues par le cabinet (pour les clients sans SkanFact), linéaire et
**dégressif** (le moteur ne connaît que le linéaire), tableau des amortissements de l'exercice,
cessions, mises au rebut, subventions d'investissement. Inventaire de stock de fin d'exercice saisi
et sa variation en écriture. Ce que le paquet SkanFact apporte (biens et dotations du client) entre
dans les mêmes fiches sans ressaisie.

### 9.8.0 — Le cabinet à plusieurs *(collaborateurs, production, supervision)*

**Collaborateurs** avec droits par dossier (saisie, validation, supervision) — la question posée
depuis le premier audit (« qui voit quels dossiers »), qui ne se répond qu'avec un cabinet réel.
**Deux postes sur le même cabinet** sans s'écraser (A10 : la leçon de la 3.2.0, jamais portée).
**Piste d'audit** : chaque écriture validée, modifiée, contre-passée porte qui et quand. Tableau de
**production** : par dossier et par mois, reçu → saisi → révisé → déclaré, avec qui s'en occupe et
depuis combien de temps. « À faire » par collaborateur.

### 9.9.0 — La révision *(le dossier de travail)*

Dossier de révision par exercice : **feuilles maîtresses** par cycle (trésorerie, ventes-clients,
achats-fournisseurs, immobilisations, personnel, fiscal, capitaux), chaque compte revu et signé,
**points en suspens** avec réponse attendue du client, notes de revue du superviseur, questionnaire
de fin d'exercice, et les **questions au client** envoyées d'un geste depuis la ligne concernée
(l'avantage SkanFact : le client voit la question en face de sa pièce et répond depuis son
application). ⚠ comptable : sa méthode de révision, ses cycles.

### 10.0.0 — La liasse et l'annuel *(l'exercice se dépose)*

**Liasse fiscale** tunisienne (⚠ comptable : les tableaux exacts de l'année en cours), déclaration
annuelle d'IS ou d'IRPP, déclaration d'employeur, états financiers signés, **et le jeu d'exemple qui
montre tout ça rempli** au premier lancement, sur de vrais dossiers d'exemple (dont un avec un mois
manquant et un client sans SkanFact). Ce qui reste hors de l'application tant que rien ne l'exige :
la télédéclaration à la place du cabinet, la paie de cabinet (le moteur de paie existe côté
entreprise et se partagera le jour où un cabinet le demande), la facturation des honoraires (le
comptable a déjà un outil, et SkanFact entreprise sait le faire).

---

## Ce qu'il faut demander au comptable, et quand

| Avant | Question | Pourquoi c'est bloquant |
|---|---|---|
| 9.2.0 | **Son plan de comptes** (fichier) et ses codes de journaux | Le plan de référence du cabinet est la base de tout : mal posé, chaque dossier diverge |
| 9.2.0 | **Quel logiciel il utilise aujourd'hui**, et comment il en sort une balance | La reprise d'un dossier existant se fait depuis ce fichier-là |
| 9.3.0 | **Comment il saisit** (touches, ordre des champs, ce qui l'agace dans son logiciel actuel) | Un écran de saisie se juge en dix minutes ; le construire sans le regarder faire, c'est le rater |
| 9.4.0 | **Les relevés** que ses clients reçoivent (banques, formats) | Un importeur par format : on ne devine pas un format |
| 9.5.0 | **Le modèle de la déclaration mensuelle** et ses cases, les taux de TCL/timbre en vigueur, ses réponses aux « À VÉRIFIER » de 8.9.0/9.0.0 (TVA au dernier jour, 13 vs 12, contreparties, TFP 1 %/2 %) | L'application ne doit rien affirmer qu'il n'a pas validé |
| 9.6.0 | **La présentation des états financiers** (NCT 01) et des notes | « Déduits de la balance » ne suffit plus si le Cabinet produit les états officiels |
| 9.9.0 | **Sa méthode de révision** (cycles, feuilles, ce que le superviseur regarde) | Un dossier de travail imposé par un logiciel ne sert à personne |
| 10.0.0 | **La liasse** de l'année et ce que le portail accepte | Change chaque loi de finances |

Et une question à poser tout de suite, avant la 9.1.0 : **quel logiciel il veut remplacer, et par
quoi il jugera que SkanFact Cabinet le remplace.** Trois écrans, pas dix : ce qu'il ouvre le matin,
ce qu'il fait le plus souvent, ce qu'il rend au client.

---

## Ce qu'on garde, ce qu'on ne fait pas

- **On garde le paquet et l'appairage** : ce sont eux qui font que les écritures arrivent avec leurs
  pièces, vérifiées, sans ressaisie — l'avantage qu'aucun concurrent n'a. Le Cabinet lit les paquets,
  et n'écrit jamais chez le client.
- **On garde le hors-ligne** : un cabinet doit pouvoir travailler sans réseau, et survivre à
  l'éditeur. Pas de serveur pour tenir les livres ; le serveur (7.0.0 du plan Cabinet) ne fera jamais
  que transporter.
- **On ne fait pas** la télédéclaration à la place du cabinet, la paie de cabinet avant qu'un
  cabinet la demande, la facturation des honoraires, la gestion du temps, la GED de cabinet. Chacun
  est un produit à part, et chacun ferait de SkanFact Cabinet un second logiciel de quelque chose.
- **On ne promet rien qu'un test ne prouve.** Chaque version porte un e2e dans l'application réelle,
  et la balance calculée par le Cabinet est comparée à celle de l'app entreprise à chaque version.

---

## Le calendrier, en ordre de grandeur

| Version | Ce qu'elle apporte | Dépend du comptable | Ordre de grandeur |
|---|---|---|---|
| 9.1.0 | Les livres lus dans les paquets | non | jours |
| 9.2.0 | Le livre du dossier, plan complet, reprise d'ouverture | plan, logiciel actuel | une à deux semaines |
| 9.3.0 | La saisie, brouillard/validation, guides, abonnements | le regarder saisir | deux semaines |
| 9.4.0 | Banque, rapprochement, lettrage automatique, balance âgée | formats de relevés | deux semaines |
| 9.5.0 | Déclaration mensuelle, acomptes, calendrier pointé | modèle de déclaration | une à deux semaines |
| 9.6.0 | Inventaire, clôture d'exercice, états SCE, N/N-1, SIG | présentation NCT 01 | deux à trois semaines |
| 9.7.0 | Immobilisations (dégressif), stocks | non | une semaine |
| 9.8.0 | Collaborateurs, multi-poste, piste d'audit, production | non | deux semaines |
| 9.9.0 | Révision, points en suspens, questions au client | méthode de révision | deux semaines |
| 10.0.0 | Liasse, annuel, jeu d'exemple complet | liasse de l'année | deux semaines |

Les durées sont celles du travail de construction et de test ; elles ne comptent ni l'attente des
réponses, ni les allers-retours avec le comptable, qui sont la vraie horloge. **La 9.1.0 peut partir
maintenant** : elle n'attend personne, et c'est elle qu'il faut lui montrer pour obtenir les
réponses aux questions suivantes.
