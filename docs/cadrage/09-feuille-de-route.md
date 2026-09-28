# 09 — La feuille de route et le budget

*Proposé le 28/09/2026. **À valider par Skander.** Suit `VISION-ARCHITECTURE.md` (§ 9 : budget
accepté ; § 11, point 4 : le rythme dépend du quota Claude ; risques R11, R14) et les documents 00 à
08. Les étapes sont données **en mois après le premier code**, pas en dates : la date du premier
code dépend de la fin du cadrage (§ 1, J0). **Revu le même jour** pour suivre le `14` (l'alignement
sur Hesabi, les métiers, les intégrations) : les étapes 1 à 5 s'allongent, et les vagues qui suivent
le lancement sont écrites (§ 1).*

## En bref (pour Skander)

- **Cinq étapes, 25 mois au plan et 28 avec la marge** (22 et 24 avant l'alignement sur Hesabi du
  28/09, `14` § 6 ; la restauration passe en vague 1, `15`), et **pas de lancement public avant que tout soit là** (décision du 27/09). Chaque étape se termine par un **jalon vérifiable** : on ne passe à la suivante que si le
  jalon est tenu, mesuré et vu à l'écran.
- **Ce qui fixe le calendrier, ce n'est pas le code.** Ce sont les **démarches** (TTN, DigiGo,
  plateforme des caisses, INPDP) et le **quota Claude**. D'où les démarches lancées **dès maintenant**
  (`05` § 5).
- **Les comptables pilotes** passent sur la plateforme à l'étape 3 (mois 16), en parallèle de
  l'application actuelle, avec leur accord.
- **Après le lancement, trois vagues** de six mois chacune (la restauration avec Slate, l'arabe, les
  rendez-vous, le bâtiment, les boutiques en ligne, la fabrication…), puis l'hôtellerie à la fin
  (§ 1, `14`).
- **Budget** : de l'ordre de **1 000 DT par mois** en fonctionnement au lancement, et **11 à 24 kDT** de
  frais uniques connus sur toute la durée, dans l'ordre de grandeur du 27/09 (10 à 20 kDT). S'y
  ajouteront des frais **encore inconnus** (homologation de la caisse, DigiGo, ANCE), qui le feront
  probablement dépasser. **Chaque ligne est une estimation**, à remplacer par un devis.
- **Point mort** : environ **31 abonnements Essentiel** (ou 18 Complet) couvrent 1 000 DT par mois.
- **Le label Startup** (`05` § 4.8), s'il est obtenu, allège nettement ce budget.

---

## 1. Les étapes et leurs jalons

### J0 — La fin du cadrage (octobre 2026)

