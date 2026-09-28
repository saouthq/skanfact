# Le prototype de synchronisation

*Fait le 28/09/2026, à la demande de Skander (« vasy go »). Il tranche le choix du `04` § 9 : comment
un poste reçoit et tient à jour sa copie des données. **Jetable** : il ne devient pas du code de la
plateforme, il donne une réponse mesurée.*

## En deux phrases

**Notre chemin tient tous ses seuils (12 sur 12 sous Node, 6 sur 6 dans un vrai navigateur), et
PowerSync aussi (7 sur 7, à condition de lui donner un jeton court).** Les deux marchent ; on garde **notre chemin**, parce qu'il garde une
seule règle de droits, prend six fois moins de place sur le poste et n'ajoute aucun service à héberger.
PowerSync reste le plan B, et on lui prend une idée : prévenir le poste quand quelque chose change.

## Ce qu'on a mesuré, et comment

Les seuils sont ceux du `04` § 9.3, écrits **avant** de mesurer. Les mêmes données pour les deux
candidats, la même connexion freinée à **4 Mbit/s** (un relais qui ne laisse passer que 500 ko par
seconde, avec 40 ms de trajet : `outils/bride.ts`).

| Données (`base/donnees.sql`) | |
|---|---|
| Une PME | 1 500 clients, 600 articles, 8 000 pièces sur 13 mois (les 40 dernières en brouillon), 5 lignes chacune, 20 salariés × 13 bulletins de paie |
| Une entreprise voisine | La même chose en plus petit : elle ne doit **jamais** être lue |
| Un magasin | Une caisse qui encaisse 500 tickets hors ligne |
| Ce qui descend sur le poste de la PME | 50 360 lignes |

Même ordre de grandeur que les jeux de saturation de l'application actuelle (8 000 pièces, 1 500
clients). Machine : 4 cœurs, 17 Go, PostgreSQL 16.13, Node 22, Chromium 141.

## Les résultats

### Notre chemin (serveur + poste SQLite, `mesures/notre-chemin.ts`)

| Épreuve | Seuil | Mesure | |
|---|---|---|---|
| Première copie d'une PME sur 4 Mbit/s | < 60 s | **10,9 s** (3,8 Mo transférés) | tenu |
| Place prise sur le poste | < 200 Mo | **14,9 Mo** | tenu |
| Poste d'un commercial : lignes de paie reçues | 0 | **0** (le poste « paie » en reçoit 260) | tenu |
| Lignes d'une autre entreprise reçues | 0 | **0** | tenu |
| Encaisser un ticket hors ligne | < 200 ms | **4,2 ms** au pire (médiane 0,6 ms) | tenu |
| Rattrapage de 500 tickets sur 4 Mbit/s | < 60 s | **1,6 s**, chaîne des tickets intacte | tenu |
| Un même geste envoyé trois fois | compté une fois | **1 ticket** (réponses : accepté, déjà, déjà) | tenu |
| Une file écrite par la version précédente | acceptée | **acceptée** | tenu |
| Deux postes modifient le même brouillon | une version gardée, l'autre dans « À reprendre » | **les deux gardées**, aucune perdue | tenu |
| Une fiche modifiée sur deux postes, deux champs différents | les deux changements gardés | **gardés** | tenu |
| 8 postes écrivent pendant qu'un 9e lit | copie identique au serveur | **0 écart** | tenu |
| Appareil révoqué | effacé en < 1 min | **0,15 s**, son geste en quarantaine | tenu |

**12 sur 12.** Sans compression, la première copie prenait 37,3 s (16,8 Mo) : la compression est
maintenant dans le serveur (`SANS_COMPRESSION=1` pour la couper).

### Notre chemin, poste dans le navigateur (`mesures/navigateur.ts`)

Le poste réel sera une application web : SQLite en WebAssembly, stocké dans l'espace privé du
navigateur (OPFS), tenu par un « worker » pour que l'écran reste libre (`12` § 4).

