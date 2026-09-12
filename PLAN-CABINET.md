# SkanFact — Plan Cabinet

*Vendre SkanFact aux entreprises en passant par les cabinets comptables. Rédigé le 12/09/2026 à partir de la discussion avec Skander ; c'est une proposition à valider, pas une décision prise. Les points marqués « À VÉRIFIER » relèvent d'un comptable, d'un juriste ou de l'Ordre.*

## En une page

- **Le cabinet est le canal de vente.** Un cabinet gère des dizaines de dossiers ; s'il adopte SkanFact, il l'impose à ses clients parce que c'est lui qui subit leur désordre.
- **Le cabinet ne paie jamais.** Il reçoit gratuitement **SkanFact Cabinet**, une application qui lui rend service même si un seul de ses clients utilise SkanFact.
- **L'entreprise paie** une licence annuelle. Un client amené par un cabinet a une **remise** ; le cabinet ne touche **pas d'argent** (question déontologique — À VÉRIFIER auprès de l'Ordre).
- **Pas de serveur en première version.** Les deux applications s'échangent un **fichier chiffré**, le paquet mensuel. Aucun coût récurrent, aucune donnée hébergée, rien à sécuriser la nuit.
- **On ne construit le portail en ligne que si un cabinet a dit oui.** Tout ce qui précède se fait en semaines, se montre à deux cabinets, et n'est jamais jeté : le jour où le serveur existe, seul le transport change.

## Les deux produits

| | **SkanFact** (entreprise) | **SkanFact Cabinet** (cabinet) |
|---|---|---|
| Qui l'installe | L'entreprise, payante | Le comptable, gratuit |
| Ce qu'il fait | Crée les pièces, tient stock, paie, trésorerie | **Lit**, contrôle, relance, exporte vers son logiciel |
| Ce qui sort | Le **paquet mensuel** chiffré | L'export d'écritures ; les relances |
| Code | Un seul dépôt. Même `core.js`, mêmes calculs, mêmes listes, même chiffrement | Même dépôt, second point d'entrée, second installeur, second `appId` |
| Règle absolue | — | **Ne modifie jamais les données du client.** Deux vérités = conflits (leçon de la 3.2.0) |

Le comptable voit exactement les chiffres du client, calculés par les mêmes lignes de code. Une correction profite aux deux d'un coup.

## Comment ça circule

```
ENTREPRISE                                          CABINET
SkanFact                                            SkanFact Cabinet
  1. clôture le mois                                  4. dépose le paquet dans l'app
  2. « Envoyer au cabinet »                           5. le dossier passe au vert
  3. mars-2026.skanpack (chiffré pour ce cabinet) ──► 6. exporte vers son logiciel
     par mail, Drive, WhatsApp, clé USB                  relance ceux qui n'ont rien envoyé
```

**L'appairage :** le cabinet génère une paire de clés dans son app et remet à ses clients un **fichier d'appairage** (son nom, son email, sa clé publique) plus une **empreinte** courte à vérifier de vive voix. L'entreprise l'importe une fois. Dès lors ses paquets sont chiffrés pour ce cabinet et pour lui seul — et **cette empreinte est la preuve du parrainage** : elle figure dans la demande de licence, c'est elle qui déclenche la remise. Le mécanisme technique et le mécanisme commercial sont le même objet.

## Les versions, dans l'ordre

Chaque version suit les règles habituelles : `package.json` + `CHANGELOG.md`, `npm test`, test de l'app réelle, bulles « i » et article d'aide, publication vérifiée. Les estimations sont des ordres de grandeur en jours de travail effectif, hors délais externes.

### SkanFact 6.0.0 — Clôture de période *(~2 j)*

Le prérequis de tout le reste : le cabinet doit savoir que le mois reçu ne bougera plus.

- **Données** : `data.closedUntil` (dernier jour clôturé) et `data.closureLog` (qui, quand, pourquoi — clôture et réouverture).
- **Règle** : rien ne se crée, ne se modifie ni ne se supprime avec une date dans une période close — pièce de vente ou d'achat, paiement, règlement, mouvement, bulletin. Le message dit quoi faire : rouvrir (tracé), ou corriger par un avoir daté d'aujourd'hui.
- **Contrôles avant clôture** (`core.closureChecks`) : achats sans justificatif, mouvements non pointés, bulletins manquants, brouillons datés dans la période, écarts de numéros de série. On peut clôturer quand même, mais on le voit.
- **Écrans** : Comptabilité → onglet **Clôtures** ; « À faire » réclame la clôture d'un mois terminé depuis dix jours.
- **Test** : pur, sans Electron — une pièce datée dans une période close est refusée, la réouverture est journalisée.

### SkanFact 6.1.0 — Le paquet mensuel *(~3 j)*

Un bouton, un fichier complet.

- **Contenu** d'un `.skanpack` (un zip, écrit sans dépendance externe) : `manifeste.json` (entreprise, matricule, période, version du format, généré le, poste, définitif ou provisoire, liste des fichiers avec leur empreinte SHA-256) ; `00-page-de-garde.pdf` (résumé du mois et **liste de ce qui manque**) ; `journaux/` ventes, achats, encaissements, TVA en CSV ; `ventes/` le PDF de chaque pièce émise ; `achats/` les justificatifs joints ; `paie/` les bulletins du mois ; `social/` la déclaration CNSS si le trimestre y tombe ; `tresorerie/` les mouvements ; `immobilisations/` et `stock/` en fin d'exercice.
- **Définitif seulement si le mois est clôturé** ; sinon le paquet porte la mention « provisoire » partout.
- **Chiffrement** : AES-256-GCM (mécanisme de la 1.7.0), par mot de passe partagé en 6.1.0, pour la clé du cabinet dès 6.2.0.
- **Écrans** : Comptabilité → **Cabinet** : construire, envoyer (mail avec pièce jointe, `mail:compose` accepte déjà les pièces jointes), historique des envois (`data.packs` : période, date, définitif, empreinte, destinataire).
- **Test** : le manifeste liste exactement les fichiers, les empreintes correspondent, un mois non clôturé donne « provisoire ».

### SkanFact 6.2.0 — Code cabinet et appairage *(~1 j)*

- **Données** : `company.cabinet = { name, email, publicKey, fingerprint, pairedAt }`.
- **Écrans** : Paramètres → **Cabinet** : importer le fichier d'appairage, afficher l'empreinte, retirer. Le paquet se chiffre pour ce cabinet sans rien demander.
- **Parrainage** : l'empreinte apparaît dans « Demander une licence » (6.4.0).

### SkanFact Cabinet 1.0.0 — L'application du cabinet *(~5 j)* — **LIVRÉE le 12/09/2026**

*Livré : `src/cabinet/` (cabcore.js pur + main.js chiffré + renderer), second installeur `build/cabinet.config.js`, icône propre, joint à chaque release. Écarts assumés : pas de glisser-déposer (bouton et menu Fichier), pas encore de mise à jour automatique côté cabinet, pas d'isolation multi-dossiers (un cabinet = un fichier chiffré). Ajout non prévu : le manifeste porte depuis la 6.2.1 les chiffres du mois, donc la liste des dossiers affiche le CA sans ouvrir un CSV.*

Nouvelle app, même dépôt : `src/cabinet/`, `cabinet.html`, second installeur, `appId` `tn.skancyber.skanfact.cabinet`. On enlève tout ce qui crée des pièces ; on garde listes, tri, pagination, chiffrement, bulles d'aide, PDF.

- **Première ouverture** : identité du cabinet, génération de la paire de clés (la clé privée est chiffrée par un mot de passe **obligatoire**), export du fichier d'appairage à remettre aux clients.
- **Dossiers** — l'écran qui compte : une ligne par client, dernier mois reçu, statut (complet / incomplet / provisoire / manquant), CA et TVA du mois, prochaine échéance, bouton Relancer. Il répond à *lequel de mes 60 clients ne m'a pas envoyé mars*.
- **Import** : glisser-déposer un paquet ; vérification des empreintes ; refus net si le paquet n'est pas pour ce cabinet ; un mois déjà reçu qui arrive à nouveau est signalé (« le client a rouvert mars »).
- **Fiche dossier** : les mois année par année, les journaux, les pièces, les justificatifs, la page de garde.
- **Relances** : « n dossiers n'ont pas envoyé <mois> » → mail prérempli, modèle modifiable. C'est ce qui lui fait gagner ses soirées, et ce qui pousse ses clients à installer SkanFact.
- **Stockage** : un index chiffré + les paquets **conservés chiffrés** ; un fichier s'ouvre en le déchiffrant vers un dossier temporaire. Isolation stricte par dossier (mécanisme des dossiers de la 3.2.0).
- **Démo** : cinq dossiers fictifs — c'est avec ça qu'on va voir les cabinets.
- **Utile même si un seul client utilise SkanFact** : sinon personne ne l'installe.

### SkanFact Cabinet 1.1.0 — Export d'écritures *(~2 j)* — **LIVRÉE le 12/09/2026 (SkanFact 6.3.0)**

*Livré sans attendre les réponses du comptable, en les rendant inutiles au démarrage : tous les numéros de compte sont modifiables dans « Plan de comptes » et marqués « À VÉRIFIER ». Ce qui est garanti, c'est l'équilibre débit = crédit, pièce par pièce, vérifié sur les 24 mois du jeu de démonstration. Les versions suivantes sont décalées d'un cran : licence 6.4.0, signature 6.5.0, filets 6.6.0.*

- `core.journalEntries(data, period, plan)` : écritures en partie double, par pièce ou récapitulatives par mois, avec un **plan de comptes paramétrable** (ventes, clients, TVA collectée, TVA déductible, achats, fournisseurs, banque, caisse — numéros du plan comptable tunisien À VÉRIFIER).
- Formats : CSV générique + un ou deux formats des logiciels réellement utilisés par les cabinets rencontrés.
- Le même export est offert **dans SkanFact** pour les entreprises dont le comptable n'installe rien.

### SkanFact 6.4.0 — Vendable : licence et mises à jour *(~3 j)* — **LICENCE LIVRÉE le 12/09/2026**

*Livrée : toute la partie licence (voir CHANGELOG 6.4.0). Livrée **désarmée** : sans `build/licence-public.json`, l'application est libre et ne verrouille rien. Deux commandes suffisent pour l'armer, le jour où tu le décides — c'est écrit dans le README.*

**Reste à décider par Skander — les mises à jour sans token.** La partie « second dépôt public » n'a pas été faite cette nuit, et volontairement : créer un dépôt GitHub public au nom de Skander et y publier les installeurs de son produit est une décision commerciale, pas une tâche technique. N'importe qui pourrait alors télécharger l'application (la licence limite l'usage, pas le téléchargement). C'est probablement le bon choix — c'est ce que font la plupart des logiciels vendus — mais c'est à lui de le dire.

