# Modèles internationaux de logiciels de gestion d'entreprise — leçons pour une plateforme modulaire tunisienne

*Recherche arrêtée le 27/09/2026. Taux de change utilisés pour les conversions en dinar tunisien (DT), sourcés à la Banque centrale de Tunisie via agrégateurs de cours (à re-vérifier avant publication car ils fluctuent quotidiennement) : 1 EUR ≈ 3,38 DT (BCT, 02/09/2026) ; 1 USD ≈ 2,95 DT (24/09/2026). Le riyal saoudien (SAR) n'a pas de cours direct trouvé pour la Tunisie ; comme il est arrimé au dollar à 3,75 SAR = 1 USD, on peut dériver 1 SAR ≈ 0,79 DT (calcul, non sourcé directement — à vérifier).*

## Odoo — architecture : un modèle de données unique, des « apps » qui s'y branchent

### Takeaway
Odoo n'est pas un assemblage de logiciels séparés mais **un seul ORM (moteur d'accès aux données) partagé par toutes les « apps »** : une facture, un article de stock ou une fiche client sont des enregistrements du même modèle relationnel, ce qui permet à la comptabilité, au stock et aux ventes de se mettre à jour les uns les autres sans ressaisie ni synchronisation par API — c'est la promesse structurelle à retenir pour une plateforme modulaire (« zéro ressaisie » entre modules).

