// Logique métier partagée (calculs, numérotation, montants en lettres, template PDF, journal des ventes).
// Fonctionne dans le navigateur (window.SkanCore) et dans Node (module.exports) pour les tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkanCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const VAT_RATES = [0, 7, 13, 19];
  // Taux de retenue à la source usuels en Tunisie (À VÉRIFIER avec le comptable selon la nature de la prestation).
  const WITHHOLDING_RATES = [0, 1.5, 3, 5, 10, 15];
  const PAYMENT_METHODS = [['virement', 'Virement'], ['cheque', 'Chèque'], ['especes', 'Espèces'], ['traite', 'Traite'], ['carte', 'Carte'], ['autre', 'Autre']];
  const PREFIX = { devis: 'DEV', facture: 'FAC', avoir: 'AVO', proforma: 'PRO', commande: 'BC', livraison: 'BL', contrat: 'CTR' };
  const TITLES = { devis: 'Devis', facture: 'Facture', avoir: 'Avoir', proforma: 'Facture proforma', commande: 'Bon de commande', livraison: 'Bon de livraison', contrat: 'Contrat de prestation' };
  // Les quatre types ajoutés en 2.6.0. Aucun n'a de valeur comptable : ils n'entrent ni dans le journal
  // des ventes, ni dans la TVA, ni dans le chiffre d'affaires. Seules la facture et l'avoir comptent.
  const EXTRA_TYPES = ['proforma', 'commande', 'livraison', 'contrat'];
  const SALES_TYPES = ['facture', 'avoir'];

  // Réglages d'une entreprise. Volontairement vides : SkanFact ne présuppose aucune société,
  // l'assistant de première utilisation les remplit. Voir onboarding dans app.js.
  const DEFAULT_COMPANY = {
    name: '',
    matricule: '',
    rc: '',
    cnss: '',                // matricule CNSS employeur (v6)
    capital: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    rib: '',
    bank: '',
    logo: '',
    footer: '',           // vide : la ligne légale est composée à partir du nom et du matricule
    stampFee: 1.0,        // timbre fiscal (DT) par facture — À VÉRIFIER avec le comptable
    quoteValidityDays: 30,
    paymentTermsDays: 30,
    defaultWithholdingRate: 0,
    paymentTerms: 'Paiement par virement bancaire à réception de la facture.',
    quoteTerms: 'Pour accepter ce devis, retournez-le daté et signé avec la mention « Bon pour accord ».',
    paymentTermsEn: 'Payment by bank transfer upon receipt of invoice.',
    quoteTermsEn: 'To accept this quote, please return it dated and signed with the mention "Approved".',
    currency: 'DT',
    defaultLang: 'fr',
    stampImage: '',       // cachet / signature (data URL) sur les documents
    theme: 'light',       // light | dark | auto
    tagline: '',
    accountantEmail: '',
    activity: '',         // secteur choisi à la première utilisation (voir ACTIVITIES)
    primaryColor: '#1b2430',
    accentColor: '#0f9d8f',
    revenueTarget: 0,     // objectif de chiffre d'affaires HT pour l'année (0 = pas d'objectif)
    dormantDays: 180,     // au-delà, un client est considéré comme endormi dans les statistiques
    setupDone: false,     // l'assistant de première utilisation a été mené jusqu'au bout
    // Le taux de TVA des nouvelles lignes (7.1.0). Il valait 19 % en dur partout, y compris pour un
    // métier que l'assistant sait exonéré : quelqu'un qui choisissait « Santé et paramédical » (TVA
    // 0 %) obtenait un catalogue à 0 % et, dès qu'il tapait une ligne à la main, du 19 %. Vide = 19 %.
    defaultVatRate: '',
    // Les modules affichés dans la barre latérale (7.0.0). `null` = aucun choix enregistré, donc
    // toute l'application, comme avant : une installation existante ne perd rien à la mise à jour.
    // Un module absent de cette liste mais qui contient des données se montre quand même (moduleOn).
    modules: null
  };

  // Secteurs proposés au premier démarrage : ils préremplissent le catalogue, le taux de TVA
  // habituel et le slogan. Rien n'est imposé, tout se modifie ensuite.
  // vat : taux de TVA proposé pour les prestations du secteur — À VÉRIFIER avec le comptable.
  const ACTIVITIES = [
    {
      id: 'informatique', label: 'Informatique et cybersécurité', tagline: 'Cybersécurité · Infrastructure · Services informatiques', vat: 19,
      catalog: [
        ['Audit de sécurité réseau', 'Cartographie, scan de vulnérabilités, rapport et plan d\'action', 1200, 'forfait'],
        ['Maintenance et supervision', 'Surveillance des équipements, mises à jour, intervention sous 24 h', 250, 'mois'],
        ['Installation poste de travail', 'Préparation, sécurisation et mise en réseau d\'un poste', 120, 'u'],
        ['Sauvegarde externalisée', 'Sauvegarde chiffrée automatique avec vérification mensuelle', 90, 'mois'],
        ['Déplacement', 'Frais de déplacement', 60, 'u']
      ]
    },
    {
      id: 'batiment', label: 'Bâtiment et travaux', tagline: 'Construction · Rénovation · Second œuvre', vat: 19,
      catalog: [
        ['Main-d\'œuvre', 'Heure de travail sur chantier', 25, 'h'],
        ['Déplacement et installation de chantier', '', 150, 'forfait'],
        ['Fourniture de matériaux', 'Refacturation des matériaux, sur justificatifs', 0, 'lot'],
        ['Évacuation des gravats', '', 200, 'forfait']
      ]
    },
    {
      id: 'conseil', label: 'Conseil, formation et services', tagline: 'Conseil · Accompagnement · Formation', vat: 19,
      catalog: [
        ['Journée de conseil', 'Intervention sur site ou à distance', 600, 'jour'],
        ['Formation', 'Session pour un groupe, support fourni', 150, 'h'],
        ['Rédaction de livrable', 'Rapport, procédure, cahier des charges', 400, 'forfait'],
        ['Suivi mensuel', 'Point régulier et disponibilité par email', 300, 'mois']
      ]
    },
    {
      id: 'commerce', label: 'Commerce et vente de produits', tagline: '', vat: 19,
      catalog: [
        ['Produit', 'Désignation du produit vendu', 0, 'u'],
        ['Livraison', 'Frais de livraison', 15, 'u'],
        ['Installation / mise en service', '', 80, 'u']
      ]
    },
    {
      id: 'sante', label: 'Santé et paramédical', tagline: '', vat: 0,
      catalog: [
        ['Consultation', '', 50, 'séance'],
        ['Séance de suivi', '', 40, 'séance'],
        ['Déplacement à domicile', '', 20, 'u']
      ]
    },
    {
      id: 'artisanat', label: 'Artisanat et création', tagline: 'Fait main · Sur mesure', vat: 19,
      catalog: [
        ['Pièce sur mesure', 'Création personnalisée', 0, 'u'],
        ['Main-d\'œuvre', 'Heure de travail en atelier', 20, 'h'],
        ['Matières premières', '', 0, 'lot']
      ]
    },
    { id: 'autre', label: 'Autre activité', tagline: '', vat: 19, catalog: [] }
  ];

  // ---------- les modules et la barre latérale (7.0.0) ----------
  //
  // Pourquoi cette liste existe : la barre latérale vivait en dur dans index.html, 19 liens écrits à
  // la main, et `setWindowTitle` relisait le TEXTE du lien pour composer le titre de la fenêtre. À
  // dix-neuf entrées elle ne tenait plus sur aucun écran : à 1440×900 « Paramètres » et « Aide »
  // étaient hors champ, et « Aide » l'était même à 1680×1050. Quelqu'un qui se perd cherche le bouton
  // Aide ; il était sous le plancher.
  //
  // On ne retire aucune fonction : on les présente dans l'ordre. Un module que l'utilisateur n'a pas
  // demandé reste atteignable par la palette, par son adresse et par la page « Tous les modules ».
  //
  // `toujours: true` = le cœur du métier, jamais masquable.
  // `compte(data)`   = ce que le module contient. C'est LE garde-fou : un module qui contient quelque
  //                    chose se montre tout seul, quoi qu'en dise le réglage. On ne cache jamais le
  //                    travail de quelqu'un — surtout pas celui qu'il a saisi avant de changer d'avis.
  const MODULES = [
    { id: 'ventes', label: 'Devis et factures', toujours: true,
      quoi: 'Proposer un prix, facturer, se faire payer.',
      pages: ['devis', 'factures', 'relances'] },
    { id: 'fichiers', label: 'Clients et catalogue', toujours: true,
      quoi: 'Les gens à qui tu vends et ce que tu vends.',
      pages: ['clients', 'catalogue'] },
    { id: 'pieces', label: 'Proforma, bons et contrats',
      quoi: 'Les pièces qui entourent la facture : proforma, bon de commande, bon de livraison, contrat à signer, et la facturation qui se répète toute seule.',
      pages: ['autres', 'contrats'],
      compte: d => (d.documents || []).filter(x => EXTRA_TYPES.includes(x.type)).length + (d.recurring || []).length },
    { id: 'achats', label: 'Achats et fournisseurs',
      quoi: "Ce que tu dépenses, et la TVA que tu récupères dessus.",
      pages: ['achats', 'fournisseurs'],
      compte: d => (d.purchases || []).length + (d.suppliers || []).length },
    { id: 'stock', label: 'Stock et garanties',
      quoi: 'Ce qui dort sur l\'étagère, et le matériel installé chez tes clients.',
      pages: ['stock', 'garanties'],
      compte: d => (d.stockAdjustments || []).length + (d.serials || []).length
        + (d.catalog || []).filter(c => c.tracked).length },
    { id: 'immos', label: 'Immobilisations',
      quoi: 'Ce que tu gardes : matériel, véhicule, mobilier — et ce que ça coûte chaque année.',
      pages: ['immos'],
      compte: d => (d.assets || []).length },
    { id: 'paie', label: 'Salariés et paie',
      quoi: 'Bulletins, congés, avances et déclarations sociales.',
      pages: ['paie'],
      compte: d => (d.employees || []).length + (d.payslips || []).length },
    { id: 'pilotage', label: 'Trésorerie, marges, statistiques',
      quoi: "Est-ce que tu as de quoi payer le mois prochain, et est-ce que tu gagnes de l'argent ?",
      pages: ['tresorerie', 'marges', 'stats'],
      compte: d => (d.accounts || []).length + (d.movements || []).length + (d.projects || []).length },
    { id: 'compta', label: 'Comptabilité', toujours: true,
      quoi: 'Ce que tu donnes à ton comptable : journaux, TVA, écritures, clôtures, paquet mensuel.',
      pages: ['compta'] }
  ];

  // Les pages, dans l'ordre de la barre latérale. `titre` sert à la fois au lien, au titre de la
  // fenêtre et à la palette — une seule source, sinon les trois divergent (et ils divergeaient).
  //
  // `famille` est l'intertitre affiché. Elle ne suit PAS le découpage en modules : un intertitre par
  // module en ferait huit, et huit intertitres coûtent 250 px de barre — on aurait remplacé un
  // débordement par un autre. Les modules décident de ce qui s'affiche, les familles de comment
  // c'est rangé. « Fichiers » a disparu : personne ne cherche un client dans « Fichiers ».
  const PAGES = [
    { id: 'dashboard', titre: 'Accueil', module: null, hash: '#/dashboard' },
    { id: 'devis', titre: 'Devis', module: 'ventes', famille: 'Vendre' },
    { id: 'factures', titre: 'Factures', module: 'ventes', famille: 'Vendre' },
    { id: 'relances', titre: 'Relances', module: 'ventes', famille: 'Vendre' },
    { id: 'clients', titre: 'Clients', module: 'fichiers', famille: 'Vendre' },
    { id: 'catalogue', titre: 'Catalogue', module: 'fichiers', famille: 'Vendre' },
    { id: 'autres', titre: 'Autres documents', module: 'pieces', famille: 'Vendre' },
    { id: 'contrats', titre: 'Contrats', module: 'pieces', famille: 'Vendre' },
    { id: 'achats', titre: 'Achats', module: 'achats', famille: 'Acheter' },
    { id: 'fournisseurs', titre: 'Fournisseurs', module: 'achats', famille: 'Acheter' },
    { id: 'stock', titre: 'Stock', module: 'stock', famille: 'Acheter' },
    { id: 'garanties', titre: 'Garanties', module: 'stock', horsMenu: true },
    { id: 'immos', titre: 'Immobilisations', module: 'immos', famille: 'Acheter' },
    { id: 'tresorerie', titre: 'Trésorerie', module: 'pilotage', famille: 'Piloter' },
    { id: 'marges', titre: 'Marges', module: 'pilotage', famille: 'Piloter' },
    { id: 'stats', titre: 'Statistiques', module: 'pilotage', famille: 'Piloter' },
    { id: 'paie', titre: 'Paie', module: 'paie', famille: 'Piloter' },
    { id: 'compta', titre: 'Comptabilité', module: 'compta', famille: 'Piloter' },
    { id: 'modules', titre: 'Tous les modules', module: null, horsMenu: true },
    { id: 'parametres', titre: 'Paramètres', module: null, pied: true },
    { id: 'aide', titre: 'Aide', module: null, pied: true }
  ];

  // ---------- tout effacer (7.0.0) ----------
  //
  // « Tout effacer » vidait sept listes sur trente, parce qu'elle était écrite à la main et qu'aucun
  // des treize modules ajoutés depuis n'y a été ajouté. Après avoir chargé le jeu d'exemple puis
  // cliqué « Tout effacer », il restait donc de faux fournisseurs, de faux salariés avec de faux
  // numéros CIN, de faux bulletins, de faux comptes bancaires et de faux amortissements.
  //
  // La liste ne s'écrit plus : elle se DÉDUIT de DEFAULT_DATA. Un module ajouté demain est vidé sans
  // que personne y pense, et un test vérifie qu'aucune clé n'y échappe.
  //
  // `garderSociete` : la fiche société (nom, logo, cachet, RIB, réglages) n'est pas une donnée de
  // travail, c'est l'identité de l'entreprise — on ne la jette pas en effaçant des factures. Sauf
  // si elle vient du jeu d'exemple : garder « DÉMO — Société de services SUARL » et son faux RIB,
  // c'est envoyer la première vraie facture avec un matricule inventé et un compte qui n'existe pas.
  const GARDE_A_LA_RACINE = ['version', 'company'];
  function wipeData(data, opts) {
    const o = opts || {};
    const out = data;
    Object.keys(DEFAULT_DATA).forEach(k => {
      if (GARDE_A_LA_RACINE.includes(k)) return;
      const vide = DEFAULT_DATA[k];
      out[k] = Array.isArray(vide) ? [] : (vide && typeof vide === 'object') ? {} : vide;
    });
    if (!o.garderSociete) out.company = { ...DEFAULT_COMPANY, ...(o.company || {}) };
    else if (out.company) delete out.company.demo;   // ce qui reste est bien à lui, désormais
    return out;
  }

  // Le jeu d'exemple se reconnaît : sans ça, on ne peut ni le signaler à l'écran, ni proposer d'en
  // sortir, ni empêcher sa fausse identité de servir à une vraie facture.
  const estDemo = data => !!(data && data.demo);

  // Le taux de TVA d'une ligne neuve. Il se règle dans Paramètres et l'assistant le pose à partir du
  // métier déclaré. `''`, `null` ou `undefined` = 19 % ; `0` est une valeur légitime (exonération),
  // d'où le test explicite plutôt qu'un `||`.
  function defaultVat(company) {
    const v = (company || {}).defaultVatRate;
    if (v === '' || v === null || v === undefined) return 19;
    const n = Number(v);
    return VAT_RATES.includes(n) ? n : 19;
  }
  // Une ligne de document neuve, avec le bon taux. Il y avait huit `vatRate: 19` écrits à la main.
  const newLine = (company, extra) => ({ label: '', description: '', qty: 1, unit: '', unitPrice: 0, vatRate: defaultVat(company), ...(extra || {}) });

  const moduleById = id => MODULES.find(m => m.id === id) || null;
  const pageById = id => PAGES.find(p => p.id === id) || null;
  const pageTitle = id => { const p = pageById(id); return p ? p.titre : ''; };

  // Ce que le module contient aujourd'hui. Un module sans compteur (le cœur) n'a pas à se justifier.
  function moduleCount(data, id) {
    const m = moduleById(id);
    if (!m || !m.compte) return 0;
    try { return Number(m.compte(data || {})) || 0; } catch (_) { return 0; }
  }

  // Un module est actif s'il est choisi OU s'il contient quelque chose. Le second terme n'est jamais
  // stocké : il se recalcule, pour qu'un module rempli ne puisse pas être masqué par un réglage.
  function moduleOn(data, id) {
    const m = moduleById(id);
    if (!m) return false;
    if (m.toujours) return true;
    const choisis = ((data || {}).company || {}).modules;
    // Absent = toute l'application, comme avant : une installation existante ne perd rien.
    if (!Array.isArray(choisis)) return true;
    if (choisis.includes(id)) return true;
    return moduleCount(data, id) > 0;
  }

  // Pourquoi ce module est visible : 'coeur', 'choisi', 'rempli' ou 'tout' (aucun choix enregistré).
  function moduleWhy(data, id) {
    const m = moduleById(id);
    if (!m) return '';
    if (m.toujours) return 'coeur';
    const choisis = ((data || {}).company || {}).modules;
    if (!Array.isArray(choisis)) return 'tout';
    if (choisis.includes(id)) return 'choisi';
    return moduleCount(data, id) > 0 ? 'rempli' : '';
  }

  // Les pages de la barre latérale, dans l'ordre, groupées par module. `pied` sort du compte : ces
  // deux-là (Paramètres, Aide) vivent dans le pied de la barre, qui ne défile jamais.
  function navPages(data) {
    return PAGES.filter(p => !p.horsMenu && !p.pied && (!p.module || moduleOn(data, p.module)));
  }

  // Ce que l'assistant de première utilisation allume selon le métier déclaré. Rien n'est imposé :
  // l'écran « Qu'est-ce que tu fais ? » propose ces cases cochées, et l'utilisateur décoche.
  const MODULES_PAR_ACTIVITE = {
    commerce: ['achats', 'stock', 'pilotage'],
    artisanat: ['achats', 'stock', 'pieces'],
    batiment: ['achats', 'pieces', 'pilotage'],
    informatique: ['achats', 'pieces'],
    conseil: ['pieces'],
    sante: ['achats'],
    autre: []
  };
  const modulesSuggeres = activity => ['ventes', 'fichiers', 'compta']
    .concat(MODULES_PAR_ACTIVITE[activity] || []);

  const DEFAULT_DATA = {
    version: 6,
    company: DEFAULT_COMPANY,
    clients: [],
    catalog: [],
    documents: [],
    recurring: [],   // contrats récurrents
    templates: [],   // modèles de documents
    snippets: [],    // textes prédéfinis
    suppliers: [],   // fournisseurs (v4)
    purchases: [],   // factures d'achat et dépenses (v4)
    expenseCategories: [],   // catégories ajoutées par l'utilisateur, en plus de DEFAULT_EXPENSE_CATEGORIES
    fiscalDeadlines: [],     // échéances fiscales activées/modifiées par l'utilisateur (v4)
    assets: [],              // immobilisations amortissables (3.5.0)
    stockAdjustments: [],    // mouvements de stock saisis à la main : départ, casse, inventaire (v5)
    serials: [],             // unités suivies par numéro de série (v5)
    employees: [],           // salariés (v6)
    payslips: [],            // bulletins de paie (v6)
    payrollSettings: {},     // barèmes CNSS/IRPP modifiés par l'utilisateur (v6)
    leaves: [],              // congés et absences (v6)
    advances: [],            // avances sur salaire (v6)
    socialFilings: [],       // déclarations sociales marquées déposées (v6)
    vatCarryIn: {},          // crédit de TVA venu de l'année précédente, par année : { '2026': 1234 }
    projects: [],            // affaires : relient ventes et achats pour une marge exacte (v4)
    fixedCategories: [],     // catégories de charges considérées comme fixes (vide = valeurs par défaut)
    accounts: [],            // comptes de trésorerie : banque, caisse… (v4)
    movements: [],           // mouvements libres : salaires, impôts, apports — ce qui n'a ni facture ni achat
    deleted: [],             // pièces supprimées, pour qu'elles ne reviennent pas d'un autre poste (v4)
    conflictArchive: [],     // versions écartées lors d'une fusion : rien n'est détruit sans trace
    closedUntil: '',         // dernier jour clôturé : rien de daté avant ne bouge plus (6.0.0)
    closureLog: [],          // chaque clôture et chaque réouverture, avec son motif (6.0.0)
    packs: [],               // paquets mensuels construits pour le cabinet (6.1.0)
    demo: false,             // ces données viennent du jeu d'exemple (7.0.0) — l'app le dit à l'écran
    counters: {}
  };

  // Statuts enregistrés. Pour une facture, « payée » / « partielle » / « retard » sont DÉDUITS des paiements
  // et des avoirs (effectiveStatus), jamais saisis à la main.
  const STATUSES = {
    devis: ['brouillon', 'envoyé', 'accepté', 'refusé'],
    facture: ['brouillon', 'envoyée', 'annulée'],
    avoir: ['brouillon', 'émis'],
    proforma: ['brouillon', 'envoyée', 'annulée'],
    commande: ['brouillon', 'reçue', 'livrée', 'annulée'],
    livraison: ['brouillon', 'émis', 'signé', 'annulé'],
    contrat: ['brouillon', 'envoyé', 'signé', 'terminé', 'annulé']
  };
  const DISPLAY_STATUSES = {
    devis: ['brouillon', 'envoyé', 'expiré', 'accepté', 'refusé'],
    facture: ['brouillon', 'envoyée', 'partielle', 'retard', 'payée', 'annulée'],
    avoir: STATUSES.avoir,
    proforma: STATUSES.proforma, commande: STATUSES.commande, livraison: STATUSES.livraison, contrat: STATUSES.contrat
  };
  const STATUS_LABELS = { partielle: 'partiellement payée', retard: 'en retard', expiré: 'expiré' };

  // ---------- utilitaires ----------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

  const CURRENCIES = ['DT', 'EUR', 'USD', 'GBP', 'CHF', 'MAD', 'DZD'];
  function decimalsFor(currency) { return !currency || currency === 'DT' || currency === 'TND' ? 3 : 2; }
  function money(n, currency, decimals, lang) {
    const v = round3(n);
    const neg = v < 0;
    const dec = decimals != null ? decimals : decimalsFor(currency);
    const en = lang === 'en';
    const s = Math.abs(v).toFixed(dec).replace('.', en ? '.' : ',').replace(/\B(?=(\d{3})+(?!\d))/g, en ? ',' : ' ');
    const out = (neg ? '− ' : '') + s;
    return currency ? `${out} ${currency}` : out;
  }
  // Montant d'un document ramené à la devise de la société (taux saisi sur le document : 1 devise = x DT)
  // Le taux d'un document : « 1 devise = x DT ». Vaut 1 quand le document est dans la devise de
  // l'entreprise — c'est-à-dire dans la quasi-totalité des cas.
  function rateOf(doc, company) {
    const cur = (doc || {}).currency || (company || {}).currency;
    if (!cur || cur === (company || {}).currency) return 1;
    const r = Number((doc || {}).exchangeRate);
    return r > 0 ? r : 1;      // le repli existe pour ne rien faire planter ; `missingRate` le signale
  }

  // Un document en devise étrangère SANS taux de change saisi. Le repli à 1 de `rateOf` évite un
  // écran cassé, mais il fait compter 1 EUR = 1 DT : le journal des ventes, la TVA à déclarer, le
  // chiffre d'affaires et le tableau de bord deviennent faux **en silence**, d'un facteur trois.
  // Rien à l'écran ne le montrait. Cette fonction existe pour que l'application le dise.
  function missingRate(doc, company) {
    const cur = (doc || {}).currency || (company || {}).currency;
    if (!cur || cur === (company || {}).currency) return false;
    return !(Number((doc || {}).exchangeRate) > 0);
  }

  function toBase(doc, amount, company) {
    const cur = doc.currency || company.currency;
    if (!cur || cur === company.currency) return round3(amount);
    return round3(amount * rateOf(doc, company));
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // ---------- dates : une règle, une seule ----------
  // Une date de l'application est un JOUR DU CALENDRIER (« 2026-09-12 »), jamais un instant. Toute
  // l'arithmétique se fait donc en UTC pur, sur la chaîne, sans jamais passer par l'heure locale.
  // L'ancienne version construisait la date en heure LOCALE puis la relisait en UTC : à minuit à
  // Tunis (UTC+1) il est encore 23 h la veille en UTC, et `addDays(d, 1)` renvoyait… `d`. Sur une
  // machine réglée en UTC, rien ne se voyait ; sur le Mac de l'utilisateur, une échéance à 30 jours
  // tombait un jour trop tôt et la boucle de `workingDays` ne finissait jamais — l'app entière gelait.
  // `today()` est l'exception qui confirme la règle : c'est le jour LOCAL, celui du calendrier de
  // l'utilisateur, pas le jour UTC (qui, le soir, est déjà demain à l'est et encore hier à l'ouest).
  function isoDay(dt) { return dt.toISOString().slice(0, 10); }
  function addDays(iso, days) {
    const d = new Date(iso + 'T00:00:00Z');
    if (isNaN(d)) return '';
    d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
    return isoDay(d);
  }
  function daysInMonth(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }   // month 1-12
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function nl2br(s) { return escapeHtml(s).replace(/\n/g, '<br>'); }

  function statusLabel(s) { return STATUS_LABELS[s] || s; }

  // ---------- numérotation ----------
  // Format : DEV-2026-001 / FAC-2026-001 / AVO-2026-001, compteur par type et par année.
  // Devis : numéro au premier enregistrement. Factures et avoirs : numéro à l'ÉMISSION seulement
  // (un brouillon n'a pas de numéro), pour une numérotation continue sans trou.

  function nextNumber(data, type, dateIso) {
    const year = (dateIso || today()).slice(0, 4);
    const key = `${type}-${year}`;
    const prefix = PREFIX[type] || 'DOC';
    // On repart du max existant pour éviter un doublon si le compteur est incohérent.
    const existing = data.documents
      .filter(d => d.type === type && d.number && d.number.startsWith(`${prefix}-${year}-`))
      .map(d => parseInt(d.number.split('-')[2], 10) || 0);
    const fromDocs = existing.length ? Math.max(...existing) : 0;
    const fromCounter = data.counters[key] || 0;
    const seq = Math.max(fromDocs, fromCounter) + 1;
    data.counters[key] = seq;
    return `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
  }

  function isLocked(doc) { return (doc.type === 'facture' || doc.type === 'avoir') && doc.status !== 'brouillon'; }
  function isIssued(doc) { return doc.status !== 'brouillon'; }

  // ---------- calculs ----------

  function computeTotals(doc, company) {
    const lines = (doc.lines || []).map(l => {
      const qty = Number(l.qty) || 0;
      const unit = Number(l.unitPrice) || 0;
      const rate = Number(l.vatRate) || 0;
      const ht = round3(qty * unit);
      const vat = round3(ht * rate / 100);
      return { ...l, qty, unitPrice: unit, vatRate: rate, ht, vat, ttc: round3(ht + vat), noDiscount: !!l.noDiscount };
    });
    const totalHT = round3(lines.reduce((s, l) => s + l.ht, 0));
    const discountRate = Number(doc.discountRate) || 0;
    // La remise globale ne porte pas sur les lignes « noDiscount » (déduction d'un acompte déjà facturé).
    const discountable = round3(lines.filter(l => !l.noDiscount).reduce((s, l) => s + l.ht, 0));
    const discount = round3(discountable * discountRate / 100);
    const netHT = round3(totalHT - discount);
    // TVA par taux, appliquée après remise globale (remise répartie proportionnellement)
    const factor = discountable > 0 ? (discountable - discount) / discountable : 1;
    const vatByRate = {};
    lines.forEach(l => {
      const base = round3(l.noDiscount ? l.ht : l.ht * factor);
      vatByRate[l.vatRate] = vatByRate[l.vatRate] || { base: 0, vat: 0 };
      vatByRate[l.vatRate].base = round3(vatByRate[l.vatRate].base + base);
      vatByRate[l.vatRate].vat = round3(vatByRate[l.vatRate].vat + base * l.vatRate / 100);
    });
    const totalVAT = round3(Object.values(vatByRate).reduce((s, v) => s + v.vat, 0));
    // Timbre : d'office sur la facture, jamais sur un devis ou un bon. Sur l'avoir et la proforma il se
    // demande explicitement — une proforma n'est pas une facture, elle ne déclenche pas le droit de timbre.
    // À VÉRIFIER avec le comptable.
    const stampApplies = (doc.type === 'facture' && doc.applyStamp !== false)
      || ((doc.type === 'avoir' || doc.type === 'proforma') && doc.applyStamp === true);
    // Le timbre est un montant en DINARS fixé par l'État — pas un nombre sans unité. Sur une facture
    // en euros, l'ajouter tel quel ajoutait « 1 euro », soit 3,4 fois le timbre dû. Il se convertit
    // dans la devise du document, comme n'importe quel montant.
    // `exchangeRate` se lit « 1 devise = x DT » : un dinar vaut donc 1/x devise.
    // Le montant du timbre est GELÉ sur la pièce au moment de l'émission (7.1.1). Avant, il était
    // relu dans les réglages à chaque affichage : le jour où l'État change le timbre — et où
    // l'utilisateur met son réglage à jour — le total de TOUTES les factures déjà émises, envoyées
    // et déclarées changeait avec lui. Le PDF chez le client disait 1 191, l'application disait
    // 1 192, et le journal des ventes suivait l'application.
    // C'est la règle de la 5.0.0 sur les bulletins de paie (`slip.computed`), qui n'avait jamais été
    // appliquée aux factures. Un brouillon, lui, suit le réglage courant : il n'est encore rien.
    const timbreDu = doc.stampFee === undefined || doc.stampFee === null || doc.stampFee === ''
      ? (company.stampFee || 0) : Number(doc.stampFee) || 0;
    const stamp = stampApplies ? round3(timbreDu / rateOf(doc, company)) : 0;
    const totalTTC = round3(netHT + totalVAT + stamp);
    // Retenue à la source (factures / avoirs) : calculée sur le TTC hors timbre. À VÉRIFIER avec le comptable.
    // La retenue à la source ne se pratique que sur ce qui est réellement payé : facture, avoir, proforma.
    const withholdingRate = ['facture', 'avoir', 'proforma'].includes(doc.type) ? (Number(doc.withholdingRate) || 0) : 0;
    const withholding = round3((netHT + totalVAT) * withholdingRate / 100);
    const netToPay = round3(totalTTC - withholding);
    return { lines, totalHT, discountRate, discount, netHT, vatByRate, totalVAT, stamp, totalTTC, withholdingRate, withholding, netToPay };
  }

  // Avoirs émis rattachés à une facture
  function creditsFor(data, invoiceId) {
    return (data.documents || []).filter(d => d.type === 'avoir' && d.creditOf === invoiceId && d.status !== 'brouillon');
  }

  // Situation d'une facture : total, avoirs, paiements, reste à payer.
  function invoiceBalance(doc, data, company) {
    const totals = computeTotals(doc, company);
    const credits = creditsFor(data, doc.id);
    const credited = round3(credits.reduce((s, a) => s + computeTotals(a, company).netToPay, 0));
    const paid = round3((doc.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
    const remaining = round3(totals.netToPay - credited - paid);
    return { totals, credits, credited, paid, remaining };
  }

  // Statut affiché. Facture : déduit des paiements et des avoirs. Devis : « expiré » quand la date de
  // validité est passée sans réponse du client (le statut enregistré, lui, reste « envoyé »).
  function effectiveStatus(doc, data, company, todayIso) {
    if (doc.type === 'devis') {
      return doc.status === 'envoyé' && doc.dueDate && doc.dueDate < (todayIso || today()) ? 'expiré' : doc.status;
    }
    if (doc.type !== 'facture') return doc.status;
    if (doc.status === 'brouillon' || doc.status === 'annulée') return doc.status;
    const b = invoiceBalance(doc, data, company);
    if (b.remaining <= 0.0005) {
      return b.totals.netToPay > 0 && b.credited >= b.totals.netToPay - 0.0005 ? 'annulée' : 'payée';
    }
    if (b.paid > 0 || b.credited > 0) return 'partielle';
    if (doc.dueDate && doc.dueDate < (todayIso || today())) return 'retard';
    return 'envoyée';
  }

  // ---------- acompte / solde ----------

  // Lignes d'une facture d'acompte : un pourcentage du devis, une ligne par taux de TVA (base après remise).
  function depositLines(quote, percent, company) {
    const t = computeTotals(quote, company);
    const pct = Number(percent) || 0;
    return Object.keys(t.vatByRate).sort((a, b) => a - b).map(rate => ({
      label: `Acompte de ${String(pct).replace('.', ',')} % sur le devis ${quote.number}`,
      description: quote.subject || '',
      qty: 1, unit: '', unitPrice: round3(t.vatByRate[rate].base * pct / 100), vatRate: Number(rate), noDiscount: true
    }));
  }

  // Lignes d'une facture de solde : les lignes du devis, moins les acomptes déjà facturés (émis).
  function settlementLines(quote, depositInvoices) {
    const lines = (quote.lines || []).map(l => ({ ...l }));
    (depositInvoices || []).forEach(inv => {
      (inv.lines || []).forEach(l => lines.push({
        label: `Acompte déjà facturé (${inv.number})`, description: '', qty: 1, unit: '',
        unitPrice: -round3((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)), vatRate: Number(l.vatRate) || 0, noDiscount: true
      }));
    });
    return lines;
  }

  // ---------- journal des ventes, TVA, encaissements ----------

  function inPeriod(iso, from, to) { return (!from || iso >= from) && (!to || iso <= to); }

  function salesJournal(data, company, period) {
    period = period || {};
    const docs = (data.documents || [])
      .filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.number && inPeriod(d.date, period.from, period.to))
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.number || '').localeCompare(b.number || '', undefined, { numeric: true }));
    const clientName = id => ((data.clients || []).find(c => c.id === id) || {}).name || '';
    return docs.map(d => {
      const t = computeTotals(d, company);
      const cancelled = d.type === 'facture' && d.status === 'annulée';
      const rate = (d.currency && d.currency !== company.currency) ? (Number(d.exchangeRate) || 1) : 1;
      const sign = (cancelled ? 0 : (d.type === 'avoir' ? -1 : 1)) * rate;
      const status = d.type === 'facture' ? effectiveStatus(d, data, company, period.today) : d.status;
      const bal = d.type === 'facture' ? invoiceBalance(d, data, company) : null;
      const vatByRate = {};
      VAT_RATES.forEach(r => { const v = t.vatByRate[r]; vatByRate[r] = { base: round3((v ? v.base : 0) * sign), vat: round3((v ? v.vat : 0) * sign) }; });
      return {
        id: d.id, date: d.date, number: d.number, type: d.type, typeLabel: TITLES[d.type], client: clientName(d.clientId), subject: d.subject || '',
        ht: round3(t.netHT * sign), vatByRate, tva: round3(t.totalVAT * sign), timbre: round3(t.stamp * sign), ttc: round3(t.totalTTC * sign),
        rs: round3(t.withholding * sign), net: round3(t.netToPay * sign), status, statusLabel: statusLabel(status),
        paid: bal ? round3(bal.paid * rate) : 0, remaining: bal ? round3(bal.remaining * rate) : 0, currency: d.currency || company.currency, rate,
        withholdingCertificate: !!d.withholdingCertificate, creditOfNumber: d.creditOfNumber || ''
      };
    });
  }

  function vatSummary(rows) {
    const byRate = {};
    VAT_RATES.forEach(r => { byRate[r] = { base: 0, vat: 0 }; });
    const sum = { ht: 0, tva: 0, timbre: 0, ttc: 0, rs: 0, net: 0 };
    rows.forEach(r => {
      VAT_RATES.forEach(rate => { byRate[rate].base = round3(byRate[rate].base + r.vatByRate[rate].base); byRate[rate].vat = round3(byRate[rate].vat + r.vatByRate[rate].vat); });
      Object.keys(sum).forEach(k => { sum[k] = round3(sum[k] + r[k]); });
    });
    return { byRate, ...sum, count: rows.length };
  }

  function paymentsJournal(data, company, period) {
    period = period || {};
    const clientName = id => ((data.clients || []).find(c => c.id === id) || {}).name || '';
    const rows = [];
    (data.documents || []).filter(d => d.type === 'facture').forEach(d => {
      (d.payments || []).forEach(p => {
        if (!inPeriod(p.date, period.from, period.to)) return;
        const m = PAYMENT_METHODS.find(x => x[0] === p.method);
        rows.push({ id: p.id, date: p.date, number: d.number, client: clientName(d.clientId), amount: toBase(d, p.amount, company), method: m ? m[1] : (p.method || ''), reference: p.reference || '', note: p.note || '', docId: d.id, currency: d.currency || company.currency });
      });
    });
    return rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  // CSV lisible par Excel en français : séparateur « ; », virgule décimale, BOM UTF-8.
  function toCsv(rows, columns) {
    const cell = (v, type) => {
      if (type === 'money') return round3(v).toFixed(3).replace('.', ',');
      if (type === 'date') return fmtDate(v);
      const s = String(v == null ? '' : v);
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = columns.map(c => cell(c.label)).join(';');
    const body = rows.map(r => columns.map(c => cell(typeof c.get === 'function' ? c.get(r) : r[c.key], c.type)).join(';'));
    return '﻿' + [head].concat(body).join('\r\n') + '\r\n';
  }

  // ---------- migration des données ----------

  function migrateData(d) {
    const base = JSON.parse(JSON.stringify(DEFAULT_DATA));
    if (!d || typeof d !== 'object') return base;
    const data = {
      ...base, ...d,
      company: { ...base.company, ...(d.company || {}) },
      clients: Array.isArray(d.clients) ? d.clients : [], catalog: Array.isArray(d.catalog) ? d.catalog : [],
      documents: Array.isArray(d.documents) ? d.documents : [], counters: d.counters || {}
    };
    data.documents.forEach(doc => {
      if (!Array.isArray(doc.payments)) doc.payments = [];
      doc.withholdingRate = Number(doc.withholdingRate) || 0;
      // Avant la 1.4 : « payée » était un statut saisi. On le convertit en paiement pour garder l'historique.
      if (doc.type === 'facture' && doc.status === 'payée') {
        const t = computeTotals(doc, data.company);
        const paid = doc.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const rest = round3(t.netToPay - paid);
        if (rest > 0) doc.payments.push({ id: uid(), date: doc.paidDate || doc.dueDate || doc.date, amount: rest, method: 'autre', reference: '', note: 'Paiement enregistré avant la version 1.4' });
        doc.status = 'envoyée';
      }
    });
    if (!Array.isArray(data.recurring)) data.recurring = [];
    if (!Array.isArray(data.templates)) data.templates = [];
    if (!Array.isArray(data.snippets)) data.snippets = [];
    // Version 4 : achats. Rien à convertir dans l'existant — les trois listes sont simplement créées
    // vides si elles manquent, et un fichier v4 relu par une version antérieure les ignorerait sans casse.
    if (!Array.isArray(data.suppliers)) data.suppliers = [];
    if (!Array.isArray(data.purchases)) data.purchases = [];
    if (!Array.isArray(data.expenseCategories)) data.expenseCategories = [];
    if (!Array.isArray(data.fiscalDeadlines)) data.fiscalDeadlines = [];   // échéances fiscales personnalisées
    if (!data.vatCarryIn || typeof data.vatCarryIn !== 'object') data.vatCarryIn = {};  // crédit de TVA reporté par année
    // Partage à deux (3.2.0) : suppressions mémorisées et versions écartées lors d'une fusion.
    if (!Array.isArray(data.projects)) data.projects = [];
    if (!Array.isArray(data.assets)) data.assets = [];
    // Version 5 : stock. Rien à convertir — les articles existants ne sont pas suivis tant que la case
    // « Suivi en stock » n'est pas cochée, et la liste d'ajustements naît vide.
    if (!Array.isArray(data.stockAdjustments)) data.stockAdjustments = [];
    if (!Array.isArray(data.serials)) data.serials = [];
    // Version 6 : la paie. Rien à convertir — les trois listes naissent vides et les barèmes livrés
    // ne sont qu'un point de départ, que l'utilisateur ajuste avec son comptable.
    if (!Array.isArray(data.employees)) data.employees = [];
    if (!Array.isArray(data.payslips)) data.payslips = [];
    if (!data.payrollSettings || typeof data.payrollSettings !== 'object') data.payrollSettings = {};
    if (!Array.isArray(data.leaves)) data.leaves = [];
    if (!Array.isArray(data.advances)) data.advances = [];
    if (!Array.isArray(data.socialFilings)) data.socialFilings = [];
    // 6.0.0 : clôture de période. Rien à convertir — un dossier existant n'a simplement rien de
    // clôturé, et l'utilisateur clôture quand il veut.
    if (typeof data.closedUntil !== 'string') data.closedUntil = '';
    if (!Array.isArray(data.closureLog)) data.closureLog = [];
    if (!Array.isArray(data.packs)) data.packs = [];   // 6.1.0 : historique des envois au cabinet
    data.catalog.forEach(c => {
      c.tracked = c.tracked === true;
      c.minStock = Number(c.minStock) || 0;
      c.initialQty = Number(c.initialQty) || 0;
      c.initialCost = Number(c.initialCost) || 0;
      c.serialized = c.serialized === true;
      c.warrantyMonths = Number(c.warrantyMonths) || 0;
    });
    if (!Array.isArray(data.fixedCategories)) data.fixedCategories = [];
    if (!Array.isArray(data.accounts)) data.accounts = [];
    if (!Array.isArray(data.movements)) data.movements = [];
    if (!Array.isArray(data.deleted)) data.deleted = [];
    if (!Array.isArray(data.conflictArchive)) data.conflictArchive = [];
    data.purchases.forEach(p => {
      if (!Array.isArray(p.payments)) p.payments = [];
      if (!Array.isArray(p.lines)) p.lines = [];
      if (p.kind !== 'depense') p.kind = 'facture';
      p.withholdingRate = Number(p.withholdingRate) || 0;
      p.fees = Number(p.fees) || 0;
    });
    // Geler le timbre des pièces DÉJÀ émises sur la valeur en vigueur aujourd'hui. Sans ça, elles
    // resteraient à la merci du prochain changement de réglage — c'est-à-dire dans l'état qu'on
    // vient de corriger. On ne touche ni aux brouillons ni à celles qui ont déjà leur montant.
    const timbreCourant = Number((data.company || {}).stampFee);
    if (timbreCourant >= 0) {
      data.documents.forEach(x => {
        const emise = x.status && x.status !== 'brouillon';
        const porteUnTimbre = (x.type === 'facture' && x.applyStamp !== false)
          || ((x.type === 'avoir' || x.type === 'proforma') && x.applyStamp === true);
        if (emise && porteUnTimbre && (x.stampFee === undefined || x.stampFee === null || x.stampFee === '')) {
          x.stampFee = timbreCourant;
        }
      });
    }
    data.version = 6;
    return data;
  }

  // ---------- récurrences (contrats) ----------

  const PERIODS = [['month', 'Chaque mois'], ['quarter', 'Chaque trimestre'], ['year', 'Chaque année']];
  const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function monthLabel(iso) { const [y, m] = (iso || today()).split('-'); return `${MONTHS_FR[Number(m) - 1]} ${y}`; }

  // Ajoute n mois en gardant le jour demandé (31 → dernier jour du mois si besoin).
  function addMonths(iso, n, day) {
    const [y, m] = iso.split('-').map(Number);
    const total = y * 12 + (m - 1) + n;
    const ny = Math.floor(total / 12), nm = total % 12;
    const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    const d = Math.min(Math.max(1, Number(day) || Number(iso.slice(8, 10))), last);
    return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function nextRecurrenceDate(fromIso, every, day) {
    const months = every === 'year' ? 12 : every === 'quarter' ? 3 : 1;
    return addMonths(fromIso, months, day);
  }

  function dueRecurrences(data, todayIso) {
    const t = todayIso || today();
    return (data.recurring || []).filter(r => r.active !== false && r.nextDate && r.nextDate <= t);
  }

  // Reprise d'un contrat suspendu : première échéance à partir d'aujourd'hui (les mois suspendus ne sont pas facturés).
  function catchUpRecurrence(nextDate, every, day, todayIso) {
    const t = todayIso || today();
    let d = nextDate || t, guard = 0;
    while (d < t && ++guard < 240) d = nextRecurrenceDate(d, every, day);
    return d;
  }

  // Remplace {client}, {mois}, {numero}… dans un gabarit.
  function fillTemplate(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
  }

  // Brouillon de facture généré par un contrat pour une date donnée (l'app ajoute id/numéro/dates de création).
  function buildRecurringInvoice(rec, dateIso, company) {
    const vars = { mois: monthLabel(dateIso), annee: dateIso.slice(0, 4) };
    return {
      type: 'facture', number: '', status: 'brouillon', date: dateIso, dueDate: addDays(dateIso, company.paymentTermsDays || 30),
      clientId: rec.clientId, subject: fillTemplate(rec.subject, vars), reference: rec.reference || '',
      lines: (rec.lines || []).map(l => ({ ...l, label: fillTemplate(l.label, vars), description: fillTemplate(l.description || '', vars) })),
      discountRate: rec.discountRate || 0, applyStamp: true, notes: fillTemplate(rec.notes || '', vars), payments: [],
      withholdingRate: Number(rec.withholdingRate) || 0, recurringId: rec.id, lang: rec.lang || company.defaultLang || 'fr', currency: rec.currency || company.currency, exchangeRate: rec.exchangeRate || ''
    };
  }

  // ---------- tableau de bord ----------

  function monthKeys(todayIso, n) {
    const [y, m] = (todayIso || today()).split('-').map(Number);
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const total = y * 12 + (m - 1) - i; out.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`); }
    return out;
  }

  // CA HT facturé (avoirs déduits) et encaissements par mois, sur les n derniers mois, en devise société.
  function monthlySeries(data, company, todayIso, n) {
    const keys = monthKeys(todayIso, n || 12);
    const series = keys.map(k => ({ month: k, label: MONTHS_SHORT[Number(k.slice(5, 7)) - 1] + (k.endsWith('-01') || k === keys[0] ? ' ' + k.slice(2, 4) : ''), invoiced: 0, collected: 0 }));
    const byKey = Object.fromEntries(series.map(x => [x.month, x]));
    (data.documents || []).forEach(d => {
      if (d.type === 'facture' || d.type === 'avoir') {
        if (d.status !== 'brouillon' && d.status !== 'annulée' && byKey[(d.date || '').slice(0, 7)]) {
          byKey[d.date.slice(0, 7)].invoiced = round3(byKey[d.date.slice(0, 7)].invoiced + (d.type === 'avoir' ? -1 : 1) * toBase(d, computeTotals(d, company).netHT, company));
        }
        if (d.type === 'facture') (d.payments || []).forEach(p => { const k = (p.date || '').slice(0, 7); if (byKey[k]) byKey[k].collected = round3(byKey[k].collected + toBase(d, Number(p.amount) || 0, company)); });
      }
    });
    return series;
  }

  function topClients(data, company, fromIso, toIso, limit) {
    const totals = {};
    (data.documents || []).filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.status !== 'annulée' && inPeriod(d.date, fromIso, toIso))
      .forEach(d => { totals[d.clientId] = round3((totals[d.clientId] || 0) + (d.type === 'avoir' ? -1 : 1) * toBase(d, computeTotals(d, company).netHT, company)); });
    const name = id => ((data.clients || []).find(c => c.id === id) || {}).name || '—';
    return Object.keys(totals).map(id => ({ clientId: id, name: name(id), ht: totals[id] })).sort((a, b) => b.ht - a.ht).slice(0, limit || 5);
  }

  // Devis émis sur la période : acceptés / refusés / en attente, taux de conversion (acceptés / décidés)
  function quoteStats(data, fromIso, toIso, todayIso) {
    const q = (data.documents || []).filter(d => d.type === 'devis' && d.status !== 'brouillon' && inPeriod(d.date, fromIso, toIso));
    const accepted = q.filter(d => d.status === 'accepté').length, refused = q.filter(d => d.status === 'refusé').length;
    const decided = accepted + refused;
    const expired = q.filter(d => effectiveStatus(d, data, null, todayIso) === 'expiré').length;
    return { total: q.length, accepted, refused, expired, pending: q.length - decided, rate: decided ? Math.round(accepted / decided * 100) : null };
  }

  // Chiffres d'un client : facturé HT, encaissé, reste à payer, délai moyen, dates du premier et du dernier document.
  function clientSummary(data, company, clientId) {
    const docs = (data.documents || []).filter(d => d.clientId === clientId);
    const issued = docs.filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.status !== 'annulée');
    const ht = round3(issued.reduce((s, d) => s + (d.type === 'avoir' ? -1 : 1) * toBase(d, computeTotals(d, company).netHT, company), 0));
    const invoices = docs.filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée');
    const paid = round3(invoices.reduce((s, d) => s + toBase(d, (d.payments || []).reduce((x, p) => x + (Number(p.amount) || 0), 0), company), 0));
    const due = round3(invoices.reduce((s, d) => s + Math.max(0, toBase(d, invoiceBalance(d, data, company).remaining, company)), 0));
    const dates = docs.map(d => d.date).filter(Boolean).sort();
    const quotes = docs.filter(d => d.type === 'devis');
    const accepted = quotes.filter(d => d.status === 'accepté').length;
    const decided = accepted + quotes.filter(d => d.status === 'refusé').length;
    // Délai moyen de paiement de ce client : on raisonne sur l'ensemble des données (les avoirs comptent)
    const delays = [];
    invoices.forEach(d => {
      if (effectiveStatus(d, data, company, '9999-12-31') !== 'payée' || !(d.payments || []).length) return;
      const last = d.payments.map(p => p.date).sort().pop();
      if (last && d.date) delays.push(daysBetween(d.date, last));
    });
    return {
      docs, ht, paid, due, count: docs.length, invoiceCount: invoices.length, quoteCount: quotes.length,
      first: dates[0] || '', last: dates[dates.length - 1] || '',
      conversion: decided ? Math.round(accepted / decided * 100) : null,
      delay: delays.length ? Math.round(delays.reduce((s, x) => s + x, 0) / delays.length) : null
    };
  }

  // Délai moyen (jours) entre la date de facture et le dernier paiement, sur les factures soldées de la période
  function avgPaymentDelay(data, company, fromIso, toIso) {
    const delays = [];
    (data.documents || []).filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée' && inPeriod(d.date, fromIso, toIso)).forEach(d => {
      if (effectiveStatus(d, data, company, '9999-12-31') !== 'payée' || !(d.payments || []).length) return;
      const last = d.payments.map(p => p.date).sort().pop();
      if (last && d.date) delays.push(daysBetween(d.date, last));
    });
    return delays.length ? Math.round(delays.reduce((s, x) => s + x, 0) / delays.length) : null;
  }

  // ---------- achats, fournisseurs et dépenses (3.0.0, données v4) ----------
  // Symétrique des ventes, mais on ne maîtrise ni la numérotation (c'est celle du fournisseur)
  // ni la date (c'est celle de sa facture) : rien n'est verrouillé, tout reste modifiable.
  const PURCHASE_KINDS = [['facture', 'Facture d\'achat'], ['depense', 'Dépense']];
  // Destination d'une ligne d'achat. C'est ce choix qui alimentera le stock (4.0.0) et les
  // immobilisations (3.4.0) : il est posé dès maintenant pour ne pas avoir à ressaisir l'historique.
  const LINE_DESTINATIONS = [
    ['charge', 'Charge', 'Consommé tout de suite : fournitures, loyer, carburant, sous-traitance'],
    ['stock', 'Stock', 'Marchandise achetée pour être revendue — sortira du stock à la vente'],
    ['immobilisation', 'Immobilisation', 'Matériel qui reste dans l\'entreprise plus d\'un an : ordinateur, climatiseur, véhicule']
  ];
  // Catégories de charges de départ. Modifiables et extensibles par l'utilisateur (data.expenseCategories).
  // Le rattachement comptable exact relève du plan comptable tunisien — À VÉRIFIER avec le comptable.
  const DEFAULT_EXPENSE_CATEGORIES = [
    'Achats de marchandises', 'Sous-traitance', 'Fournitures de bureau', 'Petit équipement',
    'Loyer et charges locatives', 'Électricité, eau, gaz', 'Téléphone et internet',
    'Carburant et déplacements', 'Entretien et réparations', 'Assurances',
    'Honoraires (comptable, avocat)', 'Publicité et communication', 'Frais bancaires',
    'Impôts et taxes', 'Formation', 'Divers'
  ];
  const PURCHASE_STATUSES = ['à payer', 'partiel', 'retard', 'payée'];

  function expenseCategories(data) {
    const extra = (data && Array.isArray(data.expenseCategories) ? data.expenseCategories : [])
      .map(x => String(x || '').trim()).filter(Boolean);
    return Array.from(new Set(DEFAULT_EXPENSE_CATEGORIES.concat(extra)));
  }

  // Totaux d'un achat. Même moteur que les ventes, deux différences : pas de remise globale (elle est
  // déjà dans le prix du fournisseur) et la TVA peut être non déductible ligne par ligne.
  function purchaseTotals(purchase, company) {
    const lines = (purchase.lines || []).map(l => {
      const qty = Number(l.qty) || 0;
      const unit = Number(l.unitPrice) || 0;
      const rate = Number(l.vatRate) || 0;
      const ht = round3(qty * unit);
      const vat = round3(ht * rate / 100);
      return {
        ...l, qty, unitPrice: unit, vatRate: rate, ht, vat, ttc: round3(ht + vat),
        destination: LINE_DESTINATIONS.some(d => d[0] === l.destination) ? l.destination : 'charge',
        // TVA non déductible : voiture de tourisme, cadeaux, réception… À VÉRIFIER avec le comptable.
        deductible: l.deductible !== false
      };
    });
    const totalHT = round3(lines.reduce((s, l) => s + l.ht, 0));
    const vatByRate = {};
    lines.forEach(l => {
      const k = l.vatRate;
      vatByRate[k] = vatByRate[k] || { base: 0, vat: 0, deductible: 0 };
      vatByRate[k].base = round3(vatByRate[k].base + l.ht);
      vatByRate[k].vat = round3(vatByRate[k].vat + l.vat);
      if (l.deductible) vatByRate[k].deductible = round3(vatByRate[k].deductible + l.vat);
    });
    const totalVAT = round3(lines.reduce((s, l) => s + l.vat, 0));
    const deductibleVAT = round3(lines.filter(l => l.deductible).reduce((s, l) => s + l.vat, 0));
    const fees = round3(Number(purchase.fees) || 0);          // timbre du fournisseur, frais de port…
    const totalTTC = round3(totalHT + totalVAT + fees);
    // Retenue à la source que TU opères en payant un prestataire : tu la retiens et tu la reverses.
    // Qui doit retenir et à quel taux : À VÉRIFIER avec le comptable.
    const withholdingRate = Number(purchase.withholdingRate) || 0;
    const withholding = round3((totalHT + totalVAT) * withholdingRate / 100);
    const netToPay = round3(totalTTC - withholding);
    const byDestination = {};
    LINE_DESTINATIONS.forEach(([k]) => { byDestination[k] = 0; });
    lines.forEach(l => { byDestination[l.destination] = round3(byDestination[l.destination] + l.ht); });
    return { lines, totalHT, vatByRate, totalVAT, deductibleVAT, fees, totalTTC, withholdingRate, withholding, netToPay, byDestination };
  }

  // Situation d'un achat : payé, reste dû. Le symétrique exact d'invoiceBalance.
  function purchaseBalance(purchase, company) {
    const totals = purchaseTotals(purchase, company);
    const paid = round3((purchase.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
    return { totals, paid, remaining: round3(totals.netToPay - paid) };
  }

  // Statut déduit des paiements, jamais saisi — comme pour une facture de vente.
  function purchaseStatus(purchase, company, todayIso) {
    const b = purchaseBalance(purchase, company);
    if (b.remaining <= 0.0005) return 'payée';
    if (b.paid > 0) return 'partiel';
    if (purchase.dueDate && purchase.dueDate < (todayIso || today())) return 'retard';
    return 'à payer';
  }

  // Ce qu'on doit, par fournisseur et par échéance. Le pendant des relances, côté sortant.
  function payablesList(data, company, todayIso) {
    const t = todayIso || today();
    return (data.purchases || []).map(p => {
      const b = purchaseBalance(p, company);
      if (b.remaining <= 0.0005) return null;
      const late = p.dueDate && p.dueDate < t ? daysBetween(p.dueDate, t) : 0;
      return {
        id: p.id, supplierId: p.supplierId, number: p.number || '', date: p.date, dueDate: p.dueDate || '',
        subject: p.subject || '', remaining: b.remaining, total: b.totals.netToPay, late,
        status: purchaseStatus(p, company, t)
      };
    }).filter(Boolean).sort((a, b) => (b.late - a.late) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }

  // Journal des décaissements : un règlement fournisseur par ligne. Le symétrique de paymentsJournal.
  function supplierPayments(data, company, period) {
    const name = id => ((data.suppliers || []).find(s => s.id === id) || {}).name || '—';
    const out = [];
    (data.purchases || []).forEach(p => (p.payments || []).forEach(x => {
      if (!inPeriod(x.date, period && period.from, period && period.to)) return;
      const m = PAYMENT_METHODS.find(k => k[0] === x.method);
      out.push({
        id: x.id, purchaseId: p.id, date: x.date, number: p.number || '', supplier: name(p.supplierId),
        amount: round3(Number(x.amount) || 0), method: m ? m[1] : (x.method || ''), reference: x.reference || '', note: x.note || ''
      });
    }));
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  // Journal des achats d'une période : une ligne par pièce, prête pour le CSV du comptable.
  function purchaseJournal(data, company, period) {
    const name = id => ((data.suppliers || []).find(s => s.id === id) || {}).name || '—';
    return (data.purchases || [])
      .filter(p => inPeriod(p.date, period && period.from, period && period.to))
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0))
      .map(p => {
        const t = purchaseTotals(p, company);
        return {
          id: p.id, date: p.date, number: p.number || '', supplier: name(p.supplierId),
          kind: p.kind === 'depense' ? 'Dépense' : 'Facture d\'achat', category: p.category || '',
          ht: t.totalHT, tva: t.totalVAT, deductible: t.deductibleVAT, fees: t.fees,
          ttc: t.totalTTC, rs: t.withholding, net: t.netToPay,
          status: purchaseStatus(p, company, '9999-12-31'), subject: p.subject || ''
        };
      });
  }

  // Récapitulatif d'achats : totaux, TVA déductible, ventilation par catégorie et par destination.
  function purchaseSummary(rows) {
    const sum = k => round3(rows.reduce((s, r) => s + (r[k] || 0), 0));
    const byCategory = {};
    rows.forEach(r => { const k = r.category || 'Sans catégorie'; byCategory[k] = round3((byCategory[k] || 0) + r.ht); });
    return {
      count: rows.length, ht: sum('ht'), tva: sum('tva'), deductible: sum('deductible'),
      fees: sum('fees'), ttc: sum('ttc'), rs: sum('rs'), net: sum('net'),
      byCategory: Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]).map(k => ({ label: k, ht: byCategory[k] }))
    };
  }

  // Chiffres d'un fournisseur, pour sa fiche.
  function supplierSummary(data, company, supplierId, todayIso) {
    const mine = (data.purchases || []).filter(p => p.supplierId === supplierId);
    let ht = 0, remaining = 0, late = 0;
    mine.forEach(p => {
      const b = purchaseBalance(p, company);
      ht = round3(ht + b.totals.totalHT);
      if (b.remaining > 0.0005) {
        remaining = round3(remaining + b.remaining);
        if (purchaseStatus(p, company, todayIso) === 'retard') late = round3(late + b.remaining);
      }
    });
    const dates = mine.map(p => p.date).filter(Boolean).sort();
    return { count: mine.length, ht, remaining, late, first: dates[0] || '', last: dates[dates.length - 1] || '' };
  }

  // Retenues à la source que tu as opérées et dont le fournisseur attend l'attestation.
  function withholdingsToIssue(data, company) {
    const name = id => ((data.suppliers || []).find(s => s.id === id) || {}).name || '—';
    return (data.purchases || [])
      .map(p => ({ p, t: purchaseTotals(p, company) }))
      .filter(x => x.t.withholding > 0.0005 && !x.p.withholdingCertificate)
      .map(x => ({ id: x.p.id, supplier: name(x.p.supplierId), number: x.p.number || '', date: x.p.date, amount: x.t.withholding, rate: x.t.withholdingRate }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  // ---------- marges et rentabilité (3.4.0) ----------
  // Le chiffre d'affaires ne dit rien de la santé d'une entreprise : vendre 100 000 DT en achetant
  // pour 95 000 DT, c'est travailler pour rien. Ce bloc répond à « qu'est-ce qui me reste ? ».
  //
  // Le coût d'une vente vient de deux sources, dans cet ordre :
  //   1. le coût saisi sur la ligne du document (le plus précis) ;
  //   2. à défaut, le coût de revient de la prestation dans le catalogue.
  // Et pour une affaire, on ajoute les achats réellement rattachés — c'est là que le chiffre devient vrai.

  // Coût de revient d'une ligne de vente. `unitCost` sur la ligne l'emporte sur celui du catalogue :
  // le prix d'achat du jour est toujours plus juste que le prix de référence.
  function lineCost(line, data) {
    if (line.unitCost !== '' && line.unitCost != null && Number.isFinite(Number(line.unitCost))) {
      return round3((Number(line.unitCost) || 0) * (Number(line.qty) || 0));
    }
    const label = (line.label || '').trim().toLowerCase();
    const item = (data.catalog || []).find(c => (c.label || '').trim().toLowerCase() === label);
    if (item && Number(item.unitCost) > 0) return round3(Number(item.unitCost) * (Number(line.qty) || 0));
    return 0;
  }

  // Marge d'un document de vente. Les lignes de déduction d'acompte ne sont pas des ventes : elles
  // ne portent ni chiffre d'affaires ni coût.
  function documentMargin(doc, data, company) {
    const t = computeTotals(doc, company);
    const sign = doc.type === 'avoir' ? -1 : 1;
    let revenue = 0, cost = 0, known = 0, total = 0;
    const factor = t.totalHT > 0 ? t.netHT / t.totalHT : 1;   // la remise globale ampute le prix, pas le coût
    t.lines.forEach(l => {
      if (l.noDiscount) return;
      total++;
      const c = lineCost(l, data);
      if (c > 0) known++;
      revenue = round3(revenue + sign * round3(l.ht * factor));
      cost = round3(cost + sign * c);
    });
    const margin = round3(revenue - cost);
    return {
      revenue, cost, margin,
      rate: revenue !== 0 ? Math.round(margin / revenue * 1000) / 10 : null,
      // Combien de lignes ont un coût connu : sans ça, une marge de 100 % voudrait juste dire « on ne sait pas »
      lines: total, costed: known, complete: total > 0 && known === total
    };
  }

  // Marge agrégée sur une période, par client ou par prestation.
  function marginBy(data, company, fromIso, toIso, dimension, limit) {
    const acc = {};
    const clientName = id => ((data.clients || []).find(c => c.id === id) || {}).name || '—';
    issuedIn(data, fromIso, toIso).forEach(d => {
      const sign = d.type === 'avoir' ? -1 : 1;
      const t = computeTotals(d, company);
      const factor = t.totalHT > 0 ? t.netHT / t.totalHT : 1;
      t.lines.forEach(l => {
        if (l.noDiscount) return;
        const key = dimension === 'client' ? d.clientId : (l.label || '').trim().toLowerCase();
        if (!key) return;
        const a = acc[key] || (acc[key] = {
          key, label: dimension === 'client' ? clientName(d.clientId) : (l.label || '').trim(),
          revenue: 0, cost: 0, lines: 0, costed: 0
        });
        const c = lineCost(l, data);
        a.revenue = round3(a.revenue + sign * toBase(d, round3(l.ht * factor), company));
        a.cost = round3(a.cost + sign * toBase(d, c, company));
        a.lines++; if (c > 0) a.costed++;
      });
    });
    return Object.values(acc).map(a => ({
      ...a, margin: round3(a.revenue - a.cost),
      rate: a.revenue !== 0 ? Math.round((a.revenue - a.cost) / a.revenue * 1000) / 10 : null,
      complete: a.lines > 0 && a.costed === a.lines
    })).sort((x, y) => y.margin - x.margin).slice(0, limit || 20);
  }

  // ---------- affaires ----------
  // Une affaire relie des ventes et des achats. C'est le seul endroit où la marge est exacte :
  // on ne devine plus le coût, on l'a payé.
  const PROJECT_STATUSES = ['en cours', 'terminée', 'annulée'];

  function projectMargin(data, company, projectId) {
    const sales = (data.documents || []).filter(d => d.projectId === projectId
      && (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.status !== 'annulée');
    const buys = (data.purchases || []).filter(p => p.projectId === projectId);
    let revenue = 0, invoiced = 0, collected = 0;
    sales.forEach(d => {
      const sign = d.type === 'avoir' ? -1 : 1;
      const t = computeTotals(d, company);
      revenue = round3(revenue + sign * toBase(d, t.netHT, company));
      invoiced = round3(invoiced + sign * toBase(d, t.netToPay, company));
      if (d.type === 'facture') {
        const b = invoiceBalance(d, data, company);
        collected = round3(collected + toBase(d, round3(t.netToPay - b.remaining), company));
      }
    });
    let cost = 0, paid = 0;
    buys.forEach(p => {
      const t = purchaseTotals(p, company);
      cost = round3(cost + t.totalHT + t.fees);
      paid = round3(paid + purchaseBalance(p, company).paid);
    });
    // Devis en cours : ce qui est proposé mais pas encore vendu, pour voir l'affaire en entier.
    const quotes = (data.documents || []).filter(d => d.projectId === projectId && d.type === 'devis' && d.status !== 'brouillon');
    const pending = round3(quotes.filter(q => q.status !== 'refusé').reduce((s, q) => s + toBase(q, computeTotals(q, company).netHT, company), 0));
    const margin = round3(revenue - cost);
    return {
      revenue, cost, margin, invoiced, collected, paid, pending,
      rate: revenue !== 0 ? Math.round(margin / revenue * 1000) / 10 : null,
      cash: round3(collected - paid),          // ce que l'affaire a réellement rapporté en caisse
      salesCount: sales.length, buysCount: buys.length, quotesCount: quotes.length,
      sales, buys, quotes
    };
  }

  function projectList(data, company) {
    return (data.projects || []).map(p => ({ ...p, ...projectMargin(data, company, p.id) }))
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }

  // Rentabilité d'un contrat récurrent : ce qu'il a rapporté depuis le début, contre ce qu'il a coûté.
  function recurringProfitability(data, company, recurringId) {
    const rec = (data.recurring || []).find(r => r.id === recurringId);
    const invoices = (data.documents || []).filter(d => d.recurringId === recurringId
      && d.status !== 'brouillon' && d.status !== 'annulée');
    let revenue = 0, cost = 0;
    invoices.forEach(d => {
      const m = documentMargin(d, data, company);
      revenue = round3(revenue + toBase(d, m.revenue, company));
      cost = round3(cost + toBase(d, m.cost, company));
    });
    // Les achats rattachés au même client ET à la même affaire, s'il y en a une.
    const linked = (data.purchases || []).filter(p => rec && p.projectId && p.projectId === rec.projectId);
    linked.forEach(p => { const t = purchaseTotals(p, company); cost = round3(cost + t.totalHT + t.fees); });
    const margin = round3(revenue - cost);
    const dates = invoices.map(d => d.date).filter(Boolean).sort();
    const months = dates.length ? Math.max(1, Math.round(daysBetween(dates[0], dates[dates.length - 1]) / 30) + 1) : 0;
    return {
      revenue, cost, margin, rate: revenue !== 0 ? Math.round(margin / revenue * 1000) / 10 : null,
      count: invoices.length, months, perMonth: months ? round3(margin / months) : 0, first: dates[0] || '', last: dates[dates.length - 1] || ''
    };
  }

  // ---------- charges fixes et seuil de rentabilité ----------
  // Une charge fixe tombe que tu vendes ou non : loyer, assurance, abonnement, salaires.
  // Une charge variable suit les ventes : marchandises, sous-traitance, carburant.
  // Le classement est modifiable — À VÉRIFIER avec ton comptable, il dépend de ton activité.
  const DEFAULT_FIXED_CATEGORIES = [
    'Loyer et charges locatives', 'Assurances', 'Téléphone et internet', 'Honoraires (comptable, avocat)',
    'Frais bancaires', 'Électricité, eau, gaz', 'Formation'
  ];
  function isFixedCategory(data, category) {
    const custom = (data && data.fixedCategories);
    const list = Array.isArray(custom) && custom.length ? custom : DEFAULT_FIXED_CATEGORIES;
    return list.includes(category);
  }

  // Seuil de rentabilité : le chiffre d'affaires minimum pour couvrir les charges fixes.
  // Formule : charges fixes ÷ taux de marge sur coûts variables. Si le taux est nul ou négatif,
  // aucun volume ne suffit — et c'est une information, pas une erreur.
  function breakEven(data, company, period) {
    const sales = salesJournal(data, company, period);
    const revenue = round3(sales.reduce((s, r) => s + r.ht, 0));
    let fixed = 0, variable = 0;
    (data.purchases || []).filter(p => inPeriod(p.date, period && period.from, period && period.to)).forEach(p => {
      const t = purchaseTotals(p, company);
      // Le stock et les immobilisations ne sont pas des charges de la période.
      const charge = round3(t.byDestination.charge + t.fees);
      if (isFixedCategory(data, p.category)) fixed = round3(fixed + charge);
      else variable = round3(variable + charge);
    });
    // Les mouvements libres récurrents (salaires, échéances d'emprunt) sont des charges fixes.
    (data.movements || []).filter(m => inPeriod(m.date, period && period.from, period && period.to)).forEach(m => {
      if (['salaire', 'emprunt', 'banque'].includes(m.kind)) fixed = round3(fixed + Math.abs(Number(m.amount) || 0));
    });
    // Le coût des marchandises vendues est LA charge variable par excellence : pas de vente, pas de coût.
    const cogs = costOfGoodsSold(data, period);
    variable = round3(variable + cogs);
    // La dotation aux amortissements est une charge fixe : elle tombe que tu vendes ou non (3.5.0).
    const depreciation = depreciationFor(data, period);
    fixed = round3(fixed + depreciation);
    // Les salaires aussi, et ce sont les plus lourds : un salarié est payé le mois où tu ne vends rien.
    const payroll = payrollCost(data, period);
    fixed = round3(fixed + payroll);
    const marginOnVariable = round3(revenue - variable);
    const rate = revenue > 0 ? marginOnVariable / revenue : 0;
    const point = rate > 0 ? round3(fixed / rate) : null;
    return {
      revenue, fixed, variable, cogs, depreciation, payroll, marginOnVariable,
      rate: revenue > 0 ? Math.round(rate * 1000) / 10 : null,
      breakEven: point,
      // Là où tu en es par rapport au seuil : négatif = il manque du chiffre d'affaires.
      gap: point == null ? null : round3(revenue - point),
      result: round3(marginOnVariable - fixed),
      reached: point != null && revenue >= point
    };
  }

  // ---------- stock (4.0.0) ----------
  // Aucune saisie en double, comme pour la trésorerie : les mouvements de stock sont DÉDUITS de ce qui
  // existe déjà. Une ligne d'achat en destination « stock » fait une entrée ; une ligne de facture ou de
  // bon de livraison fait une sortie. On n'ajoute à la main que ce qui n'existe nulle part ailleurs :
  // le stock de départ, et les ajustements (casse, perte, inventaire).
  //
  // Valorisation au COÛT MOYEN PONDÉRÉ : à chaque entrée, le coût unitaire moyen est recalculé sur
  // l'ensemble du stock. C'est la méthode la plus simple à tenir et la plus courante.
  // À VÉRIFIER avec le comptable : la méthode de valorisation retenue pour tes comptes annuels.

  const MOVE_SOURCES = [
    ['achat', 'Achat'], ['vente', 'Vente'], ['livraison', 'Bon de livraison'],
    ['avoir', 'Retour sur avoir'], ['depart', 'Stock de départ'],
    ['inventaire', 'Inventaire'], ['casse', 'Casse ou perte'], ['ajustement', 'Ajustement']
  ];
  const moveSourceLabel = k => (MOVE_SOURCES.find(m => m[0] === k) || [, k])[1];

  // Les articles du catalogue suivis en stock.
  function trackedItems(data) {
    return (data.catalog || []).filter(c => c.tracked);
  }

  // Retrouver l'article d'une ligne : par identifiant si la ligne en porte un (lignes posées depuis le
  // catalogue), sinon par libellé — même règle que `lineCost`, pour que l'historique reste lisible.
  function itemOfLine(line, data) {
    if (line.itemId) {
      const byId = (data.catalog || []).find(c => c.id === line.itemId);
      if (byId) return byId;
    }
    const label = (line.label || '').trim().toLowerCase();
    if (!label) return null;
    return (data.catalog || []).find(c => (c.label || '').trim().toLowerCase() === label) || null;
  }

  // Tous les mouvements d'un article, dans l'ordre chronologique, déduits des pièces existantes.
  // `itemId` restreint à un article ; sans lui, tout le stock.
  function stockMovements(data, itemId, toIso) {
    const out = [];
    const keep = c => c && c.tracked && (!itemId || c.id === itemId);
    const limit = toIso || null;

    (data.catalog || []).forEach(c => {
      if (!keep(c)) return;
      const qty = Number(c.initialQty) || 0;
      if (!qty) return;
      const date = c.initialDate || '1970-01-01';
      if (limit && date > limit) return;
      out.push({ id: `init-${c.id}`, date, itemId: c.id, label: c.label, qty, unitCost: Number(c.initialCost) || 0,
        source: 'depart', ref: '', docId: '', note: '' });
    });

    (data.purchases || []).forEach(p => {
      (p.lines || []).forEach((l, i) => {
        if (l.destination !== 'stock') return;
        const c = itemOfLine(l, data);
        if (!keep(c)) return;
        if (limit && p.date > limit) return;
        const qty = Number(l.qty) || 0;
        if (!qty) return;
        out.push({ id: `buy-${p.id}-${i}`, date: p.date, itemId: c.id, label: c.label, qty,
          unitCost: Number(l.unitPrice) || 0, source: 'achat', ref: p.number || '', docId: p.id, note: '' });
      });
    });

    // Sorties : factures émises et bons de livraison. Un devis, une proforma ou un bon de commande ne
    // sortent rien — rien n'a encore quitté l'entrepôt.
    (data.documents || []).forEach(d => {
      const isSale = d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée';
      const isDelivery = d.type === 'livraison' && d.status !== 'brouillon';
      const isReturn = d.type === 'avoir' && d.status !== 'brouillon';
      if (!isSale && !isDelivery && !isReturn) return;
      if (limit && d.date > limit) return;
      // Une facture tirée d'un bon de livraison sortirait le stock une seconde fois : c'est le bon de
      // livraison qui fait foi, la facture ne fait que le suivre.
      if (isSale && d.fromDocType === 'livraison') return;
      (d.lines || []).forEach((l, i) => {
        if (l.noDiscount) return;              // ligne d'acompte ou de déduction : aucune marchandise
        const c = itemOfLine(l, data);
        if (!keep(c)) return;
        const qty = Number(l.qty) || 0;
        if (!qty) return;
        out.push({ id: `doc-${d.id}-${i}`, date: d.date, itemId: c.id, label: c.label,
          qty: isReturn ? qty : -qty, unitCost: null,
          source: isReturn ? 'avoir' : (isDelivery ? 'livraison' : 'vente'),
          ref: d.number || '', docId: d.id, note: '' });
      });
    });

    (data.stockAdjustments || []).forEach(a => {
      const c = (data.catalog || []).find(x => x.id === a.itemId);
      if (!keep(c)) return;
      if (limit && a.date > limit) return;
      out.push({ id: a.id, date: a.date, itemId: a.itemId, label: c.label, qty: Number(a.qty) || 0,
        unitCost: a.unitCost === '' || a.unitCost == null ? null : Number(a.unitCost),
        source: a.source || 'ajustement', ref: a.reference || '', docId: '', note: a.note || '', manual: true });
    });

    return out.sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.id).localeCompare(String(b.id)));
  }

  // Déroule les mouvements d'un article et tient le coût moyen pondéré à jour.
  // Une sortie sort au CMP du moment ; une entrée le recalcule.
  function runningStock(moves) {
    let qty = 0, value = 0, cmp = 0;
    const rows = moves.map(m => {
      const q = Number(m.qty) || 0;
      if (q > 0) {
        // Une entrée sans coût connu (retour sur avoir, ajustement) rentre au CMP courant.
        const unit = m.unitCost == null ? cmp : Number(m.unitCost) || 0;
        value = round3(value + q * unit);
        qty = round3(qty + q);
        cmp = qty > 0 ? round3(value / qty) : 0;
      } else {
        const unit = m.unitCost == null ? cmp : Number(m.unitCost) || 0;
        qty = round3(qty + q);
        value = round3(value + q * unit);
        // Un stock retombé à zéro (ou négatif) ne garde aucune valeur : sinon le CMP dérive.
        if (qty <= 0) { value = qty < 0 ? round3(qty * cmp) : 0; }
      }
      return { ...m, unitApplied: m.unitCost == null ? cmp : Number(m.unitCost) || 0, qtyAfter: qty, valueAfter: value, cmpAfter: cmp };
    });
    return { rows, qty, value, cmp };
  }

  // L'état d'un article à une date : quantité, valeur, coût moyen, et le signal qui compte — le négatif.
  function stockOf(data, itemId, toIso) {
    const item = (data.catalog || []).find(c => c.id === itemId) || {};
    const r = runningStock(stockMovements(data, itemId, toIso));
    const min = Number(item.minStock) || 0;
    return {
      itemId, label: item.label || '', unit: item.unit || '', location: item.location || '',
      qty: r.qty, value: r.value, cmp: r.cmp, minStock: min, moves: r.rows,
      negative: r.qty < 0,                       // on a vendu ce qu'on n'avait pas : erreur de saisie ou oubli d'achat
      low: r.qty >= 0 && min > 0 && r.qty <= min,
      unitPrice: Number(item.unitPrice) || 0
    };
  }

  function stockList(data, toIso) {
    return trackedItems(data).map(c => stockOf(data, c.id, toIso))
      .sort((a, b) => (a.label || '').localeCompare(b.label || '', 'fr'));
  }

  function stockTotals(data, toIso) {
    const rows = stockList(data, toIso);
    return {
      count: rows.length,
      value: round3(rows.reduce((s, r) => s + Math.max(0, r.value), 0)),
      low: rows.filter(r => r.low).length,
      negative: rows.filter(r => r.negative).length,
      rows
    };
  }

  // Le journal des mouvements, tous articles confondus, avec le stock de l'article après chaque ligne.
  function stockJournal(data, period) {
    const byItem = {};
    trackedItems(data).forEach(c => { byItem[c.id] = runningStock(stockMovements(data, c.id)).rows; });
    const all = [];
    Object.keys(byItem).forEach(id => byItem[id].forEach(r => all.push(r)));
    return all.filter(r => inPeriod(r.date, period && period.from, period && period.to))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.id).localeCompare(String(a.id)));
  }

  // Ce qu'un inventaire physique révèle : l'écart entre ce que dit l'application et ce qu'on a compté.
  // `counts` = { itemId: quantité comptée }. On ne modifie rien ici : on décrit, l'appelant décide.
  function inventoryDiff(data, counts, dateIso) {
    const d = dateIso || today();
    return trackedItems(data).map(c => {
      const s = stockOf(data, c.id, d);
      const raw = counts && counts[c.id];
      const counted = raw === '' || raw == null ? null : Number(raw);
      const gap = counted == null ? null : round3(counted - s.qty);
      return {
        itemId: c.id, label: c.label, unit: c.unit || '', book: s.qty, counted, gap,
        cmp: s.cmp, value: gap == null ? 0 : round3(gap * s.cmp)
      };
    }).sort((a, b) => (a.label || '').localeCompare(b.label || '', 'fr'));
  }

  // Ce qui manque ou ce qui cloche, trié par gravité : d'abord l'impossible, ensuite le bientôt épuisé.
  function stockAlerts(data, toIso) {
    const rows = stockList(data, toIso);
    const neg = rows.filter(r => r.negative).map(r => ({ ...r, kind: 'negatif' }));
    const low = rows.filter(r => r.low).map(r => ({ ...r, kind: r.qty === 0 ? 'rupture' : 'bas' }));
    return neg.concat(low.sort((a, b) => a.qty - b.qty));
  }

  // Le coût des marchandises vendues sur une période : les sorties de stock, valorisées au coût moyen
  // du moment. C'est LUI la charge de la période, pas l'achat — acheter de la marchandise ne coûte rien
  // tant qu'elle est sur l'étagère, et la vendre coûte ce qu'elle a coûté. C'est la « variation de stock »
  // que le résultat simplifié annonçait comme manquante jusqu'ici.
  function costOfGoodsSold(data, period) {
    return round3(stockJournal(data, period)
      .filter(m => m.qty < 0 && ['vente', 'livraison'].includes(m.source))
      .reduce((s, m) => s + Math.abs(m.qty) * (Number(m.unitApplied) || 0), 0));
  }

  // Ce qu'un document sortirait du stock : appelé avant d'émettre une facture ou un bon de livraison,
  // pour prévenir quand on s'apprête à vendre ce qu'on n'a pas.
  function stockImpact(doc, data) {
    const out = [];
    (doc.lines || []).forEach(l => {
      if (l.noDiscount) return;
      const c = itemOfLine(l, data);
      if (!c || !c.tracked) return;
      const qty = Number(l.qty) || 0;
      if (qty <= 0) return;
      // Le stock actuel ne compte pas ce document tant qu'il n'est pas émis.
      const s = stockOf(data, c.id);
      const after = round3(s.qty - qty);
      if (after < 0) out.push({ itemId: c.id, label: c.label, unit: c.unit || '', have: s.qty, need: qty, after });
    });
    return out;
  }

  // ---------- paie (5.0.0) ----------
  // Le module où une erreur coûte juridiquement cher. Trois principes, dans cet ordre :
  //
  //  1. AUCUN TAUX N'EST ÉCRIT EN DUR dans un calcul. Tout vient de `payrollSettings(data)`, que
  //     l'utilisateur modifie : les barèmes changent à chaque loi de finances, et une application qui
  //     les fige devient fausse en silence l'année suivante.
  //  2. Les valeurs livrées sont INDICATIVES. Elles portent un « À VÉRIFIER avec ton comptable » visible
  //     partout où elles servent, et les premiers bulletins portent une mention imprimée.
  //  3. Le bulletin garde une COPIE de ce qui a servi à le calculer. Changer un barème ne doit jamais
  //     réécrire l'histoire d'un bulletin déjà remis à un salarié.

  const CONTRACT_TYPES = [
    ['cdi', 'CDI — contrat à durée indéterminée'],
    ['cdd', 'CDD — contrat à durée déterminée'],
    ['sivp', 'SIVP — stage d\'initiation à la vie professionnelle'],
    ['karama', 'Contrat Karama'],
    ['stage', 'Stage'],
    ['autre', 'Autre']
  ];
  const contractLabel = k => (CONTRACT_TYPES.find(x => x[0] === k) || [, k])[1];

  // Valeurs de départ, toutes modifiables. Régime tunisien, secteur non agricole.
  // À VÉRIFIER avec le comptable : chacune de ces lignes peut changer d'une loi de finances à l'autre.
  const DEFAULT_PAYROLL = {
    cnssEmployee: 9.18,        // part salarié
    cnssEmployer: 16.57,       // part employeur
    accidentRate: 0.4,         // accident du travail : dépend de l'activité
    solidarity: 1,             // contribution sociale de solidarité, en points sur la base imposable
    proRate: 10,               // frais professionnels : % du salaire imposable…
    proCap: 2000,              // …plafonnés à ce montant par an
    headOfFamily: 300,         // déduction annuelle chef de famille
    perChild: 100,             // déduction annuelle par enfant à charge
    maxChildren: 4,
    workedDays: 26,            // jours ouvrables d'un mois complet
    offDays: [0],              // jours chômés de la semaine (0 = dimanche) — semaine de six jours
    leaveDaysPerYear: 18,      // droit annuel à congé payé, en jours ouvrables
    // Barème IRPP annuel progressif : `upTo` en dinars (null = au-delà), `rate` en %.
    brackets: [
      { upTo: 5000, rate: 0 },
      { upTo: 10000, rate: 15 },
      { upTo: 20000, rate: 25 },
      { upTo: 30000, rate: 30 },
      { upTo: 40000, rate: 33 },
      { upTo: 50000, rate: 36 },
      { upTo: 70000, rate: 38 },
      { upTo: null, rate: 40 }
    ]
  };

  function payrollSettings(data) {
    const s = (data && data.payrollSettings) || {};
    return {
      ...DEFAULT_PAYROLL, ...s,
      brackets: Array.isArray(s.brackets) && s.brackets.length ? s.brackets : DEFAULT_PAYROLL.brackets
    };
  }

  // Impôt annuel sur un revenu imposable, barème progressif par tranches.
  function irppAnnual(base, brackets) {
    const total = Math.max(0, Number(base) || 0);
    let from = 0, tax = 0;
    for (const b of brackets) {
      const to = b.upTo == null ? Infinity : Number(b.upTo);
      // La tranche ne porte que sur la part du revenu comprise entre `from` et `to` — surtout pas sur
      // toute la tranche quand le revenu s'arrête au milieu (c'est l'erreur classique du barème).
      const slice = Math.max(0, Math.min(total, to) - from);
      if (slice > 0) tax += slice * (Number(b.rate) || 0) / 100;
      from = to;
      if (from >= total) break;
    }
    return round3(tax);
  }

  // Le calcul d'un bulletin. `input` porte ce qui varie d'un mois à l'autre :
  // { gross, bonuses:[{label, amount, taxable}], deductions:[{label, amount}], absentDays, workedDays }
  // Retourne TOUT le détail, pour que le bulletin imprimé et l'écran disent exactement la même chose.
  function computePayslip(employee, input, settings) {
    const s = settings || DEFAULT_PAYROLL;
    const i = input || {};
    const emp = employee || {};
    const baseGross = round3(Number(i.gross != null ? i.gross : emp.grossSalary) || 0);
    const workedDays = Number(i.workedDays) || 26;      // jours ouvrables du mois, modifiable
    const absent = Math.max(0, Number(i.absentDays) || 0);
    // Absence non rémunérée : le brut est réduit au prorata des jours.
    const absenceCut = absent > 0 && workedDays > 0 ? round3(baseGross * absent / workedDays) : 0;

    const bonuses = (i.bonuses || []).map(b => ({ label: b.label || 'Prime', amount: round3(Number(b.amount) || 0), taxable: b.taxable !== false }));
    const taxableBonus = round3(bonuses.filter(b => b.taxable).reduce((a, b) => a + b.amount, 0));
    const freeBonus = round3(bonuses.filter(b => !b.taxable).reduce((a, b) => a + b.amount, 0));

    const gross = round3(baseGross - absenceCut + taxableBonus + freeBonus);
    const cnssBase = round3(baseGross - absenceCut + taxableBonus);   // les primes non imposables sont hors assiette
    const cnssEmployee = round3(cnssBase * (Number(s.cnssEmployee) || 0) / 100);

    // Base imposable mensuelle → annualisée pour appliquer le barème, puis ramenée au mois.
    const afterCnss = round3(cnssBase - cnssEmployee);
    const annualAfterCnss = round3(afterCnss * 12);
    const pro = round3(Math.min(annualAfterCnss * (Number(s.proRate) || 0) / 100, Number(s.proCap) || 0));
    const children = Math.min(Number(emp.children) || 0, Number(s.maxChildren) || 0);
    const family = round3((emp.headOfFamily ? (Number(s.headOfFamily) || 0) : 0) + children * (Number(s.perChild) || 0));
    const annualTaxable = round3(Math.max(0, annualAfterCnss - pro - family));
    const irppYear = irppAnnual(annualTaxable, s.brackets);
    const irpp = round3(irppYear / 12);
    const css = round3(annualTaxable * (Number(s.solidarity) || 0) / 100 / 12);

    const deductions = (i.deductions || []).map(d => ({ label: d.label || 'Retenue', amount: round3(Number(d.amount) || 0) }));
    const otherDeductions = round3(deductions.reduce((a, d) => a + d.amount, 0));

    const net = round3(gross - cnssEmployee - irpp - css - otherDeductions);
    const cnssEmployer = round3(cnssBase * (Number(s.cnssEmployer) || 0) / 100);
    const accident = round3(cnssBase * (Number(s.accidentRate) || 0) / 100);
    const employerCost = round3(gross + cnssEmployer + accident);

    return {
      baseGross, absenceCut, absentDays: absent, workedDays,
      bonuses, taxableBonus, freeBonus, gross,
      cnssBase, cnssEmployee, afterCnss, pro, family, children,
      annualTaxable, irppYear, irpp, css,
      deductions, otherDeductions, net,
      cnssEmployer, accident, employerCost,
      rates: {
        cnssEmployee: Number(s.cnssEmployee) || 0, cnssEmployer: Number(s.cnssEmployer) || 0,
        accidentRate: Number(s.accidentRate) || 0, solidarity: Number(s.solidarity) || 0
      }
    };
  }

  const activeEmployees = (data, dateIso) => {
    const t = dateIso || today();
    return (data.employees || []).filter(e => (!e.hireDate || e.hireDate <= t) && (!e.endDate || e.endDate >= t));
  };

  // Un bulletin porte sa propre copie du calcul : rejouer le barème d'aujourd'hui sur un bulletin de
  // l'an dernier donnerait un autre chiffre que celui remis au salarié.
  function payslipView(slip, data) {
    const emp = (data.employees || []).find(e => e.id === slip.employeeId) || {};
    const c = slip.computed || computePayslip(emp, slip, payrollSettings(data));
    return { ...slip, employeeName: emp.name || '', employee: emp, c };
  }

  function payslipsOf(data, year, month) {
    return (data.payslips || [])
      .filter(p => (!year || Number(p.year) === Number(year)) && (!month || Number(p.month) === Number(month)))
      .map(p => payslipView(p, data))
      .sort((a, b) => (b.year - a.year) || (b.month - a.month) || (a.employeeName || '').localeCompare(b.employeeName || '', 'fr'));
  }

  // La date d'un bulletin, pour les périodes : le dernier jour du mois concerné.
  function payslipDate(slip) {
    const y = Number(slip.year), m = Number(slip.month);
    if (!y || !m) return '';
    return addDays(`${y}-${String(m).padStart(2, '0')}-01`, daysInMonth(y, m) - 1);
  }

  // Ce que la paie coûte vraiment sur une période : le coût employeur, pas le net versé.
  function payrollCost(data, period) {
    return round3((data.payslips || []).filter(p => inPeriod(payslipDate(p), period && period.from, period && period.to))
      .reduce((s, p) => s + ((p.computed || {}).employerCost || 0), 0));
  }

  function payrollSummary(data, year) {
    const rows = payslipsOf(data, year);
    const sum = f => round3(rows.reduce((s, r) => s + (Number(f(r)) || 0), 0));
    return {
      count: rows.length,
      employees: new Set(rows.map(r => r.employeeId)).size,
      gross: sum(r => r.c.gross), net: sum(r => r.c.net),
      cnssEmployee: sum(r => r.c.cnssEmployee), cnssEmployer: sum(r => r.c.cnssEmployer),
      irpp: sum(r => r.c.irpp), css: sum(r => r.c.css), accident: sum(r => r.c.accident),
      cost: sum(r => r.c.employerCost),
      unpaid: rows.filter(r => !r.paidDate).length,
      rows
    };
  }

  // Les bulletins du mois qui manquent : un salarié actif sans bulletin, c'est un oubli, pas un choix.
  function missingPayslips(data, year, month) {
    const done = new Set((data.payslips || []).filter(p => Number(p.year) === Number(year) && Number(p.month) === Number(month)).map(p => p.employeeId));
    const last = addDays(`${year}-${String(month).padStart(2, '0')}-01`, daysInMonth(year, month) - 1);
    return activeEmployees(data, last).filter(e => !done.has(e.id));
  }

  // Le bulletin imprimé. Même langage visuel que les factures (accent de la société, cases claires),
  // mais un contenu réglementé : identité complète, période, détail des cotisations, cumuls de l'année.
  // La mention d'avertissement s'imprime tant que l'utilisateur ne l'a pas retirée (voir `payrollSettings`).
  function payslipHtml(slip, data, company, opts) {
    opts = opts || {};
    const emp = (data.employees || []).find(e => e.id === slip.employeeId) || {};
    const s = payrollSettings(data);
    const c = slip.computed || computePayslip(emp, slip, s);
    const cur = company.currency || 'DT';
    const dec = decimalsFor(cur);
    const fmt = n => money(n, null, dec, 'fr');
    const ink = company.primaryColor || '#1b2430';
    const accent = company.accentColor || '#0f9d8f';
    const hex = accent.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const tint = a => `rgba(${r}, ${g}, ${b}, ${a})`;
    const pct = n => String(n).replace('.', ',');
    const period = payslipDate(slip);
    const label = monthLabel(period);

    // Cumuls de l'année jusqu'à ce bulletin inclus : c'est ce qu'attend l'administration.
    const ytd = (data.payslips || [])
      .filter(p => p.employeeId === slip.employeeId && Number(p.year) === Number(slip.year) && Number(p.month) <= Number(slip.month))
      .reduce((a, p) => {
        const k = p.computed || {};
        return { gross: round3(a.gross + (k.gross || 0)), cnss: round3(a.cnss + (k.cnssEmployee || 0)),
          irpp: round3(a.irpp + (k.irpp || 0) + (k.css || 0)), net: round3(a.net + (k.net || 0)) };
      }, { gross: 0, cnss: 0, irpp: 0, net: 0 });

    const row = (lib, base, taux, salarie, patron, cls) => `<tr class="${cls || ''}">
      <td>${escapeHtml(lib)}</td>
      <td class="n">${base == null ? '' : fmt(base)}</td>
      <td class="n">${taux == null ? '' : pct(taux) + ' %'}</td>
      <td class="n">${salarie == null ? '' : fmt(salarie)}</td>
      <td class="n">${patron == null ? '' : fmt(patron)}</td></tr>`;

    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>Bulletin de paie ${escapeHtml(emp.name || '')} ${escapeHtml(label)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: ${ink}; font-size: 9.5pt; line-height: 1.42; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; padding: 16mm 15mm; background: #fff; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding-bottom: 12px; border-bottom: 2px solid ${tint(0.35)}; }
  .co-name { font-size: 14pt; font-weight: 700; }
  .co-sub, .small { font-size: 8pt; color: #6a7480; line-height: 1.5; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 17pt; letter-spacing: .4px; color: ${accent}; }
  .title .per { font-size: 10pt; font-weight: 600; margin-top: 2px; }
  .who { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
  .box { border: 1px solid ${tint(0.3)}; border-radius: 8px; padding: 10px 12px; background: ${tint(0.05)}; }
  .box h2 { margin: 0 0 6px; font-size: 8pt; text-transform: uppercase; letter-spacing: .6px; color: ${accent}; }
  .kv { display: flex; justify-content: space-between; gap: 10px; font-size: 8.5pt; padding: 1.5px 0; }
  .kv span:first-child { color: #6a7480; }
  table.pay { width: 100%; border-collapse: collapse; margin-top: 14px; }
  table.pay th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5px; color: ${accent}; border-bottom: 1px solid ${tint(0.4)}; padding: 5px 6px; }
  table.pay td { padding: 4px 6px; border-bottom: 1px solid #eef1f4; }
  table.pay td.n, table.pay th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.sec td { background: ${tint(0.07)}; font-weight: 600; }
  tr.tot td { border-top: 1.5px solid ${ink}; border-bottom: none; font-weight: 700; padding-top: 7px; }
  .net { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; border: 1.5px solid ${accent}; border-radius: 10px; padding: 12px 16px; background: ${tint(0.08)}; }
  .net .lbl { font-size: 10pt; font-weight: 600; }
  .net .val { font-size: 18pt; font-weight: 800; color: ${accent}; font-variant-numeric: tabular-nums; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
  .warn { margin-top: 14px; border-left: 3px solid #c98a12; background: #fdf6e7; padding: 9px 12px; border-radius: 0 6px 6px 0; font-size: 8pt; color: #6a5320; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 22px; }
  .sign .s { border: 1px dashed ${tint(0.5)}; border-radius: 8px; min-height: 60px; padding: 6px 10px; font-size: 8pt; color: #6a7480; }
  .foot { margin-top: 16px; padding-top: 8px; border-top: 1px solid #eef1f4; font-size: 7.5pt; color: #8b949e; text-align: center; }
</style></head>
<body><div class="page">
  <div class="head">
    <div>
      <div class="co-name">${escapeHtml(company.name || '')}</div>
      <div class="co-sub">${escapeHtml(company.address || '').replace(/\n/g, '<br>')}
        ${company.matricule ? `<br>MF : ${escapeHtml(company.matricule)}` : ''}
        ${company.cnss ? `<br>CNSS : ${escapeHtml(company.cnss)}` : ''}</div>
    </div>
    <div class="title"><h1>Bulletin de paie</h1><div class="per">${escapeHtml(label)}</div>
      <div class="small">Établi le ${fmtDate(slip.issuedAt || period)}</div></div>
  </div>

  <div class="who">
    <div class="box"><h2>Salarié</h2>
      <div class="kv"><span>Nom</span><span><b>${escapeHtml(emp.name || '')}</b></span></div>
      ${emp.position ? `<div class="kv"><span>Poste</span><span>${escapeHtml(emp.position)}</span></div>` : ''}
      ${emp.cin ? `<div class="kv"><span>CIN</span><span>${escapeHtml(emp.cin)}</span></div>` : ''}
      ${emp.cnss ? `<div class="kv"><span>N° CNSS</span><span>${escapeHtml(emp.cnss)}</span></div>` : ''}
      ${emp.hireDate ? `<div class="kv"><span>Embauché le</span><span>${fmtDate(emp.hireDate)}</span></div>` : ''}
      <div class="kv"><span>Contrat</span><span>${escapeHtml(contractLabel(emp.contract || 'cdi'))}</span></div>
      <div class="kv"><span>Situation</span><span>${emp.headOfFamily ? 'Chef de famille' : 'Célibataire'}${Number(emp.children) ? ` · ${emp.children} enfant(s) à charge` : ''}</span></div>
    </div>
    <div class="box"><h2>Période</h2>
      <div class="kv"><span>Mois</span><span><b>${escapeHtml(label)}</b></span></div>
      <div class="kv"><span>Jours ouvrables</span><span>${pct(c.workedDays)}</span></div>
      ${c.absentDays ? `<div class="kv"><span>Jours d'absence</span><span>${pct(c.absentDays)}</span></div>` : ''}
      <div class="kv"><span>Salaire de base</span><span>${fmt(c.baseGross)}</span></div>
      <div class="kv"><span>Payé le</span><span>${slip.paidDate ? fmtDate(slip.paidDate) : '—'}</span></div>
      ${slip.method ? `<div class="kv"><span>Mode</span><span>${escapeHtml((PAYMENT_METHODS.find(m => m[0] === slip.method) || [, slip.method])[1])}</span></div>` : ''}
    </div>
  </div>

  <table class="pay">
    <thead><tr><th>Désignation</th><th class="n">Base</th><th class="n">Taux</th><th class="n">Part salarié</th><th class="n">Part employeur</th></tr></thead>
    <tbody>
      ${row('Salaire de base', null, null, c.baseGross, null)}
      ${c.absenceCut ? row(`Absence (${pct(c.absentDays)} jour(s))`, null, null, -c.absenceCut, null) : ''}
      ${c.bonuses.map(b => row(b.label + (b.taxable ? '' : ' (non imposable)'), null, null, b.amount, null)).join('')}
      <tr class="sec"><td>Salaire brut</td><td class="n"></td><td class="n"></td><td class="n">${fmt(c.gross)}</td><td class="n"></td></tr>
      ${row('CNSS', c.cnssBase, c.rates.cnssEmployee, -c.cnssEmployee, c.cnssEmployer)}
      ${c.accident ? row('Accident du travail', c.cnssBase, c.rates.accidentRate, null, c.accident) : ''}
      ${row('Impôt sur le revenu (IRPP)', round3(c.annualTaxable / 12), null, -c.irpp, null)}
      ${c.css ? row('Contribution sociale de solidarité', round3(c.annualTaxable / 12), c.rates.solidarity, -c.css, null) : ''}
      ${c.deductions.map(d => row(d.label, null, null, -d.amount, null)).join('')}
      <tr class="tot"><td>Total des retenues</td><td class="n"></td><td class="n"></td>
        <td class="n">${fmt(round3(c.cnssEmployee + c.irpp + c.css + c.otherDeductions))}</td>
        <td class="n">${fmt(round3(c.cnssEmployer + c.accident))}</td></tr>
    </tbody>
  </table>

  <div class="net"><div class="lbl">Net à payer</div><div class="val">${fmt(c.net)} ${escapeHtml(cur)}</div></div>

  <div class="cols">
    <div class="box"><h2>Cumuls ${escapeHtml(String(slip.year))}</h2>
      <div class="kv"><span>Brut</span><span>${fmt(ytd.gross)}</span></div>
      <div class="kv"><span>CNSS salarié</span><span>${fmt(ytd.cnss)}</span></div>
      <div class="kv"><span>Impôt et solidarité</span><span>${fmt(ytd.irpp)}</span></div>
      <div class="kv"><span>Net perçu</span><span><b>${fmt(ytd.net)}</b></span></div>
    </div>
    <div class="box"><h2>Coût pour l'employeur</h2>
      <div class="kv"><span>Salaire brut</span><span>${fmt(c.gross)}</span></div>
      <div class="kv"><span>Charges patronales</span><span>${fmt(round3(c.cnssEmployer + c.accident))}</span></div>
      <div class="kv"><span>Coût total du mois</span><span><b>${fmt(c.employerCost)}</b></span></div>
    </div>
  </div>

  ${opts.notice === false ? '' : `<div class="warn"><b>À faire valider par votre comptable.</b> Ce bulletin est calculé à partir de barèmes saisis dans l'application (CNSS ${pct(c.rates.cnssEmployee)} % / ${pct(c.rates.cnssEmployer)} %, IRPP au barème progressif). Ces taux changent à chaque loi de finances : faites contrôler les premiers bulletins avant de les remettre.</div>`}

  <div class="sign">
    <div class="s">L'employeur</div>
    <div class="s">Le salarié — reçu pour solde du mois</div>
  </div>

  <div class="foot">${escapeHtml(company.name || '')}${company.matricule ? ' — MF ' + escapeHtml(company.matricule) : ''} · Bulletin de ${escapeHtml(label)} · ${escapeHtml(emp.name || '')}</div>
</div></body></html>`;
  }

  // ---------- congés, absences et avances (5.1.0) ----------
  // Ce que la 5.0.0 laissait à la main : d'où viennent les jours d'absence d'un bulletin, et d'où vient
  // la retenue d'une avance. Les deux se saisissent une fois, au moment où ils arrivent, et le bulletin
  // du mois les reprend tout seul — c'est la même règle que partout ailleurs dans SkanFact.

  const LEAVE_KINDS = [
    ['conges', 'Congé payé', true],
    ['maladie', 'Arrêt maladie', true],
    ['maternite', 'Congé de maternité', true],
    ['autorisation', 'Autorisation d\'absence', true],
    ['sans-solde', 'Absence sans solde', false],
    ['abandon', 'Absence injustifiée', false]
  ];
  const leaveKindLabel = k => (LEAVE_KINDS.find(x => x[0] === k) || [, k])[1];
  const leaveIsPaid = k => { const f = LEAVE_KINDS.find(x => x[0] === k); return f ? f[2] : true; };

  // Jours ouvrables entre deux dates incluses. `offDays` = jours de la semaine chômés (0 = dimanche).
  // Par défaut le dimanche seul : c'est la semaine de six jours encore courante en Tunisie, et c'est
  // cohérent avec les 26 jours ouvrables du bulletin. À VÉRIFIER avec le comptable.
  function workingDays(fromIso, toIso, offDays) {
    if (!fromIso || !toIso || toIso < fromIso) return 0;
    const off = Array.isArray(offDays) ? offDays : [0];
    // On compte sur des instants UTC, jamais en avançant une chaîne jour par jour : c'est cette
    // boucle-là qui ne finissait jamais dès que l'ordinateur n'était pas réglé en UTC. Et une borne,
    // parce qu'une absence de trente ans est une faute de saisie, pas un calcul à faire.
    const start = Date.parse(fromIso + 'T00:00:00Z'), end = Date.parse(toIso + 'T00:00:00Z');
    if (isNaN(start) || isNaN(end)) return 0;
    const span = Math.min(Math.round((end - start) / 86400000), 366 * 30);
    let n = 0;
    for (let i = 0; i <= span; i++) {
      if (!off.includes(new Date(start + i * 86400000).getUTCDay())) n++;
    }
    return n;
  }

  // Les jours d'un congé qui tombent dans un mois donné : un congé à cheval sur deux mois se répartit
  // entre les deux bulletins, sinon le salarié serait retenu deux fois ou pas du tout.
  function leaveDaysInMonth(leave, year, month, offDays) {
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = addDays(first, daysInMonth(year, month) - 1);
    const from = leave.from > first ? leave.from : first;
    const to = leave.to < last ? leave.to : last;
    if (to < from) return 0;
    return workingDays(from, to, offDays);
  }

  function leavesOf(data, employeeId, year) {
    return (data.leaves || [])
      .filter(l => (!employeeId || l.employeeId === employeeId)
        && (!year || (l.from || '').slice(0, 4) === String(year) || (l.to || '').slice(0, 4) === String(year)))
      .map(l => ({ ...l, days: workingDays(l.from, l.to, (data.payrollSettings || {}).offDays),
        paid: l.paid != null ? l.paid : leaveIsPaid(l.kind), kindLabel: leaveKindLabel(l.kind) }))
      .sort((a, b) => (b.from || '').localeCompare(a.from || ''));
  }

  // Le compteur de congés : acquis au prorata des mois travaillés, moins ce qui a été pris.
  // Le droit annuel se règle dans les barèmes — il dépend de la convention collective.
  function leaveBalance(data, employeeId, year, todayIso) {
    const s = payrollSettings(data);
    const emp = (data.employees || []).find(e => e.id === employeeId) || {};
    const t = todayIso || today();
    const y = Number(year) || Number(t.slice(0, 4));
    const start = `${y}-01-01`, end = `${y}-12-31`;
    // Mois effectivement travaillés dans l'année, bornés par l'embauche, la sortie et aujourd'hui.
    const from = emp.hireDate && emp.hireDate > start ? emp.hireDate : start;
    const stop = [emp.endDate || end, end, t > end ? end : t].filter(Boolean).sort()[0];
    const months = stop < from ? 0 : Math.max(0, Math.min(12, Math.round((daysBetween(from, stop) + 1) / 30.4)));
    const perYear = Number(s.leaveDaysPerYear) || 0;
    const acquired = round3(perYear * months / 12);
    const carry = Number((emp.leaveCarry || {})[y]) || 0;
    const list = leavesOf(data, employeeId, y);
    const taken = round3(list.filter(l => l.kind === 'conges').reduce((a, l) => a + l.days, 0));
    const byKind = {};
    LEAVE_KINDS.forEach(([k]) => { byKind[k] = round3(list.filter(l => l.kind === k).reduce((a, l) => a + l.days, 0)); });
    return { year: y, months, acquired, carry, taken, byKind,
      remaining: round3(acquired + carry - taken), perYear, list };
  }

  // Les avances : une somme prêtée, remboursée par retenues mensuelles sur le bulletin.
  function advancesOf(data, employeeId) {
    return (data.advances || [])
      .filter(a => !employeeId || a.employeeId === employeeId)
      .map(a => {
        const monthly = round3(Number(a.monthly) || 0);
        const amount = round3(Number(a.amount) || 0);
        const repaid = round3((data.payslips || [])
          .filter(p => p.employeeId === a.employeeId)
          .reduce((s2, p) => s2 + ((p.deductions || []).filter(d => d.advanceId === a.id).reduce((x, d) => x + (Number(d.amount) || 0), 0)), 0));
        return { ...a, amount, monthly, repaid, remaining: round3(Math.max(0, amount - repaid)), done: repaid >= amount - 0.0005 };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function advanceBalance(data, employeeId) {
    return round3(advancesOf(data, employeeId).reduce((s, a) => s + a.remaining, 0));
  }

  // Ce qu'un bulletin doit reprendre tout seul : les absences non payées du mois, et l'échéance des
  // avances en cours. C'est ce qui évite de ressaisir la même information deux fois.
  function payslipInputFor(data, employee, year, month) {
    const s = payrollSettings(data);
    const off = s.offDays;
    const absentDays = round3((data.leaves || [])
      .filter(l => l.employeeId === employee.id && !(l.paid != null ? l.paid : leaveIsPaid(l.kind)))
      .reduce((a, l) => a + leaveDaysInMonth(l, year, month, off), 0));
    const deductions = advancesOf(data, employee.id).filter(a => !a.done && a.date <= `${year}-${String(month).padStart(2, '0')}-31`)
      .map(a => ({ label: `Remboursement d'avance du ${fmtDate(a.date)}`, amount: round3(Math.min(a.monthly || a.remaining, a.remaining)), advanceId: a.id }))
      .filter(d => d.amount > 0);
    return { gross: employee.grossSalary, workedDays: Number(s.workedDays) || 26, absentDays, bonuses: [], deductions };
  }

  // ---------- documents du personnel (5.1.0) ----------
  const HR_DOCS = [
    ['attestation', 'Attestation de travail', 'Atteste qu\'une personne travaille chez toi aujourd\'hui. Demandée par une banque, un bailleur, une administration.'],
    ['certificat', 'Certificat de travail', 'Remis à la fin du contrat. Obligatoire : il indique les dates et l\'emploi occupé, rien d\'autre.'],
    ['solde', 'Solde de tout compte', 'Récapitule ce qui reste dû au départ : salaire du mois, congés non pris, indemnités.']
  ];
  const hrDocLabel = k => (HR_DOCS.find(x => x[0] === k) || [, k])[1];

  function hrDocumentHtml(kind, employee, data, company, opts) {
    opts = opts || {};
    const e = employee || {};
    const t = opts.date || today();
    const cur = company.currency || 'DT';
    const fmt = n => money(n, null, decimalsFor(cur), 'fr');
    const ink = company.primaryColor || '#1b2430';
    const accent = company.accentColor || '#0f9d8f';
    const hex = accent.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const tint = a => `rgba(${r}, ${g}, ${b}, ${a})`;
    const city = (company.address || '').split('\n').pop().replace(/^\d+\s*/, '').trim();
    const bal = leaveBalance(data, e.id, Number((e.endDate || t).slice(0, 4)), t);
    const last = (data.payslips || []).filter(p => p.employeeId === e.id)
      .sort((a, x) => (x.year - a.year) || (x.month - a.month))[0];
    const dailyRate = last ? round3(((last.computed || {}).gross || 0) / (Number(payrollSettings(data).workedDays) || 26)) : 0;
    const leavePay = round3(dailyRate * Math.max(0, bal.remaining));

    const body = {
      attestation: `
        <p>Je soussigné${company.managerName ? `, <b>${escapeHtml(company.managerName)}</b>,` : ''} agissant en qualité de représentant légal de la société <b>${escapeHtml(company.name || '')}</b>${company.matricule ? `, matricule fiscal ${escapeHtml(company.matricule)}` : ''}, atteste par la présente que :</p>
        <p class="who"><b>${escapeHtml(e.name || '')}</b>${e.cin ? `, titulaire de la carte d'identité nationale n° ${escapeHtml(e.cin)}` : ''}${e.cnss ? `, immatriculé${e.gender === 'f' ? 'e' : ''} à la CNSS sous le n° ${escapeHtml(e.cnss)}` : ''},</p>
        <p>fait partie du personnel de notre société depuis le <b>${fmtDate(e.hireDate)}</b>, en qualité de <b>${escapeHtml(e.position || '—')}</b>, dans le cadre d'un <b>${escapeHtml(contractLabel(e.contract || 'cdi').split(' —')[0])}</b>.</p>
        ${opts.withSalary ? `<p>Son salaire brut mensuel s'élève à <b>${fmt(e.grossSalary)} ${escapeHtml(cur)}</b>.</p>` : ''}
        <p>Cette attestation lui est délivrée pour servir et valoir ce que de droit.</p>`,
      certificat: `
        <p>Je soussigné${company.managerName ? `, <b>${escapeHtml(company.managerName)}</b>,` : ''} agissant en qualité de représentant légal de la société <b>${escapeHtml(company.name || '')}</b>${company.matricule ? `, matricule fiscal ${escapeHtml(company.matricule)}` : ''}, certifie que :</p>
        <p class="who"><b>${escapeHtml(e.name || '')}</b>${e.cin ? `, titulaire de la carte d'identité nationale n° ${escapeHtml(e.cin)}` : ''},</p>
        <p>a été employé${e.gender === 'f' ? 'e' : ''} au sein de notre société du <b>${fmtDate(e.hireDate)}</b> au <b>${fmtDate(e.endDate || t)}</b>, en qualité de <b>${escapeHtml(e.position || '—')}</b>.</p>
        <p>L'intéressé${e.gender === 'f' ? 'e' : ''} est libre de tout engagement envers notre société à compter de cette date.</p>
        <p>Le présent certificat lui est délivré pour servir et valoir ce que de droit.</p>`,
      solde: `
        <p>Entre la société <b>${escapeHtml(company.name || '')}</b>${company.matricule ? `, matricule fiscal ${escapeHtml(company.matricule)}` : ''}, d'une part,</p>
        <p>et <b>${escapeHtml(e.name || '')}</b>${e.cin ? `, CIN n° ${escapeHtml(e.cin)}` : ''}, employé${e.gender === 'f' ? 'e' : ''} du ${fmtDate(e.hireDate)} au <b>${fmtDate(e.endDate || t)}</b> en qualité de ${escapeHtml(e.position || '—')}, d'autre part.</p>
        <p>Il a été arrêté le solde de tout compte suivant :</p>
        <table class="sum">
          ${(opts.lines || []).map(l => `<tr><td>${escapeHtml(l.label)}</td><td class="n">${fmt(l.amount)}</td></tr>`).join('')}
          <tr class="tot"><td>Net à percevoir</td><td class="n">${fmt(round3((opts.lines || []).reduce((a, l) => a + (Number(l.amount) || 0), 0)))} ${escapeHtml(cur)}</td></tr>
        </table>
        <p class="small">Solde de congés non pris au départ : <b>${pctFr(bal.remaining)} jour(s)</b>${leavePay > 0 ? `, soit ${fmt(leavePay)} ${escapeHtml(cur)} sur la base du dernier salaire` : ''}.</p>
        <p>Le présent solde est établi en double exemplaire. <em>À VÉRIFIER : les indemnités de fin de contrat dépendent du motif de la rupture et de la convention collective applicable — faites relire ce document avant signature.</em></p>`
    }[kind] || '';

    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>${escapeHtml(hrDocLabel(kind))} — ${escapeHtml(e.name || '')}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: ${ink}; font-size: 10.5pt; line-height: 1.65; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm 20mm; background: #fff; display: flex; flex-direction: column; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding-bottom: 14px; border-bottom: 2px solid ${tint(0.35)}; }
  .co-name { font-size: 14pt; font-weight: 700; }
  .co-sub { font-size: 8pt; color: #6a7480; line-height: 1.5; }
  h1 { text-align: center; font-size: 15pt; letter-spacing: 1.2px; text-transform: uppercase; color: ${accent}; margin: 26px 0 22px; }
  .who { margin: 16px 0; padding: 10px 14px; background: ${tint(0.07)}; border-left: 3px solid ${accent}; border-radius: 0 6px 6px 0; }
  p { margin: 10px 0; text-align: justify; }
  .small { font-size: 8.5pt; color: #6a7480; }
  table.sum { width: 100%; border-collapse: collapse; margin: 14px 0; }
  table.sum td { padding: 6px 8px; border-bottom: 1px solid #eef1f4; }
  table.sum td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.sum tr.tot td { border-top: 1.5px solid ${ink}; border-bottom: none; font-weight: 700; font-size: 11.5pt; }
  .sign { margin-top: auto; padding-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .sign .s { border: 1px dashed ${tint(0.5)}; border-radius: 8px; min-height: 70px; padding: 7px 11px; font-size: 8.5pt; color: #6a7480; }
  .place { text-align: right; margin: 20px 0 0; font-size: 9.5pt; }
  .foot { margin-top: 14px; padding-top: 8px; border-top: 1px solid #eef1f4; font-size: 7.5pt; color: #8b949e; text-align: center; }
</style></head>
<body><div class="page">
  <div class="head">
    <div><div class="co-name">${escapeHtml(company.name || '')}</div>
      <div class="co-sub">${escapeHtml(company.address || '').replace(/\n/g, '<br>')}
        ${company.matricule ? `<br>MF : ${escapeHtml(company.matricule)}` : ''}
        ${company.cnss ? `<br>CNSS : ${escapeHtml(company.cnss)}` : ''}</div></div>
    <div class="co-sub" style="text-align:right">${company.phone ? escapeHtml(company.phone) + '<br>' : ''}${company.email ? escapeHtml(company.email) : ''}</div>
  </div>
  <h1>${escapeHtml(hrDocLabel(kind))}</h1>
  ${body}
  <p class="place">${city ? escapeHtml(city) + ', le ' : 'Le '}${fmtDate(t)}</p>
  <div class="sign">
    ${kind === 'solde' ? '<div class="s">Le salarié — lu et approuvé, bon pour solde de tout compte</div>' : '<div></div>'}
    <div class="s">Pour la société${company.managerName ? '<br>' + escapeHtml(company.managerName) : ''}</div>
  </div>
  <div class="foot">${escapeHtml(company.name || '')}${company.matricule ? ' — MF ' + escapeHtml(company.matricule) : ''}</div>
</div></body></html>`;
  }

  const pctFr = n => String(n).replace('.', ',');

  // Le registre du personnel : la liste que l'inspection du travail peut demander.
  function staffRegister(data, todayIso) {
    const t = todayIso || today();
    return (data.employees || []).slice()
      .sort((a, b) => (a.hireDate || '').localeCompare(b.hireDate || ''))
      .map((e, i) => ({
        n: i + 1, id: e.id, name: e.name || '', cin: e.cin || '', cnss: e.cnss || '',
        position: e.position || '', contract: contractLabel(e.contract || 'cdi').split(' —')[0],
        hireDate: e.hireDate || '', endDate: e.endDate || '',
        active: (!e.hireDate || e.hireDate <= t) && (!e.endDate || e.endDate >= t),
        grossSalary: Number(e.grossSalary) || 0
      }));
  }

  // ---------- déclarations sociales (5.2.0) ----------
  // Deux formulaires que tout employeur doit déposer, et qu'on remplit à la main en recopiant des
  // chiffres qu'on a déjà : la déclaration CNSS du trimestre, et la déclaration annuelle d'employeur.
  // SkanFact ne dépose rien — il prépare le tableau, à recopier ou à exporter pour le comptable.
  // À VÉRIFIER avec le comptable : la forme exacte, les dates et les modalités de dépôt.

  const QUARTERS = [[1, '1er trimestre', [1, 2, 3]], [2, '2e trimestre', [4, 5, 6]],
    [3, '3e trimestre', [7, 8, 9]], [4, '4e trimestre', [10, 11, 12]]];
  const quarterMonths = q => (QUARTERS.find(x => x[0] === Number(q)) || [, , []])[2];
  const quarterLabel = q => (QUARTERS.find(x => x[0] === Number(q)) || [, ''])[1];

  // La déclaration CNSS d'un trimestre : un salarié par ligne, avec son assiette et les deux parts.
  function cnssDeclaration(data, year, quarter) {
    const months = quarterMonths(quarter);
    const slips = (data.payslips || []).filter(p => Number(p.year) === Number(year) && months.includes(Number(p.month)));
    const byEmp = {};
    slips.forEach(p => {
      const c = p.computed || {};
      const e = byEmp[p.employeeId] || (byEmp[p.employeeId] = {
        employeeId: p.employeeId, name: '', cnss: '', months: 0, days: 0,
        base: 0, employee: 0, employer: 0, accident: 0, total: 0
      });
      const emp = (data.employees || []).find(x => x.id === p.employeeId) || {};
      e.name = emp.name || ''; e.cnss = emp.cnss || '';
      e.months += 1;
      e.days = round3(e.days + Math.max(0, (Number(c.workedDays) || 0) - (Number(c.absentDays) || 0)));
      e.base = round3(e.base + (c.cnssBase || 0));
      e.employee = round3(e.employee + (c.cnssEmployee || 0));
      e.employer = round3(e.employer + (c.cnssEmployer || 0));
      e.accident = round3(e.accident + (c.accident || 0));
      e.total = round3(e.employee + e.employer + e.accident);
    });
    const rows = Object.values(byEmp).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    const sum = f => round3(rows.reduce((s, r) => s + (Number(f(r)) || 0), 0));
    // Échéance usuelle : le 15 du mois suivant la fin du trimestre. À VÉRIFIER.
    const lastMonth = months[months.length - 1];
    const dueDate = lastMonth === 12 ? `${Number(year) + 1}-01-15` : `${year}-${String(lastMonth + 1).padStart(2, '0')}-15`;
    return {
      year: Number(year), quarter: Number(quarter), label: quarterLabel(quarter), months, dueDate,
      employees: rows.length, slips: slips.length,
      base: sum(r => r.base), employee: sum(r => r.employee), employer: sum(r => r.employer),
      accident: sum(r => r.accident), total: sum(r => r.total), rows
    };
  }

  // La déclaration annuelle d'employeur : le récapitulatif des salaires versés et des retenues opérées.
  // Elle porte sur deux choses distinctes que l'on confond souvent : les salaires, et les retenues à la
  // source pratiquées sur des fournisseurs (honoraires, loyers…).
  function employerAnnual(data, year, company) {
    const y = Number(year);
    const slips = (data.payslips || []).filter(p => Number(p.year) === y);
    const byEmp = {};
    slips.forEach(p => {
      const c = p.computed || {};
      const emp = (data.employees || []).find(x => x.id === p.employeeId) || {};
      const e = byEmp[p.employeeId] || (byEmp[p.employeeId] = {
        employeeId: p.employeeId, name: emp.name || '', cin: emp.cin || '', cnss: emp.cnss || '',
        position: emp.position || '', months: 0, gross: 0, cnss_: 0, taxable: 0, irpp: 0, css: 0, net: 0
      });
      e.months += 1;
      e.gross = round3(e.gross + (c.gross || 0));
      e.cnss_ = round3(e.cnss_ + (c.cnssEmployee || 0));
      e.taxable = round3(e.taxable + ((c.annualTaxable || 0) / 12));
      e.irpp = round3(e.irpp + (c.irpp || 0));
      e.css = round3(e.css + (c.css || 0));
      e.net = round3(e.net + (c.net || 0));
    });
    const rows = Object.values(byEmp).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    const sum = f => round3(rows.reduce((s, r) => s + (Number(f(r)) || 0), 0));

    // Retenues à la source opérées sur des fournisseurs dans l'année : l'autre moitié du formulaire.
    const held = (data.purchases || [])
      .filter(p => (p.date || '').slice(0, 4) === String(y) && Number(p.withholdingRate) > 0)
      .map(p => {
        const t = purchaseTotals(p, company || (data.company || {}));
        const sup = (data.suppliers || []).find(s2 => s2.id === p.supplierId) || {};
        return { purchaseId: p.id, supplier: sup.name || '—', matricule: sup.matricule || '',
          number: p.number || '', date: p.date, base: round3(t.totalTTC - t.fees),
          rate: Number(p.withholdingRate) || 0, amount: t.withholding, certificate: !!p.withholdingCertificate };
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const heldBySupplier = {};
    held.forEach(x => {
      const k = x.supplier + '|' + x.matricule;
      const e = heldBySupplier[k] || (heldBySupplier[k] = { supplier: x.supplier, matricule: x.matricule, count: 0, base: 0, amount: 0, missing: 0 });
      e.count += 1; e.base = round3(e.base + x.base); e.amount = round3(e.amount + x.amount);
      if (!x.certificate) e.missing += 1;
    });

    return {
      year: y, employees: rows.length, rows,
      gross: sum(r => r.gross), cnss: sum(r => r.cnss_), irpp: sum(r => r.irpp), css: sum(r => r.css), net: sum(r => r.net),
      held, heldBySupplier: Object.values(heldBySupplier).sort((a, b) => (a.supplier || '').localeCompare(b.supplier || '', 'fr')),
      heldTotal: round3(held.reduce((s, x) => s + x.amount, 0)),
      heldMissing: held.filter(x => !x.certificate).length,
      dueDate: `${y + 1}-04-30`     // échéance usuelle — À VÉRIFIER
    };
  }

  // Les déclarations sociales dues et pas encore marquées déposées.
  function socialDue(data, todayIso) {
    const t = todayIso || today();
    if (!(data.employees || []).length) return [];
    const done = new Set((data.socialFilings || []).map(f => f.id));
    const out = [];
    const y = Number(t.slice(0, 4));
    [y - 1, y].forEach(yy => {
      QUARTERS.forEach(([q]) => {
        const d = cnssDeclaration(data, yy, q);
        if (!d.slips || d.dueDate > addDays(t, 45)) return;       // pas encore d'actualité
        const id = `cnss-${yy}-T${q}`;
        if (done.has(id)) return;
        out.push({ id, kind: 'cnss', year: yy, quarter: q, label: `Déclaration CNSS ${quarterLabel(q)} ${yy}`,
          dueDate: d.dueDate, late: d.dueDate < t, amount: d.total });
      });
      const a = employerAnnual(data, yy, data.company);
      if (a.rows.length && a.dueDate <= addDays(t, 60)) {
        const id = `employeur-${yy}`;
        if (!done.has(id)) out.push({ id, kind: 'employeur', year: yy, label: `Déclaration annuelle d'employeur ${yy}`,
          dueDate: a.dueDate, late: a.dueDate < t, amount: round3(a.irpp + a.css) });
      }
    });
    return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  // ---------- lecture d'une photo de facture (4.2.0) ----------
  // La partie testable du module : transformer ce qu'un service de lecture a cru voir en un achat
  // propre, et DIRE ce qui ne colle pas. Rien n'est enregistré ici — c'est l'utilisateur qui valide.
  // L'appel réseau lui-même vit dans main.js, et n'a lieu que si une clé a été saisie.

  function ocrNumber(v) {
    if (v == null || v === '') return 0;
    // « 1 234,56 DT », « 1.234,56 », « 1,234.56 » : on retire tout sauf les chiffres et le séparateur.
    let t = String(v).replace(/[^\d.,-]/g, '');
    const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      // Le dernier des deux est le séparateur décimal, l'autre sépare les milliers.
      if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.');
      else t = t.replace(/,/g, '');
    } else if (lastComma >= 0) {
      t = t.replace(/,/g, '.');
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }

  // Ce qui a été lu, ramené à la forme d'un achat, avec la liste de ce qui mérite un coup d'œil.
  function ocrToPurchase(read, data, todayIso) {
    const r = read || {};
    const t = todayIso || today();
    const norm = x => (x || '').trim().toLowerCase();
    // Le fournisseur se reconnaît d'abord au matricule (unique), ensuite au nom (approximatif).
    const supplier = (data.suppliers || []).find(s2 => r.matricule && norm(s2.matricule) === norm(r.matricule))
      || (data.suppliers || []).find(s2 => r.supplier && norm(s2.name) === norm(r.supplier))
      || null;
    let lines = (Array.isArray(r.lines) ? r.lines : []).map(l => ({
      label: String(l.label || '').trim(),
      qty: ocrNumber(l.qty) || 1,
      unit: '',
      unitPrice: ocrNumber(l.unitPrice),
      vatRate: VAT_RATES.includes(ocrNumber(l.vatRate)) ? ocrNumber(l.vatRate) : 19,
      destination: 'charge', deductible: true
    })).filter(l => l.label || l.unitPrice);
    if (!lines.length) {
      lines = [{ label: r.subject || 'À compléter', qty: 1, unit: '', unitPrice: ocrNumber(r.totalHT),
        vatRate: 19, destination: 'charge', deductible: true }];
    }
    const computedHT = round3(lines.reduce((s2, l) => s2 + l.qty * l.unitPrice, 0));
    const readHT = r.totalHT == null ? null : ocrNumber(r.totalHT);
    const date = parseDateInput(r.date || '') || t;
    const warnings = [];
    if (!supplier) warnings.push(r.supplier ? `Fournisseur « ${r.supplier} » inconnu : à choisir ou à créer.` : 'Aucun fournisseur lu : à choisir.');
    if (!r.number) warnings.push('Aucun numéro de facture lu : il est obligatoire pour déduire la TVA.');
    if (readHT != null && Math.abs(round3(computedHT - readHT)) > 0.005) {
      warnings.push(`Les lignes totalisent ${computedHT} alors que la pièce annonce ${readHT}.`);
    }
    if (date > t) warnings.push('La date lue est dans le futur : vérifie-la.');
    return {
      head: {
        supplierId: supplier ? supplier.id : '',
        supplierName: supplier ? supplier.name : (r.supplier || ''),
        matricule: r.matricule || '',
        number: r.number || '',
        date,
        dueDate: parseDateInput(r.dueDate || '') || '',
        subject: r.subject || '',
        fees: ocrNumber(r.fees)
      },
      lines, computedHT, readHT, warnings
    };
  }

  // ---------- numéros de série, garanties et parc client (4.1.0) ----------
  // Un numéro de série est une unité physique qu'on peut suivre nommément : entrée par un achat,
  // sortie chez un client, sous garantie jusqu'à une date. C'est ce qui permet de répondre à
  // « depuis quand ce serveur est chez eux, et est-il encore garanti ? » sans fouiller un classeur.
  //
  // Le suivi par série ne remplace pas le stock en quantité : il le double pour les articles qui s'y
  // prêtent (du matériel), et `serialGap` signale quand les deux ne disent plus la même chose.

  const SERIAL_STATUSES = [
    ['stock', 'En stock'], ['vendu', 'Chez le client'], ['retour', 'Retourné'], ['hs', 'Hors service']
  ];
  const serialStatusLabel = k => (SERIAL_STATUSES.find(x => x[0] === k) || [, k])[1];
  // Durées de garantie couramment proposées. Le constructeur décide, pas l'application.
  const WARRANTY_CHOICES = [0, 6, 12, 24, 36, 60];

  function serializedItems(data) {
    return (data.catalog || []).filter(c => c.serialized);
  }

  // Fin de garantie : calculée à la SORTIE, pas à l'achat — la garantie du client court du jour où il
  // reçoit le matériel. Sans date de sortie, il n'y a pas encore de garantie à compter.
  function warrantyEnd(serial) {
    const months = Number(serial.warrantyMonths) || 0;
    if (!serial.outDate || !months) return '';
    return addDays(addMonths(serial.outDate, months, Number(serial.outDate.slice(8, 10))), -1);
  }

  function serialView(serial, data, todayIso) {
    const t = todayIso || today();
    const item = (data.catalog || []).find(c => c.id === serial.itemId) || {};
    const client = (data.clients || []).find(c => c.id === serial.clientId) || null;
    const end = warrantyEnd(serial);
    const days = end ? daysBetween(t, end) : null;
    return {
      ...serial, itemLabel: item.label || '', clientName: client ? client.name : '',
      warrantyEndDate: end,
      warrantyDays: days,
      underWarranty: !!end && end >= t,
      warrantyEndingSoon: !!end && end >= t && days <= 60,
      expired: !!end && end < t
    };
  }

  function serialList(data, filter, todayIso) {
    const f = filter || {};
    return (data.serials || []).map(x => serialView(x, data, todayIso))
      .filter(x => (!f.itemId || x.itemId === f.itemId)
        && (!f.clientId || x.clientId === f.clientId)
        && (!f.status || x.status === f.status))
      .sort((a, b) => (b.inDate || '').localeCompare(a.inDate || '') || (a.serial || '').localeCompare(b.serial || '', undefined, { numeric: true }));
  }

  // Les unités disponibles pour une vente : en stock, jamais sorties.
  function availableSerials(data, itemId) {
    return (data.serials || []).filter(x => x.itemId === itemId && x.status === 'stock')
      .sort((a, b) => (a.inDate || '').localeCompare(b.inDate || '') || (a.serial || '').localeCompare(b.serial || '', undefined, { numeric: true }));
  }

  // Le parc d'un client : ce qu'il a chez lui, depuis quand, garanti jusqu'à quand.
  function clientFleet(data, clientId, todayIso) {
    return serialList(data, { clientId, status: 'vendu' }, todayIso)
      .sort((a, b) => (b.outDate || '').localeCompare(a.outDate || ''));
  }

  // Les garanties qui se terminent bientôt : une fin de garantie est une occasion de proposer un
  // contrat de maintenance, pas une mauvaise nouvelle.
  function warrantiesEnding(data, days, todayIso) {
    const t = todayIso || today();
    const limit = addDays(t, days == null ? 60 : days);
    return serialList(data, { status: 'vendu' }, t)
      .filter(x => x.warrantyEndDate && x.warrantyEndDate >= t && x.warrantyEndDate <= limit)
      .sort((a, b) => a.warrantyEndDate.localeCompare(b.warrantyEndDate));
  }

  // Le stock compté en quantité et le stock compté en numéros doivent dire la même chose. Quand ils
  // divergent, c'est qu'un numéro n'a pas été saisi à l'entrée ou pas attribué à la sortie.
  function serialGap(data, itemId, todayIso) {
    const item = (data.catalog || []).find(c => c.id === itemId);
    if (!item || !item.serialized || !item.tracked) return null;
    const qty = stockOf(data, itemId, todayIso).qty;
    const serials = (data.serials || []).filter(x => x.itemId === itemId && x.status === 'stock').length;
    const gap = round3(qty - serials);
    return gap === 0 ? null : { itemId, label: item.label, qty, serials, gap };
  }

  function serialGaps(data, todayIso) {
    return serializedItems(data).map(c => serialGap(data, c.id, todayIso)).filter(Boolean);
  }

  // ---------- immobilisations et amortissements (3.5.0) ----------
  // Une immobilisation n'est pas une charge : elle reste dans l'entreprise et se déduit un peu chaque
  // année. Le module transforme une ligne d'achat marquée « immobilisation » en un bien amortissable,
  // et calcule la dotation de chaque exercice ainsi que la valeur nette comptable.
  //
  // Amortissement LINÉAIRE, prorata temporis au jour, base 360 (12 mois de 30 jours) : c'est la règle
  // tunisienne usuelle. La première annuité est réduite au nombre de jours d'utilisation de l'année de
  // mise en service, et la dernière reprend ce qui reste. À VÉRIFIER avec le comptable : les durées et
  // la règle de prorata dépendent de la nature du bien et du régime.

  // Familles proposées, avec la durée d'usage couramment admise. Aucune n'est imposée : l'utilisateur
  // change la durée bien par bien, et la bulle d'aide dit que c'est au comptable de trancher.
  const DEFAULT_ASSET_CLASSES = [
    ['informatique', 'Matériel informatique', 3],
    ['logiciel', 'Logiciels et licences', 3],
    ['bureau', 'Matériel de bureau', 5],
    ['mobilier', 'Mobilier', 10],
    ['outillage', 'Outillage et matériel technique', 5],
    ['transport', 'Matériel de transport', 5],
    ['agencement', 'Agencements et installations', 10],
    ['construction', 'Constructions', 20],
    ['autre', 'Autre immobilisation', 5]
  ];
  const assetClassLabel = k => (DEFAULT_ASSET_CLASSES.find(c => c[0] === k) || [, 'Autre immobilisation'])[1];
  const assetClassYears = k => (DEFAULT_ASSET_CLASSES.find(c => c[0] === k) || [, , 5])[2];

  // Nombre de jours entre deux dates en base 360 (mois de 30 jours), comme le veut le prorata temporis.
  function days360(fromIso, toIso) {
    if (!fromIso || !toIso || toIso < fromIso) return 0;
    const [y1, m1, d1] = fromIso.split('-').map(Number);
    const [y2, m2, d2] = toIso.split('-').map(Number);
    return (y2 - y1) * 360 + (m2 - m1) * 30 + (Math.min(d2, 30) - Math.min(d1, 30));
  }

  // Le tableau d'amortissement d'un bien : une ligne par exercice, de la mise en service à la fin.
  // `base` = valeur amortissable (acquisition − valeur résiduelle). La dernière annuité absorbe les
  // arrondis, sinon la VNC finirait à 0,001 DT au lieu de zéro.
  function assetSchedule(asset) {
    const value = Number(asset.amount) || 0;
    const residual = Number(asset.residual) || 0;
    const years = Number(asset.years) || 0;
    const start = asset.date || '';
    const base = round3(Math.max(0, value - residual));
    if (!start || years <= 0 || base <= 0) return [];
    const end = addDays(addMonths(start, years * 12, Number(start.slice(8, 10))), -1);   // dernier jour amorti
    const perYear = base / years;
    const rows = [];
    let cumulated = 0;
    const firstYear = Number(start.slice(0, 4));
    const lastYear = Number(end.slice(0, 4));
    for (let y = firstYear; y <= lastYear; y++) {
      const from = y === firstYear ? start : `${y}-01-01`;
      const to = y === lastYear ? end : `${y}-12-31`;
      // +1 jour : le jour de mise en service compte, et le 31/12 aussi.
      const d = Math.max(0, days360(from, to) + 1);
      let annuity = round3(perYear * d / 360);
      if (y === lastYear) annuity = round3(base - cumulated);         // la dernière solde le reste
      if (round3(cumulated + annuity) > base) annuity = round3(base - cumulated);
      cumulated = round3(cumulated + annuity);
      rows.push({ year: y, from, to, days: d, annuity, cumulated, nbv: round3(value - cumulated) });
    }
    return rows;
  }

  // Dotation de l'exercice `year` — zéro hors période d'amortissement, et zéro après une cession
  // (l'année de la cession, on amortit jusqu'au jour de la sortie : c'est ce que fait `assetYear`).
  function assetYear(asset, year) {
    const rows = assetSchedule(asset);
    const row = rows.find(r => r.year === year);
    const disposal = asset.disposal && asset.disposal.date ? asset.disposal.date : '';
    // Sorti d'un exercice antérieur : plus rien ne bouge, le cumul reste figé au jour de la cession.
    if (disposal && Number(disposal.slice(0, 4)) < year) return { annuity: 0, cumulated: assetCumulated(asset, disposal), nbv: 0, out: true };
    if (!row) return { annuity: 0, cumulated: assetCumulated(asset, `${year}-12-31`), nbv: round3((Number(asset.amount) || 0) - assetCumulated(asset, `${year}-12-31`)), out: !!disposal };
    if (disposal && Number(disposal.slice(0, 4)) === year) {
      const partial = assetCumulated(asset, disposal);
      const before = assetCumulated(asset, `${year - 1}-12-31`);
      return { annuity: round3(partial - before), cumulated: partial, nbv: round3((Number(asset.amount) || 0) - partial), out: true };
    }
    return { annuity: row.annuity, cumulated: row.cumulated, nbv: row.nbv, out: false };
  }

  // Amortissement cumulé à une date quelconque (utile pour la VNC au jour d'une cession).
  function assetCumulated(asset, dateIso) {
    const value = Number(asset.amount) || 0;
    const residual = Number(asset.residual) || 0;
    const years = Number(asset.years) || 0;
    const start = asset.date || '';
    const base = round3(Math.max(0, value - residual));
    if (!start || years <= 0 || base <= 0 || dateIso < start) return 0;
    // `d` est un nombre de jours base 360 ; la durée totale vaut `years * 360` jours.
    const d = Math.min(years * 360, days360(start, dateIso) + 1);
    return round3(Math.min(base, base * d / (years * 360)));
  }

  // Valeur nette comptable : ce que le bien « vaut » encore dans les comptes.
  function assetNBV(asset, dateIso) {
    return round3((Number(asset.amount) || 0) - assetCumulated(asset, dateIso));
  }

  // Résultat d'une cession : prix de vente moins la VNC au jour de la sortie.
  // Positif = plus-value (imposable), négatif = moins-value. À VÉRIFIER avec le comptable.
  function disposalResult(asset) {
    const dis = asset.disposal;
    if (!dis || !dis.date) return null;
    const nbv = assetNBV(asset, dis.date);
    const price = Number(dis.amount) || 0;
    return { date: dis.date, price, nbv, result: round3(price - nbv), reason: dis.reason || '' };
  }

  // L'état des immobilisations pour un exercice : une ligne par bien, avec la dotation de l'année.
  function assetsList(data, year) {
    const y = Number(year) || Number(today().slice(0, 4));
    return (data.assets || []).map(a => {
      const v = assetYear(a, y);
      const dis = disposalResult(a);
      return {
        ...a, ...v,
        opening: round3(assetCumulated(a, `${y - 1}-12-31`)),
        disposalResult: dis,
        active: a.date <= `${y}-12-31` && !(dis && Number(dis.date.slice(0, 4)) < y)
      };
    }).filter(a => a.active).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  function assetTotals(data, year) {
    const rows = assetsList(data, year);
    const sum = (f) => round3(rows.reduce((s, r) => s + (Number(f(r)) || 0), 0));
    return {
      count: rows.length,
      gross: sum(r => r.amount),
      opening: sum(r => r.opening),
      annuity: sum(r => r.annuity),
      cumulated: sum(r => r.cumulated),
      nbv: sum(r => r.out ? 0 : r.nbv),
      disposals: rows.filter(r => r.disposalResult && Number(r.disposalResult.date.slice(0, 4)) === Number(year)),
      rows
    };
  }

  // Les lignes d'achat marquées « immobilisation » qui n'ont pas encore de fiche : c'est le pont entre
  // le module Achats et celui-ci. On ne crée jamais la fiche tout seul — la durée d'amortissement est
  // une décision, pas une donnée.
  function assetsToCreate(data) {
    const done = new Set((data.assets || []).filter(a => a.purchaseId).map(a => `${a.purchaseId}#${a.lineIndex}`));
    const out = [];
    (data.purchases || []).forEach(p => {
      (p.lines || []).forEach((l, i) => {
        if (l.destination !== 'immobilisation') return;
        if (done.has(`${p.id}#${i}`)) return;
        const amount = round3((Number(l.qty) || 0) * (Number(l.unitPrice) || 0));
        if (amount <= 0) return;
        out.push({ purchaseId: p.id, lineIndex: i, label: l.label || '', amount, date: p.date, supplierId: p.supplierId, number: p.number || '' });
      });
    });
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  // Amortissement cumulé, figé au jour de la sortie : après une cession, plus rien ne se déduit.
  function cappedCumulated(asset, dateIso) {
    const out = asset.disposal && asset.disposal.date ? asset.disposal.date : '';
    return assetCumulated(asset, out && dateIso > out ? out : dateIso);
  }

  // Dotation de la PÉRIODE : c'est elle qui manquait au résultat simplifié et au seuil de rentabilité.
  // Une immobilisation n'est pas une charge de l'année de l'achat, mais son amortissement EST une charge
  // de chaque exercice.
  //
  // Attention au piège : la page Comptabilité peut demander un seul mois. Retourner la dotation de
  // l'année entière ferait un résultat mensuel catastrophique et faux (c'est arrivé). On calcule donc
  // la dotation exactement sur la période demandée, par différence de cumuls.
  function depreciationFor(data, period) {
    if (!period || !period.from || !period.to) return 0;
    const y = Number(period.from.slice(0, 4));
    // Année civile complète : on reprend le chiffre du tableau des amortissements, au millime près,
    // pour que la page Comptabilité et la page Immobilisations ne se contredisent jamais.
    if (period.from === `${y}-01-01` && period.to === `${y}-12-31`) return assetTotals(data, y).annuity;
    const before = addDays(period.from, -1);
    return round3((data.assets || []).reduce((s, a) =>
      s + Math.max(0, round3(cappedCumulated(a, period.to) - cappedCumulated(a, before))), 0));
  }

  // ---------- trésorerie (3.3.0) ----------
  // « Tu vois ce qu'on te doit, tu ne vois pas ce que tu as. » Ce bloc répond à la seule question qui
  // tue les entreprises rentables : est-ce que j'aurai de quoi payer le mois prochain ?
  //
  // Principe : aucune saisie en double. Les mouvements sont DÉDUITS des paiements clients et des
  // règlements fournisseurs déjà enregistrés. On n'ajoute que ce qui n'existe nulle part ailleurs :
  // les comptes, le solde de départ, et les mouvements libres (salaires, impôts, apports, retraits).

  const ACCOUNT_KINDS = [['banque', 'Compte bancaire'], ['caisse', 'Caisse espèces'], ['autre', 'Autre']];
  // Nature d'un mouvement saisi à la main — ce qui ne vient ni d'une facture ni d'un achat.
  const MOVE_KINDS = [
    ['salaire', 'Salaires et charges', -1], ['impot', 'Impôts et taxes', -1], ['banque', 'Frais bancaires', -1],
    ['retrait', 'Retrait ou dividende', -1], ['emprunt', 'Échéance d\'emprunt', -1], ['autre-sortie', 'Autre sortie', -1],
    ['apport', 'Apport ou subvention', 1], ['pret', 'Déblocage de prêt', 1], ['autre-entree', 'Autre entrée', 1]
  ];
  const moveSign = kind => { const m = MOVE_KINDS.find(x => x[0] === kind); return m ? m[2] : -1; };

  // Tous les mouvements réels d'une période, quelle que soit leur origine. Un mouvement porte
  // toujours un compte : sans compte affecté, il est rattaché au compte par défaut.
  function cashMovements(data, company, period, accountId) {
    const out = [];
    const defaultAccount = (data.accounts || []).find(a => a.isDefault) || (data.accounts || [])[0];
    const fallback = defaultAccount ? defaultAccount.id : '';
    const keep = id => !accountId || (id || fallback) === accountId;
    const clientName = id => ((data.clients || []).find(c => c.id === id) || {}).name || '—';
    const supplierName = id => ((data.suppliers || []).find(s => s.id === id) || {}).name || '—';

    (data.documents || []).filter(d => d.type === 'facture').forEach(d => (d.payments || []).forEach(p => {
      if (!inPeriod(p.date, period && period.from, period && period.to) || !keep(p.accountId)) return;
      out.push({
        id: p.id, kind: 'encaissement', date: p.date, accountId: p.accountId || fallback,
        label: `Encaissement ${d.number || ''}`.trim(), party: clientName(d.clientId),
        amount: round3(toBase(d, Number(p.amount) || 0, company)), method: p.method || '',
        reference: p.reference || '', docId: d.id, reconciled: !!p.reconciled, source: 'vente'
      });
    }));
    (data.purchases || []).forEach(pu => (pu.payments || []).forEach(p => {
      if (!inPeriod(p.date, period && period.from, period && period.to) || !keep(p.accountId)) return;
      out.push({
        id: p.id, kind: 'decaissement', date: p.date, accountId: p.accountId || fallback,
        label: `Règlement ${pu.number || 'sans numéro'}`, party: supplierName(pu.supplierId),
        amount: -round3(Number(p.amount) || 0), method: p.method || '',
        reference: p.reference || '', purchaseId: pu.id, reconciled: !!p.reconciled, source: 'achat'
      });
    }));
    // Un bulletin réglé est une sortie d'argent : elle remonte toute seule, comme un paiement client.
    // C'est pour ça qu'il ne faut PAS saisir en plus un mouvement libre « Salaires » pour le même mois —
    // `todoList` le signale si les deux existent.
    (data.payslips || []).forEach(sl => {
      if (!sl.paidDate || !inPeriod(sl.paidDate, period && period.from, period && period.to) || !keep(sl.accountId)) return;
      const emp = (data.employees || []).find(e => e.id === sl.employeeId) || {};
      const net = ((sl.computed || {}).net) || 0;
      if (!net) return;
      out.push({
        id: 'pay-' + sl.id, kind: 'sortie', date: sl.paidDate, accountId: sl.accountId || fallback,
        label: `Salaire ${monthLabel(payslipDate(sl))}`, party: emp.name || 'Salarié',
        amount: -round3(net), method: sl.method || 'virement', reference: sl.reference || '',
        payslipId: sl.id, reconciled: !!sl.reconciled, source: 'paie'
      });
    });
    (data.movements || []).forEach(m => {
      if (!inPeriod(m.date, period && period.from, period && period.to) || !keep(m.accountId)) return;
      const label = (MOVE_KINDS.find(k => k[0] === m.kind) || [null, 'Mouvement'])[1];
      out.push({
        id: m.id, kind: moveSign(m.kind) > 0 ? 'entree' : 'sortie', date: m.date, accountId: m.accountId || fallback,
        label: m.label || label, party: label, amount: round3(moveSign(m.kind) * Math.abs(Number(m.amount) || 0)),
        method: m.method || '', reference: m.reference || '', movementId: m.id, reconciled: !!m.reconciled, source: 'libre'
      });
    });
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.label || '').localeCompare(b.label || ''));
  }

  // Solde d'un compte à une date : son solde de départ plus tous les mouvements jusque-là.
  function accountBalance(data, company, accountId, toIso) {
    const acc = (data.accounts || []).find(a => a.id === accountId);
    if (!acc) return { opening: 0, movements: 0, balance: 0, count: 0 };
    const moves = cashMovements(data, company, { from: acc.openingDate || '', to: toIso || '9999-12-31' }, accountId);
    const sum = round3(moves.reduce((s, m) => s + m.amount, 0));
    const opening = round3(Number(acc.opening) || 0);
    return { opening, movements: sum, balance: round3(opening + sum), count: moves.length };
  }

  // Tableau de bord de tous les comptes, avec la part non pointée sur le relevé.
  function cashPosition(data, company, todayIso) {
    const t = todayIso || today();
    const accounts = (data.accounts || []).map(a => {
      const b = accountBalance(data, company, a.id, t);
      const all = cashMovements(data, company, { from: a.openingDate || '', to: t }, a.id);
      const pending = round3(all.filter(m => !m.reconciled).reduce((s, m) => s + m.amount, 0));
      return { ...a, ...b, pending, reconciled: round3(b.balance - pending) };
    });
    return { accounts, total: round3(accounts.reduce((s, a) => s + a.balance, 0)) };
  }

  // Prévision : le solde d'aujourd'hui, puis ce qui doit rentrer et sortir, jour après jour.
  // On ne prévoit que ce qui a une échéance connue — pas de projection statistique, pas de devinette.
  function cashForecast(data, company, days, todayIso) {
    const t = todayIso || today();
    const horizon = addDays(t, Math.max(1, Number(days) || 90));
    const start = cashPosition(data, company, t).total;
    const events = [];

    // Ce qui doit rentrer : le reste à payer de chaque facture ouverte, à son échéance.
    (data.documents || []).filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée').forEach(d => {
      const rest = invoiceBalance(d, data, company).remaining;
      if (rest <= 0.0005) return;
      // Une facture déjà échue est attendue « tout de suite » : la repousser serait se mentir.
      const due = d.dueDate && d.dueDate > t ? d.dueDate : t;
      if (due > horizon) return;
      events.push({ date: due, amount: round3(toBase(d, rest, company)), kind: 'client', late: !!(d.dueDate && d.dueDate < t),
        label: `${d.number || 'Facture'} — ${((data.clients || []).find(c => c.id === d.clientId) || {}).name || ''}`.trim(), id: d.id });
    });
    // Ce qui doit sortir : le reste dû de chaque achat.
    (data.purchases || []).forEach(p => {
      const rest = purchaseBalance(p, company).remaining;
      if (rest <= 0.0005) return;
      const due = p.dueDate && p.dueDate > t ? p.dueDate : t;
      if (due > horizon) return;
      events.push({ date: due, amount: -rest, kind: 'fournisseur', late: !!(p.dueDate && p.dueDate < t),
        label: `${p.number || 'Achat'} — ${((data.suppliers || []).find(s => s.id === p.supplierId) || {}).name || ''}`.trim(), id: p.id });
    });
    // Ce qui revient tout seul : les contrats récurrents déjà programmés.
    (data.recurring || []).filter(r => r.active !== false).forEach(r => {
      let d = r.nextDate;
      for (let i = 0; i < 24 && d && d <= horizon; i++) {
        if (d >= t) {
          const inv = buildRecurringInvoice(r, d, company);
          const due = addDays(d, Number(company.paymentTermsDays) || 30);
          if (due <= horizon) events.push({ date: due, amount: round3(computeTotals(inv, company).netToPay), kind: 'contrat',
            label: fillTemplate(r.subject, { mois: monthLabel(d), annee: d.slice(0, 4) }), id: r.id });
        }
        d = nextRecurrenceDate(d, r.every, r.day);
      }
    });
    // Les échéances fiscales : on connaît la date, pas le montant. On les signale sans les chiffrer.
    const fiscal = upcomingFiscal(data, t, Math.max(1, Number(days) || 90));

    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    // Courbe jour par jour, uniquement aux dates où il se passe quelque chose (plus lisible qu'un point par jour).
    const points = [{ date: t, balance: start, label: 'aujourd\'hui', delta: 0 }];
    let running = start, lowest = { date: t, balance: start };
    events.forEach(e => {
      running = round3(running + e.amount);
      points.push({ date: e.date, balance: running, label: e.label, delta: e.amount, kind: e.kind });
      if (running < lowest.balance) lowest = { date: e.date, balance: running, label: e.label };
    });
    const inflow = round3(events.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0));
    const outflow = round3(events.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0));
    return {
      today: t, horizon, start, events, points, inflow, outflow, end: running, lowest, fiscal,
      // Le seul chiffre qui compte vraiment : à quelle date, si rien ne change, on passe en négatif.
      shortfall: lowest.balance < 0 ? lowest : null,
      late: { clients: events.filter(e => e.late && e.amount > 0), suppliers: events.filter(e => e.late && e.amount < 0) }
    };
  }

  // Rapprochement : ce que dit ton relevé face à ce que dit SkanFact.
  function reconciliation(data, company, accountId, toIso) {
    const acc = (data.accounts || []).find(a => a.id === accountId);
    if (!acc) return null;
    const b = accountBalance(data, company, accountId, toIso);
    const moves = cashMovements(data, company, { from: acc.openingDate || '', to: toIso || '9999-12-31' }, accountId);
    const pending = moves.filter(m => !m.reconciled);
    const statement = Number(acc.statementBalance);
    const known = Number.isFinite(statement) && acc.statementBalance !== '' && acc.statementBalance != null;
    // Solde pointé = départ + mouvements pointés. C'est lui qui doit tomber sur le relevé.
    const pointed = round3(b.opening + moves.filter(m => m.reconciled).reduce((s, m) => s + m.amount, 0));
    return {
      account: acc, opening: b.opening, balance: b.balance, pointed,
      pendingCount: pending.length, pendingAmount: round3(pending.reduce((s, m) => s + m.amount, 0)),
      statement: known ? round3(statement) : null,
      gap: known ? round3(pointed - statement) : null, moves
    };
  }

  // ---------- travailler à deux sur les mêmes données (3.2.0) ----------
  // Deux postes partagent un dossier (iCloud, OneDrive, clé USB, disque réseau). Chacun écrit le
  // fichier à son tour. Le danger n'est pas la panne : c'est le silence. Sans garde-fou, le dernier
  // qui enregistre écrase le travail de l'autre sans que personne ne le sache jamais.
  //
  // Le principe retenu : on ne fusionne JAMAIS deux versions d'une même pièce en une troisième.
  // On garde celle du fichier écrit le plus récemment, on signale le désaccord, et on archive
  // l'autre version pour qu'elle reste consultable. Rien n'est détruit sans trace.

  // Les listes du fichier qui se fusionnent pièce par pièce, grâce à leur identifiant.
  const MERGE_LISTS = ['clients', 'catalog', 'documents', 'recurring', 'templates', 'snippets', 'suppliers', 'purchases', 'accounts', 'movements', 'projects', 'assets', 'stockAdjustments', 'serials', 'employees', 'payslips', 'leaves', 'advances', 'socialFilings', 'packs'];
  const LIST_LABELS = {
    clients: 'client', catalog: 'prestation', documents: 'document', recurring: 'contrat récurrent',
    templates: 'modèle', snippets: 'texte', suppliers: 'fournisseur', purchases: 'achat',
    accounts: 'compte', movements: 'mouvement', projects: 'affaire', assets: 'immobilisation', stockAdjustments: 'mouvement de stock', serials: 'numéro de série', employees: 'salarié', payslips: 'bulletin de paie', leaves: 'congé', advances: 'avance sur salaire', socialFilings: 'déclaration sociale', packs: 'envoi au cabinet'
  };

  function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // Étiquette lisible d'une pièce, pour dire à l'utilisateur ce qui a bougé.
  function recordLabel(kind, rec) {
    if (!rec) return '';
    if (kind === 'documents') return `${TITLES[rec.type] || 'Document'} ${rec.number || '(brouillon)'}`;
    if (kind === 'purchases') return `Achat ${rec.number || 'sans numéro'}`;
    return rec.name || rec.label || rec.subject || rec.id || '';
  }

  // Fusion de deux versions du même dossier. `mine` = ce qu'on a en mémoire, `theirs` = ce qui est
  // sur le disque partagé. Aucune des deux n'est modifiée.
  function mergeData(mine, theirs) {
    const a = migrateData(mine), b = migrateData(theirs);
    // Quel fichier a été écrit en dernier : c'est lui qui tranche en cas de désaccord sur une pièce.
    const aTime = Number(a.syncWrittenAt) || 0, bTime = Number(b.syncWrittenAt) || 0;
    const theirsWins = bTime > aTime;
    const out = JSON.parse(JSON.stringify(theirsWins ? b : a));
    const winner = theirsWins ? b : a, loser = theirsWins ? a : b;
    const conflicts = [], added = [], archive = (out.conflictArchive || []).slice();

    // Suppressions : sans trace, une pièce supprimée ici réapparaîtrait à la fusion, venue de l'autre poste.
    const tombstones = {};
    [].concat(a.deleted || [], b.deleted || []).forEach(t => { if (t && t.id) tombstones[t.id] = t; });
    out.deleted = Object.values(tombstones).sort((x, y) => (x.at || '').localeCompare(y.at || ''));

    MERGE_LISTS.forEach(kind => {
      const byId = {};
      (winner[kind] || []).forEach(r => { if (r && r.id) byId[r.id] = { rec: r, from: 'winner' }; });
      (loser[kind] || []).forEach(r => {
        if (!r || !r.id) return;
        const cur = byId[r.id];
        if (!cur) { byId[r.id] = { rec: r, from: 'loser' }; added.push({ kind, label: recordLabel(kind, r) }); return; }
        if (sameJson(cur.rec, r)) return;
        // Les deux postes ont touché la même pièce : on garde celle du fichier le plus récent,
        // on le dit, et on met l'autre de côté au lieu de la jeter.
        conflicts.push({ kind, id: r.id, label: recordLabel(kind, r), kept: theirsWins ? 'autre poste' : 'ce poste' });
        archive.push({ at: new Date().toISOString(), kind, id: r.id, label: recordLabel(kind, r), record: r });
      });
      out[kind] = Object.values(byId).map(x => x.rec).filter(r => !tombstones[r.id]);
    });

    // Compteurs de numérotation : on prend toujours le plus haut. Un numéro déjà attribué quelque part
    // ne doit jamais être réutilisé, même si l'autre poste ne l'a pas encore vu.
    out.counters = { ...(loser.counters || {}) };
    Object.keys(winner.counters || {}).forEach(k => {
      out.counters[k] = Math.max(Number(out.counters[k]) || 0, Number(winner.counters[k]) || 0);
    });

    // Fiche société : elle ne se fusionne pas champ par champ. Celle du fichier le plus récent gagne.
    if (!sameJson(a.company, b.company)) conflicts.push({ kind: 'company', id: 'company', label: 'Fiche société', kept: theirsWins ? 'autre poste' : 'ce poste' });

    // Deux personnes hors ligne peuvent avoir émis la même facture sous le même numéro. C'est le seul
    // désaccord que SkanFact ne peut pas trancher : il se signale fort, il se corrige à la main.
    const seen = {}, duplicates = [];
    (out.documents || []).forEach(d => {
      if (!d.number || d.status === 'brouillon') return;
      const k = `${d.type}|${d.number}`;
      if (seen[k] && seen[k] !== d.id) duplicates.push({ type: d.type, number: d.number, label: `${TITLES[d.type] || 'Document'} ${d.number}` });
      else seen[k] = d.id;
    });

    out.conflictArchive = archive.slice(-200);   // on ne garde pas l'historique des conflits à l'infini
    return {
      data: out, conflicts, duplicates, added,
      keptFrom: theirsWins ? 'autre poste' : 'ce poste',
      counts: { conflicts: conflicts.length, duplicates: duplicates.length, added: added.length }
    };
  }

  // Enregistre la suppression d'une pièce, pour qu'elle ne revienne pas à la fusion suivante.
  function trackDeletion(data, kind, id, label) {
    if (!data || !id) return data;
    if (!Array.isArray(data.deleted)) data.deleted = [];
    if (!data.deleted.some(t => t.id === id)) data.deleted.push({ id, kind, label: label || '', at: new Date().toISOString() });
    if (data.deleted.length > 2000) data.deleted = data.deleted.slice(-2000);
    return data;
  }

  // ---------- TVA réelle et calendrier fiscal (3.1.0) ----------
  // Tout ce bloc relève du « À VÉRIFIER avec ton comptable » : ce sont des calculs arithmétiques
  // exacts sur tes données, pas une déclaration officielle. Les dates, la périodicité et le régime
  // applicable dépendent de ta situation.

  // Déclaration de TVA d'une période : collectée (ventes) moins déductible (achats), par taux.
  // `carryIn` est le crédit de TVA reporté du mois précédent, s'il y en a un.
  function vatReturn(data, company, period, carryIn) {
    const sales = salesJournal(data, company, period);
    const buys = purchaseJournal(data, company, period);
    const byRate = {};
    VAT_RATES.forEach(r => { byRate[r] = { collected: 0, deductible: 0 }; });
    sales.forEach(row => VAT_RATES.forEach(r => { byRate[r].collected = round3(byRate[r].collected + (row.vatByRate[r] ? row.vatByRate[r].vat : 0)); }));
    (data.purchases || []).filter(p => inPeriod(p.date, period && period.from, period && period.to)).forEach(p => {
      const t = purchaseTotals(p, company);
      Object.keys(t.vatByRate).forEach(rate => {
        if (!byRate[rate]) byRate[rate] = { collected: 0, deductible: 0 };
        byRate[rate].deductible = round3(byRate[rate].deductible + t.vatByRate[rate].deductible);
      });
    });
    const collected = round3(sales.reduce((s, r) => s + r.tva, 0));
    const deductible = round3(buys.reduce((s, r) => s + r.deductible, 0));
    const carry = round3(Math.max(0, Number(carryIn) || 0));
    const balance = round3(collected - deductible - carry);
    // Timbres encaissés : ils ne sont pas de la TVA mais se déclarent aussi. À VÉRIFIER.
    const stamps = round3(sales.reduce((s, r) => s + r.timbre, 0));
    // Retenues subies (déductibles de ton impôt) et opérées (à reverser)
    const withheldBySale = round3(sales.reduce((s, r) => s + r.rs, 0));
    const withheldOnBuys = round3(buys.reduce((s, r) => s + r.rs, 0));
    return {
      period, byRate, collected, deductible, carryIn: carry,
      toPay: balance > 0 ? balance : 0,
      carryOut: balance < 0 ? round3(-balance) : 0,     // crédit de TVA reportable sur la période suivante
      stamps, withheldBySale, withheldOnBuys,
      salesCount: sales.length, buysCount: buys.length,
      salesHT: round3(sales.reduce((s, r) => s + r.ht, 0)),
      buysHT: round3(buys.reduce((s, r) => s + r.ht, 0))
    };
  }

  // Enchaînement des déclarations sur plusieurs mois : le crédit d'un mois se reporte sur le suivant.
  // C'est la seule façon d'obtenir un chiffre juste — une déclaration isolée ignore le report.
  function vatChain(data, company, year, upToMonth) {
    const out = [];
    let carry = Number((data.vatCarryIn || {})[year]) || 0;   // crédit venu de l'année précédente, saisi à la main
    const last = Math.min(12, Math.max(1, Number(upToMonth) || 12));
    for (let m = 1; m <= last; m++) {
      const from = `${year}-${pad2(m)}-01`;
      const to = `${year}-${pad2(m)}-${pad2(new Date(Date.UTC(Number(year), m, 0)).getUTCDate())}`;
      const r = vatReturn(data, company, { from, to }, carry);
      r.month = `${year}-${pad2(m)}`;
      r.label = MONTHS_FR[m - 1];
      out.push(r);
      carry = r.carryOut;
    }
    return out;
  }

  // Échéances fiscales récurrentes. Les dates et la périodicité dépendent du régime et de la forme
  // juridique : tout est paramétrable, rien n'est imposé. À VÉRIFIER avec le comptable.
  const DEFAULT_FISCAL_DEADLINES = [
    { id: 'tva', label: 'Déclaration mensuelle d\'employeur et de TVA', every: 'month', day: 28,
      note: 'Déclaration et paiement de la TVA du mois précédent, avec les retenues à la source opérées. Le jour limite dépend de ta forme juridique (personne physique ou morale).', active: true },
    { id: 'acompte', label: 'Acompte provisionnel', every: 'months', months: [6, 9, 12], day: 28,
      note: 'Trois acomptes sur l\'impôt de l\'année, calculés sur l\'impôt de l\'année précédente.', active: true },
    { id: 'tcl', label: 'Taxe sur les établissements (TCL)', every: 'month', day: 28,
      note: 'Généralement déclarée en même temps que la TVA, sur le chiffre d\'affaires local.', active: false },
    { id: 'employeur', label: 'Déclaration annuelle d\'employeur', every: 'year', month: 4, day: 30,
      note: 'Récapitulatif annuel des salaires versés et des retenues opérées.', active: true },
    { id: 'bilan', label: 'Déclaration annuelle de résultat', every: 'year', month: 6, day: 25,
      note: 'Dépôt du bilan et de la déclaration d\'impôt sur les sociétés ou sur le revenu.', active: true },
    { id: 'cnss', label: 'Déclaration CNSS trimestrielle', every: 'months', months: [1, 4, 7, 10], day: 15,
      note: 'Cotisations sociales du trimestre écoulé. Ne concerne que les entreprises avec des salariés.', active: false }
  ];

  function fiscalDeadlines(data) {
    const custom = (data && Array.isArray(data.fiscalDeadlines)) ? data.fiscalDeadlines : [];
    const byId = {};
    // Les échéances sociales ne concernent que les employeurs : elles s'allument d'elles-mêmes dès
    // qu'un salarié existe, et restent éteintes sinon (5.2.0). L'utilisateur peut toujours trancher.
    const hasStaff = !!(data && (data.employees || []).length);
    DEFAULT_FISCAL_DEADLINES.forEach(d => {
      byId[d.id] = { ...d, active: (d.id === 'cnss' && hasStaff) ? true : d.active };
    });
    custom.forEach(d => { if (d && d.id) byId[d.id] = { ...(byId[d.id] || {}), ...d }; });
    return Object.values(byId);
  }

  // Prochaine occurrence d'une échéance, à partir d'aujourd'hui.
  function nextDeadline(rule, todayIso) {
    const t = todayIso || today();
    const y0 = Number(t.slice(0, 4)), m0 = Number(t.slice(5, 7));
    const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
    const make = (y, m) => `${y}-${pad2(m)}-${pad2(Math.min(Number(rule.day) || 28, lastDay(y, m)))}`;
    const candidates = [];
    for (let k = 0; k <= 13; k++) {
      const m = ((m0 - 1 + k) % 12) + 1;
      const y = y0 + Math.floor((m0 - 1 + k) / 12);
      if (rule.every === 'month') candidates.push(make(y, m));
      else if (rule.every === 'months' && (rule.months || []).includes(m)) candidates.push(make(y, m));
      else if (rule.every === 'year' && m === (Number(rule.month) || 1)) candidates.push(make(y, m));
    }
    return candidates.filter(d => d >= t).sort()[0] || '';
  }

  // Les échéances fiscales qui arrivent, pour le panneau « À faire » et la page Comptabilité.
  function upcomingFiscal(data, todayIso, withinDays) {
    const t = todayIso || today();
    const within = Number(withinDays) || 30;
    return fiscalDeadlines(data).filter(r => r.active !== false).map(r => {
      const date = nextDeadline(r, t);
      return date ? { id: r.id, label: r.label, note: r.note || '', date, days: daysBetween(t, date) } : null;
    }).filter(x => x && x.days <= within).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Résultat simple de la période : ce que tu as facturé moins ce que tu as dépensé, hors taxes.
  // Ce n'est PAS le résultat comptable : il manque les amortissements, les stocks, les salaires et
  // les provisions. À VÉRIFIER avec le comptable — c'est un ordre de grandeur, pas un bilan.
  function simpleResult(data, company, period) {
    const sales = salesJournal(data, company, period);
    const buys = purchaseJournal(data, company, period);
    const produits = round3(sales.reduce((s, r) => s + r.ht, 0));
    // Une ligne partie au stock ou en immobilisation n'est pas une charge de la période.
    let charges = 0, stock = 0, immo = 0;
    const cogs = costOfGoodsSold(data, period);
    (data.purchases || []).filter(p => inPeriod(p.date, period && period.from, period && period.to)).forEach(p => {
      const t = purchaseTotals(p, company);
      charges = round3(charges + t.byDestination.charge + t.fees);
      stock = round3(stock + t.byDestination.stock);
      immo = round3(immo + t.byDestination.immobilisation);
    });
    // L'achat d'une immobilisation n'est pas une charge, mais son AMORTISSEMENT en est une : sans lui,
    // le résultat de l'année d'un gros investissement serait artificiellement bon (3.5.0).
    const depreciation = depreciationFor(data, period);
    // La paie n'est pas un achat : elle a sa propre page, mais c'est bien une charge de la période,
    // et la plus lourde de toutes dès qu'il y a un salarié (5.0.0). On compte le COÛT EMPLOYEUR.
    const payroll = payrollCost(data, period);
    const resultat = round3(produits - charges - cogs - depreciation - payroll);
    return {
      produits, charges, stock, immo, cogs, depreciation, payroll, resultat,
      marge: produits > 0 ? Math.round(resultat / produits * 100) : null,
      salesCount: sales.length, buysCount: buys.length
    };
  }

  // ---------- clôture de période (6.0.0) ----------
  // Ce que le comptable a reçu ne doit plus bouger. Sans ça, une pièce saisie en mars après que mars
  // a été déclaré change la TVA de mars en silence, et personne ne le sait avant un contrôle.
  // `data.closedUntil` = dernier jour clôturé ('' si rien). `data.closureLog` garde chaque clôture
  // et chaque réouverture : une réouverture n'est pas interdite, elle est **tracée**.
  const CLOSURE_ACTIONS = { cloture: 'Clôture', reouverture: 'Réouverture' };

  function closedUntil(data) { return (data && typeof data.closedUntil === 'string') ? data.closedUntil : ''; }

  // La question que tout le reste pose : cette date est-elle dans une période close ?
  // Une date vide ne l'est jamais : un brouillon sans date ne se refuse pas, il se date.
  function isClosedDate(data, iso) {
    const c = closedUntil(data);
    return !!(c && iso && String(iso).slice(0, 10) <= c);
  }

  // Le mois clôturé qui contient cette date, pour l'écrire dans le message d'erreur.
  function closedPeriodLabel(data, iso) {
    if (!isClosedDate(data, iso)) return '';
    return monthLabel(String(iso).slice(0, 10));
  }

  // Les mois qu'on peut clôturer aujourd'hui : ceux qui suivent le dernier clôturé et qui sont
  // terminés. On ne propose jamais de clôturer un mois en cours — il lui reste des pièces à recevoir.
  function closableMonths(data, todayIso) {
    const t = todayIso || today();
    const curMonth = t.slice(0, 7);
    const c = closedUntil(data);
    let first;
    if (c) {
      first = addDays(c, 1).slice(0, 7);
    } else {
      // Rien n'a jamais été clôturé : on part du mois de la plus ancienne pièce datée.
      const dates = [
        ...(data.documents || []).map(d => d.date),
        ...(data.purchases || []).map(p => p.date),
        ...(data.movements || []).map(m => m.date)
      ].filter(Boolean).sort();
      if (!dates.length) return [];
      first = dates[0].slice(0, 7);
    }
    const out = [];
    let m = first;
    // 120 mois : dix ans de retard suffisent, et la boucle ne peut pas s'emballer.
    while (m < curMonth && out.length < 120) {
      const [y, mm] = m.split('-').map(Number);
      out.push({ month: m, label: monthLabel(m + '-01'), from: `${m}-01`, to: `${m}-${pad2(daysInMonth(y, mm))}` });
      m = addMonths(m + '-01', 1, 1).slice(0, 7);
    }
    return out;
  }

  // Ce qu'il vaut mieux régler AVANT de clôturer. On n'interdit rien : on montre, et l'utilisateur
  // décide. Un cabinet préfère un mois clôturé avec deux justificatifs manquants signalés qu'un mois
  // jamais clôturé parce que l'app faisait la difficile.
  function closureChecks(data, company, from, to) {
    const out = [];
    const inRange = d => d && d >= from && d <= to;
    const add = (id, level, label, detail, count) => { if (count) out.push({ id, level, label, detail, count }); };

    const drafts = (data.documents || []).filter(d => d.type === 'facture' && d.status === 'brouillon' && inRange(d.date));
    add('brouillons', 'danger', `${drafts.length} facture(s) en brouillon dans la période`,
      'Un brouillon n\'a pas de numéro et n\'entre dans aucun journal. Émets-le ou change sa date avant de clôturer, sinon il restera invisible pour ton comptable.', drafts.length);

    const noProof = (data.purchases || []).filter(p => inRange(p.date) && !(p.attachments || []).length);
    add('justificatifs', 'warn', `${noProof.length} achat(s) sans justificatif`,
      'Sans la pièce jointe, ton comptable ne peut pas récupérer la TVA de ces achats.', noProof.length);

    const unticked = cashMovements(data, company).filter(m => inRange(m.date) && !m.reconciled);
    add('pointage', 'warn', `${unticked.length} mouvement(s) non pointé(s)`,
      'Pointer les mouvements contre le relevé bancaire, c\'est ce qui prouve que la trésorerie est juste.', unticked.length);

    // Bulletins manquants : un salarié actif sans bulletin sur un mois travaillé
    const months = [];
    let m = from.slice(0, 7);
    while (m <= to.slice(0, 7) && months.length < 24) { months.push(m); m = addMonths(m + '-01', 1, 1).slice(0, 7); }
    const slipsMissing = months.reduce((s, mm) =>
      s + missingPayslips(data, Number(mm.slice(0, 4)), Number(mm.slice(5, 7))).length, 0);
    add('bulletins', 'danger', `${slipsMissing} bulletin(s) de paie à établir`,
      'Un salarié payé sans bulletin, c\'est une charge qui manque au résultat et une déclaration sociale fausse.', slipsMissing);

    const negative = stockList(data).filter(s => s.qty < 0);
    add('stock', 'warn', `${negative.length} article(s) en stock négatif`,
      'Un stock négatif est une pièce d\'achat manquante, pas une erreur de comptage.', negative.length);

    const gaps = serialGaps(data);
    add('series', 'warn', `${gaps.length} écart(s) entre quantités et numéros de série`,
      'Les deux comptes devraient dire la même chose.', gaps.length);

    return out;
  }

  // Clôturer. Renvoie { ok } ou { error } — on ne clôture pas dans le futur, ni en arrière (ça, c'est
  // rouvrir, et ça porte un autre nom pour que ce soit un geste conscient).
  function closePeriod(data, iso, opts) {
    opts = opts || {};
    const t = opts.todayIso || today();
    const day = String(iso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Date de clôture invalide.' };
    if (day > t) return { error: 'On ne clôture pas une période qui n\'est pas terminée.' };
    const c = closedUntil(data);
    if (c && day <= c) return { error: `Déjà clôturé jusqu'au ${fmtDate(c)}. Pour revenir en arrière, il faut rouvrir.` };
    data.closedUntil = day;
    if (!Array.isArray(data.closureLog)) data.closureLog = [];
    data.closureLog.push({ id: uid(), action: 'cloture', until: day, previous: c || '', at: opts.at || null, by: opts.by || '', reason: opts.reason || '' });
    return { ok: true, until: day };
  }

  // Rouvrir jusqu'à une date antérieure (ou tout rouvrir avec ''). Toujours tracé, toujours motivé :
  // c'est cette ligne que le comptable lira le jour où un chiffre a bougé après son envoi.
  function reopenPeriod(data, iso, opts) {
    opts = opts || {};
    const c = closedUntil(data);
    if (!c) return { error: 'Aucune période n\'est clôturée.' };
    const day = iso ? String(iso).slice(0, 10) : '';
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Date de réouverture invalide.' };
    if (day && day >= c) return { error: 'La réouverture doit porter sur une date antérieure à la clôture actuelle.' };
    if (!opts.reason) return { error: 'Une réouverture demande un motif : c\'est lui qui explique au comptable pourquoi un chiffre a changé.' };
    data.closedUntil = day;
    if (!Array.isArray(data.closureLog)) data.closureLog = [];
    data.closureLog.push({ id: uid(), action: 'reouverture', until: day, previous: c, at: opts.at || null, by: opts.by || '', reason: opts.reason });
    return { ok: true, until: day };
  }

  function closureLog(data) {
    return (Array.isArray(data.closureLog) ? data.closureLog : []).slice().reverse();
  }


  // ---------- le paquet mensuel pour le cabinet (6.1.0) ----------
  // Un fichier unique, complet, vérifiable, que le comptable ouvre sans rien installer. Tout ce qui
  // décide de son CONTENU vit ici : c'est pur, donc testable sans Electron. L'écriture du fichier
  // (zip, chiffrement, PDF) est dans main.js, parce qu'elle a besoin du disque.
  const PACK_FORMAT = 1;

  // Les colonnes des journaux, définies une seule fois : le CSV exporté à la main et celui du paquet
  // doivent dire exactement la même chose, sinon deux exports du même mois ne se ressemblent pas.
  function salesCsvColumns() {
    return [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'Numéro' }, { key: 'typeLabel', label: 'Type' },
      { key: 'client', label: 'Client' }, { key: 'subject', label: 'Objet' }, { key: 'ht', label: 'Total HT', type: 'money' },
      ...VAT_RATES.map(r => ({ label: `Base ${r}%`, type: 'money', get: x => x.vatByRate[r].base })),
      ...VAT_RATES.map(r => ({ label: `TVA ${r}%`, type: 'money', get: x => x.vatByRate[r].vat })),
      { key: 'tva', label: 'Total TVA', type: 'money' }, { key: 'timbre', label: 'Timbre', type: 'money' }, { key: 'ttc', label: 'TTC', type: 'money' },
      { key: 'rs', label: 'Retenue source', type: 'money' }, { key: 'net', label: 'Net à payer', type: 'money' },
      { key: 'statusLabel', label: 'Statut' }, { key: 'paid', label: 'Payé', type: 'money' }, { key: 'remaining', label: 'Reste', type: 'money' }
    ];
  }
  function buyCsvColumns() {
    return [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'N° fournisseur' }, { key: 'supplier', label: 'Fournisseur' },
      { key: 'kind', label: 'Nature' }, { key: 'category', label: 'Catégorie' }, { key: 'subject', label: 'Objet' },
      { key: 'ht', label: 'HT', type: 'money' }, { key: 'tva', label: 'TVA', type: 'money' }, { key: 'deductible', label: 'TVA déductible', type: 'money' },
      { key: 'fees', label: 'Timbre et frais', type: 'money' }, { key: 'ttc', label: 'TTC', type: 'money' },
      { key: 'rs', label: 'Retenue opérée', type: 'money' }, { key: 'net', label: 'Net à payer', type: 'money' }, { key: 'status', label: 'Statut' }
    ];
  }
  function payCsvColumns() {
    return [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'Facture' }, { key: 'client', label: 'Client' },
      { key: 'amount', label: 'Montant', type: 'money' }, { key: 'method', label: 'Mode' }, { key: 'reference', label: 'Référence' }, { key: 'note', label: 'Note' }
    ];
  }
  function supplierPayCsvColumns() {
    return [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'Pièce fournisseur' }, { key: 'supplier', label: 'Fournisseur' },
      { key: 'amount', label: 'Montant', type: 'money' }, { key: 'method', label: 'Mode' }, { key: 'reference', label: 'Référence' }, { key: 'note', label: 'Note' }
    ];
  }
  function cashCsvColumns() {
    return [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'label', label: 'Libellé' }, { key: 'kindLabel', label: 'Nature' },
      { key: 'accountName', label: 'Compte' }, { key: 'inAmount', label: 'Entrée', type: 'money' }, { key: 'outAmount', label: 'Sortie', type: 'money' },
      { key: 'reference', label: 'Référence' }, { key: 'reconciled', label: 'Pointé' }
    ];
  }

  // Nom de fichier : lisible d'un coup d'œil dans une boîte mail encombrée, et triable.
  function packFileName(company, period, definitive) {
    const slug = String(company.name || 'entreprise').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'entreprise';
    return `${slug}-${period.month}${definitive ? '' : '-provisoire'}.skanpack`;
  }

  // Le mois, borné aux vrais jours du calendrier.
  function packPeriod(year, month) {
    const y = Number(year), m = Number(month);
    const mm = String(m).padStart(2, '0');
    return { month: `${y}-${mm}`, from: `${y}-${mm}-01`, to: `${y}-${mm}-${pad2(daysInMonth(y, m))}`, label: monthLabel(`${y}-${mm}-01`) };
  }

  // Ce qui manque dans ce mois, du point de vue du comptable. On reprend les contrôles de clôture —
  // ce sont les mêmes questions — et on ajoute ce qui ne se voit qu'à l'envoi.
  function packChecklist(data, company, period) {
    const out = closureChecks(data, company, period.from, period.to).slice();
    const inRange = d => d && d >= period.from && d <= period.to;
    // Une facture émise dont la retenue à la source n'a pas d'attestation : le fournisseur (nous) doit
    // la fournir, et sans elle le client ne peut pas déduire ce qu'il a retenu.
    const certs = (data.documents || []).filter(d => d.type === 'facture' && inRange(d.date)
      && d.status !== 'brouillon' && d.status !== 'annulée'
      && computeTotals(d, company).withholding > 0 && !d.withholdingCertificate);
    if (certs.length) out.push({
      id: 'attestations', level: 'warn', count: certs.length,
      label: `${certs.length} attestation(s) de retenue à la source non remise(s)`,
      detail: 'Sans elle, ton client ne peut pas justifier ce qu\'il t\'a retenu.'
    });
    return out;
  }

  // Le plan du paquet : la liste exacte de ce qu'il contiendra, chaque entrée sachant d'où vient son
  // contenu. main.js n'a plus qu'à exécuter ce plan. Le séparer ainsi permet de le tester entièrement
  // sans Electron, et de montrer à l'utilisateur ce qui va partir AVANT de le fabriquer.
  function packPlan(data, company, period, opts) {
    opts = opts || {};
    const entries = [];
    const inRange = d => d && d >= period.from && d <= period.to;
    const add = e => { entries.push(e); return e; };

    // 1. Les journaux, en CSV — ce que le comptable saisit dans son logiciel.
    const sales = salesJournal(data, company, period);
    const buys = purchaseJournal(data, company, period);
    const pays = paymentsJournal(data, company, period);
    const supPays = supplierPayments(data, company, period);
    const cash = cashMovements(data, company, period);
    add({ path: 'journaux/ventes.csv', kind: 'text', label: 'Journal des ventes', text: toCsv(sales, salesCsvColumns()), rows: sales.length });
    add({ path: 'journaux/achats.csv', kind: 'text', label: 'Journal des achats', text: toCsv(buys, buyCsvColumns()), rows: buys.length });
    add({ path: 'journaux/encaissements.csv', kind: 'text', label: 'Encaissements clients', text: toCsv(pays, payCsvColumns()), rows: pays.length });
    add({ path: 'journaux/reglements-fournisseurs.csv', kind: 'text', label: 'Règlements fournisseurs', text: toCsv(supPays, supplierPayCsvColumns()), rows: supPays.length });
    add({ path: 'journaux/tresorerie.csv', kind: 'text', label: 'Mouvements de trésorerie', text: toCsv(cash, cashCsvColumns()), rows: cash.length });

    // 1 bis. Les écritures en partie double. C'est le fichier qui fait gagner des heures au cabinet :
    // il l'importe au lieu de retaper les pièces une à une. Les numéros de compte sont ceux réglés
    // par l'entreprise — À VÉRIFIER, et c'est écrit dans le fichier comme sur la page de garde.
    const ecritures = journalEntries(data, company, period, {});
    const balance = entriesBalance(ecritures);
    add({ path: 'journaux/ecritures.csv', kind: 'text', label: 'Écritures comptables (partie double)', text: toCsv(ecritures, entryCsvColumns()), rows: ecritures.length });

    // 2. La TVA du mois, avec son report : un mois isolé sans le crédit reporté donne un chiffre faux.
    const vat = vatReturn(data, company, period, (data.vatCarryIn || {})[period.month.slice(0, 4)] || 0);
    add({ path: 'journaux/tva.json', kind: 'text', label: 'TVA du mois', text: JSON.stringify(vat, null, 2) });

    // 3. Le PDF de chaque pièce émise. C'est le justificatif, pas le tableau.
    const issued = (data.documents || []).filter(d => (d.type === 'facture' || d.type === 'avoir')
      && inRange(d.date) && d.status !== 'brouillon');
    issued.forEach(d => add({
      path: `ventes/${(d.number || d.id).replace(/[^\w.-]+/g, '_')}.pdf`,
      kind: 'pdf', label: `${TITLES[d.type] || 'Pièce'} ${d.number || ''}`, docId: d.id, docType: d.type
    }));

    // 4. Les justificatifs d'achat. Sans eux, la TVA déductible n'est pas récupérable.
    (data.purchases || []).filter(p => inRange(p.date)).forEach(p => {
      (p.attachments || []).forEach(a => add({
        path: `achats/${(p.number || p.id).replace(/[^\w.-]+/g, '_')}/${String(a.name || a.file).replace(/[^\w.\- ]+/g, '_')}`,
        kind: 'attachment', label: `Justificatif ${p.number || ''}`, ownerId: p.id, file: a.file
      }));
    });

    // 5. Les bulletins du mois.
    const slips = (data.payslips || []).filter(s => `${s.year}-${String(s.month).padStart(2, '0')}` === period.month);
    slips.forEach(s => {
      const emp = (data.employees || []).find(e => e.id === s.employeeId) || {};
      add({ path: `paie/${String(emp.name || s.employeeId).replace(/[^\w.-]+/g, '_')}.pdf`, kind: 'payslip', label: `Bulletin ${emp.name || ''}`, slipId: s.id });
    });

    // 6. La déclaration CNSS, seulement si le trimestre se termine ce mois-ci.
    const m = Number(period.month.slice(5, 7));
    if (m % 3 === 0 && (data.employees || []).length) {
      const q = m / 3;
      const dec = cnssDeclaration(data, Number(period.month.slice(0, 4)), q);
      if (dec && dec.rows && dec.rows.length) {
        add({ path: `social/cnss-T${q}.json`, kind: 'text', label: `Déclaration CNSS T${q}`, text: JSON.stringify(dec, null, 2) });
      }
    }

    const checklist = packChecklist(data, company, period);
    const definitive = isClosedDate(data, period.to);
    const manifest = {
      format: PACK_FORMAT,
      app: 'SkanFact',
      entreprise: { nom: company.name || '', matricule: company.matricule || '', devise: company.currency || 'TND' },
      periode: { mois: period.month, du: period.from, au: period.to, libelle: period.label },
      definitif: definitive,
      cloturéJusquAu: closedUntil(data) || null,
      genereLe: opts.at || null,
      poste: opts.device || '',
      manques: checklist.map(c => ({ id: c.id, niveau: c.level, quoi: c.label, combien: c.count })),
      fichiers: []          // rempli par main.js une fois chaque fichier produit, avec son empreinte
    };

    const vs = vatSummary(sales);
    const bs = purchaseSummary(buys);

    // Les chiffres du mois DANS le manifeste : le cabinet peut alors afficher le chiffre d'affaires
    // et la TVA de chaque dossier sans ouvrir un seul CSV. Champ ajouté après coup, donc toujours
    // facultatif à la lecture — un paquet d'une version antérieure n'en a pas.
    manifest.chiffres = {
      ca: vs.ht, tvaCollectee: vs.tva, tvaDeductible: (bs && bs.deductible) || 0,
      tvaADecaisser: vat.toPay, creditTva: vat.carryOut,
      encaisse: round3(pays.reduce((s2, r) => s2 + (Number(r.amount) || 0), 0)),
      devise: company.currency || 'TND'
    };
    manifest.compte = {
      ventes: sales.length, achats: buys.length, encaissements: pays.length,
      pieces: issued.length, justificatifs: entries.filter(e => e.kind === 'attachment').length,
      bulletins: slips.length
    };
    return {
      manifest, entries, checklist, definitive, period, balance,
      ca: vs.ht, tvaCollectee: vs.tva, tvaDeductible: (bs && bs.deductible) || 0,
      encaisse: round3(pays.reduce((s2, r) => s2 + (Number(r.amount) || 0), 0)),
      totaux: {
        ventes: sales.length, achats: buys.length, encaissements: pays.length,
        pieces: issued.length, justificatifs: entries.filter(e => e.kind === 'attachment').length,
        bulletins: slips.length
      }
    };
  }

  // La page de garde du paquet : la première chose que le comptable ouvre. Elle répond à trois
  // questions dans cet ordre — de qui, pour quel mois, et **qu'est-ce qui manque**. Un dossier dont
  // on connaît les trous vaut mieux qu'un dossier qu'on croit complet.
  function packCoverHtml(plan, company, opts) {
    opts = opts || {};
    const cur = company.currency || 'TND';
    const m = n => money(n, cur);
    const accent = company.accentColor || '#0f9d8f';
    const p = plan.period;
    const t = plan.totaux;
    const rows = (plan.checklist || []);
    const esc = escapeHtml;
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 16mm 14mm; }
      * { box-sizing: border-box; }
      body { font: 11pt/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; color: #1b2430; margin: 0; }
      h1 { font-size: 20pt; margin: 0 0 2mm; }
      h2 { font-size: 12pt; margin: 8mm 0 2mm; padding-bottom: 1.5mm; border-bottom: 1.5pt solid ${esc(accent)}; }
      .sub { color: #5c6875; margin: 0 0 6mm; }
      .tag { display: inline-block; padding: 1mm 3mm; border-radius: 3mm; font-size: 9pt; font-weight: 600; }
      .def { background: ${esc(accent)}22; color: ${esc(accent)}; }
      .prov { background: #fbf1e0; color: #a15c00; }
      table { width: 100%; border-collapse: collapse; font-size: 10pt; }
      td, th { text-align: left; padding: 1.6mm 2mm; border-bottom: 0.4pt solid #e3e8ee; vertical-align: top; }
      th { color: #5c6875; font-weight: 600; font-size: 9pt; text-transform: uppercase; letter-spacing: .04em; }
      .r { text-align: right; font-variant-numeric: tabular-nums; }
      .grid { display: flex; gap: 4mm; flex-wrap: wrap; }
      .card { flex: 1 1 34mm; border: 0.5pt solid #e3e8ee; border-radius: 2mm; padding: 3mm; }
      .card .k { font-size: 8.5pt; color: #5c6875; }
      .card .v { font-size: 15pt; font-weight: 600; }
      .warn td { background: #fdf6ec; }
      .danger td { background: #fdeeec; }
      .none { color: ${esc(accent)}; font-weight: 600; }
      .foot { margin-top: 10mm; font-size: 8.5pt; color: #5c6875; border-top: 0.4pt solid #e3e8ee; padding-top: 2.5mm; }
    </style></head><body>
      <h1>${esc(company.name || 'Entreprise')} — ${esc(p.label)}</h1>
      <p class="sub">${company.matricule ? 'Matricule fiscal ' + esc(company.matricule) + ' · ' : ''}du ${fmtDate(p.from)} au ${fmtDate(p.to)}
        &nbsp; <span class="tag ${plan.definitive ? 'def' : 'prov'}">${plan.definitive ? 'DÉFINITIF — mois clôturé' : 'PROVISOIRE — mois non clôturé'}</span></p>

      ${plan.definitive ? '' : '<p style="background:#fbf1e0;padding:3mm;border-radius:2mm;font-size:9.5pt;margin:0 0 5mm"><b>Ce dossier peut encore changer.</b> Le mois n\'a pas été clôturé dans SkanFact : des pièces peuvent encore y être ajoutées ou modifiées. Un envoi définitif suivra une fois le mois clôturé.</p>'}

      <h2>Le mois en chiffres</h2>
      <div class="grid">
        <div class="card"><div class="k">Chiffre d'affaires HT</div><div class="v">${m(plan.ca || 0)}</div></div>
        <div class="card"><div class="k">TVA collectée</div><div class="v">${m(plan.tvaCollectee || 0)}</div></div>
        <div class="card"><div class="k">TVA déductible</div><div class="v">${m(plan.tvaDeductible || 0)}</div></div>
        <div class="card"><div class="k">Encaissé</div><div class="v">${m(plan.encaisse || 0)}</div></div>
      </div>

      <h2>Ce que contient ce paquet</h2>
      <table><tbody>
        <tr><td>Pièces de vente émises (PDF joints)</td><td class="r">${t.pieces}</td></tr>
        <tr><td>Lignes au journal des ventes</td><td class="r">${t.ventes}</td></tr>
        <tr><td>Lignes au journal des achats</td><td class="r">${t.achats}</td></tr>
        <tr><td>Justificatifs d'achat joints</td><td class="r">${t.justificatifs}</td></tr>
        <tr><td>Encaissements clients</td><td class="r">${t.encaissements}</td></tr>
        <tr><td>Bulletins de paie</td><td class="r">${t.bulletins}</td></tr>
      </tbody></table>

      <h2>Écritures comptables</h2>
      <p>Le fichier <b>journaux/ecritures.csv</b> contient ${plan.balance ? plan.balance.lines : 0} lignes d'écritures en partie double
      (${plan.balance ? plan.balance.pieces : 0} pièces), ${plan.balance && plan.balance.balanced ? 'équilibrées&nbsp;: débit = crédit = ' + esc(m(plan.balance.debit)) : '<b>déséquilibrées — à vérifier avant import</b>'}.
      Les numéros de compte sont ceux réglés dans SkanFact par l'entreprise&nbsp;: <i>à adapter au plan du cabinet si besoin</i>.</p>

      <h2>Ce qui manque</h2>
      ${rows.length
        ? `<table><thead><tr><th>Point</th><th class="r">Nombre</th></tr></thead><tbody>
            ${rows.map(c => `<tr class="${esc(c.level)}"><td><b>${esc(c.label)}</b><div style="color:#5c6875;font-size:9pt">${esc(c.detail)}</div></td><td class="r">${c.count}</td></tr>`).join('')}
          </tbody></table>`
        : '<p class="none">Rien à signaler : le dossier est complet.</p>'}

      <div class="foot">
        Paquet produit par SkanFact${opts.version ? ' ' + esc(opts.version) : ''}${opts.at ? ' le ' + esc(opts.at) : ''}${plan.manifest.poste ? ' depuis « ' + esc(plan.manifest.poste) + ' »' : ''}.
        Le fichier <b>manifeste.json</b> liste chaque fichier du paquet avec son empreinte : elles permettent de vérifier que rien n'a été modifié depuis l'envoi.
        <br>Les montants sont ceux enregistrés dans SkanFact. <i>À VÉRIFIER par le comptable</i> avant toute déclaration.
      </div>
    </body></html>`;
  }

  // ---------- écritures comptables (Cabinet 1.1.0) ----------
  //
  // Ce que le comptable fait aujourd'hui : il retape les pièces de son client dans son logiciel.
  // Ce module produit directement les écritures en partie double, prêtes à importer. C'est le seul
  // gain de temps qui se mesure en heures, pas en minutes — et c'est l'argument qui fait installer
  // SkanFact Cabinet.
  //
  // AUCUN numéro de compte n'est certain : le plan comptable tunisien a ses usages, et chaque cabinet
  // les siens. Tous les comptes sont donc **modifiables** (`data.chartAccounts`) et l'écran comme
  // l'export portent un « À VÉRIFIER » visible. Ce qui est garanti ici, c'est l'équilibre :
  // débit = crédit sur chaque pièce, toujours.
  const DEFAULT_ACCOUNTS = {
    clients: '411',              // Clients
    fournisseurs: '401',         // Fournisseurs d'exploitation
    ventes: '706',               // Prestations de services (707 pour les ventes de marchandises)
    tvaCollectee: '4367',        // TVA collectée
    tvaDeductible: '4366',       // TVA déductible
    timbre: '4368',              // Timbre fiscal encaissé pour le compte de l'État
    rsSubie: '4358',             // Retenue à la source subie par l'entreprise (créance sur l'État)
    rsOperee: '4352',            // Retenue à la source opérée sur un fournisseur (dette envers l'État)
    achatsStock: '607',          // Achats de marchandises destinées à la revente
    charges: '606',              // Achats consommés (fournitures, services)
    immobilisations: '24',       // Immobilisations — le compte exact dépend du bien
    fraisAccessoires: '608',     // Frais accessoires d'achat (transport, douane)
    banque: '532',               // Banques
    caisse: '54',                // Caisse
    salairesBruts: '640',        // Rémunérations du personnel
    chargesPatronales: '645',    // Charges sociales patronales
    personnel: '425',            // Personnel — rémunérations dues
    cnss: '4531',                // CNSS (part salariale + part patronale)
    irpp: '4321'                 // IRPP et contribution sociale retenus à la source
  };
  const ACCOUNT_LABELS = {
    clients: 'Clients', fournisseurs: 'Fournisseurs', ventes: 'Ventes',
    tvaCollectee: 'TVA collectée', tvaDeductible: 'TVA déductible', timbre: 'Timbre fiscal',
    rsSubie: 'Retenue à la source subie', rsOperee: 'Retenue à la source opérée',
    achatsStock: 'Achats de marchandises', charges: 'Charges', immobilisations: 'Immobilisations',
    fraisAccessoires: 'Frais accessoires d\'achat', banque: 'Banque', caisse: 'Caisse',
    salairesBruts: 'Salaires bruts', chargesPatronales: 'Charges patronales',
    personnel: 'Personnel — net à payer', cnss: 'CNSS', irpp: 'IRPP retenu'
  };
  // Les journaux : le comptable range ses écritures par nature d'opération.
  const ENTRY_JOURNALS = [
    ['VT', 'Ventes'], ['AC', 'Achats'], ['BQ', 'Banque'], ['CA', 'Caisse'], ['PAIE', 'Paie'], ['OD', 'Opérations diverses']
  ];

  function chartAccounts(data) {
    return { ...DEFAULT_ACCOUNTS, ...((data && data.chartAccounts) || {}) };
  }

  // Le compte de trésorerie d'un règlement : espèces → caisse, tout le reste → banque.
  const cashAccountFor = (method, acc) => (method === 'espèces' || method === 'especes' || method === 'Espèces') ? acc.caisse : acc.banque;

  // Une pièce = un ensemble d'écritures qui s'équilibrent. On la construit avec ce petit aide :
  // il arrondit, ignore les montants nuls, et refuse de rendre un déséquilibre sans le signaler.
  function entrySet(base) {
    const lines = [];
    const push = (account, label, debit, credit, extra) => {
      let d = round3(debit || 0), c = round3(credit || 0);
      // Un avoir produit des montants négatifs. Aucun logiciel comptable n'accepte un débit négatif :
      // un montant négatif change de colonne, il ne garde pas son signe. C'est ce qui fait qu'un
      // avoir s'écrit D ventes / D TVA / C client, exactement à l'envers d'une facture.
      if (d < 0) { c = round3(c - d); d = 0; }
      if (c < 0) { d = round3(d - c); c = 0; }
      if (!d && !c) return;
      lines.push({ ...base, account: String(account || ''), label: label || base.label || '', debit: d, credit: c, ...(extra || {}) });
    };
    return {
      debit: (a, l, n, e) => push(a, l, n, 0, e),
      credit: (a, l, n, e) => push(a, l, 0, n, e),
      done() {
        const d = round3(lines.reduce((s, x) => s + x.debit, 0));
        const c = round3(lines.reduce((s, x) => s + x.credit, 0));
        // Un écart de quelques millimes vient des arrondis de TVA ligne par ligne. On l'absorbe sur
        // la dernière ligne plutôt que de livrer une pièce qui ne passera pas à l'import.
        const gap = round3(d - c);
        if (gap && lines.length) {
          const last = lines[lines.length - 1];
          if (gap > 0) last.credit = round3(last.credit + gap); else last.debit = round3(last.debit - gap);
          if (last.credit < 0) { last.debit = round3(last.debit - last.credit); last.credit = 0; }
          if (last.debit < 0) { last.credit = round3(last.credit - last.debit); last.debit = 0; }
        }
        return lines;
      }
    };
  }

  // Les écritures d'une période. `opts.auxiliaires` ajoute le nom du tiers en compte auxiliaire ;
  // `opts.sections` permet de n'exporter qu'une partie (ventes, achats, encaissements, paie).
  function journalEntries(data, company, period, opts) {
    opts = opts || {};
    const acc = chartAccounts(data);
    const want = s => !opts.sections || opts.sections.indexOf(s) >= 0;
    const out = [];
    const cur = (company && company.currency) || 'DT';

    // --- ventes : factures et avoirs émis
    if (want('ventes')) {
      salesJournal(data, company, period).forEach(r => {
        if (r.status === 'annulée') return;             // une facture annulée n'a jamais existé comptablement
        const e = entrySet({ date: r.date, journal: 'VT', piece: r.number, tiers: r.client, source: 'vente', docId: r.id, currency: cur });
        const label = `${r.typeLabel} ${r.number}${r.client ? ' — ' + r.client : ''}`;
        // Ce que le client devra réellement payer (le net après retenue) reste au compte client ;
        // la retenue devient une créance sur l'État. À VÉRIFIER : certains cabinets la constatent
        // seulement au paiement.
        e.debit(acc.clients, label, r.net);
        if (r.rs) e.debit(acc.rsSubie, `Retenue à la source ${r.number}`, r.rs);
        VAT_RATES.forEach(rate => {
          const v = r.vatByRate[rate];
          if (v && v.base) e.credit(acc.ventes, `${label} (HT ${rate} %)`, v.base, { vatRate: rate });
          if (v && v.vat) e.credit(acc.tvaCollectee, `TVA ${rate} % — ${r.number}`, v.vat, { vatRate: rate });
        });
        if (r.timbre) e.credit(acc.timbre, `Timbre fiscal ${r.number}`, r.timbre);
        out.push(...e.done());
      });
    }

    // --- achats : factures fournisseurs et dépenses
    if (want('achats')) {
      (data.purchases || [])
        .filter(p => inPeriod(p.date, period && period.from, period && period.to))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .forEach(p => {
          const t = purchaseTotals(p, company);
          const sup = ((data.suppliers || []).find(s => s.id === p.supplierId) || {}).name || '';
          const num = p.number || '(sans numéro)';
          const e = entrySet({ date: p.date, journal: 'AC', piece: num, tiers: sup, source: 'achat', docId: p.id, currency: cur });
          const label = `${p.kind === 'depense' ? 'Dépense' : 'Achat'} ${num}${sup ? ' — ' + sup : ''}`;
          const dest = { charge: acc.charges, stock: acc.achatsStock, immobilisation: acc.immobilisations };
          Object.keys(t.byDestination).forEach(k => {
            if (t.byDestination[k]) e.debit(dest[k] || acc.charges, `${label} (${k})`, t.byDestination[k], { destination: k });
          });
          if (t.fees) e.debit(acc.fraisAccessoires, `Frais accessoires ${num}`, t.fees);
          if (t.deductibleVAT) e.debit(acc.tvaDeductible, `TVA déductible ${num}`, t.deductibleVAT);
          // TVA non déductible : elle n'est pas récupérable, elle grossit la charge.
          const nonDeductible = round3(t.totalVAT - t.deductibleVAT);
          if (nonDeductible) e.debit(acc.charges, `TVA non déductible ${num}`, nonDeductible);
          if (t.withholding) e.credit(acc.rsOperee, `Retenue à la source opérée ${num}`, t.withholding);
          e.credit(acc.fournisseurs, label, t.netToPay);
          out.push(...e.done());
        });
    }

    // --- encaissements clients
    if (want('encaissements')) {
      paymentsJournal(data, company, period).forEach(r => {
        const e = entrySet({ date: r.date, journal: r.method === 'Espèces' ? 'CA' : 'BQ', piece: r.number || '', tiers: r.client, source: 'encaissement', docId: r.docId, currency: cur });
        const label = `Règlement ${r.number || ''}${r.client ? ' — ' + r.client : ''}${r.reference ? ' (' + r.reference + ')' : ''}`;
        e.debit(r.method === 'Espèces' ? acc.caisse : acc.banque, label, r.amount);
        e.credit(acc.clients, label, r.amount);
        out.push(...e.done());
      });
    }

    // --- règlements fournisseurs
    if (want('reglements')) {
      supplierPayments(data, company, period).forEach(r => {
        const e = entrySet({ date: r.date, journal: r.method === 'Espèces' ? 'CA' : 'BQ', piece: r.number || '', tiers: r.supplier, source: 'règlement', docId: r.purchaseId, currency: cur });
        const label = `Règlement fournisseur ${r.number || ''}${r.supplier ? ' — ' + r.supplier : ''}`;
        e.debit(acc.fournisseurs, label, r.amount);
        e.credit(r.method === 'Espèces' ? acc.caisse : acc.banque, label, r.amount);
        out.push(...e.done());
      });
    }

    // --- paie : un bulletin = une écriture, avec la copie du calcul remise au salarié
    if (want('paie')) {
      (data.payslips || [])
        .filter(s => inPeriod(payslipDate(s), period && period.from, period && period.to))
        .forEach(s => {
          const emp = (data.employees || []).find(x => x.id === s.employeeId) || {};
          const c = s.computed || computePayslip(emp, s, payrollSettings(data));
          const d = payslipDate(s);
          const e = entrySet({ date: d, journal: 'PAIE', piece: `PAIE-${s.year}-${String(s.month).padStart(2, '0')}`, tiers: emp.name || '', source: 'bulletin', docId: s.id, currency: cur });
          const label = `Salaire ${emp.name || ''} ${MONTHS_FR[Number(s.month) - 1] || ''} ${s.year}`;
          e.debit(acc.salairesBruts, label, c.gross);
          e.debit(acc.chargesPatronales, `Charges patronales — ${emp.name || ''}`, round3(c.cnssEmployer + c.accident));
          e.credit(acc.cnss, `CNSS — ${emp.name || ''}`, round3(c.cnssEmployee + c.cnssEmployer + c.accident));
          e.credit(acc.irpp, `IRPP et contribution sociale — ${emp.name || ''}`, round3(c.irpp + c.css));
          // Les retenues diverses (remboursement d'avance) restent dues à l'entreprise : elles
          // diminuent le net versé. À VÉRIFIER : compte d'avance au personnel si le cabinet en tient un.
          e.credit(acc.personnel, label, round3(c.net + c.otherDeductions));
          out.push(...e.done());
        });
    }

    return out.sort((a, b) => (a.date || '').localeCompare(b.date || '')
      || (a.journal || '').localeCompare(b.journal || '')
      || (a.piece || '').localeCompare(b.piece || '', undefined, { numeric: true }));
  }

  // Le contrôle qu'un comptable fait en premier : est-ce que ça tombe juste ? Pièce par pièce, et
  // en tout. Une pièce déséquilibrée serait refusée à l'import de son logiciel.
  function entriesBalance(entries) {
    const byPiece = {};
    entries.forEach(e => {
      const k = `${e.journal}|${e.piece}|${e.date}`;
      byPiece[k] = byPiece[k] || { key: k, journal: e.journal, piece: e.piece, date: e.date, debit: 0, credit: 0 };
      byPiece[k].debit = round3(byPiece[k].debit + e.debit);
      byPiece[k].credit = round3(byPiece[k].credit + e.credit);
    });
    const pieces = Object.keys(byPiece).map(k => byPiece[k]);
    const off = pieces.filter(p => round3(p.debit - p.credit) !== 0);
    const debit = round3(entries.reduce((s, e) => s + e.debit, 0));
    const credit = round3(entries.reduce((s, e) => s + e.credit, 0));
    return { debit, credit, balanced: round3(debit - credit) === 0 && !off.length, pieces: pieces.length, off, lines: entries.length };
  }

  // La balance par compte : ce que le comptable regarde pour voir si un compte a été oublié.
  function entriesByAccount(entries) {
    const by = {};
    entries.forEach(e => {
      by[e.account] = by[e.account] || { account: e.account, debit: 0, credit: 0, lines: 0 };
      by[e.account].debit = round3(by[e.account].debit + e.debit);
      by[e.account].credit = round3(by[e.account].credit + e.credit);
      by[e.account].lines++;
    });
    return Object.keys(by).sort().map(k => ({ ...by[k], solde: round3(by[k].debit - by[k].credit) }));
  }

  const entryCsvColumns = () => ([
    { key: 'date', label: 'Date', type: 'date' }, { key: 'journal', label: 'Journal' },
    { key: 'piece', label: 'Pièce' }, { key: 'account', label: 'Compte' }, { key: 'tiers', label: 'Tiers' },
    { key: 'label', label: 'Libellé' },
    { key: 'debit', label: 'Débit', type: 'money' }, { key: 'credit', label: 'Crédit', type: 'money' },
    { key: 'currency', label: 'Devise' }
  ]);

  // ---------- conversions entre documents (2.6.0) ----------
  // Ce qu'une pièce peut devenir. Le résultat est toujours un brouillon : rien n'est émis sans relecture.
  // Le chemin complet d'une vente de marchandise : devis → bon de commande → bon de livraison → facture.
  const CONVERSIONS = {
    devis: ['proforma', 'commande', 'livraison', 'contrat'],
    proforma: ['facture', 'livraison'],
    commande: ['livraison', 'proforma', 'facture'],
    livraison: ['facture'],
    facture: ['livraison'],
    contrat: [],
    avoir: []
  };
  const CONVERSION_LABELS = {
    proforma: 'Établir une proforma', commande: 'Enregistrer le bon de commande', livraison: 'Établir le bon de livraison',
    contrat: 'Rédiger le contrat à signer', facture: 'Facturer'
  };
  // Champs qui n'ont de sens que sur la pièce d'origine et ne doivent jamais suivre la conversion.
  const NOT_COPIED = ['payments', 'emails', 'reminders', 'remindAfter', 'withholdingCertificate', 'deposit',
    'settles', 'recurringId', 'creditOf', 'creditOfNumber', 'creditReason', 'attachments', 'clauses'];

  function convertDoc(doc, targetType, company, todayIso) {
    const date = todayIso || today();
    const copy = JSON.parse(JSON.stringify(doc));
    NOT_COPIED.forEach(k => { delete copy[k]; });
    delete copy.fromQuoteId; delete copy.fromQuoteNumber;
    const days = targetType === 'devis' ? company.quoteValidityDays : company.paymentTermsDays;
    const out = {
      ...copy, id: uid(), type: targetType, number: '', status: 'brouillon', date,
      dueDate: ['facture', 'proforma', 'devis'].includes(targetType) ? addDays(date, Number(days) || 30) : '',
      createdAt: Date.now(), payments: [],
      applyStamp: targetType === 'facture',
      withholdingRate: ['facture', 'avoir', 'proforma'].includes(targetType) ? (Number(doc.withholdingRate) || 0) : 0,
      // d'où vient cette pièce : affiché sur le document, dans l'historique, et cliquable dans l'app
      fromDocId: doc.id, fromDocType: doc.type, fromDocNumber: doc.number || ''
    };
    // Le devis reste l'origine reconnue par la facturation (acompte, solde, tableau de bord) : on la garde.
    if (doc.type === 'devis' && targetType === 'facture') { out.fromQuoteId = doc.id; out.fromQuoteNumber = doc.number || ''; }
    else if (doc.fromQuoteId) { out.fromQuoteId = doc.fromQuoteId; out.fromQuoteNumber = doc.fromQuoteNumber || ''; }
    if (targetType === 'contrat') out.clauses = { ...DEFAULT_CLAUSES, ...(doc.clauses || {}) };
    if (targetType === 'livraison') out.hidePrices = true;   // un bon de livraison accompagne la marchandise : les prix n'ont rien à y faire
    return out;
  }

  // Les pièces issues d'une autre, dans l'ordre où elles ont été établies.
  function derivedDocs(doc, data) {
    if (!doc || !doc.id) return [];   // sans identifiant, `undefined === undefined` renverrait toute la base
    return (data.documents || []).filter(d => d.fromDocId === doc.id)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0));
  }

  // Clauses d'un contrat de prestation. Textes de départ, tous modifiables sur le document.
  // Ce sont des formulations courantes, pas un conseil juridique — À FAIRE RELIRE par un juriste ou le comptable.
  const DEFAULT_CLAUSES = {
    objet: 'Le prestataire s\'engage à réaliser pour le client les prestations décrites ci-dessus, dans les conditions définies au présent contrat.',
    duree: 'Le présent contrat est conclu pour une durée de douze (12) mois à compter de sa date de signature.',
    reconduction: 'À son terme, le contrat est reconduit tacitement pour des périodes successives de douze (12) mois, sauf dénonciation par l\'une des parties.',
    preavis: 'La dénonciation se fait par lettre recommandée avec accusé de réception, moyennant un préavis de trente (30) jours avant l\'échéance.',
    paiement: 'Les prestations sont facturées mensuellement et payables à trente (30) jours date de facture. Tout retard de paiement pourra entraîner la suspension des prestations.',
    confidentialite: 'Chaque partie s\'engage à garder confidentielle toute information de l\'autre partie dont elle aurait connaissance à l\'occasion du présent contrat.',
    litiges: 'En cas de litige, les parties s\'efforceront de trouver une solution amiable. À défaut, le différend sera porté devant les tribunaux compétents de Tunis.'
  };
  const CLAUSE_LABELS = [
    ['objet', 'Objet du contrat'], ['duree', 'Durée'], ['reconduction', 'Reconduction'], ['preavis', 'Résiliation et préavis'],
    ['paiement', 'Conditions de paiement'], ['confidentialite', 'Confidentialité'], ['litiges', 'Litiges']
  ];

  // ---------- statistiques ----------
  // Bornes d'une période nommée. `kind` : 'annee' | 'trimestre' | 'mois'. `n` = numéro du trimestre (1-4)
  // ou du mois (1-12). Renvoie aussi la même période de l'année précédente, pour la comparaison.
  function periodBounds(kind, year, n) {
    const y = Number(year);
    const last = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const make = (yy, m1, m2) => ({ from: `${yy}-${pad2(m1)}-01`, to: `${yy}-${pad2(m2)}-${pad2(last(yy, m2))}` });
    let cur, label;
    if (kind === 'mois') { const m = Math.min(12, Math.max(1, Number(n) || 1)); cur = make(y, m, m); label = `${MONTHS_FR[m - 1]} ${y}`; }
    else if (kind === 'trimestre') { const q = Math.min(4, Math.max(1, Number(n) || 1)); cur = make(y, q * 3 - 2, q * 3); label = `${q}ᵉ trimestre ${y}`; }
    else { cur = make(y, 1, 12); label = `année ${y}`; }
    const prev = kind === 'mois' ? make(y - 1, Number(n) || 1, Number(n) || 1)
      : kind === 'trimestre' ? make(y - 1, (Number(n) || 1) * 3 - 2, (Number(n) || 1) * 3)
        : make(y - 1, 1, 12);
    return { ...cur, label, prev, kind, year: y, n: Number(n) || 0 };
  }

  // Factures et avoirs émis d'une période, avoirs comptés en négatif. Base de tous les chiffres qui suivent.
  function issuedIn(data, fromIso, toIso) {
    return (data.documents || []).filter(d => (d.type === 'facture' || d.type === 'avoir')
      && d.status !== 'brouillon' && d.status !== 'annulée' && inPeriod(d.date, fromIso, toIso));
  }
  function salesTotals(data, company, fromIso, toIso) {
    const docs = issuedIn(data, fromIso, toIso);
    let ht = 0, ttc = 0, vat = 0;
    docs.forEach(d => {
      const t = computeTotals(d, company), sign = d.type === 'avoir' ? -1 : 1;
      ht = round3(ht + sign * toBase(d, t.netHT, company));
      ttc = round3(ttc + sign * toBase(d, t.totalTTC, company));
      vat = round3(vat + sign * toBase(d, t.totalVAT, company));
    });
    const invoices = docs.filter(d => d.type === 'facture').length;
    return { ht, ttc, vat, count: docs.length, invoices, avgTicket: invoices ? round3(ht / invoices) : 0 };
  }

  // CA HT mois par mois sur une période quelconque (sert au graphique et à la saisonnalité).
  function revenueByMonth(data, company, fromIso, toIso) {
    const out = [];
    let y = Number(fromIso.slice(0, 4)), m = Number(fromIso.slice(5, 7));
    const endY = Number(toIso.slice(0, 4)), endM = Number(toIso.slice(5, 7));
    let guard = 0;
    while ((y < endY || (y === endY && m <= endM)) && guard++ < 240) {
      out.push({ month: `${y}-${pad2(m)}`, label: MONTHS_SHORT[m - 1], ht: 0, count: 0 });
      m++; if (m > 12) { m = 1; y++; }
    }
    const byKey = Object.fromEntries(out.map(x => [x.month, x]));
    issuedIn(data, fromIso, toIso).forEach(d => {
      const k = (d.date || '').slice(0, 7);
      if (!byKey[k]) return;
      byKey[k].ht = round3(byKey[k].ht + (d.type === 'avoir' ? -1 : 1) * toBase(d, computeTotals(d, company).netHT, company));
      byKey[k].count++;
    });
    return out;
  }

  // Prestations les plus vendues sur la période, regroupées par libellé (les lignes de déduction d'acompte sont ignorées).
  function topItems(data, company, fromIso, toIso, limit) {
    const totals = {};
    issuedIn(data, fromIso, toIso).forEach(d => {
      const sign = d.type === 'avoir' ? -1 : 1;
      computeTotals(d, company).lines.forEach(l => {
        const key = (l.label || '').trim().toLowerCase();
        if (!key || l.noDiscount) return;                       // acompte déjà facturé : pas une vente
        const t = totals[key] || (totals[key] = { label: (l.label || '').trim(), ht: 0, qty: 0, count: 0 });
        t.ht = round3(t.ht + sign * toBase(d, l.ht, company));
        t.qty = round3(t.qty + sign * (Number(l.qty) || 0));
        t.count++;
      });
    });
    return Object.values(totals).sort((a, b) => b.ht - a.ht).slice(0, limit || 8);
  }

  // Clients nouveaux sur la période (première facture dedans) et clients endormis (plus rien depuis `dormantDays`).
  function clientMovement(data, company, fromIso, toIso, dormantDays, todayIso) {
    const t = todayIso || today();
    const seuil = Number(dormantDays) || 180;
    const nouveaux = [], dormants = [];
    const inside = issuedIn(data, fromIso, toIso);
    (data.clients || []).forEach(c => {
      const dates = (data.documents || []).filter(d => d.clientId === c.id && (d.type === 'facture' || d.type === 'avoir')
        && d.status !== 'brouillon' && d.status !== 'annulée').map(d => d.date).filter(Boolean).sort();
      if (!dates.length) return;
      const first = dates[0], last = dates[dates.length - 1];
      const ht = round3(inside.filter(d => d.clientId === c.id)
        .reduce((s, d) => s + (d.type === 'avoir' ? -1 : 1) * toBase(d, computeTotals(d, company).netHT, company), 0));
      if (inPeriod(first, fromIso, toIso)) nouveaux.push({ clientId: c.id, name: c.name, since: first, ht });
      const idle = daysBetween(last, t);
      if (idle >= seuil) dormants.push({ clientId: c.id, name: c.name, last, days: idle });
    });
    return {
      nouveaux: nouveaux.sort((a, b) => b.ht - a.ht),
      dormants: dormants.sort((a, b) => b.days - a.days)
    };
  }

  // Âge des impayés : ce qui reste dû, rangé par retard. Un bon indicateur de ce qui part en créance douteuse.
  const AGING_BUCKETS = [[0, 0, 'Pas encore échu'], [1, 30, '1 à 30 jours'], [31, 60, '31 à 60 jours'], [61, 90, '61 à 90 jours'], [91, 99999, 'Plus de 90 jours']];
  function agedReceivables(data, company, todayIso) {
    const t = todayIso || today();
    const buckets = AGING_BUCKETS.map(([min, max, label]) => ({ label, min, max, amount: 0, count: 0 }));
    let total = 0;
    (data.documents || []).filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée').forEach(d => {
      const rest = invoiceBalance(d, data, company).remaining;
      if (rest <= 0.0005) return;
      const amount = round3(toBase(d, rest, company));
      const late = d.dueDate && d.dueDate < t ? daysBetween(d.dueDate, t) : 0;
      const b = buckets.find(x => late >= x.min && late <= x.max) || buckets[0];
      b.amount = round3(b.amount + amount); b.count++;
      total = round3(total + amount);
    });
    return { buckets, total };
  }

  // Classement des payeurs : délai moyen constaté par client, sur ses factures soldées.
  function payerRanking(data, company, limit) {
    const out = [];
    (data.clients || []).forEach(c => {
      const delays = [];
      (data.documents || []).filter(d => d.type === 'facture' && d.clientId === c.id && d.status !== 'brouillon' && d.status !== 'annulée').forEach(d => {
        if (effectiveStatus(d, data, company, '9999-12-31') !== 'payée' || !(d.payments || []).length) return;
        const last = d.payments.map(p => p.date).sort().pop();
        if (last && d.date) delays.push(daysBetween(d.date, last));
      });
      if (delays.length) out.push({ clientId: c.id, name: c.name, delay: Math.round(delays.reduce((s, x) => s + x, 0) / delays.length), count: delays.length });
    });
    out.sort((a, b) => a.delay - b.delay);
    return { rapides: out.slice(0, limit || 5), lents: out.slice().reverse().slice(0, limit || 5), tous: out };
  }

  // Devis de la période : issue de chacun, montants gagnés et perdus, délai moyen de réponse.
  function quoteFunnel(data, company, fromIso, toIso, todayIso) {
    const t = todayIso || today();
    const quotes = (data.documents || []).filter(d => d.type === 'devis' && d.status !== 'brouillon' && inPeriod(d.date, fromIso, toIso));
    const amount = d => toBase(d, computeTotals(d, company).totalTTC, company);
    const sum = list => round3(list.reduce((s, d) => s + amount(d), 0));
    const accepted = quotes.filter(d => d.status === 'accepté');
    const refused = quotes.filter(d => d.status === 'refusé');
    const expired = quotes.filter(d => effectiveStatus(d, data, company, t) === 'expiré');
    const pending = quotes.filter(d => d.status !== 'accepté' && d.status !== 'refusé' && effectiveStatus(d, data, company, t) !== 'expiré');
    // Délai de réponse : on n'a pas de date de décision, on prend la date de la facture qui en découle.
    const delays = [];
    accepted.forEach(q => {
      const inv = (data.documents || []).filter(d => d.type === 'facture' && d.fromQuoteId === q.id).map(d => d.date).filter(Boolean).sort()[0];
      if (inv && q.date) delays.push(daysBetween(q.date, inv));
    });
    const decided = accepted.length + refused.length;
    return {
      total: quotes.length,
      accepted: accepted.length, refused: refused.length, expired: expired.length, pending: pending.length,
      acceptedAmount: sum(accepted), refusedAmount: sum(refused), expiredAmount: sum(expired), pendingAmount: sum(pending),
      rate: decided ? Math.round(accepted.length / decided * 100) : null,
      replyDelay: delays.length ? Math.round(delays.reduce((s, x) => s + x, 0) / delays.length) : null
    };
  }

  // Objectif annuel : où on en est, et où on devrait en être à cette date de l'année.
  function objectiveProgress(target, ht, todayIso, year) {
    const goal = Number(target) || 0;
    if (goal <= 0) return null;
    const t = todayIso || today();
    const y = Number(year) || Number(t.slice(0, 4));
    const elapsed = Number(t.slice(0, 4)) > y ? 366 : Number(t.slice(0, 4)) < y ? 0 : daysBetween(`${y}-01-01`, t) + 1;
    const yearDays = daysBetween(`${y}-01-01`, `${y}-12-31`) + 1;
    const part = Math.min(1, Math.max(0, elapsed / yearDays));
    const expected = round3(goal * part);
    const months = Math.max(1, Math.round((1 - part) * 12));
    return {
      goal, ht, pct: Math.round(ht / goal * 100), expected, expectedPct: Math.round(part * 100),
      ahead: round3(ht - expected), remaining: round3(Math.max(0, goal - ht)),
      perMonth: round3(Math.max(0, goal - ht) / months), monthsLeft: months
    };
  }

  // ---------- relances ----------

  function reminderLevel(daysLate) { return daysLate > 45 ? 3 : daysLate > 15 ? 2 : 1; }
  const REMINDER_LABELS = { 1: 'Rappel', 2: 'Relance', 3: 'Dernière relance' };

  function daysBetween(fromIso, toIso) { return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000); }

  // Factures échues (ou partiellement payées et échues), avec jours de retard et dernière relance.
  // `snoozed` : l'utilisateur a demandé de ne pas relancer avant une date (doc.remindAfter).
  function overdueInvoices(data, company, todayIso) {
    const t = todayIso || today();
    return (data.documents || [])
      .filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée' && d.dueDate && d.dueDate < t)
      .map(d => ({ doc: d, balance: invoiceBalance(d, data, company), status: effectiveStatus(d, data, company, t) }))
      .filter(x => x.balance.remaining > 0.0005)
      .map(x => {
        const daysLate = daysBetween(x.doc.dueDate, t);
        const reminders = x.doc.reminders || [];
        const last = reminders.length ? reminders[reminders.length - 1] : null;
        const snoozed = !!(x.doc.remindAfter && x.doc.remindAfter > t);
        return { doc: x.doc, remaining: x.balance.remaining, daysLate, level: reminderLevel(daysLate), reminders, lastReminder: last, status: x.status, snoozed, remindAfter: x.doc.remindAfter || '' };
      })
      .sort((a, b) => (a.snoozed ? 1 : 0) - (b.snoozed ? 1 : 0) || b.daysLate - a.daysLate);
  }

  // ---------- ce qui demande une action ----------

  // Le panneau « À faire » de l'accueil. Renvoie des groupes ordonnés du plus urgent au moins urgent.
  // Chaque groupe : { id, level (danger|warn|info), label, detail, count, amount, route, docs }
  // `opts.copieExterne` : l'état de la copie de sauvegarde vit sur le poste, pas dans les données.
  // L'appelant le fournit ; absent, la ligne correspondante ne s'allume simplement pas.
  function todoList(data, company, todayIso, opts) {
    const t = todayIso || today();
    const out = [];
    const cur = company.currency;
    const fmt = n => money(n, cur);

    const overdue = overdueInvoices(data, company, t).filter(x => !x.snoozed);
    const overdueAmount = round3(overdue.reduce((s, x) => s + toBase(x.doc, x.remaining, company), 0));
    if (overdue.length) out.push({
      id: 'retards', level: 'danger', label: `${overdue.length} facture${overdue.length > 1 ? 's' : ''} en retard`,
      detail: `${fmt(overdueAmount)} à récupérer · plus ancienne : ${overdue[0].daysLate} jours`,
      count: overdue.length, amount: overdueAmount, route: '#/relances', docs: overdue.map(x => x.doc)
    });

    // Fiche société : sans raison sociale ni matricule, une facture n'est pas conforme ; sans RIB, le client ne sait pas où payer
    const missing = companyGaps(company);
    if (missing.length) out.push({
      id: 'societe', level: 'warn', label: 'Fiche société incomplète',
      detail: `Il manque : ${missing.join(', ')}. Ces informations s'impriment sur chaque document.`,
      count: missing.length, route: '#/parametres', docs: []
    });

    // Clôture : un mois terminé depuis plus de dix jours et jamais clôturé, c'est un mois qui peut
    // encore bouger sans que personne ne le voie. Dix jours, parce qu'avant ça il manque toujours
    // une facture d'achat qui arrive par la poste.
    const toClose = closableMonths(data, t).filter(m => daysBetween(m.to, t) >= 10);
    if (toClose.length) {
      const last = toClose[toClose.length - 1];
      out.push({
        id: 'cloture', level: toClose.length > 2 ? 'warn' : 'info',
        label: toClose.length === 1 ? `${last.label} est à clôturer` : `${toClose.length} mois à clôturer`,
        detail: toClose.length === 1
          ? 'Le mois est terminé et tout devrait être saisi. Clôturer, c\'est promettre à ton comptable que ce mois ne bougera plus.'
          : `De ${toClose[0].label} à ${last.label}. Tant qu\'un mois n\'est pas clôturé, une saisie d\'aujourd\'hui peut en changer la TVA sans que personne ne le voie.`,
        count: toClose.length, route: '#/compta', docs: []
      });
    }

    const due = dueRecurrences(data, t);
    if (due.length) out.push({
      id: 'contrats', level: 'warn', label: `${due.length} facture${due.length > 1 ? 's' : ''} de contrat à générer`,
      detail: due.map(r => fillTemplate(r.subject, { mois: monthLabel(r.nextDate) })).join(' · '),
      count: due.length, route: '#/contrats', docs: []
    });

    // Devis acceptés dont aucune facture (même brouillon) n'a été tirée : le travail est vendu, pas facturé
    const billed = new Set((data.documents || []).filter(d => d.type === 'facture' && d.fromQuoteId).map(d => d.fromQuoteId));
    const accepted = (data.documents || []).filter(d => d.type === 'devis' && d.status === 'accepté' && !billed.has(d.id));
    const acceptedAmount = round3(accepted.reduce((s, d) => s + toBase(d, computeTotals(d, company).totalTTC, company), 0));
    if (accepted.length) out.push({
      id: 'devis-acceptes', level: 'warn', label: `${accepted.length} devis accepté${accepted.length > 1 ? 's' : ''} à facturer`,
      detail: `${fmt(acceptedAmount)} TTC vendus et pas encore facturés. Ouvre le devis puis « Facturer ▾ ».`,
      count: accepted.length, amount: acceptedAmount, route: '#/devis', docs: accepted
    });

    const expired = (data.documents || []).filter(d => d.type === 'devis' && effectiveStatus(d, data, company, t) === 'expiré');
    if (expired.length) out.push({
      id: 'devis-expires', level: 'warn', label: `${expired.length} devis expiré${expired.length > 1 ? 's' : ''}`,
      detail: 'La date de validité est passée sans réponse : relance ou classe-les en refusés.',
      count: expired.length, route: '#/devis', docs: expired
    });

    // Devis envoyés, encore valables, mais sans nouvelle depuis plus de 15 jours
    const silent = (data.documents || []).filter(d => d.type === 'devis' && effectiveStatus(d, data, company, t) === 'envoyé' && d.date && daysBetween(d.date, t) > 15);
    if (silent.length) out.push({
      id: 'devis-sans-reponse', level: 'info', label: `${silent.length} devis sans réponse depuis plus de 15 jours`,
      detail: 'Un appel ou un email relance souvent une décision qui traîne.',
      count: silent.length, route: '#/devis', docs: silent
    });

    const rsPending = (data.documents || []).filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée'
      && computeTotals(d, company).withholding > 0 && !d.withholdingCertificate);
    const rsAmount = round3(rsPending.reduce((s, d) => s + toBase(d, computeTotals(d, company).withholding, company), 0));
    if (rsPending.length) out.push({
      id: 'attestations', level: 'warn', label: `${rsPending.length} attestation${rsPending.length > 1 ? 's' : ''} de retenue à réclamer`,
      detail: `${fmt(rsAmount)} retenus par tes clients. Sans attestation, tu ne peux pas les déduire de ton impôt.`,
      count: rsPending.length, amount: rsAmount, route: '#/compta', docs: rsPending
    });

    // Côté sortant : ce qu'on doit soi-même. Un fournisseur impayé coûte la relation, pas seulement l'argent.
    const owed = payablesList(data, company, t);
    const owedLate = owed.filter(x => x.late > 0);
    if (owedLate.length) out.push({
      id: 'fournisseurs-retard', level: 'danger',
      label: `${owedLate.length} facture${owedLate.length > 1 ? 's' : ''} fournisseur en retard`,
      detail: `${fmt(round3(owedLate.reduce((s, x) => s + x.remaining, 0)))} à régler · la plus ancienne : ${owedLate[0].late} jours`,
      count: owedLate.length, amount: round3(owedLate.reduce((s, x) => s + x.remaining, 0)), route: '#/achats', docs: []
    });
    const owedSoon = owed.filter(x => !x.late && x.dueDate && daysBetween(t, x.dueDate) <= 7);
    if (owedSoon.length) out.push({
      id: 'fournisseurs-echeances', level: 'info',
      label: `${owedSoon.length} règlement${owedSoon.length > 1 ? 's' : ''} fournisseur cette semaine`,
      detail: `${fmt(round3(owedSoon.reduce((s, x) => s + x.remaining, 0)))} à prévoir sur ton compte.`,
      count: owedSoon.length, route: '#/achats', docs: []
    });
    // Stock : d'abord l'impossible (on a vendu ce qu'on n'avait pas), ensuite ce qui va manquer.
    const negStock = stockList(data).filter(x => x.negative);
    if (negStock.length) out.push({
      id: 'stock-negatif', level: 'danger',
      label: `${negStock.length} article${negStock.length > 1 ? 's' : ''} en stock négatif`,
      detail: `${negStock.map(x => x.label).slice(0, 3).join(', ')}${negStock.length > 3 ? '…' : ''} : tu as vendu plus que tu n'as acheté. Un achat manque, ou une quantité a été saisie de travers.`,
      count: negStock.length, route: '#/stock', docs: []
    });
    const lowStock = stockList(data).filter(x => x.low);
    if (lowStock.length) out.push({
      id: 'stock-bas', level: 'warn',
      label: `${lowStock.length} article${lowStock.length > 1 ? 's' : ''} à recommander`,
      detail: `${lowStock.map(x => `${x.label} (${x.qty} ${x.unit || ''})`.trim()).slice(0, 3).join(' · ')}${lowStock.length > 3 ? '…' : ''} — sous le seuil d'alerte.`,
      count: lowStock.length, route: '#/stock', docs: []
    });
    // Déclarations sociales à déposer : la CNSS ne relance pas, elle pénalise.
    const soc = socialDue(data, t);
    if (soc.length) out.push({
      id: 'declarations-sociales', level: soc.some(x => x.late) ? 'danger' : 'warn',
      label: `${soc.length} déclaration${soc.length > 1 ? 's' : ''} sociale${soc.length > 1 ? 's' : ''} à déposer`,
      detail: soc.map(x => `${x.label} — ${x.late ? 'échéance dépassée le ' : 'avant le '}${fmtDate(x.dueDate)}`).join(' · '),
      count: soc.length, route: '#/paie', docs: []
    });
    // Paie : les bulletins du mois écoulé qui manquent, et le doublon avec un mouvement « Salaires ».
    if ((data.employees || []).length) {
      const prev = addMonths(`${t.slice(0, 7)}-01`, -1, 1);
      const py = Number(prev.slice(0, 4)), pm = Number(prev.slice(5, 7));
      const miss = missingPayslips(data, py, pm);
      if (miss.length) out.push({
        id: 'bulletins', level: 'warn',
        label: `${miss.length} bulletin${miss.length > 1 ? 's' : ''} de paie à établir pour ${monthLabel(prev)}`,
        detail: `${miss.map(e => e.name).slice(0, 4).join(', ')}${miss.length > 4 ? '…' : ''}. Un salarié actif sans bulletin, c'est un oubli.`,
        count: miss.length, route: '#/paie', docs: []
      });
      // Le bulletin réglé produit déjà sa sortie d'argent : un mouvement « Salaires » du même mois ferait double.
      const paidMonths = new Set((data.payslips || []).filter(p => p.paidDate).map(p => (p.paidDate || '').slice(0, 7)));
      const dbl = (data.movements || []).filter(m => m.kind === 'salaire' && paidMonths.has((m.date || '').slice(0, 7)));
      if (dbl.length) out.push({
        id: 'salaires-double', level: 'warn',
        label: `${dbl.length} mouvement${dbl.length > 1 ? 's' : ''} « Salaires » compté${dbl.length > 1 ? 's' : ''} deux fois`,
        detail: 'Un bulletin réglé sort déjà l\'argent tout seul. Supprime ces mouvements libres, sinon ta trésorerie est fausse du montant des salaires.',
        count: dbl.length, route: '#/tresorerie', docs: []
      });
    }
    // Garanties qui se terminent : une occasion de proposer un contrat, pas une mauvaise nouvelle.
    const war = warrantiesEnding(data, 60, t);
    if (war.length) out.push({
      id: 'garanties', level: 'info',
      label: `${war.length} garantie${war.length > 1 ? 's' : ''} se termine${war.length > 1 ? 'nt' : ''} dans moins de deux mois`,
      detail: `${war.slice(0, 3).map(x => `${x.itemLabel} chez ${x.clientName || 'un client'} (${fmtDate(x.warrantyEndDate)})`).join(' · ')}${war.length > 3 ? '…' : ''} — le moment de proposer un contrat de maintenance.`,
      count: war.length, route: '#/garanties', docs: []
    });
    // Numéros de série et quantités qui ne disent plus la même chose
    const gaps = serialGaps(data, t);
    if (gaps.length) out.push({
      id: 'series-ecart', level: 'warn',
      label: `${gaps.length} article${gaps.length > 1 ? 's' : ''} dont les numéros de série ne collent pas au stock`,
      detail: gaps.map(g => `${g.label} : ${g.qty} en stock, ${g.serials} numéro(s) disponible(s)`).join(' · ') + '. Un numéro n\'a pas été saisi à l\'entrée, ou pas attribué à la sortie.',
      count: gaps.length, route: '#/stock', docs: []
    });
    // Lignes d'achat marquées « immobilisation » sans fiche : sans elles, aucune dotation n'est calculée
    // et le résultat de l'année est faussement bon (3.5.0).
    const toImmo = assetsToCreate(data);
    if (toImmo.length) out.push({
      id: 'immobilisations', level: 'info',
      label: `${toImmo.length} achat${toImmo.length > 1 ? 's' : ''} à immobiliser`,
      detail: `${fmt(round3(toImmo.reduce((sum, x) => sum + x.amount, 0)))} achetés en immobilisation sans plan d'amortissement. Tant que la fiche manque, rien n'est déduit.`,
      count: toImmo.length, route: '#/immos', docs: []
    });
    // Attestations de retenue que TU dois remettre à tes fournisseurs prestataires
    const wOut = withholdingsToIssue(data, company);
    if (wOut.length) out.push({
      id: 'attestations-fournisseurs', level: 'warn',
      label: `${wOut.length} attestation${wOut.length > 1 ? 's' : ''} de retenue à remettre`,
      detail: `${fmt(round3(wOut.reduce((s, x) => s + x.amount, 0)))} retenus à tes fournisseurs. Sans attestation de ta part, ils ne peuvent pas la déduire.`,
      count: wOut.length, route: '#/achats', docs: []
    });

    const soon = (data.documents || []).filter(d => d.type === 'facture' && ['envoyée', 'partielle'].includes(effectiveStatus(d, data, company, t))
      && d.dueDate && d.dueDate >= t && daysBetween(t, d.dueDate) <= 7);
    if (soon.length) out.push({
      id: 'echeances', level: 'info', label: `${soon.length} facture${soon.length > 1 ? 's' : ''} à échéance cette semaine`,
      detail: 'Un message avant l\'échéance évite souvent la relance après.',
      count: soon.length, route: '#/relances', docs: soon
    });

    // Un trou de trésorerie prévu passe avant tout le reste : une entreprise rentable peut en mourir.
    if ((data.accounts || []).length) {
      const f = cashForecast(data, company, 60, t);
      if (f.shortfall) out.unshift({
        id: 'tresorerie', level: 'danger',
        label: `Trou de trésorerie prévu le ${fmtDate(f.shortfall.date)}`,
        detail: `Ton solde descendrait à ${fmt(f.shortfall.balance)} après « ${f.shortfall.label} ». Relance tes impayés ou décale un règlement.`,
        count: 1, amount: f.shortfall.balance, route: '#/tresorerie', docs: []
      });
    }

    // Échéances fiscales des deux prochaines semaines. C'est un pense-bête réglé par l'utilisateur :
    // les dates et la périodicité relèvent du « À VÉRIFIER avec ton comptable ».
    const fisc = upcomingFiscal(data, t, 14);
    if (fisc.length) out.push({
      id: 'fiscal', level: fisc[0].days <= 5 ? 'warn' : 'info',
      label: `${fisc.length} échéance${fisc.length > 1 ? 's' : ''} fiscale${fisc.length > 1 ? 's' : ''} sous 15 jours`,
      detail: fisc.map(x => `${x.label} le ${fmtDate(x.date)}`).join(' · '),
      count: fisc.length, route: '#/compta', docs: []
    });

    const oldDrafts = (data.documents || []).filter(d => d.status === 'brouillon' && d.date && daysBetween(d.date, t) > 7);
    if (oldDrafts.length) out.push({
      id: 'brouillons', level: 'info', label: `${oldDrafts.length} brouillon${oldDrafts.length > 1 ? 's' : ''} de plus de 7 jours`,
      detail: 'Un brouillon oublié, c\'est un travail non facturé.',
      count: oldDrafts.length, route: '#/factures', docs: oldDrafts
    });

    // La copie de sauvegarde, quand c'est la seule étape de démarrage qui manque. Elle quitte alors
    // le panneau « Tes premiers pas » (qui disparaît) pour devenir une ligne ordinaire : c'est
    // l'étape que tout le monde saute, et la seule dont l'absence coûte tout.
    const pas = firstSteps(data, company, opts || {});
    if (pas.sauvegardeSeule) out.push({
      id: 'sauvegarde', level: 'warn', label: 'Tes données ne sont copiées nulle part',
      detail: 'Un disque qui lâche, un ordinateur volé, et tout est perdu. Une copie automatique vers iCloud, un disque ou une clé USB prend deux minutes à mettre en place.',
      count: 1, route: '#/parametres'
    });

    // Les pièces en devise étrangère sans taux de change. Elles ne se signalaient nulle part et
    // faisaient compter 1 euro = 1 dinar dans le journal des ventes, la TVA à déclarer, le chiffre
    // d'affaires et le paquet envoyé au comptable. Depuis la 7.0.1 la saisie les refuse ; celles qui
    // existent déjà doivent se rattraper, sinon la déclaration part fausse.
    const sansTaux = (data.documents || []).filter(d => missingRate(d, company));
    if (sansTaux.length) out.push({
      id: 'taux-change', level: 'danger',
      label: `${sansTaux.length} pièce${sansTaux.length > 1 ? 's' : ''} en devise sans taux de change`,
      detail: 'Tant que le taux manque, ces montants comptent comme des dinars : ton chiffre d\'affaires et ta TVA sont faux.',
      count: sansTaux.length, route: '#/factures', docs: sansTaux
    });

    // Le commentaire en tête de cette fonction promet « du plus urgent au moins urgent » depuis la
    // 1.10.0, et l'ordre réel était celui du code — c'est-à-dire l'ordre dans lequel les modules ont
    // été écrits. Sur le jeu d'exemple, « 3 factures en retard » (rouge) se retrouvait au-dessus,
    // mais « 2 déclarations sociales en retard » (rouge aussi) arrivait NEUVIÈME, sous cinq lignes
    // orange et une bleue. Un tri stable : l'urgence décide, et à urgence égale l'ordre du code
    // (qui est thématique, donc lisible) est conservé.
    const rang = { danger: 0, warn: 1, info: 2 };
    return out
      .map((x, i) => [x, i])
      .sort((a, b) => (rang[a[0].level] - rang[b[0].level]) || (a[1] - b[1]))
      .map(p => p[0]);
  }

  // Ce qui manque à la fiche société pour que les documents soient complets.
  function companyGaps(company) {
    const c = company || {};
    const out = [];
    if (!(c.name || '').trim()) out.push('la raison sociale');
    if (!(c.matricule || '').trim()) out.push('le matricule fiscal');
    if (!(c.rib || '').trim()) out.push('le RIB');
    return out;
  }

  // ---------- les premiers pas (7.0.0) ----------
  //
  // Ce que quelqu'un qui vient d'installer SkanFact doit faire, dans l'ordre, pour que l'application
  // lui serve à quelque chose. Sept étapes, et un principe : **l'état de chacune est DÉDUIT des
  // données**, jamais coché à la main. Une case qu'on coche soi-même ment le jour où on l'a cochée
  // par erreur, ou reste vide le jour où on a fait le geste par un autre chemin.
  //
  // Pourquoi ça n'existait pas : jusqu'ici, le premier jour, l'accueil montrait quatre compteurs à
  // zéro, un graphique de douze mois vides, un « Top clients » vide — et, huit cents pixels plus bas,
  // deux boutons. La seule autre orientation était un toast de deux secondes et demie et un article
  // d'aide que rien ne proposait. La première phrase que l'application adressait à son utilisateur
  // était « Fiche société incomplète », c'est-à-dire un reproche, juste après un assistant qu'il
  // venait de mener jusqu'au bout.
  //
  // `opts.copieExterne` : la copie de sauvegarde vers un dossier externe ne vit pas dans les données
  // (elle est dans app-config.json, propre au poste), donc l'appelant la fournit. Elle est ici parce
  // que c'est l'étape que tout le monde saute et la seule dont l'absence coûte tout.
  function firstSteps(data, company, opts) {
    const d = data || {};
    const o = opts || {};
    const docs = d.documents || [];
    const devis = docs.filter(x => x.type === 'devis');
    const gaps = companyGaps(company);
    const facturesEmises = docs.filter(x => x.type === 'facture' && x.status !== 'brouillon');
    const unPaiement = docs.some(x => (x.payments || []).length);

    const etapes = [
      { id: 'societe', titre: 'Compléter ta fiche société', fait: !gaps.length,
        quoi: gaps.length
          ? `Il manque ${liste(gaps)}. Ces informations s'impriment en haut de chaque document, et une facture sans matricule fiscal n'est pas conforme.`
          : 'Raison sociale, matricule fiscal et RIB sont renseignés : tes documents sont en règle.',
        action: 'societe' },
      { id: 'client', titre: 'Enregistrer ton premier client', fait: (d.clients || []).length > 0,
        quoi: 'Son adresse et son matricule se reporteront tout seuls sur chaque devis et chaque facture.',
        action: 'client' },
      { id: 'catalogue', titre: 'Remplir ton catalogue', fait: (d.catalog || []).length > 0,
        quoi: 'Ce que tu vends, avec son prix et sa TVA. Une ligne de devis se choisit alors dans une liste au lieu d\'être retapée.',
        action: 'catalogue' },
      { id: 'devis', titre: 'Faire ton premier devis', fait: devis.length > 0,
        quoi: 'Un devis annonce un prix avant de travailler. C\'est la pièce par laquelle presque tout commence.',
        action: 'devis' },
      { id: 'envoi', titre: 'L\'envoyer à ton client', fait: devis.some(x => x.status && x.status !== 'brouillon'),
        quoi: 'Ouvre le devis, puis « Envoyer » : le PDF part en pièce jointe. Tant qu\'un devis reste en brouillon, SkanFact ne le compte nulle part.',
        action: devis.length ? 'envoiDevis' : null },
      { id: 'facture', titre: 'Transformer un devis accepté en facture', fait: facturesEmises.length > 0,
        quoi: 'En un clic, sans rien ressaisir. C\'est à ce moment-là que le numéro est attribué et que la pièce se verrouille.',
        action: 'factures' },
      { id: 'sauvegarde', titre: 'Mettre tes données à l\'abri', fait: !!o.copieExterne,
        quoi: 'Une copie automatique vers iCloud, un disque ou une clé USB. C\'est l\'étape que tout le monde saute, et la seule dont l\'absence coûte tout.',
        action: 'sauvegarde' }
    ];
    if (unPaiement) {
      etapes.push({ id: 'encaissement', titre: 'Encaisser', fait: true,
        quoi: 'Un paiement enregistré fait basculer la facture toute seule : tu ne saisis jamais « payée » à la main.', action: 'factures' });
    }
    const faits = etapes.filter(x => x.fait).length;
    // Le panneau ne vaut que pendant le DÉMARRAGE. Une fois qu'une facture est partie, quelqu'un qui
    // a deux ans d'activité n'a plus rien à faire d'un écran qui lui propose « crée ton premier
    // client » — et le panneau reprendrait tout l'écran, exactement le défaut qu'il corrige.
    // La copie de sauvegarde, elle, reste importante : quand c'est la seule étape qui manque, elle
    // devient une ligne de « À faire », pas un panneau.
    const metier = etapes.filter(x => x.id !== 'sauvegarde');
    const demarrage = metier.some(x => !x.fait);
    return { etapes, faits, total: etapes.length, fini: faits === etapes.length, demarrage,
      sauvegardeSeule: !demarrage && !etapes.find(x => x.id === 'sauvegarde').fait };
  }

  // « a », « a et b », « a, b et c » — parce qu'« il manque le matricule fiscal, le RIB » se voit.
  function liste(mots) {
    const m = (mots || []).filter(Boolean);
    if (m.length <= 1) return m[0] || '';
    return m.slice(0, -1).join(', ') + ' et ' + m[m.length - 1];
  }

  // Historique d'un document, reconstitué à partir de ce qui est déjà enregistré.
  function documentHistory(doc, data, company) {
    const ev = [];
    const dateOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    if (doc.createdAt) ev.push({ date: dateOf(doc.createdAt), kind: 'cree', label: 'Brouillon créé' });
    if (doc.fromQuoteNumber) ev.push({ date: doc.date, kind: 'devis', label: `Établi à partir du devis ${doc.fromQuoteNumber}`, id: doc.fromQuoteId });
    // Une facture née d'un contrat récurrent le disait nulle part : on retrouve le contrat d'origine,
    // et la ligne est cliquable comme celle d'un devis.
    if (doc.recurringId) {
      const rec = (data.recurring || []).find(r => r.id === doc.recurringId);
      ev.push({
        date: doc.date, kind: 'contrat', contractId: doc.recurringId,
        label: 'Générée par un contrat récurrent',
        detail: rec ? fillTemplate(rec.subject, { mois: monthLabel(doc.date), annee: (doc.date || '').slice(0, 4) }) : 'contrat supprimé depuis'
      });
    }
    // Pièce née d'une autre (proforma d'un devis, bon de livraison d'une commande…) : on le dit et on y renvoie.
    // (la ligne « Établi à partir du devis » ci-dessus couvre déjà le cas devis → facture : on ne la double pas)
    if (doc.fromDocId && !(doc.fromQuoteId === doc.fromDocId && doc.fromQuoteNumber)) ev.push({
      date: doc.date, kind: 'source', id: doc.fromDocId,
      label: `Établi à partir du ${(TITLES[doc.fromDocType] || 'document').toLowerCase()} ${doc.fromDocNumber || '(brouillon)'}`
    });
    if (doc.number && doc.status !== 'brouillon') ev.push({ date: doc.date, kind: 'emis', label: `${TITLES[doc.type]} ${doc.number} ${doc.type === 'facture' ? 'émise' : 'émis'}` });
    // Ce qui en découle : la proforma tirée du devis, le bon de livraison tiré de la commande, etc.
    derivedDocs(doc, data).forEach(d => ev.push({
      date: d.date, kind: 'derive', id: d.id,
      label: `${TITLES[d.type]} ${d.number || '(brouillon)'} établi${d.type === 'facture' || d.type === 'proforma' ? 'e' : ''} à partir de cette pièce`,
      detail: d.status === 'brouillon' ? 'pas encore émis' : ''
    }));
    (doc.attachments || []).forEach(a => ev.push({ date: a.date || '', kind: 'piece', label: 'Pièce jointe : ' + a.name, file: a.file }));
    // Côté devis : les factures qui en sont tirées (conversion, acompte, solde), même encore en brouillon
    if (doc.type === 'devis' && doc.id) (data.documents || []).filter(d => d.type === 'facture' && d.fromQuoteId === doc.id).forEach(inv => {
      const what = inv.deposit ? `Facture d'acompte ${inv.deposit.percent} %` : inv.settles ? 'Facture de solde' : 'Facture';
      ev.push({ date: inv.date, kind: 'facture', label: `${what} ${inv.number || '(brouillon)'} établie`, detail: inv.status === 'brouillon' ? 'pas encore émise' : '', id: inv.id });
    });
    (doc.emails || []).forEach(e => ev.push({
      date: e.date, kind: /^relance/.test(e.kind) ? 'relance' : 'email',
      label: /^relance/.test(e.kind) ? (REMINDER_LABELS[Number(e.kind.slice(-1))] || 'Relance') + ' par email' : 'Envoyé par email',
      detail: e.to || ''
    }));
    (doc.reminders || []).filter(r => r.channel && r.channel !== 'email').forEach(r => ev.push({
      date: r.date, kind: 'relance', label: (REMINDER_LABELS[r.level] || 'Relance') + ' par téléphone', detail: r.note || ''
    }));
    (doc.payments || []).forEach(p => {
      const m = PAYMENT_METHODS.find(x => x[0] === p.method);
      ev.push({ date: p.date, kind: 'paiement', label: `Paiement de ${money(p.amount, doc.currency || company.currency)}`, detail: [m ? m[1] : p.method, p.reference].filter(Boolean).join(' · ') });
    });
    if (doc.remindAfter) ev.push({ date: doc.remindAfter, kind: 'report', label: 'Ne pas relancer avant cette date' });
    if (doc.type === 'facture') creditsFor(data, doc.id).forEach(a => ev.push({ date: a.date, kind: 'avoir', label: `Avoir ${a.number}`, detail: a.creditReason || '', id: a.id }));
    if (doc.withholdingCertificate) ev.push({ date: '', kind: 'attestation', label: 'Attestation de retenue à la source reçue' });
    if (doc.status === 'annulée') ev.push({ date: '', kind: 'annule', label: 'Facture marquée annulée' });
    return ev.filter(e => e.date !== undefined).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  }

  // ---------- emails ----------

  const DEFAULT_EMAIL_TEMPLATES = {
    devis: { subject: 'Devis {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre devis {numero} ({montant} TTC) concernant : {objet}.\nIl est valable jusqu\'au {echeance}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n{societe}' },
    facture: { subject: 'Facture {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre facture {numero} d\'un montant de {montant} TTC, à régler avant le {echeance}.\n\nMerci de votre confiance.\n\nCordialement,\n{societe}' },
    avoir: { subject: 'Avoir {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint l\'avoir {numero} ({montant}) relatif à la facture {reference}.\n\nCordialement,\n{societe}' },
    relance1: { subject: 'Rappel — facture {numero}', body: 'Bonjour,\n\nSauf erreur de notre part, la facture {numero} ({montant}) arrivée à échéance le {echeance} reste en attente de règlement.\nSi le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.\n\nCordialement,\n{societe}' },
    relance2: { subject: 'Relance — facture {numero} en retard de {jours} jours', body: 'Bonjour,\n\nNotre facture {numero} d\'un montant de {montant}, échue le {echeance}, n\'a pas été réglée à ce jour ({jours} jours de retard).\nMerci de procéder au règlement dans les meilleurs délais ou de nous indiquer la date prévue.\n\nCordialement,\n{societe}' },
    relance3: { subject: 'Dernière relance — facture {numero}', body: 'Bonjour,\n\nMalgré nos précédents rappels, la facture {numero} ({montant}, échue le {echeance}) reste impayée après {jours} jours.\nSans règlement sous 8 jours, nous serons contraints d\'engager une procédure de recouvrement.\n\nCordialement,\n{societe}' },
    relanceDevis: { subject: 'Notre devis {numero} — {objet}', body: 'Bonjour,\n\nNous vous avons adressé le devis {numero} ({montant} TTC) concernant : {objet}.\nAvez-vous pu l\'examiner ? Nous restons disponibles pour en discuter ou l\'ajuster si besoin.\n\nCordialement,\n{societe}' },
    comptable: { subject: 'Comptabilité {objet} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint le journal des ventes de {objet} : {numero} document(s), {montant} de chiffre d\'affaires hors taxes.\n\nJe reste à votre disposition pour tout complément.\n\nCordialement,\n{societe}' },
    proforma: { subject: 'Facture proforma {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre facture proforma {numero} d\'un montant de {montant}, concernant : {objet}.\nCe document est établi pour vos démarches : il n\'a pas de valeur comptable et sera suivi d\'une facture définitive.\n\nCordialement,\n{societe}' },
    commande: { subject: 'Bon de commande {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint le bon de commande {numero} ({montant} TTC) reprenant votre demande concernant : {objet}.\nMerci de nous le retourner daté et signé pour que nous lancions l\'exécution.\n\nCordialement,\n{societe}' },
    livraison: { subject: 'Bon de livraison {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint le bon de livraison {numero} concernant : {objet}.\nMerci de nous le retourner signé après réception.\n\nCordialement,\n{societe}' },
    contrat: { subject: 'Contrat de prestation {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre contrat de prestation {numero} concernant : {objet}.\nAprès lecture, merci de nous le retourner daté, signé et revêtu de votre cachet.\n\nNous restons à votre disposition pour en discuter les termes.\n\nCordialement,\n{societe}' }
  };

  const DEFAULT_EMAIL_TEMPLATES_EN = {
    devis: { subject: 'Quote {numero} — {societe}', body: 'Hello,\n\nPlease find attached our quote {numero} ({montant} incl. VAT) for: {objet}.\nIt is valid until {echeance}.\n\nWe remain at your disposal for any question.\n\nBest regards,\n{societe}' },
    facture: { subject: 'Invoice {numero} — {societe}', body: 'Hello,\n\nPlease find attached our invoice {numero} for {montant}, due by {echeance}.\n\nThank you for your trust.\n\nBest regards,\n{societe}' },
    avoir: { subject: 'Credit note {numero} — {societe}', body: 'Hello,\n\nPlease find attached credit note {numero} ({montant}) related to invoice {reference}.\n\nBest regards,\n{societe}' },
    relance1: { subject: 'Reminder — invoice {numero}', body: 'Hello,\n\nUnless we are mistaken, invoice {numero} ({montant}) due on {echeance} is still awaiting payment.\nIf you have already paid, please disregard this message.\n\nBest regards,\n{societe}' },
    relance2: { subject: 'Second reminder — invoice {numero} is {jours} days overdue', body: 'Hello,\n\nOur invoice {numero} for {montant}, due on {echeance}, remains unpaid ({jours} days overdue).\nPlease proceed with payment as soon as possible or let us know the expected date.\n\nBest regards,\n{societe}' },
    relance3: { subject: 'Final reminder — invoice {numero}', body: 'Hello,\n\nDespite our previous reminders, invoice {numero} ({montant}, due on {echeance}) remains unpaid after {jours} days.\nWithout payment within 8 days, we will have to start a recovery procedure.\n\nBest regards,\n{societe}' },
    relanceDevis: { subject: 'Our quote {numero} — {objet}', body: 'Hello,\n\nWe sent you quote {numero} ({montant} incl. VAT) for: {objet}.\nHave you had a chance to review it? We remain available to discuss or adjust it.\n\nBest regards,\n{societe}' },
    comptable: { subject: 'Accounting {objet} — {societe}', body: 'Hello,\n\nPlease find attached the sales journal for {objet}.\n\nBest regards,\n{societe}' }
  };

  function emailFor(kind, doc, client, company, extra) {
    const en = (doc.lang || (client && client.lang) || company.defaultLang) === 'en';
    const templates = en ? { ...DEFAULT_EMAIL_TEMPLATES_EN, ...(company.emailTemplatesEn || {}) } : { ...DEFAULT_EMAIL_TEMPLATES, ...(company.emailTemplates || {}) };
    const tpl = templates[kind] || templates.facture;
    const t = computeTotals(doc, company);
    const cur = doc.currency || company.currency || 'DT';
    const vars = {
      numero: doc.number || 'brouillon', objet: doc.subject || '', client: (client || {}).name || '', societe: company.name,
      montant: money(doc.type === 'devis' ? t.totalTTC : t.netToPay, cur), echeance: fmtDate(doc.dueDate), reference: doc.creditOfNumber || doc.reference || '',
      ...(extra || {})
    };
    return { to: (client || {}).email || '', subject: fillTemplate(tpl.subject, vars), body: fillTemplate(tpl.body, vars) };
  }

  // ---------- montant en lettres (français) ----------

  const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  function below100(n) {
    if (n < 20) return UNITS[n];
    const t = Math.floor(n / 10), u = n % 10;
    if (t === 7 || t === 9) {
      const rest = UNITS[10 + u];
      return TENS[t] + (u === 1 && t === 7 ? ' et ' : '-') + rest;
    }
    if (u === 0) return TENS[t] + (t === 8 ? 's' : '');
    if (u === 1 && t !== 8) return TENS[t] + ' et un';
    return TENS[t] + '-' + UNITS[u];
  }

  function below1000(n) {
    const h = Math.floor(n / 100), r = n % 100;
    let s = '';
    if (h === 1) s = 'cent';
    else if (h > 1) s = UNITS[h] + ' cent' + (r === 0 ? 's' : '');
    if (r) s += (s ? ' ' : '') + below100(r);
    return s;
  }

  function intToWords(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zéro';
    const parts = [];
    const scales = [[1e9, 'milliard', 'milliards'], [1e6, 'million', 'millions'], [1e3, 'mille', 'mille']];
    for (const [val, sing, plur] of scales) {
      if (n >= val) {
        const q = Math.floor(n / val);
        n %= val;
        if (val === 1e3 && q === 1) parts.push('mille');
        else parts.push(below1000(q) + ' ' + (q > 1 ? plur : sing));
      }
    }
    if (n) parts.push(below1000(n));
    return parts.join(' ');
  }

  // ---------- montant en lettres (anglais) ----------

  const UNITS_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function below1000En(n) {
    const h = Math.floor(n / 100), r = n % 100;
    let s = h ? UNITS_EN[h] + ' hundred' : '';
    if (r) s += (s ? ' and ' : '') + (r < 20 ? UNITS_EN[r] : TENS_EN[Math.floor(r / 10)] + (r % 10 ? '-' + UNITS_EN[r % 10] : ''));
    return s;
  }
  function intToWordsEn(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zero';
    const parts = [];
    [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']].forEach(([val, name]) => { if (n >= val) { parts.push(below1000En(Math.floor(n / val)) + ' ' + name); n %= val; } });
    if (n) parts.push(below1000En(n));
    return parts.join(' ');
  }

  // Unités monétaires : [singulier, pluriel, sous-unité singulier, pluriel, diviseur]
  const CURRENCY_WORDS = {
    fr: { DT: ['dinar', 'dinars', 'millime', 'millimes', 1000], TND: ['dinar', 'dinars', 'millime', 'millimes', 1000], EUR: ['euro', 'euros', 'centime', 'centimes', 100], USD: ['dollar', 'dollars', 'cent', 'cents', 100], GBP: ['livre', 'livres', 'penny', 'pence', 100], CHF: ['franc', 'francs', 'centime', 'centimes', 100], MAD: ['dirham', 'dirhams', 'centime', 'centimes', 100], DZD: ['dinar', 'dinars', 'centime', 'centimes', 100] },
    en: { DT: ['dinar', 'dinars', 'millime', 'millimes', 1000], TND: ['dinar', 'dinars', 'millime', 'millimes', 1000], EUR: ['euro', 'euros', 'cent', 'cents', 100], USD: ['dollar', 'dollars', 'cent', 'cents', 100], GBP: ['pound', 'pounds', 'penny', 'pence', 100], CHF: ['franc', 'francs', 'centime', 'centimes', 100], MAD: ['dirham', 'dirhams', 'centime', 'centimes', 100], DZD: ['dinar', 'dinars', 'centime', 'centimes', 100] }
  };

  function amountToWords(amount, currency, lang) {
    const cur = currency || 'DT';
    const en = lang === 'en';
    const w = (CURRENCY_WORDS[en ? 'en' : 'fr'][cur]) || [cur, cur, en ? 'cent' : 'centime', en ? 'cents' : 'centimes', 100];
    const v = round3(Math.abs(amount));
    const d = Math.floor(v);
    const m = Math.round((v - d) * w[4]);
    const words = en ? intToWordsEn : intToWords;
    let s = words(d) + ' ' + (d > 1 ? w[1] : w[0]);
    if (m) s += (en ? ' and ' : ' et ') + words(m) + ' ' + (m > 1 ? w[3] : w[2]);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- template HTML (aperçu + PDF) ----------

  const I18N = {
    fr: {
      devis: 'Devis', facture: 'Facture', avoir: 'Avoir', issuedF: 'Émise le', issued: 'Émis le', dueBy: 'À régler avant le', validUntil: 'Valable jusqu\'au',
      deposit: 'Acompte', depositOf: '% du devis', balance: 'Solde', balanceOf: 'du devis', afterQuote: 'Suite au devis', reference: 'Référence', cancels: 'Annule / rectifie',
      billedTo: 'Facturé à', preparedFor: 'Préparé pour', client: 'Client', subject: 'Objet', designation: 'Désignation', qty: 'Qté', unitPrice: 'Prix unit. HT', vat: 'TVA', lineTotal: 'Total HT',
      payment: 'Règlement', bank: 'Banque', rib: 'RIB', motif: 'Motif', creditText: n => `Cet avoir vient en déduction de la facture ${n}`, conditions: 'Conditions', validText: d => `Devis valable jusqu'au ${d}.`,
      subtotal: 'Total HT', discount: 'Remise', netHT: 'Net HT', on: 'sur', stamp: 'Timbre fiscal', totalTTC: 'Total TTC', withholding: 'Retenue à la source', netToPay: 'Net à payer', creditAmount: 'Montant de l\'avoir',
      wordsInvoice: 'Arrêtée la présente facture à la somme de', wordsCredit: 'Arrêté le présent avoir à la somme de', wordsQuote: 'Arrêté le présent devis à la somme de', wordsDoc: 'Arrêté le présent document à la somme de',
      approve: 'Bon pour accord', approveSub: 'Date, signature et cachet du client', stampSign: 'Cachet et signature', provider: 'Le prestataire', draft: 'Brouillon', paid: 'Payée', cancelled: 'Annulée', mf: 'MF', mfCin: 'MF / CIN', rate: 'Taux',
      proforma: 'Facture proforma', commande: 'Bon de commande', livraison: 'Bon de livraison', contrat: 'Contrat de prestation',
      established: 'Établi le', orderedOn: 'Commandé le', deliveredOn: 'Livré le', signedOn: 'Signé le', from: 'Suite à',
      proformaNote: 'Document sans valeur comptable. Il ne remplace pas une facture et ne donne lieu à aucune déclaration de TVA.',
      orderNote: 'Bon de commande établi d\'après votre demande. Merci de nous le retourner daté et signé pour lancer l\'exécution.',
      deliveryNote: 'Marchandises et prestations livrées au client. À signer à la réception.',
      received: 'Reçu conforme', receivedSub: 'Date, nom et signature du réceptionnaire',
      orderApprove: 'Bon pour commande', contractClient: 'Le client', contractProvider: 'Le prestataire',
      contractSub: 'Lu et approuvé, date et signature', contractIntro: 'Entre les soussignés', totalNoTax: 'Total HT'
    },
    en: {
      devis: 'Quote', facture: 'Invoice', avoir: 'Credit note', issuedF: 'Issued on', issued: 'Issued on', dueBy: 'Due by', validUntil: 'Valid until',
      deposit: 'Deposit', depositOf: '% of quote', balance: 'Balance', balanceOf: 'of quote', afterQuote: 'Following quote', reference: 'Reference', cancels: 'Cancels / corrects',
      billedTo: 'Billed to', preparedFor: 'Prepared for', client: 'Client', subject: 'Subject', designation: 'Description', qty: 'Qty', unitPrice: 'Unit price', vat: 'VAT', lineTotal: 'Total excl. VAT',
      payment: 'Payment', bank: 'Bank', rib: 'Account (RIB)', motif: 'Reference', creditText: n => `This credit note is deducted from invoice ${n}`, conditions: 'Terms', validText: d => `This quote is valid until ${d}.`,
      subtotal: 'Subtotal excl. VAT', discount: 'Discount', netHT: 'Net excl. VAT', on: 'on', stamp: 'Stamp duty', totalTTC: 'Total incl. VAT', withholding: 'Withholding tax', netToPay: 'Amount due', creditAmount: 'Credit amount',
      wordsInvoice: 'Total amount in words:', wordsCredit: 'Total amount in words:', wordsQuote: 'Total amount in words:', wordsDoc: 'Total amount in words:',
      approve: 'Approved — signature', approveSub: 'Date, signature and stamp of the client', stampSign: 'Stamp and signature', provider: 'Provider', draft: 'Draft', paid: 'Paid', cancelled: 'Cancelled', mf: 'Tax ID', mfCin: 'Tax ID', rate: 'Rate',
      proforma: 'Proforma invoice', commande: 'Purchase order', livraison: 'Delivery note', contrat: 'Service agreement',
      established: 'Issued on', orderedOn: 'Ordered on', deliveredOn: 'Delivered on', signedOn: 'Signed on', from: 'Following',
      proformaNote: 'This document has no accounting value. It does not replace an invoice and is not subject to VAT reporting.',
      orderNote: 'Purchase order drawn up from your request. Please return it dated and signed so we can proceed.',
      deliveryNote: 'Goods and services delivered to the client. To be signed on receipt.',
      received: 'Received in good order', receivedSub: 'Date, name and signature of the recipient',
      orderApprove: 'Approved — order', contractClient: 'The client', contractProvider: 'The provider',
      contractSub: 'Read and approved, date and signature', contractIntro: 'Between the undersigned', totalNoTax: 'Total excl. VAT'
    }
  };

  function documentHtml(doc, client, company, opts) {
    opts = opts || {};
    const t = computeTotals(doc, company);
    const lang = (doc.lang || company.defaultLang) === 'en' ? 'en' : 'fr';
    const L = I18N[lang];
    const cur = doc.currency || company.currency || 'DT';
    const dec = decimalsFor(cur);
    const fmt = n => money(n, null, dec, lang);
    const isInvoice = doc.type === 'facture';
    const isCredit = doc.type === 'avoir';
    const isQuote = doc.type === 'devis';
    const isProforma = doc.type === 'proforma';
    const isOrder = doc.type === 'commande';
    const isDelivery = doc.type === 'livraison';
    const isContract = doc.type === 'contrat';
    // Le bon de livraison accompagne la marchandise : par défaut il ne porte aucun prix.
    const noPrices = isDelivery && doc.hidePrices !== false;
    const clauses = isContract ? { ...DEFAULT_CLAUSES, ...(doc.clauses || {}) } : null;
    const title = L[doc.type] || 'Document';
    const cl = client || {};
    const ink = company.primaryColor || '#1b2430';
    const accent = company.accentColor || '#0f9d8f';
    const numberText = doc.number || L.draft;
    const stampKey = opts.stamp || ({ 'Payée': 'paid', 'Annulée': 'cancelled', 'Brouillon': 'draft' })[opts.stampText] || (opts.stampText ? 'custom' : (!isQuote && !isContract && doc.status === 'brouillon' ? 'draft' : null));
    const stampText = stampKey === 'custom' ? opts.stampText : (stampKey ? L[stampKey] : '');
    const multiVat = Object.keys(t.vatByRate).length > 1;
    const pct = n => String(n).replace('.', lang === 'en' ? '.' : ',');
    const foreign = cur !== (company.currency || 'DT') && Number(doc.exchangeRate) > 0;

    // teinte claire dérivée de l'accent (mélange avec du blanc)
    const hex = accent.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const tint = (a) => `rgba(${r}, ${g}, ${b}, ${a})`;

    const linesHtml = t.lines.map((l) => `
      <tr>
        <td>
          <div class="lbl">${escapeHtml(l.label)}</div>
          ${l.description ? `<div class="desc">${nl2br(l.description)}</div>` : ''}
        </td>
        <td class="r num">${escapeHtml(String(l.qty).replace('.', lang === 'en' ? '.' : ','))}${l.unit ? `<span class="unit"> ${escapeHtml(l.unit)}</span>` : ''}</td>
        ${noPrices ? '' : `<td class="r num">${fmt(l.unitPrice)}</td>
        <td class="r num dim">${l.vatRate}%</td>
        <td class="r num strong">${fmt(l.ht)}</td>`}
      </tr>`).join('');

    const metaItems = isInvoice ? [
      [L.issuedF, fmtDate(doc.date)],
      [L.dueBy, fmtDate(doc.dueDate)],
      doc.deposit ? [L.deposit, `${pct(doc.deposit.percent)} ${L.depositOf} ${doc.deposit.quoteNumber}`] : (doc.settles ? [L.balance, `${L.balanceOf} ${doc.settles.quoteNumber}`] : (doc.fromQuoteNumber ? [L.afterQuote, doc.fromQuoteNumber] : null)),
      doc.reference ? [L.reference, doc.reference] : null
    ] : isCredit ? [
      [L.issued, fmtDate(doc.date)],
      doc.creditOfNumber ? [L.cancels, L.facture + ' ' + doc.creditOfNumber] : null,
      doc.reference ? [L.reference, doc.reference] : null
    ] : isProforma ? [
      [L.established, fmtDate(doc.date)],
      doc.dueDate ? [L.dueBy, fmtDate(doc.dueDate)] : null,
      doc.fromDocNumber ? [L.from, doc.fromDocNumber] : null,
      doc.reference ? [L.reference, doc.reference] : null
    ] : isOrder ? [
      [L.orderedOn, fmtDate(doc.date)],
      doc.fromDocNumber ? [L.from, doc.fromDocNumber] : null,
      doc.reference ? [L.reference, doc.reference] : null
    ] : isDelivery ? [
      [L.deliveredOn, fmtDate(doc.date)],
      doc.fromDocNumber ? [L.from, doc.fromDocNumber] : null,
      doc.reference ? [L.reference, doc.reference] : null
    ] : isContract ? [
      [L.established, fmtDate(doc.date)],
      doc.fromDocNumber ? [L.from, doc.fromDocNumber] : null,
      doc.reference ? [L.reference, doc.reference] : null
    ] : [
      [L.issued, fmtDate(doc.date)],
      [L.validUntil, fmtDate(doc.dueDate)],
      doc.reference ? [L.reference, doc.reference] : null
    ];
    if (foreign) metaItems.push([L.rate, `1 ${cur} = ${money(doc.exchangeRate, company.currency)}`]);
    const meta = metaItems.filter(Boolean).map(([k, v]) => `<div class="chip"><span class="ck">${escapeHtml(k)}</span><span class="cv">${escapeHtml(v)}</span></div>`).join('');

    const vatRows = multiVat ? Object.keys(t.vatByRate).sort((a, b) => a - b).map(rate =>
      `<tr><td>${L.vat} ${rate}% <span class="dim">${L.on} ${fmt(t.vatByRate[rate].base)}</span></td><td class="r num">${fmt(t.vatByRate[rate].vat)}</td></tr>`).join('')
      : `<tr><td>${L.vat}</td><td class="r num">${fmt(t.totalVAT)}</td></tr>`;

    const contact = [company.phone, company.email, company.website].filter(Boolean).map(escapeHtml).join('<br>');
    const clientContact = [cl.contact ? escapeHtml(cl.contact) : '', cl.matricule ? L.mfCin + ' ' + escapeHtml(cl.matricule) : '', cl.phone ? escapeHtml(cl.phone) : '', cl.email ? escapeHtml(cl.email) : ''].filter(Boolean).join('<br>');
    // Pied de page légal : le texte libre s'il est rempli, sinon composé du nom et du matricule
    const footerBase = company.footer || [company.name, company.matricule ? (lang === 'en' ? 'Tax ID ' : 'Matricule fiscal ') + company.matricule : ''].filter(Boolean).join(' — ');
    const legal = [footerBase, company.rc ? 'RC ' + company.rc : '', company.capital ? (lang === 'en' ? 'Share capital ' : 'Capital ') + company.capital : ''].filter(Boolean).join(' — ');
    const grandLabel = isInvoice || isProforma ? L.netToPay : isCredit ? L.creditAmount : L.totalTTC;
    const grandValue = isQuote || isOrder || isContract ? t.totalTTC : t.netToPay;
    const wordsIntro = isInvoice ? L.wordsInvoice : isCredit ? L.wordsCredit : isQuote ? L.wordsQuote : L.wordsDoc;
    // Un contrat porte un échéancier de prix, pas un montant à régler : la somme en toutes lettres n'y a pas sa place.
    const showWords = !isContract;
    const paymentTerms = lang === 'en' ? company.paymentTermsEn : company.paymentTerms;
    const quoteTerms = lang === 'en' ? company.quoteTermsEn : company.quoteTerms;

    return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8">
<title>${title} ${escapeHtml(numberText)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif; color: ${ink}; font-size: 9.5pt; line-height: 1.42; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 296mm; padding: 0 0 12mm; position: relative; background: #fff; overflow: hidden; }
  ${opts.preview ? 'html { zoom: ' + (opts.zoom || 0.5) + '; background: #e9edf1; } body { padding: 8mm 0; } .page { box-shadow: 0 4px 24px rgba(20,40,60,.12); margin: 0 auto; border-radius: 2mm; }' : ''}

  .num { font-variant-numeric: tabular-nums; }
  .mono { font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; font-size: 9pt; letter-spacing: .4px; }
  .dim { color: #8b95a3; }
  .strong { font-weight: 600; }
  .r { text-align: right; white-space: nowrap; }
  .k { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.6px; color: ${accent}; font-weight: 700; }

  /* bandeau clair */
  .hero { background: linear-gradient(135deg, ${tint(.14)} 0%, ${tint(.05)} 60%, #fff 100%); padding: 10mm 18mm 8mm; position: relative; }
  .hero::after { content: ""; position: absolute; right: -30mm; top: -30mm; width: 90mm; height: 90mm; border-radius: 50%; background: ${tint(.08)}; }
  .hero > * { position: relative; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand .logo { max-height: 16mm; max-width: 52mm; display: block; margin-bottom: 2.5mm; }
  .brand .name { font-size: 12.5pt; font-weight: 700; letter-spacing: -.1px; }
  .brand .tag { font-size: 8.5pt; color: #6b7684; margin-top: .5mm; }
  .brand .addr { font-size: 8.5pt; color: #6b7684; margin-top: 2mm; line-height: 1.35; }
  .title { text-align: right; }
  .title .kind { font-size: 30pt; font-weight: 200; letter-spacing: -1px; line-height: 1; color: ${ink}; }
  .title .number { display: inline-block; margin-top: 3mm; background: #fff; color: ${accent}; font-weight: 700; font-size: 9.5pt; letter-spacing: .5px; padding: 1.6mm 3.5mm; border-radius: 99px; box-shadow: 0 1px 4px rgba(20,40,60,.08); }
  .chips { display: flex; gap: 3mm; margin-top: 5mm; flex-wrap: wrap; }
  .chip { background: #fff; border-radius: 3mm; padding: 2mm 3.5mm; box-shadow: 0 1px 4px rgba(20,40,60,.06); }
  .chip .ck { display: block; font-size: 7pt; color: #8b95a3; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600; }
  .chip .cv { display: block; font-size: 10pt; font-weight: 600; margin-top: .4mm; }

  .inner { padding: 5mm 18mm 0; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; }
  .party { padding-left: 4mm; border-left: .7mm solid ${tint(.55)}; }
  .party .k { margin-bottom: 1.5mm; display: block; }
  .party .pname { font-size: 11pt; font-weight: 700; margin-bottom: .8mm; }
  .party .addr { color: #4b5563; }
  .party .more { color: #8b95a3; font-size: 9pt; margin-top: 1mm; }

  table.lines { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 4mm; }
  table.lines thead th { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7684; font-weight: 700; text-align: left; padding: 2.4mm 3mm; background: ${tint(.09)}; }
  table.lines thead th:first-child { border-radius: 2.5mm 0 0 2.5mm; }
  table.lines thead th:last-child { border-radius: 0 2.5mm 2.5mm 0; }
  table.lines thead th.r { text-align: right; }
  table.lines tbody td { padding: 2mm 3mm; border-bottom: .2mm solid #eceff3; vertical-align: top; }
  table.lines tbody tr:last-child td { border-bottom: none; }
  table.lines .lbl { font-weight: 600; }
  table.lines .desc { font-size: 8.8pt; color: #6b7684; margin-top: .6mm; line-height: 1.4; }
  table.lines .unit { color: #9aa3ae; font-size: 8.5pt; }

  .after { display: grid; grid-template-columns: ${noPrices ? '1fr' : '1fr 74mm'}; gap: 12mm; margin-top: 3mm; align-items: start; }
  .card { background: ${tint(.07)}; border-radius: 3.5mm; padding: 4mm 5mm; }
  table.totals { width: 100%; border-collapse: collapse; font-size: 9.4pt; }
  table.totals td { padding: .7mm 0; color: #4b5563; }
  table.totals td.r { color: ${ink}; }
  table.totals tr.sub td { border-top: .2mm solid ${tint(.35)}; padding-top: 1.6mm; font-weight: 600; }
  .grand { margin-top: 2mm; padding-top: 2.5mm; border-top: .3mm solid ${tint(.45)}; display: flex; justify-content: space-between; align-items: baseline; }
  .grand .gl { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px; color: ${accent}; }
  .grand .gv { font-size: 17pt; font-weight: 700; letter-spacing: -.4px; }
  .grand .gv small { font-size: 8.5pt; color: ${accent}; margin-left: 1.2mm; letter-spacing: .8px; font-weight: 700; }
  .words { margin-top: 2.5mm; font-size: 8.2pt; color: #6b7684; line-height: 1.45; }
  .words strong { color: ${ink}; font-weight: 600; }

  .info { font-size: 9pt; color: #4b5563; }
  .info .k { margin-bottom: 1.5mm; display: block; }
  .info .row { display: flex; gap: 4mm; padding: .6mm 0; }
  .info .row span:first-child { color: #8b95a3; min-width: 16mm; }
  .info .terms { margin-top: 1.2mm; color: #6b7684; }
  .info + .info, .notes { margin-top: 5mm; }
  .notes { font-size: 9pt; color: #4b5563; white-space: pre-line; line-height: 1.45; }

  .sign { display: flex; justify-content: ${isQuote || isOrder || isDelivery || isContract ? 'space-between' : 'flex-end'}; gap: 12mm; margin-top: 5mm; }
  /* clauses d'un contrat : de la lecture, pas un tableau — deux colonnes tiennent l'A4 sans rétrécir le texte */
  .clauses { column-count: 2; column-gap: 10mm; margin-top: 5mm; font-size: 8.5pt; color: #4b5563; line-height: 1.45; }
  .clauses .cl { break-inside: avoid; page-break-inside: avoid; margin-bottom: 3.5mm; }
  .clauses .cl-t { font-weight: 700; color: ${ink}; margin-bottom: .6mm; }
  .sign .s { width: 64mm; height: 15mm; border: .3mm dashed ${tint(.5)}; border-radius: 3.5mm; padding: 3mm 4mm; position: relative; }
  .sign .s small { display: block; color: #9aa3ae; font-size: 8pt; margin-top: .6mm; }
  .sign .s img { position: absolute; right: 3mm; top: 1.5mm; max-height: 12mm; max-width: 34mm; }

  .stamp { position: absolute; top: 62mm; right: 24mm; transform: rotate(-12deg); border: .8mm solid ${accent}; color: ${accent}; border-radius: 2mm; padding: 1.5mm 5mm; font-size: 18pt; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; opacity: .45; z-index: 2; }
  .stamp.draft { border-color: #9aa3ae; color: #9aa3ae; }

  .footer { position: absolute; left: 18mm; right: 18mm; bottom: 7mm; font-size: 7.6pt; color: #9aa3ae; display: flex; justify-content: space-between; gap: 6mm; border-top: .2mm solid #eceff3; padding-top: 2.5mm; }
  .footer .f-left { white-space: pre-line; }

  /* documents longs : pas de ligne coupée entre deux pages, en-tête du tableau répété */
  table.lines thead { display: table-header-group; }
  table.lines tr, .after, .sign, .card, .parties { break-inside: avoid; page-break-inside: avoid; }

  /* mode compact (fitToPage) : marges resserrées quand le contenu dépasse d'un peu la page, même design */
  .page.compact .hero { padding: 8mm 18mm 6mm; }
  .page.compact .chips { margin-top: 4mm; }
  .page.compact .inner { padding-top: 4mm; }
  .page.compact .parties { gap: 10mm; }
  .page.compact .party .pname { margin-bottom: .4mm; }
  .page.compact table.lines { margin-top: 3mm; }
  .page.compact table.lines tbody td { padding: 1.4mm 3mm; }
  .page.compact .after { margin-top: 2mm; }
  .page.compact .card { padding: 3mm 5mm; }
  .page.compact .info + .info, .page.compact .notes { margin-top: 3mm; }
  .page.compact .words { margin-top: 1.8mm; }
  .page.compact .clauses { margin-top: 3.5mm; font-size: 8pt; }
  .page.compact .clauses .cl { margin-bottom: 2.6mm; }
  /* Un contrat porte un tableau de prix ET sept clauses ET deux cases de signature : quand il ne tient pas,
     on resserre les clauses d'un cran de plus plutôt que de déborder de quelques millimètres sur une page
     presque vide. Au-delà, il fait légitimement deux pages — un contrat de deux pages n'a rien d'anormal. */
  .page.compact.t-contrat .clauses { font-size: 7.6pt; column-gap: 8mm; line-height: 1.38; }
  .page.compact.t-contrat .clauses .cl { margin-bottom: 2.2mm; }
  .page.compact.t-contrat .card { padding: 3mm 4mm; }
  .page.compact.t-contrat .notes { margin-top: 2mm; }
  .page.compact .sign { margin-top: 3.5mm; }
  .page.compact .sign .s { height: 13mm; }
  /* Seul le contrat a une légende longue (« Lu et approuvé, date et signature ») : sa case grandit pour
     ne pas déborder sur le pied de page. Les autres gardent une hauteur fixe, qui ne coûte rien en place. */
  .page.t-contrat .sign .s { height: auto; min-height: 15mm; }
  .page.compact.t-contrat .sign .s { height: auto; min-height: 13mm; }
</style></head>
<body><div class="page t-${escapeHtml(doc.type || 'devis')}">
  ${stampText ? `<div class="stamp${stampKey === 'draft' ? ' draft' : ''}">${escapeHtml(stampText)}</div>` : ''}
  <div class="hero">
    <div class="head">
      <div class="brand">
        ${company.logo ? `<img class="logo" src="${company.logo}" alt="">` : ''}
        <div class="name">${escapeHtml(company.name)}</div>
        ${company.tagline ? `<div class="tag">${escapeHtml(company.tagline)}</div>` : ''}
        <div class="addr">${nl2br(company.address)}<br>${L.mf} ${escapeHtml(company.matricule)}${contact ? '<br>' + contact : ''}</div>
      </div>
      <div class="title">
        <div class="kind">${title}</div>
        <div class="number">${escapeHtml(numberText)}</div>
      </div>
    </div>
    <div class="chips">${meta}</div>
  </div>

  <div class="inner">
    <div class="parties">
      <div class="party">
        <span class="k">${isInvoice || isProforma ? L.billedTo : isCredit || isDelivery || isContract ? L.client : L.preparedFor}</span>
        <div class="pname">${escapeHtml(cl.name || '')}</div>
        ${cl.address ? `<div class="addr">${nl2br(cl.address)}</div>` : ''}
        ${clientContact ? `<div class="more">${clientContact}</div>` : ''}
      </div>
      ${doc.subject ? `<div class="party"><span class="k">${L.subject}</span><div class="pname" style="font-weight:600;font-size:10.5pt">${escapeHtml(doc.subject)}</div></div>` : ''}
    </div>

    <table class="lines">
      <thead><tr>
        <th>${L.designation}</th>
        <th class="r" style="width:16mm">${L.qty}</th>
        ${noPrices ? '' : `<th class="r" style="width:26mm">${L.unitPrice}</th>
        <th class="r" style="width:12mm">${L.vat}</th><th class="r" style="width:28mm">${L.lineTotal}</th>`}
      </tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>

    <div class="after">
      <div>
        ${isInvoice && (company.rib || company.bank || paymentTerms) ? `
        <div class="info"><span class="k">${L.payment}</span>
          ${company.bank ? `<div class="row"><span>${L.bank}</span><span>${escapeHtml(company.bank)}</span></div>` : ''}
          ${company.rib ? `<div class="row"><span>${L.rib}</span><span class="mono">${escapeHtml(company.rib)}</span></div>` : ''}
          ${doc.number ? `<div class="row"><span>${L.motif}</span><span>${escapeHtml(doc.number)}</span></div>` : ''}
          ${paymentTerms ? `<div class="terms">${nl2br(paymentTerms)}</div>` : ''}
        </div>` : ''}
        ${isCredit ? `
        <div class="info"><span class="k">${L.avoir}</span>
          ${L.creditText(escapeHtml(doc.creditOfNumber || ''))}${doc.creditReason ? ' — ' + escapeHtml(doc.creditReason) : ''}.
        </div>` : ''}
        ${isQuote ? `
        <div class="info"><span class="k">${L.conditions}</span>
          ${L.validText(fmtDate(doc.dueDate))} ${escapeHtml(quoteTerms || '')}
        </div>` : ''}
        ${isProforma ? `
        <div class="info"><span class="k">${L.proforma}</span><div class="terms">${L.proformaNote}</div></div>
        ${company.rib || company.bank ? `<div class="info"><span class="k">${L.payment}</span>
          ${company.bank ? `<div class="row"><span>${L.bank}</span><span>${escapeHtml(company.bank)}</span></div>` : ''}
          ${company.rib ? `<div class="row"><span>${L.rib}</span><span class="mono">${escapeHtml(company.rib)}</span></div>` : ''}
        </div>` : ''}` : ''}
        ${isOrder ? `<div class="info"><span class="k">${L.commande}</span><div class="terms">${L.orderNote}</div></div>` : ''}
        ${isDelivery ? `<div class="info"><span class="k">${L.livraison}</span><div class="terms">${L.deliveryNote}</div></div>` : ''}
        ${doc.notes ? `<div class="notes">${nl2br(doc.notes)}</div>` : ''}
      </div>
      ${noPrices ? '' : `<div class="card">
        <table class="totals">
          <tr><td>${L.subtotal}</td><td class="r num">${fmt(t.totalHT)}</td></tr>
          ${t.discount ? `<tr><td>${L.discount} ${pct(t.discountRate)}%</td><td class="r num">− ${fmt(t.discount)}</td></tr><tr><td>${L.netHT}</td><td class="r num">${fmt(t.netHT)}</td></tr>` : ''}
          ${vatRows}
          ${t.stamp ? `<tr><td>${L.stamp}</td><td class="r num">${fmt(t.stamp)}</td></tr>` : ''}
          ${t.withholding ? `<tr class="sub"><td>${L.totalTTC}</td><td class="r num">${fmt(t.totalTTC)}</td></tr><tr><td>${L.withholding} ${pct(t.withholdingRate)}%</td><td class="r num">− ${fmt(t.withholding)}</td></tr>` : ''}
        </table>
        <div class="grand"><span class="gl">${grandLabel}</span><span class="gv num">${fmt(grandValue)}<small>${escapeHtml(cur)}</small></span></div>
        ${showWords ? `<div class="words">${wordsIntro} <strong>${escapeHtml(amountToWords(grandValue, cur, lang).toLowerCase())}</strong>.</div>` : ''}
      </div>`}
    </div>

    ${isContract ? `<div class="clauses">
      ${CLAUSE_LABELS.filter(([k]) => (clauses[k] || '').trim()).map(([k, label], i) =>
        `<div class="cl"><div class="cl-t">${i + 1}. ${escapeHtml(label)}</div><div class="cl-b">${nl2br(clauses[k])}</div></div>`).join('')}
    </div>` : ''}

    <div class="sign">
      ${isQuote ? `<div class="s"><span class="k">${L.approve}</span><small>${L.approveSub}</small></div>` : ''}
      ${isOrder ? `<div class="s"><span class="k">${L.orderApprove}</span><small>${L.approveSub}</small></div>` : ''}
      ${isDelivery ? `<div class="s"><span class="k">${L.received}</span><small>${L.receivedSub}</small></div>` : ''}
      ${isContract ? `<div class="s"><span class="k">${L.contractClient}</span><small>${escapeHtml(cl.name || '')} — ${L.contractSub}</small></div>` : ''}
      <div class="s"><span class="k">${isQuote || isContract ? L.provider : L.stampSign}</span><small>${escapeHtml(company.name)}</small>${company.stampImage ? `<img src="${company.stampImage}" alt="">` : ''}</div>
    </div>
  </div>

  <div class="footer">
    <div class="f-left">${nl2br(legal)}</div>
    <div>${title} ${escapeHtml(numberText)}</div>
  </div>
</div></body></html>`;
  }

  // À exécuter dans le document rendu (aperçu, fenêtre PDF) : si le contenu déborde de la page A4, passe en
  // mode compact (marges resserrées, même design) pour qu'un document de quatre ou cinq lignes tienne sur
  // une page. Renvoie true si le mode compact a été appliqué. Au-delà, le document fait légitimement deux pages.
  function fitToPage(d) {
    const page = d && d.querySelector && d.querySelector('.page');
    if (!page || page.classList.contains('compact')) return false;
    const probe = d.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;top:0;left:0;width:1px;height:296mm';
    page.appendChild(probe);
    let overflow = page.offsetHeight > probe.offsetHeight + 1;
    probe.remove();
    // Le pied de page est positionné en absolu : le contenu peut le chevaucher sans allonger la page.
    if (!overflow) {
      const foot = d.querySelector('.footer'), last = d.querySelector('.sign') || d.querySelector('.after');
      if (foot && last) overflow = last.getBoundingClientRect().bottom > foot.getBoundingClientRect().top;
    }
    if (overflow) page.classList.add('compact');
    return overflow;
  }

  // Nombre de pages A4 qu'occupera le document rendu (à exécuter dans le document, après fitToPage).
  function pageCount(d) {
    const page = d && d.querySelector && d.querySelector('.page');
    if (!page) return 1;
    const probe = d.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;top:0;left:0;width:1px;height:297mm';
    page.appendChild(probe);
    const n = Math.max(1, Math.ceil((page.offsetHeight - 2) / probe.offsetHeight));
    probe.remove();
    return n;
  }

  // ---------- unités de facturation ----------
  // Liste proposée dans les lignes de document et dans le catalogue. Elle couvre les métiers
  // courants ; une unité inhabituelle se saisit avec « Autre… » et rejoint ensuite la liste,
  // puisqu'on relit les unités déjà employées dans les données.
  const LINE_UNITS = [
    ['u', 'unité (u)'], ['h', 'heure (h)'], ['j', 'jour (j)'], ['demi-journée', 'demi-journée'],
    ['mois', 'mois'], ['an', 'année'], ['forfait', 'forfait'], ['intervention', 'intervention'],
    ['licence', 'licence'], ['abonnement', 'abonnement'], ['poste', 'poste'], ['lot', 'lot'],
    ['ml', 'mètre linéaire (ml)'], ['m²', 'mètre carré (m²)'], ['m³', 'mètre cube (m³)'],
    ['kg', 'kilogramme (kg)'], ['L', 'litre (L)'], ['km', 'kilomètre (km)'], ['page', 'page']
  ];
  // Unités déjà employées dans les documents et le catalogue, hors liste standard : elles restent
  // proposées d'une fois sur l'autre sans rien avoir à régler dans les paramètres.
  function usedUnits(data, extra) {
    const known = new Set(LINE_UNITS.map(u => u[0]));
    const out = [];
    const add = u => { u = (u || '').trim(); if (u && !known.has(u)) { known.add(u); out.push(u); } };
    (data && data.catalog || []).forEach(c => add(c.unit));
    (data && data.documents || []).forEach(d => (d.lines || []).forEach(l => add(l.unit)));
    (extra || []).forEach(add);
    return out.sort((a, b) => a.localeCompare(b, 'fr'));
  }

  // ---------- dates saisies à la main ----------
  const pad2 = n => String(n).padStart(2, '0');
  function isRealDate(y, m, d) {
    if (!(y >= 1900 && y <= 2999) || !(m >= 1 && m <= 12) || !(d >= 1)) return false;
    return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  function fmtDateInput(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  }
  // Comprend ce que l'utilisateur tape : 12/03/2026, 12-3-26, 12032026, 12/03 (année en cours),
  // 12 (mois en cours), ou une date ISO collée. Renvoie '' si la date n'existe pas (31/02).
  function parseDateInput(text, todayIso) {
    const s = String(text == null ? '' : text).trim();
    if (!s) return '';
    const ref = todayIso || today();   // date de référence pour les saisies partielles
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (iso) {
      const y = +iso[1], m = +iso[2], d = +iso[3];
      return isRealDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : '';
    }
    const digits = s.replace(/\D/g, '');
    let d, m, y;
    const parts = s.split(/[^\d]+/).filter(Boolean);
    if (parts.length >= 2) { d = +parts[0]; m = +parts[1]; y = parts.length > 2 ? +parts[2] : +ref.slice(0, 4); }
    else if (digits.length === 8) { d = +digits.slice(0, 2); m = +digits.slice(2, 4); y = +digits.slice(4); }
    else if (digits.length === 6) { d = +digits.slice(0, 2); m = +digits.slice(2, 4); y = 2000 + +digits.slice(4); }
    else if (digits.length === 4) { d = +digits.slice(0, 2); m = +digits.slice(2, 4); y = +ref.slice(0, 4); }
    else if (digits.length === 1 || digits.length === 2) { d = +digits; m = +ref.slice(5, 7); y = +ref.slice(0, 4); }
    else return '';
    if (y != null && y < 100) y += 2000;
    return isRealDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : '';
  }
  // Grille du mois pour le calendrier : six semaines de sept jours, lundi en tête.
  // Les jours débordant sur les mois voisins sont marqués `out` pour être affichés en gris.
  function monthMatrix(year, month) {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const shift = (first.getUTCDay() + 6) % 7;          // lundi = 0
    const start = new Date(Date.UTC(year, month - 1, 1 - shift));
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let i = 0; i < 7; i++) {
        const cur = new Date(start.getTime() + (w * 7 + i) * 86400000);
        const y = cur.getUTCFullYear(), m = cur.getUTCMonth() + 1, d = cur.getUTCDate();
        days.push({ iso: `${y}-${pad2(m)}-${pad2(d)}`, day: d, out: m !== month });
      }
      weeks.push(days);
    }
    return weeks;
  }

  // ---------- pagination et tri des listes ----------
  // Découpage d'une liste en pages. `size` à 0 (ou moins) = tout afficher.
  // Renvoie des bornes déjà corrigées : une page hors limites est ramenée dans l'intervalle,
  // ce qui évite l'écran vide quand un filtre réduit la liste alors qu'on est en page 5.
  function pageInfo(total, page, size) {
    total = Math.max(0, Math.floor(Number(total) || 0));
    size = Math.floor(Number(size) || 0);
    if (size <= 0) return { page: 1, pages: 1, size: 0, start: 0, end: total, from: total ? 1 : 0, to: total, total };
    const pages = Math.max(1, Math.ceil(total / size));
    const p = Math.min(Math.max(1, Math.floor(Number(page) || 1)), pages);
    const start = (p - 1) * size;
    const end = Math.min(total, start + size);
    return { page: p, pages, size, start, end, from: total ? start + 1 : 0, to: end, total };
  }

  // Comparaison générique pour le tri d'une colonne : nombres en numérique, textes en français
  // (« Élan » avant « Zone »), les valeurs vides toujours en fin de tri croissant.
  function compareValues(x, y) {
    const xEmpty = x == null || x === '', yEmpty = y == null || y === '';
    if (xEmpty || yEmpty) return xEmpty && yEmpty ? 0 : (xEmpty ? 1 : -1);
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x).localeCompare(String(y), 'fr', { numeric: true, sensitivity: 'base' });
  }

  return {
    VAT_RATES, WITHHOLDING_RATES, PAYMENT_METHODS, PREFIX, TITLES, DEFAULT_DATA, DEFAULT_COMPANY, ACTIVITIES, STATUSES, DISPLAY_STATUSES, STATUS_LABELS,
    pageInfo, compareValues, LINE_UNITS, usedUnits, parseDateInput, fmtDateInput, monthMatrix,
    uid, round3, money, fmtDate, addDays, daysInMonth, today, escapeHtml, nl2br, statusLabel,
    CLOSURE_ACTIONS, closedUntil, isClosedDate, closedPeriodLabel, closableMonths, closureChecks, closePeriod, reopenPeriod, closureLog,
    PACK_FORMAT, packPeriod, packPlan, packChecklist, packFileName, packCoverHtml,
    DEFAULT_ACCOUNTS, ACCOUNT_LABELS, ENTRY_JOURNALS, chartAccounts, journalEntries,
    entriesBalance, entriesByAccount, entryCsvColumns,
    salesCsvColumns, buyCsvColumns, payCsvColumns, supplierPayCsvColumns, cashCsvColumns,
    nextNumber, isLocked, isIssued, computeTotals, creditsFor, invoiceBalance, effectiveStatus,
    depositLines, settlementLines, salesJournal, vatSummary, paymentsJournal, toCsv, migrateData,
    PERIODS, MONTHS_FR, MONTHS_SHORT, monthLabel, addMonths, nextRecurrenceDate, dueRecurrences, catchUpRecurrence, fillTemplate, buildRecurringInvoice,
    reminderLevel, REMINDER_LABELS, daysBetween, overdueInvoices, todoList, companyGaps, documentHistory, DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES_EN, emailFor,
    CURRENCIES, decimalsFor, toBase, rateOf, missingRate, monthKeys, monthlySeries, topClients, quoteStats, avgPaymentDelay, clientSummary, I18N,
    EXTRA_TYPES, SALES_TYPES, CONVERSIONS, CONVERSION_LABELS, convertDoc, derivedDocs, DEFAULT_CLAUSES, CLAUSE_LABELS,
    PURCHASE_KINDS, LINE_DESTINATIONS, DEFAULT_EXPENSE_CATEGORIES, PURCHASE_STATUSES, expenseCategories,
    vatReturn, vatChain, DEFAULT_FISCAL_DEADLINES, fiscalDeadlines, nextDeadline, upcomingFiscal, simpleResult,
    ACCOUNT_KINDS, MOVE_KINDS, cashMovements, accountBalance, cashPosition, cashForecast, reconciliation,
    lineCost, documentMargin, marginBy, PROJECT_STATUSES, projectMargin, projectList, recurringProfitability,
    DEFAULT_FIXED_CATEGORIES, isFixedCategory, breakEven,
    DEFAULT_ASSET_CLASSES, assetClassLabel, assetClassYears, days360, assetSchedule, assetYear,
    assetCumulated, assetNBV, disposalResult, assetsList, assetTotals, assetsToCreate, depreciationFor,
    cappedCumulated,
    MOVE_SOURCES, moveSourceLabel, trackedItems, itemOfLine, stockMovements, runningStock, stockOf,
    stockList, stockTotals, stockJournal, inventoryDiff, stockAlerts, stockImpact, costOfGoodsSold,
    ocrNumber, ocrToPurchase,
    CONTRACT_TYPES, contractLabel, DEFAULT_PAYROLL, payrollSettings, irppAnnual, computePayslip,
    activeEmployees, payslipView, payslipsOf, payslipDate, payrollCost, payrollSummary, missingPayslips,
    payslipHtml,
    QUARTERS, quarterMonths, quarterLabel, cnssDeclaration, employerAnnual, socialDue,
    LEAVE_KINDS, leaveKindLabel, leaveIsPaid, workingDays, leaveDaysInMonth, leavesOf, leaveBalance,
    advancesOf, advanceBalance, payslipInputFor, HR_DOCS, hrDocLabel, hrDocumentHtml, staffRegister,
    SERIAL_STATUSES, serialStatusLabel, WARRANTY_CHOICES, serializedItems, warrantyEnd, serialView,
    serialList, availableSerials, clientFleet, warrantiesEnding, serialGap, serialGaps,
    mergeData, trackDeletion, MERGE_LISTS, LIST_LABELS,
    purchaseTotals, purchaseBalance, purchaseStatus, payablesList, purchaseJournal, purchaseSummary, supplierSummary, withholdingsToIssue, supplierPayments,
    periodBounds, issuedIn, salesTotals, revenueByMonth, topItems, clientMovement, AGING_BUCKETS, agedReceivables, payerRanking, quoteFunnel, objectiveProgress,
    amountToWords, intToWords, intToWordsEn, documentHtml, fitToPage, pageCount,
    MODULES, PAGES, moduleById, pageById, pageTitle, moduleCount, moduleOn, moduleWhy, navPages,
    MODULES_PAR_ACTIVITE, modulesSuggeres, wipeData, estDemo, firstSteps, liste, defaultVat, newLine
  };
});
