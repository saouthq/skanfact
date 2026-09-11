# SkanFact

Petit logiciel de devis et factures pour SKANCYBER SECURITY SUARL. Application desktop (Electron), fonctionne sur Mac et Windows, données stockées en local, génération de PDF.

Pas d'e-facture (TTN / TEIF) : l'outil produit des PDF classiques.

## Fonctionnalités

- Paramètres société (nom, matricule fiscal, adresse, RIB, logo, slogan, couleurs du document)
- Clients (nom, MF/CIN, adresse, contact)
- Catalogue de prestations (désignation, description, prix HT, TVA, unité) pour remplir un devis en un clic
- Devis et factures : lignes, remise globale, TVA par taux (0/7/13/19 %), timbre fiscal de 1 DT sur les factures, montant en lettres
- Numérotation automatique continue par année (DEV-2026-001, FAC-2026-001) — un numéro n'est jamais réutilisé, même après suppression
- Conversion devis → facture en un clic (le devis passe en « accepté »)
- Statuts (brouillon, envoyé, accepté/refusé, payée, annulée) et détection des factures en retard
- Aperçu en direct pendant la saisie, export PDF A4
- Tableau de bord : CA du mois, CA de l'année, impayés, devis en attente
- Export / import de toutes les données en JSON, sauvegarde automatique quotidienne (30 jours)

## Installation

Les installateurs sont dans l'onglet **Releases** du dépôt : https://github.com/saouthq/skanfact/releases/latest (dépôt privé : il faut être connecté à GitHub avec le compte `saouthq`).

**Mac** : télécharge `SkanFact-x.y.z-mac-universal.dmg`, ouvre-le, glisse SkanFact dans Applications. L'app n'est pas signée par Apple : au premier lancement, **clic droit sur l'app → Ouvrir → Ouvrir**. Si macOS dit que l'app est « endommagée », ouvre le Terminal et colle :

```bash
xattr -cr /Applications/SkanFact.app
```

**Windows** : télécharge `SkanFact-x.y.z-win-x64.exe` et lance-le. SmartScreen affiche « Windows a protégé votre ordinateur » (app non signée) : **Informations complémentaires → Exécuter quand même**. L'installateur est en français, crée les raccourcis Bureau et menu Démarrer, et se désinstalle depuis les Paramètres Windows.

Une seule fenêtre SkanFact peut être ouverte à la fois (deux instances écrivant le même fichier corrompraient les données).

### Construire depuis les sources (secours)

`Installer SkanFact.command` (Mac) et `Installer SkanFact (Windows).bat` construisent l'app sur place à partir du code (Node.js requis, installé automatiquement si besoin). En Terminal :

```bash
npm install
npm start          # lance l'app en mode développement
npm run build:mac  # crée le .dmg dans dist/  (build:win pour l'.exe)
```

## Mises à jour automatiques

Au démarrage, l'app vérifie en silence s'il existe une version plus récente sur GitHub Releases. Si oui, elle la **télécharge en arrière-plan** et affiche « Version X prête » dans la barre latérale. Un clic sur **Installer et redémarrer** (Paramètres → Mises à jour) et c'est fait :

- **Windows** : l'installateur se lance en silencieux, l'app redémarre à jour.
- **Mac** : l'app n'est pas signée par Apple (certificat à 99 $/an), donc le mécanisme standard (Squirrel) est impossible. SkanFact fait le remplacement lui-même : elle se ferme, `SkanFact.app` est remplacée dans Applications par la version téléchargée (dont l'intégrité a été vérifiée), puis elle se relance. Une dizaine de secondes. Tes données ne sont pas dans l'app, elles sont conservées. Si quelque chose échoue, l'ancienne version est remise en place et un message l'explique au démarrage suivant (journal : `~/Library/Application Support/SkanFact/mac-update.log`).

Le jour où l'app est signée, passe `MAC_SIGNED` à `true` dans `src/main.js` : electron-updater fera tout.

### Dépôt privé

Le dépôt `saouthq/skanfact` est privé. Pour que l'app installée puisse vérifier les mises à jour, il lui faut un token GitHub en lecture seule :

1. https://github.com/settings/personal-access-tokens/new → Token name `skanfact-app`, Expiration 1 an, Repository access → Only select repositories → `skanfact`, Permissions → Contents : **Read-only**. Generate.
2. Dans l'app : Paramètres → Mises à jour → colle le token → Enregistrer.

Il est stocké dans `~/Library/Application Support/SkanFact/update-config.json`, jamais dans le code ni dans le dépôt.

### Publier une nouvelle version

Le code est sur le dépôt privé `https://github.com/saouthq/skanfact` (branche `main`). Deux façons, au choix :

- **Sans commande** : mets à jour `version` dans `package.json` et ajoute l'entrée dans `CHANGELOG.md` (c'est ce que Claude fait), pousse sur `main`, puis onglet **Actions → Release → Run workflow**.
- **En Terminal**, après avoir commité :

