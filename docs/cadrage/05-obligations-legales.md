# 05 — Les obligations légales

*Proposé le 28/09/2026, relu le même jour contre tout le dépôt. **Validé par Skander le
28/09/2026**, avec l'inscription anticipée à la plateforme d'homologation des caisses. Rassemble ce que la loi impose à nos clients (et
donc à SkanFact), ce qu'elle impose à SkanFact lui-même, et les démarches à lancer. Sources :
`docs/etudes/notes-de-recherche/marche-2026/cadre_legal.md`, `docs/etudes/ETUDE-MARCHE.md` (§ « 2026
impose un calendrier légal serré » et « À vérifier »), `docs/application-actuelle/e-facture-controle.md`,
et deux recherches faites le 28/09/2026 (§ 9). **Complété le même jour, après validation**, pour
suivre le `14` : la restauration et la caisse (§ 3.7), les flux des intégrations (§ 4.3), le Startup
Act (§ 4.8), une démarche (§ 5) et des questions (§ 6). **À revalider.***

## En bref (pour Skander)

**Rien dans ce document n'est un avis juridique.** C'est une carte : ce qu'on sait, d'où on le
sait, et **à qui** il faut le faire confirmer. La plupart des sites officiels tunisiens étaient
inaccessibles depuis notre environnement de travail. Nos sources sont donc souvent des résumés de
cabinets ou de journaux, jamais le texte de loi lu en entier. C'est pourquoi presque tout porte
**À VÉRIFIER**, avec le nom de la personne ou de l'organisme qui peut trancher.

Ce qu'il faut retenir :
1. **La facture électronique (TTN, El Fatoora) est obligatoire pour les prestataires de services
   depuis le 1er janvier 2026.** C'est notre premier argument de vente, et c'est une obligation
   de résultat : sans l'accusé de la TTN, la facture n'a pas de valeur fiscale.
2. **La caisse certifiée n'est pas une formalité de fin de projet.** Elle passe par une plateforme
   d'homologation du ministère des Finances, avec un cahier des charges, des **tests d'intégration**
   avec un système central, et une demande d'accréditation du fournisseur. **Cette démarche est
   avancée au début du développement** (validé par Skander le 28/09/2026), et non à la fin comme
   décidé le 27/09 (§ 3.7, § 5).
3. **Les attestations de retenue à la source passent par TEJ.** Une attestation mal établie coûte
   30 % de la retenue, 50 DT au moins. Le produit doit produire le fichier officiel.
4. **SkanFact lui-même** doit émettre des factures électroniques, déclarer ses traitements à
   l'INPDP, protéger sa marque, et peut-être faire un audit annuel de cybersécurité.
5. **Une liste de questions par interlocuteur** (§ 6) : pour le comptable, le juriste, l'Ordre, la
   TTN, TunTrust, la DGI et la CNSS. Ton père peut les emporter à chaque rendez-vous.

---

## 1. Comment lire ce document

Chaque obligation porte un **état de la connaissance** :

