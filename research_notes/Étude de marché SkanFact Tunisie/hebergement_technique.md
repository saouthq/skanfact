# Infrastructure technique et environnement pour un SaaS de gestion en Tunisie

*Recherche arrêtée à septembre 2026. Toutes les dates de sources sont indiquées ; les prix sont datés quand disponibles.*

## Hébergement en Tunisie : data centers, cloud providers, niveaux Tier, prix, comparaison avec l'étranger

### Takeaway
La Tunisie dispose d'une offre d'hébergement locale réelle mais fragmentée : un data center Tier III de référence (EO Data Center, Enfidha), l'opérateur historique ATI (data centers Belvédère/La Kasba/Mutuelle Ville, tous ISO 27001), les trois opérateurs télécoms (Tunisie Telecom, Orange, Ooredoo) qui vendent du cloud/hosting, et plusieurs hébergeurs commerciaux low-cost (NovaHoster, Oxahost, Zenhosting) dont les tarifs sont connus mais dont la qualité "production-grade" (Kubernetes managé, PostgreSQL managé) n'est **pas démontrée** dans les sources trouvées — ce service semble simplement absent du marché tunisien actuel, contrairement à OVH/Hetzner/AWS/Azure qui l'offrent en Europe à des latences correctes depuis la Tunisie (Marseille en particulier). La loi 2004-63 encadre strictement, et rend risqué juridiquement, le transfert de données personnelles vers l'étranger sans autorisation préalable de l'INPDP — un vrai facteur pour la décision d'hébergement d'un SaaS tunisien traitant des données de PME tunisiennes (comptabilité, clients).

### Cited Findings

