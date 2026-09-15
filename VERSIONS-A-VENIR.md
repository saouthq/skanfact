# VERSIONS-A-VENIR.md — tout ce qui reste à faire, de la 9.1.0 à la 10.0.0

**Ce que c'est** : la liste complète des fonctionnalités à venir, version par version, pour voir d'un
coup d'œil ce qui reste — écrite le 15/09/2026 en lisant `CAHIER-DES-CHARGES.md` (v1.1),
`PLAN-DEVELOPPEMENT.md`, `QUESTIONS.md` § 16 et `PLAN-COMPTABLE.md`, au commit `137daad`.
**Ce que ce n'est pas** : ni une spécification (les schémas, les signatures et les formats sont dans
`CAHIER-DES-CHARGES.md`), ni un calendrier (les jalons, le chemin critique et les 26 semaines sont
dans `PLAN-DEVELOPPEMENT.md`), ni un engagement de date — c'est un inventaire.
**Convention d'identifiants** : chaque ligne porte `F-<version>-<nn>` (par exemple `F-9.2.0-19`),
citable dans un commit, une conversation ou une revue ; la colonne « Spec » renvoie à l'identifiant
`SPEC-*` / `MIG-*` qui la décrit quand il existe.

En cas de contradiction, `DIRECTION.md` fait foi, puis `CAHIER-DES-CHARGES.md`, puis ce document.

---

## Tableau récapitulatif

| Version | Titre | Nb fonctionnalités | Niveau spec | Durée |
|---|---|---|---|---|
| **9.1.0** | Outillage, livres lus, option Comptabilité | 25 | Complète | 8 j · 16 j |
| **9.1.1** | Les corrections fiscales | 7 | Complète | 2 j · 4 j |
| **9.2.0** | Le livre du dossier, et le paquet signé | 26 | Complète | 8 j · 20 j |
| **9.3.0** | La saisie | 14 | Cadrée | 10 j · 20 j |
| **9.3.5** | La licence du Cabinet | 12 | Cadrée | 5 j · 10 j |
| **9.3.6** | Entretien | 7 | Cadrée | 3 j · 6 j |
| **9.4.0** | La banque | 12 | Cadrée | 10 j · 20 j |
| **9.5.0** | La déclaration mensuelle | 14 | Cadrée | 8 j · 20 j |
| *9.5.1* | *Entretien (hors des 13 demandées)* | *4* | *Cadrée* | *3 j · 6 j* |
| **9.6.0** | La clôture d'exercice | 15 | Cadrée | 13 j · 30 j |
| **9.7.0** | Immobilisations et stocks | 10 | Cadrée | 5 j · 10 j |
| **9.8.0** | Le cabinet à plusieurs | 8 | Cadrée | 10 j · 20 j |
| *9.8.1* | *Entretien (hors des 13 demandées)* | *4* | *Cadrée* | *3 j · 6 j* |
| **9.9.0** | La révision et les questions | 10 | Cadrée | 10 j · 20 j |
| **10.0.0** | La liasse et l'annuel | 11 | Esquisse | 10 j · 20 j |

**Total : 171 fonctionnalités à venir** sur les treize versions demandées, **179** avec les deux
versions d'entretien que la liste n'inclut pas.

**Les trois niveaux de spec.** *Complète* = écrite dans `CAHIER-DES-CHARGES.md` avec ses schémas,
ses écrans, ses tests et ses migrations : exécutable sans question. *Cadrée* = la Partie 15 du
cahier lui donne un écran réservé (`SPEC-UI-CAB-0nn`) avec son tableau « Décidé / À décider » : on
sait ce qui ne se rediscute pas et qui tranche le reste. *Esquisse* = l'intention et la dépendance
sont connues, presque tout le contenu attend un document réel du comptable.

**Les deux durées** : construction · réaliste. La seconde est le double de la première, et c'est
`QUESTIONS.md` § 16 qui le dit — elle absorbe les retours du pilote, les correctifs, les relances
d'e2e et le temps de relecture. Mises bout à bout : **≈ 104 jours de construction, ≈ 228 jours
réalistes**, soit onze mois de travail effectif étalés sur dix-huit à vingt-et-un mois d'attentes.
C'est cohérent avec J4 au 30/06/2028.

**Une remarque sur deux numéros.** `9.3.5` et `9.3.6` sont tes numéros ; les autres documents
appellent ces versions `9.3.x` / `P 0.3` (licence du Cabinet) et `9.3.1` (entretien). Un numéro qui
ne bouge que le troisième chiffre est réservé aux correctifs par la règle du projet
(`CLAUDE.md`, « Chaque amélioration livrée = une nouvelle version ») : la licence du Cabinet ajoute
des fonctionnalités, donc elle devrait être `9.4.0`, et tout ce qui suit décalerait d'un cran. Je
garde tes numéros dans ce document et je le signale une fois ; c'est ta décision, elle ne change
rien au contenu.

**Ce que la liste ne contient pas, volontairement** : les tâches qui ne sont pas du code et qui
bloquent la vente (marque, certificats, INPDP, conditions de vente, lettre à l'Ordre, page unique,
pli scellé) — elles sont l'**Étape 0** de `QUESTIONS.md` § 16 et la **Phase 0** de
`PLAN-DEVELOPPEMENT.md`, elles ne portent aucun numéro de version et elles passent avant tout.

---

## 9.1.0 — Outillage, livres lus, option Comptabilité

> *Que le pilote voie enfin une comptabilité dans le Cabinet, et que le projet ait l'outillage d'un
> logiciel vendu.*

