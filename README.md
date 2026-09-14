# SkanFact

Logiciel de devis et factures pour une petite entreprise, pensé pour le contexte tunisien (TVA 0/7/13/19 %, timbre fiscal, retenue à la source). Application desktop (Electron), Mac et Windows, données stockées en local, génération de PDF.

**Aucune entreprise n'est écrite en dur** : au premier démarrage, un assistant demande la raison sociale, le matricule fiscal, l'activité et les règles de facturation, puis propose un catalogue de départ et la mise en place de la sauvegarde externe. La même application sert donc à plusieurs personnes, chacune sur son ordinateur, avec ses propres données et sa propre numérotation.

Pas d'e-facture (TTN / TEIF) : l'outil produit des PDF classiques.

## Droits d'utilisation

**SkanFact n'est pas un logiciel libre.** Le code source est visible ici, il n'est pas réutilisable.

© 2026 Skander Ben Amor — **tous droits réservés**. Le dépôt est public pour que les utilisateurs
puissent télécharger les installateurs, lire ce qui tourne sur leur ordinateur et signaler un
problème. Aucune licence d'utilisation, de modification ou de redistribution n'est accordée : en
l'absence de fichier `LICENSE`, le droit d'auteur s'applique par défaut, et l'absence de licence
n'est **pas** un oubli.

Concrètement, sans accord écrit du propriétaire :

- ✅ tu peux **télécharger et installer** l'application depuis la page [Releases](https://github.com/saouthq/skanfact/releases), pour ton propre usage ;
- ✅ tu peux **lire** le code, l'étudier, et ouvrir une issue ;
- ❌ tu ne peux pas le **republier**, le revendre, ni en distribuer une version modifiée ;
- ❌ tu ne peux pas le **réutiliser** dans un autre produit, commercial ou non.

Pour un usage en entreprise ou un partenariat avec un cabinet comptable, passe par une issue — le
modèle prévu est décrit dans `PLAN-CABINET.md`.

À ne pas confondre avec les **clés de licence client** (section plus bas) : celles-ci gèrent
l'activation de l'application chez un utilisateur, pas les droits sur le code source.

## Fonctionnalités

