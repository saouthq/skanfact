// Logique métier partagée (calculs, numérotation, montants en lettres, template PDF, journal des ventes).
// Fonctionne dans le navigateur (window.SkanCore) et dans Node (module.exports) pour les tests.
//
// Depuis la 9.1.0, tout ce qui travaille sur des LIGNES d'écriture (et non sur `data`) vit dans
// `compta.js`, partagé avec l'application du cabinet : core.js le charge et en réexporte ce que ses
// appelants connaissaient déjà. Dans le navigateur, `compta.js` se charge donc AVANT core.js — un
// test relit les deux `index.html` et l'exige.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./compta'));
  else root.SkanCore = factory(root.SkanCompta);
})(typeof self !== 'undefined' ? self : this, function (Compta) {

  const VAT_RATES = [0, 7, 13, 19];
  // Taux de retenue à la source rencontrés en Tunisie. Ce sont des PROPOSITIONS, jamais une règle :
  // le taux applicable dépend de la nature de la prestation, du régime du client et de la loi de
  // finances de l'année — À VÉRIFIER avec le comptable. La liste a commencé à 1,5 % et un vrai
  // utilisateur s'est retrouvé bloqué parce que son client retient 1 % (8.3.0) : depuis, un taux
  // absent de la liste se saisit librement (« Autre taux… ») et rejoint les propositions, comme
  // pour les unités de ligne. Aucun calcul ne lit cette liste — elle ne remplit qu'un menu.
  const WITHHOLDING_RATES = [0, 0.5, 1, 1.5, 2.5, 3, 5, 10, 15, 20, 25];
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
    managerName: '',     // le gérant qui signe les documents du personnel (attestation, certificat)
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
    // Le MOYEN de paiement, pas son délai (10.12.0, H-E23) : la phrase disait « à réception de la
    // facture » pendant que la même facture imprime « À régler avant le … » à `paymentTermsDays`
    // jours. Deux délais sur une pièce légale, et c'était NOTRE défaut. Le délai s'imprime tout seul.
    paymentTerms: 'Paiement par virement bancaire.',
    quoteTerms: 'Pour accepter ce devis, retournez-le daté et signé avec la mention « Bon pour accord ».',
    paymentTermsEn: 'Payment by bank transfer.',
    quoteTermsEn: 'To accept this quote, please return it dated and signed with the mention "Approved".',
    currency: 'DT',
    defaultLang: 'fr',
    stampImage: '',       // cachet / signature (data URL) sur les documents
    theme: 'light',       // light | dark | auto
    tagline: '',
    accountantEmail: '',
    activity: '',         // secteur choisi à la première utilisation (voir ACTIVITIES)
    // Régime fiscal (7.22.0) : voir REGIMES. **Vide vaut « réel »**, donc assujetti à la TVA — une
    // installation antérieure n'a pas ce réglage et ne doit rien voir changer sur ses documents.
    taxRegime: '',
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

  // ---------- le régime fiscal (7.22.0) ----------
  //
  // Ce qui décide de la TVA, c'est le RÉGIME de l'entreprise, pas son métier. Jusqu'ici chaque
  // secteur portait une colonne `vat` : un taux deviné à partir de l'activité. C'était faux dans les
  // deux sens — un kinésithérapeute au réel facture de la TVA, un informaticien au forfaitaire n'en
  // facture pas — et ça se voyait sur la pièce officielle, pas dans une console.
  //
  // La colonne a donc disparu des métiers, et la question est posée une fois, en clair.
  // `tva: false` ne se contente pas de mettre les taux à zéro : la colonne TVA quitte le document,
  // et la mention légale qui la remplace s'imprime à sa place — une facture sans TVA et sans mention
  // n'est pas une facture allégée, c'est une facture incomplète.
  //
  // Les mentions sont celles de l'usage tunisien — **À VÉRIFIER avec ton comptable** : elles
  // dépendent de la forme juridique et de l'article invoqué, et l'application le dit à l'écran.
  const REGIMES = [
    {
      id: 'reel', label: 'Réel — assujetti à la TVA', court: 'Assujetti TVA', tva: true, mention: '',
      aide: 'Tu factures la TVA à tes clients, tu la déclares chaque mois et tu déduis celle de tes achats. C\'est le régime le plus courant dès qu\'on dépasse les seuils.'
    },
    {
      id: 'forfaitaire', label: 'Forfaitaire — non assujetti à la TVA', court: 'Forfaitaire', tva: false,
      mention: 'TVA non applicable — régime forfaitaire', mentionEn: 'VAT not applicable — flat-rate tax regime',
      aide: 'Tu ne factures pas de TVA et tu ne la déduis pas. Tes factures portent la mention « TVA non applicable » et ne montrent aucune colonne TVA.'
    },
    {
      id: 'exonere', label: 'Exonéré de TVA', court: 'Exonéré', tva: false,
      mention: 'TVA non applicable — activité exonérée', mentionEn: 'VAT not applicable — VAT-exempt activity',
      aide: 'Ton activité est exonérée de TVA. Tu ne la factures pas, et la mention d\'exonération remplace la colonne TVA sur tes documents.'
    }
  ];

  // Le régime d'une entreprise. **Vide vaut « réel »** : une installation qui existait avant la
  // 7.22.0 n'a pas ce réglage, et elle ne doit rien voir changer sur ses documents.
  function regimeOf(company) {
    const id = ((company || {}).taxRegime || '').trim();
    return REGIMES.find(r => r.id === id) || REGIMES[0];
  }
  // Le régime que le métier rend probable. Il ne s'impose jamais : c'est l'assistant qui le
  // présélectionne, et un choix fait à la main ne se fait plus écraser (même règle que la durée
  // d'amortissement proposée par la famille d'un bien, 3.5.0).
  //
  // Pourquoi il existe : avant la 7.22.0, `ACTIVITIES` portait un taux de TVA, et « Santé et
  // paramédical » valait 0 %. En remplaçant ce taux par un régime fiscal, cette connaissance-là a
  // disparu — et l'application proposait 19 % à un kinésithérapeute qui venait de déclarer son
  // métier à l'écran précédent. Retirer un mécanisme n'autorise pas à perdre ce qu'il savait.
  function regimeSuggere(activityId) {
    const a = ACTIVITIES.find(x => x.id === String(activityId || '').trim());
    return (a && a.regime) || '';
  }
  // La TFP PROPOSÉE pour un métier (9.1.1). Elle rend `null` pour tous, et c'est voulu : la colonne
  // `tfp` d'ACTIVITIES est vide tant que le comptable n'a pas dit quels métiers relèvent du taux
  // réduit des industries manufacturières. Un chiffre écrit ici sans lui serait une règle de droit
  // gravée dans le code — et il partirait sur les bulletins de quelqu'un.
  //
  // Un test exige que RIEN n'y figure : si on ajoute un `tfp:` sans retirer sa garde, il tombe.
  // C'est ce qui empêche d'inventer ce chiffre en passant.
  function tfpSuggere(activityId) {
    const a = ACTIVITIES.find(x => x.id === String(activityId || '').trim());
    const n = a && a.tfp;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  }
  // La seule question à poser au reste du code : cette entreprise facture-t-elle de la TVA ?
  function assujettiTVA(company) { return regimeOf(company).tva !== false; }
  // La mention qui REMPLACE la colonne TVA. Vide pour un assujetti : il a la colonne.
  // La mention se dit dans la langue de la pièce (10.14.1, MR-10) : « TVA non applicable » au milieu d'une
  // facture anglaise est une ligne que le client ne lit pas. Libellé anglais À VÉRIFIER avec le comptable.
  function mentionTVA(company, lang) { const r = regimeOf(company); return (lang === 'en' ? r.mentionEn : r.mention) || r.mention || ''; }
  // Le régime de TVA d'une pièce ÉMISE est celui du jour de son émission (10.14.1, MR-06) : il décide de
  // sa colonne TVA et de sa mention légale, et une pièce émise ne se réécrit pas (règle 7.1.x). Sans ça,
  // une facture émise au forfait réimprimée après le passage au réel perdait sa mention et gagnait une
  // colonne « TVA 0 % ». Un brouillon suit le régime du jour.
  function regimePourPiece(doc, company) {
    const d = doc || {};
    return d.regimeTva && d.status && d.status !== 'brouillon' ? { ...(company || {}), taxRegime: d.regimeTva } : (company || {});
  }

  // Secteurs proposés au premier démarrage : ils préremplissent le catalogue et le slogan.
  // Rien n'est imposé, tout se modifie ensuite.
  //
  // `honoraires: true` — profession libérale réglementée : sa facture s'appelle une **note
  //   d'honoraires**. C'est le nom que le client attend et que le comptable classe ; le type de la
  //   pièce, sa numérotation (FAC-) et sa valeur comptable ne changent pas d'un iota.
  // `comptant: true`  — on est payé sur place, en espèces ou par carte. Le RIB n'est alors pas
  //   réclamé comme un manque : on ne reproche pas à un restaurant de ne pas publier son RIB.
  // Plus de colonne `vat` : voir REGIMES ci-dessus.
  const ACTIVITIES = [
    {
      id: 'informatique', label: 'Informatique et cybersécurité', tagline: 'Cybersécurité · Infrastructure · Services informatiques',
      catalog: [
        ['Audit de sécurité réseau', 'Cartographie, scan de vulnérabilités, rapport et plan d\'action', 1200, 'forfait'],
        ['Maintenance et supervision', 'Surveillance des équipements, mises à jour, intervention sous 24 h', 250, 'mois'],
        ['Installation poste de travail', 'Préparation, sécurisation et mise en réseau d\'un poste', 120, 'u'],
        ['Sauvegarde externalisée', 'Sauvegarde chiffrée automatique avec vérification mensuelle', 90, 'mois'],
        ['Déplacement', 'Frais de déplacement', 60, 'u']
      ]
    },
    {
      id: 'batiment', label: 'Bâtiment et travaux', tagline: 'Construction · Rénovation · Second œuvre',
      catalog: [
        ['Main-d\'œuvre', 'Heure de travail sur chantier', 25, 'h'],
        ['Déplacement et installation de chantier', '', 150, 'forfait'],
        ['Fourniture de matériaux', 'Refacturation des matériaux, sur justificatifs', 0, 'lot'],
        ['Évacuation des gravats', '', 200, 'forfait']
      ]
    },
    {
      id: 'conseil', label: 'Conseil, formation et services', tagline: 'Conseil · Accompagnement · Formation',
      catalog: [
        ['Journée de conseil', 'Intervention sur site ou à distance', 600, 'jour'],
        ['Formation', 'Session pour un groupe, support fourni', 150, 'h'],
        ['Rédaction de livrable', 'Rapport, procédure, cahier des charges', 400, 'forfait'],
        ['Suivi mensuel', 'Point régulier et disponibilité par email', 300, 'mois']
      ]
    },
    {
      id: 'commerce', label: 'Commerce et vente de produits', tagline: '', comptant: true,
      catalog: [
        ['Produit', 'Désignation du produit vendu', 0, 'u'],
        ['Livraison', 'Frais de livraison', 15, 'u'],
        ['Installation / mise en service', '', 80, 'u']
      ]
    },
    {
      // `regime` est une PROPOSITION, pas une règle : l'assistant la présélectionne et l'utilisateur
      // reste libre d'en choisir une autre. Les actes médicaux et paramédicaux sont exonérés de TVA
      // en Tunisie — À VÉRIFIER avec le comptable, comme tout le reste de la fiscalité ici.
      id: 'sante', label: 'Santé et paramédical', tagline: '', honoraires: true, comptant: true, regime: 'exonere',
      catalog: [
        ['Consultation', '', 50, 'séance'],
        ['Séance de suivi', '', 40, 'séance'],
        ['Déplacement à domicile', '', 20, 'u']
      ]
    },
    {
      id: 'artisanat', label: 'Artisanat et création', tagline: 'Fait main · Sur mesure',
      catalog: [
        ['Pièce sur mesure', 'Création personnalisée', 0, 'u'],
        ['Main-d\'œuvre', 'Heure de travail en atelier', 20, 'h'],
        ['Matières premières', '', 0, 'lot']
      ]
    },
    {
      id: 'restauration', label: 'Restauration, café et traiteur', tagline: 'Cuisine · Service · Traiteur', comptant: true,
      catalog: [
        ['Menu du jour', 'Entrée, plat, dessert', 18, 'couvert'],
        ['Prestation traiteur', 'Sur devis, selon le nombre de convives', 35, 'couvert'],
        ['Location de salle', 'Demi-journée, mise en place comprise', 400, 'forfait'],
        ['Service et personnel', 'Serveur mis à disposition', 25, 'h']
      ]
    },
    {
      id: 'transport', label: 'Transport et logistique', tagline: 'Transport · Livraison · Stockage',
      catalog: [
        ['Course urbaine', 'Enlèvement et livraison dans le Grand Tunis', 25, 'course'],
        ['Transport longue distance', 'Facturé au kilomètre parcouru', 1.2, 'km'],
        ['Manutention', 'Chargement et déchargement', 20, 'h'],
        ['Stockage', 'Entreposage en dépôt', 8, 'm²']
      ]
    },
    {
      id: 'immobilier', label: 'Immobilier et gestion locative', tagline: 'Transaction · Gestion · Syndic',
      catalog: [
        ['Commission de transaction', 'Pourcentage du prix de vente, selon mandat', 0, 'forfait'],
        ['Gestion locative', 'Gestion mensuelle d\'un bien loué', 80, 'mois'],
        ['État des lieux', 'Entrée ou sortie, avec rapport photographique', 120, 'u'],
        ['Syndic de copropriété', 'Par lot et par mois', 15, 'mois']
      ]
    },
    {
      id: 'juridique', label: 'Professions juridiques', tagline: 'Conseil · Rédaction · Représentation', honoraires: true,
      catalog: [
        ['Consultation juridique', 'Rendez-vous au cabinet ou à distance', 150, 'h'],
        ['Rédaction d\'acte', 'Contrat, statuts, bail', 500, 'forfait'],
        ['Représentation en justice', 'Honoraires de plaidoirie, hors frais et débours', 0, 'forfait'],
        ['Frais et débours', 'Avancés pour le compte du client, sur justificatifs', 0, 'lot']
      ]
    },
    {
      id: 'comptabilite', label: 'Comptabilité et expertise', tagline: 'Tenue · Fiscalité · Conseil', honoraires: true,
      catalog: [
        ['Tenue de comptabilité', 'Saisie, lettrage et déclarations mensuelles', 350, 'mois'],
        ['Bilan annuel', 'États financiers et liasse fiscale', 1500, 'forfait'],
        ['Établissement des bulletins de paie', 'Par bulletin et par mois', 15, 'bulletin'],
        ['Assistance à contrôle fiscal', '', 200, 'h']
      ]
    },
    {
      id: 'architecture', label: 'Architecture et ingénierie', tagline: 'Conception · Études · Suivi de chantier', honoraires: true,
      catalog: [
        ['Esquisse et avant-projet', '', 2000, 'forfait'],
        ['Dossier de permis de bâtir', 'Pièces graphiques et écrites', 3500, 'forfait'],
        ['Suivi de chantier', 'Visite hebdomadaire et compte rendu', 500, 'mois'],
        ['Métré et étude technique', '', 120, 'h']
      ]
    },
    {
      id: 'communication', label: 'Communication, design et audiovisuel', tagline: 'Identité · Web · Image',
      catalog: [
        ['Identité visuelle', 'Logo, charte graphique et déclinaisons', 1800, 'forfait'],
        ['Site internet vitrine', 'Conception, intégration et mise en ligne', 3000, 'forfait'],
        ['Journée de tournage ou de prise de vue', 'Matériel et opérateur compris', 700, 'jour'],
        ['Gestion des réseaux sociaux', 'Publications et modération', 450, 'mois']
      ]
    },
    {
      id: 'beaute', label: 'Beauté et bien-être', tagline: 'Soins · Coiffure · Bien-être', comptant: true,
      catalog: [
        ['Coupe et coiffage', '', 35, 'séance'],
        ['Soin du visage', '', 60, 'séance'],
        ['Massage', 'Séance d\'une heure', 70, 'séance'],
        ['Forfait mariée', 'Essai, coiffure et maquillage le jour J', 350, 'forfait']
      ]
    },
    {
      id: 'automobile', label: 'Automobile et mécanique', tagline: 'Entretien · Réparation · Carrosserie', comptant: true,
      catalog: [
        ['Main-d\'œuvre atelier', 'Heure de travail', 35, 'h'],
        ['Vidange et filtres', 'Huile et filtres compris', 120, 'forfait'],
        ['Diagnostic électronique', '', 60, 'u'],
        ['Pièces détachées', 'Refacturation des pièces, sur justificatifs', 0, 'lot']
      ]
    },
    { id: 'autre', label: 'Autre activité', tagline: '', catalog: [] }
  ];

  // Une facture de profession libérale s'appelle une NOTE D'HONORAIRES. Ce n'est pas un type de
  // pièce en plus : même préfixe, même numérotation, même valeur comptable, même verrouillage à
  // l'émission. C'est le nom qu'attend le client et sous lequel le comptable la classe.
  // Le libellé se DÉDUIT du métier à l'affichage, il n'est pas figé sur la pièce : ce n'est pas un
  // montant, et changer de métier ne doit pas laisser derrière soi des pièces à deux noms.
  function estLiberal(company) {
    const a = ACTIVITIES.find(x => x.id === ((company || {}).activity || '').trim());
    return !!(a && a.honoraires);
  }
  function docLabel(type, company, lang) {
    if (type === 'facture' && estLiberal(company)) return lang === 'en' ? 'Fee note' : 'Note d\'honoraires';
    return TITLES[type] || 'Document';
  }

  // Le RIB n'est réclamé que si on attend un virement. Un restaurant, un salon de coiffure ou un
  // commerce sont payés sur place : leur reprocher un RIB manquant, c'est afficher « ta fiche est
  // incomplète » à quelqu'un qui n'a rien à corriger — et les avertissements qu'on ne peut pas
  // satisfaire, on cesse de les lire. Métier inconnu = on le réclame, comme avant.
  function ribAttendu(company) {
    const a = ACTIVITIES.find(x => x.id === ((company || {}).activity || '').trim());
    return !(a && a.comptant);
  }

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
      pages: ['compta'],
      // Les écrans de 8.8.0 → 9.0.0 (grand livre, balance, états financiers, livre-journal, OD,
      // lettrage) sont un SOUS-MODULE, pas un second module : `compta` existe depuis longtemps et
      // porte les journaux, la TVA, les clôtures et le paquet du comptable — tout ce qu'une PME
      // doit pouvoir faire sans rien payer de plus.
      //
      // Décision du 15/09/2026 (`DIRECTION.md`) : l'app entreprise s'arrête à la gestion, et cette
      // comptabilité-là devient une OPTION payante, masquée par défaut. Masquer, pas supprimer :
      // le moteur continue d'écrire le paquet du comptable, qui reste libre.
      sousModules: [{
        id: 'compta.livres',
        label: 'Grand livre, balance, états financiers',
        option: 'compta',
        defaut: false,
        onglets: ['grandlivre', 'balance', 'etats'],
        quoi: 'Grand livre, balance, livre-journal, états financiers. Option payante, incluse dans l\'essai. Tes écritures, ta TVA, tes clôtures et le paquet de ton comptable restent disponibles sans elle.'
      }] }
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
    { id: 'devis', titre: 'Devis', module: 'ventes', famille: 'Vendre',
      quoi: 'Proposer un prix à un client, avant de travailler.' },
    { id: 'factures', titre: 'Factures', module: 'ventes', famille: 'Vendre',
      quoi: 'Réclamer l\'argent du travail fait : la pièce officielle, numérotée et définitive.' },
    { id: 'relances', titre: 'Relances', module: 'ventes', famille: 'Vendre',
      quoi: 'Les factures en retard de paiement, et le message à envoyer pour chacune.' },
    { id: 'clients', titre: 'Clients', module: 'fichiers', famille: 'Vendre',
      quoi: 'Les gens et les entreprises à qui tu vends : coordonnées, historique, ce qu\'ils te doivent.' },
    { id: 'catalogue', titre: 'Catalogue', module: 'fichiers', famille: 'Vendre',
      quoi: 'Ce que tu vends, avec son prix : pour insérer une ligne dans un devis sans la retaper.' },
    // « Contrats » menait aux contrats RÉCURRENTS (les périodicités qui fabriquent des factures) ;
    // le contrat que le client signe est un onglet d'« Autres documents ». Quelqu'un qui veut
    // rédiger un contrat cliquait donc « Contrats », tombait sur des jours de facturation, et
    // concluait que SkanFact n'en fait pas. Deux libellés, et le mot « contrat » retrouve son sens.
    // `quoi` sur la PAGE : les entrées d'un même module partageaient l'infobulle du module, donc
    // trois pages de la famille « Piloter » affichaient au survol exactement la même phrase.
    { id: 'autres', titre: 'Proforma, bons et contrats', module: 'pieces', famille: 'Vendre',
      quoi: 'Proforma, bon de commande, bon de livraison, et le contrat que ton client signe.' },
    { id: 'contrats', titre: 'Facturation récurrente', module: 'pieces', famille: 'Vendre',
      quoi: 'Les factures qui se répètent toutes seules : abonnement, maintenance, forfait mensuel.' },
    { id: 'achats', titre: 'Achats', module: 'achats', famille: 'Acheter',
      quoi: 'Ce que tu dépenses, pièce par pièce, et la TVA que tu récupères dessus.' },
    { id: 'fournisseurs', titre: 'Fournisseurs', module: 'achats', famille: 'Acheter',
      quoi: 'Les gens à qui tu achètes, et ce que tu leur dois encore.' },
    { id: 'stock', titre: 'Stock', module: 'stock', famille: 'Acheter' },
    { id: 'garanties', titre: 'Garanties', module: 'stock', horsMenu: true },
    { id: 'immos', titre: 'Immobilisations', module: 'immos', famille: 'Acheter' },
    { id: 'tresorerie', titre: 'Trésorerie', module: 'pilotage', famille: 'Piloter',
      quoi: 'Ce que tu as vraiment en caisse et en banque, et si ça tiendra le mois prochain.' },
    { id: 'marges', titre: 'Marges', module: 'pilotage', famille: 'Piloter',
      quoi: 'Ce que chaque client et chaque prestation te rapporte vraiment, une fois les achats déduits.' },
    { id: 'stats', titre: 'Statistiques', module: 'pilotage', famille: 'Piloter',
      quoi: 'Ton chiffre d\'affaires dans le temps, comparé à l\'an dernier : ce qui monte, ce qui baisse.' },
    { id: 'paie', titre: 'Paie', module: 'paie', famille: 'Piloter' },
    { id: 'compta', titre: 'Comptabilité', module: 'compta', famille: 'Piloter' },
    { id: 'modules', titre: 'Tous les modules', module: null, horsMenu: true },
    // La page de l'ÉDITEUR de SkanFact (7.33.0) : les licences qu'il a émises. Hors menu ici parce
    // que sa présence dépend du POSTE (la clé privée existe-t-elle sur cet ordinateur ?), que la
    // barre ajoute elle-même quand c'est le cas — jamais d'un réglage du dossier.
    { id: 'licences', titre: 'Licences', module: null, horsMenu: true,
      quoi: 'Les licences SkanFact que tu as émises : à qui, quelle offre, jusqu\'à quand.' },
    { id: 'parametres', titre: 'Paramètres', module: null, pied: true },
    { id: 'aide', titre: 'Aide', module: null, pied: true }
  ];

  // ---------- le canal de mise à jour (7.25.0) ----------
  //
  // Une version de test porte un suffixe : `7.26.0-beta.1`. C'est le NUMÉRO qui dit ce qu'elle est,
  // rien d'autre — pas un drapeau posé à la construction, pas un réglage du dépôt, pas une case
  // cochée quelque part. Un drapeau s'oublie ; un numéro de version, non : il est écrit dans le
  // paquet, dans la release, dans l'écran des mises à jour et dans le nom du fichier téléchargé.
  //
  // electron-builder applique exactement la même règle : un numéro avec `-beta.1` produit
  // `beta.yml` / `beta-mac.yml` au lieu de `latest.yml`. Les deux moitiés du système lisent donc la
  // même source de vérité, et il n'y a aucun moyen de les désaccorder.
  function canalDe(version) {
    const m = /^\d+\.\d+\.\d+-([A-Za-z][A-Za-z0-9]*)/.exec(String(version || '').trim());
    return m ? m[1].toLowerCase() : 'latest';
  }
  function estBeta(version) { return canalDe(version) !== 'latest'; }

  // ---------- la pastille de licence (8.0.1) ----------
  //
  // Jusqu'à la 8.0.1, la pastille de la barre de gauche n'apparaissait qu'à SEPT jours de la fin de
  // l'essai. Pendant vingt-trois jours, une installation neuve n'affichait donc nulle part qu'elle
  // était en essai — ni même que SkanFact se paie : l'assistant se passe, et le panneau Paramètres →
  // L'application → Licence, personne ne l'ouvre sans raison. On l'apprenait le trente-et-unième
  // jour, en étant bloqué. Un essai dont personne ne sait qu'il court n'est pas un essai, c'est une
  // surprise — et c'est très exactement ce que tout le reste de l'application s'interdit.
  //
  // L'autre travers serait le nagware : un bandeau qui crie « 28 jours restants » tous les matins
  // cesse d'être lu, et emmène avec lui les messages qui comptent. D'où TROIS tons, et pas deux :
  //   calme  — l'essai court, on informe (gris discret, à côté du numéro de version) ;
  //   attire — il reste sept jours d'essai, ou quatorze sur une licence payante : il faut agir ;
  //   alerte — la création est bloquée.
  //
  // Pure et testée sans Electron : c'est la règle qui se teste, pas la forme du renderer.
  function pastilleLicence(lic, chemin) {
    const l = lic || {};
    const j = l.daysLeft;
    if (l.locked) return { show: true, ton: 'alerte', texte: (l.label || 'Licence requise') + ' — voir ' + (chemin || 'Paramètres → L\'application → Licence') };
    if (l.state === 'essai' && j != null) {
      const reste = `Essai — ${j} jour${j === 1 ? '' : 's'}`;
      return j <= 7
        ? { show: true, ton: 'attire', texte: reste + (j === 0 ? ' : dernier jour' : ' avant la fin') }
        : { show: true, ton: 'calme', texte: reste };
    }
    // Une licence payante qui se termine se dit ici aussi : sans ça, un client verrouillé un matin
    // n'aurait été prévenu nulle part ailleurs que dans un panneau qu'il n'ouvre jamais.
    if (l.state === 'active' && j != null && j <= 14) {
      return { show: true, ton: 'attire', texte: (l.label || '') + ' — pense à la renouveler' };
    }
    return { show: false, ton: '', texte: '' };
  }

  // ---------- l'empreinte d'un cabinet (8.1.0) ----------
  //
  // Une empreinte est le condensé SHA-256 de la clé publique du cabinet, réduit à vingt caractères
  // HEXADÉCIMAUX et groupé par quatre (`src/zip.js`, `keyFingerprint`) — assez court pour être dicté
  // au téléphone. Et c'est exactement pour ça qu'elle se trompe : elle arrive chez l'éditeur recopiée
  // d'un message, d'un appel ou d'une capture.
  //
  // Ce qu'on PEUT vérifier ici : la forme. Une empreinte mal recopiée ne désigne aucun cabinet, donc
  // la preuve du parrainage ne vaut rien et la remise n'est rattachable à personne — et ça ne se voit
  // jamais, parce que rien ne plante.
  // Ce qu'on ne peut PAS vérifier : qu'elle appartienne à un vrai cabinet. Il faudrait sa clé
  // publique, que l'éditeur n'a pas. L'écran doit le dire au lieu d'afficher un vert rassurant.
  //
  // La saisie est tolérante (minuscules, espaces, tirets absents ou en trop) mais la validation ne
  // l'est pas : on retire les SÉPARATEURS, puis on exige vingt caractères hexadécimaux. Retirer tout
  // ce qui n'est pas hexadécimal laisserait passer un « G » tapé à la place d'un « 6 » en décalant
  // tout le reste — la faute deviendrait invisible au lieu d'être signalée.
  function empreinteCabinet(txt) {
    const brut = String(txt == null ? '' : txt).trim();
    if (!brut) return { ok: false, valeur: '', raison: 'vide' };
    const nu = brut.replace(/[\s.:_-]/g, '').toUpperCase();
    if (!/^[0-9A-F]*$/.test(nu)) return { ok: false, valeur: brut, raison: 'caracteres' };
    if (nu.length !== 20) return { ok: false, valeur: brut, raison: nu.length < 20 ? 'courte' : 'longue', longueur: nu.length };
    return { ok: true, valeur: nu.match(/.{4}/g).join('-'), raison: '' };
  }

  // Les licences déjà émises qui portent cette empreinte : c'est la seule corroboration disponible
  // hors ligne. Un cabinet qui a déjà parrainé quelqu'un est un cabinet dont l'empreinte a déjà été
  // recopiée juste au moins une fois.
  function licencesDuCabinet(licences, empreinte, sauf) {
    const e = empreinteCabinet(empreinte);
    if (!e.ok) return [];
    // La licence du cabinet LUI-MÊME (9.4.0) porte aussi son empreinte — comme sujet, pas comme
    // parrainage. Elle ne compte pas parmi « les clients qu'il a amenés ».
    return (licences || []).filter(l => l && l.id !== sauf && l.type !== 'cabinet' && empreinteCabinet(l.cabinet).valeur === e.valeur);
  }

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
    else if (out.company) { rendreLesEmprunts(out.company); delete out.company.demo; }
    return out;
  }

  // Les champs que le jeu d'exemple a PRÊTÉS à une fiche société qui en avait déjà une.
  //
  // L'assistant invite explicitement à laisser le matricule fiscal et le RIB vides (« si tu ne l'as
  // pas encore, laisse vide »). L'exemple les remplissait alors avec les siens ; comme la raison
  // sociale, elle, était renseignée, la fiche n'était pas considérée comme empruntée et plus rien
  // ne les enlevait. Les trois contrôles de conformité — `companyGaps`, « Tes premiers pas »,
  // l'avertissement d'émission — ne regardent que la PRÉSENCE d'une valeur : ils annonçaient donc
  // en vert « tes documents sont en règle » sur un matricule fiscal inventé.
  function rendreLesEmprunts(company) {
    if (!company) return company;
    (company.demoFields || []).forEach(k => { company[k] = DEFAULT_COMPANY[k] !== undefined ? DEFAULT_COMPANY[k] : ''; });
    delete company.demoFields;
    return company;
  }

  // Le jeu d'exemple se reconnaît : sans ça, on ne peut ni le signaler à l'écran, ni proposer d'en
  // sortir, ni empêcher sa fausse identité de servir à une vraie facture.
  const estDemo = data => !!(data && data.demo);

  // Un jeu d'exemple est RELATIF à aujourd'hui, et il est enrichi de version en version. Personne ne
  // pense à l'effacer puis à le recharger : la décision se prend donc toute seule, et elle vit ici,
  // pure et testable, plutôt que dans la séquence de démarrage où rien ne peut la vérifier.
  //
  // Rend le MOTIF ('version' ou 'mois') ou une chaîne vide s'il n'y a rien à refaire. Ce n'est pas
  // elle qui sait s'il existe un exemple : l'appelant le sait, et lui seul.
  //
  // Le corps est identique à `exemplePerime` de src/cabinet/cabcore.js — les deux applications
  // doivent décider pareil, et aucune ne peut charger le module de l'autre. Un test compare les deux
  // corps caractère par caractère, comme pour `round3` et `pastille`.
  function exemplePerime(repere, version, mois) {
    if (!version) return '';
    const r = (repere && typeof repere === 'object') ? repere : {};
    if (!r.version || r.version !== version) return 'version';
    if (r.mois !== mois) return 'mois';
    return '';
  }

  // 10.14.0 — un mot de passe à confirmer : le verdict, ET la case qu'il faut montrer. « Les deux
  // mots de passe ne sont pas les mêmes » sur une confirmation VIDE disait faux : vu à la souris sur
  // le premier écran du Cabinet, la confirmation avait été tapée sur le bouton « Afficher », où Tab
  // pose le curseur, et le refus ne montrait aucune case. Une confirmation vide se NOMME, une
  // confirmation fausse aussi — et c'est elle qu'on refait, jamais le mot de passe qu'on vient de
  // choisir. `min` vient de l'appelant : c'est la seule chose que les deux applications ne partagent
  // pas (six caractères ici, huit pour le Cabinet, qui chiffre la comptabilité de soixante clients).
  //
  // Le corps est identique à `verdictMotDePasse` de src/cabinet/cabcore.js : les deux applications
  // refusent avec les mêmes mots, et un test compare les deux corps (comme `exemplePerime`).
  function verdictMotDePasse(motDePasse, confirmation, min) {
    const a = String(motDePasse || ''), b = String(confirmation || '');
    if (a.length < min) return { ok: false, champ: 'motDePasse', message: `Mot de passe : ${min} caractères au minimum.` };
    if (!b) return { ok: false, champ: 'confirmation', message: 'Retape le mot de passe dans la case de confirmation.' };
    if (a !== b) return { ok: false, champ: 'confirmation', message: 'La confirmation ne correspond pas au mot de passe : retape-la.' };
    return { ok: true, champ: '', message: '' };
  }

  // Le taux de TVA d'une ligne neuve. Il se règle dans Paramètres et l'assistant le pose à partir du
  // métier déclaré. `''`, `null` ou `undefined` = 19 % ; `0` est une valeur légitime (exonération),
  // d'où le test explicite plutôt qu'un `||`.
  function defaultVat(company) {
    // Une entreprise qui ne facture pas de TVA ne peut pas faire naître une ligne à 19 %. Le régime
    // tranche AVANT le réglage : sinon un forfaitaire qui change de régime après coup garderait un
    // « TVA des nouvelles lignes : 19 % » oublié dans ses réglages, et la première ligne tapée à la
    // main remettrait de la TVA sur une facture qui n'a pas le droit d'en porter.
    if (!assujettiTVA(company)) return 0;
    const v = (company || {}).defaultVatRate;
    if (v === '' || v === null || v === undefined) return 19;
    const n = Number(v);
    return VAT_RATES.includes(n) ? n : 19;
  }
  // Le seuil en dessous duquel une retenue à la source mérite une question (9.1.1). Il vaut **0**
  // tant que personne ne l'a réglé, et 0 veut dire « aucun seuil » : la valeur par défaut d'une
  // règle qu'on ne connaît pas est celle qui ne fait rien. Écrire 1 000 DT ici — le chiffre que
  // deux relectures extérieures proposaient — reviendrait à graver dans le code une règle de droit
  // que personne n'a confirmée, et à faire crier l'application sur des factures justes.
  //
  // Un seuil NÉGATIF est ignoré : c'est le seul cas que la garde protège vraiment, parce que
  // `Number('') === 0` rend l'assertion évidente inutile (leçon de la 8.3.0).
  function seuilRetenue(company) {
    const n = Number((company || {}).withholdingThreshold);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Une facture qui porte une retenue sous le seuil réglé (9.1.1). Le seuil est dans la devise de la
  // SOCIÉTÉ : la comparaison se fait sur le TTC CONVERTI (10.14.1, M-09 / DEV-11). Elle comparait le
  // TTC natif — une facture de 300 € (1 020 DT) passait « sous un seuil de 1 000 DT », et une de
  // 3 000 € ne l'était jamais sur un seuil en dinars. Sans taux saisi on ne compare rien : la pièce
  // ne peut pas être émise de toute façon (`missingRate`), et une comparaison à 1 pour 1 mentirait.
  function sousSeuilRetenue(doc, company) {
    const seuil = seuilRetenue(company);
    if (!(seuil > 0) || !doc || doc.type !== 'facture' || missingRate(doc, company)) return null;
    const t = computeTotals(doc, company);
    if (!(t.withholdingRate > 0)) return null;
    const ttcBase = toBase(doc, t.totalTTC, company);
    return ttcBase < seuil ? { seuil, ttc: t.totalTTC, ttcBase, taux: t.withholdingRate } : null;
  }

  // Une ligne de document neuve, avec le bon taux. Il y avait huit `vatRate: 19` écrits à la main.
  const newLine = (company, extra) => {
    const l = { label: '', description: '', qty: 1, unit: '', unitPrice: 0, vatRate: defaultVat(company), ...(extra || {}) };
    l.vatRate = tauxPourRegime(company, l.vatRate);
    return l;
  };
  // Le taux d'une ligne qui NAÎT d'un article du catalogue (10.14.0). Le catalogue garde le taux
  // d'avant un changement de régime : un forfaitaire qui ajoutait un article à 19 % facturait de la
  // TVA qu'il n'a pas le droit de facturer — c'est la règle de `defaultVat`, que le catalogue
  // contournait. Une ligne déjà écrite garde le sien (7.22.0).
  function tauxPourRegime(company, rate) {
    return assujettiTVA(company || {}) ? rate : 0;
  }
  // La TVA d'un ACHAT n'est récupérable que pour un assujetti (10.14.0). Un forfaitaire ou un exonéré
  // paie la TVA de ses fournisseurs et ne la déduit jamais : elle fait partie du coût. SkanFact la
  // déduisait quand même — 4366 débité, charge au HT, résultat trop beau de toute la TVA payée. La
  // pièce retient sa règle (`tvaRecuperable`, posée à la création et figée par la migration) : un
  // changement de régime ne réécrit pas les achats déjà déclarés (la règle 7.1.x des pièces).
  function tvaRecuperable(purchase, company) {
    const v = (purchase || {}).tvaRecuperable;
    return typeof v === 'boolean' ? v : assujettiTVA(company || {});
  }
  // La TVA d'une LIGNE d'achat entre-t-elle dans son coût ? Oui si la ligne est marquée non
  // déductible, ET si la pièce entière ne récupère pas la TVA. Le stock et le montant d'un bien
  // lisaient la case de la ligne seule : l'achat d'un forfaitaire entrait au 607 TVA comprise et
  // au stock hors TVA — deux valeurs pour la même marchandise.
  function tvaNonDeductible(line, purchase, company) {
    return (line || {}).deductible === false || !tvaRecuperable(purchase, company);
  }
  // Le taux d'une ligne d'ACHAT tirée du catalogue (10.14.0). Chez une entreprise qui ne facture pas
  // de TVA, le catalogue porte le taux FORCÉ de ses ventes (0 %) — pas celui de son fournisseur, qui
  // lui facture la TVA quand même. Recopier ce 0 sur l'achat oubliait la TVA payée : le coût de
  // l'article sortait hors taxe, alors qu'au forfait il la comprend. On propose le taux ordinaire,
  // celui qu'une ligne d'achat vide propose déjà ; la ligne reste modifiable, et c'est le taux écrit
  // par le fournisseur qui fait foi.
  function tauxAchatArticle(item, company) {
    const r = Number((item || {}).vatRate) || 0;
    if (r > 0 || assujettiTVA(company || {})) return r;
    return defaultVat({ ...(company || {}), taxRegime: 'reel' }) || defaultVat({ taxRegime: 'reel' });
  }
  // Les articles du catalogue à 0 % chez une entreprise qui facture la TVA (10.14.0). Tant qu'elle
  // était au forfait, chaque article naissait à 0 % — c'était le taux de ses ventes. Le jour où elle
  // passe au réel, ces articles faisaient naître des lignes sans TVA : la TVA collectée manquait sur
  // chaque facture tirée du catalogue, donc sur la déclaration, sans un mot. Un article à 0 % peut
  // aussi être vraiment exonéré : on le SIGNALE, avec le geste qui le corrige, on ne le change pas.
  // Rien à dire quand le taux des nouvelles lignes est lui-même 0 : il n'y a pas de taux à proposer.
  function articlesSansTva(data, company) {
    if (!assujettiTVA(company || {}) || !(defaultVat(company) > 0)) return [];
    return ((data || {}).catalog || []).filter(it => !(Number(it.vatRate) > 0));
  }
  // 10.14.1 (MR-02) — le jumeau d'`articlesSansTva` pour ce qui FABRIQUE des factures. Un contrat
  // récurrent ou un modèle né au forfait porte des lignes à 0 % : après le passage au réel, chaque
  // facture qu'il engendrait sortait sans la TVA due — 250 HT, 0 de TVA, tous les mois — et rien ne le
  // disait. Une ligne sans libellé ou de déduction d'acompte ne compte pas : elle ne facture rien.
  const ligneFactureeSansTva = l => !l.noDiscount && String(l.label || '').trim() && !(Number(l.vatRate) > 0);
  function sourcesSansTva(data, company) {
    if (!assujettiTVA(company || {}) || !(defaultVat(company) > 0)) return { contrats: [], modeles: [] };
    const aZero = x => (x.lines || []).some(ligneFactureeSansTva);
    return {
      contrats: ((data || {}).recurring || []).filter(r => r.active !== false && aZero(r)),
      modeles: ((data || {}).templates || []).filter(aZero)
    };
  }
  // Une facture dont AUCUNE ligne ne porte de TVA, chez une entreprise qui en facture par défaut : c'est
  // presque toujours une pièce tirée d'un devis, d'un contrat ou d'un modèle nés sous un autre régime.
  // Une ligne exonérée au milieu de lignes taxées ne dit rien (c'est légitime) ; une entreprise dont le
  // taux par défaut est 0 % vend sans TVA par choix, et n'est jamais avertie. Un avoir suit la facture
  // qu'il corrige : une facture exonérée donne un avoir exonéré, et le lui reprocher serait faux.
  function factureSansTvaSuspecte(doc, company) {
    if (!doc || doc.type !== 'facture') return false;
    if (!assujettiTVA(company || {}) || !(defaultVat(company) > 0)) return false;
    const facturees = (doc.lines || []).filter(l => !l.noDiscount && String(l.label || '').trim() && Number(l.qty) * Number(l.unitPrice) !== 0);
    return facturees.length > 0 && facturees.every(l => !(Number(l.vatRate) > 0));
  }
  // Les achats qui ne suivent pas le régime du jour et qu'on peut encore corriger (10.14.0) : figer la
  // règle protège une pièce déjà déclarée, mais quelqu'un qui avait laissé « réel » par erreur doit
  // pouvoir remettre ses achats d'aplomb. Jamais dans un mois clôturé (6.0.0). Un avoir ou un acompte
  // rattaché suit SA pièce : il n'est corrigé que si elle l'est. `tva` : la TVA déductible qui change.
  function achatsHorsRegime(data, company) {
    const cible = assujettiTVA(company || {});
    const tous = (data.purchases || []).filter(p => tvaRecuperable(p, company) !== cible && !isClosedDate(data, p.date));
    const candidats = new Set(tous.map(p => p.id));
    const byId = new Map((data.purchases || []).map(p => [p.id, p]));
    const pieces = tous.filter(p => !(p.achatLie && byId.has(p.achatLie)) || candidats.has(p.achatLie));
    // La TVA qui change se lit par la MÊME fonction que la déclaration, avant et après : additionner
    // les pièces une à une comptait un avoir dans le mauvais sens et la TVA qu'un acompte avait déjà
    // déduite — l'annonce disait 2 955 DT quand la déclaration bougeait de 2 720.
    if (!pieces.length) return { pieces, tva: 0, cible };
    const dates = pieces.map(p => String(p.date || '')).filter(Boolean).sort();
    const per = { from: dates[0] || '2000-01-01', to: dates[dates.length - 1] || '2999-12-31' };
    const ids = new Set(pieces.map(p => p.id));
    const apres = { ...data, purchases: (data.purchases || []).map(p => ids.has(p.id) ? { ...p, tvaRecuperable: cible } : p) };
    const tva = round3(Math.abs(vatReturn(apres, company, per).deductible - vatReturn(data, company, per).deductible));
    return { pieces, tva, cible };
  }

  const moduleById = id => MODULES.find(m => m.id === id) || null;
  const pageById = id => PAGES.find(p => p.id === id) || null;
  const pageTitle = id => { const p = pageById(id); return p ? p.titre : ''; };

  // Ce que le module contient aujourd'hui. Un module sans compteur (le cœur) n'a pas à se justifier.
  function moduleCount(data, id) {
    const m = moduleById(id);
    if (!m || !m.compte) return 0;
    try { return Number(m.compte(data || {})) || 0; } catch (_) { return 0; }
  }

  // Un module est actif s'il est choisi. C'est le choix enregistré qui fait foi, et rien d'autre.
  //
  // Jusqu'à la 7.12.0, un module qui CONTENAIT quelque chose s'allumait aussi tout seul, au nom de
  // « on ne masque jamais ce que quelqu'un a saisi ». L'intention était juste, la mécanique était un
  // piège : sur la page « Tous les modules », décocher une case retirait le module de la liste, puis
  // le re-calcul le rallumait aussitôt (il est plein), la ligne se redessinait en cadenas — et la
  // case à cocher disparaissait sous le doigt. Le module restait donc dans le menu ET ne pouvait
  // plus être recoché. Un réglage qui accepte un clic, ne fait rien de visible, et se retire ensuite
  // la possibilité de revenir en arrière est pire que pas de réglage du tout.
  //
  // Ce que la règle protégeait vraiment — « je masque Stock, je commence à m'en servir ailleurs, et
  // la page a disparu » — est repris par `modulesRevenus` : un module masqué dans lequel on vient
  // d'enregistrer quelque chose revient dans le menu, et l'application le DIT. C'est un événement,
  // pas un état : c'est ce qui fait la différence entre un filet et un piège.
  function moduleOn(data, id) {
    const m = moduleById(id);
    if (!m) return false;
    if (m.toujours) return true;
    const choisis = ((data || {}).company || {}).modules;
    // Absent = toute l'application, comme avant : une installation existante ne perd rien.
    if (!Array.isArray(choisis)) return true;
    return choisis.includes(id);
  }

  // Un SOUS-module est-il allumé ? Contrairement à un module, il est **décoché par défaut** : on ne
  // fait pas apparaître une option payante chez quelqu'un qui ne l'a pas demandée. `null` (aucun
  // choix enregistré) vaut donc `defaut`, pas « tout ».
  //
  // Et il ne juge QUE l'affichage : c'est `optionBlock`, côté interface, qui parle de la licence.
  // Mélanger les deux ferait disparaître la case le jour où l'option manque — c'est-à-dire un
  // réglage qui se retire la possibilité de revenir en arrière (le piège de la 7.12.0).
  function sousModuleOn(data, id) {
    const sm = sousModuleById(id);
    if (!sm) return false;
    const choisis = ((data || {}).company || {}).modules;
    if (!Array.isArray(choisis)) return !!sm.defaut;
    return choisis.includes(id);
  }
  function sousModuleById(id) {
    for (const m of MODULES) for (const sm of (m.sousModules || [])) if (sm.id === id) return sm;
    return null;
  }
  const sousModules = () => MODULES.flatMap(m => (m.sousModules || []).map(sm => ({ ...sm, module: m.id })));
  // Le nom d'une option, tel qu'il s'écrit à l'écran et sur une facture de licence. Il vit ICI, à
  // côté du sous-module qui la porte, et pas dans `licence.js` : le renderer ne charge pas
  // `licence.js`, et une seconde table ailleurs finirait par dire autre chose.
  const OPTION_LABELS = { compta: 'Comptabilité' };

  // Pourquoi ce module est visible — ou ne l'est pas : 'coeur', 'choisi', 'tout' (aucun choix
  // enregistré) ou 'masque'.
  function moduleWhy(data, id) {
    const m = moduleById(id);
    if (!m) return '';
    if (m.toujours) return 'coeur';
    const choisis = ((data || {}).company || {}).modules;
    if (!Array.isArray(choisis)) return 'tout';
    return choisis.includes(id) ? 'choisi' : 'masque';
  }

  // Les compteurs de tous les modules, pour servir de référence au prochain enregistrement.
  function moduleCounts(data) {
    const o = {};
    MODULES.forEach(m => { o[m.id] = moduleCount(data, m.id); });
    return o;
  }

  // Les modules masqués dans lesquels quelque chose vient d'être enregistré. On compare aux
  // compteurs de référence (ceux du dernier enregistrement) : masquer un module plein ne le rallume
  // donc pas, alors qu'y ajouter une ligne le ramène.
  function modulesRevenus(data, avant) {
    const choisis = ((data || {}).company || {}).modules;
    if (!Array.isArray(choisis)) return [];
    return MODULES.filter(m => !m.toujours && !choisis.includes(m.id)
      && moduleCount(data, m.id) > (Number((avant || {})[m.id]) || 0)).map(m => m.id);
  }

  // Les pages de la barre latérale, dans l'ordre, groupées par module. `pied` sort du compte : ces
  // deux-là (Paramètres, Aide) vivent dans le pied de la barre, qui ne défile jamais.
  function navPages(data) {
    return PAGES.filter(p => !p.horsMenu && !p.pied && (!p.module || moduleOn(data, p.module)));
  }

  // Une famille de la barre est-elle ouverte ? (10.13.0) — pure, pour que la règle se teste sans
  // écran. `etat` est ce que l'utilisateur a choisi en cliquant les intertitres ; `active` la famille
  // de la page ouverte ; `repliIci` la famille qu'il a repliée alors qu'il était DANS cette page.
  //   - un choix de l'utilisateur fait foi ;
  //   - sans choix, « Vendre » est ouverte (le geste de tous les jours), les autres repliées ;
  //   - la famille de la page ouverte s'ouvre le temps d'y être, SANS toucher au choix — sauf si
  //     l'utilisateur vient de la replier sur cette page même.
  const FAMILLES_OUVERTES_AU_DEBUT = ['Vendre'];
  function familleNavOuverte(famille, etat, active, repliIci) {
    const choisi = etat && Object.prototype.hasOwnProperty.call(etat, famille) ? !!etat[famille] : FAMILLES_OUVERTES_AU_DEBUT.includes(famille);
    if (choisi) return true;
    return !!active && famille === active && repliIci !== famille;
  }

  // Ce que l'assistant de première utilisation allume selon le métier déclaré. Rien n'est imposé :
  // l'écran « Qu'est-ce que tu fais ? » propose ces cases cochées, et l'utilisateur décoche.
  // Un métier absent de cette table n'allume que les trois modules `toujours` : l'application reste
  // utilisable, mais elle ne propose rien. Les neuf métiers ajoutés en 7.22.0 ont donc chacun leur
  // ligne — sinon un garagiste ou un restaurateur découvrirait Achats et Stock par hasard, six mois
  // plus tard, alors que ce sont les deux modules de son quotidien.
  const MODULES_PAR_ACTIVITE = {
    commerce: ['achats', 'stock', 'pilotage'],
    artisanat: ['achats', 'stock', 'pieces'],
    batiment: ['achats', 'pieces', 'pilotage'],
    informatique: ['achats', 'pieces'],
    conseil: ['pieces'],
    sante: ['achats'],
    restauration: ['achats', 'stock', 'paie'],          // matières premières, et du personnel
    transport: ['achats', 'immos', 'pilotage'],         // les véhicules sont des immobilisations
    immobilier: ['pieces', 'pilotage'],
    juridique: ['pieces'],
    comptabilite: ['pieces'],
    architecture: ['pieces', 'pilotage'],               // le suivi se fait par affaire
    communication: ['pieces', 'pilotage'],
    beaute: ['achats', 'stock'],                        // produits revendus et consommables
    automobile: ['achats', 'stock', 'pieces'],          // pièces détachées : du stock, et des devis
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
    fiscalFilings: [],       // échéances fiscales marquées déposées (7.21.0)
    vatCarryIn: {},          // crédit de TVA venu de l'année précédente, par année : { '2026': 1234 }
    projects: [],            // affaires : relient ventes et achats pour une marge exacte (v4)
    fixedCategories: [],     // catégories de charges considérées comme fixes (vide = valeurs par défaut)
    accounts: [],            // comptes de trésorerie : banque, caisse… (v4)
    movements: [],           // mouvements libres : salaires, impôts, apports — ce qui n'a ni facture ni achat
    auxiliaires: false,      // comptes auxiliaires par tiers (411001, 401001…) dans les écritures (8.8.0)
    ecrituresOD: [],         // opérations diverses saisies à la main : { id, date, piece, label, lignes:[{compte,label,debit,credit}] } (8.9.0)
    licences: [],            // licences SkanFact ÉMISES par l'éditeur depuis ce dossier (7.33.0) — vide chez un client
    pontImporte: '',         // jour où l'historique des licences est parti vers la console (8.7.0) — vide chez un client
    exportConsole: '',       // jour du dernier export de la base de la console (10.4.0) — vide chez un client
    deleted: [],             // pièces supprimées, pour qu'elles ne reviennent pas d'un autre poste (v4)
    conflictArchive: [],     // versions écartées lors d'une fusion : rien n'est détruit sans trace
    closedUntil: '',         // dernier jour clôturé : rien de daté avant ne bouge plus (6.0.0)
    closureLog: [],          // chaque clôture et chaque réouverture, avec son motif (6.0.0)
    clotures: [],            // les clôtures d'exercice reçues du cabinet (9.8.0) : à-nouveaux officiels
    // Les questions reçues du cabinet (9.10.0). Elles ne touchent AUCUN chiffre : elles s'affichent
    // en face de la pièce qu'elles visent, on y répond, et la réponse repart dans le paquet suivant.
    questionsCabinet: [],
    // La signature du cabinet, retenue au premier envoi signé (10.13.0) : { empreinte, depuis }.
    // Les envois suivants lui sont comparés (`verdictEnvoiCabinet`). `null` tant qu'aucun n'est arrivé.
    cabinetSignature: null,
    packs: [],               // paquets mensuels construits pour le cabinet (6.1.0)
    demo: false,             // ces données viennent du jeu d'exemple (7.0.0) — l'app le dit à l'écran
    // De quelle version sort l'exemple chargé, et sur quel mois il a été bâti — `{ version, mois }`.
    // Le jeu d'exemple est RELATIF à aujourd'hui : chargé en septembre et regardé en décembre, il
    // montre des relances qui n'ont plus de sens. Ces deux repères le font se REFAIRE tout seul
    // (9.4.2, `exemplePerime`). `null` hors exemple — même forme que dans l'app du cabinet.
    exemple: null,
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
  // 10.12.0 — le statut que prend une pièce quand on l'ENVOIE. Seul le devis passait à « envoyé » :
  // une proforma envoyée par email partait avec un PDF tamponné « BROUILLON », et restait brouillon —
  // la pièce qu'une banque ou une administration demande pour un dossier. La facture et l'avoir n'y
  // sont pas : ils s'ÉMETTENT, et l'émission a son propre geste et son numéro.
  const STATUT_ENVOI = { devis: 'envoyé', proforma: 'envoyée', commande: 'reçue', livraison: 'émis', contrat: 'envoyé' };
  const DISPLAY_STATUSES = {
    devis: ['brouillon', 'envoyé', 'expiré', 'accepté', 'refusé'],
    facture: ['brouillon', 'envoyée', 'partielle', 'retard', 'payée', 'annulée'],
    avoir: STATUSES.avoir,
    proforma: STATUSES.proforma, commande: STATUSES.commande, livraison: STATUSES.livraison, contrat: STATUSES.contrat
  };
  const STATUS_LABELS = { partielle: 'partiellement payée', retard: 'en retard', expiré: 'expiré' };

  // Les filtres de liste qui ne sont PAS un statut (7.15.0). La liste des factures proposait déjà
  // « Émis » dans son menu de statuts, et le filtrage comparait `effectiveStatus(d) === 'émis'` :
  // aucune facture ne porte ce statut — mais les AVOIRS, si. Choisir « Émis » sur une liste de
  // factures rendait donc deux avoirs sur vingt-cinq pièces. Une liste vide se remarque ; une liste
  // fausse, non. Un filtre qui regroupe plusieurs statuts doit être une FONCTION, pas une chaîne
  // comparée à un statut.
  const DOC_FILTRES = {
    'émis': st => st !== 'brouillon' && st !== 'annulée',
    'à encaisser': st => st === 'envoyée' || st === 'partielle' || st === 'retard'
  };
  // Vrai si la pièce (dont le statut effectif est `st`) passe le filtre `choix`.
  function docFiltre(choix, st) {
    if (!choix) return true;
    const f = DOC_FILTRES[choix];
    return f ? f(st) : st === choix;
  }

  // ---------- utilitaires ----------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function round3(n) { const x = Number(n) || 0, r = Math.round(Math.abs(x) * 1000 * (1 + 4 * Number.EPSILON)) / 1000; return x < 0 && r ? -r : r; }

  const CURRENCIES = ['DT', 'EUR', 'USD', 'GBP', 'CHF', 'MAD', 'DZD'];
  // Le NOM de chaque devise, à côté de son code (10.14.0, A2) : « MAD » et « DZD » ne disent rien à
  // qui n'a jamais facturé au Maroc ou en Algérie, et une devise choisie par erreur fausse toute la
  // pièce (7.0.1). Le code reste en tête : c'est lui que la pièce imprime.
  const DEVISES_NOMS = { DT: 'dinar tunisien', EUR: 'euro', USD: 'dollar américain', GBP: 'livre sterling',
    CHF: 'franc suisse', MAD: 'dirham marocain', DZD: 'dinar algérien' };
  function libelleDevise(c) { const n = DEVISES_NOMS[c]; return n ? `${c} — ${n}` : String(c || ''); }
  // La devise de l'entreprise se réglait dans un champ de TEXTE LIBRE, alors que l'éditeur de
  // document et la fiche client n'offrent que ces sept codes depuis la 2.4.0. On pouvait donc y
  // écrire « Dinar », « TND », « dt » ou n'importe quoi — et le nombre de décimales, lui, ne
  // reconnaît que 'DT' et 'TND' : tout le reste passait à deux décimales sur des montants en
  // dinars, silencieusement, sur toutes les pièces à venir. Le champ est devenu une liste ; cette
  // fonction rattrape ce qui a déjà été enregistré, plutôt que de le remettre d'office à 'DT'.
  function normCurrency(c) {
    const v = String(c == null ? '' : c).trim().toUpperCase();
    if (!v) return 'DT';
    if (v === 'TND' || v === 'DINAR' || v === 'DTN' || v === 'TN') return 'DT';
    if (v === '€' || v === 'EURO' || v === 'EUROS') return 'EUR';
    if (v === '$' || v === 'DOLLAR') return 'USD';
    return CURRENCIES.includes(v) ? v : 'DT';
  }
  function decimalsFor(currency) { return !currency || currency === 'DT' || currency === 'TND' ? 3 : 2; }
  // L'arrondi d'une devise : trois décimales pour le dinar, deux pour les autres (la règle de `money`).
  // Même correction décimale que `round3` : 100,35 × 19 % vaut 19,0664999… en virgule flottante.
  function arrondiDevise(currency) {
    if (decimalsFor(currency) === 3) return round3;
    return n => { const x = Number(n) || 0, r = Math.round(Math.abs(x) * 100 * (1 + 4 * Number.EPSILON)) / 100; return x < 0 && r ? -r : r; };
  }
  function money(n, currency, decimals, lang) {
    // Un seul arrondi, à la précision de la devise : arrondir au millime PUIS au centime ferait
    // 2,67465 → 2,675 → 2,68 au lieu de 2,67 (le double arrondi).
    const v = Number(n) || 0;
    const neg = v < 0;
    const dec = decimals != null ? decimals : decimalsFor(currency);
    const en = lang === 'en';
    // Espaces INSÉCABLES (10.12.0) : entre les milliers, avant la devise, après le signe. Une espace
    // ordinaire laissait le navigateur couper un montant en fin de ligne — « 4 » d'un côté, « 530,188
    // DT » de l'autre, dans la phrase qui annonce le solde d'un acompte. Un montant se lit d'un bloc.
    // Arrondi à la précision de la devise AVANT `toFixed` (10.14.1, M-07) : 190,095 € vaut en machine
    // 190,09499…, et `toFixed(2)` l'écrivait « 190,09 » pendant que le total, arrondi par
    // `arrondiDevise`, disait 190,10. Le même epsilon que `arrondiDevise` : un chiffre, une règle.
    const p = 10 ** dec, a = Math.round(Math.abs(v) * p * (1 + 4 * Number.EPSILON)) / p;
    const s = a.toFixed(dec).replace('.', en ? '.' : ',').replace(/\B(?=(\d{3})+(?!\d))/g, en ? ',' : '\u00a0');
    const out = (neg && a ? '−\u00a0' : '') + s;
    return currency ? `${out}\u00a0${currency}` : out;
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

  // Un montant d'une pièce, exprimé dans la devise d'une AUTRE (10.14.0). Un avoir rattaché diminue
  // sa facture dans la devise de la FACTURE : resté en dinars sur une facture en euros (le geste
  // « Nouvel avoir », qui part en dinars), il en retranchait 300 € pour 300 DT — la facture
  // annonçait 200 € de reste pendant que le 411 portait l'équivalent de 410. Même devise : le
  // montant tel quel, un avoir de 300 € efface 300 € quel que soit son taux (l'écart de taux est une
  // différence de change, que le journal écrit) ; autre devise : par la devise de la société, et
  // aux décimales de la devise de la CIBLE (10.14.1) — 300 DT sur une facture en euros valent
  // 89,55 €, jamais 89,552 : une fraction de centime n'existe sur aucune pièce, et le reste qu'elle
  // laissait (410,448 €) ne se soldait par aucun virement. Le millime perdu par cet arrondi passe au
  // change, par `ecartDeTauxEntre`, pour que le compte du tiers tombe sur le même reste.
  function montantDansDeviseDe(piece, montant, cible, company) {
    const dev = x => normCurrency((x && x.currency) || (company && company.currency));
    if (dev(piece) === dev(cible)) return round3(montant);
    return arrondiDevise(dev(cible))(toBase(piece, montant, company) / rateOf(cible, company));
  }

  // Un prix ou un coût du CATALOGUE — tenu dans la devise de la société — posé sur une pièce d'une
  // AUTRE devise (10.14.1). Il était recopié tel quel : une prestation à 150 DT devenait une ligne à
  // 150 € sur une facture en euros (trois fois et demie trop chère), et son coût de revient en dinars
  // se comparait à un prix en euros dans la marge. Converti au taux de la pièce, arrondi à la devise
  // de la pièce. Sans taux saisi, la conversion est impossible : `null`, et l'écran le dit au lieu de
  // poser un chiffre faux. Un champ vide reste vide.
  function prixDuCatalogue(montant, doc, company) {
    if (montant === '' || montant == null) return montant;
    const n = Number(montant); if (!Number.isFinite(n)) return montant;
    const co = company || {};
    const cur = normCurrency((doc && doc.currency) || co.currency);
    if (cur === normCurrency(co.currency)) return n;
    if (missingRate(doc, co)) return null;
    return arrondiDevise(cur)(n / rateOf(doc, co));
  }

  // L'ÉCART DE CHANGE (10.14.0). Un avoir, un avoir fournisseur ou un acompte rattaché à une pièce
  // de la MÊME devise étrangère, mais à un autre taux : le tiers doit (ou se voit devoir) ce qu'il
  // doit dans SA devise — la facture de 1 000 € moins l'avoir de 300 € — donc son compte se règle au
  // taux de la pièce qu'on diminue. La pièce, elle, garde ses propres comptes à son taux (le chiffre
  // d'affaires ou la charge qu'elle corrige). La différence est un gain ou une perte de change : sans
  // elle, le 411 gardait 15 DT sur une facture que le client ne doit plus, pendant que le lettrage,
  // le relevé et la fiche disaient zéro. Rend ce qu'il faut AJOUTER au débit du compte du tiers pour
  // le régler au taux de la cible, sur un montant `natif` de la pièce — c'est aussi l'effet sur le
  // résultat (positif : un gain). Deux devises DIFFÉRENTES (10.14.1 : un avoir en dinars sur une
  // facture en euros) : le tiers est diminué de la contre-valeur ARRONDIE à la devise de la cible
  // (`montantDansDeviseDe`), et le millime que cet arrondi fait perdre est lui aussi un écart — sans
  // lui, le 411 gardait −0,017 DT sur une facture que tous les écrans disaient soldée.
  function ecartDeTauxEntre(piece, cible, natif, company) {
    if (!piece || !cible || !natif) return 0;
    const dev = x => normCurrency(x.currency || company.currency);
    if (dev(piece) === dev(cible) && dev(piece) === normCurrency(company.currency)) return 0;
    return round3(toBase(cible, montantDansDeviseDe(piece, natif, cible, company), company) - toBase(piece, natif, company));
  }
  // Le total des écarts de change d'une période, par la MÊME règle que le journal : le résultat
  // simplifié ne peut pas dire un autre résultat que les états financiers.
  function ecartsDeChange(data, company, period) {
    const from = period && period.from, to = period && period.to;
    const docs = new Map((data.documents || []).map(d => [d.id, d]));
    const achats = new Map((data.purchases || []).map(p => [p.id, p]));
    let total = 0;
    (data.documents || []).forEach(av => {
      if (av.type !== 'avoir' || !av.creditOf || av.status === 'brouillon' || !av.number || !inPeriod(av.date, from, to)) return;
      // Le BRUT que le 411 transfère (10.14.0) : la retenue subie naît à l'encaissement.
      const ta = computeTotals(av, company);
      total += ecartDeTauxEntre(av, docs.get(av.creditOf), -round3(ta.netToPay + ta.withholding), company);
    });
    (data.purchases || []).forEach(p => {
      if (!inPeriod(p.date, from, to)) return;
      // Le BRUT que le 401 transfère d'une pièce à l'autre (10.14.0) : la retenue naît au règlement.
      if (p.kind === 'avoir' && p.achatLie && achats.get(p.achatLie)) {
        total += ecartDeTauxEntre(p, achats.get(p.achatLie), imputationAchat(p, company).brut, company);
      } else if (p.kind !== 'avoir' && p.kind !== 'acompte') {
        piecesLieesAchat(data, p.id, 'acompte').forEach(a => { const ta = purchaseTotals(a, company); total += ecartDeTauxEntre(a, p, round3(ta.netToPay + ta.withholding), company); });
      }
    });
    // Les règlements à un autre taux que leur pièce (10.14.0), à la date du règlement : recevoir plus
    // de dinars est un gain, en payer plus une perte — un avoir remboursé à l'inverse.
    (data.documents || []).forEach(d => {
      if (d.type !== 'facture') return;
      (d.payments || []).forEach(p => { if (inPeriod(p.date, from, to)) total += ecartDuReglement(d, p, company); });
    });
    // L'écart de CONVERSION d'une pièce en devise (10.14.1) : ce que l'écriture de vente pose au
    // change, par la MÊME fonction qui l'écrit (le journal des ventes), jamais recalculé à côté.
    if ((data.documents || []).some(d => d.currency && d.currency !== company.currency)) {
      salesJournal(data, company, { from, to }).forEach(r => { total += r.ecartConversion || 0; });
    }
    (data.purchases || []).forEach(pu => {
      const sens = pu.kind === 'avoir' ? -1 : 1;
      (pu.payments || []).forEach(p => { if (inPeriod(p.date, from, to)) total -= sens * ecartDuReglement(pu, p, company); });
    });
    return round3(total);
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

  // Le RÈGLEMENT d'une pièce en devise (10.14.0). Une facture de 1 000 € émise à 3,300 se règle un
  // mois plus tard à 3,400 : la banque reçoit 3 400 DT, pas 3 300. SkanFact convertissait le
  // règlement au taux de la FACTURE — le solde bancaire de la page ne retombait jamais sur le relevé
  // réel, et l'écart de change n'existait nulle part. Un règlement porte son taux du jour
  // (`exchangeRate`, par défaut celui de la pièce) : la banque bouge de ce qu'elle a vraiment reçu ou
  // payé, le client ou le fournisseur se solde au taux de SA pièce, et la différence est un gain (755)
  // ou une perte (655) de change — la règle des avoirs à un autre taux, appliquée au règlement.
  function tauxDuReglement(piece, p, company) {
    const cur = (piece || {}).currency || (company || {}).currency;
    if (!cur || cur === (company || {}).currency) return 1;
    const r = Number((p || {}).exchangeRate);
    return r > 0 ? r : rateOf(piece, company);
  }
  // Ce que la banque a vraiment reçu ou payé, en devise de la société.
  function montantRegle(piece, p, company) {
    const a = Number((p || {}).amount) || 0;
    const cur = (piece || {}).currency || (company || {}).currency;
    if (!cur || cur === (company || {}).currency) return round3(a);
    return round3(a * tauxDuReglement(piece, p, company));
  }
  // L'écart entre ce que la banque a bougé et ce que le tiers voit soldé (au taux de la pièce).
  function ecartDuReglement(piece, p, company) {
    return round3(montantRegle(piece, p, company) - toBase(piece, Number((p || {}).amount) || 0, company));
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

  // Le capital social s'écrit comme les autres montants de la pièce (rapport QA, 10.12.0) : « 10000 »
  // tapé nu sortait « Capital 10000 » en pied de chaque document, là où tout le reste s'écrit
  // « 2 262,000 DT ». Seul un nombre NU (chiffres et espaces) se met en forme : un texte déjà écrit
  // (« 1 000 DT », « 10.000 dinars ») est celui de l'utilisateur et reste tel quel — et « 10.000 »
  // se lit dix mille ou dix selon qui l'écrit, donc on ne le devine pas.
  function capitalAffiche(capital, currency, lang) {
    const s = String(capital == null ? '' : capital).trim();
    if (!/^\d[\d\s]*$/.test(s)) return s;
    const n = Number(s.replace(/\s/g, ''));
    return n > 0 ? money(n, normCurrency(currency), 0, lang) : s;
  }

  // Le pluriel. Il vivait dans les DEUX renderers et manquait ici, alors que core.js écrit lui aussi
  // des phrases qu'on lit à l'écran : les lignes de « À faire », la liste de ce qui manque au
  // paquet du comptable, les bulletins. « 1 facture(s) en brouillon » paraît bâclé où qu'il soit
  // écrit. `plur` sert aux pluriels irréguliers ; `sAccord` accorde ce qui SUIT le nom.
  const plFr = (n, un, plur) => `${Math.abs(n) >= 1000 ? Number(n).toLocaleString('fr-FR') : n} ${Math.abs(n) > 1 ? (plur || un + 's') : un}`;
  const sAccord = n => (Number(n) > 1 ? 's' : '');

  // La ponctuation double à la française (10.14.0) : « ? », « ! », « ; », « : » et l'intérieur des
  // guillemets prennent une espace FINE INSÉCABLE. Avec une espace ordinaire, le navigateur coupe
  // juste avant : dans le bandeau d'une question du comptable, le « ? » commençait la ligne, tout
  // seul. Le texte d'une question est tapé DANS LE CABINET, avec des espaces ordinaires : c'est donc
  // ici, à l'affichage, qu'il se corrige — jamais dans la donnée, qui repart telle quelle. Jumelle
  // de `typo` (visite.js) et de `typographie()` du Cabinet (9.4.2) ; un test compare les corps.
  const typoFr = t => String(t == null ? '' : t).replace(/ ([?!;:»])/g, '\u202f$1').replace(/« /g, '«\u202f');

  // Un délai en jours réglé par l'utilisateur (10.12.0). ZÉRO est un délai — « à réception » —, et
  // `Number(x) || 30` le changeait en trente jours : une entreprise réglée « paiement à réception »
  // recevait des factures « À régler avant le » un mois plus tard. C'est le piège de la 7.16.0
  // (`limit || 20` rend le « tout » impossible à demander). Seule une valeur ABSENTE ou illisible
  // prend le défaut.
  function delaiJours(v, defaut) {
    if (v === '' || v == null) return defaut;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : defaut;
  }

  // Une recherche TAPÉE (10.12.0) : insensible aux accents et aux majuscules, et mot par mot.
  // « hotel » ne trouvait pas « Hôtel Dar El Marsa SARL », ni « cafe » le « Café des Arts », ni
  // « delai » le réglage « Délai de paiement » — dans les quinze recherches de l'application, la
  // palette Ctrl K et l'Aide comprises. Le Cabinet plie les accents depuis la 6.8.0 : le jumeau
  // manquant (7.3.0), sur le geste qu'on fait le plus. Mot par mot : « marsa hotel » trouve aussi.
  // Les ligatures aussi (10.14.0) : « œ » n'est pas un « o » accentué, la décomposition ne le touche
  // pas — et un clavier AZERTY ne le tape pas. « main d'oeuvre » ne trouvait donc jamais la
  // prestation « Main-d'œuvre » que l'assistant pose pour trois métiers, et l'import d'un tableur qui
  // écrit « oeuvre » créait un doublon à côté de l'exemple.
  const plier = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\u0153/g, 'oe').replace(/\u00e6/g, 'ae');
  function correspondRecherche(texte, q) {
    const mots = plier(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return true;
    const t = plier(texte);
    return mots.every(m => t.includes(m));
  }

  // Le RANG d'un résultat de recherche (10.14.0), jugé sur le NOM de ce qu'on ouvre — jamais sur le
  // texte où l'on a cherché (l'objet d'une pièce, le client d'une facture, le corps d'un article).
  // La palette Ctrl K coupait à douze AVANT de classer : sur l'exemple de cinq ans, « audit » ne
  // rendait que douze factures dont l'objet parle d'audit, et jamais la prestation « Audit de
  // sécurité réseau », rangée après elles. Un extrait coupé avant d'être classé montre ce qui est
  // arrivé en premier, pas ce qu'on cherchait. 3 : le nom commence par la recherche ; 2 : chaque mot
  // commence un mot du nom ; 1 : le nom contient chaque mot ; 0 : trouvé ailleurs que dans le nom.
  // Les mots se découpent sur `\p{L}\p{N}` et pas sur `[a-z]` : une raison sociale en arabe a des
  // mots elle aussi (règle 6.8.1).
  function rangRecherche(nom, q) {
    const n = plier(nom), requete = plier(q).trim();
    if (!requete) return 0;
    if (n.startsWith(requete)) return 3;
    const mots = requete.split(/\s+/).filter(Boolean);
    const debuts = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (mots.every(m => debuts.some(d => d.startsWith(m)))) return 2;
    if (mots.every(m => n.includes(m))) return 1;
    return 0;
  }

  // La liste d'une recherche, dans l'ordre où elle s'affiche (10.14.0) : on garde ce qui contient
  // chaque mot, on CLASSE par `rangRecherche`, à rang égal l'ordre d'arrivée. Chaque élément porte
  // `main` (le nom qu'on lit), `text` (où l'on cherche) et `piece` pour une pièce. Les pièces se
  // comptent par centaines sur cinq ans, et leur numéro commence comme la page qu'on cherche
  // (« fac » → FAC-2026-…) : au-delà des `plafondPieces` premières, elles passent APRÈS tout le reste.
  // Elles ne poussent plus une page, un client ou une prestation hors des premières lignes, et elles
  // remplissent encore la liste quand rien d'autre ne répond (« 2026 »). `texte` permet à l'appelant
  // de garder son texte déjà plié d'une frappe à l'autre.
  function classerRecherche(elements, q, opts = {}) {
    const requete = plier(q).trim();
    if (!requete) return [];
    const mots = requete.split(/\s+/).filter(Boolean);
    const texte = opts.texte || (x => plier(x.text));
    const plafond = opts.plafondPieces == null ? 6 : opts.plafondPieces;
    const classes = (elements || []).map((x, i) => ({ x, i }))
      .filter(o => { const t = texte(o.x); return mots.every(m => t.includes(m)); })
      .map(o => ({ ...o, r: rangRecherche(o.x.main, requete) }))
      .sort((a, b) => b.r - a.r || a.i - b.i);
    const tete = [], reste = [];
    let pieces = 0;
    classes.forEach(({ x }) => {
      if (x.piece && pieces >= plafond) reste.push(x);
      else { if (x.piece) pieces++; tete.push(x); }
    });
    return tete.concat(reste);
  }

  // 10.14.0 — une facture qu'on vient d'émettre se disait « envoyée », avant tout envoi : c'est le
  // nom de la VALEUR depuis la 1.4.0 (elle reste, les données ne bougent pas), pas un mot pour
  // quelqu'un qui n'a rien envoyé. Une facture se dit « émise ». Une proforma, elle, garde
  // « envoyée » : c'est le geste d'envoi qui la pose (STATUT_ENVOI). Sans type, c'est une facture
  // — le journal des ventes et les listes de factures n'en passent pas.
  function statusLabel(s, type) {
    if (s === 'envoyée' && type !== 'proforma') return 'émise';
    return STATUS_LABELS[s] || s;
  }

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

  // ---------- la numérotation continue (10.14.0) ----------
  //
  // Quelqu'un qui facturait déjà — dans un autre logiciel, sur un carnet — arrive dans SkanFact en
  // cours d'année : sa première facture ici doit porter le numéro qui SUIT sa dernière, pas FAC-…-001.
  // Une numérotation d'une année est continue (À VÉRIFIER avec le comptable) : repartir à 001 en
  // septembre donne deux factures « 001 » la même année, l'une chez l'ancien logiciel, l'autre ici.
  //
  // On règle la DERNIÈRE pièce émise ailleurs (c'est le numéro qu'on a sous les yeux, sur son dernier
  // papier) ; `nextNumber` en fait la suivante, puisqu'il repart de max(pièces, compteur).
  const TYPES_NUMEROTES = ['facture', 'avoir', 'devis'];
  function etatNumerotation(data, type, annee) {
    const d = data || {};
    const year = String(annee || today().slice(0, 4));
    const prefix = PREFIX[type] || 'DOC';
    const numeros = (d.documents || [])
      .filter(x => x.type === type && x.number && x.number.startsWith(`${prefix}-${year}-`))
      .map(x => parseInt(x.number.split('-')[2], 10) || 0);
    const derniereIci = numeros.length ? Math.max(...numeros) : 0;
    const compteur = Number((d.counters || {})[`${type}-${year}`]) || 0;
    const derniere = Math.max(derniereIci, compteur);
    const numero = n => `${prefix}-${year}-${String(n).padStart(3, '0')}`;
    return {
      type, annee: year, prefix,
      piecesIci: numeros.length,          // pièces de ce type et de cette année déjà numérotées DANS SkanFact
      derniereIci,                        // la plus haute d'entre elles (0 : aucune)
      derniere,                           // la dernière prise, ici ou ailleurs (celle que suit la prochaine)
      prochaine: numero(derniere + 1),
      derniereNumero: derniere ? numero(derniere) : '',
      // Une facture et un avoir ont une valeur légale : leur suite ne se touche plus une fois qu'une
      // pièce de l'année est numérotée ici — la changer laisserait un trou dans une série continue.
      verrouillee: SALES_TYPES.includes(type) && numeros.length > 0
    };
  }
  // Poser la dernière pièce émise AILLEURS. Rend { ok, motif } ; n'écrit rien quand il refuse.
  function poserNumerotation(data, type, annee, derniere) {
    const e = etatNumerotation(data, type, annee);
    const brut = String(derniere == null ? '' : derniere).trim();
    const n = brut === '' ? 0 : Number(brut);
    if (!Number.isInteger(n) || n < 0 || n > 99999) {
      return { ok: false, motif: 'Le numéro de ta dernière pièce est un nombre entier : 47 pour ' + `${e.prefix}-${e.annee}-047. Laisse vide si tu n'en as émis aucune.` };
    }
    if (n === e.derniere) return { ok: true, change: false, etat: e };
    if (e.verrouillee) {
      const quoi = type === 'avoir' ? `Tes avoirs de ${e.annee} sont déjà numérotés` : `Tes factures de ${e.annee} sont déjà numérotées`;
      return { ok: false, motif: `${quoi} dans SkanFact (jusqu'à ${e.prefix}-${e.annee}-${String(e.derniereIci).padStart(3, '0')}) : changer la suite laisserait un trou dans une série qui doit être continue.` };
    }
    if (n < e.derniereIci) {
      return { ok: false, motif: `${e.prefix}-${e.annee}-${String(e.derniereIci).padStart(3, '0')} existe déjà dans SkanFact : la dernière pièce ne peut pas être plus ancienne.` };
    }
    if (!data.counters || typeof data.counters !== 'object') data.counters = {};
    data.counters[`${type}-${e.annee}`] = n;
    return { ok: true, change: true, etat: etatNumerotation(data, type, annee) };
  }
  // La TOUTE première pièce d'un type légal : aucune n'a encore de numéro, et aucune suite n'a été
  // posée pour l'année. C'est le moment où l'on demande « tu facturais déjà ? » — pas avant, où la
  // question serait abstraite, ni après, où la suite ne se touche plus.
  function premiereNumerotation(data, type, annee) {
    if (!SALES_TYPES.includes(type)) return false;
    const e = etatNumerotation(data, type, annee);
    return !(data.documents || []).some(x => x.type === type && x.number) && !e.derniere;
  }

  function isLocked(doc) { return (doc.type === 'facture' || doc.type === 'avoir') && doc.status !== 'brouillon'; }
  function isIssued(doc) { return doc.status !== 'brouillon'; }

  // ---------- calculs ----------

  function computeTotals(doc, company) {
    // 10.14.1 — une pièce se calcule aux décimales de SA devise : au millime pour le dinar, au
    // centime pour l'euro ou le dollar. Calculée au millime, une facture en euros imprimait
    // « 938,01 EUR » pour un net interne de 938,014 : payée du montant imprimé, elle restait
    // « partielle » et en retard pour 0,004 €, et la facture imprimée ne s'additionnait pas
    // (HT + TVA + timbre ≠ net). Le PDF a toujours dit le vrai montant ; le calcul le rejoint.
    const rd = arrondiDevise(doc.currency || (company || {}).currency);
    const lines = (doc.lines || []).map(l => {
      const qty = Number(l.qty) || 0;
      const unit = Number(l.unitPrice) || 0;
      const rate = Number(l.vatRate) || 0;
      const ht = rd(qty * unit);
      const vat = rd(ht * rate / 100);
      return { ...l, qty, unitPrice: unit, vatRate: rate, ht, vat, ttc: rd(ht + vat), noDiscount: !!l.noDiscount };
    });
    const totalHT = rd(lines.reduce((s, l) => s + l.ht, 0));
    const discountRate = Number(doc.discountRate) || 0;
    // La remise globale ne porte pas sur les lignes « noDiscount » (déduction d'un acompte déjà facturé).
    const discountable = rd(lines.filter(l => !l.noDiscount).reduce((s, l) => s + l.ht, 0));
    const discount = rd(discountable * discountRate / 100);
    const netHT = rd(totalHT - discount);
    // TVA par taux, appliquée après remise globale (remise répartie proportionnellement)
    const factor = discountable > 0 ? (discountable - discount) / discountable : 1;
    const vatByRate = {};
    lines.forEach(l => {
      const base = rd(l.noDiscount ? l.ht : l.ht * factor);
      vatByRate[l.vatRate] = vatByRate[l.vatRate] || { base: 0, vat: 0 };
      vatByRate[l.vatRate].base = rd(vatByRate[l.vatRate].base + base);
      vatByRate[l.vatRate].vat = rd(vatByRate[l.vatRate].vat + base * l.vatRate / 100);
    });
    const totalVAT = rd(Object.values(vatByRate).reduce((s, v) => s + v.vat, 0));
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
    const stamp = stampApplies ? rd(timbreDu / rateOf(doc, company)) : 0;
    const totalTTC = rd(netHT + totalVAT + stamp);
    // Retenue à la source (factures / avoirs) : calculée sur le TTC hors timbre. À VÉRIFIER avec le comptable.
    // La retenue à la source ne se pratique que sur ce qui est réellement payé : facture, avoir, proforma.
    const withholdingRate = ['facture', 'avoir', 'proforma'].includes(doc.type) ? (Number(doc.withholdingRate) || 0) : 0;
    const withholding = rd((netHT + totalVAT) * withholdingRate / 100);
    const netToPay = rd(totalTTC - withholding);
    // Le timbre en DINARS, tel que la loi le fixe : c'est lui qui se déclare et qui va au 4368. Converti
    // aller-retour par la devise (1 / 3,35 = 0,30 € ; 0,30 × 3,35 = 1,005), il était déclaré 1,002 DT.
    const stampBase = stampApplies ? round3(timbreDu) : 0;
    return { lines, totalHT, discountRate, discount, netHT, vatByRate, totalVAT, stamp, stampBase, totalTTC, withholdingRate, withholding, netToPay };
  }

  // ---------- le lot de calcul (10.14.0, saturation) ----------
  // Avec huit mille pièces, l'application gelait douze secondes à CHAQUE page, et le chien de garde
  // la rechargeait : le statut d'une facture relisait toutes les pièces pour trouver ses avoirs, et
  // le stock d'un article relisait tous les achats et toutes les ventes — pour chaque facture, pour
  // chaque article. Des boucles dans des boucles, invisibles sur l'exemple (quatre cents pièces).
  // Le remède n'est pas un cache qu'on invalide (une donnée modifiée en place ne prévient personne),
  // c'est un LOT : pendant un calcul qui ne modifie rien — un dessin, « À faire », un journal —, les
  // index se construisent une fois ; à la sortie du lot, ils disparaissent. Hors lot, chaque fonction
  // relit tout, exactement comme avant : un appel isolé ne peut jamais lire un index périmé.
  // Un comparateur construit UNE fois : `localeCompare(b, undefined, options)` en construit un à
  // chaque appel, et un tri de quatorze mille écritures en faisait deux cent mille (10.14.0).
  const TRI_NUMERIQUE = new Intl.Collator(undefined, { numeric: true });
  const TRI_FR = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
  let lot = null;
  function enLot(fn) {
    if (lot) return fn();
    lot = new Map();
    try { return fn(); } finally { lot = null; }
  }
  function duLot(data, cle, calc) {
    if (!lot || !data || typeof data !== 'object') return calc();
    let parData = lot.get(data);
    if (!parData) lot.set(data, parData = new Map());
    if (!parData.has(cle)) parData.set(cle, calc());
    return parData.get(cle);
  }

  // Avoirs émis rattachés à une facture
  function creditsFor(data, invoiceId) {
    if (lot && invoiceId) {
      const idx = duLot(data, 'avoirs', () => {
        const m = new Map();
        (data.documents || []).forEach(d => {
          if (d.type !== 'avoir' || !d.creditOf || d.status === 'brouillon') return;
          if (!m.has(d.creditOf)) m.set(d.creditOf, []);
          m.get(d.creditOf).push(d);
        });
        return m;
      });
      return (idx.get(invoiceId) || []).slice();
    }
    return (data.documents || []).filter(d => d.type === 'avoir' && d.creditOf === invoiceId && d.status !== 'brouillon');
  }

  // Le remboursement d'un trop-perçu (10.14.0). Un avoir émis sur une facture déjà payée, ou un
  // paiement plus fort que la facture, laisse de l'argent au CLIENT ; le rendre est une SORTIE, et
  // elle s'enregistre sur la facture même, comme un règlement de montant NÉGATIF. Le signe fait
  // tout le reste sans qu'aucun agrégateur ait à s'en souvenir (la leçon de la 10.2.0) : le reste à
  // payer remonte à zéro, la trésorerie voit une sortie, et l'écriture change de colonne toute
  // seule (D client / C banque, règle 6.3.0). Seuls les lecteurs de DATES doivent le connaître :
  // rendre de l'argent n'est pas « le jour où le client a fini de payer ».
  function estRemboursement(p) { return (Number(p && p.amount) || 0) < 0; }
  function dateDernierReglement(inv) {
    const dates = ((inv && inv.payments) || []).filter(p => !estRemboursement(p)).map(p => p.date).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : '';
  }

  // Situation d'une facture : total, avoirs, paiements, reste à payer.
  function invoiceBalance(doc, data, company) {
    const totals = computeTotals(doc, company);
    const credits = creditsFor(data, doc.id);
    const credited = round3(credits.reduce((s, a) => s + montantDansDeviseDe(a, computeTotals(a, company).netToPay, doc, company), 0));
    const paid = round3((doc.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
    // Une facture marquée ANNULÉE ne doit plus rien (10.14.0). Le relevé, l'âge des impayés, le
    // lettrage et les écritures l'écartaient tous ; sa propre page, elle, affichait « Reste à payer
    // 633,370 DT » en orange — la seule des cinq à dire le contraire. Elle ne se marque annulée que
    // sans paiement ni avoir, donc il n'y a rien d'autre à solder.
    const annulee = doc.status === 'annulée';
    // Le reste se lit aux décimales de la DEVISE de la pièce (10.14.1) : un règlement saisi au
    // millime avant la 10.14.1 (« 938,014 € ») sur une facture qui vaut 938,01 € ne laisse ni un
    // reste ni un trop-perçu de 0,004 € — une fraction de centime n'existe pas sur un virement.
    const remaining = annulee ? 0 : arrondiDevise(doc.currency || (company || {}).currency)(totals.netToPay - credited - paid);
    return { totals, credits, credited, paid, remaining, annulee };
  }

  // Le titre d'une question (10.14.0). Les quatre-vingt-sept questions de l'app entreprise
  // s'intitulaient toutes « Confirmation », ce qui ne dit pas ce qu'on confirme : on lit le corps
  // pour savoir si l'on supprime un paiement ou si l'on quitte l'exemple. Le Cabinet donne un titre
  // à chacune depuis toujours (le jumeau, 7.3.0). Ici le titre se DÉDUIT, dans cet ordre :
  //   1. la question par laquelle le message commence (« Supprimer le paiement de 50 DT ? ») — elle
  //      devient le titre et quitte le corps, pour ne pas se lire deux fois ;
  //   2. sinon le geste du bouton, quand il en nomme un (« Marquer annulée ? ») ;
  //   3. sinon « Avant de continuer » — un « … quand même » est un avertissement, pas un geste.
  // Une question trop longue pour un titre reste dans le corps : un titre de trois lignes ne se lit
  // plus comme un titre.
  const GESTES_GENERIQUES = /^(confirmer|continuer|ok|oui|valider)$|quand même/i;
  // Le bouton d'une question dit le GESTE, jamais « Confirmer » (10.14.0) : « Supprimer ce
  // mouvement ? » au-dessus de « Confirmer » fait relire la question pour savoir ce que le clic
  // fera. Quand l'appelant ne nomme pas le bouton, il prend le verbe par lequel la question
  // commence — un infinitif, jamais « Annuler » (le bouton d'à côté s'appelle déjà ainsi) ni un
  // mot qui en a seulement la terminaison (« Votre », « Autre »).
  const PAS_UN_GESTE = /^(annuler|votre|notre|autre|entre|contre|titre|cette|lettre|ordre|nombre|membre)$/i;
  function gesteQuestion(titre) {
    const m = /^([A-ZÉÈÀÂÎÔÛa-zéèàâîôûç][a-zéèêëàâîïôûç-]{2,}(?:er|ir|oir|re))(?=[\s?,.]|$)/.exec(String(titre || '').trim());
    if (!m || PAS_UN_GESTE.test(m[1]) || GESTES_GENERIQUES.test(m[1])) return '';
    return m[1].charAt(0).toUpperCase() + m[1].slice(1);
  }
  function titreQuestion(msg, okLabel) {
    const texte = String(msg == null ? '' : msg);
    // La PREMIÈRE phrase seulement : « La date est dans le futur. Enregistrer quand même ? » n'est
    // pas un titre, c'est un avertissement qui finit par une question.
    const m = /^([^?.!\n]{3,90}\?)[ \t]*\n?/.exec(texte);
    if (m) return { titre: m[1].trim(), corps: texte.slice(m[0].length).trim() };
    const geste = String(okLabel || '').trim().replace(/[….]+$/, '');
    if (geste && !GESTES_GENERIQUES.test(geste)) return { titre: geste + ' ?', corps: texte };
    return { titre: 'Avant de continuer', corps: texte };
  }

  // Deux délais sur la même facture (10.12.0, H-E23) : les conditions de paiement disent « à
  // réception » pendant que la pièce imprime « À régler avant le … ». En cas de retard, c'est le
  // client qui choisit lequel lire. Rend la phrase qui contredit l'échéance, ou ''. Une échéance le
  // jour même ne contredit rien. On ne réécrit JAMAIS la phrase de l'utilisateur : on la montre.
  function delaisContradictoires(company, doc) {
    if (!doc || doc.type !== 'facture' || !doc.date || !doc.dueDate || doc.dueDate <= doc.date) return '';
    const phrase = String(((doc.lang === 'en' ? (company || {}).paymentTermsEn : (company || {}).paymentTerms) || '')).trim();
    return /r[ée]ception|receipt/i.test(phrase) ? phrase : '';
  }

  // Pourquoi une facture émise ne se déverrouille plus (10.12.0). Le bandeau disait « déjà payée en
  // partie » sur une facture entièrement payée — la règle confondait « un paiement existe » et
  // « elle est soldée » —, et sa bulle disait « soldée » sur une facture payée à moitié. Trois
  // causes, trois phrases, et c'est la MÊME fonction qui les écrit toutes les deux. Une quatrième :
  // une facture que ses avoirs couvrent EN ENTIER n'a plus rien à corriger (`annulee`) — le bandeau
  // proposait encore « Corriger par un avoir… » en bouton principal, c'est-à-dire un avoir de trop.
  function motifVerrou(bal) {
    if (!bal) return { court: '', long: '', annulee: false };
    const net = bal.totals ? bal.totals.netToPay : 0;
    if ((bal.credits || []).length && net > 0 && bal.credited >= net - 0.0005) return { court: 'annulée par un avoir', long: 'Ses avoirs l\'annulent en entier : les pièces restent toutes dans la numérotation, et il n\'y a plus rien à corriger.', annulee: true };
    if ((bal.credits || []).length) return { court: 'un avoir existe', long: 'Un avoir corrige déjà cette facture : on ne rouvre pas une pièce qu\'une autre pièce corrige.' };
    if (bal.paid > 0 && bal.remaining <= 0.0005) return { court: 'entièrement payée', long: 'Cette facture est entièrement payée : rouvrir une pièce réglée changerait ce que le client a payé.' };
    if (bal.paid > 0) return { court: 'déjà payée en partie', long: 'Un paiement y est déjà enregistré : rouvrir la pièce changerait ce qu\'il règle.' };
    return { court: '', long: '' };
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
  // 10.14.1 (DEV-16) — une part d'un devis est un MONTANT, pas un prix unitaire : elle s'arrondit aux
  // décimales de la devise du devis, comme la pièce qui la portera (`computeTotals`). Au millime, 17 %
  // d'un devis de 333,33 € donnaient une ligne à 56,666 € — un prix qu'aucun client ne peut payer,
  // affiché tel quel dans la grille de la facture d'acompte pendant que le PDF écrivait 56,67.
  function depositLines(quote, percent, company) {
    const t = computeTotals(quote, company);
    const pct = Number(percent) || 0;
    const rd = arrondiDevise(quote.currency || (company || {}).currency);
    return Object.keys(t.vatByRate).sort((a, b) => a - b).map(rate => ({
      label: `Acompte de ${String(pct).replace('.', ',')} % sur le devis ${quote.number}`,
      description: quote.subject || '',
      qty: 1, unit: '', unitPrice: rd(t.vatByRate[rate].base * pct / 100), vatRate: Number(rate), noDiscount: true
    }));
  }

  // Un acompte demandé en MONTANT fait ce montant (10.14.1, ACP-01). La fenêtre convertissait le
  // montant tapé en pourcentage, arrondi au millième, puis appliquait ce pourcentage aux bases du
  // devis : « 500 DT » faisait 500,002 TTC — la facture annoncée au client au téléphone ne tombait
  // pas juste. Ici les bases se répartissent entre les taux du devis au prorata, puis la plus forte
  // s'ajuste d'une unité de la devise (le millime, le centime) jusqu'à ce que HT + TVA, calculés
  // comme la facture les calculera, fassent le montant. Quand ce montant est inatteignable — une TVA
  // arrondie saute parfois une unité —, c'est le plus proche, et à égalité le plus bas : on ne
  // demande jamais au client plus que ce qu'on lui a dit. Le timbre vient en plus, comme pour un
  // acompte en pourcentage (7.19.0) : c'est le droit de la facture, pas une part du devis.
  function depositLinesMontant(quote, montant, company) {
    const cur = quote.currency || (company || {}).currency;
    const rd = arrondiDevise(cur);
    const pas = decimalsFor(cur) === 3 ? 0.001 : 0.01;
    const t = computeTotals(quote, company);
    const taux = Object.keys(t.vatByRate).map(Number).sort((a, b) => a - b);
    const ttcDevis = rd(taux.reduce((s, r) => s + t.vatByRate[r].base + t.vatByRate[r].vat, 0));
    const vise = rd(Number(montant) || 0);
    if (!(vise > 0) || !(ttcDevis > 0) || !taux.length) return [];
    const f = vise / ttcDevis;
    const bases = taux.map(r => rd(t.vatByRate[r].base * f));
    const ttcDe = bs => rd(bs.reduce((s, b, i) => s + b + rd(b * taux[i] / 100), 0));
    // Une seule base bouge, de quelques unités : celle qui fait tomber juste, et d'abord la plus forte
    // (une unité y pèse le moins, en proportion). À 19 %, une unité de base fait parfois deux unités
    // de TTC ; une autre base, à un autre taux, rattrape souvent l'unité que celle-là saute.
    const k = bases.reduce((m, b, i) => (Math.abs(b) > Math.abs(bases[m]) ? i : m), 0);
    const ordre = [k, ...bases.map((_, i) => i).filter(i => i !== k)];
    let meilleur = null;
    for (const i of ordre) {
      for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8, 10, -10, 12, -12]) {
        const essai = bases.slice(); essai[i] = rd(essai[i] + d * pas);
        if (essai[i] < 0) continue;
        const ecart = rd(ttcDe(essai) - vise);
        const mieux = !meilleur || Math.abs(ecart) < Math.abs(meilleur.ecart) - 1e-9
          || (Math.abs(Math.abs(ecart) - Math.abs(meilleur.ecart)) < 1e-9 && ecart < meilleur.ecart - 1e-9);
        if (mieux) meilleur = { essai, ecart };
      }
      if (meilleur && Math.abs(meilleur.ecart) < 1e-9) break;
    }
    return taux.map((rate, i) => ({
      label: `Acompte de ${money(vise, cur)} TTC sur le devis ${quote.number}`,
      description: quote.subject || '',
      qty: 1, unit: '', unitPrice: meilleur.essai[i], vatRate: rate, noDiscount: true
    }));
  }

  // Ce qu'un acompte demande, dit comme il a été demandé : « 500,000 DT TTC » quand on a tapé un
  // montant, « 30 % » quand on a tapé un pourcentage (ACP-01). Le pourcentage d'un acompte en montant
  // est exact mais illisible (13,514 %) : le montant est ce qu'on a annoncé au client.
  function acompteDit(dep, cur) {
    if (dep && Number(dep.montant) > 0) return money(Number(dep.montant), cur) + ' TTC';
    return `${String((dep && dep.percent) || 0).replace('.', ',')} %`;
  }

  // Lignes d'une facture de solde : les lignes du devis, moins les acomptes déjà facturés (émis).
  // La déduction reprend le HT de la ligne d'acompte tel que SA facture l'a compté — aux décimales de
  // sa devise (DEV-16) : un acompte en euros né avant la 10.14.1 porte encore 56,666, et sa facture a
  // compté 56,67.
  function settlementLines(quote, depositInvoices) {
    const lines = (quote.lines || []).map(l => ({ ...l }));
    (depositInvoices || []).forEach(inv => {
      const rd = arrondiDevise(inv.currency || quote.currency);
      (inv.lines || []).forEach(l => lines.push({
        label: `Acompte déjà facturé (${inv.number})`, description: '', qty: 1, unit: '',
        unitPrice: -rd((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)), vatRate: Number(l.vatRate) || 0, noDiscount: true
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
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || TRI_NUMERIQUE.compare((a.number || ''), b.number || ''));
    const noms = new Map(); (data.clients || []).forEach(c => { if (!noms.has(c.id)) noms.set(c.id, c.name || ''); });
    const clientName = id => noms.get(id) || '';
    return docs.map(d => {
      const t = computeTotals(d, company);
      const cancelled = d.type === 'facture' && d.status === 'annulée';
      const rate = (d.currency && d.currency !== company.currency) ? (Number(d.exchangeRate) || 1) : 1;
      const sign = (cancelled ? 0 : (d.type === 'avoir' ? -1 : 1)) * rate;
      const status = d.type === 'facture' ? effectiveStatus(d, data, company, period.today) : d.status;
      const bal = d.type === 'facture' ? invoiceBalance(d, data, company) : null;
      const vatByRate = {};
      VAT_RATES.forEach(r => { const v = t.vatByRate[r]; vatByRate[r] = { base: round3((v ? v.base : 0) * sign), vat: round3((v ? v.vat : 0) * sign) }; });
      // 10.14.1 — le timbre se déclare en dinars, tel que la loi le fixe : reconverti depuis la
      // devise, il valait 1,002 DT sur une facture en euros à 3,35 (0,299 € × 3,35). Et la pièce se
      // referme au millime : ttc = bases + TVA + timbre + écart de conversion.
      //  - en dinars, le seul écart possible vient d'une remise répartie entre deux taux : il va dans
      //    la plus grosse base (le chiffre d'affaires reste le net HT de la pièce) ;
      //  - en devise, la pièce se convertit composante par composante, et le timbre payé en devise
      //    (0,29 €) ne vaut pas exactement le dinar dû : l'écart est un écart de CONVERSION, il va au
      //    change (655 / 755) — jamais dans le chiffre d'affaires ni sur le timbre.
      // Avant, le moteur « absorbait » cet écart sur la dernière ligne de l'écriture (le timbre), et
      // parfois dans la colonne d'en face : une ligne à deux colonnes que le Cabinet refusait.
      const typeSign = cancelled ? 0 : (d.type === 'avoir' ? -1 : 1);
      const timbre = round3((t.stampBase || 0) * typeSign);
      const ttc = round3(t.totalTTC * sign);
      const tva = round3(VAT_RATES.reduce((a, r) => a + vatByRate[r].vat, 0));
      const somme = round3(VAT_RATES.reduce((a, r) => a + vatByRate[r].base, 0));
      const ecart = round3(ttc - somme - tva - timbre);
      let ecartConversion = 0;
      if (ecart && rate === 1) {
        const r0 = VAT_RATES.reduce((m, r) => Math.abs(vatByRate[r].base) > Math.abs(vatByRate[m].base) ? r : m, VAT_RATES[0]);
        vatByRate[r0].base = round3(vatByRate[r0].base + ecart);
      } else ecartConversion = ecart;
      return {
        id: d.id, date: d.date, number: d.number, type: d.type, typeLabel: TITLES[d.type], client: clientName(d.clientId), clientId: d.clientId || '', subject: d.subject || '',
        ht: round3(VAT_RATES.reduce((a, r) => a + vatByRate[r].base, 0)), vatByRate, tva, timbre, ttc, ecartConversion,
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
      const pays = (d.payments || []).map((p, i) => ({ p, i })).filter(x => inPeriod(x.p.date, period.from, period.to));
      if (!pays.length) return;
      // La retenue que le client garde sur CET encaissement (10.14.0) : elle naît au paiement, en
      // dinars au taux de la facture — celui auquel le 411 porte le brut.
      const rs = Number(d.withholdingRate) > 0 ? retenueSubie(d, data, company) : null;
      pays.forEach(({ p, i }) => {
        const m = PAYMENT_METHODS.find(x => x[0] === p.method);
        rows.push({ id: p.id, date: p.date, number: d.number, client: clientName(d.clientId), clientId: d.clientId || '', amount: montantRegle(d, p, company), amountTiers: toBase(d, Number(p.amount) || 0, company), rs: rs ? round3(toBase(d, rs.parts[cleReglement(p, i)] || 0, company)) : 0, remboursement: estRemboursement(p), method: m ? m[1] : (p.method || ''), reference: p.reference || '', note: p.note || '', docId: d.id, currency: d.currency || company.currency, accountId: p.accountId || '' });
      });
    });
    return rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  // CSV lisible par Excel en français : séparateur « ; », virgule décimale, BOM UTF-8.
  //
  // Les colonnes `money` et `date` sortent par leur propre branche et ne passent jamais par la
  // parade à l'injection de formule (9.1.1) : ce sont des chiffres que NOUS fabriquons, et un
  // montant négatif doit rester `-12,500`. Tout le reste est du texte venu de quelqu'un — un
  // libellé de ligne, un nom de client, un téléphone, une note — et c'est là qu'elle sert.
  function toCsv(rows, columns) {
    const cell = (v, type) => {
      if (type === 'money') return round3(v).toFixed(3).replace('.', ',');
      if (type === 'date') return fmtDate(v);
      let texte = String(v == null ? '' : v);
      if (Compta.csvDangereux(texte)) texte = '\'' + texte;
      return /[;"\n\r]/.test(texte) ? '"' + texte.replace(/"/g, '""') + '"' : texte;
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
    // La devise de l'entreprise a longtemps été un champ libre : « TND », « dinar » ou une faute de
    // frappe s'y sont enregistrés, et le nombre de décimales en dépend. On la ramène dans la liste.
    data.company.currency = normCurrency(data.company.currency);
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
    if (!Array.isArray(data.fiscalFilings)) data.fiscalFilings = [];
    // 6.0.0 : clôture de période. Rien à convertir — un dossier existant n'a simplement rien de
    // clôturé, et l'utilisateur clôture quand il veut.
    if (typeof data.closedUntil !== 'string') data.closedUntil = '';
    if (!Array.isArray(data.closureLog)) data.closureLog = [];
    if (!Array.isArray(data.clotures)) data.clotures = [];
    // 9.10.0 : les questions du cabinet. Absentes de cette liste, elles seraient jetées au prochain
    // chargement et le comptable n'aurait jamais de réponse — sans un mot (défaut `matricule`, 6.8.0).
    if (!Array.isArray(data.questionsCabinet)) data.questionsCabinet = [];
    // 10.13.0 : la signature retenue du cabinet. Une forme qu'on ne reconnaît pas ne se garde pas —
    // une empreinte vide retenue ferait refuser tous les envois signés, sans raison lisible.
    if (!data.cabinetSignature || typeof data.cabinetSignature !== 'object' || !String(data.cabinetSignature.empreinte || '').trim()) data.cabinetSignature = null;
    if (!Array.isArray(data.packs)) data.packs = [];   // 6.1.0 : historique des envois au cabinet
    if (!Array.isArray(data.licences)) data.licences = [];   // 7.33.0 : licences émises par l'éditeur
    if (!Array.isArray(data.ecrituresOD)) data.ecrituresOD = [];   // 8.9.0 : opérations diverses
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
      if (!PURCHASE_KINDS.some(k => k[0] === p.kind)) p.kind = 'facture';
      // 10.2.0 : le rattachement d'un avoir ou d'un acompte à la facture qu'il concerne. Absent de
      // cette liste, le champ serait jeté au prochain chargement et l'imputation disparaîtrait en
      // silence — le 409 resterait débiteur pour toujours (défaut `matricule`, 6.8.0).
      p.achatLie = PURCHASE_LIES.includes(p.kind) ? String(p.achatLie || '') : '';
      p.withholdingRate = Number(p.withholdingRate) || 0;
      p.fees = Number(p.fees) || 0;
      // La TVA récupérable se FIGE sur la pièce (10.14.0) : un achat d'avant la règle prend le régime
      // du jour une fois, puis ne bouge plus quand le régime change.
      if (typeof p.tvaRecuperable !== 'boolean') p.tvaRecuperable = assujettiTVA(data.company || {});
      // La devise d'un achat (10.1.0). Un achat d'avant n'en portait pas : on lui pose celle de la
      // société avec un taux de 1, donc ses chiffres ne bougent pas d'un millime. Le faire ici et
      // pas à la lecture évite qu'un achat sans devise traverse un écran qui, lui, en attendrait
      // une — un champ absent de cette liste est jeté au prochain chargement (défaut `matricule`
      // de la 6.8.0), et un champ jamais posé se réinvente.
      if (!p.currency) p.currency = (data.company || {}).currency || 'TND';
      if (p.currency === ((data.company || {}).currency || 'TND')) p.exchangeRate = 1;
      else p.exchangeRate = Number(p.exchangeRate) > 0 ? Number(p.exchangeRate) : '';
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
    // Le régime de TVA des pièces DÉJÀ émises se fige sur celui d'aujourd'hui (10.14.1, MR-06) : la
    // même parade que le timbre ci-dessus — la meilleure réponse qu'on ait sur le passé, et la seule
    // qui empêche le prochain changement de régime de réécrire leur mention.
    const regimeCourant = regimeOf(data.company || {}).id;
    data.documents.forEach(x => {
      if ((x.type === 'facture' || x.type === 'avoir') && x.status && x.status !== 'brouillon' && !x.regimeTva) x.regimeTva = regimeCourant;
    });
    data.version = 6;
    return data;
  }

  // ---------- récurrences (contrats) ----------

  const PERIODS = [['month', 'Chaque mois'], ['quarter', 'Chaque trimestre'], ['year', 'Chaque année']];
  const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function monthLabel(iso) { const [y, m] = (iso || today()).split('-'); return `${MONTHS_FR[Number(m) - 1]} ${y}`; }
  // « de » devant un nom, élidé devant une voyelle : « d'août », « d'octobre », « de mars ». Jumelle
  // exacte de `de` du Cabinet (cabcore.js) : un test compare les deux corps.
  function deLibelle(label) { return (/^[aeiouéèê]/i.test(label) ? 'd\'' : 'de ') + label; }

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
  // `client` (10.12.0) : l'exonération de timbre du client (9.1.1) se reprend ICI aussi. Les deux
  // autres chemins de création la copiaient (le choix du client dans l'éditeur, la facture tirée
  // d'un devis — E-02) ; un contrat posait `applyStamp: true` en dur, et chaque facture mensuelle
  // d'un client exonéré portait un timbre — le troisième jumeau, trouvé en écrivant la bulle du
  // formulaire de contrat qui promettait le contraire.
  function buildRecurringInvoice(rec, dateIso, company, client) {
    const vars = { mois: monthLabel(dateIso), annee: dateIso.slice(0, 4) };
    return {
      type: 'facture', number: '', status: 'brouillon', date: dateIso, dueDate: addDays(dateIso, delaiJours(company.paymentTermsDays, 30)),
      clientId: rec.clientId, subject: fillTemplate(rec.subject, vars), reference: rec.reference || '',
      lines: (rec.lines || []).map(l => ({ ...l, label: fillTemplate(l.label, vars), description: fillTemplate(l.description || '', vars) })),
      discountRate: rec.discountRate || 0, applyStamp: !(client && client.stampExempt), notes: fillTemplate(rec.notes || '', vars), payments: [],
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
        if (d.type === 'facture') (d.payments || []).forEach(p => { const k = (p.date || '').slice(0, 7); if (byKey[k]) byKey[k].collected = round3(byKey[k].collected + montantRegle(d, p, company)); });
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
    // Dans un lot, les pièces se rangent par client une fois (10.14.0) : la liste des clients
    // relisait les huit mille pièces pour chacun des mille cinq cents clients.
    const docs = lot
      ? (duLot(data, 'piecesParClient', () => {
        const m = new Map();
        (data.documents || []).forEach(d => { if (!m.has(d.clientId)) m.set(d.clientId, []); m.get(d.clientId).push(d); });
        return m;
      }).get(clientId) || []).slice()
      : (data.documents || []).filter(d => d.clientId === clientId);
    const issued = docs.filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.status !== 'annulée');
    const ht = round3(issued.reduce((s, d) => s + (d.type === 'avoir' ? -1 : 1) * toBase(d, computeTotals(d, company).netHT, company), 0));
    const invoices = docs.filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée');
    const paid = round3(invoices.reduce((s, d) => s + toBase(d, (d.payments || []).reduce((x, p) => x + (Number(p.amount) || 0), 0), company), 0));
    const due = round3(invoices.reduce((s, d) => s + Math.max(0, toBase(d, invoiceBalance(d, data, company).remaining, company)), 0));
    // Ce qu'on DOIT à ce client (10.14.0) : les trop-perçus de ses factures et ses avoirs libres. Le
    // « reste à payer » de sa fiche ne les retranchait pas — 1 012,500 DT affichés quand il nous doit
    // 505,560 net. Le calcul est celui du relevé (`releveClient`), à la même règle près : un avoir
    // rattaché est déjà dans le reste de sa facture.
    const aRendre = round3(invoices.reduce((s, d) => s + Math.max(0, -toBase(d, invoiceBalance(d, data, company).remaining, company)), 0)
      + issued.filter(d => d.type === 'avoir' && !d.creditOf).reduce((s, d) => s + Math.max(0, toBase(d, computeTotals(d, company).netToPay, company)), 0));
    // La retenue que ce client gardera encore pour l'État en payant (10.14.0) : son compte 411 la
    // porte jusqu'à l'encaissement, la fiche la dit à côté du net qu'il versera — le miroir de
    // `supplierSummary.rsAOperer`.
    const rsASubir = round3(issued.reduce((s, d) => s + retenueASubir(d, data, company), 0));
    const dates = docs.map(d => d.date).filter(Boolean).sort();
    const quotes = docs.filter(d => d.type === 'devis');
    const accepted = quotes.filter(d => d.status === 'accepté').length;
    const decided = accepted + quotes.filter(d => d.status === 'refusé').length;
    // Délai moyen de paiement de ce client : on raisonne sur l'ensemble des données (les avoirs comptent)
    const delays = [];
    invoices.forEach(d => {
      if (effectiveStatus(d, data, company, '9999-12-31') !== 'payée' || !(d.payments || []).length) return;
      const last = dateDernierReglement(d);
      if (last && d.date) delays.push(delaiConstate(d.date, last));
    });
    return {
      docs, ht, paid, due, aRendre, net: round3(due - aRendre), rsASubir, count: docs.length, invoiceCount: invoices.length, quoteCount: quotes.length,
      first: dates[0] || '', last: dates[dates.length - 1] || '',
      conversion: decided ? Math.round(accepted / decided * 100) : null,
      delay: delays.length ? Math.round(delays.reduce((s, x) => s + x, 0) / delays.length) : null
    };
  }

  // Un délai CONSTATÉ ne descend pas sous zéro : une facture réglée avant sa date (un acompte encaissé
  // sur place, une facture datée d'après coup) ou un devis dont la facture précède la date (un devis
  // antidaté) ont été payés ou acceptés « tout de suite ». Rendre −3 faisait écrire « délai moyen :
  // −3 jours » à l'écran (rapport QA, 10.12.0) — un chiffre qu'aucune entreprise ne sait lire.
  function delaiConstate(de, a) { return Math.max(0, daysBetween(de, a)); }

  // Délai moyen (jours) entre la date de facture et le dernier paiement, sur les factures soldées de la période
  function avgPaymentDelay(data, company, fromIso, toIso) {
    const delays = [];
    (data.documents || []).filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée' && inPeriod(d.date, fromIso, toIso)).forEach(d => {
      if (effectiveStatus(d, data, company, '9999-12-31') !== 'payée' || !(d.payments || []).length) return;
      const last = dateDernierReglement(d);
      if (last && d.date) delays.push(delaiConstate(d.date, last));
    });
    return delays.length ? Math.round(delays.reduce((s, x) => s + x, 0) / delays.length) : null;
  }

  // ---------- achats, fournisseurs et dépenses (3.0.0, données v4) ----------
  // Symétrique des ventes, mais on ne maîtrise ni la numérotation (c'est celle du fournisseur)
  // ni la date (c'est celle de sa facture) : rien n'est verrouillé, tout reste modifiable.
  // 10.2.0 : l'avoir fournisseur et l'acompte versé. Les deux manquaient, et les deux se ressaisissaient
  // à la main — un avoir en tapant des montants négatifs (ce qu'aucune comptabilité n'accepte, règle
  // 6.3.0), un acompte en ne le saisissant pas du tout jusqu'à la facture finale.
  // Le troisième élément est le pluriel, écrit en entier : le filtre des Achats ajoutait un « s » au
  // bout et affichait « Facture d'achats », « Acompte versés » (rapport QA, 10.12.0).
  const PURCHASE_KINDS = [
    ['facture', 'Facture d\'achat', 'Factures d\'achat'], ['depense', 'Dépense', 'Dépenses'],
    ['avoir', 'Avoir fournisseur', 'Avoirs fournisseurs'], ['acompte', 'Acompte versé', 'Acomptes versés']
  ];
  // Les pièces qui se RATTACHENT à une facture d'achat. Un avoir la diminue, un acompte l'a déjà
  // payée en partie : dans les deux cas le montant se saisit POSITIF et c'est le sens de la pièce
  // qui décide de la colonne (règle 6.3.0).
  const PURCHASE_LIES = ['avoir', 'acompte'];
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
  const PURCHASE_STATUSES = ['à payer', 'partiel', 'retard', 'payée', 'à imputer', 'imputé', 'remboursé'];

  function expenseCategories(data) {
    const extra = (data && Array.isArray(data.expenseCategories) ? data.expenseCategories : [])
      .map(x => String(x || '').trim()).filter(Boolean);
    return Array.from(new Set(DEFAULT_EXPENSE_CATEGORIES.concat(extra)));
  }

  // Totaux d'un achat. Même moteur que les ventes, deux différences : pas de remise globale (elle est
  // déjà dans le prix du fournisseur) et la TVA peut être non déductible ligne par ligne.
  function purchaseTotals(purchase, company) {
    // Aux décimales de la devise de la pièce (10.14.1), comme une facture de vente : une facture
    // fournisseur en euros se lit et se paie au centime.
    const rd = arrondiDevise(purchase.currency || (company || {}).currency);
    const recuperable = tvaRecuperable(purchase, company);
    const lines = (purchase.lines || []).map(l => {
      const qty = Number(l.qty) || 0;
      const unit = Number(l.unitPrice) || 0;
      const rate = Number(l.vatRate) || 0;
      const ht = rd(qty * unit);
      const vat = rd(ht * rate / 100);
      return {
        ...l, qty, unitPrice: unit, vatRate: rate, ht, vat, ttc: rd(ht + vat),
        destination: LINE_DESTINATIONS.some(d => d[0] === l.destination) ? l.destination : 'charge',
        // TVA non déductible : voiture de tourisme, cadeaux, réception… À VÉRIFIER avec le comptable.
        // Et jamais pour une entreprise qui ne récupère pas la TVA (10.14.0).
        deductible: recuperable && l.deductible !== false
      };
    });
    const totalHT = rd(lines.reduce((s, l) => s + l.ht, 0));
    const vatByRate = {};
    lines.forEach(l => {
      const k = l.vatRate;
      vatByRate[k] = vatByRate[k] || { base: 0, vat: 0, deductible: 0 };
      vatByRate[k].base = rd(vatByRate[k].base + l.ht);
      vatByRate[k].vat = rd(vatByRate[k].vat + l.vat);
      if (l.deductible) vatByRate[k].deductible = rd(vatByRate[k].deductible + l.vat);
    });
    const totalVAT = rd(lines.reduce((s, l) => s + l.vat, 0));
    const deductibleVAT = rd(lines.filter(l => l.deductible).reduce((s, l) => s + l.vat, 0));
    const fees = rd(Number(purchase.fees) || 0);          // timbre du fournisseur, frais de port…
    const totalTTC = rd(totalHT + totalVAT + fees);
    // Retenue à la source que TU opères en payant un prestataire : tu la retiens et tu la reverses.
    // Qui doit retenir et à quel taux : À VÉRIFIER avec le comptable.
    const withholdingRate = Number(purchase.withholdingRate) || 0;
    const withholding = rd((totalHT + totalVAT) * withholdingRate / 100);
    const netToPay = rd(totalTTC - withholding);
    const byDestination = {};
    LINE_DESTINATIONS.forEach(([k]) => { byDestination[k] = 0; });
    lines.forEach(l => { byDestination[l.destination] = rd(byDestination[l.destination] + l.ht); });
    // La TVA NON DÉDUCTIBLE fait partie du coût de ce qu'elle a payé (10.14.0). Une voiture de
    // tourisme — le cas même que cite la case — vaut son prix TTC au bilan, et s'amortit TTC ; une
    // dépense de réception coûte TTC. Jusqu'ici l'écriture passait toute TVA non déductible en
    // charge (606), même sur un bien immobilisé, et le résultat simplifié l'oubliait tout à fait.
    // `byDestination` reste le HT (c'est ce que l'écran de la pièce affiche) ; `cout` est ce que
    // chaque destination COÛTE, et c'est lui que lisent l'écriture, le résultat et la fiche du bien.
    const ndByDestination = {};
    LINE_DESTINATIONS.forEach(([k]) => { ndByDestination[k] = 0; });
    lines.forEach(l => { if (!l.deductible) ndByDestination[l.destination] = rd(ndByDestination[l.destination] + l.vat); });

    // LA DEVISE DE L'ACHAT (10.1.0). Une facture fournisseur venue de l'étranger — une licence
    // logicielle, du matériel — est libellée en euros ou en dollars. Jusqu'ici l'achat n'avait
    // AUCUNE devise : ses chiffres étaient pris pour des dinars, et la TVA déductible, la charge,
    // le résultat, le seuil de rentabilité, la trésorerie, les écritures et le paquet du comptable
    // comptaient 1 000 DT là où l'entreprise avait payé 3 400 DT. Rien à l'écran ne le montrait.
    // C'est exactement la faute de la 7.0.1 (le timbre en euros) et de la 7.16.0 (les cartes de
    // l'accueil), jamais portée du côté des achats.
    //
    // La règle du projet : « tout ce qui ADDITIONNE plusieurs pièces se convertit dans la devise de
    // base ». Les montants natifs restent en tête — c'est ce que l'écran de LA pièce affiche, et
    // c'est ce que le fournisseur a écrit sur sa facture — et `base` porte les mêmes montants
    // convertis, pour tout ce qui agrège. Deux noms différents : un agrégateur qui oublie de
    // convertir se lit, au lieu de passer inaperçu.
    //
    // Sur un achat sans devise (tous ceux d'avant la 10.1.0, que la migration met à la devise de la
    // société avec un taux de 1), `base` est identique aux montants natifs : aucun chiffre existant
    // ne bouge.
    // LE SENS DE LA PIÈCE (10.2.0). Un avoir fournisseur se saisit avec des montants POSITIFS — c'est
    // ce que le fournisseur a écrit sur son avoir — et son effet comptable est l'inverse d'une
    // facture. La règle apprise en 10.1.0 s'applique telle quelle : ce qui agrège lit `base`, donc
    // c'est `base` qui porte le signe. Les treize agrégateurs passés à `.base` deviennent justes
    // sans qu'aucun n'ait à se souvenir du sens — là où les ventes recopient
    // `type === 'avoir' ? -1 : 1` dans une quinzaine d'endroits, et où le premier qui l'oublie
    // fabrique un chiffre faux que rien ne montre.
    const sens = purchase.kind === 'avoir' ? -1 : 1;
    const conv = v => round3(sens * toBase(purchase, v, company || {}));
    const baseVatByRate = {};
    Object.keys(vatByRate).forEach(k => {
      baseVatByRate[k] = { base: conv(vatByRate[k].base), vat: conv(vatByRate[k].vat), deductible: conv(vatByRate[k].deductible) };
    });
    // UN ACOMPTE N'EST PAS UNE CHARGE (10.2.0). C'est de l'argent posé d'avance sur un fournisseur
    // qui n'a pas encore livré : une créance, pas une consommation. Plutôt que de demander à chaque
    // agrégateur de s'en souvenir — le défaut même que `base` existe pour éviter —, ses
    // destinations sont VIDES et le montant vit dans `base.avance`. Le résultat, le seuil de
    // rentabilité, la marge d'une affaire et le stock deviennent justes sans une ligne de plus, et
    // un agrégateur écrit demain le sera aussi. Seul `journalEntries` connaît `avance` : c'est lui
    // qui doit savoir dans quel compte la ranger.
    const estAvance = purchase.kind === 'acompte';
    const baseByDestination = {}, baseNd = {}, baseCout = {};
    Object.keys(byDestination).forEach(k => {
      baseByDestination[k] = estAvance ? 0 : conv(byDestination[k]);
      baseNd[k] = estAvance ? 0 : conv(ndByDestination[k]);
      baseCout[k] = round3(baseByDestination[k] + baseNd[k]);
    });
    const base = {
      totalHT: conv(totalHT), totalVAT: conv(totalVAT), deductibleVAT: conv(deductibleVAT),
      fees: estAvance ? 0 : conv(fees), totalTTC: conv(totalTTC), withholding: conv(withholding),
      netToPay: conv(netToPay), vatByRate: baseVatByRate, byDestination: baseByDestination,
      nonDeductibleParDestination: baseNd, cout: baseCout,
      avance: estAvance ? conv(round3(totalHT + fees)) : 0
    };
    return {
      lines, totalHT, vatByRate, totalVAT, deductibleVAT, fees, totalTTC, withholdingRate, withholding, netToPay, byDestination,
      nonDeductibleParDestination: ndByDestination,
      currency: purchase.currency || (company || {}).currency || '', rate: rateOf(purchase, company || {}), sens, base
    };
  }

  // Ce qu'un achat COÛTE, toutes destinations comprises : HT + TVA non déductible + frais, en
  // dinars et signé (un avoir en retire). Un acompte ne coûte rien — c'est une avance que sa facture
  // reprend en entier —, donc il vaut 0 : le compter avec sa facture faisait payer deux fois le
  // même chantier dans la marge d'une affaire (10.14.0).
  function coutAchat(t) {
    return round3(Object.keys(t.base.cout).reduce((s, k) => s + t.base.cout[k], 0) + t.base.fees);
  }

  // Les avoirs et les acomptes rattachés à une facture d'achat (10.2.0). Le symétrique de
  // `creditsFor` côté ventes. `achatLie` porte l'identifiant de la facture concernée ; tant qu'il
  // est vide, la pièce est LIBRE — un avoir qu'on n'a pas encore imputé, un acompte versé avant que
  // la facture n'arrive. C'est un état normal, pas une erreur : « À faire » le rappelle.
  function piecesLieesAchat(data, purchaseId, kind) {
    if (!purchaseId) return [];
    if (lot) {
      const idx = duLot(data, 'achatsLies', () => {
        const m = new Map();
        (data.purchases || []).forEach(p => { if (!p.achatLie) return; if (!m.has(p.achatLie)) m.set(p.achatLie, []); m.get(p.achatLie).push(p); });
        return m;
      });
      return (idx.get(purchaseId) || []).filter(p => !kind || p.kind === kind);
    }
    return (data.purchases || []).filter(p => p.achatLie === purchaseId && (!kind || p.kind === kind));
  }

  // Situation d'un achat : payé, reste dû. Le symétrique exact d'invoiceBalance.
  // `data` est FACULTATIF : sans lui, les pièces rattachées ne sont pas déduites — c'est ce que
  // veut l'écran d'une pièce isolée, et c'est ce qui garde compatibles les appels d'avant la 10.2.0.
  function purchaseBalance(purchase, company, data) {
    const totals = purchaseTotals(purchase, company);
    const paid = round3((purchase.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
    // Un avoir imputé est CONSOMMÉ par la facture qu'il diminue : le compter une seconde fois comme
    // un crédit en attente chez le fournisseur ferait payer deux fois moins.
    // Un avoir IMPUTÉ est consommé par la facture qu'il diminue : il ne vaut plus rien tout seul, et
    // un règlement porté dessus — le fournisseur qui rembourse en plus d'avoir avoisé — serait le
    // compter deux fois. Un avoir LIBRE, lui, est un crédit qu'on détient : son reste est négatif,
    // et il revient à zéro le jour où le fournisseur le rembourse pour de bon.
    if (purchase.kind === 'avoir') {
      return { totals, paid, liees: [], impute: 0, remaining: purchase.achatLie ? 0 : arrondiDevise(purchase.currency || (company || {}).currency)(paid - totals.netToPay) };
    }
    const liees = data ? piecesLieesAchat(data, purchase.id) : [];
    // Un avoir et un acompte se déduisent de la même façon, et dans la MÊME devise : un fournisseur
    // avoise et encaisse dans la devise où il a facturé. L'éditeur le refuse autrement.
    // Un avoir déjà REMBOURSÉ (en tout ou en partie) ne déduit que ce qui n'a pas été rendu (10.14.0) :
    // l'argent reçu est entré en trésorerie et au 401, le déduire en plus de la facture la faisait
    // passer pour payée pendant que le compte du fournisseur la disait due.
    // Dans la devise de la FACTURE (10.14.0) : l'éditeur refuse une autre devise depuis la 10.2.0,
    // mais une pièce enregistrée avant ne se relit pas autrement.
    const impute = round3(liees.reduce((s, x) => {
      const n = purchaseTotals(x, company).netToPay;
      if (x.kind !== 'avoir') return s + montantDansDeviseDe(x, n, purchase, company);
      const rendu = round3((x.payments || []).reduce((t, y) => t + (Number(y.amount) || 0), 0));
      return s + montantDansDeviseDe(x, Math.max(0, round3(n - rendu)), purchase, company);
    }, 0));
    return { totals, paid, liees, impute, remaining: arrondiDevise(purchase.currency || (company || {}).currency)(totals.netToPay - paid - impute) };
  }

  // LA RETENUE À LA SOURCE S'OPÈRE AU RÈGLEMENT (10.14.0). Celui qui paie un prestataire retient une
  // part de ce qu'il lui VERSE, et la reverse à l'État le mois qui suit : tant qu'il n'a rien versé,
  // il n'a rien retenu. L'écriture de la facture la constatait, et la déclaration du mois de la
  // FACTURE la réclamait — y compris sur une facture jamais payée (32,130 DT « à reverser au fisc »
  // sur l'exemple), et dans la déclaration annuelle de l'année de la facture pendant que
  // l'attestation remise au fournisseur, datée du paiement, disait l'année suivante.
  // La retenue d'une pièce se répartit sur ses règlements au prorata de ce qu'ils versent, et le
  // règlement qui SOLDE la pièce prend le reste : la retenue entière, au millime. À VÉRIFIER avec le
  // comptable : le fait générateur (le paiement) et la constatation (le fournisseur est crédité du
  // brut à la facture, la retenue naît au règlement).
  //
  // Ce qu'une pièce RATTACHÉE couvre de la facture, en net (ce que la facture ne versera pas) et en
  // brut (ce que le 401 ne portera plus). Un acompte couvre son montant entier : sa retenue a été
  // opérée quand il a été versé. Un avoir couvre ce qui n'a pas été remboursé.
  function imputationAchat(x, company) {
    const t = purchaseTotals(x, company);
    if (x.kind !== 'avoir') return { net: t.netToPay, brut: round3(t.netToPay + t.withholding) };
    const rendu = round3((x.payments || []).reduce((s, y) => s + (Number(y.amount) || 0), 0));
    const net = Math.max(0, round3(t.netToPay - rendu));
    if (net <= 0.0005) return { net: 0, brut: 0 };
    return { net, brut: round3(t.netToPay + t.withholding - rendu - retenueDesReglements(x, company).operee) };
  }

  // Le moteur des DEUX côtés (10.14.0) : la retenue d'une pièce naît à chacun de ses règlements, au
  // prorata de ce qu'il verse, et le règlement qui SOLDE prend le reste — la retenue entière, au
  // millime. Une pièce rattachée (un avoir, un acompte) diminue ce qui est dû à SA date : posée après
  // un règlement, elle RÉGULARISE ce qui a déjà été retenu, le jour où elle existe. Recalculer la part
  // d'un règlement déjà passé réécrivait la retenue d'un mois déjà déclaré — un avoir émis en avril
  // changeait la déclaration de mars, sans un mot.
  //   `liees`     [{ key, date, net, brut }] — ce que chaque pièce rattachée couvre (date '' : dès
  //               l'origine, comme un acompte imputé à la facture même) ;
  //   `paiements` [{ key, date, amount }], dans la devise de la pièce.
  // Rend la part de chaque règlement (`parts`), la régularisation de chaque pièce rattachée
  // (`ajustements`), la retenue que la pièce doit encore porter (`due`) et celle déjà née (`operee`).
  // Rien n'est retenu tant que rien n'est versé : une pièce couverte sans aucun paiement ne porte rien.
  function retenueChrono(net, brut, liees, paiements) {
    const ev = (liees || []).map((x, i) => ({ ...x, lie: true, i }))
      .concat((paiements || []).map((x, i) => ({ ...x, lie: false, i })))
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.lie === b.lie ? a.i - b.i : (a.lie ? -1 : 1)));
    let netDu = round3(net), brutDu = round3(brut), cum = 0, reconnu = 0;
    const parts = {}, ajustements = {};
    const cible = () => {
      const due = round3(brutDu - netDu);
      if (!due || cum <= 0.0005) return 0;
      return cum >= netDu - 0.0005 ? due : round3(due * cum / netDu);
    };
    ev.forEach(x => {
      if (x.lie) { netDu = round3(netDu - (Number(x.net) || 0)); brutDu = round3(brutDu - (Number(x.brut) || 0)); }
      else cum = round3(cum + (Number(x.amount) || 0));
      const c = cible(), d = round3(c - reconnu);
      reconnu = c;
      if (!x.lie) parts[x.key] = d;
      else if (d) ajustements[x.key] = round3((ajustements[x.key] || 0) + d);
    });
    return { parts, ajustements, due: round3(brutDu - netDu), operee: reconnu, netDu, brutDu };
  }
  const cleReglement = (y, i) => (y && y.id) || '#' + i;

  // La part de la retenue que chaque règlement opère (dans la devise de la pièce, signe de la pièce :
  // positive, un avoir compris — c'est le lecteur qui applique le sens). `due` est ce que les
  // règlements de CETTE pièce doivent opérer, `operee` ce qu'ils ont opéré, `ajustements` ce qu'un
  // avoir posé après un règlement a régularisé, à sa date.
  function retenueDesReglements(purchase, company, data) {
    const p = purchase || {};
    const t = purchaseTotals(p, company);
    const liees = (p.kind !== 'avoir' && p.kind !== 'acompte' && data) ? piecesLieesAchat(data, p.id).map(x => {
      const im = imputationAchat(x, company);
      // Un acompte est imputé par la facture même : il couvre dès l'origine. Un avoir, à sa date.
      return { key: x.id, date: x.kind === 'acompte' ? '' : (x.date || ''),
        net: montantDansDeviseDe(x, im.net, p, company), brut: montantDansDeviseDe(x, im.brut, p, company) };
    }) : [];
    return retenueChrono(t.netToPay, round3(t.netToPay + t.withholding), liees,
      (p.payments || []).map((y, i) => ({ key: cleReglement(y, i), date: y.date || '', amount: Number(y.amount) || 0 })));
  }

  // Les régularisations de retenue qu'un avoir fournisseur porte sur la facture qu'il diminue, datées
  // de l'avoir, en dinars au taux de la FACTURE (celui auquel le 401 et le 4352 la portent), au sens
  // d'une retenue opérée : négative quand l'avoir en diminue une déjà née. Une par avoir concerné.
  // Dans un LOT, la liste entière des régularisations se calcule UNE fois (10.14.1, AN-01) : la page
  // TVA la demande mois par mois, et chaque mois relisait toutes les pièces pour n'en garder qu'une
  // poignée. Le filtre de période s'applique ensuite, sur une copie.
  function regularisationsRetenueAchats(data, company, period) {
    const toutes = duLot(data, 'regul:achats', () => regularisationsRetenueAchatsCalcul(data, company));
    return toutes.filter(r => inPeriod(r.date, period && period.from, period && period.to)).map(r => ({ ...r }));
  }
  function regularisationsRetenueAchatsCalcul(data, company) {
    const out = [];
    const achats = new Map((data.purchases || []).map(x => [x.id, x]));
    (data.purchases || []).forEach(p => {
      if (p.kind === 'avoir' || p.kind === 'acompte') return;
      const rs = retenueDesReglements(p, company, data);
      Object.keys(rs.ajustements).forEach(k => {
        const av = achats.get(k);
        if (!av) return;
        out.push({ purchaseId: p.id, avoirId: av.id, date: av.date, number: p.number || '', avoirNumber: av.number || '',
          supplierId: p.supplierId || '', rs: round3(toBase(p, rs.ajustements[k], company)) });
      });
    });
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  // LE MIROIR, CÔTÉ VENTES (10.14.0) : la retenue que ton CLIENT opère sur ce qu'il te verse. Elle
  // naît quand il paie, comme celle que tu opères sur tes fournisseurs — c'est ce jour-là qu'il la
  // garde, la déclare, et te remet l'attestation qui te permet de la déduire de ton impôt. L'écriture
  // de la facture la constatait comme une créance sur l'État dès l'émission, la page TVA la comptait
  // dans le mois de la FACTURE, et « À faire » réclamait l'attestation de factures que personne
  // n'avait encore réglées. Même moteur que les achats : au prorata de chaque encaissement, le
  // dernier prend le reste, un avoir posé après un encaissement régularise à sa date.
  function retenueSubie(doc, data, company) {
    const d = doc || {};
    if (d.type !== 'facture' || d.status === 'brouillon' || d.status === 'annulée') return retenueChrono(0, 0, [], []);
    const t = computeTotals(d, company);
    const liees = data ? creditsFor(data, d.id).map(a => {
      const ta = computeTotals(a, company);
      return { key: a.id, date: a.date || '', net: montantDansDeviseDe(a, ta.netToPay, d, company),
        brut: montantDansDeviseDe(a, round3(ta.netToPay + ta.withholding), d, company) };
    }) : [];
    return retenueChrono(t.netToPay, round3(t.netToPay + t.withholding), liees,
      (d.payments || []).map((y, i) => ({ key: cleReglement(y, i), date: y.date || '', amount: Number(y.amount) || 0 })));
  }

  // Ce que les encaissements à venir laisseront encore au client pour l'État, en dinars : l'écart
  // entre ce que le 411 porte (le brut, ce que la pièce vaut) et ce que le client versera (le net).
  // Un avoir LIBRE porte sa retenue en moins, comme un avoir fournisseur non imputé.
  // `natif` : dans la devise de la pièce (le relevé d'un client facturé en euros, 10.14.1).
  function retenueASubir(piece, data, company, natif) {
    const d = piece || {};
    const conv = x => natif ? round3(x) : toBase(d, x, company);
    if (d.status === 'brouillon' || d.status === 'annulée' || !d.number) return 0;
    if (d.type === 'avoir') return d.creditOf ? 0 : round3(-conv(computeTotals(d, company).withholding));
    if (d.type !== 'facture') return 0;
    const rs = retenueSubie(d, data, company);
    return round3(conv(round3(rs.due - rs.operee)));
  }

  // Les régularisations de retenue subie qu'un avoir de vente porte sur la facture qu'il corrige.
  function regularisationsRetenueVentes(data, company, period) {
    const toutes = duLot(data, 'regul:ventes', () => regularisationsRetenueVentesCalcul(data, company));
    return toutes.filter(r => inPeriod(r.date, period && period.from, period && period.to)).map(r => ({ ...r }));
  }
  function regularisationsRetenueVentesCalcul(data, company) {
    const out = [];
    const docs = new Map((data.documents || []).map(d => [d.id, d]));
    (data.documents || []).forEach(d => {
      if (d.type !== 'facture' || d.status === 'brouillon' || d.status === 'annulée' || !d.number) return;
      const rs = retenueSubie(d, data, company);
      Object.keys(rs.ajustements).forEach(k => {
        const av = docs.get(k);
        if (!av) return;
        out.push({ docId: d.id, avoirId: av.id, date: av.date, number: d.number, avoirNumber: av.number || '',
          clientId: d.clientId || '', rs: round3(toBase(d, rs.ajustements[k], company)) });
      });
    });
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  // Les retenues nées dans une période, d'un côté : celles des règlements, plus les régularisations
  // des avoirs. UNE somme pour la page TVA, les cartes, et le paquet du comptable (6.8.1).
  function retenuesDeLaPeriode(data, company, period, cote) {
    const ventes = cote === 'ventes';
    const reglements = ventes ? paymentsJournal(data, company, period) : supplierPayments(data, company, period);
    const regul = ventes ? regularisationsRetenueVentes(data, company, period) : regularisationsRetenueAchats(data, company, period);
    const deReglements = round3(reglements.reduce((s, r) => s + (r.rs || 0), 0));
    const deRegul = round3(regul.reduce((s, r) => s + (r.rs || 0), 0));
    return { total: round3(deReglements + deRegul), reglements: deReglements, regularisations: deRegul, lignesRegul: regul };
  }

  // Les factures dont le client a DÉJÀ retenu quelque chose et dont l'attestation n'est pas arrivée
  // (10.14.0). Une facture pas encore payée n'a rien retenu : on ne réclame pas l'attestation du néant.
  // `amount` en dinars ; une seule définition pour « À faire », la page Comptabilité et le paquet.
  function attestationsARecevoir(data, company, period) {
    const out = [];
    (data.documents || []).forEach(d => {
      if (d.type !== 'facture' || d.withholdingCertificate || d.status === 'brouillon' || d.status === 'annulée' || !d.number) return;
      if (!(Number(d.withholdingRate) > 0) || !(d.payments || []).length) return;
      const rs = retenueSubie(d, data, company);
      if (rs.operee <= 0.0005) return;
      if (period && !(d.payments || []).some((y, i) => inPeriod(y.date, period.from, period.to) && (rs.parts[cleReglement(y, i)] || 0) > 0.0005)) return;
      out.push({ doc: d, id: d.id, number: d.number, clientId: d.clientId || '', date: d.date,
        native: rs.operee, amount: round3(toBase(d, rs.operee, company)), complete: rs.operee >= rs.due - 0.0005 });
    });
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  // Ce que les règlements à venir retiendront encore pour l'État, en dinars et au sens de la pièce :
  // l'écart entre ce que le 401 porte (le brut) et ce qu'on versera au fournisseur (le net). Un avoir
  // IMPUTÉ n'a plus rien à lui : c'est la facture qu'il diminue qui le compte.
  function retenueAOperer(purchase, company, data) {
    const p = purchase || {};
    if (p.kind === 'avoir' && p.achatLie) return 0;
    const rs = retenueDesReglements(p, company, data);
    return round3((p.kind === 'avoir' ? -1 : 1) * toBase(p, round3(rs.due - rs.operee), company));
  }

  // Un règlement qui RAMÈNE de l'argent du fournisseur (10.14.0) : tout règlement porté par un avoir
  // (il le rembourse), et un règlement négatif sur une facture payée plus que son montant.
  function estRemboursementAchat(purchase, pay) {
    return !!purchase && !!pay && (purchase.kind === 'avoir' || (Number(pay.amount) || 0) < 0);
  }

  // Un avoir LIBRE que le fournisseur a remboursé en entier : il ne porte plus aucun crédit.
  function avoirRembourse(purchase, b) {
    return !!purchase && purchase.kind === 'avoir' && !purchase.achatLie && b.paid > 0.0005 && b.remaining >= -0.0005;
  }

  // Une pièce fournisseur à rattacher à sa facture (10.2.0) : un avoir qui porte encore un crédit, un
  // acompte sans facture. UNE règle pour la ligne de « À faire » et le filtre de la liste qu'elle
  // ouvre (6.8.1) — un avoir déjà remboursé n'a plus rien à déduire, le rattacher le compterait deux fois.
  function aRattacherAchat(purchase, company, data) {
    if (!purchase || !PURCHASE_LIES.includes(purchase.kind) || purchase.achatLie) return false;
    if (purchase.kind !== 'avoir') return true;
    return purchaseBalance(purchase, company, data).remaining < -0.0005;
  }

  // Statut déduit des paiements, jamais saisi — comme pour une facture de vente.
  // Une facture fournisseur saisie deux fois (7.16.0). Rien ne la signalait : elle entre alors deux
  // fois dans la TVA déductible, dans la charge, dans les écritures — sous le même numéro — et dans
  // le paquet du comptable. `duplicatePurchase` prévient déjà, mais c'est le cas où l'utilisateur
  // SAIT qu'il duplique ; le cas dangereux est la ressaisie de bonne foi trois semaines plus tard.
  // Pur et testable : on compare fournisseur + numéro, en ignorant la casse et les espaces.
  // Les factures déjà tirées d'un devis (7.16.0). La règle vivait enfouie dans `todoList` ; elle sert
  // aussi à l'éditeur, qui proposait « Facturer ce devis » à l'identique sur un devis DÉJÀ facturé —
  // un second clic fabriquait un second brouillon complet. Pire avec un acompte : l'acompte fait
  // passer le devis à « accepté », donc le seul bouton coloré proposait ensuite une facture de 100 %
  // pendant que l'action juste, « Facture de solde », dormait dans le menu « ▾ ».
  function facturesDuDevis(data, quoteId) {
    if (!quoteId) return [];
    if (lot) {
      const idx = duLot(data, 'facturesDuDevis', () => {
        const m = new Map();
        (data.documents || []).forEach(d => { if (d.type !== 'facture' || !d.fromQuoteId) return; if (!m.has(d.fromQuoteId)) m.set(d.fromQuoteId, []); m.get(d.fromQuoteId).push(d); });
        return m;
      });
      return (idx.get(quoteId) || []).slice();
    }
    return (data.documents || []).filter(d => d.type === 'facture' && d.fromQuoteId === quoteId);
  }

  // La référence d'un achat dans les ÉCRITURES (10.14.1, LET-01) : le numéro du fournisseur, sinon
  // « SN- » et sa date (« SN-20260914 », « SN-20260914-2 » pour le deuxième du même jour). Une dépense
  // sans numéro — le carburant, la papeterie — s'écrivait avec la pièce « (sans numéro) », son
  // règlement avec une pièce VIDE, et sa lettre de lettrage était son identifiant interne
  // (« muhp44v9q0rsl9 » dans la colonne Let. du livre-journal, dans le CSV du comptable et comme nom
  // de dossier dans le paquet). Deux dépenses du même jour portaient la même pièce : le 📎 de l'une se
  // posait sur l'autre au Cabinet. La référence est lisible, unique, et la même partout ; l'ordre
  // entre deux pièces du même jour suit leur identifiant, donc elle ne bouge pas d'un calcul à l'autre.
  function referencesSansNumeroCalcul(data) {
    const parJour = {};
    (data && data.purchases || []).forEach(p => {
      if (!p || String(p.number || '').trim()) return;
      (parJour[p.date || ''] = parJour[p.date || ''] || []).push(p);
    });
    const refs = {};
    Object.keys(parJour).forEach(jour => {
      const base = 'SN-' + (String(jour).replace(/-/g, '') || 'sans-date');
      parJour[jour].slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .forEach((p, i) => { refs[p.id] = i ? `${base}-${i + 1}` : base; });
    });
    return refs;
  }
  function referenceAchat(p, data) {
    if (!p) return '';
    const num = String(p.number || '').trim();
    if (num) return num;
    return duLot(data, 'refsSansNumero', () => referencesSansNumeroCalcul(data))[p.id] || 'SN';
  }

  function achatDoublon(data, achat) {
    if (!achat || achat.kind === 'depense') return null;       // une dépense n'a pas de numéro qui fasse foi
    const num = String(achat.number || '').trim().toLowerCase();
    if (!num || !achat.supplierId) return null;
    // Un avoir peut légitimement porter le même numéro qu'une facture chez certains fournisseurs :
    // ce sont deux séries différentes. On ne compare que des pièces de même nature (10.2.0).
    const kind = achat.kind || 'facture';
    return (data.purchases || []).find(x => x.id !== achat.id && x.supplierId === achat.supplierId
      && (x.kind || 'facture') === kind
      && String(x.number || '').trim().toLowerCase() === num) || null;
  }

  function purchaseStatus(purchase, company, todayIso, data) {
    const b = purchaseBalance(purchase, company, data);
    // Un avoir libre que le fournisseur a remboursé en entier n'a plus rien à imputer (10.14.0) : le
    // dire « à imputer » faisait chercher une facture où le déduire, c'est-à-dire le compter deux fois.
    if (purchase.kind === 'avoir') return purchase.achatLie ? 'imputé' : (avoirRembourse(purchase, b) ? 'remboursé' : 'à imputer');
    if (b.remaining <= 0.0005) return 'payée';
    if (b.paid > 0 || b.impute > 0) return 'partiel';
    if (purchase.dueDate && purchase.dueDate < (todayIso || today())) return 'retard';
    return 'à payer';
  }

  // Ce qu'on doit, par fournisseur et par échéance. Le pendant des relances, côté sortant.
  function payablesList(data, company, todayIso) {
    const t = todayIso || today();
    return (data.purchases || []).map(p => {
      // Un avoir n'est jamais une dette : il ne se règle pas, il s'impute. Rien à filtrer ici —
      // `purchaseBalance` rend déjà un reste nul ou négatif pour un avoir, et un garde-fou de plus
      // serait du code qu'aucun test ne peut faire tomber.
      const b = purchaseBalance(p, company, data);
      if (b.remaining <= 0.0005) return null;
      const late = p.dueDate && p.dueDate < t ? daysBetween(p.dueDate, t) : 0;
      return {
        id: p.id, supplierId: p.supplierId, number: p.number || '', date: p.date, dueDate: p.dueDate || '',
        subject: p.subject || '', remaining: toBase(p, b.remaining, company), total: b.totals.base.netToPay, late,
        currency: p.currency || company.currency, status: purchaseStatus(p, company, t, data)
      };
    }).filter(Boolean).sort((a, b) => (b.late - a.late) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }

  // Journal des décaissements : un règlement fournisseur par ligne. Le symétrique de paymentsJournal.
  function supplierPayments(data, company, period) {
    const name = id => ((data.suppliers || []).find(s => s.id === id) || {}).name || '—';
    const out = [];
    (data.purchases || []).forEach(p => {
      const pays = (p.payments || []).filter(x => inPeriod(x.date, period && period.from, period && period.to));
      if (!pays.length) return;
      // La retenue que ce règlement opère (10.14.0) : elle naît au paiement, en dinars au taux de la
      // pièce — celui auquel le 401 porte le brut.
      const rs = retenueDesReglements(p, company, data);
      pays.forEach(x => {
        const m = PAYMENT_METHODS.find(k => k[0] === x.method);
        const rsNatif = rs.parts[x.id || '#' + (p.payments || []).indexOf(x)] || 0;
        out.push({
          id: x.id, purchaseId: p.id, date: x.date, number: p.number || '', piece: referenceAchat(p, data), supplier: name(p.supplierId), supplierId: p.supplierId || '',
          // Un règlement porté par un AVOIR est un remboursement : l'argent ENTRE (10.2.0). Le signe
          // suffit — `entrySet` change alors la colonne tout seul, et la trésorerie suit.
          amount: round3((p.kind === 'avoir' ? -1 : 1) * montantRegle(p, x, company)),
          amountTiers: round3((p.kind === 'avoir' ? -1 : 1) * toBase(p, Number(x.amount) || 0, company)), method: m ? m[1] : (x.method || ''),
          rs: round3((p.kind === 'avoir' ? -1 : 1) * toBase(p, rsNatif, company)),
          currency: p.currency || company.currency, reference: x.reference || '', note: x.note || '', accountId: x.accountId || ''
        });
      });
    });
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  // La TVA déductible des acomptes imputés sur une facture d'achat : son total, et par taux. Même
  // règle que l'imputation du journal — une seule définition pour l'écriture et la déclaration.
  function acomptesDeduits(data, purchase, company) {
    const out = { total: 0, byRate: {} };
    if (!data || purchase.kind === 'avoir' || purchase.kind === 'acompte') return out;
    piecesLieesAchat(data, purchase.id, 'acompte').forEach(a => {
      const ta = purchaseTotals(a, company);
      out.total = round3(out.total + ta.base.deductibleVAT);
      Object.keys(ta.base.vatByRate || {}).forEach(r => { out.byRate[r] = round3((out.byRate[r] || 0) + (ta.base.vatByRate[r].deductible || 0)); });
    });
    return out;
  }

  // Journal des achats d'une période : une ligne par pièce, prête pour le CSV du comptable.
  function purchaseJournal(data, company, period) {
    const name = id => ((data.suppliers || []).find(s => s.id === id) || {}).name || '—';
    return (data.purchases || [])
      .filter(p => inPeriod(p.date, period && period.from, period && period.to))
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0))
      .map(p => {
        const t = purchaseTotals(p, company);
        // La TVA d'un acompte rattaché a déjà été déduite le mois où l'acompte a été versé ; la
        // facture porte la TVA du montant ENTIER, acompte compris. L'écriture le sait depuis la
        // 10.2.0 (l'imputation recrédite le 4366) ; la déclaration, elle, la déduisait une seconde
        // fois. Ce qui reste déductible sur la facture est sa TVA MOINS celle des acomptes imputés.
        const deductibleAcompte = acomptesDeduits(data, p, company);
        return {
          // `piece` : la référence de l'achat dans les écritures — son numéro, ou « SN-AAAAMMJJ » quand
          // le fournisseur n'en a pas donné (10.14.1, LET-01). C'est elle qui nomme son dossier dans
          // le paquet : le journal des achats la porte pour que le comptable les rapproche.
          id: p.id, date: p.date, number: p.number || '', piece: referenceAchat(p, data), supplier: name(p.supplierId),
          kind: (PURCHASE_KINDS.find(k => k[0] === (p.kind || 'facture')) || PURCHASE_KINDS[0])[1], category: p.category || '',
          ht: t.base.totalHT, tva: t.base.totalVAT, deductible: round3(t.base.deductibleVAT - deductibleAcompte.total), deductibleAcompte: deductibleAcompte.total, fees: t.base.fees,
          ttc: t.base.totalTTC, rs: t.base.withholding, net: t.base.netToPay,
          currency: t.currency, rate: t.rate,
          status: purchaseStatus(p, company, '9999-12-31', data), subject: p.subject || ''
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
    const mine = lot
      ? (duLot(data, 'achatsParFournisseur', () => {
        const m = new Map();
        (data.purchases || []).forEach(p => { if (!m.has(p.supplierId)) m.set(p.supplierId, []); m.get(p.supplierId).push(p); });
        return m;
      }).get(supplierId) || []).slice()
      : (data.purchases || []).filter(p => p.supplierId === supplierId);
    let ht = 0, due = 0, aRecuperer = 0, late = 0, rsAOperer = 0;
    mine.forEach(p => {
      const b = purchaseBalance(p, company, data);
      // La retenue que les règlements à venir garderont pour l'État (10.14.0) : le compte du
      // fournisseur la porte jusqu'au paiement, la fiche la dit à côté du net à lui verser.
      rsAOperer = round3(rsAOperer + retenueAOperer(p, company, data));
      // Un acompte n'est pas un achat de plus : sa facture porte déjà le montant entier (10.14.0).
      if (p.kind !== 'acompte') ht = round3(ht + b.totals.base.totalHT);
      const reste = toBase(p, b.remaining, company);
      if (reste > 0.0005) {
        due = round3(due + reste);
        if (purchaseStatus(p, company, todayIso, data) === 'retard') late = round3(late + reste);
      }
      // Ce qu'on DÉTIENT chez ce fournisseur : un avoir non imputé (10.2.0), et un trop-payé sur une
      // facture (10.14.0). Les deux sont des crédits de même nature — la fiche comptait le premier
      // et oubliait le second, et disait 450 là où son compte 401 dit 350. Le net est celui du
      // compte, la règle de la fiche client (`clientSummary.net`).
      else if (reste < -0.0005) aRecuperer = round3(aRecuperer - reste);
    });
    const dates = mine.map(p => p.date).filter(Boolean).sort();
    return { count: mine.length, ht, due, aRecuperer, remaining: round3(due - aRecuperer), rsAOperer, late, first: dates[0] || '', last: dates[dates.length - 1] || '' };
  }

  // Retenues à la source que tu as opérées et dont le fournisseur attend l'attestation. Une retenue
  // s'opère au RÈGLEMENT (10.14.0) : une facture pas encore payée n'a rien retenu, et l'attestation
  // porte ce que les règlements ont retenu — pas la retenue entière d'une facture payée à moitié.
  function withholdingsToIssue(data, company) {
    const name = id => ((data.suppliers || []).find(s => s.id === id) || {}).name || '—';
    return (data.purchases || [])
      .filter(p => !p.withholdingCertificate && (p.payments || []).length && Number(p.withholdingRate) > 0)
      .map(p => ({ p, t: purchaseTotals(p, company), op: retenueDesReglements(p, company, data).operee }))
      .filter(x => x.op > 0.0005)
      .map(x => ({ id: x.p.id, supplier: name(x.p.supplierId), number: x.p.number || '', date: x.p.date,
        amount: round3((x.p.kind === 'avoir' ? -1 : 1) * toBase(x.p, x.op, company)), rate: x.t.withholdingRate }))
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
  // Le coût est dans la devise de la PIÈCE, comme son prix (10.14.1) : le coût du catalogue, tenu en
  // dinars, se convertit pour une pièce en euros — sinon 60 DT de coût se lisaient 60 € face à un
  // prix en euros, et la marge d'une vente à l'étranger plongeait sans raison.
  function lineCost(line, data, doc, company) {
    if (line.unitCost !== '' && line.unitCost != null && Number.isFinite(Number(line.unitCost))) {
      return round3((Number(line.unitCost) || 0) * (Number(line.qty) || 0));
    }
    const label = (line.label || '').trim().toLowerCase();
    const item = (data.catalog || []).find(c => (c.label || '').trim().toLowerCase() === label);
    if (item && Number(item.unitCost) > 0) {
      const cu = doc && company ? prixDuCatalogue(Number(item.unitCost), doc, company) : Number(item.unitCost);
      return cu == null ? 0 : round3(cu * (Number(line.qty) || 0));
    }
    return 0;
  }

  // Marge d'un document de vente. Les lignes de déduction d'acompte ne sont pas des ventes : elles
  // ne portent ni chiffre d'affaires ni coût.
  // Ce que la remise globale laisse d'une ligne remisable. La remise ne porte PAS sur les lignes
  // « noDiscount » (la déduction d'un acompte déjà facturé) : diviser le net par le total, déduction
  // comprise, appliquait la remise une seconde fois sur une facture de solde remisée — 160 DT de
  // chiffre d'affaires disparaissaient de la page Marges sur l'exemple (10.14.0). C'est la règle de
  // `computeTotals`, dite une fois.
  function facteurRemise(t) {
    const remisable = round3(t.lines.filter(l => !l.noDiscount).reduce((s, l) => s + l.ht, 0));
    return remisable > 0 ? (remisable - round3(t.totalHT - t.netHT)) / remisable : 1;
  }

  function documentMargin(doc, data, company) {
    const t = computeTotals(doc, company);
    const sign = doc.type === 'avoir' ? -1 : 1;
    let revenue = 0, cost = 0, known = 0, total = 0;
    const factor = facteurRemise(t);   // la remise globale ampute le prix, pas le coût
    t.lines.forEach(l => {
      if (l.noDiscount) return;
      total++;
      const c = lineCost(l, data, doc, company);
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
      const factor = facteurRemise(t);
      t.lines.forEach(l => {
        // Un acompte facturé, et sa déduction sur la facture de solde, SONT du chiffre d'affaires de
        // leur période : les ignorer faisait dire à la page Marges un autre chiffre d'affaires que
        // les Statistiques dès qu'un acompte et son solde tombaient dans deux périodes (10.14.0).
        // Ils n'ont pas de coût, et ils ne comptent pas comme des lignes « sans coût connu ».
        if (l.noDiscount) {
          const key = dimension === 'client' ? d.clientId : '__acomptes__';
          if (!key) return;
          const a = acc[key] || (acc[key] = {
            key, label: dimension === 'client' ? clientName(d.clientId) : 'Acomptes facturés (repris au solde)',
            revenue: 0, cost: 0, lines: 0, costed: 0
          });
          a.revenue = round3(a.revenue + sign * toBase(d, l.ht, company));
          return;
        }
        const key = dimension === 'client' ? d.clientId : (l.label || '').trim().toLowerCase();
        if (!key) return;
        const a = acc[key] || (acc[key] = {
          key, label: dimension === 'client' ? clientName(d.clientId) : (l.label || '').trim(),
          revenue: 0, cost: 0, lines: 0, costed: 0
        });
        const c = lineCost(l, data, d, company);
        a.revenue = round3(a.revenue + sign * toBase(d, round3(l.ht * factor), company));
        a.cost = round3(a.cost + sign * toBase(d, c, company));
        a.lines++; if (c > 0) a.costed++;
      });
    });
    // Un acompte et sa déduction dans la même période s'annulent : une ligne à zéro n'apprend rien.
    // La ligne des acomptes n'a pas de taux : son coût arrivera avec la facture de solde, et « 100 % »
    // serait une marge qu'elle n'a pas. Elle n'est pas non plus « sans coût connu » : elle n'a pas de
    // prestation, donc rien à chiffrer au catalogue.
    const rows = Object.values(acc).filter(a => a.lines > 0 || Math.abs(a.revenue) > 0.0005).map(a => ({
      ...a, margin: round3(a.revenue - a.cost), acomptes: a.key === '__acomptes__',
      rate: a.key !== '__acomptes__' && a.revenue !== 0 ? Math.round((a.revenue - a.cost) / a.revenue * 1000) / 10 : null,
      complete: a.lines === 0 || a.costed === a.lines
    })).sort((x, y) => y.margin - x.margin);
    // `limit` à 0 veut dire « tout ». La page Marges calculait ses trois cartes — chiffre d'affaires,
    // marge totale, coût des ventes — sur un tableau DÉJÀ tronqué à vingt lignes, quel que soit le
    // nombre de clients : au 21e, la carte « Chiffre d'affaires » annonçait moins que la réalité.
    // Et le tri est par marge DÉCROISSANTE, donc ce qui tombait en premier, ce sont les lignes à
    // marge négative — exactement celles qu'on vient chercher. `limit || 20` ramenait 0 à 20, ce qui
    // rendait le « tout » impossible à demander : d'où le test explicite (7.16.0).
    return limit === 0 ? rows : rows.slice(0, limit || 20);
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
      // L'encaissé est l'argent REÇU (10.14.0) : les règlements de la facture, un remboursement de
      // trop-perçu en moins. « Montant − reste » y ajoutait les avoirs, qui diminuent le reste sans
      // qu'un dinar n'entre : 2 040 annoncés pour 1 700 reçus, et le « rapporté en caisse » avec.
      if (d.type === 'facture') {
        collected = round3(collected + (d.payments || []).reduce((s, p) => s + montantRegle(d, p, company), 0));
      }
    });
    let cost = 0, paid = 0;
    buys.forEach(p => {
      const t = purchaseTotals(p, company);
      cost = round3(cost + coutAchat(t));
      // Un avoir remboursé RAPPORTE de l'argent (10.14.0) : son « réglé » vient en moins.
      paid = round3(paid + (p.kind === 'avoir' ? -1 : 1) * (p.payments || []).reduce((s, x) => s + montantRegle(p, x, company), 0));
    });
    // Devis en cours : ce qui est proposé mais pas encore FACTURÉ, pour voir l'affaire en entier. Un
    // devis entièrement facturé comptait encore « en devis » à côté de ses propres factures : la fiche
    // annonçait 5 520 DT facturés PLUS 5 520 DT en devis pour un seul chantier (10.12.0, une
    // menuiserie). La règle est celle de `todoList` : une facture totale ou de solde, ÉMISE, ferme le
    // devis ; un acompte émis se retranche (en HT, comme le reste de la carte).
    const quotes = (data.documents || []).filter(d => d.projectId === projectId && d.type === 'devis' && d.status !== 'brouillon');
    const tirees = (data.documents || []).filter(d => d.type === 'facture' && d.fromQuoteId && d.status !== 'brouillon' && d.status !== 'annulée');
    const fermes = new Set(tirees.filter(d => !d.deposit).map(d => d.fromQuoteId));
    const pending = round3(quotes.filter(q => q.status !== 'refusé' && !fermes.has(q.id)).reduce((s, q) => {
      const acomptes = tirees.filter(d => d.deposit && d.fromQuoteId === q.id).reduce((a, d) => a + toBase(d, computeTotals(d, company).netHT, company), 0);
      return s + Math.max(0, toBase(q, computeTotals(q, company).netHT, company) - acomptes);
    }, 0));
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

  // Les pièces d'un contrat récurrent (10.14.1). Une facture générée porte `recurringId` ; l'avoir
  // qui la corrige, non (`creditDraftFrom` ne le recopie pas) : il se retrouve par la facture qu'il
  // vise. Sans lui, la fiche du contrat disait « facturé, avoirs déduits » sans en déduire aucun.
  function piecesDuContrat(data, recurringId) {
    const docs = (data && data.documents) || [];
    const factures = docs.filter(d => d.type === 'facture' && d.recurringId === recurringId);
    const ids = new Set(factures.map(d => d.id));
    const avoirs = docs.filter(d => d.type === 'avoir' && d.creditOf && ids.has(d.creditOf) && d.status !== 'brouillon');
    return { factures, avoirs };
  }
  // Ce que la fiche d'un contrat annonce (10.14.1). Elle soustrayait un encaissé TTC (paiements ET
  // avoirs, au taux de la pièce) d'un facturé HT : une facture de 1 000 HT payée en entier laissait
  // « − 191 restant ». Trois chiffres, chacun dans SON unité, et aucun ne se déduit des autres :
  //   - facturé : le hors taxes des factures émises, avoirs déduits (en devise de la société) ;
  //   - encaissé : ce qui est arrivé à la banque, comme la Trésorerie le lit (`montantRegle`, taux du
  //     jour du règlement), remboursements déduits ;
  //   - restant : le reste dû de chaque facture (TTC, avoirs et retenue déduits), au taux de la pièce ;
  //     un trop-perçu se compte à part, il ne se retranche pas du reste d'une autre facture.
  function contratSuivi(data, company, recurringId) {
    const { factures, avoirs } = piecesDuContrat(data, recurringId);
    const emises = factures.filter(d => d.status !== 'brouillon' && d.status !== 'annulée');
    const ht = d => toBase(d, computeTotals(d, company).netHT, company);
    const facture = round3(emises.reduce((s, d) => s + ht(d), 0) - avoirs.reduce((s, a) => s + ht(a), 0));
    const encaisse = round3(emises.reduce((s, d) => s + (d.payments || []).reduce((t, p) => t + montantRegle(d, p, company), 0), 0));
    let restant = 0, tropPercu = 0;
    emises.forEach(d => {
      const r = toBase(d, invoiceBalance(d, data, company).remaining, company);
      if (r > 0) restant += r; else tropPercu -= r;
    });
    return {
      facture, encaisse, restant: round3(restant), tropPercu: round3(tropPercu),
      emises: emises.length, brouillons: factures.filter(d => d.status === 'brouillon').length, avoirs: avoirs.length
    };
  }

  // Rentabilité d'un contrat récurrent : ce qu'il a rapporté depuis le début, contre ce qu'il a coûté.
  // Les avoirs sur ses factures s'en retranchent (10.14.1) — `documentMargin` les compte en négatif.
  function recurringProfitability(data, company, recurringId) {
    const rec = (data.recurring || []).find(r => r.id === recurringId);
    const invoices = (data.documents || []).filter(d => d.recurringId === recurringId
      && d.status !== 'brouillon' && d.status !== 'annulée');
    let revenue = 0, cost = 0;
    piecesDuContrat(data, recurringId).avoirs.forEach(a => {
      const m = documentMargin(a, data, company);
      revenue = round3(revenue + toBase(a, m.revenue, company));
      cost = round3(cost + toBase(a, m.cost, company));
    });
    invoices.forEach(d => {
      const m = documentMargin(d, data, company);
      revenue = round3(revenue + toBase(d, m.revenue, company));
      cost = round3(cost + toBase(d, m.cost, company));
    });
    // Les achats rattachés au même client ET à la même affaire, s'il y en a une.
    const linked = (data.purchases || []).filter(p => rec && p.projectId && p.projectId === rec.projectId);
    linked.forEach(p => { cost = round3(cost + coutAchat(purchaseTotals(p, company))); });
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
  // Le seuil se construit sur les MÊMES morceaux que le résultat simplifié (10.14.0), et son
  // « Résultat » est celui de l'onglet TVA : deux résultats pour la même année, c'est un de trop.
  // Avant, il comptait ses propres mouvements — une échéance d'emprunt ENTIÈRE en charge fixe (son
  // capital est un remboursement de dette, pas une charge), un salaire payé par un mouvement ET le
  // bulletin du même salaire — et oubliait les écritures diverses, les intérêts passés au 651 et la
  // marchandise d'un article non suivi. Chaque morceau est rangé fixe ou variable ; la cession d'un
  // bien (sa valeur au 675, son prix au 775) n'est ni l'un ni l'autre : elle ne se répète pas, elle
  // entre dans le résultat sans déplacer le seuil.
  function breakEven(data, company, period) {
    const r = simpleResult(data, company, period);
    const revenue = r.produits;
    let fixedAchats = 0, variableAchats = 0;
    (data.purchases || []).filter(p => inPeriod(p.date, period && period.from, period && period.to)).forEach(p => {
      const t = purchaseTotals(p, company);
      // Le stock et les immobilisations ne sont pas des charges de la période.
      const charge = round3(t.base.cout.charge + t.base.fees);
      if (isFixedCategory(data, p.category)) fixedAchats = round3(fixedAchats + charge);
      else variableAchats = round3(variableAchats + charge);
    });
    const acc = chartAccounts(data);
    const exceptionnel = round3(journalEntries(data, company, period, { sections: ['tresorerie', 'od', 'amortissements'] })
      .filter(e => e.account === acc.vncCedee || e.account === acc.produitsCession)
      .reduce((s, e) => s + e.debit - e.credit, 0));
    // Frais bancaires, salaires payés sans bulletin, intérêts, écritures diverses : ils tombent que tu
    // vendes ou non.
    const autres = round3(r.autres - exceptionnel);
    // Le coût des marchandises vendues est LA charge variable par excellence : pas de vente, pas de
    // coût. La marchandise d'un article non suivi aussi.
    const cogs = r.cogs;
    const variable = round3(variableAchats + r.horsSuivi + cogs);
    // La dotation est une charge fixe (3.5.0), les salaires aussi — et ce sont les plus lourds.
    const depreciation = r.depreciation, payroll = r.payroll;
    const fixed = round3(fixedAchats + depreciation + payroll + autres);
    const marginOnVariable = round3(revenue - variable);
    const rate = revenue > 0 ? marginOnVariable / revenue : 0;
    const point = rate > 0 ? round3(fixed / rate) : null;
    return {
      revenue, fixed, variable, cogs, depreciation, payroll, autres, exceptionnel, change: r.change, marginOnVariable,
      rate: revenue > 0 ? Math.round(rate * 1000) / 10 : null,
      breakEven: point,
      // Là où tu en es par rapport au seuil : négatif = il manque du chiffre d'affaires.
      gap: point == null ? null : round3(revenue - point),
      // L'écart de change (10.14.0) ne tombe ni avec les ventes ni avec le temps : il vient après,
      // comme une plus-value de cession.
      result: round3(marginOnVariable - fixed - exceptionnel + r.change),
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
    ['inventaire', 'Inventaire'], ['casse', 'Casse ou perte'],
    ['consommation', 'Matière utilisée'], ['ajustement', 'Ajustement']
  ];
  // 10.12.0 — une casse ou de la matière utilisée ne peut que SORTIR du stock. Jusque-là la quantité
  // se tapait signée (« -2 pour une sortie ») : un menuisier qui notait les 10 planches posées sur un
  // chantier tapait « 10 », et son stock GAGNAIT 10 planches, valorisées, sans un mot. Pour ces deux
  // natures on saisit la quantité sortie, toujours positive, et c'est cette fonction qui la signe ;
  // l'inventaire et l'ajustement restent signés, parce qu'ils vont dans les deux sens.
  const SOURCES_SORTIE = ['casse', 'consommation'];
  function qteMouvement(source, saisie) {
    const q = Number(saisie) || 0;
    if (!q) return 0;
    return SOURCES_SORTIE.includes(source) ? -Math.abs(q) : q;
  }
  // Les seuls mouvements qui ne sont PAS une charge de la période : l'achat (c'est de l'argent devenu
  // stock) et le stock de départ (ce qu'on avait avant de commencer à compter).
  const SOURCES_HORS_CHARGE = ['achat', 'depart'];
  const moveSourceLabel = k => (MOVE_SOURCES.find(m => m[0] === k) || [, k])[1];

  // Les articles du catalogue suivis en stock.
  function trackedItems(data) {
    return (data.catalog || []).filter(c => c.tracked);
  }

  // Retrouver l'article d'une ligne : par identifiant si la ligne en porte un (lignes posées depuis le
  // catalogue), sinon par libellé — même règle que `lineCost`, pour que l'historique reste lisible.
  function itemOfLine(line, data) {
    if (lot) {
      const idx = duLot(data, 'catalogue', () => {
        const parId = new Map(), parLibelle = new Map();
        (data.catalog || []).forEach(c => {
          if (!parId.has(c.id)) parId.set(c.id, c);
          const l = (c.label || '').trim().toLowerCase();
          if (!parLibelle.has(l)) parLibelle.set(l, c);
        });
        return { parId, parLibelle };
      });
      if (line.itemId && idx.parId.has(line.itemId)) return idx.parId.get(line.itemId);
      const label = (line.label || '').trim().toLowerCase();
      return label ? idx.parLibelle.get(label) || null : null;
    }
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
    // Dans un lot, les mouvements de TOUS les articles se calculent une fois, puis se rangent par
    // article : l'ordre d'un article est la sous-suite de l'ordre total (le tri est un ordre total).
    if (lot && itemId) {
      const parArticle = duLot(data, 'stock@' + (toIso || ''), () => {
        const m = new Map();
        stockMovements(data, null, toIso).forEach(x => {
          if (!m.has(x.itemId)) m.set(x.itemId, []);
          m.get(x.itemId).push(x);
        });
        return m;
      });
      return (parArticle.get(itemId) || []).map(x => ({ ...x }));
    }
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
        source: 'depart', ref: '', docId: '', note: '', rang: 0, ts: 0 });
    });

    (data.purchases || []).forEach(p => {
      // Un acompte versé n'est pas de la marchandise : c'est de l'argent posé d'avance (10.2.0).
      // Un avoir fournisseur, si : la marchandise RESSORT du stock, elle retourne chez lui.
      if (p.kind === 'acompte') return;
      const sens = p.kind === 'avoir' ? -1 : 1;
      (p.lines || []).forEach((l, i) => {
        if (l.destination !== 'stock') return;
        const c = itemOfLine(l, data);
        if (!keep(c)) return;
        if (limit && p.date > limit) return;
        const qty = sens * (Number(l.qty) || 0);
        if (!qty) return;
        // Le coût d'entrée est en DEVISE DE BASE (10.1.0) : le coût moyen pondéré mélange des
        // entrées de plusieurs achats, et le stock se valorise au bilan en dinars. Un composant
        // payé 120 € entrait à 120 DT, donc la valeur du stock, le coût des ventes et la marge
        // étaient faux ensemble et dans le même sens.
        out.push({ id: `buy-${p.id}-${i}`, date: p.date, itemId: c.id, label: c.label, qty,
          // TVA non déductible comprise : c'est ce que la marchandise a coûté, et ce que l'écriture
          // porte au 607 (10.14.0).
          unitCost: toBase(p, (Number(l.unitPrice) || 0) * (tvaNonDeductible(l, p, data.company) ? 1 + (Number(l.vatRate) || 0) / 100 : 1), data.company || {}),
          source: 'achat', ref: p.number || '', docId: p.id, note: '', rang: 1, ts: Number(p.createdAt) || 0 });
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
          ref: d.number || '', docId: d.id, note: '', rang: 1,
          // La marchandise sort à l'ÉMISSION : c'est l'instant qui compte, pas celui du brouillon.
          ts: Number(d.issuedTs || d.createdAt) || 0 });
      });
    });

    (data.stockAdjustments || []).forEach(a => {
      const c = (data.catalog || []).find(x => x.id === a.itemId);
      if (!keep(c)) return;
      if (limit && a.date > limit) return;
      out.push({ id: a.id, date: a.date, itemId: a.itemId, label: c.label, qty: Number(a.qty) || 0,
        unitCost: a.unitCost === '' || a.unitCost == null ? null : Number(a.unitCost),
        source: a.source || 'ajustement', ref: a.reference || '', docId: '', note: a.note || '', manual: true,
        rang: a.source === 'depart' ? 0 : 1, ts: Number(a.createdAt) || 0 });
    });

    // L'ORDRE d'une même journée (rapport QA E-10). Les mouvements du même jour se triaient par
    // IDENTIFIANT — « buy- » < « doc- » < « init- » — donc Achat → Vente → Stock de départ : un stock de
    // départ de 5 à 700, une vente de 2 puis un achat de 3 à 800, saisis dans cet ordre, sortaient la
    // vente au coût de l'achat qui la SUIT (800) et valorisaient le stock à 4 300 au lieu de 4 500.
    // Le coût moyen pondéré dépend de l'ordre des gestes : le stock de départ passe toujours en tête
    // de son jour, puis chaque mouvement à l'instant où il a eu lieu (création d'un achat ou d'un
    // mouvement, émission d'une facture). Sans instant connu (données anciennes), les entrées passent
    // avant les sorties : une sortie ne se valorise pas sur une marchandise qui n'est pas encore là.
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || '')
      || (a.rang - b.rang) || (a.ts - b.ts) || ((b.qty > 0) - (a.qty > 0)) || String(a.id).localeCompare(String(b.id)));
  }

  // Déroule les mouvements d'un article et tient le coût moyen pondéré à jour.
  // Une sortie sort au CMP du moment ; une entrée le recalcule.
  function runningStock(moves) {
    let qty = 0, value = 0, cmp = 0;
    const rows = moves.map(m => {
      const q = Number(m.qty) || 0;
      // Le coût qui a SERVI à valoriser le mouvement (10.14.0) : il se lit sur la ligne, et c'est lui
      // qu'on retranche. Pris APRÈS la mise à jour, un retour client affichait le nouveau coût moyen
      // et non celui auquel il était rentré.
      const unit = m.unitCost == null ? cmp : Number(m.unitCost) || 0;
      if (q > 0) {
        // Une entrée sans coût connu (retour sur avoir, ajustement) rentre au CMP courant.
        const avant = qty;
        qty = round3(qty + q);
        if (avant >= 0) {
          value = round3(value + q * unit);
          cmp = qty > 0 ? round3(value / qty) : 0;
        } else if (qty > 0) {
          // L'entrée comble d'abord un manque (10.14.0) : les pièces vendues sans avoir été achetées
          // sont sorties, et ce qui RESTE vaut le prix de cette entrée. Ajoutée à la valeur négative
          // du manque, elle laissait 100 DT de stock pour zéro pièce, ou gonflait le coût moyen.
          value = round3(qty * unit);
          cmp = unit;
        } else {
          // Toujours en manque : valorisé au dernier coût connu, et rien du tout à zéro.
          value = qty < 0 ? round3(qty * (cmp || unit)) : 0;
        }
      } else {
        qty = round3(qty + q);
        value = round3(value + q * unit);
        // Un stock retombé à zéro (ou négatif) ne garde aucune valeur : sinon le CMP dérive.
        if (qty <= 0) { value = qty < 0 ? round3(qty * cmp) : 0; }
      }
      return { ...m, unitApplied: unit, qtyAfter: qty, valueAfter: value, cmpAfter: cmp };
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
  //
  // TOUTE sortie qui n'est pas un achat ni le stock de départ coûte ce qu'elle a coûté : la vente, mais
  // aussi la casse, l'écart d'inventaire et la matière utilisée sur un chantier. Jusqu'en 10.12.0 seules
  // les ventes comptaient : une menuiserie qui achète des planches et les transforme en portes ne voyait
  // jamais son bois en charge — son résultat était gonflé de tout ce qu'elle avait consommé. Et un retour
  // sur avoir rend son coût : sans ça, la marchandise revenue en rayon restait comptée comme vendue.
  // (La comptabilité, elle, passe les achats au 607 et l'inventaire du 31 décembre au 603 —
  // `inventaireComptable` — : ce chiffre sert aux vues de gestion, mois par mois.)
  // Le coût des sorties est ce que le bilan retranche (10.14.0) : le stock à l'ouverture, plus ce qui
  // est ENTRÉ par un achat (un retour au fournisseur en moins) ou par un stock de départ, moins le
  // stock à la clôture — les deux stocks tels que `stockTotals` les donne, donc tels que le 37 les
  // porte. Additionner les sorties ligne à ligne donnait le même chiffre dans le cas simple, et un
  // autre dès qu'un article repartait de zéro avec un reste d'arrondi, qu'un retour client rentrait
  // au coût moyen, ou qu'un stock négatif (compté zéro au bilan) était comblé : le résultat simplifié
  // et les états financiers ne disaient plus le même résultat. Douze mois font l'année par
  // construction.
  function costOfGoodsSold(data, period) {
    const from = period && period.from, to = (period && period.to) || '9999-12-31';
    const ouverture = from ? stockTotals(data, addDays(from, -1)).value : 0;
    const entrees = stockJournal(data, period)
      .filter(m => SOURCES_HORS_CHARGE.includes(m.source))
      .reduce((s, m) => s + (Number(m.qty) || 0) * (Number(m.unitApplied) || 0), 0);
    return round3(ouverture + entrees - stockTotals(data, to).value);
  }

  // L'INVENTAIRE COMPTABLE (10.14.0). L'écriture passe les achats de marchandises au 607 — c'est
  // l'inventaire INTERMITTENT, celui du système comptable tunisien — et ne passait JAMAIS
  // l'inventaire : le bilan n'avait aucun stock, et le résultat des états financiers comptait toute
  // marchandise achetée comme consommée, même restée sur l'étagère. Le commentaire de
  // `costOfGoodsSold` affirmait pourtant « l'inventaire au 603 ». Ce que cette fonction rend :
  //   - `departs` : le stock de départ saisi sur les articles, qui existait AVANT les premiers achats
  //     enregistrés. Il entre au bilan en ouverture (37 contre le report à nouveau), comme le solde
  //     de départ d'un compte bancaire — jamais au résultat, qu'il n'a pas traversé ;
  //   - `variations` : au 31 décembre de chaque exercice TERMINÉ, l'écart entre la valeur du stock
  //     et ce que le 37 porte, au 603 (le stock augmente : une charge en moins). Après elle, le 37
  //     vaut exactement la valeur du stock du 31 décembre, et 607 + 603 = le coût des sorties.
  // La valeur est celle de `stockTotals` (coût moyen pondéré, un article négatif compté à zéro) :
  // un seul chiffre du stock pour la page Stock, le bilan et le résultat.
  // Un stock de départ sans date (données anciennes : `1970-01-01`) prend la date de la première
  // pièce de l'entreprise — un « stock au 1er janvier 1970 » dans le livre serait faux.
  function inventaireComptable(data, todayIso) {
    const t = todayIso || today();
    const calcul = () => {
      const moves = stockMovements(data, null);
      if (!moves.length) return { departs: [], variations: [] };
      const dates = [];
      const noter = d => { if (d && /^\d{4}-\d{2}-\d{2}/.test(d) && d > '1970-01-01') dates.push(d.slice(0, 10)); };
      (data.documents || []).forEach(d => noter(d.date)); (data.purchases || []).forEach(p => noter(p.date));
      (data.movements || []).forEach(m => noter(m.date)); moves.forEach(m => noter(m.date));
      const premiere = dates.sort()[0] || t;
      const parArticle = new Map();
      moves.forEach(m => { if (!parArticle.has(m.itemId)) parArticle.set(m.itemId, []); parArticle.get(m.itemId).push(m); });
      const rangees = [...parArticle.values()].map(liste => runningStock(liste).rows);
      const departsParDate = {};
      rangees.forEach(rows => rows.filter(r => r.source === 'depart').forEach(r => {
        const d = r.date && r.date > '1970-01-01' ? r.date : premiere;
        departsParDate[d] = round3((departsParDate[d] || 0) + (Number(r.qty) || 0) * (Number(r.unitApplied) || 0));
      }));
      const departs = Object.keys(departsParDate).sort().filter(d => departsParDate[d]).map(d => ({ date: d, montant: departsParDate[d] }));
      const valeurAu = ye => round3(rangees.reduce((s2, rows) => {
        let v = 0;
        for (const r of rows) { if (r.date > ye) break; v = r.valueAfter; }
        return s2 + Math.max(0, v);
      }, 0));
      const annees = [premiere].concat(departs.map(x => x.date)).map(d => Number(d.slice(0, 4)));
      const premiereAnnee = Math.min(...annees);
      const variations = [];
      let solde = 0;
      for (let y = premiereAnnee; `${y}-12-31` < t; y++) {
        solde = round3(solde + departs.filter(x => Number(x.date.slice(0, 4)) === y).reduce((s2, x) => s2 + x.montant, 0));
        const fin = valeurAu(`${y}-12-31`);
        const montant = round3(fin - solde);
        if (montant) variations.push({ annee: y, date: `${y}-12-31`, montant, valeur: fin });
        solde = fin;
      }
      return { departs, variations };
    };
    return lot ? duLot(data, 'inventaire@' + t, calcul) : calcul();
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

  // Le moteur de paie vit dans `compta.js` depuis la 10.3.0, et core.js le réexporte à l'identique.
  // La règle de découpage de la 9.1.0, relue dans les deux sens (9.6.1) : ces fonctions prennent un
  // SALARIÉ et une SAISIE, jamais `data`. Elles étaient du mauvais côté depuis la 5.0.0, et ça ne
  // s'était jamais vu parce que personne d'autre n'en avait besoin — le Cabinet, lui, en a besoin
  // pour tenir la paie des dossiers qui ne sont PAS sur SkanFact, et il ne charge pas core.js.
  // La seule alternative au déménagement était la recopie, et une copie diverge, toujours.
  const CONTRACT_TYPES = Compta.CONTRACT_TYPES;
  // Le jour LOCAL d'un instant (10.12.0) : la même fonction que le Cabinet, jamais une copie.
  const jourDeLInstant = Compta.jourDeLInstant;
  const contractLabel = Compta.contractLabel;
  const DEFAULT_PAYROLL = Compta.DEFAULT_PAYROLL;

  function payrollSettings(data) {
    const regle = (data && data.payrollSettings) || {};
    const r = Compta.baremesPaie(regle);
    // La TFP du métier, PROPOSÉE (9.1.1) : seulement tant que personne n'a réglé le taux à la main
    // — ni en le saisissant (`tfpRate` présent), ni en touchant le champ (`tfpTouche`). C'est le
    // motif de `regimeTouche` (7.25.0) et de la durée proposée par la famille d'un bien : proposer
    // ne veut rien dire si la proposition écrase ensuite ce qu'on a décidé.
    if (regle.tfpRate === undefined && !regle.tfpTouche) {
      const p = tfpSuggere(((data && data.company) || {}).activity);
      if (p !== null) r.tfpRate = p;
    }
    return r;
  }

  const irppAnnual = Compta.irppAnnual;
  const computePayslip = Compta.computePayslip;
  const saisiePaieValide = Compta.saisiePaieValide;
  const employerChargesOf = Compta.employerChargesOf;

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
      tfp: sum(r => r.c.tfp), foprolos: sum(r => r.c.foprolos),
      cost: sum(r => r.c.employerCost),
      // Ce qui est VRAIMENT versé : un bulletin établi et pas encore payé n'a rien versé (10.12.0).
      netPaid: round3(rows.filter(r => r.paidDate).reduce((s, r) => s + (Number(r.c.net) || 0), 0)),
      unpaid: rows.filter(r => !r.paidDate).length,
      rows
    };
  }

  // Les bulletins du mois qui manquent : un salarié actif sans bulletin, c'est un oubli, pas un choix.
  // Les bulletins IMPOSSIBLES (rapport QA E-04). La 10.10.0 a fermé la porte — une absence plus
  // longue que le mois, une retenue plus grosse que le salaire, et le bulletin est refusé — mais elle
  // ne nettoie pas ce qui est passé AVANT : un bulletin à net négatif reste enregistré, son écriture
  // est inversée, et la déclaration CNSS du trimestre l'additionne (« − 168,970 DT », prête à être
  // marquée déposée). On le lit sur la COPIE figée du calcul (`computed`, règle 5.0.0) : c'est elle
  // qui a été remise et déclarée. Un bulletin sans copie (antérieur à la 5.0.0) n'est pas jugé ici.
  function bulletinsImpossibles(data) {
    return (data.payslips || []).filter(p => p && p.computed
      && (Number(p.computed.net) < 0 || !(Number(p.computed.gross) > 0)))
      .map(p => ({ id: p.id, employeeId: p.employeeId, year: p.year, month: p.month,
        net: round3(Number(p.computed.net) || 0), gross: round3(Number(p.computed.gross) || 0) }));
  }

  function missingPayslips(data, year, month) {
    const done = new Set((data.payslips || []).filter(p => Number(p.year) === Number(year) && Number(p.month) === Number(month)).map(p => p.employeeId));
    const last = addDays(`${year}-${String(month).padStart(2, '0')}-01`, daysInMonth(year, month) - 1);
    return activeEmployees(data, last).filter(e => !done.has(e.id));
  }

  // Les années que la Paie propose (10.14.1) : celles qui portent des bulletins, l'année en cours, ET
  // chaque année où un salarié était en poste. La liste ne portait que les années qui avaient DÉJÀ
  // des bulletins : un salarié embauché en 2023, et « Clôturer jusqu'à… » annonçait quarante-quatre
  // bulletins à établir pendant que la Paie n'offrait que l'année en cours — aucune porte vers le
  // manque qu'elle nommait (7.15.0). Un salarié sans date d'embauche ne remonte pas plus loin que les
  // bulletins qu'il a déjà.
  function anneesDePaie(data, todayIso) {
    const cette = Number((todayIso || today()).slice(0, 4));
    const ans = new Set([cette]);
    (data.payslips || []).forEach(p => { const y = Number(p.year); if (y > 1900 && y <= 9999) ans.add(y); });
    (data.employees || []).forEach(e => {
      const entree = Number(String(e.hireDate || '').slice(0, 4));
      if (!(entree > 1900)) return;
      const sortie = Number(String(e.endDate || '').slice(0, 4)) || cette;
      // Le nombre d'années se compte d'avance, et se borne (règle 5.2.3).
      for (let y = entree, n = 0; y <= Math.min(sortie, cette) && n < 100; y++, n++) ans.add(y);
    });
    return [...ans].sort((a, b) => b - a).map(String);
  }

  // 10.12.0 — le mois sur lequel s'ouvre l'onglet Bulletins. C'était toujours le mois PRÉCÉDENT : une
  // menuiserie qui embauche son premier ouvrier le 24 septembre ouvrait la Paie sur août, lisait
  // « Aucun salarié en poste en août 2026 : il n'y a pas de bulletin à établir », et rien ne menait à
  // septembre. On ouvre là où il y a quelque chose à faire (U-12 : jamais un mois futur) : le mois
  // précédent s'il lui manque un bulletin, sinon le mois en cours s'il a quelqu'un en poste, sinon
  // le précédent.
  function moisDePaie(data, todayIso) {
    const t = todayIso || today();
    const courant = t.slice(0, 7) + '-01';
    const avant = addMonths(courant, -1, 1);
    const ym = iso => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) });
    const a = ym(avant), c = ym(courant);
    if (missingPayslips(data, a.year, a.month).length) return a;
    if (missingPayslips(data, c.year, c.month).length || payslipsOf(data, c.year, c.month).length) {
      if (!payslipsOf(data, a.year, a.month).length || missingPayslips(data, c.year, c.month).length) return c;
    }
    return a;
  }

  // 10.12.0 — la première pièce datée APRÈS un mois (vente émise, achat, bulletin). Un paquet vide
  // disait « commence par émettre une facture » à une entreprise qui en avait émis en septembre :
  // un état vide dit SA raison, et le jour où ça changera (E-06).
  function premierePieceApres(data, moisIso) {
    const fin = addDays(moisIso.slice(0, 7) + '-01', daysInMonth(Number(moisIso.slice(0, 4)), Number(moisIso.slice(5, 7))) - 1);
    const dates = []
      .concat((data.documents || []).filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon').map(d => d.date))
      .concat((data.purchases || []).map(p => p.date))
      .concat((data.payslips || []).map(p => payslipDate(p)))
      .filter(d => d && d > fin);
    return dates.length ? dates.sort()[0] : '';
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
      <div class="kv"><span>Situation</span><span>${emp.headOfFamily ? 'Chef de famille' : 'Célibataire'}${Number(emp.children) ? ` · ${plFr(emp.children, 'enfant')} à charge` : ''}</span></div>
    </div>
    <div class="box"><h2>Période</h2>
      <div class="kv"><span>Mois</span><span><b>${escapeHtml(label)}</b></span></div>
      <div class="kv"><span>Jours ouvrables</span><span>${pct(c.workedDays)}</span></div>
      ${c.absentDays ? `<div class="kv"><span>Jours d'absence</span><span>${pct(c.absentDays)}</span></div>` : ''}
      <div class="kv"><span>Salaire de base</span><span>${fmt(c.baseGross)}</span></div>
      ${slip.prorata ? `<div class="kv"><span>Proratisé</span><span>${escapeHtml(slip.prorata.motif)} · ${pct(slip.prorata.jours)} j sur ${pct(slip.prorata.sur)}</span></div>` : ''}
      <div class="kv"><span>Payé le</span><span>${slip.paidDate ? fmtDate(slip.paidDate) : '—'}</span></div>
      ${slip.method ? `<div class="kv"><span>Mode</span><span>${escapeHtml((PAYMENT_METHODS.find(m => m[0] === slip.method) || [, slip.method])[1])}</span></div>` : ''}
    </div>
  </div>

  <table class="pay">
    <thead><tr><th>Désignation</th><th class="n">Base</th><th class="n">Taux</th><th class="n">Part salarié</th><th class="n">Part employeur</th></tr></thead>
    <tbody>
      ${row('Salaire de base', null, null, c.baseGross, null)}
      ${c.absenceCut ? row(`Absence (${pct(c.absentDays)} jour${sAccord(c.absentDays)})`, null, null, -c.absenceCut, null) : ''}
      ${c.bonuses.map(b => row(b.label + (b.taxable ? '' : ' (non imposable)'), null, null, b.amount, null)).join('')}
      <tr class="sec"><td>Salaire brut</td><td class="n"></td><td class="n"></td><td class="n">${fmt(c.gross)}</td><td class="n"></td></tr>
      ${row('CNSS', c.cnssBase, c.rates.cnssEmployee, -c.cnssEmployee, c.cnssEmployer)}
      ${c.accident ? row('Accident du travail', c.cnssBase, c.rates.accidentRate, null, c.accident) : ''}
      ${c.tfp ? row('Taxe de formation professionnelle (TFP)', c.cnssBase, c.rates.tfpRate, null, c.tfp) : ''}
      ${c.foprolos ? row('FOPROLOS', c.cnssBase, c.rates.foprolosRate, null, c.foprolos) : ''}
      ${row('Impôt sur le revenu (IRPP)', round3(c.annualTaxable / 12), null, -c.irpp, null)}
      ${c.css ? row('Contribution sociale de solidarité', round3(c.annualTaxable / 12), c.rates.solidarity, -c.css, null) : ''}
      ${c.deductions.map(d => row(d.label, null, null, -d.amount, null)).join('')}
      <tr class="tot"><td>Total des retenues</td><td class="n"></td><td class="n"></td>
        <td class="n">${fmt(round3(c.cnssEmployee + c.irpp + c.css + c.otherDeductions))}</td>
        <td class="n">${fmt(employerChargesOf(c))}</td></tr>
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
      <div class="kv"><span>Charges patronales</span><span>${fmt(employerChargesOf(c))}</span></div>
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
    // 10.12.0 — une entrée ou une sortie en cours de mois se PRORATISE. Le brut de la fiche était
    // repris en entier : un ouvrier embauché le 24 septembre recevait un mois plein pour six jours, et
    // celui qui part le 5 aussi. Les jours hors contrat se comptent en jours ouvrables (le repos
    // hebdomadaire des barèmes), sur la base des jours ouvrables du mois réglée dans les barèmes.
    // Le brut proposé reste MODIFIABLE, et `prorata` dit d'où il vient. À VÉRIFIER avec le comptable :
    // la méthode de proratisation retenue (jours ouvrables, calendaires ou 30e).
    const total = Number(s.workedDays) || 26;
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = addDays(first, daysInMonth(year, month) - 1);
    let hors = 0;
    const motifs = [];
    if (employee.hireDate && employee.hireDate > first && employee.hireDate <= last) {
      hors += workingDays(first, addDays(employee.hireDate, -1), off);
      motifs.push(`entrée le ${fmtDate(employee.hireDate)}`);
    }
    if (employee.endDate && employee.endDate >= first && employee.endDate < last) {
      hors += workingDays(addDays(employee.endDate, 1), last, off);
      motifs.push(`sortie le ${fmtDate(employee.endDate)}`);
    }
    hors = Math.min(hors, total);
    const brutFiche = round3(Number(employee.grossSalary) || 0);
    const gross = hors ? round3(brutFiche * (total - hors) / total) : employee.grossSalary;
    const prorata = hors ? { jours: round3(total - hors), sur: total, motif: motifs.join(', '), brutFiche, brut: gross } : null;
    return { gross, workedDays: total, absentDays, bonuses: [], deductions, prorata };
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
        <p class="small">Solde de congés non pris au départ : <b>${pctFr(bal.remaining)} jour${sAccord(bal.remaining)}</b>${leavePay > 0 ? `, soit ${fmt(leavePay)} ${escapeHtml(cur)} sur la base du dernier salaire` : ''}.</p>
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
    // Échéance : le jour réglé au calendrier fiscal (le 15 par défaut) du mois suivant la fin du
    // trimestre. À VÉRIFIER. Une seule source pour la Paie et le calendrier (10.14.0).
    const dueDate = dateLimiteSociale(data, 'cnss', year, quarter);
    return {
      year: Number(year), quarter: Number(quarter), label: quarterLabel(quarter), months, dueDate,
      employees: rows.length, slips: slips.length,
      base: sum(r => r.base), employee: sum(r => r.employee), employer: sum(r => r.employer),
      accident: sum(r => r.accident), total: sum(r => r.total), rows
    };
  }

  // 10.14.1 (DECL D2) — le fichier de télédéclaration CNSS du trimestre (format « DS » 2012), par le
  // MÊME moteur que le Cabinet (`compta.fichierCnss`) : le fichier du client et celui de son
  // comptable ne peuvent pas diverger. Le salaire déclaré est l'ASSIETTE du trimestre, lue dans la
  // déclaration que la page affiche juste au-dessus — un seul calcul pour le tableau et le fichier.
  function fichierCnssEntreprise(data, company, year, quarter) {
    const cn = cnssDeclaration(data, year, quarter);
    const c = company || {};
    return Compta.fichierCnss({
      employeur: c.cnss, code: c.cnssCode, annee: cn.year, trimestre: cn.quarter,
      lignes: cn.rows.map(r => {
        const e = (data.employees || []).find(x => x.id === r.employeeId) || {};
        return { salarieId: r.employeeId, nom: r.name, identite: e.cnssName || '', cnss: r.cnss, cin: e.cin || '', salaire: r.base };
      })
    });
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
    // Celles des RÈGLEMENTS de l'année (10.14.0) : une facture de décembre payée en janvier appartient
    // à la déclaration de l'année du paiement — celle que dit l'attestation remise au fournisseur.
    const co = company || (data.company || {});
    const operees = {};
    supplierPayments(data, co, { from: `${y}-01-01`, to: `${y}-12-31` }).forEach(r => {
      if (!r.rs) return;
      const o = operees[r.purchaseId] || (operees[r.purchaseId] = { rs: 0, date: '' });
      o.rs = round3(o.rs + r.rs);
      if ((r.date || '') > o.date) o.date = r.date;
    });
    // Un avoir posé après le règlement régularise la retenue l'année où il est posé (10.14.0).
    regularisationsRetenueAchats(data, co, { from: `${y}-01-01`, to: `${y}-12-31` }).forEach(r => {
      const o = operees[r.purchaseId] || (operees[r.purchaseId] = { rs: 0, date: '' });
      o.rs = round3(o.rs + r.rs);
      if (!o.date) o.date = r.date;
    });
    Object.keys(operees).forEach(k => { if (Math.abs(operees[k].rs) <= 0.0005) delete operees[k]; });
    const held = (data.purchases || [])
      .filter(p => operees[p.id])
      .map(p => {
        const t = purchaseTotals(p, co);
        const sup = (data.suppliers || []).find(s2 => s2.id === p.supplierId) || {};
        const o = operees[p.id];
        // L'assiette de ce qui a été retenu cette année : la part de la pièce que ses règlements ont
        // soldée — celle d'une retenue à 1,5 % sur 1 000 DT réglés à moitié est 500.
        const part = t.base.withholding ? o.rs / t.base.withholding : 0;
        return { purchaseId: p.id, supplier: sup.name || '—', matricule: sup.matricule || '',
          number: p.number || '', date: o.date, dateFacture: p.date, base: round3((t.base.totalTTC - t.base.fees) * part),
          rate: Number(p.withholdingRate) || 0, amount: o.rs, certificate: !!p.withholdingCertificate };
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
      dueDate: dateLimiteSociale(data, 'employeur', y)     // échéance du calendrier — À VÉRIFIER
    };
  }

  // La date limite d'une déclaration sociale suit la RÈGLE du calendrier fiscal (10.14.0). La Paie
  // écrivait le 15 et le 30 avril en dur, pendant que le calendrier laisse régler le jour de chaque
  // échéance : réglée au 20, la même CNSS était due le 15 dans la Paie et « À faire », le 20 au
  // calendrier — deux écrans, deux dates pour une déclaration.
  function dateLimiteSociale(data, kind, year, quarter) {
    const r = fiscalDeadlines(data).find(x => x.id === kind) || {};
    const jour = (y, m) => `${y}-${pad2(m)}-${pad2(Math.min(Number(r.day) || (kind === 'cnss' ? 15 : 30), daysInMonth(y, m)))}`;
    if (kind === 'cnss') {
      const m = Number(quarter) * 3 + 1;
      return m > 12 ? jour(Number(year) + 1, 1) : jour(Number(year), m);
    }
    return jour(Number(year) + 1, Number(r.month) || 4);
  }
  // Celle d'une déclaration désignée par son identifiant (`cnss-2026-T2`, `employeur-2025`) — c'est
  // ainsi qu'une déclaration déposée se range : sans elle, le calendrier écrivait « — » à côté.
  function dateLimiteDeclarationSociale(data, id) {
    const c = /^cnss-(\d{4})-T([1-4])$/.exec(String(id || ''));
    if (c) return dateLimiteSociale(data, 'cnss', Number(c[1]), Number(c[2]));
    const e = /^employeur-(\d{4})$/.exec(String(id || ''));
    return e ? dateLimiteSociale(data, 'employeur', Number(e[1])) : '';
  }

  // Le calendrier fiscal, tel que l'écran le montre : ce qui arrive, et d'abord ce qui est EN
  // RETARD (10.14.0). Une occurrence passée disparaissait du calendrier — `upcomingFiscal` ne regarde
  // que devant —, et la CNSS d'un trimestre jamais déposée n'était ni « à venir » ni « déposée » :
  // nulle part, sur la page faite pour ne rien oublier. Seules les déclarations sociales ont un
  // retard qu'on SAIT (`socialDue` connaît les bulletins) ; une TVA non pointée peut avoir été
  // déposée sans être pointée, et la crier en retard chaque mois serait du bruit.
  function calendrierFiscal(data, todayIso, withinDays) {
    const t = todayIso || today();
    const retards = socialDue(data, t).filter(x => x.late).map(x => ({ id: x.kind, label: x.label, note: '',
      date: x.dueDate, days: daysBetween(t, x.dueDate), filingId: '', socialId: x.id, fin: '', enCours: false,
      retard: true, amount: x.amount }));
    return retards.concat(upcomingFiscal(data, t, withinDays).map(x => ({ ...x, retard: false })));
  }

  // Les déclarations sociales dues et pas encore marquées déposées.
  // Ce que la CNSS d'une année porte encore de NON déclaré (10.14.0) : la carte de la Paie disait
  // « CNSS à reverser » au-dessus du total de l'année, trimestres déjà déposés compris — un reste dû
  // quatre fois trop grand en décembre. Le total reste le total ; ce qui n'est pas déposé se compte.
  function cnssNonDeclaree(data, year) {
    const done = socialesDeposees(data);
    return round3(QUARTERS.reduce((t, [q]) => done.has(`cnss-${year}-T${q}`) ? t : t + cnssDeclaration(data, year, q).total, 0));
  }

  function socialDue(data, todayIso) {
    const t = todayIso || today();
    if (!(data.employees || []).length) return [];
    const done = socialesDeposees(data);
    const out = [];
    const y = Number(t.slice(0, 4));
    // 10.14.1 (SOC-01) — toutes les années que les bulletins connaissent, pas les deux dernières. Un
    // trimestre de 2022 jamais déposé disparaissait de « À faire », du calendrier et de la Paie le
    // jour où il passait l'an dernier : un pense-bête qui ne regarde que devant oublie ce qui est
    // passé sans être fait (10.14.0). Les bulletins disent qu'il était dû ; seul « Marquer déposée »
    // dit qu'il ne l'est plus.
    const annees = (data.payslips || []).map(sl => Number(sl.year)).filter(n => n > 1900 && n <= y);
    const debut = Math.min(y - 1, ...annees);
    for (let yy = debut; yy <= y; yy++) (yy => {
      QUARTERS.forEach(([q]) => {
        const d = cnssDeclaration(data, yy, q);
        if (!d.slips || d.dueDate > addDays(t, 45)) return;       // pas encore d'actualité
        // 10.12.0 — un trimestre ne se déclare qu'une fois TERMINÉ. Le 24 septembre, « 1 déclaration
        // sociale à déposer : CNSS 3e trimestre » invitait à déposer — et à « Marquer déposée » — une
        // déclaration à laquelle manqueraient les bulletins de la fin du mois.
        const finTrimestre = addDays(`${yy}-${String(q * 3).padStart(2, '0')}-01`, daysInMonth(yy, q * 3) - 1);
        if (t <= finTrimestre) return;
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
    })(yy);
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
      // Les montants s'écrivent comme à l'écran (10.14.1, M-16), dans la devise de la société.
      const cur = ((data && data.company) || {}).currency || 'DT';
      warnings.push(`Les lignes totalisent ${money(computedHT, cur)} alors que la pièce annonce ${money(readHT, cur)}.`);
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
      .sort((a, b) => (b.inDate || '').localeCompare(a.inDate || '') || TRI_NUMERIQUE.compare((a.serial || ''), b.serial || ''));
  }

  // Les unités disponibles pour une vente : en stock, jamais sorties.
  function availableSerials(data, itemId) {
    return (data.serials || []).filter(x => x.itemId === itemId && x.status === 'stock')
      .sort((a, b) => (a.inDate || '').localeCompare(b.inDate || '') || TRI_NUMERIQUE.compare((a.serial || ''), b.serial || ''));
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
  // Le moteur d'amortissement vit dans `compta.js` depuis la 9.6.1 : aucune de ces fonctions ne
  // prend `data` — elles prennent un BIEN — et le Cabinet, qui ne charge pas core.js, en a besoin
  // pour les dossiers hors SkanFact. Réexportées ici à l'identique : les appelants n'ont pas bougé.
  const DEFAULT_ASSET_CLASSES = Compta.DEFAULT_ASSET_CLASSES;
  const assetClassLabel = Compta.assetClassLabel;
  const assetClassYears = Compta.assetClassYears;
  const days360 = Compta.days360;
  const assetSchedule = Compta.assetSchedule;
  const assetCumulated = Compta.assetCumulated;
  const assetYear = Compta.assetYear;
  const assetNBV = Compta.assetNBV;
  const disposalResult = Compta.disposalResult;
  const cappedCumulated = Compta.cappedCumulated;
  const entrySet = Compta.entrySet;
  // Les questions du cabinet (9.10.0), réexportées à l'IDENTITÉ : elles prennent une LISTE, pas
  // `data`, donc elles vivent dans compta.js (règle de découpage 9.1.0) et l'app entreprise les
  // lit ici. Une copie divergerait, et les deux applications ne diraient plus la même chose d'une
  // même question. Un test compare les objets, jamais leur résultat (9.6.1).
  const QUESTION_ATTENDUS = Compta.QUESTION_ATTENDUS;
  const QUESTION_RELANCE = Compta.QUESTION_RELANCE;
  const fusionnerQuestionsRecues = Compta.fusionnerQuestionsRecues;
  const questionsDeLaPiece = Compta.questionsDeLaPiece;
  const repondreQuestion = Compta.repondreQuestion;
  const reponsesAEnvoyer = Compta.reponsesAEnvoyer;
  const questionsSansReponse = Compta.questionsSansReponse;
  const reponsesApres = Compta.reponsesApres;
  const questionsValides = Compta.questionsValides;

  // ---------------------------------------------------------- l'origine d'un envoi du cabinet (10.13.0)
  //
  // Le dossier de clôture (.skanclose) et les questions (.skanask) arrivent SIGNÉS. Jusqu'ici, « Origine
  // vérifiée » voulait seulement dire « la signature correspond à la clé que le fichier présente » —
  // or n'importe qui peut fabriquer une paire de clés et signer un fichier au nom du cabinet : le
  // matricule du client est public. La clôture importée VERROUILLE un exercice ; la dire « vérifiée »
  // sur un fichier auto-signé, c'était prétendre ce qu'on ne peut pas prouver (Cabinet 1.0.0).
  //
  // La règle est celle que le Cabinet applique aux paquets de ses clients depuis la 9.2.0 (confiance
  // au premier usage, `cabcore.verdictOrigine`), vue de l'autre côté :
  //   1. signature fausse ou manifeste modifié → REFUSÉ ;
  //   2. pas de signature, rien de retenu → accepté, « origine non prouvée », en rouge ;
  //   3. pas de signature, une signature retenue → REFUSÉ : ne plus signer est une régression, ou
  //      quelqu'un d'autre ;
  //   4. signature valable, rien de retenu → accepté ET retenu (`epingler`) : les suivants lui seront
  //      comparés ;
  //   5. signature valable, la même → « origine vérifiée », et cette fois c'est vrai ;
  //   6. signature valable, une AUTRE → refusé en nommant les deux empreintes. La reprise passe par
  //      un geste humain (l'empreinte lue au téléphone), jamais par une acceptation automatique.
  //   epinglee : `data.cabinetSignature` ({ empreinte }) ou null
  //   origine  : ce que main.js a vérifié ({ niveau: 'prouvee'|'non-prouvee'|'refusee', empreinte, motif })
  function verdictEnvoiCabinet(epinglee, origine) {
    const pin = (epinglee && String(epinglee.empreinte || '')) || '';
    const o = origine || {};
    const recue = String(o.empreinte || '');
    if (o.niveau === 'refusee') {
      return { ok: false, etat: 'refusee',
        texte: `La signature de ce fichier n'est pas valable${o.motif ? ` (${String(o.motif).replace(/\.$/, '')})` : ''} : il a été modifié après son envoi, ou il ne vient pas de ton cabinet. Demande à ton comptable de te le renvoyer.` };
    }
    if (o.niveau !== 'prouvee') {
      return pin
        ? { ok: false, etat: 'signature-manquante',
            texte: `Ce fichier n'est pas signé, alors que les envois précédents de ton cabinet l'étaient (signature ${pin}). Rien ne prouve qu'il vient de lui : demande-lui de te le renvoyer depuis SkanFact Cabinet.` }
        : { ok: true, etat: 'non-prouvee', alerte: true,
            ligne: `ORIGINE NON PROUVÉE : ${o.motif || 'ce fichier n\'est pas signé.'} Vérifie avec ton comptable avant d'accepter.` };
    }
    if (!pin) {
      return { ok: true, etat: 'premiere', epingler: recue,
        ligne: `Signé par ton cabinet (signature ${recue}). C'est la première signature que tu reçois de lui : elle sera retenue, et les envois suivants lui seront comparés.` };
    }
    if (pin !== recue) {
      return { ok: false, etat: 'autre-cle', attendue: pin, recue,
        texte: `Ce fichier est signé par une autre clé que celle de ton cabinet.\n\nAttendue : ${pin}\nReçue : ${recue}\n\nSi ton comptable a changé de clé, fais-lui lire la nouvelle empreinte au téléphone avant de l'accepter : c'est la seule façon de savoir que le fichier vient de lui.` };
    }
    return { ok: true, etat: 'signe', ligne: `Origine vérifiée : signé par ton cabinet (signature ${recue}), la même que ses envois précédents.` };
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
      // Au 31/12, un bien sorti dans l'année n'est plus à l'actif : sa DOTATION de l'année compte (c'est
      // une charge de l'exercice), sa valeur et son cumul non. Sans ces deux totaux, la carte « Valeur
      // d'acquisition » annonçait « 5 biens à l'actif » avec la valeur des six, et valeur − cumul ne
      // retombait pas sur la VNC, qui, elle, excluait déjà le bien sorti (10.14.0).
      grossActif: sum(r => r.out ? 0 : r.amount),
      cumulActif: sum(r => r.out ? 0 : r.cumulated),
      nbv: sum(r => r.out ? 0 : r.nbv),
      disposals: rows.filter(r => r.disposalResult && Number(r.disposalResult.date.slice(0, 4)) === Number(year)),
      rows
    };
  }

  // Les lignes d'achat marquées « immobilisation » qui n'ont pas encore de fiche : c'est le pont entre
  // le module Achats et celui-ci. On ne crée jamais la fiche tout seul — la durée d'amortissement est
  // une décision, pas une donnée.
  // Ce qu'une ligne « immobilisation » porte au compte d'immobilisation (10.14.0) : en DINARS (un bien
  // payé en euros entrait à son montant en euros) et TVA non déductible comprise. Sinon le 22 et le
  // tableau des biens divergent dès le premier achat en devise.
  function valeurLigneImmo(data, p, l) {
    const ht = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
    const nd = tvaNonDeductible(l, p, data.company) ? ht * (Number(l.vatRate) || 0) / 100 : 0;
    return round3(toBase(p, round3(ht) + round3(nd), data.company || {}));
  }
  // Ce que les AVOIRS du fournisseur retirent de chaque ligne « immobilisation » d'un achat
  // (10.14.1). Un rabais sur une machine diminue son coût : l'écriture de l'avoir crédite le 22, et
  // la fiche proposée gardait le montant d'avant — le bilan disait 9 000, le tableau des biens 10 000,
  // et la dotation se calculait sur 10 000. Une ligne d'avoir se rattache à la ligne de l'achat qui
  // porte le même libellé, sinon à la seule ligne « immobilisation » de l'achat, sinon à la première.
  // `au` (10.14.1) borne les avoirs à une date : au 31/12, le 22 ne connaît que ceux qui y sont déjà
  // passés. Sans `au`, tous — c'est le montant d'aujourd'hui, celui qu'on propose pour la fiche.
  function reductionsImmo(data, p, au) {
    const lignes = (p.lines || []).map((l, i) => ({ l, i })).filter(x => x.l.destination === 'immobilisation');
    const out = {};
    if (!lignes.length) return out;
    const norme = v => String(v || '').trim().toLowerCase();
    const borne = String(au || '').slice(0, 10);
    (data.purchases || []).filter(a => a.kind === 'avoir' && a.achatLie === p.id && (!borne || (a.date || '') <= borne)).forEach(a => {
      (a.lines || []).filter(l => l.destination === 'immobilisation').forEach(l => {
        const cible = lignes.find(x => norme(x.l.label) && norme(x.l.label) === norme(l.label)) || lignes[0];
        out[cible.i] = round3((out[cible.i] || 0) + valeurLigneImmo(data, a, l));
      });
    });
    return out;
  }
  function assetsToCreate(data) { return immosEnAttente(data, ''); }
  // La ligne d'achat qu'une fiche représente (10.14.1). `lineIndex` la désigne depuis la 3.5.0 ; une
  // fiche liée à un achat SANS lui (des données écrites à la main, un import, une copie) se rattache à
  // la seule ligne « immobilisation » de l'achat, sinon à celle qui porte son libellé. Sans ce repli,
  // l'achat restait « à immobiliser » à côté de sa fiche — et en créer une seconde amortissait le
  // bien deux fois. -1 : aucune ligne ne lui correspond.
  function ligneDeFiche(a, p) {
    if (!a || !p) return -1;
    const lignes = (p.lines || []).map((l, i) => ({ l, i })).filter(x => x.l.destination === 'immobilisation');
    const n = Number(a.lineIndex);
    if (a.lineIndex !== null && a.lineIndex !== undefined && a.lineIndex !== '' && Number.isInteger(n) && lignes.some(x => x.i === n)) return n;
    if (lignes.length === 1) return lignes[0].i;
    const norme = v => String(v || '').trim().toLowerCase();
    const m = lignes.find(x => norme(x.l.label) && norme(x.l.label) === norme(a.label));
    return m ? m.i : -1;
  }
  // Les mêmes, À UNE DATE (10.14.1) : achetées au plus tard ce jour-là, au montant que le 22 porte
  // ce jour-là (les avoirs postérieurs ne l'ont pas encore diminué). Sans `au`, toutes, au montant
  // d'aujourd'hui : c'est la liste « à immobiliser ».
  function immosEnAttente(data, au) {
    const borne = String(au || '').slice(0, 10);
    const achats = new Map((data.purchases || []).map(p => [p.id, p]));
    const done = new Set((data.assets || []).filter(a => a.purchaseId).map(a => `${a.purchaseId}#${ligneDeFiche(a, achats.get(a.purchaseId))}`));
    const out = [];
    (data.purchases || []).forEach(p => {
      // Un acompte n'est pas un bien reçu (il se reprend sur la facture, qui, elle, propose la
      // fiche) ; un avoir n'est pas une acquisition. Les deux proposaient une fiche de plus.
      if (p.kind === 'acompte' || p.kind === 'avoir') return;
      if (borne && (p.date || '') > borne) return;
      const moins = reductionsImmo(data, p, borne);
      (p.lines || []).forEach((l, i) => {
        if (l.destination !== 'immobilisation') return;
        if (done.has(`${p.id}#${i}`)) return;
        const amount = round3(valeurLigneImmo(data, p, l) - (moins[i] || 0));
        if (amount <= 0) return;
        out.push({ purchaseId: p.id, lineIndex: i, label: l.label || '', amount, date: p.date, supplierId: p.supplierId, number: p.number || '' });
      });
    });
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  // Ce que le compte 22 porte au 31/12 et que le tableau des biens de l'exercice ne montre pas
  // (10.14.1). Le tableau se tient par MISE EN SERVICE, le 22 par ACHAT : une ligne d'achat
  // « immobilisation » sans fiche y est depuis l'achat — et son amortissement nulle part —, un bien
  // acheté en décembre et mis en service en janvier aussi. Regardé un 1er janvier, l'exemple disait
  // 53 950 au bilan et 52 500 sur la page Immobilisations, sans un mot, et l'invariant qui compare
  // les deux tombait chaque début d'année. L'inverse existe : un bien mis en service AVANT sa
  // facture est au tableau et pas encore au 22.
  //  - `sansFiche` et `pasEnService` : au 22, pas au tableau — au montant que le 22 porte ;
  //  - `avantFacture` : au tableau, pas encore au 22 — au montant de la fiche, celui du tableau.
  function immosHorsTableau(data, year) {
    const fin = `${Number(year)}-12-31`;
    const achats = new Map((data.purchases || []).map(p => [p.id, p]));
    const sansFiche = immosEnAttente(data, fin);
    const pasEnService = [], avantFacture = [];
    (data.assets || []).forEach(a => {
      const p = a.purchaseId && achats.get(a.purchaseId);
      const idx = ligneDeFiche(a, p);
      const l = p && (p.lines || [])[idx];
      if (!l || l.destination !== 'immobilisation' || !a.date || !p.date) return;
      // Sorti avant la fin de l'exercice : ni au tableau, ni au 22.
      if (a.disposal && a.disposal.date && a.disposal.date <= fin) return;
      const achete = p.date <= fin, enService = a.date <= fin;
      if (achete && !enService) {
        const amount = round3(valeurLigneImmo(data, p, l) - (reductionsImmo(data, p, fin)[idx] || 0));
        if (amount > 0) pasEnService.push({ assetId: a.id, label: a.label || l.label || '', amount, date: p.date, miseEnService: a.date, number: p.number || '' });
      } else if (!achete && enService) {
        avantFacture.push({ assetId: a.id, label: a.label || l.label || '', amount: round3(Number(a.amount) || 0), date: p.date, miseEnService: a.date, number: p.number || '' });
      }
    });
    const somme = rows => round3(rows.reduce((t, r) => t + r.amount, 0));
    return { sansFiche, pasEnService, avantFacture,
      auBilan: round3(somme(sansFiche) + somme(pasEnService)), horsBilan: somme(avantFacture),
      vide: !sansFiche.length && !pasEnService.length && !avantFacture.length };
  }
  // Les biens déjà créés au montant d'AVANT un avoir du fournisseur (10.14.1) : la fiche porte encore
  // la valeur de la ligne d'achat, le 22 la valeur diminuée. On ne corrige pas la fiche d'office —
  // elle a pu être ajustée à la main pour une autre raison (des frais d'installation) — on la NOMME
  // quand elle est restée exactement au montant brut.
  function biensADiminuer(data) {
    const achats = new Map((data.purchases || []).map(p => [p.id, p]));
    return (data.assets || []).map(a => {
      const p = a.purchaseId && achats.get(a.purchaseId);
      const idx = ligneDeFiche(a, p);
      const l = p && (p.lines || [])[idx];
      if (!l || l.destination !== 'immobilisation') return null;
      const moins = reductionsImmo(data, p)[idx] || 0;
      const brut = valeurLigneImmo(data, p, l);
      if (!moins || Math.abs(round3(Number(a.amount) || 0) - brut) > 0.0005) return null;
      return { assetId: a.id, label: a.label || l.label || '', montant: brut, attendu: round3(brut - moins), moins };
    }).filter(Boolean);
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
    // Les bornes se lisent en base 360 : un mois entier vaut trente jours, février compris. Lu tel
    // quel, le 28 février donnait vingt-huit jours à février et trente-deux à mars (10.14.0).
    const before = fin360(addDays(period.from, -1));
    const to = fin360(period.to);
    return round3((data.assets || []).reduce((s, a) =>
      s + Math.max(0, round3(cappedCumulated(a, to) - cappedCumulated(a, before))), 0));
  }
  // Le dernier jour de février devient le 30 : c'est le seul mois que `days360` (qui ramène le 31 à
  // 30) ne compte pas entier. Tout autre jour reste tel quel — une mise en service ou une cession
  // le 28 février garde ses jours réels, comme dans le tableau des amortissements.
  function fin360(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return iso;
    const [yy, mm, dd] = iso.split('-').map(Number);
    return dd < 30 && dd === daysInMonth(yy, mm) ? `${iso.slice(0, 8)}30` : iso;
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
    ['apport', 'Apport ou subvention', 1], ['pret', 'Déblocage de prêt', 1], ['autre-entree', 'Autre entrée', 1],
    ['virement', 'Virement entre mes comptes', -1]
  ];
  const moveSign = kind => { const m = MOVE_KINDS.find(x => x[0] === kind); return m ? m[2] : -1; };
  // Les deux côtés d'un virement entre deux comptes de l'entreprise (10.14.1) : chacun est un compte
  // qui EXISTE, ou ''. Un côté dont le compte a été supprimé n'est plus rien : l'autre garde ce que
  // SON relevé dit (la banque qui a vraiment reçu 300 DT les garde), et la contrepartie va au compte
  // d'attente — le comptable la verra, rien ne se perd en silence. La 10.14.0 faisait basculer un
  // départ supprimé sur le compte par défaut : quand l'arrivée ÉTAIT ce compte, le virement devenait
  // « de la Banque à la Banque », traité en sortie — 300 DT reçus devenaient 300 DT perdus.
  // Un départ jamais choisi (saisi avant tout compte) est le compte par défaut, comme pour tout
  // mouvement ; un virement d'un compte à lui-même ne déplace rien (`neutre`).
  function virementCotes(data, m) {
    if (!m || m.kind !== 'virement') return null;
    const comptes = (data && data.accounts) || [];
    const existe = id => !!id && comptes.some(a => a.id === id);
    const defaut = comptes.find(a => a.isDefault) || comptes[0];
    const vers = existe(String(m.versAccountId || '')) ? String(m.versAccountId) : '';
    let depart = existe(m.accountId) ? m.accountId : '';
    // Sans départ connu : le compte par défaut quand le départ n'a jamais été choisi, ou quand
    // AUCUN des deux côtés n'existe plus (le mouvement reste alors une sortie à ventiler).
    if (!depart && (!m.accountId || !vers)) depart = defaut ? defaut.id : '';
    return { depart, vers, neutre: !!depart && depart === vers };
  }
  // Le compte d'arrivée d'un virement, ou '' (10.14.0) : le seul lecteur qui n'a besoin que de lui.
  function virementVers(data, m) {
    const c = virementCotes(data, m);
    return c && !c.neutre && c.depart ? c.vers : '';
  }

  // 10.14.0 — Le compte bancaire naît de la FICHE SOCIÉTÉ. L'entreprise a déjà donné sa banque et
  // son RIB (la fiche, « Tes premiers pas ») ; les retaper dans la Trésorerie, c'est la ressaisie
  // que SkanFact promet d'éviter. UNE fonction pour les trois portes — le paiement sans compte,
  // l'état vide de la Trésorerie, « + Compte » — parce que deux copies de ce préremplissage avaient
  // déjà divergé : le paiement le posait depuis la 10.12.0, et la Trésorerie, la page faite pour
  // ça, ouvrait un compte vide.
  // Rend null quand la fiche ne dit rien, ou quand un compte porte déjà ce RIB : on ne propose pas
  // deux fois le même compte. Un RIB se compare sans ses espaces, et un IBAN tunisien (TN59 suivi
  // des vingt chiffres) désigne le même compte que son RIB.
  function compteDepuisFiche(company, accounts) {
    const co = company || {};
    const banque = String(co.bank || '').trim();
    const rib = String(co.rib || '').trim();
    if (!banque && !rib) return null;
    const norme = s => String(s || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    const cle = norme(rib);
    const meme = a => {
      const k = norme(a.rib);
      if (cle && k) return k === cle || (k.length >= 20 && cle.length >= 20 && (k.endsWith(cle) || cle.endsWith(k)));
      return !cle && !!banque && String(a.bank || '').trim().toLowerCase() === banque.toLowerCase();
    };
    if ((accounts || []).some(meme)) return null;
    return { name: banque ? `${banque} — compte courant` : 'Compte courant', kind: 'banque', bank: banque, rib };
  }

  // Tous les mouvements réels d'une période, quelle que soit leur origine. Un mouvement porte
  // toujours un compte : sans compte affecté, il est rattaché au compte par défaut.
  function cashMovements(data, company, period, accountId) {
    const out = [];
    const defaultAccount = (data.accounts || []).find(a => a.isDefault) || (data.accounts || [])[0];
    const fallback = defaultAccount ? defaultAccount.id : '';
    // Le compte d'une ligne : celui qu'elle nomme s'il existe encore, sinon le compte par défaut
    // (10.14.0). Supprimer un compte promet « ses mouvements basculeront sur le compte par défaut » ;
    // la Trésorerie gardait pourtant l'identifiant disparu, et ces lignes ne tombaient plus dans
    // aucun compte — pendant que les écritures (`journalDeCompte`) les passaient bien au compte par
    // défaut : la banque de la page et celle du grand livre ne disaient plus la même chose.
    const existants = new Set((data.accounts || []).map(a => a.id));
    const compteDe = id => (id && existants.has(id)) ? id : fallback;
    const keep = id => !accountId || compteDe(id) === accountId;
    const clientName = id => ((data.clients || []).find(c => c.id === id) || {}).name || '—';
    const supplierName = id => ((data.suppliers || []).find(s => s.id === id) || {}).name || '—';

    (data.documents || []).filter(d => d.type === 'facture').forEach(d => (d.payments || []).forEach(p => {
      if (!inPeriod(p.date, period && period.from, period && period.to) || !keep(p.accountId)) return;
      const rend = estRemboursement(p);
      out.push({
        id: p.id, kind: rend ? 'decaissement' : 'encaissement', date: p.date, accountId: compteDe(p.accountId),
        label: `${rend ? 'Remboursement' : 'Encaissement'} ${d.number || ''}`.trim(), party: clientName(d.clientId),
        amount: montantRegle(d, p, company), method: p.method || '',
        reference: p.reference || '', docId: d.id, reconciled: !!p.reconciled, source: 'vente'
      });
    }));
    (data.purchases || []).forEach(pu => (pu.payments || []).forEach(p => {
      if (!inPeriod(p.date, period && period.from, period && period.to) || !keep(p.accountId)) return;
      // Un règlement porté par un AVOIR est un remboursement : l'argent ENTRE (10.2.0) — le journal
      // (`supplierPayments`) le savait, la Trésorerie non : elle le sortait du compte, et la banque
      // de la page et celle du grand livre différaient de deux fois le remboursement (10.14.0). Un
      // règlement NÉGATIF sur une facture trop payée est le même geste : le fournisseur rend.
      const montant = -round3((pu.kind === 'avoir' ? -1 : 1) * montantRegle(pu, p, company));
      const rendu = montant > 0;
      out.push({
        id: p.id, kind: rendu ? 'encaissement' : 'decaissement', date: p.date, accountId: compteDe(p.accountId),
        label: `${rendu ? 'Remboursement' : 'Règlement'} ${pu.number || 'd\'un achat sans numéro'}`, party: supplierName(pu.supplierId),
        // Ce qui sort du compte sort en DINARS (10.1.0), comme l'encaissement client dix lignes
        // plus haut : régler 500 € vide le compte de 1 700 DT, pas de 500. Sans ça, la trésorerie
        // de la page et celle du grand livre se contredisaient — et c'est le test des états
        // financiers qui l'a dit, pas la relecture.
        amount: montant, method: p.method || '',
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
        id: 'pay-' + sl.id, kind: 'sortie', date: sl.paidDate, accountId: compteDe(sl.accountId),
        label: `Salaire ${monthLabel(payslipDate(sl))}`, party: emp.name || 'Salarié',
        amount: -round3(net), method: sl.method || 'virement', reference: sl.reference || '',
        payslipId: sl.id, reconciled: !!sl.reconciled, source: 'paie'
      });
    });
    // 10.14.0 : une AVANCE sur salaire est de l'argent qui sort le jour où on la verse. Elle ne
    // remontait nulle part — ni ici, ni dans les écritures : la banque de la Trésorerie et celle du
    // grand livre étaient toutes deux trop hautes du montant avancé, et le 425 gardait pour toujours
    // les retenues qui la remboursent. Le remboursement, lui, est déjà dans le net versé plus bas.
    (data.advances || []).forEach(a => {
      const montant = round3(Number(a.amount) || 0);
      if (!montant || !inPeriod(a.date, period && period.from, period && period.to) || !keep(a.accountId)) return;
      const emp = (data.employees || []).find(e => e.id === a.employeeId) || {};
      out.push({
        id: 'av-' + a.id, kind: 'sortie', date: a.date, accountId: compteDe(a.accountId),
        label: 'Avance sur salaire', party: emp.name || 'Salarié',
        amount: -montant, method: a.method || 'virement', reference: a.reference || '',
        advanceId: a.id, reconciled: !!a.reconciled, source: 'avance'
      });
    });
    // Un VIREMENT entre deux comptes de l'entreprise (10.14.0) — la banque qui alimente la caisse, la
    // caisse déposée à la banque — sort de l'un et entre dans l'autre : deux lignes, une par compte,
    // chacune pointée sur SON relevé (`reconciled` au départ, `reconciledVers` à l'arrivée). Sans
    // cette nature, le seul geste proposé pour alimenter la caisse était « Retrait », qui passe au
    // compte courant de l'associé : la caisse ne recevait rien, et le gérant devait l'argent.
    const nomCompte = id => ((data.accounts || []).find(a => a.id === id) || {}).name || 'un autre compte';
    (data.movements || []).forEach(m => {
      if (!inPeriod(m.date, period && period.from, period && period.to)) return;
      const label = (MOVE_KINDS.find(k => k[0] === m.kind) || [null, 'Mouvement'])[1];
      const montant = round3(Math.abs(Number(m.amount) || 0));
      const cotes = virementCotes(data, m);
      if (cotes && cotes.neutre) return;      // d'un compte à lui-même : rien ne bouge
      const vers = cotes ? cotes.vers : '';
      const depart = cotes ? cotes.depart : compteDe(m.accountId);
      if (depart && keep(depart)) out.push({
        id: m.id, kind: moveSign(m.kind) > 0 ? 'entree' : 'sortie', date: m.date, accountId: depart,
        label: m.label || (vers ? `Virement vers ${nomCompte(vers)}` : label), party: label, amount: round3(moveSign(m.kind) * montant),
        method: m.method || '', reference: m.reference || '', movementId: m.id, reconciled: !!m.reconciled, source: 'libre', virement: !!vers
      });
      if (vers && keep(vers)) out.push({
        id: m.id + '~vers', kind: 'entree', date: m.date, accountId: vers,
        label: m.label || (depart ? `Virement depuis ${nomCompte(depart)}` : 'Virement depuis un compte supprimé'), party: label, amount: montant,
        method: m.method || '', reference: m.reference || '', movementId: m.id, reconciled: !!m.reconciledVers, source: 'libre', virement: true, arrivee: true
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
    // Le solde de départ n'existe qu'à partir de sa date (10.14.0) : un compte ouvert le 1er octobre
    // ne porte rien le 25 septembre. Le compté d'office, la Trésorerie annonçait un solde que les
    // écritures (qui posent l'ouverture à sa date) ne portaient pas — la banque du grand livre et
    // celle de la Trésorerie ne disaient plus la même chose.
    const ouvert = !acc.openingDate || !toIso || String(toIso) >= String(acc.openingDate);
    const opening = ouvert ? round3(Number(acc.opening) || 0) : 0;
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
    // Ce qui doit sortir : le reste dû de chaque achat — CONVERTI, comme la branche des clients juste
    // au-dessus. `purchaseBalance` rend le reste dans la devise de la pièce : une facture Adobe de
    // 1 190 € sortait de la prévision pour 1 190 DT au lieu de 4 046 — le trou annoncé était
    // sous-estimé de 2 856 dinars, sur la page faite pour savoir si l'on tiendra (rapport QA E-08,
    // le jumeau que la 10.1.0 n'avait pas vu parmi ses treize agrégateurs).
    (data.purchases || []).forEach(p => {
      const rest = purchaseBalance(p, company, data).remaining;
      if (rest <= 0.0005) return;
      const due = p.dueDate && p.dueDate > t ? p.dueDate : t;
      if (due > horizon) return;
      events.push({ date: due, amount: -round3(toBase(p, rest, company)), kind: 'fournisseur', late: !!(p.dueDate && p.dueDate < t),
        label: `${p.number || 'Achat'} — ${((data.suppliers || []).find(s => s.id === p.supplierId) || {}).name || ''}`.trim(), id: p.id });
    });
    // Ce qui doit sortir aussi : le net des bulletins pas encore payés (10.14.0). Un salaire dû est la
    // sortie la plus certaine qui soit — et la prévision l'ignorait : sur l'exemple, les 2 005 DT de
    // la paie d'août manquaient au « Solde projeté à 30 jours », sur la page faite pour savoir si
    // l'on tiendra. Le net est celui que le bulletin verse (avance déjà retenue), à la date de
    // paiement prévue si elle est à venir, sinon à la fin du mois du bulletin, ramenée à aujourd'hui
    // quand elle est passée — comme une facture échue.
    // Un bulletin marqué payé, lui, est un mouvement : dans le disponible s'il l'est à ce jour, dans
    // la branche des saisies à venir s'il l'est pour plus tard — jamais les deux.
    (data.payslips || []).forEach(sl => {
      if (sl.paidDate) return;
      const net = round3(((sl.computed || {}).net) || 0);
      if (net <= 0.0005) return;
      const fin = payslipDate(sl);
      const due = fin && fin > t ? fin : t;
      if (due > horizon) return;
      const emp = (data.employees || []).find(e => e.id === sl.employeeId) || {};
      events.push({ date: due, amount: -net, kind: 'salaire', late: !!fin && fin < t,
        label: `Salaire ${monthLabel(fin)} — ${emp.name || 'Salarié'}`, id: sl.id });
    });
    // Ce qui est déjà saisi pour plus tard (10.14.0) : un paiement client, un règlement, un bulletin
    // payé, une avance ou un mouvement daté après aujourd'hui. Il n'est pas dans le disponible, qui
    // s'arrête aujourd'hui, et une facture le compte déjà comme encaissé : sans cette branche, il
    // disparaissait de la prévision — un loyer saisi pour le 3 ne sortait nulle part.
    cashMovements(data, company, { from: addDays(t, 1), to: horizon }, null).forEach(m => {
      if (!m.amount) return;
      events.push({ date: m.date, amount: round3(m.amount), kind: 'saisi', source: m.source, late: false,
        label: m.party && m.party !== m.label ? `${m.label} — ${m.party}` : m.label,
        id: m.docId || m.purchaseId || m.payslipId || m.advanceId || m.movementId || m.id });
    });
    // Ce qui revient tout seul : les contrats récurrents déjà programmés.
    (data.recurring || []).filter(r => r.active !== false).forEach(r => {
      let d = r.nextDate;
      for (let i = 0; i < 24 && d && d <= horizon; i++) {
        if (d >= t) {
          const inv = buildRecurringInvoice(r, d, company, (data.clients || []).find(c => c.id === r.clientId));
          const due = addDays(d, delaiJours(company.paymentTermsDays, 30));
          // `toBase`, comme la branche des factures clients dix-neuf lignes plus haut : un contrat
          // porte sa devise et `buildRecurringInvoice` la reporte sur chaque facture. Sans la
          // conversion, un abonnement de 800 € entrait dans la prévision pour 800 DT — la courbe
          // montrait un creux qui n'existe pas, sur la page faite pour savoir si l'on tiendra.
          if (due <= horizon) events.push({ date: due, amount: round3(toBase(inv, computeTotals(inv, company).netToPay, company)), kind: 'contrat',
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
  const MERGE_LISTS = ['clients', 'catalog', 'documents', 'recurring', 'templates', 'snippets', 'suppliers', 'purchases', 'accounts', 'movements', 'projects', 'assets', 'stockAdjustments', 'serials', 'employees', 'payslips', 'leaves', 'advances', 'socialFilings', 'fiscalFilings', 'packs', 'licences', 'ecrituresOD'];
  const LIST_LABELS = {
    clients: 'client', catalog: 'prestation', documents: 'document', recurring: 'contrat récurrent',
    templates: 'modèle', snippets: 'texte', suppliers: 'fournisseur', purchases: 'achat',
    accounts: 'compte', movements: 'mouvement', projects: 'affaire', assets: 'immobilisation', stockAdjustments: 'mouvement de stock', serials: 'numéro de série', employees: 'salarié', payslips: 'bulletin de paie', leaves: 'congé', advances: 'avance sur salaire', socialFilings: 'déclaration sociale', fiscalFilings: 'échéance fiscale déposée', packs: 'envoi au cabinet', licences: 'licence émise', ecrituresOD: 'opération diverse'
  };
  // Le pluriel de chaque étiquette, écrit EN ENTIER (E-13) : « 2 bulletins de paie », pas « 2 bulletin
  // de paie » ni « 2 bulletin de paies ». Ajouter un « s » au bout n'accorde que le dernier mot, et
  // ne rien ajouter n'en accorde aucun. Les deux tables portent les MÊMES clés : un test les confronte.
  const LIST_PLURIELS = {
    clients: 'clients', catalog: 'prestations', documents: 'documents', recurring: 'contrats récurrents',
    templates: 'modèles', snippets: 'textes', suppliers: 'fournisseurs', purchases: 'achats',
    accounts: 'comptes', movements: 'mouvements', projects: 'affaires', assets: 'immobilisations', stockAdjustments: 'mouvements de stock', serials: 'numéros de série', employees: 'salariés', payslips: 'bulletins de paie', leaves: 'congés', advances: 'avances sur salaire', socialFilings: 'déclarations sociales', fiscalFilings: 'échéances fiscales déposées', packs: 'envois au cabinet', licences: 'licences émises', ecrituresOD: 'opérations diverses'
  };
  // « 5 prestations », « 1 bulletin de paie » : le compte d'une liste, accordé.
  const compteListe = (k, n) => plFr(n, LIST_LABELS[k] || k, LIST_PLURIELS[k]);

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
      const dejaDeduite = acomptesDeduits(data, p, company).byRate;
      // Un acompte à un autre taux que la facture se retranche aussi : l'union des deux listes.
      [...new Set([...Object.keys(t.vatByRate), ...Object.keys(dejaDeduite)])].forEach(rate => {
        if (!byRate[rate]) byRate[rate] = { collected: 0, deductible: 0 };
        byRate[rate].deductible = round3(byRate[rate].deductible + ((t.base.vatByRate[rate] || {}).deductible || 0) - (dejaDeduite[rate] || 0));
      });
    });
    const collected = round3(sales.reduce((s, r) => s + r.tva, 0));
    const deductible = round3(buys.reduce((s, r) => s + r.deductible, 0));
    const carry = round3(Math.max(0, Number(carryIn) || 0));
    const balance = round3(collected - deductible - carry);
    // Timbres encaissés : ils ne sont pas de la TVA mais se déclarent aussi. À VÉRIFIER.
    const stamps = round3(sales.reduce((s, r) => s + r.timbre, 0));
    // Retenues subies (déductibles de ton impôt) et opérées (à reverser) : celles des RÈGLEMENTS du
    // mois, jamais celles des factures (10.14.0) — tant que rien n'est versé, rien n'est retenu. Un
    // avoir posé après un règlement régularise dans SON mois.
    const withheldBySale = retenuesDeLaPeriode(data, company, period, 'ventes').total;
    const withheldOnBuys = retenuesDeLaPeriode(data, company, period, 'achats').total;
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
  // Le crédit de TVA avec lequel une année COMMENCE (10.14.0). La chaîne repartait de zéro chaque
  // 1er janvier, sauf crédit « saisi à la main » : un crédit laissé en décembre était PERDU en
  // janvier — la déclaration réclamait la TVA entière pendant que le 4366 gardait le crédit pour
  // toujours (316,160 DT sur l'exemple, cinq ans de suite), et le Cabinet, qui lit le 4366, disait
  // l'inverse de l'app entreprise pour le même mois. Le crédit se reporte d'une année à l'autre
  // comme d'un mois à l'autre : calculé dès que SkanFact connaît l'année d'avant, saisi à la main
  // pour la première année qu'il connaît (le crédit d'avant SkanFact).
  function premiereAnneeTva(data) {
    return duLot(data, 'tva:premiere', () => {
      let min = '';
      const noter = d => { const y = String(d || '').slice(0, 4); if (/^\d{4}$/.test(y) && (!min || y < min)) min = y; };
      (data.documents || []).forEach(d => { if ((d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon') noter(d.date); });
      (data.purchases || []).forEach(p => noter(p.date));
      return min;
    });
  }
  function reportTvaDebut(data, company, year) {
    const y = String(year);
    const saisi = round3(Math.max(0, Number((data.vatCarryIn || {})[y]) || 0));
    const premiere = premiereAnneeTva(data);
    if (!premiere || y <= premiere) return { montant: saisi, source: 'saisi', saisi };
    const precedente = String(Number(y) - 1);
    const montant = duLot(data, 'tva:report:' + y, () => vatChain(data, company, precedente, 12)[11].carryOut);
    return { montant, source: 'calcule', saisi, depuis: precedente };
  }

  // Dans un LOT (10.14.1, AN-01), la chaîne d'une année se calcule UNE fois, sur ses douze mois, et
  // chaque appel en reçoit une COPIE coupée au mois demandé : le mois M ne dépend que des mois
  // d'avant, donc la chaîne jusqu'à M est le début de la chaîne entière. Sans ça, l'écriture des
  // à-nouveaux rappelait la chaîne de chaque année passée, et `reportTvaDebut` celle de l'année
  // d'avant, encore et encore : une entreprise de dix ans attendait quatre secondes par écran.
  function vatChain(data, company, year, upToMonth) {
    const last = Math.min(12, Math.max(1, Number(upToMonth) || 12));
    if (lot && data && typeof data === 'object') {
      const pleine = duLot(data, 'tva:chaine:' + year, () => vatChainCalcul(data, company, year, 12));
      return JSON.parse(JSON.stringify(pleine.slice(0, last)));
    }
    return vatChainCalcul(data, company, year, last);
  }
  function vatChainCalcul(data, company, year, last) {
    const out = [];
    let carry = reportTvaDebut(data, company, year).montant;
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
  // Une échéance déjà déposée ne doit plus crier. La clé est `ruleId + date` : c'est une OCCURRENCE
  // qu'on pointe, pas une règle — la TVA d'octobre se dépose, celle de novembre reste due.
  const fiscalFilingId = (ruleId, dateIso) => `${ruleId}@${dateIso}`;
  function fiscalDone(data) { return new Set((data.fiscalFilings || []).map(f => f.id)); }

  // 10.12.0 — la CNSS et la déclaration annuelle d'employeur avaient DEUX pense-bêtes : l'occurrence
  // du calendrier fiscal (`cnss@2026-10-15`) et la déclaration de la Paie (`cnss-2026-T3`). Pointer
  // l'un laissait l'autre crier, « À faire » nommait la même déclaration deux fois, et le calendrier
  // acceptait « déposée » sur un trimestre pas encore terminé. Une occurrence du calendrier DÉSIGNE
  // la déclaration sociale qu'elle rappelle ; c'est celle de la Paie qui fait foi (une seule source).
  // L'échéance d'un trimestre tombe le mois qui le suit : janvier rappelle le 4e trimestre de l'année
  // d'avant. Celle de l'employeur rappelle l'année d'avant.
  function echeanceSociale(ruleId, dateIso) {
    const y = Number(String(dateIso || '').slice(0, 4)), m = Number(String(dateIso || '').slice(5, 7));
    if (!y || !m) return null;
    if (ruleId === 'cnss') {
      const q = m <= 3 ? 4 : Math.floor((m - 1) / 3);
      const yy = m <= 3 ? y - 1 : y;
      return { id: `cnss-${yy}-T${q}`, fin: addDays(`${yy}-${pad2(q * 3)}-01`, daysInMonth(yy, q * 3) - 1) };
    }
    if (ruleId === 'employeur') return { id: `employeur-${y - 1}`, fin: `${y - 1}-12-31` };
    return null;
  }
  // Les déclarations sociales pointées depuis le calendrier AVANT la 10.12.0 vivent dans
  // `fiscalFilings` : elles comptent encore, par leur équivalent.
  function socialesDeposees(data) {
    const s = new Set((data.socialFilings || []).map(f => f.id));
    (data.fiscalFilings || []).forEach(f => {
      const [r, d] = String(f.id).split('@');
      const soc = echeanceSociale(r, d);
      if (soc) s.add(soc.id);
    });
    return s;
  }

  function upcomingFiscal(data, todayIso, withinDays) {
    const t = todayIso || today();
    const within = Number(withinDays) || 30;
    const done = fiscalDone(data);
    const sociales = socialesDeposees(data);
    const fait = (r, date) => {
      const soc = echeanceSociale(r.id, date);
      return done.has(fiscalFilingId(r.id, date)) || !!(soc && sociales.has(soc.id));
    };
    return fiscalDeadlines(data).filter(r => r.active !== false).map(r => {
      let date = nextDeadline(r, t);
      // Déjà déposée : on saute à l'occurrence suivante plutôt que de faire disparaître la règle —
      // sinon pointer la TVA d'octobre effacerait aussi celle de novembre.
      let garde = 0;
      while (date && fait(r, date) && garde++ < 24) {
        date = nextDeadline(r, addDays(date, 1));
      }
      const soc = date ? echeanceSociale(r.id, date) : null;
      return date ? { id: r.id, label: r.label, note: r.note || '', date, days: daysBetween(t, date),
        filingId: fiscalFilingId(r.id, date), socialId: soc ? soc.id : '', fin: soc ? soc.fin : '',
        enCours: !!(soc && t <= soc.fin) } : null;
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
    // Ce que chaque destination COÛTE, TVA non déductible comprise (10.14.0) : une dépense de
    // réception à TVA non récupérable coûte son TTC, et l'écriture le passe ainsi au 606.
    (data.purchases || []).filter(p => inPeriod(p.date, period && period.from, period && period.to)).forEach(p => {
      const t = purchaseTotals(p, company);
      charges = round3(charges + t.base.cout.charge + t.base.fees);
      stock = round3(stock + t.base.cout.stock);
      immo = round3(immo + t.base.cout.immobilisation);
    });
    // De la marchandise achetée pour le stock sans article SUIVI n'entre dans aucun stock : aucune
    // sortie ne la valorisera jamais. Elle ne peut être qu'une charge — c'est ce que fait l'écriture
    // (607, sans inventaire). Sans cette ligne, le résultat simplifié l'oubliait (10.14.0).
    const entreesSuivies = round3(stockJournal(data, period).filter(m => m.source === 'achat')
      .reduce((s2, m) => s2 + (Number(m.qty) || 0) * (Number(m.unitApplied) || 0), 0));
    const horsSuivi = round3(stock - entreesSuivies);
    // Ce qui passe au résultat SANS être un achat, une vente ni un bulletin : des frais bancaires
    // payés par un mouvement, une assurance passée en OD, la valeur d'un bien cédé et le prix de sa
    // cession. Le résultat simplifié se présente comme le « résultat avant impôt » : il ne peut pas
    // ignorer ce que les écritures comptent (10.14.0 — sur l'exemple, 144 DT de frais par an).
    const autres = round3(journalEntries(data, company, period, { sections: ['tresorerie', 'od', 'amortissements'] })
      .filter(e => e.source !== 'amortissement' && compteDeGestion(e.account))
      .reduce((s2, e) => s2 + e.debit - e.credit, 0));
    // L'achat d'une immobilisation n'est pas une charge, mais son AMORTISSEMENT en est une : sans lui,
    // le résultat de l'année d'un gros investissement serait artificiellement bon (3.5.0).
    const depreciation = depreciationFor(data, period);
    // La paie n'est pas un achat : elle a sa propre page, mais c'est bien une charge de la période,
    // et la plus lourde de toutes dès qu'il y a un salarié (5.0.0). On compte le COÛT EMPLOYEUR.
    const payroll = payrollCost(data, period);
    // L'écart de change d'un avoir ou d'un acompte à un autre taux que sa pièce (10.14.0) : les
    // écritures le comptent, le résultat simplifié aussi.
    const change = ecartsDeChange(data, company, period);
    const resultat = round3(produits - charges - horsSuivi - cogs - depreciation - payroll - autres + change);
    return {
      produits, charges, stock, immo, cogs, horsSuivi, depreciation, payroll, autres, change, resultat,
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

  // Les dates des pièces qui entrent dans une clôture, triées. UNE liste pour les deux lecteurs :
  // le premier mois proposé à la clôture, et la phrase qui dit pourquoi il n'y en a pas.
  function datesDesPieces(data) {
    return [
      ...(data.documents || []).map(d => d.date),
      ...(data.purchases || []).map(p => p.date),
      ...(data.movements || []).map(m => m.date),
      ...(data.ecrituresOD || []).map(o => o.date)
    ].filter(Boolean).sort();
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
      const dates = datesDesPieces(data);
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

  // Pourquoi il n'y a RIEN à clôturer, quand `closableMonths` rend une liste vide. Trois cas, et le
  // plus trompeur est celui de l'entreprise qui vient de commencer : elle a des pièces, toutes dans
  // le mois en cours. Lui répondre « aucune pièce datée » (le défaut d'avant la 10.12.0) la faisait
  // douter de ce qu'elle venait de saisir. `des` est le jour où le premier mois deviendra clôturable.
  function rienACloturer(data, todayIso) {
    const cur = (todayIso || today()).slice(0, 7);
    const lendemain = mois => addMonths(mois + '-01', 1, 1);
    if (closedUntil(data)) return { cas: 'a-jour', mois: monthLabel(cur + '-01'), des: lendemain(cur) };
    const dates = datesDesPieces(data);
    if (!dates.length) return { cas: 'aucune' };
    // Sans clôture, une liste vide veut dire que la plus ancienne pièce est dans le mois en cours
    // — ou après : un devis daté du mois prochain ne rend clôturable aucun mois avant la fin du sien.
    const premier = dates[0].slice(0, 7) > cur ? dates[0].slice(0, 7) : cur;
    return { cas: 'pas-termine', n: dates.length, mois: monthLabel(premier + '-01'), enCours: premier === cur, des: lendemain(premier) };
  }

  // Ce qu'il vaut mieux régler AVANT de clôturer. On n'interdit rien : on montre, et l'utilisateur
  // décide. Un cabinet préfère un mois clôturé avec deux justificatifs manquants signalés qu'un mois
  // jamais clôturé parce que l'app faisait la difficile.
  // `opts.reserves` : ce que l'offre ferme (10.7.0). Un contrôle qui réclame un geste que l'offre
  // interdit est un reproche adressé à quelqu'un à qui on n'a rien offert (7.20.0).
  function closureChecks(data, company, from, to, opts) {
    const out = [];
    const reserves = (opts && opts.reserves) || [];
    const inRange = d => d && d >= from && d <= to;
    // `extra` : ce dont le bouton de la ligne a besoin pour ouvrir EXACTEMENT l'ensemble qu'elle nomme
    // (7.15.0) — la période, pour les achats sans justificatif.
    const add = (id, level, label, detail, count, extra) => { if (count) out.push({ id, level, label, detail, count, ...(extra || {}) }); };

    const drafts = (data.documents || []).filter(d => d.type === 'facture' && d.status === 'brouillon' && inRange(d.date));
    add('brouillons', 'danger', `${plFr(drafts.length, 'facture')} en brouillon dans la période`,
      'Un brouillon n\'a pas de numéro et n\'entre dans aucun journal. Émets-le ou change sa date avant de clôturer, sinon il restera invisible pour ton comptable.', drafts.length);

    const noProof = (data.purchases || []).filter(p => inRange(p.date) && sansJustificatif(p));
    add('justificatifs', 'warn', `${plFr(noProof.length, 'achat')} sans justificatif`,
      'Sans la pièce jointe, ton comptable ne peut pas récupérer la TVA de ces achats.', noProof.length, { du: from, au: to });

    const unticked = cashMovements(data, company).filter(m => inRange(m.date) && !m.reconciled);
    add('pointage', 'warn', `${plFr(unticked.length, 'mouvement')} non pointé${sAccord(unticked.length)}`,
      'Pointer les mouvements contre le relevé bancaire, c\'est ce qui prouve que la trésorerie est juste.', unticked.length);

    // Bulletins manquants : un salarié actif sans bulletin sur un mois travaillé.
    // 10.14.1 — TOUS les mois de la période. La boucle s'arrêtait à 24 : « Clôturer jusqu'à… » propose
    // jusqu'à dix ans d'un coup, et annonçait « 24 bulletins de paie à établir » pour quatre-vingts
    // manquants — la seule information qu'on lit avant de verrouiller des années. Le nombre de mois se
    // compte d'avance (règle 5.2.3 : jamais une boucle qui avance une date « jusqu'à » une autre sans
    // borne), et la borne est celle d'un siècle, pas d'une période qu'on peut vraiment choisir.
    const months = [];
    const [ya, ma] = from.slice(0, 7).split('-').map(Number), [yb, mb] = to.slice(0, 7).split('-').map(Number);
    const nbMois = Math.min(1200, Math.max(0, (yb - ya) * 12 + (mb - ma) + 1));
    for (let i = 0, m = from.slice(0, 7); i < nbMois; i++, m = addMonths(m + '-01', 1, 1).slice(0, 7)) months.push(m);
    let slipsMissing = 0, premierManque = '';
    months.forEach(mm => {
      const n = missingPayslips(data, Number(mm.slice(0, 4)), Number(mm.slice(5, 7))).length;
      if (n && !premierManque) premierManque = mm;
      slipsMissing += n;
    });
    add('bulletins', 'danger', `${plFr(slipsMissing, 'bulletin')} de paie à établir`,
      'Un salarié payé sans bulletin, c\'est une charge qui manque au résultat et une déclaration sociale fausse.', slipsMissing);
    // Le premier mois qui manque : « Voir les bulletins » y mène. Sur une période de plusieurs années,
    // arriver sur le mois en cours laissait chercher, année par année, où commençait l'oubli.
    if (premierManque) out[out.length - 1].mois = premierManque;

    const negative = stockList(data).filter(s => s.qty < 0);
    add('stock', 'warn', `${plFr(negative.length, 'article')} en stock négatif`,
      'Un stock négatif est une pièce d\'achat manquante, pas une erreur de comptage.', negative.length);

    const gaps = serialGaps(data);
    add('series', 'warn', `${plFr(gaps.length, 'écart')} entre quantités et numéros de série`,
      'Les deux comptes devraient dire la même chose.', gaps.length);

    // 10.14.1 — une ligne d'achat « immobilisation » sans fiche dans la période. Le bien est au bilan
    // (compte 22) depuis l'achat, son amortissement n'est compté nulle part ; et sa fiche se crée à
    // sa date de mise en service — une date qu'une clôture ferme. Clôturer sans le dire, c'était
    // découvrir en décembre qu'on ne peut plus créer la fiche de l'imprimante de mars sans rouvrir.
    // Quand l'offre ferme le module, c'est le comptable qui établit le plan depuis le paquet (9.7.0) :
    // rien à réclamer ici.
    if (!reserves.includes('immos')) {
      const sansFiche = immosEnAttente(data, to).filter(w => inRange(w.date));
      add('immobilisations', 'warn', `${plFr(sansFiche.length, 'achat')} à immobiliser dans la période`,
        'Sans fiche, le bien est au bilan mais son amortissement n\'est compté nulle part. Et la fiche se crée à la date de mise en service : une fois la période clôturée, elle ne pourra plus l\'être sans rouvrir.', sansFiche.length);
    }

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
      // « Pièce » est la référence des écritures (10.14.1, LET-01) : le numéro du fournisseur, ou
      // « SN-AAAAMMJJ » pour un ticket qui n'en a pas — le nom de son dossier dans le paquet.
      { key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'N° fournisseur' }, { key: 'piece', label: 'Pièce' }, { key: 'supplier', label: 'Fournisseur' },
      { key: 'kind', label: 'Nature' }, { key: 'category', label: 'Catégorie' }, { key: 'subject', label: 'Objet' },
      { key: 'ht', label: 'HT', type: 'money' }, { key: 'tva', label: 'TVA', type: 'money' }, { key: 'deductible', label: 'TVA déductible', type: 'money' },
      { key: 'fees', label: 'Timbre et frais', type: 'money' }, { key: 'ttc', label: 'TTC', type: 'money' },
      // La retenue que la pièce PORTE : elle s'opère au règlement (10.14.0), et c'est le journal des
      // règlements qui dit quand.
      { key: 'rs', label: 'Retenue à la source', type: 'money' }, { key: 'net', label: 'Net à payer', type: 'money' }, { key: 'status', label: 'Statut' }
    ];
  }
  function payCsvColumns() {
    return [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'Facture' }, { key: 'client', label: 'Client' },
      { key: 'amount', label: 'Montant', type: 'money' },
      // La retenue que le client a gardée sur CET encaissement (10.14.0) : c'est elle que la
      // déclaration du mois porte comme retenue subie.
      { key: 'rs', label: 'Retenue subie', type: 'money' },
      { key: 'method', label: 'Mode' }, { key: 'reference', label: 'Référence' }, { key: 'note', label: 'Note' }
    ];
  }
  function supplierPayCsvColumns() {
    return [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'Pièce fournisseur' }, { key: 'piece', label: 'Pièce' }, { key: 'supplier', label: 'Fournisseur' },
      { key: 'amount', label: 'Montant', type: 'money' },
      // La retenue que CE règlement a opérée (10.14.0) : c'est elle que la déclaration du mois reverse.
      { key: 'rs', label: 'Retenue opérée', type: 'money' },
      { key: 'method', label: 'Mode' }, { key: 'reference', label: 'Référence' }, { key: 'note', label: 'Note' }
    ];
  }
  function cashCsvColumns() {
    return [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'label', label: 'Libellé' }, { key: 'kindLabel', label: 'Nature' },
      { key: 'accountName', label: 'Compte' }, { key: 'inAmount', label: 'Entrée', type: 'money' }, { key: 'outAmount', label: 'Sortie', type: 'money' },
      { key: 'reference', label: 'Référence' }, { key: 'reconciled', label: 'Pointé' }
    ];
  }
  // Les LIGNES du journal de trésorerie, dans la forme que ses colonnes réclament. `cashMovements`
  // rend `kind`, `accountId` et un `amount` signé ; les colonnes demandaient `kindLabel`,
  // `accountName`, `inAmount` et `outAmount` — quatre clés que personne n'écrivait, donc quatre
  // colonnes vides dans CHAQUE paquet envoyé depuis la 6.1.0, sans qu'aucun message ne le dise
  // (T-01). Un test confronte désormais chaque clé des colonnes aux lignes produites ici.
  function cashCsvRows(data, moves) {
    const accName = id => ((data.accounts || []).find(a => a.id === id) || {}).name || '';
    const nature = m => m.source === 'vente' ? (m.amount < 0 ? 'Remboursement client' : 'Encaissement client')
      : m.source === 'achat' ? 'Règlement fournisseur'
        : m.source === 'paie' ? 'Salaire'
          : m.party || 'Mouvement';
    return (moves || []).map(m => ({
      ...m,
      kindLabel: nature(m), accountName: accName(m.accountId),
      inAmount: m.amount > 0 ? m.amount : 0, outAmount: m.amount < 0 ? round3(-m.amount) : 0,
      reconciled: m.reconciled ? 'oui' : 'non'
    }));
  }

  // Nom de fichier : lisible d'un coup d'œil dans une boîte mail encombrée, et triable.
  function packFileName(company, period, definitive) {
    const slug = String(company.name || 'entreprise').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
  function packChecklist(data, company, period, opts) {
    const out = closureChecks(data, company, period.from, period.to, opts).slice();
    // Un client qui t'a payé ce mois en gardant une retenue à la source, et dont l'attestation n'est
    // pas arrivée. C'est LUI qui la remet (10.14.0) : la phrase disait l'inverse — « non remise… ton
    // client ne peut pas justifier » —, et elle comptait les factures DATÉES du mois, payées ou non.
    const certs = attestationsARecevoir(data, company, period);
    if (certs.length) out.push({
      id: 'attestations', level: 'warn', count: certs.length,
      label: `${plFr(certs.length, 'attestation')} de retenue à la source à recevoir de tes clients`,
      detail: 'Un client qui te paie en gardant une retenue te remet son attestation : sans elle, tu ne peux pas déduire cette retenue de ton impôt.'
    });
    return out;
  }

  // ---------- les justificatifs (10.14.1, S-04) ----------
  //
  // Skander : « quand je cherche une pièce jointe je la trouve pas, et il faut qu'on voie quand une
  // ligne a un justificatif — c'est ce qui part au comptable, et c'est grâce à ça qu'on prouve tout ».
  // Un fichier joint vit sur SA pièce : un document, un achat, un mouvement libre. Une ligne DÉDUITE
  // — un encaissement, un règlement, une écriture — montre ceux de la pièce d'où elle vient : on ne
  // joint pas deux fois la même facture, et le 📎 d'un règlement est celui de l'achat qu'il paie.
  // La règle qui fait un achat « sans justificatif » : UNE fonction pour le contrôle de clôture qui
  // les compte et pour le filtre de la liste qui les montre (6.8.1 : un compteur et la liste qu'il
  // annonce se calculent avec la même fonction).
  function sansJustificatif(p) { return !((p && p.attachments) || []).length; }
  function nomsJustificatifs(x) {
    return ((x && x.attachments) || []).map(a => (a && a.name) || '').filter(Boolean).join(' ');
  }
  function justificatifsDe(data, x) {
    if (!x) return [];
    if (Array.isArray(x.attachments)) return x.attachments;
    const dans = (liste, id) => (id && ((data && data[liste]) || []).find(y => y.id === id) || {}).attachments || [];
    if (x.movementId) return dans('movements', x.movementId);
    if (x.purchaseId) return dans('purchases', x.purchaseId);
    const s = x.source;
    if (s === 'achat' || s === 'règlement') return dans('purchases', x.docId);
    if (s === 'mouvement') return dans('movements', x.docId);
    if (s === 'vente' || s === 'encaissement') return dans('documents', x.docId);
    return [];
  }
  // Le dossier d'un justificatif dans le paquet : lisible, et sans rien que le système refuse dans un
  // nom (le numéro d'une pièce porte des « / » chez certains fournisseurs). Les LETTRES de toutes les
  // écritures restent (`\p{L}`, règle 6.8.1) : le ZIP porte ses noms en UTF-8, et `\w` changeait
  // « quittance août.pdf » en « quittance ao_t.pdf » — et deux noms en arabe en le même « ____.pdf ».
  const dossierDuPaquet = s => String(s || '').replace(/[^\p{L}\p{N}_.-]+/gu, '_') || 'piece';
  const nomDansPaquet = a => String(a.name || a.file || '').replace(/[^\p{L}\p{N}_.\- ]+/gu, '_').trim() || 'fichier';

  // Le plan du paquet : la liste exacte de ce qu'il contiendra, chaque entrée sachant d'où vient son
  // contenu. main.js n'a plus qu'à exécuter ce plan. Le séparer ainsi permet de le tester entièrement
  // sans Electron, et de montrer à l'utilisateur ce qui va partir AVANT de le fabriquer.
  function packPlan(data, company, period, opts) {
    opts = opts || {};
    const entries = [];
    const inRange = d => d && d >= period.from && d <= period.to;
    // Deux fichiers ne partent jamais sous le même chemin (10.14.1, S-04) : deux justificatifs nommés
    // « facture.pdf » sur la même pièce faisaient deux entrées identiques dans le ZIP, et le
    // comptable n'en voyait qu'une. Le second devient « facture (2).pdf ».
    const pris = new Set();
    const unique = chemin => {
      let c = chemin, n = 2;
      while (pris.has(c)) { c = chemin.replace(/(\.[^./]*)?$/, m => ` (${n})${m}`); n++; }
      pris.add(c); return c;
    };
    const add = e => { e.path = unique(e.path); entries.push(e); return e; };

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
    add({ path: 'journaux/tresorerie.csv', kind: 'text', label: 'Mouvements de trésorerie', text: toCsv(cashCsvRows(data, cash), cashCsvColumns()), rows: cash.length });

    // 1 bis. Les écritures en partie double. C'est le fichier qui fait gagner des heures au cabinet :
    // il l'importe au lieu de retaper les pièces une à une. Les numéros de compte sont ceux réglés
    // par l'entreprise — À VÉRIFIER, et c'est écrit dans le fichier comme sur la page de garde.
    // Par `livreJournal`, comme l'écran (rapport QA E-07) : `journalEntries` ne numérote pas, et la
    // colonne « N° » du fichier — celle qui regroupe les lignes en pièces à l'import — partait VIDE,
    // pendant que l'écran promettait des numéros qui ne bougent plus.
    const ecritures = livreJournal(data, company, period, {});
    const balance = entriesBalance(ecritures);
    add({ path: 'journaux/ecritures.csv', kind: 'text', label: 'Écritures comptables (partie double)', text: toCsv(ecritures, entryCsvColumns()), rows: ecritures.length });
    // 1 ter. La balance du mois (8.8.0) : ouverture, mouvements, soldes — le premier document que le
    // cabinet tire pour contrôler un dossier, et le seul qui dise d'un coup d'œil où en sont les tiers.
    const bal = balanceGenerale(data, company, period, {});
    add({ path: 'journaux/balance.csv', kind: 'text', label: 'Balance générale', text: toCsv(bal.rows, balanceCsvColumns()), rows: bal.rows.length });

    // 2. La TVA du mois, avec son report : un mois isolé sans le crédit reporté donne un chiffre faux.
    // Le mois tel que la CHAÎNE des déclarations le calcule (10.14.0). Avant, le paquet reprenait
    // le crédit de début d'année pour CHAQUE mois : dès qu'un mois laissait un crédit, le suivant
    // annonçait au comptable une TVA à décaisser qui l'ignorait (mars de l'exemple : 286,729 DT au
    // lieu de 52,079), et un crédit saisi en janvier se déduisait douze fois. Une déclaration isolée
    // ignore le report (3.1.0) : seule `vatChain` le porte.
    const [anVat, moisVat] = period.month.split('-').map(Number);
    const vat = { ...vatChain(data, company, anVat, moisVat)[moisVat - 1], period };
    add({ path: 'journaux/tva.json', kind: 'text', label: 'TVA du mois', text: JSON.stringify(vat, null, 2) });

    // 2 bis. Les réponses aux questions du cabinet (9.10.0). Elles voyagent DANS le paquet plutôt
    // que dans un fichier à part : c'est déjà le geste mensuel, et une réponse qu'il faut penser à
    // envoyer séparément n'est jamais envoyée. Le fichier n'existe que s'il y a quelque chose à
    // dire — un `reponses.json` vide dans chaque paquet apprendrait au cabinet à ne plus l'ouvrir.
    const reponses = Compta.reponsesAEnvoyer(data.questionsCabinet || []);
    if (reponses.length) {
      add({ path: 'reponses.json', kind: 'text', label: `Réponses à ton comptable (${plFr(reponses.length, 'question')})`,
        text: JSON.stringify({ format: 1, reponses }, null, 2), rows: reponses.length });
    }

    // 3. Le PDF de chaque pièce émise. C'est le justificatif, pas le tableau.
    const issued = (data.documents || []).filter(d => (d.type === 'facture' || d.type === 'avoir')
      && inRange(d.date) && d.status !== 'brouillon');
    issued.forEach(d => add({
      path: `ventes/${(d.number || d.id).replace(/[^\w.-]+/g, '_')}.pdf`,
      kind: 'pdf', label: `${TITLES[d.type] || 'Pièce'} ${d.number || ''}`, docId: d.id, docType: d.type
    }));
    // 3 bis. Ce que l'utilisateur a joint à une pièce de vente émise (10.14.1, S-04) : le bon de
    // commande du client, le devis signé, le procès-verbal de réception. Il l'a joint pour prouver
    // quelque chose, et c'est au comptable que la preuve sert. Rangé à côté du PDF de la pièce.
    issued.forEach(d => (d.attachments || []).forEach(a => add({
      path: `ventes/${dossierDuPaquet(d.number || d.id)}/${nomDansPaquet(a)}`,
      kind: 'attachment', label: `Justificatif ${d.number || ''}`, ownerId: d.id, file: a.file
    })));

    // 4. Les justificatifs d'achat. Sans eux, la TVA déductible n'est pas récupérable.
    (data.purchases || []).filter(p => inRange(p.date)).forEach(p => {
      (p.attachments || []).forEach(a => add({
        path: `achats/${dossierDuPaquet(referenceAchat(p, data))}/${nomDansPaquet(a)}`,
        kind: 'attachment', label: `Justificatif ${referenceAchat(p, data)}`, ownerId: p.id, file: a.file
      }));
    });
    // 4 bis. Ceux d'un mouvement libre (10.14.1, S-04) : la quittance d'un loyer payé sans facture,
    // l'avis d'imposition, le relevé qui prouve des frais bancaires. Un mouvement sans facture n'a
    // QUE ce fichier pour se justifier.
    (data.movements || []).filter(m => inRange(m.date)).forEach(m => {
      (m.attachments || []).forEach(a => add({
        path: `tresorerie/${dossierDuPaquet(`${m.date}_${m.reference || m.label || m.id}`)}/${nomDansPaquet(a)}`,
        kind: 'attachment', label: `Justificatif du mouvement ${m.label || m.reference || ''}`.trim(), ownerId: m.id, file: a.file
      }));
    });
    // 4 ter. Où va chaque justificatif (10.14.1, S-04) : la pièce comptable qu'il prouve, par la clé
    // qui la désigne dans `ecritures.csv` (journal, pièce, date). Le cabinet s'en sert pour poser le
    // 📎 sur l'écriture et l'ouvrir d'un clic. On lit la clé dans les ÉCRITURES du mois plutôt que de
    // la refabriquer : un règlement ou une imputation porte le même document, et seule l'écriture de
    // la pièce elle-même (vente, achat, mouvement) désigne le justificatif.
    const piecesJointes = entries.filter(e => e.kind === 'attachment');
    if (piecesJointes.length) {
      const cleDe = {};
      ecritures.forEach(e => {
        if (!e.docId || cleDe[e.docId] || !['vente', 'achat', 'mouvement'].includes(e.source)) return;
        cleDe[e.docId] = { journal: e.journal, piece: e.piece, date: e.date };
      });
      const liens = piecesJointes.map(e => ({ chemin: e.path, nom: e.path.split('/').pop(), ...(cleDe[e.ownerId] || {}) }));
      add({ path: 'justificatifs.json', kind: 'text', label: 'Où va chaque justificatif',
        text: JSON.stringify({ format: 1, justificatifs: liens }, null, 2), rows: liens.length });
    }

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

    const checklist = packChecklist(data, company, period, opts);
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
      manifest, entries, checklist, definitive, period, balance, sceau: sceauEcritures(ecritures),
      ca: vs.ht, tvaCollectee: vs.tva, tvaDeductible: (bs && bs.deductible) || 0,
      encaisse: round3(pays.reduce((s2, r) => s2 + (Number(r.amount) || 0), 0)),
      totaux: {
        ventes: sales.length, achats: buys.length, encaissements: pays.length,
        pieces: issued.length, justificatifs: entries.filter(e => e.kind === 'attachment').length,
        bulletins: slips.length
      }
    };
  }

  // Ce que le comptable a reçu, résumé : le débit et le crédit de chaque compte du mois (10.14.0).
  // Rangé avec le paquet, il permet de DIRE qu'un mois a changé depuis son envoi — une réouverture,
  // ou une version de SkanFact qui corrige un calcul. Un paquet fabriqué ne se réécrit pas : c'est
  // l'utilisateur qui doit le refaire, et il ne le fera que si on le lui dit.
  function sceauEcritures(lignes) {
    const c = {};
    (lignes || []).forEach(e => {
      const x = c[e.account] || (c[e.account] = [0, 0]);
      x[0] = round3(x[0] + (Number(e.debit) || 0)); x[1] = round3(x[1] + (Number(e.credit) || 0));
    });
    return c;
  }
  // Les comptes dont le débit ou le crédit n'est plus le même, triés par numéro.
  function ecartsSceau(avant, maintenant) {
    const a = avant || {}, b = maintenant || {};
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
      .map(account => ({ account, avant: a[account] || [0, 0], maintenant: b[account] || [0, 0] }))
      .filter(x => Math.abs(x.avant[0] - x.maintenant[0]) > 0.0005 || Math.abs(x.avant[1] - x.maintenant[1]) > 0.0005);
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
        <tr><td>Justificatifs joints (achats, ventes, mouvements)</td><td class="r">${t.justificatifs}</td></tr>
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
    immobilisations: '22',       // Immobilisations corporelles — le compte exact dépend du bien (8.8.0 : 22, le 24 du SCE est « à statut juridique particulier »)
    fraisAccessoires: '608',     // Frais accessoires d'achat (transport, douane)
    avancesFournisseurs: '409',  // Avances et acomptes versés à un fournisseur (10.2.0) — À VÉRIFIER

    banque: '532',               // Banques
    caisse: '54',                // Caisse
    salairesBruts: '640',        // Rémunérations du personnel
    chargesPatronales: '645',    // Charges sociales patronales
    personnel: '425',            // Personnel — rémunérations dues
    cnss: '4531',                // CNSS (part salariale + part patronale)
    irpp: '4321',                // IRPP et contribution sociale retenus à la source
    resultat: '13',              // Résultat de l'exercice — reçoit les exercices passés à l'ouverture (8.8.0)
    // 8.9.0 — les contreparties des mouvements libres et de la déclaration mensuelle
    tvaAPayer: '4365',           // TVA à payer : le net de la déclaration du mois, timbres et retenues opérées compris
    fraisBancaires: '627',       // Services bancaires
    impots: '434',               // État — acomptes provisionnels et impôts réglés sans autre précision
    associes: '4421',            // Associés — comptes courants : apports, retraits, dividendes
    emprunts: '16',              // Emprunts : déblocage et échéances (capital)
    attente: '471',              // Compte d'attente : ce que le comptable ventilera
    reportANouveau: '12',        // Résultats reportés : contrepartie des soldes de départ saisis à la main
    // 9.0.0 — l'exercice : amortissements, cessions, taxes sur salaires
    dotations: '681',            // Dotations aux amortissements
    amortissements: '28',        // Amortissements des immobilisations (cumul)
    vncCedee: '675',             // Valeur comptable des immobilisations cédées
    produitsCession: '775',      // Produits des cessions d'immobilisations
    taxesSalaires: '661',        // TFP et FOPROLOS : impôts et taxes sur rémunérations (charge)
    tfpFoprolos: '4335',         // TFP et FOPROLOS à payer (dette envers l'État)
    // 9.7.0 — l'inventaire de fin d'exercice et les subventions d'investissement. Les rôles vivent
    // ici parce que `COMPTES_IMMO` (compta.js) n'est que le repli du Cabinet : un test confronte
    // les deux tables, sans quoi elles diraient un jour deux numéros différents pour un seul rôle.
    stocks: '37',                // Stocks de marchandises et de matières
    variationStocks: '603',      // Variation des stocks — la contrepartie de l'inventaire
    subventions: '14',           // Subventions d'investissement (À VÉRIFIER)
    repriseSubventions: '739',   // Quote-part de subvention reprise au résultat (À VÉRIFIER)
    // 10.14.0 — l'écart de change d'un avoir (ou d'un acompte) à un autre taux que la pièce qu'il
    // diminue : le client doit ce qu'il doit dans SA devise, et le 411 le porte au taux de la
    // facture ; la différence est un gain ou une perte de change (À VÉRIFIER).
    pertesChange: '655',         // Pertes de change
    gainsChange: '755'           // Gains de change
  };
  const ACCOUNT_LABELS = {
    clients: 'Clients', fournisseurs: 'Fournisseurs', ventes: 'Ventes',
    tvaCollectee: 'TVA collectée', tvaDeductible: 'TVA déductible', timbre: 'Timbre fiscal',
    rsSubie: 'Retenue à la source subie', rsOperee: 'Retenue à la source opérée',
    achatsStock: 'Achats de marchandises', charges: 'Charges', immobilisations: 'Immobilisations',
    fraisAccessoires: 'Frais accessoires d\'achat', avancesFournisseurs: 'Avances et acomptes versés',
    banque: 'Banque', caisse: 'Caisse',
    salairesBruts: 'Salaires bruts', chargesPatronales: 'Charges patronales',
    personnel: 'Personnel — net à payer', cnss: 'CNSS', irpp: 'IRPP retenu',
    resultat: 'Résultat des exercices passés',
    tvaAPayer: 'TVA à payer', fraisBancaires: 'Frais bancaires', impots: 'Impôts et acomptes réglés',
    associes: 'Compte courant des associés', emprunts: 'Emprunts', attente: 'Compte d\'attente (à ventiler)',
    reportANouveau: 'Report à nouveau (soldes de départ)',
    dotations: 'Dotations aux amortissements', amortissements: 'Amortissements cumulés', vncCedee: 'Valeur comptable des immobilisations cédées',
    produitsCession: 'Produits des cessions d\'immobilisations', taxesSalaires: 'TFP et FOPROLOS (charge)', tfpFoprolos: 'TFP et FOPROLOS à payer',
    stocks: 'Stocks', variationStocks: 'Variation des stocks',
    subventions: 'Subventions d\'investissement', repriseSubventions: 'Quote-part de subvention reprise',
    pertesChange: 'Pertes de change', gainsChange: 'Gains de change'
  };
  // Un mouvement libre de trésorerie (3.3.0) porte une NATURE ; la 8.9.0 lui donne sa contrepartie.
  // La nature décide par défaut ; un mouvement peut porter son propre `compte` (la TVA du mois
  // réglée en « impôt » va au 4365, pas au 434). Ce que personne ne sait ranger va au compte
  // d'attente : c'est le comptable qui ventile, et c'est écrit.
  const MOVE_ACCOUNTS = {
    salaire: 'personnel', impot: 'impots', banque: 'fraisBancaires', retrait: 'associes', emprunt: 'emprunts',
    'autre-sortie': 'attente', apport: 'associes', pret: 'emprunts', 'autre-entree': 'attente', virement: 'attente'
  };
  // Le RÔLE du compte d'un mouvement, sans contrepartie choisie (10.14.0). Un mouvement « Salaires »
  // RÈGLE ce qu'un bulletin a mis au 425 — mais une entreprise qui ne tient pas la Paie n'a pas de
  // bulletin : son mouvement était écrit « 425 au débit » et son salaire n'entrait dans AUCUNE
  // charge. Le résultat de l'onglet TVA, les états financiers et le paquet du comptable le
  // montraient trop beau du montant des salaires, et le 425 restait débiteur pour toujours. Sans
  // bulletin ce mois-là ni le précédent (un salaire se paie souvent au début du mois suivant), le
  // mouvement EST la charge : il va au 640 — À VÉRIFIER, le comptable ventile le net et les
  // charges. Le mois d'avant, et pas plus loin : créer un bulletin ne réécrit jamais que le mois où
  // il tombe et le suivant.
  function moisAvecBulletin(data) {
    return duLot(data, 'moisAvecBulletin', () => new Set((data.payslips || [])
      .map(s => `${s.year}-${String(s.month).padStart(2, '0')}`)));
  }
  function compteDuMouvement(data, m, bulletins) {
    if (m && m.kind === 'salaire') {
      const mois = String(m.date || '').slice(0, 7);
      const avant = mois ? addMonths(`${mois}-01`, -1).slice(0, 7) : '';
      const b = bulletins || moisAvecBulletin(data);
      if (!b.has(mois) && !b.has(avant)) return 'salairesBruts';
    }
    return MOVE_ACCOUNTS[m && m.kind] || 'attente';
  }
  // Les contreparties qu'un mouvement peut choisir à la main, pour ne pas taper un numéro de compte.
  const COMPTES_CONTREPARTIE = [
    ['', 'Selon la nature du mouvement'], ['4365', 'TVA à payer (déclaration du mois)'], ['4531', 'CNSS'],
    ['4321', 'IRPP retenu sur les salaires'], ['4352', 'Retenue à la source opérée'], ['434', 'Acompte provisionnel'],
    ['431', 'Impôt sur les sociétés'], ['4331', 'TCL'], ['4335', 'TFP et FOPROLOS'], ['627', 'Frais bancaires'],
    ['651', 'Intérêts d\'emprunt'], ['16', 'Emprunt (capital)'], ['4421', 'Compte courant d\'associé'],
    ['775', 'Prix de cession d\'une immobilisation'], ['471', 'À ventiler par le comptable']
  ];
  // Le plan comptable tunisien (Système comptable des entreprises, 1996), classe par classe. Il ne
  // sert qu'à NOMMER un compte à l'écran et dans les exports : le compte 6270 s'appelle « Services
  // bancaires » sans qu'on ait à le déclarer. Un compte s'y retrouve par son plus long préfixe.
  // À VÉRIFIER avec le comptable : les intitulés suivent la nomenclature, chaque cabinet a les siens.
  // Le plan comptable vit dans `compta.js` depuis la 9.8.5 : le Cabinet ne charge pas core.js et a
  // besoin de NOMMER un compte (c'est le défaut T-13 — un compte qui portait le libellé d'une
  // écriture). Réexporté à l'identique ; un test compare les deux par identité d'objet.
  const PLAN_COMPTABLE = Compta.PLAN_COMPTABLE;
  // L'intitulé d'un numéro de compte : d'abord le rôle que l'entreprise lui a donné (plan de comptes
  // réglé), sinon le plan tunisien par le plus long préfixe, sinon « Compte hors plan ». Un compte
  // auxiliaire (411 + code) porte le nom de son tiers, passé en `tiers`.
  function accountLabel(data, account, tiers) {
    const n = String(account || '');
    if (!n) return '';
    const acc = chartAccounts(data);
    const role = Object.keys(acc).find(k => acc[k] === n);
    if (role) return ACCOUNT_LABELS[role] || role;
    if (auxiliairesActifs(data) && tiers && (n.startsWith(acc.clients) || n.startsWith(acc.fournisseurs)) && n.length > Math.max(acc.clients.length, acc.fournisseurs.length)) return tiers;
    let best = null;
    PLAN_COMPTABLE.forEach(([p, l]) => { if (n.startsWith(p) && (!best || p.length > best[0].length)) best = [p, l]; });
    return best ? best[1] : 'Compte hors plan';
  }
  const classeDe = account => String(account || '').charAt(0);
  // Les classes 6 et 7 se remettent à zéro à chaque exercice ; les classes 1 à 5 traversent les années.
  const compteDeGestion = account => classeDe(account) === '6' || classeDe(account) === '7';

  // ---- comptes auxiliaires (8.8.0) : un sous-compte par client et par fournisseur ----
  // 411001, 411002… : c'est ainsi que tous les cabinets tiennent leurs tiers, et c'est ce qui rend
  // possible une balance auxiliaire et un lettrage. Le code d'un tiers est FIGÉ sur sa fiche
  // (`compteAux`) la première fois qu'il est calculé : supprimer un client ne renumérote jamais les
  // autres, sinon le 411004 du comptable désignerait quelqu'un d'autre le mois suivant.
  const auxiliairesActifs = data => !!(data && data.auxiliaires);
  function codesAuxiliaires(liste) {
    const out = {};
    let max = 0;
    (liste || []).forEach(t => { if (t && t.id && t.compteAux) { out[t.id] = String(t.compteAux); max = Math.max(max, Number(t.compteAux) || 0); } });
    (liste || []).forEach(t => { if (t && t.id && !out[t.id]) { max += 1; out[t.id] = String(max).padStart(3, '0'); } });
    return out;
  }
  // Écrit les codes calculés sur les fiches qui n'en ont pas encore. Renvoie le nombre de fiches touchées.
  function numeroterAuxiliaires(data) {
    let n = 0;
    ['clients', 'suppliers'].forEach(k => {
      const codes = codesAuxiliaires(data[k]);
      (data[k] || []).forEach(t => { if (t && t.id && !t.compteAux && codes[t.id]) { t.compteAux = codes[t.id]; n++; } });
    });
    return n;
  }
  // Les journaux : le comptable range ses écritures par nature d'opération.
  const ENTRY_JOURNALS = [
    ['VT', 'Ventes'], ['AC', 'Achats'], ['BQ', 'Banque'], ['CA', 'Caisse'], ['PAIE', 'Paie'], ['OD', 'Opérations diverses'], ['AN', 'À-nouveaux']
  ];
  const journalLabel = code => (ENTRY_JOURNALS.find(j => j[0] === code) || [code, code])[1];

  function chartAccounts(data) {
    return { ...DEFAULT_ACCOUNTS, ...((data && data.chartAccounts) || {}) };
  }

  // Le compte de trésorerie d'un règlement : espèces → caisse, tout le reste → banque.
  const cashAccountFor = (method, acc) => (method === 'espèces' || method === 'especes' || method === 'Espèces') ? acc.caisse : acc.banque;
  // Depuis la 8.9.0 le compte de trésorerie DÉCIDE : un règlement affecté à la caisse va au journal
  // de caisse quel que soit son mode. Sans compte affecté, on retombe sur le mode de paiement.
  // La règle est CELLE de la Trésorerie (`cashMovements`) : le compte affecté, sinon le compte par
  // défaut — le même argent ne peut pas être à la banque sur une page et en caisse sur l'autre.
  // Sans aucun compte de trésorerie, le mode de paiement décide.
  function journalDeCompte(data, acc, accountId, method) {
    const comptes = (data && data.accounts) || [];
    const compte = (accountId && comptes.find(a => a.id === accountId)) || comptes.find(a => a.isDefault) || comptes[0];
    const caisse = compte ? compte.kind === 'caisse' : cashAccountFor(method, acc) === acc.caisse;
    return caisse ? { journal: 'CA', compte: acc.caisse } : { journal: 'BQ', compte: acc.banque };
  }

  // Les écritures d'une période. `opts.auxiliaires` ajoute le nom du tiers en compte auxiliaire ;
  // `opts.sections` permet de n'exporter qu'une partie (ventes, achats, encaissements, paie).
  function journalEntries(data, company, period, opts) {
    // Dans un lot, les écritures d'une même période ne se calculent qu'UNE fois (10.14.0) : le paquet
    // du mois les demandait quatre fois (le journal, la TVA, la balance, le livre-journal) — une
    // seconde et demie par clic sur l'onglet Cabinet avec huit mille pièces. Chaque appelant reçoit
    // SES copies : un appelant qui annote une écriture n'écrit jamais dans celle d'un autre.
    if (lot && data && typeof data === 'object') {
      const cle = 'ecritures@' + JSON.stringify([period || null, opts || null]);
      const parSociete = duLot(data, cle, () => new Map());
      if (!parSociete.has(company)) parSociete.set(company, journalEntriesCalcul(data, company, period, opts));
      return parSociete.get(company).map(e => ({ ...e }));
    }
    return journalEntriesCalcul(data, company, period, opts);
  }
  function journalEntriesCalcul(data, company, period, opts) {
    opts = opts || {};
    const acc = chartAccounts(data);
    const want = s => !opts.sections || opts.sections.indexOf(s) >= 0;
    const out = [];
    const cur = (company && company.currency) || 'DT';
    // Comptes auxiliaires (8.8.0) : 411 + code du client, 401 + code du fournisseur, quand
    // l'entreprise l'a demandé. Les codes viennent des fiches (figés), sinon de l'ordre de la liste.
    const aux = auxiliairesActifs(data);
    const codesC = aux ? codesAuxiliaires(data.clients) : {};
    const codesF = aux ? codesAuxiliaires(data.suppliers) : {};
    const cptClient = id => (aux && id && codesC[id]) ? acc.clients + codesC[id] : acc.clients;
    const cptFourn = id => (aux && id && codesF[id]) ? acc.fournisseurs + codesF[id] : acc.fournisseurs;
    // Lettrage (8.9.0) : une facture soldée et ses règlements portent la même lettre — son numéro.
    // Rien à saisir : les paiements sont déjà rattachés à leur pièce, la lettre en découle.
    const lettreVente = doc => (doc && doc.type === 'facture' && doc.status !== 'annulée' && invoiceBalance(doc, data, company).remaining <= 0.0005) ? doc.number : '';
    const docsById = {}; (data.documents || []).forEach(d => { docsById[d.id] = d; });
    const lettreDoc = id => { const d = docsById[id]; if (!d) return ''; if (d.type === 'avoir') return d.creditOf ? lettreVente(docsById[d.creditOf]) : ''; return lettreVente(d); };
    // La référence d'un achat sans numéro (10.14.1, LET-01) : « SN- » et sa date, jamais son identifiant.
    const refsSN = referencesSansNumeroCalcul(data);
    const refAchat = p => (p && String(p.number || '').trim()) || (p && refsSN[p.id]) || '';
    const lettreAchat = p => (p && purchaseBalance(p, company, data).remaining <= 0.0005 && (p.payments || []).length) ? (refAchat(p) || p.id) : '';
    const achatsById = {}; (data.purchases || []).forEach(p => { achatsById[p.id] = p; });
    const ecartDeTaux = (piece, cible, natif) => ecartDeTauxEntre(piece, cible, natif, company);
    // `delta` a été AJOUTÉ au débit du compte du tiers : la contrepartie équilibre la pièce.
    const ecrireEcartDeChange = (e, delta, label) => {
      if (delta > 0.0005) e.credit(acc.gainsChange, label, delta);
      else if (delta < -0.0005) e.debit(acc.pertesChange, label, -delta);
    };

    // --- ventes : factures et avoirs émis
    if (want('ventes')) {
      salesJournal(data, company, period).forEach(r => {
        // Une facture ANNULÉE (statut enregistré) n'a jamais existé comptablement : `salesJournal`
        // met déjà tous ses montants à zéro, et `entrySet` ignore les lignes nulles. Le test portait
        // avant la 8.9.0 sur le statut EFFECTIF — or une facture entièrement couverte par un avoir
        // s'affiche « annulée » elle aussi : sa facture sautait, son avoir restait, et le client
        // finissait créditeur d'un montant qu'on ne lui avait jamais facturé. C'est le lettrage
        // (reste ouvert ≠ solde du 411) qui l'a attrapé.
        const e = entrySet({ date: r.date, journal: 'VT', piece: r.number, tiers: r.client, tiersId: r.clientId || '', source: 'vente', docId: r.id, currency: cur, lettre: lettreDoc(r.id) });
        const label = `${r.typeLabel} ${r.number}${r.client ? ' — ' + r.client : ''}`;
        // Le client est débité du BRUT — ce que la pièce vaut, retenue comprise (10.14.0). La retenue
        // ne naît pas ici : c'est le client qui l'opère en payant, et chaque encaissement le solde
        // de ce qu'il verse plus la part qu'il garde pour l'État (D 4358). À VÉRIFIER avec le
        // comptable : le fait générateur (le paiement) et la constatation.
        // Un avoir rattaché à une facture de même devise mais à un autre taux règle le client au taux
        // de la FACTURE ; l'écart part au change. Son montant est négatif : le montant natif aussi.
        const av = r.type === 'avoir' ? docsById[r.id] : null;
        const ta = av ? computeTotals(av, company) : null;
        // Le brut, c'est le TTC : le net après retenue plus la retenue (un seul arrondi, celui du TTC).
        const deltaChange = av && av.creditOf ? ecartDeTaux(av, docsById[av.creditOf], -ta.totalTTC) : 0;
        e.debit(cptClient(r.clientId), label, round3(r.ttc + deltaChange), { role: 'clients' });
        ecrireEcartDeChange(e, deltaChange, `Écart de change ${r.number}${av && av.creditOfNumber ? ' (au taux de ' + av.creditOfNumber + ')' : ''}`);
        // Un avoir posé APRÈS un encaissement régularise la retenue que le client a déjà gardée, à SA
        // date — jamais en réécrivant l'encaissement d'un mois déjà déclaré.
        if (av && av.creditOf && docsById[av.creditOf]) {
          const f = docsById[av.creditOf];
          const adj = retenueSubie(f, data, company).ajustements[av.id];
          if (adj) {
            const b = toBase(f, adj, company);
            e.debit(acc.rsSubie, `Régularisation de la retenue ${f.number || ''} (avoir ${r.number})`.replace(/\s+/g, ' '), b);
            e.credit(cptClient(r.clientId), label, b, { role: 'clients' });
          }
        }
        VAT_RATES.forEach(rate => {
          const v = r.vatByRate[rate];
          if (v && v.base) e.credit(acc.ventes, `${label} (HT ${rate} %)`, v.base, { vatRate: rate });
          if (v && v.vat) e.credit(acc.tvaCollectee, `TVA ${rate} % — ${r.number}`, v.vat, { vatRate: rate });
        });
        if (r.timbre) e.credit(acc.timbre, `Timbre fiscal ${r.number}`, r.timbre);
        ecrireEcartDeChange(e, r.ecartConversion || 0, `Écart de conversion ${r.number}`);
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
          const piece = refAchat(p);
          const e = entrySet({ date: p.date, journal: 'AC', piece, tiers: sup, tiersId: p.supplierId || '', source: 'achat', docId: p.id, currency: cur, lettre: lettreAchat(p) });
          const NATURE = { depense: 'Dépense', avoir: 'Avoir fournisseur', acompte: 'Acompte versé' };
          const label = `${NATURE[p.kind] || 'Achat'} ${num}${sup ? ' — ' + sup : ''}`;
          // Un acompte versé n'est pas une charge : c'est une créance sur le fournisseur tant qu'il
          // n'a pas livré (10.2.0). Il va donc aux avances, quelle que soit la destination des
          // lignes — et c'est l'imputation, plus bas, qui le solde le jour de la facture.
          // L'avoir, lui, garde les comptes de la facture : ses montants `base` sont NÉGATIFS et
          // `entrySet` change la colonne tout seul (règle 6.3.0).
          const dest = { charge: acc.charges, stock: acc.achatsStock, immobilisation: acc.immobilisations };
          // Tout ce qui entre dans un LIVRE est en devise de base (10.1.0) : une écriture porte la
          // devise de la comptabilité, jamais celle de la facture du fournisseur. Le montant
          // d'origine reste sur la pièce, et c'est elle qu'on rouvre pour le lire.
          if (t.base.avance) e.debit(acc.avancesFournisseurs, label, t.base.avance);
          Object.keys(t.base.byDestination).forEach(k => {
            if (t.base.byDestination[k]) e.debit(dest[k] || acc.charges, `${label} (${k})`, t.base.byDestination[k], { destination: k });
          });
          if (t.base.fees) e.debit(acc.fraisAccessoires, `Frais accessoires ${num}`, t.base.fees);
          if (t.base.deductibleVAT) e.debit(acc.tvaDeductible, `TVA déductible ${num}`, t.base.deductibleVAT);
          // TVA non déductible : elle n'est pas récupérable, elle grossit le COÛT de ce qu'elle a
          // payé — la charge, le stock ou le bien immobilisé (10.14.0 ; avant, toujours la charge,
          // et une voiture de tourisme passait sa TVA en frais l'année de l'achat au lieu de
          // l'amortir). Sur un acompte, elle reste dans l'avance, que l'imputation reprend entière.
          if (p.kind === 'acompte') {
            const nonDeductible = round3(t.base.totalVAT - t.base.deductibleVAT);
            if (nonDeductible) e.debit(acc.avancesFournisseurs, `TVA non déductible ${num}`, nonDeductible);
          } else {
            Object.keys(t.base.nonDeductibleParDestination).forEach(k => {
              const nd = t.base.nonDeductibleParDestination[k];
              if (nd) e.debit(dest[k] || acc.charges, `TVA non déductible ${num}`, nd, { destination: k });
            });
          }
          // La retenue à la source ne naît PAS ici (10.14.0) : elle s'opère au règlement, qui la
          // crédite au 4352 le jour où l'argent part. Le fournisseur est donc crédité du BRUT —
          // ce que la pièce lui doit —, et chaque règlement le débite de ce qu'il lui verse plus
          // la part de retenue qu'il garde pour l'État.
          // Un avoir IMPUTÉ sur une facture de même devise à un autre taux règle le fournisseur au
          // taux de la facture, pour la part qu'il déduit (ce que le fournisseur a remboursé est
          // sorti de son compte au taux de l'avoir, par le règlement) ; l'écart part au change.
          let deltaChange = 0;
          if (p.kind === 'avoir' && p.achatLie && achatsById[p.achatLie]) {
            deltaChange = ecartDeTaux(p, achatsById[p.achatLie], imputationAchat(p, company).brut);
          }
          e.credit(cptFourn(p.supplierId), label, round3(t.base.netToPay + t.base.withholding - deltaChange), { role: 'fournisseurs' });
          ecrireEcartDeChange(e, deltaChange, `Écart de change ${num} (au taux de ${achatsById[p.achatLie] ? (achatsById[p.achatLie].number || 'la facture') : 'la facture'})`);
          // Un avoir posé APRÈS un règlement régularise la retenue déjà opérée sur sa facture, à SA
          // date (10.14.0) — jamais en réécrivant le règlement d'un mois déjà déclaré. Positive, elle
          // s'opère comme au règlement (C 4352 / D 401) ; négative, les colonnes s'inversent seules.
          if (p.kind === 'avoir' && p.achatLie && achatsById[p.achatLie]) {
            const f = achatsById[p.achatLie];
            const adj = retenueDesReglements(f, company, data).ajustements[p.id];
            if (adj) {
              const b = toBase(f, adj, company);
              e.credit(acc.rsOperee, `Régularisation de la retenue ${f.number || ''} (avoir ${num})`.replace(/\s+/g, ' '), b);
              e.debit(cptFourn(p.supplierId), label, b, { role: 'fournisseurs' });
            }
          }
          out.push(...e.done());

          // L'IMPUTATION DE L'ACOMPTE (10.2.0). L'acompte a posé une avance au 409 et l'a réglée ;
          // la facture crédite le fournisseur de son total. Sans cette pièce, le 401 resterait
          // débiteur de l'acompte et le 409 débiteur pour toujours : deux comptes faux qui
          // s'annulent au bilan sans jamais se solder, donc que personne ne voit passer.
          // Un AVOIR n'en a pas besoin : ses montants `base` sont négatifs, donc son écriture
          // débite déjà le fournisseur — il ne reste qu'à lettrer.
          if (p.kind !== 'avoir' && p.kind !== 'acompte') {
            piecesLieesAchat(data, p.id, 'acompte').forEach(a => {
              const ta = purchaseTotals(a, company);
              // L'imputation REPREND ce que l'acompte avait posé, ligne par ligne, et recrédite le
              // fournisseur. La TVA en fait partie : celle de la facture porte sur le montant
              // ENTIER, acompte compris, donc la garder des deux côtés la déduirait deux fois.
              const im = entrySet({ date: p.date, journal: 'OD', piece, tiers: sup, tiersId: p.supplierId || '', source: 'achat', docId: p.id, currency: cur });
              const lbl = `Imputation acompte ${a.number || ''} sur ${num}`.replace('  ', ' ');
              // Au taux de la FACTURE (10.14.0) : un acompte payé à 3,30 sur une facture à 3,35 règle
              // 100 € de la dette, que le 401 porte à 3,35 ; l'écart part au change.
              // Le BRUT de l'acompte (10.14.0) : sa retenue a été opérée quand il a été versé, et
              // la facture n'en opérera que le reste.
              const deltaChange = ecartDeTaux(a, p, round3(ta.netToPay + ta.withholding));
              im.debit(cptFourn(p.supplierId), lbl, round3(ta.base.netToPay + ta.base.withholding + deltaChange), { role: 'fournisseurs' });
              ecrireEcartDeChange(im, deltaChange, `Écart de change ${a.number || ''} (au taux de ${num})`.replace('  ', ' '));
              const avance = round3(ta.base.totalTTC - ta.base.deductibleVAT);
              if (avance) im.credit(acc.avancesFournisseurs, lbl, avance);
              if (ta.base.deductibleVAT) im.credit(acc.tvaDeductible, lbl, ta.base.deductibleVAT);
              out.push(...im.done());
            });
          }
        });
    }

    // --- encaissements clients
    if (want('encaissements')) {
      paymentsJournal(data, company, period).forEach(r => {
        const j = journalDeCompte(data, acc, r.accountId, r.method);
        const e = entrySet({ date: r.date, journal: j.journal, piece: r.number || '', tiers: r.client, tiersId: r.clientId || '', source: 'encaissement', docId: r.docId, currency: cur, lettre: lettreDoc(r.docId) });
        const label = `${r.remboursement ? 'Remboursement' : 'Règlement'} ${r.number || ''}${r.client ? ' — ' + r.client : ''}${r.reference ? ' (' + r.reference + ')' : ''}`;
        e.debit(j.compte, label, r.amount);
        // Le client est soldé de ce qu'il verse ET de la retenue qu'il garde pour l'État : c'est ici,
        // à l'encaissement, que la retenue subie naît (10.14.0).
        e.credit(cptClient(r.clientId), label, round3(r.amountTiers + (r.rs || 0)), { role: 'clients' });
        if (r.rs) e.debit(acc.rsSubie, `Retenue à la source subie ${r.number || ''}`.trim(), r.rs);
        // Le client se solde au taux de SA facture ; la banque a reçu au taux du jour (10.14.0).
        const ecart = round3(r.amount - r.amountTiers);
        if (ecart > 0) e.credit(acc.gainsChange, `Gain de change — ${label}`, ecart);
        else if (ecart < 0) e.debit(acc.pertesChange, `Perte de change — ${label}`, -ecart);
        out.push(...e.done());
      });
    }

    // --- règlements fournisseurs
    if (want('reglements')) {
      supplierPayments(data, company, period).forEach(r => {
        const j = journalDeCompte(data, acc, r.accountId, r.method);
        const e = entrySet({ date: r.date, journal: j.journal, piece: refAchat(achatsById[r.purchaseId]) || r.number || '', tiers: r.supplier, tiersId: r.supplierId || '', source: 'règlement', docId: r.purchaseId, currency: cur, lettre: lettreAchat(achatsById[r.purchaseId]) });
        const label = `Règlement fournisseur ${r.number || ''}${r.supplier ? ' — ' + r.supplier : ''}`;
        // Le fournisseur est soldé de ce qu'on lui verse ET de la retenue qu'on garde pour l'État :
        // c'est ici, au paiement, que la retenue à la source naît (10.14.0).
        e.debit(cptFourn(r.supplierId), label, round3(r.amountTiers + (r.rs || 0)), { role: 'fournisseurs' });
        e.credit(j.compte, label, r.amount);
        if (r.rs) e.credit(acc.rsOperee, `Retenue à la source opérée ${r.number || ''}`.trim(), r.rs);
        // Payer plus de dinars que la pièce n'en porte est une perte de change (10.14.0).
        const ecart = round3(r.amount - r.amountTiers);
        if (ecart > 0) e.debit(acc.pertesChange, `Perte de change — ${label}`, ecart);
        else if (ecart < 0) e.credit(acc.gainsChange, `Gain de change — ${label}`, -ecart);
        out.push(...e.done());
      });
    }

    // --- 8.9.0 : les soldes de départ des comptes de trésorerie. Sans eux, la banque du grand livre
    // ne dirait jamais le même chiffre que la page Trésorerie. La contrepartie va au report à
    // nouveau — c'est au comptable de dire ce que ce solde représentait (capital, résultats passés).
    if (want('ouverture')) {
      (data.accounts || []).forEach(a => {
        const montant = round3(Number(a.opening) || 0);
        if (!montant || !a.openingDate || !inPeriod(a.openingDate, period && period.from, period && period.to)) return;
        const e = entrySet({ date: a.openingDate, journal: 'AN', piece: 'OUVERTURE', tiers: '', tiersId: '', source: 'ouverture', docId: a.id, currency: cur });
        const compte = a.kind === 'caisse' ? acc.caisse : acc.banque;
        e.debit(compte, `Solde de départ — ${a.name || 'compte'}`, montant);
        e.credit(acc.reportANouveau, `Solde de départ — ${a.name || 'compte'}`, montant);
        out.push(...e.done());
      });
      // Le stock de départ des articles (10.14.0) : de la marchandise déjà là avant les premiers
      // achats enregistrés. Elle entre au bilan contre le report à nouveau, jamais au résultat.
      inventaireComptable(data, opts.todayIso).departs.forEach(x => {
        if (!inPeriod(x.date, period && period.from, period && period.to)) return;
        const e = entrySet({ date: x.date, journal: 'AN', piece: 'OUVERTURE-STOCK', tiers: '', tiersId: '', source: 'ouverture', docId: 'stock-' + x.date, currency: cur });
        e.debit(acc.stocks, 'Stock de départ des articles', x.montant);
        e.credit(acc.reportANouveau, 'Stock de départ des articles', x.montant);
        out.push(...e.done());
      });
      // Le crédit de TVA saisi à la main pour une année (3.1.0) : la déclaration de janvier le
      // reprend, donc le compte 4366 doit le porter, sinon il finirait créditeur de ce montant.
      // Seulement pour une année dont SkanFact ne connaît pas l'année d'avant (10.14.0) : sinon le
      // report est CALCULÉ, et le 4366 le porte déjà par ses à-nouveaux — l'écrire ici le doublerait.
      Object.keys(data.vatCarryIn || {}).forEach(y => {
        const montant = round3(Number(data.vatCarryIn[y]) || 0);
        const d = `${y}-01-01`;
        if (!montant || !/^\d{4}$/.test(y) || !inPeriod(d, period && period.from, period && period.to)) return;
        if (reportTvaDebut(data, company, y).source !== 'saisi') return;
        const e = entrySet({ date: d, journal: 'AN', piece: `OUVERTURE-TVA-${y}`, tiers: '', tiersId: '', source: 'ouverture', docId: 'tva-' + y, currency: cur });
        e.debit(acc.tvaDeductible, `Crédit de TVA reporté de ${Number(y) - 1}`, montant);
        e.credit(acc.reportANouveau, `Crédit de TVA reporté de ${Number(y) - 1}`, montant);
        out.push(...e.done());
      });
    }

    // --- 8.9.0 : les mouvements libres de trésorerie. Un salaire réglé, un impôt payé, un apport,
    // des frais bancaires : ils sortaient de la banque sur la page Trésorerie et n'existaient dans
    // aucune écriture — la banque du grand livre était fausse de ce montant-là.
    if (want('tresorerie')) {
      const bulletins = moisAvecBulletin(data);
      (data.movements || []).forEach(m => {
        const montant = round3(Math.abs(Number(m.amount) || 0));
        if (!montant || !inPeriod(m.date, period && period.from, period && period.to)) return;
        const nature = (MOVE_KINDS.find(k => k[0] === m.kind) || [null, 'Mouvement'])[1];
        // Un virement entre deux comptes de l'entreprise (10.14.0) : le compte d'arrivée EST la
        // contrepartie — une banque qui alimente la caisse s'écrit 54 au débit, 532 au crédit. Un côté
        // supprimé (10.14.1) laisse l'autre à ce que son relevé dit, contre le compte d'attente.
        const cotes = virementCotes(data, m);
        if (cotes && cotes.neutre) return;
        const nomDe = id => ((data.accounts || []).find(a => a.id === id) || {}).name || 'un autre compte';
        if (cotes && !cotes.depart && cotes.vers) {
          const jv = journalDeCompte(data, acc, cotes.vers, m.method);
          const e = entrySet({ date: m.date, journal: jv.journal, piece: m.reference || nature, tiers: '', tiersId: '', source: 'mouvement', docId: m.id, currency: cur });
          const label = m.label || `Virement vers ${nomDe(cotes.vers)} (compte de départ supprimé)`;
          e.debit(jv.compte, label, montant); e.credit(acc.attente, label, montant);
          out.push(...e.done());
          return;
        }
        const j = journalDeCompte(data, acc, cotes ? cotes.depart : m.accountId, m.method);
        const vers = cotes ? cotes.vers : '';
        const contrepartie = vers ? journalDeCompte(data, acc, vers, m.method).compte
          : (m.kind !== 'virement' && String(m.compte || '').trim()) || acc[compteDuMouvement(data, m, bulletins)];
        const e = entrySet({ date: m.date, journal: j.journal, piece: m.reference || nature, tiers: '', tiersId: '', source: 'mouvement', docId: m.id, currency: cur });
        const label = m.label || (vers ? `Virement vers ${nomDe(vers)}` : nature);
        if (moveSign(m.kind) > 0) { e.debit(j.compte, label, montant); e.credit(contrepartie, label, montant); }
        else { e.debit(contrepartie, label, montant); e.credit(j.compte, label, montant); }
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
          // 9.0.0 : TFP et FOPROLOS, une charge (661) et une dette envers l'État (4335) — sur la
          // copie figée du bulletin : un bulletin d'avant n'en porte pas, et n'en gagne pas.
          e.debit(acc.taxesSalaires, `TFP et FOPROLOS — ${emp.name || ''}`, round3((c.tfp || 0) + (c.foprolos || 0)));
          e.credit(acc.tfpFoprolos, `TFP et FOPROLOS à payer — ${emp.name || ''}`, round3((c.tfp || 0) + (c.foprolos || 0)));
          e.credit(acc.cnss, `CNSS — ${emp.name || ''}`, round3(c.cnssEmployee + c.cnssEmployer + c.accident));
          e.credit(acc.irpp, `IRPP et contribution sociale — ${emp.name || ''}`, round3(c.irpp + c.css));
          // Les retenues diverses (remboursement d'avance) restent dues à l'entreprise : elles
          // diminuent le net versé. À VÉRIFIER : compte d'avance au personnel si le cabinet en tient un.
          e.credit(acc.personnel, label, round3(c.net + c.otherDeductions));
          out.push(...e.done());
        });
      // 8.9.0 : le bulletin RÉGLÉ. La dette envers le salarié s'éteint, l'argent sort — c'est le
      // mouvement que la Trésorerie montrait depuis la 5.0.0 sans qu'aucune écriture ne le porte.
      (data.payslips || [])
        .filter(s => s.paidDate && inPeriod(s.paidDate, period && period.from, period && period.to))
        .forEach(s => {
          const emp = (data.employees || []).find(x => x.id === s.employeeId) || {};
          const net = round3(((s.computed || {}).net) || 0);
          if (!net) return;
          const j = journalDeCompte(data, acc, s.accountId, s.method);
          const e = entrySet({ date: s.paidDate, journal: j.journal, piece: `PAIE-${s.year}-${String(s.month).padStart(2, '0')}`, tiers: emp.name || '', tiersId: '', source: 'salaire', docId: s.id, currency: cur });
          const label = `Paiement salaire ${emp.name || ''} ${MONTHS_FR[Number(s.month) - 1] || ''} ${s.year}`;
          e.debit(acc.personnel, label, net);
          e.credit(j.compte, label, net);
          out.push(...e.done());
        });
      // 10.14.0 : l'AVANCE versée. Elle débite le 425 : les retenues des bulletins suivants (portées
      // au crédit avec le net, plus haut) la soldent mois après mois, et le 425 revient à ce qui est
      // encore dû. Sans elle, le 425 gardait les retenues pour toujours et la banque ne voyait
      // jamais partir l'argent. À VÉRIFIER : un compte d'avances au personnel distinct si le
      // cabinet en tient un.
      (data.advances || [])
        .filter(a => inPeriod(a.date, period && period.from, period && period.to))
        .forEach(a => {
          const montant = round3(Number(a.amount) || 0);
          if (!montant) return;
          const emp = (data.employees || []).find(x => x.id === a.employeeId) || {};
          const j = journalDeCompte(data, acc, a.accountId, a.method);
          const e = entrySet({ date: a.date, journal: j.journal, piece: `AVANCE-${a.date || ''}`, tiers: emp.name || '', tiersId: '', source: 'avance', docId: a.id, currency: cur });
          const label = `Avance sur salaire ${emp.name || ''}`.trim();
          e.debit(acc.personnel, label, montant);
          e.credit(j.compte, label, montant);
          out.push(...e.done());
        });
    }

    // --- 8.9.0 : la déclaration mensuelle. À la fin de chaque mois écoulé, la TVA collectée se
    // solde contre la déductible (report compris), et le net à payer — timbres et retenues opérées
    // avec lui, c'est le même formulaire — va au 4365. Un crédit reste au débit du 4366 : c'est lui
    // que la déclaration suivante reprend, exactement comme `vatChain`.
    if (want('declarations')) {
      const t = opts.todayIso || today();
      const annees = new Set();
      const noter = d => { if (d && /^\d{4}/.test(d)) annees.add(d.slice(0, 4)); };
      (data.documents || []).forEach(d => noter(d.date)); (data.purchases || []).forEach(p => noter(p.date));
      // Seules les années que la période touche : calculer les autres ne servait qu'à jeter leurs
      // écritures — soixante-douze déclarations pour en garder une (10.14.0). Le report de l'année
      // d'avant, lui, vient de `reportTvaDebut`, qui ne rend qu'un chiffre.
      const y0 = period && period.from ? period.from.slice(0, 4) : '', y1 = period && period.to ? period.to.slice(0, 4) : '';
      [...annees].sort().filter(y => (!y0 || y >= y0) && (!y1 || y <= y1)).forEach(y => {
        vatChain(data, company, y).forEach(m => {
          const dernier = `${m.month}-${pad2(daysInMonth(Number(y), Number(m.month.slice(5, 7))))}`;
          if (dernier >= t || !inPeriod(dernier, period && period.from, period && period.to)) return;
          // Un mois dont la seule pièce est un avoir fournisseur n'a rien collecté, et pourtant il
          // DOIT (10.14.1) : l'avoir reprend de la TVA déjà déduite (déductible négative), la chaîne
          // annonce une TVA à reverser, et sans cette écriture le 4366 restait créditeur pour
          // toujours pendant que le 4365 ignorait ce qu'on devait.
          if (!m.collected && !m.stamps && !m.withheldOnBuys && !m.toPay) return;
          const e = entrySet({ date: dernier, journal: 'OD', piece: `TVA-${m.month}`, tiers: '', tiersId: '', source: 'declaration', docId: 'tva-' + m.month, currency: cur });
          const label = `Déclaration mensuelle ${m.label} ${y}`;
          e.debit(acc.tvaCollectee, `TVA collectée — ${label}`, m.collected);
          e.debit(acc.timbre, `Timbres fiscaux — ${label}`, m.stamps);
          e.debit(acc.rsOperee, `Retenues à la source opérées — ${label}`, m.withheldOnBuys);
          e.credit(acc.tvaDeductible, `TVA déductible imputée — ${label}`, round3(m.collected - m.toPay));
          e.credit(acc.tvaAPayer, `Net à payer — ${label}`, round3(m.toPay + m.stamps + m.withheldOnBuys));
          out.push(...e.done());
        });
      });
    }

    // --- 8.9.0 : les opérations diverses saisies à la main. Le comptable les demandait en
    // premier ; elles sont enregistrées telles quelles, après avoir été refusées si elles ne
    // tombaient pas juste (`odValide`).
    if (want('od')) {
      (data.ecrituresOD || [])
        .filter(od => inPeriod(od.date, period && period.from, period && period.to))
        .forEach(od => {
          const e = entrySet({ date: od.date, journal: od.journal || 'OD', piece: od.piece || '', tiers: '', tiersId: '', source: 'od', docId: od.id, currency: cur });
          (od.lignes || []).forEach(l => {
            if (Number(l.debit) > 0) e.debit(l.compte, l.label || od.label || '', Number(l.debit), { tiers: l.tiers || '' });
            if (Number(l.credit) > 0) e.credit(l.compte, l.label || od.label || '', Number(l.credit), { tiers: l.tiers || '' });
          });
          out.push(...e.done());
        });
    }

    // --- 9.0.0 : les immobilisations. La dotation de chaque exercice s'écrit au 31 décembre (ou au
    // jour de la sortie), jamais avant : c'est une écriture d'inventaire. Un bien saisi à la main
    // (acheté avant SkanFact) entre à sa valeur brute contre le report à nouveau, sinon le 28
    // s'amortirait sur un 22 qui n'existe pas. Une cession sort le bien : l'amortissement cumulé
    // et la valeur nette comptable s'annulent contre la valeur brute ; le PRIX, lui, arrive par la
    // facture ou par un mouvement « autre entrée » avec la contrepartie 775.
    if (want('amortissements')) {
      const t = opts.todayIso || today();
      (data.assets || []).forEach(a => {
        const brut = round3(Number(a.amount) || 0);
        if (!brut || !a.date) return;
        if (!a.purchaseId && inPeriod(a.date, period && period.from, period && period.to)) {
          const e = entrySet({ date: a.date, journal: 'OD', piece: 'IMMO', tiers: '', tiersId: '', source: 'immobilisation', docId: a.id, currency: cur });
          e.debit(acc.immobilisations, `Entrée — ${a.label || 'immobilisation'} (saisie à la main)`, brut);
          e.credit(acc.reportANouveau, `Entrée — ${a.label || 'immobilisation'} (saisie à la main)`, brut);
          out.push(...e.done());
        }
        const dis = a.disposal && a.disposal.date ? a.disposal.date : '';
        assetSchedule(a).forEach(r => {
          if (dis && Number(dis.slice(0, 4)) < r.year) return;
          const d = dis && Number(dis.slice(0, 4)) === r.year ? dis : `${r.year}-12-31`;
          const annuity = dis && Number(dis.slice(0, 4)) === r.year ? assetYear(a, r.year).annuity : r.annuity;
          if (!annuity || d >= t || !inPeriod(d, period && period.from, period && period.to)) return;
          const e = entrySet({ date: d, journal: 'OD', piece: `AMORT-${r.year}`, tiers: '', tiersId: '', source: 'amortissement', docId: a.id, currency: cur });
          e.debit(acc.dotations, `Dotation ${r.year} — ${a.label || ''}`, annuity);
          e.credit(acc.amortissements, `Amortissement ${r.year} — ${a.label || ''}`, annuity);
          out.push(...e.done());
        });
        if (dis && dis < t && inPeriod(dis, period && period.from, period && period.to)) {
          const cumul = assetCumulated(a, dis);
          const e = entrySet({ date: dis, journal: 'OD', piece: 'CESSION', tiers: '', tiersId: '', source: 'cession', docId: a.id, currency: cur });
          e.debit(acc.amortissements, `Sortie — ${a.label || ''} : amortissements repris`, cumul);
          e.debit(acc.vncCedee, `Sortie — ${a.label || ''} : valeur nette comptable`, round3(brut - cumul));
          e.credit(acc.immobilisations, `Sortie — ${a.label || ''} : valeur brute`, brut);
          out.push(...e.done());
        }
      });
    }

    // --- 10.14.0 : l'inventaire du 31 décembre. Une écriture d'inventaire, comme la dotation :
    // au 31 décembre d'un exercice TERMINÉ, jamais avant (voir `inventaireComptable`).
    if (want('inventaire')) {
      inventaireComptable(data, opts.todayIso).variations.forEach(v => {
        if (!inPeriod(v.date, period && period.from, period && period.to)) return;
        const e = entrySet({ date: v.date, journal: 'OD', piece: `INVENTAIRE-${v.annee}`, tiers: '', tiersId: '', source: 'inventaire', docId: 'inv-' + v.annee, currency: cur });
        const lib = `Stock au 31/12/${v.annee} : ${money(v.valeur)}`;
        if (v.montant > 0) { e.debit(acc.stocks, lib, v.montant); e.credit(acc.variationStocks, `Variation des stocks ${v.annee}`, v.montant); }
        else { e.debit(acc.variationStocks, `Variation des stocks ${v.annee}`, -v.montant); e.credit(acc.stocks, lib, -v.montant); }
        out.push(...e.done());
      });
    }

    // --- 9.0.0 : les à-nouveaux. Au 1er janvier de chaque exercice, une pièce AN rouvre chaque
    // compte de bilan avec son solde de la veille, et porte au compte de résultat le net des
    // charges et produits de TOUT ce qui précède — c'est ainsi que les classes 6 et 7 repartent de
    // zéro. Elle se calcule sur les écritures réelles seules (jamais sur les AN précédentes) : le
    // solde d'un compte de bilan persiste, celui des comptes de gestion se cumule au résultat.
    if (want('anouveaux')) {
      const dates = [];
      const noter = d => { if (d && /^\d{4}-\d{2}-\d{2}/.test(d)) dates.push(d.slice(0, 10)); };
      (data.documents || []).forEach(d => noter(d.date)); (data.purchases || []).forEach(p => noter(p.date));
      (data.movements || []).forEach(m => noter(m.date)); (data.accounts || []).forEach(a => noter(a.openingDate));
      (data.assets || []).forEach(a => noter(a.date)); (data.payslips || []).forEach(s => noter(payslipDate(s)));
      (data.ecrituresOD || []).forEach(o => noter(o.date));
      if (dates.length) {
        const premiere = Number(dates.sort()[0].slice(0, 4));
        const derniere = Number(String((period && period.to) || (opts.todayIso || today())).slice(0, 4));
        const sansAN = SECTIONS_ECRITURES.filter(s => s !== 'anouveaux');
        for (let y = premiere + 1; y <= derniere; y++) {
          const d = `${y}-01-01`;
          if (!inPeriod(d, period && period.from, period && period.to)) continue;
          const reelles = journalEntries(data, company, { from: '', to: `${y - 1}-12-31` }, { ...opts, sections: sansAN });
          const soldes = {};
          // 10.14.0 — les comptes de TIERS rouvrent pièce par pièce (« à-nouveaux détaillés »). Un
          // seul solde global du 411 perdait le fil : une facture de décembre réglée en janvier
          // arrivait dans l'exercice suivant par son seul règlement, lettré à une facture que
          // l'exercice ne voyait plus. Le lettrage le comptait réglé pendant que le compte le
          // comptait dû — « le reste ouvert n'est pas le solde du compte », et un « lettrage faux »
          // accusé sur une saisie juste. C'est l'exemple sur cinq ans qui l'a montré : sur treize
          // mois, aucune facture ne traversait un 31 décembre. Chaque ligne rouvre avec son tiers,
          // son rôle et sa LETTRE ; le total par compte ne change pas d'un millime.
          const tiersSoldes = {};
          let net = 0;
          reelles.forEach(e => {
            const v = round3(e.debit - e.credit);
            if (compteDeGestion(e.account)) net = round3(net + v);
            else if (e.role === 'clients' || e.role === 'fournisseurs') {
              // Une pièce lettrée rouvre seule, avec sa lettre ; le non-lettré se résume par tiers
              // (la même règle que le Cabinet, `Compta.anouveauxDe`).
              const k = `${e.account}|${e.role}|${e.tiersId || e.tiers || ''}|${e.lettre ? 'L:' + e.lettre : 'N'}`;
              const t = tiersSoldes[k] = tiersSoldes[k] || { account: e.account, role: e.role, tiersId: e.tiersId || '', tiers: e.tiers || '', lettre: e.lettre || '', piece: e.lettre ? (e.piece || '') : '', v: 0 };
              t.v = round3(t.v + v);
            } else soldes[e.account] = round3((soldes[e.account] || 0) + v);
          });
          const e = entrySet({ date: d, journal: 'AN', piece: `AN-${y}`, tiers: '', tiersId: '', source: 'anouveau', docId: 'an-' + y, currency: cur });
          Object.keys(soldes).sort().forEach(k => {
            if (!soldes[k]) return;
            const label = `À-nouveau ${y} — ${accountLabel(data, k)}`;
            if (soldes[k] > 0) e.debit(k, label, soldes[k]); else e.credit(k, label, -soldes[k]);
          });
          Object.keys(tiersSoldes).sort().forEach(k => {
            const t = tiersSoldes[k];
            if (!t.v) return;
            const label = `À-nouveau ${y} — ${t.tiers || accountLabel(data, t.account)} — ${t.lettre ? (t.piece || t.lettre) : 'non lettré'}`;
            const extra = { role: t.role, tiersId: t.tiersId, tiers: t.tiers, lettre: t.lettre };
            if (t.v > 0) e.debit(t.account, label, t.v, extra); else e.credit(t.account, label, -t.v, extra);
          });
          // Un net positif = les charges dépassent les produits : une perte, au débit du résultat.
          if (net > 0) e.debit(acc.resultat, `Résultat des exercices antérieurs (perte)`, net);
          else if (net < 0) e.credit(acc.resultat, `Résultat des exercices antérieurs (bénéfice)`, -net);
          out.push(...e.done());
        }
      }
    }

    return out.sort((a, b) => (a.date || '').localeCompare(b.date || '')
      || (a.journal || '').localeCompare(b.journal || '')
      || TRI_NUMERIQUE.compare((a.piece || ''), b.piece || ''));
  }
  const SECTIONS_ECRITURES = ['ventes', 'achats', 'encaissements', 'reglements', 'ouverture', 'tresorerie', 'paie', 'declarations', 'od', 'amortissements', 'inventaire', 'anouveaux'];

  // Le contrôle qu'un comptable fait en premier : est-ce que ça tombe juste ? Pièce par pièce, et
  // en tout. Une pièce déséquilibrée serait refusée à l'import de son logiciel.
  // L'équilibre d'un jeu d'écritures, et la balance par compte. Les deux vivent dans `compta.js`
  // depuis la 9.1.0 : elles ne prennent que des LIGNES, donc elles servent aussi au cabinet, qui
  // n'a pas de `data`. Réexportées ici à l'identique — aucun appelant n'a changé.
  const entriesBalance = Compta.entriesBalance;
  // 9.8.0 — le dossier de clôture reçu du cabinet se valide avec la MÊME fonction que celle qui l'a
  // écrit : deux lectures du même format finiraient par ne plus accepter la même chose.
  const clotureValide = Compta.clotureValide;
  const entriesByAccount = Compta.entriesByAccount;

  const entryCsvColumns = () => ([
    { key: 'numero', label: 'N°' },
    { key: 'date', label: 'Date', type: 'date' }, { key: 'journal', label: 'Journal' },
    { key: 'piece', label: 'Pièce' }, { key: 'account', label: 'Compte' }, { key: 'tiers', label: 'Tiers' },
    { key: 'label', label: 'Libellé' },
    { key: 'debit', label: 'Débit', type: 'money' }, { key: 'credit', label: 'Crédit', type: 'money' },
    { key: 'lettre', label: 'Lettrage' }, { key: 'currency', label: 'Devise' }
  ]);

  // ---------- le livre-journal (8.9.0) ----------
  //
  // « Écriture comptable dans le journal », le second terme du comptable : chaque pièce porte un
  // numéro CONTINU dans l'exercice, et rien ne peut manquer entre deux numéros. Les écritures étant
  // déduites des pièces, le numéro l'est aussi : une pièce datée en arrière dans un mois OUVERT
  // décale les suivantes — c'est exactement pour ça qu'on clôture (6.0.0) : sur un mois clos, plus
  // rien ne bouge, donc plus aucun numéro. La règle est écrite à l'écran.
  function numerosDuJournal(data, company, year, opts) {
    const y = String(year).slice(0, 4);
    const tout = journalEntries(data, company, { from: `${y}-01-01`, to: `${y}-12-31` }, opts);
    const nums = {};
    let n = 0;
    tout.forEach(e => { const k = `${e.journal}|${e.piece}|${e.date}`; if (!nums[k]) nums[k] = ++n; });
    return { nums, dernier: n };
  }
  const cleDePiece = e => `${e.journal}|${e.piece}|${e.date}`;
  // Les écritures de la période, numérotées dans l'exercice de son premier jour.
  function livreJournal(data, company, period, opts) {
    const y = String((period && period.from) || today()).slice(0, 4);
    const { nums } = numerosDuJournal(data, company, y, opts);
    return journalEntries(data, company, period, opts).map(e => ({ ...e, numero: nums[cleDePiece(e)] || 0, exercice: y }));
  }

  // Le journal centralisateur : mois par mois, journal par journal, le total débit et crédit.
  // C'est le récapitulatif que le livre-journal coté et paraphé reprend.
  function journalCentralisateur(data, company, year, opts) {
    const y = String(year).slice(0, 4);
    const tout = journalEntries(data, company, { from: `${y}-01-01`, to: `${y}-12-31` }, opts);
    const codes = ENTRY_JOURNALS.map(j => j[0]).filter(c => tout.some(e => e.journal === c));
    tout.forEach(e => { if (e.journal && !codes.includes(e.journal)) codes.push(e.journal); });
    const mois = [];
    for (let m = 1; m <= 12; m++) {
      const mm = `${y}-${pad2(m)}`;
      const du = tout.filter(e => (e.date || '').slice(0, 7) === mm);
      const par = {};
      const pieces = new Set();
      codes.forEach(c => { par[c] = { debit: 0, credit: 0, pieces: 0 }; });
      const vues = {};
      du.forEach(e => {
        const p = par[e.journal]; p.debit = round3(p.debit + e.debit); p.credit = round3(p.credit + e.credit);
        const k = cleDePiece(e); if (!vues[k]) { vues[k] = true; p.pieces++; pieces.add(k); }
      });
      mois.push({ month: mm, label: MONTHS_FR[m - 1], par, debit: round3(du.reduce((s, e) => s + e.debit, 0)), credit: round3(du.reduce((s, e) => s + e.credit, 0)), pieces: pieces.size });
    }
    const totaux = {};
    codes.forEach(c => { totaux[c] = { debit: round3(mois.reduce((s, m) => s + m.par[c].debit, 0)), credit: round3(mois.reduce((s, m) => s + m.par[c].credit, 0)), pieces: mois.reduce((s, m) => s + m.par[c].pieces, 0) }; });
    return {
      year: y, journaux: codes.map(c => ({ code: c, label: journalLabel(c) })), mois, totaux,
      debit: round3(mois.reduce((s, m) => s + m.debit, 0)), credit: round3(mois.reduce((s, m) => s + m.credit, 0)),
      pieces: mois.reduce((s, m) => s + m.pieces, 0)
    };
  }

  // ---- les opérations diverses saisies à la main ----
  // Une OD est la seule écriture que l'utilisateur ÉCRIT. Elle n'entre qu'équilibrée : c'est la
  // règle de la partie double, et un logiciel qui accepterait un déséquilibre livrerait une
  // comptabilité fausse au comptable.
  // Le refus dit ses montants comme l'écran (10.14.1, M-05) : « Débit 1250.500 » se lit mille
  // deux cent cinquante mille. La devise est celle de la société (`company`), le dinar sans elle.
  function odValide(od, company) {
    const erreurs = [];
    const lignes = (od && Array.isArray(od.lignes) ? od.lignes : []).filter(l => l && (String(l.compte || '').trim() || Number(l.debit) || Number(l.credit)));
    if (!od || !/^\d{4}-\d{2}-\d{2}$/.test(String(od.date || ''))) erreurs.push('La date manque.');
    if (!String((od && od.label) || '').trim()) erreurs.push('Le libellé manque : c\'est lui qui dira au comptable de quoi il s\'agit.');
    if (lignes.length < 2) erreurs.push('Une écriture a au moins deux lignes : un compte au débit, un compte au crédit.');
    lignes.forEach((l, i) => {
      const compte = String(l.compte || '').trim();
      if (!/^\d{1,12}$/.test(compte)) erreurs.push(`Ligne ${i + 1} : le compte doit être un numéro.`);
      const d = Number(l.debit) || 0, c = Number(l.credit) || 0;
      if (d < 0 || c < 0) erreurs.push(`Ligne ${i + 1} : un montant négatif change de colonne, il ne garde pas son signe.`);
      if (d && c) erreurs.push(`Ligne ${i + 1} : une ligne va au débit OU au crédit, pas les deux.`);
      if (!d && !c) erreurs.push(`Ligne ${i + 1} : aucun montant.`);
    });
    const debit = round3(lignes.reduce((s, l) => s + (Number(l.debit) || 0), 0));
    const credit = round3(lignes.reduce((s, l) => s + (Number(l.credit) || 0), 0));
    if (lignes.length >= 2 && round3(debit - credit) !== 0) erreurs.push(`Débit ${money(debit, (company && company.currency) || 'DT')} ≠ crédit ${money(credit, (company && company.currency) || 'DT')} : l'écriture ne tombe pas juste.`);
    return { ok: !erreurs.length, erreurs, debit, credit, lignes };
  }
  // Le numéro de pièce d'une OD : OD-AAAA-NNN, continu dans l'année, jamais réutilisé.
  function odPiece(data, dateIso) {
    const y = String(dateIso || today()).slice(0, 4);
    const key = `od-${y}`;
    const existants = (data.ecrituresOD || []).map(o => String(o.piece || '')).filter(p => p.startsWith(`OD-${y}-`)).map(p => parseInt(p.split('-')[2], 10) || 0);
    const seq = Math.max(existants.length ? Math.max(...existants) : 0, Number((data.counters || {})[key]) || 0) + 1;
    if (!data.counters) data.counters = {};
    data.counters[key] = seq;
    return `OD-${y}-${String(seq).padStart(3, '0')}`;
  }
  // Les comptes qu'on propose à la saisie d'une OD : ceux déjà mouvementés, puis le plan.
  // 10.14.1 (PERF-01) — dans un LOT, et sans les à-nouveaux. La liste demandait toutes les écritures
  // de toute l'histoire HORS lot : chaque facture relisait tous les avoirs pour son lettrage, et les
  // à-nouveaux recalculaient, pour chaque exercice, tout ce qui le précède. Mesuré sur dix factures
  // par mois : six secondes pour sept ans, quinze et demie pour dix — au-delà des douze secondes du
  // chien de garde, qui rechargeait la page sur « + Opération diverse ». Un à-nouveau ne rouvre que
  // des comptes que les écritures réelles ont déjà mouvementés, sauf le RÉSULTAT, où il porte le net
  // des exercices passés : il se compte à part, par la règle de la section des à-nouveaux.
  function comptesProposes(data, company) { return enLot(() => comptesProposesCalcul(data, company)); }
  function comptesProposesCalcul(data, company) {
    const vus = {};
    const reelles = journalEntries(data, company, { from: '', to: '' }, { sections: SECTIONS_ECRITURES.filter(s => s !== 'anouveaux') });
    reelles.forEach(e => { if (e.account && !vus[e.account]) vus[e.account] = accountLabel(data, e.account, e.role ? e.tiers : ''); });
    const resultat = chartAccounts(data).resultat;
    if (resultat && !vus[resultat] && resultatRouvert(reelles)) vus[resultat] = accountLabel(data, resultat, '');
    const out = Object.keys(vus).sort().map(n => ({ compte: n, label: vus[n], utilise: true }));
    PLAN_COMPTABLE.forEach(([n, l]) => { if (n.length >= 2 && !vus[n]) out.push({ compte: n, label: l, utilise: false }); });
    return out;
  }
  // Le compte de résultat est-il rouvert par un à-nouveau ? La section des à-nouveaux en pose un au
  // 1er janvier de chaque exercice jusqu'à l'année en cours, et y porte le net de gestion de TOUT ce
  // qui précède quand il n'est pas nul. Les écritures arrivent triées par date : il suffit de lire ce
  // net à chaque fin d'exercice passé.
  function resultatRouvert(reelles) {
    const cette = Number(today().slice(0, 4));
    let net = 0, an = null;
    for (const e of reelles) {
      const y = Number(String(e.date || '').slice(0, 4));
      if (!(y > 1900)) continue;
      if (an !== null && y !== an && an < cette && net) return true;
      an = y;
      if (compteDeGestion(e.account)) net = round3(net + round3(e.debit - e.credit));
    }
    return an !== null && an < cette && !!net;
  }

  // ---- le lettrage ----
  // Rapprocher chaque règlement de sa facture, tiers par tiers. Les paiements sont déjà rattachés
  // aux pièces : le lettrage n'est pas une saisie, c'est une LECTURE — ce qui est soldé porte sa
  // lettre, ce qui reste ouvert est listé avec son reste.
  function lettrage(data, company, role, todayIso) {
    const t = todayIso || today();
    const clients = role !== 'fournisseurs';
    const liste = clients ? (data.clients || []) : (data.suppliers || []);
    const nom = id => (liste.find(x => x.id === id) || {}).name || '';
    const acc = chartAccounts(data);
    const codes = auxiliairesActifs(data) ? codesAuxiliaires(liste) : {};
    const base = clients ? acc.clients : acc.fournisseurs;
    const by = {};
    const tiersDe = id => (by[id] = by[id] || { tiersId: id, tiers: nom(id) || '(sans tiers)', account: id && codes[id] ? base + codes[id] : base, lettrees: 0, ouverts: [], reste: 0 });
    if (clients) {
      (data.documents || []).filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée' && d.number).forEach(d => {
        const b = invoiceBalance(d, data, company);
        const r = tiersDe(d.clientId || '');
        // Un trop-perçu est ouvert, au crédit du client (10.14.0) : c'est le jumeau de l'avoir
        // fournisseur de la 10.2.0. Ne regarder que les restes positifs faisait dire au lettrage un
        // chiffre différent du 411, sur la même donnée.
        // Une ligne s'ADDITIONNE (10.14.0) : Montant − Avoirs − Réglé = Reste. Un trop-perçu s'affichait
        // « 3 685 − 3 685 = −1 005 » — l'avoir, invisible, faisait la différence. Chaque montant
        // est celui que le 411 porte : la facture et ses règlements à son taux, un avoir au taux de
        // la facture (l'écart de change est écrit à part), ou à son propre taux s'il est dans une
        // autre devise.
        // En BRUT (10.14.0), comme le 401 : le 411 porte ce que la pièce vaut, retenue comprise,
        // jusqu'à l'encaissement ; chaque encaissement le solde de ce que le client verse plus la
        // retenue qu'il garde pour l'État, et un avoir posé après règle aussi sa régularisation.
        const rs = retenueSubie(d, data, company);
        const brut = round3(b.totals.netToPay + b.totals.withholding);
        const montant = round3(toBase(d, brut, company));
        // Chaque morceau arrondi comme l'écriture l'arrondit : un millime d'écart sur une facture en
        // devise, et le lettrage ne retombe plus sur le 411.
        const avoirs = round3(b.credits.reduce((x, a) => { const ta = computeTotals(a, company);
          return x + toBase(d, montantDansDeviseDe(a, round3(ta.netToPay + ta.withholding), d, company), company) + toBase(d, rs.ajustements[a.id] || 0, company); }, 0));
        const regle = round3((d.payments || []).reduce((x, p, i) => x + toBase(d, Number(p.amount) || 0, company) + toBase(d, rs.parts[cleReglement(p, i)] || 0, company), 0));
        const reste = round3(montant - avoirs - regle);
        if (Math.abs(reste) <= 0.0005) { r.lettrees++; return; }
        r.ouverts.push({ id: d.id, piece: d.number, date: d.date, echeance: d.dueDate || '', montant, avoirs, regle, reste, retard: reste > 0 && !!(d.dueDate && d.dueDate < t) });
        r.reste = round3(r.reste + reste);
      });
      // Un avoir LIBRE — rattaché à aucune facture — est une somme due au client : le 411 la porte au
      // crédit, le relevé aussi. Un avoir rattaché est déjà dans le reste de sa facture.
      // En brut, comme le 411 : la retenue qu'il porte ne naîtra qu'au règlement qui l'emploiera.
      (data.documents || []).filter(d => d.type === 'avoir' && !d.creditOf && d.status !== 'brouillon' && d.status !== 'annulée' && d.number).forEach(d => {
        const net = round3(toBase(d, computeTotals(d, company).totalTTC, company));
        if (net <= 0.0005) return;
        const r = tiersDe(d.clientId || '');
        r.ouverts.push({ id: d.id, piece: d.number, date: d.date, echeance: '', montant: -net, avoirs: 0, regle: 0, reste: -net, retard: false });
        r.reste = round3(r.reste - net);
      });
    } else {
      (data.purchases || []).forEach(p => {
        const b = purchaseBalance(p, company, data);
        const r = tiersDe(p.supplierId || '');
        // Un avoir non imputé laisse le fournisseur DÉBITEUR : son reste est négatif, et il est
        // tout aussi ouvert qu'une facture impayée (10.2.0). Ne regarder que les restes positifs
        // faisait dire au lettrage un chiffre différent du solde du 401, sur la même donnée.
        if (Math.abs(b.remaining) <= 0.0005) { if ((p.payments || []).length) r.lettrees++; return; }
        // En dinars, comme la branche des clients : le lettrage se confronte au solde du 401, qui est
        // en monnaie de la société depuis la 10.1.0. Une facture de 1 190 € restait 1 190 ici.
        // Montant − Avoirs et acomptes − Réglé = Reste, comme côté clients (10.14.0). Un avoir non
        // imputé porte un montant NÉGATIF — c'est un crédit — et ce que le fournisseur en a
        // remboursé est un « réglé » négatif : l'argent est rentré.
        // En BRUT (10.14.0) : la retenue à la source naît au règlement, donc le 401 porte ce que la
        // pièce doit — retenue comprise — jusqu'au paiement, et chaque règlement le solde de ce
        // qu'il verse plus la retenue qu'il garde pour l'État.
        const sens = p.kind === 'avoir' ? -1 : 1;
        const rs = retenueDesReglements(p, company, data);
        const brut = round3(b.totals.netToPay + b.totals.withholding);
        const montant = round3(sens * toBase(p, brut, company));
        // Chaque pièce rattachée et sa régularisation de retenue, chaque règlement et sa part : arrondis
        // un par un, comme l'écriture les arrondit.
        const avoirs = (p.kind === 'avoir' || p.kind === 'acompte') ? 0 : round3(piecesLieesAchat(data, p.id).reduce((x, a) =>
          x + toBase(p, montantDansDeviseDe(a, imputationAchat(a, company).brut, p, company), company) + toBase(p, rs.ajustements[a.id] || 0, company), 0));
        const regle = round3(sens * (p.payments || []).reduce((x, y, i) => x + toBase(p, Number(y.amount) || 0, company) + toBase(p, rs.parts[cleReglement(y, i)] || 0, company), 0));
        const reste = round3(montant - avoirs - regle);
        r.ouverts.push({ id: p.id, piece: referenceAchat(p, data), date: p.date, echeance: p.dueDate || '', montant, avoirs, regle, reste, retard: reste > 0 && !!(p.dueDate && p.dueDate < t) });
        r.reste = round3(r.reste + reste);
      });
    }
    const rows = Object.keys(by).map(k => by[k]).filter(r => r.lettrees || r.ouverts.length)
      .map(r => ({ ...r, ouverts: r.ouverts.sort((a, b) => (a.date || '').localeCompare(b.date || '')) }))
      .sort((a, b) => b.reste - a.reste || a.tiers.localeCompare(b.tiers));
    return { role: clients ? 'clients' : 'fournisseurs', rows, reste: round3(rows.reduce((s, r) => s + r.reste, 0)), ouverts: rows.reduce((s, r) => s + r.ouverts.length, 0), lettrees: rows.reduce((s, r) => s + r.lettrees, 0) };
  }
  // ---------- l'exercice (9.0.0) ----------

  // L'état de rapprochement bancaire, tel qu'on le présente : on part du solde du RELEVÉ, on ajoute
  // ce que SkanFact a encaissé et que la banque n'a pas encore crédité, on retire ce que SkanFact a
  // payé et que la banque n'a pas encore débité — et l'on doit retomber sur le solde comptable.
  // L'écart, s'il en reste un, est une pièce qui manque d'un côté.
  function etatRapprochement(data, company, accountId, toIso) {
    const r = reconciliation(data, company, accountId, toIso);
    if (!r) return null;
    const pending = r.moves.filter(m => !m.reconciled);
    const entrees = pending.filter(m => m.amount > 0);
    const sorties = pending.filter(m => m.amount < 0);
    const totalEntrees = round3(entrees.reduce((s, m) => s + m.amount, 0));
    const totalSorties = round3(-sorties.reduce((s, m) => s + m.amount, 0));
    const theorique = r.statement == null ? null : round3(r.statement + totalEntrees - totalSorties);
    return {
      ...r, entrees, sorties, totalEntrees, totalSorties, theorique,
      ecart: theorique == null ? null : round3(r.balance - theorique),
      date: toIso || today()
    };
  }

  // Les états financiers simplifiés : bilan et état de résultat, déduits de la balance de
  // l'exercice. Une présentation d'ensemble (actifs non courants nets, stocks, créances,
  // trésorerie ; capitaux, dettes), PAS la liasse NCT 01 — c'est le cabinet qui l'établit. Ce qui est
  // garanti : actif = passif, et le résultat du bilan est celui de l'état de résultat.
  function etatsFinanciers(data, company, year, toIso, opts) {
    const y = String(year).slice(0, 4);
    const to = toIso && toIso.slice(0, 4) === y ? toIso : `${y}-12-31`;
    const b = balanceGenerale(data, company, { from: `${y}-01-01`, to }, opts);
    const rows = b.rows.filter(r => r.solde);
    const acc = chartAccounts(data);
    const ligne = r => ({ account: r.account, label: r.label, montant: r.solde });
    // Le rangement vit dans compta.js, partagé avec le Cabinet (10.14.0) : deux copies avaient la
    // même faute (un emprunt compté dans les capitaux propres), et une copie corrigée seule aurait
    // fait dire deux bilans au client et à son comptable.
    const { actif, passif, produits, charges } = Compta.groupesDesEtats(rows,
      (r, montant) => ({ account: r.account, label: r.label, montant }), r => r.account === acc.amortissements);
    const resultat = round3(produits.total - charges.total);
    const totalActif = round3(actif.reduce((s, g) => s + g.total, 0));
    const totalPassif = round3(passif.reduce((s, g) => s + g.total, 0) + resultat);
    return {
      year: y, to, actif, passif, produits, charges, resultat, totalActif, totalPassif,
      equilibre: round3(totalActif - totalPassif) === 0,
      // Ce que la dotation de l'exercice en cours attend : elle ne s'écrit qu'au 31 décembre — sauf
      // celle d'un bien cédé, déjà passée au jour de la sortie, qu'on ne compte donc pas deux fois.
      dotationEnAttente: to < `${y}-12-31` ? round3(Math.max(0, depreciationFor(data, { from: `${y}-01-01`, to }) - charges.lignes.filter(l => l.account === acc.dotations).reduce((s, l) => s + l.montant, 0))) : 0,
      // Le stock suit le même calendrier (10.14.0) : le 37 porte le dernier inventaire, la page
      // Stock ce qui est sur l'étagère AUJOURD'HUI. En cours d'année, l'écart est la variation que
      // l'inventaire du 31 décembre écrira — et que le résultat simplifié compte déjà.
      variationStockEnAttente: to < `${y}-12-31` ? round3(stockTotals(data, to).value - (actif[2] ? actif[2].total : 0)) : 0,
      lignes: rows.map(ligne)
    };
  }
  const etatsCsvRows = e => [].concat(
    ...e.actif.map(g => g.lignes.map(l => ({ etat: 'Bilan — actif', groupe: g.titre, account: l.account, label: l.label, montant: l.montant }))),
    ...e.passif.map(g => g.lignes.map(l => ({ etat: 'Bilan — passif', groupe: g.titre, account: l.account, label: l.label, montant: l.montant }))),
    [{ etat: 'Bilan — passif', groupe: 'Résultat de l\'exercice', account: '', label: 'Résultat de l\'exercice', montant: e.resultat }],
    e.produits.lignes.map(l => ({ etat: 'État de résultat', groupe: 'Produits', account: l.account, label: l.label, montant: l.montant })),
    e.charges.lignes.map(l => ({ etat: 'État de résultat', groupe: 'Charges', account: l.account, label: l.label, montant: l.montant }))
  );
  const etatsCsvColumns = () => ([{ key: 'etat', label: 'État' }, { key: 'groupe', label: 'Rubrique' }, { key: 'account', label: 'Compte' }, { key: 'label', label: 'Intitulé' }, { key: 'montant', label: 'Montant', type: 'money' }]);

  const centralisateurCsvColumns = journaux => ([{ key: 'label', label: 'Mois' }]
    .concat(journaux.flatMap(j => [{ key: `${j.code}_d`, label: `${j.code} débit`, type: 'money' }, { key: `${j.code}_c`, label: `${j.code} crédit`, type: 'money' }]))
    .concat([{ key: 'debit', label: 'Total débit', type: 'money' }, { key: 'credit', label: 'Total crédit', type: 'money' }, { key: 'pieces', label: 'Pièces' }]));
  const centralisateurRows = c => c.mois.map(m => { const o = { label: m.label, debit: m.debit, credit: m.credit, pieces: m.pieces }; c.journaux.forEach(j => { o[`${j.code}_d`] = m.par[j.code].debit; o[`${j.code}_c`] = m.par[j.code].credit; }); return o; });

  // ---------- le grand livre et la balance (8.8.0) ----------
  //
  // Les deux documents qu'un cabinet tire en premier pour contrôler un dossier — et les deux termes
  // que le comptable de Skander a nommés : « mouvement de compte » (le grand livre : chaque compte,
  // ses lignes une à une, le solde qui avance) et la balance (tous les comptes, ouverture,
  // mouvements, soldes, et des totaux qui doivent tomber juste).
  //
  // Le SOLDE D'OUVERTURE d'une période est ce que le compte portait la veille du premier jour :
  // - les classes 1 à 5 (bilan) traversent les exercices : tout ce qui précède compte ;
  // - les classes 6 et 7 (gestion) repartent de zéro au 1er janvier : ce qui précède l'exercice ne
  //   compte pas dans le compte lui-même, mais son solde net (produits − charges des exercices
  //   passés) est porté au compte de résultat — sinon la balance d'ouverture ne tomberait pas juste.
  // C'est exactement ce que fait une écriture d'à-nouveau ; elle est ici DÉDUITE, pas saisie.
  function debutExercice(iso) { return `${String(iso || today()).slice(0, 4)}-01-01`; }

  // Les soldes de tous les comptes la veille de `period.from` : { compte → solde signé (D > 0) }.
  // Depuis la 9.0.0 la pièce d'à-nouveau du 1er janvier porte elle-même le passé (comptes de bilan
  // rouverts, résultat des exercices antérieurs) : l'ouverture d'une période se lit donc depuis le
  // début de son exercice, à-nouveau compris — jamais plus loin, sinon le passé compterait deux fois.
  function soldesOuverture(data, company, period, opts) {
    const from = period && period.from;
    if (!from) return {};
    const exo = debutExercice(from);
    if (from <= exo) return {};
    const avant = journalEntries(data, company, { from: exo, to: addDays(from, -1) }, opts);
    const out = {};
    avant.forEach(e => { out[e.account] = round3((out[e.account] || 0) + e.debit - e.credit); });
    Object.keys(out).forEach(k => { if (!out[k]) delete out[k]; });
    return out;
  }

  // La balance générale : une ligne par compte — solde d'ouverture, mouvements de la période,
  // solde de clôture — chacun rangé dans SA colonne (débiteur ou créditeur, jamais un signe).
  // `equilibree` est vrai quand les trois paires de totaux tombent juste : c'est le contrôle que le
  // comptable fait en premier, et la seule affirmation que cette page garantit.
  function balanceGenerale(data, company, period, opts) {
    const entries = journalEntries(data, company, period, opts);
    const ouv = soldesOuverture(data, company, period, opts);
    const by = {};
    const row = k => (by[k] = by[k] || { account: k, ouverture: 0, debit: 0, credit: 0, lignes: 0, tiers: '' });
    Object.keys(ouv).forEach(k => { row(k).ouverture = ouv[k]; });
    entries.forEach(e => {
      const r = row(e.account);
      r.debit = round3(r.debit + e.debit); r.credit = round3(r.credit + e.credit); r.lignes++;
      if (e.role && e.tiers && !r.tiers) r.tiers = e.tiers;
    });
    const rows = Object.keys(by).sort().map(k => {
      const r = by[k];
      const solde = round3(r.ouverture + r.debit - r.credit);
      return {
        ...r, label: accountLabel(data, k, r.tiers), classe: classeDe(k),
        ouvertureD: r.ouverture > 0 ? r.ouverture : 0, ouvertureC: r.ouverture < 0 ? round3(-r.ouverture) : 0,
        solde, soldeD: solde > 0 ? solde : 0, soldeC: solde < 0 ? round3(-solde) : 0
      };
    });
    const sum = f => round3(rows.reduce((s, r) => s + f(r), 0));
    const totals = {
      ouvertureD: sum(r => r.ouvertureD), ouvertureC: sum(r => r.ouvertureC),
      debit: sum(r => r.debit), credit: sum(r => r.credit),
      soldeD: sum(r => r.soldeD), soldeC: sum(r => r.soldeC)
    };
    const equilibree = round3(totals.ouvertureD - totals.ouvertureC) === 0
      && round3(totals.debit - totals.credit) === 0 && round3(totals.soldeD - totals.soldeC) === 0;
    return { rows, totals, equilibree, period };
  }

  // Le grand livre : pour chaque compte, ses mouvements un par un et le solde qui avance.
  // `opts.compte` limite à un compte (ou à un préfixe : « 4 » donne tous les tiers).
  function grandLivre(data, company, period, opts) {
    opts = opts || {};
    const filtre = String(opts.compte || '');
    const entries = journalEntries(data, company, period, opts);
    const ouv = soldesOuverture(data, company, period, opts);
    const comptes = {};
    const get = k => (comptes[k] = comptes[k] || { account: k, ouverture: ouv[k] || 0, lignes: [], debit: 0, credit: 0, tiers: '' });
    Object.keys(ouv).forEach(k => { if (!filtre || k.startsWith(filtre)) get(k); });
    entries.forEach(e => {
      if (filtre && !e.account.startsWith(filtre)) return;
      const c = get(e.account);
      c.lignes.push(e);
      if (e.role && e.tiers && !c.tiers) c.tiers = e.tiers;
    });
    const out = Object.keys(comptes).sort().map(k => {
      const c = comptes[k];
      let solde = c.ouverture;
      c.lignes.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.journal || '').localeCompare(b.journal || '') || TRI_NUMERIQUE.compare((a.piece || ''), b.piece || ''));
      c.lignes = c.lignes.map(e => { solde = round3(solde + e.debit - e.credit); c.debit = round3(c.debit + e.debit); c.credit = round3(c.credit + e.credit); return { ...e, solde }; });
      return { ...c, label: accountLabel(data, k, c.tiers), classe: classeDe(k), solde };
    });
    return {
      comptes: out,
      debit: round3(out.reduce((s, c) => s + c.debit, 0)),
      credit: round3(out.reduce((s, c) => s + c.credit, 0)),
      lignes: out.reduce((s, c) => s + c.lignes.length, 0),
      period
    };
  }

  // La balance auxiliaire : un client ou un fournisseur par ligne, avec ce qu'il devait à
  // l'ouverture, ce qui a été facturé et réglé, et ce qui reste. Elle se lit sans comptes
  // auxiliaires (les lignes portent leur tiers), mais c'est avec eux que le cabinet la reconnaît.
  function balanceAuxiliaire(data, company, period, role, opts) {
    const liste = role === 'fournisseurs' ? (data.suppliers || []) : (data.clients || []);
    const nom = id => (liste.find(t => t.id === id) || {}).name || '';
    const acc = chartAccounts(data);
    const base = role === 'fournisseurs' ? acc.fournisseurs : acc.clients;
    const codes = auxiliairesActifs(data) ? codesAuxiliaires(liste) : {};
    const cle = e => e.tiersId || ('~' + (e.tiers || ''));
    const by = {};
    const row = e => {
      const k = cle(e);
      return by[k] = by[k] || { tiersId: e.tiersId || '', tiers: e.tiers || nom(e.tiersId) || '(sans tiers)', account: e.tiersId && codes[e.tiersId] ? base + codes[e.tiersId] : base, ouverture: 0, debit: 0, credit: 0, lignes: 0 };
    };
    // L'ouverture se lit depuis le début de l'EXERCICE, à-nouveau compris — jamais depuis le début
    // du temps. Depuis la 10.14.0 la pièce AN rouvre chaque tiers avec son rôle : lue avec les
    // écritures réelles des années passées, elle compterait chaque client une fois par exercice
    // traversé (la règle de `soldesOuverture`, 9.0.0, que cette fonction n'appliquait pas).
    const exo = debutExercice(period.from);
    if (period.from && period.from > exo) {
      journalEntries(data, company, { from: exo, to: addDays(period.from, -1) }, opts).forEach(e => {
        if (e.role !== role) return;
        const r = row(e); r.ouverture = round3(r.ouverture + e.debit - e.credit);
      });
    }
    journalEntries(data, company, period, opts).forEach(e => {
      if (e.role !== role) return;
      const r = row(e); r.debit = round3(r.debit + e.debit); r.credit = round3(r.credit + e.credit); r.lignes++;
    });
    const rows = Object.keys(by).map(k => by[k]).map(r => {
      const solde = round3(r.ouverture + r.debit - r.credit);
      return { ...r, solde, ouvertureD: r.ouverture > 0 ? r.ouverture : 0, ouvertureC: r.ouverture < 0 ? round3(-r.ouverture) : 0, soldeD: solde > 0 ? solde : 0, soldeC: solde < 0 ? round3(-solde) : 0 };
    }).filter(r => r.ouverture || r.debit || r.credit).sort((a, b) => a.account.localeCompare(b.account) || a.tiers.localeCompare(b.tiers));
    const sum = f => round3(rows.reduce((s, r) => s + f(r), 0));
    return {
      role, rows,
      totals: { ouvertureD: sum(r => r.ouvertureD), ouvertureC: sum(r => r.ouvertureC), debit: sum(r => r.debit), credit: sum(r => r.credit), soldeD: sum(r => r.soldeD), soldeC: sum(r => r.soldeC) }
    };
  }

  const balanceCsvColumns = () => ([
    { key: 'account', label: 'Compte' }, { key: 'label', label: 'Intitulé' },
    { key: 'ouvertureD', label: 'Ouverture débit', type: 'money' }, { key: 'ouvertureC', label: 'Ouverture crédit', type: 'money' },
    { key: 'debit', label: 'Mouvements débit', type: 'money' }, { key: 'credit', label: 'Mouvements crédit', type: 'money' },
    { key: 'soldeD', label: 'Solde débiteur', type: 'money' }, { key: 'soldeC', label: 'Solde créditeur', type: 'money' }
  ]);
  const balanceAuxCsvColumns = () => ([
    { key: 'account', label: 'Compte' }, { key: 'tiers', label: 'Tiers' },
    { key: 'ouvertureD', label: 'Ouverture débit', type: 'money' }, { key: 'ouvertureC', label: 'Ouverture crédit', type: 'money' },
    { key: 'debit', label: 'Mouvements débit', type: 'money' }, { key: 'credit', label: 'Mouvements crédit', type: 'money' },
    { key: 'soldeD', label: 'Solde débiteur', type: 'money' }, { key: 'soldeC', label: 'Solde créditeur', type: 'money' }
  ]);
  // Le grand livre à plat : une ligne par mouvement, précédée du compte et suivie du solde progressif.
  function grandLivreRows(gl) {
    const out = [];
    gl.comptes.forEach(c => {
      out.push({ account: c.account, label: c.label, date: '', journal: '', piece: '', libelle: 'Solde d\'ouverture', debit: 0, credit: 0, solde: c.ouverture });
      c.lignes.forEach(e => out.push({ account: c.account, label: c.label, date: e.date, journal: e.journal, piece: e.piece, libelle: e.label, debit: e.debit, credit: e.credit, solde: e.solde }));
    });
    return out;
  }
  const grandLivreCsvColumns = () => ([
    { key: 'account', label: 'Compte' }, { key: 'label', label: 'Intitulé' }, { key: 'date', label: 'Date', type: 'date' },
    { key: 'journal', label: 'Journal' }, { key: 'piece', label: 'Pièce' }, { key: 'libelle', label: 'Libellé' },
    { key: 'debit', label: 'Débit', type: 'money' }, { key: 'credit', label: 'Crédit', type: 'money' }, { key: 'solde', label: 'Solde', type: 'money' }
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
    'settles', 'recurringId', 'creditOf', 'creditOfNumber', 'creditReason', 'attachments', 'clauses',
    // L'instant d'émission appartient à la pièce émise : une pièce tirée d'elle naît brouillon.
    'issuedTs', 'regimeTva'];

  // La retenue à la source proposée pour un client : la sienne s'il en a une (même 0 %), sinon celle
  // de la société. UNE règle pour l'éditeur (`clientWithholding`) et pour les conversions.
  function retenueDuClient(client, company) {
    if (client && client.withholdingRate != null && client.withholdingRate !== '') return Number(client.withholdingRate) || 0;
    return Number((company || {}).defaultWithholdingRate) || 0;
  }

  // `client` (10.14.1, MR-01) : une facture tirée d'une proforma, d'un bon de commande ou de
  // livraison naissait avec un timbre chez un client EXONÉRÉ, et sans la retenue du client quand
  // la pièce de départ n'en porte pas (un bon, un devis). « Facturer ce devis » les posait depuis
  // la 9.1.1 (`invoiceFromQuote`) ; « Transformer ▾ » non — deux chemins vers la même facture, deux
  // montants nets. La retenue d'une pièce qui en PORTE une (proforma) reste la sienne : c'est un
  // choix fait sur cette pièce, la conversion ne le défait pas.
  function convertDoc(doc, targetType, company, todayIso, client) {
    const date = todayIso || today();
    const PORTE_RETENUE = ['facture', 'avoir', 'proforma'];
    const copy = JSON.parse(JSON.stringify(doc));
    NOT_COPIED.forEach(k => { delete copy[k]; });
    delete copy.fromQuoteId; delete copy.fromQuoteNumber;
    const days = delaiJours(targetType === 'devis' ? company.quoteValidityDays : company.paymentTermsDays, 30);
    const out = {
      ...copy, id: uid(), type: targetType, number: '', status: 'brouillon', date,
      dueDate: ['facture', 'proforma', 'devis'].includes(targetType) ? addDays(date, Number(days) || 30) : '',
      createdAt: Date.now(), payments: [],
      applyStamp: targetType === 'facture' && !(client && client.stampExempt),
      withholdingRate: !PORTE_RETENUE.includes(targetType) ? 0
        : PORTE_RETENUE.includes(doc.type) ? (Number(doc.withholdingRate) || 0)
        : client ? retenueDuClient(client, company) : (Number(doc.withholdingRate) || 0),
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
  // Tout ce qui pointe vers cette pièce. Supprimer un devis laissait des factures pointant vers un
  // identifiant qui n'existe plus : leur en-tête continuait d'annoncer « établie à partir du devis
  // DEV-2026-012 », et le lien de l'historique menait au tableau de bord. On ne refuse pas la
  // suppression — la pièce reste la propriété de son auteur — mais on NOMME ce qui va se rompre.
  function piecesLiees(data, doc) {
    if (!doc || !doc.id) return [];
    const out = [];
    (data.documents || []).forEach(d => {
      if (d.id === doc.id) return;
      let quoi = '';
      if (d.fromQuoteId === doc.id) quoi = d.deposit ? `acompte ${acompteDit(d.deposit, d.currency)}` : d.settles ? 'facture de solde' : 'facture du devis';
      else if (d.fromDocId === doc.id) quoi = 'issue de cette pièce';
      else if (d.creditOf === doc.id) quoi = 'avoir sur cette facture';
      else if (d.settles && d.settles.quoteId === doc.id) quoi = 'facture de solde';
      if (quoi) out.push({ id: d.id, number: d.number || '(brouillon)', type: d.type, quoi });
    });
    return out.sort((a2, b2) => TRI_NUMERIQUE.compare((a2.number || ''), b2.number || ''));
  }

  function derivedDocs(doc, data) {
    if (!doc || !doc.id) return [];   // sans identifiant, `undefined === undefined` renverrait toute la base
    return (data.documents || []).filter(d => d.fromDocId === doc.id)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0));
  }
  // Toutes les pièces d'une même vente, sauf celle-ci (10.12.0). `derivedDocs` ne voit que les
  // ENFANTS directs : un bon de livraison tiré d'une proforma déjà facturée proposait « Facturer »,
  // et le chantier l'était deux fois. On remonte à l'origine (une pièce transformée porte
  // `fromDocId`, une facture tirée d'un devis `fromQuoteId`, un acompte `deposit.quoteId`), puis on
  // redescend. Bornée : une chaîne corrompue (une boucle) ne doit jamais geler l'écran (5.2.3).
  function chaineDePieces(data, doc) {
    if (!doc || !doc.id) return [];
    const docs = data.documents || [];
    const parent = x => x.fromDocId || x.fromQuoteId || (x.deposit && x.deposit.quoteId) || '';
    const enfantDe = (x, id) => x.fromDocId === id || x.fromQuoteId === id || !!(x.deposit && x.deposit.quoteId === id);
    let racine = doc;
    for (let i = 0; i < 50; i++) { const p = parent(racine) && docs.find(x => x.id === parent(racine)); if (!p || p.id === doc.id) break; racine = p; }
    const vus = new Set([racine.id]); const file = [racine];
    while (file.length && vus.size < 1000) {
      const x = file.shift();
      docs.forEach(d => { if (d.id && !vus.has(d.id) && enfantDe(d, x.id)) { vus.add(d.id); file.push(d); } });
    }
    vus.add(doc.id);
    return docs.filter(d => vus.has(d.id) && d.id !== doc.id);
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
      const tt = computeTotals(d, company);
      // La remise globale ampute le prix de chaque prestation (10.14.0) : sans elle, le « top » des
      // Statistiques additionnait les lignes AVANT remise, et disait d'une prestation vendue sur une
      // facture remisée plus que la page Marges, qui la compte depuis la 3.4.0 (`documentMargin`).
      const factor = facteurRemise(tt);
      tt.lines.forEach(l => {
        // Un acompte facturé, et sa déduction sur la facture de solde, sont du chiffre d'affaires de
        // LEUR mois — la règle de `marginBy` (10.14.0). Les ignorer faisait dire au « top » de mars
        // 340 DT quand la carte d'à côté annonçait 1 509 DT, et à celui de mai la prestation entière
        // quand le mois n'en facturait que le solde. Une ligne à part, comme sur la page Marges.
        if (l.noDiscount) {
          const t = totals.__acomptes__ || (totals.__acomptes__ = { label: 'Acomptes facturés (repris au solde)', ht: 0, qty: 0, count: 0, acomptes: true });
          t.ht = round3(t.ht + sign * toBase(d, l.ht, company));
          return;
        }
        const key = (l.label || '').trim().toLowerCase();
        if (!key) return;
        const t = totals[key] || (totals[key] = { label: (l.label || '').trim(), ht: 0, qty: 0, count: 0 });
        t.ht = round3(t.ht + sign * toBase(d, round3(l.ht * factor), company));
        t.qty = round3(t.qty + sign * (Number(l.qty) || 0));
        t.count++;
      });
    });
    // Un acompte et sa déduction dans la même période s'annulent : une ligne à zéro n'apprend rien.
    return Object.values(totals).filter(t => !t.acomptes || Math.abs(t.ht) > 0.0005).sort((a, b) => b.ht - a.ht).slice(0, limit || 8);
  }

  // Clients nouveaux sur la période (première facture dedans) et clients endormis (plus rien depuis `dormantDays`).
  function clientMovement(data, company, fromIso, toIso, dormantDays, todayIso) {
    const t = todayIso || today();
    const seuil = Number(dormantDays) || 180;
    const nouveaux = [], dormants = [];
    const inside = issuedIn(data, fromIso, toIso);
    // Les pièces se rangent par client UNE fois (10.14.0) : relire toutes les pièces pour chacun des
    // mille cinq cents clients coûtait un tiers de seconde à chaque ouverture des Statistiques.
    const parClient = new Map(), dedans = new Map();
    (data.documents || []).forEach(d => {
      if (!(d.type === 'facture' || d.type === 'avoir') || d.status === 'brouillon' || d.status === 'annulée' || !d.date) return;
      if (!parClient.has(d.clientId)) parClient.set(d.clientId, []);
      parClient.get(d.clientId).push(d.date);
    });
    inside.forEach(d => { if (!dedans.has(d.clientId)) dedans.set(d.clientId, []); dedans.get(d.clientId).push(d); });
    (data.clients || []).forEach(c => {
      const dates = (parClient.get(c.id) || []).slice().sort();
      if (!dates.length) return;
      const first = dates[0], last = dates[dates.length - 1];
      const ht = round3((dedans.get(c.id) || [])
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
  // Les tranches d'âge vivent dans `compta.js` depuis la 9.5.0 : le Cabinet en a besoin et ne
  // charge pas core.js. Deux définitions donneraient deux balances âgées qui ne disent pas la
  // même chose — c'est exactement ce que ce module partagé existe pour empêcher.
  const AGING_BUCKETS = Compta.AGING_BUCKETS;
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

  // ---------- le relevé de compte d'un client (10.2.0) ----------
  // Le document qui manquait le plus au quotidien : « qu'est-ce que ce client me doit, en tout ? »
  // Une relance porte sur UNE facture ; un client qui en a six ouvertes reçoit six relances et
  // recompose le total lui-même — ou ne le fait pas. Le relevé est la pièce qu'on envoie à la
  // comptabilité d'en face pour qu'elle rapproche son compte du nôtre.
  //
  // Il ne se saisit pas et ne s'enregistre pas : il se DÉDUIT des pièces à l'instant où on
  // l'imprime, comme les statuts (règle « les statuts ne se saisissent jamais à la main »). Un
  // relevé rangé se périmerait à l'encaissement suivant.
  //
  // Le relevé qu'on ENVOIE (`opts.natif`, 10.14.1, DEV-12) parle la devise et la langue du client :
  // un client facturé en euros recevait « 3 190,202 DT » pour une facture de 952,30 €, en français,
  // et ne pouvait rapprocher aucune ligne de son compte. Quand toutes ses pièces sont dans UNE
  // devise, le relevé est dans cette devise ; quand elles en mêlent plusieurs, il reste dans celle de
  // la société et chaque pièce étrangère rappelle son montant d'origine. Sans `natif` (la fiche, le
  // menu), tout reste en devise de la société — c'est là qu'on additionne.
  function releveClient(data, clientId, company, opts) {
    opts = opts || {};
    const t = opts.date || today();
    const client = (data.clients || []).find(c => c.id === clientId) || {};
    const lignes = [];
    const base = normCurrency(company.currency || 'DT');
    const pieces = (data.documents || [])
      .filter(d => d.clientId === clientId && (d.type === 'facture' || d.type === 'avoir')
        && d.status !== 'brouillon' && d.status !== 'annulée' && d.date <= t);
    const devises = [...new Set(pieces.map(d => normCurrency(d.currency || base)))];
    const devise = opts.natif && devises.length === 1 ? devises[0] : base;
    const natif = devise !== base;
    const conv = (d, x) => natif ? round3(x) : toBase(d, x, company);
    const origine = (d, x) => opts.natif && !natif && normCurrency(d.currency || base) !== base ? money(x, normCurrency(d.currency)) : '';
    const lang = !opts.natif ? 'fr' : client.lang === 'en' || client.lang === 'fr' ? client.lang
      : pieces.length && pieces.every(d => d.lang === 'en') ? 'en' : (company.defaultLang === 'en' ? 'en' : 'fr');
    pieces
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .forEach(d => {
        if (d.type === 'avoir') {
          // Un avoir qui vient en déduction d'une facture est DÉJÀ compté dans le reste dû de cette
          // facture (`invoiceBalance`) : le remontrer ferait un relevé deux fois trop favorable.
          // Seul un avoir libre — non rattaché — est une somme que le client peut encore employer.
          if (d.creditOf) return;
          const natNet = computeTotals(d, company).netToPay;
          const net = round3(conv(d, natNet));
          if (net <= 0.0005) return;
          lignes.push({ id: d.id, type: 'avoir', date: d.date, number: d.number || '', dueDate: '',
            libelle: d.subject || '', montant: -net, regle: 0, reste: -net, retard: 0, origine: origine(d, -natNet) });
          return;
        }
        const b = invoiceBalance(d, data, company);
        // Une facture payée plus qu'elle ne vaut porte une somme due AU CLIENT (10.14.0) : le relevé
        // la sautait comme une facture soldée, et le total disait au client qu'il devait plus qu'en
        // réalité. Elle s'écrit comme un avoir libre : un montant qu'il peut encore employer.
        if (b.remaining < -0.0005) {
          const trop = round3(conv(d, -b.remaining));
          lignes.push({ id: d.id, type: 'tropPercu', date: d.date, number: d.number || '', dueDate: '',
            libelle: '', montant: -trop, regle: 0, reste: -trop, retard: 0, origine: origine(d, b.remaining) });
          return;
        }
        if (b.remaining <= 0.0005) return;
        const montant = round3(conv(d, b.totals.netToPay));
        const reste = round3(conv(d, b.remaining));
        lignes.push({
          id: d.id, type: 'facture', date: d.date, number: d.number || '', dueDate: d.dueDate || '',
          libelle: d.subject || '', montant, regle: round3(montant - reste), reste,
          retard: d.dueDate && d.dueDate < t ? daysBetween(d.dueDate, t) : 0, origine: origine(d, b.remaining)
        });
      });
    const somme = k => round3(lignes.reduce((s, l) => s + l[k], 0));
    const echu = round3(lignes.filter(l => l.retard > 0).reduce((s, l) => s + l.reste, 0));
    // Le relevé dit ce que le client VERSERA (le net) ; son compte chez lui, comme le nôtre, porte
    // aussi la retenue qu'il gardera pour l'État en payant (10.14.0). Elle se dit à part, pour que sa
    // comptabilité rapproche son 401 du total sans deviner d'où vient l'écart.
    const rsASubir = round3((data.documents || [])
      .filter(d => d.clientId === clientId && (d.type === 'facture' || d.type === 'avoir') && d.date <= t)
      .reduce((s, d) => s + retenueASubir(d, data, company, natif), 0));
    return {
      client, date: t, currency: devise, lang, lignes, rsASubir,
      montant: somme('montant'), regle: somme('regle'), total: somme('reste'),
      echu, aVenir: round3(somme('reste') - echu),
      plusAncien: lignes.reduce((n, l) => Math.max(n, l.retard), 0)
    };
  }

  // Le relevé imprimable. Un document à part, comme les pièces du personnel (5.1.0) : ce n'est pas
  // une facture, il ne porte ni numéro, ni TVA, ni timbre — l'y faire passer par `documentHtml`
  // lui donnerait des mentions légales qui n'ont rien à y faire.
  // Le mail qui accompagne le relevé, dans la langue et la devise du relevé (10.14.1, DEV-12) : il
  // disait « Solde restant dû : 3 190,202 DT » en français à un client facturé 952,30 € en anglais.
  function mailReleve(r, company) {
    const en = r.lang === 'en', cur = r.currency, nom = (company || {}).name || '';
    const m = n => money(n, cur, null, en ? 'en' : 'fr');
    const d = fmtDate(r.date);
    if (en) {
      return {
        subject: `Statement of account as at ${d} — ${nom}`,
        body: `Hello,\n\nPlease find attached the statement of your account as at ${d}.\n\n`
          + (r.total > 0.0005 ? `Balance due: ${m(r.total)}${r.echu > 0.0005 ? `, of which ${m(r.echu)} overdue` : ''}.\n\n`
            : r.total < -0.0005 ? `Your account shows a balance in your favour of ${m(-r.total)}.\n\n` : 'Your account is settled. Thank you for your trust.\n\n')
          + `If a payment crossed with this message, please disregard it.\n\nBest regards,\n${nom}`
      };
    }
    return {
      subject: `Relevé de compte au ${d} — ${nom}`,
      body: `Bonjour,\n\nVous trouverez ci-joint le relevé de votre compte au ${d}.\n\n`
        + (r.total > 0.0005 ? `Solde restant dû : ${m(r.total)}${r.echu > 0.0005 ? `, dont ${m(r.echu)} échu` : ''}.\n\n`
          : r.total < -0.0005 ? `Votre compte présente un solde en votre faveur de ${m(-r.total)}.\n\n` : 'Votre compte est soldé. Merci de votre confiance.\n\n')
        + `Si un règlement s'est croisé avec cet envoi, merci de ne pas en tenir compte.\n\nCordialement,\n${nom}`
    };
  }
  // Les mots du relevé, dans les deux langues des pièces (10.14.1, DEV-12).
  const RELEVE_MOTS = {
    fr: { titre: 'Relevé de compte', asof: 'Situation arrêtée au', date: 'Date', piece: 'Pièce', objet: 'Objet', echeance: 'Échéance',
      montant: 'Montant', regle: 'Réglé', reste: 'Reste dû', retard: n => `${n} j de retard`, total: 'Total dû au', faveur: 'Solde en votre faveur au',
      echu: 'Échu', aVenir: 'À échoir', solde: 'Aucune pièce ouverte à cette date : le compte est soldé. Merci de votre confiance.',
      virement: 'Règlement par virement :', rappel: 'Ce relevé ne remplace pas les factures qu\'il récapitule. Si un règlement s\'est croisé avec son envoi, merci de ne pas en tenir compte.',
      avoir: 'Avoir', trop: 'Trop-perçu à rendre', origine: 'pièce en', mf: 'MF' },
    en: { titre: 'Statement of account', asof: 'Balance as at', date: 'Date', piece: 'Document', objet: 'Subject', echeance: 'Due date',
      montant: 'Amount', regle: 'Paid', reste: 'Balance due', retard: n => `${n} day${n > 1 ? 's' : ''} overdue`, total: 'Total due as at', faveur: 'Balance in your favour as at',
      echu: 'Overdue', aVenir: 'Not yet due', solde: 'No open item at this date: the account is settled. Thank you for your trust.',
      virement: 'Payment by bank transfer:', rappel: 'This statement does not replace the invoices it summarises. If a payment crossed with it, please disregard it.',
      avoir: 'Credit note', trop: 'Overpayment to refund', origine: 'document in', mf: 'Tax ID' }
  };
  function releveHtml(releve, company, opts) {
    opts = opts || {};
    const r = releve;
    const cur = r.currency;
    const lang = r.lang === 'en' ? 'en' : 'fr';
    const W = RELEVE_MOTS[lang];
    const fmt = n => money(n, null, decimalsFor(cur), lang);
    const dt = fmtDate;   // la facture anglaise écrit aussi JJ/MM/AAAA
    const libelle = l => l.libelle || (l.type === 'avoir' ? W.avoir : l.type === 'tropPercu' ? W.trop : '');
    const ink = company.primaryColor || '#1b2430';
    const accent = company.accentColor || '#0f9d8f';
    const hex = accent.replace('#', '');
    const [rr, gg, bb] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const tint = a => `rgba(${rr}, ${gg}, ${bb}, ${a})`;
    const c = r.client || {};
    return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8">
<title>${W.titre} — ${escapeHtml(c.name || '')}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: ${ink}; font-size: 10pt; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 18mm; background: #fff; display: flex; flex-direction: column; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding-bottom: 14px; border-bottom: 2px solid ${tint(0.35)}; }
  .co-name { font-size: 14pt; font-weight: 700; }
  .co-sub { font-size: 8pt; color: #6a7480; line-height: 1.5; }
  h1 { font-size: 15pt; letter-spacing: 1.2px; text-transform: uppercase; color: ${accent}; margin: 24px 0 4px; }
  .asof { font-size: 9pt; color: #6a7480; margin: 0 0 18px; }
  .who { margin: 0 0 18px; padding: 10px 14px; background: ${tint(0.07)}; border-inline-start: 3px solid ${accent}; border-radius: 0 6px 6px 0; }
  .who b { font-size: 11pt; }
  table.l { width: 100%; border-collapse: collapse; }
  table.l th { font-size: 8pt; text-transform: uppercase; letter-spacing: .6px; color: #6a7480; text-align: start; padding: 6px 7px; border-bottom: 1.5px solid ${tint(0.4)}; }
  table.l td { padding: 6px 7px; border-bottom: 1px solid #eef1f4; vertical-align: top; }
  table.l td.n, table.l th.n { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.late td { background: rgba(214, 69, 65, .06); }
  .lateflag { color: #b4322e; font-size: 8pt; }
  tr.tot td { border-top: 1.5px solid ${ink}; border-bottom: none; font-weight: 700; font-size: 11.5pt; padding-top: 9px; }
  .recap { margin-top: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .recap div { border: 1px solid #e6eaee; border-radius: 8px; padding: 9px 12px; }
  .recap .k { font-size: 8pt; text-transform: uppercase; letter-spacing: .6px; color: #6a7480; }
  .recap .v { font-size: 12pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .pay { margin-top: 16px; font-size: 9pt; }
  .foot { margin-top: auto; padding-top: 10px; border-top: 1px solid #eef1f4; font-size: 7.5pt; color: #8b949e; text-align: center; }
</style></head>
<body><div class="page">
  <div class="head">
    <div><div class="co-name">${escapeHtml(company.name || '')}</div>
      <div class="co-sub">${escapeHtml(company.address || '').replace(/\n/g, '<br>')}
        ${company.matricule ? `<br>${W.mf} : ${escapeHtml(company.matricule)}` : ''}</div></div>
    <div class="co-sub" style="text-align:end">${company.phone ? escapeHtml(company.phone) + '<br>' : ''}${company.email ? escapeHtml(company.email) : ''}</div>
  </div>
  <h1>${W.titre}</h1>
  <p class="asof">${W.asof} ${dt(r.date)}${opts.stampText ? ' — ' + escapeHtml(opts.stampText) : ''}</p>
  <div class="who"><b>${escapeHtml(c.name || '')}</b>${c.matricule ? `<br>${W.mf} : ${escapeHtml(c.matricule)}` : ''}
    ${c.address ? '<br>' + escapeHtml(c.address).replace(/\n/g, '<br>') : ''}</div>
  ${r.lignes.length ? `<table class="l">
    <thead><tr><th>${W.date}</th><th>${W.piece}</th><th>${W.objet}</th><th>${W.echeance}</th><th class="n">${W.montant}</th><th class="n">${W.regle}</th><th class="n">${W.reste}</th></tr></thead>
    <tbody>
      ${r.lignes.map(l => `<tr class="${l.retard > 0 ? 'late' : ''}">
        <td>${dt(l.date)}</td>
        <td>${escapeHtml(l.number || '—')}</td>
        <td>${escapeHtml(libelle(l))}${l.origine ? `<div class="lateflag" style="color:#6a7480">${W.origine} ${escapeHtml(l.origine)}</div>` : ''}</td>
        <td>${l.dueDate ? dt(l.dueDate) : '—'}${l.retard > 0 ? `<div class="lateflag">${W.retard(l.retard)}</div>` : ''}</td>
        <td class="n">${fmt(l.montant)}</td>
        <td class="n">${l.regle ? fmt(l.regle) : '—'}</td>
        <td class="n">${fmt(l.reste)}</td></tr>`).join('')}
      ${/* Un compte qui penche en faveur du client le DIT (10.14.0) : « Total dû : −505,560 » se lit
         comme une faute de frappe, et c'est le client qui la lit. */''}<tr class="tot"><td colspan="6">${r.total < -0.0005 ? W.faveur : W.total} ${dt(r.date)}</td><td class="n">${fmt(Math.abs(r.total))} ${escapeHtml(cur)}</td></tr>
    </tbody></table>
  ${r.total < -0.0005 ? '' : `<div class="recap">
    <div><div class="k">${W.echu}</div><div class="v">${fmt(r.echu)} ${escapeHtml(cur)}</div></div>
    <div><div class="k">${W.aVenir}</div><div class="v">${fmt(r.aVenir)} ${escapeHtml(cur)}</div></div>
  </div>`}`
    : `<p>${W.solde}</p>`}
  ${r.total > 0.0005 && company.rib ? `<p class="pay">${W.virement} <b>${escapeHtml(company.rib)}</b>${company.bank ? ' — ' + escapeHtml(company.bank) : ''}</p>` : ''}
  <p class="pay">${W.rappel}</p>
  <div class="foot">${escapeHtml(company.name || '')}${company.matricule ? ` — ${W.mf} ` + escapeHtml(company.matricule) : ''}</div>
</div></body></html>`;
  }

  // Classement des payeurs : délai moyen constaté par client, sur ses factures soldées.
  function payerRanking(data, company, limit) {
    const out = [];
    (data.clients || []).forEach(c => {
      const delays = [];
      (data.documents || []).filter(d => d.type === 'facture' && d.clientId === c.id && d.status !== 'brouillon' && d.status !== 'annulée').forEach(d => {
        if (effectiveStatus(d, data, company, '9999-12-31') !== 'payée' || !(d.payments || []).length) return;
        const last = dateDernierReglement(d);
        if (last && d.date) delays.push(delaiConstate(d.date, last));
      });
      if (delays.length) out.push({ clientId: c.id, name: c.name, delay: Math.round(delays.reduce((s, x) => s + x, 0) / delays.length), count: delays.length });
    });
    out.sort((a, b) => a.delay - b.delay);
    // 10.12.0 — un client ne peut pas être à la fois parmi les plus rapides et les plus lents : avec
    // un seul payeur, la page le rangeait dans les deux colonnes, « 0 j » des deux côtés. Les rapides
    // prennent la première moitié, les lents ce qui reste.
    const k = limit || 5;
    const rapides = out.slice(0, Math.min(k, Math.ceil(out.length / 2)));
    return { rapides, lents: out.slice(rapides.length).reverse().slice(0, k), tous: out };
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
      if (inv && q.date) delays.push(delaiConstate(q.date, inv));
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

  // Les factures qui restent dues mais ne sont PAS encore en retard, de la plus proche échéance à la
  // plus lointaine (10.12.0). La page Relances vide disait comment elle se remplit, jamais POURQUOI
  // elle était vide ni QUAND elle cesserait de l'être — à une menuiserie qui attendait 4 530 DT. Une
  // phrase d'état vide dit sa raison et le jour où ça changera (E-06) : ce jour-là est ici. Même
  // filtre que `overdueInvoices`, de l'autre côté de l'échéance ; une facture sans échéance n'est
  // jamais « à venir » : elle ne sera jamais en retard non plus.
  function facturesAVenir(data, company, todayIso) {
    const t = todayIso || today();
    return (data.documents || [])
      .filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée' && d.dueDate && d.dueDate >= t)
      .map(d => ({ doc: d, remaining: invoiceBalance(d, data, company).remaining, dueDate: d.dueDate }))
      .filter(x => x.remaining > 0.0005)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.doc.number || '').localeCompare(b.doc.number || ''));
  }

  // ---------- les licences émises par l'éditeur (7.33.0) ----------
  //
  // L'éditeur de SkanFact vend des licences depuis SA propre application : la vente est une facture
  // comme une autre (journal des ventes, TVA, paquet du comptable), et l'historique vit ici, dans
  // `data.licences`. Chaque ligne garde la clé signée (elle n'a rien de secret : c'est celle qu'a
  // le client), l'offre, la date de fin, et la facture qui l'a portée.
  const LICENCE_PREAVIS = 30;   // jours avant l'échéance où une licence passe « à renouveler »
  // L'état d'une licence émise, vu de l'éditeur : 'vie' (sans fin), 'active', 'bientot' (elle finit
  // dans les trente jours — c'est le moment de facturer le renouvellement), 'expiree'.
  function licenceEtat(lic, todayIso) {
    const t = todayIso || today();
    // Une licence révoquée passe avant tout le reste : elle n'est plus ni active, ni à renouveler,
    // et surtout elle ne doit plus rien réclamer (8.2.0). Ce que la révocation ne fait PAS, c'est
    // désactiver la clé chez le client — voir `licenceRevoquee` et la phrase qui l'accompagne.
    if (lic && lic.revoqueeLe) return { etat: 'revoquee', jours: null };
    if (!lic || !lic.exp) return { etat: 'vie', jours: null };
    const jours = daysBetween(t, lic.exp);
    return { etat: jours < 0 ? 'expiree' : jours <= LICENCE_PREAVIS ? 'bientot' : 'active', jours };
  }
  const LICENCE_ETAT_LABELS = { vie: 'À vie', active: 'Active', bientot: 'À renouveler', expiree: 'Expirée', revoquee: 'Révoquée' };
  // Pourquoi une licence a été remplacée. Un renouvellement, un changement d'offre et une correction
  // de matricule fabriquent tous une clé neuve — l'offre et le matricule voyagent DANS la charge
  // signée, on ne peut pas les changer sans re-signer — mais ce ne sont pas le même geste, et la
  // liste mentirait en les montrant tous comme « renouvelée ».
  const LICENCE_MOTIFS = { renouvellement: 'Renouvelée', offre: 'Offre changée', matricule: 'Matricule corrigé' };

  // Le prorata d'un changement d'offre. On ne refait pas une année : on facture la DIFFÉRENCE de
  // prix sur les jours qui restent, et la date de fin ne bouge pas. Sans ça, passer d'Indépendant à
  // Entreprise au sixième mois coûterait une année pleine au client — ce qui est un très bon moyen
  // de lui faire refuser la montée en gamme.
  //   `total` : la durée de la licence en cours, du jour d'émission à la date de fin.
  //   `jours` : ce qui reste à courir depuis aujourd'hui.
  // Une licence à vie n'a pas de prorata : la différence se facture en entier (il n'y a pas de fin
  // sur laquelle répartir), et `jours`/`total` valent null pour que l'écran le dise au lieu
  // d'afficher un ratio inventé.
  function prorataOffre(lic, prixNouveau, prixAncien, todayIso) {
    const t = todayIso || today();
    const diff = Math.max(0, (Number(prixNouveau) || 0) - (Number(prixAncien) || 0));
    if (!lic || !lic.exp) return { jours: null, total: null, part: 1, montant: round3(diff) };
    const total = Math.max(1, daysBetween(lic.emisLe || t, lic.exp));
    const jours = Math.max(0, daysBetween(t, lic.exp));
    const part = Math.min(1, jours / total);
    return { jours, total, part, montant: round3(diff * part) };
  }

  // Ce qu'on sait d'une licence côté ARGENT et côté ENVOI. Deux questions que la page posait
  // nulle part : la clé est-elle partie, et la vente est-elle facturée puis encaissée ? Une licence
  // émise, jamais envoyée et jamais facturée est le pire des cas — le client attend, et la vente
  // n'existe pour personne.
  // `company` est un TROISIÈME argument chez `invoiceBalance` et `effectiveStatus`, jamais lu dans
  // `data` : l'oublier ne lève rien ici mais fait planter `computeTotals` sur `company.stampFee`.
  // On le laisse facultatif avec un repli sur `data.company`, qui est bien la société du dossier.
  function licenceSuivi(lic, data, company) {
    const co = company || (data && data.company) || {};
    const envois = (lic && lic.emails) || [];
    const inv = lic && lic.invoiceId ? (data.documents || []).find(d => d.id === lic.invoiceId) : null;
    const emise = !!(inv && inv.number);
    const st = inv && emise ? effectiveStatus(inv, data, co) : '';
    const reste = inv && emise ? invoiceBalance(inv, data, co).remaining : 0;
    // Une licence vendue par la CONSOLE (8.7.0, `origine: 'console'`) a été envoyée par elle, et
    // c'est elle qui le sait : la date arrive avec la vente, et compte comme un envoi.
    const envoyeeConsole = (lic && lic.origine === 'console' && lic.envoyeeConsoleLe) || '';
    return {
      envoyee: envois.length > 0 || !!envoyeeConsole,
      envoyeeLe: envois.length ? envois[envois.length - 1].date : envoyeeConsole,
      envois: envois.length,
      facture: inv || null, brouillon: !!(inv && !emise), facturee: emise,
      statutFacture: st, reste, payee: emise && reste <= 0
    };
  }

  // Les trois manques que « À faire » doit remonter, dans cet ordre de gravité. Une licence
  // révoquée n'y figure jamais : on ne réclame pas l'argent qu'on vient de rendre.
  // L'export de la base de la console : depuis combien de jours, et faut-il le réclamer ?
  // Réclamé au bout de trente jours — et tout de suite s'il n'a JAMAIS eu lieu, parce que « jamais »
  // n'est pas un retard, c'est un filet qui n'existe pas.
  const EXPORT_CONSOLE_DELAI = 30;
  function exportConsoleAFaire(data, todayIso) {
    const t = todayIso || today();
    const du = String((data && data.exportConsole) || '').slice(0, 10);
    if (!du) return { du: '', jours: null, reclame: true };
    const jours = daysBetween(du, t);
    return { du, jours, reclame: jours > EXPORT_CONSOLE_DELAI };
  }

  function licencesAFaire(data, company, todayIso) {
    const t = todayIso || today();
    const vivantes = (data.licences || []).filter(l => l && !l.revoqueeLe && !l.remplaceePar);
    // L'envoi d'une clé vendue par la console est l'affaire de la console (elle l'envoie au
    // paiement) : la réclamer ici ferait envoyer deux fois, ou avant que le client ait payé.
    const jamaisEnvoyees = vivantes.filter(l => l.origine !== 'console' && !licenceSuivi(l, data, company).envoyee);
    const nonFacturees = vivantes.filter(l => { const s = licenceSuivi(l, data, company); return !s.facturee; });
    const impayees = vivantes.filter(l => { const s = licenceSuivi(l, data, company); return s.facturee && !s.payee; });
    return { jamaisEnvoyees, nonFacturees, impayees, expirant: licencesExpirant(data, t) };
  }
  // Les lignes de la page Licences : ce qui presse d'abord (à renouveler, puis expirées), puis les
  // actives par date de fin, puis celles à vie. Une licence renouvelée pointe sur sa remplaçante
  // (`remplaceePar`) : elle sort du compte des choses à faire.
  function licenceRows(data, todayIso, company) {
    const t = todayIso || today();
    const ordre = { bientot: 0, expiree: 1, active: 2, vie: 3, revoquee: 4 };
    return (data.licences || []).map(l => {
      const e = licenceEtat(l, t);
      const suivi = licenceSuivi(l, data, company);
      return { ...l, etat: e.etat, jours: e.jours, etatLabel: LICENCE_ETAT_LABELS[e.etat],
        renouvelee: !!l.remplaceePar, motifLabel: l.remplaceePar ? (LICENCE_MOTIFS[l.motif] || LICENCE_MOTIFS.renouvellement) : '',
        envoyee: suivi.envoyee, envoyeeLe: suivi.envoyeeLe, facturee: suivi.facturee, payee: suivi.payee, resteDu: suivi.reste };
    }).sort((a, b) => (ordre[a.etat] - ordre[b.etat]) || ((a.exp || '9999').localeCompare(b.exp || '9999')) || (a.nom || '').localeCompare(b.nom || ''));
  }
  // ---------- le pont comptable (8.7.0) ----------
  //
  // La console (api.skanfact.tn) vend ; SkanFact facture. Trois choses pures ici, testées sans
  // Electron : retrouver le client d'une vente, la liste exacte de ce que l'historique envoie UNE
  // fois à la console, et les factures dont le numéro est à rendre.

  // Le client d'une vente de la console : par les sept chiffres du matricule d'abord (un matricule
  // s'écrit de dix façons — « MF 1234567A », « 1234567/A/M/000 »), par le nom ensuite, jamais créé
  // ici : créer est une décision de l'appelant.
  const chiffresMatricule = s => { const m = String(s || '').toUpperCase().match(/\d{7}/); return m ? m[0] : ''; };
  function clientPourVente(clients, vente) {
    const liste = clients || [];
    const ch = chiffresMatricule(vente && vente.matricule);
    if (ch) { const c = liste.find(x => chiffresMatricule(x.matricule) === ch); if (c) return c; }
    const nom = String((vente && vente.client) || '').trim().toLowerCase();
    if (nom) { const c = liste.find(x => String(x.name || '').trim().toLowerCase() === nom); if (c) return c; }
    return null;
  }

  // Ce que l'historique envoie à la console au premier branchement : les licences émises DANS
  // SkanFact (jamais celles qui en viennent — elle les connaît déjà). Chaque champ est nommé :
  // un test compte ce qui part, et rien d'autre ne doit s'y glisser.
  function chargeHistorique(data, company) {
    const co = company || data.company || {};
    return (data.licences || []).filter(l => l && l.key && l.origine !== 'console').map(l => {
      const inv = l.invoiceId ? (data.documents || []).find(d => d.id === l.invoiceId) : null;
      const client = l.clientId ? (data.clients || []).find(c => c.id === l.clientId) : null;
      const suivi = licenceSuivi(l, data, co);
      let facture = null;
      if (inv && inv.number) {
        facture = { numero: inv.number, montant: round3(computeTotals(inv, co).netHT), payeeLe: suivi.payee ? derniereDatePaiement(inv) : '' };
      }
      return {
        id: l.id, cle: l.key, nom: l.nom || (client ? client.name : ''), matricule: l.matricule || (client ? client.matricule : '') || '',
        email: (client && client.email) || '', offre: l.offre || 'entreprise', exp: l.exp || '', emisLe: l.emisLe || '',
        cabinet: l.cabinet || '', prix: Number(l.prix) || 0, devise: (inv && inv.currency) || co.currency || 'TND',
        remise: inv ? Number(inv.discountRate) || 0 : 0, motif: l.motif || '', remplaceePar: l.remplaceePar || '',
        revoqueeLe: l.revoqueeLe || '', revoqueeMotif: l.revoqueeMotif || '', envoyeeLe: suivi.envoyeeLe || '', facture,
        // 9.4.1 — le type et le quota d'une licence de CABINET : sans eux, la console la rangerait en
        // « Entreprise » et la renouvellerait comme telle.
        type: l.type === 'cabinet' ? 'cabinet' : 'entreprise', dossiersHors: l.type === 'cabinet' ? Math.max(0, Math.round(Number(l.dossiersHors) || 0)) : 0
      };
    });
  }
  function derniereDatePaiement(inv) { return dateDernierReglement(inv); }

  // Les factures issues d'une vente de la console, émises, dont le numéro n'a pas encore été rendu.
  function facturesAAnnoncer(data) {
    return (data.documents || []).filter(d => d && d.type === 'facture' && d.venteConsoleId && d.number && !d.factureeAnnoncee);
  }

  // Les licences qui finissent dans les trente jours et qu'on n'a pas encore renouvelées.
  function licencesExpirant(data, todayIso) {
    return licenceRows(data, todayIso).filter(l => l.etat === 'bientot' && !l.renouvelee && !l.revoqueeLe);
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

    // Une facture dont la relance est REPORTÉE reste en retard (la carte « Reste à encaisser » la
    // compte) mais n'est plus à relancer aujourd'hui. Dire « 3 factures en retard » ici et « 4 en
    // retard » sur la carte, à dix centimètres, c'est deux chiffres justes qui se contredisent :
    // quand un report existe, la ligne dit « à relancer » et nomme les autres (règle 6.8.1).
    const tousRetards = overdueInvoices(data, company, t);
    const overdue = tousRetards.filter(x => !x.snoozed);
    const reportes = tousRetards.length - overdue.length;
    const overdueAmount = round3(overdue.reduce((s, x) => s + toBase(x.doc, x.remaining, company), 0));
    if (overdue.length) out.push({
      id: 'retards', level: 'danger', label: `${overdue.length} facture${overdue.length > 1 ? 's' : ''} en retard${reportes ? ' à relancer' : ''}`,
      detail: `${fmt(overdueAmount)} à récupérer · plus ancienne : ${plFr(overdue[0].daysLate, 'jour')} de retard${reportes ? ` · ${reportes > 1 ? `${reportes} autres` : '1 autre'} en retard, relance reportée` : ''}`,
      count: overdue.length, amount: overdueAmount, route: '#/relances', docs: overdue.map(x => x.doc)
    });

    // Les questions du comptable restées sans réponse (9.10.0). Une question attend une pièce, une
    // explication ou une confirmation : tant qu'elle attend, le comptable ne peut pas arrêter son
    // travail, et c'est le client qui bloque sans le savoir. La ligne monte à `danger` au bout de
    // deux paquets — même seuil des deux côtés, c'est la même règle lue par les deux applications.
    const qsOuvertes = (data.questionsCabinet || []).filter(q => !(q.reponse && (String(q.reponse.texte || '').trim() || q.reponse.piece)));
    if (qsOuvertes.length) {
      const bloquees = questionsSansReponse(data.questionsCabinet || []);
      out.push({
        id: 'questions', level: bloquees.length ? 'danger' : 'warn',
        label: `${plFr(qsOuvertes.length, 'question')} de ton comptable ${qsOuvertes.length > 1 ? 'attendent' : 'attend'} ta réponse`,
        detail: bloquees.length
          ? `${plFr(bloquees.length, 'est arrivée', 'sont arrivées')} dans deux paquets sans réponse : ton comptable ne peut pas arrêter ton mois tant qu'${bloquees.length > 1 ? 'elles restent' : 'elle reste'} en l'air.`
          : 'Chacune est posée en face de la pièce qu\'elle vise : ouvre-la et réponds, ta réponse repart dans le prochain paquet.',
        count: qsOuvertes.length, route: '#/compta?onglet=cabinet', docs: []
      });
    }

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

    // Devis acceptés dont le montant n'a pas été facturé EN ENTIER (même en brouillon) : le travail
    // est vendu, pas facturé. Un ACOMPTE porte `fromQuoteId` lui aussi (7.29.0) : le compter comme la
    // facture du devis faisait disparaître de « À faire » un devis dont 30 % seulement étaient
    // facturés — et les 70 % restants n'étaient réclamés nulle part (10.12.0, une menuiserie qui
    // avait facturé son acompte). Seule une facture totale ou de solde ferme la ligne ; les acomptes,
    // eux, se retranchent du montant annoncé — sans leur timbre, que le devis ne portait pas.
    const tirees = (data.documents || []).filter(d => d.type === 'facture' && d.fromQuoteId);
    const billed = new Set(tirees.filter(d => !d.deposit).map(d => d.fromQuoteId));
    const acomptesDe = id => tirees.filter(d => d.deposit && d.fromQuoteId === id && effectiveStatus(d, data, company, t) !== 'annulée');
    const accepted = (data.documents || []).filter(d => d.type === 'devis' && d.status === 'accepté' && !billed.has(d.id));
    const resteDe = q => Math.max(0, round3(toBase(q, computeTotals(q, company).totalTTC, company)
      - acomptesDe(q.id).reduce((s, a) => { const ta = computeTotals(a, company); return s + toBase(a, ta.totalTTC - (ta.stamp || 0), company); }, 0)));
    const acceptedAmount = round3(accepted.reduce((s, d) => s + resteDe(d), 0));
    const avecAcompte = accepted.filter(q => acomptesDe(q.id).length).length;
    if (accepted.length) out.push({
      id: 'devis-acceptes', level: 'warn', label: `${accepted.length} devis accepté${accepted.length > 1 ? 's' : ''} à facturer`,
      detail: avecAcompte
        ? `${fmt(acceptedAmount)} TTC vendus et pas encore facturés, acomptes déduits : pour un devis dont l'acompte est facturé, « Facturer le solde » est dans le menu de sa ligne.`
        : `${fmt(acceptedAmount)} TTC vendus et pas encore facturés : le bouton « Facturer » est sur chaque ligne.`,
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

    // Seulement ce que les clients ont DÉJÀ retenu en payant (10.14.0) : une facture pas encore réglée
    // n'a rien retenu, et son attestation n'existe pas encore. Le montant est celui des encaissements.
    const rsAttendues = attestationsARecevoir(data, company);
    const rsPending = rsAttendues.map(x => x.doc);
    const rsAmount = round3(rsAttendues.reduce((s, x) => s + x.amount, 0));
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
      detail: `${fmt(round3(owedLate.reduce((s, x) => s + x.remaining, 0)))} à régler · la plus ancienne : ${plFr(owedLate[0].late, 'jour')} de retard`,
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
      // Toutes les années sont regardées depuis la 10.14.1 : une ligne d'« À faire » ne s'allonge pas
      // pour autant d'une phrase par trimestre — les trois plus anciennes, et le compte du reste.
      detail: soc.slice(0, 3).map(x => `${x.label} — ${x.late ? 'échéance dépassée le ' : 'avant le '}${fmtDate(x.dueDate)}`).join(' · ')
        + (soc.length > 3 ? ` · et ${plFr(soc.length - 3, 'autre')}` : ''),
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
      // E-04 : un bulletin impossible enregistré avant la garde. Rouge, parce qu'il fausse une
      // déclaration qu'on s'apprête à déposer ; et il NOMME qui, et quand.
      const imp = bulletinsImpossibles(data);
      if (imp.length) {
        const qui = x => `${((data.employees || []).find(e => e.id === x.employeeId) || {}).name || 'un salarié'} (${monthLabel(`${x.year}-${String(x.month).padStart(2, '0')}-01`)})`;
        out.push({
          id: 'bulletins-impossibles', level: 'danger',
          label: `${plFr(imp.length, 'bulletin')} au net négatif, à corriger avant de déclarer`,
          detail: `${imp.slice(0, 3).map(qui).join(', ')}${imp.length > 3 ? '…' : ''}. ${imp.length > 1 ? 'Ils ont été enregistrés' : 'Il a été enregistré'} avant que SkanFact ne refuse ce cas : l'écriture de paie est inversée, et la déclaration CNSS du trimestre ${imp.length > 1 ? 'les' : 'le'} compte. Corrige les absences ou les retenues.`,
          count: imp.length, route: '#/paie', docs: []
        });
      }
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
      detail: gaps.map(g => `${g.label} : ${g.qty} en stock, ${plFr(g.serials, 'numéro')} disponible${sAccord(g.serials)}`).join(' · ') + '. Un numéro n\'a pas été saisi à l\'entrée, ou pas attribué à la sortie.',
      count: gaps.length, route: '#/stock', docs: []
    });
    // Un bien créé avant l'avoir de son fournisseur (10.14.1) : sa fiche garde le montant d'avant, le
    // bilan le montant diminué, et la dotation se calcule sur le mauvais.
    const aDiminuer = biensADiminuer(data);
    if (aDiminuer.length && !(opts && opts.reserves || []).includes('immos')) out.push({
      id: 'immobilisations-avoir', level: 'warn',
      label: `${aDiminuer.length === 1 ? 'Un bien garde' : `${aDiminuer.length} biens gardent`} son montant d'avant l'avoir du fournisseur`,
      detail: aDiminuer.map(b => `${b.label} : ${fmt(b.montant)} sur la fiche, ${fmt(b.attendu)} après l'avoir`).join(' · ') + '. Corrige la valeur sur la fiche du bien : l\'amortissement se calcule dessus.',
      count: aDiminuer.length, route: '#/immo/' + aDiminuer[0].assetId, docs: []
    });
    // Lignes d'achat marquées « immobilisation » sans fiche : sans elles, aucune dotation n'est calculée
    // et le résultat de l'année est faussement bon (3.5.0).
    const toImmo = assetsToCreate(data);
    if (toImmo.length) {
      const montantImmo = fmt(round3(toImmo.reduce((sum, x) => sum + x.amount, 0)));
      // « Tant que la fiche manque, rien n'est déduit » est vrai quand on PEUT créer la fiche. Quand
      // l'offre ferme le module, c'est faux — et c'est un reproche adressé à quelqu'un à qui on n'a
      // rien offert (7.20.0). La ligne d'achat part au cabinet dans les écritures, au compte 22, et
      // c'est LUI qui crée la fiche depuis la 9.7.0 : rien n'est perdu, et l'app doit le dire.
      const immoFerme = (opts && opts.reserves || []).includes('immos');
      out.push({
        id: 'immobilisations', level: 'info',
        label: `${toImmo.length} achat${toImmo.length > 1 ? 's' : ''} à immobiliser`,
        detail: immoFerme
          ? `${montantImmo} achetés en immobilisation. Ton comptable les voit dans les écritures du paquet et établit leur plan d'amortissement : tu n'as rien à faire.`
          : `${montantImmo} achetés en immobilisation sans plan d'amortissement. Tant que la fiche manque, rien n'est déduit.`,
        count: toImmo.length, route: '#/immos', docs: []
      });
    }
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
    // Une échéance du calendrier qui rappelle une déclaration déjà annoncée plus haut (« déclarations
    // sociales à déposer ») ne se compte pas deux fois (10.12.0).
    const annoncees = new Set(soc.map(x => x.id));
    const fisc = upcomingFiscal(data, t, 14).filter(x => !(x.socialId && annoncees.has(x.socialId)));
    if (fisc.length) out.push({
      id: 'fiscal', level: fisc[0].days <= 5 ? 'warn' : 'info',
      label: `${fisc.length} échéance${fisc.length > 1 ? 's' : ''} fiscale${fisc.length > 1 ? 's' : ''} sous 15 jours`,
      detail: fisc.map(x => `${x.label} le ${fmtDate(x.date)}`).join(' · '),
      count: fisc.length, route: '#/compta', docs: []
    });

    // Deux lignes, pas une. La ligne unique comptait TOUS les brouillons — devis compris — et son
    // seul bouton ouvrait la liste des FACTURES filtrée sur « brouillon », où un devis ne peut pas
    // figurer : le rappel existait, et menait à une liste où la pièce annoncée était invisible.
    // La règle du projet : un compteur et la liste qu'il annonce se calculent avec la même fonction.
    const vieux = d => d.status === 'brouillon' && d.date && daysBetween(d.date, t) > 7;
    const draftInv = (data.documents || []).filter(d => vieux(d) && d.type !== 'devis');
    if (draftInv.length) out.push({
      id: 'brouillons', level: 'info', label: `${draftInv.length} brouillon${draftInv.length > 1 ? 's' : ''} de facture de plus de 7 jours`,
      detail: 'Un brouillon oublié, c\'est un travail non facturé.',
      count: draftInv.length, route: '#/factures', docs: draftInv
    });
    // Un devis en brouillon est plus insidieux : il porte déjà son numéro (attribué au premier
    // enregistrement), son PDF est indiscernable d'un devis envoyé, et tant qu'il reste brouillon
    // SkanFact ne le relance pas, ne le compte pas dans le taux de transformation, et ne le déclare
    // jamais expiré. Un devis parti par WhatsApp ou remis en main propre reste donc invisible.
    const draftQuotes = (data.documents || []).filter(d => vieux(d) && d.type === 'devis');
    if (draftQuotes.length) out.push({
      id: 'devis-brouillons', level: 'info', label: `${draftQuotes.length} devis en brouillon de plus de 7 jours`,
      detail: 'Tant qu\'un devis est en brouillon, il n\'est ni relancé, ni compté, ni jamais déclaré expiré. Si tu l\'as envoyé autrement (WhatsApp, main propre), passe-le à « envoyé ».',
      count: draftQuotes.length, route: '#/devis', docs: draftQuotes
    });

    // La copie de sauvegarde, quand c'est la seule étape de démarrage qui manque. Elle quitte alors
    // le panneau « Tes premiers pas » (qui disparaît) pour devenir une ligne ordinaire : c'est
    // l'étape que tout le monde saute, et la seule dont l'absence coûte tout.
    const pas = firstSteps(data, company, opts || {});
    if (pas.sauvegardeSeule) out.push({
      id: 'sauvegarde', level: 'warn', label: 'Tes données ne sont copiées nulle part',
      detail: 'Un disque qui lâche, un ordinateur volé, et tout est perdu. Une copie automatique vers iCloud ou OneDrive, un disque ou une clé USB prend deux minutes à mettre en place.',
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

    // Le JUMEAU côté achats (10.1.0). Un achat n'avait aucune devise avant cette version : ceux qui
    // en reçoivent une sans taux tombent dans le même trou, en pire — la TVA DÉDUCTIBLE part alors
    // fausse dans une déclaration qu'on ne refait pas. Une ligne à part, parce que le geste qui la
    // règle n'est pas au même endroit (règle 7.15.0 : ce qu'un écran nomme, il doit l'ouvrir).
    const achatsSansTaux = (data.purchases || []).filter(p => missingRate(p, company));
    if (achatsSansTaux.length) out.push({
      id: 'taux-achat', level: 'danger',
      label: `${plFr(achatsSansTaux.length, 'achat')} en devise sans taux de change`,
      detail: 'Tant que le taux manque, ces montants comptent comme des dinars : ta TVA déductible et tes charges sont fausses.',
      count: achatsSansTaux.length, route: '#/achats', purchases: achatsSansTaux
    });

    // Les avoirs et les acomptes qui n'ont pas trouvé leur facture (10.2.0). Un avoir non imputé est
    // de l'argent qu'on a déjà, un acompte non imputé est de l'argent déjà sorti : les deux sont
    // justes tant que la facture n'est pas arrivée, et faux le jour où elle est payée en entier.
    // Rien à l'écran ne le disait — d'où la ligne, avec le geste qui la règle.
    const nonImputes = (data.purchases || []).filter(p => aRattacherAchat(p, company, data));
    if (nonImputes.length) out.push({
      id: 'achat-impute', level: 'warn',
      label: `${plFr(nonImputes.length, 'pièce')} fournisseur à rattacher à sa facture`,
      detail: 'Un avoir ou un acompte qui ne pointe aucune facture ne vient en déduction de rien : tu risques de payer deux fois.',
      count: nonImputes.length, route: '#/achats', purchases: nonImputes
    });

    // Les licences que l'ÉDITEUR a émises et qui finissent dans les trente jours — sur son poste
    // seulement (`opts.editeur` : la clé privée existe sur cet ordinateur). Chez un client, cette
    // liste est vide et la ligne n'existe pas : elle parlerait de licences qu'il n'a pas émises.
    const editeurIci = (opts || {}).editeur;
    // Ce qui suit l'émission d'une licence, dans l'ordre où ça coûte cher (8.2.0). Une clé signée
    // est un produit livré : tant qu'elle n'est pas partie, un client paie et attend ; tant que la
    // facture est un brouillon, la vente n'existe ni pour la TVA ni pour le journal ; tant qu'elle
    // n'est pas réglée, c'est un client qui a le produit et pas l'éditeur l'argent. Aucune de ces
    // trois lignes ne se voyait nulle part.
    const licSuite = editeurIci ? licencesAFaire(data, company, t) : { jamaisEnvoyees: [], nonFacturees: [], impayees: [], expirant: [] };
    if (licSuite.jamaisEnvoyees.length) out.push({
      id: 'licences-a-envoyer', level: 'bad',
      label: `${plFr(licSuite.jamaisEnvoyees.length, 'clé de licence', 'clés de licence')} jamais ${licSuite.jamaisEnvoyees.length > 1 ? 'envoyées' : 'envoyée'}`,
      detail: 'La clé est signée mais n\'a jamais quitté cet ordinateur : le client l\'attend, et il a peut-être déjà payé. « Envoyer la clé par email » depuis la page Licences.',
      count: licSuite.jamaisEnvoyees.length, route: '#/licences', docs: []
    });
    if (licSuite.nonFacturees.length) out.push({
      id: 'licences-sans-facture', level: 'bad',
      label: `${plFr(licSuite.nonFacturees.length, 'licence')} dont la facture est restée en brouillon`,
      detail: 'Un brouillon n\'a pas de numéro : cette vente n\'entre ni dans ton journal, ni dans ta TVA, ni dans le dossier du comptable. Ouvre la facture et émets-la.',
      count: licSuite.nonFacturees.length, route: '#/licences', docs: []
    });
    if (licSuite.impayees.length) out.push({
      id: 'licences-impayees', level: 'warn',
      label: `${plFr(licSuite.impayees.length, 'licence')} ${licSuite.impayees.length > 1 ? 'livrées' : 'livrée'} et pas encore ${licSuite.impayees.length > 1 ? 'payées' : 'payée'}`,
      detail: 'Le client a sa clé, elle fonctionne, et la facture n\'est pas réglée. C\'est le cas qui coûte : une licence hors ligne ne se reprend pas.',
      count: licSuite.impayees.length, route: '#/licences', docs: []
    });
    // L'export de la base de la console (10.4.0). C'est la SEULE chose dont la disparition ne se
    // rattrape pas : la base D1 est le seul endroit où vit « qui a acheté quelle clé », et sans
    // elle aucune licence vendue ne peut plus être renvoyée, renouvelée ni révoquée. Décidé avant
    // la première vente (QUESTIONS.md, 4e relecture) ; la ligne ne vit que sur le poste de
    // l'éditeur, comme les quatre du dessus.
    if (editeurIci) {
      const ex = exportConsoleAFaire(data, t);
      if (ex.reclame) out.push({
        id: 'console-export', level: ex.du ? 'warn' : 'danger',
        label: ex.du ? `La base de la console n'a pas été exportée depuis ${plFr(ex.jours, 'jour')}` : 'La base de la console n\'a jamais été exportée',
        detail: 'Un export la range en un fichier dans ~/.skanfact/. Sans lui, une base perdue emporte toutes les ventes : plus aucune clé vendue ne peut être renvoyée ni révoquée. Paramètres → L\'application → Éditeur.',
        count: 1, route: '#/licences'
      });
    }

    const licExp = licSuite.expirant;
    if (licExp.length) out.push({
      id: 'licences-expirent', level: 'warn',
      label: `${plFr(licExp.length, 'licence')} ${licExp.length > 1 ? 'expirent' : 'expire'} dans les ${LICENCE_PREAVIS} jours`,
      detail: 'Renouveler, c\'est une facture de plus — et un client qui n\'est pas interrompu. Chaque ligne se renouvelle en un clic depuis la page Licences.',
      count: licExp.length, route: '#/licences', docs: []
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
    // Le RIB ne manque que si on attend un virement (7.22.0). Voir `ribAttendu` : un commerce, un
    // restaurant ou un salon encaissent sur place.
    if (ribAttendu(c) && !(c.rib || '').trim()) out.push('le RIB');
    // Un RIB PRÉSENT et faux manque autant qu'un RIB absent (rapport QA, 10.12.0) : juger sur la
    // seule présence faisait écrire « tes documents sont en règle » sur un RIB de dix chiffres —
    // la faute du matricule inventé de la 7.6.0, un champ plus loin.
    else if (ribAttendu(c) && !verifRib(c.rib).ok) out.push(`un RIB valide (${verifRib(c.rib).court})`);
    return out;
  }

  // Un RIB tunisien : 20 chiffres (banque 2, agence 3, compte 13, clé 2), et la clé fait des vingt
  // chiffres, pris comme un nombre, un multiple de 97 — c'est ce qui donne « TN59 » à TOUS les IBAN
  // tunisiens (règle vérifiée sur un RIB publié, 07040005810111129653). Un IBAN, tunisien ou non, se
  // vérifie par la règle ISO 13616 : reste 1 modulo 97. Rend une raison COURTE (pour une étiquette)
  // et une phrase. On AVERTIT, on ne refuse jamais : un compte à l'étranger peut avoir une forme
  // qu'on ne connaît pas, et « l'assistant prévient lui-même qu'une erreur ici, c'est un paiement qui
  // n'arrive jamais » — encore fallait-il le vérifier quelque part.
  function verifRib(valeur) {
    const v = String(valeur || '').replace(/[\s.\-]/g, '').toUpperCase();
    if (!v) return { ok: true, vide: true };
    const reste97 = chiffres => { let r = 0; for (const ch of chiffres) r = (r * 10 + Number(ch)) % 97; return r; };
    if (/^\d+$/.test(v)) {
      if (v.length !== 20) return { ok: false, court: `${v.length} chiffres sur 20`, raison: `Un RIB tunisien compte 20 chiffres ; celui-ci en a ${v.length}.` };
      if (reste97(v) !== 0) return { ok: false, court: 'clé incorrecte', raison: 'Les deux derniers chiffres du RIB (sa clé) ne correspondent pas aux dix-huit premiers : une faute de frappe, probablement.' };
      return { ok: true };
    }
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(v)) {
      if (v.startsWith('TN') && v.length !== 24) return { ok: false, court: `${v.length} caractères sur 24`, raison: `Un IBAN tunisien compte 24 caractères (TN59 puis les 20 chiffres du RIB) ; celui-ci en a ${v.length}.` };
      const deplace = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
      if (reste97(deplace) !== 1) return { ok: false, court: 'IBAN incorrect', raison: 'La clé de cet IBAN ne correspond pas à ses chiffres : une faute de frappe, probablement.' };
      return { ok: true, iban: true };
    }
    return { ok: false, court: 'ni RIB ni IBAN', raison: 'Un RIB tunisien s\'écrit en 20 chiffres, un IBAN commence par le code de son pays (TN59…).' };
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
  // 10.12.0 — une prestation ne compte que si l'utilisateur l'a DÉCIDÉE : créée par lui, ou
  // enregistrée par lui (`catalogForm` retire alors `fromSetup`). La règle d'avant — « un prix
  // non nul suffit » — supposait que l'assistant pose des prix à 0 ; or les quinze métiers
  // proposent tous des prix d'exemple (« Main-d'œuvre » à 20 DT pour l'artisanat) : l'étape se
  // cochait donc toute seule, pour TOUT le monde, à la seconde où l'assistant se refermait. C'est
  // le défaut que la 7.18.0 croyait avoir corrigé — le test prenait « un prix posé » pour « un prix
  // ajusté », deux choses que les données ne distinguaient pas.
  function catalogueStep(d) {
    const cat = d.catalog || [];
    const exemples = cat.filter(c => c.fromSetup);
    const propre = cat.some(c => !c.fromSetup);
    if (cat.length && !propre) {
      const sansPrix = exemples.filter(c => !(Number(c.unitPrice) > 0)).length;
      return { id: 'catalogue', titre: 'Ajuster les prix de ton catalogue', fait: false,
        quoi: `L'assistant t'a proposé ${cat.length} prestation${cat.length > 1 ? 's' : ''}`
          + (sansPrix ? `, dont ${sansPrix} sans prix` : '')
          + ` : ce sont des exemples, pas tes tarifs. Ouvre-en une, mets ton prix et enregistre : elle devient la tienne.`,
        action: 'catalogue' };
    }
    return { id: 'catalogue', titre: 'Remplir ton catalogue', fait: propre,
      quoi: 'Ce que tu vends, avec son prix et sa TVA. Une ligne de devis se choisit alors dans une liste au lieu d\'être retapée.',
      action: 'catalogue' };
  }

  // ---------- « Ta facture à ton image » (10.14.0) ----------
  //
  // Le logo, le cachet et les deux couleurs se réglaient dans les Paramètres, et la page disait
  // « pour les voir, ouvre un document » : on choisissait une couleur à l'aveugle, puis on allait
  // chercher un devis pour voir ce qu'elle donnait. Ce qui suit est pur : la couleur se JUGE sur la
  // page blanche où elle s'imprime, et l'étape des premiers pas se lit dans la fiche société.
  //
  // Le contraste d'une couleur sur le blanc du papier (rapport WCAG, de 1 à 21). La couleur PRINCIPALE
  // est celle de TOUT le texte du document ; l'accent colore le numéro, les titres de rubrique et
  // « Net à payer ». Un jaune vif y serait illisible — sur la pièce qu'on envoie à son client.
  function contrasteSurBlanc(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex == null ? '' : hex).trim());
    if (!m) return null;
    const v = parseInt(m[1], 16);
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
    return Math.round((1.05 / (L + 0.05)) * 100) / 100;
  }
  // Les seuils : 4,5 pour un texte courant, 3 pour un texte en gras ou en capitales (WCAG AA) — c'est
  // exactement ce que l'accent colore. On PRÉVIENT, on n'interdit pas : c'est son papier.
  const LISIBLE = { primaryColor: 4.5, accentColor: 3 };
  function lisibiliteMarque(co) {
    const c = co || {};
    const out = [];
    const p = contrasteSurBlanc(c.primaryColor || DEFAULT_COMPANY.primaryColor);
    // `court` se lit dans la ligne du titre de la couleur (il ne pousse rien) ; `texte` l'explique.
    const court = 'Trop claire pour être lue';
    if (p != null && p < LISIBLE.primaryColor) out.push({ champ: 'primaryColor', rapport: p, court, texte: 'Ta couleur principale est très claire : c\'est celle de tout le texte de tes documents, et sur une page blanche il se lirait mal.' });
    const a = contrasteSurBlanc(c.accentColor || DEFAULT_COMPANY.accentColor);
    if (a != null && a < LISIBLE.accentColor) out.push({ champ: 'accentColor', rapport: a, court, texte: 'Ta couleur d\'accent est très claire : le numéro de la pièce, les titres de rubrique et « Net à payer » se liraient mal sur une page blanche.' });
    return out;
  }
  // Un nuancier PROPOSÉ, jamais imposé (le sélecteur de couleur reste là pour tout le reste) : chaque
  // teinte se lit sur le blanc — un test le vérifie, sinon la proposition ferait le défaut qu'elle évite.
  const ACCENTS_PROPOSES = [
    { nom: 'Vert d\'eau', hex: '#0f9d8f' }, { nom: 'Bleu', hex: '#2563eb' }, { nom: 'Indigo', hex: '#4f46e5' },
    { nom: 'Vert', hex: '#15803d' }, { nom: 'Ambre', hex: '#b45309' }, { nom: 'Brique', hex: '#b91c1c' },
    { nom: 'Prune', hex: '#86198f' }, { nom: 'Ardoise', hex: '#334155' }
  ];
  // Une image de marque POSÉE : un logo, un cachet, ou une couleur qui n'est plus celle d'origine.
  // Se lit dans la fiche — une étape qu'on cocherait soi-même mentirait (7.0.0).
  function marquePersonnalisee(co) {
    const c = co || {};
    const autre = (v, def) => !!String(v || '').trim() && String(v).trim().toLowerCase() !== def.toLowerCase();
    return !!(String(c.logo || '').trim() || String(c.stampImage || '').trim()
      || autre(c.accentColor, DEFAULT_COMPANY.accentColor) || autre(c.primaryColor, DEFAULT_COMPANY.primaryColor));
  }

  function firstSteps(data, company, opts) {
    const d = data || {};
    const o = opts || {};
    const docs = d.documents || [];
    const devis = docs.filter(x => x.type === 'devis');
    const gaps = companyGaps(company);
    const facturesEmises = docs.filter(x => x.type === 'facture' && x.status !== 'brouillon');
    const unPaiement = docs.some(x => (x.payments || []).length);

    const cab = (company && company.cabinet) || {};
    const comptableRelie = !!(cab.publicKey || String((company && company.accountantEmail) || '').trim());
    const etapes = [
      // La découverte (10.14.0). Faite, elle compte : la liste démarre à « 1 sur n », et une liste
      // déjà commencée se termine bien plus souvent qu'une liste à zéro. Pas faite, elle reste
      // proposée sans jamais passer devant une étape du métier (`facultatif`) : elle n'est pas un
      // devoir, et quelqu'un qui connaît déjà la facturation ne doit pas la voir en tête de liste.
      { id: 'decouverte', titre: 'Découvrir SkanFact avec l\'exemple', fait: !!o.decouverte, facultatif: true,
        quoi: o.decouverte
          ? 'Tu as fait le tour, sur une entreprise d\'exemple de cinq ans : tu sais où est chaque chose.'
          : 'Le grand tour sur une entreprise d\'exemple de cinq ans : chaque page remplie, sans rien risquer. Tes données sont mises de côté pendant ce temps.',
        action: 'decouverte' },
      { id: 'societe', titre: 'Compléter ta fiche société', fait: !gaps.length,
        quoi: gaps.length
          ? `Il manque ${liste(gaps)}. Ces informations s'impriment en haut de chaque document, et une facture sans matricule fiscal n'est pas conforme.`
          : 'Raison sociale, matricule fiscal et RIB sont renseignés : tes documents sont en règle.',
        action: 'societe' },
      // Ta facture à ton image (10.14.0) : juste après la fiche société, parce que c'est la même
      // question — ce qui s'imprime en haut de chaque pièce. Facultative : une facture sans logo est
      // une facture en règle, et l'étape ne passe jamais devant une étape du métier.
      { id: 'marque', titre: 'Ta facture à ton image', fait: marquePersonnalisee(company), facultatif: true,
        quoi: marquePersonnalisee(company)
          ? 'Ton logo et tes couleurs habillent chaque devis et chaque facture.'
          : 'Ton logo, ton cachet et ta couleur sur chaque devis et chaque facture — tu vois le résultat sur une vraie facture avant d\'enregistrer.',
        action: 'marque' },
      { id: 'client', titre: 'Enregistrer ton premier client', fait: (d.clients || []).length > 0,
        quoi: 'Son adresse et son matricule se reporteront tout seuls sur chaque devis et chaque facture.',
        action: 'client' },
      // Une étape ne peut pas se cocher parce que l'ASSISTANT l'a faite. Il propose les prestations
      // du métier avec des prix à 0 ; tant que le catalogue n'est que celui-là et qu'il reste des
      // zéros, il n'y a pas de catalogue — il y a des exemples. L'étape change alors de titre.
      catalogueStep(d),
      { id: 'devis', titre: 'Faire ton premier devis', fait: devis.length > 0,
        quoi: 'Un devis annonce un prix avant de travailler. C\'est la pièce par laquelle presque tout commence.',
        action: 'devis' },
      // La copie de sécurité vient JUSTE APRÈS le premier devis (10.14.0). Elle était le dernier écran
      // de l'assistant, avant qu'il existe quoi que ce soit à copier : une question abstraite, qu'on
      // passait. Après le premier devis, elle protège quelque chose de réel — c'est le moment où l'on
      // accepte de prendre deux minutes pour elle.
      // Un dossier PARTAGÉ vit déjà hors de cet ordinateur : l'étape est faite, et elle le DIT — sans
      // quoi elle menait à un panneau où le bouton « Choisir un dossier » est caché exprès.
      { id: 'sauvegarde', titre: 'Mettre tes données à l\'abri', fait: !!o.copieExterne || !!o.partage,
        quoi: o.partage && !o.copieExterne
          ? 'Ce dossier est partagé : il vit déjà hors de cet ordinateur, et c\'est cette copie-là que les deux postes ouvrent.'
          : 'Une copie automatique vers iCloud ou OneDrive, un disque ou une clé USB. C\'est l\'étape que tout le monde saute, et la seule dont l\'absence coûte tout.',
        action: 'sauvegarde' },
      { id: 'envoi', titre: 'L\'envoyer à ton client', fait: devis.some(x => x.status && x.status !== 'brouillon'),
        quoi: 'Ouvre le devis, puis « Envoyer » : le PDF part en pièce jointe. Tant qu\'un devis reste en brouillon, SkanFact ne le compte nulle part.',
        action: devis.length ? 'envoiDevis' : null },
      { id: 'facture', titre: 'Transformer un devis accepté en facture', fait: facturesEmises.length > 0,
        quoi: 'En un clic, sans rien ressaisir. C\'est à ce moment-là que le numéro est attribué et que la pièce se verrouille.',
        action: 'factures' },
      // Le comptable (10.14.0) : son adresse suffit pour lui envoyer le paquet du mois ; son fichier
      // d'appairage, s'il a SkanFact Cabinet, chiffre ce paquet pour lui seul. Facultatif : certains
      // n'en ont pas encore, et ce n'est pas à nous de décider qu'ils en ont besoin.
      { id: 'comptable', titre: 'Relier ton comptable', fait: comptableRelie, facultatif: true,
        quoi: comptableRelie
          ? (cab.publicKey ? `Tes paquets partent chiffrés pour ${cab.name || 'ton cabinet'}.` : 'Son adresse est enregistrée : « Envoyer au comptable » s\'en sert.')
          : 'Son adresse, et son fichier d\'appairage s\'il utilise SkanFact Cabinet : chaque mois, le paquet de tes pièces part en deux clics, sans rien ressaisir de son côté.',
        action: 'comptable' }
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
    // Les étapes FACULTATIVES (la découverte, le comptable) ne retiennent pas le panneau : un panneau
    // qui ne disparaîtrait jamais parce qu'on n'a pas de comptable serait le panneau qu'on apprend à
    // ne plus lire.
    const metier = etapes.filter(x => x.id !== 'sauvegarde' && !x.facultatif);
    const demarrage = metier.some(x => !x.fait);
    // L'étape SUIVANTE, calculée ici une fois pour l'accueil, la jauge de fin de visite et « Me
    // guider » : la première qui n'est ni faite ni facultative. Trois endroits qui la recalculaient
    // chacun avec `find(e => !e.fait)` auraient proposé « découvrir l'exemple » à quelqu'un qui vient
    // de refuser la découverte, en tête et en vert, devant sa fiche société.
    const suivante = etapes.find(x => !x.fait && !x.facultatif) || null;
    return { etapes, faits, total: etapes.length, fini: faits === etapes.length, demarrage, suivante,
      sauvegardeSeule: !demarrage && !etapes.find(x => x.id === 'sauvegarde').fait };
  }

  // Les RÉUSSITES (10.14.0) : les premières fois qui comptent dans la vie d'une entreprise sur
  // SkanFact — le premier devis envoyé, la première facture émise, le premier paiement, le premier
  // paquet parti chez le comptable. Toutes DÉDUITES des données : une réussite qu'on cocherait soi-même
  // mentirait le jour où on l'a cochée par erreur (7.0.0). L'hôte ne les montre jamais sur l'exemple :
  // celles d'une entreprise inventée ne sont pas les tiennes.
  function reussites(data, company, opts) {
    const d = data || {};
    const o = opts || {};
    const docs = d.documents || [];
    const emise = x => x.number && x.status !== 'brouillon';
    const liste = [
      { id: 'fiche', titre: 'Fiche société complète', quoi: 'Tes pièces portent tout ce qu\'une pièce officielle doit porter.', fait: !companyGaps(company).length },
      { id: 'client', titre: 'Premier client', quoi: 'Ses coordonnées se reportent toutes seules sur chaque pièce.', fait: (d.clients || []).length > 0 },
      { id: 'devis', titre: 'Premier devis envoyé', quoi: 'Un prix annoncé avant de travailler : c\'est ainsi que presque tout commence.', fait: docs.some(x => x.type === 'devis' && x.status && x.status !== 'brouillon') },
      { id: 'facture', titre: 'Première facture émise', quoi: 'Numérotée, verrouillée, comptée dans ton chiffre d\'affaires et ta TVA.', fait: docs.some(x => x.type === 'facture' && emise(x)) },
      { id: 'paiement', titre: 'Premier paiement encaissé', quoi: 'La facture s\'est soldée toute seule, et l\'argent est arrivé dans ta trésorerie.', fait: docs.some(x => (x.payments || []).length > 0) },
      { id: 'achat', titre: 'Premier achat saisi', quoi: 'La TVA que tu récupères commence à compter.', fait: (d.purchases || []).length > 0 },
      { id: 'abri', titre: 'Données à l\'abri', fait: !!o.copieExterne || !!o.partage,
        quoi: o.partage && !o.copieExterne ? 'Ton dossier partagé vit hors de cet ordinateur.' : 'Une copie automatique vit hors de cet ordinateur.' },
      { id: 'comptable', titre: 'Premier paquet au comptable', quoi: 'Ton comptable a reçu ton mois, déjà écrit : zéro ressaisie.', fait: (d.packs || []).length > 0 },
      { id: 'cloture', titre: 'Premier mois clôturé', quoi: 'Un mois déclaré, et qui ne bougera plus.', fait: !!d.closedUntil }
    ];
    return { liste, faites: liste.filter(x => x.fait).length, total: liste.length };
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
    // Une facture de licence (7.33.0) dit quelle clé elle a portée : la ligne renvoie à la page
    // Licences de l'éditeur, où la clé se copie et se renvoie.
    if (doc.licenceId) {
      const lic = (data.licences || []).find(l => l.id === doc.licenceId);
      ev.push({ date: doc.date, kind: 'licence', label: `Porte la licence n° ${doc.licenceId}`,
        detail: lic ? `${lic.offre === 'independant' ? 'Indépendant' : 'Entreprise'}${lic.exp ? ', jusqu\'au ' + fmtDate(lic.exp) : ', à vie'}` : 'licence introuvable dans l\'historique' });
    }
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
      const what = inv.deposit ? `Facture d'acompte ${acompteDit(inv.deposit, inv.currency)}` : inv.settles ? 'Facture de solde' : 'Facture';
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
      ev.push({ date: p.date, kind: 'paiement', label: estRemboursement(p) ? `Remboursement au client de ${money(-p.amount, doc.currency || company.currency)}` : `Paiement de ${money(p.amount, doc.currency || company.currency)}`, detail: [m ? m[1] : p.method, p.reference].filter(Boolean).join(' · ') });
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
    facture: { subject: 'Facture {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre facture {numero}, d\'un montant net à payer de {montant}, à régler avant le {echeance}.\n\nMerci de votre confiance.\n\nCordialement,\n{societe}' },
    avoir: { subject: 'Avoir {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint l\'avoir {numero} ({montant}) relatif à la facture {reference}.\n\nCordialement,\n{societe}' },
    relance1: { subject: 'Rappel — facture {numero}', body: 'Bonjour,\n\nSauf erreur de notre part, la facture {numero} ({montant}) arrivée à échéance le {echeance} reste en attente de règlement.\nSi le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.\n\nCordialement,\n{societe}' },
    relance2: { subject: 'Relance — facture {numero} en retard de {jours} jours', body: 'Bonjour,\n\nNotre facture {numero} d\'un montant de {montant}, échue le {echeance}, n\'a pas été réglée à ce jour ({jours} jours de retard).\nMerci de procéder au règlement dans les meilleurs délais ou de nous indiquer la date prévue.\n\nCordialement,\n{societe}' },
    relance3: { subject: 'Dernière relance — facture {numero}', body: 'Bonjour,\n\nMalgré nos précédents rappels, la facture {numero} ({montant}, échue le {echeance}) reste impayée après {jours} jours.\nSans règlement sous 8 jours, nous serons contraints d\'engager une procédure de recouvrement.\n\nCordialement,\n{societe}' },
    relanceDevis: { subject: 'Notre devis {numero} — {objet}', body: 'Bonjour,\n\nNous vous avons adressé le devis {numero} ({montant} TTC) concernant : {objet}.\nAvez-vous pu l\'examiner ? Nous restons disponibles pour en discuter ou l\'ajuster si besoin.\n\nCordialement,\n{societe}' },
    comptable: { subject: 'Comptabilité {objet} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint le journal des ventes de {objet} : {numero} documents, {montant} de chiffre d\'affaires hors taxes.\n\nJe reste à votre disposition pour tout complément.\n\nCordialement,\n{societe}' },
    proforma: { subject: 'Facture proforma {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre facture proforma {numero} d\'un montant de {montant}, concernant : {objet}.\nCe document est établi pour vos démarches : il n\'a pas de valeur comptable et sera suivi d\'une facture définitive.\n\nCordialement,\n{societe}' },
    commande: { subject: 'Bon de commande {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint le bon de commande {numero} ({montant} TTC) reprenant votre demande concernant : {objet}.\nMerci de nous le retourner daté et signé pour que nous lancions l\'exécution.\n\nCordialement,\n{societe}' },
    livraison: { subject: 'Bon de livraison {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint le bon de livraison {numero} concernant : {objet}.\nMerci de nous le retourner signé après réception.\n\nCordialement,\n{societe}' },
    contrat: { subject: 'Contrat de prestation {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre contrat de prestation {numero} concernant : {objet}.\nAprès lecture, merci de nous le retourner daté, signé et revêtu de votre cachet.\n\nNous restons à votre disposition pour en discuter les termes.\n\nCordialement,\n{societe}' },
    // La clé de licence envoyée par l'éditeur de SkanFact à son client (7.33.0). `{cle}` est la
    // chaîne « SKAN1.… », `{offre}` et `{fin}` viennent de la licence, `{facture}` est la phrase
    // « Votre facture N est jointe… » — présente SEULEMENT quand la pièce part vraiment avec.
    licence: { subject: 'Votre licence SkanFact — {offre}', body: 'Bonjour,\n\nVoici votre clé de licence SkanFact ({offre}{fin}) :\n\n{cle}\n\nPour l\'activer : dans SkanFact, ouvrez Paramètres → L\'application → Licence, collez la clé en entier (de « SKAN1. » jusqu\'au dernier caractère) et cliquez sur « Enregistrer la clé ». Aucune connexion n\'est nécessaire.\n\n{facture}Merci de votre confiance.\n\nCordialement,\n{societe}' },
    // 9.4.1 — la clé d'un CABINET se colle dans SkanFact Cabinet, pas dans SkanFact : le chemin
    // d'activation est celui de ses Réglages, et `{quota}` remplace l'offre. La console
    // (`mailLicence`) écrit la même phrase, et un test les compare.
    licenceCabinet: { subject: 'Votre licence SkanFact Cabinet — {quota}', body: 'Bonjour,\n\nVoici votre clé de licence SkanFact Cabinet ({quota} hors SkanFact en plus des trois gratuits{fin}) :\n\n{cle}\n\nPour l\'activer : dans SkanFact Cabinet, ouvrez Réglages → Mon cabinet → Licence, collez la clé en entier (de « SKAN1. » jusqu\'au dernier caractère) et cliquez sur « Enregistrer la clé ». Aucune connexion n\'est nécessaire.\n\n{facture}Merci de votre confiance.\n\nCordialement,\n{societe}' }
  };

  const DEFAULT_EMAIL_TEMPLATES_EN = {
    devis: { subject: 'Quote {numero} — {societe}', body: 'Hello,\n\nPlease find attached our quote {numero} ({montant} incl. VAT) for: {objet}.\nIt is valid until {echeance}.\n\nWe remain at your disposal for any question.\n\nBest regards,\n{societe}' },
    facture: { subject: 'Invoice {numero} — {societe}', body: 'Hello,\n\nPlease find attached our invoice {numero} for {montant}, due by {echeance}.\n\nThank you for your trust.\n\nBest regards,\n{societe}' },
    avoir: { subject: 'Credit note {numero} — {societe}', body: 'Hello,\n\nPlease find attached credit note {numero} ({montant}) related to invoice {reference}.\n\nBest regards,\n{societe}' },
    relance1: { subject: 'Reminder — invoice {numero}', body: 'Hello,\n\nUnless we are mistaken, invoice {numero} ({montant}) due on {echeance} is still awaiting payment.\nIf you have already paid, please disregard this message.\n\nBest regards,\n{societe}' },
    relance2: { subject: 'Second reminder — invoice {numero} is {jours} days overdue', body: 'Hello,\n\nOur invoice {numero} for {montant}, due on {echeance}, remains unpaid ({jours} days overdue).\nPlease proceed with payment as soon as possible or let us know the expected date.\n\nBest regards,\n{societe}' },
    relance3: { subject: 'Final reminder — invoice {numero}', body: 'Hello,\n\nDespite our previous reminders, invoice {numero} ({montant}, due on {echeance}) remains unpaid after {jours} days.\nWithout payment within 8 days, we will have to start a recovery procedure.\n\nBest regards,\n{societe}' },
    relanceDevis: { subject: 'Our quote {numero} — {objet}', body: 'Hello,\n\nWe sent you quote {numero} ({montant} incl. VAT) for: {objet}.\nHave you had a chance to review it? We remain available to discuss or adjust it.\n\nBest regards,\n{societe}' },
    comptable: { subject: 'Accounting {objet} — {societe}', body: 'Hello,\n\nPlease find attached the sales journal for {objet}.\n\nBest regards,\n{societe}' },
    // L'interface de SkanFact est en français : le mail anglais cite les libellés RÉELS des menus,
    // avec leur traduction — un client anglophone doit pouvoir les retrouver à l'écran.
    licence: { subject: 'Your SkanFact licence — {offre}', body: 'Hello,\n\nHere is your SkanFact licence key ({offre}{fin}):\n\n{cle}\n\nTo activate it: in SkanFact, open « Paramètres → L\'application → Licence » (Settings → The application → Licence), paste the whole key (from "SKAN1." to the last character) and click « Enregistrer la clé » (Save the key). No internet connection is needed.\n\n{facture}Thank you for your trust.\n\nBest regards,\n{societe}' },
    licenceCabinet: { subject: 'Your SkanFact Cabinet licence — {quota}', body: 'Hello,\n\nHere is your SkanFact Cabinet licence key ({quota} outside SkanFact, on top of the three free ones{fin}):\n\n{cle}\n\nTo activate it: in SkanFact Cabinet, open « Réglages → Mon cabinet → Licence » (Settings → My firm → Licence), paste the whole key (from "SKAN1." to the last character) and click « Enregistrer la clé » (Save the key). No internet connection is needed.\n\n{facture}Thank you for your trust.\n\nBest regards,\n{societe}' }
  };
  // 10.14.1 (MR-09) — une profession libérale émet une NOTE D'HONORAIRES (7.22.0) : la pièce s'appelait
  // ainsi, et le mail qui l'emportait disait « Facture FAC-… » et « notre facture ». Mêmes phrases, le nom
  // de la pièce changé ; un modèle que la personne a RÉÉCRIT reste le sien (`modeleMail`).
  const MODELES_HONORAIRES = {
    facture: { subject: 'Note d\'honoraires {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre note d\'honoraires {numero}, d\'un montant net à payer de {montant}, à régler avant le {echeance}.\n\nMerci de votre confiance.\n\nCordialement,\n{societe}' },
    avoir: { subject: 'Avoir {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint l\'avoir {numero} ({montant}) relatif à la note d\'honoraires {reference}.\n\nCordialement,\n{societe}' },
    relance1: { subject: 'Rappel — note d\'honoraires {numero}', body: 'Bonjour,\n\nSauf erreur de notre part, la note d\'honoraires {numero} ({montant}) arrivée à échéance le {echeance} reste en attente de règlement.\nSi le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.\n\nCordialement,\n{societe}' },
    relance2: { subject: 'Relance — note d\'honoraires {numero} en retard de {jours} jours', body: 'Bonjour,\n\nNotre note d\'honoraires {numero} d\'un montant de {montant}, échue le {echeance}, n\'a pas été réglée à ce jour ({jours} jours de retard).\nMerci de procéder au règlement dans les meilleurs délais ou de nous indiquer la date prévue.\n\nCordialement,\n{societe}' },
    relance3: { subject: 'Dernière relance — note d\'honoraires {numero}', body: 'Bonjour,\n\nMalgré nos précédents rappels, la note d\'honoraires {numero} ({montant}, échue le {echeance}) reste impayée après {jours} jours.\nSans règlement sous 8 jours, nous serons contraints d\'engager une procédure de recouvrement.\n\nCordialement,\n{societe}' }
  };
  const MODELES_HONORAIRES_EN = {
    facture: { subject: 'Fee note {numero} — {societe}', body: 'Hello,\n\nPlease find attached our fee note {numero} for {montant}, due by {echeance}.\n\nThank you for your trust.\n\nBest regards,\n{societe}' },
    avoir: { subject: 'Credit note {numero} — {societe}', body: 'Hello,\n\nPlease find attached credit note {numero} ({montant}) related to fee note {reference}.\n\nBest regards,\n{societe}' },
    relance1: { subject: 'Reminder — fee note {numero}', body: 'Hello,\n\nUnless we are mistaken, fee note {numero} ({montant}) due on {echeance} is still awaiting payment.\nIf you have already paid, please disregard this message.\n\nBest regards,\n{societe}' },
    relance2: { subject: 'Second reminder — fee note {numero} is {jours} days overdue', body: 'Hello,\n\nOur fee note {numero} for {montant}, due on {echeance}, remains unpaid ({jours} days overdue).\nPlease proceed with payment as soon as possible or let us know the expected date.\n\nBest regards,\n{societe}' },
    relance3: { subject: 'Final reminder — fee note {numero}', body: 'Hello,\n\nDespite our previous reminders, fee note {numero} ({montant}, due on {echeance}) remains unpaid after {jours} days.\nWithout payment within 8 days, we will have to start a recovery procedure.\n\nBest regards,\n{societe}' }
  };
  // Les modèles par défaut de CETTE entreprise : ceux d'une profession libérale nomment sa pièce.
  function modelesParDefaut(company, en) {
    const base = en ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES;
    return estLiberal(company) ? { ...base, ...(en ? MODELES_HONORAIRES_EN : MODELES_HONORAIRES) } : base;
  }
  // Le modèle d'un envoi. Les Paramètres rangent TOUS les modèles, y compris ceux qu'on n'a pas touchés :
  // un modèle resté identique au texte d'origine n'est pas un choix, il suit le métier. Un modèle réécrit
  // à la main, même d'un seul mot, reste celui de la personne.
  function modeleMail(company, kind, en) {
    const co = company || {};
    const base = en ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES;
    const defs = modelesParDefaut(co, en);
    const perso = (en ? co.emailTemplatesEn : co.emailTemplates) || {};
    const k = defs[kind] ? kind : 'facture';
    const d = defs[k], b = base[k] || {}, p = perso[k] || {};
    const pick = f => (p[f] === undefined || p[f] === null || p[f] === b[f] || p[f] === d[f]) ? d[f] : p[f];
    return { subject: pick('subject'), body: pick('body') };
  }


  // `data` (10.14.1) : une RELANCE réclame ce qui reste dû, jamais le total — une facture de 1 190 DT
  // payée de 1 000 partait « d'un montant de 1 190,000 DT… n'a pas été réglée », au client qui venait
  // de verser 1 000. Et le montant s'écrit dans la langue du mail, comme sur le PDF joint : « 1,190.29
  // EUR » dans un mail anglais, jamais « 1 190,29 ».
  function emailFor(kind, doc, client, company, extra, data) {
    const en = (doc.lang || (client && client.lang) || company.defaultLang) === 'en';
    const tpl = modeleMail(company, kind, en);
    const t = computeTotals(doc, company);
    const cur = doc.currency || company.currency || 'DT';
    const relance = /^relance\d$/.test(kind) && doc.type === 'facture' && data;
    const du = relance ? invoiceBalance(doc, data, company).remaining : (doc.type === 'devis' ? t.totalTTC : t.netToPay);
    const vars = {
      numero: doc.number || 'brouillon', objet: doc.subject || '', client: (client || {}).name || '', societe: company.name,
      montant: money(du, cur, undefined, en ? 'en' : 'fr'), echeance: fmtDate(doc.dueDate), reference: doc.creditOfNumber || doc.reference || '',
      ...(extra || {})
    };
    const modele = sansObjetVide(vars);
    return { to: (client || {}).email || '', subject: fillTemplate(modele(tpl.subject), vars), body: fillTemplate(modele(tpl.body), vars) };
  }

  // L'objet d'une pièce est FACULTATIF, et le modèle l'écrivait quand même : « notre devis DEV-2026-001
  // (1 011,500 DT TTC) concernant : . » partait chez le client, et « Notre devis DEV-2026-001 — » en
  // objet d'une relance (10.14.0, vu en faisant le premier envoi d'une entreprise neuve). Quand l'objet
  // est vide, on retire la proposition qui le porte — dans le MODÈLE, avant de le remplir : un texte que
  // la personne a écrit elle-même ne se réécrit jamais, et un « concernant : » qu'elle aurait tapé en
  // dehors de `{objet}` reste le sien. Un `{objet}` posé ailleurs dans un modèle personnel devient vide,
  // comme avant.
  function sansObjetVide(vars) {
    const vide = !String((vars && vars.objet) || '').trim();
    return s => !vide ? s : String(s || '')
      .replace(/,?[ \t]*(?:reprenant votre demande[ \t]+)?concernant[ \t]*:[ \t]*\{objet\}/g, '')
      .replace(/[ \t]*for:[ \t]*\{objet\}/g, '')
      .replace(/[ \t]*—[ \t]*\{objet\}/g, '');
  }

  // ---------- montant en lettres (français) ----------

  const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  // « Quatre-vingts » et « deux cents » ne prennent leur s qu'en FIN de nombre (10.14.1, MR-08) : devant
  // « mille », adjectif numéral, ils restent au singulier — « quatre-vingt mille », « deux cent mille ».
  // Devant « million » et « milliard », qui sont des noms, ils le gardent. `fin` le dit.
  function below100(n, fin = true) {
    if (n < 20) return UNITS[n];
    const t = Math.floor(n / 10), u = n % 10;
    if (t === 7 || t === 9) {
      const rest = UNITS[10 + u];
      return TENS[t] + (u === 1 && t === 7 ? ' et ' : '-') + rest;
    }
    if (u === 0) return TENS[t] + (t === 8 && fin ? 's' : '');
    if (u === 1 && t !== 8) return TENS[t] + ' et un';
    return TENS[t] + '-' + UNITS[u];
  }

  function below1000(n, fin = true) {
    const h = Math.floor(n / 100), r = n % 100;
    let s = '';
    if (h === 1) s = 'cent';
    else if (h > 1) s = UNITS[h] + ' cent' + (r === 0 && fin ? 's' : '');
    if (r) s += (s ? ' ' : '') + below100(r, fin);
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
        else parts.push(below1000(q, val !== 1e3) + ' ' + (q > 1 ? plur : sing));
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
    // On compte en SOUS-UNITÉS entières (10.14.1) : arrondi au centime d'abord, puis séparé. Séparer
    // puis arrondir écrivait « cent dix-neuf euros et cent centimes » sous « 120,00 EUR ».
    const total = Math.round(round3(Math.abs(amount)) * w[4] * (1 + 4 * Number.EPSILON));
    const d = Math.floor(total / w[4]);
    const m = total - d * w[4];
    const words = en ? intToWordsEn : intToWords;
    // « Un million DE dinars », « deux milliards D'euros » : un nombre qui finit par million ou milliard
    // (des noms) se lie à l'unité par « de » ; « un million deux cent mille dinars », non.
    const unite = d > 1 ? w[1] : w[0];
    const de = !en && d >= 1e6 && d % 1e6 === 0 ? (/^[aeiouyéè]/i.test(unite) ? 'd\'' : 'de ') : '';
    let s = words(d) + ' ' + de + unite;
    if (m) s += (en ? ' and ' : ' et ') + words(m) + ' ' + (m > 1 ? w[3] : w[2]);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- template HTML (aperçu + PDF) ----------

  const I18N = {
    fr: {
      devis: 'Devis', facture: 'Facture', avoir: 'Avoir', issuedF: 'Émise le', issued: 'Émis le', dueBy: 'À régler avant le', payOnReceipt: 'À régler à réception', validUntil: 'Valable jusqu\'au',
      deposit: 'Acompte', depositOf: '% du devis', depositAmountOf: 'TTC du devis', balance: 'Solde', balanceOf: 'du devis', afterQuote: 'Suite au devis', reference: 'Référence', cancels: 'Annule / rectifie',
      billedTo: 'Facturé à', preparedFor: 'Préparé pour', client: 'Client', subject: 'Objet', designation: 'Désignation', qty: 'Qté', unitPrice: 'Prix unit. HT', vat: 'TVA', lineTotal: 'Total HT',
      payment: 'Règlement', bank: 'Banque', rib: 'RIB', motif: 'Motif', creditText: (n, nom) => `Cet avoir vient en déduction de ${nom || 'la facture'} ${n}`, creditFreeText: 'Cet avoir n\'est rattaché à aucune facture : il est à valoir sur une prochaine facture, ou remboursé', conditions: 'Conditions', validText: d => `Devis valable jusqu'au ${d}.`,
      subtotal: 'Total HT', discount: 'Remise', netHT: 'Net HT', on: 'sur', stamp: 'Timbre fiscal', totalTTC: 'Total TTC', withholding: 'Retenue à la source', netToPay: 'Net à payer', creditAmount: 'Montant de l\'avoir',
      wordsInvoice: 'Arrêtée la présente facture à la somme de', wordsFees: 'Arrêtée la présente note d\'honoraires à la somme de', wordsCredit: 'Arrêté le présent avoir à la somme de', wordsQuote: 'Arrêté le présent devis à la somme de', wordsDoc: 'Arrêté le présent document à la somme de',
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
      devis: 'Quote', facture: 'Invoice', avoir: 'Credit note', issuedF: 'Issued on', issued: 'Issued on', dueBy: 'Due by', payOnReceipt: 'Payable on receipt', validUntil: 'Valid until',
      deposit: 'Deposit', depositOf: '% of quote', depositAmountOf: 'incl. VAT, of quote', balance: 'Balance', balanceOf: 'of quote', afterQuote: 'Following quote', reference: 'Reference', cancels: 'Cancels / corrects',
      billedTo: 'Billed to', preparedFor: 'Prepared for', client: 'Client', subject: 'Subject', designation: 'Description', qty: 'Qty', unitPrice: 'Unit price', vat: 'VAT', lineTotal: 'Total excl. VAT',
      payment: 'Payment', bank: 'Bank', rib: 'Account (RIB)', motif: 'Reference', creditText: (n, nom) => `This credit note is deducted from ${nom || 'invoice'} ${n}`, creditFreeText: 'This credit note is not attached to any invoice: it may be applied to a future invoice, or refunded', conditions: 'Terms', validText: d => `This quote is valid until ${d}.`,
      subtotal: 'Subtotal excl. VAT', discount: 'Discount', netHT: 'Net excl. VAT', on: 'on', stamp: 'Stamp duty', totalTTC: 'Total incl. VAT', withholding: 'Withholding tax', netToPay: 'Amount due', creditAmount: 'Credit amount',
      wordsInvoice: 'Total amount in words:', wordsFees: 'Total amount in words:', wordsCredit: 'Total amount in words:', wordsQuote: 'Total amount in words:', wordsDoc: 'Total amount in words:',
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
    // Le titre imprimé. Pour une profession libérale, « Facture » devient « Note d'honoraires » —
    // même pièce, même numéro, même valeur comptable, le nom que le client attend.
    const title = (doc.type === 'facture' && estLiberal(company))
      ? docLabel('facture', company, lang) : (L[doc.type] || 'Document');
    const cl = client || {};
    const ink = company.primaryColor || '#1b2430';
    const accent = company.accentColor || '#0f9d8f';
    const numberText = doc.number || L.draft;
    const stampKey = opts.stamp || ({ 'Payée': 'paid', 'Annulée': 'cancelled', 'Brouillon': 'draft' })[opts.stampText] || (opts.stampText ? 'custom' : (!isQuote && !isContract && doc.status === 'brouillon' ? 'draft' : null));
    const stampText = stampKey === 'custom' ? opts.stampText : (stampKey ? L[stampKey] : '');
    const multiVat = Object.keys(t.vatByRate).length > 1;
    // La colonne TVA (7.22.0). Elle tombe quand l'entreprise n'est pas assujettie — mais JAMAIS
    // quand la pièce en porte : une facture émise sous le régime réel garde sa colonne pour
    // toujours, même si l'entreprise passe au forfaitaire l'année suivante. Une pièce émise ne se
    // réécrit pas (règle 7.1.0), et le PDF chez le client ferait foi contre nous.
    const coTva = regimePourPiece(doc, company);
    const showVat = assujettiTVA(coTva) || t.totalVAT > 0;
    const mentionSansTva = showVat ? '' : mentionTVA(coTva, lang);
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
        ${showVat ? `<td class="r num dim">${l.vatRate}%</td>` : ''}
        <td class="r num strong">${fmt(l.ht)}</td>`}
      </tr>`).join('');

    // 10.12.0 — un délai de 0 jour : « À régler avant le 24/09 » sous « Émise le 24/09 » se lit
    // comme un délai impossible. La mention d'usage est « à réception », et c'est la même date.
    // 10.14.1 (S-05) — et elle se lit dans le MÊME cadre que la date : deux cadres côte à côte,
    // « Émise le 24/09 » et « À régler : à réception », disaient deux fois la même chose, et le
    // second faisait chercher une seconde date qui n'existait pas.
    const aReception = d => !!(d.dueDate && d.dueDate === d.date);
    const dueCard = d => aReception(d) ? null : [L.dueBy, fmtDate(d.dueDate)];
    const metaItems = isInvoice ? [
      [L.issuedF, fmtDate(doc.date), aReception(doc) ? L.payOnReceipt : ''],
      dueCard(doc),
      doc.deposit ? [L.deposit, doc.deposit.montant ? `${money(doc.deposit.montant, cur, undefined, lang)} ${L.depositAmountOf} ${doc.deposit.quoteNumber}` : `${pct(doc.deposit.percent)} ${L.depositOf} ${doc.deposit.quoteNumber}`] : (doc.settles ? [L.balance, `${L.balanceOf} ${doc.settles.quoteNumber}`] : (doc.fromQuoteNumber ? [L.afterQuote, doc.fromQuoteNumber] : null)),
      doc.reference ? [L.reference, doc.reference] : null
    ] : isCredit ? [
      [L.issued, fmtDate(doc.date)],
      doc.creditOfNumber ? [L.cancels, docLabel('facture', company, lang) + ' ' + doc.creditOfNumber] : null,
      doc.reference ? [L.reference, doc.reference] : null
    ] : isProforma ? [
      [L.established, fmtDate(doc.date), aReception(doc) ? L.payOnReceipt : ''],
      doc.dueDate ? dueCard(doc) : null,
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
    // 10.12.0 — le taux s'écrivait à la française (« 3,350 DT ») au milieu d'un document anglais qui
    // écrit « 1,200.00 » : c'était le seul montant du modèle à oublier la langue de la pièce.
    if (foreign) metaItems.push([L.rate, `1 ${cur} = ${money(doc.exchangeRate, company.currency, null, lang)}`]);
    const meta = metaItems.filter(Boolean).map(([k, v, sous]) => `<div class="chip"><span class="ck">${escapeHtml(k)}</span><span class="cv">${escapeHtml(v)}</span>${sous ? `<span class="cs">${escapeHtml(sous)}</span>` : ''}</div>`).join('');

    // Sans TVA, la mention légale prend la PLACE de la ligne de TVA, là où le lecteur la cherche.
    // Une facture sans TVA et sans mention n'est pas une facture allégée, c'est une facture
    // incomplète — et c'est le client, ou son comptable, qui la refuse.
    const vatRows = !showVat
      ? (mentionSansTva ? `<tr><td colspan="2" class="dim">${escapeHtml(mentionSansTva)}</td></tr>` : '')
      : multiVat ? Object.keys(t.vatByRate).sort((a, b) => a - b).map(rate =>
      `<tr><td>${L.vat} ${rate}% <span class="dim">${L.on} ${fmt(t.vatByRate[rate].base)}</span></td><td class="r num">${fmt(t.vatByRate[rate].vat)}</td></tr>`).join('')
      : `<tr><td>${L.vat}</td><td class="r num">${fmt(t.totalVAT)}</td></tr>`;

    const contact = [company.phone, company.email, company.website].filter(Boolean).map(escapeHtml).join('<br>');
    const clientContact = [cl.contact ? escapeHtml(cl.contact) : '', cl.matricule ? L.mfCin + ' ' + escapeHtml(cl.matricule) : '', cl.phone ? escapeHtml(cl.phone) : '', cl.email ? escapeHtml(cl.email) : ''].filter(Boolean).join('<br>');
    // Pied de page légal : le texte libre s'il est rempli, sinon composé du nom et du matricule
    const footerBase = company.footer || [company.name, company.matricule ? (lang === 'en' ? 'Tax ID ' : 'Matricule fiscal ') + company.matricule : ''].filter(Boolean).join(' — ');
    const legal = [footerBase, company.rc ? 'RC ' + company.rc : '', company.capital ? (lang === 'en' ? 'Share capital ' : 'Capital ') + capitalAffiche(company.capital, company.currency, lang) : ''].filter(Boolean).join(' — ');
    const grandLabel = isInvoice || isProforma ? L.netToPay : isCredit ? L.creditAmount : L.totalTTC;
    const grandValue = isQuote || isOrder || isContract ? t.totalTTC : t.netToPay;
    const wordsIntro = isInvoice ? (estLiberal(company) ? L.wordsFees : L.wordsInvoice) : isCredit ? L.wordsCredit : isQuote ? L.wordsQuote : L.wordsDoc;
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
  /* une page par feuille : c'est paginate qui les fabrique, le navigateur ne coupe plus rien lui-même */
  .page + .page { break-before: page; page-break-before: always; }
  ${opts.preview ? 'html { zoom: ' + (opts.zoom || 0.5) + '; background: #e9edf1; } body { padding: 8mm 0; } .page { box-shadow: 0 4px 24px rgba(20,40,60,.12); margin: 0 auto; border-radius: 2mm; } .page + .page { margin-top: 8mm; }' : ''}

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
  .chip .cs { display: block; font-size: 7.5pt; font-weight: 700; margin-top: .6mm; color: ${accent}; }

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
  /* Les notes sont découpées ligne par ligne : c'est ce qui permet à paginate de les répartir sur
     plusieurs pages quand elles sont longues, au lieu de renoncer à toute la mise en page. */
  .notes { font-size: 9pt; color: #4b5563; line-height: 1.45; }
  .notes .n-l { min-height: 1.45em; white-space: pre-line; }

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
  .footer .f-right { white-space: nowrap; text-align: right; }

  /* Pages suivantes : pas de bandeau d'en-tête (il appartient à la première), mais de quoi savoir de
     quel document et de quel client il s'agit si la feuille est lue seule. */
  .page.suite .inner { padding-top: 12mm; }
  .cont { display: flex; justify-content: space-between; align-items: baseline; gap: 6mm; padding-bottom: 2.5mm; margin-bottom: 4mm; border-bottom: .2mm solid #eceff3; }
  .cont .c-doc { font-size: 9.5pt; font-weight: 700; color: ${ink}; }
  .cont .c-cl { font-size: 8.5pt; color: #8b95a3; text-align: right; }

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

  /* Second cran (dense) : il ne sert QUE s'il fait gagner une page entière — c'est paginate qui en
     décide. Resserrer un document qui fera deux pages de toute façon ne gagne rien et se lit moins bien. */
  .page.dense .hero { padding: 6mm 18mm 5mm; }
  .page.dense .brand .addr { line-height: 1.25; margin-top: 1.4mm; }
  .page.dense .chips { margin-top: 3mm; gap: 2.5mm; }
  .page.dense .chip { padding: 1.5mm 3mm; }
  .page.dense .inner { padding-top: 3mm; }
  .page.dense .parties { gap: 8mm; }
  .page.dense .party .addr, .page.dense .party .more { line-height: 1.3; }
  .page.dense table.lines { margin-top: 2.5mm; }
  .page.dense table.lines thead th { padding: 1.8mm 3mm; }
  .page.dense table.lines tbody td { padding: 1.1mm 3mm; }
  .page.dense table.lines .desc { font-size: 8.2pt; line-height: 1.3; margin-top: .3mm; }
  .page.dense .after { margin-top: 1.5mm; }
  .page.dense .card { padding: 2.5mm 4mm; }
  .page.dense .words { margin-top: 1.4mm; }
  .page.dense .info + .info, .page.dense .notes { margin-top: 2.4mm; }
  .page.dense .sign { margin-top: 2.5mm; }
  .page.dense .sign .s { height: 11mm; }
  .page.dense.t-contrat .sign .s { height: auto; min-height: 11mm; }
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
        ${showVat ? `<th class="r" style="width:12mm">${L.vat}</th>` : ''}<th class="r" style="width:28mm">${L.lineTotal}</th>`}
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
          ${doc.creditOfNumber ? L.creditText(escapeHtml(doc.creditOfNumber), estLiberal(company) ? (lang === 'en' ? 'fee note' : 'la note d\'honoraires') : '') : L.creditFreeText}${doc.creditReason ? ' — ' + escapeHtml(doc.creditReason) : ''}.
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
        ${doc.notes ? `<div class="notes">${String(doc.notes).split('\n').map(l => `<div class="n-l">${escapeHtml(l)}</div>`).join('')}</div>` : ''}
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
    <div class="f-right">${title} ${escapeHtml(numberText)}</div>
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

  // Distribue le document sur de VRAIES pages A4 : une <div class="page"> par feuille, chacune avec son
  // pied de page numéroté et, à partir de la deuxième, un bandeau qui rappelle le document et le client.
  //
  // Avant la 7.31.0 on laissait le navigateur découper un seul long bloc. Le pied de page, posé en
  // absolu à la fin de ce bloc, s'imprimait alors PAR-DESSUS les cases de signature ; la première page
  // n'en portait aucun (donc aucune mention légale) ; et un devis de neuf lignes finissait sur une
  // seconde page vide aux trois quarts. Mesuré, pas déduit : chromium + page.pdf.
  //
  // À exécuter dans le document rendu (aperçu, fenêtre PDF). AUTONOME : main.js la sérialise pour
  // l'exécuter dans la fenêtre PDF, elle ne peut donc appeler aucune autre fonction de ce fichier.
  // Renvoie le nombre de pages. Au moindre pépin, le document d'origine est restauré et on rend la
  // main au navigateur : on ne perd jamais une ligne d'une facture.
  function paginate(d) {
    const body = d && d.body;
    const depart = d && d.querySelector && d.querySelector('.page');
    if (!body || !depart || !depart.querySelector('.inner') || !depart.querySelector('.footer')) return 1;
    if (body.getAttribute('data-sf-pages')) return Number(body.getAttribute('data-sf-pages')) || 1;
    const secours = body.innerHTML;

    const sonde = d.createElement('div');
    sonde.style.cssText = 'position:absolute;visibility:hidden;top:0;left:0;width:1px;height:100mm';
    body.appendChild(sonde);
    const MM = sonde.offsetHeight / 100;
    sonde.remove();
    if (!(MM > 0)) return 1;
    const HAUT = 296 * MM;

    // Répartit le contenu de la page donnée sur autant de pages qu'il faut. Renvoie la liste des
    // pages, ou null si l'une déborde malgré tout (auquel cas l'appelant restaure l'original).
    function repartir(page) {
      const inner = page.querySelector('.inner');
      const footer = page.querySelector('.footer');
      const hero = page.querySelector('.hero');
      const stamp = page.querySelector('.stamp');
      // La bande basse réservée sur CHAQUE page : le pied lui-même, plus l'air qui le sépare du contenu.
      const UTILE = HAUT - (footer.offsetHeight + 10 * MM);
      const pages = [];
      const coquille = page.cloneNode(false);
      const titre = footer.querySelector('.f-right');
      const nomClient = page.querySelector('.party .pname');

      const bandeau = () => {
        const b = d.createElement('div');
        b.className = 'cont';
        const a = d.createElement('div'); a.className = 'c-doc'; a.textContent = titre ? titre.textContent : '';
        const c = d.createElement('div'); c.className = 'c-cl'; c.textContent = nomClient ? nomClient.textContent : '';
        b.appendChild(a); b.appendChild(c);
        return b;
      };
      const nouvelle = suite => {
        const p = coquille.cloneNode(false);
        if (suite) p.classList.add('suite');
        const zone = d.createElement('div');
        zone.className = 'inner';
        if (suite) zone.appendChild(bandeau());
        p.appendChild(zone);
        page.parentNode.insertBefore(p, page);
        const o = { el: p, zone, base: zone.children.length };
        pages.push(o);
        return o;
      };
      const tient = c => c.zone.offsetTop + c.zone.offsetHeight <= UTILE;
      // Vrai si la page portait déjà quelque chose avant le dernier élément posé : sans ce garde-fou,
      // un bloc plus haut qu'une page entière fabriquerait des pages vides à l'infini.
      const seul = c => c.zone.children.length <= c.base + 1;

      let cur = nouvelle(false);
      if (stamp) cur.el.insertBefore(stamp, cur.zone);
      if (hero) cur.el.insertBefore(hero, cur.zone);

      // Un bloc insécable : il descend entier plutôt que d'être coupé.
      const poser = el => {
        cur.zone.appendChild(el);
        if (!tient(cur) && !seul(cur)) {
          cur = nouvelle(true);
          cur.zone.appendChild(el);
        }
      };
      // Un bloc qu'on peut répartir morceau par morceau (les lignes d'un tableau, les clauses d'un
      // contrat) : on remplit la page, puis on repart avec un conteneur identique — donc l'en-tête
      // des colonnes se retrouve en tête de chaque page, là où on le cherche.
      const repandre = (el, dedans) => {
        const hote = dedans ? el.querySelector(dedans) : el;
        const morceaux = Array.prototype.slice.call(hote.children);
        const modele = el.cloneNode(true);
        const creux = dedans ? modele.querySelector(dedans) : modele;
        while (creux.firstChild) creux.removeChild(creux.firstChild);
        let boite = modele.cloneNode(true);
        let creux2 = dedans ? boite.querySelector(dedans) : boite;
        const neuve = () => {
          cur = nouvelle(true);
          boite = modele.cloneNode(true);
          creux2 = dedans ? boite.querySelector(dedans) : boite;
          cur.zone.appendChild(boite);
        };
        cur.zone.appendChild(boite);
        if (!tient(cur) && !seul(cur)) { boite.remove(); neuve(); }
        for (let i = 0; i < morceaux.length; i++) {
          creux2.appendChild(morceaux[i]);
          if (tient(cur)) continue;
          // Un morceau plus haut qu'une page entière : on le laisse déborder, le filet de sortie
          // tranchera. Attention, la condition porte sur la PAGE et pas sur le conteneur : un premier
          // morceau posé dans un conteneur neuf, sur une page déjà remplie, doit descendre.
          if (creux2.children.length === 1 && seul(cur)) continue;
          creux2.removeChild(morceaux[i]);
          neuve();
          creux2.appendChild(morceaux[i]);
        }
      };

      // Le bloc de fin (conditions, notes, totaux) est insécable : de longues notes le rendent plus
      // haut qu'une page, et plus rien ne tient nulle part. On sort alors la colonne de gauche du
      // bloc — ses paragraphes se répartissent — et la carte des totaux reste à sa place, à droite.
      const fin = inner.querySelector('.after');
      if (fin && fin.offsetHeight > UTILE) {
        const gauche = fin.firstElementChild;
        if (gauche && !gauche.classList.contains('card')) {
          while (gauche.firstElementChild) inner.insertBefore(gauche.firstElementChild, fin);
          gauche.remove();
          if (!fin.children.length) fin.remove();
          else fin.insertBefore(d.createElement('div'), fin.firstChild);
        }
      }

      const blocs = Array.prototype.slice.call(inner.children);
      for (let i = 0; i < blocs.length; i++) {
        const b = blocs[i];
        if (b.tagName === 'TABLE' && b.classList.contains('lines')) repandre(b, 'tbody');
        else if (b.classList.contains('clauses') || b.classList.contains('notes')) repandre(b, null);
        else poser(b);
        if (pages.length > 200) return null;
      }
      page.remove();
      // Filet : `overflow: hidden` masquerait un débordement au lieu de le montrer. Si une page
      // déborde malgré tout, on ne livre pas cette mise en page — mieux vaut le défaut d'hier qu'une
      // ligne invisible sur une facture.
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].zone.offsetTop + pages[i].zone.offsetHeight > HAUT) return null;
      }
      // Le pied revient sur chaque page, numéroté. Il est posé en absolu : l'ajouter maintenant ne
      // change aucune mesure.
      for (let i = 0; i < pages.length; i++) {
        const f = footer.cloneNode(true);
        const droite = f.querySelector('.f-right');
        if (droite && pages.length > 1) droite.textContent = droite.textContent + ' — page ' + (i + 1) + ' sur ' + pages.length;
        pages[i].el.appendChild(f);
      }
      return pages;
    }

    const essai = classes => {
      body.innerHTML = secours;
      const p = d.querySelector('.page');
      p.classList.remove('compact', 'dense');
      for (let i = 0; i < classes.length; i++) p.classList.add(classes[i]);
      return repartir(p);
    };

    // On rend la main au navigateur : il découpe moins bien, mais il ne perd jamais rien. On renvoie
    // le nombre de pages qu'il fera, pour que l'aperçu n'annonce pas « 1 page » sur un document long.
    const abandon = () => {
      body.innerHTML = secours;
      const p = d.querySelector('.page');
      return p ? Math.max(1, Math.ceil((p.offsetHeight - 2) / (297 * MM))) : 1;
    };

    try {
      // On applique le resserrement le plus LÉGER qui fasse gagner une page. Resserrer un document qui
      // fera deux pages de toute façon ne gagne rien et se lit moins bien (défaut de fitToPage seul).
      const niveaux = [[], ['compact'], ['compact', 'dense']];
      let meilleur = null;
      for (let i = 0; i < niveaux.length; i++) {
        const r = essai(niveaux[i]);
        if (!r) return abandon();
        if (!meilleur || r.length < meilleur.n) meilleur = { classes: niveaux[i], n: r.length };
        if (meilleur.n === 1) break;
      }
      const final = essai(meilleur.classes);
      if (!final) return abandon();
      body.setAttribute('data-sf-pages', String(final.length));
      return final.length;
    } catch (_) {
      return abandon();
    }
  }

  // Nombre de pages A4 qu'occupera le document rendu (à exécuter dans le document, après paginate).
  function pageCount(d) {
    if (d && d.querySelectorAll) {
      const toutes = d.querySelectorAll('.page');
      if (toutes.length > 1) return toutes.length;
    }
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
  // Une quantité et son unité, accordées : « 29 postes », « 1 poste », « 3 kg », « 2 mois ». Une
  // abréviation (u, h, j, kg, m², ml, L…) ne prend jamais de « s » ; un mot déjà terminé par s, x ou z
  // non plus. Seul le nombre qui dépasse 1 (en valeur absolue) met le mot au pluriel, comme en français.
  function uniteAccordee(n, unite) {
    const u = String(unite == null ? '' : unite).trim();
    if (!u) return '';
    // Les abréviations de la liste sont celles dont le libellé porte la forme longue entre parenthèses.
    const abrev = LINE_UNITS.some(([code, lib]) => code === u && /\(/.test(lib));
    const connue = LINE_UNITS.some(([code]) => code === u);
    const mot = !abrev && (connue ? /^[a-zà-ÿ-]+$/.test(u) : /^[a-zà-ÿ][a-zà-ÿ-]{2,}$/.test(u)) && !/[sxz]$/.test(u);
    if (!mot || Math.abs(Number(n) || 0) < 2) return u;
    return u.split('-').map(p => /^(demi|mi|semi)$/.test(p) ? p : p + 's').join('-');
  }
  function usedUnits(data, extra) {
    const known = new Set(LINE_UNITS.map(u => u[0]));
    const out = [];
    const add = u => { u = (u || '').trim(); if (u && !known.has(u)) { known.add(u); out.push(u); } };
    (data && data.catalog || []).forEach(c => add(c.unit));
    (data && data.documents || []).forEach(d => (d.lines || []).forEach(l => add(l.unit)));
    (extra || []).forEach(add);
    return out.sort((a, b) => a.localeCompare(b, 'fr'));
  }

  // Taux de retenue à la source déjà employés et absents de la liste standard. Même principe que
  // `usedUnits` : un taux saisi une fois reste proposé partout ensuite, sans rien avoir à régler.
  // Sans ça, un taux libre saisi sur une facture disparaîtrait du menu de la suivante, et la fiche
  // du client le remettrait en silence à « par défaut » — c'est-à-dire changerait le montant.
  function usedWithholdingRates(data, extra) {
    const known = new Set(WITHHOLDING_RATES);
    const out = [];
    const add = r => {
      if (r === '' || r === null || r === undefined) return;
      const n = Number(r);
      if (!isFinite(n) || n <= 0 || known.has(n)) return;
      known.add(n); out.push(n);
    };
    const d = data || {};
    (d.documents || []).forEach(x => add(x.withholdingRate));
    (d.clients || []).forEach(x => add(x.withholdingRate));
    (d.suppliers || []).forEach(x => add(x.withholdingRate));
    (d.purchases || []).forEach(x => add(x.withholdingRate));
    (d.recurring || []).forEach(x => add(x.withholdingRate));
    add(d.company && d.company.defaultWithholdingRate);
    (extra || []).forEach(add);
    return out.sort((a, b) => a - b);
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

  // ---------- un client, un article : le modèle vierge (10.14.0) ----------
  // Un client ou un article naît en UN endroit : la fiche (`clientForm`, `catalogForm`), les
  // créations à la volée depuis une ligne (9.2.1) et l'import depuis un tableur partent du même
  // modèle. Écrit trois fois, un champ ajouté demain manquerait à l'un des trois.
  function clientVierge(extra) {
    return Object.assign({ id: uid(), name: '', contact: '', matricule: '', address: '', phone: '', email: '', notes: '', withholdingRate: '' }, extra || {});
  }
  function articleVierge(company, extra, jour) {
    return Object.assign({ id: uid(), label: '', description: '', unit: '', unitPrice: 0, unitCost: 0, vatRate: defaultVat(company),
      tracked: false, minStock: 0, location: '', initialQty: 0, initialCost: 0, initialDate: jour || today(),
      serialized: false, warrantyMonths: 0 }, extra || {});
  }

  // ---------- l'import depuis un tableur (10.14.0) ----------
  //
  // Quelqu'un qui démarre sur SkanFact a presque toujours DÉJÀ une liste : ses clients dans un
  // tableur, ses prix dans un fichier, ou ce que son ancien logiciel sait exporter. Les retaper un
  // à un dans un formulaire, personne ne le fait — et l'application reste vide le jour où l'on
  // voulait s'en servir. C'est la leçon du Cabinet (6.8.0 : « l'ajout se fait en collant une liste
  // depuis un tableur »), jamais portée à l'app entreprise.
  //
  // On COLLE : une sélection copiée dans Excel, LibreOffice ou Google Sheets arrive en tabulations.
  // Un fichier CSV s'ouvre aussi (point-virgule à la française, virgule à l'anglaise). Tout ce qui
  // DÉCIDE vit ici, pur : quelles colonnes, quelles lignes entrent, lesquelles existent déjà,
  // lesquelles sont refusées et pourquoi. L'écran montre le plan et l'applique, rien d'autre.
  //
  // Chaque champ porte les titres de colonne qu'on lui connaît (sans accents ni ponctuation) et le
  // séparateur qui joint deux colonnes du même champ (« Adresse 1 » et « Adresse 2 », « Nom » et
  // « Prénom »). Un champ NOMBRE ne se joint pas : la première colonne gagne.
  const IMPORT_CHAMPS = {
    clients: [
      { k: 'name', label: 'Nom / raison sociale', joint: ' ', noms: ['nom', 'noms', 'nom client', 'nom du client', 'client', 'clients', 'raison sociale', 'raison soc', 'denomination', 'denomination sociale', 'societe', 'entreprise', 'nom raison sociale', 'nom ou raison sociale', 'nom et prenom', 'nom prenom', 'prenom', 'nom complet', 'customer', 'customer name', 'name', 'company', 'company name', 'tiers', 'intitule'] },
      { k: 'contact', label: 'Personne à contacter', joint: ' ', noms: ['contact', 'personne a contacter', 'interlocuteur', 'responsable', 'nom du contact', 'contact name', 'gerant', 'representant'] },
      { k: 'matricule', label: 'Matricule fiscal / CIN', joint: ' ', noms: ['matricule', 'matricule fiscal', 'mf', 'm f', 'identifiant fiscal', 'id fiscal', 'identifiant unique', 'code tva', 'n tva', 'num tva', 'numero tva', 'cin', 'n cin', 'numero cin', 'mf cin', 'matricule fiscal cin', 'tax id', 'vat number', 'vat id'] },
      { k: 'phone', label: 'Téléphone', joint: ' / ', noms: ['telephone', 'telephones', 'tel', 'tel fixe', 'tel portable', 'portable', 'mobile', 'gsm', 'phone', 'telephone portable', 'telephone mobile', 'telephone fixe', 'numero de telephone', 'n telephone', 'num tel', 'fixe'] },
      { k: 'email', label: 'Email', joint: ', ', noms: ['email', 'e mail', 'emails', 'mail', 'courriel', 'adresse email', 'adresse e mail', 'adresse mail', 'email address', 'e mail address', 'mel'] },
      { k: 'address', label: 'Adresse', joint: '\n', noms: ['adresse', 'adresse postale', 'address', 'rue', 'siege', 'siege social', 'adresse 1', 'adresse ligne 1', 'adresse 2', 'adresse ligne 2', 'street'] },
      { k: 'complement', label: 'Code postal, ville, pays', joint: ' ', noms: ['code postal', 'cp', 'ville', 'localite', 'gouvernorat', 'delegation', 'pays', 'city', 'zip', 'zip code', 'postal code', 'country', 'region', 'cite'] },
      { k: 'notes', label: 'Notes internes', joint: '\n', noms: ['notes', 'note', 'remarque', 'remarques', 'commentaire', 'commentaires', 'observation', 'observations', 'memo', 'comment', 'comments'] }
    ],
    catalogue: [
      { k: 'label', label: 'Désignation', joint: ' ', noms: ['designation', 'libelle', 'intitule', 'produit', 'produits', 'article', 'articles', 'prestation', 'prestations', 'service', 'services', 'nom', 'nom du produit', 'nom produit', 'nom de l article', 'item', 'product', 'product name', 'name', 'titre', 'description courte'] },
      { k: 'description', label: 'Description', joint: '\n', noms: ['description', 'descriptif', 'detail', 'details', 'description longue', 'caracteristiques'] },
      { k: 'unitPrice', label: 'Prix unitaire HT', nombre: true, noms: ['prix', 'prix ht', 'prix unitaire', 'prix unitaire ht', 'pu', 'pu ht', 'p u', 'p u ht', 'prix de vente', 'prix de vente ht', 'pv', 'pv ht', 'tarif', 'tarif ht', 'price', 'unit price', 'montant', 'montant ht', 'prix hors taxe', 'prix hors taxes', 'prix unitaire hors taxe'] },
      { k: 'unitPriceTTC', label: 'Prix unitaire TTC', nombre: true, noms: ['prix ttc', 'pu ttc', 'p u ttc', 'prix unitaire ttc', 'prix de vente ttc', 'pv ttc', 'tarif ttc', 'montant ttc', 'prix toutes taxes', 'prix toutes taxes comprises'] },
      { k: 'unitCost', label: 'Coût de revient HT', nombre: true, noms: ['cout', 'cout ht', 'cout de revient', 'cout unitaire', 'cout d achat', 'prix d achat', 'prix d achat ht', 'prix achat', 'pa', 'pa ht', 'p a', 'prix de revient', 'cost', 'unit cost', 'purchase price'] },
      { k: 'vatRate', label: 'TVA (%)', nombre: true, noms: ['tva', 'tva %', 'taux tva', 'taux tva %', 'taux de tva', 'vat', 'vat %', 'taxe', 'tax', 'taux'] },
      { k: 'unit', label: 'Unité', joint: ' ', noms: ['unite', 'unites', 'u', 'unit', 'unite de vente', 'conditionnement', 'uv'] },
      { k: 'initialQty', label: 'Stock de départ', nombre: true, noms: ['stock', 'quantite', 'qte', 'qt', 'quantite en stock', 'qte en stock', 'stock initial', 'stock actuel', 'stock de depart', 'en stock', 'quantity', 'qty', 'inventaire'] }
    ]
  };
  // Quand le titre exact n'est pas connu, un MOT du titre peut décider — dans cet ordre, parce que
  // « Adresse email » est un email et « Prix TTC » un prix TTC, pas une adresse ni un prix HT. Les
  // mots LARGES (« client », « produit », « tva », « prix ») ne décident pas d'un titre qui parle
  // d'un code : « Code client » est un code, pas le nom du client, et joint au nom il donnerait
  // « Dupont C-0042 » sur chaque facture (le troisième élément d'une règle porte ce veto).
  const IMPORT_MOTS = {
    clients: [['email', /\b(e ?mail|courriel|mails?)\b/], ['phone', /\b(tel|telephone|portable|mobile|gsm|phone|fixe)\b/],
      ['matricule', /\b(matricule|mf|fiscal|cin)\b/], ['complement', /\b(ville|postal|pays|gouvernorat|localite|cp)\b/],
      ['address', /\b(adresse|address|rue)\b/], ['contact', /\b(contact|interlocuteur|responsable)\b/, true],
      ['notes', /\b(notes?|remarques?|commentaires?|observations?)\b/], ['name', /\b(nom|raison|societe|client|entreprise|denomination)\b/, true]],
    catalogue: [['unitPriceTTC', /\bttc\b/, true], ['unitCost', /\b(cout|achat|revient)\b/], ['vatRate', /\b(tva|vat|taxe)\b/, true],
      ['unitPrice', /\b(prix|pu|tarif|price|montant)\b/, true], ['initialQty', /\b(stock|quantite|qte|qty)\b/], ['unit', /\bunites?\b/],
      ['description', /\b(description|descriptif|details?)\b/], ['label', /\b(designation|libelle|produits?|articles?|prestations?|services?|nom|intitule)\b/, true]]
  };
  const VETO_MOTS = /\b(code|ref|reference|id|identifiant|numero|num|no|n)\b/;
  const cleEntete = titre => plier(titre).replace(/[^a-z0-9%]+/g, ' ').trim();
  function champDeEntete(type, titre) {
    const brut = String(titre == null ? '' : titre);
    // Une cellule qui porte un email ou un numéro n'est pas un titre de colonne : c'est une donnée.
    // Sans ce garde-fou, « contact@darelmarsa.tn » passait pour le titre « Contact », et la
    // première ligne d'une liste SANS titres disparaissait dans l'en-tête.
    if (brut.includes('@') || (brut.match(/\d/g) || []).length >= 5) return '';
    const t = cleEntete(brut);
    if (!t) return '';
    const exact = (IMPORT_CHAMPS[type] || []).find(c => c.noms.includes(t));
    if (exact) return exact.k;
    const mot = (IMPORT_MOTS[type] || []).find(([, re, veto]) => re.test(t) && !(veto && VETO_MOTS.test(t)));
    return mot ? mot[0] : '';
  }

  // Le découpage d'un texte collé. Un guillemet n'OUVRE un champ protégé qu'en tête de champ (c'est
  // ce qu'écrivent Excel et les CSV) : « Écran 24" » au milieu d'une désignation est un caractère,
  // pas le début d'un champ qui avalerait tout le reste du fichier. Dans un vrai champ protégé, un
  // guillemet est DOUBLÉ ; un guillemet seul qui n'est suivi ni d'un séparateur ni d'une fin de
  // ligne (« "Premium" pack ») dit que ce n'en était pas un : le champ redevient du texte ordinaire,
  // tel quel, sans aller chercher sa fermeture trois lignes plus bas. Un champ qui ne se referme
  // jamais, pareil.
  function decouperTableau(texte, sep) {
    const s = String(texte == null ? '' : texte).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const n = s.length;
    const rows = [];
    let ligne = [], i = 0;
    const brut = () => { let j = i; while (j < n && s[j] !== '\n' && s[j] !== sep) j++; const c = s.slice(i, j); i = j; return c; };
    while (i <= n) {
      let champ;
      if (s[i] === '"') {
        let j = i + 1, buf = '', ferme = -1;
        while (j < n) {
          if (s[j] === '"') {
            if (s[j + 1] === '"') { buf += '"'; j += 2; continue; }
            const apres = s[j + 1];
            if (apres === undefined || apres === '\n' || apres === sep) ferme = j;
            break;
          }
          buf += s[j]; j++;
        }
        if (ferme >= 0) { champ = buf; i = ferme + 1; } else champ = brut();
      } else champ = brut();
      ligne.push(champ);
      if (i >= n) { rows.push(ligne); break; }
      if (s[i] === sep) { i++; if (i === n) { ligne.push(''); rows.push(ligne); break; } continue; }
      rows.push(ligne); ligne = []; i++;
      if (i === n) break;
    }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }
  // Le séparateur se DÉDUIT : une tabulation vient d'un tableur, et elle gagne toujours. Sinon, le
  // point-virgule (un CSV à la française) puis la virgule — à condition que la moitié au moins des
  // lignes aient le même nombre de colonnes que la première : une liste de noms collée d'une seule
  // colonne (« Ben Salah, Ali ») ne se découpe pas sur ses virgules.
  function separateurTableau(texte) {
    const s = String(texte == null ? '' : texte);
    if (s.includes('\t')) return '\t';
    for (const c of [';', ',']) {
      if (!s.includes(c)) continue;
      const rows = decouperTableau(s, c).slice(0, 30);
      if (!rows.length || rows[0].length < 2) continue;
      const pareilles = rows.filter(r => r.length === rows[0].length).length;
      if (pareilles * 2 >= rows.length) return c;
    }
    return null;
  }

  // Un nombre tel qu'un tableur l'écrit : « 1 250,500 », « 25 DT », « 19 % ». Les unités se
  // retirent, le reste passe par la lecture stricte du moteur comptable (une cellule illisible
  // n'est jamais un zéro, 10.10.0 C-16) : `null` quand c'est vide, `NaN` quand ce n'est pas un nombre.
  const nombreImport = v => Compta.nombreStrict(String(v == null ? '' : v)
    .replace(/(?<![a-z])(dt|tnd|dinars?|millimes?|eur|euros?|usd|ht|ttc)(?![a-z])\.?/gi, '').replace(/[€$%]/g, '').trim());
  // Une unité telle qu'on l'écrit : « pièce », « Heure », « m2 ». Ce qui correspond à une unité de
  // la liste prend son code ; le reste est gardé tel quel (et rejoint la liste, comme une unité
  // saisie à la main, `usedUnits`).
  const UNITES_ECRITES = { unite: 'u', unites: 'u', un: 'u', pce: 'u', pc: 'u', piece: 'u', pieces: 'u', heure: 'h', heures: 'h', hr: 'h', hrs: 'h',
    jour: 'j', jours: 'j', m2: 'm²', 'metre carre': 'm²', m3: 'm³', 'metre cube': 'm³', 'metre lineaire': 'ml', litre: 'L', litres: 'L', l: 'L',
    kilogramme: 'kg', kilo: 'kg', kilos: 'kg', annee: 'an', ans: 'an' };
  function uniteImport(v) {
    const t = String(v == null ? '' : v).trim();
    if (!t) return '';
    const p = plier(t).replace(/\.$/, '').trim();
    const connue = LINE_UNITS.find(([code, lib]) => plier(code) === p || plier(lib) === p || plier(lib.replace(/\s*\(.*\)$/, '')) === p);
    if (connue) return connue[0];
    return UNITES_ECRITES[p] || t;
  }
  // Deviner une colonne à son CONTENU, quand aucun titre ne parle : un email se reconnaît, un
  // matricule tunisien aussi, un taux de TVA ne prend que quatre valeurs. Le reste est laissé à
  // « Ignorer » : l'écran montre la colonne et son contenu, la personne choisit.
  function devinerColonnes(type, lignes, largeur) {
    const out = new Array(largeur).fill('');
    const echantillon = lignes.slice(0, 50);
    const part = (i, test) => {
      const v = echantillon.map(r => String(r[i] == null ? '' : r[i]).trim()).filter(Boolean);
      return v.length ? v.filter(test).length / v.length : 0;
    };
    const estNombre = x => { const n = nombreImport(x); return n !== null && !Number.isNaN(n); };
    const libre = i => !out[i];
    if (type === 'clients') {
      for (let i = 0; i < largeur; i++) {
        if (part(i, x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) >= 0.6) out[i] = 'email';
        else if (part(i, x => /^\d{7}\s*[/-]?\s*[a-z]/i.test(x)) >= 0.6) out[i] = 'matricule';
        else if (part(i, x => /^[+(\d][\d\s().\/-]{6,}$/.test(x) && (x.match(/\d/g) || []).length >= 8) >= 0.6) out[i] = 'phone';
      }
      const nom = [...out.keys()].find(i => libre(i) && part(i, x => !estNombre(x)) >= 0.6);
      if (nom != null) out[nom] = 'name';
    } else {
      const lab = [...out.keys()].find(i => part(i, x => !estNombre(x)) >= 0.6);
      if (lab != null) out[lab] = 'label';
      const nombres = [...out.keys()].filter(i => libre(i) && part(i, estNombre) >= 0.8);
      const tva = nombres.find(i => part(i, x => VAT_RATES.includes(Number(nombreImport(x)))) === 1);
      const prix = nombres.find(i => i !== tva);
      if (prix != null) out[prix] = 'unitPrice';
      if (tva != null && prix != null) out[tva] = 'vatRate';
    }
    return out;
  }

  // Une clé pour reconnaître un doublon : le matricule d'abord (sept chiffres, comme la console et le
  // Cabinet), le nom sinon — sans accents, sans ponctuation, sans espaces en trop. Deux homonymes
  // aux matricules DIFFÉRENTS ne sont pas le même client.
  const cleNom = nom => plier(nom).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  function memeClient(a, b) {
    const ma = chiffresMatricule(a.matricule), mb = chiffresMatricule(b.matricule);
    if (ma && mb) return ma === mb;
    return !!cleNom(a.name) && cleNom(a.name) === cleNom(b.name);
  }

  // Le PLAN d'un import. `choix` : { entete: bool (sinon deviné), champs: [clé par colonne] (sinon
  // déduits des titres, ou du contenu faute de titres) }. Chaque ligne rend son statut :
  //   nouveau   — elle entre ;
  //   existe    — elle désigne une fiche déjà là : on COMBLE ses cases vides (`complete`), jamais
  //               on ne remplace ce qui est rempli (10.9.1 — une fiche appartient à son auteur) ;
  //   remplace  — (catalogue) elle désigne une prestation d'EXEMPLE de l'assistant : ses prix sont
  //               les tiens, l'exemple devient ta prestation (10.12.0 — un prix posé par le
  //               logiciel n'est pas un prix décidé) ;
  //   doublon   — même fiche qu'une ligne plus haut dans la liste collée ;
  //   refus     — une cellule illisible ou un nom qui manque : la ligne n'entre pas, et le motif
  //               nomme la ligne et ce qui y est écrit (une cellule illisible n'est jamais un zéro).
  function planImport(type, texte, data, company, choix) {
    const champs = IMPORT_CHAMPS[type];
    if (!champs) throw new Error('Import : type inconnu « ' + type + ' »');
    const o = choix || {};
    const d = data || {};
    const co = company || d.company || {};
    const sep = separateurTableau(texte);
    const brutes = decouperTableau(texte, sep).map(r => r.map(c => String(c == null ? '' : c)));
    const largeur = brutes.reduce((m, r) => Math.max(m, r.length), 0);
    const reconnus = brutes.length ? Array.from({ length: largeur }, (_, i) => champDeEntete(type, brutes[0][i])) : [];
    // Une ligne de TITRES : plus de la moitié de ses cases désignent une colonne connue. Un seul mot
    // reconnu dans une ligne de données (« Client Dupont », « Contact Pro SARL ») ne suffit pas à
    // la faire disparaître dans l'en-tête ; la case à cocher de l'écran tranche sinon.
    const pleines = brutes.length ? brutes[0].filter(c => String(c || '').trim()).length : 0;
    const titresConnus = reconnus.filter(Boolean).length;
    const entete = o.entete != null ? !!o.entete : (titresConnus > 0 && titresConnus * 2 > pleines);
    // La MAUVAISE liste (vu à la souris) : un tarif collé dans l'import des CLIENTS annonçait
    // « 7 nouveaux clients », dont un nommé « Désignation » — aucun de ses titres n'est celui d'un
    // client, donc aucun n'était reconnu, donc chaque ligne devenait un client. Quand la première
    // ligne n'est PAS une ligne de titres de ce type mais qu'elle en est une, à plus de moitié, de
    // l'AUTRE, la liste a sans doute été collée dans la mauvaise fenêtre : le plan le DIT
    // (`autreListe`), et l'écran propose de l'importer là où elle va. Cocher « la première ligne
    // donne les titres » passe outre : c'est un choix, et il se respecte.
    const autre = type === 'clients' ? 'catalogue' : 'clients';
    const titresAutre = brutes.length && o.entete == null && !entete
      ? brutes[0].map(c => String(c || '').trim()).filter(c => champDeEntete(autre, c)) : [];
    const autreListe = titresAutre.length && titresAutre.length * 2 > pleines ? autre : '';
    const titres = entete && brutes.length ? Array.from({ length: largeur }, (_, i) => String(brutes[0][i] || '').trim()) : [];
    const donnees = entete ? brutes.slice(1) : brutes;
    let colonnes;
    if (Array.isArray(o.champs) && o.champs.length) colonnes = Array.from({ length: largeur }, (_, i) => champs.some(c => c.k === o.champs[i]) ? o.champs[i] : '');
    else if (entete) colonnes = reconnus.slice();
    else colonnes = devinerColonnes(type, donnees, largeur);
    // Un champ NOMBRE n'a qu'une colonne : la première gagne, les suivantes sont ignorées (et le
    // disent, puisque leur liste repasse sur « Ignorer »).
    champs.filter(c => c.nombre).forEach(c => { let vu = false; colonnes = colonnes.map(k => { if (k !== c.k) return k; if (vu) return ''; vu = true; return k; }); });
    // Un catalogue sans colonne « Désignation » mais avec une « Description » : c'est elle qui nomme
    // (« Description / Prix », l'usage anglais). Sans ça, chaque ligne serait refusée faute de nom.
    if (type === 'catalogue' && !colonnes.includes('label') && colonnes.includes('description')) colonnes[colonnes.indexOf('description')] = 'label';

    const lire = (r, k) => {
      const c = champs.find(x => x.k === k);
      const vals = colonnes.map((kk, i) => kk === k ? String(r[i] == null ? '' : r[i]).trim() : '').filter(Boolean);
      return c && c.nombre ? (vals[0] || '') : vals.join(c ? c.joint : ' ');
    };
    const assujetti = assujettiTVA(co);
    const vatDefaut = defaultVat(co);
    const existants = type === 'clients' ? (d.clients || []) : (d.catalog || []);
    const vus = [];
    const lignes = donnees.map((r, idx) => {
      const n = idx + (entete ? 2 : 1);
      const extrait = r.map(c => String(c || '').trim()).filter(Boolean).slice(0, 3).join(', ');
      const ligne = { n, cellules: r, statut: 'nouveau', motifs: [], avert: [], complete: [], existant: null };
      const refus = m => { ligne.statut = 'refus'; ligne.motifs.push(`Ligne ${n}${extrait ? ` (${extrait})` : ''} : ${m}`); };
      if (type === 'clients') {
        const adr = [lire(r, 'address'), lire(r, 'complement')].filter(Boolean).join('\n');
        const obj = { name: lire(r, 'name'), contact: lire(r, 'contact'), matricule: lire(r, 'matricule'), phone: lire(r, 'phone'), email: lire(r, 'email'), address: adr, notes: lire(r, 'notes') };
        ligne.objet = obj;
        if (!obj.name) refus('le nom manque — c\'est lui qui s\'imprime sur chaque pièce.');
        if (obj.email && !obj.email.split(/\s*,\s*/).every(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) ligne.avert.push(`l'email « ${obj.email} » n'a pas la forme d'une adresse : un envoi n'arriverait pas.`);
        if (ligne.statut === 'refus') return ligne;
        const avant = vus.find(v => memeClient(v.objet, obj));
        if (avant) { ligne.statut = 'doublon'; ligne.motifs.push(`même client que la ligne ${avant.n}`); return ligne; }
        const ex = existants.find(c => memeClient(c, obj));
        if (ex) {
          ligne.statut = 'existe'; ligne.existant = ex.id;
          ligne.complete = ['contact', 'matricule', 'phone', 'email', 'address', 'notes'].filter(k => obj[k] && !String(ex[k] || '').trim());
        }
        vus.push(ligne);
        return ligne;
      }
      // Le catalogue. Chaque nombre dit ce qu'il est, et son refus aussi — accordé à la main :
      // « une quantité négatif » se lit.
      const nombre = (k, quoi, negatif) => {
        const brut = lire(r, k);
        const v = nombreImport(brut);
        if (v === null) return null;
        if (Number.isNaN(v)) { refus(`« ${brut} » n'est pas ${quoi}. Écris-le en chiffres.`); return null; }
        if (v < 0) { refus(`${negatif} (« ${brut} ») n'existe pas.`); return null; }
        return v;
      };
      const label = lire(r, 'label');
      if (!label) refus('la désignation manque — c\'est elle qui s\'écrit sur la ligne du devis.');
      let vat = null;
      const vBrut = lire(r, 'vatRate');
      if (vBrut) {
        let v = nombreImport(vBrut);
        if (v !== null && !Number.isNaN(v) && v > 0 && v < 1) v = Math.round(v * 10000) / 100;
        if (v === null || Number.isNaN(v) || !VAT_RATES.includes(v)) refus(`TVA « ${vBrut} » inconnue : SkanFact connaît ${liste(VAT_RATES.map(x => x + ' %'))}.`);
        else vat = v;
      }
      if (vat == null) vat = vatDefaut;
      if (!assujetti && vat > 0) { ligne.avert.push(`TVA mise à 0 % au lieu de ${vat} % : ton régime ne facture pas de TVA.`); vat = 0; }
      let prix = nombre('unitPrice', 'un prix', 'un prix négatif');
      const ttc = nombre('unitPriceTTC', 'un prix', 'un prix négatif');
      if (prix == null && ttc != null) prix = round3(ttc / (1 + vat / 100));
      const cout = nombre('unitCost', 'un coût', 'un coût négatif');
      const qte = nombre('initialQty', 'une quantité', 'un stock de départ négatif');
      const obj = { label, description: lire(r, 'description'), unit: uniteImport(lire(r, 'unit')), unitPrice: prix || 0, unitCost: cout || 0, vatRate: vat };
      if (qte) Object.assign(obj, { tracked: true, initialQty: qte, initialCost: cout || 0 });
      ligne.objet = obj;
      if (ligne.statut === 'refus') return ligne;
      const cle = cleNom(label);
      const avant = vus.find(v => cleNom(v.objet.label) === cle);
      if (avant) { ligne.statut = 'doublon'; ligne.motifs.push(`même prestation que la ligne ${avant.n}`); return ligne; }
      const ex = existants.find(c => cleNom(c.label) === cle);
      if (ex && ex.fromSetup) { ligne.statut = 'remplace'; ligne.existant = ex.id; }
      else if (ex) {
        ligne.statut = 'existe'; ligne.existant = ex.id;
        ligne.complete = [['description', !String(ex.description || '').trim() && obj.description], ['unit', !String(ex.unit || '').trim() && obj.unit],
          ['unitCost', !(Number(ex.unitCost) > 0) && obj.unitCost > 0]].filter(([, oui]) => oui).map(([k]) => k);
        // Le stock d'une prestation qui existe déjà a peut-être déjà bougé : un stock de départ
        // posé après coup réécrirait son histoire. On le DIT au lieu de l'avaler (règle 9.8.0).
        if (obj.tracked) ligne.avert.push('le stock de départ n\'est pas repris sur une prestation qui existe déjà : passe par un mouvement sur la page Stock.');
      }
      // Un stock de départ SANS coût d'achat vaut zéro : la valeur du stock l'affiche, et chaque
      // vente le sort au coût nul — sa marge paraît trop belle, sans un mot (vu à la souris : un
      // tarif collé avec sa colonne « Stock » et sans colonne « Coût » annonçait 258 articles
      // valant 0,000 DT). On ne l'invente pas : on le DIT, là où l'on peut encore l'ajouter.
      if (obj.tracked && !(obj.initialCost > 0) && ligne.statut !== 'existe') {
        ligne.avert.push(`stock de départ de ${qte} sans coût d'achat : il vaudra 0 dans ton stock, et la marge de ses ventes paraîtra trop belle tant que tu n'as pas renseigné ce coût (une colonne « Coût » dans ta liste, ou sa fiche).`);
      }
      vus.push(ligne);
      return ligne;
    });
    const compte = st => lignes.filter(l => l.statut === st).length;
    // Les exemples de l'assistant que la liste n'a pas repris : on propose de les retirer, s'ils ne
    // servent à aucune pièce — un catalogue de quarante prix réels n'a que faire de huit exemples.
    const repris = new Set(lignes.filter(l => l.statut === 'remplace').map(l => l.existant));
    const servi = c => [...(d.documents || []), ...(d.templates || []), ...(d.recurring || [])]
      .some(x => (x.lines || []).some(l => l.itemId === c.id || cleNom(l.label) === cleNom(c.label)));
    const exemples = type === 'catalogue' && lignes.some(l => ['nouveau', 'remplace'].includes(l.statut))
      ? (d.catalog || []).filter(c => c.fromSetup && !repris.has(c.id) && !servi(c)).map(c => ({ id: c.id, label: c.label }))
      : [];
    return {
      type, sep, entete, titres, colonnes, largeur, lignes, exemples, autreListe, titresAutre: autreListe ? titresAutre : [],
      nouveaux: compte('nouveau'), remplaces: compte('remplace'), doublons: compte('doublon'), refus: compte('refus'),
      completes: lignes.filter(l => l.statut === 'existe' && l.complete.length).length,
      inchanges: lignes.filter(l => l.statut === 'existe' && !l.complete.length).length,
      // Un stock de départ EST un mouvement de stock : l'écran le passe par le garde-fou de l'offre,
      // comme la fiche d'un article (7.33.0).
      stock: lignes.some(l => ['nouveau', 'remplace'].includes(l.statut) && l.objet && l.objet.tracked)
    };
  }

  // Appliquer un plan : les nouvelles fiches entrent, les existantes se COMPLÈTENT (jamais un champ
  // rempli ne change), les exemples repris deviennent tiens, et — si on l'a demandé — les exemples
  // restés sans usage partent (et le disent à l'autre poste d'un dossier partagé, `trackDeletion`).
  function appliquerImport(data, plan, company, opts) {
    const o = opts || {};
    const out = { crees: [], completes: 0, remplaces: 0, retires: 0 };
    const clients = plan.type === 'clients';
    const liste = clients ? data.clients : data.catalog;
    const jour = o.jour || today();
    plan.lignes.forEach(l => {
      if (l.statut === 'nouveau') {
        const x = clients ? clientVierge(l.objet) : articleVierge(company, l.objet, jour);
        liste.push(x); out.crees.push(x.id);
      } else if (l.statut === 'existe' && l.complete.length) {
        const x = liste.find(y => y.id === l.existant);
        if (x) { l.complete.forEach(k => { x[k] = l.objet[k]; }); out.completes++; }
      } else if (l.statut === 'remplace') {
        const x = liste.find(y => y.id === l.existant);
        if (x) {
          ['label', 'unitPrice', 'vatRate'].forEach(k => { x[k] = l.objet[k]; });
          ['description', 'unit'].forEach(k => { if (l.objet[k]) x[k] = l.objet[k]; });
          if (l.objet.unitCost) x.unitCost = l.objet.unitCost;
          // Un exemple de l'assistant n'a jamais été suivi en stock (l'enregistrer lui retire son
          // repère d'exemple) : son stock de départ n'a pas d'histoire à réécrire.
          if (l.objet.tracked) Object.assign(x, { tracked: true, initialQty: l.objet.initialQty, initialCost: l.objet.initialCost, initialDate: jour });
          delete x.fromSetup;
          out.remplaces++;
        }
      }
    });
    if (o.retirerExemples && plan.exemples && plan.exemples.length) {
      const ids = new Set(plan.exemples.map(e => e.id));
      data.catalog.filter(c => ids.has(c.id)).forEach(c => trackDeletion(data, 'catalog', c.id, c.label));
      const avant = data.catalog.length;
      data.catalog = data.catalog.filter(c => !ids.has(c.id));
      out.retires = avant - data.catalog.length;
    }
    return out;
  }

  // Le texte d'un fichier ouvert pour l'import. Un CSV enregistré par Excel sous Windows est en
  // Windows-1252, pas en UTF-8 : lu comme de l'UTF-8, « Hôtel » devenait « H�tel » sur chaque fiche.
  // Un classeur (.xlsx, .ods, .xls) n'est pas du texte : on le DIT, avec le geste qui marche, au
  // lieu d'afficher des caractères illisibles.
  function lireFichierTexte(octets, nom) {
    const u8 = octets instanceof Uint8Array ? octets : new Uint8Array(octets || []);
    const debut = Array.from(u8.slice(0, 4));
    const classeur = (debut[0] === 0x50 && debut[1] === 0x4b) ? 'un classeur (Excel .xlsx ou LibreOffice .ods)'
      : (debut[0] === 0xd0 && debut[1] === 0xcf && debut[2] === 0x11 && debut[3] === 0xe0) ? 'un classeur Excel (.xls)' : '';
    if (classeur) {
      return { ok: false, motif: `« ${nom || 'Ce fichier'} » est ${classeur}, pas du texte. Dans ton tableur, sélectionne les lignes, copie-les et colle-les ici — ou enregistre-le au format CSV, puis ouvre ce fichier-là.` };
    }
    let texte;
    if (debut[0] === 0xff && debut[1] === 0xfe) texte = new TextDecoder('utf-16le').decode(u8.slice(2));
    else if (debut[0] === 0xfe && debut[1] === 0xff) texte = new TextDecoder('utf-16be').decode(u8.slice(2));
    else {
      try { texte = new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (_) { texte = new TextDecoder('windows-1252').decode(u8); }
    }
    return { ok: true, texte: texte.replace(/^﻿/, '') };
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
    return TRI_FR.compare(String(x), String(y));
  }

  const api = {
    enLot, duLot,
    VAT_RATES, WITHHOLDING_RATES, PAYMENT_METHODS, PREFIX, TITLES, DEFAULT_DATA, DEFAULT_COMPANY, ACTIVITIES, STATUSES, STATUT_ENVOI, DISPLAY_STATUSES, STATUS_LABELS,
    REGIMES, regimeOf, regimeSuggere, tfpSuggere, assujettiTVA, mentionTVA, estLiberal, docLabel, ribAttendu,
    DOC_FILTRES, docFiltre,
    pageInfo, compareValues, LINE_UNITS, usedUnits, uniteAccordee, usedWithholdingRates, parseDateInput, fmtDateInput, monthMatrix,
    uid, round3, money, fmtDate, addDays, daysInMonth, today, jourDeLInstant, escapeHtml, nl2br, capitalAffiche, statusLabel,
    plier, correspondRecherche, rangRecherche, classerRecherche, delaiJours, typoFr,
    CLOSURE_ACTIONS, closedUntil, isClosedDate, closedPeriodLabel, closableMonths, rienACloturer, closureChecks, closePeriod, reopenPeriod, closureLog,
    PACK_FORMAT, packPeriod, packPlan, packChecklist, packFileName, packCoverHtml,
    // Les justificatifs (10.14.1, S-04)
    nomsJustificatifs, justificatifsDe, sansJustificatif, referenceAchat,
    DEFAULT_ACCOUNTS, ACCOUNT_LABELS, ENTRY_JOURNALS, journalLabel, chartAccounts, journalEntries,
    entriesBalance, entriesByAccount, entryCsvColumns, MOVE_ACCOUNTS, COMPTES_CONTREPARTIE, journalDeCompte, clotureValide,
    // Les questions du cabinet (9.10.0)
    QUESTION_ATTENDUS, QUESTION_RELANCE, questionsValides, fusionnerQuestionsRecues,
    questionsDeLaPiece, repondreQuestion, reponsesAEnvoyer, reponsesApres, questionsSansReponse, verdictEnvoiCabinet,
    numerosDuJournal, livreJournal, journalCentralisateur, centralisateurCsvColumns, centralisateurRows, inPeriod,
    odValide, odPiece, comptesProposes, lettrage, SECTIONS_ECRITURES,
    etatRapprochement, etatsFinanciers, etatsCsvRows, etatsCsvColumns, employerChargesOf,
    PLAN_COMPTABLE, accountLabel, classeDe, compteDeGestion, auxiliairesActifs, codesAuxiliaires, numeroterAuxiliaires,
    debutExercice, soldesOuverture, balanceGenerale, grandLivre, grandLivreRows, balanceAuxiliaire,
    balanceCsvColumns, balanceAuxCsvColumns, grandLivreCsvColumns,
    salesCsvColumns, buyCsvColumns, payCsvColumns, supplierPayCsvColumns, cashCsvColumns, cashCsvRows,
    estRemboursementAchat, avoirRembourse, aRattacherAchat, nextNumber, isLocked, isIssued, computeTotals, creditsFor, invoiceBalance, estRemboursement, titreQuestion, gesteQuestion, dateDernierReglement, motifVerrou, delaisContradictoires, effectiveStatus,
    depositLines, depositLinesMontant, acompteDit, settlementLines, salesJournal, vatSummary, paymentsJournal, toCsv, migrateData,
    PERIODS, MONTHS_FR, MONTHS_SHORT, monthLabel, deLibelle, addMonths, nextRecurrenceDate, dueRecurrences, catchUpRecurrence, fillTemplate, buildRecurringInvoice,
    reminderLevel, REMINDER_LABELS, daysBetween, overdueInvoices, facturesAVenir, todoList, companyGaps, verifRib, documentHistory, DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES_EN, emailFor,
    CURRENCIES, DEVISES_NOMS, libelleDevise, TYPES_NUMEROTES, etatNumerotation, poserNumerotation, premiereNumerotation, normCurrency, decimalsFor, arrondiDevise, prixDuCatalogue, toBase, rateOf, missingRate, monthKeys, monthlySeries, topClients, quoteStats, avgPaymentDelay, clientSummary, I18N,
    EXTRA_TYPES, SALES_TYPES, CONVERSIONS, CONVERSION_LABELS, convertDoc, retenueDuClient, derivedDocs, chaineDePieces, DEFAULT_CLAUSES, CLAUSE_LABELS,
    PURCHASE_KINDS, PURCHASE_LIES, piecesLieesAchat, LINE_DESTINATIONS, DEFAULT_EXPENSE_CATEGORIES, PURCHASE_STATUSES, expenseCategories,
    vatReturn, vatChain, reportTvaDebut, DEFAULT_FISCAL_DEADLINES, fiscalDeadlines, nextDeadline, upcomingFiscal, calendrierFiscal, dateLimiteSociale, dateLimiteDeclarationSociale, fiscalFilingId, fiscalDone, echeanceSociale, socialesDeposees, simpleResult,
    ACCOUNT_KINDS, MOVE_KINDS, virementVers, virementCotes, tauxDuReglement, montantRegle, ecartDuReglement, compteDepuisFiche, cashMovements, accountBalance, cashPosition, cashForecast, reconciliation,
    lineCost, documentMargin, marginBy, PROJECT_STATUSES, projectMargin, projectList, recurringProfitability, piecesDuContrat, contratSuivi,
    DEFAULT_FIXED_CATEGORIES, isFixedCategory, breakEven,
    DEFAULT_ASSET_CLASSES, assetClassLabel, assetClassYears, days360, assetSchedule, assetYear,
    assetCumulated, assetNBV, disposalResult, assetsList, assetTotals, assetsToCreate, immosEnAttente, immosHorsTableau, ligneDeFiche, biensADiminuer, depreciationFor,
    cappedCumulated,
    moisDePaie, anneesDePaie, premierePieceApres, MOVE_SOURCES, SOURCES_SORTIE, qteMouvement, moveSourceLabel, trackedItems, itemOfLine, stockMovements, runningStock, stockOf,
    stockList, stockTotals, stockJournal, inventoryDiff, stockAlerts, stockImpact, costOfGoodsSold, inventaireComptable, coutAchat, sceauEcritures, ecartsSceau,
    ocrNumber, ocrToPurchase,
    CONTRACT_TYPES, contractLabel, DEFAULT_PAYROLL, payrollSettings, irppAnnual, computePayslip, saisiePaieValide,
    activeEmployees, payslipView, payslipsOf, payslipDate, payrollCost, payrollSummary, missingPayslips, bulletinsImpossibles,
    payslipHtml,
    QUARTERS, quarterMonths, quarterLabel, cnssDeclaration, fichierCnssEntreprise, lireMatriculeCnss: Compta.lireMatriculeCnss, identiteCnss: Compta.identiteCnss, motifIdentiteCnss: Compta.motifIdentiteCnss, cnssNonDeclaree, employerAnnual, socialDue,
    LEAVE_KINDS, leaveKindLabel, leaveIsPaid, workingDays, leaveDaysInMonth, leavesOf, leaveBalance,
    advancesOf, advanceBalance, payslipInputFor, HR_DOCS, hrDocLabel, hrDocumentHtml, staffRegister,
    SERIAL_STATUSES, serialStatusLabel, WARRANTY_CHOICES, serializedItems, warrantyEnd, serialView,
    serialList, availableSerials, clientFleet, warrantiesEnding, serialGap, serialGaps,
    mergeData, trackDeletion, MERGE_LISTS, LIST_LABELS, LIST_PLURIELS, compteListe, piecesLiees,
    purchaseTotals, purchaseBalance, retenueDesReglements, retenueAOperer, retenueChrono, regularisationsRetenueAchats, retenueSubie, retenueASubir, regularisationsRetenueVentes, retenuesDeLaPeriode, attestationsARecevoir, purchaseStatus, achatDoublon, facturesDuDevis, payablesList, purchaseJournal, purchaseSummary, supplierSummary, withholdingsToIssue, supplierPayments,
    periodBounds, issuedIn, salesTotals, revenueByMonth, topItems, clientMovement, AGING_BUCKETS, agedReceivables, releveClient, releveHtml, mailReleve, payerRanking, quoteFunnel, objectiveProgress,
    amountToWords, intToWords, intToWordsEn, documentHtml, fitToPage, paginate, pageCount,
    MODULES, PAGES, moduleById, pageById, pageTitle, moduleCount, moduleCounts, modulesRevenus, moduleOn, moduleWhy, navPages, familleNavOuverte, FAMILLES_OUVERTES_AU_DEBUT,
    sousModuleOn, sousModuleById, sousModules, OPTION_LABELS,
    MODULES_PAR_ACTIVITE, modulesSuggeres, wipeData, rendreLesEmprunts, estDemo, exemplePerime, verdictMotDePasse, firstSteps, reussites, liste, defaultVat, seuilRetenue, sousSeuilRetenue, newLine, tauxPourRegime, tvaRecuperable, tvaNonDeductible, achatsHorsRegime, tauxAchatArticle, articlesSansTva, sourcesSansTva, factureSansTvaSuspecte, ligneFactureeSansTva, regimePourPiece, modelesParDefaut, modeleMail,
    contrasteSurBlanc, lisibiliteMarque, ACCENTS_PROPOSES, marquePersonnalisee,
    canalDe, estBeta, pastilleLicence, empreinteCabinet, licencesDuCabinet,
    LICENCE_MOTIFS, prorataOffre, licenceSuivi, licencesAFaire,
    EXPORT_CONSOLE_DELAI, exportConsoleAFaire,
    LICENCE_PREAVIS, licenceEtat, licenceRows, licencesExpirant,
    clientPourVente, chargeHistorique, facturesAAnnoncer,
    // L'import depuis un tableur, et le modèle vierge d'une fiche (10.14.0)
    clientVierge, articleVierge, IMPORT_CHAMPS, champDeEntete, decouperTableau, separateurTableau, uniteImport,
    planImport, appliquerImport, lireFichierTexte
  };
  // Les calculs qui LISENT beaucoup ouvrent leur propre lot : appelés d'un test, de la palette ou du
  // processus principal, ils profitent des index sans que l'appelant y pense. Aucun ne modifie les
  // données — un calcul qui écrit n'a rien à faire ici, il lirait ses propres index périmés.
  ['overdueInvoices', 'todoList', 'journalEntries', 'livreJournal', 'journalCentralisateur', 'agedReceivables',
    'cashForecast', 'cashMovements', 'payablesList', 'stockList', 'stockTotals', 'stockJournal', 'stockAlerts',
    'inventoryDiff', 'costOfGoodsSold', 'salesTotals', 'revenueByMonth', 'topItems', 'clientMovement', 'payerRanking',
    'quoteFunnel', 'releveClient', 'packPlan', 'packChecklist', 'closureChecks', 'simpleResult', 'breakEven',
    'marginBy', 'projectList', 'clientSummary', 'supplierSummary', 'balanceGenerale', 'grandLivre', 'etatsFinanciers', 'lettrage', 'firstSteps', 'reussites']
    .forEach(n => { const f = api[n]; if (typeof f === 'function') api[n] = function () { return enLot(() => f.apply(this, arguments)); }; });
  return api;
});