Le jour où il dit oui, voici exactement quoi faire :

1. Créer `saouthq/skanfact-releases`, **public**, vide (pas de code, uniquement des releases).
2. Dans `package.json`, `build.publish` : `owner: saouthq`, `repo: skanfact-releases`. Idem pour le cabinet si on veut lui donner la mise à jour automatique.
3. Dans le workflow, `GH_TOKEN` doit être un **token personnel** ayant accès aux deux dépôts (le `GITHUB_TOKEN` par défaut ne peut écrire que dans le dépôt courant) → secret `RELEASES_TOKEN`.
4. Dans `src/main.js`, `private: true` disparaît de la configuration de l'updater, et le panneau « token » de Paramètres → Mises à jour devient inutile (le laisser une version de plus, pour les installations déjà en place).
5. **Les versions déjà installées continuent de chercher dans le dépôt privé** : il faut donc publier la première version « publique » dans les DEUX dépôts, sinon personne ne la reçoit.


- **Licence** : une clé signée (Ed25519) contenant nom, matricule, date d'expiration, empreinte du cabinet parrain ; vérifiée **hors ligne** avec la clé publique embarquée. Pas de serveur. Skander génère les clés avec `scripts/licence.js` et sa clé privée, **qui ne va jamais dans le dépôt**.
- **États** : essai (complet, 30 jours), active, expirée. À l'expiration : tout reste lisible, imprimable, exportable ; seule la création de nouvelles pièces attend le renouvellement. **Jamais de données en otage.**
- **Mises à jour sans token** : un second dépôt GitHub **public** ne contenant que les fichiers de release. Le code reste privé. L'app installée cherche ses mises à jour là ; le champ « token » disparaît. (Le code d'une app installée est de toute façon lisible : publier les installeurs n'expose rien de plus que vendre l'app.)
- **Écrans** : Paramètres → **Licence** : saisir, voir l'état, « Demander une licence » (mail prérempli avec les informations et l'empreinte du cabinet).

