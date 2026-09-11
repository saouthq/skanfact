# Plan des versions à venir

Établi le 11/09/2026, après la 2.3.0. **Rien n'est commencé tant que Skander n'a pas donné son feu vert.**

Règle de lecture : chaque version est livrée finie, testée et publiée comme d'habitude (numéro de version,
entrée de CHANGELOG, release GitHub, mise à jour proposée dans l'app). Aucune version n'est commencée avant
que la précédente soit installée et utilisée. Tout ce qui touche à la fiscalité ou au social porte la mention
**À VÉRIFIER avec le comptable** : l'app calcule et propose, le comptable valide.

*Mis à jour le 11/09/2026 : ajout de la 2.4.0 (navigation et contrats visibles) et du contrat à faire signer
en 2.6.0, après deux manques signalés par Skander. Les statistiques et les documents manquants ont glissé
d'un numéro.*

Taille indicative : **S** = quelques heures, **M** = une journée, **L** = plusieurs jours, **XL** = la plus grosse brique du logiciel.

---

## Où on en est

SkanFact sait tout faire sur **l'argent qui rentre** : devis, factures, avoirs, acomptes, paiements,
relances, contrats récurrents, clients, catalogue, TVA collectée, journal des ventes, export au comptable.

Il ne sait **rien** sur l'argent qui sort. C'est le trou principal, et c'est de lui que dépendent le stock,
les immobilisations, la marge réelle et la vraie déclaration de TVA.

---

## Bloc 0 — ce qui se fait tout de suite (aucune donnée nouvelle)

Ces trois versions n'attendent rien : les données existent déjà. Elles donnent du résultat vite
pendant que le gros chantier des achats se prépare.

### 2.4.0 — Revenir en arrière, et voir enfin un contrat · M

Deux manques signalés par Skander le 11/09/2026, complétés par un audit du code sur quatre angles :
navigation, contrats, impasses, cohérence entre écrans.

**Navigation**
- **Bouton retour sur chaque sous-page**, pas seulement sur la fiche client qui est la seule à en avoir un aujourd'hui
- **Raccourci « précédent »** dans le menu de l'application et au clavier : aujourd'hui il n'en existe aucun
- Après une action (enregistrer, supprimer, émettre), on revient toujours là où on était parti
- Tout ce que l'audit remonte d'autre sur le même sujet

**Contrats : les rendre visibles**

Un contrat n'est aujourd'hui qu'une machine à fabriquer des brouillons de facture. Il n'a aucune existence
à l'écran : ni aperçu, ni fiche, ni lien avec les factures qu'il a produites.
- **Aperçu vivant** de la facture que le contrat produira, exactement comme l'aperçu d'un devis dans l'éditeur : tu vois ce que le client recevra avant de valider
- **Fiche contrat** : ce qu'il facture, à qui, depuis quand, ce qu'il a rapporté depuis le début, et **la liste des factures déjà générées**
- Depuis une facture issue d'un contrat, **un lien vers ce contrat**. Le rattachement existe déjà dans les données depuis la 1.5.0, il n'a jamais été affiché nulle part
- L'historique d'une facture dit qu'elle vient d'un contrat

### 2.5.0 — Statistiques et analyses · M — ✅ **livré le 11/09/2026**

Aujourd'hui l'accueil montre quatre chiffres et un graphique sur douze mois. C'est un tableau de bord,
pas une analyse. Nouvelle page **Statistiques**, avec une période libre (mois, trimestre, année, ou dates choisies).

Ce que tu y verras :
- **Chiffre d'affaires** par mois, trimestre et année, avec la **comparaison à l'année précédente** (même période, écart en dinars et en pourcentage)
- **Saisonnalité** : quels mois rapportent, lesquels sont creux
- **Clients** : classement, part de chacun dans ton chiffre d'affaires, **clients dormants** (plus rien depuis N mois), nouveaux clients de la période
- **Prestations** : ce qui se vend le plus, ce qui rapporte le plus, panier moyen et son évolution
- **Devis** : taux d'acceptation, délai moyen entre l'envoi et la réponse, montant perdu sur les refusés et les expirés
- **Encaissement** : délai moyen réel, classement des bons et des mauvais payeurs, âge des impayés (moins de 30 j, 30 à 60, 60 à 90, plus de 90)
- **Objectif annuel** de chiffre d'affaires, saisi dans les paramètres, avec une jauge et le rythme nécessaire pour l'atteindre
- Export de chaque tableau en CSV, et de la page entière en PDF

Ce que ça ne peut pas encore montrer : **la marge**. Elle a besoin des achats (voir 3.4.0).

*Écarts avec le plan :* la période se choisit dans une liste (année, trimestre, mois) plutôt qu'entre deux dates libres — plus simple, et c'est ce qui permet la comparaison automatique à la même période de l'an dernier. L'export est un CSV unique reprenant toute la page, pas un fichier par tableau ni un PDF : un tableur accepte le CSV, et un PDF de statistiques ne s'imprime jamais.

