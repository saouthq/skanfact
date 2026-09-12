# SkanFact — Plan Cabinet

*Vendre SkanFact aux entreprises en passant par les cabinets comptables. Rédigé le 12/09/2026 à partir de la discussion avec Skander, réécrit le soir même après la livraison de la 6.8.0. Les points marqués « À VÉRIFIER » relèvent d'un comptable, d'un juriste ou de l'Ordre.*

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

**Tout le plan initial est livré, sauf ce qui dépend d'un achat ou d'une décision de Skander.**

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
| **6.8.0** | **SkanFact Cabinet 2.0 — l'audit traité en bloc** | **écrite et vérifiée, PAS ENCORE PUBLIÉE (quota GitHub)** |
| 6.6.0 | Signature Apple / Windows | **attend les certificats (achat)** |
| — | Mises à jour sans token (dépôt public) | **attend un oui de Skander** |
| 7.0.0 | Serveur | seulement si un cabinet dit oui |

> **À publier dès le 1ᵉʳ octobre** (retour du quota GitHub Actions) : la 6.8.0 est la plus grosse version du cabinet. Elle se teste dès maintenant avec `npm start` ou l'installeur local, sans rien publier.

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

## Ce qui reste à faire

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

### Cabinet 2.1 — ce qui viendra d'un vrai cabinet

Volontairement **non construit** : ce sont les choses qu'un comptable demandera en cinq minutes de démonstration, et qu'il vaut mieux entendre de lui que deviner.

- **Plusieurs collaborateurs** sur un même cabinet (constat n° 20). Un poste, un mot de passe, une personne aujourd'hui. La vraie question n'est pas technique : qui voit quels dossiers ?
- **Une boîte de réception surveillée** : un dossier que l'application regarde, et où les paquets enregistrés depuis le mail s'importent d'eux-mêmes.
- **Les formats d'import de son logiciel de production** : aujourd'hui un CSV générique. Le format exact ne se devine pas, il se demande.
- **La facturation des honoraires du cabinet** : le champ existe (il totalise le portefeuille) mais SkanFact Cabinet ne facture rien et n'envoie rien.

### SkanFact 6.6.0 — Signature Apple et Windows *(~1 j + délais externes)*

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

1. **Maintenant, Skander seul** : montrer l'application à deux ou trois cabinets. Elle est complète — c'était la condition qu'il posait le matin même.
2. **1ᵉʳ octobre** : publier la 6.8.0 (le quota GitHub Actions revient). Une seule publication, pas six.
3. **Avec les réponses des cabinets** : Cabinet 2.1, construit sur ce qu'ils auront demandé et pas sur ce qu'on aura supposé.
4. **Avec les achats** : 6.6.0, puis premier client payant.
5. **Si oui** : 7.0.0.

**Point de bascule : un cabinet dit « je le mets chez tous mes clients ».** Avant, on ne dépense rien de récurrent.

---

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
