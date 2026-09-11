# Historique des versions

Format : `MAJEUR.MINEUR.CORRECTIF`
- correctif (1.0.x) : bug corrigé, petit ajustement visuel
- mineur (1.x.0) : nouvelle fonctionnalité
- majeur (x.0.0) : gros changement (nouvelle structure de données, refonte)

Le numéro affiché en bas de la barre latérale de l'app est celui de `package.json`.

## 3.2.0 — 11/09/2026

Travailler à deux, et gérer deux entreprises sur le même ordinateur.

**Dossiers** (Paramètres → Sécurité et données)
- Un **dossier = une entreprise** : ses clients, ses documents, ses achats, sa numérotation, ses sauvegardes. Ils ne se mélangent jamais
- On passe de l'un à l'autre en un clic, l'application se recharge sur le bon dossier
- Tes données actuelles sont reprises automatiquement dans un premier dossier. **L'ancien fichier reste en place, intact** : si quelque chose te déplaît, rien n'est perdu
- Retirer un dossier de la liste ne supprime jamais ses fichiers

**Dossier partagé** — deux personnes, une entreprise
- Un dossier posé dans iCloud Drive, OneDrive, un disque réseau, que deux ordinateurs ouvrent tour à tour
- **SkanFact ne laisse plus jamais un poste écraser le travail de l'autre.** Avant d'écrire, il relit le fichier ; si l'autre a enregistré entre-temps, il refuse et fusionne
- **Pièces différentes** (le cas normal) : les deux travaux sont réunis, personne ne perd rien
- **Même pièce des deux côtés** : la version du fichier enregistré en dernier est gardée, on te dit laquelle, et **l'autre est conservée** au lieu d'être jetée
- **Pièce supprimée** : elle ne ressuscite pas, la suppression est mémorisée exprès
- **Compteurs de numérotation** : toujours le plus haut des deux, jamais de numéro réutilisé
- **Numéros en double** : si vous avez émis chacun de votre côté hors ligne, aucun logiciel ne peut deviner lequel garder. SkanFact t'alerte en nommant les pièces. La règle à tenir entre vous : **une seule personne émet les factures** — les brouillons n'ont pas de numéro et ne peuvent pas entrer en conflit
- **Nom du poste** (Paramètres → Ce poste) : les messages disent « les modifications du PC du bureau ont été reprises » plutôt qu'un identifiant technique

Aide
- Nouvel article « **Travailler à deux sur la même entreprise** » : les deux cas, ce qui se répare tout seul, ce qui ne se répare pas, et la bonne façon de s'organiser
- Ce que SkanFact ne fait pas y est dit franchement : pas de serveur, pas de temps réel. Les deux postes se passent un fichier, ils ne se voient pas travailler

## 3.1.0 — 11/09/2026

La soustraction qui manquait : ce que tu collectes moins ce que tu déduis.

La page **Comptabilité** passe en quatre onglets

**Ventes** — le journal des ventes, la TVA par taux et les attestations de retenue, comme avant.

**Achats** — le journal symétrique
- Toutes tes factures fournisseurs et dépenses de la période, avec la part de TVA récupérable
- **« Où part ton argent »** : tes charges regroupées par catégorie, de la plus grosse à la plus petite. C'est souvent une surprise
- Export CSV du journal des achats

**TVA à payer** — le calcul complet
- **TVA collectée sur tes ventes − TVA déductible sur tes achats = ce que tu reverses.** C'est le gain le plus concret de tout le plan
- **Crédit de TVA** : quand tu achètes plus que tu ne vends, la différence n'est pas perdue — elle se reporte automatiquement sur le mois suivant
- **Mois par mois** sur l'année, avec le crédit repris et celui reporté. Le total n'est pas la somme des lignes : un crédit ne se compte qu'une fois
- Le crédit venu de l'année précédente se saisit à la main (SkanFact ne peut pas le deviner sans les données d'avant)
- **Résultat simplifié** : produits moins charges. Les achats partis en stock ou en immobilisation n'y sont pas comptés, parce qu'ils ne sont pas consommés
- *Ces chiffres sont l'arithmétique exacte de tes données, pas une déclaration officielle : à faire valider par ton comptable avant tout dépôt*

**Calendrier fiscal** — un pense-bête
- Six échéances proposées (TVA mensuelle, acomptes provisionnels, TCL, déclaration employeur, déclaration de résultat, CNSS trimestrielle). Tu actives celles qui te concernent et tu ajustes le jour limite
- Les échéances à moins de quinze jours remontent dans **« À faire »** sur l'accueil
- *À VÉRIFIER avec ton comptable : les dates, la périodicité et les déclarations applicables dépendent de ta forme juridique, de ton régime et de la présence de salariés*

Envoi au comptable
- L'email prépare maintenant **plusieurs journaux en pièces jointes** : ventes, achats, encaissements et règlements fournisseurs, un fichier CSV par journal, à cocher

## 3.0.0 — 11/09/2026

L'argent qui sort. Jusqu'ici SkanFact ne connaissait que tes ventes ; il connaît maintenant tes achats.

**Cette version change la structure du fichier de données (version 4).** La migration est automatique
au premier démarrage : rien à faire, rien ne se perd. Une sauvegarde du jour est prise avant, comme
d'habitude. Si tu partages tes données avec une ancienne version de l'app, mets-la à jour aussi.