| À faire | Qui |
|---|---|
| Documents 10, 11 et 12 validés | Claude, Skander |
| **Prototype de synchronisation** mesuré (`04` § 9.3), qui tranche l'outil de lecture | Claude |
| Démarches lancées : El Fatoora (test), DigiGo (intégration), plateforme des caisses (`05` § 5) | Père de Skander |
| Rendez-vous comptable et juriste avec la liste du `05` § 6 | Père de Skander, Skander |
| Devis de deux hébergeurs (`06` § 2.3) | Père de Skander |
| Entretiens terrain (questionnaire de l'étude de marché) | Skander, son père |

**Jalon J0** : le cadrage est validé document par document, le prototype a tranché, et le **dépôt de
la plateforme** existe avec son intégration continue (`12`). C'est à partir de J0 que « le premier
code » est autorisé.

### Étape 1 — Le socle (mois 1 à 4)

- La base : organisations, entreprises, établissements, utilisateurs, membres, **sécurité par ligne**
  et ses tests (`01` § 4, `03` § 9).
- La connexion : comptes, code sur le téléphone, appareils, sessions (`03` § 6).
- **La porte des droits** (`03` D2), la piste d'audit, le journal inaltérable (`01` R9, R10).
- **Le moteur porté** : calcul des pièces et moteur d'écritures, **tests d'abord**, avec le **banc qui
  compare l'ancien et le nouveau moteur au millime** (`08` § 1.2).
- Règles fiscales datées, numérotation, file d'opérations (`04` § 4).
- **Le catalogue de textes** et la **langue factice** testée à chaque version (`14` § 5), dès le
  premier écran ; l'**API publique** et ses clés, sa documentation générée (`14` § 2.5).
- **Export et restauration d'une entreprise** (vision § 4.2), sauvegardes et premier exercice de
  restauration sur l'environnement de test (`06` § 4).

**Jalon J1** : sur le serveur de test, une facture est créée, calculée et émise (sans TTN), **au même
millime** que la v10 sur l'exemple de cinq ans. Une entreprise est exportée puis restaurée à
l'identique. Et un test prouve qu'un membre d'une entreprise ne lit rien de sa voisine.

### Étape 2 — Vendre, acheter, déclarer, hors ligne (mois 5 à 11)

- L'application **web installable**, avec la bibliothèque d'interface (`12`), et ses visites guidées ;
  les écrans du quotidien **pensés pour le téléphone** (`14` § 2.6).
- Modules **Ventes, Achats, Trésorerie, Déclarations, Pilotage** (`02`), avec ce que le `14` y
  ajoute : commandes et livraisons partielles, prix par quantité, encours, commandes fournisseurs
  et réceptions, balance âgée, tableau de bord du groupe, l'accord au-delà d'un seuil.
- L'**espace client** et le **paiement en ligne** par Konnect (`14` § 2.1, 2.2).
- La **lecture de documents** : tableur, TEIF, puis photo et PDF sur nos serveurs, retenue d'après
  son seuil mesuré (`14` § 2.3).
- **Hors ligne** : copie locale, file d'envoi, « À reprendre » (`04`).
- **Facture électronique** sur l'environnement de test de la TTN, **signature DigiGo** de test (`05`
  § 3.1 et 3.2).
- Fichiers officiels : attestations TEJ, déclaration mensuelle prête à copier (`05` § 3.3 et 3.4).
- **Déclaration INPDP** faite **avant la fin de l'étape** : l'étape 3 met de vraies données sur le
  serveur (`05` § 5).

**Jalon J2** : une entreprise d'essai tient **un mois complet** en Essentiel : devis, factures signées
et acceptées par la TTN de test, **payées en ligne** par son client depuis son espace (Konnect de
test), achats reçus et lus en photo, banque, déclaration du mois, avec une coupure de réseau jouée au
milieu. Le tout est **refait à la souris**, sur un ordinateur **et sur un téléphone**, et vu à
l'écran (règle du projet).

### Étape 3 — Le cabinet, la comptabilité, la paie, la reprise (mois 12 à 16)

- Module **Cabinet** : code cabinet, mandats, portefeuille, affectations, questions, révision (`00`,
  `03` § 3) ; **lettres de mission, honoraires, dépôts groupés** (`14` § 2.4).
- **Comptabilité complète** : validation, lettrage, clôtures, états, **liasse en XML** (`05` § 3.5).
- **Paie** et **CNSS** (`05` § 3.6).
- **L'outil de reprise** de la v10 (entreprise et Cabinet), avec l'essai à blanc et le rapport
  (`08` § 2).
- Le **site de secours** en place, et la **première bascule** jouée (`06` § 4.3).

**Jalon J3** : **les trois comptables pilotes travaillent sur la plateforme**, avec leur accord et sur
leurs vrais dossiers repris de la v10, **en parallèle** de la v10 pendant au moins deux mois. Chaque
écart entre les deux est un défaut, écrit et corrigé.

### Étape 4 — Le stock, la caisse, le bureau (mois 17 à 21)

- Module **Stock** (`02`), avec les **recettes et les kits**.
- Module **Caisse**, conçu d'après le **cahier des charges de la plateforme d'homologation** (`05`
  § 3.7), et ses tests d'intégration avec le système central : la **caisse de comptoir**, conçue pour
  recevoir le mode restaurant en vague 1 (`15`).
- **L'application de bureau**, signée (`06` § 10), et l'**agent local** : clé USB de signature,
  imprimante de tickets, tiroir, douchette.