### SkanFact 6.5.0 — Les filets d'un produit vendu *(~2 j)* — **LIVRÉE le 12/09/2026**

*Livré : chien de garde (détection d'un gel en ~13 s, pile d'appels dans main.log, interruption, rechargement, explication à l'utilisateur), « Signaler un problème » dans l'Aide, article « Si quelque chose ne va pas ». Vérifié par un test qui gèle volontairement l'application.*

- **Chien de garde** : le processus principal interroge l'interface toutes les 3 s ; sans réponse, il lit la pile via le débogueur (domaine activé **avant** le gel), l'écrit dans `main.log`, interrompt l'exécution et recharge. Un gel devient un rapport.
- **« Envoyer un rapport »** dans l'Aide : mail avec `main.log`, version, système, sans données.
- Page **Support** dans l'Aide : adresse, délai annoncé, ce qu'il faut joindre.

### SkanFact 6.6.0 — Signature Apple et Windows *(~1 j + délais externes)* — **EN ATTENTE DES CERTIFICATS**

*Décalée après les filets : elle dépend d'un achat (Apple Developer 99 $/an, certificat Windows) et d'un délai de validation externe. Rien n'est modifiable tant que les certificats n'existent pas — le workflow de publication n'a donc PAS été touché, pour ne pas fragiliser des releases qui fonctionnent. Ce qu'il faudra faire le jour venu est décrit ci-dessous.*

- Apple Developer ID + notarisation ; certificat Windows. Les certificats vont dans les secrets du workflow, jamais dans le dépôt.
- `MAC_SIGNED = true` : Squirrel prend le relais de `mac-update.sh`.
- Deux installeurs à signer : vérifier que les certificats couvrent plusieurs produits d'une même société.

### Ensuite, seulement si un cabinet a dit oui — SkanFact 7.0.0

Serveur de dépôt : les paquets circulent seuls ; comptes cabinet et entreprise ; INPDP ; hébergement ; abonnement mensuel justifié par un coût réel. Les deux applications ne changent pas, seul le transport change.

## Où on en est — 12/09/2026 au matin

**Tout le plan est livré, sauf ce qui dépend d'un achat ou d'une décision de Skander.**

| Version | Quoi | État |
|---|---|---|
| 6.0.0 | Clôture de période | publiée |
| 6.1.0 | Paquet mensuel `.skanpack` | publiée |
| 6.2.0 | Appairage du cabinet | publiée |
| 6.2.1 | **SkanFact Cabinet 1.0.0** | publiée, installeurs Mac et Windows joints |
| 6.3.0 | Écritures comptables (Cabinet 1.1.0) | publiée |
| 6.4.0 | Licence hors ligne | publiée (désarmée) |
| 6.5.0 | Chien de garde et rapport de problème | publiée |
| 6.6.0 | Signature Apple / Windows | **attend les certificats (achat)** |
| — | Mises à jour sans token (dépôt public) | **attend un oui de Skander** |
| 7.0.0 | Serveur | seulement si un cabinet dit oui |

## Audit de l'application Cabinet — 12/09/2026, après-midi

Constat de Skander : « il manque beaucoup de choses, et c'est pas trop pratique ; pour la montrer à un comptable il faut qu'elle soit complète ». Audit fait sur l'application réelle (captures 1440×900 et 1280×800 de chaque écran et de chaque fenêtre, avec le jeu d'exemple), puis relecture de `cabcore.js`, `main.js`, `preload.js` et du rendu.