### 2.6.0 — Les documents qui manquent · M — ✅ **livré le 11/09/2026**

Cinq manques repérés, tous côté ventes, tous nécessaires avant le stock.

- **Facture proforma** : très demandée par les administrations et pour les dossiers de financement. Même document qu'une facture, sans valeur comptable, sans numéro de facture, sans timbre
- **Bon de commande client** : quand le client commande avant que tu livres. Il devient la base de la facture
- **Bon de livraison** : la pièce qui accompagne la marchandise, signée à la réception. C'est **lui** qui sortira le stock plus tard, souvent avant la facture
- **Contrat de prestation à faire signer** : un vrai document imprimable, avec objet, durée, reconduction, préavis, conditions et case de signature. À ne pas confondre avec le contrat récurrent de la 2.4.0, qui ne fait que générer des factures : ici c'est la pièce que le client signe. Les deux se relient
- **Pièces jointes** sur n'importe quoi : le devis signé scanné, le bon de commande du client, un contrat rendu signé, une photo. Stockées à côté du fichier de données, reprises dans les sauvegardes

Conséquence : la numérotation s'élargit (`PRO-`, `BC-`, `BL-`, `CTR-`) et le menu « Facturer ▾ » gagne des chemins.

*Écarts avec le plan :* les quatre pièces sont réunies sur une page **Autres documents** à quatre onglets plutôt que quatre entrées de barre latérale — elles servent moins souvent qu'un devis. Les chemins de transformation ont leur propre menu **Transformer ▾** à côté de « Facturer ▾ », qui reste réservé aux trois façons de facturer un devis (conversion, acompte, solde). Les pièces jointes ne sont pas dans le fichier de données (une photo pèse plus que toute la base) : elles sont copiées dans `pieces-jointes/` à côté, et emportées par la copie externe, pas par les sauvegardes quotidiennes — c'est dit dans l'app et dans l'aide.

---

## Bloc 1 — l'argent qui sort (versions 3.x)

C'est la brique qui manque sous tout le reste. À faire dans cet ordre, chaque version s'appuyant sur la précédente.

### 3.0.0 — Fournisseurs, achats et dépenses · L — *données v4* — ✅ **livré le 11/09/2026**

- **Fiche fournisseur**, comme une fiche client : raison sociale, matricule fiscal, contact, conditions de paiement, RIB
- **Facture d'achat** : fournisseur, son numéro de facture, date, échéance, lignes avec TVA, et surtout **la destination de chaque ligne** : charge, stock, ou immobilisation. C'est ce choix qui alimentera les modules suivants
- **Dépense simple**, pour tout ce qui n'a pas de facture détaillée : carburant, restaurant, frais bancaires, abonnements. Montant, catégorie, justificatif photo
- **Catégories de charges** paramétrables, avec une liste de départ selon le secteur d'activité
- **Paiements fournisseurs** : partiels, par mode, avec référence — le symétrique exact des paiements clients
- **Page « À payer »** : le pendant des relances, côté sortant. Ce que tu dois, à qui, pour quand, et ce qui est en retard
- **Retenue à la source que tu opères** sur tes fournisseurs prestataires, et l'attestation à leur remettre — *À VÉRIFIER avec le comptable : qui doit retenir, à quel taux*
- Le panneau « À faire » de l'accueil gagne les échéances fournisseurs

Ce que ça change ailleurs : la barre latérale se regroupe en **Ventes / Achats / Gestion**, et le fichier de
données passe en version 4 avec une migration automatique de tout l'existant.

*Écarts avec le plan :* la barre latérale garde quatre groupes (**Ventes / Achats / Fichiers / Gestion**) —
Clients et Catalogue n'appartiennent ni aux ventes ni aux achats. Le « À payer » n'est pas une page à part
mais un panneau repliable en haut de la page Achats, à côté de la liste qu'il commente. Les catégories de
charges sont une liste unique de seize entrées extensible, et non une liste par secteur d'activité : le
secteur choisi à l'installation préremplit déjà le catalogue de vente, pas les charges.

### 3.1.0 — TVA réelle, déclarations et calendrier fiscal · M — ✅ **livré le 11/09/2026**

- **Déclaration de TVA mensuelle** : collectée moins déductible, par taux, avec le montant à reverser ou le **crédit reportable** sur le mois suivant. C'est le gain le plus concret de tout le plan
- **Journal des achats** et son export CSV, à côté du journal des ventes déjà existant
- **Envoi au comptable** enrichi : ventes, achats, encaissements, décaissements en une fois
- **Calendrier fiscal** dans « À faire » : déclaration de TVA mensuelle, acompte provisionnel, TCL, déclaration employeur annuelle, chacun avec son échéance — *À VÉRIFIER avec le comptable : dates, périodicité et régime applicable*
- **Résultat simple** de la période : produits moins charges, avant impôt

