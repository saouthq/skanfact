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

## Installation (Mac)

1. Décompresse le zip.
2. Double-clique sur **« Installer SkanFact.command »**.
   Si macOS refuse de l'ouvrir (« développeur non identifié ») : clic droit → Ouvrir → Ouvrir.
3. L'assistant vérifie Node.js (et propose de l'installer s'il manque), télécharge les dépendances, construit `SkanFact.app`, la copie dans Applications et la lance. Il demande confirmation à chaque étape.

Sur Windows : même chose avec **« Installer SkanFact (Windows).bat »**.

Alternative manuelle (Terminal) :

```bash
cd ~/Downloads/skanfact
npm install
npm start          # lance l'app en mode développement
npm run build:mac  # crée le .dmg dans dist/
```

## Mises à jour automatiques

L'app vérifie au démarrage s'il existe une version plus récente sur GitHub Releases et l'indique dans la barre latérale. Paramètres → Mises à jour permet de vérifier, télécharger et installer.

- **Windows** : téléchargement et installation en un clic, l'app redémarre à jour.
- **Mac** : tant que l'app n'est pas signée avec un certificat Apple Developer (99 $/an), macOS interdit le remplacement automatique. L'app détecte la nouvelle version et ouvre la page de téléchargement ; tu télécharges le `.dmg` et glisses l'app dans Applications (tes données sont conservées, elles ne sont pas dans l'app). Le jour où tu signes l'app, passe `MAC_SIGNED` à `true` dans `src/main.js`.

### Dépôt privé

Le dépôt `saouthq/skanfact` est privé. Pour que l'app installée puisse vérifier les mises à jour, il lui faut un token GitHub en lecture seule :

1. https://github.com/settings/personal-access-tokens/new → Token name `skanfact-app`, Expiration 1 an, Repository access → Only select repositories → `skanfact`, Permissions → Contents : **Read-only**. Generate.
2. Dans l'app : Paramètres → Mises à jour → colle le token → Enregistrer.

Il est stocké dans `~/Library/Application Support/SkanFact/update-config.json`, jamais dans le code ni dans le dépôt.

### Publier une nouvelle version

Le code est sur le dépôt privé `https://github.com/saouthq/skanfact` (branche `main`). Après avoir modifié le code :

```bash
git add -A && git commit -m "ce que j'ai changé"
npm run release          # correction (1.2.1 → 1.2.2)
npm run release minor    # nouvelle fonctionnalité (→ 1.3.0)
```

Ça incrémente le numéro de version, crée un tag `vX.Y.Z`, pousse sur GitHub. GitHub Actions (fichier `.github/workflows/release.yml`) construit alors les installateurs Mac (`.dmg`) et Windows (`.exe`) et les publie dans l'onglet Releases (5 à 10 min). Les apps installées verront la nouvelle version au prochain démarrage.

## Où sont mes données ?

Un seul fichier JSON :

- Mac : `~/Library/Application Support/SkanFact/skanfact-data.json`
- Windows : `%APPDATA%\SkanFact\skanfact-data.json`

Le chemin exact est affiché dans Paramètres → Données. Un dossier `backups/` à côté garde une copie par jour (30 jours). Pense à copier ce fichier ailleurs de temps en temps (iCloud, clé USB) : c'est toute ta compta.

## Tests

```bash
npm test
```

Vérifie les calculs, la numérotation et le montant en lettres.

## Structure

```
Installer SkanFact.command          installeur Mac (double-clic)
Installer SkanFact (Windows).bat    installeur Windows
scripts/release.js                  publication d'une version
.github/workflows/release.yml       construction + publication automatique
src/main.js            process principal : fenêtre, stockage, export PDF, mises à jour
src/preload.js         pont sécurisé main ↔ interface
src/renderer/core.js   logique métier + template du document (partagé avec les tests)
src/renderer/app.js    interface
src/renderer/style.css
src/renderer/index.html
test/run-tests.js
```

## Limites connues (v1)

- Un document tient sur une page A4. Au-delà d'une dizaine de lignes avec descriptions, le pied de page peut se décaler.
- Pas d'envoi par email intégré : exporte le PDF et joins-le.
- L'icône de l'app est `build/icon.png` (1024×1024) ; electron-builder la convertit en `.icns` / `.ico` au build. Pour en changer, remplace ce fichier.