**Verdict** : la 1.0.0 a été conçue pour *démontrer un mécanisme* avec cinq dossiers. Elle est juste et honnête, mais ce n'est pas encore l'outil quotidien d'un cabinet qui suit soixante clients. Rien n'est à jeter ; il manque des couches.

### Ce qui bloquerait une démonstration

1. **Impossible de créer un dossier à la main.** Un dossier n'existe que si un paquet arrive. Le comptable à qui on montre l'application a soixante clients dont aucun sous SkanFact : il ouvre, c'est vide, et sa première question (« mes autres clients, je les mets où ? ») n'a pas de réponse. Un dossier créé à la main, marqué « n'utilise pas encore SkanFact », transforme l'app en **tableau de bord de son portefeuille** — et lui donne une raison de pousser SkanFact chez ses clients.
2. **Aucun assistant de première utilisation.** L'app entreprise en a un depuis la 2.0.0 ; le cabinet atterrit sur un formulaire de réglages avec un message passager. C'est le premier contact d'un comptable avec le produit.
3. **Écrans creux.** La fiche d'un client, c'est 40 % de contenu et 60 % de blanc : pas d'année entière, pas de cumul, pas de courbe, rien à imprimer pour un dossier papier.

### Ce qui casse au premier vrai usage

4. **Les listes ne tiennent pas la charge** : ni tri, ni pagination, ni export CSV, ni recherche globale (Cmd+K). Tout existe côté entreprise depuis la 2.2.0. À soixante lignes, la page devient un mur.
5. **Aucune trace des relances.** On clique « Écrire », le mail part, **rien n'est enregistré** : ni date, ni compteur, ni historique. Le lundi suivant, on ne sait plus qui a été relancé. Et pas de relance groupée : douze retardataires = douze fois le même geste.
6. **Pas de numéro de téléphone.** Seul l'email existe. En Tunisie, un comptable qui court après des pièces appelle ou envoie un WhatsApp.
7. **Aucune sauvegarde.** Les dossiers vivent dans **un seul fichier chiffré** : pas de sauvegarde quotidienne, pas de copie externe, pas d'export. Le Mac tombe, tout est perdu. L'app entreprise a les trois depuis la 1.7.0 — c'est l'application *professionnelle*, celle qui détient les données de dizaines d'entreprises, qui n'a rien.
8. **Le mot de passe ne peut jamais être changé.** Aucun IPC pour ça. S'il fuite, ou si un collaborateur part, il n'y a aucun recours.
9. **Ni suppression d'un dossier, ni d'un paquet.** Un paquet importé par erreur (mauvais client, essai) reste là pour toujours. Seul l'archivage existe.
10. **Pas de glisser-déposer.** Le geste le plus naturel — attraper le `.skanpack` reçu par mail et le lâcher sur la fenêtre — n'existe pas.

