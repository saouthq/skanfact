# Étude concurrentielle : Hesabi (hesabi.tn)

*27/09/2026. Demandée par Skander : « faut au moins qu'il soit meilleur que Hesabi, et fasse les mêmes
choses et plus ».*

**Méthode et limite, à dire d'abord.** Le site hesabi.tn est bloqué depuis l'environnement de travail :
tout ce qui suit vient des pages de Hesabi telles que les moteurs de recherche les résument (liens en
fin de document). Ce sont **leurs affirmations**, pas des fonctions essayées. Avant de citer une
comparaison en public (site, démonstration), ouvrir leur essai de 14 jours et vérifier chaque ligne
marquée « selon eux ». Une comparaison fausse se retourne contre celui qui la publie.

---

## 1. Ce qu'est Hesabi

Un logiciel **web** (SaaS, rien à installer, sur téléphone, tablette et PC) de facturation, stock,
caisse, paie et comptabilité pour les PME tunisiennes, avec un portail pour les cabinets. Essai de
**14 jours** sans carte.

| Offre | Prix | Ce qu'elle contient (selon eux) |
|---|---|---|
| **Starter** | 390 TND/an | Facturation, stock, caisse (POS), rapports de base, **3 utilisateurs** |
| **Pro** | 790 TND/an | + comptabilité PCG-TN, paie CNSS/IRPP/TFP, **TTN El Fatoora** (signature + envoi), **TEJ**, import IA (PDF, image, XML), calculateur de chiffrage des devis, clés d'API, **utilisateurs illimités** |
| **Cabinet** | 2 490 TND/an | Portail expert-comptable multi-clients, « acting-as » dans le dossier du client, calendrier fiscal multi-clients (JIBAYA, TEJ, CNSS, IS, DAS), export TEJ en masse, gestion des honoraires, tableau de bord consolidé, exports XLSX/FEC par dossier |

Nos prix en face : **Indépendant 390 DT HT/an**, **Entreprise 690 DT HT/an** (100 DT de moins que
leur Pro), **Cabinet gratuit** pour les dossiers sur SkanFact et trois hors SkanFact (contre 2 490).

---

## 2. Fonction par fonction

Légende : ✅ nous l'avons · ◐ nous l'avons en partie · ❌ nous ne l'avons pas · ★ nous faisons mieux.

### 2.1 Facturation et ventes

| Fonction | Hesabi | SkanFact |
|---|---|---|
| Devis, factures, avoirs, numérotation légale | oui | ✅ + proforma, bon de commande, bon de livraison, contrat à signer, note d'honoraires |
| Acompte / solde, facture récurrente, relances | non documenté | ★ acomptes en montant exact, soldes, contrats récurrents, relances graduées, relance téléphonique |
| Documents en anglais, en devise, écart de change | non documenté | ★ FR/EN, toute devise, taux du jour au règlement, écart de change en 655/755 |
| Envoi par email | oui | ✅ (Mail sur Mac, messagerie par défaut ailleurs) |
| **Envoi par WhatsApp** | **oui** | ★ depuis la 10.15.0 (**H2**) : pièces ET relances, le message du modèle d'email, le numéro remis au format international et revérifié par le processus principal |
| **Portail client en ligne** (le client consulte ses factures) | **oui** | ❌ — suppose un serveur qui garde les factures des clients : décision de Skander (§ 4) |
| Calculateur de chiffrage des devis | oui (Pro) | ◐ coût d'achat, marge estimée en direct, pas de « coefficient » → H6 |

### 2.2 Facture électronique et déclarations

