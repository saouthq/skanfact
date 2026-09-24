// Les visites guidées de l'application entreprise — le CONTENU (10.14.0).
//
// Le moteur (`visite.js`) ne sait rien de SkanFact ; ce fichier dit ce qu'on montre, où, et quel
// geste on attend. Il vit à côté des articles d'Aide (`guide.js`) pour la même raison : c'est du
// texte qu'on relit, pas du code qu'on déroule.
//
// Skander, le 24/09/2026 : « quelqu'un qui découvre l'application n'a pas envie de lire la page
// Aide, donc il faut pouvoir toujours le guider pour chaque étape afin de faire quelque chose, et
// il faut couvrir toute l'app » ; puis : « appliquer la visite guidée au début sur un exemple de
// données, et après, quand il passe à sa vraie entreprise, la visite pour le guider dans chaque
// étape — quelque chose de premium et complet qui couvre tous les boutons ».
//
// Trois familles, et l'Aide n'en remplace aucune :
//   - la DÉCOUVERTE : le grand tour sur l'exemple, en chapitres (on voit tout rempli, sans risque) ;
//   - les PAGES : chaque page lue sur l'écran, bloc par bloc, et CHAQUE bouton nommé et expliqué
//     (`expliquer`, plus bas) — une page qui gagne un bouton demain est couverte d'office, et un
//     bouton sans explication fait tomber l'instrument de couverture, jamais un client ;
//   - les GESTES : faire pour de vrai, dans sa propre entreprise, en étant guidé à chaque clic
//     (ajouter un client, faire un devis, émettre une facture, encaisser, déclarer…).
//
// Règles d'écriture, tenues par des tests :
//   - une cible se désigne par ce qu'elle EST (`#new`, `[data-combo=clientId]`), jamais par son
//     rang ni par sa couleur (« un e2e se périme », 7.3.0 — vaut aussi pour une visite) ;
//   - une étape « faire » porte `essai` : le geste que l'instrument rejoue à la place de la
//     personne, et qui prouve que la visite mène où elle dit ;
//   - le texte tutoie, dit le POURQUOI en une phrase, et ne recopie pas l'Aide.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkanVisites = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // `couleur` : l'un des sept domaines de l'Aide (`th-<nom>` dans style.css). La visite prend la
  // couleur de son domaine — l'en-tête de la bulle, le projecteur, la carte dans « Me guider » — et
  // l'Aide et le guide parlent ainsi la même langue de couleurs. Un test confronte chaque nom à la
  // feuille de style : une couleur inconnue rendrait une bulle grise au milieu de bulles colorées.
  const THEMES = [
    { id: 'demarrer', titre: 'Pour commencer', sous: 'Découvrir, puis faire ses premiers gestes', aide: 'demarrer', couleur: 'commencer' },
    { id: 'ventes', titre: 'Vendre', sous: 'Devis, factures, paiements, relances', aide: 'vendre', couleur: 'vendre' },
    { id: 'fichiers', titre: 'Clients et catalogue', sous: 'Ceux à qui tu vends, et ce que tu vends', aide: 'vendre', couleur: 'vendre',
      icone: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><path d="M15 5.2a3 3 0 0 1 0 6"/><path d="M17 14.6c2 .6 3.2 2.1 3.5 4.4"/>' },
    { id: 'achats', titre: 'Acheter', sous: 'Fournisseurs, factures d\'achat, dépenses', aide: 'acheter', couleur: 'acheter',
      icone: '<path d="M3 4h2.2l2.3 11.2h10.8L20.5 8H6.4"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>' },
    { id: 'argent', titre: 'L\'argent', sous: 'Comptes, trésorerie, rapprochement', aide: 'argent', couleur: 'encaisser' },
    { id: 'personnel', titre: 'Le personnel', sous: 'Salariés, bulletins, congés, CNSS', aide: 'personnel', couleur: 'equipe' },
    { id: 'stock', titre: 'Stock et biens', sous: 'Marchandises, numéros de série, immobilisations', aide: 'stock', couleur: 'acheter' },
    { id: 'pilotage', titre: 'Piloter', sous: 'Marges, affaires, statistiques', aide: 'pilotage', couleur: 'piloter' },
    { id: 'compta', titre: 'La comptabilité et le comptable', sous: 'TVA, clôture, paquet du mois', aide: 'compta', couleur: 'declarer' },
    { id: 'reglages', titre: 'Réglages et données', sous: 'Ta fiche, tes sauvegardes, ta sécurité, le travail à deux', aide: 'donnees', couleur: 'piloter',
      icone: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M9.2 12.2l2 2 3.6-3.8"/>' },
    // Les gestes « techniques » (10.14.0) : ceux qu'on fait rarement, donc qu'on ne sait jamais
    // refaire — installer une version, activer sa licence, retrouver un fichier, signaler un souci.
    { id: 'appli', titre: 'L\'application et tes fichiers', sous: 'Mises à jour, licence, fichiers, dépannage', aide: 'support', couleur: 'piloter',
      icone: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18"/><path d="M12 11.5v5.5"/><path d="M9.5 14.5l2.5 2.5 2.5-2.5"/>' },
    { id: 'pages', titre: 'Chaque page, bouton par bouton', sous: 'À quoi elle sert, et ce que fait chacun de ses boutons', aide: null, couleur: 'commencer' }
  ];
  // La couleur de la visite d'une PAGE : celle du domaine où vit la page (une facture est bleue
  // comme « Vendre », la paie rose comme « Ton équipe »). Un test exige une couleur par page.
  const COULEUR_PAGE = {
    dashboard: 'commencer', devis: 'vendre', factures: 'vendre', relances: 'encaisser', contrats: 'vendre', autres: 'vendre',
    clients: 'vendre', catalogue: 'vendre', fournisseurs: 'acheter', achats: 'acheter', stock: 'acheter', garanties: 'acheter',
    immos: 'acheter', tresorerie: 'encaisser', marges: 'piloter', stats: 'piloter', paie: 'equipe', compta: 'declarer',
    licences: 'piloter', modules: 'commencer', parametres: 'piloter', aide: 'commencer', guide: 'commencer',
    doc: 'vendre', client: 'vendre', contrat: 'vendre', fournisseur: 'acheter', achat: 'acheter', affaire: 'piloter',
    salarie: 'equipe', article: 'acheter', immo: 'acheter'
  };
  // Le dessin d'une famille quand celui de son domaine ne la dit pas (Clients et catalogue n'est
  // pas une facture ; les réglages ne sont pas un graphique) : un tracé SVG, ou rien.
  const iconeDe = v => { const t = v && THEMES.find(x => x.id === (v.theme || v.id)); return (t && t.icone) || ''; };
  const couleurDe = v => {
    if (!v) return '';
    if (v.couleur) return v.couleur;
    if (v.type === 'page' && COULEUR_PAGE[v.route]) return COULEUR_PAGE[v.route];
    const t = THEMES.find(x => x.id === v.theme);
    return (t && t.couleur) || '';
  };

  // ========================================================================== CE QUE CHAQUE PAGE EST
  // Le premier écran de la visite d'une page : à quoi elle sert, en deux phrases. `fiche` : la page
  // désigne UN objet — la visite s'ouvre sur celui qu'on regarde, sinon sur le premier des données.
  const PAGES = {
    dashboard: { titre: "L'accueil", resume: "Ce qui attend, et les chiffres du moment.",
      texte: "<p>C'est ici que SkanFact s'ouvre, et il répond à une question : <b>qu'est-ce qui m'attend aujourd'hui ?</b></p><p>Les chiffres du moment en haut, ce qui attend un geste de ta part juste dessous, et le chemin vers tout le reste.</p>" },
    devis: { titre: "Les devis", resume: "Tes propositions de prix, et ce que tes clients en ont dit.",
      texte: "<p>Tous tes devis, du brouillon à l'accepté. Un devis n'engage personne tant que ton client ne l'a pas accepté.</p><p>Accepté, il se <b>transforme en facture</b> sans rien ressaisir.</p>" },
    factures: { titre: "Les factures et les avoirs", resume: "Ce que tu as facturé, et ce qui reste à encaisser.",
      texte: "<p>Tes factures et tes avoirs. Le statut d'une facture — payée, partielle, en retard — <b>se déduit tout seul</b> des paiements que tu notes : tu ne le changes jamais à la main.</p><p>Une facture émise ne se modifie plus : elle se corrige par un avoir.</p>" },
    relances: { titre: "Les relances", resume: "Les factures échues, et le bon message pour chacune.",
      texte: "<p>Les factures dont l'échéance est passée, classées par ancienneté du retard. À chaque niveau son ton : un rappel poli, une relance, une dernière relance.</p><p>Tu notes aussi les appels et les promesses de paiement : rien ne se perd.</p>" },
    contrats: { titre: "La facturation récurrente", resume: "Les clients que tu factures chaque mois du même montant.",
      texte: "<p>Un contrat récurrent prépare la même facture chaque mois (ou trimestre, ou année) : SkanFact fabrique le brouillon à la date prévue, tu n'as qu'à l'émettre.</p>" },
    autres: { titre: "Proforma, bons et contrats", resume: "Les pièces qui entourent une vente sans être des factures.",
      texte: "<p>La proforma (un prix ferme pour un dossier), le bon de commande, le bon de livraison que ton client signe, et le contrat à signer.</p><p>Aucune n'entre dans ton chiffre d'affaires ni dans ta TVA : c'est la facture qui compte.</p>" },
    clients: { titre: "Les clients", resume: "Tes clients, et ce que chacun te doit.",
      texte: "<p>Chaque client a sa fiche : ses coordonnées, ses pièces, ce qu'il te doit, et son relevé de compte à lui envoyer.</p>" },
    catalogue: { titre: "Le catalogue", resume: "Ce que tu vends, avec son prix — et tes modèles.",
      texte: "<p>Ce que tu vends, décrit une fois pour toutes avec son prix : chaque devis le reprend d'un clic.</p><p>Deux autres onglets : les <b>modèles de documents</b> (un devis tout fait) et les <b>textes prédéfinis</b> (tes conditions, tes mentions).</p>" },
    fournisseurs: { titre: "Les fournisseurs", resume: "Ceux qui te facturent, et ce que tu leur dois.",
      texte: "<p>Chaque fournisseur a sa fiche : ses achats, ce que tu lui dois, et ses conditions de paiement.</p>" },
    achats: { titre: "Achats et dépenses", resume: "Les factures de tes fournisseurs et tes dépenses du quotidien.",
      texte: "<p>Tout ce que tu paies : factures d'achat, dépenses (carburant, fournitures), avoirs et acomptes de tes fournisseurs.</p><p>C'est d'ici que vient la <b>TVA que tu récupères</b> — un achat oublié, c'est de la TVA payée deux fois.</p>" },
    stock: { titre: "Le stock", resume: "Ce qui dort sur l'étagère, ce qui entre, ce qui sort.",
      texte: "<p>Tes articles suivis en stock : ce qui entre par tes achats, ce qui sort par tes ventes, leur valeur, et ce qu'il faut recommander.</p><p>Acheter de la marchandise n'est pas une charge : c'est la vente qui la fait sortir.</p>" },
    garanties: { titre: "Les garanties", resume: "Le matériel vendu par numéro de série, et ses garanties.",
      texte: "<p>Le matériel que tu as vendu, numéro par numéro, et les garanties qui se terminent bientôt.</p><p>Une fin de garantie est une <b>occasion</b> : c'est le moment de proposer un contrat.</p>" },
    immos: { titre: "Les immobilisations", resume: "Ce que tu gardes plusieurs années, et son amortissement.",
      texte: "<p>Ce que tu achètes pour le garder plusieurs années (ordinateur, véhicule, mobilier) ne se déduit pas d'un coup : il <b>s'amortit</b>, année après année.</p><p>SkanFact calcule le plan, et le montant à déduire chaque année.</p>" },
    tresorerie: { titre: "La trésorerie", resume: "Ce que tu as, ce qui arrive, et le jour où ça pourrait coincer.",
      texte: "<p>Tes comptes (banque, caisse) et leur solde aujourd'hui, ce qui va entrer et sortir, et le jour où ton solde pourrait passer sous zéro.</p><p>Les paiements de tes clients et tes règlements aux fournisseurs y arrivent tout seuls.</p>" },
    marges: { titre: "Les marges", resume: "Gagnes-tu de l'argent, et où ?",
      texte: "<p>Par affaire, par client, par prestation : ce que tu vends, ce que ça te coûte, et ce qui te reste.</p><p>Et le <b>seuil de rentabilité</b> : le chiffre d'affaires qu'il te faut pour couvrir tes frais fixes.</p>" },
    stats: { titre: "Les statistiques", resume: "Ton activité, comparée à l'an dernier.",
      texte: "<p>Ton chiffre d'affaires sur une année, un trimestre ou un mois, comparé à la même période de l'an dernier ; tes meilleurs clients, tes prestations qui marchent, et ceux qui paient en retard.</p>" },
    paie: { titre: "La paie", resume: "Tes salariés, leurs bulletins, et la CNSS.",
      texte: "<p>Tes salariés, leurs bulletins de paie mois par mois, leurs congés et leurs avances, et les déclarations CNSS du trimestre.</p><p>Les taux (CNSS, IRPP) sont des <b>barèmes réglables</b> : ton comptable les vérifie une fois.</p>" },
    compta: { titre: "La comptabilité", resume: "Ce que tu déclares, et ce que tu envoies à ton comptable.",
      texte: "<p>Tes journaux de ventes et d'achats, la <b>TVA du mois</b> à déclarer, le calendrier fiscal, les clôtures de mois, et le paquet que tu envoies à ton comptable.</p><p>Tout se <b>déduit</b> de tes pièces : il n'y a rien à ressaisir ici.</p>" },
    licences: { titre: "Les licences", resume: "Les licences que tu as vendues (éditeur).",
      texte: "<p>Les licences de SkanFact que tu as émises, leur date de fin, leur facture et leur envoi.</p>" },
    modules: { titre: "Tous les modules", resume: "Tout ce que SkanFact sait faire, même ce qui est masqué.",
      texte: "<p>Tous les modules de SkanFact, y compris ceux que tu as retirés du menu. Rien n'est jamais supprimé : un module masqué garde ses données et revient d'un clic.</p>" },
    parametres: { titre: "Les paramètres", resume: "Ta fiche société, tes documents, tes envois, tes données.",
      texte: "<p>Tout ce qui se règle, rangé en cinq onglets. La recherche en haut trouve un réglage par son nom (« timbre », « sauvegarde »…).</p><p>Une modification ne compte qu'une fois <b>enregistrée</b> : la barre du bas te le rappelle.</p>" },
    aide: { titre: "L'aide", resume: "Comment marche SkanFact, et comment tenir sa gestion.",
      texte: "<p>Trente-deux articles rangés par domaine : facturer, encaisser, acheter, la TVA, la routine du mois. Chacun finit par le geste qui le met en pratique.</p>" },
    guide: { titre: "Me guider", resume: "Toutes les visites guidées, rangées par ce que tu veux faire.",
      texte: "<p>Toutes les visites : la découverte, chaque page bouton par bouton, et les gestes du métier faits pour de vrai, guidés clic par clic.</p>" },
    doc: { titre: "Une pièce : devis, facture, avoir…", resume: "L'éditeur : le client, les lignes, les totaux, l'aperçu.", fiche: 'doc',
      texte: "<p>L'éditeur d'une pièce. En haut, les gestes (enregistrer, envoyer, facturer) ; puis le client, les lignes, les totaux, et à droite l'<b>aperçu</b> tel que ton client le recevra.</p>" },
    client: { titre: "La fiche d'un client", resume: "Tout ce qui concerne un client, au même endroit.", fiche: 'client',
      texte: "<p>Tout ce qui concerne ce client : ses coordonnées, ses devis et factures, ce qu'il te doit, ses contrats et ses affaires.</p>" },
    contrat: { titre: "Un contrat récurrent", resume: "Ce qu'il facturera, et ce qu'il a déjà facturé.", fiche: 'contrat',
      texte: "<p>La fiche d'un contrat : la prochaine facture qu'il fabriquera, et toutes celles qu'il a déjà préparées.</p>" },
    fournisseur: { titre: "La fiche d'un fournisseur", resume: "Ses achats, et ce que tu lui dois.", fiche: 'fournisseur',
      texte: "<p>La fiche d'un fournisseur : ses factures, ce que tu lui dois encore, et ses conditions.</p>" },
    achat: { titre: "Une facture d'achat", resume: "Le fournisseur, les lignes, la TVA récupérable, le justificatif.", fiche: 'achat',
      texte: "<p>Une facture d'achat ou une dépense : le fournisseur, ce que tu as acheté ligne par ligne (et où ça va : charge, stock ou immobilisation), la TVA que tu récupères, et le <b>justificatif</b>.</p>" },
    affaire: { titre: "Une affaire", resume: "Un chantier ou un projet, et ce qu'il te rapporte vraiment.", fiche: 'affaire',
      texte: "<p>Une affaire rassemble les ventes et les achats d'un même chantier : c'est là que tu vois ce qu'il te rapporte <b>vraiment</b>.</p>" },
    salarie: { titre: "La fiche d'un salarié", resume: "Son contrat, ses bulletins, ses congés, ses avances.", fiche: 'salarie',
      texte: "<p>La fiche d'un salarié : son contrat, ses bulletins, ses congés et son solde, ses avances, et ses documents (attestation, certificat).</p>" },
    article: { titre: "La fiche d'un article", resume: "Son stock, ses mouvements, son coût moyen.", fiche: 'article',
      texte: "<p>La fiche d'un article suivi en stock : combien il en reste, chaque entrée et chaque sortie, et son coût moyen.</p>" },
    immo: { titre: "La fiche d'un bien", resume: "Son plan d'amortissement, et sa sortie.", fiche: 'immo',
      texte: "<p>La fiche d'un bien : son plan d'amortissement année par année, sa valeur nette aujourd'hui, et sa sortie le jour où tu le vends ou le jettes.</p>" }
  };

  // ========================================================================== LES BLOCS D'UN ÉCRAN
  // Le titre et le mot d'un bloc, quand son intitulé ne suffit pas. Premier qui correspond gagne :
  // les plus précis d'abord.
  const ZONES = [
    { sel: '.demo-banner', titre: "Tu es dans l'exemple", texte: "Rien de ce que tu fais ici ne compte. « Visite guidée » te fait faire le tour ; « Quitter l'exemple » te rend tes vraies données." },
    { sel: '#guide-band', titre: "La visite de cette page", texte: "Proposée les trois premières fois que tu ouvres une page. Tu la retrouves ensuite dans « Me guider »." },
    { sel: '.page-head', titre: "Le haut de la page", texte: "Le titre dit où tu es. À droite, les gestes de la page : <b>un seul est vert</b>, c'est l'étape suivante. « Comprendre cette page » ouvre son article d'Aide." },
    { sel: '#bal-vues', titre: "Les quatre vues de la balance", texte: "La même balance, lue de quatre façons." },
    { sel: '.tabs', titre: "Les onglets", texte: "La page se range en onglets. Je vais te les ouvrir un par un ; « Passer au chapitre suivant » en saute un." },
    { sel: '.filters', titre: "Retrouver une ligne", texte: "La recherche lit le numéro, le nom et l'objet pendant que tu tapes ; les listes filtrent par statut et par année. « n sur N » dit combien de lignes tu gardes." },
    { sel: '.pager', titre: "Les pages de la liste", texte: "La liste se découpe en pages. Les totaux du bas portent toujours sur <b>toute</b> la sélection, pas seulement sur la page affichée." },
    { sel: '.vide-utile', titre: "Une liste encore vide", texte: "Elle dit à quoi elle sert, et te donne le bouton qui la remplit." },
    { sel: '.premiers-pas', titre: "Tes premiers pas", texte: "L'ordre des choses pour bien démarrer. Chaque étape se coche <b>toute seule</b> quand c'est fait — rien à cocher à la main." },
    { sel: '.panel.todo', titre: "À faire", texte: "Tout ce qui attend un geste de ta part, du plus urgent au moins urgent. Chaque ligne a son bouton, qui t'emmène au bon endroit." },
    { sel: '.stats', titre: "Les chiffres", texte: "Chaque carte résume une liste : un clic l'ouvre." },
    { sel: '.help-search', titre: "Chercher", texte: "Tape un mot ou une question : la recherche lit le contenu, pas seulement les titres." },
    { sel: '.scroll-x, table', titre: "La liste", texte: "Une ligne s'ouvre d'un clic. Les en-têtes marqués ⇅ trient la colonne ; « Actions » au bout de la ligne rassemble les autres gestes, chacun avec sa phrase." },
    { sel: '.banner', titre: "À savoir", texte: "" }
  ];

  // ========================================================================== LES ONGLETS
  const ONGLETS = {
    'compta:ventes': "Le journal des ventes du mois : chaque facture et chaque avoir, leur TVA, leur timbre. C'est lui que ton comptable lit en premier.",
    'compta:achats': "Le journal des achats : chaque facture fournisseur, sa TVA récupérable, et les attestations de retenue à réclamer.",
    'compta:tva': "La TVA à payer du mois : la TVA collectée sur tes ventes, moins celle que tu récupères sur tes achats, moins le crédit reporté. Le chiffre que tu recopies sur ta déclaration.",
    'compta:ecritures': "Les écritures comptables tirées de tes pièces, prêtes pour le logiciel de ton comptable. Tu peux aussi y saisir une opération diverse.",
    'compta:grandlivre': "Le grand livre : chaque compte, ses mouvements un par un, et son solde qui avance.",
    'compta:balance': "La balance : un compte par ligne, avec son solde. Le premier contrôle d'un comptable : tout tombe juste.",
    'compta:etats': "Le bilan et le résultat, déduits de la balance.",
    'compta:calendrier': "Les échéances fiscales (TVA, retenues, acomptes) : tu pointes chacune quand elle est déposée.",
    'compta:clotures': "Clôturer un mois le fige : plus aucune pièce datée de ce mois ne se modifie. C'est ce qui rend tes déclarations définitives.",
    'compta:cabinet': "Le paquet du mois pour ton comptable : tes journaux, tes pièces et tes justificatifs, en un fichier. Et les questions qu'il te pose.",
    'paie:bulletins': "Les bulletins du mois choisi, salarié par salarié : établis, payés, ou encore à faire.",
    'paie:salaries': "Tes salariés : leur contrat, leur salaire, leur numéro CNSS.",
    'paie:conges': "Les congés et absences : ce qu'ils retirent du salaire, et le solde de chacun.",
    'paie:avances': "Les avances sur salaire, et ce qui reste à retenir sur les prochains bulletins.",
    'paie:declarations': "La CNSS du trimestre et la déclaration d'employeur de l'année : ce qu'il faut déposer, et quand.",
    'paie:registre': "Le registre du personnel : tous ceux qui ont travaillé pour toi, entrées et sorties.",
    'paie:baremes': "Les taux : CNSS, IRPP, frais professionnels. Ils ne sont écrits nulle part en dur — ton comptable les vérifie une fois.",
    'stock:etat': "L'état du stock : chaque article suivi, sa quantité, son coût moyen et sa valeur.",
    'stock:mouvements': "Chaque entrée (achat) et chaque sortie (vente, casse, inventaire), dans l'ordre.",
    'stock:series': "Le matériel suivi numéro par numéro : en stock, chez quel client, sous garantie jusqu'à quand.",
    'stock:inventaire': "Tu comptes ce qu'il y a vraiment sur l'étagère ; SkanFact enregistre les écarts.",
    'stock:alertes': "Les articles à recommander, et les stocks négatifs (une pièce d'achat oubliée, presque toujours).",
    'immos:tableau': "Le tableau des amortissements de l'année : ce que chaque bien perd, et ce qui reste à amortir.",
    'immos:attente': "Les lignes d'achat marquées « immobilisation » qui n'ont pas encore leur fiche : tant qu'elles attendent, elles ne se déduisent nulle part.",
    'immos:sorties': "Les biens vendus ou mis au rebut, et la plus ou moins-value de chacun.",
    'tresorerie:position': "Où tu en es : le solde de chaque compte aujourd'hui.",
    'tresorerie:prevision': "Ce qui arrive : les factures à encaisser et à payer, jour par jour, et le jour où ton solde pourrait passer sous zéro.",
    'tresorerie:mouvements': "Les mouvements qui ne viennent pas d'une facture : frais bancaires, apports, impôts, retraits.",
    'tresorerie:rapprochement': "Tu compares ton relevé bancaire à SkanFact, ligne par ligne, et tu pointes ce qui correspond.",
    'marges:affaires': "Tes affaires (chantiers, projets) : ce qu'elles rapportent, achats déduits.",
    'marges:analyse': "Où est la marge : par client ou par prestation, ce qui rapporte et ce qui coûte.",
    'marges:contrats': "La rentabilité de tes contrats récurrents.",
    'marges:seuil': "Le seuil de rentabilité : combien il faut vendre pour couvrir tes frais fixes.",
    'autres:proforma': "Les proformas : un prix ferme pour un dossier (banque, administration).",
    'autres:commande': "Les bons de commande : ce que ton client a commandé.",
    'autres:livraison': "Les bons de livraison : ce que tu as livré, signé par ton client.",
    'autres:contrat': "Les contrats à signer : objet, durée, reconduction, préavis.",
    'catalogue:presta': "Tes prestations et articles, avec leur prix.",
    'catalogue:modeles': "Tes modèles de documents : un devis tout fait, à reprendre en un clic.",
    'catalogue:textes': "Tes textes prédéfinis : conditions, mentions, à insérer dans une pièce.",
    'parametres:societe': "Ta fiche société : raison sociale, matricule, adresse, RIB, logo. Tout ce qui s'imprime en haut de tes documents.",
    'parametres:documents': "Tes règles de facturation : délai de paiement, validité des devis, timbre, retenue, mentions.",
    'parametres:envois': "Les mails que SkanFact prépare : devis, facture, relances. Tu en changes le texte.",
    'parametres:donnees': "Tes sauvegardes, la copie de sécurité automatique, le mot de passe, et tes dossiers d'entreprise.",
    'parametres:app': "L'application : thème, langue, modules affichés, mises à jour, licence.",
    'compta:generale': "La balance générale : tous les comptes.",
    'compta:clients': "L'auxiliaire clients : ce que chaque client te doit.",
    'compta:fournisseurs': "L'auxiliaire fournisseurs : ce que tu dois à chacun.",
    'compta:lettrage': "Le lettrage : quelle facture est réglée par quel paiement, et ce qui reste ouvert."
  };

  // ========================================================================== CE QUE FAIT CHAQUE BOUTON
  // Une entrée par bouton (ou par famille de boutons). Clés : `id` (le plus sûr), `sel` (un sélecteur
  // CSS : les lignes, les attributs data-), `lib` (le libellé, en dernier recours), `route` (la page
  // où l'entrée vaut : « #new » ne veut pas dire la même chose partout). `nom` remplace le libellé
  // affiché quand il ne dit rien (« ✕ », « ↑ »). Le texte dit ce que fait le bouton ET quand s'en
  // servir.
  const B = [];
  // Une clé « #x » seule est un identifiant ; tout le reste (« #a, #b », « .classe », « [data-…] »)
  // est un sélecteur — un identifiant « gl-plan, #bal-plan » ne correspondrait jamais à rien.
  const b = (cle, texte, o) => { B.push(Object.assign(/^#[\w-]+$/.test(cle) ? { id: cle.slice(1) } : { sel: cle }, { texte }, o || {})); };

  // ---------- partout ----------
  b('#back', "Revient à la page d'où tu viens — elle est nommée sur le bouton.", { nom: 'Retour' });
  b('a.page-help', "Ouvre l'article d'Aide de cette page : le pourquoi, les règles, les pièges.");
  b('#reset-f', "Efface la recherche et tous les filtres : toute la liste revient.");
  b('[data-pg="prev"], [data-pg="next"]', "Passe à la page précédente ou suivante de la liste.", { nom: 'Page précédente / suivante', cle: 'pager' });
  b('[data-pg="size"]', "Combien de lignes tu vois à la fois. Les totaux, eux, portent toujours sur toute la sélection.", { nom: 'Lignes par page' });
  b('[data-sort]', "Un clic trie la liste par cette colonne ; un second clic inverse l'ordre.", { nom: 'Les en-têtes ⇅', cle: 'tri' });
  b('[data-rowmenu]', null, { rowmenu: true, nom: 'Actions', cle: 'rowmenu' });
  b('#gb-go', "Lance la visite de cette page : chaque bloc, chaque bouton, en une ou deux minutes.");
  b('#gb-non', "Ne plus proposer la visite de cette page. Elle reste dans « Me guider ».");
  b('#demo-visite', "Le grand tour de SkanFact sur cet exemple, en chapitres : tu vois chaque page remplie, sans rien risquer.");
  b('#demo-out', "Quitte l'exemple : tes données d'avant reviennent (elles avaient été mises de côté) ; s'il n'y en avait pas, tu repars d'une entreprise vide.");
  b('#todo-toggle', "Replie ou déplie la liste « À faire ».", { nom: 'À faire' });
  b('#todo-more', "Montre le reste de la liste « À faire ».");
  b('[data-todo]', "Le geste qui règle cette ligne : il t'emmène au bon endroit, déjà filtré.", { nom: 'Le bouton de chaque ligne', cle: 'todo' });
  b('[data-pas]', "Le geste de cette étape : il t'emmène au bon endroit.", { nom: 'Le bouton de chaque étape', cle: 'pas' });
  b('[data-stat]', "Ouvre la liste que ce chiffre résume.", { nom: 'Une carte', cle: 'stat' });
  b('[data-cstat]', "Ouvre la liste que ce chiffre résume.", { nom: 'Une carte', cle: 'stat' });

  // ---------- l'accueil ----------
  b('#new-devis', "Ouvre un devis vierge : choisis le client, ajoute tes lignes, le reste se calcule.");
  b('#new-facture', "Ouvre une facture vierge, en brouillon : elle reçoit son numéro quand tu l'émets.");
  b('#start-devis', "Ton premier devis, pas à pas.");
  b('#start-demo', "Charge une entreprise d'exemple de cinq ans, pour voir chaque page remplie. Tes données sont mises de côté et reviennent d'un clic.");
  b('#go-expired', "Ouvre les devis dont la validité est dépassée : relance le client, ou marque-les refusés.");

  // ---------- listes de pièces ----------
  b('#new', "Ouvre un devis vierge.", { route: 'devis' });
  b('#new', "Ouvre une facture vierge, en brouillon.", { route: 'factures' });
  b('#new', "Ouvre la fiche d'un nouveau client : son nom, son matricule, son adresse, son mail.", { route: 'clients' });
  b('#new', "Décris une prestation ou un article avec son prix : tes devis le reprendront d'un clic.", { route: 'catalogue' });
  b('#new', "Un nouveau contrat : le client, les lignes, la fréquence, et le jour de facturation.", { route: 'contrats' });
  b('#new', "Ouvre la fiche d'un nouveau fournisseur.", { route: 'fournisseurs' });
  b('#new', "Saisis une facture fournisseur : ses lignes, sa TVA, son justificatif.", { route: 'achats' });
  b('#new', "Une nouvelle pièce de cet onglet (proforma, bon, contrat). Tu peux aussi la tirer d'un devis : « Transformer » dans le devis.", { route: 'autres' });
  b('#new-avoir', "Un avoir corrige une facture émise (remise, retour, erreur) : on ne supprime jamais une facture, on l'annule par un avoir.");
  b('#kind', "Ne garder qu'une sorte de pièce (factures, avoirs, dépenses…).", { nom: 'Sorte de pièce' });
  b('#st', "Ne garder que les pièces d'un statut.", { nom: 'Statut' });
  b('#yr', "Ne garder qu'une année.", { nom: 'Année' });
  b('#q', "Tape un mot : un numéro, un nom, un objet. La liste se réduit pendant que tu tapes.", { nom: 'Recherche' });
  b('#rel-q', "Cherche une facture à relancer : numéro, client, objet.", { nom: 'Recherche' });
  b('#f', "Ne garder que ceux qui ont un impayé, ou aucun document.", { nom: 'Filtre' });
  b('#cat', "Ne garder qu'une catégorie de dépense.", { nom: 'Catégorie' });
  b('#pay-h', "Replie ou déplie la liste de ce que tu dois payer.", { nom: 'À payer' });
  b('[data-payx]', "Note le règlement de cette facture fournisseur.", { nom: 'Régler' });

  // ---------- l'éditeur de pièce ----------
  b('#save', "Garde la pièce. Un devis reçoit son numéro ; une facture reste un brouillon sans numéro tant que tu ne l'as pas émise.", { route: 'doc' });
  b('#issue', "Donne à la pièce son numéro définitif et la verrouille. Un récapitulatif s'affiche d'abord : à qui, quand, combien.");
  b('#email', "Prépare le mail dans ta messagerie, avec le PDF joint : tu relis, et tu envoies.");
  b('#pdf', "Enregistre le document en PDF sur ton ordinateur.");
  b('#pv-toggle', "Montre ou cache l'aperçu, à droite.");
  b('#pv-hide', "Ouvre le document en grand, pour le relire comme ton client le recevra.");
  b('#pay', "Note un règlement de ton client (virement, chèque, espèces) : le statut de la facture suit tout seul.", { route: 'doc' });
  b('#pay2', "Note un règlement de ton client.", { route: 'doc' });
  b('#convert', "Transforme ce devis en facture, en brouillon : client, lignes et prix repris tels quels.");
  b('#deposit', "Facture une partie du devis avant de commencer (un pourcentage ou un montant) ; le solde viendra plus tard, sans rien ressaisir.");
  b('#settle2', "Facture ce qui reste du devis, acomptes déduits.");
  b('#bill-btn', "Les autres façons de facturer ce devis : un acompte, ou le solde.");
  b('#voir-acompte', "Ouvre la facture d'acompte déjà préparée pour ce devis.");
  b('#voir-facture', "Ouvre la facture déjà tirée de ce devis.");
  b('#conv-btn', "Tire de cette pièce une autre pièce — proforma, bon de commande, bon de livraison, contrat — sans rien ressaisir.");
  b('[data-conv]', "Crée la pièce nommée, à partir de celle-ci.", { nom: 'Une pièce à tirer', cle: 'conv' });
  b('#more-btn', "Les gestes plus rares : dupliquer, garder comme modèle, rendre récurrent, créer un avoir, supprimer.", { route: 'doc' });
  b('#dup', "Crée une copie de cette pièce, en brouillon.", { route: 'doc' });
  b('#as-template', "Garde ces lignes comme modèle, pour les reprendre dans un prochain devis.");
  b('#serials', "Note les numéros de série qui partent avec cette pièce : la garantie court à partir d'ici.");
  b('#make-recurring', "Fait de cette facture un contrat : SkanFact préparera la même chaque mois (ou trimestre).");
  b('#credit', "Corrige cette facture émise par un avoir, total ou partiel.");
  b('#lock-credit', "Une facture émise ne se modifie pas : elle se corrige par un avoir. Ce bouton le prépare.");
  b('#unlock', "Rouvre cette pièce pour la modifier. Réservé à ce qui n'engage pas ta comptabilité : une facture émise, elle, se corrige par un avoir.");
  b('#lock-unlock', "Rouvre cette pièce pour la modifier malgré son envoi.");
  b('#clos-dup', "Cette pièce est dans un mois clôturé : elle ne bouge plus. Ce bouton en fait une copie datée d'aujourd'hui, que tu peux modifier.");
  b('#clos-go', "Ouvre les clôtures : c'est là qu'un mois clôturé se rouvre, avec un motif que lira ton comptable.");
  b('#cancel-inv', "Marque la pièce annulée, avec son motif. Une facture émise, elle, se corrige par un avoir.");
  b('#uncancel', "Annule le marquage « annulée ».");
  b('#del', "Supprime la pièce (seulement si elle n'est pas émise). SkanFact dit d'abord ce qui y est rattaché.", { route: 'doc' });
  b('#add-line', "Ajoute une ligne à remplir à la main.", { route: 'doc' });
  b('#add-att', "Attache un fichier à la pièce (bon signé, photo). Il part avec ta copie de sécurité.", { route: 'doc' });
  b('#reset-clauses', "Remet les clauses du contrat telles que SkanFact les propose.");
  b('#notes', "Tes conditions particulières et mentions : elles s'impriment en bas du document.", { nom: 'Notes' });
  b('[data-desc]', "Ajoute sous la désignation une phrase plus longue (ce qui est inclus, les délais).", { nom: '+ description', cle: 'desc' });
  b('[data-up], [data-down]', "Monte ou descend la ligne dans le document.", { nom: '↑ ↓', cle: 'updown' });
  b('[data-dup]', "Duplique la ligne juste en dessous.", { nom: '⧉', cle: 'dupligne' });
  b('[data-rm]', "Retire la ligne.", { nom: '✕', cle: 'rmligne' });
  b('[data-k="label"]', "Ce que tu vends, en quelques mots. SkanFact te propose ce qui ressemble dans ton catalogue.", { nom: 'Désignation', cle: 'k:label' });
  b('[data-k="qty"]', "La quantité (des heures, des pièces, un forfait).", { nom: 'Quantité', cle: 'k:qty' });
  b('[data-k="unit"]', "L'unité : heure, jour, pièce, forfait… « Autre… » en ajoute une.", { nom: 'Unité', cle: 'k:unit' });
  b('[data-k="unitPrice"]', "Le prix d'une unité, hors taxe. Le total se calcule.", { nom: 'Prix unitaire HT', cle: 'k:unitPrice' });
  b('[data-k="vatRate"]', "Le taux de TVA de la ligne.", { nom: 'TVA', cle: 'k:vatRate' });
  b('[data-k="description"]', "La phrase plus longue sous la désignation.", { nom: 'Description', cle: 'k:description' });
  b('[data-k="destination"]', "Où va cette dépense : une charge du mois, du stock (marchandise à revendre), ou une immobilisation (un bien gardé plusieurs années).", { nom: 'Destination', cle: 'k:destination' });
  b('[data-k="deductible"]', "Décoche si la TVA de cette ligne n'est pas récupérable (un véhicule de tourisme, par exemple).", { nom: 'TVA déductible', cle: 'k:deductible' });
  b('[name="confidentialite"], [name="duree"], [name="objet"], [name="paiement"], [name="preavis"], [name="reconduction"], [name="litiges"]',
    "Une clause du contrat. SkanFact en propose un texte ; tu l'adaptes, et « Revenir aux textes proposés » le remet.", { nom: 'Les clauses', cle: 'clauses' });
  b('[name="creditReason"]', "Pourquoi cet avoir (erreur, remise, retour) : la phrase s'imprime sur l'avoir.", { nom: 'Motif de l\'avoir' });

  // ---------- clients et fournisseurs ----------
  b('#new-fac', "Crée une facture pour ce client, déjà rempli.");
  b('#new-dev', "Crée un devis pour ce client, déjà rempli.");
  b('#go-rel', "Ouvre les relances de ce client.");
  b('#cl-notes', "Ce qu'il faut se rappeler sur ce client (habitudes de paiement, interlocuteur). Enregistré tout seul, jamais imprimé.", { nom: 'Notes internes' });
  b('#asuivre-ok', "Ouvre la fiche du client.");
  b('#buy', "Saisis un achat chez ce fournisseur, déjà rempli.");
  b('#edit', "Modifie la fiche du fournisseur.", { route: 'fournisseur' });
  b('#sup-notes', "Ce qu'il faut savoir sur ce fournisseur (délais, interlocuteur). Jamais imprimé.", { nom: 'Notes internes' });

  // ---------- catalogue ----------
  b('#new-snip', "Un texte prédéfini (conditions, mentions) à insérer dans tes pièces.");
  b('[data-x]', "Retire cette ligne du modèle.", { nom: '✕' });

  // ---------- contrats récurrents ----------
  b('#gen-due', "Prépare d'un coup les brouillons des contrats arrivés à échéance.");
  b('#c-client', "Ouvre la fiche du client de ce contrat.");
  b('#c-edit', "Modifie le contrat : client, lignes, fréquence.");
  b('#c-toggle', "Suspend le contrat (plus aucune facture) ou le reprend.");
  b('#c-gen', "Prépare tout de suite la prochaine facture, sans attendre la date.");
  b('#c-gen2', "Prépare le brouillon de la prochaine facture.");
  b('#c-more-btn', "Les gestes plus rares : supprimer le contrat.");

  // ---------- achats ----------
  b('#new-dep', "Saisis une dépense du quotidien (carburant, fournitures) — plus courte qu'une facture d'achat.");
  b('#attach-top', "Joins la photo ou le PDF de la facture, avant même de la saisir : tu recopies en la regardant.");
  b('#save', "Garde la facture d'achat. Tant qu'elle n'est pas enregistrée, elle ne compte nulle part.", { route: 'achat' });
  b('#pay', "Note ton règlement au fournisseur : ce que tu lui dois se met à jour.", { route: 'achat' });
  b('#pay2', "Note ton règlement au fournisseur.", { route: 'achat' });
  b('#add-line', "Ajoute une ligne d'achat.", { route: 'achat' });
  b('#add-att', "Joins le justificatif (photo, PDF).", { route: 'achat' });
  b('#more-btn', "Les gestes plus rares : dupliquer, supprimer.", { route: 'achat' });
  b('#dup', "Crée une copie de cet achat.", { route: 'achat' });
  b('#del', "Supprime cet achat (après confirmation).", { route: 'achat' });
  b('#b-notes', "Ce qu'il faut se rappeler sur cet achat. Jamais imprimé.", { nom: 'Notes' });

  // ---------- marges et affaires ----------
  b('#new-proj', "Une affaire rassemble les ventes et les achats d'un même chantier : c'est là que tu vois ce qu'il rapporte vraiment.");
  b('#mg-dim', "Lire la marge par client, ou par prestation.", { nom: 'Par' });
  b('#mg-year', "L'année analysée.", { nom: 'Année' });
  b('[data-fix]', "Dis si cette charge est fixe (le loyer) ou variable (les achats) : c'est ce qui calcule ton seuil de rentabilité.", { nom: 'fixe / variable', cle: 'fix' });
  b('#edit-p', "Modifie l'affaire : nom, client, dates, statut.");
  b('#p-devis', "Un devis déjà rattaché à cette affaire.");
  b('#p-achat', "Un achat déjà rattaché à cette affaire.");
  b('#p-att-v', "Rattache à cette affaire des ventes déjà faites.");
  b('#p-att-a', "Rattache à cette affaire des achats déjà saisis.");

  // ---------- paie ----------
  b('#new-emp', "Déclare un nouveau salarié : son contrat, son salaire, son numéro CNSS.");
  b('#emp-first', "Déclare ton premier salarié.");
  b('#p-gen', "Établit d'un coup les bulletins qui manquent pour ce mois, à partir des fiches et des congés.");
  b('#p-month', "Le mois des bulletins affichés.", { nom: 'Mois' });
  b('#p-year', "L'année des bulletins et des déclarations affichés.", { nom: 'Année' });
  b('[data-payer]', "Note que ce salaire est versé : il sort de ta trésorerie.", { nom: 'Marquer payé' });
  b('#new-lv', "Note un congé ou une absence : il se reportera sur le bulletin du mois.");
  b('#new-av', "Note une avance sur salaire : elle se retiendra sur les prochains bulletins.");
  b('#d-quarter', "Le trimestre de la déclaration CNSS.", { nom: 'Trimestre' });
  b('#cn-csv', "Exporte la déclaration CNSS en CSV.");
  b('#cn-mail', "Envoie la déclaration à ton comptable, en pièce jointe.");
  b('#cn-file', "Note que la déclaration CNSS est déposée. C'est un pense-bête : SkanFact ne dépose rien à ta place.");
  b('#cn-mat', "Renseigne ton numéro d'employeur CNSS dans ta fiche société.");
  b('#an-csv', "Exporte la déclaration d'employeur en CSV.");
  b('#an-file', "Note que la déclaration d'employeur est déposée (ou retire la mention).");
  b('#reg-csv', "Exporte le registre du personnel.");
  b('#add-br', "Ajoute une tranche au barème de l'IRPP.");
  b('[data-b]', "Une tranche du barème : jusqu'à quel revenu, et à quel taux.", { nom: 'Tranches', cle: 'tranche' });
  b('[data-brm]', "Retire cette tranche.", { nom: 'Retirer la tranche', cle: 'brm' });
  b('#rf-reset', "Remet les taux livrés avec SkanFact.");
  b('#rf-cancel', "Oublie les modifications de la page.");
  b('#rf-save', "Enregistre les barèmes. Les bulletins déjà établis ne changent pas : ils gardent leur calcul.");
  b('#edit-emp', "Modifie la fiche du salarié.");
  b('#new-slip', "Établit un bulletin pour ce salarié.");
  b('#hr-doc', "Établit un document : attestation de travail, certificat, solde de tout compte.");
  b('[data-hr]', "Établit un document pour ce salarié.", { nom: 'Établir un document' });
  b('#add-lv', "Note un congé ou une absence.");
  b('#add-av', "Note une avance sur salaire.");
  b('[data-pdf]', "Le bulletin en PDF.", { nom: 'PDF' });
  b('[data-ee]', "Modifie la fiche du salarié.", { nom: 'Modifier', cle: 'ee' });
  b('[data-file]', "Note que la déclaration est déposée.", { nom: 'Marquer déposée' });

  // ---------- stock ----------
  b('#st-new', "Crée un article suivi en stock.");
  b('#st-pick', "Choisis dans ton catalogue une prestation à suivre en stock.");
  b('#st-adj', "Note un mouvement de stock : une casse, de la matière utilisée, un ajustement.");
  b('#adj-item', "Note un mouvement de stock pour cet article.");
  b('#edit-item', "Modifie l'article : prix, seuil d'alerte, emplacement.");
  b('#st-war', "Ouvre les garanties du matériel vendu.");
  b('#st-csv', "Exporte ce que tu regardes (l'état, les mouvements, les numéros) en CSV.");
  b('#st-only', "Ne garder que ce qui est en stock, ou à surveiller.", { nom: 'Filtre' });
  b('#st-q', "Cherche un article.", { nom: 'Recherche' });
  b('#st-year', "L'année des mouvements.", { nom: 'Année' });
  b('#se-add', "Entre une liste de numéros de série (collée depuis un tableur).");
  b('#se-q', "Cherche un numéro, un article ou un client.", { nom: 'Recherche' });
  b('#se-st', "Ne garder qu'un état (en stock, chez le client…).", { nom: 'État' });
  b('[data-ser]', "Modifie ce numéro de série.", { nom: 'Modifier', cle: 'ser' });
  b('[data-iid]', "Ce que tu as compté sur l'étagère pour cet article.", { nom: 'Compté', cle: 'compte' });
  b('#inv-apply', "Enregistre les écarts entre ce que tu as compté et ce que SkanFact attendait.");
  b('#inv-clear', "Efface le comptage en cours.");
  b('[data-achat]', "Prépare l'achat de cet article, avec la quantité qui manque.", { nom: 'Commander…' });
  b('#g-days', "Les garanties qui finissent dans combien de jours.", { nom: 'Horizon' });
  b('[data-quote]', "Prépare un devis de contrat pour ce client : une fin de garantie est une occasion.", { nom: 'Proposer un contrat' });

  // ---------- immobilisations ----------
  b('#new-imm', "Crée la fiche d'un bien (ordinateur, véhicule, mobilier) : son prix, sa date, sa durée.");
  b('#im-csv', "Exporte le tableau des amortissements.");
  b('#im-year', "L'exercice du tableau.", { nom: 'Année' });
  b('[data-mk]', "Crée la fiche du bien à partir de cette ligne d'achat : tant qu'elle attend, rien ne se déduit.", { nom: 'Créer la fiche du bien' });
  b('#edit-imm', "Modifie le bien.");
  b('#dispose', "Sors le bien du patrimoine (vendu, mis au rebut) : SkanFact calcule la plus ou moins-value.");

  // ---------- trésorerie ----------
  b('#new-acc', "Ajoute un compte : une banque, une caisse.");
  b('#first-acc', "Crée ton premier compte.");
  b('#new-move', "Note un mouvement qui ne vient pas d'une facture : frais bancaires, apport, retrait.");
  b('#exp-moves', "Exporte les mouvements en CSV.");
  b('#t-acc', "Le compte regardé.", { nom: 'Compte' });
  b('#t-acc2', "Le compte bancaire à rapprocher.", { nom: 'Compte à rapprocher' });
  b('#t-days', "Jusqu'où regarder devant toi.", { nom: 'Horizon' });
  b('#t-year', "L'année dont la trésorerie est montrée.", { nom: 'Année' });
  b('#t-vus', "Montre ou cache ce qui est déjà pointé.", { nom: 'Déjà pointés' });
  b('#stmt', "Recopie le solde de ton relevé bancaire : SkanFact te dit si ça tombe juste.", { nom: 'Solde du relevé' });
  b('[data-rec]', "Coche ce qui apparaît sur ton relevé bancaire.", { nom: 'Pointer', cle: 'rec' });
  b('[data-eacc]', "Modifie le compte.", { nom: 'Modifier', cle: 'eacc' });

  // ---------- statistiques ----------
  b('#s-kind', "La période : l'année, un trimestre, un mois.", { nom: 'Période' });
  b('#s-year', "L'année analysée.", { nom: 'Année' });
  b('#s-export', "Exporte les statistiques en CSV.");
  b('#s-goal', "Fixe un objectif de chiffre d'affaires : la page te dit où tu en es.");
  b('#s-relances', "Ouvre les relances.");

  // ---------- comptabilité ----------
  b('#c-year', "L'année des journaux, de la TVA et des clôtures affichés.", { nom: 'Année' });
  b('#c-month', "Le mois, ou toute l'année.", { nom: 'Mois' });
  b('#cpt-q', "Cherche une pièce : numéro, client, objet, référence.", { nom: 'Recherche' });
  b('#exp-journal', "Exporte le journal des ventes en CSV.");
  b('#exp-buys', "Exporte le journal des achats en CSV.");
  b('#exp-pays', "Exporte les encaissements en CSV.");
  b('#exp-decs', "Exporte les déclarations en CSV.");
  b('#exp-pdfs', "Enregistre d'un coup les PDF de toutes les pièces de la période.");
  b('#exp-comptable', "Envoie les journaux de la période à ton comptable, en pièces jointes.");
  b('#vat-ventes', "Ouvre les ventes du mois qui font la TVA collectée.");
  b('#vat-achats', "Ouvre les achats du mois qui font la TVA récupérable.");
  b('#set-carry', "Reporte un crédit de TVA venu de l'année précédente.");
  b('[data-cert]', "Note que l'attestation de retenue à la source est reçue.", { nom: 'Attestation reçue', cle: 'cert' });
  b('[data-check]', "Ouvre ce que ce contrôle signale.", { nom: 'Voir', cle: 'check' });
  b('[data-fdone]', "Note que cette échéance est déposée (un pense-bête : SkanFact ne dépose rien).", { nom: 'Marquer déposée', cle: 'fdone' });
  b('[data-fundo]', "Retire la mention « déposée ».", { nom: 'Retirer « déposée »', cle: 'fundo' });
  b('[data-fvers]', "Prépare ce qu'il faut pour cette échéance.", { nom: 'Préparer', cle: 'fvers' });
  b('[data-active]', "Active ou désactive cette échéance dans ton calendrier.", { nom: 'Active', cle: 'active' });
  b('[data-day]', "Le jour du mois de l'échéance.", { nom: 'Jour', cle: 'day' });
  b('[data-onglet]', "Ouvre l'onglet cité.", { nom: 'Lien' });
  b('#ecr-od', "Saisis une opération diverse (une écriture que tes pièces ne produisent pas).");
  b('#ecr-csv', "Exporte les écritures en CSV, pour le logiciel de ton comptable.");
  b('#ecr-mail', "Envoie les écritures à ton comptable.");
  b('#ecr-plan', "Les numéros de comptes que SkanFact emploie : ton comptable peut les changer.");
  b('#gl-plan, #bal-plan, #et-plan', "Les numéros de comptes que SkanFact emploie : ton comptable peut les changer.", { nom: 'Plan de comptes…', cle: 'plan' });
  b('#ecr-central-csv', "Exporte le journal centralisateur.");
  b('#gl-csv, #bal-csv, #et-csv', "Exporte ce tableau en CSV.", { nom: 'Exporter en CSV', cle: 'csv-compta' });
  b('[data-vue]', null, { onglet: true });
  b('#do-close', "Clôture ce mois : plus aucune pièce datée de ce mois ne pourra changer. SkanFact fait ses contrôles avant, sans jamais bloquer.");
  b('#close-to', "Clôture d'un coup jusqu'à un mois plus récent.");
  b('#do-reopen', "Rouvre une période clôturée — avec un motif : c'est la seule trace qui expliquera pourquoi un chiffre a changé.");
  b('#cl-import', "Importe le dossier de clôture de ton comptable : ses à-nouveaux officiels.");
  b('#cab-month', "Le mois du paquet.", { nom: 'Mois' });
  b('#cab-build', "Fabrique le paquet du mois : journaux, pièces et justificatifs, en un fichier.");
  b('#cab-mail', "Envoie le paquet à ton comptable.");
  b('#cab-goclose', "Clôture le mois avant de l'envoyer : un paquet n'est définitif que si le mois est clôturé.");
  b('#cab-vers-factures', "Ouvre les factures.");
  b('#cab-vers-mois', "Ouvre le mois cité.");
  b('#q-import', "Importe le fichier des questions de ton comptable : chacune s'affiche sur la pièce qu'elle concerne.");
  b('#c-plus', "L'option « Comptabilité complète » : grand livre, balance, états financiers.");

  // ---------- paramètres ----------
  b('#set-q', "Cherche un réglage par son nom (« timbre », « sauvegarde »…) : il te dit dans quel onglet il vit.", { nom: 'Chercher un réglage' });
  b('[data-somm]', "Descend au panneau nommé.", { nom: 'Le sommaire', cle: 'somm' });
  b('[data-vers-champ]', "T'emmène au champ cité.", { nom: 'Lien' });
  b('#redo-setup, #redo-setup-2', "Relance l'assistant du premier jour, prérempli : il ne réécrit que ce que tu lui redonnes.", { nom: 'Revoir l\'assistant', cle: 'setup' });
  b('#pick-logo', "Choisis ton logo (PNG, JPG ou SVG) : il s'imprime en haut de tes documents.");
  b('#rm-logo', "Retire le logo.");
  b('#pick-stamp', "Choisis l'image de ton cachet ou de ta signature : elle se pose dans la case « Cachet et signature ».");
  b('#rm-stamp', "Retire le cachet.");
  b('#go-modules', "Choisis les modules qui s'affichent dans le menu. Rien n'est supprimé : un module masqué revient d'un clic.");
  b('#set-support', "Prépare un mail pour signaler un problème, avec le journal technique joint.");
  b('#set-idee', "Propose une amélioration : ce que tu aimerais faire, et comment tu t'en sors aujourd'hui.");
  b('#set-log', "Ouvre le journal technique (utile quand on te dépanne).");
  b('#set-aide', "Ouvre l'Aide.");
  b('#dos-add', "Crée une autre entreprise sur cet ordinateur (chacune a ses propres données).");
  b('#dos-share', "Partage ce dossier avec quelqu'un (dans un dossier commun) : vous travaillez tous les deux sur les mêmes données.");
  b('#dos-join', "Ouvre un dossier déjà partagé par quelqu'un d'autre.");
  b('#dev-name', "Le nom de cet ordinateur, tel qu'il apparaît quand vous travaillez à deux.", { nom: 'Nom du poste' });
  b('#dev-save', "Renomme cet ordinateur.");
  b('#backup-now', "Prend une sauvegarde tout de suite (SkanFact en prend déjà une chaque jour).");
  b('#open-backups', "Ouvre le dossier des sauvegardes.");
  b('[data-restore]', "Remet tes données dans l'état de cette sauvegarde. SkanFact te dit d'abord ce que tu vas perdre.", { nom: 'Restaurer…', cle: 'restore' });
  b('#export-data', "Exporte toutes tes données en un fichier.");
  b('#import-data', "Remplace tes données par un fichier exporté (une sauvegarde est prise avant).");
  b('#ext-choose', "Choisis un dossier (clé USB, iCloud, OneDrive) où SkanFact recopie tes données tout seul : l'étape que tout le monde saute, et la seule dont l'absence coûte tout.");
  b('#ext-remove', "Arrête la copie automatique.");
  b('#sec-set', "Protège tes données par un mot de passe : sans lui, personne ne peut les ouvrir.");
  b('#sec-change', "Change le mot de passe.");
  b('#sec-lock', "Verrouille SkanFact tout de suite.");
  b('#sec-remove', "Retire le mot de passe.");
  b('#load-demo', "Charge l'entreprise d'exemple (cinq ans d'activité) ; tes données sont mises de côté.");
  b('#wipe-data', "Efface toutes tes données (une sauvegarde est prise avant, et il faut taper EFFACER).");
  b('#cancel-set', "Oublie les modifications non enregistrées de la page.");
  b('#set-vers-aide', "Ouvre l'Aide.");
  b('#cab-import', "Importe le fichier d'appairage de ton cabinet : tes paquets lui seront chiffrés.");
  b('#cab-repair', "Remplace le cabinet appairé par un autre.");
  b('#cab-unpair', "Retire le cabinet appairé.");
  b('#cab-oublier-sig', "Oublie la signature retenue de ton cabinet (après un changement de clé confirmé avec lui).");
  b('#lic-save', "Enregistre la clé de licence collée ci-dessus.");
  b('#lic-ask', "Prépare le mail qui demande une licence.");
  b('#lic-clear', "Retire la clé de licence.");
  b('#lic-copier-emp', "Copie l'empreinte de ta licence (pour la vérifier sur skanfact.tn).");
  b('#lic-param', "Ouvre ta licence dans les Paramètres.");
  b('#upd-check', "Cherche tout de suite une nouvelle version.");
  b('#upd-changelog', "Ce qui a changé dans chaque version.");
  b('#upd-beta', "Reçois les versions d'essai avant tout le monde (une sauvegarde est prise avant).", { nom: 'Versions d\'essai' });
  b('#ocr-key', "Active la lecture des photos de factures (demande une clé d'accès payante).");
  b('#ocr-off', "Désactive la lecture et efface la clé.");

  // ---------- modules, aide, guide ----------
  b('#mod-all', "Remet tous les modules dans le menu.");
  b('[data-mod]', "Affiche ou masque ce module dans le menu. Ses données restent.", { nom: 'Un module', cle: 'mod' });
  b('[data-sousmod]', "Affiche ou masque cette partie du module.", { nom: 'Une option', cle: 'sousmod' });
  // `data-open` porte QUATRE gestes selon la page : une entreprise, un module, un fichier joint, une
  // ligne d'achat. Sans la route, la bulle d'un fichier joint disait « Ouvre cette entreprise » : une
  // explication fausse est pire qu'une explication absente, parce qu'aucun instrument ne la voit.
  b('[data-open]', "Ouvre cette entreprise : l'application se recharge sur ses données.", { route: 'parametres', nom: 'Ouvrir' });
  b('[data-open]', "Ouvre la première page de ce module.", { route: 'modules', nom: 'Ouvrir', cle: 'mod-open' });
  b('[data-open]', "Ouvre le fichier joint avec le programme de ton ordinateur : lecteur PDF, visionneuse de photos.", { route: ['doc', 'achat'], nom: 'Le fichier joint', cle: 'att-open' });
  b('#aide-q', "Tape un mot ou une question : la recherche lit le contenu des articles, pas seulement les titres.", { nom: 'Recherche' });
  b('[data-art]', "Ouvre cet article.", { nom: 'Un article', cle: 'art' });
  b('[data-theme]', "Descend au domaine nommé.", { nom: 'Un domaine', cle: 'theme' });
  b('#aide-support', "Prépare un mail pour signaler un problème.");
  b('#aide-idee', "Propose une amélioration.");
  b('#aide-changelog', "Ce qui a changé dans cette version.");
  b('#aide-guide', "Ouvre « Me guider » : au lieu de lire, on te montre où cliquer, sur ton vrai écran.");
  b('#guide-q', "Écris ce que tu veux faire : les visites qui correspondent restent.", { nom: 'Recherche' });
  b('[data-visite]', "Lance cette visite.", { nom: 'Une visite', cle: 'visite' });
  // Le bouton du prochain geste porte deux noms selon ce qu'il fait : reprendre une visite en pause,
  // ou lancer la suivante (la découverte, puis le premier pas qui manque).
  b('#g-reprendre', "Reprend la visite en pause, à l'étape où tu l'avais laissée.");
  b('#g-prochain', "Lance le prochain geste : la découverte de l'exemple tant qu'elle n'est pas faite, puis le premier de tes premiers pas qui manque.");
  b('#g-aide', "Ouvre l'Aide.");
  b('#g-licence', "Ouvre ta licence, dans les Paramètres : son état, ce qu'elle ouvre, et comment l'obtenir.");
  b('#pp-decouvrir', "Charge l'entreprise d'exemple — tes données sont mises de côté — et lance le grand tour, chapitre par chapitre.");
  b('#pp-guider', "Te guide clic par clic dans ta vraie entreprise : ta fiche, ton premier client, ton premier devis.");
  b('#pp-plus-tard', "Range cet accueil. La découverte et chaque visite restent dans « Me guider », en bas du menu.");
  b('#guide-proposer', "Propose (ou non) la visite d'une page la première fois que tu l'ouvres.", { nom: 'Proposer les visites' });

  // ---------- ce que la couverture a trouvé sans explication (24/09/2026) ----------
  b('#cl-edit', "Ouvre la fiche de ce client par-dessus la pièce : tu corriges son adresse, son matricule ou son mail sans perdre ce que tu écris.", { nom: 'Modifier la fiche' });
  b('#rv-mail', "Ouvre ta messagerie avec le relevé en pièce jointe, prêt à partir chez le client.");
  b('#rl-add', "Ajoute une ligne au contrat : une prestation de plus, facturée à chaque échéance.");
  b('[data-rdesc]', "Ajoute une description sous la ligne ; elle est reprise sur chaque facture du contrat.", { nom: '+ description', cle: 'rdesc' });
  b('#tf-add', "Ajoute une ligne vide au modèle, à remplir.");
  b('[data-qrem]', "Prépare le mail qui relance le client sur ce devis resté sans réponse, prêt à partir.", { nom: 'Relancer le devis', cle: 'qrem' });
  b('#clear', "Retire le report : la facture revient tout de suite dans la liste des relances.", { route: 'relances' });
  b('#sup-what', "Ce que tu faisais quand le problème est arrivé, et ce que tu as vu. Plus c'est précis, plus vite c'est corrigé.", { nom: 'Ce qui s\'est passé' });
  b('#sup-log', "Ouvre le journal de l'application : c'est lui qui accompagne le signalement, et tu peux le lire avant.");
  b('#idee-quoi', "Ce que tu aimerais pouvoir faire dans SkanFact.", { nom: 'Ce que tu aimerais faire' });
  b('#idee-auj', "Comment tu t'en sors aujourd'hui : c'est ce qui apprend le plus sur ce qu'il faut construire.", { nom: 'Comment tu fais aujourd\'hui' });
  b('#redo-setup', "Rejoue l'assistant du premier jour, prérempli avec tes réponses : il ne réécrit que ce que tu lui redonnes.");
  b('#redo-setup-2', "Rejoue l'assistant du premier jour, prérempli avec tes réponses : il ne réécrit que ce que tu lui redonnes.");
  b('#c-del', "Supprime le contrat, après confirmation. Les factures qu'il a déjà générées restent.");
  b('#add-bon', "Ajoute une prime ou une indemnité au bulletin : elle entre dans le brut, et le net se recalcule.");
  b('#add-ded', "Ajoute une retenue au bulletin — une avance remboursée, par exemple : le net se recalcule.");
  b('#undo-dis', "Annule la sortie du bien : il revient à l'actif, et son amortissement reprend.");
  b('#gl-csv', "Enregistre le grand livre affiché dans un fichier que ton tableur et ton comptable ouvrent.");
  b('#bal-csv', "Enregistre la balance affichée dans un fichier que ton tableur et ton comptable ouvrent.");
  b('#et-csv', "Enregistre les états financiers dans un fichier que ton tableur et ton comptable ouvrent.");
  ['#gl-plan', '#bal-plan', '#et-plan'].forEach(id => b(id, "Ouvre ton plan de comptes : le numéro où SkanFact écrit chaque sorte d'opération, que ton comptable peut changer."));
  b('#ch-reset', "Remet les numéros de compte proposés au départ, à la place de ceux que tu as changés — SkanFact demande d'abord.");
  // L'opération diverse : la seule écriture qu'on écrit soi-même, ligne par ligne.
  b('.od-compte', "Le numéro du compte : tape les premiers chiffres, SkanFact propose ceux de ton plan et écrit leur intitulé à côté.", { nom: 'Compte' });
  b('.od-label', "Le libellé de cette ligne, s'il diffère de celui de l'opération (facultatif).", { nom: 'Libellé de la ligne' });
  b('.od-debit', "Le montant au débit de ce compte. Une ligne porte un débit OU un crédit.", { nom: 'Débit' });
  b('.od-credit', "Le montant au crédit de ce compte. L'opération n'entre que si le total des débits égale celui des crédits.", { nom: 'Crédit' });
  b('.od-del', "Retire cette ligne de l'opération.", { nom: 'Retirer la ligne' });
  b('#od-add', "Ajoute une ligne à l'opération : un compte de plus à débiter ou à créditer.");
  // Les états vides : le premier geste d'une page qui n'a encore rien (le second passage de
  // `e2e:couverture`, sur une entreprise vierge, en a trouvé seize sans explication).
  b('#vide-new', "Ouvre la première pièce de cette liste, vierge : tu choisis le client, tu ajoutes tes lignes, le total se calcule.");
  b('#vide-demo', "Charge l'entreprise d'exemple de cinq ans pour voir cette page remplie. Tes données sont mises de côté, et « Quitter l'exemple » te les rend.");
  b('#vide-client', "Ouvre la fiche de ton premier client : son nom, son matricule, son adresse. Ils se reporteront tout seuls sur chaque pièce.");
  b('#vide-fournisseur', "Ouvre la fiche de ton premier fournisseur : ses factures d'achat s'y rattacheront, avec ce que tu lui dois.");
  b('#vide-achat', "Saisis ta première facture d'achat : ses lignes, et sa TVA — celle que tu récupères. Joins la photo de la facture avant de saisir.");
  b('#vide-dep', "Note une dépense du quotidien (carburant, fournitures) : plus courte qu'une facture d'achat.");
  b('#rec-first', "Crée ton premier contrat : le client, les lignes, la fréquence. À chaque échéance, SkanFact prépare la facture ; tu n'as qu'à l'émettre.");
  b('#rel-vers-new', "Ouvre une facture vierge. Les relances ne concernent que des factures émises dont l'échéance est passée.");
  b('#proj-first', "Crée ta première affaire (un chantier, un projet) : ses ventes et ses achats s'y rattachent, et sa fiche dit ce qu'elle rapporte vraiment.");
  b('#immo-premier', "Crée la fiche de ton premier bien (ordinateur, véhicule, mobilier) : son prix, sa date, sa durée. Le plan d'amortissement s'affiche pendant que tu tapes.");
  b('#immo-vers-achats', "Saisis la facture d'achat du bien : sa ligne en destination « immobilisation » viendra attendre ici que tu crées sa fiche.");
  b('#mg-vers-contrats', "Ouvre la facturation récurrente : c'est là que se créent les contrats dont cet onglet mesure ce qu'ils rapportent.");
  b('#g-choisir', "Choisis dans ton catalogue la prestation à suivre par numéro de série : sa fiche s'ouvre avec le suivi coché, et tu choisis la garantie.");
  b('#g-suivre', "Crée un article suivi par numéro de série : chaque unité vendue aura sa garantie, et cette page annoncera celles qui se terminent.");
  b('#mod-add', "Remet cette page dans ton menu, à gauche. Elle marchait déjà : elle n'y était simplement pas affichée.");
  b('[data-pas-guide]', "Te guide pour cette étape sur ton vrai écran : je te montre où cliquer, et j'attends que tu l'aies fait.", { nom: 'Me guider', cle: 'pas-guide' });
  // Les fichiers : joints à une pièce, ou fabriqués pour le comptable. « Où est mon fichier ? » est la
  // question qu'on pose le jour où on en a besoin — chaque bouton dit où il mène.
  b('[data-reveal]', "Montre ce fichier dans son dossier, sur ton ordinateur : pour le glisser dans un mail ou le copier ailleurs.", { route: ['doc', 'achat'], nom: 'Dossier', cle: 'att-reveal' });
  b('[data-rmatt]', "Retire ce fichier joint : la copie gardée par SkanFact est supprimée, ton fichier d'origine ne bouge pas.", { nom: '✕', cle: 'att-rm' });
  b('[data-reveal]', "Montre le fichier du paquet dans son dossier, sur ton ordinateur : c'est lui que tu envoies, ou que ton comptable te redemande.", { route: 'compta', nom: 'Montrer le fichier', cle: 'pack-reveal' });
  // Ce qui revient du comptable : ses questions, sa clôture.
  b('[data-rep]', "Réponds à cette question de ton comptable. Ta réponse part dans le paquet du mois, dès que tu le fabriques ou le refais.", { nom: 'Répondre', cle: 'rep' });
  b('[data-qrep]', "Réponds à la question de ton comptable sur cette pièce. Ta réponse part dans le paquet du mois, dès que tu le fabriques ou le refais.", { nom: 'Répondre', cle: 'qrep' });
  b('[data-etats]', "Ouvre les états financiers que ton comptable a joints à sa clôture : son bilan et son compte de résultat.", { nom: 'Voir les états', cle: 'etats' });

  // ---------- fenêtres : les boutons communs ----------
  b('[data-close]', "Ferme la fenêtre sans rien garder. Si tu as tapé quelque chose, SkanFact demande d'abord.", { nom: 'Annuler', cle: 'fermer' });
  b('.modal-actions .btn-danger', "Supprime, après confirmation. SkanFact dit d'abord ce qui y est rattaché.", { nom: 'Supprimer', cle: 'supprimer' });
  b('.modal-actions .btn-primary', "Valide ce que tu viens de saisir dans la fenêtre.", { nom: 'Valider', cle: 'valider' });

  // Les champs sans bulle « i » : par leur nom. Les autres prennent le texte de leur bulle.
  const CHAMPS = {
    name: "Le nom, tel qu'il doit s'afficher et s'imprimer.",
    email: "L'adresse mail : c'est là que partent tes pièces et tes relances.",
    phone: "Le téléphone, pour appeler depuis la fiche.",
    address: "L'adresse, sur plusieurs lignes : elle s'imprime telle quelle.",
    notes: "Ce qu'il faut se rappeler. Jamais imprimé.",
    note: "Une remarque qui accompagne ce que tu notes (jamais imprimée).",
    amount: "Le montant.",
    method: "Le mode : virement, chèque, espèces, traite…",
    reference: "La référence : le numéro du chèque, du virement.",
    label: "Le nom que tu lui donnes.",
    accountId: "Le compte concerné : la banque ou la caisse.",
    bank: "Le nom de la banque.",
    iban: "Le RIB ou l'IBAN du salarié, pour le virement de son salaire.",
    cin: "Le numéro de carte d'identité.",
    position: "Le poste occupé.",
    currency: "La devise des pièces de ce client.",
    lang: "La langue de ses documents.",
    level: "Le ton de la relance : rappel, relance, dernière relance.",
    list: "Colle ta liste de numéros, un par ligne.",
    serial: "Le numéro de série.",
    location: "Où l'article est rangé.",
    unitCost: "Ce que te coûte une unité (laisse vide : SkanFact prend le coût moyen).",
    unitPrice: "Le prix de vente hors taxe.",
    vatRate: "Le taux de TVA.",
    discountRate: "La remise habituelle, en pourcentage.",
    description: "Une phrase plus longue, sous le nom.",
    subject: "L'objet repris sur le document.",
    text: "Le texte à insérer.",
    type: "Le type de document.",
    reason: "Pourquoi le bien sort : vendu, mis au rebut, volé…",
    piece: "Le numéro de pièce, attribué à l'enregistrement.",
    website: "Ton site, imprimé en bas de tes documents."
  };

  // ========================================================================== LES FONCTIONS
  const nettoie = t => String(t == null ? '' : t).replace(/\s+/g, ' ').replace(/\s*[▾▸]\s*$/, '').trim();
  function libelleDe(el) {
    const aria = el.getAttribute('aria-label');
    if (aria) return nettoie(aria);
    if (el.matches('input, select, textarea') || el.classList.contains('combo-btn')) {
      const l = el.closest('label, .field');
      if (l) {
        const c = l.cloneNode(true);
        c.querySelectorAll('input, select, textarea, button, .combo-list, .small, .muted').forEach(x => x.remove());
        const t = nettoie(c.textContent);
        if (t) return t;
      }
      return nettoie(el.placeholder || el.getAttribute('title') || '');
    }
    const c = el.cloneNode(true);
    c.querySelectorAll('button.i, .badge, .pp-compte').forEach(x => x.remove());
    return nettoie(c.textContent || el.value || el.getAttribute('title'));
  }
  // Le résumé d'une bulle « i » : sa première ou ses deux premières phrases, sans balise.
  function resume(html) {
    const t = String(html || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const phrases = t.match(/[^.!?]+[.!?]+(\s|$)/g) || [t];
    let out = '';
    for (const p of phrases) { if ((out + p).length > 190 && out) break; out += p; }
    return out.trim();
  }
  const route = () => (String((typeof location !== 'undefined' && location.hash) || '').replace(/^#\/?/, '').split('/')[0] || 'dashboard');

  // Les gestes du menu « Actions », page par page : le bouton ne dit rien de ce qu'il cache.
  const MENUS = {
    dashboard: "Ouvrir la pièce, l'exporter en PDF, l'envoyer…",
    devis: "Ouvrir, envoyer, dupliquer, noter la réponse du client, facturer, supprimer.",
    factures: "Ouvrir, envoyer, enregistrer un paiement, relancer, dupliquer, créer un avoir.",
    autres: "Ouvrir, envoyer, facturer, tirer une autre pièce.",
    clients: "Ouvrir la fiche, modifier le client, faire un devis, envoyer son relevé de compte.",
    client: "Écrire au client, modifier sa fiche, son relevé de compte.",
    catalogue: "Modifier la prestation, la dupliquer, faire un devis avec, voir son stock.",
    contrats: "Ouvrir la fiche, modifier le contrat, le suspendre ou le reprendre, générer maintenant.",
    contrat: "Ouvrir, envoyer, enregistrer un paiement.",
    relances: "Relancer par email, noter un appel, reporter, noter un paiement, envoyer le relevé.",
    fournisseurs: "Ouvrir la fiche, modifier le fournisseur, saisir un achat.",
    achats: "Ouvrir la pièce, la dupliquer, saisir un avoir ou un acompte du fournisseur.",
    achat: "Modifier ou supprimer ce règlement.",
    doc: "Modifier ou supprimer ce paiement.",
    paie: "Modifier le bulletin, l'exporter en PDF, le supprimer.",
    compta: "Modifier ou supprimer l'opération diverse.",
    parametres: "Ouvrir, renommer ou retirer ce dossier d'entreprise.",
    affaire: "Ouvrir, envoyer, facturer.",
    licences: "Voir la clé, la copier, renouveler, révoquer."
  };

  // Ce que fait un contrôle : { cle, nom, texte }, ou null — et c'est l'instrument de couverture qui
  // compte les null, écran par écran.
  function expliquer(el, ctx) {
    if (!el || !el.matches) return null;
    const r = (ctx && ctx.route) ? ctx.route() : route();
    const G = (ctx && ctx.G) || (typeof window !== 'undefined' && window.SkanGuide) || { INFO: {} };
    const lab = libelleDe(el);
    // 0. une action d'un menu « Actions » porte sa propre phrase (7.28.0) : la visite dit la MÊME que
    // celle que la personne lit dans le menu, jamais une seconde qui divergerait.
    if (el.matches('.row-menu button')) {
      const l = el.querySelector('.rm-l'), ph = el.querySelector('.rm-h');
      const nom = l ? nettoie(l.textContent) : lab;
      const phrase = ph ? nettoie(ph.textContent) : '';
      if (phrase) return { cle: 'rm:' + nom, nom, texte: phrase };
    }
    // 1. le dictionnaire
    for (let i = 0; i < B.length; i++) {
      const x = B[i];
      if (x.route && !(Array.isArray(x.route) ? x.route : [x.route]).includes(r)) continue;
      if (x.id && el.id !== x.id) continue;
      if (x.sel) { let ok = false; try { ok = el.matches(x.sel); } catch (_) { ok = false; } if (!ok) continue; }
      if (x.lib && !x.lib.test(lab)) continue;
      if (x.rowmenu) return { cle: 'rowmenu', nom: x.nom, texte: `Tous les autres gestes de cette ligne, chacun avec sa phrase : ${MENUS[r] || 'ouvrir, modifier, supprimer…'}` };
      if (x.onglet) break;
      return { cle: x.cle || (x.id ? '#' + x.id : 'b' + i), nom: x.nom || lab || x.id, texte: x.texte };
    }
    // 2. les onglets
    const onglet = el.dataset && (el.dataset.tab || el.dataset.vue);
    if (onglet && el.closest('.tabs')) {
      const t = ONGLETS[r + ':' + onglet] || ONGLETS[onglet];
      if (t) return { cle: 'tab:' + onglet, nom: lab, texte: t };
    }
    // 3. un champ : la bulle « i » de son libellé, sinon son nom
    const champ = el.matches('input, select, textarea') || el.classList.contains('combo-btn');
    if (champ) {
      const hote = el.closest('label, .field, .combo, .datefield');
      const zone = hote && (hote.closest('label, .field') || hote);
      const bulle = zone && zone.querySelector('button.i[data-info]');
      const x = bulle && G.INFO[bulle.dataset.info];
      if (x) return { cle: 'i:' + bulle.dataset.info, nom: x.t || lab, texte: resume(x.d) };
      const nom = el.getAttribute('name') || (el.closest('[data-combo]') && el.closest('[data-combo]').dataset.combo) || '';
      if (CHAMPS[nom]) return { cle: 'c:' + nom, nom: lab || nom, texte: CHAMPS[nom] };
      // Les familles de champs qu'on reconnaît à leur forme.
      if (el.closest('.datefield') || el.classList.contains('d-txt')) return { cle: 'date', nom: lab || 'Date', texte: "Tape la date (JJ/MM/AAAA, ou juste le jour) ou choisis-la dans le calendrier." };
      if (el.closest('#chart-form, .chart-form') || /^\d{2,6}$/.test(String(el.value || '').trim()) && el.closest('.modal')) return { cle: 'plan', nom: lab || 'Compte', texte: "Le numéro de compte où SkanFact écrit ce type d'opération. Proposé selon l'usage tunisien : ton comptable peut le changer." };
      if (/^et(en)?_/.test(nom)) return { cle: 'modele-mail', nom: lab || 'Modèle de mail', texte: "Le texte proposé pour ce mail ; {numero}, {client}, {societe}… se remplacent tout seuls." };
      if (el.classList.contains('combo-btn')) return { cle: 'combo', nom: lab || 'Liste', texte: "Clique pour ouvrir la liste, tape quelques lettres pour chercher, et choisis." };
      if (el.type === 'search' || /^Rechercher/i.test(el.placeholder || '')) return { cle: 'recherche', nom: 'Recherche', texte: "Tape quelques lettres : la liste se réduit pendant la frappe." };
    }
    // 4. un bouton de calendrier, un lien vers une pièce
    if (el.matches('.d-btn, [aria-label="Ouvrir le calendrier"]')) return { cle: 'cal', nom: 'Calendrier', texte: "Ouvre le calendrier pour choisir la date." };
    if (el.matches('a[href^="#/"]')) return { cle: 'lien:' + (el.getAttribute('href') || '').split('/')[1], nom: lab, texte: "Ouvre ce qui est nommé." };
    return null;
  }

  // Le titre et le mot d'un bloc de l'écran (pour les visites de page).
  function zone(el) {
    for (const z of ZONES) {
      let ok = false;
      try { ok = el.matches(z.sel); } catch (_) { ok = false; }
      if (ok) {
        const titre = z.sel === '.banner' ? nettoie((el.querySelector('b') || el).textContent).slice(0, 80) : z.titre;
        return { titre: titre || z.titre, texte: z.texte };
      }
    }
    return null;
  }

  // ========================================================================== LES VISITES
  // `ctx` : ce que l'application prête — ses données, le moteur, et de quoi ouvrir un objet.
  function parcours(ctx) {
    const $ = s => document.querySelector(s);
    const data = () => ctx.data();
    const hash = () => location.hash;
    const fenetre = mot => [...document.querySelectorAll('#modal-root .modal')].some(m => { const t = m.querySelector('h2'); return !!(t && t.textContent.includes(mot)); });
    const aucuneFenetre = () => !document.querySelector('#modal-root .modal');
    const combo = nom => `[data-combo="${nom}"] .combo-btn`;
    const valeur = sel => { const el = $(sel); return el ? String(el.value || '').trim() : ''; };
    const nb = liste => (data()[liste] || []).length;
    // Le nombre de paquets à l'entrée de l'étape « Fabriquer » : sa preuve est un paquet DE PLUS.
    let paquetsAvant = 0;
    // L'onglet se clique quand la page qui le porte est DESSINÉE (`Visite.ouvrirOnglet`, 10.14.0) :
    // cliqué aussitôt après `aller()`, il visait l'écran d'avant et ne trouvait rien.
    const onglet = (barre, cle) => () => ctx.Visite.ouvrirOnglet(barre, cle);

    const L = [];
    const visite = v => { L.push(v); return v; };

    // ======================================================================= LA DÉCOUVERTE
    // Le grand tour, sur l'exemple : on voit chaque page REMPLIE, sans risque. Douze chapitres (le
    // compte n'est écrit dans aucune bulle : il se lit dans l'en-tête, calculé) ;
    // « Passer au chapitre suivant » saute ce qui ne concerne pas. Chaque chapitre montre l'essentiel — le
    // détail de chaque bouton vit dans la visite de la page.
    const fiche = cle => () => ctx.premier(cle);
    visite({
      id: 'decouvrir', theme: 'demarrer', type: 'decouverte', exemple: true, duree: '12 min',
      titre: 'Découvrir SkanFact avec un exemple',
      resume: 'Le grand tour, sur une entreprise d\'exemple de cinq ans : chaque page remplie, sans rien risquer.',
      mots: ['visite', 'decouvrir', 'commencer', 'exemple', 'tour', 'debutant', 'interface'],
      suite: ['page-dashboard', 'premier-devis'],
      bravo: 'Tu as fait le tour !',
      conclusion: '<p>Tu as vu chaque partie de SkanFact, remplie. Retiens : <b>le menu</b> à gauche, <kbd>Ctrl</kbd> <kbd>K</kbd> pour tout trouver, et <b>« Me guider »</b> en bas à gauche — chaque page y a sa visite, bouton par bouton.</p><p>Quand tu es prêt, passe à ta vraie entreprise : je te guiderai pour chaque premier geste. Tout ce que tu y saisis t\'appartient — pendant l\'essai et après, licence ou pas, tu gardes la lecture, l\'impression, l\'export et l\'envoi à ton comptable.</p>',
      actions: () => ctx.estDemo() ? [
        { id: 'passer-au-reel', label: 'Passer à ma vraie entreprise', principal: true },
        { id: 'rester', label: 'Continuer à explorer l\'exemple', detail: 'Le bandeau te ramène à tes données quand tu veux' }
      ] : [],
      etapes: [
        // — Bienvenue
        { chapitre: 'Bienvenue', couleur: 'commencer', page: '#/dashboard', titre: 'Bienvenue dans l\'exemple',
          texte: '<p>Voici <b>une entreprise fictive qui a cinq ans</b> : des centaines de factures, des clients, des achats, deux salariés. Tout est inventé, rien ne part : tu peux cliquer partout.</p><p>Je te fais faire le tour, chapitre par chapitre — le compte est écrit en haut de cette bulle. <b>« Passer au chapitre suivant »</b> saute ce qui ne te concerne pas, et la croix met en pause : tu reprendras plus tard depuis « Me guider ».</p>' },
        { page: '#/dashboard', cible: '.demo-banner', cote: 'dessous', titre: 'Tu es dans un bac à sable',
          texte: 'Ce bandeau reste en haut de chaque page tant que l\'exemple est chargé. <b>« Quitter l\'exemple »</b> te rend tes vraies données — elles ont été mises de côté.' },
        { page: '#/dashboard', cible: 'nav#nav', cote: 'droite', titre: 'Le menu',
          texte: 'Tout SkanFact est rangé ici, en trois familles : <b>Vendre</b>, <b>Acheter</b> et <b>Piloter</b>. Un titre de famille se déplie et se replie d\'un clic. Le chiffre à côté d\'une page dit ce qui y attend.' },
        { page: '#/dashboard', cible: '#nav-search', cote: 'droite', titre: 'Tout trouver',
          texte: 'Un client, une facture, une page, un réglage, un article d\'aide : tape quelques lettres. Au clavier : <kbd>Ctrl</kbd> <kbd>K</kbd>, de n\'importe où.' },
        { page: '#/dashboard', cible: '#brand-btn', cote: 'droite', titre: 'Ton entreprise',
          texte: 'Son nom s\'affiche ici. Si tu gères plusieurs entreprises — la tienne, celle d\'un proche — c\'est ici que tu passes de l\'une à l\'autre.' },
        // — L'accueil
        { chapitre: 'L\'accueil', couleur: 'commencer', page: '#/dashboard', cible: '.stats', cote: 'dessous', titre: 'Les chiffres du moment',
          texte: 'Le chiffre d\'affaires du mois et de l\'année, ce qui reste à encaisser, les devis qui attendent une réponse. <b>Chaque carte s\'ouvre</b> sur la liste qu\'elle résume.' },
        { page: '#/dashboard', cible: '.panel.todo', cote: 'gauche', titre: 'À faire',
          texte: 'Ce qui attend un geste de ta part, <b>du plus urgent au moins urgent</b> : une facture en retard, une déclaration, un bulletin à établir. Chaque ligne a son bouton, qui t\'emmène au bon endroit.' },
        { page: '#/dashboard', cible: '.page-head .actions', cote: 'dessous', titre: 'Le bouton vert',
          texte: 'Sur chaque écran, <b>un seul bouton est vert</b> : c\'est l\'étape suivante. Dans le doute, c\'est lui.' },
        // — Vendre
        { chapitre: 'Vendre', couleur: 'vendre', page: '#/devis', cible: ['#list-wrap table.list', '#view table.list'], zone: ['#list-wrap table.list', '#view table.list'], cote: 'dessus', titre: 'Les devis',
          texte: 'Tes propositions de prix. Le statut dit où en est chacun : brouillon, envoyé, accepté, refusé, expiré. <b>Une ligne s\'ouvre d\'un clic</b>.' },
        { page: '#/devis', cible: '#view [data-rowmenu]', cote: 'gauche', titre: 'Le bouton « Actions »',
          texte: 'Au bout de chaque ligne : tous les autres gestes, <b>chacun avec sa phrase</b> — envoyer, dupliquer, noter que le client a dit oui, facturer.' },
        { page: fiche('devis'), cible: ['table:has(> #lines)', '#lines'], cote: 'dessus', titre: 'Dans un devis : les lignes',
          texte: 'Ce que tu vends, ligne par ligne : la désignation, la quantité, le prix hors taxe, la TVA. <b>Le total se calcule tout seul</b>, et chaque ligne se reprend du catalogue d\'un clic.' },
        { page: fiche('devis'), cible: '#pv-col', cote: 'gauche', titre: 'L\'aperçu',
          texte: 'À droite, le document <b>tel que ton client le recevra</b>. « Agrandir » l\'ouvre en grand.' },
        { page: fiche('devis'), cible: ['#convert', '#bill-btn', '#email'], cote: 'dessous', titre: 'Du devis à la facture',
          texte: 'Quand le client dit oui, <b>« Facturer ce devis »</b> fabrique la facture sans rien ressaisir. Tu peux aussi facturer un acompte, puis le solde.' },
        { page: '#/factures', cible: ['#list-wrap table.list', '#view table.list'], zone: ['#list-wrap table.list', '#view table.list'], cote: 'dessus', titre: 'Les factures',
          texte: 'Le statut — payée, partielle, en retard — <b>se déduit tout seul</b> des paiements que tu notes. Tu ne le changes jamais à la main.' },
        { page: '#/factures', cible: '.filters', cote: 'dessous', titre: 'Retrouver une facture',
          texte: 'Cherche par numéro ou par client, filtre par statut (« À encaisser » montre d\'un coup tout ce qu\'on te doit) ou par année.' },
        { page: fiche('factureOuverte'), cible: ['#pay', '#pay2'], cote: 'dessous', titre: 'Encaisser',
          texte: 'Quand ton client paie, <b>« Enregistrer un paiement »</b> : le montant, le mode, la date. La facture passe à « payée » toute seule — ou « partielle » s\'il manque quelque chose.' },
        { page: fiche('factureOuverte'), cible: '.banner.lock, .lock-banner, #lock-credit', cote: 'dessous', facultatif: true, titre: 'Une facture émise est verrouillée',
          texte: 'Elle a son numéro définitif : elle ne se modifie plus. Une erreur ? <b>Un avoir</b> la corrige — c\'est la règle, et SkanFact la tient pour toi.' },
        { page: '#/relances', cible: '#view .panel, #view table.list', cote: 'dessous', titre: 'Les relances',
          texte: 'Les factures échues, classées par ancienneté. <b>À chaque niveau son ton</b> : un rappel poli, une relance, une dernière relance — le mail est prêt, tu relis et tu envoies.' },
        { page: '#/contrats', cible: '#view table.list, #view .panel', cote: 'dessous', titre: 'La facturation récurrente',
          texte: 'Un client que tu factures chaque mois du même montant ? Un contrat prépare la facture à la date prévue ; tu n\'as qu\'à l\'émettre.' },
        // — Clients et catalogue
        { chapitre: 'Clients et catalogue', couleur: 'vendre', page: '#/clients', cible: ['#list-wrap table.list', '#view table.list'], zone: ['#list-wrap table.list', '#view table.list'], cote: 'dessus', titre: 'Les clients',
          texte: 'Tes clients, et <b>ce que chacun te doit</b>. Une ligne ouvre sa fiche.' },
        { page: fiche('client'), cible: '#view .page-head', cote: 'dessous', titre: 'La fiche d\'un client',
          texte: 'Tout ce qui le concerne : ses pièces, ce qu\'il te doit, ses contrats. Le menu <b>« Actions »</b> en haut prépare son <b>relevé de compte</b> à lui envoyer.' },
        { page: '#/catalogue', cible: '#view table.list, #view .panel', cote: 'dessous', titre: 'Le catalogue',
          texte: 'Ce que tu vends, décrit une fois pour toutes avec son prix. <b>Chaque devis le reprend d\'un clic</b>, et les onglets gardent tes modèles et tes textes prédéfinis.' },
        // — Acheter
        { chapitre: 'Acheter', couleur: 'acheter', page: '#/achats', cible: ['#list-wrap table.list', '#view table.list'], zone: ['#list-wrap table.list', '#view table.list'], cote: 'dessus', titre: 'Achats et dépenses',
          texte: 'Tout ce que tu paies. C\'est d\'ici que vient <b>la TVA que tu récupères</b> : un achat oublié, c\'est de la TVA payée deux fois.' },
        { page: '#/achats', cible: '#view .page-head .actions', cote: 'dessous', titre: 'Deux façons de saisir',
          texte: '<b>« + Facture d\'achat »</b> pour une facture en bonne et due forme ; <b>« + Dépense »</b> pour le quotidien (carburant, fournitures). Dans les deux, tu joins la photo du justificatif <b>avant</b> de saisir.' },
        { page: fiche('achat'), cible: '#b-lines, #view table', cote: 'dessus', titre: 'Où va chaque ligne',
          texte: 'Pour chaque ligne, sa <b>destination</b> : une charge du mois, du stock (à revendre), ou une immobilisation (gardée des années). C\'est ce qui rend ton résultat juste.' },
        { page: '#/fournisseurs', cible: '#view table.list, #view .panel', cote: 'dessous', titre: 'Les fournisseurs',
          texte: 'Ceux qui te facturent, et <b>ce que tu leur dois</b>. « Régler » note ton paiement.' },
        // — L'argent
        { chapitre: 'L\'argent', couleur: 'encaisser', page: '#/tresorerie', avant: onglet('#t-tabs', 'position'), cible: '#view .stats, #view .panel', cote: 'dessous', titre: 'Où tu en es',
          texte: 'Le solde de chaque compte, banque et caisse. Les paiements de tes clients et tes règlements y arrivent <b>tout seuls</b> — rien à ressaisir.' },
        { page: '#/tresorerie', avant: onglet('#t-tabs', 'prevision'), cible: '#view .panel', cote: 'dessus', titre: 'Ce qui arrive',
          texte: 'Ce qui va entrer et sortir, jour par jour, et <b>le jour où ton solde pourrait passer sous zéro</b> — assez tôt pour réagir.' },
        { page: '#/tresorerie', avant: onglet('#t-tabs', 'rapprochement'), cible: '#view .panel', cote: 'dessus', titre: 'Rapprocher sa banque',
          texte: 'Tu compares ton relevé à SkanFact et tu coches ce qui correspond : ce qui reste non coché est ce qu\'il faut regarder.' },
        // — Le personnel
        { chapitre: 'Le personnel', couleur: 'equipe', page: '#/paie', avant: onglet('#p-tabs', 'bulletins'), cible: '#view table.list, #view .panel', cote: 'dessus', titre: 'Les bulletins',
          texte: 'Chaque mois, les bulletins de tes salariés : SkanFact les calcule à partir de leur fiche, de leurs congés et de leurs avances. <b>Les taux sont réglables</b> (onglet Barèmes) : ton comptable les vérifie une fois.' },
        { page: '#/paie', avant: onglet('#p-tabs', 'declarations'), cible: '#view .panel', cote: 'dessus', titre: 'La CNSS',
          texte: 'La déclaration du trimestre, prête à recopier ou à envoyer à ton comptable. « Marquer déposée » est un pense-bête : SkanFact ne dépose rien à ta place.' },
        // — Stock et biens
        { chapitre: 'Stock et biens', couleur: 'acheter', page: '#/stock', avant: onglet('#st-tabs', 'etat'), cible: '#view table.list, #view .panel', cote: 'dessus', titre: 'Le stock',
          texte: 'Ce qui est sur l\'étagère, sa valeur, et ce qu\'il faut recommander. Les achats le remplissent, les ventes le vident — <b>tout seuls</b>.' },
        { page: '#/immos', cible: '#view table.list, #view .panel', cote: 'dessus', titre: 'Les immobilisations',
          texte: 'Ce que tu gardes plusieurs années ne se déduit pas d\'un coup : <b>il s\'amortit</b>. SkanFact tient le plan de chaque bien.' },
        // — Piloter
        { chapitre: 'Piloter', couleur: 'piloter', page: '#/stats', cible: '#view .panel', cote: 'dessus', titre: 'Les statistiques',
          texte: 'Ton chiffre d\'affaires comparé à l\'an dernier, tes meilleurs clients, ce qui se vend, et <b>qui paie en retard</b>.' },
        { page: '#/marges', cible: '#view .panel, #view table.list', cote: 'dessus', titre: 'Les marges',
          texte: '<b>Gagnes-tu de l\'argent, et où ?</b> Par affaire, par client, par prestation — et le chiffre d\'affaires qu\'il te faut pour couvrir tes frais.' },
        // — Le comptable
        { chapitre: 'Ton comptable', couleur: 'declarer', page: '#/compta', avant: onglet('#c-tabs', 'tva'), cible: '#view .panel', cote: 'dessus', titre: 'La TVA du mois',
          texte: 'La TVA collectée sur tes ventes, moins celle que tu récupères : <b>le chiffre que tu recopies sur ta déclaration</b>. Tout se déduit de tes pièces.' },
        { page: '#/compta', avant: onglet('#c-tabs', 'clotures'), cible: '#view .panel', cote: 'dessus', titre: 'Clôturer un mois',
          texte: 'Une fois le mois déclaré, tu le <b>clôtures</b> : plus aucune pièce de ce mois ne peut changer. C\'est ce qui rend tes déclarations définitives.' },
        { page: '#/compta', avant: onglet('#c-tabs', 'cabinet'), cible: '#view .panel', cote: 'dessus', titre: 'Le paquet du comptable',
          texte: 'Chaque mois, un fichier : tes journaux, tes pièces et tes justificatifs, chiffré pour ton cabinet. <b>Zéro ressaisie</b> de son côté.' },
        { page: '#/compta', avant: onglet('#c-tabs', 'cabinet'), cible: '#p-questions', cote: 'dessus', titre: 'Ses questions',
          texte: 'Quand ton comptable a une question, elle arrive ici <b>et sur la pièce qu\'elle vise</b>. Tu réponds en une phrase ; ta réponse repart dans le paquet du mois.' },
        { page: '#/compta', avant: onglet('#c-tabs', 'clotures'), cible: '#p-cloture-cabinet', cote: 'dessus', titre: 'Sa clôture',
          texte: 'En fin d\'exercice, il t\'envoie sa clôture : ses à-nouveaux officiels et tes états financiers. Ton bilan et le sien disent alors la même chose.' },
        // — Réglages
        { chapitre: 'Réglages et sécurité', couleur: 'piloter', page: '#/parametres', avant: onglet('#set-tabs', 'societe'), cible: '#view .panel', cote: 'dessus', titre: 'Ta fiche société',
          texte: 'Raison sociale, matricule fiscal, adresse, RIB, logo : <b>tout ce qui s\'imprime</b> en haut de tes documents.' },
        { page: '#/parametres', avant: onglet('#set-tabs', 'donnees'), cible: ['#ext-choose', '#view .panel'], cote: 'dessous', titre: 'Tes données à l\'abri',
          texte: 'SkanFact sauvegarde chaque jour. Mais la <b>copie automatique</b> vers une clé USB, iCloud ou OneDrive est l\'étape que tout le monde saute — et la seule dont l\'absence coûte tout.' },
        { page: '#/parametres', avant: onglet('#set-tabs', 'app'), cible: '#p-maj', cote: 'dessus', titre: 'Les mises à jour',
          texte: 'SkanFact se met à jour tout seul, en arrière-plan, et <b>n\'installe rien sans ton accord</b> : une fenêtre te propose de redémarrer quand une version est prête. Tes données ne bougent pas.' },
        { chapitre: 'Pour la suite', couleur: 'commencer', page: '#/dashboard', cible: '.sidebar-foot a[data-route="guide"]', cote: 'droite', titre: 'Me guider, toujours là',
          texte: 'Chaque page a sa visite, <b>bouton par bouton</b>, et chaque geste se fait guidé, clic par clic — les gestes du métier comme les gestes techniques : répondre à ton comptable, retrouver un fichier, installer une mise à jour, revenir à une sauvegarde.' },
        { page: '#/dashboard', cible: '.sidebar-foot a[data-route="aide"]', cote: 'droite', titre: 'L\'Aide',
          texte: 'Pour comprendre plus en détail : la facturation, la TVA, la routine du mois. Sur chaque page, <b>« Comprendre cette page »</b> ouvre le bon article, et chaque petit <b>i</b> explique le mot à côté.' }
      ]
    });

    // ======================================================================= LES PREMIERS GESTES
    // Pour de vrai, dans SA propre entreprise, guidé clic par clic.
    visite({
      // `reel` : cette visite se fait dans SA vraie entreprise — lancée depuis l'exemple, elle en sort
      // d'abord (l'hôte le propose), sinon sa première bulle mentirait.
      id: 'premiers-pas', theme: 'demarrer', type: 'faire', reel: true, duree: '3 min', page: '#/dashboard',
      titre: 'Démarrer dans ma vraie entreprise',
      resume: 'Tes premiers pas, dans l\'ordre : ta fiche, ton premier client, ton premier devis, ta copie de sécurité.',
      mots: ['premiers pas', 'demarrer', 'commencer', 'reel', 'vraie entreprise'],
      suite: ['societe', 'premier-client', 'premier-devis'],
      bravo: 'Te voilà prêt',
      conclusion: 'Chaque étape de « Tes premiers pas » a son bouton, et sa visite guidée dans « Me guider ». Commence par ta fiche société : c\'est elle qui s\'imprime sur tout.',
      etapes: [
        { page: '#/dashboard', titre: 'Ta vraie entreprise', texte: '<p>Ici, c\'est <b>ta</b> entreprise : tout ce que tu fais compte, et s\'imprime à ton nom.</p><p>Je te montre l\'ordre des choses. Pour chaque étape, une visite te guidera <b>clic par clic</b>.</p>' },
        { page: '#/dashboard', cible: '.premiers-pas', cote: 'gauche', titre: 'Tes premiers pas',
          texte: 'L\'ordre à suivre : ta fiche société, ton premier client, ton catalogue, ton premier devis — puis ta copie de sécurité, l\'envoi et la facture. <b>Chaque étape se coche toute seule</b> quand c\'est fait ; celles marquées « facultatif » t\'attendent sans te presser.' },
        { page: '#/dashboard', cible: '.premiers-pas .encours .pp-go', cote: 'gauche', titre: 'Le bouton de chaque étape', facultatif: true,
          texte: 'Il t\'emmène au bon endroit. <b>« Me guider »</b>, juste à côté, t\'y emmène en te montrant où cliquer, clic par clic.' },
        { page: '#/dashboard', cible: '.sidebar-foot a[data-route="guide"]', cote: 'droite', titre: 'Me guider',
          texte: 'Toutes les visites guidées : « Compléter ma fiche société », « Ajouter un client », « Faire un devis »… Chacune t\'accompagne jusqu\'au bout.' }
      ]
    });

    // `reel` (10.14.0) : cette visite fait TAPER ta raison sociale, ton matricule, ton adresse. Lancée
    // depuis l'exemple, elle les écrivait dans la fiche de la société fictive — et tout repartait avec
    // elle en quittant l'exemple. Toute visite qui fait écrire dans les Paramètres (ta fiche, ta copie
    // de sécurité, ton mot de passe, ton comptable) sort d'abord de l'exemple ; un test le tient.
    visite({
      id: 'societe', theme: 'demarrer', type: 'faire', reel: true, duree: '2 min', page: '#/parametres',
      titre: 'Compléter ma fiche société',
      resume: 'Raison sociale, matricule fiscal, adresse, RIB : ce qui s\'imprime sur chaque document.',
      mots: ['societe', 'entreprise', 'matricule', 'rib', 'adresse', 'fiche', 'logo'],
      suite: ['premier-client', 'sauvegarde'],
      bravo: 'Ta fiche est à jour',
      conclusion: 'Tout ce que tu viens de saisir s\'imprime en haut de tes devis et factures. Tu peux le changer à tout moment.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'societe'), cible: '#view input[name="name"]', cote: 'droite', faire: 'valeur', bouton: 'Suivant',
          titre: 'La raison sociale', texte: 'Le nom officiel, avec la forme juridique (SUARL, SARL…) : c\'est lui qui engage.', action: 'Vérifie ou tape ta raison sociale.', essai: { taper: 'Atelier Test SUARL' } },
        { page: '#/parametres', cible: '#view input[name="matricule"]', cote: 'droite', faire: 'valeur', bouton: 'Suivant',
          titre: 'Le matricule fiscal', texte: 'Obligatoire sur toute facture. En Tunisie : <b>1234567X/A/M/000</b>.', action: 'Tape ton matricule fiscal.', essai: { taper: '1234567A/A/M/000' } },
        { page: '#/parametres', cible: ['#view textarea[name="address"]', '#view [name="address"]'], cote: 'droite', faire: 'valeur', bouton: 'Suivant',
          titre: 'L\'adresse', texte: 'Celle du siège, sur deux lignes : elle s\'imprime telle quelle.', action: 'Tape ton adresse.', essai: { taper: '12 rue de la Liberté\n1002 Tunis' } },
        { page: '#/parametres', cible: ['#view input[name="rib"]', '#view [name="rib"]'], cote: 'droite', titre: 'Ton RIB',
          texte: 'Il s\'imprime sur tes factures pour que tes clients te paient par virement : vérifie-le deux fois. SkanFact contrôle sa clé et te prévient s\'il paraît faux.', facultatif: true },
        { page: '#/parametres', cible: ['#save-set', '.save-bar .btn-primary', '#set-save'], cote: 'dessus', faire: 'clic',
          titre: 'Enregistrer', texte: 'Une modification ne compte qu\'une fois enregistrée.', action: 'Clique sur <b>« Enregistrer »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'premier-client', theme: 'fichiers', type: 'faire', duree: '1 min', page: '#/clients',
      titre: 'Ajouter un client',
      resume: 'La fiche de celui à qui tu vends : son nom, son matricule, son adresse.',
      mots: ['client', 'ajouter', 'nouveau', 'fiche', 'creer'],
      suite: ['premier-devis', 'page-clients'],
      mesure: () => nb('clients'), but: n0 => nb('clients') > n0 && aucuneFenetre(),
      bravo: 'Ton client est enregistré',
      conclusion: 'Il est maintenant proposé dans chaque devis et chaque facture. Tu peux corriger sa fiche à tout moment depuis la liste des clients.',
      etapes: [
        { page: '#/clients', cible: ['.vide-utile .btn-primary', '.page-head #new'], cote: 'dessous', faire: 'clic',
          titre: 'Nouveau client', texte: 'On commence par la fiche de celui à qui tu vends.', action: 'Clique sur {bouton}.',
          fait: () => fenetre('client'), essai: { clic: true } },
        { cible: '#modal-root .modal input[name="name"]', cote: 'droite', faire: 'valeur',
          titre: 'Son nom', texte: 'La raison sociale telle qu\'elle doit s\'imprimer sur la facture (ou le nom et prénom d\'un particulier).',
          action: 'Tape le nom du client, puis clique sur <b>« C\'est fait »</b>.', essai: { taper: 'Boulangerie du Lac' } },
        { cible: '#modal-root .modal input[name="matricule"]', cote: 'droite', titre: 'Son matricule fiscal',
          texte: 'Pour une entreprise, il est obligatoire sur la facture. Pour un particulier, laisse vide. Tu pourras le compléter plus tard.' },
        { cible: ['#modal-root .modal textarea[name="address"]', '#modal-root .modal [name="address"]'], cote: 'droite', titre: 'Son adresse',
          texte: 'Elle s\'imprime sous son nom, sur chaque pièce.' },
        { cible: ['#modal-root .modal input[name="email"]'], cote: 'droite', titre: 'Son adresse mail',
          texte: 'C\'est là que partiront tes devis, tes factures et tes relances, d\'un clic.' },
        { cible: '#modal-root .modal .modal-actions .btn-primary', cote: 'dessus', faire: 'clic',
          titre: 'Enregistrer', texte: 'Rien d\'autre n\'est obligatoire.', action: 'Clique sur <b>« Enregistrer »</b>.',
          fait: () => aucuneFenetre() && nb('clients') > 0, essai: { clic: true } }
      ]
    });

    visite({
      id: 'premier-devis', theme: 'ventes', type: 'faire', duree: '4 min', page: '#/devis',
      titre: 'Faire un devis',
      resume: 'Du client à l\'aperçu : les lignes, les prix, la TVA, et l\'enregistrement.',
      mots: ['devis', 'proposition', 'offre', 'prix', 'premier', 'faire un devis'],
      suite: ['envoyer', 'devis-facture'],
      bravo: 'Ton devis est prêt',
      conclusion: 'Il a reçu son numéro. Il reste à l\'envoyer à ton client — puis, quand il dit oui, à le transformer en facture d\'un clic.',
      etapes: [
        { page: '#/devis', cible: ['.vide-utile .btn-primary', '.page-head #new'], cote: 'dessous', faire: 'clic',
          titre: 'Nouveau devis', texte: 'Un devis dit à ton client ce que tu vas faire, et combien ça coûte. Il n\'engage personne tant qu\'il n\'est pas accepté.',
          action: 'Clique sur {bouton}.', fait: () => /^#\/doc\/new\/devis/.test(hash()), essai: { clic: true } },
        { cible: combo('clientId'), cote: 'droite', faire: 'valeur', bouton: 'C\'est fait',
          titre: 'Choisis le client', texte: 'Clique dans la liste, tape les premières lettres de son nom, et choisis-le. S\'il n\'existe pas encore, « + Nouveau client » en bas de la liste le crée sans quitter le devis.',
          action: 'Choisis ton client dans la liste.', fait: () => !!valeur('input[name="clientId"]'), essai: { combo: 1 } },
        { cible: 'input[name="subject"]', cote: 'dessous', faire: 'valeur',
          titre: 'L\'objet', texte: 'Une ligne qui dit de quoi il s\'agit : ton client la lira en premier.',
          action: 'Écris l\'objet du devis, puis clique sur <b>« C\'est fait »</b>.', essai: { taper: 'Réfection de la vitrine' } },
        { cible: ['#cat-pick .combo-btn', '#add-line'], cote: 'dessus', titre: 'Ajouter une ligne',
          texte: '« Ajouter depuis le catalogue » reprend une prestation déjà décrite, avec son prix. « + Ligne vide » en crée une à la main. Tu peux aussi taper directement dans la désignation : SkanFact te propose ce qui ressemble dans ton catalogue.' },
        { cible: '#lines tr:first-child input[data-k="label"]', cote: 'dessous', faire: 'valeur',
          titre: 'La désignation', texte: 'Ce que tu vends, en quelques mots. « + description » sous la case ajoute une phrase plus longue.',
          action: 'Écris la désignation de la première ligne.', essai: { taper: 'Pose de vitrage' } },
        { cible: '#lines tr:first-child input[data-k="qty"]', cote: 'dessous', faire: 'valeur',
          titre: 'La quantité', texte: 'Des heures, des pièces, un forfait : l\'unité se choisit juste à côté.',
          action: 'Indique la quantité.', fait: () => Number(valeur('#lines tr:first-child input[data-k="qty"]')) > 0, essai: { taper: '2' } },
        { cible: '#lines tr:first-child input[data-k="unitPrice"]', cote: 'dessous', faire: 'valeur',
          titre: 'Le prix unitaire hors taxe', texte: 'Le prix d\'une unité, <b>hors TVA</b>. La TVA et le total se calculent tout seuls.',
          action: 'Tape le prix unitaire HT.', fait: () => Number(valeur('#lines tr:first-child input[data-k="unitPrice"]')) > 0, essai: { taper: '350' } },
        { cible: '#totals', cote: 'gauche', titre: 'Les totaux', texte: 'Hors taxe, TVA, total : tout suit ce que tu tapes, ligne par ligne. Rien à calculer.' },
        { cible: ['#pv-col', '#pv-toggle'], cote: 'gauche', titre: 'L\'aperçu', texte: 'À droite, le document tel que ton client le recevra. « Agrandir » l\'ouvre en grand pour le relire.' },
        { cible: '#save', cote: 'dessous', faire: 'clic',
          titre: 'Enregistrer', texte: 'Le devis reçoit son numéro. Tu pourras encore le modifier tant qu\'il n\'est pas accepté.',
          action: 'Clique sur <b>« Enregistrer »</b>.', fait: () => /^#\/doc\/(?!new)/.test(hash()), essai: { clic: true } }
      ]
    });

    visite({
      id: 'envoyer', theme: 'ventes', type: 'faire', duree: '1 min', page: () => ctx.premier('devisBrouillon') || ctx.premier('devis'),
      titre: 'Envoyer un devis ou une facture',
      resume: 'Le mail est prêt dans ta messagerie, avec le PDF joint : tu relis, tu envoies.',
      mots: ['envoyer', 'mail', 'email', 'pdf', 'client'],
      suite: ['devis-facture'],
      si: () => !!(ctx.premier('devisBrouillon') || ctx.premier('devis')),
      manque: { texte: 'Il te faut d\'abord un devis à envoyer.', visite: 'premier-devis' },
      bravo: 'C\'est parti',
      conclusion: 'Le devis passe à « envoyé ». Quand ton client répond, note sa réponse depuis le menu « Actions » de la liste — ou facture directement.',
      etapes: [
        { page: () => ctx.premier('devisBrouillon') || ctx.premier('devis'), cible: '#email', cote: 'dessous', faire: 'clic',
          titre: 'Envoyer par mail', texte: 'SkanFact prépare le mail dans ta messagerie, avec le PDF joint et un texte poli (que tu changes dans Paramètres → Envois).',
          action: 'Clique sur <b>« Email »</b>.', essai: { clic: true } },
        { cible: '#modal-root .modal', cote: 'gauche', titre: 'Relis avant d\'envoyer',
          texte: 'Le destinataire, l\'objet, le texte : tout se relit ici, puis s\'ouvre dans ta messagerie. Rien ne part sans toi.' }
      ]
    });

    visite({
      id: 'devis-facture', theme: 'ventes', type: 'faire', duree: '2 min', page: () => ctx.premier('devisAccepte') || ctx.premier('devis'),
      titre: 'Transformer un devis en facture',
      resume: 'Le client a dit oui : la facture se fabrique sans rien ressaisir.',
      mots: ['facturer', 'transformer', 'convertir', 'devis accepte', 'facture'],
      suite: ['emettre', 'encaisser'],
      si: () => !!(ctx.premier('devisAccepte') || ctx.premier('devis')),
      manque: { texte: 'Il te faut d\'abord un devis — accepté par ton client, de préférence.', visite: 'premier-devis' },
      bravo: 'Ta facture est prête',
      conclusion: 'Elle est en brouillon : relis-la, puis <b>« Émettre la facture »</b> lui donne son numéro définitif.',
      etapes: [
        { page: () => ctx.premier('devisAccepte') || ctx.premier('devis'), cible: ['#convert', '#bill-btn'], cote: 'dessous', faire: 'clic',
          titre: 'Facturer ce devis', texte: 'Client, lignes, prix : tout est repris. Tu peux aussi facturer un acompte d\'abord (le menu à côté).',
          action: 'Clique sur {bouton}.', fait: () => /^#\/doc\/(new|[^/]+)/.test(hash()) && !!$('#issue'), essai: { clic: true } },
        { cible: '#issue', cote: 'dessous', titre: 'Le brouillon de facture',
          texte: 'Elle n\'a pas encore de numéro : tu peux tout corriger. Quand elle est juste, <b>« Émettre la facture »</b>.' }
      ]
    });

    visite({
      id: 'emettre', theme: 'ventes', type: 'faire', duree: '1 min', page: () => ctx.premier('factureBrouillon'),
      titre: 'Émettre une facture',
      resume: 'Le numéro définitif, le verrou, et le récapitulatif avant.',
      mots: ['emettre', 'facture', 'numero', 'valider'],
      suite: ['encaisser', 'envoyer'],
      si: () => !!ctx.premier('factureBrouillon'),
      manque: { texte: 'Il te faut une facture en brouillon — transforme un devis accepté, ou crée une facture.', visite: 'devis-facture' },
      bravo: 'Ta facture est émise',
      conclusion: 'Elle a son numéro, elle compte dans ton chiffre d\'affaires et ta TVA, et elle ne se modifie plus : une erreur se corrigerait par un avoir.',
      etapes: [
        { page: () => ctx.premier('factureBrouillon'), cible: '#issue', cote: 'dessous', faire: 'clic',
          titre: 'Émettre', texte: 'Un récapitulatif s\'affiche d\'abord : à qui, quand, combien. C\'est le dernier moment pour relire.',
          action: 'Clique sur <b>« Émettre la facture »</b>.', fait: () => fenetre('mettre') || fenetre('Émettre'), essai: { clic: true } },
        { cible: '#modal-root .modal', cote: 'gauche', titre: 'Le récapitulatif',
          texte: 'Relis le client, la date, l\'échéance et le montant. Une fois émise, la facture ne se modifie plus — elle se corrigerait par un avoir.' }
      ]
    });

    visite({
      id: 'encaisser', theme: 'ventes', type: 'faire', duree: '1 min', page: () => ctx.premier('factureOuverte'),
      titre: 'Enregistrer un paiement',
      resume: 'Ton client a payé : le montant, le mode, la date — la facture suit toute seule.',
      mots: ['paiement', 'encaisser', 'regle', 'payee', 'virement', 'cheque'],
      suite: ['relancer', 'page-tresorerie'],
      si: () => !!ctx.premier('factureOuverte'),
      manque: { texte: 'Aucune facture n\'attend de paiement — émets d\'abord une facture.', visite: 'emettre' },
      bravo: 'Le paiement est noté',
      conclusion: 'La facture est passée à « payée » (ou « partielle »), et l\'argent est arrivé dans ta trésorerie — tout seul.',
      etapes: [
        { page: () => ctx.premier('factureOuverte'), cible: ['#pay', '#pay2'], cote: 'dessous', faire: 'clic',
          titre: 'Enregistrer un paiement', texte: 'Le reste à payer est proposé : tu n\'as souvent qu\'à valider.',
          action: 'Clique sur {bouton}.', fait: () => fenetre('aiement'), essai: { clic: true } },
        { cible: '#modal-root .modal input[name="amount"]', cote: 'droite', titre: 'Le montant', texte: 'Déjà rempli avec ce qui reste dû. Un paiement partiel ? Change-le.' },
        { cible: ['#modal-root .modal select[name="method"]', '#modal-root .modal [name="method"]'], cote: 'droite', titre: 'Le mode', texte: 'Virement, chèque, espèces… Il dit sur quel compte l\'argent arrive.', facultatif: true },
        { cible: '#modal-root .modal .modal-actions .btn-primary', cote: 'dessus', faire: 'clic',
          titre: 'Enregistrer', texte: 'La facture change de statut toute seule.', action: 'Clique sur <b>« Enregistrer »</b>.', fait: () => aucuneFenetre(), essai: { clic: true } }
      ]
    });

    visite({
      id: 'relancer', theme: 'ventes', type: 'faire', duree: '1 min', page: '#/relances',
      titre: 'Relancer un client',
      resume: 'Une facture en retard : le mail au bon ton, prêt à partir.',
      mots: ['relance', 'retard', 'impaye', 'rappel'],
      suite: ['encaisser'],
      bravo: 'Relance préparée',
      conclusion: 'La relance est notée sur la facture : la prochaine passera au niveau suivant, avec un ton un peu plus ferme.',
      etapes: [
        { page: '#/relances', titre: 'Les relances', texte: 'Les factures en retard, classées par ancienneté. À chaque niveau son ton — rappel, relance, dernière relance.' },
        { page: '#/relances', cible: '#view [data-rowmenu]', cote: 'gauche', faire: 'clic', facultatif: true,
          titre: 'Le menu de la ligne', texte: '« Relancer par email » prépare le mail au bon ton ; « Noter un appel » garde la trace d\'un coup de fil.',
          action: 'Clique sur <b>« Actions »</b> au bout d\'une ligne.', fait: () => !!$('.row-menu'), essai: { clic: true } },
        { cible: '.row-menu', cote: 'gauche', titre: 'Choisis', texte: 'Chaque geste a sa phrase. « Ne pas relancer avant… » met une facture en pause si le client a promis de payer.' }
      ]
    });

    visite({
      id: 'avoir', theme: 'ventes', type: 'faire', duree: '1 min', page: () => ctx.premier('factureEmise'),
      titre: 'Corriger une facture par un avoir',
      resume: 'Une facture émise ne se modifie pas : un avoir la corrige.',
      mots: ['avoir', 'corriger', 'annuler', 'erreur', 'remise', 'retour'],
      si: () => !!ctx.premier('factureEmise'),
      manque: { texte: 'Il te faut une facture émise — c\'est elle que l\'avoir corrige.', visite: 'emettre' },
      bravo: 'L\'avoir est prêt',
      conclusion: 'Émets-le comme une facture : il retire ce qu\'il faut de ton chiffre d\'affaires et de ta TVA.',
      etapes: [
        { page: () => ctx.premier('factureEmise'), cible: ['#lock-credit', '#credit'], cote: 'dessous', faire: 'clic',
          titre: 'Corriger par un avoir', texte: 'L\'avoir reprend les lignes de la facture : tu gardes ce qu\'il faut annuler (tout, ou une partie).',
          action: 'Clique sur {bouton}.', essai: { clic: true } },
        { cible: '#modal-root .modal, #issue', cote: 'gauche', titre: 'L\'avoir', texte: 'Ajuste les lignes et le motif, puis émets-le.' }
      ]
    });

    visite({
      id: 'article', theme: 'fichiers', type: 'faire', duree: '1 min', page: '#/catalogue',
      titre: 'Ajouter une prestation au catalogue',
      resume: 'Décrite une fois avec son prix : chaque devis la reprend d\'un clic.',
      mots: ['catalogue', 'prestation', 'article', 'prix', 'produit', 'service'],
      suite: ['premier-devis'],
      mesure: () => nb('catalog'), but: n0 => nb('catalog') > n0 && aucuneFenetre(),
      bravo: 'Ta prestation est au catalogue',
      conclusion: 'Elle est proposée dans chaque devis : « Ajouter depuis le catalogue », ou tape son nom dans une désignation.',
      etapes: [
        { page: '#/catalogue', avant: onglet('#cat-tabs', 'presta'), cible: ['.vide-utile .btn-primary', '.page-head #new'], cote: 'dessous', faire: 'clic',
          titre: 'Nouvelle prestation', texte: 'Ce que tu vends, avec son prix.', action: 'Clique sur {bouton}.', fait: () => !!$('#modal-root .modal'), essai: { clic: true } },
        { cible: '#modal-root .modal input[name="label"], #modal-root .modal input[name="name"]', cote: 'droite', faire: 'valeur',
          titre: 'Son nom', texte: 'Tel qu\'il s\'imprimera sur la ligne du devis.', action: 'Tape le nom de la prestation.', essai: { taper: 'Heure de main-d\'œuvre' } },
        { cible: '#modal-root .modal input[name="unitPrice"]', cote: 'droite', faire: 'valeur',
          titre: 'Son prix hors taxe', texte: 'Le prix d\'une unité, hors TVA.', action: 'Tape le prix.', essai: { taper: '45' } },
        { cible: '#modal-root .modal .modal-actions .btn-primary', cote: 'dessus', faire: 'clic',
          titre: 'Enregistrer', texte: '', action: 'Clique sur <b>« Enregistrer »</b>.', fait: () => aucuneFenetre(), essai: { clic: true } }
      ]
    });

    visite({
      id: 'fournisseur', theme: 'achats', type: 'faire', duree: '1 min', page: '#/fournisseurs',
      titre: 'Ajouter un fournisseur',
      resume: 'Celui qui te facture : son nom, son matricule, ses conditions.',
      mots: ['fournisseur', 'ajouter', 'nouveau'],
      suite: ['achat'],
      mesure: () => nb('suppliers'), but: n0 => nb('suppliers') > n0 && aucuneFenetre(),
      bravo: 'Ton fournisseur est enregistré',
      conclusion: 'Il est proposé dans chaque facture d\'achat.',
      etapes: [
        { page: '#/fournisseurs', cible: ['.vide-utile .btn-primary', '.page-head #new'], cote: 'dessous', faire: 'clic',
          titre: 'Nouveau fournisseur', texte: '', action: 'Clique sur {bouton}.', fait: () => !!$('#modal-root .modal'), essai: { clic: true } },
        { cible: '#modal-root .modal input[name="name"]', cote: 'droite', faire: 'valeur',
          titre: 'Son nom', texte: 'Tel qu\'il apparaît sur ses factures.', action: 'Tape le nom du fournisseur.', essai: { taper: 'Quincaillerie du Centre' } },
        { cible: '#modal-root .modal .modal-actions .btn-primary', cote: 'dessus', faire: 'clic',
          titre: 'Enregistrer', texte: 'Le reste (matricule, conditions) peut attendre.', action: 'Clique sur <b>« Enregistrer »</b>.', fait: () => aucuneFenetre(), essai: { clic: true } }
      ]
    });

    visite({
      id: 'achat', theme: 'achats', type: 'faire', duree: '3 min', page: '#/achats',
      titre: 'Saisir une facture d\'achat',
      resume: 'Le justificatif d\'abord, puis le fournisseur, les lignes, la TVA récupérable.',
      mots: ['achat', 'facture fournisseur', 'depense', 'tva deductible', 'justificatif'],
      suite: ['regler'],
      bravo: 'Ton achat est enregistré',
      conclusion: 'Sa TVA compte dans ce que tu récupères ce mois-ci, et ce que tu dois au fournisseur est suivi dans « À payer ».',
      etapes: [
        { page: '#/achats', cible: ['.vide-utile .btn-primary', '.page-head #new'], cote: 'dessous', faire: 'clic',
          titre: 'Nouvelle facture d\'achat', texte: 'Pour une dépense du quotidien (carburant, fournitures), « + Dépense » est plus court.',
          action: 'Clique sur {bouton}.', fait: () => /^#\/achat\//.test(hash()), essai: { clic: true } },
        { cible: '#attach-top', cote: 'dessous', titre: 'Le justificatif d\'abord',
          texte: 'Joins la photo ou le PDF de la facture <b>avant</b> de saisir : tu recopies en la regardant, et ton comptable l\'aura.' },
        { cible: combo('supplierId'), cote: 'droite', faire: 'valeur', bouton: 'C\'est fait',
          titre: 'Le fournisseur', texte: 'Choisis-le dans la liste. Nouveau ? « + Nouveau fournisseur » en bas de la liste.',
          action: 'Choisis le fournisseur.', fait: () => !!valeur('input[name="supplierId"]'), essai: { combo: 1 } },
        { cible: 'input[name="number"]', cote: 'dessous', titre: 'Son numéro', texte: 'Le numéro imprimé sur SA facture : il sert à la retrouver, et à éviter de la saisir deux fois.', facultatif: true },
        { cible: '#b-lines tr:first-child, #view table', cote: 'dessus', titre: 'Les lignes',
          texte: 'Ce que tu as acheté, et <b>où ça va</b> : une charge, du stock ou une immobilisation. La TVA de chaque ligne est récupérable, sauf si tu décoches.' },
        { cible: '#save', cote: 'dessous', faire: 'clic', titre: 'Enregistrer', texte: 'Tant qu\'elle n\'est pas enregistrée, elle ne compte nulle part.',
          action: 'Clique sur <b>« Enregistrer »</b>.', fait: () => /^#\/achat\/(?!new)/.test(hash()), essai: { clic: true } }
      ]
    });

    visite({
      id: 'regler', theme: 'achats', type: 'faire', duree: '1 min', page: '#/achats',
      titre: 'Régler un fournisseur',
      resume: 'Tu as payé : le montant, le mode, la date.',
      mots: ['regler', 'payer', 'fournisseur', 'reglement'],
      bravo: 'Le règlement est noté',
      conclusion: 'Ce que tu dois se met à jour, et l\'argent sort de ta trésorerie.',
      etapes: [
        { page: '#/achats', cible: ['[data-payx]', '#pay-h'], cote: 'gauche', faire: 'clic', facultatif: true,
          titre: 'Ce que tu dois', texte: 'Le panneau « À payer » liste ce qui reste dû, échéance par échéance. « Régler » note ton paiement.',
          action: 'Clique sur <b>« Régler »</b> sur une ligne.', fait: () => !!$('#modal-root .modal'), essai: { clic: true } },
        { cible: '#modal-root .modal', cote: 'gauche', titre: 'Le règlement', texte: 'Le reste dû est proposé ; change le montant pour un règlement partiel, puis enregistre.' }
      ]
    });

    visite({
      id: 'justificatif', theme: 'achats', type: 'faire', duree: '1 min', page: () => ctx.premier('achatSansJustif'),
      titre: 'Joindre un justificatif, et le retrouver',
      resume: 'La photo ou le PDF d\'une facture d\'achat : sans lui, ni la charge ni la TVA ne se récupèrent.',
      mots: ['justificatif', 'piece jointe', 'photo', 'scan', 'pdf', 'fichier', 'joindre', 'trombone', 'retrouver'],
      si: () => !!ctx.premier('achatSansJustif'),
      manque: { texte: 'Il te faut d\'abord une facture d\'achat.', visite: 'achat' },
      suite: ['fichiers', 'repondre-comptable'],
      bravo: 'Tu sais joindre un justificatif',
      conclusion: 'Il part dans le paquet du mois avec son achat, et ta copie de sécurité l\'emporte. Les sauvegardes quotidiennes, elles, ne gardent que tes données — pas les fichiers joints.',
      etapes: [
        { page: () => ctx.premier('achatSansJustif'), cible: '#attach-top', cote: 'dessous', faire: 'clic',
          titre: 'Joindre le justificatif', texte: 'La photo ou le PDF de la facture du fournisseur. Sans lui, ni la charge ni la TVA ne se récupèrent — et c\'est la première chose que ton comptable réclame.',
          action: 'Clique sur {bouton}, puis choisis le fichier.', fait: () => !!$('#attachments [data-open]'), essai: { clic: true } },
        { si: () => !!$('#attachments [data-open]'), cible: '.panel:has(> #attachments)', cote: 'dessus', titre: 'Où il est rangé',
          texte: 'SkanFact en garde une <b>copie</b> à côté de tes données : ton original ne bouge pas. Le nom ouvre le fichier, <b>« Dossier »</b> le montre sur ton ordinateur, ✕ retire la copie.' },
        { page: '#/achats', cible: '#list-wrap table.list', cote: 'dessus', titre: 'Le trombone',
          texte: 'Dans la liste des achats, 📎 marque ceux qui ont leur justificatif. Ceux qui n\'en ont pas sont ceux que ton comptable te réclamera.' }
      ]
    });

    visite({
      id: 'sauvegarde', theme: 'reglages', type: 'faire', reel: true, duree: '1 min', page: '#/parametres',
      titre: 'Mettre mes données à l\'abri',
      resume: 'Une copie automatique vers une clé USB, iCloud ou OneDrive.',
      mots: ['sauvegarde', 'copie', 'usb', 'icloud', 'onedrive', 'securite', 'perte'],
      suite: ['motdepasse'],
      bravo: 'Tes données sont à l\'abri',
      conclusion: 'À chaque enregistrement, SkanFact recopie tes données dans ce dossier. Si ton ordinateur tombe en panne, tout est là.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'donnees'), cible: '#ext-choose', cote: 'dessous', faire: 'clic',
          titre: 'Choisir un dossier', texte: 'SkanFact sauvegarde chaque jour sur cet ordinateur. Mais si l\'ordinateur tombe en panne ? Une copie ailleurs — clé USB, iCloud, OneDrive — c\'est la seule protection contre ça.',
          action: 'Clique sur <b>« Choisir un dossier… »</b>.', fait: () => { const r = $('#ext-remove'); return !!(r && !r.hidden); }, essai: { clic: true } },
        { page: '#/parametres', cible: '#view .panel', titre: 'C\'est tout', texte: 'Dès maintenant, chaque enregistrement est recopié là. Rien d\'autre à faire.' }
      ]
    });

    visite({
      id: 'motdepasse', theme: 'reglages', type: 'faire', reel: true, duree: '1 min', page: '#/parametres',
      titre: 'Protéger mes données par un mot de passe',
      resume: 'Sans lui, personne ne peut ouvrir tes données — pas même depuis une copie.',
      mots: ['mot de passe', 'securite', 'chiffrer', 'proteger', 'verrouiller'],
      bravo: 'Tes données sont protégées',
      conclusion: 'Retiens-le bien : sans lui, tes données ne s\'ouvrent plus, et personne ne peut le retrouver.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'donnees'), cible: ['#sec-set', '#sec-change'], cote: 'dessous', faire: 'clic',
          titre: 'Activer un mot de passe', texte: 'Tes données et tes sauvegardes sont chiffrées : sans le mot de passe, personne ne peut les lire.',
          action: 'Clique sur {bouton}.', essai: { clic: true } },
        { cible: '#modal-root .modal', cote: 'gauche', titre: 'Choisis-le bien', texte: 'Il n\'y a <b>aucun moyen</b> de le retrouver si tu l\'oublies : note-le dans un endroit sûr.' }
      ]
    });

    visite({
      id: 'restaurer', theme: 'reglages', type: 'faire', duree: '1 min', page: '#/parametres',
      titre: 'Revenir à une sauvegarde',
      resume: 'Une erreur, une pièce effacée : tes données d\'un jour précédent reviennent — et le retour se défait.',
      mots: ['restaurer', 'sauvegarde', 'revenir', 'perdu', 'erreur', 'efface', 'recuperer', 'backup', 'ordinateur'],
      suite: ['sauvegarde', 'fichiers'],
      bravo: 'Tu sais revenir en arrière',
      conclusion: 'Rien ne se perd en silence : chaque remplacement — import, exemple, effacement, restauration — prend d\'abord une sauvegarde de ce qu\'il remplace.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'donnees'), cible: '#p-sauvegardes', cote: 'dessus', titre: 'Tes sauvegardes',
          texte: 'Chaque jour, avant la première modification, SkanFact garde l\'état de tes données — trente jours durant. Une copie est prise aussi avant un import, avant l\'exemple et avant un effacement.' },
        { page: '#/parametres', cible: ['#backup-list [data-restore]', '#backup-list'], cote: 'gauche', facultatif: true, titre: 'Revenir en arrière',
          texte: '<b>« Restaurer… »</b> te dit d\'abord ce que la sauvegarde contient, et ce que tu as aujourd\'hui. Ton état actuel est mis de côté juste avant : le retour se défait.' },
        { page: '#/parametres', cible: '#backup-now', cote: 'dessous', titre: 'Sauvegarder maintenant',
          texte: 'Avant un geste important, prends-en une toi-même : elle arrive en tête de la liste.' },
        { page: '#/parametres', cible: '#export-data', cote: 'dessous', facultatif: true, titre: 'Changer d\'ordinateur',
          texte: '<b>« Exporter les données… »</b> fait un seul fichier de tout ; sur le nouvel ordinateur, <b>« Importer… »</b> le reprend — avec les fichiers joints, s\'ils sont dans ta copie de sécurité.' }
      ]
    });

    visite({
      id: 'partager', theme: 'reglages', type: 'faire', duree: '2 min', page: '#/parametres',
      titre: 'Travailler à deux, ou gérer plusieurs entreprises',
      resume: 'Une entreprise par dossier ; un dossier partagé pour travailler à deux, chacun sur son ordinateur.',
      mots: ['partager', 'deux', 'plusieurs', 'entreprise', 'dossier', 'poste', 'ordinateur', 'rejoindre', 'associe', 'famille'],
      suite: ['sauvegarde', 'restaurer'],
      bravo: 'Tu sais partager',
      conclusion: 'Deux postes travaillent sur le même dossier à tour de rôle : SkanFact fusionne, et te dit ce qu\'il a fait. Une seule règle : une seule personne émet les factures, pour que deux numéros ne se croisent jamais.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'donnees'), cible: '#p-dossiers', cote: 'dessus', titre: 'Tes entreprises',
          texte: 'Chaque dossier est une entreprise, avec ses propres données : elles ne se mélangent jamais. Tu passes de l\'une à l\'autre depuis son nom, en haut du menu.' },
        { page: '#/parametres', cible: '#dos-share', cote: 'dessous', titre: 'Partager ce dossier',
          texte: 'Il pose ton entreprise, avec tout ce qu\'elle contient, dans un dossier commun — OneDrive, iCloud Drive, une clé ou un disque réseau. Ton dossier d\'origine reste intact : SkanFact ne bascule sur la copie qu\'une fois celle-ci complète.' },
        { page: '#/parametres', cible: '#dos-join', cote: 'dessous', titre: 'Sur le deuxième ordinateur',
          texte: '<b>« Rejoindre un dossier déjà partagé »</b> ouvre ce que le premier y a posé — sans assistant, sans rien retaper.' },
        { page: '#/parametres', cible: '#dev-name', cote: 'droite', facultatif: true, titre: 'Le nom de cet ordinateur',
          texte: 'Il dit qui a enregistré en dernier quand vous êtes deux.' }
      ]
    });

    visite({
      id: 'envois', theme: 'reglages', type: 'faire', duree: '1 min', page: '#/parametres',
      titre: 'Régler l\'envoi de mes mails',
      resume: 'Ta messagerie, tes modèles de messages, l\'adresse de ton comptable.',
      mots: ['mail', 'email', 'messagerie', 'modele', 'envoi', 'message', 'outlook', 'gmail'],
      suite: ['relier-comptable', 'envoyer'],
      bravo: 'Tes envois sont réglés',
      conclusion: 'Chaque envoi se prépare dans ta messagerie, pièce jointe comprise : tu relis, et tu envoies. Rien ne part sans toi.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'envois'), cible: '#p-envoi', cote: 'dessus', titre: 'Comment partent tes mails',
          texte: 'SkanFact prépare le message dans ta messagerie, avec le PDF : tu relis, et tu envoies. Rien ne part sans toi.' },
        { page: '#/parametres', cible: '#p-modeles', cote: 'dessus', titre: 'Tes modèles de messages',
          texte: 'L\'objet et le texte proposés pour chaque envoi — devis, facture, relances. <b>{numero}</b>, <b>{client}</b>, <b>{montant}</b>… se remplacent tout seuls.' },
        { page: '#/parametres', cible: '#p-comptable', cote: 'dessus', titre: 'L\'adresse de ton comptable',
          texte: '« Envoyer au comptable » s\'en sert pour tes journaux et pour le paquet du mois.' }
      ]
    });

    visite({
      id: 'cloturer', theme: 'compta', type: 'faire', duree: '1 min', page: '#/compta',
      titre: 'Clôturer un mois',
      resume: 'Une fois déclaré, le mois se fige : plus rien ne change en silence.',
      mots: ['cloturer', 'cloture', 'mois', 'figer', 'declaration'],
      suite: ['paquet'],
      bravo: 'Le mois est clôturé',
      conclusion: 'Plus aucune pièce datée de ce mois ne peut changer. Il reste à envoyer son paquet à ton comptable.',
      etapes: [
        { page: '#/compta', avant: onglet('#c-tabs', 'clotures'), cible: '#view .panel', cote: 'dessus', titre: 'Les contrôles',
          texte: 'Avant de clôturer, SkanFact vérifie : brouillons oubliés, achats sans justificatif, relevé non pointé. Il <b>nomme sans bloquer</b> — c\'est toi qui décides.' },
        { page: '#/compta', cible: '#do-close', cote: 'dessous', faire: 'clic', facultatif: true,
          titre: 'Clôturer', texte: 'Le bouton nomme le mois.', action: 'Clique sur {bouton}.', essai: { clic: true } },
        { cible: '#modal-root .modal', cote: 'gauche', titre: 'Confirme', texte: 'Une période se rouvre, mais avec un motif : c\'est la trace qui expliquera pourquoi un chiffre a changé.' }
      ]
    });

    // Les questions du comptable restées sans réponse : ce qu'elles attendent passe avant le paquet.
    const questionsOuvertes = () => (data().questionsCabinet || []).filter(q => !(q.reponse && String(q.reponse.texte || '').trim()));
    const cabinetRelie = () => { const c = (data().company || {}).cabinet; return !!(c && c.publicKey); };
    visite({
      id: 'paquet', theme: 'compta', type: 'faire', duree: '3 min', page: '#/compta',
      titre: 'Envoyer le mois à mon comptable',
      resume: 'Un fichier : journaux, pièces et justificatifs — zéro ressaisie de son côté.',
      mots: ['paquet', 'comptable', 'cabinet', 'envoyer', 'mois', 'skanpack', 'fichier'],
      suite: ['repondre-comptable', 'relier-comptable'],
      bravo: 'Le paquet est prêt',
      conclusion: 'Ton comptable reçoit tout, déjà écrit. Ses questions reviendront sur la bonne pièce — « Répondre aux questions de mon comptable » te montre comment y répondre.',
      etapes: [
        { page: '#/compta', avant: onglet('#c-tabs', 'cabinet'), cible: '#cab-month', cote: 'dessous', titre: 'Le mois', texte: 'Choisis le mois à envoyer. Un mois clôturé part « définitif » : ton comptable sait que rien ne bougera.', facultatif: true },
        { page: '#/compta', cible: '#view .panel', cote: 'dessus', titre: 'Ce qui partira', texte: 'La liste exacte de ce que contient le paquet — pièces en PDF, journaux, justificatifs, bulletins — <b>avant</b> de le fabriquer.' },
        { page: '#/compta', cible: '#p-manques', cote: 'dessus', facultatif: true, titre: 'Ce qui manque',
          texte: 'Un justificatif absent, une pièce restée en brouillon : chaque manque a son bouton. Tu peux envoyer quand même — la page de garde le dira à ton comptable, c\'est mieux qu\'un dossier qu\'il croit complet.' },
        { page: '#/compta', si: () => questionsOuvertes().length > 0, cible: '#p-questions', cote: 'dessus', facultatif: true, titre: 'Ses questions d\'abord',
          texte: 'Réponds avant de fabriquer : tes réponses partent <b>dans ce paquet</b>.' },
        { page: '#/compta', cible: ['#cab-build'], cote: 'dessous', faire: 'clic', facultatif: true,
          avant: () => { paquetsAvant = nb('packs'); },
          titre: 'Fabriquer le paquet', texte: 'Un seul fichier, chiffré pour ton cabinet s\'il est relié — sinon protégé par un mot de passe, si tu en choisis un.', action: 'Clique sur {bouton}.',
          fait: () => nb('packs') > paquetsAvant, essai: { clic: true } },
        { page: '#/compta', cible: '#cab-mail', cote: 'dessous', facultatif: true, titre: 'L\'envoyer',
          texte: 'Ta messagerie s\'ouvre avec le paquet déjà joint et le message écrit : tu relis, et tu envoies.' },
        { page: '#/compta', cible: ['#p-paquets [data-reveal]', '#p-paquets'], cote: 'dessus', facultatif: true, titre: 'Où est le fichier',
          texte: 'Chaque paquet fabriqué reste listé ici. <b>« Montrer le fichier »</b> le retrouve dans son dossier — même six mois après, quand ton comptable te le redemande.' }
      ]
    });

    // ======================================================================= LE LIEN AVEC LE COMPTABLE
    // Skander : « as-tu couvert les parties techniques, genre répondre à son comptable, faire le
    // paquet, trouver un fichier joint, faire la mise à jour ? » Ce sont les gestes qu'on fait
    // rarement — donc ceux qu'on ne sait jamais refaire, et ceux pour lesquels on appelle.
    visite({
      id: 'relier-comptable', theme: 'compta', type: 'faire', reel: true, duree: '2 min', page: '#/parametres',
      titre: 'Relier mon comptable',
      resume: 'Son adresse, et s\'il utilise SkanFact Cabinet, son fichier d\'appairage : tes paquets partent chiffrés pour lui seul.',
      mots: ['comptable', 'cabinet', 'appairage', 'relier', 'skanpair', 'empreinte', 'adresse'],
      suite: ['paquet', 'repondre-comptable'],
      bravo: 'Ton comptable est relié',
      conclusion: 'Chaque mois, Comptabilité → Cabinet → « Fabriquer le paquet » lui prépare son envoi — la visite « Envoyer le mois à mon comptable » te le montre. Ses questions et sa clôture te reviendront, signées.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'envois'), cible: '#view input[name="accountantEmail"]', cote: 'droite', faire: 'valeur', bouton: 'Suivant',
          titre: 'Son adresse', texte: 'C\'est là que partiront tes journaux et le paquet du mois.', action: 'Tape l\'adresse de ton comptable.', essai: { taper: 'comptable@cabinet-exemple.tn' } },
        { page: '#/parametres', cible: '.save-bar .btn-primary', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Enregistrer', texte: 'Une modification ne compte qu\'une fois enregistrée.', action: 'Clique sur <b>« Enregistrer »</b>.', essai: { clic: true } },
        { page: '#/parametres', cible: '#p-cabinet', cote: 'dessus', titre: 'S\'il utilise SkanFact Cabinet',
          texte: 'SkanFact Cabinet est l\'application de ton comptable, gratuite pour les dossiers de ses clients sur SkanFact. Demande-lui son <b>fichier d\'appairage</b> : il l\'exporte depuis son application.' },
        { page: '#/parametres', si: () => !cabinetRelie(), cible: '#cab-import', cote: 'dessous', faire: 'clic', facultatif: true,
          titre: 'Importer son fichier', texte: 'Rien de secret dedans : c\'est sa clé publique. Tes paquets seront chiffrés pour lui seul, sans mot de passe à échanger.',
          action: 'Clique sur {bouton} et choisis le fichier qu\'il t\'a envoyé.', fait: cabinetRelie, essai: { clic: true } },
        { page: '#/parametres', si: cabinetRelie, cible: '#p-cabinet', cote: 'dessus',
          titre: 'Vérifie l\'empreinte de vive voix', texte: 'Lis-lui ses vingt caractères au téléphone : s\'il lit les mêmes, c\'est bien sa clé, et pas celle de quelqu\'un d\'autre.' }
      ]
    });

    visite({
      id: 'repondre-comptable', theme: 'compta', type: 'faire', duree: '2 min', page: '#/compta',
      titre: 'Répondre aux questions de mon comptable',
      resume: 'Sa question arrive sur la pièce qu\'elle vise ; ta réponse repart dans le paquet du mois.',
      mots: ['question', 'repondre', 'reponse', 'comptable', 'cabinet', 'skanask', 'demande'],
      suite: ['paquet', 'justificatif'],
      bravo: 'Tu sais lui répondre',
      conclusion: 'Ta réponse part dans le paquet du mois, dès que tu le fabriques — ou que tu le refais s\'il était déjà fait. Il n\'y a rien d\'autre à envoyer.',
      etapes: [
        { page: '#/compta', avant: onglet('#c-tabs', 'cabinet'), cible: '#p-questions', cote: 'dessus', titre: 'Ses questions',
          texte: 'Ton comptable t\'envoie un fichier <b>.skanask</b> : « Importer les questions de ton comptable » le lit. Chaque question vise une pièce, et dit ce qu\'il attend — une pièce, une explication ou une confirmation.' },
        { page: () => ctx.premier('pieceQuestion'), si: () => !!ctx.premier('pieceQuestion'), cible: '#q-piece', cote: 'dessous',
          titre: 'Sur la pièce elle-même', texte: 'La question s\'affiche aussi en haut de la pièce qu\'elle vise : tu la vois en travaillant, et tu réponds sans chercher.' },
        { si: () => !!$('#q-piece'), cible: '#q-piece [data-qrep]', cote: 'dessous', faire: 'clic',
          titre: 'Répondre', texte: 'Une phrase suffit : c\'est ce qu\'il lira.', action: 'Clique sur {bouton}.', fait: () => fenetre('Répondre'), essai: { clic: true } },
        { si: () => fenetre('Répondre'), cible: '#modal-root .modal textarea[name="texte"]', cote: 'droite', faire: 'valeur',
          titre: 'Ta réponse', texte: 'S\'il attend une pièce, joins-la sur la pièce elle-même : elle part déjà dans le paquet.', action: 'Tape ta réponse.', essai: { taper: 'Oui : elle reste au bureau plusieurs années.' } },
        { si: () => fenetre('Répondre'), cible: '#modal-root .modal #ok', cote: 'dessus', faire: 'clic',
          titre: 'Enregistrer ta réponse', texte: 'Tu pourras la reprendre : « Corriger ma réponse », dans la liste de ses questions.', action: 'Clique sur <b>« Enregistrer ma réponse »</b>.', fait: () => aucuneFenetre(), essai: { clic: true } },
        { page: '#/compta', avant: onglet('#c-tabs', 'cabinet'), cible: ['#cab-build', '#p-envoyer'], cote: 'dessous', titre: 'Elle part dans le paquet',
          texte: 'Ta réponse part dans le <b>paquet du mois</b>, dès que tu le fabriques. S\'il était déjà fait, ce bouton devient « Refaire le paquet avec ta réponse » : il n\'y a rien d\'autre à envoyer.' }
      ]
    });

    visite({
      id: 'recevoir-cloture', theme: 'compta', type: 'faire', duree: '1 min', page: '#/compta',
      titre: 'Recevoir la clôture de mon comptable',
      resume: 'Le fichier de fin d\'exercice : ses à-nouveaux officiels et tes états financiers.',
      mots: ['cloture', 'exercice', 'bilan', 'skanclose', 'a-nouveaux', 'etats financiers', 'annee'],
      suite: ['cloturer', 'paquet'],
      bravo: 'Tu sais recevoir sa clôture',
      conclusion: 'Quand l\'exercice est verrouillé, plus aucune pièce datée dedans ne bouge : ton bilan et le sien disent la même chose.',
      etapes: [
        { page: '#/compta', avant: onglet('#c-tabs', 'clotures'), cible: '#p-cloture-cabinet', cote: 'dessus', titre: 'La clôture de ton comptable',
          texte: 'Quand il a fini ton exercice, ton comptable t\'envoie un fichier <b>.skanclose</b> : ses à-nouveaux officiels, et tes états financiers.' },
        { page: '#/compta', cible: '#cl-import', cote: 'dessous', titre: 'L\'importer',
          texte: 'SkanFact lit sa signature — la première fois il la retient, ensuite il la compare — et te montre <b>ce qui va changer</b> avant d\'écrire quoi que ce soit.' },
        { page: '#/compta', cible: '#p-cloture-cabinet [data-etats]', cote: 'gauche', facultatif: true, titre: 'Ses états',
          texte: 'Le bilan et le compte de résultat qu\'il a arrêtés, tels qu\'il te les a envoyés.' }
      ]
    });

    visite({
      id: 'salarie', theme: 'personnel', type: 'faire', duree: '2 min', page: '#/paie',
      titre: 'Déclarer un salarié',
      resume: 'Son contrat, son salaire, son numéro CNSS : ses bulletins en découlent.',
      mots: ['salarie', 'employe', 'embaucher', 'paie', 'cnss'],
      suite: ['bulletin'],
      mesure: () => nb('employees'), but: n0 => nb('employees') > n0 && aucuneFenetre(),
      bravo: 'Ton salarié est déclaré',
      conclusion: 'Ses bulletins se calculent à partir de sa fiche. Fais valider le premier par ton comptable.',
      etapes: [
        { page: '#/paie', cible: ['#emp-first', '#new-emp'], cote: 'dessous', faire: 'clic',
          titre: 'Nouveau salarié', texte: '', action: 'Clique sur {bouton}.', fait: () => !!$('#modal-root .modal'), essai: { clic: true } },
        { cible: '#modal-root .modal input[name="name"]', cote: 'droite', faire: 'valeur', titre: 'Son nom', texte: '', action: 'Tape son nom et prénom.', essai: { taper: 'Sami Ben Ali' } },
        { cible: '#modal-root .modal input[name="gross"], #modal-root .modal [name="gross"]', cote: 'droite', titre: 'Son salaire brut', texte: 'Le brut mensuel : les cotisations et l\'impôt se calculent à partir de lui.', facultatif: true },
        { cible: '#modal-root .modal .modal-actions .btn-primary', cote: 'dessus', faire: 'clic', titre: 'Enregistrer', texte: '',
          action: 'Clique sur <b>« Enregistrer »</b>.', fait: () => aucuneFenetre(), essai: { clic: true } }
      ]
    });

    visite({
      id: 'bulletin', theme: 'personnel', type: 'faire', duree: '2 min', page: '#/paie',
      titre: 'Établir les bulletins du mois',
      resume: 'Calculés à partir des fiches, des congés et des avances.',
      mots: ['bulletin', 'paie', 'salaire', 'mois'],
      bravo: 'Les bulletins sont établis',
      conclusion: 'Quand le salaire est versé, « Marquer payé » le fait sortir de ta trésorerie.',
      etapes: [
        { page: '#/paie', avant: onglet('#p-tabs', 'bulletins'), cible: ['#p-gen', '#view .panel'], cote: 'dessous', titre: 'Ce qui manque',
          texte: 'SkanFact sait quels bulletins manquent pour le mois : <b>« Établir les … bulletins manquants »</b> (le bouton dit combien) les fait d\'un coup, à partir des fiches et des congés.' },
        { page: '#/paie', cible: '#view table.list', cote: 'dessus', facultatif: true, titre: 'Les bulletins du mois', texte: 'Chacun s\'ouvre pour être relu, et s\'exporte en PDF.' }
      ]
    });

    visite({
      id: 'immobilisation', theme: 'stock', type: 'faire', duree: '2 min', page: '#/immos',
      titre: 'Créer la fiche d\'un bien',
      resume: 'Un ordinateur, un véhicule : il s\'amortit, SkanFact tient le plan.',
      mots: ['immobilisation', 'amortissement', 'bien', 'materiel', 'vehicule'],
      mesure: () => nb('assets'), but: n0 => nb('assets') > n0 && aucuneFenetre(),
      bravo: 'Le bien est enregistré',
      conclusion: 'Son amortissement de l\'année entre tout seul dans ton résultat.',
      etapes: [
        { page: '#/immos', cible: '#new-imm', cote: 'dessous', faire: 'clic', titre: 'Nouveau bien', texte: '',
          action: 'Clique sur <b>« + Nouveau bien »</b>.', fait: () => !!$('#modal-root .modal'), essai: { clic: true } },
        { cible: '#modal-root .modal', cote: 'gauche', titre: 'Sa fiche',
          texte: 'Son nom, sa famille (la durée d\'usage est proposée), son prix et sa date de mise en service. <b>Le plan d\'amortissement s\'affiche pendant que tu tapes.</b>' }
      ]
    });

    visite({
      id: 'affaire', theme: 'pilotage', type: 'faire', duree: '2 min', page: '#/marges',
      titre: 'Suivre ce que rapporte un chantier',
      resume: 'Une affaire rassemble les ventes et les achats d\'un même chantier : sa marge réelle, achats déduits.',
      mots: ['affaire', 'chantier', 'projet', 'marge', 'rentabilite', 'rapporte'],
      suite: ['page-marges'],
      mesure: () => nb('projects'), but: n0 => nb('projects') > n0 && aucuneFenetre(),
      bravo: 'Ton affaire est créée',
      conclusion: 'Rattache-lui maintenant tes devis, tes factures et tes achats (le champ « Affaire » de chaque pièce) : sa fiche te dira ce que le chantier rapporte <b>vraiment</b>.',
      etapes: [
        { page: '#/marges', avant: onglet('#mg-tabs', 'affaires'), cible: '#new-proj', cote: 'dessous', faire: 'clic',
          titre: 'Nouvelle affaire', texte: 'Un chantier, un projet, une mission : tout ce qui a ses propres ventes et ses propres achats.',
          action: 'Clique sur <b>« + Nouvelle affaire »</b>.', fait: () => !!$('#modal-root .modal'), essai: { clic: true } },
        { cible: '#modal-root .modal input[name="name"]', cote: 'droite', faire: 'valeur',
          titre: 'Son nom', texte: 'Celui par lequel tu le désignes : « Villa Carthage », « Cantine de l\'école ».',
          action: 'Tape le nom de l\'affaire.', essai: { taper: 'Chantier Villa Carthage' } },
        { cible: [combo('clientId'), '#modal-root .modal [data-combo="clientId"]'], cote: 'droite', facultatif: true, titre: 'Son client',
          texte: 'Facultatif, mais utile : les pièces de ce client te proposeront cette affaire, et seulement elles.' },
        { cible: '#modal-root .modal .modal-actions .btn-primary', cote: 'dessus', faire: 'clic',
          titre: 'Enregistrer', texte: '', action: 'Clique sur <b>« Enregistrer »</b>.', fait: () => aucuneFenetre(), essai: { clic: true } }
      ]
    });

    visite({
      id: 'lire-stats', theme: 'pilotage', type: 'faire', duree: '2 min', page: '#/stats',
      titre: 'Lire mes statistiques',
      resume: 'Ton chiffre d\'affaires comparé à l\'an dernier, sur l\'année, un trimestre ou un mois.',
      mots: ['statistiques', 'chiffre d affaires', 'comparer', 'an dernier', 'evolution', 'periode'],
      suite: ['page-stats', 'page-marges'],
      bravo: 'Tu sais lire tes chiffres',
      conclusion: 'Reviens-y chaque mois : ce qui compte n\'est pas le chiffre, c\'est sa pente comparée à l\'an dernier.',
      etapes: [
        { page: '#/stats', cible: '#s-kind', cote: 'dessous', titre: 'La période',
          texte: 'L\'année entière, un trimestre ou un mois. Tout l\'écran suit ce choix.' },
        { page: '#/stats', cible: '#view .stats', cote: 'dessous', facultatif: true, titre: 'Comparé à l\'an dernier',
          texte: 'Chaque chiffre porte son évolution par rapport à la <b>même période</b> de l\'an dernier : c\'est elle qui dit si ça va mieux.' },
        { page: '#/stats', cible: '#s-export', cote: 'gauche', titre: 'Les emporter',
          texte: 'Le même tableau en CSV, pour ton banquier ou ton comptable.' }
      ]
    });

    visite({
      id: 'compte', theme: 'argent', type: 'faire', duree: '1 min', page: '#/tresorerie',
      titre: 'Ajouter un compte bancaire',
      resume: 'Ta banque, ta caisse : où arrive et d\'où part l\'argent.',
      mots: ['compte', 'banque', 'caisse', 'tresorerie'],
      mesure: () => nb('accounts'), but: n0 => nb('accounts') > n0 && aucuneFenetre(),
      bravo: 'Ton compte est créé',
      conclusion: 'Les paiements notés sur ce compte y arrivent tout seuls.',
      etapes: [
        { page: '#/tresorerie', cible: ['#first-acc', '#new-acc'], cote: 'dessous', faire: 'clic', titre: 'Nouveau compte', texte: '',
          action: 'Clique sur {bouton}.', fait: () => !!$('#modal-root .modal'), essai: { clic: true } },
        { cible: '#modal-root .modal', cote: 'gauche', titre: 'Le compte', texte: 'Son nom, sa banque, et son solde de départ (celui de ton relevé à la date de départ).' }
      ]
    });

    visite({
      id: 'rapprocher', theme: 'argent', type: 'faire', duree: '2 min', page: '#/tresorerie',
      titre: 'Rapprocher mon relevé bancaire',
      resume: 'Cocher ce qui apparaît sur le relevé : ce qui reste est à regarder.',
      mots: ['rapprocher', 'rapprochement', 'releve', 'pointer', 'banque'],
      bravo: 'C\'est pointé',
      conclusion: 'Quand le solde du relevé et celui de SkanFact tombent juste, ta banque est rapprochée.',
      etapes: [
        { page: '#/tresorerie', avant: onglet('#t-tabs', 'rapprochement'), cible: '#stmt', cote: 'dessous', titre: 'Le solde du relevé',
          texte: 'Recopie le solde de ton relevé bancaire : SkanFact te dit tout de suite si ça tombe juste.', facultatif: true },
        { page: '#/tresorerie', cible: '[data-rec]', cote: 'droite', titre: 'Pointer', texte: 'Coche chaque ligne qui apparaît sur ton relevé. Ce qui reste non coché, c\'est ce qu\'il faut regarder.', facultatif: true }
      ]
    });

    visite({
      id: 'modules', theme: 'reglages', type: 'faire', duree: '1 min', page: '#/modules',
      titre: 'Choisir ce qui s\'affiche dans le menu',
      resume: 'Masque ce dont tu n\'as pas besoin ; rien n\'est supprimé.',
      mots: ['modules', 'menu', 'masquer', 'afficher'],
      bravo: 'Ton menu est à ta mesure',
      conclusion: 'Un module masqué garde ses données, et revient d\'un clic.',
      etapes: [
        { page: '#/modules', cible: '#view', zone: '#view', titre: 'Tous les modules', texte: 'Coche ce que tu veux voir dans le menu. La paie, le stock, les immobilisations… n\'apparaissent que si tu en as besoin.' }
      ]
    });

    // ======================================================================= L'APPLICATION ET TES FICHIERS
    visite({
      id: 'fichiers', theme: 'appli', type: 'faire', duree: '2 min', page: '#/factures',
      titre: 'Retrouver un document ou un fichier',
      resume: 'Le PDF d\'une pièce, un fichier joint, un paquet envoyé, tes sauvegardes : où se trouve chacun.',
      mots: ['fichier', 'document', 'pdf', 'retrouver', 'ou est', 'dossier', 'piece jointe', 'sauvegarde', 'exporter', 'imprimer'],
      suite: ['justificatif', 'restaurer'],
      bravo: 'Tu sais où sont tes fichiers',
      conclusion: 'Ce que SkanFact fabrique — un PDF, un paquet — se range là où tu le choisis. Ce que tu joins, il en garde une copie à côté de tes données. Et ta copie de sécurité emporte tout.',
      etapes: [
        { page: () => ctx.premier('factureEmise') || ctx.premier('devis'), si: () => !!(ctx.premier('factureEmise') || ctx.premier('devis')), cible: '#pdf', cote: 'dessous',
          titre: 'Le PDF d\'une pièce', texte: '<b>« PDF »</b> l\'enregistre là où tu le choisis sur ton ordinateur, puis l\'ouvre. Pour l\'envoyer, <b>« Email »</b> prépare le message avec le PDF déjà joint.' },
        { si: () => !!$('#attachments'), cible: '.panel:has(> #attachments)', cote: 'dessus', facultatif: true,
          titre: 'Les fichiers joints à une pièce', texte: 'Le bon signé, une photo du chantier : le nom ouvre le fichier, <b>« Dossier »</b> le montre sur ton ordinateur.' },
        { page: '#/compta', avant: onglet('#c-tabs', 'ventes'), cible: '#exp-pdfs', cote: 'dessous', facultatif: true,
          titre: 'Tous les PDF d\'un coup', texte: 'Les PDF de toutes les pièces d\'une période, enregistrés en une fois dans le dossier que tu choisis.' },
        { page: '#/compta', avant: onglet('#c-tabs', 'cabinet'), cible: '#p-paquets', cote: 'dessus', facultatif: true,
          titre: 'Les paquets envoyés', texte: 'Chaque paquet du mois reste listé, avec <b>« Montrer le fichier »</b> : il le retrouve dans son dossier, même six mois après.' },
        { page: '#/parametres', avant: onglet('#set-tabs', 'donnees'), cible: '#open-backups', cote: 'dessous',
          titre: 'Tes sauvegardes', texte: 'Une par jour, gardées trente jours. <b>« Ouvrir le dossier des sauvegardes »</b> te montre où elles sont ; la liste juste en dessous sait revenir en arrière.' },
        { page: '#/parametres', cible: '#p-externe', cote: 'dessus', titre: 'Ta copie de sécurité',
          texte: 'Le dossier que tu as choisi — une clé USB, OneDrive, iCloud Drive — reçoit tout à chaque enregistrement : tes données, tes sauvegardes, et les fichiers joints.' }
      ]
    });

    visite({
      id: 'mise-a-jour', theme: 'appli', type: 'faire', duree: '1 min', page: '#/parametres',
      titre: 'Installer une mise à jour',
      resume: 'SkanFact cherche et télécharge tout seul ; rien ne s\'installe sans ton accord.',
      mots: ['mise a jour', 'version', 'installer', 'nouveautes', 'redemarrer', 'beta', 'essai', 'maj', 'nouvelle version'],
      suite: ['licence', 'signaler'],
      bravo: 'Tu sais te mettre à jour',
      conclusion: 'Tu n\'as rien à surveiller : quand une version est prête, une fenêtre te propose « Redémarrer maintenant » ou « Plus tard ». Ce que tu as enregistré ne bouge pas.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'app'), cible: '#p-maj', cote: 'dessus', titre: 'Tes mises à jour',
          texte: 'SkanFact cherche une nouvelle version <b>toutes les quatre heures</b> et au retour sur l\'application, et la télécharge en arrière-plan. <b>Rien ne s\'installe sans ton accord.</b>' },
        { page: '#/parametres', cible: '#upd-check', cote: 'dessous', facultatif: true, titre: 'Chercher tout de suite',
          texte: '« Rechercher les mises à jour » cherche sans attendre. Quand une version est prête, le bouton devient <b>« Redémarrer maintenant »</b> : l\'application se ferme, s\'installe et se relance.' },
        { page: '#/parametres', cible: '#upd-changelog', cote: 'gauche', facultatif: true, titre: 'Les nouveautés', texte: 'Ce qui a changé dans chaque version, en français.' },
        { page: '#/parametres', cible: '#upd-beta', cote: 'gauche', facultatif: true, titre: 'Les versions d\'essai',
          texte: 'Laisse-les <b>désactivées</b> sur l\'ordinateur qui tient ta vraie comptabilité : une version d\'essai sert à tester une nouveauté avant les autres. Une sauvegarde est prise avant.' }
      ]
    });

    visite({
      id: 'licence', theme: 'appli', type: 'faire', duree: '1 min', page: '#/parametres',
      titre: 'Activer ma licence',
      resume: 'Où en est ton essai, et où coller ta clé quand tu l\'as reçue.',
      mots: ['licence', 'cle', 'activer', 'essai', 'acheter', 'abonnement', 'offre', 'payer'],
      suite: ['mise-a-jour'],
      bravo: 'Tu sais activer ta licence',
      conclusion: 'Licence ou pas, tes données restent à toi : tu gardes toujours la lecture, l\'impression, l\'export et l\'envoi à ton comptable. Seule la création de nouvelles pièces attend ta licence.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'app'), cible: '#p-licence', cote: 'dessus', titre: 'Ta licence',
          texte: 'Où en est ton essai ou ta licence, jusqu\'à quand, et ce qu\'elle ouvre.' },
        { page: '#/parametres', cible: '#lic-key', cote: 'droite', facultatif: true, titre: 'Ta clé',
          texte: 'Quand tu la reçois — elle commence par <b>SKAN1.</b> —, colle-la ici, puis <b>« Enregistrer la clé »</b> : SkanFact la vérifie tout de suite, sans connexion.' },
        { page: '#/parametres', cible: '#lic-ask', cote: 'dessous', facultatif: true, titre: 'Pas encore de clé ?',
          texte: '<b>« Demander une licence »</b> prépare le mail qui la demande, avec ce qu\'il faut pour l\'établir à ton nom : ta raison sociale et ton matricule fiscal.' }
      ]
    });

    visite({
      id: 'signaler', theme: 'appli', type: 'faire', duree: '1 min', page: '#/parametres',
      titre: 'Signaler un problème ou proposer une idée',
      resume: 'Le journal technique part avec ton message : il dit où l\'application s\'est arrêtée, sans rien de ta gestion.',
      mots: ['probleme', 'bug', 'signaler', 'support', 'idee', 'amelioration', 'journal', 'depannage', 'contact'],
      suite: ['mise-a-jour'],
      bravo: 'Tu sais à qui parler',
      conclusion: 'SkanFact est écrit par une seule personne : ce que tu signales, et ce que tu proposes, décide de la suite.',
      etapes: [
        { page: '#/parametres', avant: onglet('#set-tabs', 'app'), cible: '#p-depannage', cote: 'dessus', titre: 'Aide et dépannage',
          texte: 'Quand quelque chose ne va pas, ou quand quelque chose te manque.' },
        { page: '#/parametres', cible: '#set-support', cote: 'dessous', titre: 'Signaler un problème',
          texte: 'Prépare un mail avec le <b>journal technique</b> joint : il dit où l\'application s\'est arrêtée, et ne contient ni nom de client, ni montant.' },
        { page: '#/parametres', cible: '#set-idee', cote: 'dessous', titre: 'Proposer une amélioration',
          texte: 'Ce que tu aimerais faire, puis comment tu t\'en sors aujourd\'hui : c\'est la seconde réponse qui apprend le plus.' },
        { page: '#/parametres', cible: '#set-log', cote: 'dessous', facultatif: true, titre: 'Le journal',
          texte: 'Tu peux le lire avant de l\'envoyer.' }
      ]
    });

    // ======================================================================= CHAQUE PAGE
    // La visite d'une page se LIT sur l'écran (visite.js, `etapesDeLaVue`) : l'en-tête, les
    // onglets (chacun devient un chapitre), les filtres, chaque panneau, chaque tableau — et chaque
    // bouton nommé et expliqué. Ce qui s'écrit ici, c'est la présentation de la page.
    // Ce qu'il faut avoir pour voir la page d'un objet, et la visite qui le fabrique.
    const FICHE_MANQUE = {
      doc: { texte: 'Il te faut d\'abord une pièce — un devis ou une facture.', visite: 'premier-devis' },
      client: { texte: 'Il te faut d\'abord un client.', visite: 'premier-client' },
      contrat: { texte: 'Il te faut d\'abord un contrat récurrent (page « Facturation récurrente »).' },
      fournisseur: { texte: 'Il te faut d\'abord un fournisseur.', visite: 'fournisseur' },
      achat: { texte: 'Il te faut d\'abord une facture d\'achat.', visite: 'achat' },
      affaire: { texte: 'Il te faut d\'abord une affaire (page « Marges », onglet Affaires).' },
      salarie: { texte: 'Il te faut d\'abord un salarié.', visite: 'salarie' },
      article: { texte: 'Il te faut d\'abord un article suivi en stock (fiche d\'une prestation du catalogue, case « Suivi en stock »).' },
      immo: { texte: 'Il te faut d\'abord la fiche d\'un bien.', visite: 'immobilisation' }
    };
    Object.keys(PAGES).forEach(r => {
      const P = PAGES[r];
      const cle = P.fiche;
      const ouvrir = cle ? () => (route() === r ? location.hash : ctx.premier(cle)) : '#/' + r;
      visite({
        id: 'page-' + r, theme: 'pages', type: 'page', route: r, duree: '2 min', titre: P.titre, resume: P.resume,
        mots: [r, P.titre.toLowerCase()], suite: [],
        si: cle ? () => !!(route() === r || ctx.premier(cle)) : null,
        manque: cle ? FICHE_MANQUE[cle] : null,
        // Les licences ne concernent que l'éditeur de SkanFact : chez un client, la visite n'existe pas.
        visible: r === 'licences' ? () => !!(ctx.editeur && ctx.editeur()) || nb('licences') > 0 : null,
        bravo: 'Tu connais cette page',
        conclusion: 'Chaque bouton a son explication. Tu retrouveras cette visite dans « Me guider », et l\'article complet dans « Comprendre cette page ».',
        etapes: [
          { page: ouvrir, titre: P.titre, texte: P.texte },
          { page: ouvrir, titre: P.titre, deplier: () => ctx.Visite.etapesDeLaVue({ onglets: true }) }
        ]
      });
    });

    return L;
  }

  return { THEMES, PAGES, COULEUR_PAGE, ZONES, ONGLETS, BOUTONS: B, CHAMPS, MENUS, expliquer, zone, parcours, libelleDe, resume, couleurDe, iconeDe };
});
