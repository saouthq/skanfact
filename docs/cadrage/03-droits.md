# 03 — Les droits : qui peut faire quoi

*Proposé le 28/09/2026, relu le même jour contre tout le dépôt. **Validé le 28/09/2026**, après la
relecture demandée par Skander. Suit `00-les-trois-parcours.md` (les rôles et le
code sur le téléphone, décidés le 28/09/2026), `01-modele-de-donnees.md` (§ 4 : `membre`, `mandat`,
`mandat_affectation`, `appareil` ; § 17 : `audit`) et `02-modules.md` (M1 : chaque module déclare ses
gestes). **Complété le même jour, après validation**, pour suivre `14-fonctions-et-integrations.md` :
la règle D11, le rôle Serveur, le § 2.3, les gestes du cabinet (§ 3.1 et 3.2), le § 4.1, le § 4.2 et
le § 8. Ces ajouts sont **à revalider**.*

## En bref (pour Skander)

Ce document dit, **geste par geste**, qui a le droit de faire quoi : dans une entreprise, dans un
cabinet, et dans la console. Il dit aussi comment on se connecte, et ce qui garde la trace de tout.

Les idées qui comptent :
1. **Le droit se vérifie sur le serveur**, et la base elle-même refuse de montrer une entreprise à
   qui n'y a pas accès. Un bouton caché à l'écran n'est jamais la seule protection.
2. **Une seule porte** décide de tout : les écrans, l'API et le poste hors ligne posent la même
   question à la même fonction. Un refus dit **ce qui est refusé, pourquoi, et qui peut le faire**.
   C'est déjà la règle du Cabinet actuel (`peut`, 9.9.0).
3. **Personne n'est enfermé dehors** : une entreprise a toujours un propriétaire, un cabinet
   toujours un associé.
4. **On élargit un droit en le décidant, jamais par défaut** : un invité reçoit le rôle le plus
   étroit qui convient.
5. **Le comptable ne fait jamais ce qui engage son client** : il n'émet pas de facture de vente, il
   n'encaisse pas, il ne touche pas à l'équipe du client.
6. **Chez SkanFact, personne n'écrit dans les données d'un client.** Le support lit, avec l'accord
   du client, pour un temps limité, et chaque page lue est tracée.
7. **Les gestes sensibles préviennent le propriétaire** : un RIB changé (le sien ou celui d'un
   fournisseur), un nouvel administrateur, un export complet, un accès donné au support. Le RIB de
   fournisseur modifié, c'est la fraude la plus courante contre les PME.

---

## 1. Les règles

**D1. Trois questions, dans cet ordre.** À chaque geste, la porte demande :
1. **Cette personne voit-elle cette entreprise ?** Membre de l'entreprise ou de son organisation,
   collaborateur d'un cabinet par un mandat actif, ou support avec un accord en cours. C'est la
   sécurité par ligne de la base (vision § 4.2, risque R2) : sans ce chemin, la ligne n'existe pas
   pour elle.
2. **Le geste est-il possible ici et maintenant ?** Le module est-il ouvert par l'offre (`02` § 1) ?
   L'abonnement est-il actif ou en lecture seule (`07`) ? Le mois est-il fermé ?
3. **Son rôle permet-il ce geste, sur cet objet ?** Le rôle, puis le périmètre : ses établissements
   (entreprise), ses dossiers (cabinet).

Le refus nomme **la première réponse qui manque**. « Ton abonnement est en lecture seule » et « ton
rôle ne permet pas d'émettre une facture » ne se règlent pas avec le même bouton.

**D2. Une seule porte.** `peut(personne, entreprise, geste, objet)` rend un objet, jamais un
booléen nu : `{ ok, motif, qui, bouton }`. `qui` : les personnes qui ont ce droit ; `bouton` : le geste
qui débloque, s'il existe. Les écrans, l'API et le poste hors ligne l'appellent ; aucun ne réécrit la
règle de son côté. Chaque route de l'API **déclare** son geste. Une route qui n'en déclare aucun ne
démarre pas, et un test le vérifie.

**D3. Ce qui n'est jamais à portée ne se montre pas ; ce qui est à portée se refuse en le disant.**
Le commercial n'a pas la Paie dans son menu : ce n'est pas son métier. L'assistant de saisie voit le
bouton « Valider », car il en voit l'effet tous les jours. S'il clique, le refus lui dit qui peut
valider. Cacher un bouton qu'on s'attend à trouver fait croire à une panne.

À ne pas confondre avec l'**offre** : un module fermé par l'abonnement se voit toujours, en lecture
(`02` § 1, « une offre ne masque jamais rien »). Seul le **rôle** peut retirer un module du menu
d'une personne.

**D4. Personne n'est enfermé dehors.**
- Une entreprise a **toujours un propriétaire**. On ne retire pas le dernier : on **transfère** la
  propriété, et le nouveau propriétaire doit accepter.
- Un cabinet a **toujours un associé**. On ne retire pas le dernier.
- **Seule exception : le dossier tenu.** Un cabinet peut créer le dossier d'un client qui n'est pas
  sur SkanFact (`01` § 20). Cette entreprise n'a **aucun membre** côté client. L'associé du cabinet
  en répond jusqu'à ce que le client la rejoigne. Le client en devient alors le propriétaire (§ 3.5).