| Fonction | Hesabi | SkanFact |
|---|---|---|
| Fichier TEIF (El Fatoora) | oui | ✅ depuis la 10.15.0, validé contre le XSD officiel sur 278 pièces |
| **Signature XAdES + envoi automatique à la TTN** | **oui, via NGSign** | ❌ — demande un contrat NGSign (ou DigiGo) : § 4 |
| **Recevoir la facture TEIF d'un fournisseur** | import « IA » (PDF, image, **XML**) | ★ depuis la 10.15.0 (**H1**), **sans IA** : le XML se lit exactement, hors ligne, chaque montant recompté, le fournisseur créé depuis la facture |
| **TEJ** (certificats de retenue, XML mensuel) | oui, et en masse pour un cabinet | ❌ — bloqué sur les schémas officiels (jibaya.tn) : § 4 |
| Attestations d'exonération de retenue | oui | ❌ → H7 |
| Déclaration mensuelle TVA / RS / TFP / FOPROLOS | non documenté en détail | ★ Cabinet : formulaire officiel 2026 case par case, montants copiables pour le portail, complément d'écriture si une pièce arrive après |
| Fichier CNSS trimestriel au format de télédéclaration | « récapitulatifs CNSS » | ★ fichier DS 2012 (Cabinet), contrôlé ligne par ligne |

### 2.3 Comptabilité

| Fonction | Hesabi | SkanFact |
|---|---|---|
| Écritures automatiques depuis factures, paiements, paie | oui | ✅ (avec la retenue à son fait générateur, le change, le stock, les amortissements) |
| Journal, grand livre, balance, bilan, résultat | oui | ✅ |
| **Export FEC** | oui | ★ depuis la 10.15.0 (**H3**) : dans les DEUX applications, par UN seul fabricant ; seules les écritures validées et équilibrées partent, et ce qui empêche le fichier se nomme (À VÉRIFIER : la DGI tunisienne ne l'exige pas — c'est le format d'échange que les logiciels connaissent) |
| Rapprochement bancaire | non documenté | ★ relevés de toutes les banques, automatique « certain » seulement, suspens |
| Lettrage, balance âgée | non documenté | ★ |
| Immobilisations, dégressif, cessions | non documenté | ★ |
| Clôture d'exercice, à-nouveaux, liasse, SIG | « IS & clôture » | ★ clôture signée, réouverture tracée, liasse par rubriques modifiables, révision par cycles, questions au client |

### 2.4 Stock, caisse, paie

| Fonction | Hesabi | SkanFact |
|---|---|---|
| Stock, mouvements automatiques, alertes | oui | ✅ + coût moyen pondéré, valeur au bilan, inventaire, numéros de série, garanties |
| **SKU / code-barres** | oui | ✅ 10.15.0 (H5) |
| **Caisse (POS) avec ticket 80 mm** | oui (tous plans) | ✅ 10.15.0 (H5) |
| Import de catalogue par IA (PDF, photo) | oui | ◐ import de tableur (clients et catalogue) ; lecture de photo en pause |
| Paie CDI, CDD, CIVP, Karama, saisonniers | oui | ✓ CDI, CDD, saisonnier, CIVP, SIVP, Karama, stage — taux réglables par contrat, figés sur le bulletin (10.15.0) |
| Congés, avances, attestations, solde de tout compte | non documenté | ★ |

### 2.5 Plateforme

| Fonction | Hesabi | SkanFact |
|---|---|---|
| Web : téléphone, tablette, PC | **oui** | ❌ application de bureau (Mac, Windows) |
| Fonctionne sans Internet | non | ★ entièrement hors ligne |
| Données chez le client, chiffrées | non (leur serveur) | ★ fichier local, AES-256, copie externe, sauvegardes datées |
| Utilisateurs | 3 (Starter), illimités (Pro) | ◐ dossier partagé à plusieurs postes, sans comptes par personne |
| Interface **arabe (RTL)** | **oui** | ❌ → H8 (CSS déjà en propriétés logiques depuis la 9.4.10) |
| Clés d'API | oui (Pro) | ❌ — sans objet pour une application de bureau tant qu'aucun client ne le demande |
| Visite guidée de chaque écran, « Guide-moi » | non documenté | ★ |
| Essai | 14 jours | ★ 30 jours |

---

## 3. Ce qu'on dit en une phrase à un client qui hésite

« Hesabi est un site web ; SkanFact est **ton** logiciel : il marche sans Internet, tes données restent
sur ton ordinateur et chiffrées, la comptabilité est celle d'un cabinet (rapprochement, lettrage,
clôture, liasse), ton comptable l'a **gratuitement**, et c'est 100 DT de moins par an. »