Fournisseurs (barre latérale, nouveau groupe **Achats**)
- **Fiche fournisseur** comme une fiche client : raison sociale, matricule, contact, RIB, délai de paiement accordé
- Le délai et le taux de retenue se **reportent automatiquement** sur chaque achat que tu saisis chez lui
- Fiche détaillée : acheté HT, reste à payer, part en retard, tous les achats, notes internes

Achats et dépenses
- **Facture d'achat** : le numéro et la date sont ceux du fournisseur, pas les tiens — recopie-les tels quels
- **Dépense** pour tout ce qui n'a pas de facture détaillée : carburant, restaurant, frais bancaires, abonnement
- **Destination de chaque ligne** : charge, stock ou immobilisation. Ce choix ne sert encore à rien aujourd'hui, mais c'est lui qui alimentera le stock et les immobilisations — il est demandé dès maintenant pour t'éviter de tout ressaisir plus tard
- **TVA déductible ligne par ligne** : décochable pour les cas où la loi l'interdit (véhicule de tourisme, cadeaux, réception). *À VÉRIFIER avec ton comptable*
- **Retenue à la source que tu opères** sur un prestataire, et l'attestation que tu lui dois. *À VÉRIFIER avec ton comptable : qui doit retenir, à quel taux*
- **Catégories de charges** : seize proposées, et tu peux en ajouter
- **Règlements fournisseurs** : partiels, par mode, avec référence. Le statut (« à payer », « partiel », « payée », « retard ») en découle et ne se saisit jamais à la main
- **Justificatif joint** à chaque achat : sans lui, ni la charge ni la TVA ne sont récupérables

Panneau **« À payer »** en haut de la page Achats
- Ce que tu dois, à qui, pour quand. Les retards en tête, en orange. Repliable, comme « À faire »

Accueil
- Le panneau « À faire » gagne trois lignes : factures fournisseurs en retard, règlements de la semaine, attestations de retenue à remettre
- Le compteur de la barre latérale signale les achats en retard

Corrigé au passage
- **Changer le client d'un devis ou d'une facture en brouillon** ne reprenait ni son taux de retenue à la source, ni sa langue, ni sa devise : la liste déroulante émettait deux événements et le second annulait le premier. Le même piège aurait touché les fournisseurs

Détails
- Barre latérale regroupée : **Ventes / Achats / Fichiers / Gestion**
- Le jeu de démonstration contient quatre fournisseurs et huit achats couvrant tous les cas
- Aide : nouvel article « **Tes achats et ta TVA déductible** », une bulle « i » sur chaque champ

## 2.6.0 — 11/09/2026

Les quatre pièces qui manquaient autour de la facture, et les pièces jointes.

Nouvelle page **Autres documents** (barre latérale, groupe Ventes), en quatre onglets
- **Facture proforma** (`PRO-`) : annonce un prix ferme sans être une facture. C'est ce que réclament les administrations et les banques pour un dossier de financement. Mention « document sans valeur comptable », pas de timbre par défaut (*À VÉRIFIER avec ton comptable*)
- **Bon de commande** (`BC-`) : ce que le client a commandé, par écrit, avant la livraison et la facture
- **Bon de livraison** (`BL-`) : la pièce qui accompagne la marchandise et se fait signer à la réception. **Les prix y sont masqués par défaut** — le livreur n'a pas à connaître tes tarifs. Une case les rétablit
- **Contrat de prestation** (`CTR-`) : le vrai document que ton client signe, avec sept clauses préremplies (objet, durée, reconduction, préavis, paiement, confidentialité, litiges), toutes modifiables, et deux cases de signature. À ne pas confondre avec les contrats récurrents, qui fabriquent des factures : les deux vont ensemble

Transformer une pièce en une autre
- Nouveau menu **Transformer ▾** en haut de chaque document. Le chemin complet d'une vente : devis → bon de commande → bon de livraison → facture, et proforma → facture
- La pièce créée est toujours un **brouillon** : rien n'est émis sans que tu le relises
- Chaque pièce garde le lien vers celle dont elle vient. L'historique le montre **dans les deux sens** et chaque ligne est cliquable

Pièces jointes
- Sur n'importe quel document : le devis signé scanné, le bon de commande du client, un contrat rendu signé, une photo
- Les fichiers sont **copiés** à côté de tes données : si tu déplaces ou supprimes l'original, la pièce reste attachée
- Elles ne sont pas dans les sauvegardes quotidiennes (un seul fichier texte) mais bien dans la **copie externe** — une raison de plus de la configurer

Détails
- Numérotation propre à chaque type, qui repart à 001 en janvier. Ces pièces restent modifiables après coup : elles n'engagent rien fiscalement, contrairement à une facture émise
- Aucune n'entre dans le chiffre d'affaires, la TVA, le journal des ventes ni les statistiques
- Un gabarit d'email par type, modifiable dans Paramètres → Emails
- Le jeu de démonstration contient un exemple de chaque, dont une chaîne proforma → commande → livraison
- Aide : nouvel article « **Proforma, bons et contrat** », et une bulle « i » sur chaque nouveauté

## 2.5.0 — 11/09/2026

