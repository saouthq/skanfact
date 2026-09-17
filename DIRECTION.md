# SkanFact — La direction du projet

*Écrit le 15/09/2026 avec Skander, après la visite de son comptable. Ce document dit ce que sont les
deux applications, à qui on les vend, comment, et ce qu'il faudra construire pour y arriver. **Il
prime sur les autres plans** (`PLAN-CABINET.md`, `PLAN-PLATEFORME.md`, `PLAN-COMPTABLE.md`,
`ROADMAP.md`, `PLAN-UX.md`) : quand l'un d'eux le contredit, c'est lui qui a raison, et l'autre est
à corriger.*

---

## 1. Les décisions prises (ne pas rediscuter)

1. **L'objectif, en une phrase.** Une PME tunisienne gère et facture dans SkanFact sans rien savoir
   de la comptabilité ; chaque mois, son comptable reçoit sa comptabilité déjà écrite avec les pièces,
   la vérifie, la complète et la dépose depuis SkanFact Cabinet, sans jamais ressaisir. La mesure du
   succès : **zéro ressaisie**, et le temps par dossier chez le comptable qui baisse.
2. **Deux produits, une ligne nette.** L'app entreprise s'arrête à la **gestion** ; l'app cabinet fait
   la **comptabilité**, complète, au niveau des meilleurs logiciels du marché, **avec ou sans
   SkanFact chez le client**. Un cabinet doit pouvoir tenir un dossier dont l'entreprise n'a jamais
   entendu parler de SkanFact.
3. **Le paquet mensuel reste le pont**, dans les deux sens : les pièces et les écritures déduites
   montent vers le cabinet ; les questions du cabinet redescendent vers le client. Le Cabinet
   **n'écrit jamais** dans les données du client.
4. **Le modèle économique.** L'entreprise paie sa licence. Le Cabinet est **gratuit pour les dossiers
   dont l'entreprise est sur SkanFact** et **payant pour les autres**. Le cabinet ne touche jamais
   d'argent ; sa récompense pour amener un client sur SkanFact est que ce dossier ne lui coûte plus
   rien.
5. **Le comptable de Skander est le cabinet pilote**, avec un vrai dossier. Chaque version se juge sur
   son bureau. Sans pilote, on ne construit pas un logiciel de comptabilité « au niveau des
   meilleurs » : on construirait un beau logiciel que personne n'ouvre.
6. **On vise quelque chose qui n'existe nulle part ailleurs**, et on accepte que ce soit plus long.
   Ce qui n'existe nulle part : un logiciel de cabinet où les écritures de ses clients arrivent
   déjà écrites, avec leurs pièces, vérifiées, et où la question posée sur une ligne arrive chez le
   client en face de sa pièce.
7. **Rien de ce qui a été appris ne se jette** : hors ligne, jamais de données en otage, aucun
   chiffre affirmé qu'un test ne prouve, aucun message brut à l'écran, une seule source de vérité par
   règle. Ces principes valent pour les deux applications.

8. **Les écrans comptables de l'app entreprise (8.8.0 → 9.0.0) sont masqués, pas supprimés, et
   deviennent un module PAYANT** — l'option « Comptabilité » pour la petite entreprise qui n'a pas de
   comptable et tient elle-même ses livres. Le moteur reste (il écrit le paquet), l'onglet Écritures
   reste libre (le client doit voir ce qui part chez son comptable), le paquet part toujours
   gratuitement. **Décidé le 15/09/2026** (voir § 5, point L).

---

## 2. Les deux produits, et la ligne entre les deux

