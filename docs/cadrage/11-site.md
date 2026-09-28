# 11 — Le site

*Proposé le 28/09/2026. **À valider par Skander.** Détaille `VISION-ARCHITECTURE.md` § 12 (« Le site »).
Le site vit dans le dépôt `saouthq/skanfact-site` ; ses règles de travail sont dans son `CLAUDE.md`,
et sa description page par page dans son `README.md`. Même session pour l'application, la console et
le site (décision du 27/09). Complété le même jour pour suivre le `14` : pages de métiers,
d'intégrations et pour les développeurs ; le site en arabe en vague 1.*

## En bref (pour Skander)

- **Jusqu'au lancement, le site ne change pas de rôle** : il présente l'application actuelle, à ses
  prix (`TARIFS-REFERENCE.md`). **Il ne vend rien qui n'existe pas encore** (vision § 12).
- **Au lancement (J5, `09`), il bascule en une fois** : nouvelle présentation, nouveaux tarifs (`07`),
  inscription, centre d'aide, page d'état, pages légales.
- **Il reste statique**, sans framework et sans étape de construction (règle du site). Il est rapide,
  bien référencé, et il **ne tombe pas quand le serveur tombe**.
- **Il ne garde aucune donnée de personne.** Les formulaires envoient directement au serveur en
  Tunisie (`06` § 3). Aucun outil de mesure d'audience ni de publicité n'y entre, pas plus
  qu'aujourd'hui.
- **Chaque phrase du site est tenue par le produit.** Aucun « certifié » sans numéro d'homologation
  (`05` § 3.7), aucun chiffre de sauvegarde sans mesure du mois (`06` § 1, S6).

---

## 1. Les pages, avant et après le lancement

Les pages d'aujourd'hui sont décrites dans le `README.md` du site. Ce qu'elles deviennent :

| Aujourd'hui | Au lancement | Pourquoi |
|---|---|---|
| `index.html` (accueil) | **Réécrit** : la plateforme, ses trois façons de s'ouvrir, le hors-ligne, le comptable dans les mêmes données | Le message change (vision § 1) |
| `tarifs.html` | **Réécrit** d'après `07` : Essentiel, Complet, modules, cabinets | Nouvelle grille |
| `acheter.html`, `paiement-ok.html`, `paiement-echec.html` | **Retirés** : on s'abonne et on paie **dans l'application** | Plus de clé à acheter (vision § 12) |
| `telecharger.html` | **« Installer »** : l'application installable depuis le navigateur, et l'application de bureau (caisse, clé USB) | Trois façons d'ouvrir (`00`) |
| `verifier.html` (vérifier une licence) | **Retiré** à la fin de la v10 (`08` § 5) | Plus de licence |
| `facturation.html`, `gestion.html`, `tunisie.html`, `excel.html` | **Mis à jour** : mêmes sujets, avec la plateforme | Elles attirent des visiteurs |
| `cabinet.html`, `comptables.html`, `pour-votre-client.html` | **Réécrits** : code cabinet, gratuit pour les clients abonnés, dossiers tenus, parrainage (`00`, `07`) | Le cabinet est notre premier canal |
| Guides (`guide-*.html`) | **Gardés et relus** : ils attirent des visiteurs et ils aident | Chaque règle fiscale reste « À VÉRIFIER avec ton comptable » |
| `questions.html`, `limites.html` | **Réécrits** : les limites de la plateforme (vision § 8) : ce qui marche hors ligne (`04` § 1), le mobile plus tard | Une limite dite avant vaut mieux qu'une découverte |
| `nouveautes.html` | Les nouveautés de la **plateforme** ; celles de la v10 archivées | — |
| `visite.html` | Une visite de la plateforme sur l'**entreprise d'exemple** | — |
| `vos-donnees.html`, `confidentialite.html` | **Réécrits** pour la plateforme (§ 3) | Le serveur change tout |
| `conditions-vente.html`, `mentions-legales.html` | **Réécrits** avec le juriste (`05` § 4.5) | — |
| `contact.html` | Gardé ; le support passe par la console (`10` § 2.7) | — |