Une page Statistiques, pour décider au lieu de deviner.

Nouvelle page **Statistiques** (barre latérale, groupe Gestion)
- **Période au choix** : année entière, trimestre ou mois. Tout ce qui est affiché suit ce choix
- **Comparaison avec l'an dernier** sur chaque chiffre : la même période l'année précédente, jamais le mois d'avant (comparer janvier à décembre ne veut rien dire)
- **Chiffre d'affaires mois par mois**, avec l'année précédente en gris derrière : les creux qui reviennent chaque année sautent aux yeux
- **Objectif annuel** : donne-toi un chiffre d'affaires à atteindre, la jauge montre où tu en es et où tu devrais en être aujourd'hui, et SkanFact calcule ce qu'il reste à facturer par mois
- **Issue des devis** : acceptés, refusés, expirés sans réponse, en attente — en nombre et en montant, avec le taux d'acceptation et le délai moyen entre le devis et la première facture
- **Âge des impayés** : ce qui reste dû, rangé par ancienneté du retard (pas encore échu, 1-30, 31-60, 61-90, plus de 90 jours). Au-delà de 90 jours, la ligne est signalée
- **Prestations les plus vendues** et **meilleurs clients**, avec un avertissement quand un seul client pèse plus de la moitié du chiffre d'affaires
- **Mouvement des clients** : les nouveaux de la période, et ceux qui se sont endormis (plus rien depuis six mois par défaut) — le fichier le plus rentable à rappeler
- **Qui paie vite, qui paie tard** : le délai moyen constaté client par client, à comparer à ton délai annoncé
- **Export CSV** de toute la page, pour ton comptable ou ton tableur

Réglages
- Paramètres → Documents : **objectif de chiffre d'affaires annuel** et **seuil du client endormi**. Ils ne servent qu'aux statistiques et ne s'impriment nulle part

Aide
- Nouvel article « **Lire tes statistiques** » : ce que chaque chiffre dit, et surtout ce qu'il ne dit pas (ces chiffres portent sur ce que tu as facturé, pas sur ce que tu as gagné : les achats viendront dans une prochaine version)
- Une bulle « i » sur chaque bloc de la page

## 2.4.0 — 11/09/2026

Revenir en arrière, et voir enfin ce que fait un contrat.