| | **SkanFact** (l'entreprise) | **SkanFact Cabinet** (le comptable) |
|---|---|---|
| Qui l'installe | Le chef d'entreprise, payant | Le cabinet, gratuit pour ses clients SkanFact, payant pour les autres |
| Ce qu'il fait | Devis, factures, achats, trésorerie, stock, séries, immobilisations, paie, déclarations sociales, clôture mensuelle, paquet au comptable | La **tenue** : plan de comptes, saisie, banque, lettrage, TVA et déclarations, inventaire, clôture d'exercice, états financiers, liasse, révision, portefeuille, collaborateurs |
| La comptabilité | **Déduite** des pièces, jamais saisie. Les écritures sont un sous-produit : elles partent au comptable. Les livres (grand livre, balance, états) existent pour vérifier, pas pour tenir | **Tenue**. Les écritures venues d'un paquet arrivent avec leur source et leur pièce ; le cabinet ajoute les siennes (OD, banque, inventaire) dans SON livre |
| Un client sans SkanFact | — | Un dossier ordinaire : tout arrive par la saisie, le relevé bancaire, l'import d'un autre logiciel |
| Ce qui sort | Le paquet mensuel `.skanpack` (chiffré pour le cabinet) ; les réponses aux questions du cabinet | Les questions au client ; les déclarations et états ; les exports |
| Ce qu'il ne fait pas | Tenir une comptabilité à la place du comptable ; déposer une déclaration | Modifier les données du client ; facturer à sa place ; déposer à sa place |
| Code | Un seul dépôt. Le **moteur d'écritures est partagé** (`src/renderer/compta.js`, à extraire de `core.js`), les listes, le chiffrement, les menus, les réglages, la feuille de style | Même dépôt, second point d'entrée, second installeur, même numéro de version, canal de mise à jour `cabinet` |
| Règle absolue | Une pièce émise ne se modifie pas ; elle se corrige par avoir | Une écriture validée ne se modifie pas ; elle se contre-passe. Le Cabinet n'écrit jamais chez le client |

**La ligne, dite autrement** : le chef d'entreprise ne doit jamais avoir besoin de connaître un
numéro de compte ; le comptable ne doit jamais avoir besoin de ressaisir une pièce que le client a
déjà créée.

**Comment ça circule, désormais dans les deux sens :**

```
ENTREPRISE (SkanFact)                                CABINET (SkanFact Cabinet)
  clôture le mois, « Envoyer au cabinet »   ──────►  importe le paquet : les écritures ENTRENT dans
  mars-2026.skanpack                                  le livre du dossier (source « skanfact »,
  (pièces + écritures déduites + licence)             pièces jointes, validées si le mois est clôturé)
                                                      saisit, rapproche, lettre, déclare, clôture
  reçoit les questions, répond depuis la    ◄──────  pose ses questions au client depuis la ligne
  pièce concernée, renvoie un mois révisé             (pièce absente, 471 non soldé, facture ouverte)
```

---

## 3. Le modèle économique

### L'entreprise (inchangé)

Essai 30 jours · **Indépendant 390 DT HT/an** · **Entreprise 690 DT HT/an** · **−20 % la première
année** si un cabinet équipé de SkanFact Cabinet parraine (son empreinte figure dans la demande de
licence : c'est déjà le cas depuis la 6.4.0). Postes illimités pour le même matricule.

### Le cabinet (nouveau)

- **Gratuit, sans limite, pour tout dossier dont l'entreprise a une licence SkanFact** (ou est en
  essai). Le cabinet reçoit ses paquets, tient le dossier, déclare, clôture : tout est inclus.
- **Gratuit jusqu'à 3 dossiers hors SkanFact**, pour toujours : un cabinet doit pouvoir essayer sur
  ses vrais dossiers sans rien signer, et un petit cabinet qui n'a que trois clients hors SkanFact ne
  paie rien.
- **Au-delà : par dossier hors SkanFact et par an.** Proposition à vérifier contre les prix pratiqués
  en Tunisie (Sage, EBP, éditeurs locaux) : **72 DT HT par dossier et par an** (6 DT/mois), dégressif
  par paliers (par exemple 60 DT au-delà de 20 dossiers, 48 DT au-delà de 50). **Postes et
  collaborateurs illimités** : on ne vend pas des sièges, on vend des dossiers — c'est ce que les
  concurrents ne font pas, et c'est ce qu'un cabinet qui grandit retient.
- **Ce que ça donne pour un cabinet de 60 dossiers** dont 10 sur SkanFact : 10 clients × 690 DT
  payés par les entreprises, et 47 dossiers hors SkanFact × 72 DT = 3 384 DT HT/an payés par le
  cabinet. Chaque client qu'il fait passer sur SkanFact lui coûte 72 DT de moins et rapporte 690 DT.
  **Les deux côtés poussent dans le même sens, sans qu'aucun argent ne passe par le cabinet** — c'est
  ce qui rend le modèle défendable devant l'Ordre (À VÉRIFIER, § 8).

### Ce qu'est un « dossier sur SkanFact »

Un dossier dont le **dernier paquet reçu date de moins de treize mois** et porte une **licence
SkanFact valide** (signée par une clé connue, non expirée, au matricule du dossier) — ou une mention
d'essai de moins de 30 jours. Un client dont la licence a expiré depuis plus de 60 jours redevient
un dossier hors SkanFact : le cabinet le voit venir (« la licence de X expire dans 30 jours »), et
c'est lui qui rappelle son client — l'intérêt est le sien.

### Ce que compte la licence du cabinet

Les **dossiers actifs hors SkanFact** : non archivés, avec au moins une écriture validée dans les
douze derniers mois, sans licence client. Un dossier archivé ne compte jamais : **jamais de données en
otage**, la règle de la 6.4.0 vaut pour le cabinet aussi. Une licence de cabinet expirée ou dépassée
bloque la **validation de nouvelles écritures** sur les dossiers hors quota — le cabinet choisit
lesquels restent actifs —, et rien d'autre : lire, exporter, imprimer, déclarer sur ce qui est validé,
toujours.

### Ce qui ne bouge pas

Un clic pour vendre, pas zéro (`PLAN-PLATEFORME.md`, § 12) : Skander marque « payé » dans la console,
la clé part. Le paiement en ligne (Konnect, Paymee, Flouci, ClicToPay — À VÉRIFIER) viendra brancher
le même bouton. Aucune donnée d'entreprise ni de cabinet ne remonte au serveur, jamais.

---

## 4. Ce que devient l'app entreprise

- **Elle s'arrête à la gestion.** On n'y ajoute plus d'écran de comptabilité. Ce qui a été construit
  en 8.8.0 → 9.0.0 (grand livre, balance, livre-journal avec OD, états financiers) reste dans le code
  — le **moteur** est indispensable : c'est lui qui écrit les écritures du paquet et la balance que le
  cabinet vérifie — mais les **écrans** sortent du chemin du chef d'entreprise : module
  « Comptabilité » **désactivé par défaut** et **payant** — l'option pour la petite entreprise sans
  comptable qui tient elle-même ses livres (décidé, § 1 point 8). L'option voyage dans la clé de
  licence comme l'offre (`options: ['compta']`), se vend depuis la console et le module Éditeur, et
  s'active en un clic dans Paramètres → Modules quand la clé la porte. Prix : **à toi** (proposition :
  190 DT HT/an, cochable sur l'une ou l'autre offre, jamais une troisième offre — trois prix se
  lisent, quatre non).