| État | Sens |
|---|---|
| **Lu** | Le texte ou la spécification officielle a été lu (c'est le cas du schéma TEIF 1.8.8, lu pour la 10.15.0) |
| **Rapporté** | Plusieurs sources secondaires concordantes (cabinets, presse), texte officiel non lu |
| **Incertain** | Une seule source, ou des sources qui se contredisent |
| **Inconnu** | Rien de fiable trouvé |

Une obligation « Rapportée » suffit pour **concevoir** : on construit ce qu'elle demande. Elle ne
suffit jamais pour **promettre** sur le site ou dans un contrat. C'est la règle de l'étude de
marché : tout ce qui n'a pas été lu à la source se reformule prudemment.

---

## 2. Tableau d'ensemble

| # | Obligation | Qui est visé | Ce que SkanFact fait | État | Qui confirme |
|---|---|---|---|---|---|
| 3.1 | Facture électronique TEIF par la TTN | Prestataires de services (LF 2026, art. 53), et les catégories déjà visées avant | Écrit le TEIF, le fait signer, l'envoie, garde l'accusé et le QR code, archive 10 ans | Rapporté ; schéma TEIF **lu** | TTN |
| 3.2 | Signature électronique qualifiée | Toute facture électronique | DigiGo intégré, clé USB, puis signature serveur | Rapporté | ANCE, TunTrust |
| 3.3 | Attestations de retenue à la source par TEJ | Tout débiteur d'une retenue | Produit le fichier XML officiel | Rapporté | DGI |
| 3.4 | Déclaration mensuelle (e-jibaya) | Assujettis | Prépare les montants à copier, par case | Rapporté | DGI, comptable |
| 3.5 | Liasse fiscale en XML (F6001 à F6006) | Sociétés au réel | Produit les fichiers XML | Rapporté | DGI, comptable |
| 3.6 | Déclarations CNSS | Employeurs | Produit le fichier trimestriel et la déclaration d'employeur | Rapporté ; format DS 2012 **lu** pour la v10 | CNSS |
| 3.7 | Caisse enregistreuse certifiée | Consommation sur place, puis généralisation jusqu'en 2028 | Module Caisse homologué | Rapporté (calendrier) ; exigences techniques **inconnues** | Ministère des Finances (plateforme NACEF) |
| 3.8 | Conservation 10 ans | Toute entreprise | Archive non modifiable, export à tout moment | Rapporté | Juriste |
| 3.9 | Mentions obligatoires des pièces | Toute entreprise | Moteur de l'application actuelle, porté | Appliqué dans la v10, **à confirmer** | Comptable |
| 3.10 | Barèmes de paie et taxes sur salaires | Employeurs | Règles datées (`01` R11) | Appliqué dans la v10, **à confirmer** chaque année | Comptable |
| 4.1 | Nos propres factures électroniques | SkanFact | Émises par la plateforme elle-même (`01` § 18) | Rapporté | TTN |
| 4.2 | TVA et retenue sur notre abonnement | SkanFact et ses clients | Réglage de notre facture ; prix publiés en conséquence | **Incertain** | Fiscaliste |
| 4.3 | Données personnelles (loi organique 2004-63) | SkanFact | Déclarations INPDP, contrat de traitement, hébergement en Tunisie | Rapporté | INPDP, juriste |
| 4.4 | Audit de cybersécurité (décret-loi 2023-17) | Hébergeurs et prestataires cloud | Budget et calendrier | **Incertain** (périmètre) | ANCS, juriste |
| 4.5 | Contrats et pages légales | SkanFact | Conditions, confidentialité, contrat de traitement, réversibilité | À écrire | Juriste |
| 4.6 | Marque, nom de domaine | SkanFact | Dépôt INNORPI **dès que la société est choisie** (le nom est déjà public) | À faire | INNORPI |
| 4.7 | Déontologie des experts-comptables | Les cabinets | Pas de commission, pas d'annuaire au lancement, accès après mandat | **Incertain** | Ordre des experts-comptables |

---

## 3. Ce que la loi impose à nos clients (donc au produit)

### 3.1 La facture électronique (TTN, El Fatoora)

**Ce qu'on sait** (Rapporté) :
- l'article 53 de la loi de finances 2026 étend l'obligation à **tous les prestataires de
  services**, depuis le 1er janvier 2026 ; plus de 380 000 professionnels seraient concernés ;
- l'amende serait de **100 à 500 DT par facture papier** émise en infraction, plafonnée à
  **50 000 DT par an** ;
- le parcours : fichier XML **TEIF**, signé en **XAdES**, envoyé à la TTN par **service web (SOAP)**
  ou par SFTP ; la TTN rend un **accusé** (ou un refus motivé), un identifiant unique, sa propre
  signature et un **QR code**. **Sans cet accusé, la facture n'a pas de valeur fiscale** ;
- l'entreprise doit **adhérer** à El Fatoora (en ligne depuis le 15/02/2026 : adhesion.elfatoora.tn) ;
- archivage **10 ans**.

**Ce qui est déjà fait** : l'application actuelle écrit le TEIF **1.8.8** (lu, validé contre le
schéma sur les 278 pièces émises de l'exemple, 10.15.0). Les identités sont complètes : matricule à
treize caractères, CIN ou carte de séjour pour un particulier, identifiant pour un étranger.

**Ce que la plateforme ajoute** (vision § 5) :
- la **file d'envoi** côté serveur, avec reprise, sans jamais envoyer deux fois la même facture
  (vision R5) ;
- l'**état** de chaque facture : préparée, signée, envoyée, **acceptée** (identifiant et QR code),
  **refusée** (motif) ;
- **le fichier est contrôlé contre le schéma TEIF avant la prise du numéro** (`01` § 6 : le contrôle
  passe avant l'attribution), avec les identités et les champs obligatoires. Un refus de la TTN
  devient ainsi l'exception, pas la règle ;
- **une facture refusée par la TTN** garde son numéro, puisqu'un numéro ne se reprend pas (`01`
  § 6). Elle reste « refusée », avec le motif et le bouton qui corrige. La correction passe par un
  avoir et une nouvelle facture, ou par un renvoi si la TTN le permet. **À VÉRIFIER** avec la TTN :
  ce qu'une facture refusée devient légalement, et si l'on peut la renvoyer corrigée sous le même
  numéro ;
- le QR code et l'identifiant **imprimés** sur le PDF, et l'archive du XML signé (§ 3.8) ;
- dans « Tes premiers pas », l'**adhésion à El Fatoora** expliquée pas à pas, avec le lien.

**À VÉRIFIER** (TTN) :
1. la version du schéma en vigueur (1.8.7 selon une source, 1.8.8 lu par nous) ;
2. le canal pour un éditeur : SOAP, SFTP, ou les deux ; l'authentification ; l'environnement de test
   (déjà dans les démarches, vision § 9) ;
3. qui exactement est obligé : un seuil, une exception pour les très petites entreprises, les
   **tickets de caisse** (sont-ils concernés, ou seulement une facture demandée par le client ?),
   les **clients particuliers** et **étrangers** ;
4. les délais : une facture doit-elle partir le jour de son émission ? (lien avec la signature
   différée, `03` § 2.2) ;
5. la facture d'**acompte**, l'**avoir**, la **note d'honoraires** : chacune a-t-elle son type TEIF ?

**Règle produit** : **une entreprise non obligée n'est pas forcée.** Le réglage « Je suis soumis à la
facture électronique » est proposé selon l'activité, et il se change. Mais une entreprise obligée qui
n'a pas fini son adhésion le **voit avant** d'émettre, avec ce qui manque.

### 3.2 La signature électronique

**Ce qu'on sait** (Rapporté) : la signature exige un **certificat qualifié** délivré sous l'ANCE
(TunTrust, DigiGo). Le même certificat sert à la TTN, à e-jibaya, à TEJ et à la CNSS. En septembre
2026, Swiver a obtenu une **homologation ANCE** pour faire signer depuis son application.

**Nos trois chemins** (vision § 5, décidés le 27/09) : DigiGo intégré, clé USB par l'agent local,
signature par le serveur après homologation.

**À VÉRIFIER** (ANCE, TunTrust) :
1. l'homologation ANCE est-elle **obligatoire** pour tout éditeur qui fait signer depuis son
   application, ou volontaire ? Son coût, son délai ;
2. l'adhésion « **entité d'intégration** » DigiGo : conditions, coût, délai, environnement de test ;
3. le **prix du certificat** pour le client (à annoncer honnêtement, `07`) ;
4. le **cachet électronique d'entreprise** et la signature différée (`03` § 2.2).

### 3.3 Les attestations de retenue à la source (TEJ)

**Ce qu'on sait** (Rapporté) : les attestations de retenue s'établissent sur la plateforme **TEJ**,
par saisie ou par **dépôt d'un fichier XML** conforme à un schéma publié (« TEJ-CCT-RS-V2.0 », mis à
jour en septembre 2026). Une attestation établie hors TEJ coûte une amende de **30 % de la retenue,
50 DT au moins**.

