# Contrôle e-facture — ce que notre modèle porte déjà, et ce qui manquerait

**F-9.1.1-06 · TEST-9.1.1-009 · écrit le 16/09/2026, sur le code de la 9.1.1.**

## Pourquoi ce document existe

La Tunisie généralise progressivement la facture électronique pour les assujettis TVA
(TTN / *El Fatoora*, format **TEIF**). La décision du projet n'a pas changé et ne change pas ici :
**on ne construit pas l'export tant que l'obligation ne tombe pas sur Skander ou sur un client** —
viser un format avant qu'il soit imposé, c'est viser un format qui bougera.

Mais il y a une question à laquelle on doit pouvoir répondre **aujourd'hui**, sans ouvrir le code :
*le jour où ça tombe, est-ce un chantier d'une semaine ou de trois mois ?* La réponse ne dépend pas
du format de sortie — un XML s'écrit vite. Elle dépend d'une seule chose : **les champs qu'un
format officiel exige sont-ils dans nos données, ou faut-il aller les redemander à chaque client
pour chaque facture déjà émise ?** Un champ manquant sur une facture de 2024 ne se rattrape pas.

C'est ce que ce tableau dit, champ par champ.

> **À VÉRIFIER.** La colonne « exigé » est fondée sur ce qu'un format de facture électronique
> demande habituellement (TEIF, EN 16931, Factur-X), **pas** sur une lecture de la spécification
> TEIF publiée par la TTN, que personne dans ce projet n'a eue entre les mains. Elle sert à
> mesurer un écart, pas à promettre une conformité. À reprendre avec le comptable, et avec la
> spécification réelle, le jour où la question se pose.

## Comment lire les colonnes

- **Exigé** — ce qu'un format officiel demande en général : `obligatoire`, `conditionnel`, `optionnel`.
- **Chez nous** — **oui** (le champ existe et est rempli), **partiel** (il existe mais peut être
  vide, ou porte autre chose), **non** (rien dans le modèle).
- **Où** — le champ exact, dans `Société` (`data.company`), `Document` (`data.documents[]`),
  `Ligne` (`doc.lines[]`) ou `Client` (`data.clients[]`).

---

## 1. L'émetteur (nous)

| Champ | Exigé | Chez nous | Où |
|---|---|---|---|
| Raison sociale | obligatoire | oui | `Société.name` |
| Identifiant fiscal (matricule) | obligatoire | oui | `Société.matricule` |
| Adresse postale complète | obligatoire | partiel | `Société.address` — **un seul champ libre**, pas de rue / ville / code postal / pays séparés |
| Code pays | obligatoire | non | déduit (Tunisie), jamais stocké |
| Registre de commerce | conditionnel | oui | `Société.rc` |
| Identifiant CNSS | conditionnel | oui | `Société.cnss` |
| Capital social | conditionnel | oui | `Société.capital` |
| Téléphone | optionnel | oui | `Société.phone` |
| Adresse électronique | conditionnel | oui | `Société.email` |
| Coordonnées bancaires (RIB / IBAN) | conditionnel | partiel | `Société.rib` — une chaîne libre, ni validée ni découpée en IBAN/BIC |
| Régime fiscal de l'émetteur | conditionnel | oui | `Société.taxRegime` (7.22.0) |

## 2. Le destinataire (le client)

| Champ | Exigé | Chez nous | Où |
|---|---|---|---|
| Raison sociale / nom | obligatoire | oui | `Client.name` |
| Identifiant fiscal du client | obligatoire | partiel | `Client.matricule` — **facultatif dans SkanFact**, et vide sur un particulier |
| Adresse postale | obligatoire | partiel | `Client.address` — un seul champ libre, comme le nôtre |
| Code pays du client | obligatoire | non | rien dans le modèle |
| Personne à contacter | optionnel | oui | `Client.contact` |
| Adresse électronique | conditionnel | oui | `Client.email` |
| Téléphone | optionnel | oui | `Client.phone` |
| Identifiant d'acheminement (routage TTN) | obligatoire | non | n'existe pas — il sera à demander à chaque client |

## 3. L'entête du document