| | |
|---|---|
| **Durée** | construction 8 j (outillage 4, livres 3, `compta.js` 1) · réaliste 16 j |
| **Dépend de** | rien — « n'attend personne », c'est la seule version dans ce cas |
| **Niveau de spec** | Complète : `CAHIER-DES-CHARGES.md` § 3.3, § 4.1, § 4.2, § 5.4, Partie 9, § 11.2, Partie 12 |
| **Jalon** | le test de charge décide du format de la 9.2.0 ; **J0** doit être atteint avant d'entrer en 9.2.0 |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.1.0-01 | Canal `cabinet-beta` : le Cabinet reçoit des versions d'essai, case dans Réglages, sauvegarde `avant-beta` avant d'armer | Outillage | SPEC-OUT-001 |
| F-9.1.0-02 | Intégration continue GitHub : `npm test` + lint à chaque push, sur Linux **et** Windows, `main` protégée | Outillage | SPEC-OUT-002 |
| F-9.1.0-03 | Lint ESLint (règles plates) : `no-var`, `eqeqeq`, `new Date(y,m,d)` et `getDay()` interdits | Outillage | SPEC-OUT-003 |
| F-9.1.0-04 | Garde-fou d'erreur global dans les deux interfaces : `error` et `unhandledrejection` écrits au journal, jamais de fenêtre | Outillage | SPEC-OUT-004 |
| F-9.1.0-05 | Journal borné : `main.log` tourne à 2 Mo, une seule fois ; un renderer en boucle ne remplit pas le disque | Outillage | SPEC-OUT-004 |
| F-9.1.0-06 | Workflow « Construire un essai » : les deux applications installables à côté des vraies, sans mise à jour | Outillage | SPEC-OUT-005 |
| F-9.1.0-07 | Test de charge : 50 000 écritures, quatre seuils mesurés (ouverture < 1 s, écriture < 100 ms, balance de 60 dossiers < 5 s, recherche < 3 s) | Outillage | SPEC-OUT-006 |
| F-9.1.0-08 | Index thématique de `CLAUDE.md` | Outillage | — |
| F-9.1.0-09 | `src/renderer/compta.js` extrait de `core.js` : huit fonctions pures partagées par les deux applications, appelants inchangés | Partagé | SPEC-FUNC-100 |
| F-9.1.0-10 | Fiche d'un dossier : bloc « Comptabilité » avec sélecteur de période (un mois, l'exercice, du… au…) | Cabinet | SPEC-UI-CAB-001 |
| F-9.1.0-11 | Onglet **Livre-journal** : filtre par journal, recherche, centralisateur dépliable, totaux de la sélection entière | Cabinet | SPEC-UI-CAB-001 |
| F-9.1.0-12 | Onglet **Grand livre** : un compte choisi par numéro ou nom, solde progressif qui finit sur le total | Cabinet | SPEC-UI-CAB-001 |
| F-9.1.0-13 | Onglet **Balance** : générale et auxiliaire, six totaux, « équilibrée » ou l'écart en rouge | Cabinet | SPEC-UI-CAB-001 |
| F-9.1.0-14 | Onglet **Lettrage** : ce qui reste ouvert par tiers, et le contrôle « reste ouvert = solde du compte » | Cabinet | SPEC-UI-CAB-001 |
| F-9.1.0-15 | Les manques se disent : mois absents nommés en tête, paquet d'avant la 8.8.0 signalé, paquet illisible en orange sans arrêter les autres | Cabinet | SPEC-UI-CAB-001, ERR-CAB-010 |
| F-9.1.0-16 | Export CSV **nommé par l'onglet**, et menu de ligne « Ouvrir la pièce dans le paquet » | Cabinet | SPEC-UI-CAB-001 |
| F-9.1.0-17 | Canal `cab:livres` : lecture des écritures dans les paquets d'une période, cache par session | Cabinet | § 5.4, § 5.5 |
| F-9.1.0-18 | **La clé de secours réclamée au premier import**, comme une étape et non comme un rappel | Cabinet | SPEC-UI-CAB-002, MIG-9.1.0-002 |
| F-9.1.0-19 | Sous-module `compta.livres` : grand livre, balance et états financiers **masqués par défaut** | Entreprise | SPEC-FUNC-101 |
| F-9.1.0-20 | `optionBlock` : la porte unique, posée au changement d'onglet et nulle part ailleurs | Entreprise | SPEC-UI-ENT-002 |
| F-9.1.0-21 | Option `compta` portée par la clé de licence ; l'essai l'inclut ; l'éditeur et le mode libre aussi | Entreprise | SPEC-FUNC-101 |
| F-9.1.0-22 | Paramètres → Modules : la sous-case « Grand livre, balance, états financiers », avec le droit à l'erreur | Entreprise | SPEC-UI-ENT-001 |
| F-9.1.0-23 | Paramètres → Licence : la ligne « Options » ; le module Éditeur vend l'option (prix jamais dans le code) | Entreprise | SPEC-UI-ENT-003 |
| F-9.1.0-24 | La console sait vendre l'option Comptabilité | Plateforme | SPEC-UI-ENT-003 |
| F-9.1.0-25 | Garde-fou de double-clic sur « Émettre » : `data-busy` + `isIssued`, un seul numéro consommé | Entreprise | Partie 13, TEST-9.1.0-025 |

**Ce qui n'y est pas** : aucune saisie, aucun livre propre au dossier, aucune modification des
paquets. Le Cabinet **lit**, il n'écrit pas encore.

**Ce qui la prouve** : 25 tests (TEST-9.1.0-001 → 025), dont le **test de parité** — la balance du
Cabinet égale celle de l'entreprise au millime sur les 24 mois de l'exemple — et un e2e neuf,
`cabinet-livres`. Critère humain : le pilote a ouvert les quatre onglets sur **un de ses** paquets
et a dit par écrit ce qui manque.

**Ce qui reste à décider** : le prix de l'option Comptabilité (à toi) ; et si le test de charge
échoue, le format de la 9.2.0 change **avant** d'être écrit — c'est tout l'intérêt de le passer ici.

---

## 9.1.1 — Les corrections fiscales

> *Quatre chiffres qui partent chez un tiers, et qui traînaient sans version — la meilleure façon de
> ne jamais les faire.*

| | |
|---|---|
| **Durée** | construction 2 j · réaliste 4 j |
| **Dépend de** | **une seule chose** : la séance de validation fiscale avec le comptable, qui tranche les quatre en une fois |
| **Niveau de spec** | Complète : SPEC-FUNC-102, SPEC-UI-ENT-004 → 006, § 11.3, MIG-9.1.1-001 |
| **Jalon** | aucun ; version volontairement minuscule, publiée seule |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.1.1-01 | Case « Exonéré de timbre fiscal » sur la fiche client, avec sa bulle et son « À VÉRIFIER » | Entreprise | SPEC-UI-ENT-004 |
| F-9.1.1-02 | L'exonération est **copiée à la création** du document, jamais relue à l'affichage : une pièce émise ne bouge plus | Entreprise | SPEC-FUNC-102 |
| F-9.1.1-03 | Seuil de retenue à la source réglable, **par défaut 0** — aucun seuil tant que le comptable n'a pas donné le chiffre | Entreprise | SPEC-UI-ENT-005 |
| F-9.1.1-04 | Avertissement à l'émission quand une facture est sous le seuil et porte quand même une retenue — **avertit, ne bloque pas** | Entreprise | SPEC-FUNC-102 |
| F-9.1.1-05 | TFP **proposée** par métier, jamais écrite sans le comptable, jamais écrasée une fois le champ touché | Entreprise | SPEC-UI-ENT-006 |
| F-9.1.1-06 | Contrôle e-facture : `docs/e-facture-controle.md`, chaque champ qu'un format officiel exigerait, oui ou non | Partagé | TEST-9.1.1-009 |
| F-9.1.1-07 | **Parade à l'injection de formule CSV** dans les deux applications : une cellule texte qui commence par `=` `+` `-` `@` est préfixée d'une apostrophe ; une colonne montant ou date n'est jamais touchée | Partagé | TEST-9.1.1-010 |

**Ce qui n'y est pas** : tout le reste. Cette version ne contient rien d'autre, exprès.

**Ce qui la prouve** : un test par règle, chacun prouvé en réintroduisant le défaut. Celui du seuil
s'écrit sur un taux **négatif**, parce que `Number('') === 0` rend l'assertion évidente inutile
(leçon de la 8.3.0).

**Ce qui reste à décider** : les quatre chiffres eux-mêmes — seuil de retenue, exonérations de
timbre, métiers qui portent une TFP, périmètre e-facture. Tous *comptable*, tous en une séance.

---

## 9.2.0 — Le livre du dossier, et le paquet signé

> *Chaque dossier a son livre, un paquet importé crée des écritures, un dossier venu d'ailleurs se
> reprend par balance — et le paquet est enfin signé par le client.*