- Un propriétaire qui a perdu son téléphone et son adresse e-mail (départ d'un associé, décès,
  conflit) passe par une **procédure de reprise** tenue par la console, sur pièces justificatives.
  **À VÉRIFIER** avec un juriste : quelles pièces (extrait du registre, procès-verbal, pièce
  d'identité du gérant) et quel délai.
- Leçon du Cabinet actuel (10.14.0) : un refus qui envoie chercher quelqu'un qui n'existe pas est
  un bug. La porte ne renvoie jamais vers une personne absente.

**D5. On élargit en le décidant.** Le créateur d'une entreprise en est le propriétaire, et le
créateur d'un cabinet en est l'associé. Tout invité reçoit le rôle **proposé le plus étroit** : on
choisit de lui en donner plus, jamais l'inverse (10.14.0 : le premier collaborateur devient
superviseur, les suivants reçoivent la saisie).

**D6. Personne ne se donne un droit à soi-même, ni un droit qu'il n'a pas.** Un administrateur
invite jusqu'au rôle d'administrateur, jamais un propriétaire. Il ne change ni son propre rôle ni
celui du propriétaire.

**D7. Plusieurs rôles possibles pour une même personne.** Dans une petite boutique, la même
personne vend, encaisse et reçoit la marchandise. Ses droits sont **l'union** de ses rôles, et la
limite d'établissements s'applique à tous.

**D8. Les droits suivent le poste hors ligne, mais le serveur a le dernier mot.** Le poste garde les
droits de sa dernière synchronisation, pour une durée bornée (vision § 4.5 : « quelques jours au
plus » ; le `04` § 7 fixe 7 jours pour une caisse et 72 heures pour un autre poste). Chaque geste est **revérifié à son arrivée** sur
le serveur. Si le droit a été retiré entre-temps, le geste est refusé, et le poste le montre dans
« À reprendre ». Il n'est jamais perdu en silence. **Exception : un fait** (un ticket encaissé, de
l'argent reçu) n'est jamais refusé. Il attend la décision du propriétaire (`04` § 5.1). Un membre retiré voit les données de cette
entreprise **effacées de ses postes** à leur reconnexion.

**D9. Personne n'agit au nom d'un autre.** Il n'existe aucun bouton « se connecter en tant que ».
Pas pour le support, pas pour un administrateur. Chaque geste porte le nom de celui qui l'a fait, et
c'est ce qui rend la piste d'audit crédible.

**D10. Les données sensibles sont gardées plus serré** : la paie (salaires, CIN, RIB des salariés),
les RIB (société et fournisseurs), l'export complet, l'équipe, le mandat du cabinet, l'accès du
support. Ceux qui y touchent ont le code sur le téléphone (décision du 28/09/2026), les **lectures**
de la paie sont tracées (pas seulement les modifications), et les changements préviennent le
propriétaire (§ 7).

**D11. Au-delà d'un seuil, un geste demande l'accord d'un responsable.** C'est la règle de la
caisse (le « code d'un responsable », § 2.1), étendue à tout ce qui engage l'argent : une remise, une
vente au-delà de l'encours d'un client, une commande fournisseur, un retour. Le propriétaire ou
l'administrateur règle les seuils. **Par défaut, il n'y a pas de seuil**, sauf à la caisse où la
remise permise vaut 0 % : la valeur par défaut est celle qui ne change rien à ce que la personne
pouvait déjà faire. L'accord se donne sur place (le code à 4 chiffres, sur le même poste) ou à
distance (une notification, accepter ou refuser) ; il laisse sa trace (`01` § 24.5, `demande_accord`),
et la pièce porte les deux noms.

---

## 2. Les rôles dans une entreprise

Les huit rôles décidés le 28/09/2026 (`00`), et un neuvième, **Serveur**, ajouté le même jour pour
la restauration (`14` § 3.1 ; ses gestes : § 2.3), qui sert **à partir de la vague 1**. Les mots du parcours du `00` (vendeur, caisse,
comptabilité interne, gérant) désignent les mêmes rôles : vendeur = Commercial, gérant =
Administrateur.

| Rôle | En une phrase | Code sur le téléphone |
|---|---|---|
| **Propriétaire** (P) | Tout, dont l'abonnement, le comptable et la propriété. Un seul, transférable | Obligatoire |
| **Administrateur** (A) | Tout, sauf l'abonnement, le choix du comptable et la propriété | Obligatoire |
| **Commercial** (C) | Vendre : devis, factures, clients, relances | Proposé |
| **Caissier** (K) | La caisse de son établissement | Proposé ; code à 4 chiffres pour changer de caissier |
| **Serveur** (S) | La salle : prendre les commandes, les envoyer en cuisine ; il n'encaisse pas, sauf si on le lui permet (§ 2.3) | Proposé ; code à 4 chiffres, comme le caissier |
| **Magasinier** (M) | Le stock : réceptions, livraisons, transferts, inventaires | Proposé |
| **Comptabilité interne** (I) | Achats, banque, déclarations, écritures. Pas la paie | Proposé |
| **Paie** (Pa) | Salariés, bulletins, déclarations sociales | Obligatoire |
| **Lecture** (L) | Tout voir, rien changer (un associé, un banquier), sauf le détail de la paie | Proposé |

**Chaque rôle peut être limité à un ou plusieurs établissements** (`01` § 4, `membre`). Il voit alors
les pièces, la caisse et le stock **de ses établissements**, et des totaux calculés **sur eux
seuls**. Les fiches communes (clients, fournisseurs, articles) restent visibles de tous, puisqu'elles
servent à tous les établissements.

### 2.1 Les gestes, module par module

Légende : **✓** le geste est permis ; **voir** : lecture seule ; **—** : ni geste ni lecture (le
module ne paraît pas) ; *en italique*, une condition.

**Le socle : l'entreprise et son équipe**

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Voir l'accueil et « À faire » | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Modifier la fiche société (nom, adresse, logo, cachet) | ✓ | ✓ | — | — | — | voir | — | voir |
| Modifier le **RIB de la société** | ✓ | ✓ *prévient P* | — | — | — | — | — | — |
| Régime fiscal, début d'exercice, séries de numérotation | ✓ | ✓ | — | — | — | voir | — | voir |
| Champs personnalisés, modules affichés au menu | ✓ | ✓ | — | — | — | — | — | — |
| Inviter, retirer un membre, changer un rôle | ✓ | ✓ *jusqu'à A* | — | — | — | — | — | — |
| Transférer la propriété | ✓ | — | — | — | — | — | — | — |
| Changer d'offre, acheter un module | ✓ | voir | — | — | — | — | — | — |
| Payer une échéance de l'abonnement | ✓ | ✓ | — | — | — | — | — | — |
| Choisir le cabinet, fixer son périmètre, arrêter le mandat | ✓ | — | — | — | — | — | — | — |
| Accorder un accès au support | ✓ | ✓ *prévient P* | — | — | — | — | — | — |
| **Export complet** de l'entreprise (jamais bloqué par l'abonnement, même en lecture seule : `07`) | ✓ | ✓ *prévient P* | — | — | — | — | — | — |
| Exporter une liste (CSV) qu'on voit | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Lire la piste d'audit de toute l'entreprise | ✓ | ✓ | — | — | — | — | — | — |
| Lire sa propre activité | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Supprimer un **brouillon** (jamais une pièce émise, `01` R6) | ✓ | ✓ | *les siens* | — | *les siens* | *les siens* | *les siens* | — |
| Répondre à une question du cabinet (toute personne qui voit la pièce visée, sauf Lecture) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Résilier l'abonnement | ✓ | — | — | — | — | — | — | — |