- Assistant de première utilisation (société, secteur d'activité avec catalogue proposé, taxes et délais, RIB, dossier de sauvegarde)
- Aide intégrée : une bulle « i » à côté de chaque champ et quinze articles qui expliquent la facturation, la TVA, la retenue à la source, les relances et la routine comptable
- Paramètres société en onglets (nom, matricule fiscal, adresse, RIB, logo, cachet, slogan, couleurs du document)
- Clients : fiche par client (facturé, reste à payer, délai de paiement, taux d'acceptation des devis, historique), personne à contacter, notes internes
- Catalogue de prestations (désignation, description, prix HT, TVA, unité) pour remplir un devis en un clic
- Devis, factures et avoirs : lignes, remise globale, TVA par taux (0/7/13/19 %), timbre fiscal de 1 DT sur les factures, retenue à la source (par client ou par facture), montant en lettres
- Numérotation continue par année (DEV-2026-001, FAC-2026-001, AVO-2026-001). Une facture reçoit son numéro **à l'émission** : un brouillon n'en a pas, donc aucun trou si on le supprime. Une facture émise est verrouillée ; on la corrige par un avoir
- Conversion devis → facture, facture d'acompte (x % du devis) puis facture de solde qui déduit les acomptes
- Paiements (virement, chèque, espèces, traite, carte), paiements partiels, statut déduit automatiquement (envoyée, partiellement payée, payée, en retard, annulée), reste à payer par facture et par client
- Aperçu en direct pendant la saisie, export PDF A4 (tampon Payée / Annulée / Brouillon selon le cas)
- Accueil : panneau « À faire » (retards, contrats à générer, devis expirés ou sans réponse, attestations à réclamer, échéances de la semaine, brouillons oubliés), CA HT du mois et de l'année (avoirs déduits), reste à encaisser, devis en attente
- Listes triables avec filtre par année, totaux en pied de tableau et actions au survol ; historique par document
- Comptabilité : par mois ou par année, TVA collectée par taux, journal des ventes et encaissements exportables en CSV (Excel), export groupé des PDF de la période, suivi des attestations de retenue à la source
- Contrats récurrents (mensuel, trimestriel, annuel) qui génèrent les brouillons de factures à l'échéance ; relances des impayés par email ou notées par téléphone, avec niveaux automatiques et report possible ; relance des devis sans réponse ; envoi du journal mensuel au comptable ; envoi des documents par email (Mail sur Mac avec le PDF joint) ; recherche globale Cmd/Ctrl+K ; modèles de documents et textes prédéfinis
- Tableau de bord graphique (12 mois, top clients, conversion des devis, délai de paiement) ; documents en français ou en anglais, devise par document avec taux ; cachet/signature sur les documents ; thème sombre
- Export / import de toutes les données en JSON, sauvegarde automatique quotidienne (30 jours)

## Installation

Les installateurs sont dans l'onglet **Releases** du dépôt : https://github.com/saouthq/skanfact/releases/latest (dépôt privé : il faut être connecté à GitHub avec un compte qui y a accès).

Pour installer chez quelqu'un d'autre (un proche qui gère sa propre entreprise), voir l'article « Installer SkanFact pour quelqu'un d'autre » dans la rubrique Aide de l'application.

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

**Copie externe automatique** : Paramètres → Données → « Choisir un dossier… » (iCloud Drive, clé USB, disque réseau). À chaque enregistrement, le fichier et les sauvegardes y sont recopiés (`<dossier>/SkanFact/`).

**Mot de passe** : Paramètres → Sécurité. Le fichier de données et ses sauvegardes sont alors chiffrés (AES-256-GCM, scrypt) et le mot de passe est demandé à chaque ouverture ; Cmd/Ctrl+L verrouille. Il n'existe aucune récupération : sans le mot de passe, les données sont illisibles.

## Tests

```bash
npm test
```

Vérifie les calculs, la numérotation, le montant en lettres, l'échappement HTML, le stockage (sauvegardes, fichier illisible, import), les paquets mensuels et la logique de SkanFact Cabinet. Pour l'application **réelle**, les tests de bout en bout vivent dans `test/e2e/` (Playwright + Electron, `npm i -D playwright`, sous `xvfb-run -a` sans écran) :

```bash
npm run e2e:entreprise   # l'app entreprise, écran par écran
npm run e2e:barre        # la barre latérale MESURÉE : Aide et Paramètres visibles sur 4 tailles d'écran
npm run e2e:exemple      # charger le jeu d'exemple, et en revenir sans rien perdre
npm run e2e:reglages     # TVA du métier, modules dans les Paramètres, assistant rejouable
npm run e2e:argent       # sur quel compte tombe un encaissement, et le mois vide qu'on félicitait
npm run e2e:captures     # photographie les 20 pages (vierge + démo, 1440 et 1280) → dist-e2e/captures
npm run e2e:cabinet      # l'app cabinet : assistant, portefeuille, sauvegardes, suppression et récupération
npm run e2e:boucle       # les DEUX apps à la suite : appairage → paquet → import → écritures regroupées
npm run e2e:refus        # les cinq cas tordus de l'import d'un paquet
npm run e2e:perte        # le scénario catastrophe : la base disparaît, tout revient
npm run e2e:demenagement # changer d'ordinateur : deux postes, la même empreinte à l'arrivée
npm run e2e:couches      # les fenêtres empilées, Échap, Entrée, Cmd+K
npm run e2e:gel          # le chien de garde, sur une interface vraiment gelée
```

Ce sont les seuls qui attrapent une fonction appelée mais jamais définie dans un gabarit, une classe CSS qui prend en silence les règles d'une autre application, ou un bouton inerte parce qu'un écran passe devant.

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
src/renderer/core.js       logique métier + template du document (partagé avec les tests)
src/renderer/demo.js       jeu de démonstration (13 mois d'activité, dates relatives à aujourd'hui)
src/renderer/guide.js      textes de l'aide : bulles « i » et articles
src/renderer/onboarding.js assistant de première utilisation
src/renderer/app.js        interface
src/renderer/style.css
src/renderer/index.html
src/zip.js                 fabrication et scellage des paquets .skanpack (sans dépendance)
src/licence.js             licence hors ligne (Ed25519), testée sans Electron
scripts/licence.js         fabrique les licences (clé privée hors du dépôt)
src/cabinet/               SkanFact Cabinet : la seconde application, celle du comptable
  cabcore.js               sa logique, testée sans Electron
  cabstore.js              ses filets : sauvegardes, copie externe, clé de secours, rangement
  main.js                  état chiffré, import des paquets, appairage
  preload.js               pont sécurisé (aucune écriture chez un client)
  renderer/                ses écrans (réutilise src/renderer/style.css)
    cabguide.js            ses bulles « i » et ses articles d'aide
build/cabinet.config.js    configuration electron-builder du second installeur
test/run-tests.js
```

### SkanFact Cabinet

Une seconde application, gratuite, destinée aux cabinets comptables : elle **reçoit** les paquets mensuels des entreprises, vérifie leur intégrité, montre qui n'a pas envoyé son mois et prépare les relances. Elle ne modifie jamais les données d'un client et ne lui renvoie rien.

```bash
npm run start:cabinet        # lancer l'app cabinet en développement
npm run build:cabinet:mac    # ou :win — installeur dans dist-cabinet/
```

Ce qu'elle fait, depuis la 6.8.0 :

- **Dossiers** — un par client, y compris ceux qui n'utilisent pas encore SkanFact (créés à la main, ou collés depuis un tableur). Tableau de bord du portefeuille, tri, pagination, export CSV, Cmd+K.
- **Échéances** — le calendrier des dépôts, rattaché aux paquets qu'on n'a pas reçus. Les dates suivent l'usage tunisien, se règlent, et portent « À VÉRIFIER ».
- **Écritures** — toutes les écritures en partie double de tous les clients sur un mois ou un exercice, en un seul CSV pour le logiciel de production.
- **Relances** — enregistrées (date, moyen, mois réclamés), groupées, avec un jour de relance réglable.
- **Les filets** — sauvegarde quotidienne, copie vers un autre support (base, sauvegardes **et** paquets), clé de secours exportable, mot de passe modifiable, restauration qui annonce ce qu'on perdrait.

Les paquets reçus sont rangés dans `userData/paquets/<client>/<année>/<mois>.skanpack` : on les retrouve dans le Finder sans ouvrir l'application, et on rend ses pièces à un client en copiant un dossier.

Les deux applications partagent le **même numéro de version** (`package.json`) depuis la 6.6.0, ce qui permet de les publier dans la même release ; ce qui les sépare est le **canal** de mise à jour (`latest.yml` contre `cabinet.yml`).

## Clés de licence client (6.4.0, armée en 8.0.0)

> Cette section concerne l'**activation de l'application chez un utilisateur**. Pour les droits sur
> le code source, voir « Droits d'utilisation » en haut de ce fichier.

La vérification est **hors ligne** : une clé signée Ed25519, vérifiée avec la clé publique embarquée dans `build/licence-public.json`. Depuis la **8.0.0** ce fichier porte la clé de l'éditeur : chaque installation a **30 jours d'essai** à partir du jour où elle voit cette clé (pas du premier lancement : une installation ancienne qui reçoit la 8.0.0 repart pour trente jours), puis attend une clé de licence — *Indépendant* ou *Entreprise*, l'offre voyage dans la clé, attachée au matricule fiscal.

Les clés se fabriquent **depuis SkanFact** (Paramètres → L'application → Licence, puis la page Licences : émission, facture, historique, renouvellement), sur le poste qui détient la clé privée (`~/.skanfact/licence-privee.pem`, jamais commitée). Ce poste-là — et lui seul — est en état « éditeur » : ni essai, ni verrou. L'outil en ligne de commande reste disponible :

```bash
node scripts/licence.js --keygen        # clés dans ~/.skanfact/ (privée en 0600, publique à côté)
node scripts/licence.js --nom "Client SUARL" --matricule 1234567A --mois 12
node scripts/licence.js --verifier SKAN1.…   # vérifie une clé avec la clé embarquée
```

Une licence expirée n'empêche que la **création** de nouvelles pièces : lecture, impression, export, sauvegardes et paquet mensuel restent disponibles. Les tests qui ouvrent l'application tournent avec un dossier de clés vide (`SKANFACT_DOSSIER_CLES`), donc en essai, comme un client ; `e2e:licence` la désarme par `SKANFACT_CLE_EMBARQUEE` (développement seulement) pour créer ses propres clés d'essai.

## Limites connues

- Un document qui déborde d'un peu se resserre automatiquement pour tenir sur une page A4 ; au-delà, il passe sur plusieurs pages (lignes jamais coupées, en-tête du tableau répété) mais le pied de page n'apparaît qu'à la fin. L'aperçu indique le nombre de pages.
- Plusieurs entreprises sur un même ordinateur sont possibles depuis la 3.2.0 (dossiers, `userData/dossiers/<id>/`), et un dossier peut vivre dans un espace partagé — mais **à tour de rôle**, pas à deux en même temps : l'application détecte le conflit, fusionne et le dit, elle ne synchronise pas en temps réel.
- SkanFact Cabinet : un poste, un mot de passe, une personne. Pas encore de collaborateurs.
- Retenue à la source : calculée sur le TTC hors timbre ; taux et assiette **à vérifier avec le comptable** selon la nature de la prestation.
- Apps non signées (pas de certificat Apple ni Windows) : avertissements au premier lancement, voir « Installation ».
- L'icône de l'app est `build/icon.png` (1024×1024) ; electron-builder la convertit en `.icns` / `.ico` au build. Pour en changer, remplace ce fichier.