| | |
|---|---|
| **Durée** | construction 5 à 10 j · réaliste 20 j |
| **Dépend de** | le test de charge réussi (ou le modèle changé) ; **le plan de comptes du comptable** et le format de balance de son logiciel actuel ; **J0** atteint ; l'engagement écrit du pilote |
| **Niveau de spec** | Complète : SPEC-DATA-005 (la plus importante du cahier), SPEC-DATA-004b, SPEC-FMT-005/008/009, SPEC-UI-CAB-003 → 006, SPEC-FUNC-103, § 11.4, MIG-9.2.0-001 → 004 |
| **Jalon** | **J1** (31/12/2026) : trois licences, le pilote par écrit |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.2.0-01 | `livre.json` : un fichier par dossier **et par exercice**, chiffré comme le reste, écriture atomique, plus un index léger | Cabinet | SPEC-DATA-005 |
| F-9.2.0-02 | Exercices : création, plusieurs ouverts en même temps, exercice décalé permis | Cabinet | SPEC-DATA-005 |
| F-9.2.0-03 | Plan de comptes **SCE complet** à tous les niveaux, modifiable, initialisé depuis le plan de référence du cabinet | Cabinet | SPEC-DATA-005 |
| F-9.2.0-04 | Import d'un plan de comptes par CSV, colonnes par nom, ligne invalide nommée | Cabinet | SPEC-FMT-008 |
| F-9.2.0-05 | Journaux du dossier (code, libellé, type, compte de trésorerie) | Cabinet | SPEC-DATA-005 |
| F-9.2.0-06 | **Importer un paquet crée des écritures** : validées si le mois est définitif, brouillard sinon, avec la pièce jointe | Cabinet | SPEC-FUNC-103, SPEC-UI-CAB-004 |
| F-9.2.0-07 | Les paquets **déjà reçus** sont relus une fois, par ordre chronologique, sans rien doubler si on rejoue | Cabinet | MIG-9.2.0-001 |
| F-9.2.0-08 | Mois renvoyé : les brouillards sont remplacés, **les validées ne sont jamais touchées** et l'écart s'affiche avant/après | Cabinet | SPEC-UI-CAB-004 |
| F-9.2.0-09 | Reprise d'un dossier existant par **balance d'ouverture** saisie ou importée, à une date de reprise, refusée si déséquilibrée | Cabinet | SPEC-UI-CAB-003, SPEC-FMT-009 |
| F-9.2.0-10 | Les quatre onglets de la 9.1.0 lisent désormais **le livre** ; un brouillard se distingue à l'œil | Cabinet | SPEC-UI-CAB-005 |
| F-9.2.0-11 | Validation d'une écriture : numéro attribué **à la validation**, continu, sans trou, irréversible | Cabinet | SPEC-DATA-005, SPEC-FUNC-103 |
| F-9.2.0-12 | Contre-passation : le miroir, jamais une modification ni une suppression | Cabinet | SPEC-FUNC-103 |
| F-9.2.0-13 | Lettrage et délettrage enregistrés dans le livre, somme nulle exigée | Cabinet | SPEC-FUNC-103 |
| F-9.2.0-14 | Les pièces **absentes** annoncées par le manifeste s'affichent à côté des écritures | Cabinet | SPEC-FMT-001 |
| F-9.2.0-15 | Sauvegardes, copie externe, clé de secours et changement d'ordinateur **emportent les livres** | Cabinet | MIG-9.2.0-001, TEST-9.2.0-018 |
| F-9.2.0-16 | Verrou `livre-<AAAA>.lock` : un livre ouvert ailleurs ne s'écrase pas | Cabinet | § 5.2, ERR-CAB-022 |
| F-9.2.0-17 | `cab:livre` / `cab:livreEcrire` : **une seule porte d'écriture**, atomique, qui écrit l'`audit` à chaque geste — et l'`audit` n'est jamais purgé | Cabinet | § 5.4, SPEC-DATA-005 |
| F-9.2.0-18 | `compta.js` gagne le livre : créer, valider, contre-passer, importer, lettrer, ouvrir — tout pur et testable sans Electron | Partagé | SPEC-FUNC-103 |
| F-9.2.0-19 | **Le client signe le manifeste** de son paquet avec sa clé privée (`signature.json`), créée à l'appairage | Entreprise | SPEC-FMT-005, MIG-9.2.0-003 |
| F-9.2.0-20 | Le cabinet **épingle** la clé publique du client au dossier, au premier paquet signé | Cabinet | § 5.3, SPEC-DATA-004b |
| F-9.2.0-21 | Un paquet signé par une **autre clé** est refusé en nommant le dossier et les deux empreintes | Cabinet | ERR-CAB-030 |
| F-9.2.0-22 | « Ce client a changé de clé — accepter la nouvelle » : l'empreinte dictée au téléphone, jamais automatique | Cabinet | ERR-CAB-030, SCN-003 |
| F-9.2.0-23 | Un paquet **non signé** est accepté avec « origine non prouvée » — mais refusé dès que le dossier a déjà reçu un paquet signé | Cabinet | ERR-CAB-031 |
| F-9.2.0-24 | Un manifeste modifié après l'envoi donne **la bonne phrase**, pas « signature inconnue » | Cabinet | ERR-CAB-032, § 5.3 |
| F-9.2.0-25 | Le manifeste passe au **format 2** : il porte la licence du client et la mention d'essai | Entreprise | SPEC-FMT-001, MIG-9.2.0-004 |
| F-9.2.0-26 | L'application dit si le Cabinet du destinataire est **trop ancien** pour lire le nouveau format | Entreprise | ERR-CAB-004 |

**Ce qui n'y est pas** : la saisie à la main (sauf la balance d'ouverture) et la banque.

**Ce qui la prouve** : 23 tests (TEST-9.2.0-001 → 023), la parité maintenue, `e2e:perte` et
`e2e:demenagement` rejoués avec des livres, le test de charge rejoué **sur le format réellement
écrit**, et deux cas d'imposture dans `e2e:refus`. Critère humain : le pilote a repris **un de ses
dossiers réels** par balance d'ouverture et retrouve sa balance au millime.

**Ce qui reste à décider** : le plan de comptes du pilote (*comptable*) et le format d'export de son
logiciel actuel. Si rien n'arrive, on démarre sur le SCE de référence et on l'écrase — le plan est
modifiable, c'est fait pour.

---

## 9.3.0 — La saisie

> *L'écran où un comptable passe ses journées : saisie au kilomètre dans un brouillard, puis
> validation — et une écriture validée ne se modifie plus.*