Retour en arrière
- **Bouton retour sur chaque sous-page** : l'éditeur de devis et de factures, la fiche client, l'aide. Il dit où il mène (« ← Factures », « ← la fiche client ») au lieu d'une flèche muette
- **Précédent** dans le menu Affichage, raccourci **Cmd+[**
- Le retour depuis l'aide ramène à ce que tu faisais, sans repasser par les articles déjà lus

Contrats
- **Fiche de contrat** : clique sur une ligne de la liste. Tu y trouves ce qu'il facture, à qui, depuis quand, le montant par facture, le total facturé depuis le début et ce qui reste à encaisser
- **Aperçu de la prochaine facture**, exactement comme l'aperçu d'un devis dans l'éditeur : tu vois ce que ton client recevra, mois résolu compris, avant que la facture existe
- **Liste des factures déjà générées** par le contrat, triable et cliquable
- Depuis une facture issue d'un contrat, **un lien vers ce contrat**, dans l'en-tête et dans l'historique. Le rattachement existait dans les données depuis la 1.5.0 et n'était affiché nulle part
- Les lignes d'un contrat ont maintenant une **unité** et une **description**, comme celles d'un document
- « + Nouveau client » dans le formulaire de contrat : plus besoin de sortir pour créer le client

Corrigé
- **Une confirmation ouverte depuis un formulaire détruisait ce formulaire et la saisie en cours.** Un trop-perçu confirmé depuis « Enregistrer un paiement » faisait tout perdre. Les fenêtres s'empilent désormais
- **Fermer la fenêtre avec un document non enregistré le perdait sans un mot.** L'app demande maintenant confirmation
- La pastille « Version prête » ouvrait les Paramètres sur l'onglet Société au lieu des Mises à jour
- Les noms du « Top clients » de l'accueil ne menaient pas à la fiche client
- « Devis expirés » et « devis sans réponse » ouvraient la liste complète au lieu de la liste filtrée
- Les attestations de retenue à réclamer n'ouvraient pas la facture concernée
- « + Avoir » était proposé même sans aucune facture émise, alors que le formulaire ne pouvait pas être rempli
- Le menu « Plus ▾ » s'ouvrait vide sur un avoir émis
- La recherche des contrats ramenait le curseur à la fin à chaque frappe
- Cinq explications « i » déjà écrites n'étaient affichées nulle part (acompte, solde, conversion, contrat, filtre par année)

## 2.3.0 — 11/09/2026

Trois champs qu'on utilise vingt fois par jour, refaits.

Unité
- L'unité d'une ligne se **choisit dans une liste** au lieu de s'écrire : unité, heure, jour, demi-journée, mois, année, forfait, intervention, licence, abonnement, poste, lot, mètre linéaire, mètre carré, mètre cube, kilogramme, litre, kilomètre, page
- **Autre…** pour une unité propre à ton métier. Une fois écrite, elle reste proposée dans toutes tes lignes suivantes
- Même liste dans la fiche d'une prestation du catalogue
- Fini les « j », « J », « jour » et « jours » mélangés dans un même document

Choix du client, de la facture, d'une prestation
- Le client se choisit dans une **liste moderne avec recherche** : tape les premières lettres, la liste se filtre sur le nom, la personne à contacter, l'email, le téléphone et le matricule fiscal. Flèches et Entrée pour choisir au clavier
- Chaque ligne montre le nom, la personne à contacter et le matricule : on ne confond plus deux clients qui se ressemblent
- **« + Nouveau client »** est dans la liste elle-même
- Même liste pour la facture concernée par un avoir (avec son montant), pour le catalogue, les modèles de documents et les textes prédéfinis
- Et aussi dans le formulaire de contrat récurrent

Dates
- **Nouveau sélecteur de date** à la place de celui du système : un champ où tu écris librement et un calendrier clair
- La saisie est tolérante : `12/03/2026`, `12-3-26`, `12032026`, `12/03` pour l'année en cours, ou juste `12` pour le mois en cours. Les barres obliques s'écrivent toutes seules
- Les flèches **↑** et **↓** avancent ou reculent d'un jour
- Une date impossible, comme le 31 février, est refusée et l'ancienne valeur revient
- Calendrier : navigation par mois, choix direct du mois et de l'année, aujourd'hui entouré, jour choisi en vert
- Sur une échéance ou une validité : **Aujourd'hui, +7 j, +15 j, +30 j**

## 2.2.0 — 11/09/2026

Les listes, quand elles deviennent longues.

Pagination
- Toutes les listes longues sont **découpées en pages** : devis, factures, clients, prestations, modèles, textes prédéfinis, contrats, factures à relancer, journal des ventes, encaissements, documents d'une fiche client
- Barre de pagination sous chaque tableau : « 1–25 sur 137 », page précédente / suivante, et un choix **25, 50, 100 ou Tout** conservé d'une session à l'autre sur cet ordinateur
- Les totaux en pied de tableau et les exports CSV portent toujours sur la sélection entière, jamais sur la seule page affichée
- L'en-tête du tableau reste visible quand on fait défiler une longue liste

Filtres et tri visibles partout
- Les colonnes triables portent un repère **« ⇅ »** : jusqu'ici rien n'indiquait qu'un titre de colonne se cliquait
- **Recherche ajoutée** là où il n'y en avait aucune : prestations, modèles de documents, textes prédéfinis, contrats récurrents
- **Nouveaux filtres** : contrats (actifs, suspendus, à générer) et clients (avec un impayé, sans aucun document)
- Tri ajouté sur le catalogue, les contrats, les factures à relancer, le journal des ventes, les encaissements et les documents d'une fiche client
- Dès qu'un filtre est actif, le nombre de lignes retenues s'affiche avec un bouton **« Réinitialiser les filtres »**
- Sur une grande liste, l'année en cours était présélectionnée sans le dire : c'est maintenant indiqué et annulable d'un clic

Accueil
- Le panneau **« À faire » se replie** d'un clic sur son titre. Replié, il garde son compteur et une ligne de résumé. Le choix est conservé au prochain démarrage

Correction
- En fenêtre de 1280 px de large, les listes à huit colonnes (factures, clients, contrats, documents récents) dépassaient et obligeaient à faire défiler la page horizontalement. Elles tiennent maintenant dans la largeur

## 2.1.0 — 11/09/2026

Deuxième audit, sur la version 2.0.0 installée : ce qui manquait et ce qui accrochait.

À faire (accueil)
- **Devis acceptés pas encore facturés** : un devis passé en « accepté » sans qu'aucune facture n'en soit tirée remonte sur l'accueil avec le montant vendu. Le bouton ouvre la liste des devis filtrée sur les acceptés
- **Fiche société incomplète** : si la raison sociale, le matricule fiscal ou le RIB manquent, l'accueil le dit et mène directement à Paramètres → Société. Utile quand l'assistant de démarrage a été passé

Garde-fous avant d'émettre
- À l'émission d'une facture ou d'un avoir, la confirmation prévient si la fiche société est incomplète, si le RIB manque, ou si la date est **antérieure à la dernière facture émise** (la numérotation ne serait plus chronologique). On peut émettre quand même, en connaissance de cause
- Une échéance ou une validité antérieure à la date du document est refusée
- Un paiement daté dans le futur, ou supérieur au reste à payer, demande confirmation au lieu de passer en silence

Devis et factures
- **L'historique du devis** montre les factures qui en sont tirées (conversion, acompte, solde), même en brouillon, et l'historique de la facture renvoie vers son devis d'origine : chaque ligne est cliquable
- Liste des factures : les montants et les numéros ne passent plus à la ligne

Contrats
- L'objet des contrats s'affiche avec le mois de la prochaine facture (« Maintenance — octobre 2026 ») au lieu du gabarit brut
- **Reprendre un contrat suspendu** repart de la prochaine échéance à venir : les mois passés pendant la suspension ne sont pas facturés (la date reste modifiable)

Corrections
- Accueil vide : l'axe du graphique affichait « 1, 1, 0 »
- « Tout effacer » : le libellé de confirmation s'affichait sur trois lignes
- Les champs de recherche des listes ne tronquent plus leur texte d'aide
- Le guide « Démarrer » citait des onglets qui n'existent pas (Paiement, Données) ; il pointe maintenant vers Société → Coordonnées bancaires et Sécurité et données
- Le jeu de démonstration contient un devis accepté non facturé pour montrer la nouvelle ligne « À faire »

## 2.0.0 — 11/09/2026

SkanFact devient le logiciel de n'importe quelle petite entreprise, pas seulement de la mienne.

- **Assistant de première utilisation** : à la toute première ouverture, six écrans demandent la raison sociale, le matricule fiscal, l'adresse, l'activité, les règles de facturation (timbre, retenue à la source, délais, devise), le RIB, et proposent de mettre en place tout de suite la copie de sauvegarde externe. Chaque réponse se modifie ensuite dans Paramètres ; l'assistant se passe si on préfère
- **Secteurs d'activité** : informatique et cybersécurité, bâtiment, conseil et formation, commerce, santé, artisanat, autre. Le secteur choisi propose un catalogue de prestations de départ (libellés, prix indicatifs, unités, taux de TVA courant) et un slogan. Tout se modifie ou se supprime
- **Plus aucune entreprise écrite en dur** : les réglages par défaut sont vides, le pied de page des documents se compose du nom et du matricule saisis, et le jeu de démonstration s'annonce comme une démonstration
- Nouvel article d'aide : **« Installer SkanFact pour quelqu'un d'autre »** — une installation, une entreprise, des données et une numérotation indépendantes, et ce qu'il faut expliquer en trois points à celui qui démarre
- Corrigé : un document dont le contenu touchait le pied de page d'un ou deux pixels ne passait pas en marges resserrées et pouvait chevaucher les mentions légales
- Tes données et tes réglages existants ne changent pas : cette version ne touche qu'aux valeurs proposées à une installation neuve

## 1.10.0 — 11/09/2026

Piloter : savoir quoi faire aujourd'hui.

- **Panneau « À faire » sur l'accueil**, à la place des deux bannières. Il regroupe, du plus urgent au moins urgent : factures en retard, contrats à générer, devis expirés, devis sans réponse depuis plus de 15 jours, attestations de retenue à réclamer, factures à échéance cette semaine, brouillons de plus de 7 jours. Chaque ligne a son bouton d'action. Quand il n'y a rien, il le dit
- **Historique par document** : création, émission, envois par email, relances (email et téléphone), paiements, avoirs, attestation reçue. Rien à saisir, tout est reconstitué à partir de ce qui est déjà enregistré

Relances
- **Relance par téléphone** notée à la main, avec ce qui a été dit. Elle compte comme une relance et apparaît dans l'historique
- **Report** : quand un client annonce une date de paiement, la facture descend en bas de la liste jusque-là. Elle reste comptée dans le reste à encaisser — un impayé ne se cache pas
- **Devis sans réponse** : nouvelle section avec un bouton « Relancer par email » et son propre modèle de message
- Le client de chaque ligne renvoie vers sa fiche

Comptabilité
- **Envoyer au comptable** : prépare l'email avec le journal des ventes de la période en pièce jointe (CSV). L'adresse du comptable se retient (Paramètres → Emails)

Navigation
- Barre latérale groupée : **Ventes** (devis, factures, relances, contrats), **Fichiers** (clients, catalogue), **Gestion** (comptabilité, paramètres, aide)
- Compteur sur Contrats quand des factures récurrentes attendent d'être générées

## 1.9.0 — 11/09/2026

Retrouver et suivre : les listes et les clients.

Listes de devis et de factures
- **Tri par colonne** : un clic sur un titre trie, un deuxième inverse
- **Filtre par année**, proposé dès que la liste s'allonge, et ouvert sur l'année en cours
- **Pied de tableau** : nombre de documents, total HT et reste à payer de ce qui est affiché. Avec les filtres, tu obtiens en deux clics le total facturé à un client sur une année
- **Actions au survol d'une ligne** : PDF, Email, Enregistrer un paiement, Dupliquer — sans ouvrir le document
- Les filtres et le tri sont conservés quand tu ouvres un document et que tu reviens
- La recherche porte aussi sur la référence (bon de commande)

Devis
- Nouvel état **« expiré »** : un devis envoyé dont la date de validité est passée sans réponse le montre, dans la liste comme sur l'accueil. Le statut enregistré, lui, ne bouge pas
- La colonne « Type », inutile sur la page Devis, laisse la place à **« Valable jusqu'au »**

Clients
- **Fiche client** (clic sur une ligne) : facturé hors taxes, reste à payer, délai moyen de paiement de ce client, taux d'acceptation de ses devis, bannière s'il a des factures en retard, ses coordonnées, ses notes internes modifiables sur place et la liste de tous ses documents. Boutons « + Devis » et « + Facture » qui partent avec le client, sa langue, sa devise et son taux de retenue déjà réglés
- **Personne à contacter** : le nom de ton interlocuteur, affiché dans la liste et imprimé sur les documents sous la raison sociale
- Liste des clients : triable, avec facturé HT, reste à payer et date du dernier document
- La suppression d'un client est passée dans sa fiche (elle reste impossible s'il a des documents)

