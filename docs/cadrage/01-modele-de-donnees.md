# 01 — Le modèle de données de la nouvelle plateforme

*Proposition du 28/09/2026, relue le même jour (§ 23). **Validé par Skander le 28/09/2026.** Ce document suit `VISION-ARCHITECTURE.md`,
qui fait foi en cas de désaccord.*

## En bref (pour Skander)

Ce document dit **ce que la base range, et selon quelles règles**. Il ne dit pas encore le nom exact
de chaque colonne en SQL : ça viendra avec le document 12 (pile technique), au moment d'écrire le
code. Ce qui compte ici, ce sont les **règles**. Une règle oubliée dans un modèle de données coûte
une migration de toutes les entreprises le jour où on s'en aperçoit.

Les trois réponses de ce matin sont appliquées :
1. **Dans un groupe**, chaque société a ses propres clients, fournisseurs et articles. Le groupe
   peut en **partager** certains (§ 5).
2. **Plusieurs établissements par entreprise** dès le départ : points de vente, dépôts, succursales,
   avec leur caisse, leur stock et leur série de tickets (§ 4).
3. **Quand un client change de cabinet**, l'ancien perd l'accès. Tout ce qu'il a fait reste dans les
   données du client, avec son nom dessus (§ 4, mandats). **À VÉRIFIER** auprès de l'Ordre des
   experts-comptables.

Le modèle compte **un peu plus de 100 tables**, rangées en 16 domaines (§ 3 à § 18). Les plus grosses (lignes d'écriture,
tickets, piste d'audit) sont prévues pour atteindre **le milliard de lignes**. Elles sont découpées
par mois dès le premier jour.

---

## 1. Ce que ce document décide, et ce qu'il laisse aux autres

| Décide ici | Décidé ailleurs |
|---|---|
| Les objets, leurs liens, leurs états | Les noms exacts de colonnes et les types SQL (document 12) |
| Les règles transverses : argent, dates, identifiants, immuabilité, isolation | Qui a le droit de faire quoi (document 03) |
| Ce qui est figé, ce qui est calculé | Comment le poste hors ligne se synchronise (document 04) |
| Les tables de la console | Les écrans de la console (document 10) |
| Comment on reprend les données de l'application actuelle | Le plan de reprise détaillé (document 08) |

---

## 2. Les règles qui valent pour toutes les tables

Chaque règle porte le défaut réel qui l'a fait écrire dans l'application actuelle (voir
`docs/application-actuelle/CLAUDE-HISTORIQUE.md`).

**R1. Chaque objet a un identifiant unique créé par le poste qui le crée**, avant même d'avoir
internet : un identifiant universel ordonné dans le temps (UUIDv7). Un geste envoyé deux fois arrive
avec le même identifiant, et il n'est enregistré qu'une fois. **Le numéro légal (FAC-2026-001) est une
autre chose** : il naît sur le serveur, à l'émission (§ 6).

**R2. Chaque ligne de données métier porte l'identifiant de son entreprise**, et la base refuse de
montrer une ligne à qui n'y a pas droit : c'est la **sécurité par ligne (RLS)**. Aucune table métier
n'échappe à cette règle. **Seule exception : une fiche partagée dans un groupe** (tiers, article,
§ 5) porte l'identifiant de l'**organisation** au lieu de celui d'une entreprise, et la sécurité par
ligne la montre aux seules sociétés de ce groupe. Les tables communes à tous (devises, plan comptable
de référence, règles fiscales, cours des devises) n'ont ni entreprise ni organisation, et sont en
lecture seule pour les clients.

**R3. L'argent est un nombre entier** dans l'unité la plus petite de sa devise : millimes pour le
dinar (3 décimales), centimes pour l'euro et le dollar (2). La table des devises dit combien de
décimales chacune a. Il n'y a jamais de nombre à virgule en base.
- **Prix unitaires** : ils peuvent avoir plus de décimales qu'un montant (un litre à 2,525 DT, un
  article à 0,0045 €). Ils sont gardés en **entier à six décimales** (le prix × 1 000 000). Chaque
  total de ligne est ensuite arrondi à l'unité de la devise.
- **Quantités** : entier en **millièmes** (3 décimales : kg, litres, m²). **À VÉRIFIER** avec les
  entretiens : un métier qui compte en dix-millièmes.
- **Taux** (TVA, retenue, cotisations, remises) et **cours des devises** : entiers à six décimales
  aussi (19 % s'écrit 190 000 ; 3,4125 DT pour 1 € s'écrit 3 412 500).
- Tous ces entiers sont des **entiers de 64 bits**. Sur 32 bits, un prix à six décimales dépasserait
  la limite dès 2 147 DT.
- **L'ordre des arrondis** (par ligne, puis TVA par taux) reste celui du moteur actuel
  (`computeTotals`). Ses tests sont portés et le prouvent.

**R4. Une somme de plusieurs pièces se fait toujours dans la devise de base** de l'entreprise. Une
pièce en devise porte donc **trois choses** : ses montants dans sa devise, le **taux figé** à sa date,
et ses montants dans la devise de base (défaut de la 7.0.1 et de la 10.1.0 : 1 000 € comptés comme
1 000 DT).

**R5. Une date et un instant sont deux types différents.** Une date de pièce, une échéance, une date
d'entrée d'un salarié : un **jour du calendrier**, sans heure. Un enregistrement, une signature, un
ticket encaissé : un **instant** (avec fuseau). On ne convertit jamais l'un en l'autre sans le fuseau
de l'entreprise (`Africa/Tunis` par défaut). C'est le défaut de la 5.2.3 : une échéance tombait un
jour trop tôt.

**R6. Ce qui est émis ou validé ne se modifie plus, et ne se supprime jamais.** Une facture émise,
un ticket, une écriture validée, un bulletin remis : on les corrige par une autre pièce (avoir,
contre-passation, bulletin rectificatif). Seul un **brouillon** peut être supprimé, et la
suppression est inscrite dans la piste d'audit. La base elle-même l'interdit : un déclencheur refuse
toute modification d'une ligne scellée.

**R7. Une pièce émise garde une copie de ce qui a servi à la calculer** : identité du client et de la
société à la date d'émission, taux appliqués, totaux, mentions, et la **version des règles fiscales**
utilisée. Changer la fiche du client, un taux ou le timbre ne réécrit jamais une facture déjà émise
(défaut de la 7.1.x : changer le timbre changeait le total des factures envoyées).