**EO Data Center (Enfidha, Sousse)**
- Premier data center "cloud souverain" et opérateur neutre (carrier-neutral) de Tunisie, fondé en 2011, situé en zone industrielle Enfidha II (Sousse) ; anciennement Meninx Technologies. — [EO Data Center](https://www.eodatacenter.com/) ; [DeepLearn Academy](https://deeplearn.tn/data-center-enfidha/)
- Infrastructure conçue selon le standard **Tier III**, redondance N+1 des systèmes électriques et de refroidissement ; SLA contractuel de disponibilité annoncé à 99,9 % (une source cite 99,982 %). — [Datacentermap](https://www.datacentermap.com/tunisia/sousse/eodatacenter/) ; [data-centre.tn](https://data-centre.tn/)
- Salle initiale de 250 m², extensible jusqu'à 1 000 m². — [Datacentermap](https://www.datacentermap.com/tunisia/sousse/eodatacenter/)
- Offre : colocation, location de serveurs dédiés, VPS Cloud managé, BaaS (sauvegarde cloud), DRaaS (plan de continuité d'activité). Certifié **ISO 27001**, labels NCloud et FSI (G-Cloud). — [EO Data Center](https://www.eodatacenter.com/) ; [data-centre.tn](https://data-centre.tn/)
- Partenariat annoncé entre Orange Tunisie et EO Data Center. — [Telecompaper](https://www.telecompaper.com/news/orange-tunisia-eo-data-center-form-partnership--1075508)
- Partenariat EO Data Center / Oxabox pour l'hébergement de données. — [THD](https://www.thd.tn/hebergement-de-donnees-partenariat-entre-eo-data-center-et-oxabox/)
- Le client peut combiner la connectivité de tous les grands opérateurs tunisiens (Tunisie Telecom, Orange, Ooredoo, ATI) sur le site. — résultat de recherche agrégé, [EO Data Center](https://www.eodatacenter.com/)
- **Gap prix** : aucun tarif DT/mois précis trouvé pour serveurs dédiés ou VPS EO Data Center malgré recherche ciblée ; le site ne publie que des demandes de devis. — [eodatacenter.com/serveur-dedie-tunisie](https://www.eodatacenter.com/serveur-dedie-tunisie)

**ATI (Agence Tunisienne d'Internet / Tunisia Internet Agency)**
- Fournisseur d'accès internet historique, plus de 26 ans d'activité ; acteur majeur de l'hébergement, de l'infogérance et du SaaS en Tunisie. — [ATI](https://www.ati.tn/a-propos/)
- Trois data centers propres : **Belvédère, La Kasba, Mutuelle Ville**, tous certifiés **ISO/IEC 27001:2013**. — [ATI hosting mutualisé](https://www.ati.tn/hosting-mutualise/) ; [ATI housing](https://www.ati.tn/housing/)
- Offre cloud privé IaaS/VDC en plus de l'hébergement mutualisé et du housing. — [ATI cloud privé](https://www.ati.tn/cloud-prive/)
- Gère en parallèle le point d'échange internet national **TUNIXP**, les passerelles de messagerie des FAI, le nom de domaine **.tn**, et l'adressage IP national — rôle d'infrastructure critique, pas seulement d'hébergeur commercial. — [ATI](https://www.ati.tn/)
- **Gap prix** : pas de grille tarifaire précise trouvée (le site annonce des coûts "adaptés à tous les budgets" sans chiffres).

**Tunisie Telecom (TT Cloud / Data Center Carthage)**
- Propose des offres cloud packagées ou sur-mesure via un portail dédié (cloud.tunisietelecom.tn), hébergées dans les data centers propres de Tunisie Telecom. — [Tuniscope](https://www.tuniscope.com/article/71874/tech/telephone/tt-cloud-290117) ; [TT Cloud](http://cloud.tunisietelecom.tn/)
- Son **Data Center Carthage** est certifié **ISO 27001** (sécurité de l'information), **ISO 27701** (vie privée) et **ISO 9001** (qualité). — [Tustex](https://www.tustex.com/communiques-de-presse/tunisie-telecom-certifie-son-data-center-carthage-selon-les-normes-iso-27001-27701-et-9001)
- **Gap prix** : la page tarifs officielle existe (tunisietelecom.tn/Fr/Entreprise-Site/Pages/Cloud-Tarifs.aspx) mais son contenu chiffré n'a pas pu être extrait par la recherche.

**Orange Tunisie (Business)**
- A inauguré un data center à Kalaa Kebira (Sousse), qualité **Tier III**, 1 000 m², qui sert à la fois les besoins internes d'Orange et ceux de ses clients entreprises (cloud, sauvegarde, continuité d'activité), en environnement géré localement. — [DatacenterDynamics](https://www.datacenterdynamics.com/en/news/orange-launches-data-center-outside-sousse-tunisia/)

**Ooredoo Business**
- A lancé le premier portail SaaS dédié aux entreprises tunisiennes (ooredoocloud.tn), 100 % dédié aux PME souhaitant exploiter des solutions logicielles professionnelles en mode abonnement. — [THD](https://www.thd.tn/ooredoo-business-etend-ses-offres-cloud-en-lancant-le-premier-portail-saas-pour-les-entreprises/)

**Hébergeurs commerciaux low-cost (offre "PME")**
- **NovaHoster** : hébergement web dès **99 DT/an** ; serveurs dédiés dès **47,9 DT/mois** (53 configurations, infogérance incluse). — [NovaHoster](https://www.novahoster.tn/) ; [NovaHoster serveur dédié](https://www.novahoster.tn/serveur-dedie-tunisie/)
- **Oxahost** : formules VPS dès **18 DT/mois**, datacenter à Tunis, disponibilité annoncée 99,9 %, support 24/7, SSL gratuit ; pas d'engagement de durée sur les VPS, tarif dégressif au paiement semestriel/annuel. — [Oxahost](https://www.oxahost.tn/serveur/cloud-vps)
- **Zenhosting** : hébergement mutualisé historiquement dès ~3,86 TND/mois (plan H-économique à 46,32 TND/an + frais d'installation) ; propose aussi du VPS cloud configurable (CPU/RAM/disque). Une source de comparatif la qualifie cependant d'**entreprise tunisienne aujourd'hui probablement inactive** malgré un site toujours accessible — à vérifier avant toute recommandation. — [Zenhosting](https://www.zenhosting.tn/serveurs-vps-tunisie/) ; [Whtop review](https://www.whtop.com/review/zenhosting.tn)

**Managed PostgreSQL / Kubernetes en Tunisie**
- Aucune source trouvée n'indique qu'un des acteurs tunisiens (EO Data Center, ATI, Tunisie Telecom, Ooredoo, Orange, NovaHoster, Oxahost, Zenhosting) propose un service **PostgreSQL managé** ou **Kubernetes managé** en marque blanche/self-service comparable à AWS RDS, Google Cloud SQL ou aux offres Kubernetes gérées occidentales. Les offres identifiées sont du IaaS classique (VPS, serveur dédié, colocation) — [multiples sources ci-dessus]
- À titre de référence de ce qui existe hors Tunisie : Google Cloud SQL for PostgreSQL annonce plus de 99,95 % de disponibilité en gestion automatisée (sauvegardes, réplication, chiffrement, patchs). — [Google Cloud](https://cloud.google.com/sql/postgresql)

**Comparaison avec OVH / Hetzner / AWS / Azure et latence depuis la Tunisie**
- Pour les connexions tunisiennes, **OVH Marseille est notée comme particulièrement adaptée**, le trafic passant habituellement par Paris sauf exception notable pour la Tunisie (routage direct/optimisé vers Marseille). — synthèse de résultats, [LowEndTalk](https://lowendtalk.com/discussion/209552/ovh-vps-adds-new-regions-in-europe-and-the-us/p3)
- OVHcloud gère plusieurs régions 1-AZ (Roubaix, Gravelines, Francfort, Beauharnois) et une région 3-AZ à Paris. — [OVHcloud datacenters](https://www.ovhcloud.com/en/datacenter/)
- Hetzner dispose de data centers à Falkenstein, Nuremberg, Helsinki, Ashburn, Hillsboro ; les data centers allemands offrent une bonne connectivité pan-européenne. — synthèse, [Hetzner ping test](https://pingtestlive.com/hetzner-ping)
- **Gap chiffres** : aucune mesure de latence chiffrée (ms) Tunisie→Marseille/Paris/Francfort n'a été trouvée dans les sources accessibles ; seule l'indication qualitative "Marseille est bon pour la Tunisie" a été identifiée.

**Cadre légal : transfert de données personnelles hors de Tunisie**
- La **loi organique n° 2004-63 du 27 juillet 2004** relative à la protection des données à caractère personnel est le texte fondateur (comparable au RGPD dans son esprit), sous supervision de l'**INPDP** (Instance Nationale de Protection des Données Personnelles). — [DPO Consulting](https://www.dpo-consulting.com/fr-fr/blog/loi-tunisienne-sur-la-protection-des-donnees) ; [Legislation-securite.tn](https://legislation-securite.tn/latest-laws/loi-organique-n-2004-63-du-27-juillet-2004-portant-sur-la-protection-des-donnees-a-caractere-personnel/)
- Les transferts de données vers l'étranger sont strictement encadrés par les **articles 47 et 50-52** de la loi 2004-63 : consentement écrit, protection adéquate dans le pays destinataire, et **autorisation préalable de l'INPDP** requise. — [web6.tn](https://web6.tn/blog/protection-donnees-personnelles-tunisie-inpdp/)
- Il est **interdit en toutes circonstances** de communiquer/transférer des données personnelles vers un pays étranger si cela est susceptible de nuire à la sécurité publique ou aux intérêts vitaux de la Tunisie. — [web6.tn](https://web6.tn/blog/protection-donnees-personnelles-tunisie-inpdp/)
- Tout responsable de traitement doit accomplir des formalités préalables auprès de l'INPDP avant tout traitement de données personnelles ; une demande d'autorisation spécifique est requise en cas de transfert à l'étranger. — [web6.tn](https://web6.tn/blog/protection-donnees-personnelles-tunisie-inpdp/)
- Cas concret : l'INPDP a instruit une plainte contre une société d'hébergement/cloud computing accusée d'avoir transféré illégalement des données de clients à l'étranger sans autorisation ni consentement — un précédent qui illustre le risque réel encouru par un hébergeur/SaaS qui externaliserait des données de PME tunisiennes sans procédure INPDP. Un article évoque même une peine encourue d'un an de prison dans une affaire visant OVH. — [Leaders.com.tn](https://www.leaders.com.tn/article/22871-protection-des-donnees-personnelles-ovh-encoure-un-an-de-prison)

### Inferences
- Pour un SaaS comptable/facturation destiné aux PME tunisiennes (données fiscales, clients, employés), **héberger hors de Tunisie sans autorisation INPDP est un risque juridique réel et documenté** (précédent contre un hébergeur), pas théorique — ce facteur pèse plus lourd que la seule latence ou le seul prix dans le choix d'hébergement.
- L'absence de managed PostgreSQL/Kubernetes en Tunisie signifie que si SkanFact (ou tout SaaS comparable) veut héberger en Tunisie pour des raisons légales/souveraineté, il devra probablement gérer lui-même une base PostgreSQL sur du VPS/serveur dédié (EO Data Center Tier III, ATI, ou Tunisie Telecom), ce qui est un travail d'exploitation supplémentaire (DBA) comparé à un service géré européen — un arbitrage coût opérationnel vs conformité légale à trancher explicitement.
- EO Data Center (Tier III, ISO 27001, multi-opérateur) apparaît comme le candidat le plus "production-grade" identifié en Tunisie ; à défaut de prix publics, un devis direct est nécessaire avant toute décision budgétaire.
- Le flou sur la vitalité de Zenhosting (possiblement inactif) suggère de privilégier NovaHoster, Oxahost ou EO Data Center/ATI/Tunisie Telecom pour un service en production, et de revérifier l'état commercial de tout acteur avant contractualisation.

### Gaps
- Aucun prix DT/mois précis trouvé pour EO Data Center (serveur dédié, VPS managé, colocation) ni pour Tunisie Telecom Cloud, ni pour ATI — devis direct nécessaire.
- Aucune confirmation qu'un acteur tunisien propose du Kubernetes managé ou du PostgreSQL managé en libre-service ; probable absence pure et simple de ce type d'offre sur le marché local en 2026.
- Aucune mesure chiffrée de latence (ms) Tunisie ↔ Marseille/Paris/Francfort/région Middle East AWS (Bahreïn/UAE) trouvée ; seule une indication qualitative sur OVH Marseille.
- Pas de comparaison de prix directe DT vs EUR entre offres tunisiennes et OVH/Hetzner pour une configuration équivalente (ex. VPS 2 vCPU/4 Go).
- Pas de détail sur les offres de sauvegarde (fréquence, rétention, coût) des hébergeurs tunisiens au-delà de la mention générale "BaaS" d'EO Data Center.
- Le statut précis d'Ooredoo Cloud / Orange Business Tunisia en tant qu'hébergeur d'IaaS pur (vs uniquement SaaS/portail) reste flou — nécessiterait une vérification directe sur leurs sites.

---

## Fiabilité internet pour les PME tunisiennes : coupures, couverture fixe vs 4G/5G, bande passante — justification du mode hors ligne

### Takeaway
La connectivité tunisienne en 2026 reste marquée par des coupures récurrentes et des ralentissements largement documentés dans la presse locale, avec un déploiement 5G réel depuis février 2025 mais une couverture encore partielle (35 % de la population en zone théorique mi-2026, 18 % d'abonnés actifs) et un impact négatif mesuré sur les débits 4G résiduels — ce qui **confirme objectivement la nécessité d'un mode hors ligne robuste** pour toute application métier destinée aux PME tunisiennes, cohérent avec le choix déjà fait par SkanFact (stockage JSON local, sync manuelle par fichier).

### Cited Findings
- En 2026, la Tunisie continue de connaître des débits internet lents, des coupures répétées et des connexions instables — plainte largement répandue chez les usagers. — [La Presse de Tunisie, avril 2026](https://www.lapresse.tn/2026/04/09/internet-en-tunisie-pannes-lenteurs-coupures-mais-des-factures-toujours-a-lheure/)
- En mai 2026, le gouvernorat d'Ariana (El Ghazela, Raoued, Ennasr) a connu des coupures réseau soudaines chez Tunisie Telecom, causées par des travaux non coordonnés d'un opérateur privé concurrent. — [THD](https://www.thd.tn/ariana-des-coupures-de-reseau-chez-tunisie-telecom-suite-a-des-travaux-non-coordonnes-dun-operateur-prive/)
- En cas de panne, le parcours client est lourd : contact du service client, communication du numéro, attente d'un rappel, nécessité d'être présent pour la visite technique — sinon délai supplémentaire d'une à deux semaines pour un nouveau rendez-vous. — [La Presse de Tunisie, avril 2026](https://www.lapresse.tn/2026/04/09/internet-en-tunisie-pannes-lenteurs-coupures-mais-des-factures-toujours-a-lheure/)
- Perturbation signalée d'une semaine de la connexion internet en Tunisie (source Agence Ecofin, sans date précise dans le résumé — à recouper). — [Agence Ecofin](https://www.agenceecofin.com/internet/0409-13366-tunisie-perturbation-de-la-connexion-internet-depuis-une-semaine)
- La donnée de débit ADSL moyen la plus spécifique trouvée (200 Kb/s par abonné) date de **2017** et n'est plus représentative de 2026 — aucune statistique de débit fixe moyen actuelle et fiable n'a été localisée. — synthèse de recherche
- **5G** : lancement commercial officiel le **14 février 2025** par les trois opérateurs (Tunisie Telecom, Orange Tunisie, Ooredoo Tunisia), après obtention des licences fin novembre 2024 (licences de 15 ans, 5 MHz dupliqués en bande 700 MHz + 100 MHz TDD en bande 3,5 GHz). — [TechAfrica News](https://techafricanews.com/2025/02/17/ooredoo-orange-tunisie-telecom-officially-bring-5g-to-tunisia/) ; [Developing Telecoms](https://developingtelecoms.com/telecom-technology/wireless-networks/18000-orange-tunisia-ooredoo-tunisia-and-tunisie-telecom-launch-5g.html)
- Couverture 5G (données Ookla, sur 12 mois du 14/02/2025 au 13/02/2026) : le réseau couvre le Grand Tunis, Sfax, Sousse, Bizerte et plusieurs zones touristiques (Hammamet, Monastir, Djerba). Au **1er mai 2026**, environ **35 % de la population** a un accès théorique à la 5G, mais seulement **18 % des abonnés mobiles** ont un forfait 5G actif. — [SpeedGEO.net, février 2026](https://www.speedgeo.net/fr/rapports/ooredoo-en-t%C3%AAte-des-debits-5g-en-tunisie-un-an-apr%C3%A8s-son-lancement-fevrier-2026)
- Ooredoo est en tête des débits 5G en téléchargement un an après le lancement, avec **30,6 Mbps** en moyenne (données à fin de la première année, février 2026). — [SpeedGEO.net](https://www.speedgeo.net/fr/rapports/ooredoo-en-t%C3%AAte-des-debits-5g-en-tunisie-un-an-apr%C3%A8s-son-lancement-fevrier-2026)
- La **couverture 4G atteint environ 95 % de la population** tunisienne. — synthèse de recherche (esim-now / analyses agrégées)
- Selon des données Ookla Speedtest Intelligence (collectées février 2025 – mai 2026) : le débit **4G seul est tombé à 21,60 Mbps** (recul de **28 %**) suite au lancement de la 5G — un phénomène classique de "cannibalisation"/réallocation de ressources radio. Le **débit médian global** (4G+5G combinés) est descendu de 20 % pour l'ensemble des utilisateurs. — [THD](https://www.thd.tn/5g-en-tunisie-20-de-debit-median-en-moins-pour-lensemble-des-utilisateurs-la-4g-seule-recule-de-28/)
- La Tunisie affiche un débit combiné de **57,30 Mbps** selon l'indice Speedtest Global d'Ookla de février 2026 (chiffre mêlant 4G et 5G, donc à interpréter avec prudence pour un usage "PME type" hors zones 5G). — [SpeedGEO.net](https://www.speedgeo.net/fr/rapports/ooredoo-en-t%C3%AAte-des-debits-5g-en-tunisie-un-an-apr%C3%A8s-son-lancement-fevrier-2026)
- La Tunisie se classe dans le top 3 africain en matière de connectivité mobile ; le pays a dépassé les 14 millions d'abonnés mobiles en 2024. — [allAfrica, février 2026](https://fr.allafrica.com/stories/202602270524.html) ; [allAfrica, février 2025](https://fr.allafrica.com/stories/202502050173.html)

### Inferences
- La combinaison "coupures fixes documentées dans la presse jusqu'en 2026 + procédure de réparation lente (1-2 semaines potentielles)" constitue un argument fort et daté pour justifier qu'une application de gestion/facturation pour PME tunisiennes **ne doit jamais dépendre d'une connexion permanente** pour les opérations quotidiennes (émission de facture, encaissement) — ce qui valide a posteriori l'architecture "stockage JSON local + synchronisation par fichier/dossier partagé" déjà choisie par SkanFact plutôt qu'un SaaS 100 % en ligne.
- La baisse du débit 4G pur (-28 %) après le lancement de la 5G, dans un contexte où seulement 18 % des abonnés ont un forfait 5G actif, signifie que la majorité des commerçants/artisans tunisiens hors grandes villes travaillent encore sur une 4G dégradée ou du fixe peu fiable — le mode hors ligne doit être le mode par défaut, pas une option de secours.
- Le manque de statistiques fixes récentes (la seule donnée trouvée date de 2017) suggère que le marché s'est largement reporté sur le mobile (4G/5G) comme connexion principale pour beaucoup de PME/commerces, renforçant l'importance de tester l'app sur connexion mobile intermittente plutôt que sur fibre.

### Gaps
- Aucune statistique chiffrée récente (2025-2026) du **débit fixe (ADSL/fibre) moyen** en Tunisie n'a été trouvée ; la seule donnée est obsolète (2017, ADSL 200 Kb/s).
- Aucun chiffre de **fréquence/durée moyenne des coupures** (SLA implicite, temps moyen de rétablissement, MTTR) n'a été trouvé — seuls des témoignages qualitatifs de presse.
- Pas de rapport Opensignal spécifique à la Tunisie trouvé dans les recherches effectuées (le champ de recherche a privilégié Ookla, dont les données étaient plus accessibles).
- Pas de statistique précise sur le taux de pénétration de la fibre optique (FTTH) chez les PME/commerces tunisiens en 2026.
- Pas de donnée sur le coût mensuel moyen d'un forfait internet PME (fixe ou 4G/5G Pro) en DT — utile pour dimensionner le budget connectivité d'un client type.

---

## Matériel de point de vente (POS) courant dans les commerces/restaurants tunisiens et son intégration logicielle

### Takeaway
Le marché tunisien du matériel POS est mature et localement distribué (imprimantes thermiques ESC/POS, tiroirs-caisses, scanners code-barres, terminaux Android type Sunmi, TPE bancaires), mais un changement réglementaire majeur intervient en 2026 : la **caisse enregistreuse numérique certifiée devient obligatoire** pour les activités de restauration/consommation sur place (calendrier en deux phases, complet au **1er juillet 2026**), ce qui doit être intégré dans toute réflexion produit pour un module caisse tunisien.

### Cited Findings

**Imprimantes thermiques ESC/POS et périphériques**
- Les imprimantes thermiques 80 mm disponibles en Tunisie (Mytek, Tunisianet, Spacenet, MBM, RETIF) offrent connexion USB + réseau, auto-cutter, et sont compatibles ESC/POS ; connectivité disponible aussi en Bluetooth ou Wi-Fi selon les modèles. — [Mytek](https://www.mytek.tn/impression/imprimantes/imprimante-thermique.html) ; [Spacenet](https://spacenet.tn/285-imprimante-thermique)
- Les packs complets vendus localement (ex. "Pack Librairie" TNPOS) incluent typiquement : caisse tactile, imprimante ticket, scanner laser, tiroir-caisse, imprimante code-barres et logiciel d'encaissement — bundle standard du secteur. — [TNPOS](https://www.tn-pos.com/produit/pack-librairie/)
- Les tiroirs-caisses vendus localement sont en métal, à compartiments billets/pièces, avec ouverture automatique déclenchée par l'imprimante (signal standard RJ11/RJ12, typique du marché ESC/POS mondial). — synthèse de résultats

**Terminaux Android POS (Sunmi et équivalents)**
- Les terminaux **Sunmi** (V2, V2 Pro, P2, T2s) sont commercialisés en Tunisie via plusieurs distributeurs/intégrateurs (ex. "Solution Caisse Mobile" avec pack Dyna Access + Sunmi V2 Pro), et via des plateformes comme Alibaba pour l'import direct. — [Solution Caisse Mobile](https://www.solution-caisse-mobile.com/produit/pack-dyna-access-avec-terminal-mobile-android-sun-mi-v2-pro/) ; [Alibaba](https://french.alibaba.com/product-detail/SUNMI-V2-Touch-Screen-Payment-Point-62007415435.html)
- Le modèle "Terminal de Paiement Intelligent SUNMI P2" (Android 11, fonction caisse enregistreuse, écran tactile, imprimante de reçu intégrée, connectivité WiFi) est référencé comme disponible sur le marché tunisien. — synthèse de résultats de recherche
- Sunmi se positionne mondialement (200+ pays) comme fournisseur de matériel commercial Android (terminaux intelligents, solutions desktop, kiosques, périphériques). — [Sunmi](https://www.sunmi.com/)

**TPE bancaires et monétique**
- La **Société Monétique Tunisie (SMT)** est l'opérateur du switch interbancaire national tunisien, assurant l'interopérabilité des paiements par carte entre toutes les banques du pays ; elle gère les TID/MID des commerçants et traite les fichiers **WORKPOS** de rapprochement — élément technique clé pour toute intégration logicielle de paiement carte côté commerçant. — [TPE.tn](https://tpe.tn/reseau-smt-tunpay)
- Un TPE n'est **pas vendu directement** au commerçant : il est fourni par sa banque après signature d'un contrat d'affiliation monétique ; les transactions transitent par le réseau interbancaire national (SMT). — [Gastevo](https://gastevo.com/blog/tpe-tunisie-terminal-paiement-guide) ; [TPE.tn](https://tpe.tn/reseau-smt-tunpay)
- Un TPE lit la carte (puce, bande magnétique, ou sans contact/NFC) et déclenche une demande d'autorisation auprès de la banque émettrice ; les TPE acceptent Visa, Mastercard et le sans-contact. — synthèse de résultats
- Le paiement mobile de mobile à mobile et en NFC est disponible en Tunisie. — [THD](https://www.thd.tn/paiement-electronique-de-mobile-a-mobile-et-en-nfc-sont-desormais-disponibles-en-tunisie/)
- Chiffres BCT (Banque Centrale de Tunisie), Bulletins des Paiements en chiffres : le parc de TPE atteignait **40 600 unités mi-2025** (+3,6 %), **42 800 fin T3 2025** (+9,2 %), et **43 000 fin 2025** (+10 % sur l'année). — [BCT Bulletin N°13 (S1 2025)](https://www.tustex.com/sites/default/files//Bulletin_des_paiements_013_fr.pdf) ; [BCT Bulletin N°14 (30/09/2025)](https://www.tustex.com/sites/default/files//Bulletin_des_paiements_014_fr.pdf) ; [Challenges.tn](https://www.challenges.tn/economie/tunisie-les-paiements-digitaux-explosent-en-2025-la-bct-devoile-des-hausses-record-dans-son-bulletin-t3/)
- Le paiement mobile en Tunisie a progressé de **+81 % en nombre de transactions en 2025**. — [THD](https://www.thd.tn/paiement-mobile-en-tunisie-81-de-transactions-en-2025/)
- Plusieurs acteurs de paiement digital tunisiens (Paymee, Flouci, Wepay, TunPay) opèrent aux côtés/en complément du réseau bancaire SMT. — [TPE.tn](https://tpe.tn/blog/cartes-bancaires-tunisie) ; [Paymee](https://www.paymee.tn/)

**Obligation de caisse enregistreuse numérique / imprimante fiscale (2025-2026)**
- Fondement légal : **article 48 de la loi de finances 2016**, arrêté de la ministre des Finances du **14 octobre 2025**, et décret gouvernemental n°2019-1126 du 26 novembre 2019 — dans le cadre de la deuxième phase du "programme national de digitalisation fiscale". — [Managers.tn](https://managers.tn/2026/06/30/tunisie-caisses-enregistreuses-obligatoires-des-demain-pour-ces-structures/) ; [L'Économiste Maghrébin](https://www.leconomistemaghrebin.com/2026/05/21/caisses-enregistreuses-obligatoires-juillet-2026/)
- **Calendrier de déploiement** : phase 1 entrée en vigueur le **1er novembre 2025** (restaurants touristiques classés, salons de thé, cafés de 2e et 3e catégorie) ; phase 2, extension à **toutes les autres sociétés du secteur restauration/consommation sur place à partir du 1er juillet 2026**. — [Le Temps News](https://letemps.news/2026/05/21/a-partir-du-1er-juillet-2026-toutes-les-entreprises-de-services-de-consommation-sur-place-devront-utiliser-des-caisses-enregistreuses/) ; [Africanmanager](https://africanmanager.com/generalisation-des-caisses-enregistreuses-a-toutes-les-entreprises-de-services-de-consommation-sur-place/)
- Objectif affiché : lutte contre l'évasion fiscale, transparence des transactions, équité fiscale entre contribuables. — [Managers.tn](https://managers.tn/2026/06/30/caisse-enregistreuse-obligatoire-ce-que-prevoit-la-loi-en-cas-de-non-respect/)
- Des logiciels locaux se positionnent déjà comme "conformes" à cette obligation (ex. KAISSE, se présentant comme "logiciel de caisse conforme loi fiscale") ; des intégrateurs comme ASM proposent une page dédiée à l'**homologation** de caisses tactiles ("caisse fiscale Tunisie"). — [KAISSE](https://kaisse.tn/) ; [ASM homologation](https://asmpos.com/caisse-fiscale-tunisie/)
- Existence de conséquences légales en cas de non-respect de l'obligation (détail précis non extrait). — [Managers.tn](https://managers.tn/2026/06/30/caisse-enregistreuse-obligatoire-ce-que-prevoit-la-loi-en-cas-de-non-respect/)

### Inferences
- L'écosystème matériel (imprimante ESC/POS, tiroir-caisse, scanner, TPE fourni par la banque) est déjà standard et interopérable avec des logiciels de caisse occidentaux classiques (protocoles ESC/POS génériques) — un module caisse (comme celui prévu en 10.15.0 de SkanFact) n'a probablement pas de contrainte matérielle exotique à gérer en Tunisie, hormis l'intégration du protocole SMT/WORKPOS pour un rapprochement carte-bancaire automatisé si on veut aller plus loin que l'encaissement manuel.
- L'obligation de caisse enregistreuse numérique **certifiée** à partir du 1er juillet 2026 (secteur restauration/consommation sur place) est un facteur réglementaire direct et daté qui doit être vérifié pour savoir si un logiciel de caisse "maison" (comme celui de SkanFact) doit obtenir une **homologation** officielle avant d'être vendu à ce segment de clientèle — actuellement le CLAUDE.md de SkanFact marque le timbre de caisse "À VÉRIFIER" ; ce point mérite une vérification juridique dédiée et urgente si SkanFact vise les commerces de restauration.
- La croissance rapide du parc TPE (+10 % en 2025) et du paiement mobile (+81 % de transactions) confirme un momentum favorable à l'intégration de paiements électroniques dans les logiciels de gestion PME tunisiens.
- Les terminaux Android Sunmi étant disponibles et déjà packagés avec des logiciels de caisse locaux, ils représentent une option matérielle réaliste si SkanFact ou un concurrent veut proposer une caisse mobile/tablette plutôt qu'un poste fixe.

### Gaps
- Aucun détail trouvé sur le **protocole/API exact** d'intégration SMT/WORKPOS pour qu'un logiciel tiers (non bancaire) rapproche automatiquement les transactions TPE — probablement réservé aux intégrations bancaires agréées, à confirmer directement auprès d'une banque ou de la SMT.
- Aucune confirmation précise si le logiciel de caisse lui-même (pas seulement le matériel) doit être **homologué par l'administration fiscale tunisienne** pour être légalement utilisé dans le cadre de l'obligation du 1er juillet 2026, ni quelle est la procédure/le coût d'homologation — c'est une question centrale pour SkanFact si elle vise ce marché, marquée comme à vérifier.
- Pas de prix précis (DT) trouvés pour un pack POS complet standard (imprimante + tiroir + scanner) ni pour un terminal Sunmi vendu localement.
- Pas d'information sur des marques d'imprimantes fiscales spécifiquement certifiées par l'administration tunisienne (au-delà de mentions génériques "caisse fiscale").

---

## Usage mobile (Android vs iOS) et adoption WhatsApp Business par les PME tunisiennes

### Takeaway
Android domine très largement le marché mobile tunisien (l'ordre de grandeur mondial/régional place Android nettement devant iOS, la Tunisie n'étant pas un marché à forte pénétration iPhone), et **WhatsApp est le canal de communication commerciale dominant** pour les PME tunisiennes, avec une pénétration et des taux d'engagement exceptionnellement élevés — un argument fort pour prioriser toute intégration WhatsApp (déjà en discussion pour SkanFact en 10.15.0) au-dessus d'autres canaux.

### Cited Findings
- StatCounter publie des données spécifiques Tunisie pour les parts de marché mobile Android/iOS et par version, basées sur des volumes de pages vues mensuels (plusieurs milliards) — mais l'accès direct à `gs.statcounter.com` a été **techniquement bloqué** lors de cette recherche (proxy réseau), empêchant l'extraction des pourcentages exacts. — [StatCounter Tunisia iOS](https://gs.statcounter.com/ios-version-market-share/mobile-tablet/tunisia) ; [StatCounter Tunisia Android](https://gs.statcounter.com/android-version-market-share/mobile-tablet/tunisia) *(pages identifiées mais non consultables)*
- Au niveau mondial (référence de contexte, pas spécifique Tunisie) : **iOS représente 32,5 % des pages vues mobiles mondiales en août 2026** selon StatCounter — donc Android reste très majoritaire globalement, et les marchés d'Afrique du Nord/MENA sont historiquement encore plus favorables à Android que la moyenne mondiale. — [Digitalapplied](https://www.digitalapplied.com/blog/mobile-os-market-share-2026-ios-vs-android)
- La Tunisie a dépassé les **14 millions d'abonnés mobiles en 2024**. — [allAfrica](https://fr.allafrica.com/stories/202502050173.html)
- La Tunisie se classe dans le **top 3 africain** pour la connectivité mobile. — [allAfrica, février 2026](https://fr.allafrica.com/stories/202602270524.html)

**WhatsApp / WhatsApp Business**
- La pénétration de WhatsApp dépasse **89 % des utilisateurs de smartphones en Tunisie**, avec une concentration maximale dans le Grand Tunis. — [Whakup](https://whakup.com/blog/tunisie/whatsapp-marketing-tunis-guide-entreprises)
- **92 % des Tunisiens préfèrent être contactés via WhatsApp plutôt que par email**, et **73 % des utilisateurs effectuent des achats via WhatsApp**. — [Whakup](https://whakup.com/blog/tunisie/whatsapp-marketing-tunis-guide-entreprises)
- Le taux d'ouverture des messages WhatsApp dépasse **95 %**, contre **21 % pour l'email** — écart majeur en faveur de WhatsApp comme canal de relance/communication client pour une PME. — [Whakup](https://whakup.com/blog/tunisie/whatsapp-marketing-tunis-guide-entreprises)
- Une PME tunisienne de taille moyenne gère typiquement **200 à 2 000 conversations WhatsApp par mois** ; les grandes boutiques e-commerce en gèrent **5 000 à 50 000**. — [Whakup](https://whakup.com/blog/tunisie/whatsapp-marketing-tunis-guide-entreprises)
- Cadre légal : l'usage commercial de WhatsApp est légalement possible sous réserve de conformité à la **loi 2004-63** (protection des données) — obligations principales : consentement du destinataire, possibilité de désinscription, non-transmission des données à des tiers sans accord. — [Whakup](https://whakup.com/blog/tunisie/whatsapp-marketing-tunis-guide-entreprises)
- Écosystème de solutions locales déjà présentes : SupplyzPro (ERP piloté par IA/WhatsApp, lancé 2023 à Tunis), des fournisseurs d'API WhatsApp Business (Visibility, TrueScaling, BuzzBip, BMC) proposant automatisation, chatbots, intégration CRM. — [We Are Tech](https://www.wearetech.africa/fr/fils/solutions/tunisie-supplyzpro-simplifie-la-gestion-des-pme-via-l-ia-et-whatsapp) ; [Visibility](https://visibility.tn/services/whatsapp-business-api)
- Un guide marketing local recommande la combinaison "site web + chatbot WhatsApp" comme combinaison gagnante pour les entreprises tunisiennes. — [Web6](https://web6.tn/blog/chatbot-whatsapp-business-tunisie-ia/)

### Inferences
- Même sans le chiffre exact Android/iOS pour la Tunisie (bloqué techniquement), la convergence de plusieurs indices (marché nord-africain, part iOS mondiale à 32,5 %, absence de signal d'un marché iPhone fort en Tunisie dans toutes les sources consultées) confirme qu'Android est le système dominant très largement — cohérent avec une priorité produit "Android d'abord" pour toute future application mobile/terminal POS Sunmi (déjà Android).
- Les chiffres d'engagement WhatsApp (95 % d'ouverture, 92 % de préférence, 73 % d'achat via WhatsApp) sont exceptionnellement élevés et confirment objectivement que l'intégration WhatsApp déjà entamée par SkanFact (envoi de factures/devis via WhatsApp, lien wa.me, en 10.15.0) répond à un usage réel et majoritaire, plus qu'un canal secondaire — l'email reste nécessaire mais moins efficace en Tunisie pour la relance client.

### Gaps
- **Chiffre exact Android vs iOS pour la Tunisie non obtenu** : le domaine `gs.statcounter.com` est bloqué par le proxy réseau de cet environnement de recherche ; une vérification manuelle ultérieure (accès direct au site, ou recherche via un autre agrégateur type GSMA Intelligence, Kepios/DataReportal Digital Tunisia) serait nécessaire pour un chiffre précis et daté.
- Pas de statistique précise sur l'usage de WhatsApp Business (l'application, pas seulement WhatsApp grand public) spécifiquement par les PME tunisiennes (taux d'adoption en %) — les chiffres trouvés portent sur l'usage WhatsApp en général côté consommateur.

---

## Sécurité : menaces courantes, ransomware, obligations ANCS, attentes ISO 27001

### Takeaway
La Tunisie connaît une **explosion documentée et chiffrée des ransomwares** (x2,4 entre 2023 et 2024, plus de 57 000 cyberattaques enregistrées au premier semestre 2025) et dispose depuis mars 2023 d'un cadre légal d'audit de cybersécurité **obligatoire et annuel** pour une liste précise d'acteurs (opérateurs télécoms, FAI, entreprises à réseaux interconnectés, prestataires cloud/hébergement, infrastructures numériques critiques) piloté par l'ANCS — un cadre dont un SaaS d'hébergement/PME comme SkanFact devrait vérifier s'il entre dans le périmètre, notamment s'il héberge des données pour compte de tiers.

### Cited Findings

**ANCS et cadre légal d'audit**
- L'**Agence Nationale de la Cybersécurité (ANCS)**, anciennement Agence Nationale de la Sécurité Informatique (ANSI), est l'agence tunisienne spécialisée en sécurité informatique. — [Wikipédia FR](https://fr.wikipedia.org/wiki/Agence_nationale_de_la_cybers%C3%A9curit%C3%A9)
- Le cadre réglementaire de l'audit de sécurité des systèmes d'information est fixé par le **décret-loi n° 2023-17 du 11 mars 2023**, fondement actuel de la réglementation cybersécurité tunisienne. — [ANCS - cadre réglementaire](https://www.ancs.tn/fr/audit-reglementaire)
- Ce décret-loi **impose un audit annuel obligatoire** à plusieurs catégories d'acteurs : opérateurs de réseaux publics de télécommunications, fournisseurs d'accès internet (FAI), **entreprises disposant de réseaux interconnectés**, **prestataires cloud et d'hébergement**, ainsi que certaines infrastructures numériques critiques. — [ANCS](https://www.ancs.tn/fr/audit/cadre-juridique) ; [ANSI](https://www.ansi.tn/fr/audit/cadre-juridique)
- Seuls les **auditeurs certifiés par l'ANCS** sont habilités à réaliser cet audit réglementaire ; le rapport d'audit doit être transmis à l'ANCS dans les **dix jours** suivant la fin de la mission. — synthèse de recherche
- L'agence a publié quatre nouveaux arrêtés pour renforcer la cybersécurité en République Tunisienne (détail précis des arrêtés non extrait). — [Africa Cybersecurity Mag](https://en.cybersecuritymag.africa/agence-nationale-cyber-securite-quatre-nouveaux-arretes-renforcement)

**Ransomware et cyberattaques (chiffres)**
- Les cas de ransomware ont connu une **hausse de 140 %**, passant de **15 411 cas en 2023 à 37 076 en 2024**. — [L'Économiste Maghrébin, août 2026](https://www.leconomistemaghrebin.com/2026/08/07/cyberattaques-tunisie-explosion-ransomwares/)
- Le ministère de l'Intérieur tunisien a déclaré **57 430 cyberattaques enregistrées au premier semestre 2025**. — [L'Économiste Maghrébin](https://www.leconomistemaghrebin.com/2026/08/07/cyberattaques-tunisie-explosion-ransomwares/)
- Le nombre d'incidents signalés à l'ANSI/ANCS a augmenté de **plus de 48 % entre 2024 et 2026**. — [L'Économiste Maghrébin](https://www.leconomistemaghrebin.com/2026/08/07/cyberattaques-tunisie-explosion-ransomwares/)
- Des groupes criminels internationaux (**LockBit, BlackCat, Cl0p**) ciblent désormais activement la région MENA, Tunisie incluse. — [L'Économiste Maghrébin](https://www.leconomistemaghrebin.com/2026/08/07/cyberattaques-tunisie-explosion-ransomwares/)
- Cas concret documenté : une **clinique privée de la banlieue de Tunis** a eu tout son système informatique paralysé par un ransomware en 2025 (dossiers patients, système de rendez-vous, facturation, résultats d'analyses tous inaccessibles) — exemple direct de PME/organisation tunisienne victime, pertinent car proche du profil "PME gérant des données sensibles" que sert SkanFact. — [L'Économiste Maghrébin](https://www.leconomistemaghrebin.com/2026/08/07/cyberattaques-tunisie-explosion-ransomwares/)
- Une **Stratégie nationale de cybersécurité 2026-2030** a été finalisée par le gouvernement, articulée autour de la protection résiliente des infrastructures nationales et du renforcement des compétences humaines. — [L'Économiste Maghrébin](https://www.leconomistemaghrebin.com/2026/08/07/cyberattaques-tunisie-explosion-ransomwares/)
- Des hackers tunisiens sont mentionnés comme source de crainte pour une cyberattaque massive visant Chypre (mai 2025) — indication que la Tunisie est aussi un point d'origine, pas seulement une cible, dans l'écosystème régional de menaces. — [Kapitalis](https://kapitalis.com/tunisie/2025/05/17/chypre-craint-une-cyberattaque-massive-de-hackers-tunisiens/)

**ISO 27001 en Tunisie**
- La certification ISO 27001 s'adresse en Tunisie à **toutes les organisations détenant des données**, pas seulement aux hébergeurs/informaticiens — positionnement affirmé par les organismes certificateurs locaux. — [Factocert](https://factocert.com/tunisia/iso-27001-certification-in-tunisia/)
- Exemples d'entreprises tunisiennes déjà certifiées : la **Bourse de Tunis** (certification ISO/IEC 27001, reconduite jusqu'en 2029, avec 2 autres certifications ISO) ; **MG** (leader de la grande distribution, première enseigne certifiée ISO 27001 en Tunisie **et en Afrique**) ; **3S** (Standard Sharing Software, premier intégrateur IT certifié ISO 27001 en Tunisie) ; le **Data Center Carthage de Tunisie Telecom** (ISO 27001 + 27701 + 9001) ; **EO Data Center** (ISO 27001, cf. section hébergement). — [Afnor Certification](https://lemagcertification.afnor.org/blog/cyber-securite-la-bourse-de-tunis-decroche-sa-certification-isoiec-27001/) ; [WebManagerCenter, 2021](https://www.webmanagercenter.com/2021/11/02/474912/tunisie-mg-certifie-iso-27001/) ; [Entreprises Magazine](https://www.entreprises-magazine.com/la-bourse-de-tunis-reconduit-ses-3-certifications-iso-jusquen-2029/)
- Organismes certificateurs actifs localement : **AFNOR Tunisie**, **Bureau Veritas Tunisie**, ainsi que des cabinets de conseil locaux (North Consulting, Factocert). — [Bureau Veritas](https://www.bureauveritas.tn/iso-27001-information-security-management-system-certification) ; [North Consulting](https://www.northconsulting.fr/ISO27001)

### Inferences
- La combinaison "explosion x2,4 des ransomwares 2023→2024 + cible confirmée y compris chez une organisation de taille PME (clinique)" démontre que la menace n'est **pas théorique ni réservée aux grandes entreprises** en Tunisie — un argument commercial et produit fort pour toute fonctionnalité de sécurité/sauvegarde chiffrée dans un logiciel de gestion PME (SkanFact a déjà ce type de dispositif : sauvegardes chiffrées, clé de secours, chiffrement optionnel local — cette recherche en confirme la pertinence marché).
- Le périmètre légal de l'audit ANCS obligatoire (décret-loi 2023-17) cible explicitement les **"prestataires cloud et d'hébergement"** : si SkanFact ou un service serveur associé (le worker Cloudflare, la console plateforme) venait à opérer un hébergement de données pour compte de tiers de façon significative, il serait pertinent de vérifier si ce statut d'hébergeur/prestataire cloud déclenche une obligation d'audit annuel ANCS — question à traiter avec un juriste local avant scale commercial.
- La visibilité et l'aura de l'ISO 27001 en Tunisie (Bourse de Tunis, MG, data centers télécoms) en font un **argument de vente crédible et attendu** par les clients d'affaires tunisiens sérieux (grandes PME, cabinets comptables) — un SaaS local qui peut démontrer des pratiques équivalentes (même sans certification formelle, coûteuse pour une petite structure) renforcera sa crédibilité commerciale.

### Gaps
- Pas de détail sur le **coût** ou le **processus concret** d'un audit ANCS obligatoire (durée, tarif, liste des auditeurs certifiés) — à creuser directement sur ancs.tn.
- Pas de statistique précise sur le **taux de PME tunisiennes victimes de ransomware** (le chiffre national global existe, mais pas de ventilation par taille d'entreprise) — seul l'exemple qualitatif de la clinique privée est disponible.
- Pas de confirmation explicite que le décret-loi 2023-17 s'applique à un éditeur de logiciel de bureau (comme l'app SkanFact classique, qui reste en local) par opposition à un vrai prestataire cloud multi-tenant — cette distinction juridique mériterait un avis d'avocat local, la recherche web ne permettant pas de trancher ce point technique.
- Pas de chiffres précis sur le coût d'une certification ISO 27001 pour une petite structure tunisienne (éditeur logiciel, quelques salariés).

---

## Piratage de logiciels en Tunisie et protections efficaces (argument pour un modèle SaaS / valeur côté serveur)

### Takeaway
Les données chiffrées disponibles sur le piratage logiciel en Tunisie sont **anciennes** (dernier chiffre BSA/IDC trouvé : 73 % en 2008, après un pic à 94 % en 2004) — aucune étude BSA récente (2020s) n'a été localisée — mais la culture de "légitimité informelle partagée du piratage" documentée par la recherche académique tunisienne, combinée à l'absence de données récentes fiables, suggère qu'une **protection reposant sur la valeur côté serveur (licences vérifiables en ligne, fonctionnalités cloud, mises à jour continues)** reste une stratégie plus robuste qu'une simple protection cryptographique locale — ce qui correspond déjà à l'architecture de licence hybride de SkanFact (clé Ed25519 locale + vérification optionnelle côté plateforme depuis la 8.4.0).

### Cited Findings
- Selon une étude **BSA (Business Software Alliance)** historique, la Tunisie était classée **2e dans le monde arabe** pour le taux de piratage logiciel, à **79 %**, derrière l'Algérie (84 %). — [BusinessNews.com.tn](https://www.businessnews.com.tn/la-tunisie-2ame-en-matiare-de-piratage-informatique-dans-le-monde-arabe,520,20764,1) *(date de publication non précisée dans le résumé, probablement années 2000-2010)*
- En **2004**, la Tunisie s'était classée en tête des pays arabes consommateurs de produits high-tech piratés, avec un taux de **94 %**. — synthèse issue de la même recherche
- Selon l'étude **IDC-BSA 2008**, le taux de piratage logiciel en Tunisie s'établissait à **73 % en 2008**, soit un recul de 21 points depuis 2004. — synthèse de résultats
- Impact économique estimé (étude BSA, non datée précisément dans les résultats) : augmenter de 1 point la part de logiciels sous licence ajouterait **28 millions de dollars** à la production nationale tunisienne, contre seulement **14 millions de dollars** si l'augmentation équivalente concernait des logiciels piratés (donc un logiciel sous licence génère environ le double de valeur économique qu'un logiciel piraté). — [BusinessNews.com.tn](http://www.businessnews.com.tn/Tunisie---Un-logiciel-sous-licence-offre-2-fois-plus-de-valeur-%C3%A9conomique-qu%E2%80%99un-logiciel-pirat%C3%A9,-selon-une-%C3%A9tude,522,38949,3)
- Une étude académique tunisienne ("Légitimité institutionnelle et piratage de logiciels en Tunisie : vers un modèle contextualisé d'institutionnalisation du droit de propriété intellectuelle") conclut que les **organisations tunisiennes perçoivent la régulation et l'application de la lutte anti-piratage comme faibles**, et partagent une forme de **légitimité informelle partagée du piratage** — c'est-à-dire une tolérance culturelle/organisationnelle au piratage logiciel, documentée par la recherche en sciences de gestion. — [HAL / ResearchGate](https://hal.science/hal-03112416)

### Inferences
- L'absence totale de données BSA/IDC récentes (2015-2026) accessibles dans cette recherche est en soi un signal : soit l'étude BSA mondiale a cessé de publier des chiffres pays par pays pour la Tunisie ces dernières années, soit ces données ne sont simplement pas indexées/disponibles en ligne — dans les deux cas, il faut traiter tout chiffre de piratage tunisien pré-2010 comme **un ordre de grandeur historique, pas une mesure actuelle**.
- La "légitimité informelle du piratage" documentée académiquement, même si l'étude est ancienne, décrit une dynamique culturelle qui évolue lentement — combinée à la répétition du sujet dans plusieurs sources spécialisées POS locales tunisiennes elles-mêmes (ex. ASM, un vendeur de caisses tactiles, consacre une page dédiée à "Piratage logiciel" sur son propre site — signe que c'est une préoccupation concrète et récurrente des vendeurs de logiciels métier tunisiens aujourd'hui), cela confirme que le piratage reste une préoccupation active du marché logiciel PME tunisien en 2026, même sans chiffre national récent. — [ASM](https://asmpos.com/piratage-logiciel/)
- Pour SkanFact, cela valide la stratégie déjà en place documentée dans son CLAUDE.md : (1) une licence cryptographique locale vérifiable hors ligne (empêche le contournement trivial "copier le fichier"), (2) doublée d'une vérification serveur optionnelle avec révocation possible depuis la 8.4.0-9.4.1 (empêche la réémission indéfinie d'une même clé piratée une fois détectée), et (3) surtout, une architecture où la vraie valeur différenciante (mises à jour continues, module Cabinet comptable collaboratif, paiement en ligne, facture électronique TEIF) dépend d'un écosystème (comptable, plateforme, mises à jour) impossible à répliquer par simple copie de fichiers — c'est le argument "valeur côté serveur" le plus solide identifié dans la recherche, plus fiable qu'une pure protection technique locale.

### Gaps
- **Aucune donnée BSA ou équivalente récente (2015-2026) n'a été trouvée** pour le taux de piratage logiciel actuel en Tunisie — c'est le gap le plus significatif de cette section ; il faudrait chercher directement sur le site de la BSA (bsa.org) ou dans des rapports IDC plus récents, non localisés par cette recherche.
- Pas de données spécifiques sur le piratage de **logiciels de gestion/comptabilité** (par opposition au piratage grand public de Windows/Office) en Tunisie.
- Pas de comparaison chiffrée entre le taux de piratage tunisien et celui d'autres pays MENA/Afrique du Nord au-delà de la mention Algérie (84 %) dans une source ancienne.
- Pas d'exemples concrets récents de PME tunisiennes sanctionnées/poursuivies pour usage de logiciel piraté — utile pour évaluer le risque réel de dissuasion légale (au-delà de la dissuasion technique).

---

## Note méthodologique
Cette recherche a mobilisé une vingtaine de requêtes WebSearch et une tentative WebFetch (bloquée par le proxy réseau sur `gs.statcounter.com`). Les sources sont majoritairement des médias économiques/tech tunisiens (La Presse, L'Économiste Maghrébin, THD - Tunisie Haut Debit, Managers.tn, Le Temps News, Challenges.tn), des sites institutionnels (ANCS/ANSI, ATI, INPDP), des sites commerciaux des acteurs cités eux-mêmes (EO Data Center, NovaHoster, Oxahost, Zenhosting, Tunisie Telecom, Sunmi), et deux publications académiques/officielles (loi 2004-63, étude HAL sur le piratage). Aucune information n'a été inventée ; toute donnée non trouvée ou non datable avec certitude est explicitement signalée en Gap plutôt que supposée.