### Promesses non tenues dans le code

11. **`settings.relanceDay` (10) est mort** : il est dans les données, l'aide annonce « Le 10 : la page Dossiers te dit qui n'a rien envoyé », et **rien ne l'implémente ni ne le règle**.
12. **`dossier.from` est lu mais jamais réglable** : impossible de dire « je reprends ce client à partir de janvier 2026 ». L'attente démarre au premier paquet reçu, donc un client repris en cours d'année n'est jamais réclamé sur ses mois antérieurs.
13. **L'aide est fausse sur un point** : elle parle du jeton d'accès à saisir, remplacé par le relais en 6.7.0.
14. **La pastille « Relances » compte les manquants, la page en liste trois** (elle inclut les provisoires) : deux chiffres pour la même chose.

### Ce qui manque au métier

15. **Aucun calendrier d'échéances.** La vie d'un comptable, ce sont des dates : TVA, CNSS, acomptes. L'app entreprise a `fiscalDeadlines` ; le cabinet n'affiche rien.
16. **Aucun profil fiscal par client** : régime, TVA mensuelle ou trimestrielle, date de début de mission, honoraires. Sans ça, on ne sait pas *quoi* attendre ni *quand*.
17. **Aucune vue de portefeuille** : total du chiffre d'affaires suivi, nombre de dossiers à jour, évolution. C'est précisément ce qui impressionne en démonstration.
18. **Pas de vue par exercice** : six mois glissants au lieu des douze mois d'une année, avec sélecteur d'année.
19. **Aucun regroupement d'écritures** : chaque paquet porte son `ecritures.csv`, mais rien ne les rassemble par client ou par mois pour l'import dans le logiciel du cabinet.
20. **Aucun collaborateur** : un cabinet, c'est plusieurs personnes. Hors périmètre v1, mais à nommer.