- **L'onglet Écritures reste visible** : c'est la seule façon pour le client de voir ce qui part
  chez son comptable, et de comprendre une question qu'il reçoit.
- **Le paquet gagne deux choses** : la **licence** du client (pour que le cabinet sache que le
  dossier est sur SkanFact) et la **signature** du paquet par le client (C1 du plan Cabinet : la
  réponse à « comment tu sais que ça vient de moi ? »). Et il apprend à **recevoir** : les questions
  du cabinet, affichées sur la pièce concernée, avec la réponse qui repart dans le mois révisé.
- **Tout le reste continue** : corrections, retours des utilisateurs, la lecture de photo le jour
  d'une application mobile, l'e-facture le jour où elle devient obligatoire.

---

## 5. Les aspects techniques à traiter (la liste complète)

*Chaque point est un chantier identifié. Aucun n'est commencé sauf mention. Ils sont rangés par
sujet, pas par ordre ; l'ordre est au § 7.*

**A. La licence du Cabinet**
- **L'identité du cabinet** est son **empreinte** (SHA-256 de sa clé publique X25519, 6.2.0) : elle
  existe déjà, elle est vérifiable, et elle figure déjà dans les demandes de licence des clients
  parrainés. La clé de cabinet devient donc **la clé qui porte la licence** — le sujet de la licence
  est l'empreinte, plus le nom du cabinet et son matricule pour l'affichage.
