# VERSIONS-A-VENIR.md — tout ce qui reste à faire, de la 9.1.0 à la 10.0.0

## Version 2 — 16/09/2026

**Ce que c'est** : la liste complète des fonctionnalités à venir, version par version, pour voir d'un
coup d'œil ce qui reste — écrite le 15/09/2026 en lisant `CAHIER-DES-CHARGES.md` (v1.1),
`PLAN-DEVELOPPEMENT.md`, `QUESTIONS.md` § 16 et `PLAN-COMPTABLE.md` au commit **`137daad`**, puis
corrigée le 16/09/2026 au commit **`d5ed703`** (v2 : cinq corrections d'une relecture extérieure,
dont la **renumérotation** des versions ; le Journal en fin de document dit tout ce qui a changé).
**Ce que ce n'est pas** : ni une spécification (les schémas, les signatures et les formats sont dans
`CAHIER-DES-CHARGES.md`), ni un calendrier (les jalons, le chemin critique et les 26 semaines sont
dans `PLAN-DEVELOPPEMENT.md`), ni un engagement de date — c'est un inventaire.
**Convention d'identifiants** : chaque ligne porte `F-<version>-<nn>` (par exemple `F-9.2.0-19`),
citable dans un commit, une conversation ou une revue ; la colonne « Spec » renvoie à l'identifiant
`SPEC-*` / `MIG-*` qui la décrit quand il existe.

En cas de contradiction, `DIRECTION.md` fait foi, puis `CAHIER-DES-CHARGES.md`, puis ce document.

---

## Où on en est (16/09/2026)

- **SkanFact Entreprise 9.0.0** : neuf modules et vingt et une pages livrés — ventes, achats,
  trésorerie, stock, immobilisations, paie, marges, statistiques, comptabilité. **Passe en
  entretien** : plus aucun écran neuf n'y est ajouté (`DIRECTION.md`).
- **SkanFact Cabinet 9.0.0** : reçoit les paquets, recalcule leurs empreintes, relance, suit les
  échéances et exporte les écritures en CSV. **Ne tient pas encore de comptabilité.**
- **Plateforme** : écrite, testée contre le vrai schéma D1 sur SQLite. *(Mis à jour le 17/09/2026 :
  la clé de réponse est embarquée depuis la 9.4.1 — la révocation s'applique chez tout client à
  jour. Reste, côté Skander : les réglages Cloudflare et la première vente.)*
- **Clients payants : zéro.** Trois utilisateurs, tous de la famille : Skander, son père, son frère.
- **Prochaine version : 9.1.0** — l'outillage, puis les livres lus dans les paquets.
- **Ce qui décide de la suite** : J0 le 15/10/2026, et c'est une démarche, pas du code.

---

## Tableau récapitulatif

| Version | Titre | Nb fonctionnalités | Niveau spec | Durée |
|---|---|---|---|---|
| **9.1.0** | Outillage, livres lus, option Comptabilité | 25 | Complète | 8 j · 16 j |
| **9.1.1** | Les corrections fiscales | 7 | Complète | 2 j · 4 j |
| **9.2.0** | Le livre du dossier, et le paquet signé | 26 | Complète | 8 j · 20 j |
| **9.3.0** | La saisie | 14 | Intention | 10 j · 20 j |
| **9.4.0** | La licence du Cabinet | 12 | Intention | 5 j · 10 j |
| **9.4.4** → **9.4.9** | Le chantier UI/UX du Cabinet (page Dossiers, le livre, les échéances, la fiche, les finitions, le fil du parcours) | — | Mesuré | **livré** 17/09/2026 |
| ~~**9.4.10**~~ | ~~Entretien~~ | 7 | Intention | **livré** 17/09/2026 |
| ~~**9.5.0**~~ | ~~La banque~~ | 12 | Intention | **livré** 17/09/2026 |
| ~~**9.6.0**~~ | ~~La déclaration mensuelle~~ | 14 | Intention | **livré** 17/09/2026 (13 sur 14) |
| *9.6.1* | *Entretien (hors des 13 demandées)* | *4* | *Intention* | *3 j · 6 j* |
| **9.7.0** | Immobilisations et stocks | 10 | Intention | 5 j · 10 j |
| **9.8.0** | La clôture d'exercice | 15 | Intention | 13 j · 30 j |
| ~~**9.9.0**~~ | ~~Le cabinet à plusieurs~~ | 8 | Intention | **livré** 21/09/2026 |
| *9.9.1* | *Entretien (hors des 13 demandées)* | *4* | *Intention* | *3 j · 6 j* |
| **9.10.0** | La révision et les questions | 10 | Intention | 10 j · 20 j |
| **10.0.0** | La liasse et l'annuel | 11 | Esquisse | 10 j · 20 j |

**Total : 171 fonctionnalités à venir** sur les treize versions principales, **179** avec les trois
versions d'entretien (9.4.10 est comptée dans les treize, 9.6.1 et 9.9.1 ne le sont pas).

**Répartition par niveau de spec** — c'est le chiffre qui dit quelle part du projet est prête à être
codée aujourd'hui. Sur les **171** des treize versions principales ; les trois versions d'entretien
(8 fonctionnalités de plus) sont toutes au niveau *Intention*.

| Niveau | Fonctionnalités | Part |
|---|---|---|
| **Complète** — prête à coder, sans une question | 58 | 34 % |
| **Intention** — à spécifier au moment de la version | 102 | 60 % |
| **Esquisse** — à documenter avant de spécifier | 11 | 6 % |

Les deux tiers restants demanderont des allers-retours avec le comptable : ce ne sont pas des jours
de code en attente, ce sont des **réponses** en attente. C'est aussi pourquoi les durées de la
colonne « réaliste » valent le double de celles de la construction.

**Les trois niveaux de spec**, définis une seule fois — `CAHIER-DES-CHARGES.md` Partie 15 emploie le
même vocabulaire et renvoie ici. *Complète* = écrite dans le cahier avec ses schémas, ses écrans,
ses tests et ses migrations : exécutable sans question. *Intention* = la Partie 15 du cahier lui
donne un écran réservé (`SPEC-UI-CAB-0nn`) avec son tableau « Décidé / À décider » : on sait ce qui
ne se rediscute pas, et **qui** tranche le reste. *Esquisse* = l'intention et la dépendance sont
connues, presque tout le contenu attend un document réel du comptable — la 10.0.0 est la seule dans
ce cas, et le cahier écrit « Tout : c'est la version qui exige le pilote ».

**Les deux durées** : construction · réaliste. La seconde est le double de la première, et c'est
`QUESTIONS.md` § 16 qui le dit — elle absorbe les retours du pilote, les correctifs, les relances
d'e2e et le temps de relecture. Mises bout à bout : **≈ 104 jours de construction, ≈ 228 jours
réalistes**, soit onze mois de travail effectif étalés sur dix-huit à vingt-et-un mois d'attentes.
C'est cohérent avec J4 au 30/06/2028. Quand `PLAN-DEVELOPPEMENT.md` donne une fourchette (« 5 à
10 j »), le tableau ci-dessus en prend le **milieu** et la section de la version garde la fourchette
entière : c'est la section qui fait foi.

