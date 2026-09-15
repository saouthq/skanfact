# SkanFact — Plan Cabinet

*Vendre SkanFact aux entreprises en passant par les cabinets comptables. Rédigé le 12/09/2026 à partir de la discussion avec Skander, réécrit le soir même après **deux audits** de l'application du cabinet et la livraison de la 6.8.1. Les points marqués « À VÉRIFIER » relèvent d'un comptable, d'un juriste ou de l'Ordre.*

> **Pour aller droit au but** : où on en est → *Où on en est*. Ce qu'il reste à corriger et dans quel ordre → **Les versions à venir**. Ce qui attend une décision de Skander → *Ce qui ne dépend pas de nous*.

## En une page

- **Le cabinet est le canal de vente.** Un cabinet gère des dizaines de dossiers ; s'il adopte SkanFact, il l'impose à ses clients parce que c'est lui qui subit leur désordre.
- **Le cabinet ne paie jamais.** Il reçoit gratuitement **SkanFact Cabinet**, une application qui lui rend service même si un seul de ses clients utilise SkanFact — et qui, depuis la 6.8.0, lui sert de **tableau de bord de tout son portefeuille**, y compris les clients qui n'ont pas SkanFact.
- **L'entreprise paie** une licence annuelle. Un client amené par un cabinet a une **remise** ; le cabinet ne touche **pas d'argent** (question déontologique — À VÉRIFIER auprès de l'Ordre).
- **Pas de serveur en première version.** Les deux applications s'échangent un **fichier chiffré**, le paquet mensuel. Aucun coût récurrent, aucune donnée hébergée, rien à sécuriser la nuit.
- **On ne construit le portail en ligne que si un cabinet a dit oui.** Tout ce qui précède se fait en semaines, se montre à deux cabinets, et n'est jamais jeté : le jour où le serveur existe, seul le transport change.

## Les deux produits

| | **SkanFact** (entreprise) | **SkanFact Cabinet** (cabinet) |
|---|---|---|
| Qui l'installe | L'entreprise, payante | Le comptable, gratuit |
| Ce qu'il fait | Crée les pièces, tient stock, paie, trésorerie | **Lit**, contrôle, relance, exporte vers son logiciel |
| Ce qui sort | Le **paquet mensuel** chiffré | L'export d'écritures ; les relances ; les accusés de réception |
| Code | Un seul dépôt. Même `core.js`, mêmes calculs, mêmes listes, même chiffrement | Même dépôt, second point d'entrée, second installeur, second `appId` |
| Règle absolue | — | **Ne modifie jamais les données du client.** Deux vérités = conflits (leçon de la 3.2.0) |

Le comptable voit exactement les chiffres du client, calculés par les mêmes lignes de code. Une correction profite aux deux d'un coup.

## Comment ça circule

```
ENTREPRISE                                          CABINET
SkanFact                                            SkanFact Cabinet
  1. clôture le mois                                  4. glisse le paquet sur la fenêtre
  2. « Envoyer au cabinet »                              (ou le double-clique dans le Finder)
  3. mars-2026.skanpack (chiffré pour ce cabinet) ──► 5. le dossier passe au vert
     par mail, Drive, WhatsApp, clé USB               6. accuse réception au client
  ◄──────────── accusé de réception ────────────────  7. exporte les écritures de TOUS ses clients
  ◄──────────── relance si rien n'arrive ───────────     relance ceux qui n'ont rien envoyé
```

**L'appairage :** le cabinet génère une paire de clés dans son app et remet à ses clients un **fichier d'appairage** (son nom, son email, sa clé publique) plus une **empreinte** courte à vérifier de vive voix. L'entreprise l'importe une fois. Dès lors ses paquets sont chiffrés pour ce cabinet et pour lui seul — et **cette empreinte est la preuve du parrainage** : elle figure dans la demande de licence, c'est elle qui déclenche la remise. Le mécanisme technique et le mécanisme commercial sont le même objet.

---

## Où on en est — 12/09/2026 au soir

**Tout le plan initial est livré**, sauf ce qui dépend d'un achat ou d'une décision de Skander. Deux audits ont été passés sur l'application du cabinet dans la même journée : le premier a dit ce qui **manquait**, le second ce qui était **faux**.

| Version | Quoi | État |
|---|---|---|
| 6.0.0 | Clôture de période | publiée |
| 6.1.0 | Paquet mensuel `.skanpack` | publiée |
| 6.2.0 | Appairage du cabinet | publiée |
| 6.2.1 | **SkanFact Cabinet 1.0.0** | publiée, installeurs Mac et Windows joints |
| 6.3.0 | Écritures comptables (Cabinet 1.1.0) | publiée |
| 6.4.0 | Licence hors ligne | publiée (désarmée) |
| 6.5.0 | Chien de garde et rapport de problème | publiée |
| 6.7.0 → 6.7.3 | Relais de mise à jour, et ses trois corrections | publiées |
| **6.8.0** | **Cabinet 2.0 — le premier audit traité en bloc** | écrite et vérifiée, **pas encore publiée** |
| **6.8.1** | **Le second audit — ce qui détruisait, mélangeait ou mentait** | écrite et vérifiée, **pas encore publiée** |
| **6.8.2** | **Le reste de la liste « avant publication »** | écrite et vérifiée, **pas encore publiée** |
| 6.9.0 | Cabinet 2.1 — la confiance et le travail du cabinet | à faire, avec les retours des cabinets |
| 6.10.0 | Cabinet 2.2 — le confort, la vente, la distribution | à faire |
| 6.11.0 | Signature Apple / Windows | **attend les certificats (achat)** |
| — | Mises à jour sans token (dépôt public) | **attend un oui de Skander** |
| 7.0.0 | Serveur | seulement si un cabinet dit oui |

> **Une seule publication, dès le 1ᵉʳ octobre** (retour du quota GitHub Actions), portant 6.8.0 + 6.8.1 + 6.8.2 — la liste « avant publication » est intégralement traitée. Six versions publiées en une matinée ont consommé le quota gratuit d'un mois entier : c'est le rythme qui était fautif, pas le tarif. En attendant, tout se teste avec `npm start`, `npm run e2e:*` ou `Installer SkanFact.command`, sans consommer une minute.
>
> **État de vérification à ce jour** : `npm test` → **209 tests OK**. Les huit suites qui ouvrent vraiment les applications (`e2e:cabinet`, `e2e:refus`, `e2e:perte`, `e2e:boucle`, `e2e:couches`, `e2e:demenagement`, `e2e:entreprise`, `e2e:gel`) passent, zéro erreur JS.

---

## L'audit de l'application Cabinet — 12/09/2026

Constat de Skander le matin : « il manque beaucoup de choses, et c'est pas trop pratique ; pour la montrer à un comptable il faut qu'elle soit complète ». Audit fait sur l'application réelle (captures de chaque écran et de chaque fenêtre, avec le jeu d'exemple), puis relecture de `cabcore.js`, `main.js`, `preload.js` et du rendu. **24 constats.**