### Finitions

21. **Aucune bulle « i »** — zéro, alors qu'un test les impose côté entreprise. Deux applications de la même famille, deux niveaux de finition.
22. **La marque dans l'application est celle de l'app entreprise** : pastille « SF » vert d'eau des deux côtés, alors que l'icône du cabinet (ardoise, dossier) est différente. Une fois ouverte, on ne sait plus laquelle on regarde.
23. **L'écran de mot de passe est nu** : champs sans étiquette, sans bouton « afficher », et l'avertissement le plus important de toute l'application (« aucun moyen de le récupérer ») est la ligne la plus petite et la plus grise de l'écran.
24. Un message passager recouvre le bouton « Enregistrer » des Réglages.

### Le plan qui en découle

| Version | Quoi |
|---|---|
| **Cabinet 2.0.0** | Créer un dossier à la main · téléphone et contact · **sauvegarde quotidienne, copie externe, export** · changement du mot de passe · suppression d'un dossier et d'un paquet · tri, pagination, export CSV · glisser-déposer · Cmd+K |
| **Cabinet 2.1.0** | Historique et relance groupée · `relanceDay` enfin vivant · date de début de mission (`from`) · profil fiscal par client · calendrier d'échéances |
| **Cabinet 2.2.0** | Assistant de première utilisation · bulles « i » · marque propre au cabinet · vue par exercice + courbe · tableau de bord du portefeuille · fiche client imprimable · regroupement des écritures |