Catalogue
- **Trois onglets** : Prestations, Modèles de documents, Textes prédéfinis

## 1.8.0 — 11/09/2026

Comprendre ce qu'on fait, et ne plus rien perdre.

Expliquer
- **Bulles « i » dans toute l'application** : à côté de chaque champ et de chaque tableau, un petit bouton rond ouvre une explication écrite pour quelqu'un qui démarre son entreprise. Plus de 70 explications : matricule fiscal, retenue à la source, timbre fiscal, échéance, taux de change, statut d'une facture, délai moyen de paiement, attestations à réclamer… Les points de fiscalité incertains portent la mention « À VÉRIFIER avec ton comptable »
- **Rubrique Aide** (nouvelle page, menu Aide ou Cmd+K) : quatorze articles qui vont du premier réglage à la routine mensuelle — démarrer, le devis, la facture et la règle de numérotation, l'avoir, se faire payer, TVA / timbre / retenue à la source, acompte et solde, les contrats, facturer à l'étranger, la comptabilité mois par mois, les sauvegardes, bien gérer sa première entreprise, le vocabulaire, les raccourcis clavier. Le menu Aide de l'application renvoie directement aux articles clés

Ne plus perdre son travail
- **Garde-fou « modifications non enregistrées »** : quitter un document ou les paramètres sans enregistrer propose d'enregistrer, de quitter quand même ou de rester. Un marqueur « non enregistré » apparaît à côté du titre dès la première modification
- **Échap ferme** les fenêtres, les menus et les bulles ; **Entrée valide** les formulaires (client, prestation, paiement, mot de passe…)
- Après un enregistrement, la page ne remonte plus en haut