**Verdict d'alors** : la 1.0.0 avait été conçue pour *démontrer un mécanisme* avec cinq dossiers. Elle était juste et honnête, mais ce n'était pas l'outil quotidien d'un cabinet qui suit soixante clients. Rien n'était à jeter ; il manquait des couches.

**Verdict ce soir : 23 constats sur 24 sont corrigés.** Le seul laissé de côté l'est volontairement (les collaborateurs, hors périmètre v1).

| # | Constat du matin | État ce soir |
|---|---|---|
| 1 | Impossible de créer un dossier à la main | ✅ + **collage d'une liste entière** depuis un tableur |
| 2 | Aucun assistant de première utilisation | ✅ cinq écrans, dont « ne rien perdre » |
| 3 | Fiche client creuse (60 % de blanc) | ✅ courbe de CA par exercice, fiche complète, **impression** |
| 4 | Listes intenables à soixante lignes | ✅ tri, pagination, totaux, export CSV, Cmd+K |
| 5 | Aucune trace des relances, pas de relance groupée | ✅ historique (date, moyen, mois, note) + tournée groupée |
| 6 | Pas de numéro de téléphone | ✅ + **appel et WhatsApp** depuis la fiche |
| 7 | **Aucune sauvegarde** | ✅ quotidienne, nommées, copie externe, **clé de secours**, restauration |
| 8 | Mot de passe non modifiable | ✅ avec rechiffrement des sauvegardes |
| 9 | Ni suppression d'un dossier ni d'un paquet | ✅ avec confirmation écrite et sauvegarde préalable |
| 10 | Pas de glisser-déposer | ✅ + **double-clic dans le Finder** |
| 11 | `settings.relanceDay` mort | ✅ implémenté et réglable |
| 12 | `dossier.from` jamais réglable | ✅ date de début de mission |
| 13 | L'aide parlait encore du jeton d'accès | ✅ aide réécrite (7 articles) |
| 14 | Pastille Relances incohérente avec la page | ✅ une seule source (`relanceRows`) |
| 15 | Aucun calendrier d'échéances | ✅ **rattaché aux paquets manquants** |
| 16 | Aucun profil fiscal par client | ✅ régime, périodicité TVA, honoraires, début de mission |
| 17 | Aucune vue de portefeuille | ✅ quatre chiffres en tête de la page Dossiers |
| 18 | Pas de vue par exercice | ✅ mois groupés par année + sélecteur d'exercice sur la courbe |
| 19 | Aucun regroupement d'écritures | ✅ page **Écritures** : un mois ou un exercice, tous clients, un seul CSV |
| 20 | Aucun collaborateur | ⏸ **hors périmètre v1**, assumé et écrit dans l'aide |
| 21 | Aucune bulle « i » | ✅ 31 bulles, avec un test de cohérence |
| 22 | La marque était celle de l'app entreprise | ✅ ardoise et dossier, comme son icône |
| 23 | Écran de mot de passe nu | ✅ étiquettes, « Afficher », solidité, avertissement en rouge, 8 caractères |
| 24 | Un message passager recouvrait « Enregistrer » | ✅ « ✓ enregistré » à côté du bouton |