| | |
|---|---|
| **Durée** | construction 10 j · réaliste 20 j |
| **Dépend de** | **J1** atteint, et le pilote **regardé en train de saisir** dans son logiciel actuel — une heure chez lui, c'est la dépendance qui décide de l'écran |
| **Niveau de spec** | Cadrée : `CAHIER-DES-CHARGES.md` Partie 15, SPEC-UI-CAB-010 → 013 |
| **Jalon** | le pilote continue-t-il dans le Cabinet ? Si non, on n'écrit pas la 9.4.0 avant de savoir pourquoi |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.3.0-01 | Grille de saisie au kilomètre, **tout au clavier** : journal, date, pièce, puis les lignes | Cabinet | SPEC-UI-CAB-010 |
| F-9.3.0-02 | Recherche de compte **par numéro ou par nom pendant la frappe**, sur le plan du dossier | Cabinet | SPEC-UI-CAB-010 |
| F-9.3.0-03 | Tab sur la dernière ligne **solde automatiquement** ; Entrée = ligne suivante ; valider enchaîne sur la pièce suivante | Cabinet | SPEC-UI-CAB-010 |
| F-9.3.0-04 | Raccourcis : recopier la ligne du dessus, dupliquer une pièce | Cabinet | SPEC-UI-CAB-010 |
| F-9.3.0-05 | Contrôle d'équilibre **en direct** : une écriture déséquilibrée n'entre pas, et le motif est nommé | Cabinet | SPEC-UI-CAB-010 |
| F-9.3.0-06 | Pièce jointe glissée sur l'écriture, rangée avec le dossier | Cabinet | SPEC-UI-CAB-010 |
| F-9.3.0-07 | **Brouillard puis validation** : le numéro est pris à la validation, jamais avant | Cabinet | SPEC-UI-CAB-011 |
| F-9.3.0-08 | Une validée n'a ni « Modifier » ni « Supprimer » — seulement contre-passer | Cabinet | SPEC-UI-CAB-011 |
| F-9.3.0-09 | **Extourne** au 1er du mois suivant, d'un geste | Cabinet | SPEC-UI-CAB-011 |
| F-9.3.0-10 | **Guides d'écritures** : un journal, des comptes, une contrepartie — ils préremplissent, ils n'écrivent pas | Cabinet | SPEC-UI-CAB-012 |
| F-9.3.0-11 | **Abonnements** : le loyer de chaque mois, généré **en brouillard**, jamais validé d'office | Cabinet | SPEC-UI-CAB-012 |
| F-9.3.0-12 | Recherche dans tout le journal de l'exercice : pièce, tiers, libellé, montant | Cabinet | SPEC-UI-CAB-013 |
| F-9.3.0-13 | **Table de correspondance des comptes** (compte SkanFact → compte du cabinet), appliquée à l'import et à l'export, jamais en réécrivant une validée | Cabinet | SPEC-UI-CAB-013 |
| F-9.3.0-14 | Piste d'audit à l'écran : qui, quand, quoi, sur chaque validation et chaque contre-passation | Cabinet | SPEC-DATA-005 |

**Ce qui n'y est pas** : les collaborateurs (un seul auteur, le poste) et la banque.

**Ce qui la prouve** : e2e — mille écritures saisies au clavier **sans souris** ; une validée refusée
à la modification ; une contre-passation ; l'extourne ; un test de source « aucune écriture validée
ne se modifie ailleurs que par contre-passation ». Critère humain : le pilote a saisi **une journée
réelle** dans le Cabinet et n'a pas rouvert son ancien logiciel pour la finir.

**Ce qui reste à décider** : les touches exactes (*mesure* — reprendre les siennes) ; grille contre
pièce (*mesure*) ; le journal proposé à l'ouverture (*toi*) ; la validation pièce par pièce ou par
journal et par mois (*comptable*) ; la date d'une contre-passation (*comptable*) ; le jeu de guides
livré (*comptable*) ; guides par cabinet ou par dossier (*toi* — je propose par cabinet avec
surcharge par dossier).

**La question qui bloque** : « Quel est ton journal de banque : un par compte, ou un seul ? »

---

## 9.3.5 — La licence du Cabinet

> *Le Cabinet devient payant au-delà de trois dossiers hors SkanFact — on vend des dossiers, jamais
> des postes.*

| | |
|---|---|
| **Durée** | construction 5 j · réaliste 10 j |
| **Dépend de** | la question à l'Ordre **posée** (pas répondue : on construit, on ne vend pas) ; les prix |
| **Niveau de spec** | Cadrée : Partie 15, SPEC-UI-CAB-015, SPEC-UI-CON-007 ; `DIRECTION.md` § 5.A et 5.B |
| **Jalon** | aucun ; touche à l'argent, donc **relecture adversariale complète obligatoire** |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.3.5-01 | Clé de licence de type `cabinet` : sujet = l'**empreinte** du cabinet, quota `dossiersHors` | Plateforme | SPEC-UI-CAB-015 |
| F-9.3.5-02 | `licence.js` et les clés publiques entrent dans la construction du Cabinet ; vérification **hors ligne** | Cabinet | SPEC-UI-CAB-015 |
| F-9.3.5-03 | Comptage des dossiers hors SkanFact, les **trois premiers gratuits** | Cabinet | `DIRECTION.md` § 5 |
| F-9.3.5-04 | Un dossier archivé, ou sans écriture validée depuis douze mois, **ne compte pas** | Cabinet | `QUESTIONS.md` § 3 |
| F-9.3.5-05 | **Grâce de douze mois** quand un client ne renouvelle pas — mais seulement après une licence **payée** | Cabinet | `QUESTIONS.md` § 3, règle 44 |
| F-9.3.5-06 | La porte unique posée sur la **validation** : lire, importer, exporter et relancer restent libres | Cabinet | SPEC-UI-CAB-015 |
| F-9.3.5-07 | Réglages → Licence : coller la clé, l'état, **ce qui est compté**, la liste nommée des dossiers comptés | Cabinet | SPEC-UI-CAB-015 |
| F-9.3.5-08 | Bandeau à trois tons, ligne « À faire », « Demander une licence » — les mêmes mécanismes que l'entreprise, pas des copies | Cabinet | SPEC-UI-CAB-015 |
| F-9.3.5-09 | Ce qui remonte au serveur : l'empreinte, le nombre de dossiers comptés, la version. **Jamais un nom de client** | Cabinet | § 17, test « ce qui remonte » |
| F-9.3.5-10 | Table `cabinets` et lien cabinet ↔ clients parrainés | Plateforme | SPEC-UI-CON-007 |
| F-9.3.5-11 | Console : émettre, marquer payée, renouveler, **monter le quota au prorata**, révoquer une licence Cabinet | Plateforme | SPEC-UI-CON-007 |
| F-9.3.5-12 | Le module Éditeur tire et facture une vente de type cabinet comme les autres | Entreprise | SPEC-UI-CON-007 |

**Ce qui n'y est pas** : la vente elle-même — l'Ordre n'a pas répondu, et publier le prix Cabinet
attend sa réponse. Le code, lui, n'attend pas.

**Ce qui la prouve** : `e2e:cabinet-licence`, jumeau de `e2e:licence` — quota atteint, validation
refusée, lecture ouverte, dossier archivé qui ne compte plus, licence client dans un paquet qui rend
le dossier gratuit, paquet ancien qui le dit. Et **le doute profite au cabinet** : une licence
illisible est valide.

**Ce qui reste à décider** : le prix par dossier et les paliers (*toi*) ; le délai avant qu'un
dossier désarchivé recompte (*toi*) ; la vue « les dossiers de ce cabinet », déduite ou déclarée
(*toi*).

---

## 9.3.6 — Entretien

> *Aucune fonction nouvelle, par règle. C'est la version où l'on rembourse.*

| | |
|---|---|
| **Durée** | construction 3 j · réaliste 6 j |
| **Dépend de** | rien ; elle suit la bêta de la 9.3.0 |
| **Niveau de spec** | Cadrée : Partie 15 ; `QUESTIONS.md` § 15 pour la liste de dette |
| **Jalon** | aucun |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.3.6-01 | Mise à jour d'Electron du semestre | Partagé | — |
| F-9.3.6-02 | Les **93 déclarations CSS physiques** converties en propriétés logiques — ce qui garde la porte de l'arabe ouverte sans rien promettre | Partagé | `QUESTIONS.md` § 3 |
| F-9.3.6-03 | Premier découpage de `app.js` par route | Entreprise | `QUESTIONS.md` § 15 |
| F-9.3.6-04 | `test/run-tests.js` découpé par domaine | Partagé | Partie 15 |
| F-9.3.6-05 | Les codes `ERR-*` posés sur chaque `throw` | Partagé | Partie 10 |
| F-9.3.6-06 | La dette listée au § 15 de `QUESTIONS.md` qui n'a pas encore été remboursée | Partagé | — |
| F-9.3.6-07 | Les retours de la bêta 9.3.0 **qui ne sont pas des nouveautés** | Partagé | — |

