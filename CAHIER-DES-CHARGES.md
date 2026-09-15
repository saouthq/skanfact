# CAHIER-DES-CHARGES.md — la spécification technique de SkanFact

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
| `.skanask` | une question cabinet → client (9.9.0) | JSON scellé | oui, pour le client (X25519) | oui, par le cabinet | SPEC-FMT-006 (Cible) |
| `.skanclose` | la clôture d'exercice cabinet → client (9.6.0) | ZIP scellé (JSON + PDF) | oui, pour le client | oui, par le cabinet | SPEC-FMT-007 (Cible) |
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

**Achat** (`newPurchase(kind, supplierId)`) : `{ id, kind: 'facture'|'depense', supplierId, number
(celui du fournisseur), date, dueDate, subject, category, notes, fees: number, withholdingRate,
lines: [{ label, qty, unit, unitPrice, vatRate, destination: 'charge'|'stock'|'immobilisation',
deductible: boolean }], payments, attachments, createdAt, projectId? }`.

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
  "releves": [], "immobilisations": [], "declarations": [],
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
| `releves[]`, `immobilisations[]`, `declarations[]` | Array | `[]` en 9.2.0 ; formats écrits en 9.4.0 / 9.7.0 / 9.5.0 (Cible, hors de ce document) |
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
  "reponse": null }
```

`cles[].retiree?: true` retire une clé sans l'effacer. `reponse` reçoit `{ kid, publicKey, depuis }`
le jour de la mise en production (la clé créée le 15/09/2026 est **brûlée**, jamais l'embarquer).
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

### SPEC-FMT-003 — `.skanrecover` (Livré)

`{ "<RECOVER_MARK>": 1, "format": 1, "cabinet": "<nom>", "creeLe": "<ISO>", "avertissement": "…",
"coffre": <enveloppe AES-256-GCM + scrypt de { publicKey, privateKey, name, email }> }`
(`cabstore.makeRecovery`). Restaurer pose `recoveryExportedAt = creeLe`.

### SPEC-FMT-004 — l'enveloppe scellée (Livré)

Deux en-têtes texte, un corps binaire : `SKANPACK1\n<JSON>\n<corps>` (mot de passe : scrypt +
AES-256-GCM, `sealBuffer`) et `SKANPACKX1\n<JSON>\n<corps>` (cabinet : X25519 éphémère + HKDF-SHA256
+ AES-256-GCM, `sealForCabinet`). L'en-tête JSON porte `alg, kdf, salt, iv, tag` (+ `ephemeral`,
`destinataire` = empreinte du cabinet) **et l'entête en clair** `{ entreprise, matricule, periode,
definitif, format }` — un paquet mal rangé reste identifiable sans clé.

### SPEC-FMT-006 — `.skanask` (Cible 9.9.0) et SPEC-FMT-007 — `.skanclose` (Cible 9.6.0)

Spécifications cibles, à figer au moment de la version. Ce qui est décidé : les deux sont scellés
**pour le client** par `sealForCabinet` avec la clé publique du client (celle de SPEC-DATA-004b), et
signés par le cabinet. `.skanask` = JSON `{ format: 1, dossier, questions: [{ id, mois, docId?,
ligneId?, texte, poseeLe }] }`. `.skanclose` = ZIP scellé contenant `cloture.json` `{ format: 1,
exercice, closLe, anouveaux: [{ compte, debit, credit }], inventaire: [Écriture] }` et
`cloture.pdf` lisible par tous. L'app entreprise verrouille l'exercice à l'import et refuse une
clôture suivante tant que le précédent `.skanclose` n'est pas importé (`QUESTIONS.md` § 16, 9.6.0).

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
  `ERR-CAB-022` ; **fusion** : aucune en 9.2.0 (un poste), 9.8.0 reprend `mergeData` ; **épinglage** :
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
  `clePublique`** → refus `ERR-CAB-031` ; (2) présent : `crypto.verify(null, octets, cle, sig)` faux
  → refus `ERR-CAB-032` ; (3) vrai et dossier sans `clePublique` → **épingler** (`clePublique = cle`,
  `cleEpingleeLe`, `cleEmpreinte`, `audit`) ; (4) vrai et `cleEmpreinte` différente → refus
  `ERR-CAB-030` en nommant le dossier et les deux empreintes.
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
`/console` servent la console (HTML inline). Les entrées/sorties exactes sont dans les handlers ;
ce tableau en donne le contrat — À VÉRIFIER champ par champ dans le fichier avant de coder un client.

| ID | Méthode | Chemin | Auth | Entrée | Sortie | Erreurs |
|---|---|---|---|---|---|---|
| SPEC-API-001 | POST | `/v1/licence/etat` | en-tête secret d'application (`APP_SECRET`) | `{ cle?, deviceId, deviceNom, plateforme, version }` — **et rien d'autre** (un test compte les champs) | `{ etat: 'active'|'revoquee'|'inconnue'|'essai', reponse?: <signée : sujet, etat, date, sig> }` | 403 secret faux ; 503 `LICENCE_PUBLIC_KEYS` absent **seulement si `LICENCE_REQUISE=1`** ; sinon laisse passer |
| SPEC-API-002 | GET | `/v1/admin/etat` | `ADMIN_SECRET` (≥ `ADMIN_MIN` car.) | — | `{ ok, cleServeur: { ok, kid, raison? }, resend: boolean, … }` | 403 ; 503 console non configurée |
| SPEC-API-003 | GET | `/v1/admin/stats` | admin | — | cartes (licences actives = non remplacées, non révoquées, non expirées ; essais ; activations) | 403 |
| SPEC-API-004 | GET/POST | `/v1/admin/clients[/<id>]` | admin | POST `{ nom, matricule?, email?, tel?, adresse?, notes? }` | liste / client | 400 (`nettoyer*` refuse avec sa raison), 403, 404 |
| SPEC-API-005 | GET/POST | `/v1/admin/licences[/<id>[/revoquer|renouveler|changer-offre|envoyer]]` | admin | POST émission `{ clientId, offre, duree|exp, prix, devise, remise?, cabinet? }` ; `revoquer { motif }` (obligatoire) ; `renouveler { … }` ; `changer-offre { offre, prixNouveau }` ; `envoyer` | licence `{ id, kid, empreinte, offre, debut, fin, statut (déduit : révoquée > expirée > remplacée > active), charge, cle (refabriquée, jamais stockée) }` | 400 ; 403 ; 404 ; **409** renouveler une révoquée/remplacée ; 503 clé serveur incohérente |
| SPEC-API-006 | GET | `/v1/admin/activations` | admin | — | `[{ empreinte (ou 'ESSAI'), device_id, device_nom, plateforme, version, premiere_fois, derniere_fois }]` | 403 |
| SPEC-API-007 | GET/POST | `/v1/admin/ventes[?non_facturees=1][/<id>/payee|facturee]` | admin | `payee { moyen?, date? }` → envoie la clé si Resend réglé et adresse présente (une fois, `envoyee_le`) ; `facturee { numero }` | ventes avec `cle` refabriquée quand non facturées | 400, 403, 404 |
| SPEC-API-008 | GET | `/v1/admin/evenements` | admin | — | journal `{ quand, quoi, client_id, licence_id, detail, par_qui }` | 403 |
| SPEC-API-009 | POST | `/v1/admin/importer` | admin | `{ licences: [18 champs de `chargeHistorique`] }` | `{ importees, dejaLa, refusees: [{ id, raison }] }` — **refuse** une vente incomplète, ne la met pas à null | 400, 403 |
| **SPEC-API-011** | GET | `/v1/admin/export` | admin | — | **Cible Phase 0** : `{ format: 1, exporteLe, tables: { clients: [...], licences: [...], activations: [...], ventes: [...], jetons: [...], evenements: [...] } }` — toutes les lignes, `charge` incluse, **jamais** une clé privée (il n'y en a pas en base) | 403 |

Seule requête sortante du worker : Resend (un test compte les `fetch(`). Toute réponse restrictive
est **signée, datée, adressée** (`sujet` = `empreinteCle` = SHA-256 tronqué à 32 hex de la clé).

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
empreinte UNIQUE, nom, email, quota, cree_le }` — à spécifier avec la 9.3.x). Le schéma **ne porte
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