- **Le format de clé** est celui des licences client (`SKAN1.…`, format 2 avec `kid` et `sub`,
  `PLAN-PLATEFORME.md` § 5) avec un champ `type: 'cabinet'` et `dossiersHors: N` (le quota payé) ;
  `exp` comme aujourd'hui. Signée par `master` ou `srv-1`, vérifiée hors ligne avec les mêmes clés
  publiques — **`build/licences-publiques.json` et `src/licence.js` doivent entrer dans les `files`
  de `build/cabinet.config.js`** (ils n'y sont pas ; l'app cabinet n'a jamais vérifié une licence).
- **Le comptage** vit dans `cabcore` (pur, testé) : dossiers actifs hors SkanFact contre le quota,
  avec les 3 gratuits. Une fonction, une seule, qui sert au bandeau, à « À faire », au refus de
  validation et à la console.
- **Le garde-fou** est le jumeau de `licenceBlock` de l'app entreprise : une porte unique posée sur
  la **validation** d'écritures (jamais sur la lecture, l'export, l'impression, la clôture de ce qui
  est validé), et un test qui relit le renderer du cabinet et interdit toute autre pose.
- **L'écran** : Réglages → Licence dans le cabinet (coller la clé, l'état, ce qui est compté, la
  liste des dossiers hors SkanFact avec leur poids), le bandeau à trois tons (règle 8.0.1), « À
  faire » quand le quota approche, et la demande de licence par mail (`requestMail`, comme côté
  client).
- **L'émission** : la console (P 0.2) et le module Éditeur savent émettre une licence client ; il
  faut leur apprendre l'offre Cabinet — un client de type cabinet, un quota, un prix par palier, la
  facture correspondante. Renouvellement, montée de quota au prorata (`prorataOffre` existe),
  révocation : mêmes gestes, même cycle de vie que la 8.2.0.
- **La plateforme** : une table `cabinets` (empreinte, nom, matricule, contact), le lien
  cabinet ↔ clients (le champ `cabinet` de la licence client existe déjà), une vue « les dossiers de
  ce cabinet » dans la console, et l'activation d'un cabinet (§ 8.4.0 : ce qui remonte est
  l'empreinte, le poste, la version — jamais un nom de client).

**B. La preuve qu'un dossier est sur SkanFact**
- **Le manifeste du paquet porte la licence du client** (`manifest.licence`, la clé `SKAN1.…` telle
  quelle) : le cabinet la vérifie avec les clés publiques (signature, `exp`, matricule = celui du
  dossier). Rien de secret ne voyage : une clé de licence est déjà vérifiable par quiconque a la
  publique.
- **Un client en essai** n'a pas de clé : le manifeste porte `essai: { depuis, jusqua }`, non signé.
  Accepté tel quel — l'enjeu est de 30 jours. Le jour où le paquet est **signé par le client** (C1),
  cette mention l'est aussi.
- **Un paquet d'avant cette version** n'a ni l'un ni l'autre : le dossier compte comme hors SkanFact
  **et l'écran le dit** (« demande à ton client de mettre à jour SkanFact et de renvoyer le mois »),
  jamais en silence.
- **`PACK_FORMAT` monte** ; le Cabinet lit les deux formats (règle : un paquet plus ancien reste
  lisible pour toujours).

**C. Le moteur partagé**
- **Extraire de `core.js`** tout ce qui ne parle que d'écritures (`journalEntries` non — il lit les
  pièces ; mais `livreJournal`, `journalCentralisateur`, `grandLivre`, `balanceGenerale`,
  `balanceAuxiliaire`, `lettrage`, `etatsFinanciers`, `soldesOuverture`, `PLAN_COMPTABLE`,
  `accountLabel`, `odValide`, `numerosDuJournal`, les colonnes CSV) vers **`src/renderer/compta.js`**,
  pur, sans dépendance à `core.js`, que `core.js` réexporte pour que l'app entreprise et ses 384
  tests ne changent pas. Chargé par l'app cabinet (dans `files`, et un test qui relit son HTML,
  règle 7.29.0).
- **Le test de parité** : les douze paquets du jeu d'exemple importés dans le Cabinet doivent donner
  **la même balance au millime** que `core.balanceGenerale` sur les mêmes données. C'est le test
  qu'on relance à chaque version des deux applications.