| Champ | Exigé | Chez nous | Où |
|---|---|---|---|
| Numéro de la pièce | obligatoire | oui | `Document.number` (`FAC-AAAA-NNN`, attribué à l'émission) |
| Type de pièce (facture / avoir) | obligatoire | oui | `Document.type` |
| Date d'émission | obligatoire | oui | `Document.date` (jour de calendrier, `AAAA-MM-JJ`) |
| Date d'échéance | conditionnel | oui | `Document.dueDate` |
| Devise | obligatoire | oui | `Document.currency` |
| Taux de change vers la monnaie de déclaration | conditionnel | oui | `Document.exchangeRate` (obligatoire depuis la 7.0.1) |
| Référence de la commande du client | optionnel | oui | `Document.reference` |
| Objet | optionnel | oui | `Document.subject` |
| Référence de la pièce rectifiée (sur un avoir) | obligatoire sur un avoir | oui | `Document.creditOf` / `creditOfNumber` |
| Motif de la rectification | obligatoire sur un avoir | oui | `Document.creditReason` |
| Langue du document | optionnel | oui | `Document.lang` |
| Conditions de paiement | optionnel | oui | `Document.terms` / `Société.paymentTerms` |
| Notes libres | optionnel | oui | `Document.notes` |

## 4. Les lignes

| Champ | Exigé | Chez nous | Où |
|---|---|---|---|
| Libellé | obligatoire | oui | `Ligne.label` |
| Description détaillée | optionnel | oui | `Ligne.description` |
| Quantité | obligatoire | oui | `Ligne.qty` |
| Unité de mesure | obligatoire | partiel | `Ligne.unit` — **texte libre**, pas un code d'une nomenclature (UN/ECE Rec 20) |
| Prix unitaire HT | obligatoire | oui | `Ligne.unitPrice` |
| Taux de TVA de la ligne | obligatoire | oui | `Ligne.vatRate` |
| Montant HT de la ligne | obligatoire | oui | calculé (`computeTotals`) |
| Remise de ligne | conditionnel | non | seule la **remise globale** existe (`Document.discountRate`) |
| Code article / référence | optionnel | partiel | `Ligne.itemId` relie au catalogue, mais aucune référence n'est imprimée |
| Code de nomenclature douanière | conditionnel | non | rien dans le modèle |
| Motif d'exonération de TVA de la ligne | obligatoire si taux 0 | non | un taux 0 ne porte aucun motif ; seule la mention de régime existe, au niveau du document |

## 5. Les totaux et les taxes

| Champ | Exigé | Chez nous | Où |
|---|---|---|---|
| Total HT avant remise | obligatoire | oui | `totalHT` |
| Remise globale | conditionnel | oui | `Document.discountRate` → `discount` |
| Total HT net | obligatoire | oui | `netHT` |
| Ventilation de la TVA par taux (base et montant) | obligatoire | oui | `vatByRate` — base **et** montant, par taux |
| Total TVA | obligatoire | oui | `totalVAT` |
| Droit de timbre | conditionnel | oui | `stamp`, gelé à l'émission (`Document.stampFee`, 7.1.1) |
| Total TTC | obligatoire | oui | `totalTTC` |
| Retenue à la source (taux et montant) | conditionnel | oui | `Document.withholdingRate` → `withholding` |
| Net à payer | obligatoire | oui | `netToPay` |
| Montant en toutes lettres | conditionnel | oui | `amountToWords` (FR et EN) |
| Mention légale de non-assujettissement | obligatoire si hors TVA | oui | `mentionTVA(company)` (7.22.0) |
| Acompte déjà versé et déduit | conditionnel | oui | `depositLines` / `settlementLines` |

## 6. La signature et l'acheminement

| Champ | Exigé | Chez nous | Où |
|---|---|---|---|
| Signature électronique de la facture | obligatoire | non | **rien** — et c'est le vrai trou |
| Certificat de l'émetteur | obligatoire | non | rien |
| Horodatage d'émission | obligatoire | partiel | `Document.createdAt` est un instant, mais il n'est ni scellé ni opposable |
| Identifiant unique d'échange | obligatoire | non | rien |
| Accusé de dépôt / de réception | obligatoire | non | rien : SkanFact ne se connecte à aucune administration, par décision |

---

## Ce que le tableau dit, en trois phrases

1. **Les chiffres sont là.** Tout ce qui fait le calcul d'une facture — bases, taux, ventilation par
   taux, timbre, retenue, net à payer, devise et taux de change — existe, est stocké, et est gelé à
   l'émission. C'est la partie qui ne se rattrape pas après coup, et elle est faite.

2. **Les identités sont incomplètes, et ça se rattrape.** Adresses en un seul champ libre, pas de
   code pays, matricule du client facultatif, unités en texte libre, pas de motif d'exonération par
   ligne. Chacun est une migration de données et un champ de plus dans un formulaire — du travail,
   mais du travail qu'on peut faire le jour venu, sur les clients, pas sur les factures passées.
   Le seul qui coûte vraiment : **le motif d'exonération**, qui manquerait sur les factures à 0 %
   déjà émises.

3. **La signature et l'acheminement sont entièrement à faire**, et ne dépendent pas de nous : ils
   demandent un certificat, un raccordement à la TTN et un accusé de dépôt. C'est là que vit le
   vrai chantier — et c'est précisément la partie qu'il ne sert à rien de construire avant que la
   spécification soit imposée et lisible.

**Estimation à ce jour, à ne pas citer comme un engagement** : deux à trois semaines pour compléter
le modèle (champs d'identité, unités codées, motifs d'exonération, migration), plus un chantier
séparé, non chiffrable sans la spécification, pour la signature et l'acheminement.

## Quand relire ce document

- Quand l'obligation touche Skander ou un client (le déclencheur inscrit dans `VERSIONS-A-VENIR.md`) ;
- quand la spécification TEIF est réellement lue — la colonne « exigé » est alors à refaire ;
- à chaque version qui ajoute ou retire un champ de `Document`, `Ligne`, `Client` ou `Société`.