**Ce que le produit fait** : la retenue **naît au règlement** (10.14.0, `01` § 7) ; chaque mois, le
produit prépare le **fichier XML des attestations** du mois, prêt à déposer. Il le déposera
lui-même si TEJ ouvre un accès aux logiciels.

**À VÉRIFIER** (DGI) :
1. le schéma XSD à jour, et le calendrier de ses versions ;
2. s'il existe un **accès pour les logiciels** (dépôt automatique) ;
3. qui est obligé (tous les débiteurs, ou un seuil ?), et depuis quand ;
4. ce que devient l'attestation d'un règlement **annulé** (chèque impayé).

### 3.4 La déclaration mensuelle (e-jibaya)

**Ce qu'on sait** (Rapporté) : e-jibaya reçoit la déclaration mensuelle (TVA, retenues, autres
taxes), les acomptes et la déclaration annuelle, **par saisie** sur le portail, avec un certificat.
Aucune source ne signale d'import de fichier pour la déclaration mensuelle.

**Ce que le produit fait** : ce que fait l'application actuelle depuis la 9.6.0. Chaque case de la
déclaration est calculée, tracée jusqu'aux pièces, et **prête à copier** dans le format du portail.
Le calendrier suit le régime (`01` § 3, `echeance_fiscale_modele`).

**À VÉRIFIER** (DGI, comptable) :
1. un import de fichier existe-t-il ?
2. les dates limites exactes selon la forme (personne physique ou morale) et le régime (le 15 ou le
   28 du mois suivant ? trimestriel pour le forfait ?).

### 3.5 La liasse fiscale

**Ce qu'on sait** (Rapporté) : depuis 2017 (LF 2017, art. 41), la liasse se dépose sur TEJ en
**XML** : F6001 (actif), F6002 (capitaux propres et passif), F6003 (résultat), F6004 (flux de
trésorerie), F6005 (détermination du résultat fiscal), plus les notes en PDF.