- **Ce que le moteur ne sait pas faire et devra apprendre** (voir `PLAN-COMPTABLE.md`) : le
  brouillard et la validation, la contre-passation, l'extourne, les guides et abonnements, l'import
  de relevé et le rapprochement automatique, le lettrage manuel, la balance âgée, les provisions et
  régularisations, la clôture d'exercice définitive, l'amortissement dégressif, la liasse.

**D. Les données du Cabinet**
- **Un fichier par dossier** (`dossiers/<id>/livre.json`, chiffré avec la même clé, écriture
  atomique), au lieu de tout dans `cabinet-data.json` : soixante dossiers sur dix ans d'écritures ne
  tiennent pas dans un seul JSON relu à chaque enregistrement. C'est **la** décision de stockage à
  prendre avant la 9.2.0, parce qu'elle ne se reprend pas. `cabstore` (sauvegardes quotidiennes,
  nommées, copie externe, clé de secours, restauration) doit emporter ces fichiers — et le test
  `e2e:perte` le prouver.
- **La migration** de l'état actuel (portefeuille, paquets, relances) est sans perte : rien n'existe
  encore côté livre.
- **La piste d'audit** : chaque écriture validée, contre-passée, chaque clôture, chaque import porte
  qui (poste, collaborateur), quand, et depuis quelle source. C'est une obligation d'un logiciel de
  tenue, et c'est ce que le superviseur lit.

**E. Le multi-poste et les collaborateurs**
- **A10** : deux postes du cabinet sur le même dossier partagé s'écrasent en silence — la leçon de la
  3.2.0 (révision, fusion par identifiant, archive du perdant), jamais portée. Avec un fichier par
  dossier, la fusion se fait dossier par dossier, et une écriture validée ne se fusionne jamais : elle
  existe ou pas.
- **Collaborateurs et droits** (saisie / validation / supervision, par dossier) : sans serveur, un
  collaborateur est une identité locale (nom + clé) reconnue par le cabinet ; les droits vivent dans
  le fichier du cabinet. Suffisant pour un cabinet de cinq personnes ; le serveur, le jour venu,
  n'ajoutera que le transport.
- **Le verrouillage automatique** (C8) devient obligatoire : un poste de cabinet ouvert, ce sont
  soixante comptabilités ouvertes.

**F. Le pont dans les deux sens**
- **Les questions au client** : un fichier `.skanask` (chiffré pour le client ? Le client n'a pas
  de clé aujourd'hui — l'appairage est à sens unique. Deux options : le client génère une clé à
  l'appairage — **c'est cette voie qui est décidée**, les questions ne partent jamais en clair : une
  question porte un nom de client, un montant exact, un doute sur un compte, c'est du secret
  professionnel. La clé du client existe dès la 9.2.0, puisque c'est la même que celle de la
  signature du paquet. Voir `QUESTIONS.md` § 6.)
- **Côté entreprise** : recevoir le fichier, afficher chaque question **sur la pièce**, répondre,
  joindre ce qui manque, et renvoyer un mois révisé (`-r2` existe déjà côté cabinet).
- **La signature du paquet** (C1) et l'épinglage de la clé du client au dossier : c'est ce qui rend
  la licence du manifeste et la mention d'essai fiables. **Remontée en 9.2.0 le 15/09/2026** (elle
  était ici, avec la révision) : sans elle, quiconque tient le fichier d'appairage — que le cabinet
  donne à tous ses clients — peut fabriquer un paquet au nom d'une autre entreprise. Chiffrer dit
  « seul le cabinet peut lire » ; seule une signature dit « ça vient bien de lui ». Voir
  `QUESTIONS.md` § 6.

**G. Le fiscal et le légal**
- **Irréversibilité des écritures validées**, numérotation continue, conservation dix ans, et la
  capacité de **restituer** les livres d'un exercice tel qu'ils étaient (l'export complet d'un
  dossier, lisible sans SkanFact — même principe que « le paquet est un ZIP ordinaire »).
