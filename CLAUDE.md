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
- Données v3 : `recurring` (contrats : lignes, every, day, nextDate, lastIssued, active), `templates`, `snippets` ; par document : `payments`, `reminders`, `emails`, `withholdingCertificate`, `recurringId`.
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

- **2.4.0** (deux manques signalés par Skander + audit parallèle sur quatre angles) : pile de navigation interne (`navStack`, `backButton`/`bindBack`/`goBack` dans app.js) et « Précédent » dans le menu Affichage ; fiche de contrat `#/contrat/<id>` avec aperçu de la prochaine facture, lignes résolues et factures générées (`recurringId` enfin lu par l'interface) ; événement `contrat` dans `core.documentHistory` ; fenêtres modales empilées ; garde-fou de fermeture de fenêtre (`window:dirty` → `dialog.showMessageBoxSync` dans main.js).

Règles apprises sur la navigation : on tient notre propre pile plutôt que `history.back()`, parce que le garde-fou « modifications non enregistrées » remet la page précédente dans la barre d'adresse pour poser sa question et fausserait l'historique du navigateur. `goBack` traite le cas « on y est déjà » (aucun `hashchange`, donc le drapeau resterait armé et casserait la navigation suivante). Le bouton retour dit toujours où il mène. Piège des fenêtres modales : `#modal-root.innerHTML = …` détruisait la fenêtre du dessous et la saisie en cours ; chaque fenêtre est maintenant une couche, et `onMount` reçoit sa couche, pas tout le conteneur.

Règles apprises sur les composants : un `<select>` reste le bon choix tant que la liste est courte et fermée (statuts, TVA, devise, période) ; `combo()` sert dès que la liste grandit avec les données. Les deux composants gardent leur valeur dans un `<input type="hidden">` nommé, pour que `formValues()` et les gestionnaires `form.onchange` existants continuent de fonctionner sans être réécrits. `closeOverlay` (module app.js) ne garde qu'un seul calendrier ou une seule liste ouverte à la fois. Piège rencontré : `const today = todayIso || today()` dans core.js crée une zone morte temporelle et casse la fonction ; les tests passaient parce qu'ils fournissaient toujours la date de référence — depuis, un test appelle aussi la fonction sans argument.

Règles apprises sur les listes : les totaux du pied de tableau et les exports CSV portent sur la **sélection entière**, jamais sur la page affichée ; toute nouvelle liste doit passer par `paginate` + `sortHead` + `pagerBar` pour rester cohérente ; `bindSort`/`bindPager` prennent un élément racine parce qu'une page peut afficher deux tableaux (Comptabilité, Relances).

Méthode d'audit qui a fonctionné : `scratchpad/shots.js` (captures 1440×900 + 1280×800, démo puis états vides juste après l'assistant, chaque modale ouverte), lecture de chaque capture, puis relecture des chemins de code correspondants (validations, confirmations, cas limites).

Non retenu volontairement : multi-utilisateurs, synchronisation cloud, e-facture (voir plus haut), barre latérale réductible en icônes (les groupes ont suffi).

## Modules demandés par Skander (11/09/2026), pas encore commencés

Il veut étendre l'app au-delà des ventes. Ordre recommandé et accepté en principe : **achats / fournisseurs / dépenses + TVA déductible** d'abord (c'est la brique dont dépendent les deux suivantes), puis **stock** (entrées par achat, sorties par bon de livraison ou facture, valorisation, numéros de série, rattachement à une affaire), puis **immobilisations** (amortissement linéaire, tableau, VNC, cession), puis **lecture d'une photo de facture** pour préremplir une saisie (jamais d'insertion automatique : formulaire à valider ; suppose une clé d'API payante et l'envoi de l'image hors de l'ordinateur — accord de Skander requis), puis **trésorerie et calendrier fiscal**, et enfin la **paie** (barèmes CNSS/IRPP paramétrables, jamais en dur, et mention invitant le comptable à valider les premiers bulletins). Tous les taux et durées relèvent du « À VÉRIFIER avec ton comptable ».

Ces modules feront passer les données en v4 (migration à écrire) et imposeront de regrouper la barre latérale en Ventes / Achats / Gestion.

## Repéré par l'audit du 11/09/2026, pas encore corrigé

Constats confirmés mais laissés de côté en 2.4.0, par ordre d'intérêt :

- Choisir un logo ou un cachet dans Paramètres écrase les autres modifications non encore enregistrées du formulaire.
- Relances et Comptabilité sont les deux seules pages de liste sans champ de recherche.
- Un modèle de document ne se modifie pas : seul son nom est changeable, alors que les deux autres onglets du Catalogue ont « Modifier ».
- La suppression est incohérente : un client se supprime depuis sa fiche, prestations, textes, modèles et contrats depuis la liste.
- Les notes internes d'un client s'enregistrent toutes seules dans la fiche mais demandent « Enregistrer » dans la fenêtre de modification.
- Clients et Catalogue n'ont pas de pied de tableau totalisé, contrairement aux listes de documents.
- Sur une installation neuve, « Documents récents » affiche « Aucun document. » sans rien proposer.
- Les boutons de ligne n'apparaissent qu'au survol sur Clients et sur les listes de documents, mais sont toujours affichés ailleurs.

## Pistes pour la suite (non demandées)

- Deux entreprises sur le même ordinateur (aujourd'hui : une session utilisateur par entreprise).
- Séparation des installateurs arm64 / x64 pour diviser par deux les 222 Mo du dmg universel.
- Signature Apple et Windows (certificats payants) : supprimerait les avertissements au premier lancement et permettrait d'utiliser Squirrel sur Mac.
- Export TEIF si l'e-facture devient obligatoire.
