# PLAN-DEVELOPPEMENT.md — le plan d'exécution de SkanFact

*Écrit le 15/09/2026, sur l'état réel du dépôt à cette date (commit `9bde159`). Ce document
**orchestre** ; il ne redit pas. Le contenu de chaque version est dans `QUESTIONS.md` § 16, les
décisions dans `DIRECTION.md`, le détail comptable dans `PLAN-COMPTABLE.md`. Quand ce plan et
`DIRECTION.md` se contredisent, `DIRECTION.md` fait foi. Chaque ligne précédée d'une case se coche.*

*Convention : **Skander** = le fondateur, qui fait les démarches, vend, teste, relit. **Claude** = l'IA
qui écrit le code, les tests et les documents. **Le pilote** = le comptable de Skander, cabinet
pilote pressenti — pas encore engagé par écrit. Ces trois-là ne se disputent pas le même temps : une
semaine de démarches ne retarde aucune version, et une version ne retarde aucune démarche.*

---

> **Mise à jour du 21/09/2026 — les Phases 1 à 10 sont livrées.** La **10.0.0** est publiée : de la
> 9.1.0 à la 10.0.0, tout ce que la Partie B décrit est dans le dépôt. Les Parties A et B ci-dessous
> gardent leurs chiffres et leurs cases du 15/09/2026 : ce sont des mesures **datées**, c'est-à-dire
> de l'histoire, et on ne les réécrit pas (même règle qu'en 9.4.3 : on ne renumérote jamais une
> version déjà livrée). Ce qu'elles disent au futur — « le prochain geste de code est la 9.1.0 »,
> « ce qui n'existe pas encore » — a donc cessé d'être vrai, et ce paragraphe est là pour que
> personne ne le lise comme un plan.
>
> **Ce qui attend maintenant n'est plus du code, c'est la Phase 0** (les six démarches) et les
> **dépendances humaines** que chaque phase nommait sans pouvoir les obtenir : la méthode de révision
> du pilote, sa liasse d'un exercice réel, ses formats de banque, les échéances de chaque régime. Le
> code a été construit pour ne rien décider à leur place — tables vides, tout surchargeable,
> « À VÉRIFIER » sur chaque écran — mais c'est **la confrontation avec le pilote**, pas une version
> de plus, qui les lèvera.

## Partie A — État des lieux

### Ce qui est livré (vérifié dans `CHANGELOG.md` et `package.json`)

- **SkanFact Entreprise 9.0.0** (15/09/2026) : neuf modules et vingt et une pages — ventes, achats, trésorerie, marges,
  immobilisations, stock, séries et garanties, paie, congés et avances, déclarations sociales,
  clôture de période, paquet mensuel, appairage du cabinet, licence, pont comptable — plus les écrans
  comptables de 8.8.0 → 9.0.0 (grand livre, balance, livre-journal, OD, lettrage, à-nouveaux, états
  financiers) qui deviennent un **module `compta` masqué par défaut et payant** (`DIRECTION.md` § 4).
- **SkanFact Cabinet 9.0.0** : depuis la 6.6.0 les deux applications portent **le même numéro** et
  sortent dans la même release (`build/cabinet.config.js` : `version: pkg.version`). Livré : verrou,
  assistant, portefeuille, réception et contrôle des paquets, relances, échéances, export d'écritures
  CSV, sauvegardes, clé de secours, changement d'ordinateur, aide. **Aucune tenue de comptabilité.**
- **La plateforme** (`plateforme/`, Cloudflare Worker + D1) : émission, révocation, activation,
  ventes, mail — construite et testée sur SQLite, **pas en production** *(la clé de réponse, elle,
  est embarquée depuis la 9.4.1 du 17/09/2026 ; restent les réglages Cloudflare et la première vente)*.
- **Le relais de mise à jour** (`worker/`) : déployé chez Skander depuis la 6.7.x.
- **Les tests** : `npm test` = **384 vérifications** (vérifié le 15/09/2026) ; **42 parcours e2e**
  dans `test/e2e/` (41 scripts `e2e:*` dans `package.json`, `harnais.js` en plus).
- **Le code** (`wc -l`, 15/09/2026) : `src/renderer/app.js` 12 298 lignes, `src/renderer/core.js`
  6 534, `test/run-tests.js` 10 517, `src/cabinet/renderer/app.js` 2 901, `src/main.js` 2 271.
- **Les documents** : `QUESTIONS.md` 2 794 lignes (référence), `DIRECTION.md` 386, `PLAN-COMPTABLE.md`
  273, `CLAUDE.md` (règles apprises, version par version).

### Ce qui est en cours

- Rien n'est en chantier de code au 15/09/2026 : la 9.0.0 est publiée, les quatre relectures
  extérieures de `QUESTIONS.md` sont intégrées. **Le prochain geste de code est la 9.1.0.**
- En attente côté Skander : tout ce que la Partie D liste. Aucune démarche n'est commencée.

### Ce qui n'existe pas encore