- **INPDP** : le cabinet est responsable du traitement de ses clients ; SkanFact Cabinet est un
  outil sur son poste, sans serveur. La plateforme, elle, détient les empreintes et contacts des
  cabinets : à déclarer avec le reste (`PLAN-PLATEFORME.md`, § 16). **À VÉRIFIER**.
- **L'Ordre des experts-comptables** : la gratuité conditionnelle est-elle une rémunération indirecte
  du cabinet ? Notre lecture : non, aucun argent ne circule vers le cabinet, et il paie moins un outil
  qu'il aurait payé de toute façon. **À VÉRIFIER avant de publier la page Tarifs.**
- **TTN / e-facture** : le jour où elle devient obligatoire, c'est l'app entreprise qui émet, et le
  cabinet qui vérifie. Pas avant.

**H. La distribution et le support**
- **Le téléchargement du Cabinet** (H1 : le seul bouton offert mène à un 404), la page Tarifs du site
  avec l'offre Cabinet, la fiche d'installation, l'invitation d'un client depuis le Cabinet (H2).
- **Le canal de mise à jour `cabinet`** existe et fonctionne ; le Cabinet devient un produit, donc
  chaque publication compte pour lui aussi (regrouper, une publication par lot — règle 6.7.2).
- **L'aide** du cabinet passe de huit articles à un vrai manuel de tenue ; chaque écran de
  comptabilité arrive avec ses bulles, comme dans l'app entreprise (un test le vérifie déjà).
- **La formation et la reprise** : un cabinet arrive avec soixante dossiers dans un autre logiciel.
  La reprise par balance d'ouverture (9.2.0) est le geste qui décide s'il vient ou pas.

**I. Les tests**
- Un e2e par version dans l'application réelle (le tableau de `PLAN-COMPTABLE.md`), le test de parité
  des balances, `e2e:boucle` étendu à la licence dans le manifeste et aux questions dans les deux
  sens, `e2e:perte` et `e2e:demenagement` rejoués avec un fichier par dossier, et un
  `e2e:cabinet-licence` jumeau de `e2e:licence` (quota atteint, validation refusée, lecture ouverte,
  dossier archivé qui ne compte plus).

**J. Le nommage et la version**
- Les deux applications gardent le **même numéro**. Le CHANGELOG dit « Cabinet » en tête d'une
  entrée qui ne concerne que lui. Le nom « SkanFact Cabinet » reste (À VÉRIFIER : si le produit se
  vend aux cabinets comme logiciel de tenue, un nom qui dit « comptabilité » vaut peut-être mieux —
  décision de Skander, pas technique).

**K. Ce que ça coûte en quota de publication**
- Rien de nouveau : même release, même workflow. Mais **chaque version du Cabinet est une publication
  des quatre installateurs** : on regroupe, on publie une fois par lot de versions.

**L. L'app entreprise : masquer, pas supprimer — et vendre l'option (décidé)**
- Supprimer les écrans de 8.8.0 → 9.0.0 aurait fait perdre : le moteur (indispensable au paquet), les
  tests qui le tiennent (une trentaine), les e2e (`e2e:livres`), et la possibilité pour un
  indépendant sans comptable de voir sa balance. Décision : **masquer et vendre**.
- **Le module** : une entrée `compta` dans `MODULES` (mécanisme de la 7.0.0), désactivée par défaut,
  qui porte Grand livre, Balance, États financiers et la saisie d'OD. **Écritures reste hors du
  module et libre** : c'est ce qui part au comptable. Un test exige « désactivé par défaut » et
  `e2e:entreprise` se relit (quand une règle change, le test se relit en premier).
- **L'option payante** : la clé de licence gagne `options` (comme elle porte `offre`), et
  `OFFRES`/`licenceState` (`src/licence.js`) rendent `options`. Une clé sans le champ n'a pas
  l'option. La console et le module Éditeur savent la vendre, la facturer et la renouveler avec la
  licence (une seule clé, une seule facture). L'essai de 30 jours **inclut** l'option : on ne vend
  pas ce qu'on n'a pas laissé essayer.
- **La porte** : une seule, `optionBlock('compta')`, posée sur l'entrée du module — la page
  s'affiche avec son cadenas et le chemin (« activer l'option »), jamais un écran blanc. Elle ne
  touche ni à Écritures, ni au paquet, ni à l'export CSV des écritures, ni à la clôture mensuelle :
  **jamais de données en otage**, et le comptable reçoit tout, option ou pas. Un test relit app.js
  et interdit toute autre pose.
