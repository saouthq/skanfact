# SkanFact — consignes pour Claude

Application desktop Electron (JS pur, sans bundler) de devis et factures pour une petite entreprise, dans le contexte fiscal tunisien. Propriétaire : Skander Ben Amor (saouthq), qui l'utilise pour SKANCYBER SECURITY SUARL. Il communique en français, tutoiement, débutant Git/terminal : il ne veut pas taper de commandes, Claude fait le travail en autonomie (commits, releases, vérification des builds). Quand quelque chose est incertain (fiscalité), le signaler par « À VÉRIFIER ».

**Depuis la 2.0.0, aucune entreprise n'est écrite en dur** : `DEFAULT_COMPANY` est vide et un assistant de première utilisation (`src/renderer/onboarding.js`) renseigne la société. Skander compte partager l'app avec sa famille, chacun gérant sa propre entreprise sur son ordinateur. Ne jamais réintroduire « SKANCYBER » ni le matricule 1998268D dans le code, les valeurs par défaut, le pied de page ou le jeu de démo. Exception : `build.appId` (`tn.skancyber.skanfact`) reste inchangé, c'est l'identifiant technique du paquet — le modifier casserait la mise à jour des apps déjà installées.

L'utilisateur est débutant en gestion (première entreprise) : chaque champ porte une bulle « i » (`src/renderer/guide.js`) et la rubrique Aide explique la facturation, la fiscalité et la routine comptable. Toute nouveauté doit venir avec sa bulle et, si elle change une habitude, un paragraphe dans l'article concerné. Un test vérifie que chaque clé posée dans l'interface existe dans `guide.js`.

## Règles de travail

- **Chaque amélioration livrée = une nouvelle version** (semver) : correctif 1.0.x, fonctionnalité 1.x.0, gros changement x.0.0. Mettre à jour `package.json` (`version`) **et** ajouter une entrée datée dans `CHANGELOG.md` (c'est elle qui devient les notes de version dans l'app et sur GitHub). Toujours annoncer le numéro de version dans la réponse.
- Lancer `npm test` avant tout commit (calculs, numérotation, montant en lettres, échappement HTML, stockage/sauvegardes). Pour un changement d'interface, lancer aussi l'app réelle (`xvfb-run` + Playwright `_electron`, voir README « Tests ») : elle attrape les erreurs JS du renderer.
- Ne jamais commiter de token. Le token GitHub de l'app (dépôt privé) est saisi par l'utilisateur dans Paramètres → Mises à jour et stocké dans `userData/update-config.json`.
- Le dépôt est **privé**. Les mises à jour utilisent `electron-updater` avec `private: true` + token fourni par l'utilisateur.
- macOS : app non signée → `MAC_SIGNED = false` dans `src/main.js`. electron-updater télécharge le `.zip` (sha512 vérifié) et `src/mac-update.sh` remplace l'app dans Applications puis la relance. Ne pas prétendre que Squirrel.Mac fonctionne sans signature Apple.

## Publier une version

