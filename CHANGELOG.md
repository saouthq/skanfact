# Historique des versions

Format : `MAJEUR.MINEUR.CORRECTIF`
- correctif (1.0.x) : bug corrigé, petit ajustement visuel
- mineur (1.x.0) : nouvelle fonctionnalité
- majeur (x.0.0) : gros changement (nouvelle structure de données, refonte)

Le numéro affiché en bas de la barre latérale de l'app est celui de `package.json`.

## 1.2.1 — 11/09/2026

- Première mise en ligne du code sur GitHub (`saouthq/skanfact`) et première release construite par GitHub Actions
- Les releases sont publiées directement (plus de brouillon) : sans ça, l'app installée ne voyait jamais la nouvelle version
- Icône d'application SkanFact (`build/icon.png`, convertie automatiquement en `.icns` / `.ico` au build)
- `package-lock.json` ajouté pour des builds identiques sur Mac, Windows et GitHub Actions

## 1.2.0 — 11/09/2026

- Mises à jour depuis un dépôt GitHub **privé** : champ « Token GitHub » dans Paramètres → Mises à jour (stocké localement, hors du code)
- Messages d'erreur plus précis (token manquant / refusé)

## 1.1.1 — 11/09/2026

- Message clair dans Paramètres → Mises à jour tant que GitHub n'est pas configuré (plus de pavé d'erreur technique)
- Erreurs réseau/404 résumées en une phrase

## 1.1.0 — 11/09/2026

- Jeu de données de démonstration (Paramètres → Données) : 6 clients, 8 prestations, 14 devis/factures sur 3 mois avec tous les statuts, dont une facture en retard
- Bouton « Tout effacer » pour repartir de zéro en gardant les paramètres société

## 1.0.1 — 11/09/2026

- L'installeur Mac construit maintenant le `.dmg` complet dans `dist/` (en plus de `SkanFact.app`)

## 1.0.0 — 11/09/2026

Première version.

- Société, clients, catalogue de prestations
- Devis et factures : lignes, remise, TVA 0/7/13/19 %, timbre fiscal, montant en lettres
- Numérotation automatique par année, conversion devis → facture, statuts, retards
- Aperçu en direct, export PDF A4 (design clair, couleur d'accent réglable)
- Tableau de bord : CA mois/année, impayés, devis en attente
- Sauvegarde quotidienne automatique, export/import JSON
- Installeur double-clic Mac (`.command`) et Windows (`.bat`)
- Mises à jour intégrées (electron-updater + GitHub Releases), workflow de publication `npm run release`