**Ventes**

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Voir devis, commandes, factures, avoirs | ✓ | ✓ | ✓ | — | *bons de livraison* | voir | — | voir |
| Créer, modifier un brouillon (devis, proforma, commande) | ✓ | ✓ | ✓ | — | — | — | — | — |
| Préparer un bon de livraison | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| **Émettre** une facture (numéro, signature, TTN) | ✓ | ✓ | ✓ *voir § 2.2* | — | — | — | — | — |
| Émettre un **avoir** | ✓ | ✓ | *prépare* | — | — | — | — | — |
| Encaisser un règlement | ✓ | ✓ | ✓ | — | — | ✓ | — | — |
| Marquer un chèque ou une traite **impayé** | ✓ | ✓ | — | — | — | ✓ | — | — |
| Relancer | ✓ | ✓ | ✓ | — | — | ✓ | — | — |
| Créer, modifier un client | ✓ | ✓ | ✓ | — | — | *compte auxiliaire* | — | voir |
| Modifier les **prix** du catalogue | ✓ | ✓ | voir | voir | voir | voir | — | voir |
| Créer, modifier un article (hors prix) | ✓ | ✓ | — | — | ✓ | — | — | voir |

**Achats**

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Voir les achats et les fournisseurs | ✓ | ✓ | — | — | — | ✓ | — | voir |
| Enregistrer un achat, une dépense, un avoir fournisseur | ✓ | ✓ | — | — | — | ✓ | — | — |
| Régler un fournisseur, retenue et certificat TEJ | ✓ | ✓ | — | — | — | ✓ | — | — |
| Créer, modifier un fournisseur | ✓ | ✓ | — | — | — | ✓ | — | — |
| Modifier le **RIB d'un fournisseur** | ✓ | ✓ *prévient P* | — | — | — | ✓ *prévient P* | — | — |

**Trésorerie**

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Voir les comptes et les soldes | ✓ | ✓ | — | — | — | ✓ | — | voir |
| Mouvements, virements entre comptes, relevés, rapprochement | ✓ | ✓ | — | — | — | ✓ | — | — |
| Créer un compte bancaire | ✓ | ✓ | — | — | — | — | — | — |

**Déclarations**

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Voir la déclaration du mois et le calendrier | ✓ | ✓ | — | — | — | ✓ | *sociales* | voir |
| **Valider le mois** (`02` § 2 : un geste du socle) | ✓ | ✓ | — | — | — | ✓ | — | — |
| Saisir les salaires du mois en total (`02` M4) | ✓ | ✓ | — | — | — | ✓ | ✓ | — |
| Marquer une déclaration déposée | ✓ | ✓ | — | — | — | ✓ | *sociales* | — |

**Quand un cabinet a un mandat de comptabilité, c'est lui qui valide le mois** (`01` § 14) :
l'entreprise voit l'état et peut **demander** la validation, mais le bouton est au cabinet. Sans
mandat, la validation est à l'entreprise.

**Pilotage**

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Tableau de bord, statistiques, marges | ✓ | ✓ | *ses ventes* | — | — | ✓ | — | voir |

