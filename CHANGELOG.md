# Historique des versions

Format : `MAJEUR.MINEUR.CORRECTIF`
- correctif (1.0.x) : bug corrigé, petit ajustement visuel
- mineur (1.x.0) : nouvelle fonctionnalité
- majeur (x.0.0) : gros changement (nouvelle structure de données, refonte)

Le numéro affiché en bas de la barre latérale de l'app est celui de `package.json`.

## 1.3.3 — 11/09/2026

- Mises à jour : tant qu'aucun token n'est enregistré, l'app n'interroge plus GitHub pour rien et affiche simplement quoi faire (fini le message rouge « Aucune version trouvée » avant même d'avoir collé le token)
- Le format du token est vérifié à l'enregistrement (`github_pat_…` ou `ghp_…`)

## 1.3.2 — 11/09/2026

- Correction du bug qui empêchait la 1.3.0 d'afficher sa fenêtre (et affichait « Cannot read properties of undefined (reading 'publish') » en 1.3.1) : l'app lisait la section `build` de `package.json`, qu'electron-builder retire de l'app installée. Le menu français et la vérification des mises à jour fonctionnent maintenant dans l'app installée, Mac et Windows
- Les tests automatiques tournent désormais sur l'app empaquetée, pas seulement en mode développement

## 1.3.1 — 11/09/2026

- Mac : sur certaines machines la 1.3.0 se lançait (icône dans le Dock) sans jamais afficher sa fenêtre. La fenêtre s'affiche désormais au plus tard 1,5 s après le lancement, même si l'interface tarde à charger
- Plus aucune erreur silencieuse au démarrage : un problème (menu, fenêtre, chargement de l'interface) est affiché à l'écran et noté dans `main.log` dans le dossier des données

## 1.3.0 — 11/09/2026

Mises à jour
- Mac : vraie mise à jour automatique sans certificat Apple — l'app télécharge la nouvelle version, se ferme, se remplace dans Applications et se relance (plus de page web à ouvrir)
- Téléchargement automatique en arrière-plan dès qu'une version est détectée ; pastille « Version X prête » puis un clic « Installer et redémarrer »
- Windows : installation silencieuse et redémarrage automatique
- Vérification au démarrage vraiment silencieuse (plus d'erreur affichée tant que le token n'est pas saisi) ; vérification lancée dès que le token est enregistré
- Notes de version affichées dans l'app (Paramètres → Mises à jour → Nouveautés, menu Aide)

Comme un vrai logiciel
- Menu de l'application en français : Fichier (nouveau devis Ctrl/Cmd+N, nouvelle facture, enregistrer Ctrl/Cmd+S, PDF Ctrl/Cmd+P, export/import), Édition (copier/coller), Affichage (Ctrl/Cmd+1…5, zoom), Aide (nouveautés, à propos)
- Une seule instance de l'app à la fois (deux fenêtres ouvertes pouvaient corrompre le fichier de données)
- Taille et position de la fenêtre mémorisées
- Installateur Windows en français, raccourcis Bureau et menu Démarrer, désinstallation propre
- Image disque Mac avec le raccourci Applications
- Electron 43 (moteur mis à jour, correctifs de sécurité)

Sécurité des données
- Un fichier de données illisible n'est plus écrasé : il est mis de côté et l'app propose de restaurer une sauvegarde
- La sauvegarde quotidienne est désormais l'état du **début de journée** (avant, chaque enregistrement l'écrasait, on ne pouvait pas annuler une bêtise)
- Sauvegarde automatique avant tout import ; import refusé si le fichier n'est pas un export SkanFact
- Paramètres → Données : « Sauvegarder maintenant », « Ouvrir le dossier des sauvegardes »
- Export PDF plus robuste (fichier temporaire au lieu d'une URL limitée en taille — les logos lourds faisaient échouer l'export) ; logo limité à 1 Mo
- Documents longs : pas de ligne coupée entre deux pages, en-tête du tableau répété

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