**Les numéros sont ceux de la règle du projet** (`CLAUDE.md`, « Chaque amélioration livrée = une
nouvelle version ») : le troisième chiffre est réservé aux correctifs, donc une version qui ajoute
des fonctionnalités bouge le deuxième. La v1 employait `9.3.5` et `9.3.6` pour la licence du Cabinet
et l'entretien qui la suit ; la v2 les a renumérotées en **9.4.0** et **9.4.1**, et tout ce qui
suivait a décalé d'un cran — la banque devient 9.5.0, la révision 9.10.0, et la 10.0.0 ne bouge pas.
**La renumérotation a été appliquée aux six autres documents en même temps** (281 occurrences) :
`QUESTIONS.md`, `CAHIER-DES-CHARGES.md`, `PLAN-DEVELOPPEMENT.md`, `PLAN-COMPTABLE.md`, `CLAUDE.md`
et `DIRECTION.md` disent donc exactement la même chose que celui-ci. Les identifiants
`SPEC-UI-CAB-0nn`, eux, **n'ont pas bougé** : ils sont déjà cités dans le cahier, et un identifiant
qu'on renumérote ne sert plus à rien.

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
| **Bloque** | **9.2.0** — le livre a besoin de `compta.js`, et le test de charge décide de son format — donc **toute la chaîne derrière**. Ne bloque pas la 9.1.1 |
| **Niveau de spec** | Complète : `CAHIER-DES-CHARGES.md` § 3.3, § 4.1, § 4.2, § 5.4, Partie 9, § 11.2, Partie 12 |
| **Jalon** | le test de charge décide du format de la 9.2.0. **J0 n'est plus une porte** : reporté à la phase d'essai le 16/09/2026 (`PLAN-DEVELOPPEMENT.md`, Phase 0) |

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
| **Bloque** | **rien** — la seule version du chantier dans ce cas. Ce qui ne veut pas dire qu'elle peut attendre : ses quatre chiffres partent chez un tiers (l'administration, un client, un comptable) |
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
| **Dépend de** | ~~le test de charge réussi~~ — **fait le 16/09/2026**, et il a tranché : corps **binaire** au lieu de base64 (147 ms → 79 ms sur l'écriture, seuil 100 ms), le reste du format inchangé, aucun découpage par mois ni index nécessaire (voir SPEC-DATA-005) ; **le plan de comptes du comptable** et le format de balance de son logiciel actuel ; **J0** atteint ; l'engagement écrit du pilote |
| **Bloque** | **9.3.0** (la saisie écrit dans le livre) et **9.10.0** (les questions au client voyagent avec la clé créée ici), donc **toute la chaîne derrière** |
| **Niveau de spec** | Complète : SPEC-DATA-005 (la plus importante du cahier), SPEC-DATA-004b, SPEC-FMT-005/008/009, SPEC-UI-CAB-003 → 006, SPEC-FUNC-103, § 11.4, MIG-9.2.0-001 → 004 |
| **Jalon** | **J1** (31/12/2026) : trois licences, le pilote par écrit |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.2.0-01 | `livre.json` : un fichier par dossier **et par exercice**, chiffré comme le reste (**corps binaire, entête en clair** — décidé par la mesure), écriture atomique, plus un index léger | Cabinet | SPEC-DATA-005 |
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
| **Bloque** | **9.5.0** et **9.8.0** — les deux exigent que le pilote travaille vraiment dans le Cabinet. C'est une dépendance d'usage, pas de code |
| **Niveau de spec** | Intention : `CAHIER-DES-CHARGES.md` Partie 15, SPEC-UI-CAB-010 → 013 |
| **Jalon** | le pilote continue-t-il dans le Cabinet ? Si non, on n'écrit pas la 9.5.0 avant de savoir pourquoi |

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

## 9.4.0 — La licence du Cabinet

> *Le Cabinet devient payant au-delà de trois dossiers hors SkanFact — on vend des dossiers, jamais
> des postes.*

| | |
|---|---|
| **Durée** | construction 5 j · réaliste 10 j |
| **Dépend de** | la question à l'Ordre **posée** (pas répondue : on construit, on ne vend pas) ; les prix |
| **Bloque** | **la vente du Cabinet**, et rien dans le code. C'est la seule version du chantier qui peut glisser sans arrêter une ligne du reste |
| **Niveau de spec** | Intention : Partie 15, SPEC-UI-CAB-015, SPEC-UI-CON-007 ; `DIRECTION.md` § 5.A et 5.B |
| **Jalon** | aucun ; touche à l'argent, donc **relecture adversariale complète obligatoire** |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.4.0-01 | Clé de licence de type `cabinet` : sujet = l'**empreinte** du cabinet, quota `dossiersHors` | Plateforme | SPEC-UI-CAB-015 |
| F-9.4.0-02 | `licence.js` et les clés publiques entrent dans la construction du Cabinet ; vérification **hors ligne** | Cabinet | SPEC-UI-CAB-015 |
| F-9.4.0-03 | Comptage des dossiers hors SkanFact, les **trois premiers gratuits** | Cabinet | `DIRECTION.md` § 5 |
| F-9.4.0-04 | Un dossier archivé, ou sans écriture validée depuis douze mois, **ne compte pas** | Cabinet | `QUESTIONS.md` § 3 |
| F-9.4.0-05 | **Grâce de douze mois** quand un client ne renouvelle pas — mais seulement après une licence **payée** | Cabinet | `QUESTIONS.md` § 3, règle 44 |
| F-9.4.0-06 | La porte unique posée sur la **validation** : lire, importer, exporter et relancer restent libres | Cabinet | SPEC-UI-CAB-015 |
| F-9.4.0-07 | Réglages → Licence : coller la clé, l'état, **ce qui est compté**, la liste nommée des dossiers comptés | Cabinet | SPEC-UI-CAB-015 |
| F-9.4.0-08 | Bandeau à trois tons, ligne « À faire », « Demander une licence » — les mêmes mécanismes que l'entreprise, pas des copies | Cabinet | SPEC-UI-CAB-015 |
| F-9.4.0-09 | Ce qui remonte au serveur : l'empreinte, le nombre de dossiers comptés, la version. **Jamais un nom de client** | Cabinet | § 17, test « ce qui remonte » |
| F-9.4.0-10 | Table `cabinets` et lien cabinet ↔ clients parrainés | Plateforme | SPEC-UI-CON-007 |
| F-9.4.0-11 | Console : émettre, marquer payée, renouveler, **monter le quota au prorata**, révoquer une licence Cabinet | Plateforme | SPEC-UI-CON-007 |
| F-9.4.0-12 | Le module Éditeur tire et facture une vente de type cabinet comme les autres | Entreprise | SPEC-UI-CON-007 |

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

## 9.4.10 — Entretien — **LIVRÉE le 17/09/2026**

> *Aucune fonction nouvelle, par règle. C'est la version où l'on rembourse.*

**Ce qui a été livré**, et ce qui ne l'a pas été : F-9.4.10-01 (Electron 43 → 44, les 46 parcours
relancés), F-9.4.10-02 (les 94 déclarations CSS physiques converties, une exception nommée),
F-9.4.10-04 (**premier** découpage du fichier de tests — le rendu du Cabinet sort dans
`test/suites/`, avec le contrôle qui refuse une suite non chargée), F-9.4.10-05 (les codes `ERR-*`
posés sur les 68 refus des deux `main.js`, confrontés à la table du cahier), et trois points de dette
du § 15 de `QUESTIONS.md` : `npm audit` dans la CI sur ce qui est livré (point 11), la version de
Node lue dans `engines` par les deux installeurs (point 12), le journal technique qui reçoit enfin
les exceptions imprévues (point 3, seconde moitié). **F-9.4.10-03 (découpage de `app.js` par route)
n'est PAS fait** : la règle du § 15 est de déplacer les routes *qu'une version touche*, et celle-ci
n'en touche aucune — le faire à vide serait le plus gros risque de régression du projet pour zéro
bénéfice. Il repart en 9.6.1. F-9.4.10-07 (les retours de la bêta 9.3.0) est sans objet : aucune
bêta 9.3.0 n'a été distribuée.

