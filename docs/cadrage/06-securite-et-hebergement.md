# 06 — La sécurité et l'hébergement

*Proposé le 28/09/2026, relu le même jour contre tout le dépôt. **Validé par Skander le 28/09/2026.** Suit `VISION-ARCHITECTURE.md` (§ 4.2, § 6, risques
R2, R8, R9, R11, § 11 points 11 et 12, § 12), `03-droits.md`, `04-hors-ligne-et-synchro.md` et
`05-obligations-legales.md` (§ 4.3 et 4.4). Source principale :
`docs/etudes/notes-de-recherche/marche-2026/hebergement_technique.md`. Complété le même jour, après
validation, pour suivre le `14` : les portes de plus vers l'extérieur et la lecture de documents
(§ 3), l'agent local au restaurant (§ 10). **Revalidé par délégation de Skander le 28/09/2026.***

## En bref (pour Skander)

Ce document dit **où vivront les données de nos clients**, comment on les protège, comment on les
retrouve si tout brûle, et ce qu'on fait le jour où quelque chose tombe.

Les idées qui comptent :
1. **Deux centres de données en Tunisie, chez deux opérateurs différents, dans deux villes.** Si
   l'un brûle, l'autre a une copie à jour à la minute (décision d'hébergement du 27/09).
2. **Il n'existe pas de base de données « gérée » en Tunisie** : on exploite nous-mêmes. Ça ne tient
   à une seule personne que si **tout est automatisé et surveillé**, et si **chaque procédure est
   écrite** (vision R11).
3. **Une sauvegarde qui n'a jamais été restaurée n'existe pas.** Chaque mois, on restaure pour de
   vrai, on mesure le temps, et la console garde le résultat (vision R8).
4. **Une copie des sauvegardes est intouchable**, même pour nous : c'est la parade contre les
   rançongiciels, qui ont augmenté de 140 % en Tunisie entre 2023 et 2024.
5. **Aucune donnée de client dans les journaux techniques.** On mesure la santé du service sans
   jamais lire le contenu des dossiers.
6. **Personne ne se connecte à la base « à la main »** en temps normal. Il existe un accès
   d'urgence, et chaque ouverture est tracée et prévient une seconde personne.
7. **Si Skander n'est pas joignable**, une enveloppe scellée et des procédures écrites permettent à
   une personne de confiance de garder le service en vie. C'est le « pli scellé » qui existe déjà
   pour les licences, étendu au serveur.

---

## 1. Les règles

**S1. Chaque couche suppose que la précédente a cédé.** Le droit est vérifié par la porte (`03` D2),
**et** par la base (sécurité par ligne), **et** les tests essaient de le contourner. Aucune protection
n'est seule.

**S2. Le moindre droit, partout.** Le programme se connecte à la base avec un rôle qui ne contourne
pas la sécurité par ligne (vision § 4.2 ; un test le vérifie). Chaque service n'a que les accès dont
il a besoin : la file d'envoi TTN n'a pas le droit d'effacer une facture.

**S3. Aucun secret dans le dépôt**, jamais (règle permanente du projet). Les secrets vivent dans un
coffre sur les serveurs, sont **changés régulièrement** et ne sont jamais écrits dans un journal.
Le dépôt est public (décision du 27/09) : le code du serveur doit être sûr **même lu par tous**.

**S4. Aucune donnée de client dans les journaux techniques.** Un journal dit « la requête de
l'entreprise n° X a pris 180 ms » : il ne dit ni le nom du client, ni un montant, ni une ligne de
facture. La mesure d'usage suit la même règle (vision § 11, point 14 ; console, vision § 12).

**S5. Tout s'automatise, tout s'écrit.** Une procédure qu'on fait à la main une fois par an est une
procédure qu'on rate. L'installation d'un serveur, une mise à jour, une bascule vers le site de
secours et une restauration sont des **scripts**, relus et essayés. Chaque incident suit une
**procédure écrite** (§ 9).

**S6. On mesure avant d'affirmer.** « Sauvegardé », « chiffré », « restaurable en 4 heures » ne
s'écrivent sur le site que si une mesure du mois le prouve. C'est la règle du projet : une phrase
rassurante se vérifie.

---

## 2. Où héberger

### 2.1 Ce qui est décidé

- **Tout en Tunisie**, copie de secours comprise (décision du 27/09/2026, vision § 9). Pas de
  transfert de données à l'étranger (`05` § 4.3).
- **On exploite nous-mêmes** : aucune source ne montre une base PostgreSQL gérée chez un hébergeur
  tunisien (vision R9, note de recherche). On loue des **serveurs** et on les tient.

### 2.2 Les candidats

D'après la note de recherche (Rapporté, sans prix publics : **un devis est nécessaire** pour chacun) :

| Hébergeur | Où | Ce qu'on sait |
|---|---|---|
| **EO Data Center** | Enfidha (Sousse) | Tier III, ISO 27001, labels **N-Cloud** et G-Cloud, neutre (tous les opérateurs arrivent sur le site), serveurs dédiés, sauvegarde et plan de continuité proposés |
| **Tunisie Telecom** (Data Center Carthage) | Tunis | ISO 27001, 27701 (vie privée) et 9001, offres cloud |
| **ATI** | Tunis (trois centres) | ISO 27001, cloud privé, gère le point d'échange internet national |
| **Orange Business** | Kalaa Kebira (Sousse) | Tier III, en partenariat avec EO Data Center |
| Hébergeurs commerciaux (NovaHoster, Oxahost…) | Tunis | Prix publics bas, qualité de production **non démontrée** |

### 2.3 La proposition

- **Site principal : EO Data Center** (Tier III, N-Cloud, neutre, plusieurs opérateurs réseau). C'est
  aussi la réponse la plus simple à la question de l'audit de cybersécurité (`05` § 4.4).
- **Site de secours : un autre opérateur, dans une autre ville.** Tunisie Telecom Carthage ou ATI,
  à Tunis. Pas Orange à Kalaa Kebira : c'est la même région que le site principal, et son partenaire.
- **Critères du devis**, écrits d'avance : serveurs dédiés (pas du mutualisé), disques chiffrables,
  deux liaisons réseau, possibilité d'un **stockage objet** (pour les fichiers et les sauvegardes),
  intervention sur place en moins de 4 heures, contrat qui interdit tout transfert hors de Tunisie,
  et **prix sur trois ans**.
- **À VÉRIFIER** (devis) : prix, disponibilité réelle, conditions de sortie (pouvoir partir avec nos
  données et nos disques sans délai).

---

## 3. Ce qui tourne en production

Le plus simple qui tienne (vision § 4.6 : un seul programme, pas de microservices). Le choix des
outils précis est fait dans le document 12.

```
        Clients (navigateur, application installée, bureau)
                          │  HTTPS
      ┌───────────────────┴────────────────────┐
      │         SITE PRINCIPAL (Enfidha)        │
      │  Entrée (TLS, limites de débit)          │
      │  Programme SkanFact × 2 (même code)      │   ← file de travaux dans le même programme
      │  PostgreSQL principal (une « cellule »)  │
      │  Stockage de fichiers (PDF, XML signés)  │
      └──────────────┬──────────────────────────┘
                     │  réplication continue (chiffrée)
      ┌──────────────┴──────────────────────────┐
      │      SITE DE SECOURS (Tunis, autre opérateur)
      │  PostgreSQL réplique (à la minute)       │
      │  Journaux de la base archivés            │
      │  Copie des fichiers                      │
      │  Copie intouchable des sauvegardes       │
      │  Programme SkanFact prêt à démarrer      │
      └─────────────────────────────────────────┘
```

- **Deux exemplaires du programme** sur le site principal : une mise à jour ou une panne d'un
  serveur ne coupe pas le service.
- **Une cellule** = un serveur PostgreSQL principal et sa réplique. Quand une cellule est pleine, on
  en ouvre une seconde (vision § 4.2). Au lancement, une seule.
- La **console** est un module du même programme, avec sa propre adresse et sa propre connexion
  (vision § 12). Elle ne s'ouvre qu'aux membres de l'équipe, sur un appareil reconnu, avec le code
  sur le téléphone (`03` § 6).
- Le **site** et la **page d'état** vivent **ailleurs** (le site est statique, vision § 12) : si le
  serveur tombe, la page d'état le dit quand même. Elle ne contient aucune donnée de client.
- Le **formulaire d'inscription** du site envoie **directement** au serveur en Tunisie : aucune donnée
  ne passe par l'hébergeur du site, qui est hors de Tunisie (`05` § 4.3).
- **Trois portes de plus vers l'extérieur** (ajouté le 28/09/2026, `14`) : l'**espace client** (des
  liens secrets, révocables, qui ne lisent que les pièces émises d'un tiers), l'**API publique**
  (clés, limites d'appels) et les **avis de paiement de Konnect** (jamais crus sur parole : le
  paiement est toujours relu chez Konnect). Toutes trois entrent dans l'audit externe (§ 10). En
  vague 1, deux de plus, ouvertes à tous : le **widget public de réservation** et la **page de
  commande** du restaurant (`15`), avec des limites de débit ; elles entrent dans l'audit de
  l'année.
- La **lecture de documents** (`14` § 2.3) lit des fichiers venus de l'extérieur : elle tourne **à
  part** du programme, sans accès à la base, et ne rend que du texte et des champs proposés.

---

## 4. Les sauvegardes et la restauration

### 4.1 Les objectifs, écrits d'avance

| Ce qui arrive | Données perdues au plus | Service rendu en |
|---|---|---|
| Un serveur du programme tombe | Rien | Moins d'1 minute (l'autre exemplaire répond) |
| Le serveur de base principal tombe | Moins d'1 minute | Moins d'1 heure |
| **Le site principal est perdu** (incendie, coupure longue) | Moins de 5 minutes | **Moins de 4 heures** (bascule sur le site de secours) |
| Une erreur efface ou abîme des données (défaut du logiciel, erreur humaine) | Rien : on revient à la minute d'avant | Moins de 4 heures, **pour la seule entreprise touchée** |
| Rançongiciel sur nos serveurs | Moins de 24 heures dans le pire cas (copie intouchable du jour) | Moins de 24 heures |

Ces chiffres **se mesurent chaque mois** (§ 4.3). Un chiffre qui n'est pas tenu change le plan, pas
le chiffre.

### 4.2 Ce qu'on garde, et où

- **La base, en continu** : chaque modification est archivée au fil de l'eau, ce qui permet de
  revenir **à n'importe quelle minute** des **35 derniers jours**. Une sauvegarde complète chaque
  nuit.
- **Plus loin dans le temps** : une sauvegarde par mois, gardée 12 mois ; une par an, gardée 10 ans.
  Une sauvegarde contient les données d'un client qui aurait demandé leur suppression : **À VÉRIFIER**
  avec le juriste, en même temps que la question du `05` § 3.8 (conservation contre effacement).
- **Les fichiers** (PDF, XML signés, accusés de la TTN, pièces jointes) : copiés sur le site de
  secours. Ceux qui ont une valeur légale sont dans un **stockage où rien ne peut être modifié ni
  effacé avant 10 ans** (vision § 5 ; `05` § 3.8).
- **La règle 3-2-1-1** : trois copies, sur deux supports, dont une sur l'autre site, et **une
  intouchable** (verrouillée en écriture pour une durée fixe, même pour nous). Un rançongiciel qui
  prend nos accès ne peut pas l'effacer.
- **Tout est chiffré**, et les clés ne sont **jamais stockées avec les sauvegardes** (§ 5).

### 4.3 L'exercice de restauration, chaque mois

Vision R8 : **un exercice réel, chaque mois**.
1. Un script restaure la sauvegarde de la veille sur un serveur **vide**, sans aide.
2. Il vérifie : la **chaîne d'empreintes** de chaque série (`01` R9), les **invariants** « deux
   chemins, un chiffre » sur un échantillon d'entreprises, le nombre de lignes par table.
3. Il **mesure** le temps de bout en bout.
4. Le résultat va dans la console (`00` § 3, « l'état du service »). S'il échoue, c'est une alerte
   sur le téléphone de Skander.

Deux fois par an, on joue **la perte du site principal** pour de vrai : bascule sur le site de
secours, puis retour.

### 4.4 Restaurer une seule entreprise

C'est le cas le plus fréquent : un client a tout effacé par erreur, ou un défaut a abîmé ses données.
On ne remet jamais **toute** la base en arrière, puisque les autres clients ont travaillé depuis. La
restauration se fait à côté, jusqu'à la minute voulue. On en **extrait l'entreprise touchée**, avec
l'outil d'export et de restauration d'**une** entreprise (vision § 4.2), puis on la remet en place.
Chaque étape est tracée dans sa piste d'audit (`03` § 5 : une correction écrite, jamais une main
dans la base).

---

## 5. Le chiffrement et les clés

| Quoi | Comment |
|---|---|
| Entre le client et nous | HTTPS partout (TLS 1.2 au moins, 1.3 de préférence), et le navigateur est obligé de l'utiliser |
| Entre nos deux sites | Liaison chiffrée |
| Les disques des serveurs | Chiffrés |
| Les sauvegardes | Chiffrées avant de partir, avec une clé qui ne voyage pas avec elles |
| Les mots de passe | Jamais gardés, seulement une empreinte lente à calculer (conçue pour résister aux essais en masse) |
| Les secrets de nos clients (jetons DigiGo, clés d'API, clé du compte Konnect de l'entreprise, réglages des intégrations : `14` § 2.2 et § 4) | Chiffrés dans la base, avec une clé qui vit hors de la base |
| La copie sur le poste | Chiffrée avec la clé de l'appareil (`04` § 2) |

**Les clés** vivent dans un **coffre** sur les serveurs, jamais dans le dépôt ni dans un fichier de
réglages (S3). La clé de la **signature par le serveur**, si elle est retenue un jour, vit dans un
**module matériel de sécurité** (vision § 5). Les clés publiques de l'application actuelle suivent
leurs règles (`CLAUDE.md` : jamais remplacées, jamais régénérées).

---

## 6. Qui peut toucher aux serveurs

| Qui | Ce qu'il peut faire |
|---|---|
| **Le programme** | Ce que ses rôles de base permettent, sous la sécurité par ligne (S2) |
| **La mise en production** | Seul chemin normal pour changer quelque chose : le code passe les tests, puis il est déployé par un script (§ 8) |
| **Skander, et plus tard une personne « technique »** (`03` § 5) | Se connecte aux **serveurs du programme et de la surveillance** par une clé personnelle **et** le code sur le téléphone, par une seule porte d'entrée qui enregistre tout. Les **serveurs de base de données** ne s'ouvrent que par l'accès d'urgence (ligne suivante) : qui a la main sur un serveur de base peut techniquement tout lire, et le rôle technique n'a droit à **aucune** donnée de client (`03` § 5) |
| **L'accès d'urgence à la base** | Existe, mais chaque ouverture est **tracée** et **prévient une seconde personne** (le père de Skander au lancement). Elle sert à réparer, jamais à lire un dossier par curiosité |
| **Le support** | Jamais les serveurs. Il lit un dossier seulement avec l'accord du client (`03` § 5) |

**Test et production sont séparés** (vision § 11, point 11) : quatre environnements en tout (poste de
développement, test, pré-production, production : `12` § 7), chacun avec ses propres secrets. **Jamais une donnée réelle de client en test** : on essaie sur l'exemple de cinq ans et sur
des données fabriquées.

---

## 7. La surveillance et les alertes

Ce qui est mesuré en permanence, et ce qui réveille :

| Mesure | Alerte si |
|---|---|
| Le service répond (de l'extérieur, depuis deux villes) | Pas de réponse pendant 2 minutes |
| Temps de réponse (budgets de la vision § 6) | 95 % des requêtes au-dessus du budget pendant 10 minutes |
| Taux d'erreurs | Au-dessus de 1 % pendant 5 minutes |
| Retard de la réplique du site de secours | Plus de 5 minutes |
| Sauvegarde de la nuit, archivage continu | Manquée ou en échec |
| Exercice de restauration du mois | En échec, ou plus lent que l'objectif |
| **Chaîne d'empreintes** (contrôle quotidien, `01` R9) | Une chaîne cassée : c'est toujours une alerte grave |
| File de travaux ; envois à la TTN, TEJ, CNSS en échec | Une file qui ne se vide pas ; plus de 3 % de refus en une heure |
| Place sur les disques | Plus de 75 % |
| Certificats (HTTPS, signature) | Moins de 30 jours avant l'expiration |
| Connexions : essais ratés en masse, pays inhabituels | Au-dessus d'un seuil réglé |

Les alertes arrivent **sur le téléphone** (`00` § 3), avec ce qu'il faut faire, écrit dans la
procédure (S5). Une alerte ne contient aucune donnée de client (S4). Le service qui vérifie de
l'extérieur que le site répond ne voit qu'une adresse publique de santé, rien d'autre ; il est
compté dans la liste des flux qui sortent (`05` § 4.3). La **page d'état** publique se met à jour pendant un incident.

---

## 8. Les mises à jour

- **Sans coupure** : les deux exemplaires du programme sont mis à jour l'un après l'autre.
- **Une modification de la base se fait en deux temps** : on ajoute d'abord ce qui est nouveau sans
  rien retirer, on met le programme à jour, puis on retire l'ancien plus tard. À chaque instant,
  l'ancienne et la nouvelle version du programme fonctionnent. Chaque modification est **essayée sur
  une copie de la production** avant (`02` § 7).
- **Retour arrière** en un geste si la nouvelle version se comporte mal. Les nouveautés s'allument
  par entreprise (`02` § 7, drapeaux).
- **Les postes hors ligne** : le serveur accepte les deux versions précédentes de l'application (`04`
  § 8).
- **Les correctifs de sécurité** du système et des bibliothèques : chaque mois, et dans les 48 heures
  pour une faille grave. Les dépendances sont suivies automatiquement (déjà en place sur le dépôt).

---

## 9. Quand quelque chose tombe

### 9.1 Un incident

Chaque type d'incident a sa **fiche** écrite (S5) : panne d'un serveur, perte du site, base abîmée,
TTN qui ne répond plus, fuite de données, rançongiciel, compte de l'équipe volé. Chaque fiche suit
le même ordre :
1. **Contenir** : couper ce qui fuit ou ce qui abîme ;
2. **Dire** : la page d'état, puis un message aux clients touchés, avec ce qu'on sait et ce qu'on ne
   sait pas encore ;
3. **Réparer** : restaurer, basculer, corriger ;
4. **Écrire** : ce qui s'est passé, pourquoi, et ce qui change pour que ça n'arrive plus. Publié aux
   clients touchés.

### 9.2 Une fuite de données

Si des données de clients ont pu être lues par quelqu'un qui n'en avait pas le droit : les clients
touchés sont **prévenus**, avec la liste de ce qui a pu être lu (la piste d'audit le permet). **À
VÉRIFIER** avec l'INPDP et un juriste : l'obligation et le délai de déclaration d'une violation de
données en droit tunisien.

### 9.3 Si Skander n'est pas joignable

Vision R11 : une seule personne pour tout faire. La parade :
- **toutes les procédures sont écrites** (S5), et un script fait le travail ;
- un **pli scellé** (il existe déjà pour les licences, 10.5.0) contient ce qu'il faut pour reprendre
  la main : les accès d'urgence, où sont les clés, qui appeler chez les hébergeurs. Il est confié au
  père de Skander, et **mis à jour à chaque changement** de clé ;
- avant le lancement, **une seconde personne** capable de suivre une fiche d'incident (vision § 11,
  point 13, le support).

---

## 10. La sécurité du code et des postes

- **Les dépendances** : versions verrouillées, suivies et mises à jour (§ 8). Une dépendance nouvelle
  se justifie.
- **Les tests de sécurité** vivent avec les autres (`03` § 9) : lire l'entreprise d'à côté, contourner
  un droit, rejouer un geste, envoyer un fichier piégé.
- **Un audit externe** (un test d'intrusion par des professionnels) **avant d'ouvrir au public**
  (vision § 11, point 12), puis chaque année. Si le décret-loi 2023-17 nous vise, cet audit annuel
  doit être fait par un **auditeur certifié par l'ANCS**, et son rapport lui est remis (`05` § 4.4).
- **Le dépôt est public** : un outil cherche les secrets à chaque envoi de code, et la construction
  s'arrête s'il en trouve un.
- **L'application de bureau est signée** (certificats Apple et Microsoft). L'application actuelle ne
  l'est pas encore, et le site le dit honnêtement. Pour la plateforme, c'est un **prérequis** : une
  coque qui parle à une clé USB de signature ne peut pas demander de « l'exécuter quand même ». Coût
  au budget (document 09).
- **L'agent local** (clé USB, imprimante, tiroir, douchette : vision § 4.1) n'écoute que sur le poste
  lui-même, n'accepte que l'application appairée, et ne fait que ce qu'il déclare : signer, imprimer,
  ouvrir le tiroir. Au restaurant (vague 1), il **envoie** aux imprimantes de cuisine du réseau local, sans
  rien écouter de ce réseau (`14` § 3.1).
- **Les fichiers reçus** (pièces jointes, relevés, factures TEIF de fournisseurs) sont vérifiés
  avant d'être lus : type réel, taille, et jamais exécutés.

---

## 11. Ce que devient l'application actuelle

| Application actuelle | Nouvelle plateforme |
|---|---|
| Fichier chiffré sur le poste, sauvegardes locales et copie externe, clé de secours (1.7.0, Cabinet 2.0.0) | Copie locale chiffrée (`04` § 2) ; les sauvegardes sont faites par le serveur, et l'**export complet** reste au client (`07`) |
| Console et licences chez Cloudflare (D1, hors de Tunisie) | La console devient un module du serveur en Tunisie ; la D1 ne sert plus qu'aux licences de la v10 tant qu'elle vit (vision § 12 ; `05` § 4.3, **À VÉRIFIER**) |
| Pli scellé des licences (10.5.0) | Étendu au serveur (§ 9.3) |
| Application non signée | Signée (§ 10) |

---

## 12. À VÉRIFIER

1. **Devis des hébergeurs** : EO Data Center, Tunisie Telecom, ATI. Prix sur trois ans, stockage
   objet, intervention sur place, conditions de sortie, clause « pas de transfert hors de Tunisie ».
2. **Audit ANCS obligatoire** (décret-loi 2023-17) : nous vise-t-il, dès quand, combien il coûte,
   quels auditeurs (`05` § 4.4).
3. **Déclaration d'une violation de données** : obligation et délai (INPDP, juriste).
4. **Certificats de signature de l'application** (Apple, Microsoft) : prix, et démarche au nom de
   quelle société.
5. **Latence** réelle entre les villes de nos clients et Enfidha : mesurée pendant le prototype du
   document 04.

## 13. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | Site principal EO Data Center (Tier III, N-Cloud) ; site de secours chez un autre opérateur, dans une autre ville ; choix final sur devis, critères écrits d'avance |
| 28/09/2026 (proposé) | Objectifs de sauvegarde : moins d'une minute perdue pour une panne, moins de 5 minutes et 4 heures pour la perte du site ; une entreprise se restaure seule, à la minute voulue |
| 28/09/2026 (proposé) | Règle 3-2-1-1 : une copie intouchable des sauvegardes ; archives légales non modifiables pendant 10 ans ; exercice de restauration mesuré chaque mois, bascule de site deux fois par an |
| 05/10/2026 (**Skander**) | **Serveur d'essai en France** (un VPS chez OVH, où sont déjà son compte et le domaine), **avec des données inventées seulement** : aucune vraie donnée de client n'y va jamais. Les pilotes et le lancement se font chez **EO Data Center** (§ 2.3), comme décidé. L'application vit à **app.skanfact.tn** (domaine chez OVH). Claude pilote le serveur par le dépôt GitHub (le serveur suit lui-même la version vérifiée) : aucun mot de passe ne lui est transmis ; la même méthode servira chez EO Data Center |
| 28/09/2026 (proposé) | Aucune donnée de client dans les journaux techniques ; aucun secret dans le dépôt, un outil le vérifie à chaque envoi |
| 28/09/2026 (proposé) | Accès aux serveurs par une seule porte avec clé personnelle et code sur le téléphone ; accès d'urgence tracé et signalé à une seconde personne ; test et production séparés, jamais de donnée réelle en test |
| 28/09/2026 (proposé) | Mises à jour sans coupure, base modifiée en deux temps, retour arrière en un geste ; correctifs de sécurité chaque mois, 48 heures pour une faille grave |
| 28/09/2026 (proposé) | Une fiche écrite par type d'incident ; pli scellé étendu au serveur ; une seconde personne formée avant le lancement |
| 28/09/2026 (relecture) | Les serveurs de base ne s'ouvrent que par l'accès d'urgence ; l'inscription du site va directement au serveur en Tunisie ; sauvegardes longues et droit à l'effacement à trancher avec le juriste |
| 28/09/2026 (proposé) | Application de bureau signée ; audit externe avant l'ouverture, puis chaque année |
| 28/09/2026 (par délégation, `14`, revalidé par délégation) | Trois portes de plus au lancement (espace client, API, avis de Konnect), deux en vague 1 (réservation, commande en ligne), toutes dans l'audit ; la lecture de documents tourne à part, sans accès à la base ; l'agent local envoie aux imprimantes de cuisine sans écouter le réseau |