**Jalon J4** : la caisse passe les **tests d'intégration** de l'administration, et la demande
d'homologation est déposée. Une journée de magasin fictive, avec une coupure, remonte en moins d'une
minute (vision § 6). **L'homologation elle-même dépend de l'administration** : c'est le jalon le
plus incertain de toute la feuille de route.

### Étape 5 — Tout ce qu'il faut pour ouvrir (mois 20 à 25)

- **La console** complète (`10`) et **nos propres factures** électroniques (`05` § 4.1).
- **Le site** de la plateforme (`11`), avec ses pages de métiers, d'intégrations et pour les
  développeurs ; les **pages légales** et les contrats (`05` § 4.5).
- **L'audit de sécurité externe** (`06` § 10) et ses corrections.
- **Dépôt de la marque** à l'INNORPI, avant toute communication publique (`05` § 4.6).
- Le bouton **« Passer à la plateforme »** dans la v10 (`08` § 2.1).
- **Une seconde personne** formée au support et aux fiches d'incident (`06` § 9.3).

**Jalon J5, le lancement** : tout ce qui précède est vrai **et mesuré**. Il faut en particulier :
- trois exercices de restauration réussis d'affilée ;
- l'audit sans défaut grave ouvert ;
- les pilotes qui disent oui ;
- la caisse homologuée. Si elle ne l'est pas encore, **on lance sans le mot « certifiée »** (`05`
  § 3.7), et la caisse est vendue seulement là où l'obligation ne s'applique pas encore.

### Après le lancement : trois vagues, puis l'hôtellerie

Le détail et les raisons sont au `14` ; chaque vague a sa forme déjà posée dans le modèle (`01`
§ 24). Rien de tout cela n'est **promis** avant d'être fait : le site ne l'annonce qu'une fois livré
(`11`).

| Vague (après J5) | Ce qu'elle apporte |
|---|---|
| **Vague 1** (environ 6 mois) | **La restauration, avec Slate** (`15`) : plan de salle, service du jour, réservations et widget, mode restaurant de la caisse (tables, cuisine, suppléments, addition partagée), imprimantes de cuisine ; l'interface **en arabe**, relue par un arabophone, les pièces bilingues, le site en arabe ; le module **Réservations** étendu aux rendez-vous ; ce que Slate a déjà écrit (vente en ligne, campagnes, avis, bons cadeaux, menus : `15`) ; le **bâtiment** (situations de travaux, retenue de garantie) ; le **suivi commercial** ; **WooCommerce** et **Shopify** ; **Intigo** et **First Delivery** ; **Flouci** ; WhatsApp automatique ; SMS de relance et de rappel |
| **Vague 2** (environ 12 mois) | Les modules **Production** et **Projets** ; la **location** ; les notes de frais ; la fidélité, les cartes cadeaux et les promotions ; l'écran de cuisine et la réservation de table ; la balance connectée ; Navex et Aramex ; les connecteurs sans code |
| **Vague 3** (environ 18 mois) | Le module **Groupe** (consolidation) ; l'**application des magasins** (App Store, Google Play) ; l'interface **en anglais** ; PrestaShop ; ClicToPay, e-Dinar ; le terminal de paiement connecté ; les rapports à la carte ; Odoo ; les assistants d'IA extérieurs ; les tournées de livraison |
| **À la fin** | L'**hôtellerie** (décision de Skander, 28/09/2026) |

---

## 2. Le temps réservé à l'application actuelle

La v10 vit pendant toute la construction (vision § 11, point 1) :
- **les lois de finances 2027 et 2028**, publiées en décembre : elles passent **avant** le travail
  sur la plateforme, chaque décembre (`05` § 7) ;
- les **corrections** que les pilotes trouvent ;
- **environ un jour sur dix** du travail y est réservé. Quand il n'y en a pas besoin, il revient à la
  plateforme.

Chaque correction de calcul faite dans la v10 est **aussi portée** dans le nouveau moteur (`08` § 1.3).

---

## 3. Ce qui peut décaler le calendrier