*(Elle s'appelait 9.4.1 dans la v2 de ce document. Deux versions d'entretien NON PRÉVUES ont pris les
numéros entre-temps — 9.4.1 « la clé de réponse embarquée » et 9.4.2 « l'exemple qui ne périme plus »,
publiées le 17/09/2026 — et deux choses différentes ne peuvent pas porter le même numéro dans le même
dépôt. Le contenu ci-dessous n'a pas bougé.)*

| | |
|---|---|
| **Durée** | construction 3 j · réaliste 6 j |
| **Dépend de** | rien ; elle suit la bêta de la 9.3.0 |
| **Bloque** | **rien** |
| **Niveau de spec** | Intention : Partie 15 ; `QUESTIONS.md` § 15 pour la liste de dette |
| **Jalon** | aucun |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.4.10-01 | Mise à jour d'Electron du semestre | Partagé | — |
| F-9.4.10-02 | Les **93 déclarations CSS physiques** converties en propriétés logiques — ce qui garde la porte de l'arabe ouverte sans rien promettre | Partagé | `QUESTIONS.md` § 3 |
| F-9.4.10-03 | Premier découpage de `app.js` par route | Entreprise | `QUESTIONS.md` § 15 |
| F-9.4.10-04 | `test/run-tests.js` découpé par domaine | Partagé | Partie 15 |
| F-9.4.10-05 | Les codes `ERR-*` posés sur chaque `throw` | Partagé | Partie 10 |
| F-9.4.10-06 | La dette listée au § 15 de `QUESTIONS.md` qui n'a pas encore été remboursée | Partagé | — |
| F-9.4.10-07 | Les retours de la bêta 9.3.0 **qui ne sont pas des nouveautés** | Partagé | — |

**Ce qui n'y est pas** : toute fonction nouvelle. Si une idée arrive pendant, elle va à la 9.4.0.

**Ce qui la prouve** : **tous** les e2e relancés, sans exception — c'est la seule version où on les
relance tous, parce que c'est celle où le moteur de rendu change.

---

## 9.5.0 — La banque — **LIVRÉE le 17/09/2026**

> *Le relevé importé, rapproché automatiquement quand c'est certain, proposé quand ça ne l'est
> pas — et jamais validé tout seul sur une ambiguïté.*

**La question qui bloquait — « quelles banques, et quel format chacune exporte-t-elle ? » — n'a
toujours pas de réponse, et la version est livrée quand même.** C'est la CONCEPTION qui répond à sa
place : rien dans le code ne connaît une banque. Les colonnes s'associent par leur nom, avec leurs
synonymes ; un fichier dont les en-têtes ne ressemblent à rien se lit après une association faite à
la main, qui est ensuite retenue **par banque**. Écrire un lecteur par banque aurait fait de chaque
nouvelle banque une nouvelle version du logiciel — c'est-à-dire aurait transformé la question
ouverte en dette permanente.

**Livré** : F-9.5.0-01 (CSV par NOM de colonne), 03 (l'assistant « CSV inconnu », mémorisé par
banque), 04 (`releves[]`, un objet par fichier), 05 (refus si le relevé ne boucle pas, avec
l'écart), 06 (empreinte du fichier), 07 et 08 (les quatre niveaux ; seul `certain` se pose, une
ambiguïté jamais), 09 (écriture PROPOSÉE depuis une ligne, jamais créée sans clic), 10 (les suspens,
des deux côtés), 11 (lettrage automatique + délettrage), 12 (balance âgée et échéancier sur les
tranches de 2.5.0, désormais partagées par `compta.js`).

**Pas livré, et c'est écrit dans le plan** : F-9.5.0-02 (OFX et MT940) — « seulement si une banque
des clients les exporte vraiment ». Personne ne l'a encore dit.

**Ce qui reste à décider et qui a reçu une valeur par défaut, avec son « À VÉRIFIER »** : le « ± n
jours » vaut **3**, réglable par dossier ; la table libellé → compte part **vide** et s'apprend un
libellé à la fois (règle 9.1.1 : la valeur par défaut d'une règle qu'on ne connaît pas est celle qui
ne fait rien) ; les lignes non rapprochées vont dans une **liste de suspens**, jamais au 471 d'office ;
le lettrage **partiel** n'est pas lettré — la ligne reste ouverte, ce qui est précisément la réponse
à « ce client me doit-il encore quelque chose ? » ; les tranches d'âge sont celles de la 2.5.0.

| | |
|---|---|
| **Durée** | construction 10 j · réaliste 20 j |
| **Dépend de** | **les formats de relevés** des banques des clients du pilote — un fichier réel de chaque, anonymisé ; la 9.3.0 utilisée |
| **Bloque** | **9.8.0**, faiblement : les contrôles de clôture lisent les suspens bancaires. Rien d'autre |
| **Niveau de spec** | Intention : Partie 15, SPEC-UI-CAB-020 → 022 ; `releves[]` **figé** dans SPEC-DATA-005 |
| **Jalon** | **J2** (30/06/2027) : dix licences, le pilote qui ne revient pas en arrière |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.5.0-01 | Lecteurs de relevés CSV des banques tunisiennes, colonnes associées **par nom, jamais par position** | Cabinet | SPEC-UI-CAB-020 |
| F-9.5.0-02 | OFX et MT940, **seulement** si une banque des clients les exporte vraiment | Cabinet | SPEC-UI-CAB-020 |
| F-9.5.0-03 | Assistant « CSV inconnu » : associer colonne → champ une fois, mémorisé par banque | Cabinet | SPEC-UI-CAB-020 |
| F-9.5.0-04 | `releves[]` : un objet par fichier importé, les lignes dedans — le comptable pense « le relevé de mars » | Cabinet | SPEC-DATA-005 |
| F-9.5.0-05 | Refus si `soldeDebut + Σ montants ≠ soldeFin`, avec l'écart nommé | Cabinet | ERR-CAB-040 |
| F-9.5.0-06 | Empreinte du fichier : on n'importe jamais deux fois le même relevé | Cabinet | SPEC-DATA-005 |
| F-9.5.0-07 | **Rapprochement automatique à quatre niveaux** : certain, probable, à confirmer, aucun — seul « certain » se pose d'office, et il reste défaisable | Cabinet | SPEC-UI-CAB-021 |
| F-9.5.0-08 | Une ambiguïté montre **tous** les candidats et n'est jamais « certain » | Cabinet | SPEC-UI-CAB-021, règle 32 |
| F-9.5.0-09 | Écriture **proposée** depuis une ligne non rapprochée, selon le libellé — jamais créée sans clic | Cabinet | SPEC-UI-CAB-021 |
| F-9.5.0-10 | État de rapprochement et suspens ; `etatRapprochement` (9.0.0) reste la source du solde | Cabinet | SPEC-UI-CAB-021 |
| F-9.5.0-11 | **Lettrage automatique** des tiers par montant et référence, délettrage à la main | Cabinet | SPEC-UI-CAB-022 |
| F-9.5.0-12 | Échéancier et **balance âgée** clients et fournisseurs, sur les tranches de 2.5.0 | Cabinet | SPEC-UI-CAB-022 |

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

## 9.6.0 — La déclaration mensuelle — **LIVRÉE le 17/09/2026**

> *La déclaration tunisienne du mois produite depuis la balance, avec les chiffres que le comptable
> recopie sur le portail — et rien de plus.*

**La dépendance — « le modèle de déclaration que le pilote dépose réellement » — n'est pas levée, et
la version est livrée quand même.** Ce qui le permet, c'est la règle 36 prise au sérieux : une case
dont la règle n'est pas connue vaut **`null`**, jamais 0, et elle porte sa raison à l'écran. Le jour
où le comptable montre son formulaire, on remplace un motif par un calcul — on ne réécrit rien.

**Livré** : F-9.6.0-01 (une déclaration par dossier et par période, déduite des écritures), 02 (TVA
collectée, déductible, crédit reporté ; le report se LIT sur le compte), 03 (retenues opérées et
subies, IRPP), 06 (droit de timbre), 07 (**chaque case tracée** jusqu'aux écritures qui la font,
ouvrables d'un clic), 08 (une case inconnue vaut `null`), 09 (trois contrôles avant dépôt, qui
nomment sans bloquer), 10 (l'écriture de déclaration au dernier jour du mois, en brouillard), 13
(l'état d'un mois : reçu → saisi → déclaré → payé, pointé et dé-pointable), 14 (les chiffres à
reporter, exportables en CSV). F-9.6.0-04 (TFP, FOPROLOS) et 05 (TCL) et 11 (acomptes) sont livrés
**en tant que cases `null` nommées** : leur assiette et leur taux ne sont pas établis.

**Pas livré** : F-9.6.0-12, le calendrier fiscal par régime. Les régimes à distinguer et les
échéances de chacun sont une question au comptable ; les inventer serait écrire du droit que
personne n'a confirmé. La page Échéances existante continue de servir.

**Ce qui reste à décider, et ce qui a été tranché en attendant** : « payé » **n'écrit pas** le
règlement — il vient du relevé bancaire quand le dossier en a un (9.5.0), de la saisie sinon.
Un seul des deux, jamais les deux (règle 5.0.0, « compté deux fois »), et l'écran dit lequel.

| | |
|---|---|
| **Durée** | construction 5 à 10 j · réaliste 20 j |
| **Dépend de** | **le modèle de déclaration** que le pilote dépose réellement, un exemplaire rempli |
| **Bloque** | **9.8.0**, faiblement : « TVA non déclarée » est l'un des contrôles avant clôture. Rien d'autre |
| **Niveau de spec** | Intention : Partie 15, SPEC-UI-CAB-030 et 031 ; `declarations[]` **figé** dans SPEC-DATA-005 |
| **Jalon** | le pilote dépose-t-il depuis le Cabinet ? |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.6.0-01 | Une déclaration par dossier et par période, déduite des écritures | Cabinet | SPEC-UI-CAB-030 |
| F-9.6.0-02 | TVA collectée **par taux**, déductible, crédit reporté — `vatChain` reste le moteur | Cabinet | SPEC-UI-CAB-030 |
| F-9.6.0-03 | Retenues à la source **par nature** | Cabinet | SPEC-UI-CAB-030 |
| F-9.6.0-04 | TFP et FOPROLOS | Cabinet | SPEC-UI-CAB-030 |
| F-9.6.0-05 | TCL | Cabinet | Partie 21, À VÉRIFIER |
| F-9.6.0-06 | Droit de timbre | Cabinet | SPEC-UI-CAB-030 |
| F-9.6.0-07 | **Chaque case tracée** jusqu'aux écritures qui la font — on clique, on voit d'où vient le chiffre | Cabinet | SPEC-DATA-005 |
| F-9.6.0-08 | Une case dont la règle n'est pas connue vaut **`null`, jamais 0** | Cabinet | règle 36 |
| F-9.6.0-09 | Contrôles avant dépôt : le 4366 égale le report de `vatChain`, comptes d'attente, brouillard restant | Cabinet | SPEC-UI-CAB-030 |
| F-9.6.0-10 | L'**écriture de déclaration** générée au dernier jour du mois (4367 / 4366 → 4365) | Cabinet | SPEC-UI-CAB-030 |
| F-9.6.0-11 | Les **acomptes provisionnels** | Cabinet | `PLAN-COMPTABLE.md` |
| F-9.6.0-12 | Calendrier fiscal par dossier **selon son régime**, aucune date ne faisant foi | Cabinet | SPEC-UI-CAB-031 |
| F-9.6.0-13 | L'état d'un mois : **reçu → saisi → déclaré → payé**, pointé et dé-pointable | Cabinet | SPEC-UI-CAB-031 |
| F-9.6.0-14 | Préparation de la télédéclaration : le fichier ou les chiffres à reporter | Cabinet | SPEC-UI-CAB-030 |

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

## 9.6.1 — Entretien — **LIVRÉE le 17/09/2026**

| | |
|---|---|
| **Durée** | construction 3 j · réaliste 6 j |
| **Dépend de** | rien |
| **Bloque** | **rien** |
| **Niveau de spec** | Intention : Partie 15 |

| Id | Fonctionnalité | Côté | Spec | État |
|---|---|---|---|---|
| F-9.6.1-01 | Les taux et bases de la 9.6.0 confrontés à la **première vraie déclaration** | Cabinet | — | **bloquée** : aucune déclaration réelle n'a encore été déposée avec le Cabinet. Rien ne se confronte à rien |
| F-9.6.1-02 | `core.js` → `compta.js` **fini** : le moteur d'écritures entièrement dans le module partagé | Partagé | SPEC-FUNC-100 | livrée — `entrySet` et tout le moteur d'amortissement |
| F-9.6.1-03 | Electron, si une version est sortie | Partagé | — | rien à faire : 44.4.1 est la dernière publiée |
| F-9.6.1-04 | Les retours de bêta qui ne sont pas des nouveautés | Partagé | — | aucun : rien n'est en bêta |
| F-9.4.10-03 | Découper `app.js` par route *(reporté ici depuis la 9.4.10)* | Entreprise | — | **refusée**, avec sa raison : une seule fermeture de 12 800 lignes, dont le découpage exige des globales ou un contexte traversant. La dette constatée est ailleurs, voir `CHANGELOG.md` |

---

## 9.7.0 — Immobilisations et stocks — **LIVRÉE le 17/09/2026**

> *Le dégressif, la sortie, les stocks valorisés — côté cabinet, pour les dossiers qui n'ont pas
> SkanFact.*

| | |
|---|---|
| **Durée** | construction 5 j · réaliste 10 j |
| **Dépend de** | rien de nouveau : le linéaire, la cession et le coût moyen pondéré existent depuis 3.5.0 et 4.0.0 |
| **Bloque** | **9.8.0** — la clôture calcule ses dotations depuis `immobilisations[]`, que cette version est la première à remplir. C'est la raison de l'échange des deux numéros (Journal, v3) |
| **Niveau de spec** | Intention : Partie 15, SPEC-UI-CAB-050 et 051 ; `immobilisations[]` **figé** dans SPEC-DATA-005 |
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
**Et l'amortissement DÉROGATOIRE (F-9.7.0-03), refusé avec sa raison** : le format de `livre.json`
est figé et ne lui réserve rien, et la règle de cette section est explicite — s'il n'est pas
demandé, il n'existe pas. Une case posée « au cas où » serait une règle fiscale offerte sans
validation. Le jour où un cabinet le demande, c'est une décision de format, pas une ligne de code.
Un test tient l'absence, pour qu'il ne rentre pas par la porte de derrière.

**Ce qui la prouve** : le dégressif contre un calcul à la main ; la dernière annuité qui absorbe les
arrondis ; le 28 d'un bien cédé repris **en entier** ; « sur un mois on amortit un mois » ; et la
parité avec l'app entreprise sur les biens venus d'un paquet.

**Ce qui reste à décider** : les coefficients dégressifs tunisiens (*comptable*, Partie 21) ; les
subventions (*comptable*) ; le dérogatoire — **s'il n'est pas demandé, il n'existe pas**
(*comptable*) ; FIFO si un dossier l'exige (*comptable*, sinon non).

**Le risque de cette version** : recopier le moteur au lieu de le partager par `compta.js`.

---

## 9.8.0 — La clôture d'exercice — **LIVRÉE le 17/09/2026**

> *L'inventaire, les états, l'à-nouveau — et le flux retour vers le client, sans lequel les deux
> bilans divergent pour toujours.*

| | |
|---|---|
| **Durée** | construction 10 à 15 j · réaliste 30 j |
| **Dépend de** | **la 9.7.0** (sans fiches de biens, pas de dotations pour un dossier hors SkanFact) ; la présentation exacte des états (NCT 01) et des notes ; **un exercice complet du pilote** dans le Cabinet |
| **Bloque** | **10.0.0** — la liasse part d'un exercice clos |
| **Niveau de spec** | Intention : Partie 15, SPEC-UI-CAB-040 → 043, SPEC-UI-ENT-100 ; SPEC-FMT-007 réservé |
| **Jalon** | **J3** (31/12/2027) : un second cabinet a commencé, vingt-cinq licences |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.8.0-01 | Écritures d'inventaire **guidées** : dotations, provisions, charges et produits constatés d'avance, factures non parvenues et à établir, régularisations | Cabinet | SPEC-UI-CAB-040 |
| F-9.8.0-02 | **Extourne automatique** au 1er jour de l'exercice suivant pour ce qui s'extourne | Cabinet | SPEC-UI-CAB-040 |
| F-9.8.0-03 | Contrôles de clôture — comptes d'attente, brouillard restant, TVA non déclarée, balance des tiers — qui **ne bloquent jamais** | Cabinet | SPEC-UI-CAB-041, règle 6.0.0 |
| F-9.8.0-04 | Clôture d'exercice **définitive et tracée** ; une réouverture exige un motif | Cabinet | SPEC-UI-CAB-041 |
| F-9.8.0-05 | À-nouveaux **explicites**, calculés sur les écritures réelles seules — jamais comptés deux fois | Cabinet | SPEC-UI-CAB-041, règle 9.0.0 |
| F-9.8.0-06 | L'exercice suivant s'ouvre **pendant** que le précédent se termine | Cabinet | SPEC-UI-CAB-041 |
| F-9.8.0-07 | États financiers au format SCE : bilan, état de résultat, flux de trésorerie, notes | Cabinet | SPEC-UI-CAB-042 |
| F-9.8.0-08 | Comparatif N / N-1, soldes intermédiaires de gestion, ratios | Cabinet | SPEC-UI-CAB-042 |
| F-9.8.0-09 | Impression et PDF des états, par le moteur de pagination de la 7.31.0 | Cabinet | SPEC-UI-CAB-042 |
| F-9.8.0-10 | **`.skanclose`** produit à la clôture, chiffré pour le client : à-nouveaux officiels, écritures d'inventaire, date de clôture | Cabinet | SPEC-FMT-007 |
| F-9.8.0-11 | Un **PDF** lisible par n'importe qui dans le `.skanclose`, pour le client qui ne met jamais à jour | Cabinet | SPEC-UI-CAB-043 |
| F-9.8.0-12 | **Le cabinet clôture quand même** si le client n'est pas à jour : le fichier attend et repart avec la relance suivante | Cabinet | SPEC-UI-CAB-043, règle 48 |
| F-9.8.0-13 | L'entreprise importe le `.skanclose` : les à-nouveaux officiels sont posés | Entreprise | SPEC-UI-ENT-100 |
| F-9.8.0-14 | L'exercice clos est **verrouillé** chez le client, et les écritures du comptable s'y lisent | Entreprise | SPEC-UI-ENT-100 |
| F-9.8.0-15 | Une version trop ancienne dit « ton comptable a clôturé : mets à jour SkanFact » | Entreprise | SPEC-UI-ENT-100 |

**Ce qui n'y est pas** : **la liasse**. Cette version produit des états **déduits de la balance**, et
la page l'écrit. Confondre les deux ferait promettre ce que la 10.0.0 seule livre.

**Ce qui a été tranché en livrant, sans le pilote** : le format `.skanclose` (SPEC-FMT-007) est un
ZIP — `cloture.json`, `etats.html`, `etats.pdf`, `manifeste.json`, `signature.json` — scellé par mot
de passe au choix du cabinet, et **signé** avec une clé Ed25519 propre au cabinet, symétrique de
celle du client (9.2.0). Il n'est pas chiffré pour la clé du client de la 9.2.0 : celle-ci est une
clé de **signature** (Ed25519), pas d'échange (X25519) — deux courbes pour deux métiers. La
présentation NCT 01, les notes, les SIG et ratios retenus restent des questions au comptable ; les
rubriques livrées sont celles de l'usage, et chaque solde porte sa formule à l'écran. Côté client,
ses propres écritures d'un exercice que le cabinet vient de clore ne sont **pas** touchées : elles
sont verrouillées, jamais effacées.

**Ce qui la prouve** : actif = passif, résultat identique des deux côtés, à-nouveau égal aux soldes
du 31/12 ; une clôture refusée puis acceptée ; la réouverture impossible sans motif. Et surtout
**l'e2e du flux retour** : le cabinet clôture, le client importe, **les deux bilans sont identiques
au millime** — le jumeau du test de parité, dans l'autre sens.

**Ce qui reste à décider** : la présentation exacte NCT 01, les notes, les SIG et ratios retenus
(*comptable*) ; simplifié contre complet, par dossier (*comptable*) ; le brouillard restant à la
clôture (*comptable*) ; le format exact du `.skanclose` (*toi*, en 9.8.0) ; et côté client, ce
qu'on fait de ses propres écritures dans un exercice que le cabinet vient de clore (*toi* — je
propose l'archivage, jamais une perte silencieuse).

---

## 9.9.0 — Le cabinet à plusieurs — **LIVRÉE le 21/09/2026**

> *Plusieurs collaborateurs sur un cabinet, sans que l'un efface le travail de l'autre en silence.*

| | |
|---|---|
| **Durée** | construction 10 j · réaliste 20 j |
| **Dépend de** | **un cabinet de plus d'une personne** qui l'utilise — sinon on construit du multi-poste pour un poste. C'est la version qui attend le plus J3 |
| **Bloque** | **rien** |
| **Niveau de spec** | Intention : Partie 15, SPEC-UI-CAB-060 → 062 |
| **Jalon** | le second cabinet utilise-t-il le multi-poste ? |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.9.0-01 | Collaborateurs : une identité **locale**, pas de compte serveur | Cabinet | SPEC-UI-CAB-060 |
| F-9.9.0-02 | Droits **par dossier** : saisie, validation, supervision | Cabinet | SPEC-UI-CAB-060 |
| F-9.9.0-03 | Deux postes sur le même dossier sans s'écraser : révision et fusion, comme le partage de 3.2.0 | Cabinet | SPEC-UI-CAB-061 |
| F-9.9.0-04 | **Une écriture validée ne se fusionne jamais** : elle existe ou pas ; un conflit sur un brouillard est **montré** | Cabinet | SPEC-UI-CAB-061 |
| F-9.9.0-05 | Verrouillage automatique d'un dossier ouvert ailleurs, et reprise d'un verrou orphelin | Cabinet | ERR-CAB-022 |
| F-9.9.0-06 | La piste d'audit porte **qui**, sur chaque geste | Cabinet | SPEC-DATA-005 |
| F-9.9.0-07 | Tableau de **production** : par dossier et par mois, reçu → saisi → révisé → déclaré, qui et depuis quand | Cabinet | SPEC-UI-CAB-062 |
| F-9.9.0-08 | « À faire » **par collaborateur** | Cabinet | SPEC-UI-CAB-062 |

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

## 9.9.1 — Entretien *(hors des treize demandées)*

| | |
|---|---|
| **Durée** | construction 3 j · réaliste 6 j |
| **Dépend de** | rien |
| **Bloque** | **rien** |
| **Niveau de spec** | Intention : Partie 15 |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.9.1-01 | Les mesures du test de charge **rejouées à trois postes** | Cabinet | SPEC-OUT-006 |
| F-9.9.1-02 | `CLAUDE.md` relu **en entier** pour retirer ce qui n'est plus vrai — un document de mémoire qui grossit sans jamais maigrir finit par mentir par omission | Partagé | — |
| F-9.9.1-03 | Electron, dette, découpage suivant | Partagé | — |
| F-9.9.1-04 | Les retours de bêta qui ne sont pas des nouveautés | Partagé | — |

---

## 9.10.0 — La révision et les questions

> *Le dossier de travail du comptable, et les questions qui arrivent en face de la pièce chez le
> client — l'avantage que personne d'autre n'a.*

| | |
|---|---|
| **Durée** | construction 10 j · réaliste 20 j |
| **Dépend de** | la méthode de révision du pilote. La clé du client existe depuis la 9.2.0 : c'est celle de la signature |
| **Bloque** | **rien** |
| **Niveau de spec** | Intention : Partie 15, SPEC-UI-CAB-070 et 071, SPEC-UI-ENT-101 ; SPEC-FMT-006 réservé |
| **Jalon** | enchaîne sur la 10.0.0 |

| Id | Fonctionnalité | Côté | Spec |
|---|---|---|---|
| F-9.10.0-01 | Dossier de révision **par exercice** | Cabinet | SPEC-UI-CAB-070 |
| F-9.10.0-02 | **Feuilles maîtresses par cycle** : trésorerie, ventes-clients, achats-fournisseurs, immobilisations, personnel, fiscal, capitaux | Cabinet | SPEC-UI-CAB-070 |
| F-9.10.0-03 | Chaque compte **revu et signé** : qui, quand | Cabinet | SPEC-UI-CAB-070 |
| F-9.10.0-04 | Points en suspens, avec la réponse attendue du client | Cabinet | SPEC-UI-CAB-070 |
| F-9.10.0-05 | Notes de revue du superviseur | Cabinet | SPEC-UI-CAB-070 |
| F-9.10.0-06 | Questionnaire de fin d'exercice | Cabinet | SPEC-UI-CAB-070 |
| F-9.10.0-07 | **Une question naît depuis la ligne** — pièce absente, 471 non soldé, facture ouverte, mois provisoire — et part scellée pour le client | Cabinet | SPEC-FMT-006 |
| F-9.10.0-08 | La question s'affiche **sur la pièce** dans SkanFact | Entreprise | SPEC-UI-ENT-101 |
| F-9.10.0-09 | Le client répond : texte, pièce jointe, et renvoie le mois révisé | Entreprise | SPEC-UI-ENT-101 |
| F-9.10.0-10 | Une question sans réponse au bout de deux paquets remonte dans « À faire » **des deux côtés** | Partagé | SPEC-UI-CAB-071 |

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
| **Bloque** | **rien** — c'est la fin de la chaîne |
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
| **Interface en arabe** | une demande réelle, pas une hypothèse | la porte est gardée ouverte par les propriétés logiques de la 9.4.10 ; le reste est un chantier de plusieurs semaines |
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
suit passe d'« Intention » à « Complète » le jour où le cahier la spécifie.*

---

## Ce que la relecture n'a pas vu

Quatre choses trouvées en appliquant ses cinq corrections. Les deux premières sont des conséquences
de la correction 1 ; la troisième est un défaut d'ordre dans le plan lui-même, et c'est la plus
importante ; la quatrième est une incohérence de la v1.

**1. La renumérotation ne pouvait pas rester dans ce document.** La relecture demandait de renommer
« toutes les occurrences dans le document ». Ces numéros vivent dans **six autres documents** :
`QUESTIONS.md` (45 occurrences), `CAHIER-DES-CHARGES.md` (38), `PLAN-DEVELOPPEMENT.md` (36),
`PLAN-COMPTABLE.md` (17), `CLAUDE.md` (14) et `DIRECTION.md` (11). Renuméroter ici seulement aurait
fabriqué très exactement le défaut que le projet combat depuis la 6.8.0 — *une table en double
diverge toujours* — et il aurait été découvert par quelqu'un qui cherche « la 9.4.0 » dans deux
documents et trouve deux versions différentes. La renumérotation a donc été appliquée **partout, en
une seule passe simultanée** (281 occurrences), avec un garde-fou qui vérifie qu'aucune version
livrée ni aucune version stable (`9.0.0`, `9.1.0`, `9.1.1`, `9.2.0`, `9.3.0`, `10.0.0`) n'a bougé.

**2. Les identifiants d'écran ne suivent plus leur version, et c'est voulu.** La Partie 15 du cahier
attribue les `SPEC-UI-CAB-0nn` par dizaines, une dizaine par version : `010` → `013` pour la saisie,
`020` → `022` pour la banque, et ainsi de suite. Après le décalage, la banque est la 9.5.0 mais
garde ses identifiants en `02n`. **Les renuméroter aurait été pire** : un identifiant est fait pour
être cité dans un commit et une revue, et un identifiant qui bouge ne sert plus à rien. La phrase du
cahier qui annonçait la convention « dizaine = version » a été corrigée pour dire la vérité : la
dizaine groupe les écrans d'une version, elle ne nomme pas son numéro.

**3. La clôture d'exercice lisait une liste que la version suivante écrit — tranché en v3.** C'était
un défaut d'ordre, pas de rédaction, et il venait de `PLAN-COMPTABLE.md`. La clôture passe les
dotations en écritures d'inventaire, et le cahier précise qu'elles sont « calculées depuis
`immobilisations[].plan` » (SPEC-UI-CAB-040) ; or `immobilisations[]` n'était rempli que par la
version **suivante** (SPEC-UI-CAB-050). Pour un dossier **sur SkanFact**, sans conséquence : les
dotations arrivent déjà calculées dans le paquet depuis la 9.0.0 de l'app entreprise. Pour un dossier
**hors SkanFact** — c'est-à-dire la majorité du portefeuille d'un cabinet, et la raison d'être du
produit payant — le cabinet n'avait nulle part où tenir les biens, donc il ne pouvait pas clôturer
cet exercice correctement. **Les deux versions ont été échangées** : les immobilisations passent en
**9.7.0**, la clôture en **9.8.0**. Aucune dépendance en sens inverse — les immobilisations n'ont
besoin de rien de la clôture — et la version courte (5 j) passe avant la longue (13 j), ce qui est
aussi meilleur pour le rythme de livraison. L'échange a été appliqué aux sept documents en même
temps, comme la renumérotation de la v2.

**4. Le tableau récapitulatif et les sections ne donnaient pas les mêmes durées.** Trois versions
ont une fourchette dans `PLAN-DEVELOPPEMENT.md` (« 5 à 10 j », « 10 à 15 j ») ; la v1 en prenait le
milieu dans le tableau et gardait la fourchette dans la section, sans le dire. Un lecteur qui
compare les deux croit à une erreur. C'est écrit sous le tableau maintenant, et **c'est la section
qui fait foi**.

---

## Journal des versions

### v1 — 15/09/2026, commit `d5ed703` (lu sur `137daad`)

Première version : le tableau récapitulatif, treize sections de version plus deux d'entretien, 179
fonctionnalités identifiées `F-<version>-<nn>`, la partie « Au-delà de la 10.0.0 » et « Comment lire
ce document ».

### v2 — 16/09/2026 (cinq corrections d'une relecture extérieure ; aucun fichier de code n'a changé)

**Ce qui a changé** :

- **Correction 1 — la numérotation est tranchée.** La règle du projet s'applique : la licence du
  Cabinet ajoute des fonctionnalités, donc elle devient **9.4.0** et tout ce qui suivait décale d'un
  cran (banque 9.5.0, déclaration 9.6.0, clôture 9.8.0, immobilisations 9.7.0, collaborateurs 9.9.0,
  révision 9.10.0 ; la 10.0.0 ne bouge pas). Les versions d'entretien suivent : 9.4.10 (9.4.1 et 9.4.2 ont été
  prises par deux entretiens non prévus, puis 9.4.3 → 9.4.6 par le chantier UI/UX du Cabinet du 17/09/2026),
  9.6.1, 9.9.1. Ce dernier décalage a coûté 23 occurrences dans cinq documents, contre 281 pour la v2 :
  prendre le numéro suivant plutôt que renuméroter toute la suite est ce qui a rendu l'opération tenable.
  **Appliquée aux sept documents** (281 occurrences), pas seulement ici — voir « Ce que la relecture
  n'a pas vu », point 1. Le paragraphe « Une remarque sur deux numéros » a disparu : il n'avait plus
  d'objet.
- **Correction 2 — un seul vocabulaire.** « Cadrée » devient **« Intention »**, le mot qu'emploie
  déjà la Partie 15 du cahier. « Esquisse » reste, pour la 10.0.0 seule, parce que la différence est
  réelle : sa colonne « Décidé » est quasi vide et le cahier écrit « Tout : c'est la version qui
  exige le pilote ». Les trois niveaux sont définis **une seule fois**, ici, et le cahier renvoie à
  cette définition au lieu d'en porter une seconde.
- **Correction 3 — la répartition par niveau**, sous le tableau : 58 fonctionnalités prêtes à coder
  (34 %), 102 à spécifier au moment de la version (60 %), 11 à documenter avant de spécifier (6 %).
  C'est le chiffre qui manquait le plus : il dit que les deux tiers du projet attendent des
  **réponses**, pas des jours de code.
- **Correction 4 — une ligne « Bloque »** dans les quinze tableaux d'en-tête. Elle permet de
  reconstituer le chemin critique sans ouvrir `PLAN-DEVELOPPEMENT.md`, et elle a montré deux choses
  que personne n'avait écrites : la **9.4.0** (licence du Cabinet) ne bloque que la *vente*, pas une
  ligne de code, et les trois versions d'entretien ne bloquent rien — ce sont les seules qui peuvent
  glisser sans arrêter la chaîne.
- **Correction 5 — « Où on en est »**, six lignes en tête. Un chiffre a été corrigé au passage :
  l'app entreprise porte **neuf** modules (`MODULES` dans `core.js`) et vingt et une pages, pas
  quinze modules — « quinze » venait d'une phrase de la 7.0.0 qui comptait les chantiers livrés, pas
  les modules de la barre latérale.

**Ce qui a été refusé, ou retenu autrement** :

- **Correction 1, le périmètre** : *retenue, mais élargie*. Faire la renumérotation dans ce document
  seul était la consigne ; je l'ai appliquée aux sept documents, parce que l'inverse aurait laissé
  six documents se contredire (point 1 ci-dessus). C'est le seul écart à la consigne, et il va dans
  le sens de son intention.
- **Correction 2, fondre « Esquisse » dans « Intention »** : *refusé*. La relecture laissait le
  choix. Les deux niveaux ne disent pas la même chose — une version « Intention » a un écran réservé
  avec ce qui est déjà tranché, une version « Esquisse » n'a que son intention et sa dépendance. Les
  confondre ferait croire que la 10.0.0 est aussi avancée que la 9.5.0, alors qu'elle attend une
  liasse fiscale réelle que personne n'a encore ouverte.
- **Correction 4, « tout ce qui suit »** : *retenue autrement*. L'exemple proposé écrivait « 9.1.1
  (attend le test de charge) » pour la 9.1.0 ; c'est faux, la 9.1.1 n'attend que la séance avec le
  comptable et ne dépend pas de la 9.1.0. Chaque ligne « Bloque » nomme donc les dépendances
  **réelles**, et distingue celles qui sont techniques de celles qui sont d'usage (« le pilote doit
  avoir travaillé dans le Cabinet »).