---

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
  `reglages.js`) ; tests `test/run-tests.js` (un seul fichier, à découper par domaine en 9.5.1),
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
.github/workflows/release.yml      build/{icon*.png, icon.icns, icon.ico, cabinet.config.js, licences-publiques.json, licence-public.json}
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
(vérifié). À VÉRIFIER : les fichiers de `build/` non listés par mon extraction.

### 14.3 Ce que je n'ai pas pu vérifier

Chaque point se vérifie en moins d'une heure, par la commande indiquée. *(Huit points de la première
version de cette liste ont été vérifiés dans le code avant de rendre le document et intégrés là où
ils manquaient : l'ordre du format 1 de la clé, les champs du `Verdict`, les neuf ids de `MODULES`,
`isValidData`, le champ `integrity`, les deux index D1 uniques, le motif de `packFileName`, le
preload du Cabinet.)*

1. **Les identifiants des sous-vues de l'onglet Écritures** (livre-journal, OD, lettrage, 8.9.0) :
   mon extraction n'a pas trouvé de constante nommée ; `sed -n '8484,8700p' src/renderer/app.js`
   avant d'écrire `sousVues` de SPEC-FUNC-101.
2. **Les entrées/sorties exactes de chaque route** de la plateforme (je donne le contrat, pas le
   JSON champ par champ) → lire les handlers de `skanfact-api.mjs` entre les lignes 600 et 1 000.
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
9. **Les fichiers de `build/`** non listés par mon extraction → `ls build`.

*Réponse à la question du document — « un développeur peut-il coder la 9.1.0 sans poser une seule
question ? » : oui pour SPEC-FUNC-100/101, SPEC-UI-ENT-001/002/003, SPEC-UI-CAB-001/002, SPEC-OUT-001
à 006 et les 24 tests de la Partie 11.2, à deux réserves près qu'il rencontrera en lisant le code :
le point 1 (les sous-vues de l'onglet Écritures), résolu par un `sed` sur `routes.compta`.*
