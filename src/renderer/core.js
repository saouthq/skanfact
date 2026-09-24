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
      mention: 'TVA non applicable — régime forfaitaire',
      aide: 'Tu ne factures pas de TVA et tu ne la déduis pas. Tes factures portent la mention « TVA non applicable » et ne montrent aucune colonne TVA.'
    },
    {
      id: 'exonere', label: 'Exonéré de TVA', court: 'Exonéré', tva: false,
      mention: 'TVA non applicable — activité exonérée',
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
  function mentionTVA(company) { return regimeOf(company).mention || ''; }

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
  function pastilleLicence(lic) {
    const l = lic || {};
    const j = l.daysLeft;
    if (l.locked) return { show: true, ton: 'alerte', texte: (l.label || 'Licence requise') + ' — voir Paramètres → L\'application → Licence' };
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

  function round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

  const CURRENCIES = ['DT', 'EUR', 'USD', 'GBP', 'CHF', 'MAD', 'DZD'];
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
  function money(n, currency, decimals, lang) {
    const v = round3(n);
    const neg = v < 0;
    const dec = decimals != null ? decimals : decimalsFor(currency);
    const en = lang === 'en';
    // Espaces INSÉCABLES (10.12.0) : entre les milliers, avant la devise, après le signe. Une espace
    // ordinaire laissait le navigateur couper un montant en fin de ligne — « 4 » d'un côté, « 530,188
    // DT » de l'autre, dans la phrase qui annonce le solde d'un acompte. Un montant se lit d'un bloc.
    const s = Math.abs(v).toFixed(dec).replace('.', en ? '.' : ',').replace(/\B(?=(\d{3})+(?!\d))/g, en ? ',' : '\u00a0');
    const out = (neg ? '−\u00a0' : '') + s;
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
  const plFr = (n, un, plur) => `${n} ${Math.abs(n) > 1 ? (plur || un + 's') : un}`;
  const sAccord = n => (Number(n) > 1 ? 's' : '');

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
  const plier = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function correspondRecherche(texte, q) {
    const mots = plier(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return true;
    const t = plier(texte);
    return mots.every(m => t.includes(m));
  }

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
        id: d.id, date: d.date, number: d.number, type: d.type, typeLabel: TITLES[d.type], client: clientName(d.clientId), clientId: d.clientId || '', subject: d.subject || '',
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
        rows.push({ id: p.id, date: p.date, number: d.number, client: clientName(d.clientId), clientId: d.clientId || '', amount: toBase(d, p.amount, company), method: m ? m[1] : (p.method || ''), reference: p.reference || '', note: p.note || '', docId: d.id, currency: d.currency || company.currency, accountId: p.accountId || '' });
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
      if (last && d.date) delays.push(delaiConstate(d.date, last));
    });
    return {
      docs, ht, paid, due, count: docs.length, invoiceCount: invoices.length, quoteCount: quotes.length,
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
      const last = d.payments.map(p => p.date).sort().pop();
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
  const PURCHASE_STATUSES = ['à payer', 'partiel', 'retard', 'payée', 'à imputer', 'imputé'];

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
    const baseByDestination = {};
    Object.keys(byDestination).forEach(k => { baseByDestination[k] = estAvance ? 0 : conv(byDestination[k]); });
    const base = {
      totalHT: conv(totalHT), totalVAT: conv(totalVAT), deductibleVAT: conv(deductibleVAT),
      fees: estAvance ? 0 : conv(fees), totalTTC: conv(totalTTC), withholding: conv(withholding),
      netToPay: conv(netToPay), vatByRate: baseVatByRate, byDestination: baseByDestination,
      avance: estAvance ? conv(round3(totalHT + fees)) : 0
    };
    return {
      lines, totalHT, vatByRate, totalVAT, deductibleVAT, fees, totalTTC, withholdingRate, withholding, netToPay, byDestination,
      currency: purchase.currency || (company || {}).currency || '', rate: rateOf(purchase, company || {}), sens, base
    };
  }

  // Les avoirs et les acomptes rattachés à une facture d'achat (10.2.0). Le symétrique de
  // `creditsFor` côté ventes. `achatLie` porte l'identifiant de la facture concernée ; tant qu'il
  // est vide, la pièce est LIBRE — un avoir qu'on n'a pas encore imputé, un acompte versé avant que
  // la facture n'arrive. C'est un état normal, pas une erreur : « À faire » le rappelle.
  function piecesLieesAchat(data, purchaseId, kind) {
    if (!purchaseId) return [];
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
      return { totals, paid, liees: [], impute: 0, remaining: purchase.achatLie ? 0 : round3(paid - totals.netToPay) };
    }
    const liees = data ? piecesLieesAchat(data, purchase.id) : [];
    // Un avoir et un acompte se déduisent de la même façon, et dans la MÊME devise : un fournisseur
    // avoise et encaisse dans la devise où il a facturé. L'éditeur le refuse autrement.
    const impute = round3(liees.reduce((s, x) => s + purchaseTotals(x, company).netToPay, 0));
    return { totals, paid, liees, impute, remaining: round3(totals.netToPay - paid - impute) };
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
    return (data.documents || []).filter(d => d.type === 'facture' && d.fromQuoteId === quoteId);
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
    if (purchase.kind === 'avoir') return purchase.achatLie ? 'imputé' : 'à imputer';
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
    (data.purchases || []).forEach(p => (p.payments || []).forEach(x => {
      if (!inPeriod(x.date, period && period.from, period && period.to)) return;
      const m = PAYMENT_METHODS.find(k => k[0] === x.method);
      out.push({
        id: x.id, purchaseId: p.id, date: x.date, number: p.number || '', supplier: name(p.supplierId), supplierId: p.supplierId || '',
        // Un règlement porté par un AVOIR est un remboursement : l'argent ENTRE (10.2.0). Le signe
        // suffit — `entrySet` change alors la colonne tout seul, et la trésorerie suit.
        amount: round3((p.kind === 'avoir' ? -1 : 1) * toBase(p, Number(x.amount) || 0, company)), method: m ? m[1] : (x.method || ''),
        currency: p.currency || company.currency, reference: x.reference || '', note: x.note || '', accountId: x.accountId || ''
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
          kind: (PURCHASE_KINDS.find(k => k[0] === (p.kind || 'facture')) || PURCHASE_KINDS[0])[1], category: p.category || '',
          ht: t.base.totalHT, tva: t.base.totalVAT, deductible: t.base.deductibleVAT, fees: t.base.fees,
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
    const mine = (data.purchases || []).filter(p => p.supplierId === supplierId);
    let ht = 0, remaining = 0, late = 0;
    mine.forEach(p => {
      const b = purchaseBalance(p, company, data);
      ht = round3(ht + b.totals.base.totalHT);
      if (b.remaining > 0.0005) {
        remaining = round3(remaining + toBase(p, b.remaining, company));
        if (purchaseStatus(p, company, todayIso, data) === 'retard') late = round3(late + toBase(p, b.remaining, company));
      }
      // Un avoir non imputé est un CRÉDIT chez ce fournisseur : il vient en moins de ce qu'on lui
      // doit, et il se voit sur sa fiche (10.2.0). Le laisser hors du compte ferait payer une
      // facture qu'un avoir couvrait déjà.
      if (p.kind === 'avoir' && !p.achatLie) remaining = round3(remaining + toBase(p, b.remaining, company));
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
      .map(x => ({ id: x.p.id, supplier: name(x.p.supplierId), number: x.p.number || '', date: x.p.date, amount: x.t.base.withholding, rate: x.t.withholdingRate }))
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
    const rows = Object.values(acc).map(a => ({
      ...a, margin: round3(a.revenue - a.cost),
      rate: a.revenue !== 0 ? Math.round((a.revenue - a.cost) / a.revenue * 1000) / 10 : null,
      complete: a.lines > 0 && a.costed === a.lines
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
      if (d.type === 'facture') {
        const b = invoiceBalance(d, data, company);
        collected = round3(collected + toBase(d, round3(t.netToPay - b.remaining), company));
      }
    });
    let cost = 0, paid = 0;
    buys.forEach(p => {
      const t = purchaseTotals(p, company);
      cost = round3(cost + t.base.totalHT + t.base.fees);
      paid = round3(paid + toBase(p, purchaseBalance(p, company, data).paid, company));
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
    linked.forEach(p => { const t = purchaseTotals(p, company); cost = round3(cost + t.base.totalHT + t.base.fees); });
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
      const charge = round3(t.base.byDestination.charge + t.base.fees);
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
          unitCost: toBase(p, Number(l.unitPrice) || 0, data.company || {}),
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
  //
  // TOUTE sortie qui n'est pas un achat ni le stock de départ coûte ce qu'elle a coûté : la vente, mais
  // aussi la casse, l'écart d'inventaire et la matière utilisée sur un chantier. Jusqu'en 10.12.0 seules
  // les ventes comptaient : une menuiserie qui achète des planches et les transforme en portes ne voyait
  // jamais son bois en charge — son résultat était gonflé de tout ce qu'elle avait consommé. Et un retour
  // sur avoir rend son coût : sans ça, la marchandise revenue en rayon restait comptée comme vendue.
  // (La comptabilité, elle, passe les achats au 607 et l'inventaire au 603 : ce chiffre ne sert qu'aux
  // vues de gestion — résultat simplifié, seuil de rentabilité.)
  function costOfGoodsSold(data, period) {
    return round3(stockJournal(data, period)
      .filter(m => !SOURCES_HORS_CHARGE.includes(m.source))
      .reduce((s, m) => s - (Number(m.qty) || 0) * (Number(m.unitApplied) || 0), 0));
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
          number: p.number || '', date: p.date, base: round3(t.base.totalTTC - t.base.fees),
          rate: Number(p.withholdingRate) || 0, amount: t.base.withholding, certificate: !!p.withholdingCertificate };
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
  const questionsValides = Compta.questionsValides;

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
        // Ce qui sort du compte sort en DINARS (10.1.0), comme l'encaissement client dix lignes
        // plus haut : régler 500 € vide le compte de 1 700 DT, pas de 500. Sans ça, la trésorerie
        // de la page et celle du grand livre se contredisaient — et c'est le test des états
        // financiers qui l'a dit, pas la relecture.
        amount: -round3(toBase(pu, Number(p.amount) || 0, company)), method: p.method || '',
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
      Object.keys(t.vatByRate).forEach(rate => {
        if (!byRate[rate]) byRate[rate] = { collected: 0, deductible: 0 };
        byRate[rate].deductible = round3(byRate[rate].deductible + t.base.vatByRate[rate].deductible);
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
  // Une échéance déjà déposée ne doit plus crier. La clé est `ruleId + date` : c'est une OCCURRENCE
  // qu'on pointe, pas une règle — la TVA d'octobre se dépose, celle de novembre reste due.
  const fiscalFilingId = (ruleId, dateIso) => `${ruleId}@${dateIso}`;
  function fiscalDone(data) { return new Set((data.fiscalFilings || []).map(f => f.id)); }

  function upcomingFiscal(data, todayIso, withinDays) {
    const t = todayIso || today();
    const within = Number(withinDays) || 30;
    const done = fiscalDone(data);
    return fiscalDeadlines(data).filter(r => r.active !== false).map(r => {
      let date = nextDeadline(r, t);
      // Déjà déposée : on saute à l'occurrence suivante plutôt que de faire disparaître la règle —
      // sinon pointer la TVA d'octobre effacerait aussi celle de novembre.
      let garde = 0;
      while (date && done.has(fiscalFilingId(r.id, date)) && garde++ < 24) {
        date = nextDeadline(r, addDays(date, 1));
      }
      return date ? { id: r.id, label: r.label, note: r.note || '', date, days: daysBetween(t, date),
        filingId: fiscalFilingId(r.id, date) } : null;
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
      charges = round3(charges + t.base.byDestination.charge + t.base.fees);
      stock = round3(stock + t.base.byDestination.stock);
      immo = round3(immo + t.base.byDestination.immobilisation);
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
  function closureChecks(data, company, from, to) {
    const out = [];
    const inRange = d => d && d >= from && d <= to;
    const add = (id, level, label, detail, count) => { if (count) out.push({ id, level, label, detail, count }); };

    const drafts = (data.documents || []).filter(d => d.type === 'facture' && d.status === 'brouillon' && inRange(d.date));
    add('brouillons', 'danger', `${plFr(drafts.length, 'facture')} en brouillon dans la période`,
      'Un brouillon n\'a pas de numéro et n\'entre dans aucun journal. Émets-le ou change sa date avant de clôturer, sinon il restera invisible pour ton comptable.', drafts.length);

    const noProof = (data.purchases || []).filter(p => inRange(p.date) && !(p.attachments || []).length);
    add('justificatifs', 'warn', `${plFr(noProof.length, 'achat')} sans justificatif`,
      'Sans la pièce jointe, ton comptable ne peut pas récupérer la TVA de ces achats.', noProof.length);

    const unticked = cashMovements(data, company).filter(m => inRange(m.date) && !m.reconciled);
    add('pointage', 'warn', `${plFr(unticked.length, 'mouvement')} non pointé${sAccord(unticked.length)}`,
      'Pointer les mouvements contre le relevé bancaire, c\'est ce qui prouve que la trésorerie est juste.', unticked.length);

    // Bulletins manquants : un salarié actif sans bulletin sur un mois travaillé
    const months = [];
    let m = from.slice(0, 7);
    while (m <= to.slice(0, 7) && months.length < 24) { months.push(m); m = addMonths(m + '-01', 1, 1).slice(0, 7); }
    const slipsMissing = months.reduce((s, mm) =>
      s + missingPayslips(data, Number(mm.slice(0, 4)), Number(mm.slice(5, 7))).length, 0);
    add('bulletins', 'danger', `${plFr(slipsMissing, 'bulletin')} de paie à établir`,
      'Un salarié payé sans bulletin, c\'est une charge qui manque au résultat et une déclaration sociale fausse.', slipsMissing);

    const negative = stockList(data).filter(s => s.qty < 0);
    add('stock', 'warn', `${plFr(negative.length, 'article')} en stock négatif`,
      'Un stock négatif est une pièce d\'achat manquante, pas une erreur de comptage.', negative.length);

    const gaps = serialGaps(data);
    add('series', 'warn', `${plFr(gaps.length, 'écart')} entre quantités et numéros de série`,
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
  // Les LIGNES du journal de trésorerie, dans la forme que ses colonnes réclament. `cashMovements`
  // rend `kind`, `accountId` et un `amount` signé ; les colonnes demandaient `kindLabel`,
  // `accountName`, `inAmount` et `outAmount` — quatre clés que personne n'écrivait, donc quatre
  // colonnes vides dans CHAQUE paquet envoyé depuis la 6.1.0, sans qu'aucun message ne le dise
  // (T-01). Un test confronte désormais chaque clé des colonnes aux lignes produites ici.
  function cashCsvRows(data, moves) {
    const accName = id => ((data.accounts || []).find(a => a.id === id) || {}).name || '';
    const nature = m => m.source === 'vente' ? 'Encaissement client'
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
      label: `${plFr(certs.length, 'attestation')} de retenue à la source non remise${sAccord(certs.length)}`,
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
    const vat = vatReturn(data, company, period, (data.vatCarryIn || {})[period.month.slice(0, 4)] || 0);
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
    repriseSubventions: '739'    // Quote-part de subvention reprise au résultat (À VÉRIFIER)
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
    subventions: 'Subventions d\'investissement', repriseSubventions: 'Quote-part de subvention reprise'
  };
  // Un mouvement libre de trésorerie (3.3.0) porte une NATURE ; la 8.9.0 lui donne sa contrepartie.
  // La nature décide par défaut ; un mouvement peut porter son propre `compte` (la TVA du mois
  // réglée en « impôt » va au 4365, pas au 434). Ce que personne ne sait ranger va au compte
  // d'attente : c'est le comptable qui ventile, et c'est écrit.
  const MOVE_ACCOUNTS = {
    salaire: 'personnel', impot: 'impots', banque: 'fraisBancaires', retrait: 'associes', emprunt: 'emprunts',
    'autre-sortie': 'attente', apport: 'associes', pret: 'emprunts', 'autre-entree': 'attente'
  };
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
    const lettreAchat = p => (p && purchaseBalance(p, company, data).remaining <= 0.0005 && (p.payments || []).length) ? (p.number || p.id) : '';
    const achatsById = {}; (data.purchases || []).forEach(p => { achatsById[p.id] = p; });

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
        // Ce que le client devra réellement payer (le net après retenue) reste au compte client ;
        // la retenue devient une créance sur l'État. À VÉRIFIER : certains cabinets la constatent
        // seulement au paiement.
        e.debit(cptClient(r.clientId), label, r.net, { role: 'clients' });
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
          const e = entrySet({ date: p.date, journal: 'AC', piece: num, tiers: sup, tiersId: p.supplierId || '', source: 'achat', docId: p.id, currency: cur, lettre: lettreAchat(p) });
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
          // TVA non déductible : elle n'est pas récupérable, elle grossit la charge.
          const nonDeductible = round3(t.base.totalVAT - t.base.deductibleVAT);
          if (nonDeductible) e.debit(p.kind === 'acompte' ? acc.avancesFournisseurs : acc.charges, `TVA non déductible ${num}`, nonDeductible);
          if (t.base.withholding) e.credit(acc.rsOperee, `Retenue à la source opérée ${num}`, t.base.withholding);
          e.credit(cptFourn(p.supplierId), label, t.base.netToPay, { role: 'fournisseurs' });
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
              const im = entrySet({ date: p.date, journal: 'OD', piece: num, tiers: sup, tiersId: p.supplierId || '', source: 'achat', docId: p.id, currency: cur });
              const lbl = `Imputation acompte ${a.number || ''} sur ${num}`.replace('  ', ' ');
              im.debit(cptFourn(p.supplierId), lbl, ta.base.netToPay, { role: 'fournisseurs' });
              if (ta.base.withholding) im.debit(acc.rsOperee, lbl, ta.base.withholding);
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
        const label = `Règlement ${r.number || ''}${r.client ? ' — ' + r.client : ''}${r.reference ? ' (' + r.reference + ')' : ''}`;
        e.debit(j.compte, label, r.amount);
        e.credit(cptClient(r.clientId), label, r.amount, { role: 'clients' });
        out.push(...e.done());
      });
    }

    // --- règlements fournisseurs
    if (want('reglements')) {
      supplierPayments(data, company, period).forEach(r => {
        const j = journalDeCompte(data, acc, r.accountId, r.method);
        const e = entrySet({ date: r.date, journal: j.journal, piece: r.number || '', tiers: r.supplier, tiersId: r.supplierId || '', source: 'règlement', docId: r.purchaseId, currency: cur, lettre: lettreAchat(achatsById[r.purchaseId]) });
        const label = `Règlement fournisseur ${r.number || ''}${r.supplier ? ' — ' + r.supplier : ''}`;
        e.debit(cptFourn(r.supplierId), label, r.amount, { role: 'fournisseurs' });
        e.credit(j.compte, label, r.amount);
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
      // Le crédit de TVA saisi à la main pour une année (3.1.0) : la déclaration de janvier le
      // reprend, donc le compte 4366 doit le porter, sinon il finirait créditeur de ce montant.
      Object.keys(data.vatCarryIn || {}).forEach(y => {
        const montant = round3(Number(data.vatCarryIn[y]) || 0);
        const d = `${y}-01-01`;
        if (!montant || !/^\d{4}$/.test(y) || !inPeriod(d, period && period.from, period && period.to)) return;
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
      (data.movements || []).forEach(m => {
        const montant = round3(Math.abs(Number(m.amount) || 0));
        if (!montant || !inPeriod(m.date, period && period.from, period && period.to)) return;
        const j = journalDeCompte(data, acc, m.accountId, m.method);
        const nature = (MOVE_KINDS.find(k => k[0] === m.kind) || [null, 'Mouvement'])[1];
        const contrepartie = String(m.compte || '').trim() || acc[MOVE_ACCOUNTS[m.kind] || 'attente'];
        const e = entrySet({ date: m.date, journal: j.journal, piece: m.reference || nature, tiers: '', tiersId: '', source: 'mouvement', docId: m.id, currency: cur });
        const label = m.label || nature;
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
      [...annees].sort().forEach(y => {
        vatChain(data, company, y).forEach(m => {
          const dernier = `${m.month}-${pad2(daysInMonth(Number(y), Number(m.month.slice(5, 7))))}`;
          if (dernier >= t || !inPeriod(dernier, period && period.from, period && period.to)) return;
          if (!m.collected && !m.stamps && !m.withheldOnBuys) return;
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
          let net = 0;
          reelles.forEach(e => {
            const v = round3(e.debit - e.credit);
            if (compteDeGestion(e.account)) net = round3(net + v);
            else soldes[e.account] = round3((soldes[e.account] || 0) + v);
          });
          const e = entrySet({ date: d, journal: 'AN', piece: `AN-${y}`, tiers: '', tiersId: '', source: 'anouveau', docId: 'an-' + y, currency: cur });
          Object.keys(soldes).sort().forEach(k => {
            if (!soldes[k]) return;
            const label = `À-nouveau ${y} — ${accountLabel(data, k)}`;
            if (soldes[k] > 0) e.debit(k, label, soldes[k]); else e.credit(k, label, -soldes[k]);
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
      || (a.piece || '').localeCompare(b.piece || '', undefined, { numeric: true }));
  }
  const SECTIONS_ECRITURES = ['ventes', 'achats', 'encaissements', 'reglements', 'ouverture', 'tresorerie', 'paie', 'declarations', 'od', 'amortissements', 'anouveaux'];

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
  function odValide(od) {
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
    if (lignes.length >= 2 && round3(debit - credit) !== 0) erreurs.push(`Débit ${debit.toFixed(3)} ≠ crédit ${credit.toFixed(3)} : l'écriture ne tombe pas juste.`);
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
  function comptesProposes(data, company) {
    const vus = {};
    journalEntries(data, company, { from: '', to: '' }, {}).forEach(e => { if (e.account && !vus[e.account]) vus[e.account] = accountLabel(data, e.account, e.role ? e.tiers : ''); });
    const out = Object.keys(vus).sort().map(n => ({ compte: n, label: vus[n], utilise: true }));
    PLAN_COMPTABLE.forEach(([n, l]) => { if (n.length >= 2 && !vus[n]) out.push({ compte: n, label: l, utilise: false }); });
    return out;
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
        if (b.remaining <= 0.0005) { r.lettrees++; return; }
        const montant = round3(toBase(d, b.totals.netToPay, company)), reste = round3(toBase(d, b.remaining, company));
        r.ouverts.push({ id: d.id, piece: d.number, date: d.date, echeance: d.dueDate || '', montant, regle: round3(montant - reste), reste, retard: !!(d.dueDate && d.dueDate < t) });
        r.reste = round3(r.reste + reste);
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
        const montant = round3(toBase(p, b.totals.netToPay, company)), reste = round3(toBase(p, b.remaining, company));
        // « Réglé » reste ce qui a été PAYÉ : pour un avoir non imputé, `montant − reste` compterait
        // l'avoir deux fois (son reste est négatif).
        r.ouverts.push({ id: p.id, piece: p.number || '(sans numéro)', date: p.date, echeance: p.dueDate || '', montant, regle: round3(toBase(p, b.paid, company)), reste, retard: !!(p.dueDate && p.dueDate < t) });
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
    const est = (r, pref) => r.account.startsWith(pref);
    const amort = r => est(r, '28') || est(r, '29') || est(r, '39') || est(r, '49') || est(r, '59') || r.account === acc.amortissements;
    const ligne = r => ({ account: r.account, label: r.label, montant: r.solde });
    const groupe = (titre, pred, signe) => {
      const l = rows.filter(pred).map(r => ({ account: r.account, label: r.label, montant: round3(signe * r.solde) }));
      return { titre, lignes: l, total: round3(l.reduce((s, x) => s + x.montant, 0)) };
    };
    const actif = [
      groupe('Actifs non courants (valeur brute)', r => r.classe === '2' && !amort(r), 1),
      groupe('Amortissements et provisions', r => r.classe === '2' && amort(r), 1),
      groupe('Stocks', r => r.classe === '3', 1),
      groupe('Clients et autres créances', r => r.classe === '4' && r.solde > 0, 1),
      groupe('Trésorerie', r => r.classe === '5' && r.solde > 0, 1)
    ];
    const passif = [
      groupe('Capitaux propres et résultats reportés', r => r.classe === '1', -1),
      groupe('Fournisseurs et autres dettes', r => r.classe === '4' && r.solde < 0, -1),
      groupe('Concours bancaires', r => r.classe === '5' && r.solde < 0, -1)
    ];
    const produits = groupe('Produits', r => r.classe === '7', -1);
    const charges = groupe('Charges', r => r.classe === '6', 1);
    const resultat = round3(produits.total - charges.total);
    const totalActif = round3(actif.reduce((s, g) => s + g.total, 0));
    const totalPassif = round3(passif.reduce((s, g) => s + g.total, 0) + resultat);
    return {
      year: y, to, actif, passif, produits, charges, resultat, totalActif, totalPassif,
      equilibre: round3(totalActif - totalPassif) === 0,
      // Ce que la dotation de l'exercice en cours attend : elle ne s'écrit qu'au 31 décembre — sauf
      // celle d'un bien cédé, déjà passée au jour de la sortie, qu'on ne compte donc pas deux fois.
      dotationEnAttente: to < `${y}-12-31` ? round3(Math.max(0, depreciationFor(data, { from: `${y}-01-01`, to }) - charges.lignes.filter(l => l.account === acc.dotations).reduce((s, l) => s + l.montant, 0))) : 0,
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
      c.lignes.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.journal || '').localeCompare(b.journal || '') || (a.piece || '').localeCompare(b.piece || '', undefined, { numeric: true }));
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
    journalEntries(data, company, { from: '', to: addDays(period.from, -1) }, opts).forEach(e => {
      if (e.role !== role) return;
      const r = row(e); r.ouverture = round3(r.ouverture + e.debit - e.credit);
    });
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
    'issuedTs'];

  function convertDoc(doc, targetType, company, todayIso) {
    const date = todayIso || today();
    const copy = JSON.parse(JSON.stringify(doc));
    NOT_COPIED.forEach(k => { delete copy[k]; });
    delete copy.fromQuoteId; delete copy.fromQuoteNumber;
    const days = delaiJours(targetType === 'devis' ? company.quoteValidityDays : company.paymentTermsDays, 30);
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
      if (d.fromQuoteId === doc.id) quoi = d.deposit ? `acompte ${d.deposit.percent} %` : d.settles ? 'facture de solde' : 'facture du devis';
      else if (d.fromDocId === doc.id) quoi = 'issue de cette pièce';
      else if (d.creditOf === doc.id) quoi = 'avoir sur cette facture';
      else if (d.settles && d.settles.quoteId === doc.id) quoi = 'facture de solde';
      if (quoi) out.push({ id: d.id, number: d.number || '(brouillon)', type: d.type, quoi });
    });
    return out.sort((a2, b2) => (a2.number || '').localeCompare(b2.number || '', undefined, { numeric: true }));
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
  function releveClient(data, clientId, company, opts) {
    opts = opts || {};
    const t = opts.date || today();
    const client = (data.clients || []).find(c => c.id === clientId) || {};
    const lignes = [];
    (data.documents || [])
      .filter(d => d.clientId === clientId && (d.type === 'facture' || d.type === 'avoir')
        && d.status !== 'brouillon' && d.status !== 'annulée' && d.date <= t)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .forEach(d => {
        if (d.type === 'avoir') {
          // Un avoir qui vient en déduction d'une facture est DÉJÀ compté dans le reste dû de cette
          // facture (`invoiceBalance`) : le remontrer ferait un relevé deux fois trop favorable.
          // Seul un avoir libre — non rattaché — est une somme que le client peut encore employer.
          if (d.creditOf) return;
          const net = round3(toBase(d, computeTotals(d, company).netToPay, company));
          if (net <= 0.0005) return;
          lignes.push({ id: d.id, type: 'avoir', date: d.date, number: d.number || '', dueDate: '',
            libelle: d.subject || 'Avoir', montant: -net, regle: 0, reste: -net, retard: 0 });
          return;
        }
        const b = invoiceBalance(d, data, company);
        if (b.remaining <= 0.0005) return;
        const montant = round3(toBase(d, b.totals.netToPay, company));
        const reste = round3(toBase(d, b.remaining, company));
        lignes.push({
          id: d.id, type: 'facture', date: d.date, number: d.number || '', dueDate: d.dueDate || '',
          libelle: d.subject || '', montant, regle: round3(montant - reste), reste,
          retard: d.dueDate && d.dueDate < t ? daysBetween(d.dueDate, t) : 0
        });
      });
    const somme = k => round3(lignes.reduce((s, l) => s + l[k], 0));
    const echu = round3(lignes.filter(l => l.retard > 0).reduce((s, l) => s + l.reste, 0));
    return {
      client, date: t, currency: company.currency || 'DT', lignes,
      montant: somme('montant'), regle: somme('regle'), total: somme('reste'),
      echu, aVenir: round3(somme('reste') - echu),
      plusAncien: lignes.reduce((n, l) => Math.max(n, l.retard), 0)
    };
  }

  // Le relevé imprimable. Un document à part, comme les pièces du personnel (5.1.0) : ce n'est pas
  // une facture, il ne porte ni numéro, ni TVA, ni timbre — l'y faire passer par `documentHtml`
  // lui donnerait des mentions légales qui n'ont rien à y faire.
  function releveHtml(releve, company, opts) {
    opts = opts || {};
    const r = releve;
    const cur = r.currency;
    const fmt = n => money(n, null, decimalsFor(cur), 'fr');
    const ink = company.primaryColor || '#1b2430';
    const accent = company.accentColor || '#0f9d8f';
    const hex = accent.replace('#', '');
    const [rr, gg, bb] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const tint = a => `rgba(${rr}, ${gg}, ${bb}, ${a})`;
    const c = r.client || {};
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>Relevé de compte — ${escapeHtml(c.name || '')}</title>
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
        ${company.matricule ? `<br>MF : ${escapeHtml(company.matricule)}` : ''}</div></div>
    <div class="co-sub" style="text-align:end">${company.phone ? escapeHtml(company.phone) + '<br>' : ''}${company.email ? escapeHtml(company.email) : ''}</div>
  </div>
  <h1>Relevé de compte</h1>
  <p class="asof">Situation arrêtée au ${fmtDate(r.date)}${opts.stampText ? ' — ' + escapeHtml(opts.stampText) : ''}</p>
  <div class="who"><b>${escapeHtml(c.name || '')}</b>${c.matricule ? `<br>MF : ${escapeHtml(c.matricule)}` : ''}
    ${c.address ? '<br>' + escapeHtml(c.address).replace(/\n/g, '<br>') : ''}</div>
  ${r.lignes.length ? `<table class="l">
    <thead><tr><th>Date</th><th>Pièce</th><th>Objet</th><th>Échéance</th><th class="n">Montant</th><th class="n">Réglé</th><th class="n">Reste dû</th></tr></thead>
    <tbody>
      ${r.lignes.map(l => `<tr class="${l.retard > 0 ? 'late' : ''}">
        <td>${fmtDate(l.date)}</td>
        <td>${escapeHtml(l.number || '—')}</td>
        <td>${escapeHtml(l.libelle || '')}</td>
        <td>${l.dueDate ? fmtDate(l.dueDate) : '—'}${l.retard > 0 ? `<div class="lateflag">${l.retard} j de retard</div>` : ''}</td>
        <td class="n">${fmt(l.montant)}</td>
        <td class="n">${l.regle ? fmt(l.regle) : '—'}</td>
        <td class="n">${fmt(l.reste)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="6">Total dû au ${fmtDate(r.date)}</td><td class="n">${fmt(r.total)} ${escapeHtml(cur)}</td></tr>
    </tbody></table>
  <div class="recap">
    <div><div class="k">Échu</div><div class="v">${fmt(r.echu)} ${escapeHtml(cur)}</div></div>
    <div><div class="k">À échoir</div><div class="v">${fmt(r.aVenir)} ${escapeHtml(cur)}</div></div>
  </div>`
    : '<p>Aucune pièce ouverte à cette date : le compte est soldé. Merci de votre confiance.</p>'}
  ${r.total > 0.0005 && company.rib ? `<p class="pay">Règlement par virement : <b>${escapeHtml(company.rib)}</b>${company.bank ? ' — ' + escapeHtml(company.bank) : ''}</p>` : ''}
  <p class="pay">Ce relevé ne remplace pas les factures qu'il récapitule. Si un règlement s'est croisé avec son envoi, merci de ne pas en tenir compte.</p>
  <div class="foot">${escapeHtml(company.name || '')}${company.matricule ? ' — MF ' + escapeHtml(company.matricule) : ''}</div>
</div></body></html>`;
  }

  // Classement des payeurs : délai moyen constaté par client, sur ses factures soldées.
  function payerRanking(data, company, limit) {
    const out = [];
    (data.clients || []).forEach(c => {
      const delays = [];
      (data.documents || []).filter(d => d.type === 'facture' && d.clientId === c.id && d.status !== 'brouillon' && d.status !== 'annulée').forEach(d => {
        if (effectiveStatus(d, data, company, '9999-12-31') !== 'payée' || !(d.payments || []).length) return;
        const last = d.payments.map(p => p.date).sort().pop();
        if (last && d.date) delays.push(delaiConstate(d.date, last));
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
  function derniereDatePaiement(inv) {
    const dates = (inv.payments || []).map(p => p.date).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : '';
  }

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

    const overdue = overdueInvoices(data, company, t).filter(x => !x.snoozed);
    const overdueAmount = round3(overdue.reduce((s, x) => s + toBase(x.doc, x.remaining, company), 0));
    if (overdue.length) out.push({
      id: 'retards', level: 'danger', label: `${overdue.length} facture${overdue.length > 1 ? 's' : ''} en retard`,
      detail: `${fmt(overdueAmount)} à récupérer · plus ancienne : ${plFr(overdue[0].daysLate, 'jour')} de retard`,
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
    const fisc = upcomingFiscal(data, t, 14);
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
    const nonImputes = (data.purchases || []).filter(p => PURCHASE_LIES.includes(p.kind) && !p.achatLie);
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
      // Une étape ne peut pas se cocher parce que l'ASSISTANT l'a faite. Il propose les prestations
      // du métier avec des prix à 0 ; tant que le catalogue n'est que celui-là et qu'il reste des
      // zéros, il n'y a pas de catalogue — il y a des exemples. L'étape change alors de titre.
      catalogueStep(d),
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
        quoi: 'Une copie automatique vers iCloud ou OneDrive, un disque ou une clé USB. C\'est l\'étape que tout le monde saute, et la seule dont l\'absence coûte tout.',
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
      devis: 'Devis', facture: 'Facture', avoir: 'Avoir', issuedF: 'Émise le', issued: 'Émis le', dueBy: 'À régler avant le', dueLabel: 'À régler', onReceipt: 'À réception', validUntil: 'Valable jusqu\'au',
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
      devis: 'Quote', facture: 'Invoice', avoir: 'Credit note', issuedF: 'Issued on', issued: 'Issued on', dueBy: 'Due by', dueLabel: 'Due', onReceipt: 'On receipt', validUntil: 'Valid until',
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
    const showVat = assujettiTVA(company) || t.totalVAT > 0;
    const mentionSansTva = showVat ? '' : mentionTVA(company);
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

    const dueCard = d => d.dueDate && d.dueDate === d.date ? [L.dueLabel, L.onReceipt] : [L.dueBy, fmtDate(d.dueDate)];
    const metaItems = isInvoice ? [
      [L.issuedF, fmtDate(doc.date)],
      // 10.12.0 — un délai de 0 jour : « À régler avant le 24/09 » sous « Émise le 24/09 » se lit
      // comme un délai impossible. La mention d'usage est « à réception », et c'est la même date.
      dueCard(doc),
      doc.deposit ? [L.deposit, `${pct(doc.deposit.percent)} ${L.depositOf} ${doc.deposit.quoteNumber}`] : (doc.settles ? [L.balance, `${L.balanceOf} ${doc.settles.quoteNumber}`] : (doc.fromQuoteNumber ? [L.afterQuote, doc.fromQuoteNumber] : null)),
      doc.reference ? [L.reference, doc.reference] : null
    ] : isCredit ? [
      [L.issued, fmtDate(doc.date)],
      doc.creditOfNumber ? [L.cancels, L.facture + ' ' + doc.creditOfNumber] : null,
      doc.reference ? [L.reference, doc.reference] : null
    ] : isProforma ? [
      [L.established, fmtDate(doc.date)],
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
    if (foreign) metaItems.push([L.rate, `1 ${cur} = ${money(doc.exchangeRate, company.currency)}`]);
    const meta = metaItems.filter(Boolean).map(([k, v]) => `<div class="chip"><span class="ck">${escapeHtml(k)}</span><span class="cv">${escapeHtml(v)}</span></div>`).join('');

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
    VAT_RATES, WITHHOLDING_RATES, PAYMENT_METHODS, PREFIX, TITLES, DEFAULT_DATA, DEFAULT_COMPANY, ACTIVITIES, STATUSES, STATUT_ENVOI, DISPLAY_STATUSES, STATUS_LABELS,
    REGIMES, regimeOf, regimeSuggere, tfpSuggere, assujettiTVA, mentionTVA, estLiberal, docLabel, ribAttendu,
    DOC_FILTRES, docFiltre,
    pageInfo, compareValues, LINE_UNITS, usedUnits, usedWithholdingRates, parseDateInput, fmtDateInput, monthMatrix,
    uid, round3, money, fmtDate, addDays, daysInMonth, today, jourDeLInstant, escapeHtml, nl2br, capitalAffiche, statusLabel,
    plier, correspondRecherche, delaiJours,
    CLOSURE_ACTIONS, closedUntil, isClosedDate, closedPeriodLabel, closableMonths, rienACloturer, closureChecks, closePeriod, reopenPeriod, closureLog,
    PACK_FORMAT, packPeriod, packPlan, packChecklist, packFileName, packCoverHtml,
    DEFAULT_ACCOUNTS, ACCOUNT_LABELS, ENTRY_JOURNALS, journalLabel, chartAccounts, journalEntries,
    entriesBalance, entriesByAccount, entryCsvColumns, MOVE_ACCOUNTS, COMPTES_CONTREPARTIE, journalDeCompte, clotureValide,
    // Les questions du cabinet (9.10.0)
    QUESTION_ATTENDUS, QUESTION_RELANCE, questionsValides, fusionnerQuestionsRecues,
    questionsDeLaPiece, repondreQuestion, reponsesAEnvoyer, questionsSansReponse,
    numerosDuJournal, livreJournal, journalCentralisateur, centralisateurCsvColumns, centralisateurRows, inPeriod,
    odValide, odPiece, comptesProposes, lettrage, SECTIONS_ECRITURES,
    etatRapprochement, etatsFinanciers, etatsCsvRows, etatsCsvColumns, employerChargesOf,
    PLAN_COMPTABLE, accountLabel, classeDe, compteDeGestion, auxiliairesActifs, codesAuxiliaires, numeroterAuxiliaires,
    debutExercice, soldesOuverture, balanceGenerale, grandLivre, grandLivreRows, balanceAuxiliaire,
    balanceCsvColumns, balanceAuxCsvColumns, grandLivreCsvColumns,
    salesCsvColumns, buyCsvColumns, payCsvColumns, supplierPayCsvColumns, cashCsvColumns, cashCsvRows,
    nextNumber, isLocked, isIssued, computeTotals, creditsFor, invoiceBalance, motifVerrou, delaisContradictoires, effectiveStatus,
    depositLines, settlementLines, salesJournal, vatSummary, paymentsJournal, toCsv, migrateData,
    PERIODS, MONTHS_FR, MONTHS_SHORT, monthLabel, addMonths, nextRecurrenceDate, dueRecurrences, catchUpRecurrence, fillTemplate, buildRecurringInvoice,
    reminderLevel, REMINDER_LABELS, daysBetween, overdueInvoices, facturesAVenir, todoList, companyGaps, verifRib, documentHistory, DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES_EN, emailFor,
    CURRENCIES, normCurrency, decimalsFor, toBase, rateOf, missingRate, monthKeys, monthlySeries, topClients, quoteStats, avgPaymentDelay, clientSummary, I18N,
    EXTRA_TYPES, SALES_TYPES, CONVERSIONS, CONVERSION_LABELS, convertDoc, derivedDocs, chaineDePieces, DEFAULT_CLAUSES, CLAUSE_LABELS,
    PURCHASE_KINDS, PURCHASE_LIES, piecesLieesAchat, LINE_DESTINATIONS, DEFAULT_EXPENSE_CATEGORIES, PURCHASE_STATUSES, expenseCategories,
    vatReturn, vatChain, DEFAULT_FISCAL_DEADLINES, fiscalDeadlines, nextDeadline, upcomingFiscal, fiscalFilingId, fiscalDone, simpleResult,
    ACCOUNT_KINDS, MOVE_KINDS, cashMovements, accountBalance, cashPosition, cashForecast, reconciliation,
    lineCost, documentMargin, marginBy, PROJECT_STATUSES, projectMargin, projectList, recurringProfitability,
    DEFAULT_FIXED_CATEGORIES, isFixedCategory, breakEven,
    DEFAULT_ASSET_CLASSES, assetClassLabel, assetClassYears, days360, assetSchedule, assetYear,
    assetCumulated, assetNBV, disposalResult, assetsList, assetTotals, assetsToCreate, depreciationFor,
    cappedCumulated,
    moisDePaie, premierePieceApres, MOVE_SOURCES, SOURCES_SORTIE, qteMouvement, moveSourceLabel, trackedItems, itemOfLine, stockMovements, runningStock, stockOf,
    stockList, stockTotals, stockJournal, inventoryDiff, stockAlerts, stockImpact, costOfGoodsSold,
    ocrNumber, ocrToPurchase,
    CONTRACT_TYPES, contractLabel, DEFAULT_PAYROLL, payrollSettings, irppAnnual, computePayslip, saisiePaieValide,
    activeEmployees, payslipView, payslipsOf, payslipDate, payrollCost, payrollSummary, missingPayslips, bulletinsImpossibles,
    payslipHtml,
    QUARTERS, quarterMonths, quarterLabel, cnssDeclaration, employerAnnual, socialDue,
    LEAVE_KINDS, leaveKindLabel, leaveIsPaid, workingDays, leaveDaysInMonth, leavesOf, leaveBalance,
    advancesOf, advanceBalance, payslipInputFor, HR_DOCS, hrDocLabel, hrDocumentHtml, staffRegister,
    SERIAL_STATUSES, serialStatusLabel, WARRANTY_CHOICES, serializedItems, warrantyEnd, serialView,
    serialList, availableSerials, clientFleet, warrantiesEnding, serialGap, serialGaps,
    mergeData, trackDeletion, MERGE_LISTS, LIST_LABELS, LIST_PLURIELS, compteListe, piecesLiees,
    purchaseTotals, purchaseBalance, purchaseStatus, achatDoublon, facturesDuDevis, payablesList, purchaseJournal, purchaseSummary, supplierSummary, withholdingsToIssue, supplierPayments,
    periodBounds, issuedIn, salesTotals, revenueByMonth, topItems, clientMovement, AGING_BUCKETS, agedReceivables, releveClient, releveHtml, payerRanking, quoteFunnel, objectiveProgress,
    amountToWords, intToWords, intToWordsEn, documentHtml, fitToPage, paginate, pageCount,
    MODULES, PAGES, moduleById, pageById, pageTitle, moduleCount, moduleCounts, modulesRevenus, moduleOn, moduleWhy, navPages,
    sousModuleOn, sousModuleById, sousModules, OPTION_LABELS,
    MODULES_PAR_ACTIVITE, modulesSuggeres, wipeData, rendreLesEmprunts, estDemo, exemplePerime, firstSteps, liste, defaultVat, seuilRetenue, newLine,
    canalDe, estBeta, pastilleLicence, empreinteCabinet, licencesDuCabinet,
    LICENCE_MOTIFS, prorataOffre, licenceSuivi, licencesAFaire,
    EXPORT_CONSOLE_DELAI, exportConsoleAFaire,
    LICENCE_PREAVIS, licenceEtat, licenceRows, licencesExpirant,
    clientPourVente, chargeHistorique, facturesAAnnoncer
  };
});