### Ce que l'audit n'avait pas vu, et que la construction a révélé

Six défauts trouvés **pendant** la 6.8.0, tous corrigés, tous accompagnés d'un test qui a échoué avant le correctif :

1. **`drawUpdatePanel` appelait `h()`, qui n'existe pas dans ce fichier.** Copié de l'app entreprise, où la fonction d'échappement porte ce nom. Le panneau plantait **au moment précis où il devait annoncer qu'une mise à jour était impossible** — c'est-à-dire le chemin de secours ajouté la veille en 6.7.2. → un test relit tout le code du cabinet et traque les appels à des fonctions inexistantes, **y compris dans les gabarits**.
2. **L'assistant réutilisait des noms de classes de la feuille de style partagée** (`.setup-step`, qui interdit le retour à la ligne côté entreprise) : texte non coupé, boutons hors de la fenêtre, **aucune erreur en console**. → classes renommées, et un test interdit les homonymes.
3. **Le matricule d'un dossier ne s'enregistrait pas du tout**, et son identifiant restait fondé sur le nom. Le jour où ce client aurait envoyé son premier paquet, un **second dossier** serait apparu à côté du premier.
4. **La copie externe recopiait toute l'arborescence des paquets à chaque enregistrement** — à soixante clients sur trois ans, plusieurs secondes de blocage pour enregistrer un numéro de téléphone.
5. **Perdre le fichier principal ressemblait au premier jour.** L'écran disait « Bienvenue, choisis un mot de passe » alors que les sauvegardes étaient juste à côté.
6. **Le même mot de passe n'ouvrait pas les sauvegardes** après une recréation : chaque création tire un nouveau sel, donc la clé dérivée change. L'application répondait « cette sauvegarde a été faite avec un autre mot de passe » à quelqu'un qui venait de taper le bon, **au pire moment possible**.

### Et une leçon de méthode

Les tests qui ouvrent vraiment l'application vivaient dans un dossier de travail **temporaire**, effacé à chaque session, alors que `CLAUDE.md` les désignait comme « le test qui compte ». Il fallait donc les réécrire de mémoire à chaque fois, et ils dérivaient. Ils sont désormais **dans le dépôt** (`test/e2e/`, `npm run e2e:*`), la version qu'ils vérifient est lue dans `package.json`, et l'un d'eux — `e2e:perte` — supprime vraiment le fichier de données pour prouver qu'on récupère tout, **clé du cabinet comprise**.

---

## Le second audit — 12/09/2026 au soir

Demande de Skander : « creuse encore plus profond, il manque encore, je suis sûr ». Audit mené **sur la 6.8.0 elle-même**, c'est-à-dire sur l'application qu'on venait de finir : treize angles en parallèle (perte de données, sécurité, protocole du paquet, métier comptable, écran par écran, écart avec l'app entreprise, passage à soixante clients, français et finitions, tests, construction et livraison, relation client, première démonstration, confidentialité), chaque constat **relu par un contradicteur** chargé de le réfuter, puis deux critiques de complétude et un second tour sur les angles manqués.