Confort
- **Paramètres en onglets** : Société, Documents, Emails, Apparence, Sécurité et données, Mises à jour. La barre « Enregistrer » n'apparaît qu'en bas, et seulement s'il y a quelque chose à enregistrer
- **Barre d'actions de l'éditeur simplifiée** : Email, PDF, un menu « Facturer ▾ » (convertir, acompte, solde) et « Plus ▾ » pour le reste
- **Aperçu du document** : bouton « Masquer » (choix mémorisé) et indicateur « 1 page / 2 pages » qui prévient quand le document déborde
- **Lignes** : monter, descendre, dupliquer ; la description ne s'affiche que si elle sert (« + description »)
- Le titre de la fenêtre indique le document ouvert
- « Tout effacer » et « Charger la démo » sont dans une zone sensible ; l'effacement demande d'écrire le mot EFFACER
- Fenêtre étroite (13 pouces, pas en plein écran) : l'aperçu et les tableaux de bord se réorganisent au lieu d'écraser les champs

## 1.7.1 — 11/09/2026

- **Nouveau jeu de démonstration** (Paramètres → Données) : treize mois d'activité d'une petite société de cybersécurité — contrat mensuel avec retenue à la source et attestations reçues ou non, contrat trimestriel, contrat suspendu, projet en acompte + solde, facture annulée par un avoir, avoir partiel, paiement partiel, factures en retard aux trois niveaux de relance (relances déjà envoyées), client étranger facturé en anglais et en euros, devis acceptés / refusés / en attente / expiré / brouillon, modèles et textes prédéfinis. Toutes les dates suivent la date du jour : accueil, relances et contrats restent vivants
- Charger la démo **conserve tes paramètres société** (nom, logo, cachet, couleurs, thème) et prend une sauvegarde nommée avant de remplacer les données
- « Tout effacer » vide aussi les contrats, modèles et textes prédéfinis (ils restaient), après une sauvegarde nommée
- **Documents PDF** : quand le contenu déborde d'un peu (quatre ou cinq lignes avec descriptions, remise, retenue à la source, notes), les marges se resserrent automatiquement pour tenir sur une page au lieu de créer une deuxième page presque vide — même règle dans l'aperçu et dans le PDF
- Corrigé : le menu « Plus ▾ » de l'éditeur, le champ « Taux de change » et le bouton « Retirer » de la copie externe restaient affichés alors qu'ils devaient être masqués
- Corrigé : dans Contrats, l'état affichait « envoyée » / « brouillon » au lieu de « actif » / « suspendu »
- Graphique de l'accueil : « juin » et « juillet » étaient tous deux abrégés « jui »

## 1.7.0 — 11/09/2026

Sécurité des données.

- **Copie externe automatique** (Paramètres → Données) : choisis un dossier (iCloud Drive, clé USB, disque réseau) ; à chaque enregistrement le fichier de données et toutes les sauvegardes y sont copiés. Si le Mac meurt, tout est ailleurs. Support débranché : signalé, sans bloquer
- **Mot de passe** (Paramètres → Sécurité) : le fichier de données et ses sauvegardes sont chiffrés sur le disque (AES-256-GCM, clé dérivée par scrypt). Demandé à chaque ouverture ; verrouillage à la demande (menu Fichier ou Cmd/Ctrl+L). Changer ou retirer le mot de passe reconvertit les sauvegardes. Import d'un fichier chiffré possible avec son mot de passe ; l'export JSON reste en clair (avertissement)
- Aucune récupération possible sans le mot de passe : il protège contre un ordinateur perdu ou volé, pas contre l'oubli

## 1.6.0 — 11/09/2026