**R8. Un statut qui se déduit ne se saisit pas.** « Payée », « partielle », « en retard » se
calculent à partir des règlements et des avoirs. La base peut garder une **copie de calcul** pour
aller vite, mais cette copie est recalculée par la même fonction à chaque changement, et un
invariant la vérifie (règle « deux chemins, un chiffre »).

**R9. Le journal inaltérable** : chaque facture émise, chaque ticket et chaque écriture validée porte
l'empreinte de son contenu **et** celle de la pièce précédente de sa série. Modifier le passé casse la
chaîne, et un contrôle quotidien le voit. La chaîne suit la numérotation : une par série de factures,
une par caisse, et une par exercice pour les écritures (elles sont numérotées dans l'exercice, § 14).

**R10. La piste d'audit est différente du journal inaltérable.** Elle trace **chaque geste** : qui,
quand, depuis quel poste, quel objet, ce qui a changé (avant → après). Elle concerne aussi les
brouillons, les fiches et les réglages. Elle ne se modifie pas et vit dans sa propre table, découpée
par mois.

**R11. Les règles fiscales portent une date d'effet** (§ 3). Toute règle qui dépend de la loi (taux
de TVA, timbre, retenue à la source, CNSS, IRPP, TFP, FOPROLOS…) se lit **à la date de la pièce**. Une
facture de 2026 relue en 2028 garde les règles de 2026.

**R12. Aucune valeur de droit n'est écrite dans le code.** Les taux viennent des tables de règles.
Une règle qu'on ne connaît pas vaut « non renseigné » (`null`), jamais un chiffre inventé : c'est la
règle du « — » plutôt que du zéro (9.1.1, 9.6.0).

**R13. Les champs personnalisés sont des données, pas du code.** Une entreprise ajoute « numéro de
chantier » à ses devis : la définition du champ va dans une table, la valeur dans une colonne `extra`
(JSON validé contre sa définition). On ne modifie jamais le schéma pour un client (la leçon d'Odoo).

**R14. Un objet qui appartient à une entreprise ne pointe jamais vers un objet d'une autre
entreprise**, sauf à travers les tables de groupe (§ 5) et de mandat (§ 4). C'est ce qui permet
d'**exporter et de restaurer une seule entreprise** sans rien casser chez les autres.

**R15. Chaque objet synchronisé porte sa révision** (un compteur qui augmente à chaque changement)
et la date du dernier changement. Le poste envoie la révision qu'il a vue, et le serveur refuse un
geste sur une version périmée au lieu d'écraser (règle 9.9.0 : un travail n'est jamais écrasé).

**R16. Chaque objet repris d'ailleurs garde son origine** : l'application v10, Excel ou un
concurrent, avec l'identifiant d'origine. Relancer la même reprise ne crée rien en double.

---

## 3. Les référentiels communs (sans entreprise)