**131 constats confirmés, 87 retenus.** Le premier audit avait regardé *ce qui manquait* ; celui-ci a regardé *ce qui était faux*. Ce ne sont pas les mêmes défauts, et les seconds sont plus graves : une fonction absente se voit, une fonction qui ment ne se voit pas.

> **La phrase à garder de cet audit.** L'application disait trois choses qu'elle ne faisait pas : « vérifiées, intactes » (rien n'est signé, et le verdict s'effaçait), « personne ne peut les lire » (les paquets dorment en clair sur le disque), « une sauvegarde est prise juste avant » (elle venait d'être purgée). Un comptable achète — ou recommande — sur la parole d'un logiciel.

### Les neuf familles

| | Famille | Constats | Corrigés |
|---|---|---|---|
| **A** | Ce qui détruit des pièces ou des chiffres | 10 | 9 |
| **B** | Ce qui tue la démonstration | 12 | 8 |
| **C** | Ce que l'application affirme et qui n'est pas vrai | 14 | 5 |
| **D** | L'identité d'un dossier | 5 | 5 |
| **E** | Ce que le paquet apporte, et que le cabinet jette | 4 | 0 |
| **F** | Le travail du cabinet, absent de l'application | 2 | 0 |
| **G** | Le geste quotidien | 25 | 5 |
| **H** | Livrer le produit et le vendre | 14 | 2 |
| **I** | Les tests qui ne peuvent pas échouer | 3 | 0 |

### Les cinq constats les plus graves, et ce qu'ils coûtaient

1. **La sauvegarde « avant suppression » était effacée à la seconde où elle naissait** (A4). Les sauvegardes se purgeaient par **ordre alphabétique** : « avant-… » passait toujours en premier. La fenêtre affichait « Une sauvegarde est prise juste avant » pendant que le filet disparaissait. → corrigé en 6.8.1.
2. **Un mois renvoyé écrasait le paquet sur lequel le comptable avait déclaré** (A2). Le 15 avril il dépose la TVA de mars ; le 3 juin le client rouvre mars et renvoie — l'ancien fichier n'existait plus nulle part. → corrigé en 6.8.1.
3. **Un nom de société en arabe n'avait pas d'identité** (A5). `شركة الأمان` et `مخبزة الياسمين` donnaient la même clé vide : dans un portefeuille tunisien, **tous** les clients en raison sociale arabe tombaient dans un seul dossier et leurs paquets s'écrasaient. → corrigé en 6.8.1.
4. **Ouvrir une pièce lançait le fichier avec le programme du système, sous un nom choisi par l'expéditeur** (C2). Un paquet contenant `facture.pdf.command` exécutait du code d'un simple clic, sur le poste qui détient soixante comptabilités. → corrigé en 6.8.1.
5. **Rien ne prouve qui a envoyé un paquet, et l'application certifie quand même « vérifiées, intactes »** (C1). Le paquet est chiffré **pour** le cabinet avec sa clé publique — que n'importe qui peut avoir. L'empreinte prouve que le fichier n'a pas bougé depuis sa fabrication, pas **qui** l'a fabriqué. → **reste à faire (6.9.0)**, c'est un changement de format.

---

## Les versions à venir

*Contrainte qui décide de tout : la 6.8.x n'est **pas encore publiée** et le quota GitHub Actions revient le 1ᵉʳ octobre. Une publication coûte quatre applications et ~0,65 $ de quota, les machines macOS étant facturées dix fois les autres. Donc : **tout ce qui détruit une pièce ou tue une démonstration entre avant la publication**, et on publie **une seule fois**.*

### 6.8.1 — livrée le 12/09/2026 *(ce qui détruisait, mélangeait ou mentait)*

Les 30 constats qui font perdre une pièce, afficher un chiffre faux, ou se voir dans les cinq premières minutes d'une démonstration.

- **Données** : A1 manifeste validé avant de toucher au disque · A2 un mois renvoyé garde son fichier (`-r2`) et annonce l'écart de chiffres · A3 la copie externe remplace ce qui a changé · A4 purge par date, avec réserves séparées · A5 noms non latins · A7 valider avant de muter l'état · A8 un paquet plus ancien est écarté · A9 un paquet sans fichier est marqué.
- **Démonstration** : B1 seuls les mois révolus produisent une échéance · B2 les échéances et les relances comptent la même chose · B3 le début de mission est respecté partout · B4 le 1ᵉʳ du mois ne bascule plus tout en retard · B5 `money()` garde le signe · B6 le total de CA refuse les devises mélangées · B11 les accords.
- **Affirmations** : C2 liste blanche d'extensions à l'ouverture · C4 décompression bornée · C5 le verdict d'intégrité est conservé · C7 mot de passe exigé pour exporter la clé de secours.
- **Identité** : D2 matricule modifiable, identité recalculée · D3 « début de mission » qui fonctionne · D4 borné à cinq ans, en gardant la fin · D5 recherche sans accents.
- **Livraison** : H5 l'app gratuite du comptable n'embarque plus le code de l'app payante · H9 SKANCYBER dans l'installeur Windows.
- **Quotidien** : G9 tri (classe absente, flèche inversée, urgence irrécupérable) · G11 pas de relance enregistrée si rien n'est parti · G18 « il y a 3 jours » en jours de calendrier · G19 tailles de fichiers à la virgule · G24 « ce Mac » / « le Finder » sous Windows.

### 6.8.2 — livrée le 12/09/2026 *(le reste de la liste « avant publication »)*

*Règle d'admission : ça bloque un cabinet réel, ou ça rend un test menteur.* **Les huit sont faits.**

| Code | Ce que c'était | Ce qui a été livré |
|---|---|---|
| **A6** | **Changer d'ordinateur n'avait aucun chemin.** Sur le Mac neuf, le premier mot de passe fabriquait un cabinet **vide avec une clé neuve** ; les paquets que les clients enverraient ensuite étaient refusés (« adressé à un autre cabinet »). | « J'ai déjà un cabinet sur un autre ordinateur… » sur l'écran de mot de passe, **avant** toute création de clé. L'app annonce ce qu'elle a trouvé avant de demander le mot de passe, valide tout avant de toucher au disque, recolle les chemins des paquets sur ce poste, et finit par l'empreinte. `npm run e2e:demenagement` joue les deux postes. |
| **C6** | Un **fichier en trop** dans un paquet n'était ni vérifié ni signalé, alors qu'il s'affichait et s'ouvrait. | Troisième compteur « intrus ». Il n'entre jamais dans les pièces vérifiées, il est dit au rapport, gardé avec le paquet, marqué d'un « ? », et son ouverture passe par une question. |
| **G1** | Importer vingt paquets **bloquait 22 secondes sans un mot**, et le cabinet n'avait pas de chien de garde. | Fenêtre d'avancement (« paquet 7 sur 20 — Pharmacie El Menzah ») avec un bouton Arrêter qui agit entre deux paquets ; plus de double hachage du manifeste ; le chien de garde de la 6.5.0 porté, avec une 6ᵉ règle propre au cabinet. |
| **G6 / G7** | Échap fermait tout, Entrée ne validait rien, le focus se posait sur « Annuler » ; **Cmd+K ouvrait la palette DERRIÈRE la fenêtre** et lui volait le clavier. | Les deux sens fermés (la palette refuse de s'ouvrir sous une fenêtre, et se referme quand une fenêtre s'ouvre par le menu), Entrée valide, le focus va au premier champ, et Échap sur un formulaire rempli prévient. `npm run e2e:couches`. |
| **B8** | Le bandeau de la page Relances contredisait le tableau dix pixels plus bas. | Un compteur et la liste qu'il annonce partent maintenant de la même fonction — règle générale posée. |
| **B9** | Dans le jeu d'exemple, chaque paquet était **reçu le 8 du mois qu'il couvre**. | Réception au mois suivant, à des jours différents d'un client à l'autre, jamais dans le futur. |
| **H10** | Les icônes de `.skanpack` et `.skanrecover` étaient des **PNG**, silencieusement ignorés. | De vrais `.icns` / `.ico` (`node scripts/icones.js`), le `.ico` à sept tailles, et un test qui rejoue la résolution d'electron-builder. |
| **I1 / I2 / I3** | Trois tests **qui ne pouvaient pas échouer**. | Les deux `main.js` entrent dans le contrôle statique ; le test des fuseaux appelle enfin `today()` et les fonctions sans date de référence ; l'assertion toujours vraie est remplacée et `safeState` est **exécutée**. Chacun prouvé en réintroduisant son défaut. |

> **Deux défauts trouvés pendant la 6.8.2, et corrigés :** en posant le garde-fou « ne jette pas la saisie », un remplacement de texte trop gourmand a armé la mauvaise fenêtre — l'accusé de réception s'ouvrait **avec aucun bouton branché**, sans rien en console. Et la fenêtre d'avancement de l'import pouvait se **rouvrir pour toujours** sur un dernier message arrivé en retard, par-dessus le compte rendu. Les deux sont désormais couverts par un test.

> **15/09/2026 — le comptable a vu l'application, et il manque les livres.** Le plan des versions
> suivantes du Cabinet (livres du dossier, pièces derrière les chiffres, travail du cabinet,
> démonstration avec de vrais paquets) est dans **`PLAN-COMPTABLE.md`**. Il reprend de la liste
> ci-dessous B7, B10, E1, E2 et F1. Le lire avant de commencer une version 9.x du Cabinet.

### 6.9.0 — Cabinet 2.1 : la confiance et le travail du cabinet

*Ce qui demande un changement de format, ou une réponse d'un vrai comptable. À construire avec les retours des premiers cabinets.*

- **L'origine et le secret** — **C1 signer le paquet côté client** et épingler la clé au dossier : c'est la réponse à « comment tu sais que ça vient de moi ? » · **C3** rechiffrer les paquets à l'arrivée (ou corriger les deux phrases qui affirment le contraire) · C8 verrouillage automatique · C9 les pièces extraites · C10 un journal de ce qui sort (secret professionnel) · C11 et C14 les versions et paramètres écrits **et relus** · C12 renouveler la clé du cabinet sans rendre les archives illisibles · C13 neutraliser les cellules CSV venues de soixante fichiers tiers.
- **L'identité** — D1 adopter et fusionner deux dossiers quand un matricule a été écrit autrement.
- **Ce que le paquet apporte et que le cabinet jette** — B7 le crédit de TVA (« 0,000 DT » se lit « rien à déclarer ») · B12 et E3 les vrais compteurs du mois, et savoir quels clients ont des salariés · E1 afficher ce que l'app entreprise n'a **pas pu joindre** · E2 l'empreinte du manifeste, sur laquelle repose le rituel promis au client · E4 deux fichiers de même chemin.
- **Le travail du cabinet** — **F1** un mois n'a que trois états, tous du côté du client : *reçu → saisi → déclaré → payé* n'existe nulle part · F2 les échéances annuelles d'un cabinet tunisien. **À VÉRIFIER** : toutes ces dates restent réglables et marquées comme telles.
- **Les filets** — A10 deux postes du cabinet sur le même dossier partagé s'écrasent en silence (la leçon de la 3.2.0, jamais portée à l'app qui contient soixante comptabilités) · A9 un bouton « Vérifier mes paquets » qui compare l'index et le disque dans les deux sens.
- **Ce que le premier plan réservait déjà à 2.1** — les **collaborateurs** (constat n° 20 du premier audit), les **formats d'import** du logiciel de production du cabinet, les **honoraires**. Trois choses qui se demandent, pas qui se devinent.