- **Tableau de bord** : histogramme des 12 derniers mois (facturé HT avoirs déduits, encaissé), top 5 clients de l'année, taux de conversion devis → facture, délai moyen de paiement
- **Documents en anglais** : langue par document (ou par client, ou par défaut) — Quote / Invoice / Credit note, tous les libellés, montant en toutes lettres en anglais, modèles d'email en anglais (Paramètres → Emails), conditions de paiement et de devis en anglais
- **Devise par document** (DT, EUR, USD, GBP, CHF, MAD, DZD) avec taux de change vers le dinar : 2 décimales pour les devises étrangères, taux affiché sur le document, journal des ventes et tableau de bord convertis en dinars
- **Cachet / signature** : une image (Paramètres → Société) apparaît dans la case « Cachet et signature » des factures et devis
- **Thème sombre** (Paramètres → Apparence : clair, sombre, comme le système) — les documents restent clairs

## 1.5.0 — 11/09/2026

Gagner du temps chaque mois.

- **Contrats récurrents** (nouvelle page) : un contrat (client, lignes, mensuel / trimestriel / annuel, jour du mois) génère un brouillon de facture à chaque échéance — bannière « n factures à générer » sur l'accueil, un clic pour les créer, puis « Émettre ». Depuis une facture existante : Plus ▾ → « Rendre récurrent ». Objet avec {mois} (« Maintenance — septembre 2026 »)
- **Relances** (nouvelle page, compteur dans la barre latérale) : factures en retard avec jours de retard, reste à payer, dernière relance ; niveau automatique (rappel ≤ 15 j, relance ≤ 45 j, dernière relance au-delà) ; bouton « Relancer par email » avec le texte prêt ; échéances des 7 prochains jours
- **Envoi par email** : bouton « Envoyer par email » sur les devis, factures et avoirs émis. Sur Mac, le message s'ouvre dans Mail avec destinataire, objet, texte et **le PDF joint** ; ailleurs, la messagerie s'ouvre et le PDF est montré à côté. Six modèles d'email modifiables (Paramètres → Emails), historique des envois par document, un devis envoyé passe automatiquement « envoyé »
- **Recherche Cmd/Ctrl+K** : documents, clients, prestations et actions depuis n'importe où, au clavier
- **Modèles de documents** : Plus ▾ → « Enregistrer comme modèle » sur un devis ou une facture, puis « Depuis un modèle… » dans l'éditeur ou Catalogue → Modèles ; **textes prédéfinis** (garantie, conditions…) insérables dans les notes en un clic
- L'éditeur regroupe les actions secondaires (dupliquer, modèle, récurrent, modifier, supprimer) dans un menu « Plus ▾ »

## 1.4.0 — 11/09/2026

Socle comptable : SkanFact devient une vraie facturation, plus seulement un générateur de PDF.

Factures
- Numérotation à l'émission : un brouillon de facture n'a pas de numéro ; le numéro définitif (FAC-AAAA-NNN) est attribué au clic « Émettre », donc plus aucun trou dans la numérotation si tu supprimes un brouillon
- Une facture émise est verrouillée (plus modifiable, plus supprimable) — c'est la règle de la numérotation continue. Pour corriger : un avoir. Un bouton « Modifier… » reste possible tant qu'aucun paiement ni avoir n'existe, avec avertissement
- Export PDF d'un brouillon : au choix « Émettre et exporter » ou « Exporter le brouillon » (filigrane Brouillon, sans numéro)
- Tampon « Payée » / « Annulée » sur le PDF selon la situation réelle

Paiements
- Enregistrement des encaissements (date, montant, mode virement/chèque/espèces/traite/carte, référence), paiements partiels
- Statut déduit automatiquement : envoyée → partiellement payée → payée, « en retard » après l'échéance ; reste à payer visible dans la liste, sur la fiche et par client
- Les anciennes factures « payée » sont converties en paiement (historique conservé)

Avoirs
- Nouveau type de document AVO-AAAA-NNN, rattaché à une facture (total ou partiel, motif), émis et verrouillé comme une facture ; il vient en déduction du reste à payer et du chiffre d'affaires ; une facture entièrement avoirée passe « annulée »

Retenue à la source (À VÉRIFIER avec le comptable)
- Taux par facture, par défaut par client (1,5 %, 3 %, 5 %, 10 %, 15 %…), calculée sur le TTC hors timbre, affichée sur le document avec le net à payer ; suivi des attestations reçues

Acompte et solde
- Depuis un devis : « Facture d'acompte… » (x % du devis, par taux de TVA) puis « Facture de solde » qui déduit automatiquement les acomptes émis

Comptabilité (nouvelle page, Cmd/Ctrl+6)
- Par mois ou par année : CA HT, TVA collectée par taux, encaissements, reste à encaisser, retenues subies
- Journal des ventes et encaissements exportables en CSV (Excel, format français) ; export de tous les PDF de la période dans un dossier — le pack pour le comptable

Mentions légales
- Registre de commerce et capital dans le pied de page, conditions de paiement sur les factures, conditions des devis modifiables (Paramètres)

## 1.3.3 — 11/09/2026