### Cited Findings
- Le multi-société d'Odoo repose sur des attributs `company_dependent` au niveau de l'ORM : un champ peut porter une valeur différente par société sur le même enregistrement, et les données peuvent être lues « en tant que » société A ou société B (`record.with_company(company_B)`) — [Odoo — Multi-company Guidelines](https://www.odoo.com/documentation/18.0/developer/howtos/company.html)
- La sécurité repose sur des groupes d'utilisateurs (`res.groups`) et des « règles d'enregistrement » (record rules) appliquées au plus bas niveau du serveur (le moteur ORM), donc valables pour toute interface (web, API, import) — [Odoo — Security in Odoo](https://www.odoo.com/documentation/19.0/developer/reference/backend/security.html)
- Les règles d'enregistrement sont « default-allow » : si les droits d'accès autorisent l'action et qu'aucune règle ne s'applique, l'accès est accordé par défaut ; un utilisateur cumule les droits de tous les groupes auxquels il appartient (union des permissions, jamais restriction) — [Odoo Access Rights Setup Guide 2026](https://www.odooskillz.com/blog/odoo-skillz-insights-1/odoo-security-access-rights-groups-permissions-guide-2026-341)
- Le module « visibilité multi-société » est masqué par défaut à un utilisateur qui n'a pas explicitement le groupe `base.group_multi_company` — [Odoo Multi-company forum](https://www.odoo.com/forum/help-1/multi-company-access-rights-197600)
- Le point de vente (POS) précharge en local (IndexedDB du navigateur) tous les produits, clients, taxes et prix à l'ouverture de la session ; une fois ouverte, la session continue de fonctionner sans connexion pour les opérations qui ne dépendent pas du serveur (vente, remise, impression du ticket) ; les commandes créées hors ligne sont mises en file et synchronisées automatiquement au retour du réseau. **Il n'est en revanche pas possible d'OUVRIR une nouvelle session POS sans connexion** — seule une session déjà ouverte reste utilisable hors ligne — [Odoo forum — How is POS offline mode working](https://www.odoo.com/forum/help-1/how-is-the-point-of-sale-offline-mode-working-218314) ; [Which POS features work offline](https://www.odoo.com/forum/help-1/which-point-of-sale-features-are-working-offline-218316) ; [Netilligence — Can Odoo 18 POS work offline](https://www.netilligence.ae/blogs/can-odoo-18-pos-work-offline-understanding-offline-mode/)

### Inferences
- Le choix architectural « un seul ORM, tout le monde y lit/écrit » est ce qui rend Odoo crédible comme suite intégrée face à des concaténations de SaaS reliés par API : c'est un argument direct pour concevoir SkanFact comme **un seul modèle de données partagé entre modules** (ventes, achats, stock, paie, compta) plutôt que des services séparés qui se synchronisent — c'est d'ailleurs déjà l'approche du dépôt SkanFact actuel (JSON unique, `core.js` partagé).
- Le POS offline d'Odoo n'est « vraiment » offline qu'après une première connexion réussie (préchargement) : un mode hors-ligne complet et robuste (ouverture ET fonctionnement sans jamais avoir vu le réseau) reste un axe de différenciation possible pour une plateforme qui viserait des zones tunisiennes à connectivité faible.

### Gaps
- Pas de détail trouvé sur le fonctionnement précis du marketplace de modules tiers (Apps Store) en matière de gouvernance qualité, ni sur les mécanismes exacts de résolution de conflits multi-société pour la comptabilité consolidée.

---

## Odoo — modèle de licence, tarification (dont Moyen-Orient/Afrique) et coût réel

### Takeaway
Odoo vend un accès **par utilisateur payant** (pas par société), avec trois paliers (One App Free, Standard, Custom) dont les prix affichés varient fortement par zone géographique (« pricelist » régionale) — mais le coût réel pour une PME dépasse presque toujours le prix catalogue à cause de l'intégrateur, quasiment obligatoire.

### Cited Findings
- Trois formules : **One App Free** (une seule app, utilisateurs illimités, gratuite) ; **Standard** (compta + apps ventes/achats de base) ; **Custom** (nécessaire pour Odoo Studio, le multi-société, l'API externe, l'hébergement Odoo.sh ou on-premise) — [Odoo Pricing — Mediod (analyse de la hausse 2026)](https://mediodconsulting.com/odoo-price-increase-2026/) ; [OEC.sh — Odoo Enterprise Pricing 2026](https://oec.sh/odoo-pricing/enterprise)
- Aux USA (billed yearly) : Standard ≈ 31,10 $/utilisateur/mois, Custom ≈ 61,00 $/utilisateur/mois. Dans la zone « Middle East / low-USD » (qui inclut l'Afrique et l'Algérie selon la même source), Standard démarre à environ 8,95 $/utilisateur/mois côté bas de fourchette régionale, et pour le palier « SE Asia/Korea/Africa (Low-USD) » spécifiquement cité : Standard ≈ 13,50 $/utilisateur/mois (promo) / 16,90 $ (tarif catalogue), Custom ≈ 20,40 $/utilisateur/mois (promo) / 25,50 $ (catalogue) — [Swell — Odoo Pricing 2026](https://www.swell.is/content/odoo-pricing) ; [OEC.sh — Odoo Pricing (179 pays)](https://oec.sh/odoo-pricing)
- En 2026, Odoo a augmenté le prix catalogue du plan Custom de 20 % à 31 % selon les pays — [Mediod Consulting — Odoo Price Increase 2026](https://mediodconsulting.com/odoo-price-increase-2026/)
- Odoo.sh (hébergement PaaS géré, licence Enterprise incluse) va d'environ 60 $/mois (un seul « worker ») à 500 $/mois pour une configuration multi-worker (staging + production) — [Swell — Odoo Pricing 2026](https://www.swell.is/content/odoo-pricing)
- Conversion approximative en DT (au taux 1 USD ≈ 2,95 DT, 09/2026, non garanti stable) : Standard zone MENA basse ≈ 40 DT/utilisateur/mois (promo) à 50 DT (catalogue) ; Custom ≈ 60 à 75 DT/utilisateur/mois ; Odoo.sh entrée de gamme ≈ 177 DT/mois. *Calcul propre, à vérifier.*
- En Tunisie, le principal frein cité n'est pas le prix de la licence mais **le coût de l'intégration** : « le prix d'Odoo n'est pas un chiffre unique mais une structure comprenant la licence par utilisateur, l'intégration et le support (…) l'intégration est presque toujours le poste principal du budget » — [Shazler.tn — Prix Odoo Tunisie](https://shazler.com/blog/prix-odoo-tunisie)

### Inferences
- La tarification par utilisateur d'Odoo est explicitement décrite par des analystes comme rendant le coût « imprévisible en grandissant » et sujette à une pression commerciale (Success Packs) — c'est un contre-exemple direct utile pour justifier un prix **par société** : une PME tunisienne sait exactement ce qu'elle paiera quel que soit son nombre d'employés qui se connectent.
- Le différentiel régional de prix (jusqu'à 3-5x entre USA et zone MENA basse) montre qu'Odoo pratique déjà une segmentation géographique agressive : un acteur tunisien local n'a donc pas à s'aligner sur un prix « occidental » pour être perçu comme sérieux.

### Gaps
- Impossible d'obtenir le prix catalogue officiel d'odoo.com/pricing directement (domaine bloqué par le proxy réseau de cette session) ; les chiffres ci-dessus viennent d'agrégateurs tiers (Swell, OEC.sh, Mediod) qui peuvent différer légèrement du site officiel au moment de la lecture — à recouper avec odoo.com/pricing avant publication finale.
- Pas de prix officiel en DT trouvé (Odoo ne semble pas facturer directement en dinar tunisien, monnaie non convertible ; probablement facturé en USD ou EUR par les partenaires locaux — à vérifier).

---

## Odoo — partenaires tunisiens et qualité de la localisation

### Takeaway
Odoo dispose d'un écosystème d'intégrateurs tunisiens réels mais de taille modeste (quelques cabinets identifiés, du Silver Partner à quelques dizaines/centaines de clients), et d'une localisation comptable tunisienne (plan de comptes) disponible en standard depuis au moins la version 17 — mais aucune preuve trouvée d'une conformité native et à jour à la facturation électronique TEIF/El Fatoora tunisienne obligatoire depuis le 1er janvier 2026.

### Cited Findings
- **Fogits International** (Sfax/Toulouse), partenaire certifié Odoo en Tunisie depuis 2020 — [Odoo Partners — Fogits International](https://www.odoo.com/partners/fogits-international-sarl-971499)
- **Hadooc**, partenaire officiel avec bureaux en Île-de-France, Tunis et Riyad, clients de 20 à plus de 200 utilisateurs — [Odoo Partners — Hadooc](https://www.odoo.com/partners/hadooc-2388042)
- **SLNEE Tunisie**, filiale d'une société saoudienne — [Odoo Partners — SLNEE Tunisie](https://www.odoo.com/partners/slnee-tunisie-1659010)
- **Shazler**, intégrateur Odoo Silver Partner basé en Tunisie, revendique 136 clients — [Shazler.tn — page d'accueil](https://shazler.com/)
- La localisation comptable tunisienne d'Odoo (17) inclut le plan de comptes tunisien — [Cybrosys — Accounting Localization for Tunisia in Odoo 17](https://www.cybrosys.com/blog/an-overview-of-accounting-localization-for-tunisia-in-odoo-17)
- Côté avis utilisateurs francophones généraux (non spécifiquement tunisiens) : la prise en main est le point faible le plus cité, le logiciel étant décrit comme une « usine à gaz » nécessitant formation et paramétrage — [LeBonLogiciel — Avis Odoo](https://lebonlogiciel.com/organisation-facturation-et-planification-gestion-commerciale-erp-gpao/odoo/avis/247)
- Un intégrateur tunisien affirme qu'« Odoo est la solution ERP la plus déployée dans les PME en Tunisie grâce à sa modularité, son interface en français et son excellent rapport qualité/prix » — [ExpertIT370 — Odoo en Tunisie : combien ça coûte vraiment](https://expertit370.com/erp-gestion-dentreprise/odoo-en-tunisie-combien-ca-coute-vraiment-et-comment-choisir-son-integrateur/) *(affirmation d'un acteur commercial intéressé, à recevoir avec prudence — aucune donnée de part de marché chiffrée trouvée pour la corroborer)*

### Inferences
- L'écosystème de partenaires Odoo en Tunisie reste petit (une poignée de cabinets identifiables), ce qui laisse une fenêtre pour un produit local pensé nativement pour le contexte fiscal tunisien (TEIF, retenue à la source, CNSS) plutôt que « traduit » depuis un cadre généraliste.
- Aucun des partenaires trouvés ne met en avant la conformité TEIF/El Fatoora 2026 sur sa page publique visible dans les résultats — signe possible que la localisation e-facturation tunisienne d'Odoo est encore récente/incomplète, ou simplement que ces pages n'ont pas été mises à jour ; à vérifier directement.

### Gaps
- Pas de chiffre officiel du nombre total de partenaires Odoo certifiés en Tunisie (les pages de répertoire par pays sur odoo.com/partners étaient dans les résultats de recherche mais non consultées en détail, domaine odoo.com bloqué pour le fetch direct dans cette session).
- Aucune donnée trouvée sur le tarif moyen d'une intégration Odoo pour une PME tunisienne en dinars (les sources mentionnent le poste de coût mais pas de fourchette chiffrée fiable).
- Pas de retour d'expérience direct et nommé de PME tunisiennes déçues ou satisfaites d'Odoo (uniquement des généralités et du contenu à but commercial d'intégrateurs).

---

## Ce qui fait le succès d'Odoo et ce que les utilisateurs détestent

### Takeaway
Les avis convergent : Odoo gagne sur la **couverture fonctionnelle et la modularité** (une app gratuite peut suffire, puis on étend), et perd sur **le support post-vente, les coûts cachés et la courbe d'apprentissage** — un triptyque de plaintes qui n'a presque rien à voir avec le prix catalogue lui-même.

### Cited Findings
- Notes globales : G2 4,3/5 (plus de 1 200 avis), Capterra 4,2/5 (plus de 1 300 avis) — [G2 — Odoo ERP Reviews](https://www.g2.com/products/odoo-odoo-erp/reviews)
- Sur 325 avis analysés par G2, la « courbe d'apprentissage » figure dans le top 5 des plaintes (17 mentions), à côté des « réglages cachés et versions déroutantes » (13 mentions) — [G2 — Odoo ERP Pros and Cons](https://www.g2.com/products/odoo-odoo-erp/reviews?qs=pros-and-cons)
- Le support de premier niveau est décrit comme incohérent et lent sauf à payer un support de niveau supérieur ou passer par un partenaire ; un client va jusqu'à qualifier la gestion commerciale et le support post-vente de « pire expérience en presque 50 ans d'activité » — [VentorTech — Why Odoo Works for Thousands but Failed for You](https://ventor.tech/odoo/why-odoo-works-for-thousands-but-failed-for-you/)
- Les coûts cachés proviennent de la pression commerciale (« Success Packs ») et du fait que le prix devient imprévisible en ajoutant modules, utilisateurs ou personnalisation — [VentorTech](https://ventor.tech/odoo/why-odoo-works-for-thousands-but-failed-for-you/)
- Risque cité de personnalisations cassées lors des montées de version — [Fanatics — Odoo reviews](https://www.fanatics.nl/blog/odoo-experiences/) *(synthèse d'agrégateur, à recouper)*

### Inferences
- Trois leçons directement transposables : (1) un prix **prévisible et fixe par société** évite le sentiment de dérive tarifaire reproché à Odoo ; (2) un onboarding guidé et une localisation fiscale native (contrairement à un ERP généraliste « traduit ») réduisent la courbe d'apprentissage perçue ; (3) une politique explicite de compatibilité ascendante des mises à jour (déjà une pratique SkanFact selon le CLAUDE.md du dépôt) répond directement à la plainte n°1 des utilisateurs d'ERP internationaux.

### Gaps
- Pas d'avis Capterra/G2 filtrés spécifiquement « Tunisie » (les plateformes ne permettent pas toujours ce filtre géographique fin) — les plaintes citées sont globales/francophones, pas confirmées comme représentatives du marché tunisien spécifiquement.

---

## Pennylane — le modèle « cabinet et entreprise dans les mêmes données »

### Takeaway
Pennylane est la référence explicitement citée par l'objectif de recherche pour le modèle « entreprise + cabinet comptable dans le même espace de travail en temps réel » : le cabinet équipe son client (le client n'a pas à payer d'abonnement séparé), produit la comptabilité directement sur la plateforme, et le client garde un accès complet à la gestion (facturation, trésorerie) — c'est une architecture à un seul jeu de données partagé, pas un export/import périodique entre deux logiciels.

### Cited Findings
- Modèle d'accès pour les cabinets partenaires : « le cabinet équipe ses dossiers, produit la comptabilité sur la plateforme, et donne au client un accès complet à la gestion » ; chez un cabinet partenaire type (Nexco, partenaire depuis 2022), l'outil est inclus dans les honoraires de tenue de comptes — le client en gestion n'a pas à payer un abonnement Premium séparément — [Cecca — Tarifs Pennylane 2026](https://cecca.fr/blog/expertise-comptable/tarifs-pennylane/) ; [Nexco — Pennylane prix 2026](https://www.nexco-expertise.com/pennylane-prix)
- Côté croissance (validant l'ampleur du modèle) : **800 000 entreprises clientes** et **plus de 6 000 cabinets d'expertise comptable partenaires** revendiqués fin 2025/début 2026 ; nombre d'entreprises clientes multiplié par 3 en 2025 — [Maddyness — Pennylane 175 M€, janvier 2026](https://www.maddyness.com/2026/01/20/pennylane-nouvelle-levee-de-fonds-de-175-millions-deuros-pour-la-licorne-francaise/)
- Chiffre d'affaires annuel récurrent (ARR) 2025 : 115 M€ (statut de « centaure ») ; licorne dès 2024 ; valorisation désormais 3,5 Md€ après une levée de 175 M€ en janvier 2026 (fonds américain TCV, participation de Blackstone Growth), après une précédente levée de 75 M€ en avril 2025 (Meritech Capital Partners, CapitalG) — [Maddyness](https://www.maddyness.com/2026/01/20/pennylane-nouvelle-levee-de-fonds-de-175-millions-deuros-pour-la-licorne-francaise/) ; [Maddyness — levée 75 M€, avril 2025](https://www.maddyness.com/2025/04/07/pennylane-leve-75-millions-deuros-a-lapproche-de-la-reforme-de-la-facturation-electronique/)
- Objectif affiché : atteindre 1 Md€ d'ARR — [Accounting Business Club — Pennylane 175M€ et objectif 1 Md€](https://accountingbusinessclub.com/pennylane-175me-leves-et-objectif-1-milliard-darr-les-confidences-darthur-waller/)
- La levée d'avril 2025 est explicitement motivée par la préparation à la réforme française de la facturation électronique — [Maddyness, avril 2025](https://www.maddyness.com/2025/04/07/pennylane-leve-75-millions-deuros-a-lapproche-de-la-reforme-de-la-facturation-electronique/)

### Inferences
- Le calendrier Pennylane (montée en puissance juste avant/pendant une réforme d'e-facturation nationale obligatoire) est structurellement identique au calendrier tunisien actuel (TEIF/El Fatoora obligatoire depuis le 1er janvier 2026) : c'est un signal fort que **la contrainte réglementaire de facturation électronique est un accélérateur d'adoption**, pas seulement une contrainte de conformité — un argument pour positionner SkanFact/le Cabinet comme la solution de mise en conformité plutôt que comme un outil de gestion parmi d'autres.
- Le fait que Pennylane ne facture (dans ce modèle) que le cabinet, qui répercute dans ses honoraires, et non l'entreprise cliente directement, est cohérent avec la direction déjà prise par SkanFact Cabinet (gratuit pour les dossiers SkanFact et jusqu'à trois dossiers hors SkanFact, payant au-delà, jamais de commission au comptable) — la validation externe de ce modèle (multiplication par 3 du nombre de clients en un an) est un signal positif fort pour la stratégie « distribution par les cabinets comptables ».

### Gaps
- Le prix exact facturé aux cabinets pour la tenue de comptes elle-même (l'abonnement « back-office » du cabinet, distinct des plans individuels 0-79 €) n'a pas pu être obtenu : les pages officielles Pennylane et plusieurs agrégateurs (impli.fr, cecca.fr) étaient bloquées au fetch direct dans cette session (proxy réseau) ; seuls des résumés de résultats de recherche ont pu être exploités.
- Pas de détail technique trouvé sur le mécanisme exact de synchronisation temps réel (base de données partagée unique vs API bidirectionnelle) entre l'espace du cabinet et celui du client — à creuser si le temps le permet, car c'est la question technique centrale pour répliquer ce modèle dans SkanFact Cabinet.

---

## Pennylane — tarifs (entreprises individuelles)

### Takeaway
Pennylane pratique une tarification **par société** (pas par utilisateur) échelonnée de gratuit (micro-entreprise) à 79 €HT/mois, avec un plan haut de gamme qui inclut explicitement un « accès multi-utilisateurs illimité » — exactement le contre-modèle de la facturation par utilisateur.

### Cited Findings
- Gratuit pour les micro-entreprises (jusqu'à 1 200 factures/an selon une source) ; **Starter** 7 €HT/mois (1 utilisateur, jusqu'à 1 200 factures/an) ; **Basique** 14 €HT/mois ; **Essentiel** 24 €HT/mois (pilotage des encaissements, relances automatiques, tableaux de bord) ; **Premium** 79 €HT/mois (comptabilité et facturation centralisées, accès multi-utilisateurs illimité) — [Impli.fr — Tarifs Pennylane 2026](https://www.impli.fr/post/pennylane-tarif) ; [Comparateur e-Facturation — Pennylane Tarifs 2026](https://comparateur-efacturation.fr/blog/pennylane-avis-tarifs-test-complet-2026)
- Module comptabilité optionnel en supplément du plan collaboratif : 50 €HT/mois (20 €HT pour certaines SCI/LMNP) — [WebSearch synthèse, source Nexco/Cecca](https://www.nexco-expertise.com/pennylane-prix)
- Sans engagement, résiliable à tout moment, 15 jours d'essai gratuit ; le tarif mensuel sans engagement est environ 20 % plus cher que l'annuel — [Impli.fr](https://www.impli.fr/post/pennylane-tarif)
- Conversion approximative en DT (1 EUR ≈ 3,38 DT) : Starter ≈ 24 DT/mois ; Basique ≈ 47 DT/mois ; Essentiel ≈ 81 DT/mois ; Premium ≈ 267 DT/mois. *Calcul propre, à vérifier.*

### Inferences
- La gratuité pour le premier palier (micro-entreprise) combinée à un prix plafonné à 79 €/mois même avec utilisateurs illimités montre que Pennylane a choisi de monétiser la **valeur perçue** (comptabilité + facturation intégrées) plutôt que le nombre de connexions — cohérent avec une approche « prix par société » pour SkanFact.

### Gaps
- Chiffres légèrement divergents entre sources sur le tarif d'entrée exact (7 € vs 14 € selon les pages) — signe possible de changements de grille tarifaire fréquents ou de confusion entre l'offre « facturation seule » et l'offre « facturation + compta » ; à vérifier sur la page officielle pennylane.com au moment de la rédaction du rapport final.

---

## Tarification par entreprise vs par utilisateur — comparaison transversale

### Takeaway
Le marché est clairement scindé en deux familles : les éditeurs **d'origine « suite bureautique/ERP »** (Odoo, Zoho, QuickBooks, Sage) facturent par utilisateur (ou par palier avec un quota d'utilisateurs inclus, au-delà duquel on paie), tandis que les éditeurs **nés autour de la facturation/comptabilité pour PME** (Pennylane, Zoho Books en version « organisation », les acteurs golfiens Daftra/Qoyod) tendent vers un prix **par société/organisation**, avec le nombre d'utilisateurs traité comme un simple curseur de capacité, pas comme l'unité de facturation.

### Cited Findings
- **Zoho Books** facture explicitement « par organisation, par mois » : gratuit (sous 50 000 $ de revenu annuel, 1 utilisateur) jusqu'à Ultimate à 275 $/mois ; chaque palier inclut un nombre d'utilisateurs (3 en Standard, 5 en Professional, 10 en Premium) et un utilisateur supplémentaire coûte 2,50-3 $/mois — donc un modèle **hybride** : prix de base par société, avec un supplément par utilisateur au-delà d'un quota — [Capterra — Zoho Books Pricing 2026](https://www.capterra.com/p/163115/Zoho-Books/pricing/) ; [Stackscored — Zoho Books Pricing 2026](https://www.stackscored.com/blog/zoho-books-pricing-2026/)
- **Zoho One** (la suite complète, 45+ apps), à l'inverse, est strictement par personne : soit 37 $/employé/mois (tous les salariés doivent être licenciés — plan « All Employee »), soit 90 $/utilisateur actif/mois (plan « Flexible », seuls ceux qui utilisent réellement la suite) — [Aaxonix — Zoho One Pricing 2026](https://aaxonix.com/resources/zoho-one-pricing-explained/)
- **QuickBooks Online** facture par palier de société (Simple Start 38 $/mois, Essentials 75 $/mois, Plus 115 $/mois, Advanced 275 $/mois, prix US août 2026) avec un nombre d'utilisateurs inclus qui augmente par palier, mais sans supplément explicite par utilisateur trouvé dans les paliers standards — [Dancing Numbers — QuickBooks Online Pricing 2026](https://www.dancingnumbers.com/how-much-is-quickbooks-online-per-month/)
- **Daftra** (Arabie saoudite) : trois offres, Advanced à 270 SAR/mois et Unlimited à 350 SAR/mois (≈ 213 et 276 DT/mois au taux dérivé 1 SAR ≈ 0,79 DT), « Business » sur devis ; le modèle semble être par compte/entreprise avec toutes les apps incluses plutôt que par utilisateur — [Daftra — Plans](https://www.daftra.com/en/plans)
- **Qoyod** (Arabie saoudite) : Basique 1 380 SAR/an (≈ 115 SAR/mois ≈ 91 DT/mois) pour 1 utilisateur/1 site ; Pro 2 070 SAR/an (≈ 173 SAR/mois ≈ 136 DT/mois) pour 3 utilisateurs/3 sites ; utilisateur supplémentaire 20 SAR/mois (≈ 16 DT), site supplémentaire 40 SAR/mois (≈ 32 DT), module paie 10 SAR/employé/mois (≈ 8 DT), module POS 50 SAR/utilisateur/mois (≈ 40 DT) — donc un modèle **par société avec un quota d'utilisateurs/sites inclus**, puis add-ons à l'utilisateur ou au module — [Qoyod Help Center — Pricing Plans](https://www.qoyod.com/en/knowledge-base/qoyod-pricing-plans-features-pricing-limits-how-to-choose-an/)
- **Wafeq** : à l'inverse, explicitement **par utilisateur** — 19 $/utilisateur/mois (facturation simple), 29 $/utilisateur/mois (facturation + conformité ZATCA Phase 2), 69 $/utilisateur/mois (comptabilité complète) — [WeSuggestSoftware — Wafeq pricing](https://www.wesuggestsoftware.com/accounting-finance/wafeq/)

### Inferences
- Il n'existe pas de convergence unique du marché : le facteur déterminant semble être la **cible** plutôt que la géographie — les produits pensés pour une PME unipersonnelle/TPE (Pennylane, Zoho Books en entrée de gamme, Daftra, Qoyod) tarifient par société parce que l'acheteur raisonne en « combien pour faire tourner mon activité », tandis que les produits pensés pour des équipes multi-métiers qui collaborent en continu dans l'outil (Zoho One, Wafeq côté comptabilité complète) reviennent à l'utilisateur parce que la valeur perçue croît avec le nombre de personnes connectées simultanément.
- Pour SkanFact (facturation/gestion/compta d'une PME généralement mono-utilisateur ou à très peu d'utilisateurs simultanés en Tunisie), le prix par société est cohérent avec la pratique dominante des acteurs comparables les plus proches de la cible (Pennylane, Daftra, Qoyod) plutôt qu'avec celle des suites collaboratives lourdes (Zoho One, Wafeq).
- Le modèle « hybride » de Zoho Books et Qoyod (prix de base par société + add-on par utilisateur au-delà d'un quota) est un compromis à considérer : il garde la prévisibilité d'un prix de base fixe tout en captant la valeur d'un cabinet comptable qui ajoute des collaborateurs (pertinent pour SkanFact Cabinet, où la 9.9.0 a justement ajouté le multi-collaborateur sans sur-tarification par poste).

### Gaps
- Pas de données trouvées sur la satisfaction comparée des acheteurs selon le modèle de tarification (par société vs par utilisateur) — aucune étude ou sondage direct identifié sur ce point précis pendant cette recherche.
- QuickBooks : pas de confirmation trouvée sur l'existence ou non d'un supplément par utilisateur au-delà du quota inclus dans chaque palier (les sources consultées ne le mentionnent pas explicitement, ce qui peut signifier soit son absence, soit une lacune de la recherche).

---

## QuickBooks Online et Sage Business Cloud — repères de tarification

### Takeaway
Les deux acteurs anglo-saxons historiques confirment une tarification par palier de société avec quota d'utilisateurs croissant, sans module « compta cabinet partagée » aussi abouti que Pennylane, et avec la paie systématiquement vendue en add-on séparé.

### Cited Findings
- QuickBooks Online (prix US, août 2026) : Free 0 $ (1 utilisateur, 2 factures/mois) ; Solopreneur 20 $/mois ; Simple Start 38 $/mois ; Essentials 75 $/mois ; Plus 115 $/mois ; Advanced 275 $/mois (le palier Advanced inclut désormais Workforce Elite paie et Bill Pay Elite) — [Dancing Numbers — QuickBooks Online Pricing 2026](https://www.dancingnumbers.com/how-much-is-quickbooks-online-per-month/)
- QuickBooks offre généralement une remise de 90 % les 3 premiers mois ou un essai gratuit de 30 jours ; la paie reste un module séparé payant — [Dancing Numbers](https://www.dancingnumbers.com/how-much-is-quickbooks-online-per-month/)
- Sage Business Cloud Accounting : entrée de gamme dès 10-25 $/utilisateur/mois selon la source ; gamme desktop complète annuelle ≈ 117,75 $/mois (Pro, 1 utilisateur), 162,25 $/mois (Premium, jusqu'à 5 utilisateurs), 236,75 $/mois (Quantum, jusqu'à 40 utilisateurs), avec des tarifs plus élevés en paiement mensuel (128,67 $ / 182,50 $ / 271,17 $) — [ComparEdge — Sage Accounting Pricing 2026](https://comparedge.com/tools/sage/pricing)
- La paie Sage est une souscription séparée tarifée au nombre d'employés, communiquée uniquement par téléphone (pas de prix public) — [Business.org — Sage Business Cloud Accounting Review 2026](https://www.business.org/finance/accounting/sage-business-cloud-review/)

### Inferences
- Le fait que même des acteurs matures (Sage) refusent d'afficher publiquement le prix de leur module paie (devis téléphonique) suggère que la paie reste perçue comme un produit à forte valeur ajoutée/complexité justifiant une vente assistée — une piste pour la stratégie commerciale d'un module paie SkanFact déjà existant (5.0.0) plutôt qu'un signal qu'il faille le masquer.

### Gaps
- Pas de prix Sage ou QuickBooks localisé pour le Maghreb/MENA trouvé (ces produits ne semblent pas avoir de tarification régionale publique comme Odoo) — probablement peu ou pas commercialisés directement en Tunisie ; à vérifier séparément si pertinent.

---

## Concurrents MENA directs — Daftra, Qoyod, Wafeq : fonctionnalités et conformité e-invoicing

### Takeaway
Les trois acteurs golfiens ciblent la même contrainte réglementaire que la Tunisie affronte en 2026 (facturation électronique obligatoire avec un identifiant fiscal-plateforme officiel — ZATCA/Fatoora côté Arabie saoudite, TTN/El Fatoora côté Tunisie), et ont fait de la conformité **incluse dans l'abonnement standard, sans surcoût par facture**, un argument de vente explicite — un point de comparaison direct et immédiat pour SkanFact 10.15.0 (module TEIF).

### Cited Findings
- Daftra est accrédité par les autorités fiscales en Arabie saoudite et en Égypte, et s'intègre aux systèmes fiscaux locaux (dont l'autorité fiscale égyptienne pour l'émission de factures certifiées) — [Daftra — Best accounting software in Egypt](https://www.daftra.com/en/hub/best-accounting-software-in-egypt) ; [Daftra — Best Electronic Invoice Software in KSA](https://www.daftra.com/en/electronic-invoice-ksa/)
- Qoyod couvre ZATCA Phase 1 **et** Phase 2 avec intégration API directe à la plateforme Fatoora, tampon cryptographique (cryptographic stamping) et génération de QR code inclus dans l'abonnement standard — « sans frais de mise en place, sans frais d'intégration ZATCA, sans surcoût par facture » — [Qoyod Help Center — Pricing Plans Features](https://www.qoyod.com/en/knowledge-base/qoyod-pricing-plans-features-pricing-limits-how-to-choose-an/)
- Wafeq est approuvé ZATCA pour l'e-invoicing en Arabie saoudite et conforme à la réglementation de la Federal Tax Authority des Émirats arabes unis ; génère les factures en XML et PDF/A-3 conformes aux exigences structurées de ZATCA, avec une API REST moderne pour s'intégrer à n'importe quel ERP — [Wafeq — Best Accounting Software Trusted by ZATCA for Phase 2](https://www.wafeq.com/en/business-hub/for-business/best-accounting-software-trusted-by-zatca-and-compliant-for-phase-2-e-invoicing) ; [Wafeq — ZATCA e-invoicing Phase 2](https://www.wafeq.com/en-sa/zatca-e-invoicing-phase-2)
- Wafeq se positionne explicitement contre Daftra comme alternative « conçue pour l'Arabie saoudite et les Émirats », suggérant que Daftra est perçu par un concurrent comme moins spécialisé sur ces deux marchés précis — [Wafeq — Wafeq vs Daftra](https://www.wafeq.com/en-kw/wafeq-vs-daftra)

### Inferences
- Les trois acteurs traitent la conformité à la facturation électronique comme une fonctionnalité **de base incluse**, jamais comme un module payant à part — c'est directement transposable comme argument marketing pour SkanFact 10.15.0 (module TEIF déjà livré, non-signature/non-dépôt assumé) : le marché MENA comparable ne facture pas la conformité réglementaire séparément.
- Le positionnement de Wafeq (comptabilité complète à 69 $/utilisateur/mois, très au-dessus du reste de sa propre gamme) suggère que le marché golfien accepte de payer significativement plus pour un module comptable complet vs une simple facturation — cohérent avec la stratégie SkanFact où la comptabilité (module `compta`) est l'option payante distincte de la facturation/gestion.

### Gaps
- Aucune information trouvée sur le support linguistique arabe/français de Daftra, Qoyod et Wafeq (langues d'interface disponibles) — question posée explicitement dans l'objectif mais non documentée dans les sources consultées ; à creuser séparément (probable arabe/anglais pour les trois, français non confirmé, ce qui serait un point de différenciation fort pour la Tunisie francophone si avéré).
- Pas de chiffres d'adoption (nombre de clients, part de marché) trouvés pour Daftra, Qoyod ou Wafeq.
- Pas d'équivalent marocain ou algérien « national » comparable identifié avec certitude : les résultats de recherche pointent surtout vers des déploiements locaux d'Odoo (marché marocain, PCGE intégré nativement avec 5 taux de TVA et positions fiscales préconfigurées — [Oasis Techno Cloud — Logiciel Comptabilité Maroc 2026](https://oasistechnocloud.com/blog/logiciel-comptabilite-maroc/)) et de Dolibarr (open source, PCGE non natif, module tiers nécessaire — même source), et vers des acteurs algériens de niche peu documentés (Buyini, Almawarid.app — conformité à la loi 18-07 et au décret 05-468 sur la facturation électronique algérienne selon leur propre communication, non vérifiée par une source tierce) — [Buyini blog — Top 10 fournisseurs Cloud Algérie](https://buyini.com/blog/top-10-fournisseurs-cloud-algerie) ; [Almawarid — Logiciel de Gestion Algérie](https://almawarid.app/blog/logiciel-de-gestion-algerie-erp/). Ces affirmations proviennent des éditeurs eux-mêmes et n'ont pas été recoupées par une source indépendante.

---

## Contexte tunisien direct — acteurs locaux de facturation électronique (hors périmètre strict mais très pertinent)

### Takeaway
Bien que non explicitement demandés dans l'objectif, plusieurs acteurs SaaS tunisiens (Hesabi, Swiver, Finco, eFactureTN) sont apparus spontanément dans la recherche comme concurrents directs positionnés spécifiquement sur la conformité TEIF/El Fatoora — ce sont probablement les concurrents locaux les plus immédiats de SkanFact sur le segment PME, à approfondir séparément.

### Cited Findings
- L'obligation de facturation électronique via la plateforme TTN El Fatoora (format TEIF XML) s'applique à toute entreprise assujettie à la TVA depuis le 1er janvier 2026, en application de l'article 53 de la loi de finances 2026, sans période de grâce légale — [Hesabi — Facturation électronique obligatoire en Tunisie 2026](https://hesabi.tn/actualites/facturation-electronique-obligatoire-tunisie-2026)
- Sanctions : amende de 100 à 500 DT par document non conforme émis en papier après le 31/12/2025, plafonnée à 50 000 DT/an — [Hesabi](https://hesabi.tn/actualites/facturation-electronique-obligatoire-tunisie-2026)
- Coût de base côté plateforme TTN : 0,190 DT par facture plus 10 DT/mois d'abonnement, hors signature électronique — [Hesabi](https://hesabi.tn/actualites/facturation-electronique-obligatoire-tunisie-2026)
- Solutions SaaS tunisiennes citées comme centralisant la facturation TEIF et permettant à l'expert-comptable d'accéder au dossier client en temps réel : **Hesabi, Swiver, Finco** — [Hesabi — même article](https://hesabi.tn/actualites/facturation-electronique-obligatoire-tunisie-2026)

### Inferences
- La mention explicite, par un concurrent tunisien lui-même (Hesabi), de l'accès en temps réel de l'expert-comptable au dossier client comme argument de vente confirme que **le modèle Pennylane (cabinet + client dans les mêmes données) est déjà identifié comme un standard attendu par le marché tunisien**, pas seulement une hypothèse théorique — renforce la pertinence du chantier `PLAN-CABINET.md` / `PLAN-COMPTABLE.md` déjà engagé dans SkanFact.

### Gaps
- Aucune donnée de tarification trouvée pour Hesabi, Swiver ou Finco (hors périmètre de cette recherche, à couvrir par un chercheur dédié au paysage concurrentiel tunisien direct si ce n'est pas déjà fait par un autre volet de l'étude).

---

## Note méthodologique sur les limites de cette recherche

Plusieurs domaines sources ont été bloqués par le proxy d'accès réseau de cette session lors des tentatives de récupération de page complète (WebFetch) : `www.odoo.com`, `oec.sh`, `www.impli.fr`, `cecca.fr`. Toutes les données issues de ces domaines dans ce dossier proviennent donc de résumés de résultats de recherche (snippets), pas d'une lecture directe et complète de la page — une vérification manuelle des pages de tarification officielles (odoo.com/pricing, pennylane.com/tarifs) est recommandée avant toute utilisation commerciale ou contractuelle des chiffres cités ici.