### 6.10.0 — Cabinet 2.2 : le confort, la vente, la distribution

*Rien ici n'empêche de vendre ; tout ici décide si le produit est gardé.*

- **La vente** — **H1** un cabinet n'a aucun moyen de télécharger l'application, et le seul bouton offert mène à un 404 (route publique dans le relais) · **H2** l'application est le canal de vente et n'a pas un bouton pour **inviter un client** · H3 associer le `.skanpair` côté entreprise · H4 accepter la clé de secours quand on la dépose · H8 README et fiche d'installation · H6 et H7 construction locale des deux apps sous Windows et sur Mac.
- **Le pont entreprise ↔ cabinet** — **H11** sous Windows, « Envoyer au comptable » n'attache pas le paquet et l'app dit quand même « Message préparé » · H12 rappeler d'**envoyer**, pas seulement de fabriquer · H13 le sélecteur de mois ne remonte qu'à douze · H14 l'appairage récupère l'adresse du comptable, et l'envoi l'ignore.
- **La démonstration complète** — **B10** Écritures, la fonction qui fait gagner des heures, est **vide pendant toute la démonstration**.
- **Le quotidien** — G2 à G5 performances (copie externe, déchiffrement répété, recherche, pont) · G8 la tournée de relances interruptible · G10 le destinataire d'une relance · G12 le bouton retour câblé en dur · G13 « Ce dossier n'existe plus. » · G14 les boutons hors écran à la taille minimale · **G15** coller une liste de clients partout, pas seulement dans l'assistant · G16 rendre ses pièces à un client d'un geste · G17 l'impression emporte les notes internes · G20 le thème sombre · G21 les erreurs en anglais avec leur code errno · G22 « À propos » · G23 une mise à jour qui n'annonce pas ce qu'elle change · G25 la signature promise par la bulle.