*Écarts avec le plan :* la page Comptabilité passe en quatre onglets (Ventes / Achats / TVA à payer / Calendrier)
plutôt que d'empiler les panneaux. Le bloc de déclaration porte toujours sur **un mois** — c'est la maille réelle
de la TVA — et le tableau « mois par mois » donne l'année, avec l'enchaînement des crédits reportés.

### 3.2.0 — Travailler à deux · M — ✅ **livré le 11/09/2026**

*Version insérée à la demande de Skander (11/09/2026, le soir) : son père gère deux sociétés — Darium et la
sienne — et ils partagent les données de la seconde. La suite du bloc 3 est décalée d'un cran.*

- **Dossiers** : une entreprise par dossier, sur le même ordinateur, sans mélange possible
- **Dossier partagé** dans iCloud / OneDrive / réseau, ouvert tour à tour par deux postes
- **Garde-fou d'écriture** : plus jamais d'écrasement silencieux. Le fichier est relu avant chaque enregistrement
- **Fusion pièce par pièce**, suppressions mémorisées, compteurs jamais redescendus, versions écartées archivées
- **Alerte sur les numéros en double**, le seul cas qu'aucun logiciel ne peut trancher tout seul

### 3.3.0 — Trésorerie · M — ✅ **livré le 11/09/2026**

Aujourd'hui tu vois ce qu'on te doit. Tu ne vois pas ce que tu as.

- **Comptes** : banque, caisse espèces, et autant que nécessaire
- **Solde en temps réel** de chaque compte, alimenté par les encaissements et les décaissements déjà saisis
- **Rapprochement bancaire simple** : tu pointes les lignes qui apparaissent sur ton relevé, l'écart restant se voit
- **Prévision à 30, 60 et 90 jours** : ce qui doit rentrer moins ce qui doit sortir, avec l'alerte quand ça passe en négatif
- Import d'un relevé bancaire en CSV, si ta banque en fournit un

*Écarts avec le plan :* l'import CSV d'un relevé est reporté — le format varie d'une banque à l'autre et il faudrait
un assistant de correspondance de colonnes pour que ce soit utilisable. Le rapprochement se fait en cochant, ce qui
couvre le besoin sans dépendre du format de la banque. Ajouté par rapport au plan : l'alerte de trou de trésorerie
remonte en tête du panneau « À faire », et le compteur de la barre latérale ne s'allume que dans ce cas.

### 3.4.0 — Marges et rentabilité · M — **livrée**

Les statistiques de la 2.4.0 se remplissent enfin de ce qui manquait.

- **Marge par facture, par client, par prestation** : prix de vente moins coût d'achat rattaché
- **Marge par affaire** : le serveur acheté pour un client précis, revendu à ce client, avec le vrai résultat de l'opération
- **Rentabilité des contrats de maintenance** : ce qu'ils rapportent sur l'année contre ce qu'ils coûtent
- **Charges fixes contre charges variables**, et le chiffre d'affaires minimum pour couvrir tes charges

### 3.5.0 — Immobilisations et amortissements · M

Une ligne d'achat marquée « immobilisation » atterrit ici automatiquement.

- **Fiche par bien** : désignation, date d'acquisition, valeur d'achat hors taxes, durée, mode linéaire
- **Tableau d'amortissement** annuel et **valeur nette comptable** à toute date
- **Dotation de l'exercice**, à donner au comptable
- **Sortie** : vente, mise au rebut, avec la plus ou moins-value
- Durées usuelles proposées, **toutes à VÉRIFIER avec le comptable** : matériel informatique 3 ans, mobilier 10 ans, matériel de transport 5 ans, constructions 20 ans
- Rappel de la régularisation de TVA en cas de cession avant cinq ans — *À VÉRIFIER*

---

## Bloc 2 — le stock (versions 4.x)

### 4.0.0 — Articles, mouvements et inventaire · L — *données v5*