- Mises à jour : tant qu'aucun token n'est enregistré, l'app n'interroge plus GitHub pour rien et affiche simplement quoi faire (fini le message rouge « Aucune version trouvée » avant même d'avoir collé le token)
- Le format du token est vérifié à l'enregistrement (`github_pat_…` ou `ghp_…`)

## 1.3.2 — 11/09/2026

- Correction du bug qui empêchait la 1.3.0 d'afficher sa fenêtre (et affichait « Cannot read properties of undefined (reading 'publish') » en 1.3.1) : l'app lisait la section `build` de `package.json`, qu'electron-builder retire de l'app installée. Le menu français et la vérification des mises à jour fonctionnent maintenant dans l'app installée, Mac et Windows
- Les tests automatiques tournent désormais sur l'app empaquetée, pas seulement en mode développement

## 1.3.1 — 11/09/2026

- Mac : sur certaines machines la 1.3.0 se lançait (icône dans le Dock) sans jamais afficher sa fenêtre. La fenêtre s'affiche désormais au plus tard 1,5 s après le lancement, même si l'interface tarde à charger
- Plus aucune erreur silencieuse au démarrage : un problème (menu, fenêtre, chargement de l'interface) est affiché à l'écran et noté dans `main.log` dans le dossier des données

## 1.3.0 — 11/09/2026

Mises à jour
- Mac : vraie mise à jour automatique sans certificat Apple — l'app télécharge la nouvelle version, se ferme, se remplace dans Applications et se relance (plus de page web à ouvrir)
- Téléchargement automatique en arrière-plan dès qu'une version est détectée ; pastille « Version X prête » puis un clic « Installer et redémarrer »
- Windows : installation silencieuse et redémarrage automatique
- Vérification au démarrage vraiment silencieuse (plus d'erreur affichée tant que le token n'est pas saisi) ; vérification lancée dès que le token est enregistré
- Notes de version affichées dans l'app (Paramètres → Mises à jour → Nouveautés, menu Aide)

Comme un vrai logiciel
- Menu de l'application en français : Fichier (nouveau devis Ctrl/Cmd+N, nouvelle facture, enregistrer Ctrl/Cmd+S, PDF Ctrl/Cmd+P, export/import), Édition (copier/coller), Affichage (Ctrl/Cmd+1…5, zoom), Aide (nouveautés, à propos)
- Une seule instance de l'app à la fois (deux fenêtres ouvertes pouvaient corrompre le fichier de données)
- Taille et position de la fenêtre mémorisées
- Installateur Windows en français, raccourcis Bureau et menu Démarrer, désinstallation propre
- Image disque Mac avec le raccourci Applications
- Electron 43 (moteur mis à jour, correctifs de sécurité)

Sécurité des données
- Un fichier de données illisible n'est plus écrasé : il est mis de côté et l'app propose de restaurer une sauvegarde
- La sauvegarde quotidienne est désormais l'état du **début de journée** (avant, chaque enregistrement l'écrasait, on ne pouvait pas annuler une bêtise)
- Sauvegarde automatique avant tout import ; import refusé si le fichier n'est pas un export SkanFact
- Paramètres → Données : « Sauvegarder maintenant », « Ouvrir le dossier des sauvegardes »
- Export PDF plus robuste (fichier temporaire au lieu d'une URL limitée en taille — les logos lourds faisaient échouer l'export) ; logo limité à 1 Mo
- Documents longs : pas de ligne coupée entre deux pages, en-tête du tableau répété

## 1.2.1 — 11/09/2026

- Première mise en ligne du code sur GitHub (`saouthq/skanfact`) et première release construite par GitHub Actions
- Les releases sont publiées directement (plus de brouillon) : sans ça, l'app installée ne voyait jamais la nouvelle version
- Icône d'application SkanFact (`build/icon.png`, convertie automatiquement en `.icns` / `.ico` au build)
- `package-lock.json` ajouté pour des builds identiques sur Mac, Windows et GitHub Actions

## 1.2.0 — 11/09/2026

- Mises à jour depuis un dépôt GitHub **privé** : champ « Token GitHub » dans Paramètres → Mises à jour (stocké localement, hors du code)
- Messages d'erreur plus précis (token manquant / refusé)

## 1.1.1 — 11/09/2026

- Message clair dans Paramètres → Mises à jour tant que GitHub n'est pas configuré (plus de pavé d'erreur technique)
- Erreurs réseau/404 résumées en une phrase

## 1.1.0 — 11/09/2026

- Jeu de données de démonstration (Paramètres → Données) : 6 clients, 8 prestations, 14 devis/factures sur 3 mois avec tous les statuts, dont une facture en retard
- Bouton « Tout effacer » pour repartir de zéro en gardant les paramètres société

## 1.0.1 — 11/09/2026

- L'installeur Mac construit maintenant le `.dmg` complet dans `dist/` (en plus de `SkanFact.app`)

## 1.0.0 — 11/09/2026

Première version.

- Société, clients, catalogue de prestations
- Devis et factures : lignes, remise, TVA 0/7/13/19 %, timbre fiscal, montant en lettres
- Numérotation automatique par année, conversion devis → facture, statuts, retards
- Aperçu en direct, export PDF A4 (design clair, couleur d'accent réglable)
- Tableau de bord : CA mois/année, impayés, devis en attente
- Sauvegarde quotidienne automatique, export/import JSON
- Installeur double-clic Mac (`.command`) et Windows (`.bat`)
- Mises à jour intégrées (electron-updater + GitHub Releases), workflow de publication `npm run release`