1. Bump `package.json` + entrée `CHANGELOG.md`, `npm test`, commit, push sur `main`.
2. Déclencher le workflow **Release** (`.github/workflows/release.yml`) : soit un tag `vX.Y.Z` (`npm run release` sur le Mac de Skander), soit **workflow_dispatch** sur `main` (onglet Actions → Release → Run workflow, ou l'outil GitHub `actions_run_trigger`). Depuis une session Claude Code, le push de tag est bloqué par le proxy git : utiliser workflow_dispatch.
3. electron-builder (`publish.releaseType = "release"`) crée la release `vX.Y.Z` et le tag, attache `.dmg` + `.zip` (mac universal), `.exe` (win x64), `latest.yml`, `latest-mac.yml`. Le job mac copie les notes dans la release (`gh release edit`).
4. Vérifier que le run est vert **et** que la release contient bien ces fichiers avant de dire que c'est publié ; s'il est rouge, lire les logs et corriger.

## Structure

- `src/main.js` : fenêtre (état mémorisé), instance unique, menu français, IPC, export PDF via `printToPDF` (fichier temporaire), mises à jour (vérification silencieuse au démarrage, téléchargement auto, install Windows par electron-updater / Mac par `mac-update.sh`).
- `src/storage.js` : fichier `skanfact-data.json` (écriture atomique), fichier illisible mis de côté jamais écrasé, sauvegarde quotidienne = état de début de journée (30 jours), sauvegardes nommées (avant import, manuelle), chiffrement optionnel (enveloppe `skanfact-encrypted`, AES-256-GCM + scrypt, clé en mémoire pour la session, sauvegardes converties au changement de mot de passe), copie miroir vers un dossier externe (`userData/app-config.json` → `externalBackupDir`). Testé sans Electron.
- `src/preload.js` : pont contextBridge (`window.skanfact`).
- `src/renderer/core.js` : logique métier partagée navigateur/Node — calculs (TVA 0/7/13/19 %, remise, timbre fiscal 1 DT sur factures, retenue à la source sur TTC hors timbre, lignes `noDiscount` pour les déductions d'acompte), numérotation `DEV/FAC/AVO-AAAA-NNN` (facture et avoir numérotés à l'émission seulement), statut de facture **déduit** des paiements et avoirs (`effectiveStatus`, `invoiceBalance`), acompte/solde (`depositLines`, `settlementLines`), journal des ventes / TVA / encaissements / CSV, `migrateData` (version 2 : « payée » → paiement), montant en lettres, **template HTML du document** (`documentHtml`, tampon via `opts.stampText`).
- `src/renderer/app.js` : interface (routeur hash, pages accueil/devis/factures/relances/contrats/clients/catalogue/comptabilité/paramètres, éditeur avec aperçu live et menu « Plus », verrouillage des documents émis, paiements, avoirs, envoi email, palette Cmd+K, modèles/textes, panneau mises à jour, actions du menu).
- `src/renderer/demo.js` : jeu de démonstration (`buildDemoData(companyActuelle, today)`), dates relatives à aujourd'hui, testé par `npm test` (numérotation continue, aucun paiement futur, tous les statuts et niveaux de relance présents quelle que soit la date). Le chargement conserve la société et prend une sauvegarde `avant-demo`.
- `core.fitToPage(document)` : exécuté dans l'aperçu (iframe) et dans la fenêtre PDF (main.js) ; ajoute la classe `compact` à `.page` si le contenu déborde de l'A4 (marges resserrées, même design). Vérifier le nombre de pages avec un script Playwright (`chromium` + `page.pdf`) après toute modification du template.
- CSS : `[hidden] { display: none !important; }` est global — un `display:flex` de classe écrasait l'attribut `hidden` (menu « Plus », champ taux, bouton Retirer).
- Données v6 : `recurring` (contrats : lignes, every, day, nextDate, lastIssued, active), `templates`, `snippets`, `suppliers`, `purchases`, `expenseCategories` ; par document : `payments`, `reminders`, `emails`, `withholdingCertificate`, `recurringId`, `attachments`, `fromDocId`/`fromDocType`/`fromDocNumber`, `clauses` (contrat), `hidePrices` (bon de livraison) ; par achat : `kind` (facture/depense), `supplierId`, `number` (celui du fournisseur), `date`, `dueDate`, `category`, `lines` (avec `destination` et `deductible`), `fees`, `withholdingRate`, `payments`, `attachments`.
- Documents bilingues : `doc.lang` (fr/en) → dictionnaire `I18N` dans core.js, `amountToWords(amount, currency, lang)` ; `doc.currency` + `doc.exchangeRate` (1 devise = x DT), `toBase()` pour le journal et le tableau de bord ; `money(n, cur, decimals, lang)` (3 décimales pour le dinar, 2 sinon ; point décimal en anglais).
- Thème : `company.theme` (light/dark/auto) → classe `dark` sur `body` ; les documents PDF restent clairs.
- Email : `mail:compose` dans main.js — AppleScript vers Mail sur macOS (PDF joint), sinon `mailto:` + PDF montré dans le Finder ; le PDF joint est écrit dans `userData/envois/`. Gabarits dans `core.DEFAULT_EMAIL_TEMPLATES`, surchargés par `company.emailTemplates`.
- Règles métier à respecter : une facture/avoir émis est verrouillé (pas de modification ni suppression ; correction par avoir) ; les statuts « payée / partielle / retard / annulée » ne se saisissent jamais à la main ; les brouillons de facture n'ont pas de numéro.
- `src/renderer/style.css` : design clair (fond #f5f7fa, accent vert d'eau #0f9d8f, cartes arrondies).
- `build/icon.png` : icône 1024×1024 convertie par electron-builder en `.icns`/`.ico`.
- `scripts/release.js` (bump + tag + push), `scripts/release-notes.js` (CHANGELOG → `build/release-notes.md`).
- `Installer SkanFact.command` / `Installer SkanFact (Windows).bat` : construction locale depuis les sources (secours ; l'installation normale passe par les fichiers de la release).
- `test/run-tests.js` : `npm test`.

## Design du document PDF

Le propriétaire veut un rendu « beau et épuré, couleurs claires ». Palette dérivée de `company.accentColor` (teintes via rgba). Le document doit tenir sur **une page A4** pour un devis classique (vérifier le nombre de pages après toute modification du template : un débordement de quelques px crée une page blanche). Pas de bandeau sombre, pas de blocs lourds. Skander a rejeté deux versions plus « lourdes ».

## Décisions prises (ne pas rediscuter)

- Electron + JS pur, pas de React/Vite ; stockage JSON, pas SQLite.
- La lecture de photo de facture (4.2.0) est **éteinte par défaut** et le restera : aucune requête réseau sans clé saisie par l'utilisateur, et l'app ne remplit jamais les données toute seule.
- Pas d'e-facture TTN/El Fatoora tant que Skander ne le demande pas. À VÉRIFIER avec son comptable : la Tunisie généralise la facture électronique pour les assujettis TVA.
- Dépôt privé (il l'exige), d'où le token dans l'app.

## Contexte fiscal (À VÉRIFIER avec le comptable)

Celui de Skander : régime réel, assujetti TVA (son matricule est saisi dans l'app, pas dans le code). Timbre fiscal 1 DT par facture. Retenue à la source : taux usuels proposés (1,5 / 3 / 5 / 10 / 15 %), assiette = TTC hors timbre — À VÉRIFIER. Avoir sans timbre par défaut — À VÉRIFIER.

## Idées non demandées formellement

Feuille de route acceptée par Skander (11/09/2026) : 1.5.0 récurrentes + relances + email + Cmd+K + modèles ; 1.6.0 tableau de bord graphique + cachet/signature + documents EN/devise + mode sombre ; 1.7.0 sauvegarde externe + chiffrement. Non demandés : acceptation du devis en ligne, signature Apple/Windows (certificats payants), export TEIF si l'e-facture devient obligatoire.

## Audit UX du 11/09/2026 — livré en 1.8.0 → 2.0.0

L'audit (captures 1440×900 et 1280×800 avec la démo) a été entièrement traité :

- **1.8.0** : bulles « i » partout + rubrique Aide ; Paramètres en onglets + barre Enregistrer flottante ; garde-fou modifications non enregistrées ; Échap/Entrée ; barre d'actions de l'éditeur simplifiée ; aperçu masquable + indicateur de pages ; lignes déplaçables/duplicables ; titre de fenêtre ; zone sensible.
- **1.9.0** : listes triables, filtre par année, totaux en pied, actions au survol ; devis « expiré » ; fiche client + champ Contact ; catalogue en onglets.
- **1.10.0** : panneau « À faire » ; historique par document ; relance téléphonique et report ; relance de devis ; envoi au comptable ; barre latérale groupée.
- **2.0.0** : assistant de première utilisation, secteurs d'activité, fin des valeurs société en dur.
- **2.1.0** (second audit, sur 2.0.0 installée, captures des états vides et de toutes les modales) : « À faire » complété (devis acceptés non facturés, fiche société incomplète via `core.companyGaps`) ; avertissements à l'émission (`issueWarnings` dans app.js : société incomplète, RIB absent, date antérieure à la dernière pièce émise) ; paiement futur ou trop-perçu confirmé ; historique devis ↔ factures ; reprise de contrat via `core.catchUpRecurrence` ; corrections visuelles (nowrap `.nw` dans les listes, axe du graphique vide, libellé « Tout effacer », placeholders).

- **2.2.0** (signalé par Skander : pas de page suivante sur les listes longues, filtres et tri difficiles à trouver, « À faire » impossible à replier) : pagination de toutes les listes (`core.pageInfo` + `paginate`/`pagerBar`/`bindPager` dans app.js, taille de page dans `localStorage` via `prefs`) ; tri partagé (`sortHead`/`applySort`/`toggleSort`, `core.compareValues`) avec repère « ⇅ » sur chaque colonne triable ; recherche ajoutée au catalogue et aux contrats, filtres ajoutés aux contrats et aux clients ; bandeau « n sur N » + « Réinitialiser les filtres » ; en-tête de tableau collant (`table.list` passe à `overflow: clip`, sinon `position: sticky` ne fonctionne pas) ; panneau « À faire » repliable ; débordement horizontal des listes à huit colonnes corrigé sous 1340 px.

- **2.3.0** (finitions demandées par Skander) : unité de ligne choisie dans une liste (`core.LINE_UNITS` + `core.usedUnits` + « Autre… » via `promptDialog`) ; composant `combo()`/`bindCombo()` — liste déroulante avec recherche, clavier, valeur dans un `<input type="hidden">` portant le nom de l'ancien `<select>` (client, facture d'un avoir, catalogue, modèles, textes, client d'un contrat) ; composant `dateInput()`/`bindDateFields()` — saisie tolérante (`core.parseDateInput`) et calendrier (`core.monthMatrix`), raccourcis +7/+15/+30 j sur les échéances.

- **3.3.0** (la trésorerie) : `data.accounts` et `data.movements` ; `cashMovements` **déduit** les mouvements des paiements clients et des règlements fournisseurs (aucune ressaisie), `accountBalance`, `cashPosition`, `cashForecast` (projection des seules échéances engagées, `shortfall` = date du passage sous zéro), `reconciliation`. `routes.tresorerie` à quatre onglets, `forecastChart` (aire + ligne + zéro pointillé). Le trou de trésorerie passe **en tête** de `todoList`.
  Règles apprises : une facture déjà échue est ramenée à aujourd'hui dans la prévision — la laisser à sa date passée donnerait un solde faux et rassurant. Le solde peut être positif au début et à la fin et négatif au milieu : c'est pour ça que la courbe vaut mieux qu'un total. Le drapeau « pointé » vit sur le paiement d'origine, jamais sur une copie du mouvement. Piège Playwright : `check()` revérifie l'élément après le clic ; quand le panneau se redessine, l'élément est détaché et Playwright recommence sur la ligne suivante — utiliser `click()` et attendre une décroissance, pas une valeur exacte. `nextRecurrenceDate(fromIso, every, day)` prend trois arguments, pas l'objet contrat.

- **3.2.0** (travailler à deux — question de Skander : son père gère Darium *et* sa société, et ils partagent la seconde) : **dossiers** dans `main.js` (`userData/dossiers/<id>/`, reprise automatique de l'ancien emplacement **par copie**, l'original reste intact), identité de poste (`deviceId`/`deviceName` dans `app-config.json`). Dans storage.js : `syncRevision`/`syncDevice`/`syncWrittenAt` estampillés à chaque écriture, `write()` relit le disque et renvoie `{conflict, disk}` **sans rien écrire** si la révision a bougé. Dans core.js : `mergeData` (fusion par identifiant, le fichier écrit en dernier tranche les désaccords, version écartée archivée dans `conflictArchive`, compteurs au maximum, doublons de numéro signalés) et `trackDeletion` (`data.deleted`, sans quoi une pièce supprimée reviendrait de l'autre poste). Côté renderer, `save()` gère le conflit, fusionne, réécrit en force et explique ce qui s'est passé.
  Règles apprises : le danger du partage n'est pas la panne, c'est le **silence** — avant la 3.2.0, deux postes sur le même dossier iCloud s'écrasaient sans que personne ne le sache. On ne fusionne jamais deux versions d'une même pièce en une troisième : on en garde une, on le dit, on archive l'autre. Le seul cas insoluble est deux factures émises hors ligne sous le même numéro : la parade est organisationnelle (« une seule personne émet »), pas technique, et c'est écrit dans l'aide. Les tests de fusion sont purs et tournent sans Electron ; celui de conflit d'écriture utilise deux `createStorage` sur le même dossier.

- **5.2.0** (ce qu'il faut déposer) : `data.socialFilings`. Dans core.js : `QUARTERS`, `cnssDeclaration` (un salarié par ligne, assiette, part salarié, part employeur, accident, échéance au 15 du mois suivant le trimestre), `employerAnnual` (salaires **et** retenues à la source sur fournisseurs — les deux moitiés du même formulaire), `socialDue` (ce qui est dû, ce qui est en retard, ce qui a été marqué déposé). `fiscalDeadlines` allume l'échéance `cnss` d'elle-même dès qu'un salarié existe ; `todoList` gagne « déclarations sociales à déposer ». Dans app.js : onglet **Déclarations** de la page Paie, export CSV, envoi au comptable avec pièce jointe.
  Règles apprises : la déclaration annuelle d'employeur porte sur **deux choses distinctes** qu'on confond — les salaires versés, et les retenues à la source pratiquées sur des fournisseurs (honoraires, loyers). Les deux figurent sur le même formulaire, et les attestations de retenue non remises se comptent ici comme dans « À faire ». SkanFact **ne dépose rien** et ne se connecte à aucune administration : « Marquer déposée » n'est qu'un pense-bête, pas un accusé de réception — une application qui déposerait à la place de l'utilisateur se tromperait un jour sans qu'il le sache. Un trimestre sans bulletin n'est jamais réclamé.

- **5.1.0** (la vie d'un salarié entre deux bulletins) : `data.leaves`, `data.advances`, plus `leaveDaysPerYear`, `workedDays` et `offDays` dans les barèmes. Dans core.js : `LEAVE_KINDS` (chaque nature porte son effet habituel sur le salaire), `workingDays` (dimanche chômé par défaut), `leaveDaysInMonth`, `leavesOf`, `leaveBalance`, `advancesOf`, `advanceBalance`, **`payslipInputFor`** (le bulletin se remplit à partir des absences et des avances), `HR_DOCS` + `hrDocumentHtml` (attestation, certificat, solde de tout compte), `staffRegister`. Dans app.js : trois onglets de plus dans Paie (Congés, Avances, Registre), `leaveForm`, `advanceForm`, `hrDocForm`, panneaux congés/avances sur la fiche du salarié.
  Règles apprises : une absence à cheval sur deux mois se **répartit** entre les deux bulletins (`leaveDaysInMonth`), sinon le salarié est retenu deux fois ou pas du tout. Ce qu'une avance a remboursé se lit **sur les bulletins** (`deductions[].advanceId`), jamais sur un compteur à part : supprimer une avance ne défait donc pas les retenues déjà passées, et c'est voulu — un bulletin remis ne se réécrit pas. Le salaire ne figure sur une attestation que si on le demande : c'est une information personnelle du salarié. Un certificat de travail ne porte que les dates et l'emploi, jamais le motif du départ ni une appréciation.

- **5.0.0** (payer quelqu'un — *données v6*) : `data.employees`, `data.payslips`, `data.payrollSettings`, plus `company.cnss`. Dans core.js : `CONTRACT_TYPES`, `DEFAULT_PAYROLL` (CNSS 9,18 / 16,57, accident, solidarité, frais professionnels plafonnés, déductions familiales, barème progressif), `payrollSettings`, `irppAnnual`, `computePayslip`, `activeEmployees`, `payslipsOf`, `payslipDate`, `payrollCost`, `payrollSummary`, `missingPayslips`, `payslipHtml` (PDF une page, même langage visuel que les factures). `simpleResult` et `breakEven` gagnent `payroll` (charge **fixe**) ; `cashMovements` produit la sortie d'un bulletin réglé ; `todoList` gagne « bulletins à établir » et « mouvements Salaires comptés deux fois ». Dans app.js : `routes.paie` (trois onglets) et `routes.salarie`, `employeeForm`, `payslipForm`, `exportPayslip`.
  Règles apprises : **aucun taux n'est écrit en dur dans un calcul** — tout passe par `payrollSettings`, sinon l'application devient fausse en silence à la loi de finances suivante. Un bulletin garde une **copie** de son calcul (`slip.computed`) : modifier un barème ne doit jamais réécrire un bulletin déjà remis à un salarié, et un test e2e le vérifie. Le barème progressif se calcule tranche par tranche sur la part du revenu qui la traverse — la première version taxait la tranche entière dès qu'on y entrait, et surestimait l'impôt de 6 % ; c'est le genre d'erreur qu'aucun écran ne montre. Ce qui entre dans le résultat et dans le seuil, c'est le **coût employeur**, jamais le net ni le brut. Un bulletin réglé sort l'argent tout seul : saisir en plus un mouvement libre « Salaires » compte deux fois, d'où la ligne de contrôle dans « À faire » et la disparition de ces mouvements du jeu de démonstration.

- **4.2.0** (photographier au lieu de saisir — **éteint par défaut**) : la seule fonction qui sort de l'ordinateur, et elle ne sort rien tant qu'aucune clé n'est saisie. Dans main.js : `OCR_CFG` (`userData/lecture-config.json`, mode 0600, jamais dans les données ni les sauvegardes), `ocrRequest` (https natif vers api.anthropic.com), `OCR_PROMPT` (JSON strict, « n'invente rien, mets null »), IPC `ocr:status` / `ocr:setKey` / `ocr:pick` / `ocr:read`, plus `attach:addPath`. Dans core.js (testable sans Electron) : `ocrNumber` (1 234,56 · 1.234,56 · 1,234.56) et `ocrToPurchase` (reconnaissance du fournisseur par matricule puis par nom, lignes normalisées, **liste d'avertissements**). Dans app.js : `drawOcrPanel` et `ocrKeyForm` (consentement explicite listant ce qui part), bouton « Depuis une photo… » de l'éditeur d'achat, `ocrReviewForm`.
  Règles apprises : le chemin **sans clé est le chemin par défaut** — la photo est jointe comme justificatif et la saisie se fait à la main, hors ligne, pour toujours. `ocr:read` refuse explicitement quand il n'y a pas de clé : c'est la garantie, et un test e2e la vérifie. L'application **ne remplit jamais toute seule** : `ocrReviewForm` montre ce qui a été lu, signale le fournisseur inconnu, l'écart entre le total des lignes et le total imprimé, le numéro manquant et une date future. Les lignes lues arrivent toutes en `destination: 'charge'` — jamais « stock » sans décision humaine, parce qu'une quantité mal lue pourrirait tout l'inventaire. Un fournisseur inconnu n'est jamais créé d'office (doublons).

- **4.1.0** (savoir qui a quoi) : `data.serials`, plus `serialized` et `warrantyMonths` par article. Dans core.js : `SERIAL_STATUSES`, `WARRANTY_CHOICES`, `serializedItems`, `warrantyEnd` (la garantie court de la **sortie**, pas de l'achat), `serialView`/`serialList`, `availableSerials`, `clientFleet`, `warrantiesEnding`, `serialGap`/`serialGaps`. Dans app.js : `serialIntakeForm` (collage d'une liste, doublons refusés), `serialAssignForm` (depuis « Plus ▾ » d'une facture ou d'un bon de livraison ; décocher remet l'unité en stock), `serialForm`, onglet **Numéros de série** dans Stock, `routes.garanties`, panneau « Matériel installé » sur la fiche client. `todoList` gagne les fins de garantie et les écarts de numéros.
  Règles apprises : une fin de garantie est une **occasion commerciale**, pas une mauvaise nouvelle — le bouton « Proposer un contrat » ouvre un devis au nom du client, et l'aide le dit ainsi. Le suivi par numéro **double** le stock en quantité sans le remplacer : quand les deux comptes divergent, on le signale (`serialGap`) sans rien corriger d'office, parce que la comptabilité s'appuie sur les quantités et pas sur les numéros. Une unité encore en stock n'a pas de garantie en cours : elle n'est chez personne, donc `warrantyEnd` renvoie une chaîne vide plutôt qu'une date trompeuse.

- **4.0.0** (ce qui dort sur l'étagère — *données v5*) : `data.stockAdjustments` et quatre champs par article (`tracked`, `minStock`, `initialQty`, `initialCost`, plus `location`). Dans core.js : `MOVE_SOURCES`, `trackedItems`, `itemOfLine` (par `itemId` si la ligne en porte un, sinon par libellé — même règle que `lineCost`), `stockMovements` (entrées = lignes d'achat `destination: 'stock'`, sorties = factures et bons de livraison, retours = avoirs), `runningStock` (coût moyen pondéré tenu au fil des mouvements), `stockOf`, `stockList`/`stockTotals`, `stockJournal`, `inventoryDiff`, `stockAlerts`, `stockImpact`, **`costOfGoodsSold`**. Dans app.js : `routes.stock` (quatre onglets) et `routes.article`, `adjustForm`, bloc stock dans `catalogForm`, colonne Stock au catalogue, avertissement d'émission dans `issueWarnings`, rappel des lignes « stock » orphelines dans l'éditeur d'achat. `todoList` gagne « stock négatif » et « à recommander ».
  Règles apprises : **acheter de la marchandise n'est pas une charge** — c'est de l'argent transformé en stock. La charge, c'est le `costOfGoodsSold` : les sorties valorisées au coût moyen. Il entre dans `simpleResult` et dans les charges **variables** de `breakEven` ; sans lui, le résultat du mois d'un gros réassort plongeait puis remontait sans raison. Une facture tirée d'un bon de livraison ne doit pas sortir le stock une seconde fois (`fromDocType === 'livraison'` → on saute). Un stock négatif n'est jamais « à ajuster » : c'est une pièce manquante, et l'ajuster ferait perdre en plus la TVA déductible de l'achat oublié — c'est écrit dans l'app et dans l'aide. Dans `demo.js`, les articles se réfèrent par indice (`k[0]`…`k[10]`) : **tout nouvel article s'ajoute à la fin**, sinon toutes les pièces du jeu changent.

- **3.5.0** (ce que tu gardes) : `data.assets`. Dans core.js : `DEFAULT_ASSET_CLASSES` (neuf familles avec leur durée usuelle), `days360` (prorata temporis base 360), `assetSchedule` (plan annuel — la **dernière annuité absorbe les arrondis**, sinon la VNC finit à trois millimes de zéro), `assetYear`, `assetCumulated`, `assetNBV`, `disposalResult` (plus/moins-value contre la VNC du jour), `assetsList`/`assetTotals`, `assetsToCreate` (pont avec les lignes d'achat `destination: 'immobilisation'`), `cappedCumulated`, `depreciationFor`. `simpleResult` gagne `depreciation` et la retire du résultat ; `breakEven` la range dans les charges fixes ; `todoList` gagne « n achats à immobiliser ». Dans app.js : `routes.immos` (trois onglets) et `routes.immo`, `assetForm` (plan en direct pendant la saisie, la famille propose sa durée sans l'imposer une fois le champ touché), `disposalForm` (plus-value annoncée avant d'enregistrer, sortie annulable), `vatWarning`.
  Règles apprises : **une dotation se calcule sur la période demandée, jamais sur l'année entière**. La page Comptabilité peut porter sur un seul mois ; la première version retranchait douze mois d'amortissement d'un mois de ventes et affichait « −1 612 % du chiffre d'affaires ». C'est une capture d'écran qui l'a montré, pas un test — d'où le test « sur un mois on amortit un mois ». `depreciationFor` fait une différence de cumuls, sauf pour une année civile complète où il reprend le chiffre du tableau au millime près, pour que les deux pages ne se contredisent jamais. La fiche du bien montre le plan **d'origine** : l'année d'une cession y figure entière alors que le tableau de l'exercice la montre réduite au jour de la sortie — il faut l'écrire, sinon les deux chiffres paraissent contradictoires. On ne crée jamais la fiche d'une immobilisation tout seul : la durée est une décision. Mais tant qu'une ligne reste en attente, elle n'est déduite **nulle part** — d'où le compteur dans la barre latérale et la ligne dans « À faire ».

- **3.4.0** (la question qu'on ne se posait pas : gagnes-tu de l'argent ?) : `data.projects` (affaires) et `data.fixedCategories`. Dans core.js : `lineCost` (coût de la ligne, sinon celui du catalogue par correspondance de libellé), `documentMargin` (la remise globale ampute le prix, **jamais** le coût — d'où le `factor = netHT / totalHT` ; les lignes `noDiscount` d'acompte sont ignorées), `marginBy` (par client / par prestation), `projectMargin`/`projectList` (marge **exacte** : factures réelles contre achats réels, plus `cash` = encaissé − payé), `recurringProfitability`, `DEFAULT_FIXED_CATEGORIES`/`isFixedCategory`/`breakEven`. Dans app.js : `routes.marges` (quatre onglets) et `routes.affaire`, `projectForm`/`projectItems`, champ **Affaire** dans l'éditeur de document et dans l'éditeur d'achat, `unitCost` au catalogue avec aperçu de marge en direct, marge estimée sous les totaux de l'éditeur.
  Règles apprises : `breakEven` ne compte que `byDestination.charge + fees` — le stock et les immobilisations ne sont pas des charges de la période, sinon un gros achat de marchandises ferait exploser le seuil l'année de l'achat et le ferait disparaître l'année de la vente. Une affaire et un document ne se fusionnent pas : la marge d'un document est une **estimation** (catalogue), celle d'une affaire est **exacte** (achats rattachés) ; le repère « ≈ » dit laquelle on regarde, et l'app ne prétend jamais que l'estimation est exacte. Le champ Affaire suit le client : quand le client change dans l'éditeur, `projectCombo.setItems(projectItems(doc.clientId))` — sans quoi on proposerait les affaires d'un autre client. Deux panneaux `.split` côte à côte ne supportent pas deux tableaux à huit colonnes : sur la fiche d'affaire ils sont empilés, chacun dans son `.scroll-x`.

- **3.1.0** (la soustraction qui manquait) : `vatReturn` (collectée − déductible − crédit repris), `vatChain` (l'enchaînement mensuel des crédits — une déclaration isolée ignore le report et donne un chiffre faux), `DEFAULT_FISCAL_DEADLINES`/`fiscalDeadlines`/`nextDeadline`/`upcomingFiscal`, `simpleResult` (stock et immobilisations exclus des charges), `supplierPayments`. `data.vatCarryIn` (crédit venu de l'année précédente, saisi à la main) et `data.fiscalDeadlines` (règles activées/modifiées). `routes.compta` passe en quatre onglets ; `mail:compose` accepte désormais `attachments` (tableau) pour joindre plusieurs journaux.
  Règles apprises : le bloc de déclaration porte sur **un mois**, jamais sur « toute l'année » — additionner les mois donnerait un chiffre faux à cause des reports ; sans mois choisi on prend le mois en cours et **on l'écrit**. Les échéances fiscales sont un pense-bête réglé par l'utilisateur, avec un « À VÉRIFIER » visible sur la page : les dates réelles dépendent de la forme juridique et du régime.

- **3.0.0** (l'argent qui sort — *données v4*) : `data.suppliers`, `data.purchases`, `data.expenseCategories` ; `migrateData` crée les trois listes vides et normalise chaque achat (version 4, rien à convertir dans l'existant). Dans core.js : `purchaseTotals` (TVA déductible ligne par ligne, `byDestination`), `purchaseBalance`, `purchaseStatus` (déduit des règlements, jamais saisi), `payablesList`, `purchaseJournal`, `purchaseSummary`, `supplierSummary`, `withholdingsToIssue`, `expenseCategories` ; `LINE_DESTINATIONS` (charge / stock / immobilisation) est posé **dès maintenant** pour que 3.4.0 et 4.0.0 n'obligent pas à ressaisir l'historique. Dans app.js : `routes.fournisseurs` / `routes.fournisseur` / `routes.achats` / `routes.achat`, `supplierForm`, `supplierPaymentForm`, `purchaseColumns`, `payablesPanel`/`bindPayables`, `buyBadge`. `todoList` gagne trois lignes fournisseurs. Barre latérale : Ventes / **Achats** / Fichiers / Gestion.
  Règles apprises : un statut d'achat contient une espace (« à payer ») — `class="badge ${status}"` en ferait deux classes, d'où `buyBadge` et les classes `b-due`/`b-part`/`b-late`/`b-paid`. Un champ date est un couple `<input type=hidden>` + `.d-txt` visible dans un `.datefield` : pour le mettre à jour depuis du code il faut toucher les deux (il n'existe pas d'attribut `data-date`, on passe par `hidden.closest('.datefield')`). Les pièces jointes se rattachent à n'importe quel identifiant : le mécanisme de 2.6.0 a servi tel quel pour les justificatifs d'achat.

- **2.6.0** (les pièces qui entourent la facture) : quatre types de documents en plus — `proforma`, `commande`, `livraison`, `contrat` (`C.EXTRA_TYPES`), préfixes `PRO`/`BC`/`BL`/`CTR`, statuts propres, aucun n'entre dans le journal des ventes, la TVA, le CA ni les statistiques. Numérotés au premier enregistrement et **modifiables ensuite** (seuls facture et avoir restent verrouillés). `core.CONVERSIONS` + `convertDoc` + `derivedDocs` alimentent le menu « Transformer ▾ » ; `DEFAULT_CLAUSES`/`CLAUSE_LABELS` pour le contrat à signer. Page `routes.autres` à quatre onglets. Pièces jointes : `storage.addAttachment/removeAttachment/attachmentPath`, dossier `userData/pieces-jointes/<doc>/`, emportées par `mirrorExternal` mais **pas** par les sauvegardes quotidiennes (qui sont un seul JSON) — c'est écrit dans l'app et dans l'aide.
  Règles apprises : `derivedDocs` doit refuser un document sans `id`, sinon `undefined === undefined` fait « descendre » toute la base d'un brouillon (un test l'a attrapé). Le template porte désormais `class="page t-<type>"` : c'est ce qui permet de ne relâcher la hauteur des cases de signature (`height` → `min-height`) que sur le contrat — la faire partout ajoutait 6 px au devis et le faisait passer à deux pages. Vérifier le nombre de pages **avant et après** avec `git stash` : `facture-8` était déjà sur deux pages en 2.5.0, ce n'était pas une régression. Un contrat tient sur une page jusqu'à trois ou quatre lignes ; au-delà il en fait légitimement deux.

- **2.5.0** (page Statistiques, première version du plan des modules) : `core.js` gagne un bloc statistiques testable sans Electron — `periodBounds` (année/trimestre/mois + la même période l'an dernier), `issuedIn`, `salesTotals`, `revenueByMonth`, `topItems`, `clientMovement`, `agedReceivables` (+ `AGING_BUCKETS`), `payerRanking`, `quoteFunnel`, `objectiveProgress` ; `routes.stats` dans app.js avec `statCard` (comparaison N-1), `compareChart` (année entière, période choisie en couleur, N-1 en gris derrière), `askGoal` et `statsCsvRows` ; deux réglages de société (`revenueTarget`, `dormantDays`) dans Paramètres → Documents ; article d'aide « Lire tes statistiques ».
  Règles apprises : `.dash-grid` vaut `2fr 1fr` et ses colonnes se laissent élargir par leur contenu — d'où `.split` en `repeat(2, minmax(0, 1fr))` pour deux panneaux de poids égal (sans le `minmax(0, …)`, un tableau large impose sa largeur et fait déborder la page sous 1340 px). Un graphique mensuel réduit à une seule barre n'apprend rien : on dessine toujours les douze mois de l'année et on estompe ceux qui sont hors période (`.bar-off`). La largeur des barres est plafonnée, sinon un mois seul produit un pavé plein écran.

- **2.4.0** (deux manques signalés par Skander + audit parallèle sur quatre angles) : pile de navigation interne (`navStack`, `backButton`/`bindBack`/`goBack` dans app.js) et « Précédent » dans le menu Affichage ; fiche de contrat `#/contrat/<id>` avec aperçu de la prochaine facture, lignes résolues et factures générées (`recurringId` enfin lu par l'interface) ; événement `contrat` dans `core.documentHistory` ; fenêtres modales empilées ; garde-fou de fermeture de fenêtre (`window:dirty` → `dialog.showMessageBoxSync` dans main.js).

Règles apprises sur la navigation : on tient notre propre pile plutôt que `history.back()`, parce que le garde-fou « modifications non enregistrées » remet la page précédente dans la barre d'adresse pour poser sa question et fausserait l'historique du navigateur. `goBack` traite le cas « on y est déjà » (aucun `hashchange`, donc le drapeau resterait armé et casserait la navigation suivante). Le bouton retour dit toujours où il mène. Piège des fenêtres modales : `#modal-root.innerHTML = …` détruisait la fenêtre du dessous et la saisie en cours ; chaque fenêtre est maintenant une couche, et `onMount` reçoit sa couche, pas tout le conteneur.

Règles apprises sur les composants : un `<select>` reste le bon choix tant que la liste est courte et fermée (statuts, TVA, devise, période) ; `combo()` sert dès que la liste grandit avec les données. Les deux composants gardent leur valeur dans un `<input type="hidden">` nommé, pour que `formValues()` et les gestionnaires `form.onchange` existants continuent de fonctionner sans être réécrits. `closeOverlay` (module app.js) ne garde qu'un seul calendrier ou une seule liste ouverte à la fois. Piège rencontré : `const today = todayIso || today()` dans core.js crée une zone morte temporelle et casse la fonction ; les tests passaient parce qu'ils fournissaient toujours la date de référence — depuis, un test appelle aussi la fonction sans argument.

Règles apprises sur les listes : les totaux du pied de tableau et les exports CSV portent sur la **sélection entière**, jamais sur la page affichée ; toute nouvelle liste doit passer par `paginate` + `sortHead` + `pagerBar` pour rester cohérente ; `bindSort`/`bindPager` prennent un élément racine parce qu'une page peut afficher deux tableaux (Comptabilité, Relances).

Méthode d'audit qui a fonctionné : `test/e2e/entreprise.js` (captures 1440×900 + 1280×800, démo puis états vides juste après l'assistant, chaque modale ouverte), lecture de chaque capture, puis relecture des chemins de code correspondants (validations, confirmations, cas limites).

Non retenu volontairement : synchronisation cloud en temps réel (la 3.2.0 fait du partage de fichier à tour de rôle, pas du multi-utilisateur simultané), e-facture (voir plus haut), barre latérale réductible en icônes (les groupes ont suffi).

## Modules demandés par Skander (11/09/2026), pas encore commencés

Il veut étendre l'app au-delà des ventes. Ordre recommandé et accepté en principe : **achats / fournisseurs / dépenses + TVA déductible** d'abord (c'est la brique dont dépendent les deux suivantes), puis **stock** (entrées par achat, sorties par bon de livraison ou facture, valorisation, numéros de série, rattachement à une affaire), puis **immobilisations** (amortissement linéaire, tableau, VNC, cession), puis **lecture d'une photo de facture** pour préremplir une saisie (jamais d'insertion automatique : formulaire à valider ; suppose une clé d'API payante et l'envoi de l'image hors de l'ordinateur — accord de Skander requis), puis **trésorerie et calendrier fiscal**, et enfin la **paie** (barèmes CNSS/IRPP paramétrables, jamais en dur, et mention invitant le comptable à valider les premiers bulletins). Tous les taux et durées relèvent du « À VÉRIFIER avec ton comptable ».

Ces modules feront passer les données en v4 (migration à écrire) et imposeront de regrouper la barre latérale en Ventes / Achats / Gestion.
**Fait depuis :** 3.0.0 (achats/fournisseurs/dépenses, v4), 3.1.0 (TVA déductible et calendrier fiscal), 3.2.0 (travailler à deux), 3.3.0 (trésorerie), 3.4.0 (marges), 3.5.0 (immobilisations), 4.0.0 (stock, v5), 4.1.0 (séries et garanties), 4.2.0 (photo de facture, éteinte par défaut), 5.0.0 (paie, v6), 5.1.0 (congés, avances et documents du personnel), 5.2.0 (déclarations sociales). **Le plan accepté le 11/09/2026 est intégralement livré.**

## Repéré par l'audit du 11/09/2026 — les huit constats, corrigés en 5.2.1

Constats laissés de côté en 2.4.0 et repris en bloc en **5.2.1**. Tous corrigés, gardés ici parce qu'ils décrivent des règles à ne pas casser :

- Choisir un logo ou un cachet dans Paramètres écrasait les modifications non encore enregistrées du formulaire → `setImage()` appelle `applySettings()` **avant** de redessiner. Toute action de Paramètres qui provoque un `render()` doit faire pareil.
- Relances et Comptabilité étaient les deux seules pages de liste sans recherche → `relState.q` / `comptaState.q` ; quand un filtre est actif, la page **écrit** que les totaux ne portent que sur la sélection.
- Un modèle de document ne se modifiait pas → `templateForm(tpl, done)` (nom, type, remise, objet, notes, lignes avec sélecteur de catalogue).
- La suppression était incohérente (fiche pour les clients, ligne pour le reste) → elle vit désormais **dans la fenêtre de modification**, partout (`clientForm`, `catalogForm`, `snippetForm`, `templateForm`, `recurrenceForm`) ; plus aucun « Supprimer » en bout de ligne. La confirmation nomme ce qui est rattaché (documents portant la prestation, factures issues du contrat, stock restant).
- Les notes internes d'un client s'enregistraient en silence → la fiche le dit et affiche un « ✓ enregistré » passager (`#cl-notes-saved`).
- Clients et Catalogue n'avaient pas de pied totalisé → `drawList` accepte `opts.foot(kept, all)` ; comme pour les autres listes, le pied porte sur la **sélection entière**, pas sur la page affichée.
- « Documents récents » vide n'offrait rien → propositions concrètes (`#start-client`, `#start-devis`, `#start-cat`, `#start-demo`).
- Les boutons de ligne étaient invisibles hors survol sur Clients et les documents → `td.row-actions > span` passe de `opacity: 0` à `.45` (et `1` au survol).

## 6.0.0 — La clôture de période

`data.closedUntil` (dernier jour clôturé) + `data.closureLog` (chaque clôture et réouverture, avec motif). Dans core.js : `isClosedDate`, `closedPeriodLabel`, `closableMonths`, `closureChecks`, `closePeriod`, `reopenPeriod`, `closureLog`. Dans app.js : **`closedBlock(dates, quoi)`** — une seule porte pour toute l'application, qui affiche la fenêtre d'explication et renvoie `true` si c'est refusé ; `closedToast` pour les actions de liste ; `closedWipeOk` pour les remplacements en masse. Onglet **Comptabilité → Clôtures**, ligne « À faire » à dix jours.

Règles apprises :
- **Tester l'ANCIENNE date autant que la nouvelle** quand on modifie une pièce. Sans ça, il suffirait de changer la date d'une facture de mars pour la sortir d'un mois déjà déclaré, et la TVA de mars changerait en silence.
- **Le garde-fou se pose AVANT `nextNumber`.** `nextNumber` écrit `data.counters` même si l'enregistrement échoue ensuite : posé après, chaque refus aurait troué la numérotation. C'est ce qui a révélé que `issue()` consommait le numéro avant d'enregistrer (corrigé), et que l'export PDF d'un brouillon ignorait l'échec de `persist()` et exportait une pièce non écrite (corrigé).
- **Les contrôles avant clôture ne bloquent jamais.** Un mois clôturé avec deux manques signalés vaut mieux qu'un mois jamais clôturé parce que l'app faisait la difficile.
- **Une réouverture exige un motif** : c'est la seule trace qui explique au comptable pourquoi un chiffre a changé après son envoi.
- Un remplacement en masse (démo, import, effacement) **prévient** au lieu de refuser : c'est un geste volontaire.
- Méthode qui a payé : un workflow de 18 agents a recensé **347 points d'écriture datés** famille par famille, puis proposé le garde-fou de chacun. Il a trouvé cinq écritures manquées à la main, dont les deux fautes ci-dessus. À refaire avant toute règle transversale de ce genre.

## 6.1.0 — Le paquet mensuel (`.skanpack`)

Nouveau module **`src/zip.js`** (Node pur, testé sans Electron) : `zipBuffer`/`zipRead` écrivent et relisent un vrai ZIP sans aucune dépendance, `sealBuffer`/`openBuffer`/`sealHeader` scellent en AES-256-GCM + scrypt. Dans core.js : `packPeriod`, **`packPlan`** (la liste exacte de ce qui partira, pure et testable), `packChecklist`, `packCoverHtml`, `packFileName`, plus les colonnes de journaux (`salesCsvColumns`…) que app.js réutilise. Dans main.js : `pack:build` exécute le plan (PDF, empreintes, zip, scellement, écriture atomique). Onglet **Comptabilité → Cabinet**, `data.packs` pour l'historique.

Règles apprises :
- **Le paquet est un ZIP ordinaire**, pas un format maison. Le comptable doit pouvoir l'ouvrir avec le Finder même si SkanFact disparaît : on ne devient jamais le seul lecteur possible des pièces comptables de quelqu'un d'autre.
- **Le renderer décide du contenu, main.js ne fait qu'exécuter.** `packPlan` est pur : tout le contenu du paquet se teste sans lancer Electron, et l'utilisateur voit ce qui partira **avant** la fabrication.
- **Un fichier introuvable ne fait pas échouer l'envoi** : le paquet part sans lui et le manifeste le dit (`absents`). Mieux vaut 99 % avec le trou signalé qu'un envoi qui échoue.
- **L'entête d'un paquet scellé reste en clair** (nom, mois) : sans elle, un paquet mal rangé serait impossible à identifier avant d'avoir la clé. Le corps est binaire, pas base64 — sur 50 Mo de photos, base64 ajouterait 17 Mo pour rien.
- **Le manifeste s'écrit en dernier** : il porte l'empreinte des fichiers réellement produits, et ne peut pas contenir la sienne (un test le vérifie).
- Piège JavaScript : `0o100644 << 16` devient **négatif** (décalage sur 32 bits signés) et `writeUInt32LE` le refuse — d'où le `>>> 0` sur les droits Unix du répertoire central.
- Un JPEG ou un PDF ne se recompresse pas : deflate les rallonge. `ALREADY_COMPRESSED` les passe en mode « stocké ».
- Le workflow de conception à trois approches a **échoué** (schéma de sortie à neuf champs obligatoires : les agents n'ont jamais produit de sortie valide en cinq essais). Leçon : un schéma structuré doit rester court, ou la conception se fait à la main.

## 6.2.0 — L'appairage du cabinet

`company.cabinet = { name, email, publicKey, fingerprint, pairedAt }`. Dans zip.js : `generateCabinetKeys` (X25519), `keyFingerprint` (SHA-256 de la clé, cinq groupes de quatre — assez court pour être dicté au téléphone), `sealForCabinet` / `openWithCabinetKey` / `cabinetHeader`. Dans main.js : `cabinet:import` lit un `.skanpair` et **recalcule l'empreinte** au lieu de croire celle du fichier. Onglet **Paramètres → Cabinet comptable**.

Règles apprises :
- **Une clé publique ne se protège pas, elle se vérifie.** Le fichier d'appairage ne contient rien de secret ; le seul risque est qu'il vienne d'un imposteur, d'où l'empreinte à lire de vive voix. `cabinet:import` refuse un fichier dont l'empreinte annoncée ne correspond pas à la clé qu'il contient.
- **Une clé éphémère par paquet** : deux envois du même mois ne donnent jamais deux fichiers identiques, et compromettre un paquet ne compromet pas les autres.
- L'entête reste en clair (entreprise, mois, empreinte du destinataire) : un paquet mal rangé doit rester identifiable sans clé.
- Trois niveaux dans `pack:build`, dans cet ordre : cabinet appairé → mot de passe → rien. Quand un cabinet est appairé, le champ mot de passe **disparaît** de l'écran plutôt que de rester là à ne servir à rien.

## Règle apprise en 5.2.3 : les dates et le fuseau horaire

**La machine de test est en UTC ; l'utilisateur est à Tunis (UTC+1).** `addDays` construisait la date en heure locale (`new Date(iso + 'T00:00:00')`) et la relisait en UTC (`toISOString()`) : à minuit à Tunis il est 23 h la veille en UTC, donc `addDays(d, 1)` renvoyait `d`. Depuis toujours, une échéance à 30 jours tombait un jour trop tôt chez lui ; depuis la 5.1.0, la boucle jour par jour de `workingDays` ne finissait jamais et l'app entière gelait au chargement de la démo (qui contient des congés). Sur la machine en UTC, **rien ne se voyait** : quatre reproductions différentes, tous les chronométrages, la vraie 5.1.0 dans Electron — tout passait. C'est le bisect fait à la main par Skander (3.4 → 4.2 → 5.0 ok, 5.1 gèle) qui a désigné `workingDays`, et la question « qu'est-ce qui diffère entre sa machine et la mienne ? » qui a donné le fuseau.

Règles :
- Une date de l'app est un **jour du calendrier** (`AAAA-MM-JJ`), jamais un instant. Toute arithmétique se fait en **UTC pur** : `new Date(iso + 'T00:00:00Z')`, `setUTCDate`, `getUTCDay`, `Date.UTC(...)`. Jamais `new Date(y, m, d)` ni `T00:00:00` sans `Z` ni `getDay()`.
- `today()` est l'exception : c'est le jour **local** (composantes `getFullYear/getMonth/getDate`), parce que c'est le calendrier de l'utilisateur. Un instant enregistré (`createdAt`, `at` d'un paiement) se convertit en jour local de la même façon, jamais par `toISOString().slice(0, 10)`.
- Jamais de boucle qui avance une chaîne de date « jusqu'à » une autre : compter des jours sur des instants UTC, avec une borne.
- Le test « dates : le même résultat à Tunis… » change `process.env.TZ` à chaud sur cinq fuseaux. Toute nouvelle fonction de date s'y ajoute.
- Symptôme à reconnaître : un bug **que la machine de test ne reproduit jamais** malgré des données identiques → chercher ce qui diffère dans l'environnement (fuseau, locale, plateforme, heure) avant de chercher dans le code. Un gel sans aucune erreur, Cmd+Q sans effet, défilement qui marche encore = boucle infinie JavaScript (le défilement est composé hors du fil principal).

Idée gardée pour plus tard, non livrée : un chien de garde dans `main.js` qui interroge l'interface toutes les 3 s et, sans réponse, branche `webContents.debugger` pour lire la pile (le domaine Debugger doit être activé **avant** le gel, sinon `Debugger.enable` attend le fil bloqué) puis `Runtime.terminateExecution`. Utile pour un produit vendu : un gel deviendrait un rapport dans `main.log`.

## Règle apprise en 5.2.2 : l'ordre des couches

Un bouton parfaitement visible peut être inerte. Une fenêtre modale (`.modal-bg`, z-index 400 et au-dessus, empilée par `modal()` depuis la même base) doit couvrir **tout** écran qui occupe la fenêtre entière — l'assistant `#setup` (250), `#lock-screen` (200), `#palette-root` (60) — et rester sous `#info-pop` (900) et `#toast` (950), qui doivent se lire par-dessus elle. Avant la 5.2.2, une confirmation ouverte depuis l'assistant s'affichait derrière lui : les clics atterrissaient sur l'écran du dessus.

Ce bug n'était visible dans **aucune** console : rien ne plante, le clic n'existe simplement pas. Les deux signes à reconnaître, parce qu'aucune trace n'en sera jamais laissée : un bouton qui finit par répondre **après plusieurs essais** (on tombe sur un pixel où il passe devant), et un **curseur qui change de forme d'un pixel à l'autre** (`elementFromPoint` renvoie tantôt le bouton, tantôt l'écran du dessus). Devant ce symptôme, la première chose à faire est `document.elementFromPoint(x, y)` au centre du bouton, pas la lecture des erreurs.

Une promesse posée par une boîte de dialogue doit **toujours** se résoudre : `modal()` prend un `onDismiss`, et Échap comme le clic à côté valent « Annuler ». Une promesse en suspens bloque son appelant pour toujours, sans erreur.

Le test `couches : une question passe au-dessus de tout` lit `style.css` et `app.js` et vérifie cet ordre sans Electron.

## Le plan Cabinet (12/09/2026) — `PLAN-CABINET.md`

Skander veut vendre SkanFact aux entreprises **en passant par les cabinets comptables** : cabinet gratuit (app **SkanFact Cabinet**, même dépôt, second installeur), entreprise payante, remise pour le client parrainé, jamais de commission au comptable (déontologie À VÉRIFIER). Pas de serveur en v1 : les deux apps s'échangent un **paquet mensuel chiffré** (`.skanpack`). Le plan complet, les versions dans l'ordre (6.0.0 clôture → 6.1.0 paquet → 6.2.0 appairage → Cabinet 1.0.0 → Cabinet 1.1.0 export d'écritures → 6.3.0 licence/mises à jour publiques → 6.4.0 signature → 6.5.0 filets → 7.0.0 serveur seulement si un cabinet dit oui) et l'inventaire (achats, décisions, questions au comptable, vérifications légales) sont dans **`PLAN-CABINET.md`**. Le lire avant de commencer une version 6.x. Règles fixées : l'app cabinet **ne modifie jamais** les données du client ; un paquet n'est **définitif** que si le mois est clôturé ; l'empreinte du cabinet est **à la fois** la clé de chiffrement et la preuve du parrainage ; à l'expiration d'une licence, **jamais de données en otage**.

## Cabinet 1.0.0 — la seconde application

`src/cabinet/` : une **autre application Electron dans le même dépôt**, construite par `build/cabinet.config.js` (`appId` `tn.skancyber.skanfact.cabinet`, `extraMetadata.main` → `src/cabinet/main.js`, sortie `dist-cabinet/`, `publish: null`). Sa version vit dans `cabinetVersion` de package.json, indépendante de celle de l'app entreprise ; le workflow Release la construit après l'app principale et attache ses installeurs à la même release (`gh release upload`). Elle n'a **pas** de mise à jour automatique (pas de `latest.yml` : deux flux electron-updater dans une même release s'écraseraient) — assumé en 1.0.0.

- `src/cabinet/cabcore.js` : logique pure, testée sans Electron — `migrate`, `dossierKey` (**matricule d'abord**, nom en repli), `packSummary`, `filePack`, `dossierMonths`/`dossierRow`/`dossierList`, `cabinetTodo`, `monthListLabel`/`missingLabel`/`relanceMail`, `pairingFile`, `demoDossiers`.
- `src/cabinet/main.js` : état chiffré (`cabinet-data.json`, scrypt + AES-256-GCM, mot de passe **obligatoire**), `safeState()` (la clé privée ne traverse jamais le pont), IPC `cab:status|unlock|state|saveCabinet|saveDossier|demo|exportPairing|importPack|listPack|openInPack|mail|reveal`, `ingest()` qui **recalcule chaque empreinte du manifeste**.
- `src/cabinet/renderer/` : `index.html`, `app.js`, `cabinet.css` — le reste vient de `../../renderer/style.css`, partagé.
- `build/icon-cabinet.png` : même langage visuel, fond ardoise, dossier au lieu de la feuille.

Règles apprises :
- **L'application cabinet ne modifie jamais les données d'un client et ne lui renvoie rien.** Le préchargement ne l'expose même pas : un test vérifie qu'il ne contient ni `data:save` ni `pack:build`, et qu'aucun handler ne renvoie `state` brut au lieu de `safeState()`.
- Un dossier s'identifie par le **matricule fiscal**, jamais par le nom : un nom change de forme juridique, se corrige, et deux clients peuvent s'appeler pareil. Sans matricule seulement, on retombe sur le nom normalisé.
- Un mois **reçu deux fois** n'est pas une erreur, c'est une information : le client a rouvert sa période. `filePack` renvoie `replaced`/`wasDefinitive`/`nowDefinitive` et l'interface le **dit**, surtout quand le remplacé était définitif.
- Le **mois en cours n'est jamais réclamé**, et rien n'est réclamé avant le premier paquet reçu : on ne réclame pas le néant.
- Un logiciel qui écrit « 1 dossier(s) » ou « de octobre » paraît bâclé — et c'est le premier contact d'un comptable avec SkanFact. D'où `pl()` des deux côtés, `de()` pour l'élision, et `missingLabel` qui donne l'intervalle au-delà de trois mois (un objet de mail qui énumère onze mois n'est plus lu).
- **Un bouton sans bordure ni couleur n'est pas un bouton.** En 1.0.0 l'exemple se chargeait par un `btn-ghost` centré au milieu d'un cadre pointillé : Skander a ouvert l'application et a dit « elle est vide, il manque le jeu de données ». Une proposition faite au premier lancement doit ressembler à ce qu'elle est — deux vrais boutons côte à côte, et la même action répétée dans les Réglages, là où on va la chercher quand on ne l'a pas trouvée (corrigé en 1.2.0). Au passage : un écran sans aucune donnée ne montre ni recherche, ni filtre, ni « 0 sur 0 », et surtout pas un « tout est à jour » qui parle de dossiers qui n'existent pas.
- Le **jeu d'exemple** (`demoDossiers`) montre les quatre situations et s'efface tout seul au premier vrai paquet : des retards imaginaires à côté des vrais seraient pires que rien. Ses paquets n'ont pas de `path`, donc l'interface ne propose pas de les ouvrir.
- Depuis la 6.2.1 le manifeste porte `chiffres` (CA, TVA collectée/déductible, à décaisser, encaissé) et `compte` : le cabinet affiche le chiffre d'affaires du dossier sans ouvrir un CSV. Champ **facultatif à la lecture** — un paquet plus ancien n'en a pas, et on écrit « — », jamais zéro.
- « 7 pièces vérifiées, intactes » est la **seule affirmation rigoureuse** de l'app cabinet : elle doit compter juste. Le manifeste ne se liste pas lui-même (il ne peut pas porter sa propre empreinte), et un fichier **absent** n'est pas un fichier vérifié. La règle vit dans `cabcore.checkIntegrity(manifest, hashes)` — pure et testée — pendant que main.js se contente de calculer les empreintes. Corrigé en 6.5.2 : le code retranchait un de trop.
- Les quatre cas tordus à retester après toute modification de `ingest` (`test/e2e/cabinet-refus.js`) : un fichier qui n'est pas un paquet, le même mois reçu deux fois, un paquet adressé à un autre cabinet, un paquet protégé par mot de passe. Chacun doit donner une phrase en français que le comptable comprend sans appeler personne.
- Le test qui compte est `test/e2e/boucle-complete.js` : **deux vraies applications Electron** à la suite — le cabinet exporte son appairage, l'entreprise l'importe et fabrique un paquet, le cabinet le reçoit, l'ouvre et prépare la relance. C'est le seul qui prouve que le plan tient debout ; le relancer avant toute release touchant au paquet ou à l'appairage.

## 6.3.0 — Les écritures comptables (aussi Cabinet 1.1.0)

Dans core.js : `DEFAULT_ACCOUNTS` + `ACCOUNT_LABELS` + `ENTRY_JOURNALS`, `chartAccounts(data)` (surcharge par `data.chartAccounts`), `journalEntries(data, company, period, opts)`, `entriesBalance`, `entriesByAccount`, `entryCsvColumns`. `packPlan` ajoute `journaux/ecritures.csv` et renvoie `balance` ; la page de garde l'annonce. Dans app.js : onglet **Comptabilité → Écritures** (`ecrState`, tri, pagination, export CSV, envoi au comptable) et `chartForm`.

Règles apprises :
- **Aucun numéro de compte n'est une vérité.** Ceux proposés suivent l'usage tunisien ; chaque cabinet a les siens. Tout est modifiable, et la page, la bulle et l'aide écrivent « À VÉRIFIER ». Ce qui est garanti, c'est l'**équilibre** : débit = crédit sur chaque pièce, vérifié sur les 24 mois du jeu de démonstration.
- **Un montant négatif change de colonne, il ne garde pas son signe.** Un avoir s'écrit D ventes / D TVA / C client. Aucun logiciel comptable n'accepte un débit négatif — c'est ce qui aurait fait refuser le fichier à l'import, sans que personne comprenne pourquoi.
- Les arrondis de TVA ligne par ligne peuvent laisser quelques millimes d'écart : `entrySet.done()` les absorbe sur la dernière ligne plutôt que de livrer une pièce déséquilibrée.
- Une facture **annulée** ne produit aucune écriture : comptablement, elle n'a jamais existé.
- Piège : `toCsv` attend des colonnes `{key, label, type}`. Une liste de paires `['date','Date']` produit un fichier **sans entête**, et rien ne plante — d'où le test qui vérifie la première ligne au caractère près.

## 6.4.0 — La licence hors ligne

`src/licence.js` (Node pur, testé) : `generateKeys`, `signLicence`, `parseKey`, `verifyKey`, `licenceState`, `requestMail`. `scripts/licence.js` fabrique les clés (privée en mode 600 dans `~/.skanfact/`, **jamais** dans le dépôt ; publique dans `build/licence-public.json`, à commiter). Dans main.js : `licence:status` / `licence:set` (refuse une clé invalide au lieu de la stocker) / `licence:requestMail`, `installedAt` dans `app-config.json`. Dans app.js : `licenceBlock(quoi)` — une seule porte, comme `closedBlock` — et l'onglet **Paramètres → Licence**.

Règles apprises :
- **Jamais de données en otage.** Une licence expirée ne bloque QUE la création de nouvelles pièces. Lire, imprimer, exporter, sauvegarder, envoyer le paquet au comptable : toujours. Un test relit `app.js` et vérifie qu'aucun `licenceBlock` n'est posé ailleurs que sur une création.
- **Modifier une pièce existante reste possible** même bloqué : sinon une licence expirée empêcherait de corriger une faute de frappe.
- **L'application est livrée désarmée.** Sans `build/licence-public.json`, l'état est `libre` et rien ne se verrouille — un test vérifie que le fichier n'est pas dans le dépôt. Armer la licence est une décision du propriétaire, pas l'effet de bord d'une mise à jour.
- Aucun appel réseau : la clé est vérifiée sur le poste. Une entreprise sans connexion ne doit pas perdre sa facturation, et l'app doit survivre à la disparition de son éditeur.
- `plainError(e)` : une erreur venue du processus principal arrive habillée en « Error invoking remote method '…': Error: … ». On ne montre que la phrase écrite pour l'utilisateur.

## 6.5.0 — Le chien de garde (les filets)

`startWatchdog(win)` dans main.js, `alive:ping`/`alive:pong`, `freeze:notice`, `support:info`, `support:openLog` ; « Signaler un problème » dans l'Aide.

Règles apprises — les quatre, tenues par un test qui relit la source :
1. **`Debugger.enable` s'active AVANT le gel.** Demandé pendant, il attend le fil bloqué et n'arrive jamais.
2. **`Debugger.resume` AVANT `Runtime.terminateExecution`.** Interrompre une machine virtuelle en pause ne rend jamais la main — le chien de garde gèle à son tour, et c'est ce qui est arrivé à la première version.
3. **Aucune fenêtre synchrone.** `showMessageBoxSync` bloque le processus principal tant que personne ne répond ; devant une application figée, personne ne peut répondre. On recharge sans rien demander, puis on **dit** ce qui s'est passé — un redémarrage silencieux ferait douter de ce qui a été enregistré.
4. **Chaque commande au débogueur est bornée** (`Promise.race`) : le surveillant ne doit jamais pouvoir geler.

Autre règle : les abonnements aux messages du processus principal (`onAlivePing`, `onFreezeNotice`) se posent **avant** la séquence de démarrage. L'assistant de première utilisation la met en attente, et tout message reçu pendant ce temps était perdu.

Et une cinquième, trouvée en 6.5.1 : **un seul programme peut inspecter la page à la fois.** Le chien de garde se détache quand les outils de développement s'ouvrent et se rattache quand ils se ferment — sinon ouvrir les outils le débranchait en silence, et on se croyait surveillé sans l'être.

Le test qui compte est `test/e2e/chien-de-garde.js` : il **gèle vraiment** l'application avec une boucle infinie et vérifie que le journal nomme la fonction coupable. C'est le test qu'on aurait voulu avoir en 5.1.0.

## 6.7.0 — Le relais de mise à jour

`worker/skanfact-maj.mjs` (module ES, déployé sur Cloudflare Workers, gratuit) + `worker/README.md`. Il détient le jeton GitHub ; les applications présentent le **secret de l'application** (`PKG.updateSecret`) et, si elles en ont une, leur **licence**. `route`, `fichierAutorise`, `memeSecret`, `licenceValide` et `autorise` sont purs et testés dans `npm test` (le module ES s'importe avec `await import`).

Côté applications : `relayBase()` dans `src/main.js` et `src/cabinet/main.js`. `updateBase` et `updateSecret` arrivent par `extraMetadata` **à la construction** (secrets `UPDATE_BASE`/`UPDATE_SECRET` du dépôt) — jamais dans Git, conformément à la règle « ne jamais commiter de token ».

Règles apprises :
- **Tout ce qu'une application peut télécharger sans secret, un inconnu le peut aussi.** Il n'y a pas de mise à jour automatique « privée » sans déplacer le secret côté serveur. Un jeton embarqué dans l'app arrête les curieux, pas quelqu'un qui ouvre le paquet.
- **Le repli doit exister** : sans réglages de relais, les deux applications retombent sur GitHub + jeton saisi à la main. Une version livrée ne doit jamais dépendre d'un service que personne n'a encore déployé. Un test le vérifie.
- **Une licence expirée reçoit quand même les mises à jour.** Elle limite la création de pièces dans l'app, pas le droit de recevoir une correction de bug. `LICENCE_REQUISE=1` existe pour le jour où tous les clients auront une licence.
- **Un canal ne doit jamais pouvoir réclamer les fichiers de l'autre** : sinon l'app du comptable proposerait d'installer l'app entreprise, sans que rien ne plante.
- Piège du harnais de test : `t('…', async () => …)` affichait **« ok » sans rien vérifier** — la promesse n'était pas attendue, et le test ne pouvait plus jamais échouer. `t()` refuse maintenant une fonction asynchrone, et `ta()` existe pour ce cas. Vérifié en cassant volontairement une assertion.

## 6.7.2 — Une panne de mise à jour se nomme

Relais branché pour de vrai chez Skander : « Vérifier les mises à jour » répondait **« Module de mise à jour indisponible. »**, et ni lui ni moi ne pouvions rien en faire — `getUpdater()` attrapait l'erreur dans un `catch` muet. Le test `mises à jour : une panne se nomme, et laisse un recours` relit les quatre fichiers concernés et interdit les deux fautes.

Règles apprises :
- **Un `catch` qui jette la cause condamne l'utilisateur ET le dépannage à distance.** `updaterError` garde la phrase, le message la montre, `logToFile` l'écrit. Un diagnostic vaut une version à lui seul quand la boucle de correction coûte une réinstallation manuelle.
- **Un chemin de secours ne sert que s'il se déclenche tout seul.** Le repli GitHub existait depuis la 6.7.0, mais seulement quand le relais n'était **pas configuré** — pas quand il était configuré et cassé, le seul cas qui arrive vraiment. Désormais `configureFeed` valide l'adresse (`new URL`) et retombe sur GitHub en cas d'échec.
- **Un relais en panne n'est pas un relais** : `update:version` renvoie `relay: false` dans ce cas, sinon l'écran continue d'afficher « rien à configurer » pendant que plus rien ne peut se mettre à jour, et le champ jeton — la seule issue — reste caché.
- **Tout ce qui arrive d'un copier-coller se `trim()`** avant usage. C'était **la cause exacte** : le secret `UPDATE_BASE` contenait une espace en fin (un copier-coller d'adresse en attrape une sans qu'on la voie). `new URL('https://…workers.dev /app')` **lève** — une espace n'a pas le droit d'exister dans un nom de domaine — alors qu'un retour à la ligne, lui, est silencieusement supprimé par l'analyseur d'URL. Vérifié à l'identique : 6.7.1 (sans `trim`) échoue, 6.7.2 (avec) fonctionne, avec les mêmes valeurs.

Méthode qui a payé, à refaire : **séparer les deux moitiés avant de chercher**. Le testeur HTTP de Cloudflare, avec l'en-tête `X-SkanFact-App` posé à la main, a renvoyé `200` et le vrai `latest-mac.yml` — le relais et le jeton GitHub étaient donc hors de cause, et il restait l'application. Sans cette manipulation, on cherchait dans deux systèmes à la fois.

**Le quota GitHub Actions est une ressource limitée.** Six versions publiées en une matinée ont consommé le quota gratuit d'un mois entier (~0,65 $ la publication : quatre applications, et les machines macOS sont facturées dix fois les autres). Skander a refusé de payer, et il a raison : c'est le rythme qui était fautif, pas le tarif. **Regrouper les corrections et publier une fois.** Quand le quota manque, `Installer SkanFact.command` construit les deux applications sur son Mac, avec le relais, gratuitement — c'est ce qui a permis de diagnostiquer cette panne-là.

## 6.7.3 — Jamais de retour en arrière

`autoUpdater.channel = 'cabinet'` met **`allowDowngrade` à `true`** : c'est écrit dans la documentation d'electron-updater (changer de canal peut légitimement vouloir dire reculer), et l'app du cabinet est la seule à déclarer un canal. Résultat : en 6.7.2 elle téléchargeait la 6.7.1, c'est-à-dire qu'elle proposait de réinstaller le défaut qu'on venait de corriger — et précisément celui qui cassait la mise à jour, donc sans retour possible.

Règles :
- **`allowDowngrade = false` se repose APRÈS l'affectation du canal**, jamais avant. Le test `mises à jour : une panne se nomme, et laisse un recours` vérifie l'ordre des deux lignes dans la source, et a été prouvé en retirant le correctif.
- **Un réglage qui s'active en effet de bord d'un autre est un piège à relire dans la source du module**, pas dans son README. C'est la deuxième fois de la journée qu'une ligne d'electron-updater se comporte autrement qu'attendu.
- Ce bug ne se voyait que parce que la version installée (construite localement) était **plus récente** que celle publiée. Un écart de ce genre est un révélateur à exploiter, pas une anomalie à ignorer.

Autre règle posée au même moment : **le mode développement écrit dans un dossier séparé** (`SkanFact (essais)` / `SkanFact Cabinet (essais)`), et `--user-data-dir` reste prioritaire pour que les tests s'isolent. `package.json.name` vaut `skanfact` et `productName` vaut `SkanFact` : sur macOS, dont le système de fichiers ignore la casse, c'était **le même dossier**. `npm start` travaillait donc sur les vraies factures de l'utilisateur — un accident qu'on ne découvre qu'après.

## 6.8.0 — Cabinet 2.0 : ne rien perdre, voir tout le portefeuille, travailler

Audit de l'app cabinet (24 constats dans `PLAN-CABINET.md`) traité en bloc. Nouveau module **`src/cabinet/cabstore.js`** (Node pur, testé) : sauvegarde quotidienne (l'état du matin, 30 jours), sauvegardes nommées avant import et avant suppression, `peek`/`restore`, copie externe qui emporte **aussi les paquets**, `makeRecovery`/`readRecovery` (clé de secours), `setPassword` qui rechiffre les sauvegardes, fichier illisible mis de côté, `reorganize` (paquets rangés par client/année), `removeDossierFiles`, `packStats`. Dans cabcore : `newDossier`, `parseDossierLines`, `noteRelance`, `portfolio`, `relanceDue`, `relanceRows`, `echeances`/`dayOf`, `parseCsv`/`mergeEcritures`/`ecrituresPlan`. Nouvelles pages **Échéances** et **Écritures**, assistant de première utilisation, `cabguide.js` (30 bulles + 7 articles).

Règles apprises :

- **La sauvegarde est le seul point où un incident coûte vraiment cher.** L'app cabinet détient la comptabilité de dizaines d'entreprises ET la clé qui ouvre leurs paquets, et elle n'avait rien. La clé de secours exportable est le filet qui manquait le plus : sans elle, perdre le poste rend illisible **pour toujours** tout ce qui a été reçu. L'écran le dit en rouge tant qu'elle n'a pas été enregistrée.
- **Perdre le fichier principal ne doit pas ressembler au premier jour.** Sauvegardes présentes + base absente : l'écran le dit et emmène aux sauvegardes, il n'ouvre pas un assistant de bienvenue. Et le piège qui n'apparaît qu'à ce moment-là : chaque création tire un **nouveau sel**, donc le même mot de passe ne donne pas la même clé et les sauvegardes paraissent verrouillées. `peek` réessaie avec le sel de la sauvegarde ; le mot de passe est gardé en mémoire pour la session à ce seul usage (la clé dérivée y est déjà, ce n'est pas un affaiblissement). Trouvé par `npm run e2e:perte`, invisible autrement.
- **Une restauration dit d'abord ce qu'on va perdre** (dossiers et paquets de la sauvegarde contre ceux d'aujourd'hui) et met l'état actuel de côté avant d'écraser. Sinon c'est un pari, pas une restauration.
- **Changer le mot de passe rechiffre les sauvegardes.** Une sauvegarde restée sur l'ancien mot de passe n'est pas une sauvegarde. Et l'ancien mot de passe est **revérifié en relisant le fichier** : sans ça, quelqu'un qui passe devant un poste déverrouillé le changerait sans le connaître.
- **Une fonction appelée mais jamais définie ne se voit nulle part avant l'exécution** — ni à la lecture, ni au `node --check`, ni dans les tests qui ne touchent pas cette ligne. C'est ainsi que `h(a.relayFailure)` (copié de l'app entreprise, où la fonction d'échappement s'appelle `h` et non `esc`) a atterri dans le renderer du cabinet : le panneau des mises à jour plantait **au moment précis où il devait annoncer une panne**. Le test `l'interface n'appelle aucune fonction qui n'existe pas` lit le code sans les commentaires ni le texte des chaînes, **mais en gardant les `${…}` des gabarits** — c'est là qu'il était. Son analyseur est un automate (pile gabarit/interpolation, détection des expressions régulières) : une version à coups d'expressions régulières se désynchronise sur `/'/g` et sur les gabarits imbriqués. Il se prouve lui-même sur un cas fabriqué avant de juger le vrai code.
- **L'app cabinet charge `style.css` (partagée) PUIS `cabinet.css`.** Une classe portant le même nom des deux côtés prend en silence les règles de l'autre application. L'assistant du cabinet utilisait `.setup-card` / `.setup-step`, que style.css réserve au « étape 3 sur 5 » de l'app entreprise — avec `white-space: nowrap`. Le texte ne revenait pas à la ligne, les boutons sortaient de la fenêtre, et **rien n'apparaissait en console**. Classes renommées `wiz-*`, et un test interdit qu'une classe propre au cabinet porte un nom déjà pris dans la feuille partagée. Méthode qui a tranché : **mesurer dans l'application réelle** (`scrollWidth` contre `clientWidth`, `getComputedStyle`) plutôt que relire le CSS.
- **`.modal-actions` n'est stylé que dans `.modal`.** Utilisé dans un panneau, il ne produit aucune mise en page : les boutons restaient collés au texte.
- **Un test qui lit du code doit lire du CODE.** Le garde-fou « l'app cabinet ne doit rien pouvoir écrire chez un client » échouait sur un commentaire qui citait les deux appels interdits pour expliquer la règle. Les commentaires sont retirés avant de juger — et le test vérifie ensuite que le nettoyage n'a pas mangé le code.
- **Un cabinet a soixante clients, dont deux sur SkanFact.** Tant qu'on ne pouvait pas créer un dossier à la main, l'application ne montrait que ces deux-là. Un dossier « hors SkanFact » compte dans le portefeuille, ne se voit **rien réclamer**, et devient un dossier ordinaire tout seul au premier paquet (même clé : `dossierKey`, matricule d'abord). Et l'ajout se fait **en collant une liste** depuis un tableur : un par un dans un formulaire, personne ne le ferait, et l'app serait vide le jour de la démonstration.
- **`hors` n'est pas `ok`.** Un client qui n'utilise pas SkanFact n'a rien envoyé, mais il n'est pas en retard. Les confondre afficherait « tout est à jour » à un cabinet dont cinquante-huit clients sur soixante n'envoient rien.
- **Le matricule fait l'identifiant : le corriger doit corriger l'identifiant**, tant qu'aucun paquet n'est arrivé. Sinon le premier envoi du client crée un **second** dossier à côté du premier. Le défaut réel était plus bête : `matricule` ne figurait dans aucune liste de champs enregistrables. Trouvé par le parcours réel, invisible à la relecture.
- **Une échéance vaut par ce qui lui manque.** Un calendrier de dates, un comptable en a déjà un ; ce que personne ne fait pour lui, c'est nommer les clients dont il n'a pas les pièces avant la date. « À faire » ne remonte l'échéance que si des pièces manquent : une échéance proche mais complète n'a pas à crier. Aucune date ne fait foi (« À VÉRIFIER » sur la page), toutes sont réglables, et un réglage aberrant retombe sur l'usage plutôt que de faire **disparaître** l'échéance.
- **Le jeu d'exemple compte dans les échéances** (elles n'ont besoin que des mois reçus, pas des fichiers) mais **jamais dans l'export d'écritures** (qui lit de vrais paquets sur le disque). Le contraire montrerait un calendrier vide à qui découvre l'application.
- **Associer les colonnes d'un CSV par NOM, jamais par position.** Un client sous une autre version de SkanFact n'a pas les mêmes colonnes ; aligner à l'aveugle met des montants dans « Tiers » sans que rien ne plante. Et le lecteur de CSV est un vrai lecteur : un libellé de facture contient un point-virgule un jour sur dix.
- **Un paquet illisible ne fait pas échouer un export** : le fichier part avec le reste et le manque est nommé — même règle que `absents` dans le manifeste du paquet mensuel.
- **Les fautes de français se voient sur capture, pas dans les tests** : « 2 en retards », « 3 sans le moiss », « TVA de octobre ». Le helper `de()` existait depuis la 1.0.0 et n'était pas utilisé au bon endroit. Relire les captures reste indispensable.
- Le test qui compte est `test/e2e/cabinet.js` (16 étapes dans l'app réelle) ; `test/e2e/boucle-complete.js` prouve toujours la boucle entreprise → paquet → cabinet, et vérifie désormais l'export d'écritures **sur un vrai paquet**. Les deux doivent être relancés après toute modification du cabinet.

### Les tests qui ouvrent vraiment l'application

Ils vivent dans **`test/e2e/`** et se lancent par `npm run e2e:<nom>` (sous `xvfb-run -a` sur une machine sans écran) :

| Commande | Ce qu'elle prouve |
|---|---|
| `npm run e2e:entreprise` | l'app entreprise, écran par écran |
| `npm run e2e:cabinet` | l'app cabinet : verrou, assistant, portefeuille, relances, sauvegardes, suppression **et récupération**, échéances, écritures |
| `npm run e2e:boucle` | les DEUX applications à la suite : cabinet → appairage → entreprise → paquet → cabinet → écritures regroupées |
| `npm run e2e:refus` | les cinq cas tordus de l'import (fichier tronqué, mois reçu deux fois, paquet d'un autre cabinet, paquet protégé, **fichier glissé dans le paquet après coup**) |
| `npm run e2e:perte` | le scénario catastrophe : le fichier principal disparaît, l'application le dit, et tout revient — clé du cabinet comprise |
| `npm run e2e:demenagement` | **changer d'ordinateur** : deux postes à la suite, une clé USB entre les deux, et la MÊME empreinte à l'arrivée |
| `npm run e2e:couches` | **les couches et le clavier** : deux fenêtres empilées, Échap, Entrée, Cmd+K dans les deux sens |
| `npm run e2e:barre` | **la barre latérale mesurée** : Aide et Paramètres atteignables sur quatre tailles d'écran, et rien de masqué n'est perdu |
| `npm run e2e:exemple` | **charger le jeu d'exemple et en revenir** : le bandeau, la restauration, et la fausse identité qui ne survit pas à l'effacement |
| `npm run e2e:captures` | photographie les 20 pages, leurs onglets et quatre gestes, en vierge et en démo, à 1440 et 1280 |
| `npm run e2e:gel` | le chien de garde : l'interface est VRAIMENT gelée, et le journal nomme la fonction coupable |

Ils ont longtemps vécu dans un dossier de travail temporaire, effacé à chaque session : il fallait les réécrire de mémoire, et ils dérivaient (une assertion restée sur une version périmée, un écran neuf jamais parcouru). **Un test qu'on doit réécrire pour s'en servir n'est pas un test.** Le harnais (`test/e2e/harnais.js`) trouve Playwright où il est, lit la version dans `package.json` au lieu de l'écrire en dur, et range les captures dans `dist-e2e/` (ignoré par Git).

Playwright n'est pas une dépendance du projet : `npm i -D playwright` avant de lancer ces tests.

## 6.8.1 et 6.8.2 — le second audit, mené sur la 6.8.0 elle-même

Skander : « creuse encore plus profond, il manque encore, je suis sûr ». Il avait raison. Audit à treize angles, chaque constat relu par un contradicteur chargé de le réfuter, deux critiques de complétude, un second tour sur les angles manqués : **131 constats confirmés, 87 retenus**, et tous ceux de la liste « avant publication » sont corrigés (6.8.1 puis 6.8.2). Le détail est dans `PLAN-CABINET.md`.

**Le premier audit avait regardé ce qui MANQUAIT ; celui-ci a regardé ce qui était FAUX.** Les seconds sont plus graves : une fonction absente se voit, une fonction qui ment ne se voit pas.

Règles apprises, à ne pas recasser :

- **Un compteur et la liste qu'il annonce se calculent avec la même fonction.** Le bandeau de la page Relances comptait les seuls mois manquants pendant que le tableau, dix pixels plus bas, listait aussi les provisoires. Une fois la question posée à voix haute, plus aucun chiffre n'est cru sur parole — et l'app n'est faite que de chiffres.
- **Une purge se fait par DATE, jamais par nom.** Les sauvegardes se purgeaient par ordre alphabétique : « avant-suppression » passait toujours en premier, donc le filet disparaissait à la seconde où il était pris, pendant que la fenêtre affichait « Une sauvegarde est prise juste avant ».
- **Une identité ne se fabrique jamais à partir de `[A-Za-z]`.** `شركة الأمان` et `مخبزة الياسمين` donnaient la même clé vide : dans un portefeuille tunisien, tous les clients en raison sociale arabe tombaient dans un seul dossier et leurs paquets s'écrasaient. `\p{L}\p{N}` avec le drapeau `u`, partout.
- **Ce qui vient de l'extérieur se valide AVANT de toucher au disque.** Un mois de la forme `../../..` servait à fabriquer un chemin de fichier. Et un fichier reçu ne s'ouvre pas avec le programme du système sous un nom choisi par l'expéditeur (« facture.pdf.command »).
- **Un compte se fait dans les DEUX sens.** « 7 pièces vérifiées, intactes » ne regardait que ce que le manifeste annonce : un fichier présent sans y figurer n'était ni compté, ni vérifié, ni signalé, et s'ouvrait d'un clic.
- **Un verdict qui vit deux secondes n'est pas un verdict** : le résultat du contrôle d'intégrité est rangé avec le paquet, et se relit un mois plus tard.
- **Un exemple qui dément la promesse du produit vaut mieux pas d'exemple.** Le jeu de démonstration datait chaque paquet du 8 du mois qu'il couvrait : « août, définitif, reçu le 08/08 ». Le premier comptable à qui on le montre demande s'il a clôturé août le 8 août.
- **Le pire défaut est celui qui punit quelqu'un qui a tout bien fait.** Changer d'ordinateur n'avait aucun chemin : le comptable avait sa clé USB et sa clé de secours, et le poste neuf lui fabriquait une clé neuve, donc une autre empreinte, donc des clients refusés. Toute donnée qu'on demande à quelqu'un de conserver doit avoir un bouton pour la reprendre.
- **Après une reprise, un chemin enregistré désigne l'autre poste.** On le recolle sur le nôtre — et s'il désigne encore le support d'origine (la clé encore branchée), on se recolle quand même sur la copie locale : on ne lit pas les pièces de ses clients sur une clé qu'on va débrancher.
- **Un travail long dans le processus principal rend l'application muette.** Vingt paquets, c'était vingt-deux secondes sans un mot ni recours. `await new Promise(res => setImmediate(res))` entre deux unités, un avancement, et un arrêt qui agit ENTRE deux unités — jamais au milieu d'une écriture.
- **Le chien de garde du cabinet a une règle de plus que celui de l'entreprise** : ici c'est le processus principal qui travaille longtemps, et **son** silence ne doit pas passer pour un gel de l'interface, sinon il recharge une page innocente.
- **Un test qui ne peut pas échouer est pire que pas de test.** Trois l'étaient : `assert.ok(x.length >= 0)` ; un test « sous tous les fuseaux » qui n'appelait que de l'arithmétique de chaînes ; et les deux `main.js` absents du seul contrôle statique, alors que ce sont les seuls fichiers qu'aucun test n'exécute. **Tout correctif de test se prouve en réintroduisant le défaut d'origine.**
- **Un e2e ne doit jamais rejouer le code qu'il teste.** Écrire `modal()` à l'intérieur d'un `evaluate()` produit un test vert qui ne teste rien : on passe par les vrais écrans et les vrais boutons.
- **Piège des remplacements de texte en masse** : un `replace(..., count=1)` a armé la mauvaise fenêtre (`accuseReception` au lieu de `writeRelance`). En mode strict, l'affectation à une variable non déclarée lève une ReferenceError — la fenêtre s'ouvrait avec **aucun bouton branché**, sans rien en console, et le détecteur d'appels inexistants ne pouvait pas le voir (ce n'est pas un appel). Vérifier l'ancrage, pas seulement le nombre d'occurrences. Un test relit désormais chaque fenêtre et exige le garde-fou de saisie en ENTIER (déclaré, armé, passé) ou pas du tout.
- **Un message d'avancement en retard peut ressusciter sa fenêtre.** Le dernier `import:progress` arrivait après la fermeture et rouvrait la fenêtre pour toujours, par-dessus le compte rendu : le bouton « Fermer » restait visible et parfaitement inerte. Un drapeau « en cours » ferme la porte.
- **electron-builder ne convertit pas une icône** : il échange `.ico` et `.icns` selon la plateforme, donc un `.png` déclaré ressort inchangé et s'installe là où un `.icns` est attendu. Rien n'échoue. Déclarer l'icône **sans extension** et fabriquer les vrais fichiers (`node scripts/icones.js`, Electron pour le dessin + app-builder pour l'assemblage ; le `.ico` porte ses sept tailles, parce que c'est à 16 px qu'on regarde une liste de fichiers).

**Méthode qui a payé, à refaire :** un workflow de spécification en lecture seule (un agent par constat, qui lit le vrai code et rend des ancrages exacts), puis application à la main avec vérification d'unicité de chaque ancrage. Deux agents ont trouvé des défauts que je venais moi-même d'introduire, et un troisième a montré qu'un constat déjà « corrigé » l'était dans un seul sens (Cmd+K par-dessus une fenêtre, mais pas une fenêtre par-dessus la palette).

## 7.0.0 — « Soit t'es pro soit tu te prends la tête »

Skander, propriétaire de l'application : « je suis débutant et j'ai essayé de bidouiller en testant
tout seul et **je me suis perdu** ». En six semaines, SkanFact est passé de « devis et factures » à
quinze modules. Chacun est arrivé avec son aide, ses bulles et ses états vides ; **aucun n'a été livré
avec une révision de l'ensemble**. Le plan complet et l'audit à douze angles sont dans `PLAN-UX.md`.

**Ce n'était pas une application mal faite, c'était une application faite pour quelqu'un qui sait
déjà.** Les défauts de ce genre ne se voient dans aucune console et aucun test de calcul ne les
attrape : il faut mesurer dans l'application réelle, et regarder les captures.

Règles apprises, à ne pas recasser :

- **Le bouton qu'on cherche quand on est perdu doit être le seul qui ne bouge jamais.** `nav` demandait
  866 px et en avait 705 à 1440×900 : « Aide » était hors champ sur **toutes** les tailles d'écran
  courantes, y compris un écran de 1050 px de haut — derrière une barre de défilement que macOS masque
  tant qu'on ne fait pas défiler. Pendant ce temps, « Exporter les données » et « Importer », dont un
  débutant n'a aucun besoin, occupaient le pied toujours visible. Paramètres et Aide y vivent
  désormais ; `npm run e2e:barre` le mesure sur quatre tailles.
- **On ne masque jamais ce que quelqu'un a saisi.** Un module retiré du menu qui contient ne serait-ce
  qu'une ligne réapparaît tout seul et ne se laisse plus décocher — et l'écran DIT pourquoi. Le
  filtrage du menu n'est acceptable que parce que la palette liste tout, que l'adresse fonctionne, et
  qu'une page « Tous les modules » existe : un test vérifie les trois. Sans réglage enregistré
  (`company.modules` absent), **tout s'affiche** : une mise à jour ne fait disparaître aucune page.
- **Un bouton qui ne répond pas est pire qu'un bouton absent.** `todoList` produisait 22 sortes de
  lignes, `TODO_ACTIONS` en armait 9, et `bindTodo` faisait `if (a) a.run()` : treize boutons « Voir »
  avalaient le clic en silence. On croit avoir mal cliqué, on recommence, on doute de soi, puis du
  logiciel. **Toute liste dont les lignes portent un bouton a besoin d'un test de couverture** entre ce
  que la source peut produire et ce que l'interface sait faire.
- **Un refus dit trois choses : ce qui est refusé, pourquoi, et le bouton qui débloque.** Une pièce
  émise montrait vingt champs gris et une explication de 12 px, avec la seule sortie cachée dans
  « Plus ▾ ». Et le même refus ne se dit pas de deux façons : `closedToast` (bandeau de 2,6 s, sans
  issue) doublait `closedBlock` (fenêtre avec « Aller aux clôtures ») — il a disparu.
- **Une saisie refusée se MONTRE** : on amène le champ à l'écran, on y met le curseur, on le marque
  (`refus()`). Un message seul oblige à relire tout le formulaire — et la barre d'actions est en haut
  pendant que la ligne fautive est en bas.
- **Un état vide qui explique le geste en prose n'est pas une interface, c'est une notice de montage.**
  52 sur 58 n'avaient aucun bouton : « Ouvre le Catalogue, modifie un article suivi en stock et coche… »
  demande de retenir une phrase, de naviguer ailleurs, et de retrouver la bonne case.
- **Une liste qui se dit triée par urgence doit l'être.** Le commentaire de `todoList` le promettait
  depuis la 1.10.0 ; l'ordre réel était celui dans lequel les modules ont été écrits. Un test qui fixe
  l'ordre attendu **en dur** ne l'aurait jamais attrapé : il décrivait le défaut. On teste la RÈGLE.
- **Une explication qui s'arrête là où la question devient précise est un cul-de-sac.** Les bulles
  portent un `a` vers l'article qui développe ; un en-tête de colonne peut porter une bulle (c'était le
  seul endroit où c'était impossible, et c'est là que vivent les abréviations) ; l'aide a une recherche
  qui lit le CORPS des articles, parce qu'un mot comme « assiette » n'est dans aucun des 32 titres.
- **Un glossaire qui s'arrête à une version ancienne ne ment pas, il déçoit** — et on n'y revient
  jamais. Il est passé de 17 à 59 entrées, et un test exige que chaque mot affiché dans l'interface y
  soit défini.
- **Le jeu d'exemple ne doit jamais pouvoir signer une vraie facture.** Chargé avant que la fiche
  société soit remplie — ce que fait un débutant — il donnait à l'entreprise le nom « DÉMO — Société de
  services SUARL », un matricule et un RIB inventés, et « Tout effacer » **gardait cette fiche**. Les
  données d'exemple se déclarent (`data.demo`), un bandeau permanent le dit, et l'identité empruntée
  part avec l'effacement.
- **Une liste de choses à effacer écrite à la main dérive à chaque module ajouté.** « Tout effacer »
  vidait 7 listes sur 30 : après l'exemple, il restait de faux fournisseurs, salariés, bulletins,
  immobilisations et comptes bancaires. `core.wipeData` la **déduit** de `DEFAULT_DATA`.
- **Le premier message d'un logiciel ne peut pas être un toast.** Il durait 2,6 secondes, n'était pas
  cliquable, et nommait un onglet de Paramètres que l'utilisateur ne voyait pas dans sa barre latérale.
  Ce qu'il faut dire au premier lancement vit dans « Tes premiers pas », dont l'état de chaque étape est
  **déduit des données** — une case qu'on coche soi-même ment le jour où on l'a cochée par erreur.
- **Avant d'écrire une phrase rassurante, vérifier que l'univers concerné est non vide.** « Rien à faire
  aujourd'hui : aucun retard » félicitait quelqu'un qui n'avait jamais rien facturé.
- **Piège Playwright, revu :** un panneau qui se redessine à chaque clic détache les poignées obtenues
  d'une seule requête. On reprend le premier élément encore dans l'état voulu à chaque tour. Au passage,
  le redessin faisait perdre le focus — c'est un défaut d'interface autant qu'un piège de test.
- **Piège des tests qui lisent du HTML :** un lien mis en commentaire satisfaisait `includes(...)`. Les
  commentaires se retirent avant de juger, et on vérifie que le nettoyage n'a pas mangé le code. Trouvé
  en essayant de faire échouer le test exprès — ce qui est la seule façon de savoir qu'il sert.

**L'instrument qui manquait :** `npm run e2e:captures` photographie les 20 pages, leurs onglets et
quatre gestes (éditeur, choix de client, palette, nouvelle fiche), dans deux états — **vierge** (juste
après l'assistant) et **démo** — aux deux largeurs qui comptent. CLAUDE.md décrivait cette méthode
comme si `e2e:entreprise` la fournissait : ce n'était plus vrai, et il fallait donc réécrire le
photographe à chaque audit. Les défauts « je ne sais pas par où commencer » vivent tous dans l'état
vierge, ceux de densité et de vocabulaire dans l'état démo.

## Pistes pour la suite (non demandées)

- Séparation des installateurs arm64 / x64 pour diviser par deux les 222 Mo du dmg universel.
- Signature Apple et Windows (certificats payants) : supprimerait les avertissements au premier lancement et permettrait d'utiliser Squirrel sur Mac.
- Export TEIF si l'e-facture devient obligatoire.