---

## Ce qui ne dépend pas de nous

### Décisions et achats de Skander (rien ne bouge sans lui)

| Quoi | Pourquoi c'est à lui | Délai |
|---|---|---|
| **Voir deux ou trois cabinets** avec l'app | C'est le point de bascule de tout le plan | cette semaine |
| Faire valider les « À VÉRIFIER » par son comptable | Barèmes de paie, plan de comptes, assiette de la retenue, **jours de dépôt TVA et CNSS** | — |
| Poser les quatre questions déontologiques à l'Ordre | Parrainage, remise, absence de commission | — |
| Décider le **prix** de la licence entreprise | — | avant le premier client |
| Acheter **Apple Developer** (~99 $/an) | Signature et notarisation macOS | semaines de vérification |
| Acheter un **certificat Windows** (~200–400 $/an) | Vérification de l'entreprise | semaines |
| Dire oui ou non au **dépôt public de releases** | Décision commerciale, pas technique | — |

### 6.11.0 — Signature Apple et Windows *(~1 j + délais externes)*

Rien n'est modifiable tant que les certificats n'existent pas ; le workflow de publication n'a donc pas été touché.

- Apple Developer ID + notarisation ; certificat Windows. Les certificats vont dans les secrets du workflow, **jamais** dans le dépôt.
- `MAC_SIGNED = true` : Squirrel prend le relais de `mac-update.sh`.
- Deux installeurs à signer : vérifier que les certificats couvrent plusieurs produits d'une même société.