**Ce qui n'y est pas** : toute fonction nouvelle. Si une idée arrive pendant, elle va à la 9.4.0.

**Ce qui la prouve** : **tous** les e2e relancés, sans exception — c'est la seule version où on les
relance tous, parce que c'est celle où le moteur de rendu change.

---

## 9.4.0 — La banque

> *Le relevé importé, rapproché automatiquement quand c'est certain, proposé quand ça ne l'est
> pas — et jamais validé tout seul sur une ambiguïté.*

| | |
|---|---|
| **Durée** | construction 10 j · réaliste 20 j |
| **Dépend de** | **les formats de relevés** des banques des clients du pilote — un fichier réel de chaque, anonymisé ; la 9.3.0 utilisée |
| **Niveau de spec** | Cadrée : Partie 15, SPEC-UI-CAB-020 → 022 ; `releves[]` **figé** dans SPEC-DATA-005 |
| **Jalon** | **J2** (30/06/2027) : dix licences, le pilote qui ne revient pas en arrière |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.4.0-01 | Lecteurs de relevés CSV des banques tunisiennes, colonnes associées **par nom, jamais par position** | Cabinet | SPEC-UI-CAB-020 |
| F-9.4.0-02 | OFX et MT940, **seulement** si une banque des clients les exporte vraiment | Cabinet | SPEC-UI-CAB-020 |
| F-9.4.0-03 | Assistant « CSV inconnu » : associer colonne → champ une fois, mémorisé par banque | Cabinet | SPEC-UI-CAB-020 |
| F-9.4.0-04 | `releves[]` : un objet par fichier importé, les lignes dedans — le comptable pense « le relevé de mars » | Cabinet | SPEC-DATA-005 |
| F-9.4.0-05 | Refus si `soldeDebut + Σ montants ≠ soldeFin`, avec l'écart nommé | Cabinet | ERR-CAB-040 |
| F-9.4.0-06 | Empreinte du fichier : on n'importe jamais deux fois le même relevé | Cabinet | SPEC-DATA-005 |
| F-9.4.0-07 | **Rapprochement automatique à quatre niveaux** : certain, probable, à confirmer, aucun — seul « certain » se pose d'office, et il reste défaisable | Cabinet | SPEC-UI-CAB-021 |
| F-9.4.0-08 | Une ambiguïté montre **tous** les candidats et n'est jamais « certain » | Cabinet | SPEC-UI-CAB-021, règle 32 |
| F-9.4.0-09 | Écriture **proposée** depuis une ligne non rapprochée, selon le libellé — jamais créée sans clic | Cabinet | SPEC-UI-CAB-021 |
| F-9.4.0-10 | État de rapprochement et suspens ; `etatRapprochement` (9.0.0) reste la source du solde | Cabinet | SPEC-UI-CAB-021 |
| F-9.4.0-11 | **Lettrage automatique** des tiers par montant et référence, délettrage à la main | Cabinet | SPEC-UI-CAB-022 |
| F-9.4.0-12 | Échéancier et **balance âgée** clients et fournisseurs, sur les tranches de 2.5.0 | Cabinet | SPEC-UI-CAB-022 |

**Ce qui n'y est pas** : la confusion entre rapprochement et lettrage. Le rapprochement confronte le
relevé au compte 532 (« la banque et mon livre disent-ils la même chose ? ») ; le lettrage rapproche
une facture et son règlement sur le compte d'un tiers (« ce client me doit-il encore quelque
chose ? »). **Deux écrans, deux modèles, deux tests.**

**Ce qui la prouve** : un relevé réel de trois mois rapproché à **≥ 90 % en « certain »** sur le
dossier du pilote, le reste proposé et jamais validé seul ; un test unitaire par format, sur un
fichier réel anonymisé ; un test « un rapprochement ambigu reste ouvert ».

**Ce qui reste à décider** : le « ± n jours » et sa valeur par défaut (*comptable*) ; la table
libellé → compte (*comptable*) ; les lignes non rapprochées en fin de mois, compte 471 ou liste de
suspens (*comptable*) ; le lettrage partiel (*comptable*) ; les tranches d'âge (*comptable*).

**La question qui bloque** : « Quelles banques, et quel format d'export chacune donne-t-elle ? »

---

## 9.5.0 — La déclaration mensuelle

> *La déclaration tunisienne du mois produite depuis la balance, avec les chiffres que le comptable
> recopie sur le portail — et rien de plus.*

| | |
|---|---|
| **Durée** | construction 5 à 10 j · réaliste 20 j |
| **Dépend de** | **le modèle de déclaration** que le pilote dépose réellement, un exemplaire rempli |
| **Niveau de spec** | Cadrée : Partie 15, SPEC-UI-CAB-030 et 031 ; `declarations[]` **figé** dans SPEC-DATA-005 |
| **Jalon** | le pilote dépose-t-il depuis le Cabinet ? |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.5.0-01 | Une déclaration par dossier et par période, déduite des écritures | Cabinet | SPEC-UI-CAB-030 |
| F-9.5.0-02 | TVA collectée **par taux**, déductible, crédit reporté — `vatChain` reste le moteur | Cabinet | SPEC-UI-CAB-030 |
| F-9.5.0-03 | Retenues à la source **par nature** | Cabinet | SPEC-UI-CAB-030 |
| F-9.5.0-04 | TFP et FOPROLOS | Cabinet | SPEC-UI-CAB-030 |
| F-9.5.0-05 | TCL | Cabinet | Partie 21, À VÉRIFIER |
| F-9.5.0-06 | Droit de timbre | Cabinet | SPEC-UI-CAB-030 |
| F-9.5.0-07 | **Chaque case tracée** jusqu'aux écritures qui la font — on clique, on voit d'où vient le chiffre | Cabinet | SPEC-DATA-005 |
| F-9.5.0-08 | Une case dont la règle n'est pas connue vaut **`null`, jamais 0** | Cabinet | règle 36 |
| F-9.5.0-09 | Contrôles avant dépôt : le 4366 égale le report de `vatChain`, comptes d'attente, brouillard restant | Cabinet | SPEC-UI-CAB-030 |
| F-9.5.0-10 | L'**écriture de déclaration** générée au dernier jour du mois (4367 / 4366 → 4365) | Cabinet | SPEC-UI-CAB-030 |
| F-9.5.0-11 | Les **acomptes provisionnels** | Cabinet | `PLAN-COMPTABLE.md` |
| F-9.5.0-12 | Calendrier fiscal par dossier **selon son régime**, aucune date ne faisant foi | Cabinet | SPEC-UI-CAB-031 |
| F-9.5.0-13 | L'état d'un mois : **reçu → saisi → déclaré → payé**, pointé et dé-pointable | Cabinet | SPEC-UI-CAB-031 |
| F-9.5.0-14 | Préparation de la télédéclaration : le fichier ou les chiffres à reporter | Cabinet | SPEC-UI-CAB-030 |

**Ce qui n'y est pas** : le dépôt à la place du cabinet. « Marquer déposée » est un pense-bête, pas
un accusé de réception — une application qui déposerait à la place de quelqu'un se tromperait un
jour sans qu'il le sache (règle de la 5.2.0).