| Ce qui arrive | Effet | Ce qu'on fait |
|---|---|---|
| L'accès de test TTN ou DigiGo tarde | L'étape 2 ne peut pas finir la facture électronique | Tout le reste de l'étape avance ; la file d'envoi se teste contre un simulateur écrit d'après la documentation. **Jamais de lancement sans l'accusé réel de la TTN** |
| Le cahier des charges de la caisse impose autre chose que notre `04` | L'étape 4 change de forme | C'est pour ça que l'inscription est faite **dès maintenant** : on le saura avant d'écrire la caisse |
| L'homologation de la caisse tarde | J5 sans « certifiée » | Voir J5 |
| Le quota Claude baisse ou coûte plus cher | Tout ralentit | Le budget suit le quota réel (§ 4) ; les étapes gardent leur ordre, seules les durées s'allongent |
| Un pilote se retire | Moins de retours réels | Les entretiens terrain (J0) servent aussi à trouver d'autres cabinets |
| Un devis d'hébergement bien au-dessus | Budget | On compare au § 4 ; un seul site pendant le développement, le second à l'étape 3 |

**Règle** : un jalon manqué **déplace les dates, jamais le contenu du jalon**. C'est la règle des
seuils de performance, appliquée au calendrier.

---

## 4. Le budget

**Toutes les lignes sont des estimations de Claude**, faites sans devis et marquées ainsi. Chacune se
remplace par le vrai chiffre dès qu'il est connu, dans ce document, avec sa date.

### 4.1 Pendant le développement (par mois)

