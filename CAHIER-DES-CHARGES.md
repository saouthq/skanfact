# CAHIER-DES-CHARGES.md — la spécification technique de SkanFact

**Version 1.1 — 15/09/2026.** Lue sur le dépôt `saouthq/skanfact` au commit **`d7bfc54`** (v0),
**`6ebe904`** (v1) puis **`790633b`** (v1.1 ; aucun fichier de code n'a changé entre les trois).
Points de la relecture extérieure **retenus** : 1 (les trois listes de `livre.json` spécifiées —
v1.1 : un seul exemple complet qui montre la hiérarchie), 2 (Partie 15, intentions 9.3.0 → 10.0.0 —
v1.1 : un tableau Décidé / À décider **par écran**), 3 (catalogue porté à 60 fiches), 4 (contrat
IPC, Parties 4.5 et 5.5), 5 et 19 (JSON exacts de la plateforme), 6 (ordre de vérification de la
signature, avec la correction de son motif), 7 (`.skanrecover` complet), 8 (Partie 17, sécurité —
dont un vrai trou : l'injection CSV), 9 (Partie 18, limites), 10 (Partie 19, cas limites), 11
(Partie 20 — v1.1 : réduite aux **scénarios de reprise** que l'application doit offrir ; les six
runbooks d'exploitation sont partis là où ils vivaient déjà, voir le Journal), 12 (Partie 16,
séquences), 13 (Partie 21), 14 (renvoi + correspondance des e2e), 15 (CSS, existant nommé + `cab-`
décidé), 16 (raisons des interdictions), 17 (mode démo), 18 (idempotence, un défaut réel), 20
(Partie 22). Ce qui a été **refusé ou corrigé** est dans le « Journal des versions », en fin de
document.

*Écrit le 15/09/2026 sur le dépôt `saouthq/skanfact` au commit **`d7bfc54`** (version 9.0.0 des deux
applications). Tout ce qui est marqué **Livré** a été lu dans le code à ce commit ; tout ce qui est
marqué **Cible** est une spécification à implémenter, écrite pour être exécutée sans question. Ce
document ne redit ni `PLAN-DEVELOPPEMENT.md` (quand, qui, jalons) ni `QUESTIONS.md` § 16 (le contenu
de chaque version) : il les complète par les schémas, les signatures, les formats, les tests et les
migrations. En cas de contradiction avec `DIRECTION.md`, `DIRECTION.md` fait foi.*

---

## Partie 0 — Comment lire ce document

- Chaque spécification porte un identifiant citable dans un commit, un test ou une revue :
  `SPEC-DATA-nnn` (un fichier ou un schéma), `SPEC-FUNC-nnn` (une fonction), `SPEC-UI-ENT-nnn` /
  `SPEC-UI-CAB-nnn` / `SPEC-UI-CON-nnn` (un écran entreprise / cabinet / console), `SPEC-API-nnn`
  (une route), `SPEC-FMT-nnn` (un format de fichier), `SPEC-OUT-nnn` (outillage), `ERR-xxx-nnn`
  (un message d'erreur), `TEST-<version>-nnn` (un test à écrire), `MIG-<version>-nnn` (une migration).
- **Livré** = existe au commit `d7bfc54`, vérifié en lisant le fichier cité. **Cible** = à écrire ; la
  spécification dit comment. **À VÉRIFIER** = une information que le dépôt ne contient pas, avec la
  façon de la vérifier.
- Les types sont notés à la manière de JSDoc : `string`, `number`, `boolean`, `string|null`,
  `Array<Ligne>`, `Object<string, number>`. Une date de l'application est toujours une chaîne
  `AAAA-MM-JJ` (jour du calendrier, jamais un instant — `CLAUDE.md`, règle 5.2.3) ; un instant est
  un `number` (`Date.now()`) ou une chaîne ISO 8601 avec `Z`.
- Un champ marqué **(fac.)** est facultatif à la lecture : son absence ne casse rien et vaut la valeur
  par défaut indiquée. C'est la règle de tout le projet : « tout ce qui est ajouté doit être
  facultatif à la lecture » (`src/cabinet/cabcore.js`, `migrateDossier`).

---

## Partie 1 — Glossaire des identifiants

### Fichiers de données

| Nom | Chemin | Propriétaire | Format | Version actuelle | Documenté en |
|---|---|---|---|---|---|
| `skanfact-data.json` | `userData/dossiers/<id>/skanfact-data.json` | Entreprise | JSON, écriture atomique ; enveloppe `skanfact-encrypted` si chiffré | `version: 6` | SPEC-DATA-001 |
| `app-config.json` | `userData/app-config.json` | Entreprise et Cabinet (chacun le sien) | JSON | sans version | SPEC-DATA-002 |
| `licence.json` | `userData/dossiers/<id>/licence.json` | Entreprise | JSON | sans version | SPEC-DATA-003 |
| `cabinet-data.json` | `userData/cabinet-data.json` | Cabinet | JSON chiffré (scrypt + AES-256-GCM), mot de passe obligatoire | `format: 1` | SPEC-DATA-004 |
| `livre.json` | `userData/dossiers/<client>/livre-<exercice>.json` | Cabinet | JSON | **Cible**, `format: 1` | SPEC-DATA-005 |
| `licences-publiques.json` | `build/licences-publiques.json` (embarqué) | Dépôt | JSON | `format: 1` | SPEC-DATA-006 |
| `licence-public.json` | `build/licence-public.json` (embarqué, repli d'avant 8.4.0) | Dépôt | JSON | — | SPEC-DATA-006 |
| `update-config.json` | `userData/update-config.json` | les deux | JSON | — | SPEC-DATA-002 |
| `lecture-config.json` | `userData/lecture-config.json` (mode 0600) | Entreprise | JSON | — | en pause (`OCR_EN_PAUSE`) |
| `plateforme-admin.json` | `~/.skanfact/plateforme-admin.json` (0600) | Éditeur | JSON | — | SPEC-DATA-007 |
| `licence-privee.pem` | `~/.skanfact/licence-privee.pem` (0600) | Éditeur, **jamais dans le dépôt** | PEM PKCS#8 Ed25519 | — | SPEC-DATA-007 |
| `main.log` | `userData/main.log` | les deux | texte | non borné (**Cible** : borné, SPEC-OUT-004) | Partie 9 |

### Extensions de fichiers

| Extension | Rôle | Contenu | Chiffré ? | Signé ? | Documenté en |
|---|---|---|---|---|---|
| `.skanpack` | le paquet mensuel entreprise → cabinet | ZIP (ou ZIP scellé) | oui si cabinet appairé (X25519) ou mot de passe (scrypt) ; sinon non | **non** (Cible 9.2.0 : oui, SPEC-FMT-005) | SPEC-FMT-001 |
| `.skanpair` | le fichier d'appairage cabinet → client | JSON en clair | non | non (rien de secret ; l'empreinte se dicte) | SPEC-FMT-002 |
| `.skanrecover` | la clé de secours du cabinet | JSON, coffre AES-256-GCM | oui, par mot de passe distinct | non | SPEC-FMT-003 |
| `.skanask` | une question cabinet → client (9.10.0) | JSON scellé | oui, pour le client (X25519) | oui, par le cabinet | SPEC-FMT-006 (Cible) |
| `.skanclose` | la clôture d'exercice cabinet → client (9.8.0) | ZIP scellé (JSON + PDF) | oui, pour le client | oui, par le cabinet | SPEC-FMT-007 (Cible) |
| `SKAN1.…` | une clé de licence (chaîne, pas un fichier) | `SKAN1.<json b64url>.<sig b64url>` | non | oui, Ed25519 | SPEC-DATA-008 |

### Dossiers

| Chemin | Rôle | Contenu |
|---|---|---|
| `userData/` (Electron `app.getPath('userData')`) | racine des données d'une application ; en développement « SkanFact (essais) » / « SkanFact Cabinet (essais) » ; `--user-data-dir` prioritaire | tout ce qui suit |
| `userData/dossiers/<id>/` | une entreprise (app entreprise) | `skanfact-data.json`, `licence.json`, sauvegardes, `pieces-jointes/<doc>/`, `envois/` |
| `userData/dossiers/<client>/<annee>/` | les paquets rangés d'un client (Cabinet, `cabstore.reorganize`) | `*.skanpack` |
| `userData/backups/` (`backupDir`) | sauvegardes quotidiennes (30 jours, état du matin) et nommées (`avant-import`, `avant-demo`, `avant-beta`…) ; purge par DATE, filets en réserve propre | JSON |
| `src/renderer/` | l'app entreprise ; `core.js`, `rowmenu.js`, `reglages.js`, `style.css` sont **partagés** avec le Cabinet | voir Partie 13 |
| `src/cabinet/` | l'app Cabinet : `main.js`, `cabcore.js` (pur), `cabstore.js` (pur), `renderer/` | — |
| `plateforme/` | le worker Cloudflare de licences + `schema-a-coller.sql` | — |
| `worker/` | le relais de mise à jour | — |
| `build/` | icônes, `cabinet.config.js`, les deux fichiers de clés publiques, `release-notes.md` généré | — |
| `test/` | `run-tests.js` (`npm test`), `d1-sqlite.js` (base D1 sur SQLite Node), `e2e/` (42 fichiers) | — |
| `dist/`, `dist-cabinet/`, `dist-e2e/` | sorties de construction et captures (ignorés par Git) | — |

### Variables d'environnement et secrets

| Nom | Usage | Où | Qui la détient | Sensible ? |
|---|---|---|---|---|
| `UPDATE_BASE`, `UPDATE_SECRET` | adresse du relais et secret présenté par l'application (`PKG.updateBase/updateSecret` via `extraMetadata`) | secrets du dépôt → `release.yml` | Skander | secret (le secret arrête les curieux, pas un attaquant : `CLAUDE.md` 6.7.0) |
| `PLATEFORME_BASE`, `PLATEFORME_SECRET` | adresse de la plateforme (`https://api.skanfact.tn`) et le même secret d'application | idem | Skander | idem |
| `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `APP_SECRET`, `LICENCE_PUBLIC_KEY`, `LICENCE_REQUISE` | réglages du relais (`worker/skanfact-maj.mjs`) | Cloudflare | Skander | `GITHUB_TOKEN` : Contents read-only |
| `DB`, `APP_SECRET`, `LICENCE_PUBLIC_KEYS`, `REPONSE_PRIVATE_KEY`, `ADMIN_SECRET`, `SRV_PRIVATE_KEY`, `SRV_KID`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`, `MAIL_SIGNATURE`, `PRIX_INDEPENDANT`, `PRIX_ENTREPRISE`, `REMISE_PARRAINAGE` | réglages de la plateforme (`plateforme/README.md`) | Cloudflare | Skander | `REPONSE_PRIVATE_KEY`, `SRV_PRIVATE_KEY`, `ADMIN_SECRET`, `RESEND_API_KEY` : secrets |
| `SKANFACT_CLE_EMBARQUEE` | chemin d'un autre fichier de clés publiques (désarmer pour un test) | env., honoré **seulement si `!app.isPackaged`** | tests | non |
| `SKANFACT_DOSSIER_CLES` | remplace `~/.skanfact/` (clés d'essai des e2e) | env., développement | tests | non |
| `SKANFACT_PLATEFORME_BASE` | remplace l'adresse de la plateforme (e2e `plateforme`, `pont`) | env., développement | tests | non |
| `PLAYWRIGHT_BROWSERS_PATH`, `xvfb-run -a` | e2e sur machine sans écran | env. | tests | non |

---

## Partie 2 — Schémas de données

### SPEC-DATA-001 — `skanfact-data.json` (Livré, `version: 6`)

Source de vérité : `DEFAULT_DATA` et `migrateData` dans `src/renderer/core.js` ; `storage.js`
(`createStorage`) écrit le fichier atomiquement (`.tmp` puis `rename`), l'estampille
(`syncRevision`, `syncDevice`, `syncWrittenAt`) et refuse d'écrire si la révision sur disque a bougé
(`write()` rend `{ ok: false, conflict: true, disk }`).

**Racine** — tous les champs existent après `migrateData` ; à la lecture, un champ absent vaut le
défaut ci-dessous.

| Champ | Type | Défaut | Contrainte / sens |
|---|---|---|---|
| `version` | number | `6` | réécrit à `6` par `migrateData` |
| `company` | Société | `DEFAULT_COMPANY` | voir ci-dessous |
| `clients` | Array\<Client\> | `[]` | |
| `catalog` | Array\<Article\> | `[]` | |
| `documents` | Array\<Document\> | `[]` | devis, factures, avoirs, proforma, commande, livraison, contrat |
| `recurring` | Array\<Contrat\> | `[]` | contrats récurrents |
| `templates`, `snippets` | Array | `[]` | modèles, textes |
| `suppliers` | Array\<Fournisseur\> | `[]` | v4 |
| `purchases` | Array\<Achat\> | `[]` | v4 |
| `expenseCategories`, `fixedCategories` | Array\<string\> | `[]` | catégories ajoutées / considérées fixes |
| `fiscalDeadlines` | Array | `[]` | règles d'échéance activées/modifiées |
| `fiscalFilings` | Array\<string\> | `[]` | `ruleId@AAAA-MM-JJ` pointées (7.21.0) |
| `vatCarryIn` | Object\<string, number\> | `{}` | crédit de TVA par année, saisi à la main |
| `assets` | Array\<Immobilisation\> | `[]` | 3.5.0 |
| `stockAdjustments`, `serials` | Array | `[]` | v5 |
| `employees`, `payslips`, `leaves`, `advances`, `socialFilings` | Array | `[]` | v6 |
| `payrollSettings` | Object | `{}` | surcharge de `DEFAULT_PAYROLL` ; **aucun taux en dur ailleurs** |
| `projects` | Array\<Affaire\> | `[]` | |
| `accounts` | Array\<Compte\> | `[]` | comptes de trésorerie |
| `movements` | Array\<Mouvement\> | `[]` | mouvements libres |
| `auxiliaires` | boolean | `false` | sous-comptes 411001… (8.8.0) |
| `ecrituresOD` | Array\<OD\> | `[]` | `{ id, date, piece, label, lignes: [{ compte, label, debit, credit }] }` (8.9.0) |
| `chartAccounts` **(fac.)** | Object\<string,string\> | absent | surcharge de `DEFAULT_ACCOUNTS` par rôle |
| `licences` | Array\<Licence\> | `[]` | émises par l'éditeur ; vide chez un client |
| `pontImporte` | string | `''` | jour de l'envoi de l'historique à la console |
| `deleted` | Array | `[]` | suppressions mémorisées (fusion 3.2.0) |
| `conflictArchive` | Array | `[]` | versions écartées à la fusion |
| `closedUntil` | string | `''` | dernier jour clôturé `AAAA-MM-JJ` |
| `closureLog` | Array | `[]` | clôtures et réouvertures avec motif |
| `packs` | Array\<PaquetEnvoye\> | `[]` | `{ id, month, at, definitive, sealed, cabinet, files, bytes, digest, path, missing }` |
| `demo` | boolean | `false` | données d'exemple chargées |
| `counters` | Object\<string, number\> | `{}` | compteurs de numérotation, clé `<PREFIX>-<AAAA>` — **écrits par `nextNumber` même si l'enregistrement échoue ensuite** (règle 6.0.0 : tout garde-fou se pose avant) |
| `syncRevision`, `syncDevice`, `syncWrittenAt` | number, string, string | posés par `storage.stamp` | ne jamais écrire à la main |

**Société** (`DEFAULT_COMPANY`, 40 champs) — les champs qui entrent dans un calcul : `stampFee`
(number, `1.0`, **en dinars**, converti dans la devise du document), `defaultWithholdingRate`
(number, `0`), `currency` (code de `CURRENCIES`, `'DT'`), `taxRegime` (`''|'reel'|'forfaitaire'|
'exonere'`, vide = réel), `defaultVatRate` (`''` = 19, sinon number, **`0` est légitime** — tester
`=== ''`, jamais `||`), `paymentTermsDays`, `quoteValidityDays` (30), `activity` (id d'`ACTIVITIES`),
`modules` (`null` = tout affiché, sinon Array\<string\> d'ids de `MODULES`), `cabinet` **(fac.)**
`{ name, email, publicKey, fingerprint, pairedAt }`, `emailTemplates` **(fac.)**, `demoFields`
**(fac.)** (champs empruntés par l'exemple). Les autres sont de l'identité et de l'affichage
(`name`, `matricule`, `rc`, `cnss`, `capital`, `address`, `phone`, `email`, `website`, `rib`,
`bank`, `logo`, `footer`, `paymentTerms(En)`, `quoteTerms(En)`, `defaultLang`, `stampImage`,
`theme`, `tagline`, `accountantEmail`, `primaryColor`, `accentColor`, `revenueTarget`,
`dormantDays`, `setupDone`).

**Document** (`newDocument(type)` dans `app.js`, complété par `migrateData`) :

| Champ | Type | Contrainte |
|---|---|---|
| `id` | string | `uid()` : `Date.now().toString(36) + 6 car. aléatoires` |
| `type` | `'devis'|'facture'|'avoir'|'proforma'|'commande'|'livraison'|'contrat'` | |
| `number` | string | `''` sur un brouillon ; `DEV/FAC/AVO/PRO/BC/BL/CTR-AAAA-NNN` ; facture et avoir numérotés **à l'émission seulement** |
| `date`, `dueDate` | `AAAA-MM-JJ`, string | `dueDate` vide sur commande/livraison/contrat/avoir |
| `clientId`, `subject`, `reference`, `notes` | string | |
| `lines` | Array\<Ligne\> | ≥ 1 |
| `discountRate` | number | % ; ne porte pas sur les lignes `noDiscount` |
| `applyStamp` | boolean | facture : `!== false` applique ; avoir/proforma : `=== true` applique ; jamais ailleurs |
| `stampFee` **(fac.)** | number\|'' | **gelé à l'émission** (7.1.1) : vide = réglage courant (brouillon) |
| `status` | string de `STATUSES[type]` | « payée / partielle / retard / expiré » sont **déduits**, jamais écrits |
| `payments` | Array\<Paiement\> | `{ id, date, amount, method, accountId, reference, note, pointe? }` |
| `withholdingRate` | number | % sur facture/avoir/proforma, `0` ailleurs |
| `createdAt` | number | `Date.now()` |
| `lang`, `currency`, `exchangeRate` | `'fr'|'en'`, code devise, number\|'' | `exchangeRate` = « 1 devise = x DT », **obligatoire si `currency !== company.currency`** (`missingRate`) |
| `reminders`, `emails`, `attachments`, `withholdingCertificate`, `recurringId`, `fromDocId`, `fromDocType`, `fromDocNumber`, `fromQuoteId`, `deposit`, `projectId`, `clauses`, `hidePrices`, `creditOf`, `creditOfNumber`, `creditReason` | **(fac.)** | selon le type ; un avoir porte `creditOf` (id de la facture) |

**Ligne** (`newLine(company)`) : `{ label: string, qty: number, unit: string, unitPrice: number,
vatRate: number (0|7|13|19 ou libre), noDiscount?: boolean, itemId?: string, cost?: number }`.
`qty * unitPrice` est arrondi à 3 décimales **par ligne** avant toute somme.

**Client** : `{ id, name, matricule?, address?, email?, phone?, contact?, notes?, lang?, currency?,
withholdingRate?: number|'' }` — un taux vide veut dire « celui de la société ». **Cible 9.1.1** :
`stampExempt?: boolean` (SPEC-DATA-001b).

**Achat** (`newPurchase(kind, supplierId)`) : `{ id, kind: 'facture'|'depense'|'avoir'|'acompte',
supplierId, number (celui du fournisseur), date, dueDate, subject, category, notes, fees: number,
withholdingRate, currency, exchangeRate, achatLie, lines: [{ label, qty, unit, unitPrice, vatRate,
destination: 'charge'|'stock'|'immobilisation', deductible: boolean }], payments, attachments,
createdAt, projectId? }`.

`currency` / `exchangeRate` (10.1.0) : la devise de la pièce du fournisseur et le taux du jour.
`migrateData` pose la devise de la société avec un taux de 1 sur tout achat qui n'en portait pas,
donc aucun chiffre existant ne bouge ; `missingRate` refuse l'enregistrement quand la devise diffère
et que le taux manque. `achatLie` (10.2.0) : l'identifiant de la facture d'achat qu'un `avoir` ou un
`acompte` diminue — vide tant que la pièce n'est pas rattachée, ce qui est un état normal que
`todoList` rappelle (`achat-impute`). Les deux pièces doivent être dans la même devise.
`purchaseTotals` rend `sens` (−1 pour un avoir) et un bloc `base` SIGNÉ ET CONVERTI : c'est lui que
lisent tous les agrégateurs, et `base.avance` (non nul pour un acompte seulement) porte ce qui va au
compte d'avances au lieu d'une charge.

**Licence émise** (`data.licences[]`) : `{ id, clientId, nom, matricule, offre: 'independant'|
'entreprise', exp, key, emisLe, cabinet (empreinte), note, invoiceId, itemId, prix, tva, emails: [],
remplace, remplaceePar?, motif?, revoqueeLe?, revoqueMotif?, origine?: 'console',
envoyeeConsoleLe?, payeeConsoleLe?, venteConsoleId? }`.

**Exemple minimal valide** (ce que `migrateData({})` produit, réduit aux listes non vides) :

```json
{
  "version": 6,
  "company": { "name": "Exemple SUARL", "matricule": "1234567A", "currency": "DT", "stampFee": 1,
               "taxRegime": "reel", "defaultWithholdingRate": 0, "modules": null },
  "clients": [{ "id": "mfz1k2a3b4c5", "name": "Client Test", "matricule": "7654321B", "withholdingRate": "" }],
  "documents": [{
    "id": "mfz1k2x9y8z7", "type": "facture", "number": "FAC-2026-001", "date": "2026-09-15",
    "dueDate": "2026-10-15", "clientId": "mfz1k2a3b4c5", "subject": "Prestation", "reference": "",
    "lines": [{ "label": "Audit", "qty": 1, "unit": "", "unitPrice": 1000, "vatRate": 19 }],
    "discountRate": 0, "applyStamp": true, "stampFee": 1, "status": "envoyée", "notes": "",
    "payments": [], "withholdingRate": 0, "createdAt": 1789600000000,
    "lang": "fr", "currency": "DT", "exchangeRate": ""
  }],
  "counters": { "FAC-2026": 1 },
  "catalog": [], "recurring": [], "templates": [], "snippets": [], "suppliers": [], "purchases": [],
  "expenseCategories": [], "fiscalDeadlines": [], "assets": [], "stockAdjustments": [], "serials": [],
  "employees": [], "payslips": [], "payrollSettings": {}, "leaves": [], "advances": [],
  "socialFilings": [], "fiscalFilings": [], "vatCarryIn": {}, "projects": [], "fixedCategories": [],
  "accounts": [], "movements": [], "auxiliaires": false, "ecrituresOD": [], "licences": [],
  "pontImporte": "", "deleted": [], "conflictArchive": [], "closedUntil": "", "closureLog": [],
  "packs": [], "demo": false
}
```

**Le mode démo (`data.demo === true`)** — ce qu'il change, et rien d'autre (Livré, 7.0.0 → 7.6.0) :
un bandeau permanent sur chaque page ; **13 appels à `demoBlock`** dans `app.js` posés sur les
gestes qui sortent de l'ordinateur (envoi d'un mail, du paquet au cabinet, d'une relance, d'une
attestation, de la déclaration…) — `demoBlock` **prévient et propose deux issues** (« Repartir de
mes données » / « Continuer quand même »), il n'interdit jamais ; l'export PDF reste libre mais le
document porte le tampon « EXEMPLE » (`stampFor`, une seule fonction pour les quatre chemins) ;
l'identité empruntée est notée champ par champ (`company.demoFields`) et rendue par
`rendreLesEmprunts` à la sortie comme par « Tout effacer » (`wipeData`, déduit de `DEFAULT_DATA`) ;
le chargement prend la sauvegarde `avant-demo` et prévient si une période est clôturée
(`closedWipeOk`). **Ce qu'il ne change pas** : la licence (l'essai compte, une clé collée reste
jugée — la démo n'est pas un passe-droit), la numérotation (les pièces d'exemple consomment les
compteurs, d'où « Tout effacer » qui les remet à zéro), le paquet (il se fabrique, il porte
`entreprise` = l'identité empruntée, et `demoBlock` prévient avant l'envoi). Un paquet reçu par un
cabinet depuis une démo n'est pas distinguable d'un vrai — **Cible 9.2.0** : `manifest.demo: true`
et le Cabinet le range comme « exemple », jamais dans un dossier réel.

**Règles de validation** : `storage.isValidData(obj)` (`src/storage.js` l. 50 : un objet non
tableau ; `clients`, `catalog`, `documents` absents ou tableaux ; `company` absent ou objet non
nul) ; un fichier illisible est **mis de côté,
jamais écrasé** ; `migrateData` est idempotent (l'appeler deux fois donne le même résultat — un test
le tient). **Interdit d'écrire** : `doc.paidDate` (converti en paiement depuis la 1.4), un `status`
déduit, un `stampFee` sur un brouillon, un compte auxiliaire calculé à l'affichage (il est figé sur la
fiche : `compteAux`).

### SPEC-DATA-002 — `app-config.json` et `update-config.json` (Livré)

`app-config.json` (les deux applications, clés lues dans `main.js`) : `deviceId` (string, posé à
l'installation), `deviceName`, `installedAt` (ISO), `armedAt` (ISO, première fois qu'une clé publique
est vue sur ce poste — plancher de l'essai), `dossiers` (Array `{ id, label, path? }`), `current`
(id du dossier ouvert), `externalBackupDir` (string), `beta` (boolean), `window` (état de fenêtre),
`inboxDir`, `inboxSeen`, `recoveryExportedAt` (Cabinet : date d'export de la clé de secours, ou date
`creeLe` d'une clé restaurée). Aucune migration : chaque clé est facultative.

`update-config.json` : `token` (jeton GitHub collé quand le dépôt est privé — jamais dans le code).

### SPEC-DATA-003 — `licence.json` du dossier (Livré)

Écrit par `ecrireLicence(key)` (`src/main.js`) : `{ key?: string, savedAt?: ISO, armedAt?: ISO,
serveur?: Verdict }`. `armedAt` et `serveur` **survivent** à la pose et au retrait de la clé ; le
fichier est supprimé seulement s'il ne reste rien. `Verdict` (8.4.0) = ce que `verifierReponse`
(`src/licence.js` l. 270) rend : `{ ok, raison, etat, motif, emisLe, sujet }` — `sujet` = empreinte
de la clé visée (une réponse pour une autre licence est ignorée), signature et date obligatoires,
une date trop vieille refusée. Une clé héritée de la 6.4.0 dans
`userData/licence.json` n'est reprise que pour le dossier dont le matricule correspond.

### SPEC-DATA-004 — `cabinet-data.json` (Livré, `format: 1`)

Source : `DEFAULT_STATE`, `migrate`, `migrateDossier` dans `src/cabinet/cabcore.js` ; chiffré par
`cabstore` (mot de passe obligatoire, sel par création — d'où `peek` qui réessaie avec le sel de la
sauvegarde, `CLAUDE.md` 6.8.0).

```json
{
  "format": 1,
  "cabinet": { "name": "Cabinet Exemple", "email": "cabinet@exemple.tn", "phone": "",
               "publicKey": "<base64 SPKI DER X25519>", "privateKey": "<base64 PKCS8 DER X25519 — jamais sur le pont>" },
  "settings": { "relanceDay": 10, "deadlines": { "tvaDay": 28, "cnssDay": 15 } },
  "dossiers": [{
    "id": "MAT:1234567A", "name": "Exemple SUARL", "matricule": "1234567A",
    "email": "", "phone": "", "contact": "", "note": "", "archived": false, "demo": false,
    "manual": false, "from": "2026-01", "regime": "", "tvaPeriod": "", "fees": 0,
    "createdAt": 1789600000000,
    "relances": [{ "at": 1789700000000, "months": ["2026-07"], "via": "email", "note": "" }],
    "packs": [{
      "month": "2026-08", "label": "août 2026", "definitive": true,
      "receivedAt": 1789800000000, "generatedAt": "2026-09-05T08:12:00.000Z",
      "files": 9, "missing": [], "absent": 0, "digest": "<sha256>", "bytes": 184322,
      "path": "…/dossiers/Exemple_SUARL/2026/2026-08.skanpack", "sealed": true,
      "appVersion": "9.0.0", "figures": { "ca": 12000, "tvaCollectee": 2280, "tvaDeductible": 310,
      "tvaADecaisser": 1970, "creditTva": 0, "encaisse": 9800, "devise": "DT" },
      "integrite": { "ok": true, "verifies": 9, "absents": 0, "inconnus": 0 }
    }]
  }]
}
```

Contraintes : `id` = `dossierKey` (**matricule d'abord** — `MAT:<matricule normalisé>` —, sinon
`NOM:<nom normalisé \p{L}\p{N}>`) ; `relanceDay` ∈ [1, 28] sinon 10 ; `tvaDay`/`cnssDay` ∈ [1, 31]
sinon défaut ; `from` = `AAAA-MM` ou `''` ; un dossier `demo` s'efface au premier vrai paquet ; le
champ s'appelle **`integrity`** (`packSummary`, `cabcore.js` l. 161 : `extra.integrity || null`)
— le verdict rangé avec le paquet depuis 6.8.1, **(fac.)** ; l'exemple ci-dessus l'écrit `integrite`
par erreur de ma part : lire `integrity`. `privateKey` **ne traverse jamais le
pont** (`safeState()` — un test relit chaque handler). **Cible 9.2.0** (SPEC-DATA-004b) : par
dossier, `clePublique: string` (base64 SPKI DER Ed25519 du client), `cleEpingleeLe: number`,
`cleEmpreinte: string` (`keyFingerprint`) ; par pack, `signature: 'ok'|'absente'|'inconnue'`.
**Cible 9.1.0** : `settings.cleSecoursReporteeLe: number|null` (« pas maintenant », une fois).

### SPEC-DATA-005 — `livre.json` (Cible 9.2.0, `format: 1`) — **la spécification la plus importante**

Un fichier **par dossier et par exercice** : `userData/dossiers/<client>/livre-<AAAA>.json`. Un
index léger par dossier, `livre-index.json`, liste les exercices et leur état (ouvert / clos) pour
éviter d'ouvrir soixante fichiers pour une liste. Écriture atomique par `cabstore` (même mécanisme
que `cabinet-data.json`, chiffré avec la même clé dérivée). Le format est **figé** : tout ajout
ultérieur est facultatif à la lecture.

**Le corps est BINAIRE, pas base64** — décidé par la mesure, le 16/09/2026 (`npm run charge`,
SPEC-OUT-006), avant d'écrire une ligne de 9.2.0. Sur un livre de 50 000 lignes, valider une
écriture réécrit le fichier entier et coûtait **147 ms** pour un seuil de 100 ms ; en corps binaire,
**79 ms**. base64 ajoute 33 % d'octets et 46 % du temps d'écriture, pour rien. C'est la règle de la
6.1.0 (« le corps est binaire, pas base64 ») qui n'avait jamais été portée à `cabstore` parce
qu'elle ne coûtait rien sur un petit fichier d'état. La forme retenue est celle du paquet mensuel :
**l'entête reste en clair sur une ligne** (`{ "skanfact-cabinet": 1, kdf, salt, iv, tag }\n`), puis
les octets chiffrés — sans entête lisible, un fichier mal rangé serait impossible à identifier sans
la clé. `cabinet-data.json` ne change **pas** : il est petit, et une migration de son enveloppe
serait un risque pour zéro gain.

Les trois autres seuils sont tenus largement et ne demandent donc **aucune** des autres parades
envisagées — ni découpage par mois, ni index de recherche, ni journal d'ajouts : ouverture 159 ms
(seuil 1 000), balance de 60 dossiers 1 291 ms (seuil 5 000), recherche globale 1 040 ms (seuil
3 000), sur un portefeuille de 345 001 lignes et 97 Mo. La clé se dérive **une fois** au
déverrouillage et se garde en mémoire : la redériver par fichier coûterait 6,8 s sur 60 dossiers.

```json
{
  "format": 1,
  "dossier": "MAT:1234567A",
  "exercice": { "annee": 2026, "du": "2026-01-01", "au": "2026-12-31",
                "clos": false, "closLe": null, "closPar": null, "reouvertures": [] },
  "plan": [
    { "compte": "411", "libelle": "Clients", "nature": "tiers", "collectif": true, "source": "sce" },
    { "compte": "411001", "libelle": "Client Test", "nature": "tiers", "parent": "411", "tiersId": "mfz1k2a3b4c5", "source": "saisie" }
  ],
  "journaux": [
    { "code": "VT", "libelle": "Ventes", "type": "ventes" }, { "code": "AC", "libelle": "Achats", "type": "achats" },
    { "code": "BQ", "libelle": "Banque", "type": "tresorerie", "compte": "532" },
    { "code": "OD", "libelle": "Opérations diverses", "type": "od" }, { "code": "AN", "libelle": "À-nouveaux", "type": "an" }
  ],
  "ecritures": [{
    "id": "e_01J8ZK…", "numero": 12, "date": "2026-08-14", "journal": "VT", "piece": "FAC-2026-031",
    "libelle": "Facture FAC-2026-031 Client Test",
    "source": "skanfact", "mois": "2026-08", "docId": "mfz1k2x9y8z7", "pieceJointe": "ventes/FAC-2026-031.pdf",
    "statut": "validee", "auteur": "import", "creeLe": 1789800000000, "valideeLe": 1789800000000,
    "contrepasseDe": null, "extourneDe": null,
    "lignes": [
      { "compte": "411001", "tiersId": "mfz1k2a3b4c5", "libelle": "Client Test", "debit": 1191, "credit": 0, "lettre": "AB" },
      { "compte": "706", "libelle": "Audit", "debit": 0, "credit": 1000, "lettre": "" },
      { "compte": "4367", "libelle": "TVA collectée 19 %", "debit": 0, "credit": 190, "lettre": "" },
      { "compte": "4368", "libelle": "Timbre fiscal", "debit": 0, "credit": 1, "lettre": "" }
    ]
  }],
  "lettrages": [{ "lettre": "AB", "compte": "411001", "ecritures": ["e_01J8ZK…", "e_01J9AA…"], "le": "2026-09-02", "par": "import" }],
  "releves": [{
    "id": "r_01J9…", "compte": "532", "banque": "BIAT", "du": "2026-03-01", "au": "2026-03-31",
    "soldeDebut": 12500.000, "soldeFin": 14210.500, "fichier": "releve-mars.csv", "empreinte": "<sha256>",
    "importeLe": 1789800000000, "par": "skander",
    "lignes": [
      { "id": "rl_01J9…", "date": "2026-03-04", "libelle": "VIR CLIENT TEST FAC-2026-031", "montant": 1191.000,
        "reference": "",
        "rapprochement": { "niveau": "certain", "ecritureId": "e_01J8ZK…", "ligne": 0, "le": "2026-04-02", "par": "auto" },
        "ecritureId": null }
    ]
  }],
  "immobilisations": [{
    "id": "i_01J9…", "libelle": "Serveur Dell", "compte": "2241", "compteAmort": "2841", "compteDotation": "681",
    "dateAcquisition": "2026-02-10", "dateMiseEnService": "2026-02-15", "valeur": 4800.000, "tva": 912.000,
    "methode": "lineaire", "duree": 3, "tauxDegressif": null, "prorata": "jours360",
    "origine": { "source": "skanfact", "docId": "ach_…", "mois": "2026-02" },
    "plan": [ { "annee": 2026, "dotation": 1413.333, "cumul": 1413.333, "vnc": 3386.667, "ecritureId": "e_…" } ],
    "cession": null, "creeLe": 1789800000000, "par": "import"
  }],
  "declarations": [{
    "id": "d_01J9…", "type": "mensuelle", "periode": "2026-03", "prepareeLe": 1789800000000, "par": "skander",
    "cases": {
      "tvaCollectee":  { "montant": 2280.000, "ecritures": ["e_…", "e_…"] },
      "tvaDeductible": { "montant": 310.000,  "ecritures": ["e_…"] },
      "creditReporte": { "montant": 0,        "ecritures": [] },
      "netAPayer":     { "montant": 1970.000, "ecritures": [] },
      "retenues":      { "montant": 15.000,   "ecritures": ["e_…"] },
      "tfp":           { "montant": null,     "ecritures": [] },
      "foprolos":      { "montant": null,     "ecritures": [] },
      "tcl":           { "montant": null,     "ecritures": [] },
      "timbre":        { "montant": 6.000,    "ecritures": ["e_…"] }
    },
    "controles": [ { "id": "4366-report", "ok": true, "detail": "" } ],
    "deposee": { "le": "2026-04-15", "par": "skander", "reference": "" },
    "ecritureId": "e_…"
  }],
  "ouverture": { "date": null, "source": null, "lignes": [] },
  "audit": [{ "quand": 1789800000000, "qui": "import", "quoi": "import-paquet", "detail": "2026-08 (définitif), 37 écritures" }]
}
```

| Champ | Type | Contrainte |
|---|---|---|
| `format` | number | `1` ; une version **inconnue** (supérieure) → refus lisible `ERR-CAB-020`, le fichier n'est pas touché |
| `dossier` | string | = `dossiers[].id` de `cabinet-data.json` |
| `exercice.annee`, `du`, `au` | number, date, date | `du` ≤ `au` ; un exercice décalé est permis (`du: "2026-07-01"`) |
| `exercice.clos`, `closLe`, `closPar`, `reouvertures[]` | boolean, ISO\|null, string\|null, `[{ quand, qui, motif }]` | **une réouverture exige un motif** (règle 6.0.0) |
| `plan[]` | `{ compte: string (chiffres, 1 à 12), libelle, nature: 'bilan'|'gestion'|'tiers'|'tresorerie', collectif?: boolean, parent?: string, tiersId?: string, source: 'sce'|'import'|'saisie', desactive?: boolean }` | `compte` unique ; on ne **supprime** jamais un compte qui porte une ligne (`desactive: true`) |
| `journaux[]` | `{ code (≤ 5 majuscules/chiffres), libelle, type: 'ventes'|'achats'|'tresorerie'|'od'|'an'|'paie', compte?: string }` | `code` unique |
| `ecritures[]` | Écriture | voir invariants |
| `ecritures[].numero` | number\|null | **attribué à la validation, jamais au brouillard** ; continu dans l'exercice, sans trou, par ordre de validation (**pas** de date) ; `null` en brouillard |
| `ecritures[].statut` | `'brouillard'|'validee'|'contrepassee'` | une `validee` ne se modifie **jamais** (ni lignes, ni date, ni journal) ; on la contre-passe |
| `ecritures[].source` | `'skanfact'|'saisie'|'banque'|'inventaire'|'an'|'import'|'od'` | `skanfact` porte `mois` et `docId` ; modifiable en brouillard avec trace (`CLAUDE.md`, direction 15/09) |
| `ecritures[].lignes[]` | `{ compte, tiersId?, libelle, debit: number ≥ 0, credit: number ≥ 0, lettre: string }` | `debit === 0 \|\| credit === 0` (jamais les deux) ; **un montant négatif change de colonne** |
| `lettrages[]` | `{ lettre, compte, ecritures: string[], le, par }` | la somme débit − crédit des lignes lettrées **= 0** au millime |
| `releves[]`, `immobilisations[]`, `declarations[]` | Array | `[]` tant que 9.5.0 / 9.7.0 / 9.6.0 ne les remplissent pas ; leur **forme est figée ici** (exemple ci-dessus, invariants ci-dessous) — la v0 les disait « hors de ce document », la v1 les a spécifiées, la v1.1 corrige cette ligne restée fausse |
| `inventaires[]` | Array | **Ajoutée en 9.7.0**, par décision : l'inventaire de stock de fin d'exercice ne pouvait pas être une écriture (une écriture porte UN montant, un inventaire porte ce qui a été compté ligne par ligne, et un total qu'on ne peut pas ouvrir se croit ou ne se croit pas). Objet : `{ id, date, lignes[]{ ref, libelle, quantite, cout, valeur }, total, compte, saisiLe, par, ecritureId }`. **Absente d'un livre écrit avant, elle vaut `[]`** : une liste ajoutée est compatible, un champ renommé ou retiré ne l'est pas — c'est la règle que le test du format porte désormais |
| `immobilisations[].residuelle`, `.bascule`, `.subvention`, `.cession.motif` | — | **Champs optionnels ajoutés en 9.7.0.** `residuelle` (0 par défaut) pour la parité avec `data.assets` ; `bascule` (false) pour le dégressif ; `subvention` (`null` ou `{ montant, compte, compteReprise }`) ; `cession.motif` (`'cession'` ou `'rebut'`). Absents, ils ne changent rien |
| `ouverture` | `{ date, source: 'balance'|'skanfact'|null, lignes: [{ compte, debit, credit }] }` | la balance d'ouverture de reprise, transformée en une écriture AN `piece: "OUVERTURE"` |
| `audit[]` | `{ quand: number, qui: string, quoi: string, detail?: string }` | **jamais purgé** |

**Invariants (tous tenus par un test, TEST-9.2.0-0xx)** :
1. Pour chaque écriture : `Σ debit = Σ credit` à 0,001 près, **sinon elle n'entre pas** (`odValide`
   existe déjà pour l'OD ; on le généralise en `compta.ecritureValide`).
2. Toute ligne référence un `compte` du `plan` (ou le plan reçoit le compte avec `source: 'import'`
   et un libellé « Compte hors plan » — jamais un refus silencieux).
3. `numero` : la suite des `validee` triées par `numero` est `1..n` sans trou.
4. Une `validee` importée d'un paquet **remplacée par un mois renvoyé** n'est pas modifiée : l'écart
   est calculé et affiché (`QUESTIONS.md` § 16, 9.2.0).
5. `lettrages` : chaque `lettre` cohérente (règle ci-dessus) et chaque id d'écriture existant.

**Les trois listes dont la FORME est figée dès la 9.2.0** (Cible ; leurs champs restent
extensibles — tout ajout est facultatif à la lecture — mais leur forme, elle, ne bouge plus, parce
qu'un relevé « par ligne » ne se transforme pas en relevé « par compte » une fois écrit chez
soixante clients). Ce que les trois ont en commun : un `id`, une trace (`creeLe`, `par`), et un
lien vers les écritures qu'ils ont produites (`ecritureId`), jamais l'inverse.

**La hiérarchie, en une phrase (v1.1)** : les trois listes sont **à la racine du livre**, sœurs de
`ecritures[]` et **plates entre elles** (aucun relevé dans une immobilisation, aucune déclaration
dans un relevé) ; chacune **imbrique ses propres enfants** — un relevé porte ses `lignes[]`, et
chaque ligne son `rapprochement` ; une immobilisation porte son `plan[]` (une entrée par année) et
sa `cession` ; une déclaration porte ses `cases{}` (objet à clés ouvertes), ses `controles[]` et sa
`deposee` ; et **aucune écriture n'est jamais imbriquée dedans** : le lien va de l'objet vers
l'écriture par `ecritureId`, jamais l'inverse (une écriture ne sait pas qu'un relevé l'a produite —
c'est ce qui permet de supprimer un relevé mal importé sans toucher au journal). L'exemple complet
en tête de SPEC-DATA-005 montre un objet de chaque, à sa place.

`releves[]` — un relevé bancaire importé (9.5.0) ; **un objet par fichier importé**, les lignes
dedans (pas une liste plate de lignes : le comptable pense « le relevé de mars »).

Objet : voir `releves[0]` dans l'exemple complet ci-dessus (`id`, `compte`, `banque`, `du`, `au`,
`soldeDebut`, `soldeFin`, `fichier`, `empreinte`, `importeLe`, `par`, `lignes[]` avec `id`, `date`,
`libelle`, `montant`, `reference`, `rapprochement{ niveau, ecritureId, ligne, le, par }`, `ecritureId`).

Invariants : `montant` signé (crédit bancaire > 0, débit < 0 — c'est le seul endroit du livre où un
montant porte un signe, parce que c'est ainsi que la banque l'écrit) ; `rapprochement.niveau` ∈
`certain | probable | a-confirmer | aucun` et **jamais `certain` posé par `auto` sur une ambiguïté**
(règle 32) ; `soldeDebut + Σ montant = soldeFin` à 0,001 près, sinon l'import est refusé avec
l'écart (`ERR-CAB-040`) ; `ecritureId` non nul quand la ligne a **généré** une écriture (frais
bancaires, virement inconnu → 471) ; `empreinte` empêche d'importer deux fois le même fichier.

`immobilisations[]` — une fiche de bien côté cabinet (9.7.0), même modèle que côté entreprise
(`data.assets`, 3.5.0) pour que `compta.js` partage le calcul.

Objet : voir `immobilisations[0]` dans l'exemple complet ci-dessus (`id`, `libelle`, `compte`,
`compteAmort`, `compteDotation`, `dateAcquisition`, `dateMiseEnService`, `valeur`, `tva`, `methode`,
`duree`, `tauxDegressif`, `prorata`, `origine{ source, docId, mois }`, `plan[]{ annee, dotation,
cumul, vnc, ecritureId }`, `cession`, `creeLe`, `par`).

Invariants : `plan` est **recalculé** depuis les champs, jamais saisi (la dernière annuité absorbe
les arrondis ; `vnc` finit à 0) ; `methode` ∈ `lineaire | degressif` ; `tauxDegressif` **réglable,
jamais un coefficient en dur** (À VÉRIFIER avec le comptable : les coefficients tunisiens) ;
`cession` = `null` ou `{ date, prix, ecritureId, resultat }` ; une dotation passée en écriture
d'inventaire porte `ecritureId`, et l'écriture porte `source: 'inventaire'`.

`declarations[]` — une déclaration préparée (9.6.0), **un objet par déclaration par période**,
chaque case tracée jusqu'aux écritures qui la font.

Objet : voir `declarations[0]` dans l'exemple complet ci-dessus (`id`, `type`, `periode`,
`prepareeLe` — sans accent : la v1 écrivait `preparéeLe`, une clé JSON ne porte jamais d'accent —,
`par`, `cases{ <case>: { montant, ecritures[] } }`, `controles[]{ id, ok, detail }`,
`deposee{ le, par, reference }`, `ecritureId`).

Invariants : une case dont la règle n'est pas connue vaut **`null`, jamais 0** (règle 36) ; la
clé de `cases` est une liste **ouverte** (une case de plus n'est pas un changement de format) ;
`deposee` est un pense-bête, jamais un dépôt (règle 5.2.0) ; `ecritureId` = l'écriture de
déclaration au dernier jour du mois (4367/4366 → 4365), avec les chiffres de `vatChain`.

**Ce qui n'est PAS une liste du livre, et pourquoi** : les provisions, charges constatées d'avance,
factures non parvenues sont des **écritures d'inventaire** (`source: 'inventaire'`), pas des objets
à part — les en faire une liste doublerait la vérité. Les budgets sont hors périmètre (Partie 22).
Les questions au client (9.10.0) vivent dans `cabinet-data.json` (dossier), pas dans le livre : elles
concernent la relation, pas la comptabilité.

**Migration depuis « pas de livre »** (MIG-9.2.0-001) : voir Partie 12. **Fichier absent** : le
dossier n'a pas de livre pour cet exercice → écran vide avec le bouton « Reprendre ce dossier… »
(balance d'ouverture) et « Relire les paquets reçus » ; **jamais** un livre créé en silence.
**Fichier corrompu** (JSON illisible ou `isValidLivre` faux) : mis de côté sous
`livre-<AAAA>.illisible-<horodatage>.json`, message `ERR-CAB-021`, l'écran propose la restauration
d'une sauvegarde — comme `cabinet-data.json`.

### SPEC-DATA-006 — `build/licences-publiques.json` et `build/licence-public.json` (Livré)

```json
{ "format": 1,
  "cles": [ { "kid": "master", "publicKey": "-----BEGIN PUBLIC KEY-----…", "depuis": "2026-09-14" },
            { "kid": "srv-1",  "publicKey": "-----BEGIN PUBLIC KEY-----…", "depuis": "2026-09-15" } ],
  "reponse": { "publicKey": "-----BEGIN PUBLIC KEY-----…", "depuis": "2026-09-17" } }
```

`cles[].retiree?: true` retire une clé sans l'effacer. `reponse` porte `{ publicKey, depuis }` — sans
`kid` : l'application ne connaît qu'UNE clé de réponse, et `main.js` ne lit que `reponse.publicKey`
(un test l'exige). Embarquée depuis la **9.4.1** (créée le 17/09/2026 ; la clé du 15/09/2026 était
**brûlée** et a été jetée). Un test exige qu'elle soit une Ed25519 distincte de toutes les `cles[]`.
`licence-public.json` = `{ publicKey, createdAt }` de la seule clé `master`, à l'identique (repli
d'avant 8.4.0). Le glob de `build.files` doit embarquer **les deux** (un test l'évalue contre les deux
noms). **La clé `master` ne se supprime, ne se régénère et ne se remplace jamais.**

### SPEC-DATA-007 — les fichiers de l'éditeur (`~/.skanfact/`, Livré)

`licence-privee.pem` (PKCS#8, 0600), `licence-publique.json` (`{ publicKey (déduite, jamais crue),
createdAt }`), `reponse-privee.pem`, `serveur-privee.pem` (srv-1), `plateforme-admin.json`
(`{ secret, base?, poseLe }`, 0600 — À VÉRIFIER les noms exacts dans `PONT_ADMIN`, `src/main.js`).
**Cible Phase 0** : `console-export-<AAAA-MM-JJ>.json` (l'export de la base, SPEC-API-011).

### SPEC-DATA-008 — la clé de licence `SKAN1.…` (Livré, formats 1 et 2)

`SKAN1.<base64url(JSON)>.<base64url(signature Ed25519 du JSON exact)>` (`src/licence.js`,
`signLicence`). Le JSON est signé **tel qu'écrit** (`JSON.stringify(body)` sans espace) : l'ordre des
champs fait partie de la signature.

| Format | Ordre exact des champs | Qui signe |
|---|---|---|
| 1 (7.33.0 → 8.3.0, app) | `format:1, id, nom, matricule, offre, exp, cabinet, note, emisLe` (vérifié : `payload` de `licence:emettre`, `src/main.js` l. 1675 ; `format` est préfixé par `signLicence`) | `master` (pas de `kid` → vérifiée avec `master` seule) |
| 2 (8.5.0, console) | `format:2, kid, id, sub, nom, matricule, offre, exp, cabinet, note:'', emisLe` (`chargeLicence`, `plateforme/skanfact-api.mjs` l. 463) | `srv-1` |
| **3 (Cible 9.1.0)** | format 2 **+ `options: string[]`** en dernier (`['compta']`) | `master` ou `srv-1` |

`exp` vide = **à vie** (aucune date de fin dans la clé). `offre` vide ou inconnue = Entreprise (« en
cas de doute on ouvre »). L'application ignore les champs inconnus : une clé format 3 lue par la
9.0.0 est acceptée sans l'option. `licenceState()` rend `state` ∈ `libre | editeur | essai | finessai
| active | expiree | revoquee | autre | invalide`, plus `locked`, `daysLeft`, `offre`, `reserves`
(modules fermés à la création), **Cible : `options: string[]`**.

### SPEC-FMT-001 — le manifeste d'un paquet (Livré, `format: 1`)

Écrit **en dernier** par `pack:build` (`src/main.js`) : `{ ...plan.manifest, genereLe, versionApp,
absents, fichiers }`. Structure complète :

```json
{ "format": 1, "app": "SkanFact",
  "entreprise": { "nom": "Exemple SUARL", "matricule": "1234567A", "devise": "DT" },
  "periode": { "mois": "2026-08", "du": "2026-08-01", "au": "2026-08-31", "libelle": "août 2026" },
  "definitif": true, "cloturéJusquAu": "2026-08-31", "genereLe": "2026-09-05T08:12:00.000Z",
  "poste": "MacBook de Skander", "versionApp": "9.0.0",
  "manques": [{ "id": "brouillons", "niveau": "warn", "quoi": "2 factures en brouillon", "combien": 2 }],
  "chiffres": { "ca": 12000, "tvaCollectee": 2280, "tvaDeductible": 310, "tvaADecaisser": 1970,
                "creditTva": 0, "encaisse": 9800, "devise": "DT" },
  "compte": { "ventes": 6, "achats": 4, "encaissements": 5, "pieces": 6, "justificatifs": 3, "bulletins": 1 },
  "absents": [],
  "fichiers": [{ "chemin": "journaux/ecritures.csv", "octets": 4211, "empreinte": "<sha256 hex>" }] }
```

`chiffres`, `compte`, `versionApp`, `absents` sont **(fac.)** à la lecture (paquets anciens : afficher
« — », jamais 0). Le manifeste **ne se liste pas lui-même**. **Cible 9.2.0** (SPEC-FMT-005) : `format:
2`, `licence: { empreinte, offre, exp } | null`, `essai: { depuis, jusqua } | null`, et un fichier
séparé `signature.json` — voir Partie 5.3.

### SPEC-FMT-002 — `.skanpair` (Livré)

`{ "format": 1, "kind": "cabinet", "name", "email", "publicKey": "<base64 SPKI DER X25519>",
"fingerprint": "XXXX-XXXX-XXXX-XXXX-XXXX" }` (`cabcore.pairingFile`). À l'import (`cabinet:import`),
l'empreinte est **recalculée** (`keyFingerprint` = SHA-256 de la clé, cinq groupes de quatre) et le
fichier refusé si elle diffère (`ERR-ENT-030`). Rien de secret dedans. **Cible 9.2.0** : le retour
`.skanpair` du client (`kind: 'client'`, `publicKey` Ed25519, `matricule`) pour l'épinglage.

### SPEC-FMT-003 — `.skanrecover` (Livré, complété en v1 — point 7)

Le seul fichier dont la perte est **irréversible** pour un cabinet : sans lui et sans le poste, aucun
paquet déjà reçu ne s'ouvrira plus jamais. `src/cabinet/cabstore.js` (`makeRecovery`,
`readRecovery`), `src/cabinet/main.js` (`cab:exportRecovery`, `cab:importRecovery`,
`cab:recoveryStatus`).

```json
{ "skanfactCabinetRecovery": 1,          // RECOVER_MARK — ce qui fait reconnaître le fichier
  "format": 1,
  "cabinet": "Cabinet Ben Salah",         // nom en clair : identifier le fichier sans le déchiffrer
  "creeLe": "2026-09-15T09:12:00.000Z",
  "avertissement": "Ce fichier contient la clé qui ouvre les paquets de tes clients. Garde-le hors de ton ordinateur (coffre, clé USB rangée ailleurs). Sans lui et sans ton poste, aucun paquet déjà reçu ne pourra plus être ouvert.",
  "coffre": { "skanfactCabinet": 1, "kdf": "scrypt", "salt": "<b64 16 octets>", "iv": "<b64 12>",
              "tag": "<b64 16>", "data": "<b64 AES-256-GCM>" } }
```

- **Ce qui est dans le coffre** : `{ publicKey, privateKey, name, email }` — la paire X25519 du
  cabinet (PEM), rien d'autre (ni dossiers, ni paquets, ni mot de passe de l'application).
- **Comment il est scellé** : mot de passe **choisi pour l'occasion** (≥ 8 caractères, distinct de
  celui de l'application : le fichier a vocation à quitter le poste) → `scrypt(N = 2¹⁵, r = 8, p = 1,
  maxmem 64 Mo)` sur un sel de 16 octets → clé de 32 octets → AES-256-GCM. **Produire le fichier
  exige de retaper le mot de passe du cabinet** (`current`), sinon n'importe qui devant un poste
  déverrouillé repartirait avec la clé de tous les clients.
- **Écriture** : `JSON.stringify(…, null, 2)`, mode `0600`, nom proposé
  `<slug(nom)>-cle-de-secours.skanrecover` dans Documents ; `app-config.json` reçoit
  `recoveryExportedAt = Date.now()`. Tant que ce champ est vide, l'application le dit **en rouge**
  (bandeau, « À faire », page Dossiers même vide) et, Cible 9.1.0, **le réclame au premier import**.
- **Restauration** (`cab:importRecovery(password)`) : sélecteur de fichier → `JSON.parse` →
  `readRecovery` : marqueur absent ou `coffre` absent → « Ce fichier n'est pas une clé de secours
  SkanFact. » ; mot de passe faux → l'étiquette GCM ne vérifie pas → « Mot de passe de la clé de
  secours incorrect. » (c'est l'**intégrité** : un octet modifié donne la même phrase, jamais une clé
  corrompue chargée en silence) ; clés vides → « Cette clé de secours est vide. ». Puis sauvegarde
  `avant-restauration-cle`, `state.cabinet.{publicKey, privateKey}` remplacés, `save()`, et
  `recoveryExportedAt = creeLe du fichier` (« restaurer une clé compte comme en avoir une », 7.32.0).
  Retour `{ fingerprint, name }` — l'écran affiche l'empreinte pour qu'on la compare à celle qu'on
  avait dictée aux clients : **même empreinte = les paquets s'ouvrent, autre empreinte = ce n'est pas
  le bon fichier**.
- **Deux scénarios distincts, deux portes** : *poste perdu, base perdue* → `cab:pickRecover` +
  `cab:adopt` reprennent un `cabinet-data.json` ou une copie externe entière (la clé y est déjà) ;
  *poste neuf, seulement la clé de secours* → `cab:importRecovery` sur un cabinet fraîchement créé
  (les dossiers reviennent au fil des paquets renvoyés). `e2e:demenagement` prouve le premier,
  `e2e:perte` le second.
- **Conservation recommandée** (écrite dans l'aide) : deux supports hors du poste (clé USB au coffre
  + impression du JSON — 1,5 Ko, il tient sur une page), le mot de passe **ailleurs** que le fichier
  (le « pli scellé » de `QUESTIONS.md` § 12), et un nouvel export à chaque changement de clé.
- **Ce que le format ne fait pas** : pas de rotation (une clé, un fichier ; un nouveau fichier
  remplace l'ancien), pas de partage à seuil (refusé, `QUESTIONS.md`), pas de dérivation depuis le
  mot de passe de l'application (deux secrets distincts, à dessein).

### SPEC-FMT-004 — l'enveloppe scellée (Livré)

Deux en-têtes texte, un corps binaire : `SKANPACK1\n<JSON>\n<corps>` (mot de passe : scrypt +
AES-256-GCM, `sealBuffer`) et `SKANPACKX1\n<JSON>\n<corps>` (cabinet : X25519 éphémère + HKDF-SHA256
+ AES-256-GCM, `sealForCabinet`). L'en-tête JSON porte `alg, kdf, salt, iv, tag` (+ `ephemeral`,
`destinataire` = empreinte du cabinet) **et l'entête en clair** `{ entreprise, matricule, periode,
definitif, format }` — un paquet mal rangé reste identifiable sans clé.

### SPEC-FMT-006 — `.skanask` (Cible 9.10.0) et SPEC-FMT-007 — `.skanclose` (Cible 9.8.0)

Spécifications cibles, à figer au moment de la version. Ce qui est décidé : les deux sont scellés
**pour le client** par `sealForCabinet` avec la clé publique du client (celle de SPEC-DATA-004b), et
signés par le cabinet. `.skanask` = JSON `{ format: 1, dossier, questions: [{ id, mois, docId?,
ligneId?, texte, poseeLe }] }`. `.skanclose` = ZIP scellé contenant `cloture.json` `{ format: 1,
exercice, closLe, anouveaux: [{ compte, debit, credit }], inventaire: [Écriture] }` et
`cloture.pdf` lisible par tous. L'app entreprise verrouille l'exercice à l'import et refuse une
clôture suivante tant que le précédent `.skanclose` n'est pas importé (`QUESTIONS.md` § 16, 9.8.0).

---

## Partie 3 — Moteur partagé (`core.js` + `compta.js`)

### 3.0 L'état réel et la cible

`src/renderer/core.js` exporte **371 noms** (comptés dans l'objet `return { … }` final au commit
`d7bfc54`), constantes comprises. `src/renderer/compta.js` **n'existe pas**. Il est chargé en
9.1.0 selon SPEC-FUNC-100. Le principe qui décide du découpage : **une fonction qui prend `data`
(l'état d'une entreprise) reste dans `core.js` ; une fonction qui prend des `entries` (une liste de
lignes d'écritures) va dans `compta.js`.** C'est la couture qui existe déjà : `entriesBalance(entries)`
et `entriesByAccount(entries)` prennent des lignes, `balanceGenerale(data, …)` prend l'état. Le
Cabinet n'a pas de `data` d'entreprise ; il a des lignes lues dans `journaux/ecritures.csv`.

**Forme d'une ligne d'écriture** (`entrySet` dans `journalEntries`) — c'est le contrat entre les
deux applications :

```js
{ date: 'AAAA-MM-JJ', journal: 'VT'|'AC'|'BQ'|'CA'|'PAIE'|'OD'|'AN', piece: string, tiers: string,
  tiersId: string, source: 'vente'|'achat'|'encaissement'|'règlement'|'ouverture'|'mouvement'|'bulletin'|'declaration'|'od'|'anouveau'|'amortissement',
  docId: string, currency: string, lettre: string, account: string, label: string,
  debit: number, credit: number, role?: 'clients'|'fournisseurs', numero?: number }
```

Invariant : `debit ≥ 0`, `credit ≥ 0`, jamais les deux non nuls ; `entrySet.done()` absorbe l'écart
d'arrondi sur la **dernière** ligne.

### 3.1 Catalogue des fonctions publiques — les fonctions qui touchent aux chiffres

Toutes dans `src/renderer/core.js` sauf mention. « Test » = le nom du test dans
`test/run-tests.js` (`npm test` ; les tests s'y appellent `t('<catégorie> : <phrase>', …)`, pas par
fichier) — quand le nom exact n'a pas été relu, la catégorie est donnée et marquée À VÉRIFIER.

**SPEC-FUNC-001 `round3(n: any): number`** — `Math.round((Number(n)||0)*1000)/1000`. Tout montant
passe par là ; 3 décimales parce que le dinar a des millimes. Piège : `round3('')` = 0.

**SPEC-FUNC-002 `computeTotals(doc: Document, company: Société): Totaux`** — l. 856. Sortie
`{ lines (chaque ligne + ht, vat, ttc, noDiscount), totalHT, discountRate, discount, netHT,
vatByRate: Object<rate, {base, vat}>, totalVAT, stamp, totalTTC, withholdingRate, withholding,
netToPay }`. Ordre des opérations, **à ne pas changer** : (1) `ht = round3(qty*unit)` par ligne ; (2)
`discount = round3(discountable * rate/100)` sur les lignes non `noDiscount` ; (3) TVA par taux sur
`base = round3(ht * factor)` avec `factor = (discountable-discount)/discountable` — la remise est
répartie proportionnellement, la TVA se calcule **après** remise ; (4) `stamp = round3(timbreDu /
rateOf(doc, company))` si `stampApplies` — `timbreDu` = `doc.stampFee` gelé, sinon
`company.stampFee` (brouillon) ; (5) `totalTTC = netHT + totalVAT + stamp` ; (6) `withholding =
round3((netHT + totalVAT) * withholdingRate/100)` — **assiette TTC hors timbre, À VÉRIFIER** ; (7)
`netToPay = totalTTC − withholding`. Erreurs : aucune levée ; `company` **obligatoire** (sinon
`TypeError` sur `company.stampFee`, piège 8.2.0). Dépend de `rateOf`. Tests : « facture en devise »
(1 190,29 € — l'assertion recalculée à la main, 7.0.1), « timbre gelé », « acompte : `netToPay` =
301 ».

**SPEC-FUNC-003 `rateOf(doc, company): number`** — l. 763 — `doc.exchangeRate` (1 devise = x DT) si
`doc.currency !== company.currency`, sinon 1 ; **`toBase(doc, amount, company)`** (l. 780) = montant
× taux vers la devise de la société ; **`missingRate(doc, company): boolean`** = devise étrangère sans
taux (la saisie refuse, « À faire » remonte en rouge). Piège : un taux vide repliait sur 1 avant la
7.0.1 — le test « 1 EUR ≠ 1 DT » le tient.

**SPEC-FUNC-004 `invoiceBalance(doc, data, company): number`** (l. 915) et **`effectiveStatus(doc,
data, company, todayIso?): string`** (l. 926) — reste dû = `netToPay − Σ payments − Σ avoirs
(creditsFor)` ; statut déduit : `annulée` si couvert par avoir(s), `payée` si reste ≤ 0, `partielle`,
`retard` (échue), sinon `envoyée`. **La société est le troisième argument, jamais lue dans `data`.**
Test : « statut déduit ».

**SPEC-FUNC-005 `depositLines(quote, percent, company): Array<Ligne>`** et **`settlementLines(quote,
depositInvoices): Array<Ligne>`** — acompte (lignes au prorata) et solde (lignes du devis + lignes
`noDiscount` négatives de déduction). Test : « acompte/solde ».

**SPEC-FUNC-006 `nextNumber(data, type, dateIso): string`** (l. 836) — `<PREFIX>-<AAAA>-<NNN>` ;
**écrit `data.counters`** ; tout garde-fou (`closedBlock`, `licenceBlock`) se pose **avant** l'appel.
Test : « numérotation continue ».

**SPEC-FUNC-007 `vatSummary(rows): { ht, tva, ttc, byRate }`** (l. 995), **`vatReturn(data,
company, period, carryIn): Déclaration`** (l. 3185) → `{ period, byRate, collected, deductible,
carryIn, toPay, carryOut, stamps, withheldBySale, withheldOnBuys }`, **`vatChain(data, company,
year, upToMonth): Array<Déclaration>`** (l. 3220) — l'enchaînement mensuel des crédits ; **une
déclaration isolée ignore le report et donne un chiffre faux**. `journaux/tva.json` du paquet =
`vatReturn` du mois. Tests : « TVA : … » (3 tests).

**SPEC-FUNC-008 `purchaseTotals(purchase, company)`** (l. 1293) → `{ lines, totalHT, vatByRate,
totalVAT, deductibleVAT, fees, totalTTC, withholdingRate, withholding, netToPay, byDestination }` —
TVA déductible **ligne par ligne** (`deductible`), ventilée par `destination`. Test : « achats : … ».

**SPEC-FUNC-009 `chartAccounts(data): Object<role, compte>`** (l. 3928) = `{ ...DEFAULT_ACCOUNTS,
...data.chartAccounts }`. Rôles livrés : `clients 411, fournisseurs 401, ventes 706, tvaCollectee
4367, tvaDeductible 4366, timbre 4368, rsSubie 4358, rsOperee 4352, achatsStock 607, charges 606,
immobilisations 22, fraisAccessoires 608, banque 532, caisse 54, salairesBruts 640, chargesPatronales
645, personnel 425, cnss 4531, irpp 4321, resultat 13, tvaAPayer 4365, fraisBancaires 627, impots 434,
associes 4421, emprunts 16, attente 471, reportANouveau 12, dotations 681`. **Aucun numéro n'est une
vérité** ; tout est modifiable ; `PLAN_COMPTABLE` ne sert qu'à nommer (`accountLabel`).

**SPEC-FUNC-010 `journalEntries(data, company, period, opts?): Array<Ligne d'écriture>`** (l. 3982)
— `opts.sections` ⊂ `SECTIONS_ECRITURES`, `opts.auxiliaires`. Sources dans l'ordre : ventes (VT ;
facture D 411 / C 706 / C 4367 / C 4368 ; avoir à l'envers ; **une facture couverte par un avoir n'est
PAS sautée** — 8.9.0), achats (AC), encaissements et règlements (BQ/CA selon `journalDeCompte`),
ouverture (AN), mouvements, bulletins (PAIE), déclarations de TVA (au dernier jour du mois, avec les
chiffres de `vatChain`), OD, à-nouveaux, amortissements. Jamais d'écriture pour une facture au
statut **enregistré** `annulée`. Tests : « écritures : … » (4), « 8.9.0 : … » (4), « 9.0.0 : … » (4).

**SPEC-FUNC-011 `entriesBalance(entries): { debit, credit, ok }`** (l. 4293) et
**`entriesByAccount(entries): Object<compte, { debit, credit, lines }>`** (l. 4309) — **prennent des
lignes, pas `data`** : ce sont les deux premières fonctions de `compta.js`.

**SPEC-FUNC-012 `soldesOuverture(data, company, period, opts)`** (l. 4559) — solde de chaque compte
la veille de la période, **lu depuis le début de l'exercice, à-nouveau compris, jamais plus loin**
(9.0.0 : au 1er janvier l'ouverture est 0 et la pièce AN est un mouvement). **`balanceGenerale(data,
company, period, opts)`** (l. 4575) → `{ rows: [{ account, label, ouvertureD, ouvertureC, debit,
credit, soldeD, soldeC }], totaux }` ; garantie : trois paires de totaux égales. **`grandLivre(data,
company, period, opts)`** (l. 4608), **`balanceAuxiliaire(data, company, period, role, opts)`**
(l. 4641). Tests : « 8.8.0 : … » (5).

**SPEC-FUNC-013 `numerosDuJournal(data, company, year, opts)`**, **`livreJournal(data, company,
period, opts)`**, **`journalCentralisateur(data, company, year, opts)`** (l. 4336–4354) — numéro
continu de l'exercice, **déduit donc mobile sur un mois ouvert** (c'est la raison d'être de la
clôture). **Cible `livre.json`** : le numéro devient **stocké** à la validation (SPEC-DATA-005).

**SPEC-FUNC-014 `odValide(od): { ok, motif? }`** (l. 4386, sept motifs testés) et **`odPiece(data,
dateIso): string`** (l. 4406, `OD-AAAA-NNN`) — le refus vit dans la fonction pure, la fenêtre
l'appelle. **Cible** : `compta.ecritureValide(ecriture, plan)` généralise `odValide` à toute écriture
du livre.

**SPEC-FUNC-015 `lettrage(data, company, role, todayIso): { rows, resteOuvert, soldeCompte }`**
(l. 4428) — contrôle : `resteOuvert === soldeCompte` (c'est ce qui a attrapé la facture annulée).

**SPEC-FUNC-016 `etatRapprochement(data, company, accountId, toIso)`** (l. 4467) et
**`etatsFinanciers(data, company, year, toIso, opts)`** (l. 4487) → bilan, état de résultat déduits
de la balance par classe et sens du solde ; garanties testées : actif = passif, résultat des deux
côtés égal, trésorerie du bilan = `cashPosition`. **Pas la liasse NCT 01** (la page l'écrit).

**SPEC-FUNC-017 `assetSchedule(asset)`** (l. 2759), **`assetYear(asset, year)`**, **`assetCumulated`,
`assetNBV`, `disposalResult`, `depreciationFor(data, period)`** (l. 2892) — linéaire, prorata base
360 (`days360`), **la dernière annuité absorbe les arrondis** ; `depreciationFor` fait une différence
de cumuls sauf année civile complète (reprend le tableau au millime) ; `assetYear` rend l'annuité
partielle l'année de la cession, `assetSchedule` l'année pleine — le journal prend la première pour
cette année-là. Tests : « état des immobilisations », « sur un mois on amortit un mois ».

**SPEC-FUNC-018 `computePayslip(employee, input, settings)`** (l. 1953) et **`irppAnnual(base,
brackets)`** (l. 1935) — tranche par tranche sur la part du revenu qui la traverse ; CNSS, accident,
TFP, FOPROLOS, solidarité, frais pro plafonnés, déductions familiales — **tout depuis
`payrollSettings(data)`**, rien en dur ; le bulletin garde `slip.computed`. `employerChargesOf(c)` lit
la copie figée (`c.tfp || 0`). Tests : « bulletin : … » (3), « paie : … » (2).

**SPEC-FUNC-019 `cashMovements(data, company, period, accountId?)`** (l. 2922), **`cashPosition`**,
**`cashForecast`**, **`reconciliation`**, **`journalDeCompte`** — le compte affecté, sinon le compte
par défaut, sinon le mode ; **la banque du grand livre = la banque de la Trésorerie au millime**.

**SPEC-FUNC-020 `mergeData(mine, theirs): { data, report }`** (l. 3111) — fusion par identifiant,
le fichier écrit en dernier tranche, version écartée archivée, compteurs au maximum, doublons de
numéro signalés ; `MERGE_LISTS` liste ce qui fusionne (**`licences` y est**). Tests : « fusion : … » (5).

**SPEC-FUNC-021 `packPlan(data, company, period, opts): { manifest, entries, checklist, definitive,
period, balance, ca, … }`** (l. 3549) — pur : la liste exacte de ce qui partira (SPEC-FMT-001). Tests
: « paquet : … » (3).

**SPEC-FUNC-022 `prorataOffre(lic, prixNouveau, prixAncien, todayIso)`** (l. 5017) — jours restants ×
différence ; `jours`/`total` **`null`** sur une licence à vie. **`amountToWords(amount, currency,
lang)`** (l. 5716) — montant en lettres FR/EN. **`money(n, currency, decimals, lang)`** — 3 décimales
pour le dinar, 2 sinon, point décimal en anglais.

**SPEC-FUNC-023 `defaultVat(company): number`** (l. 540) — le régime tranche **avant**
`defaultVatRate` ; `0` est légitime.

### 3.1 ter — le catalogue complété (v1, 37 fiches)

Même structure que SPEC-FUNC-001. Tout est **Livré** sauf mention ; les numéros de ligne sont ceux
du commit `d7bfc54`. Quand le test qui couvre n'a pas été relu, sa catégorie est donnée.

**SPEC-FUNC-024 `computePayslip(employee, input, settings): Calcul`** — l. 1953. Entrée :
`employee` (fiche, `contract`, `gross`…), `input` (`payslipInputFor` : absences, primes, avances),
`settings` = `payrollSettings(data)` (**jamais `DEFAULT_PAYROLL` directement**, sauf défaut).
Sortie l. 1995 : `{ baseGross, absenceCut, absentDays, workedDays, bonuses, taxableBonus, freeBonus,
gross, cnssBase, cnssEmployee, afterCnss, pro, family, children, annualTaxable, irppYear, irpp, css,
deductions, otherDeductions, net, cnssEmployer, accident, tfp, foprolos, employerCharges,
employerCost, rates: { … copie des taux utilisés } }` — c'est cette copie qui est **gelée** dans
`slip.computed`. Il n'existe **ni `cnssBase()` ni `netAPayer()`** : ce sont les champs `cnssBase`
et `net` de ce retour. Erreurs : aucune ; un taux absent vaut 0. Pièges : le brut imposable est
mensuel, l'IRPP est annualisé (`irppYear / 12`) ; `employerCost` est ce qui entre dans le résultat
(jamais `net` ni `gross`). Tests : « bulletin : … » (3), « paie : … » (2), e2e `livres` (TFP).

**SPEC-FUNC-025 `irppAnnual(base: number, brackets: Array<{ upTo, rate }>): number`** — l. 1935.
Tranche par tranche sur la part qui traverse ; `round3`. Piège : taxer la tranche entière dès
qu'on y entre surestime de 6 % (5.0.0). Test : « bulletin : barème progressif ».

**SPEC-FUNC-026 `employerChargesOf(c: Calcul): number`** — exporté (liste `return { … }`) ; défini
par affectation, pas par `function` (À VÉRIFIER : `grep -n "employerChargesOf =" core.js`). Somme
`cnssEmployer + accident + (c.tfp || 0) + (c.foprolos || 0)` lue sur la **copie figée** ; un
bulletin d'avant la 9.0.0 n'a pas `tfp` et n'en gagne pas. Un test interdit à l'interface de
refaire cette addition à la main.

**SPEC-FUNC-027 `assetSchedule(asset): Array<{ year, annuity, cumulated, nbv }>`** — l. 2759.
Linéaire sur `asset.amount`, `asset.years`, `asset.date`, prorata base 360 (`days360`) ; **la
dernière annuité absorbe les arrondis**, `nbv` finit à 0 exactement. Année de cession : **pleine**
(c'est `assetYear` qui la réduit). Erreurs : `amount` non numérique → 0 partout.

**SPEC-FUNC-028 `assetYear(asset, year): { annuity, cumulated, nbv, out }`** — l. 2788. `out:
true` l'année de la cession, avec l'annuité **partielle** jusqu'au jour de sortie. Le journal
prend celle-ci pour cette année-là et `assetSchedule` pour les autres (test « le 28 du bien cédé
est repris en entier »).

**SPEC-FUNC-029 `assetCumulated(asset, dateIso): number`** (l. 2804) et **`assetNBV(asset,
dateIso): number`** (l. 2817) — cumul plafonné à la valeur, `nbv = amount − cumul`. Piège :
`cappedCumulated` existe pour le cas de la cession.

**SPEC-FUNC-030 `disposalResult(asset): { date, price, nbv, result, reason } | null`** — l. 2823.
`result = price − nbv` au jour de la cession ; **le prix n'est jamais inventé** (règle 9.0.0 : il
vient d'un mouvement 775 ou d'une facture, pas du 471).

**SPEC-FUNC-031 `depreciationFor(data, period): number`** — l. 2892. Différence de cumuls entre
`period.from − 1 j` et `period.to`, **sauf** année civile complète : reprend le chiffre du tableau
au millime. Piège historique : « −1 612 % du CA » (douze mois d'amortissement sur un mois de
ventes). Test : « sur un mois on amortit un mois ».

**SPEC-FUNC-032 `packChecklist(data, company, period): Array<{ id, level, label, count }>`** —
l. 3530 : `closureChecks` + les manques propres au paquet. Chaque `id` a une action dans
`CHECK_ACTIONS` (app.js) — test de couverture. Sur un mois **vide**, la liste est vide et l'écran
ne dit pas « complet » (7.3.0).

**SPEC-FUNC-033 `packCoverHtml(plan, company, opts): string`** — l. 3662, la page de garde (HTML
→ PDF par `pack:build`). `opts.version`, `opts.at`. Piège : `plan.manifest.poste` s'affiche
échappé.

**SPEC-FUNC-034 `packFileName(company, period, definitive): string`** — l. 3515, voir 6.1.

**SPEC-FUNC-035 `mergeData(mine, theirs): { data, report }`** — l. 3111. Les deux côtés passent
par `migrateData` ; fusion par `id` sur `MERGE_LISTS` ; le `syncWrittenAt` le plus récent tranche ;
la version écartée va dans `conflictArchive` ; compteurs au **max** ; `report.doublons` liste les
numéros émis deux fois (cas insoluble, parade organisationnelle). Piège : `deleted` doit être
consulté sinon une pièce supprimée revient. Tests : « fusion : … » (5).

**SPEC-FUNC-036 `trackDeletion(data, kind, id, label): data`** — l. 3170. Ajoute `{ kind, id,
label, at }` à `data.deleted` ; sans `id` ne fait rien. Toute suppression d'une liste fusionnable
passe par là.

**SPEC-FUNC-037 `etatRapprochement(data, company, accountId, toIso): { … }`** — l. 4467, à
partir de `reconciliation` : solde comptable, solde pointé, écarts en suspens, `ecart` = 0 quand le
relevé égale le solde pointé (e2e `livres`). Pièce d'un mouvement : `m.pointe` vit **sur le
paiement d'origine** (3.3.0).

**SPEC-FUNC-038 `etatsFinanciers(data, company, year, toIso, opts): { bilan, resultat,
tresorerie, dotationEnAttente, … }`** — l. 4487. Il n'existe **ni `bilanDepuisBalance` ni
`resultatDepuisBalance`** : c'est cette fonction qui rend les deux, déduits de `balanceGenerale`
par classe et sens du solde. Garanties testées : actif = passif ; résultat identique des deux
côtés ; trésorerie = `cashPosition`. `dotationEnAttente` : sur l'exercice en cours, la dotation
n'est pas encore au bilan et l'écran le dit. **Pas la liasse NCT 01.**

**SPEC-FUNC-039 `vatChain(data, company, year, upToMonth): Array<Déclaration>`** — l. 3220 :
`vatReturn` mois par mois, `carryIn` = `carryOut` du mois précédent, le premier prenant
`data.vatCarryIn[year]`. **Une déclaration isolée est fausse** (le report). Test : « TVA : la
chaîne… ».

**SPEC-FUNC-040 `vatSummary(rows): { ht, tva, ttc, byRate }`** — l. 995, sur des lignes de
`salesJournal` converties en devise de base.

**SPEC-FUNC-041 `purchaseBalance(purchase, company): { totals, paid, remaining }`** (l. 1332),
**`purchaseStatus(purchase, company, todayIso): 'à payer'|'partiel'|'en retard'|'payé'`**
(l. 1362 — **contient une espace** : classe CSS par `buyBadge`, jamais `class="badge ${status}"`),
**`achatDoublon(data, achat): Achat|null`** (l. 1354 : même fournisseur + même numéro + autre id ;
`null` pour une dépense, qui n'a pas de numéro qui fasse foi ; on **prévient sans refuser**).

**SPEC-FUNC-042 `licenceState(opts): État`** (`src/licence.js` l. 306) — `opts.cles |
publicKey`, `key`, `matricule`, `installedAt`, `armedAt`, `today`, `serveur` (verdict). Neuf
états (SPEC-DATA-008). Retour : `{ state, locked, label, detail, key, name, exp, daysLeft, offre,
offreLabel, reserves, … }`. Règles : l'essai part du **plus tardif** de `installedAt`, `armedAt`,
`createdAt` de la clé, contre la **plus ancienne** clé embarquée ; une clé sans `kid` → `master` ;
un matricule vide ne compte pas ; le verdict serveur ne peut que **restreindre**. Tests :
« licence : … » (11), « 8.4.0 : … » (5).

**SPEC-FUNC-043 `pastilleLicence(lic): { show, ton: 'calme'|'attire'|'alerte'|'', texte }`** —
l. 437. Décide seule ; `licenceBanner` (app.js) ne rejuge jamais `daysLeft` (test de source
8.0.1). Rien à dire → `show: false` (`libre`, `editeur`, à vie).

**SPEC-FUNC-044 `licenceSuivi(lic, data, company): { … }`** (l. 5034) et **`licencesAFaire(data,
company, todayIso): { jamaisEnvoyees, nonFacturees, impayees, expirant }`** (l. 5055). La
société est **passée**, avec repli sur `data.company` (piège 8.2.0). `origine: 'console'` n'est
jamais réclamée en envoi ; `envoyeeConsoleLe` compte comme un envoi.

**SPEC-FUNC-045 `moduleOn(data, id): boolean`** (l. 579) et **`moduleWhy(data, id): 'coeur'|
'choisi'|'masque'|'tout'`** (l. 591 ; **Cible** : + `'option'`). `toujours` → toujours vrai ;
`modules` non tableau → tout ; sinon `includes`. **Cible** SPEC-FUNC-101 : l'exception
`compta.livres`.

**SPEC-FUNC-046 `optionBlock(what, option): boolean`** — **Cible 9.1.0**, `app.js`, jumeau de
`licenceBlock` (l. 271) : lit `licence.options` (état mis en cache par `licence:status`), pose
SPEC-UI-ENT-002, rend `true` si refusé. Test de source : posé sur les onglets de l'option, nulle
part ailleurs.

**SPEC-FUNC-047 `issueWarnings(): Array<string>`** — **`app.js` l. 2664**, pas `core.js`. Lit
`company()` et le brouillon : société incomplète (`companyGaps`), RIB absent si un virement est
attendu (`ribAttendu`), date antérieure à la dernière pièce émise, taux de change manquant, stock
insuffisant ; **Cible 9.1.1** : sous le seuil de retenue. **Avertit, ne bloque jamais** (l'utilisateur
choisit « Émettre quand même »).

**SPEC-FUNC-048 `todoList(data, company, todayIso, opts): Array<{ id, level, label, detail,
action, … }>`** — l. 5141 : 22 sortes de lignes, **triées par urgence** (on teste la règle, pas
un ordre en dur) ; chaque `id` a une entrée dans `TODO_ACTIONS` (test de couverture — treize
boutons morts en 7.0.0). Le trou de trésorerie passe en tête.

**SPEC-FUNC-049 `companyGaps(company): Array<{ id, label }>`** — l. 5437 : ce qui manque à la
fiche pour émettre (nom, matricule, adresse ; le RIB seulement si `ribAttendu`). Les deux écrans
qui le disent (`companyGaps`, `issueWarnings`) suivent la même fonction.

**SPEC-FUNC-050 `firstSteps(data, company, opts): { etapes, faits, total, fini, demarrage }`** —
l. 5479 : l'état de chaque étape est **déduit des données** ; ce que l'assistant a posé
(`fromSetup`) ne coche pas « Remplir ton catalogue ».

**SPEC-FUNC-051 `migrateData(d): Data`** — l. 1035 : part d'une copie de `DEFAULT_DATA`, y pose
`d`, convertit (voir MIG-hist), écrit `version = 6`. **Idempotente** (test). Ne supprime jamais un
champ inconnu (un fichier écrit par une version plus récente garde ses données).

**SPEC-FUNC-052 `isValidData(d): boolean`** — `storage.js` l. 50, voir SPEC-DATA-001.

**SPEC-FUNC-053 `lettrage(data, company, role, todayIso): { role, rows, reste, ouverts }`** —
l. 4428 ; `rows[]` par tiers `{ tiersId, tiers, ouverts: [pièces], reste }`. Contrôle : `reste`
= solde du 411/401 (c'est ce qui a attrapé la facture annulée sautée, 8.9.0).

**SPEC-FUNC-054 `journalDeCompte(data, acc, accountId, method): { journal: 'BQ'|'CA', compte
}`** — le compte affecté, sinon le compte par défaut, sinon le **mode** (`especes` → caisse)
seulement s'il n'existe aucun compte. La banque du grand livre = celle de la Trésorerie.

**SPEC-FUNC-055 `codesAuxiliaires(liste): Object<id, code>`** (pur, l. 3906) et
**`numeroterAuxiliaires(data): number`** — le code est **figé sur la fiche** (`compteAux`),
jamais déduit de la position au moment de l'affichage.

**SPEC-FUNC-056 `closureChecks(data, company, from, to)`**, **`closePeriod(data, iso, opts): {
ok, until }`**, **`reopenPeriod(data, iso, opts)`** — les contrôles **ne bloquent jamais** ; une
réouverture exige `opts.motif` (journal `closureLog`).

**SPEC-FUNC-057 `packPeriod(year, month): { month, from, to, label }`** — l. 3470-.

**SPEC-FUNC-058 `odPiece(data, dateIso): 'OD-AAAA-NNN'`** (l. 4406) — pris **à
l'enregistrement**, après `licenceBlock` et `closedBlock` (un refus après trouerait la suite).

**SPEC-FUNC-059 `defaultVat(company): number`** (l. 540) — régime avant réglage ; **`0` est
légitime**, `VAT_RATES.includes(n) ? n : 19`.

**SPEC-FUNC-060 `missingRate(doc, company): boolean`** (l. 763+) — `!(Number(doc.exchangeRate) >
0)` ; `rateOf` replie sur 1 **pour ne rien faire planter**, et `missingRate` existe pour que
l'application le dise (la saisie refuse, « À faire » en rouge).

**Les fonctions cibles de `compta.js` (9.1.0)** — SPEC-FUNC-100 les liste ; chacune a une fiche
courte ici :
- `ecritureValide(ecriture, plan?)` → `{ ok, motif }` ; sept motifs (Σd ≠ Σc, une ligne, compte
  vide, d et c sur une ligne, montant négatif, date absente, journal vide) ; test TEST-9.1.0-001.
- `entreesDepuisCsv(texte)` → `Array<Ligne>` ; par **nom** de colonne, BOM toléré, `1234,567` et
  `1234.567`, guillemets doublés, `;` ou tabulation ; une ligne sans compte est ignorée **et
  comptée** (`ignorees`). Test TEST-9.1.0-002.
- `balanceDepuisLignes(entries, ouverture?)` → `{ rows, totaux, ok }` ; `ouverture` =
  `Object<compte, { debit, credit }>` ou absent (alors 0, et l'écran le dit). TEST-9.1.0-004.
- `grandLivreDepuisLignes(entries, compte, ouverture?)` → `{ compte, libelle, ouverture, lignes:
  [{ …ligne, solde }], total }`. TEST-9.1.0-005.
- `journalDepuisLignes(entries)` → `{ pieces: [{ numero, date, journal, piece, lignes, debit,
  credit }] }` numérotées `1..n` par (date, piece). TEST-9.1.0-006.
- `centralisateurDepuisLignes(entries)` → `Array<{ mois, journal, debit, credit, pieces }>`.
- `lettrageDepuisLignes(entries, compteOuRole, todayIso)` → même forme que SPEC-FUNC-053.
  TEST-9.1.0-007.
- **`livreVide`, `isValidLivre`, `ajouterEcriture`, `validerEcriture`, `contrepasser`,
  `importerPaquet`, `lettrer`, `delettrer`, `balanceOuverture`** (9.2.0) : SPEC-FUNC-103. Il
  n'existe pas de `migrateLivre` : la « migration » est `livreVide` + `importerPaquet` rejoué
  (MIG-9.2.0-001).

### 3.1 bis — les autres exports, par famille (une ligne chacune, tous Livrés)

- Constantes : `VAT_RATES [0,7,13,19]`, `WITHHOLDING_RATES` (onze, **liste ouverte**),
  `PAYMENT_METHODS`, `PREFIX`, `TITLES`, `STATUSES`, `DISPLAY_STATUSES`, `REGIMES`, `ACTIVITIES`,
  `CURRENCIES`, `ENTRY_JOURNALS`, `DEFAULT_ACCOUNTS`, `PLAN_COMPTABLE`, `MODULES`, `PAGES`,
  `DEFAULT_PAYROLL`, `DEFAULT_ASSET_CLASSES`, `DEFAULT_FISCAL_DEADLINES`, `DEFAULT_EMAIL_TEMPLATES(_EN)`,
  `I18N`, `LICENCE_MOTIFS`, `LICENCE_PREAVIS`, `MERGE_LISTS`, `SECTIONS_ECRITURES`.
- Dates : `today` (jour **local**), `addDays`, `addMonths` (mois du calendrier), `daysBetween`,
  `daysInMonth`, `parseDateInput`, `fmtDate(Input)`, `monthMatrix`, `monthKeys`, `periodBounds`,
  `inPeriod`, `debutExercice` — **tout en UTC pur** (test « dates : le même résultat à Tunis… »).
- Documents : `newLine`, `isLocked`, `isIssued`, `creditsFor`, `convertDoc`, `derivedDocs`,
  `piecesLiees`, `facturesDuDevis`, `documentHistory`, `documentHtml`, `fitToPage`, `paginate`,
  `pageCount` (les deux dernières **autonomes** : sérialisées par `main.js`).
- Listes/CSV : `toCsv` (`;`, CRLF, **BOM UTF-8**, montants `1234,567`, `"` doublés),
  `*CsvColumns()` (`{ key, label, type }` — une liste de paires donne un CSV **sans entête**),
  `pageInfo`, `compareValues`, `liste`.
- Ventes/achats/tiers : `salesJournal`, `paymentsJournal`, `purchaseJournal`, `purchaseBalance`,
  `purchaseStatus`, `achatDoublon`, `payablesList`, `purchaseSummary`, `supplierSummary`,
  `supplierPayments`, `withholdingsToIssue`, `clientSummary`, `topClients`, `clientPourVente`.
- Pilotage : `todoList` (trié par urgence — on teste la règle), `companyGaps`, `firstSteps`,
  `simpleResult`, `breakEven`, `documentMargin`, `marginBy`, `projectMargin`, `projectList`,
  `revenueByMonth`, `salesTotals`, `agedReceivables`, `payerRanking`, `quoteFunnel`,
  `objectiveProgress`, `statsCsvRows` (app.js).
- Clôture/paquet : `closedUntil`, `isClosedDate`, `closableMonths`, `closureChecks`, `closePeriod`,
  `reopenPeriod`, `closureLog`, `packPeriod`, `packChecklist`, `packFileName`, `packCoverHtml`.
- Stock/immos/séries/paie/RH : voir `CLAUDE.md` 3.5.0 → 5.2.0 pour les règles ; noms dans l'export.
- Licence/modules : `licenceState` (licence.js), `pastilleLicence`, `licenceSuivi`, `licencesAFaire`,
  `licenceRows`, `licencesExpirant`, `empreinteCabinet`, `licencesDuCabinet`, `chargeHistorique`
  (18 champs, **liste fixée par un test**), `facturesAAnnoncer`, `moduleOn`, `moduleWhy`, `navPages`,
  `modulesSuggeres`, `modulesRevenus`, `wipeData` (déduit de `DEFAULT_DATA`), `rendreLesEmprunts`,
  `estDemo`, `canalDe`, `estBeta`.
- Fusion : `mergeData`, `trackDeletion`. Migration : `migrateData`. Divers : `uid`, `escapeHtml`,
  `nl2br`, `fillTemplate`, `emailFor`, `ocrNumber`, `ocrToPurchase` (en pause).

### 3.2 Conventions internes du moteur

- **Nommage** : les fonctions écrites depuis la 7.x sont en français (`livreJournal`, `odValide`,
  `soldesOuverture`), les anciennes en anglais (`computeTotals`) — **on ne renomme pas l'existant**
  (371 appelants). Le code neuf : verbe ou nom français en camelCase. Les **champs de données**
  gardent leur nom anglais (`debit`, `credit`, `account`, `label`) parce qu'ils sont dans les
  fichiers des utilisateurs et dans les CSV du cabinet.
- **Pureté** : rien dans `core.js`/`compta.js` ne touche au DOM, à `require('fs')` ni à
  `window.skanfact` ; tout est testable dans Node (`module.exports`) et dans le navigateur
  (`root.SkanCore`) par le même IIFE.
- **Aucun taux en dur dans un calcul** ; une constante est une **proposition** (`WITHHOLDING_RATES`)
  ou un défaut réglable (`DEFAULT_PAYROLL`).
- **Structure de `core.js`** : constantes → régime/métier → dates/argent (`round3`, `money`,
  `toBase`) → documents et totaux → CSV → migration → récurrences → achats → marges → paie → immos →
  trésorerie → fusion → TVA → paquet → écritures (8.8.0 → 9.0.0) → statistiques → licence → `return
  { … }`. `compta.js` suit le même ordre : constantes → validation d'une écriture → lignes → balance
  → grand livre → journal/centralisateur → lettrage → export.
- **Interdit** : `var`, `==`/`!=` (sauf `== null`), `eval`, `new Function`, `innerHTML` avec une
  chaîne non passée par `h()`/`escapeHtml`, `new Date(y, m, d)`, `getDay()`, `toISOString().slice(0,
  10)` pour un jour local, un backtick dans un commentaire d'un template literal, un appel de
  `core.js` depuis `fitToPage`/`paginate`, `C.<nom>` inexistant (un test compare à l'export).
- **Chargement sans bundler** : `src/renderer/index.html` charge dans l'ordre `core.js`, `demo.js`,
  `guide.js`, `onboarding.js`, `rowmenu.js`, `reglages.js`, `app.js` ; le Cabinet charge
  `../../renderer/rowmenu.js`, `../../renderer/reglages.js`, `../cabcore.js`, `cabguide.js`, `app.js`.
  Un fichier partagé neuf : (1) IIFE UMD comme `core.js`, (2) balise `<script>` dans les **deux**
  `index.html` **avant** ce qui l'utilise, (3) entrée dans `files` de `build/cabinet.config.js`
  (sinon l'app cabinet démarre en développement et plante une fois construite — 7.26.0), (4) un test
  relit les balises et l'exige.

### 3.3 Spécifications détaillées par version

**SPEC-FUNC-100 — `compta.js` (9.1.0, Cible).** Fichier `src/renderer/compta.js`, UMD
(`root.SkanCompta` / `module.exports`), **sans dépendance à `core.js`** (il reçoit `round3` ? non :
il le redéfinit à l'identique, une ligne, pour rester autonome — un test vérifie l'égalité des deux
corps). Exports :

```js
ecritureValide(ecriture, plan?)      // { ok, motif } — Σd = Σc, ≥ 2 lignes, compte non vide, d/c ≥ 0, jamais d et c
entreesDepuisCsv(texte)              // Array<Ligne> depuis journaux/ecritures.csv — colonnes par NOM (entryCsvColumns), montants « 1234,567 », BOM toléré
entriesBalance(entries)              // déplacé de core.js, corps identique
entriesByAccount(entries)            // idem
balanceDepuisLignes(entries, ouverture?)  // rows { account, label?, ouvertureD, ouvertureC, debit, credit, soldeD, soldeC } + totaux ; garantie : trois paires égales
grandLivreDepuisLignes(entries, compte, ouverture?)  // lignes triées date puis numero, solde progressif, total = solde de la balance
journalDepuisLignes(entries)         // pièces groupées (date, journal, piece) et numérotées 1..n par ordre (date, piece)
centralisateurDepuisLignes(entries)  // par mois × journal : { debit, credit, pieces }
lettrageDepuisLignes(entries, compteOuRole, todayIso)  // { rows, resteOuvert, soldeCompte }
```

`core.js` **réexporte** `entriesBalance`/`entriesByAccount` depuis `SkanCompta` (dans Node :
`require('./compta')` ; dans le navigateur : `root.SkanCompta`, donc `compta.js` se charge **avant**
`core.js`) — aucun appelant ne change. Test de parité (TEST-9.1.0-010) : `balanceGenerale(data…)`
(core) et `balanceDepuisLignes(journalEntries(data…))` (compta) rendent les **mêmes lignes au millime**
sur les 24 mois du jeu d'exemple.

**SPEC-FUNC-101 — l'option `compta` (9.1.0, Cible).** `licence.js` : `licenceState` rend
`options: Array<string>` = `payload.options` filtré aux chaînes, `[]` sinon ; en `essai`, `options
= ['compta']` (l'essai inclut tout) ; en `editeur`/`libre`, `['compta']`.
**Ce que le code impose** (lu au commit `d7bfc54`) : un module `compta` **existe déjà** dans
`MODULES` (`{ id: 'compta', label: 'Comptabilité', toujours: true, pages: ['compta'] }`) — c'est la
page `#/compta` à dix onglets, `COMPTA_TABS = ventes, achats, tva, ecritures, grandlivre, balance,
etats, calendrier, clotures, cabinet`. Les écrans de 8.8.0 → 9.0.0 sont **trois onglets de cette
page** (`grandlivre`, `balance`, `etats`) plus les sous-vues livre-journal / OD / lettrage de
l'onglet `ecritures` (À VÉRIFIER l'identifiant exact de ces sous-vues dans `routes.compta`,
`app.js` l. 8484 et suivantes). On ne crée donc **pas** un second module `compta` : l'option porte
sur des onglets. `core.js` : l'entrée `compta` de `MODULES` gagne `sousModules: [{ id:
'compta.livres', label: 'Grand livre, balance, états financiers', option: 'compta', onglets:
['grandlivre', 'balance', 'etats'], sousVues: ['journal', 'od', 'lettrage'] }]` ; `moduleOn(data,
'compta.livres')` (signature réelle : `(data, id)`) rend `false` tant que `company.modules` ne
contient pas la chaîne `'compta.livres'` — **même quand `company.modules` est `null`** (c'est
l'exception à « null = tout », et `moduleWhy` la dit : `'option'`) ; `COMPTA_TABS` est filtré par
`moduleOn` au dessin. `app.js` : `optionBlock(what, option): boolean` — jumeau de `licenceBlock` :
si `licence.options` ne contient pas `option`, fenêtre SPEC-UI-ENT-002 et **retourne `true`** ;
posé **une fois**, dans le changement d'onglet de `routes.compta` pour les onglets et sous-vues
listés ci-dessus, jamais sur une action — `ecritures` (liste, CSV, envoi), `tva`, `clotures`,
`cabinet`, `ventes`, `achats`, `calendrier` et le rapprochement de la Trésorerie restent libres. Un
test relit `app.js` et exige `optionBlock` sur chaque onglet de `sousModules[0].onglets` et nulle
part ailleurs.

**SPEC-FUNC-102 — 9.1.1 (Cible).** `computeTotals` : `stampApplies` devient `stampApplies &&
!doc.stampExempt` où `doc.stampExempt` est **copié depuis le client à la création du document**
(`applyClientDefaults`) — jamais relu du client à l'affichage (une pièce émise ne bouge pas).
`core.seuilRetenue(company): number` = `Number(company.withholdingThreshold) || 0` ; `issueWarnings`
(app.js) ajoute « Cette facture porte une retenue alors que son montant est sous le seuil » si
`seuil > 0 && totalTTC < seuil && withholdingRate > 0` — **avertit, ne bloque pas**.
`core.tfpSuggere(activity): number|null` lit une nouvelle colonne **(fac.)** `tfp` d'`ACTIVITIES`
(À VÉRIFIER avec le comptable quels métiers, aucun chiffre écrit sans lui) ; `payrollSettings` la
propose si `data.payrollSettings.tfpRate` est absent **et** `tfpTouche` non posé (motif `regimeTouche`).

**SPEC-FUNC-103 — 9.2.0 (Cible).** `compta.js` gagne le **livre** : `livreVide(dossierId, annee)`,
`isValidLivre(obj)`, `ajouterEcriture(livre, ecriture)` (brouillard, `numero: null`, `audit`),
`validerEcriture(livre, id, qui)` (contrôle `ecritureValide`, `numero = max + 1`, `statut: 'validee'`,
`valideeLe`), `contrepasser(livre, id, qui, dateIso)` (écriture miroir, `contrepasseDe`),
`importerPaquet(livre, mois, lignes, definitif)` (remplace les brouillards du mois, **ne touche pas
une validée** : rend `{ ajoutees, remplacees, ecarts: [{ id, avant, apres }] }`), `lettrer(livre,
compte, ids, lettre?, qui)` / `delettrer`, `balanceOuverture(livre, lignes, dateIso, source)`
(écriture AN unique), et les quatre lectures (`balance`, `grandLivre`, `journal`, `lettrage`) qui
appellent les fonctions « DepuisLignes » sur `livre.ecritures` aplaties.

---

## Partie 4 — Application Entreprise

### 4.1 Modules et offres (Livré + Cible 9.1.0)

| Module (`MODULES[].id`) | Offre minimale | Masquable (`company.modules`) | Porte | Licence expirée |
|---|---|---|---|---|
| `ventes` (devis, factures, avoirs, relances, contrats) | Indépendant | non (toujours là) | `licenceBlock` sur chaque **création** ; `closedBlock` sur toute écriture datée ; `demoBlock` sur tout envoi | création bloquée ; lecture, PDF, export, paiement, modification d'une pièce existante libres |
| `fichiers` (clients, catalogue) | Indépendant | non | `licenceBlock` sur la création d'un **article** avec stock de départ ; créer un client n'est **pas** fermé | idem |
| `pieces` (proforma, commande, livraison, contrat) | Indépendant | oui | `licenceBlock` | idem |
| `achats` (fournisseurs, achats, dépenses) | Entreprise | oui | `licenceBlock('…', 'achats')` — cadenas dans la barre pour Indépendant | idem |
| `stock`, `immos`, `paie`, `tresorerie`, `marges` | Entreprise | oui | `licenceBlock` avec le module | idem ; Statistiques (`stats`, module Pilotage) **jamais fermée** |
| `pilotage` (trésorerie, marges, statistiques) | Entreprise ; Statistiques **jamais fermée** | oui | `licenceBlock` sauf `stats` | idem |
| `compta` (page `#/compta`, `toujours: true`) | Indépendant | **non** | aucune : Écritures, TVA, Clôtures, Cabinet, calendrier, journaux de ventes/achats | tout libre |
| `compta.livres` (**Cible 9.1.0**, sous-module : onglets `grandlivre`, `balance`, `etats` + sous-vues livre-journal / OD / lettrage) | Entreprise + option `compta` | **masqué par défaut**, à cocher dans Paramètres → Modules | `optionBlock` au changement d'onglet | onglets fermés tant que l'option manque ; le reste de la page libre |

Les neuf ids de `MODULES` (lus l. 314–357 de `core.js`) : `ventes` (toujours), `fichiers`
(toujours), `pieces`, `achats`, `stock`, `immos`, `paie`, `pilotage`, `compta` (toujours).

### 4.2 Écrans (9.1.0, 9.1.1 — Cible)

**SPEC-UI-ENT-001 — Paramètres → Modules, case « Comptabilité »**

| Champ | Contenu |
|---|---|
| Route | `#/parametres`, panneau `p-modules` (`SETTINGS_PANNEAUX`) |
| Champs | une case par module ; sous « Comptabilité » (toujours cochée, grisée), une sous-case « Grand livre, balance, états financiers » **décochée par défaut**, avec la mention « Option payante — incluse dans l'essai » et un cadenas si l'option manque à la licence |
| Actions | cocher → `company.modules` gagne `'compta.livres'` (et si `modules` était `null`, il devient la liste de tous les modules visibles **plus** cette chaîne — on ne masque rien d'existant) ; décocher → retirée ; **droit à l'erreur** : recocher immédiat, jamais de cadenas sous le doigt (7.12.0) |
| États | option présente : case active ; option absente : case active **mais** les pages posent `optionBlock` ; essai : active |
| Textes exacts | « Grand livre, balance, livre-journal, états financiers. Option payante, incluse dans l'essai. Tes écritures, ta TVA, tes clôtures et le paquet de ton comptable restent disponibles sans elle. » |
| Performance | instantané |

**SPEC-UI-ENT-002 — fenêtre `optionBlock`** : titre « Option Comptabilité » ; texte « Cette page fait
partie de l'option Comptabilité, qui n'est pas dans ta licence. Tes écritures, ta TVA, tes clôtures
et le paquet de ton comptable restent disponibles. » ; boutons « Voir ma licence » (→ `#/parametres`,
panneau `p-licence`) et « Fermer » ; Échap = Fermer ; z-index 400 (`modal()`).

**SPEC-UI-ENT-003 — Paramètres → Licence (9.1.0)** : la ligne « Options : Comptabilité » (ou « — »),
sous l'offre ; le panneau Éditeur propose la case « Option Comptabilité » à l'émission (prix : champ,
défaut `PRIX_OPTION_COMPTA` du catalogue ou saisie — **jamais dans le code**).

**SPEC-UI-ENT-004 — fiche client, case « Exonéré de timbre fiscal » (9.1.1)** : dans `clientForm`,
après le taux de retenue ; bulle `guide.js` clé `client.stampExempt` : « Coche si ce client est
exonéré du timbre fiscal (exportateur total, secteur public…). Le timbre sera décoché d'office sur
ses factures ; tu peux toujours le remettre pièce par pièce. À VÉRIFIER avec ton comptable. »

**SPEC-UI-ENT-005 — Paramètres → Documents, « Seuil de retenue à la source » (9.1.1)** : champ
nombre, défaut **0** (« aucun seuil »), bulle : « En dessous de ce montant TTC, l'application te
prévient si une facture porte quand même une retenue. 0 = pas de seuil. À VÉRIFIER avec ton
comptable. » ; l'avertissement d'émission : « Cette facture (1 190,000 DT) est sous le seuil de
retenue (1 000,000 DT) et porte une retenue de 1 %. Vérifie avec ton comptable. — Émettre quand même
/ Corriger ».

**SPEC-UI-ENT-006 — Paie → Barèmes, TFP proposée (9.1.1)** : à côté du champ TFP, « Proposé pour ton
métier : 1 % » **seulement** si `tfpSuggere` rend une valeur ; le champ n'est jamais écrasé une fois
touché.

### 4.3 Formules fiscales (Livré, toutes dans `computeTotals` / `purchaseTotals` / `computePayslip`)

| Calcul | Formule exacte | Défaut (réglable) | Exonération | Erreurs à ne pas commettre | Tests |
|---|---|---|---|---|---|
| **TVA (vente)** | par taux : `base = round3(ht_ligne × facteurRemise)`, `vat = round3(Σbase × taux/100)` ; `totalVAT = Σ vat` | `defaultVat(company)` : régime avant réglage ; taux de ligne libre | régime `forfaitaire`/`exonere` : aucune ligne de TVA, **mention légale à la place** ; une pièce qui **porte** de la TVA la garde après changement de régime (`showVat = assujettiTVA \|\| totalVAT > 0`) | arrondir **par taux** après remise, pas par ligne avant remise ; `0` est un taux légitime (`||` interdit) | « TVA : … », « métier : … » |
| **Timbre** | `stamp = round3(timbreDu / rateOf)` si `stampApplies` ; `timbreDu` = `doc.stampFee` gelé sinon `company.stampFee` | `company.stampFee = 1.0` DT | par document (`applyStamp`) ; **Cible 9.1.1** : par client (`stampExempt`) ; avoir et proforma : seulement si demandé | c'est un montant **en dinars** : convertir ; **geler à l'émission** ; jamais sur devis/bon | « timbre gelé », « facture en devise » |
| **Retenue à la source (vente)** | `withholding = round3((netHT + totalVAT) × taux/100)` ; `netToPay = totalTTC − withholding` | `doc.withholdingRate` ← client ← `company.defaultWithholdingRate` (0) ; liste `WITHHOLDING_RATES` **ouverte** | taux 0 ; **Cible 9.1.1** : avertissement sous `withholdingThreshold` (défaut 0 = aucun) | assiette = **TTC hors timbre, À VÉRIFIER** ; le taux dépend de la **nature** de l'opération ; un select sans option correspondante retient la première (8.3.0) ; `__autre__` ne doit jamais atteindre les données | « retenue à la source : … » (3), e2e `retenue` |
| **Retenue (achat)** | `round3((totalHT + totalVAT) × taux/100)` ; l'attestation se remet au fournisseur (`withholdingsToIssue`) | `supplier.withholdingRate` | — | même assiette À VÉRIFIER | « achats : … » |
| **TVA déductible** | ligne par ligne si `deductible`, ventilée par `destination` | `deductible: true` | ligne `deductible: false` | un achat en `stock`/`immobilisation` n'est **pas** une charge de la période | « achats : … » |
| **CNSS, accident, TFP, FOPROLOS** | sur `cnssBase` (brut plafonné selon barème) : `× cnssEmployee`, `× cnssEmployer`, `× accidentRate`, `× tfpRate`, `× foprolosRate`, chacun `round3` | `DEFAULT_PAYROLL` : 9,18 / 16,57 / 0,4 / 2 / 1 — **régime général, À VÉRIFIER chaque année** | par barème ; TFP 1 % industrie manufacturière **À VÉRIFIER** (9.1.1 propose, n'impose pas) | lire la **copie figée** `slip.computed` ; ne jamais additionner `cnssEmployer + accident` à la main (un test l'interdit) | « bulletin : … », « 9.0.0 : TFP » |
| **IRPP** | `irppAnnual(base, brackets)` tranche par tranche sur la part qui traverse | barème de `DEFAULT_PAYROLL` | déductions familiales, frais pro plafonnés | taxer la tranche entière dès qu'on y entre (+6 %, 5.0.0) | « bulletin : barème progressif » |
| **TCL** | **n'existe pas** dans le code au commit `d7bfc54` | — | — | À VÉRIFIER avec le comptable si elle entre dans la déclaration mensuelle (Phase 5) | — |

### 4.4 Spécifications détaillées par version — entreprise

- **9.1.0** : SPEC-FUNC-100, SPEC-FUNC-101, SPEC-UI-ENT-001 → 003 ; le garde-fou d'erreur global
  (SPEC-OUT-003) ; le journal borné (SPEC-OUT-004) ; **aucune migration de données** (MIG-9.1.0-001).
- **9.1.1** : SPEC-FUNC-102, SPEC-UI-ENT-004 → 006 ; le contrôle e-facture est un **document**
  (`docs/e-facture-controle.md` : la liste des champs qu'un format officiel exigerait, chacun avec
  « présent dans `Document`/`Ligne`/`Société` : oui/non ») — pas du code.
- **9.2.0** : le manifeste format 2 (licence, essai), `signature.json` (SPEC-FMT-005), la paire de
  clés du client (SPEC-DATA-009 : `<dossier>/cle-client.json` `{ format: 1, publicKey, privateKey,
  creeLe }` — Ed25519, base64 SPKI/PKCS8 DER, **hors** de `skanfact-data.json`, emportée par
  `mirrorExternal`, jamais par le paquet ; À VALIDER : mode 0600 et exclusion des sauvegardes
  quotidiennes), « Cabinet trop ancien » (`ERR-ENT-031`).

---

### 4.5 Contrat IPC — entreprise (Livré, `src/preload.js` 92 lignes, `src/main.js`)

Le pont est **le** contrat de sécurité : `contextIsolation: true, nodeIntegration: false, sandbox:
true`. Le renderer ne voit que `window.skanfact.<méthode>` ; chaque méthode appelle **un** canal.
Règles : un canal neuf = une méthode dans `preload.js` + `ipcMain.handle` + une entrée ici + un
test si le canal écrit ; jamais `ipcRenderer` exposé brut ; jamais un chemin de fichier choisi par
le renderer sans passer par `dialog` ou par un identifiant (`docId`, `file`) résolu côté main
(`storage.attachmentPath`). Les erreurs traversent le pont comme `Error` habillé (« Error invoking
remote method … ») : `plainError(e)` (app.js) ne montre que la phrase écrite. **Cible 9.1.0** :
`support:erreur` (SPEC-OUT-004).

| Méthode (`window.skanfact.`) | Canal | Arguments | Retour | Erreurs / notes |
|---|---|---|---|---|
| `loadData()` | `data:load` | — | `{ data: Data\|null, locked: boolean, encrypted: boolean, corruptFile: string }` | `locked` → écran de mot de passe ; `corruptFile` = chemin du fichier mis de côté |
| `saveData(data, force)` | `data:save` | `{ data, force }` | `storage.write` → `{ ok: true }` \| `{ ok: false, conflict: true, disk }` | le conflit **ne s'écrit pas** ; `save()` fusionne puis réécrit `force` |
| `dataPath()` | `data:path` | — | `string` | |
| `unlock(password)` / `lock()` | `data:unlock` / `data:lock` | `string` / — | `{ ok, data? }` \| `{ ok:false, error:'Mot de passe incorrect.' }` / `true` (recharge) | |
| `securityInfo()` | `data:security` | — | `{ encrypted }` | |
| `setPassword({ data, password, current })` | `data:setPassword` | | `{ ok, encrypted }` \| `{ ok:false, error }` | **remonte un refus d'écriture** (7.30.0) ; rechiffre les sauvegardes, y compris externes |
| `listDossiers()` | `dossiers:list` | — | `{ dossiers: [{ id, name, dir, shared }], current, device: { deviceId, deviceName } }` | |
| `switchDossier(id)` / `renameDossier({ id, name })` / `forgetDossier(id)` | `dossiers:*` | | `{ ok }` \| `{ ok:false, error }` | jamais le dernier dossier |
| `addDossier({ name, shared })` / `shareDossier()` / `joinDossier()` | `dossiers:add/share/join` | | `{ ok, cancelled? , error? }` | **share** copie le dossier OUVERT, bascule après copie constatée ; **join** ne crée rien (7.28.0) |
| `renameDevice(name)` | `device:rename` | `string` | `{ ok, name }` | |
| `exportData(data)` / `importData(opts)` | `data:export` / `data:import` | | chemin / `{ data }` \| `{ needPassword: true }` | import : sauvegarde `avant-import` d'abord |
| `externalBackupInfo()` / `setExternalBackup(dir)` / `chooseExternalBackup()` | `backups:*` | | `externalInfo()` = `{ dir, ok, last, … }` (À VÉRIFIER les champs, `main.js` `externalInfo`) | |
| `openBackups()` / `createBackup(label)` / `listBackups()` | `backups:open/create/list` | | chemin / `Array<{ name, date, size }>` | purge par **date**, filets en réserve |
| `peekBackup(name)` / `restoreBackup(name)` | `backups:peek/restore` | `string` | `{ ok, …résumé }` / `{ ok, data }` \| `{ ok:false, error }` | restore refuse un conflit (« Le fichier a changé entre-temps ») |
| `pickLogo(title)` | `logo:pick` | | data URL | |
| `addAttachments(docId)` / `attachPath(docId, path)` / `openAttachment` / `revealAttachment` / `removeAttachment` | `attach:*` | `{ docId, file }` | liste / booléen | le chemin réel est résolu côté main |
| `ocrStatus/ocrSetKey/ocrPick/ocrRead` | `ocr:*` | | | **en pause** (`OCR_EN_PAUSE`) ; `ocr:read` refuse sans clé |
| `exportPdf(html, suggestedName)` / `exportPdfMany(files, folderName)` / `exportPdfSilent(html, name)` | `pdf:*` | | chemin / dossier / fichier | `renderPdf` : `fitToPage` puis `paginate`, toujours les deux |
| `saveText(suggestedName, content)` / `saveTextSilent(name, content)` | `file:saveText/saveSilent` | | chemin | |
| `composeMail({ to, subject, body, attachment, attachments, mode })` | `mail:compose` | | `{ state: 'mail'\|'mailto' }` | AppleScript sur macOS, sinon `mailto:` + PDF montré |
| `buildPack({ plan, coverHtml, password, cabinetKey, suggestedName })` | `pack:build` | | `{ path, octets, fichiers, chiffre, pourCabinet, absents, empreinte }` | `pack:progress` `{ done, total, label }` pendant ; le renderer décide (`packPlan`), main exécute |
| `onPackProgress(cb)` | `pack:progress` (événement) | | | |
| `importCabinet()` | `cabinet:import` | — | `{ name, email, publicKey, fingerprint, pairedAt }` | `ERR-ENT-030` ; l'empreinte est **recalculée** |
| `licenceStatus(matricule)` | `licence:status` | `{ matricule }` | `{ …licenceState, matricule, today, editeur, … }` | relu au chargement du dossier et après la fiche société |
| `licenceSet(key, matricule)` | `licence:set` | `key, { matricule }` | `licenceStatus(matricule)` | refuse une clé invalide ou d'un autre matricule **sans l'écrire** ; « Retirer » retire partout |
| `licenceMail(company, device)` | `licence:requestMail` | | `{ to, subject, body }` | vers `contact@skanfact.tn` |
| `licenceEmettre(payload)` | `licence:emettre` | `{ nom, matricule, offre, exp, cabinet, note }` | `{ key, ...payload }` | **éditeur seulement** ; signe dans main ; la privée ne traverse jamais |
| `editeurStatus(depuis)` | `editeur:status` | | `{ editeur, publique, chemin, armee, correspond, durees, … }` | `correspond` = à la clé EMBARQUÉE (l'état du panneau) |
| `editeurKeygen/Importer/Exporter/CopierPublique` | `editeur:*` | | `editeurStatus()` / `{ canceled }` / `{ ok, path, publique, autreCle }` / `{ ok, texte }` | keygen n'écrit plus dans `build/` |
| `cleReponseCreer/Copier(quoi)` , `cleServeurCreer/Copier(quoi)` | `editeur:cleReponse*`, `editeur:cleServeur*` | | `editeurStatus()` / `{ ok, privee }` | la privée va au **presse-papiers**, pas au renderer (`privee: true` = « c'est la privée qui a été copiée ») |
| `pontStatus()` / `pontSetSecret(secret)` / `pontRequete(chemin, corps)` | `pont:*` | | `{ editeur, base, configure }` / `{ configure, etat }` / le JSON de la console | `PONT_CHEMIN` seul, jamais `..` ; un secret refusé rend sa place à l'ancien |
| `changelog()` | `app:changelog` | — | texte | |
| `onAlivePing(cb)` / `onFreezeNotice(cb)` | `alive:ping` → `alive:pong`, `freeze:notice` | | | posés **avant** la séquence de démarrage |
| `supportInfo()` / `openLog()` | `support:info` / `support:openLog` | — | `{ version, electron, chrome, platform, packaged, logPath, log (40 Ko max), lines, lastFreeze }` | |
| `onMenuAction(cb)` | `menu:action` (événement) | `name` | | |
| `updateVersion()` | `update:version` | — | `{ version, packaged, platform, macSigned, hasToken, relay, beta, canal, lastCheck, … }` | `relay` faux quand le relais a échoué |
| `updateCheck()` / `updateDownload()` / `updateInstall()` | `update:*` | | `{ state, message?, detail?, soft? }` | `updateProblem(err)` : jamais une phrase brute |
| `updateSetToken(t)` / `updateSetBeta(on)` / `updateOpenReleases()` | `update:*` | | `{ hasToken }` / `{ beta }` | `setBeta` : sauvegarde `avant-beta` **avant** d'armer |
| `onUpdateEvent(cb)` | `update:event` | | `{ state, … }` | |
| `setTitle(title)` / `setDirty(dirty)` | `window:title` / `window:dirty` (**send**, pas invoke) | | — | `dirty` doit être remis à `false` par `clearGuard()` (7.28.0) |

## Partie 5 — Application Cabinet

### 5.1 Écrans

**SPEC-UI-CAB-001 — Dossier → bloc « Comptabilité » (9.1.0, Cible)**

| Champ | Contenu |
|---|---|
| Route | `#/dossier/<id>`, section `#c-compta` sous la liste des mois ; masquée si le dossier n'a **aucun** paquet (« hors SkanFact ») |
| Sélecteur de période | `<select>` : « l'exercice <AAAA> » (défaut : l'année du dernier paquet), « un mois » (liste des mois reçus), « du… au… » (deux `dateInput`) — les mois **absents** de la période sont nommés en tête : « Il manque juillet et août 2026 : ces livres sont incomplets. » |
| Onglets | `#c-tabs button[data-tab=journal|grand-livre|balance|lettrage]` (les e2e visent `data-tab`, jamais un rang) |
| **Livre-journal** | colonnes `N° · Date · Journal · Pièce · Compte · Tiers · Libellé · Débit · Crédit` ; filtre journal (`<select>` codes vus), recherche (pièce, tiers, libellé) ; pied : totaux débit/crédit **de la sélection entière** ; centralisateur dépliable (mois × journal) |
| **Grand livre** | `combo` de compte (numéro ou nom, « tous les comptes ») ; colonnes `Date · Pièce · Libellé · Débit · Crédit · Solde` ; le solde progressif **finit sur le total du compte** ; ouverture affichée si `ouverture` connue (sinon « ouverture inconnue : ce livre est lu dans les paquets, sans à-nouveau ») |
| **Balance** | générale (colonnes `balanceCsvColumns`) et auxiliaire (bouton bascule) ; bandeau « Équilibrée » ou « Écart de X DT » en rouge ; six totaux en pied |
| **Lettrage** | par tiers : reste ouvert, pièces ouvertes ; bandeau « reste ouvert = solde du compte » ou l'écart |
| Actions | « Exporter en CSV » **nommé par l'onglet** (« Exporter le grand livre ») → `cab:exportCsv` ; menu de ligne `RowMenu` : « Ouvrir la pièce dans le paquet » (`cab:openInPack`, seulement si `path` connu) |
| États | **vide** (aucun paquet avec `journaux/ecritures.csv`) : « Aucun paquet reçu ne contient d'écritures. Les paquets d'avant la 6.3.0 n'en ont pas : demande à ton client de renvoyer le mois. » + bouton « Écrire au client » ; **paquet ancien** (colonnes `numero`/`tiers` absentes) : « Ce paquet vient d'une version d'avant la 8.8.0 : pas de numéro ni de tiers. » ; **paquet illisible** : la ligne du mois en orange, `ERR-CAB-010`, les autres mois affichés quand même ; **chargé** ; jamais d'état « licence » (le Cabinet n'a pas de licence en 9.1.0) |
| Textes exacts | ci-dessus ; les pluriels par `pl()`/`de()` ; jamais « 1 écriture(s) » |
| Performance | ouverture de l'onglet < 1 s pour 12 paquets × 500 lignes (les CSV sont lus **une fois** par dossier et par session, cache en mémoire invalidé à l'import) |

**SPEC-UI-CAB-002 — la clé de secours au premier import (9.1.0, Cible)**

| Champ | Contenu |
|---|---|
| Déclencheur | tout chemin qui appelle `cab:importPack` (bouton, glisser-déposer, boîte de réception) alors que `recoveryExportedAt` est vide |
| Fenêtre | titre « Avant ton premier paquet » ; texte « Ce paquet sera chiffré avec la clé de ton cabinet. Si cet ordinateur tombe en panne et que tu n'as pas enregistré ta clé de secours, **tout ce que tu auras reçu deviendra illisible pour toujours**. Trois minutes maintenant. » ; boutons « Enregistrer ma clé de secours… » (primaire → `cab:exportRecovery`, puis l'import reprend) et « Pas maintenant » |
| Règle | « Pas maintenant » écrit `settings.cleSecoursReporteeLe = Date.now()` et **ne se propose qu'une fois** : au second import sans clé, la fenêtre n'a plus que le bouton primaire et « Annuler l'import » |
| Test | e2e `cabinet` : premier import → fenêtre ; « Pas maintenant » → import fait ; second import → pas de « Pas maintenant » ; export → plus jamais de fenêtre |

**SPEC-UI-CAB-003 — Dossier → « Reprendre ce dossier… » (9.2.0)** : fenêtre en trois étapes —
exercice (année, du/au), plan de comptes (« SCE de référence » coché, ou « Importer un CSV… »),
balance d'ouverture (« Saisir » : tableau compte/débit/crédit avec l'écart en direct, refus si ≠ 0 ;
ou « Importer un CSV… ») ; date de reprise = `du` de l'exercice ; résultat : `livre-<AAAA>.json`
créé, écriture AN `OUVERTURE`, `audit` « reprise ».

**SPEC-UI-CAB-004 — l'import qui crée des écritures (9.2.0)** : le compte rendu d'import gagne « 37
écritures ajoutées au livre (brouillard) » / « … (validées : mois définitif) » / « 3 écritures
validées diffèrent du mois renvoyé — Voir les écarts » ; les écarts s'affichent côte à côte (avant /
après) et **ne s'appliquent jamais seuls**.

**SPEC-UI-CAB-005 — les quatre onglets lisent le livre (9.2.0)** : même écran que SPEC-UI-CAB-001,
source `livre.json` ; une écriture `brouillard` en italique avec la pastille « brouillard » ; menu de
ligne : « Valider », « Modifier (brouillard) », « Contre-passer », « Voir l'écart avec le paquet »
(si `source: 'skanfact'` et remplacée) ; jamais « Supprimer » sur une validée.

**SPEC-UI-CAB-006 — signature, ce que l'écran dit (9.2.0)** : sur la ligne du paquet, un repère
« ✓ signé par le client » / « origine non prouvée » (gris, avec l'infobulle « paquet d'une version
antérieure à la 9.2.0 ») / refus `ERR-CAB-030` en rouge avec le dossier nommé.

### 5.2 Formats de fichiers propres au Cabinet

- `livre.json` : SPEC-DATA-005 ; **verrouillage** (9.2.0) : un fichier `livre-<AAAA>.lock` `{ deviceId,
  deviceName, depuis }` posé à l'ouverture en écriture, ignoré s'il a plus de 24 h, avec le message
  `ERR-CAB-022`, repris par « forcer » depuis la 9.9.0 ; **révision** (9.9.0) : `revision` dans
  l'entête EN CLAIR, relue avant chaque écriture — c'est elle qui empêche un poste d'écraser
  l'autre, le verrou ne couvrant que deux écritures simultanées ; **fusion** (9.9.0) :
  `compta.fusionnerLivres`, une validée ne se fusionne jamais et n'est jamais perdue ;
  **épinglage** :
  SPEC-DATA-004b.
- **Import du plan de comptes** (SPEC-FMT-008, CSV, colonnes **par nom**, `;` ou tabulation, BOM
  toléré, guillemets doublés) : `Compte` (obligatoire), `Libellé` (obligatoire), `Nature`
  (`bilan|gestion|tiers|tresorerie`, fac. : déduite de la classe — 1 à 5 bilan, 6 et 7 gestion, 411/401
  tiers, 53/54 trésorerie), `Parent` (fac.). Une ligne sans `Compte` numérique est **ignorée et
  nommée** dans le compte rendu.
- **Import de balance d'ouverture** (SPEC-FMT-009) : `Compte`, `Débit`, `Crédit` (obligatoires),
  `Libellé` (fac. : crée le compte s'il manque), montants `1234,567` ou `1234.567` ; **refusée si Σ
  débit ≠ Σ crédit** (`ERR-CAB-023`, avec l'écart) ; un compte inconnu entre au plan avec `source:
  'import'`.

### 5.3 Signature et épinglage (SPEC-FMT-005, Cible 9.2.0)

- **Ce qui est signé** : les **octets exacts** de `manifeste.json` tels qu'écrits dans le ZIP
  (`JSON.stringify(manifest, null, 2)`, UTF-8). Aucune canonicalisation : on ne re-sérialise jamais,
  on signe le fichier. Donc **pas de RFC 8785**, et le manifeste ne porte pas sa propre signature.
- **Où** : un fichier `signature.json` à la racine du ZIP, écrit **après** le manifeste :
  `{ "format": 1, "alg": "ed25519", "cle": "<base64 SPKI DER>", "empreinte": "<keyFingerprint(cle)>",
  "manifeste": "<sha256 hex de manifeste.json>", "sig": "<base64url de crypto.sign(null, octets,
  privateKey)>" }`. Le `manifeste` sha256 permet de dire « le manifeste a changé » avant même de
  vérifier la signature.
- **Vérification (Cabinet, `ingest`)** : lire `manifeste.json` en octets, lire `signature.json` ;
  (1) absent → `signature: 'absente'`, accepté avec « origine non prouvée » **sauf si le dossier a
  `clePublique`** → refus `ERR-CAB-031` ; (2) présent : **d'abord** `sha256(octets) ===
  signature.manifeste`, faux → refus `ERR-CAB-032` avec la variante « le manifeste a été modifié » ;
  **puis** `crypto.verify(null, octets, cle, sig)` faux → refus `ERR-CAB-032` (v1, point 6) ;
  (3) vrai et dossier sans `clePublique` → **épingler** (`clePublique = cle`, `cleEpingleeLe`,
  `cleEmpreinte`, `audit`) ; (4) vrai et `cleEmpreinte` différente → refus `ERR-CAB-030` en nommant
  le dossier et les deux empreintes. **L'ordre 2 est fixé, et son motif n'est pas celui que la
  relecture avançait** : une signature Ed25519 porte sur les octets, donc un manifeste modifié fait
  échouer `verify` de toute façon — l'attaque « je garde la signature et je change le manifeste »
  est impossible, avec ou sans l'empreinte. L'empreinte sert à autre chose : (a) donner au comptable
  la **bonne phrase** (« modifié après l'envoi » plutôt que « signature inconnue »), (b) vérifier un
  vieux paquet **sans** la clé (un `sha256sum manifeste.json` suffit), (c) comparer deux
  `signature.json` d'un même mois reçu deux fois sans rien déchiffrer. TEST-9.2.0-023 vérifie
  l'ordre en retournant un octet du manifeste : la phrase attendue est celle de (a).
- **Où est la clé publique du client** : `cabinet-data.json` → `dossiers[].clePublique`
  (SPEC-DATA-004b). Elle est **aussi** dans chaque `signature.json`, ce qui permet de vérifier un
  vieux paquet hors de l'application.
- **Le client change de clé** (réinstallation sans son dossier) : ses paquets sont refusés
  `ERR-CAB-030` ; le cabinet a un bouton « Ce client a changé de clé — accepter la nouvelle » qui
  demande l'empreinte **dictée au téléphone** (même geste que l'appairage) et écrit `audit`
  « changement de clé ». Jamais automatique.
- **Un paquet non signé après un paquet signé** : refusé (`ERR-CAB-031`, règle 43 de `QUESTIONS.md`
  § 19), avec « demande à ton client de mettre à jour SkanFact ».

### 5.4 Spécifications détaillées par version — Cabinet

- **9.1.0** : SPEC-UI-CAB-001, SPEC-UI-CAB-002, `cab:livres` (IPC : `{ dossierId, periode }` →
  `{ lignes, moisPresents, moisAbsents, paquetsIllisibles: [{ mois, raison }], anciens: [mois] }`,
  lecture par `zipRead` + `openWithCabinetKey`, CSV → `SkanCompta.entreesDepuisCsv`), le test de
  charge (SPEC-OUT-006), les e2e `cabinet-livres` et `boucle` étendus.
- **9.1.1** : rien côté Cabinet.
- **9.2.0** : SPEC-DATA-005, SPEC-DATA-004b, SPEC-FMT-005/008/009, SPEC-UI-CAB-003 → 006,
  `cab:livre` (lecture), `cab:livreEcrire` (une seule porte d'écriture, atomique, `audit`),
  `cab:reprendre`, `cab:importerPlan`, `cab:importerBalance`, `cab:valider`, `cab:contrepasser`,
  `cab:lettrer` ; `cabstore` : `ecrireLivre`, `lireLivre`, `mettreDeCote`, sauvegardes et copie
  externe qui **emportent** `livre-*.json` (e2e `perte` et `demenagement` rejoués).

---

### 5.5 Contrat IPC — Cabinet (Livré, `src/cabinet/preload.js` 92 lignes, `src/cabinet/main.js`)

Règle absolue : **aucun handler ne rend `state` brut** — toujours `safeState()` (sans
`privateKey`) ; un test relit chaque handler. Le préchargement n'expose ni `data:save` ni
`pack:build` : le Cabinet **ne peut pas** écrire chez un client. Un import est une **boucle
interruptible** (`cab:importCancel`, `setImmediate` entre deux unités, `import:progress`).

| Méthode (`window.cabinet.`) | Canal | Arguments | Retour | Erreurs / notes |
|---|---|---|---|---|
| `status()` | `cab:status` | — | `{ exists, unlocked, version, corruptFile, backups }` | `exists` faux + `backups > 0` → écran de récupération, pas l'assistant |
| `unlock(password)` | `cab:unlock` | `string` | `{ created: true, state }` \| `{ created: false, state, reorganized }` | crée le cabinet si absent (nouveau sel) |
| `lock()` / `state()` | `cab:lock` / `cab:state` | | `true` / `safeState()` \| `null` | |
| `pickRecover(mode)` / `adopt(path, password)` | `cab:pickRecover` / `cab:adopt` | | `{ path, kind, base, backups, packs, bytes }` / `{ … }` | changement d'ordinateur : la **même empreinte** à l'arrivée |
| `saveCabinet(patch)` / `saveDossier(id, patch)` / `newDossier(fields)` | `cab:save*`, `cab:newDossier` | | `safeState()` / `{ state, moved, id }` / `{ state, id }` | `ERR-CAB-008` ; corriger le matricule corrige l'`id` tant qu'aucun paquet n'est arrivé |
| `importDossiers(text)` | `cab:importDossiers` | texte collé | `{ added, ignorés, state }` | une ligne = un client ; `;` ou tabulation |
| `deleteDossier(id)` / `deletePack(id, month)` | `cab:delete*` | | `safeState()` | sauvegarde `avant-suppression` d'abord ; suppression **et récupération** e2e |
| `noteRelance(id, months, via, note)` | `cab:noteRelance` | | `safeState()` | |
| `demo(on)` | `cab:demo` | boolean | `safeState()` | s'efface au premier vrai paquet |
| `exportPairing()` | `cab:exportPairing` | — | `{ path, fingerprint }` | SPEC-FMT-002 |
| `importPack(opts)` | `cab:importPack` | `{ paths?, password? }` (À VÉRIFIER les clés exactes de `opts`) | compte rendu `{ … }` par `import:progress` puis final | `ingest()` : recalcule chaque empreinte ; sept refus lisibles (Partie 10) ; **Cible 9.1.0** : demande la clé de secours d'abord (SPEC-UI-CAB-002) |
| `cancelImport()` | `cab:importCancel` (**send**) | — | — | agit **entre** deux unités |
| `listPack(packPath, password)` / `openInPack(packPath, name, password)` / `extractPack(packPath, password, label)` | `cab:*Pack` | | `Array<{ name, size, … }>` / `{ path, opened, reason? }` / `{ dir, files }` | `opened: false` sur un `.command` : jamais ouvert sous un nom choisi par l'expéditeur |
| `inbox()` / `pickInbox()` / `clearInbox()` / `inboxIgnore(paths)` | `cab:inbox*` | | `{ dir, nouveaux: [path], erreur? }` | « Dossier introuvable (support débranché ?) » n'est pas une panne |
| `ecrituresPlan(opts)` / `exportEcritures(opts)` | `cab:ecrituresPlan/exportEcritures` | `{ dossiers?, mois? }` | plan pur / `{ path, lignes, dossiers, vides, illisibles, mois }` | colonnes par **nom** ; un paquet illisible n'arrête rien |
| **`livres(dossierId, periode)`** | `cab:livres` | | `{ lignes, moisPresents, moisAbsents, paquetsIllisibles, anciens }` | **Cible 9.1.0**, SPEC-UI-CAB-001 |
| **`livre(dossierId, annee)` / `livreEcrire(dossierId, annee, op)`** | `cab:livre` / `cab:livreEcrire` | `op` = `{ type: 'ajouter'\|'valider'\|'contrepasser'\|'lettrer'\|'delettrer'\|'reprendre'\|'importerPlan'\|'importerBalance', … }` | `livre` / `{ livre, resultat }` | **Cible 9.2.0** : une seule porte d'écriture, atomique, `audit`, verrou `livre-<AAAA>.lock` |
| `backups()` / `backupNow(label)` / `peekBackup(path, password)` / `restore(path, password)` | `cab:backup*`, `cab:peekBackup`, `cab:restore` | | `{ list, … }` / `{ path, list }` / résumé / `safeState()` | `peek` réessaie avec le sel de la sauvegarde ; `restore` dit d'abord ce qu'on perd |
| `pickExternal()` / `clearExternal()` / `mirrorNow()` | `cab:*External`, `cab:mirrorNow` | | `{ dir, ok, last, … }` | la copie emporte **aussi les paquets** |
| `changePassword(current, next)` | `cab:changePassword` | | `{ ok: true }` \| throw | l'ancien est **revérifié en relisant le fichier** ; les sauvegardes sont rechiffrées |
| `exportRecovery(password, current)` / `importRecovery(password)` / `recoveryStatus()` | `cab:*Recovery` | | `{ path }` / `{ fingerprint, name }` / `{ exportedAt }` | SPEC-FMT-003 ; restaurer compte comme avoir exporté |
| `exportCsv(rows, name)` | `cab:exportCsv` | | `{ path }` | |
| `mail({ to, subject, body })` / `tel({ number, whatsapp, text })` | `cab:mail` / `cab:tel` | | `true` | |
| `reveal(p)` / `support()` / `openLog()` / `openDataDir()` | `cab:*` | | | |
| `updVersion/Check/Download/Install/SetToken/OpenReleases` | `upd:*` | | comme l'entreprise | canal `cabinet` ; **Cible** `cabinet-beta` |
| `pathForFile(file)` | (local, `webUtils.getPathForFile`) | `File` | chemin | glisser-déposer |
| `takePending()` | `cab:takePending` | — | `Array<path>` | fichiers ouverts avant que la fenêtre soit prête (`file:open`) |
| `onUpdateEvent`, `onMenuAction`, `onImportProgress`, `onAlivePing`, `onFreezeNotice`, `onFileOpen` | événements | | | un `import:progress` en retard ne rouvre pas la fenêtre (drapeau « en cours », 6.8.1) |

## Partie 6 — Le pont

### 6.1 `.skanpack` (SPEC-FMT-001, Livré)

Arborescence du ZIP (`packPlan` + `pack:build`), tous les fichiers en **UTF-8** :

```
manifeste.json                  écrit en dernier (avec les empreintes) — JSON, 2 espaces
00-page-de-garde.pdf            packCoverHtml → PDF
journaux/ventes.csv             salesCsvColumns
journaux/achats.csv             buyCsvColumns
journaux/encaissements.csv      payCsvColumns
journaux/reglements-fournisseurs.csv
journaux/tresorerie.csv         cashCsvColumns
journaux/ecritures.csv          entryCsvColumns : N°;Date;Journal;Pièce;Compte;Tiers;Libellé;Débit;Crédit;Lettrage;Devise
journaux/balance.csv            balanceCsvColumns
journaux/tva.json               vatReturn du mois
ventes/<numéro>.pdf             chaque facture/avoir émis du mois
achats/<numéro>/<justificatif>  pièces jointes des achats du mois
paie/<salarié>.pdf              bulletins du mois
social/cnss-T<n>.json           si le trimestre finit ce mois-ci et qu'il y a des salariés
signature.json                  Cible 9.2.0 (SPEC-FMT-005)
```

CSV : séparateur `;`, fin de ligne `CRLF`, **BOM UTF-8 en tête**, montants `type: 'money'` en
`1234,567` (virgule, 3 décimales), dates `fmtDate` (`JJ/MM/AAAA`), champs contenant `;`, `"` ou
saut de ligne entre guillemets doublés. JPEG et PDF stockés sans recompression
(`ALREADY_COMPRESSED`). **Chiffré** : tout le ZIP (SPEC-FMT-004) ; **en clair** : l'entête de
l'enveloppe (entreprise, matricule, période, définitif, format). Nom du fichier : `packFileName` = `<nom de la société sans accents, [A-Za-z0-9-], 40 car. max>-<AAAA-MM>[-provisoire].skanpack`
(`core.js` l. 3515) ; le cabinet le range en `<client>/<annee>/`.

### 6.2 `.skanpair` — SPEC-FMT-002. 6.3 `.skanask` — SPEC-FMT-006. 6.4 `.skanclose` — SPEC-FMT-007.

### 6.5 Spécifications par version — pont

- **9.1.0** : rien ne change dans le paquet (le Cabinet lit ce qui existe).
- **9.1.1** : rien.
- **9.2.0** : manifeste `format: 2` avec `licence` et `essai` (le Cabinet accepte 1 et 2 ; 3+ →
  `ERR-CAB-011` existant « version plus récente ») ; `signature.json` ; l'app entreprise demande
  `manifest.format` attendu par le cabinet ? **Non** — elle ne le connaît pas hors ligne : elle écrit
  format 2 et le Cabinet ancien affiche `ERR-CAB-011`. D'où « mets à jour SkanFact Cabinet » dans le
  message (Livré) et, côté entreprise, la phrase de la page Cabinet : « Ton comptable doit avoir
  SkanFact Cabinet 9.2.0 ou plus pour lire ce paquet. »

---

## Partie 7 — Plateforme (`plateforme/skanfact-api.mjs`, Livré sauf mention)

### 7.1 Routes

Le routage est `routeApi(pathname)` : `/v<n>/<espace>/<action>[/<id>[/<sous>]]` avec `ACTIONS =
{ licence: ['etat'], admin: ['etat', 'stats', 'clients', 'licences', 'activations', 'ventes',
'evenements', 'importer'] }`, `SOUS_ACTIONS = ['revoquer', 'renouveler', 'changer-offre', 'envoyer',
'payee', 'facturee']`, `SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/`. Tout le reste → 404. `/` et
`/console` servent la console (HTML inline). Ce tableau donne le contrat ; **les JSON exacts, lus
dans les handlers (lignes 579 à 1 016), sont en 7.1 bis** — v1, point 5/19 de la relecture. Trois cellules
de la v0 étaient fausses et sont corrigées ici (voir le Journal des versions).

| ID | Méthode | Chemin | Auth | Entrée | Sortie | Erreurs |
|---|---|---|---|---|---|---|
| SPEC-API-001 | POST | `/v1/licence/etat` | en-tête secret d'application (`APP_SECRET`) | `{ cle?, deviceId, deviceNom, plateforme, version }` — **et rien d'autre** (un test compte les champs) | `{ v: 1, sujet, etat, offre, exp, postes, motif, emisLe, signature: string|null }` — **plat**, pas d'objet `reponse` (corrigé en v1) | 403 secret faux ; 503 `LICENCE_PUBLIC_KEYS` absent **seulement si `LICENCE_REQUISE=1`** ; sinon laisse passer |
| SPEC-API-002 | GET | `/v1/admin/etat` | `ADMIN_SECRET` (≥ `ADMIN_MIN` car.) | — | `{ base, emission: { ok, kid, raison }, mail: { ok, expediteur } \| { ok: false, raison }, reponse: boolean, tarifs, offres, durees }` (corrigé en v1) | 403 ; 503 console non configurée |
| SPEC-API-003 | GET | `/v1/admin/stats` | admin | — | cartes (licences actives = non remplacées, non révoquées, non expirées ; essais ; activations) | 403 |
| SPEC-API-004 | GET/POST | `/v1/admin/clients[/<id>]` | admin | POST `{ nom, matricule?, email?, tel?, adresse?, notes? }` | liste / client | 400 (`nettoyer*` refuse avec sa raison), 403, 404 |
| SPEC-API-005 | GET/POST | `/v1/admin/licences[/<id>[/revoquer|renouveler|changer-offre|envoyer]]` | admin | POST émission `{ clientId, offre, duree, dateLibre?, prix, devise?, remise?, cabinet?, payeeLe?, moyen? }` (`nettoyerEmission`) ; `revoquer { motif }` (obligatoire) ; `renouveler { … }` ; `changer-offre { offre, prixNouveau }` ; `envoyer` | licence `{ id, kid, empreinte, offre, debut, fin, statut (déduit : révoquée > expirée > remplacée > active), charge, cle (refabriquée, jamais stockée) }` | 400 ; 403 ; 404 ; **409** renouveler une révoquée/remplacée ; 503 clé serveur incohérente |
| SPEC-API-006 | GET | `/v1/admin/activations` | admin | — | `[{ empreinte (ou 'ESSAI'), device_id, device_nom, plateforme, version, premiere_fois, derniere_fois }]` | 403 |
| SPEC-API-007 | GET/POST | `/v1/admin/ventes[?non_facturees=1][/<id>/payee|facturee]` | admin | `payee { moyen?, date? }` → envoie la clé si Resend réglé et adresse présente (une fois, `envoyee_le`) ; `facturee { numero }` | ventes avec `cle` refabriquée quand non facturées | 400, 403, 404 |
| SPEC-API-008 | GET | `/v1/admin/evenements` | admin | — | journal `{ quand, quoi, client_id, licence_id, detail, par_qui }` | 403 |
| SPEC-API-009 | POST | `/v1/admin/importer` | admin | `{ licences: [18 champs de `chargeHistorique`] }` | `{ importees, dejaLa, ignorees: [{ id, raison }] }` (le champ s'appelle **`ignorees`**, pas `refusees` — corrigé en v1) — **refuse** une vente incomplète, ne la met pas à null | 403 ; 503 sans clé publique |
| **SPEC-API-011** | GET | `/v1/admin/export` | admin | — | **Cible Phase 0** : `{ format: 1, exporteLe, tables: { clients: [...], licences: [...], activations: [...], ventes: [...], jetons: [...], evenements: [...] } }` — toutes les lignes, `charge` incluse, **jamais** une clé privée (il n'y en a pas en base) | 403 |

Seule requête sortante du worker : Resend (un test compte les `fetch(`). Toute réponse restrictive
est **signée, datée, adressée** (`sujet` = `empreinteCle` = SHA-256 tronqué à 32 hex de la clé).

### 7.1 bis — les JSON exacts de chaque route (v1, lus dans `skanfact-api.mjs`)

Tout ce qui suit est **Livré** et copié des handlers ; un client de la plateforme peut se coder
là-dessus sans ouvrir le worker. Toute erreur a la forme `{ erreur: '<phrase en français>' }` avec
le statut indiqué. Les listes sont bornées à **500 lignes** (`LIMIT 500`, Partie 18). Les dates
`*_le` sont des instants ISO (`2026-09-15T10:22:41.000Z`) sauf `debut`, `fin`, `payee_le`,
`revoquee_le` qui sont des jours `AAAA-MM-JJ`.

**Enveloppe commune** — en-têtes : `Content-Type: application/json; charset=utf-8`,
`Cache-Control: no-store`. Méthode autre que GET/POST → 405 `Méthode non autorisée.` ; espace
`admin` sans `ADMIN_SECRET` réglé → 503 ; secret faux → 403 `Accès refusé.` ; base absente
(`env.DB`) → 503 `La base n'est pas branchée sur ce worker (réglage « DB »).` ; route inconnue →
404 `Introuvable.` (un `id` malformé ne passe pas `SEGMENT` et tombe ici).

**SPEC-API-001 — `POST /v1/licence/etat`** (en-tête secret d'application).

```json
// entrée (nettoyerActivation : tout champ inconnu est ignoré, un test compte les cinq)
{ "cle": "SKAN1.…",          // fac. : absent = installation en essai
  "deviceId": "…",           // DEVICE : sans lui, l'activation n'est pas notée
  "deviceNom": "MacBook de Sami", "plateforme": "darwin|win32|linux", "version": "9.0.0" }
// sortie sans clé (essai) — jamais signée, jamais restrictive
{ "v": 1, "etat": "essai", "emisLe": "<ISO>", "signature": null }
// sortie avec clé (corpsReponse, puis signerReponse si REPONSE_PRIVATE_KEY)
{ "v": 1, "sujet": "<empreinteCle : sha256 tronqué à 32 hex>",
  "etat": "active|revoquee|expiree|inconnue", "offre": "independant|entreprise|null",
  "exp": "AAAA-MM-JJ|null", "postes": null, "motif": "<revoquee_motif>|null",
  "emisLe": "<ISO>", "signature": "<base64url Ed25519 des octets JSON.stringify du corps>|null" }
// 503 { erreur: "Plateforme mal réglée (aucune clé publique)." } si LICENCE_PUBLIC_KEYS est vide
```

Règle tenue par `verifierReponse` côté application (SPEC-FUNC-016) : sans `signature`, sans
`sujet` égal à l'empreinte de la clé présentée, ou avec un `emisLe` plus ancien que le verdict déjà
rangé, la réponse est **ignorée** — jamais transformée en refus.

**SPEC-API-002 — `GET /v1/admin/etat`** → `etatPlateforme(env)` :

```json
{ "base": true, "emission": { "ok": true, "kid": "srv-1", "raison": "" },
  "mail": { "ok": true, "expediteur": "SkanFact <licences@send.skanfact.tn>" },   // ou { ok:false, raison }
  "reponse": false,                     // REPONSE_PRIVATE_KEY posée ?
  "tarifs": { "independant": 390, "entreprise": 690, "remiseParrainage": 20, "devise": "TND" },  // tarifs(env), PRIX_* du worker
  "offres": { "independant": { "label": "Indépendant" }, "entreprise": { "label": "Entreprise" } },
  "durees": [ { "id": "1m", "label": "1 mois", "mois": 1 }, … "1a", "2a", { "id": "vie", "mois": null }, { "id": "date", "mois": null } ] }
```

**SPEC-API-003 — `GET /v1/admin/stats`** → `resumeStats` :
`{ clients, licencesActives, licencesExpirees, licencesRevoquees, essaisEnCours, postes, incertain }`
— `incertain: true` quand aucun essai ni aucun poste n'a jamais parlé au serveur (« ce qu'on ne peut
pas savoir se dit »). `licencesActives` = non révoquées, non expirées, **non remplacées**
(`NOT EXISTS (… remplace_id = l.id)`) ; `essaisEnCours` = activations `ESSAI` vues dans les
30 derniers jours.

**SPEC-API-004 — clients.** `GET /v1/admin/clients` → `{ lignes: [{ id, nom, matricule, email, tel,
adresse, notes, cree_le }] }`. `POST /v1/admin/clients` avec `{ nom, matricule?, email?, tel?,
adresse?, notes? }` → **201** `{ client: { id: 'cli_…', nom, matricule, email, tel, adresse, notes,
cree_le } }` ; 400 `{ erreur }` de `nettoyerClient` (« Le nom du client est obligatoire (deux
caractères au moins). », « L'adresse e-mail n'a pas la forme attendue : … ») ; 500 « La base a refusé
l'écriture du client. ».

**SPEC-API-005 — licences.**

```json
// GET /v1/admin/licences  → { lignes: [Licence] } ; GET /v1/admin/licences/<id> → { licence: Licence, cle, cleRaison }
// Licence (SEL_LICENCE) :
{ "id", "client_id", "kid", "empreinte", "offre", "postes", "debut", "fin", "prix", "devise", "remise",
  "cabinet_empreinte", "emise_le", "remplace_id", "remplacee_motif", "revoquee_le", "revoquee_motif",
  "envoyee_le", "resignable": 0|1, "client", "matricule", "email", "remplacee_par": "<id>|null",
  "activations": <nombre> }
// cle = "SKAN1.…" refabriquée, ou "" avec cleRaison (licence signée par la clé maître : pas refabricable ici)

// POST /v1/admin/licences  (émettre)
{ "clientId": "cli_…", "offre": "independant|entreprise", "duree": "1m|3m|6m|1a|2a|vie|date",
  "dateLibre": "AAAA-MM-JJ",   // si duree = date
  "prix": 390, "devise": "TND", "remise": 20, "cabinet": "a1b2-c3d4-…", "payeeLe": "AAAA-MM-JJ", "moyen": "virement" }
// → 201
{ "licence": { "id", "client", "matricule", "email", "kid", "empreinte", "offre", "debut", "fin", "prix", "remise",
               "devise", "emise_le", "remplace_id": null, "remplacee_motif": null },
  "cle": "SKAN1.…",
  "vente": { "id": "v_…", "montant_ht": 312, "devise": "TND", "payee_le": null },
  "mail": { "envoye": false, "raison": "la vente n'est pas encore payée" } }
// 400 : client absent (« Choisis un client existant (crée-le d'abord). ») ou nettoyerEmission (offre, durée, prix, remise, cabinet, date)
// 503 : « Émission impossible : <raison de cleServeur> » ; 500 : « La signature a échoué : … » / « La base a refusé l'écriture de la licence. »

// POST /v1/admin/licences/<id>/revoquer   { "motif": "≥ 3 caractères" }
// → { "ok": true, "licence": { …Licence, revoquee_le, revoquee_motif }, "note": "La révocation sera appliquée chez le client à sa prochaine connexion, … Hors ligne, la clé continue jusqu'à sa date de fin." }
// 400 motif absent ; 409 « Cette licence est déjà révoquée (…) » ; 404

// POST /v1/admin/licences/<id>/renouveler   { "duree", "dateLibre?", "prix", "devise?", "remise?", "payeeLe?", "moyen?" }
//   → même 201 que l'émission ; l'offre et le cabinet sont ceux de la licence remplacée, debut = max(fin, aujourd'hui),
//     remplace_id = <id>, remplacee_motif = "renouvellement"
// POST /v1/admin/licences/<id>/changer-offre   { "offre", "prix", "devise?", "payeeLe?", "moyen?" }
//   → même 201 ; fin inchangée (duree = date | vie), remise 0, remplacee_motif = "offre"
// 409 : « Une licence révoquée ne se renouvelle pas : émets-en une nouvelle. » / « Cette licence a déjà été remplacée par <id>. »
//       / « Cette licence est déjà en offre <label>. » / « Le client de cette licence est introuvable. » ; 400 « Choisis la nouvelle offre. »

// POST /v1/admin/licences/<id>/envoyer   (corps vide)
// → { "ok": true, "envoyee_le": "<ISO>", "a": "<email>" } ; 409 { erreur: cleRaison } ; 502 { "erreur": "Mail non envoyé : <raison>", "cle": "SKAN1.…" }
```

**SPEC-API-006 — `GET /v1/admin/activations`** → `{ lignes: [{ empreinte ('ESSAI' pour un essai),
device_id, device_nom, plateforme, version, premiere_fois, derniere_fois, client: '<nom>|null' }] }`.

**SPEC-API-007 — ventes.** `GET /v1/admin/ventes[?non_facturees=1]` → `{ lignes: [{ id,
client_id, licence_id, montant_ht, tva, devise, payee_le, moyen, facture_skanfact, importee_le,
client, matricule, email, offre, fin, debut, kid, emise_le, prix, remise, cabinet_empreinte,
envoyee_le, revoquee_le, empreinte, resignable, cle? }] }` — `cle` n'est ajouté **que** avec
`non_facturees=1` (le pont comptable, § 11 du plan plateforme). `POST …/ventes/<id>/payee` avec
`{ date?, moyen? }` → `{ ok: true, payee_le, mail: { envoye, raison?, a? } }` ; 400 date illisible ;
409 « Cette vente est déjà marquée payée le … ». `POST …/ventes/<id>/facturee` avec `{ numero }` →
`{ ok: true, facture_skanfact }` ; 400 « Le numéro de facture manque. ».

**SPEC-API-008 — `GET /v1/admin/evenements`** → `{ lignes: [{ id, quand, quoi, client_id,
licence_id, detail, par_qui: 'console', client }] }`. Valeurs de `quoi` écrites par le code :
`licence.emise`, `licence.renouvellement`, `licence.offre`, `licence.revoquee`, `licence.importee`,
`vente.payee`, `vente.facturee`, `mail.envoye`, `mail.echec`.

**SPEC-API-009 — `POST /v1/admin/importer`** avec `{ licences: [ChargeHistorique × ≤ 500] }`
(les 18 champs de `core.chargeHistorique`, Partie 3) → `{ importees, dejaLa, ignorees: [{ id,
raison }] }`. Raisons émises : celles de `nettoyerImport` (« identifiant manquant ou douteux », « clé
absente », « date d'émission illisible », « date de fin illisible », …), « clé non vérifiable :
<raison> », « la base a refusé l'écriture ». Le client est retrouvé par matricule puis par nom,
sinon créé (`Client importé`) ; les remplacements sont reliés en **second passage** ; rejouer
l'envoi ne réécrit rien (`dejaLa`). 503 sans clé publique.

**SPEC-API-011 — `GET /v1/admin/export`** (Cible Phase 0, inchangé depuis la v0).

### 7.2 Base D1 (`plateforme/schema-a-coller.sql`, Livré)

| Table | Colonnes (type, contrainte) | Index |
|---|---|---|
| `clients` | `id TEXT PK, nom TEXT NOT NULL, matricule, email, tel, adresse, notes, cree_le TEXT NOT NULL` | `idx_clients_matricule(matricule)` |
| `licences` | `id PK, client_id NOT NULL → clients, kid NOT NULL, empreinte NOT NULL, offre NOT NULL, postes INTEGER, debut NOT NULL, fin, prix REAL, devise, remise REAL, cabinet_empreinte, emise_le NOT NULL, remplace_id → licences, remplacee_motif, revoquee_le, revoquee_motif, charge TEXT (le JSON signé, refabriqué en clé), envoyee_le` | `idx_licences_client(client_id)` ; `idx_licences_empreinte` **UNIQUE**(empreinte) |
| `activations` | `id PK, licence_id → licences, empreinte NOT NULL ('ESSAI' pour un essai), device_id NOT NULL, device_nom, plateforme, version, premiere_fois NOT NULL, derniere_fois NOT NULL` | `idx_activ_unique` **UNIQUE**(empreinte, device_id) — un essai ne compte qu'une fois par machine |
| `ventes` | `id PK, client_id NOT NULL, licence_id, montant_ht REAL NOT NULL, tva REAL, devise NOT NULL, payee_le, moyen, facture_skanfact, importee_le` | `idx_ventes_afacturer(facture_skanfact)` |
| `jetons` | `id PK, nom NOT NULL, empreinte NOT NULL UNIQUE, cree_le NOT NULL, dernier_usage, revoque_le` | — |
| `evenements` | `id INTEGER PK AUTOINCREMENT, quand NOT NULL, quoi NOT NULL, client_id, licence_id, detail, par_qui` | `idx_evt_quand(quand)` |

**Cible** : aucune table nouvelle avant P 0.3 (licence du Cabinet : table `cabinets` `{ id,
empreinte UNIQUE, nom, email, quota, cree_le }` — à spécifier avec la 9.4.0). Le schéma **ne porte
aucun statut écrit à la main** (un test le vérifie) : le statut d'une licence se déduit.

### 7.3 Console (Livré) — SPEC-UI-CON-001 à 006 : Tableau de bord (cartes `stats`), Clients,
Licences (émettre, voir la clé, renvoyer, révoquer avec motif obligatoire et l'avertissement orange
« une clé livrée ne se reprend pas », renouveler, changer d'offre au prorata), Activations, Ventes
(marquer payée, marquer facturée), Événements. **Cible 9.1.0** : SPEC-UI-CON-007, la case « Option
Comptabilité » à l'émission et dans la colonne des licences (`options` du format 3).

---

## Partie 8 — Relais de mise à jour (`worker/skanfact-maj.mjs`, Livré)

- **Canaux** : `CANAUX.app` = `latest.yml, latest-mac.yml, latest-linux.yml, beta.yml,
  beta-mac.yml, beta-linux.yml`, préfixe `SkanFact-`, **interdit** `SkanFact-Cabinet-` ;
  `CANAUX.cabinet` = `cabinet.yml, cabinet-mac.yml, cabinet-linux.yml`, préfixe `SkanFact-Cabinet-`.
  **Il n'existe pas de canal `cabinet-beta`** : SPEC-OUT-001 l'ajoute (`cabinet-beta.yml`,
  `cabinet-beta-mac.yml`, même préfixe, et `build/cabinet.config.js` doit écrire ce nom quand la
  version porte `-beta.` — `canalDe(version)` décide, une seule source de vérité).
- **Format YAML** : celui d'electron-updater (`version`, `files[{ url, sha512, size }]`, `path`,
  `sha512`, `releaseDate`) — produit par electron-builder, jamais écrit à la main.
- **Comportement** : le relais lit les 20 dernières releases GitHub avec `GITHUB_TOKEN`, exige
  l'en-tête `X-SkanFact-App` (canal) et le secret (`memeSecret`) ; `licenceValide` si une clé est
  présentée ; `LICENCE_REQUISE=1` → 402 sans licence, 503 sans `LICENCE_PUBLIC_KEY`. Côté
  application : `configureFeed` valide l'adresse (`new URL`, tout `trim()`), retombe sur GitHub si le
  relais est mal réglé **ou répond mal** (`relayDown`), `allowDowngrade = false` **après**
  `channel`, `allowPrerelease` selon `canalDe`, vérification toutes les 4 h et au retour au premier
  plan, `updateProblem(err)` traduit tout (jamais une phrase brute).
- **Gravé à la construction** (`extraMetadata`) : `updateBase`, `updateSecret`, `plateformeBase`,
  `plateformeSecret`, `version`. `src/depot.js` porte `private` (une seule ligne, lue par les deux).

---

## Partie 9 — Outillage

### SPEC-OUT-001 — le canal `cabinet-beta` (9.1.0)

`worker/skanfact-maj.mjs` : `CANAUX.cabinet.yml` gagne `cabinet-beta.yml`, `cabinet-beta-mac.yml`,
`cabinet-beta-linux.yml` (test `relais : un canal ne réclame jamais les fichiers de l'autre`
étendu). `build/cabinet.config.js` : `publish.channel = canalDe(pkg.version) === 'latest' ? 'cabinet'
: 'cabinet-beta'`. `src/cabinet/main.js` : `u.channel = cfg.beta ? 'cabinet-beta' : 'cabinet'` **puis**
`u.allowDowngrade = !cfg.beta && canalDe(version) !== 'latest'`, `allowPrerelease = cfg.beta` ; case
« Recevoir les versions d'essai » dans Réglages → Mises à jour, avec la sauvegarde `avant-beta`
**avant** d'armer (même règle que l'app entreprise, e2e `beta` porté).

### SPEC-OUT-002 — `.github/workflows/ci.yml` (9.1.0)

```yaml
name: CI
on:
  push: { branches: [main, beta] }
  pull_request:
jobs:
  test:
    strategy:
      fail-fast: false
      matrix: { os: [ubuntu-latest, windows-latest] }
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run e2e:pages          # chromium seul, sans xvfb — le seul e2e assez rapide pour la CI
        if: matrix.os == 'ubuntu-latest'
```

Blocage : `main` protégée, la CI obligatoire avant fusion (réglage GitHub, **à toi**). Ce qui n'y est
**pas** : les e2e Electron (trop longs, `xvfb`) — ils restent un geste avant publication, listés dans
`CLAUDE.md`. Windows : `.gitattributes` `* text=auto eol=lf` déjà en place (7.21.2) ; un test relit
la source avec des `\n` littéraux, c'est la CI Windows qui garantit qu'il tient.

### SPEC-OUT-003 — lint (9.1.0)

`eslint` en **devDependency** (autorisé : Playwright l'est déjà ; la règle « aucune dépendance
tierce » porte sur l'application). `eslint.config.js` (format plat, ESLint 9) :

```js
module.exports = [{
  files: ['src/**/*.js', 'test/**/*.js', 'scripts/**/*.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { window: 'readonly', document: 'readonly', require: 'readonly', module: 'writable', process: 'readonly', Buffer: 'readonly', __dirname: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', localStorage: 'readonly', location: 'readonly', navigator: 'readonly', SkanCore: 'readonly', SkanCompta: 'readonly', RowMenu: 'readonly', Reglages: 'readonly' } },
  rules: { 'no-var': 'error', 'eqeqeq': ['error', 'always', { null: 'ignore' }], 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none' }], 'no-redeclare': 'error', 'prefer-const': 'warn', 'no-restricted-syntax': ['error', { selector: "NewExpression[callee.name='Date'][arguments.length>1]", message: 'new Date(y, m, d) : jour local — utiliser Date.UTC (CLAUDE.md 5.2.3)' }, { selector: "CallExpression[callee.property.name='getDay']", message: 'getDay() : utiliser getUTCDay()' }] }
}, { files: ['plateforme/**/*.mjs', 'worker/**/*.mjs'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { fetch: 'readonly', Response: 'readonly', Request: 'readonly', crypto: 'readonly', TextEncoder: 'readonly', btoa: 'readonly', atob: 'readonly', URL: 'readonly' } }, rules: { 'no-var': 'error', 'eqeqeq': ['error', 'always', { null: 'ignore' }], 'no-undef': 'error' } }];
```

Scripts : `"lint": "eslint ."`. Première passe : les avertissements (`warn`) sont tolérés, les erreurs
non ; on n'ajoute une règle `error` que quand la base la passe. `innerHTML` n'est **pas** interdit
par le lint (l'application est faite de gabarits) : la règle est « toute interpolation passe par
`h()` », tenue par les tests de source existants.

### SPEC-OUT-004 — garde-fou d'erreur et journal borné (9.1.0)

Dans les deux renderers, **avant** la séquence de démarrage : `window.addEventListener('error', e =>
bridge.support.erreur({ message: e.message, source: e.filename, ligne: e.lineno, pile:
(e.error && e.error.stack) || '' }))` et `unhandledrejection` (`reason.message`/`stack`). IPC
`support:erreur` (les deux `main.js`) → `logToFile('[renderer] ' + …)` ; jamais de fenêtre, jamais
de rechargement ; un compteur par session, et au-delà de 20 par minute on cesse d'écrire (un
renderer en boucle ne remplit pas le disque). `logToFile` : si `main.log` dépasse **2 Mo**, renommer
en `main.log.1` (écraser l'ancien `.1`) puis repartir — une rotation, pas deux. Un test relit les
deux `main.js` et les deux `app.js` (structure, pas mention).

### SPEC-OUT-005 — `essai.yml` (9.1.0, « Construire un essai »)

`workflow_dispatch` seul, entrée `branche` ; construit les **deux** applications (`--publish never`,
`-c.extraMetadata.productName="SkanFact (essai)"`, `appId` suffixé `.essai`, `updateBase` vide donc
**aucune mise à jour**) sur macOS et Windows ; artefacts attachés au run (14 jours). Installables à
côté des vraies applications, sur un `userData` séparé (« SkanFact (essai) »). Coût : une exécution
macOS ≈ dix fois Linux — à lancer pour une bêta, pas pour un correctif.

### SPEC-OUT-006 — le test de charge (9.1.0)

`test/charge-livre.js`, `npm run charge` : fabrique 50 000 lignes d'écritures plausibles (12 mois,
6 journaux, 400 comptes, 300 tiers), les écrit dans un `livre.json` d'essai, puis mesure avec
`performance.now()` : ouverture (lecture + `JSON.parse` + `isValidLivre`), **ajout d'une écriture
puis écriture atomique** (× 20, on garde la médiane), `balanceDepuisLignes` sur 60 livres (60
fichiers), recherche globale (« FAC-2026-031 » dans 60 fichiers), `journalDepuisLignes`. Seuils
(`QUESTIONS.md` § 5) : **ouverture < 1 000 ms, écriture < 100 ms, balance × 60 < 5 000 ms, recherche
< 3 000 ms** ; le script **échoue** (`process.exit(1)`) au premier seuil dépassé et imprime les quatre
mesures ; il tourne sur un portable ordinaire, pas seulement en CI. Le résultat va dans `CHANGELOG.md`
de la 9.1.0.

### 9.3 Workflows existants

`release.yml` (Livré) : déclenché par `push` de tag `v*` ou `workflow_dispatch` ; matrice `macos` +
`windows`, Node 22, cache electron-builder ; `npx electron-builder --publish always
-c.publish.releaseType=<release|prerelease selon canalDe> -c.extraMetadata.*` ; le job mac écrit le
titre et les notes (`gh release edit "v$V" --notes-file build/release-notes.md`) ; puis l'app cabinet
(`-c build/cabinet.config.js --publish always`), **sauf sur une bêta** (elle ne construit pas le
Cabinet). Depuis une session Claude Code, le push de tag est bloqué : `workflow_dispatch`.

### 9.4 Scripts (`package.json`, Livré)

`start` (electron .), `start:cabinet`, `test` (`node test/run-tests.js`), `build:mac`, `build:win`,
`build:cabinet:mac`, `build:cabinet:win`, `release` (`scripts/release.js` : bump + tag + push, avec
`preminor`/`prerelease`/`minor`), 41 × `e2e:<nom>` (`node test/e2e/<nom>.js`, sous `xvfb-run -a`).
`scripts/release-notes.js` (CHANGELOG → `build/release-notes.md`), `scripts/icones.js` (Electron +
app-builder → `.icns`/`.ico` sept tailles), `scripts/licence.js` (`--keygen` : n'écrit plus dans
`build/`). Dépendances : `electron-updater ^6.3.9` ; dev : `electron ^43`, `electron-builder ^25`,
`playwright ^1.63` ; `engines` absent (**Cible** : `"engines": { "node": ">=22" }` + `.nvmrc` `22`).

---

## Partie 10 — Messages d'erreur

Les messages **Livrés** sont ceux du code (`src/cabinet/main.js`, `src/main.js`) ; les identifiants
sont posés ici pour qu'on puisse les citer (le code n'en porte pas encore — **Cible 9.1.0** : chaque
`throw new Error('…')` des deux `main.js` gagne un `code` sur l'erreur, `err.code = 'ERR-CAB-001'`,
et `plainError` le montre repliés sous « Détails techniques »). Règle : **jamais une phrase qu'on n'a
pas écrite** ; `updateProblem` pour les mises à jour ; toute erreur nomme ce qui est refusé, pourquoi,
et le geste qui débloque.

| Identifiant | Message exact | Contexte | Action proposée | Code |
|---|---|---|---|---|
| `ERR-CAB-001` | « Ce fichier n'est pas un paquet SkanFact : le manifeste est absent. » | import | vérifier le fichier | Livré |
| `ERR-CAB-002` | « Le manifeste de ce paquet est illisible : le fichier a été abîmé pendant l'envoi. » | import | redemander le paquet | Livré |
| `ERR-CAB-003` | « Le manifeste de ce paquet ne ressemble pas à un envoi SkanFact. » | import | — | Livré |
| `ERR-CAB-004` | « Ce paquet vient d'une version plus récente de SkanFact. Mets à jour SkanFact Cabinet pour le lire. » | import, `format` inconnu | mettre à jour | Livré |
| `ERR-CAB-005` | « Ce paquet ne dit pas de quelle entreprise il vient. » / « … ni le nom ni le matricule de l'entreprise. » / « … de quel mois il parle. » | import | — | Livré |
| `ERR-CAB-006` | « La liste des fichiers de ce paquet est illisible. » | import | — | Livré |
| `ERR-CAB-007` | « Fichier absent du paquet. » | ouvrir une pièce | — | Livré |
| `ERR-CAB-008` | « Un autre dossier porte déjà ce matricule (ou ce nom). » / « Un dossier existe déjà pour ce client (même matricule ou même nom). » | fiche dossier | corriger | Livré |
| `ERR-CAB-009` | « Donne au moins un nom à ce client. » / « Nom de client inutilisable. » / « Dossier introuvable. » / « Paquet introuvable. » / « Aucun cabinet ouvert. » / « Aucun paquet sur cette période. » / « Rien à sauvegarder pour l'instant. » | divers | — | Livré |
| `ERR-CAB-010` | « Le paquet de <mois> est illisible : <raison>. Les autres mois sont affichés. » | livres (9.1.0) | redemander le mois | **Cible** |
| `ERR-CAB-011` | (= 004, réutilisé pour le manifeste format ≥ 3) | — | — | Livré |
| `ERR-CAB-012` | « Choisis un mot de passe d'au moins huit caractères. » / « Mot de passe actuel incorrect. » / « Mot de passe du cabinet incorrect. » / « Cette clé de secours est vide. » | mots de passe, clé de secours | — | Livré |
| `ERR-CAB-013` | « Ce paquet ne contient pas d'écritures (version d'avant la 6.3.0). » | livres | demander de renvoyer | **Cible** |
| `ERR-CAB-020` | « Ce livre a été écrit par une version plus récente de SkanFact Cabinet (format <n>). Mets à jour pour l'ouvrir ; rien n'a été modifié. » | `livre.json` | mettre à jour | **Cible 9.2.0** |
| `ERR-CAB-021` | « Le livre <AAAA> de <client> est illisible. Il a été mis de côté (<fichier>) ; tu peux restaurer une sauvegarde. » | `livre.json` | Réglages → Sauvegardes | **Cible 9.2.0** |
| `ERR-CAB-022` | « Ce livre est ouvert sur <poste> depuis <heure>. Attends qu'il soit fermé, ou force l'ouverture si ce poste est éteint. » | verrou | attendre / forcer | **Cible 9.2.0** |
| `ERR-CAB-023` | « Cette balance n'est pas équilibrée : <écart> DT d'écart entre débit et crédit. Corrige le fichier avant de l'importer. » | balance d'ouverture | — | **Cible 9.2.0** |
| `ERR-CAB-024` | « Cette écriture n'est pas équilibrée (écart de <x>). » / « … n'a qu'une ligne. » / « … porte un compte vide. » / « … a un débit et un crédit sur la même ligne. » | validation | corriger | **Cible 9.2.0** (7 motifs comme `odValide`) |
| `ERR-CAB-025` | « Une écriture validée ne se modifie pas. Contre-passe-la, puis saisis la bonne. » | livre | Contre-passer | **Cible 9.2.0** |
| `ERR-CAB-030` | « Ce paquet est signé par une autre clé que celle de <client> (<empreinte reçue> au lieu de <empreinte épinglée>). Si ce client a changé d'ordinateur, accepte sa nouvelle clé après l'avoir vérifiée au téléphone. » | signature | « Accepter la nouvelle clé… » | **Cible 9.2.0** |
| `ERR-CAB-031` | « Ce paquet n'est pas signé, alors que <client> signe ses paquets depuis le <date>. Demande-lui de mettre à jour SkanFact et de renvoyer le mois. » | signature | écrire au client | **Cible 9.2.0** |
| `ERR-CAB-032` | « La signature de ce paquet ne correspond pas à son contenu : le fichier a été modifié après l'envoi. Ne l'utilise pas ; demande un nouvel envoi. » | signature | — | **Cible 9.2.0** |
| `ERR-ENT-030` | « Ce fichier n'est pas un appairage de cabinet. » / « Fichier incohérent : l'empreinte ne correspond pas à la clé. » | `cabinet:import` | — | Livré |
| `ERR-ENT-031` | « Ton comptable doit avoir SkanFact Cabinet 9.2.0 ou plus pour lire ce paquet. » | page Cabinet | — | **Cible 9.2.0** (information, pas une erreur) |
| `ERR-ENT-040` | « Cette page fait partie de l'option Comptabilité, qui n'est pas dans ta licence. Tes écritures, ta TVA, tes clôtures et le paquet de ton comptable restent disponibles. » | `optionBlock` | Voir ma licence | **Cible 9.1.0** |
| `ERR-ENT-041` | « Cette facture (<montant>) est sous le seuil de retenue (<seuil>) et porte une retenue de <taux> %. Vérifie avec ton comptable. » | émission (avertissement) | Émettre quand même / Corriger | **Cible 9.1.1** |
| `ERR-ENT-050` | « Le test de charge a dépassé un seuil : <mesure> = <valeur> (seuil <s>). » | `npm run charge` | changer le modèle | **Cible 9.1.0** |
| `ERR-API-001` | « Console non configurée : ADMIN_SECRET manque. » / « … fait moins de <n> caractères. » | plateforme | régler Cloudflare | Livré |
| `ERR-API-002` | « SRV_PRIVATE_KEY manque : la console ne peut pas signer. » | émission | — | Livré |
| `ERR-API-003` | « Relais non configuré (LICENCE_PUBLIC_KEY manque). » / « Licence requise pour les mises à jour. » | relais | — | Livré |

**9.4.10 — les codes sont POSÉS dans le code.** `erreur(code, message)` (les deux `main.js`) fabrique
l'erreur ; le code voyage à la fin du message entre crochets, parce qu'une propriété posée sur une
`Error` **ne traverse pas** le pont IPC — Electron la sérialise en chaîne. `plainError` le détache
avant d'afficher la phrase, `codeErreur` le rend à qui a la place de le montrer, et l'enveloppe posée
une fois sur `ipcMain.handle` écrit chaque refus dans `main.log` avec son code. Les codes ci-dessous
sont ceux que la 9.4.10 a ajoutés au tableau pour couvrir tous les `throw` des deux `main.js` ; les
refus internes attrapés sur place et reformulés (la requête au relais, un document non rendu) n'en
portent pas, et un test les nomme.

| Identifiant | Message exact | Contexte | Action proposée | Code |
|---|---|---|---|---|
| `ERR-CAB-014` | « Ce paquet est adressé à un autre cabinet (<nom>). » | import | demander le bon paquet | Livré |
| `ERR-CAB-015` | « Ce dossier a déjà un livre pour <année>. Ouvre-le plutôt que de le reprendre à zéro… » | reprise | ouvrir le livre | Livré |
| `ERR-CAB-016` | « Le fichier du cabinet est illisible. Il a été mis de côté, rien n'a été effacé… » | ouverture | restaurer une sauvegarde | Livré |
| `ERR-CAB-017` | « Ce paquet est protégé par un mot de passe. » | import | saisir le mot de passe | Livré |
| `ERR-CAB-026` | « Ce dossier n'a pas de livre pour cet exercice. » | livre | reprendre le dossier | Livré |
| `ERR-CAB-027` | (motif de `planDepuisCsv`) | import d'un plan | corriger le fichier | Livré |
| `ERR-CAB-028` | (motif de `lettrer` / `delettrer`, avec l'écart) | lettrage | — | Livré |
| `ERR-CAB-029` | « Ce justificatif n'est plus sur le disque… » | justificatif | le rejoindre | Livré |
| `ERR-CAB-050` | (détail de `licenceCabinet` : clé invalide, ou d'un autre cabinet) | licence | vérifier la clé | Livré |
| `ERR-CAB-051` | « <geste> demande une licence : <n> dossiers hors SkanFact sont comptés… » | validation | Réglages → Licence | Livré |
| `ERR-ENT-010` | « Image trop lourde (1 Mo maximum). Réduis-la avant de l'utiliser. » | logo, cachet | réduire l'image | Livré |
| `ERR-ENT-011` | « « <fichier> » dépasse 25 Mo. » | pièce jointe | réduire le fichier | Livré |
| `ERR-ENT-012` | « Fichier introuvable. » | pièce jointe, photo | — | Livré |
| `ERR-ENT-020` | « Le service n'a pas renvoyé de facture lisible. » | lecture de photo | saisir à la main | Livré |
| `ERR-ENT-021` | « Format non reconnu. Utilise une photo (JPG, PNG, WEBP) ou un PDF. » | lecture de photo | — | Livré |
| `ERR-ENT-022` | « « <fichier> » fait <n> Mo. Au-delà de 10 Mo… » | lecture de photo | réduire | Livré |
| `ERR-ENT-023` | « Aucune clé n'est enregistrée : rien n'a été envoyé… » | lecture de photo | Paramètres | Livré |
| `ERR-ENT-032` | « Plan de paquet invalide. » | paquet mensuel | — | Livré |
| `ERR-ENT-070` | « Le pont comptable ne s'utilise que sur le poste de l'éditeur. » | pont | — | Livré |
| `ERR-ENT-071` | « Aucune adresse de plan de contrôle dans cette version. » | pont | — | Livré |
| `ERR-ENT-072` | « Colle d'abord le secret d'administration… » / « … fait au moins <n> caractères… » | pont | Paramètres → Éditeur | Livré |
| `ERR-ENT-073` | « Chemin refusé. » | pont | — | Livré |
| `ERR-ENT-074` | « La console ne répond pas. Vérifie ta connexion… » | pont | réessayer | Livré |
| `ERR-ENT-075` | « La console refuse ce secret d'administration… » | pont | Paramètres → Éditeur | Livré |
| `ERR-ENT-076` | « La console a répondu <n>. » (ou le message de la console) | pont | — | Livré |
| `ERR-CAB-040` | « Ce relevé ne se boucle pas : <début> au départ, <mouvements> de mouvements, cela fait <attendu> — et le relevé annonce <fin>. Il manque <écart>… » / « Ce fichier a déjà été importé le <date>… » | import d'un relevé (9.5.0) | compléter le fichier, ou corriger le solde de fin | Livré |
| `ERR-CAB-041` | « Cette ligne d'écriture ne touche pas le compte <n>. » / « Cette ligne de relevé n'existe pas. » | rapprochement (9.5.0) | choisir la bonne ligne | Livré |
| `ERR-CAB-042` | « La période d'une déclaration mensuelle s'écrit AAAA-MM. » / « La déclaration de <mois> est marquée déposée le <date>… » / « L'écriture de cette déclaration existe déjà… » / « Cette déclaration n'est pas marquée déposée : on ne paie pas ce qu'on n'a pas déposé. » | déclaration (9.6.0) | dé-pointer, ou préparer d'abord | Livré |
| `ERR-CAB-043` | (détail de `immoValide` : libellé, date de mise en service, valeur, durée, taux dégressif manquant) / « La dotation de <année> est déjà passée en écriture : ce changement la rendrait fausse. Contre-passe… » | fiche d'immobilisation (9.7.0) | compléter la fiche, ou contre-passer la dotation | Livré |
| `ERR-CAB-044` | « La dotation de <année> est passée en écriture : supprimer la fiche laisserait une dotation sans bien. Contre-passe l'écriture d'abord. » | suppression d'un bien (9.7.0) | contre-passer d'abord | Livré |
| `ERR-CAB-045` | « Rien à passer : aucune dotation ni sortie en attente sur cet exercice. » | écritures d'inventaire des biens (9.7.0) | — | Livré |
| `ERR-CAB-046` | (détail de `inventaireValide` : date, aucune ligne, quantité ou coût négatif) / « L'inventaire de <année> est déjà passé en écriture… » | inventaire de stock (9.7.0) | corriger les lignes, ou contre-passer | Livré |
| `ERR-CAB-047` | « La variation de stock de cet exercice est déjà passée : la repasser compterait le stock deux fois. » / « Le stock compté est celui des comptes : aucune écriture à passer. » | variation de stock (9.7.0) | — | Livré |
| `ERR-CAB-060` | « L'exercice <année> est déjà clos depuis le <date>. » | clôture (9.8.0) | rouvrir d'abord | Livré |
| `ERR-CAB-061` | « Cet exercice n'est pas clos. » / « Une réouverture demande un motif : c'est la seule trace qui expliquera pourquoi un chiffre a changé après coup. » | réouverture (9.8.0) | écrire le motif | Livré |
| `ERR-CAB-062` | « Cet exercice ne porte aucun solde à reporter. » / « Les à-nouveaux ne s'équilibrent pas… » / « Les à-nouveaux de <année> sont déjà validés. Contre-passe-les si le report a changé. » | ouverture de l'exercice suivant (9.8.0) | contre-passer, ou corriger la balance | Livré |
| `ERR-CAB-063` | « Cet exercice ne porte aucun à-nouveau : il n'y aurait rien à envoyer au client. » | `.skanclose` (9.8.0) | — | Livré |
| `ERR-CAB-070` | « <Nom> a le rôle « <rôle> » sur ce dossier : ce geste demande « <rôle exigé> ». <Qui> peut le faire. » / « Ce poste ne dit pas qui travaille dessus. Choisis ton nom dans les Réglages, panneau « Collaborateurs ». » | droits par dossier (9.9.0), porte unique `droitBlock` | demander à qui a le rôle, ou se déclarer | Livré |
| `ERR-CAB-071` | « Un collaborateur a besoin d'un nom d'au moins deux caractères. » / « « <nom> » existe déjà : deux personnes du même nom ne se distingueraient pas dans la piste d'audit. » / « Seul un superviseur ajoute ou retire un collaborateur. » / « C'est le seul superviseur du cabinet : le retirer fermerait la porte de l'intérieur. » | gestion de l'équipe (9.9.0) | corriger le nom, ou demander à un superviseur | Livré |
| `ERR-CAB-072` | « Ce livre appartient à un autre dossier. » / « Ce livre porte l'exercice <n>, pas <m>. » / « Ce fichier ne s'ouvre pas avec le mot de passe de ce cabinet. » / « Impossible de réunir les deux versions de ce livre : <motif>. » | fusion de deux postes (9.9.0) | choisir le bon fichier | Livré |
| `ERR-ENT-080` | « Ce fichier n'a pas pu être lu. » / « Ce fichier n'est pas un dossier de clôture SkanFact. » / « Le dossier de clôture est abîmé. » | import d'un `.skanclose` (9.8.0) | redemander le fichier au cabinet | Livré |
| `ERR-ENT-081` | « Ce dossier de clôture est protégé par un mot de passe… » (l'application le DEMANDE au lieu d'afficher du rouge) / « Mot de passe incorrect, ou paquet modifié depuis son envoi. » | import d'un `.skanclose` (9.8.0) | le mot de passe, dit au téléphone | Livré |
| `ERR-CAB-073` | « Aucun compte désigné. » / « Une note de revue sans texte n'apprend rien. » / « Cette note de revue n'existe plus. » / « Cette question n'existe plus. » | dossier de révision (9.10.0) | rouvrir l'écran, la fiche a bougé | Livré |
| `ERR-CAB-074` | « Une question sans texte n'apprend rien au client. » / « Cette question a reçu sa réponse : elle ne se réécrit plus. » / « Cette question est déjà partie chez le client : elle se ferme, elle ne s'efface pas. » / « Aucune question n'attend de réponse : il n'y aurait rien à envoyer. » | questions au client (9.10.0) | fermer au lieu d'effacer, ou poser une question d'abord | Livré |
| `ERR-CAB-075` | « La nature de ce retraitement n'est pas connue. » / « Un retraitement sans libellé ne s'explique pas devant un contrôle. » / « Le montant doit être positif : c'est la NATURE qui dit dans quel sens il joue. » / « Le taux d'impôt se donne en pourcentage, entre 0 et 100. » | résultat fiscal annuel (10.0.0) | corriger la ligne, ou vider le taux | Livré |
| `ERR-ENT-082` | « Ce dossier de clôture ne porte aucun document à ouvrir. » | états d'une clôture reçue (9.8.0) | — | Livré |
| `ERR-ENT-083` | « Ce fichier n'a pas pu être lu. » / « Ce fichier n'est pas un envoi de questions SkanFact. » / « Ce fichier ne contient aucune question. » / « L'envoi de questions est abîmé. » | import d'un `.skanask` (9.10.0) | redemander le fichier au cabinet | Livré |
| `ERR-ENT-084` | « Cet envoi de questions est protégé par un mot de passe… » (l'application le DEMANDE au lieu d'afficher du rouge) / « Mot de passe incorrect, ou fichier modifié depuis son envoi. » | import d'un `.skanask` (9.10.0) | le mot de passe, dit au téléphone | Livré |
| `ERR-ENT-085` | « Le disque est plein : rien n'a été enregistré… » et les neuf autres phrases de `PANNES_DISQUE` (quota, accès refusé, lecture seule, fichier occupé, dossier introuvable, disque muet, trop de fichiers ouverts) | **toute** panne système, posée UNE fois dans l'enveloppe d'`ipcMain.handle` (10.0.1) | libérer de la place, fermer l'autre programme, rebrancher le support — la phrase le dit | Livré |
| `ERR-CAB-076` | les mêmes dix phrases, table identique au caractère près (un test compare les deux corps) | **toute** panne système du Cabinet, même enveloppe (10.0.1) | idem | Livré |
| `ERR-CAB-077` | « Un import de paquets est déjà en cours. Attends qu'il finisse — ou arrête-le depuis la fenêtre d'avancement — avant d'en lancer un second. » | seconde entrée simultanée dans `cab:importPack` (10.0.1) | attendre, ou arrêter l'import en cours | Livré |

---

## Partie 11 — Tests

### 11.1 Tests existants (Livré, commit `d7bfc54`)

- `npm test` = `node test/run-tests.js` : **384 vérifications** (376 `t(` synchrones + 8 `await ta(`
  asynchrones ; `t()` **refuse** une fonction asynchrone, `ta()` compte les en-cours et refuse de
  conclure s'il en reste). Durée : ≈ 30 s sur la machine de développement (À VÉRIFIER sur la CI
  Windows). Catégories par préfixe du nom (les plus fournies) : `cabinet` 34, `l'interface…` 19,
  `plateforme` 13, `cabstore` 12, `licence` 11, `statistiques` 9, `achats` 8, `stockage` 7, `P 0.2`
  7, `trésorerie` 6, `stock` 6, `relais` 6, `fusion` 5, `clôture` 5, `8.8.0` 5, `8.7.0` 5, `8.4.0` 5,
  `écritures` 4, `9.0.0` 4, `8.9.0` 4, `retenue à la source` 3, `TVA` 3, `paquet` 3, `bulletin` 3…
- Trois familles : **calcul** (purs, sans Electron : totaux, TVA, écritures, paie, immos, fusion,
  licence, zip, worker par `await import`), **source** (relisent `app.js`/`main.js`/`style.css` sans
  les commentaires, par **structure** — jamais une mention —, et se prouvent en réintroduisant le
  défaut), **plateforme** (le vrai worker sur une base D1 posée sur le SQLite de Node,
  `test/d1-sqlite.js`, schéma `schema-a-coller.sql`).
- **42 fichiers e2e** (`test/e2e/`, 41 scripts npm + `harnais.js`) : Playwright `_electron`,
  `--user-data-dir` temporaire, `journal()` d'étapes, `surveiller(win)` qui capture les erreurs de
  console ; sous `xvfb-run -a` ; un seul à la fois ; sortie vers un fichier quand un test paraît
  bloqué. Le tableau complet est dans `CLAUDE.md` (« Les tests qui ouvrent vraiment l'application »).
- Règles : chaque écran se reconnaît à ce qu'il **contient**, jamais à son rang ; une fermeture
  d'application passe sous `Promise.race` ; **tout correctif de test se prouve en réintroduisant le
  défaut** ; une assertion sur un montant se calcule à la main avant de lire le code.

### 11.2 Tests à écrire — 9.1.0

| Test | Type | Identifiant | Ce qu'il vérifie | Ce qu'il prouve (défaut réintroduit) |
|---|---|---|---|---|
| `compta : ecritureValide refuse sept motifs` | calcul | TEST-9.1.0-001 | déséquilibre, une ligne, compte vide, d et c sur une ligne, montant négatif, date absente, journal vide | retirer un contrôle → le motif n'est plus rendu |
| `compta : entreesDepuisCsv lit par NOM de colonne` | calcul | TEST-9.1.0-002 | colonnes permutées, BOM, `1234,567`, `;` dans un libellé entre guillemets | associer par position → montant dans Tiers |
| `compta : entriesBalance et entriesByAccount identiques à core` | calcul | TEST-9.1.0-003 | mêmes résultats sur `journalEntries(demo)` avant/après déplacement | modifier une ligne du corps → écart |
| `compta : balanceDepuisLignes — trois paires de totaux égales` | calcul | TEST-9.1.0-004 | 24 mois de l'exemple, avec et sans ouverture | ne plus reporter l'ouverture → paires inégales |
| `compta : le grand livre finit sur le solde de la balance` | calcul | TEST-9.1.0-005 | chaque compte, dernier solde progressif = solde balance | oublier l'ouverture dans le progressif |
| `compta : journalDepuisLignes numérote 1..n sans trou` | calcul | TEST-9.1.0-006 | pièces triées (date, piece), numéros continus | trier par journal → trou |
| `compta : lettrageDepuisLignes — reste ouvert = solde du compte` | calcul | TEST-9.1.0-007 | sur l'exemple, 411 et 401 | sauter une facture couverte par avoir (8.9.0) |
| `compta : round3 identique à core` | source | TEST-9.1.0-008 | corps des deux `round3` égaux | changer l'un |
| `compta : chargé avant core dans les deux index.html et dans cabinet.config.js` | source | TEST-9.1.0-009 | ordre des `<script>`, entrée `files` | retirer la balise / l'entrée |
| **`parité : la balance du Cabinet égale celle de l'entreprise au millime`** | calcul | TEST-9.1.0-010 | `balanceGenerale(data)` vs `balanceDepuisLignes(journalEntries(data))`, 24 mois, 12 périodes | arrondir différemment d'un côté |
| `licence : options lues, essai = ['compta']` | calcul | TEST-9.1.0-011 | format 3, format 2 sans options, chaîne non tableau | ne plus filtrer → `options` = string |
| `modules : compta.livres masqué même quand modules est null ; compta toujours visible` | calcul | TEST-9.1.0-012 | `moduleOn({company:{modules:null}}, 'compta.livres') === false`, `moduleOn(…, 'compta') === true` ; `moduleWhy` rend `'option'` ; `COMPTA_TABS` filtré | traiter null comme « tout » |
| `optionBlock : posé sur chaque onglet de sousModules[0].onglets et nulle part ailleurs` | source | TEST-9.1.0-013 | la tranche de `routes.compta`, onglets lus dans `core.js` — jamais recopiés | retirer un appel / en poser sur `ecritures` |
| `optionBlock : ne ferme jamais ecritures, tva, clotures, cabinet, ventes, achats, calendrier` | source | TEST-9.1.0-014 | liste lue dans `COMPTA_TABS` moins les onglets de l'option | poser l'appel |
| `garde-fou : error et unhandledrejection avant le démarrage, IPC support:erreur, jamais de fenêtre` | source | TEST-9.1.0-015 | les deux renderers, les deux main.js ; pas de `showMessageBox` dans le handler | déplacer après le démarrage / ajouter une fenêtre |
| `journal : main.log tourne à 2 Mo, une seule fois` | calcul (fs temporaire) | TEST-9.1.0-016 | 2,1 Mo écrits → `main.log.1` existe, `main.log` repart | retirer la rotation |
| `relais : cabinet-beta.yml accepté sur le canal cabinet, refusé sur app` | calcul | TEST-9.1.0-017 | `fichierAutorise` | l'ajouter au mauvais canal |
| `cabinet : allowDowngrade posé APRÈS channel, cabinet-beta selon cfg.beta` | source | TEST-9.1.0-018 | ordre des deux lignes | inverser |
| `cabinet : la clé de secours est réclamée au premier import, « pas maintenant » une fois` | e2e `cabinet` | TEST-9.1.0-019 | fenêtre → import → seconde fenêtre sans « pas maintenant » | retirer le drapeau |
| `cabinet-livres (e2e)` | e2e nouveau | TEST-9.1.0-020 | quatre onglets sur un vrai paquet ; mois manquant nommé ; paquet ancien dit ; export nommé par l'onglet ; colonnes alignées (`colonnes.js` étendu) | — |
| `boucle (e2e) : les livres apparaissent après l'import` | e2e | TEST-9.1.0-021 | le bloc `#c-compta` après le paquet | — |
| `charge : les quatre seuils` | script | TEST-9.1.0-022 | SPEC-OUT-006 | dépasser un seuil → exit 1 |
| `ci : ci.yml existe, lance lint et test sur ubuntu et windows` | source | TEST-9.1.0-023 | YAML lu | retirer une matrice |
| `lint : npm run lint passe` | CI | TEST-9.1.0-024 | — | — |

| `émission : deux clics sur Émettre ne consomment qu'un numéro` | e2e `editeur` | TEST-9.1.0-025 | `data-busy` + `isIssued` ; un seul `FAC-AAAA-NNN`, un seul toast | retirer le garde |

### 11.3 Tests à écrire — 9.1.1

| Test | Type | Identifiant | Ce qu'il vérifie | Défaut réintroduit |
|---|---|---|---|---|
| `timbre : un client exonéré décoche le timbre à la création, pas à l'affichage` | calcul | TEST-9.1.1-001 | `applyClientDefaults` copie `stampExempt` ; une pièce émise avec timbre le garde après coche du client | relire le client dans `computeTotals` |
| `timbre : stampExempt sur avoir et proforma n'ajoute jamais de timbre` | calcul | TEST-9.1.1-002 | — | — |
| `retenue : le seuil vaut 0 par défaut et 0 ne prévient jamais` | calcul | TEST-9.1.1-003 | `seuilRetenue({}) === 0` ; `issueWarnings` vide | défaut 1000 |
| `retenue : sous le seuil avec un taux > 0, un avertissement — jamais un refus` | source + calcul | TEST-9.1.1-004 | `issueWarnings` contient le message ; `issue()` ne bloque pas | transformer en `return` |
| `retenue : un seuil négatif est ignoré` | calcul | TEST-9.1.1-005 | (leçon 8.3.0 : `Number('') === 0` rend l'assertion évidente inutile) | — |
| `TFP : proposée seulement si le métier en porte une, jamais écrite sans le comptable` | calcul + source | TEST-9.1.1-006 | `tfpSuggere('informatique') === null` ; aucune valeur numérique `tfp:` dans `ACTIVITIES` tant que la colonne n'est pas validée (le test **échoue** si on en écrit une sans retirer la garde) | — |
| `TFP : le champ touché n'est plus écrasé` | e2e `metier` | TEST-9.1.1-007 | motif `regimeTouche` | — |
| `guide : les clés client.stampExempt, company.withholdingThreshold existent` | source | TEST-9.1.1-008 | test de couverture existant, étendu | — |
| `e-facture : docs/e-facture-controle.md existe et liste chaque champ avec oui/non` | source | TEST-9.1.1-009 | — | — |
| `csv : une cellule texte qui commence par = + - @ tabulation ou retour est préfixée d'une apostrophe` | calcul | TEST-9.1.1-010 | `toCsv` (core) et `toCsvLine` (cabcore) : `=1+1` → `'=1+1` ; une colonne `money`/`date` n'est **jamais** touchée (`-12,500` reste un montant) ; le nom d'un client « -Alpha » passe par la parade | retirer le préfixe |

### 11.4 Tests à écrire — 9.2.0

| Test | Type | Identifiant | Ce qu'il vérifie | Défaut réintroduit |
|---|---|---|---|---|
| `livre : livreVide, isValidLivre, format inconnu refusé sans écriture` | calcul | TEST-9.2.0-001 | `format: 2` → `ERR-CAB-020`, fichier intact | accepter |
| `livre : Σd = Σc pour chaque écriture, sinon elle n'entre pas` | calcul | TEST-9.2.0-002 | `ajouterEcriture` refuse | — |
| `livre : le numéro s'attribue à la validation, continu, jamais au brouillard` | calcul | TEST-9.2.0-003 | 3 brouillards, valider 2, 1, 3 → numéros 1, 2, 3 par ordre de validation | numéroter à l'ajout |
| `livre : une validée ne se modifie pas ; contre-passer produit le miroir` | calcul | TEST-9.2.0-004 | `ERR-CAB-025` ; lignes inversées, `contrepasseDe` | — |
| `livre : importerPaquet remplace les brouillards du mois, jamais une validée, et rend les écarts` | calcul | TEST-9.2.0-005 | mois renvoyé avec une ligne changée | écraser la validée |
| `livre : un compte inconnu entre au plan en source import, jamais un refus silencieux` | calcul | TEST-9.2.0-006 | — | ignorer la ligne |
| `livre : lettrer exige une somme nulle ; delettrer` | calcul | TEST-9.2.0-007 | — | — |
| `livre : la balance d'ouverture devient UNE écriture AN OUVERTURE` | calcul | TEST-9.2.0-008 | — | deux écritures |
| `livre : audit jamais purgé` | calcul | TEST-9.2.0-009 | 1 000 actions → 1 000 entrées | — |
| `plan : import CSV par nom de colonne, nature déduite de la classe, ligne invalide nommée` | calcul | TEST-9.2.0-010 | SPEC-FMT-008 | — |
| `balance d'ouverture : refusée si déséquilibrée, avec l'écart` | calcul | TEST-9.2.0-011 | SPEC-FMT-009 | — |
| `parité : la balance du livre égale celle de l'entreprise (12 paquets importés)` | calcul | TEST-9.2.0-012 | jumeau de TEST-9.1.0-010 sur `livre.json` | — |
| `signature : signature.json signe les octets exacts du manifeste` | calcul | TEST-9.2.0-013 | modifier un octet → `verify` faux | signer une re-sérialisation |
| `signature : épinglage au premier paquet, refus à la seconde clé, refus du non-signé après signé` | calcul (cabcore) | TEST-9.2.0-014 | trois cas | — |
| `signature : un paquet non signé sur un dossier jamais signé est accepté et marqué` | calcul | TEST-9.2.0-015 | `signature: 'absente'` | refuser |
| `manifeste : format 2 porte licence et essai ; le Cabinet lit 1 et 2` | calcul | TEST-9.2.0-016 | — | — |
| `clé client : jamais dans skanfact-data.json, jamais dans le paquet` | source + calcul | TEST-9.2.0-017 | `packPlan` ne liste pas `cle-client.json` ; `DEFAULT_DATA` ne porte pas `privateKey` | — |
| `cabstore : sauvegardes, copie externe et récupération emportent livre-*.json` | calcul | TEST-9.2.0-018 | — | — |
| `refus (e2e) : deux cas d'imposture` | e2e `cabinet-refus` | TEST-9.2.0-019 | signé par une autre clé (nommé) ; non signé après signé | — |
| `cabinet (e2e) : reprise par balance, import de douze paquets, mois renvoyé avec écart, valider, contre-passer` | e2e | TEST-9.2.0-020 | — | — |
| `perte, demenagement (e2e) : les livres reviennent` | e2e | TEST-9.2.0-021 | — | — |
| `charge : rejoué sur le format réel` | script | TEST-9.2.0-022 | — | — |
| `signature : un manifeste retouché d'un octet donne « modifié après l'envoi », pas « signature inconnue »` | e2e `refus` | TEST-9.2.0-023 | l'empreinte est comparée AVANT `verify` ; la phrase est la variante (a) de 5.3 | inverser les deux étapes |

---

### 11.5 Correspondance fichier → script, et ce que chaque parcours prouve (v1, point 14)

Le tableau « ce que chaque e2e prouve » existe déjà dans `CLAUDE.md` (§ « Les tests qui ouvrent
vraiment l'application ») et n'est **pas recopié** ici — deux tables divergent toujours. Ce qui lui
manquait, et que voici : la correspondance entre le nom du script et le fichier, lue dans
`package.json` (41 scripts, 41 fichiers + `harnais.js` = 42). Les durées ne sont **pas** données :
elles dépendent de la machine, aucune n'a été mesurée sur Windows, et un chiffre inventé serait pris
pour une mesure (14.3, point 3).

| Script | Fichier | Ouvre Electron ? | Applications |
|---|---|---|---|
| `e2e:cabinet` | `cabinet.js` | oui | cabinet |
| `e2e:boucle` | `boucle-complete.js` | oui, **deux** | entreprise → cabinet |
| `e2e:entreprise` | `entreprise.js` | oui | entreprise |
| `e2e:refus` | `cabinet-refus.js` | oui | cabinet |
| `e2e:gel` | `chien-de-garde.js` | oui | entreprise |
| `e2e:perte` | `cabinet-perte.js` | oui | cabinet |
| `e2e:couches` | `cabinet-couches.js` | oui | cabinet |
| `e2e:demenagement` | `cabinet-demenagement.js` | oui, deux postes | cabinet |
| `e2e:barre` | `barre-laterale.js` | oui | entreprise |
| `e2e:captures` | `captures.js` | oui | entreprise |
| `e2e:exemple` | `exemple.js` | oui | entreprise |
| `e2e:reglages` | `reglages.js` | oui | entreprise (absent du tableau de `CLAUDE.md`) |
| `e2e:argent` | `argent.js` | oui | entreprise + cabinet |
| `e2e:contraste` | `contraste.js` | oui | entreprise |
| `e2e:erreur` | `erreur.js` | oui | entreprise |
| `e2e:apercu` | `apercu.js` | oui | entreprise |
| `e2e:entreprises` | `entreprises.js` | oui | entreprise |
| `e2e:cliquable` | `cliquable.js` | oui | entreprise |
| `e2e:chiffres` | `chiffres.js` | oui | entreprise |
| `e2e:repondre` | `repondre.js` | oui | entreprise |
| `e2e:accueil` | `accueil.js` | oui | entreprise |
| `e2e:editeur` | `editeur.js` | oui | entreprise |
| `e2e:fiches` | `fiches.js` | oui | entreprise |
| `e2e:compta` | `compta.js` | oui | entreprise |
| `e2e:metier` | `metier.js` | oui | entreprise |
| `e2e:retenue` | `retenue.js` | oui | entreprise |
| `e2e:colonnes` | `colonnes.js` | oui | entreprise + cabinet |
| `e2e:aide` | `aide.js` | oui | entreprise |
| `e2e:entetes` | `entetes.js` | oui | entreprise |
| `e2e:beta` | `beta.js` | oui | entreprise |
| `e2e:depot` | `depot.js` | oui (bascule `src/depot.js`, restauré en `finally`) | entreprise |
| `e2e:partage` | `partage.js` | oui, deux profils | entreprise |
| `e2e:actions` | `actions.js` | oui | entreprise + cabinet |
| `e2e:parametres` | `parametres.js` | oui (instrument, pas un test) | entreprise + cabinet |
| `e2e:pages` | `pages.js` | **non** (chromium seul) — le seul en CI | entreprise |
| `e2e:console` | `console.js` | non (vrai worker + navigateur) | plateforme |
| `e2e:licence` | `licence.js` | oui, deux (désarmée puis armée) | entreprise |
| `e2e:plateforme` | `plateforme.js` | oui + vrai worker | entreprise + plateforme |
| `e2e:justificatif` | `justificatif.js` | oui | entreprise |
| `e2e:pont` | `pont.js` | oui + vrai worker | entreprise + plateforme |
| `e2e:livres` | `livres.js` | oui | entreprise |

Tous se lancent sous `xvfb-run -a` sur une machine sans écran, **un seul à la fois** (deux `xvfb-run`
simultanés se disputent le serveur X, 7.16.0), et exigent `npm i -D playwright` (pas une dépendance
du projet). `SKANFACT_DOSSIER_CLES` est posé vide par le harnais pour **tous** les parcours : aucun ne
tourne jamais armé avec la clé de l'éditeur.

## Partie 12 — Migrations

| Identifiant | Version | Source → cible | Fichiers | Étapes | Rollback |
|---|---|---|---|---|---|
| MIG-hist | 1.4 → 6 | `version` 1…5 → 6 | `skanfact-data.json` | Livré, `migrateData` : « payée » → paiement (1.4) ; listes v4/v5/v6 créées vides ; devise ramenée dans la liste ; timbre gelé sur les pièces émises (7.1.1) ; idempotente | aucun : une v6 relue par une version antérieure ignore les listes inconnues |
| **MIG-9.1.0-001** | 9.1.0 | v6 → **v6** (inchangé) | `skanfact-data.json` | **Aucune migration.** `company.modules` ne change pas ; le masquage de `compta.livres` est une règle de `moduleOn` (la chaîne n'y est pas → masqué), pas une donnée. La clé format 3 est **compatible** (champ ignoré par 9.0.0). | rien à défaire |
| MIG-9.1.0-002 | 9.1.0 | — | `cabinet-data.json` | `settings.cleSecoursReporteeLe` **(fac.)** : `migrate` le pose à `null` s'il manque | retirer la clé |
| MIG-9.1.0-003 | 9.1.0 | — | `app-config.json` (Cabinet) | `beta` **(fac.)** lu par le canal `cabinet-beta` | — |
| MIG-9.1.1-001 | 9.1.1 | v6 → v6 | `skanfact-data.json` | `client.stampExempt` **(fac., false)**, `company.withholdingThreshold` **(fac., 0)**, `payrollSettings.tfpTouche` **(fac.)** — `migrateData` n'écrit rien ; la lecture tolère l'absence | supprimer les champs (aucun effet sur les pièces émises : le timbre y est gelé) |
| **MIG-9.2.0-001** | 9.2.0 | « pas de livre » → `livre.json` format 1 | `userData/dossiers/<client>/livre-<AAAA>.json`, `livre-index.json` | (1) **Sauvegarde nommée `avant-9.2.0`** de `cabinet-data.json` et de tous les paquets (`backupNow`) ; (2) pour chaque dossier avec paquets, pour chaque mois **par ordre chronologique** : ouvrir le paquet (`openWithCabinetKey`), lire `journaux/ecritures.csv` → `entreesDepuisCsv` → `importerPaquet(livre, mois, lignes, definitif)` ; l'exercice est créé au premier mois (année civile par défaut) ; (3) `audit` « relecture des paquets reçus (9.2.0) » ; (4) un paquet illisible est **noté** (`paquetsIllisibles`) et n'arrête rien ; (5) `livre-index.json` écrit ; (6) `cabinet-data.json` n'est **pas** modifié (le livre est à côté) ; (7) la relecture est **rejouable** (`importerPaquet` remplace les brouillards, ne touche pas les validées — donc un second passage ne double rien). Durée : `setImmediate` entre deux paquets, avancement affiché (règle 6.8.1). | supprimer `livre-*.json` et `livre-index.json` du dossier : le Cabinet 9.1.x relit les paquets comme avant. Rien d'autre n'a bougé. |
| MIG-9.2.0-002 | 9.2.0 | — | `cabinet-data.json` | `dossiers[].clePublique`, `cleEpingleeLe`, `cleEmpreinte` **(fac.)** ; `packs[].signature` **(fac.)** | retirer les champs ; les paquets déjà reçus restent « origine non prouvée » |
| MIG-9.2.0-003 | 9.2.0 | — | `<dossier>/cle-client.json` (entreprise) | créée **à l'appairage** ou à la première fabrication de paquet si absente ; jamais dans les données | supprimer le fichier : la 9.1.x fabrique un paquet non signé (format 1) |
| MIG-9.2.0-004 | 9.2.0 | manifeste 1 → 2 | `.skanpack` | écrit par 9.2.0 ; lu par Cabinet 9.2.0 ; un Cabinet 9.1.x le refuse `ERR-CAB-004` — c'est voulu et dit | — |

---

## Partie 13 — Conventions de code

- **Fichiers** : `src/renderer/<nom>.js` en minuscules, un mot (`core.js`, `compta.js`, `rowmenu.js`,
  `reglages.js`) ; tests `test/run-tests.js` (un seul fichier, à découper par domaine en 9.6.1),
  e2e `test/e2e/<nom>.js` (nom = le script npm `e2e:<nom>`).
- **Fonctions** : camelCase ; le neuf en français (`livreJournal`, `versReglages`, `panneau`) ;
  l'existant anglais **ne se renomme pas**. Constantes en `MAJUSCULES_SOULIGNÉES`. Un identifiant DOM
  en kebab-case (`#c-tabs`, `#p-licence`), un attribut de test `data-tab`/`data-act`/`data-check`.
- **Variables** : `const` par défaut, `let` sinon, `var` jamais ; accents autorisés (`ignorés`,
  `définitif`) — le code est écrit pour être lu par quelqu'un qui pense en français.
- **Formatage** : 2 espaces, guillemets simples, point-virgule, lignes ≤ 120 caractères
  (les gabarits peuvent dépasser), `{ a, b }` avec espaces, pas de virgule finale obligatoire.
- **Commentaires** : ils expliquent le **pourquoi** et la règle apprise, jamais le quoi (« Un montant
  négatif change de colonne, il ne garde pas son signe. ») ; pas de backtick dans un commentaire à
  l'intérieur d'un template literal ; pas de mention d'un appel interdit dans un commentaire (les
  tests retirent les commentaires avant de juger, mais un lecteur, non).
- **Structure d'un fichier neuf** (partagé) : en-tête de 5 à 15 lignes (ce que c'est, pourquoi il
  existe, ce qu'il ne fait pas) → IIFE UMD → constantes → utilitaires privés → fonctions métier → `return
  { … }` trié par famille. Pas d'`import`/`export` ES dans `src/` (sauf `.mjs` de `plateforme/` et
  `worker/`).
- **Gabarits** : `h()` (app.js) / `esc()` (cabinet) sur **toute** interpolation ; `[hidden]` est
  global (`display:none !important`) ; une classe propre au cabinet ne porte jamais un nom déjà pris
  dans `style.css` (test) ; tout CSS neuf en **propriétés logiques** (`padding-inline-start`,
  `text-align: end`).
- **Interdit** : `var`, `==`/`!=` (sauf `== null`), `eval`, `new Function`, `innerHTML +=`,
  `required` dans une fenêtre modale (inerte — une étoile et `refus()`), `bindSort(root, () =>`,
  `navigate()` dans une table d'actions (`vers()`), une liste de statuts comparée à une chaîne
  (`docFiltre`), un nombre magique fiscal, `Date.now()`/`Math.random()` dans un test de source, une
  `toast` comme premier message, un `catch {}` muet sur une erreur qui concerne l'utilisateur.
- **Un fichier partagé** se déclare : balise dans les deux `index.html`, entrée dans `files` de
  `build/cabinet.config.js`, et un test qui l'exige. Un IPC neuf : `ipcMain.handle('espace:action')`
  dans `main.js`, exposé dans `preload.js` sous `window.skanfact.<espace>.<action>`, jamais `state`
  brut côté cabinet (`safeState()`).
- **Toute nouveauté** vient avec sa bulle `guide.js`/`cabguide.js` (test de couverture), une entrée
  `CHANGELOG.md` datée, le bump `package.json`, et — si elle change une habitude — un paragraphe
  d'aide.
- **Nommage CSS (v1, point 15)** — ce qui existe est nommé, pas réinventé : classes en kebab-case,
  courtes, sans préfixe dans `style.css` (`.btn`, `.btn-primary`, `.badge`, `.modal-bg`, `.page-head`,
  `.scroll-x`, `.help-fil`, `.th-…`) ; **préfixe `wiz-`** pour l'assistant du cabinet (renommé en
  6.8.0 après la collision `.setup-card`), il reste ; états par attribut (`[hidden]`, `data-busy`,
  `data-tab`, `data-act`) plutôt que par classe `.is-…` ; couleurs par variables CSS (`--accent`…),
  jamais un hex dans un gabarit ; les couleurs de thème vivent dans la feuille (7.27.0), jamais dans
  un `.js`. **Décision pour le neuf du Cabinet** : toute classe créée dans `cabinet.css` porte le
  préfixe **`cab-`** (`.cab-livre`, `.cab-brouillard`) — c'est ce qui rend le test « aucune classe du
  cabinet ne porte un nom déjà pris dans `style.css` » trivialement vrai au lieu de le prouver
  classe par classe. L'existant (`wiz-*`, `.cab-…` déjà présents) **ne se renomme pas**.
- **Pourquoi chaque interdiction (v1, point 16)**, une ligne chacune : `var` (portée de fonction :
  une variable « fuit » hors de son bloc, 7.20.0 a vu une ReferenceError d'une autre route) ;
  `==` (coercition : `'' == 0`, et `Number('') === 0` a déjà fait passer une assertion vide, 8.3.0) ;
  `eval`/`new Function` (du code venu d'une donnée : un paquet, un CSV — c'est une porte) ;
  `innerHTML +=` (re-sérialise tout le sous-arbre : les gestionnaires posés sont perdus, et la couche
  du dessous d'une fenêtre modale avec eux, 2.4.0) ; `required` en modale (rien ne soumet, l'attribut
  est inerte depuis toujours, 7.20.0) ; `bindSort(root, () =>` (le rappel jette la colonne, six
  en-têtes ne triaient pas, 7.17.0) ; `navigate()` dans une table d'actions (aucun `hashchange` sur
  la page courante, les entrées sont inertes depuis la page qu'elles visent, 7.15.0 / 7.29.0) ; une
  liste de statuts comparée à une chaîne (« Émis » rendait 2 avoirs au lieu de 27 pièces, 7.15.0) ;
  un nombre fiscal en dur (faux en silence à la loi de finances suivante, 5.0.0) ;
  `Date.now()`/`Math.random()` dans un test de source (un test non reproductible ne prouve rien) ;
  un toast comme premier message (2,6 s, pas cliquable, 7.0.0) ; un `catch {}` muet sur une erreur
  utilisateur (« Module de mise à jour indisponible » a condamné le dépannage à distance, 6.7.2).
- **Idempotence des gestes qui écrivent (v1, point 18 — un défaut réel)** : `issue()` dans app.js
  n'a **aucun** garde contre le double-clic. `$('#issue').onclick` est `async` (il attend
  `confirmDialog`), et deux clics avant la réponse ouvrent deux dialogues ; deux « Émettre » à la
  suite passent `nextNumber` deux fois sur le même `doc` (le second trouve `doc.number` posé et ne
  renumérote pas — mais `persist()` et le toast partent deux fois, et `annoncerFacturesConsole` avec
  eux). Règle, **Cible 9.1.0** : tout bouton dont le gestionnaire écrit pose `data-busy` sur lui-même
  avant le premier `await` et le retire dans un `finally` ; un gestionnaire qui trouve `data-busy`
  déjà posé **retourne sans rien faire** ; `issue()` revérifie `isIssued(doc)` (numéro posé **et**
  statut émis) après la question et avant `nextNumber`. Les gestes de liste (`RowMenu`) et les
  formulaires modaux (`b.disabled = true` est déjà posé dans dix fenêtres, pattern à généraliser)
  suivent la même règle. TEST-9.1.0-025 (e2e `editeur`) clique deux fois « Émettre » en 50 ms et
  exige **un** numéro consommé, **un** toast, **une** écriture.

---

## Partie 14 — Annexes

### 14.1 Exemples complets

- `skanfact-data.json` : SPEC-DATA-001. `cabinet-data.json` : SPEC-DATA-004. `livre.json` :
  SPEC-DATA-005. Manifeste : SPEC-FMT-001. `.skanpair` : SPEC-FMT-002. `licences-publiques.json` :
  SPEC-DATA-006.
- **Plan de comptes (CSV, SPEC-FMT-008)** :

```
Compte;Libellé;Nature;Parent
411;Clients;tiers;
411001;Client Test;tiers;411
532;Banque;tresorerie;
706;Prestations de services;gestion;
4367;TVA collectée;bilan;
```

- **Balance d'ouverture (CSV, SPEC-FMT-009)** :

```
Compte;Libellé;Débit;Crédit
532;Banque;12500,000;0,000
411001;Client Test;1191,000;0,000
101;Capital;0,000;10000,000
12;Report à nouveau;0,000;3691,000
```

- **`signature.json` (SPEC-FMT-005)** :

```json
{ "format": 1, "alg": "ed25519", "cle": "MCowBQYDK2VwAyEA…", "empreinte": "A1B2-C3D4-E5F6-A7B8-C9D0",
  "manifeste": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", "sig": "b64url…" }
```

### 14.2 Arborescence du dépôt (commit `d7bfc54`)

```
.github/workflows/release.yml      build/{icon.png, icon-cabinet.png, cabinet.config.js, licences-publiques.json, licence-public.json, release-notes.md, skanpack.{icns,ico,png}, skanrecover.{icns,ico,png}}
src/{main.js, preload.js, storage.js, zip.js, licence.js, depot.js, mac-update.sh}
src/renderer/{index.html, core.js, app.js, demo.js, guide.js, onboarding.js, rowmenu.js, reglages.js, style.css}
src/cabinet/{main.js, cabcore.js, cabstore.js, preload.js, renderer/{index.html, app.js, cabguide.js, cabinet.css}}
plateforme/{skanfact-api.mjs, schema.sql, schema-a-coller.sql, README.md, DNS-skanfact-tn.md}
worker/{skanfact-maj.mjs, README.md}      scripts/{release.js, release-notes.js, icones.js, licence.js}
test/{run-tests.js, d1-sqlite.js, e2e/ (42 fichiers)}
*.md : README, SECURITY, CHANGELOG, CLAUDE, DIRECTION, QUESTIONS, PLAN-DEVELOPPEMENT, PLAN-COMPTABLE, PLAN-CABINET, PLAN-PLATEFORME, PLAN-UX, ROADMAP, CAHIER-DES-CHARGES
Installer SkanFact.command · Installer SkanFact (Windows).bat · package.json · .gitattributes
```

`src/cabinet/` contient exactement `main.js, cabcore.js, cabstore.js, preload.js, renderer/`
(vérifié). `build/` vérifié en v1 (`ls build`) : `icon.icns`/`icon.ico` n'y sont **pas** commités —
ils sont fabriqués par `node scripts/icones.js` (6.8.1) ; seules les icônes de **fichiers**
(`skanpack.*`, `skanrecover.*`) le sont.

### 14.3 Ce que je n'ai pas pu vérifier

Chaque point se vérifie en moins d'une heure, par la commande indiquée. *(Huit points de la première
version de cette liste ont été vérifiés dans le code avant de rendre le document et intégrés là où
ils manquaient : l'ordre du format 1 de la clé, les champs du `Verdict`, les neuf ids de `MODULES`,
`isValidData`, le champ `integrity`, les deux index D1 uniques, le motif de `packFileName`, le
preload du Cabinet.)*

1. **Les identifiants des sous-vues de l'onglet Écritures** (livre-journal, OD, lettrage, 8.9.0) :
   mon extraction n'a pas trouvé de constante nommée ; `sed -n '8484,8700p' src/renderer/app.js`
   avant d'écrire `sousVues` de SPEC-FUNC-101.
2. ~~Les entrées/sorties exactes de chaque route~~ — **fait en v1** (7.1 bis, handlers lus lignes
   579 à 1 016) ; trois cellules de la v0 étaient fausses, corrigées.
3. **La durée de `npm test`** (≈ 30 s est une observation sur cette machine) et sur Windows.
4. **La TCL** et le périmètre exact de la déclaration mensuelle : rien dans le code ; c'est le
   comptable qui répond (Phase 5).
5. **Les métiers à TFP réduite** (`tfp` dans `ACTIVITIES`) : **aucune valeur ne doit être écrite
   sans le comptable** — le test TEST-9.1.1-006 l'exige.
6. **La faisabilité de stocker `cle-client.json` en 0600 sur Windows** (les modes POSIX n'y existent
   pas) — le fichier reste hors des données et hors du paquet, c'est la garantie principale.
7. **`npm run charge` sur un portable ordinaire** : les seuils sont ceux de `QUESTIONS.md` § 5, pas
   une mesure ; le premier run les confrontera à la réalité.
8. **Que Playwright 1.63 et Electron 43 se parlent sur la CI GitHub** (`e2e:pages` n'ouvre pas
   Electron, c'est pour ça qu'il est le seul en CI) — à confirmer au premier run.
9. ~~Les fichiers de `build/`~~ — **fait en v1** : `cabinet.config.js`, `icon-cabinet.png`, `icon.png`,
   `licence-public.json`, `licences-publiques.json`, `release-notes.md`, et les icônes de fichiers
   `skanpack.{icns,ico,png}`, `skanrecover.{icns,ico,png}` (l'arborescence 14.2 est complétée).

*Réponse à la question du document — « un développeur peut-il coder la 9.1.0 sans poser une seule
question ? » : oui pour SPEC-FUNC-100/101, SPEC-UI-ENT-001/002/003, SPEC-UI-CAB-001/002, SPEC-OUT-001
à 006 et les 24 tests de la Partie 11.2, à deux réserves près qu'il rencontrera en lisant le code :
le point 1 (les sous-vues de l'onglet Écritures), résolu par un `sed` sur `routes.compta`.*


---

## Partie 15 — Intentions 9.3.0 → 10.0.0, écran par écran (v1, point 2 ; v1.1 : Décidé / À décider par écran)

Ce ne sont **pas des spécifications** : chaque version se spécifie à son tour, après les réponses
du comptable qu'elle exige (`PLAN-COMPTABLE.md`, `QUESTIONS.md` § 16). Ce qui rend une intention
utile, c'est de savoir **écran par écran** ce qui est déjà tranché (et ne se rediscute pas) et ce
qui reste à décider — avec qui le décide. Les identifiants `SPEC-UI-CAB-0nn` et `SPEC-UI-ENT-1nn`
sont **réservés** ici et se remplissent le jour où la version s'écrit. Une version d'entretien n'a
pas d'écran : une ligne suffit. Le relecteur de chaque version est nommé dans `QUESTIONS.md` § 3.

**Les dizaines groupent les écrans d'une version ; elles ne nomment pas son numéro.** La v1 de ce
document les avait attribuées dans l'ordre des versions du jour (`01n` pour la saisie, `02n` pour la
banque, et ainsi de suite). La renumérotation du 16/09/2026 a décalé les versions d'un cran à partir
de la licence du Cabinet, **sans toucher aux identifiants** : la banque est la 9.5.0 et garde ses
écrans en `02n`. C'est voulu — un identifiant est fait pour être cité dans un commit et une revue,
et un identifiant qu'on renumérote ne sert plus à rien. Le numéro de version de chaque groupe est
écrit dans le titre qui le précède, et nulle part ailleurs.

**Les trois niveaux de spécification** (*Complète*, *Intention*, *Esquisse*) sont définis une seule
fois, dans `VERSIONS-A-VENIR.md`, sous son tableau récapitulatif. Les versions de cette partie sont
au niveau *Intention*, sauf la 10.0.0 qui est une *Esquisse*.

Lecture des tableaux : la colonne « Décidé » cite la règle et l'endroit où elle a été prise ; la
colonne « À décider » nomme **qui** tranche — *comptable* (une question à lui poser, listée dans
`PLAN-COMPTABLE.md` « Ce qu'il faut demander »), *Skander* (une décision de produit), *mesure* (on
regarde ou on mesure avant de choisir).

### 9.3.0 — la saisie

*Le comptable saisit au kilomètre dans un **brouillard**, puis valide : une écriture validée ne se
modifie plus (contre-passation).* Question qui bloque : « Quel est ton journal de banque : un par
compte, ou un seul ? » — et **regarder le comptable saisir** dans son logiciel actuel avant d'écrire
une touche.

**SPEC-UI-CAB-010 — la grille de saisie**

| Décidé | À décider |
|---|---|
| Tout au clavier : journal, date, pièce, puis lignes compte / tiers / libellé / débit / crédit ; la souris n'est jamais obligatoire (`QUESTIONS.md` § 16) | Les touches exactes (recopier la ligne du dessus, dupliquer, solder) : *mesure* — reprendre celles de son logiciel actuel plutôt qu'en imposer |
| Recherche de compte **par numéro ou par nom pendant la frappe** (`combo`, 2.3.0), sur le `plan[]` du livre | Mode « grille » (une ligne de tableau par ligne d'écriture) contre mode « pièce » (un formulaire par écriture) : *mesure* |
| Tab sur la dernière ligne **solde automatiquement** ; Entrée = ligne suivante ; valider depuis le dernier champ enchaîne sur la pièce suivante | Le journal proposé à l'ouverture (le dernier utilisé ? celui du mois ?) : *Skander* |
| Contrôle d'équilibre **en direct**, par `compta.ecritureValide` (l'`odValide` de 8.9.0 généralisé, sept motifs) ; une écriture déséquilibrée n'entre pas | La saisie de la date : jour seul dans le mois courant, ou date complète : *mesure* |
| L'écriture entre en `statut: 'brouillard'`, `numero: null` (SPEC-DATA-005) ; un seul auteur en 9.3.0 : le poste (`auteur`) | — |
| Pièce jointe glissée sur l'écriture → `pieceJointe`, rangée avec le dossier (jamais un chemin absolu) | — |

**SPEC-UI-CAB-011 — brouillard, validation, contre-passation**

| Décidé | À décider |
|---|---|
| « Valider » attribue `numero` (continu, par ordre de validation, jamais par date — invariant 3 de SPEC-DATA-005) ; **irréversible** ; `audit[]` reçoit qui / quand | Validation pièce par pièce, ou **par journal et par mois** en un geste : *comptable* (son habitude) |
| Une validée n'a ni « Modifier » ni « Supprimer » (SPEC-UI-CAB-005) ; seulement « Contre-passer » (miroir, `contrepasseDe`) et « Extourner » (miroir au 1er du mois suivant, `extourneDe`) | La date de la contre-passation : le jour du geste, ou la date de l'écriture d'origine : *comptable* |
| Un brouillard se modifie, se supprime, se cherche ; la pastille « brouillard » et l'italique le distinguent partout | Qui a le droit de valider : **livré en 9.9.0** (rôles par dossier, porte unique `droitBlock`) |
| Un mois **clôturé côté client** (paquet définitif) n'empêche pas une écriture du cabinet : ce sont deux clôtures (`DIRECTION.md`) | — |

**SPEC-UI-CAB-012 — guides d'écritures et abonnements**

| Décidé | À décider |
|---|---|
| Un **guide** = un journal + des lignes avec comptes et contrepartie, montants vides ou fixes ; il **préremplit**, il n'écrit pas | Le jeu de guides livré (loyer, salaires, achat avec TVA, STEG, honoraires…) : *comptable* |
| Un **abonnement** = un guide + une périodicité (mensuelle) ; il génère **en brouillard**, jamais une validée d'office | Les guides sont-ils **par cabinet** (partagés entre dossiers) avec surcharge par dossier, ou par dossier seulement : *Skander* — proposé : par cabinet, surcharge par dossier |
| **Ni l'un ni l'autre dans `livre.json`** (format figé) : les guides dans `cabinet-data.json` au niveau du cabinet, les abonnements sur le dossier (`dossiers[].abonnements`, fac.) | — |

**SPEC-UI-CAB-013 — recherche dans le journal, table de correspondance des comptes**

| Décidé | À décider |
|---|---|
| Recherche sur pièce, tiers, libellé et montant, à travers tous les journaux de l'exercice ; résultat = une liste d'écritures dont chaque ligne s'ouvre | — |
| La **correspondance des comptes** (compte SkanFact → compte du cabinet) s'applique **à l'import et à l'export**, jamais en réécrivant une validée (SPEC-DATA-005, invariant 4) | Correspondance par cabinet, par dossier, ou les deux (cabinet + exceptions par dossier) : *Skander* — proposé : les deux |
| Un compte SkanFact sans correspondance entre au plan avec `source: 'import'` et « Compte hors plan » (invariant 2), jamais un refus silencieux | — |

### 9.4.0 / P 0.3 — la licence du Cabinet

*Le Cabinet devient payant au-delà de trois dossiers hors SkanFact (`DIRECTION.md`).* Question qui
bloque : l'avis de l'Ordre (avant de vendre, pas avant de construire) et les prix.

**SPEC-UI-CAB-015 — Réglages → Licence du cabinet**

| Décidé | À décider |
|---|---|
| Une clé de type `cabinet`, sujet = l'**empreinte** du cabinet, quota `dossiersHors: N`, vérifiée hors ligne par `licence.js` et `build/licences-publiques.json` (qui entrent dans la construction du Cabinet, `build/cabinet.config.js`) | Le prix par dossier et les paliers : *Skander* (page Tarifs du site) |
| Ce qui est **compté** : les dossiers hors SkanFact actifs ; les trois premiers gratuits ; un dossier archivé ou sans écriture validée depuis douze mois **ne compte pas** ; la grâce de **douze mois** ne suit qu'une licence client **payée** (`QUESTIONS.md` § 3) | Le délai avant qu'un dossier désarchivé recompte (immédiat ? au mois suivant ?) : *Skander* |
| La porte unique est sur la **validation** (`licenceBlock` jumeau) : lire, importer, exporter, relancer restent libres — jamais de données en otage | — |
| Le bandeau à trois tons (`core.pastilleLicence`, 8.0.1), « À faire », « Demander une licence » : les mêmes mécanismes, pas des copies | — |
| Ce qui remonte au serveur : l'empreinte, le nombre de dossiers comptés, la version — jamais un nom de client (test « ce qui remonte », étendu) | — |

**SPEC-UI-CON-007 — la console, offre Cabinet**

| Décidé | À décider |
|---|---|
| Table `cabinets`, lien cabinet ↔ clients parrainés (`PLAN-PLATEFORME.md` § 15 bis) ; émettre, marquer payée, renouveler, **monter le quota au prorata** (`prorataOffre`, 8.2.0), révoquer | La vue « les dossiers de ce cabinet » : déduite des licences clients parrainées, ou déclarée par le cabinet : *Skander* |
| Postes illimités : on vend des dossiers (`DIRECTION.md`, tranché) | — |
| L'app entreprise (module Éditeur) tire et facture une vente de type cabinet comme les autres (8.7.0) | — |

### 9.4.10 — entretien

Pas d'écran. Electron du semestre, les 93 déclarations CSS physiques converties en logiques, le
premier découpage de `app.js` par route, `run-tests.js` par domaine, les codes `ERR-*` posés sur
chaque `throw`. **Aucune fonction nouvelle, par règle.** Tous les e2e relancés, sans exception.

### 9.5.0 — la banque

*Importer un **relevé** et rapprocher automatiquement ce qui correspond ; le reste à la main.*
Question qui bloque : « Quelles banques, et quel format d'export chacune donne-t-elle ? » (un
importeur par format, chacun testé sur un fichier réel anonymisé).

**SPEC-UI-CAB-020 — importer un relevé** — *livré en 9.5.0 ; les « à décider » ci-dessous sont tranchés dans la colonne de droite*

| Décidé | À décider |
|---|---|
| Colonnes associées **par nom, jamais par position** (règle 6.8.0) ; un objet `releves[]` **par fichier** (SPEC-DATA-005) | OFX et MT940 : **non livrés** — personne n'a encore dit qu'une banque les exporte |
| Refus si `soldeDebut + Σ montant ≠ soldeFin` (`ERR-CAB-040`, l'écart nommé) ; `empreinte` interdit d'importer deux fois le même fichier | L'assistant « CSV inconnu » : **livré**, et mémorisé par banque dans `state.banques` — c'est lui qui fait qu'une nouvelle banque n'est pas une nouvelle version |
| Le compte bancaire du relevé est choisi **avant** l'import (532 ou un sous-compte), jamais deviné | — |

**SPEC-UI-CAB-021 — le rapprochement**

| Décidé | À décider |
|---|---|
| Quatre niveaux : `certain`, `probable`, `a-confirmer`, `aucun` ; **seul `certain` se pose d'office** et reste défaisable ; une ambiguïté montre tous les candidats et n'est jamais `certain` par `auto` (`QUESTIONS.md` § 16, décidé) | Le « ± n jours » vaut **3** par défaut (`RELEVE_JOURS`), réglable par dossier (`dossiers[].banque.jours`) — **À VÉRIFIER** avec le comptable |
| Critères : montant, date ± n jours, libellé (les mots COMMUNS comptés, et seulement si un candidat en a strictement plus) ; **jamais une écriture créée depuis le relevé sans clic** | La table libellé → compte (`state.libelles`) part **VIDE** et s'apprend un libellé à la fois ; sans règle, la contrepartie reste vide et l'enregistrement est refusé — jamais un 471 d'office (règle 9.1.1) |
| Rapprochement (532 contre la banque) et lettrage (tiers contre règlement) sont **deux écrans, deux modèles, deux tests** — jamais confondus | Les lignes non rapprochées : une **liste de suspens**, des deux côtés, sans écriture d'office. Le 471 reste possible ligne par ligne, par un clic |

**SPEC-UI-CAB-022 — lettrage automatique, échéancier, balance âgée**

| Décidé | À décider |
|---|---|
| Lettrage auto sur montant + référence, `par: 'auto'` ; délettrage à la main ; « reste ouvert = solde du 411 » est le contrôle (8.9.0) | Le lettrage **partiel** : **non lettré** — la ligne reste ouverte, ce qui est exactement la réponse à « ce client me doit-il encore quelque chose ? ». À VÉRIFIER |
| La balance âgée reprend `AGING_BUCKETS`, **déménagé dans `compta.js`** en 9.5.0 : core.js le réexporte, un test compare les deux références | Les tranches restent 30/60/90 — **À VÉRIFIER** avec le cabinet, c'est un usage, pas une règle |
| L'échéancier lit les `lignes[]` de tiers non lettrées, jamais une liste à part | — |

### 9.6.0 — la déclaration mensuelle

*Produire la déclaration tunisienne du mois **depuis la balance**, avec les chiffres que le
comptable recopie sur le portail.* Question qui bloque : « Montre-moi ta déclaration d'un client
type, ligne par ligne. »

**SPEC-UI-CAB-030 — la déclaration du mois** — *livré en 9.6.0 ; les « à décider » sont tranchés dans la colonne de droite*

| Décidé | À décider |
|---|---|
| Déduite des écritures, `vatChain` (3.1.0) reste le moteur TVA ; un objet `declarations[]` par période ; **chaque case tracée** aux écritures qui la font (SPEC-DATA-005) | Le **périmètre exact des cases** (le formulaire officiel, ligne par ligne) : *comptable* (14.3, point 4) |
| Une case dont la règle n'est pas connue vaut **`null`, jamais 0** (règle 36) ; les clés de `cases` sont une liste ouverte | TCL, TFP, FOPROLOS et acomptes sont livrés **en cases `null` nommées**, chacune avec son motif à l'écran. Le jour où le plan du dossier porte un compte pour l'une d'elles (`plan[].role`), elle se calcule |
| L'écriture de déclaration au dernier jour du mois (4367 / 4366 → 4365), en **brouillard** ; elle ne crédite du 4366 que ce qui est UTILISÉ, le reste étant le crédit à reporter | Ce que le portail accepte : toujours *comptable*. En attendant, les cases s'exportent en CSV et se recopient. L'application **ne dépose jamais** |
| `deposee` est un pense-bête, dé-pointable (droit à l'erreur, 7.12.0) | — |

**SPEC-UI-CAB-031 — le calendrier fiscal du dossier et l'état du mois**

| Décidé | À décider |
|---|---|
| L'état d'un mois côté cabinet : **reçu → saisi → déclaré → payé** ; « déclaré » et « payé » pointés et dé-pointables, et l'on ne paie pas ce qu'on n'a pas déposé | Les régimes et leurs échéances : toujours *comptable* — **F-9.6.0-12 est livré en 10.0.0** avec une table de régimes qui part VIDE : SkanFact n'écrit aucune règle de droit, le cabinet déclare les siennes |
| Aucune date ne fait foi : échéances réglables, « À VÉRIFIER » sur la page, un réglage aberrant retombe sur l'usage (6.8.0) | **Tranché en 9.6.0** : « payé » n'écrit RIEN. Le règlement vient du relevé bancaire quand le dossier en a un, de la saisie sinon — et l'écran dit lequel des deux |
| « À faire » ne remonte une échéance que si des pièces manquent (6.8.0) | — |

### 9.6.1 — entretien

Pas d'écran. Les taux et bases de 9.6.0 confrontés à la première vraie déclaration ; `core.js` →
`compta.js` fini ; retours de bêta hors nouveautés.

### 9.7.0 — immobilisations et stocks

*Dégressif et dérogatoire ; inventaire de fin d'exercice ; `immobilisations[]` du livre.* Question
qui bloque : « Quels biens en dégressif chez tes clients ? »

**SPEC-UI-CAB-050 — les fiches d'immobilisations du cabinet**

| Décidé | À décider |
|---|---|
| `immobilisations[]` (SPEC-DATA-005), **même modèle** que `data.assets` (3.5.0) pour que `compta.js` partage le calcul (parité testée sur les biens venus d'un paquet) | Les coefficients dégressifs tunisiens (Partie 21, À VÉRIFIER) : *comptable* |
| Linéaire et dégressif ; `tauxDegressif` **réglable, jamais un coefficient en dur** ; la dernière annuité absorbe l'arrondi ; cession et mise au rebut | Les subventions d'investissement (compte, reprise au résultat) : *comptable* |
| Ce qui vient d'un paquet entre dans les mêmes fiches **sans ressaisie** ; **jamais une fiche créée d'office** (3.5.0 : la durée est une décision) | L'amortissement dérogatoire (deux plans sur une fiche) : *comptable* — s'il n'est pas demandé, il n'existe pas |

**SPEC-UI-CAB-051 — l'inventaire de stock de fin d'exercice**

| Décidé | À décider |
|---|---|
| Saisi (quantité × coût) au dernier jour ; la **variation** devient une écriture d'inventaire (603 / 37) ; inventaire intermittent par défaut | Permanent pour les dossiers SkanFact (le paquet porterait les mouvements de stock de 4.0.0) : *Skander* — après un cabinet qui le demande, pas avant |
| Coût moyen pondéré, comme `runningStock` (4.0.0) — une seule méthode dans le moteur | FIFO si un dossier l'exige : *comptable* — sinon non |

**Ce que la 9.7.0 a tranché en livrant** (les « à décider » ci-dessus, résolus sans le comptable —
et chacun résolu **par la conception**, pas par une réponse inventée) :

| Question | Ce qui a été fait |
|---|---|
| Les coefficients dégressifs tunisiens | **Aucun n'est écrit.** `tauxDegressif` est un pourcentage saisi sur la fiche ; un dégressif sans taux est **refusé en nommant le taux**. Un test interdit l'apparition d'une table de coefficients dans `compta.js`. La question reste ouverte — mais elle ne bloque plus, et personne ne recopiera un chiffre que l'application aurait deviné |
| La bascule au linéaire | **Livrée, décochée par défaut** (`bascule`). Elle change le plan et un test l'exige — mais nul n'a dit que c'est l'usage d'ici, donc le défaut est celui qui ne fait rien (règle 9.1.1) |
| L'amortissement dérogatoire | **Refusé, avec sa raison.** Le format ne lui réserve rien ; un test tient son absence. Le jour où un cabinet le demande : décision de format |
| Les subventions d'investissement | **Livrées** : `subvention` optionnelle sur la fiche, reprise au **rythme de l'amortissement** du bien financé (quote-part = subvention × dotation / base). C'est un calcul, pas une règle fiscale, et l'écran écrit **À VÉRIFIER** sur les comptes (14 / 739) |
| L'inventaire permanent | **Non livré**, comme prévu. L'intermittent est ce que fait un cabinet pour un dossier sans logiciel de stock, et un dossier SkanFact tient déjà le sien (4.0.0) |

### 9.8.0 — la clôture d'exercice

*Clôturer un exercice côté cabinet : inventaire, résultat, à-nouveaux, états SCE, et le
`.skanclose` rendu au client, même quand le client n'est pas à jour.* Question qui bloque : « Tu
clôtures quels exercices en simplifié, lesquels en complet ? »

**SPEC-UI-CAB-040 — les écritures d'inventaire guidées**

| Décidé | À décider |
|---|---|
| Dotations (calculées depuis `immobilisations[].plan`), provisions, CCA / PCA, FNP / FAE, régularisations : toutes des **écritures ordinaires** `source: 'inventaire'`, datées du dernier jour de l'exercice — **pas une liste à part** (Journal v1, point 1) | La liste des guides d'inventaire livrés et leurs comptes (provision → 15x / 68x par nature) : *comptable* |
| Extourne **automatique** au 1er jour de l'exercice suivant pour ce qui s'extourne (CCA, PCA, FNP, FAE), `extourneDe` posé | — |
| Une dotation passée en écriture porte `ecritureId` sur l'année du `plan[]` (SPEC-DATA-005) | — |

**SPEC-UI-CAB-041 — contrôles et clôture définitive**

| Décidé | À décider |
|---|---|
| Les contrôles **ne bloquent jamais** (règle 6.0.0) : comptes d'attente (471) non soldés, brouillard restant, TVA non déclarée, balance des tiers | Un brouillard restant à la clôture : validé d'office, listé, ou reporté à l'exercice suivant : *comptable* |
| La clôture est **irréversible** côté livre (`exercice.clos`, `closLe`, `closPar`) ; une réouverture exige un motif (`reouvertures[]`) | L'ordre entre clôture définitive et états signés : *comptable* (proposé : états d'abord, clôture ensuite) |
| Les à-nouveaux = **une** pièce AN de l'exercice suivant, calculée sur les écritures réelles seules (règle 9.0.0) ; l'exercice suivant s'ouvre pendant que le précédent se termine | — |

**SPEC-UI-CAB-042 — états financiers SCE et impression**

| Décidé | À décider |
|---|---|
| Déduits de la balance, `etatsFinanciers` (9.0.0) comme base ; **actif = passif**, résultat identique des deux côtés, comparatif N / N-1 ; PDF par `paginate` (7.31.0) | La présentation exacte (NCT 01), les notes, les SIG et ratios retenus : *comptable* |
| — | Simplifié contre complet, **par dossier** : *comptable* |

**SPEC-UI-CAB-043 (Cabinet) et SPEC-UI-ENT-100 (entreprise) — le `.skanclose`** (SPEC-FMT-007)

| Décidé | À décider |
|---|---|
| Produit **à la clôture**, chiffré pour le client (sa clé de 9.2.0) ; porte les à-nouveaux officiels, la liste des écritures d'inventaire, la date de clôture, **et un PDF** lisible par n'importe qui (`QUESTIONS.md` § 16, décidé) | Le format exact (SPEC-FMT-007, réservé) : *Skander*, en 9.8.0 |
| **Le cabinet clôture quand même** si le client n'est pas à jour : le fichier attend avec le dossier et repart avec la relance suivante tant que le manifeste du paquet suivant ne porte pas la date de clôture | Côté entreprise, si le client a déjà saisi des écritures dans l'exercice clos (module `compta.livres`) : refus, ou archivage avec le motif : *Skander* — proposé : archivage, jamais une perte silencieuse |
| Côté entreprise : l'import pose les à-nouveaux, **verrouille l'exercice** (comme une clôture mensuelle, sur l'année), affiche les écritures du comptable **en lecture** ; une version trop ancienne dit « mets à jour SkanFact » ; sans import, seule la clôture de l'exercice **suivant** est bloquée | — |
| Preuve : le bilan des deux applications identique **au millime** après clôture et import — le jumeau du test de parité | — |

### 9.9.0 — collaborateurs

*Plusieurs postes sur un cabinet : verrou par livre, piste d'audit, rôles.* Question qui bloque :
« Combien de collaborateurs, et travaillent-ils sur les mêmes dossiers le même jour ? »

**SPEC-UI-CAB-060 — collaborateurs et droits**

| Décidé | À décider |
|---|---|
| Identité **locale** (pas de compte serveur) ; droits **par dossier** : saisie, validation, supervision ; `audit[].qui` porte l'identité ; postes illimités (on vend des dossiers) | Un mot de passe par collaborateur, ou le mot de passe du cabinet + une identité déclarée (la confiance interne d'un cabinet) : *Skander*, après la question au comptable |
| — | Qui crée et retire un collaborateur (le seul rôle « supervision » ?) : *comptable* |

**SPEC-UI-CAB-061 — deux postes sur un dossier**

| Décidé | À décider |
|---|---|
| Verrou `livre-<AAAA>.lock` (§ 5.2, `ERR-CAB-022`) ; révision et fusion comme 3.2.0 ; **une validée ne se fusionne jamais** — elle existe ou pas ; un brouillard de chaque poste est conservé ; un conflit est expliqué, jamais silencieux | Partage par dossier réseau (fichier) contre un service de transport (7.0.0 du plan plateforme) : **seulement si un cabinet le demande** — décidé ; lequel il demandera : *mesure* |
| Un fichier par dossier par exercice, jamais une base partagée (`PLAN-COMPTABLE.md`, architecture) | L'expiration d'un verrou orphelin (poste éteint sans fermer) : *Skander* — proposé : à l'ouverture, « verrou de <poste> depuis <durée> — le reprendre ? » |

**SPEC-UI-CAB-062 — tableau de production et « À faire » par collaborateur**

| Décidé | À décider |
|---|---|
| Par dossier × mois : reçu → saisi → révisé → déclaré, **qui** et **depuis quand** ; « À faire » filtré par collaborateur ; les deux lus dans `audit[]` et les états de mois, jamais dans une liste tenue à la main | Les étapes exactes (celles du cabinet, pas les nôtres) et le seuil d'un « retard interne » : *comptable* |

### 9.9.1 — entretien

Pas d'écran. Les mesures du test de charge (SPEC-OUT-006) rejouées à trois postes ; `CLAUDE.md`
relu en entier pour retirer ce qui n'est plus vrai.

### 9.10.0 — la révision

*Le cabinet pose des **questions au client**, affichées sur la pièce dans SkanFact ; le client
répond dans le paquet suivant.* Question qui bloque : « Quelles sont les cinq questions que tu
poses le plus souvent ? »

**SPEC-UI-CAB-070 — le dossier de révision**

| Décidé | À décider |
|---|---|
| Par exercice : feuilles maîtresses **par cycle** (trésorerie, ventes-clients, achats-fournisseurs, immobilisations, personnel, fiscal, capitaux), compte revu et signé (qui, quand), points en suspens, notes de revue, questionnaire de fin d'exercice | Les cycles et la méthode de révision du comptable (les siens, pas les nôtres) ; le questionnaire type : *comptable* |
| Rangé dans `cabinet-data.json` (dossier), **pas dans le livre** — c'est la relation, pas la comptabilité (SPEC-DATA-005) | — |

**SPEC-UI-CAB-071 (Cabinet) et SPEC-UI-ENT-101 (entreprise) — les questions au client** (SPEC-FMT-006)

| Décidé | À décider |
|---|---|
| `.skanask` chiffré avec la clé du client (9.2.0 : la même que la signature) ; une question **naît depuis la ligne** (pièce absente, 471 non soldé, facture ouverte, mois provisoire) ; affichée **sur la pièce** dans SkanFact ; la réponse revient dans le paquet suivant | Le format de la réponse : texte seul, pièce jointe, ou **correction proposée** (le client modifie sa pièce et le mois révisé repart) : *Skander*, après les cinq questions du comptable |
| Sans réponse au bout de deux paquets → « À faire » **des deux côtés** ; le pont reste le paquet ; **jamais une écriture du cabinet chez le client** | Les modèles de questions livrés : *comptable* (ses cinq plus fréquentes) |

### 10.0.0 — la liasse

*La liasse fiscale et un **jeu d'exemple complet** du Cabinet.* Question qui bloque : « Ta liasse
2026 d'un client, anonymisée. » — c'est la version qui **exige le pilote**.

**SPEC-UI-CAB-080 — liasse et déclarations annuelles**

| Décidé | À décider |
|---|---|
| Déduite de la balance comme 9.0.0 ; « pas la liasse NCT 01 » disparaît de l'écran ; IS ou IRPP selon le dossier ; déclaration d'employeur sur le moteur de 5.2.0 (`employerAnnual`) ; états signés en PDF | **Tout le reste** : les tableaux de l'année, ce que le portail accepte : *comptable* — rien ne s'écrit avant la liasse réelle |

**SPEC-UI-CAB-081 — le jeu d'exemple complet**

| Décidé | À décider |
|---|---|
| De **vrais paquets** `.skanpack` ouvrables (tâche #67), des dossiers d'exemple dont un mois manquant et un client hors SkanFact ; **tout est rempli au premier lancement** ; l'exemple s'efface au premier vrai paquet (Cabinet 1.0.0) | L'exemple, désormais fait de vrais paquets, entre-t-il dans l'export d'écritures (la règle 6.8.0 l'excluait parce qu'il n'avait pas de fichiers) : *Skander* — proposé : oui, avec le bandeau « exemple » sur le fichier |

Hors application, même version : page Tarifs complète, téléchargement du Cabinet, conditions de
vente, manuel de tenue dans l'aide — `PLAN-DEVELOPPEMENT.md`, tâches non-code.

---

## Partie 16 — Cinq séquences (v1, point 12)

Notation : `A → B : message` ; `[…]` = condition ; `Livré` / `Cible` par ligne. Les acteurs sont
l'**Entreprise** (app SkanFact), le **Cabinet** (app SkanFact Cabinet), la **Console** (worker
`plateforme/skanfact-api.mjs` + D1), le **Relais** (worker de mise à jour), **Resend**, **GitHub**.

### 16.1 Vendre une licence depuis la console (Livré)

```
Skander   → Console  : POST /v1/admin/clients { nom, matricule, email }          201 { client }
Skander   → Console  : POST /v1/admin/licences { clientId, offre, duree, prix }   → cleServeur() vérifie SRV_PRIVATE_KEY ↔ srv-1
Console   → D1       : INSERT licences (charge = JSON signé, JAMAIS la clé) ; INSERT ventes ; INSERT evenements
Console   → Skander  : 201 { licence, cle: "SKAN1.…", vente, mail: { envoye:false, raison:"la vente n'est pas encore payée" } }
Client    → Skander  : paie (hors système)
Skander   → Console  : POST /v1/admin/ventes/<id>/payee { moyen }
Console   → Resend   : POST /emails { from: send.skanfact.tn, to: client, text: gabarit + clé }   [RESEND_API_KEY ∧ email]
Console   → D1       : UPDATE licences SET envoyee_le ; INSERT evenements 'mail.envoye' | 'mail.echec'
Console   → Skander  : { ok, payee_le, mail: { envoye:true, a } }
Client    → Entreprise : colle la clé (Paramètres → Licence) → licence:set → verifyKey(kid ∨ master) → matricule comparé
Entreprise → Console : POST /v1/licence/etat { cle, deviceId, deviceNom, plateforme, version }   [au démarrage, puis toutes les heures]
Console   → D1       : UPSERT activations (empreinte, device_id)
Console   → Entreprise : { v:1, sujet, etat:'active', …, signature|null }
Entreprise → Console : GET /v1/admin/ventes?non_facturees=1  (poste ÉDITEUR seulement, secret PONT_ADMIN)  → brouillon FAC
Entreprise → Console : POST /v1/admin/ventes/<id>/facturee { numero }           [à l'émission ; réessayé depuis la page Licences]
```

### 16.2 Le paquet mensuel, avec la signature (Livré jusqu'à « sceller » ; signature Cible 9.2.0)

```
Cabinet    → fichier  : cab:exportPairing → <cabinet>.skanpair { name, email, publicKey, fingerprint }
Comptable  → Client   : le fichier + l'EMPREINTE dictée au téléphone
Entreprise → Entreprise : cabinet:import → recalcule keyFingerprint(publicKey), refuse si ≠ annoncée   (ERR-ENT-030)
Entreprise (renderer) : packPlan(data, company, periode)  → la liste exacte des fichiers, montrée AVANT
Entreprise → main.js  : pack:build(plan)  → PDF, CSV, empreintes, manifeste.json ÉCRIT EN DERNIER
                        [9.2.0] signature.json = sign(cle-client.json.privateKey, octets de manifeste.json), écrit après
                        zip → sealForCabinet(publicKey du cabinet)  ∨  sealBuffer(mot de passe)  ∨  rien
Entreprise → Client   : <slug>-<AAAA-MM>[-provisoire].skanpack  (mail ou Finder)
Client     → Comptable: le fichier
Cabinet    → Cabinet  : cab:importPack → ingest : cabinetHeader.destinataire == mon empreinte ? → openWithCabinetKey
                        verifierManifeste (format ≤ PACK_FORMAT, mois AAAA-MM, entreprise nommée)
                        [9.2.0] signature.json : absent → 'absente' (refus ERR-CAB-031 si clé épinglée) ;
                                sha256(manifeste) ≠ annoncé → ERR-CAB-032 (a) ; verify faux → ERR-CAB-032 ; clé ≠ épinglée → ERR-CAB-030
                        checkIntegrity(manifest, sha256 de chaque entrée) → { checked, bad, intrus }
                        dossierKey(manifest) = matricule ∨ nom normalisé → filePack (mois reçu deux fois = information)
Cabinet    → disque   : storePack (client/année/mois) ; cabinet-data.json ; sauvegarde 'avant-import' au premier de la journée
Cabinet    → écran    : « 7 pièces vérifiées, intactes » (la seule affirmation rigoureuse) ; chiffres du manifeste (CA, TVA)
```

### 16.3 La révocation appliquée (Livré, 8.4.0 — sans effet tant que `reponse: null`)

```
Skander    → Console   : POST /v1/admin/licences/<id>/revoquer { motif }   → 400 sans motif ; 409 si déjà
Console    → D1        : UPDATE licences SET revoquee_le, revoquee_motif ; INSERT evenements
Console    → Skander   : { ok, licence, note: "…une clé livrée ne se reprend pas…" }   ← la limite est dans la réponse
… le client travaille hors ligne : RIEN ne change chez lui …
Entreprise → Console   : POST /v1/licence/etat { cle, … }                  [prochaine heure / retour au premier plan]
Console    → Entreprise: { v:1, sujet: empreinte(cle), etat:'revoquee', motif, emisLe, signature }   [signée ssi REPONSE_PRIVATE_KEY]
Entreprise → licence.js: verifierReponse : signature vérifiée avec `reponse` de licences-publiques.json (null aujourd'hui → ignorée)
                         ∧ sujet == empreinte de MA clé  ∧ emisLe > verdict rangé   → sinon IGNORÉE (jamais un refus)
Entreprise → <dossier>/licence.json : verdict { etat, motif, emisLe, sujet }   (survit à « Retirer la clé »)
Entreprise → écran     : licenceState = 'revoquee' → licenceBlock ferme la CRÉATION ; lecture, PDF, export, paquet : ouverts
Skander    → Console   : (levée) même route, même preuve → { etat:'active' } signé, daté après → le verdict tombe
```

### 16.4 Partager un dossier à deux, et le conflit d'écriture (Livré, 3.2.0 + 7.28.0)

```
Poste A → main.js : dossiers:share(emplacement)  → COPIE <userData>/dossiers/<id>/ vers l'emplacement commun
                    bascule SEULEMENT si skanfact-data.json y est, de la même taille ; l'original reste
Poste B → main.js : dossiers:join(emplacement)   → ouvre sans rien créer (jamais « créer un dossier partagé vide »)
Poste A → storage : write(data) → syncRevision+1, syncDevice=A, syncWrittenAt ; écriture atomique
Poste B → storage : write(data) → relit le disque : syncRevision du disque ≠ celle lue au chargement
                    → { ok:false, conflict:true, disk }  SANS RIEN ÉCRIRE
Poste B (renderer) : save() → mergeData(mienne, disk) : fusion par identifiant, le dernier écrit tranche,
                     version écartée → conflictArchive, compteurs au max, doublons de numéro SIGNALÉS,
                     trackDeletion (data.deleted) sinon une pièce supprimée reviendrait
Poste B → storage : write(fusion, { force:true })  → puis l'écran EXPLIQUE ce qui s'est passé
Cas insoluble     : deux factures ÉMISES hors ligne sous le même numéro → signalé, pas résolu (parade : « une seule personne émet »)
```

### 16.5 Restaurer un cabinet sur un poste neuf (Livré, `e2e:demenagement` + `e2e:perte`)

```
Poste neuf → cab:status  : base absente, sauvegardes absentes → assistant ; OU sauvegardes présentes → « base absente », jamais l'assistant
Comptable  → cab:pickRecover('fichier'|'dossier') → inspectSource : { kind, base, backups, packs, bytes } montré AVANT le mot de passe
Comptable  → cab:adopt({ path, password })       → adoptSource valide TOUT (enveloppe, mot de passe, structure) avant le disque
                                                   peek réessaie avec le SEL de la sauvegarde (chaque création tire un sel neuf)
main.js    → state = migrate(r.state) ; reorganize(state) recolle les chemins de paquets sur CE poste (jamais sur la clé USB)
main.js    → écran : { state: safeState(), reorganized }  → même EMPREINTE qu'avant : les paquets s'ouvrent
— variante sans base, avec la clé de secours seule —
Comptable  → cab:importRecovery(password)  → readRecovery : GCM valide ou « Mot de passe … incorrect »
main.js    → backupNow('avant-restauration-cle') ; state.cabinet.{publicKey, privateKey} ; recoveryExportedAt = creeLe
Comptable  → chaque client : « renvoie-moi tes mois » → les dossiers reviennent au fil des paquets
```

---

## Partie 17 — Sécurité (v1, point 8)

### 17.1 Modèle de menace, en une table

| Qui | Veut | Par où | Ce qui l'arrête (Livré) | Trou (Cible) |
|---|---|---|---|---|
| Un client malveillant ou compromis | faire lire au cabinet un paquet au nom d'un autre client | le `.skanpair` est distribué à tous les clients, `sealForCabinet` ne demande que la clé **publique** | rien : chiffrer ≠ signer | **9.2.0 signature.json + épinglage** (5.3) |
| Le même | écrire hors du dossier du cabinet | nom d'entrée ZIP `../../…`, mois `../..` | `verifierManifeste` (mois `AAAA-MM`), `openInPack`/extraction : segments `..` retirés + `path.resolve().startsWith` | — |
| Le même | faire exécuter un programme au comptable | un fichier `facture.pdf.command` dans le paquet, ouvert par `shell.openPath` | le nom du fichier extrait est **choisi par nous** (`cab:openInPack`, 6.8.1), pas par l'expéditeur | — |
| Le même | faire calculer une formule au comptable | une cellule CSV `=HYPERLINK(…)` ou `=cmd\|…` dans un libellé de facture, ouverte dans Excel/LibreOffice | **rien** : `toCsv` (core l.1021) et `toCsvLine` (cabcore l.803) n'échappent que `; " \n \r` | **9.1.1 — TEST-9.1.1-010** : toute cellule **texte** commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot est préfixée d'une apostrophe `'` ; les colonnes `money` et `date` ne sont jamais touchées (un montant négatif reste `-12,500`) ; s'applique aux quatre exports (journaux, écritures, portefeuille du cabinet, `mergeEcritures`) |
| Un intermédiaire réseau | dire « révoquée » à un client qui a payé | réponse de `/v1/licence/etat` | signature Ed25519 + `sujet` + `emisLe` (8.4.0) ; sans les trois : ignorée | `reponse: null` aujourd'hui = **aucune** révocation ne s'applique (c'est voulu jusqu'à la mise en production) |
| Le même | rejouer une vieille réponse | idem | `emisLe` plus ancien que le verdict rangé → ignorée | — |
| Un curieux avec l'installeur | lire les secrets embarqués | `extraMetadata` (`updateSecret`, `plateformeSecret`) | **assumé** : « tout ce qu'une application peut télécharger sans secret, un inconnu le peut aussi » (6.7.0) ; le jeton GitHub est sur le worker, jamais dans l'app | — |
| Quelqu'un devant un poste déverrouillé | repartir avec la clé du cabinet | export de la clé de secours | `cab:exportRecovery` **redemande le mot de passe du cabinet** | — |
| Le même | changer le mot de passe sans le connaître | `setPassword` | l'ancien est **revérifié en relisant le fichier** (6.8.0) | — |
| Un client | falsifier son essai | reculer l'horloge, effacer `app-config.json` | `armedAt` doublé dans `<dossier>/licence.json`, la plus ancienne date fait foi ; reculer l'horloge **marche** — accepté, source ouverte (8.0.0) | — |
| Un client | utiliser une clé d'une autre entreprise | coller la clé | `licence:set` compare les matricules (7 chiffres + lettre) et **refuse en nommant les deux** | un matricule vide des deux côtés ne compte pas (voulu) |
| Un attaquant du site | injecter du HTML dans l'interface | nom de client, libellé, note, manifeste reçu | `h()` / `esc()` sur **toute** interpolation (test de source) ; la console inline utilise `esc` | — |
| Un attaquant de la console | deviner l'`ADMIN_SECRET` | force brute | `ADMIN_MIN` caractères minimum ; **pas de limitation de débit** | Cible P 0.3 : `jetons` (table existante) + compteur d'échecs par IP dans KV — À VÉRIFIER que Cloudflare KV est disponible sur le plan gratuit |
| Une session Claude ou un contributeur | commiter un secret | Git | règle « jamais un token », clé privée hors dépôt, `.pem` jamais collé ; `SKANFACT_CLE_EMBARQUEE` honoré **en développement seulement** | — |

### 17.2 Les entrées externes, et le filtre de chacune

| Entrée | Filtre (Livré) | Fichier |
|---|---|---|
| `.skanpack` reçu | `isSealedForCabinet`/`isSealed` → déchiffrement (GCM = intégrité) → `zipRead` (CRC) → `verifierManifeste` → `checkIntegrity` | `src/cabinet/main.js` 576–655 |
| `.skanpair` | recalcul de l'empreinte, refus si ≠ annoncée | `src/main.js` `cabinet:import` |
| `.skanrecover` | marqueur + GCM | `cabstore.readRecovery` |
| Clé `SKAN1.…` collée | `parseKey` (3 segments, base64url), `verifyKey` (kid → clé, sinon `master`), matricule | `src/licence.js` |
| Réponse `/v1/licence/etat` | `verifierReponse` (signature, sujet, date) | `src/licence.js` |
| Fichier YAML de mise à jour | electron-updater : sha512 du binaire, `allowDowngrade = false` | `src/main.js` |
| CSV importé (plan, balance, relevé — Cible) | colonnes **par nom**, `parseCsv` (vrai lecteur : `;` dans un libellé), équilibre vérifié avant écriture | `cabcore.parseCsv` |
| Corps JSON de la console | `nettoyerClient`, `nettoyerEmission`, `nettoyerImport`, `nettoyerActivation` : **refus avec raison**, jamais `null` silencieux ; `SEGMENT` sur chaque id d'URL | `skanfact-api.mjs` 183–440 |
| Chemin de fichier venu de l'écran | `attach:addPath`, `ocr:pick` : dialogues natifs seulement, jamais un chemin tapé | `src/main.js` |
| `PONT_CHEMIN` (pont comptable) | seuls les chemins `/v1/admin/…`, jamais `..` | `src/main.js` |

### 17.3 Tests de sécurité à écrire (Cible, en plus de ceux qui existent)

| Test | Type | Identifiant | Ce qu'il vérifie |
|---|---|---|---|
| `csv : injection de formule neutralisée, montants intacts` | calcul | TEST-SEC-001 (= TEST-9.1.1-010) | voir 11.3 |
| `zip : une entrée « ../x » n'écrit jamais hors du dossier` | Node | TEST-SEC-002 | `zipBuffer` avec un nom hostile → extraction → `fs.existsSync` hors cible faux (9.1.0 ; **prouvé en retirant le filtre**) |
| `manifeste : un mois « ../.. » est refusé avant tout écrit` | Node | TEST-SEC-003 | `verifierManifeste` lève ; aucun `storePack` appelé |
| `signature : garder la signature et changer le manifeste échoue` | Node | TEST-SEC-004 | 9.2.0 ; les deux variantes de `ERR-CAB-032` |
| `réponse : non signée, mal adressée, rejouée → ignorées` | Node | TEST-SEC-005 | existe déjà en partie dans `e2e:plateforme` (étapes 5–6) ; à doubler en test pur sur `verifierReponse` |
| `console : 100 secrets faux à la suite → 429 au onzième` | worker sur SQLite | TEST-SEC-006 | P 0.3 (limitation de débit) — **pas avant** |
| `gabarits : aucune interpolation sans h()/esc()` | source | (existe) | test de source des deux renderers, déjà dans `npm test` |

---

## Partie 18 — Limites, écrites comme des décisions (v1, point 9)

| Limite | Valeur | Pourquoi c'est une décision et pas un oubli | Ce qui la lèverait |
|---|---|---|---|
| Multi-utilisateur | **à tour de rôle**, jamais simultané (3.2.0) | le danger du partage est le silence ; une fusion par identifiant avec archive vaut mieux qu'un verrou réseau qu'on contourne | **livré en 9.9.0** : révision relue avant d'écrire, fusion qui ne perd aucune validée, verrou consultatif qui se lève ; un serveur seulement si un cabinet dit oui |
| Données sur un serveur | **aucune** — la plateforme ne connaît que clés, postes, ventes | « jamais de données en otage » ; l'app survit à son éditeur | rien ne le lèvera |
| Révocation | **à la prochaine connexion**, et seulement si la version embarque `reponse` | vérification hors ligne = pas de kill switch, c'est le prix de la promesse inverse | rien ; c'est écrit en orange dans la console |
| Listes de la console | `LIMIT 500` partout | une console d'un seul éditeur ; au-delà de 500 licences, c'est un autre logiciel | pagination P 0.3 si le jalon des 200 licences est atteint |
| Import d'historique | ≤ 500 licences par appel | idem | — |
| Taille d'un paquet | **aucune limite** ; 50 Mo de photos = 22 s d'ingestion sur 20 paquets | `setImmediate` entre deux unités + arrêt possible ENTRE deux (6.8.1) | 9.1.0 : avancement par fichier |
| Un dossier = un fichier par exercice | `livre.json` par `AAAA` | 50 000 écritures ouvertes en < 1 s, mesurées AVANT d'écrire le format (SPEC-OUT-006) | jamais une base ; SQLite refusé (décision 1.0) |
| Signature de code | **aucune** avant la première vente | certificats payants ; requalifié « avant la première vente » (`QUESTIONS.md`) | l'achat, tâche non-code de Phase 0 |
| e-facture TTN | **non** | pas demandée ; `docs/e-facture-controle.md` (9.1.1) recense ce qu'il faudrait | le jour où elle devient obligatoire pour la cible |
| Adresses mail | une seule (`contact@skanfact.tn`) | Zimbra Starter, une adresse | un second compte OVH |
| Windows `0600` | non garanti (`cle-client.json`, `plateforme-admin.json`) | les modes POSIX n'existent pas ; la garantie est **hors des données et hors du paquet** | ACL Windows via `icacls` — À VÉRIFIER, jamais essayé |
| Devises | 1 taux par pièce, saisi à la main, **obligatoire** (7.0.1) | aucun appel réseau ; un taux du jour deviendrait un service | — |
| Langues des documents | fr, en | l'arabe demande les propriétés logiques (adoptées pour le neuf) et une traduction — pas promis | un client qui le demande |
| Lecture de photo | **en pause** (`OCR_EN_PAUSE`) | pas d'app téléphone ; la seule fonction qui sort du poste | une app téléphone |
| Plan de comptes | proposé, **jamais une vérité** | chaque cabinet a le sien ; « À VÉRIFIER » sur la page | — |
| Nombre de postes par licence | `postes: null` — **illimité** | on vend des dossiers, pas des postes (`DIRECTION.md`) | — |

---

## Partie 19 — Cas limites (v1, point 10)

Comportement **attendu** ; Livré = déjà tenu par le code ou un test cité, Cible = à tenir.

| Cas | Comportement attendu | État |
|---|---|---|
| 31 janvier + 1 mois (licence) | 28 (ou 29) février : `addMonths` calendaire, jamais 30,44 jours | Livré (7.33.0) |
| 30 février saisi comme fin de licence | refusé (`dateValide`) | Livré |
| Minuit à Tunis = 23 h la veille en UTC | toute arithmétique en UTC pur ; `today()` seul en local ; test sur 5 fuseaux | Livré (5.2.3) |
| Absence à cheval sur deux mois | répartie (`leaveDaysInMonth`) | Livré |
| Matricule vide des deux côtés (clé/société) | ne compte pas ; la clé s'enregistre | Livré (7.33.0) |
| Deux clients du cabinet portant le même nom, sans matricule | même `dossierKey` → même dossier ; c'est **pourquoi** le matricule est demandé, et l'écran prévient à la création (`ERR-CAB-008`) | Livré |
| Raison sociale en arabe | `\p{L}\p{N}` avec `u` : jamais une clé vide (6.8.1) | Livré |
| Mois reçu deux fois | remplacé, dit ; « était définitif » dit en plus | Livré |
| Paquet d'un `format` futur | refus `ERR-CAB-004`, rien rangé | Livré |
| Paquet avec fichier absent | envoyé quand même, `absents` dans le manifeste ; côté cabinet, absent ≠ vérifié | Livré |
| Fichier ajouté au ZIP après coup | `intrus`, compté, jamais « intact » | Livré |
| Licence sans `kid` | vérifiée avec `master`, elle seule | Livré (8.4.0) |
| `kid` inconnu | refus « pas reconnue » — on n'essaie jamais toutes les clés | Livré |
| Réponse plateforme non signée (`reponse: null`) | ignorée pour tout ce qui restreint | Livré |
| Réponse rejouée 3 mois plus tard | ignorée (`emisLe`) | Livré (`e2e:plateforme`) |
| Serveur éteint | rien ne change, aucun rouge | Livré |
| Double clic sur « Émettre » | un numéro, un toast, une écriture | **Cible 9.1.0** (TEST-9.1.0-025) |
| Disque plein pendant `write()` | l'écriture atomique lève (`renameSync` échoue), `persist()` renvoie `false`, l'écran dit « non enregistré » ; **le message n'est pas traduit** : seul le téléchargement de mise à jour connaît `ENOSPC` (`updateProblem`) | **Cible 9.1.0** : `ERR-ENT-060` « Il n'y a plus de place sur le disque : rien n'a été enregistré. Libère de l'espace, puis Enregistrer. » dans `plainError` |
| Deux imports de paquets lancés à la suite dans le cabinet | le second attend le premier ; un seul `import:progress` | **Cible 9.1.0** : drapeau `importEnCours` dans `src/cabinet/main.js` (aujourd'hui : rien ne l'empêche, et les deux écrivent `cabinet-data.json` tour à tour — l'écriture atomique évite la corruption, pas le double compte) |
| Restauration d'une sauvegarde plus ancienne que le dernier numéro émis | `nextNumber` = max(pièces, compteur) + 1 : **aucun doublon** | Livré (relu en v1 : la relecture le donnait pour un trou) |
| Changement de régime fiscal après des factures avec TVA | les pièces gardent leur TVA (`showVat = assujetti ∨ totalVAT > 0`) | Livré (7.22.0) |
| Timbre sur une facture en euros | converti dans la devise de la pièce, figé à l'émission | Livré (7.0.1, 7.1.0) |
| Facture entièrement couverte par un avoir | statut « annulée » **mais** l'écriture de vente existe (c'est l'avoir qui la neutralise) | Livré (8.9.0 : trouvé par le lettrage) |
| Bien cédé en cours d'année | annuité partielle dans le journal, plan d'origine sur la fiche, et l'écran le dit | Livré (3.5.0, 9.0.0) |
| Barème de paie modifié après un bulletin remis | le bulletin garde `slip.computed` | Livré (5.0.0) |
| Horloge de la machine reculée | l'essai se rejoue — accepté, source ouverte | Livré (décision) |
| Veille de l'ordinateur | pas un gel : `powerMonitor` + saut d'horloge | Livré (8.1.0) |
| Dossier iCloud pas encore synchronisé au démarrage | le fichier est absent → « fichier illisible mis de côté » ne se déclenche **pas** (absent ≠ illisible) ; l'app ouvre vide → **Cible 9.1.0** : si `app-config.json` connaît un dossier partagé et que le fichier manque, dire « ton dossier partagé n'est pas encore arrivé » au lieu d'ouvrir vide | Cible |
| `livre.json` verrouillé par un poste éteint | `ERR-CAB-022` avec « forcer » | Cible 9.2.0 |
| Balance d'ouverture importée déséquilibrée | refus `ERR-CAB-023` avec l'écart | Cible 9.2.0 |
| Écriture validée qu'on veut corriger | contre-passation, jamais modification (`ERR-CAB-025`) | Cible 9.2.0 |
| Un cabinet dont le client a changé d'ordinateur (clé de signature neuve) | `ERR-CAB-030` + « accepter la nouvelle clé » après dictée de l'empreinte | Cible 9.2.0 |

---

## Partie 20 — Scénarios de reprise (v1, point 11 ; v1.1 : les runbooks d'exploitation sont partis)

**Ce qu'un cahier des charges peut porter, et ce qu'il ne peut pas.** Un runbook dit ce que
l'*opérateur* fait ; un cahier dit ce que le *logiciel* doit faire. Des dix runbooks de la v1, six
étaient de l'exploitation pure et vivaient déjà ailleurs — les garder ici faisait une troisième
copie, et une table en double diverge toujours. Ils ne sont pas perdus :

| Runbook de la v1 | Où il vit |
|---|---|
| 1. Publier une version stable | `CLAUDE.md` « Publier une version » ; `QUESTIONS.md` § 18 « Que faire si… » |
| 2. Publier une bêta | `CLAUDE.md` § 7.25.0 |
| 3. Mettre la plateforme en production | **`PLAN-PLATEFORME.md` § 18** (déplacé tel quel en v1.1), avec `plateforme/README.md` pour chaque réglage |
| 4. Retirer `srv-1` (compromission) | **`PLAN-PLATEFORME.md` § 18** (déplacé tel quel en v1.1) |
| 8. Repasser le dépôt en privé | `CLAUDE.md` § 7.26.0 ; `worker/README.md` ; `QUESTIONS.md` § 18 |
| 10. Quota GitHub Actions épuisé, CI en panne | `CLAUDE.md` § 7.21.1 → 7.21.3 et 6.7.2 |

Les quatre qui restent sont des **scénarios** : une situation qui arrive à un utilisateur, et ce que
l'application **doit offrir** pour qu'il s'en sorte — avec les identifiants qui le spécifient et le
test qui le prouve. C'est ça, du cahier des charges.

**SCN-001 — Un client a perdu sa clé de licence** (Livré)

| | |
|---|---|
| Déclencheur | un client écrit « je n'ai plus ma clé » |
| Ce que l'application offre | Console → Licences → la sienne → « Voir la clé » (refabriquée depuis `charge`, SPEC-API-005 : Ed25519 est déterministe) ou « Renvoyer par mail » (`envoyer` ; un 502 rend quand même la clé) ; si la licence est **maître** (émise dans SkanFact avant la console), `cleRaison` le dit et la clé est dans `data.licences` du poste de Skander (page Licences → copier) |
| Ce qu'elle ne fait jamais | en émettre une seconde (deux actives pour un client, « À faire » en réclamerait le paiement) |
| Preuve | `e2e:console` (voir la clé, renvoyer), `e2e:pont` (licence maître : menu sans « Renouveler ») |

**SCN-002 — Un cabinet a perdu son poste** (Livré)

| | |
|---|---|
| Déclencheur | ordinateur volé, disque mort, poste remplacé |
| Ce que l'application offre | deux portes, **selon ce qu'il lui reste** (§ 16.5) : avec la base ou une copie externe → `cab:pickRecover` + `cab:adopt` (la clé y est déjà) ; avec la seule clé de secours → cabinet neuf + `cab:importRecovery` (SPEC-FMT-003) ; dans les deux cas **la même empreinte** s'affiche à l'arrivée — c'est la seule vérification qui compte ; les chemins enregistrés sont recollés sur le poste (6.8.1) |
| Ce qu'elle ne fait jamais | créer une clé neuve « pour repartir » (tous ses clients seraient à réappairer) ; proposer un assistant de bienvenue quand des sauvegardes existent (6.8.0) |
| Preuve | `e2e:demenagement`, `e2e:perte` ; TEST-9.2.0-021 (les livres reviennent aussi) |

**SCN-003 — Un client change de clé de signature** (Cible 9.2.0)

| | |
|---|---|
| Déclencheur | le client a changé d'ordinateur ou réinstallé : ses paquets arrivent signés par une autre clé |
| Ce que l'application offre | refus `ERR-CAB-030` qui nomme le client et les deux empreintes ; bouton « Accepter la nouvelle clé… » qui demande l'empreinte **lue de vive voix** (celle de `cle-client.json`, Paramètres → Cabinet côté client) et la compare ; `audit` « changement de clé » (§ 5.3, SPEC-UI-CAB-006) |
| Ce qu'elle ne fait jamais | accepter la clé automatiquement ; accepter un paquet **non signé** après un paquet signé (`ERR-CAB-031`, confiance au premier usage) |
| Preuve | TEST-9.2.0-014, TEST-9.2.0-019, TEST-SEC-004 |

**SCN-004 — Restaurer une sauvegarde de l'entreprise** (Livré)

| | |
|---|---|
| Déclencheur | une saisie massive à défaire, un fichier abîmé, un « Tout effacer » regretté |
| Ce que l'application offre | Paramètres → Données et sécurité → Sauvegardes → choisir la date → `backups:peek` dit **ce qu'on va perdre** (pièces et clients de la sauvegarde contre ceux d'aujourd'hui) → l'état actuel est mis de côté (`avant-restauration`) → `backups:restore`, qui refuse un conflit (« Le fichier a changé entre-temps ») ; après restauration, `nextNumber` (SPEC-FUNC-006) prend le max des pièces : **aucun doublon** |
| Ce qu'elle ne fait jamais | le chemin « Importer et choisis un fichier du dossier caché » (disparu en 7.3.0) ; purger les filets par ordre alphabétique (7.21.x : `avant-*` a sa propre réserve) |
| Preuve | `e2e:exemple` (la restauration), tests `storage` de `npm test` |

---

## Partie 21 — Ce qui reste « À VÉRIFIER », en une table (v1, point 13)

| Sujet | Où c'est dans le code | Valeur en attendant (celle qui ne fait rien) | Qui répond | Quand |
|---|---|---|---|---|
| Assiette de la retenue à la source (TTC hors timbre) | `computeTotals` | l'assiette actuelle, écrite sur la page | le comptable | avant 9.1.1 |
| Seuil de retenue à la source | `seuilRetenue` (Cible 9.1.1) | **0** (ne prévient jamais) | le comptable | 9.1.1 |
| Avoir sans timbre par défaut | `computeTotals` (`stampFee` sur avoir) | sans timbre | le comptable | 9.1.1 |
| Taux CNSS 9,18 / 16,57, accident, solidarité, barème IRPP, TFP 2 % / 1 %, FOPROLOS 1 % | `DEFAULT_PAYROLL` | valeurs proposées, **toutes modifiables**, bulletin figé (`slip.computed`) | le comptable | avant le premier bulletin d'un client |
| Métiers à TFP réduite | `ACTIVITIES` (colonne absente) | `null` — jamais écrite sans réponse (TEST-9.1.1-006) | le comptable | 9.1.1 |
| Numéros de comptes (411, 4367, 22 et non 24…) | `DEFAULT_ACCOUNTS`, `PLAN_COMPTABLE` | proposés, modifiables, « À VÉRIFIER » sur la page | chaque cabinet | 9.2.0 (import du plan) |
| Échéances fiscales (dates, forme juridique) | `DEFAULT_FISCAL_DEADLINES` | réglables, « À VÉRIFIER » sur la page | le comptable | 9.6.0 |
| Périmètre de la déclaration mensuelle, TCL | rien | — | le comptable | 9.6.0 |
| Coefficients d'amortissement dégressif | rien | linéaire seul | le comptable | 9.7.0 |
| Facture électronique (obligation, périmètre) | `docs/e-facture-controle.md` (Cible) | non | le comptable + TTN | quand elle devient obligatoire |
| Déontologie : remise au client parrainé, jamais de commission au cabinet | `DIRECTION.md` | remise 20 %, commission 0 | l'Ordre (OECT) | avant la première vente à un cabinet |
| INPDP (données personnelles : matricules, salaires) | — | rien n'est collecté hors du poste, sauf activation (5 champs) | Skander + un conseil | Phase 0 |
| Mode `0600` sur Windows | `cle-client.json`, `plateforme-admin.json` | hors des données et du paquet | un test sur Windows | 9.2.0 |
| Playwright 1.63 ↔ Electron 43 sur la CI | `ci.yml` (Cible) | `e2e:pages` seul en CI | premier run | 9.1.0 |
| Durée de `npm test` sur Windows | — | ≈ 30 s sur Linux | premier run | 9.1.0 |
| Cloudflare KV sur le plan gratuit (limitation de débit) | — | pas de limitation | Skander | P 0.3 |
| Format d'export des banques tunisiennes | — | CSV colonnes par nom | le comptable | 9.5.0 |

---

## Partie 22 — Ce que ce document ne spécifie pas, volontairement (v1, point 20)

- **Le pixel** : marges, tailles de police, couleurs exactes — ils vivent dans `style.css`, et
  `e2e:contraste`, `e2e:colonnes`, `e2e:entetes`, `e2e:barre` les **mesurent** ; un cahier qui les
  écrirait divergerait de la feuille au premier ajustement.
- **Le texte des bulles et des articles d'aide** : `guide.js` / `cabguide.js` en sont la source, et
  un test exige que chaque clé posée existe. Ici, seulement l'obligation d'en avoir.
- **Les versions 9.3.0 → 10.0.0 au-delà de leur intention** (Partie 15, écran par écran : ce qui
  est décidé et ce qui reste à décider) : chacune se spécifie après les réponses du comptable ; une
  spécification écrite avant serait une spéculation numérotée.
- **La table `cabinets` de la plateforme (P 0.3)** et la licence du Cabinet par empreinte : décidées
  dans `DIRECTION.md` § 5, à spécifier avec la 9.3.x.
- **L'ordre des entrées de menu, des onglets, des colonnes** : décidé écran par écran, mesuré par
  `e2e:captures` ; pas une règle.
- **L'arabe, le TEIF, la signature de code, l'app téléphone** : hors périmètre (Partie 18), et
  seules les portes sont gardées ouvertes (propriétés logiques, `docs/e-facture-controle.md`).
- **Le contenu des mails** (licence, relance) : `DEFAULT_EMAIL_TEMPLATES` et `relanceMail` en sont
  la source ; un test compare la phrase d'activation entre l'app et la console.
- **La stratégie commerciale, les prix, les jalons** : `DIRECTION.md`, `QUESTIONS.md` § 3,
  `PLAN-DEVELOPPEMENT.md`.
- **Ce qu'un développeur doit lire avant de coder** : `CLAUDE.md` (les règles apprises, une par
  version) — ce document ne les recopie pas, il les cite par numéro de version.

---

## Journal des versions

### v0 — 15/09/2026, commit `6ebe904` (lu sur `d7bfc54`)

Première version : 1 454 lignes, Parties 0 à 14, 23 fiches de fonctions + 4 Cibles, 24 + 9 + 22
tests, 5 migrations.

### v1 — 15/09/2026 (lu sur `6ebe904` ; aucun fichier de code n'a changé)

**Ce qui a changé** (points de la relecture extérieure retenus) :

- Point 1 — les trois listes `releves[]`, `immobilisations[]`, `declarations[]` de `livre.json`
  spécifiées avec JSON et invariants (SPEC-DATA-005).
- Point 2 — Partie 15, les intentions 9.3.0 → 10.0.0 (décidé / ouvert / question qui bloque).
- Point 3 — 37 fiches de fonctions de plus (SPEC-FUNC-024 → 060, § 3.1 ter) : le catalogue passe de
  23 à 60.
- Point 4 — les contrats IPC des deux applications (§ 4.5 et § 5.5), chaque canal avec son entrée,
  sa sortie et ce qu'il refuse.
- Points 5 et 19 — les JSON exacts de chaque route de la plateforme (§ 7.1 bis), lus dans les
  handlers.
- Point 6 — l'ordre empreinte-puis-signature fixé dans § 5.3, avec son **vrai** motif et
  TEST-9.2.0-023.
- Point 7 — SPEC-FMT-003 (`.skanrecover`) complet : format, scellement, restauration, intégrité,
  conservation, ce que le format ne fait pas.
- Point 8 — Partie 17, sécurité : modèle de menace, entrées externes et leurs filtres, six tests.
  **Un vrai trou trouvé** : l'injection de formule CSV (parade en 9.1.1, TEST-9.1.1-010).
- Point 9 — Partie 18, les limites écrites comme des décisions.
- Point 10 — Partie 19, trente-quatre cas limites avec le comportement attendu et l'état.
- Point 11 — Partie 20, dix runbooks.
- Point 12 — Partie 16, cinq séquences.
- Point 13 — Partie 21, la table « À VÉRIFIER » consolidée (sujet, code, valeur en attendant, qui,
  quand).
- Point 14 — § 11.5, la correspondance script → fichier des 41 e2e (renvoi à `CLAUDE.md` pour ce que
  chacun prouve).
- Point 15 — Partie 13, le nommage CSS existant nommé, et `cab-` décidé pour le neuf du Cabinet.
- Point 16 — Partie 13, une raison par interdiction, avec la version qui l'a apprise.
- Point 17 — SPEC-DATA-001, le mode démo (`data.demo`, `demoFields`, bandeau, `demoBlock`, tampon
  « EXEMPLE », sortie avec restitution de l'identité empruntée).
- Point 18 — Partie 13, l'idempotence des gestes qui écrivent : **un défaut réel** (`issue()` sans
  garde de double-clic), règle `data-busy` + `isIssued`, TEST-9.1.0-025.
- Point 20 — Partie 22, ce que le document ne spécifie pas.

**Trois erreurs de la v0, corrigées** (trouvées en lisant les handlers pour le point 5) :

- SPEC-API-001 : la sortie est **plate** (`{ v, sujet, etat, offre, exp, postes, motif, emisLe,
  signature }`), pas `{ etat, reponse? }`.
- SPEC-API-002 : la sortie est `{ base, emission, mail, reponse, tarifs, offres, durees }`, pas
  `{ ok, cleServeur, resend }`.
- SPEC-API-009 : le champ s'appelle `ignorees`, pas `refusees`.

**Ce qui a été refusé, ou retenu autrement, et pourquoi** :

- Point 1, « les formulaires en dur pour `releves`, `immobilisations`, `declarations` » : **nuancé**.
  Les trois listes sont spécifiées (retenu), mais leurs champs restent **extensibles à la lecture**
  (règle du projet : tout ajout facultatif à la lecture), et les **provisions** ne sont pas une
  quatrième liste : ce sont des écritures d'inventaire ordinaires, saisies dans le brouillard (9.3.0)
  et datées du 31/12 (9.8.0) — une liste à part les compterait deux fois, exactement le défaut que
  l'à-nouveau explicite de 9.0.0 a dû éviter.
- Point 6, « sans l'empreinte, un attaquant garde la signature et change le manifeste » : **refusé
  comme motif**, l'étape est gardée pour un autre. Ed25519 signe les octets ; un manifeste modifié
  fait échouer `verify` quoi qu'il arrive. L'empreinte apporte la bonne phrase, la vérification sans
  clé et la comparaison de deux envois — c'est ce que § 5.3 dit maintenant.
- Point 14, « un tableau des e2e avec la durée de chacun » : **retenu sans les durées**. Le tableau
  de ce que chacun prouve existe dans `CLAUDE.md` et n'est pas recopié (deux tables divergent) ;
  la correspondance script → fichier manquait et a été ajoutée ; les durées n'ont jamais été
  mesurées sur Windows, et un chiffre inventé serait pris pour une mesure.
- Point 15, « une convention CSS avec préfixes partout » : **retenu pour le neuf seulement**.
  L'existant (kebab-case sans préfixe dans `style.css`, `wiz-*` dans le cabinet) ne se renomme pas —
  un renommage de 90 classes pour une règle ne corrige aucun défaut et casse `e2e:contraste`,
  `e2e:colonnes` et quatorze sélecteurs de tests.
- Point 18, « `nextNumber` produit un doublon après une restauration » : **refusé comme défaut**,
  la règle est retenue pour un autre cas. `nextNumber` prend `max(numéro des pièces, compteur) + 1`
  (core.js l. 836) : une restauration ne peut pas faire de doublon. Le défaut réel est le
  double-clic sur « Émettre », et c'est lui que la règle d'idempotence traite.

**Ce que la relecture n'a pas vu**, et qui compte davantage que plusieurs de ses vingt points :

- Un paquet mensuel **n'est pas signé** (chiffrer ≠ signer) — corrigé dans `QUESTIONS.md` par la
  troisième relecture, spécifié en § 5.3 ; le relecteur a discuté l'ordre des étapes d'une
  vérification sans remarquer que c'est la seule protection contre un client qui se fait passer
  pour un autre.
- L'**injection CSV**, absente de ses vingt points, est le seul trou de sécurité exploitable
  aujourd'hui sans aucune clé.
- Le disque plein n'a **aucune phrase** ailleurs que dans les mises à jour (Partie 19).
- Deux imports de paquets peuvent tourner **en même temps** dans le cabinet (Partie 19).
- Le module `compta` **existe déjà** (`MODULES`, `toujours: true`) : une spécification qui en créait
  un second — c'était la mienne, en cours d'écriture de la v0 — aurait dédoublé les onglets ; d'où
  le sous-module `compta.livres` sur les onglets.

### v1.1 — 15/09/2026 (trois précisions de Skander sur la v1, lu sur `790633b` ; aucun fichier de code n'a changé)

**Précision 1 (point 1) — d'accord.** La v1 avait spécifié les trois listes chacune de son côté,
avec trois JSON séparés, pendant que l'exemple complet de `livre.json` les montrait **vides** et que
la ligne de la table disait encore « hors de ce document » (une phrase de la v0 restée en place :
la v1 se contredisait à trois paragraphes d'écart). La forme n'était donc pas figée, parce qu'elle
n'était pas visible en un seul endroit. Corrigé : un seul exemple complet avec un objet de chaque
liste **à sa place**, un paragraphe qui dit la hiérarchie en une phrase (à la racine du livre,
plates entre elles, chacune imbrique ses enfants, aucune écriture imbriquée — le lien va vers
l'écriture par `ecritureId`, jamais l'inverse), la ligne de la table corrigée, et les trois JSON
séparés retirés (deux copies divergent). Au passage : la clé `preparéeLe` portait un accent — une
clé JSON n'en porte jamais ; `prepareeLe`.

**Précision 2 (point 11) — nuancé, et Skander a raison sur le fond.** Un runbook dit ce que
l'opérateur fait ; un cahier dit ce que le logiciel doit faire. Des dix runbooks, six étaient de
l'exploitation (publier, bêta, mise en production, retirer `srv-1`, dépôt privé, quota Actions) et
vivaient **déjà** dans `CLAUDE.md`, `worker/README.md` et `QUESTIONS.md` § 18 : les garder ici
était une troisième copie. Les deux qui concernent la plateforme (mise en production, retrait de
`srv-1`) sont **déplacés tels quels** dans `PLAN-PLATEFORME.md` § 18 — c'est le document qui parle
des clés et de l'ordre de livraison, et `plateforme/README.md` détaille chaque réglage ; les quatre
autres n'avaient pas à être recopiés, la Partie 20 dit où ils sont. Les quatre runbooks qui
décrivaient une situation d'utilisateur (clé perdue, poste perdu, clé de signature changée,
restauration) **restent**, réécrits en **scénarios de reprise** (SCN-001 → 004) : déclencheur, ce
que l'application doit offrir, ce qu'elle ne fait jamais, la preuve — avec les SPEC, ERR et TEST
qu'ils exercent. Ça, c'est du cahier des charges. Pourquoi pas tout dans `PLAN-PLATEFORME.md` :
publier une version ou construire sur le Mac quand le quota manque n'a rien à voir avec la
plateforme, et ce document-là est un plan, pas un manuel d'exploitation.

**Précision 3 (point 2) — d'accord.** La v1 donnait un tableau **par version** (décidé / ouvert /
question qui bloque) : « 9.3.0 — la saisie » y tenait sur une ligne alors qu'elle cache quatre
écrans qui n'en sont pas au même point. La Partie 15 est réécrite **écran par écran** : vingt-deux
écrans réservés (`SPEC-UI-CAB-010` → `081`, `SPEC-UI-CON-007`, `SPEC-UI-ENT-100` et `101`), chacun
avec son tableau Décidé / À décider, la colonne « À décider » nommant **qui** tranche (comptable,
Skander, mesure) et, quand j'ai un avis, ce que je propose. La version 9.4.0 / P 0.3 (licence du
Cabinet), absente de la v1, y est. Les versions d'entretien restent une ligne : elles n'ont pas
d'écran.

**Trouvé en relisant pour ces trois précisions, hors cahier** : `QUESTIONS.md` § 16 (9.4.0)
écrivait encore « la grâce de 60 jours », alors que § 3 et § 18 disent douze mois après une licence
payée depuis la relecture du 15/09 — corrigé dans `QUESTIONS.md` (une phrase).

### v1.2 — 16/09/2026 (la renumérotation, décidée par Skander ; aucun fichier de code n'a changé)

La règle du projet réserve le troisième chiffre aux correctifs. La licence du Cabinet ajoute des
fonctionnalités : elle passe de `9.3.x` / `P 0.3` à **9.4.0**, l'entretien de `9.3.1` à **9.4.1**, puis à **9.4.10** le 17/09/2026 (deux entretiens non prévus, puis le chantier UI/UX du Cabinet — 9.4.3 à 9.4.9 — ont pris les numéros),
et tout ce qui suivait décale d'un cran (banque **9.5.0**, déclaration **9.6.0**, immobilisations
**9.7.0**, clôture **9.8.0**, collaborateurs **9.9.0**, révision **9.10.0**, entretiens **9.6.1** et
**9.9.1**). La 10.0.0 ne bouge pas. Appliquée **en une seule passe simultanée aux sept documents**
qui portent ces numéros (281 occurrences), avec un garde-fou vérifiant qu'aucune version livrée ni
stable n'a bougé : renuméroter un document seul aurait fabriqué la divergence que le projet combat
depuis la 6.8.0.

Deux conséquences écrites dans la Partie 15 : les identifiants `SPEC-UI-CAB-0nn` **n'ont pas été
renumérotés** (un identifiant qu'on renumérote ne sert plus à rien), donc leur dizaine groupe les
écrans d'une version sans nommer son numéro ; et les trois niveaux de spécification (*Complète*,
*Intention*, *Esquisse*) sont désormais définis **une seule fois**, dans `VERSIONS-A-VENIR.md`, que
cette partie cite au lieu d'en porter une seconde définition.

**Un défaut d'ordre trouvé au passage, non tranché** : SPEC-UI-CAB-040 (clôture, 9.8.0) calcule les
dotations depuis `immobilisations[].plan`, que SPEC-UI-CAB-050 (9.7.0) est la première à remplir.
Sans conséquence pour un dossier sur SkanFact — les dotations arrivent déjà calculées dans le
paquet depuis la 9.0.0 — mais un dossier **hors SkanFact** ne peut alors pas être clôturé avec ses
amortissements, et c'est le dossier payant. Soit on échange les deux versions, soit on garde l'ordre
et la page écrit la limite. La décision revient à Skander ; elle est rappelée dans
`VERSIONS-A-VENIR.md`, « Ce que la relecture n'a pas vu ».