**Ce qui la prouve** : la déclaration d'un mois réel du pilote, calculée par le Cabinet, **égale
celle qu'il a déposée** — ou l'écart est expliqué ligne par ligne. Plus un e2e : pointer déclaré
puis payé, et le défaire.

**Ce qui reste à décider** : le périmètre exact des cases (*comptable*) ; l'assiette et le taux de
la TCL (*comptable*) ; les cases des acomptes (*comptable*) ; ce que le portail accepte
(*comptable*) ; et surtout **qui écrit le règlement** — la banque ou le pointage « payé » : un seul
des deux, jamais les deux (*toi* — je propose la banque quand le dossier a un relevé).

---

## 9.5.1 — Entretien *(hors des treize demandées)*

| | |
|---|---|
| **Durée** | construction 3 j · réaliste 6 j |
| **Niveau de spec** | Cadrée : Partie 15 |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.5.1-01 | Les taux et bases de la 9.5.0 confrontés à la **première vraie déclaration** | Cabinet | — |
| F-9.5.1-02 | `core.js` → `compta.js` **fini** : le moteur d'écritures entièrement dans le module partagé | Partagé | SPEC-FUNC-100 |
| F-9.5.1-03 | Electron, si une version est sortie | Partagé | — |
| F-9.5.1-04 | Les retours de bêta qui ne sont pas des nouveautés | Partagé | — |

---

## 9.6.0 — La clôture d'exercice

> *L'inventaire, les états, l'à-nouveau — et le flux retour vers le client, sans lequel les deux
> bilans divergent pour toujours.*

| | |
|---|---|
| **Durée** | construction 10 à 15 j · réaliste 30 j |
| **Dépend de** | la présentation exacte des états (NCT 01) et des notes ; **un exercice complet du pilote** dans le Cabinet |
| **Niveau de spec** | Cadrée : Partie 15, SPEC-UI-CAB-040 → 043, SPEC-UI-ENT-100 ; SPEC-FMT-007 réservé |
| **Jalon** | **J3** (31/12/2027) : un second cabinet a commencé, vingt-cinq licences |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.6.0-01 | Écritures d'inventaire **guidées** : dotations, provisions, charges et produits constatés d'avance, factures non parvenues et à établir, régularisations | Cabinet | SPEC-UI-CAB-040 |
| F-9.6.0-02 | **Extourne automatique** au 1er jour de l'exercice suivant pour ce qui s'extourne | Cabinet | SPEC-UI-CAB-040 |
| F-9.6.0-03 | Contrôles de clôture — comptes d'attente, brouillard restant, TVA non déclarée, balance des tiers — qui **ne bloquent jamais** | Cabinet | SPEC-UI-CAB-041, règle 6.0.0 |
| F-9.6.0-04 | Clôture d'exercice **définitive et tracée** ; une réouverture exige un motif | Cabinet | SPEC-UI-CAB-041 |
| F-9.6.0-05 | À-nouveaux **explicites**, calculés sur les écritures réelles seules — jamais comptés deux fois | Cabinet | SPEC-UI-CAB-041, règle 9.0.0 |
| F-9.6.0-06 | L'exercice suivant s'ouvre **pendant** que le précédent se termine | Cabinet | SPEC-UI-CAB-041 |
| F-9.6.0-07 | États financiers au format SCE : bilan, état de résultat, flux de trésorerie, notes | Cabinet | SPEC-UI-CAB-042 |
| F-9.6.0-08 | Comparatif N / N-1, soldes intermédiaires de gestion, ratios | Cabinet | SPEC-UI-CAB-042 |
| F-9.6.0-09 | Impression et PDF des états, par le moteur de pagination de la 7.31.0 | Cabinet | SPEC-UI-CAB-042 |
| F-9.6.0-10 | **`.skanclose`** produit à la clôture, chiffré pour le client : à-nouveaux officiels, écritures d'inventaire, date de clôture | Cabinet | SPEC-FMT-007 |
| F-9.6.0-11 | Un **PDF** lisible par n'importe qui dans le `.skanclose`, pour le client qui ne met jamais à jour | Cabinet | SPEC-UI-CAB-043 |
| F-9.6.0-12 | **Le cabinet clôture quand même** si le client n'est pas à jour : le fichier attend et repart avec la relance suivante | Cabinet | SPEC-UI-CAB-043, règle 48 |
| F-9.6.0-13 | L'entreprise importe le `.skanclose` : les à-nouveaux officiels sont posés | Entreprise | SPEC-UI-ENT-100 |
| F-9.6.0-14 | L'exercice clos est **verrouillé** chez le client, et les écritures du comptable s'y lisent | Entreprise | SPEC-UI-ENT-100 |
| F-9.6.0-15 | Une version trop ancienne dit « ton comptable a clôturé : mets à jour SkanFact » | Entreprise | SPEC-UI-ENT-100 |

**Ce qui n'y est pas** : **la liasse**. Cette version produit des états **déduits de la balance**, et
la page l'écrit. Confondre les deux ferait promettre ce que la 10.0.0 seule livre.

**Ce qui la prouve** : actif = passif, résultat identique des deux côtés, à-nouveau égal aux soldes
du 31/12 ; une clôture refusée puis acceptée ; la réouverture impossible sans motif. Et surtout
**l'e2e du flux retour** : le cabinet clôture, le client importe, **les deux bilans sont identiques
au millime** — le jumeau du test de parité, dans l'autre sens.

**Ce qui reste à décider** : la présentation exacte NCT 01, les notes, les SIG et ratios retenus
(*comptable*) ; simplifié contre complet, par dossier (*comptable*) ; le brouillard restant à la
clôture (*comptable*) ; le format exact du `.skanclose` (*toi*, en 9.6.0) ; et côté client, ce
qu'on fait de ses propres écritures dans un exercice que le cabinet vient de clore (*toi* — je
propose l'archivage, jamais une perte silencieuse).

---

## 9.7.0 — Immobilisations et stocks

> *Le dégressif, la sortie, les stocks valorisés — côté cabinet, pour les dossiers qui n'ont pas
> SkanFact.*

| | |
|---|---|
| **Durée** | construction 5 j · réaliste 10 j |
| **Dépend de** | rien de nouveau : le linéaire, la cession et le coût moyen pondéré existent depuis 3.5.0 et 4.0.0 |
| **Niveau de spec** | Cadrée : Partie 15, SPEC-UI-CAB-050 et 051 ; `immobilisations[]` **figé** dans SPEC-DATA-005 |
| **Jalon** | aucun : phase courte, elle enchaîne |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.7.0-01 | Fiches d'immobilisations tenues par le cabinet, **même modèle** que côté entreprise | Cabinet | SPEC-DATA-005 |
| F-9.7.0-02 | Amortissement **dégressif**, taux réglable — jamais un coefficient en dur | Cabinet | SPEC-UI-CAB-050 |
| F-9.7.0-03 | Amortissement **dérogatoire** (deux plans sur une fiche) | Cabinet | SPEC-UI-CAB-050 |
| F-9.7.0-04 | Tableau d'amortissement de l'exercice et VNC par dossier | Cabinet | SPEC-UI-CAB-050 |
| F-9.7.0-05 | Cessions et **mises au rebut** | Cabinet | SPEC-UI-CAB-050 |
| F-9.7.0-06 | Subventions d'investissement | Cabinet | SPEC-UI-CAB-050 |
| F-9.7.0-07 | Ce qui vient d'un paquet entre dans les mêmes fiches **sans ressaisie** ; jamais une fiche créée d'office | Cabinet | SPEC-UI-CAB-050 |
| F-9.7.0-08 | Les dotations passées en écritures d'inventaire portent leur `ecritureId` sur l'année du plan | Cabinet | SPEC-DATA-005 |
| F-9.7.0-09 | **Inventaire de stock** de fin d'exercice saisi (quantité × coût) | Cabinet | SPEC-UI-CAB-051 |
| F-9.7.0-10 | La **variation de stock** devient une écriture d'inventaire (603 / 37) | Cabinet | SPEC-UI-CAB-051 |