| Poste | Estimation | Remarque |
|---|---|---|
| Serveur de test (sans données réelles, donc hébergeable n'importe où) | 50 à 150 DT | Aucune donnée de personne réelle n'y entre (`06` § 6) |
| Konnect de test, SMS de test | 0 à 50 DT | Les environnements d'essai des prestataires sont en général gratuits (**À VÉRIFIER**) |
| Abonnement Claude | **À VÉRIFIER** (l'abonnement actuel de Skander) | Vision § 11, point 4 : c'est le principal « salaire » du projet |
| Intégration continue (GitHub Actions) | 0 DT | Gratuit parce que les dépôts sont publics (décision du 27/09) |
| À partir de l'étape 3 : site principal et site de secours en Tunisie, pour les pilotes | voir § 4.2 | Les vraies données arrivent à J3 |

### 4.2 En fonctionnement, au lancement (par mois)

| Poste | Estimation | Remarque |
|---|---|---|
| Site principal (serveurs dédiés, EO Data Center ou équivalent) | 400 à 700 DT | **Devis nécessaire** (`06` § 2.2) |
| Site de secours (autre opérateur, autre ville) | 200 à 400 DT | **Devis nécessaire** |
| Stockage des sauvegardes et des archives de 10 ans | 50 à 150 DT | Grandit avec les clients |
| Lecture de documents (un serveur de calcul de plus, `14` § 2.3) | 100 à 250 DT | Mesurée au prototype ; en Tunisie, comme le reste |
| SMS (codes de connexion) | 30 à 100 DT | Faible grâce aux appareils reconnus (`03` § 6) ; prix par message **À VÉRIFIER** |
| E-mails, surveillance, nom de domaine | 20 à 50 DT | |
| **Total** | **≈ 800 à 1 650 DT** | Un peu au-dessus de l'ordre de grandeur du 27/09 (~1 000 DT), à cause de la lecture de documents |

### 4.3 Les frais uniques (sur toute la durée)

| Poste | Estimation | Quand |
|---|---|---|
| Juriste : contrats, pages légales, procédure de reprise de compte, avis sur l'audit ANCS | 3 000 à 6 000 DT | Étapes 0 et 5 |
| Comptable : réponses du `05` § 6, relecture des lois de finances | 1 000 à 3 000 DT | Tout au long |
| **Audit de sécurité externe** (test d'intrusion) | 5 000 à 10 000 DT | Étape 5 |
| Certificats de signature de l'application (Apple, Microsoft) | 1 000 à 2 000 DT par an | Étape 4 |
| Certificat TunTrust de notre société (nos factures) | **À VÉRIFIER** | Étape 5 |
| Homologation de la caisse, adhésion DigiGo, homologation ANCE éventuelle | **Inconnu** | Étapes 0 à 5 |
| Dépôt de la marque (INNORPI) | quelques centaines de DT, **À VÉRIFIER** | Étape 5 |
| Assurance responsabilité civile professionnelle | **À VÉRIFIER** (par an) | Étape 5 |
| Relecture de l'interface en arabe par un arabophone | 1 000 à 3 000 DT | Vague 1 |
| Imprimantes de tickets et de cuisine, tiroir, douchette, tablette, pour tester la caisse et le restaurant | 1 500 à 3 000 DT | Étape 4 (comptoir), vague 1 (cuisine) |
| **Total connu** | **≈ 12 500 à 27 000 DT** jusqu'au lancement (certificats comptés sur deux ans, matériel de caisse compris), sans les lignes « inconnu » ni « À VÉRIFIER » ; plus 1 000 à 3 000 DT pour l'arabe en vague 1 | |

### 4.4 Le point mort

Avec les prix du `07` (hors taxes) :

| Pour couvrir | Il faut |
|---|---|
| 1 000 DT par mois (12 000 DT par an) | **≈ 31** abonnements Essentiel (390 DT), **ou ≈ 18** Complet (690 DT) |
| 1 650 DT par mois (haut de la fourchette) | ≈ 51 Essentiel, ou ≈ 29 Complet |

Ce calcul ne compte ni le temps de Skander ni le quota Claude. Il ne compte pas non plus la retenue à
la source que des clients pourraient faire sur nos factures (`05` § 4.2, **À VÉRIFIER**).

---

## 5. Comment on suit la feuille de route

- **Un tableau de bord des jalons** dans `docs/cadrage/README.md` (ou dans le dépôt de la
  plateforme, `12`) : chaque jalon a sa date prévue, sa date réelle, et ce qui a été mesuré.
- **Chaque fin d'étape** : un compte rendu pour Skander, en français simple : ce qui est fait, ce qui a
  été vu à l'écran, ce qui a glissé et pourquoi.
- **Chaque mois** : les dépenses réelles remplacent les estimations du § 4.

## 6. À VÉRIFIER

1. Le coût de l'abonnement Claude nécessaire au rythme prévu.
2. Tous les devis du § 4 (hébergeurs, juriste, audit, certificats, assurance, marque).
3. Les frais des démarches : homologation de la caisse, adhésion DigiGo, homologation ANCE.
4. Le label Startup : l'éligibilité et ce qu'il couvre (`05` § 4.8).

## 7. Décisions de ce document

| Date | Décision |
|---|---|
| 28/09/2026 (proposé) | Cinq étapes après J0, chacune fermée par un jalon mesuré et vu à l'écran ; lancement (J5) 22 mois après le premier code au plan, 24 au plus avec la marge |
| 28/09/2026 (**Skander**, `15`) | Slate et toute la restauration en **vague 1**, après une base stable ; l'étape 4 garde la caisse de comptoir ; lancement à **25 mois au plan, 28 avec la marge** |
| 28/09/2026 (par délégation, `14`) | **Revu** : lancement à 27 mois au plan, 30 avec la marge, pour tout ce que Hesabi a et les métiers du lancement ; pilotes au mois 16 ; trois vagues après J5, puis l'hôtellerie ; budget de fonctionnement ≈ 800 à 1 650 DT par mois ; demande du label Startup |
| 28/09/2026 (proposé) | Les pilotes passent à J3, en parallèle de la v10 pendant deux mois au moins ; déclaration INPDP avant |
| 28/09/2026 (proposé) | Un jalon manqué déplace les dates, jamais son contenu ; jamais de lancement sans l'accusé réel de la TTN ; lancement possible sans le mot « certifiée » si l'homologation de la caisse tarde |
| 28/09/2026 (proposé) | Environ un jour sur dix réservé à la v10 ; les lois de finances passent avant tout chaque décembre |
| 28/09/2026 (proposé) | Budget en estimations, remplacées par les devis au fil de l'eau ; point mort ≈ 31 Essentiel ou 18 Complet pour 1 000 DT par mois |