| Épreuve | Seuil | Mesure | |
|---|---|---|---|
| Première copie d'une PME sur 4 Mbit/s | < 60 s | **12,3 s** (3,8 Mo) | tenu |
| Place prise dans le navigateur | < 200 Mo | **13,4 Mo** | tenu |
| La copie survit à la fermeture du navigateur | rien de perdu | **1 500 fiches sur 1 500**, rouverte en 98 ms | tenu |
| Encaisser un ticket hors ligne | < 200 ms | **7,9 ms** au pire (médiane 3,1 ms) | tenu |
| Rattrapage de 500 tickets sur 4 Mbit/s | < 60 s | **1,3 s**, chaîne intacte | tenu |
| Appareil révoqué | effacé en < 1 min | **0,14 s**, plus rien à la réouverture | tenu |

**6 sur 6** (Chromium 141, SQLite 3.53.4). Un point à surveiller : le navigateur **n'a pas accordé**
le stockage « persistant » à une page non installée. Sans lui, il peut effacer la copie s'il manque de
place, **y compris des gestes pas encore envoyés**. L'application installée et la coque de bureau
doivent le demander et le vérifier, et l'écran doit dire si ce n'est pas accordé (`04` § 11, point 2).

### PowerSync (auto-hébergé, `mesures/powersync.ts`)

PowerSync 1.26.1 (édition libre), client `@powersync/node` 1.1.0. Il lit la base par la réplication
de PostgreSQL et envoie à chaque poste ce que ses **règles** (`powersync/sync-config.yaml`) lui
attribuent. Ses écritures passent par **notre** file d'opérations (`04` § 9.1) : les épreuves
d'écriture (geste renvoyé, brouillon, version précédente) sont donc le même code que notre chemin, et
on ne les répète pas.

| Épreuve | Seuil | Jeton de 5 min | Jeton de 30 s |
|---|---|---|---|
| Première copie d'une PME sur 4 Mbit/s | < 60 s | 13,2 s (6,0 Mo) | 13,2 s |
| Place prise sur le poste | < 200 Mo | **89,9 Mo** | 89,9 Mo |
| Paie reçue par un commercial | 0 | 0 | 0 |
| Lignes d'une autre entreprise | 0 | 0 | 0 |
| Encaisser un ticket hors ligne | < 200 ms | 16,3 ms au pire | 17,1 ms |
| Rattrapage de 500 tickets | < 60 s | 1,7 s | 2,3 s |
| Appareil révoqué | < 1 min | **manqué : 267 s**, et il a reçu un client créé **après** la révocation | 0,2 s |
| | | **6 sur 7** | **7 sur 7** |

En plus : un changement fait au bureau arrive **tout seul** sur un poste connecté, en 90 à 190 ms.
Notre chemin, lui, attend que le poste demande.

Deux choses à savoir pour lire ce tableau honnêtement :
- Au premier passage, un ticket a pris **702 ms** : c'était l'ouverture de la base locale (≈ 700 ms),
  comptée par erreur dans le premier ticket. Notre chemin ouvre sa base avant le chronomètre ; le
  banc de PowerSync fait maintenant pareil, et note l'ouverture à part.
- La révocation dépend de la durée du jeton : PowerSync ne demande l'avis de notre serveur qu'au
  renouvellement. Un jeton court règle le problème, au prix d'un aller-retour toutes les 30 s par
  poste connecté.

### Les preuves

Règle du projet : un test se prouve en réintroduisant le défaut qu'il surveille. `mesures/preuves.sh`
pose huit défauts, un par un, dans une **copie** du prototype, et vérifie que l'épreuve qui les
surveille tombe :

- les 8 défauts du serveur et du poste (paie sans filtre de rôle, base sans filtre d'entreprise,
  geste compté deux fois, version précédente refusée, brouillon écrasé, fiche fusionnée en bloc,
  appareil révoqué qui continue, écritures simultanées sans ordre) : **8 sur 8 tombent** ;
