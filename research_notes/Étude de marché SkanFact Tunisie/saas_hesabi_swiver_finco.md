# Les trois leaders SaaS de facturation/gestion en Tunisie : Hesabi, Swiver, Finco

*Notes de recherche — arrêtées au 27/09/2026. Objectif : dossier concurrentiel dense pour positionner SkanFact
(application de bureau tunisienne) face aux trois principaux logiciels SaaS de facturation/gestion tunisiens.*

**Méthode et limite à lire avant tout.** Le réseau de cette session bloque **tout** accès direct (WebFetch) aux
domaines visés — pas seulement `swiver.io`, mais aussi `hesabi.tn`, `finco.tn`, `ilboursa.com`, `jeuneafrique.com`,
`crunchbase.com`, `webmanagercenter.com`, et même `wikipedia.org` (testé). Le blocage est donc réseau-large, pas
spécifique à un site. **Toutes les informations ci-dessous viennent des extraits et résumés produits par l'outil de
recherche web** (qui, lui, accède aux pages), jamais d'une lecture directe de page. C'est une limite réelle : un
résumé de moteur de recherche peut mal citer, dater ou agréger des informations de pages différentes. Chaque
affirmation marketing d'un éditeur (chiffres de clients, "le meilleur", comparatifs auto-publiés) est signalée
comme telle. Avant toute publication publique d'un comparatif, revérifier chaque ligne en ouvrant les sites
directement depuis un poste sans ce blocage.

L'étude Hesabi déjà présente dans le dépôt (`/home/user/skanfact/ETUDE-HESABI.md`, 27/09/2026) a été relue et
n'est pas refaite : ce document la complète (faits d'entreprise, absents de l'étude initiale) et couvre Swiver et
Finco, absents jusqu'ici.

---

## Hesabi — faits d'entreprise et certifications