**Ce qui n'a pas été touché**, comme demandé : la structure par version, les tableaux de
fonctionnalités (hors renommage des identifiants), « Au-delà de la 10.0.0 » et « Comment lire ce
document ».

### v3 — 16/09/2026 (un audit extérieur de l'ensemble documentaire ; aucun fichier de code n'a changé)

**Ce qui a changé** :

- **L'ordre clôture / immobilisations est TRANCHÉ**, et c'était le seul point de fond ouvert depuis
  la v2. Les immobilisations passent en **9.7.0**, la clôture d'exercice en **9.8.0** : la clôture
  calcule ses dotations depuis `immobilisations[]`, que la version des immobilisations est la
  première à remplir, et sans elle un dossier **hors SkanFact** — le dossier payant — ne peut pas
  être clôturé avec ses amortissements. Échange appliqué aux **sept documents** en une passe (83
  numéros, plus les blocs de sections et les deux phases de `PLAN-DEVELOPPEMENT.md`), avec les mêmes
  garde-fous que la renumérotation de la v2.
- **Le compte des modules** : « quinze modules » décrivait l'application d'aujourd'hui dans
  `PLAN-DEVELOPPEMENT.md` et `QUESTIONS.md` alors que `MODULES` en contient neuf. Corrigé là où la
  phrase parle du présent ; **laissé tel quel** dans `CLAUDE.md` § 7.0.0, `PLAN-UX.md` et
  `CHANGELOG.md`, où « quinze » raconte les quinze chantiers livrés en six semaines — réécrire une
  phrase historique pour la faire coller au décompte du jour serait falsifier un journal.
