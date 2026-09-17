# SkanFact — consignes pour Claude

Application desktop Electron (JS pur, sans bundler) de devis et factures pour une petite entreprise, dans le contexte fiscal tunisien. Propriétaire : Skander Ben Amor (saouthq), qui l'utilise pour SKANCYBER SECURITY SUARL. Il communique en français, tutoiement, débutant Git/terminal : il ne veut pas taper de commandes, Claude fait le travail en autonomie (commits, releases, vérification des builds). Quand quelque chose est incertain (fiscalité), le signaler par « À VÉRIFIER ».

**Depuis la 2.0.0, aucune entreprise n'est écrite en dur** : `DEFAULT_COMPANY` est vide et un assistant de première utilisation (`src/renderer/onboarding.js`) renseigne la société. Skander compte partager l'app avec sa famille, chacun gérant sa propre entreprise sur son ordinateur. Ne jamais réintroduire « SKANCYBER » ni le matricule 1998268D dans le code, les valeurs par défaut, le pied de page ou le jeu de démo. Exception : `build.appId` (`tn.skancyber.skanfact`) reste inchangé, c'est l'identifiant technique du paquet — le modifier casserait la mise à jour des apps déjà installées.

L'utilisateur est débutant en gestion (première entreprise) : chaque champ porte une bulle « i » (`src/renderer/guide.js`) et la rubrique Aide explique la facturation, la fiscalité et la routine comptable. Toute nouveauté doit venir avec sa bulle et, si elle change une habitude, un paragraphe dans l'article concerné. Un test vérifie que chaque clé posée dans l'interface existe dans `guide.js`.

## Index thématique

*Ce fichier est rangé par VERSION, dans l'ordre où les choses sont arrivées : c'est ce qui permet de
comprendre pourquoi une règle existe. Mais quand on cherche « la règle sur les dates » ou « celle
sur les tests qui lisent du code », l'ordre chronologique n'aide pas. Voici l'entrée par thème.
Chaque ligne renvoie à la section qui l'explique en entier — avec le défaut réel qui l'a fait
écrire, parce qu'une règle sans son défaut ne se retient pas.*

**Ce qui se casse en silence, et qu'aucune console ne montre**

| Symptôme | Où c'est expliqué |
|---|---|
| Un bouton visible et **inerte** (les clics atterrissent ailleurs) | 5.2.2 — l'ordre des couches ; 7.28.0 — le garde-fou global qui vole le clic |
| Un bouton qui **accepte le clic et ne fait rien** | 7.0.0 — les treize « Voir » sans action ; 7.17.0 — les écrans qui ne répondent pas |
| L'application **gèle** sans erreur (Cmd+Q sans effet, défilement qui marche encore) | 5.2.3 — boucle infinie de date ; 6.5.0 — le chien de garde ; 8.1.0 — la veille n'est pas un gel |
| Un **écran blanc**, une fenêtre qui ne s'ouvre pas, rien en console | 7.20.0, 7.22.0, 7.23.0 — une fonction ou une variable d'un autre module ; 9.1.0 — le garde-fou d'erreur et le lint |
| Un **texte illisible** (blanc sur blanc), un en-tête mal aligné, un fil vertical | 7.12.0, 7.23.0, 7.27.0, 7.30.0, 9.4.3 — le HTML est juste, c'est la feuille de style qui décide : **mesurer** |
| Une **exception qui échappe à un handler** : rien à l'écran qu'on ait écrit, rien au journal | 9.4.10 — `err.code` **ne traverse pas** le pont IPC |
| Un bouton **hors de l'écran**, une barre empilée sur trois rangées | 7.13.0, 7.23.0 — `e2e:contraste` et `e2e:entetes` mesurent le bouton, jamais la page |

**Les chiffres**

| Règle | Où |
|---|---|
| Une date est un **jour de calendrier**, jamais un instant : arithmétique en UTC pur | 5.2.3 (et le lint l'interdit depuis la 9.1.0) |
| **Aucun taux n'est écrit en dur** dans un calcul | 5.0.0 — la paie ; 8.3.0 — la liste propose, elle n'enferme pas |
| Tout ce qui **additionne** plusieurs pièces se convertit dans la devise de base | 7.0.1 — le timbre en euros ; 7.16.0 — les cartes de l'accueil |
| Une pièce émise garde une **copie** de ce qui a servi à la calculer | 7.1.x — le timbre ; 5.0.0 — `slip.computed` ; 9.0.0 — les charges patronales |
| Un compteur et la liste qu'il annonce se calculent avec la **même fonction** | 6.8.1 — le bandeau des relances ; 7.15.0 — « Reste à encaisser » |
| Un montant **négatif change de colonne**, il ne garde pas son signe | 6.3.0 — les écritures comptables |
| Un **agrégat** porte une devise, une unité, et une période nommée | 7.0.1, 7.16.0, 3.1.0 ; 9.4.9 — une courbe d'une barre cède la place au chiffre |
| Un **rapprochement faux** ferme la question : une ambiguïté n'est JAMAIS « certain » | 9.5.0 |
| Une écriture qui SOLDE un compte ne compte pas dans ce qu'elle déclare | 9.6.0 |
| Un **lettrage généreux** affirme qu'une facture est payée : somme nulle, ou rien | 9.5.0 |
| Un **pied de totaux** porte la sélection entière, jamais la page affichée ; on pagine ce qu'on NOMME | 2.2.0, 7.16.0, 9.4.5 |
| La valeur par défaut d'une **règle qu'on ne connaît pas** est celle qui ne fait rien | 9.1.1 — le seuil de retenue à 0, la TFP qu'aucun métier ne porte ; 9.6.0 — une case fiscale vaut `null`, jamais 0 |
| Une écriture **validée** ne se modifie jamais : elle se contre-passe, à la date du jour | 9.2.0 |
| Un **numéro** naît à la validation, et le contrôle passe AVANT l'attribution | 9.2.0 ; 6.0.0 — `nextNumber` |
| On pointe une **occurrence**, jamais une règle ; et le pense-bête dit qu'il n'est qu'un pense-bête | 7.21.0, 5.2.0, 9.4.6 |

**Les tests**

| Règle | Où |
|---|---|
| **Tout test se prouve en réintroduisant son défaut.** Sinon on ne sait pas ce qu'on a écrit | 7.2.0, 7.22.0, 7.25.0, 7.27.0 — six tests qui ne pouvaient pas échouer |
| Un test qui lit du code doit lire du **CODE** : commentaires et chaînes retirés d'abord | 6.8.0, 7.25.0, 9.4.10 — un commentaire satisfaisait l'assertion |
| Une **suite découpée** que le lanceur ne charge pas n'existe pas : le dossier fait foi | 9.4.10 |
| Un montant qui se **divise sans reste** ne prouve rien d'un arrondi : les DONNÉES du test comptent autant que sa forme | 9.6.1 |
| Une **réexportation** se prouve par l'identité d'objet, jamais par le résultat | 9.6.1 |
| Une assertion sur un montant se **calcule à la main**, jamais en recopiant la sortie | 7.0.1 — l'assertion qui gravait le bug depuis la 1.6.0 |
| Un test écrit contre l'état du jour **décrit cet état**, pas la règle | 7.12.0, 7.26.0, 8.0.1, 8.2.0, 9.1.0, 9.2.2, 9.4.3, 9.4.5 — neuf assertions retournées |
| Une **tranche** de source se prouve par sa taille et par ce qu'elle ne contient PAS | 7.20.0, 7.21.0, 8.2.0 ; 9.4.6 — jamais sur un décalage en dur |
| Un e2e **se périme** : reconnaître un écran à ce qu'il CONTIENT, jamais à son rang | 7.3.0, 7.28.0, 7.29.0, 7.30.0, 9.2.2, 9.4.5 — six parcours pourris sans un mot |
| Un e2e qui reste **bloqué** est pire qu'un e2e qui échoue | 7.28.0 — `Promise.race` sur toute fermeture |
| `ta()` sans `await`, `t()` avec une fonction asynchrone : « ok » sans rien vérifier | 6.7.0, 8.4.0 |
| Un test **trop étroit** accuse du code juste — aussi grave qu'un test trop large | 9.1.0, 9.2.0 — le jumeau du contrôle du pont, sans son nettoyage ; 9.4.7 — une sous-chaîne ambiguë |
| Une assertion ancrée sur une **forme** tombe sur du code juste : on la retourne vers la RÈGLE | 7.16.0, 8.2.0, 9.4.1 — trois en une version |
| `npm test \| tail` **masque le code de sortie** : un commit part avec un test rouge | 9.2.0 |

**Les deux applications**

| Règle | Où |
|---|---|
| Une règle apprise d'un côté **se vérifie de l'autre**, à la main | 7.3.0 (purge des sauvegardes), 7.18.0 (`pl`), 7.32.0 (« À faire »), 8.1.0 (le saut d'horloge) |
| Un **INSTRUMENT qui ne couvre qu'une des deux applications** ne protège qu'une des deux | 9.4.3 |
| Une **capture qui s'arrête au bas de l'écran** fait juger une page sur son premier écran | 9.4.3 |
| Un fichier partagé a **trois** branchements : les deux `index.html`, dans l'ordre, et les `files` du Cabinet | 7.26.0 (`depot.js`), 7.29.0 (`rowmenu.js`), 9.1.0 (`compta.js`) |
| Le Cabinet **n'écrit jamais** chez un client et ne lui renvoie rien | Cabinet 1.0.0 |
| Une classe du Cabinet ne peut pas porter un nom déjà pris dans la feuille partagée | 6.8.0 — `.setup-card` |
| Un drapeau qui vit **en double** diverge, toujours | 7.26.0 — `src/depot.js` |

**L'interface**

| Règle | Où |
|---|---|
| Un **bouton sans bordure ni couleur n'est pas un bouton** : il se reconnaît AU REPOS, pas au survol | Cabinet 1.0.0, 9.4.2 |
| Un **titre gris de 11 px ne hiérarchise rien** : il décore. Trois niveaux, un rôle chacun | 9.4.3 |
| Un **total vit sous sa colonne** ; un raccourci s'affiche comme une **touche**, pas comme du texte | 9.4.5 |
| Ce qui prend la place n'est pas le **nombre** d'objets mais leur **taille** : replier avant de paginer | 9.4.5 |
| Un champ **pré-rempli** se sélectionne au clic, sinon la valeur proposée est imposée | 9.4.5 |
| Une **classe posée par le code et inconnue de la feuille** ne se voit nulle part | 6.8.0, 7.23.0, 7.27.0, 8.1.0, 9.4.3 |
| Un CSS **physique** décrit un écran, un CSS **logique** décrit une lecture ; l'exception est NOMMÉE | 9.4.10 |
| Une **règle générale qui vise un élément** avale l'exception qu'on vient d'y poser (`:not()`) | 7.23.0, 7.27.0, 7.30.0, 9.4.8 |
| Une **phrase rassurante** se vérifie d'abord sur un univers non vide | 7.0.0, 7.3.0, 9.4.2 |
| Un **avertissement** se lit AVANT le geste, jamais sous le bouton | 9.4.2 |
| Une ligne garde **au plus UN** bouton visible ; le reste passe par `rowmenu.js` | 7.29.0 ; 9.4.8 — un en-tête de fiche aussi |
| **UNE seule table d'actions par racine** : `bindRowMenus` écrase la précédente, en silence | 9.4.8 |
| Un **champ qui compte dans une unité** le dit à côté de lui, pas en légende dessous | 9.4.8 |
| Un refus dit **trois** choses : ce qui est refusé, pourquoi, et le bouton qui débloque | 7.0.0, 9.2.1 |
| Un refus qu'on a **écrit** est une réponse ; seule une **panne** va au journal | 9.4.10 |
| Un **bouton éteint dit pourquoi**, et par la MÊME fonction que celle qui refusera | 9.4.5 |
| Une saisie refusée se **MONTRE** : on amène le champ à l'écran (`refus()`) | 7.0.0, 7.20.0 |
| Ce qui **détruit** demande ; ce qui **se répare** laisse un « Annuler » (`toastUndo`) | 7.12.0 ; 9.4.6 — porté au Cabinet |
| Un écran qui **NOMME** un ensemble doit pouvoir l'ouvrir | 7.15.0, 7.17.0, 7.21.0 |
| Chaque écran **finit par le geste suivant** : le métier est une boucle, pas quatre pages | 7.27.0, 9.4.9 |
| Une **prose sous un tableau** remplace la découvrabilité : l'explication va dans la bulle du titre | 9.4.9 |
| L'endroit qui **affiche** un état est celui où on s'attend à le changer | 7.14.0 |
| Un **moteur sans écran n'existe pas** ; une fonction jamais appelée est invisible | 7.2.0, 7.3.0, 7.19.0 |
| Un **extrait sans son cadre** fait douter de l'outil : montrer l'ensemble, griser ce qui ne compte pas | 9.4.7 |
| Un **état vide secondaire** s'annonce ; celui qui EST le corps d'un écran garde sa présence | 9.4.7 |
| Une **phrase affichée** que rien ne tient est un bug, pas une imprécision | 7.3.0, 7.6.0, 8.0.0 ; 9.4.5 — un COMMENTAIRE aussi |
| `navigate()` vers la page courante ne redessine **rien** : `vers()` | 7.15.0, 7.29.0 |
| Un état lu une fois au démarrage **se périme** | 7.1.x, 8.0.0 |

**Ce qu'on ne fait jamais**

| | Où |
|---|---|
| Jamais de **données en otage** : une licence expirée ne bloque que la création | 6.4.0 |
| Jamais de **message brut** à l'écran : `updateProblem(err)` | 7.26.0 |
| Jamais **prétendre** ce qu'on ne peut pas prouver (« 7 pièces vérifiées, intactes ») | Cabinet 1.0.0, 8.1.0, 8.2.0 |
| Jamais de **retour en arrière** de version, sauf sortie du canal d'essai | 6.7.3, 7.25.0, 9.1.0 |
| Jamais **toucher à la clé publique** de `build/licences-publiques.json` | Règles de travail, 8.0.0 |
| Jamais **embarquer une clé publique dont la privée a été VUE** : elle est brûlée, on la recrée | 9.4.1 |
| Jamais de **token** commité | Règles de travail, 6.7.0 |
| Jamais **chiffrer en croyant signer** : seule une signature dit d'où ça vient | 9.2.0 |
| Jamais une **cellule CSV** exécutée par un tableur (`=` `+` `-` `@`) | 9.1.1 |
| Jamais **écraser le travail du cabinet** avec un mois que le client renvoie | 9.2.0 |

**L'outillage (9.1.0)**

`npm test` (les tests purs) · `npm run lint` (ESLint, zéro erreur exigée) · `npm run charge` (le test
de charge du livre) · `npm run e2e:<nom>` (48 parcours, tableau au § « Les tests qui ouvrent vraiment
l'application ») · CI GitHub sur Linux et Windows à chaque poussée · « Construire un essai » pour
faire tester une version sans la publier.

**Les documents du dépôt**, et lequel fait foi :
`DIRECTION.md` (prime sur tous) → `CAHIER-DES-CHARGES.md` (les spécifications citables) →
`VERSIONS-A-VENIR.md` (tout ce qui reste à faire, 9.1.0 → 10.0.0) → `PLAN-DEVELOPPEMENT.md` (le
calendrier et les jalons). `QUESTIONS.md` répond à tout le reste — c'est le document à ouvrir quand
on est perdu. `PLAN-CABINET.md`, `PLAN-COMPTABLE.md`, `PLAN-PLATEFORME.md`, `PLAN-UX.md` pour un
chantier précis ; `ROADMAP.md` est une **archive**.

---

## Règles de travail

- **Chaque amélioration livrée = une nouvelle version** (semver) : correctif 1.0.x, fonctionnalité 1.x.0, gros changement x.0.0. Mettre à jour `package.json` (`version`) **et** ajouter une entrée datée dans `CHANGELOG.md` (c'est elle qui devient les notes de version dans l'app et sur GitHub). Toujours annoncer le numéro de version dans la réponse.
- Lancer `npm test` avant tout commit (calculs, numérotation, montant en lettres, échappement HTML, stockage/sauvegardes). Pour un changement d'interface, lancer aussi l'app réelle (`xvfb-run` + Playwright `_electron`, voir README « Tests ») : elle attrape les erreurs JS du renderer.
- Ne jamais commiter de token. Le jeton GitHub que l'utilisateur colle (quand le dépôt est privé) est stocké dans `userData/update-config.json`, jamais dans le code.
- **La licence est ARMÉE depuis la 8.0.0** : la clé publique de Skander (créée dans SkanFact le 14/09/2026) vit dans `build/licences-publiques.json` sous le `kid` **`master`**, et `build/licence-public.json` la porte encore à l'identique (repli des versions d'avant la 8.4.0). Ne jamais la supprimer, la régénérer ni la remplacer — une autre clé invaliderait toutes les licences déjà vendues, et son absence désarmerait tous les clients. **Une licence sans `kid` se vérifie avec `master`** : toutes celles vendues depuis la 8.0.0 sont dans ce cas. La clé privée vit dans `~/.skanfact/` sur son Mac, jamais dans le dépôt. Des tests exigent la présence du fichier, que ce soit une vraie clé Ed25519, que `master` soit identique au caractère près à celle de la 8.0.0, et que le glob d'electron-builder embarque bien les deux fichiers. **Depuis la 8.6.0 le même fichier porte `srv-1`** (créée dans SkanFact le 15/09/2026), la clé de second rang avec laquelle la console signe les ventes : sa privée vit dans le réglage Cloudflare `SRV_PRIVATE_KEY`, jamais dans le dépôt. La retirer un jour (compromission) est une décision qui exige de réémettre les licences qu'elle a signées ; la « retirer » se fait par `retiree: true`, pas en effaçant l'entrée. **Depuis la 9.4.1 le champ `reponse` porte la clé publique de RÉPONSE** (créée dans SkanFact le 17/09/2026 — celle du 15/09 était brûlée, sa privée ayant transité par une conversation) : sa privée vit dans le réglage Cloudflare `REPONSE_PRIVATE_KEY`, jamais dans le dépôt, et c'est elle qui fait qu'une révocation prononcée depuis la console s'applique chez un client à jour. Un test exige qu'elle soit une Ed25519 distincte de `master` et de `srv-1`. Ne jamais la remplacer par une clé dont la privée a été vue (`plateforme/README.md` § 4).
- **Partager un dossier à deux se fait en DEUX gestes**, et ils vivent dans `src/main.js` :
  `dossiers:share` copie le dossier OUVERT vers un emplacement commun (l'original reste, la bascule
  n'a lieu qu'une fois la copie constatée), `dossiers:join` ouvre un dossier déjà posé sans rien
  créer. Ne jamais revenir à « créer un dossier partagé vide » : c'est le défaut que la 7.28.0 a
  corrigé.
- **Les actions d'une ligne vivent dans un menu** — `src/renderer/rowmenu.js`, chargé par LES DEUX
  applications (`RowMenu.cellule` / `RowMenu.brancherMenus`) — pas dans une rangée de boutons. Une
  ligne garde au plus UN bouton visible, celui du geste pour lequel la page existe. Toute nouvelle
  liste passe par là, chaque action porte une phrase et une icône, et toute action qui change
  l'état d'une pièce demande d'abord — puis propose la suite.
- **Les réglages passent par `src/renderer/reglages.js`**, chargé par LES DEUX applications :
  sommaire de l'onglet, recherche, et UNE porte pour amener un panneau à l'écran. Un panneau de
  Paramètres se déclare dans `SETTINGS_PANNEAUX` (onglet, titre, synonymes) et se pose par
  `panneau(id)` : la table sert au titre, au `data-mots` de la recherche ET à l'entrée de palette
  Cmd+K, donc les trois ne peuvent pas diverger. Un test vérifie que chaque panneau déclaré est posé
  une fois et une seule, et qu'aucun n'échappe à la table.
- **Le dépôt est PUBLIC depuis le 13/09/2026** (GitHub Actions y est gratuit) et redeviendra peut-être privé. La bascule est **une seule ligne** : `private` dans **`src/depot.js`**, que les deux applications lisent — le champ « jeton d'accès » revient alors tout seul dans leurs Paramètres. Ne jamais redéclarer ce drapeau ailleurs : il avait été écrit dans les deux `main.js`, et ils ont divergé. `npm run e2e:depot` bascule vraiment et vérifie l'écran.
- **Aucun message d'erreur brut ne remonte à l'écran** : `updateProblem(err)` (dans les deux `main.js`) rend une phrase en français, range le texte d'origine dans `detail` (replié sous « Détails techniques »), et marque `soft` ce qui n'est pas une panne.
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
- `core.fitToPage(document)` puis `core.paginate(document)` : exécutés dans l'aperçu (iframe) et dans la fenêtre PDF (main.js), **dans cet ordre et toujours les deux** (`mettreEnPage` dans app.js, `renderPdf` dans main.js). `fitToPage` repère le débordement ; `paginate` choisit le resserrement utile (`compact`, `dense`) et découpe le document en **une `.page` par feuille A4**, pied numéroté compris. Les deux sont **autonomes** : `main.js` les sérialise, elles ne peuvent appeler aucune autre fonction de core.js. Après toute modification du template, lancer `npm run e2e:pages` (161 documents imprimés et mesurés).
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
- Dépôt **public** depuis le 13/09/2026, pour que les publications soient gratuites ; il pourra redevenir privé (`src/depot.js`). Le relais de mise à jour fonctionne à l'identique dans les deux cas.

## Contexte fiscal (À VÉRIFIER avec le comptable)

Celui de Skander : régime réel, assujetti TVA (son matricule est saisi dans l'app, pas dans le code). Timbre fiscal 1 DT par facture. Retenue à la source : onze taux **proposés** depuis la 8.3.0 (0,5 / 1 / 1,5 / 2,5 / 3 / 5 / 10 / 15 / 20 / 25 %), plus « Autre taux… » qui accepte n'importe quel autre — la liste ne doit **jamais** redevenir fermée. Assiette = TTC hors timbre — À VÉRIFIER. Avoir sans timbre par défaut — À VÉRIFIER.

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

*(Direction du 15/09/2026, `DIRECTION.md` : le Cabinet n'est plus gratuit sans condition — gratuit pour les dossiers sur SkanFact et trois dossiers hors SkanFact, payant au-delà — et il devient le logiciel de comptabilité du cabinet. Ce qui suit reste vrai pour le reste.)* Skander veut vendre SkanFact aux entreprises **en passant par les cabinets comptables** : cabinet gratuit (app **SkanFact Cabinet**, même dépôt, second installeur), entreprise payante, remise pour le client parrainé, jamais de commission au comptable (déontologie À VÉRIFIER). Pas de serveur en v1 : les deux apps s'échangent un **paquet mensuel chiffré** (`.skanpack`). Le plan complet, les versions dans l'ordre (6.0.0 clôture → 6.1.0 paquet → 6.2.0 appairage → Cabinet 1.0.0 → Cabinet 1.1.0 export d'écritures → 6.3.0 licence/mises à jour publiques → 6.4.0 signature → 6.5.0 filets → 7.0.0 serveur seulement si un cabinet dit oui) et l'inventaire (achats, décisions, questions au comptable, vérifications légales) sont dans **`PLAN-CABINET.md`**. Le lire avant de commencer une version 6.x. Règles fixées : l'app cabinet **ne modifie jamais** les données du client ; un paquet n'est **définitif** que si le mois est clôturé ; l'empreinte du cabinet est **à la fois** la clé de chiffrement et la preuve du parrainage ; à l'expiration d'une licence, **jamais de données en otage**.

## Cabinet 1.0.0 — la seconde application

`src/cabinet/` : une **autre application Electron dans le même dépôt**, construite par `build/cabinet.config.js` (`appId` `tn.skancyber.skanfact.cabinet`, `extraMetadata.main` → `src/cabinet/main.js`, sortie `dist-cabinet/`, `publish: null`). *(Vrai en 1.0.0 : sa version vivait dans `cabinetVersion` de package.json, sans mise à jour automatique. **Depuis la 6.6.0 les deux applications portent le MÊME numéro** — `build/cabinet.config.js` lit `pkg.version`, `cabinetVersion` n'existe plus — et le Cabinet se met à jour par son canal `cabinet`.)* Le workflow Release la construit après l'app principale et attache ses installeurs à la même release (`gh release upload`).

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
- Le **jeu d'exemple** (`demoDossiers`) montre les quatre situations et s'efface tout seul au premier vrai paquet : des retards imaginaires à côté des vrais seraient pires que rien. *(Jusqu'à la 9.2.1 ses paquets n'avaient pas de `path` ; depuis la 9.2.2 ce sont de vrais `.skanpack`, voir § 9.2.2.)*
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

`src/licence.js` (Node pur, testé) : `generateKeys`, `signLicence`, `parseKey`, `verifyKey`, `licenceState`, `requestMail`. `scripts/licence.js` fabrique les clés (privée en mode 600 dans `~/.skanfact/`, **jamais** dans le dépôt ; publique à côté — depuis la 7.33.0 le keygen n'écrit plus dans `build/`, et depuis la 8.0.0 ce fichier est la clé de Skander, voir § 8.0.0). Dans main.js : `licence:status` / `licence:set` (refuse une clé invalide au lieu de la stocker) / `licence:requestMail`, `installedAt` dans `app-config.json`. Dans app.js : `licenceBlock(quoi)` — une seule porte, comme `closedBlock` — et l'onglet **Paramètres → Licence**.

Règles apprises :
- **Jamais de données en otage.** Une licence expirée ne bloque QUE la création de nouvelles pièces. Lire, imprimer, exporter, sauvegarder, envoyer le paquet au comptable : toujours. Un test relit `app.js` et vérifie qu'aucun `licenceBlock` n'est posé ailleurs que sur une création.
- **Modifier une pièce existante reste possible** même bloqué : sinon une licence expirée empêcherait de corriger une faute de frappe.
- **L'application est livrée désarmée** *(vrai de la 6.4.0 à la 7.33.0 — retourné en 8.0.0, voir § 8.0.0 : le test exige désormais la PRÉSENCE du fichier)*. Sans `build/licence-public.json`, l'état est `libre` et rien ne se verrouille. Armer la licence est une décision du propriétaire, pas l'effet de bord d'une mise à jour.
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
| `npm run e2e:argent` | **où tombe l'argent** : deux comptes, un règlement en espèces qui va dans la caisse et pas à la banque, un paiement qu'on corrige, et le mois vide que le Cabinet ne déclare plus complet |
| `npm run e2e:captures` | photographie les 20 pages, leurs onglets et quatre gestes, en vierge et en démo, à 1440 et 1280 |
| `npm run e2e:captures-site` | **les images destinées au site** : dix écrans et onze recadrages, sur le jeu d'exemple, marqueurs du test masqués (bandeau « exemple », tampon EXEMPLE, message passager, numéro de version, pastille d'essai) — ils n'existent que parce que la machine est une installation neuve, et les montrer donnerait une image fausse du produit. Son jumeau `node test/e2e/sequence-site.js` (sans entrée npm) filme le parcours devis → facture → PDF en dix images légendées |
| `npm run e2e:parametres` | **les réglages, mesurés** : par onglet et pour les deux applications — combien de champs, combien de bulles, combien d'écrans de haut, quels panneaux, quels boutons (`dist-e2e/parametres/mesures.json`), plus une capture par onglet, en clair, en sombre et à 1280. Un instrument, pas un test : c'est lui qui dit qu'un onglet fait 0,2 écran et un autre 2,5 |
| `npm run e2e:gel` | le chien de garde : l'interface est VRAIMENT gelée, et le journal nomme la fonction coupable |
| `npm run e2e:contraste` | **aucun bouton illisible ni hors de l'écran** : contraste texte/fond et débordement de chaque bouton visible des 21 pages et de tous les éditeurs, en clair, en sombre, à 1440 et à 1280 |
| `npm run e2e:apercu` | **voir ce qu'on fabrique** : le grand aperçu, son zoom, « Ajuster », Échap, et l'interrupteur qui reste en haut |
| `npm run e2e:erreur` | **le droit à l'erreur** : une case de module se décoche ET se recoche, un module masqué revient quand on y écrit, et « Marquer déposée » se défait |
| `npm run e2e:entreprises` | **changer d'entreprise depuis le haut du menu** : deux dossiers créés et ouverts tour à tour sans passer par les Paramètres |
| `npm run e2e:chiffres` | **les chiffres qui mentent** : la conversion des devises sur l'accueil, les cartes de Marges, l'affaire qui suit le devis, le devis déjà facturé, le doublon de facture fournisseur |
| `npm run e2e:cliquable` | **tout ce qui se lit se clique** : le filtre « Émis », la concordance carte/liste, les quatre chiffres de l'accueil et chaque ligne de « Ce qui manque » |
| `npm run e2e:repondre` | **les écrans qui ne répondent pas** : le pointage qui se défait, le curseur qui ne saute plus, le sélecteur d'année inerte, le tri qui ne triait pas, l'année figée, l'export qui suit l'onglet |
| `npm run e2e:accueil` | **l'accueil tient ses promesses** : le filtre qui ne se rearme pas, le raccourci qui vise un panneau, l'extrait sans total, le contrat suspendu qui demande, la recherche des Relances, la réponse à un devis |
| `npm run e2e:editeur` | **l'éditeur de document** : le timbre dans la devise de la pièce, l'échéance qui suit la date, la quantité effacée, la fiche du client, l'acompte en dinars, la suppression qui nomme les liens, le bouton d'une facture soldée |
| `npm run e2e:fiches` | **les fiches et les formulaires** : l'étoile des champs obligatoires et le refus qui montre, la fiche article depuis le Catalogue, le catalogue dans un achat, la ligne en immobilisation, les affaires et contrats du client |
| `npm run e2e:compta` | **la comptabilité mène aux pièces** : les contrôles de clôture armés, les douze mois de TVA cliquables, l'échéance fiscale qu'on pointe et qu'on dépointe, le mouvement qui ouvre sa facture, la carte « Reste à encaisser » |
| `npm run e2e:retenue` | **la retenue à la source** : les six écrans qui proposent un taux, « Autre taux… » branché partout, un taux libre qui recalcule vraiment, l'annulation qui ne laisse pas « __autre__ », et la fiche client qui garde un taux hors liste |
| `npm run e2e:metier` | **le métier** : quinze activités sans taux deviné, le régime fiscal posé puis conservé au redessin, les Paramètres qui grisent la TVA et annoncent la mention, le RIB non réclamé à qui encaisse sur place |
| `npm run e2e:partage` | **partager une entreprise déjà saisie** : deux applications, deux profils, un emplacement commun — on partage, le second poste rejoint sans assistant, et ce que l'un enregistre l'autre le voit |
| `npm run e2e:actions` | **une seule porte par ligne** : un menu d'actions écrites en toutes lettres et illustrées sur huit listes, un bouton qui ouvre ET referme, qui ne vole pas le clic de la ligne, la question posée avant d'agir, et « Accepter et facturer » qui ouvre le brouillon |
| `npm run e2e:aide` | **l'Aide, mesurée** : le plan (sept sections, trente-deux articles, sept couleurs), la pastille qui descend à sa section sans dupliquer le plan, le fil d'Ariane sur UNE ligne, « suivant » dans la colonne de l'article, le geste qui mène à sa page, la recherche classée et surlignée, et le sommaire d'un article long (absent d'un article court) |
| `npm run e2e:colonnes` | **les colonnes alignées** : l'en-tête de chaque colonne de chaque tableau comparé à ses valeurs, sur 19 pages et tous leurs onglets (392 colonnes) |
| `npm run e2e:entetes` | **les barres d'actions mesurées** : aucun contrôle d'en-tête étiré sur toute la largeur, aucune barre empilée sur trois rangées (21 pages) |
| `npm run e2e:beta` | **le canal bêta** : la case décochée à l'installation, la question avant de cocher, le refus qui décoche vraiment, la sauvegarde « avant-beta » écrite sur le disque, et le retour en arrière sans question |
| `npm run e2e:depot` | **public ou privé** : `src/depot.js` est VRAIMENT basculé en privé, l'application ouverte, le champ jeton doit revenir — puis repartir au retour au public (le fichier est restauré quoi qu'il arrive) |
| `npm run e2e:pages` | **les pages d'un document imprimé** : 161 documents (7 types × 6 variantes × 1 à 40 lignes) rendus dans chromium et imprimés en PDF — aucune ligne perdue, aucune page qui déborde, aucun pied par-dessus le contenu, une feuille par page et chacune numérotée. **Pas besoin de `xvfb`** : il n'ouvre pas Electron |
| `npm run e2e:pont` | **le pont comptable** : le vrai worker sur SQLite et l'application en état éditeur — un secret faux refusé, le bon gardé en 0600 hors des données, deux ventes de la console tirées en deux brouillons (client retrouvé par matricule ou créé), le menu d'une licence de la console sans « Renouveler », le numéro rendu à l'émission et lu dans la base, la console éteinte dite en français |
| `npm run e2e:livres` | **les livres comptables** : chaque compte du grand livre avec son solde progressif qui finit sur le total, le sélecteur de compte, la balance dont les six totaux tombent juste, l'auxiliaire clients, la case « un sous-compte par tiers » qui donne 411001… et les fige sur les fiches, le livre-journal numéroté et son centralisateur, une OD refusée puis enregistrée, le lettrage qui ouvre sa pièce, les états financiers équilibrés, l'à-nouveau de janvier, l'état de rapprochement à écart nul, la TFP dans les barèmes |
| `npm run e2e:justificatif` | **le justificatif se joint avant toute saisie** : sélecteur de fichier remplacé dans le processus principal, une photo jointe sur un achat VIDE, enregistrée avec la pièce, retrouvée sur le disque et dans la liste (📎), un second fichier sur la pièce rangée, une pièce abandonnée qui ne laisse pas de copie, la lecture d'une photo qui redessine sans perdre la pièce, et le même geste sur un devis neuf |
| `npm run e2e:cabinet-jour1` | **le premier jour d'un comptable** : l'instrument qui MESURE ce qu'il voit, dans l'ordre où il le voit — 35 écrans photographiés du mot de passe à l'Aide, et six règles qui tombent (un bouton hors de l'écran, un bouton qui ressemble à du texte, un état vide sans geste, un champ de saisie sans bulle « i », une boîte sans étiquette, un débordement horizontal). `dist-e2e/cabinet-premier-jour/mesures.json` |
| `npm run e2e:cabinet-rendu` | **le rendu du Cabinet, mesuré** : les trois sondes de l'app entreprise (contraste et débordement des boutons, alignement des colonnes, barres d'en-tête) braquées sur TOUS ses écrans et TOUS leurs onglets, en clair et en sombre, à 1440 et à 1280 — 1 024 boutons, 777 colonnes. Elles vivent en un seul exemplaire dans `harnais.js` : c'est leur absence côté Cabinet qui l'avait laissé dériver |
| `npm run e2e:declaration` | **la déclaration du mois** : quatre cases « — » avec leur raison (jamais un zéro), un chiffre ouvert sur ses pièces, un mois DÉJÀ déclaré par le client qui montre quand même sa collectée et dont le bouton s'éteint en disant pourquoi, l'écriture passée en brouillard au dernier jour d'un mois libre, les deux pointages dans l'ordre puis défaits, et le refus de refaire une déposée |
| `npm run e2e:banque` | **la banque, de bout en bout** : trois banques aux trois formats (montant signé, Débit/Crédit séparés, en-têtes inconnus et associés à la main), un solde de fin faux refusé avec son écart, le même fichier refusé deux fois, l'automatique qui ne pose RIEN sur une ambiguïté, l'écriture manquante écrite depuis une ligne puis retrouvée « certain », le libellé retenu, le relevé retiré sans que le journal bouge |
| `npm run e2e:cabinet-licence` | **la licence du Cabinet** : trois dossiers hors SkanFact gratuits, l'exemple qui ne compte pas, cinq clients qui dépassent le quota, la validation refusée pendant que lire, importer, exporter et SAISIR restent ouverts, deux dossiers archivés qui rendent la main, la clé d'un autre cabinet refusée en nommant les deux empreintes, celle d'un client parrainé refusée aussi, et le panneau qui nomme chaque dossier compté |
| `npm run e2e:saisie` | **la grille de saisie, AU CLAVIER** : une pièce entière tapée sans souris (Entrée descend, Tab solde), le brouillard sans numéro, la validation qui referme, les deux refus sur une validée, un lot dont la pièce fausse est au MILIEU et la numérotation qui reste 1..n, l'extourne au 1er du mois suivant, la recherche par montant après réouverture de l'application, et un guide écrit puis appliqué |
| `npm run e2e:licence` | **l'éditeur et les offres, puis le client** : une première application DÉSARMÉE (`SKANFACT_CLE_EMBARQUEE` vers un chemin inexistant, développement seulement) — sans clé rien n'apparaît ; « Créer mes clés » écrit la privée dans un dossier isolé (`SKANFACT_DOSSIER_CLES`) et met le poste en état « éditeur » (ni essai ni verrou) ; « Émettre » signe une clé vérifiable, crée un BROUILLON de facture et l'historique ; la clé Indépendant collée refuse un nouveau fournisseur, pose un cadenas sur Achats et laisse les Statistiques ; la clé d'un autre matricule est refusée en nommant les deux ; « Renouveler » ; rien de ce qui traverse le pont ne contient la clé privée — PUIS une seconde application telle qu'un client l'installe (vraie clé embarquée, pas de clé privée) : essai de 30 jours, aucune trace de l'éditeur, plus de porte « Créer mes clés », et la clé signée par la clé d'essai du test REFUSÉE |

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
- **On ne masque jamais ce que quelqu'un a saisi** — mais un filet ne doit pas devenir un piège
  (corrigé en 7.12.0, voir plus bas). Le filtrage du menu n'est acceptable que parce que la palette
  liste tout, que l'adresse fonctionne, et qu'une page « Tous les modules » existe : un test vérifie
  les trois. Sans réglage enregistré (`company.modules` absent), **tout s'affiche** : une mise à jour
  ne fait disparaître aucune page.
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

## 7.0.1 — Deux erreurs de montant que l'ergonomie a fait tomber

L'audit d'ergonomie cherchait des écrans ; il a trouvé des chiffres faux. Les deux règles :

- **Un montant réglementaire porte une unité.** Le timbre fiscal est fixé *en dinars* : ajouté tel
  quel sur une facture en euros, il valait 1 € au lieu de 1 DT — 3,4 fois trop cher, sur une pièce
  officielle. Tout montant venu des réglages de la société (`stampFee` et ce qui suivra) se convertit
  dans la devise du document.
- **Un champ dont l'oubli fausse des chiffres AILLEURS est obligatoire, pas conseillé.** Le taux de
  change pouvait rester vide ; `toBase` repliait alors sur 1 et toute la comptabilité comptait
  1 EUR = 1 DT — journal des ventes, TVA à déclarer, chiffre d'affaires, tableau de bord, paquet du
  comptable. Rien à l'écran où on le saisit ne le montrait, parce que la facture, elle, était juste.
  `core.missingRate` existe pour que l'application le dise : la saisie refuse, et les pièces déjà
  enregistrées remontent en rouge dans « À faire ».

**Et la leçon sur les tests, la plus coûteuse :** l'assertion qui couvrait la facture en devise
depuis la 1.6.0 **affirmait le défaut**. Elle attendait 1 191,00 € là où le total correct est
1 190,29 €, parce qu'elle avait été écrite en recopiant ce que le code produisait. Un test écrit
ainsi ne prouve rien — il grave le bug et empêche de le corriger. Une assertion sur un montant se
calcule à la main, à partir de la règle, avant de regarder ce que le code renvoie.

## 7.1.x — Ce qui se réécrit tout seul, et ce qui ne se rejoue jamais

- **Une pièce émise garde une COPIE de ce qui a servi à la calculer.** `computeTotals` relisait
  `company.stampFee` à chaque affichage : changer le réglage du timbre réécrivait le total de toutes
  les factures déjà émises, envoyées et déclarées. Le PDF chez le client et l'écran ne disaient plus
  la même chose, et le journal des ventes suivait l'écran. La règle existait depuis la 5.0.0 pour les
  bulletins (`slip.computed`) ; elle n'avait jamais été portée aux factures. **Tout réglage de société
  qui entre dans un total doit se figer sur la pièce à l'émission**, en même temps que le numéro — et
  la migration fige l'existant, sinon il reste à la merci du prochain changement.
- **Un réglage global qui a une bonne valeur par défaut par métier doit la prendre.** Le taux de TVA
  était écrit `19` en dur à huit endroits, alors que `ACTIVITIES` sait depuis la 2.0.0 que « Santé et
  paramédical » est exonéré : le catalogue arrivait à 0 % et les lignes tapées à la main à 19 %, sur
  la même facture. Attention au `||` : `0` est une valeur légitime, le test doit être explicite.
- **Un assistant qui ne se rejoue pas est un assistant qu'on n'a qu'une fois.** `needsSetup` exigeait
  « ni société, ni document, ni client » : après le premier lancement il n'existait plus, et
  « Passer » le condamnait définitivement. Il se rejoue depuis les Paramètres, prérempli, et ne
  réécrit que ce qu'on lui redonne.
- **« Passer » ne jette pas ce qui vient d'être tapé.** Quatre écrans remplis, un clic sur « Passer »
  au cinquième, et la fiche société repartait vide — sans un mot.
- **Un état lu une fois au démarrage se périme.** « Tes premiers pas » lisait la copie externe au
  boot : choisir enfin un dossier laissait l'étape décochée jusqu'au lendemain. Tout état affiché
  ailleurs que là où il se règle doit être rafraîchi à l'endroit où il change.

## 7.2.0 et 7.3.0 — le contre-audit : ce qui est écrit, et ce qui est branché

Audit à douze angles sur l'app entreprise, chaque constat relu par un contradicteur chargé de le
**réfuter** et de ré-ancrer chaque ligne dans le code du jour. Les contradicteurs ont rejeté la
moitié des constats (déjà corrigés en 7.0.0–7.1.2, ou appuyés sur des captures qui n'existent pas)
et en ont trouvé d'autres. Le détail est dans `PLAN-UX.md`.

Règles apprises, à ne pas recasser :

- **Une fonction écrite pour l'interface et jamais appelée est invisible.** La 7.0.0 avait construit
  tout le tri des modules — `MODULES`, `moduleOn`, `navPages`, « Tous les modules », le bandeau de
  rattrapage — ET `modulesSuggeres`, la table qui relie le métier aux modules. Cette table n'avait
  **aucun appelant** : le menu faisait ses dix-sept entrées au premier jour, pour quelqu'un qui
  venait de déclarer son métier à l'écran précédent. Rien ne plante, aucun test ne tombe, et le
  commentaire au-dessus décrivait un écran qui n'existait pas — c'est ce commentaire qui a fait
  croire que le travail était fini. Quand un mécanisme est livré, le test doit porter sur l'EFFET
  (« le menu raccourcit »), jamais sur la présence de la fonction.
- **Un champ lu mais jamais écrit donne un chiffre faux tous les jours.** `cashMovements` lisait
  `p.accountId` depuis la 3.3.0 ; aucun formulaire de paiement ne l'écrivait. Un règlement en
  espèces montait sur le compte bancaire. Deux bulles d'aide et une phrase de la page Trésorerie
  décrivaient le champ manquant comme s'il existait — **une phrase d'aide qui décrit une fonction
  absente est un bug**, pas une imprécision.
- **Ce qui se saisit doit pouvoir se corriger.** Un paiement n'avait que « ✕ ». Sans bouton de
  modification, tout ce qui a été saisi avant un correctif reste faux pour toujours : livrer le
  champ sans le moyen de revenir dessus n'aurait réparé que l'avenir.
- **Avant d'écrire une phrase rassurante, vérifier que l'univers concerné est non vide** (déjà notée
  en 7.0.0, re-trouvée ailleurs) : « Rien à signaler : le dossier du mois est complet » s'affichait
  en vert sur un mois sans une seule pièce, avec neuf fichiers annoncés et l'envoi armé. La liste
  des manques ne signale que ce qui existe ; sur le néant elle est vide, et le vide passait pour la
  perfection.
- **Un assistant écrit par étapes doit écrire à chaque étape.** Fermer la fenêtre au cinquième écran
  effaçait les cinq, alors que « Passer » les conservait. Et la reprise a besoin d'un drapeau propre
  (`setupStarted`) : se fier au fait que la société est renseignée ferait réapparaître l'assistant
  chez des installations qui ne l'ont jamais commencé.
- **Un champ de l'assistant doit être au moins aussi guidé que son jumeau dans les Paramètres**,
  jamais moins. La retenue à la source était une liste fermée partout — sauf au premier endroit où
  on la rencontre.
- **Deux tests que j'ai écrits ne pouvaient pas échouer**, et je ne l'ai su qu'en essayant de les
  faire tomber : ils cherchaient une *mention* (`includes('x.lastError')`, `includes('data-edpay')`)
  là où il fallait exiger la *branche* — le mot survivait dans le message d'erreur, ou dans le
  gestionnaire. Un troisième, hérité de la 7.1.1, lisait un `localStorage` où l'application n'écrit
  rien : il affichait « ok » depuis deux versions. **Tout test de source s'ancre sur la structure, et
  se prouve en réintroduisant le défaut — sinon on ne sait pas ce qu'on a écrit.**
- **La capture montre ce que la relecture du code ne montre pas.** L'écran des modules, relu et jugé
  correct, mettait trois lignes verrouillées en tête et poussait les vraies questions — et la phrase
  qui dit qu'on ne perd rien — sous la coupe du panneau. Une photo, dix secondes.
- **Un moteur sans écran n'existe pas.** `backups:peek` et `backups:restore` étaient écrits, testés
  et branchés… uniquement sur la sortie du jeu d'exemple. Pour tout le reste, la seule issue
  proposée restait « Importer et choisis un fichier de ce dossier » : un dossier caché, un nom de
  fichier à reconnaître, et un remplacement total sans savoir ce qu'on perd. **Le jour où on a
  besoin d'une restauration est le pire jour pour apprendre un chemin.** Même famille que la
  fonction morte ci-dessus : ce qui compte n'est pas que le code existe, c'est qu'un écran l'appelle.
- **Un correctif de l'une des deux applications doit être cherché dans l'autre.** Les sauvegardes
  nommées de l'app entreprise étaient purgées par ordre alphabétique — « avant-demo »,
  « avant-effacement », « avant-import » partant toujours en premier — exactement le défaut corrigé
  dans l'app cabinet en 6.8.1, jamais porté. Elles partagent des fichiers (`style.css`) et des idées,
  pas leur code de stockage : une règle apprise d'un côté se vérifie de l'autre, à la main.
- **Une boucle e2e qui compte les écrans d'un assistant se périme à la version suivante.** On
  reconnaît chaque écran à ce qu'il contient (`#sf-mods`, `[data-act]`, `input[name=name]`), jamais
  à son numéro : un septième écran a fait passer trois tests « à côté » sans un mot.

## 7.6.0 — Le jeu d'exemple ne doit jamais toucher au vrai

Trois constats graves sur le terrain même que la 7.0.0 croyait avoir traité. Règles :

- **Une identité ne se juge pas sur un seul champ.** L'exemple ne se disait « emprunté » que si la
  raison sociale était vide — or l'assistant invite explicitement à laisser le matricule fiscal et
  le RIB vides. L'exemple les prêtait alors, et plus rien ne les reprenait : ni la sortie, ni
  « Tout effacer ». Et les trois contrôles de conformité ne regardent que la PRÉSENCE d'une valeur,
  donc l'application annonçait en vert « tes documents sont en règle » sur un matricule inventé.
  On note ce qui a été emprunté, champ par champ (`company.demoFields`), et on le rend.
- **Une phrase affichée qui n'est tenue par aucun code est un bug.** « N'envoie rien à personne
  depuis ici » était sur chaque page, et `estDemo` n'avait qu'UN appelant dans toute l'application :
  le bandeau lui-même. Six gestes sortaient sans contrôle.
- **Prévenir, pas interdire.** `demoBlock` propose « Repartir de mes données » ET « Continuer quand
  même ». Un logiciel ne peut pas empêcher une messagerie d'envoyer ; il peut nommer le danger une
  fois. Deux boutons dont aucun ne laisse passer, ce serait un refus déguisé en choix — l'exact
  travers que tout cet audit combat.
- **Un geste d'apprentissage ne se bloque pas, il se marque.** L'export PDF reste libre depuis
  l'exemple ; le document porte « EXEMPLE ». Et le tampon se décide en UN endroit : trois autres
  recopiaient la règle à la main, donc un tampon posé dans la seule fonction prévue pour ça en
  aurait manqué trois chemins sur quatre.
- **Les contrôles de saisie passent avant les grandes questions.** Poser une question de fond puis
  refuser sur un champ trop court fait répondre pour rien.
- **Un panneau asynchrone redemande son élément APRÈS l'attente.** Entre la question au processus
  principal et sa réponse, l'utilisateur a pu changer de page : la poignée obtenue avant désigne un
  élément détaché, on écrit dedans sans rien afficher, puis on cherche ses boutons dans le document
  vivant et `null.onclick` lève une exception que personne ne voit.
- **Un test peut passer pour une mauvaise raison.** L'e2e du faux matricule posait les champs par
  `evaluate` sans jamais enregistrer : la sauvegarde ne contenait donc pas la société, la sortie la
  rendait vide, et l'assertion « le nom reste » passait sur une chaîne vide. Écrit par le vrai
  formulaire, il prouve enfin ce qu'il annonce.

## 7.12.0 — Le droit à l'erreur

Skander a ouvert l'application et a trouvé trois défauts en une minute : « y'a un bouton tout
blanc », « quand je décoche un module ça disparaît pas du menu et je peux pas le recocher », « quand
on fait une action en se trompant on ne peut pas revenir en arrière, comme marquer déposé ».

Règles apprises, à ne pas recasser :

- **Une règle CSS qui repeint un fond sans toucher à la couleur du texte doit exclure les boutons
  qui portent déjà la leur.** `.banner .btn { background: #fff }` existe pour que le bouton NEUTRE
  ne paraisse pas sale sur un bandeau teinté ; elle repeignait aussi `.btn-primary`, qui garde son
  texte blanc. Résultat : « Corriger par un avoir… », la seule sortie du bandeau d'une facture
  émise, était un rectangle blanc sur blanc. Rien ne plante, rien n'apparaît en console, et relire
  le CSS ne suffit pas — c'est une question de spécificité entre deux règles séparées de 250 lignes.
  D'où `npm run e2e:contraste` : il mesure le contraste texte/fond de **chaque bouton visible** des
  21 pages, en clair et en sombre (536 boutons), et refuse tout ce qui est illisible. Seuil très bas
  (2,0) exprès : il ne juge pas l'esthétique, il attrape ce qu'on ne peut pas lire du tout.
- **Un filet qui se recalcule à chaque affichage devient un piège.** Un module qui CONTENAIT quelque
  chose se rallumait tout seul : décocher sa case la transformait en cadenas sous le doigt, sans
  rien changer au menu. **Le choix enregistré fait foi** ; ce que la règle protégeait vraiment est
  repris par `modulesRevenus(data, comptesAvant)` — un module masqué revient le jour où on y
  ENREGISTRE quelque chose, et l'application le dit. La différence entre un filet et un piège, c'est
  qu'un filet est un **événement** (les compteurs ont bougé), pas un **état** (il est plein).
- **Un réglage qui accepte un clic, ne fait rien de visible, et se retire ensuite la possibilité de
  revenir en arrière est pire que pas de réglage du tout.** C'est le symptôme à reconnaître : « je
  clique, rien ne change, et maintenant le bouton n'est plus là ».
- **La règle du droit à l'erreur n'est pas « tout confirmer »** : dix questions par jour ne se lisent
  plus, on clique « Oui » sans voir. C'est : ce qui **détruit** demande (le plan de comptes remis à
  zéro, une volée de brouillons) ; ce qui **se répare** laisse un « Annuler » sous la main
  (`toastUndo`), parce qu'au moment où on comprend son erreur, la ligne a déjà quitté l'écran d'où
  on l'a cliquée — « Marquer déposée », « Attestation reçue », suspendre/reprendre un contrat.
- **Le bandeau qui porte « Annuler » doit recevoir les clics.** `#toast` vit en
  `pointer-events: none` : sans la levée explicite, le bouton est parfaitement visible et
  parfaitement inerte (le défaut de la 5.2.2, en plus sournois puisqu'il ne concerne qu'un bouton).
  Et il dure trois fois plus longtemps qu'un message ordinaire : comprendre qu'on s'est trompé prend
  quelques secondes. Un test vérifie les deux.
- **Un test e2e écrit contre une règle décrit cette règle, pas la vérité.** `barre-laterale.js`
  affirmait « un module rempli ne doit pas offrir de case à décocher » : il gardait le piège en
  place. Quand une règle change, c'est le test qui se relit en premier.

Le test qui compte est `npm run e2e:erreur` : il refait les trois gestes dans l'application réelle
(décocher/recocher un module vide, masquer un module plein avec sa question, remplir un module masqué
pour le voir revenir, et noter une déclaration déposée puis l'annuler).

## 7.13.0 — Voir ce qu'on fabrique

Skander : « l'aperçu du document est bon mais quand on a un petit écran comme un Mac ou un Windows
on ne voit rien », et « le bouton aperçu est en bas, on ne le voit même pas des fois ».

Règles apprises, à ne pas recasser :

- **Un aperçu de 430 px pour une page de 794 n'est pas un aperçu, c'est une vignette.** À 54 % (44 %
  sur un portable) on distingue une mise en page ; on ne lit ni un prix, ni une mention légale —
  c'est-à-dire rien de ce que le client verra. Le grand aperçu (`#pv-full`, ⌘⇧A) est la vraie
  réponse ; la colonne reste ce qu'elle est, un repère pendant la saisie.
- **« Ajuster » ajuste la PAGE, pas sa largeur.** Caler sur la largeur donnait 177 % à 1440 px :
  le haut de la facture remplissait l'écran et il fallait défiler pour voir le total. Un aperçu
  « ajusté » qu'on doit faire défiler n'est pas ajusté. Mesuré, pas déduit.
- **Un interrupteur reste là où on l'a actionné.** « Masquer l'aperçu » vivait au-dessus de la
  colonne de droite : une fois masqué, il repartait à la fin du formulaire, trois écrans plus bas.
  Il est monté dans la barre d'actions, et la colonne disparaît **entièrement** au lieu de rester
  réduite à son seul bouton.
- **Un bouton coupé par le bord de la fenêtre ne se voit pas dans `scrollWidth`.** À 1280 px,
  « Émettre la facture » dépassait de 25 px et « Plus ▾ » de 125 — mais le document, lui, ne
  débordait pas : un ancêtre le rognait. **On mesure le bouton (`getBoundingClientRect().right`
  contre `clientWidth`), jamais la page.** Une première version du contrôle regardait le document :
  elle restait verte avec le défaut réintroduit.
- **Une exclusion trop large désarme un contrôle en silence.** Pour ne pas signaler les tableaux
  larges, le contrôle ignorait tout bouton sous un ancêtre en `overflow-x: auto` — or le conteneur
  de page en est un, donc il n'examinait plus rien. L'exclusion porte maintenant sur la classe
  `.scroll-x`, le marqueur explicite du projet. Vérifié dans les deux sens.
- **Un test qui pilote un bouton par son identifiant se casse quand le bouton change de rôle.**
  `#pv-hide` masquait l'aperçu, il l'agrandit désormais : trois tests le cliquaient. Quand un
  libellé change, les tests qui le nomment se relisent avant de conclure à une régression.
- Piège du compte en dur : le test « tout document passe par `stampFor` » exigeait **cinq** appels.
  Le grand aperçu en a ajouté un sixième, légitime, et le test tombait — et se « réparait » en
  changeant le chiffre, donc sans rien vérifier. Il teste maintenant la RÈGLE (chaque appel à
  `documentHtml` porte `stampText: stampFor(...)`, sauf l'aperçu d'une facture qui n'existe pas
  encore).

## 7.14.0 — L'endroit qui affiche un état est celui où on le change

Skander : « faut que ça soit le plus facile possible, par exemple choisir son entreprise dans le haut
du menu en sélectionnant dans une liste afin de basculer sans aller dans paramètres ».

Règles apprises :

- **L'endroit qui AFFICHE un état est l'endroit où on s'attend à le changer.** Le nom du dossier
  ouvert est écrit en permanence en haut à gauche ; changer de dossier demandait Paramètres →
  Sécurité et données → Dossiers. C'est la même famille que « un lien qui promet un réglage
  l'amène » (7.11.0), vue de l'autre côté.
- **Un en-tête qui devient cliquable doit le DIRE par trois signes** : un `<button>` (donc le
  clavier), un curseur de clic, un chevron, et un état au survol. Sans eux personne n'essaie — c'est
  la leçon « un bouton sans bordure ni couleur n'est pas un bouton » (Cabinet 1.0.0), appliquée à un
  élément qu'on ne soupçonne pas d'être un bouton.
- **Deux noms pour la même chose est un défaut, même quand les deux sont justes.** L'en-tête
  affichait la raison sociale (`data.company.name`) et la liste des dossiers l'étiquette du dossier
  (« Mon entreprise », posée par `main.js` à l'installation) : rien ne permettait de deviner qu'il
  s'agit du même dossier. `accorderNomDossier()` fait suivre l'étiquette — et **seulement** quand
  elle est restée celle par défaut : un nom choisi à la main ne s'écrase jamais.
- **Un menu ouvert par la barre latérale vit sous les fenêtres modales (400), jamais au-dessus** :
  une question posée par-dessus doit rester devant. Ici, couche 70. Un test le mesure.
- Piège Playwright : `waitForSelector('#x[hidden]')` attend que l'élément devienne **visible** et
  n'aboutit donc jamais. Pour attendre qu'une chose disparaisse, `waitForFunction(() => el.hidden)`.
  Le test échouait alors que le code était juste.

## 7.15.0 — Tout ce qui se lit se clique

Skander : « dans comptabilité section manquant on ne peut pas sélectionner afin de voir directement ».

Règles apprises, à ne pas recasser :

- **Un écran qui NOMME un ensemble doit pouvoir l'ouvrir.** « 3 achats sans justificatif », « Reste
  à encaisser : 6 factures » — ce sont des questions, pas des informations, tant qu'on ne peut pas
  cliquer. Même parade que les treize boutons morts de la 7.0.0 : une table (`CHECK_ACTIONS`,
  `STAT_ACTIONS`) et un **test de couverture** entre ce que la source peut produire
  (`core.packChecklist`, lu dans core.js et jamais recopié) et ce que l'interface sait ouvrir.
- **Un filtre qui regroupe plusieurs statuts est une FONCTION, jamais une chaîne comparée à un
  statut.** La liste des factures proposait « Émis » et filtrait `effectiveStatus(d) === 'émis'` :
  aucune facture ne porte ce statut, mais les **avoirs** si — le filtre rendait donc 2 avoirs au
  lieu des 27 pièces émises. **Une liste vide se remarque ; une liste fausse, non.** Le regroupement
  vit dans `core.DOC_FILTRES` / `core.docFiltre`, pur et testé.
- **Un compteur et la liste qu'il ouvre se calculent avec la même règle.** La carte « Reste à
  encaisser » comptait `envoyée|partielle|retard` et aucun filtre de la liste ne rendait ce
  compte-là. Le test relit les statuts de la carte **dans app.js** et vérifie que le filtre les garde
  tous : une liste en dur se périmerait au premier statut ajouté. (Même règle qu'en 6.8.1 pour le
  bandeau des relances du cabinet — apprise d'un côté, à vérifier de l'autre.)
- **`navigate(hash)` vers la page courante ne redessine rien.** Le routeur réagit au `hashchange` :
  viser la page où l'on est déjà n'en produit aucun, alors que l'onglet et le filtre viennent d'être
  changés juste au-dessus. Plusieurs raccourcis étaient donc inertes *depuis la page concernée* et
  fonctionnaient d'ailleurs — le pire cas à diagnostiquer. `vers()` redessine quand le hash est
  identique ; c'est le même piège que le cas « on y est déjà » de `goBack` (2.4.0).
- **Une carte cliquable le dit par trois signes** (curseur, chevron, relief au survol) et répond au
  clavier (`role="button"`, `tabindex`, Entrée/Espace). Et la bulle « i » posée dessus **explique**,
  elle ne navigue pas : le gestionnaire l'exclut explicitement.
- Piège de test : les listes sont paginées depuis la 2.2.0 — compter les `<tr>` affichés ne dit rien.
  C'est le bandeau « n sur N » qui porte la sélection entière, et c'est lui qu'un test doit lire.

## 7.16.0 — Les chiffres qui mentent

Audit page par page de l'app entreprise (six groupes d'écrans, un relecteur et un **contradicteur**
par groupe, chacun tenu de ré-ancrer chaque ligne dans le code du jour) : **66 constats retenus,
18 réfutés**. Le rapport complet est dans `dist-e2e/audit.json` — 8 graves, 47 moyens, 11 petits.
Les cinq graves corrigés ici, et ce qu'ils apprennent :

- **Un agrégat de montants porte une devise.** Les quatre cartes de l'accueil sommaient les montants
  BRUTS : sur le jeu d'exemple, « CA de l'année » annonçait 41 307 DT contre 43 892 DT réels. Le
  graphique juste en dessous, lui, passe par `toBase` depuis toujours — **deux chiffres du même écran
  ne peuvent pas raconter deux années différentes**. C'est la faute de la 7.0.1 (le timbre en euros),
  au même endroit conceptuel : tout ce qui ADDITIONNE plusieurs pièces se convertit, sans exception.
- **Une carte de total et la liste qu'elle résume se calculent sur le même ensemble.** La page Marges
  tronquait à vingt lignes puis totalisait ces vingt-là. Et le tri étant par marge décroissante, ce
  qui tombait en premier, c'étaient les lignes à marge négative. La règle des listes depuis la 2.2.0
  — « le pied et l'export portent sur la sélection entière, jamais sur la page affichée » — n'avait
  jamais été appliquée ici.
- **`limit || 20` rend le « tout » impossible à demander** : `0` y devient 20. Quand une valeur nulle
  est légitime, le test doit être explicite (`limit === 0`), exactement comme pour le taux de TVA à
  0 % en 7.1.0.
- **Ce qui se recopie d'une pièce à l'autre se recopie EN ENTIER.** `invoiceFromQuote` énumère les
  champs à la main et avait oublié `projectId` : les trois chemins de facturation fabriquaient une
  facture sans affaire, donc une fiche d'affaire à 0 facturé avec ses achats comptés — elle paraissait
  perdre de l'argent. `core.convertDoc` (« Transformer ▾ »), qui copie tout le document, la gardait :
  **deux conversions, deux comportements**, dont une seule juste.
- **Une action qui change l'état lu par sa propre condition d'affichage doit relire cet état.**
  `facturerDevis` marque le devis « accepté », donc `devisFacturable` restait vrai : le bouton coloré
  « Facturer ce devis » se represente à l'identique sur un devis DÉJÀ facturé, et un second clic
  fabrique une seconde facture complète. Le pire cas est l'acompte, qui accepte lui aussi le devis :
  le bouton principal proposait 100 % pendant que « Facture de solde » dormait dans le ▾.
- **Un doublon de bonne foi est plus dangereux qu'un doublon volontaire.** `duplicatePurchase`
  prévenait déjà — c'est le cas où l'utilisateur SAIT qu'il duplique. La ressaisie trois semaines plus
  tard, elle, ne disait rien et comptait deux fois la TVA déductible et la charge. On prévient sans
  refuser : un fournisseur peut recycler ses numéros d'une année sur l'autre.
- Piège de tests : une assertion qui recopie une ligne de gestionnaire mot pour mot
  (`$('#convert').onclick = () => facturerDevis(doc)`) tombe dès que le geste gagne une question, et
  se « répare » en recopiant la nouvelle ligne — donc sans rien prouver. On ancre sur la RÈGLE
  (le gestionnaire appelle `facturerDevis`), pas sur sa forme.
- Piège d'environnement : deux `xvfb-run` simultanés sur la même machine se disputent le serveur X et
  s'enlisent sans message. Un seul e2e à la fois, et `npm … | tail` masque toute progression
  (stdout bufferisé) — rediriger vers un fichier quand un test paraît bloqué.

## 7.17.0 — Les écrans qui ne répondent pas

Suite de l'audit page par page. Huit constats qui partagent la même signature : **l'écran accepte le
geste et n'en fait rien**. Aucune console, aucune erreur, aucun test de calcul ne peut les voir.

Règles apprises, à ne pas recasser :

- **Une action dont la trace quitte l'écran à l'instant du clic a besoin d'un retour en arrière ET
  d'un endroit où se relire.** Pointer un mouvement le faisait disparaître sur-le-champ : au moment
  où on comprend qu'on s'est trompé, il n'y a plus rien sous le doigt, et le drapeau n'était écrit
  nulle part ailleurs. `toastUndo` (7.12.0) répond à la seconde qui suit ; le panneau **« Déjà
  pointés »** répond au mois qui suit. Les deux sont nécessaires — le premier seul serait un filet
  qui ne dure que huit secondes.
- **Le porteur d'un drapeau se RECHERCHE au moment de l'annuler.** Entre le clic et l'annulation,
  `draw()` a reconstruit la liste : la référence gardée en fermeture désigne un objet qui n'est plus
  celui qu'on affiche. C'est la même famille que le piège Playwright des poignées détachées, côté
  application cette fois.
- **Un champ qui se redessine à chaque frappe est un champ dans lequel on ne peut pas écrire.** Le
  solde de tout compte réécrivait tout son bloc à chaque caractère : l'élément était détruit et
  recréé, le curseur repartait dans le vide, et « Prime de départ » était littéralement impossible à
  taper. La parade est la même que sur les bulletins (5.0.0) : on met à jour la donnée, on recalcule
  le seul élément qui en dépend (`#hf-total`), et on ne redessine qu'à l'ajout ou au retrait d'une
  ligne.
- **Un réglage visible sur un écran qui l'ignore ment.** Un sélecteur d'année sur « Salariés »,
  « Avances », « Registre » et « Contrats » : on le change, rien ne bouge. Ce sont des états du jour,
  pas d'un exercice. La liste d'exclusion vit en un seul endroit (`MG_SANS_ANNEE`, `P_SANS_ANNEE`) et
  un test confronte les deux listes au lieu de recopier des noms d'onglets.
- **`bindSort(root, redraw)` passe la colonne cliquée à son rappel : un rappel `() => draw()` la
  jette.** Six en-têtes affichaient leur « ⇅ », acceptaient le clic et ne triaient pas. Un tri qui ne
  trie pas ne se remarque pas — on croit que la liste était déjà dans cet ordre. Le test interdit
  désormais la forme `bindSort(…, () =>` dans toute la source ; c'est un contrôle de FORME assumé,
  parce que la faute est exactement une forme.
- **Une période écrite dans le code se périme au 1er janvier.** Trésorerie et Stock affichaient
  l'année en cours sans aucun moyen d'en sortir : le 3 janvier, les deux pages devenaient vides et
  l'exercice écoulé — celui qu'on vient justement consulter — était inatteignable.
- **Un export suit ce qu'on regarde, et le bouton le NOMME.** « Exporter en CSV » sur les cinq
  onglets du Stock renvoyait l'état du stock sur les cinq. Le libellé variable (« Exporter les
  mouvements ») est la moitié qui manquait : sans lui, la correction serait invisible jusqu'à ce
  qu'on ouvre le fichier.
- **Un compteur rouge qui nomme un ensemble doit l'ouvrir** (règle de la 7.15.0, re-trouvée ailleurs).
  Et la règle est passée au général : un test découpe `app.js` par route et exige que toute page qui
  pose une carte `data-stat` l'arme elle-même.
- Piège de test rencontré : une assertion sur un tri ne présume pas du sens. La colonne « Montant »
  part en décroissant (c'est ce qu'on veut voir en premier) ; le test lit la flèche affichée et
  vérifie la monotonie **dans ce sens-là**, puis qu'un second clic la renverse.
- Piège de test rencontré : on ne remplace pas `window.skanfact.saveText` depuis un `evaluate` — le
  pont `contextBridge` est figé, et le renderer a de toute façon capturé `bridge` au chargement. Ce
  qui se teste, c'est ce que l'application AFFICHE (ici le libellé du bouton), pas ce qu'on espère
  intercepter.

Le test qui compte est `npm run e2e:repondre` : neuf gestes dans l'application réelle, dont la frappe
lettre par lettre avec vérification du focus après chaque caractère.

## 7.18.0 — L'accueil tient ses promesses

Suite de l'audit page par page. Onze constats, même famille : **l'écran annonce une chose et en
montre une autre**.

Règles apprises, à ne pas recasser :

- **Un réglage composite se pose par une fonction, jamais par recopie.** Poser un filtre depuis
  « À faire » demande cinq remises à zéro (`q`, `st`, `kind`, `year`, `yearTouched`, `page`),
  recopiées à la main dans six actions — et une en oubliait une. `yearTouched` manquant, la liste
  d'arrivée se re-filtre d'elle-même sur l'année en cours et **cache précisément les pièces que la
  ligne venait d'annoncer**. `filtre(liste, st)` rend l'oubli impossible, et un test interdit
  d'écrire `listState.x.y =` dans une table d'actions.
- **Un raccourci vise un PANNEAU, pas une page.** `settingsFocus` faisait ça depuis la 7.11.0 pour
  les Paramètres ; `pageFocus` le généralise. Arriver en haut d'une page de six panneaux, c'est
  redescendre à la main en cherchant le bon titre — et on ne sait même pas si on est au bon endroit,
  d'où le marquage d'une seconde et demie.
- **Deux panneaux qui se contredisent à dix centimètres.** « Rien à faire aujourd'hui » s'affichait
  sous « Tes premiers pas 1 / 7 ». La règle de la 7.0.0 (« vérifier que l'univers concerné est non
  vide ») avait un second cas : l'univers n'est pas vide, mais un autre panneau dit déjà quoi faire.
- **Une étape ne se coche pas parce que le logiciel l'a faite.** L'assistant préremplit le catalogue
  avec les prestations du métier, prix à 0 : « Remplir ton catalogue » passait au vert sur des
  exemples. Ce que l'application a posé se marque (`fromSetup`) pour pouvoir être distingué de ce
  que l'utilisateur a décidé.
- **Un extrait n'a pas de total.** Huit pièces sur deux cents, additionnées en HT, devis et bons de
  livraison mélangés aux factures, sous une colonne « Net à payer ». Un chiffre dont on ne sait pas
  sur quoi il porte est pire qu'aucun chiffre.
- **Le pluriel se porte d'une application à l'autre.** `pl()` vivait dans l'app cabinet depuis sa
  1.0.0 (« un logiciel qui écrit "1 dossier(s)" paraît bâclé ») et l'app entreprise écrivait
  « 1 facture(s) » sur son écran d'accueil. Une règle apprise d'un côté se vérifie de l'autre.
- **Un geste qui a DEUX effets doit pouvoir défaire les deux.** « Générer maintenant » fabrique une
  facture et repousse l'échéance du contrat. `generateRecurring` ne renvoyait qu'un compteur : sans
  les identifiants des brouillons créés, il n'y avait rien à annuler. Et le bouton s'affichait sur
  un contrat suspendu, c'est-à-dire sur un contrat dont l'utilisateur vient de dire qu'il ne veut
  plus de factures.
- **Ce qui porte une devise l'affiche et se trie dedans.** Un contrat récurrent porte la sienne
  (`buildRecurringInvoice` la reporte sur chaque facture) : la colonne l'affichait en dinars, et le
  tri comparait des euros à des dinars. Même faute que la 7.16.0, un écran plus loin.
- **Un filtre s'applique à TOUT l'écran ou à rien.** La recherche des Relances ne touchait qu'un
  tableau sur quatre pendant que le bandeau annonçait « n sur N ».
- **Ce qui se saisit à la main se saisit là où on le lit.** Le statut d'un devis n'est pas déduit
  (contrairement à celui d'une facture) : il fallait pourtant ouvrir la pièce pour dire « le client
  a dit oui ».
- **Le budget de boutons d'une ligne est réel.** Ajouter deux réponses en poussait un cinquième hors
  de l'écran à 1280 px — `npm run e2e:contraste` l'a mesuré, et un bouton hors champ n'existe pas.
  Deux réponses : les deux réponses REMPLACENT « Facturer » tant que le devis n'en a pas reçu une,
  et `td.row-actions` laisse passer à la ligne au lieu de déborder.
- Piège de test : le sélecteur d'année d'une liste s'appelle `#yr`, pas `#year`. Mon e2e lisait un
  élément inexistant et passait **avec le défaut réintroduit**. Un test e2e se prouve en
  réintroduisant le défaut, exactement comme un test de source.

## 7.19.0 — L'éditeur de document

L'écran le plus utilisé de l'application. Sept endroits où il laissait faire une erreur sans rien
dire — et où l'information manquante existait déjà, dix lignes plus haut dans le même fichier.

Règles apprises, à ne pas recasser :

- **Un montant annoncé à côté d'une case est le montant que cette case AJOUTE.** L'étiquette du
  timbre montrait `company().stampFee` brut : « 1,00 € » sur une facture en euros, à trois
  centimètres d'un total qui comptait 0,29 €. Deux règles déjà écrites s'y croisaient — la
  conversion (7.0.1) et le figement à l'émission (7.1.0) — et l'étiquette n'en appliquait aucune.
  `timbreAffiche()` les applique toutes les deux, et se recalcule dans `refreshTotals`.
- **Une valeur DÉDUITE d'une autre la suit tant qu'on n'y a pas touché.** L'échéance à 30 jours
  restait sur l'ancienne date quand on corrigeait la date du document. La parade tient en une
  variable (`dueAuto`) : on ne recalcule que tant que la valeur est encore celle qu'on avait posée.
  Le contraire — recalculer toujours — écraserait une échéance négociée avec le client.
- **`Number('')` vaut 0, et un champ numérique vidé n'est pas un champ à zéro.** Effacer « 2 » pour
  taper « 12 » faisait passer la ligne, le total du document et l'aperçu à zéro entre les deux
  frappes. On ne retient rien tant que le champ n'est pas lisible (`value.trim() === ''` ou
  `validity.badInput`), et on le marque : sinon l'écran affiche une valeur que les données n'ont pas.
- **Un champ date est un COUPLE** (règle 3.0.0, re-trouvée) : `poserDateField(root, name, iso)` est
  maintenant partagé, au lieu d'être recopié dans l'éditeur d'achat.
- **Ce qu'on découvre en regardant l'aperçu se corrige depuis l'aperçu.** Une adresse client fausse
  se voit sur le document et se corrigeait aux Clients, trois écrans plus loin, en traversant le
  garde-fou des modifications non enregistrées. Tout existait — le formulaire, la pile de fenêtres,
  le redessin — il manquait un bouton. Même famille que « un moteur sans écran n'existe pas » (7.3.0).
- **Un bouton principal propose le geste SUIVANT, pas le geste passé.** « Enregistrer un paiement »
  restait le bouton coloré d'une facture intégralement payée, alors que le reste dû était calculé
  dix lignes plus haut.
- **Une suppression nomme ce qu'elle casse.** `core.piecesLiees` est pur et testé : il retrouve les
  acomptes, les soldes, les avoirs et les pièces dérivées. On ne refuse pas — la pièce appartient à
  son auteur — mais une facture qui annonce « établie à partir du devis DEV-2026-012 » avec un lien
  mort est un mystère qu'on n'élucide plus six mois après.
- **On saisit dans l'unité où l'on pense.** Un acompte se négocie en dinars, pas en pourcentage :
  il fallait diviser de tête, tomber sur 33,33 %, et découvrir le montant réel une fois le brouillon
  créé. `core.depositLines` ne change pas — c'est l'interface qui convertit, et qui **annonce le
  total obtenu avant** de fabriquer quoi que ce soit, timbre compris.
- Piège de test e2e : quitter un brouillon modifié réveille le garde-fou « modifications non
  enregistrées », qui REMET la page précédente dans la barre d'adresse pour poser sa question
  (2.4.0). Une navigation suivante n'a alors tout simplement pas lieu, et le test cherche un bouton
  sur un écran qu'il n'a jamais quitté — l'erreur arrive trente secondes plus tard, sur un sélecteur
  qui n'a rien à voir.
- Piège de test e2e : un acompte demandé à 300 DT donne 300 DT **de lignes** plus le timbre. Une
  assertion qui compare 300 au `totalTTC` décrit une règle fausse ; c'est `netToPay` qui vaut 301,
  et c'est très exactement ce que la fenêtre annonce désormais avant de créer le brouillon.

## 7.20.0 — Ce qui est obligatoire, et ce qui mène quelque part

Règles apprises, à ne pas recasser :

- **`required` dans une fenêtre modale est INERTE.** Rien ne soumet le formulaire — c'est un bouton
  qui lit les valeurs — donc le navigateur ne validera jamais rien. L'attribut était posé sur deux
  champs depuis des versions, et n'a jamais rien fait. Ce qui est obligatoire se dit à la main :
  une étoile sur le champ, et une légende.
- **Une légende se DÉDUIT, elle ne se recopie pas.** « * obligatoire » est posée par `modal()` dès
  qu'un champ de la couche porte la classe : recopiée fenêtre par fenêtre, elle manquerait à la
  première fenêtre qui gagne un champ obligatoire. Même principe que `wipeData` déduit de
  `DEFAULT_DATA` (7.0.0) et que la couverture des cartes `data-stat` (7.17.0).
- **Un refus MONTRE le champ** (règle 7.0.0, jamais appliquée aux fenêtres) : `refus()` n'était
  appelé que dans les deux éditeurs pleine page. Les cinq fenêtres les plus utilisées se
  contentaient d'un message, sur un formulaire qui peut avoir défilé.
- **Un chiffre affiché s'ouvre, même quand une autre page l'ouvre déjà.** La fiche d'un article
  n'était atteignable que depuis Stock ; le Catalogue, qui affiche pourtant sa quantité, n'y menait
  pas. Le bouton retour de la pile de navigation ramène au Catalogue quand on vient de là.
- **On ne reproche pas ce qu'on n'a pas offert.** L'éditeur d'achat signalait qu'une ligne ne
  correspond à aucun article du catalogue, sans avoir jamais proposé de le choisir dans la liste.
  Et le prix repris est le **coût d'achat**, pas le prix de vente : dans un achat, on achète.
- **Une valeur qui n'est déduite NULLE PART doit le dire là où on la saisit.** Une ligne en
  destination « immobilisation » n'entre ni en charge ni en amortissement tant que la fiche du bien
  n'existe pas. Le compteur de la barre latérale existait depuis la 3.5.0 — personne ne le regarde
  au moment de saisir un achat.
- **Un historique client s'arrête là où on le programme.** Affaires et contrats récurrents portent
  tous deux un `clientId` depuis longtemps ; la fiche ne lisait que les documents.
- **Une variable d'une autre route est une bombe silencieuse.** Écrire `locked` dans l'éditeur
  d'achat (où il n'existe pas) lève une ReferenceError **pendant la construction du gabarit** : la
  page entière reste blanche, sans une ligne dans la console de l'utilisateur. C'est l'e2e qui l'a
  attrapé, pas la relecture — le `node --check` ne voit rien, et aucun test de calcul n'exécute
  cette route.
- **Un commentaire HTML à l'intérieur d'un gabarit ne doit contenir aucun backtick** : il referme le
  `template literal` et casse le fichier. Le commentaire va dans le code, au-dessus.
- Piège de test e2e : un achat neuf commence avec **une ligne vide**. Celle qu'on ajoute depuis le
  catalogue arrive en dessous — lire `querySelector('#b-lines tr')` renvoie donc la ligne vide, et
  le test annonce un défaut qui n'existe pas.
- Piège de test : `app.indexOf('routes.client = ')` … `app.indexOf('function clientForm(')` donnait
  une tranche **vide**, parce que `clientForm` est déclaré AVANT la route dans le fichier. Un
  découpage de source se vérifie par sa longueur avant d'être jugé.

## 7.21.0 — La comptabilité qui mène aux pièces

Règles apprises, à ne pas recasser :

- **Deux écrans qui affichent la MÊME liste doivent offrir les mêmes gestes.** Les contrôles avant
  clôture et la liste « Ce qui manque » du Cabinet sortent toutes deux de `closureChecks` /
  `packChecklist` ; l'une portait ses boutons depuis la 7.15.0, l'autre était du texte. Le test
  relit les identifiants **dans core.js** (`add('brouillons', …)`) et exige une action pour chacun.
- **On pointe une OCCURRENCE, jamais une règle.** `data.fiscalFilings` retient `ruleId@date` : la
  TVA d'octobre cesse de crier, celle de novembre reste réclamée. Faire disparaître la règle aurait
  été plus simple à écrire et faux dès le mois suivant — c'est exactement ce que faisait le seul
  recours existant (désactiver la règle).
- **Un bouton qui change d'onglet doit ALLUMER l'onglet d'arrivée.** Arriver sur le bon contenu avec
  le mauvais onglet en surbrillance est pire que ne pas y aller : on croit s'être trompé. Le
  mécanisme existait sur `#cab-goclose` et n'avait jamais été repris ailleurs.
- **Une phrase qui décrit un geste doit être tenue par un chemin.** « Ils se modifient sur la pièce
  d'origine » était sous un tableau dont aucune ligne ne menait à ladite pièce (même famille que
  « une phrase d'aide qui décrit une fonction absente est un bug », 7.3.0).
- **Une donnée enregistrée et jamais affichée n'existe pas.** Le chemin du paquet était écrit dans
  `data.packs` depuis la 6.1.0 ; l'historique affichait l'empreinte — inutilisable — et pas le
  chemin. Et un paquet d'avant cette version le DIT (bouton désactivé avec son motif) au lieu
  d'offrir un bouton qui ne ferait rien.
- Piège de test, coûteux : ma tranche `drawClosures … drawFiscal` **contenait le bloc du Cabinet**,
  dont les boutons portent le même `data-check`. Le test restait vert avec le défaut réintroduit.
  Une tranche de source se prouve par ce qu'elle NE contient pas (`assert.ok(!zone.includes('cab-'))`)
  autant que par ce qu'elle contient.
- Piège de test : le gabarit et son branchement vivent à cent lignes d'écart. Chercher le
  branchement dans la tranche du gabarit échoue sur du code correct — deux assertions, deux tranches.
- Piège de test e2e : `document.querySelector('#st').value` vaut `undefined` quand l'élément
  n'existe pas encore. On attend le sélecteur avant de le lire, sinon le message accuse un filtre
  qui n'a jamais été posé.

## 7.21.1 → 7.21.3 — Windows, la plateforme que personne ne testait

Skander a voulu installer l'app sur Windows et l'envoyer à ses amis. Trois défauts se sont
enchaînés, tous invisibles depuis un Mac ou depuis Linux. **Le dépôt est passé public au passage**
(GitHub Actions y est gratuit) : la publication normale a repris et la dernière release est enfin à
jour — elle était restée à la 6.7.1 pendant quinze versions.

Règles apprises, à ne pas recasser :

- **Un fichier `.bat` en fins de ligne Unix ne marche pas.** `cmd.exe` lit un fichier batch octet
  par octet : il se désynchronise sur le premier bloc `if ... ( ... )`, tombe en erreur de syntaxe,
  et **la fenêtre se ferme sans un mot**. Symptôme à reconnaître : « j'appuie sur Entrée et ça se
  ferme tout seul ». Le fichier passe par des étiquettes (`goto :label`) plutôt que des blocs
  parenthésés, et aucun chemin ne ferme la fenêtre en silence.
- **`.gitattributes` doit couvrir TOUT le code source, pas seulement les scripts.** La 7.21.1 avait
  posé `eol=crlf` pour les `.bat` et `eol=lf` pour les `.command`/`.sh`, et s'était arrêtée là. Sur
  Windows, git convertit donc les `.js` en CRLF au checkout (`core.autocrlf`, activé par défaut par
  l'installeur Git for Windows) : le code marche toujours, mais **tout test qui relit la source
  cesse de correspondre dès qu'une expression régulière contient un `\n` littéral**. La règle
  générique `* text=auto eol=lf` va **en premier** — dans un `.gitattributes`, c'est le dernier
  motif qui gagne, et les exceptions doivent pouvoir la contredire.
- **Le mtime du système de fichiers n'est pas une date.** Sur Windows l'horloge système n'avance que
  toutes les ~15 ms : des copies successives portent le **même** mtime, et tout tri « la plus
  ancienne d'abord » devient arbitraire. Et une **copie** le réécrit — miroir externe, clé USB,
  changement d'ordinateur. Quand le nom porte déjà la date écrite par l'application
  (`AAAA-MM-JJ_HHhMMmSS`, zéro-rempli), c'est **lui** qui fait foi : son ordre alphabétique est
  l'ordre du temps, sans calcul de date, donc sans question de fuseau horaire. Le mtime ne sert
  qu'en second.
- **Un départage alphabétique ressuscite un bug qu'on croyait mort.** Le tri des sauvegardes de
  l'app entreprise départageait les mtime égaux par `localeCompare` : sur Windows, où ils sont
  presque toujours égaux, « avant-import » repassait en tête et redevenait la première effacée —
  très exactement le défaut de 6.8.1, intact, sur la seule plateforme non testée. Les filets ont
  maintenant leur **propre réserve** des deux côtés.
- **Reproduire la plateforme absente coûte moins cher qu'une publication par défaut.** Une copie du
  dépôt entièrement convertie en CRLF, et `npm test` dessus : les défauts tombent tous d'un coup,
  au lieu d'un par run de CI. Même méthode pour le mtime : on les impose **à l'envers** de l'ordre
  réel, et le test échoue alors sur toutes les machines, pas seulement sur Windows.
- **Deux `backupNow` dans la même seconde écrivent le MÊME fichier** (le nom porte l'heure à la
  seconde près) : le second écrase le premier, le compte ne bouge pas, aucune purge ne se
  déclenche — et le test passait avec le défaut réintroduit. Un test se prouve toujours en
  réintroduisant son défaut ; celui-là a failli passer entre les mailles.
- **Une panne de construction se nomme.** Le journal de l'installeur Windows ne portait qu'un mot :
  `construction : echec`. La sortie de `npm run build:win` est désormais capturée dans
  `construction.log`, versée dans le journal principal et **affichée à l'écran**. Piège : lire
  `errorlevel` **avant** les `type` qui suivent — chacun le remet à zéro, et tout échec passerait
  pour un succès.
- **Le quota GitHub Actions d'un dépôt privé se reconnaît à ceci : les jobs meurent en cinq
  secondes sans jamais démarrer.** Ce n'est pas une erreur de compilation, et les journaux sont
  vides. Sur un dépôt **public**, Actions est gratuit et sans quota.
- Dépannage gardé en mémoire, à ne refaire qu'en dernier recours : on peut construire l'installateur
  Windows **depuis Linux** sans wine, en forçant le chemin `UninstallerReader` d'electron-builder
  (réservé à macOS Catalina, mais purement JS) et en posant l'icône avec `resedit` plutôt que
  `rcedit`. Vérifier alors qu'**aucune ressource PE n'est perdue**, en particulier celle qui porte
  l'empreinte de `app.asar` — sans elle, l'application refuse de démarrer.

## 7.22.0 — Le métier décide de ce qu'on montre, le régime de ce qu'on facture

Quinze activités au lieu de six, un **régime fiscal** demandé en clair, la **note d'honoraires** des
professions libérales, et le **RIB conditionnel**. Travail prévu de longue date, livré en bloc.

Règles apprises, à ne pas recasser :

- **Ce qui décide de la TVA, c'est le RÉGIME de l'entreprise, pas son métier.** Chaque secteur
  portait une colonne `vat` : un taux deviné à partir de l'activité, faux dans les deux sens — un
  kinésithérapeute au réel facture de la TVA, un informaticien au forfaitaire n'en facture pas. La
  colonne a disparu des métiers, et un test vérifie son **ABSENCE** : c'est ce qui empêche de la
  réintroduire.
- **Une facture sans TVA et sans mention n'est pas une facture allégée, c'est une facture
  incomplète.** La mention légale prend la PLACE de la ligne de TVA, là où le lecteur la cherche.
- **Une pièce qui PORTE de la TVA la garde pour toujours**, même après un changement de régime :
  `showVat = assujettiTVA(company) || t.totalVAT > 0`. Sans la seconde moitié, changer de régime
  réécrivait des factures déjà envoyées et déclarées — le PDF chez le client ferait foi contre nous
  (règle 7.1.0, appliquée cette fois à l'affichage et pas seulement aux totaux).
- **Le régime prime sur un réglage oublié.** `defaultVat` tranche sur le régime AVANT de lire
  `defaultVatRate` : quelqu'un qui passe au forfaitaire garde parfois un « TVA des nouvelles
  lignes : 19 % » dans ses réglages, et la première ligne tapée à la main remettrait de la TVA sur
  une facture qui n'a pas le droit d'en porter.
- **Une note d'honoraires n'est pas un type de pièce en plus.** Même préfixe `FAC-`, même
  numérotation, même verrouillage, même valeur comptable : seul le TITRE change. Et il se **déduit**
  du métier à l'affichage plutôt que d'être figé sur la pièce — ce n'est pas un montant, et changer
  de métier ne doit pas laisser derrière soi des pièces à deux noms.
- **On ne réclame pas ce dont l'utilisateur n'a pas besoin.** Le RIB n'est un manque que si on attend
  un virement. Un avertissement qu'on ne peut pas satisfaire, on cesse de le lire — et on cesse de
  lire les autres avec. Les DEUX écrans qui le disaient (`companyGaps` et `issueWarnings`) suivent la
  même fonction : deux écrans qui disent la même chose ne peuvent pas se contredire (règle 6.8.1).
- **Un métier absent de `MODULES_PAR_ACTIVITE` n'allume que le minimum.** Ajouter neuf métiers sans
  leur ligne aurait fait découvrir Achats et Stock par hasard, six mois plus tard, à un garagiste.
- **Une fonction d'un AUTRE module est une bombe silencieuse.** `C.pl(...)` — alors que `pl` est
  locale à app.js — lève une TypeError pendant la construction du gabarit : l'écran reste blanc,
  rien en console, et `node --check` ne voit rien. Seul l'e2e l'a attrapé. Le garde-fou existait
  dans l'app cabinet depuis la 6.8.0 et n'avait jamais été porté : un test exige désormais que
  **chaque `C.<nom>` d'app.js existe dans les exports de core.js**, et il se prouve en réintroduisant
  la faute.
- Piège de test que j'ai failli laisser passer : `assert.strictEqual(cols(forf), … ? cols(forf) : 0)`
  compare une valeur à elle-même. Vert pour toujours. **Un test qui ne peut pas échouer est pire que
  pas de test** — et celui-là était dans le lot que je venais d'écrire.
- Piège de test : vérifier le taux sous UN seul régime laisserait l'ancienne règle intacte. Le test
  prend le **même métier** sous les deux régimes — c'est la seule façon de prouver que le métier ne
  décide plus.

## 7.23.0 — Ce qui se mesure, et l'Aide qu'on peut parcourir

Quatre signalements de Skander sur captures d'écran, et une refonte. Règles apprises :

- **Un `<th class="r">` correct ne garantit pas un en-tête aligné à droite.** `table.list th` (une
  classe, deux éléments) l'emporte sur `th.r` (une classe, un élément) : l'alignement n'était jamais
  appliqué, sur **139 colonnes de 338**, dans les deux applications. Relire le HTML ne pouvait pas le
  montrer. `npm run e2e:colonnes` **mesure** l'alignement calculé de chaque en-tête contre celui de
  ses cellules — c'est la méthode de la 6.8.0 (« mesurer dans l'application réelle »), appliquée aux
  tableaux.
- **`flex-wrap: wrap` dans une cellule en `width: 1%` empile tout.** La largeur minimale d'un
  conteneur qui peut passer à la ligne, c'est celle d'un seul élément : les cinq boutons d'action se
  sont donc empilés verticalement. Corriger un débordement par le passage à la ligne fabrique un
  empilement ; le vrai remède est **un bouton de moins**. Celui qui part est le seul sans libellé.
- **Un `if (x)` muet autour d'un geste transforme une erreur en bouton mort.** Et l'erreur, ici,
  n'était même pas là : `serialForm` appelait `clientItems`, déclarée LOCALEMENT dans deux autres
  formulaires. ReferenceError pendant la construction du gabarit, fenêtre qui ne s'ouvre pas, console
  vide. Le détecteur d'appels inexistants existait depuis la 6.8.0 **pour le cabinet seulement** —
  l'application principale, la plus grosse, n'y était pas. Une règle apprise d'un côté se vérifie de
  l'autre (règle 7.3.0), et celle-ci ne l'avait jamais été.
- **Mon propre test sautait une page en silence.** `colonnes.js` visait `#stk-tabs` là où
  l'application écrit `#st-tabs`, avec un `.catch(() => {})` par-dessus : il annonçait « 338 colonnes
  mesurées » sans avoir ouvert un seul onglet du Stock. Un sélecteur annoncé et introuvable doit faire
  **tomber** le test. Après correction : 392 colonnes.
- **Une aide n'est pas un livre.** Trente-deux titres dans une liste plate et 99 Ko de prose : on
  choisit un TERRITOIRE avant de choisir un titre, et chaque article finit par un **geste** — six
  liens vers l'application dans tout le corpus, c'était un cul-de-sac à chaque fois.
- **Une table en double diverge toujours.** `PAGE_AIDE` vivait dans app.js et `PAR_PAGE` dans
  guide.js. Elle vit désormais à côté des articles qu'elle désigne, et le test lit l'OBJET au lieu
  d'une expression régulière sur du texte.
- **Un état de recherche qui survit à la navigation peut cacher la page d'arrivée.** Arriver sur un
  article alors qu'une recherche traînait relançait le filtrage au dessin : le conteneur qui PORTE
  l'article repartait caché, et la page s'ouvrait blanche. Demander une chose précise efface le
  filtre. Trouvé par l'e2e, invisible à la lecture.
- **Un `select` dans un conteneur flex réclame toute la ligne.** La règle générale des champs
  (`select { width: 100% }`) s'applique aussi dans une barre d'actions : les trois sélecteurs de la
  page Statistiques s'empilaient sur trois rangées, étirés d'un bord à l'autre. `.filters` avait son
  `width: auto` depuis longtemps ; `.page-head .actions` ne l'avait jamais eu. Même famille que le
  `th.r` des colonnes : le HTML est juste, c'est la feuille de style qui décide, et ça ne se voit
  qu'en mesurant. `npm run e2e:entetes` mesure la largeur de chaque contrôle et la hauteur de chaque
  barre — et il a trouvé une page de plus que ma lecture du code (`#/garanties`).

## 7.25.0 — Le canal bêta (garder la stable pendant qu'on travaille)

Demandé par Skander : « garder la main qui est stable et bosser sur la beta, et quand je confirme la
beta alors on la publie, comme les grands logiciels ». Deux canaux, **une seule application**, un
seul dépôt.

**Le fonctionnement, de bout en bout.** `main` reste la branche stable, `beta` est la branche de
travail. Une version d'essai se numérote `7.26.0-beta.1` (`npm run release preminor` puis
`prerelease`), et **c'est le numéro qui décide de tout le reste** : le workflow Release marque la
release « préversion » sur GitHub (donc `/releases/latest` pointe toujours sur la dernière stable),
electron-builder écrit `beta.yml` / `beta-mac.yml` au lieu de `latest.yml`, le relais Cloudflare les
laisse passer (`CANAUX.app.yml`), et `core.canalDe(version)` en déduit le canal côté application.
Quand la bêta est confirmée, `npm run release minor` la transforme en `7.26.0` stable et `main`
avance. Publier se fait depuis l'onglet Actions → Release → Run workflow, en choisissant la branche.

Règles apprises, à ne pas recasser :

- **Une seule source de vérité, et c'est le numéro de version.** Un drapeau posé à la construction,
  une case au lancement du workflow, un réglage du dépôt : tout ça s'oublie et se désaccorde. Un
  numéro de version, non — il est écrit dans le paquet, dans la release, dans l'écran des mises à
  jour et dans le nom du fichier téléchargé. Les deux moitiés du système (electron-builder et
  `canalDe`) lisent la même chose, il n'y a donc aucun moyen de les faire diverger.
- **`allowPrerelease` est indispensable, et il ne se devine pas.** Sans lui, electron-updater
  interroge `/releases/latest`, qui **ignore les préversions par construction** : la bêta serait
  publiée et jamais proposée à personne, sans une erreur nulle part.
- **`u.channel = …` remet `allowDowngrade` à `true`** (règle 6.7.3, re-rencontrée) : il se repose
  APRÈS, toujours. La seule exception voulue : quelqu'un qui **décoche** la case tourne sur une
  version plus récente que la dernière stable ; lui interdire de reculer, c'est l'enfermer dans la
  bêta qu'il vient de quitter. D'où `allowDowngrade = !beta && canalDe(version) !== 'latest'`.
- **Le test de cette règle lisait un COMMENTAIRE.** Le commentaire qui explique le piège nomme les
  deux lignes côte à côte et satisfaisait l'assertion à lui seul — même faute qu'en 6.8.0 sur le
  garde-fou du cabinet. On retire les commentaires avant de juger, et on vérifie que le nettoyage
  n'a pas mangé le code. Trouvé en réintroduisant le défaut, jamais autrement.
- **Une bêta s'installe par-dessus la vraie comptabilité.** On prévient, on prend la sauvegarde
  `avant-beta` **avant** d'armer le canal (au moment de l'installation, il sera trop tard pour y
  penser), on n'interdit pas. Et le repère « bêta » du menu suit la **version installée**, jamais le
  canal choisi : ce qui compte, c'est ce qui tourne.
- **Une bêta d'entreprise ne construit plus l'app cabinet du tout** : elle n'a aucune case à
  décocher et personne ne lui a rien demandé. Publier une préversion sur `cabinet.yml` proposerait
  une version d'essai à tous les comptables d'un coup.
- **Le relais ne regarde plus 5 releases mais 20** : plusieurs préversions peuvent s'intercaler
  entre deux stables, et une installation restée sur le canal normal ne trouverait plus `latest.yml`
  dans la fenêtre.
- **Une bêta qui n'existe pas encore n'est pas une panne**, c'est le cas normal entre deux essais :
  le 404 du canal bêta a sa propre phrase, sinon l'écran répond « aucune version trouvée » en rouge
  et fait croire que les mises à jour sont cassées.

Le test qui compte est `npm run e2e:beta` : la case décochée à l'installation, la question, le refus
qui décoche vraiment, la sauvegarde prise sur le disque, et le retour en arrière sans question.

**Et un défaut de la 7.22.0 attrapé par un e2e que je n'avais pas relancé après l'avoir écrit :** en
remplaçant le taux de TVA porté par le métier par un régime fiscal, on a perdu ce que le métier
savait depuis la 2.0.0 — « Santé et paramédical » est exonéré. L'application proposait 19 % à un
kinésithérapeute qui venait de cliquer sur son propre métier. `core.regimeSuggere(activité)` le
**propose** de nouveau, `a.regimeTouche` empêche d'écraser un choix fait à la main (même motif que
`modulesTouche` et que la durée proposée par la famille d'un bien). **Retirer un mécanisme
n'autorise pas à perdre ce qu'il savait** — et un e2e ne sert que si on le relance.

## 7.26.0 — Aucun message brut, et un seul interrupteur public/privé

Skander, sur capture : « je n'aime pas que ça affiche cette ligne, ça ne fait pas pro un message
d'erreur — `Cannot find latest-mac.yml in the release https://github.com/…` ». Et, séparément :
« le dépôt redeviendra privé, est-ce que t'as réglé la ligne avec le token ? »

Les deux tenaient au même endroit du code, et la seconde question a révélé que la réponse était
**non** : la 7.24.0 avait supprimé le champ jeton parce que le dépôt venait de passer public.

Règles apprises, à ne pas recasser :

- **On ne montre jamais à l'utilisateur une phrase qu'on n'a pas écrite.** `friendlyError` finissait
  par `return m.split('\n')[0].slice(0, 200)` : tout cas non prévu recopiait l'anglais
  d'electron-updater, avec son URL. `updateProblem(err)` rend `{ message, detail, soft }` — une
  phrase en français pour chaque cas, le texte d'origine rangé dans `detail` (replié sous « Détails
  techniques », plus un bouton qui ouvre le journal : c'est lui qui sert à dépanner, règle 6.7.2),
  et `soft` pour ce qui **n'est pas une panne**. Du rouge sur une situation normale apprend à
  ignorer le rouge.
- **Le code d'une erreur vit sur l'erreur, pas dans son message.** `ERR_UPDATER_CHANNEL_FILE_NOT_FOUND`
  ne figure nulle part dans « Cannot find latest-mac.yml in the release … ». Le chercher dans le
  texte, c'est ne jamais le trouver — c'est ce que faisait la branche bêta écrite en 7.25.0, qui
  n'aurait donc jamais été atteinte. On lit `err.code` **et** `err.message`.
- **Une release existe AVANT ses fichiers.** GitHub crée le tag et la page, puis les installateurs
  montent pendant deux à quatre minutes — et c'est exactement le moment où l'on va voir si la
  nouvelle version est là. Ce n'est pas une panne, ça a sa phrase et son gris. (Vérifié sur les
  horodatages de la 7.25.0 : page à 08:22:24, `latest-mac.yml` à 08:24:38, message vu à 08:22.)
- **Un test de source qui interdit une forme doit lire l'ARGUMENT, pas la ligne.** Mon assertion
  `!/return\s+(m|brut)\b/` laissait passer `return dit(brut.split(…))` — vert avec le défaut
  réintroduit. Elle scanne maintenant l'argument de chaque `return dit(…)`, parenthèses équilibrées.
- **Un drapeau qui vit en double diverge, toujours.** `GITHUB.private` existait dans les DEUX
  `main.js`. L'app entreprise disait « public » depuis la 7.24.0 pendant que celle du comptable
  affichait encore « SkanFact est distribué depuis un dépôt privé : un jeton de lecture est
  nécessaire » — et le faisait chercher un jeton que personne n'avait à lui donner. La vérité vit
  dans **`src/depot.js`**, que les deux applications lisent (et qui doit figurer dans les `files` de
  `build/cabinet.config.js`, sinon l'app cabinet ne démarre plus une fois construite).
- **Retirer un mécanisme devenu inutile, c'est désarmer l'interrupteur qui le rallume.** La 7.24.0
  avait supprimé le champ jeton « puisque le dépôt est public » : basculer `private` à `true`
  n'aurait plus rien réarmé, et l'écran aurait écrit « colle ton jeton ci-dessous » au-dessus de
  rien du tout. Ce qui dépend d'un drapeau se pose **sous** ce drapeau, jamais en dur ni supprimé.
- **Un test écrit contre l'état du jour décrit cet état, pas la règle.** Celui de la 7.24.0 exigeait
  l'ABSENCE du champ. Il a fallu le réécrire pour livrer la bonne version — même famille que
  `barre-laterale.js` en 7.12.0. On teste l'interrupteur, pas la position dans laquelle il est.
- Sur le relais : il fonctionne **à l'identique** sur un dépôt privé — c'est justement sa raison
  d'être. Une seule chose à vérifier le jour de la bascule, et c'est noté dans `worker/README.md` :
  que le `GITHUB_TOKEN` du worker ait bien **Contents: Read-only** sur le dépôt. Sur un dépôt
  public, un jeton sans droits suffit à lire les releases : la panne ne se verrait qu'au moment de
  la bascule, et couperait les mises à jour de tout le monde d'un coup.

Le test qui compte est `npm run e2e:depot` : il **bascule vraiment** `src/depot.js` en privé, ouvre
l'application, vérifie que le champ est revenu, repasse en public et vérifie qu'il repart — le
fichier étant remis dans son état d'origine quoi qu'il arrive (`finally`).

### 7.26.1 — le repli n'est pas un réglage, c'est un réflexe

L'app du comptable affichait, sur le même écran et à dix lignes d'écart : « Aucune version trouvée :
le jeton d'accès manque ou n'a pas accès au dépôt » **et** « Les mises à jour arrivent toutes seules :
rien à configurer ». Deux phrases qui ne peuvent pas être vraies ensemble.

- **Un chemin de secours ne sert que s'il se déclenche tout seul** — règle de la 6.7.2, re-trouvée
  une couche plus bas. Le repli GitHub existait depuis la 6.7.0 mais ne se déclenchait **que si le
  relais était mal réglé** (`new URL` qui lève), jamais s'il *répondait mal* : le seul cas qui
  arrive vraiment. `checkForUpdates` rebranche maintenant GitHub et **réessaie immédiatement**
  (`relayDown` retient l'échec pour la session, `configureFeed` le respecte).
- **On ne crie pas avant d'avoir essayé le second chemin.** L'événement `error` du premier échec
  affichait un rouge que le repli dément une seconde plus tard : `silencerErreur` le retient tant
  qu'un second essai reste possible — et se relève sur **chaque** sortie, sinon l'écran devient
  muet pour de bon.
- **Une fermeture, c'est un mécanisme qui n'existe qu'au moment où on ne peut pas encore s'en
  servir.** `feedGithub` vivait à l'intérieur de `getUpdater()` dans l'app cabinet : impossible de
  rebrancher le flux après coup. Sorti au niveau du module, comme dans l'app entreprise.
- **Ce que `check` RENVOIE et ce qu'un ÉVÉNEMENT envoie doivent porter la même chose.** `detail` et
  `soft` ne voyageaient qu'avec les événements ; les erreurs renvoyées après un clic sur
  « Vérifier » — c'est-à-dire celles qu'on lit vraiment — les perdaient en route, et « Détails
  techniques » ne s'affichait jamais dans le cas le plus courant.
- Et l'écran **relit l'état de l'application** après une vérification : le repli a pu débrancher le
  relais entre-temps, et sans cette relecture la page continue d'annoncer « rien à configurer ».

## 7.27.0 — L'Aide : ce que la capture montre et que la relecture ne montre pas

Skander : « le ui n'est pas ouf ni le ux donc il faut l'améliorer et le layout est bizarre, fais-moi
quelque chose d'intuitif, coloré aussi ». Il avait raison sur les trois points, et deux des défauts
étaient là depuis la 7.23.0 sans que rien ne les signale.

Règles apprises, à ne pas recasser :

- **Une règle posée sur un ÉLÉMENT bat une classe qui ne déclare pas la même propriété.**
  `nav { display: flex; flex-direction: column }` range la barre latérale ; `.help-fil` déclarait
  `display: flex` et rien d'autre. Le fil d'Ariane — un `<nav>` — s'est donc affiché **à la
  verticale, centré**, sur cinq lignes et cent pixels, en tête de chaque article pendant quatre
  versions. Rien en console, rien dans les tests de calcul, et la relecture du HTML ne peut pas le
  voir : c'est la même famille que le `th.r` des colonnes (7.23.0) et que `.setup-card` du cabinet
  (6.8.0). Le fil est un `<div>`, il déclare `flex-direction: row` noir sur blanc, et
  `npm run e2e:aide` **mesure** le nombre de lignes qu'il occupe.
- **Deux colonnes de largeurs différentes ne se pilotent pas depuis la page.** `.help-suite`
  (« article suivant ») était en `justify-content: space-between` sur toute la largeur du contenu,
  pendant que l'article, lui, était borné à 780 px : le bouton finissait 250 px à droite de la
  colonne qu'il prolonge. Ce qui appartient à une colonne vit DANS la colonne.
- **`scrollIntoView` posé pendant le dessin d'une route est effacé une ligne plus loin.** `render()`
  remet `#view.scrollTop` à zéro APRÈS avoir appelé la route. La pastille s'allumait, la section se
  marquait en couleur, et la page ne bougeait pas d'un pixel — un bouton qui accepte le clic et n'en
  fait rien (défaut de la 7.0.0). Le mécanisme qui marche existait déjà : `pageFocus` (7.18.0), qui
  s'exécute après la remise à zéro et apporte le repère coloré avec lui. **Avant d'écrire un
  deuxième mécanisme, chercher pourquoi le premier n'a pas servi.**
- **Un plan montre le territoire ; il ne le cache pas derrière un clic qui ne promet qu'un nombre.**
  Sept cartes grises annonçant « 7 ARTICLES » obligent à cliquer à l'aveugle pour savoir ce qu'il y
  a dedans — et la 7.23.0 redessinait en plus la liste ENTIÈRE des sept thèmes sous le thème ouvert,
  celui-ci compris. Les trente-deux articles sont désormais visibles d'un coup, rangés par domaine.
- **La couleur d'un thème vit dans la feuille de style, jamais dans le JavaScript** : une couleur
  écrite dans `guide.js` ne sait pas se retourner en mode sombre. Les deux tables (thèmes dans
  guide.js, couleurs dans style.css) sont confrontées par un test — deux tables séparées divergent
  toujours, et un huitième thème naîtrait gris au milieu de sept colorés.
- **Une recherche qui rend la moitié du corpus doit CLASSER.** « tva » rendait dix-sept articles sur
  trente-deux dans l'ordre où ils sont écrits dans le fichier : dix-sept titres non classés ne valent
  pas mieux que les trente-deux qu'ils remplacent. Titre, puis sous-titre, puis corps — et chaque
  résultat montre l'extrait où le mot se trouve, sinon il n'explique pas pourquoi il est là.
- **Surligner, c'est découper puis échapper morceau par morceau.** Échapper après avoir posé les
  `<mark>` les mangerait ; ne pas échapper laisserait passer le corps d'un article en HTML. Un test
  exige que chaque morceau recollé passe par `h(`.
- **La règle générale des champs porte quatre `:not(…)` : aucune classe ne la bat.** `.help-search
  input { padding-left: 41px }` n'a jamais été appliqué, et la loupe se posait SUR la première
  lettre du texte. C'est l'identifiant (`#aide-q`) qui tranche. Encore une fois : le HTML est juste,
  c'est la feuille de style qui décide, et **ça ne se voit qu'en regardant**.
- Piège de test rencontré, et qui a failli passer : `if (apres.scroll <= avant.scroll)` alors que
  `avant` était un NOMBRE. `0 <= undefined` vaut `false` : l'assertion ne pouvait pas échouer. Trouvé
  en réintroduisant le défaut qu'elle est censée attraper — jamais autrement.
- Piège de test rencontré : rejouer l'ancien défaut ne suffit pas quand le correctif est double. Le
  fil redevenu `<nav>` ne faisait plus tomber l'e2e, parce que `flex-direction: row` le protège
  désormais ; il faut retirer LES DEUX pour retrouver le défaut d'origine — et c'est ce qui prouve
  que la ceinture ET les bretelles servent.

Le test qui compte est `npm run e2e:aide` : sept étapes qui **mesurent** le plan (sept sections,
trente-deux articles, sept couleurs distinctes), la descente vers une section, la hauteur du fil
d'Ariane, l'alignement des boutons suivant/précédent sur la colonne de l'article, le classement de
la recherche, et le sommaire d'un article long — qui ne doit pas exister sur un article court.

## 7.28.0 — Le partage qui partage vraiment, et une seule porte par ligne

Trois demandes du propriétaire, et deux d'entre elles ont mis au jour des mécanismes qui ne
servaient à personne.

Règles apprises, à ne pas recasser :

- **Une fonctionnalité qui n'a de sens qu'au premier jour n'a de sens pour personne.** « Dossier
  partagé à deux… » demandait un NOM D'ENTREPRISE et fabriquait un dossier VIDE : quelqu'un qui
  avait déjà saisi sa société, ses clients et ses factures — c'est-à-dire tout le monde, puisque
  c'est ce qu'on fait avant de vouloir partager — tombait sur l'assistant de première utilisation.
  Et il n'existait aucun moyen de REJOINDRE un dossier déjà posé. Le partage à deux, livré en
  3.2.0, était donc inutilisable depuis trois ans. Même famille que « un moteur sans écran n'existe
  pas » (7.3.0), vue de l'autre côté : ici l'écran existait, c'est le geste qui manquait.
- **`currentDossier()` relit la configuration sur le DISQUE et rend un autre objet.** Modifier ce
  qu'il renvoie puis écrire `cfg` réécrit l'ancienne valeur : les fichiers étaient copiés,
  l'application se rechargeait… sur l'ancien emplacement, et rien n'arrivait jamais de l'autre
  poste. Toute fonction qui rend un élément d'une structure relue doit être retrouvée DANS la
  structure qu'on s'apprête à écrire. Trouvé par `npm run e2e:partage`, qui fait vraiment
  l'aller-retour entre deux applications et deux profils.
- **On copie, on ne déplace pas.** L'ancien emplacement reste intact et sert de filet — même règle
  que la reprise de l'ancien format en 3.2.0 — et la bascule n'a lieu qu'une fois la copie
  CONSTATÉE (le fichier de données est là, et de la même taille). Un dossier iCloud plein ou un
  disque réseau qui se déconnecte en cours de route ouvrirait sinon un dossier à moitié écrit.
- **Un garde-fou global qui énumère les surfaces cliquables se périme au prochain overlay.** Le
  `mousedown` global de l'application refermait tout overlay ouvert sauf `.combo` et `.datefield`.
  Le menu d'actions, écrit ce jour-là, n'était ni l'un ni l'autre : ses entrées acceptaient le clic,
  le menu se refermait — donc le bouton quittait le document — et le `click` n'avait plus personne à
  qui parler. Aucune erreur, aucune console, et le menu qui se ferme donne l'impression que quelque
  chose s'est passé. C'est le défaut de la 7.0.0 en plus sournois. La liste vit maintenant dans
  `SURFACES_OVERLAY`, à un seul endroit, et un test la confronte aux overlays existants.
- **Le budget de boutons d'une ligne se règle en supprimant la rangée, pas en la serrant.** Cinq
  boutons par ligne (7.18.0, 7.23.0) tombaient dans des pictogrammes muets — « ⧉ », « ⏱ » — dès
  qu'ils étaient trop nombreux. Un menu occupe la largeur d'un bouton quoi qu'il contienne : chaque
  action y porte une PHRASE et son explication. Un test interdit les libellés de moins de six
  caractères, et exige qu'une ligne sans action perde son bouton (un menu vide est encore un bouton
  mort).
- **Un geste qui change l'état d'une pièce commerciale demande, annonce, et propose la suite.** Les
  trois vont ensemble, et dans UNE seule fenêtre : deux boîtes à la file se cliquent sans être lues.
  « Le client a accepté » rappelle le devis, le client et le montant, puis offre « Accepter et
  facturer » — parce que ce qui vient après un devis accepté, c'est la facture. Le « Annuler » de
  huit secondes (7.12.0) reste par-dessus : la question protège du geste, le retour protège de la
  décision.
- **Un menu ancré sur une ligne hors écran est inatteignable — et c'est voulu.** Il se ferme au
  moindre défilement, comme chez un vrai utilisateur. Un e2e qui ouvre un menu par `evaluate` puis
  demande à Playwright d'y cliquer fait défiler la page pour l'atteindre, referme le menu, et
  accuse l'application. On repère la ligne par ce qu'elle AFFICHE (son badge de statut), puis on
  clique pour de vrai.
- **Un test e2e qu'on ne relance pas se périme sans rien dire.** `e2e:entreprise` visait encore
  `.help-nav`, la colonne de gauche de l'aide supprimée par la refonte de la 7.23.0 : le test était
  cassé depuis, et personne ne s'en était aperçu — il n'avait pas été relancé. Corollaire de la
  règle 7.25.0 (« un e2e ne sert que si on le relance ») : **après une refonte, relancer TOUS les
  parcours, pas seulement celui qu'on vient d'écrire.**
- **Un drapeau envoyé au processus principal se remet à jour quand l'état DISPARAÎT, pas seulement
  quand il se pose.** `leaveOk` et le routeur remettaient `guard` à `null` directement, sans
  repasser par `clearGuard()` : `dirtyReported` restait donc à `true` pour le reste de la session.
  Conséquence, invisible depuis trois versions : dès qu'on avait modifié quoi que ce soit, fermer la
  fenêtre posait pour toujours la question « modifications non enregistrées », sur des données
  pourtant enregistrées. Une application qui annonce une perte qui n'existe pas apprend à cliquer
  sans lire. C'est `e2e:chiffres` qui l'a désigné — il restait bloqué pour toujours à la fermeture.
- **Un test e2e qui reste bloqué est pire qu'un test qui échoue.** Il ne dit rien, on ne le relance
  plus, et il cesse d'exister. Toute fermeture d'application dans un e2e passe désormais sous
  `Promise.race` avec un délai et une phrase qui nomme la cause — même principe que les commandes
  du chien de garde (6.5.0). Et le garde-fou de sortie est une boîte à TROIS choix
  (`choiceDialog` : `#a`, `#b`, Annuler), pas un `confirmDialog` : viser `#ok` ne ferme rien.
- **L'aide du cabinet suit celle du client.** Les classes viennent de la feuille PARTAGÉE
  (`.help-…`, `.th-…`) : c'est le même langage visuel, et surtout pas un second jeu de règles dans
  `cabinet.css` qui dériverait au premier ajustement (règle 6.8.0 sur les collisions de noms). Les
  huit articles portent désormais un sous-titre, un dessin, une couleur et le geste qui suit la
  lecture — `geste: null` sur « Ce que cette application ne fait pas », parce qu'on ne renvoie nulle
  part depuis une liste de limites.

Les tests qui comptent sont `npm run e2e:partage` (deux applications, deux profils, un emplacement
commun : on partage, on rejoint, et ce que l'un enregistre l'autre le voit) et `npm run e2e:actions`
(un seul bouton par ligne sur six listes, le menu qui ne vole pas le clic de la ligne, la question
posée avant d'agir — et « Annuler » qui ne change vraiment rien — puis « Accepter et facturer » qui
ouvre le brouillon).

## 7.29.0 — Un bouton qui ne se referme pas n'est pas un interrupteur

Skander, sur captures : « quand j'appuie sur les 3 points et que je rappuie dessus, ça ne la ferme
pas mais la rouvre » ; « mets des icônes, c'est plus intuitif » ; « au lieu des 3 points renomme le
bouton » ; « dans la capture 2 on voit les boutons qui sont collés » ; « dans immobilisations, voir
la fiche me renvoie dans l'achat à modifier, est-ce le bon workflow ? ».

Règles apprises, à ne pas recasser :

- **Deux garde-fous qui visent la même chose se neutralisent.** Le `mousedown` global refermait le
  menu ; le `click` qui suit, sur le même bouton, le rouvrait. Le menu clignotait et restait
  ouvert. Il faut LES DEUX moitiés : le bouton entre dans `SURFACES_OVERLAY` (le garde-fou global
  ne le touche plus) **et** `ouvrir()` referme quand on rappuie sur le bouton déjà ouvert
  (`ouvertSur`). Le drapeau se remet à zéro **sous condition** (`if (ouvertSur === bouton)`) :
  `close` peut être rappelé alors qu'un AUTRE menu a pris sa place.
- **Un pictogramme n'est pas un libellé, mais une icône À CÔTÉ d'un libellé est un repère.** « ⋮ »
  ne se lit que si on connaît la convention : le bouton porte le mot « Actions » et un chevron.
  Dans le menu, chaque action porte son dessin en plus de sa phrase — jamais à la place.
- **Une action UNIQUE ne se cache pas derrière un menu** : `bindRowMenus` transforme le bouton en
  vrai bouton nommé qui exécute directement. Deux clics et une lecture pour un choix unique, c'est
  ce qu'on reprochait aux rangées.
- **Le menu vit dans `src/renderer/rowmenu.js`, chargé par LES DEUX applications.** L'app du
  cabinet avait exactement le même défaut, en pire : cinq boutons fantômes par ligne d'historique,
  dont un « ✕ » muet qui **efface un paquet reçu** — le geste le plus destructif était le seul sans
  nom. Le recopier aurait garanti la divergence (règle 7.3.0 + « une table en double diverge
  toujours »). Il ne connaît rien du métier : on lui passe des actions toutes faites et on lui
  prête le registre d'overlay de l'hôte (`RowMenu.brancher`).
  **Tout fichier partagé doit entrer dans les `files` de `build/cabinet.config.js`** — sinon l'app
  démarre en développement et plante une fois construite, comme `src/depot.js` en 7.26.0. Un test
  relit les balises de son HTML et l'exige.
- **Une ligne garde AU PLUS UN bouton toujours visible** — le geste pour lequel la page existe
  (« Écrire » sur les relances du cabinet) — et tout le reste passe par le menu. `RowMenu.cellule`
  prend ce bouton en paramètre ; un test compte les boutons de chaque cellule `row-actions` dans
  les deux applications et refuse tout libellé de moins de six caractères.
- **Deux boutons voisins ne doivent pas dépendre d'une espace dans le gabarit.**
  `${cond ? '<button…>' : ''}<button…>` les collait, et ça ne se voit qu'à l'écran (capture du
  Catalogue). `td.actions .btn + .btn { margin-left }` le règle une fois pour toutes.
- **Un libellé décrit l'écran d'ARRIVÉE.** « Voir l'achat » ouvrait l'éditeur : un achat n'a pas de
  fiche en lecture seule, contrairement à une facture émise qui est verrouillée. Le bouton dit
  maintenant « Ouvrir la facture d'achat », et « Créer la fiche » est devenu « Créer la fiche du
  bien » (c'est celle de l'immobilisation, pas celle de l'achat).
- Piège du gabarit, re-rencontré : **un commentaire HTML dans un `template literal` ne doit contenir
  aucun backtick** — j'ai écrit `` `btn-ghost` `` dans un commentaire et fermé la chaîne.
- **Un garde-fou posé chez l'APPELANT ne protège que cet appelant.** La question « ce devis a déjà
  donné FAC-… » était sur le bouton de l'éditeur depuis la 7.16.0 ; le menu de ligne, écrit douze
  versions plus tard, est reparti sans elle et refabriquait une facture ENTIÈRE en silence. Elle
  vit maintenant dans `facturerDevis`, avec le geste. Corollaire : `piecesDuDevis(id)` est la seule
  source (l'éditeur, le menu et le geste l'appellent) — et ses deux moitiés ne se lisent pas au même
  endroit, une facture totale porte `fromQuoteId`, un acompte porte `deposit.quoteId`.
- **Un overlay peut se fermer sur un événement qu'on n'a pas provoqué.** Le menu s'ouvrait et
  disparaissait dans la milliseconde : le `scroll` qui avait amené le bouton à l'écran juste avant
  le clic était livré à la frame SUIVANTE, après l'enregistrement du fermeur. On ne ferme donc que
  si le conteneur a vraiment bougé (`Math.abs(scrollTop - depart) > 4`). Symptôme à reconnaître :
  un menu qui « ne s'ouvre pas » alors que son gestionnaire s'exécute — le tracer avec un
  `MutationObserver` dit s'il a été ajouté puis retiré, ce qu'aucun sélecteur ne montre.
- **Ce qui s'ouvre par-dessus referme ce qui est en dessous.** `openPalette` ferme le menu de ligne
  et le sélecteur d'entreprise (couche 70) avant de se dessiner (couche 60) : sinon ils flottent sur
  son fond flouté et volent son premier Échap. L'app du cabinet avait ce garde-fou depuis la 6.8.0.
- **`vers()` et non `navigate()` dans TOUTE table d'actions** qui pose un état avant de naviguer —
  les entrées d'onglet de la palette étaient inertes depuis la page qu'elles visent (piège 7.15.0).
- **`e2e:boucle` était cassé depuis la 7.22.0** — le parcours le plus important du projet, celui qui
  prouve la chaîne entreprise → paquet → cabinet. Il traversait l'assistant en comptant les
  « Suivant » ; l'écran du régime fiscal s'est inséré au milieu. Personne ne s'en était aperçu : il
  n'avait pas été relancé. C'est le troisième e2e pourri par le même mécanisme (`.help-nav` en
  7.28.0, les écrans numérotés en 7.3.0). **Reconnaître chaque écran à ce qu'il contient, jamais à
  son rang — et relancer TOUS les parcours après une refonte.**

## 7.30.0 — Les Paramètres, et ce qu'on ne peut pas trouver

Audit des pages de réglages des deux applications, mesuré avant d'y toucher (`e2e:parametres`), puis
un audit de code à six angles avec un contradicteur par constat : **huit constats graves retenus,
trois réfutés**. Refonte livrée avec eux.

Règles apprises, à ne pas recasser :

- **Un onglet d'un demi-écran n'est pas un onglet, c'est un clic de plus.** Huit onglets d'un
  déséquilibre de 1 à 12 : « Licence » et « Cabinet comptable » pesaient une phrase, « Sécurité et
  données » deux écrans et dix-huit boutons. Cinq onglets, et le plus léger fait 0,8 écran.
- **Ce qui rend un rangement pardonnable, c'est la recherche.** Quand on ne sait pas dans quelle
  famille un réglage a été classé, on tape son nom. Elle lit les titres, les libellés ET la prose des
  panneaux (« où je règle la copie iCloud ? » n'a pour réponse ni un titre ni un libellé : le mot
  n'est que dans la phrase d'explication), et elle dit toujours DANS QUEL ONGLET c'est rangé.
- **Le sommaire et la recherche se déduisent de l'ÉCRAN**, jamais d'une liste écrite à la main : un
  panneau ajouté demain est trouvable le jour où il est écrit. Corollaire : la table qui porte les
  synonymes porte AUSSI le titre et l'onglet, et pose le panneau elle-même (`panneau(id)`).
- **Une refonte d'onglets périme tout ce qui les NOMME.** Six alias de la palette Cmd+K et onze
  phrases de refus désignaient un onglet disparu — donc Cmd+K ne rendait plus un seul réglage, en
  silence. Deux tests génériques l'interdisent : les entrées de palette sont engendrées panneau par
  panneau, et toute chaîne « Paramètres → X » doit nommer un onglet qui existe.
- **Une application qui vérifie ses mises à jour UNE fois au démarrage ne les vérifie pas.** SkanFact
  est ouvert du lundi au vendredi sans être quitté : une correction publiée le mardi arrivait le
  lundi suivant. Toutes les quatre heures, plus un rattrapage au retour au premier plan (un portable
  refermé suspend les minuteurs). Et la date de la dernière vérification est AFFICHÉE : sans elle,
  « tu as la dernière version » peut dater d'un mois, et rien ne permet de le savoir.
- **Une panne pendant un téléchargement que l'utilisateur VOIT se dit toujours**, même si la
  vérification qui l'a déclenché était silencieuse. Sinon la barre de progression se fige à 40 % pour
  de bon — et les deux états concernés n'offraient aucun bouton, alors que `update:download` savait
  relancer depuis la 1.7.0 (« un moteur sans écran n'existe pas », 7.3.0).
- **Un réglage à liste fermée ne se saisit jamais en texte libre.** La devise de l'entreprise était
  le seul champ libre de l'application ; « TND », « dinar » ou une faute de frappe faisaient passer
  toutes les factures à deux décimales au lieu de trois, sans un mot. Et la migration rattrape ce
  qui a déjà été tapé, au lieu de le remettre d'office à la valeur par défaut.
- **Un drapeau « l'utilisateur y a touché » doit être RÉAMORCÉ partout où l'écran se rejoue.**
  `regimeTouche` n'est pas enregistré : au rejeu de l'assistant — le seul endroit où l'on puisse
  changer de métier — il repartait à `undefined` et le régime fiscal réglé à la main se faisait
  écraser. Son voisin immédiat, `modulesTouche`, le faisait correctement depuis la 7.0.0.
- **Tout geste des Paramètres qui finit par `render()` enregistre d'abord.** La règle datait de la
  5.2.1 et n'avait été posée que sur le choix d'un logo : activer un mot de passe jetait vingt champs
  remplis, sans un mot. `enregistrerEnCours()` passe par le garde-fou actif, donc vaut pour tout
  écran qui en pose un.
- **Un refus d'écriture se remonte, il ne se jette pas.** `setPassword` ignorait le retour de
  `write()` : sur un dossier partagé, l'écran annonçait « Données chiffrées » pendant que le fichier
  n'avait pas bougé — et au redémarrage il réclamait l'ANCIEN mot de passe pendant que les
  sauvegardes réclamaient le nouveau.
- **Rechiffrer les sauvegardes, c'est aussi celles de la clé USB.** `mirrorExternal` ne recopiait un
  fichier que s'il n'existait PAS encore : trente jours de comptabilité restaient en clair sur le
  support qui voyage, à côté d'un fichier chiffré, pendant que l'écran affirmait le contraire. On
  compare taille et mtime, et on convertit sur place les sauvegardes externes sans équivalent local
  — sans jamais les supprimer : c'est un filet, il a juste à ne plus être lisible.
- **Une règle CSS correcte peut PERDRE en silence, et ça ne se voit qu'en mesurant.** Troisième fois
  (après le `th.r` des colonnes en 7.23.0 et `.help-fil` en 7.27.0) : en thème sombre, chaque
  `<input>` gardait son fond clair avec le texte clair du thème — contraste **1,18**, du blanc sur du
  blanc, depuis que le thème existe. La règle commune des champs porte quatre `:not()`, la règle
  sombre n'en portait aucun. `select` et `textarea` n'étaient pas touchés (dans une LISTE de
  sélecteurs, chacun porte sa propre spécificité), donc l'écran paraissait à moitié correct — la
  pire façon d'être faux. `e2e:contraste` mesure désormais les champs autant que les boutons.
- **Un pluriel mal accordé se compte en dizaines.** Quatre-vingt-dix « 1 facture(s) » dans les deux
  applications et leur logique partagée, alors que la règle existait dans l'app du cabinet depuis sa
  1.0.0 et avait été « portée » à UN écran en 7.18.0. `pl`/`sPl` (app.js) et `plFr`/`sAccord`
  (core.js), et un test qui interdit la forme partout.
- **Un test qui lit du code doit lire ce qu'il prétend lire.** Ma première version du test de
  pluriel passait par `codeSeulement`, qui VIDE les chaînes — c'est-à-dire l'endroit exact où vivent
  les pluriels. Il ne pouvait pas échouer. Je ne l'ai su qu'en réintroduisant le défaut.
- Piège d'e2e, la quatrième fois : **trois parcours visaient un onglet par son identifiant** et un
  quatrième un `data-fiche` supprimé douze versions plus tôt (`e2e:fiches` accusait le jeu d'exemple
  d'être vide). On reconnaît un écran à ce qu'il CONTIENT — `ouvrir l'onglet qui contient #p-cabinet`
  — et on relance TOUS les parcours après une refonte, pas seulement celui qu'on vient d'écrire.

## 7.31.0 — Un document long est fait de PAGES

Skander, sur capture : « quand le devis ou facture est longue avec plein de lignes l'affichage n'est
pas très bien ». Mesuré avant d'y toucher (chromium + `page.pdf`, jamais déduit) : le document était
**un seul long bloc** que le navigateur coupait où il pouvait, avec un pied de page posé en absolu à
la fin de ce bloc. Conséquences, sur **toutes** les pièces de plus d'une page depuis la 1.0.0 :

- le pied s'imprimait **par-dessus les cases de signature** (« Date, signature et cachet du client »
  barré du matricule fiscal) ;
- la **première page ne portait aucune mention légale** ;
- aucun numéro de page nulle part ;
- un devis de neuf lignes finissait sur une seconde page **vide aux trois quarts**.

`paginate(d)` (core.js) fabrique désormais une `<div class="page">` par feuille : pied complet et
numéroté sur chacune, bandeau `.cont` de rappel en tête des suivantes, en-tête de colonnes répété,
blocs insécables descendus entiers. `mettreEnPage()` dans app.js et `renderPdf` dans main.js sont les
deux seules portes, et elles font la même chose dans le même ordre.

Règles apprises, à ne pas recasser :

- **Un pied de page posé en absolu se colle à la fin du CONTENU, pas en bas d'une feuille.** C'est
  vrai dès que le contenu dépasse une page — et ça ne se voit ni dans une console, ni dans un test de
  calcul, ni en relisant le CSS. Il a fallu imprimer un vrai PDF et le regarder.
- **Déléguer la découpe au navigateur ne perd jamais rien ; la faire soi-même, si.** `.page` porte
  `overflow: hidden` : une erreur de mesure de trois millimètres masquerait une ligne de facture sans
  un mot. D'où le filet : à la fin de la répartition, on vérifie que **chaque** page tient dans sa
  feuille, et sinon on restaure le document d'origine et on rend la main au navigateur. Mieux vaut le
  défaut d'hier qu'une ligne invisible.
- **Le resserrement ne se justifie que s'il fait gagner une feuille.** `fitToPage` resserrait dès
  qu'il y avait débordement — donc aussi sur un document qui ferait trois pages de toute façon : on
  perdait le confort de lecture pour rien. On essaie les niveaux (rien, `compact`, `compact dense`) et
  on garde le plus léger qui réduit le nombre de pages. Effet de bord heureux : un devis de **huit
  lignes tient maintenant sur une page** au lieu de deux.
- **Une fonction sérialisée par `main.js` ne peut appeler AUCUNE autre fonction de core.js.**
  `renderPdf` envoie `fitToPage.toString()` et `paginate.toString()` dans la fenêtre PDF : un appel à
  `money()` y lèverait une ReferenceError silencieuse et le PDF sortirait sans mise en page. Un test
  compare le corps des deux fonctions à la liste des exports de core.js.
- **Un bloc insécable plus haut qu'une page fait tout échouer.** De longues notes rendaient `.after`
  (conditions + totaux) plus haut qu'une feuille, et plus rien ne tenait nulle part. Deux parades :
  les notes sont découpées **ligne par ligne** (`.n-l`, chacune échappée séparément), et quand le bloc
  de fin dépasse, sa colonne de gauche est **sortie** du bloc pour se répartir, la carte des totaux
  restant à sa place.
- **Une condition de garde porte sur la PAGE, jamais sur le conteneur.** Mon premier `repandre`
  acceptait d'office le premier morceau de chaque conteneur neuf « puisqu'il est seul » — or le
  conteneur était neuf sur une page déjà pleine. Un cas sur 161 débordait de 1 mm ; c'est la mesure
  qui l'a dit, pas la relecture.
- **Piège du gabarit, troisième fois : aucun backtick dans un commentaire d'un `template literal`.**
  Deux commentaires CSS contenant un nom de fonction entre backticks ont cassé core.js.
- **Un nom de fichier de capture écrit à l'avance finit par mentir** : `deux-pages.png` montrait une
  page. Le nom porte maintenant le nombre de pages **mesuré**.

Le test qui compte est `npm run e2e:pages` : il imprime **161 documents** (sept types, six variantes,
de 1 à 40 lignes) et vérifie sur chacun qu'aucune ligne, clause ou note n'a disparu, qu'aucune page ne
déborde, qu'aucun pied ne chevauche le contenu, qu'une page fabriquée fait une feuille et que chacune
est numérotée. Il n'ouvre pas Electron (chromium suffit), donc il tourne sans `xvfb`. Prouvé en
remettant le défaut : 111 cas sur 161 tombent.

## 7.32.0 — Les Réglages du cabinet en onglets, et ce qu'un rangement ne doit jamais ranger

Skander : « pour l'appli cabinet, créer des onglets c'est mieux non ? (dans la page paramètres) ».
Mesuré avant de répondre (`npm run e2e:parametres`, étendu pour mesurer panneau par panneau) : 2,6
écrans, sept panneaux de 0,20 à 0,49 écran chacun — toute la page du cabinet était plus petite qu'un
seul onglet de l'app entreprise. Un découpage en trois donnait 0,74 / 1,05 / **0,46**, et le dernier
tombait sous le demi-écran, c'est-à-dire exactement ce que la 7.30.0 venait de retirer de l'autre
application. Livré quand même, sur décision du propriétaire, mais **rééquilibré** : 0,8 / 1 / 0,7.

Règles apprises, à ne pas recasser :

- **Un rangement range aussi ce qu'il ne faut pas ranger.** Le commentaire qui interdisait les
  onglets dans ce fichier donnait une raison juste : l'avertissement « tu n'as jamais enregistré de
  clé de secours » se serait retrouvé derrière un clic. Mettre des onglets obligeait donc à le
  sortir d'abord — bandeau au-dessus de la barre d'onglets, ligne en tête de « À faire », et sur la
  page Dossiers **y compris quand elle est vide** (cet écran-là sortait avant le panneau « À faire »,
  et c'est le premier jour que l'alerte compte le plus).
- **La question posée révèle souvent un défaut plus grave que la question.** Ici : l'alerte la plus
  importante de l'application — sans clé de secours, un poste perdu rend illisibles POUR TOUJOURS
  tous les paquets reçus — n'existait qu'à un seul endroit, au milieu d'une page de 2,6 écrans.
- **Un onglet trop léger se corrige en déplaçant ce qui est mal rangé ailleurs**, pas en renonçant.
  « Signaler un problème » vivait dans le panneau Sécurité, où il n'avait rien à faire : devenu le
  panneau « Aide et dépannage », il fait passer le troisième onglet de 0,46 à 0,7 écran. Le
  déséquilibre mesuré était le symptôme d'un mauvais rangement, pas d'un mauvais découpage.
- **`reglages.js` savait déjà faire les onglets** : `installer()` accepte `nomOnglet` /
  `ouvrirOnglet` / `ongletCourant`, et `montrer(pid)` ouvre l'onglet du panneau AVANT de le faire
  défiler. L'app cabinet ne lui passait simplement rien. Les trois rappels vont **ensemble** : n'en
  donner que deux laisse la bascule silencieusement inerte, et on atterrit sur le bon panneau dans un
  onglet masqué — c'est-à-dire nulle part. Un test l'exige.
- **Tous les panneaux restent dans le document, masqués — jamais dessinés paresseusement.**
  `drawBackupPanels()` sort en silence si ses trois panneaux manquent : un onglet rendu à la demande
  les laisserait sur « Chargement… » pour toujours, sans une erreur dans aucune console.
- **Ce qui traverse un onglet doit l'ouvrir** : `refus()` sur un champ masqué, la pastille de mise à
  jour, le chemin de récupération après perte du fichier, les gestes des articles d'aide, les entrées
  de palette. Tous passent maintenant par `versReglages(panneau)`, qui pose l'onglet et la cible puis
  redessine si l'on y est déjà (piège 7.15.0).
- **Restaurer une clé de secours compte comme en avoir une.** Sans ça, le poste neuf reprochait sa
  clé à quelqu'un qui venait de la restaurer depuis sa clé USB : « le pire défaut est celui qui punit
  quelqu'un qui a tout bien fait » (6.8.1). La date retenue est celle du fichier (`creeLe`), pas
  celle du geste.
- **Le jumeau manquant, encore.** L'app entreprise a `TODO_ACTIONS` + un test de couverture depuis la
  7.0.0 ; le cabinet n'avait ni l'un ni l'autre, et ses cinq lignes de « À faire » portaient le MÊME
  lien en dur vers les Relances — « une échéance approche » y envoyait aussi, alors que sa page est
  Échéances. Un bouton qui marche mais se trompe de page ne se remarque jamais. Une règle apprise
  d'un côté se vérifie de l'autre, à la main (règle 7.3.0).
- **Le contrôle « Paramètres → X nomme un onglet qui existe » n'avait pas de jumeau « Réglages → ».**
  Une phrase de l'assistant nommait déjà « Réglages → Sécurité », un onglet qui n'a jamais existé.
- Piège d'e2e, la cinquième fois : six endroits du parcours cabinet cliquaient un bouton désormais
  dans un onglet masqué. La parade est toujours la même — `ouvrirReglages(panneau)` reconnaît
  l'onglet à ce qu'il **contient** (`closest('[data-pane]')`), jamais à son rang ni à son
  identifiant. Et l'assertion de `e2e:perte` qui ne testait que le hash exige maintenant que le
  panneau soit **visible** : on peut être sur la bonne page et sur le mauvais onglet.
- Piège de test rencontré : `new RegExp(\`panneauReg\\\\('${id}'\`)` dans `run-tests.js` casse le
  fichier. Une concaténation de chaînes fait le même travail sans le risque.

## 7.33.0 — Les offres, et l'éditeur qui vend depuis sa propre application

Skander : « l'étape d'après c'est de mettre en place la licence… l'essai de 30 jours, générer des
clés, limiter les fonctionnalités quand t'es indépendant », puis « un petit programme qui génère les
clés, fait la facture, avec un historique… protégé dans un repo privé ». Le site (`skanfact-site`,
page Tarifs) annonce : Essai 0 DT · Indépendant 390 DT HT/an · Entreprise 690 DT HT/an, 20 % la
première année si un cabinet parraine.

**Le programme demandé existait déjà : c'est SkanFact.** Une vente de licence est une facture comme
une autre — journal des ventes, TVA collectée, paquet du comptable. Un programme à part aurait refait
la facturation et laissé la comptabilité de l'éditeur fausse. D'où un module **Éditeur** dans l'app
entreprise, visible seulement sur le poste où vit la clé privée (`~/.skanfact/licence-privee.pem`,
ou `SKANFACT_DOSSIER_CLES` pour les tests). Et « repo privé » ne protège rien : **le secret n'est pas
le code, c'est la clé** — le code qui signe tient en une ligne, celui qui vérifie est public depuis
la 6.4.0.

La séquence d'armement, en quatre gestes : (1) 7.33.0 publiée, désarmée ; (2) Skander clique
« Créer mes clés » ; (3) il colle la clé PUBLIQUE dans la conversation ; (4) on la commite dans
`build/licence-public.json`, on retourne le test qui exige son absence, on publie **8.0.0** — ce
jour-là chaque installation a 30 jours. Entre (2) et (4), son propre poste est armé avec sa clé (il
la déduit de la privée) et il voit ce que verront ses clients.

Règles apprises, à ne pas recasser :

- **`build/` n'était pas dans les `files` d'electron-builder** : `build/licence-public.json`
  n'aurait jamais été embarqué, et l'app installée serait restée libre quoi qu'on commite. Le seul
  chemin où la licence ait jamais pu se verrouiller était `npm start`. Le motif est un **glob**
  (`build/licence-public*.json`) : son absence ne fait pas échouer la construction. Un test le tient.
- **L'offre voyage DANS la clé signée**, et une clé sans offre (d'avant) ou avec une offre inconnue
  vaut Entreprise : en cas de doute on ouvre. `reserves` ne porte que sur la CRÉATION : les modules
  fermés gardent leur entrée dans la barre (avec un cadenas), leur page, leur lecture, leur export.
  Ne jamais passer par `moduleOn` : l'offre ne masque rien.
- **Statistiques vit dans le module Pilotage et ne crée rien** : elle reste ouverte. Le blocage se
  décide par module + `p.id !== 'stats'`, jamais par « le module entier ».
- **`licenceBlock(what, module)` est la porte unique**, et elle va DANS le formulaire, sur la branche
  création (`!supplier &&`), parce que `supplierForm`, `projectForm`, `assetForm` s'ouvrent depuis
  plusieurs pages (règle 7.29.0). Le test de 6.4.0 exigeait « au moins quatre » appels et n'a jamais
  vu deux créations sans garde-fou (« Dupliquer » un achat, « Établir n bulletins ») ; il nomme
  maintenant chaque point de création. Et sa regex ne voyait que la forme à un argument : **un appel
  à deux arguments lui échappait en silence** — on compte aussi les appels bruts.
- **L'essai compte depuis l'armement SUR CE POSTE** : `armedAt` (app-config.json) est écrit la
  première fois que l'application y voit une clé publique, et l'essai part du plus tardif de
  `installedAt`, `armedAt` et `createdAt` de la clé. La date de fabrication de la clé ne suffit pas :
  la version qui l'embarque peut arriver des semaines après le keygen. `installedAt` est écrit depuis
  la 6.4.0, donc sans ce garde-fou toute installation de plus de trente jours se serait verrouillée
  à la minute de la mise à jour.
- **La clé de licence vit DANS LE DOSSIER de l'entreprise** (`<dossier>/licence.json`), plus dans
  `userData` : un ordinateur ouvre plusieurs entreprises, et une clé est émise pour UN matricule —
  au niveau de l'ordinateur, la clé du premier dossier verrouillait le second (« autre entreprise »).
  Une clé rangée par la 6.4.0 dans `userData` n'est reprise que pour le dossier dont le matricule
  correspond. Un dossier partagé (iCloud) emporte sa clé : c'est ce qu'on veut pour « trois postes ».
- **Un renouvellement part de la FIN de la licence en cours** quand elle est encore future
  (`depuis` transmis à `licence:emettre`, durées relues à l'ouverture du formulaire avec
  `editeurStatus(depuis)`) : « À faire » réclame le renouvellement trente jours avant, et ces trente
  jours sont payés. La remise de parrainage (« première année ») repart à zéro au renouvellement.
- **Une licence expirée ne barre pas le partage d'un dossier** : partager n'est pas créer une pièce.
  `partagerDossier` ne juge que l'offre (`!licence.locked && licenceBlock(…, 'partage')`). C'est le
  contradicteur qui l'a vu : `licenceBlock` teste `locked` avant l'offre, pour tout module.
- **La clé est attachée au matricule** (cœur : sept chiffres + lettre, ponctuation et suffixes
  ignorés), et un côté vide ne compte pas — on ne punit pas qui n'a pas rempli sa fiche. Le
  matricule vit dans les données du renderer : il VOYAGE avec `licence:status` et `licence:set`, et
  l'état se relit après le chargement du dossier et après chaque fiche société enregistrée (« un
  état lu une fois au démarrage se périme », 7.1.x). `licence:set` refuse la clé d'une autre
  entreprise en nommant les deux matricules, plutôt que de l'enregistrer et d'afficher « autre ».
- **La clé privée ne traverse jamais le pont** : `licence:emettre` reçoit les champs, signe dans
  main.js, rend `SKAN1.…`. `editeur:status` rend la publique, le chemin, `armee` (la clé embarquée
  existe) et `correspond` (c'est la sienne) — sans elle, l'éditeur ne saurait pas si ses licences
  valent chez ses clients ou seulement chez lui. Un test relit chaque `lirePrivee()` de la section.
- **Un mois de licence est un mois du calendrier** (`addMonths`, 31 janvier + 1 mois = 28 février),
  pas 30,44 jours ; les durées arrivent à l'écran avec la date qu'elles donnent AUJOURD'HUI, calculée
  une seule fois dans licence.js. « À vie » = pas d'`exp`. Une date libre doit être future.
- **Émettre fait trois choses dans le même geste** : la clé, un BROUILLON de facture (`newDocument`,
  jamais `nextNumber`), la ligne d'historique (`data.licences`, dans `MERGE_LISTS` sinon le poste
  perdant les perdrait à la fusion, et vidée par « Tout effacer » comme le reste). Le prix vient du
  catalogue ou d'un champ, jamais du code ; la remise de parrainage se pose sur `doc.discountRate`,
  il n'existe pas de remise par ligne.
- **Le mail de licence a son gabarit** (`DEFAULT_EMAIL_TEMPLATES.licence`, FR et EN, avec `{cle}`) :
  sans lui, `emailFor` retombe sur le gabarit de facture. Il ne s'édite dans Paramètres → Envois que
  chez l'éditeur, comme la page Licences, le panneau, l'entrée de palette et la ligne « À faire » :
  chez un client, aucune trace.
- **Renouveler crée une seconde clé et une seconde facture** ; la première porte `remplaceePar` et
  sort de « À faire » sans disparaître. `licenceRows` trie : à renouveler, expirées, actives, à vie.
- **La porte « Tu édites SkanFact ? Créer mes clés » n'existe que sur une application NON armée**
  (`licence.state === 'libre'`) : le jour où la clé publique est embarquée, plus aucun client ne la
  voit. `scripts/licence.js --keygen` n'écrit plus `build/licence-public.json` : armer tout le monde
  est une décision (copier le fichier public, le commiter), jamais l'effet de bord d'un keygen — et
  un test exige l'absence du fichier tant que ce n'est pas décidé.
- **Ce que la relecture adversariale a trouvé après coup** (sept angles, un contradicteur par
  constat, 40 constats bruts) : le renouvellement qui repartait d'aujourd'hui, le partage barré par
  une licence expirée, l'essai compté depuis le keygen, la clé au niveau de l'ordinateur, Cmd+K qui
  proposait le panneau Éditeur à tout le monde (`visible` dans SETTINGS_PANNEAUX, filtré par
  `reglagesDePalette`), « Enregistrer la clé » comparée au matricule ENREGISTRÉ et non à celui du
  formulaire (`enregistrerEnCours()` d'abord), une clé collée effacée par un redessin du panneau, le
  stock de départ du catalogue qui crée un mouvement sans garde-fou, le libellé « Trésorerie,
  marges, statistiques » sur un bandeau qui laisse les Statistiques ouvertes (`LIBELLES_OFFRE`), le
  mail qui annonçait une facture jointe quand rien ne l'était (`{facture}` conditionnel), une
  licence déjà renouvelée qu'on pouvait renouveler encore, `normMatricule` qui prenait le code TVA
  (« /A ») pour la lettre-clé, le 30 février accepté comme date de fin (`dateValide`), et le prix
  saisi « 390 » qui devenait 390 € sur la facture d'un client réglé en euros (le champ nomme la
  devise de la société, et la facture de licence reste dans cette devise). Le test « ce que la
  relecture adversariale a trouvé » tient chacun. Les contradicteurs ont aussi jugé les TESTS :
  un contrôle sur le seul caractère qui suit `lirePrivee()` laissait passer `String(lirePrivee())`
  (le contexte entier est jugé désormais), une assertion e2e à précédence `||`/`&&` qui acceptait
  n'importe quel identifiant, un « pas de cadenas sur Statistiques » vrai faute de lien (le métier
  choisi n'affichait pas le module), et un refus testé par le pont au lieu de l'écran. À refaire sur
  toute version qui touche à de l'argent ou à une clé.
- Piège d'e2e : ce que « Copier la clé publique » met dans le presse-papiers est le fichier JSON
  entier (les retours à la ligne y sont échappés) — comparer les champs après `JSON.parse`, pas le
  texte. Et la clé privée de l'e2e vit dans `SKANFACT_DOSSIER_CLES` : jamais dans le vrai
  `~/.skanfact`, qui appartient à l'éditeur — le harnais pose un dossier vide par défaut pour TOUS
  les parcours, sinon ils tourneraient armés sur le Mac de l'éditeur.

## 8.0.0 — La licence est armée

Skander a créé ses clés dans SkanFact (7.33.0) et collé la clé PUBLIQUE dans la conversation. Elle
vit dans `build/licence-public.json` — **ne jamais la supprimer, la régénérer ni la remplacer** (voir
« Règles de travail »). La clé privée est dans `~/.skanfact/licence-privee.pem` sur son Mac, avec
une copie qu'il a mise à l'abri ; aucune session Claude ne l'a jamais vue et ne doit jamais la voir.

Règles apprises, à ne pas recasser :

- **Celui qui signe n'achète pas.** Armer l'application armait aussi le poste de l'éditeur : au
  trente-et-unième jour, Skander aurait été verrouillé chez lui, avec une clé qu'il ne pouvait
  s'émettre qu'en se déclarant client de lui-même (le formulaire exige un client). L'état `editeur`
  (licence.js) n'a ni essai ni verrou ; il ne vaut que si la clé privée du poste **correspond à la
  clé publique en vigueur** (`editeurDeLaCleEnVigueur()` dans main.js) — une autre clé privée (un
  second éditeur, une clé recréée par erreur) ne donne aucun passe-droit. Une clé COLLÉE est jugée
  avant et reprend le dessus : c'est ainsi qu'il voit exactement ce que voit un client, et « Retirer
  la clé » le ramène à son état. Deux `correspond` existent et ne disent pas la même chose :
  `editeurStatus().correspond` compare à la clé EMBARQUÉE (l'état du panneau : armée avec cette clé /
  avec une autre / en attente), `editeurDeLaCleEnVigueur()` à la clé EN VIGUEUR (le passe-droit).
- **Le test qui exigeait l'absence du fichier est retourné, pas supprimé** : il exige sa présence,
  qu'il soit une vraie clé Ed25519 lisible, sans clé privée dedans, et qu'une licence signée par
  n'importe quelle autre clé privée soit refusée avec lui. « On teste l'interrupteur, pas la
  position dans laquelle il est » (7.26.0) — ici la position a changé, et le test avec elle.
- **Le paquet a été OUVERT avant de dire que la clé est embarquée** : `electron-builder --linux dir`
  puis `asar list` / `asar extract-file` sur `app.asar`. La 7.33.0 avait appris que `build/`
  n'entrait pas dans le paquet ; un glob dans `build.files` ne se vérifie qu'en regardant dedans.
- **Un test qui a besoin de l'application DÉSARMÉE ne déplace pas le fichier du dépôt** : il passe
  par `SKANFACT_CLE_EMBARQUEE` (un chemin qui n'existe pas), honoré **en développement seulement**
  (`!app.isPackaged`) — une application installée lit toujours sa propre clé, quoi que dise
  l'environnement, et un test relit la garde. Tous les autres e2e tournent désormais armés, en essai,
  comme chez un client : c'est l'état qu'il faut tester, pas un état qui n'existe plus.
- **L'armement se prouve dans les DEUX sens** : `e2e:licence` ouvre une application désarmée pour
  fabriquer des clés d'essai, PUIS une seconde telle qu'un client l'installe — essai de 30 jours,
  aucune trace de l'éditeur, plus de porte « Créer mes clés », et la clé signée par la clé d'essai
  REFUSÉE (« pas reconnue »). Sans la seconde moitié, rien ne prouverait que la clé embarquée est
  celle de Skander et pas celle du test.
- **Un test de source ancré sur une tranche se périme quand une fonction déménage.** Sortir la
  déduction de la clé publique dans `clePubliqueEditeur()` (avant `editeurStatus`) a fait tomber
  « la clé privée ne traverse jamais le pont » : la tranche ne voyait plus que deux lectures. Les
  lectures de `lirePrivee()` sont maintenant jugées sur TOUT main.js, et chacune doit vivre dans la
  section éditeur — prouvé en posant une lecture dans `licence:status`.
- **Ce que la relecture adversariale a trouvé avant la publication** (six angles, 22 constats ; les
  contradicteurs ont été coupés pour épargner le quota — chaque constat retenu a été vérifié à la
  main dans le code, corrigé, et prouvé en réintroduisant le défaut) :
  - **Une clé publique ne se lit jamais dans un fichier qu'on ne signe pas.** `clePubliqueEditeur()`
    croyait `licence-publique.json` dès qu'il portait un `publicKey` : recopier la clé de SkanFact
    à côté d'un `.pem` quelconque donnait le passe-droit de l'éditeur. Elle est DÉDUITE de la
    privée, toujours ; le fichier ne porte que la date, et se réécrit s'il ne correspond pas.
    `e2e:licence` rejoue l'imposture (étape 9).
  - **Un relais qui ne peut pas vérifier ne refuse pas.** Sans `LICENCE_PUBLIC_KEY`, le worker
    répondait 403 à toute application qui présente une clé — c'est-à-dire à chaque client qui a
    PAYÉ, dès qu'il collait sa clé. Il laisse passer (le secret suffit), et ne dit « mal réglé »
    (503) que si `LICENCE_REQUISE=1`. Poser la clé publique sur Cloudflare reste à faire par
    Skander, ce n'est plus bloquant.
  - **Changer de flux, c'est aussi retirer les en-têtes de l'ancien** : `feedGithub` remet
    `requestHeaders` à null, sinon le secret de l'application et la clé de licence partaient vers
    GitHub après un repli.
  - **Une phrase rassurante se vérifie contre le code** : « SkanFact n'envoie jamais ta clé nulle
    part » était fausse depuis la 6.7.0 (elle est présentée au relais). La phrase dit maintenant où.
  - **Un état lu une fois au démarrage se périme (7.1.x), encore** : l'essai ne se terminait jamais
    tant que l'application restait ouverte. Relu toutes les heures et au retour au premier plan.
  - **Une licence payante qui finit se dit dans la barre**, pas seulement dans un panneau que
    personne n'ouvre : bandeau à quatorze jours.
  - **« Retirer » doit retirer partout** : la clé héritée de la 6.4.0 (`userData/licence.json`)
    ressuscitait au prochain appel ; et le message annonçait « Licence enregistrée ».
  - **L'essai est compté par ORDINATEUR** (app-config.json) et la clé par DOSSIER : un second
    dossier créé après la fin de l'essai s'ouvre verrouillé — c'est voulu, et le message le dit.
    La date d'armement est doublée dans `<dossier>/licence.json` (la plus ancienne fait foi) :
    effacer app-config.json en gardant ses données ne rejoue plus l'essai. Reculer l'horloge ou
    réinstaller sans ses données le rejoue : accepté, l'application est en source ouverte.
  - Constats laissés de côté sciemment : `todoList` n'a pas de ligne « ta licence se termine »
    (le bandeau suffit) ; la tranche du test de la clé privée a été resserrée en deux morceaux sans
    handler étranger, plutôt qu'élargie.
### 8.0.1 — un essai qu'on ne voit pas est une surprise, pas un essai

Skander, avant d'installer la 8.0.0 sur son PC Windows : « vu que j'avais déjà passé l'assistant,
rien ne me dit qu'il y a un essai de 30 jours ; si je ne vais pas dans les Paramètres, ça devrait se
voir dans le menu à gauche ou quelque part, pour ceux qui sautent l'assistant, non ? » Il avait
raison : `licenceBanner` ne montrait la pastille qu'à **sept jours** de la fin. Pendant vingt-trois
jours, une installation neuve n'annonçait nulle part qu'elle était en essai — ni que le logiciel se
paie. On l'apprenait le trente-et-unième matin, verrouillé.

- **Une échéance qui verrouille se voit depuis le premier jour, pas depuis le dernier.** C'est la
  règle « aucun message brut ne remonte à l'écran » (7.26.0) vue de l'autre côté : ce qui ne se dit
  nulle part est aussi grave que ce qui se dit mal. Et c'est la même famille que « un moteur sans
  écran n'existe pas » (7.3.0) — ici l'essai existait, il n'avait simplement aucun écran.
- **Trois tons, pas deux, parce que l'autre travers serait le nagware.** Un bandeau qui crie
  « 28 jours restants » tous les matins cesse d'être lu, et emmène avec lui ceux qui comptent :
  `calme` (gris, à peine plus marqué que le numéro de version) pendant l'essai, `attire` (orange) la
  dernière semaine ou quatorze jours avant la fin d'une licence payante, `alerte` (orange, avec le
  chemin) quand la création est bloquée. Un essai à cinq jours en vert d'eau ressemblait à une bonne
  nouvelle.
- **Rien ne s'affiche quand il n'y a rien à dire** : `libre`, `editeur`, une licence à vie. Une
  pastille sur un état sans échéance serait un mensonge.
- **La décision vit dans `core.pastilleLicence(licence)`**, pure et testée sur de vraies valeurs ;
  le renderer ne fait que la poser. Un test relit `licenceBanner` et interdit qu'il rejuge
  `daysLeft` lui-même : sans ça, la logique repartirait vivre dans app.js et le test de la règle ne
  prouverait plus rien de ce qui s'affiche.
- **L'assertion e2e qui gravait le défaut a été RETOURNÉE, pas supprimée.** `e2e:licence` exigeait
  « à 30 jours d'essai, aucun bandeau ne doit encore s'afficher » : elle décrivait l'état du jour, pas
  la règle — troisième occurrence du motif après `barre-laterale.js` (7.12.0) et le champ jeton
  (7.26.0). **Quand une règle change, c'est le test qui se relit en premier.**
- Prouvé dans les trois sens : la pastille redevenue muette fait tomber le test unitaire, le renderer
  qui rejuge les jours fait tomber le test de source, et le défaut réintroduit fait tomber l'e2e.

### 8.1.0 — un ordinateur qui dort n'est pas une application qui gèle

Skander, photo d'écran de son PC au réveil : « quand l'ordi ou le Mac se met en veille, ça m'affiche
ça, ce qui n'est pas correct non ? » — **SkanFact s'était bloqué. L'application n'a plus répondu
pendant 464 secondes.** Rien n'avait gelé : la machine dormait.

- **Le chien de garde mesure un silence ; il doit d'abord se demander si le monde tournait.** Pendant
  la veille, le renderer ne répond plus parce que TOUT est suspendu. Au réveil, `Date.now() - lastPong`
  valait 464 s, le gel était déclaré, la page rechargée — et le brouillon en cours perdu, ce que la
  fenêtre annonçait elle-même. Un filet qui punit quelqu'un pour avoir refermé son portable est un
  piège (même famille que le module qui se rallumait tout seul, 7.12.0).
- **Les DEUX parades, jamais une seule.** `powerMonitor` (`suspend`/`resume`) donne le signal franc,
  mais il n'arrive pas partout (hibernation, machine virtuelle, certaines fermetures de capot) ; le
  **saut d'horloge** — le temps réellement écoulé entre deux battements, comparé au pas voulu — est
  celui qui se déclenche tout seul. Règle de la 6.7.2 : « un chemin de secours ne sert que s'il se
  déclenche tout seul ».
- **Le saut d'horloge discrimine proprement**, et c'est ce qui le rend légitime : un gel du RENDERER
  n'empêche pas le minuteur du processus principal de battre toutes les trois secondes. Un battement
  qui en a sauté vingt dit donc la veille, jamais l'interface bloquée.
- **Et le réveil a droit à un délai** (`WATCHDOG.reveil`) : l'interface met un instant à reparler,
  la juger dans la seconde reviendrait à recréer le défaut un cran plus loin.
- **Le jumeau manquant, encore.** L'app Cabinet avait le saut d'horloge **depuis la 6.8.1** — écrit
  pour son processus principal occupé, il attrapait la veille par ricochet. L'app entreprise ne l'a
  jamais reçu. C'est très exactement pourquoi la capture vient du poste client et pas du cabinet.
  *Une règle apprise d'un côté se vérifie de l'autre* (7.3.0) : celle-ci ne l'avait pas été.

Livré en même temps, sur ses demandes :

- **« Proposer une amélioration »**, à côté de « Signaler un problème », dans l'Aide et les Paramètres
  des DEUX applications. L'application savait recevoir ce qui ne marche pas et n'avait aucune porte
  pour ce qui manque, alors qu'elle est écrite par une seule personne. Elle n'emporte **ni journal ni
  état du portefeuille** : une idée n'a pas de pile d'appels, et joindre le journal « au cas où »
  serait prendre des données sans raison — c'est la différence assumée avec le signalement. Deux
  questions, et l'ordre compte : ce qu'on aimerait faire, PUIS comment on s'en sort aujourd'hui. **La
  seconde est celle qui apprend quelque chose** : on propose toujours une solution, et la solution
  imaginée est rarement la meilleure.
- **L'empreinte d'un cabinet se vérifie** (`core.empreinteCabinet`, `core.licencesDuCabinet`, purs et
  testés). Ce qu'on peut prouver : la forme (vingt caractères hexadécimaux) et le fait que ce cabinet
  ait déjà parrainé quelqu'un. Ce qu'on ne peut PAS : qu'il existe — il faudrait sa clé publique.
  **L'écran le dit au lieu d'afficher un vert rassurant** : « 7 pièces vérifiées, intactes » est la
  seule affirmation rigoureuse (Cabinet 1.0.0), et celle-ci suit la même règle. La normalisation
  retire les **séparateurs** et exige vingt caractères hexadécimaux — retirer tout ce qui n'est pas
  hexadécimal aurait avalé un « G » tapé pour un « 6 » en décalant le reste, rendant la faute
  invisible au lieu de la nommer.
- **« + Nouvelle prestation » dans le combo du catalogue** du formulaire d'émission. Le combo des
  clients proposait « + Nouveau client » depuis toujours, celui du catalogue non — et l'éditeur, qui
  n'a aucune prestation de licence au premier jour, retapait son prix de mémoire à chaque émission.
  **Les DEUX moitiés sont nécessaires** : `combo()` dessine l'entrée, `bindCombo` branche le geste ;
  une seule des deux et le bouton n'apparaît pas, ou apparaît sans rien faire. Et `catalogForm`
  rappelle `done(null)` quand on SUPPRIME depuis sa fenêtre : sans la garde, le formulaire planterait.
- **Une classe CSS utilisée et jamais définie ne se voit nulle part.** `class="mono"` était posé sur
  l'empreinte du cabinet depuis la 6.2.0 ; `.mono` n'existait pas dans la feuille de style. Elle
  s'affichait dans la police du texte, à l'endroit précis où la chasse fixe sert à distinguer un `0`
  d'un `O`. Même famille que le `th.r` (7.23.0) et `.help-fil` (7.27.0) : le HTML est juste, c'est la
  feuille de style qui décide.
- Piège rencontré : l'étoile des champs obligatoires est posée par `.field.obligatoire > span:first-child::after`.
  Un libellé écrit en **nœud texte nu** ne la reçoit pas. Et le `modal()` de l'app cabinet ne pose pas
  la légende « * obligatoire » (mécanisme propre à l'app entreprise, 7.20.0) : plutôt qu'une
  convention à moitié appliquée, l'obligation s'y écrit en toutes lettres.
- Piège de test : `indexOf` sur `bindCombo($('[data-combo=itemId]'` attrapait le **premier** des
  trois combos de ce nom et donnait une tranche de 268 000 caractères. Une tranche se prouve par sa
  taille avant d'être jugée (7.21.0). Et une assertion sur du texte source doit tenir compte des
  **apostrophes échappées** : `/n'a encore/` ne correspond pas à `n\'a encore`.

### 8.2.0 — Le cycle de vie d'une licence

Skander, après avoir émis sa première licence de test : « le code doit être écrit quelque part non ?
quand je fais émettre ça me renvoie vers la facture et après je suis obligé de revenir dans licence
pour l'envoyer, c'est pas intuitif » ; « j'aimerais upgrade une licence sans forcément en envoyer une
autre » ; « imagine des gens veulent se rétracter, il faut pouvoir révoquer cette clé et rembourser
la facture, il me faut tout un système de gestion ».

**La limite à connaître avant tout le reste : une clé livrée ne se reprend pas.** La licence est
vérifiée sur le poste du client, hors ligne, contre la clé publique embarquée. Il n'existe aucun
serveur à interroger, donc **rien ne peut faire cesser de fonctionner une clé déjà envoyée**. C'est
le prix de la promesse inverse — celle qui fait la valeur du produit : le client travaille sans
connexion, et l'application lui survit même si son éditeur disparaît. Décision prise avec Skander :
on ne coupe PAS non plus les mises à jour d'une clé révoquée (règle 6.7.0, « une licence expirée
reçoit quand même les corrections de bugs »).

- **« Révoquer » dit donc trois choses vraies, et une quatrième qu'il refuse de cacher** : la licence
  sort des actives avec son motif et sa date ; la facture émise se corrige par un **avoir** (jamais
  une suppression) ; et **la clé continue chez le client jusqu'à sa date de fin**, ce que la fenêtre
  écrit en orange avec le pourquoi. Un bouton qui prétendrait couper serait un mensonge, et c'est
  exactement le genre d'affirmation que cette application s'interdit (« 7 pièces vérifiées,
  intactes », Cabinet 1.0.0). Un test exige ces phrases dans la fenêtre.
- **Un geste finit là où il se termine vraiment.** `montrerCle` remplace `navigate('#/doc/' + inv.id)` :
  la CLÉ est le produit, la facture est une conséquence. Même famille que « un bouton principal
  propose le geste SUIVANT » (7.19.0).
- **Le prorata, parce que refaire payer une année fait refuser la montée en gamme.**
  `core.prorataOffre` : la date de fin ne bouge pas, on facture la différence sur les jours restants.
  Une licence **à vie** n'a pas de fin sur laquelle répartir — `jours`/`total` valent `null` pour que
  l'écran le DISE au lieu d'afficher un ratio inventé. Et une « montée » vers moins cher ne rend
  jamais d'argent toute seule : un remboursement est une décision, il passe par un avoir.
- **Ce qui est dans la charge signée ne se modifie pas à distance** — l'offre ET le matricule. Les
  deux gestes signent donc une clé neuve ; ce qui change, c'est ce qu'ils facturent : la différence
  au prorata pour l'offre, **rien** pour un matricule corrigé (cette licence est déjà payée, et la
  facture reste attachée à la ligne remplacée, sinon « À faire » en réclamerait une seconde).
- **`LICENCE_MOTIFS` : trois gestes, trois libellés.** Renouvellement, changement d'offre et
  correction de matricule produisent tous un `remplaceePar` ; les montrer tous comme « Renouvelée »
  ferait mentir la colonne.
- **Trois manques d'argent que personne ne voyait** (`core.licencesAFaire`) : clé jamais envoyée,
  facture restée en brouillon, licence livrée et impayée. Chaque ligne pose une **vue** de la liste
  (`licState.tri`) au lieu d'ouvrir cent licences — règle 7.15.0 — et « Réinitialiser les filtres »
  doit pouvoir en sortir, sinon la vue est un piège.
- **`invoiceBalance(doc, data, company)` et `effectiveStatus(doc, data, company, today)` prennent la
  société en TROISIÈME argument**, jamais lue dans `data`. L'oublier ne lève rien à l'appel : ça
  plante plus loin dans `computeTotals` sur `company.stampFee`. `licenceSuivi` la prend en option
  avec un repli sur `data.company`.
- **Un compteur rafraîchi par EFFET DE BORD d'une navigation disparaît avec elle.** Le compte de la
  barre latérale se mettait à jour parce qu'on partait sur la facture ; en finissant sur la clé, une
  licence émise à l'instant n'était comptée nulle part jusqu'au prochain changement de page. C'est
  `e2e:licence` qui l'a vu — jamais la relecture. `redessinerBarre()` après chacun des quatre gestes.
- **Deux assertions gravaient le défaut, retournées** (quatrième et cinquième occurrence du motif) :
  le test de source exigeait `navigate('#/doc/' + inv.id)`, et l'e2e attendait `#/doc/…` après
  l'émission. **Quand une règle change, c'est le test qui se relit en premier.**
- Piège de test : **`lireApp()` RETIRE les commentaires de ligne** — une tranche ne peut jamais
  s'ancrer sur un commentaire, seulement sur du code. Mon ancre `// ---------- le cycle de vie…`
  donnait `indexOf` = −1, donc `slice(x, -1)`, donc 56 000 caractères au lieu de 3 000.
- Piège de test, re-rencontré : une assertion qui recopie une ligne de menu mot pour mot
  (`/peut && !r\.remplaceePar \? \{ icon: 'contrat', label: 'Renouveler'/`) tombe dès que l'entrée
  gagne un garde-fou, et se « répare » en recopiant la nouvelle ligne — donc sans rien prouver. On
  extrait la LIGNE et on exige la règle qu'elle doit porter (7.16.0).
- Piège de remplacement en masse : `const filtered = !!(s.q || s.st);` existe dans plusieurs routes.
  Un remplacement global aurait touché la page Clients. On borne la zone à la route visée — et
  `s.index('\n  routes.', d)` rend −1 quand la route est la dernière du fichier.

- **`LICENCE_CONTACT` vaut `contact@skanfact.tn`** : la boîte Zimbra Starter du domaine `skanfact.tn`, commandé chez OVH le 14/09/2026 (une seule adresse personnalisée pour l'instant, d'où « contact » et pas « licences »). C'est l'adresse vers laquelle « Demander une licence » et « Signaler un problème » composent le mail. Elle doit exister avant la fin du premier essai (14/10/2026), sinon un client en fin d'essai écrit dans le vide.

### 8.3.0 — La liste propose, elle n'enferme pas

Le frère de Skander a essayé l'application : « leur retenue est de 1 % alors que sur l'app ça
commence à 1,5 ». C'est le premier retour d'un utilisateur qui n'est ni l'auteur ni le propriétaire,
et il a tenu en une phrase.

- **Une liste fermée finit toujours par enfermer quelqu'un.** Les taux proposés sont passés de six à
  onze, mais l'ajout n'était pas le correctif : la **saisie libre** l'est. Un taux réglementaire
  dépend de la prestation, du régime du client et de la loi de finances de l'année — trois choses
  qu'une liste écrite en 2026 ne peut pas suivre. `« Autre taux… »` reprend le mécanisme des unités
  de ligne (2.3.0) : le taux tapé rejoint la liste et **y reste** (`core.usedWithholdingRates`,
  jumeau exact de `usedUnits`). C'est le pendant de la règle de la 5.0.0 — *aucun taux n'est écrit
  en dur dans un calcul* — appliqué cette fois à ce qu'on PROPOSE, pas à ce qu'on calcule.
- **Un select dont aucune option ne correspond retient la PREMIÈRE, en silence.** Trois écrans sur
  six lisaient `C.WITHHOLDING_RATES` à la main. Un client réglé sur un taux hors liste n'avait donc
  aucune option sélectionnée : rouvrir sa fiche pour corriger un téléphone et enregistrer le
  ramenait à « Par défaut », c'est-à-dire **changeait le montant de ses factures**. Rien ne plante,
  rien n'apparaît en console, et la fiche paraît normale. Les six écrans passent par une porte
  unique (`withholdingSelect` / `bindWithholdingFields`, branchée par `modal()` et `render()` comme
  `bindDateFields`), et un test compte les lectures de la liste : elle ne se lit qu'à un endroit.
- **Une route ASYNCHRONE pose son écran après la fin de `render()`.** Les Paramètres attendent
  `dataPath()` : les deux branchements de fin de dessin travaillaient donc sur la page qu'on venait
  de quitter, et le taux libre y restait inerte — sans une erreur nulle part. `render()` retient ce
  que la route renvoie et rebranche quand la promesse se résout. Les deux fonctions sont
  idempotentes, c'est ce qui rend le rattrapage sûr. Défaut ancien : `bindDateFields` avait le même,
  invisible faute de champ date dans les Paramètres.
- **Une valeur transitoire ne doit jamais atteindre le gestionnaire du dessus.** L'éditeur de
  document relit tout son formulaire à chaque frappe : choisir « Autre taux… » lui faisait écrire la
  chaîne `__autre__` dans la pièce, que `Number(…) || 0` ramenait à **0 %** — une retenue effacée
  pendant qu'une fenêtre demande justement laquelle mettre. On remet l'ancienne valeur **dans le même
  tour d'événement**, avant que le `change` ne remonte ; le taux saisi est ensuite rendu par un
  `change` **relancé**, jamais écrit à la main dans les données (chaque écran a déjà son chemin
  d'enregistrement, le doubler ferait diverger les deux).
- Piège d'e2e, deux fois dans la même heure : **l'éditeur de document travaille sur une `deepCopy`**
  jusqu'à « Enregistrer » — lire la pièce rangée dans `window.__data` juste après un geste ne prouve
  rien, il faut lire ce que l'ÉCRAN affiche (`#totals`) puis enregistrer. Et tout geste qui marque
  l'éditeur « modifié » réveille le garde-fou à la navigation suivante : l'erreur tombe alors trente
  secondes plus tard sur un sélecteur qui n'a rien à voir (7.19.0, re-rencontré).
- Piège de test : `assert` d'un taux hors liste dans `usedWithholdingRates` restait vert avec le
  garde-fou retiré, parce que `Number('') === 0` et que 0 est déjà dans la liste connue. Le seul cas
  que la garde protège vraiment est le taux **négatif** — c'est lui qu'il faut tester.

### 8.4.0 — Le plan de contrôle : plusieurs clés, l'activation, la révocation appliquée

La seule version du chantier qui touche une licence **déjà vendue**. Trois choses, et une règle qui
passe avant les trois : *tout est facultatif*. Sans adresse configurée, sans réseau, sans réponse,
sans clé de réponse embarquée, l'application fonctionne exactement comme avant, **sans un mot à
l'écran**. C'est la règle 1 du § 8 de `PLAN-PLATEFORME.md`.

Règles apprises, à ne pas recasser :

- **Une licence sans `kid` se vérifie avec `master`, et avec elle seule.** C'est le point de
  compatibilité le plus dangereux du projet : toutes les clés vendues depuis la 8.0.0 sont dans ce
  cas, et sans cette ligne la mise à jour les aurait invalidées d'un coup, le même matin. La règle
  vit **des deux côtés** — `choisirCle` dans `src/licence.js` et dans
  `plateforme/skanfact-api.mjs` — parce que le serveur et l'application doivent rendre le même
  verdict. On n'essaie **jamais** toutes les clés à la suite : `kid` en désigne une, et c'est ce qui
  permet de RETIRER une clé compromise au lieu de la laisser valider éternellement.
- **La date qui sert de plancher à l'essai est celle de la PLUS ANCIENNE clé.** Prendre la plus
  récente aurait rouvert trente jours d'essai à tous les clients le jour où la clé du serveur est
  ajoutée — un défaut qui ne coûte rien à écrire et se paie en chiffre d'affaires, sans que rien ne
  le signale.
- **Le serveur ne peut qu'ajouter une restriction déjà prévue, jamais accorder un droit.** Une
  licence expirée le reste quoi que réponde le serveur ; une révocation le ferme. La clé signée
  reste la source de vérité pour fonctionner, et c'est ce qui fait que l'application survit à la
  disparition de son éditeur.
- **Une réponse ne restreint rien tant qu'elle n'est pas signée, datée ET adressée.** Chacun des
  trois répond à une attaque précise : sans la **signature**, n'importe quel intermédiaire (un wifi
  d'hôtel, un pare-feu) répond « révoquée » à un client qui a payé ; sans le **sujet** (l'empreinte
  de la licence), la réponse destinée au client A se rejoue chez B ; sans la **date**, on rejoue une
  vieille réponse pour ressusciter une révocation annulée. `ok: false` est le cas par défaut partout
  dans `verifierReponse` : une réponse qu'on ne peut pas juger est ignorée, jamais transformée en
  refus.
- **Poser et LEVER une révocation exigent la même preuve.** Sans cette symétrie, quelqu'un capable
  de couper le réseau figerait une révocation pour toujours, et l'éditeur n'aurait aucun moyen de la
  reprendre après un remboursement annulé.
- **Le verdict survit à la clé qu'on pose ou retire.** `ecrireLicence` le conserve comme il
  conserve `armedAt` : sinon « Retirer la clé » puis « Enregistrer » lèverait une révocation en deux
  clics. Il ne s'applique qu'à la clé qu'il VISE (`sujet`), donc le garder ne pénalise jamais une
  clé neuve.
- **Ce qui remonte est écrit en toutes lettres, et un test compte les champs.** La clé, le
  `deviceId`, le nom du poste, la plateforme, la version. Rien d'autre — jamais un client, une
  facture, un montant, un chemin de dossier. Un jour quelqu'un voudra « juste ajouter le nom de la
  société pour s'y retrouver » : c'est ce test qui doit l'arrêter.
- **Un essai s'annonce aussi**, sans clé. Sinon aucun essai ne serait visible nulle part, et un
  éditeur qui ne voit pas ses essais ne sait pas s'il a des clients qui arrivent.
- **La clé de réponse se fabrique sur le poste de l'éditeur**, comme les clés de licence en 7.33.0 :
  une clé privée dont l'application dépend n'a rien à faire dans un canal qu'on ne maîtrise pas. Sa
  moitié privée va dans un réglage Cloudflare, sa moitié publique dans
  `build/licences-publiques.json`. Elle ne traverse pas le pont : main.js la met au presse-papiers,
  l'écran n'en reçoit que la confirmation.
- **Créer un CLIENT n'est pas un geste que la licence ferme** — seule une *pièce* l'est. Découvert
  en écrivant l'e2e : sa première version cliquait « Nouveau client » et concluait que la révocation
  ne bloquait rien.
- **Un glob qui a l'air de couvrir ne couvre pas forcément.** `build/licence-public*.json` ne
  correspond PAS à `licences-publiques.json`, et l'application installée serait restée sur l'ancien
  fichier sans que rien ne plante. Le test d'avant comparait le motif à son orthographe du jour ;
  celui d'aujourd'hui l'ÉVALUE contre les deux noms de fichier — c'est ce qui l'a attrapé.
- **`ta()` sans `await` est le même défaut que `t()` avec une fonction asynchrone**, une couche plus
  loin : le test part détaché, son « ok » s'affiche après le total, et une assertion qui tombe ne
  fait plus échouer la commande. J'y suis tombé en écrivant le premier test de ce lot. Le harnais
  compte désormais les `ta` en cours et refuse de conclure s'il en reste.
- Piège de test rencontré : une assertion ancrée sur la PROXIMITÉ de deux lignes tombe dès qu'on
  ajoute un commentaire entre elles. On ancre sur l'ORDRE (`indexOf` successifs).

Le test qui compte est `npm run e2e:plateforme` : il pose **le vrai worker** — le fichier déployé
sur Cloudflare, pas une imitation — derrière un serveur local, et lance l'application réelle en
face. Huit étapes : une clé sans `kid` acceptée, l'activation vue par la plateforme, une révocation
signée qui ferme la création et laisse lecture et export ouverts, la même levée, la même avec un
octet retouché (ignorée), la même rejouée trois mois plus tard (ignorée), le serveur éteint (rien ne
change, aucun message rouge), et une installation neuve qui n'a jamais vu le réseau. Les deux
altérations sont posées dans le **transport** : c'est là qu'un attaquant se place.

### 8.5.0 — P 0.2 : la console vend

Le worker (`plateforme/skanfact-api.mjs`) émet, révoque, renouvelle, change d'offre, marque payée
et envoie la clé par mail (Resend, `send.skanfact.tn`) ; l'application gagne « Créer la clé du
serveur » (`srv-1`) dans le panneau Éditeur. `test/d1-sqlite.js` pose une base D1 sur le SQLite de
Node : les handlers se testent contre le VRAI schéma dans `npm test`, et `e2e:console` fait tourner
le vrai worker dans un vrai navigateur. La 8.5.0 n'embarque PAS encore la publique `srv-1` : elle
viendra avec la clé de réponse, le jour de la mise en production (les deux gestes se font ensemble).

Règles apprises, à ne pas recasser :

- **La clé maître ne va jamais sur le serveur.** `srv-1` est une clé de SECOND rang, fabriquée sur
  le poste de l'éditeur comme les autres (7.33.0, 8.4.0), retirable sans toucher aux licences
  signées par la maître. Le worker VÉRIFIE au premier appel que `SRV_PRIVATE_KEY` et la publique
  `srv-1` de `LICENCE_PUBLIC_KEYS` vont ensemble (`cleServeur`) : une privée collée à côté de la
  mauvaise publique produirait des clés refusées partout, et rien ne le dirait avant le premier
  client. La console affiche « émission impossible » avec la raison, et grise le bouton.
- **On ne range jamais la clé en base, seulement son CONTENU signé** (`licences.charge`). Ed25519
  est déterministe : le même JSON signé par la même privée redonne la même clé à l'octet près.
  « Voir la clé » et « Renvoyer par mail » la refabriquent, et vérifient que l'empreinte obtenue est
  celle que la base suit — sinon une révocation viserait une empreinte que personne ne présente.
- **L'ordre des champs de la charge est celui que l'application écrit** (`chargeLicence`, un test
  fixe la liste) : un champ déplacé change la signature. Format 2 ajoute `kid` et `sub` ;
  l'application ignore ce qu'elle ne connaît pas et n'a pas eu besoin de changer.
- **Une licence remplacée n'est pas une active de plus** : renouveler ou changer d'offre signe une
  clé neuve (`remplace_id`, motif), et la carte « licences actives » les exclut. Trois clés dont deux
  remplacées = une licence active. Le statut se déduit : révoquée, sinon expirée, sinon remplacée,
  sinon active.
- **Marquer payée envoie la clé dans la seconde** (§ 12 du plan), une fois (`envoyee_le`), et
  seulement si le client a une adresse et si Resend est réglé — sinon l'écran dit pourquoi et la
  clé se copie. Le mail porte la MÊME phrase d'activation que le gabarit de l'application, et un
  test la compare. Resend est la SEULE requête sortante du worker ; un test compte les `fetch(`.
- **La révocation dit sa limite en orange** dans le formulaire même : une clé livrée ne se reprend
  pas, l'application ne l'applique qu'à sa prochaine connexion et si sa version embarque la clé de
  réponse. Un motif est obligatoire. Renouveler une révoquée ou une déjà remplacée est refusé (409).
- **Les tests ne rejouent plus le worker, ils le font tourner.** `e2e:console` imitait ses
  réponses avec des lignes écrites à la main : une requête SQL fausse y restait invisible jusqu'à
  Cloudflare. Avec `baseD1()` le SQL s'exécute pour de vrai sur `schema-a-coller.sql` — celui qu'on
  demande à Skander de coller. Le seul faux est Resend, et on vérifie ce qu'on lui aurait envoyé.
- Piège attrapé par l'e2e, invisible autrement : après un formulaire validé avec succès, la page
  réactivait un bouton que `fermerForm()` venait de retirer — TypeError dans une promesse, aucune
  console chez l'utilisateur. On relit l'élément au moment d'y toucher (règle 7.17.0, côté console).
- Piège de test : `contains(@class, "card")` en XPath attrape le conteneur `.cards`, premier dans
  l'ordre du document — et cliquer un conteneur ne fait rien. Trouvé par le délai d'attente.
- Piège de test : une tranche de source bornée sur un voisin NOMMÉ se casse quand on insère un
  handler entre les deux. On borne sur « le `ipcMain.handle(` suivant, quel qu'il soit ».

### 8.5.1 — Le justificatif se joint avant toute saisie

Le père de Skander, première facture d'achat : « Depuis une photo » exigeait un fournisseur et une
ligne, posait « la lecture n'est pas activée, joindre quand même ? », enregistrait, **repartait sur
une page vide**, et la photo n'apparaissait nulle part. Cinq défauts sur un bouton, et aucun ne se
voyait dans un test : ils vivaient dans l'ORDRE des gestes.

- **Une pièce jointe n'a besoin que d'un identifiant, et une pièce neuve en a un.** Exiger
  d'enregistrer (donc de valider) pour accrocher la photo qu'on a sous les yeux, c'est le contraire
  de l'ordre dans lequel on travaille : la photo vient EN PREMIER, la saisie se fait en la
  regardant. La liste vit dans la pièce en cours (`p.attachments`, `doc.attachments`) et part avec
  l'enregistrement ; quitter sans enregistrer retire les copies (`discard` du garde-fou), jamais
  l'original.
- **Deux gestes, deux boutons.** « Joindre un justificatif… » (toujours là, hors ligne, sans
  question) et « Lire une photo… » (caché tant qu'aucune clé n'est activée). Un bouton qui n'a rien
  à proposer que l'autre ne fasse déjà, et qui pose une question pour le dire, est un piège.
- **`render(true)` après avoir rempli `p` jetait `p`.** La route repartait de la pièce rangée, ou
  d'une pièce neuve et vide. `achatReprise` relaie la pièce en cours à la page qui se redessine,
  pour CE hash et une fois. Le défaut existait aussi sur une pièce enregistrée : la lecture d'une
  photo y perdait tout autant.
- **`p.attachments = …` sur une pièce rangée ne suffisait pas** : `p` est une copie, et `save()`
  écrivait les données sans elle. L'écran disait « photo jointe », les données ne la portaient pas.
  On écrit dans les deux, et le panneau lit la même source que `save()`.
- Un correctif d'un éditeur se cherche dans l'autre (7.3.0) : l'éditeur de document avait le même
  « enregistre d'abord », retiré pareil. Et la liste des achats porte un trombone : ce que le
  comptable demande, c'est quelles pièces N'ONT PAS de justificatif.
- Le parcours qui compte est `npm run e2e:justificatif` : le sélecteur de fichier natif est remplacé
  dans le processus principal (`dialog.showOpenDialog`), un vrai fichier est copié, enregistré,
  retrouvé sur le disque et dans la liste ; une pièce abandonnée ne laisse pas de copie ; et la
  lecture d'une photo (via le crochet `skanfact:ocr-demo`) redessine la page SANS perdre la pièce.

### 8.7.0 — Le pont comptable, et la lecture de photo en pause

Skander : « et continue la suite go avec la 8.7 » — puis « enlève la fonction photo ou mets-la en
pause, vu qu'on n'a pas encore l'app sur téléphone ça sert à rien ». Le § 11 de `PLAN-PLATEFORME.md`,
livré : la console vend, SkanFact facture.

- **SkanFact TIRE, jamais la console ne pousse.** Un serveur ne peut pas écrire dans un logiciel de
  bureau éteint. `GET /v1/admin/ventes?non_facturees=1` rend chaque vente AVEC sa clé (refabriquée
  par `cleDeLicence`, jamais rangée en base) ; `POST /v1/admin/ventes/:id/facturee` reçoit le
  numéro à l'émission ; `POST /v1/admin/importer` reçoit UNE fois l'historique de `data.licences`.
- **Le secret d'administration vit à côté des clés** (`~/.skanfact/plateforme-admin.json`, 0600,
  `PONT_ADMIN` dans main.js), jamais dans les données ni dans un dossier partagé — un dossier
  partagé sur iCloud emporterait sinon le droit d'émettre des licences. Il est **essayé au moment où
  on le pose** (`pont:setSecret` appelle `etat`), et **refusé, il rend sa place à l'ancien** : la
  première version le laissait écrit après un refus, et `pont:status` disait « branché » sur un
  secret faux. C'est l'e2e qui l'a vu.
- **`pontRequete` n'accepte que les chemins de l'espace d'administration** (`PONT_CHEMIN`, jamais
  `..`), exige le poste de l'éditeur, envoie le secret en en-tête, et **traduit** : 403 → « refuse ce
  secret », échec réseau → « La console ne répond pas » (le `socket hang up` va dans `main.log`,
  règle 7.26.0).
- **Un brouillon, jamais un numéro** (`creerBrouillonsConsole` : `newDocument('facture')`, jamais
  `nextNumber`), derrière les DEUX garde-fous de création (`demoBlock`, `licenceBlock`). Le client est
  retrouvé par `core.clientPourVente` (les sept chiffres du matricule d'abord, le nom ensuite —
  jamais créé par le cœur, créer est une décision de l'appelant), la TVA par `defaultVat` (le régime,
  pas un 19 en dur), le montant HT est celui de la console tel quel. Une vente déjà tirée
  (`venteConsoleId` présent) ne fait pas deux brouillons.
- **Le numéro est rendu à l'émission** (`issue()` → `annoncerFacturesConsole`) et **réessayé** à
  chaque ouverture de la page Licences (`core.facturesAAnnoncer`) : un échec s'arrête sans crier
  (`catch { break }`), il n'est jamais rouge — la console éteinte n'est pas une panne de SkanFact.
- **Une licence vendue par la console porte `origine: 'console'`** : elle se lit, se copie, sa
  facture s'ouvre ; renouveler, changer l'offre, corriger, révoquer se font DANS la console qui l'a
  signée (le menu de ligne les retire). `licencesAFaire` ne réclame pas son envoi : la console
  l'envoie au paiement, la réclamer ici ferait envoyer deux fois. `envoyeeConsoleLe` compte comme un
  envoi dans `licenceSuivi`.
- **L'historique part UNE fois et nommé champ par champ** : `core.chargeHistorique` est pur, exclut
  ce qui vient de la console, et un test fixe la liste exacte des dix-huit champs — un jour quelqu'un
  voudra « juste ajouter » le client entier. La facture ne part qu'ÉMISE (numéro, net HT remise
  déduite, jour du dernier paiement) ; `data.pontImporte` retient le jour (dans `DEFAULT_DATA`, donc
  remis à zéro par « Tout effacer »). Côté worker, `nettoyerImport` REFUSE avec sa raison au lieu de
  mettre à null : ici on importe des ventes, une vente à moitié importée est pire qu'absente. Le
  client y est retrouvé par matricule puis par nom, les remplacements reliés en second passage
  (l'ordre d'arrivée ne garantit rien), et rejouer l'envoi ne réécrit rien (`dejaLa`).
- **La lecture de photo est en PAUSE, pas supprimée** : `OCR_EN_PAUSE = true` dans app.js. Le panneau
  `p-ocr` n'est plus POSÉ dans les Paramètres (donc ni sommaire, ni recherche — les deux se déduisent
  de l'écran) et sort de Cmd+K (`visible`), `#photo` ne se montre jamais, et l'article d'aide le dit
  en tête. Le code de 4.2.0 reste tel quel pour le jour où une application sur téléphone existera.
  Piège : `visible` dans `SETTINGS_PANNEAUX` ne filtre QUE la palette ; un panneau qu'on veut faire
  disparaître ne se pose pas — c'est `e2e:entreprise` qui l'a montré, le panneau était encore là.
- Piège de test : la tranche du handler `editeur:cleServeurCopier` était bornée sur le
  `ipcMain.handle(` SUIVANT — la section du pont, ouverte par un titre et deux fonctions, s'y est
  glissée. La borne est maintenant la première des deux : handler suivant OU titre de section.
- Piège d'e2e : sans clé Resend, la console n'envoie aucun mail, donc `envoyee_le` reste vide — mon
  assertion « la vente payée a été envoyée » décrivait un service de mail qui n'était pas là. Le
  miroir doit dire ce que la console a FAIT, pas ce qu'elle aurait dû faire.

Le test qui compte est `npm run e2e:pont` : le vrai worker sur SQLite, l'application réelle en état
éditeur (clé privée d'essai dans `SKANFACT_DOSSIER_CLES`, publique embarquée par
`SKANFACT_CLE_EMBARQUEE`), un secret faux refusé et un bon secret gardé en 0600 hors des données,
deux ventes tirées en deux brouillons (Trabelsi retrouvé sous une autre graphie du matricule, El
Amen créée), le menu d'une licence de la console sans « Renouveler », le numéro rendu à l'émission et
lu dans la base, puis la console éteinte qui se dit en français.

### 8.8.0 — Le grand livre et la balance

Le comptable de Skander a regardé l'application : « il manque encore beaucoup de choses
comptables », et deux termes retenus — **mouvement de compte** et **écriture comptable dans le
journal**. Le plan en trois versions : 8.8.0 grand livre + balance, 8.9.0 livre-journal (numérotation
continue, OD à la main, mouvements libres et déclarations en écritures, centralisateur, lettrage),
9.0.0 l'exercice (amortissements, à-nouveaux, résultat, rapprochement par relevé, TFP/FOPROLOS).

- **Tout se DÉDUIT des écritures de `journalEntries`, rien ne se saisit.** `soldesOuverture` calcule
  ce que chaque compte portait la veille de la période : les classes 1 à 5 traversent les années,
  les classes 6 et 7 repartent au 1er janvier et leur passé va au compte `resultat` (13). C'est une
  écriture d'à-nouveau déduite ; la 9.0.0 la rendra explicite (journal AN) SANS la compter deux fois
  — le jour venu, l'implicite doit disparaître au profit de l'explicite, pas s'y ajouter.
- **La balance ne garantit qu'une chose : ses trois paires de totaux tombent juste** (ouverture,
  mouvements, soldes). Un test le vérifie sur les 24 mois du jeu d'exemple et confronte le grand
  livre à la balance compte par compte (même ouverture, même solde, et le solde progressif qui
  finit sur le total). Une balance dont les ventes reportaient 2025 sur 2026 tomberait juste aussi :
  d'où le test séparé « les ventes n'ouvrent pas l'année, la banque si, le résultat porte le net ».
- **Un compte auxiliaire est FIGÉ sur la fiche** (`compteAux`), jamais déduit de la position dans la
  liste au moment de l'affichage : supprimer un client ne renumérote personne. `codesAuxiliaires`
  reste pur (le paquet du cabinet ne modifie rien) et donne le même code que celui qui sera écrit ;
  `numeroterAuxiliaires` l'écrit, à l'activation de la case et à chaque dessin des livres.
- **Les écritures portent `tiersId` et `role`** (`clients` / `fournisseurs`) : c'est ce qui fait la
  balance auxiliaire sans sous-comptes, et ce qui fera le lettrage. `salesJournal`,
  `paymentsJournal` et `supplierPayments` rendent l'identifiant du tiers, pas seulement son nom.
- **Le plan comptable (`PLAN_COMPTABLE`) ne sert qu'à NOMMER** (`accountLabel`, plus long
  préfixe) ; les rôles de `DEFAULT_ACCOUNTS` passent avant, et un sous-compte de tiers porte le nom
  du tiers. Le compte d'immobilisations proposé est passé de 24 à 22 : dans le SCE, 24 est « à
  statut juridique particulier ». Un compte réglé à la main (`data.chartAccounts`) n'est pas touché.
- Piège : le détecteur d'appels inexistants ne voit pas une fonction déclarée par `let a, b;` puis
  affectée dans une branche — `csv()` est passé pour un appel à une fonction absente. On déclare des
  données (`csvRows`, `csvCols`), pas une fonction à trous.
- Piège : `bindCombo` prend `onPick`, pas `onChange` ; `.tabs.sub` et `.scroll-y` n'existent pas
  dans la feuille de style — un nom de classe inventé ne se voit nulle part.

Le test qui compte est `npm run e2e:livres` : le grand livre de l'année (20 comptes, chaque solde
progressif finit sur le total du compte, aucun « Compte hors plan »), le sélecteur qui ne garde que
411, la balance équilibrée avec ses six totaux, l'auxiliaire clients sur le collectif, la case du
plan de comptes qui donne 411001…411008 et les fige sur les fiches, et le grand livre qui suit.

### 8.9.0 — Le livre-journal

Le second terme du comptable. `livreJournal` numérote les pièces de l'exercice (`numerosDuJournal`),
`journalCentralisateur` les totalise mois par journal, `odValide`/`odPiece` tiennent la saisie des
OD (`data.ecrituresOD`), `lettrage` lit ce qui reste ouvert, et `journalEntries` gagne cinq
sources : `ouverture` (soldes de départ, crédit de TVA saisi), `tresorerie` (mouvements libres),
le paiement des bulletins, `declarations` (la TVA du mois au dernier jour) et `od`.

- **Le même argent ne peut pas être à la banque sur une page et en caisse sur l'autre.**
  `journalDeCompte` suit LA règle de `cashMovements` : le compte affecté, sinon le compte par
  défaut, et le mode de paiement seulement s'il n'existe aucun compte. La première version jugeait
  sur le mode (« Espèces » → caisse) : la banque du grand livre et celle de la Trésorerie
  différaient de 361,95 sur l'exemple. Le test exige l'égalité au millime, sur les deux comptes.
- **Une écriture DÉDUITE peut cacher une écriture MANQUANTE.** `journalEntries` sautait les ventes
  dont le statut EFFECTIF est « annulée » — or une facture entièrement couverte par un avoir
  s'affiche ainsi : sa facture sautait, son avoir restait, le client finissait créditeur de 405,6
  sur l'exemple. Personne ne l'avait vu en 6.3.0 : la balance tombait juste (une écriture
  équilibrée en moins reste équilibrée). C'est le **lettrage** qui l'a attrapé — « le reste ouvert
  doit être le solde du 411 » est un contrôle que l'équilibre ne remplace pas.
- **Une OD n'entre qu'équilibrée**, et le refus se fait dans `odValide` (pur, sept motifs testés),
  pas dans la fenêtre : la fenêtre montre l'écart pendant la frappe et appelle la même fonction. Le
  numéro de pièce est pris à l'enregistrement, après `licenceBlock` et `closedBlock` (règle 6.0.0 :
  un refus après `odPiece` trouerait la numérotation).
- **Le numéro dans le journal est déduit, donc mobile sur un mois ouvert** : une pièce datée en
  arrière décale les suivantes. Ce n'est pas un défaut à corriger, c'est la raison d'être de la
  clôture, et la page le dit. Un mois seul reprend les numéros de l'exercice, jamais les siens.
- **La déclaration mensuelle s'écrit avec les chiffres de `vatChain`**, pas avec les soldes du
  grand livre : le crédit imputé vaut `collected − toPay`, donc le 4366 garde exactement le report
  que la chaîne reporte. Le crédit de TVA saisi à la main pour une année entre au 4366 par une
  écriture AN, sinon la première déclaration le créditerait d'un montant qu'il n'a jamais reçu.
- **Un mouvement porte sa contrepartie (`m.compte`) ou la nature décide (`MOVE_ACCOUNTS`)** ; ce
  qu'on ne sait pas ranger va au 471, et c'est écrit dans la bulle : c'est ce que fait un cabinet.
- Le compte 627 est devenu un RÔLE (`fraisBancaires`) : le test du plan qui l'utilisait pour prouver
  le préfixe a basculé sur 626. Un compte qui gagne un rôle porte le nom du rôle.
- L'exemple paie sa TVA chaque mois (`compte: '4365'`) et porte une OD : sans ça, le 4365 grossissait
  pour toujours et le premier comptable demandait pourquoi la société ne paie jamais sa TVA.

`npm run e2e:livres` gagne trois étapes : le livre-journal numéroté et son centralisateur, une OD
refusée à 200 d'écart puis enregistrée OD-2026-002 (le compte 613 nommé « Locations » pendant la
frappe), et le lettrage dont une ligne ouvre sa facture.

### 9.0.0 — L'exercice

Le troisième volet : les à-nouveaux (`anouveaux` dans `journalEntries`), les amortissements et les
cessions en écritures (`amortissements`), les états financiers (`etatsFinanciers`), l'état de
rapprochement (`etatRapprochement`), la TFP et le FOPROLOS dans la paie (`tfpRate`, `foprolosRate`,
`employerChargesOf`). Onglet **Comptabilité → États financiers** ; Trésorerie → Rapprochement gagne
son état ; Paie → Barèmes gagne deux taux.

- **L'à-nouveau se calcule sur les écritures RÉELLES seules**, jamais sur les à-nouveaux
  précédents. Le solde d'un compte de bilan persiste dans les écritures réelles ; le net des
  comptes de gestion de tout le passé va au résultat (13). Recalculer AN(2026) à partir de
  [réelles + AN(2025)] compterait le passé deux fois — d'où `SECTIONS_ECRITURES` sans `anouveaux`
  dans l'appel récursif, et le test qui compare la banque de l'AN au solde réel du 31/12.
- **L'ouverture d'une période se lit depuis le début de son exercice, à-nouveau compris, et jamais
  plus loin.** `soldesOuverture` remontait avant à toute l'histoire (8.8.0, à-nouveau implicite) :
  avec la pièce AN explicite, ce serait le double. Au 1er janvier, l'ouverture est donc 0 et la
  pièce AN apparaît comme mouvement — c'est ainsi qu'un grand livre se présente. Le test de 8.8.0
  qui exigeait « la banque rouvre en ouverture » a été RETOURNÉ (« l'ouverture de janvier est 0, la
  pièce AN porte la banque ») : quand une règle change, c'est le test qui se relit en premier.
- **Une dotation est une écriture d'inventaire : au 31 décembre, jamais avant.** Sur l'exercice en
  cours, le bilan ne la compte pas encore et l'écran le dit (`dotationEnAttente`), pendant que le
  résultat simplifié de l'onglet TVA la compte (`depreciationFor`). Deux chiffres différents sur
  deux onglets doivent s'expliquer l'un l'autre, sinon l'un des deux paraît faux.
- **Un bien saisi à la main entre à sa valeur brute contre le report à nouveau** (comme le solde de
  départ d'un compte, 8.9.0) : sans ça, le 28 s'amortit sur un 22 qui n'existe pas, et l'actif du
  bilan est négatif. Un bien lié à un achat (`purchaseId`) est déjà entré par l'achat.
- **Le prix d'une cession n'est jamais inventé** : la sortie d'actif (28 / 675 / 22) s'écrit, le
  prix arrive par un mouvement avec la contrepartie 775 ou par une facture. Écrire le prix d'office
  au 471 laisserait un compte d'attente que personne ne solde.
- **Les états financiers sont déduits de la balance, pas de la liasse** : rubriques par classe et
  par sens du solde (classe 4 débitrice à l'actif, créditrice au passif ; 28/29 en moins de l'actif).
  Ce qui est garanti et testé : actif = passif, résultat du bilan = résultat de l'état de résultat,
  trésorerie du bilan = `cashPosition`. La page écrit « pas la liasse NCT 01 ».
- **Une charge patronale ajoutée se lit sur la COPIE figée du bulletin** (`employerChargesOf`,
  `c.tfp || 0`) : un bulletin d'avant la 9.0.0 n'en gagne pas après coup, dans le journal non plus.
  L'interface n'additionne plus jamais `cnssEmployer + accident` à la main — un test l'interdit,
  parce que c'est exactement l'addition qui aurait oublié la TFP à trois endroits.
- Piège : `assetYear` rend l'annuité partielle l'année de la cession ; `assetSchedule` rend l'année
  pleine. Le journal prend la première pour cette année-là et la seconde pour les autres, et un test
  vérifie que le 28 du bien cédé est repris en entier.

`npm run e2e:livres` gagne quatre étapes : les états financiers équilibrés avec le même résultat
des deux côtés, l'à-nouveau dans le grand livre de janvier, l'état de rapprochement à écart nul dès
que le relevé égale le solde pointé, et la TFP/FOPROLOS dans les barèmes et le coût d'un brut de 1 000.

## La direction du projet (15/09/2026) — `DIRECTION.md`, puis `PLAN-COMPTABLE.md`

**`DIRECTION.md` prime sur tous les autres plans.** Décisions prises avec Skander : l'objectif est
« zéro ressaisie » entre une PME qui gère dans SkanFact sans connaître la comptabilité et son
comptable qui reçoit ses écritures déjà écrites avec les pièces ; l'app entreprise **s'arrête à la
gestion** (plus aucun écran comptable n'y est ajouté ; ceux de 8.8.0 → 9.0.0 deviennent un module
`compta` désactivé par défaut ET **payant** — option `compta` portée par la clé de licence, porte
unique `optionBlock`, Écritures et le paquet restent libres — masquer, pas supprimer : le moteur
écrit le paquet ; décidé le 15/09/2026) ; le Cabinet devient **le
logiciel de comptabilité du cabinet**, complet, avec ou sans SkanFact chez le client ; le paquet reste
le pont dans les deux sens (licence et signature du client dans le manifeste, questions du cabinet
affichées sur la pièce) ; le Cabinet est **gratuit pour les dossiers sur SkanFact et trois dossiers
hors SkanFact, payant par dossier au-delà** (postes illimités, on vend des dossiers) ; le comptable de
Skander est le cabinet pilote. Les aspects techniques à traiter (licence du cabinet portée par son
empreinte, comptage des dossiers hors SkanFact, `compta.js` partagé avec test de parité des balances,
un fichier par dossier, piste d'audit, multi-poste, questions dans les deux sens, INPDP, Ordre) sont
listés au § 5 de `DIRECTION.md`, l'ordre au § 7, les questions ouvertes au § 8.

Le comptable de Skander a regardé **SkanFact Cabinet**, pas l'app entreprise, et il veut **un vrai
logiciel de comptabilité côté cabinet**, complet, au niveau de Sage/EBP/Pennylane — pas un pont. Le
plan (`PLAN-COMPTABLE.md`) confronte dix domaines (socle, saisie, imports, banque, tiers, éditions,
clôture, fiscal tunisien, cabinet, technique) à ce que le moteur de l'app entreprise sait déjà faire
et à ce que le Cabinet n'a pas, puis découpe en dix versions : **9.1.0** livres lus dans les paquets,
**9.2.0** le livre propre à chaque dossier (plan SCE complet, import du paquet EN écritures, reprise
d'ouverture), **9.3.0** la saisie au kilomètre avec brouillard/validation, **9.5.0** banque et
rapprochement automatique, **9.6.0** déclaration mensuelle tunisienne, **9.7.0** immobilisations
dégressif et stocks, **9.8.0** clôture d'exercice et états SCE, **9.9.0** collaborateurs, multi-poste, piste
d'audit, **9.10.0** révision et questions au client, **10.0.0** liasse et jeu d'exemple complet.
Décisions d'architecture : chaque dossier porte SON livre (les écritures venues d'un paquet portent leur
source et ne se modifient pas ici), le moteur d'écritures sort de `core.js` vers un module pur partagé
`src/renderer/compta.js` que `core.js` réexporte, brouillard puis validation irréversible. Règle qui ne
bouge pas : le Cabinet **n'écrit jamais** chez le client. Les questions à poser au comptable avant
chaque version sont listées dans le plan. Le lire avant de commencer une version 9.x du Cabinet.

### Ce que trois relectures extérieures ont changé au plan (15/09/2026) — `QUESTIONS.md`

`QUESTIONS.md` (~2 100 lignes, 20 sections) répond à tout ce que le projet pose comme questions ;
c'est le document de référence quand on est perdu. Trois IA extérieures l'ont relu. Ce qu'elles ont
fait bouger, et qui ne doit pas se reperdre :

- **Un paquet n'est pas signé, et ça se voit nulle part.** `sealForCabinet` ne demande que la clé
  **publique** du cabinet — celle du fichier d'appairage, que le cabinet donne à TOUS ses clients.
  Quiconque le tient peut fabriquer un paquet au nom d'une autre entreprise. Chiffrer dit « seul le
  cabinet peut lire » ; **seule une signature dit « ça vient bien de lui »**. La signature du
  manifeste par le client remonte de la **9.10.0 à la 9.2.0** : la ranger avec la révision laissait le
  trou ouvert pendant toute la période où le pilote utilise vraiment le Cabinet. Un paquet non signé
  est accepté avec « origine non prouvée », jamais en silence.
- **On mesure avant d'écrire un format, jamais après.** Le test de charge du Cabinet (50 000
  écritures) était annoncé « avant la 9.3.0 » à deux endroits et « avant de décider » à un troisième.
  Il passe **avant la 9.2.0**, qui est la version qui écrit le format. Il mesure aussi les trois
  lectures qui ouvrent **soixante fichiers** (balance consolidée, recherche globale, tableau de
  production) : le découpage par exercice règle l'écriture, pas la lecture d'ensemble.
- **La valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien.** Deux
  relectures ont proposé « seuil de retenue à la source réglable, par défaut 1 000 DT ». Refusé :
  ce serait écrire en dur une règle de droit que personne n'a confirmée, et changer en silence des
  factures justes. Défaut **0** et « À VÉRIFIER » — même principe que « aucun taux en dur » (5.0.0).
- **Un filet se réclame au moment où il protège encore.** La clé de secours du Cabinet est criée en
  rouge, mais rien n'empêche d'importer soixante paquets avant de l'exporter. Elle est demandée
  **au premier import** (9.1.0).
- **Ce qu'un client ne contrôle pas ne lui est jamais facturé.** Un cabinet ne paie pas parce que son
  client a oublié de renouveler : **douze mois** de grâce (c'était 60 jours), affichés sur le dossier.
- **Les démarches passent avant le code quand elles bloquent la vente.** La signature de code est
  requalifiée de « le jour où ça vend » à **« avant la première vente »** : un expert-comptable ne
  clique pas sur « Exécuter quand même ». Avec le dépôt de la marque, l'INPDP, les conditions de
  vente, le 404 du téléchargement Cabinet et la page unique : six choses, zéro ligne de code.
- **Tout CSS neuf s'écrit en propriétés logiques** (`padding-inline-start`, `text-align: end`).
  Mesuré : 93 déclarations physiques dans tout le projet, zéro logique. Deux heures aujourd'hui, un
  chantier dans deux ans — c'est ce qui garde la porte de l'arabe ouverte sans rien promettre.
- **Refusé, avec les raisons, pour ne pas le rediscuter** : remplacer l'impression PDF par une
  bibliothèque (le reproche « le CSS d'impression est instable entre les OS » est faux ici —
  Electron embarque SON Chromium, c'est la raison du choix, et `e2e:pages` imprime 161 documents) ;
  lier l'essai à l'adresse MAC (donnée personnelle, change avec la carte réseau, se falsifie en une
  commande) ; le partage de clé à seuil (Shamir) ; « choisir un seul produit » (le trait d'union
  EST le produit — mais les deux n'avancent jamais en même temps : l'app entreprise est finie et
  passe en entretien).
- **Méthode, la même que pour les deux premières relectures : vérifier avant d'intégrer.** Sur les
  trois audits, chacun portait des affirmations fausses données comme des faits — cinq dans le
  premier (accident du travail, FOPROLOS, TFP en dur, exonération de timbre, anti-rejeu : tous déjà
  dans le code), un « PostgreSQL local » inexistant dans le deuxième, et dans le troisième un
  calendrier que le document ne donne nulle part plus des chiffres de marché sans source. **Un audit
  qui invente une qualité peut inventer un défaut** : chaque constat se relit dans le code avant
  d'être retenu.
- **Quatrième relecture (sur la v4), la meilleure des quatre** — elle a reconnu ce qui était corrigé
  avant de critiquer. Retenu : des **jalons de décision** trimestriels (un jalon est un chiffre —
  démonstrations, essais, licences — et un chiffre qui manque fait du trimestre suivant un
  trimestre de vente, pas de code) ; les **seuils du test de charge** écrits avant la mesure
  (ouverture < 1 s, écriture < 100 ms, balance de 60 dossiers < 5 s, recherche < 3 s) ; **un dossier
  qui a reçu un paquet signé n'accepte plus jamais de paquet non signé** (confiance au premier
  usage, la tolérance s'éteint d'elle-même) ; **la grâce de douze mois ne suit qu'une licence
  PAYÉE** — après un essai non converti le dossier compte dès sa fin, sinon « avoir essayé »
  deviendrait moins cher que « jamais essayé » (trou de ma règle de la veille) ; l'**export de la
  base de la console** avant la première vente (`GET /v1/admin/export`, rangé dans `~/.skanfact/`,
  réclamé par « À faire » à 30 jours) ; le relecteur de chaque version **nommé** (une autre session
  d'IA, limite assumée) ; les versions d'entretien **numérotées** (9.4.3 — 9.4.1 et 9.4.2 ont été prises par deux entretiens non prévus —, 9.6.1, 9.9.1) ; le
  `.skanclose` quand le client n'est pas à jour (**le cabinet clôture quand même**, le fichier
  attend et porte un PDF) ; le **pli scellé** décrit (fichier chez l'un, mot de passe chez l'autre,
  deux supports, rejoué chaque année) et « Libérer tous les clients… » (clés à vie en lot, derrière
  le passe-droit éditeur). Refusé : un tarif réduit à vie après la grâce (créerait une catégorie que
  le cabinet aurait intérêt à fabriquer). Faux dans cet audit : « plus de 3 000 lignes » (2 536),
  « à six mois on vend à dix clients » lu comme une promesse (c'est un scénario conditionnel), « la
  plateforme collecte déjà » (elle n'est pas en production).
- **Chiffres de marché, enfin sourcés** : INS 2024, 836 808 entreprises privées dont 87 % sans
  salarié → ~107 000 avec au moins un salarié, notre sous-ensemble. Le nombre d'inscrits à l'OECT
  n'est pas publié comme total (annuaire alphabétique à compter).
- **Les questions que le document ne posait pas**, et qui sont les plus importantes : combien
  d'utilisateurs aujourd'hui (trois, aucun payant), combien de temps Skander peut tenir sans revenus
  (c'est cette réponse qui décide de l'ordre du travail), ce qui se passe s'il est absent six mois
  (**personne d'autre ne peut émettre une licence** : clé privée et secret d'administration en un
  seul endroit → un pli scellé à poser avant les dix premiers clients), et qui répond d'une erreur
  de calcul chez un client sans comptable.

### Le plan d'exécution — `PLAN-DEVELOPPEMENT.md` (15/09/2026)

Le document qui **orchestre** sans redire : l'état des lieux vérifié dans le dépôt, les **jalons de
décision** (J0 15/10/2026 → J4, un jalon est un chiffre, la règle d'arrêt), les onze phases avec
durées « construction » et « réaliste » (× 2), le chemin critique et ses cinq goulots, les tâches
non-code chiffrées, le tableau de bord des 26 premières semaines (S1 = 14/09/2026, deux colonnes
Skander / Claude), les décisions de la semaine, le hors-périmètre, et « ce que je n'ai pas pu
vérifier ». Il se réécrit en S26 sur les faits. Quand il contredit `DIRECTION.md`, `DIRECTION.md`
fait foi ; le contenu de chaque version reste dans `QUESTIONS.md` § 16.

### L'inventaire des versions — `VERSIONS-A-VENIR.md` (15/09/2026)

La liste de **tout ce qui reste à faire**, version par version, de la 9.1.0 à la 10.0.0 : un tableau
récapitulatif (version → titre → nombre de fonctionnalités → niveau de spec → durée construction et
réaliste), puis une section par version avec ses fonctionnalités numérotées `F-<version>-<nn>`,
citables dans un commit. **171 fonctionnalités** sur les treize versions principales, **179** avec
les trois versions d'entretien, ≈ 104 jours de construction et ≈ 228 jours réalistes. **Trois
niveaux de spec, définis une seule fois dans ce document** et cités par le cahier : *Complète*
(9.1.0, 9.1.1, 9.2.0 — écrites dans le cahier, 58 fonctionnalités, 34 %), *Intention* (un écran
réservé dans la Partie 15 du cahier avec son tableau Décidé / À décider, 102, 60 %), *Esquisse*
(10.0.0 seule, 11, 6 %). Chaque section dit aussi ce qui n'y est **pas**, ce qui la prouve, ce qui
la **bloque**, ce qui reste à décider et **qui** tranche (comptable, Skander, mesure). Une dernière
partie liste ce qui viendra **au-delà de la 10.0.0**, sans numéro, avec le déclencheur de chacun. Ce
document n'est ni une spécification (`CAHIER-DES-CHARGES.md`) ni un calendrier
(`PLAN-DEVELOPPEMENT.md`) : c'est un inventaire, et il se relit à chaque version publiée.

**v2 (16/09/2026) — la renumérotation, appliquée à tout le dépôt.** La règle du projet veut que le
troisième chiffre soit réservé aux correctifs : la licence du Cabinet ajoute des fonctionnalités,
elle est donc **9.4.0** (et non 9.3.x / P 0.3), l'entretien qui la suit **9.4.1** — devenu **9.4.3** le 17/09/2026, deux entretiens non prévus ayant pris les numéros —, et tout ce qui
suivait décale d'un cran — banque **9.5.0**, déclaration **9.6.0**, immobilisations **9.7.0**,
clôture **9.8.0**, collaborateurs **9.9.0**, révision **9.10.0**, entretiens **9.6.1** et
**9.9.1** ; la 10.0.0 ne bouge pas. **281 occurrences dans sept documents**, en une seule passe
simultanée avec un garde-fou sur les versions livrées et stables — renuméroter un seul document
aurait fabriqué la divergence que le projet combat depuis la 6.8.0. Les identifiants
`SPEC-UI-CAB-0nn` n'ont **pas** été renumérotés (un identifiant qu'on renumérote ne sert plus à
rien) : leur dizaine groupe les écrans d'une version, elle ne nomme plus son numéro, et la Partie 15
du cahier le dit.

**v3 (16/09/2026) — l'ordre clôture / immobilisations, tranché.** La clôture calcule ses dotations
depuis `immobilisations[]`, que la version des immobilisations est la première à remplir : sans
elle, un dossier **hors SkanFact** — le dossier payant — ne peut pas être clôturé avec ses
amortissements. Les deux versions sont **échangées** : immobilisations en **9.7.0**, clôture en
**9.8.0**. Aucune dépendance en sens inverse, et la version courte passe avant la longue. 83 numéros
dans sept documents, plus les blocs de sections et les phases 6 et 7 de `PLAN-DEVELOPPEMENT.md`.
Corrigé au passage : « quinze modules » là où la phrase décrit l'application d'aujourd'hui (elle en
porte **neuf**) — mais **pas** dans les phrases historiques de ce fichier, de `PLAN-UX.md` et du
`CHANGELOG.md`, où « quinze » compte les chantiers de la 7.0.0 ; `ROADMAP.md` s'appelle désormais
une archive, parce que son titre était « Plan des versions à venir », le même que l'autre document ;
`QUESTIONS.md` § 16 renvoie à `VERSIONS-A-VENIR.md` pour les durées. **Refusé** : découper
`PLAN-CABINET.md` (deux des quatre phrases reprochées sont déjà barrées, les deux autres sont
vraies — « pas de serveur » parle du transport des paquets, pas des licences) et écrire un plan de
vente avant d'avoir appelé un seul cabinet. **`PAGE-UNIQUE.md` est écrit** : c'est la seule tâche
documentaire que la Phase 0 confie à Claude, et elle ne l'était pas.

### Le cahier des charges — `CAHIER-DES-CHARGES.md` (15/09/2026)

Le complément technique de `PLAN-DEVELOPPEMENT.md`, écrit en lisant le code au commit `d7bfc54` :
identifiants citables (`SPEC-DATA-nnn`, `SPEC-FUNC-nnn`, `SPEC-UI-*`, `SPEC-FMT-nnn`, `ERR-*`,
`TEST-<version>-nnn`, `MIG-<version>-nnn`), les schémas de tous les fichiers de données (dont
**`livre.json`**, cible de la 9.2.0, figé : un fichier par dossier et par exercice, numéro attribué à
la validation, validée jamais modifiée), la forme d'une ligne d'écriture (le contrat entre les deux
applications), les fonctions qui touchent aux chiffres avec leur ordre d'opérations, les formats du
pont (**`signature.json` signe les octets exacts de `manifeste.json`** — aucune canonicalisation),
les routes et le schéma D1, la CI et le lint à créer, le dictionnaire des messages, les tests et
les migrations des trois prochaines versions. Deux choses apprises en l'écrivant : **un module
`compta` existe déjà** (`toujours: true`, c'est la page à dix onglets) — l'option payante porte donc
sur des onglets (`compta.livres`, sous-module), jamais sur un second module du même nom ; et
`moduleOn` prend `(data, id)`, pas la société. Le document se relit à chaque version : ses parties
« par version » ne couvrent que 9.1.0, 9.1.1 et 9.2.0, exprès.

**v1 (15/09/2026, relecture extérieure à vingt points)** : avis donné point par point AVANT de
corriger, puis ajouts sans rien défaire — le catalogue passe à 60 fiches, les contrats IPC des deux
applications, les JSON exacts de chaque route (lus dans les handlers : trois cellules de la v0
étaient fausses, dont `ignorees`/`refusees`), `.skanrecover` complet, et huit parties nouvelles
(intentions 9.3.0 → 10.0.0, cinq séquences, sécurité, limites, cas limites, dix runbooks, table
« À VÉRIFIER », ce qui n'est pas spécifié). Le « Journal des versions » en fin de document dit ce
qui a été refusé et pourquoi. Ce que la relecture n'a **pas** vu, et qui comptait plus : le paquet
mensuel n'est pas signé (chiffrer ≠ signer, 9.2.0), l'**injection de formule CSV** (`toCsv` et
`toCsvLine` n'échappent que `; " \n \r` — parade 9.1.1, cellule texte commençant par `= + - @`
préfixée d'une apostrophe, colonnes montant/date jamais touchées), le double-clic sur « Émettre »
sans garde (`data-busy` + `isIssued`, 9.1.0), le disque plein sans phrase hors des mises à jour, et
deux imports de paquets simultanés dans le Cabinet. Refusés avec raison : `nextNumber` ne fait pas
de doublon après restauration (`max(pièces, compteur) + 1`), et « garder la signature en changeant
le manifeste » est impossible avec Ed25519 (l'empreinte de `signature.json` sert à la bonne phrase
et à la vérification sans clé, pas à ça).

**v1.1 (même jour, trois précisions de Skander)** : les trois listes de `livre.json` sont montrées
dans **un seul** exemple complet, à leur place (à la racine du livre, plates entre elles, chacune
imbrique ses enfants, le lien va vers l'écriture par `ecritureId` et jamais l'inverse) — la v1 les
spécifiait à part pendant que l'exemple les montrait vides et que la table disait « hors de ce
document » ; la Partie 15 est réécrite **écran par écran** (22 écrans réservés `SPEC-UI-CAB-010` →
`081`, chacun avec son tableau Décidé / À décider et qui tranche : comptable, Skander, mesure) ;
la Partie 20 ne garde que les quatre **scénarios de reprise** (SCN-001 → 004) — un runbook dit ce
que l'opérateur fait, un cahier ce que le logiciel doit faire — et les deux runbooks de la
plateforme (mise en production, retrait de `srv-1`) vivent dans `PLAN-PLATEFORME.md` § 18, les
quatre autres là où ils étaient déjà (`CLAUDE.md`, `worker/README.md`, `QUESTIONS.md` § 18).

### 9.1.0 — L'outillage, et `compta.js` partagé par les deux applications

Le socle que la 9.2.0 attend, et l'outillage d'un logiciel qu'on vend. **`src/renderer/compta.js`**
(SPEC-FUNC-100) : douze fonctions pures, aucune dépendance — pas même core.js. La règle qui décide
du découpage et qui ne doit pas bouger : **une fonction qui prend `data` reste dans core.js ; une
fonction qui prend des LIGNES vit dans compta.js.** C'est ce qui rend le module utile au Cabinet,
qui n'a pas de `data` mais des lignes lues dans les paquets. `round3` y est redéfini à l'identique
plutôt qu'importé, et un test compare les deux corps caractère par caractère. Le test qui compte est
celui de **parité** : la balance calculée par le cabinet sur les écritures relues dans le CSV du
paquet est identique, au millime, à celle que l'entreprise calcule sur ses pièces, sur les 24 mois
du jeu d'exemple. Sans lui, le comptable et son client auraient deux balances et aucun moyen de
savoir laquelle croire.

Règles apprises, à ne pas recasser :

- **Le lint attrape en deux secondes ce qui a coûté des sessions entières.** `eslint.config.js`,
  format plat, zéro règle de style — un lint qui crie sur mille lignes de formatage cesse d'être lu,
  et emmène avec lui les dix erreurs qui comptaient. Ce qu'il tient : `no-undef` (la variable d'une
  autre route, 7.20.0 ; la fonction d'un autre module, 7.22.0), `no-dupe-keys`, et surtout les
  **trois fautes de date de la 5.2.3** — `new Date(y, m, d)`, `getDay()`, `setDate()` — en ERREUR,
  avec le renvoi à CLAUDE.md dans le message. Il a trouvé deux choses le jour même : une clé d'aide
  en double qui en écrasait une autre depuis huit versions, et `C.canalDe` appelé dans
  `src/cabinet/main.js`, qui ne charge pas core.js.
- **Deux bulles ne peuvent pas porter la même clé.** `lic.offre` était déclarée deux fois dans
  `guide.js` : un objet littéral ne s'en plaint pas, la seconde écrase la première **en silence**,
  et le test qui exige que chaque clé posée dans l'interface existe passait — la clé existait, seul
  son texte n'était plus le bon. Un client qui cliquait « Offre » dans ses Paramètres lisait depuis
  la 8.2.0 une explication de facturation au prorata écrite pour l'éditeur.
- **Une exception de l'interface laisse une trace.** `error` ET `unhandledrejection` — les deux, car
  une promesse rejetée ne passe pas par `error` et c'est le cas le plus courant ici. Posés **avant**
  la séquence de démarrage, comme le chien de garde (6.5.0) : une exception levée pendant cette
  séquence laisse l'écran blanc, et c'est justement celle qu'un garde-fou installé plus bas ne
  verrait pas. Il n'affiche **rien** et ne recharge **rien** : une erreur d'interface n'est pas
  toujours visible pour l'utilisateur, et une application qui annonce une panne qui n'en est pas une
  apprend à cliquer sans lire.
- **Un journal se borne AVANT d'ouvrir un robinet dessus.** `main.log` grossissait sans limite ; le
  garde-fou ci-dessus change l'échelle. Vingt erreurs par minute au maximum (les tuées sont comptées
  et **dites**, sinon le journal laisse croire que l'application s'est calmée alors qu'elle brûlait)
  et UNE rotation à 2 Mo. Au passage, la sauvegarde du cabinet appendait **directement** dans
  `main.log` : la seule écriture volumineuse de l'application aurait échappé à la borne qu'on venait
  de poser. Un test interdit désormais toute écriture qui contourne `logToFile`.
- **On mesure avant d'écrire un format, jamais après.** `npm run charge` (SPEC-OUT-006) fabrique
  50 000 lignes, un portefeuille de 60 dossiers (345 001 lignes, 97 Mo), et mesure le VRAI chemin —
  chiffré, comme le sera `livre.json`. Verdict : ouverture 159 ms (seuil 1 000), balance 1 291 ms
  (seuil 5 000), recherche 1 040 ms (seuil 3 000), **écriture 147 ms pour un seuil de 100**. Le
  script ne se contente pas de le dire, il **mesure chaque levier** : j'aurais parié sur le découpage
  par mois, c'est le **corps binaire au lieu de base64** qui pèse le plus lourd pour le moins de
  travail (79 ms, 46 % de gagné, et il ne change ni la forme du livre ni aucun appelant). C'est la
  leçon de la 6.1.0 jamais portée à `cabstore`, parce qu'elle ne coûtait rien sur un petit fichier
  d'état. Décision consignée dans SPEC-DATA-005 : la 9.2.0 écrira un corps binaire.
- **Un banc d'essai dont les données mentent fait mentir le verdict**, et c'est le pire cas : il a
  l'air de fonctionner. Mon générateur était un LCG (`g * 1103515245 + 12345`) avec `graine % max` :
  les bits de POIDS FAIBLE d'un LCG ont une période très courte, donc `% 12` ne rendait que **six
  mois sur douze** (l'un d'eux à 18 écritures sur 16 667) et `% 300` que 90 tiers sur 300. Mulberry32
  à la place — et le script **vérifie son propre jeu** avant de mesurer quoi que ce soit.
- **Une CI existe pour la plateforme que personne ne teste.** Linux ET Windows, `fail-fast: false`
  délibérément : quand un test tombe, savoir s'il tombe des deux côtés ou d'un seul est
  l'information qui désigne la cause (règle 5.2.3). C'est la 7.21.x qui la motive. Pas d'e2e
  Electron : quarante-deux parcours sous `xvfb` à chaque poussée videraient le quota en une matinée
  (6.7.2). Seul `e2e:pages` y est, parce qu'il n'ouvre pas Electron.
- **Une application d'essai ne doit ni publier, ni se mettre à jour, ni écraser la vraie.**
  `essai.yml` : `productName` et `appId` suffixés (sinon l'essai EST la vraie application pour le
  système — l'accident de la 6.7.3), `--publish never`, et surtout **`updateBase` vide** : le plus
  facile à oublier, parce qu'il ne se voit qu'après coup — une application d'essai qui se met à jour
  redevient la version publiée au premier redémarrage, et la personne ne teste plus rien.
- **L'index de CLAUDE.md est tenu par un test.** Ce fichier est rangé par version ; l'index le range
  par thème. Un renvoi mort y serait exactement le défaut que le projet combat (« une phrase
  affichée que rien ne tient est un bug », 7.3.0) — en pire, puisque c'est moi qui le lis à chaque
  session. Le test vérifie que chaque version citée nomme une section qui existe, que les commandes
  annoncées existent dans `package.json`, que le nombre de parcours e2e est le bon, et que chaque
  document cité est sur le disque. Il a trouvé cinq renvois morts à sa première passe — dont deux
  étaient une faute du test lui-même, trop étroit : **un test trop étroit accuse du code juste, ce
  qui est pire que pas de test.**
- **Trois assertions retournées** (« quand une règle change, c'est le test qui se relit en
  premier ») : le canal du Cabinet écrit en dur, `allowDowngrade = false` au caractère près — que
  l'app entreprise ne passait que par accident, grâce à une seconde ligne ailleurs — et la borne du
  journal. Et une faiblesse trouvée dans mon propre test : un `||` le rendait incapable de tomber
  sur la sévérité des règles de date, puisque le branchement suffisait à le satisfaire (le piège de
  précédence de la 7.33.0, deux fois).

### 9.1.1 — Les corrections fiscales

Quatre chiffres qui partent chez un tiers, et qui traînaient sans version. La règle qui les tient
tous : **la valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien.**

- **L'injection de formule CSV**, le vrai trou, trouvé en relisant le cahier et pas par un test. Un
  tableur EXÉCUTE une cellule qui commence par `=`, `+`, `-` ou `@`, et le libellé d'une ligne de
  facture partait tel quel dans le journal envoyé au comptable. `compta.csvDangereux` est
  **stricte** et ne devine pas ce qui « ressemble à un nombre » : c'est l'APPELANT qui sait.
  `core.toCsv` a des types (les colonnes `money`/`date` ne la voient jamais, `-12,500` reste un
  montant) ; `cabcore.toCsvLine` n'en a pas, d'où `estNombreCsv` **là et là seulement**. Le
  quatrième export — le portefeuille du cabinet — avait sa propre version sans parade : une seule
  porte désormais. Deux corps identiques dans deux fichiers, un test l'exige (motif `round3`).
- **Le timbre par client** (`client.stampExempt`) se COPIE à la création (`applyClientDefaults`),
  **dans les deux sens** et seulement sur une facture : poser `false` sans jamais reposer `true`
  laisserait un brouillon dont on change le client sans timbre, en silence. Et la case du DOM se
  met à jour avec la donnée — sinon le prochain `formValues` relit la case restée en arrière et
  écrase ce qu'on vient de calculer. `computeTotals` ne relit JAMAIS le client : une pièce émise ne
  bouge plus (règle 7.1.1, un cran plus haut).
- **Le seuil de retenue vaut 0** (= aucun seuil). Réglé, il AVERTIT dans `issueWarnings`, jamais un
  refus, et il ne se lit qu'à **un seul endroit** de l'interface. Le seul cas que la garde protège
  vraiment est le seuil **négatif** : `Number('') === 0` rend l'assertion évidente inutile (8.3.0).
- **La TFP est proposée par métier, et aucun métier n'en porte** : le test TOMBE si quelqu'un écrit
  un `tfp:` dans `ACTIVITIES` sans la réponse du comptable. `tfpTouche` (posé à l'enregistrement des
  barèmes) empêche la proposition d'écraser un taux décidé — motif `regimeTouche` (7.25.0, 7.30.0).
- **`docs/e-facture-controle.md`** : champ par champ, ce que le modèle porte de ce qu'un format
  officiel exigerait. Il ne construit rien ; il répond à la seule question qui compte aujourd'hui —
  les chiffres sont là, les identités sont incomplètes mais rattrapables, la signature et
  l'acheminement sont entièrement à faire.
- Piège de test : `lireApp()` RETIRE les commentaires de ligne, donc une tranche ne peut jamais
  s'ancrer sur un commentaire (8.2.0, re-rencontré). Et une assertion e2e de la 9.1.0 exigeait les
  dix onglets de Comptabilité alors que trois sont masqués depuis : **quand une règle change, c'est
  le test qui se relit en premier** (sixième occurrence).

### 9.2.0 — Le livre du dossier, et le paquet signé

La plus grosse version du chantier Cabinet. `compta.js` gagne le **livre** (pur, testable sans
Electron) ; `cabstore` l'écrit sur le disque ; le paquet mensuel est enfin **signé**.

**Les trois règles du livre, qui ne bougent plus :**

1. **Une écriture VALIDÉE ne se modifie jamais.** On la contre-passe — une écriture miroir, datée du
   jour où l'on corrige, **jamais** de celle de l'écriture d'origine : corriger en avril une
   écriture de janvier dans un janvier déjà déclaré changerait la TVA de janvier en silence (6.0.0).
2. **Le numéro naît à la VALIDATION**, par ordre de validation et pas de date, et le contrôle passe
   AVANT l'attribution — sinon chaque refus trouerait la numérotation (le défaut de `nextNumber`,
   6.0.0). C'est la différence avec la numérotation *déduite* de la 8.9.0 : là-bas un numéro bougeait
   quand on insérait une pièce en arrière ; ici il est écrit, et il ne bouge plus.
3. **Le paquet du client ne gagne jamais contre le cabinet.** Un mois renvoyé remplace les
   brouillards et ne touche AUCUNE validée : on calcule l'écart, on l'affiche, le comptable tranche.
   Écraser son travail parce que le client a rouvert son mois serait la pire chose que ce logiciel
   puisse faire.

**Chiffrer n'est pas signer** — le trou que trois relectures extérieures ont pointé, et le plus
grave du projet. `sealForCabinet` ne demande que la clé PUBLIQUE du cabinet, celle qu'il donne à
TOUS ses clients : quiconque la tenait pouvait fabriquer un paquet chiffré au nom d'une autre
entreprise, et le cabinet l'importait sans un mot.

- On signe les **octets exacts** de `manifeste.json` tels qu'ils partent dans le ZIP. Aucune
  canonicalisation, aucun RFC 8785 : re-sérialiser pour signer, c'est signer autre chose que ce
  qu'on envoie, et c'est l'écart entre les deux qui fait les failles de signature.
- La paire est **Ed25519** (signature), pas X25519 (échange de clés) — deux courbes pour deux
  métiers, et Node refuse la seconde. Elle vit dans `<dossier>/cle-client.json` (0600), créée au
  PREMIER envoi, **hors** de `skanfact-data.json` : une clé privée qui voyagerait dans un export ou
  dans le paquet ne serait plus une clé privée.
- `cabcore.verdictOrigine` porte la RÈGLE, pure et testée. Quatre cas : pas de signature et pas de
  clé épinglée → accepté « origine non prouvée » (refuser couperait tout le portefeuille le jour de
  la mise à jour) ; pas de signature mais clé épinglée → **refusé**, donc la tolérance s'éteint
  d'elle-même **client par client**, sans date butoir ; signature valable et pas de clé → on
  épingle ; autre clé → refusé en nommant les DEUX empreintes, et la reprise passe par l'empreinte
  dictée au téléphone.
- L'ordre sha256-puis-signature est fixé pour la **phrase**, pas pour la sécurité : Ed25519 porte
  sur les octets, donc un manifeste modifié fait échouer `verify` de toute façon — mais « modifié
  après l'envoi » et « signature inconnue » ne demandent pas le même coup de téléphone.
- Les quatre champs épinglés entrent dans `migrateDossier` : absent de cette liste, un champ est
  jeté au prochain démarrage et la vérification se désarme **en silence**. C'est le défaut de
  `matricule` de la 6.8.0, appliqué cette fois à un champ de sécurité.
- Un échec de signature ne fait PAS échouer l'envoi : priver quelqu'un de son paquet mensuel pour
  une clé qu'on n'a pas su écrire serait pire que le paquet non signé.

**Le fichier :** `livres/<dossier>/livre-<AAAA>.json`, **corps binaire** (décidé par `npm run charge`
AVANT d'écrire une ligne : 141 ms en base64 pour un seuil de 100, 57 ms en binaire), **entête en
clair** (client, exercice, nombre d'écritures — rien du contenu). Le verrou **périme à 24 h** : un
poste qui plante laisserait sinon un dossier verrouillé pour toujours, pire que le risque qu'il
évite. La copie externe emporte **toujours** les livres, avec ou sans les paquets — un paquet perdu
se redemande au client, un livre perdu non. Une génération précédente est gardée à chaque écriture ;
trente feraient 2,9 Go sur un portefeuille de soixante dossiers.

**UNE seule porte d'écriture** (`ecrireLeLivre` dans `src/cabinet/main.js`) : verrou, écriture et
trace dans le même mouvement. Deux portes, c'est la garantie qu'un jour l'une oubliera l'audit — et
un livre comptable sans piste d'audit ne vaut rien devant un contrôle.

Autres règles apprises :

- **Le cas qui compte n'est pas le fichier brouillé** (le déchiffrement échoue tout seul) mais celui
  qui se DÉCHIFFRE sans être un livre : c'est `isValidLivre` qui l'attrape, et le test le fabrique
  avec la clé de la session plutôt qu'en imitant le format.
- `lignesDuLivre` rend le contrat d'`entreesDepuisCsv` **au champ près** (`account`, `label`) : les
  quatre lectures de la 9.1.0 servent telles quelles sur le livre. Deux contrats voisins mais
  différents auraient obligé à réécrire la balance pour le cabinet — exactement ce que `compta.js`
  existe pour éviter.
- `entreesDepuisCsv` prend le **TEXTE** du CSV, pas des lignes découpées (c'est elle qui déduit le
  séparateur). Lui passer un tableau donnait « 0 écriture ajoutée » sur un paquet qui en a douze,
  sans erreur nulle part. C'est l'e2e qui l'a vu.
- **Relire un état à CHAQUE affichage d'une page est un excès qui fabrique un défaut** : le redessin
  asynchrone de `#c-livres` détachait le menu de ligne ouvert ailleurs, et le clic suivant tombait
  dans le vide (piège 7.0.0). On relit quand le couple (dossier, exercice) change ; les gestes qui
  modifient le livre reposent l'état eux-mêmes.
- Un bloc écrit dans `el.innerHTML` puis **écrasé** par le rendu final ne s'affiche jamais. Aucune
  erreur, aucune console : il faut ouvrir l'application.
- Le second exemplaire du contrôle « le cabinet n'écrit jamais chez un client » n'avait **pas** reçu
  le nettoyage des commentaires de la 6.8.0 : il échouait sur un commentaire qui cite les deux
  appels interdits pour expliquer la règle. **Un test trop étroit accuse du code juste.**
- Piège de ma propre méthode, deux fois : un `cp` de sauvegarde par **basename** écrase
  `src/cabinet/main.js` avec `src/main.js` (même nom de fichier) ; et `npm test | tail -2 && git
  commit` masque le code de sortie du test — un commit est parti avec un test rouge. **Un test qu'on
  lit au lieu de le laisser décider ne protège de rien.**

### 9.2.1 — La désignation cherche dans le catalogue

Skander, sur un achat en destination « stock » : « au lieu de me dire cette phrase et que je cherche
manuellement comment ça s'écrit exactement, proposer une recherche directement dans le nom, comme
ça on n'a pas à réécrire mais plutôt sélectionner ». L'article existait ; l'éditeur reprochait sans
offrir — le défaut de la 7.20.0, un cran plus loin : le sélecteur de catalogue AJOUTAIT une ligne,
il ne réparait pas celle qu'on venait de taper.

- **`suggererCatalogue(input, o)`** (app.js) : un champ texte qui reste libre, et une liste qui
  n'apparaît que pendant la frappe. Ce n'est pas `combo()` — un combo porte une valeur, ici la
  valeur EST le texte. Choisir pose l'article sur la ligne existante (`poserArticle`) et la rattache
  par `itemId` : c'est lui que lit `itemOfLine`, quelle que soit l'orthographe retouchée ensuite.
- **La recherche ignore les accents ET les espaces** (`sansAccents`, comparaison « serrée ») : sans
  ça, « memoire 16go » ne trouvait pas « Mémoire 16 Go » — le cas exact qui a fait écrire la liste.
- **Les DEUX éditeurs** la branchent : le stock entre par l'achat et sort par la vente, par la même
  règle, et le coût qui fait la marge se lit sur l'article. Un document verrouillé ne propose rien.
- **L'avertissement porte le bouton qui débloque** (`data-orph` → `_ouvrirSuggestions`), et il juge
  la ligne SAISIE (`p.lines[i]`, qui porte `itemId`), pas la ligne calculée : une ligne rattachée
  puis retouchée ne doit pas être accusée.
- **Créer depuis la liste** passe par `catalogForm(articleNeuf({ label, tracked }))` : l'article
  vierge vit en un endroit, sinon un champ ajouté demain manquerait aux créations à la volée.
- `.sugg-host` entre dans `RowMenu.SURFACES` : le champ ET sa liste, sinon replacer le curseur dans
  le champ refermait la liste (piège 7.28.0).
- Piège d'outil : un `̀` écrit dans un fichier peut arriver en **caractère réel** — un intervalle
  `[̀-ͯ]` que personne ne peut relire, et qu'un éditeur qui normalise mangerait. Vérifier les octets
  après coup, et garder l'échappement.

`e2e:fiches` gagne l'étape : tapé sans accent, l'article se propose et se choisit ; une désignation
inconnue en stock porte le bouton, qui ouvre la liste, qui crée la fiche préremplie et suivie.

### 9.2.2 — La fiche d'un dossier en trois onglets, et l'exemple qui livre de vrais paquets

Skander, capture à l'appui : « le dossier est mal fait et pas pratique, tout est mis dans la même
page », puis « ton jeu d'exemple ne montre pas le vrai écran avec l'exercice ouvert ». Les deux
tenaient ensemble : l'exemple **cachait** le défaut.

- **Mesurer avant, sur le bon instrument.** Sur l'exemple, la fiche faisait 1 741 px et six
  panneaux. Sur le vrai dossier de Skander, le seul bloc Comptabilité (15 pièces, 56 lignes) était
  une page entière posée entre les mois et les paquets. L'exemple n'avait **aucun fichier de
  paquet** — un manque connu depuis la 8.7.0 — donc « aucun paquet ne contient d'écritures » sur
  l'écran qui doit montrer un exercice ouvert. Un instrument qui sous-estime rend le diagnostic
  faux : il fallait d'abord réparer l'exemple.
- **Le Cabinet n'embarque pas `core.js`, et ne le doit pas** (l'app gratuite n'emporte pas le
  produit payant ; un test le tient). Les journaux de l'exemple sont donc **pré-calculés** par
  `scripts/exemple-cabinet.js` avec le moteur de l'app entreprise, pour une date de référence
  FIXE, et rangés dans `src/cabinet/exemple-paquets.json` (8 mois, 90 Ko). Un test exige que le
  fichier commité soit ce que le script produit : le seul aléa (les identifiants des salariés dans
  la CNSS) est remplacé par des noms stables — un identifiant interne n'a aucun sens hors de
  l'application qui l'a tiré.
- **`cabcore.rebaserPaquet` recale un gabarit sur le mois courant, pur** : dates ISO et `JJ/MM`
  glissées du même nombre de mois, jour borné au mois d'arrivée (31 août → 28 février), année des
  numéros de pièce et mois en lettres qui suivent, montants intacts. Les CSV de l'app entreprise
  écrivent `JJ/MM/AAAA` : une première version ne visait que l'ISO, et aurait laissé passer toutes
  les dates des journaux. Prouvé par son défaut. Et mon assertion « 30/09 → 31/03 » était fausse :
  le jour se GARDE, il ne recule que s'il n'existe pas.
- **L'exemple passe par la VRAIE porte** : `chargerExemple()` fabrique de vrais `.skanpack`
  (manifeste avec empreintes, scellés pour la clé de CE cabinet) et les donne à `ingest()`, comme
  un paquet reçu par mail. `demoDossiers()` ne porte plus que le scénario ; les chiffres viennent
  des écritures. Retirer l'exemple — ou recevoir un premier vrai paquet — **retire ses fichiers**.
  La page Écritures regroupe donc l'exemple, et l'assertion « Rien à regrouper » de `e2e:cabinet`
  est retournée (quand une règle change, c'est le test qui se relit en premier).
- **Trois onglets, pas quatre.** L'identité (151 px) aurait fait un onglet d'un demi-écran — ce
  que la 7.30.0 a retiré des Paramètres. Elle vit dans l'en-tête, avec l'état en une phrase
  (`d-etat`) ; ce qui n'est pas renseigné ne prend pas de place, sauf l'email et le téléphone,
  qui servent à relancer. *Suivi* (mois, relances, note), *Comptabilité* (une page à elle seule),
  *Paquets* (le tableau et le graphique de CA, qui en tire ses chiffres).
- **Les alertes restent au-dessus des onglets** (7.32.0) et portent « Voir les paquets ».
- **L'onglet vit dans l'ADRESSE** (`#/dossier/<id>/<onglet>`) : « précédent » revient dessus,
  une autre page peut y emmener, et `e2e:boucle` le prouve avec `/comptabilite`. Sans onglet dans
  l'adresse : celui où l'on était sur CE dossier, sinon Suivi — jamais celui d'un autre client (le
  garde-fou de `ficheYear`).
- **Imprimer imprime tout** : `section[data-onglet][hidden] { display: block }` sous
  `@media print`, plus spécifique que le `[hidden]` global.
- Piège d'e2e, sixième fois : trois passages de `e2e:boucle` cliquaient dans ce qui devient un
  onglet masqué (`#c-compta`, le menu d'un paquet, `#c-livres`). On clique l'onglet comme un
  comptable, ou on passe par l'adresse profonde.

### 9.3.0 — La saisie

L'écran où un comptable passe ses journées. Dans `compta.js` : `modifierEcriture`, `supprimerEcriture`,
`validerLot`, `extourner`, `chercherEcritures`, `soldeDeLignes`, `comptesQuiCorrespondent`,
`guideValide`/`ecritureDepuisGuide`, `occurrencesAGenerer`, `correspondanceValide`/`compteCorrespondant`/
`appliquerCorrespondance`, plus `premierDuMoisSuivant` et `ajouterMoisIso` (UTC pur). Dans cabcore :
`dateTapee`, `guidesDuDossier`, `correspondanceDuDossier`, `DEFAULT_SAISIE`. Onglets **Saisie** et
**Recherche** dans la comptabilité d'un dossier, onglet **Comptabilité** dans les Réglages.

La dépendance que le plan pose sur cette version — **regarder le pilote saisir une heure dans son
logiciel actuel** — n'est pas levée. C'est pour ça que tout ce qui s'apprend par les doigts est
**réglable** : les touches, le journal proposé à l'ouverture, la date complète ou le jour seul. On
change un réglage, pas une version.

Règles apprises, à ne pas recasser :

- **Le contrôle passe AVANT l'attribution du numéro, et valider un lot ne refuse jamais en bloc.**
  Les deux vont ensemble : chaque pièce d'un lot passe par `validerEcriture` une par une, donc une
  refusée au milieu de cinquante ne consomme aucun numéro. Un lot tout-ou-rien obligerait à sortir la
  pièce fautive d'un mois de saisie avant de pouvoir valider les quarante-neuf autres — et le
  comptable finirait par ne plus valider du tout. Les refusées sont NOMMÉES : « 12 validées » en
  avalant trois refus serait pire qu'un refus global.
- **Une extourne n'est pas une contre-passation**, et la différence est comptable, pas cosmétique :
  l'écriture d'origine reste `validee`, dans son mois, avec son numéro. La marquer `contrepassee` la
  ferait disparaître du mois où elle a été passée, et le résultat de ce mois-là serait faux. Une
  extourne de décembre tombe au 1er janvier, donc dans l'exercice SUIVANT : on REFUSE en le disant,
  plutôt que de la ranger dans le livre de décembre — ça fausserait les deux.
- **L'écran ne calcule jamais le solde lui-même.** `soldeDeLignes` vit dans `compta.js`, et c'est lui
  que `Tab` appelle : deux façons d'arrondir finiraient par diverger, et une pièce « soldée » à
  l'écran serait refusée à l'enregistrement. Le solde posé **change de colonne**, il ne garde pas un
  signe (règle 6.3.0).
- **Une grille ne se redessine pas à la frappe** (défaut 7.17.0) : on met à jour la donnée, puis le
  SEUL élément qui en dépend (`#sa-solde`). Un test relit le gestionnaire `oninput` et interdit qu'il
  contienne `drawLivres`. Le redessin n'a lieu qu'à l'ajout ou au retrait d'une ligne, et il replace
  le curseur.
- **Tab ne peut pas servir de chaîne dans l'en-tête** : chaque libellé porte sa bulle « i », qui est
  un vrai `<button>` et prend donc le focus au passage. Les sortir de l'ordre de tabulation rendrait
  l'explication inatteignable au clavier — ce que ce projet s'interdit depuis la 7.0.0. On AJOUTE un
  chemin au lieu d'en couper un : Entrée descend de champ en champ jusqu'à la première ligne. Trouvé
  par `e2e:saisie`, invisible autrement — le libellé n'était simplement jamais tapé.
- **Un guide préremplit, il n'écrit pas.** Un abonnement génère **en brouillard**, jamais une validée
  d'office : une écriture que personne n'a regardée ne doit pas engager la signature du comptable.
  Rejouer la génération ne double rien (`faites` porte les mois déjà générés — même règle que
  `importerPaquet`). Et le taux d'un guide vient du guide, jamais du code (règle 5.0.0).
- **Ni les guides ni les abonnements ne vivent dans `livre.json`** : son format est FIGÉ
  (SPEC-DATA-005). Les guides au niveau du cabinet (on les écrit une fois pour soixante clients), les
  abonnements sur le dossier (un loyer appartient à un client). Un guide du dossier qui porte le même
  `id` REMPLACE celui du cabinet — surcharger n'est pas doubler.
- **La correspondance la plus PRÉCISE gagne** (411001 avant 411), et un compte n'a jamais deux
  réponses. Sans cette règle, une ligne « 4 → 5 » écraserait tout selon l'ordre du tableau et
  personne ne saurait laquelle a servi. Elle traduit à l'import et à l'export, **jamais** en
  réécrivant une validée : celle-ci porte le compte sous lequel elle a été validée.
- **Un justificatif est COPIÉ, et son chemin est RELATIF.** Le fichier du comptable est sur son
  Bureau ou dans un mail téléchargé — deux endroits qui auront disparu bien avant l'écriture qu'ils
  justifient. Un chemin relatif suit le dossier quand on change d'ordinateur, et part avec lui quand
  on l'efface. Une validée peut recevoir son justificatif (joindre un scan ne change aucun chiffre) :
  c'est le seul de ses champs qui bouge, et l'audit le nomme.
- **Le moteur ne trace pas ces gestes, l'appelant si.** `compta.js` laisse `ecrireLeLivre` (la porte
  unique, 9.2.0) écrire la piste d'audit. Deux endroits qui tracent le même geste écrivent la piste
  en double, et une piste d'audit en double ne se lit plus. Un test relit les six handlers neufs et
  exige qu'aucun n'appelle `getStore().ecrireLivre` directement.
- **Les quatre champs neufs du dossier entrent dans `migrateDossier`** (`abonnements`, `guides`,
  `correspondance`, `dernierJournal`) : absent de cette liste, un champ est jeté au prochain
  chargement, en silence. C'est le défaut de `matricule` de la 6.8.0 — ici, un abonnement perdu,
  c'est un loyer qui cesse d'être écrit sans que personne ne le remarque avant le bilan.
- **Une cellule de grille d'édition n'est pas une `row-actions`.** Le « ✕ » qui retire une ligne
  qu'on est en train de taper est juste ; le test de la 7.29.0, qui interdit un pictogramme en fin de
  ligne de LISTE, visait autre chose. D'où `.sa-sup`, et la distinction écrite dans la feuille.
- **Un test écrit contre l'état du jour décrit cet état** (septième occurrence) : `e2e:boucle`
  exigeait qu'« une écriture ne se supprime JAMAIS depuis une liste ». C'était vrai en 9.2.0, où rien
  ne se supprimait. La RÈGLE est qu'une **validée** ne se supprime jamais ; un brouillard, si — c'est
  toute sa raison d'être. L'assertion a été **retournée**, pas retirée, et doublée de son autre
  moitié : le pont lui-même refuse de modifier ou supprimer une validée.
- Piège d'e2e rencontré : un parcours qui agit par le PONT laisse l'écran en retard, parce que les
  gestes du renderer reposent `s.livre` eux-mêmes. Rouvrir l'application (`win.reload()`) est la
  parade honnête — et elle prouve en plus que tout est sur le DISQUE, pas seulement dans la mémoire
  d'un écran. Au passage : `#app` existe toujours dans le document, simplement masqué ; on attend
  qu'un écran soit VISIBLE, jamais qu'un sélecteur existe.
- Piège de test rencontré : ma preuve de la remontée de chemin (`../..`) ne tombait pas, parce que le
  fichier visé n'existait pas et que c'est la garde « fichier absent » qui répondait. On vise un
  fichier qui existe VRAIMENT — et il faut retirer LES DEUX gardes pour retrouver le défaut, comme
  pour le fil d'Ariane de la 7.27.0.

Le test qui compte est `npm run e2e:saisie` : il tape une pièce entière **au clavier**, vérifie que
Tab solde, enregistre en brouillard sans numéro, valide, se voit refuser la modification ET la
suppression, valide un lot dont la pièce fautive est au MILIEU et vérifie que la suite des numéros
reste 1..n, extourne, rouvre l'application, cherche par montant, écrit un guide et s'en sert.

### 9.4.0 — La licence du Cabinet

On vend des **dossiers**, jamais des postes. Dans `src/licence.js` : `CABINET_GRATUITS` (3),
`licenceCabinet`, `pastille`, `requestMailCabinet`, et le refus croisé dans `licenceState`. Dans
cabcore : `dossierFacturable`, `comptageDossiers`, `licenceDuPaquet`, `GRACE_MOIS`, `DORMANT_MOIS`.
Dans `src/cabinet/main.js` : `licenceCabinetStatus`, `licenceBlockCab` (la porte unique),
`noterValidation`. Panneau **Réglages → Mon cabinet → Licence**, bandeau à trois tons, ligne
« À faire ». `src/licence.js` et les clés publiques entrent dans `build/cabinet.config.js`.

La question qui bloque la VENTE — l'avis de l'Ordre, et les prix — n'est pas levée. Le code, lui,
n'attendait pas : c'est écrit ainsi dans le plan.

Règles apprises, à ne pas recasser :

- **Deux règles justes se combinaient en un trou.** Une licence de cabinet n'a pas de matricule (son
  sujet est l'empreinte) ; et `memeMatricule` laisse passer un côté vide, parce qu'« on ne punit pas
  qui n'a pas rempli sa fiche » (7.33.0). Ensemble : une clé Cabinet déverrouillait TOUT chez
  n'importe quelle entreprise. Le garde-fou est le `type`, et il est **symétrique** — une clé
  d'entreprise ne vaut rien dans le Cabinet non plus. Le cas qui le prouve n'est pas la clé sans
  empreinte (la comparaison d'empreinte la refuse déjà, correctif double, 7.27.0) mais la clé d'un
  client **parrainé par ce cabinet** : elle porte légitimement son empreinte, et seul le type la
  distingue.
- **Le verrou ferme la VALIDATION, et rien d'autre.** Lire, importer, saisir, exporter, relancer :
  toujours ouverts. Un test relit `main.js` et vérifie les deux sens — la porte sur les quatre
  gestes qui valident, et son ABSENCE sur sept handlers qui lisent. Sans la seconde moitié, le test
  laisserait passer une porte posée partout, c'est-à-dire des données en otage (6.4.0) — et ici ce
  sont les pièces de soixante entreprises.
- **Le doute profite au cabinet.** Un paquet d'avant la 9.4.0 ne dit pas si son client a une
  licence : le dossier **ne compte pas**, et l'écran dit pourquoi. On ne fait pas payer quelqu'un
  pour ce qu'on n'a pas su lire.
- **La grâce de douze mois ne suit qu'une licence PAYÉE.** Sans ce garde-fou, « avoir essayé »
  coûterait moins cher au cabinet que « n'avoir jamais essayé », et on fabriquerait exactement la
  catégorie qu'on veut éviter. D'où `payee` dans le manifeste — la PRÉSENCE d'une clé, jamais la clé.
- **Un chiffre qui décide d'une facture doit pouvoir s'expliquer.** `comptageDossiers` nomme chaque
  dossier avec sa raison, et groupe les raisons de ceux qui ne comptent pas. « 7 dossiers comptés »
  sans la liste, c'est le genre de chiffre qu'on ne croit pas — et on aurait raison.
- **L'empreinte du cabinet n'est PAS rangée dans l'état : elle se calcule.** `safeState()` l'ajoute
  pour l'écran, donc `state.cabinet.fingerprint` vaut `undefined` côté processus principal. Une
  empreinte vide désarme la comparaison, et la licence d'un AUTRE cabinet passait. **Aucun test pur
  ne pouvait le voir** : le moteur, lui, rendait le bon verdict — c'est le parcours réel qui l'a
  montré. Même famille que « un champ lu mais jamais écrit » (7.3.0), vue de l'autre côté.
- **Un état lu une fois au démarrage se périme** (7.1.x, re-trouvé) : le panneau de licence relit à
  chaque affichage, parce que le compte change à chaque dossier créé, archivé ou reçu.
- **`pastille` est le jumeau EXACT de `core.pastilleLicence`**, corps comparé par un test — comme
  `round3`. Les deux applications doivent dire la même chose de la même échéance, et aucune ne peut
  charger le module de l'autre (core.js est un UMD de navigateur, licence.js a besoin de `crypto`).
- **Les deux champs de la charge signée sont en QUEUE** (`type`, `dossiersHors`). Au milieu, ils
  changeraient l'ordre des champs déjà signés, et une clé refabriquée depuis sa charge rangée en
  base ne serait plus identique à celle qu'on a envoyée — or c'est exactement ce qui permet de ne
  jamais ranger la clé elle-même (8.5.0).
- **Un test qui interdit un MOT accuse du code juste.** Ma première version exigeait que le mot
  `key` n'apparaisse pas dans ce qui part au manifeste : elle refusait `payee: !!st.key`, qui ne
  transporte pas la clé mais sa présence. On vise le danger (une sortie non booléenne), pas le mot.
- **Un test écrit contre l'état du jour, huitième occurrence** : « `src/licence.js` n'a rien à faire
  dans l'app du comptable » était vrai tant que le Cabinet n'avait pas de licence. La RÈGLE est
  « l'app gratuite n'embarque pas le PRODUIT payant » — et le code qui vérifie une signature n'est
  pas un produit : le secret n'est pas le code, c'est la clé privée (7.33.0). Le besoin se DÉDUIT
  désormais du `require`, comme les autres, et le test évalue les globs des clés publiques contre
  les deux vrais noms de fichier (le défaut de la 8.4.0).

Le test qui compte est `npm run e2e:cabinet-licence` : application ARMÉE pour de vrai (clé d'essai
embarquée par `SKANFACT_CLE_EMBARQUEE`, privée jamais sortie du dossier temporaire), trois dossiers
gratuits, cinq clients qui dépassent, la validation refusée pendant que lire / importer / saisir /
exporter restent ouverts, deux archivés qui rendent la main, trois clés refusées (autre cabinet,
client parrainé, charabia) et la bonne qui ouvre.

### 9.4.1 — La clé de réponse embarquée, et la console qui vend un cabinet

Deux moitiés d'une même chose : ce qui manquait pour que la révocation morde, et ce qui manquait à
la console pour vendre ce que la 9.4.0 avait rendu vendable.

**La clé de réponse.** `build/licences-publiques.json` porte enfin `reponse` (créée dans SkanFact
sur le Mac de Skander le 17/09/2026). Sa privée vit dans le réglage Cloudflare
`REPONSE_PRIVATE_KEY`. Sans elle, l'application ignorait TOUTE réponse du serveur — c'était le bon
défaut (8.4.0 : une réponse qu'on ne peut pas juger ne restreint rien), mais cela voulait dire
qu'aucune révocation ne s'appliquait chez personne.

- **Une clé privée qui a été VUE est brûlée**, et la règle n'a pas d'exception : celle du
  15/09/2026 avait transité par une conversation, elle a été jetée (les deux fichiers de
  `~/.skanfact/` supprimés), une paire neuve créée, le secret Cloudflare remplacé. Poser la publique
  dans le dépôt sans ce geste aurait armé une clé que quelqu'un d'autre peut imiter.
- **Une clé de réponse n'est jamais une clé de licence.** Un test exige qu'elle soit une Ed25519
  lisible, **distincte de toutes les `cles[]`** : une seule clé pour deux usages, et compromettre
  l'une emporte l'autre. Il exige aussi qu'aucun `PRIVATE KEY` ne traîne dans le fichier, et que
  `main.js` la lise bien dans `reponse.publicKey` — un champ renommé désarmerait la vérification en
  silence, exactement comme `licence-public*.json` ne couvrait pas `licences-publiques.json` (8.4.0).

**La console vend un cabinet.** La 9.4.0 avait livré deux tiers d'une vente : SkanFact Cabinet lit
une clé de cabinet, l'Éditeur de SkanFact en signe une — et la console, elle, ne connaissait que
deux offres. Trois moitiés d'une même vente, dont une seule vendait.

- **Le type est en QUEUE de charge et le reste** (`type`, `dossiersHors`) : au milieu, il changerait
  l'ordre des champs déjà signés, et une clé refabriquée depuis sa charge rangée en base ne serait
  plus identique à celle qu'on a envoyée — or c'est exactement ce qui permet de ne jamais ranger la
  clé (8.5.0). Deux colonnes de plus dans `licences` (`type`, `dossiers_hors`), NULL = entreprise.
- **Une empreinte se compare sans ses SÉPARATEURS.** La console range la forme nue
  (`3f9a2c1e…`), le cabinet lit la forme à tirets (`3F9A-2C1E-…`), et la 9.4.0 comparait
  caractère à caractère : une clé vendue par la console aurait été refusée par le cabinet qui l'a
  achetée. La clé porte donc la forme CANONIQUE (`canonEmpreinte`) et `licenceCabinet` normalise
  les deux côtés — mais retire seulement les séparateurs, jamais « tout ce qui n'est pas
  hexadécimal » : un G tapé pour un 6 doit rester une faute visible (8.1.0).
- **Aucun prix par défaut pour un dossier de cabinet** (`PRIX_CABINET_DOSSIER`, défaut 0 = le
  formulaire ne propose rien). Les tarifs du Cabinet ne sont pas fixés — l'avis de l'Ordre n'est pas
  revenu — et un chiffre écrit « pour l'exemple » devient un tarif par simple préremplissage. C'est
  la règle 9.1.1 (« la valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait
  rien ») appliquée à un prix.
- **`OFFRES['cabinet']` n'existe pas**, et c'est voulu : « cabinet » est un TYPE, rangé dans `offre`
  pour que la colonne reste renseignée. Tout `OFFRES[x].label` sur une licence de cabinet plante —
  d'où `libelleLicence`, une seule fonction pour le journal, le mail et la console. Le journal a été
  le premier à tomber.
- **Ce qui change de nature change de MAIL** : `licenceCabinet` (FR et EN) mène à *Réglages → Mon
  cabinet → Licence*, jamais aux Paramètres de SkanFact. Un test compare la phrase d'activation du
  worker à celle du gabarit de l'application : un client qui reçoit sa clé de la console ou de
  SkanFact lit le même chemin.
- **La licence du cabinet LUI-MÊME porte son empreinte comme SUJET**, pas comme parrainage :
  `licencesDuCabinet` l'exclut, sinon « ce cabinet a déjà parrainé quelqu'un » se corroborerait avec
  sa propre licence. Et la remise de parrainage ne se pose jamais sur une licence de cabinet.

Pièges rencontrés, tous déjà écrits ici :
- **Aucun backtick dans un commentaire d'un `template literal`** (quatrième fois, 7.20.0 / 7.29.0 /
  7.31.0) : deux commentaires de la console citaient `libelleLicence` et une règle CSS entre
  backticks — le fichier entier cessait d'être analysable, et l'erreur était signalée 1 000 lignes
  plus loin. Le bisect ligne par ligne l'a désigné en dix secondes ; la relecture, non.
- **Trois assertions ancrées sur une FORME sont tombées sur du code juste** : `discountRate: v.parrain ? `
  (recopiée mot pour mot, elle tombe dès que le geste gagne un garde-fou légitime — piège 7.16.0),
  et deux tranches bornées sur un voisin qui a déménagé. Les trois ont été **retournées vers la
  règle**, pas rafistolées : la remise dépend du parrainage et vit sur la facture ; le contrôle
  d'empreinte passe par core.js et sert ses DEUX champs.
- **Un champ caché par `hidden` reste visible dans la console** : `label.f{display:block}` bat
  l'attribut du navigateur. On cache par le style (`montrerChamp`).
- Piège de test : une ligne lue par SQLite arrive **sans prototype**, et `deepStrictEqual` compare
  aussi les prototypes.

Prouvé : **27 défauts réintroduits un par un** font tomber leur test — dont trois qui ne pouvaient
tomber qu'en les remettant (la clé de réponse redevenue `null`, la clé de réponse confondue avec la
maître, l'empreinte nue dans la clé signée). `npm run e2e:console` gagne une étape (le type, le
quota, l'empreinte, et la clé que SkanFact Cabinet reconnaît pendant que SkanFact la refuse).

### 9.4.2 — L'exemple qui ne périme plus, et le premier jour d'un comptable

Skander : « quand je fais la mise à jour des 2 app, recharger les nouveaux jeux de données
automatiquement, car on part du principe que mon comptable qui est en train d'essayer l'app cabinet
ne va pas appuyer sur effacer l'exemple et ensuite charger l'exemple à chaque nouvelle mise à jour »,
puis « faut que le ui/ux de l'app cabinet soit niquel car c'est le comptable qui teste ».

**L'exemple se refait tout seul.** `core.exemplePerime(repere, version, mois)` et son jumeau dans
`cabcore` (corps identiques, comparés par un test, comme `round3` et `pastille`) rendent le MOTIF —
`'version'`, `'mois'`, ou rien. Le repère `{ version, mois }` vit dans `data.exemple` et
`state.exemple`, et il entre dans les deux migrations : absent de la liste, il serait jeté au
prochain chargement et l'exemple se referait à CHAQUE ouverture, en silence (défaut `matricule`,
6.8.0).

- **Le mois compte autant que la version** : le jeu d'exemple est relatif à aujourd'hui. Chargé en
  septembre et rouvert en décembre, il montre trois mois de retard chez des clients censés être à
  jour. Un exemple périmé apprend des choses fausses sur le produit.
- **On ne remplace que ce qui EST déjà l'exemple** (`estDemo` / `dossiers.some(d => d.demo)`), et
  l'application le DIT dans le bandeau — un jeu de données qui change sans un mot ferait douter du
  reste. `retirerExemple` remet le repère à zéro, sinon un exemple rechargé à la main se referait au
  démarrage suivant.
- **Côté Cabinet, une sauvegarde avant ; côté entreprise, surtout pas.** `demoSortie` reprend la
  sauvegarde « avant-demo » la PLUS RÉCENTE : c'est le seul chemin de retour vers les vraies données.
  En écrire une ici rangerait l'exemple par-dessus, et « Repartir de mes données » rendrait l'exemple.

**`npm run e2e:cabinet-jour1` — l'instrument qui manquait.** `e2e:cabinet` vérifie que les GESTES
marchent ; celui-ci regarde ce qu'un comptable VOIT, dans l'ordre où il le voit, et le mesure : 35
écrans photographiés du mot de passe à l'Aide, à 1440 et à 1280. Ce qu'il a trouvé du premier coup :

- **Neuf boutons se lisaient comme du texte en gras** — les cinq « Voir » de « À faire », « Exporter
  en CSV », « Exporter le livre-journal », « Noter une relance faite ailleurs… », et « Enregistrer ma
  clé… », c'est-à-dire l'action la plus importante de l'application. `.btn-ghost` n'avait ni fond, ni
  bordure, ni couleur propre. **Un bouton se reconnaît AU REPOS, jamais au survol : personne ne
  survole ce qu'il ne voit pas.** La règle datait de Cabinet 1.0.0 et n'était tenue par aucun test —
  elle l'est maintenant, dans l'application réelle : fond, bordure, soulignement ou couleur, sinon
  c'est du texte. Les deux exceptions (pied de barre latérale, « Passer » d'un assistant) sont
  nommées et portent l'autre signe.
- **La page Relances félicitait un cabinet qui n'a aucun client** : « Personne à relancer : tous tes
  dossiers sont à jour » sur un portefeuille vide, et zéro bouton. C'est la règle de la 7.0.0 —
  vérifier que l'univers concerné est non vide avant de rassurer — et c'était la seule des trois
  pages à ne pas l'appliquer : Échéances et Écritures ont leur état vide avec son geste depuis
  toujours. **Quand deux écrans font le même métier, celui qui diverge est celui qui a tort.**
- **L'avertissement le plus important de l'application se lisait SOUS le bouton** qui crée le
  cabinet — « il n'y a aucun moyen de récupérer ce mot de passe », lu une fois le mot de passe
  choisi. Un avertissement, comme un refus, dit ce qu'il faut savoir AVANT d'agir : il est au-dessus,
  dans un encadré (`warn-box grave`), aligné à gauche — une phrase de trois lignes centrée ne se lit
  pas.
- **Neuf champs de saisie sans bulle « i »**, dont les cinq touches de la grille : « Solder la
  pièce » ne dit pas ce que le geste FAIT, et c'est exactement ce qu'on veut savoir avant de lui
  donner une touche. Trois listes déroulantes nues (« L'exercice », « 2026 », « Tous les journaux »)
  ont reçu leur étiquette et leur `aria-label`.
- **L'assistant annonçait « Quatre écrans » au-dessus de CINQ pastilles qui les montraient.** Une
  phrase affichée que rien ne tient est un bug (7.3.0) ; celle-ci se démentait toute seule, à
  l'écran, depuis le premier jour. Le compte se déduit de `etapes.length`.
- Le champ « Journal proposé » coupait son propre texte d'invite (`field narrow` sur un texte long) ;
  les paragraphes d'introduction couraient sur 1 140 px (`.lead` était borné à 760 px depuis
  toujours, eux non) ; deux cases à cocher voisines n'étaient pas alignées.

**La ponctuation double porte une espace insécable.** En français, `?` `!` `;` `:` et l'intérieur des
guillemets la demandent ; sans elle le navigateur coupe la ligne juste avant, et sur l'écran de
bienvenue le « ? » se retrouvait seul en début de ligne. `typographie(racine)` travaille sur les
NŒUDS DE TEXTE d'une prose déjà posée (`createTreeWalker` + `NodeFilter.SHOW_TEXT`) : aucune balise
n'est touchée, et seule la prose est concernée — les titres, libellés et cellules gardent leurs
espaces ordinaires, donc rien de ce qu'un test compare ne change. Trois portes l'appellent : la page,
l'assistant (hors de `#view`) et les fenêtres. *L'app entreprise ne l'a pas encore : à porter le jour
où sa prose est revue (règle 7.3.0 — une règle apprise d'un côté se vérifie de l'autre).*

**La console horodate son « Vu ».** Skander : « je veux l'heure aussi avec la date, afin de voir
quand le comptable a testé l'app ce jour-là ». Deux questions différentes, deux réponses : la phrase
(« aujourd'hui », « hier ») dit si l'installation vit encore, l'horodatage dit à quelle heure.
Et **un jour est un jour du CALENDRIER, pas une tranche de 24 heures** : une application ouverte hier
à 23 h et regardée ce matin à 8 h se lisait « aujourd'hui ». Les jours se comptent en UTC dans le
worker (les deux horodatages viennent du serveur) et dans le fuseau du navigateur dans la console
(c'est SON « aujourd'hui » qui est en question, règle 5.2.3). Le journal des événements affichait
l'heure UTC à côté d'une date UTC : tout passe par la même horloge, la locale.

Pièges rencontrés, tous déjà écrits ici :
- **Aucun backtick dans un commentaire d'un `template literal`** (cinquième fois) : j'ai écrit
  `` `jour()` `` dans un commentaire de la console, et le fichier entier a cessé d'être analysable.
- **Un test qui lit du code doit lire du CODE** (deuxième fois dans la même version) : le commentaire
  qui explique le défaut de l'assistant CITE la phrase interdite, et faisait tomber le test sur du
  code juste. Les commentaires de bloc se retirent avant de juger, pas seulement ceux de ligne.
- **Une classe du Cabinet n'a rien à faire dans la feuille partagée** : `.wiz-actions .btn-ghost`
  posé dans `style.css` a fait tomber le test de collision de la 6.8.0, immédiatement.
- **Une clé de bulle doit être LITTÉRALE et en dernier argument** : fabriquée par concaténation
  (`'sa.k.' + k`), elle échappe au test qui relit l'interface, et le texte d'aide meurt oublié.
- **Une classe utilisée et jamais définie ne se voit nulle part** (8.1.0) : `.f-lab` a été écrite
  dans le HTML avant d'exister dans la feuille.
- **Et un test qui ne pouvait pas échouer, trouvé par la preuve elle-même** : celui du bouton
  discret cherchait `/\.btn-ghost \{/` sans ancrer en début de ligne, et tombait donc sur
  `.sidebar-foot .btn-ghost {`, deux cents lignes plus haut — la seule règle qui a le DROIT d'être
  sans bordure. Il jugeait la mauvaise, et restait vert avec le défaut remis. Dans un fichier CSS,
  un sélecteur se lit avec `^…$`, sinon on lit celui d'un descendant.

Prouvé : **18 défauts réintroduits un par un** font tomber leur test.

### 9.4.3 — Le socle visuel du Cabinet, et les instruments qui le tiennent

Skander : « faut qu'on se pose et prenne du recul… il faut pas juste que ça soit fonctionnel, mais
faut que ça soit ergonomique, pratique et moderne », et le reproche qui va avec : « tu rajoutes des
choses au fur et à mesure du développement mais tu penses pas au rendu global ui/ux quand tu le
fais ». Il avait raison, et la cause est mesurable.

**L'app entreprise est tenue par quatre instruments qui mesurent ce qui s'AFFICHE** — `e2e:contraste`
(441 boutons), `e2e:colonnes` (405 colonnes), `e2e:entetes` (21 pages), `e2e:barre`. **Aucun des
quatre ne regardait l'app Cabinet.** Pas un. Elle a reçu les fonctionnalités de sa jumelle et aucun
de ses garde-fous visuels, et elle a dérivé très exactement là où personne ne mesurait. C'est la
règle 7.3.0 — « une règle apprise d'un côté se vérifie de l'autre » — appliquée non plus à une règle
mais à un INSTRUMENT : *un garde-fou qui ne couvre qu'une des deux applications ne protège qu'une
des deux applications.*

Règles apprises, à ne pas recasser :

- **Une capture qui ne montre pas la page entière fait juger une page sur son premier écran.** Ce
  n'était pas un `fullPage: true` oublié : les deux applications posent un cadre FIXE
  (`#app { height: 100vh }`) et c'est `main#view` qui défile, donc le DOCUMENT ne dépasse jamais la
  fenêtre et « page entière » rend exactement la même image qu'une capture d'écran. Tous les audits
  faits jusqu'ici ont relu un quart de page en croyant relire la page — le grand livre d'un dossier
  fait **6 462 px**. `capturePleine()` (harnais) relâche le cadre le temps de la photo, y compris
  les couches en `position: fixed`, puis le remet ; les mesures sont prises AVANT le relâchement.
- **Un parcours qui n'ouvre que l'onglet par défaut juge un sixième de la page.** Les six
  sous-onglets de la Comptabilité d'un dossier — dont la **Saisie**, l'écran où un comptable passe
  ses journées — n'avaient jamais été photographiés une seule fois. Les ouvrir a fait tomber six
  défauts en une passe.
- **Un mécanisme de MESURE se partage comme un mécanisme de production.** Les trois sondes
  (contraste et débordement, alignement des colonnes, barres d'en-tête) vivent dans
  `test/e2e/harnais.js`, en un exemplaire, et les quatre parcours les appellent. Recopiée dans un
  quatrième fichier, une sonde aurait divergé (7.29.0) — et c'est précisément la faute qu'on répare.
- **Un titre gris de 11 px ne hiérarchise rien : il décore.** `.panel h2` était le SEUL style de
  titre de section des deux applications — 11 px, gris, capitales, `letter-spacing: 1.2px` — et il
  donnait le même poids à « Comptabilité » qu'à « Abonnements ». Trois niveaux désormais, un rôle
  chacun : `h1` la page, `.panel h2` la section (15,5 px, couleur du texte), `.eyebrow` la
  sur-étiquette en capitales, **au-dessus d'un chiffre et jamais comme titre**.
- **La même déclaration était recopiée HUIT fois**, six dans la feuille partagée, une dans celle du
  Cabinet, et deux avaient déjà dérivé (12 px au lieu de 11, `.5px` au lieu de `1px`). C'est la
  démonstration du motif : un mécanisme recopié ne diverge pas peut-être, il diverge. Il en reste
  un, sous trois sélecteurs qui partagent le rôle, et un test le compte.
- **Une classe posée par le code et inconnue de la feuille ne se voit nulle part.** Les six onglets
  de la Comptabilité posaient `class="on"` ; la feuille ne connaît que `.tabs button.active`, et
  `#d-tabs` comme `#set-tabs` l'utilisent déjà. **Aucun des six ne montrait lequel était ouvert,
  depuis la 9.1.0**, et je l'avais sous les yeux sur une capture sans le voir. Quatrième occurrence
  du motif après `th.r` (7.23.0), `.help-fil` (7.27.0) et `.mono` (8.1.0).
- **Le rapport entre une case et son en-tête de colonne est évident à l'œil et invisible au
  clavier.** Les cinq cases de chaque ligne de la grille de saisie, le sélecteur de compte du grand
  livre et du lettrage, les deux filtres de la Recherche : huit champs sans étiquette, sans
  placeholder et sans `aria-label`. Le numéro de ligne entre dans l'étiquette, sinon cinq cases
  annoncent toutes « Compte ».
- **Une application de bureau s'ouvre le matin et se referme le soir.** Le Cabinet n'avait **aucun**
  thème sombre — pas une ligne, pas un réglage — alors que l'app entreprise en a un depuis la 1.6.0.
  Défaut « auto » : on suit le système plutôt que d'imposer un choix que personne n'a fait, et on
  RÉAGIT quand il bascule (un réglage lu une fois au démarrage se périme, 7.1.x). Le thème
  s'applique avant d'être enregistré — on choisit une apparence en la voyant — et si l'écriture
  échoue on remet ce qui était là.
- **Un réglage se choisit en le VOYANT** : trois cartes avec leur miniature, pas une liste
  déroulante. Les couleurs de ces miniatures sont écrites en dur, et c'est le seul endroit du projet
  où c'est juste : la miniature du thème clair doit rester claire quand on est en sombre.
- **Ce qui décide d'un export est le FICHIER, pas l'étiquette du dossier.** `ecrituresPlan` sautait
  les dossiers d'exemple — juste en 6.8.0, où l'exemple n'avait aucun fichier ; faux depuis la 9.2.2,
  où il livre de vrais `.skanpack`. La page Écritures proposait donc une période construite sur les
  paquets de l'exemple, puis se déclarait vide dessus : quatre zéros et un bouton éteint sur un
  portefeuille plein. La garde `demo` ne décide plus que d'une chose : on ne RÉCLAME rien à un
  client qui n'existe pas.
- **Un test qui lit du CSS doit lire du CSS** (6.8.0, re-rencontrée) : ma première version du test de
  l'échelle de titres tombait sur son propre commentaire, qui cite les sélecteurs qu'il explique.
  Les commentaires de bloc se retirent avant de juger, et on vérifie que le nettoyage n'a pas mangé
  le code.
- Piège de ma propre méthode : une chirurgie `python` sur un fichier de test a emporté la constante
  `SEUIL` qui vivait entre deux blocs déplacés — `contraste.js` est parti en `ReferenceError` au
  premier appel. Une tranche qu'on découpe se relit après découpe, pas seulement avant.

Numérotation : le chantier UI/UX du Cabinet prend **9.4.3 → 9.4.9** (il était prévu jusqu'à 9.4.6 ;
l'audit en a rempli trois de plus) et l'entretien qui portait le numéro 9.4.3 devient **9.4.10**.
23 occurrences dans cinq documents à chaque décalage, contre 281 pour la renumérotation de la v2 :
prendre le numéro suivant plutôt que décaler toute la suite est ce qui rend l'opération tenable.
**Et on ne renumérote JAMAIS une version déjà livrée** — celles du CHANGELOG sont l'histoire, pas
un plan : le script de décalage ne touche que les documents de planification, et le vérifie.

Prouvé : cinq défauts réintroduits un par un font tomber leur test, et le sixième (l'en-tête de
colonne désaligné) a été trouvé par l'instrument lui-même à sa première exécution.

### 9.4.4 — La page Dossiers : le portefeuille au-dessus de la ligne de flottaison

Premier volet du chantier UI/UX, et le défaut qu'il corrige se mesure en un chiffre : sur un
portable de 1280×800, la liste des clients commençait à **800 px** — le bas de l'écran. Elle
commence à **523 px**. Devant elle passaient quatre cartes de 180 px, un panneau « À faire » de six
lignes qui ne se repliait pas, un bandeau, une recherche de 1 220 px et une rangée de filtres.

Règles apprises, à ne pas recasser :

- **Le produit ne se mérite pas au défilement.** La page Dossiers EST le portefeuille, et c'est la
  seule chose qu'aucun autre logiciel ne donne à un comptable. Ce qui passe devant lui doit tenir
  en un coup d'œil. La règle est désormais MESURÉE (`e2e:cabinet-jour1`, étape 12) : le haut du
  tableau, dans la fenêtre, à 1280×800, sous 560 px. Le seuil n'impose pas une maquette, il
  interdit de repousser le produit hors de l'écran — prouvé en remettant les cartes hautes et le
  panneau non plafonné : 756 px, et le parcours tombe.
- **Un panneau d'alertes se replie, et ce qu'il cache se COMPTE.** Six lignes font 400 px.
  « À faire » garde les DEUX plus urgentes (la liste est triée par urgence) et propose « Voir
  4 autres lignes » : un « voir plus » qui ne dit pas combien ne se clique pas. Le choix est
  mémorisé — l'app entreprise a `todo-toggle` + `prefs` depuis la 2.2.0, le Cabinet ne l'avait
  jamais reçu (le jumeau manquant, encore).
- **Cinq libellés identiques ne disent pas où ils mènent.** Les six lignes de « À faire » partaient
  à six endroits et cinq disaient « Voir » : on clique pour savoir, et on revient. Un libellé décrit
  l'écran d'ARRIVÉE (7.29.0). Le test n'écrit pas la liste des libellés — il interdit le DOUBLON,
  donc il ne se périme pas au septième.
- **Une couleur seule n'est pas une information.** Une pastille rouge, orange ou verte devant chaque
  client, et rien nulle part ne disait ce que ça voulait dire : ni apprenable au premier jour, ni
  lisible pour qui distingue mal le rouge du vert, ni visible sur une impression. La légende est
  confrontée par un test aux niveaux que `dossierRow` PEUT produire — lus dans cabcore, jamais
  recopiés : c'est la couverture des treize boutons morts (7.0.0) appliquée à une couleur.
- **`rowmenu.js` est partagé depuis la 7.29.0, et la page principale du Cabinet ne l'utilisait pas.**
  Relancer un client depuis le portefeuille demandait trois écrans. Le menu ne vole pas le clic de
  la ligne et la ligne ne vole pas le sien (piège 7.28.0). `writeRelance` attend une LIGNE de
  `dossierList`, pas la fiche brute : les deux existent au même endroit et se ressemblent — c'est
  exactement ce qui produit un mail vide.
- **Un avertissement juste au mauvais moment apprend à ignorer la couleur.** Le tout premier écran
  d'un comptable, avant qu'il ait un seul client, était un bandeau ROUGE sur la clé de secours.
  Avant le premier paquet, il n'y a rien à perdre : ligne calme avec son bouton au jour 0, rouge dès
  qu'un paquet est sur le disque. C'est « un filet se réclame au moment où il protège encore »
  (QUESTIONS.md), pris par l'autre bout — et le bouton reste dans les deux cas, prévenir sans offrir
  le geste ne sert à rien.
- **Une colonne entièrement vide coûte de la largeur à toutes les autres.** Trois d'entre elles ne
  contenaient que des tirets. On les masque, on le DIT, et « Tout afficher » les rend : masquer sans
  le dire serait un piège (7.12.0).
- **La colonne d'actions d'une table large reste collée à droite.** Neuf colonnes débordent sur un
  portable : le menu de la ligne partait 17 px hors de l'écran, et il fallait défiler de côté pour
  l'atteindre. Un geste qu'on doit chercher n'est pas un geste.
- **La chaîne de `:not()` de la règle générale des champs gagne toujours** (quatrième fois, après
  `.help-search` en 7.27.0 et le thème sombre en 7.30.0) : `.champ-loupe input` perdait, donc la
  loupe se posait SUR la première lettre du texte. Ça ne se voit qu'en regardant l'écran.
- Deux affinages de l'instrument, chacun avec sa raison écrite : un bouton dans un `.scroll-x` n'est
  pas « hors de l'écran », il est à une molette (marqueur explicite du projet depuis la 7.13.0) ; et
  un en-tête de section repliable (`collapse-h`) porte ses trois signes au repos — chevron, curseur,
  compteur — comme l'en-tête cliquable de la 7.14.0. Les exceptions sont NOMMÉES dans une liste :
  une exception anonyme est un trou.

### 9.4.5 — Le livre : on le parcourt au lieu de le subir

La suite du même chantier, sur l'écran où un comptable passe ses journées. Les chiffres, mesurés
avant et après par `e2e:cabinet-jour1` : grand livre **6 554 → 2 170 px**, livre-journal
**5 888 → 3 268 px**, fiche Comptabilité **3 608 → 3 098 px**.

Règles apprises, à ne pas recasser :

- **Paginer ne suffit pas quand le tout tient sur une page.** Le grand livre de l'exemple a vingt
  comptes : `paginate` à 50 ne mordait sur rien, et la page faisait toujours sept écrans. Ce qui la
  faisait longue, ce n'était pas le NOMBRE d'objets, c'était leur TAILLE. Chaque compte est replié
  sur sa ligne de synthèse — un comptable **ouvre** un compte, il ne lit pas les vingt d'affilée —
  et le plan du grand livre se lit enfin d'un coup d'œil. Avant de paginer, demander ce qui prend
  la place.
- **Un objet replié porte son chiffre.** Un compte réduit à son numéro serait une table des
  matières ; avec ses mouvements, son débit, son crédit et son solde, c'est une balance qu'on peut
  déplier. Et les trois chiffres tombent en **colonnes** d'un compte à l'autre (`min-width` +
  `text-align: end`) : sans ça « Solde » change de place à chaque ligne et on le cherche à chaque
  fois au lieu de descendre la colonne.
- **`justify-content: space-between` compte le `::before` comme un troisième élément.** Le chevron,
  le nom, les chiffres : les trois étaient écartés, donc le nom du compte finissait **centré**,
  flottant au milieu d'une ligne dont les deux bouts étaient pris. `margin-inline-end: auto` sur ce
  qui doit rester à gauche. Aucune sonde ne mesure ça ; une capture le montre en une seconde.
- **Un commentaire qui décrit ce que le code ne fait pas est un bug.** Le mien annonçait que
  l'alignement des chiffres « fait qu'on lit la colonne Solde sans la chercher » — et il n'y était
  pas. C'est « une phrase affichée que rien ne tient » (7.3.0), appliquée au code.
- **Une ligne repliée sur trois lignes de texte triple la hauteur de tout le tableau.** Dix-sept
  pièces faisaient 5 888 px : un libellé de facture porte le nom du client, et la colonne passait à
  la ligne. `td.tronq` (feuille PARTAGÉE, les deux applications en profitent) tient la cellule sur
  une ligne, le texte entier au survol, intact à l'export. Un journal se PARCOURT — on y cherche
  une pièce — et ce qu'on y lit d'abord, c'est le compte, le montant et la date.
- **On pagine ce que l'écran MONTRE, et on le NOMME.** Le livre-journal se pagine par **pièce**
  (couper une pièce en deux montrerait un débit sans son crédit, et le lecteur conclurait à un
  déséquilibre qui n'existe pas), le grand livre par compte, la balance et le lettrage par ligne.
  Un pied qui annonce « 25 sur 340 lignes » là où ce sont des pièces raconte autre chose que le
  tableau. Et le pied de totaux porte sur la **sélection entière** — il se calcule sur `gardees`,
  jamais sur la page, comme dans l'app entreprise depuis la 2.2.0.
- **`pagerBar` s'appelle AVANT `paginate`** : c'est lui qui ramène `page` dans les bornes quand un
  filtre vient de réduire la sélection. L'inverse affiche une page vide, puis la bonne au redessin
  suivant — c'est-à-dire un tableau qui paraît vide sans raison.
- **Les trois aides de pagination prennent un ÉTAT** (`st = listState` par défaut, donc la page
  Dossiers n'a pas bougé). Câblées en dur sur `listState`, elles ne pouvaient servir qu'à une seule
  liste de toute l'application : un mécanisme qui ne se paramètre pas se recopie, et une copie
  diverge (7.29.0).
- **Un total vit SOUS sa colonne.** Une somme annoncée dans une phrase à gauche de l'écran ne se
  compare à rien : l'œil descend une colonne de montants et doit trouver son total au bout de
  CETTE colonne. Le pied de la grille de saisie porte débit, crédit et l'écart, en chiffres de même
  chasse — et la ligne d'écart ne s'affiche que s'il y en a un.
- **Un bouton éteint dit POURQUOI**, et par la MÊME fonction que celle qui refusera à
  l'enregistrement (`ecritureValide`). Un contrôle recopié dans l'écran finirait par diverger du
  moteur, et le bouton s'éteindrait sur une pièce que l'enregistrement accepte — ou l'inverse, bien
  pire. Le motif se lit **au-dessus** des boutons (9.4.2), en gris : pendant qu'on tape, « la date
  manque » est l'état NORMAL d'une pièce qu'on commence, pas une alarme.
- **Un raccourci s'AFFICHE comme une touche.** « Control+Enter » au milieu d'une phrase grise se lit
  comme une faute de frappe ; ⌃ + ↵ en relief se reconnaît sans être lu. C'est ce que Skander a vu
  sur une capture : « la section "les touches" sont en texte, alors que personne ne fait ça ». Les
  noms sont ceux d'un clavier **français** (`NOM_TOUCHE`), pas ceux de `KeyboardEvent.key`, et la
  ligne d'aide suit les touches RÉGLÉES — une aide qui annonce F2 quand la touche est F5 est pire
  que pas d'aide.
- **Une touche se règle en APPUYANT dessus.** Personne ne sait que la touche Entrée s'appelle
  « Enter » ni que Ctrl s'appelle « Control » : une faute de frappe donnait un raccourci qui ne se
  déclenchait jamais, sans rien à l'écran pour le dire. Le champ reste un `input` (donc l'étiquette,
  la bulle et le focus), mais en lecture seule — c'est le clavier qui l'écrit. Échap rend la main :
  on sort toujours d'un champ qui avale le clavier. Un modificateur seul n'est pas un raccourci.
- **Le format interne ne fuit pas dans un écran de saisie.** Le champ Date affichait
  « 2026-09-17 » sous une invite qui annonce « 04/03/2026 ». L'écran montre le jour en français, la
  PIÈCE garde l'ISO, et `dateTapee` continue d'accepter 4, 4/3, 04/03/2026 et l'ISO.
- **Un champ PRÉ-REMPLI se sélectionne au clic.** La date proposée (aujourd'hui, ou le dernier jour
  de l'exercice) a fabriqué son propre défaut : cliquer dedans et taper « 4/3 » donnait
  « 17/09/20264/3 ». C'est `e2e:saisie` qui l'a montré — la relecture, jamais. Corollaire : toute
  valeur qu'on propose doit pouvoir être remplacée en une frappe, sinon on l'a imposée.
- **Un bouton « Enregistrer » nu dans une page à plusieurs panneaux ne dit pas ce qu'il enregistre.**
  Trois cohabitaient dans les Réglages. Dans une fenêtre, « Enregistrer » suffit — c'est son titre
  qui le dit ; dans une page, non.
- **Un e2e ancré sur une FORME se périme à la refonte suivante** (sixième fois, après 7.3.0, 7.28.0,
  7.29.0, 7.30.0 et 9.2.2) : `e2e:boucle` attendait `#c-livres .panel h2`, la balise qui titrait un
  compte. On reconnaît un compte à ce qu'il EST (`.gl-compte`), et on en profite pour exiger la
  règle que la refonte a créée — chaque compte replié porte son solde.
- **Une assertion qui exige l'ISO à l'écran décrit le format interne, pas la règle** (neuvième
  occurrence du motif) : `e2e:saisie` a été **retourné** — l'écran affiche « 04/03/2026 », la pièce
  porte `2026-03-04`, et le parcours vérifie les DEUX.

Prouvé : huit défauts réintroduits un par un font tomber leur test, et deux des corrections (le nom
centré, la date pré-remplie qu'on ne peut pas remplacer) n'ont été trouvées que par la capture et
par le parcours réel.

### 9.4.6 — Les Échéances : la répétition, le geste, et le droit à l'erreur

Règles apprises, à ne pas recasser :

- **On pointe une OCCURRENCE, jamais une règle** (7.21.0, jamais portée ici) : `tva-m@2026-05-15`.
  Faire taire « TVA » ferait taire tous les mois suivants. La clé se fabrique en UN endroit
  (`K.cleEcheance`) : deux versions divergeraient au premier changement de format, et un dépôt
  pointé cesserait d'être reconnu sans rien dire. Et le filtre de `migrate` **borne le mois et le
  jour**, il ne les compte pas : « tva-m@2026-13-99 » ne pourra jamais désigner une échéance réelle,
  donc il n'a rien à faire dans les données.
- **Un pense-bête dit qu'il n'est qu'un pense-bête**, sur l'écran, sous le bouton : le Cabinet ne
  dépose rien et ne se connecte à aucune administration (règle 5.2.0). Une application qui laisserait
  croire à un dépôt réel se tromperait un jour sans que personne ne le sache.
- **Une explication se lit une fois.** Le `detail` décrit la RÈGLE, pas l'occurrence : la même phrase
  de 90 caractères s'affichait sous les quatre mois de TVA d'affilée. Et les mêmes clients
  réénumérés d'une carte à l'autre font croire à quatre problèmes différents — quand la liste est
  identique à celle qu'on vient d'écrire, on le DIT. Mais on ne remplace jamais une liste qui
  CHANGE par un compte : c'est l'information, pas le bruit.
- **Un lien souligné au milieu d'une phrase n'est pas un geste**, et « Les relancer » qui ouvre les
  soixante ne tient pas sa promesse (7.15.0). Le bouton POSE la sélection, puis navigue — et le
  filtre porte sur TOUT l'écran : le bandeau, la liste et le « Relancer » de groupe (7.18.0).
- **Un filtre de parcours ne survit pas à la sortie de sa page.** Le retrouver trois jours plus tard
  sans savoir d'où il vient serait le piège du filtre qui cache ce qu'on est venu chercher.
- **Deux mécanismes de l'app entreprise n'avaient JAMAIS été portés** — zéro occurrence des deux
  côtés du fichier (règle 7.3.0, encore) : `toastUndo` (le « Annuler » de huit secondes ; le CSS
  était déjà dans la feuille partagée, seul le JavaScript manquait) et `vers()`, sans quoi poser un
  filtre puis viser la page courante ne redessine rien. Le Cabinet avait exactement les gestes qui
  en ont besoin.
- **Une tranche de test s'ancre sur du code, jamais sur un nombre.** Celle de l'état vide des
  Relances sautait « les 40 premiers caractères » pour ignorer un `view.innerHTML` : elle a basculé
  sur un autre bloc dès qu'une ligne s'est insérée entre le `if` et lui — et le test a accusé du
  code juste. Elle va maintenant du `if` au `return;` que le code PORTE.
- **Un test de source dit qu'un bouton existe, pas qu'il agit.** Les trois gestes (pointer, annuler,
  partir relancer) sont refaits dans l'application réelle par `e2e:cabinet`, qui mesure aussi le
  `pointer-events` du bandeau : c'est le seul moyen d'attraper le défaut de la 5.2.2, où le bouton
  est parfaitement visible et parfaitement inerte.

Prouvé : six défauts réintroduits un par un font tomber leur test pur, et deux de plus font tomber
le parcours réel.

### 9.4.7 — La fiche d'un client : l'année entière, dans le bon sens

Règles apprises, à ne pas recasser :

- **Un calendrier se lit dans le sens du temps.** `.reverse()` affichait « Août, Juillet, Juin, Mai,
  Avril, Mars » sous une étiquette « 2026 » : le moteur (`dossierMonths`) rendait l'ordre juste,
  c'est l'écran qui l'inversait. Ce sont les ANNÉES qui vont de la plus récente à la plus ancienne —
  on arrive pour le mois courant — jamais les mois à l'intérieur d'une année.
- **Un extrait sans son cadre fait douter de l'outil.** Six mois affichés sur douze, sans un mot :
  on ne savait pas si la mission commençait en mars ou si l'application avait perdu les deux
  premiers. Les douze mois sont là ; ceux qui ne comptent pas sont en retrait et DISENT pourquoi.
  C'est le calendrier qui explique l'extrait, jamais l'inverse.
- **Une étiquette approximative sur un calendrier fait douter de tout le tableau** : « à venir » sur
  le mois où l'on EST est faux — il est *en cours*, et c'est précisément pour ça qu'il n'est jamais
  réclamé.
- **Un mois qui NOMME un manque porte le geste qui va avec** (7.15.0) — et la relance part sur CE
  mois-là, pas sur les six. Nommer un mois et en réclamer six est la même promesse non tenue que
  « Les relancer » qui ouvrait les soixante clients (9.4.6).
- **Un `flex-wrap` n'aligne rien d'une ligne à l'autre** : chaque année se recalait sur son propre
  contenu. Une vraie grille de douze colonnes met mars 2025 au-dessus de mars 2026, et c'est ce qui
  permet de comparer deux exercices d'un coup d'œil. Sous 1340 px elle passe à six colonnes,
  deux rangées par année — l'alignement tient toujours.
- **Un état vide SECONDAIRE s'annonce, il ne se contemple pas.** `.empty` fait 48 px de haut avec
  son cadre pointillé : c'est la bonne présence quand la page ENTIÈRE est vide — c'est le premier
  écran, il doit occuper la place. Au milieu d'une fiche déjà pleine, le même bloc consacrait 250 px
  à « aucune relance enregistrée » et repoussait tout le reste. `.empty.mini` pour les seconds, et
  le test vérifie les DEUX sens : un état vide qui est le corps de son écran garde sa présence,
  sinon on aurait juste remplacé un excès par l'autre.
- **Un test trop LARGE accuse du code juste**, exactement comme un test trop étroit (9.1.0) :
  `indexOf('Aucun paquet reçu')` tombait sur « Aucun paquet reçu pour l'instant… », le corps d'un
  onglet qui a raison de garder sa présence. Les phrases se citent entières, ponctuation comprise,
  et le test vérifie qu'elles ne sont pas ambiguës avant de juger.
- **Un e2e qui saute sa moitié ne prouve rien.** Ma première version ouvrait le premier dossier
  venu ; il n'avait aucun mois manquant, donc le geste n'était jamais exercé — et le parcours
  affichait « ok ». Il cherche maintenant un dossier qui en a un, et échoue s'il n'en trouve aucun.

Prouvé : cinq défauts réintroduits un par un font tomber leur test, et le parcours réel exerce les
deux moitiés du geste.

### 9.4.8 — Les finitions du Cabinet

Le reste de l'audit du 17/09/2026 : dix constats « moyens » et cinq « mineurs ». Aucun n'est grave
pris seul ; ensemble, ce sont eux qui font « pas fini ».

Règles apprises, à ne pas recasser :

- **Une case à cocher vient AVANT son libellé.** Dans une grille pleine largeur (`span-2`),
  l'écrire après la posait 500 px à droite du texte qu'elle coche : l'œil la cherche à gauche et ne
  la trouve pas. Cinq des sept cases de l'application le faisaient déjà — celle qui diverge est
  celle qui a tort (règle 9.4.2).
- **Un champ qui compte dans une unité le DIT à côté de lui.** « Jour de relance : 10 » — dix
  jours ? le 10 ? — et c'est cette date qui déclenche les relances de tout un portefeuille. Le mot
  encadre le champ (`le` … `de chaque mois`) au lieu de flotter en légende dessous : une légende
  sous un champ se lit après l'avoir rempli.
- **Une liste fermée ne se saisit jamais en texte libre** (7.30.0, re-trouvée) : « VTE » au lieu de
  « VT » ne correspond à aucun journal, et la grille de saisie s'ouvre alors sur le premier venu
  sans un mot. Corollaire immédiat (8.3.0) : le code DÉJÀ réglé reste dans la liste, sinon rouvrir
  les Réglages pour changer autre chose l'effacerait — un `select` dont aucune option ne correspond
  retient la première, en silence.
- **Un repère visuel sans chiffre ne dit pas combien il reste.** Cinq pastilles disent qu'il y a
  plusieurs écrans ; « Écran 2 sur 5 » dit où l'on en est. Et le compte se DÉDUIT de `etapes.length`
  — écrit à la main, il mentirait au premier écran ajouté, ce qui est exactement le défaut corrigé
  en 9.4.2 sur la phrase du même assistant.
- **La règle générale des pastilles vise TOUS les `span`** : sans `:not(.wiz-compte)`, le compteur
  devenait une barre de 26×4 px sans texte visible. Cinquième fois que ce motif revient (7.23.0,
  7.27.0, 7.30.0, 8.1.0) : le HTML est juste, c'est la feuille qui décide.
- **Un en-tête de fiche a un budget de boutons, comme une ligne de liste** (7.29.0). « Imprimer »
  occupait une place premium à côté des gestes quotidiens ; « Appeler » et « WhatsApp » dépendent
  d'un numéro qu'un dossier sur deux n'a pas, donc la barre changeait de forme d'un client à
  l'autre. Les trois vivent dans un menu, et `RowMenu.bouton` — le bouton seul, sans sa cellule —
  est ce que `RowMenu.cellule` appelle : une seconde version recopiée aurait perdu `aria-expanded`
  ou `data-rowmenu` au premier ajustement.
- **UNE seule table d'actions par racine.** `bindRowMenus` écrase le gestionnaire précédent : une
  seconde table rendrait la première parfaitement inerte, sans une erreur nulle part. J'ai failli
  l'introduire en ajoutant le menu de l'en-tête à côté de celui des paquets.
- **Un manque annoncé porte le bouton qui le comble** (7.20.0) : « email à renseigner » et
  « téléphone à renseigner » étaient du gris inerte, alors que ce sont les deux champs sans lesquels
  aucune relance ne part.
- **Une colonne qui n'apprend rien coûte de la largeur à toutes les autres** : « 6 Ko » sur un
  tableau de dix colonnes. Le poids reste en infobulle, là où il sert — quand on se demande si un
  paquet est anormal.
- **Le geste qui allonge un tableau vit SOUS ce tableau**, pas dans la barre qui clôt le panneau :
  côte à côte, deux boutons de poids voisin laissent croire à deux façons d'enregistrer.
- **Un e2e ancré sur la forme d'hier, septième fois.** `e2e:cabinet` exigeait un `#print` et
  `e2e:boucle` prenait « le premier `[data-rowmenu]` venu » — qui est désormais celui de l'en-tête.
  Les deux ont été retournés vers la règle : la fiche doit pouvoir s'IMPRIMER ; le menu cherché est
  celui d'une LIGNE de paquet, dans l'onglet Paquets, atteint par son adresse.
- **Un test e2e ne déclenche pas un geste qui bloque.** Cliquer le bouton d'impression ouvre la
  boîte du système et fige le parcours pour toujours : on lit ce que le bouton propose. Et le test
  accepte les DEUX formes, parce qu'un menu à une seule action devient un bouton nommé (7.29.0) —
  un test qui n'en connaît qu'une accuserait du code juste au premier client sans téléphone.
- **Un test trop LARGE, deuxième fois en deux versions** : `/<th class="r">Taille<\/th>/` visait la
  table des sauvegardes, où la taille est légitime — c'est elle qui dit qu'une sauvegarde n'est pas
  vide. On borne la tranche au tableau visé avant de juger.
- Piège rencontré : la forme `${/* … */''}` est un commentaire de GABARIT. Écrite dans un tableau
  JavaScript ordinaire, elle casse le fichier — `node --check` le dit tout de suite, la relecture
  non.

Prouvé : cinq défauts réintroduits un par un font tomber leur test, et les deux parcours réels ont
attrapé ce qu'aucun test de source ne pouvait voir.

### 9.4.9 — Le fil du parcours, et la fin de l'audit

Le dernier lot de l'audit du 17/09/2026. Il porte sur ce qui manquait entre les écrans plutôt que
dans les écrans.

Règles apprises, à ne pas recasser :

- **Le métier du Cabinet est une BOUCLE, et chaque écran doit finir par le geste suivant.** Un
  paquet arrive → je vérifie → j'écris les écritures → j'exporte → je relance qui n'a rien envoyé.
  Elle était éclatée sur quatre pages sans lien : depuis Échéances on ne pouvait pas ouvrir la
  comptabilité du client en retard, depuis un paquet reçu rien ne menait à « créer le livre »,
  depuis le livre rien ne menait à l'export groupé. C'est la règle que l'Aide de l'app entreprise
  applique depuis la 7.27.0 (« chaque article finit par un geste ») et qu'aucune page du Cabinet
  n'appliquait — une règle apprise d'un côté se vérifie de l'autre (7.3.0), y compris quand elle
  concerne la NAVIGATION et pas un composant.
- **Un libellé dit l'état d'arrivée** : « Créer le livre de ce client » quand il n'y en a pas,
  « Voir ses écritures » quand il existe. Le même bouton sous deux noms vaut mieux qu'un nom qui
  ment une fois sur deux (7.29.0).
- **« Tout le monde ou personne » n'est pas un choix.** Un comptable relance les cinq clients d'une
  échéance, ou ceux qu'il n'a pas eus au téléphone. La case d'en-tête coche ce que l'écran MONTRE,
  jamais les soixante : cocher ce qu'on ne voit pas est un piège, et sous filtre ce serait le
  chiffre qui ment (7.16.0). Et une coche posée sur un client qui a envoyé son mois entre-temps
  tombe d'elle-même — on ne relance pas quelqu'un qui n'a plus rien à envoyer.
- **Une courbe d'une barre sur douze n'est pas une courbe**, c'est 200 px de haut pour un chiffre et
  onze « pas reçu ». Sous trois mois, l'information réelle EST le chiffre — et le fait qu'il ne
  porte que sur deux mois, ce qu'aucun graphique ne dit aussi clairement qu'une phrase. Mais il DIT
  sur quoi il porte : un total sans sa période est un agrégat qui ment (3.1.0).
- **Une prose grise sous un tableau remplace la découvrabilité** : on la lit une fois et elle reste
  pour toujours, à prendre de la place. L'explication vit dans la bulle du TITRE, là où on la
  cherche quand on ne sait pas. Corollaire immédiat, que le test des bulles a dit tout de suite :
  les deux bulles absorbées n'étaient posées QUE dans cette prose, donc elles seraient devenues des
  entrées mortes — on les retire, on ne les laisse pas sans endroit où s'afficher.
- **Un sous-titre qui se termine sur « si » paraît coupé** : on relit pour vérifier qu'il ne manque
  pas un mot, et c'est tout le plan qui devient suspect. Et on le MESURE plutôt que de le relire —
  `scrollHeight > clientHeight` dit qu'un texte déborde de sa carte, ce qu'aucune lecture du code
  ne montre. Prouvé en bornant la hauteur d'une carte : les neuf tombent.
- **Trois de mes propres assertions ont été retournées** — les neuvième, dixième et onzième fois que
  ce motif revient. La troisième est la plus instructive : `e2e:cabinet` exigeait « douze barres »
  sur un client qui n'a que deux mois reçus. Retournée vers la règle — « le chiffre d'affaires DIT
  sur quoi il porte », quelle que soit la forme — elle est devenue PLUS forte qu'avant : elle vérifie
  les deux formes, et que chacune nomme sa période. Les deux autres : Elles recopiaient une ligne (`groupRelance(rows.slice())`, `route !==
  'relances' && relState.seulement`) au lieu d'exiger la règle qu'elle porte : « le geste de groupe
  ne porte jamais sur la liste entière », « tout état de parcours se vide en quittant la page ».
  Une assertion qui recopie tombe dès que le geste gagne quelque chose de légitime, et se
  « répare » en recopiant la nouvelle ligne — donc sans rien prouver (7.16.0).

Prouvé : cinq défauts réintroduits un par un font tomber leur test pur, et la sonde des sous-titres
se prouve en bornant une carte.

### 9.4.10 — L'entretien : ce qui se rembourse

*Une version sur quatre ne porte aucune fonction nouvelle, par règle (`QUESTIONS.md` § 15, point 14).
Elle est écrite d'avance précisément parce que c'est quand on est pressé qu'on la saute.*

Règles apprises, à ne pas recasser :

- **Un CSS physique décrit un écran ; un CSS logique décrit une lecture.** Les 94 déclarations
  `margin-left` / `text-align: left` / `left:` des deux feuilles sont devenues `margin-inline-start`,
  `text-align: start`, `inset-inline-start`. Ça ne promet pas l'arabe — ça évite qu'un jour la
  question coûte un chantier au lieu de deux heures. **Une seule exception, et elle est NOMMÉE dans
  le test** : `#toast { left: 50% }`, où le centrage par `translateX(-50%)` rend le physique juste
  dans les deux sens de lecture (`inset-inline-start: 50%` collerait le bandeau à droite en arabe).
  Une exception anonyme est un trou.
- **Un code d'erreur n'a de valeur que s'il ARRIVE à l'écran.** `err.code` **ne traverse pas le pont
  IPC** : Electron sérialise l'erreur en une chaîne, et la propriété est perdue. La Partie 10 du
  cahier prévoyait `err.code = 'ERR-CAB-001'` depuis la 9.1.0 ; posée telle quelle, elle n'aurait
  rien montré à personne. Le code voyage donc **dans le message**, entre crochets, et `plainError`
  le détache avant d'afficher la phrase (`codeErreur` le rend à qui a la place de le montrer —
  jamais un bandeau de 2,6 secondes).
- **Un refus qu'on a ÉCRIT est une réponse ; une exception imprévue est une panne.** Seule la
  seconde va au journal. La première version enveloppait `ipcMain.handle` pour journaliser TOUS les
  refus : `e2e:entreprise`, qui exige un `main.log` vide après une exécution propre, est tombé sur
  la clé de lecture de photo absente — un refus parfaitement normal, que le parcours provoque
  exprès. Un journal rempli de mots de passe mal tapés ne se lit plus, et il emmène avec lui la
  ligne qui comptait (même règle que le rouge sur une situation normale, 8.0.1). Ce qui manquait
  était l'autre moitié : **une exception qui échappait à un handler n'écrivait rien, nulle part.**
- **On enveloppe une fois, pas quatre-vingts.** `ipcMain.handle` est enveloppé au niveau du module :
  autant de points d'enregistrement, autant d'occasions d'en oublier un — et la forme
  `ipcMain.handle(` reste celle que les tranches de source des tests reconnaissent.
- **Deux tables séparées divergent, toujours** (6.8.0, 7.23.0, re-trouvée) : un test confronte les
  codes `ERR-*` posés dans les deux `main.js` à la table de la Partie 10 du cahier. Un code écrit
  dans le code et absent du cahier ne se cite nulle part.
- **Un test qui lit du code doit lire du CODE — troisième fois** (6.8.0, 7.25.0). Le garde-fou « le
  cabinet n'écrit jamais chez un client » découpe la source sur `ipcMain.handle(` ; mon commentaire
  expliquant l'enveloppe **citait ce motif entre accents graves**, fabriquait un faux handler sans
  nom, et faisait tomber le test sur du code juste. Les commentaires se retirent avant de juger.
- **Un fichier de tests se découpe PAR OCCASION, et la suite découpée doit être CHARGÉE.** Le
  premier domaine sort dans `test/suites/cabinet-rendu.js` (23 tests, le chantier UI/UX du Cabinet) ;
  il reçoit le harnais en argument plutôt que d'ouvrir son propre compteur — deux compteurs, c'est un
  total faux. Et un contrôle lit le DOSSIER : une suite écrite que le lanceur ne charge pas est pire
  que pas de suite, parce qu'on se croit couvert.
- **`npm audit` juge ce qui est LIVRÉ** (`--omit=dev`). Les douze failles du jour vivent toutes dans
  les dépendances de construction d'electron-builder : elles se corrigent, mais elles ne s'installent
  chez personne. Une CI rouge en permanence cesse d'être lue.
- **Une version minimale s'écrit à UN endroit.** Les deux installeurs lisent `engines.node` dans
  `package.json` au lieu de porter le chiffre ; écrit deux fois, il diverge au premier changement.
- **Electron change de version majeure ici, et nulle part ailleurs.** 43 → 44, et **les 46 parcours
  relancés** — c'est la seule version où on les relance tous, et c'est la raison d'être de cette
  version-là.

### 9.5.0 — La banque

Le relevé importé, rapproché quand c'est certain, proposé quand ça ne l'est pas. La question qui
bloquait cette version — « quelles banques, et quel format chacune exporte-t-elle ? » — n'a toujours
pas de réponse, et n'en aura pas avant que le cabinet pilote ouvre ses fichiers. **C'est la
conception qui répond à sa place** : rien dans le code ne connaît une banque.

Règles apprises, à ne pas recasser :

- **Un rapprochement FAUX est pire qu'un rapprochement absent**, parce qu'il ferme la question.
  D'où la règle qui ne bouge pas : **seul `certain` se pose d'office, et une ambiguïté n'est jamais
  `certain`**. Un candidat unique au bon montant, à ± n jours : certain. Deux candidats : jamais,
  quoi qu'en dise le libellé — au mieux `probable`, et l'écran montre TOUS les candidats.
- **Le libellé se COMPTE, il ne se répond pas par oui ou non.** Ma première version disait « ces deux
  libellés se ressemblent-ils ? » : « REMISE CHEQUE DUPONT » ressemblait autant à « CHEQUE DUPONT »
  qu'à « CHEQUE MARTIN », parce que le mot partagé était « cheque » — celui qui n'apprend rien. On
  compte les mots communs, et on ne départage que si un candidat en a **strictement plus** que tous
  les autres.
- **Le brouillard COMPTE dans le rapprochement**, et c'est un choix. Ma première version l'excluait
  (« un brouillard n'est pas encore un fait »), et le parcours réel a montré ce que ça donne : on
  écrit l'écriture manquante depuis une ligne de relevé, elle arrive en brouillard, et l'automatique
  ne la retrouve plus. Le rapprochement devenait inutile très exactement pendant la demi-journée où
  il sert. **Ce qu'il faut en contrepartie** : une écriture rapprochée ne se modifie ni ne se
  supprime — même garde que le lettrage, avec le geste qui débloque nommé dans le refus.
- **Une écriture déjà rapprochée ne répond pas d'une seconde ligne.** Sans ça, le même mouvement
  tomberait juste deux fois, et le compte serait équilibré sur un mensonge.
- **Le signe est celui de la BANQUE** : ce qui entre est positif, ce qui sort négatif. C'est le seul
  endroit du livre où un montant porte un signe, et c'est voulu — un relevé se relit à côté de son
  original papier, et l'inverser rendrait la comparaison impossible. La conversion en débit/crédit
  se fait au rapprochement.
- **Un relevé qui ne se boucle pas n'entre pas** (`soldeDebut + Σ = soldeFin`), et le refus porte
  l'écart : il manque des lignes, et un rapprochement à moitié ne s'explique plus trois mois après.
- **Les suspens se comptent DANS LES DEUX SENS** (6.8.1, re-trouvée) : ne regarder que le relevé
  laisserait passer le chèque émis jamais encaissé, c'est-à-dire l'écart le plus courant.
- **La table libellé → compte part VIDE.** Écrire « STEG → 606 » dans le code serait poser une règle
  comptable que personne n'a validée (règle 9.1.1). Elle se remplit un libellé à la fois, quand le
  comptable choisit ; et **le motif le plus LONG gagne**, sinon le résultat dépend de l'ordre du
  tableau (même règle que la correspondance de comptes, 9.3.0).
- **Sans règle connue, la contrepartie reste VIDE** — et `ecritureValide` refuse alors
  l'enregistrement. Verser d'office au 471 rangerait le doute dans un compte que personne ne solde,
  et la question disparaîtrait sans avoir été posée.
- **Un lettrage automatique généreux est pire qu'aucun** : il affirme qu'une facture est payée. On ne
  relie que ce qui se solde EXACTEMENT et quand un seul candidat convient — la référence tranche
  entre deux règlements du même montant. Un règlement partiel reste ouvert : c'est très exactement
  ce que « ce client me doit-il encore quelque chose ? » veut savoir.
- **Rapprochement et lettrage sont deux écrans, deux modèles, deux tests.** C'est la confusion de
  vocabulaire la plus courante du métier, et un écran qui les mélange la rend définitive.
- **Les tranches d'âge n'existent qu'à UN endroit.** Elles vivaient dans core.js depuis la 2.5.0 ; le
  Cabinet ne charge pas core.js, donc les recopier aurait donné deux balances âgées qui ne disent pas
  la même chose. Elles ont déménagé dans `compta.js`, et core.js les réexporte — un test compare les
  deux références.
- **Du rouge sur une situation normale apprend à ignorer le rouge** (8.0.1, re-trouvée) : « sans
  réponse » est l'état de DÉPART de toute ligne d'un relevé qu'on vient d'importer. Pas de badge
  d'alarme dessus.
- **Un geste destructeur ne se présente pas comme un bouton nommé.** `rowmenu.js` transforme une
  action unique en bouton direct (7.29.0) : le menu du relevé n'en portait qu'une, « Retirer ce
  relevé », qui s'est donc affichée en clair à côté du bouton d'import. Lui donner sa vraie voisine
  — « Défaire tous les rapprochements », utile et réparable — remet le destructeur derrière un clic.
- **Deux gestes séparés pour importer** : lire le fichier, puis l'ajouter. Entre les deux, le
  comptable choisit le compte bancaire, saisit les deux soldes du relevé papier et corrige
  l'association des colonnes. Les fondre reviendrait à écrire dans un livre comptable à partir d'un
  fichier que personne n'a regardé.

Le test qui compte est `npm run e2e:banque` : trois banques aux trois formats différents (montant
signé, débit/crédit séparés, en-têtes inconnus), le refus d'un solde faux avec son écart, le doublon
refusé, l'automatique qui ne pose rien sur une ambiguïté, l'écriture écrite depuis une ligne puis
retrouvée « certain » par l'automatique, le libellé retenu, et le relevé retiré sans que le journal
bouge.

### 9.6.0 — La déclaration mensuelle

Les chiffres que le comptable RECOPIE sur le portail. L'application ne dépose rien, ne se connecte à
aucune administration, et ne le fera jamais (règle 5.2.0) : « Marquer déposée » est un pense-bête.

Règles apprises, à ne pas recasser :

- **Une case dont la règle n'est pas connue vaut `null`, jamais 0** (règle 9.1.1, appliquée cette
  fois à un formulaire fiscal). Un zéro se recopie ; un « — » avec sa raison se demande au
  comptable. TFP, FOPROLOS, TCL et acomptes provisionnels existent dans l'objet — les taire ferait
  croire qu'elles n'existent pas — et portent leur motif. Le jour où le plan du dossier porte un
  compte pour l'une d'elles, elle se calcule : la règle « null » n'est pas un abandon, c'est une
  attente, et elle se lève toute seule.
- **L'écriture de déclaration ne compte pas dans ce qu'elle déclare.** C'est le défaut que le
  parcours réel a trouvé et qu'aucun de mes tests ne pouvait voir : le jeu d'exemple porte les
  livres d'un CLIENT, et un client à jour a déjà passé son écriture de TVA. Celle-ci débite le 4367
  d'exactement ce que les ventes y ont crédité — donc un « crédit moins débit » sur le mois donne
  **zéro**, et un mois plein paraît vide. On l'exclut, et on la reconnaît à sa **FORME** (elle
  touche le compte à décaisser ET un compte de TVA), jamais à son libellé : le client de l'exemple
  nomme la sienne « TVA-2026-08 », la nôtre s'appelle « DECL-2026-08 », un cabinet la nommera
  autrement.
- **Un état et ses drapeaux se calculent UNE fois.** `etatDuMois` rendait `saisi` d'un côté et
  recalculait `validees.length` de l'autre pour le mot : les deux pouvaient se contredire sur le
  même écran (règle 6.8.1). Le mot se déduit désormais des drapeaux — et c'est en essayant de faire
  tomber le test que la divergence est apparue.
- **On ne crédite du compte de TVA déductible que ce qui est UTILISÉ.** Le solder entièrement ferait
  disparaître le crédit à reporter, et le mois suivant paierait deux fois.
- **Le crédit reporté se LIT sur le compte**, jamais dans un champ — c'est la leçon de `vatChain`
  (3.1.0), portée au Cabinet.
- **Les contrôles nomment, ils ne bloquent pas** (règle 6.0.0) : un mois déclaré avec deux manques
  signalés vaut mieux qu'un mois jamais déclaré parce que l'application faisait la difficile. Et le
  contrôle choisi dit un GESTE : « le compte 4367 porte encore X : l'écriture de déclaration n'a pas
  été passée » se traduit en action, là où un contrôle sur le report de crédit dirait la même chose
  d'une façon que personne ne sait traduire.
- **Une période n'a qu'UNE déclaration**, et une déposée ne se refait pas en silence : deux chiffres
  différents portant le même dépôt, et plus personne ne sait lequel a été envoyé. Le refus nomme le
  geste qui débloque.
- **On ne paie pas ce qu'on n'a pas déposé** : l'ordre des deux pense-bêtes est une information, et
  le bouton éteint dit pourquoi. Les deux se dé-pointent (7.12.0) — un pense-bête qui ne se défait
  pas devient un mensonge le jour où l'on se trompe de mois.
- **Le détail par TAUX ne s'invente pas.** Il demande un sous-compte de TVA collectée par taux ;
  quand le dossier n'en a qu'un, on le DIT au lieu de rendre un tableau à une ligne qui laisserait
  croire que tout est à 19 %.
- **Le RÔLE désigne le compte, jamais le numéro écrit dans le code** (règle 6.3.0 : aucun numéro de
  compte n'est une vérité). Un cabinet qui a ses propres numéros ne doit pas voir une déclaration
  vide. Les comptes fiscaux vivent dans `compta.js` — le Cabinet ne charge pas core.js — et un test
  les confronte à `DEFAULT_ACCOUNTS`.
- **L'écran s'ouvre sur le dernier mois SAISI**, pas sur janvier : un comptable vient déclarer le
  mois qu'il vient de terminer, et onze clics par déclaration se paient en usage.

**Ce qui n'est PAS livré, et pourquoi** : le calendrier fiscal par régime (F-9.6.0-12). Les régimes
à distinguer et les échéances de chacun sont une question au comptable pilote ; les inventer serait
écrire du droit que personne n'a confirmé — exactement ce que la règle du seuil de retenue (9.1.1)
interdit. La page Échéances existante continue de servir.

Le test qui compte est `npm run e2e:declaration` : les quatre cases « — » avec leur raison, un
chiffre ouvert sur ses pièces, un mois DÉJÀ déclaré par le client qui montre quand même sa collectée
et dont le bouton s'éteint en disant pourquoi, un mois libre où l'écriture se passe en brouillard au
dernier jour, les deux pointages dans l'ordre puis défaits, et le refus de refaire une déposée.

### 9.6.1 — L'entretien : le moteur a fini de déménager

*Une version sur quatre ne porte aucune fonction nouvelle, par règle.*

- **La règle de découpage de la 9.1.0 se relit dans les deux sens.** « Une fonction qui prend `data`
  reste dans core.js ; une fonction qui prend des LIGNES vit dans compta.js » — le constructeur de
  pièce équilibrée (`entrySet`) et tout le moteur d'amortissement prennent une PIÈCE et un BIEN.
  Ils étaient du mauvais côté depuis la 3.5.0 et la 6.3.0, et ça ne s'était jamais vu parce que
  personne d'autre n'en avait besoin. **Le Cabinet en a besoin en 9.7.0** : il ne charge pas core.js
  et ne doit jamais le charger, donc la seule alternative au déménagement était la recopie — et une
  copie diverge, toujours (6.8.0, 7.29.0).
- **Une réexportation se prouve par l'IDENTITÉ, pas par le résultat.** `Core.assetSchedule ===
  Compta.assetSchedule` : « une copie qui fait pareil » passerait un test de valeur et laisserait
  deux moteurs vivre côte à côte. Le test compare les objets ; et pour `entrySet`, qui n'a jamais
  été exporté, il exige la ligne de source qui le fait venir de compta.js.
- **Un montant qui se divise sans reste ne prouve rien d'un arrondi.** Mon test de l'absorbeur
  prenait 3 600 DT sur cinq ans — 720 pile : retirer l'absorbeur ne faisait RIEN tomber, et je ne
  l'ai su qu'en essayant. Refait sur 1 000 DT en trois ans, où la dernière annuité doit porter le
  millime manquant. C'est la règle 7.2.0 appliquée au choix des **données** du test, pas à sa forme.
- **Le découpage de `app.js` par route est REFUSÉ, pas reporté une troisième fois.** Le fichier est
  une seule fermeture de 12 800 lignes : le découper demanderait des variables globales — que le
  lint existe pour interdire — ou un objet de contexte traversant tout le fichier. Le bénéfice
  serait la taille du fichier ; le coût, le risque sur 48 parcours. La dette réellement CONSTATÉE
  n'est pas la taille du fichier, ce sont les tranches de source qui se périment dans les tests
  (7.20.0, 7.21.0, 8.2.0, 9.4.6) — et celle-là se rembourse en découpant le lanceur de tests.
  **Une dette qu'on ne sait pas rattacher à un défaut réel n'est pas une dette, c'est un goût.**

## Pistes pour la suite (non demandées)

- Séparation des installateurs arm64 / x64 pour diviser par deux les 222 Mo du dmg universel.
- Signature Apple et Windows (certificats payants) : supprimerait les avertissements au premier lancement et permettrait d'utiliser Squirrel sur Mac.
- Export TEIF si l'e-facture devient obligatoire.