### Mises à jour sans token — le jour où Skander dit oui

1. Créer `saouthq/skanfact-releases`, **public**, vide (pas de code, uniquement des releases).
2. Dans `package.json`, `build.publish` : `owner: saouthq`, `repo: skanfact-releases`. Idem pour le cabinet.
3. Dans le workflow, `GH_TOKEN` doit être un **token personnel** ayant accès aux deux dépôts → secret `RELEASES_TOKEN`.
4. Dans `src/main.js`, `private: true` disparaît de la configuration de l'updater ; le panneau « token » reste une version de plus, pour les installations déjà en place.
5. **Les versions déjà installées continuent de chercher dans le dépôt privé** : publier la première version « publique » dans les DEUX dépôts, sinon personne ne la reçoit.

*Depuis la 6.7.0, le **relais Cloudflare** rend cette décision moins urgente : il détient le jeton à la place des utilisateurs, et les mises à jour arrivent sans que personne ait rien à saisir.*

### Ensuite, seulement si un cabinet a dit oui — SkanFact 7.0.0

Serveur de dépôt : les paquets circulent seuls ; comptes cabinet et entreprise ; INPDP ; hébergement ; abonnement mensuel justifié par un coût réel. Les deux applications ne changent pas, seul le transport change.

---

## L'ordre et le calendrier

1. **Fait** : la 6.8.2 — ce qui bloquait un cabinet réel, et les trois tests qui ne pouvaient pas échouer.
2. **Maintenant, Skander seul** : montrer l'application à deux ou trois cabinets. Elle est complète — c'était la condition qu'il posait le matin même. L'installeur local construit les deux apps sur son Mac sans consommer de quota.
3. **1ᵉʳ octobre** : publier **une seule fois** 6.8.0 + 6.8.1 + 6.8.2.
4. **Avec les réponses des cabinets** : 6.9.0, construite sur ce qu'ils auront demandé et pas sur ce qu'on aura supposé. C1 (la signature du client) en est la pièce maîtresse : c'est un changement de format, il ne se fait qu'une fois.
5. **Puis** 6.10.0, le confort et la vente.
6. **Avec les achats** : 6.11.0, puis premier client payant.
7. **Si oui** : 7.0.0.