- **`ROADMAP.md` s'appelait « Plan des versions à venir »**, exactement ce qu'est ce document-ci. Son
  titre dit maintenant qu'il est une archive et où se trouve ce qui reste à faire. Son bandeau de
  direction, lui, était déjà juste : il disait déjà que la comptabilité se construit dans le Cabinet.
- **`QUESTIONS.md` § 16 renvoie ici pour les durées**, et dit pourquoi les deux chiffres diffèrent
  (une fourchette contre son milieu).

**Ce qui a été refusé, et pourquoi** :

- **« Découper `PLAN-CABINET.md` en archive + parties vivantes »** : *refusé*. L'audit lui reproche
  quatre phrases dépassées. Deux sont **déjà corrigées dans le document** — « le cabinet ne paie
  jamais » est barré depuis le 15/09 avec le renvoi vers `DIRECTION.md`. Les deux autres ne sont pas
  fausses : « pas de serveur en première version » parle du **transport des paquets**, pas de la
  plateforme de licences, et cette phrase est toujours vraie (le paquet reste un fichier). Un
  découpage coûterait une demi-journée pour corriger deux phrases qui n'ont pas besoin de l'être.
- **« `PLAN-PLATEFORME.md` § 15 bis dit que la licence du Cabinet s'insère après la 9.3.0 »** :
  *le document ne dit pas ça*. Il écrit « l'ordre est au § 7 (après la saisie, étape 4) », sans
  numéro de version — c'est précisément pourquoi la renumérotation de la v2 ne l'a pas touché.