**Ce qui n'y est pas** : l'inventaire permanent côté cabinet — il attend qu'un cabinet le demande.

**Ce qui la prouve** : le dégressif contre un calcul à la main ; la dernière annuité qui absorbe les
arrondis ; le 28 d'un bien cédé repris **en entier** ; « sur un mois on amortit un mois » ; et la
parité avec l'app entreprise sur les biens venus d'un paquet.

**Ce qui reste à décider** : les coefficients dégressifs tunisiens (*comptable*, Partie 21) ; les
subventions (*comptable*) ; le dérogatoire — **s'il n'est pas demandé, il n'existe pas**
(*comptable*) ; FIFO si un dossier l'exige (*comptable*, sinon non).

**Le risque de cette version** : recopier le moteur au lieu de le partager par `compta.js`.

---

## 9.8.0 — Le cabinet à plusieurs

> *Plusieurs collaborateurs sur un cabinet, sans que l'un efface le travail de l'autre en silence.*

| | |
|---|---|
| **Durée** | construction 10 j · réaliste 20 j |
| **Dépend de** | **un cabinet de plus d'une personne** qui l'utilise — sinon on construit du multi-poste pour un poste. C'est la version qui attend le plus J3 |
| **Niveau de spec** | Cadrée : Partie 15, SPEC-UI-CAB-060 → 062 |
| **Jalon** | le second cabinet utilise-t-il le multi-poste ? |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.8.0-01 | Collaborateurs : une identité **locale**, pas de compte serveur | Cabinet | SPEC-UI-CAB-060 |
| F-9.8.0-02 | Droits **par dossier** : saisie, validation, supervision | Cabinet | SPEC-UI-CAB-060 |
| F-9.8.0-03 | Deux postes sur le même dossier sans s'écraser : révision et fusion, comme le partage de 3.2.0 | Cabinet | SPEC-UI-CAB-061 |
| F-9.8.0-04 | **Une écriture validée ne se fusionne jamais** : elle existe ou pas ; un conflit sur un brouillard est **montré** | Cabinet | SPEC-UI-CAB-061 |
| F-9.8.0-05 | Verrouillage automatique d'un dossier ouvert ailleurs, et reprise d'un verrou orphelin | Cabinet | ERR-CAB-022 |
| F-9.8.0-06 | La piste d'audit porte **qui**, sur chaque geste | Cabinet | SPEC-DATA-005 |
| F-9.8.0-07 | Tableau de **production** : par dossier et par mois, reçu → saisi → révisé → déclaré, qui et depuis quand | Cabinet | SPEC-UI-CAB-062 |
| F-9.8.0-08 | « À faire » **par collaborateur** | Cabinet | SPEC-UI-CAB-062 |

**Ce qui n'y est pas** : un serveur. Un fichier par dossier et par exercice, jamais une base
partagée — et le service de transport seulement si un cabinet le demande.

**Ce qui la prouve** : un e2e à deux postes et deux collaborateurs — une écriture validée par l'un
n'est **jamais** perdue par l'autre, et un conflit sur un brouillard est montré, pas résolu en
silence. Le danger du partage n'est pas la panne, c'est le silence (règle 3.2.0).

**Ce qui reste à décider** : un mot de passe par collaborateur ou une identité déclarée (*toi*,
après la question au comptable) ; qui crée et retire un collaborateur (*comptable*) ; l'expiration
d'un verrou orphelin (*toi* — je propose « verrou de tel poste depuis telle durée, le reprendre ? »).

**La question qui bloque** : « Combien de collaborateurs, et travaillent-ils sur les mêmes dossiers
le même jour ? »

---

## 9.8.1 — Entretien *(hors des treize demandées)*

| | |
|---|---|
| **Durée** | construction 3 j · réaliste 6 j |
| **Niveau de spec** | Cadrée : Partie 15 |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.8.1-01 | Les mesures du test de charge **rejouées à trois postes** | Cabinet | SPEC-OUT-006 |
| F-9.8.1-02 | `CLAUDE.md` relu **en entier** pour retirer ce qui n'est plus vrai — un document de mémoire qui grossit sans jamais maigrir finit par mentir par omission | Partagé | — |
| F-9.8.1-03 | Electron, dette, découpage suivant | Partagé | — |
| F-9.8.1-04 | Les retours de bêta qui ne sont pas des nouveautés | Partagé | — |

---

## 9.9.0 — La révision et les questions

> *Le dossier de travail du comptable, et les questions qui arrivent en face de la pièce chez le
> client — l'avantage que personne d'autre n'a.*

| | |
|---|---|
| **Durée** | construction 10 j · réaliste 20 j |
| **Dépend de** | la méthode de révision du pilote. La clé du client existe depuis la 9.2.0 : c'est celle de la signature |
| **Niveau de spec** | Cadrée : Partie 15, SPEC-UI-CAB-070 et 071, SPEC-UI-ENT-101 ; SPEC-FMT-006 réservé |
| **Jalon** | enchaîne sur la 10.0.0 |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.9.0-01 | Dossier de révision **par exercice** | Cabinet | SPEC-UI-CAB-070 |
| F-9.9.0-02 | **Feuilles maîtresses par cycle** : trésorerie, ventes-clients, achats-fournisseurs, immobilisations, personnel, fiscal, capitaux | Cabinet | SPEC-UI-CAB-070 |
| F-9.9.0-03 | Chaque compte **revu et signé** : qui, quand | Cabinet | SPEC-UI-CAB-070 |
| F-9.9.0-04 | Points en suspens, avec la réponse attendue du client | Cabinet | SPEC-UI-CAB-070 |
| F-9.9.0-05 | Notes de revue du superviseur | Cabinet | SPEC-UI-CAB-070 |
| F-9.9.0-06 | Questionnaire de fin d'exercice | Cabinet | SPEC-UI-CAB-070 |
| F-9.9.0-07 | **Une question naît depuis la ligne** — pièce absente, 471 non soldé, facture ouverte, mois provisoire — et part scellée pour le client | Cabinet | SPEC-FMT-006 |
| F-9.9.0-08 | La question s'affiche **sur la pièce** dans SkanFact | Entreprise | SPEC-UI-ENT-101 |
| F-9.9.0-09 | Le client répond : texte, pièce jointe, et renvoie le mois révisé | Entreprise | SPEC-UI-ENT-101 |
| F-9.9.0-10 | Une question sans réponse au bout de deux paquets remonte dans « À faire » **des deux côtés** | Partagé | SPEC-UI-CAB-071 |

**Ce qui n'y est pas** : une écriture du cabinet chez le client. Jamais. Le pont reste le paquet.

**Ce qui la prouve** : `e2e:boucle` étendu — une question part, arrive sur la pièce, la réponse
revient dans un mois révisé.

**Ce qui reste à décider** : les cycles et la méthode de révision du comptable, les siens et pas les
nôtres (*comptable*) ; ses cinq questions les plus fréquentes, qui deviennent les modèles livrés
(*comptable*) ; le format de la réponse — texte, pièce jointe ou **correction proposée** (*toi*,
après ces cinq questions).