- **Chez qui l'option est inutile** : une entreprise dont le cabinet est sur SkanFact Cabinet n'en
  a pas besoin (le cabinet tient les livres). L'écran le dit, plutôt que de vendre deux fois la même
  chose à deux personnes.

---

## 6. Ce que ça change dans chaque document

| Document | Ce qui devient faux | Ce qui le remplace |
|---|---|---|
| `PLAN-CABINET.md` | « Le cabinet ne paie jamais » ; le tableau « Les deux produits » (Cabinet = *lit, contrôle, relance, exporte*) ; « exporte vers son logiciel » ; le plan de versions 6.9.0 / 6.10.0 | § 1 à § 3 de ce document ; le plan de versions de `PLAN-COMPTABLE.md`, qui absorbe A10, B7, B10, C1, C8, E1, E2, F1, H1, H2, les collaborateurs |
| `PLAN-PLATEFORME.md` | Le modèle de données et l'API ne connaissent qu'un client entreprise ; la question ouverte n° 5 (postes par offre) | § 5.A et § 5.B : l'offre Cabinet, la table `cabinets`, la licence dans le manifeste ; postes illimités, on vend des dossiers |
| `PLAN-COMPTABLE.md` | Rien de faux ; il manquait la direction et le modèle économique | Ce document en tête ; les versions y restent |
| `ROADMAP.md` | La feuille de route de l'app entreprise continue comme si la comptabilité y avait sa place | § 4 : l'app entreprise s'arrête à la gestion |
| `CLAUDE.md` | « Le cabinet gratuit » (§ Plan Cabinet) ; les sections 8.8.0 → 9.0.0 décrivent des écrans devenus optionnels | Un paragraphe « Direction » qui renvoie ici ; les sections techniques restent vraies |
| `README.md` | « Une seconde application, gratuite … elle reçoit les paquets … exporte » | La description des deux produits du § 2 |
| Le site (`skanfact-site`, page Tarifs) | Pas d'offre Cabinet ; « cabinet gratuit » | § 3, une fois l'Ordre consulté |
| L'aide des deux applications | « Le cabinet exporte vers son logiciel » ; « ton comptable reçoit un fichier » | À réécrire version par version, avec les écrans |

Les corrections de `PLAN-CABINET.md`, `PLAN-PLATEFORME.md`, `PLAN-COMPTABLE.md`, `ROADMAP.md`,
`CLAUDE.md` et `README.md` sont faites le jour même (bandeau de direction en tête, phrases fausses
remplacées). Le site et l'aide suivent les versions.

---

## 7. L'ordre