```bash
npm run release          # correction (1.3.0 → 1.3.1)
npm run release minor    # nouvelle fonctionnalité (→ 1.4.0)
```

GitHub Actions (`.github/workflows/release.yml`) construit les installateurs Mac (`.dmg` + `.zip`) et Windows (`.exe`), crée la release `vX.Y.Z` avec les notes tirées de `CHANGELOG.md` (3 à 5 min). Les apps installées verront la nouvelle version au prochain démarrage.

## Où sont mes données ?

Un seul fichier JSON :

- Mac : `~/Library/Application Support/SkanFact/skanfact-data.json`
- Windows : `%APPDATA%\SkanFact\skanfact-data.json`

Le chemin exact est affiché dans Paramètres → Données. Un dossier `backups/` à côté garde :

- une copie par jour de l'état **du matin** (avant la première modification de la journée), 30 jours conservés — pour annuler une fausse manipulation, *Importer* et choisir le fichier de la veille ou du jour ;
- une copie avant chaque import (`avant-import-…`) et les copies manuelles (« Sauvegarder maintenant »).

Si le fichier de données devient illisible (disque plein, coupure pendant l'écriture…), il n'est jamais écrasé : il est renommé `skanfact-data.illisible-<date>.json` et l'app propose de restaurer une sauvegarde.

Pense quand même à copier ce dossier ailleurs de temps en temps (iCloud, clé USB) : c'est toute ta compta.

## Tests

```bash
npm test
```

Vérifie les calculs, la numérotation, le montant en lettres, l'échappement HTML et le stockage (sauvegardes, fichier illisible, import). Pour tester l'app réelle sans écran (CI, session Claude), lancer Electron sous Xvfb avec Playwright (`_electron.launch`) et parcourir les écrans.

## Structure

```
Installer SkanFact.command          installeur Mac (double-clic)
Installer SkanFact (Windows).bat    installeur Windows
scripts/release.js                  publication d'une version
.github/workflows/release.yml       construction + publication automatique
scripts/release-notes.js            CHANGELOG → notes de version de la release
src/main.js            process principal : fenêtre, menu, export PDF, mises à jour
src/storage.js         fichier de données + sauvegardes (testé sans Electron)
src/mac-update.sh      remplacement de l'app sur Mac (app non signée)
src/preload.js         pont sécurisé main ↔ interface
src/renderer/core.js   logique métier + template du document (partagé avec les tests)
src/renderer/app.js    interface
src/renderer/style.css
src/renderer/index.html
test/run-tests.js
```

## Limites connues (v1)

- Un devis classique tient sur une page A4 ; au-delà, le document passe sur plusieurs pages (lignes jamais coupées, en-tête du tableau répété) mais le pied de page n'apparaît qu'à la fin.
- Pas d'envoi par email intégré : exporte le PDF et joins-le.
- Pas d'avoir (facture d'annulation) ni de retenue à la source : à voir avec le comptable si besoin.
- Apps non signées (pas de certificat Apple ni Windows) : avertissements au premier lancement, voir « Installation ».
- L'icône de l'app est `build/icon.png` (1024×1024) ; electron-builder la convertit en `.icns` / `.ico` au build. Pour en changer, remplace ce fichier.