**Le risque** : un dossier de travail imposé par un logiciel ne sert à personne. On part de **sa**
méthode.

---

## 10.0.0 — La liasse et l'annuel

> *L'exercice se dépose, et le premier lancement du Cabinet montre enfin un vrai portefeuille.*

| | |
|---|---|
| **Durée** | construction 10 j · réaliste 20 j |
| **Dépend de** | la liasse de l'année remplie par le pilote ; **au moins trois cabinets**, sinon cette version n'a pas de lecteur |
| **Niveau de spec** | Esquisse : Partie 15, SPEC-UI-CAB-080 et 081 — « tout le reste » attend un document réel |
| **Jalon** | **J4** (30/06/2028). Après : entretien, et la question du § 3 reposée |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-10.0.0-01 | **Liasse fiscale** tunisienne (NCT 01), déduite de la balance | Cabinet | SPEC-UI-CAB-080 |
| F-10.0.0-02 | Déclaration annuelle d'IS ou d'IRPP selon le dossier | Cabinet | SPEC-UI-CAB-080 |
| F-10.0.0-03 | Déclaration annuelle d'employeur, sur le moteur de 5.2.0 | Cabinet | SPEC-UI-CAB-080 |
| F-10.0.0-04 | États financiers **signés**, en PDF | Cabinet | SPEC-UI-CAB-080 |
| F-10.0.0-05 | « Pas la liasse NCT 01 » **disparaît** de l'écran des états | Cabinet | SPEC-UI-CAB-080 |
| F-10.0.0-06 | Jeu d'exemple : **douze paquets réels ouvrables**, générés depuis `demo.js` et `packPlan` | Cabinet | SPEC-UI-CAB-081 |
| F-10.0.0-07 | Dossiers d'exemple couvrant les vraies situations, dont **un mois manquant** et **un client hors SkanFact** | Cabinet | SPEC-UI-CAB-081 |
| F-10.0.0-08 | Tout est rempli au premier lancement ; l'exemple s'efface au premier vrai paquet | Cabinet | SPEC-UI-CAB-081 |
| F-10.0.0-09 | Site : page Tarifs complète et **téléchargement du Cabinet** qui ne renvoie plus un 404 | Site | `PLAN-DEVELOPPEMENT.md` D |
| F-10.0.0-10 | Conditions de vente publiées | Site | `PLAN-DEVELOPPEMENT.md` D |
| F-10.0.0-11 | Manuel de tenue dans l'aide du Cabinet | Cabinet | `PLAN-COMPTABLE.md` |

**Ce qui n'y est pas** : la télédéclaration à la place du cabinet.

**Ce qui la prouve** : la liasse du pilote pour un exercice réel, produite par le Cabinet, **acceptée
telle quelle** ou avec des écarts expliqués. Et l'e2e : le premier lancement ouvre un paquet réel et
affiche des livres non vides.

**Ce qui reste à décider** : **tout** — les tableaux de l'année, ce que le portail accepte
(*comptable*). Rien ne s'écrit avant la liasse réelle. C'est la version qui **exige le pilote**.

**Le risque** : la liasse est le document où une erreur coûte le plus cher. Relecture adversariale
complète et validation du pilote **avant** publication.

---

## Au-delà de la 10.0.0

Oui, il y aura une suite — la 10.0.0 arrive vers J4 (30/06/2028) et ne ferme rien. Ce qui suit n'a
**aucun numéro de version** et n'en aura pas tant que son déclencheur ne s'est pas produit : c'est la
règle qui a porté tout le projet — on ne construit pas la réponse à un problème qui n'existe pas
encore. Chaque ligne est déjà décidée comme « hors périmètre jusqu'à » dans `QUESTIONS.md` § 19,
`PLAN-COMPTABLE.md` « Hors plan » ou `CLAUDE.md`.

| Candidat | Ce qui le déclencherait | Pourquoi il n'est pas planifié |
|---|---|---|
| **E-facture TEIF / El Fatoora** | l'obligation légale pour les assujettis TVA, ou le premier client qui la subit | le contrôle de 9.1.1 dit déjà si notre modèle porte les champs ; construire l'export avant l'obligation, c'est viser un format qui bougera |
| **Interface en arabe** | une demande réelle, pas une hypothèse | la porte est gardée ouverte par les propriétés logiques de la 9.3.6 ; le reste est un chantier de plusieurs semaines |
| **Lecture de photo de facture** (en pause depuis la 8.7.0) | une application sur téléphone | le code de la 4.2.0 est intact et attend ; sans téléphone, il ne sert à personne |
| **Application sur téléphone** | le besoin qui rendrait la photo utile : saisir une dépense sur le terrain | un second produit, pas une version |
| **Serveur de transport des paquets** | un cabinet qui le demande — c'est écrit noir sur blanc dans `PLAN-PLATEFORME.md` § 7.0.0 | le paquet marche, et un serveur qui transporte des comptabilités change le niveau de responsabilité |
| **Paie de cabinet** | un cabinet qui la demande | le moteur de paie existe côté entreprise depuis la 5.0.0 et se partagerait par `compta.js` |
| **GED de cabinet, gestion du temps, facturation des honoraires** | un cabinet qui les demande | le comptable a déjà des outils, et SkanFact entreprise sait facturer |
| **Portail client, inscription en autonomie, abonnement géré par le client** | le volume — au-delà de ce qu'un clic par vente peut absorber | `PLAN-PLATEFORME.md` § 13 : construire la surface avant la production est la façon la plus courante de ne jamais vendre |
| **Installateurs séparés arm64 / x64** | la taille du `.dmg` universel (222 Mo) devenue un frein | confort, pas fonction |
| **Un autre pays** | quelqu'un qui le demande et qui connaît sa fiscalité | tout le moteur fiscal est tunisien et paramétrable, mais le vocabulaire et les états ne le sont pas |

**Et deux choses qui ne sont pas des versions mais qui arriveront sûrement avant la 10.0.0** : des
versions correctives (`9.x.y`) que le pilote provoquera — elles ne se planifient pas, elles se
subissent —, et la **signature de code** Apple et Windows, qui est dans la Phase 0 parce qu'un
expert-comptable ne clique pas sur « Exécuter quand même ».

---

## Comment lire ce document quand tu es perdu

- **« Qu'est-ce qu'on fait maintenant ? »** → `PLAN-DEVELOPPEMENT.md`, Partie E (les 26 semaines) et
  Partie F (les décisions de la semaine).
- **« Comment on l'écrit ? »** → `CAHIER-DES-CHARGES.md`, l'identifiant `SPEC-*` de la colonne
  « Spec ».
- **« Pourquoi on l'a décidé comme ça ? »** → `DIRECTION.md` pour les décisions de produit,
  `QUESTIONS.md` pour tout le reste, `CLAUDE.md` pour les règles apprises en se trompant.
- **« Est-ce qu'on continue ? »** → les jalons. Un jalon est un chiffre — démonstrations, essais,
  licences — et un chiffre qui manque fait du trimestre suivant un trimestre de vente, pas de code.
  C'est la seule règle d'arrêt du projet, et elle vaut plus que cette liste entière.

*Ce document se relit à chaque version publiée : la version livrée quitte la liste, et celle qui
suit passe de « Cadrée » à « Complète » le jour où le cahier la spécifie.*