| Table | Ce qu'elle contient | Qui la modifie |
|---|---|---|
| `devise` | Code ISO, symbole, **nombre de décimales**, nom FR/AR/EN | Nous (console) |
| `pays` | Code, nom, indicatif téléphonique, format d'identifiant fiscal | Nous |
| `plan_comptable_reference` | Plan SCE tunisien : numéro, intitulé FR/AR, classe, sens habituel, **rôle** (clients, fournisseurs, TVA collectée…) | Nous, relu par un comptable |
| `regle_fiscale` | Code de la règle (`tva.taux`, `timbre.facture`, `rs.taux`, `cnss.salarie`, `irpp.bareme`…), valeur (nombre, barème en JSON ou liste), **date de début, date de fin**, texte de loi source, qui l'a vérifiée et quand | Nous, **jamais sans source** |
| `echeance_fiscale_modele` | Déclarations et leurs dates limites, par régime et par forme juridique, avec date d'effet | Nous, **À VÉRIFIER** |
| `format_officiel` | Versions des formats (TEIF 1.8.8, CNSS DS 2012…), dates de validité, schémas de contrôle | Nous |
| `jour_ferie` | Jours fériés tunisiens, datés (pour les délais légaux) | Nous |
| `cours_devise` | Cours du jour de chaque devise (source : Banque centrale de Tunisie, **À VÉRIFIER** : moyen d'obtenir le cours chaque jour) | Nous, chargé chaque jour. Il **propose** un taux ; la pièce garde celui qui a été choisi (R4) |

**Les règles de l'entreprise** : `regle_entreprise` reprend la même forme (code, valeur, dates). Elle
porte ce que l'entreprise règle elle-même, par exemple un taux de retenue particulier ou une
exonération avec son attestation. **Ordre de lecture** : règle de l'entreprise valable à la date,
sinon règle commune valable à la date, sinon « non renseigné ».

**Une loi de finances** = de nouvelles lignes de `regle_fiscale` avec une date de début. On ne modifie
jamais une ligne existante (on ferme sa date de fin). C'est ainsi que l'entretien des lois de
finances 2027 et 2028 se fera sans toucher au code.

---

## 4. Le socle : qui est qui, et qui voit quoi

```
 organisation (groupe · cabinet · indépendant)
   ├─ entreprise  (une société = un matricule fiscal = une comptabilité)
   │    └─ etablissement (siège · point de vente · dépôt · succursale)
   │         └─ caisse, emplacement de stock
   ├─ membre (utilisateur ↔ organisation ou entreprise, avec un rôle)
   └─ mandat (cabinet ↔ entreprise cliente : accord, dates, périmètre)
 utilisateur (une personne, une adresse e-mail, peut appartenir à plusieurs organisations)
 appareil (un poste ou un navigateur installé : hors ligne, révocation)
```

| Table | Champs qui comptent | Règles |
|---|---|---|
| `organisation` | Type (groupe, cabinet, indépendant), nom, cellule (le serveur de base qui l'héberge), **code cabinet** pour un cabinet (court, unique, qu'il donne à ses clients : `00-les-trois-parcours.md`) | Une entreprise seule a aussi son organisation : il n'y a qu'un seul chemin, pas deux |
| `entreprise` | Organisation, raison sociale, forme juridique, **matricule fiscal** (13 caractères, contrôlé), régime fiscal, activité, **devise de base**, **fuseau**, début d'exercice, RIB, logo, cachet, langue des pièces, **date de début sur SkanFact** | Le matricule est unique **pour une entreprise active** (deux comptes pour la même société = une erreur signalée, pas un refus silencieux). Le **régime fiscal** change dans le temps (forfait → réel) : il vit dans `regle_entreprise`, avec sa date d'effet. La **devise de base** ne change plus une fois la première pièce émise |
| `etablissement` | Entreprise, code, nom, type, adresse, **matricule secondaire** (code établissement), téléphone, actif | Une entreprise a au moins un établissement : le siège, créé avec elle |
| `utilisateur` | E-mail (unique), nom, **téléphone vérifié**, langue, **double authentification** (SMS ou application), mot de passe (empreinte seulement), dernière connexion | Global, sans entreprise : une personne, un compte |
| `membre` | Utilisateur, organisation **ou** entreprise, **rôles** (un ou plusieurs, `03` D7 ; un seul **propriétaire** par entreprise, transférable), établissements autorisés (liste, vide = tous), **code de caisse** à 4 chiffres (empreinte seulement), actif, invité par, depuis | Détail des rôles et des droits : document 03 |
| `invitation` | E-mail, cible, rôle, jeton (empreinte), expire le, acceptée le | Une invitation n'expose jamais la liste des membres |
| `mandat` | Cabinet (organisation), entreprise cliente, **accordé par** (utilisateur du client), début, fin, périmètre (comptabilité, déclarations, saisie des achats, paie : `03` § 3.4), statut (proposé, actif, terminé) | Voir ci-dessous |
| `mandat_affectation` | Mandat, membre du cabinet, rôle sur ce dossier (`saisie`, `revision`, `supervision`, `paie` : `03` § 3) | Un collaborateur du cabinet ne voit que les dossiers qui lui sont confiés, sauf s'il est superviseur (règle 9.9.0) |
| `appareil` | Utilisateur, nom, type (navigateur, bureau), premier vu, dernier vu, **reconnu jusqu'au** (le code sur le téléphone n'est redemandé qu'après), **révoqué le**, clé publique de l'appareil | Un appareil révoqué efface ses données locales à la reconnexion |
| `session` | Utilisateur, appareil, ouverte le, expire le, IP | — |

**Qui voit une entreprise** : ses propres membres (`membre` sur l'entreprise ou sur son organisation),
et les collaborateurs d'un cabinet **par un mandat actif**, selon leur affectation. La sécurité par
ligne vérifie ce chemin à chaque requête ; il n'en existe pas d'autre (la console passe par
`acces_support`, § 18).

**Les mandats (réponse 3).** Un cabinet ne voit une entreprise cliente que pendant un mandat
**actif**, que le client a **accepté**. Quand le mandat se termine :
- le cabinet perd l'accès, immédiatement ;
- **rien n'est effacé** : chaque écriture, révision ou question garde le nom de son auteur et de
  son cabinet ;
- le nouveau cabinet voit tout l'historique du client, y compris le travail de l'ancien, qui reste
  signé de son nom ;
- **À VÉRIFIER** avec l'Ordre des experts-comptables : l'ancien cabinet doit-il pouvoir relire les
  exercices qu'il a signés (par exemple en cas de contrôle) ? Si oui, on ajoutera un accès en lecture
  seule borné aux exercices signés. La table le permet déjà (le périmètre du mandat).

---

## 5. Les tiers et les articles, et le partage dans un groupe (réponse 1)

**Par défaut, chaque entreprise a ses propres clients, fournisseurs et articles.** Un groupe peut
choisir de **partager** une fiche. Dans ce cas, la fiche vit au niveau de l'organisation. Chaque
société garde ses propres réglages pour ce tiers : son compte auxiliaire, ses conditions, son taux de
retenue.

| Table | Contenu | Portée |
|---|---|---|
| `tiers` | Nature (société, personne, étranger), raison sociale, nom en arabe (facultatif), **identifiant** (matricule, CIN, carte de séjour, identifiant étranger) et son type, adresses, pays, langue, devise habituelle, e-mail, téléphone, notes | `entreprise_id` **ou**, si partagée, `organisation_id` |
| `tiers_role` | Le tiers est client, fournisseur, ou les deux | Un même tiers peut être les deux : une seule fiche |
| `tiers_parametres` | Par entreprise : compte auxiliaire (411001…), délai de paiement, taux de retenue, **exonération de timbre ou de retenue avec son attestation et ses dates de validité**, remise habituelle, commercial suivi | Toujours par entreprise, même pour un tiers partagé |
| `contact` | Personnes d'un tiers (nom, fonction, e-mail, téléphone, reçoit les factures ou non) | Suit le tiers |
| `article` | Désignation, description, **type** (bien, service), unité, catégorie, **TVA** (un code de règle, pas un taux), prix de vente, coût, suivi du stock, numéros de série, lots, **codes-barres** (plusieurs), actif | Entreprise ou organisation, comme `tiers` |
| `article_parametres` | Par entreprise : prix, compte de vente et d'achat, stock minimal | Toujours par entreprise |
| `liste_prix` | Prix par client ou par catégorie de client, **avec dates d'effet** | Entreprise |
| `unite`, `categorie_article` | Listes ouvertes, jamais fermées (« Autre… ») | Entreprise |

**Pourquoi ce découpage** : une facture est toujours émise par **une** société. Elle a besoin du
compte auxiliaire, des conditions et du taux de **cette** société. Le partage évite de ressaisir la
fiche, sans mélanger les comptabilités.

**Entre deux sociétés du même groupe**, une vente reste une vente : la société A facture la
société B, qui est une fiche de tiers comme une autre. Les deux pièces se relient (`lien_piece`), ce
qui préparera la consolidation du groupe (un module à part, plus tard).

**Le partage se décide fiche par fiche** et il est réversible : « ne plus partager » recopie la
fiche dans chaque société qui l'utilise, et les pièces déjà émises ne bougent pas (R7).

---

## 6. La numérotation

| Table | Contenu |
|---|---|
| `serie` | Entreprise, établissement (facultatif), **type de pièce**, préfixe (FAC, DEV, AVO, TIC…), remise à zéro (annuelle ou jamais), format, **caisse** pour une série de tickets |
| `compteur` | Série, période (année), dernier numéro attribué |
| `bloc_numeros` | Série non légale, appareil, premier et dernier numéro du bloc, numéros utilisés (`04` § 3.2) |

Règles (reprises de l'application actuelle, 6.0.0 et 9.2.0) :
- **Le contrôle passe avant l'attribution** : on vérifie tout (clôture, droits, données), puis on
  prend le numéro dans la même transaction que l'émission. Un refus ne troue jamais la série.
- **Les factures, avoirs et pièces légales sont numérotés par le serveur**, jamais hors ligne.
- **Les tickets** ont une série **par caisse**, numérotée **sur le poste**, même hors ligne. La chaîne
  d'empreintes les rend infalsifiables (modèle ZATCA, **À VÉRIFIER** pour la caisse certifiée
  tunisienne).
- **Une série commencée ailleurs continue** : on peut dire « mon dernier numéro était FAC-2026-147 »
  (213b de l'application actuelle).
- **Un numéro qu'on n'a pas encore pris se lit, il ne se réserve pas** (aperçu de la prochaine
  facture). Cela vaut pour les pièces légales ; une série **non légale** (devis, commande, bon de
  livraison) peut donner à un appareil un **bloc de numéros** pour travailler hors ligne
  (`04` § 3.2, table `bloc_numeros`).

---

## 7. Les ventes

| Table | Contenu | Règles |
|---|---|---|
| `piece_vente` | Entreprise, établissement, **type** (devis, proforma, commande, livraison, facture, avoir, note d'honoraires), statut saisi (brouillon, envoyé, accepté, refusé, émise, abandonnée — **une facture émise ne s'annule jamais** : un avoir total la solde), **série et numéro** (vides jusqu'à l'émission pour facture et avoir), tiers, dates (pièce, échéance, validité), devise, **taux figé**, langue, conditions, objet, notes, remise globale, affaire, **totaux** (HT, TVA par taux, timbre, retenue, TTC, net à payer — natifs et en devise de base), **copie figée** (JSON : société, tiers, règles appliquées), statut de paiement **calculé** (R8), empreinte (R9), `extra` | Émise → scellée (R6) |
| `ligne_vente` | Pièce, rang, article, désignation, description, quantité, unité, **prix unitaire (6 décimales)**, remise de ligne, **code TVA** et taux figé, montants calculés (HT, TVA, TTC), `sans_remise` (déduction d'acompte), compte de vente, axe analytique | — |
| `lien_piece` | Pièce d'origine → pièce produite, **nature** (conversion, acompte, solde, avoir de, relance de) | C'est ce qui rend lisible toute la chaîne d'une vente, jamais un champ recopié à la main (défaut E-03 de la 10.12.0) |
| `reglement` | Entreprise, **sens** (reçu ou versé), tiers, compte de trésorerie, date, montant **tel que la banque l'a bougé**, devise, **taux du jour**, mode (espèces, chèque, virement, carte, traite, Konnect), référence, remboursement ou non, **date d'échéance et état d'un chèque ou d'une traite** (en portefeuille, remis en banque, encaissé, impayé) | En Tunisie, un chèque se donne souvent à une date future et une traite a son échéance : le règlement existe dès la remise, l'argent n'arrive à la banque qu'à l'encaissement, et un impayé rouvre la facture | `affectation` | Règlement → pièce, montant affecté (dans la devise de la pièce), **retenue à la source subie ou opérée** sur cette part | La retenue **naît au règlement** (son fait générateur), jamais à la facture (10.14.0). Un règlement en devise porte son taux du jour ; l'écart avec le taux de la pièce part en gain ou perte de change |
| `attestation_retenue` | Tiers, pièce(s), montant, date, reçue ou émise, fichier, certificat TEJ (identifiant, statut) | — |
| `envoi_ttn` | Pièce, **identifiant d'envoi unique** (jamais deux envois de la même facture), statut (en file, signée, envoyée, acceptée, refusée), référence TTN, **QR code**, fichier XML signé, erreurs, tentatives, dates | Relances automatiques sans doublon (risque R5 de la vision) |
| `signature` | Objet signé, méthode (DigiGo, clé USB, serveur), certificat (émetteur, numéro, validité), signataire, instant, fichier | — |
| `relance` | Pièce, niveau, canal (e-mail, téléphone, WhatsApp, courrier), date, reportée au, note | — |
| `contrat_recurrent` | Tiers, lignes modèles, fréquence, jour, prochaine date, dernière pièce émise, actif, devise | — |
| `modele_piece`, `texte_type` | Modèles de devis, textes réutilisables | Entreprise |

**Les statuts de vente**. Ce qui est **saisi** (brouillon, envoyé, accepté, refusé, émise, abandonnée)
est une colonne. Ce qui est **déduit** (payée, partielle, en retard, annulée par un avoir) est
calculé et mis en cache (R8). L'**affaire** d'une pièce est une section de l'axe analytique
« Affaires » (§ 14) : on ne garde pas deux notions pour la même chose.

---

## 8. Les achats

| Table | Contenu | Règles |
|---|---|---|
| `piece_achat` | Entreprise, établissement, **nature** (facture, avoir, acompte, dépense sans facture), fournisseur, **numéro du fournisseur**, **référence interne** (quand le fournisseur n'en donne pas), dates, devise, taux figé, **TVA récupérable** (figée selon le régime à la date), affaire, totaux, copie figée, statut de règlement calculé, origine (saisie, photo, **facture TEIF reçue**) | Une facture TEIF reçue garde son XML d'origine (fichier) |
| `ligne_achat` | Désignation, article, quantité, prix, code TVA, **destination** (charge, stock, immobilisation), déductible ou non, compte, catégorie de dépense, axe analytique | — |
| (règlements) | Même `reglement` et `affectation` que les ventes, sens « versé » | La retenue **opérée** naît au règlement |

---

## 9. Le stock

| Table | Contenu | Règles |
|---|---|---|
| `emplacement` | Établissement, nom (magasin, arrière-boutique, dépôt central) | Un établissement de type dépôt ou point de vente a au moins un emplacement |
| `mouvement_stock` | Entreprise, emplacement, article, **date et instant** (l'ordre compte pour le coût moyen), quantité signée, **coût unitaire au moment du mouvement**, nature (achat, vente, livraison, retour, casse, consommation, inventaire, transfert, stock de départ), pièce d'origine, lot, numéro de série | Jamais modifié : un mouvement faux se corrige par un autre (R6). Le coût moyen dépend de l'ordre (défaut E-10) : le serveur l'ordonne par instant, jamais par identifiant |
| `inventaire`, `ligne_inventaire` | Date, emplacement, quantités comptées, écart, validé le | La validation crée les mouvements d'écart |
| `transfert` | D'un emplacement à un autre, deux mouvements liés | — |
| `lot` | Article, numéro de lot, date de péremption | **À VÉRIFIER** par les entretiens (pharmacie, alimentaire) |
| `numero_serie` | Article, numéro, statut, client, garantie jusqu'au | — |
| `stock_courant` | Article × emplacement : quantité et coût moyen, **copie de calcul** (R8) | Recalculée par la même fonction, vérifiée par un invariant |

---

## 10. La caisse

| Table | Contenu | Règles |
|---|---|---|
| `caisse` | Établissement, nom, **série de tickets**, appareil attaché, imprimante, tiroir, actif | **Une caisse n'est tenue que par un appareil à la fois** : deux postes hors ligne sur la même série prendraient le même numéro. Changer d'appareil se fait en ligne, après la fermeture de la session |
| `session_caisse` | Caisse, ouverte par et le, **fond de caisse**, fermée par et le, comptage (par mode de paiement), écart, Z (fichier) | Une session hors ligne peut s'**ouvrir** sur le poste (différence voulue avec Odoo) ; **À VÉRIFIER** avec la caisse certifiée |
| `ticket` | Session, **numéro de la série de la caisse** (donné par le poste), instant, client (facultatif), totaux, **empreinte chaînée** (R9), identifiant hors ligne, statut (encaissé, remboursé), facture liée si le client en demande une | Scellé à l'encaissement |
| `ligne_ticket` | Article, quantité, prix, TVA, remise | — |
| `paiement_ticket` | Mode, montant, rendu, référence | — |

Les tickets ne font pas une écriture chacun : **une écriture par session et par mode de paiement**
(ventes par taux de TVA, encaissements), au moment de la fermeture. **À VÉRIFIER** avec un
comptable : un résumé par jour plutôt que par session.

---

## 11. La trésorerie

| Table | Contenu |
|---|---|
| `compte_tresorerie` | Entreprise, nature (banque, caisse, portefeuille électronique), banque, **RIB** (contrôlé), devise, compte comptable (532…, 54…), par défaut, actif |
| `mouvement_libre` | Ce qui n'est ni une pièce ni un règlement : apport, prélèvement, frais bancaires, **virement entre deux comptes** (un mouvement, deux côtés), impôt payé, salaire hors bulletin ; contrepartie comptable ; pièce justificative |
| `releve_bancaire` | Compte, période, solde de début et de fin, fichier importé, format reconnu |
| `ligne_releve` | Date, libellé, montant **signé comme la banque** (entrée positive), référence |
| `rapprochement` | Ligne de relevé ↔ ligne d'écriture (ou règlement), qui, quand, **certitude** (certain, proposé, manuel) — une ambiguïté n'est jamais « certain » (9.5.0) |
| `regle_libelle` | Motif de libellé → compte (apprise quand le comptable choisit) |

---

## 12. La paie

Les données de paie sont **personnelles et sensibles**. Leurs droits sont restreints : un membre de
l'entreprise sans rôle « paie » ne voit ni les salaires ni les bulletins (document 03).

| Table | Contenu | Règles |
|---|---|---|
| `salarie` | Entreprise, établissement, identité (nom, prénom, CIN, date de naissance), **matricule CNSS**, situation familiale, enfants à charge, adresse, RIB, date d'entrée et de sortie, emploi, catégorie | Ne s'efface jamais (son nom vit sur des bulletins remis) ; « sorti » |
| `contrat_travail` | Salarié, type (CDI, CDD, saisonnier, CIVP, Karama…), dates, salaire de base, régime particulier | — |
| `bulletin` | Salarié, période, **saisie** (heures, absences, primes, avances retenues), **calcul figé en JSON** (brut, cotisations, IRPP, net, charges patronales, taux utilisés), statut (brouillon, établi, remis, payé), date de paiement, écriture liée | Remis → scellé ; corrigé par un bulletin rectificatif (R6, R7) |
| `absence` | Salarié, nature (congé payé, maladie, sans solde…), dates, jours | Répartie entre deux mois si elle chevauche (5.1.0) |
| `avance` | Salarié, date, montant, remboursements (lus sur les bulletins) | — |
| `declaration_sociale` | Entreprise, nature (CNSS trimestrielle, déclaration d'employeur), période, fichier produit, statut (préparée, déposée, payée), dates, montants figés | — |

---

## 13. Les immobilisations

| Table | Contenu |
|---|---|
| `immobilisation` | Désignation, famille, compte, valeur d'origine, date d'acquisition et de **mise en service**, méthode (linéaire, dégressive), durée, **coefficient dégressif saisi** (jamais deviné, 9.7.0), pièce d'achat, établissement |
| `plan_amortissement` | **Calculé**, mis en cache par exercice, avec l'écriture de dotation liée (une dotation écrite ne se recalcule plus en silence) |
| `cession` | Date, prix (jamais inventé, 9.0.0), mise au rebut ou non, écriture de sortie |

---

## 14. La comptabilité

| Table | Contenu | Règles |
|---|---|---|
| `exercice` | Entreprise, début, fin, statut (ouvert, clôturé), clôturé par et le, réouvertures (motif obligatoire), à-nouveaux liés | Une clôture fige tout ce qui a changé un chiffre de l'exercice |
| `periode_close` | Entreprise, mois clôturé, par qui, quand, motif de réouverture | Rien de daté dans un mois clos ne bouge (6.0.0) |
| `journal` | Code (VT, AC, BQ, CA, OD, AN, PA…), nom, type, compte de trésorerie lié | — |
| `compte` | Entreprise, numéro, intitulé, lien au plan de référence, **rôle**, sens, lettrable, auxiliaire (tiers lié), actif | Un compte nommé par le cabinet ne se réécrit jamais (9.8.5) |
| `ecriture` | Entreprise, exercice, journal, **date**, **numéro** (vide en brouillard, attribué à la validation, dans l'ordre de validation, continu dans l'exercice), libellé, référence de pièce, **source** (vente, achat, règlement, ticket, paie, dotation, déclaration, saisie, import, à-nouveaux), **objet d'origine**, statut (brouillard, validée, contre-passée), auteur et **cabinet** de l'auteur, validée par et le, contre-passation de, extourne de, empreinte (R9) | Validée → scellée ; corrigée par contre-passation, datée dans son exercice (10.14.0) |
| `ligne_ecriture` | Écriture, rang, compte, **tiers**, libellé, **débit, crédit** (entiers, devise de base), devise et montant d'origine, **code de lettrage**, axe analytique, établissement | **Partitionnée par mois** (§ 19). Un montant négatif change de colonne, jamais de signe (6.3.0) |
| `lettrage` | Code, compte, tiers, lignes, qui, quand, **somme nulle obligatoire** (9.5.0) | — |
| `declaration_fiscale` | Entreprise, nature (TVA mensuelle, acomptes, annuelle, employeur, IS), période, **cases figées** (JSON), statut (préparée, déposée, payée), écriture liée, **sceau des écritures** (un mois qui change après envoi se voit, 10.14.0) | Déposée → figée |
| `revision`, `question` | Le dossier de travail du cabinet ; une question porte **l'objet qu'elle vise** (pièce, écriture, ligne) et s'affiche en face de lui | Le cabinet ne corrige jamais une pièce du client sans son accord (§ 4) |
| `liasse`, `modele_liasse` | Liasse de fin d'exercice, rubriques (table modifiable par le cabinet) | **À VÉRIFIER** contre une vraie liasse |
| `axe_analytique`, `section_analytique` | Affaires, chantiers, établissements comme axes | — |
| `modele_ecriture` | Guides de saisie (loyer, salaire, frais bancaires…) et **écritures récurrentes** (le loyer chaque mois) : lignes modèles, fréquence, prochaine date, mois déjà générés | Génère des **brouillards**, jamais des écritures validées (9.3.0) |
| `correspondance_compte` | Compte de l'entreprise → compte d'un logiciel extérieur, pour les exports | Ne réécrit jamais une écriture validée |

**Comment naissent les écritures (changement important par rapport à l'application actuelle).**
Aujourd'hui, les écritures de l'application entreprise sont **déduites** des pièces à chaque lecture.
Dans la nouvelle plateforme, elles sont **écrites** en base :
1. Une facture émise, un règlement, une session de caisse fermée ou un bulletin remis produisent
   leurs écritures **au même moment**, dans la même transaction, par le moteur actuel porté. Elles
   naissent **en brouillard**.
2. Le cabinet (ou l'entreprise sans cabinet, à la clôture du mois) les **valide**. Elles reçoivent
   alors leur numéro et leur empreinte. Avant la validation, le comptable peut corriger une
   imputation (un compte de charge, un axe) **sans toucher à la pièce émise**. Il ne change jamais
   un montant ni une TVA : ils sont ceux de la facture, et la facture est déjà partie à la TTN.
3. Une pièce émise a **toujours** ses écritures. Un invariant le vérifie chaque nuit (« deux chemins,
   un chiffre » : les écritures recalculées depuis les pièces valent les écritures en base, sauf les
   corrections d'imputation, qui sont tracées).

4. **Une déclaration se prépare sur des écritures validées.** Préparer la TVA d'un mois qui a encore
   du brouillard le **dit** et propose de le valider d'abord ; sans cabinet, c'est ce geste qui valide
   (la règle des contrôles de clôture : on nomme, on propose, on ne bloque pas).

**Pourquoi** : le journal inaltérable (R9) exige des écritures qui existent ; une balance sur dix ans
en moins d'une seconde exige de ne pas tout recalculer ; et c'est exactement le circuit que le
Cabinet suit déjà depuis la 9.2.0 (brouillard, puis validation).

---

## 15. Les fichiers et les documents

| Table | Contenu | Règles |
|---|---|---|
| `fichier` | Entreprise, nom, type, taille, **empreinte SHA-256**, emplacement dans le stockage, **conserver jusqu'au** (10 ans pour une pièce légale), chiffré ou non | Un fichier légal ne s'efface pas avant sa date (stockage non modifiable) |
| `piece_jointe` | Fichier ↔ n'importe quel objet (pièce, écriture, salarié, bien…), qui, quand | — |
| `document_emis` | Le **PDF et le XML exacts** d'une pièce émise, figés | On ne régénère jamais le PDF d'une facture émise : on relit celui qui a été envoyé |

---

## 16. Les envois et les notifications

| Table | Contenu |
|---|---|
| `envoi` | Canal (e-mail, WhatsApp, SMS), destinataire, objet, pièces jointes, statut (en file, parti, remis, refusé), erreur, pièce concernée |
| `notification` | Pour un utilisateur : ce qui l'attend (« À faire »), lue ou non |
| `travail` | La **file de travaux** du serveur (TTN, PDF, mails, rapports, sauvegardes) : nature, charge utile, tentatives, statut, erreur, identifiant d'unicité |

---

## 17. La traçabilité, la synchronisation et la personnalisation

| Table | Contenu |
|---|---|
| `audit` | Qui, quand, appareil, entreprise, objet, action, avant → après (R10). **Partitionnée par mois** |
| `chaine` | Par série : dernière empreinte, contrôle du jour (R9) |
| `operation` | Chaque geste venu d'un poste : **identifiant unique**, appareil, **numéro d'ordre dans l'appareil**, révision vue, instant sur le poste et instant de réception, version du format, statut (accepté, refusé et pourquoi, mis de côté, **en quarantaine** pour un appareil révoqué : `04` § 7), résultat. C'est ce qui fait qu'un geste envoyé deux fois ne compte qu'une fois |
| `champ_personnalise` | Entreprise, objet, nom, libellé, type, liste de valeurs, obligatoire (R13) |
| `parametre` | Réglages de l'entreprise non fiscaux (thème des pièces, textes, préférences), clé → valeur |
| `module_actif` | Entreprise, module, **ouvert** depuis, fermé depuis, source (abonnement, essai). C'est le « module ouvert » de `02` § 1 ; ce que le cabinet a toujours sur ses dossiers (`02` § 8) se déduit du mandat, il ne s'écrit pas ici. Le « module affiché » (le menu) est une préférence, dans `parametre` |
| `drapeau` | Nouveauté, entreprise, allumée depuis (`02` § 7 : une nouveauté s'essaie d'abord chez des volontaires) |
| `cle_api`, `webhook` | Clés d'accès à l'API pour une intégration (empreinte seulement, droits, expiration) et les adresses à prévenir quand un objet change. Vides au lancement ; la forme est posée parce que l'API vient d'abord (vision § 4.7) |

---

## 18. La console (schéma `plateforme`, à part)

La console lit et écrit dans un **schéma séparé**. Il n'a pas de sécurité par ligne « par
entreprise » : seuls les membres de l'équipe SkanFact y accèdent. Elle n'a **aucun** passe-droit sur
les données des clients. Un accès au dossier d'un client passe par `acces_support` (accord, durée,
trace), et une fonction de la base vérifie l'accord à chaque lecture (`VISION-ARCHITECTURE.md` § 12).

**SkanFact est lui-même une entreprise de la plateforme.** Nos factures d'abonnement sont des
**pièces de vente** de l'entreprise « SkanFact » : même moteur, même TEIF, même envoi à la TTN, même
comptabilité. On n'écrit pas un second système de facturation pour nous-mêmes.

| Table | Contenu |
|---|---|
| `equipe` | Membres de l'équipe SkanFact, rôle (direction, support, technique), double authentification obligatoire |
| `offre`, `module`, `prix` | Offres, modules payants, **prix datés** (grille : `07-offres-et-prix.md`) ; un changement de prix ne touche jamais une période déjà payée |
| `abonnement` | Entreprise (ou cabinet), offre, modules, options (utilisateurs, établissements, caisses, salariés en plus), **état** (essai, actif, en retard — les 7 jours de grâce —, lecture seule, résilié), début, fin, prochaine échéance, parrain (cabinet), remise (groupe, parrainage), **prix fondateur** garanti jusqu'au, **crédit repris d'une licence v10** |
| `evenement_abonnement` | Essai commencé, payé, relancé, passé en lecture seule, repris, résilié : qui, quand, pourquoi |
| `commande` | Paiement en ligne (Konnect) : montant, référence, preuve reposée au prestataire (10.9.0), pièce de vente liée |
| `ticket_support` | Client, canal, sujet, échanges, statut, qui s'en occupe |
| `acces_support` | **Accord du client**, membre de l'équipe, entreprise, périmètre (lecture), début, **fin**, motif, et chaque lecture faite pendant l'accès |
| `mesure_usage` | Compteurs **agrégés** (écran, geste, durée, blocage), **jamais le contenu** d'une donnée client |
| `incident` | Début, fin, impact, cause, message publié sur la page d'état |
| `licence_v10` | Les licences hors ligne de l'application actuelle, tant qu'elle vit (reprises de la D1 actuelle) |

---

## 19. Taille et découpage

| Table | Volume attendu à 50 000 entreprises | Découpage |
|---|---|---|
| `ligne_ecriture` | ~1 milliard | Par mois (plages de dates), index qui commencent par `entreprise_id` |
| `ligne_ticket`, `ticket` | Centaines de millions | Par mois |
| `audit`, `operation` | Plusieurs milliards | Par mois, anciennes partitions compressées |
| `ligne_vente`, `ligne_achat`, `mouvement_stock` | Centaines de millions | Par mois si la mesure l'exige (seuils écrits dans le document 12) |
| Le reste | Petit à moyen | Aucun |

**Les cellules** (vision § 4.2) : une organisation vit entièrement dans une cellule. Aucune requête
ne traverse deux cellules. Seule la console lit toutes les cellules, par une vue agrégée.

**Export et restauration d'une entreprise** (R14) : chaque table a `entreprise_id` (ou passe par une
table qui l'a), donc un export est la liste des tables filtrée par cet identifiant. Un test le prouve
à chaque version : exporter une entreprise, la restaurer dans une base vide, et retrouver les mêmes
balances au millime.

---

## 20. Ce que devient chaque donnée de l'application actuelle

Tout ce que l'application v10 range doit avoir une place. Sans cette table, la reprise perdrait
quelque chose en silence.

| Application actuelle (`DEFAULT_DATA`, livre du Cabinet) | Nouvelle table |
|---|---|
| `company` | `entreprise`, `etablissement` (siège), `parametre`, `regle_entreprise` |
| `clients`, `suppliers` | `tiers`, `tiers_role`, `tiers_parametres`, `contact` |
| `catalog` | `article`, `article_parametres` |
| `documents` (devis, factures, avoirs, proforma, commandes, livraisons, contrats) | `piece_vente`, `ligne_vente`, `lien_piece`, `document_emis` |
| `documents[].payments` | `reglement`, `affectation` |
| `documents[].reminders`, `emails` | `relance`, `envoi` |
| `recurring`, `templates`, `snippets` | `contrat_recurrent`, `modele_piece`, `texte_type` |
| `purchases`, `expenseCategories` | `piece_achat`, `ligne_achat`, catégories |
| `assets` | `immobilisation`, `cession` |
| `stockAdjustments`, `serials` | `mouvement_stock`, `inventaire`, `numero_serie` |
| `employees`, `payslips`, `leaves`, `advances`, `payrollSettings` | `salarie`, `contrat_travail`, `bulletin`, `absence`, `avance`, `regle_entreprise` |
| `socialFilings`, `fiscalFilings`, `fiscalDeadlines` | `declaration_sociale`, `declaration_fiscale`, échéances |
| `projects`, `fixedCategories` | `axe_analytique`, `section_analytique`, `parametre` |
| `accounts`, `movements` | `compte_tresorerie`, `mouvement_libre` |
| `ecrituresOD`, écritures déduites | `ecriture`, `ligne_ecriture` (générées une fois à la reprise, puis validées) |
| `closedUntil`, `closureLog`, `clotures` | `periode_close`, `exercice` |
| `questionsCabinet`, révision du Cabinet | `question`, `revision` |
| `packs`, `cabinetSignature` | Plus de paquet : le cabinet est dans les mêmes données. Les paquets reçus sont gardés comme **fichiers** (archive) |
| `counters` | `serie`, `compteur` (la série continue, § 6) |
| `vatCarryIn` (crédit de TVA saisi) | Écriture d'ouverture (à-nouveau du compte de TVA déductible) |
| `auxiliaires` | `parametre` |
| État du Cabinet (`cabinet-data.json` : cabinet, dossiers, collaborateurs, relances, questionnaire, modèle de liasse, guides, correspondance, règles de libellé) | `organisation` (cabinet), `membre`, `mandat`, `mandat_affectation`, `relance`, `modele_liasse`, `modele_ecriture`, `correspondance_compte`, `regle_libelle` |
| Dossiers hors SkanFact du Cabinet | Une `entreprise` créée par le cabinet, sous mandat, sans membre côté client tant que le client ne la rejoint pas |
| Pièces jointes (`pieces-jointes/`) | `fichier`, `piece_jointe` |
| `licences`, `pontImporte`, `exportConsole` | Schéma `plateforme` |
| Livre du Cabinet (`livre-AAAA.json`) | `exercice`, `ecriture`, `ligne_ecriture`, `lettrage`, `releve_bancaire`, `immobilisation`, `bulletin`… |
| `deleted`, `conflictArchive`, `demo`, `exemple` | Remplacés par `audit` et par une **entreprise d'exemple** distincte |

---

## 21. À VÉRIFIER, et ce que les entretiens doivent nous dire

1. **Mandat terminé** : l'ancien cabinet garde-t-il une lecture des exercices qu'il a signés ?
   (Ordre des experts-comptables)
2. **Caisse certifiée** : numérotation, chaînage, session ouverte hors ligne, Z de caisse,
   déclaration à l'administration (Direction générale des impôts).
3. **Écriture de caisse** : une par session ou une par jour ? (comptable)
4. **Lots et dates de péremption** : quels métiers en ont besoin dès le lancement ? (entretiens)
5. **Quantités** : trois décimales suffisent-elles ? (entretiens)
6. **Pièces bilingues arabe/français** : quels champs doivent exister en arabe (raison sociale,
   désignation, adresse) ? (entretiens, administration)
7. **Liasse** : rubriques confrontées à une vraie liasse déposée. (comptable)
8. **Durée de conservation** : 10 ans pour tout, ou plus pour certains documents ? (juriste)
9. **Données personnelles des salariés** : durée de conservation après départ, et ce que l'INPDP
   impose. (juriste)
10. **Cours des devises** : peut-on obtenir le cours de la Banque centrale chaque jour de façon
    automatique, et est-ce celui qu'un comptable attend ? (comptable, recherche)
11. **Chèques et traites** : comment les commerces suivent aujourd'hui les chèques à date future et
    les impayés. (entretiens)

---

## 22. Décisions prises dans ce document

| Date | Décision |
|---|---|
| 28/09/2026 | Tiers et articles propres à chaque société ; partage possible au niveau du groupe, fiche par fiche, réversible |
| 28/09/2026 | Plusieurs établissements par entreprise dès le départ, avec caisse, stock et série de tickets |
| 28/09/2026 | Fin de mandat : l'ancien cabinet perd l'accès, son travail reste signé de son nom (À VÉRIFIER : lecture des exercices signés) |
| 28/09/2026 (proposé) | Identifiants UUIDv7 créés par le poste ; numéro légal donné par le serveur ; tickets numérotés par caisse |
| 28/09/2026 (proposé) | Prix unitaires à 6 décimales en entier ; quantités en millièmes ; montants dans l'unité mineure de la devise |
| 28/09/2026 (proposé) | Écritures **écrites** en base à l'émission, en brouillard, validées par le cabinet ou à la clôture du mois |
| 28/09/2026 (proposé) | Règles fiscales en table, avec dates d'effet ; une loi de finances = des lignes neuves |
| 28/09/2026 (proposé) | SkanFact est une entreprise de sa propre plateforme : nos factures sont des pièces de vente |
| 28/09/2026 (proposé) | Une facture émise ne s'annule jamais (avoir total) ; une caisse n'est tenue que par un appareil à la fois ; une déclaration se prépare sur des écritures validées |

---

## 23. Ce que la relecture du 28/09/2026 a corrigé

*Ajouté après la validation, le même jour, à la relecture du document 02 : `module_actif` distingue
le module ouvert du module affiché, et la table `drapeau` (§ 17). Puis, pour le document 03 : un
membre peut avoir plusieurs rôles, le périmètre du mandat compte la saisie des achats, et le rôle
`paie` s'ajoute aux affectations du cabinet (§ 4). Puis, pour le document 04 : les blocs de
numéros des séries non légales (§ 6) et les champs de `operation` (§ 17). Rien d'autre ne change.*

Relu en entier, ligne par ligne, contre `VISION-ARCHITECTURE.md` et contre ce que l'application
actuelle range vraiment.

| Trouvé | Corrigé |
|---|---|
| R2 disait « chaque ligne porte son entreprise » pendant que le § 5 rangeait les fiches partagées d'un groupe au niveau de l'organisation | R2 nomme l'exception et dit comment la sécurité par ligne la couvre |
| Rien ne disait comment un collaborateur de cabinet atteint un dossier, ni lequel | Le chemin d'accès est écrit (§ 4), et `mandat_affectation` range qui travaille sur quel dossier |
| La chaîne d'empreintes était « par journal » pendant que les écritures sont numérotées par exercice | La chaîne suit la numérotation (R9, § 14) |
| Prix à six décimales sans taille d'entier : sur 32 bits, ils débordent dès 2 147 DT | 64 bits partout ; taux et cours des devises au même format (R3) |
| Aucune table pour le cours des devises : chaque pièce en devise aurait fait retaper le taux | `cours_devise` (§ 3) |
| « Annulée » était un statut qu'on pouvait saisir sur une facture émise | Une facture émise ne s'annule que par un avoir, et le statut est déduit (§ 7) |
| Rien pour les chèques à date future et les traites, très courants en Tunisie | Échéance et état sur le règlement (§ 7) |
| Deux postes hors ligne pouvaient tenir la même caisse, donc prendre le même numéro | Une caisse, un appareil à la fois (§ 10) |
| Le comptable pouvait « corriger une imputation » sans limite | Comptes et axes seulement, jamais un montant ni une TVA (§ 14) |
| Rien ne disait si une déclaration lit le brouillard | Elle lit les écritures validées, et propose de valider d'abord (§ 14) |
| Les guides de saisie et les écritures récurrentes du Cabinet n'avaient pas de place | `modele_ecriture`, `correspondance_compte` (§ 14) |
| Le régime fiscal était un champ fixe alors qu'il change (forfait → réel) | Daté, dans `regle_entreprise` (§ 4) |
| L'« affaire » d'une pièce et l'axe analytique « Affaires » étaient deux notions | Une seule : la section analytique (§ 7) |
| Les ventes entre deux sociétés d'un groupe n'étaient pas dites | Une vente ordinaire, les deux pièces reliées (§ 5) |
| L'API vient d'abord, mais aucune table pour ses clés | `cle_api` et `webhook` (§ 17) |
| La correspondance oubliait l'état du Cabinet, les dossiers hors SkanFact, le crédit de TVA saisi et les comptes auxiliaires | Ajoutés (§ 20) |
| Deux renvois faux : « § 18 » pour le découpage (c'est le § 19), et « R5 » qui désignait deux choses différentes | Corrigés |
