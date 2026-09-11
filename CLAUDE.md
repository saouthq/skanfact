# SkanFact — consignes pour Claude

Application desktop Electron (JS pur, sans bundler) de devis et factures pour SKANCYBER SECURITY SUARL (Tunisie). Propriétaire : Skander Ben Amor (saouthq). Il communique en français, tutoiement, débutant Git/terminal : il ne veut pas taper de commandes, Claude fait le travail en autonomie (commits, releases, vérification des builds). Quand quelque chose est incertain (fiscalité), le signaler par « À VÉRIFIER ».

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

Matricule fiscal 1998268D, régime réel, assujetti TVA. Timbre fiscal 1 DT par facture. Retenue à la source : taux usuels proposés (1,5 / 3 / 5 / 10 / 15 %), assiette = TTC hors timbre — À VÉRIFIER. Avoir sans timbre par défaut — À VÉRIFIER.

## Idées non demandées formellement

Feuille de route acceptée par Skander (11/09/2026) : 1.5.0 récurrentes + relances + email + Cmd+K + modèles ; 1.6.0 tableau de bord graphique + cachet/signature + documents EN/devise + mode sombre ; 1.7.0 sauvegarde externe + chiffrement. Non demandés : acceptation du devis en ligne, signature Apple/Windows (certificats payants), export TEIF si l'e-facture devient obligatoire.

## Audit UX du 11/09/2026 (captures 1440×900 et 1280×800 avec la démo) — propositions en attente de validation

Skander a demandé des onglets dans Paramètres et une expérience « optimale ». Constats et plan proposé :

- **1.8.0 confort quotidien** : Paramètres en onglets (Société / Documents / Emails / Apparence / Sécurité & données / Mises à jour) avec barre « Enregistrer » flottante visible seulement s'il y a des modifications ; garde-fou « modifications non enregistrées » dans l'éditeur et les paramètres (navigation, Cmd+K, menu) ; Échap ferme les fenêtres et Entrée valide les formulaires (aujourd'hui ni l'un ni l'autre) ; barre d'actions de l'éditeur simplifiée (Enregistrer/Émettre, PDF, Email, menu « Facturer ▾ » pour convertir / acompte / solde, « Plus ▾ » pour le reste) ; aperçu adaptatif (colonne flexible, bouton « Masquer l'aperçu » mémorisé) car à 1280 px les champs Qté/P.U. sont illisibles ; indicateur « 1 page / 2 pages » sur l'aperçu ; lignes : monter/descendre, dupliquer, description affichée à la demande ; conserver le défilement après enregistrement ; titre de fenêtre = document ouvert ; « Tout effacer » dans une zone sensible avec confirmation par saisie.
- **1.9.0 listes et clients** : tri par colonne, filtre par année (année en cours par défaut), pied de liste (nombre, total HT, reste à payer), actions au survol (PDF, email, paiement, dupliquer) ; Devis : colonne « Valable jusqu'au » à la place de « Type » et état dérivé « expiré » (liste, accueil) ; fiche client (solde, documents, nouveau devis pour ce client, notes) et champ « Contact » (personne) ; Catalogue en onglets Prestations / Modèles / Textes.
- **1.10.0 pilotage** : panneau « À faire » sur l'accueil (contrats à générer, retards, devis expirés ou sans réponse depuis 15 j, brouillons de plus de 7 j, attestations RS à réclamer, échéances de la semaine) ; historique par document (créé, émis, envoyé, relancé, payé, avoir) à partir des données déjà stockées ; relance téléphonique notée à la main et report « ne pas relancer avant le… » ; relance d'un devis par email ; envoi du journal mensuel au comptable (CSV joint) ; aide « Raccourcis clavier » ; barre latérale groupée (Ventes / Fichiers / Gestion) et réductible en icônes.
- Non retenu volontairement : multi-utilisateurs, synchronisation cloud, e-facture (voir plus haut).