**Point de bascule : un cabinet dit « je le mets chez tous mes clients ».** Avant, on ne dépense rien de récurrent.


## L'inventaire — ce qu'il nous faut

### Comptes et achats

- [ ] Apple Developer Program — environ 99 $/an (signature + notarisation macOS).
- [ ] Certificat de signature Windows — environ 200 à 400 $/an ; vérification de l'entreprise, prévoir du délai. À VÉRIFIER : certains certificats couvrent plusieurs produits.
- [ ] Dépôt GitHub **public** pour les fichiers de release (gratuit) — ou rien, si le relais suffit.
- [x] Relais de mise à jour (Cloudflare Workers, gratuit) — **déployé**.

### Questions au comptable (À VÉRIFIER)

- Les **jours de dépôt** réels : TVA et CNSS, selon la forme juridique et le régime. L'application propose le 28 et le 15, et l'écrit comme une proposition.
- Le **plan de comptes** du cabinet : les numéros proposés suivent l'usage tunisien et sont tous modifiables.
- L'assiette de la **retenue à la source**, les **barèmes de paie**, le **timbre fiscal**, l'avoir sans timbre.
- La périodicité de TVA selon le chiffre d'affaires.

### Questions à l'Ordre (déontologie)

- Un cabinet peut-il recommander un logiciel à ses clients ? Sous quelle forme ?
- Une remise accordée au client parrainé pose-t-elle un problème, sachant que **le cabinet ne touche rien** ?
- Le cabinet peut-il détenir les pièces de ses clients sur son poste, chiffrées ? (Mêmes obligations que les archives papier — À VÉRIFIER avec l'assureur.)
- Conservation et restitution : que doit-on pouvoir rendre à un client qui part ? *(L'application sait déjà extraire un paquet entier et copier le dossier d'un client.)*

---

## Ce qu'on ne fait pas maintenant, et pourquoi

- **Pas de serveur.** Tant qu'aucun cabinet n'a dit oui, un serveur, c'est un coût mensuel, des données hébergées, une déclaration INPDP et une surface à surveiller. Le fichier chiffré fait le même travail.
- **Pas de collaborateurs dans l'app cabinet.** La vraie question est « qui voit quels dossiers », et elle se répond avec un cabinet réel, pas en imaginant.
- **Pas de facturation des honoraires.** Le comptable a déjà un logiciel pour ça, et SkanFact Cabinet ne doit pas devenir un second.
- **Pas d'e-facture TTN / El Fatoora** tant que Skander ne le demande pas. À VÉRIFIER : la Tunisie généralise la facture électronique pour les assujettis TVA.
- **Pas de synchronisation temps réel.** La 3.2.0 fait du partage de fichier à tour de rôle, et le dit.

## Les risques, et ce qui les couvre

| Risque | Ce qui le couvre aujourd'hui |
|---|---|
| Le comptable perd son ordinateur | Copie externe (base, sauvegardes **et** paquets) + clé de secours hors du poste. L'app réclame les deux tant qu'elles manquent. |
| Le comptable oublie son mot de passe | Rien, et c'est voulu : c'est ce qui fait qu'un portable volé n'emporte pas soixante comptabilités. L'écran de création le dit en rouge. |
| Le fichier se corrompt | Il est mis de côté sans être effacé, l'écran l'explique, et 30 sauvegardes quotidiennes attendent. Prouvé par `npm run e2e:perte`. |
| Un client envoie un paquet abîmé ou d'un autre cabinet | Refusé avec une phrase en français que le comptable comprend sans appeler personne. Prouvé par `npm run e2e:refus`. |
| Un cabinet dit non | On n'a rien dépensé de récurrent, et l'app entreprise se vend seule. |
| Les dates fiscales changent | Aucune n'est en dur : toutes sont réglables et marquées « À VÉRIFIER » à l'écran. |
| L'application gèle | Le chien de garde la recharge et nomme la fonction coupable dans `main.log`. Prouvé par `npm run e2e:gel`. |
| L'éditeur disparaît | Les paquets sont des ZIP ordinaires, lisibles dans le Finder ; la licence se vérifie hors ligne ; rien n'est hébergé nulle part. |