| Étape | Quoi | Dépend de |
|---|---|---|
| 0 | Ce document ; les plans corrigés ; la décision « masquer ou supprimer » ; les questions au comptable et à l'Ordre posées | Skander |
| 0 bis | **Ce qui bloque la vente et n'est pas du développement** : le dépôt de la marque à l'INNORPI, les certificats de signature de code (requalifiés « avant la première vente », pas « le jour où ça vend » : un expert-comptable ne clique pas sur « Exécuter quand même »), la déclaration INPDP, les conditions de vente relues, le bouton de téléchargement du Cabinet qui mène à un 404, et la page unique qu'un prospect lira. Aucune ligne de code neuve ne rapporte un dinar tant que ces six choses ne sont pas faites (`QUESTIONS.md` § 9 et § 20) | Skander |
| 1 | **9.1.0** — d'abord l'outillage (`QUESTIONS.md` § 15) : le canal `cabinet-beta` (le Cabinet n'a pas de bêta aujourd'hui), le workflow « Construire un essai » (des applications d'essai installables à côté des vraies, sans mise à jour, sur des données à part), l'intégration continue Linux + Windows, le lint, le garde-fou d'erreur global, le journal borné, l'index thématique de `CLAUDE.md` ; puis les livres lus dans les paquets (livre-journal, grand livre, balance, lettrage) ; `compta.js` extrait ; test de parité ; côté entreprise, le module Comptabilité masqué par défaut et l'option `compta` dans la clé. Bêta chez le pilote, puis stable (`QUESTIONS.md` § 13 et § 14 pour la bêta et l'entretien) | rien |
| 1 bis | **9.1.1** — les quatre corrections fiscales de l'app entreprise, en une version minuscule : exonération de timbre sur la fiche client, TFP proposée par métier, seuil de retenue à la source réglable (par défaut 0, pas une valeur inventée), et le contrôle d'une heure sur l'e-facture (`QUESTIONS.md` § 11 et § 16) | une séance de validation avec le comptable, qui tranche les quatre en une fois |
| 2 | **9.2.0** — le livre propre à chaque dossier, un fichier par dossier, plan SCE complet, import du paquet EN écritures, reprise par balance d'ouverture, **et la signature du paquet par le client** (remontée de la 9.10.0) | le plan de comptes du comptable, son logiciel actuel ; le test de charge du format, qui passe AVANT |
| 3 | **9.3.0** — la saisie, brouillard/validation, guides, abonnements, piste d'audit | le regarder saisir |
| 3 bis | **9.4.10** — entretien, sans nouveauté (Electron, les 93 déclarations CSS en logiques, premier découpage d'`app.js`, dette) ; puis **9.6.1** et **9.9.1** aux mêmes conditions — la règle « une version sur quatre » est numérotée dans `QUESTIONS.md` § 16, pas promise | rien |
| 4 | **P 0.3 + 9.4.0** — la licence du Cabinet : clé, quota, comptage, garde-fou, écran, console, licence dans le manifeste, `e2e:cabinet-licence` | l'Ordre (avant de vendre, pas avant de construire) |
| 5 | **9.5.0** — banque, rapprochement, lettrage automatique, balance âgée | les formats de relevés |
| 6 | **9.6.0** — la déclaration mensuelle tunisienne | le modèle de déclaration |
| 7 | **9.7.0** — immobilisations dégressif, stocks | rien |
| 8 | **9.8.0** — inventaire, clôture d'exercice, états SCE, N/N-1 | la présentation NCT 01 |
| 9 | **9.9.0** — collaborateurs, multi-poste (A10), verrouillage | rien |
| 10 | **9.10.0** — révision, questions au client dans les deux sens | la méthode de révision |
| 11 | **10.0.0** — liasse, annuel, jeu d'exemple complet ; site et aide à jour | la liasse de l'année |

La licence du Cabinet arrive **après la saisie** parce que c'est la saisie qui crée le premier dossier
hors SkanFact, donc la première chose qu'on peut vendre. Avant, il n'y a rien à compter.

---

> Toutes les questions du projet, avec leur réponse et leur marque (Décidé / À toi / À VÉRIFIER),
> sont dans **`QUESTIONS.md`**. Celles qui restent ouvertes sont reprises ci-dessous.

## 8. Les questions ouvertes

**À Skander**
1. ~~Masquer ou supprimer~~ **Tranché le 15/09/2026 : masquer, et vendre l'option « Comptabilité »**
   (§ 1 point 8, § 5.L). Reste son **prix** (proposition 190 DT HT/an).
2. Le **nom** du produit cabinet reste « SkanFact Cabinet » ?
3. Les **prix** du § 3 (72 DT par dossier hors SkanFact, 3 gratuits, paliers) : à confronter aux prix
   du marché tunisien avant la page Tarifs.

**Au comptable pilote** (le détail par version est dans `PLAN-COMPTABLE.md`)
4. Quel logiciel il veut remplacer, et sur quels trois écrans il jugera que c'est fait.
5. Son plan de comptes, ses journaux, sa façon de saisir, ses relevés, sa déclaration, ses états, sa
   révision, la liasse — chacun au moment où la version qui en dépend commence.
6. Un vrai dossier pour piloter, dès la 9.1.0.

**À l'Ordre / au juriste (À VÉRIFIER)**
7. La gratuité conditionnelle du Cabinet est-elle une rémunération indirecte ?
8. Ce qu'exige la loi tunisienne d'un logiciel de tenue (irréversibilité, conservation, restitution).
9. L'INPDP pour la plateforme (empreintes et contacts des cabinets).