- `src/renderer/compta.js` (le moteur partagé) : **n'existe pas** — `core.js` porte tout.
- Un canal bêta pour le Cabinet, un workflow « Construire un essai », une intégration continue
  (seul `.github/workflows/release.yml` existe), un lint (pas d'`.eslintrc`), un `.nvmrc`, un
  garde-fou d'erreur global dans les deux renderers, un journal borné.
- La signature du paquet par le client, le livre propre à chaque dossier, la saisie, la banque, le
  fiscal cabinet, la clôture d'exercice cabinet, la licence du Cabinet, les collaborateurs, la
  révision, la liasse — c'est-à-dire **tout le § 16**.
- Les douze paquets d'exemple ouvrables côté Cabinet (tâche en attente depuis la 8.7.0).
- L'export de la base de la plateforme, le pli scellé, « Libérer tous les clients… ».
- La page unique de présentation, les CGV, le dépôt de marque, les certificats, la déclaration INPDP,
  la lettre à l'Ordre.

### Les contraintes non négociables (`CLAUDE.md`, `DIRECTION.md`)

- Electron + JavaScript pur, **pas de bundler, pas de framework, aucune dépendance tierce dans
  l'application** (Electron et electron-builder seulement). Stockage en fichiers JSON à écriture
  atomique, pas de base de données. Hors-ligne : aucune fonction ne dépend d'un serveur.
- Le Cabinet **n'écrit jamais** chez le client. Le paquet est un ZIP ordinaire, lisible sans SkanFact.
- **Aucun taux fiscal en dur** ; tout ce qu'on ne sait pas vaut « À VÉRIFIER », et la valeur par
  défaut d'une règle inconnue est celle qui ne fait rien (`QUESTIONS.md` § 19, règle 36).
- La clé publique `master` de `build/licences-publiques.json` ne se supprime, ne se régénère et ne
  se remplace jamais. La clé privée ne traverse jamais le pont ni le dépôt.
- Jamais de données en otage : une licence expirée ne ferme que la création.
- Chaque amélioration livrée = une version semver + une entrée `CHANGELOG.md` ; `npm test` avant
  tout commit ; les e2e relancés après toute refonte ; un test se prouve en réintroduisant le défaut.
- Le rythme de publication est une ressource : on regroupe et on publie par lot.

### Les jalons de décision

*C'est la sous-section qui manquait au projet. Un jalon est un **chiffre** ; un chiffre qui manque
change l'ordre du travail, pas seulement l'humeur (`QUESTIONS.md` § 3, « Les jalons de décision »,
et § 19 règle 42). Les seuils ci-dessous sont des propositions : **à Skander**. Qu'il y en ait est
décidé. Les trois nombres se comptent à la main, une fois par mois : démonstrations faites, essais
démarrés (la plateforme les voit une fois en production), licences vendues.*

| Jalon | Date | Ce qui doit être vrai | Si ce n'est pas vrai |
|---|---|---|---|
| **J0** | 15/10/2026 | La marque déposée, le certificat Apple acheté, `contact@skanfact.tn` qui répond (le premier essai finit le 14/10), la question posée à l'Ordre, la question orale au pilote posée. | Rien de codé ne rapporte un dinar : la 9.2.0 ne commence pas tant que J0 n'est pas atteint, même si la 9.1.0 est finie. |
| **J1** | 31/12/2026 | Les six démarches de la Partie D faites (attentes comprises ou en cours) ; le pilote engagé **par écrit** sur deux dossiers réels ; **≥ 3 licences Entreprise vendues** hors famille ; 9.1.x et 9.2.0 publiées en stable. | Les trois licences manquent → la 9.3.0 attend ; le trimestre suivant est un trimestre de **démonstrations** (dix, comptées), pas de code. |
| **J2** | 30/06/2027 | **≥ 10 licences Entreprise** ; le pilote tient ses dossiers dans le Cabinet **sans revenir à son ancien logiciel** ; une réponse de l'Ordre ou, à défaut, celle d'un juriste ; 9.3.0 → 9.5.0 publiées. | Le pilote est revenu à son ancien logiciel → on **arrête le Cabinet à la 9.5.0** et on demande pourquoi avant d'écrire la 9.5.0. L'Ordre a dit non → plan B de prix (`QUESTIONS.md` § 17), le code ne change pas. |
| **J3** | 31/12/2027 | Un **second cabinet** qui a commencé, même sur un dossier ; **≥ 25 licences Entreprise** ; un chiffre d'affaires qui couvre les coûts fixes ; 9.6.0 → 9.8.0 publiées. | Pas de second cabinet → le Cabinet reste un produit pour un seul cabinet : 9.7.0 → 10.0.0 ne se justifient plus, on livre ce que le pilote demande et rien d'autre. |
| **J4** | 30/06/2028 | 9.7.0 → 10.0.0 publiées ; ≥ 3 cabinets ; ≥ 50 licences. | On tient l'existant et on repose la question du § 3 : « combien de temps sans revenus ». |

**La règle d'arrêt, valable à tout jalon** : si **aucune** licence n'a été vendue depuis le jalon
précédent, le trimestre suivant ne contient **pas de version nouvelle** — quelle que soit la raison.
La cause se cherche pendant le trimestre de vente, pas avant.

---

## Partie B — Le plan d'exécution, phase par phase

*Les durées sont en jours de travail effectif de Claude (construction + tests + documents), hors
attentes. `QUESTIONS.md` § 16 dit lui-même : « compter le double est prudent ». Les deux chiffres sont
donnés : **construction** (le § 16) et **réaliste** (× 2, qui absorbe les retours du pilote, les
correctifs, les relances d'e2e et le temps de relecture de Skander).*

### Phase 0 — Débloquer la vente

| Champ | Contenu |
|---|---|
| **Objectif** | Qu'une première vente soit **possible** : un installateur qu'un expert-comptable accepte d'ouvrir, un nom qu'on ne peut pas perdre, un cadre légal, une page à montrer. |
| **Versions concernées** | Aucune. Cette phase n'est pas du code (sauf l'export de la base, une heure). |
| **Durée estimée** | **≈ 6 jours de travail réel de Skander**, étalés sur 8 semaines d'attentes (Partie D). |
| **Dépendances** | Rien. C'est la seule phase qui ne dépend de personne d'autre que Skander. |
| **Propriétaire** | Skander (tout), Claude (la page unique en brouillon, l'export de la base, la page SmartScreen). |
| **Livrables** | ☐ Marque déposée à l'INNORPI · ☐ Certificat Apple acheté et la signature branchée dans `release.yml` (`MAC_SIGNED = true`) · ☐ Décision certificat Windows (OV maintenant / EV plus tard) et page « SmartScreen » sur le site · ☐ Déclaration INPDP déposée · ☐ CGV : premier jet Skander, relecture juriste · ☐ Lettre à l'Ordre envoyée (trois phrases) · ☐ Question orale au pilote posée, réponse notée · ☐ Séance de validation fiscale avec le comptable programmée · ☐ Bouton de téléchargement du Cabinet réparé sur le site · ☐ Page unique écrite (problème, solution, pour qui, combien, pourquoi nous) · ☐ `contact@skanfact.tn` vérifié (un mail envoyé, un mail reçu) · ☐ Export de la base de la plateforme (`GET /v1/admin/export` + « Sauvegarder la console… ») · ☐ Pli scellé constitué (Partie D) · ☐ Le fichier des trois nombres mensuels créé, avec la première ligne. |
| **Critères d'acceptation** | Un `.dmg` téléchargé depuis la release s'ouvre sur un Mac neuf **sans clic droit → Ouvrir** ; l'accusé de dépôt INNORPI et l'accusé INPDP existent ; la lettre à l'Ordre a une date d'envoi ; le pilote a dit oui ou non à voix haute ; la page unique tient sur une page A4 ; `~/.skanfact/` contient un export daté de la console. |
| **Risques** | Skander préfère coder — c'est ce qu'il sait faire, et le risque n° 1 de tout le plan. Parade : cette phase est **la première ligne du tableau de bord**, et J0 la mesure à un mois. Le certificat EV Windows peut coûter et compliquer (support matériel) : on signe Mac d'abord, Windows en OV, EV quand ça vend. |
| **Jalon de sortie** | **J0**, reporté à la phase d'essai par décision de Skander le 16/09/2026 (voir ci-dessous). Le développement n'attend plus J0. |

> **Décision de Skander, 16/09/2026 : la Phase 0 est reportée à la phase d'essai du projet**, une
> fois le développement complet terminé. Le code n'attend donc plus rien : 9.1.0 → 10.0.0
> s'enchaînent, et les démarches se font pendant la période d'essai, avant la première vente.
>
> **Ce que ce report coûte, écrit une fois pour qu'il ne se redécouvre pas plus tard.** Les six
> démarches ne coûtent qu'une semaine de travail, mais elles portent des **attentes** de plusieurs
> semaines qu'on ne peut pas comprimer : l'INNORPI, l'INPDP, le juriste, le certificat Windows. Les
> lancer en phase d'essai revient donc à ajouter ces attentes **à la fin**, pas à les supprimer.
> Une seule porte un risque qu'on ne rattrape pas : **le dépôt de la marque**. Tant qu'il n'est pas
> fait, le nom n'appartient à personne, et un dépôt par un tiers pendant ces mois se paie en
> changement de nom — après la construction, pas avant. Le reste (certificats, INPDP, conditions de
> vente, lettre à l'Ordre, page unique) se rattrape sans rien perdre.
>
> **Ce qui reste vrai malgré le report** : `contact@skanfact.tn` doit répondre avant le 14/10/2026,
> parce que c'est la fin du premier essai de trente jours et que l'application y envoie déjà les
> gens. Ce n'est pas une démarche, c'est une boîte mail à vérifier.

### Phase 1 — Les livres lus, et l'outillage

| Champ | Contenu |
|---|---|
| **Objectif** | Que le pilote **voie une comptabilité** dans le Cabinet (livre-journal, grand livre, balance, lettrage lus dans les paquets), et que le projet ait enfin l'outillage d'un logiciel vendu (CI, lint, bêta cabinet, essai installable, garde-fou d'erreur, journal borné). |
| **Versions concernées** | **9.1.0**, **9.1.1** (`QUESTIONS.md` § 16). |
| **Durée estimée** | Construction : 9.1.0 ≈ 8 j (outillage 4, livres 3, `compta.js` 1), 9.1.1 ≈ 2 j. **Réaliste : 20 j.** |
| **Dépendances** | Aucune pour la 9.1.0 (« n'attend personne »). La 9.1.1 attend **une** chose : la séance de validation fiscale avec le comptable (seuil de retenue, exonération de timbre, TFP par métier, e-facture). |
| **Propriétaire** | Claude (code), Skander (essai de la 9.1.0 à côté de sa vraie application, puis bêta chez le pilote), le pilote (regarde les quatre onglets sur un vrai paquet). |
| **Livrables** | ☐ Outillage **construit en premier** : canal `cabinet-beta`, workflow « Construire un essai », CI Linux + Windows (`npm test` + lint à chaque push), lint, `window.onerror`/`unhandledrejection` dans les deux renderers, `main.log` borné, index thématique de `CLAUDE.md` · ☐ `src/renderer/compta.js` extrait de `core.js`, réexporté, appelants inchangés · ☐ Cabinet : bloc « Comptabilité » à quatre onglets lus dans les paquets, mois manquant annoncé, export CSV · ☐ Entreprise : module `compta` masqué par défaut, option `compta` dans la clé, porte unique `optionBlock`, essai qui l'inclut · ☐ **La clé de secours réclamée au premier import** · ☐ **Le test de charge** (50 000 écritures ; seuils : ouverture < 1 s, écriture < 100 ms, balance de 60 dossiers < 5 s, recherche < 3 s — `QUESTIONS.md` § 5) · ☐ Test de parité (même balance au millime, entreprise vs Cabinet) · ☐ 9.1.1 : exonération de timbre sur la fiche client, TFP proposée par métier, seuil de retenue réglable **par défaut 0**, contrôle d'une heure sur l'e-facture · ☐ Bêta 9.1.0 chez le pilote, puis stable. |
| **Critères d'acceptation** | `npm test` vert **sur la CI**, Linux et Windows ; e2e `cabinet-livres` et `boucle` verts ; le pilote a ouvert les quatre onglets sur un de **ses** paquets et a dit ce qui manque (par écrit, rangé dans le dépôt) ; le test de charge a ses quatre mesures **sous** les seuils, ou la décision « index à côté des livres » est prise avant d'écrire la 9.2.0 ; `e2e:entreprise` relu avec le module masqué ; un test par règle de la 9.1.1, chacun prouvé en réintroduisant le défaut. |
| **Risques** | L'outillage déborde (une CI Windows qui refuse de passer peut manger une semaine) : on borne à quatre jours, le reste va en 9.3.1. Le pilote ne répond pas à la bêta : on lui montre en personne, une heure, chez lui. Le test de charge échoue : c'est le résultat **utile** — on change le modèle maintenant, pas en 9.3.0. |
| **Jalon de sortie** | Le test de charge décide du format de la 9.2.0. **J0 n'est plus une porte** (décision du 16/09/2026) : la Phase 2 enchaîne. |

### Phase 2 — Le livre du dossier

| Champ | Contenu |
|---|---|
| **Objectif** | Que chaque dossier du Cabinet ait **son livre** (exercices, plan SCE complet, journaux), que l'import d'un paquet crée des **écritures**, qu'un dossier venu d'ailleurs se reprenne par balance d'ouverture — et que **le paquet soit signé par le client**. |
| **Versions concernées** | **9.2.0** (`QUESTIONS.md` § 16 ; signature remontée de la 9.10.0 le 15/09/2026, § 6). |
| **Durée estimée** | Construction : 5 à 10 j. **Réaliste : 20 j.** |
| **Dépendances** | Le test de charge de la Phase 1 réussi (ou le modèle changé) ; **le plan de comptes du comptable et son logiciel actuel** (format de la balance d'ouverture) ; **J0** atteint ; l'engagement écrit du pilote (il a vu la 9.1.0). |
| **Propriétaire** | Claude (code), le pilote (plan de comptes, un export de balance de son logiciel), Skander (bêta). |
| **Livrables** | ☐ `livre.json` par dossier et par exercice, migration sans perte · ☐ Plan SCE complet, modifiable, import CSV · ☐ Import du paquet EN écritures (source `skanfact`, validées si définitif, brouillard sinon), paquets déjà reçus relus une fois · ☐ Mois renvoyé : brouillards remplacés, validées avec écart · ☐ Balance d'ouverture saisie ou importée · ☐ Les quatre onglets lisent le livre · ☐ Pièces absentes affichées à côté des écritures · ☐ Sauvegardes, copie externe, clé de secours, déménagement emportent les livres · ☐ **Signature du manifeste par le client, clé épinglée au dossier au premier paquet, « origine non prouvée » sur un paquet non signé, refus dès qu'un dossier a reçu un paquet signé** (§ 6, règle 43) · ☐ Entreprise : licence et mention d'essai dans le manifeste, numéro de format qui monte, « Cabinet trop ancien » dit. |
| **Critères d'acceptation** | Parité maintenue ; e2e : reprise par balance, import de douze paquets, mois renvoyé, `refus` avec paquet au nouveau format, **deux cas d'imposture** (signé par une autre clé → refusé en nommant le dossier ; non signé → accepté et marqué) ; e2e `perte` et `demenagement` rejoués avec des livres ; le test de charge rejoué sur le format réellement écrit ; le pilote a repris **un de ses dossiers réels** par balance d'ouverture et retrouve sa balance au millime. |
| **Risques** | Le plan de comptes du pilote n'arrive pas : on démarre avec le SCE de référence et on l'écrase à l'arrivée (le plan est modifiable, c'est fait pour). Le format d'export de son logiciel est exotique : on lit par NOM de colonne, jamais par position (règle 6.8.0), et on accepte de mapper à la main la première fois. |
| **Jalon de sortie** | **J1** (31/12/2026) : trois licences, le pilote par écrit. Sans les licences, la Phase 3 attend un trimestre de vente. |

### Phase 3 — La saisie, et la licence du Cabinet

| Champ | Contenu |
|---|---|
| **Objectif** | Que le comptable **travaille dans le Cabinet** (saisie au kilomètre, brouillard/validation, guides, abonnements, piste d'audit), et que le Cabinet sache **compter ses dossiers** et porter sa licence. Puis une version d'entretien. |
| **Versions concernées** | **9.3.0**, **9.4.0 + P 0.3** (licence du Cabinet), **9.4.10** (entretien). |
| **Durée estimée** | Construction : 9.3.0 ≈ 10 j, licence ≈ 5 j, 9.4.10 ≈ 3 j. **Réaliste : 36 j.** |
| **Dépendances** | **J1** atteint ; le pilote **regardé en train de saisir** dans son logiciel actuel (une heure chez lui — c'est la dépendance qui décide de l'écran) ; pour la licence : la question à l'Ordre **posée** (pas répondue : on construit, on ne vend pas). |
| **Propriétaire** | Claude (code), Skander (observe le pilote, prend des notes ; bêta), le pilote. |
| **Livrables** | ☐ Saisie au kilomètre tout au clavier, recherche de compte pendant la frappe, guides, abonnements · ☐ Brouillard puis validation **irréversible**, contre-passation, extourne · ☐ Piste d'audit (qui, quoi, quand) · ☐ Licence du Cabinet : clé portée par l'empreinte, quota, comptage (actif + écriture validée < 12 mois + sans licence client valide ; grâce de 12 mois **après une licence payée seulement**, règle 44), garde-fou qui nomme les dossiers comptés, écran, console, `e2e:cabinet-licence` · ☐ **9.4.10** : Electron du semestre, les 93 déclarations CSS physiques converties en logiques, premier découpage de `app.js` par route, dette du § 15, retours de bêta hors nouveautés, **tous** les e2e relancés. |
| **Critères d'acceptation** | e2e : mille écritures saisies au clavier sans souris ; une validée refusée à la modification ; le compteur de dossiers juste sur un portefeuille de démonstration à quatre situations (SkanFact valide, essai, grâce, hors) ; le doute profite au cabinet (licence illisible = valide) ; le pilote a saisi **une journée réelle** dans le Cabinet et n'a pas rouvert son ancien logiciel pour la finir. |
| **Risques** | La saisie est l'écran où un comptable passe ses journées : un écran « correct » qu'il trouve lent est un échec. Parade : mesurer la frappe (< 100 ms) et le regarder faire **avant** d'écrire. La licence du Cabinet touche à l'argent : relecture adversariale complète obligatoire (règle 24). |
| **Jalon de sortie** | Décision : le pilote continue-t-il dans le Cabinet ? Si non, on n'écrit pas la Phase 4 avant de savoir pourquoi. |

### Phase 4 — La banque

| Champ | Contenu |
|---|---|
| **Objectif** | Import de relevés, rapprochement automatique avec **niveaux de confiance**, lettrage automatique, balance âgée. |
| **Versions concernées** | **9.5.0**. |
| **Durée estimée** | Construction : 10 j. **Réaliste : 20 j.** |
| **Dépendances** | **Les formats de relevés** des banques des clients du pilote (un fichier réel de chaque banque, anonymisé) ; la Phase 3 utilisée. |
| **Propriétaire** | Claude, le pilote (les fichiers de relevé). |
| **Livrables** | ☐ Lecteurs de relevés (CSV/Excel des banques tunisiennes rencontrées — **À VÉRIFIER lesquelles**, aucun format n'est écrit en dur avant d'avoir vu le fichier) · ☐ Rapprochement automatique avec quatre niveaux (certain / probable / à confirmer / aucun), jamais validé seul s'il est ambigu (règle 32) · ☐ Lettrage automatique · ☐ Balance âgée. |
| **Critères d'acceptation** | Un relevé réel de trois mois rapproché à ≥ 90 % en « certain » sur le dossier du pilote, le reste proposé et **jamais** validé tout seul ; test : un rapprochement ambigu reste ouvert. |
| **Risques** | Les banques changent leurs exports sans prévenir : le lecteur associe par nom de colonne et **dit** ce qu'il n'a pas reconnu, il ne devine pas. |
| **Jalon de sortie** | **J2** (30/06/2027) : dix licences, le pilote qui ne revient pas en arrière, l'Ordre ou le juriste. |

### Phase 5 — Le fiscal mensuel

| Champ | Contenu |
|---|---|
| **Objectif** | La déclaration mensuelle tunisienne préparée depuis le livre du dossier (TVA, retenues, TFP/FOPROLOS, TCL — **À VÉRIFIER le périmètre exact avec le pilote**), avec les contrôles avant dépôt. Puis entretien. |
| **Versions concernées** | **9.6.0**, **9.6.1** (entretien). |
| **Durée estimée** | Construction : 5 à 10 j + 3 j. **Réaliste : 26 j.** |
| **Dépendances** | **Le modèle de déclaration** que le pilote dépose réellement (un exemplaire rempli). |
| **Propriétaire** | Claude, le pilote. |
| **Livrables** | ☐ Déclaration mensuelle par dossier, chaque case tracée jusqu'aux écritures qui la font · ☐ Contrôles avant dépôt (4366 = report de `vatChain`, comptes d'attente, brouillard restant) · ☐ « Marquer déposée » = pense-bête, jamais un dépôt (règle 5.2.0) · ☐ 9.6.1 : `core.js` → `compta.js` fini, `run-tests.js` découpé par domaine, Electron si sortie. |
| **Critères d'acceptation** | La déclaration d'un mois réel du pilote, calculée par le Cabinet, **égale celle qu'il a déposée** — ou l'écart est expliqué ligne par ligne. |
| **Risques** | Une case de déclaration dont on ne connaît pas la règle : on la laisse **vide avec « À VÉRIFIER »**, jamais une valeur plausible (règle 36). |
| **Jalon de sortie** | Le pilote dépose-t-il depuis le Cabinet ? |

### Phase 6 — Immobilisations et stocks

| Champ | Contenu |
|---|---|
| **Objectif** | Amortissement dégressif, sortie, stocks valorisés, côté cabinet. |
| **Versions concernées** | **9.7.0**. |
| **Durée estimée** | Construction : 5 j. **Réaliste : 10 j.** |
| **Dépendances** | Rien de nouveau : le moteur linéaire, la cession et le coût moyen pondéré existent déjà côté entreprise (3.5.0, 4.0.0). |
| **Propriétaire** | Claude. |
| **Livrables** | ☐ Dégressif (taux **réglables**, aucun coefficient en dur) · ☐ Tableau d'amortissement et VNC par dossier · ☐ Stocks et variation de stocks en inventaire. |
| **Critères d'acceptation** | La dernière annuité absorbe les arrondis (règle 3.5.0) ; le 28 d'un bien cédé repris en entier ; sur un mois on amortit un mois. |
| **Risques** | Faible : c'est du portage d'un moteur testé. Le risque est de le **recopier** au lieu de le partager par `compta.js`. |
| **Jalon de sortie** | Aucun : phase courte, elle enchaîne sur la clôture — qui a besoin de ses fiches de biens. |

### Phase 7 — La clôture d'exercice

| Champ | Contenu |
|---|---|
| **Objectif** | Écritures d'inventaire guidées, contrôles, clôture définitive, à-nouveaux, états financiers SCE, N/N-1 — et **le flux retour `.skanclose`** vers le client. |
| **Versions concernées** | **9.8.0**. |
| **Durée estimée** | Construction : 10 à 15 j. **Réaliste : 30 j.** |
| **Dépendances** | La présentation exacte des états (NCT 01) et des notes ; **un exercice complet du pilote dans le Cabinet** (donc la Phase 3 utilisée depuis au moins un exercice, ou une reprise). |
| **Propriétaire** | Claude, le pilote. |
| **Livrables** | ☐ Inventaire guidé avec extourne · ☐ Contrôles de clôture (jamais bloquants, règle 6.0.0) · ☐ Clôture définitive tracée, réouverture avec motif · ☐ À-nouveaux explicites (jamais comptés deux fois, règle 9.0.0) · ☐ États SCE, N/N-1, SIG, PDF · ☐ `.skanclose` chiffré pour le client, avec PDF lisible par tous ; **le cabinet clôture même si le client n'est pas à jour** (règle 48) · ☐ Entreprise : réception, exercice verrouillé, écritures du comptable en lecture. |
| **Critères d'acceptation** | Actif = passif, résultat identique des deux côtés, à-nouveau = soldes du 31/12 ; **e2e du flux retour : le cabinet clôture, le client importe, les deux bilans sont identiques au millime** ; une clôture refusée puis acceptée, la réouverture impossible sans motif. |
| **Risques** | La liasse n'est pas la clôture : cette phase produit des états **déduits de la balance**, et la page l'écrit. Confondre les deux ferait promettre ce que la Phase 10 seule livre — depuis la 10.0.0, l'écran de clôture mène à la liasse par un bouton plutôt que de faire croire qu'il la produit. |
| **Jalon de sortie** | **J3** (31/12/2027) : un second cabinet a commencé, vingt-cinq licences. Sans second cabinet, les Phases 7 à 10 ne se justifient plus. |

### Phase 8 — Le cabinet à plusieurs

| Champ | Contenu |
|---|---|
| **Objectif** | Collaborateurs, droits, multi-poste sans écrasement, verrouillage, tableau de production. Puis entretien. |
| **Versions concernées** | **9.9.0**, **9.9.1** (entretien, relecture complète de `CLAUDE.md`). |
| **Durée estimée** | Construction : 10 j + 3 j. **Réaliste : 26 j.** |
| **Dépendances** | **Un cabinet de plus d'une personne** qui l'utilise — sinon on construit du multi-poste pour un poste. C'est la Phase qui attend le plus J3. |
| **Propriétaire** | Claude, le pilote (ou le second cabinet). |
| **Livrables** | ☐ Comptes collaborateurs et rôles · ☐ Un fichier par dossier et par exercice partagé sans silence (le mécanisme de la 3.2.0, porté : révision, conflit dit, jamais fusionné en une troisième version) · ☐ Verrouillage d'un dossier ouvert ailleurs · ☐ Tableau de production. |
| **Critères d'acceptation** | e2e : deux postes, deux collaborateurs, une écriture validée par l'un n'est jamais perdue par l'autre ; un conflit sur un brouillard est **montré**, pas résolu en silence. |
| **Risques** | Le danger du partage n'est pas la panne, c'est le silence (règle 3.2.0). Une écriture validée ne se fusionne jamais : elle existe ou pas. |
| **Jalon de sortie** | Le second cabinet utilise-t-il le multi-poste ? |

### Phase 9 — La révision et les questions

| Champ | Contenu |
|---|---|
| **Objectif** | Dossier de révision par exercice, points en suspens, **questions au client chiffrées (`.skanask`)** affichées sur la pièce, réponse, mois révisé. |
| **Versions concernées** | **9.10.0**. |
| **Durée estimée** | Construction : 10 j. **Réaliste : 20 j.** |
| **Dépendances** | La méthode de révision du pilote (cycles, feuilles). La clé du client existe depuis la 9.2.0 (c'est celle de la signature). |
| **Propriétaire** | Claude, le pilote. |
| **Livrables** | ☐ Feuilles maîtresses par cycle, comptes revus et signés, notes · ☐ Question depuis la ligne → `.skanask` scellé pour le client · ☐ Entreprise : la question sur la pièce, réponse, pièce jointe, mois révisé renvoyé. |
| **Critères d'acceptation** | e2e `boucle` étendu : une question part, arrive sur la pièce, la réponse revient dans un mois révisé. |
| **Risques** | Un dossier de travail imposé par un logiciel ne sert à personne (PLAN-COMPTABLE) : on part de **sa** méthode. |
| **Jalon de sortie** | Enchaîne sur la 10. |

### Phase 10 — La liasse et l'annuel

| Champ | Contenu |
|---|---|
| **Objectif** | La liasse, les déclarations annuelles, le jeu d'exemple complet du Cabinet (**avec de vrais paquets ouvrables**), le site et l'aide à jour. |
| **Versions concernées** | **10.0.0**. |
| **Durée estimée** | Construction : 10 j. **Réaliste : 20 j.** |
| **Dépendances** | La liasse de l'année, remplie par le pilote ; ≥ 3 cabinets (**J4**), sinon cette phase n'a pas de lecteur. |
| **Propriétaire** | Claude, le pilote, Skander (site). |
| **Livrables** | ☐ Liasse · ☐ Déclarations annuelles (employeur, IS — **À VÉRIFIER le périmètre**) · ☐ Jeu d'exemple : douze paquets réels générés depuis `demo.js` + `packPlan`, ouvrables · ☐ Site et aide. |
| **Critères d'acceptation** | La liasse du pilote pour un exercice réel, produite par le Cabinet, **acceptée telle quelle** ou avec des écarts expliqués. |
| **Risques** | La liasse est le document où une erreur coûte le plus cher : relecture adversariale complète et validation du pilote **avant** publication. |
| **Jalon de sortie** | **J4** (30/06/2028). Après : entretien, et la question du § 3 reposée. |

---

## Partie C — Le chemin critique

*Ce qui bloque quoi. Une flèche se lit « sans A, pas de B ».*

```
Certificat Apple (1 jour) ──► première installation acceptée ──► première VENTE ──┐
Marque INNORPI (1 jour) ───► un nom qu'on garde ─────────────────────────────────┤
CGV + INPDP (4 jours) ─────► une facture légale ─────────────────────────────────┼──► J0, J1
Page unique (1 jour) ──────► une démonstration qui se termine par un lien ───────┤
Bouton Cabinet 404 ────────► un cabinet peut essayer ────────────────────────────┘

Question orale au pilote (1 appel) ──► 9.1.0 construite pour quelqu'un
        │
        └──► 9.1.0 montrée ──► engagement ÉCRIT ──► 9.2.0 ──► 9.3.0 (il saisit) ──► J2

Test de charge (Phase 1) ──► format du livre ──► 9.2.0 (sinon : réécriture après coup)

Séance fiscale avec le comptable (½ jour) ──► 9.1.1 entière (quatre corrections)

Lettre à l'Ordre (1 heure, réponse : des mois) ──► PRIX public du Cabinet ──► vente Cabinet
        (ne bloque PAS le développement : 9.2.0 → 9.8.0 se construisent pendant l'attente)

Signature du paquet (9.2.0) ──► un manifeste auquel on peut croire ──► licence et essai
        dans le manifeste fiables ──► comptage des dossiers (9.4.0) ──► facturation du Cabinet

Second cabinet (J3) ──► 9.9.0 (multi-poste) a un utilisateur ──► 9.10.0, 10.0.0 ont un lecteur

Trois nombres par mois (Skander, 10 min) ──► chaque jalon est jugeable ──► la règle d'arrêt existe
```

### Les cinq goulots, et ce qui les débloque le plus vite

| # | Goulot | Ce qu'il bloque | La tâche qui débloque le plus vite |
|---|---|---|---|
| 1 | **L'installateur non signé.** Un expert-comptable ne clique pas sur « Exécuter quand même » (`QUESTIONS.md` § 9). | Toute vente, toute démonstration chez un cabinet, J0 et J1. | **Acheter le certificat Apple** : une demi-journée, immédiat, 99 $/an environ (À VÉRIFIER le prix du jour). Windows en OV la semaine suivante. |
| 2 | **Le pilote n'a pas dit oui.** Tout le § 16 repose sur lui, et il n'a jamais été sollicité explicitement (§ 17). | 9.1.0 construite dans le vide ; 9.2.0 → 9.3.0 sans utilisateur ; J1, J2. | **Un appel téléphonique cette semaine** : « si je te montre tes livres dans quelques semaines, tu essaies sur deux dossiers ? ». Réponse de dix secondes. L'écrit vient après la 9.1.0. |
| 3 | **Zéro client, et aucune règle qui en tire les conséquences** (avant ce plan). | Le risque de neuf versions pour un musée. | **Le fichier des trois nombres**, tenu dès ce mois, et J0 dans un mois. Ça ne code rien ; ça rend la règle d'arrêt applicable. |
| 4 | **Le format du livre du Cabinet**, jamais mesuré. Écrit en 9.2.0, il est figé pour tout ce qui suit. | 9.2.0 → 10.0.0 : tout repose dessus ; une erreur ici se paie en réécriture. | **Le test de charge en Phase 1**, seuils écrits (§ 5). Deux jours, avant d'écrire une ligne de la 9.2.0. |
| 5 | **La réponse de l'Ordre**, qui met des mois. | Le prix public du Cabinet, la première vente à un cabinet — **pas** le développement. | **Envoyer la lettre cette semaine**, trois phrases. Un juriste en parallèle, sans attendre l'un pour l'autre. Plan B écrit (§ 17). |

---

## Partie D — Les tâches non-code qui bloquent la vente

*Sous-estimées dans tous les documents jusqu'au 15/09/2026. Total : **≈ 6 jours de travail réel**,
étalés sur des semaines d'attente — c'est pourquoi tout se lance maintenant, en parallèle. Les coûts
sont des ordres de grandeur **À VÉRIFIER** : aucun n'a été relevé auprès d'un fournisseur.*

| Tâche | Durée réelle | Attente | Coût (À VÉRIFIER) | Dépend de | Qui | Ce qu'elle bloque |
|---|---|---|---|---|---|---|
| **Dépôt de la marque « SkanFact » à l'INNORPI** | 1 jour (classes, formulaire, paiement) | quelques semaines à des mois pour l'enregistrement ; la **date de dépôt** protège dès le jour même | quelques centaines de DT | rien | Skander | Tout : un nom qu'on ne peut pas perdre. Le retard coûte un renommage complet (deux apps, site, domaine, mails, clients). |
| **Certificat Apple (signature + notarisation)** | ½ jour (compte développeur, `MAC_SIGNED = true`, secrets dans `release.yml`, un build vérifié) | immédiat à 48 h (validation du compte) | ≈ 99 $/an | rien | Skander (achat), Claude (workflow) | La première installation Mac sans avertissement → la première démonstration, la première vente. |
| **Certificat Windows** | 1 jour + support matériel (EV) | 1 à 2 semaines | OV : de l'ordre de 100–200 €/an ; EV : plusieurs centaines €/an + clé matérielle | la décision OV/EV (Partie F) | Skander | L'installation chez un cabinet sous Windows. OV ne lève SmartScreen qu'avec la réputation ; EV tout de suite. En attendant : une page « SmartScreen » avec capture sur le site (Claude, 1 h). |
| **Déclaration INPDP** | 2 jours (formulaire, description des données : empreintes, identifiants de poste, contacts) | quelques semaines | gratuit (À VÉRIFIER) | rien | Skander | La **mise en production** de la plateforme (qui est construite, testée, pas en prod). Sans elle, pas d'activation, pas de console qui vend. |
| **Conditions générales de vente** | 2 jours (premier jet Skander, à partir de `QUESTIONS.md` § 9 : droit d'usage par matricule, expiration sans données en otage, remboursement, support, responsabilité, confidentialité) | selon le juriste | honoraires d'une relecture | rien | Skander, puis un juriste | La page Tarifs, la première facture. Et c'est la seule protection réelle contre « une erreur de calcul chez un client » (§ 17). |
| **Lettre à l'Ordre des experts-comptables** | 1 heure (trois phrases : ce qu'on offre, à qui, contre quoi ; la question : est-ce une rémunération indirecte ?) | des mois, peut-être jamais | 0 | rien | Skander | La **publication d'un prix** Cabinet et la première vente à un cabinet. **Pas** le développement. Un juriste en déontologie comptable en parallèle. |
| **Séance de validation fiscale avec le comptable** | ½ jour, un rendez-vous | un rendez-vous | 0 (ou une heure facturée) | rien | Skander + le pilote | **La 9.1.1 entière** : seuil de retenue, exonération de timbre, TFP par métier, e-facture. Plus les « À VÉRIFIER » de `CLAUDE.md` (assiette de la retenue, avoir sans timbre, régimes). |
| **Réparer le bouton de téléchargement du Cabinet (404)** | 1 heure | aucune | 0 | accès au dépôt `skanfact-site` | Skander (ou Claude si le dépôt est ajouté à la session) | Un cabinet qui veut essayer ne peut pas. Avant toute démonstration. |
| **Page unique de présentation** | 1 jour (brouillon Claude, 1 h ; relecture et chiffres Skander) | aucune | 0 | rien | Claude puis Skander | La première démonstration : c'est ce qu'un prospect lit, personne ne lira `QUESTIONS.md`. Si elle ne s'écrit pas en une page, le positionnement n'est pas clair. |
| **Export de la base de la plateforme** | 2 heures (route `GET /v1/admin/export`, bouton « Sauvegarder la console… », « À faire » à 30 jours) | aucune | 0 | la plateforme en prod pour servir, mais se construit avant | Claude | La seule donnée du projet qui n'est pas chez Skander. Sans export, une perte chez Cloudflare = plus de révocation ni de renouvellement sans ressaisie. **Avant la première vente.** |
| **Pli scellé** | ½ jour (fichier scellé par le mécanisme de la clé de secours : clé maître, `srv-1`, secret d'administration, accès au dépôt, une page de marche à suivre ; clé USB **et** impression base64 ; fichier chez une personne, mot de passe chez une autre) | aucune | quelques dizaines de DT | choisir les deux personnes (Partie F) | Skander | La continuité : aujourd'hui **personne d'autre ne peut émettre une licence** si Skander est absent. Avant les dix premiers clients. Rejoué une fois par an. |
| **`contact@skanfact.tn` qui répond** | 10 minutes (un mail envoyé, un mail reçu) | aucune | déjà payé (OVH) | rien | Skander | Le premier essai finit le **14/10/2026** : un client en fin d'essai écrit à cette adresse. |
| **« Libérer tous les clients… »** | ½ jour | aucune | 0 | le pli scellé (c'est lui qui donne le droit d'appuyer) | Claude | La sortie propre si l'aventure s'arrête : des clés à vie en lot. Avant les dix premiers clients. |
| **Le fichier des trois nombres** | 10 min/mois | aucune | 0 | rien | Skander | Tous les jalons. Sans lui, aucun jalon n'est jugeable. |

---

## Partie E — Le tableau de bord des 26 premières semaines

*Du lundi 14/09/2026 au dimanche 14/03/2027. Deux colonnes de travail en parallèle : **Skander** (les
démarches, les ventes, les essais, la relecture) et **Claude** (le code). Le « livrable de la semaine »
est ce qu'on doit pouvoir montrer le vendredi. Au-delà de S26, le plan serait faux : il se réécrit à
J1 avec les chiffres réels.*

| Sem. | Dates | Phase | Skander | Claude | Livrable de la semaine | Bloqueur potentiel |
|---|---|---|---|---|---|---|
| S1 | 14–20/09 | 0 + 1 | Appel au pilote (question orale). Dépôt de la marque. Compte développeur Apple. Lettre à l'Ordre envoyée. Vérifier `contact@`. Créer le fichier des trois nombres. | Outillage 9.1.0 : CI Linux + Windows, lint, `.nvmrc`. | La marque déposée, la lettre partie, le pilote a répondu à voix haute, la CI verte. | Skander préfère coder. Le compte Apple peut demander 48 h de validation. |
| S2 | 21–27/09 | 0 + 1 | Certificat Apple en main → `MAC_SIGNED` avec Claude. Premier jet des CGV. Réparer le 404 du Cabinet. Programmer la séance fiscale. | Suite outillage : canal `cabinet-beta`, workflow « Construire un essai », garde-fou d'erreur global, journal borné. Brouillon de la page unique. | Un `.dmg` signé téléchargé s'ouvre sans avertissement ; les CGV en brouillon ; la page unique en brouillon. | Le workflow « essai » touche `release.yml` : à valider sur un run réel, sans consommer le quota pour rien. |
| S3 | 28/09–04/10 | 1 | Déclaration INPDP rédigée et déposée. Relire la page unique, la finir. Choisir les deux personnes du pli scellé. | `compta.js` extrait de `core.js`. Cabinet : les quatre onglets lus dans les paquets. | Les quatre onglets sur un vrai paquet (celui du jeu d'exemple entreprise, passé dans `packPlan`). | La déclaration INPDP peut demander des pièces (statuts, etc.). |
| S4 | 05–11/10 | 1 | Séance fiscale avec le comptable (les quatre points + les « À VÉRIFIER » de `CLAUDE.md`). Décision OV/EV Windows. Constituer le pli scellé. | Clé de secours au premier import. **Test de charge**, seuils écrits avant. Module `compta` masqué + `optionBlock` côté entreprise. | Les quatre mesures du test de charge, sous ou au-dessus des seuils. Le pli scellé chez ses deux personnes. Les réponses fiscales par écrit dans le dépôt. | Le comptable reporte : la 9.1.1 glisse, rien d'autre. Un seuil dépassé : décision « index » avant S6. |
| S5 | 12–18/10 | 1 | **J0 (15/10)** : marque, Apple, `contact@` (le premier essai finit le 14/10), Ordre, pilote. Compter les trois nombres. Commander le certificat Windows. | Test de parité. Export de la base de la plateforme. **Bêta 9.1.0** (canal `cabinet-beta`) chez le pilote. | **J0 atteint ou pas — et c'est écrit.** La 9.1.0 en bêta chez le pilote. | J0 manqué → la 9.2.0 n'ouvre pas en S6 ; on continue 9.1.1 et les démarches. |
| S6 | 19–25/10 | 1 | Montrer la 9.1.0 au pilote **en personne**, une heure, noter ce qu'il dit par écrit. Demander l'**engagement écrit** (deux lignes). Demander son plan de comptes et un export de balance de son logiciel. | **9.1.1** (les quatre corrections fiscales), un test par règle prouvé en réintroduisant le défaut. Retours de bêta 9.1.0. | 9.1.1 en bêta. Le compte rendu du pilote dans le dépôt. | Le pilote n'a pas eu le temps de regarder : on ne le relance pas par mail, on y va. |
| S7 | 26/10–01/11 | 1 → 2 | Publier **9.1.0 + 9.1.1 en stable** (une seule release, workflow_dispatch). Première démonstration à un prospect avec la page unique. | Stabilisation, `CLAUDE.md` à jour (index thématique). Début 9.2.0 : `livre.json` par dossier et par exercice, migration. | La 9.1.x stable publiée, run vert, release complète vérifiée. Une démonstration faite. | Le quota GitHub Actions si une release a dû être refaite : on regroupe, on ne republie pas pour un détail. |
| S8 | 02–08/11 | 2 | Deux démonstrations. Relire les CGV revenues du juriste. Relancer l'Ordre si silence (un mail). | 9.2.0 : plan SCE complet, journaux, import du paquet EN écritures, paquets déjà reçus relus. | Un paquet importé donne des écritures dans le livre du dossier. | Le plan de comptes du pilote n'est pas arrivé : on démarre avec le SCE de référence. |
| S9 | 09–15/11 | 2 | Deux démonstrations. Noter les objections entendues (prix, signature Windows, arabe…) dans un fichier. | 9.2.0 : balance d'ouverture saisie/importée (lecture par nom de colonne), mois renvoyé, pièces absentes affichées. | Un dossier du pilote repris par sa balance d'ouverture, au millime. | Le format d'export de son logiciel : à mapper à la main la première fois, sans deviner. |
| S10 | 16–22/11 | 2 | Compter les trois nombres. Premiers essais démarrés ? Les appeler. | **Signature du paquet** : clé du client, manifeste signé, épinglage, « origine non prouvée », refus après le premier signé. Deux e2e d'imposture. | Un paquet signé accepté, un paquet signé par une autre clé refusé en nommant le dossier. | Aucun : tout existe (Ed25519, clé d'appairage). |
| S11 | 23–29/11 | 2 | Relance des prospects vus en S7–S9. | 9.2.0 : licence et essai dans le manifeste, numéro de format, « Cabinet trop ancien ». `perte` et `demenagement` rejoués avec des livres. Test de charge rejoué sur le format réel. | Tous les e2e du Cabinet verts sur le nouveau format. | Un e2e ancien qui visait un écran disparu : on le relit avant de crier à la régression (règle 7.28.0). |
| S12 | 30/11–06/12 | 2 | **Bêta 9.2.0** chez le pilote, sur son dossier réel repris. Une heure chez lui. | Relecture adversariale de la 9.2.0 (signature = sécurité : relecture complète). Retours de bêta. | Le pilote a son dossier dans le Cabinet et retrouve sa balance. | Un écart au millime sur sa balance : c'est le livrable, pas un défaut — on l'explique ligne par ligne. |
| S13 | 07–13/12 | 2 | Deux démonstrations. Le certificat Windows en main → signature Windows dans `release.yml`. | Publier **9.2.0 stable**. `CLAUDE.md` à jour. | La 9.2.0 publiée, signée Mac et Windows. | Le certificat Windows en retard : on publie signé Mac, avec la page SmartScreen. |
| S14 | 14–20/12 | — | Compter les trois nombres. Préparer J1 : combien de licences vendues hors famille ? | Semaine tampon : la dette accumulée (les retours de bêta hors nouveautés), pas de version. | Un état écrit des trois nombres et de l'engagement du pilote. | Aucun. |
| S15 | 21–27/12 | **J1** | **J1 (31/12) : trois licences, le pilote par écrit, les six démarches faites ou en cours.** Décision écrite dans ce fichier. | Si J1 atteint : préparer la 9.3.0 (observer le pilote saisir — Skander y va). Sinon : rien de nouveau. | **La décision J1, écrite.** | J1 manqué → **le trimestre suivant vend**, il ne construit pas : S16–S26 deviennent un tableau de dix démonstrations. |
| S16 | 28/12–03/01 | 3 (si J1) | Regarder le pilote **saisir une journée** dans son logiciel actuel ; noter chaque raccourci qu'il utilise. | 9.3.0 : saisie au kilomètre, tout clavier, recherche de compte pendant la frappe. Frappe mesurée < 100 ms. | Une écriture saisie sans souris dans le Cabinet. | Ce que le pilote fait au clavier n'est pas ce qu'il décrit : d'où l'observation, pas l'entretien. |
| S17 | 04–10/01 | 3 | Loi de finances 2027 : demander au comptable ce qui change (taux, barèmes). Compter les trois nombres. | 9.3.0 : brouillard, validation irréversible, contre-passation, extourne. Version de janvier de l'app entreprise avec les nouveaux défauts (règle § 14). | Une validée refusée à la modification ; les barèmes 2027 en bêta. | Une loi de finances tardive : les taux sont des réglages, l'utilisateur les change sans attendre. |
| S18 | 11–17/01 | 3 | Démonstrations. Relancer l'Ordre. | 9.3.0 : guides d'écritures, abonnements, piste d'audit. | Un guide « loyer » qui génère chaque mois. | Aucun. |
| S19 | 18–24/01 | 3 | Bêta 9.3.0 chez le pilote : **une journée réelle de saisie**. | Retours de bêta. Relecture. | Le pilote a saisi une journée sans rouvrir son ancien logiciel — ou on sait pourquoi il l'a rouvert. | C'est **le** critère de la Phase 3 : s'il rouvre l'ancien, la Phase 4 attend. |
| S20 | 25–31/01 | 3 | Publier 9.3.0 stable. | Licence du Cabinet (P 0.3 + 9.4.0) : clé par empreinte, comptage, grâce après licence payée seulement, garde-fou qui nomme les dossiers. | Le compteur juste sur un portefeuille à quatre situations. | Touche à l'argent : relecture adversariale complète (règle 24) avant toute bêta. |
| S21 | 01–07/02 | 3 | Si l'Ordre a répondu : fixer le prix Cabinet (ou plan B). Sinon : le prix reste absent de la page Tarifs. | Licence du Cabinet : écran, console, `e2e:cabinet-licence`. Relecture adversariale. | Le Cabinet sait dire « tu as N dossiers hors SkanFact, dont 3 gratuits ». | Sans réponse de l'Ordre, on construit et on **ne vend pas** au cabinet : c'est prévu. |
| S22 | 08–14/02 | 3 | Compter les trois nombres. Démonstrations. | **9.4.10 — entretien** : Electron du semestre, 93 déclarations CSS en logiques, premier découpage d'`app.js`, dette du § 15. **Tous** les e2e relancés. | Tous les e2e verts après la mise à jour d'Electron. | C'est la seule semaine où on relance tout : si un e2e tombe, on ne la saute pas, on la prolonge. |
| S23 | 15–21/02 | 3 → 4 | Demander au pilote **un relevé réel** de chaque banque de ses clients (anonymisé). | Publier 9.4.0 + 9.4.10 stable. Début 9.5.0 : lecteurs de relevés par nom de colonne. | Un relevé réel lu, colonnes reconnues et non reconnues **dites**. | Les formats bancaires : rien n'est écrit avant d'avoir vu le fichier. |
| S24 | 22–28/02 | 4 | Démonstrations. Relance des essais. | 9.5.0 : rapprochement automatique, quatre niveaux de confiance, jamais validé seul si ambigu. | Un relevé de trois mois rapproché, avec ses « à confirmer » ouverts. | Aucun. |
| S25 | 01–07/03 | 4 | Compter les trois nombres. | 9.5.0 : lettrage automatique, balance âgée. | Le lettrage automatique = le solde du 411 (règle 30). | Aucun. |
| S26 | 08–14/03 | 4 | Bêta 9.5.0 chez le pilote sur ses relevés. **Réécrire ce tableau** pour S27–S52 avec les chiffres réels. | Retours de bêta. Ce document mis à jour : ce qui a tenu, ce qui a glissé, pourquoi. | Le plan des 26 semaines suivantes, écrit sur les faits. | Aucun : c'est la fin de ce que ce plan sait dire. |

*Lecture honnête de ce tableau : il place la 9.5.0 en bêta à S26, là où le § 16 en construction pure
la mettait quatre à six semaines plus tôt. C'est le « compter le double ». Et il suppose J1 atteint ;
sinon S16 → S26 est un tableau de démonstrations, et la 9.3.0 glisse d'un trimestre entier.*

---

## Partie F — Les décisions à prendre cette semaine

| # | La question | Les options | Recommandation | Si on ne tranche pas |
|---|---|---|---|---|
| F1 | **Le pilote : on lui demande maintenant, ou après la 9.1.0 ?** | (a) Un appel cette semaine pour un oui oral, l'écrit après la 9.1.0. (b) Attendre d'avoir la 9.1.0 à montrer. | **(a)**. L'appel coûte dix minutes et dit si la 9.1.0 se construit pour quelqu'un. L'écrit attend la démonstration. | On construit la 9.1.0 à l'aveugle et on découvre en S6 qu'il ne veut pas — trois semaines perdues, et une phase entière à repenser. |
| F2 | **Windows : certificat OV ou EV ?** | (a) OV maintenant (moins cher, SmartScreen se lève avec la réputation). (b) EV maintenant (lève SmartScreen tout de suite, clé matérielle, signature depuis le Mac plutôt que depuis Actions). (c) Mac seulement pour l'instant. | **(c) puis (a)** : Mac cette semaine (c'est le poste de Skander et des démonstrations), OV Windows dès que le budget suit, EV quand ça vend. Page « SmartScreen » sur le site en attendant. À VÉRIFIER : les prix du jour, un fournisseur qui livre en Tunisie, la faisabilité EV depuis le workflow. | Un cabinet sous Windows tombe sur SmartScreen à la première démonstration, et on n'a même pas la page qui l'explique. |
| F3 | **Les seuils des jalons** (Partie A) : 3 / 10 / 25 licences, ou d'autres ? | Les chiffres proposés, ou les tiens. | Garder les chiffres proposés **comme point de départ** et les écrire ; ils se corrigent à J1 avec les faits. Ce qui compte est qu'ils existent avant S5. | Sans seuils écrits, J0 et J1 ne se jugent pas, et la règle d'arrêt n'existe pas : c'est le défaut que quatre relectures ont désigné. |
| F4 | **Les deux personnes du pli scellé.** | Deux personnes qui ne vivent pas sous le même toit ; l'une a le fichier, l'autre le mot de passe. | Choisir cette semaine, constituer le pli en S4. Le père et une personne hors famille, par exemple — **à toi**. | Un accident, et personne ne peut émettre une licence ni servir un renouvellement : le produit continue, le business s'arrête. |
| F5 | **Combien de temps sans revenus de SkanFact ?** (`QUESTIONS.md` § 3) | Six mois / un an / trois ans. Pas à écrire ici — à savoir. | Répondre pour toi-même avant S5. À six mois, ce plan se réduit à Phase 0 + Phase 1 + vendre ; à trois ans, il tient tel quel. | Toutes les autres décisions sont prises sans la seule donnée qui les ordonne. |
| F6 | **Le prix de l'option Comptabilité** de l'app entreprise (proposition : 190 DT HT/an). | Un prix, ou l'option offerte les six premiers mois. | Fixer 190 DT HT/an **comme prix affiché** dès la 9.1.0 (l'option existe dans la clé) ; on peut l'offrir à la main aux premiers clients. Un prix absent ne se corrige pas, un prix trop haut si. | La 9.1.0 livre une option sans prix : la console ne sait pas la vendre. |
| F7 | **Qui répare le 404 du site ?** | Skander sur `skanfact-site`, ou Claude si le dépôt est ajouté à la session. | Ajouter le dépôt à la session et le faire faire par Claude en S2 (une heure), avec la page « SmartScreen » et la page unique dans le même geste. | Un cabinet curieux tombe sur un 404 : c'est la première impression, et elle est perdue. |

---

## Partie G — Ce qui n'est pas dans ce plan

| Sujet | Pourquoi pas maintenant | Ce qui le ferait entrer |
|---|---|---|
| **Une application sur téléphone** | C'est un troisième produit (autre langage, deux magasins, **un serveur** — ce que le produit refuse). `QUESTIONS.md` § 4. | Un client qui le demande, après le Cabinet ; et sous la forme étroite (photographier, consulter, encaisser) qui parle à l'ordinateur sans devenir le lieu des données. |
| **L'interface en arabe** | Personne ne l'a demandée — et personne n'a encore acheté. Ce qui est fait : les noms arabes fonctionnent partout (6.8.1), et **tout CSS neuf est logique** (règle 39), la conversion des 93 existantes en 9.3.1. | Une demande d'un client ou d'un cabinet. Le jour venu il restera la traduction, pas la mise en page. |
| **La synchronisation cloud** (copie chiffrée sur un serveur) | Un service à tenir et la **garde de données comptables de tiers** (responsabilité, déclaration). `QUESTIONS.md` § 15. | Après les premiers clients, si une entreprise multi-sites le demande. Jamais du temps réel multi-utilisateur (refusé en 3.2.0). |
| **La télédéclaration / e-facture (TTN, El Fatoora)** | Pas d'obligation confirmée pour nos clients ; un format officiel qu'on ne connaît pas ne s'écrit pas. Ce qui est fait : le contrôle d'une heure « notre modèle porte-t-il ce qu'il faudrait ? » (9.1.1). | Le jour où c'est obligatoire pour les clients de SkanFact — **À VÉRIFIER le calendrier avec le comptable**, à chaque séance fiscale. |
| **La paie côté Cabinet** | Le pilote ne l'a pas demandée ; la paie existe côté entreprise (5.0.0 → 5.2.0) et passe par le paquet. | Un cabinet qui fait la paie de ses clients hors SkanFact et le demande. |
| **Un autre pays** (Maghreb, Afrique de l'Ouest) | Un référentiel comptable, des déclarations, un pilote et un support par pays. `QUESTIONS.md` § 3. | Dix cabinets tunisiens. Et c'est une raison de plus de ne jamais écrire un taux en dur. |
| **Une offre gratuite limitée** (dix factures/mois) | Le coût n'est pas technique (l'offre existe dans la clé), c'est le support de gens qui ne paient pas : une décision de modèle. | À Skander, après J1, avec les chiffres de conversion des essais. |
| **Un programme de partenaires** (revendeurs commissionnés) | Même question de déontologie que la gratuité conditionnelle. | La réponse de l'Ordre. |
| **Certification, forum, bug bounty** | Un cabinet, trois utilisateurs, zéro client : ces programmes coûtent du temps et ne rendent rien à cette taille. | Au-dessus de cent clients. |
| **Une base de données (SQLite) pour le Cabinet** | Refusé avec ses raisons (`QUESTIONS.md` § 5) ; la question posée est la vitesse, et le test de charge de la Phase 1 y répond. | Un test de charge sous les seuils **malgré** l'index à côté des livres. |
| **Une bibliothèque PDF** | Refusé : Electron embarque son Chromium, `e2e:pages` imprime 161 documents. | Rien. Deux vérifications restent à faire le jour de l'arabe ou d'un vrai logo. |
| **Un outil de support (tickets)** | Une boîte partagée suffit sous deux cents clients. | Deux cents clients (`QUESTIONS.md` § 14). |
| **Séparer les installateurs arm64/x64, signer pour Squirrel.Mac** | Confort, pas vente. | Après la signature de code, si les 222 Mo du dmg universel posent problème à un client. |

---

## Ce que je n'ai pas pu vérifier

*Ce plan est écrit depuis le dépôt seul. Là où le dépôt ne dit rien, j'ai posé une hypothèse et je la
nomme. Chacune se vérifie en une heure au plus.*

- **Les coûts** (marque INNORPI, certificat Apple, certificats Windows OV/EV, relecture juridique,
  INPDP) : des ordres de grandeur, aucun relevé auprès d'un fournisseur. À VÉRIFIER avant de budgéter
  — deux pages web et un appel.
- **La faisabilité d'une signature EV Windows depuis GitHub Actions** (clé sur support matériel
  depuis 2023) : hypothèse « il faudra peut-être signer depuis le Mac ». À VÉRIFIER auprès du
  fournisseur de certificat choisi.
- **Le site `skanfact-site`** (le 404 du téléchargement Cabinet, la page Tarifs) : dépôt séparé, non
  accessible dans cette session. Hypothèse : le 404 est toujours là. À VÉRIFIER en ouvrant le site.
- **Les délais de l'INNORPI, de l'INPDP, de l'Ordre** : « quelques semaines », « des mois » sont des
  estimations, pas des délais publiés. À VÉRIFIER sur leurs sites.
- **Le périmètre exact des déclarations tunisiennes** (mensuelle : TVA, retenues, TFP, FOPROLOS,
  TCL ? ; annuelle : employeur, IS ?) et **les formats de relevés bancaires** : je n'ai vu ni une
  déclaration remplie ni un relevé réel. Les Phases 4 et 5 sont écrites sur ce que le pilote fournira.
- **Le nombre d'inscrits à l'Ordre** : non publié comme total (annuaire alphabétique). Le chiffre de
  l'INS (836 808 entreprises privées en 2024, 87 % sans salarié) est sourcé dans `QUESTIONS.md` § 3.
- **La réponse du pilote** : il a regardé le Cabinet et dit ce qui manque ; il n'a jamais été
  sollicité pour un engagement. Tout le plan suppose qu'il dira oui à l'appel de S1.
- **Le temps réellement disponible de Skander** (SKANCYBER est son activité) : les six jours de la
  Partie D et les démonstrations hebdomadaires supposent quelques heures par semaine. Si c'est moins,
  le tableau de la Partie E glisse — les phases de code, elles, ne bougent pas, puisque c'est Claude
  qui les écrit.
- **`cabinetVersion` dans `package.json`** : `CLAUDE.md` (section Cabinet 1.0.0) dit que la version
  du Cabinet y vit séparément ; `package.json` ne porte plus ce champ et `build/cabinet.config.js`
  lit `pkg.version` (« depuis la 6.6.0 les deux applications partagent le même numéro »). Ce plan
  suit le code, pas la note ancienne — la note de `CLAUDE.md` est à corriger, c'est fait dans le
  même commit que ce fichier.
- **Les durées « réalistes »** (× 2) : une convention prise dans `QUESTIONS.md` § 16, pas une mesure.
  La seule façon de la vérifier est de tenir ce tableau et de réécrire S27–S52 en S26 sur les faits.