- les 2 défauts du navigateur (ordre d'effacer ignoré, copie qui ne survit pas à la fermeture) :
  **2 sur 2 tombent**.

`SEULEMENT=navigateur npm run preuves` ne rejoue que ceux du navigateur.

## La décision

**On garde notre chemin de lecture.** PowerSync passe aussi les seuils, donc la décision ne se joue
pas sur la vitesse. Elle se joue sur ce que le `04` § 9.2 annonçait, et que le prototype a vu :

1. **Deux règles de droits au lieu d'une.** Pour lire la base, PowerSync a besoin d'un utilisateur
   qui **passe au-dessus** de la sécurité par ligne (`bypassrls`). Le filtre « ton entreprise, et la
   paie seulement si ton rôle y a droit » doit être réécrit dans ses règles, et le rôle traduit dans
   le jeton. C'est ce que la décision D2 du `03` interdit : deux copies d'une règle de sécurité
   finissent par diverger.
2. **Six fois plus de place sur le poste** (89,9 Mo contre 14,9 Mo) : PowerSync garde chaque ligne en
   texte JSON, plus son journal. Sur un téléphone ou un vieux poste de caisse, ça compte.
3. **Un service de plus à héberger en Tunisie**, avec sa propre base de stockage, ses mises à jour et
   ses pannes (vision R11 : une seule personne pour tout exploiter).
4. **La licence** (voir plus bas) permet notre usage, mais c'est une contrainte de plus à suivre.

Ce que PowerSync fait mieux, et qu'on reprend : **le poste est prévenu** quand quelque chose change.
Notre chemin ajoutera un petit canal (le serveur dit « il y a du neuf depuis la révision N », le poste
vient chercher), sans rien changer à la règle des droits. **PowerSync reste le plan B** si notre
chemin coûte plus cher que prévu à écrire.

## Ce que le prototype ne dit pas (À VÉRIFIER plus tard)

- **Safari et Firefox**, sur ordinateur et téléphone : seul Chromium a été mesuré. Le stockage
  persistant se revérifie sur chacun avant d'écrire le poste (`04` § 11, point 2).
- **Un vrai réseau tunisien** : la connexion freinée imite un débit et un délai, pas les coupures
  en plein transfert. La reprise d'une copie interrompue est prévue (le poste retient sa révision
  page par page) mais n'a pas été coupée exprès.
- **La charge d'un serveur partagé** par des centaines d'entreprises : ici, une machine, trois
  entreprises. Les écritures d'une même entreprise passent l'une après l'autre (c'est ce qui garantit
  que « tout ce qui a changé depuis N » ne saute jamais une ligne) : le débit par entreprise se
  mesurera avec `npm run charge` sur la plateforme.
- **Un geste refusé** par le serveur compte comme traité côté poste : l'écran devra le montrer
  (« À reprendre »), ce que le prototype ne dessine pas.

## La licence de PowerSync

Le service est sous **FSL-1.1-ALv2** (« Functional Source License ») : on peut l'utiliser, le copier
et le modifier pour tout usage **sauf** un « usage concurrent », c'est-à-dire revendre un service qui
fait la même chose que PowerSync. L'intégrer dans SkanFact pour nos propres clients est un usage
permis. Chaque version passe sous licence Apache 2.0 **deux ans** après sa sortie. Le client
(`@powersync/node`) est sous Apache 2.0. **À VÉRIFIER** par un juriste si le plan B devient le plan A.

## Relancer les mesures

Il faut PostgreSQL 16 sur `127.0.0.1:5433` avec `wal_level = logical` (pour PowerSync), Docker (pour
PowerSync) et Chromium (pour le navigateur). Chaque banc **efface et recrée** le schéma `proto`.

```bash
npm install
npm run notre-chemin        # 12 épreuves, ~2 min
npm run navigateur          # le poste dans Chromium, ~2 min
npm run powersync           # 7 épreuves, ~7 min (DUREE_JETON=30 pour un jeton de 30 s)
npm run preuves             # les 10 défauts réintroduits, ~16 min
```

Chaque banc écrit son bilan dans `resultats/` et sort en erreur si un seuil est manqué.

| Fichier | Rôle |
|---|---|
| `base/schema.sql`, `base/donnees.sql` | Le modèle réduit (entreprise, rôle, révision, sécurité par ligne) et les données |
| `serveur/serveur.ts` | Notre serveur : « ce qui a changé depuis N », la file d'opérations, la révocation |
| `poste/poste.ts` | Le poste sous Node (SQLite), sa file de gestes |
| `navigateur/` | Le même poste dans le navigateur (SQLite WebAssembly, OPFS, worker) |
| `powersync/` | La configuration de PowerSync et ses règles |
| `outils/bride.ts` | La connexion freinée à 4 Mbit/s |
| `mesures/` | Les bancs, et les preuves |