- **Article** : référence, désignation, famille, prix d'achat, prix de vente, **seuil d'alerte**, emplacement
- **Entrées** par facture d'achat, **sorties** par bon de livraison ou par facture, plus les ajustements manuels justifiés
- **Valorisation au coût moyen pondéré**, avec la valeur totale du stock à toute date — *À VÉRIFIER avec le comptable : méthode retenue pour le bilan*
- **Inventaire** : tu comptes, tu saisis, l'écart s'affiche et se justifie
- **Deux cas distincts**, parce que ton métier a les deux : le stock dormant (les dix disques) et le matériel acheté pour une affaire précise (le serveur d'un client), rattaché à cette affaire
- **Alertes de réapprovisionnement** dans « À faire »
- La ligne d'un document peut pointer un article : la sortie de stock devient automatique

### 4.1.0 — Numéros de série, garanties et parc client · M

Pour un revendeur de matériel informatique, c'est de la vente récurrente presque gratuite.

- **Numéro de série** suivi de l'entrée à la sortie
- **Garantie** : durée, date de fin, calculée à la livraison
- **Parc client** : quel matériel est installé chez qui, depuis quand, sous garantie jusqu'à quand
- **Fins de garantie qui approchent** dans « À faire » : l'occasion de proposer un contrat de maintenance
- La fiche client montre son parc

### 4.2.0 — Photo d'une facture d'achat, saisie pré-remplie · M — *décision à prendre*

L'idée de ton père : photographier la facture au lieu de la saisir.

Ce que ça suppose, et il faut le décider avant :
- L'app est hors ligne. Lire une photo demande d'**envoyer l'image à un service d'intelligence artificielle sur internet**
- Il faut une **clé payante**, saisie dans les paramètres comme le token GitHub, à quelques centimes par facture
- Sans internet, la photo est quand même **attachée comme justificatif** : rien n'est perdu, seule la lecture automatique est indisponible

Comment ce sera fait, et ce n'est pas négociable : l'app **ne remplit jamais le stock toute seule**.
Elle pré-remplit un formulaire — fournisseur, date, numéro, lignes, montants, TVA — que ton père **valide en
trois secondes** ou corrige. Une erreur de lecture sur une quantité pourrit tout l'inventaire derrière.

---

## Bloc 3 — les gens (versions 5.x)

Le module le plus lourd, et le seul où une erreur coûte juridiquement cher. C'est pour cette raison qu'il vient
en dernier : il faut que le reste soit stable et éprouvé avant.

### 5.0.0 — Employés et bulletins de paie · XL — *données v6*

- **Fiche employé** : identité, CIN, matricule CNSS, date d'embauche, type de contrat (CDI, CDD, SIVP, stage), poste, salaire brut, mode de paiement
- **Bulletin de paie mensuel** : brut, retenues, net à payer, cumuls de l'année, PDF au même standard que tes factures
- **Barèmes entièrement paramétrables**, jamais écrits en dur, parce qu'ils changent à chaque loi de finances
- Taux indicatifs de départ, **tous à VÉRIFIER avec le comptable** : CNSS part salarié 9,18 %, CNSS part employeur 16,57 %, contribution sociale de solidarité 1 %, IRPP au barème progressif, accident du travail selon l'activité
- **Coût employeur réel** par salarié, qui remonte dans les charges et dans les marges
- Mention claire sur les premiers bulletins invitant le comptable à les valider

### 5.1.0 — Congés, absences et documents du personnel · M

- **Congés payés** : acquis, pris, solde
- **Absences** : maladie, sans solde, avec leur effet sur le bulletin
- **Avances sur salaire** et leur retenue échelonnée
- **Attestation de travail, certificat de travail, solde de tout compte**, générés au même format que les autres documents
- **Registre du personnel**

### 5.2.0 — Déclarations sociales · M

- **Déclaration CNSS trimestrielle** : le tableau à recopier ou à exporter
- **Déclaration employeur annuelle**
- Échéances sociales ajoutées au calendrier fiscal de la 3.1.0
- *À VÉRIFIER avec le comptable : forme, dates et modalités de dépôt*

---

## Questions à trancher avant de commencer

1. **La photo de facture** (4.2.0) : acceptes-tu une clé payante et l'envoi de l'image à un service externe ? Si non, on garde la photo comme simple justificatif et la saisie reste manuelle.
2. **La paie** (5.0.0) : veux-tu que l'app calcule les bulletins, avec les barèmes à faire valider par ton comptable ? Ou préfères-tu que ton comptable continue de les établir et que l'app se contente de suivre les coûts ?
3. **L'ordre** : ce plan met la trésorerie avant le stock. Si le stock te bloque davantage au quotidien, on l'avance.
4. **Le rythme** : une version à la fois, installée et utilisée avant de passer à la suivante, ou plusieurs d'affilée ?

---

## Volontairement hors plan

- **Multi-utilisateurs et synchronisation dans le cloud** : chaque installation reste une entreprise sur un ordinateur.
- **E-facture TTN / El Fatoora** et export TEIF : à faire le jour où la facture électronique devient obligatoire pour toi. *À VÉRIFIER avec ton comptable : la Tunisie la généralise progressivement aux assujettis TVA.*
- **Signature Apple et Windows** : supprimerait les avertissements au premier lancement, mais demande des certificats payants annuels.
- **Acceptation du devis en ligne** par le client : demanderait un serveur, donc un abonnement.
- **Deux entreprises sur le même ordinateur** : aujourd'hui une session utilisateur par entreprise suffit.