**Pages nouvelles :**

| Page | Ce qu'elle fait |
|---|---|
| **Essayer** (inscription) | Courriel, mot de passe, téléphone ; crée l'essai de 30 jours **sur le serveur** (`00` § 1). Le formulaire envoie **directement** à `app.skanfact.tn` |
| **Je suis comptable** | Inscription d'un cabinet (`00` § 2) |
| **Aide** (centre d'aide) | Les **mêmes articles** que l'aide de l'application (§ 4) |
| **État du service** | La page d'état (§ 5) |
| **Sécurité et hébergement** | Ce que fait le `06`, **en chiffres mesurés** : hébergement en Tunisie, sauvegardes, dernier exercice de restauration réussi et sa date |
| **Reprendre mes données** | Depuis l'application actuelle, Excel ou un autre logiciel (`08`) |
| **Contrat de traitement**, **réversibilité** | Les engagements écrits avec le juriste (`05` § 4.5) |
| **Métiers** : une page par métier du lancement (commerce, grossiste, prestataire de services, cabinet ; restaurant et café en vague 1) | Ce que SkanFact fait pour ce métier, avec des écrans vrais (`14` § 3). Un métier des vagues n'a sa page **qu'une fois livré** |
| **Intégrations** | La liste de ce qui se branche, **allumé ou pas encore** (jamais une intégration annoncée avant d'exister), et ce qui part chez chaque partenaire (`14` § 4) |
| **Développeurs** | La documentation de l'API, générée depuis le code, et l'entreprise d'essai (`14` § 2.5) |

---

## 2. Avant le lancement

- Le site continue de présenter l'application actuelle, **telle qu'elle est** (règle du site). Il ne
  parle pas de la plateforme comme d'un produit disponible.
- **Pas de liste d'attente avec des adresses e-mail** tant que la déclaration INPDP n'est pas faite
  (`05` § 5) : recueillir des adresses, c'est traiter des données de personnes. D'ici là, qui veut être
  prévenu écrit par la page Contact.
- Les pages **Aide**, **Sécurité** et **État** se préparent dans une branche du dépôt du site, et
  sortent le jour du lancement.

---

## 3. Ce qui sort du navigateur d'un visiteur

Règle du projet : jamais une donnée de plus vers un serveur sans que la liste soit comptée et
décidée. Pour le site :

| Aujourd'hui | Au lancement |
|---|---|
| Le site lui-même (GitHub Pages) | Inchangé |
| **L'API de GitHub**, appelée depuis le navigateur pour afficher le numéro de la dernière version de la v10 (`assets/site.js`) | **Retirée** : la plateforme n'a pas de version à télécharger. Le numéro de l'application de bureau est écrit dans la page à la publication |
| Aucun outil de mesure d'audience, aucune publicité, polices servies par le site | **Inchangé.** Si un jour on veut compter les visites, ce sera un compteur **sur notre serveur en Tunisie**, sans cookie, avec la liste de ce qu'il garde, décidée d'avance |
| — | Les **formulaires** (inscription, cabinet) envoient **directement** au serveur en Tunisie ; rien ne passe par l'hébergeur du site (`06` § 3) |

**L'hébergement du site reste GitHub Pages** : gratuit, public comme le dépôt (décision du 27/09), et
il ne contient **aucune donnée de personne**. Le jour où ce ne serait plus vrai, il déménage.

---

## 4. Une seule aide, pour l'application et le site

Aujourd'hui, l'aide de l'application et les guides du site sont écrits séparément, et deux textes
séparés finissent toujours par se contredire (règle du projet depuis la 6.8.0).

Au lancement :
- **les articles d'aide vivent une seule fois**, dans le dépôt de la plateforme, à côté des écrans
  qu'ils expliquent (`02` M6 : un module apporte son aide) ;
- l'application les affiche ; **un outil du site** (comme `outils/nouveautes.mjs` aujourd'hui) en
  écrit les pages statiques à chaque publication. Ce n'est pas une étape de construction du site :
  c'est un fichier qu'on régénère, comme le sitemap ;
- **un test compare** les pages du site aux articles, et échoue s'ils divergent ;
- les **guides** fiscaux (TVA, timbre, retenue) restent des pages du site, parce qu'ils s'adressent à
  quelqu'un qui ne connaît pas encore SkanFact. Ils renvoient à l'aide pour le « comment faire ».

---

## 5. La page d'état

- Elle dit, pour chaque partie du service (l'application, la console, la facture électronique, les
  sauvegardes) : **en marche, ralenti, en panne**, et l'historique des incidents avec leur compte
  rendu (`06` § 9.1).
- Elle est **hébergée avec le site, hors de nos serveurs** : si le serveur tombe, elle le dit quand
  même.
- Elle se met à jour **toute seule** d'après la surveillance extérieure (`06` § 7), et **à la main**
  depuis la console pendant un incident (`10` § 2.8). L'outil précis est choisi dans le `12`.
- Elle ne contient **aucune donnée de client**.

---

## 6. Les tarifs, sans jamais diverger

Aujourd'hui, `TARIFS-REFERENCE.md` est le contrat entre l'application et le site. **Au lancement** :
- les prix vivent dans la **console** (offres, modules, prix datés : `10` § 2.11). C'est la source ;
- à chaque changement de prix, la console **exporte la grille publiée**, et un outil du site en écrit
  la page Tarifs ;
- **un test compare** la page Tarifs à la grille, et échoue s'ils divergent. Un prix affiché que le
  produit ne tient pas est un bug ;
- les **prix TTC** ne s'affichent qu'après avoir tranché la TVA et la retenue sur notre abonnement
  (`05` § 4.2).

---

## 7. Les règles du site qui restent

Elles sont dans son `CLAUDE.md` et ne changent pas :
- toute page ajoutée, renommée ou retirée **régénère le sitemap**, dans le même commit ;
- le domaine `skanfact.tn`, le fichier `CNAME`, les adresses absolues, la 404 à chemins absolus ;
- pas de framework, pas de dépendance ;
- le contenu fiscal porte « À VÉRIFIER avec ton comptable » ;
- **les outils d'audit du site** (`outils/audit.mjs`, captures) passent avant chaque publication.

**Une règle de plus au lancement** : les adresses `app.skanfact.tn` et `console.skanfact.tn` pointent
vers nos serveurs en Tunisie ; `skanfact.tn` et la page d'état restent chez l'hébergeur du site (`00`,
`06`).

**En vague 1** : le site en **arabe**, avec l'interface (`14` § 5). Le site est écrit dès maintenant
sans « gauche » ni « droite » dans ses styles, pour qu'il se retourne sans être refait.

---

## 8. À VÉRIFIER

1. **Le droit de recueillir une adresse** pour une liste d'attente avant la déclaration INPDP (`05`
   § 4.3).
2. **Les mentions légales du site** d'un service en ligne qui encaisse des abonnements (juriste,
   `05` § 4.5).

## 9. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | Le site garde son rôle jusqu'au lancement, puis bascule en une fois ; aucune page ne vend ce qui n'existe pas |
| 28/09/2026 (proposé) | Achat, paiement et vérification de licence quittent le site ; inscription, aide, état, sécurité, reprise et engagements légaux y entrent |
| 28/09/2026 (proposé) | Aucune donnée de personne sur le site ; les formulaires vont directement au serveur en Tunisie ; l'appel à l'API de GitHub disparaît ; aucune mesure d'audience tierce |
| 28/09/2026 (proposé) | Une seule aide pour l'application et le site ; des tarifs tirés de la console ; un test pour chacun contre la divergence |
| 28/09/2026 (proposé) | Pas de liste d'attente avec adresses avant la déclaration INPDP |
| 28/09/2026 (par délégation, `14`) | Pages de métiers, d'intégrations et pour les développeurs au lancement ; rien d'une vague n'est annoncé avant d'être livré ; site en arabe en vague 1 |