Ordre retenu : **2.0.0 d'abord, et dedans la sauvegarde en premier** — c'est le seul point où un incident coûterait vraiment cher. Tout se construit et se teste sans publier (`npm start` et l'installeur local), donc le quota GitHub épuisé ne bloque rien.

## L'ordre et le calendrier

1. **Phase 0 — cette semaine, Skander seul** : les quatre questions à deux ou trois cabinets ; l'Ordre ; l'objet social ; lancer l'achat des certificats (les délais de vérification se comptent en semaines) ; choisir le nom commercial de l'app cabinet.
2. **Phase 1 — Claude** : 6.0.0, 6.1.0, 6.2.0.
3. **Phase 2 — Claude** : Cabinet 1.0.0 avec ses cinq dossiers de démo. **Dès qu'elle tourne, Skander va voir les cabinets** — sans attendre l'export d'écritures.
4. **Phase 3 — Claude, avec les réponses** : Cabinet 1.1.0.
5. **Phase 4 — Claude + les achats de Skander** : 6.4.0, 6.5.0, 6.6.0 → premier client payant.
6. **Phase 5 — si oui** : 7.0.0.

Point de bascule : **un cabinet dit « je le mets chez tous mes clients »**. Avant, on ne dépense rien de récurrent.

## L'inventaire — ce qu'il nous faut

### Comptes et achats

- [ ] Apple Developer Program — environ 99 $/an (signature + notarisation macOS).
- [ ] Certificat de signature Windows — environ 200 à 400 $/an ; vérification de l'entreprise, prévoir du délai. À VÉRIFIER : certains certificats couvrent plusieurs produits.
- [ ] Dépôt GitHub **public** pour les fichiers de release (gratuit).
- [ ] Nom de domaine + adresse email professionnelle (support@…) ; une page web de présentation, même simple.
- [ ] Un endroit sûr pour la **clé privée de licence** : fichier chiffré chez Skander + copie sur support externe. Perdue = toutes les licences à réémettre.

### Décisions à prendre (Skander)

- [ ] Le **nom commercial** de l'app cabinet.
- [ ] Le **prix** de la licence entreprise (annuel, ancré sur ce que ça fait économiser en heures et en honoraires, jamais sur le coût de développement) et la **remise** parrainage.
- [ ] La **durée d'essai** (30 jours proposés) et le comportement à l'**expiration** (proposé : tout reste lisible, seule la création attend).
- [ ] La **politique de support** : une adresse, un délai de réponse annoncé.
- [ ] Le **contenu du paquet** : PDF de chaque pièce (lourd mais complet) ou journaux seuls.
- [ ] Quels **formats d'export** on livre en premier (selon les cabinets rencontrés).

### Les quatre questions au comptable

1. Quel **logiciel comptable** utilise-t-il ?
2. Quel **format d'import** accepte-t-il (CSV, texte, XML) et avec quelles colonnes ?
3. Quels **numéros de comptes** pour les ventes, les achats, la TVA collectée, la TVA déductible, les clients, les fournisseurs, la caisse, la banque ?
4. Préfère-t-il **une écriture par facture** ou **une écriture récapitulative par mois** ?

Et une cinquième, commerciale : *qu'est-ce qu'il vous faudrait pour l'imposer à vos clients ?*

### Vérifications légales — À VÉRIFIER

- [ ] **Déontologie** : « licence cabinet gratuite + remise pour le client parrainé » est-il acceptable pour un expert-comptable ? Ordre des Experts-Comptables de Tunisie. Jamais de commission en argent avant cette réponse.
- [ ] **Objet social** de la SUARL : peut-elle vendre du logiciel ?
- [ ] **CGU, contrat de licence, limitation de responsabilité** — surtout sur la paie et la fiscalité — relus par un juriste avant le premier client payant.
- [ ] **Validation de la paie** par un comptable avant de la vendre : des bulletins faux avec ton logiciel, c'est ton nom.
- [ ] **Facture électronique (TEIF)** : si elle devient obligatoire pour les assujettis TVA, un produit qui ne la fait pas devient invendable. À suivre de près ; si c'est en route, ça passe devant tout.
- [ ] **Protection des données (INPDP)** : sans serveur, c'est le cabinet qui détient les données de ses clients sur son poste, comme aujourd'hui avec ses fichiers — le chiffrement au repos est là pour ça. Dès qu'un serveur existe (7.0.0), déclaration et juriste.

### Technique à préparer

- [ ] Workflow de release à **deux produits** (SkanFact, SkanFact Cabinet) ; secrets de signature.
- [ ] Paire de clés de licence (`scripts/licence.js`) ; empreinte de la clé publique embarquée dans l'app.
- [ ] Tests : suite pure pour clôture, paquet, écritures, licence ; test de l'app réelle pour Cabinet ; les cinq fuseaux horaires restent dans la suite.
- [ ] Jeu de démo cabinet : cinq entreprises fictives, treize mois chacune, avec des mois manquants et provisoires pour que l'écran Dossiers parle.

### Matériel de vente

- [ ] Démo de dix minutes : l'entreprise clôture et envoie ; le cabinet reçoit, voit le vert, relance un absent, exporte.
- [ ] Une page « pour les cabinets » et une grille tarifaire.
- [ ] Le contrat de licence et les CGU (après le juriste).
- [ ] Le pitch en trois phrases : *vos clients vous envoient un dossier complet chaque mois, vous voyez d'un coup d'œil qui est en retard, et vous importez sans ressaisir.*

## Ce qu'on ne fait pas maintenant

- Pas de serveur, pas de portail web, pas de paiement en ligne — tant qu'aucun cabinet n'a dit oui. Chacun coûte cher et ne prouve rien.
- Pas de comptabilité générale (balance, grand livre, bilan) : c'est le métier du comptable, c'est réglementé, et un bilan faux est pire qu'aucun bilan. SkanFact reste l'endroit où la pièce naît proprement.
- Pas d'e-facture tant qu'elle n'est pas obligatoire — mais on surveille.
- Pas de version mobile.

## Les risques, et ce qui les couvre

| Risque | Couverture |
|---|---|
| Aucun cabinet ne dit oui | On le sait après la phase 2, pour quelques jours de travail et zéro coût récurrent |
| L'e-facture devient obligatoire | Elle passe devant tout ; l'export TEIF est un chantier borné |
| Un bug mélange deux dossiers chez un comptable | Isolation par dossier, paquets chiffrés par cabinet, tests dédiés — c'est la fin du produit sinon |
| Responsabilité sur la paie ou la fiscalité | Validation par un comptable, limitation de responsabilité relue, « À VÉRIFIER » visibles dans l'app |
| Un seul développeur (Claude) | `CLAUDE.md`, tests, changelog : tout est écrit pour être repris |
| Perte de la clé privée de licence | Copie hors ligne ; procédure de réémission |