### Takeaway
Hesabi ne laisse quasiment aucune trace en dehors de son propre site : aucune date de fondation, aucun nom de
fondateur, aucune levée de fonds, aucun effectif, aucun avis client indépendant n'a été trouvé dans la presse
tunisienne ni sur les réseaux. Sa signature électronique TEIF passe par un **partenaire tiers, NGSign** (pas
d'homologation ANCE propre trouvée), ce qui le distingue de Swiver (voir plus bas).

### Cited Findings
- Aucun article de presse tunisienne (managers.tn, webdo.tn, businessnews.com.tn, ilboursa.com, La Presse) mentionnant
  « Hesabi » comme startup n'a été trouvé — les recherches ciblées sur ces domaines ne retournent que des pages du
  site hesabi.tn lui-même ou des résultats sans rapport — [recherche « Hesabi Tunisie startup businessnews.com.tn OR webdo.tn OR managers.tn »](https://managers.tn/category/startup/).
- Aucune levée de fonds, aucun nom de fondateur, aucun effectif LinkedIn n'a été trouvé pour Hesabi malgré plusieurs
  recherches ciblées — gap explicite (voir plus bas).
- La signature électronique des factures TEIF pour la TTN se ferait « via NGSign » selon l'étude déjà présente dans
  le dépôt, elle-même construite sur les pages hesabi.tn — c'est une affirmation qui vient du site de l'éditeur, pas
  d'une source tierce, et elle n'a pas pu être confirmée ou infirmée de façon indépendante dans cette session
  (aucune page ne relie explicitement « Hesabi » et « NGSign ») — [NGSign, signature homologuée ANCE](https://www.ng-sign.com/api-ngsign-elfatoora/) ; [ETUDE-HESABI.md](../../ETUDE-HESABI.md) du dépôt.
- ANCE (Agence Nationale de Certification Électronique) exige un certificat électronique qualifié pour signer les
  factures électroniques ; TunTrust liste les entités habilitées comme « entité déléguée » (dont NG Technologies /
  NGSign, Keystone, Tledger, MSS, BPS, SIRAT, VNEURON, convention de décembre 2019) — Hesabi n'apparaît dans aucune
  de ces listes trouvées, ce qui est cohérent avec un statut de simple client/partenaire de NGSign plutôt que
  d'homologué direct — [TunTrust, homologation](http://www.ance.tn/fr/content/homologation) ; [THD, convention AED décembre 2019](https://www.thd.tn/certification-electronique-tuntrust-signe-une-convention-multipartite-avec-plusieurs-organismes-prives/).

### Inferences
- L'absence totale de couverture presse indépendante, comparée à Swiver (très couvert depuis 2018) et même Finco
  (déjà repéré par des sites de presse en 2026 via son homologation), suggère que Hesabi est soit un acteur plus
  récent, soit un acteur qui investit peu en relations presse et mise surtout sur le SEO (voir la section marketing)
  et le bouche-à-oreille via cabinets comptables.
- Le fait que Hesabi dépende de NGSign pour la signature (si l'affirmation de son propre site est exacte) le met en
  position plus faible que Swiver, qui vient d'obtenir en septembre 2026 sa propre homologation ANCE (signature
  intégrée sans prestataire tiers) — un argument de vente que Swiver met déjà en avant.

### Gaps
- Date de fondation, fondateurs, siège social, effectif, tour de financement de Hesabi : introuvables via les
  recherches menées. Un accès direct à hesabi.tn (page « À propos »), à son LinkedIn ou à un registre d'entreprises
  tunisien (Pappers-like local) serait nécessaire.
- Nombre de clients revendiqué par Hesabi : non trouvé (contrairement à Swiver ou Finco qui annoncent des chiffres).
- Confirmation indépendante (hors site Hesabi) du partenariat NGSign : non trouvée.

---

## Hesabi — fonctionnalités (compléments à l'étude déjà dans le dépôt)

### Takeaway
Les recherches confirment et complètent point par point le tableau fonctionnel déjà dressé dans
`ETUDE-HESABI.md` : offre à trois paliers (Starter/Pro/Cabinet), TEIF+TEJ, paie complète, import IA, portail
Cabinet — sans rien contredire ce document. Rien de nouveau de poids n'a été trouvé au-delà de ce qui y figure déjà.

### Cited Findings
- Le module Paie de Hesabi gère les salariés (CDI, CDD, CIVP, KARAMA), calcule CNSS/IRPP/TFP, produit les
  bulletins PDF, exporte les déclarations CNSS trimestrielles et annuelles, et passe les écritures comptables —
  [hesabi.tn/logiciel-paie-tunisie via recherche](https://hesabi.tn/logiciel-paie-tunisie).
- Hesabi propose facturation gratuite, POS, stock, TVA, et génère le XML TEIF pour TTN El Fatoora avec signature
  électronique XAdES — [hesabi.tn/meilleur-logiciel-paie-tunisie via recherche](https://hesabi.tn/meilleur-logiciel-paie-tunisie).
- Sur sa page comparative face à Finco, Hesabi revendique (affirmations de l'éditeur, à vérifier) : portail B2B
  client, caisse POS avec ticket thermique 80 mm, paie CNSS/IRPP/TFP, interface arabe RTL native, envoi de facture
  par WhatsApp, import multi-format par IA (CSV/Excel/PDF/image) — [hesabi.tn/hesabi-vs-finco](https://hesabi.tn/hesabi-vs-finco).
- Le comparatif Hesabi vs Finco/Swiver (publié par Hesabi lui-même) résume : « Hesabi couvre la facturation TTN
  El Fatoora, les déclarations TEJ, la comptabilité PCG-TN, la paie CNSS/IRPP, la caisse POS et un module Cabinet
  dédié aux experts-comptables » — [hesabi.tn/hesabi-vs-swiver](https://hesabi.tn/hesabi-vs-swiver).

### Inferences
- Hesabi est, sur le papier (déclaratif), l'offre la plus complète des trois — c'est cohérent avec le fait que ce
  soit elle qui publie les pages de comparaison marketing contre les deux autres (position de challenger qui
  argumente sa complétude).

### Gaps
- Aucun détail indépendant (hors marketing Hesabi) permettant de vérifier ces fonctionnalités n'a été trouvé — se
  reporter à `ETUDE-HESABI.md` pour la méthode de vérification recommandée (ouvrir l'essai de 14 jours).

---

## Hesabi — tarifs

### Takeaway
Trois paliers annuels déjà documentés dans `ETUDE-HESABI.md` : Starter 390 TND/an, Pro 790 TND/an, Cabinet
2 490 TND/an. Aucune nouvelle information tarifaire (mensuel, HT/TTC explicite, limites précises) n'a été trouvée
au-delà de ce document.

### Cited Findings
- Starter à 390 TND/an (facturation, stock, caisse POS, rapports de base, 3 utilisateurs) ; Pro à 790 TND/an
  (+ comptabilité PCG-TN, paie CNSS/IRPP/TFP, TTN El Fatoora signature+envoi, TEJ, import IA, calculateur de
  chiffrage, API, utilisateurs illimités) ; Cabinet à 2 490 TND/an (portail expert-comptable multi-clients,
  acting-as, calendrier fiscal multi-clients, export TEJ en masse, gestion honoraires, tableau de bord consolidé,
  exports XLSX/FEC par dossier) — [hesabi.tn/tarifs, via ETUDE-HESABI.md](https://hesabi.tn/tarifs).
- Essai de 14 jours sans carte bancaire — [hesabi.tn/tarifs](https://hesabi.tn/tarifs).

### Inferences
- (aucune nouvelle, voir `ETUDE-HESABI.md` § 1 pour l'analyse déjà faite)

### Gaps
- HT ou TTC : non précisé explicitement dans les sources trouvées (à vérifier en ouvrant la page tarifs).
- Tarification mensuelle (si elle existe) : non trouvée, seuls des prix annuels apparaissent.

---

## Hesabi — forces, faiblesses, avis clients

### Takeaway
Aucun avis client indépendant (Google, Facebook, forums, app stores) n'a pu être trouvé pour Hesabi malgré
plusieurs recherches ciblées. C'est en soi une donnée : soit le volume de clients réels est encore modeste, soit
Hesabi ne collecte/n'expose pas d'avis publics.

### Cited Findings
- Une recherche dédiée « Hesabi Tunisie avis clients Facebook Google Play » n'a renvoyé aucun résultat pertinent
  sur Hesabi lui-même — [recherche menée le 27/09/2026, aucune source retenue].
- Une seconde recherche « Hesabi.tn avis critique problème client » n'a retourné aucun résultat pertinent non plus.

### Inferences
- Forces déductibles de son propre positionnement (à prendre comme argument marketing, non comme fait vérifié) :
  c'est la seule des trois à revendiquer une offre Cabinet multi-clients complète avec acting-as et export TEJ en
  masse — un argument central de vente aux cabinets comptables.
- Faiblesse déductible : dépendance à un prestataire tiers (NGSign) pour la signature, alors que Swiver vient
  d'obtenir sa propre homologation ANCE (argument que Hesabi ne peut plus revendiquer en exclusivité une fois que
  Swiver communique dessus, ce qui est déjà le cas depuis septembre 2026).

### Gaps
- Aucun avis client (positif ou négatif) trouvé sur aucune plateforme pour Hesabi. Impossible de documenter cette
  clé de question — à retenter avec un accès direct à Google Maps/Facebook.

---

## Hesabi — positionnement marketing et canaux de vente

### Takeaway
Hesabi mise massivement sur le SEO : pages dédiées par métier/fonctionnalité (« logiciel-comptabilite-tunisie »,
« logiciel-gestion-stock-tunisie », « logiciel-caisse-pos-tunisie », « meilleur-logiciel-paie-tunisie ») et surtout
des **pages de comparaison directe contre ses deux concurrents** (« hesabi-vs-finco », « hesabi-vs-swiver »), une
tactique de growth marketing classique pour capter les recherches de type « X vs Y ».

### Cited Findings
- Pages trouvées : `hesabi.tn/tarifs`, `hesabi.tn/logiciel-comptabilite-tunisie`, `hesabi.tn/logiciel-gestion-stock-tunisie`,
  `hesabi.tn/logiciel-caisse-pos-tunisie`, `hesabi.tn/logiciel-paie-tunisie`, `hesabi.tn/meilleur-logiciel-paie-tunisie`,
  `hesabi.tn/tej-retenue-source-tunisie`, `hesabi.tn/hesabi-vs-finco`, `hesabi.tn/hesabi-vs-swiver`,
  `hesabi.tn/actualites/facturation-electronique-obligatoire-tunisie-2026` — toutes trouvées via recherche web,
  confirmant une stratégie de contenu SEO large et récente (les titres portent « 2026 »).
- Un article blog daté sur l'obligation de facturation électronique 2026 est utilisé comme aimant de trafic
  (« Facturation électronique obligatoire en Tunisie : guide complet 2026 ») — [hesabi.tn/actualites/…](https://hesabi.tn/actualites/facturation-electronique-obligatoire-tunisie-2026).

### Inferences
- Les pages « Hesabi vs Finco » et « Hesabi vs Swiver » montrent que Hesabi se positionne comme le challenger
  généraliste le plus complet, en insistant systématiquement sur ce que les deux autres n'ont pas (portail
  Cabinet, TEJ en masse, comptabilité complète) — ce sont des pages écrites par Hesabi lui-même, donc à charge.
- Aucun canal presse/partenariat public (type Ooredoo pour Swiver) n'a été trouvé pour Hesabi — son acquisition
  semble reposer sur le digital (SEO/essai gratuit) plutôt que sur des partenariats institutionnels visibles.

### Gaps
- Réseau de cabinets comptables partenaires, programme de parrainage, publicité payante : rien trouvé.

---

## Swiver — faits d'entreprise et certifications

### Takeaway
Swiver est le plus ancien et le mieux documenté des trois par la presse tunisienne (managers.tn, ilboursa,
webmanagercenter, jeuneafrique, webdo, La Presse, businessnews.com.tn, tekiano). Fondé en 2016 par **Azzam
Soualmia**, financé une première fois en 2018 par l'assureur **Carte**, partenaire d'**Ooredoo** depuis 2021, et
vient d'obtenir en **septembre 2026 sa propre homologation ANCE** pour signer les factures électroniques
directement dans l'application — un avantage compétitif net sur Hesabi (qui passerait par NGSign).

### Cited Findings
- Swiver a été développée à partir de janvier 2015 et la startup a été lancée en 2016 par **Azzam Soualmia**,
  entrepreneur tunisien qui n'a pas trouvé d'ERP à la fois adapté aux normes tunisiennes (TVA, retenues), abordable
  et facile d'usage pour les petites entreprises — [Crunchbase (via recherche)](https://www.crunchbase.com/person/azzam-soualmia-5e6a) ; [jeuneafrique.com](https://www.jeuneafrique.com/632269/economie-entreprises/start-up-de-la-semaine-en-tunisie-swiver-facilite-la-vie-des-artisans-et-des-gerants-de-tpe/).
- Histoire du fondateur (fait notable de presse, distinct du produit) : Azzam Soualmia a lancé Swiver en 2016 avec
  15 000 TND issus de la vente de sa voiture, alors qu'il était sous le coup d'une interdiction bancaire et de
  gérer/fonder une société ; deux amis ont accepté la responsabilité légale de la structure à sa place ; l'enquête
  le concernant a été classée sans suite en 2022, année où la société a atteint une valorisation de **7 millions de
  dinars** — [webdo.tn](https://www.webdo.tn/fr/actualite/national/tunisie-azzam-soualmia-de-l-interdiction-bancaire-a-une-start-up-a-7-millions/221184/).
- Première levée de fonds en **2018**, d'environ **un demi-million de dinars tunisiens**, auprès de l'assureur
  **Carte** (Compagnie d'Assurance et de Réassurance Tuniso-Européenne) — [Tustex](https://www.tustex.com/economie-actualites-des-societes/tunisie-la-startup-tunisienne-swiver-reussi-une-levee-de-fonds-d-un-demi-million-de-dinars) ; [ilBoursa](https://www.ilboursa.com/marches/la-startup-swiver-boucle-avec-succes-sa-premiere-levee-de-fonds_14790) ; [WebManagerCenter, 2018](https://www.webmanagercenter.com/2018/09/07/423903/la-startup-tunisienne-swiver-reussit-sa-premiere-levee-de-fonds/) ; [Agence Ecofin](https://www.agenceecofin.com/investissement/1009-59822-la-startup-tunisienne-swiver-leve-des-fonds-aupres-de-l-assureur-carte-et-cible-de-nouveaux-marches).
- Décembre 2021 : partenariat commercial avec **Ooredoo Tunisie** (opérateur télécom leader) — les abonnés
  Ooredoo Business accèdent à la solution ERP Swiver via un abonnement intégré au forfait entreprise — [ilBoursa](https://www.ilboursa.com/marches/ooredoo-conclut-un-partenariat-avec-la-startup-swiver_31821) ; [WebManagerCenter, 2021](https://www.webmanagercenter.com/2021/12/14/477374/ooredoo-et-la-startup-swiver-la-main-dans-la-main-pour-lentreprise-tunisienne/) ; [Tunisie Numérique](https://www.tunisienumerique.com/ooredoo-conclut-un-partenariat-avec-la-startup-swiver/).
- **Septembre 2026** : Swiver obtient l'homologation officielle de l'**ANCE** (Agence Nationale de Certification
  Électronique) et du ministère des Technologies de la Communication, ce qui permet aux entreprises utilisatrices
  de signer légalement leurs factures électroniques **directement depuis l'application**, dans un cadre reconnu par
  l'État, sans recourir à un prestataire de signature externe supplémentaire. Les utilisateurs peuvent signer avec
  la **même clé USB certifiée ANCE** qu'ils utilisent déjà pour leurs démarches auprès de la CNSS — une seule clé
  centralise toutes les démarches officielles. L'étape de signature s'intègre automatiquement dans le flux de
  facturation existant, et chaque document signé via la plateforme a une valeur probante certifiée. Information
  reprise par de nombreux médias tunisiens le même jour/la même semaine : Managers.tn, La Presse de Tunisie,
  Business News, Tekiano, Réalités Magazine, Entreprises Magazine, AllAfrica — [Managers.tn, 17/09/2026](https://managers.tn/2026/09/17/swiver-obtient-lhomologation-de-lance-la-facturation-electronique-devient-enfin-simple-pour-les-entreprises-tunisiennes/) ; [La Presse, 17/09/2026](https://www.lapresse.tn/2026/09/17/swiver-obtient-lhomologation-de-lance-la-facturation-electronique-devient-enfin-simple-pour-les-entreprises-tunisiennes/) ; [Business News, 11/09/2026](https://businessnews.com.tn/2026/09/11/swiver-obtient-lhomologation-de-lance-la-facturation-electronique-devient-enfin-simple-pour-les-entreprises-tunisiennes/1418073/) ; [Tekiano, 10/09/2026](https://www.tekiano.com/2026/09/10/la-plateforme-swiver-obtient-lhomologation-de-lance-pour-une-facturation-electronique-plus-simple).
- Effectif : **17 employés**, siège social à Tunis, secteurs SaaS et FinTech (donnée PitchBook, date de la
  photographie non précisée dans le résumé obtenu, probablement 2025-2026) — [PitchBook (via recherche)](https://pitchbook.com/profiles/company/483543-64).
- Trajectoire du nombre de clients (chiffres publiés par la presse ou le site à des dates différentes, donc à lire
  comme une **série chronologique**, pas un chiffre unique) : ~151 clients dans 17 secteurs (période non précisée,
  probablement ~2018) ; objectif annoncé de 5 000 clients en Tunisie/Algérie/Maroc sous deux ans (même période) ;
  franchissement de la barre des **10 000 utilisateurs** en **novembre 2020** — [Managers.tn, 12/11/2020](https://managers.tn/2020/11/12/swiver-la-startup-tunisienne-qui-a-franchi-la-barre-des-10-000-utilisateurs/) ; plus de **13 000 clients actifs** dans près de 380 secteurs d'activité en **décembre 2021** (au moment du partenariat Ooredoo) — [ilBoursa, 2021](https://www.ilboursa.com/marches/ooredoo-conclut-un-partenariat-avec-la-startup-swiver_31821) ; revendication plus récente et non datée précisément sur le site de Swiver lui-même de « plus de **14 000 clients satisfaits** » — [swiver.io (via recherche)](https://swiver.io/).

### Inferences
- Swiver a la trajectoire de croissance la mieux documentée par la presse indépendante des trois éditeurs — c'est
  clairement l'acteur le plus « installé » historiquement (10 ans d'existence en 2026, VS Hesabi et Finco dont
  l'ancienneté n'a pas pu être établie / Finco lancé en octobre 2025 seulement).
- L'homologation ANCE directe de septembre 2026 est un événement récent et significatif : c'est un argument de
  vente que Swiver peut désormais utiliser en marketing (« zéro prestataire externe pour signer ») qui, si Hesabi
  dépend bien de NGSign, place Swiver en position plus favorable sur ce point précis face à Hesabi. Il faut
  vérifier si Finco a le même statut (voir section Finco : ANCE/TunTrust en mars 2026, formulation proche mais pas
  identique — « certifié par » plutôt que « homologation directe pour signer sans tiers », nuance à clarifier).
- Le chiffre « 17 employés » (PitchBook) est probablement sous-estimé ou périmé au vu de 10+ ans d'activité et de
  13-14 000 clients revendiqués — à prendre avec précaution, PitchBook n'actualise pas toujours ses profils.

### Gaps
- Montant exact de la levée de fonds de 2018 n'a été donné qu'en ordre de grandeur (« demi-million de dinars ») —
  aucun chiffre précis au dinar près trouvé.
- Aucune levée de fonds postérieure à 2018 trouvée (la valorisation à 7 M TND en 2022 pourrait provenir d'un second
  tour non documenté dans les sources obtenues, ou d'une estimation) — à vérifier.
- Date exacte de la « fondation » réelle reste ambiguë entre janvier 2015 (conception) et 2016 (lancement
  commercial) selon les sources.
- Nom du ou des co-fondateurs autres qu'Azzam Soualmia : non trouvé (les articles parlent d'« deux amis » qui ont
  porté juridiquement la société, sans les nommer).

---

## Swiver — fonctionnalités

### Takeaway
Le site de Swiver documente une gestion commerciale et financière assez large (facturation, achats/dépenses,
stock, trésorerie multi-comptes, relance SMS, cachets électroniques, accès comptable gratuit) et une comptabilité
de base (factures d'achat/vente, relevés bancaires, immobilisations, inventaires). **Aucune trace de paie/CNSS/IRPP
ni de caisse (POS)** n'a été trouvée sur son propre site — cohérent avec ce que Hesabi affirme (à charge) dans son
comparatif. Aucune information sur une application mobile, une API ou du offline n'a pu être trouvée.

### Cited Findings
- Fonctionnalités listées sur les pages produit de Swiver : émission de devis et factures en quelques clics,
  numérotation automatique conforme aux normes comptables, gestion des achats et dépenses, gestion des stocks,
  gestion des ventes, module Finances-Trésorerie — [swiver.io/fonctionnalites/](https://swiver.io/fonctionnalites/) (via recherche).
- Conversion instantanée de « factures PDF classiques » en fichiers TEIF signés conformes aux exigences de
  l'administration fiscale — [swiver.io (via recherche)](https://swiver.io/).
- Comptabilité couverte, selon le blog Swiver lui-même : comptabilisation des factures d'achat et de vente, des
  relevés et cartes bancaires, des immobilisations acquises ou cédées, et des inventaires ; génération d'états
  financiers en temps réel, suivi de trésorerie, état bancaire et état de caisse — [swiver.io/blog/logiciel-comptabilite-et-gestion-en-ligne/](https://swiver.io/blog/logiciel-comptabilite-et-gestion-en-ligne/).
- Module Finances-Trésorerie : fonctionnalité « multi-comptes » pour suivre la performance financière par projet ;
  génération automatique de bordereaux de dépôt de chèques reconnus par toutes les banques tunisiennes ; relance
  des impayés par SMS en un clic ; accès gratuit donné au comptable de l'entreprise pour suivi — [swiver.io/fonctionnalites/finances-tresorerie/](https://swiver.io/fonctionnalites/finances-tresorerie/).
- Fonctionnalités ajoutées en 2024 : duplication en un clic des factures et devis (sans ressaisie), automatisation
  des relances de paiement par SMS, ajout de cachets électroniques sur toutes les factures et bons de commande —
  [swiver.io (via recherche, page non identifiée précisément — probablement le blog ou une page « nouveautés »)].
- Le comparatif Hesabi vs Swiver (source à charge, Hesabi) affirme que Swiver **n'a pas** de caisse (POS), de
  portail B2B, ni de paie CNSS intégrée documentée — [hesabi.tn/hesabi-vs-swiver](https://hesabi.tn/hesabi-vs-swiver).
- Aucune fonctionnalité paie/CNSS/IRPP n'a été trouvée documentée sur les propres pages de Swiver malgré une
  recherche ciblée — cohérent avec l'affirmation de Hesabi ci-dessus.
- Aucune fonctionnalité de caisse/POS n'a été trouvée documentée sur les pages de Swiver.
- Aucune information sur une application mobile Android/iOS, une API publique, une intégration e-commerce/paiement
  en ligne, ou un mode hors-ligne n'a pu être trouvée pour Swiver malgré plusieurs recherches ciblées.

### Inferences
- Swiver semble positionné sur la **gestion commerciale et financière** (devis, factures, achats, stock,
  trésorerie, comptabilité de base) plutôt que sur une comptabilité complète au sens PCG-TN, et n'a manifestement
  pas de module paie ni de caisse — c'est un profil plus proche d'un « logiciel de facturation/gestion » que d'un
  ERP complet, malgré la dénomination « ERP » employée par certaines sources de presse (ilBoursa, jeuneafrique).
  Cela correspond à sa cible historique : artisans et TPE (« Swiver facilite la vie des artisans et des gérants de
  TPE », Jeune Afrique).

### Gaps
- Paie/CNSS/IRPP, caisse/POS, application mobile, API/intégrations, mode hors-ligne, multi-entreprises,
  multi-devise : aucune confirmation ni infirmation directe trouvée sur le site de Swiver (seule l'absence
  apparente dans les pages trouvées, et l'affirmation à charge de Hesabi, permettent de conclure prudemment à une
  probable absence de paie et de caisse).

---

## Swiver — tarifs

### Takeaway
Les chiffres trouvés sont **partiellement contradictoires** et doivent être revérifiés directement : un essai
« premium » de 14 jours (ou 15 jours selon une autre source) sans limitation ; un plan à 70 TND HT/mois facturé
mensuellement ; des options annuelles à 550 TND HT (réduit à 450 TND HT) et à 600 TND HT ; une garantie
« satisfait ou remboursé » de 30 jours selon une source et de 90 jours selon une autre. Un résumé de recherche a
même affirmé à tort que « Swiver est gratuit » — ce qui contredit les prix ci-dessus et doit être traité comme une
erreur de synthèse du moteur de recherche, pas un fait.

### Cited Findings
- Essai gratuit de 14 jours donnant accès à la version premium sans limitation de fonctionnalités —
  [swiver.io/tarifs/](https://swiver.io/tarifs/) (via recherche) ; une autre source parle de 15 jours — source non
  identifiable précisément, contradiction non résolue.
- Un plan seul a été chiffré : 70 TND HT/mois en facturation mensuelle — [swiver.io/plans-et-tarification/](https://swiver.io/plans-et-tarification/) (via recherche).
- Options annuelles trouvées : 550 TND HT/an réduit à 450 TND HT/an ; et, séparément, 600 TND HT/an — sans qu'il
  soit possible de déterminer avec certitude s'il s'agit de deux plans différents (ex. « Swiver Economic » vs un
  plan supérieur) ou de la même offre citée à deux moments différents — [swiver.io/swiver-economic/](https://swiver.io/swiver-economic/) ; [swiver.io/tarifs/](https://swiver.io/tarifs/).
- Garantie « satisfait ou remboursé » : citée à 30 jours dans un résultat, à 90 jours dans un autre — contradiction
  non résolue, à vérifier directement sur `swiver.io/termes/`.
- Une page dédiée « Swiver Economic » existe, suggérant une offre d'entrée de gamme séparée pour très petites
  structures, dont le contenu précis n'a pas pu être établi — [swiver.io/swiver-economic/](https://swiver.io/swiver-economic/).

### Inferences
- Les 70 TND/mois (≈ 840 TND/an payé mensuellement) contre 450-600 TND/an en engagement annuel suggèrent une
  réduction de l'ordre de 30 à 45 % pour le paiement annuel, une pratique commerciale courante — mais ce calcul
  reste une déduction, pas un fait confirmé par une seule page tarifs lue in extenso.
- Le tarif Swiver semble se situer dans la même fourchette que le palier Pro de Hesabi (790 TND/an) une fois annualisé,
  peut-être légèrement en dessous — comparaison à confirmer avec des chiffres vérifiés.

### Gaps
- Impossible, avec les seuls résumés de recherche obtenus, de reconstituer une grille tarifaire propre (nombre de
  plans, ce que chacun contient précisément, prix HT/TTC, nombre d'utilisateurs par plan, limites de documents).
  **Point à vérifier en priorité** avant toute comparaison publique, en ouvrant directement `swiver.io/tarifs/`
  depuis un poste non bloqué.

---

## Swiver — forces, faiblesses, avis clients

### Takeaway
Aucun avis client indépendant (Trustpilot, Google, Facebook, forums, app stores) n'a été trouvé pour Swiver malgré
plusieurs recherches ciblées — comme pour Hesabi et Finco. En revanche, Swiver dispose d'une **couverture presse
substantielle** (voir section Faits d'entreprise), ce qui constitue en soi un indicateur de notoriété/crédibilité
que les deux autres n'ont pas au même degré.

### Cited Findings
- Recherche dédiée « Swiver avis négatif problème client plainte forum » : aucun résultat pertinent sur Swiver
  lui-même n'a été retourné.
- Recherche dédiée « Swiver Google Play application mobile note avis » : aucun résultat pertinent sur une
  application Swiver n'a été retourné, suggérant soit l'absence d'application mobile listée sous ce nom sur les
  stores, soit une indexation insuffisante.

### Inferences
- Forces déductibles : ancienneté (10 ans), partenariat de distribution avec un opérateur télécom national
  (Ooredoo), couverture presse régulière et récente (obtention de l'homologation ANCE relayée par sept médias
  tunisiens différents en une semaine en septembre 2026) — signe d'un service de relations presse actif et d'une
  actualité produit suivie par les médias économiques tunisiens.
- Faiblesse déductible : pas de comptabilité complète ni de paie/CNSS documentées, pas de caisse — un profil plus
  étroit que Hesabi sur le papier, malgré une base installée bien plus large et plus ancienne.
- L'histoire personnelle du fondateur (interdiction bancaire, enquête judiciaire classée en 2022) est un fait de
  presse notable qui pourrait ressortir dans une due diligence ou une recherche d'un client prudent — à noter sans
  jugement, la presse tunisienne elle-même la présente comme une histoire de résilience entrepreneuriale plutôt
  qu'un signal négatif.

### Gaps
- Aucun avis client trouvé, positif ou négatif, sur aucune plateforme.
- Aucune présence d'application mobile confirmée ou infirmée avec certitude.

---

## Swiver — positionnement marketing et canaux de vente

### Takeaway
Swiver combine SEO (pages fonctionnalités, blog réglementaire sur TEIF/El Fatoora), relations presse actives
(nombreux relais media tunisiens), et un canal de distribution institutionnel unique parmi les trois : un
partenariat avec **Ooredoo Tunisie** qui intègre Swiver dans les forfaits Ooredoo Business.

### Cited Findings
- Ooredoo (premier opérateur télécom tunisien) a conclu un partenariat avec Swiver en décembre 2021 pour
  accompagner ses clients entreprises dans leur transformation digitale ; les abonnés Ooredoo Business
  bénéficient d'un abonnement intégré à la solution ERP Swiver — [ilBoursa](https://www.ilboursa.com/marches/ooredoo-conclut-un-partenariat-avec-la-startup-swiver_31821) ; [WebManagerCenter](https://www.webmanagercenter.com/2021/12/14/477374/ooredoo-et-la-startup-swiver-la-main-dans-la-main-pour-lentreprise-tunisienne/).
- Un programme d'affiliation/ambassadeur existe (« Programme ambassadeur — Swiver logiciel de gestion
  d'entreprise en Tunisie »), suggérant un canal de recommandation payant/incentivé — [swiver.io/programme-ambassadeur-affiliation/](https://swiver.io/programme-ambassadeur-affiliation/) (via recherche).
- Contenu de blog réglementaire actif sur la facturation électronique (El Fatoora, TTN, amendes 2025) — plusieurs
  articles trouvés : « La Révolution de la Facture Électronique en Tunisie », « TTN et Facturation Électronique :
  Le Guide Essentiel », « La Facturation Électronique en Tunisie : Obligation Totale et Amendes 2025 » —
  [swiver.io/blog/](https://swiver.io/blog/la-revolution-de-la-facture-electronique-en-tunisie/) (via recherche).
- L'annonce de l'homologation ANCE de septembre 2026 a été relayée le même jour ou la même semaine par au moins
  sept médias économiques et généralistes tunisiens distincts (Managers, La Presse, Business News, Tekiano,
  Réalités, Entreprises Magazine, AllAfrica) — signe d'un communiqué de presse largement diffusé — voir sources
  citées plus haut.

### Inferences
- Le canal Ooredoo est un avantage compétitif de distribution que ni Hesabi ni Finco ne semblent avoir (aucune
  trace de partenariat opérateur télécom trouvée pour les deux autres) — c'est probablement le canal
  d'acquisition B2B le plus efficace des trois en volume, touchant potentiellement toute la base client
  entreprise d'Ooredoo.
- L'usage systématique des relations presse pour chaque annonce produit (contrairement à Hesabi, invisible dans
  la presse) suggère une équipe communication plus structurée ou plus ancienne chez Swiver.

### Gaps
- Montant/nature exacte du partenariat Ooredoo (commission, part de revenu, exclusivité) : non trouvé.
- Réseau de cabinets comptables partenaires pour Swiver : non trouvé explicitement (le texte marketing mentionne
  un « accès gratuit pour le comptable » du client, ce qui est une fonctionnalité produit, pas nécessairement un
  canal de vente structuré vers les cabinets).

---

## Swifto ERP — à ne pas confondre avec Swiver

### Takeaway
**Swifto ERP (swifto.io) n'est PAS lié à Swiver** malgré la proximité des noms : c'est un ERP concurrent distinct,
édité par la société **SYMATIQUE**, basée à Ariana et Tunis. Il revendique plus de 500 entreprises tunisiennes
clientes et publie lui-même un comparatif d'ERP tunisiens (à traiter comme une source à charge, comme les pages
Hesabi).

### Cited Findings
- Swifto ERP est un logiciel de gestion cloud qui centralise ventes, achats, stock, finance, ressources humaines et
  relation client pour les PME tunisiennes sur une seule plateforme, avec applications mobiles pour les équipes
  terrain ; fourni par la société **SYMATIQUE**, basée à Ariana et Tunis — [swifto.io](https://www.swifto.io/) (via recherche).
- Plus de 500 entreprises tunisiennes utiliseraient Swifto pour gérer leurs opérations (chiffre de l'éditeur, non
  vérifié indépendamment) — [swifto.io](https://www.swifto.io/) (via recherche).
- Swifto publie une page « Meilleur ERP en Tunisie : comparatif 2026 » — pratique marketing identique à celle de
  Hesabi (pages de comparaison auto-publiées) — [swifto.io/comparatif-erp-tunisie.html](https://www.swifto.io/comparatif-erp-tunisie.html).
- Swifto documente lui aussi un module paie/RH avec CNSS, IRPP, CSS — [swifto.io/pages/fonctionnalites/rh.html](https://www.swifto.io/pages/fonctionnalites/rh.html).
- Swifto documente une gestion de la facturation électronique TEIF/El Fatoora dans son manuel produit —
  [swifto.io/manuel/initiale/signature-electronique.html](https://www.swifto.io/manuel/initiale/signature-electronique.html).

### Inferences
- Swifto ERP est un **quatrième concurrent potentiel** à surveiller (ERP généraliste plus complet que Swiver sur le
  papier — paie + TEIF + multi-modules), même s'il n'était pas dans le périmètre demandé. Il partage un nom proche
  de Swiver, ce qui peut prêter à confusion commerciale sur le marché tunisien — à noter pour éviter toute erreur
  dans un document de positionnement.

### Gaps
- Tarifs, ancienneté, fondateurs et niveau de complétude comptable de Swifto ERP : non recherchés en détail (hors
  périmètre strict de la mission, mentionné seulement comme demandé).

---

## Finco — faits d'entreprise et certifications

### Takeaway
Finco est le plus jeune des trois : co-fondé début 2025 par **Ridha Bouzguenda**, lancé officiellement en
**octobre 2025**, et certifié **ANCE/TunTrust en mars 2026** pour la facturation électronique. Deux implantations :
Monastir et Tunis. Revendique plus de 300 entreprises clientes — un chiffre optimiste pour une société de moins
d'un an d'existence au moment de la revendication, à prendre avec prudence.

### Cited Findings
- Finco a été co-fondé par **Ridha Bouzguenda** début 2025, avec des co-fondateurs non nommés et une équipe
  d'ingénieurs tunisiens, pour livrer un outil pensé pour les réalités locales : devis, factures, ventes, achats,
  stock, paiements, clients et fournisseurs, avec TVA, retenue à la source et IRPP intégrés au produit dès la
  conception — [finco.tn/en/a-propos (via recherche)](https://finco.tn/en/a-propos).
- **Ridha Bouzguenda** est présenté comme un entrepreneur tunisien et coach en gestion d'entreprise et
  entrepreneuriat, ayant accompagné plus de 2 000 entreprises tunisiennes sur leurs enjeux de digitalisation,
  fiscalité et conformité — [finco.tn/en/a-propos (via recherche)](https://finco.tn/en/a-propos).
- Finco a été officiellement lancé en **octobre 2025** et certifié par **ANCE/TunTrust en mars 2026** pour la
  facturation électronique — [finco.tn/en/a-propos (via recherche)](https://finco.tn/en/a-propos).
- Finco est présenté (par une synthèse de recherche s'appuyant sur son propre site) comme « approuvé par ANCE
  TUNTRUST », gérant le processus complet : génération TEIF, signature électronique et communication directe avec
  la TTN — [finco.tn/blog/guide-complet-facturation-electronique-tunisie (via recherche)](https://finco.tn/blog/guide-complet-facturation-electronique-tunisie).
- Deux implantations : Zone du Stade, Immeuble Les Jardins B3, Monastir 5000 ; et 20 rue Mahmoud Ghaznaoui,
  Menzah 4, 1004 Tunis — [finco.tn/en/contact (via recherche)](https://finco.tn/en/contact).
- Finco revendique accompagner plus de **300 entreprises tunisiennes** dans leur facturation, gestion d'entreprise
  et opérations commerciales quotidiennes — [finco.tn/en/ (via recherche)](https://finco.tn/en/).
- Coordonnées trouvées : contact@finco.tn, +216 28 244 193 / +216 24 246 510 — [finco.tn/en/contact (via recherche)](https://finco.tn/en/contact).
- Finco revendique un « écosystème de partenaires technologiques, institutionnels et universitaires » —
  [finco.tn/partners (via recherche)](https://finco.tn/partners).

### Inferences
- Le profil du fondateur (coach en gestion/digitalisation ayant travaillé avec 2 000+ entreprises tunisiennes,
  plutôt qu'un profil technique pur) suggère une approche produit construite à partir d'une connaissance fine des
  besoins terrain des PME tunisiennes, et un réseau de contacts déjà large pour l'acquisition initiale de clients —
  cohérent avec le chiffre de 300 clients revendiqué à peine un an après le lancement.
- La certification ANCE/TunTrust de mars 2026, si elle est du même type que celle obtenue par Swiver en septembre
  2026 (homologation directe pour signer sans prestataire tiers), positionnerait Finco et Swiver au même niveau sur
  ce point précis, tous deux devant potentiellement Hesabi (dépendant de NGSign) — **mais la formulation exacte des
  deux certifications diffère dans les sources trouvées** (« certifié par ANCE/TunTrust » pour Finco vs
  « homologation de l'ANCE… permettant de signer directement depuis l'application » pour Swiver), et il n'a pas été
  possible de confirmer que les deux processus sont strictement équivalents. À vérifier avant toute affirmation
  comparative publique.

### Gaps
- Nom des autres co-fondateurs de Finco : non trouvé.
- Effectif de Finco : non trouvé.
- Toute levée de fonds pour Finco : non trouvée (les recherches n'ont fait remonter que des sociétés homonymes
  sans rapport, en France notamment — Finom, Fincome, FinCo Capital).
- Nature exacte de la certification ANCE/TunTrust de Finco (homologation directe vs partenariat avec un tiers
  homologué) : ambiguë dans les sources trouvées.

---

## Finco — fonctionnalités

### Takeaway
Finco se positionne clairement sur la **facturation et la gestion commerciale de base** (devis, factures, ventes,
achats, stock, paiements, tiers) avec TVA/retenue à la source/IRPP intégrés, plutôt que sur une comptabilité
complète. Selon le comparatif publié par Hesabi (source à charge), Finco n'aurait ni portail multi-clients pour
experts-comptables, ni export TEJ en masse, ni comptabilité générale complète — et se distinguerait par une
interface soignée et des pages dédiées par secteur d'activité (ex. sociétés informatiques).

### Cited Findings
- Produit conçu autour de : devis, factures, ventes, achats, stock, paiements, clients et fournisseurs, avec TVA,
  retenue à la source et IRPP intégrés au produit — [finco.tn/en/a-propos (via recherche)](https://finco.tn/en/a-propos).
- Pages fonctionnelles trouvées : gestion commerciale (`finco.tn/en/fonctionnalites/gestion-commerciale`),
  facturation verticale par métier, ex. sociétés informatiques (`finco.tn/en/facturation/societe-informatique`) —
  suggérant une stratégie de landing pages par secteur.
- Outil gratuit d'appel (lead generation) : générateur de facture PDF gratuit en ligne —
  [finco.tn/outils/generateur-facture](https://finco.tn/outils/generateur-facture).
- Contenu pédagogique sur la retenue à la source et la plateforme TEJ, orienté vers l'échéance 2026 : « En 2026,
  tout passe par la plateforme Tej — préparez votre retenue à la source » (vidéo Facebook/Instagram) —
  [facebook.com/finco.tn (via recherche)](https://www.facebook.com/finco.tn/videos/en-2026-tout-passe-par-la-plateforme-tej-pr%C3%A9parez-votre-retenue-%C3%A0-la-source-en-q/1146175364348419/).
- Selon le comparatif de Hesabi (source à charge, non confirmée indépendamment) : « Finco offre une interface
  soignée pour la facturation de base mais ne propose pas de portail multi-clients pour experts-comptables, pas
  d'export TEJ multi-clients, ni de comptabilité générale complète » ; Finco serait « particulièrement conçu pour
  les sociétés tech » — [hesabi.tn/hesabi-vs-finco](https://hesabi.tn/hesabi-vs-finco).

### Inferences
- Le positionnement observé (landing pages sectorielles, outil gratuit de génération de facture, contenu
  pédagogique fiscal) indique une stratégie d'acquisition orientée **PME et indépendants**, avec un accent fort
  sur la simplicité et la mise en conformité fiscale rapide (retenue à la source, TEJ 2026) plutôt que sur la
  profondeur fonctionnelle (pas de paie, pas de comptabilité complète documentée).

### Gaps
- Paie/CNSS, caisse/POS, stock multi-dépôts, application mobile, API, mode hors-ligne, multi-entreprises,
  multi-devise pour Finco : aucune mention trouvée dans un sens ou dans l'autre (contrairement à Swiver où
  l'absence de paie/caisse est au moins indirectement confirmée par l'absence de mention). Pour Finco, c'est un
  vrai gap d'information, pas une absence déduite.

---

## Finco — tarifs

### Takeaway
Deux paliers identifiés : un plan **gratuit pour les auto-entrepreneurs** (sans engagement, résiliable à tout
moment, sans carte bancaire requise) et un plan **Pro à 49 TND/mois**. Aucun palier supérieur (type « Business » ou
« Cabinet ») n'a été trouvé, contrairement à Hesabi et à l'offre Cabinet gratuite/payante de SkanFact.

### Cited Findings
- Plan gratuit pour les auto-entrepreneurs, sans engagement, résiliable à tout moment, sans carte bancaire requise
  pour l'essai — [finco.tn/en/tarifs (via recherche)](https://finco.tn/en/tarifs).
- Plan Pro à **49 TND/mois**, incluant facturation électronique, gestion d'entreprise et support premium —
  [finco.tn/en/tarifs (via recherche)](https://finco.tn/en/tarifs).
- Une synthèse de recherche affirme que le plan gratuit donne « accès complet à toutes les fonctionnalités sans
  limite de temps » — affirmation à prendre avec prudence : elle contredit la logique commerciale habituelle d'un
  plan gratuit face à un plan payant à 49 TND/mois (588 TND/an), et pourrait être une erreur de synthèse du moteur
  de recherche mélangeant deux informations distinctes (accès sans limite de *durée*, mais pas sans limite de
  *fonctionnalités*) — à vérifier directement sur `finco.tn/en/tarifs`.

### Inferences
- Un plan unique payant (49 TND/mois, ≈ 588 TND/an s'il n'y a pas de remise annuelle) place Finco, une fois
  annualisé, dans une fourchette proche du palier Starter de Hesabi (390 TND/an) à un peu en dessous du palier Pro
  de Hesabi (790 TND/an) — mais sans les fonctionnalités de paie/comptabilité complète que Hesabi inclut dans son
  palier Pro, ce qui en ferait, si confirmé, une offre plus chère que Hesabi Starter pour un périmètre
  fonctionnel a priori comparable ou inférieur.

### Gaps
- Existe-t-il une remise pour un engagement annuel chez Finco (comme chez Swiver) ? Non trouvé.
- Existe-t-il un palier au-delà de Pro (multi-utilisateurs, Cabinet comptable, API) ? Non trouvé — semble absent,
  ce qui serait une différence structurelle par rapport à Hesabi (palier Cabinet) et à SkanFact (Cabinet gratuit/
  payant par dossier).
- HT ou TTC : non précisé dans les sources trouvées.

---

## Finco — forces, faiblesses, avis clients

### Takeaway
Aucun avis client indépendant trouvé (comme pour les deux autres éditeurs). Le seul signal de traction indépendant
trouvé est la reprise de la certification ANCE/TunTrust dans des synthèses de recherche générales sur la
facturation électronique tunisienne, aux côtés d'acteurs comme Fatoora.tn et Billown — sans que ces mentions
constituent un article de presse dédié à Finco comme c'est le cas pour Swiver.

### Cited Findings
- Une recherche dédiée « Finco.tn avis clients Google » n'a retourné aucun avis client, seulement une page Google
  Play pour une application nommée « finco » avec l'identifiant de paquet `finbot.finapp` — cet identifiant de
  paquet ne correspond pas visiblement au nom de domaine `finco.tn` et pourrait être une application sans rapport
  portant un nom similaire ; à vérifier avant de l'attribuer à Finco — [play.google.com/store/apps/details?id=finbot.finapp](https://play.google.com/store/apps/details?id=finbot.finapp&hl=en_US).
- Aucune plainte ni avis négatif trouvé (recherche non tentée spécifiquement pour Finco au-delà de la recherche
  d'avis générale, faute de matière à approfondir).

### Inferences
- Force déductible : profil du fondateur (expérience terrain avec 2 000+ PME tunisiennes) et positionnement
  clairement vertical (pages par métier) suggèrent une compréhension fine des irritants des petites entreprises
  tunisiennes en matière de facturation/fiscalité — un atout pour convaincre vite un premier segment de clients.
- Faiblesse déductible : structure organisationnelle et fonctionnelle apparemment plus légère que Hesabi et Swiver
  (pas de palier Cabinet, pas de paie documentée, pas de comptabilité complète, un seul plan payant) — cohérent
  avec son âge (lancé il y a moins d'un an au moment de cette étude).

### Gaps
- Aucun avis client trouvé sur aucune plateforme.
- L'application mobile « finco » sur Google Play (`finbot.finapp`) n'a pas pu être reliée avec certitude à
  finco.tn — à vérifier directement (le nom du package suggère plutôt un produit « FinBot »/finance personnelle,
  possiblement sans rapport).

---

## Finco — positionnement marketing et canaux de vente

### Takeaway
Finco mise sur du contenu pédagogique fiscal (blog, réseaux sociaux) centré sur l'échéance de la facturation
électronique 2026 et la retenue à la source/TEJ, des landing pages verticales par métier, et un outil gratuit de
génération de facture comme aimant à trafic. Contrairement à Hesabi, aucune page de comparaison directe
« Finco vs Hesabi » ou « Finco vs Swiver » n'a été trouvée du côté de Finco — c'est Hesabi qui publie les
comparatifs, pas l'inverse, ce qui suggère que Finco n'attaque pas frontalement ses concurrents dans sa
communication.

### Cited Findings
- Blog actif avec des articles réglementaires : « Facturation Électronique en Tunisie : le Guide Complet »,
  « Facturation électronique en Tunisie : ce que doivent savoir les prestataires de services en 2026 » —
  [finco.tn/blog (via recherche)](https://finco.tn/blog).
- Contenu vidéo Facebook/Instagram orienté pédagogie fiscale (retenue à la source, plateforme TEJ) —
  [facebook.com/finco.tn (via recherche)](https://www.facebook.com/finco.tn/).
- Landing pages verticales par secteur trouvées (ex. sociétés informatiques) — suggère une stratégie de contenu
  segmentée par métier plutôt que généraliste — [finco.tn/en/facturation/societe-informatique](https://finco.tn/en/facturation/societe-informatique).
- Outil gratuit « générateur de facture » comme aimant à trafic/leads — [finco.tn/outils/generateur-facture](https://finco.tn/outils/generateur-facture).
- Écosystème de partenaires « technologiques, institutionnels et universitaires » revendiqué, sans liste précise
  trouvée — [finco.tn/partners (via recherche)](https://finco.tn/partners).

### Inferences
- L'angle pédagogique fiscal (TEJ, retenue à la source, obligation 2026) semble être le principal levier
  d'acquisition de Finco actuellement, cohérent avec le calendrier réglementaire tunisien (généralisation de la
  facturation électronique aux prestataires de services au 1er janvier 2026) et avec le profil du fondateur (coach
  en conformité/digitalisation).

### Gaps
- Volume de trafic, budget publicitaire, présence en publicité payante (Google Ads, Facebook Ads) : non
  recherchés/non trouvés.
- Réseau de cabinets comptables partenaires : mentionné en creux (« écosystème de partenaires ») mais sans détail.

---

## Synthèse rapide utile pour positionner SkanFact

### Takeaway
Les trois éditeurs sont des **SaaS web**, hébergés, accessibles depuis un navigateur/mobile, avec facturation
électronique TEIF native. Aucun des trois ne revendique de mode hors-ligne ni de stockage local des données —
c'est l'angle différenciant déjà identifié dans `ETUDE-HESABI.md` et il tient tout autant face à Swiver et Finco.
Sur la signature électronique, Swiver a pris une avance récente (homologation ANCE directe, sept. 2026) que ni
Hesabi (dépendant apparemment de NGSign) ni SkanFact (qui dépend d'un contrat NGSign/DigiGo non encore signé,
selon `ETUDE-HESABI.md` § 4) ne peuvent revendiquer aujourd'hui.

### Cited Findings
- Les trois solutions sont des SaaS web (aucune mention d'application de bureau ou de stockage local trouvée pour
  Hesabi, Swiver ou Finco) — déduit de l'ensemble des sources ci-dessus.
- Swiver dispose, depuis septembre 2026, d'une signature électronique intégrée sans prestataire tiers (homologation
  ANCE directe) — voir sources citées dans la section Swiver ci-dessus.
- Finco revendique une certification ANCE/TunTrust depuis mars 2026, dont la nature exacte (directe ou via un
  tiers) reste ambiguë dans les sources trouvées — voir section Finco.
- Hesabi dépendrait de NGSign pour la signature, selon sa propre documentation (non confirmé de façon indépendante
  dans cette session) — voir section Hesabi.
- Seul Hesabi propose un palier dédié aux cabinets d'expertise comptable (« Cabinet », 2 490 TND/an) parmi les
  trois — ni Swiver ni Finco n'affichent d'offre équivalente dans les sources trouvées.
- Seul Swiver a un canal de distribution institutionnel documenté (partenariat Ooredoo).

### Inferences
- Sur la facture électronique, l'argument « pas de dépendance à un tiers pour signer » que SkanFact ne peut pas
  encore revendiquer (bloqué par un contrat NGSign/DigiGo non signé, cf. `ETUDE-HESABI.md` § 4) est en train de
  devenir un standard chez les concurrents SaaS (Swiver l'a, Finco le revendique) — c'est un chantier à traiter
  avec une priorité plus élevée qu'il n'y paraissait dans l'étude Hesabi initiale, car ce n'est plus un
  différenciateur Hesabi isolé mais une tendance de marché de septembre 2026.
- L'offre Cabinet gratuite de SkanFact (gratuite pour les dossiers sur SkanFact + trois hors SkanFact, payante
  au-delà) reste un argument fort et apparemment unique sur ce marché : aucun des trois concurrents étudiés
  n'offre de palier Cabinet gratuit ou même dédié pour Finco/Swiver.
- Le mode hors-ligne et les données stockées localement, chiffrées, chez le client, restent l'argument
  différenciant le plus solide et le plus simple à formuler face aux trois : aucun des trois n'y répond, tous
  étant des SaaS purement web.

### Gaps
- Impossible de confirmer avec certitude que **aucun** des trois n'a de fonctionnement hors-ligne partiel (cache
  navigateur, PWA) — seule l'absence de toute mention dans les sources trouvées permet cette déduction, pas une
  vérification technique directe.
- Impossible de comparer les tarifs des trois de façon fiable et à parts égales (HT/TTC non toujours précisé,
  plans annuels vs mensuels mélangés, contenu exact de chaque palier incomplet pour Swiver et Finco) — **toute
  ligne de prix dans un tableau comparatif public devra être revérifiée en ouvrant directement les trois sites**
  avant publication, comme le rappelait déjà `ETUDE-HESABI.md`.