**Stock**

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Voir les quantités disponibles | ✓ | ✓ | voir | voir | ✓ | voir | — | voir |
| Mouvements (dont les **réceptions** de marchandise), transferts, lots et numéros de série | ✓ | ✓ | — | — | ✓ | — | — | — |
| **Recettes et kits** : créer, modifier une nomenclature (ce qu'un article composé sort du stock) | ✓ | ✓ | — | — | ✓ | — | — | — |
| Compter un inventaire | ✓ | ✓ | — | — | ✓ | — | — | — |
| **Valider** un inventaire (l'écart devient une écriture) | ✓ | ✓ | — | — | — | ✓ | — | — |

Celui qui compte n'est pas celui qui valide l'écart. C'est la règle la plus simple contre un stock
qui « disparaît ».

**Caisse**

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Ouvrir sa session, encaisser, imprimer le ticket | ✓ | ✓ | — | ✓ | — | — | — | — |
| Fermer sa session (Z), déclarer le fond de caisse | ✓ | ✓ | — | ✓ | — | — | — | — |
| **Retour, remboursement**, remise au-delà du plafond, tiroir ouvert sans vente | ✓ | ✓ | — | *code d'un responsable* | — | — | — | — |
| Voir les sessions de tous les caissiers, les écarts | ✓ | ✓ | — | *la sienne* | — | ✓ | — | voir |

*Code d'un responsable* : le caissier fait le geste, et un propriétaire ou un administrateur présent
tape **son** code à 4 chiffres sur le même poste. Le ticket porte les deux noms. Un ticket encaissé
ne s'annule jamais : un retour est un ticket de plus, en négatif (`01` R6). Le **plafond de remise**
se règle par entreprise ; par défaut il vaut 0 %, donc toute remise demande un responsable (la
valeur par défaut qui ne fait rien).

**Paie**

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Voir la fiche d'un salarié (CIN, RIB, salaire) | ✓ | ✓ | — | — | — | — | ✓ | — |
| Établir, remettre un bulletin ; congés, avances | ✓ | ✓ | — | — | — | — | ✓ | — |
| Déclarations sociales (CNSS, employeur) | ✓ | ✓ | — | — | — | — | ✓ | — |
| Voir la **masse salariale** (un total, sans nom) | ✓ | ✓ | — | — | — | ✓ | ✓ | voir |

**Chaque lecture** d'une fiche de salarié ou d'un bulletin est tracée, pas seulement les
modifications (D10).

Les **écritures de paie** passent **en totaux du mois**, sans nom de salarié, sauf les avances et
les oppositions. Il faut les suivre une par une (compte 425, lettrage). Ainsi, la comptabilité
interne tient les livres sans lire les salaires. **À VÉRIFIER** avec un comptable : que ce découpage
convient aux cabinets et à un contrôle.

**Comptabilité complète** (entreprise sans cabinet, ou en plus du cabinet)

| Geste | P | A | C | K | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|
| Livres, balance, états financiers | ✓ | ✓ | — | — | — | ✓ | — | voir |
| Saisir une OD, lettrer, immobilisations | ✓ | ✓ | — | — | — | ✓ | — | — |
| Clôturer l'exercice ; le rouvrir (avec un motif) | ✓ | ✓ | — | — | — | — | — | — |

Avec un mandat de comptabilité, la clôture de l'exercice est au cabinet (§ 3).

### 2.2 Émettre une facture quand on n'a pas le certificat

La signature électronique appartient à **une personne** : le code DigiGo arrive sur **son**
téléphone (vision § 5). Un commercial sans certificat peut donc **tout préparer**. Au moment
d'émettre, deux cas :
- il a lui-même un certificat au nom de l'entreprise : il signe, et c'est fini ;
- sinon, la facture reçoit son numéro et passe **« à signer »**. Le porteur du certificat est
  prévenu, et il signe en un geste, une par une ou toutes celles du jour. Le numéro, lui, est déjà
  pris : l'ordre des factures est celui de leur émission, pas celui de leur signature.

**À VÉRIFIER** auprès de TunTrust et de la TTN :
- une facture numérotée peut-elle attendre sa signature (et combien de temps) ;
- existe-t-il un **cachet électronique d'entreprise** que plusieurs personnes utiliseraient ?

S'il existe, c'est le chemin le plus simple pour une équipe.

### 2.3 Les gestes ajoutés par le document 14 (28/09/2026)

Les gestes de **la salle** viennent en vague 1, avec la restauration (`15`). Le **Serveur** (S) n'a que les gestes de la salle ci-dessous ; partout ailleurs, il n'a rien. Le
propriétaire peut lui cocher « peut encaisser » : il a alors aussi les gestes du Caissier.

| Geste | P | A | C | K | S | M | I | Pa | L |
|---|---|---|---|---|---|---|---|---|---|
| **Ventes** : donner ou retirer l'accès d'un client à son espace (`14` § 2.1) | ✓ | ✓ | ✓ | — | — | — | ✓ | — | — |
| Brancher le compte de paiement en ligne de l'entreprise (Konnect) | ✓ | ✓ *prévient P* | — | — | — | — | — | — | — |
| Vendre au-delà de l'encours autorisé d'un client | ✓ | ✓ | *accord (D11)* | *accord (D11)* | — | — | — | — | — |
| **Achats** : demande de prix, commande fournisseur | ✓ | ✓ | — | — | — | *prépare* | ✓ | — | — |
| Valider une réception | ✓ | ✓ | — | — | — | ✓ | ✓ | — | — |
| Lire une facture en photo ou en PDF, puis la confirmer | ✓ | ✓ | — | — | — | — | ✓ | — | — |
| **La salle** : voir le plan de salle | ✓ | ✓ | — | ✓ | ✓ | — | — | — | voir |
| Prendre une commande, l'envoyer en cuisine, transférer ou regrouper des tables | ✓ | ✓ | — | ✓ | ✓ | — | — | — | — |
| Annuler une ligne **déjà partie en cuisine** | ✓ | ✓ | — | *code d'un responsable* | *code d'un responsable* | — | — | — | — |
| Partager l'addition, encaisser | ✓ | ✓ | — | ✓ | *si « peut encaisser »* | — | — | — | — |
| Plan de salle, zones de préparation, suppléments et formules | ✓ | ✓ | — | — | — | — | — | — | — |
| **Seuils d'accord** (D11) : les régler | ✓ | ✓ | — | — | — | — | — | — | — |
| **API** : créer, révoquer une clé ; choisir les adresses des avis (§ 8) | ✓ | ✓ *prévient P* | — | — | — | — | — | — | — |
| **Intégrations** (vague 1 et suivantes) : en allumer, en éteindre une, voir ce qui part | ✓ | ✓ *prévient P* | — | — | — | — | — | — | — |

Les gestes des modules des vagues (Réservations, Production, Projets, suivi commercial, notes de
frais) s'écriront **avec leur module** (`02` M1), avant sa vague, dans ce même tableau.

---

## 3. Les rôles dans un cabinet

Les quatre rôles décidés le 28/09/2026 (`00`). Les trois premiers sont ceux du Cabinet actuel
(9.9.0), renommés. Dans `mandat_affectation` (`01` § 4), le rôle sur un dossier s'écrit `saisie`,
`revision`, `supervision` ou `paie`.

| Rôle (nom dans `01`) | Ce qu'il fait | Quels dossiers |
|---|---|---|
| **Associé** (`supervision`) | Tout, plus l'équipe, les affectations, l'abonnement du cabinet, la clôture d'exercice | **Tous** |
| **Collaborateur** (`revision`) | Saisie, correction d'imputation, validation, lettrage, déclarations | Ceux qui lui sont **confiés** |
| **Assistant de saisie** (`saisie`) | Saisit au brouillard, importe, rapproche ; ne valide pas | Ceux qui lui sont confiés |
| **Paie** (`paie`) | Salariés, bulletins, déclarations sociales du dossier | Ceux qui lui sont confiés |

Comme aujourd'hui, **un rôle posé sur un dossier l'emporte sur le rôle général** (`roleSurDossier`) :
un collaborateur qui valide partout peut n'être qu'assistant sur le dossier d'un proche. Un cabinet
d'une seule personne n'a rien à régler : il est associé.

### 3.1 Les gestes sur un dossier

| Geste | Associé | Collaborateur | Assistant | Paie |
|---|---|---|---|---|
| Voir les pièces, les livres, les déclarations du dossier | ✓ | ✓ | ✓ | *paie et salariés* |
| Saisir au brouillard, importer un relevé, rapprocher | ✓ | ✓ | ✓ | — |
| Enregistrer une **pièce d'achat** du client (*si le mandat le permet*) | ✓ | ✓ | ✓ | — |
| **Corriger une imputation** (compte, axe) avant validation | ✓ | ✓ | — | — |
| **Valider** les écritures, lettrer | ✓ | ✓ | — | — |
| Poser une question au client, lire ses réponses | ✓ | ✓ | ✓ | ✓ |
| Préparer une déclaration, la marquer déposée | ✓ | ✓ | — | *sociales* |
| Valider le mois | ✓ | ✓ | — | — |
| Bulletins, déclarations sociales | ✓ | — | — | ✓ |
| Clôturer l'exercice, états financiers, liasse ; **rouvrir** (avec un motif) | ✓ | — | — | — |
| Exporter la comptabilité (FEC, balance, grand livre) | ✓ | ✓ | — | — |
| **Dépôts groupés** : préparer la déclaration ou le fichier TEJ de plusieurs dossiers en un geste (`14` § 2.4) | ✓ | *ses dossiers* | — | — |

### 3.2 Les gestes du cabinet lui-même

| Geste | Associé | Les autres |
|---|---|---|
| Inviter, retirer un membre de l'équipe ; changer un rôle | ✓ | — |
| Confier un dossier, poser un rôle par dossier | ✓ | — |
| Accepter un mandat, créer un dossier tenu, inviter un client à rejoindre son dossier | ✓ | — |
| Abonnement du cabinet, code cabinet | ✓ | — |
| **Lettres de mission et honoraires** : les écrire, les faire signer, facturer (`14` § 2.4) | ✓ | — |
| Voir le portefeuille | Tous les dossiers | Ses dossiers confiés |

### 3.3 Ce que le cabinet ne fait jamais chez son client

La règle de l'application actuelle (« le cabinet n'écrit jamais chez un client sans son accord »),
rendue précise :
- **Il n'émet ni facture de vente ni avoir**, il n'encaisse pas, il ne touche pas à la caisse.
  Une vente engage le client devant la TTN ; c'est son geste.
- **Il ne modifie jamais une pièce émise**, ni un montant, ni une TVA (`01` § 14 : il corrige un
  compte ou un axe, pas davantage).
- Il ne voit ni ne touche **l'équipe**, l'abonnement ou les réglages du client.
- Il ne fait pas l'**export complet** de l'entreprise : c'est le droit du client. Il exporte la
  comptabilité, ce qui est son travail.

### 3.4 Le mandat et son périmètre

Le client choisit, en acceptant le mandat, **ce que le cabinet peut faire** (champ `périmètre` du
`mandat`, `01` § 4) :

| Périmètre | Par défaut | Ce qu'il ouvre |
|---|---|---|
| Comptabilité | Coché | Livres, correction d'imputation, validation, clôtures, états |
| Déclarations | Coché | Préparer, marquer déposée |
| Saisie des achats | Coché | Enregistrer les pièces d'achat et les relevés du client |
| **Paie** | **Décoché** | Salariés, bulletins, déclarations sociales |

La paie est **décochée par défaut** : elle montre les salaires de chacun, et on l'ouvre en le
décidant (D5). Seul le **propriétaire** accorde ou change le mandat (décision du 28/09/2026, `00`).
Chaque changement est tracé et prévient les deux côtés.

### 3.5 Le dossier tenu (client pas encore sur SkanFact)

- Le cabinet le crée, et il y a **tous les gestes du § 3.1**. Le périmètre est complet ; il n'y a
  personne côté client pour l'accepter.
- Les ventes de ce client sont émises **ailleurs** (sur papier ou dans un autre logiciel). Le cabinet
  les **enregistre** : il saisit les écritures ou importe les pièces. Il ne les **émet** jamais au
  nom du client. Il n'y a ni numéro SkanFact, ni signature, ni envoi à la TTN (§ 3.3 : la vente reste
  le geste du client).