- **« Écrire `PLAN-VENTE.md` »** : *refusé maintenant, pas sur le principe*. Un plan de vente qui
  dit combien de prospects par semaine et quelles objections attendre, écrit sans avoir parlé à un
  seul cabinet, serait de la spéculation numérotée — exactement ce que ce document s'interdit pour
  les versions. Il s'écrit **après** les trois appels de prix, pas avant. La règle du projet est la
  même depuis le seuil de retenue à la source : *la valeur par défaut d'une règle qu'on ne connaît
  pas est celle qui ne fait rien.*

**Ce que l'audit a inventé**, et qui doit être dit parce que c'est la cinquième relecture extérieure
à le faire : **« 18 000 lignes de documentation »**. Le dépôt en compte **15 181**, README compris.
Ses chiffres par document sont faux dans les deux sens — `CAHIER-DES-CHARGES.md` annoncé à 4 500
lignes en fait 2 918, `PLAN-CABINET.md` annoncé à 400 en fait 319 — et `README.md` n'est pas compté.
Le chiffre gonflé sert son argument, qui est par ailleurs juste : il n'avait pas besoin d'être gonflé.

**Ce que l'audit a vu, et qui ne se corrige pas dans un fichier** : zéro client payant, le comptable
pilote jamais sollicité formellement, les six démarches bloquantes non faites, la plateforme pas en
production. Ces quatre faits sont déjà écrits dans `QUESTIONS.md` § 3 et § 20 et dans la Phase 0 de
`PLAN-DEVELOPPEMENT.md` — ils y sont depuis le 15/09. Les réécrire une sixième fois ne les fera pas
avancer d'un jour. **Le seul document que cette session ajoute est `PAGE-UNIQUE.md`**, parce que la
Phase 0 le confie explicitement à Claude et qu'il ne l'avait pas écrit.