**Ce que le produit fait** : les états financiers existent (10.0.0, Cabinet). La plateforme produit
les fichiers XML (chantier D4 de l'application actuelle, en cours).

**À VÉRIFIER** (DGI, comptable) : les schémas à jour ; les cas particuliers (forfait, régimes
spéciaux) ; une vraie liasse déposée pour confronter les rubriques (`01` § 21).

### 3.6 La CNSS

**Ce qu'on sait** (Rapporté) : déclaration **trimestrielle** des salariés et des salaires, dans les
**15 jours** qui suivent le trimestre, sur services.cnss.tn, avec ou sans certificat ; un service de
vérification du fichier existe. Déclaration d'employeur annuelle.

**Ce qui est déjà fait** : le fichier trimestriel au format **DS 2012**, inspecté champ par champ
contre le document de la CNSS pour l'application actuelle ; la déclaration d'employeur (5.2.0).

**À VÉRIFIER** (CNSS) : le format est-il toujours DS 2012 (des sources parlent de « DMS ») ? Existe-t-il
un dépôt automatique ? Quelles pénalités de retard ?

### 3.7 La caisse enregistreuse certifiée

**Ce qu'on sait** (Rapporté) :
- fondement : **article 48 de la loi de finances 2016**, et une décision du ministre des Finances
  du **14 octobre 2025** (JORT n° 125) ;
- calendrier : restaurants touristiques classés, salons de thé et cafés de 2e et 3e catégorie
  depuis le **1er novembre 2025** ; autres activités de consommation sur place depuis le
  **1er juillet 2026** ; réel avec déclaration mensuelle avant le **1er juillet 2027** ; généralisation
  au **1er juillet 2028** ;
- **nouveau (recherche du 28/09/2026)** : le ministère des Finances a ouvert une **plateforme
  d'homologation** (homologation.nacef.tn). On y télécharge le **cahier des charges techniques et
  fonctionnelles** et le **manuel des procédures**. On y fait des **tests d'intégration** avec le
  **système central d'information**, et on y dépose la **demande d'accréditation** du fournisseur.
  Une caisse homologuée comprend un **module de saisie** et un **module de sécurisation des données
  fiscales**, qui protège les données et les **transmet** de manière sécurisée. Contact : Centre
  d'information fiscale à distance, 81 100 400.

**Ce que ça change** :
- c'est un **raccordement technique à l'administration**, comme la TTN, pas une étiquette posée à la
  fin. Nos choix du `04` (tickets numérotés et chaînés sur la caisse, 7 jours hors ligne, session
  ouverte hors ligne) doivent être **confrontés au cahier des charges** avant d'écrire la caisse ;
- **décidé le 28/09/2026** (validé par Skander) : avancer cette démarche **au début du développement**. La décision du 27/09
  (vision § 9) la plaçait en fin de développement. Il faut s'inscrire comme fournisseur et
  télécharger le cahier des charges maintenant, pour que la caisse soit conçue juste du premier
  coup ;
- **les premiers visés sont les restaurants et les cafés**, mais ils seront obligés et équipés bien
  avant notre lancement. La caisse de comptoir sort au lancement ; le **mode restaurant** (salle,
  tables, cuisine, addition partagée : `14` § 3.1) vient en vague 1 avec Slate (`15`), décision de
  Skander du 28/09/2026. Le cahier des charges se lit quand même dès maintenant, pour que la caisse
  soit conçue juste pour les deux.

**À VÉRIFIER** (plateforme NACEF, DGI) :
1. le contenu du cahier des charges : chaînage, numérotation, **délai de transmission** au système
   central, fonctionnement hors ligne, Z de caisse, mentions du ticket, QR code ;
2. ce qui est homologué : le logiciel, le matériel, ou le couple ; une caisse **dans un navigateur**
   ou seulement l'application de bureau ;
3. les conditions pour être fournisseur accrédité : forme juridique, coût, délai, obligations
   après homologation (mises à jour : chaque nouvelle version doit-elle être homologuée ?) ;
4. le périmètre : seulement la consommation sur place, ou aussi le commerce de détail ;
5. les sanctions pour le commerçant et pour le fournisseur ;
6. une **commande prise à table** et pas encore encaissée (la « note ») : doit-elle être enregistrée
   ou transmise avant l'encaissement ? Le QR code et l'identifiant du module de sécurisation sur
   chaque ticket (`01` § 24).

**Règle produit** : **tant que la caisse n'est pas homologuée, le produit ne la dit pas
certifiée.** L'écran et le site disent « caisse » ; « caisse certifiée » n'apparaît qu'avec le numéro
d'homologation. Une phrase affichée que rien ne tient est un bug.

### 3.8 La conservation pendant 10 ans

**Ce qu'on sait** (Rapporté) : le Code de commerce impose de garder les livres et les pièces
justificatives **10 ans** ; le ministère des Finances dit « au moins dix ans ».

**Ce que le produit fait** :
- les pièces émises, le XML signé, l'accusé de la TTN, les écritures validées et les tickets vivent
  en **stockage non modifiable** (vision § 5), avec leur chaîne d'empreintes (`01` R9) ;
- un client qui part garde la lecture seule et l'**export complet** (`07`). Rien n'est effacé avant
  la fin de la durée légale sans sa demande écrite (vision § 11, point 7).

**À VÉRIFIER** (juriste) : le point de départ des 10 ans (fin de l'exercice ou date de la pièce) ;
une durée plus longue pour certains documents (`01` § 21) ; la valeur probante d'une archive
électronique en droit tunisien ; ce qu'on fait des données d'un client qui demande la suppression
**avant** 10 ans (la loi sur les données personnelles contre l'obligation de conservation).

### 3.9 Les mentions obligatoires des pièces

L'application actuelle porte déjà les mentions : matricule fiscal, timbre, mention de régime pour un
non-assujetti, montant en lettres (1.4.0, 7.22.0). Elles sont **portées** avec le moteur.

**À VÉRIFIER** (comptable) : la liste complète et à jour, par type de pièce (facture, avoir, ticket,
note d'honoraires, bon de livraison) et par régime ; les mentions en **arabe** (`01` § 21) ; le
motif d'exonération par ligne à 0 % (`e-facture-controle.md`).

### 3.10 La paie et les taxes sur salaires

Les barèmes (IRPP, CNSS, TFP, FOPROLOS, SMIG) changent avec les lois de finances et les décrets. Ils
vivent en **règles datées** (`01` R11) : une loi nouvelle ajoute des lignes, elle ne réécrit jamais
une paie passée. **À VÉRIFIER** chaque année avec un comptable (§ 7).

---

## 4. Ce que la loi impose à SkanFact lui-même

### 4.1 Nos propres factures

SkanFact vend un service à des entreprises tunisiennes : **nos factures sont électroniques**
(vision § 11, point 6). SkanFact est une entreprise de sa propre plateforme (`01` § 18) : nos
factures partent par le même moteur, le même TEIF, la même signature et la même TTN que celles de
nos clients. **Démarche** : l'adhésion de notre propre société à El Fatoora, et un certificat pour
elle.

### 4.2 La TVA et la retenue sur notre abonnement

**Incertain.** Le taux de 19 % est le plus cité. Une seule source, non recoupée, évoque d'autres taux
pour le logiciel. On ne sait pas non plus si un client doit faire une **retenue à la source** quand
il nous paie : un abonnement à un logiciel est-il une « rémunération non commerciale » ?

**Pourquoi ça compte** : si nos clients retiennent 3 % ou 10 % sur notre facture, nous recevons
moins que le prix affiché. Nos factures et nos relances doivent alors savoir **encaisser un paiement
net de retenue** (le moteur le fait déjà pour nos clients, 10.14.0). **À VÉRIFIER** avec un
fiscaliste **avant** de publier les prix TTC sur le site.

### 4.3 Les données personnelles (loi organique 2004-63)

**Ce qu'on sait** (Rapporté) :
- une **déclaration à l'INPDP pour chaque finalité** de traitement (art. 7) ;
- le **transfert vers l'étranger** exige une autorisation de l'INPDP (art. 52), même vers un pays
  jugé adéquat ; une plainte a déjà été instruite contre un hébergeur pour transfert illégal.

**Ce que ça donne pour nous** :
- **deux rôles différents.** Pour nos propres clients (comptes, abonnements, support), SkanFact est
  **responsable du traitement**. Pour les données que nos clients rangent chez nous (leurs clients,
  leurs salariés), SkanFact agit **pour leur compte** : il faut un **contrat de traitement**
  (vision § 11, point 7) ;
- **l'hébergement en Tunisie** (décidé le 27/09) évite l'autorisation de transfert. Il reste à
  **compter chaque flux qui sort** : le fournisseur de SMS et d'e-mails (numéro et code, adresse et
  lien : `03` § 6), Konnect pour le paiement. Chacun doit être en Tunisie, ou déclaré et autorisé.
  C'est la règle du projet : aucune donnée ne part sans que la liste soit comptée et décidée ;
- la lecture de photo de facture de l'application actuelle envoie une image à un service à
  l'étranger, avec l'accord de l'utilisateur. **Elle ne passe pas à la plateforme telle quelle.**
  Décidé le 28/09/2026 (`14` § 2.3) : la lecture se fait **sur nos serveurs en Tunisie** ; aucune
  image ne sort ;
- **les flux ajoutés par le `14`** (§ 4 de ce document-là, qui les liste un par un) : Konnect pour
  les factures des clients (le montant et la référence, vers le compte de l'entreprise) ; WhatsApp
  **par lien**, qui ne passe pas par nous ; puis, dans les vagues : les **SMS** de relance, de
  rappel et des campagnes (le numéro et le texte, chez un fournisseur en Tunisie de préférence), les
  boutiques en ligne, les sociétés de livraison (l'adresse du client de nos clients : c'est
  l'entreprise qui décide de l'envoyer, SkanFact agit pour elle, au titre du contrat de traitement),
  les autres prestataires de paiement (Flouci, puis ClicToPay et e-Dinar), et, **hors de Tunisie**,
  WhatsApp automatique (Meta), Shopify, les **avis en ligne** (Google, TripAdvisor) et les assistants
  d'IA extérieurs (avis du juriste, et autorisation de l'INPDP s'il le faut). **Aucun ne s'ouvre
  avant d'être compté ici** ;
- la **paie** contient des données sensibles (CIN, salaires, parfois la santé : congés maladie).
  Elle a les protections du `03` (D10).

**À VÉRIFIER** (INPDP, juriste) : les finalités à déclarer et les formulaires ; la durée de
conservation des traces et des données des salariés partis (`01` § 21, `03` § 7) ; le cas de la
console (la D1 actuelle est chez Cloudflare, hors de Tunisie : vision § 12).

### 4.4 La cybersécurité

**Ce qu'on sait** (Incertain) : le décret-loi 2023-17 imposerait un **audit annuel de cybersécurité**
aux prestataires cloud et d'hébergement. L'ANCS a créé en 2024 deux **labels** pour les hébergeurs,
**N-Cloud** et **G-Cloud**, qui ne sont pas (d'après nos sources) une obligation générale.

**Proposition** : choisir un **hébergeur labellisé N-Cloud** (l'étude cite EO Data Center, à
Enfidha), prévoir au budget un audit annuel (document 09), et faire trancher par un juriste si
l'obligation d'audit nous vise. Le détail va dans le document 06.

### 4.5 Les contrats et les pages légales

À écrire avec un juriste, **avant** d'ouvrir le serveur au public (vision § 11) :
- conditions générales de vente et d'utilisation ;
- politique de confidentialité ;
- **contrat de traitement** des données ;
- **engagement de réversibilité** : le client récupère tout, dans un format ouvert, à tout moment,
  et on écrit ce qui se passe si SkanFact s'arrête ;
- **limitation de responsabilité** en cas d'erreur de calcul, et une **assurance responsabilité
  civile professionnelle** (**À VÉRIFIER** avec un assureur) ;
- les règles de l'**accès du support** (`03` § 5), qui deviennent un engagement écrit.

### 4.6 La marque

Dépôt de **SkanFact** à l'INNORPI **dès que la société qui porte SkanFact est choisie** (revu le
28/09/2026 : le nom est **déjà public**, par l'application actuelle, le site et le dépôt ; attendre la
fin du développement le laisserait sans protection deux ans de plus). Le nom de l'offre restaurant se
dépose avant d'être montré (`15` § 6). Le
nom de domaine `skanfact.tn` est déjà à nous.

### 4.7 La déontologie des experts-comptables

Trois points sont **À VÉRIFIER** avec l'Ordre (déjà listés dans `00`, `01`, `03` et `07`) :
- l'interdiction de verser une **commission** à un cabinet qui amène un client (`07`) ;
- ce qu'un **annuaire** des cabinets aurait le droit de montrer (`00`) ;
- ce que l'ancien cabinet peut relire après la fin d'un mandat, et à qui appartient le travail d'un
  **dossier tenu** jamais rejoint (`01` § 4, `03` § 3.5).

### 4.8 Le Startup Act (loi 2018-20)

**Ce qu'on sait** (Rapporté, sources secondaires, § 9) :
- le **label Startup** se demande sur startup.gov.tn. Conditions : société de **moins de 8 ans**,
  **moins de 100 salariés**, total du bilan et chiffre d'affaires **sous 15 millions de dinars**,
  capital détenu **à plus des deux tiers** par des personnes physiques ou des fonds
  d'investissement, et un modèle **fortement innovant**, notamment technologique ;
- avantages annoncés, pendant la durée du label (8 ans au plus) : **exonération de l'impôt sur les
  sociétés**, **prise en charge des cotisations sociales** de l'employeur et des salariés, une
  **bourse** pour un fondateur pendant un an (de 1 000 à 5 000 DT par mois selon une source), un
  **congé pour créer** une startup, la prise en charge des frais de brevet ;
- des amendements (« Startup Act 2.0 ») sont en discussion en 2026.

**Ce que ça change pour nous** : SkanFact coche probablement les cases (une plateforme logicielle
neuve, tunisienne, hébergée en Tunisie). Le label allégerait nettement le budget du `09` § 4.

**À VÉRIFIER** (juriste, comptable) : quelle société portera SkanFact, et si elle est éligible
(date de création, capital) ; ce qu'on perd ou garde si l'on grandit ; l'effet des amendements
2026.

---

## 5. Les démarches, dans l'ordre

Ce que ton père lance, et quand. Les deux premières étaient déjà décidées (vision § 9) ; la
troisième est **nouvelle** (§ 3.7).

| Quand | Démarche | Pourquoi à ce moment |
|---|---|---|
| **Dès maintenant** | Adhésion ANCE « entité d'intégration » DigiGo | Le code de signature a besoin de l'environnement de test |
| **Dès maintenant** | Accès à l'environnement de test El Fatoora (TTN) | Le code d'envoi a besoin de l'environnement de test |
| **Dès maintenant** (décidé le 28/09/2026) | **Inscription fournisseur sur la plateforme NACEF**, téléchargement du cahier des charges de la caisse | La caisse se conçoit d'après ce cahier des charges ; les tests d'intégration se font pendant le développement |
| Dès maintenant | Rendez-vous avec un **comptable** et un **juriste** (liste § 6) | Beaucoup de décisions du cadrage attendent leurs réponses |
| Pendant le développement | Adhésion de **notre société** à El Fatoora, et son certificat | Nos factures d'abonnement (§ 4.1) |
| Pendant le développement | Schémas TEJ (retenue, liasse) et format CNSS à jour | Les fichiers officiels (§ 3.3 à 3.6) |
| **Dès que la société qui porte SkanFact est choisie** (ajouté le 28/09/2026) | **Demande du label Startup** (§ 4.8) | Ses avantages courent pendant la durée du label : plus tôt il est obtenu, plus il sert |
| **Dès que la société qui porte SkanFact est choisie** (revu le 28/09/2026) | **Dépôt de la marque** à l'INNORPI | Le nom est déjà public : chaque mois sans dépôt le laisse sans protection |
| **Avant la première donnée réelle d'un client** (les pilotes compris) | **Déclarations INPDP** | Traiter des données de personnes sans déclaration, même en test, n'est pas permis (À VÉRIFIER avec l'INPDP : le cas d'un essai sur des données fictives) |
| Avant le lancement | **Homologation ANCE** de la signature serveur (si elle est retenue) | Troisième chemin de signature (vision § 5) |
| Avant le lancement | **Homologation de la caisse** | Pour vendre une caisse certifiée |
| Avant le lancement | Contrats et pages légales (§ 4.5) ; audit de sécurité externe | Vision § 11 |

---

## 6. Les questions, par interlocuteur

Toutes les questions « À VÉRIFIER » du cadrage, rangées **par personne à voir**, pour qu'un seul
rendez-vous en règle beaucoup. Chaque réponse s'écrit **dans le document d'origine**, avec sa date.

**Le comptable** (un des trois pilotes, ou un autre)
1. Les mentions obligatoires, pièce par pièce, et les mentions en arabe (§ 3.9, `01` § 21).
2. Les dates limites des déclarations par forme et par régime (§ 3.4).
3. Une vraie liasse déposée, pour confronter nos rubriques (§ 3.5, `01` § 21).
4. L'écriture de caisse : une par session ou une par jour (`01` § 21).
5. Les écritures de paie en totaux du mois, sans nom de salarié (`03` § 2.1).
6. Les salaires du mois saisis en total dans Déclarations : quelles cases (`02` § 11).
7. Un ticket arrivé après la fermeture du mois, régularisé le mois suivant (`04` § 6).
8. Les blocs de numéros pour les devis hors ligne (`04` § 3.2).
9. Le cours des devises de la Banque centrale : lequel, et comment l'obtenir chaque jour (`01` § 21).
10. Une paie faite par le cabinet pour un client en Essentiel (`02` § 11).
11. Les nouveaux métiers (`14` § 7) : la retenue de garantie et l'avance de démarrage du bâtiment,
    la commission des titres-restaurant, la caution d'une location, les cartes cadeaux.
12. Le paiement en ligne par un client qui fait une retenue à la source (`14` § 2.2).

**Le juriste**
1. La procédure de reprise d'un compte de propriétaire (départ, décès, conflit) (`03` D4).
2. La conservation : point de départ, durées, valeur d'une archive électronique, suppression
   demandée avant 10 ans (§ 3.8).
3. Le contrat de traitement, les conditions, la confidentialité, la réversibilité, la limitation de
   responsabilité (§ 4.5).
4. Le rôle Lecture pour un banquier ou un associé : faut-il un accord écrit (`03` § 11).
5. Le périmètre de l'audit de cybersécurité obligatoire (§ 4.4).
6. L'assurance responsabilité civile professionnelle (avec un assureur).
7. Le **Startup Act** : la société qui porte SkanFact, son éligibilité (§ 4.8).
8. Les flux vers l'étranger des intégrations : WhatsApp automatique, Shopify, assistants d'IA
   (§ 4.3, `14` § 4).

**Le fiscaliste** (ou le comptable, s'il tranche)
1. La TVA sur notre abonnement (`07`, § 4.2).
2. La retenue à la source sur notre abonnement (§ 4.2).

**L'Ordre des experts-comptables**
1. Commission, annuaire, lecture après mandat, dossier tenu jamais rejoint (§ 4.7).

**La TTN** : les cinq questions du § 3.1.

**TunTrust et l'ANCE** : les quatre questions du § 3.2.

**La DGI** : TEJ (§ 3.3), e-jibaya (§ 3.4), liasse (§ 3.5).

**La plateforme NACEF (caisse)** : les six questions du § 3.7.

**La CNSS** : les trois questions du § 3.6.

**L'INPDP** : les finalités, les formulaires, les durées (§ 4.3).

**Les entretiens terrain** (clients) : lots et péremptions, quantités à plus de trois décimales,
chèques et traites, pièces bilingues (`01` § 21).

---

## 7. La veille : chaque loi de finances

Chaque année, la loi de finances est publiée en décembre et s'applique souvent au 1er janvier. La
plateforme doit être à jour **avant** le 1er janvier, puisque les caisses reçoivent les règles à
l'avance (`04` § 6).

| Quand | Quoi |
|---|---|
| Octobre à décembre | Suivre le projet de loi de finances, puis la loi publiée au JORT |
| Dès la publication | Écrire les nouvelles **règles datées** (`01` R11), avec leur texte de loi ; aucune ligne ancienne ne change |
| Avant le 20 décembre | Les faire **relire par un comptable**, jouer les tests (les invariants « deux chemins, un chiffre ») |
| Avant le 31 décembre | Publier ; prévenir les clients de ce qui change pour eux, dans l'application |

La même veille vaut pour les schémas officiels (TEIF, TEJ, CNSS, liasse, caisse). Leurs versions
vivent dans `format_officiel` (`01` § 3), avec leurs dates de validité.

L'application actuelle suit le même calendrier tant qu'elle vit (vision § 11, point 1).

---

## 8. À VÉRIFIER : la liste de ce document

Elle est dans les §§ 3 et 4, question par question, et rangée par interlocuteur au § 6.

## 9. Sources

Sources rapportées par les notes de recherche (lues en résumé, pas au texte intégral) : voir
`docs/etudes/notes-de-recherche/marche-2026/cadre_legal.md`, qui donne chaque lien. Recherches
faites le 28/09/2026 pour ce document :
- Caisse : [La Presse — le système numérique pour les caisses enregistreuses](https://lapresse.tn/2025/10/17/tunisie-un-systeme-numerique-pour-les-caisses-enregistreuses-mis-en-place/),
  [WMC — plateforme pour les fournisseurs et tests d'intégration](https://www.webmanagercenter.com/2025/10/17/553889/caisse-enregistreuse-la-tunisie-met-en-place-une-plateforme-pour-les-fournisseurs-et-tests-dintegration),
  [Webdo — lancement du système d'homologation](https://www.webdo.tn/fr/actualite/national/tunisie-fiscalite-lancement-du-systeme-dhomologation-des-caisses-enregistreuses/385862/),
  [Managers — calendrier](https://managers.tn/2026/06/30/tunisie-caisses-enregistreuses-obligatoires-des-demain-pour-ces-structures/).
- TTN : [Edicom — état des lieux](https://edicomgroup.com/blog/status-electronic-invoicing-tunisia),
  [eFactureTN — guide 2026](https://efacturetn.com/fr/blog/facturation-electronique-tunisie-2026-guide-conformite-el-fatoora),
  [Tekru — intergiciel libre El Fatoora](https://tekru.net/fr/blog/facturation-electronique-en-tunisie-tekru-technologiespublie-un-middleware-open-source-pour-accelerer-ladoption-del-fatoora-en-partenariat-avec-ngsign/).
- Startup Act : [Startup Tunisia — critères du label](https://support.startup.gov.tn/support/solutions/articles/73000565084-quels-sont-les-crit%C3%A8res-pour-obtenir-le-label-startup-),
  [Tunisie Entreprise — label, conditions et avantages](https://www.tunisie-entreprise.com/guides/startup-act-tunisie/),
  [amendements 2026](https://maitre-haifaguedhami.me/actualites/startup-act-tunisie-amendements-2026).

*Limite honnête : ce sont encore des sources secondaires. Le texte des décisions et les cahiers des
charges se lisent sur les plateformes officielles, ce que la démarche du § 5 permet.*

## 10. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (relecture) | Le fichier TEIF est contrôlé avant la prise du numéro ; la déclaration INPDP se fait avant la première donnée réelle, pilotes compris |
| 28/09/2026 (proposé) | Chaque obligation porte son état de connaissance ; une obligation « Rapportée » suffit pour concevoir, jamais pour promettre |
| 28/09/2026 (**validé par Skander**) | **Avancer l'inscription à la plateforme d'homologation des caisses** à maintenant (au lieu de la fin du développement, décision du 27/09) ; « caisse certifiée » ne s'affiche qu'avec un numéro d'homologation |
| 28/09/2026 (proposé) | Une entreprise non obligée à la facture électronique n'est pas forcée ; une obligée voit avant d'émettre ce qui manque à son adhésion |
| 28/09/2026 (proposé) | Nos factures partent par notre propre plateforme ; la TVA et la retenue sur notre abonnement se tranchent avant de publier les prix TTC |
| 28/09/2026 (proposé) | Chaque flux de données qui sort est compté ; la lecture de photo de facture ne passe pas à la plateforme sans service en Tunisie ou autorisation INPDP |
| 28/09/2026 (proposé) | Hébergeur labellisé N-Cloud de préférence ; audit de cybersécurité annuel au budget en attendant l'avis du juriste |
| 28/09/2026 (proposé) | Une veille par loi de finances, publiée avant le 1er janvier, relue par un comptable |
| 28/09/2026 (par délégation, `14` ; revu par Skander, `15`) | La caisse de comptoir sort au lancement, le mode restaurant en vague 1 ; la lecture de documents se fait en Tunisie ; chaque flux d'une intégration est compté ici avant d'être ouvert ; demande du label Startup dès que la société qui porte SkanFact est choisie |
| 28/09/2026 (relecture) | Le dépôt de la marque avance : dès que la société est choisie, parce que le nom est déjà public |