- Quand le client **rejoint** son dossier (`00` § 2), il en devient le **propriétaire**. Il voit le
  périmètre du mandat et peut le changer (§ 3.4) ; la paie reste ouverte si le cabinet la faisait
  déjà, et le client peut la décocher.
- Si le mandat s'arrête **avant** que le client ait rejoint le dossier, le dossier n'est pas effacé.
  Il reste en lecture pour l'associé, et le client peut le réclamer par la procédure de reprise (D4).
  **À VÉRIFIER** avec l'Ordre : à qui appartient le travail d'un dossier tenu quand le client ne l'a
  jamais rejoint.

---

## 4. Les groupes et les personnes qui ont plusieurs casquettes

- **Un rôle se donne par entreprise.** Une personne peut être propriétaire d'une société,
  commerciale dans une autre, et collaboratrice d'un cabinet. Elle passe de l'une à l'autre en haut
  de l'écran (`00`), et ses droits changent avec.
- **Un rôle donné au niveau de l'organisation** (un groupe) vaut dans **toutes** ses sociétés,
  celles d'aujourd'hui et celles de demain (`01` § 4 : `membre` sur l'organisation). C'est le cas du
  directeur financier d'un groupe.
- **Chaque société garde son propriétaire.** Le propriétaire du groupe est propriétaire de chacune,
  sauf s'il a transféré l'une d'elles.
- Les fiches **partagées** du groupe (`01` § 5) : pour les modifier, il faut le droit dans **toutes**
  les sociétés qui les partagent, sinon la modification est refusée en disant où le droit manque.

### 4.1 Qui compte comme « utilisateur » dans l'offre

L'offre Essentiel compte **3 utilisateurs**, puis 30 DT par an pour chacun en plus (`07`). Voici qui
compte :
- **compte** : chaque membre **actif** de l'entreprise, quel que soit son rôle, Lecture et Caissier
  compris. Une personne compte une fois par entreprise, même avec plusieurs rôles (D7) ;
- **ne compte jamais** : les collaborateurs du cabinet (le cabinet est gratuit pour ses clients
  abonnés, et son équipe est illimitée), l'équipe SkanFact, un membre retiré, une invitation pas
  encore acceptée ;
- à la quatrième invitation, l'écran dit **avant** l'envoi ce que coûte l'utilisateur en plus, avec
  le bouton qui l'ajoute. Il ne refuse pas une fois l'invitation partie ;
- **exception, ajoutée le 28/09/2026** (`14`, par délégation) : un **caissier** ou un **serveur** qui
  ne travaille **que sur les caisses** de l'entreprise ne compte pas. C'est la caisse qui se paie
  (`07`) : un restaurant de huit serveurs ne doit pas payer huit utilisateurs. Dès qu'on lui donne
  un autre rôle, il compte ;
- ne compte pas non plus : le **visiteur de l'espace client** (§ 4.2).

### 4.2 Le visiteur de l'espace client

Le client d'une entreprise qui ouvre son lien (`14` § 2.1) n'est **pas un membre** : il n'a ni
compte, ni rôle, ni mot de passe. La porte (D2) le reconnaît par son lien, et ne lui laisse que :
- **lire** les pièces émises **de son tiers** (celles de la pièce, ou tout le compte selon le lien) ;
- **payer en ligne**, si l'entreprise l'a activé.

Le lien est secret, révocable, et expire ; chaque visite laisse sa trace. Un lien qui ne vaut plus
le dit, sans révéler s'il a existé.

---

## 5. La console et le support (l'équipe SkanFact)

| Rôle (`equipe`, `01` § 18) | Ce qu'il fait |
|---|---|
| **Direction** (Skander, son père) | Tout dans la console : clients, abonnements, prix, équipe, réglages |
| **Support** | Fiches clients, tickets, gestes commerciaux simples (prolonger un essai, offrir un mois) ; **demander** un accès à un dossier |
| **Technique** | Santé du service, file de travaux, envois en échec, sauvegardes. **Aucune** donnée de client |

**L'accès au dossier d'un client** (`acces_support`, `01` § 18 ; vision § 12) :
- il se **demande** depuis la console, avec un motif ;
- il s'**accorde** dans l'application du client, par le propriétaire ou un administrateur (D10 : le
  propriétaire est prévenu) ;
- il est en **lecture seule**, toujours ; D9 interdit d'agir au nom du client ;
- il dure **48 heures au plus**, et le client peut le retirer à tout moment ;
- **chaque page lue** est tracée, et le client voit ces lectures dans « Qui a regardé mes données ».

**Personne chez SkanFact n'écrit dans les données d'un client.** Réparer une donnée abîmée par un
défaut du logiciel passe par une **correction écrite, relue et testée** (une migration). Elle est
annoncée au client et tracée dans sa piste d'audit, comme n'importe quel geste. Ce n'est jamais une
main dans la base.

---

## 6. Se connecter

Ce qui est décidé depuis le 28/09/2026 (`00`), et ce que ce document ajoute.

| Sujet | Règle |
|---|---|
| Compte | Un par personne, une adresse e-mail, un **téléphone vérifié** |
| Mot de passe | **10 caractères au moins**. Refusé s'il figure dans une liste de mots de passe déjà volés : la vérification se fait sur notre serveur, sans jamais envoyer le mot de passe ailleurs. Gardé en empreinte seulement (`01` § 4) |
| Code sur le téléphone | **Obligatoire** : propriétaire, administrateur, paie, tous les comptables, l'équipe SkanFact. **Proposé** aux autres. Par SMS par défaut, ou par une application d'authentification |
| Appareil reconnu | Le code n'est redemandé qu'à la première connexion d'un appareil, puis **tous les 30 jours** (`appareil.reconnu_jusqu_au`) |
| Ordinateur d'un autre | « Ce n'est pas mon ordinateur » : rien n'est gardé sur le poste, pas de hors-ligne, et la session se ferme après **30 minutes** d'inaction |
| Session sur un appareil reconnu | Elle se ferme après **12 heures** d'inaction ; le poste de caisse reste ouvert |
| Changer de caissier | Code à **4 chiffres**, sur un poste de caisse déjà reconnu, pour un membre qui a le rôle Caissier (ou pour le code d'un responsable, § 2.1) |
| Erreurs de mot de passe ou de code | Après 5 erreurs, une attente qui s'allonge (1 min, 5 min, 15 min…), **jamais un blocage définitif** : sinon n'importe qui bloquerait le compte d'un autre. Le titulaire est prévenu |
| Codes de secours | À la mise en place du code sur le téléphone, la personne reçoit **10 codes de secours** à usage unique, à imprimer ou à garder |
| Téléphone perdu | Avec un code de secours, la personne se reconnecte et déclare son nouveau téléphone. Sans code de secours : la procédure de reprise (D4), sur pièces. **Un administrateur ne réinitialise jamais le code d'un autre** : le compte est unique et sert aussi dans d'autres entreprises et d'autres cabinets. Un administrateur retire seulement l'accès à **son** entreprise |
| Appareil perdu ou volé | Chacun **révoque** ses appareils ; le propriétaire et l'administrateur peuvent retirer l'accès d'un membre à l'entreprise. Les données locales s'effacent à la reconnexion (vision § 4.5) |
| Départ d'un employé | On le retire : l'accès tombe **immédiatement**, et tout ce qu'il a fait reste signé de son nom |

**Ce qui part chez le fournisseur de SMS** (règle du projet : « jamais une donnée de plus dans ce qui
part vers un serveur sans que la liste soit comptée et décidée ») : **le numéro de téléphone et le
code**, rien d'autre. Ni le nom, ni l'entreprise, ni l'adresse e-mail. Le message dit seulement « Ton
code SkanFact : 482 913 ». Même règle pour le fournisseur d'e-mails de connexion : l'adresse et le
lien, rien d'autre. Les deux fournisseurs doivent être **en Tunisie** (décision d'hébergement du
27/09/2026).

**À VÉRIFIER** : le fournisseur de SMS tunisien, son prix par message et sa fiabilité (document 12).
Le budget du SMS est faible grâce aux appareils reconnus, mais il existe.

---

## 7. La trace de tout

**La piste d'audit** (`audit`, `01` R10 et § 17) garde **chaque geste** : qui, quand, depuis quel
appareil, sur quel objet, ce qui a changé (avant → après). Pour les données sensibles, elle garde
aussi chaque **lecture** (D10).

| Qui lit la trace | Ce qu'il voit |
|---|---|
| Propriétaire, administrateur | Toute la trace de l'entreprise, filtrable par personne, par objet, par date |
| Chaque membre | Sa propre activité |
| Associé du cabinet | La trace de son équipe sur ses dossiers |
| Tout le monde, sur une pièce | L'**historique de la pièce** (créée, modifiée, émise, envoyée, payée…), comme aujourd'hui (1.10.0) |
| Le client | « Qui a regardé mes données » : les lectures du support et du cabinet |

**Ce qui prévient le propriétaire** (par notification, et par e-mail s'il le veut) :
- un RIB changé, celui de la société ou celui d'un fournisseur ;
- un nouveau membre administrateur ou paie, un rôle élargi ;
- un transfert de propriété demandé ;
- un export complet ;
- un accès accordé au support, un mandat de cabinet donné, changé ou arrêté ;
- un membre qui a perdu son téléphone et s'est reconnecté par un code de secours.

**Combien de temps** : la trace des gestes sur les pièces et les écritures vit **aussi longtemps que
les pièces** (10 ans au moins, **À VÉRIFIER**). Les connexions et les lectures ordinaires vivent
**un an**. **À VÉRIFIER** avec l'INPDP : durée de conservation des traces qui concernent des
personnes (salariés, utilisateurs).

La piste d'audit n'est **pas** le journal inaltérable. Le journal scelle les pièces (`01` R9) ; la
piste raconte les gestes. Les deux se vérifient séparément.

---

## 8. Les clés de l'API

**Dès le lancement** (`14` § 2.5), une clé d'API (`cle_api`, `01` § 17) se traite comme une
personne :
- elle appartient à **une entreprise**, et elle porte **une liste de gestes**, comme un rôle ;
- seuls le propriétaire et l'administrateur la créent. Elle ne se montre **qu'une fois**, expire, et
  se révoque ;
- ses gestes passent par la même porte (D2) et laissent leur trace au nom de la clé et de celui qui
  l'a créée.

---

## 9. Comment on prouve que les droits tiennent

- **La matrice est générée des déclarations des modules** (`02` M1 : chaque module déclare ses
  gestes). Un test joue **chaque rôle contre chaque geste** et compare au tableau de ce document.
  Un geste neuf sans ligne dans le tableau fait tomber la construction.
- **La base refuse, même si le code se trompe** : un test se connecte comme membre d'une entreprise
  et essaie de lire, par toutes les routes, les données de l'entreprise d'à côté (vision R2).
- **Aucune route sans geste déclaré** (D2) : un test parcourt l'API.
- **Chaque refus dit motif, qui et bouton** : un test vérifie que `qui` n'est jamais une personne
  absente (D4, la leçon de la 10.14.0).
- **Personne n'est enfermé dehors** : un test essaie de retirer le dernier propriétaire et le dernier
  associé.
- **Le hors-ligne ne contourne rien** : un test retire un droit pendant qu'un poste est hors ligne,
  puis rejoue ses gestes (D8).
- Chaque test se prouve en **réintroduisant son défaut** (règle du projet).

---

## 10. Ce que deviennent les droits de l'application actuelle

| Application actuelle | Nouvelle plateforme |
|---|---|
| App entreprise : une personne par dossier, « dossier partagé à deux postes » | La personne qui passe à la plateforme devient **propriétaire** ; elle invite ensuite son équipe |
| Cabinet : collaborateurs **déclarés par leur nom** (sans mot de passe propre, 9.9.0) | Chacun reçoit une **invitation par e-mail** avec son rôle converti (`supervision` → Associé, `validation` → Collaborateur, `saisie` → Assistant) ; les droits posés par dossier sont repris dans `mandat_affectation` |
| Travail déjà signé d'un nom (validations, révisions) | Le nom est gardé tel quel dans l'origine (`01` R16), et relié au compte quand la personne l'accepte |
| Le mot de passe unique du Cabinet, qui ouvrait tout | Remplacé par un compte par personne et le code sur le téléphone |

Détail de la reprise : document 08.

---

## 11. À VÉRIFIER

1. **Procédure de reprise d'un compte propriétaire** (départ, décès, conflit) : quelles pièces, quel
   délai. Juriste.
2. **Signature d'une facture numérotée plus tard**, et **cachet électronique d'entreprise** : TunTrust
   et TTN (§ 2.2).
3. **Écritures de paie en totaux** : acceptables pour les cabinets et en cas de contrôle ? Comptable.
4. **Conservation des traces** qui concernent des personnes : INPDP (§ 7).
5. **L'ancien cabinet relit-il les exercices qu'il a signés** : déjà listé (`01` § 4), Ordre des
   experts-comptables.
6. **Fournisseur de SMS** : prix, fiabilité, délai de livraison (document 12).
7. **Travail d'un dossier tenu** quand le client ne l'a jamais rejoint et que le mandat s'arrête :
   à qui appartient-il ? Ordre des experts-comptables (§ 3.5).
8. **Rôle Lecture pour un banquier ou un associé** : faut-il un accord écrit du propriétaire (secret
   des affaires) ? Juriste.

## 12. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | Une seule porte des droits, sur le serveur ; la base refuse d'elle-même ; chaque route de l'API déclare son geste |
| 28/09/2026 (proposé) | Un refus nomme la première condition qui manque (accès, offre ou période, rôle), avec qui peut le faire et le bouton qui débloque |
| 28/09/2026 (proposé) | Personne n'est enfermé dehors : toujours un propriétaire, toujours un associé ; procédure de reprise tenue par la console |
| 28/09/2026 (proposé) | Plusieurs rôles possibles par personne (union) ; un rôle donné au groupe vaut dans toutes ses sociétés |
| 28/09/2026 (proposé) | Le tableau des gestes des §§ 2 et 3 ; celui qui compte l'inventaire ne valide pas l'écart ; retour et remboursement de caisse avec le code d'un responsable |
| 28/09/2026 (proposé) | Le cabinet n'émet pas, n'encaisse pas, ne touche ni à l'équipe ni aux pièces émises ; périmètre du mandat choisi par le client, paie décochée par défaut |
| 28/09/2026 (proposé) | Aucun « se connecter en tant que » ; le support lit seulement, 48 heures au plus, avec l'accord du client, chaque page tracée ; personne chez SkanFact n'écrit dans les données d'un client |
| 28/09/2026 (proposé) | Mot de passe de 10 caractères au moins, vérifié contre les listes de mots de passe volés ; jamais de blocage définitif ; session de 12 h sur un appareil reconnu, 30 min ailleurs |
| 28/09/2026 (proposé) | Lectures de la paie tracées ; écritures de paie en totaux du mois ; gestes sensibles qui préviennent le propriétaire |
| 28/09/2026 (relecture) | Dossier tenu : aucun membre côté client, l'associé en répond, le client en devient propriétaire en le rejoignant ; le cabinet y enregistre les ventes émises ailleurs, sans jamais les émettre |
| 28/09/2026 (relecture) | Qui compte comme utilisateur dans l'offre ; codes de secours, et aucun administrateur ne réinitialise le code d'un autre ; seuls le numéro et le code partent chez le fournisseur de SMS |
| 28/09/2026 (par délégation, `14`, **à revalider**) | D11 (l'accord d'un responsable au-delà d'un seuil) ; le rôle Serveur et les gestes de la salle (vague 1) ; espace client, paiement en ligne, lecture de documents, API et intégrations au tableau des gestes ; un caissier ou un serveur qui ne travaille que sur les caisses ne compte pas comme utilisateur ; le visiteur de l'espace client n'est pas un membre |