Ce qu'on ne peut pas encore dire, et qui fera perdre des ventes tant que ce n'est pas fait :
l'envoi à la TTN en un clic, TEJ, la caisse, l'arabe, et « sur mon téléphone ».

---

## 4. Le plan

**Faisable tout de suite, dans cet ordre (le code seul) :**

| # | Quoi | Pourquoi d'abord |
|---|---|---|
| **H1** ✅ | Importer la **facture TEIF d'un fournisseur** en achat, sans IA — livré en 10.15.0 | L'e-facture devient obligatoire : chaque client recevra des XML. Les lire exactement vaut mieux qu'un import « IA » |
| **H2** ✅ | **Envoyer par WhatsApp** — livré en 10.15.0 | Le canal réel en Tunisie ; petit geste, gros effet en démonstration |
| **H3** ✅ | **Export FEC** (entreprise et Cabinet) — livré en 10.15.0 | Hesabi l'affiche ; un comptable le demandera |
| **H4** ✅ | Contrat **saisonnier** et **CIVP** en paie — livré en 10.15.0, avec des taux réglables par contrat dans les deux applications | Deux lignes, et une case de moins dans le comparatif |
| **H5** ✅ | **Caisse** : vente comptoir, ticket 80 mm, code-barres, douchette — livré en 10.15.0, avec le bilan du tiroir et le retour d'un article par avoir | Les commerces : un marché que nous ne touchons pas du tout |
| **H6** | Calculateur de prix (coût + coefficient ou marge → prix) | Hesabi le vend en Pro |
| **H7** | Attestations d'exonération de retenue (fournisseur/client, dates de validité) | Complète la retenue, avant TEJ |
| **H8** | Interface en **arabe** | Gros chantier ; la traduction se relit par un arabophone |

**Bloqué par une démarche de Skander :**

- **Signer et envoyer à la TTN en un clic** : un contrat **NGSign** (ou l'API DigiGo) — c'est ce que
  fait Hesabi. Sans compte, on ne peut ni écrire ni tester l'appel.
- **TEJ** : les trois schémas `TEJDeclarationRS_v1.0.xsd`, `TEJISOPaysDevises.xsd`,
  `TEJRSCodesOperations_v1.0.xsd` et le cahier des charges, sur jibaya.tn.

**Décisions à prendre avec Skander (pas du code) :**

- **Le portail client en ligne** et **« sur mon téléphone »** : les deux supposent que les factures
  vivent sur un serveur. C'est l'inverse de notre promesse « tes données restent chez toi ». Une voie
  possible : un portail **facultatif**, qui ne publie que les factures qu'on choisit d'y mettre.
- Mettre en avant « hors ligne, données chez toi, comptable gratuit » sur le site, face à eux.

---

## Sources (pages de Hesabi, lues par les moteurs de recherche le 27/09/2026)

- [Tarifs Hesabi](https://hesabi.tn/tarifs)
- [Logiciel comptabilité](https://hesabi.tn/logiciel-comptabilite-tunisie)
- [TEJ retenue à la source](https://hesabi.tn/tej-retenue-source-tunisie) · [Guide TEJ](https://hesabi.tn/usage/12-tej)
- [Logiciel de paie](https://hesabi.tn/logiciel-paie-tunisie) · [Meilleur logiciel paie](https://hesabi.tn/meilleur-logiciel-paie-tunisie)
- [Gestion de stock](https://hesabi.tn/logiciel-gestion-stock-tunisie) · [Caisse POS](https://hesabi.tn/logiciel-caisse-pos-tunisie)
- [Hesabi vs Finco](https://hesabi.tn/hesabi-vs-finco) · [Hesabi vs Swiver](https://hesabi.tn/hesabi-vs-swiver)
- [Facturation électronique obligatoire 2026](https://hesabi.tn/actualites/facturation-electronique-obligatoire-tunisie-2026)
- [NGSign — facture électronique et API El Fatoora](https://www.ng-sign.com/api-ngsign-elfatoora/)
